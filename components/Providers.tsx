
import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { useData } from '../context/DataContext';
import type { Mission } from '../types';
import PageLoader from './PageLoader';
import Pagination from './Pagination';
import ListingFilterBar from './ListingFilterBar';
import SearchableSelect from './SearchableSelect';
import dayjs from 'dayjs';
import { getMartiniqueNow, MARTINIQUE_TIMEZONE } from '../src/utils/dayjsMartinique';
import { 
  Filter, 
  Search, 
  UserPlus, 
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  X,
  Phone,
  CalendarX,
  Trash2,
  CheckSquare,
  Square,
  AlertTriangle,
  Mail,
  Edit,
  KeyRound,
  Loader2
} from 'lucide-react';

// Extended List of Specialties
const PROVIDER_SPECIALTIES = [
    "Ménage / Entretien",
    "Bricolage",
    "Plomberie",
    "Électricité",
    "Peinture",
    "Climatisation",
    "Piscine / Entretien Bassin",
    "Maçonnerie",
    "Menuiserie",
    "Serrurerie",
    "Aide à domicile (Personnes âgées)",
    "Garde d'enfants",
    "Soutien scolaire",
    "Assistance administrative",
    "Informatique / Numérique",
    "Coiffure à domicile",
    "Esthétique à domicile",
    "Livraison de repas",
    "Déménagement",
    "Gardiennage",
    "Autre"
];

const NON_INTERVENTION_DAY_OPTIONS: Array<{ value: number; label: string }> = [
    { value: 1, label: 'Lundi' },
    { value: 2, label: 'Mardi' },
    { value: 3, label: 'Mercredi' },
    { value: 4, label: 'Jeudi' },
    { value: 5, label: 'Vendredi' },
    { value: 6, label: 'Samedi' },
    { value: 0, label: 'Dimanche' }
];

const getDayLabel = (dayIndex: number) => {
  return NON_INTERVENTION_DAY_OPTIONS.find(d => d.value === dayIndex)?.label || String(dayIndex);
};

const getProviderCreatedAtMs = (p: any) => {
  const raw = p?.created_at || p?.createdAt || p?.created || p?.created_on;
  const ms = raw ? new Date(raw).getTime() : NaN;
  return Number.isFinite(ms) ? ms : 0;
};

