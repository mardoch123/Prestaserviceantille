import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Loader2,
  CheckCircle,
  XCircle,
  Eye,
  Calendar,
  User,
  Package,
  Filter,
  Search,
  ClipboardCheck,
  Star,
  AlertCircle,
  TrendingUp,
  FileText,
  Download,
  CheckSquare,
  Square,
  Phone,
  MapPin,
  Clock,
  Plus,
  X,
  ChevronDown,
  ChevronRight,
  PieChart,
  BarChart3,
  ArrowRight,
  ThumbsUp,
  ThumbsDown,
  MessageSquare,
  MoreVertical,
  Printer,
  Share2,
  Check,
  Briefcase,
} from 'lucide-react';
import html2canvas from 'html2canvas';
import {
  SAVRecord,
  SatisfactionSurvey,
  SAVStats,
  SAVFilters,
  SAVFilterType,
  SAVFilterStatus,
  SAVFilterPriority,
  CreateSatisfactionSurveyInput,
  CreateSAVInput,
  SatisfactionRating,
  CleanlinessRating,
  RecommendationRating,
} from '../types';
import {
  getSAVRecords,
  getSAVStats,
  getCompletedMissionsWithoutSAV,
  getCompletedMissionsWithoutSAVCount,
  createSatisfactionSurvey,
  createSAVRecord,
  updateSAVStatus,
  deleteSAVRecord,
  deleteSatisfactionSurvey,
  uploadSurveyImage,
} from '../client';
import { useData } from '../../../context/DataContext';
import { Mission } from '../../../types';

// Statut et labels
const statusLabelFr: Record<string, string> = {
  pending: 'En attente',
  in_progress: 'En cours',
  completed: 'Terminé',
  cancelled: 'Annulé',
};

const statusColors: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700 border-amber-200',
  in_progress: 'bg-blue-100 text-blue-700 border-blue-200',
  completed: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  cancelled: 'bg-slate-100 text-slate-600 border-slate-200',
};

const savTypeLabelFr: Record<string, string> = {
  satisfaction_survey: 'Enquête de satisfaction',
  complaint: 'Réclamation',
  incident: 'Incident',
  follow_up: 'Suivi',
};

const savTypeIcons: Record<string, React.ReactNode> = {
  satisfaction_survey: <Star className="w-4 h-4" />,
  complaint: <AlertCircle className="w-4 h-4" />,
  incident: <XCircle className="w-4 h-4" />,
  follow_up: <Clock className="w-4 h-4" />,
};

const priorityLabelFr: Record<string, string> = {
  low: 'Basse',
  medium: 'Moyenne',
  high: 'Haute',
  urgent: 'Urgente',
};

const priorityColors: Record<string, string> = {
  low: 'bg-slate-100 text-slate-600',
  medium: 'bg-blue-100 text-blue-700',
  high: 'bg-orange-100 text-orange-700',
  urgent: 'bg-red-100 text-red-700',
};

// Rating helpers
const ratingLabels: Record<string, Record<string, string>> = {
  qualityRating: {
    excellent: 'Excellent',
    bon: 'Bon',
    a_améliorer: 'À améliorer',
  },
  cleanlinessRating: {
    très_propre: 'Très propre',
    correctement_propre: 'Correctement propre',
    à_améliorer: 'À améliorer',
  },
  recommendationRating: {
    oui: 'Oui',
    peut_être: 'Peut-être',
    non: 'Non',
  },
};

const SAVPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser, companySettings } = useData();

  // États principaux
  const [loading, setLoading] = useState(true);
  const [savRecords, setSavRecords] = useState<SAVRecord[]>([]);
  const [stats, setStats] = useState<SAVStats | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [completedMissions, setCompletedMissions] = useState<Mission[]>([]);
  
  // Filtres
  const [filters, setFilters] = useState<SAVFilters>({
    type: 'all',
    status: 'all',
    priority: 'all',
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  
  // Vue active - 'missions' devient la vue par défaut
  const [activeView, setActiveView] = useState<'list' | 'stats' | 'missions' | 'sav-records'>('missions');
  
  // Modal de création
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedMission, setSelectedMission] = useState<Mission | null>(null);
  const [showSurveyModal, setShowSurveyModal] = useState(false);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  // Chargement initial
  useEffect(() => {
    loadData();
  }, [filters]);

  const loadData = async () => {
    setLoading(true);
    try {
      console.log('[SAV] Loading data...');
      const [records, statsData, pending, missions] = await Promise.all([
        getSAVRecords(filters),
        getSAVStats(),
        getCompletedMissionsWithoutSAVCount(),
        getCompletedMissionsWithoutSAV(),
      ]);
      console.log('[SAV] Missions loaded:', missions.length, missions);
      setSavRecords(records);
      setStats(statsData);
      setPendingCount(pending);
      setCompletedMissions(missions);
    } catch (error) {
      console.error('[SAV] Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filtrage
  const filteredRecords = useMemo(() => {
    let result = savRecords;
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(r =>
        r.clientName.toLowerCase().includes(query) ||
        r.packName.toLowerCase().includes(query) ||
        r.description.toLowerCase().includes(query) ||
        r.investigatorName.toLowerCase().includes(query)
      );
    }
    
    return result;
  }, [savRecords, searchQuery]);

  // Pagination
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredRecords.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredRecords, currentPage]);

  const totalPages = Math.ceil(filteredRecords.length / ITEMS_PER_PAGE);

  // Création d'un SAV
  const handleCreateSAV = async (input: CreateSAVInput) => {
    if (!currentUser) return;
    
    const result = await createSAVRecord(
      input,
      currentUser.id,
      currentUser.name || 'Admin'
    );
    
    if (result) {
      setSavRecords([result, ...savRecords]);
      setShowCreateModal(false);
      loadData();
    }
  };

  // Création d'une enquête de satisfaction
  const handleCreateSurvey = async (input: CreateSatisfactionSurveyInput): Promise<SatisfactionSurvey | null> => {
    if (!currentUser) {
      return null;
    }
    
    try {
      const result = await createSatisfactionSurvey(input, currentUser.id);
      
      if (result) {
        loadData();
      }
      
      return result;
    } catch (error) {
      console.error('[SAV] Error in handleCreateSurvey:', error);
      return null;
    }
  };

  // Mise à jour du statut
  const handleStatusChange = async (savId: string, status: SAVRecord['status']) => {
    const success = await updateSAVStatus(savId, status);
    if (success) {
      setSavRecords(savRecords.map(r => 
        r.id === savId ? { ...r, status } : r
      ));
    }
  };

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
              <ClipboardCheck className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">Service Après-Vente</h1>
              <p className="text-sm text-slate-500">
                Gestion des enquêtes de satisfaction et suivis clients
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Navigation des vues */}
            <button
              onClick={() => setActiveView('missions')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                activeView === 'missions'
                  ? 'bg-amber-100 text-amber-700 border border-amber-200'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <ClipboardCheck className="w-4 h-4" />
              <span className="font-medium">Missions ({pendingCount})</span>
            </button>
            
            <button
              onClick={() => setActiveView('sav-records')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                activeView === 'sav-records'
                  ? 'bg-indigo-100 text-indigo-700 border border-indigo-200'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Star className="w-4 h-4" />
              <span className="font-medium">SAV enregistrés</span>
            </button>
            
            <button
              onClick={() => setActiveView('stats')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                activeView === 'stats'
                  ? 'bg-purple-100 text-purple-700 border border-purple-200'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <PieChart className="w-4 h-4" />
              <span className="font-medium">Statistiques</span>
            </button>
          </div>
        </div>
      </div>

      {/* Stats rapides */}
      {stats && activeView !== 'stats' && (
        <div className="px-6 py-4 grid grid-cols-4 gap-4">
          <StatCard
            title="En attente"
            value={stats.totalPending}
            icon={Clock}
            color="amber"
            onClick={() => {
              setFilters({ ...filters, status: 'pending' });
              setActiveView('sav-records');
            }}
          />
          <StatCard
            title="En cours"
            value={stats.totalInProgress}
            icon={TrendingUp}
            color="blue"
            onClick={() => {
              setFilters({ ...filters, status: 'in_progress' });
              setActiveView('sav-records');
            }}
          />
          <StatCard
            title="Terminés"
            value={stats.totalCompleted}
            icon={CheckCircle}
            color="emerald"
            onClick={() => {
              setFilters({ ...filters, status: 'completed' });
              setActiveView('sav-records');
            }}
          />
          <StatCard
            title="Enquêtes satisfaction"
            value={stats.byType.satisfaction_survey}
            icon={Star}
            color="purple"
            onClick={() => {
              setFilters({ ...filters, type: 'satisfaction_survey' });
              setActiveView('sav-records');
            }}
          />
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto px-6 py-4">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
          </div>
        ) : activeView === 'stats' ? (
          <SAVStatsView stats={stats} onBack={() => setActiveView('missions')} />
        ) : activeView === 'sav-records' ? (
          <SAVRecordsView
            records={filteredRecords}
            savRecords={savRecords}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            showFilters={showFilters}
            setShowFilters={setShowFilters}
            filters={filters}
            setFilters={setFilters}
            currentPage={currentPage}
            setCurrentPage={setCurrentPage}
            totalPages={totalPages}
            paginatedRecords={paginatedRecords}
            onStatusChange={handleStatusChange}
            onDelete={loadData}
          />
        ) : (
          <MissionsWithoutSAVView
            missions={completedMissions}
            onCreateSurvey={(mission) => {
              setSelectedMission(mission);
              setShowSurveyModal(true);
            }}
            onCreateSAV={(mission) => {
              setSelectedMission(mission);
              setShowCreateModal(true);
            }}
          />
        )}
      </div>

      {/* Modals */}
      {showCreateModal && (
        <CreateSAVModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreateSAV}
          missions={completedMissions}
        />
      )}
      
      {showSurveyModal && selectedMission && (
        <SatisfactionSurveyModal
          mission={selectedMission}
          onClose={() => {
            setShowSurveyModal(false);
            setSelectedMission(null);
          }}
          onSubmit={handleCreateSurvey}
          companySettings={companySettings}
        />
      )}
    </div>
  );
};

