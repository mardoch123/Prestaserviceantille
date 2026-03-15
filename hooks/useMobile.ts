import { useEffect, useState, useCallback } from 'react';

/**
 * Hook pour détecter si l'appareil est un mobile/tablette
 * et obtenir des informations sur l'appareil
 */
export function useDeviceDetect() {
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);
  const [isTouch, setIsTouch] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [platform, setPlatform] = useState<'ios' | 'android' | 'other'>('other');
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [safeAreaInsets, setSafeAreaInsets] = useState({
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  });

  useEffect(() => {
    const checkDevice = () => {
      const userAgent = navigator.userAgent.toLowerCase();
      const width = window.innerWidth;
      
      // Détection mobile/tablette
      const isMobileDevice = /iphone|ipod|android.*mobile|windows phone|blackberry|opera mini/i.test(userAgent);
      const isTabletDevice = /ipad|android(?!.*mobile)|tablet/i.test(userAgent) || (width >= 768 && width <= 1024);
      
      setIsMobile(isMobileDevice || width < 768);
      setIsTablet(isTabletDevice && !isMobileDevice);
      setIsTouch('ontouchstart' in window || navigator.maxTouchPoints > 0);
      
      // Détection plateforme
      if (/iphone|ipad|ipod/.test(userAgent)) {
        setPlatform('ios');
      } else if (/android/.test(userAgent)) {
        setPlatform('android');
      }
      
      // Mode standalone (PWA installée)
      setIsStandalone(
        window.matchMedia('(display-mode: standalone)').matches || 
        (window.navigator as any).standalone === true
      );
      
      // Orientation
      setOrientation(window.innerWidth > window.innerHeight ? 'landscape' : 'portrait');
      
      // Safe area insets (pour iPhone X+ et Android avec notch)
      const styles = getComputedStyle(document.documentElement);
      setSafeAreaInsets({
        top: parseInt(styles.getPropertyValue('--sat') || '0', 10) || 
             parseInt(styles.getPropertyValue('env(safe-area-inset-top)') || '0', 10),
        bottom: parseInt(styles.getPropertyValue('--sab') || '0', 10) || 
                parseInt(styles.getPropertyValue('env(safe-area-inset-bottom)') || '0', 10),
        left: parseInt(styles.getPropertyValue('--sal') || '0', 10) || 
              parseInt(styles.getPropertyValue('env(safe-area-inset-left)') || '0', 10),
        right: parseInt(styles.getPropertyValue('--sar') || '0', 10) || 
               parseInt(styles.getPropertyValue('env(safe-area-inset-right)') || '0', 10),
      });
    };

    checkDevice();
    
    window.addEventListener('resize', checkDevice);
    window.addEventListener('orientationchange', checkDevice);
    
    return () => {
      window.removeEventListener('resize', checkDevice);
      window.removeEventListener('orientationchange', checkDevice);
    };
  }, []);

  return {
    isMobile,
    isTablet,
    isTouch,
    isStandalone,
    platform,
    orientation,
    safeAreaInsets,
    isNative: isMobile && isStandalone,
  };
}

/**
 * Hook pour empêcher le zoom sur double-tap mobile
 */
export function useDisableDoubleTapZoom() {
  useEffect(() => {
    let lastTouchEnd = 0;
    
    const handleTouchEnd = (e: TouchEvent) => {
      const now = Date.now();
      if (now - lastTouchEnd <= 300) {
        e.preventDefault();
      }
      lastTouchEnd = now;
    };

    document.addEventListener('touchend', handleTouchEnd, { passive: false });
    
    return () => {
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, []);
}

/**
 * Hook pour gérer le viewport height sur mobile (correction du 100vh)
 */
export function useMobileViewport() {
  useEffect(() => {
    const setVH = () => {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--vh', `${vh}px`);
    };

    setVH();
    window.addEventListener('resize', setVH);
    window.addEventListener('orientationchange', setVH);

    return () => {
      window.removeEventListener('resize', setVH);
      window.removeEventListener('orientationchange', setVH);
    };
  }, []);
}

/**
 * Hook pour la détection du bas de page (infinite scroll)
 */
export function useScrollBottom(
  callback: () => void, 
  threshold: number = 100,
  deps: any[] = []
) {
  const [isNearBottom, setIsNearBottom] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const scrollHeight = document.documentElement.scrollHeight;
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const clientHeight = window.innerHeight;
      
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
      const nearBottom = distanceFromBottom < threshold;
      
      setIsNearBottom(nearBottom);
      
      if (nearBottom) {
        callback();
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [callback, threshold, ...deps]);

  return isNearBottom;
}

/**
 * Hook pour maintenir le focus input visible au-dessus du clavier mobile
 */
export function useKeyboardVisible() {
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const handleResize = () => {
      const visualHeight = window.visualViewport?.height || window.innerHeight;
      const windowHeight = window.innerHeight;
      const heightDiff = windowHeight - visualHeight;
      
      setIsKeyboardVisible(heightDiff > 150);
      setKeyboardHeight(heightDiff > 0 ? heightDiff : 0);
    };

    window.visualViewport?.addEventListener('resize', handleResize);
    return () => window.visualViewport?.removeEventListener('resize', handleResize);
  }, []);

  return { isKeyboardVisible, keyboardHeight };
}

export default useDeviceDetect;
