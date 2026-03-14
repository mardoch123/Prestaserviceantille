import React, { useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  ArrowLeft,
  Home,
  Gift,
  Users,
  Trophy,
  TrendingUp,
  Share2,
  Sparkles,
  Menu,
  X,
  ChevronRight,
  Star,
  Target,
} from 'lucide-react';

type Props = {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  logoUrl?: string | null;
  brandName?: string | null;
  rightActions?: React.ReactNode;
  children: React.ReactNode;
  maxWidthClassName?: string;
  fullWidth?: boolean;
  hideBack?: boolean;
};

interface NavItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  badge?: number;
}

const MarketingPublicShell: React.FC<Props> = ({
  title,
  subtitle,
  onBack,
  logoUrl,
  brandName,
  rightActions,
  children,
  maxWidthClassName,
  fullWidth = false,
  hideBack = false,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isReferralSection = useMemo(() => {
    return location.pathname.includes('/parrainage');
  }, [location.pathname]);

  const referralNavItems: NavItem[] = useMemo(() => [
    { id: 'home', label: 'Accueil', icon: Home, href: '/parrainage' },
    { id: 'dashboard', label: 'Dashboard', icon: TrendingUp, href: '/parrainage/dashboard' },
    { id: 'filleuls', label: 'Mes filleuls', icon: Users, href: '/parrainage/mes-filleuls' },
    { id: 'points', label: 'Mes points', icon: Star, href: '/parrainage/mes-points' },
    { id: 'rewards', label: 'Récompenses', icon: Gift, href: '/parrainage/recompenses' },
    { id: 'offers', label: 'Offres', icon: Sparkles, href: '/flyers' },
  ], []);

  const isActive = (href: string) => {
    return location.pathname === href || location.pathname.startsWith(href + '/');
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      {/* Top Navigation Bar */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className={fullWidth ? 'w-full px-4 sm:px-6 lg:px-8' : (maxWidthClassName || 'max-w-5xl') + ' mx-auto px-4'}>
          <div className="flex items-center justify-between h-16">
            {/* Left - Back Button */}
            <div className="flex items-center">
              {!hideBack && onBack && (
                <button
                  onClick={onBack}
                  className="flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-slate-900 transition-colors p-2 rounded-lg hover:bg-slate-100"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span className="hidden sm:inline">Retour</span>
                </button>
              )}
            </div>

            {/* Center - Logo & Title */}
            <div className="flex-1 flex flex-col items-center justify-center">
              {logoUrl ? (
                <img src={logoUrl} alt="Logo" className="h-10 w-auto object-contain" />
              ) : brandName ? (
                <span className="text-lg font-extrabold text-slate-800">{brandName}</span>
              ) : null}
            </div>

            {/* Right - Actions & Mobile Menu */}
            <div className="flex items-center gap-2">
              {rightActions && (
                <div className="hidden sm:flex items-center gap-2">
                  {rightActions}
                </div>
              )}

              {/* Mobile menu button */}
              {isReferralSection && (
                <button
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  className="sm:hidden p-2 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  {mobileMenuOpen ? (
                    <X className="w-6 h-6 text-slate-600" />
                  ) : (
                    <Menu className="w-6 h-6 text-slate-600" />
                  )}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Referral Navigation - Desktop */}
        {isReferralSection && (
          <div className="hidden sm:block border-t border-slate-100">
            <div className={fullWidth ? 'w-full px-4 sm:px-6 lg:px-8' : (maxWidthClassName || 'max-w-5xl') + ' mx-auto px-4'}>
              <div className="flex items-center gap-1 py-2 overflow-x-auto">
                {referralNavItems.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.href);
                  return (
                    <button
                      key={item.id}
                      onClick={() => navigate(item.href)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${
                        active
                          ? 'bg-brand-blue text-white'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {item.label}
                      {item.badge !== undefined && item.badge > 0 && (
                        <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-white/20">
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Mobile Menu */}
        {isReferralSection && mobileMenuOpen && (
          <div className="sm:hidden border-t border-slate-100 bg-white">
            <div className="px-4 py-3 space-y-1">
              {referralNavItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      navigate(item.href);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left font-bold transition-all ${
                      active
                        ? 'bg-brand-blue text-white'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    {item.label}
                    {item.badge !== undefined && item.badge > 0 && (
                      <span className="ml-auto px-2 py-0.5 text-xs rounded-full bg-brand-orange text-white">
                        {item.badge}
                      </span>
                    )}
                    <ChevronRight className="w-4 h-4 ml-auto opacity-50" />
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </nav>

      {/* Main Content */}
      <main className={fullWidth ? '' : (maxWidthClassName || 'max-w-5xl') + ' mx-auto px-4 py-6'}>
        {/* Page Title - Only show when not in landing page mode */}
        {!isReferralSection && (
          <div className="mb-6">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">{title}</h1>
            {subtitle && <p className="text-slate-600 mt-1">{subtitle}</p>}
          </div>
        )}

        {/* Mobile right actions */}
        {rightActions && (
          <div className="flex sm:hidden items-center justify-center gap-2 mb-4">
            {rightActions}
          </div>
        )}

        {children}
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-200 bg-white">
        <div className={fullWidth ? 'w-full px-4 sm:px-6 lg:px-8' : (maxWidthClassName || 'max-w-5xl') + ' mx-auto px-4'}>
          <div className="py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              {logoUrl ? (
                <img src={logoUrl} alt="Logo" className="h-8 w-auto" />
              ) : brandName ? (
                <span className="font-extrabold text-slate-800">{brandName}</span>
              ) : null}
            </div>

            <div className="flex items-center gap-4 text-sm text-slate-500">
              <button
                onClick={() => navigate('/parrainage')}
                className="hover:text-slate-900 transition-colors"
              >
                Programme de parrainage
              </button>
              <span className="hidden sm:inline">•</span>
              <button
                onClick={() => navigate('/flyers')}
                className="hover:text-slate-900 transition-colors"
              >
                Offres
              </button>
            </div>

            <div className="text-sm text-slate-400">
              © {new Date().getFullYear()} {brandName || 'Presta Services'}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default MarketingPublicShell;
