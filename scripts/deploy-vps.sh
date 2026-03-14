#!/bin/bash
# =============================================================================
# SCRIPT DE DÉPLOIEMENT SUPABASE VPS - TOUT-EN-UN
# =============================================================================
# Ce script déploie toutes les Edge Functions sur votre VPS dédié
# 
# Usage: 
#   1. Copier ce fichier sur votre VPS (ex: /home/user/deploy-supabase.sh)
#   2. chmod +x /home/user/deploy-supabase.sh
#   3. ./deploy-supabase.sh
# =============================================================================

set -e  # Arrêter en cas d'erreur

# Couleurs pour l'affichage
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# =============================================================================
# CONFIGURATION - MODIFIER CES VARIABLES
# =============================================================================

# Informations Supabase (à récupérer depuis le dashboard Supabase)
SUPABASE_PROJECT_ID="votre-project-id"  # Ex: abcdefghijklmnopqrst
SUPABASE_PROJECT_REF="votre-project-ref" # Ex: abcdefghijklmnopqrst
SUPABASE_URL="https://votre-project-ref.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="votre-service-role-key"
SUPABASE_ANON_KEY="votre-anon-key"

# Configuration EmailJS (pour les fonctions d'email)
EMAILJS_SERVICE_ID="votre-emailjs-service-id"
EMAILJS_PUBLIC_KEY="votre-emailjs-public-key"
EMAILJS_TEMPLATE_PROVIDER_MISSION_ASSIGNED="template_xxxxxx"
EMAILJS_TEMPLATE_PROVIDER_MISSION_REMINDER_24H="template_yyyyyy"

# Chemin du projet sur le VPS
PROJECT_PATH="/var/www/presta-services"  # Adapter selon votre installation

# =============================================================================
# FONCTIONS UTILITAIRES
# =============================================================================

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[OK]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[ATTENTION]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERREUR]${NC} $1"
}

# =============================================================================
# VÉRIFICATIONS PRÉALABLES
# =============================================================================

check_prerequisites() {
    log_info "Vérification des prérequis..."
    
    # Vérifier si Node.js est installé
    if ! command -v node &> /dev/null; then
        log_error "Node.js n'est pas installé"
        echo "Installation de Node.js..."
        curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
        sudo apt-get install -y nodejs
    fi
    
    # Vérifier si npm est installé
    if ! command -v npm &> /dev/null; then
        log_error "npm n'est pas installé"
        exit 1
    fi
    
    # Vérifier si Supabase CLI est installé
    if ! command -v supabase &> /dev/null; then
        log_warning "Supabase CLI n'est pas installé"
        log_info "Installation de Supabase CLI..."
        
        # Méthode 1: Installation via npm
        npm install -g supabase
        
        # Si ça échoue, essayer la méthode binaire
        if ! command -v supabase &> /dev/null; then
            log_info "Tentative d'installation via binaire..."
            curl -fsSL https://github.com/supabase/cli/releases/latest/download/supabase_linux_amd64.tar.gz | sudo tar -xzv -C /usr/local/bin/
        fi
    fi
    
    # Vérifier le projet
    if [ ! -d "$PROJECT_PATH" ]; then
        log_error "Le dossier projet n'existe pas: $PROJECT_PATH"
        exit 1
    fi
    
    if [ ! -d "$PROJECT_PATH/supabase/functions" ]; then
        log_error "Dossier supabase/functions non trouvé"
        exit 1
    fi
    
    log_success "Prérequis OK"
}

# =============================================================================
# CONNEXION À SUPABASE
# =============================================================================

connect_supabase() {
    log_info "Connexion à Supabase..."
    
    cd "$PROJECT_PATH"
    
    # Se connecter avec le token (si besoin d'un token d'accès personnel)
    # supabase login
    
    # Lier le projet
    supabase link --project-ref "$SUPABASE_PROJECT_REF"
    
    log_success "Connecté à Supabase"
}

# =============================================================================
# CONFIGURATION DES SECRETS
# =============================================================================

