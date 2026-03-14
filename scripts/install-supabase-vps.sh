#!/bin/bash
# =============================================================================
# INSTALLATION SUPABASE SELF-HOSTED SUR VPS
# =============================================================================
# Ce script installe Supabase (PostgreSQL + Supabase Stack) sur votre VPS dédié
# via Docker Compose. 
#
# Compatible: Ubuntu 20.04/22.04, Debian 11/12, CentOS 8/RHEL 8+
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
# CONFIGURATION
# =============================================================================
SUPABASE_DIR="/opt/supabase"
POSTGRES_PASSWORD=$(openssl rand -base64 32)
JWT_SECRET=$(openssl rand -base64 32)
ANON_KEY=""
SERVICE_ROLE_KEY=""

# =============================================================================
# INSTALLATION DOCKER & DOCKER COMPOSE
# =============================================================================
install_docker() {
    log_info "Installation de Docker et Docker Compose..."
    
    # Supprimer anciennes versions
    sudo apt-get remove -y docker docker-engine docker.io containerd runc 2>/dev/null || true
    
    # Installation Docker
    sudo apt-get update
    sudo apt-get install -y ca-certificates curl gnupg lsb-release
    
    sudo mkdir -p /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
    
    sudo apt-get update
    sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
    
    # Vérifier
    sudo docker --version
    sudo docker compose version
    
    # Ajouter l'utilisateur au groupe docker
    sudo usermod -aG docker $USER
    log_success "Docker installé"
    log_warning "Déconnectez-vous et reconnectez-vous pour que les changements de groupe prennent effet"
}

# =============================================================================
# TÉLÉCHARGEMENT SUPABASE
# =============================================================================
download_supabase() {
    log_info "Téléchargement de Supabase Self-Hosted..."
    
    sudo mkdir -p $SUPABASE_DIR
    cd $SUPABASE_DIR
    
    # Cloner le repo supabase
    sudo git clone https://github.com/supabase/supabase.git . 2>/dev/null || {
        log_info "Mise à jour du repo existant..."
        sudo git pull
    }
    
    # Aller dans le dossier docker
    cd docker
    
    log_success "Supabase téléchargé dans $SUPABASE_DIR"
}

# =============================================================================
# GÉNÉRATION DES CLÉS JWT
# =============================================================================
generate_keys() {
    log_info "Génération des clés JWT..."
    
    cd $SUPABASE_DIR/docker
    
    # Installer node si pas présent pour générer les tokens
    if ! command -v node &> /dev/null; then
        log_info "Installation de Node.js temporaire..."
        curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
        sudo apt-get install -y nodejs
    fi
    
    # Générer les clés
    ANON_KEY=$(sudo docker run --rm -v "$PWD:/app" -w /app node:18-alpine \
        sh -c "npm install -g jsonwebtoken && node -e 'console.log(require(\"jsonwebtoken\").sign({role: \"anon\"}, process.env.JWT_SECRET, {expiresIn: \"10y\"}))'" \
        -e JWT_SECRET="$JWT_SECRET")
    
    SERVICE_ROLE_KEY=$(sudo docker run --rm -v "$PWD:/app" -w /app node:18-alpine \
        sh -c "npm install -g jsonwebtoken && node -e 'console.log(require(\"jsonwebtoken\").sign({role: \"service_role\"}, process.env.JWT_SECRET, {expiresIn: \"10y\"}))'" \
        -e JWT_SECRET="$JWT_SECRET")
    
    log_success "Clés JWT générées"
}

