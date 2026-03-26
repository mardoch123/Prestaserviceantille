#!/bin/bash
# =============================================================================
# MIGRATION COMPLÈTE VERS VPS - OUTREMER FERMETURES
# =============================================================================
# Ce script effectue une migration complète depuis Supabase Cloud vers ton VPS
# self-hosted : https://outremerfermetures.com/api
#
# ATTENTION: Ce script SUPPRIME TOUTES les anciennes données et les remplace
#
# Usage sur VPS:
#   1. Copier ce script sur ton VPS
#   2. chmod +x migrate-to-vps.sh
#   3. ./migrate-to-vps.sh
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
# CONFIGURATION - À MODIFIER SELON TON ENVIRONNEMENT
# =============================================================================

# VPS PostgreSQL (via aaPanel ou direct)
VPS_DB_HOST="localhost"
VPS_DB_PORT="5432"
VPS_DB_NAME="postgres"
VPS_DB_USER="postgres"
VPS_DB_PASSWORD="${VPS_DB_PASSWORD:-votre_mot_de_passe_db}"  # ← MODIFIE ICI ou passe en env var

# Supabase VPS (Self-hosted)
SUPABASE_URL="https://outremerfermetures.com/api"
SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3NzI1Nzg4MDAsImV4cCI6MTkzMDM0NTIwMH0.4N8utvMn8tgjgt7aOTUPDZdutp-plKd-0Gm5Pe3e7m8"
SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzcyNTc4ODAwLCJleHAiOjE5MzAzNDUyMDB9.JTRP_WOGEdKzb8rMaSP_FMox5AN0WD4bD_hgP6dW-PA"

# Ancien Supabase Cloud (pour référence - plus utilisé)
# OLD_SUPABASE_URL="https://outremerfermetures.com/api"
# OLD_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzcyNTc4ODAwLCJleHAiOjE5MzAzNDUyMDB9.JTRP_WOGEdKzb8rMaSP_FMox5AN0WD4bD_hgP6dW-PA"
# OLD_SERVICE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im15emJrYnFranlrZHNheW11anZsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDAzOTU2NywiZXhwIjoyMDc5NjE1NTY3fQ.1r1DvNXg9n9uHT3-FFFcG3t4hCowaiijqTyXt1GwtOg"

# =============================================================================
# VÉRIFICATIONS PRÉALABLES
# =============================================================================

check_prerequisites() {
    log_info "Vérification des prérequis..."
    
    # Vérifier psql
    if ! command -v psql &> /dev/null; then
        log_info "Installation de postgresql-client..."
        sudo apt-get update && sudo apt-get install -y postgresql-client
    fi
    
    # Vérifier la connexion PostgreSQL
    log_info "Test de connexion à PostgreSQL..."
    if ! PGPASSWORD="$VPS_DB_PASSWORD" psql -h "$VPS_DB_HOST" -p "$VPS_DB_PORT" -U "$VPS_DB_USER" -c "SELECT 1;" &> /dev/null; then
        log_error "Impossible de se connecter à PostgreSQL"
        log_info "Vérifiez:"
        log_info "  - Que PostgreSQL est démarré: sudo systemctl status postgresql"
        log_info "  - Que le port $VPS_DB_PORT est ouvert"
        log_info "  - Que le mot de passe est correct"
        exit 1
    fi
    
    log_success "Connexion PostgreSQL OK"
}

# =============================================================================
# NETTOYAGE COMPLET DE LA BASE EXISTANTE
# =============================================================================

