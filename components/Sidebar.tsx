
import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
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
  X
} from 'lucide-react';
import { NavItem } from '../types';
import { useData } from '../context/DataContext';
import { supabase, isSupabaseConfigured } from '../utils/supabaseClient';

const navItems: NavItem[] = [
  { label: 'Tableau de bord', path: '/', icon: LayoutDashboard },
  { label: 'Pointage QR', path: '/qrcode', icon: QrCode },
  { label: 'Devenir parrain', path: '/parrainage/devenir-parrain-client', icon: UserRoundPlus },
  { label: 'Inscrire un filleul', path: '/parrainage/inscrire-filleul', icon: UserRoundPlus },
  { label: 'Mes filleuls', path: '/parrainage/mes-filleuls', icon: Users },
  { label: 'Mes points', path: '/parrainage/mes-points', icon: Gift },
  { label: 'Rapports Missions', path: '/reports', icon: ClipboardCheck },
  { label: 'Statistiques', path: '/statistics', icon: BarChart2 },
  { label: 'Clients', path: '/clients', icon: Users },
  { label: 'Prestataires', path: '/providers', icon: Briefcase },
  { label: 'Devis/Factures', path: '/invoices', icon: FileText },
  { label: 'Planning', path: '/planning', icon: Calendar },
  { label: 'Réservations', path: '/reservations', icon: Clock },
  { label: 'Secrétariat', path: '/secretariat', icon: PhoneCall },
  { label: 'Formulaires Contact', path: '/contact-forms', icon: Mail },
  { label: 'Comptes test', path: '/demo-accounts', icon: Wand2 },
  { label: 'Gestion des flyers', path: '/admin/flyers', icon: Megaphone },
  { label: 'Demandes Flyers', path: '/admin/flyer-requests', icon: Megaphone },
  { label: 'Filleuls (en attente)', path: '/admin/filleuls', icon: UserPlus },
  { label: 'Filleuls', path: '/admin/referrals', icon: UserPlus },
  { label: 'Parrains (performance)', path: '/admin/referrers-performance', icon: Users },
  { label: 'Récompenses & Points', path: '/admin/rewards', icon: Gift },
];

interface SidebarProps {
    isOpen: boolean;
    onClose: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const location = useLocation();
  const { companySettings, currentUser, messages, contactForms, isSoberMode, toggleSoberMode, clientLeads } = useData();

  const [isMarketingOpen, setIsMarketingOpen] = React.useState(false);

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

  const [newOfferInterestedCount, setNewOfferInterestedCount] = useState(0);
  const [newReferrersCount, setNewReferrersCount] = useState(0);

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

        if (cancelled) return;
        setNewOfferInterestedCount(Number(reqCount) || 0);
        setNewReferrersCount(Number(refCount) || 0);
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

  const marketingNewTotalCount = useMemo(() => {
    if (currentUser?.role !== 'admin' && currentUser?.role !== 'super_admin') return 0;
    return (pendingClientsCount || 0) + (newOfferInterestedCount || 0) + (newReferrersCount || 0);
  }, [currentUser?.role, pendingClientsCount, newOfferInterestedCount, newReferrersCount]);

  // Filter navigation items based on user role
  const getFilteredNavItems = () => {
    if (currentUser?.role === 'client') {
      // Clients can only see specific items
      return navItems
        .map((item) => {
          if (item.path !== '/parrainage/devenir-parrain-client') return item;
          if (!isClientReferrer) return item;
          return { ...item, label: 'Mon compte parrain', path: '/parrainage/mon-compte-parrain' };
        })
        .filter(item =>
          ['/', '/qrcode', '/parrainage/devenir-parrain-client', '/parrainage/mon-compte-parrain', '/parrainage/inscrire-filleul', '/parrainage/mes-filleuls', '/parrainage/mes-points'].includes(item.path)
        );
    }
    if (currentUser?.role === 'provider') {
      return navItems.filter(item => item.path !== '/demo-accounts' && !item.path.startsWith('/admin/') && (item.path === '/parrainage/mes-filleuls' || !item.path.startsWith('/parrainage/')));
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
        '/admin/rewards'
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
      '/admin/rewards'
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
                    <img src={companySettings.logoUrl} alt="Logo" className="w-full h-full object-contain" />
                 </div>
            ) : (
                <div className="w-20 h-20 rounded-full bg-white border-2 border-brand-orange flex items-center justify-center mb-2 shadow-sm overflow-hidden">
                   <span className="text-brand-blue font-bold text-xs text-center">PRESTA<br/>SERVICES<br/>ANTILLES</span>
                </div>
            )}
            <h1 className={`text-lg font-serif font-bold text-center ${isSoberMode ? 'text-white' : 'text-slate-800'}`}>SIMPLIFIEZ</h1>
            <p className={`text-xs text-center ${isSoberMode ? 'text-slate-300' : 'text-slate-500'}`}>VOTRE QUOTIDIEN</p>

            <button
              type="button"
              onClick={() => toggleSoberMode()}
              className={`mt-4 w-full px-3 py-2 rounded-lg text-xs font-bold border transition ${isSoberMode
                ? 'bg-slate-800 text-slate-100 border-slate-700 hover:bg-slate-700'
                : 'bg-white/70 text-slate-700 border-beige-200 hover:bg-white'}`}
            >
              Mode sobre : {isSoberMode ? 'Activé' : 'Désactivé'}
            </button>
          </div>

          <nav className="flex-1 px-4 space-y-1 overflow-y-auto pb-4">
            {filteredNavItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => { if(window.innerWidth < 768) onClose(); }}
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
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </nav>
          
          <div className="p-4 border-t border-beige-200 shrink-0">
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
