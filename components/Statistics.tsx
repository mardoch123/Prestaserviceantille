import React, { useState, useMemo, useEffect } from 'react';
import PageLoader from './PageLoader';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Calendar,
  Filter,
  CheckCircle,
  Clock,
  XCircle,
  TrendingUp,
  AlertTriangle,
  Search,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  UserCircle,
  MapPin,
  Phone,
  Package,
  DollarSign,
  Briefcase,
  Award,
  X,
  FileText,
  Eye
} from 'lucide-react';
import { useData } from '../context/DataContext';
import { matchesServiceTypeFilterFromText } from '../utils/serviceTypes';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { getMartiniqueToday, MARTINIQUE_TIMEZONE } from '../src/utils/martiniqueTime';

dayjs.extend(utc);
dayjs.extend(timezone);

// --- Types & Mock Data ---

type TimeFilter = 'day' | 'week' | 'month' | 'year';
type StatusFilter = 'all' | 'in_progress' | 'completed' | 'planned' | 'cancelled';

const StatCard: React.FC<{ 
  title: string; 
  value: number; 
  icon: any; 
  colorClass: string; 
  isActive: boolean; 
  onClick: () => void;
  subtext?: string;
}> = ({ title, value, icon: Icon, colorClass, isActive, onClick, subtext }) => (
  <div 
    onClick={onClick}
    className={`p-6 rounded-xl border cursor-pointer transition-all duration-200 ${
      isActive 
        ? `bg-white border-${colorClass.split('-')[1]}-500 shadow-md scale-105 ring-1 ring-${colorClass.split('-')[1]}-500` 
        : 'bg-slate-50/50 border-slate-200 hover:bg-white hover:shadow-sm'
    }`}
  >
    <div className="flex justify-between items-start mb-2">
      <div className={`p-2 rounded-lg ${colorClass} bg-opacity-10`}>
        <Icon className={`w-6 h-6 ${colorClass.replace('bg-', 'text-')}`} />
      </div>
      <span className={`text-2xl font-bold ${isActive ? 'text-slate-800' : 'text-slate-600'}`}>{value}</span>
    </div>
    <h3 className="text-sm font-bold text-slate-700">{title}</h3>
    {subtext && <p className="text-xs text-slate-400 mt-1">{subtext}</p>}
  </div>
);

