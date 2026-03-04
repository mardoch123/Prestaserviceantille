#!/usr/bin/env bash
# =============================================================
# deploy.sh — Déploiement en production sur VPS
# Usage : ./deploy.sh
# =============================================================
set -euo pipefail

# ─── CONFIGURATION — à adapter à votre serveur ───────────────
VPS_USER="root"                          # utilisateur SSH sur le VPS
VPS_HOST="votre-ip-ou-domaine.com"       # IP ou nom de domaine du VPS
VPS_APP_DIR="/var/www/prestaserviceantille"  # chemin du projet sur le VPS
DEPLOY_BRANCH="main"                     # branche déployée en prod
# ─────────────────────────────────────────────────────────────

BOLD="\033[1m"
GREEN="\033[32m"
YELLOW="\033[33m"
RED="\033[31m"
RESET="\033[0m"

step() { echo -e "\n${BOLD}${YELLOW}▶ $1${RESET}"; }
ok()   { echo -e "${GREEN}✓ $1${RESET}"; }
err()  { echo -e "${RED}✗ $1${RESET}"; exit 1; }

# ── 1. Vérification locale ────────────────────────────────────
step "Vérification de l'état git local..."
if [[ -n "$(git status --porcelain)" ]]; then
  echo "Des fichiers non commités ont été détectés :"
  git status --short
  read -rp "Continuer quand même ? (o/N) " confirm
  [[ "$confirm" =~ ^[oO]$ ]] || err "Déploiement annulé."
fi

CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)

# ── 2. Merge de la branche courante dans main si nécessaire ──
if [[ "$CURRENT_BRANCH" != "$DEPLOY_BRANCH" ]]; then
  step "Merge de '$CURRENT_BRANCH' dans '$DEPLOY_BRANCH'..."
  git checkout "$DEPLOY_BRANCH"
  git merge --no-ff "$CURRENT_BRANCH" -m "Merge $CURRENT_BRANCH → $DEPLOY_BRANCH [deploy]"
  ok "Merge effectué"
fi

# ── 3. Push vers GitHub ───────────────────────────────────────
step "Push vers GitHub ($DEPLOY_BRANCH)..."
git push origin "$DEPLOY_BRANCH"
ok "Code poussé sur GitHub"

# ── 4. Déploiement sur le VPS via SSH ────────────────────────
step "Connexion au VPS et déploiement..."
ssh -o StrictHostKeyChecking=accept-new "${VPS_USER}@${VPS_HOST}" bash << REMOTE
set -euo pipefail

cd "${VPS_APP_DIR}"

echo "→ Pull du code..."
git pull origin ${DEPLOY_BRANCH}

echo "→ Installation des dépendances (si changements)..."
npm ci --prefer-offline

echo "→ Build de production..."
npm run build

echo "→ Rechargement nginx..."
nginx -t && systemctl reload nginx || true

echo ""
echo "✓ Déploiement terminé avec succès !"
REMOTE

ok "VPS mis à jour"
echo -e "\n${BOLD}${GREEN}🚀 Déploiement en production terminé !${RESET}\n"