clean_database() {
    log_warning "⚠️  ATTENTION: Cette opération va SUPPRIMER TOUTES les données existantes !"
    read -p "Êtes-vous sûr de vouloir continuer ? (oui/NON): " confirm
    
    if [ "$confirm" != "oui" ]; then
        log_info "Opération annulée"
        exit 0
    fi
    
    log_info "Nettoyage de la base de données..."
    
    # Créer un backup de sécurité avant destruction
    log_info "Création d'un backup de sécurité..."
    BACKUP_FILE="/tmp/pre-migration-backup-$(date +%Y%m%d-%H%M%S).sql"
    PGPASSWORD="$VPS_DB_PASSWORD" pg_dump \
        -h "$VPS_DB_HOST" \
        -p "$VPS_DB_PORT" \
        -U "$VPS_DB_USER" \
        -d "$VPS_DB_NAME" \
        --verbose \
        > "$BACKUP_FILE" 2>/dev/null || {
        log_warning "Impossible de créer le backup (base peut-être vide)"
    }
    
    if [ -f "$BACKUP_FILE" ]; then
        log_success "Backup créé: $BACKUP_FILE"
    fi
    
    # Supprimer toutes les tables du schéma public
    log_info "Suppression des tables existantes..."
    
    PGPASSWORD="$VPS_DB_PASSWORD" psql \
        -h "$VPS_DB_HOST" \
        -p "$VPS_DB_PORT" \
        -U "$VPS_DB_USER" \
        -d "$VPS_DB_NAME" \
        << 'EOF'
-- Désactiver temporairement les triggers
SET session_replication_role = replica;

-- Supprimer toutes les tables
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE 'DROP TABLE IF EXISTS public.' || quote_ident(r.tablename) || ' CASCADE';
    END LOOP;
END $$;

-- Supprimer toutes les fonctions
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT proname, oidvectortypes(proargtypes) as args 
              FROM pg_proc 
              WHERE pronamespace = 'public'::regnamespace) LOOP
        EXECUTE 'DROP FUNCTION IF EXISTS public.' || quote_ident(r.proname) || '(' || r.args || ')';
    END LOOP;
END $$;

-- Supprimer toutes les séquences
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT sequencename FROM pg_sequences WHERE schemaname = 'public') LOOP
        EXECUTE 'DROP SEQUENCE IF EXISTS public.' || quote_ident(r.sequencename) || ' CASCADE';
    END LOOP;
END $$;

-- Supprimer toutes les vues
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT viewname FROM pg_views WHERE schemaname = 'public') LOOP
        EXECUTE 'DROP VIEW IF EXISTS public.' || quote_ident(r.viewname) || ' CASCADE';
    END LOOP;
END $$;

-- Supprimer les extensions (optionnel, à commenter si vous voulez garder)
-- DROP EXTENSION IF EXISTS pg_net;
-- DROP EXTENSION IF EXISTS pg_cron;

-- Réactiver les triggers
SET session_replication_role = DEFAULT;
EOF

    log_success "Base de données nettoyée"
}

# =============================================================================
# IMPORT DU DUMP SQL
# =============================================================================

import_database() {
    log_info "Préparation de l'import..."
    
    # Chercher le fichier SQL dans le dossier courant ou demander le chemin
    DUMP_FILE=""
    
    # Chercher les fichiers .sql dans le dossier courant
    for f in *.sql; do
        if [ -f "$f" ]; then
            DUMP_FILE="$f"
            log_info "Fichier SQL trouvé: $DUMP_FILE"
            break
        fi
    done
    
    # Si pas trouvé, demander
    if [ -z "$DUMP_FILE" ]; then
        read -p "Chemin vers le fichier SQL à importer: " DUMP_FILE
        if [ ! -f "$DUMP_FILE" ]; then
            log_error "Fichier non trouvé: $DUMP_FILE"
            exit 1
        fi
    fi
    
    log_info "Import de la base de données (cela peut prendre plusieurs minutes)..."
    
    # Import avec gestion des erreurs
    PGPASSWORD="$VPS_DB_PASSWORD" psql \
        -h "$VPS_DB_HOST" \
        -p "$VPS_DB_PORT" \
        -U "$VPS_DB_USER" \
        -d "$VPS_DB_NAME" \
        -f "$DUMP_FILE" 2>&1 | tee migration.log | while read line; do
            # Afficher uniquement les erreurs importantes
            if echo "$line" | grep -qi "error\|erreur\|fatal"; then
                log_error "$line"
            fi
        done
    
    # Vérifier le code de retour
    if [ ${PIPESTATUS[0]} -eq 0 ]; then
        log_success "Import terminé avec succès !"
    else
        log_warning "Import terminé avec des avertissements (vérifiez migration.log)"
    fi
}

# =============================================================================
# VÉRIFICATION POST-MIGRATION
# =============================================================================

