#!/bin/bash
# =============================================================================
# SOLUTION HYBRIDE - VPS + Supabase Cloud (IMMÉDIAT)
# =============================================================================
# Cette solution utilise:
# - Supabase CLOUD pour la base de données et l'authentification (stable)
# - VPS pour l'application frontend (outremerfermetures.com)
#
# Avantages:
# - Fonctionne IMMÉDIATEMENT
# - Pas de maintenance PostgreSQL/Supabase sur le VPS
# - Auth cloud stable et sécurisée
# - Edge Functions disponibles
# - Gardez votre VPS pour le frontend
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

echo ""
echo "=========================================="
echo "  SOLUTION HYBRIDE - Déploiement Rapide"
echo "=========================================="
echo ""

# =============================================================================
# CONFIGURATION - À PERSONNALISER
# =============================================================================

# Supabase Cloud (votre ancien projet cloud)
SUPABASE_CLOUD_URL="https://myzebkqnjyekdsaymujvl.supabase.co"
SUPABASE_CLOUD_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im15emJrYnFranlrZHNheW11anZsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQwMzk1NjcsImV4cCI6MjA3OTYxNTU2N30.C2Zpq2JkVre1E_ywC8PjFlKMfeGv9qHa7JK3DmoJLzM"
SUPABASE_CLOUD_SERVICE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im15emJrYnFranlrZHNheW11anZsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDAzOTU2NywiZXhwIjoyMDc5NjE1NTY3fQ.1r1DvNXg9n9uHT3-FFFcG3t4hCowaiijqTyXt1GwtOg"

# VPS
VPS_DOMAIN="outremerfermetures.com"
VPS_USER="root"  # ou votre utilisateur
VPS_PATH="/var/www/outremerfermetures"

echo "🔧 Configuration:"
echo "   Supabase Cloud: $SUPABASE_CLOUD_URL"
echo "   VPS Domain: $VPS_DOMAIN"
echo ""

# =============================================================================
# ÉTAPE 1: Vérifier la connexion Supabase Cloud
# =============================================================================
echo ""
log_info "Étape 1: Vérification de Supabase Cloud..."

if curl -s -o /dev/null -w "%{http_code}" "$SUPABASE_CLOUD_URL/rest/v1/" | grep -q "200\|401"; then
    log_success "Supabase Cloud est accessible !"
else
    log_error "Supabase Cloud ne répond pas"
    exit 1
fi

# =============================================================================
# ÉTAPE 2: Générer le fichier .env.production
# =============================================================================
echo ""
log_info "Étape 2: Génération du fichier .env.production..."

cat > .env.production <<EOF
# =============================================
# PRODUCTION - Solution Hybride VPS + Cloud
# =============================================

# Supabase CLOUD (Base de données + Auth)
VITE_SUPABASE_URL=$SUPABASE_CLOUD_URL
VITE_SUPABASE_ANON_KEY=$SUPABASE_CLOUD_ANON_KEY
SUPABASE_URL=$SUPABASE_CLOUD_URL
SUPABASE_ANON_KEY=$SUPABASE_CLOUD_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_CLOUD_SERVICE_KEY

# EmailJS (même configuration)
VITE_EMAILJS_SERVICE_ID=service_0u67mco
VITE_EMAILJS_PUBLIC_KEY=jjYNnpHbr5djyFBlK
EMAILJS_SERVICE_ID=service_0u67mco
EMAILJS_PUBLIC_KEY=jjYNnpHbr5djyFBlK

# Edge Functions (utiliser Supabase Cloud)
SUPABASE_FUNCTIONS_URL=$SUPABASE_CLOUD_URL
SUPABASE_EDGE_FUNCTION_KEY=$SUPABASE_CLOUD_SERVICE_KEY

# API URL (VPS pour les fonctions serverless si besoin)
VITE_API_URL=https://$VPS_DOMAIN/api

# Company
VITE_COMPANY_NAME=Presta Services Antilles
EOF

log_success "Fichier .env.production créé"

# =============================================================================
# ÉTAPE 3: Build de production
# =============================================================================
echo ""
log_info "Étape 3: Build de l'application..."

# Copier le fichier env pour le build
cp .env.production .env

# Installer les dépendances si nécessaire
if [ ! -d "node_modules" ]; then
    log_info "Installation des dépendances..."
    npm install
fi

# Build
log_info "Compilation..."
npm run build

if [ -d "dist" ]; then
    log_success "Build terminé (dossier dist créé)"