const Providers: React.FC = () => {
  const { providers, missions, clients, addProvider, updateProvider, deleteProviders, addLeave, deleteLeave, resetProviderPassword, refreshData, dataLoading } = useData();
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const PAGE_SIZE = 20;
  const [page, setPage] = useState(1);
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const [sortKey, setSortKey] = useState<'inscription' | 'name' | 'hours' | 'status' | 'planned_missions'>('inscription');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [currentEditId, setCurrentEditId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [selectedProviderId, setSelectedProviderId] = useState<string>('');

  const [isProviderDetailsOpen, setIsProviderDetailsOpen] = useState(false);
  const [selectedProviderDetailsId, setSelectedProviderDetailsId] = useState<string | null>(null);

  const [isNonInterventionDetailsOpen, setIsNonInterventionDetailsOpen] = useState(false);
  const [suDayOfWeek, setSuDayOfWeek] = useState('1');
  const [nonInterventionProviderId, setNonInterventionProviderId] = useState<string | null>(null);

  const selectedNonInterventionProvider = useMemo(() => {
    if (!nonInterventionProviderId) return null;
    return (providers || []).find(p => p.id === nonInterventionProviderId) || null;
  }, [providers, nonInterventionProviderId]);

  const [isMissionDetailsOpen, setIsMissionDetailsOpen] = useState(false);
  const [selectedMissionId, setSelectedMissionId] = useState<string | null>(null);

  const selectedMissionDetails = useMemo(() => {
    if (!selectedMissionId) return null;
    return (missions || []).find((m: any) => String(m?.id || '') === String(selectedMissionId)) || null;
  }, [missions, selectedMissionId]);

  const selectedMissionClient = useMemo(() => {
    if (!selectedMissionDetails) return null;
    const clientId = (selectedMissionDetails as any)?.clientId;
    if (!clientId) return null;
    return (clients || []).find((c: any) => String(c?.id || '') === String(clientId)) || null;
  }, [clients, selectedMissionDetails]);

  const selectedProviderDetails = useMemo(() => {
    if (!selectedProviderDetailsId) return null;
    return (providers || []).find(p => p.id === selectedProviderDetailsId) || null;
  }, [providers, selectedProviderDetailsId]);

  const providerMissions = useMemo(() => {
    if (!selectedProviderDetailsId) return [] as Mission[];
    const list = (missions || []).filter((m: any) => String(m?.providerId || '') === String(selectedProviderDetailsId));
    return list.slice().sort((a: any, b: any) => String(b?.date || '').localeCompare(String(a?.date || '')));
  }, [missions, selectedProviderDetailsId]);

  const providerPlannedMissions = useMemo(() => {
    return providerMissions.filter(m => m.status === 'planned');
  }, [providerMissions]);

  const providerMissionStats = useMemo(() => {
    const total = providerMissions.length;
    const planned = providerMissions.filter(m => m.status === 'planned').length;
    const inProgress = providerMissions.filter(m => m.status === 'in_progress').length;
    const completed = providerMissions.filter(m => m.status === 'completed').length;
    const cancelled = providerMissions.filter(m => m.status === 'cancelled').length;
    const totalHours = providerMissions.reduce((acc, m) => acc + (Number(m.duration) || 0), 0);
    return { total, planned, inProgress, completed, cancelled, totalHours };
  }, [providerMissions]);
  
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  
  const [toast, setToast] = useState<{ show: boolean; message: string; type?: 'success' | 'error' | 'warning' }>({ show: false, message: '', type: 'success' });

  // Credential Modal State
  const [newCredential, setNewCredential] = useState<{ email: string, pass: string } | null>(null);

  const [formData, setFormData] = useState({
    lastName: '',
    firstName: '',
    specialty: 'Ménage / Entretien',
    phone: '',
    email: '',
    status: 'Active',
    nonInterventionDays: [] as number[],
    nonInterventionHours: {} as Record<number, Array<{ start: string; end: string }>>,
    // Nouveau système de disponibilité
    availabilityMode: 'unavailable' as 'unavailable' | 'available',
    availabilityHours: {} as Record<number, Array<{ start: string; end: string }>>,
    // Indisponibilités programmées sur N semaines
    scheduledUnavailabilities: [] as Array<{ id: string; dayOfWeek: number; startTime: string; endTime: string; startDate: string; weeks: number }>,
    // Indisponibilités ponctuelles (date + créneau unique)
    oneTimeUnavailabilities: [] as Array<{ id: string; date: string; startTime: string; endTime: string; reason?: string }>
  });

  const [leaveForm, setLeaveForm] = useState({
      startDate: '',
      endDate: ''
  });

  useEffect(() => {
    if (location.state) {
        const state = location.state as { filter?: string; applyFilter?: boolean };
        if (state.filter && state.applyFilter) setFilterStatus(state.filter);
    }
  }, [location]);

  const filteredProviders = useMemo(() => {
    let result = providers;
    if (filterStatus !== 'all') {
        result = result.filter(p => p.status.toLowerCase() === filterStatus.toLowerCase());
    }
    if (searchQuery) {
        const query = searchQuery.toLowerCase();
        result = result.filter(p => 
            p.lastName.toLowerCase().includes(query) || 
            p.firstName.toLowerCase().includes(query) ||
            p.specialty.toLowerCase().includes(query)
        );
    }
    return result;
  }, [providers, filterStatus, searchQuery]);

  const plannedMissionsCountByProvider = useMemo(() => {
    const map = new Map<string, number>();
    (missions || []).forEach((m: any) => {
      if (m?.status !== 'planned') return;
      const pid = String(m?.providerId || '');
      if (!pid) return;
      map.set(pid, (map.get(pid) || 0) + 1);
    });
    return map;
  }, [missions]);

  const inProgressMissionsCountByProvider = useMemo(() => {
    const map = new Map<string, number>();
    (missions || []).forEach((m: any) => {
      if (m?.status !== 'in_progress') return;
      const pid = String(m?.providerId || '');
      if (!pid) return;
      map.set(pid, (map.get(pid) || 0) + 1);
    });
    return map;
  }, [missions]);

  // Filtres par colonne (tableau)
  const [columnFilters, setColumnFilters] = useState({
    name: '',
    contact: '',
    specialty: '',
    hours: '',
    status: ''
  });

  const columnFilteredProviders = useMemo(() => {
    let result = filteredProviders;

    if (columnFilters.name) {
      const q = columnFilters.name.toLowerCase();
      result = result.filter(p => `${p.firstName || ''} ${p.lastName || ''}`.toLowerCase().includes(q));
    }

    if (columnFilters.contact) {
      const q = columnFilters.contact.toLowerCase();
      result = result.filter(p =>
        (p.phone || '').toLowerCase().includes(q) ||
        (p.email || '').toLowerCase().includes(q)
      );
    }

    if (columnFilters.specialty) {
      const q = columnFilters.specialty.toLowerCase();
      result = result.filter(p => (p.specialty || '').toLowerCase().includes(q));
    }

    if (columnFilters.hours) {
      const q = columnFilters.hours.toLowerCase();
      result = result.filter(p => String(p.hoursWorked ?? '').toLowerCase().includes(q));
    }

    if (columnFilters.status) {
      const q = columnFilters.status.toLowerCase();
      result = result.filter(p => (p.status || '').toLowerCase().includes(q));
    }

    return result;
  }, [filteredProviders, columnFilters]);

  const sortedProviders = useMemo(() => {
    const list = (columnFilteredProviders || []).slice();
    const dir = sortDirection === 'asc' ? 1 : -1;

    list.sort((a: any, b: any) => {
      if (sortKey === 'inscription') {
        return (getProviderCreatedAtMs(a) - getProviderCreatedAtMs(b)) * dir;
      }
      if (sortKey === 'hours') {
        return ((Number(a?.hoursWorked) || 0) - (Number(b?.hoursWorked) || 0)) * dir;
      }
      if (sortKey === 'status') {
        return String(a?.status || '').localeCompare(String(b?.status || '')) * dir;
      }
      if (sortKey === 'planned_missions') {
        const ca = plannedMissionsCountByProvider.get(String(a?.id || '')) || 0;
        const cb = plannedMissionsCountByProvider.get(String(b?.id || '')) || 0;
        return (ca - cb) * dir;
      }
      // name
      const na = `${a?.lastName || ''} ${a?.firstName || ''}`.trim().toLowerCase();
      const nb = `${b?.lastName || ''} ${b?.firstName || ''}`.trim().toLowerCase();
      return na.localeCompare(nb) * dir;
    });

    return list;
  }, [columnFilteredProviders, plannedMissionsCountByProvider, sortDirection, sortKey]);

  useEffect(() => {
    setPage(1);
  }, [filterStatus, searchQuery, columnFilters, sortKey, sortDirection]);

  const pagedProviders = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return sortedProviders.slice(start, start + PAGE_SIZE);
  }, [sortedProviders, page]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const openCreateModal = () => {
      setIsEditMode(false);
      setCurrentEditId(null);
      setFormData({ lastName: '', firstName: '', specialty: 'Ménage / Entretien', phone: '', email: '', status: 'Active', nonInterventionDays: [], nonInterventionHours: {}, availabilityMode: 'unavailable', availabilityHours: {}, scheduledUnavailabilities: [], oneTimeUnavailabilities: [] });
      setIsModalOpen(true);
  };

  const openEditModal = (provider: any) => {
      setIsEditMode(true);
      setCurrentEditId(provider.id);
      setFormData({
          lastName: provider.lastName,
          firstName: provider.firstName,
          specialty: provider.specialty,
          phone: provider.phone,
          email: provider.email,
          status: provider.status,
          nonInterventionDays: Array.isArray(provider?.nonInterventionDays) ? provider.nonInterventionDays : [],
          nonInterventionHours: (provider?.nonInterventionHours && typeof provider.nonInterventionHours === 'object') ? provider.nonInterventionHours : {},
          availabilityMode: provider?.availabilityMode || 'unavailable',
          availabilityHours: (provider?.availabilityHours && typeof provider.availabilityHours === 'object') ? provider.availabilityHours : {},
          scheduledUnavailabilities: Array.isArray(provider?.scheduledUnavailabilities) ? provider.scheduledUnavailabilities : [],
          oneTimeUnavailabilities: Array.isArray(provider?.oneTimeUnavailabilities) ? provider.oneTimeUnavailabilities : []
      });
      setIsModalOpen(true);
  };

  // Handle URL param for editing provider
  useEffect(() => {
    const editId = searchParams.get('edit');
    if (editId && providers.length > 0) {
      const providerToEdit = providers.find(p => p.id === editId);
      if (providerToEdit) {
        openEditModal(providerToEdit);
        // Clear the URL param after opening modal
        window.history.replaceState({}, '', '/providers');
      }
    }
  }, [searchParams, providers]);

  const addNonInterventionRange = (day: number) => {
      setFormData(prev => {
          const current = (prev as any).nonInterventionHours && typeof (prev as any).nonInterventionHours === 'object'
              ? (prev as any).nonInterventionHours
              : {};
          const ranges = Array.isArray(current[day]) ? current[day] : [];
          return {
              ...prev,
              nonInterventionHours: {
                  ...current,
                  [day]: [...ranges, { start: '08:00', end: '10:00' }]
              }
          };
      });
  };

  const updateNonInterventionRange = (day: number, index: number, key: 'start' | 'end', value: string) => {
      setFormData(prev => {
          const current = (prev as any).nonInterventionHours && typeof (prev as any).nonInterventionHours === 'object'
              ? (prev as any).nonInterventionHours
              : {};
          const ranges = Array.isArray(current[day]) ? current[day].slice() : [];
          if (!ranges[index]) return prev;
          ranges[index] = { ...ranges[index], [key]: value };
          return {
              ...prev,
              nonInterventionHours: {
                  ...current,
                  [day]: ranges
              }
          };
      });
  };

  const removeNonInterventionRange = (day: number, index: number) => {
      setFormData(prev => {
          const current = (prev as any).nonInterventionHours && typeof (prev as any).nonInterventionHours === 'object'
              ? (prev as any).nonInterventionHours
              : {};
          const ranges = Array.isArray(current[day]) ? current[day].slice() : [];
          const nextRanges = ranges.filter((_: any, i: number) => i !== index);
          const next = { ...current, [day]: nextRanges };
          if (nextRanges.length === 0) {
              delete (next as any)[day];
          }
          return {
              ...prev,
              nonInterventionHours: next
          };
      });
  };

  const toggleNonInterventionDay = (day: number) => {
      setFormData(prev => {
          const current = Array.isArray((prev as any).nonInterventionDays) ? (prev as any).nonInterventionDays : [];
          const next = current.includes(day) ? current.filter((d: number) => d !== day) : [...current, day];
          return { ...prev, nonInterventionDays: next };
      });
  };

  const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setIsSubmitting(true);
      
      try {
          if (isEditMode && currentEditId) {
              await updateProvider(currentEditId, {
                  lastName: formData.lastName,
                  firstName: formData.firstName,
                  specialty: formData.specialty,
                  phone: formData.phone,
                  email: formData.email,
                  status: formData.status as any,
                  nonInterventionDays: formData.nonInterventionDays,
                  nonInterventionHours: formData.nonInterventionHours,
                  availabilityMode: formData.availabilityMode,
                  availabilityHours: formData.availabilityHours,
                  scheduledUnavailabilities: formData.scheduledUnavailabilities,
                  oneTimeUnavailabilities: formData.oneTimeUnavailabilities
              });
              showToast(`Fiche de ${formData.firstName} ${formData.lastName} mise à jour.`);
              setIsModalOpen(false);
          } else {
              // Creating new provider
              const newPass = await addProvider({
                  lastName: formData.lastName,
                  firstName: formData.firstName,
                  specialty: formData.specialty,
                  phone: formData.phone,
                  email: formData.email,
                  status: formData.status as 'Active',
                  nonInterventionDays: formData.nonInterventionDays,
                  nonInterventionHours: formData.nonInterventionHours,
                  availabilityMode: formData.availabilityMode,
                  availabilityHours: formData.availabilityHours,
                  scheduledUnavailabilities: formData.scheduledUnavailabilities,
                  oneTimeUnavailabilities: formData.oneTimeUnavailabilities
              });
              
              setIsModalOpen(false);
              
              if (newPass) {
                  // Open the credential modal
                  setNewCredential({ email: formData.email, pass: newPass });
              } else {
                  showToast(`Prestataire créé avec succès ! (Pas d'email envoyé)`);
              }
          }
          // Reset form
          setFormData({ lastName: '', firstName: '', specialty: 'Ménage / Entretien', phone: '', email: '', status: 'Active', nonInterventionDays: [], nonInterventionHours: {}, availabilityMode: 'unavailable', availabilityHours: {}, scheduledUnavailabilities: [], oneTimeUnavailabilities: [] });
      } catch (error) {
          console.error("Erreur soumission prestataire:", error);
          showToast(String((error as any)?.message || 'Une erreur est survenue.'), 'error');
      } finally {
          setIsSubmitting(false);
      }
  };

  const handleLeaveSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (selectedProviderId && leaveForm.startDate && leaveForm.endDate) {
          addLeave(selectedProviderId, leaveForm.startDate, leaveForm.endDate, undefined, undefined, 'approved');
          setIsLeaveModalOpen(false);
          showToast('Congés déclarés et pris en compte immédiatement dans les disponibilités.');
          setLeaveForm({ startDate: '', endDate: '' });
      }
  };

  const handleDeleteLeave = async (leaveId: string) => {
      if (!selectedProviderId) return;
      if (!window.confirm('Supprimer ce congé ? Les disponibilités seront recalculées.')) return;
      await deleteLeave(leaveId, selectedProviderId);
      showToast('Congé supprimé. Disponibilités réactivées.');
  };

  const setQuickRange = (weeks: number) => {
      const today = getMartiniqueNow();
      const startDate = leaveForm.startDate || today.format('YYYY-MM-DD');
      const start = dayjs.tz(startDate, 'YYYY-MM-DD', MARTINIQUE_TIMEZONE);
      const end = start.add(weeks * 7 - 1, 'day');
      setLeaveForm({
          startDate: startDate,
          endDate: end.format('YYYY-MM-DD')
      });
  };

  const handleResetPassword = (id: string) => {
      if(window.confirm("Êtes-vous sûr de vouloir réinitialiser le mot de passe de ce prestataire ?")) {
          resetProviderPassword(id);
          showToast('Mot de passe réinitialisé et envoyé par email.', 'success');
      }
  };

  const showToast = (message: string, type: 'success' | 'error' | 'warning' = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type }), 3000);
  };

  const openLeaveModal = (id: string) => {
      setSelectedProviderId(id);
      setIsLeaveModalOpen(true);
  };

  const showCredentials = (provider: any) => {
      alert(`[ACCÈS PRESTATAIRE]
      
Intervenant : ${provider.firstName} ${provider.lastName}
Email : ${provider.email}
Mot de passe initial : ${provider.initialPassword || 'Non disponible (déjà modifié ou inconnu)'}

Lien de connexion : https://presta-antilles.app/login`);
  };

  const toggleSelection = (id: string) => {
      const newSet = new Set(selectedIds);
      if (newSet.has(id)) {
          newSet.delete(id);
      } else {
          newSet.add(id);
      }
      setSelectedIds(newSet);
  };

  const toggleSelectAll = () => {
      if (selectedIds.size === sortedProviders.length) {
          setSelectedIds(new Set());
      } else {
          setSelectedIds(new Set(sortedProviders.map(p => p.id)));
      }
  };

  const confirmBulkDelete = () => {
      if (selectedIds.size > 0) {
          setDeleteConfirmOpen(true);
      }
  };

  const executeBulkDelete = async () => {
      try {
          const ids = Array.from(selectedIds);
          await deleteProviders(ids);
          if (typeof refreshData === 'function') {
              await refreshData();
          }
          setSelectedIds(new Set());
          setDeleteConfirmOpen(false);
          showToast('Prestataires supprimés avec succès.');
      } catch (e: any) {
          console.error('[Providers] Bulk delete failed:', e);
          const msg = String(e?.message || '').toLowerCase();
          const code = e?.code;
          if (code === '23503' || msg.includes('foreign key') || msg.includes('clé étrang') || msg.includes('contrainte')) {
              showToast("Suppression impossible: ce prestataire est encore lié à des missions/absences. Supprime d'abord ses éléments liés.", 'error');
          } else if (code === '409' || String(code) === '409' || msg.includes('409')) {
              showToast("Suppression impossible (conflit). Le prestataire est probablement encore référencé.", 'error');
          } else {
              showToast("Erreur lors de la suppression des prestataires.", 'error');
          }
      }
  };

  return dataLoading ? <PageLoader /> : (
    <div className="p-8 h-full overflow-y-auto bg-white/40 relative">
      
       <div className={`fixed bottom-6 right-6 z-[100] transition-all duration-500 transform ${toast.show ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0 pointer-events-none'}`}>
        <div className={`px-6 py-4 rounded-lg shadow-2xl flex items-center gap-3 border ${
            toast.type === 'error' ? 'bg-red-800 text-white border-red-700' :
            toast.type === 'warning' ? 'bg-orange-800 text-white border-orange-700' :
            'bg-green-800 text-white border-green-700'
        }`}>
            <div className={`p-1 rounded-full text-white ${
                toast.type === 'error' ? 'bg-red-500' :
                toast.type === 'warning' ? 'bg-orange-500' :
                'bg-green-500'
            }`}>
                {toast.type === 'error' ? <AlertTriangle className="w-4 h-4" /> :
                 toast.type === 'warning' ? <AlertTriangle className="w-4 h-4" /> :
                 <CheckCircle className="w-4 h-4" />}
            </div>
            <div>
                <h4 className="font-bold text-sm">
                    {toast.type === 'error' ? 'Erreur' :
                     toast.type === 'warning' ? 'Attention' :
                     'Succès'}
                </h4>
                <p className="text-xs opacity-90">{toast.message}</p>
            </div>
        </div>
      </div>

      {/* ListingFilterBar — Filtres, tri et recherche */}
      <div className="mb-4">
        <ListingFilterBar
          searchValue={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder="Nom, spécialité..."
          sortOptions={[
            { value: 'inscription', label: 'Inscription' },
            { value: 'name', label: 'Nom' },
            { value: 'hours', label: 'Heures' },
            { value: 'status', label: 'Statut' },
            { value: 'planned_missions', label: 'Missions planifiées' },
          ]}
          sortValue={sortKey}
          onSortChange={(v) => setSortKey(v as any)}
          sortDirection={sortDirection}
          onSortDirectionToggle={() => setSortDirection(d => d === 'asc' ? 'desc' : 'asc')}
          filters={[
            {
              key: 'status',
              label: 'Statut',
              placeholder: 'Tous',
              options: [
                { value: 'active', label: 'Actifs' },
                { value: 'passive', label: 'Passifs' },
                { value: 'inactive', label: 'Inactifs' },
              ],
            },
          ]}
          filterValues={{ status: filterStatus }}
          onFilterChange={(key, value) => {
            if (key === 'status') setFilterStatus(value as string);
          }}
          filteredCount={sortedProviders.length}
          totalCount={providers.length}
          entityLabel="prestataire(s)"
          onReset={() => { setFilterStatus('all'); setSearchQuery(''); setSortKey('inscription'); setSortDirection('desc'); }}
          hasActiveFilters={filterStatus !== 'all' || searchQuery !== '' || sortKey !== 'inscription' || sortDirection !== 'desc'}
        />
      </div>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">
        <div>
          <h2 className="text-3xl font-serif font-bold text-slate-800">Prestataires</h2>
          <p className="text-sm text-slate-500 mt-1">Suivi des équipes et heures travaillées</p>
        </div>
        <div className="flex gap-4 flex-wrap">
            {selectedIds.size > 0 && (
               <button onClick={confirmBulkDelete} className="bg-red-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-bold shadow-sm hover:bg-red-600 transition animate-in fade-in">
                   <Trash2 className="w-4 h-4" /> Supprimer ({selectedIds.size})
               </button>
            )}
          <button 
            onClick={openCreateModal}
            className="bg-brand-blue text-white px-4 py-2 rounded-lg flex items-center gap-2 font-bold shadow-sm hover:bg-teal-700 transition"
          >
              <UserPlus className="w-4 h-4" /> Ajouter
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">

         <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
                <thead className="text-xs text-slate-500 uppercase bg-slate-50/80 border-b border-slate-100">
                    <tr>
                        <th className="px-6 py-4 w-10">
                            <button onClick={toggleSelectAll} className="text-slate-500 hover:text-slate-700">
                                {selectedIds.size > 0 && selectedIds.size === columnFilteredProviders.length ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                            </button>
                        </th>
                        <th className="px-6 py-4 font-bold">Prestataire</th>
                        <th className="px-6 py-4 font-bold">Contact</th>
                        <th className="px-6 py-4 font-bold">Spécialité</th>
                        <th className="px-6 py-4 font-bold text-center">Heures (Mois)</th>
                        <th className="px-6 py-4 font-bold text-center">Statut</th>
                        <th className="px-6 py-4 font-bold text-right">Actions</th>
                    </tr>
                    <tr className="bg-white/60">
                        <th className="px-6 py-2"></th>
                        <th className="px-6 py-2">
                            <input
                                value={columnFilters.name}
                                onChange={(e) => setColumnFilters(prev => ({ ...prev, name: e.target.value }))}
                                placeholder="Filtrer..."
                                className="w-full border border-slate-200 rounded px-2 py-1 text-xs font-medium text-slate-700 bg-white"
                            />
                        </th>
                        <th className="px-6 py-2">
                            <input
                                value={columnFilters.contact}
                                onChange={(e) => setColumnFilters(prev => ({ ...prev, contact: e.target.value }))}
                                placeholder="Tel/Email..."
                                className="w-full border border-slate-200 rounded px-2 py-1 text-xs font-medium text-slate-700 bg-white"
                            />
                        </th>
                        <th className="px-6 py-2">
                            <input
                                value={columnFilters.specialty}
                                onChange={(e) => setColumnFilters(prev => ({ ...prev, specialty: e.target.value }))}
                                placeholder="Spécialité..."
                                className="w-full border border-slate-200 rounded px-2 py-1 text-xs font-medium text-slate-700 bg-white"
                            />
                        </th>
                        <th className="px-6 py-2">
                            <input
                                value={columnFilters.hours}
                                onChange={(e) => setColumnFilters(prev => ({ ...prev, hours: e.target.value }))}
                                placeholder="Heures..."
                                className="w-full border border-slate-200 rounded px-2 py-1 text-xs font-medium text-slate-700 bg-white"
                            />
                        </th>
                        <th className="px-6 py-2">
                            <input
                                value={columnFilters.status}
                                onChange={(e) => setColumnFilters(prev => ({ ...prev, status: e.target.value }))}
                                placeholder="Statut..."
                                className="w-full border border-slate-200 rounded px-2 py-1 text-xs font-medium text-slate-700 bg-white"
                            />
                        </th>
                        <th className="px-6 py-2"></th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                    {sortedProviders.length > 0 ? (
                        pagedProviders.map(p => (
                            <tr key={p.id} className={`hover:bg-cream-50 transition-colors group ${selectedIds.has(p.id) ? 'bg-blue-50' : ''}`}>
                                <td className="px-6 py-4">
                                    <button onClick={() => toggleSelection(p.id)} className="text-slate-400 hover:text-brand-blue">
                                        {selectedIds.has(p.id) ? <CheckSquare className="w-4 h-4 text-brand-blue" /> : <Square className="w-4 h-4" />}
                                    </button>
                                </td>
                                <td className="px-6 py-4 font-bold text-slate-700">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSelectedProviderDetailsId(p.id);
                                            setIsProviderDetailsOpen(true);
                                        }}
                                        className="hover:underline"
                                        title="Voir fiche prestataire"
                                    >
                                        {(() => {
                                          const cnt = inProgressMissionsCountByProvider.get(String(p.id)) || 0;
                                          const firstName = p?.firstName || '';
                                          const lastName = p?.lastName || '';
                                          const displayName = `${firstName} ${lastName}`.trim();
                                          const isNameLoading = dataLoading || (!firstName && !lastName && p?.id);
                                          return (
                                            <span className="text-slate-700 font-bold flex items-center gap-2">
                                              {cnt > 0 && (
                                                <span className="mr-1 text-xs font-bold text-blue-700">({cnt})</span>
                                              )}
                                              {isNameLoading ? (
                                                <span className="flex items-center gap-2 text-slate-500">
                                                  <Loader2 className="w-3 h-3 animate-spin" />
                                                  Chargement du nom...
                                                </span>
                                              ) : (
                                                displayName || 'Sans nom'
                                              )}
                                            </span>
                                          );
                                        })()}
                                    </button>
                                    <div className="mt-1 text-[11px] font-medium text-slate-600">
                                      {(() => {
                                        const planned = (missions || [])
                                          .filter((m: any) => String(m?.providerId || '') === String(p.id) && m?.status === 'planned')
                                          .slice()
                                          .sort((a: any, b: any) => String(a?.date || '').localeCompare(String(b?.date || '')));

                                        if (planned.length === 0) return null;

                                        return (
                                          <div className="flex flex-col gap-1">
                                            {planned.slice(0, 3).map((m: any) => (
                                              <button
                                                key={`planned-mini-${p.id}-${m.id}`}
                                                type="button"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  setSelectedMissionId(m.id);
                                                  setIsMissionDetailsOpen(true);
                                                }}
                                                className="text-left truncate hover:underline"
                                                title="Voir les détails de la mission"
                                              >
                                                {m.date} {m.startTime}-{m.endTime} · {m.clientName}
                                              </button>
                                            ))}
                                            {planned.length > 3 && (
                                              <div className="text-[10px] text-slate-400">+{planned.length - 3} autre(s)</div>
                                            )}
                                          </div>
                                        );
                                      })()}
                                    </div>
                                    {Array.isArray((p as any).nonInterventionDays) && (p as any).nonInterventionDays.length > 0 && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setNonInterventionProviderId(p.id);
                                          setIsNonInterventionDetailsOpen(true);
                                        }}
                                        className="ml-2 text-[10px] bg-orange-100 text-orange-800 px-1.5 py-0.5 rounded hover:bg-orange-200 transition"
                                        title="Voir les détails des non-interventions"
                                      >
                                        {(p as any).nonInterventionDays
                                          .slice()
                                          .sort((a: number, b: number) => a - b)
                                          .map((d: number) => getDayLabel(d))
                                          .join(', ')}
                                      </button>
                                    )}
                                    {Array.isArray((p as any).scheduledUnavailabilities) && (p as any).scheduledUnavailabilities.length > 0 && (
                                      <span
                                        className="ml-1 text-[10px] bg-orange-200 text-orange-900 px-1.5 py-0.5 rounded font-bold"
                                        title={`${(p as any).scheduledUnavailabilities.length} indisponibilité(s) programmée(s)`}
                                      >
                                        📅 {(p as any).scheduledUnavailabilities.length} program.
                                      </span>
                                    )}
                                    {Array.isArray((p as any).oneTimeUnavailabilities) && (p as any).oneTimeUnavailabilities.length > 0 && (
                                      <span
                                        className="ml-1 text-[10px] bg-rose-200 text-rose-900 px-1.5 py-0.5 rounded font-bold"
                                        title={`${(p as any).oneTimeUnavailabilities.length} indisponibilité(s) ponctuelle(s)`}
                                      >
                                        🕐 {(p as any).oneTimeUnavailabilities.length} ponct.
                                      </span>
                                    )}
                                </td>
                                <td className="px-6 py-4 text-slate-600">
                                    <div className="flex flex-col text-xs">
                                        <span className="flex items-center gap-1"><Phone className="w-3 h-3 text-slate-400"/> {p.phone}</span>
                                        <span className="flex items-center gap-1"><Mail className="w-3 h-3 text-slate-400"/> {p.email}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-slate-600">
                                    <span className="bg-slate-100 px-2 py-1 rounded text-xs font-medium">{p.specialty}</span>
                                </td>
                                <td className="px-6 py-4 text-center">
                                    <div className="flex items-center justify-center gap-2 font-mono text-slate-600">
                                        <Clock className="w-3 h-3 text-slate-400" />
                                        {p.hoursWorked}h
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-center">
                                    {p.status === 'Active' && <span className="inline-flex items-center gap-1 text-xs font-bold text-green-700 bg-green-100 px-2 py-1 rounded-full border border-green-200"><CheckCircle className="w-3 h-3"/> Actif</span>}
                                    {p.status === 'Passive' && <span className="inline-flex items-center gap-1 text-xs font-bold text-orange-700 bg-orange-100 px-2 py-1 rounded-full border border-orange-200"><AlertCircle className="w-3 h-3"/> Passif</span>}
                                    {p.status === 'Inactive' && <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-full border border-slate-200"><XCircle className="w-3 h-3"/> Inactif</span>}
                                </td>
                                <td className="px-6 py-4 text-right flex justify-end gap-2">
                                  
                                    <button 
                                        onClick={() => openEditModal(p)}
                                        className="text-slate-400 hover:text-brand-blue p-1 rounded hover:bg-slate-100 border border-transparent hover:border-slate-200" 
                                        title="Modifier"
                                    >
                                        <Edit className="w-4 h-4" />
                                    </button>
                                    <button 
                                        onClick={() => handleResetPassword(p.id)}
                                        className="text-slate-400 hover:text-brand-orange p-1 rounded hover:bg-slate-100 border border-transparent hover:border-slate-200" 
                                        title="Réinitialiser Mot de Passe"
                                    >
                                        <KeyRound className="w-4 h-4" />
                                    </button>
                                    <button 
                                        onClick={() => openLeaveModal(p.id)} 
                                        className="text-slate-500 hover:text-brand-orange font-bold text-xs border border-slate-200 rounded px-2 py-1 flex items-center gap-1"
                                    >
                                        <CalendarX className="w-3 h-3" /> Congés
                                    </button>
                                </td>
                            </tr>
                        ))
                    ) : (
                        <tr>
                            <td colSpan={7} className="px-6 py-8 text-center text-slate-400">
                                Aucun prestataire trouvé.
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>

            <Pagination
                page={page}
                pageSize={PAGE_SIZE}
                total={sortedProviders.length}
                onPageChange={setPage}
            />
         </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200 max-h-[90vh]">
                <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-cream-50">
                    <div>
                        <h3 className="text-xl font-serif font-bold text-slate-800">{isEditMode ? 'Modifier Prestataire' : 'Nouveau Prestataire'}</h3>
                        <p className="text-xs text-slate-500 mt-1">{isEditMode ? 'Mettre à jour les informations' : "Ajouter un membre à l'équipe"}</p>
                    </div>
                    <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full transition">
                        <X className="w-5 h-5 text-slate-500" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto">
                     <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1">Nom</label>
                            <input 
                                required
                                type="text" 
                                name="lastName"
                                value={formData.lastName}
                                onChange={handleInputChange}
                                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg focus:border-brand-blue focus:ring-1 focus:ring-brand-blue outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1">Prénom</label>
                            <input 
                                required
                                type="text" 
                                name="firstName"
                                value={formData.firstName}
                                onChange={handleInputChange}
                                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg focus:border-brand-blue focus:ring-1 focus:ring-brand-blue outline-none"
                            />
                        </div>
                    </div>
                    
                    <div>
                         <label className="block text-sm font-bold text-slate-700 mb-1">Spécialité</label>
                         <SearchableSelect
                            options={PROVIDER_SPECIALTIES.map(s => ({ value: s, label: s }))}
                            value={formData.specialty}
                            onChange={(value) => handleInputChange({ target: { name: 'specialty', value } } as React.ChangeEvent<HTMLSelectElement>)}
                            triggerClassName="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"
                         />
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Jours de non-interventions</label>
                        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                {NON_INTERVENTION_DAY_OPTIONS.map(d => {
                                    const checked = Array.isArray(formData.nonInterventionDays) && formData.nonInterventionDays.includes(d.value);
                                    return (
                                        <button
                                            key={d.value}
                                            type="button"
                                            onClick={() => toggleNonInterventionDay(d.value)}
                                            className={`px-3 py-2 rounded-lg text-xs font-bold border transition ${checked
                                                ? 'bg-orange-100 text-orange-800 border-orange-200'
                                                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                                            }`}
                                        >
                                            {d.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    <div>
                        {/* En-tête avec label et toggle */}
                        <div className="flex items-center justify-between mb-2">
                            <label className="block text-sm font-bold text-slate-700">
                                {formData.availabilityMode === 'unavailable' ? 'Heures de non-disponibilité (récurrent)' : 'Heures de disponibilité (récurrent)'}
                            </label>
                            <div className="flex items-center gap-2">
                                <span className={`text-xs font-medium ${formData.availabilityMode === 'unavailable' ? 'text-orange-600' : 'text-slate-400'}`}>
                                    Indisponibilité
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setFormData(prev => ({ ...prev, availabilityMode: prev.availabilityMode === 'unavailable' ? 'available' : 'unavailable' }))}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand-blue focus:ring-offset-2 ${
                                        formData.availabilityMode === 'available' ? 'bg-green-500' : 'bg-orange-500'
                                    }`}
                                >
                                    <span
                                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                            formData.availabilityMode === 'available' ? 'translate-x-6' : 'translate-x-1'
                                        }`}
                                    />
                                </button>
                                <span className={`text-xs font-medium ${formData.availabilityMode === 'available' ? 'text-green-600' : 'text-slate-400'}`}>
                                    Disponibilité
                                </span>
                            </div>
                        </div>

                        {/* Message explicatif clair */}
                        <div className={`mb-3 p-3 rounded-lg border text-sm ${
                            formData.availabilityMode === 'unavailable'
                                ? 'bg-orange-50 border-orange-200 text-orange-800'
                                : 'bg-green-50 border-green-200 text-green-800'
                        }`}>
                            <div className="flex items-start gap-2">
                                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                                <div>
                                    <p className="font-semibold text-xs mb-1">
                                        {formData.availabilityMode === 'unavailable'
                                            ? 'Mode Indisponibilité : Définissez les plages où le prestataire NE PEUT PAS travailler'
                                            : 'Mode Disponibilité : Définissez UNIQUEMENT les plages où le prestataire PEUT travailler'}
                                    </p>
                                    <p className="text-xs opacity-90">
                                        {formData.availabilityMode === 'unavailable'
                                            ? 'Les missions ne pourront pas être programmées pendant ces horaires. Le prestataire est considéré disponible en dehors de ces plages.'
                                            : 'Les missions ne pourront être programmées QUE pendant ces horaires. Le prestataire est considéré indisponible en dehors de ces plages.'}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-3">
                            {NON_INTERVENTION_DAY_OPTIONS.map(d => {
                                const ranges = formData.availabilityMode === 'unavailable'
                                    ? ((formData.nonInterventionHours && Array.isArray((formData.nonInterventionHours as any)[d.value]))
                                        ? (formData.nonInterventionHours as any)[d.value]
                                        : [])
                                    : ((formData.availabilityHours && Array.isArray((formData.availabilityHours as any)[d.value]))
                                        ? (formData.availabilityHours as any)[d.value]
                                        : []);
                                return (
                                    <div key={`hours-${d.value}`} className="bg-white border border-slate-200 rounded-lg p-3">
                                        <div className="flex items-center justify-between">
                                            <div className="text-xs font-bold text-slate-700">{d.label}</div>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    if (formData.availabilityMode === 'unavailable') {
                                                        addNonInterventionRange(d.value);
                                                    } else {
                                                        setFormData(prev => {
                                                            const current = (prev as any).availabilityHours && typeof (prev as any).availabilityHours === 'object'
                                                                ? (prev as any).availabilityHours
                                                                : {};
                                                            const ranges = Array.isArray(current[d.value]) ? current[d.value] : [];
                                                            return {
                                                                ...prev,
                                                                availabilityHours: {
                                                                    ...current,
                                                                    [d.value]: [...ranges, { start: '08:00', end: '18:00' }]
                                                                }
                                                            };
                                                        });
                                                    }
                                                }}
                                                className={`text-xs font-bold hover:underline ${
                                                    formData.availabilityMode === 'unavailable' ? 'text-brand-blue' : 'text-green-600'
                                                }`}
                                            >
                                                + Ajouter une plage
                                            </button>
                                        </div>

                                        {ranges.length > 0 ? (
                                            <div className="mt-3 space-y-2">
                                                {ranges.map((r: any, idx: number) => (
                                                    <div key={`range-${d.value}-${idx}`} className="flex items-center gap-2">
                                                        <input
                                                            type="time"
                                                            value={r.start || '08:00'}
                                                            onChange={(e) => {
                                                                if (formData.availabilityMode === 'unavailable') {
                                                                    updateNonInterventionRange(d.value, idx, 'start', e.target.value);
                                                                } else {
                                                                    setFormData(prev => {
                                                                        const current = (prev as any).availabilityHours && typeof (prev as any).availabilityHours === 'object'
                                                                            ? (prev as any).availabilityHours
                                                                            : {};
                                                                        const ranges = Array.isArray(current[d.value]) ? current[d.value].slice() : [];
                                                                        if (!ranges[idx]) return prev;
                                                                        ranges[idx] = { ...ranges[idx], start: e.target.value };
                                                                        return {
                                                                            ...prev,
                                                                            availabilityHours: {
                                                                                ...current,
                                                                                [d.value]: ranges
                                                                            }
                                                                        };
                                                                    });
                                                                }
                                                            }}
                                                            className={`p-2 border rounded-lg text-xs font-medium ${
                                                                formData.availabilityMode === 'unavailable'
                                                                    ? 'bg-orange-50 border-orange-200'
                                                                    : 'bg-green-50 border-green-200'
                                                            }`}
                                                        />
                                                        <span className="text-xs text-slate-500">à</span>
                                                        <input
                                                            type="time"
                                                            value={r.end || '10:00'}
                                                            onChange={(e) => {
                                                                if (formData.availabilityMode === 'unavailable') {
                                                                    updateNonInterventionRange(d.value, idx, 'end', e.target.value);
                                                                } else {
                                                                    setFormData(prev => {
                                                                        const current = (prev as any).availabilityHours && typeof (prev as any).availabilityHours === 'object'
                                                                            ? (prev as any).availabilityHours
                                                                            : {};
                                                                        const ranges = Array.isArray(current[d.value]) ? current[d.value].slice() : [];
                                                                        if (!ranges[idx]) return prev;
                                                                        ranges[idx] = { ...ranges[idx], end: e.target.value };
                                                                        return {
                                                                            ...prev,
                                                                            availabilityHours: {
                                                                                ...current,
                                                                                [d.value]: ranges
                                                                            }
                                                                        };
                                                                    });
                                                                }
                                                            }}
                                                            className={`p-2 border rounded-lg text-xs font-medium ${
                                                                formData.availabilityMode === 'unavailable'
                                                                    ? 'bg-orange-50 border-orange-200'
                                                                    : 'bg-green-50 border-green-200'
                                                            }`}
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                if (formData.availabilityMode === 'unavailable') {
                                                                    removeNonInterventionRange(d.value, idx);
                                                                } else {
                                                                    setFormData(prev => {
                                                                        const current = (prev as any).availabilityHours && typeof (prev as any).availabilityHours === 'object'
                                                                            ? (prev as any).availabilityHours
                                                                            : {};
                                                                        const ranges = Array.isArray(current[d.value]) ? current[d.value].slice() : [];
                                                                        const nextRanges = ranges.filter((_: any, i: number) => i !== idx);
                                                                        const next = { ...current, [d.value]: nextRanges };
                                                                        if (nextRanges.length === 0) {
                                                                            delete (next as any)[d.value];
                                                                        }
                                                                        return {
                                                                            ...prev,
                                                                            availabilityHours: next
                                                                        };
                                                                    });
                                                                }
                                                            }}
                                                            className="ml-auto p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
                                                            title="Supprimer"
                                                        >
                                                            <X className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="mt-2 text-xs text-slate-400">
                                                {formData.availabilityMode === 'unavailable'
                                                    ? 'Aucune plage d\'indisponibilité'
                                                    : 'Disponible toute la journée (ou non défini)'}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Indisponibilités programmées sur plusieurs semaines */}
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                            <CalendarX className="w-4 h-4 text-orange-500" />
                            Indisponibilités programmées (multi-semaines)
                        </label>
                        <div className="mb-3 p-3 rounded-lg border bg-orange-50 border-orange-200 text-sm text-orange-800">
                            <div className="flex items-start gap-2">
                                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                                <p className="text-xs">
                                    Définissez des créneaux d'indisponibilité récurrents sur <strong>N semaines</strong> à partir d'une date de début.
                                    Utile pour planifier des absences partielles (ex: tous les lundis 8h-12h pendant 4 semaines).
                                </p>
                            </div>
                        </div>

                        {/* Liste des indisponibilités programmées */}
                        {formData.scheduledUnavailabilities.length > 0 && (
                            <div className="space-y-2 mb-3">
                                {formData.scheduledUnavailabilities.map((su, idx) => (
                                    <div key={su.id || idx} className="bg-white border border-orange-200 rounded-lg p-3 flex flex-wrap items-center gap-3">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2 py-1 rounded">
                                                {getDayLabel(su.dayOfWeek)}
                                            </span>
                                            <span className="text-xs font-medium text-orange-700">
                                                {su.startTime} – {su.endTime}
                                            </span>
                                            <span className="text-xs text-slate-500">
                                                à partir du <strong>{su.startDate ? new Date(su.startDate).toLocaleDateString('fr-FR') : '—'}</strong>
                                            </span>
                                            <span className="text-xs font-bold text-orange-600 bg-orange-100 px-2 py-0.5 rounded">
                                                {su.weeks} semaine{su.weeks > 1 ? 's' : ''}
                                            </span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setFormData(prev => ({
                                                    ...prev,
                                                    scheduledUnavailabilities: prev.scheduledUnavailabilities.filter((_, i) => i !== idx)
                                                }));
                                            }}
                                            className="ml-auto p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
                                            title="Supprimer"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Formulaire d'ajout */}
                        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-3">
                            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                                {/* Jour */}
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 mb-1">Jour</label>
                                    <SearchableSelect
                                        options={NON_INTERVENTION_DAY_OPTIONS.map(d => ({ value: String(d.value), label: d.label }))}
                                        value={suDayOfWeek}
                                        onChange={setSuDayOfWeek}
                                        triggerClassName="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs"
                                    />
                                </div>
                                {/* Heure début */}
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 mb-1">Début</label>
                                    <input
                                        id="su-startTime"
                                        type="time"
                                        defaultValue="08:00"
                                        className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs focus:border-brand-blue focus:ring-1 focus:ring-brand-blue outline-none"
                                    />
                                </div>
                                {/* Heure fin */}
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 mb-1">Fin</label>
                                    <input
                                        id="su-endTime"
                                        type="time"
                                        defaultValue="12:00"
                                        className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs focus:border-brand-blue focus:ring-1 focus:ring-brand-blue outline-none"
                                    />
                                </div>
                                {/* Date de début */}
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 mb-1">À partir du</label>
                                    <input
                                        id="su-startDate"
                                        type="date"
                                        defaultValue={getMartiniqueNow().format('YYYY-MM-DD')}
                                        className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs focus:border-brand-blue focus:ring-1 focus:ring-brand-blue outline-none"
                                    />
                                </div>
                                {/* Nombre de semaines */}
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 mb-1">Semaines</label>
                                    <input
                                        id="su-weeks"
                                        type="number"
                                        min={1}
                                        max={52}
                                        defaultValue={4}
                                        className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs focus:border-brand-blue focus:ring-1 focus:ring-brand-blue outline-none"
                                    />
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    const dayOfWeek = parseInt(suDayOfWeek || '1', 10);
                                    const startTime = (document.getElementById('su-startTime') as HTMLInputElement)?.value || '08:00';
                                    const endTime = (document.getElementById('su-endTime') as HTMLInputElement)?.value || '12:00';
                                    const startDate = (document.getElementById('su-startDate') as HTMLInputElement)?.value || getMartiniqueNow().format('YYYY-MM-DD');
                                    const weeks = parseInt((document.getElementById('su-weeks') as HTMLInputElement)?.value || '4', 10);
                                    if (weeks < 1 || !startDate || !startTime || !endTime) return;
                                    setFormData(prev => ({
                                        ...prev,
                                        scheduledUnavailabilities: [
                                            ...prev.scheduledUnavailabilities,
                                            { id: `su-${Date.now()}`, dayOfWeek, startTime, endTime, startDate, weeks }
                                        ]
                                    }));
                                }}
                                className="w-full py-2 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-lg transition flex items-center justify-center gap-2"
                            >
                                <CalendarX className="w-4 h-4" />
                                Ajouter une indisponibilité programmée
                            </button>
                        </div>
                    </div>

                    {/* Indisponibilités ponctuelles */}
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                            <CalendarX className="w-4 h-4 text-rose-500" />
                            Indisponibilités ponctuelles
                        </label>
                        <div className="mb-3 p-3 rounded-lg border bg-rose-50 border-rose-200 text-sm text-rose-800">
                            <div className="flex items-start gap-2">
                                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                                <p className="text-xs">
                                    Définissez une indisponibilité à une <strong>date et heure spécifiques</strong>. Après ce créneau, le prestataire redevient 100% disponible.
                                    Utile pour des RDV médicaux, démarches, etc.
                                </p>
                            </div>
                        </div>

                        {/* Liste des indisponibilités ponctuelles */}
                        {formData.oneTimeUnavailabilities.length > 0 && (
                            <div className="space-y-2 mb-3">
                                {formData.oneTimeUnavailabilities.map((otu, idx) => (
                                    <div key={otu.id || idx} className="bg-white border border-rose-200 rounded-lg p-3 flex flex-wrap items-center gap-3">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2 py-1 rounded">
                                                {otu.date ? new Date(otu.date + 'T12:00:00').toLocaleDateString('fr-FR') : '—'}
                                            </span>
                                            <span className="text-xs font-medium text-rose-700">
                                                {otu.startTime} – {otu.endTime}
                                            </span>
                                            {otu.reason && (
                                                <span className="text-xs text-slate-500 italic">
                                                    {otu.reason}
                                                </span>
                                            )}
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setFormData(prev => ({
                                                    ...prev,
                                                    oneTimeUnavailabilities: prev.oneTimeUnavailabilities.filter((_, i) => i !== idx)
                                                }));
                                            }}
                                            className="ml-auto p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
                                            title="Supprimer"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Formulaire d'ajout */}
                        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-3">
                            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                                {/* Date */}
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 mb-1">Date</label>
                                    <input
                                        id="otu-date"
                                        type="date"
                                        defaultValue={getMartiniqueNow().format('YYYY-MM-DD')}
                                        className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs focus:border-brand-blue focus:ring-1 focus:ring-brand-blue outline-none"
                                    />
                                </div>
                                {/* Heure début */}
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 mb-1">Début</label>
                                    <input
                                        id="otu-startTime"
                                        type="time"
                                        defaultValue="08:00"
                                        className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs focus:border-brand-blue focus:ring-1 focus:ring-brand-blue outline-none"
                                    />
                                </div>
                                {/* Heure fin */}
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 mb-1">Fin</label>
                                    <input
                                        id="otu-endTime"
                                        type="time"
                                        defaultValue="12:00"
                                        className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs focus:border-brand-blue focus:ring-1 focus:ring-brand-blue outline-none"
                                    />
                                </div>
                                {/* Raison */}
                                <div className="sm:col-span-2">
                                    <label className="block text-xs font-bold text-slate-600 mb-1">Raison <span className="font-normal text-slate-400">(optionnel)</span></label>
                                    <input
                                        id="otu-reason"
                                        type="text"
                                        placeholder="Ex: RDV médical"
                                        className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs focus:border-brand-blue focus:ring-1 focus:ring-brand-blue outline-none"
                                    />
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    const date = (document.getElementById('otu-date') as HTMLInputElement)?.value || '';
                                    const startTime = (document.getElementById('otu-startTime') as HTMLInputElement)?.value || '08:00';
                                    const endTime = (document.getElementById('otu-endTime') as HTMLInputElement)?.value || '12:00';
                                    const reason = (document.getElementById('otu-reason') as HTMLInputElement)?.value?.trim() || '';
                                    if (!date || !startTime || !endTime) return;
                                    // Vérifier les doublons
                                    const isDuplicate = formData.oneTimeUnavailabilities.some(existing =>
                                        existing.date === date && existing.startTime === startTime && existing.endTime === endTime
                                    );
                                    if (isDuplicate) {
                                        showToast('Cette indisponibilité ponctuelle existe déjà.', 'warning');
                                        return;
                                    }
                                    setFormData(prev => ({
                                        ...prev,
                                        oneTimeUnavailabilities: [
                                            ...prev.oneTimeUnavailabilities,
                                            { id: `otu-${Date.now()}`, date, startTime, endTime, reason: reason || undefined }
                                        ]
                                    }));
                                }}
                                className="w-full py-2 bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold rounded-lg transition flex items-center justify-center gap-2"
                            >
                                <CalendarX className="w-4 h-4" />
                                Ajouter une indisponibilité ponctuelle
                            </button>
                        </div>
                    </div>

                     <div className="grid grid-cols-2 gap-4">
                         <div>
                             <label className="block text-sm font-bold text-slate-700 mb-1 flex items-center gap-2">
                                <Phone className="w-3 h-3 text-slate-400" /> Mobile
                             </label>
                             <input 
                                required
                                type="tel" 
                                name="phone"
                                value={formData.phone}
                                onChange={handleInputChange}
                                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg focus:border-brand-blue focus:ring-1 focus:ring-brand-blue outline-none"
                             />
                        </div>
                        <div>
                             <label className="block text-sm font-bold text-slate-700 mb-1 flex items-center gap-2">
                                <Mail className="w-3 h-3 text-slate-400" /> Email (Obligatoire)
                             </label>
                             <input 
                                required
                                type="email" 
                                name="email"
                                value={formData.email}
                                onChange={handleInputChange}
                                placeholder="Pour envoi identifiants"
                                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg focus:border-brand-blue focus:ring-1 focus:ring-brand-blue outline-none"
                             />
                        </div>
                    </div>

                    {isEditMode && (
                        <div>
                             <label className="block text-sm font-bold text-slate-700 mb-1">Statut</label>
                             <SearchableSelect
                                options={[
                                    { value: 'Active', label: 'Actif' },
                                    { value: 'Passive', label: 'Passif' },
                                    { value: 'Inactive', label: 'Inactif' },
                                ]}
                                value={formData.status}
                                onChange={(value) => handleInputChange({ target: { name: 'status', value } } as React.ChangeEvent<HTMLSelectElement>)}
                                triggerClassName="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"
                             />
                        </div>
                    )}

                     <div className="pt-4 flex justify-end gap-3 sticky bottom-0 bg-white pb-1">
                        <button 
                            type="button"
                            onClick={() => setIsModalOpen(false)}
                            className="px-6 py-2 rounded-lg text-slate-600 font-bold hover:bg-slate-100 transition"
                            disabled={isSubmitting}
                        >
                            Annuler
                        </button>
                        <button 
                            type="submit"
                            disabled={isSubmitting}
                            className="px-6 py-2 rounded-lg bg-brand-blue text-white font-bold hover:bg-teal-700 transition shadow-lg shadow-brand-blue/20 flex items-center gap-2 disabled:opacity-70"
                        >
                            {isSubmitting ? <div className="w-10 h-3 bg-white/40 rounded animate-pulse" /> : <CheckCircle className="w-4 h-4" />} 
                            {isEditMode ? 'Enregistrer' : 'Ajouter & Envoyer ID'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
      )}

      {isProviderDetailsOpen && selectedProviderDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden animate-in fade-in zoom-in duration-200 max-h-[90vh] flex flex-col">
                <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-cream-50">
                    <div>
                        <h3 className="text-xl font-serif font-bold text-slate-800">Fiche Prestataire</h3>
                        <p className="text-xs text-slate-500 mt-1">{selectedProviderDetails.firstName} {selectedProviderDetails.lastName}</p>
                    </div>
                    <button
                        onClick={() => {
                            setIsProviderDetailsOpen(false);
                            setSelectedProviderDetailsId(null);
                        }}
                        className="p-2 hover:bg-slate-200 rounded-full transition"
                    >
                        <X className="w-5 h-5 text-slate-500" />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                            <div className="font-bold text-slate-700 mb-2 flex items-center gap-2"><Phone className="w-4 h-4 text-slate-400" /> Contact</div>
                            <div className="text-slate-700"><span className="text-slate-500">Téléphone:</span> <span className="font-semibold">{selectedProviderDetails.phone || '—'}</span></div>
                            <div className="text-slate-700"><span className="text-slate-500">Email:</span> <span className="font-semibold">{selectedProviderDetails.email || '—'}</span></div>
                        </div>
                        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                            <div className="font-bold text-slate-700 mb-2 flex items-center gap-2"><Clock className="w-4 h-4 text-slate-400" /> Activité</div>
                            <div className="text-slate-700"><span className="text-slate-500">Spécialité:</span> <span className="font-semibold">{selectedProviderDetails.specialty || '—'}</span></div>
                            <div className="text-slate-700"><span className="text-slate-500">Heures cumulées:</span> <span className="font-semibold">{selectedProviderDetails.hoursWorked}h</span></div>
                            <div className="text-slate-700"><span className="text-slate-500">Statut:</span> <span className="font-semibold">{selectedProviderDetails.status}</span></div>
                        </div>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-lg p-4">
                        <div className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                          <CalendarX className="w-4 h-4 text-slate-500" /> Jours de non-intervention
                        </div>

                        {Array.isArray((selectedProviderDetails as any).nonInterventionDays) && (selectedProviderDetails as any).nonInterventionDays.length > 0 ? (
                          <div className="space-y-2">
                            {(selectedProviderDetails as any).nonInterventionDays
                              .slice()
                              .sort((a: number, b: number) => a - b)
                              .map((day: number) => {
                                const ranges = ((selectedProviderDetails as any).nonInterventionHours && typeof (selectedProviderDetails as any).nonInterventionHours === 'object')
                                  ? (selectedProviderDetails as any).nonInterventionHours[day]
                                  : null;
                                const list = Array.isArray(ranges) ? ranges : [];
                                return (
                                  <div key={`ni-${day}`} className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                                    <div className="font-bold text-slate-800 text-sm">{getDayLabel(day)}</div>
                                    <div className="text-xs text-slate-600 mt-1">
                                      {list.length > 0 ? (
                                        <div className="flex flex-col gap-1">
                                          {list.map((r: any, idx: number) => (
                                            <div key={`ni-${day}-${idx}`}>
                                              {r?.start || '00:00'} - {r?.end || '23:59'}
                                            </div>
                                          ))}
                                        </div>
                                      ) : (
                                        <div>Toute la journée</div>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                          </div>
                        ) : (
                          <div className="text-sm text-slate-400">Aucun jour de non-intervention défini.</div>
                        )}
                    </div>

                    {/* Indisponibilités programmées multi-semaines */}
                    <div className="bg-white border border-slate-200 rounded-lg p-4">
                        <div className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                          <CalendarX className="w-4 h-4 text-orange-500" /> Indisponibilités programmées
                        </div>
                        {Array.isArray((selectedProviderDetails as any).scheduledUnavailabilities) && (selectedProviderDetails as any).scheduledUnavailabilities.length > 0 ? (
                          <div className="space-y-2">
                            {(selectedProviderDetails as any).scheduledUnavailabilities.map((su: any, idx: number) => (
                              <div key={`su-${idx}`} className="p-3 bg-orange-50 border border-orange-200 rounded-lg flex flex-wrap items-center gap-2">
                                <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2 py-1 rounded">{getDayLabel(su.dayOfWeek)}</span>
                                <span className="text-xs font-medium text-orange-700">{su.startTime} – {su.endTime}</span>
                                <span className="text-xs text-slate-500">à partir du <strong>{su.startDate ? new Date(su.startDate).toLocaleDateString('fr-FR') : '—'}</strong></span>
                                <span className="text-xs font-bold text-orange-600 bg-orange-100 px-2 py-0.5 rounded">{su.weeks} semaine{su.weeks > 1 ? 's' : ''}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-sm text-slate-400">Aucune indisponibilité programmée.</div>
                        )}
                    </div>

                    <div className="bg-white border border-slate-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                            <div className="font-bold text-slate-800 flex items-center gap-2"><Clock className="w-4 h-4 text-slate-500" /> Statistiques missions</div>
                            <div className="text-xs text-slate-500">Total heures (missions): <span className="font-bold text-slate-700">{providerMissionStats.totalHours.toFixed(2)}h</span></div>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center">
                            <div className="bg-slate-50 rounded-lg border border-slate-200 p-2">
                                <div className="text-[10px] uppercase text-slate-500 font-bold">Total</div>
                                <div className="text-lg font-bold text-slate-800">{providerMissionStats.total}</div>
                            </div>
                            <div className="bg-orange-50 rounded-lg border border-orange-100 p-2">
                                <div className="text-[10px] uppercase text-orange-700 font-bold">Planifiées</div>
                                <div className="text-lg font-bold text-orange-800">{providerMissionStats.planned}</div>
                            </div>
                            <div className="bg-blue-50 rounded-lg border border-blue-100 p-2">
                                <div className="text-[10px] uppercase text-blue-700 font-bold">En cours</div>
                                <div className="text-lg font-bold text-blue-800">{providerMissionStats.inProgress}</div>
                            </div>
                            <div className="bg-green-50 rounded-lg border border-green-100 p-2">
                                <div className="text-[10px] uppercase text-green-700 font-bold">Terminées</div>
                                <div className="text-lg font-bold text-green-800">{providerMissionStats.completed}</div>
                            </div>
                            <div className="bg-red-50 rounded-lg border border-red-100 p-2">
                                <div className="text-[10px] uppercase text-red-700 font-bold">Annulées</div>
                                <div className="text-lg font-bold text-red-800">{providerMissionStats.cancelled}</div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-lg p-4">
                        <div className="font-bold text-slate-800 mb-3">Missions programmées</div>
                        {providerPlannedMissions.length === 0 ? (
                            <div className="text-sm text-slate-400">Aucune mission programmée pour ce prestataire.</div>
                        ) : (
                            <div className="space-y-2">
                                {providerPlannedMissions.map((m: any) => (
                                    <button
                                      key={m.id}
                                      type="button"
                                      onClick={() => {
                                        setSelectedMissionId(m.id);
                                        setIsMissionDetailsOpen(true);
                                      }}
                                      className="w-full text-left flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition"
                                      title="Voir les détails de la mission"
                                    >
                                        <div className="min-w-0">
                                            <div className="font-bold text-slate-800 text-sm truncate">{m.date} {m.startTime}-{m.endTime}</div>
                                            <div className="text-xs text-slate-600 truncate">{m.service}</div>
                                            <div className="text-xs text-slate-500 truncate">Client: {m.clientName}</div>
                                        </div>
                                        <div className="ml-3">
                                            <span className="text-xs font-bold bg-orange-100 text-orange-700 px-2 py-1 rounded">Planifiée</span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
      )}

      {isNonInterventionDetailsOpen && selectedNonInterventionProvider && (
        <div className="fixed inset-0 z-[55] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-cream-50">
              <div>
                <h3 className="text-xl font-serif font-bold text-slate-800">Non-interventions</h3>
                <p className="text-xs text-slate-500 mt-1">{selectedNonInterventionProvider.firstName} {selectedNonInterventionProvider.lastName}</p>
              </div>
              <button
                onClick={() => {
                  setIsNonInterventionDetailsOpen(false);
                  setNonInterventionProviderId(null);
                }}
                className="p-2 hover:bg-slate-200 rounded-full transition"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto">
              {Array.isArray((selectedNonInterventionProvider as any).nonInterventionDays) && (selectedNonInterventionProvider as any).nonInterventionDays.length > 0 ? (
                <div className="space-y-3">
                  {(selectedNonInterventionProvider as any).nonInterventionDays
                    .slice()
                    .sort((a: number, b: number) => a - b)
                    .map((day: number) => {
                      const ranges = ((selectedNonInterventionProvider as any).nonInterventionHours && typeof (selectedNonInterventionProvider as any).nonInterventionHours === 'object')
                        ? (selectedNonInterventionProvider as any).nonInterventionHours[day]
                        : null;
                      const list = Array.isArray(ranges) ? ranges : [];
                      return (
                        <div key={`nid-${day}`} className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
                          <div className="font-bold text-slate-800">{getDayLabel(day)}</div>
                          <div className="text-sm text-slate-600 mt-2">
                            {list.length > 0 ? (
                              <div className="flex flex-col gap-1">
                                {list.map((r: any, idx: number) => (
                                  <div key={`nid-${day}-${idx}`}>
                                    {r?.start || '00:00'} - {r?.end || '23:59'}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div>Toute la journée</div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              ) : (
                <div className="text-sm text-slate-400">Aucun jour de non-intervention défini.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {isMissionDetailsOpen && selectedMissionDetails && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-200 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-cream-50">
              <div>
                <h3 className="text-xl font-serif font-bold text-slate-800">Détails mission</h3>
                <p className="text-xs text-slate-500 mt-1">{(selectedMissionDetails as any).date} {(selectedMissionDetails as any).startTime}-{(selectedMissionDetails as any).endTime}</p>
              </div>
              <button
                onClick={() => {
                  setIsMissionDetailsOpen(false);
                  setSelectedMissionId(null);
                }}
                className="p-2 hover:bg-slate-200 rounded-full transition"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-sm">
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                <div className="font-bold text-slate-800 mb-2">Mission</div>
                <div className="text-slate-700"><span className="text-slate-500">Service:</span> <span className="font-semibold">{(selectedMissionDetails as any).service || '—'}</span></div>
                <div className="text-slate-700"><span className="text-slate-500">Durée:</span> <span className="font-semibold">{Number((selectedMissionDetails as any).duration || 0)}h</span></div>
                <div className="text-slate-700"><span className="text-slate-500">Statut:</span> <span className="font-semibold">{(selectedMissionDetails as any).status}</span></div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                <div className="font-bold text-slate-800 mb-2">Client</div>
                <div className="text-slate-700"><span className="text-slate-500">Nom:</span> <span className="font-semibold">{(selectedMissionDetails as any).clientName || '—'}</span></div>
                <div className="text-slate-700"><span className="text-slate-500">Adresse:</span> <span className="font-semibold">{(selectedMissionClient as any)?.address || '—'}</span></div>
                <div className="text-slate-700"><span className="text-slate-500">Ville:</span> <span className="font-semibold">{(selectedMissionClient as any)?.city || '—'}</span></div>
                <div className="text-slate-700"><span className="text-slate-500">Téléphone:</span> <span className="font-semibold">{(selectedMissionClient as any)?.phone || '—'}</span></div>
                <div className="text-slate-700"><span className="text-slate-500">Email:</span> <span className="font-semibold">{(selectedMissionClient as any)?.email || '—'}</span></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Credential Pop-up */}
      {newCredential && (
           <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
               <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden animate-in fade-in zoom-in duration-200">
                   <div className="bg-green-600 p-4 text-center">
                       <CheckCircle className="w-12 h-12 text-white mx-auto mb-2" />
                       <h3 className="text-xl font-bold text-white">Prestataire Créé</h3>
                   </div>
                   <div className="p-6">
                       <p className="text-sm text-slate-600 mb-4 text-center">
                           Voici les identifiants générés pour ce nouveau compte :
                       </p>
                       <div className="bg-slate-100 p-4 rounded-lg border border-slate-200 space-y-3">
                           <div>
                               <span className="text-xs font-bold text-slate-500 uppercase block">Email</span>
                               <span className="text-sm font-mono text-slate-800 font-bold break-all">{newCredential.email}</span>
                           </div>
                           <div>
                               <span className="text-xs font-bold text-slate-500 uppercase block">Mot de passe initial</span>
                               <span className="text-lg font-mono text-brand-blue font-bold tracking-wider">{newCredential.pass}</span>
                           </div>
                       </div>
                       <button 
                           onClick={() => setNewCredential(null)}
                           className="w-full mt-6 bg-slate-800 text-white py-3 rounded-xl font-bold hover:bg-slate-700 transition"
                       >
                           Fermer
                       </button>
                   </div>
               </div>
           </div>
      )}

      {isLeaveModalOpen && (() => {
          const selectedProvider = providers.find(p => p.id === selectedProviderId);
          const existingLeaves = (selectedProvider?.leaves || []).filter(l => l.status === 'approved' || !l.status);
          return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200 max-h-[90vh]">
                <div className="p-5 border-b border-slate-100 bg-gradient-to-r from-orange-50 to-amber-50">
                    <h3 className="text-lg font-serif font-bold text-slate-800">Congés — {selectedProvider?.firstName} {selectedProvider?.lastName}</h3>
                    <p className="text-xs text-slate-500 mt-1">Les congés sont pris en compte immédiatement dans les pages de disponibilité.</p>
                </div>
                <div className="p-5 space-y-4 overflow-y-auto">
                    {/* Sélection rapide */}
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wide">Durée rapide</label>
                        <div className="grid grid-cols-4 gap-2">
                            {[{ label: '1 sem.', weeks: 1 }, { label: '2 sem.', weeks: 2 }, { label: '3 sem.', weeks: 3 }, { label: '1 mois', weeks: 4 }].map(opt => (
                                <button
                                    key={opt.weeks}
                                    type="button"
                                    onClick={() => setQuickRange(opt.weeks)}
                                    className="px-2 py-2 text-xs font-bold rounded-lg border border-slate-200 bg-slate-50 hover:bg-brand-orange hover:text-white hover:border-brand-orange transition-colors"
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Dates manuelles */}
                    <form onSubmit={handleLeaveSubmit} className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">Date début</label>
                                <input type="date" required className="w-full p-2 border border-slate-200 rounded-lg text-sm focus:border-brand-orange focus:ring-1 focus:ring-brand-orange outline-none" value={leaveForm.startDate} onChange={e => setLeaveForm({...leaveForm, startDate: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">Date fin</label>
                                <input type="date" required className="w-full p-2 border border-slate-200 rounded-lg text-sm focus:border-brand-orange focus:ring-1 focus:ring-brand-orange outline-none" value={leaveForm.endDate} onChange={e => setLeaveForm({...leaveForm, endDate: e.target.value})} />
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 pt-1">
                             <button type="button" onClick={() => setIsLeaveModalOpen(false)} className="px-4 py-2 rounded-lg text-slate-600 font-bold text-sm hover:bg-slate-100 transition">Annuler</button>
                             <button type="submit" className="px-4 py-2 rounded-lg bg-brand-orange text-white font-bold text-sm hover:bg-orange-600 transition shadow-sm">Déclarer congés</button>
                        </div>
                    </form>

                    {/* Liste des congés existants */}
                    {existingLeaves.length > 0 && (
                        <div className="pt-3 border-t border-slate-100">
                            <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wide">Congés en cours ({existingLeaves.length})</label>
                            <div className="space-y-2">
                                {existingLeaves.map((leave, idx) => (
                                    <div key={leave.id || idx} className="flex items-center justify-between bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">
                                        <div className="flex items-center gap-2">
                                            <span className="text-orange-500">🏖️</span>
                                            <div>
                                                <span className="text-sm font-bold text-slate-700">{leave.startDate}</span>
                                                <span className="text-sm text-slate-400"> → </span>
                                                <span className="text-sm font-bold text-slate-700">{leave.endDate}</span>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => handleDeleteLeave(leave.id)}
                                            className="text-xs text-red-500 hover:text-red-700 font-bold px-2 py-1 rounded hover:bg-red-50 transition"
                                        >
                                            Supprimer
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
          </div>
          );
      })()}

      {deleteConfirmOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm animate-in fade-in zoom-in duration-200">
                <div className="flex flex-col items-center text-center">
                    <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-4">
                        <AlertTriangle className="w-6 h-6" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-800 mb-2">Confirmer la suppression</h3>
                    <p className="text-sm text-slate-500 mb-6">
                        Êtes-vous sûr de vouloir supprimer {selectedIds.size} prestataire(s) ? Cette action est irréversible.
                    </p>
                    <div className="flex gap-3 w-full">
                        <button 
                            onClick={() => setDeleteConfirmOpen(false)}
                            className="flex-1 py-2 text-slate-600 font-bold bg-slate-100 hover:bg-slate-200 rounded-lg transition"
                        >
                            Annuler
                        </button>
                        <button 
                            onClick={executeBulkDelete}
                            className="flex-1 py-2 text-white font-bold bg-red-600 hover:bg-red-700 rounded-lg transition shadow-md"
                        >
                            Supprimer
                        </button>
                    </div>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default Providers;
