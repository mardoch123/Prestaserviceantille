import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Calendar, 
  Users, 
  FileText, 
  QrCode,
  Briefcase,
  Settings,
  Bell
} from 'lucide-react';
import { Capacitor } from '@capacitor/core';

interface BottomNavItem {
  label: string;
  path: string;
  icon: React.ElementType;
  badge?: number;
}

const getNavItems = (role?: string): BottomNavItem[] => {
  switch (role) {
    case 'provider':
      return [
        { label: 'Missions', path: '/provider', icon: Calendar },
        { label: 'Scan', path: '/scan', icon: QrCode },
        { label: 'Disponibilité', path: '/provider-availability', icon: Calendar },
      ];
    case 'client':
      return [
        { label: 'Accueil', path: '/client', icon: LayoutDashboard },
        { label: 'Services', path: '/client/services', icon: FileText },
        { label: 'Parrainage', path: '/parrainage', icon: Users },
        { label: 'Profil', path: '/client/profile', icon: Settings },
      ];
    case 'admin':
    case 'super_admin':
      return [
        { label: 'Dashboard', path: '/', icon: LayoutDashboard },
        { label: 'Planning', path: '/planning', icon: Calendar },
        { label: 'QR Scan', path: '/scan', icon: QrCode },
        { label: 'Clients', path: '/clients', icon: Users },
        { label: 'Plus', path: '/menu', icon: Settings },
      ];
    default:
      return [
        { label: 'Accueil', path: '/', icon: LayoutDashboard },
        { label: 'Services', path: '/services', icon: FileText },
        { label: 'Contact', path: '/contact', icon: Bell },
      ];
  }
};

interface BottomNavigationProps {
  currentRole?: string;
  unreadCount?: number;
}

export const BottomNavigation: React.FC<BottomNavigationProps> = ({ 
  currentRole,
  unreadCount = 0 
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  const navItems = getNavItems(currentRole);

  // Cacher/montrer la nav lors du scroll
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      if (currentScrollY > lastScrollY && currentScrollY > 100) {
        setIsVisible(false);
      } else {
        setIsVisible(true);
      }
      
      setLastScrollY(currentScrollY);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY]);

  const handleNavClick = (path: string) => {
    // Feedback haptique sur mobile
    if (Capacitor.isNativePlatform() && 'vibrate' in navigator) {
      navigator.vibrate(50);
    }
    navigate(path);
  };

  return (
    <nav 
      className={`
        fixed bottom-0 left-0 right-0 z-50
        bg-white/95 backdrop-blur-lg border-t border-slate-200/50
        safe-area-pb
        transition-transform duration-300 ease-out
        ${isVisible ? 'translate-y-0' : 'translate-y-full'}
        md:hidden
      `}
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex items-center justify-around h-16">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path || 
                          location.pathname.startsWith(item.path + '/');
          const Icon = item.icon;
          
          return (
            <button
              key={item.path}
              onClick={() => handleNavClick(item.path)}
              className={`
                flex flex-col items-center justify-center flex-1 h-full
                min-w-0 px-1
                transition-all duration-200 active:scale-95
                ${isActive 
                  ? 'text-brand-blue' 
                  : 'text-slate-400 hover:text-slate-600'
                }
              `}
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              <div className="relative">
                <Icon 
                  className={`
                    w-6 h-6 transition-transform duration-200
                    ${isActive ? 'scale-110' : 'scale-100'}
                  `} 
                  strokeWidth={isActive ? 2.5 : 2}
                />
                {item.badge && item.badge > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                    {item.badge > 9 ? '9+' : item.badge}
                  </span>
                )}
                {item.path === '/client' && unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </div>
              <span className={`
                text-[10px] mt-0.5 font-medium truncate max-w-full px-1
                transition-all duration-200
                ${isActive ? 'opacity-100' : 'opacity-70'}
              `}>
                {item.label}
              </span>
              {isActive && (
                <div className="absolute bottom-1 w-1 h-1 bg-brand-blue rounded-full" />
              )}
            </button>
          );
        })}
      </div>
      {/* Safe area pour iPhone X+ */}
      <div className="h-safe-area-inset-bottom" />
    </nav>
  );
};

export default BottomNavigation;
