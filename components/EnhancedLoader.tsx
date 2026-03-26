import React, { useState, useEffect } from 'react';
import { Loader2, FileText, Users, Search, Database, CheckCircle } from 'lucide-react';

interface EnhancedLoaderProps {
  /** Type de données en cours de chargement */
  type: 'documents' | 'clients' | 'missions' | 'providers' | 'generic';
  /** Message personnalisé optionnel */
  customMessage?: string;
}

const loadingMessages = {
  documents: [
    { icon: Database, text: 'Connexion à la base de données...' },
    { icon: Search, text: 'Recherche des devis et factures...' },
    { icon: FileText, text: 'Chargement des documents...' },
    { icon: CheckCircle, text: 'Préparation de l\'affichage...' },
  ],
  clients: [
    { icon: Database, text: 'Connexion à la base de données...' },
    { icon: Search, text: 'Recherche des clients...' },
    { icon: Users, text: 'Chargement des fiches clients...' },
    { icon: CheckCircle, text: 'Préparation de l\'affichage...' },
  ],
  missions: [
    { icon: Database, text: 'Connexion à la base de données...' },
    { icon: Search, text: 'Recherche des missions...' },
    { icon: CheckCircle, text: 'Préparation de l\'affichage...' },
  ],
  providers: [
    { icon: Database, text: 'Connexion à la base de données...' },
    { icon: Search, text: 'Recherche des prestataires...' },
    { icon: CheckCircle, text: 'Préparation de l\'affichage...' },
  ],
  generic: [
    { icon: Database, text: 'Connexion à la base de données...' },
    { icon: Search, text: 'Recherche des données...' },
    { icon: CheckCircle, text: 'Préparation de l\'affichage...' },
  ],
};

const typeLabels = {
  documents: 'devis et factures',
  clients: 'clients',
  missions: 'missions',
  providers: 'prestataires',
  generic: 'données',
};

/**
 * Composant de chargement amélioré avec messages de progression
 * Affiche un loader animé avec des messages qui changent pendant le chargement
 */
const EnhancedLoader: React.FC<EnhancedLoaderProps> = ({
  type = 'generic',
  customMessage,
}) => {
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);

  const messages = loadingMessages[type];
  const label = typeLabels[type];

  // Cycle through messages every 3 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentMessageIndex((prev) => (prev + 1) % messages.length);
    }, 3000);

    return () => clearInterval(interval);
  }, [messages.length]);

  // Track elapsed time for display only
  useEffect(() => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      setElapsedTime(Date.now() - startTime);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const CurrentIcon = messages[currentMessageIndex].icon;

  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[400px] gap-6 text-slate-500">
      {/* Animated Spinner */}
      <div className="relative">
        <div className="w-20 h-20 rounded-full border-4 border-slate-200 border-t-brand-blue animate-spin" />
        <div className="absolute inset-0 flex items-center justify-center">
          <CurrentIcon className="w-8 h-8 text-brand-blue animate-pulse" />
        </div>
      </div>

      {/* Progress Bar - indeterminate */}
      <div className="w-full max-w-md px-6">
        <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-brand-blue to-teal-400 animate-[shimmer_1.5s_infinite]"
            style={{ width: '50%' }}
          />
        </div>
      </div>

      {/* Message with fade animation */}
      <div className="text-center space-y-2">
        <p className="text-lg font-medium text-slate-700 animate-in fade-in duration-500">
          {customMessage || messages[currentMessageIndex].text}
        </p>
        <p className="text-sm text-slate-400">
          Veuillez patienter pendant le chargement des {label}
        </p>
        {elapsedTime > 10000 && (
          <p className="text-xs text-brand-orange animate-pulse">
            ⚡ Chargement en cours... Merci de votre patience
          </p>
        )}
      </div>

      {/* Skeleton placeholders */}
      <div className="w-full max-w-4xl px-6 mt-4">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-slate-200 rounded w-1/3 mx-auto" />
          <div className="h-12 bg-slate-200 rounded" />
          <div className="h-12 bg-slate-200 rounded" />
          <div className="h-12 bg-slate-200 rounded" />
          <div className="h-12 bg-slate-200 rounded" />
        </div>
      </div>
    </div>
  );
};

export default EnhancedLoader;
