# Guide des Fonctionnalités Mobile

Ce document explique comment utiliser les nouvelles fonctionnalités mobile ajoutées à l'application.

## Composants Mobile Disponibles

### 1. Bottom Navigation (`BottomNavigation`)

Navigation par onglets en bas d'écran pour mobile (style app native).

**Utilisation :**
```tsx
import { BottomNavigation } from './components/mobile/BottomNavigation';

// Dans votre composant
<BottomNavigation currentRole="client" />
```

**Rôles supportés :**
- `client` : Accueil, Services, Parrainage, Profil
- `provider` : Missions, Scan, Disponibilité
- `admin` : Dashboard, Planning, QR Scan, Clients, Plus

### 2. Toast Notifications (`ToastContainer` & `toast`)

Système de notifications flottantes avec feedback haptique.

**Utilisation :**
```tsx
import { toast } from './components/mobile/Toast';

// Afficher un toast
toast.success('Mission terminée !');
toast.error('Une erreur est survenue');
toast.warning('Attention, délai approchant');
toast.info('Nouvelle mise à jour disponible');
```

### 3. Pull To Refresh (`PullToRefresh`)

Permet de rafraîchir le contenu en tirant vers le bas (gesture native).

**Utilisation :**
```tsx
import { PullToRefresh } from './components/mobile/PullToRefresh';

<PullToRefresh onRefresh={async () => {
  await fetchNewData();
}}>
  <VotreContenu />
</PullToRefresh>
```

### 4. Swipe Gestures (`useSwipe`)

Hook pour gérer les gestes de swipe sur mobile.

**Utilisation :**
```tsx
import { useSwipe, usePageSwipe } from './hooks/useSwipe';

// Swipe simple
const swipeRef = useSwipe<HTMLDivElement>({
  onSwipeLeft: () => console.log('Swiped left!'),
  onSwipeRight: () => console.log('Swiped right!'),
  threshold: 50
});

// Navigation entre pages par swipe
const pageRef = usePageSwipe((direction) => {
  if (direction === 'next') goToNextPage();
  else goToPrevPage();
});
```

### 5. Haptic Feedback (`useHaptic`)

Feedback tactile pour les interactions.

**Utilisation :**
```tsx
import { useHaptic, triggerHaptic } from './hooks/useHaptic';

const { light, success, error, buttonPress } = useHaptic();

// Utilisation directe
<button onClick={() => {
  buttonPress();
  // votre action
}}>Cliquez ici</button>

// Ou avec async
await triggerHaptic('success');
```

### 6. Mobile Detection (`useMobile`)

Hook pour détecter les caractéristiques de l'appareil.

**Utilisation :**
```tsx
import { useDeviceDetect, useMobileViewport } from './hooks/useMobile';

const { isMobile, isTouch, platform, safeAreaInsets } = useDeviceDetect();

// Corriger le viewport sur mobile
useMobileViewport();
```

### 7. Action Sheet (`ActionSheet`)

Menu d'actions style iOS natif.

**Utilisation :**
```tsx
import { ActionSheet } from './components/mobile/MobileTransitions';

const [isOpen, setIsOpen] = useState(false);

<ActionSheet
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  title="Que souhaitez-vous faire ?"
  actions={[
    { label: 'Modifier', onClick: () => {}, icon: <Edit className="w-4 h-4" /> },
    { label: 'Supprimer', onClick: () => {}, destructive: true, icon: <Trash className="w-4 h-4" /> },
  ]}
/>
```

## Hooks et Utilitaires

### Synchronisation Mobile (`useMobileSync`)

Gère la file d'attente offline et la synchronisation avec Supabase.

```tsx
import { useMobileSync } from './services/mobileSync';

const { isOnline, pendingJobs, enqueueJob, forceSync } = useMobileSync();

// Ajouter un job à la file d'attente
await enqueueJob('mission_end', {
  missionId: '123',
  remark: 'Mission terminée',
  photos: ['url1', 'url2']
}, 1); // priorité 1 = haute
```

## Styles CSS Mobile

Les styles sont dans `@/src/styles/mobile.css`. Ils incluent :

- Animations natives (slide, fade, scale)
- Safe area pour iPhone X+
- Optimisations tactiles
- Skeleton loaders
- Page transitions

