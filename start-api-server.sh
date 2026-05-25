#!/bin/bash

# Script de démarrage du serveur API SMS pour VPS
# Usage: ./start-api-server.sh

# Se placer dans le répertoire du projet
cd "$(dirname "$0")"

# Vérifier si PM2 est installé
if ! command -v pm2 &> /dev/null; then
    echo "PM2 n'est pas installé. Installation..."
    npm install -g pm2
fi

# Arrêter l'ancienne instance si elle existe
pm2 stop api-server 2>/dev/null
pm2 delete api-server 2>/dev/null

# Démarrer le serveur avec PM2
pm2 start api-server.js --name api-server

# Sauvegarder la configuration PM2 pour redémarrage automatique
pm2 save

# Afficher le statut
pm2 status
echo ""
echo "✅ Serveur API démarré sur le port 3001"
echo "📋 Commandes utiles :"
echo "   pm2 logs api-server    - Voir les logs"
echo "   pm2 restart api-server - Redémarrer"
echo "   pm2 stop api-server    - Arrêter"