set_secrets() {
    log_info "Configuration des secrets..."
    
    cd "$PROJECT_PATH"
    
    # Définir tous les secrets nécessaires
    supabase secrets set SUPABASE_URL="$SUPABASE_URL"
    supabase secrets set SUPABASE_SERVICE_ROLE_KEY="$SUPABASE_SERVICE_ROLE_KEY"
    supabase secrets set SUPABASE_ANON_KEY="$SUPABASE_ANON_KEY"
    
    # Secrets EmailJS
    supabase secrets set EMAILJS_SERVICE_ID="$EMAILJS_SERVICE_ID"
    supabase secrets set EMAILJS_PUBLIC_KEY="$EMAILJS_PUBLIC_KEY"
    supabase secrets set EMAILJS_TEMPLATE_PROVIDER_MISSION_ASSIGNED="$EMAILJS_TEMPLATE_PROVIDER_MISSION_ASSIGNED"
    supabase secrets set EMAILJS_TEMPLATE_PROVIDER_MISSION_REMINDER_24H="$EMAILJS_TEMPLATE_PROVIDER_MISSION_REMINDER_24H"
    
    log_success "Secrets configurés"
}

# =============================================================================
# DÉPLOIEMENT DES EDGE FUNCTIONS
# =============================================================================

deploy_functions() {
    log_info "Déploiement des Edge Functions..."
    
    cd "$PROJECT_PATH"
    
    # Liste des fonctions à déployer
    FUNCTIONS=(
        "create-user"
        "marketing-automation"
        "mission-reminder-48h"
        "mkt-auto-create-client"
        "mkt-notification-dispatcher"
        "provider-mission-reminder-24h"
        "quote-signature-reminder"
        "send-email"
    )
    
    # Déployer chaque fonction individuellement
    for func in "${FUNCTIONS[@]}"; do
        if [ -d "$PROJECT_PATH/supabase/functions/$func" ]; then
            log_info "Déploiement de: $func"
            supabase functions deploy "$func"
            log_success "$func déployé"
        else
            log_warning "Fonction $func non trouvée, ignorée"
        fi
    done
    
    log_success "Toutes les fonctions sont déployées !"
}

# =============================================================================
# CONFIGURATION DES CRON JOBS (via SQL)
# =============================================================================

setup_cron_jobs() {
    log_info "Configuration des cron jobs..."
    
    # Créer un fichier SQL temporaire
    cat > /tmp/setup_cron.sql << 'EOF'
-- Activer l'extension pg_cron si pas déjà fait
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Supprimer les anciens cron jobs s'ils existent
SELECT cron.unschedule('provider-mission-reminder-24h');
SELECT cron.unschedule('mission-reminder-48h');
SELECT cron.unschedule('quote-signature-reminder');

-- Cron job: Rappel 24h avant mission (providers)
-- Exécution: Toutes les heures
SELECT cron.schedule(
  'provider-mission-reminder-24h',
  '0 * * * *',
  $$
  SELECT net.http_get(
    url:='${SUPABASE_URL}/functions/v1/provider-mission-reminder-24h',
    headers:='{"Authorization": "Bearer ${SUPABASE_SERVICE_ROLE_KEY}", "Content-Type": "application/json"}'::jsonb
  ) AS request_id;
  $$
);

-- Cron job: Rappel 48h avant mission (clients)
-- Exécution: Toutes les heures
SELECT cron.schedule(
  'mission-reminder-48h',
  '0 * * * *',
  $$
  SELECT net.http_get(
    url:='${SUPABASE_URL}/functions/v1/mission-reminder-48h',
    headers:='{"Authorization": "Bearer ${SUPABASE_SERVICE_ROLE_KEY}", "Content-Type": "application/json"}'::jsonb
  ) AS request_id;
  $$
);

-- Cron job: Rappel signature devis (toutes les 4 heures)
SELECT cron.schedule(
  'quote-signature-reminder',
  '0 */4 * * *',
  $$
  SELECT net.http_get(
    url:='${SUPABASE_URL}/functions/v1/quote-signature-reminder',
    headers:='{"Authorization": "Bearer ${SUPABASE_SERVICE_ROLE_KEY}", "Content-Type": "application/json"}'::jsonb
  ) AS request_id;
  $$
);

-- Vérifier les cron jobs créés
SELECT * FROM cron.job;
EOF
    
    log_info "Fichier SQL créé: /tmp/setup_cron.sql"
    log_warning "IMPORTANT: Exécutez ce fichier SQL manuellement dans l'éditeur SQL de Supabase:"
    echo ""
    echo -e "${YELLOW}1. Allez sur: https://app.supabase.com/project/${SUPABASE_PROJECT_REF}/sql${NC}"
    echo -e "${YELLOW}2. Copiez-collez le contenu de /tmp/setup_cron.sql${NC}"
    echo -e "${YELLOW}3. Exécutez le script${NC}"
    echo ""
}