# =============================================================================
# CONFIGURATION ENV
# =============================================================================
setup_env() {
    log_info "Configuration des variables d'environnement..."
    
    cd $SUPABASE_DIR/docker
    
    # Créer le fichier .env
    sudo tee .env > /dev/null <<EOF
# Supabase Configuration
POSTGRES_PASSWORD=$POSTGRES_PASSWORD
JWT_SECRET=$JWT_SECRET
ANON_KEY=$ANON_KEY
SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY

# Database
POSTGRES_HOST=db
POSTGRES_DB=postgres
POSTGRES_PORT=5432

# Auth
SITE_URL=http://localhost:3000
ADDITIONAL_REDIRECT_URLS=
JWT_EXPIRY=3600
DISABLE_SIGNUP=false
API_EXTERNAL_URL=http://localhost:8000

# Mail (configurez avec votre SMTP)
SMTP_ADMIN_EMAIL=admin@example.com
SMTP_HOST=supabase-mail
SMTP_PORT=2500
SMTP_USER=fake_mail_user
SMTP_PASS=fake_mail_password
SMTP_SENDER_NAME=fake_sender

# Storage
STORAGE_BACKEND=file
STORAGE_S3_BUCKET=supabase-storage
FILE_SIZE_LIMIT=52428800

# Edge Functions
FUNCTIONS_VERIFY_JWT=false

# Studio
STUDIO_DEFAULT_ORGANIZATION=Presta Services
STUDIO_DEFAULT_PROJECT=Default Project
STUDIO_PORT=3000
SUPABASE_PUBLIC_URL=http://localhost:8000

# Ports
KONG_HTTP_PORT=8000
KONG_HTTPS_PORT=8443
PGRST_PORT=3001
POSTGRES_PORT=5432
EOF

    # Créer le fichier docker-compose.override.yml pour les volumes persistants
    sudo tee docker-compose.override.yml > /dev/null <<EOF
version: "3.8"

services:
  db:
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./volumes/db/init:/docker-entrypoint-initdb.d
    
  storage:
    volumes:
      - storage_data:/var/lib/storage

  kong:
    volumes:
      - ./volumes/api/kong.yml:/home/kong/temp.yml:ro

volumes:
  postgres_data:
    driver: local
  storage_data:
    driver: local
EOF

    log_success "Fichier .env créé"
}

# =============================================================================
# DÉMARRAGE SUPABASE
# =============================================================================
start_supabase() {
    log_info "Démarrage de Supabase..."
    
    cd $SUPABASE_DIR/docker
    
    # Démarrer les services
    sudo docker compose up -d
    
    # Attendre que les services soient prêts
    log_info "Attente du démarrage des services (30s)..."
    sleep 30
    
    # Vérifier l'état
    sudo docker compose ps
    
    log_success "Supabase démarré !"
}

# =============================================================================
# CONFIGURATION FIREWALL
# =============================================================================
setup_firewall() {
    log_info "Configuration du pare-feu..."
    
    # Ouvrir les ports nécessaires
    sudo ufw allow 8000/tcp  # Kong (API Gateway)
    sudo ufw allow 3000/tcp  # Studio (Dashboard)
    sudo ufw allow 5432/tcp  # PostgreSQL
    sudo ufw allow 8443/tcp  # Kong HTTPS
    
    log_success "Pare-feu configuré"
}

# =============================================================================
# CRÉATION SERVICE SYSTEMD
# =============================================================================
create_service() {
    log_info "Création du service systemd..."
    
    sudo tee /etc/systemd/system/supabase.service > /dev/null <<EOF
[Unit]
Description=Supabase Self-Hosted
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=$SUPABASE_DIR/docker
ExecStart=/usr/bin/docker compose up -d
ExecStop=/usr/bin/docker compose down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
EOF

    sudo systemctl daemon-reload
    sudo systemctl enable supabase.service
    
    log_success "Service systemd créé"
}

