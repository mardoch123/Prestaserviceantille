import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { SafeImage } from './SafeImage';
import { 
  LayoutDashboard, 
  BarChart2, 
  Users, 
  Briefcase, 
  FileText, 
  Calendar, 
  Clock, 
  PhoneCall,
  QrCode,
  ClipboardCheck,
  Mail,
  Wand2,
  Megaphone,
  Gift,
  UserPlus,
  UserRoundPlus,
  ChevronDown,
  ChevronRight,
  X,
  Calculator,
  Send,
  Moon,
  Sun,
  Filter,
  Settings,
  Check,
  MailCheck,
  Headphones
} from 'lucide-react';
import { NavItem } from '../types';
import { useData } from '../context/DataContext';
import { supabase, isSupabaseConfigured } from '../utils/supabaseClient';
import { ServiceTypeFilter, getServiceTypeOptions } from '../utils/serviceTypes';

const navItems: NavItem[] = [
  { label: 'Tableau de bord', path: '/', icon: LayoutDashboard },
  { label: 'Pointage QR', path: '/qrcode', icon: QrCode },
  { label: 'Parrainage', path: '/parrainage', icon: Gift },
  { label: 'Dashboard Parrain', path: '/parrainage/dashboard', icon: BarChart2 },
  { label: 'Devenir parrain', path: '/parrainage/devenir-parrain-client', icon: UserRoundPlus },
  { label: 'Inscrire un filleul', path: '/parrainage/inscrire-filleul', icon: UserRoundPlus },
  { label: 'Mes filleuls', path: '/parrainage/mes-filleuls', icon: Users },
  { label: 'Mes points', path: '/parrainage/mes-points', icon: Gift },
  { label: 'Récompenses', path: '/parrainage/recompenses', icon: Gift },
  { label: 'Disponibilité Prestataires', path: '/provider-availability', icon: Calendar },
  { label: 'Rapports Missions', path: '/reports', icon: ClipboardCheck },
  { label: 'Statistiques', path: '/statistics', icon: BarChart2 },
  { label: 'Comptabilité', path: '/accounting', icon: Calculator },
  { label: 'Clients', path: '/clients', icon: Users },
  { label: 'Prestataires', path: '/providers', icon: Briefcase },
  { label: 'Devis/Factures', path: '/invoices', icon: FileText },
  { label: 'Planning', path: '/planning', icon: Calendar },
  { label: 'Réservations', path: '/reservations', icon: Clock },
  { label: 'Secrétariat', path: '/secretariat', icon: PhoneCall },
  { label: 'Formulaires Contact', path: '/contact-forms', icon: Mail },
  { label: 'Email Marketing', path: '/admin/email-marketing', icon: Send },
  { label: 'Comptes test', path: '/demo-accounts', icon: Wand2 },
  { label: 'Gestion des flyers', path: '/admin/flyers', icon: Megaphone },
  { label: 'Demandes Flyers', path: '/admin/flyer-requests', icon: Megaphone },
  { label: 'Filleuls (en attente)', path: '/admin/filleuls', icon: UserPlus },
  { label: 'Filleuls', path: '/admin/referrals', icon: UserPlus },
  { label: 'Parrains (performance)', path: '/admin/referrers-performance', icon: Users },
  { label: 'Récompenses & Points', path: '/admin/rewards', icon: Gift },
  { label: 'SAV', path: '/sav', icon: Headphones },
];

interface SidebarProps {
    isOpen: boolean;
    onClose: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const location = useLocation();
  const { companySettings, currentUser, messages, contactForms, isSoberMode, toggleSoberMode, clientLeads, missions, serviceTypeFilter, setServiceTypeFilter } = useData();

