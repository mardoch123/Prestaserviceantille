/**
 * Plugin Vite pour injecter les meta tags de version dans l'HTML
 * Utilise les données de public/version.json
 */

import { Plugin } from 'vite';
import fs from 'fs';
import path from 'path';

export function versionInjectorPlugin(): Plugin {
    return {
        name: 'version-injector',
        transformIndexHtml: {
            order: 'pre',
            handler: (html: string) => {
                try {
                    // Read version from public/version.json
                    const versionPath = path.resolve(process.cwd(), 'public', 'version.json');
                    const versionData = JSON.parse(fs.readFileSync(versionPath, 'utf8'));

                    // Create meta tags
                    const metaTags = `
    <meta name="app-version" content="${versionData.version}">
    <meta name="app-build-number" content="${versionData.buildNumber}">
    <meta name="app-build-date" content="${versionData.buildDate}">
`;

                    // Insert after <head>
                    return html.replace('<head>', `<head>${metaTags}`);
                } catch (error) {
                    console.warn('[version-injector] Could not inject version meta tags:', error);
                    return html;
                }
            }
        }
    };
}
