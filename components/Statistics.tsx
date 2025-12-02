
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
  Search
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
  const { missions } = useData(); // Use real missions from context now
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('month');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const location = useLocation();

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

  // Filter Logic
  const filteredData = useMemo(() => {
    // 1. Filter by Time (Simplified for prototype: assume all context missions are relevant for now or filter by simple string match if date exists)
    let timeData = missions; 
    
    // 2. Filter by Status
    if (statusFilter === 'all') return timeData;
    return timeData.filter(m => m.status === statusFilter);
  }, [timeFilter, statusFilter, missions]);

  // Calculate Stats based on Time Filter
  const stats = useMemo(() => {
    const baseData = missions; 
    return {
      total: baseData.length,
      completed: baseData.filter(m => m.status === 'completed').length,
      planned: baseData.filter(m => m.status === 'planned').length,
      cancelled: baseData.filter(m => m.status === 'cancelled').length,
      lateCancelled: baseData.filter(m => m.status === 'cancelled' && m.lateCancellation).length
    };
  }, [missions]);

  const totalRevenue = filteredData.reduce((acc, curr) => {
    // Estimate amount if not on mission object (fallback to duration * rate)
    const amount = (curr.duration || 2) * 40; // Assume 40€/h base if no amount

    if (curr.status === 'cancelled' && !curr.lateCancellation) return acc;
    
    // If cancelled late, we charge 50%
    if (curr.status === 'cancelled' && curr.lateCancellation) return acc + (amount * 0.5);
    
    if (curr.status === 'completed') return acc + amount;
    
    return acc;
  }, 0);

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
            onChange={(e) => setTimeFilter(e.target.value as TimeFilter)}
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
          subtext="Toutes catégories confondues"
        />
        <StatCard 
          title="Terminées" 
          value={stats.completed} 
          icon={CheckCircle} 
          colorClass="text-green-600 bg-green-600"
          isActive={statusFilter === 'completed'}
          onClick={() => setStatusFilter('completed')}
          subtext="Prestations réalisées"
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
          subtext={`Dont ${stats.lateCancelled} tardives (<48h)`}
        />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-cream-50/50">
          <div>
            <h3 className="font-bold text-slate-800 text-lg">Listing des prestations</h3>
            <p className="text-xs text-slate-500">
               Filtre actif: <span className="font-bold text-brand-blue uppercase">{timeFilter}</span> • 
               Catégorie: <span className="font-bold text-brand-blue uppercase">{statusFilter === 'all' ? 'Tout' : statusFilter}</span>
            </p>
          </div>
          <div className="bg-green-50 px-4 py-2 rounded-lg border border-green-100">
            <span className="text-xs text-green-800 font-bold uppercase tracking-wider">Chiffre d'affaire (Est.)</span>
            <p className="text-xl font-bold text-green-700">{totalRevenue.toFixed(2)} €</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-500 uppercase bg-slate-50/80 border-b border-slate-100">
              <tr>
                <th className="px-6 py-4 font-bold">Date & Heure</th>
                <th className="px-6 py-4 font-bold">Client</th>
                <th className="px-6 py-4 font-bold">Prestation</th>
                <th className="px-6 py-4 font-bold">Prestataire</th>
                <th className="px-6 py-4 font-bold text-center">Statut</th>
                <th className="px-6 py-4 font-bold text-right">Montant</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredData.length > 0 ? (
                filteredData.map((mission) => {
                    // Calculated fields for display since we use shared Mission type
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
                                  <AlertTriangle className="w-3 h-3" /> 50% Facturé (Hors SAP)
                                </span>
                              )}
                            </div>
                          )}
                          {/* Reminder indicator */}
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
                    Aucune prestation trouvée pour ce filtre.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Statistics;