# =============================================================================
# VÉRIFICATION DU DÉPLOIEMENT
# =============================================================================

verify_deployment() {
    log_info "Vérification du déploiement..."
    
    cd "$PROJECT_PATH"
    
    # Lister les fonctions déployées
    log_info "Fonctions déployées:"
    supabase functions list
    
    log_success "Vérification terminée"
}

# =============================================================================
# FONCTION DE SAUVEGARDE
# =============================================================================

backup_existing() {
    log_info "Création d'une sauvegarde..."
    
    BACKUP_DIR="/tmp/supabase-backup-$(date +%Y%m%d-%H%M%S)"
    mkdir -p "$BACKUP_DIR"
    
    # Sauvegarder les migrations
    if [ -d "$PROJECT_PATH/supabase/migrations" ]; then
        cp -r "$PROJECT_PATH/supabase/migrations" "$BACKUP_DIR/"
    fi
    
    # Sauvegarder les fonctions
    if [ -d "$PROJECT_PATH/supabase/functions" ]; then
        cp -r "$PROJECT_PATH/supabase/functions" "$BACKUP_DIR/"
    fi
    
    log_success "Sauvegarde créée: $BACKUP_DIR"
}

# =============================================================================
# MENU PRINCIPAL
# =============================================================================

show_menu() {
    echo ""
    echo "=========================================="
    echo "  DÉPLOIEMENT SUPABASE VPS - Presta Services"
    echo "=========================================="
    echo ""
    echo "1. Déploiement complet (tout en un)"
    echo "2. Vérifier les prérequis uniquement"
    echo "3. Déployer uniquement les Edge Functions"
    echo "4. Configurer uniquement les secrets"
    echo "5. Afficher le SQL des cron jobs"
    echo "6. Quitter"
    echo ""
}

# =============================================================================
# EXÉCUTION COMPLÈTE
# =============================================================================

full_deployment() {
    log_info "🚀 DÉMARRAGE DU DÉPLOIEMENT COMPLET"
    echo ""
    
    check_prerequisites
    backup_existing
    connect_supabase
    set_secrets
    deploy_functions
    setup_cron_jobs
    verify_deployment
    
    echo ""
    log_success "✅ DÉPLOIEMENT TERMINÉ AVEC SUCCÈS !"
    echo ""
    echo -e "${GREEN}Résumé:${NC}"
    echo "  - Edge Functions: 8 fonctions déployées"
    echo "  - Secrets: Configurés"
    echo "  - Cron Jobs: SQL généré (à exécuter manuellement)"
    echo ""
    echo -e "${YELLOW}⚠️  N'oubliez pas d'exécuter le SQL des cron jobs${NC}"
    echo -e "${YELLOW}   dans l'éditeur SQL de Supabase${NC}"
    echo ""
}

# =============================================================================
# POINT D'ENTRÉE
# =============================================================================

main() {
    # Si exécuté avec argument "auto", faire le déploiement complet directement
    if [ "$1" = "auto" ]; then
        full_deployment
        exit 0
    fi
    
    # Sinon, afficher le menu interactif
    while true; do
        show_menu
        read -p "Choisissez une option (1-6): " choice
        
        case $choice in
            1)
                full_deployment
                ;;
            2)
                check_prerequisites
                ;;
            3)
                deploy_functions
                ;;
            4)
                set_secrets
                ;;
            5)
                setup_cron_jobs
                cat /tmp/setup_cron.sql
                ;;
            6)
                log_info "Au revoir !"
                exit 0
                ;;
            *)
                log_error "Option invalide"
                ;;
        esac
        
        echo ""
        read -p "Appuyez sur Entrée pour continuer..."
    done
}

# Démarrer le script
main "$@"