verify_migration() {
    log_info "Vérification de la migration..."
    
    # Compter les tables
    TABLE_COUNT=$(PGPASSWORD="$VPS_DB_PASSWORD" psql \
        -h "$VPS_DB_HOST" \
        -p "$VPS_DB_PORT" \
        -U "$VPS_DB_USER" \
        -d "$VPS_DB_NAME" \
        -t \
        -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null | xargs)
    
    log_success "Nombre de tables: $TABLE_COUNT"
    
    # Vérifier quelques tables clés
    log_info "Vérification des tables principales..."
    
    KEY_TABLES=("clients" "providers" "missions" "documents" "contracts" "notifications")
    for table in "${KEY_TABLES[@]}"; do
        EXISTS=$(PGPASSWORD="$VPS_DB_PASSWORD" psql \
            -h "$VPS_DB_HOST" \
            -p "$VPS_DB_PORT" \
            -U "$VPS_DB_USER" \
            -d "$VPS_DB_NAME" \
            -t \
            -c "SELECT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = '$table');" 2>/dev/null | xargs)
        
        if [ "$EXISTS" = "t" ]; then
            COUNT=$(PGPASSWORD="$VPS_DB_PASSWORD" psql \
                -h "$VPS_DB_HOST" \
                -p "$VPS_DB_PORT" \
                -U "$VPS_DB_USER" \
                -d "$VPS_DB_NAME" \
                -t \
                -c "SELECT COUNT(*) FROM \"$table\";" 2>/dev/null | xargs)
            log_success "  ✓ $table: $COUNT lignes"
        else
            log_error "  ✗ $table: NON TROUVÉE"
        fi
    done
}

# =============================================================================
# MISE À JOUR DU .ENV LOCAL (optionnel)
# =============================================================================

update_local_env() {
    log_info "Mise à jour des variables d'environnement..."
    
    cat > .env.vps << EOF
# ===========================================
# CONFIGURATION VPS - OUTREMER FERMETURES
# Mis à jour le: $(date)
# ===========================================

# Supabase Self-Hosted (VPS)
VITE_SUPABASE_URL=https://outremerfermetures.com/api
SUPABASE_URL=https://outremerfermetures.com/api
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzcyNTc4ODAwLCJleHAiOjE5MzAzNDUyMDB9.JTRP_WOGEdKzb8rMaSP_FMox5AN0WD4bD_hgP6dW-PA
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3NzI1Nzg4MDAsImV4cCI6MTkzMDM0NTIwMH0.4N8utvMn8tgjgt7aOTUPDZdutp-plKd-0Gm5Pe3e7m8

# Ancienne config (conservée pour référence)
# VITE_SUPABASE_URL=https://outremerfermetures.com/api
# SUPABASE_URL=https://outremerfermetures.com/api
# VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzcyNTc4ODAwLCJleHAiOjE5MzAzNDUyMDB9.JTRP_WOGEdKzb8rMaSP_FMox5AN0WD4bD_hgP6dW-PA
# SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im15emJrYnFranlrZHNheW11anZsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDAzOTU2NywiZXhwIjoyMDc5NjE1NTY3fQ.1r1DvNXg9n9uHT3-FFFcG3t4hCowaiijqTyXt1GwtOg
EOF

    log_success "Fichier .env.vps créé avec les nouvelles clés"
    log_info "Renommez-le en .env pour l'utiliser: mv .env.vps .env"
}

# =============================================================================
# DÉPLOIEMENT DES EDGE FUNCTIONS
# =============================================================================