// Composant StatCard
const StatCard: React.FC<{
  title: string;
  value: number;
  icon: React.ElementType;
  color: string;
  onClick?: () => void;
}> = ({ title, value, icon: Icon, color, onClick }) => {
  const colorClasses: Record<string, string> = {
    amber: 'from-amber-500 to-orange-500',
    blue: 'from-blue-500 to-cyan-500',
    emerald: 'from-emerald-500 to-teal-500',
    purple: 'from-purple-500 to-pink-500',
  };

  return (
    <button
      onClick={onClick}
      className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 hover:shadow-md transition-all text-left"
    >
      <div className="flex items-center justify-between mb-3">
        <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${colorClasses[color]} flex items-center justify-center`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <span className="text-2xl font-bold text-slate-800">{value}</span>
      </div>
      <p className="text-sm text-slate-600">{title}</p>
    </button>
  );
};

// Composant SAVRecordsView - Liste des SAV enregistrés
const SAVRecordsView: React.FC<{
  records: SAVRecord[];
  savRecords: SAVRecord[];
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  showFilters: boolean;
  setShowFilters: (s: boolean) => void;
  filters: SAVFilters;
  setFilters: (f: SAVFilters) => void;
  currentPage: number;
  setCurrentPage: (p: number) => void;
  totalPages: number;
  paginatedRecords: SAVRecord[];
  onStatusChange: (id: string, status: SAVRecord['status']) => void;
  onDelete?: () => void;
}> = ({
  savRecords,
  searchQuery,
  setSearchQuery,
  showFilters,
  setShowFilters,
  filters,
  setFilters,
  currentPage,
  setCurrentPage,
  totalPages,
  paginatedRecords,
  onStatusChange,
  onDelete,
}) => {
  const navigate = useNavigate();
  const ITEMS_PER_PAGE = 10;
  const [selectedRecord, setSelectedRecord] = useState<SAVRecord | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const { companySettings } = useData();

  const handleViewDetails = (record: SAVRecord) => {
    setSelectedRecord(record);
    setShowDetailsModal(true);
  };

  // Toggle selection of a single record
  const toggleSelection = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  // Toggle all records on current page
  const toggleAll = () => {
    const currentIds = paginatedRecords.map(r => r.id);
    const allSelected = currentIds.every(id => selectedIds.has(id));
    
    const newSelected = new Set(selectedIds);
    if (allSelected) {
      // Deselect all on current page
      currentIds.forEach(id => newSelected.delete(id));
    } else {
      // Select all on current page
      currentIds.forEach(id => newSelected.add(id));
    }
    setSelectedIds(newSelected);
  };

  // Handle bulk delete
  const handleBulkDelete = async () => {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer ${selectedIds.size} enregistrement(s) ?`)) {
      return;
    }

    const idsArray = Array.from(selectedIds);
    for (const id of idsArray) {
      const record = savRecords.find((r: SAVRecord) => r.id === id);
      if (record) {
        if (record.savType === 'satisfaction_survey') {
          await deleteSatisfactionSurvey(id);
        } else {
          await deleteSAVRecord(id);
        }
      }
    }
    
    setSelectedIds(new Set());
    onDelete?.();
  };

  // Generate PDF for selected records
  const handleBulkDownloadPDF = async () => {
    const selectedRecords = savRecords.filter((r: SAVRecord) => selectedIds.has(r.id));
    const surveyRecords = selectedRecords.filter((r: SAVRecord) => r.savType === 'satisfaction_survey');
    
    if (surveyRecords.length === 0) {
      alert('Aucune enquête de satisfaction sélectionnée');
      return;
    }

    // Download each survey image
    for (const record of surveyRecords) {
      // Create a temporary button and click it
      const button = document.createElement('button');
      button.onclick = () => {
        const event = new MouseEvent('click');
        const downloadBtn = document.getElementById(`download-${record.id}`);
        downloadBtn?.dispatchEvent(event);
      };
      document.body.appendChild(button);
      button.click();
      document.body.removeChild(button);
      
      // Wait a bit between downloads
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  };

  const hasSelection = selectedIds.size > 0;

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <div className="flex items-center gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Rechercher par client, pack, enquêteur..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2 border rounded-lg transition-colors ${
              showFilters
                ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                : 'border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Filter className="w-4 h-4" />
            <span className="font-medium">Filtres</span>
            <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </button>
        </div>
        
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-slate-200 grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Type</label>
              <select
                value={filters.type}
                onChange={(e) => setFilters({ ...filters, type: e.target.value as SAVFilterType })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">Tous les types</option>
                <option value="satisfaction_survey">Enquête de satisfaction</option>
                <option value="complaint">Réclamation</option>
                <option value="incident">Incident</option>
                <option value="follow_up">Suivi</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Statut</label>
              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value as SAVFilterStatus })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">Tous les statuts</option>
                <option value="pending">En attente</option>
                <option value="in_progress">En cours</option>
                <option value="completed">Terminé</option>
                <option value="cancelled">Annulé</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Priorité</label>
              <select
                value={filters.priority}
                onChange={(e) => setFilters({ ...filters, priority: e.target.value as SAVFilterPriority })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">Toutes les priorités</option>
                <option value="low">Basse</option>
                <option value="medium">Moyenne</option>
                <option value="high">Haute</option>
                <option value="urgent">Urgente</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Bulk Actions Bar */}
      {hasSelection && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-indigo-700">
              {selectedIds.size} sélectionné(s)
            </span>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="text-sm text-indigo-600 hover:text-indigo-800 underline"
            >
              Tout désélectionner
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleBulkDownloadPDF}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-indigo-300 rounded-lg text-indigo-700 hover:bg-indigo-50 transition-colors text-sm font-medium"
            >
              <Download className="w-4 h-4" />
              Télécharger PDF
            </button>
            <button
              onClick={handleBulkDelete}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
            >
              <XCircle className="w-4 h-4" />
              Supprimer
            </button>
          </div>
        </div>
      )}

      {/* Liste des SAV */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left w-10">
                  <input
                    type="checkbox"
                    checked={paginatedRecords.length > 0 && paginatedRecords.every(r => selectedIds.has(r.id))}
                    onChange={toggleAll}
                    className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Client</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Type</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Statut</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Priorité</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Date</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Enquêteur</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedRecords.map((record) => (
                <tr
                  key={record.id}
                  className={`hover:bg-slate-50 transition-colors ${selectedIds.has(record.id) ? 'bg-indigo-50/50' : ''}`}
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(record.id)}
                      onChange={() => toggleSelection(record.id)}
                      className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center">
                        <User className="w-5 h-5 text-indigo-600" />
                      </div>
                      <div>
                        <p className="font-medium text-slate-800">{record.clientName}</p>
                        <p className="text-xs text-slate-500">{record.packName}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500">{savTypeIcons[record.savType]}</span>
                      <span className="text-sm text-slate-700">{savTypeLabelFr[record.savType]}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[record.status]}`}>
                      {statusLabelFr[record.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${priorityColors[record.priority]}`}>
                      {priorityLabelFr[record.priority]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <Calendar className="w-4 h-4" />
                      {new Date(record.createdAt).toLocaleDateString('fr-FR')}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-slate-700">{record.investigatorName}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {record.savType === 'satisfaction_survey' && (
                        <SurveyDownloadButton 
                          record={record} 
                          logoUrl={companySettings?.logoUrl}
                        />
                      )}
                      <button
                        onClick={() => handleViewDetails(record)}
                        className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                        title="Voir détails"
                      >
                        <Eye className="w-4 h-4 text-slate-600" />
                      </button>
                      {record.status !== 'completed' && (
                        <button
                          onClick={() => onStatusChange(record.id, 'completed')}
                          className="p-2 hover:bg-emerald-100 rounded-lg transition-colors"
                          title="Marquer comme terminé"
                        >
                          <CheckCircle className="w-4 h-4 text-emerald-600" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {paginatedRecords.length === 0 && (
          <div className="text-center py-12">
            <ClipboardCheck className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500">Aucun SAV trouvé</p>
          </div>
        )}
        
        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-slate-200 flex items-center justify-between">
            <p className="text-sm text-slate-600">
              Affichage de {((currentPage - 1) * ITEMS_PER_PAGE) + 1} à {Math.min(currentPage * ITEMS_PER_PAGE, paginatedRecords.length * totalPages)} sur {paginatedRecords.length * totalPages}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 border border-slate-200 rounded-lg disabled:opacity-50 hover:bg-slate-50"
              >
                Précédent
              </button>
              <span className="text-sm text-slate-600">
                Page {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 border border-slate-200 rounded-lg disabled:opacity-50 hover:bg-slate-50"
              >
                Suivant
              </button>
            </div>
          </div>
        )}
      </div>

      {/* SAV Details Modal */}
      {showDetailsModal && selectedRecord && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-auto">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-800">Détails SAV</h2>
              <button onClick={() => setShowDetailsModal(false)} className="p-2 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center">
                  <User className="w-6 h-6 text-indigo-600" />
                </div>
                <div>
                  <p className="font-semibold text-slate-800">{selectedRecord.clientName}</p>
                  <p className="text-sm text-slate-500">{selectedRecord.packName}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-200">
                <div>
                  <p className="text-xs text-slate-500 uppercase">Type</p>
                  <p className="font-medium text-slate-800">{savTypeLabelFr[selectedRecord.savType]}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 uppercase">Statut</p>
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[selectedRecord.status]}`}>
                    {statusLabelFr[selectedRecord.status]}
                  </span>
                </div>
                <div>
                  <p className="text-xs text-slate-500 uppercase">Priorité</p>
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${priorityColors[selectedRecord.priority]}`}>
                    {priorityLabelFr[selectedRecord.priority]}
                  </span>
                </div>
                <div>
                  <p className="text-xs text-slate-500 uppercase">Date</p>
                  <p className="font-medium text-slate-800">{new Date(selectedRecord.createdAt).toLocaleDateString('fr-FR')}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 uppercase">Enquêteur</p>
                  <p className="font-medium text-slate-800">{selectedRecord.investigatorName}</p>
                </div>
              </div>
              {selectedRecord.description && (
                <div className="pt-4 border-t border-slate-200">
                  <p className="text-xs text-slate-500 uppercase mb-2">Description</p>
                  <p className="text-slate-800">{selectedRecord.description}</p>
                </div>
              )}
            </div>
            <div className="p-6 border-t border-slate-200 flex gap-3">
              {selectedRecord.savType === 'satisfaction_survey' && (
                <SurveyDownloadButton record={selectedRecord} logoUrl={companySettings?.logoUrl} />
              )}
              <button
                onClick={() => setShowDetailsModal(false)}
                className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Composant pour télécharger le formulaire d'enquête de satisfaction
