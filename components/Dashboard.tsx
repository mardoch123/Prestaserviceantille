import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import PageLoader from './PageLoader';
import { DashboardViewMode } from '../types';
import StatCard from './StatCard';
import { TurnoverChart, ClientsChart, MissionsChart } from './Charts';
import { useData } from '../context/DataContext';
import AdminVideoSupervisor from './AdminVideoSupervisor';
import { getServiceTypeFromText, matchesServiceTypeFilterFromText } from '../utils/serviceTypes';
import { 
    getMartiniqueNow,
    toMartiniqueTime
} from '../src/utils/dayjsMartinique';
import dayjs from 'dayjs';
import { MARTINIQUE_TIMEZONE } from '../src/utils/dayjsMartinique';

import { 
    ChevronDown, 
    Euro, 
    FileText, 
    CheckCircle, 
    UserPlus, 
    Package, 
    Clock, 
    Briefcase, 
    Users, 
    Wallet, 
    AlertCircle,
    XCircle,
    Video,
    Wifi,
    MapPin,
    Phone,
    Eye,
    ArrowRight
} from 'lucide-react';
import { GlobalSearchBar } from './GlobalSearchBar';

const Dashboard: React.FC = () => {

  const [viewMode, setViewMode] = useState<DashboardViewMode>(DashboardViewMode.COMMERCIAL);
  const [timeFilter, setTimeFilter] = useState<string>('month');
  const [providerFilter, setProviderFilter] = useState<string>('');
  const [showVideoSupervisor, setShowVideoSupervisor] = useState(false);
  const navigate = useNavigate();
  const { missions, documents, clients, providers, activeStream, currentUser, serviceTypeFilter, dataLoading } = useData();

  const isSuperAdmin = currentUser?.role === 'super_admin';

  // --- DATA CALCULATION FOR CHARTS ---

  // Fonction pour filtrer les données selon le filtre temporel
  const filterDataByTime = (items: any[], dateField: string = 'date') => {
    if (!timeFilter || timeFilter === 'all') return items;

    const now = getMartiniqueNow();

    const parseToMartinique = (value: any) => {
      if (!value) return null;
      const raw = typeof value === 'string' ? value.trim() : value;
      if (typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw)) {
        return dayjs.tz(raw, 'YYYY-MM-DD', MARTINIQUE_TIMEZONE);
      }
      return toMartiniqueTime(raw);
    };
    
    switch (timeFilter) {
      case 'day':
        return items.filter(item => {
          if (!item[dateField]) return false;
          const itemDate = parseToMartinique(item[dateField]);
          if (!itemDate) return false;
          return itemDate.isSame(now, 'day');
        });
      
      case 'week':
        {
        // Fix: Use Monday as start of week (Martinique/European format)
        const dayOfWeek = now.day() === 0 ? 6 : now.day() - 1; // 0=Monday, 6=Sunday
        const weekStart = now.subtract(dayOfWeek, 'day').startOf('day');
        const weekEnd = weekStart.add(6, 'day').endOf('day');
        
        return items.filter(item => {
          if (!item[dateField]) return false;
          const itemDate = parseToMartinique(item[dateField]);
          if (!itemDate) return false;
          return itemDate.valueOf() >= weekStart.valueOf() && itemDate.valueOf() <= weekEnd.valueOf();
        });
        }
      
      case 'month':
        {
        const monthStart = now.startOf('month');
        const monthEnd = now.endOf('month');
        
        return items.filter(item => {
          if (!item[dateField]) return false;
          const itemDate = parseToMartinique(item[dateField]);
          if (!itemDate) return false;
          return itemDate.valueOf() >= monthStart.valueOf() && itemDate.valueOf() <= monthEnd.valueOf();
        });
        }
      
      case 'year':
        {
        const yearStart = now.startOf('year');
        const yearEnd = now.endOf('year');
        
        return items.filter(item => {
          if (!item[dateField]) return false;
          const itemDate = parseToMartinique(item[dateField]);
          if (!itemDate) return false;
          return itemDate.valueOf() >= yearStart.valueOf() && itemDate.valueOf() <= yearEnd.valueOf();
        });
        }
      
      default:
        return items;
    }
  };

  const normalizeMissionStatus = (value: any) => {
    const raw = String(value || '').trim();
    const plain = raw
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/-+/g, '_');
    if (plain === 'in_progress' || plain === 'inprogress' || plain === 'en_cours' || plain === 'encours' || plain === 'demarree' || plain === 'demarre') return 'in_progress';
    if (plain === 'completed' || plain === 'complete' || plain === 'terminee' || plain === 'termine' || plain === 'done' || plain === 'finished') return 'completed';
    if (plain === 'cancelled' || plain === 'canceled' || plain === 'annulee' || plain === 'annule') return 'cancelled';
    if (plain === 'planned' || plain === 'planifiee' || plain === 'planifie') return 'planned';
    return 'planned';
  };

  // Données filtrées par type de service (global)
  const serviceFilteredMissions = useMemo(() => {
    return missions.filter(m => matchesServiceTypeFilterFromText(m.service, serviceTypeFilter));
  }, [missions, serviceTypeFilter]);

  const serviceFilteredDocuments = useMemo(() => {
    return documents.filter(d => {
      if (!serviceTypeFilter || serviceTypeFilter === 'all') return true;
      const category = String((d as any)?.category || '').trim().toLowerCase();
      const persisted = String((d as any)?.serviceType || (d as any)?.service_type || '').trim();
      if (serviceTypeFilter === 'Personnalisé') return persisted === 'Personnalisé' || category === 'custom';
      return persisted === serviceTypeFilter;
    });
  }, [documents, serviceTypeFilter]);

  // Données filtrées par temps
  const filteredMissions = useMemo(() => {
    const list = filterDataByTime(serviceFilteredMissions);
    if (!timeFilter || timeFilter === 'all') return list;
    const inProgress = serviceFilteredMissions.filter(m => normalizeMissionStatus((m as any)?.status) === 'in_progress');
    const completed = serviceFilteredMissions.filter(m => normalizeMissionStatus((m as any)?.status) === 'completed');
    const byId = new Map<string, any>();
    list.forEach((m: any) => byId.set(String(m?.id || ''), m));
    inProgress.forEach((m: any) => byId.set(String(m?.id || ''), m));
    completed.forEach((m: any) => byId.set(String(m?.id || ''), m));
    return Array.from(byId.values());
  }, [serviceFilteredMissions, timeFilter]);
  const filteredDocuments = useMemo(() => filterDataByTime(serviceFilteredDocuments), [serviceFilteredDocuments, timeFilter]);
  const filteredClients = useMemo(() => filterDataByTime(clients, 'since'), [clients, timeFilter]);

  // Données filtrées par prestataire
  const missionsFilteredByProvider = useMemo(() => {
    if (!providerFilter) return filteredMissions;
    return filteredMissions.filter(m => String(m.providerId || '') === String(providerFilter));
  }, [filteredMissions, providerFilter]);

  // Documents filtrés par prestataire (basé sur les missions associées)
  const documentsFilteredByProvider = useMemo(() => {
    if (!providerFilter) return filteredDocuments;
    // Filtrer les documents qui sont liés aux missions du prestataire sélectionné
    const providerMissionIds = missionsFilteredByProvider.map(m => m.sourceDocumentId).filter(Boolean);
    return filteredDocuments.filter(doc => providerMissionIds.includes(doc.id));
  }, [filteredDocuments, missionsFilteredByProvider, providerFilter]);

  // Clients filtrés par prestataire (basé sur les missions associées)
  const clientsFilteredByProvider = useMemo(() => {
    if (!providerFilter) return filteredClients;
    // Filtrer les clients qui ont des missions avec le prestataire sélectionné
    const providerClientIds = [...new Set(missionsFilteredByProvider.map(m => m.clientId).filter(Boolean))];
    return filteredClients.filter(client => providerClientIds.includes(client.id));
  }, [filteredClients, missionsFilteredByProvider, providerFilter]);

  // 1. Turnover Data (Last 6 months from Documents)
  const turnoverData = useMemo(() => {
    const months = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
    const currentMonth = toMartiniqueTime(new Date()).month();
    const data: { name: string; ca: number; monthIndex: number }[] = [];

    // Create last 6 months placeholders
    for (let i = 5; i >= 0; i--) {
        let mIndex = currentMonth - i;
        if (mIndex < 0) mIndex += 12;
        data.push({ name: months[mIndex], ca: 0, monthIndex: mIndex });
    }

    // Aggregate Factures (Billed Revenue) - Utiliser les documents filtrés par prestataire
    documentsFilteredByProvider.forEach(doc => {
        // We count all valid invoices for Turnover stats (CA Facturé)
        if (doc.type === 'Facture' && doc.status !== 'rejected' && doc.date) {
            const docDate = new Date(doc.date);
            const docMonth = docDate.getMonth();
            const found = data.find(d => d.monthIndex === docMonth);
            if (found) {
                found.ca += doc.totalTTC; // Fixed: Use totalTTC for consistency
            }
        }
    });

    return data.map(d => ({ ...d, ca: Number(d.ca.toFixed(0)) }));
  }, [documentsFilteredByProvider]);

  // 2. Clients Data (Status distribution) - Utiliser les clients filtrés par prestataire
  const clientsData = useMemo(() => {
      const active = clientsFilteredByProvider.filter(c => c.status === 'active').length;
      const newItem = clientsFilteredByProvider.filter(c => c.status === 'new').length;
      const prospect = clientsFilteredByProvider.filter(c => c.status === 'prospect').length;
      return [
          { name: 'Actifs', value: active },
          { name: 'Nouveaux', value: newItem },
          { name: 'Prospects', value: prospect },
      ];
  }, [clientsFilteredByProvider]);

  // 3. Missions Data (Service distribution) - Utiliser les missions filtrées par prestataire
  const missionsData = useMemo(() => {
      const counts: Record<string, number> = {};
      missionsFilteredByProvider.forEach(m => {
          const key = getServiceTypeFromText(m.service || '');
          counts[key] = (counts[key] || 0) + 1;
      });

      return Object.keys(counts).map(key => ({ name: key, value: counts[key] }));
  }, [missionsFilteredByProvider]);

  // Calculate missing providers - Utiliser les missions filtrées
  const missingProvidersCount = missionsFilteredByProvider.filter(m => 
      m.status === 'planned' && 
      (!m.providerId || m.providerId === 'null' || m.providerName === 'À assigner')
  ).length;

  const totalWorkedHours = useMemo(() => {
    const total = missionsFilteredByProvider
      .filter(m => m.status === 'completed' || m.status === 'in_progress')
      .reduce((acc, m) => acc + (Number(m.duration) || 0), 0);
    return Number.isFinite(total) ? total : 0;
  }, [missionsFilteredByProvider]);

  // KPI Calculations - Utiliser les données filtrées
  
  // 1. Total Revenue (Cash Collected) - Utiliser les documents filtrés par prestataire
  const totalRevenue = documentsFilteredByProvider.filter(d => d.status === 'paid').reduce((acc, d) => acc + d.totalTTC, 0);
  
  // 2. Pending Revenue (Accounts Receivable + Signed Quotes) - Utiliser les documents filtrés par prestataire
  // This represents money that is expected to come in:
  // - Factures emitted but not paid (pending)
  // - Devis signed but not yet converted/invoiced (committed revenue)
  const pendingRevenue = documentsFilteredByProvider.reduce((acc, d) => {
      const isPendingInvoice = d.type === 'Facture' && d.status === 'pending';
      const isSignedQuote = d.type === 'Devis' && d.status === 'signed';

      if (isPendingInvoice || isSignedQuote) {
          return acc + d.totalTTC;
      }
      return acc;
  }, 0);

  const signedQuotes = documentsFilteredByProvider.filter(d => d.type === 'Devis' && d.status === 'signed').length;
  const sentQuotes = documentsFilteredByProvider.filter(d => d.type === 'Devis' && d.status === 'sent').length;

  // Navigation Handlers
  const goToStats = (status: 'all' | 'in_progress' | 'completed' | 'planned' | 'cancelled') => {
    navigate('/statistics', { 
      state: { 
        filter: status,
        time: timeFilter 
      } 
    });
  };

  const goToClients = (filter: 'all' | 'new') => {
    navigate('/clients', { state: { time: timeFilter } });
  };

  const goToInvoices = (filter: 'all' | 'sent' | 'signed' | 'expired') => {
    navigate('/invoices', { state: { filter, time: timeFilter } });
  };

  const goToProviders = (filter: 'all' | 'active' | 'passive') => {
    navigate('/providers', { state: { time: timeFilter } });
  };

  const goToFinancials = (filter: 'all' | 'pending' | 'paid' | 'refund') => {
    navigate('/financials', { state: { filter, time: timeFilter } });
  };

  // Define content based on viewMode
  const getCards = () => {
    switch (viewMode) {
      case DashboardViewMode.COMMERCIAL:
        return (
          <>
            {isSuperAdmin && (
              <StatCard 
                title="Chiffre d'affaire" 
                value={`${totalRevenue.toFixed(0)}€`}
                subtext="Encaissé (Global)" 
                bgColor="bg-slate-100" 
                icon={Euro}
                onClick={() => goToStats('all')} 
              />
            )}
            <StatCard 
              title="Devis envoyés" 
              value={sentQuotes}
              bgColor="bg-slate-100" 
              icon={FileText}
              onClick={() => goToInvoices('sent')}
            />
            <StatCard 
              title="Devis signés" 
              value={signedQuotes} 
              bgColor="bg-slate-100" 
              icon={CheckCircle}
              onClick={() => goToInvoices('signed')}
            />
            <StatCard 
              title="Nouveaux clients" 
              value={clientsFilteredByProvider.filter(c => c.status === 'new').length}
              subtext="À traiter" 
              bgColor="bg-slate-100" 
              icon={UserPlus}
              onClick={() => goToClients('new')}
            />
            <StatCard 
              title="Pack Best Seller" 
              value="Pack Zen" 
              bgColor="bg-slate-100" 
              icon={Package}
            />
            <StatCard 
              title="Devis expirés" 
              value={documentsFilteredByProvider.filter(d => d.status === 'expired').length}
              bgColor="bg-slate-100" 
              icon={Clock}
              onClick={() => goToInvoices('expired')}
            />
          </>
        );
      case DashboardViewMode.TRACKING:
        return (
          <>
            <StatCard 
              title="Missions planifiées" 
              value={missionsFilteredByProvider.filter(m => normalizeMissionStatus((m as any)?.status) === 'planned').length}
              bgColor="bg-slate-100" 
              icon={Clock}
              onClick={() => goToStats('planned')}
            />
            <StatCard 
              title="Missions en cours" 
              value={missionsFilteredByProvider.filter(m => normalizeMissionStatus((m as any)?.status) === 'in_progress').length} 
              bgColor="bg-slate-100" 
              icon={Briefcase}
              onClick={() => navigate('/reports', { state: { initialTab: 'in_progress', time: timeFilter } })} 
            />
            <StatCard 
              title="Missions terminées" 
              value={missionsFilteredByProvider.filter(m => normalizeMissionStatus((m as any)?.status) === 'completed').length} 
              bgColor="bg-slate-100" 
              icon={CheckCircle}
              onClick={() => goToStats('completed')}
            />
            <StatCard 
              title="Missions annulées" 
              value={missionsFilteredByProvider.filter(m => normalizeMissionStatus((m as any)?.status) === 'cancelled').length} 
              bgColor="bg-red-50" 
              icon={XCircle}
              onClick={() => goToStats('cancelled')}
            />
            <StatCard 
              title="Mission sans prestataire" 
              value={missingProvidersCount} 
              subtext={missingProvidersCount > 0 ? "Urgent : À assigner" : "Planning à jour"}
              bgColor={missingProvidersCount > 0 ? "bg-red-100 border-red-200 animate-pulse" : "bg-green-50"} 
              icon={AlertCircle}
              onClick={() => navigate('/planning')}
            />
            <div className="invisible"></div> 
          </>
        );
      case DashboardViewMode.PROVIDERS:
        return (
          <>
            <StatCard 
              title="Prestataires actifs" 
              value={providers.filter(p => p.status === 'Active').length} 
              bgColor="bg-slate-100" 
              icon={Users}
              onClick={() => goToProviders('active')}
            />
            <StatCard 
              title="Prestataires passifs" 
              value={providers.filter(p => p.status === 'Passive').length}
              bgColor="bg-slate-100" 
              icon={Users}
              onClick={() => goToProviders('passive')}
            />
            <StatCard 
              title="Nombre d'heures cumulées" 
              value={`${totalWorkedHours.toFixed(2)}h`} 
              bgColor="bg-slate-100" 
              icon={Clock}
              onClick={() => goToProviders('all')}
            />
          </>
        );
      case DashboardViewMode.FINANCIAL:
        return (
          <>
            {isSuperAdmin ? (
              <>
                <StatCard 
                  title="Recette à encaisser" 
                  value={`${pendingRevenue.toFixed(0)}€`} 
                  subtext="Factures en attente + Devis signés"
                  bgColor="bg-slate-100" 
                  icon={Wallet}
                  onClick={() => goToFinancials('pending')}
                />
                <StatCard 
                  title="Recette encaissée" 
                  value={`${totalRevenue.toFixed(0)}€`} 
                  bgColor="bg-slate-100" 
                  icon={Euro}
                  onClick={() => goToFinancials('paid')}
                />
                <StatCard 
                  title="Remboursements" 
                  value="0€" 
                  bgColor="bg-slate-100" 
                  icon={Euro}
                  onClick={() => goToFinancials('refund')}
                />
              </>
            ) : (
              <div className="col-span-full bg-white border border-slate-200 rounded-xl p-4 text-sm text-slate-600 font-semibold">
                Accès réservé au Super Admin.
              </div>
            )}
          </>
        );
      default:
        return null;
    }
  };

  return dataLoading ? <PageLoader /> : (
    <div className="p-8 h-full overflow-y-auto bg-white/40 pb-4 md:pb-8">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8">
        <h2 className="text-3xl font-serif font-bold text-slate-800">Tableau de bord</h2>
        
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto items-center">
            <GlobalSearchBar />
            
            <div className="relative">
                <select 
                  className="w-full sm:w-auto appearance-none bg-white border border-beige-300 rounded-md py-2 pl-4 pr-10 text-sm focus:outline-none focus:border-beige-500 shadow-sm cursor-pointer"
                  value={timeFilter}
                  onChange={(e) => setTimeFilter(e.target.value)}
                >
                    <option value="all">Toutes (fenêtre chargée)</option>
                    <option value="custom">Date personnalisée</option>
                    <option value="day">Aujourd'hui</option>
                    <option value="week">Cette semaine</option>
                    <option value="month">Ce mois</option>
                    <option value="year">Cette année</option>
                </select>
                <ChevronDown className="w-4 h-4 absolute right-3 top-3 text-slate-400 pointer-events-none" />
            </div>
             <div className="relative">
                <select 
                  className="w-full sm:w-auto appearance-none bg-white border border-beige-300 rounded-md py-2 pl-4 pr-10 text-sm focus:outline-none focus:border-beige-500 shadow-sm cursor-pointer"
                  value={providerFilter}
                  onChange={(e) => setProviderFilter(e.target.value)}
                >
                    <option value="">Tous les prestataires</option>
                    {providers.map(p => <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>)}
                </select>
                <ChevronDown className="w-4 h-4 absolute right-3 top-3 text-slate-400 pointer-events-none" />
            </div>
        </div>
      </div>

      {/* View Selector Dropdown */}
      <div className="relative mb-6 w-full sm:max-w-md">
        <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
          <ChevronDown className="h-4 w-4 text-slate-500" />
        </div>
        <select
          value={viewMode}
          onChange={(e) => setViewMode(e.target.value as DashboardViewMode)}
          className="block appearance-none w-full bg-white border border-slate-300 hover:border-slate-400 px-4 py-2 pr-8 rounded shadow leading-tight focus:outline-none focus:shadow-outline font-semibold text-slate-700 cursor-pointer"
        >
          {Object.values(DashboardViewMode).map((mode, index) => (
            <option key={mode} value={mode}>{`${index + 1}. ${mode}`}</option>
          ))}
        </select>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {getCards()}
      </div>

      {/* Charts Section */}
      <div className="bg-slate-50 p-4 sm:p-6 rounded-2xl border border-slate-100">
        <h3 className="text-sm font-bold text-slate-700 mb-4">Statistiques graphiques (Temps Réel)</h3>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-8 min-h-[200px] lg:h-48">
            <div className="flex flex-col items-center">
                <div className="w-full h-32 lg:h-40">
                    {isSuperAdmin ? (
                      <TurnoverChart data={turnoverData} />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-white border border-slate-200 rounded-xl text-xs text-slate-500 font-bold">
                        Accès CA réservé au Super Admin
                      </div>
                    )}
                </div>
                <span className="text-xs text-slate-500 italic mt-2">Évolution CA (6 derniers mois)</span>
            </div>
            <div className="flex flex-col items-center">
                <div className="w-full h-32 lg:h-40">
                    <ClientsChart data={clientsData} />
                </div>
                <span className="text-xs text-slate-500 italic mt-2">Répartition Clients</span>
            </div>
            <div className="flex flex-col items-center">
                <div className="w-full h-32 lg:h-40">
                    <MissionsChart data={missionsData} />
                </div>
                <span className="text-xs text-slate-500 italic mt-2">Types de Missions</span>
            </div>
        </div>
      </div>

      {/* Video Supervision Section - Admin Only */}
      {currentUser?.role === 'admin' && (
        <div className="mt-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Video className="w-5 h-5" />
              Supervision Vidéo
            </h3>
            {activeStream && (
              <button
                onClick={() => setShowVideoSupervisor(!showVideoSupervisor)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                  showVideoSupervisor 
                    ? 'bg-slate-600 text-white hover:bg-slate-700' 
                    : 'bg-red-600 text-white hover:bg-red-700 animate-pulse'
                }`}
              >
                <Wifi className="w-4 h-4" />
                {showVideoSupervisor ? 'Masquer' : 'Superviser'}
              </button>
            )}
          </div>
          
          {showVideoSupervisor && <AdminVideoSupervisor onClose={() => setShowVideoSupervisor(false)} />}
        </div>
      )}

      {/* Providers on the Field Section */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-emerald-500" />
            Prestataires sur le terrain
          </h3>
          <button
            onClick={() => navigate('/planning')}
            className="text-sm text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-1"
          >
            Voir le planning <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {(() => {
          // Get missions in progress with provider info
          const activeMissions = missions.filter(m => 
            matchesServiceTypeFilterFromText(m.service, serviceTypeFilter) &&
            normalizeMissionStatus((m as any)?.status) === 'in_progress'
          );

          if (activeMissions.length === 0) {
            return (
              <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
                <div className="w-16 h-16 mx-auto mb-4 bg-slate-100 rounded-full flex items-center justify-center">
                  <Briefcase className="w-8 h-8 text-slate-300" />
                </div>
                <p className="text-slate-500">Aucune mission en cours actuellement</p>
              </div>
            );
          }

          return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeMissions.map(mission => {
                const provider = providers.find(p => p.id === mission.providerId);
                const client = clients.find(c => c.id === mission.clientId);
                
                return (
                  <div 
                    key={mission.id} 
                    onClick={() => navigate('/planning', { state: { selectedMissionId: mission.id, selectedDate: mission.date } })}
                    className="bg-white rounded-xl border border-slate-200 p-4 cursor-pointer hover:shadow-lg hover:border-emerald-300 transition-all group"
                  >
                    {/* Header - Provider Info */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-bold text-sm">
                          {provider ? `${provider.firstName.charAt(0)}${provider.lastName.charAt(0)}` : '?'}
                        </div>
                        <div>
                          <p className="font-bold text-slate-800">
                            {provider ? `${provider.firstName} ${provider.lastName}` : 'Prestataire non assigné'}
                          </p>
                          <p className="text-xs text-slate-500">{mission.service}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-bold animate-pulse">
                        <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                        En cours
                      </div>
                    </div>

                    {/* Client Info */}
                    <div className="bg-slate-50 rounded-lg p-3 mb-3">
                      <p className="text-xs text-slate-500 uppercase font-bold mb-1">Client</p>
                      <p className="font-medium text-slate-800">{mission.clientName}</p>
                      <div className="flex items-center gap-1 text-sm text-slate-600 mt-1">
                        <MapPin className="w-3 h-3" />
                        <span className="truncate">
                          {client?.address || 'Adresse non renseignée'}{client?.city ? `, ${client.city}` : ''}
                        </span>
                      </div>
                      {client?.phone && (
                        <div className="flex items-center gap-1 text-sm text-slate-600 mt-1">
                          <Phone className="w-3 h-3" />
                          <span>{client.phone}</span>
                        </div>
                      )}
                    </div>

                    {/* Mission Time */}
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-1 text-slate-600">
                        <Clock className="w-4 h-4" />
                        <span>{mission.startTime} - {mission.endTime}</span>
                      </div>
                      <button className="text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Eye className="w-4 h-4" />
                        Détails
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}
      </div>
    </div>
  );
};

export default Dashboard;
