import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { triggerHaptic } from '../../hooks/useHaptic';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
  className?: string;
  threshold?: number;
  maxPull?: number;
  indicatorHeight?: number;
}

export const PullToRefresh: React.FC<PullToRefreshProps> = ({
  onRefresh,
  children,
  className = '',
  threshold = 80,
  maxPull = 120,
  indicatorHeight = 60,
}) => {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const currentY = useRef(0);
  const scrollTop = useRef(0);

  // Vérifier si on est en haut de la page
  const isAtTop = useCallback(() => {
    if (!containerRef.current) return false;
    return containerRef.current.scrollTop <= 0;
  }, []);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (!isAtTop() || isRefreshing) return;
    
    startY.current = e.touches[0].clientY;
    scrollTop.current = containerRef.current?.scrollTop || 0;
    setIsDragging(true);
  }, [isAtTop, isRefreshing]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isDragging || !isAtTop() || isRefreshing) return;

    currentY.current = e.touches[0].clientY;
    const deltaY = currentY.current - startY.current;

    // Seulement permettre le pull vers le bas
    if (deltaY > 0) {
      e.preventDefault();
      
      // Effet de résistance (plus on tire, plus c'est difficile)
      const resistance = 0.4;
      const pulled = Math.min(deltaY * resistance, maxPull);
      
      setPullDistance(pulled);
      
      // Haptic feedback quand on atteint le seuil
      if (pulled >= threshold && pullDistance < threshold) {
        triggerHaptic('light');
      }
    }
  }, [isDragging, isAtTop, isRefreshing, maxPull, threshold, pullDistance]);

  const handleTouchEnd = useCallback(async () => {
    if (!isDragging) return;
    
    setIsDragging(false);

    if (pullDistance >= threshold && !isRefreshing) {
      // Lancer le refresh
      setIsRefreshing(true);
      setPullDistance(indicatorHeight);
      
      triggerHaptic('medium');
      
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
        setPullDistance(0);
      }
    } else {
      // Retour à la position initiale
      setPullDistance(0);
    }
  }, [isDragging, pullDistance, threshold, isRefreshing, onRefresh, indicatorHeight]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  // Calculer la progression pour l'animation
  const progress = Math.min(pullDistance / threshold, 1);
  const rotation = progress * 360;
  const opacity = Math.min(progress * 1.5, 1);

  return (
    <div 
      ref={containerRef}
      className={`relative overflow-y-auto ${className}`}
      style={{ WebkitOverflowScrolling: 'touch' }}
    >
      {/* Indicateur de pull */}
      <div
        className="absolute top-0 left-0 right-0 flex items-center justify-center z-10 pointer-events-none"
        style={{
          height: `${indicatorHeight}px`,
          transform: `translateY(${pullDistance - indicatorHeight}px)`,
          opacity,
          transition: isDragging ? 'none' : 'transform 0.3s ease-out, opacity 0.3s ease-out',
        }}
      >
        <div className="flex flex-col items-center justify-center">
          {isRefreshing ? (
            <Loader2 className="w-6 h-6 text-brand-blue animate-spin" />
          ) : (
            <>
              <div 
                className="w-8 h-8 rounded-full border-2 border-slate-300 border-t-brand-blue transition-transform"
                style={{ 
                  transform: `rotate(${rotation}deg)`,
                  borderTopColor: progress >= 1 ? '#3b82f6' : '#cbd5e1',
                }}
              />
              <span className="text-xs text-slate-500 mt-1">
                {progress >= 1 ? 'Relâchez pour rafraîchir' : 'Tirez pour rafraîchir'}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Contenu avec offset */}
      <div
        style={{
          transform: `translateY(${isRefreshing ? indicatorHeight : pullDistance}px)`,
          transition: isDragging ? 'none' : 'transform 0.3s ease-out',
        }}
      >
        {children}
      </div>
    </div>
  );
};

export default PullToRefresh;
