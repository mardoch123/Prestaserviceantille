import { useState, useRef, useEffect } from 'react';

export interface PullToRefreshOptions {
    onRefresh: () => Promise<void> | void;
    threshold?: number;
    resistance?: number;
    maxDistance?: number;
}

export const usePullToRefresh = (options: PullToRefreshOptions) => {
    const {
        onRefresh,
        threshold = 80,
        resistance = 2.5,
        maxDistance = 120
    } = options;

    const [isPulling, setIsPulling] = useState(false);
    const [pullDistance, setPullDistance] = useState(0);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const startY = useRef<number | null>(null);
    const currentY = useRef<number | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleTouchStart = (e: TouchEvent) => {
            if (window.scrollY === 0) {
                startY.current = e.touches[0].clientY;
                setIsPulling(true);
            }
        };

        const handleTouchMove = (e: TouchEvent) => {
            if (!isPulling || startY.current === null) return;

            currentY.current = e.touches[0].clientY;
            const deltaY = currentY.current - startY.current;

            if (deltaY > 0) {
                e.preventDefault();
                
                // Apply resistance to make it harder to pull
                const distance = Math.min(
                    Math.pow(deltaY, resistance) / Math.pow(maxDistance, resistance - 1),
                    maxDistance
                );
                
                setPullDistance(distance);
            }
        };

        const handleTouchEnd = async () => {
            if (pullDistance >= threshold && !isRefreshing) {
                setIsRefreshing(true);
                setPullDistance(threshold);
                
                try {
                    await onRefresh();
                } catch (error) {
                    console.error('Pull to refresh failed:', error);
                } finally {
                    setIsRefreshing(false);
                    setPullDistance(0);
                }
            } else {
                setPullDistance(0);
            }
            
            setIsPulling(false);
            startY.current = null;
            currentY.current = null;
        };

        const container = containerRef.current;
        if (container) {
            container.addEventListener('touchstart', handleTouchStart, { passive: false });
            container.addEventListener('touchmove', handleTouchMove, { passive: false });
            container.addEventListener('touchend', handleTouchEnd);
        }

        return () => {
            if (container) {
                container.removeEventListener('touchstart', handleTouchStart);
                container.removeEventListener('touchmove', handleTouchMove);
                container.removeEventListener('touchend', handleTouchEnd);
            }
        };
    }, [isPulling, pullDistance, threshold, maxDistance, resistance, isRefreshing, onRefresh]);

    return {
        containerRef,
        isPulling,
        pullDistance,
        isRefreshing,
        pullProgress: Math.min(pullDistance / threshold, 1)
    };
};