## Intégration Capacitor

### Plugins Recommandés

```bash
# Plugins déjà intégrés
npm install @capacitor/haptics
npm install @capacitor/preferences
npm install @capacitor/network
npm install @capacitor/push-notifications
npm install @capacitor/local-notifications
npm install @capacitor/status-bar
npm install @capacitor/splash-screen
npm install @capacitor/keyboard

# Sync avec le projet natif
npx cap sync
```

### Configuration Android/iOS

Le fichier `capacitor.config.ts` est déjà configuré avec :
- Splash screen
- Status bar
- Push notifications
- Keyboard behavior
- Safe areas

## Bonnes Pratiques Mobile

### 1. Touch Targets

Toujours utiliser des éléments interactifs d'au moins 44x44px :

```tsx
<button className="min-h-[44px] min-w-[44px] p-3">
  Action
</button>
```

### 2. Feedback Visuel

Toujours fournir un feedback lors des interactions :

```tsx
<div className="active:scale-95 transition-transform">
  Élément cliquable
</div>
```

### 3. Scroll Performance

Utiliser `transform` et `opacity` pour les animations :

```tsx
<div className="transform gpu-accelerated">
  Contenu animé
</div>
```

### 4. Images et Assets

Utiliser des images optimisées pour mobile :
- Format WebP quand possible
- Tailles responsives
- Lazy loading

## Migration depuis l'ancienne version

Pour migrer un composant existant vers l'expérience mobile :

1. **Ajouter le hook mobile** :
```tsx
import { useMobileViewport, useDisableDoubleTapZoom } from '@/hooks/useMobile';

function MonComposant() {
  useMobileViewport();
  useDisableDoubleTapZoom();
  // ...
}
```

2. **Remplacer la navigation** (si applicable) :
```tsx
// Avant
<Sidebar />

// Après (pour mobile)
<BottomNavigation currentRole="client" />
```

3. **Ajouter le pull-to-refresh** aux listes :
```tsx
<PullToRefresh onRefresh={reloadData}>
  <Liste />
</PullToRefresh>
```

4. **Ajouter le feedback haptique** aux boutons principaux :
```tsx
import { useHaptic } from '@/hooks/useHaptic';

const { buttonPress } = useHaptic();

<button onClick={() => {
  buttonPress();
  handleAction();
}}>
```

## Exemple Complet

```tsx
import React from 'react';
import { BottomNavigation } from '@/components/mobile/BottomNavigation';
import { PullToRefresh } from '@/components/mobile/PullToRefresh';
import { useHaptic } from '@/hooks/useHaptic';
import { useMobileViewport } from '@/hooks/useMobile';

function MonAppMobile() {
  useMobileViewport();
  const { buttonPress } = useHaptic();

  const refreshData = async () => {
    await fetch('/api/data');
  };

  return (
    <div className="h-screen flex flex-col">
      <main className="flex-1 overflow-y-auto">
        <PullToRefresh onRefresh={refreshData}>
          <Contenu />
        </PullToRefresh>
      </main>
      
      <BottomNavigation currentRole="client" />
    </div>
  );
}
```

## Commandes Utiles

```bash
# Build pour mobile
npm run build

# Sync avec Capacitor
npx cap sync

# Ouvrir Android Studio
npx cap open android

# Ouvrir Xcode
npx cap open ios

# Live reload en dev
npx cap run android --livereload
n```

## Support et Dépannage

### Problèmes Courants

1. **Safe area pas prise en compte** :
   - Vérifier que `viewport-fit=cover` est dans le meta viewport
   - Utiliser les classes `safe-area-*` du CSS mobile

2. **Haptic feedback ne fonctionne pas** :
   - Sur web, nécessite une interaction utilisateur
   - Sur natif, vérifier que le plugin Haptics est installé

3. **Pull to refresh trop sensible** :
   - Augmenter la valeur `threshold` dans les props

4. **Bottom navigation masque du contenu** :
   - Ajouter `pb-20` (padding bottom) au contenu principal
   - Utiliser `safe-area-bottom` pour iPhone X+

## Ressources

- [Capacitor Docs](https://capacitorjs.com/docs)
- [iOS Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines)
- [Material Design for Mobile](https://material.io/design/platform-guidance/android-settings.html)
