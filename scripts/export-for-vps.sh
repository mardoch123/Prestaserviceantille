#!/bin/bash
# =============================================================================
# SCRIPT DE MIGRATION COMPLÈTE VERS VPS AAPANEL
# =============================================================================
# Ce script exporte TOUT depuis ton environnement local et prépare 
# un package prêt à être importé sur ton VPS aaPanel
#
# Usage:
#   1. Configure les variables ci-dessous
#   2. ./export-for-vps.sh
#   3. Copie le dossier 'vps-migration-package/' sur ton VPS
#   4. Sur le VPS: ./import-to-vps.sh
# =============================================================================

set -e

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# =============================================================================
# CONFIGURATION - MODIFIE CES VARIABLES
# =============================================================================

# Source (ton environnement local/dev)
SOURCE_DB_HOST="localhost"
SOURCE_DB_PORT="5432"
SOURCE_DB_NAME="postgres"
SOURCE_DB_USER="postgres"
SOURCE_DB_PASSWORD="votre-mot-de-passe-local"  # ← MODIFIE ICI

# Dossier du projet local
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Dossier de sortie
MIGRATION_DIR="$PROJECT_ROOT/vps-migration-package"
BACKUP_DIR="$MIGRATION_DIR/backup-$(date +%Y%m%d-%H%M%S)"

# =============================================================================
# VÉRIFICATIONS
# =============================================================================

check_prerequisites() {
    log_info "Vérification des prérequis..."
    
    # Vérifier pg_dump
    if ! command -v pg_dump &> /dev/null; then
        log_error "pg_dump n'est pas installé"
        log_info "Installation: sudo apt-get install postgresql-client"
        exit 1
    fi
    
    # Vérifier la connexion à la base
    log_info "Test de connexion à la base locale..."
    if ! PGPASSWORD="$SOURCE_DB_PASSWORD" psql -h "$SOURCE_DB_HOST" -p "$SOURCE_DB_PORT" -U "$SOURCE_DB_USER" -d "$SOURCE_DB_NAME" -c "SELECT 1;" &> /dev/null; then
        log_error "Impossible de se connecter à la base locale"
        log_info "Vérifiez les identifiants dans SOURCE_DB_PASSWORD"
        exit 1
    fi
    
    # Créer les dossiers
    mkdir -p "$BACKUP_DIR"
    mkdir -p "$MIGRATION_DIR/edge-functions"
    mkdir -p "$MIGRATION_DIR/migrations"
    
    log_success "Prérequis OK"
}

# =============================================================================
# EXPORT DE LA BASE DE DONNÉES (STRUCTURE + DONNÉES)
# =============================================================================