else
    log_error "Le build a échoué - dossier dist non trouvé"
    exit 1
fi

# =============================================================================
# ÉTAPE 4: Déploiement sur VPS
# =============================================================================
echo ""
log_info "Étape 4: Déploiement sur VPS..."
log_info "Commandes à exécuter sur votre VPS:"
echo ""
echo "${YELLOW}# Se connecter au VPS:${NC}"
echo "ssh $VPS_USER@$VPS_DOMAIN"
echo ""
echo "${YELLOW}# Sauvegarder l'ancien build:${NC}"
echo "sudo mv $VPS_PATH/dist $VPS_PATH/dist-backup-$(date +%Y%m%d) 2>/dev/null || true"
echo ""
echo "${YELLOW}# Créer le dossier et copier les fichiers:${NC}"
echo "sudo mkdir -p $VPS_PATH"
echo "${YELLOW}# (Depuis votre machine locale, copier le dossier dist):${NC}"
echo "scp -r dist/* $VPS_USER@$VPS_DOMAIN:$VPS_PATH/"
echo ""

# =============================================================================
# ÉTAPE 5: Configuration Nginx (sans proxy Supabase)
# =============================================================================
echo ""
log_info "Étape 5: Configuration Nginx..."

cat > nginx-hybride.conf <<'EOF'
# =============================================================================
# Nginx - Configuration HYBRIDE (Frontend VPS + Supabase Cloud)
# =============================================================================
# Plus besoin de proxy Supabase - tout passe directement par Supabase Cloud
# =============================================================================

server {
    listen 80;
    listen 443 ssl http2;
    server_name outremerfermetures.com www.outremerfermetures.com;

    # Certificats SSL (Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/outremerfermetures.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/outremerfermetures.com/privkey.pem;

    root /var/www/outremerfermetures;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml;

    # Sécurité
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # API Routes (si vous avez des API serverless sur le VPS)
    location /api/ {
        # CORS headers
        add_header 'Access-Control-Allow-Origin' '*' always;
        add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, OPTIONS' always;
        add_header 'Access-Control-Allow-Headers' 'Authorization, Content-Type, apikey' always;
        
        if ($request_method = 'OPTIONS') {
            return 204;
        }
        
        try_files $uri $uri/ =404;
    }

    # Toutes les routes -> React Router
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Assets statiques
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files $uri =404;
    }
}
EOF

log_success "Configuration Nginx créée: nginx-hybride.conf"

# =============================================================================
# RÉSUMÉ
# =============================================================================
echo ""
echo "=========================================="
echo "  ✅ SOLUTION HYBRIDE PRÊTE !"
echo "=========================================="
echo ""
echo "📋 Résumé de l'architecture:"
echo ""
echo "┌─────────────────────────────────────────┐"
echo "│         UTILISATEUR                    │"
echo "│            │                            │"
echo "│            ▼                            │"
echo "│  ┌─────────────────────┐                 │"
echo "│  │ outremerfermetures │  ← VOTRE VPS    │"
echo "│  │   (Frontend)       │    (Nginx)      │"
echo "│  └─────────┬─────────┘                 │"
echo "│            │                            │"
echo "│            │ API calls                  │"
echo "│            ▼                            │"
echo "│  ┌─────────────────────┐                 │"
echo "│  │ myzebkqn...supabase │  ← CLOUD        │"
echo "│  │   (DB + Auth)       │    (Stable)     │"
echo "│  └─────────────────────┘                 │"
echo "└─────────────────────────────────────────┘"
echo ""
echo "✅ Avantages:"
echo "   • Connexions fonctionnent IMMÉDIATEMENT"
echo "   • Pas de maintenance PostgreSQL"
echo "   • Auth stable et sécurisée"
echo "   • Gardez votre VPS pour le frontend"
echo ""
echo "📝 Prochaines étapes:"
echo "   1. Vérifier que votre projet Supabase Cloud existe toujours:"
echo "      https://app.supabase.com/project/myzebkqnjyekdsaymujvl"
echo ""
echo "   2. Copier le build sur le VPS (voir commandes ci-dessus)"
echo ""
echo "   3. Remplacer la config Nginx:"
echo "      sudo cp nginx-hybride.conf /etc/nginx/sites-available/outremerfermetures"
echo "      sudo nginx -t && sudo systemctl reload nginx"
echo ""
echo "   4. Tester la connexion:"
echo "      https://outremerfermetures.com/login"
echo ""
