# 📱 Quick Reference - Fonctionnalités Mobile

## Installation rapide des plugins Capacitor

```bash
# Plugins recommandés pour l'expérience mobile
npm install @capacitor/haptics
npm install @capacitor/preferences
npm install @capacitor/network
npm install @capacitor/splash-screen
npm install @capacitor/keyboard

# Sync avec les projets natifs
npx cap sync
```

## Utilisation rapide des composants

### 1. Toast Notification
```tsx
import { toast } from './components/mobile/Toast';

toast.success('Mission terminée !');
toast.error('Erreur de connexion');
toast.warning('Attention');
toast.info('Nouvelle mise à jour');
```

### 2. Pull to Refresh
```tsx
import { PullToRefresh } from './components/mobile/PullToRefresh';

<PullToRefresh onRefresh={async () => await fetchData()}>
  <VotreListe />
</PullToRefresh>
```

### 3. Haptic Feedback
```tsx
import { useHaptic } from './hooks/useHaptic';

const { buttonPress, success, error } = useHaptic();

<button onClick={() => buttonPress()}>Cliquer</button>
```

### 4. Swipe Gestures
```tsx
import { useSwipe } from './hooks/useSwipe';

const ref = useSwipe<HTMLDivElement>({
  onSwipeLeft: () => navigate('/next'),
  onSwipeRight: () => navigate(-1),
});

<div ref={ref}>Contenu swipeable</div>
```

### 5. Détection Mobile
```tsx
import { useDeviceDetect } from './hooks/useMobile';

const { isMobile, isTouch, platform } = useDeviceDetect();

{isMobile && <BottomNavigation />}
```

### 6. Sync Offline
```tsx
import { useMobileSync } from './services/mobileSync';

const { pendingJobs, enqueueJob, forceSync } = useMobileSync();

// Ajouter un job
await enqueueJob('mission_end', { missionId: '123', photos: [] }, 1);

// Forcer la sync
await forceSync();
```

## Classes CSS utilitaires

```css
/* Safe area (iPhone X+) */
.safe-area-top
.safe-area-bottom
.safe-area-left
.safe-area-right

/* Animations */
.animate-slide-in-down
.animate-fade-in
.animate-scale-in
.animate-shake

/* Touch optimizations */
.no-tap-highlight      /* Désactive le highlight bleu */
.gpu-accelerated       /* Accélération matérielle */
.smooth-scroll         /* Scroll fluide iOS */
.no-select             /* Empêche la sélection */

/* Mobile only */
.mobile-only           /* Visible que sur mobile */
.desktop-only          /* Visible que sur desktop */
```

## Commandes Capacitor essentielles

```bash
# Build et sync
npm run build
npx cap sync

# Ouvrir IDE natif
npx cap open android
npx cap open ios

# Live reload (développement)
npx cap run android --livereload --external

# Copier sans rebuild complet
npx cap copy
```

## Structure des fichiers créés

```
components/mobile/
├── BottomNavigation.tsx    # Navigation bas mobile
├── PullToRefresh.tsx      # Pull to refresh
├── Toast.tsx              # Notifications
└── MobileTransitions.tsx  # Transitions & ActionSheet

hooks/
├── useSwipe.ts            # Gestes swipe
├── useHaptic.ts           # Feedback tactile
└── useMobile.ts           # Détection device

services/
└── mobileSync.ts          # Synchronisation offline

src/styles/
└── mobile.css             # Styles & animations

examples/
└── MobileIntegrationExample.tsx  # Exemple complet

MOBILE_GUIDE.md            # Guide détaillé
mobile-exports.ts          # Index des exports
```

## Tips performance mobile

1. **Images**: Utiliser WebP, lazy loading, tailles responsives
2. **Animations**: Privilégier `transform` et `opacity`
3. **Liste**: Virtualiser les longues listes (>50 items)
4. **Re-render**: Utiliser `React.memo` pour les items de liste
5. **Bundle**: Dynamic imports pour les routes secondaires

## Checklist avant déploiement mobile

- [ ] Tester sur iOS (Safari) et Android (Chrome)
- [ ] Vérifier le viewport meta tag
- [ ] Tester le mode offline
- [ ] Vérifier les safe areas (notch)
- [ ] Tester le keyboard (input focus)
- [ ] Vérifier les touch targets (min 44px)
- [ ] Tester les animations (reduced motion)
- [ ] Vérifier la taille du bundle (< 2MB idéal)
