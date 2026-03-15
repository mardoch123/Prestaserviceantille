import { useRef, useCallback, useEffect } from 'react';

interface SwipeOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  threshold?: number; // Distance minimale en px pour déclencher le swipe
  velocity?: number; // Vitesse minimale
  preventDefault?: boolean;
}

interface SwipeState {
  startX: number;
  startY: number;
  startTime: number;
}

export function useSwipe<T extends HTMLElement>(options: SwipeOptions) {
  const elementRef = useRef<T>(null);
  const swipeState = useRef<SwipeState | null>(null);
  
  const {
    onSwipeLeft,
    onSwipeRight,
    onSwipeUp,
    onSwipeDown,
    threshold = 50,
    velocity = 0.3,
    preventDefault = true
  } = options;

  const handleTouchStart = useCallback((e: TouchEvent) => {
    const touch = e.touches[0];
    swipeState.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      startTime: Date.now()
    };
  }, []);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!swipeState.current) return;
    
    if (preventDefault) {
      // Empêcher le scroll naturel si on swipe horizontalement
      const touch = e.touches[0];
      const deltaX = Math.abs(touch.clientX - swipeState.current.startX);
      const deltaY = Math.abs(touch.clientY - swipeState.current.startY);
      
      if (deltaX > deltaY && (onSwipeLeft || onSwipeRight)) {
        e.preventDefault();
      }
    }
  }, [preventDefault, onSwipeLeft, onSwipeRight]);

  const handleTouchEnd = useCallback((e: TouchEvent) => {
    if (!swipeState.current) return;

    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - swipeState.current.startX;
    const deltaY = touch.clientY - swipeState.current.startY;
    const deltaTime = Date.now() - swipeState.current.startTime;
    
    const velocityX = Math.abs(deltaX) / deltaTime;
    const velocityY = Math.abs(deltaY) / deltaTime;

    // Vérifier si le swipe est assez rapide ou assez long
    const isValidSwipe = 
      (velocityX > velocity || Math.abs(deltaX) > threshold) ||
      (velocityY > velocity || Math.abs(deltaY) > threshold);

    if (!isValidSwipe) {
      swipeState.current = null;
      return;
    }

    // Déterminer la direction
    const isHorizontal = Math.abs(deltaX) > Math.abs(deltaY);

    if (isHorizontal) {
      if (deltaX > 0 && onSwipeRight) {
        onSwipeRight();
      } else if (deltaX < 0 && onSwipeLeft) {
        onSwipeLeft();
      }
    } else {
      if (deltaY > 0 && onSwipeDown) {
        onSwipeDown();
      } else if (deltaY < 0 && onSwipeUp) {
        onSwipeUp();
      }
    }

    swipeState.current = null;
  }, [onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown, threshold, velocity]);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    element.addEventListener('touchmove', handleTouchMove, { passive: false });
    element.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  return elementRef;
}

// Hook spécifique pour le swipe entre onglets/pages
export function usePageSwipe(onChangePage: (direction: 'next' | 'prev') => void) {
  return useSwipe<HTMLDivElement>({
    onSwipeLeft: () => onChangePage('next'),
    onSwipeRight: () => onChangePage('prev'),
    threshold: 80,
    velocity: 0.4
  });
}

// Hook pour les cartes swipeables (comme Tinder)
export function useSwipeableCard<T extends HTMLElement>(
  onSwipe: (direction: 'left' | 'right') => void,
  onSwipeProgress?: (progress: number) => void
) {
  const elementRef = useRef<T>(null);
  const currentX = useRef(0);
  const isDragging = useRef(false);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    let startX = 0;
    let currentTranslate = 0;

    const handleStart = (e: TouchEvent | MouseEvent) => {
      isDragging.current = true;
      startX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      element.style.transition = 'none';
    };

    const handleMove = (e: TouchEvent | MouseEvent) => {
      if (!isDragging.current) return;
      
      const x = 'touches' in e ? e.touches[0].clientX : e.clientX;
      currentTranslate = x - startX;
      currentX.current = currentTranslate;
      
      // Rotation subtile basée sur le déplacement
      const rotation = currentTranslate * 0.05;
      element.style.transform = `translateX(${currentTranslate}px) rotate(${rotation}deg)`;
      
      // Opacité diminue quand on s'éloigne
      const opacity = 1 - Math.abs(currentTranslate) / 400;
      element.style.opacity = String(Math.max(0.5, opacity));
      
      onSwipeProgress?.(currentTranslate / 200);
    };

    const handleEnd = () => {
      if (!isDragging.current) return;
      isDragging.current = false;
      
      element.style.transition = 'transform 0.3s ease-out, opacity 0.3s ease-out';
      
      if (Math.abs(currentTranslate) > 100) {
        // Swipe confirmé
        const direction = currentTranslate > 0 ? 'right' : 'left';
        const exitX = direction === 'right' ? 500 : -500;
        element.style.transform = `translateX(${exitX}px) rotate(${exitX * 0.05}deg)`;
        element.style.opacity = '0';
        
        setTimeout(() => onSwipe(direction), 300);
      } else {
        // Retour à la position initiale
        element.style.transform = 'translateX(0) rotate(0)';
        element.style.opacity = '1';
        onSwipeProgress?.(0);
      }
    };

    // Touch events
    element.addEventListener('touchstart', handleStart, { passive: true });
    element.addEventListener('touchmove', handleMove, { passive: true });
    element.addEventListener('touchend', handleEnd);
    
    // Mouse events (pour desktop)
    element.addEventListener('mousedown', handleStart);
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleEnd);

    return () => {
      element.removeEventListener('touchstart', handleStart);
      element.removeEventListener('touchmove', handleMove);
      element.removeEventListener('touchend', handleEnd);
      element.removeEventListener('mousedown', handleStart);
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleEnd);
    };
  }, [onSwipe, onSwipeProgress]);

  return elementRef;
}

export default useSwipe;
