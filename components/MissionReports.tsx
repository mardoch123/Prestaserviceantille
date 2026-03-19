
import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { matchesServiceTypeFilterFromText } from '../utils/serviceTypes';
import { supabase, isSupabaseConfigured } from '../utils/supabaseClient';
import { 
    Search, 
    Filter, 
    Calendar, 
    User, 
    Eye, 
    CheckCircle, 
    X, 
    Camera, 
    Video, 
    MessageSquare, 
    MapPin,
    Phone,
    Clock,
    AlertTriangle,
    Download,
    Check,
    RotateCcw,
    Ban,
    UserCircle,
    Briefcase,
    DollarSign,
    Package,
    TrendingUp,
    FileText,
    ChevronLeft,
    ChevronRight,
    Award
} from 'lucide-react';
import { Mission, Client, Provider, Document } from '../types';

const MissionReports: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { missions, serviceTypeFilter, dataLoading, getMissionDetails, clients, currentUser, providers, documents, updateMission } = useData();
    const [reportMissions, setReportMissions] = useState<Mission[]>([]);
    const [loadingReports, setLoadingReports] = useState(false);
    const [reportsError, setReportsError] = useState('');
    const [detailsLoading, setDetailsLoading] = useState(false);
    const [detailsError, setDetailsError] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedMission, setSelectedMission] = useState<Mission | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [lightboxImage, setLightboxImage] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'in_progress' | 'completed'>('completed');
    
    // États pour les filtres de date et période
    const [startDateFilter, setStartDateFilter] = useState<string>('');
    const [endDateFilter, setEndDateFilter] = useState<string>('');
    const [selectedClientFilter, setSelectedClientFilter] = useState<string>('');
    
    // États pour les nouvelles fonctionnalités
    const [selectedClientForModal, setSelectedClientForModal] = useState<Client | null>(null);
    const [selectedProviderForModal, setSelectedProviderForModal] = useState<Provider | null>(null);
    const [isClientModalOpen, setIsClientModalOpen] = useState(false);
    const [isProviderModalOpen, setIsProviderModalOpen] = useState(false);
    const [durationMultiplier, setDurationMultiplier] = useState<number>(1);
    const [isValidating, setIsValidating] = useState(false);
    const [isCancelling, setIsCancelling] = useState(false);
    const [actionError, setActionError] = useState<string | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    useEffect(() => {
        const state: any = location.state;
        const initialTab = String(state?.initialTab || '').trim();
        if (initialTab === 'in_progress' || initialTab === 'completed') {
            setActiveTab(initialTab);
        }
    }, [location.state]);

    const normalizeMediaUrl = (raw: string) => {
        const url = String(raw || '').trim();
        if (!url) return '';
        if (/^data:/i.test(url) || /^blob:/i.test(url) || /^https?:\/\//i.test(url)) return url;
        if (!isSupabaseConfigured) return url;
        const cleanedPath = url.replace(/^\/+/g, '');
        const { data } = supabase.storage.from('mission-media').getPublicUrl(cleanedPath);
        return String(data?.publicUrl || url);
    };

    useEffect(() => {
        let active = true;
        const load = async () => {
            if (!isSupabaseConfigured) {
                setReportMissions([]);
                return;
            }
            setLoadingReports(true);
            setReportsError('');
            try {
                const { data: sessionData } = await supabase.auth.getSession();
                if (!sessionData?.session) {
                    setReportsError('Session Supabase absente: impossible de charger les rapports.');
                    setReportMissions([]);
                    return;
                }

                const countRes = await supabase
                    .from('mission_reports')
                    .select('id', { count: 'exact', head: true });

                if (countRes.error) {
                    setReportsError(String((countRes.error as any)?.message || 'Erreur count rapports'));
                    setReportMissions([]);
                    return;
                }

                const { data, error } = await supabase
                    .from('mission_reports')
                    .select('id,date,start_time,end_time,duration,client_id,client_name,provider_id,provider_name,service,status,color,report_sent,start_photos_count,end_photos_count,has_end_video,source_document_id')
                    .order('date', { ascending: false })
                    .order('start_time', { ascending: false })
                    .limit(1000);
                if (!active) return;
                if (error) {
                    const hint = (countRes.count && countRes.count > 0) ? ` (count=${countRes.count})` : '';
                    setReportsError(`${String((error as any)?.message || 'Erreur chargement rapports')}${hint}`);
                    setReportMissions([]);
                    return;
                }
                if (!Array.isArray(data)) {
                    setReportMissions([]);
                    return;
                }
                setReportMissions(
                    data.map((m: any) => ({
                        ...m,
                        startTime: m.start_time || m.startTime,
                        endTime: m.end_time || m.endTime,
                        clientId: m.client_id || m.clientId,
                        clientName: m.client_name || m.clientName,
                        providerId: m.provider_id || m.providerId,
                        providerName: m.provider_name || m.providerName,
                        reportSent: m.report_sent || m.reportSent,
                        sourceDocumentId: m.source_document_id || m.sourceDocumentId,
                        endPhotos: Array.isArray((m as any).end_photos) ? (m as any).end_photos : undefined,
                        endVideo: (m as any).has_end_video ? '1' : undefined,
                    }))
                );
            } finally {
                if (active) setLoadingReports(false);
            }
        };

        load();
        return () => {
            active = false;
        };
    }, []);

    // Filter only completed missions with date and client filters
    const completedMissions = useMemo(() => {
        const base = (reportMissions.length ? reportMissions : missions);
        let result = base
            .filter(m => matchesServiceTypeFilterFromText(m.service, serviceTypeFilter))
            .filter(m => m.status === 'completed');
        
        // Filtre par recherche textuelle
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            result = result.filter(m => 
                m.clientName.toLowerCase().includes(query) || 
                (m.providerName && m.providerName.toLowerCase().includes(query)) ||
                m.service.toLowerCase().includes(query)
            );
        }
        
        // Filtre par date de début
        if (startDateFilter) {
            result = result.filter(m => new Date(m.date) >= new Date(startDateFilter));
        }
        
        // Filtre par date de fin
        if (endDateFilter) {
            result = result.filter(m => new Date(m.date) <= new Date(endDateFilter));
        }
        
        // Filtre par client spécifique
        if (selectedClientFilter) {
            result = result.filter(m => m.clientId === selectedClientFilter);
        }
        
        // Sort by date desc
        return result.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [missions, reportMissions, searchQuery, serviceTypeFilter, startDateFilter, endDateFilter, selectedClientFilter]);

    const inProgressMissions = useMemo(() => {
        let result = missions
            .filter(m => matchesServiceTypeFilterFromText(m.service, serviceTypeFilter))
            .filter(m => m.status === 'in_progress');

        // Filtre par recherche textuelle
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            result = result.filter(m =>
                m.clientName.toLowerCase().includes(query) ||
                (m.providerName && m.providerName.toLowerCase().includes(query)) ||
                m.service.toLowerCase().includes(query)
            );
        }
        
        // Filtre par date de début
        if (startDateFilter) {
            result = result.filter(m => new Date(m.date) >= new Date(startDateFilter));
        }
        
        // Filtre par date de fin
        if (endDateFilter) {
            result = result.filter(m => new Date(m.date) <= new Date(endDateFilter));
        }
        
        // Filtre par client spécifique
        if (selectedClientFilter) {
            result = result.filter(m => m.clientId === selectedClientFilter);
        }

        return result.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [missions, searchQuery, serviceTypeFilter, startDateFilter, endDateFilter, selectedClientFilter]);

    const displayedMissions = activeTab === 'completed' ? completedMissions : inProgressMissions;

    // Pagination logic
    const totalPages = Math.ceil(displayedMissions.length / itemsPerPage);
    const paginatedMissions = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return displayedMissions.slice(start, start + itemsPerPage);
    }, [displayedMissions, currentPage]);

    // Reset to page 1 when tab or search changes
    useEffect(() => {
        setCurrentPage(1);
    }, [activeTab, searchQuery, startDateFilter, endDateFilter, selectedClientFilter]);

    const getClientInfo = (clientId?: string | null) => {
        if (!clientId) return null;
        return clients.find(c => String(c.id) === String(clientId)) || null;
    };

    const getProviderInfo = (providerId?: string | null) => {
        if (!providerId) return null;
        return providers.find(p => String(p.id) === String(providerId)) || null;
    };

    // Helper pour vérifier si l'utilisateur est admin
    const isAdmin = useMemo(() => {
        return currentUser?.role === 'admin' || currentUser?.role === 'super_admin';
    }, [currentUser]);

    // Ouvrir le modal détails client
    const openClientModal = (clientId?: string | null) => {
        const client = getClientInfo(clientId);
        if (client) {
            setSelectedClientForModal(client);
            setIsClientModalOpen(true);
        }
    };

    // Ouvrir le modal détails prestataire
    const openProviderModal = (providerId?: string | null) => {
        const provider = getProviderInfo(providerId);
        if (provider) {
            setSelectedProviderForModal(provider);
            setIsProviderModalOpen(true);
        }
    };

    // Fermer les modals
    const closeClientModal = () => {
        setIsClientModalOpen(false);
        setTimeout(() => setSelectedClientForModal(null), 300);
    };

    const closeProviderModal = () => {
        setIsProviderModalOpen(false);
        setTimeout(() => setSelectedProviderForModal(null), 300);
    };

    // Navigation vers le devis
    const navigateToDocument = (docId: string) => {
        navigate('/invoices', { state: { documentId: docId, filter: 'devis' } });
    };

    const openReport = (mission: Mission) => {
        setSelectedMission(mission);
        setIsModalOpen(true);
        setDetailsError('');
        setDetailsLoading(true);
        void (async () => {
            try {
                const detailed = await getMissionDetails(String(mission.id));
                if (detailed) {
                    // Ensure video URL is properly set from detailed data
                    const m = detailed as any;
                    const videoUrl = m.endVideo || m.end_video || (m.has_end_video ? m.endVideo : undefined);
                    setSelectedMission({
                        ...detailed,
                        endVideo: videoUrl
                    });
                } else {
                    setDetailsError("Impossible de charger le détail de la mission (photos/video)." );
                }
            } catch (e: any) {
                setDetailsError(String(e?.message || 'Erreur chargement détail mission'));
            } finally {
                setDetailsLoading(false);
            }
        })();
    };

    const closeReport = () => {
        setIsModalOpen(false);
        setTimeout(() => setSelectedMission(null), 300);
        setDetailsError('');
        setDetailsLoading(false);
    };

    const handleDownloadAllImages = (urls: string[]) => {
      // Simple loop simulation for multiple downloads
      urls.forEach((url, i) => {
          setTimeout(() => {
              const link = document.createElement('a');
              link.href = url;
              link.download = `Preuve_Mission_${i+1}.jpg`;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
          }, i * 300);
      });
    };

    // Obtenir le prix du devis lié à la mission
    const getDocumentPrice = (mission: Mission): number => {
        if (!mission.sourceDocumentId) return 0;
        const doc = documents.find(d => String(d.id) === String(mission.sourceDocumentId));
        return doc?.totalTTC || doc?.unitPrice || 0;
    };

    // Valider une mission (admin seulement) - marque comme terminée définitivement
    const handleValidateMission = async () => {
        if (!selectedMission || !isAdmin) return;
        setIsValidating(true);
        setActionError(null);
        try {
            await updateMission(selectedMission.id, {
                status: 'completed',
                color: 'green',
                reportSent: true
            });
            // Mettre à jour localement
            setSelectedMission({ ...selectedMission, status: 'completed', color: 'green', reportSent: true });
        } catch (e: any) {
            setActionError(String(e?.message || 'Erreur lors de la validation'));
        } finally {
            setIsValidating(false);
        }
    };

    // Annuler une mission
    const handleCancelMission = async () => {
        if (!selectedMission) return;
        if (!confirm('Êtes-vous sûr de vouloir annuler cette mission ?')) return;
        
        setIsCancelling(true);
        setActionError(null);
        try {
            await updateMission(selectedMission.id, {
                status: 'cancelled',
                color: 'gray'
            });
            // Mettre à jour localement
            setSelectedMission({ ...selectedMission, status: 'cancelled', color: 'gray' });
            // Mettre à jour les totaux en rafraîchissant les missions
            setReportMissions(prev => prev.map(m => 
                m.id === selectedMission.id ? { ...m, status: 'cancelled', color: 'gray' } : m
            ));
        } catch (e: any) {
            setActionError(String(e?.message || 'Erreur lors de l\'annulation'));
        } finally {
            setIsCancelling(false);
        }
    };

    // Modifier la durée avec multiplicateur
    const handleApplyDurationMultiplier = async () => {
        if (!selectedMission || durationMultiplier < 1) return;
        
        const originalDuration = selectedMission.duration || 0;
        const newDuration = originalDuration * durationMultiplier;
        const newEndTime = calculateNewEndTime(selectedMission.startTime, newDuration);
        
        try {
            await updateMission(selectedMission.id, {
                duration: newDuration,
                endTime: newEndTime
            });
            // Mettre à jour localement
            setSelectedMission({ 
                ...selectedMission, 
                duration: newDuration,
                endTime: newEndTime
            });
        } catch (e: any) {
            setActionError(String(e?.message || 'Erreur lors de la modification de durée'));
        }
    };

    // Calculer la nouvelle heure de fin basée sur la durée
    const calculateNewEndTime = (startTime: string, durationHours: number): string => {
        const [hours, minutes] = startTime.split(':').map(Number);
        const totalMinutes = hours * 60 + minutes + durationHours * 60;
        const newHours = Math.floor(totalMinutes / 60) % 24;
        const newMinutes = Math.round(totalMinutes % 60);
        return `${String(newHours).padStart(2, '0')}:${String(newMinutes).padStart(2, '0')}`;
    };

    return (
        <div className="p-8 h-full overflow-y-auto bg-white/40 relative">
            <div className="flex justify-between items-end mb-8">
                <div>
                    <h2 className="text-3xl font-serif font-bold text-slate-800">Rapports de Mission</h2>
                    <p className="text-sm text-slate-500">Validation des fins de chantier et preuves multimédias</p>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6 flex flex-col gap-4">
                {/* Ligne 1: Tabs de statut et recherche */}
                <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setActiveTab('in_progress')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition ${activeTab === 'in_progress' ? 'bg-blue-50 text-brand-blue border-blue-100' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                        >
                            Missions en cours ({inProgressMissions.length})
                        </button>
                        <button
                            onClick={() => setActiveTab('completed')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition ${activeTab === 'completed' ? 'bg-green-50 text-green-700 border-green-100' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                        >
                            Missions terminées ({completedMissions.length})
                        </button>
                    </div>

                    <div className="text-[11px] text-slate-500 flex items-center gap-2">
                        <span>Total chargées: {(reportMissions.length ? reportMissions.length : missions.length)}</span>
                        {serviceTypeFilter && serviceTypeFilter !== 'all' ? (
                            <span>Filtre global: {serviceTypeFilter}</span>
                        ) : null}
                    </div>
                    
                    <div className="relative w-full md:w-96">
                        <input 
                            type="text" 
                            placeholder="Rechercher (Client, Prestataire, Service)..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 bg-slate-50 focus:border-brand-blue focus:ring-1 focus:ring-brand-blue outline-none"
                        />
                        <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                    </div>
                </div>
                
                {/* Ligne 2: Filtres de date et client */}
                <div className="flex flex-col md:flex-row items-center gap-4 pt-3 border-t border-slate-100">
                    <div className="flex items-center gap-2 text-xs text-slate-600">
                        <Calendar className="w-4 h-4 text-slate-400" />
                        <span className="font-medium">Période:</span>
                    </div>
                    
                    <div className="flex items-center gap-2 flex-wrap">
                        <input
                            type="date"
                            value={startDateFilter}
                            onChange={(e) => setStartDateFilter(e.target.value)}
                            className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-slate-50 focus:border-brand-blue focus:ring-1 focus:ring-brand-blue outline-none"
                            placeholder="Date début"
                        />
                        <span className="text-slate-400">→</span>
                        <input
                            type="date"
                            value={endDateFilter}
                            onChange={(e) => setEndDateFilter(e.target.value)}
                            className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-slate-50 focus:border-brand-blue focus:ring-1 focus:ring-brand-blue outline-none"
                            placeholder="Date fin"
                        />
                    </div>
                    
                    <div className="h-6 w-px bg-slate-200 hidden md:block"></div>
                    
                    <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-slate-400" />
                        <select
                            value={selectedClientFilter}
                            onChange={(e) => setSelectedClientFilter(e.target.value)}
                            className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-slate-50 focus:border-brand-blue focus:ring-1 focus:ring-brand-blue outline-none min-w-[180px]"
                        >
                            <option value="">Tous les clients</option>
                            {clients.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                    </div>
                    
                    {/* Bouton réinitialiser les filtres */}
                    {(startDateFilter || endDateFilter || selectedClientFilter) && (
                        <button
                            onClick={() => {
                                setStartDateFilter('');
                                setEndDateFilter('');
                                setSelectedClientFilter('');
                            }}
                            className="ml-auto text-xs text-slate-500 hover:text-brand-blue underline flex items-center gap-1"
                        >
                            <X className="w-3 h-3" />
                            Réinitialiser filtres
                        </button>
                    )}
                </div>
            </div>

            {/* Missions List */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                {reportsError ? (
                    <div className="px-6 py-3 bg-red-50 text-red-700 text-xs font-bold border-b border-red-100">
                        {reportsError}
                    </div>
                ) : null}
                {(dataLoading || loadingReports) ? (
                    <div className="p-6">
                        <div className="space-y-3 animate-pulse">
                            <div className="h-6 bg-slate-200 rounded w-1/3" />
                            <div className="h-10 bg-slate-200 rounded" />
                            <div className="h-10 bg-slate-200 rounded" />
                            <div className="h-10 bg-slate-200 rounded" />
                            <div className="h-10 bg-slate-200 rounded" />
                        </div>
                    </div>
                ) : (
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-xs uppercase text-slate-500 border-b border-slate-100">
                        <tr>
                            <th className="px-6 py-4">Date & Heure</th>
                            <th className="px-6 py-4">Client / Lieu</th>
                            <th className="px-6 py-4">Prestataire</th>
                            <th className="px-6 py-4">Service</th>
                            <th className="px-6 py-4">Statut</th>
                            <th className="px-6 py-4 text-center">Photos</th>
                            <th className="px-6 py-4 text-right">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {displayedMissions.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="p-12 text-center text-slate-400">
                                    <div className="flex flex-col items-center gap-2">
                                        <Filter className="w-8 h-8 opacity-20" />
                                        <span>Aucune mission trouvée pour ce filtre.</span>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            paginatedMissions.map(m => {
                                const client = getClientInfo(m.clientId);
                                const city = client?.city || '';
                                return (
                                <tr key={m.id} className="hover:bg-cream-50 transition-colors group">
                                    <td className="px-6 py-4">
                                        <div className="font-bold text-slate-700">{m.date}</div>
                                        <div className="text-xs text-slate-500">{m.startTime} - {m.endTime}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <button 
                                            onClick={() => openClientModal(m.clientId)}
                                            className="font-bold text-slate-800 hover:text-brand-blue transition text-left"
                                        >
                                            {m.clientName}
                                        </button>
                                        <div className="flex items-center gap-1 text-[10px] text-slate-500">
                                            <MapPin className="w-3 h-3" /> {city || '—'}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <button 
                                            onClick={() => openProviderModal(m.providerId)}
                                            className="flex items-center gap-2 hover:text-brand-blue transition"
                                        >
                                            <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600">
                                                {m.providerName?.charAt(0)}
                                            </div>
                                            <span className="text-slate-700 font-medium">{m.providerName}</span>
                                        </button>
                                    </td>
                                    <td className="px-6 py-4">
                                        {m.sourceDocumentId ? (
                                            <button
                                                onClick={() => navigateToDocument(m.sourceDocumentId!)}
                                                className="bg-blue-50 text-brand-blue px-2 py-1 rounded text-xs font-bold hover:bg-blue-100 transition flex items-center gap-1"
                                            >
                                                <FileText className="w-3 h-3" />
                                                {m.service}
                                            </button>
                                        ) : (
                                            <span className="bg-blue-50 text-brand-blue px-2 py-1 rounded text-xs font-bold">{m.service}</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        {m.status === 'completed' ? (
                                            <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider border border-green-200">Terminée</span>
                                        ) : m.status === 'in_progress' ? (
                                            <span className="bg-blue-100 text-brand-blue px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider border border-blue-200">En cours</span>
                                        ) : (
                                            <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider border border-slate-200">{m.status}</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <div className="flex justify-center items-center gap-2">
                                            {(() => {
                                                const v: any = m as any;
                                                // Normalize photos from storage paths to URLs
                                                const endPhotosArray = Array.isArray(v.endPhotos) ? v.endPhotos : (Array.isArray(v.end_photos) ? v.end_photos : []);
                                                const startPhotosArray = Array.isArray(v.startPhotos) ? v.startPhotos : (Array.isArray(v.start_photos) ? v.start_photos : []);
                                                const endCount = typeof v.end_photos_count === 'number' ? v.end_photos_count : endPhotosArray.length;
                                                const startCount = startPhotosArray.map(normalizeMediaUrl).filter(Boolean).length;
                                                const count = activeTab === 'completed' ? endCount : startCount;
                                                if (count > 0) {
                                                    return (
                                                <span className="bg-green-100 text-green-700 px-2 py-1 rounded-full text-[10px] font-bold border border-green-200 flex items-center gap-1">
                                                    <Camera className="w-3 h-3" /> {count}
                                                </span>
                                                    );
                                                }
                                                return (
                                                <span className="bg-red-50 text-red-400 px-2 py-1 rounded-full text-[10px] font-bold">0</span>
                                                );
                                            })()}
                                            {(m as any).has_end_video || m.endVideo ? (
                                                <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded-full text-[10px] font-bold border border-purple-200">
                                                    <Video className="w-3 h-3" />
                                                </span>
                                            ) : null}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button 
                                            onClick={() => openReport(m)}
                                            className="bg-brand-blue text-white text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-teal-700 transition shadow-sm flex items-center gap-2 ml-auto"
                                        >
                                            <Eye className="w-3 h-3" /> {m.status === 'completed' ? 'Voir Détails' : 'Editer'}
                                        </button>
                                    </td>
                                </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
                )}

                {/* Pagination Footer */}
                {displayedMissions.length > 0 && (
                    <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
                        <div className="text-xs text-slate-500">
                            Affichage de {((currentPage - 1) * itemsPerPage) + 1} à {Math.min(currentPage * itemsPerPage, displayedMissions.length)} sur {displayedMissions.length} entrées
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

            {/* REPORT DETAIL MODAL */}
            {isModalOpen && selectedMission && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col animate-in fade-in zoom-in duration-200 overflow-hidden">
                        
                        {/* Header */}
                        <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                            <div>
                                <div className="flex items-center gap-3">
                                    <h3 className="text-xl font-bold text-slate-800">{selectedMission.status === 'completed' ? 'Rapport de Fin de Mission' : 'Suivi de Mission'}</h3>
                                    {selectedMission.status === 'completed' ? (
                                        <span className="bg-green-100 text-green-800 px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider border border-green-200">Terminée</span>
                                    ) : (
                                        <span className="bg-blue-100 text-brand-blue px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider border border-blue-200">En cours</span>
                                    )}
                                </div>
                                <p className="text-sm text-slate-500 flex items-center gap-2 mt-1">
                                    <Calendar className="w-4 h-4" /> {selectedMission.date} 
                                    <span className="text-slate-300">|</span> 
                                    <Clock className="w-4 h-4" /> {selectedMission.startTime} - {selectedMission.endTime}
                                </p>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={closeReport} className="p-2 text-slate-500 hover:bg-slate-200 rounded-full transition">
                                    <X className="w-6 h-6" />
                                </button>
                            </div>
                        </div>

                        {detailsLoading ? (
                            <div className="px-6 py-3 bg-white border-b border-slate-200">
                                <div className="animate-pulse space-y-2">
                                    <div className="h-3 bg-slate-200 rounded w-40" />
                                    <div className="h-2 bg-slate-200 rounded w-64" />
                                </div>
                            </div>
                        ) : null}

                        {detailsError ? (
                            <div className="px-6 py-3 bg-red-50 border-b border-red-100 text-red-700 text-xs font-bold">
                                {detailsError}
                            </div>
                        ) : null}

                        <div className="flex-1 overflow-y-auto p-6 bg-slate-100">
                            
                            {/* Info Card */}
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 mb-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div>
                                    <span className="text-xs font-bold text-slate-400 uppercase block mb-1">Client</span>
                                    <button 
                                        onClick={() => openClientModal(selectedMission.clientId)}
                                        className="flex items-center gap-2 hover:opacity-80 transition"
                                    >
                                        <div className="w-8 h-8 rounded-full bg-brand-orange text-white flex items-center justify-center font-bold">{selectedMission.clientName.charAt(0)}</div>
                                        <span className="font-bold text-slate-800">{selectedMission.clientName}</span>
                                    </button>
                                    {(() => {
                                        const c = getClientInfo(selectedMission.clientId);
                                        if (!c) return null;
                                        const phone = String((c as any).phone || '').trim();
                                        const address = String((c as any).address || '').trim();
                                        const city = String((c as any).city || '').trim();
                                        const line = [address, city].filter(Boolean).join(', ');
                                        return (
                                            <div className="mt-2 text-xs text-slate-500 space-y-1">
                                                {phone ? (
                                                    <div className="flex items-center gap-2"><Phone className="w-3 h-3 text-slate-400" />{phone}</div>
                                                ) : null}
                                                {line ? (
                                                    <div className="flex items-center gap-2"><MapPin className="w-3 h-3 text-slate-400" />{line}</div>
                                                ) : null}
                                            </div>
                                        );
                                    })()}
                                </div>
                                <div>
                                    <span className="text-xs font-bold text-slate-400 uppercase block mb-1">Prestataire</span>
                                    <button 
                                        onClick={() => openProviderModal(selectedMission.providerId)}
                                        className="flex items-center gap-2 hover:opacity-80 transition"
                                    >
                                        <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-600">{selectedMission.providerName?.charAt(0)}</div>
                                        <span className="font-bold text-slate-800">{selectedMission.providerName}</span>
                                    </button>
                                </div>
                                <div>
                                    <span className="text-xs font-bold text-slate-400 uppercase block mb-1">Service</span>
                                    <span className="font-bold text-brand-blue text-lg">{selectedMission.service}</span>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* BEFORE WORK */}
                                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                                    <div className="bg-orange-50 border-b border-orange-100 px-4 py-3 flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                                        <h4 className="font-bold text-orange-800">Avant Chantier</h4>
                                    </div>
                                    <div className="p-4 flex-1">
                                        {/* Remark */}
                                        <div className="mb-4">
                                            <span className="text-xs font-bold text-slate-400 uppercase block mb-1">Remarque Début</span>
                                            <p className="text-sm text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-100 italic">
                                                {selectedMission.startRemark || "Aucune remarque signalée."}
                                            </p>
                                        </div>

                                        {/* Photos */}
                                        <div>
                                            {(() => {
                                                const urls = (selectedMission.startPhotos || []).map(normalizeMediaUrl).filter(Boolean);
                                                return (
                                                    <>
                                                        <span className="text-xs font-bold text-slate-400 uppercase block mb-2 flex items-center gap-2">
                                                            <Camera className="w-3 h-3"/> Photos ({urls.length})
                                                        </span>
                                                        {urls.length > 0 ? (
                                                            <div className="grid grid-cols-3 gap-2">
                                                                {urls.map((url, i) => (
                                                                    <div key={i} className="aspect-square rounded-lg overflow-hidden border border-slate-200 group relative cursor-pointer" onClick={() => setLightboxImage(url)}>
                                                                        <img src={url} alt="Start" loading="lazy" className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                                                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors"></div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <div className="text-center p-4 bg-slate-50 rounded-lg border border-dashed border-slate-200 text-slate-400 text-xs">
                                                                Aucune photo prise au début.
                                                            </div>
                                                        )}
                                                    </>
                                                );
                                            })()}
                                        </div>
                                    </div>
                                </div>

                                {/* AFTER WORK */}
                                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                                    <div className="bg-green-50 border-b border-green-100 px-4 py-3 flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-green-600"></span>
                                        <h4 className="font-bold text-green-800">Fin de Chantier</h4>
                                    </div>
                                    <div className="p-4 flex-1">
                                        {/* Remark */}
                                        <div className="mb-4">
                                            <span className="text-xs font-bold text-slate-400 uppercase block mb-1">Remarque Fin</span>
                                            <p className="text-sm text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-100 italic">
                                                {selectedMission.status === 'completed' ? (selectedMission.endRemark || "R.A.S - Mission terminée.") : (selectedMission.endRemark || "Mission en cours : fin de chantier non encore remontée.")}
                                            </p>
                                        </div>

                                        {/* Photos */}
                                        <div>
                                            {(() => {
                                                const urls = (selectedMission.endPhotos || []).map(normalizeMediaUrl).filter(Boolean);
                                                return (
                                                    <>
                                                        <div className="flex justify-between items-center mb-2">
                                                            <span className="text-xs font-bold text-slate-400 uppercase flex items-center gap-2">
                                                                <Camera className="w-3 h-3"/> Photos ({urls.length})
                                                            </span>
                                                            {urls.length > 0 && (
                                                                <button onClick={() => handleDownloadAllImages(urls)} className="text-xs text-brand-blue hover:underline flex items-center gap-1">
                                                                    <Download className="w-3 h-3"/> Tout télécharger
                                                                </button>
                                                            )}
                                                        </div>
                                                        {detailsLoading ? (
                                                            <div className="p-4 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                                                                <div className="grid grid-cols-3 gap-2 animate-pulse">
                                                                    <div className="aspect-square rounded-lg bg-slate-200" />
                                                                    <div className="aspect-square rounded-lg bg-slate-200" />
                                                                    <div className="aspect-square rounded-lg bg-slate-200" />
                                                                    <div className="aspect-square rounded-lg bg-slate-200" />
                                                                    <div className="aspect-square rounded-lg bg-slate-200" />
                                                                    <div className="aspect-square rounded-lg bg-slate-200" />
                                                                </div>
                                                            </div>
                                                        ) : urls.length > 0 ? (
                                                            <div className="grid grid-cols-3 gap-2">
                                                                {urls.map((url, i) => (
                                                                    <div key={i} className="aspect-square rounded-lg overflow-hidden border border-slate-200 group relative cursor-pointer" onClick={() => setLightboxImage(url)}>
                                                                        <img src={url} alt="End" loading="lazy" className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        ) : selectedMission.status === 'completed' ? (
                                                            <div className="text-center p-4 bg-red-50 rounded-lg border border-dashed border-red-200 text-red-400 text-xs font-bold">
                                                                <AlertTriangle className="w-4 h-4 mx-auto mb-1"/>
                                                                Photos manquantes !
                                                            </div>
                                                        ) : (
                                                            <div className="text-center p-4 bg-slate-50 rounded-lg border border-dashed border-slate-200 text-slate-500 text-xs font-bold">
                                                                Aucune preuve de fin pour le moment (mission en cours).
                                                            </div>
                                                        )}
                                                    </>
                                                );
                                            })()}
                                        </div>

                                        {/* Video */}
                                        {selectedMission.endVideo && (
                                            <div className="mt-4 pt-4 border-t border-slate-100">
                                                <span className="text-xs font-bold text-slate-400 uppercase block mb-2 flex items-center gap-2">
                                                    <Video className="w-3 h-3"/> Vidéo de fin
                                                </span>
                                                <div className="aspect-video bg-black rounded-lg overflow-hidden">
                                                    <video 
                                                        src={normalizeMediaUrl(selectedMission.endVideo)} 
                                                        controls 
                                                        className="w-full h-full"
                                                        preload="metadata"
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                        </div>

                        {/* Admin Actions Section */}
                        {isAdmin && selectedMission.status !== 'cancelled' && (
                            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200">
                                {actionError && (
                                    <div className="mb-4 px-4 py-2 bg-red-50 text-red-700 text-xs font-bold rounded-lg">
                                        {actionError}
                                    </div>
                                )}
                                
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    {/* Multiplicateur de durée */}
                                    <div className="bg-white p-4 rounded-xl border border-slate-200">
                                        <h4 className="text-xs font-bold text-slate-500 uppercase mb-3 flex items-center gap-2">
                                            <Clock className="w-4 h-4" /> Modifier la durée
                                        </h4>
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="text-sm text-slate-600">Multiplicateur:</span>
                                            <select 
                                                value={durationMultiplier}
                                                onChange={(e) => setDurationMultiplier(Number(e.target.value))}
                                                className="px-3 py-1 rounded-lg border border-slate-200 text-sm focus:border-brand-blue outline-none"
                                            >
                                                <option value={1}>×1 (durée normale)</option>
                                                <option value={2}>×2</option>
                                                <option value={3}>×3</option>
                                                <option value={4}>×4</option>
                                            </select>
                                        </div>
                                        <div className="text-xs text-slate-500 mb-3">
                                            Durée actuelle: {selectedMission.duration}h → Nouvelle: {selectedMission.duration * durationMultiplier}h
                                        </div>
                                        <button
                                            onClick={handleApplyDurationMultiplier}
                                            disabled={durationMultiplier === 1}
                                            className="w-full px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            Appliquer la modification
                                        </button>
                                    </div>

                                    {/* Prix calculé */}
                                    <div className="bg-white p-4 rounded-xl border border-slate-200">
                                        <h4 className="text-xs font-bold text-slate-500 uppercase mb-3 flex items-center gap-2">
                                            <DollarSign className="w-4 h-4" /> Montant de la prestation
                                        </h4>
                                        {(() => {
                                            const basePrice = getDocumentPrice(selectedMission);
                                            const multipliedPrice = basePrice * durationMultiplier;
                                            return (
                                                <div className="space-y-2">
                                                    <div className="flex justify-between text-sm">
                                                        <span className="text-slate-600">Prix de base:</span>
                                                        <span className="font-bold">{basePrice.toFixed(2)} €</span>
                                                    </div>
                                                    <div className="flex justify-between text-sm">
                                                        <span className="text-slate-600">Multiplicateur:</span>
                                                        <span className="font-bold">×{durationMultiplier}</span>
                                                    </div>
                                                    <div className="border-t border-slate-200 pt-2 flex justify-between text-sm">
                                                        <span className="text-slate-800 font-bold">Total:</span>
                                                        <span className="font-bold text-green-600">{multipliedPrice.toFixed(2)} €</span>
                                                    </div>
                                                </div>
                                            );
                                        })()}
                                    </div>

                                    {/* Actions validation/annulation */}
                                    <div className="bg-white p-4 rounded-xl border border-slate-200">
                                        <h4 className="text-xs font-bold text-slate-500 uppercase mb-3 flex items-center gap-2">
                                            <CheckCircle className="w-4 h-4" /> Actions admin
                                        </h4>
                                        <div className="space-y-2">
                                            {selectedMission.status !== 'completed' && (
                                                <button
                                                    onClick={handleValidateMission}
                                                    disabled={isValidating}
                                                    className="w-full px-4 py-2 bg-green-600 text-white text-xs font-bold rounded-lg hover:bg-green-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
                                                >
                                                    <Check className="w-4 h-4" />
                                                    {isValidating ? 'Validation...' : 'Valider la mission'}
                                                </button>
                                            )}
                                            <button
                                                onClick={handleCancelMission}
                                                disabled={isCancelling}
                                                className="w-full px-4 py-2 bg-red-600 text-white text-xs font-bold rounded-lg hover:bg-red-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
                                            >
                                                <Ban className="w-4 h-4" />
                                                {isCancelling ? 'Annulation...' : 'Annuler la mission'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="p-4 bg-white border-t border-slate-200 flex justify-end">
                            <button onClick={closeReport} className="px-6 py-2 bg-slate-800 text-white rounded-lg font-bold hover:bg-slate-700 transition">
                                Fermer
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Lightbox Modal */}
            {lightboxImage && (
                <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setLightboxImage(null)}>
                    <button 
                        onClick={() => setLightboxImage(null)}
                        className="absolute top-4 right-4 text-white p-2 hover:bg-white/20 rounded-full transition"
                    >
                        <X className="w-8 h-8" />
                    </button>
                    <img 
                        src={normalizeMediaUrl(lightboxImage)} 
                        alt="Full size" 
                        className="max-w-full max-h-full object-contain rounded-lg shadow-2xl animate-in zoom-in duration-200"
                        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking image
                    />
                </div>
            )}
            {/* CLIENT DETAILS MODAL */}
            {isClientModalOpen && selectedClientForModal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col animate-in fade-in zoom-in duration-200 overflow-hidden">
                        {/* Header */}
                        <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-full bg-brand-orange text-white flex items-center justify-center font-bold text-xl">
                                    {selectedClientForModal.name.charAt(0)}
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-slate-800">{selectedClientForModal.name}</h3>
                                    <p className="text-sm text-slate-500">Détails du client</p>
                                </div>
                            </div>
                            <button onClick={closeClientModal} className="p-2 text-slate-500 hover:bg-slate-200 rounded-full transition">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
                            {/* Informations de contact */}
                            <div className="bg-white rounded-xl border border-slate-200 p-5 mb-4">
                                <h4 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                                    <UserCircle className="w-4 h-4 text-brand-blue" /> Informations de contact
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <span className="text-xs text-slate-400 uppercase block mb-1">Email</span>
                                        <p className="text-sm font-medium text-slate-700">{selectedClientForModal.email || '—'}</p>
                                    </div>
                                    <div>
                                        <span className="text-xs text-slate-400 uppercase block mb-1">Téléphone</span>
                                        <p className="text-sm font-medium text-slate-700">{selectedClientForModal.phone || '—'}</p>
                                    </div>
                                    <div className="md:col-span-2">
                                        <span className="text-xs text-slate-400 uppercase block mb-1">Adresse</span>
                                        <p className="text-sm font-medium text-slate-700 flex items-center gap-1">
                                            <MapPin className="w-3 h-3" />
                                            {selectedClientForModal.address || '—'}
                                            {selectedClientForModal.city && `, ${selectedClientForModal.city}`}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Statistiques */}
                            <div className="bg-white rounded-xl border border-slate-200 p-5 mb-4">
                                <h4 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                                    <TrendingUp className="w-4 h-4 text-brand-blue" /> Statistiques
                                </h4>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div className="bg-slate-50 rounded-lg p-3 text-center">
                                        <div className="text-2xl font-bold text-slate-800">{selectedClientForModal.packsConsumed || 0}</div>
                                        <div className="text-xs text-slate-500">Packs consommés</div>
                                    </div>
                                    <div className="bg-slate-50 rounded-lg p-3 text-center">
                                        <div className="text-2xl font-bold text-brand-blue">{selectedClientForModal.loyaltyHoursAvailable || 0}h</div>
                                        <div className="text-xs text-slate-500">Heures fidélité</div>
                                    </div>
                                    <div className="bg-slate-50 rounded-lg p-3 text-center">
                                        <div className="text-2xl font-bold text-green-600">{selectedClientForModal.status || '—'}</div>
                                        <div className="text-xs text-slate-500">Statut</div>
                                    </div>
                                    <div className="bg-slate-50 rounded-lg p-3 text-center">
                                        <div className="text-2xl font-bold text-slate-800">{selectedClientForModal.since || '—'}</div>
                                        <div className="text-xs text-slate-500">Client depuis</div>
                                    </div>
                                </div>
                            </div>

                            {/* Pack actuel */}
                            {selectedClientForModal.pack && (
                                <div className="bg-white rounded-xl border border-slate-200 p-5">
                                    <h4 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                                        <Package className="w-4 h-4 text-brand-blue" /> Pack actuel
                                    </h4>
                                    <div className="flex items-center gap-3">
                                        <div className="bg-blue-50 text-brand-blue px-3 py-1.5 rounded-lg text-sm font-bold">
                                            {selectedClientForModal.pack}
                                        </div>
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
            {isProviderModalOpen && selectedProviderForModal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col animate-in fade-in zoom-in duration-200 overflow-hidden">
                        {/* Header */}
                        <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-xl">
                                    {selectedProviderForModal.firstName?.charAt(0) || selectedProviderForModal.lastName?.charAt(0)}
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-slate-800">{selectedProviderForModal.firstName} {selectedProviderForModal.lastName}</h3>
                                    <p className="text-sm text-slate-500">Détails du prestataire</p>
                                </div>
                            </div>
                            <button onClick={closeProviderModal} className="p-2 text-slate-500 hover:bg-slate-200 rounded-full transition">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
                            {/* Informations de contact */}
                            <div className="bg-white rounded-xl border border-slate-200 p-5 mb-4">
                                <h4 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                                    <UserCircle className="w-4 h-4 text-brand-blue" /> Informations de contact
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <span className="text-xs text-slate-400 uppercase block mb-1">Email</span>
                                        <p className="text-sm font-medium text-slate-700">{selectedProviderForModal.email || '—'}</p>
                                    </div>
                                    <div>
                                        <span className="text-xs text-slate-400 uppercase block mb-1">Téléphone</span>
                                        <p className="text-sm font-medium text-slate-700">{selectedProviderForModal.phone || '—'}</p>
                                    </div>
                                    <div className="md:col-span-2">
                                        <span className="text-xs text-slate-400 uppercase block mb-1">Spécialité</span>
                                        <p className="text-sm font-medium text-slate-700 flex items-center gap-1">
                                            <Briefcase className="w-3 h-3" />
                                            {selectedProviderForModal.specialty || '—'}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Statistiques */}
                            <div className="bg-white rounded-xl border border-slate-200 p-5 mb-4">
                                <h4 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                                    <TrendingUp className="w-4 h-4 text-brand-blue" /> Statistiques
                                </h4>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div className="bg-slate-50 rounded-lg p-3 text-center">
                                        <div className="text-2xl font-bold text-slate-800">{selectedProviderForModal.hoursWorked || 0}h</div>
                                        <div className="text-xs text-slate-500">Heures travaillées</div>
                                    </div>
                                    <div className="bg-slate-50 rounded-lg p-3 text-center">
                                        <div className="text-2xl font-bold text-yellow-500">{selectedProviderForModal.rating || '—'}/5</div>
                                        <div className="text-xs text-slate-500">Note moyenne</div>
                                    </div>
                                    <div className="bg-slate-50 rounded-lg p-3 text-center">
                                        <div className="text-2xl font-bold text-green-600">{selectedProviderForModal.status || '—'}</div>
                                        <div className="text-xs text-slate-500">Statut</div>
                                    </div>
                                    <div className="bg-slate-50 rounded-lg p-3 text-center">
                                        <div className="text-2xl font-bold text-slate-800">{selectedProviderForModal.leaves?.length || 0}</div>
                                        <div className="text-xs text-slate-500">Congés</div>
                                    </div>
                                </div>
                            </div>

                            {/* Badge de performance */}
                            {selectedProviderForModal.rating && selectedProviderForModal.rating >= 4 && (
                                <div className="bg-gradient-to-r from-yellow-50 to-orange-50 rounded-xl border border-yellow-200 p-5">
                                    <div className="flex items-center gap-3">
                                        <Award className="w-8 h-8 text-yellow-500" />
                                        <div>
                                            <h4 className="text-sm font-bold text-slate-800">Prestataire d'excellence</h4>
                                            <p className="text-xs text-slate-500">Note moyenne supérieure à 4/5</p>
                                        </div>
                                    </div>
                                </div>
                            )}
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
        </div>
    );
};

export default MissionReports;
