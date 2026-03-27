/**
 * Script de gestion de version pour l'application
 * Incrémente automatiquement le numéro de build et la version
 * À exécuter avant chaque build: node scripts/bump-version.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const versionFilePath = path.join(__dirname, '../public/version.json');

function bumpVersion() {
    try {
        // Lire le fichier version actuel
        const versionData = JSON.parse(fs.readFileSync(versionFilePath, 'utf8'));
        
        // Incrémenter le numéro de build
        versionData.buildNumber = (versionData.buildNumber || 0) + 1;
        
        // Mettre à jour la date de build
        versionData.buildDate = new Date().toISOString();
        
        // Formater la version: MAJOR.MINOR.BUILD
        const currentVersion = versionData.version || '1.0.0';
        const versionParts = currentVersion.split('.');
        
        // Si c'est la première exécution ou version standard, garder 1.0.x
        // Sinon incrémenter le patch automatiquement tous les 10 builds
        if (versionParts.length === 3) {
            const major = versionParts[0];
            const minor = versionParts[1];
            const buildNum = versionData.buildNumber;
            
            // Format: 1.0.1, 1.0.2, etc.
            versionData.version = `${major}.${minor}.${buildNum}`;
        }
        
        // Écrire le nouveau fichier
        fs.writeFileSync(versionFilePath, JSON.stringify(versionData, null, 2));
        
        console.log(`✅ Version incrémentée: ${versionData.version} (build #${versionData.buildNumber})`);
        console.log(`📅 Build date: ${versionData.buildDate}`);
        
        return versionData;
    } catch (error) {
        console.error('❌ Erreur lors de l\'incrémentation de la version:', error);
        process.exit(1);
    }
}

// Exécuter si appelé directement
bumpVersion();