  const [isMarketingOpen, setIsMarketingOpen] = React.useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);

  // Get available service types from missions
  const availableServiceTypes = useMemo(() => {
    const items = [...(missions || [])];
    return getServiceTypeOptions(items.map((m: any) => ({ text: m.serviceType || m.service_type || m.title || '' })));
  }, [missions]);

  // Check if current page should show service filter
  const showServiceFilter = useMemo(() => {
    const filterablePaths = ['/', '/planning', '/missions', '/devis', '/invoices', '/statistics'];
    return filterablePaths.some(path => location.pathname === path || location.pathname.startsWith(path));
  }, [location.pathname]);

  const isClientReferrer = useMemo(() => {
    if (currentUser?.role !== 'client') return false;
    try {
      const v = String(localStorage.getItem('mkt_client_is_referrer') || '').trim();
      return v === '1' || v.toLowerCase() === 'true';
    } catch {
      return false;
    }
  }, [currentUser?.role, currentUser?.id]);

  const unreadChatClientsCount = useMemo(() => {
    if (currentUser?.role !== 'admin') return 0;
    const ids = new Set<string>();
    (messages || []).forEach((m: any) => {
      if (String(m?.sender || '') !== 'client') return;
      if (m?.read === true) return;
      const clientId = String(m?.clientId || '');
      if (!clientId) return;
      ids.add(clientId);
    });
    return ids.size;
  }, [currentUser?.role, messages]);

  const unreadContactFormsCount = useMemo(() => {
    if (currentUser?.role !== 'admin') return 0;
    return (contactForms || []).filter(f => !f.isRead).length;
  }, [currentUser?.role, contactForms]);

  const pendingClientsCount = useMemo(() => {
    if (currentUser?.role !== 'admin') return 0;
    return (clientLeads || [])
      .filter((l: any) => String(l?.status || '') === 'pending')
      .filter((l: any) => !l?.admin_seen_at)
      .length;
  }, [currentUser?.role, clientLeads]);

  const missionReportsInProgressCount = useMemo(() => {
    if (currentUser?.role !== 'admin' && currentUser?.role !== 'super_admin') return 0;
    return (missions || []).filter((m: any) => {
      const status = String(m?.status || '').toLowerCase().trim();
      return status === 'in_progress' || status === 'en_cours' || status === 'inprogress' || status === 'started' || status === 'demarree';
    }).length;
  }, [currentUser?.role, missions]);

  const [newOfferInterestedCount, setNewOfferInterestedCount] = useState(0);
  const [newReferrersCount, setNewReferrersCount] = useState(0);
  const [pendingServiceRequestsCount, setPendingServiceRequestsCount] = useState(0);
  const [savPendingCount, setSavPendingCount] = useState(0);
  const [showEmailMarketingBadge, setShowEmailMarketingBadge] = useState(false);
  
  // EmailJS quota tracking with detailed stats
  const [emailQuota, setEmailQuota] = useState<{
    used: number;
    failed: number;
    limit: number;
    remaining: number;
    percentUsed: number;
    projectedUsage: number;
    estimatedOverage: number;
    dailyAverage: number;
    currentMonth: string;
    source: string;
    lastUpdated: string;
  } | null>(null);
  const [emailQuotaLoading, setEmailQuotaLoading] = useState(false);
  const [showEmailQuota, setShowEmailQuota] = useState(true); // Toggle to show/hide email counter

  useEffect(() => {
    if (currentUser?.role !== 'admin' && currentUser?.role !== 'super_admin') return;
    if (!isSupabaseConfigured) return;

    let cancelled = false;

    const loadMarketingCounts = async () => {
      try {
        const reqRes = await supabase
          .from('mkt_customer_requests')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'new');
        // Only count unseen by admin
        // (requires mkt_customer_requests.admin_seen_at)
        // Note: chained filters work with head:true
        
        // Re-run the query with admin_seen_at null for accurate unseen count
        const reqResUnseen = await supabase
          .from('mkt_customer_requests')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'new')
          .is('admin_seen_at', null);
        const reqCount = (reqResUnseen?.count ?? reqRes?.count ?? 0) || 0;
        const refRes = await supabase
          .from('mkt_referrers')
          .select('id', { count: 'exact', head: true })
          .is('admin_seen_at', null);
        const refCount = refRes?.count || 0;

        // Count pending service requests
        const serviceReqRes = await supabase
          .from('customer_service_requests')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'pending')
          .is('admin_seen_at', null);
        const serviceReqCount = serviceReqRes?.count || 0;

        // Count completed missions without SAV
        const { data: savMissions } = await supabase
          .from('sav_records')
          .select('mission_id');
        const missionIdsWithSav = (savMissions || []).map((r: any) => r.mission_id);
        
        // Also get missions with satisfaction surveys
        const { data: surveyMissions } = await supabase
          .from('satisfaction_surveys')
          .select('mission_id');
        const missionIdsWithSurveys = (surveyMissions || []).map((s: any) => s.mission_id);
        
        // Combine both lists
        const allMissionIdsToExclude = [...new Set([...missionIdsWithSav, ...missionIdsWithSurveys])];
        
        // Essayer d'abord avec 'completed'
        let savCount = 0;
        
        let savQuery = supabase
          .from('missions')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'completed');
        
        if (allMissionIdsToExclude.length > 0) {
          savQuery = savQuery.not('id', 'in', `(${allMissionIdsToExclude.join(',')})`);
        }
        
        const { count: completedCount, error: completedError } = await savQuery;
        
        if (!completedError && completedCount) {
          savCount = completedCount;
        }
        
        // Si 0, essayer avec d'autres statuts possibles
        if (savCount === 0) {
          const possibleStatuses = ['terminee', 'done', 'finished', 'validated', 'termine', 'fini'];
          
          for (const status of possibleStatuses) {
            let altQuery = supabase
              .from('missions')
              .select('*', { count: 'exact', head: true })
              .eq('status', status);
            
            if (allMissionIdsToExclude.length > 0) {
              altQuery = altQuery.not('id', 'in', `(${allMissionIdsToExclude.join(',')})`);
            }
            
            const { count: altCount, error: altError } = await altQuery;
            
            if (!altError && altCount) {
              savCount += altCount;
            }
          }
        }

        if (cancelled) return;
        setNewOfferInterestedCount(Number(reqCount) || 0);
        setNewReferrersCount(Number(refCount) || 0);
        setPendingServiceRequestsCount(Number(serviceReqCount) || 0);
        setSavPendingCount(Number(savCount) || 0);

        // Check if email marketing badge should be shown
        try {
          const { data: badgeData } = await supabase
            .from('admin_menu_badge_tracking')
            .select('*')
            .eq('menu_item_key', 'email-marketing')
            .single();
          
          if (badgeData) {
            const badgeUntil = badgeData.badge_until ? new Date(badgeData.badge_until) : null;
            const dismissedBy = badgeData.dismissed_by || [];
            const isExpired = badgeUntil ? badgeUntil < new Date() : false;
            const isDismissed = currentUser?.id ? dismissedBy.includes(currentUser.id) : false;
            
            setShowEmailMarketingBadge(badgeData.show_badge && !isExpired && !isDismissed);
          }
        } catch {
          // Badge tracking not critical, ignore errors
        }
      } catch {
        if (cancelled) return;
        setNewOfferInterestedCount(0);
        setNewReferrersCount(0);
      }
    };

    loadMarketingCounts();
    return () => {
      cancelled = true;
    };
  }, [currentUser?.role]);

  // Fetch EmailJS quota for admin users via API endpoint
  useEffect(() => {
    if (currentUser?.role !== 'admin' && currentUser?.role !== 'super_admin') return;

    // Skip API call in development/localhost - l'API n'existe pas en local
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    
    let cancelled = false;

    const fetchEmailQuota = async () => {
      setEmailQuotaLoading(true);
      try {
        // En localhost, passer directement au fallback Supabase
        if (isLocalhost) {
          throw new Error('Skip API in localhost');
        }
        
        // Call the API endpoint for real quota data - use /api prefix for VPS compatibility
        const apiBase = import.meta.env.VITE_API_URL || window.location.origin;
        // Ensure we don't double the /api path
        const apiUrl = apiBase.endsWith('/api') 
          ? `${apiBase}/emailjs-quota` 
          : `${apiBase}/api/emailjs-quota`;
        const response = await fetch(apiUrl, { 
          credentials: 'same-origin' // Include cookies/auth headers
        });
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.success && data.quota) {
          if (!cancelled) {
            setEmailQuota(data.quota);
          }
        } else {
          throw new Error(data.error || 'Failed to fetch quota');
        }
      } catch (err) {
        // Silencieux en production - fallback normal sur VPS avec auth basique
        if (!isLocalhost) {
          console.log('[Sidebar] API quota indisponible (auth basique?), fallback Supabase...');
        }
        // Fallback: use local Supabase query
        try {
          if (!isSupabaseConfigured) throw new Error('Supabase not configured');
          
          const now = new Date();
          const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
          
          const { count, error } = await supabase
            .from('email_logs')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', monthStart)
            .eq('status', 'sent');

          if (error) throw error;

          const monthlyLimit = 700;
          const used = count || 0;
          const remaining = Math.max(0, monthlyLimit - used);
          const percentUsed = Math.round((used / monthlyLimit) * 100);
          const dayOfMonth = now.getDate();
          const dailyAverage = dayOfMonth > 1 ? used / dayOfMonth : used;

          if (!cancelled) {
            setEmailQuota({ 
              used, 
              failed: 0,
              limit: monthlyLimit, 
              remaining,
              percentUsed,
              projectedUsage: Math.round(dailyAverage * 30),
              estimatedOverage: 0,
              dailyAverage: Math.round(dailyAverage * 10) / 10,
              currentMonth: now.toLocaleString('fr-FR', { month: 'long', year: 'numeric' }),
              source: 'supabase_fallback',
              lastUpdated: new Date().toISOString()
            });
          }
        } catch (fallbackErr) {
          if (!isLocalhost) {
            console.error('[Sidebar] Fallback also failed:', fallbackErr);
          }
          if (!cancelled) {
            setEmailQuota({ 
              used: 0, 
              failed: 0,
              limit: 2000, 
              remaining: 2000,
              percentUsed: 0,
              projectedUsage: 0,
              estimatedOverage: 0,
              dailyAverage: 0,
              currentMonth: new Date().toLocaleString('fr-FR', { month: 'long', year: 'numeric' }),
              source: 'default',
              lastUpdated: new Date().toISOString()
            });
          }
        }
      } finally {
        if (!cancelled) {
          setEmailQuotaLoading(false);
        }
      }
    };

    fetchEmailQuota();

    // Refresh quota every 30 seconds for "real-time" feel
    const interval = setInterval(fetchEmailQuota, 30000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [currentUser?.role]);

  const marketingNewTotalCount = useMemo(() => {
    if (currentUser?.role !== 'admin' && currentUser?.role !== 'super_admin') return 0;
    return (pendingClientsCount || 0) + (newOfferInterestedCount || 0) + (newReferrersCount || 0) + (pendingServiceRequestsCount || 0);
  }, [currentUser?.role, pendingClientsCount, newOfferInterestedCount, newReferrersCount, pendingServiceRequestsCount]);

  // Filter navigation items based on user role
  const getFilteredNavItems = () => {
    if (currentUser?.role === 'client') {
      // Clients can only see specific items
      return navItems
        .map((item) => {
          if (item.path !== '/parrainage/devenir-parrain-client') return item;
          if (!isClientReferrer) return item;
          return { ...item, label: 'Mon compte parrain', path: '/parrainage/dashboard' };
        })
        .filter(item =>
          ['/', '/qrcode', '/parrainage', '/parrainage/dashboard', '/parrainage/devenir-parrain-client', '/parrainage/inscrire-filleul', '/parrainage/mes-filleuls', '/parrainage/mes-points', '/parrainage/recompenses'].includes(item.path)
        );
    }
    if (currentUser?.role === 'provider') {
      return navItems.filter(item => item.path !== '/demo-accounts' && !item.path.startsWith('/admin/') && !item.path.startsWith('/parrainage/') && item.path !== '/flyers');
    }
    // Admin and super admin
    return navItems
      .filter(item => !item.path.startsWith('/parrainage/'))
      .filter(item => ![
        '/admin/flyers',
        '/admin/flyer-requests',
        '/admin/filleuls',
        '/admin/referrals',
        '/admin/referrers-performance',
        '/admin/rewards',
        '/admin/service-requests'
      ].includes(item.path));
  };

  const filteredNavItems = getFilteredNavItems();

  const marketingNavItems = useMemo(() => {
    if (currentUser?.role !== 'admin' && currentUser?.role !== 'super_admin') return [];
    const wanted = [
      '/admin/flyers',
      '/admin/flyer-requests',
      '/admin/filleuls',
      '/admin/referrals',
      '/admin/referrers-performance',
      '/admin/rewards',
      '/admin/service-requests'
    ];
    return navItems.filter(i => wanted.includes(i.path));
  }, [currentUser?.role]);

  return (
    <>
        {/* Mobile Overlay */}
        <div 
            className={`fixed inset-0 bg-black/50 z-40 md:hidden transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
            onClick={onClose}
        ></div>

        <aside className={`
            fixed inset-y-0 left-0 z-50 w-64 h-full flex flex-col transition-transform duration-300 ease-in-out shadow-2xl md:shadow-none
            border-r border-beige-200
            ${isSoberMode ? 'bg-slate-900 text-slate-100' : 'bg-cream-200/95 md:bg-cream-200/50'}
            ${isSoberMode ? '' : 'backdrop-blur-md md:backdrop-blur-none'}
            ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0 md:relative'}
        `}>
          <div className="p-6 flex flex-col items-center relative shrink-0">
            <button 
                onClick={onClose}
                className={`absolute top-4 right-4 p-1 md:hidden ${isSoberMode ? 'text-slate-300 hover:text-white' : 'text-slate-500 hover:text-slate-800'}`}
            >
                <X className="w-6 h-6" />
            </button>

            {/* Dynamic Logo from Settings */}
            {companySettings.logoUrl ? (
                 <div className="w-24 h-24 mb-2 flex items-center justify-center">
                    <SafeImage
                        src={companySettings.logoUrl}
                        alt="Logo"
                        className="w-full h-full object-contain"
                        timeout={5000}
                        retryCount={1}
                    />
                 </div>
            ) : (
                <div className="w-20 h-20 rounded-full bg-white border-2 border-brand-orange flex items-center justify-center mb-2 shadow-sm overflow-hidden">
                   <span className="text-brand-blue font-bold text-xs text-center">PRESTA<br/>SERVICES<br/>ANTILLES</span>
                </div>
            )}
            <h1 className={`text-lg font-serif font-bold text-center ${isSoberMode ? 'text-white' : 'text-slate-800'}`}>SIMPLIFIEZ</h1>
            <p className={`text-xs text-center ${isSoberMode ? 'text-slate-300' : 'text-slate-500'}`}>VOTRE QUOTIDIEN</p>

            {/* Settings Dropdown - Contains Dark Mode Toggle */}
            <div className="mt-4 w-full relative">
              <button
                type="button"
                onClick={() => setIsSettingsOpen(v => !v)}
                className={`w-full px-3 py-2 rounded-lg text-xs font-bold border transition flex items-center justify-between ${
                  isSoberMode
                    ? 'bg-slate-800 text-slate-100 border-slate-700 hover:bg-slate-700'
                    : 'bg-white/70 text-slate-700 border-beige-200 hover:bg-white'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Settings className="w-4 h-4" />
                  Paramètres
                </span>
                {isSettingsOpen ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
              </button>

              {isSettingsOpen && (
                <div className={`mt-1 absolute left-0 right-0 rounded-lg border shadow-lg z-50 overflow-hidden ${
                  isSoberMode
                    ? 'bg-slate-800 border-slate-700'
                    : 'bg-white border-beige-200'
                }`}>
                  {/* Dark Mode Toggle */}
                  <button
                    type="button"
                    onClick={() => toggleSoberMode()}
                    className={`w-full px-3 py-3 text-xs font-medium transition flex items-center justify-between ${
                      isSoberMode
                        ? 'text-slate-200 hover:bg-slate-700'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      {isSoberMode ? (
                        <><Moon className="w-4 h-4 text-blue-400" /> Mode Sobre</>
                      ) : (
                        <><Sun className="w-4 h-4 text-amber-500" /> Mode Normal</>
                      )}
                    </span>
                    <span className={`w-2 h-2 rounded-full ${isSoberMode ? 'bg-blue-400' : 'bg-amber-500'}`} />
                  </button>
                </div>
              )}
            </div>

            {/* Service Type Filter - Clearly Visible */}
            {showServiceFilter && availableServiceTypes.length > 1 && (
              <div className={`mt-4 w-full p-3 rounded-lg border ${
                isSoberMode
                  ? 'bg-slate-800/50 border-slate-700'
                  : 'bg-white/50 border-beige-200'
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  <Filter className={`w-4 h-4 ${isSoberMode ? 'text-slate-400' : 'text-slate-500'}`} />
                  <span className={`text-xs font-bold ${isSoberMode ? 'text-slate-300' : 'text-slate-700'}`}>
                    Filtrer par service
                  </span>
                </div>
                <select
                  value={serviceTypeFilter}
                  onChange={(e) => setServiceTypeFilter(e.target.value as ServiceTypeFilter)}
                  className={`w-full px-2 py-2 text-xs rounded-lg border focus:ring-2 focus:ring-brand-blue focus:border-brand-blue ${
                    isSoberMode
                      ? 'bg-slate-900 text-slate-200 border-slate-700'
                      : 'bg-white text-slate-700 border-slate-300'
                  }`}
                >
                  {availableServiceTypes.map((type) => (
                    <option key={type} value={type}>
                      {type === 'all' ? 'Tous les services' : type}
                    </option>
                  ))}
                </select>
                {serviceTypeFilter !== 'all' && (
                  <div className="mt-2 flex items-center gap-1">
                    <span className={`text-[10px] px-2 py-1 rounded-full ${
                      isSoberMode
                        ? 'bg-brand-blue/20 text-blue-300'
                        : 'bg-brand-blue/10 text-brand-blue'
                    }`}>
                      {serviceTypeFilter}
                    </span>
                    <button
                      onClick={() => setServiceTypeFilter('all')}
                      className={`text-[10px] underline ${isSoberMode ? 'text-slate-400' : 'text-slate-500'}`}
                    >
                      Réinitialiser
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <nav className="flex-1 px-4 space-y-1 overflow-y-auto pb-4">
            {filteredNavItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => { 
                    if(window.innerWidth < 768) onClose();
                    // Dismiss Email Marketing badge when navigating to it - fire and forget
                    if (item.path === '/admin/email-marketing' && showEmailMarketingBadge && currentUser?.id) {
                      setShowEmailMarketingBadge(false);
                      void supabase.rpc('marketing_dismiss_badge', {
                        p_menu_item_key: 'email-marketing',
                        p_user_id: currentUser.id
                      });
                    }
                  }}
                  className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                    isActive
                      ? (isSoberMode ? 'bg-slate-800 text-white shadow-sm' : 'bg-white text-brand-blue shadow-sm')
                      : (isSoberMode ? 'text-slate-200 hover:bg-slate-800/70 hover:text-white' : 'text-slate-600 hover:bg-white/50 hover:text-slate-800')
                  }`}
                >
                  <item.icon className={`mr-3 h-5 w-5 ${isActive ? 'text-brand-orange' : (isSoberMode ? 'text-slate-400' : 'text-slate-400')}`} />
                  <span className="flex-1">{item.label}</span>
                  {item.path === '/admin/filleuls' && pendingClientsCount > 0 && (
                    <span className="min-w-[22px] h-[22px] px-2 inline-flex items-center justify-center rounded-full bg-red-600 text-white text-xs font-bold">
                      {pendingClientsCount}
                    </span>
                  )}
                  {item.path === '/secretariat' && unreadChatClientsCount > 0 && (
                    <span className="min-w-[22px] h-[22px] px-2 inline-flex items-center justify-center rounded-full bg-red-600 text-white text-xs font-bold">
                      {unreadChatClientsCount}
                    </span>
                  )}
                  {item.path === '/contact-forms' && unreadContactFormsCount > 0 && (
                    <span className="min-w-[22px] h-[22px] px-2 inline-flex items-center justify-center rounded-full bg-red-600 text-white text-xs font-bold">
                      {unreadContactFormsCount}
                    </span>
                  )}
                  {item.path === '/reports' && missionReportsInProgressCount > 0 && (
                    <span className="min-w-[22px] h-[22px] px-2 inline-flex items-center justify-center rounded-full bg-red-600 text-white text-xs font-bold">
                      {missionReportsInProgressCount}
                    </span>
                  )}
                  {item.path === '/admin/email-marketing' && showEmailMarketingBadge && (
                    <span className="px-2 py-0.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-xs font-bold rounded-full">
                      NEW
                    </span>
                  )}
                  {item.path === '/provider-availability' && (
                    <span className="px-2 py-0.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-xs font-bold rounded-full">
                      NEW
                    </span>
                  )}
                  {item.path === '/sav' && savPendingCount > 0 && (
                    <span className="min-w-[22px] h-[22px] px-2 inline-flex items-center justify-center rounded-full bg-amber-500 text-white text-xs font-bold">
                      {savPendingCount}
                    </span>
                  )}
                  {item.path === '/accounting' && (
                    <span className="px-2 py-0.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[10px] font-bold rounded-full">
                      BETA
                    </span>
                  )}
                </Link>
              );
            })}

            {(currentUser?.role === 'admin' || currentUser?.role === 'super_admin') && marketingNavItems.length > 0 && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setIsMarketingOpen(v => !v)}
                  className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                    isSoberMode
                      ? 'text-slate-200 hover:bg-slate-800/70 hover:text-white'
                      : 'text-slate-600 hover:bg-white/50 hover:text-slate-800'
                  }`}
                >
                  <Megaphone className={`mr-3 h-5 w-5 ${isSoberMode ? 'text-slate-400' : 'text-slate-400'}`} />
                  <span className="flex-1">Marketing</span>
                  {marketingNewTotalCount > 0 && (
                    <span className="min-w-[22px] h-[22px] px-2 inline-flex items-center justify-center rounded-full bg-red-600 text-white text-xs font-bold mr-2">
                      {marketingNewTotalCount}
                    </span>
                  )}
                  {isMarketingOpen ? (
                    <ChevronDown className="h-4 w-4 text-slate-400" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  )}
                </button>

                {isMarketingOpen && (
                  <div className="mt-1 ml-4 space-y-1">
                    {marketingNavItems.map((item) => {
                      const isActive = location.pathname === item.path;
                      return (
                        <Link
                          key={item.path}
                          to={item.path}
                          onClick={() => { if(window.innerWidth < 768) onClose(); }}
                          className={`flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                            isActive
                              ? (isSoberMode ? 'bg-slate-800 text-white shadow-sm' : 'bg-white text-brand-blue shadow-sm')
                              : (isSoberMode ? 'text-slate-200 hover:bg-slate-800/70 hover:text-white' : 'text-slate-600 hover:bg-white/50 hover:text-slate-800')
                          }`}
                        >
                          <item.icon className={`mr-3 h-4 w-4 ${isActive ? 'text-brand-orange' : (isSoberMode ? 'text-slate-400' : 'text-slate-400')}`} />
                          <span className="flex-1">{item.label}</span>
                          {item.path === '/admin/filleuls' && pendingClientsCount > 0 && (
                            <span className="min-w-[22px] h-[22px] px-2 inline-flex items-center justify-center rounded-full bg-red-600 text-white text-xs font-bold">
                              {pendingClientsCount}
                            </span>
                          )}
                          {item.path === '/admin/flyer-requests' && newOfferInterestedCount > 0 && (
                            <span className="min-w-[22px] h-[22px] px-2 inline-flex items-center justify-center rounded-full bg-red-600 text-white text-xs font-bold">
                              {newOfferInterestedCount}
                            </span>
                          )}
                          {item.path === '/admin/referrers-performance' && newReferrersCount > 0 && (
                            <span className="min-w-[22px] h-[22px] px-2 inline-flex items-center justify-center rounded-full bg-red-600 text-white text-xs font-bold">
                              {newReferrersCount}
                            </span>
                          )}
                          {item.path === '/admin/service-requests' && pendingServiceRequestsCount > 0 && (
                            <span className="min-w-[22px] h-[22px] px-2 inline-flex items-center justify-center rounded-full bg-red-600 text-white text-xs font-bold">
                              {pendingServiceRequestsCount}
                            </span>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </nav>
          
          <div className="p-4 border-t border-beige-200 shrink-0 space-y-3">
            {/* EmailJS Quota Indicator - Only for admins */}
            {(currentUser?.role === 'admin' || currentUser?.role === 'super_admin') && emailQuota && showEmailQuota && (
              <div className={`p-3 rounded-lg border ${
                isSoberMode
                  ? 'bg-slate-800 border-slate-700'
                  : 'bg-white/80 border-beige-200'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <MailCheck className={`w-4 h-4 ${
                      emailQuota.percentUsed > 75 
                        ? 'text-red-500' 
                        : emailQuota.percentUsed > 50 
                          ? 'text-amber-500' 
                          : 'text-emerald-500'
                    }`} />
                    <span className={`text-xs font-bold ${isSoberMode ? 'text-slate-200' : 'text-slate-700'}`}>
                      Quota EmailJS
                    </span>
                  </div>
                  <button
                    onClick={() => setShowEmailQuota(false)}
                    className={`text-[10px] ${isSoberMode ? 'text-slate-400 hover:text-slate-200' : 'text-slate-400 hover:text-slate-600'}`}
                    title="Masquer le compteur"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
                
                {/* Main Stats */}
                <div className="flex items-center justify-between mb-2">
                  <div className="text-center">
                    <span className={`text-[10px] ${isSoberMode ? 'text-slate-500' : 'text-slate-400'}`}>Utilisé</span>
                    <p className={`text-sm font-bold ${isSoberMode ? 'text-slate-200' : 'text-slate-700'}`}>
                      {emailQuota.used}
                    </p>
                  </div>
                  <div className="text-center">
                    <span className={`text-[10px] ${isSoberMode ? 'text-slate-500' : 'text-slate-400'}`}>Restants</span>
                    <p className={`text-sm font-bold ${
                      emailQuota.remaining < 500 
                        ? 'text-red-500' 
                        : emailQuota.remaining < 1000 
                          ? 'text-amber-500' 
                          : 'text-emerald-600'
                    }`}>
                      {emailQuota.remaining}
                    </p>
                  </div>
                  <div className="text-center">
                    <span className={`text-[10px] ${isSoberMode ? 'text-slate-500' : 'text-slate-400'}`}>Limite</span>
                    <p className={`text-sm font-bold ${isSoberMode ? 'text-slate-200' : 'text-slate-700'}`}>
                      {emailQuota.limit}
                    </p>
                  </div>
                </div>
                
                {/* Progress Bar */}
                <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden mb-2">
                  <div 
                    className={`h-full rounded-full transition-all duration-500 ${
                      emailQuota.percentUsed > 75 
                        ? 'bg-red-500' 
                        : emailQuota.percentUsed > 50 
                          ? 'bg-amber-500' 
                          : 'bg-emerald-500'
                    }`}
                    style={{ width: `${Math.min(emailQuota.percentUsed, 100)}%` }}
                  />
                </div>
                
                {/* Additional Info */}
                <div className="flex items-center justify-between text-[10px]">
                  <span className={isSoberMode ? 'text-slate-500' : 'text-slate-400'}>
                    {emailQuota.percentUsed}% utilisé
                  </span>
                  <span className={isSoberMode ? 'text-slate-500' : 'text-slate-400'}>
                    {emailQuota.currentMonth}
                  </span>
                </div>
                
                {/* Reset Button - Always visible */}
                <button
                  onClick={async () => {
                    // Réinitialiser manuellement le quota à 2000
                    setEmailQuotaLoading(true);
                    
                    // Reset immédiat à 2000
                    setEmailQuota({
                      used: 0,
                      failed: 0,
                      limit: 2000,
                      remaining: 2000,
                      percentUsed: 0,
                      projectedUsage: 0,
                      estimatedOverage: 0,
                      dailyAverage: 0,
                      currentMonth: new Date().toLocaleString('fr-FR', { month: 'long', year: 'numeric' }),
                      source: 'manual_reset',
                      lastUpdated: new Date().toISOString()
                    });
                    
                    // Optional: also refresh from API after manual reset
                    try {
                      const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
                      if (!isLocalhost) {
                        const apiBase = import.meta.env.VITE_API_URL || window.location.origin;
                        const apiUrl = apiBase.endsWith('/api') 
                          ? `${apiBase}/emailjs-quota` 
                          : `${apiBase}/api/emailjs-quota`;
                        await fetch(apiUrl, { credentials: 'same-origin' });
                      }
                    } catch (err) {
                      // Ignore API errors
                    } finally {
                      setEmailQuotaLoading(false);
                    }
                  }}
                  className="mt-3 w-full py-2 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-lg text-xs font-semibold hover:from-emerald-600 hover:to-teal-700 transition-colors"
                >
                  🔄 Réinitialiser le compteur
                </button>
                
                {/* Warning if low quota */}
                {emailQuota.remaining < 500 && (
                  <div className={`mt-2 p-2 rounded text-[10px] ${
                    emailQuota.remaining < 200 
                      ? 'bg-red-100 text-red-700' 
                      : 'bg-amber-100 text-amber-700'
                  }`}>
                    {emailQuota.remaining < 200 
                      ? '⚠️ Quota critique ! Moins de 200 emails restants' 
                      : '⚠️ Quota faible - Moins de 500 emails restants'}
                  </div>
                )}
              </div>
            )}
            
            {/* Show Email Counter Button when hidden */}
            {(currentUser?.role === 'admin' || currentUser?.role === 'super_admin') && emailQuota && !showEmailQuota && (
              <button
                onClick={() => setShowEmailQuota(true)}
                className={`w-full py-2 px-3 rounded-lg border text-xs font-medium flex items-center justify-center gap-2 transition-colors ${
                  isSoberMode
                    ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                    : 'bg-white/80 border-beige-200 text-slate-600 hover:bg-white'
                }`}
              >
                <MailCheck className="w-4 h-4" />
                Afficher le quota EmailJS
                <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] ${
                  emailQuota.remaining < 200 
                    ? 'bg-red-100 text-red-600' 
                    : emailQuota.remaining < 350 
                      ? 'bg-amber-100 text-amber-600' 
                      : 'bg-emerald-100 text-emerald-600'
                }`}>
                  {emailQuota.remaining}
                </span>
              </button>
            )}
            
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-500">A</div>
              <div className="text-xs">
                <p className="font-bold">Admin User</p>
                <p className="text-slate-500">Connecté</p>
              </div>
            </div>
          </div>
        </aside>
    </>
  );
};

export default Sidebar;