const SurveyDownloadButton: React.FC<{ record: SAVRecord; logoUrl?: string }> = ({ record, logoUrl }) => {
  const [isGenerating, setIsGenerating] = useState(false);

  const handleDownload = async () => {
    setIsGenerating(true);
    
    // Create an iframe to isolate the content from external stylesheets
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.left = '-9999px';
    iframe.style.top = '0';
    iframe.style.width = '800px';
    iframe.style.height = '600px';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);
    
    // Wait for iframe to load
    await new Promise(resolve => {
      iframe.onload = resolve;
      // For some browsers that don't trigger onload for about:blank
      setTimeout(resolve, 50);
    });
    
    const doc = iframe.contentDocument;
    if (!doc) {
      document.body.removeChild(iframe);
      setIsGenerating(false);
      return;
    }
    
    // Render the form content with styled format matching SatisfactionSurveyModal
    const ratings = extractRatings(record.description || '');
    
    // Map ratings to display labels - keys must match extracted values from regex
    const ratingLabels: Record<string, Record<string, string>> = {
      quality: {
        'excellent': 'Excellent',
        'bon': 'Bon',
        'a_améliorer': 'À améliorer',
        'Non spécifié': 'Non spécifié'
      },
      cleanliness: {
        'très_propre': 'Très propre',
        'correctement_propre': 'Correctement propre',
        'à_améliorer': 'À améliorer',
        'Non spécifié': 'Non spécifié'
      },
      recommendation: {
        'oui': 'Oui',
        'peut_etre': 'Peut-être',
        'peut_être': 'Peut-être',
        'non': 'Non',
        'Non spécifié': 'Non spécifié'
      }
    };

    const qualityValue = ratingLabels.quality[ratings.quality] || ratings.quality;
    const cleanlinessValue = ratingLabels.cleanliness[ratings.cleanliness] || ratings.cleanliness;
    const recommendationValue = ratingLabels.recommendation[ratings.recommendation] || ratings.recommendation;
    
    // Generate logo HTML
    const logoHtml = logoUrl ? 
      '<img src="' + logoUrl + '" alt="Logo" style="width: 64px; height: 64px; object-fit: contain;" onerror="this.style.display=\'none\'; this.parentElement.innerHTML=\'<span style=font-size:10px;font-weight:bold;>LOGO</span>\';" />' :
      '<span style="font-size: 10px; font-weight: bold; text-align: center;">LOGO</span>';
    
    doc.body.innerHTML = `
      <div style="width: 700px; background: white; padding: 48px; font-family: system-ui, -apple-system, sans-serif; box-sizing: border-box;">
        <!-- Header with logo -->
        <div style="display: flex; align-items: center; justify-content: center; gap: 24px; margin-bottom: 32px;">
          <div style="width: 80px; height: 80px; border-radius: 50%; border: 4px solid #0f172a; display: flex; align-items: center; justify-content: center; flex-shrink: 0; background: white; overflow: hidden;">
            ${logoHtml}
          </div>
          <div style="text-align: center;">
            <h1 style="font-size: 28px; font-weight: bold; color: #0f172a; margin: 0 0 4px 0;">Enquête de satisfaction</h1>
            <p style="font-size: 14px; color: #64748b; margin: 0;">Service de ménage</p>
          </div>
        </div>
        
        <!-- Client info -->
        <div style="display: grid; grid-template-columns: 1fr auto; gap: 16px; margin-bottom: 24px;">
          <div>
            <p style="font-size: 12px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 4px 0;">Client</p>
            <p style="font-size: 16px; font-weight: 500; color: #0f172a; margin: 0;">${record.clientName}</p>
          </div>
          <div style="text-align: right;">
            <p style="font-size: 12px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 4px 0;">Date</p>
            <p style="font-size: 16px; font-weight: 500; color: #0f172a; margin: 0;">${new Date(record.createdAt).toLocaleDateString('fr-FR')}</p>
          </div>
        </div>
        
        <!-- Pack -->
        <div style="margin-bottom: 32px;">
          <p style="font-size: 12px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 4px 0;">Pack</p>
          <p style="font-size: 16px; font-weight: 500; color: #0f172a; margin: 0;">${record.packName || 'Non spécifié'}</p>
        </div>

        <!-- Questions -->
        <div style="display: flex; flex-direction: column; gap: 20px; margin-bottom: 32px;">
          <!-- Question 1 - Indigo -->
          <div style="border-left: 4px solid #6366f1; padding-left: 16px;">
            <p style="font-weight: 500; color: #1e293b; margin: 0 0 12px 0;">1. Comment évaluez-vous la qualité du ménage réalisé ?</p>
            <div style="display: flex; gap: 12px;">
              ${renderCheckboxOption('Excellent', qualityValue === 'Excellent', '#6366f1', '#e0e7ff')}
              ${renderCheckboxOption('Bon', qualityValue === 'Bon', '#6366f1', '#e0e7ff')}
              ${renderCheckboxOption('À améliorer', qualityValue === 'À améliorer', '#6366f1', '#e0e7ff')}
            </div>
          </div>
          
          <!-- Question 2 - Emerald -->
          <div style="border-left: 4px solid #10b981; padding-left: 16px;">
            <p style="font-weight: 500; color: #1e293b; margin: 0 0 12px 0;">2. Le logement vous paraît-il propre après notre passage ?</p>
            <div style="display: flex; gap: 12px; flex-wrap: wrap;">
              ${renderCheckboxOption('Très propre', cleanlinessValue === 'Très propre', '#10b981', '#d1fae5')}
              ${renderCheckboxOption('Correctement propre', cleanlinessValue === 'Correctement propre', '#10b981', '#d1fae5')}
              ${renderCheckboxOption('À améliorer', cleanlinessValue === 'À améliorer', '#10b981', '#d1fae5')}
            </div>
          </div>
          
          <!-- Question 3 - Amber -->
          <div style="border-left: 4px solid #f59e0b; padding-left: 16px;">
            <p style="font-weight: 500; color: #1e293b; margin: 0 0 12px 0;">3. Recommanderiez-vous notre service ?</p>
            <div style="display: flex; gap: 12px;">
              ${renderCheckboxOption('Oui', recommendationValue === 'Oui', '#f59e0b', '#fef3c7')}
              ${renderCheckboxOption('Peut-être', recommendationValue === 'Peut-être', '#f59e0b', '#fef3c7')}
              ${renderCheckboxOption('Non', recommendationValue === 'Non', '#f59e0b', '#fef3c7')}
            </div>
          </div>
        </div>

        <!-- Comments -->
        ${record.description && record.description.includes('Commentaires:') ? `
          <div style="margin-bottom: 24px;">
            <p style="font-size: 12px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 8px 0;">Commentaires</p>
            <div style="background: #f8fafc; border-radius: 8px; padding: 16px;">
              <p style="font-size: 14px; color: #334155; margin: 0;">${record.description.split('Commentaires:')[1]?.trim() || ''}</p>
            </div>
          </div>
        ` : ''}

        <!-- Footer with investigator -->
        <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #e2e8f0; text-align: right;">
          <p style="font-size: 14px; color: #64748b; margin: 0;">Enquêteur : <span style="font-weight: 500; color: #0f172a;">${record.investigatorName}</span></p>
        </div>
      </div>
    `;
    
    // Wait for content to render
    await new Promise(resolve => setTimeout(resolve, 100));
    
    try {
      const canvas = await html2canvas(doc.body.firstElementChild as HTMLElement, {
        scale: 2,
        backgroundColor: '#ffffff',
        logging: false,
      });
      
      const dataUrl = canvas.toDataURL('image/png', 1.0);
      
      const link = document.createElement('a');
      link.download = `enquete-satisfaction-${record.clientName}-${new Date(record.createdAt).toISOString().split('T')[0]}.png`;
      link.href = dataUrl;
      link.click();
    } catch (error) {
      console.error('[SAV] Error generating image:', error);
    } finally {
      // Clean up
      document.body.removeChild(iframe);
      setIsGenerating(false);
    }
  };

  // Extraire les notes de la description
  const extractRatings = (description: string) => {
    const qualityMatch = description.match(/Qualité:\s*(\w+)/);
    const cleanlinessMatch = description.match(/Propreté:\s*(\w+)/);
    const recommendationMatch = description.match(/Recommandation:\s*(\w+)/);
    
    return {
      quality: qualityMatch?.[1] || 'Non spécifié',
      cleanliness: cleanlinessMatch?.[1] || 'Non spécifié',
      recommendation: recommendationMatch?.[1] || 'Non spécifié',
    };
  };

  // Helper function to render checkbox options with clear selected state
  const renderCheckboxOption = (label: string, isSelected: boolean, activeColor: string, bgColor: string) => {
    if (isSelected) {
      // Selected style - filled checkbox with checkmark
      return `
        <div style="display: flex; align-items: center; gap: 8px; padding: 8px 12px; border: 2px solid ${activeColor}; border-radius: 8px; background: ${bgColor};">
          <div style="width: 18px; height: 18px; border-radius: 4px; background: ${activeColor}; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
          </div>
          <span style="font-size: 14px; font-weight: 600; color: ${activeColor};">${label}</span>
        </div>
      `;
    } else {
      // Unselected style - empty checkbox
      return `
        <div style="display: flex; align-items: center; gap: 8px; padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 8px; background: white;">
          <div style="width: 18px; height: 18px; border: 2px solid #cbd5e1; border-radius: 4px; background: white; flex-shrink: 0;"></div>
          <span style="font-size: 14px; color: #64748b;">${label}</span>
        </div>
      `;
    }
  };

  return (
    <button
      onClick={handleDownload}
      disabled={isGenerating}
      className="flex-1 px-3 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2 text-sm font-medium whitespace-nowrap"
    >
      {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
      {isGenerating ? 'Génération...' : 'Télécharger'}
    </button>
  );
};

