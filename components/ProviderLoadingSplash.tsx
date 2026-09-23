import React, { useEffect, useState } from 'react';
import { Briefcase, Calendar, CheckCircle, Sparkles } from 'lucide-react';

interface ProviderLoadingSplashProps {
  /** Prénom du prestataire, affiché dans le message d'accueil si disponible */
  providerName?: string;
}

// Messages ludiques qui défilent pendant le chargement
const LOADING_MESSAGES = [
  'On rassemble vos missions…',
  'On vérifie chaque créneau…',
  'On prépare votre planning…',
  'Un instant, on finalise…',
  'Presque prêt, on peaufine…',
];

// Icônes qui se succèdent dans la pastille du loader
const CYCLING_ICONS = [Calendar, Briefcase, CheckCircle, Sparkles];

/**
 * Loader d'accueil de l'espace prestataire.
 * Affiche un squelette de dashboard en fond (derrière) et une carte
 * glassmorphism animée au premier plan. Purement visuel : n'impacte
 * aucune logique de données.
 */
const ProviderLoadingSplash: React.FC<ProviderLoadingSplashProps> = ({ providerName }) => {
  const [messageIndex, setMessageIndex] = useState(0);
  const [iconIndex, setIconIndex] = useState(0);

  useEffect(() => {
    const messageInterval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % LOADING_MESSAGES.length);
    }, 2400);
    const iconInterval = setInterval(() => {
      setIconIndex((prev) => (prev + 1) % CYCLING_ICONS.length);
    }, 1200);
    return () => {
      clearInterval(messageInterval);
      clearInterval(iconInterval);
    };
  }, []);

  const CurrentIcon = CYCLING_ICONS[iconIndex];

  return (
    <div className="relative h-full w-full overflow-hidden bg-gradient-to-br from-[#f0fdf4] to-[#ecfdf5]">
      {/* Blobs décoratifs en arrière-plan */}
      <div className="pointer-events-none absolute -top-24 -left-24 w-72 h-72 bg-emerald-200/50 rounded-full blur-3xl animate-blob" />
      <div className="pointer-events-none absolute top-1/3 -right-28 w-80 h-80 bg-teal-200/40 rounded-full blur-3xl animate-blob animation-delay-2000" />
      <div className="pointer-events-none absolute -bottom-24 left-1/4 w-72 h-72 bg-amber-100/50 rounded-full blur-3xl animate-blob animation-delay-4000" />

      {/* Squelette du dashboard visible derrière le loader */}
      <div className="absolute inset-0 p-4 md:p-8 opacity-50" aria-hidden="true">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Faux en-tête de bienvenue */}
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <div className="shimmer-skeleton h-6 w-52 rounded-lg" />
              <div className="shimmer-skeleton h-4 w-72 rounded-lg" />
            </div>
            <div className="shimmer-skeleton h-10 w-48 rounded-xl hidden md:block" />
          </div>
          {/* Fausses cartes de statistiques */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="shimmer-skeleton h-20 rounded-2xl" />
            ))}
          </div>
          {/* Fausses cartes de missions */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="shimmer-skeleton h-32 rounded-2xl" />
            ))}
          </div>
          {/* Faux tableau de missions */}
          <div className="shimmer-skeleton h-64 rounded-2xl hidden md:block" />
        </div>
      </div>

      {/* Voile translucide + carte du loader au premier plan */}
      <div className="absolute inset-0 flex items-center justify-center bg-white/25 backdrop-blur-[2px]">
        <div className="w-full max-w-sm mx-6 bg-white/85 backdrop-blur-xl border border-white/70 rounded-3xl shadow-2xl shadow-emerald-100 p-8 text-center">
          {/* Pastille d'icône flottante avec halo pulsant */}
          <div className="relative inline-flex mb-5">
            <span className="absolute inset-0 rounded-2xl bg-emerald-400/30 animate-ping" />
            <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-200 animate-float">
              <CurrentIcon key={iconIndex} className="w-9 h-9 text-white animate-scale-in" />
            </div>
          </div>

          {/* Titre d'accueil */}
          <h2 className="text-lg font-extrabold text-gray-800">
            {providerName ? `Bonjour ${providerName},` : 'Espace Prestataire'}
          </h2>
          <p className="text-sm text-gray-500 mt-1">Préparation de votre tableau de bord</p>

          {/* Message ludique qui défile (fondu à chaque changement) */}
          <p key={messageIndex} className="text-sm font-bold text-emerald-700 mt-5 animate-fade-in min-h-[20px]">
            {LOADING_MESSAGES[messageIndex]}
          </p>

          {/* Points rebondissants */}
          <div className="flex items-center justify-center gap-1.5 mt-3">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-dot-bounce" />
            <span className="w-2 h-2 rounded-full bg-teal-500 animate-dot-bounce" style={{ animationDelay: '0.15s' }} />
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-dot-bounce" style={{ animationDelay: '0.3s' }} />
          </div>

          {/* Barre de progression indéterminée */}
          <div className="mt-5 h-1.5 bg-emerald-100 rounded-full overflow-hidden">
            <div className="h-full w-1/3 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-500 rounded-full animate-progress-slide" />
          </div>

          <p className="text-[11px] text-gray-400 mt-4 font-medium">Chargement sécurisé de vos données…</p>
        </div>
      </div>
    </div>
  );
};

export default ProviderLoadingSplash;
