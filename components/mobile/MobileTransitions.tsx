import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { triggerHaptic } from '../../hooks/useHaptic';

interface PageTransitionProps {
  children: React.ReactNode;
  direction?: 'left' | 'right' | 'up' | 'down';
  duration?: number;
}

export const MobilePageTransition: React.FC<PageTransitionProps> = ({
  children,
  direction = 'right',
  duration = 300,
}) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Small delay to trigger animation
    const timer = setTimeout(() => setIsVisible(true), 50);
    return () => clearTimeout(timer);
  }, []);

  const getTransform = () => {
    if (isVisible) return 'translateX(0) translateY(0)';
    
    switch (direction) {
      case 'left': return 'translateX(100%)';
      case 'right': return 'translateX(-100%)';
      case 'up': return 'translateY(100%)';
      case 'down': return 'translateY(-100%)';
      default: return 'translateX(-100%)';
    }
  };

  return (
    <div
      className="w-full h-full"
      style={{
        transform: getTransform(),
        opacity: isVisible ? 1 : 0,
        transition: `transform ${duration}ms cubic-bezier(0.4, 0, 0.2, 1), opacity ${duration}ms ease`,
        willChange: 'transform, opacity',
      }}
    >
      {children}
    </div>
  );
};

// Navigation context pour gérer les transitions
interface NavigationContextType {
  navigateWithTransition: (path: string, direction?: 'left' | 'right') => void;
}

export const MobileNavigationContext = React.createContext<NavigationContextType | null>(null);

export const MobileNavigationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [currentDirection, setCurrentDirection] = useState<'left' | 'right'>('right');

  const navigateWithTransition = (path: string, direction: 'left' | 'right' = 'right') => {
    // Haptic feedback
    triggerHaptic('light');
    
    // Déterminer la direction basée sur l'historique
    setCurrentDirection(direction);
    
    // Petite animation avant navigation
    setTimeout(() => {
      navigate(path);
    }, 100);
  };

  return (
    <MobileNavigationContext.Provider value={{ navigateWithTransition }}>
      {children}
    </MobileNavigationContext.Provider>
  );
};

export const useMobileNavigation = () => {
  const context = React.useContext(MobileNavigationContext);
  if (!context) {
    throw new Error('useMobileNavigation must be used within MobileNavigationProvider');
  }
  return context;
};

// Composant pour les éléments de liste avec animation au tap
export const TouchableListItem: React.FC<{
  children: React.ReactNode;
  onClick: () => void;
  className?: string;
}> = ({ children, onClick, className = '' }) => {
  const [isPressed, setIsPressed] = useState(false);

  const handleTouchStart = () => {
    setIsPressed(true);
    triggerHaptic('light');
  };

  const handleTouchEnd = () => {
    setIsPressed(false);
    onClick();
  };

  return (
    <div
      className={`transition-transform duration-150 ${className}`}
      style={{
        transform: isPressed ? 'scale(0.98)' : 'scale(1)',
        WebkitTapHighlightColor: 'transparent',
      }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleTouchStart}
      onMouseUp={handleTouchEnd}
      onMouseLeave={() => setIsPressed(false)}
    >
      {children}
    </div>
  );
};

// Skeleton loader pour mobile
export const SkeletonCard: React.FC<{ lines?: number }> = ({ lines = 3 }) => {
  return (
    <div className="bg-white rounded-xl p-4 animate-pulse">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-12 h-12 bg-slate-200 rounded-full" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-slate-200 rounded w-3/4" />
          <div className="h-3 bg-slate-200 rounded w-1/2" />
        </div>
      </div>
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="h-3 bg-slate-200 rounded w-full mb-2" />
      ))}
    </div>
  );
};

// Action sheet native style
interface ActionSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  actions: { label: string; onClick: () => void; destructive?: boolean; icon?: React.ReactNode }[];
}

export const ActionSheet: React.FC<ActionSheetProps> = ({ isOpen, onClose, title, actions }) => {
  const [showActions, setShowActions] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => setShowActions(true), 10);
    } else {
      setShowActions(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-end justify-center"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 transition-opacity duration-300"
        style={{ opacity: showActions ? 1 : 0 }}
      />
      
      {/* Action Sheet */}
      <div 
        className="relative w-full max-w-md mx-auto mb-4 px-4"
        onClick={e => e.stopPropagation()}
      >
        <div 
          className="bg-slate-100/80 backdrop-blur-xl rounded-2xl overflow-hidden"
          style={{
            transform: showActions ? 'translateY(0)' : 'translateY(100%)',
            transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          {title && (
            <div className="px-4 py-3 text-center border-b border-slate-200/50">
              <p className="text-sm text-slate-500">{title}</p>
            </div>
          )}
          
          {actions.map((action, index) => (
            <button
              key={index}
              onClick={() => {
                triggerHaptic('light');
                action.onClick();
                onClose();
              }}
              className={`w-full px-4 py-4 flex items-center justify-center gap-2 border-b border-slate-200/50 last:border-b-0 active:bg-slate-200/50 transition-colors ${
                action.destructive ? 'text-red-500' : 'text-blue-600'
              }`}
            >
              {action.icon}
              <span className="font-medium">{action.label}</span>
            </button>
          ))}
        </div>
        
        {/* Cancel button */}
        <button
          onClick={onClose}
          className="w-full mt-3 bg-white rounded-xl py-4 font-semibold text-blue-600 active:bg-slate-100 transition-colors"
          style={{
            transform: showActions ? 'translateY(0)' : 'translateY(20px)',
            transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1) 0.05s',
          }}
        >
          Annuler
        </button>
      </div>
    </div>
  );
};

export default MobilePageTransition;