deploy_edge_functions() {
    if [ ! -d "supabase/functions" ] && [ ! -d "edge-functions" ]; then
        log_warning "Dossier edge-functions non trouvé - skip"
        return
    fi
    
    log_info "Déploiement des Edge Functions sur le VPS..."
    
    # Chercher le dossier des fonctions
    FUNC_DIR=""
    if [ -d "supabase/functions" ]; then
        FUNC_DIR="supabase/functions"
    elif [ -d "edge-functions" ]; then
        FUNC_DIR="edge-functions"
    fi
    
    if [ -z "$FUNC_DIR" ]; then
        log_warning "Dossier de fonctions non trouvé"
        return
    fi
    
    log_info "Fonctions trouvées dans: $FUNC_DIR"
    
    # Pour Supabase self-hosted, les fonctions sont généralement déployées via:
    # 1. API REST directement, ou
    # 2. Copie dans le dossier functions de l'installation Supabase
    
    log_info "Pour déployer les fonctions sur VPS self-hosted:"
    log_info "  1. Copier le dossier $FUNC_DIR vers /opt/supabase/functions/ (si Supabase en Docker)"
    log_info "  2. Ou utiliser l'API Edge Functions de votre installation"
    log_info "  3. Redémarrer les containers: docker compose restart"
    
    # Créer un script de déploiement
    cat > deploy-functions-vps.sh << EOF
#!/bin/bash
# Déploiement des Edge Functions sur VPS
# À adapter selon votre installation Supabase

SUPABASE_DIR="/opt/supabase"  # Modifier selon votre installation

# Copier les fonctions
if [ -d "$FUNC_DIR" ]; then
    sudo cp -r $FUNC_DIR/* \$SUPABASE_DIR/functions/ 2>/dev/null || {
        log_error "Impossible de copier les fonctions"
        log_info "Vérifiez le chemin: \$SUPABASE_DIR"
    }
fi

# Redémarrer Supabase
cd \$SUPABASE_DIR
docker compose restart functions 2>/dev/null || docker compose restart

echo "Edge Functions déployées !"
EOF

    chmod +x deploy-functions-vps.sh
    log_success "Script deploy-functions-vps.sh créé"
}

# =============================================================================
# MENU PRINCIPAL
# =============================================================================

show_menu() {
    echo ""
    echo "=========================================="
    echo "  MIGRATION VERS VPS - OUTREMER FERMETURES"
    echo "=========================================="
    echo ""
    echo "VPS: $SUPABASE_URL"
    echo ""
    echo "1. MIGRATION COMPLÈTE (Nettoyer + Importer + Vérifier)"
    echo "2. Nettoyer la base existante uniquement"
    echo "3. Importer uniquement (si déjà nettoyé)"
    echo "4. Vérifier la migration"
    echo "5. Mettre à jour le .env local"
    echo "6. Déployer Edge Functions"
    echo "7. Quitter"
    echo ""
}

# =============================================================================
# MIGRATION COMPLÈTE
# =============================================================================

full_migration() {
    log_info "🚀 DÉMARRAGE DE LA MIGRATION COMPLÈTE"
    log_info "Source: Supabase Cloud → Destination: $SUPABASE_URL"
    echo ""
    
    check_prerequisites
    clean_database
    import_database
    verify_migration
    update_local_env
    
    log_success "✅ MIGRATION TERMINÉE AVEC SUCCÈS !"
    
    echo ""
    echo "=========================================="
    echo "  📊 RÉCAPITULATIF"
    echo "=========================================="
    echo ""
    echo "✓ Base de données nettoyée et importée"
    echo "✓ $TABLE_COUNT tables migrées"
    echo "✓ Fichier .env.vps créé avec les nouvelles clés"
    echo ""
    echo "⚠️  PROCHAINES ÉTAPES:"
    echo ""
    echo "1. Vérifiez votre application fonctionne avec le VPS"
    echo "   - Mettez à jour votre .env avec .env.vps"
    echo "   - Testez la connexion"
    echo ""
    echo "2. Déployez les Edge Functions (option 6)"
    echo ""
    echo "3. Configurez les cron jobs pour les rappels:"
    echo "   https://outremerfermetures.com/api/functions/v1/mission-reminder-48h"
    echo "   https://outremerfermetures.com/api/functions/v1/provider-mission-reminder-24h"
    echo ""
    echo "📁 Logs: migration.log"
    echo "📁 Backup pré-migration: /tmp/pre-migration-backup-*.sql"
    echo ""
}

# =============================================================================
# MAIN
# =============================================================================

main() {
    # Mode auto
    if [ "$1" = "--auto" ]; then
        full_migration
        exit 0
    fi
    
    while true; do
        show_menu
        read -p "Choix (1-7): " choice
        
        case $choice in
            1) full_migration ;;
            2) check_prerequisites && clean_database ;;
            3) check_prerequisites && import_database ;;
            4) check_prerequisites && verify_migration ;;
            5) update_local_env ;;
            6) deploy_edge_functions ;;
            7) exit 0 ;;
            *) log_error "Choix invalide" ;;
        esac
        
        echo ""
        read -p "Appuyez sur Entrée pour continuer..."
    done
}

main "$@"