// Vue des missions sans SAV - AVEC FILTRES
const MissionsWithoutSAVView: React.FC<{
  missions: any[];
  onCreateSurvey: (mission: any) => void;
  onCreateSAV?: (mission: any) => void;
}> = ({ missions, onCreateSurvey, onCreateSAV }) => {
  // Options d'enquêteurs
  const investigatorOptions = ['Harry', 'Sylvie', 'Yoan'];
  
  // Filtres locaux pour les missions
  const [missionFilters, setMissionFilters] = useState({
    clientName: '',
    dateFrom: '',
    dateTo: '',
    serviceType: 'all',
    investigator: 'all',
  });
  const [showMissionFilters, setShowMissionFilters] = useState(false);
  const [missionPage, setMissionPage] = useState(1);
  const MISSIONS_PER_PAGE = 12;

  // Filtrage des missions
  const filteredMissions = useMemo(() => {
    let result = [...missions];
    
    if (missionFilters.clientName.trim()) {
      const query = missionFilters.clientName.toLowerCase();
      result = result.filter(m => 
        (m.client_name?.toLowerCase().includes(query)) ||
        (m.clients?.name?.toLowerCase().includes(query)) ||
        (m.service?.toLowerCase().includes(query))
      );
    }
    
    if (missionFilters.dateFrom) {
      result = result.filter(m => m.date >= missionFilters.dateFrom);
    }
    
    if (missionFilters.dateTo) {
      result = result.filter(m => m.date <= missionFilters.dateTo);
    }
    
    if (missionFilters.serviceType !== 'all') {
      result = result.filter(m => 
        m.service?.toLowerCase().includes(missionFilters.serviceType.toLowerCase()) ||
        m.service_type?.toLowerCase().includes(missionFilters.serviceType.toLowerCase())
      );
    }
    
    // Trier par date décroissante
    result.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    return result;
  }, [missions, missionFilters]);

  // Pagination
  const totalMissionPages = Math.ceil(filteredMissions.length / MISSIONS_PER_PAGE);
  const paginatedMissions = filteredMissions.slice(
    (missionPage - 1) * MISSIONS_PER_PAGE,
    missionPage * MISSIONS_PER_PAGE
  );

  return (
    <div className="space-y-4">
      {/* Barre de filtres */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <div className="flex items-center gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Rechercher par nom du client..."
              value={missionFilters.clientName}
              onChange={(e) => setMissionFilters({ ...missionFilters, clientName: e.target.value })}
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          
          <button
            onClick={() => setShowMissionFilters(!showMissionFilters)}
            className={`flex items-center gap-2 px-4 py-2 border rounded-lg transition-colors ${
              showMissionFilters
                ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                : 'border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Filter className="w-4 h-4" />
            <span className="font-medium">Filtres avancés</span>
            <ChevronDown className={`w-4 h-4 transition-transform ${showMissionFilters ? 'rotate-180' : ''}`} />
          </button>
        </div>
        
        {showMissionFilters && (
          <div className="mt-4 pt-4 border-t border-slate-200 grid grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Date début</label>
              <input
                type="date"
                value={missionFilters.dateFrom}
                onChange={(e) => setMissionFilters({ ...missionFilters, dateFrom: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Date fin</label>
              <input
                type="date"
                value={missionFilters.dateTo}
                onChange={(e) => setMissionFilters({ ...missionFilters, dateTo: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Type de service</label>
              <select
                value={missionFilters.serviceType}
                onChange={(e) => setMissionFilters({ ...missionFilters, serviceType: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500"
              >
                <option value="all">Tous les services</option>
                <option value="ménage">Ménage</option>
                <option value="bricolage">Bricolage</option>
                <option value="autre">Autre</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Enquêteur</label>
              <select
                value={missionFilters.investigator}
                onChange={(e) => setMissionFilters({ ...missionFilters, investigator: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500"
              >
                <option value="all">Tous les enquêteurs</option>
                {investigatorOptions.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
                <option value="Autre">Autre</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Résultats */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-800">
          Missions terminées sans SAV 
          <span className="ml-2 text-sm font-normal text-slate-500">
            ({filteredMissions.length} mission{filteredMissions.length > 1 ? 's' : ''})
          </span>
        </h2>
        
        {(missionFilters.clientName || missionFilters.dateFrom || missionFilters.dateTo || missionFilters.serviceType !== 'all' || missionFilters.investigator !== 'all') && (
          <button
            onClick={() => {
              setMissionFilters({ clientName: '', dateFrom: '', dateTo: '', serviceType: 'all', investigator: 'all' });
              setMissionPage(1);
            }}
            className="text-sm text-emerald-600 hover:text-emerald-700"
          >
            Réinitialiser les filtres
          </button>
        )}
      </div>

      {/* Grille des missions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {paginatedMissions.map((mission) => (
          <div
            key={mission.id}
            className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 hover:shadow-md transition-all flex flex-col h-full"
          >
            <div className="flex items-start gap-3 mb-3 min-w-0">
              <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                <User className="w-5 h-5 text-emerald-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-slate-800 truncate" title={mission.client_name || mission.clients?.name || 'Client'}>
                  {mission.client_name || mission.clients?.name || 'Client'}
                </p>
                <p className="text-xs text-slate-500 truncate" title={mission.service || 'Service non spécifié'}>
                  {mission.service || 'Service non spécifié'}
                </p>
              </div>
            </div>
            
            <div className="space-y-2 mb-4 flex-1 min-w-0">
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Calendar className="w-4 h-4 flex-shrink-0" />
                <span className="truncate">{new Date(mission.date).toLocaleDateString('fr-FR')}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Clock className="w-4 h-4 flex-shrink-0" />
                <span className="truncate">{mission.start_time || '--:--'} - {mission.end_time || '--:--'}</span>
              </div>
              {mission.provider_name && (
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Briefcase className="w-4 h-4 flex-shrink-0" />
                  <span className="truncate">{mission.provider_name}</span>
                </div>
              )}
            </div>
            
            <div className="mt-auto pt-2">
              <button
                onClick={() => onCreateSurvey(mission)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-all"
              >
                <Star className="w-4 h-4" />
                <span className="font-medium">Enquête satisfaction</span>
              </button>
            </div>
          </div>
        ))}
      </div>
      
      {/* Pagination */}
      {totalMissionPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <button
            onClick={() => setMissionPage(p => Math.max(1, p - 1))}
            disabled={missionPage === 1}
            className="px-3 py-1 border border-slate-200 rounded-lg disabled:opacity-50 hover:bg-slate-50"
          >
            Précédent
          </button>
          <span className="text-sm text-slate-600">
            Page {missionPage} / {totalMissionPages}
          </span>
          <button
            onClick={() => setMissionPage(p => Math.min(totalMissionPages, p + 1))}
            disabled={missionPage === totalMissionPages}
            className="px-3 py-1 border border-slate-200 rounded-lg disabled:opacity-50 hover:bg-slate-50"
          >
            Suivant
          </button>
        </div>
      )}
      
      {filteredMissions.length === 0 && (
        <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
          <CheckCircle className="w-16 h-16 text-emerald-400 mx-auto mb-4" />
          <p className="text-slate-600 font-medium">
            {missions.length === 0 
              ? "Toutes les missions ont un SAV associé !" 
              : "Aucune mission ne correspond aux filtres"}
          </p>
          {missions.length > 0 && (
            <button
              onClick={() => {
                setMissionFilters({ clientName: '', dateFrom: '', dateTo: '', serviceType: 'all', investigator: 'all' });
              }}
              className="mt-2 text-emerald-600 hover:text-emerald-700 text-sm"
            >
              Effacer les filtres
            </button>
          )}
        </div>
      )}
    </div>
  );
};

// Vue des statistiques
const SAVStatsView: React.FC<{
  stats: SAVStats | null;
  onBack: () => void;
}> = ({ stats, onBack }) => {
  if (!stats) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-slate-600 hover:text-slate-800"
        >
          <ArrowRight className="w-4 h-4 rotate-180" />
          Retour
        </button>
        <h2 className="text-lg font-semibold text-slate-800">Statistiques SAV</h2>
      </div>

      {/* Répartition par type */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
              <Star className="w-4 h-4 text-purple-600" />
            </div>
            <span className="text-sm text-slate-600">Enquêtes</span>
          </div>
          <p className="text-2xl font-bold text-slate-800">{stats.byType.satisfaction_survey}</p>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center">
              <AlertCircle className="w-4 h-4 text-red-600" />
            </div>
            <span className="text-sm text-slate-600">Réclamations</span>
          </div>
          <p className="text-2xl font-bold text-slate-800">{stats.byType.complaint}</p>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center">
              <XCircle className="w-4 h-4 text-orange-600" />
            </div>
            <span className="text-sm text-slate-600">Incidents</span>
          </div>
          <p className="text-2xl font-bold text-slate-800">{stats.byType.incident}</p>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
              <Clock className="w-4 h-4 text-blue-600" />
            </div>
            <span className="text-sm text-slate-600">Suivis</span>
          </div>
          <p className="text-2xl font-bold text-slate-800">{stats.byType.follow_up}</p>
        </div>
      </div>

      {/* Moyennes de satisfaction */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">Moyennes de satisfaction</h3>
        <div className="grid grid-cols-3 gap-6">
          <div className="text-center">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mx-auto mb-3">
              <span className="text-2xl font-bold text-white">
                {stats.satisfactionAverage.quality.toFixed(1)}
              </span>
            </div>
            <p className="text-sm text-slate-600">Qualité du ménage</p>
            <p className="text-xs text-slate-400">Sur 3 points</p>
          </div>
          
          <div className="text-center">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center mx-auto mb-3">
              <span className="text-2xl font-bold text-white">
                {stats.satisfactionAverage.cleanliness.toFixed(1)}
              </span>
            </div>
            <p className="text-sm text-slate-600">Propreté</p>
            <p className="text-xs text-slate-400">Sur 3 points</p>
          </div>
          
          <div className="text-center">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center mx-auto mb-3">
              <span className="text-2xl font-bold text-white">
                {stats.satisfactionAverage.recommendation.toFixed(1)}
              </span>
            </div>
            <p className="text-sm text-slate-600">Recommandation</p>
            <p className="text-xs text-slate-400">Sur 3 points</p>
          </div>
        </div>
      </div>
    </div>
  );
};

// Modal de création de SAV
const CreateSAVModal: React.FC<{
  onClose: () => void;
  onCreate: (input: CreateSAVInput) => void;
  missions: any[];
}> = ({ onClose, onCreate, missions }) => {
  const [selectedMissionId, setSelectedMissionId] = useState('');
  const [savType, setSavType] = useState<CreateSAVInput['savType']>('satisfaction_survey');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<CreateSAVInput['priority']>('medium');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMissionId) return;
    
    setSubmitting(true);
    await onCreate({
      missionId: selectedMissionId,
      savType,
      description,
      priority,
    });
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-auto">
        <div className="p-6 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Nouveau SAV</h2>
            {selectedMissionId && (
              <div className="mt-1 text-sm text-slate-600">
                {(() => {
                  const m = missions.find(m => m.id === selectedMissionId);
                  return m ? (
                    <span>
                      <span className="font-medium">{m.client_name || m.clients?.name || 'Client'}</span>
                      {' • '}
                      <span className="text-slate-500">{m.provider_name || 'Prestataire non assigné'}</span>
                      {' • '}
                      <span className="text-slate-400">{new Date(m.date).toLocaleDateString('fr-FR')}</span>
                    </span>
                  ) : null;
                })()}
              </div>
            )}
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Mission</label>
            <select
              value={selectedMissionId}
              onChange={(e) => setSelectedMissionId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500"
              required
            >
              <option value="">Sélectionner une mission</option>
              {missions.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.client_name} - {new Date(m.date).toLocaleDateString('fr-FR')} - {m.service}
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Type</label>
            <select
              value={savType}
              onChange={(e) => setSavType(e.target.value as CreateSAVInput['savType'])}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500"
            >
              <option value="satisfaction_survey">Enquête de satisfaction</option>
              <option value="complaint">Réclamation</option>
              <option value="incident">Incident</option>
              <option value="follow_up">Suivi</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Priorité</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as CreateSAVInput['priority'])}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500"
            >
              <option value="low">Basse</option>
              <option value="medium">Moyenne</option>
              <option value="high">Haute</option>
              <option value="urgent">Urgente</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500"
              placeholder="Décrivez le sujet du SAV..."
            />
          </div>
          
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={!selectedMissionId || submitting}
              className="flex-1 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Créer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Modal d'enquête de satisfaction avec formulaire téléchargeable
const SatisfactionSurveyModal: React.FC<{
  mission: any;
  onClose: () => void;
  onSubmit: (input: CreateSatisfactionSurveyInput) => Promise<SatisfactionSurvey | null>;
  companySettings: any;
}> = ({ mission, onClose, onSubmit, companySettings }) => {
  const [qualityRating, setQualityRating] = useState<SatisfactionRating | ''>('');
  const [cleanlinessRating, setCleanlinessRating] = useState<CleanlinessRating | ''>('');
  const [recommendationRating, setRecommendationRating] = useState<RecommendationRating | ''>('');
  const [additionalComments, setAdditionalComments] = useState('');
  const [investigatorName, setInvestigatorName] = useState('Harry');
  const [customInvestigator, setCustomInvestigator] = useState('');
  const [isCustomInvestigator, setIsCustomInvestigator] = useState(false);
  const investigatorOptions = ['Harry', 'Sylvie', 'Yoan'];
  const [submitting, setSubmitting] = useState(false);
  const [generatedSurvey, setGeneratedSurvey] = useState<SatisfactionSurvey | null>(null);
  const formRef = useRef<HTMLDivElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!qualityRating || !cleanlinessRating || !recommendationRating || !investigatorName) {
      return;
    }
    
    setSubmitting(true);
    
    try {
      const result = await onSubmit({
        missionId: mission.id,
        clientId: mission.client_id,
        clientName: mission.client_name || mission.clients?.name || 'Client',
        packName: mission.pack_name || 'Non spécifié',
        qualityRating,
        cleanlinessRating,
        recommendationRating,
        additionalComments,
        investigatorName,
      });
      
      if (result) {
        setGeneratedSurvey(result);
      }
    } catch (err) {
      console.error('[SAV] Error in handleSubmit:', err);
    }
    
    setSubmitting(false);
  };

  const handleDownload = async () => {
    if (!formRef.current || !generatedSurvey) return;
    
    try {
      const canvas = await html2canvas(formRef.current, {
        scale: 2,
        backgroundColor: '#ffffff',
        logging: false,
      });
      
      const dataUrl = canvas.toDataURL('image/png', 1.0);
      
      const link = document.createElement('a');
      link.download = `enquete-satisfaction-${mission.client_name}-${new Date().toISOString().split('T')[0]}.png`;
      link.href = dataUrl;
      link.click();
    } catch (error) {
      console.error('[SAV] Error generating image:', error);
    }
  };

  const handleUpload = async () => {
    if (!formRef.current || !generatedSurvey) return;
    
    try {
      const canvas = await html2canvas(formRef.current, {
        scale: 2,
        backgroundColor: '#ffffff',
        logging: false,
      });
      
      const blob = await new Promise<Blob | null>((resolve) => 
        canvas.toBlob(resolve, 'image/png', 1.0)
      );
      
      if (blob) {
        await uploadSurveyImage(generatedSurvey.id, blob);
      }
    } catch (error) {
      console.error('[SAV] Error uploading image:', error);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-auto">
        <div className="p-6 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Enquête de satisfaction</h2>
            <div className="mt-1 text-sm text-slate-600">
              <span className="font-medium">{mission.client_name || mission.clients?.name || 'Client'}</span>
              {' • '}
              <span className="text-slate-500">{mission.provider_name || 'Prestataire non assigné'}</span>
              {' • '}
              <span className="text-slate-400">{new Date(mission.date).toLocaleDateString('fr-FR')}</span>
              {' • '}
              <span className="text-slate-400">{mission.service || 'Service non spécifié'}</span>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6">
          {!generatedSurvey ? (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Questions */}
              <div className="space-y-4">
                <div className="bg-slate-50 rounded-xl p-4">
                  <p className="font-medium text-slate-800 mb-3">
                    1. Comment évaluez-vous la qualité du ménage réalisé ?
                  </p>
                  <div className="flex gap-4">
                    {(['excellent', 'bon', 'a_améliorer'] as SatisfactionRating[]).map((rating) => (
                      <label
                        key={rating}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer transition-all ${
                          qualityRating === rating
                            ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                            : 'border-slate-200 hover:border-indigo-300'
                        }`}
                      >
                        <input
                          type="radio"
                          name="quality"
                          value={rating}
                          checked={qualityRating === rating}
                          onChange={(e) => setQualityRating(e.target.value as SatisfactionRating)}
                          className="w-4 h-4 text-indigo-600"
                        />
                        <span className="text-sm font-medium">{ratingLabels.qualityRating[rating]}</span>
                      </label>
                    ))}
                  </div>
                </div>
                
                <div className="bg-slate-50 rounded-xl p-4">
                  <p className="font-medium text-slate-800 mb-3">
                    2. Le logement vous paraît-il propre après notre passage ?
                  </p>
                  <div className="flex gap-4">
                    {(['très_propre', 'correctement_propre', 'à_améliorer'] as CleanlinessRating[]).map((rating) => (
                      <label
                        key={rating}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer transition-all ${
                          cleanlinessRating === rating
                            ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                            : 'border-slate-200 hover:border-indigo-300'
                        }`}
                      >
                        <input
                          type="radio"
                          name="cleanliness"
                          value={rating}
                          checked={cleanlinessRating === rating}
                          onChange={(e) => setCleanlinessRating(e.target.value as CleanlinessRating)}
                          className="w-4 h-4 text-indigo-600"
                        />
                        <span className="text-sm font-medium">{ratingLabels.cleanlinessRating[rating]}</span>
                      </label>
                    ))}
                  </div>
                </div>
                
                <div className="bg-slate-50 rounded-xl p-4">
                  <p className="font-medium text-slate-800 mb-3">
                    3. Recommanderiez-vous notre service ?
                  </p>
                  <div className="flex gap-4">
                    {(['oui', 'peut_être', 'non'] as RecommendationRating[]).map((rating) => (
                      <label
                        key={rating}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer transition-all ${
                          recommendationRating === rating
                            ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                            : 'border-slate-200 hover:border-indigo-300'
                        }`}
                      >
                        <input
                          type="radio"
                          name="recommendation"
                          value={rating}
                          checked={recommendationRating === rating}
                          onChange={(e) => setRecommendationRating(e.target.value as RecommendationRating)}
                          className="w-4 h-4 text-indigo-600"
                        />
                        <span className="text-sm font-medium">{ratingLabels.recommendationRating[rating]}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Commentaires additionnels
                </label>
                <textarea
                  value={additionalComments}
                  onChange={(e) => setAdditionalComments(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  placeholder="Commentaires du client..."
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Nom de l'enquêteur
                </label>
                <select
                  value={isCustomInvestigator ? 'Autre' : investigatorName}
                  onChange={(e) => {
                    if (e.target.value === 'Autre') {
                      setIsCustomInvestigator(true);
                      setInvestigatorName(customInvestigator || '');
                    } else {
                      setIsCustomInvestigator(false);
                      setInvestigatorName(e.target.value);
                    }
                  }}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 mb-2"
                >
                  {investigatorOptions.map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                  <option value="Autre">Autre</option>
                </select>
                
                {isCustomInvestigator && (
                  <input
                    type="text"
                    value={customInvestigator}
                    onChange={(e) => {
                      setCustomInvestigator(e.target.value);
                      setInvestigatorName(e.target.value);
                    }}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500"
                    placeholder="Entrez le nom de l'enquêteur"
                    required
                  />
                )}
              </div>
              
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={!qualityRating || !cleanlinessRating || !recommendationRating || !investigatorName || submitting}
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Valider l'enquête
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-emerald-600" />
                <p className="text-emerald-700 font-medium">Enquête enregistrée avec succès !</p>
              </div>
              
              {/* Prévisualisation du formulaire */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-700">Prévisualisation du formulaire</span>
                  <div className="flex gap-2">
                    <button
                      onClick={handleDownload}
                      className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm hover:bg-slate-50"
                    >
                      <Download className="w-4 h-4" />
                      Télécharger
                    </button>
                    <button
                      onClick={handleUpload}
                      className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700"
                    >
                      <Share2 className="w-4 h-4" />
                      Sauvegarder
                    </button>
                  </div>
                </div>
                
                <div className="p-8 bg-slate-100 overflow-auto flex justify-center">
                  {/* Formulaire généré */}
                  <div
                    ref={formRef}
                    className="bg-white w-[600px] p-8 shadow-lg flex flex-col"
                    style={{ aspectRatio: '1/1.414', minHeight: '850px' }}
                  >
                    {/* Header avec logo - centré */}
                    <div className="flex items-center justify-center gap-6 mb-8">
                      <div className="w-24 h-24 rounded-full border-4 border-slate-900 flex items-center justify-center flex-shrink-0">
                        {companySettings?.logoUrl ? (
                          <img
                            src={companySettings.logoUrl}
                            alt="Logo"
                            className="w-20 h-20 object-contain"
                          />
                        ) : (
                          <span className="text-xs font-bold text-center">LOGO</span>
                        )}
                      </div>
                      <div className="text-center">
                        <h1 className="text-2xl font-bold text-slate-900">Enquête de satisfaction</h1>
                        <p className="text-sm text-slate-500">Service de ménage</p>
                      </div>
                    </div>
                    
                    {/* Informations client - alignées */}
                    <div className="grid grid-cols-2 gap-4 mb-8">
                      <div>
                        <p className="text-xs text-slate-500 uppercase tracking-wide">Client</p>
                        <p className="font-medium text-slate-800">{mission.client_name || mission.clients?.name}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-slate-500 uppercase tracking-wide">Date</p>
                        <p className="font-medium text-slate-800">
                          {new Date().toLocaleDateString('fr-FR')}
                        </p>
                      </div>
                      {(mission.client_address || mission.clients?.address) && (
                        <div className="col-span-2">
                          <p className="text-xs text-slate-500 uppercase tracking-wide">Adresse</p>
                          <p className="font-medium text-slate-800">{mission.client_address || mission.clients?.address}</p>
                        </div>
                      )}
                      <div className="col-span-2">
                        <p className="text-xs text-slate-500 uppercase tracking-wide">Pack</p>
                        <p className="font-medium text-slate-800">{mission.pack_name || 'Non spécifié'}</p>
                      </div>
                    </div>
                    
                    {/* Questions */}
                    <div className="space-y-6 mb-8">
                      <div className="border-l-4 border-indigo-500 pl-4">
                        <p className="font-medium text-slate-800 mb-2">
                          1. Comment évaluez-vous la qualité du ménage réalisé ?
                        </p>
                        <div className="flex gap-3">
                          {(['excellent', 'bon', 'a_améliorer'] as SatisfactionRating[]).map((rating) => (
                            <div
                              key={rating}
                              className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${
                                qualityRating === rating
                                  ? 'border-indigo-500 bg-indigo-50'
                                  : 'border-slate-200 bg-white'
                              }`}
                            >
                              <div className={`w-4 h-4 rounded-sm border-2 flex items-center justify-center ${
                                qualityRating === rating ? 'border-indigo-500 bg-indigo-500' : 'border-slate-300'
                              }`}>
                                {qualityRating === rating && <Check className="w-3 h-3 text-white" />}
                              </div>
                              <span className="text-sm">{ratingLabels.qualityRating[rating]}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      
                      <div className="border-l-4 border-emerald-500 pl-4">
                        <p className="font-medium text-slate-800 mb-2">
                          2. Le logement vous paraît-il propre après notre passage ?
                        </p>
                        <div className="flex gap-3">
                          {(['très_propre', 'correctement_propre', 'à_améliorer'] as CleanlinessRating[]).map((rating) => (
                            <div
                              key={rating}
                              className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${
                                cleanlinessRating === rating
                                  ? 'border-emerald-500 bg-emerald-50'
                                  : 'border-slate-200 bg-white'
                              }`}
                            >
                              <div className={`w-4 h-4 rounded-sm border-2 flex items-center justify-center ${
                                cleanlinessRating === rating ? 'border-emerald-500 bg-emerald-500' : 'border-slate-300'
                              }`}>
                                {cleanlinessRating === rating && <Check className="w-3 h-3 text-white" />}
                              </div>
                              <span className="text-sm">{ratingLabels.cleanlinessRating[rating]}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      
                      <div className="border-l-4 border-amber-500 pl-4">
                        <p className="font-medium text-slate-800 mb-2">
                          3. Recommanderiez-vous notre service ?
                        </p>
                        <div className="flex gap-3">
                          {(['oui', 'peut_être', 'non'] as RecommendationRating[]).map((rating) => (
                            <div
                              key={rating}
                              className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${
                                recommendationRating === rating
                                  ? 'border-amber-500 bg-amber-50'
                                  : 'border-slate-200 bg-white'
                              }`}
                            >
                              <div className={`w-4 h-4 rounded-sm border-2 flex items-center justify-center ${
                                recommendationRating === rating ? 'border-amber-500 bg-amber-500' : 'border-slate-300'
                              }`}>
                                {recommendationRating === rating && <Check className="w-3 h-3 text-white" />}
                              </div>
                              <span className="text-sm">{ratingLabels.recommendationRating[rating]}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                    
                    {/* Commentaires */}
                    {additionalComments && (
                      <div className="mb-8">
                        <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Commentaires</p>
                        <div className="bg-slate-50 rounded-lg p-4">
                          <p className="text-sm text-slate-700">{additionalComments}</p>
                        </div>
                      </div>
                    )}
                    
                    {/* Signature */}
                    <div className="mt-auto pt-8 border-t border-slate-200">
                      <p className="text-sm text-slate-600 text-right">
                        Enquêteur : <span className="font-medium">{investigatorName}</span>
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200"
                >
                  Fermer
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SAVPage;
