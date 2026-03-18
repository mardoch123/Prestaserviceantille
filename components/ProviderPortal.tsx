import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { Mission } from '../types';
import { supabase } from '../utils/supabaseClient';
import PageLoader from './PageLoader';
import UploadProgressManager from './UploadProgressManager';
import VideoCallManagerImproved from './VideoCallManagerImproved';
import { matchesServiceTypeFilterFromText } from '../utils/serviceTypes';
import { 
  Calendar, 
  Clock, 
  MapPin, 
  Camera, 
  Video, 
  VideoOff, 
  Mic, 
  MicOff, 
  Phone, 
  PhoneOff,
  Mail,
  AlertCircle,
  CheckCircle,
  Upload,
  FileText,
  Send,
  X,
  Menu,
  Wifi,
  Lock,
  Briefcase,
  Award,
  Package,
  History,
  Megaphone,
  LogOut,
  Bell,
  AlertTriangle,
  CalendarX,
  Trash2,
  UploadCloud,
  FileVideo,
  LinkIcon,
  MessageSquare,
  Loader,
  ScanLine,
  ChevronLeft,
  Grid3X3,
  Home,
  User,
  Plus,
  ChevronRight,
  Sparkles,
  Search,
  Filter,
  Loader2
} from 'lucide-react';
import dayjs from 'dayjs';
import 'dayjs/locale/fr';

dayjs.locale('fr');

