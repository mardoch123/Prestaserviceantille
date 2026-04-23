import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { checkAndClearCacheOnUpdate } from './utils/cacheManager';

// Vérifier et nettoyer le cache si une nouvelle version est disponible
// Cette fonction s'exécute avant le rendu de l'application
checkAndClearCacheOnUpdate().then((cleared) => {
  if (cleared) {
    console.log('[App] Cache nettoyé pour la nouvelle version');
  }
});

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);