# =============================================================================
# INFORMATIONS FINALES
# =============================================================================
show_info() {
    IP_ADDRESS=$(hostname -I | awk '{print $1}')
    
    echo ""
    echo "=========================================="
    echo "  ✅ SUPABASE INSTALLÉ AVEC SUCCÈS !"
    echo "=========================================="
    echo ""
    echo "📍 Accès:"
    echo "   - Studio (Dashboard): http://$IP_ADDRESS:3000"
    echo "   - API: http://$IP_ADDRESS:8000"
    echo "   - PostgreSQL: postgres://postgres:$POSTGRES_PASSWORD@$IP_ADDRESS:5432/postgres"
    echo ""
    echo "🔑 Clés:"
    echo "   - ANON_KEY: ${ANON_KEY:0:50}..."
    echo "   - SERVICE_ROLE_KEY: ${SERVICE_ROLE_KEY:0:50}..."
    echo ""
    echo "📁 Fichiers:"
    echo "   - Installation: $SUPABASE_DIR"
    echo "   - Config: $SUPABASE_DIR/docker/.env"
    echo ""
    echo "⚙️  Commandes:"
    echo "   - Démarrer: sudo docker compose -f $SUPABASE_DIR/docker/docker-compose.yml up -d"
    echo "   - Arrêter: sudo docker compose -f $SUPABASE_DIR/docker/docker-compose.yml down"
    echo "   - Logs: sudo docker compose -f $SUPABASE_DIR/docker/docker-compose.yml logs -f"
    echo "   - Service: sudo systemctl start|stop|restart supabase"
    echo ""
    echo "⚠️  IMPORTANT:"
    echo "   1. Sauvegardez immédiatement le fichier .env !"
    echo "   2. Modifiez SITE_URL dans .env avec votre vraie URL"
    echo "   3. Configurez un SMTP réel pour les emails"
    echo "   4. Activez HTTPS avec un reverse proxy (Nginx + Certbot)"
    echo ""
    echo "🔒 Sauvegarde des identifiants dans: $SUPABASE_DIR/credentials.txt"
    
    # Sauvegarder les credentials
    sudo tee $SUPABASE_DIR/credentials.txt > /dev/null <<EOF
SUPABASE INSTALLATION CREDENTIALS
Generated: $(date)
==================================

POSTGRES_PASSWORD: $POSTGRES_PASSWORD
JWT_SECRET: $JWT_SECRET
ANON_KEY: $ANON_KEY
SERVICE_ROLE_KEY: $SERVICE_ROLE_KEY

URL: http://$IP_ADDRESS:3000
PostgreSQL: postgres://postgres:$POSTGRES_PASSWORD@$IP_ADDRESS:5432/postgres
EOF
    
    sudo chmod 600 $SUPABASE_DIR/credentials.txt
}

# =============================================================================
# MENU
# =============================================================================
show_menu() {
    echo ""
    echo "=========================================="
    echo "  INSTALLATEUR SUPABASE VPS"
    echo "=========================================="
    echo ""
    echo "1. Installation complète (Automatique)"
    echo "2. Installer Docker uniquement"
    echo "3. Télécharger Supabase uniquement"
    echo "4. Démarrer Supabase (si déjà installé)"
    echo "5. Afficher les identifiants"
    echo "6. Quitter"
    echo ""
}

# =============================================================================
# INSTALLATION COMPLÈTE
# =============================================================================
full_install() {
    log_info "🚀 DÉMARRAGE DE L'INSTALLATION COMPLÈTE"
    
    # Vérifier OS
    if ! grep -qiE "(ubuntu|debian)" /etc/os-release; then
        log_warning "OS non testé officiellement. Continuer quand même ? (oui/non)"
        read response
        if [ "$response" != "oui" ]; then
            exit 1
        fi
    fi
    
    install_docker
    download_supabase
    generate_keys
    setup_env
    setup_firewall
    start_supabase
    create_service
    show_info
    
    log_success "Installation terminée !"
}

# =============================================================================
# MAIN
# =============================================================================
main() {
    if [ "$1" = "auto" ]; then
        full_install
        exit 0
    fi
    
    while true; do
        show_menu
        read -p "Choix (1-6): " choice
        
        case $choice in
            1) full_install ;;
            2) install_docker ;;
            3) download_supabase && log_success "Téléchargement OK" ;;
            4) 
                if [ -d "$SUPABASE_DIR/docker" ]; then
                    cd $SUPABASE_DIR/docker && sudo docker compose up -d
                    log_success "Supabase démarré"
                else
                    log_error "Supabase n'est pas installé (option 1 d'abord)"
                fi
                ;;
            5) 
                if [ -f "$SUPABASE_DIR/credentials.txt" ]; then
                    sudo cat $SUPABASE_DIR/credentials.txt
                else
                    log_error "Fichier credentials non trouvé"
                fi
                ;;
            6) exit 0 ;;
            *) log_error "Choix invalide" ;;
        esac
        
        echo ""
        read -p "Appuyez sur Entrée..."
    done
}

main "$@"