const Statistics: React.FC = () => {
  const { missions, documents, serviceTypeFilter, dataLoading, clients, providers } = useData();
  const navigate = useNavigate();
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('month');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const location = useLocation();

  // Modal states
  const [selectedClient, setSelectedClient] = useState<typeof clients[0] | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<typeof providers[0] | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<typeof documents[0] | null>(null);
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [isProviderModalOpen, setIsProviderModalOpen] = useState(false);
  const [isDocumentModalOpen, setIsDocumentModalOpen] = useState(false);

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

  // --- PAGINATION & FILTERS STATE ---
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Advanced Filters State
  const [filters, setFilters] = useState({
      clientName: '',
      service: '',
      date: '',
      providerName: '',
      status: 'all',
      amountMin: '',
      amountMax: ''
  });

  // Handle navigation from Dashboard
  useEffect(() => {
    if (location.state) {
        const state = location.state as { filter?: string, time?: string };
        if (state.filter && ['all', 'in_progress', 'completed', 'planned', 'cancelled'].includes(state.filter)) {
            setStatusFilter(state.filter as StatusFilter);
        }
        if (state.time && ['day', 'week', 'month', 'year'].includes(state.time)) {
            setTimeFilter(state.time as TimeFilter);
        }
    }
  }, [location]);

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const { name, value } = e.target;
      setFilters(prev => ({ ...prev, [name]: value }));
      setCurrentPage(1); // Reset to first page on filter change
  };

  // Helper for week range
  const getWeekRange = () => {
      const now = dayjs().tz(MARTINIQUE_TIMEZONE);
      // Fix: Monday-based week (European format)
      const dayOfWeek = now.day() === 0 ? 6 : now.day() - 1; // 0=Monday, 6=Sunday
      const start = now.subtract(dayOfWeek, 'day').startOf('day');
      const end = start.add(6, 'day').endOf('day');
      return { start, end };
  };

  // Helper functions for getting entity info
  const getClientInfo = (clientId?: string | null) => {
    if (!clientId) return null;
    return clients.find(c => String(c.id) === String(clientId)) || null;
  };

  const getProviderInfo = (providerId?: string | null) => {
    if (!providerId) return null;
    return providers.find(p => String(p.id) === String(providerId)) || null;
  };

  const getDocumentInfo = (documentId?: string | null) => {
    if (!documentId) return null;
    return documents.find(d => String(d.id) === String(documentId)) || null;
  };

  // Calculate REAL statistics for a client from database
  const calculateClientStats = (clientId: string) => {
    const clientMissions = missions.filter(m => String(m.clientId) === String(clientId));
    const totalMissions = clientMissions.length;
    const completedMissions = clientMissions.filter(m => m.status === 'completed').length;
    const cancelledMissions = clientMissions.filter(m => m.status === 'cancelled').length;
    const totalRevenue = clientMissions.reduce((acc, m) => {
      const doc = getDocumentInfo(m.sourceDocumentId);
      const amount = doc?.totalTTC || doc?.unitPrice || (m.duration || 2) * 40;
      if (m.status === 'cancelled' && !m.lateCancellation) return acc;
      if (m.status === 'cancelled' && m.lateCancellation) return acc + amount * 0.5;
      if (m.status === 'completed') return acc + amount;
      return acc;
    }, 0);

    return { totalMissions, completedMissions, cancelledMissions, totalRevenue };
  };

  // Calculate REAL statistics for a provider from database
  const calculateProviderStats = (providerId: string) => {
    const providerMissions = missions.filter(m => String(m.providerId) === String(providerId));
    const totalMissions = providerMissions.length;
    const completedMissions = providerMissions.filter(m => m.status === 'completed').length;
    const inProgressMissions = providerMissions.filter(m => m.status === 'in_progress').length;
    const totalHours = providerMissions.reduce((acc, m) => acc + (m.duration || 0), 0);

    return { totalMissions, completedMissions, inProgressMissions, totalHours };
  };

  // Modal handlers
  const openClientModal = (clientId?: string | null) => {
    const client = getClientInfo(clientId);
    if (client) {
      setSelectedClient(client);
      setIsClientModalOpen(true);
    }
  };

  const openProviderModal = (providerId?: string | null) => {
    const provider = getProviderInfo(providerId);
    if (provider) {
      setSelectedProvider(provider);
      setIsProviderModalOpen(true);
    }
  };

  const openDocumentModal = (mission: any) => {
    const doc = getDocumentInfo(mission.sourceDocumentId);
    if (doc) {
      setSelectedDocument(doc);
      setIsDocumentModalOpen(true);
    }
  };

  const closeClientModal = () => {
    setIsClientModalOpen(false);
    setTimeout(() => setSelectedClient(null), 300);
  };

  const closeProviderModal = () => {
    setIsProviderModalOpen(false);
    setTimeout(() => setSelectedProvider(null), 300);
  };

  const closeDocumentModal = () => {
    setIsDocumentModalOpen(false);
    setTimeout(() => setSelectedDocument(null), 300);
  };

  const navigateToDocument = (docId: string) => {
    navigate('/invoices', { state: { documentId: docId, filter: 'devis' } });
    closeDocumentModal();
  };

  // Filter Logic
  const filteredData = useMemo(() => {
    let data = missions.filter(m => matchesServiceTypeFilterFromText(m.service, serviceTypeFilter)); 

    // 1. Time Filter (Global)
    if (timeFilter === 'day') {
        const todayStr = getMartiniqueToday();
        data = data.filter(m => m.date === todayStr);
    } else if (timeFilter === 'week') {
        const { start, end } = getWeekRange();
        data = data.filter(m => {
            const mDate = dayjs.tz(m.date, 'YYYY-MM-DD', MARTINIQUE_TIMEZONE);
            return mDate.valueOf() >= start.valueOf() && mDate.valueOf() <= end.valueOf();
        });
    } else if (timeFilter === 'month') {
        const nowM = dayjs().tz(MARTINIQUE_TIMEZONE);
        const currentMonth = nowM.month();
        const currentYear = nowM.year();
        data = data.filter(m => {
            const mDate = dayjs.tz(m.date, 'YYYY-MM-DD', MARTINIQUE_TIMEZONE);
            return mDate.month() === currentMonth && mDate.year() === currentYear;
        });
    } else if (timeFilter === 'year') {
        const currentYear = dayjs().tz(MARTINIQUE_TIMEZONE).year();
        data = data.filter(m => dayjs.tz(m.date, 'YYYY-MM-DD', MARTINIQUE_TIMEZONE).year() === currentYear);
    }

    // 2. Status Card Filter
    if (statusFilter !== 'all') {
        data = data.filter(m => normalizeMissionStatus(m.status) === statusFilter);
    }

    // 3. Advanced Column Filters
    if (filters.clientName) {
        data = data.filter(m => m.clientName.toLowerCase().includes(filters.clientName.toLowerCase()));
    }
    if (filters.service) {
        data = data.filter(m => m.service.toLowerCase().includes(filters.service.toLowerCase()));
    }
    if (filters.date) {
        data = data.filter(m => m.date === filters.date);
    }
    if (filters.providerName) {
        data = data.filter(m => (m.providerName || '').toLowerCase().includes(filters.providerName.toLowerCase()));
    }
    if (filters.status !== 'all') {
        data = data.filter(m => normalizeMissionStatus(m.status) === String(filters.status));
    }
    if (filters.amountMin) {
        data = data.filter(m => ((m.duration || 2) * 40) >= Number(filters.amountMin));
    }
    if (filters.amountMax) {
        data = data.filter(m => ((m.duration || 2) * 40) <= Number(filters.amountMax));
    }

    return data;
  }, [timeFilter, statusFilter, missions, filters, serviceTypeFilter]);

  // Pagination Logic
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const paginatedData = useMemo(() => {
      const start = (currentPage - 1) * itemsPerPage;
      return filteredData.slice(start, start + itemsPerPage);
  }, [filteredData, currentPage]);

  // Calculate Stats based on Time Filter (Contextual)
  const stats = useMemo(() => {
    // We compute stats on the data filtered by TIME only, ignoring column filters for the cards context
    let baseData = missions.filter(m => matchesServiceTypeFilterFromText(m.service, serviceTypeFilter));
    
    if (timeFilter === 'day') {
        const todayStr = getMartiniqueToday();
        baseData = baseData.filter(m => m.date === todayStr);
    } else if (timeFilter === 'week') {
        const { start, end } = getWeekRange();
        baseData = baseData.filter(m => {
            const d = dayjs.tz(m.date, 'YYYY-MM-DD', MARTINIQUE_TIMEZONE);
            return d.valueOf() >= start.valueOf() && d.valueOf() <= end.valueOf();
        });
    } else if (timeFilter === 'month') {
        const nowM = dayjs().tz(MARTINIQUE_TIMEZONE);
        baseData = baseData.filter(m => {
            const d = dayjs.tz(m.date, 'YYYY-MM-DD', MARTINIQUE_TIMEZONE);
            return d.month() === nowM.month() && d.year() === nowM.year();
        });
    } else if (timeFilter === 'year') {
        const nowM = dayjs().tz(MARTINIQUE_TIMEZONE);
        baseData = baseData.filter(m => dayjs.tz(m.date, 'YYYY-MM-DD', MARTINIQUE_TIMEZONE).year() === nowM.year());
    }

    return {
      total: baseData.length,
      inProgress: baseData.filter(m => normalizeMissionStatus(m.status) === 'in_progress').length,
      completed: baseData.filter(m => normalizeMissionStatus(m.status) === 'completed').length,
      planned: baseData.filter(m => normalizeMissionStatus(m.status) === 'planned').length,
      cancelled: baseData.filter(m => normalizeMissionStatus(m.status) === 'cancelled').length,
      lateCancelled: baseData.filter(m => normalizeMissionStatus(m.status) === 'cancelled' && m.lateCancellation).length
    };
  }, [missions, timeFilter, serviceTypeFilter]);

  const totalRevenue = useMemo(() => {
      // Calculate revenue based on the currently filtered list (what the user sees)
      const revenueFromMissions = filteredData.reduce((acc, curr) => {
        const amount = (curr.duration || 2) * 40; // Simulated hourly rate base

        if (curr.status === 'cancelled' && !curr.lateCancellation) return acc;
        
        // If cancelled late, we charge 50%
        if (curr.status === 'cancelled' && curr.lateCancellation) return acc + (amount * 0.5);
        
        if (curr.status === 'completed') return acc + amount;
        
        return acc;
      }, 0);

      // Subtract Refunds from paid negative invoices (global context unless we filter documents too, keeping simple here)
      // Ideally we should filter documents by date too, but sticking to mission based revenue for this view.
      return revenueFromMissions;
  }, [filteredData]);

  return dataLoading ? <PageLoader /> : (
    <div className="p-8 h-full overflow-y-auto bg-white/40">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h2 className="text-3xl font-serif font-bold text-slate-800">Statistiques</h2>
          <p className="text-sm text-slate-500 mt-1">Suivi détaillé des prestations et performances</p>
        </div>
        
        <div className="flex items-center bg-white rounded-lg shadow-sm border border-beige-200 p-1">
          <Filter className="w-4 h-4 text-slate-400 ml-2 mr-2" />
          <select 
            value={timeFilter} 
            onChange={(e) => { setTimeFilter(e.target.value as TimeFilter); setCurrentPage(1); }}
            className="bg-transparent text-sm font-bold text-slate-700 p-2 outline-none cursor-pointer"
          >
            <option value="day">Aujourd'hui</option>
            <option value="week">Cette semaine</option>
            <option value="month">Ce mois</option>
            <option value="year">Cette année</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-6 mb-8">
        <StatCard 
          title="Total Missions" 
          value={stats.total} 
          icon={TrendingUp} 
          colorClass="text-brand-blue bg-brand-blue"
          isActive={statusFilter === 'all'}
          onClick={() => setStatusFilter('all')}
          subtext="Sur la période"
        />
        <StatCard 
          title="En cours" 
          value={stats.inProgress} 
          icon={Clock} 
          colorClass="text-blue-600 bg-blue-600"
          isActive={statusFilter === 'in_progress'}
          onClick={() => setStatusFilter('in_progress')}
          subtext="Démarrées"
        />
        <StatCard 
          title="Terminées" 
          value={stats.completed} 
          icon={CheckCircle} 
          colorClass="text-green-600 bg-green-600"
          isActive={statusFilter === 'completed'}
          onClick={() => setStatusFilter('completed')}
          subtext="Réalisées"
        />
        <StatCard 
          title="Planifiées" 
          value={stats.planned} 
          icon={Clock} 
          colorClass="text-brand-orange bg-brand-orange"
          isActive={statusFilter === 'planned'}
          onClick={() => setStatusFilter('planned')}
          subtext="À venir"
        />
        <StatCard 
          title="Annulées" 
          value={stats.cancelled} 
          icon={XCircle} 
          colorClass="text-red-500 bg-red-500"
          isActive={statusFilter === 'cancelled'}
          onClick={() => setStatusFilter('cancelled')}
          subtext={`Dont ${stats.lateCancelled} tardives`}
        />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-cream-50/50">
          <div>
            <h3 className="font-bold text-slate-800 text-lg">Listing des prestations</h3>
            <p className="text-xs text-slate-500 mt-1">
               {filteredData.length} résultats • Page {currentPage} sur {totalPages || 1}
            </p>
          </div>
          <div className="bg-green-50 px-4 py-2 rounded-lg border border-green-100">
            <span className="text-xs text-green-800 font-bold uppercase tracking-wider">Chiffre d'affaire (Estimé)</span>
            <p className="text-xl font-bold text-green-700">{totalRevenue.toFixed(2)} €</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-500 uppercase bg-slate-50/80 border-b border-slate-100">
              <tr>
                <th className="px-6 py-4 font-bold min-w-[150px]">
                    <div className="flex flex-col gap-2">
                        <span>Date & Heure</span>
                        <input type="date" name="date" value={filters.date} onChange={handleFilterChange} className="p-1 border rounded text-xs font-normal" />
                    </div>
                </th>
                <th className="px-6 py-4 font-bold min-w-[150px]">
                    <div className="flex flex-col gap-2">
                        <span>Client</span>
                        <input type="text" name="clientName" placeholder="Filtrer nom..." value={filters.clientName} onChange={handleFilterChange} className="p-1 border rounded text-xs font-normal" />
                    </div>
                </th>
                <th className="px-6 py-4 font-bold min-w-[150px]">
                    <div className="flex flex-col gap-2">
                        <span>Prestation</span>
                        <input type="text" name="service" placeholder="Filtrer service..." value={filters.service} onChange={handleFilterChange} className="p-1 border rounded text-xs font-normal" />
                    </div>
                </th>
                <th className="px-6 py-4 font-bold min-w-[150px]">
                    <div className="flex flex-col gap-2">
                        <span>Prestataire</span>
                        <input type="text" name="providerName" placeholder="Filtrer pro..." value={filters.providerName} onChange={handleFilterChange} className="p-1 border rounded text-xs font-normal" />
                    </div>
                </th>
                <th className="px-6 py-4 font-bold text-center">
                    <div className="flex flex-col gap-2 items-center">
                        <span>Statut</span>
                        <select name="status" value={filters.status} onChange={handleFilterChange} className="p-1 border rounded text-xs font-normal">
                            <option value="all">Tous</option>
                            <option value="in_progress">En cours</option>
                            <option value="completed">Terminée</option>
                            <option value="planned">Planifiée</option>
                            <option value="cancelled">Annulée</option>
                        </select>
                    </div>
                </th>
                <th className="px-6 py-4 font-bold text-right min-w-[120px]">
                    <div className="flex flex-col gap-2 items-end">
                        <span>Montant (€)</span>
                        <div className="flex gap-1">
                            <input type="number" name="amountMin" placeholder="Min" value={filters.amountMin} onChange={handleFilterChange} className="p-1 border rounded text-xs font-normal w-12" />
                            <input type="number" name="amountMax" placeholder="Max" value={filters.amountMax} onChange={handleFilterChange} className="p-1 border rounded text-xs font-normal w-12" />
                        </div>
                    </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {paginatedData.length > 0 ? (
                paginatedData.map((mission) => {
                    const doc = getDocumentInfo(mission.sourceDocumentId);
                    const baseAmount = doc?.totalTTC || doc?.unitPrice || (mission.duration || 2) * 40;
                    
                    return (
                      <tr key={mission.id} className="hover:bg-cream-50 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="font-bold text-slate-700">{mission.date}</div>
                          <div className="text-xs text-slate-500">{mission.startTime} - {mission.endTime}</div>
                        </td>
                        <td className="px-6 py-4">
                          <button 
                            onClick={() => openClientModal(mission.clientId)}
                            className="font-bold text-slate-700 hover:text-brand-blue transition text-left flex items-center gap-1"
                          >
                            <UserCircle className="w-4 h-4" />
                            {mission.clientName}
                          </button>
                        </td>
                        <td className="px-6 py-4">
                          {mission.sourceDocumentId ? (
                            <button
                              onClick={() => openDocumentModal(mission)}
                              className="bg-blue-50 text-brand-blue px-2 py-1 rounded text-xs font-medium hover:bg-blue-100 transition flex items-center gap-1"
                            >
                              <FileText className="w-3 h-3" />
                              {mission.service}
                            </button>
                          ) : (
                            <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs font-medium">
                              {mission.service}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {mission.providerId ? (
                            <button 
                              onClick={() => openProviderModal(mission.providerId)}
                              className="text-slate-600 hover:text-brand-blue transition text-left flex items-center gap-1"
                            >
                              <span className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600">
                                {mission.providerName?.charAt(0)}
                              </span>
                              {mission.providerName || '-'}
                            </button>
                          ) : (
                            <span className="text-slate-600">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-center">
                          {mission.status === 'completed' && (
                            <span className="inline-flex items-center gap-1 bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-bold border border-green-200">
                              <CheckCircle className="w-3 h-3" /> Terminée
                            </span>
                          )}
                          {mission.status === 'planned' && (
                            <span className="inline-flex items-center gap-1 bg-orange-100 text-brand-orange px-2 py-1 rounded-full text-xs font-bold border border-orange-200">
                              <Clock className="w-3 h-3" /> Planifiée
                            </span>
                          )}
                          {mission.status === 'cancelled' && (
                            <div className="flex flex-col items-center">
                              <span className="inline-flex items-center gap-1 bg-red-100 text-red-800 px-2 py-1 rounded-full text-xs font-bold border border-red-200">
                                <XCircle className="w-3 h-3" /> Annulée
                              </span>
                              {mission.lateCancellation && (
                                <span className="text-[10px] text-red-600 font-bold mt-1 flex items-center gap-1 bg-red-50 px-1 rounded border border-red-100">
                                  <AlertTriangle className="w-3 h-3" /> 50% Facturé
                                </span>
                              )}
                            </div>
                          )}
                          {mission.reminder48hSent && mission.status === 'planned' && (
                              <div className="text-[10px] text-blue-500 font-bold mt-1 text-center">Rappel 48h envoyé</div>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right font-bold text-slate-700">
                          {mission.status === 'cancelled' && mission.lateCancellation 
                            ? <span className="text-red-500">{(baseAmount * 0.5).toFixed(2)} €</span> 
                            : mission.status === 'cancelled' 
                                ? <span className="text-slate-300 line-through">{baseAmount.toFixed(2)} €</span>
                                : <span>{baseAmount.toFixed(2)} €</span>
                          }
                        </td>
                      </tr>
                    );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                    <Search className="w-12 h-12 mx-auto mb-3 opacity-20" />
                    Aucune prestation trouvée pour ces filtres.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {filteredData.length > 0 && (
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
                <div className="text-xs text-slate-500">
                    Affichage de {((currentPage - 1) * itemsPerPage) + 1} à {Math.min(currentPage * itemsPerPage, filteredData.length)} sur {filteredData.length} entrées
                </div>
                <div className="flex gap-2">
                    <button 
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                        className="p-2 rounded hover:bg-white border border-transparent hover:border-slate-200 disabled:opacity-30 transition"
                    >
                        <ChevronLeft className="w-4 h-4 text-slate-600" />
                    </button>
                    <div className="flex items-center gap-1">
                        {Array.from({ length: totalPages }, (_, i) => i + 1)
                            .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                            .map((p, idx, arr) => (
                                <React.Fragment key={p}>
                                    {idx > 0 && arr[idx - 1] !== p - 1 && <span className="text-xs text-slate-400 px-1">...</span>}
                                    <button
                                        onClick={() => setCurrentPage(p)}
                                        className={`w-8 h-8 rounded text-xs font-bold transition ${currentPage === p ? 'bg-brand-blue text-white shadow-sm' : 'text-slate-600 hover:bg-white hover:shadow-sm border border-transparent hover:border-slate-200'}`}
                                    >
                                        {p}
                                    </button>
                                </React.Fragment>
                            ))
                        }
                    </div>
                    <button 
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                        disabled={currentPage === totalPages}
                        className="p-2 rounded hover:bg-white border border-transparent hover:border-slate-200 disabled:opacity-30 transition"
                    >
                        <ChevronRight className="w-4 h-4 text-slate-600" />
                    </button>
                </div>
            </div>
        )}
      </div>

      {/* CLIENT DETAILS MODAL */}
      {isClientModalOpen && selectedClient && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col animate-in fade-in zoom-in duration-200 overflow-hidden">
            {/* Header */}
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-brand-orange text-white flex items-center justify-center font-bold text-xl">{selectedClient.name.charAt(0)}</div>
                <div>
                  <h3 className="text-xl font-bold text-slate-800">{selectedClient.name}</h3>
                  <p className="text-sm text-slate-500">Détails du client</p>
                </div>
              </div>
              <button onClick={closeClientModal} className="p-2 text-slate-500 hover:bg-slate-200 rounded-full transition">
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
              {/* REAL Statistics from database */}
              {(() => {
                const stats = calculateClientStats(selectedClient.id);
                return (
                  <div className="bg-white rounded-xl border border-slate-200 p-5 mb-4">
                    <h4 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-brand-blue" /> Statistiques réelles (base de données)
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="bg-slate-50 rounded-lg p-3 text-center">
                        <div className="text-2xl font-bold text-slate-800">{stats.totalMissions}</div>
                        <div className="text-xs text-slate-500">Total missions</div>
                      </div>
                      <div className="bg-slate-50 rounded-lg p-3 text-center">
                        <div className="text-2xl font-bold text-green-600">{stats.completedMissions}</div>
                        <div className="text-xs text-slate-500">Terminées</div>
                      </div>
                      <div className="bg-slate-50 rounded-lg p-3 text-center">
                        <div className="text-2xl font-bold text-red-500">{stats.cancelledMissions}</div>
                        <div className="text-xs text-slate-500">Annulées</div>
                      </div>
                      <div className="bg-slate-50 rounded-lg p-3 text-center">
                        <div className="text-2xl font-bold text-brand-blue">{stats.totalRevenue.toFixed(0)}€</div>
                        <div className="text-xs text-slate-500">Revenu total</div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Informations de contact */}
              <div className="bg-white rounded-xl border border-slate-200 p-5 mb-4">
                <h4 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <UserCircle className="w-4 h-4 text-brand-blue" /> Informations de contact
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <span className="text-xs text-slate-400 uppercase block mb-1">Email</span>
                    <p className="text-sm font-medium text-slate-700">{selectedClient.email || "—"}</p>
                  </div>
                  <div>
                    <span className="text-xs text-slate-400 uppercase block mb-1">Téléphone</span>
                    <p className="text-sm font-medium text-slate-700">{selectedClient.phone || "—"}</p>
                  </div>
                  <div className="md:col-span-2">
                    <span className="text-xs text-slate-400 uppercase block mb-1">Adresse</span>
                    <p className="text-sm font-medium text-slate-700 flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {selectedClient.address || "—"}
                      {selectedClient.city && `, ${selectedClient.city}`}
                    </p>
                  </div>
                </div>
              </div>

              {/* Pack actuel */}
              {selectedClient.pack && (
                <div className="bg-white rounded-xl border border-slate-200 p-5">
                  <h4 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                    <Package className="w-4 h-4 text-brand-blue" /> Pack actuel
                  </h4>
                  <div className="flex items-center gap-3">
                    <div className="bg-blue-50 text-brand-blue px-3 py-1.5 rounded-lg text-sm font-bold">{selectedClient.pack}</div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 bg-white border-t border-slate-200 flex justify-end">
              <button onClick={closeClientModal} className="px-6 py-2 bg-slate-800 text-white rounded-lg font-bold hover:bg-slate-700 transition">
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PROVIDER DETAILS MODAL */}
      {isProviderModalOpen && selectedProvider && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col animate-in fade-in zoom-in duration-200 overflow-hidden">
            {/* Header */}
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-xl">
                  {selectedProvider.firstName?.charAt(0) || selectedProvider.lastName?.charAt(0)}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-800">
                    {selectedProvider.firstName} {selectedProvider.lastName}
                  </h3>
                  <p className="text-sm text-slate-500">Détails du prestataire</p>
                </div>
              </div>
              <button onClick={closeProviderModal} className="p-2 text-slate-500 hover:bg-slate-200 rounded-full transition">
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
              {/* REAL Statistics from database */}
              {(() => {
                const stats = calculateProviderStats(selectedProvider.id);
                return (
                  <div className="bg-white rounded-xl border border-slate-200 p-5 mb-4">
                    <h4 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-brand-blue" /> Statistiques réelles (base de données)
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="bg-slate-50 rounded-lg p-3 text-center">
                        <div className="text-2xl font-bold text-slate-800">{stats.totalMissions}</div>
                        <div className="text-xs text-slate-500">Total missions</div>
                      </div>
                      <div className="bg-slate-50 rounded-lg p-3 text-center">
                        <div className="text-2xl font-bold text-green-600">{stats.completedMissions}</div>
                        <div className="text-xs text-slate-500">Terminées</div>
                      </div>
                      <div className="bg-slate-50 rounded-lg p-3 text-center">
                        <div className="text-2xl font-bold text-blue-600">{stats.inProgressMissions}</div>
                        <div className="text-xs text-slate-500">En cours</div>
                      </div>
                      <div className="bg-slate-50 rounded-lg p-3 text-center">
                        <div className="text-2xl font-bold text-brand-blue">{stats.totalHours}h</div>
                        <div className="text-xs text-slate-500">Heures travaillées</div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Informations de contact */}
              <div className="bg-white rounded-xl border border-slate-200 p-5 mb-4">
                <h4 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <UserCircle className="w-4 h-4 text-brand-blue" /> Informations de contact
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <span className="text-xs text-slate-400 uppercase block mb-1">Email</span>
                    <p className="text-sm font-medium text-slate-700">{selectedProvider.email || "—"}</p>
                  </div>
                  <div>
                    <span className="text-xs text-slate-400 uppercase block mb-1">Téléphone</span>
                    <p className="text-sm font-medium text-slate-700">{selectedProvider.phone || "—"}</p>
                  </div>
                  <div className="md:col-span-2">
                    <span className="text-xs text-slate-400 uppercase block mb-1">Spécialité</span>
                    <p className="text-sm font-medium text-slate-700 flex items-center gap-1">
                      <Briefcase className="w-3 h-3" />
                      {(selectedProvider as any).specialty || "—"}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 bg-white border-t border-slate-200 flex justify-end">
              <button onClick={closeProviderModal} className="px-6 py-2 bg-slate-800 text-white rounded-lg font-bold hover:bg-slate-700 transition">
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DOCUMENT DETAILS MODAL */}
      {isDocumentModalOpen && selectedDocument && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col animate-in fade-in zoom-in duration-200 overflow-hidden">
            {/* Header */}
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-blue-100 text-brand-blue flex items-center justify-center">
                  <FileText className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-800">Devis source</h3>
                  <p className="text-sm text-slate-500">{selectedDocument.ref || selectedDocument.id}</p>
                </div>
              </div>
              <button onClick={closeDocumentModal} className="p-2 text-slate-500 hover:bg-slate-200 rounded-full transition">
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
              <div className="bg-white rounded-xl border border-slate-200 p-5 mb-4">
                <h4 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-brand-blue" /> Informations du devis
                </h4>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Référence:</span>
                    <span className="font-medium">{selectedDocument.ref || "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Client:</span>
                    <span className="font-medium">{selectedDocument.clientName || "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Prix unitaire:</span>
                    <span className="font-medium">{selectedDocument.unitPrice?.toFixed(2) || "—"} €</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Total TTC:</span>
                    <span className="font-bold text-green-600">{selectedDocument.totalTTC?.toFixed(2) || "—"} €</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Statut:</span>
                    <span className={`font-medium ${selectedDocument.status === "signed" ? "text-green-600" : "text-slate-600"}`}>
                      {selectedDocument.status || "—"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 bg-white border-t border-slate-200 flex justify-end gap-2">
              <button onClick={closeDocumentModal} className="px-6 py-2 bg-slate-200 text-slate-700 rounded-lg font-bold hover:bg-slate-300 transition">
                Fermer
              </button>
              <button onClick={() => navigateToDocument(selectedDocument.id)} className="px-6 py-2 bg-brand-blue text-white rounded-lg font-bold hover:bg-teal-700 transition flex items-center gap-2">
                <Eye className="w-4 h-4" />
                Voir le devis
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Statistics;