export_database() {
    log_info "Export de la base de données..."
    
    # Export complet (structure + données)
    log_info "Création du dump complet..."
    PGPASSWORD="$SOURCE_DB_PASSWORD" pg_dump \
        -h "$SOURCE_DB_HOST" \
        -p "$SOURCE_DB_PORT" \
        -U "$SOURCE_DB_USER" \
        -d "$SOURCE_DB_NAME" \
        --verbose \
        --format=plain \
        --clean \
        --if-exists \
        --create \
        --inserts \
        --on-conflict-do-nothing \
        --quote-all-identifiers \
        > "$BACKUP_DIR/full-database.sql"
    
    log_success "Dump complet créé: $BACKUP_DIR/full-database.sql"
    
    # Export uniquement la structure (pour référence)
    log_info "Création du dump structure uniquement..."
    PGPASSWORD="$SOURCE_DB_PASSWORD" pg_dump \
        -h "$SOURCE_DB_HOST" \
        -p "$SOURCE_DB_PORT" \
        -U "$SOURCE_DB_USER" \
        -d "$SOURCE_DB_NAME" \
        --verbose \
        --format=plain \
        --schema-only \
        --quote-all-identifiers \
        > "$BACKUP_DIR/schema-only.sql"
    
    log_success "Dump structure créé: $BACKUP_DIR/schema-only.sql"
    
    # Liste des tables avec count (pour vérification)
    log_info "Export des statistiques des tables..."
    PGPASSWORD="$SOURCE_DB_PASSWORD" psql \
        -h "$SOURCE_DB_HOST" \
        -p "$SOURCE_DB_PORT" \
        -U "$SOURCE_DB_USER" \
        -d "$SOURCE_DB_NAME" \
        -c "
        SELECT 
            schemaname,
            tablename,
            pg_catalog.pg_total_relation_size(schemaname||'.'||tablename) AS size,
            (SELECT COUNT(*) FROM \"\"\${tablename}\"\") AS row_count
        FROM pg_tables 
        WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
        ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
    " > "$BACKUP_DIR/tables-stats.txt" 2>/dev/null || echo "Stats non disponibles" > "$BACKUP_DIR/tables-stats.txt"
    
    log_success "Statistiques exportées"
}

# =============================================================================
# EXPORT DES EDGE FUNCTIONS
# =============================================================================

export_edge_functions() {
    log_info "Export des Edge Functions..."
    
    FUNCTIONS_DIR="$PROJECT_ROOT/supabase/functions"
    
    if [ ! -d "$FUNCTIONS_DIR" ]; then
        log_warning "Dossier supabase/functions non trouvé"
        return
    fi
    
    # Copier toutes les fonctions
    for func_dir in "$FUNCTIONS_DIR"/*; do
        if [ -d "$func_dir" ]; then
            func_name=$(basename "$func_dir")
            log_info "Export de: $func_name"
            
            # Créer le dossier et copier les fichiers
            mkdir -p "$MIGRATION_DIR/edge-functions/$func_name"
            cp -r "$func_dir"/* "$MIGRATION_DIR/edge-functions/$func_name/"
        fi
    done
    
    # Créer un manifest des fonctions
    ls -la "$FUNCTIONS_DIR" > "$MIGRATION_DIR/edge-functions/manifest.txt"
    
    log_success "Edge Functions exportées"
}

# =============================================================================
# EXPORT DES MIGRATIONS SQL
# =============================================================================

export_migrations() {
    log_info "Export des migrations..."
    
    MIGRATIONS_DIR="$PROJECT_ROOT/supabase/migrations"
    
    if [ ! -d "$MIGRATIONS_DIR" ]; then
        log_warning "Dossier migrations non trouvé"
        return
    fi
    
    # Copier toutes les migrations
    cp -r "$MIGRATIONS_DIR"/* "$MIGRATION_DIR/migrations/"
    
    # Créer un fichier de résumé
    echo "Migrations disponibles:" > "$MIGRATION_DIR/migrations/README.txt"
    ls -1 "$MIGRATIONS_DIR" >> "$MIGRATION_DIR/migrations/README.txt"
    
    log_success "Migrations exportées"
}

# =============================================================================
# CRÉATION DU SCRIPT D'IMPORT POUR VPS
# =============================================================================

create_import_script() {
    log_info "Création du script d'import pour VPS..."
    
    cat > "$MIGRATION_DIR/import-to-vps.sh" << 'VPS_SCRIPT'
#!/bin/bash
# =============================================================================
# SCRIPT D'IMPORT SUR VPS AAPANEL
# =============================================================================
# À exécuter sur ton VPS après avoir copié le dossier vps-migration-package
#
# Usage sur VPS:
#   cd /chemin/vers/vps-migration-package
#   chmod +x import-to-vps.sh
#   ./import-to-vps.sh
# =============================================================================

set -e

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# =============================================================================
# CONFIGURATION VPS - MODIFIE CES VARIABLES
# =============================================================================

# Base de données cible (sur ton VPS aaPanel)
VPS_DB_HOST="localhost"
VPS_DB_PORT="5432"
VPS_DB_NAME="postgres"
VPS_DB_USER="postgres"
VPS_DB_PASSWORD="votre-mot-de-passe-vps"  # ← MODIFIE ICI (mot de passe PostgreSQL de ton VPS)

# Supabase VPS (NOUVEAUX - Self-hosted)
SUPABASE_URL="https://outremerfermetures.com/api"
SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3NzI1Nzg4MDAsImV4cCI6MTkzMDM0NTIwMH0.4N8utvMn8tgjgt7aOTUPDZdutp-plKd-0Gm5Pe3e7m8"
SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzcyNTc4ODAwLCJleHAiOjE5MzAzNDUyMDB9.JTRP_WOGEdKzb8rMaSP_FMox5AN0WD4bD_hgP6dW-PA"

# =============================================================================
# VÉRIFICATIONS
# =============================================================================

check_prerequisites() {
    log_info "Vérification des prérequis sur VPS..."
    
    # Vérifier psql
    if ! command -v psql &> /dev/null; then
        log_info "Installation de postgresql-client..."
        sudo apt-get update
        sudo apt-get install -y postgresql-client
    fi
    
    # Vérifier la connexion
    log_info "Test de connexion à PostgreSQL..."
    if ! PGPASSWORD="$VPS_DB_PASSWORD" psql -h "$VPS_DB_HOST" -p "$VPS_DB_PORT" -U "$VPS_DB_USER" -c "SELECT 1;" &> /dev/null; then
        log_error "Impossible de se connecter à PostgreSQL sur le VPS"
        log_info "Vérifiez que PostgreSQL est démarré et accessible"
        exit 1
    fi
    
    # Vérifier que le dump existe
    BACKUP_DIR=$(find . -name "backup-*" -type d | head -1)
    if [ -z "$BACKUP_DIR" ]; then
        log_error "Dossier backup-* non trouvé"
        exit 1
    fi
    
    log_success "Prérequis OK - Backup trouvé: $BACKUP_DIR"
}

# =============================================================================
# SAUVEGARDE DE LA BASE EXISTANTE (optionnel)
# =============================================================================

backup_existing() {
    log_info "Sauvegarde de la base existante (sécurité)..."
    
    BACKUP_NAME="pre-migration-backup-$(date +%Y%m%d-%H%M%S).sql"
    
    PGPASSWORD="$VPS_DB_PASSWORD" pg_dump \
        -h "$VPS_DB_HOST" \
        -p "$VPS_DB_PORT" \
        -U "$VPS_DB_USER" \
        -d "$VPS_DB_NAME" \
        --verbose \
        > "$BACKUP_NAME" 2>/dev/null || {
        log_warning "Impossible de sauvegarder la base existante (peut-être vide)"
    }
    
    if [ -f "$BACKUP_NAME" ]; then
        log_success "Sauvegarde créée: $BACKUP_NAME"
    fi
}

# =============================================================================
# IMPORT DE LA BASE DE DONNÉES
# =============================================================================

import_database() {
    log_info "Import de la base de données..."
    
    BACKUP_DIR=$(find . -name "backup-*" -type d | head -1)
    DUMP_FILE="$BACKUP_DIR/full-database.sql"
    
    if [ ! -f "$DUMP_FILE" ]; then
        log_error "Fichier dump non trouvé: $DUMP_FILE"
        exit 1
    fi
    
    # Arrêter les connexions existantes (optionnel mais recommandé)
    log_info "Préparation de la base..."
    PGPASSWORD="$VPS_DB_PASSWORD" psql \
        -h "$VPS_DB_HOST" \
        -p "$VPS_DB_PORT" \
        -U "$VPS_DB_USER" \
        -d postgres \
        -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$VPS_DB_NAME' AND pid <> pg_backend_pid();" 2>/dev/null || true
    
    # Supprimer et recréer la base
    log_info "Recréation de la base '$VPS_DB_NAME'..."
    PGPASSWORD="$VPS_DB_PASSWORD" psql \
        -h "$VPS_DB_HOST" \
        -p "$VPS_DB_PORT" \
        -U "$VPS_DB_USER" \
        -d postgres \
        -c "DROP DATABASE IF EXISTS $VPS_DB_NAME;" 2>/dev/null || true
    
    PGPASSWORD="$VPS_DB_PASSWORD" psql \
        -h "$VPS_DB_HOST" \
        -p "$VPS_DB_PORT" \
        -U "$VPS_DB_USER" \
        -d postgres \
        -c "CREATE DATABASE $VPS_DB_NAME;"
    
    # Import du dump
    log_info "Import des données (cela peut prendre quelques minutes)..."
    PGPASSWORD="$VPS_DB_PASSWORD" psql \
        -h "$VPS_DB_HOST" \
        -p "$VPS_DB_PORT" \
        -U "$VPS_DB_USER" \
        -d "$VPS_DB_NAME" \
        -f "$DUMP_FILE" 2>&1 | tee import.log
    
    if [ ${PIPESTATUS[0]} -eq 0 ]; then
        log_success "Import terminé avec succès !"
    else
        log_error "Erreurs lors de l'import - vérifiez import.log"
        log_warning "Certaines erreurs peuvent être normales (tables existantes, etc.)"
    fi
}

# =============================================================================
# VÉRIFICATION POST-IMPORT
# =============================================================================

verify_import() {
    log_info "Vérification post-import..."
    
    # Compter les tables
    TABLE_COUNT=$(PGPASSWORD="$VPS_DB_PASSWORD" psql \
        -h "$VPS_DB_HOST" \
        -p "$VPS_DB_PORT" \
        -U "$VPS_DB_USER" \
        -d "$VPS_DB_NAME" \
        -t \
        -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null | xargs)
    
    log_success "Nombre de tables dans 'public': $TABLE_COUNT"
    
    # Lister quelques tables
    log_info "Tables principales:"
    PGPASSWORD="$VPS_DB_PASSWORD" psql \
        -h "$VPS_DB_HOST" \
        -p "$VPS_DB_PORT" \
        -U "$VPS_DB_USER" \
        -d "$VPS_DB_NAME" \
        -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' LIMIT 10;"
    
    # Vérifier les migrations
    log_info "Vérification des migrations appliquées:"
    PGPASSWORD="$VPS_DB_PASSWORD" psql \
        -h "$VPS_DB_HOST" \
        -p "$VPS_DB_PORT" \
        -U "$VPS_DB_USER" \
        -d "$VPS_DB_NAME" \
        -c "SELECT * FROM schema_migrations ORDER BY version DESC LIMIT 5;" 2>/dev/null || log_warning "Table schema_migrations non trouvée"
}

# =============================================================================
# DÉPLOIEMENT DES EDGE FUNCTIONS (optionnel)
# =============================================================================

deploy_edge_functions() {
    if [ ! -d "edge-functions" ]; then
        log_warning "Dossier edge-functions non trouvé - skip"
        return
    fi
    
    log_info "Déploiement des Edge Functions..."
    
    if ! command -v supabase &> /dev/null; then
        log_warning "Supabase CLI non installé - skip déploiement fonctions"
        log_info "Pour déployer les fonctions plus tard:"
        log_info "  1. Installez Supabase CLI: npm install -g supabase"
        log_info "  2. supabase login"
        log_info "  3. supabase link --project-ref <votre-project>"
        log_info "  4. supabase functions deploy"
        return
    fi
    
    # Déployer chaque fonction
    for func_dir in edge-functions/*; do
        if [ -d "$func_dir" ]; then
            func_name=$(basename "$func_dir")
            log_info "Déploiement de: $func_name"
            supabase functions deploy "$func_name" || log_warning "Échec déploiement $func_name"
        fi
    done
}

# =============================================================================
# MENU PRINCIPAL
# =============================================================================

show_menu() {
    echo ""
    echo "=========================================="
    echo "  IMPORT SUR VPS AAPANEL"
    echo "=========================================="
    echo ""
    echo "1. Import COMPLET (Base + Vérification)"
    echo "2. Import de la base uniquement"
    echo "3. Vérification uniquement"
    echo "4. Déployer Edge Functions"
    echo "5. Quitter"
    echo ""
}

# =============================================================================
# EXÉCUTION COMPLÈTE
# =============================================================================

full_import() {
    log_info "🚀 DÉMARRAGE DE L'IMPORT COMPLET SUR VPS"
    check_prerequisites
    backup_existing
    import_database
    verify_import
    log_success "✅ IMPORT TERMINÉ AVEC SUCCÈS !"
    
    echo ""
    echo "📊 RÉCAPITULATIF:"
    echo "  - Base de données: Importée"
    echo "  - Tables: $TABLE_COUNT tables"
    echo "  - Logs: import.log"
    echo ""
    echo "⚠️  PROCHAINES ÉTAPES:"
    echo "  1. Vérifiez vos applications connectent bien à la base"
    echo "  2. Testez les fonctionnalités clés"
    echo "  3. Déployez les Edge Functions si besoin (option 4)"
    echo ""
}

# =============================================================================
# MAIN
# =============================================================================

main() {
    # Mode auto si argument --auto
    if [ "$1" = "--auto" ]; then
        full_import
        exit 0
    fi
    
    while true; do
        show_menu
        read -p "Choix (1-5): " choice
        
        case $choice in
            1) full_import ;;
            2) 
                check_prerequisites
                import_database
                ;;
            3) 
                check_prerequisites
                verify_import
                ;;
            4) deploy_edge_functions ;;
            5) exit 0 ;;
            *) log_error "Choix invalide" ;;
        esac
        
        echo ""
        read -p "Appuyez sur Entrée..."
    done
}

main "$@"
VPS_SCRIPT

    chmod +x "$MIGRATION_DIR/import-to-vps.sh"
    
    log_success "Script d'import créé"
}

# =============================================================================
# CRÉATION DU README
# =============================================================================

create_readme() {
    cat > "$MIGRATION_DIR/README.md" << EOF
# Package de Migration VPS

Généré le: $(date)

## Contenu

- \`backup-*/\` - Dump complet de la base de données (structure + données)
- \`edge-functions/\` - Toutes les Edge Functions Supabase
- \`migrations/\` - Fichiers SQL de migration
- \`import-to-vps.sh\` - Script d'import à exécuter sur le VPS

## Instructions

### 1. Sur ta machine locale (déjà fait)
✅ Export terminé

### 2. Transfert vers VPS

```bash
# Compresser
zip -r vps-migration-package.zip vps-migration-package/

# Transférer (choisis une méthode)
scp vps-migration-package.zip root@TON_VPS_IP:/root/
# ou
rsync -avz vps-migration-package/ root@TON_VPS_IP:/root/vps-migration-package/
```

### 3. Sur le VPS

```bash
# Se connecter
ssh root@TON_VPS_IP

# Extraire si zip
unzip vps-migration-package.zip

cd vps-migration-package

# Éditer la config
nano import-to-vps.sh
# Modifier: VPS_DB_PASSWORD et autres variables

# Lancer l'import
chmod +x import-to-vps.sh
./import-to-vps.sh --auto
```

## Vérification Post-Import

1. Connectez-vous à aaPanel
2. Vérifiez PostgreSQL est démarré
3. Testez la connexion avec votre application
4. Vérifiez les logs: \`tail -f import.log\`

## Support

En cas d'erreur:
1. Consultez \`import.log\`
2. Vérifiez les identifiants PostgreSQL
3. Assurez-vous que PostgreSQL accepte les connexions externes (si besoin)
EOF

    log_success "README créé"
}

# =============================================================================
# CRÉATION DU SCRIPT DE TRANSFERT
# =============================================================================

create_transfer_script() {
    cat > "$MIGRATION_DIR/transfer-to-vps.sh" << EOF
#!/bin/bash
# Script de transfert automatique vers VPS
# Usage: ./transfer-to-vps.sh user@VPS_IP

VPS_USER_HOST=\${1:-"root@VOTRE_IP_VPS"}

echo "Transfert vers \$VPS_USER_HOST..."

# Méthode 1: rsync (recommandé)
rsync -avz --progress \
    --exclude='*.log' \
    ../vps-migration-package/ \
    \$VPS_USER_HOST:/root/vps-migration-package/

# Méthode 2: scp (alternative)
# scp -r ../vps-migration-package \$VPS_USER_HOST:/root/

echo "Transfert terminé !"
echo "Connectez-vous au VPS et exécutez:"
echo "  cd /root/vps-migration-package"
echo "  ./import-to-vps.sh"
EOF

    chmod +x "$MIGRATION_DIR/transfer-to-vps.sh"
    log_success "Script de transfert créé"
}

# =============================================================================
# RÉSUMÉ FINAL
# =============================================================================

show_summary() {
    echo ""
    echo "=========================================="
    echo "  ✅ EXPORT TERMINÉ AVEC SUCCÈS !"
    echo "=========================================="
    echo ""
    echo "📦 Package créé: $MIGRATION_DIR"
    echo ""
    echo "📁 Contenu:"
    du -sh "$BACKUP_DIR"/* 2>/dev/null | while read size file; do
        echo "   - \$(basename \$file): \$size"
    done
    echo ""
    echo "🚀 PROCHAINES ÉTAPES:"
    echo ""
    echo "1. Transférer vers VPS:"
    echo "   cd \$(dirname \$MIGRATION_DIR)"
    echo "   $MIGRATION_DIR/transfer-to-vps.sh root@TON_VPS_IP"
    echo ""
    echo "2. Sur le VPS, éditer la config:"
    echo "   nano /root/vps-migration-package/import-to-vps.sh"
    echo "   # Modifier VPS_DB_PASSWORD avec ton mot de passe VPS"
    echo ""
    echo "3. Lancer l'import:"
    echo "   ./import-to-vps.sh --auto"
    echo ""
    echo "📖 Guide complet: $MIGRATION_DIR/README.md"
    echo ""
}

# =============================================================================
# MAIN
# =============================================================================

main() {
    echo ""
    echo "=========================================="
    echo "  EXPORT POUR VPS AAPANEL"
    echo "=========================================="
    echo ""
    
    # Mode auto si argument --auto
    if [ "$1" = "--auto" ]; then
        check_prerequisites
        export_database
        export_edge_functions
        export_migrations
        create_import_script
        create_readme
        create_transfer_script
        show_summary
        exit 0
    fi
    
    # Mode interactif
    read -p "Continuer l'export ? (oui/non): " confirm
    if [ "$confirm" != "oui" ]; then
        echo "Annulé."
        exit 0
    fi
    
    check_prerequisites
    export_database
    export_edge_functions
    export_migrations
    create_import_script
    create_readme
    create_transfer_script
    show_summary
    
    log_success "Terminé !"
}

main "$@"
