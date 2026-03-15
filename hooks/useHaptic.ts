import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

// Définit les patterns de vibration pour les appareils sans Capacitor Haptics
const VIBRATION_PATTERNS = {
  light: 10,
  medium: 25,
  heavy: 50,
  success: [50, 100, 50],
  warning: [100, 50, 100],
  error: [100, 50, 100, 50, 100],
};

export type HapticType = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error';

/**
 * Hook pour le feedback haptique (vibrations)
 * Fonctionne avec Capacitor Haptics sur mobile, fallback sur Web Vibration API
 */
export async function triggerHaptic(type: HapticType = 'light'): Promise<void> {
  try {
    // Essayer Capacitor Haptics d'abord (meilleure expérience sur iOS/Android natif)
    if (Capacitor.isNativePlatform()) {
      switch (type) {
        case 'light':
          await Haptics.impact({ style: ImpactStyle.Light });
          break;
        case 'medium':
          await Haptics.impact({ style: ImpactStyle.Medium });
          break;
        case 'heavy':
          await Haptics.impact({ style: ImpactStyle.Heavy });
          break;
        case 'success':
          await Haptics.notification({ type: NotificationType.Success });
          break;
        case 'warning':
          await Haptics.notification({ type: NotificationType.Warning });
          break;
        case 'error':
          await Haptics.notification({ type: NotificationType.Error });
          break;
      }
      return;
    }
  } catch (e) {
    // Fallback sur Web Vibration API
    console.warn('Capacitor Haptics failed, using Web Vibration API', e);
  }

  // Web Vibration API fallback
  if ('vibrate' in navigator) {
    const pattern = VIBRATION_PATTERNS[type];
    navigator.vibrate(pattern);
  }
}

/**
 * Hook React pour utiliser le haptic feedback
 */
export function useHaptic() {
  const hapticLight = () => triggerHaptic('light');
  const hapticMedium = () => triggerHaptic('medium');
  const hapticHeavy = () => triggerHaptic('heavy');
  const hapticSuccess = () => triggerHaptic('success');
  const hapticWarning = () => triggerHaptic('warning');
  const hapticError = () => triggerHaptic('error');

  // Haptic spécifique pour les interactions UI
  const hapticButtonPress = () => triggerHaptic('light');
  const hapticLongPress = () => triggerHaptic('medium');
  const hapticSelectionChange = () => triggerHaptic('light');
  const hapticToggleOn = () => triggerHaptic('light');
  const hapticToggleOff = () => triggerHaptic('light');
  const hapticScrollStop = () => triggerHaptic('light');
  const hapticRefresh = () => triggerHaptic('medium');
  const hapticCompletion = () => triggerHaptic('success');

  return {
    trigger: triggerHaptic,
    light: hapticLight,
    medium: hapticMedium,
    heavy: hapticHeavy,
    success: hapticSuccess,
    warning: hapticWarning,
    error: hapticError,
    // Aliases spécifiques UI
    buttonPress: hapticButtonPress,
    longPress: hapticLongPress,
    selectionChange: hapticSelectionChange,
    toggleOn: hapticToggleOn,
    toggleOff: hapticToggleOff,
    scrollStop: hapticScrollStop,
    refresh: hapticRefresh,
    completion: hapticCompletion,
  };
}

/**
 * Higher-order function pour ajouter du haptic feedback à un event handler
 */
export function withHaptic<T extends (...args: any[]) => any>(
  handler: T,
  type: HapticType = 'light'
): T {
  return (async (...args: Parameters<T>) => {
    await triggerHaptic(type);
    return handler(...args);
  }) as T;
}

/**
 * Haptic feedback pour les gestes de swipe
 */
export function hapticSwipeFeedback(direction: 'left' | 'right' | 'up' | 'down'): void {
  triggerHaptic('light');
}

/**
 * Haptic feedback pour la confirmation d'action
 */
export function hapticActionConfirmed(): void {
  triggerHaptic('success');
}

/**
 * Haptic feedback pour le refus/annulation
 */
export function hapticActionCancelled(): void {
  triggerHaptic('error');
}

export default useHaptic;