const ProviderPortal: React.FC = () => {
  const { 
    providers, 
    clients,
    missions, 
    serviceTypeFilter,
    simulatedProviderId, 
    setSimulatedProviderId,
    notifications,
    markNotificationRead,
    addLeave,
    enqueueStartMission,
    enqueueEndMission,
    cancelMissionByProvider,
    startLiveStream,
    stopLiveStream,
    logout,
    activeStream,
    visitScans,
    refreshData,
    dataLoading,
    // Upload progress tracking
    uploadJobs,
    activeUploadJob,
    isUploadProcessing,
    retryUploadJob,
    removeUploadJob,
    clearCompletedUploadJobs,
  } = useData();

  const LOADER_SEEN_KEY = 'presta_provider_portal_loader_seen';
  const loaderSeenRef = useRef<boolean>(false);
  const [loaderSeen, setLoaderSeen] = useState(false);

  // Pull-to-refresh state
  const [isPulling, setIsPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const pullStartYRef = useRef<number | null>(null);
  const mainScrollRef = useRef<HTMLDivElement>(null);
  const PULL_THRESHOLD = 70;

  // Date selection state for calendar
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [currentMonth, setCurrentMonth] = useState(dayjs());
  // Dashboard view mode
  const [dashboardViewMode, setDashboardViewMode] = useState<'overview' | 'calendar' | 'horizontal' | 'grid'>('overview');
  const [missionFilter, setMissionFilter] = useState<'all' | 'planned' | 'in_progress' | 'completed' | 'cancelled'>('all');
  const [selectedDayMissions, setSelectedDayMissions] = useState<Mission[] | null>(null);
  const [missionDetailsModal, setMissionDetailsModal] = useState<Mission | null>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const el = mainScrollRef.current;
    if (el && el.scrollTop === 0) {
      pullStartYRef.current = e.touches[0].clientY;
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (pullStartYRef.current === null) return;
    const dist = e.touches[0].clientY - pullStartYRef.current;
    if (dist > 0) {
      setIsPulling(true);
      setPullDistance(Math.min(dist, PULL_THRESHOLD * 1.5));
    }
  }, []);

  const handleTouchEnd = useCallback(async () => {
    if (pullDistance >= PULL_THRESHOLD && !isRefreshing) {
      setIsRefreshing(true);
      try { await refreshData(); } catch { }
      setIsRefreshing(false);
    }
    pullStartYRef.current = null;
    setIsPulling(false);
    setPullDistance(0);
  }, [pullDistance, isRefreshing, refreshData]);

  const provider = providers.find(p => String(p.id) === String(simulatedProviderId));
  const hasProviderId = Boolean(simulatedProviderId);
  const isProviderPortalLoading = Boolean(dataLoading) || (hasProviderId && !provider);
  const showShimmerLoader = isProviderPortalLoading && !loaderSeen;
  const [activeTab, setActiveTab] = useState<'dashboard' | 'leaves' | 'live' | 'scans' | 'archive'>('dashboard');
  const [toast, setToast] = useState<{ show: boolean; message: string; type?: 'success' | 'error' | 'warning' }>({ show: false, message: '', type: 'success' });
  
  // Mobile menu state
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  const [isReferrer, setIsReferrer] = useState(false);
  const [referralCode, setReferralCode] = useState('');

  useEffect(() => {
    try {
      const seen = String(localStorage.getItem(LOADER_SEEN_KEY) || '').trim() === '1';
      loaderSeenRef.current = seen;
      setLoaderSeen(seen);
    } catch {
      loaderSeenRef.current = false;
      setLoaderSeen(false);
    }

    try {
      const v = String(localStorage.getItem('mkt_client_is_referrer') || '').trim();
      setIsReferrer(v === '1' || v.toLowerCase() === 'true');
    } catch {
      setIsReferrer(false);
    }
  }, []);

  useEffect(() => {
    try {
      const code = String(localStorage.getItem('mkt_client_referral_code') || '').trim();
      setReferralCode(code);
    } catch {
      setReferralCode('');
    }
  }, []);

  const referralLink = useMemo(() => {
    const code = String(referralCode || '').trim();
    if (!code) return '';
    try {
      const base = typeof window !== 'undefined' ? String(window.location.origin || '').trim() : '';
      if (!base) return '';
      return `${base}/parrainage/inscription?code=${encodeURIComponent(code)}`;
    } catch {
      return '';
    }
  }, [referralCode]);
  
  // Notification State
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const [showAllNotifsModal, setShowAllNotifsModal] = useState(false);
  const [showMobileNotifModal, setShowMobileNotifModal] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);

  // Fermer le menu mobile au clic externe
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(event.target as Node)) {
        setShowMobileMenu(false);
      }
    };

    if (showMobileMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showMobileMenu]);

  // Fermer le menu notifications au clic externe
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setShowNotifDropdown(false);
      }
    };

    if (showNotifDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showNotifDropdown]);

  // Live Stream State
  const [showVideoCall, setShowVideoCall] = useState(false);
  const [selectedMissionForCall, setSelectedMissionForCall] = useState<Mission | null>(null);
  const [streamError, setStreamError] = useState('');

  // Execution Modals
  const [selectedMissionId, setSelectedMissionId] = useState<string | null>(null);
  const [executionStep, setExecutionStep] = useState<'start' | 'end' | 'cancel' | null>(null);
  
  // Execution Form
  const [remark, setRemark] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [video, setVideo] = useState<string | undefined>(undefined);
  const [cancelReason, setCancelReason] = useState('');
  const [isSubmittingExecution, setIsSubmittingExecution] = useState(false);

  // Leaves Form
  const [leaveForm, setLeaveForm] = useState({ start: '', end: '', startTime: '08:00', endTime: '18:00' });

  // File Input Refs
  const photoInputRef = useRef<HTMLInputElement>(null);
  const photoCameraInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const videoCameraInputRef = useRef<HTMLInputElement>(null);
  const [videoLinkInput, setVideoLinkInput] = useState('');
  const [showVideoLinkInput, setShowVideoLinkInput] = useState(false);
  
  // Media source choice modal
  const [mediaChoiceModal, setMediaChoiceModal] = useState<{
    show: boolean;
    type: 'photo' | 'video' | null;
  }>({ show: false, type: null });

  // Optimized mission loading with caching and pagination
  const MISSIONS_CACHE_KEY = `provider_missions_${provider?.id}`;
  const [displayCount, setDisplayCount] = useState(20); // Pagination: show 20 initially
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  
  // Load cached missions immediately for instant display
  const [cachedMissions, setCachedMissions] = useState<Mission[]>(() => {
    if (typeof window !== 'undefined' && provider?.id) {
      try {
        const cached = localStorage.getItem(MISSIONS_CACHE_KEY);
        if (cached) {
          const parsed = JSON.parse(cached);
          return Array.isArray(parsed) ? parsed : [];
        }
      } catch { /* ignore */ }
    }
    return [];
  });

  // Update cache when missions change
  useEffect(() => {
    if (provider?.id && missions?.length > 0) {
      const providerMissionsData = missions.filter(m => 
        String((m as any)?.providerId || '') === String(provider.id)
      );
      try {
        localStorage.setItem(MISSIONS_CACHE_KEY, JSON.stringify(providerMissionsData.slice(0, 100)));
      } catch { /* ignore */ }
    }
  }, [missions, provider?.id]);

  // Memoized provider missions with optimized filtering
  const providerMissions = useMemo(() => {
    if (!provider) return cachedMissions; // Use cache immediately
    
    const filtered = (missions || cachedMissions || [])
      .filter(m => matchesServiceTypeFilterFromText((m as any)?.service, serviceTypeFilter))
      .filter(m => String((m as any)?.providerId || '') === String(provider.id));
    
    return filtered;
  }, [missions, provider, serviceTypeFilter, cachedMissions]);

  // Load more missions handler
  const handleLoadMore = useCallback(() => {
    setIsLoadingMore(true);
    setTimeout(() => {
      setDisplayCount(prev => Math.min(prev + 20, providerMissions.length));
      setIsLoadingMore(false);
    }, 100);
  }, [providerMissions.length]);

  // Paginated missions for display
  const paginatedMissions = useMemo(() => {
    return providerMissions.slice(0, displayCount);
  }, [providerMissions, displayCount]);

  // Active missions count (optimized)
  const activeMissions = useMemo(() => 
    providerMissions.filter(m => m.status === 'in_progress' || m.status === 'planned'),
    [providerMissions]
  );

  // Notifications for provider
  const allProviderNotifs = useMemo(() => 
    provider ? notifications.filter(n => n.targetUserType === 'provider' && (!n.targetUserId || n.targetUserId === provider.id)) : [],
    [notifications, provider]
  );
  
  const unreadProviderNotifs = useMemo(() => 
    allProviderNotifs.filter(n => !n.read),
    [allProviderNotifs]
  );

  // Optimized filtered missions by date
  const filteredMissionsByDate = useMemo(() => {
    if (!selectedDate) return paginatedMissions;
    const selectedDateStr = dayjs(selectedDate).format('YYYY-MM-DD');
    // Use all missions for date filtering, not just paginated
    return providerMissions.filter(m => m.date === selectedDateStr).slice(0, 50);
  }, [providerMissions, selectedDate]);

  // Fast stats calculation
  const missionStats = useMemo(() => ({
    total: providerMissions.length,
    planned: providerMissions.filter(m => m.status === 'planned').length,
    inProgress: providerMissions.filter(m => m.status === 'in_progress').length,
    completed: providerMissions.filter(m => m.status === 'completed').length,
    cancelled: providerMissions.filter(m => m.status === 'cancelled').length,
    today: filteredMissionsByDate.length
  }), [providerMissions, filteredMissionsByDate.length]);

  // Calendar days generation
  const calendarDays = useMemo(() => {
    const startOfMonth = currentMonth.startOf('month');
    const endOfMonth = currentMonth.endOf('month');
    const startOfWeek = startOfMonth.startOf('week');
    const endOfWeek = endOfMonth.endOf('week');
    
    const days = [];
    let current = startOfWeek;
    
    while (current.isBefore(endOfWeek) || current.isSame(endOfWeek, 'day')) {
      days.push(current);
      current = current.add(1, 'day');
    }
    
    return days;
  }, [currentMonth]);

  // Scan history filters for providers
  const [scanFilters, setScanFilters] = useState({
    startDate: '',
    endDate: '',
    clientId: '',
    type: '' as '' | 'entry' | 'exit'
  });

  const providerScansHistory = useMemo(() => {
    if (!provider) return [] as any[];

    let filtered = (visitScans || []).filter((s: any) => s.scannerId === provider.id);

    if (scanFilters.clientId) {
      filtered = filtered.filter((s: any) => s.clientId === scanFilters.clientId);
    }
    if (scanFilters.type) {
      filtered = filtered.filter((s: any) => s.scanType === scanFilters.type);
    }
    if (scanFilters.startDate) {
      filtered = filtered.filter((s: any) => new Date(s.timestamp) >= new Date(scanFilters.startDate));
    }
    if (scanFilters.endDate) {
      const end = new Date(scanFilters.endDate);
      end.setHours(23, 59, 59, 999);
      filtered = filtered.filter((s: any) => new Date(s.timestamp) <= end);
    }

    return filtered
      .map((scan: any) => {
        const client = clients.find((c: any) => c.id === scan.clientId);
        return {
          ...scan,
          clientName: client ? client.name : 'Client Inconnu'
        };
      })
      .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [visitScans, provider, scanFilters, clients]);

  // Cleanup on unmount
  useEffect(() => {
      return () => {
          if (activeStream) {
              stopLiveStream();
          }
      };
  }, [activeStream]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fonctions utilitaires (doivent être définies avant les hooks qui les utilisent)
  const showToast = (message: string, type: 'success' | 'error' | 'warning' = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type }), 3000);
  };

  const handleNotificationClick = (notif: any) => {
      markNotificationRead(notif.id);
      const link = typeof notif?.link === 'string' ? String(notif.link) : '';
      if (link.startsWith('mission:')) {
          setActiveTab('dashboard');
      } else if (link === 'tab:live') {
          setActiveTab('live');
      } else if (link === 'tab:scans') {
          setActiveTab('scans');
      } else if (link === 'tab:leaves') {
          setActiveTab('leaves');
      }
      setShowNotifDropdown(false);
      setShowAllNotifsModal(false);
  };

  const detectAvailableCameras = async () => {
      // Fonction conservée pour compatibilité mais non utilisée
      try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const cameras = devices.filter(device => device.kind === 'videoinput');
          console.log('Caméras détectées:', cameras.length);
      } catch (error) {
          console.error('Erreur lors de la détection des caméras:', error);
      }
  };

  useEffect(() => {
    if (!showShimmerLoader) return;
    if (loaderSeenRef.current) return;
    loaderSeenRef.current = true;
    setLoaderSeen(true);
    try {
      localStorage.setItem(LOADER_SEEN_KEY, '1');
    } catch {
      // ignore
    }
  }, [showShimmerLoader]);

  // Early return après tous les hooks
  if (!hasProviderId) {
    return (
      <div className="h-full flex items-center justify-center bg-gradient-to-br from-[#f0fdf4] to-[#ecfdf5]">
        <div className="w-full max-w-md px-6">
          <div className="bg-white/80 backdrop-blur-xl border border-white/50 rounded-3xl p-6 shadow-xl">
            <div className="text-lg font-bold text-gray-800">Aucun prestataire sélectionné</div>
            <div className="text-sm text-gray-500 mt-2">Reconnectez-vous pour accéder à votre espace.</div>
            <button
              type="button"
              onClick={() => { setSimulatedProviderId(null); logout(true); }}
              className="mt-5 w-full flex items-center justify-center gap-2 bg-gradient-to-r from-red-500 to-red-600 text-white font-bold py-3 rounded-xl transition shadow-lg shadow-red-200"
            >
              <LogOut className="w-5 h-5" /> Déconnexion
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!provider && dataLoading) {
    if (showShimmerLoader) return <PageLoader />;
    return (
      <div className="h-full flex items-center justify-center bg-gradient-to-br from-[#f0fdf4] to-[#ecfdf5]">
        <div className="flex items-center gap-3 text-gray-600 font-bold">
          <Loader className="w-5 h-5 animate-spin" /> Chargement…
        </div>
      </div>
    );
  }

  if (!provider) {
    return (
      <div className="h-full flex items-center justify-center bg-gradient-to-br from-[#f0fdf4] to-[#ecfdf5]">
        <div className="w-full max-w-md px-6">
          <div className="bg-white/80 backdrop-blur-xl border border-white/50 rounded-3xl p-6 shadow-xl">
            <div className="text-lg font-bold text-gray-800">Prestataire introuvable</div>
            <div className="text-sm text-gray-500 mt-2">Votre session semble invalide. Reconnectez-vous.</div>
            <button
              type="button"
              onClick={() => { setSimulatedProviderId(null); logout(true); }}
              className="mt-5 w-full flex items-center justify-center gap-2 bg-gradient-to-r from-red-500 to-red-600 text-white font-bold py-3 rounded-xl transition shadow-lg shadow-red-200"
            >
              <LogOut className="w-5 h-5" /> Déconnexion
            </button>
          </div>
        </div>
      </div>
    );
  }

  const openExecutionModal = (missionId: string, step: 'start' | 'end' | 'cancel') => {
      setSelectedMissionId(missionId);
      setExecutionStep(step);
      setRemark('');
      setPhotos([]);
      setVideo(undefined);
      setCancelReason('');
      setShowVideoLinkInput(false);
      setVideoLinkInput('');
  };

  const compressAndUploadImage = async (file: File, missionId: string): Promise<string | null> => {
    const objectUrl = URL.createObjectURL(file);
    try {
      // Compression
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error('image_load_failed'));
        el.src = objectUrl;
      });

      const maxSize = 1280;
      let width = img.naturalWidth || img.width;
      let height = img.naturalHeight || img.height;
      if (width > maxSize || height > maxSize) {
        if (width >= height) {
          height = Math.round((height * maxSize) / width);
          width = maxSize;
        } else {
          width = Math.round((width * maxSize) / height);
          height = maxSize;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, width);
      canvas.height = Math.max(1, height);
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('canvas_context_missing');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      // Convert to Blob for upload
      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.82);
      });

      // Upload to Supabase Storage
      const path = `missions/${missionId}/photos/${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`;
      const { error: upErr } = await supabase.storage
        .from('mission-media')
        .upload(path, blob, { contentType: 'image/jpeg' });

      if (upErr) throw upErr;

      // Get public URL
      const { data: pub } = supabase.storage.from('mission-media').getPublicUrl(path);
      const url = String((pub as any)?.publicUrl || '').trim();
      if (!url) throw new Error('upload_failed');

      return url;
    } catch (err) {
      console.error('[compressAndUploadImage] Failed:', err);
      return null;
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  };

  // --- PHOTO HANDLERS ---
  const handlePhotoClick = () => {
     if(photos.length >= 10) {
         showToast('Maximum 10 photos.');
         return;
     }
     // Show choice modal instead of directly opening file picker
     setMediaChoiceModal({ show: true, type: 'photo' });
  };
  
  const handlePhotoSourceChoice = (source: 'camera' | 'gallery') => {
    setMediaChoiceModal({ show: false, type: null });
    if (source === 'camera') {
      photoCameraInputRef.current?.click();
    } else {
      photoInputRef.current?.click();
    }
  };

  const handlePhotoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
     if (!selectedMissionId) {
       showToast('Veuillez d\'abord sélectionner une mission', 'error');
       return;
     }
     
     try {
        if (e.target.files && e.target.files.length > 0) {
            const files = Array.from(e.target.files) as File[];
            const remaining = 10 - photos.length;
            const filesToProcess = files.slice(0, remaining);

            showToast('Upload des photos en cours...', 'success');
            
            const uploadedUrls = await Promise.all(
                filesToProcess.map(async (file) => {
                    try {
                        return await compressAndUploadImage(file, selectedMissionId);
                    } catch {
                        return null;
                    }
                })
            );

            const validUrls = uploadedUrls.filter((url): url is string => typeof url === 'string' && url.length > 0);
            if (validUrls.length > 0) {
                setPhotos(prev => [...prev, ...validUrls]);
                showToast(`${validUrls.length} photo(s) uploadée(s) avec succès`, 'success');
            } else {
                showToast('Échec de l\'upload des photos', 'error');
            }
        }
     } finally {
        if (e.target) e.target.value = '';
     }
  };

  const removePhoto = (index: number) => {
      setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  // --- VIDEO HANDLERS ---
  const handleVideoClick = () => {
      // Show choice modal instead of directly opening file picker
      setMediaChoiceModal({ show: true, type: 'video' });
  };
  
  const handleVideoSourceChoice = (source: 'camera' | 'gallery') => {
    setMediaChoiceModal({ show: false, type: null });
    if (source === 'camera') {
      videoCameraInputRef.current?.click();
    } else {
      videoInputRef.current?.click();
    }
  };

  const handleVideoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!selectedMissionId) {
        showToast('Veuillez d\'abord sélectionner une mission', 'error');
        return;
      }
      
      const file = e.target.files?.[0];
      if (file) {
          if (file.size > 100 * 1024 * 1024) { // 100MB Limit
              alert("Fichier trop volumineux (Max 100Mo)");
              return;
          }
          
          showToast('Upload de la vidéo en cours...', 'success');
          
          try {
            // Upload direct to Supabase Storage
            const path = `missions/${selectedMissionId}/videos/${Date.now()}_${Math.random().toString(36).slice(2)}.mp4`;
            const { error: upErr } = await supabase.storage
              .from('mission-media')
              .upload(path, file, { contentType: file.type || 'video/mp4' });

            if (upErr) throw upErr;

            // Get public URL
            const { data: pub } = supabase.storage.from('mission-media').getPublicUrl(path);
            const url = String((pub as any)?.publicUrl || '').trim();
            if (!url) throw new Error('upload_failed');

            setVideo(url);
            setShowVideoLinkInput(false);
            showToast('Vidéo uploadée avec succès', 'success');
          } catch (err) {
            console.error('[handleVideoFileChange] Upload failed:', err);
            showToast('Échec de l\'upload de la vidéo', 'error');
          }
      }
      if (e.target) e.target.value = '';
  };

  const handleAddVideoLink = () => {
      if (videoLinkInput.trim()) {
          setVideo(videoLinkInput);
          setShowVideoLinkInput(false);
          setVideoLinkInput('');
      }
  };

  const removeVideo = () => {
      setVideo(undefined);
  };

  const handleSubmitExecution = async () => {
      if (!selectedMissionId) return;
      if (isSubmittingExecution) return;

      // Validation: 5 photos OU 1 vidéo obligatoire (XOR - un des deux mais pas les deux)
      if (executionStep === 'start' || executionStep === 'end') {
        const hasMinPhotos = photos.length >= 5;
        const hasVideo = !!video;
        
        // XOR: exactement un des deux doit être vrai
        if (!hasMinPhotos && !hasVideo) {
          alert('Vous devez fournir soit 5 photos minimum, soit 1 vidéo. L\'un ou l\'autre est obligatoire.');
          return;
        }
        if (hasMinPhotos && hasVideo) {
          alert('Veuillez choisir : soit les photos (5 minimum), soit la vidéo (1), mais pas les deux en même temps.');
          return;
        }
      }
      
      if (executionStep === 'cancel') {
          if (!cancelReason.trim()) {
              alert('Motif obligatoire.');
              return;
          }
      }

      setIsSubmittingExecution(true);
      try {
          if (executionStep === 'start') {
              await enqueueStartMission(selectedMissionId, remark, photos, video);
              showToast("Envoi en cours… La mission démarrera dès que l'upload est terminé.");
              setExecutionStep(null);
              setSelectedMissionId(null);
              setRemark('');
              setPhotos([]);
              setVideo(undefined);
              return;
          }
          if (executionStep === 'end') {
              await enqueueEndMission(selectedMissionId, remark, photos, video);
              showToast("Envoi en cours… La mission sera clôturée dès que l'upload est terminé.");
              setExecutionStep(null);
              setSelectedMissionId(null);
              setRemark('');
              setPhotos([]);
              setVideo(undefined);
              return;
          }
          if (executionStep === 'cancel') {
              await cancelMissionByProvider(selectedMissionId, cancelReason);
              showToast('Mission annulée. Secrétariat notifié.');
              window.location.reload();
              return;
          }

          setExecutionStep(null);
          setSelectedMissionId(null);
      } catch (e: any) {
          console.error(e);
          showToast(String(e?.message || "Erreur lors de l'envoi. Veuillez réessayer."), 'error');
      } finally {
          setIsSubmittingExecution(false);
      }
  };

  const handleSubmitLeave = (e: React.FormEvent) => {
      e.preventDefault();
      if(leaveForm.start && leaveForm.end) {
          addLeave(provider.id, leaveForm.start, leaveForm.end, leaveForm.startTime, leaveForm.endTime);
          showToast('Congés déclarés. Planning mis à jour.');
          setLeaveForm({ start: '', end: '', startTime: '08:00', endTime: '18:00' });
      }
  };

  const startCamera = async () => {
      // Fonction obsolète remplacée par startVideoCall
      console.log('startCamera est obsolète, utilisez startVideoCall');
  };

  const stopCamera = () => {
      // Fonction obsolète remplacée par endVideoCall
      console.log('stopCamera est obsolète, utilisez endVideoCall');
  };

  const toggleMic = () => {
      // Fonction obsolète - gérée par VideoCallManager
      console.log('toggleMic est obsolète, géré par VideoCallManager');
  };

  const startVideoCall = async (mission: Mission) => {
    try {
      setSelectedMissionForCall(mission);
      
      // Vérifier que le clientId existe
      if (!mission.clientId) {
        throw new Error('Client ID manquant pour cette mission');
      }
      
      // Démarrer le stream live
      await startLiveStream(provider.id, mission.clientId);
      
      // Activer l'interface vidéo
      setShowVideoCall(true);
      showToast('Appel vidéo démarré avec succès', 'success');
      
    } catch (error: any) {
      console.error('Erreur lors du démarrage de l\'appel vidéo:', error);
      setStreamError(error.message || 'Impossible de démarrer l\'appel vidéo');
      showToast('Erreur lors du démarrage de l\'appel vidéo', 'error');
    }
  };

  const endVideoCall = () => {
    stopLiveStream();
    setShowVideoCall(false);
    setSelectedMissionForCall(null);
    showToast('Appel vidéo terminé', 'success');
  };

  return (
    <div className="h-full bg-gradient-to-br from-[#f0fdf4] via-[#ecfdf5] to-[#fefce8] flex flex-col font-sans relative overflow-hidden">
      
      {/* Hidden Inputs for Uploads */}
      {/* Gallery inputs - allow multiple selection */}
      <input type="file" ref={photoInputRef} className="hidden" accept="image/*" multiple onChange={handlePhotoFileChange} />
      <input type="file" ref={videoInputRef} className="hidden" accept="video/*" onChange={handleVideoFileChange} />
      {/* Camera inputs - capture directly from camera */}
      <input type="file" ref={photoCameraInputRef} className="hidden" accept="image/*" capture="environment" onChange={handlePhotoFileChange} />
      <input type="file" ref={videoCameraInputRef} className="hidden" accept="video/*" capture="environment" onChange={handleVideoFileChange} />

      {/* Mobile Header - Modern Design */}
      <header className="md:hidden bg-white/70 backdrop-blur-xl border-b border-white/50 px-4 py-3 flex justify-between items-center z-20 shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => setShowMobileMenu(!showMobileMenu)} className="p-2 rounded-full hover:bg-white/50 transition">
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h1 className="font-bold text-gray-800 text-lg">Presta</h1>
            <p className="text-xs text-gray-500">Espace prestataire</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setShowMobileNotifModal(true)}
            className="p-2 rounded-full hover:bg-white/50 transition relative"
          >
            <Bell className="w-5 h-5 text-gray-600" />
            {unreadProviderNotifs.length > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
            )}
          </button>
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center font-bold text-sm shadow-lg shadow-emerald-200">
            {provider.firstName.charAt(0)}{provider.lastName.charAt(0)}
          </div>
        </div>
      </header>

      {/* Desktop Header - Modern Design */}
      <header className="hidden md:flex bg-white border-b border-gray-100 px-8 py-4 justify-between items-center z-20 shrink-0">
        {/* Logo & Navigation */}
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
              <Briefcase className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-xl text-gray-800">Presta</span>
          </div>
          
          <nav className="flex items-center gap-1">
            {[
              { id: 'dashboard', label: 'Dashboard', icon: Briefcase },
              { id: 'archive', label: 'Archives', icon: CheckCircle },
              { id: 'live', label: 'Live Vidéo', icon: Video },
              { id: 'scans', label: 'Scans', icon: ScanLine },
              { id: 'leaves', label: 'Congés', icon: CalendarX },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as any)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${
                  activeTab === item.id
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Right Side - Notifications & Profile */}
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setShowAllNotifsModal(true)}
            className="relative p-2 rounded-xl hover:bg-gray-100 transition"
          >
            <Bell className="w-5 h-5 text-gray-600" />
            {unreadProviderNotifs.length > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
            )}
          </button>
          
          <div className="flex items-center gap-3 pl-4 border-l border-gray-200">
            <div className="text-right">
              <p className="text-sm font-bold text-gray-800">{provider?.firstName} {provider?.lastName}</p>
              <p className="text-xs text-emerald-600 font-medium">Prestataire</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center font-bold text-sm shadow-lg shadow-emerald-200">
              {provider.firstName.charAt(0)}{provider.lastName.charAt(0)}
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      {showMobileMenu && (
        <div className="md:hidden fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" onClick={() => setShowMobileMenu(false)}>
          <div ref={mobileMenuRef} className="bg-white/95 backdrop-blur-xl w-72 h-full shadow-2xl overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-lg text-gray-800">Menu</h2>
                <button onClick={() => setShowMobileMenu(false)} className="p-2 rounded-full hover:bg-gray-100 transition">
                  <X className="w-5 h-5 text-gray-600" />
                </button>
              </div>
            </div>
            <nav className="p-4 space-y-2">
              <button onClick={() => { setActiveTab('dashboard'); setShowMobileMenu(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'dashboard' ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-200' : 'text-gray-600 hover:bg-gray-50'}`}>
                <Briefcase className="w-5 h-5" /> Missions
              </button>
              <button onClick={() => { setActiveTab('archive'); setShowMobileMenu(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'archive' ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-200' : 'text-gray-600 hover:bg-gray-50'}`}>
                <CheckCircle className="w-5 h-5" /> Archives
              </button>
              <button onClick={() => { setActiveTab('live'); setShowMobileMenu(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'live' ? 'bg-gradient-to-r from-red-500 to-rose-600 text-white shadow-lg shadow-red-200' : 'text-gray-600 hover:bg-gray-50'}`}>
                <Wifi className="w-5 h-5" /> Live Vidéo
              </button>
              <button onClick={() => { setActiveTab('scans'); setShowMobileMenu(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'scans' ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-200' : 'text-gray-600 hover:bg-gray-50'}`}>
                <ScanLine className="w-5 h-5" /> Mes scans
              </button>
              <button onClick={() => { setActiveTab('leaves'); setShowMobileMenu(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'leaves' ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-200' : 'text-gray-600 hover:bg-gray-50'}`}>
                <CalendarX className="w-5 h-5" /> Absences
              </button>
              <div className="border-t border-gray-200 pt-4 mt-4">
                <button onClick={() => { setSimulatedProviderId(null); logout(true); }} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-red-500 hover:bg-red-50 transition">
                  <LogOut className="w-5 h-5" /> Déconnexion
                </button>
              </div>
            </nav>
          </div>
        </div>
      )}

      <div className="flex-1 flex overflow-hidden relative">
        {/* Mobile Sidebar Only */}
        <nav className="hidden md:hidden w-64 bg-white/80 backdrop-blur-xl border-r border-white/50 flex-col p-4 space-y-2 shrink-0">
          <div className="px-2 pb-2 text-xs font-extrabold text-gray-500 uppercase">Menu prestataire</div>
          <button onClick={() => setActiveTab('dashboard')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'dashboard' ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-200' : 'text-gray-600 hover:bg-gray-50'}`}>
            <Briefcase className="w-5 h-5" /> Missions
          </button>
          <button onClick={() => setActiveTab('archive')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'archive' ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-200' : 'text-gray-600 hover:bg-gray-50'}`}>
            <CheckCircle className="w-5 h-5" /> Archives
          </button>
          <button onClick={() => setActiveTab('live')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'live' ? 'bg-gradient-to-r from-red-500 to-rose-600 text-white shadow-lg shadow-red-200' : 'text-gray-600 hover:bg-gray-50'}`}>
            <Wifi className="w-5 h-5" /> Live Vidéo
          </button>
          <button onClick={() => setActiveTab('scans')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'scans' ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-200' : 'text-gray-600 hover:bg-gray-50'}`}>
            <ScanLine className="w-5 h-5" /> Mes scans
          </button>
          <button onClick={() => setActiveTab('leaves')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'leaves' ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-200' : 'text-gray-600 hover:bg-gray-50'}`}>
            <CalendarX className="w-5 h-5" /> Absences
          </button>
        </nav>

        {/* Main Content - Full width on desktop */}
        <main ref={mainScrollRef} className="flex-1 overflow-y-auto bg-gray-50/50" onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
          {isProviderPortalLoading ? (
            <PageLoader />
          ) : (
            <>
              {/* Pull-to-refresh indicator (mobile only) */}
              {(isPulling || isRefreshing) && (
                <div className="flex items-center justify-center transition-all duration-200 md:hidden" style={{ height: isRefreshing ? 48 : Math.min(pullDistance, 48), overflow: 'hidden' }}>
                  <div className={`flex items-center gap-2 text-sm text-emerald-600 font-medium ${isRefreshing ? 'animate-pulse' : ''}`}>
                    {isRefreshing ? (
                      <div className="w-12 h-2 bg-emerald-200 rounded animate-pulse" />
                    ) : (
                      <svg className="w-5 h-5" style={{ transform: `rotate(${Math.min(pullDistance / 70 * 180, 180)}deg)` }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    )}
                    {isRefreshing ? 'Actualisation…' : pullDistance >= 70 ? 'Relâchez pour actualiser' : 'Tirez pour actualiser'}
                  </div>
                </div>
              )}
              
              <div className="max-w-7xl mx-auto pb-24 md:pb-8">
                {activeTab === 'dashboard' && (
                  <div className="space-y-4 md:space-y-6 p-4 md:p-8">
                    {/* Mobile Calendar Section - Carte Date visible, calendrier masqué */}
                    <div className="md:hidden space-y-4">
                      {/* Date du jour - Visible en haut sur MOBILE uniquement */}
                      <div className="bg-gradient-to-r from-emerald-500 to-teal-600 rounded-2xl p-4 text-white shadow-lg shadow-emerald-200">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-emerald-100 text-sm font-medium">{dayjs(selectedDate).format('dddd')}</p>
                            <h2 className="text-3xl font-bold">{dayjs(selectedDate).format('D')}</h2>
                            <p className="text-emerald-100 text-sm">{dayjs(selectedDate).format('MMMM YYYY')}</p>
                          </div>
                          <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                            <Calendar className="w-7 h-7 text-white" />
                          </div>
                        </div>
                        <div className="mt-3 pt-3 border-t border-white/20 flex items-center justify-between">
                          <span className="text-sm text-emerald-100">
                            {filteredMissionsByDate.length} mission{filteredMissionsByDate.length > 1 ? 's' : ''} aujourd'hui
                          </span>
                          <button 
                            onClick={() => setSelectedDate(new Date())}
                            className="text-xs bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg transition"
                          >
                            Aujourd'hui
                          </button>
                        </div>
                      </div>

                      {/* Month Navigation - MASQUÉ sur mobile */}
                      <div className="hidden md:flex items-center justify-between bg-white/80 backdrop-blur-xl rounded-xl p-3">
                        <button 
                          onClick={() => setCurrentMonth(prev => prev.subtract(1, 'month'))}
                          className="p-2 rounded-lg hover:bg-gray-100 transition"
                        >
                          <ChevronLeft className="w-5 h-5 text-gray-600" />
                        </button>
                        <span className="font-bold text-gray-700">{currentMonth.format('MMMM YYYY')}</span>
                        <button 
                          onClick={() => setCurrentMonth(prev => prev.add(1, 'month'))}
                          className="p-2 rounded-lg hover:bg-gray-100 transition"
                        >
                          <ChevronRight className="w-5 h-5 text-gray-600" />
                        </button>
                      </div>
                      
                      {/* Horizontal Calendar - MASQUÉ sur mobile */}
                      <div className="hidden md:flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                        {calendarDays.map((day, idx) => {
                          const isSelected = day.isSame(selectedDate, 'day');
                          const isToday = day.isSame(new Date(), 'day');
                          const dayMissions = providerMissions.filter(m => m.date === day.format('YYYY-MM-DD'));
                          const hasMissions = dayMissions.length > 0;
                          const isCurrentMonth = day.month() === currentMonth.month();
                          
                          return (
                            <button
                              key={idx}
                              onClick={() => {
                                if (hasMissions) {
                                  setSelectedDayMissions(dayMissions);
                                }
                                setSelectedDate(day.toDate());
                              }}
                              className={`flex flex-col items-center justify-center min-w-[60px] h-[75px] rounded-2xl transition-all relative ${
                                isSelected 
                                  ? 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-200' 
                                  : isToday 
                                    ? 'bg-white border-2 border-emerald-400 text-emerald-600' 
                                    : hasMissions
                                      ? 'bg-amber-50 border border-amber-200 text-gray-700'
                                      : 'bg-white/80 text-gray-600 hover:bg-white'
                              } ${!isCurrentMonth ? 'opacity-40' : ''}`}
                            >
                              <span className={`text-[10px] font-medium uppercase ${isSelected ? 'text-emerald-100' : hasMissions ? 'text-amber-600' : 'text-gray-500'}`}>
                                {day.format('ddd')}
                              </span>
                              <span className={`text-lg font-bold ${isSelected ? 'text-white' : hasMissions ? 'text-amber-700' : ''}`}>
                                {day.format('D')}
                              </span>
                              {hasMissions && (
                                <div className={`mt-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                                  isSelected ? 'bg-white/20 text-white' : 'bg-amber-500 text-white'
                                }`}>
                                  {dayMissions.length} mission{dayMissions.length > 1 ? 's' : ''}
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* DESKTOP DASHBOARD - Modern Design */}
                    <div className="hidden md:block space-y-8">
                      {/* Welcome Section */}
                      <div className="flex items-start justify-between">
                        <div>
                          <h1 className="text-2xl font-bold text-gray-900">Bienvenue, {provider?.firstName}</h1>
                          <p className="text-gray-500 mt-1">Vous avez {activeMissions.length} mission{activeMissions.length > 1 ? 's' : ''} active{activeMissions.length > 1 ? 's' : ''} aujourd'hui</p>
                        </div>
                        <div className="flex items-center gap-2 bg-white rounded-xl p-1 border border-gray-200 shadow-sm">
                          <button
                            onClick={() => setDashboardViewMode('overview')}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                              dashboardViewMode === 'overview' 
                                ? 'bg-emerald-50 text-emerald-700' 
                                : 'text-gray-500 hover:text-gray-700'
                            }`}
                          >
                            Vue d'ensemble
                          </button>
                          <button
                            onClick={() => setDashboardViewMode('calendar')}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                              dashboardViewMode === 'calendar' 
                                ? 'bg-emerald-50 text-emerald-700' 
                                : 'text-gray-500 hover:text-gray-700'
                            }`}
                          >
                            Calendrier
                          </button>
                        </div>
                      </div>

                      {/* Stats Cards */}
                      <div className="grid grid-cols-6 gap-4">
                        {[
                          { label: 'Total Missions', value: providerMissions.length, color: 'bg-gray-50' },
                          { label: 'Planifiées', value: providerMissions.filter(m => m.status === 'planned').length, color: 'bg-amber-50' },
                          { label: 'En cours', value: providerMissions.filter(m => m.status === 'in_progress').length, color: 'bg-blue-50' },
                          { label: 'Terminées', value: providerMissions.filter(m => m.status === 'completed').length, color: 'bg-emerald-50' },
                          { label: 'Annulées', value: providerMissions.filter(m => m.status === 'cancelled').length, color: 'bg-red-50' },
                          { label: "Aujourd'hui", value: filteredMissionsByDate.length, color: 'bg-purple-50' },
                        ].map((stat, idx) => (
                          <div key={idx} className={`${stat.color} rounded-2xl p-4 border border-gray-100`}>
                            <p className="text-xs text-gray-500 font-medium">{stat.label}</p>
                            <p className="text-2xl font-bold text-gray-800 mt-1">{stat.value}</p>
                          </div>
                        ))}
                      </div>

                      {/* Calendar View for Desktop */}
                      {dashboardViewMode === 'calendar' && (
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                          {/* Calendar Header */}
                          <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-4">
                              <button 
                                onClick={() => setCurrentMonth(prev => prev.subtract(1, 'month'))}
                                className="p-2 rounded-xl hover:bg-gray-100 transition"
                              >
                                <ChevronLeft className="w-5 h-5 text-gray-600" />
                              </button>
                              <h2 className="text-xl font-bold text-gray-800">{currentMonth.format('MMMM YYYY')}</h2>
                              <button 
                                onClick={() => setCurrentMonth(prev => prev.add(1, 'month'))}
                                className="p-2 rounded-xl hover:bg-gray-100 transition"
                              >
                                <ChevronRight className="w-5 h-5 text-gray-600" />
                              </button>
                            </div>
                            <button 
                              onClick={() => setCurrentMonth(dayjs())}
                              className="px-4 py-2 bg-emerald-50 text-emerald-700 rounded-lg text-sm font-medium hover:bg-emerald-100 transition"
                            >
                              Aujourd'hui
                            </button>
                          </div>

                          {/* Weekday Headers */}
                          <div className="grid grid-cols-7 gap-2 mb-2">
                            {['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'].map(day => (
                              <div key={day} className="text-center text-xs font-bold text-gray-400 py-2">
                                {day}
                              </div>
                            ))}
                          </div>
                          
                          {/* Calendar Grid */}
                          <div className="grid grid-cols-7 gap-2">
                            {calendarDays.map((day, idx) => {
                              const isSelected = day.isSame(selectedDate, 'day');
                              const isToday = day.isSame(new Date(), 'day');
                              const dayMissions = providerMissions.filter(m => m.date === day.format('YYYY-MM-DD'));
                              const hasMissions = dayMissions.length > 0;
                              const isCurrentMonth = day.month() === currentMonth.month();
                              
                              return (
                                <button
                                  key={idx}
                                  onClick={() => {
                                    if (hasMissions) {
                                      setSelectedDayMissions(dayMissions);
                                    }
                                    setSelectedDate(day.toDate());
                                  }}
                                  className={`aspect-square rounded-2xl p-2 flex flex-col items-center justify-start transition-all relative ${
                                    isSelected 
                                      ? 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg' 
                                      : isToday 
                                        ? 'bg-emerald-50 border-2 border-emerald-400 text-emerald-700' 
                                        : hasMissions
                                          ? 'bg-amber-50 border border-amber-200 text-gray-700 hover:bg-amber-100'
                                          : 'bg-gray-50 text-gray-400 hover:bg-gray-100'
                                  } ${!isCurrentMonth ? 'opacity-40' : ''}`}
                                >
                                  <span className={`text-sm font-bold ${isSelected ? 'text-white' : isToday ? 'text-emerald-700' : hasMissions ? 'text-amber-700' : 'text-gray-600'}`}>
                                    {day.format('D')}
                                  </span>
                                  {hasMissions && (
                                    <div className={`mt-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                                      isSelected ? 'bg-white/20 text-white' : 'bg-amber-500 text-white'
                                    }`}>
                                      {dayMissions.length} mission{dayMissions.length > 1 ? 's' : ''}
                                    </div>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Recent Missions Cards - Only in overview mode */}
                      {dashboardViewMode === 'overview' && providerMissions.slice(0, 4).length > 0 && (
                        <div className="grid grid-cols-4 gap-4">
                          {providerMissions.slice(0, 4).map((m, idx) => {
                            const clientById = clients.find(c => String(c.id) === String(m.clientId || ''));
                            const normalizedMissionClientName = String(m.clientName || '').trim().toLowerCase();
                            const clientByName = !clientById && normalizedMissionClientName
                              ? clients.find(c => String(c.name || '').trim().toLowerCase() === normalizedMissionClientName)
                              : undefined;
                            const client = clientById || clientByName;
                            
                            const statusColors = {
                              planned: { bg: 'bg-amber-50', bar: 'bg-amber-400', text: 'text-amber-700' },
                              in_progress: { bg: 'bg-blue-50', bar: 'bg-blue-400', text: 'text-blue-700' },
                              completed: { bg: 'bg-emerald-50', bar: 'bg-emerald-400', text: 'text-emerald-700' },
                              cancelled: { bg: 'bg-red-50', bar: 'bg-red-400', text: 'text-red-700' }
                            };
                            const colors = statusColors[m.status as keyof typeof statusColors] || statusColors.planned;
                            
                            return (
                              <div key={m.id} className={`${colors.bg} rounded-2xl p-4 border border-gray-100`}>
                                {/* Date et Jour en premier */}
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="text-xs font-bold text-gray-600 uppercase">
                                    {dayjs(m.date).format('dddd')}
                                  </span>
                                  <span className="text-xs text-gray-400">
                                    {dayjs(m.date).format('D MMM')}
                                  </span>
                                </div>
                                {/* Nom client */}
                                <div className="flex items-center gap-2 mb-1">
                                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-xs font-bold">
                                    {m.clientName.charAt(0)}
                                  </div>
                                  <h4 className="font-bold text-gray-800 text-sm truncate">{m.clientName}</h4>
                                </div>
                                {/* Commune */}
                                {client?.city && (
                                  <p className="text-xs text-gray-500 mb-2 flex items-center gap-1">
                                    <MapPin className="w-3 h-3" /> {client.city}
                                  </p>
                                )}
                                {/* Service */}
                                <p className="text-xs text-gray-400">{m.service} • {m.startTime}</p>
                                <div className="mt-2 h-1 bg-gray-200 rounded-full overflow-hidden">
                                  <div className={`h-full ${colors.bar} rounded-full`} style={{ width: m.status === 'completed' ? '100%' : m.status === 'in_progress' ? '60%' : '30%' }}></div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Missions Table - Only in overview mode */}
                      {dashboardViewMode === 'overview' && (
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
                        {/* Table Header with Filters */}
                        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                          <h3 className="font-bold text-gray-800">Mes Missions</h3>
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
                              {[
                                { id: 'all', label: 'Toutes' },
                                { id: 'planned', label: 'Planifiées' },
                                { id: 'in_progress', label: 'En cours' },
                                { id: 'completed', label: 'Terminées' },
                              ].map((f) => (
                                <button
                                  key={f.id}
                                  onClick={() => setMissionFilter(f.id as any)}
                                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
                                    missionFilter === f.id
                                      ? 'bg-white text-emerald-700 shadow-sm'
                                      : 'text-gray-500 hover:text-gray-700'
                                  }`}
                                >
                                  {f.label}
                                </button>
                              ))}
                            </div>
                            <button className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
                              <Search className="w-4 h-4" />
                            </button>
                            <button className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
                              <Filter className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Table */}
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-4 py-3 text-left text-xs font-bold text-gray-500">Client</th>
                                <th className="px-4 py-3 text-left text-xs font-bold text-gray-500">Service</th>
                                <th className="px-4 py-3 text-left text-xs font-bold text-gray-500">Date</th>
                                <th className="px-4 py-3 text-left text-xs font-bold text-gray-500">Horaire</th>
                                <th className="px-4 py-3 text-left text-xs font-bold text-gray-500">Statut</th>
                                <th className="px-4 py-3 text-right text-xs font-bold text-gray-500">Action</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {providerMissions
                                .filter(m => missionFilter === 'all' || m.status === missionFilter)
                                .slice(0, 10)
                                .map((m) => {
                                  const statusConfig = {
                                    planned: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Planifiée' },
                                    in_progress: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'En cours' },
                                    completed: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Terminée' },
                                    cancelled: { bg: 'bg-red-100', text: 'text-red-700', label: 'Annulée' }
                                  };
                                  const status = statusConfig[m.status as keyof typeof statusConfig] || statusConfig.planned;
                                  
                                  return (
                                    <tr key={m.id} className="hover:bg-gray-50 transition">
                                      <td className="px-4 py-3">
                                        <div className="flex items-center gap-3">
                                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-xs font-bold">
                                            {m.clientName.charAt(0)}
                                          </div>
                                          <span className="text-sm font-medium text-gray-800">{m.clientName}</span>
                                        </div>
                                      </td>
                                      <td className="px-4 py-3 text-sm text-gray-600">{m.service}</td>
                                      <td className="px-4 py-3 text-sm text-gray-600">{dayjs(m.date).format('D MMMM YYYY')}</td>
                                      <td className="px-4 py-3 text-sm text-gray-600">{m.startTime} - {m.endTime}</td>
                                      <td className="px-4 py-3">
                                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${status.bg} ${status.text}`}>
                                          {status.label}
                                        </span>
                                      </td>
                                      <td className="px-4 py-3 text-right">
                                        <button
                                          onClick={() => setMissionDetailsModal(m)}
                                          className="text-emerald-600 hover:text-emerald-700 text-sm font-medium"
                                        >
                                          Voir détails
                                        </button>
                                      </td>
                                    </tr>
                                  );
                                })}
                            </tbody>
                          </table>
                        </div>
                        
                        {providerMissions.filter(m => missionFilter === 'all' || m.status === missionFilter).length === 0 && (
                          <div className="p-8 text-center text-gray-400">
                            <div className="w-16 h-16 mx-auto mb-3 bg-gray-100 rounded-full flex items-center justify-center">
                              <Briefcase className="w-8 h-8 text-gray-300" />
                            </div>
                            <p className="font-medium">Aucune mission trouvée</p>
                          </div>
                        )}
                        </div>
                      )}

                    </div>

                    {/* Mobile content stays the same */}
                    {/* Mobile Calendar Section */}
                    <div className="md:hidden space-y-4">
                      {/* Calendar Header with View Toggle */}
                      <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-4">
                          <button 
                            onClick={() => setCurrentMonth(prev => prev.subtract(1, 'month'))}
                            className="p-2 rounded-xl hover:bg-gray-100 transition"
                          >
                            <ChevronLeft className="w-5 h-5 text-gray-600" />
                          </button>
                          <h2 className="text-xl font-bold text-gray-800">{currentMonth.format('MMMM YYYY')}</h2>
                          <button 
                            onClick={() => setCurrentMonth(prev => prev.add(1, 'month'))}
                            className="p-2 rounded-xl hover:bg-gray-100 transition"
                          >
                            <ChevronRight className="w-5 h-5 text-gray-600" />
                          </button>
                        </div>
                        <div className="flex items-center gap-2 bg-gray-100 rounded-xl p-1">
                          <button 
                            onClick={() => setDashboardViewMode('horizontal')}
                            className={`px-4 py-2 rounded-lg text-sm font-bold transition ${dashboardViewMode === 'horizontal' ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                          >
                            Liste
                          </button>
                          <button 
                            onClick={() => setDashboardViewMode('grid')}
                            className={`px-4 py-2 rounded-lg text-sm font-bold transition ${dashboardViewMode === 'grid' ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                          >
                            Calendrier
                          </button>
                        </div>
                      </div>

                      {/* Grid Calendar */}
                      {dashboardViewMode === 'grid' && (
                        <div className="space-y-4">
                          {/* Weekday Headers */}
                          <div className="grid grid-cols-7 gap-2">
                            {['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'].map(day => (
                              <div key={day} className="text-center text-xs font-bold text-gray-400 py-2">
                                {day}
                              </div>
                            ))}
                          </div>
                          
                          {/* Calendar Grid */}
                          <div className="grid grid-cols-7 gap-2">
                            {calendarDays.map((day, idx) => {
                              const isSelected = day.isSame(selectedDate, 'day');
                              const isToday = day.isSame(new Date(), 'day');
                              const dayMissions = providerMissions.filter(m => m.date === day.format('YYYY-MM-DD'));
                              const hasMissions = dayMissions.length > 0;
                              const isCurrentMonth = day.month() === currentMonth.month();
                              
                              return (
                                <button
                                  key={idx}
                                  onClick={() => {
                                    if (hasMissions) {
                                      setSelectedDayMissions(dayMissions);
                                    } else {
                                      setSelectedDate(day.toDate());
                                    }
                                  }}
                                  className={`aspect-square rounded-2xl p-2 flex flex-col items-center justify-start transition-all relative ${
                                    isSelected 
                                      ? 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-200' 
                                      : isToday 
                                        ? 'bg-emerald-50 border-2 border-emerald-400 text-emerald-700' 
                                        : hasMissions
                                          ? 'bg-amber-50 border border-amber-200 text-gray-700 hover:bg-amber-100'
                                          : 'bg-gray-50 text-gray-400 hover:bg-gray-100'
                                  } ${!isCurrentMonth ? 'opacity-40' : ''}`}
                                >
                                  <span className={`text-sm font-bold ${isSelected ? 'text-white' : isToday ? 'text-emerald-700' : hasMissions ? 'text-amber-700' : 'text-gray-600'}`}>
                                    {day.format('D')}
                                  </span>
                                  {hasMissions && (
                                    <div className={`mt-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                                      isSelected ? 'bg-white/20 text-white' : 'bg-amber-500 text-white'
                                    }`}>
                                      {dayMissions.length} mission{dayMissions.length > 1 ? 's' : ''}
                                    </div>
                                  )}
                                  {isToday && !isSelected && (
                                    <div className="absolute bottom-1 w-1 h-1 rounded-full bg-emerald-500"></div>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Horizontal View (Desktop) */}
                      {dashboardViewMode === 'horizontal' && (
                        <div className="flex gap-2 overflow-x-auto pb-2">
                          {calendarDays.filter(d => d.month() === currentMonth.month()).map((day, idx) => {
                            const isSelected = day.isSame(selectedDate, 'day');
                            const isToday = day.isSame(new Date(), 'day');
                            const hasMission = providerMissions.some(m => m.date === day.format('YYYY-MM-DD'));
                            return (
                              <button
                                key={idx}
                                onClick={() => setSelectedDate(day.toDate())}
                                className={`flex flex-col items-center justify-center min-w-[60px] h-[80px] rounded-2xl transition-all ${
                                  isSelected 
                                    ? 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-200' 
                                    : isToday 
                                      ? 'bg-white border-2 border-emerald-400 text-emerald-600' 
                                      : 'bg-white/80 text-gray-600 hover:bg-white'
                                }`}
                              >
                                <span className="text-[10px] font-medium uppercase">{day.format('ddd')}</span>
                                <span className="text-xl font-bold">{day.format('D')}</span>
                                {hasMission && !isSelected && (
                                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-0.5"></div>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Mobile: Task Schedule Title */}
                    <div className="md:hidden flex items-center justify-between">
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wide">Planning</p>
                        <h3 className="text-lg font-bold text-gray-800">Tâches du jour</h3>
                      </div>
                      <button className="p-2 rounded-full bg-white/80 hover:bg-white shadow-sm transition">
                        <Sparkles className="w-4 h-4 text-emerald-600" />
                      </button>
                    </div>

                    {/* Missions List */}
                    {filteredMissionsByDate.length === 0 ? (
                      <div className="bg-white/80 backdrop-blur-xl p-8 rounded-3xl text-center border border-white/50 shadow-lg">
                        <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center">
                          <Briefcase className="w-10 h-10 text-gray-400" />
                        </div>
                        <p className="text-gray-500 font-medium">Aucune mission pour cette date</p>
                        <p className="text-sm text-gray-400 mt-1">Sélectionnez une autre date ou consultez toutes vos missions</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {filteredMissionsByDate.map((m, idx) => {
                          const clientById = clients.find(c => String(c.id) === String(m.clientId || ''));
                          const normalizedMissionClientName = String(m.clientName || '').trim().toLowerCase();
                          const clientByName = !clientById && normalizedMissionClientName
                            ? clients.find(c => String(c.name || '').trim().toLowerCase() === normalizedMissionClientName)
                            : undefined;
                          const client = clientById || clientByName;

                          const statusConfig = {
                            planned: { bg: 'from-amber-400 to-orange-500', text: 'Planifiée', icon: Clock },
                            in_progress: { bg: 'from-blue-400 to-indigo-500', text: 'En cours', icon: Wifi },
                            completed: { bg: 'from-emerald-400 to-teal-500', text: 'Terminée', icon: CheckCircle },
                            cancelled: { bg: 'from-red-400 to-rose-500', text: 'Annulée', icon: X }
                          };
                          const status = statusConfig[m.status as keyof typeof statusConfig] || statusConfig.planned;

                          return (
                            <div key={m.id} className="bg-white/90 backdrop-blur-xl rounded-3xl p-5 border border-white/50 shadow-lg shadow-gray-100/50 transition-all hover:shadow-xl">
                              {/* Header: Date + Jour prominently displayed */}
                              <div className="flex items-start justify-between mb-4">
                                <div className="flex-1">
                                  {/* Jour et Date en premier */}
                                  <div className="flex items-center gap-2 mb-2">
                                    <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-lg text-sm font-bold">
                                      {dayjs(m.date).format('dddd')}
                                    </span>
                                    <span className="text-lg font-bold text-gray-800">
                                      {dayjs(m.date).format('D MMMM YYYY')}
                                    </span>
                                  </div>
                                  {/* Nom complet client */}
                                  <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-xs font-bold">
                                      {m.clientName.charAt(0)}
                                    </div>
                                    <h3 className="font-bold text-gray-900 text-lg">{m.clientName}</h3>
                                  </div>
                                  {/* Commune/Ville */}
                                  {client?.city && (
                                    <p className="text-sm text-gray-500 mt-1 flex items-center gap-1">
                                      <MapPin className="w-3 h-3" /> {client.city}
                                    </p>
                                  )}
                                </div>
                                <span className={`px-3 py-1 rounded-full text-xs font-bold bg-gradient-to-r ${status.bg} text-white shadow-sm whitespace-nowrap`}>
                                  {status.text}
                                </span>
                              </div>

                              {/* Service + Horaire */}
                              <div className="bg-gray-50 rounded-xl p-3 mb-4 border border-gray-100">
                                <p className="font-medium text-gray-800">{m.service}</p>
                                <div className="flex items-center gap-4 text-sm text-gray-500 mt-2">
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-4 h-4 text-emerald-500" /> {m.startTime} - {m.endTime}
                                  </span>
                                </div>
                              </div>

                              {/* Client Info - Plus d'infos détaillées */}
                              <div className="bg-gray-50 rounded-2xl p-4 mb-4 border border-gray-100">
                                <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-200">
                                  <User className="w-4 h-4 text-emerald-500" />
                                  <span className="font-bold text-gray-700 text-sm">Informations client</span>
                                </div>
                                <div className="space-y-2 text-sm">
                                  <div className="flex items-start gap-2">
                                    <MapPin className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                                    <span className="text-gray-700">
                                      <span className="font-medium">Adresse:</span> {client?.address || 'Non renseignée'}{client?.city ? `, ${client.city}` : ''}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Phone className="w-4 h-4 text-gray-400 shrink-0" />
                                    <span className="text-gray-700">
                                      <span className="font-medium">Tél:</span> {client?.phone || 'Non renseigné'}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Mail className="w-4 h-4 text-gray-400 shrink-0" />
                                    <span className="text-gray-700 truncate">
                                      <span className="font-medium">Email:</span> {client?.email || 'Non renseigné'}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* Action Buttons */}
                              <div className="flex gap-2">
                                {m.status === 'planned' && (
                                  <>
                                    <button onClick={() => openExecutionModal(m.id, 'start')} className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-600 text-white py-3 rounded-xl text-sm font-bold shadow-lg shadow-emerald-200 hover:shadow-xl transition-all active:scale-95">
                                      Démarrer
                                    </button>
                                    <button onClick={() => openExecutionModal(m.id, 'cancel')} className="px-4 py-3 bg-gray-100 text-gray-500 rounded-xl hover:bg-gray-200 transition">
                                      <X className="w-5 h-5" />
                                    </button>
                                  </>
                                )}
                                {m.status === 'in_progress' && (
                                  <>
                                    <button onClick={() => openExecutionModal(m.id, 'end')} className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-600 text-white py-3 rounded-xl text-sm font-bold shadow-lg shadow-emerald-200 hover:shadow-xl transition-all active:scale-95 animate-pulse">
                                      Terminer
                                    </button>
                                    <button onClick={() => openExecutionModal(m.id, 'cancel')} className="px-4 py-3 bg-amber-100 text-amber-600 rounded-xl hover:bg-amber-200 transition">
                                      <AlertTriangle className="w-5 h-5" />
                                    </button>
                                  </>
                                )}
                                {m.status === 'completed' && (
                                  <div className="flex-1 bg-emerald-50 text-emerald-600 py-3 rounded-xl text-sm font-bold text-center border border-emerald-100">
                                    <CheckCircle className="w-4 h-4 inline mr-2" /> Mission validée
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Show All Missions Button (Mobile) */}
                    {filteredMissionsByDate.length > 0 && displayCount < providerMissions.length && (
                      <div className="text-center pt-4">
                        <button 
                          onClick={handleLoadMore}
                          disabled={isLoadingMore}
                          className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl font-medium shadow-lg shadow-emerald-200 active:scale-95 transition-all disabled:opacity-50"
                        >
                          {isLoadingMore ? (
                            <span className="flex items-center gap-2">
                              <Loader className="w-4 h-4 animate-spin" /> Chargement...
                            </span>
                          ) : (
                            `Charger plus de missions (${providerMissions.length - displayCount} restantes)`
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'live' && (
                  <div className="space-y-4 md:space-y-6 p-4 md:p-8">
                    <div className="hidden md:block">
                      <h2 className="text-2xl font-bold text-gray-800">Appel Vidéo</h2>
                      <p className="text-sm text-gray-500">Communiquez en direct avec vos clients</p>
                    </div>
                    
                    {showVideoCall && activeStream ? (
                      <VideoCallManagerImproved sessionId={activeStream.id} isInitiator={true} onEnd={endVideoCall} />
                    ) : (
                      <div className="bg-white/90 backdrop-blur-xl rounded-3xl border border-white/50 shadow-lg p-6 md:p-8">
                        <div className="text-center mb-6">
                          <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-red-400 to-rose-500 rounded-full flex items-center justify-center shadow-lg shadow-red-200">
                            <Video className="w-10 h-10 text-white" />
                          </div>
                          <h3 className="text-xl font-bold text-gray-800 mb-2">Appel Vidéo</h3>
                          <p className="text-gray-500 text-sm">Sélectionnez une mission active pour démarrer</p>
                        </div>
                        
                        {streamError && (
                          <div className="bg-red-50 border border-red-200 text-red-600 p-4 rounded-xl mb-4">
                            <p className="text-sm font-medium">{streamError}</p>
                          </div>
                        )}
                        
                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">Mission Active</label>
                            <select 
                              className="w-full bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition"
                              value={selectedMissionForCall?.id || ''}
                              onChange={(e) => {
                                const mission = activeMissions.find(m => m.id === e.target.value);
                                setSelectedMissionForCall(mission || null);
                              }}
                            >
                              <option value="">Sélectionner une mission...</option>
                              {activeMissions.map(m => (
                                <option key={m.id} value={m.id}>
                                  {m.clientName} - {m.date} ({m.service})
                                </option>
                              ))}
                            </select>
                          </div>
                          
                          {selectedMissionForCall && (
                            <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl">
                              <h4 className="font-bold text-emerald-800 mb-2 flex items-center gap-2">
                                <CheckCircle className="w-4 h-4" /> Détails de l'appel
                              </h4>
                              <div className="space-y-1 text-sm text-emerald-700">
                                <p><span className="font-medium">Client:</span> {selectedMissionForCall.clientName}</p>
                                <p><span className="font-medium">Date:</span> {selectedMissionForCall.date}</p>
                                <p><span className="font-medium">Service:</span> {selectedMissionForCall.service}</p>
                              </div>
                            </div>
                          )}
                          
                          <button
                            onClick={() => selectedMissionForCall && startVideoCall(selectedMissionForCall)}
                            disabled={!selectedMissionForCall}
                            className="w-full bg-gradient-to-r from-red-500 to-rose-600 disabled:from-gray-300 disabled:to-gray-400 text-white font-bold py-4 rounded-xl shadow-lg shadow-red-200 hover:shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2"
                          >
                            <Video className="w-5 h-5" />
                            Démarrer l'Appel
                          </button>
                        </div>
                        
                        {activeMissions.length === 0 && (
                          <div className="text-center py-8 mt-4">
                            <div className="w-16 h-16 mx-auto mb-3 bg-gray-100 rounded-full flex items-center justify-center">
                              <Briefcase className="w-8 h-8 text-gray-400" />
                            </div>
                            <p className="text-gray-500">Aucune mission active disponible</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'scans' && (
                  <div className="space-y-4 md:space-y-6 p-4 md:p-8">
                    <div className="hidden md:block">
                      <h2 className="text-2xl font-bold text-gray-800">Historique des scans</h2>
                      <p className="text-sm text-gray-500">Vos pointages entrée/sortie</p>
                    </div>
                    
                    <div className="md:hidden">
                      <p className="text-xs text-gray-500 uppercase tracking-wide">Historique</p>
                      <h3 className="text-lg font-bold text-gray-800">Mes pointages</h3>
                    </div>

                    {/* Filtres */}
                    <div className="bg-white/90 backdrop-blur-xl rounded-2xl border border-white/50 shadow-lg p-4">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div>
                          <label className="text-xs font-bold text-gray-500 mb-1 block">Date début</label>
                          <input type="date" className="w-full border border-gray-200 rounded-xl p-3 bg-gray-50 text-sm" value={scanFilters.startDate} onChange={(e) => setScanFilters(prev => ({ ...prev, startDate: e.target.value }))} />
                        </div>
                        <div>
                          <label className="text-xs font-bold text-gray-500 mb-1 block">Date fin</label>
                          <input type="date" className="w-full border border-gray-200 rounded-xl p-3 bg-gray-50 text-sm" value={scanFilters.endDate} onChange={(e) => setScanFilters(prev => ({ ...prev, endDate: e.target.value }))} />
                        </div>
                        <div className="col-span-2 md:col-span-1">
                          <label className="text-xs font-bold text-gray-500 mb-1 block">Type</label>
                          <select className="w-full border border-gray-200 rounded-xl p-3 bg-gray-50 text-sm" value={scanFilters.type} onChange={(e) => setScanFilters(prev => ({ ...prev, type: e.target.value as any }))}>
                            <option value="">Tous</option>
                            <option value="entry">Entrée</option>
                            <option value="exit">Sortie</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Liste des scans */}
                    <div className="bg-white/90 backdrop-blur-xl rounded-3xl border border-white/50 shadow-lg overflow-hidden">
                      <div className="p-4 border-b border-gray-100 bg-gray-50/50">
                        <h3 className="font-bold text-gray-700 flex items-center gap-2">
                          <ScanLine className="w-4 h-4 text-emerald-500" /> 
                          Détails ({providerScansHistory.length} scan{providerScansHistory.length > 1 ? 's' : ''})
                        </h3>
                      </div>
                      <div className="divide-y divide-gray-100">
                        {providerScansHistory.length === 0 ? (
                          <div className="p-8 text-center text-gray-400">
                            <div className="w-16 h-16 mx-auto mb-3 bg-gray-100 rounded-full flex items-center justify-center">
                              <ScanLine className="w-8 h-8 text-gray-300" />
                            </div>
                            <p className="font-medium">Aucun scan enregistré</p>
                          </div>
                        ) : (
                          providerScansHistory.map((scan: any) => (
                            <div key={scan.id} className="p-4 hover:bg-gray-50 transition">
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex items-center gap-3">
                                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${scan.scanType === 'entry' ? 'bg-emerald-100 text-emerald-600' : 'bg-orange-100 text-orange-600'}`}>
                                    {scan.scanType === 'entry' ? <CheckCircle className="w-5 h-5" /> : <LogOut className="w-5 h-5" />}
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-2 mb-0.5">
                                      <span className="font-bold text-gray-800">{scan.clientName}</span>
                                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${scan.scanType === 'entry' ? 'bg-emerald-100 text-emerald-600' : 'bg-orange-100 text-orange-600'}`}>
                                        {scan.scanType === 'entry' ? 'Entrée' : 'Sortie'}
                                      </span>
                                    </div>
                                    <div className="text-xs text-gray-500">{new Date(scan.timestamp).toLocaleString('fr-FR')}</div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'leaves' && (
                  <div className="max-w-2xl mx-auto p-4 md:p-8 space-y-4">
                    <div className="hidden md:block mb-6">
                      <h2 className="text-2xl font-bold text-gray-800">Congés & Absences</h2>
                      <p className="text-sm text-gray-500">Gérez vos demandes de congés</p>
                    </div>
                    
                    <div className="md:hidden mb-4">
                      <p className="text-xs text-gray-500 uppercase tracking-wide">Gestion</p>
                      <h3 className="text-lg font-bold text-gray-800">Mes absences</h3>
                    </div>

                    {/* Formulaire congés */}
                    <div className="bg-white/90 backdrop-blur-xl rounded-3xl border border-white/50 shadow-lg p-5 md:p-6">
                      <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                        <CalendarX className="w-5 h-5 text-emerald-500" />
                        Nouvelle demande
                      </h3>
                      <form onSubmit={handleSubmitLeave} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-xs font-bold text-gray-500 mb-1 block">Date Début</label>
                            <input type="date" className="w-full border border-gray-200 rounded-xl p-3 bg-gray-50 text-sm" value={leaveForm.start} onChange={e => setLeaveForm({...leaveForm, start: e.target.value})} required />
                          </div>
                          <div>
                            <label className="text-xs font-bold text-gray-500 mb-1 block">Heure Début</label>
                            <input type="time" className="w-full border border-gray-200 rounded-xl p-3 bg-gray-50 text-sm" value={leaveForm.startTime} onChange={e => setLeaveForm({...leaveForm, startTime: e.target.value})} required />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-xs font-bold text-gray-500 mb-1 block">Date Fin</label>
                            <input type="date" className="w-full border border-gray-200 rounded-xl p-3 bg-gray-50 text-sm" value={leaveForm.end} onChange={e => setLeaveForm({...leaveForm, end: e.target.value})} required />
                          </div>
                          <div>
                            <label className="text-xs font-bold text-gray-500 mb-1 block">Heure Fin</label>
                            <input type="time" className="w-full border border-gray-200 rounded-xl p-3 bg-gray-50 text-sm" value={leaveForm.endTime} onChange={e => setLeaveForm({...leaveForm, endTime: e.target.value})} required />
                          </div>
                        </div>
                        <button type="submit" className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold py-4 rounded-xl shadow-lg shadow-emerald-200 hover:shadow-xl transition-all active:scale-95">
                          Envoyer la demande
                        </button>
                      </form>
                    </div>

                    {/* Historique */}
                    <div className="bg-white/90 backdrop-blur-xl rounded-3xl border border-white/50 shadow-lg p-5 md:p-6">
                      <h4 className="font-bold text-gray-700 mb-4 flex items-center gap-2">
                        <History className="w-4 h-4 text-emerald-500" /> 
                        Historique
                      </h4>
                      {provider.leaves.length === 0 ? (
                        <div className="text-center py-6">
                          <div className="w-14 h-14 mx-auto mb-3 bg-gray-100 rounded-full flex items-center justify-center">
                            <CalendarX className="w-7 h-7 text-gray-300" />
                          </div>
                          <p className="text-gray-400 text-sm">Aucune absence enregistrée</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {provider.leaves.map(l => (
                            <div key={l.id} className="flex justify-between items-center bg-gray-50 p-4 rounded-xl border border-gray-100">
                              <div className="flex items-center gap-3">
                                <div className={`w-3 h-3 rounded-full ${l.status === 'approved' ? 'bg-emerald-500' : l.status === 'rejected' ? 'bg-red-500' : 'bg-amber-400'}`}></div>
                                <div className="text-sm">
                                  <div className="font-bold text-gray-800">{l.startDate} - {l.endDate}</div>
                                  <div className="text-gray-400 text-xs">{l.startTime?.slice(0,5)} à {l.endTime?.slice(0,5)}</div>
                                </div>
                              </div>
                              <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${l.status === 'approved' ? 'bg-emerald-100 text-emerald-600' : l.status === 'rejected' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'}`}>
                                {l.status === 'approved' ? 'Validé' : l.status === 'rejected' ? 'Refusé' : 'En attente'}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {activeTab === 'archive' && (
                  <div className="space-y-4 md:space-y-6 p-4 md:p-8">
                    <div className="hidden md:block mb-6">
                      <h2 className="text-2xl font-bold text-gray-800">Archives</h2>
                      <p className="text-sm text-gray-500">Missions terminées et annulées</p>
                    </div>
                    
                    <div className="md:hidden mb-4">
                      <p className="text-xs text-gray-500 uppercase tracking-wide">Historique</p>
                      <h3 className="text-lg font-bold text-gray-800">Missions archivées</h3>
                    </div>

                    {/* Filtres des archives */}
                    <div className="bg-white/90 backdrop-blur-xl rounded-2xl border border-white/50 shadow-lg p-4">
                      <div className="flex items-center gap-2 bg-gray-100 rounded-xl p-1">
                        <button 
                          onClick={() => setMissionFilter('completed')}
                          className={`flex-1 px-4 py-2 rounded-lg text-sm font-bold transition ${missionFilter === 'completed' ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                          Terminées
                        </button>
                        <button 
                          onClick={() => setMissionFilter('cancelled')}
                          className={`flex-1 px-4 py-2 rounded-lg text-sm font-bold transition ${missionFilter === 'cancelled' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                          Annulées
                        </button>
                      </div>
                    </div>

                    {/* Liste des missions archivées */}
                    <div className="space-y-4">
                      {providerMissions
                        .filter(m => m.status === missionFilter && (missionFilter === 'completed' || missionFilter === 'cancelled'))
                        .length === 0 ? (
                        <div className="bg-white/80 backdrop-blur-xl p-8 rounded-3xl text-center border border-white/50 shadow-lg">
                          <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center">
                            <History className="w-10 h-10 text-gray-400" />
                          </div>
                          <p className="text-gray-500 font-medium">
                            {missionFilter === 'completed' ? 'Aucune mission terminée' : 'Aucune mission annulée'}
                          </p>
                          <p className="text-sm text-gray-400 mt-1">
                            Les missions {missionFilter === 'completed' ? 'terminées' : 'annulées'} apparaîtront ici
                          </p>
                        </div>
                      ) : (
                        providerMissions
                          .filter(m => m.status === missionFilter && (missionFilter === 'completed' || missionFilter === 'cancelled'))
                          .map((m) => {
                            const clientById = clients.find(c => String(c.id) === String(m.clientId || ''));
                            const normalizedMissionClientName = String(m.clientName || '').trim().toLowerCase();
                            const clientByName = !clientById && normalizedMissionClientName
                              ? clients.find(c => String(c.name || '').trim().toLowerCase() === normalizedMissionClientName)
                              : undefined;
                            const client = clientById || clientByName;

                            const statusConfig = {
                              completed: { bg: 'from-emerald-400 to-teal-500', text: 'text-emerald-700', bgSoft: 'bg-emerald-50', border: 'border-emerald-100', label: 'Terminée' },
                              cancelled: { bg: 'from-red-400 to-rose-500', text: 'text-red-700', bgSoft: 'bg-red-50', border: 'border-red-100', label: 'Annulée' }
                            };
                            const status = statusConfig[m.status as keyof typeof statusConfig] || statusConfig.completed;

                            return (
                              <div key={m.id} className={`bg-white rounded-2xl p-4 border ${status.border} shadow-sm hover:shadow-md transition`}>
                                <div className="flex items-start justify-between mb-3">
                                  <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${status.bg} flex items-center justify-center shadow-md`}>
                                      <CheckCircle className="w-5 h-5 text-white" />
                                    </div>
                                    <div>
                                      <h4 className="font-bold text-gray-800">{m.service}</h4>
                                      <p className="text-sm text-gray-500">{m.clientName}</p>
                                    </div>
                                  </div>
                                  <span className={`px-2 py-1 rounded-full text-xs font-bold bg-gradient-to-r ${status.bg} text-white`}>
                                    {status.label}
                                  </span>
                                </div>
                                
                                <div className="flex items-center gap-4 text-sm text-gray-500 mb-3">
                                  <div className="flex items-center gap-1.5">
                                    <Calendar className="w-4 h-4 text-gray-400" />
                                    <span>{dayjs(m.date).format('dddd D MMMM YYYY')}</span>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <Clock className="w-4 h-4 text-gray-400" />
                                    <span>{m.startTime} - {m.endTime}</span>
                                  </div>
                                </div>

                                {client?.city && (
                                  <div className="flex items-center gap-1.5 text-sm text-gray-500 mb-3">
                                    <MapPin className="w-4 h-4 text-gray-400" />
                                    <span>{client.city}</span>
                                  </div>
                                )}

                                <button 
                                  onClick={() => setMissionDetailsModal(m)}
                                  className="w-full bg-gray-100 text-gray-700 py-2 rounded-xl text-sm font-bold hover:bg-gray-200 transition"
                                >
                                  Voir détails
                                </button>
                              </div>
                            );
                          })
                      )}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </main>
      </div>

      {/* Mobile Bottom Nav - Design moderne avec 5 icônes */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-xl border-t border-white/50 flex justify-around items-center p-3 pb-safe z-30 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
        <button onClick={() => setActiveTab('dashboard')} className={`flex flex-col items-center p-2 rounded-xl transition-all ${activeTab === 'dashboard' ? 'text-emerald-600 bg-emerald-50' : 'text-gray-400 hover:text-gray-600'}`}>
          <div className={`p-2 rounded-xl transition-all ${activeTab === 'dashboard' ? 'bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-200' : ''}`}>
            <Home className={`w-5 h-5 ${activeTab === 'dashboard' ? 'text-white' : ''}`} />
          </div>
          <span className="text-[10px] font-bold mt-1">Accueil</span>
        </button>
        
        <button onClick={() => setActiveTab('archive')} className={`flex flex-col items-center p-2 rounded-xl transition-all ${activeTab === 'archive' ? 'text-emerald-600 bg-emerald-50' : 'text-gray-400 hover:text-gray-600'}`}>
          <div className={`p-2 rounded-xl transition-all ${activeTab === 'archive' ? 'bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-200' : ''}`}>
            <CheckCircle className={`w-5 h-5 ${activeTab === 'archive' ? 'text-white' : ''}`} />
          </div>
          <span className="text-[10px] font-bold mt-1">Archives</span>
        </button>
        
        <button onClick={() => setActiveTab('live')} className={`flex flex-col items-center p-2 rounded-xl transition-all ${activeTab === 'live' ? 'text-red-500 bg-red-50' : 'text-gray-400 hover:text-gray-600'}`}>
          <div className={`p-2 rounded-xl transition-all ${activeTab === 'live' ? 'bg-gradient-to-br from-red-500 to-rose-600 shadow-lg shadow-red-200' : ''}`}>
            <Video className={`w-5 h-5 ${activeTab === 'live' ? 'text-white' : ''}`} />
          </div>
          <span className="text-[10px] font-bold mt-1">Live</span>
        </button>
        
        <button onClick={() => setActiveTab('scans')} className={`flex flex-col items-center p-2 rounded-xl transition-all ${activeTab === 'scans' ? 'text-emerald-600 bg-emerald-50' : 'text-gray-400 hover:text-gray-600'}`}>
          <div className={`p-2 rounded-xl transition-all ${activeTab === 'scans' ? 'bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-200' : ''}`}>
            <ScanLine className={`w-5 h-5 ${activeTab === 'scans' ? 'text-white' : ''}`} />
          </div>
          <span className="text-[10px] font-bold mt-1">Scans</span>
        </button>
        
        <button onClick={() => setActiveTab('leaves')} className={`flex flex-col items-center p-2 rounded-xl transition-all ${activeTab === 'leaves' ? 'text-emerald-600 bg-emerald-50' : 'text-gray-400 hover:text-gray-600'}`}>
          <div className={`p-2 rounded-xl transition-all ${activeTab === 'leaves' ? 'bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-200' : ''}`}>
            <User className={`w-5 h-5 ${activeTab === 'leaves' ? 'text-white' : ''}`} />
          </div>
          <span className="text-[10px] font-bold mt-1">Profil</span>
        </button>
      </div>

      {/* Day Missions Popup Modal */}
      {selectedDayMissions && selectedDayMissions.length > 0 && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-gray-900/60 backdrop-blur-sm p-4">
          <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col animate-in fade-in zoom-in duration-200 border border-white/50">
            <div className="bg-gradient-to-r from-emerald-50 to-teal-50 p-4 border-b border-gray-100 flex justify-between items-center rounded-t-3xl shrink-0">
              <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-emerald-500" />
                Missions du {dayjs(selectedDayMissions[0].date).format('dddd D MMMM')}
              </h3>
              <button 
                onClick={() => setSelectedDayMissions(null)} 
                className="p-2 rounded-full hover:bg-gray-200 transition"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {selectedDayMissions.map((m) => {
                const clientById = clients.find(c => String(c.id) === String(m.clientId || ''));
                const normalizedMissionClientName = String(m.clientName || '').trim().toLowerCase();
                const clientByName = !clientById && normalizedMissionClientName
                  ? clients.find(c => String(c.name || '').trim().toLowerCase() === normalizedMissionClientName)
                  : undefined;
                const client = clientById || clientByName;

                const statusConfig = {
                  planned: { bg: 'from-amber-400 to-orange-500', text: 'Planifiée', icon: Clock },
                  in_progress: { bg: 'from-blue-400 to-indigo-500', text: 'En cours', icon: Wifi },
                  completed: { bg: 'from-emerald-400 to-teal-500', text: 'Terminée', icon: CheckCircle },
                  cancelled: { bg: 'from-red-400 to-rose-500', text: 'Annulée', icon: X }
                };
                const status = statusConfig[m.status as keyof typeof statusConfig] || statusConfig.planned;

                return (
                  <div key={m.id} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm hover:shadow-md transition">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${status.bg} flex items-center justify-center shadow-md`}>
                          <status.icon className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <h4 className="font-bold text-gray-800">{m.service}</h4>
                          <p className="text-sm text-gray-500">{m.clientName}</p>
                        </div>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs font-bold bg-gradient-to-r ${status.bg} text-white`}>
                        {status.text}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-4 text-sm text-gray-500 mb-3">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-emerald-500" />
                        <span>{m.startTime} - {m.endTime}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-4 h-4 text-emerald-500" />
                        <span className="truncate max-w-[150px]">{client?.city || 'Non renseigné'}</span>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button 
                        onClick={() => {
                          setSelectedDayMissions(null);
                          setMissionDetailsModal(m);
                        }}
                        className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-xl text-sm font-bold hover:bg-gray-200 transition"
                      >
                        Voir détails
                      </button>
                      {m.status === 'planned' && (
                        <button 
                          onClick={() => {
                            setSelectedDayMissions(null);
                            openExecutionModal(m.id, 'start');
                          }}
                          className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-600 text-white py-2 rounded-xl text-sm font-bold shadow-md hover:shadow-lg transition"
                        >
                          Démarrer
                        </button>
                      )}
                      {m.status === 'in_progress' && (
                        <button 
                          onClick={() => {
                            setSelectedDayMissions(null);
                            openExecutionModal(m.id, 'end');
                          }}
                          className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-600 text-white py-2 rounded-xl text-sm font-bold shadow-md hover:shadow-lg transition"
                        >
                          Terminer
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Mission Details Popup Modal */}
      {missionDetailsModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-gray-900/60 backdrop-blur-sm p-4">
          <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col animate-in fade-in zoom-in duration-200 border border-white/50">
            {(() => {
              const m = missionDetailsModal;
              const clientById = clients.find(c => String(c.id) === String(m.clientId || ''));
              const normalizedMissionClientName = String(m.clientName || '').trim().toLowerCase();
              const clientByName = !clientById && normalizedMissionClientName
                ? clients.find(c => String(c.name || '').trim().toLowerCase() === normalizedMissionClientName)
                : undefined;
              const client = clientById || clientByName;

              const statusConfig = {
                planned: { bg: 'from-amber-400 to-orange-500', text: 'Planifiée', icon: Clock },
                in_progress: { bg: 'from-blue-400 to-indigo-500', text: 'En cours', icon: Wifi },
                completed: { bg: 'from-emerald-400 to-teal-500', text: 'Terminée', icon: CheckCircle },
                cancelled: { bg: 'from-red-400 to-rose-500', text: 'Annulée', icon: X }
              };
              const status = statusConfig[m.status as keyof typeof statusConfig] || statusConfig.planned;

              return (
                <>
                  <div className="bg-gradient-to-r from-gray-50 to-gray-100 p-4 border-b border-gray-100 flex justify-between items-center rounded-t-3xl shrink-0">
                    <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2">
                      <Briefcase className="w-5 h-5 text-emerald-500" />
                      Détails de la mission
                    </h3>
                    <button 
                      onClick={() => setMissionDetailsModal(null)} 
                      className="p-2 rounded-full hover:bg-gray-200 transition"
                    >
                      <X className="w-5 h-5 text-gray-500" />
                    </button>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    {/* Mission Header */}
                    <div className="flex items-center gap-4">
                      <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${status.bg} flex items-center justify-center shadow-lg`}>
                        <status.icon className="w-8 h-8 text-white" />
                      </div>
                      <div>
                        <h2 className="font-bold text-xl text-gray-800">{m.service}</h2>
                        <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold bg-gradient-to-r ${status.bg} text-white mt-1`}>
                          {status.text}
                        </span>
                      </div>
                    </div>

                    {/* Mission Info */}
                    <div className="bg-gray-50 rounded-2xl p-4 space-y-3">
                      <div className="flex items-center gap-3">
                        <Calendar className="w-5 h-5 text-emerald-500" />
                        <div>
                          <p className="text-xs text-gray-500">Date</p>
                          <p className="font-bold text-gray-700">{dayjs(m.date).format('dddd D MMMM YYYY')}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Clock className="w-5 h-5 text-emerald-500" />
                        <div>
                          <p className="text-xs text-gray-500">Horaire</p>
                          <p className="font-bold text-gray-700">{m.startTime} - {m.endTime}</p>
                        </div>
                      </div>
                    </div>

                    {/* Client Info */}
                    <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-100">
                      <h4 className="font-bold text-emerald-800 mb-3 flex items-center gap-2">
                        <User className="w-4 h-4" /> Informations client
                      </h4>
                      <div className="space-y-2 text-sm">
                        <p><span className="font-medium text-gray-600">Nom:</span> <span className="text-gray-800">{m.clientName}</span></p>
                        <p><span className="font-medium text-gray-600">Adresse:</span> <span className="text-gray-800">{client?.address || 'Non renseignée'}{client?.city ? `, ${client.city}` : ''}</span></p>
                        <p><span className="font-medium text-gray-600">Téléphone:</span> <span className="text-gray-800">{client?.phone || 'Non renseigné'}</span></p>
                        <p><span className="font-medium text-gray-600">Email:</span> <span className="text-gray-800">{client?.email || 'Non renseigné'}</span></p>
                        <p><span className="font-medium text-gray-600">Pack:</span> <span className="text-gray-800">{client?.pack || 'Non renseigné'}</span></p>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="p-4 border-t border-gray-100 bg-gray-50 rounded-b-3xl shrink-0">
                    <div className="flex gap-3">
                      {m.status === 'planned' && (
                        <>
                          <button 
                            onClick={() => {
                              setMissionDetailsModal(null);
                              openExecutionModal(m.id, 'start');
                            }}
                            className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-600 text-white py-3 rounded-xl font-bold shadow-lg shadow-emerald-200 hover:shadow-xl transition"
                          >
                            Démarrer la mission
                          </button>
                          <button 
                            onClick={() => {
                              setMissionDetailsModal(null);
                              openExecutionModal(m.id, 'cancel');
                            }}
                            className="px-4 py-3 bg-gray-200 text-gray-600 rounded-xl hover:bg-gray-300 transition"
                          >
                            <X className="w-5 h-5" />
                          </button>
                        </>
                      )}
                      {m.status === 'in_progress' && (
                        <>
                          <button 
                            onClick={() => {
                              setMissionDetailsModal(null);
                              openExecutionModal(m.id, 'end');
                            }}
                            className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-600 text-white py-3 rounded-xl font-bold shadow-lg shadow-emerald-200 hover:shadow-xl transition"
                          >
                            Terminer la mission
                          </button>
                          <button 
                            onClick={() => {
                              setMissionDetailsModal(null);
                              openExecutionModal(m.id, 'cancel');
                            }}
                            className="px-4 py-3 bg-amber-100 text-amber-600 rounded-xl hover:bg-amber-200 transition"
                          >
                            <AlertTriangle className="w-5 h-5" />
                          </button>
                        </>
                      )}
                      {(m.status === 'completed' || m.status === 'cancelled') && (
                        <button 
                          onClick={() => setMissionDetailsModal(null)}
                          className="w-full bg-gray-200 text-gray-700 py-3 rounded-xl font-bold hover:bg-gray-300 transition"
                        >
                          Fermer
                        </button>
                      )}
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
      {showAllNotifsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 backdrop-blur-sm p-4">
          <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl w-full max-w-lg h-[80vh] flex flex-col animate-in fade-in zoom-in duration-200 border border-white/50">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center shrink-0 bg-gradient-to-r from-emerald-50 to-teal-50">
              <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2">
                <Bell className="w-5 h-5 text-emerald-500" /> Notifications
              </h3>
              <button onClick={() => setShowAllNotifsModal(false)} className="p-2 rounded-full hover:bg-gray-100 transition">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-0">
              {allProviderNotifs.length === 0 ? (
                <div className="p-8 text-center text-gray-400 flex flex-col items-center">
                  <div className="w-16 h-16 mx-auto mb-3 bg-gray-100 rounded-full flex items-center justify-center">
                    <Bell className="w-8 h-8 text-gray-300" />
                  </div>
                  <p>Aucune notification</p>
                </div>
              ) : (
                allProviderNotifs.map(n => (
                  <div key={n.id} onClick={() => handleNotificationClick(n)} className={`p-4 border-b border-gray-50 hover:bg-emerald-50 cursor-pointer transition flex items-start gap-3 ${!n.read ? 'bg-emerald-50/30' : ''}`}>
                    <div className={`p-2 rounded-xl shrink-0 ${n.type === 'alert' ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'}`}>
                      <Bell className="w-4 h-4" />
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-bold text-gray-800 text-sm">{n.title}</span>
                        <span className="text-xs text-gray-400 whitespace-nowrap ml-2">{new Date(n.date).toLocaleDateString()}</span>
                      </div>
                      <p className="text-sm text-gray-600">{n.message}</p>
                    </div>
                    {!n.read && <div className="w-2 h-2 rounded-full bg-emerald-500 mt-2"></div>}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Execution Modal */}
      {selectedMissionId && executionStep && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-gray-900/60 backdrop-blur-sm md:p-4">
          <div className="bg-white/95 backdrop-blur-xl md:rounded-3xl shadow-2xl w-full md:max-w-4xl h-full md:h-auto md:max-h-[90vh] flex flex-col animate-in fade-in zoom-in duration-200 border border-white/50">
            <div className="bg-gradient-to-r from-gray-50 to-gray-100 p-4 border-b border-gray-100 flex justify-between items-center md:rounded-t-3xl shrink-0">
              <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2">
                {executionStep === 'start' && <Camera className="w-5 h-5 text-emerald-500" />}
                {executionStep === 'end' && <CheckCircle className="w-5 h-5 text-emerald-500" />}
                {executionStep === 'cancel' && <AlertTriangle className="w-5 h-5 text-red-500" />}
                {executionStep === 'start' ? 'Début de chantier' : executionStep === 'end' ? 'Fin de chantier' : 'Annulation'}
              </h3>
              <button onClick={() => setSelectedMissionId(null)} className="p-2 rounded-full hover:bg-gray-200 transition">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            
            <div className="flex-1 p-6 overflow-y-auto space-y-6">
              {executionStep !== 'cancel' ? (
                <>
                  {/* PHOTOS SECTION */}
                  <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                    <div className="flex justify-between items-center mb-4">
                      <label className="font-bold text-gray-700 flex items-center gap-2 text-lg">
                        <Camera className="w-5 h-5 text-emerald-500" /> Photos
                      </label>
                      <span className={`text-sm font-bold px-3 py-1.5 rounded-full ${photos.length > 0 && !video ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-100 text-gray-500'}`}>
                        {photos.length}/10
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                      {photos.map((url, i) => (
                        <div key={i} className="aspect-square bg-gray-100 rounded-xl overflow-hidden relative border border-gray-200 group">
                          <img src={url} alt={`Preuve ${i}`} className="w-full h-full object-cover" />
                          <button 
                            onClick={() => removePhoto(i)}
                            className="absolute top-1 right-1 bg-red-500 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                      <button 
                        onClick={handlePhotoClick}
                        className="aspect-square bg-gray-50 rounded-xl flex flex-col items-center justify-center border-2 border-dashed border-gray-300 text-gray-400 hover:bg-emerald-50 transition hover:border-emerald-400 hover:text-emerald-500 gap-1"
                      >
                        <UploadCloud className="w-8 h-8" />
                        <span className="text-xs font-bold">Ajouter</span>
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-3 bg-gray-50 p-2 rounded-lg">
                      <span className="font-bold text-emerald-600">Option 1:</span> 5 photos minimum (obligatoire si pas de vidéo)
                    </p>
                  </div>

                  {/* VIDEO SECTION */}
                  <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                    <label className="font-bold text-gray-700 flex items-center gap-2 mb-4 text-lg">
                      <Video className="w-5 h-5 text-amber-500" /> Vidéo
                    </label>
                    
                    {video ? (
                      <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200 text-emerald-700 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 bg-emerald-200 rounded-full flex items-center justify-center">
                            <CheckCircle className="w-6 h-6 text-emerald-700" /> 
                          </div>
                          <div>
                            <p className="font-bold text-sm">Vidéo ajoutée avec succès</p>
                            <p className="text-xs opacity-80">Prête à l'envoi</p>
                          </div>
                        </div>
                        <button onClick={removeVideo} className="text-red-500 hover:text-red-700 p-2 hover:bg-red-50 rounded-lg transition">
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <button onClick={handleVideoClick} className="py-8 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 font-bold flex flex-col items-center justify-center gap-2 hover:bg-emerald-50 hover:border-emerald-400 hover:text-emerald-500 transition group bg-gray-50">
                          <FileVideo className="w-8 h-8 group-hover:scale-110 transition-transform" />
                          <span>Uploader une vidéo</span>
                          <span className="text-xs font-normal opacity-70">MP4, MOV (Max 100Mo)</span>
                        </button>
                        
                        {!showVideoLinkInput ? (
                          <button onClick={() => setShowVideoLinkInput(true)} className="py-8 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 font-bold flex flex-col items-center justify-center gap-2 hover:bg-amber-50 hover:border-amber-400 hover:text-amber-500 transition group bg-gray-50">
                            <LinkIcon className="w-8 h-8 group-hover:scale-110 transition-transform" />
                            <span>Ajouter un lien</span>
                            <span className="text-xs font-normal opacity-70">YouTube, Vimeo, Drive...</span>
                          </button>
                        ) : (
                          <div className="flex flex-col justify-center gap-2 p-4 border border-gray-200 rounded-xl bg-gray-50">
                            <input 
                              type="text" 
                              className="w-full p-3 border border-gray-200 rounded-lg bg-white text-sm"
                              placeholder="https://..."
                              value={videoLinkInput}
                              onChange={e => setVideoLinkInput(e.target.value)}
                            />
                            <div className="flex gap-2">
                              <button onClick={handleAddVideoLink} className="flex-1 bg-gradient-to-r from-amber-500 to-orange-500 text-white py-2 rounded-lg text-sm font-bold hover:shadow-lg transition">Valider</button>
                              <button onClick={() => setShowVideoLinkInput(false)} className="px-4 py-2 text-gray-500 text-sm hover:bg-gray-100 rounded-lg transition">Annuler</button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    <p className="text-xs text-gray-500 mt-3 bg-gray-50 p-2 rounded-lg">
                      <span className="font-bold text-amber-600">Option 2:</span> 1 vidéo (obligatoire si pas de photos)
                    </p>
                  </div>

                  {/* REMARK SECTION */}
                  <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                    <label className="font-bold text-gray-700 flex items-center gap-2 mb-3 text-lg">
                      <MessageSquare className="w-5 h-5 text-gray-400" /> Remarque (Facultatif)
                    </label>
                    <textarea 
                      className="w-full border border-gray-200 rounded-xl p-4 h-32 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 transition bg-gray-50 resize-none"
                      placeholder="Observation particulière, problème rencontré, matériel manquant..."
                      value={remark}
                      onChange={(e) => setRemark(e.target.value)}
                    ></textarea>
                  </div>
                </>
              ) : (
                <div>
                  <div className="bg-red-50 p-6 rounded-2xl border border-red-100 mb-6">
                    <h4 className="font-bold text-red-800 flex items-center gap-2 mb-2 text-lg">
                      <AlertTriangle className="w-6 h-6 text-red-500" /> Attention
                    </h4>
                    <p className="text-sm text-red-600">
                      L'annulation d'une mission planifiée pénalise le client et impacte votre score de fiabilité. 
                      Le secrétariat sera immédiatement notifié pour gérer le remplacement.
                    </p>
                  </div>
                  <label className="font-bold text-gray-700 mb-2 block text-lg">
                    Motif de l'annulation <span className="text-red-500">*</span>
                  </label>
                  <textarea 
                    className="w-full border border-gray-200 rounded-xl p-4 h-40 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100 transition text-gray-700 bg-gray-50 resize-none"
                    placeholder="Ex: Panne de véhicule, Maladie, Cas de force majeure..."
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                  ></textarea>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-gray-100 bg-gray-50 md:rounded-b-3xl shrink-0">
              <button 
                onClick={handleSubmitExecution}
                disabled={isSubmittingExecution}
                className={`w-full py-4 rounded-xl text-white font-bold text-lg shadow-lg transition transform active:scale-95 flex items-center justify-center gap-2 ${
                  executionStep === 'cancel' 
                    ? 'bg-gradient-to-r from-red-500 to-rose-600 shadow-red-200 hover:shadow-xl' 
                    : 'bg-gradient-to-r from-emerald-500 to-teal-600 shadow-emerald-200 hover:shadow-xl'
                } ${isSubmittingExecution ? 'opacity-70 cursor-not-allowed' : ''}`}
              >
                {isSubmittingExecution ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Envoi en cours...</span>
                  </>
                ) : (
                  <>
                    {executionStep === 'start' && <><Camera className="w-5 h-5" /> Démarrer la mission</>}
                    {executionStep === 'end' && <><CheckCircle className="w-5 h-5" /> Terminer et Envoyer</>}
                    {executionStep === 'cancel' && <><X className="w-5 h-5" /> Confirmer Annulation</>}
                  </>
                )}
              </button>
              
              {/* Progress bar for upload - visible when submitting */}
              {isSubmittingExecution && activeUploadJob && (
                <div className="mt-4 px-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-gray-700">
                      Upload en cours: {activeUploadJob.progress}%
                    </span>
                    <span className="text-xs text-gray-500">
                      {activeUploadJob.completedItems} / {activeUploadJob.totalItems} fichiers
                    </span>
                  </div>
                  <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-400 to-teal-500 rounded-full transition-all duration-300 ease-out"
                      style={{ width: `${activeUploadJob.progress}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-2 text-center">
                    Ne fermez pas cette page. L'upload se poursuit en arrière-plan.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Media Source Choice Modal */}
      {mediaChoiceModal.show && (
        <div className="fixed inset-0 z-[65] flex items-center justify-center bg-gray-900/60 backdrop-blur-sm p-4">
          <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl w-full max-w-sm animate-in fade-in zoom-in duration-200 border border-white/50 overflow-hidden">
            <div className="bg-gradient-to-r from-emerald-50 to-teal-50 p-5 border-b border-gray-100">
              <h3 className="font-bold text-gray-800 text-center text-lg">
                {mediaChoiceModal.type === 'photo' ? 'Ajouter des photos' : 'Ajouter une vidéo'}
              </h3>
              <p className="text-sm text-gray-600 text-center mt-1">
                Choisissez la source
              </p>
            </div>
            
            <div className="p-6 space-y-3">
              {/* Camera Option */}
              <button
                onClick={() => mediaChoiceModal.type === 'photo' ? handlePhotoSourceChoice('camera') : handleVideoSourceChoice('camera')}
                className="w-full py-4 px-4 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl font-semibold flex items-center justify-center gap-3 hover:shadow-lg transition transform active:scale-95"
              >
                <Camera className="w-6 h-6" />
                <span>{mediaChoiceModal.type === 'photo' ? 'Prendre une photo' : 'Filmer une vidéo'}</span>
              </button>
              
              {/* Gallery Option */}
              <button
                onClick={() => mediaChoiceModal.type === 'photo' ? handlePhotoSourceChoice('gallery') : handleVideoSourceChoice('gallery')}
                className="w-full py-4 px-4 bg-gray-100 text-gray-700 rounded-xl font-semibold flex items-center justify-center gap-3 hover:bg-gray-200 transition transform active:scale-95 border-2 border-gray-200"
              >
                <Upload className="w-6 h-6" />
                <span>{mediaChoiceModal.type === 'photo' ? 'Choisir depuis la galerie' : 'Choisir depuis la galerie'}</span>
              </button>
              
              {/* Cancel */}
              <button
                onClick={() => setMediaChoiceModal({ show: false, type: null })}
                className="w-full py-3 text-gray-500 font-medium hover:text-gray-700 transition"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Toast */}
      {toast.show && (
        <div className={`fixed bottom-24 left-1/2 transform -translate-x-1/2 px-6 py-3 rounded-full text-sm font-bold shadow-2xl z-[70] flex items-center gap-2 animate-in fade-in slide-in-from-bottom-4 ${
          toast.type === 'error' ? 'bg-gradient-to-r from-red-500 to-rose-600 text-white' :
          toast.type === 'warning' ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white' :
          'bg-gradient-to-r from-emerald-500 to-teal-600 text-white'
        }`}>
          {toast.type === 'error' ? <AlertTriangle className="w-4 h-4" /> :
           toast.type === 'warning' ? <AlertTriangle className="w-4 h-4" /> :
           <CheckCircle className="w-4 h-4" />}
          {toast.message}
        </div>
      )}

      {/* Modal Mobile pour les notifications Provider */}
      {showMobileNotifModal && (
        <div className="md:hidden fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white/95 backdrop-blur-xl w-full max-h-[80vh] rounded-t-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-300 border border-white/50">
            <div className="bg-gradient-to-r from-emerald-50 to-teal-50 px-4 py-3 border-b border-gray-100 flex justify-between items-center">
              <h3 className="font-bold text-gray-700 flex items-center gap-2">
                <Bell className="w-5 h-5 text-emerald-500" /> Notifications
              </h3>
              <button 
                onClick={() => setShowMobileNotifModal(false)}
                className="p-2 rounded-full hover:bg-white transition"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>
            <div className="overflow-y-auto max-h-[60vh] p-4">
              {allProviderNotifs.length === 0 ? (
                <div className="text-center text-gray-400 py-8">
                  <div className="w-14 h-14 mx-auto mb-3 bg-gray-100 rounded-full flex items-center justify-center">
                    <Bell className="w-7 h-7 text-gray-300" />
                  </div>
                  <p>Aucune notification</p>
                </div>
              ) : (
                allProviderNotifs.slice(0, 10).map(n => (
                  <div key={n.id} onClick={() => {
                    handleNotificationClick(n);
                    setShowMobileNotifModal(false);
                  }} className={`p-4 mb-2 rounded-xl border border-gray-100 cursor-pointer hover:bg-emerald-50 transition ${!n.read ? 'bg-emerald-50/50' : 'bg-white'}`}>
                    <span className="font-bold block text-emerald-600 mb-1 truncate text-sm">{n.title}</span>
                    <p className="text-xs text-gray-600 line-clamp-2">{n.message}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Upload Progress Manager - shows upload progress with percentage */}
      <UploadProgressManager
        jobs={uploadJobs}
        activeJob={activeUploadJob}
        isProcessing={isUploadProcessing}
        onRetry={retryUploadJob}
        onRemove={removeUploadJob}
        onClearCompleted={clearCompletedUploadJobs}
      />

    </div>
  );
};

export default ProviderPortal;
