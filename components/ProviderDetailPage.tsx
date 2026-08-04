import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { 
  ArrowLeft, 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  Briefcase,
  Star,
  Clock,
  CheckCircle,
  Calendar,
  Euro,
  Edit3,
  Trash2,
  History,
  Award,
  Search,
  Filter,
  ChevronDown
} from 'lucide-react';
import dayjs from 'dayjs';
import { getMartiniqueNow, MARTINIQUE_TIMEZONE } from '../src/utils/dayjsMartinique';

const ProviderDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { providers, missions, deleteProviders } = useData();
  
  const [provider, setProvider] = useState<any>(null);
  const [providerMissions, setProviderMissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'info' | 'missions' | 'stats'>('info');

  // Mission filters
  const [missionSearch, setMissionSearch] = useState('');
  const [missionStatusFilter, setMissionStatusFilter] = useState('all');
  const [missionDateFilter, setMissionDateFilter] = useState<'all' | 'upcoming' | 'past'>('all');
  const [showMissionFilters, setShowMissionFilters] = useState(false);

  useEffect(() => {
    // Check for provider ID in URL params (from search navigation)
    const providerIdFromQuery = searchParams.get('id');
    const effectiveId = id || providerIdFromQuery;
    
    if (effectiveId && providers && providers.length > 0) {
      const foundProvider = providers.find(p => p.id === effectiveId);
      if (foundProvider) {
        setProvider(foundProvider);
        
        // Get provider missions
        const foundMissions = (missions || []).filter(m => m.providerId === effectiveId);
        setProviderMissions(foundMissions);
      }
    }
    setLoading(false);
  }, [id, providers, missions, searchParams]);

  const handleDelete = async () => {
    if (provider && confirm('Êtes-vous sûr de vouloir supprimer ce prestataire ?')) {
      await deleteProviders?.([provider.id]);
      navigate('/providers');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-emerald-500" />;
      case 'cancelled':
        return <span className="text-red-500">✕</span>;
      case 'in_progress':
        return <Clock className="w-4 h-4 text-blue-500" />;
      default:
        return <Calendar className="w-4 h-4 text-amber-500" />;
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      planned: 'Planifiée',
      in_progress: 'En cours',
      completed: 'Terminée',
      cancelled: 'Annulée'
    };
    return labels[status] || status;
  };

  // Calculate stats
  const completedMissions = providerMissions.filter(m => m.status === 'completed').length;
  const totalEarnings = providerMissions
    .filter(m => m.status === 'completed')
    .reduce((sum, m) => sum + (m.providerAmount || m.amount || 0), 0);
  const rating = provider?.rating || 0;

  // Filtered and sorted missions (most recent first)
  const filteredMissions = useMemo(() => {
    const today = getMartiniqueNow().format('YYYY-MM-DD');
    let result = [...providerMissions];

    // Status filter
    if (missionStatusFilter !== 'all') {
      result = result.filter(m => m.status === missionStatusFilter);
    }

    // Date filter
    if (missionDateFilter === 'upcoming') {
      result = result.filter(m => m.date >= today);
    } else if (missionDateFilter === 'past') {
      result = result.filter(m => m.date < today);
    }

    // Search filter
    if (missionSearch.trim()) {
      const q = missionSearch.toLowerCase().trim();
      result = result.filter(m =>
        (m.clientName || '').toLowerCase().includes(q) ||
        (m.service || '').toLowerCase().includes(q) ||
        (m.date || '').includes(q) ||
        (m.startTime || '').includes(q) ||
        (m.endTime || '').includes(q) ||
        (getStatusLabel(m.status) || '').toLowerCase().includes(q)
      );
    }

    // Sort by date descending (most recent first), then by start time
    result.sort((a, b) => {
      const dateDiff = b.date.localeCompare(a.date);
      if (dateDiff !== 0) return dateDiff;
      return (b.startTime || '').localeCompare(a.startTime || '');
    });

    return result;
  }, [providerMissions, missionStatusFilter, missionDateFilter, missionSearch]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-blue"></div>
      </div>
    );
  }

  if (!provider) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-slate-50 p-4">
        <User className="w-16 h-16 text-slate-300 mb-4" />
        <h1 className="text-xl font-bold text-slate-700 mb-2">Prestataire non trouvé</h1>
        <p className="text-slate-500 mb-4">Le prestataire que vous recherchez n'existe pas ou a été supprimé.</p>
        <button
          onClick={() => navigate('/providers')}
          className="px-4 py-2 bg-brand-blue text-white rounded-lg hover:bg-brand-blue-dark"
        >
          Retour aux prestataires
        </button>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/providers')}
                className="p-2 hover:bg-slate-100 rounded-lg transition"
              >
                <ArrowLeft className="w-5 h-5 text-slate-600" />
              </button>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                  <Briefcase className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-slate-800">
                    {provider.firstName} {provider.lastName}
                  </h1>
                  <p className="text-sm text-slate-500">
                    {provider.specialty || 'Prestataire'} • Inscrit depuis {dayjs(provider.createdAt).format('MM/YYYY')}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate(`/providers?edit=${provider.id}`)}
                className="px-3 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 flex items-center gap-2"
              >
                <Edit3 className="w-4 h-4" />
                Modifier
              </button>
              <button
                onClick={handleDelete}
                className="px-3 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Supprimer
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mt-4">
            {[
              { id: 'info', label: 'Informations', icon: User },
              { id: 'missions', label: `Missions (${providerMissions.length})`, icon: Clock },
              { id: 'stats', label: 'Statistiques', icon: Award }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                  activeTab === tab.id
                    ? 'bg-purple-600 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {activeTab === 'info' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Info */}
            <div className="lg:col-span-2 space-y-6">
              {/* Contact Info */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                  <User className="w-5 h-5" />
                  Informations de contact
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {provider.email && (
                    <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                      <Mail className="w-5 h-5 text-slate-400" />
                      <div>
                        <p className="text-sm text-slate-500">Email</p>
                        <p className="font-medium text-slate-800">{provider.email}</p>
                      </div>
                    </div>
                  )}
                  {provider.phone && (
                    <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                      <Phone className="w-5 h-5 text-slate-400" />
                      <div>
                        <p className="text-sm text-slate-500">Téléphone</p>
                        <p className="font-medium text-slate-800">{provider.phone}</p>
                      </div>
                    </div>
                  )}
                  {provider.address && (
                    <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                      <MapPin className="w-5 h-5 text-slate-400" />
                      <div>
                        <p className="text-sm text-slate-500">Adresse</p>
                        <p className="font-medium text-slate-800">{provider.address}</p>
                      </div>
                    </div>
                  )}
                  {provider.specialty && (
                    <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                      <Briefcase className="w-5 h-5 text-slate-400" />
                      <div>
                        <p className="text-sm text-slate-500">Spécialité</p>
                        <p className="font-medium text-slate-800">{provider.specialty}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Professional Info */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <h2 className="text-lg font-semibold text-slate-800 mb-4">Informations professionnelles</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {provider.companyName && (
                    <div className="p-3 bg-slate-50 rounded-lg">
                      <p className="text-sm text-slate-500">Entreprise</p>
                      <p className="font-medium text-slate-800">{provider.companyName}</p>
                    </div>
                  )}
                  {provider.siret && (
                    <div className="p-3 bg-slate-50 rounded-lg">
                      <p className="text-sm text-slate-500">SIRET</p>
                      <p className="font-medium text-slate-800">{provider.siret}</p>
                    </div>
                  )}
                  {provider.hourlyRate && (
                    <div className="p-3 bg-slate-50 rounded-lg">
                      <p className="text-sm text-slate-500">Taux horaire</p>
                      <p className="font-medium text-slate-800">{provider.hourlyRate} €/h</p>
                    </div>
                  )}
                  <div className="p-3 bg-slate-50 rounded-lg">
                    <p className="text-sm text-slate-500">Note moyenne</p>
                    <div className="flex items-center gap-1">
                      <Star className="w-4 h-4 text-amber-400 fill-current" />
                      <span className="font-medium text-slate-800">{rating.toFixed(1)}/5</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Quick Actions */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <h3 className="text-sm font-semibold text-slate-500 uppercase mb-4">Actions rapides</h3>
                <div className="space-y-2">
                  <button
                    onClick={() => navigate('/planning', { state: { selectedProviderId: provider.id } })}
                    className="w-full px-4 py-2 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 flex items-center gap-2"
                  >
                    <Calendar className="w-4 h-4" />
                    Assigner une mission
                  </button>
                  {provider.email && (
                    <a
                      href={`mailto:${provider.email}`}
                      className="w-full px-4 py-2 bg-slate-50 text-slate-700 rounded-lg hover:bg-slate-100 flex items-center gap-2"
                    >
                      <Mail className="w-4 h-4" />
                      Envoyer un email
                    </a>
                  )}
                  {provider.phone && (
                    <a
                      href={`tel:${provider.phone}`}
                      className="w-full px-4 py-2 bg-slate-50 text-slate-700 rounded-lg hover:bg-slate-100 flex items-center gap-2"
                    >
                      <Phone className="w-4 h-4" />
                      Appeler
                    </a>
                  )}
                </div>
              </div>

              {/* Notes */}
              {provider.notes && (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                  <h3 className="text-sm font-semibold text-slate-500 uppercase mb-4">Notes</h3>
                  <p className="text-slate-700 whitespace-pre-wrap">{provider.notes}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'missions' && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200">
            <div className="px-6 py-4 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-800">Missions assignées</h2>
                <button
                  onClick={() => setShowMissionFilters(!showMissionFilters)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    showMissionFilters ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <Filter className="w-4 h-4" />
                  Filtres
                  <ChevronDown className={`w-3 h-3 transition-transform ${showMissionFilters ? 'rotate-180' : ''}`} />
                </button>
              </div>

              {/* Search & Filters */}
              {showMissionFilters && (
                <div className="mt-4 space-y-3 animate-in fade-in slide-in-from-top-2">
                  {/* Search bar */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Rechercher par nom de client, service, date..."
                      value={missionSearch}
                      onChange={(e) => setMissionSearch(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400"
                    />
                  </div>
                  {/* Filter row */}
                  <div className="flex flex-wrap gap-2">
                    {/* Status filter */}
                    <select
                      value={missionStatusFilter}
                      onChange={(e) => setMissionStatusFilter(e.target.value)}
                      className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-200"
                    >
                      <option value="all">Tous les statuts</option>
                      <option value="planned">Planifiées</option>
                      <option value="in_progress">En cours</option>
                      <option value="completed">Terminées</option>
                      <option value="cancelled">Annulées</option>
                    </select>
                    {/* Date filter */}
                    <select
                      value={missionDateFilter}
                      onChange={(e) => setMissionDateFilter(e.target.value as any)}
                      className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-200"
                    >
                      <option value="all">Toutes les dates</option>
                      <option value="upcoming">À venir</option>
                      <option value="past">Passées</option>
                    </select>
                    {/* Reset */}
                    {(missionSearch || missionStatusFilter !== 'all' || missionDateFilter !== 'all') && (
                      <button
                        onClick={() => { setMissionSearch(''); setMissionStatusFilter('all'); setMissionDateFilter('all'); }}
                        className="px-3 py-2 bg-red-50 text-red-600 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors"
                      >
                        Réinitialiser
                      </button>
                    )}
                  </div>
                  {/* Result count */}
                  <p className="text-xs text-slate-400">
                    {filteredMissions.length} mission{filteredMissions.length > 1 ? 's' : ''} trouvée{filteredMissions.length > 1 ? 's' : ''}
                  </p>
                </div>
              )}
            </div>
            {filteredMissions.length === 0 ? (
              <div className="p-8 text-center">
                <Clock className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500">
                  {providerMissions.length === 0
                    ? 'Aucune mission pour ce prestataire'
                    : 'Aucune mission ne correspond aux filtres'}
                </p>
                {providerMissions.length === 0 && (
                  <button
                    onClick={() => navigate('/planning', { state: { selectedProviderId: provider.id } })}
                    className="mt-4 px-4 py-2 bg-brand-blue text-white rounded-lg hover:bg-brand-blue-dark"
                  >
                    Créer une mission
                  </button>
                )}
              </div>
            ) : (
              <div className="divide-y divide-slate-200">
                {filteredMissions.map(mission => (
                  <div 
                    key={mission.id} 
                    className="p-4 hover:bg-slate-50 cursor-pointer"
                    onClick={() => navigate(`/planning/missions/${mission.id}`)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {getStatusIcon(mission.status)}
                        <div>
                          <p className="font-medium text-slate-800">{mission.service}</p>
                          <p className="text-sm text-slate-500">
                            {mission.date} • {mission.startTime} - {mission.endTime}
                          </p>
                          <p className="text-sm text-slate-400">{mission.clientName}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          mission.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                          mission.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                          mission.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                          'bg-amber-100 text-amber-700'
                        }`}>
                          {getStatusLabel(mission.status)}
                        </span>
                        {mission.providerAmount && (
                          <p className="text-sm font-medium text-slate-600 mt-1">
                            {mission.providerAmount.toFixed(2)} €
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'stats' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Clock className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-800">{providerMissions.length}</p>
                  <p className="text-sm text-slate-500">Missions totales</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-800">{completedMissions}</p>
                  <p className="text-sm text-slate-500">Missions terminées</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Euro className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-800">{totalEarnings.toFixed(0)}€</p>
                  <p className="text-sm text-slate-500">Gains totaux</p>
                </div>
              </div>
            </div>

            {providerMissions.length > 0 && (
              <div className="md:col-span-3 bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <h3 className="text-lg font-semibold text-slate-800 mb-4">Répartition des missions</h3>
                <div className="grid grid-cols-4 gap-4 text-center">
                  <div className="p-4 bg-amber-50 rounded-lg">
                    <p className="text-2xl font-bold text-amber-700">
                      {providerMissions.filter(m => m.status === 'planned').length}
                    </p>
                    <p className="text-sm text-slate-600">Planifiées</p>
                  </div>
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <p className="text-2xl font-bold text-blue-700">
                      {providerMissions.filter(m => m.status === 'in_progress').length}
                    </p>
                    <p className="text-sm text-slate-600">En cours</p>
                  </div>
                  <div className="p-4 bg-emerald-50 rounded-lg">
                    <p className="text-2xl font-bold text-emerald-700">
                      {providerMissions.filter(m => m.status === 'completed').length}
                    </p>
                    <p className="text-sm text-slate-600">Terminées</p>
                  </div>
                  <div className="p-4 bg-red-50 rounded-lg">
                    <p className="text-2xl font-bold text-red-700">
                      {providerMissions.filter(m => m.status === 'cancelled').length}
                    </p>
                    <p className="text-sm text-slate-600">Annulées</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProviderDetailPage;
