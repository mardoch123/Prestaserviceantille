
import React, { useState, useMemo, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
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
  ArrowUpDown
} from 'lucide-react';
import { useData } from '../context/DataContext';

// --- Types & Mock Data ---

type TimeFilter = 'day' | 'week' | 'month' | 'year';
type StatusFilter = 'all' | 'completed' | 'planned' | 'cancelled';

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
  const { missions, documents } = useData(); 
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('month');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const location = useLocation();

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
        const state = location.state as { filter?: StatusFilter, time?: string };
        if (state.filter) {
            setStatusFilter(state.filter);
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
      const now = new Date();
      const day = now.getDay() || 7; // Get current day number, convert Sun (0) to 7
      if (day !== 1) now.setHours(-24 * (day - 1)); // set to Monday
      const startOfWeek = new Date(now);
      const endOfWeek = new Date(now);
      endOfWeek.setDate(endOfWeek.getDate() + 6);
      return { start: startOfWeek, end: endOfWeek };
  };

  // Filter Logic
  const filteredData = useMemo(() => {
    let data = missions; 
    const now = new Date();

    // 1. Time Filter (Global)
    if (timeFilter === 'day') {
        const todayStr = now.toISOString().split('T')[0];
        data = data.filter(m => m.date === todayStr);
    } else if (timeFilter === 'week') {
        const { start, end } = getWeekRange();
        // Reset hours for comparison
        start.setHours(0,0,0,0);
        end.setHours(23,59,59,999);
        data = data.filter(m => {
            const mDate = new Date(m.date);
            return mDate >= start && mDate <= end;
        });
    } else if (timeFilter === 'month') {
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        data = data.filter(m => {
            const mDate = new Date(m.date);
            return mDate.getMonth() === currentMonth && mDate.getFullYear() === currentYear;
        });
    } else if (timeFilter === 'year') {
        const currentYear = now.getFullYear();
        data = data.filter(m => new Date(m.date).getFullYear() === currentYear);
    }

    // 2. Status Card Filter
    if (statusFilter !== 'all') {
        data = data.filter(m => m.status === statusFilter);
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
        data = data.filter(m => m.status === filters.status);
    }
    if (filters.amountMin) {
        data = data.filter(m => ((m.duration || 2) * 40) >= Number(filters.amountMin));
    }
    if (filters.amountMax) {
        data = data.filter(m => ((m.duration || 2) * 40) <= Number(filters.amountMax));
    }

    return data;
  }, [timeFilter, statusFilter, missions, filters]);

  // Pagination Logic
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const paginatedData = useMemo(() => {
      const start = (currentPage - 1) * itemsPerPage;
      return filteredData.slice(start, start + itemsPerPage);
  }, [filteredData, currentPage]);

  // Calculate Stats based on Time Filter (Contextual)
  const stats = useMemo(() => {
    // We compute stats on the data filtered by TIME only, ignoring column filters for the cards context
    let baseData = missions;
    const now = new Date();
    
    if (timeFilter === 'day') {
        const todayStr = now.toISOString().split('T')[0];
        baseData = baseData.filter(m => m.date === todayStr);
    } else if (timeFilter === 'week') {
        const { start, end } = getWeekRange();
        start.setHours(0,0,0,0); end.setHours(23,59,59,999);
        baseData = baseData.filter(m => { const d = new Date(m.date); return d >= start && d <= end; });
    } else if (timeFilter === 'month') {
        baseData = baseData.filter(m => new Date(m.date).getMonth() === now.getMonth() && new Date(m.date).getFullYear() === now.getFullYear());
    } else if (timeFilter === 'year') {
        baseData = baseData.filter(m => new Date(m.date).getFullYear() === now.getFullYear());
    }

    return {
      total: baseData.length,
      completed: baseData.filter(m => m.status === 'completed').length,
      planned: baseData.filter(m => m.status === 'planned').length,
      cancelled: baseData.filter(m => m.status === 'cancelled').length,
      lateCancelled: baseData.filter(m => m.status === 'cancelled' && m.lateCancellation).length
    };
  }, [missions, timeFilter]);

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

  return (
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
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
                    const baseAmount = (mission.duration || 2) * 40;
                    
                    return (
                      <tr key={mission.id} className="hover:bg-cream-50 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="font-bold text-slate-700">{mission.date}</div>
                          <div className="text-xs text-slate-500">{mission.startTime} - {mission.endTime}</div>
                        </td>
                        <td className="px-6 py-4 text-slate-700">{mission.clientName}</td>
                        <td className="px-6 py-4">
                          <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs font-medium">
                            {mission.service}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-slate-600">{mission.providerName || '-'}</td>
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
    </div>
  );
};

export default Statistics;
