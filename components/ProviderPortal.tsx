import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { Mission } from '../types';
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
  ScanLine
} from 'lucide-react';

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
    startMission,
    endMission,
    cancelMissionByProvider,
    startLiveStream,
    stopLiveStream,
    logout,
    activeStream,
    visitScans
    refreshData,
  } = useData();

  // Pull-to-refresh state
  const [isPulling, setIsPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const pullStartYRef = useRef<number | null>(null);
  const mainScrollRef = useRef<HTMLDivElement>(null);
  const PULL_THRESHOLD = 70;

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

  const provider = providers.find(p => p.id === simulatedProviderId);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'leaves' | 'live' | 'scans'>('dashboard');
  const [toast, setToast] = useState<{ show: boolean; message: string; type?: 'success' | 'error' | 'warning' }>({ show: false, message: '', type: 'success' });
  
  // Mobile menu state
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  const [isReferrer, setIsReferrer] = useState(false);
  const [referralCode, setReferralCode] = useState('');

  useEffect(() => {
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
  const videoInputRef = useRef<HTMLInputElement>(null);
  const [videoLinkInput, setVideoLinkInput] = useState('');
  const [showVideoLinkInput, setShowVideoLinkInput] = useState(false);

  // Data Calculations
  const providerMissions = provider
    ? missions
        .filter(m => matchesServiceTypeFilterFromText(m.service, serviceTypeFilter))
        .filter(m => m.providerId === provider.id)
    : [];
  // All notifications
  const allProviderNotifs = provider ? notifications.filter(n => n.targetUserType === 'provider' && (!n.targetUserId || n.targetUserId === provider.id)) : [];
  const unreadProviderNotifs = allProviderNotifs.filter(n => !n.read);
  const activeMissions = providerMissions.filter(m => m.status === 'in_progress' || m.status === 'planned');

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

  // Early return après tous les hooks
  if (!provider) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-100">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-brand-blue border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-500">Chargement...</p>
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

  const compressImageToDataUrl = async (file: File) => {
    const objectUrl = URL.createObjectURL(file);
    try {
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

      let quality = 0.82;
      let dataUrl = canvas.toDataURL('image/jpeg', quality);
      while (dataUrl.length > 900000 && quality > 0.5) {
        quality = Math.max(0.5, quality - 0.08);
        dataUrl = canvas.toDataURL('image/jpeg', quality);
      }
      return dataUrl;
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
     photoInputRef.current?.click();
  };

  const handlePhotoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
     try {
        if (e.target.files && e.target.files.length > 0) {
            const files = Array.from(e.target.files) as File[];
            const remaining = 10 - photos.length;
            const filesToProcess = files.slice(0, remaining);

            const compressed = await Promise.all(
                filesToProcess.map(async (file) => {
                    try {
                        return await compressImageToDataUrl(file);
                    } catch {
                        return null;
                    }
                })
            );

            const next = compressed.filter((x): x is string => typeof x === 'string' && x.length > 0);
            if (next.length > 0) {
                setPhotos(prev => [...prev, ...next]);
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
      videoInputRef.current?.click();
  };

  const handleVideoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          if (file.size > 100 * 1024 * 1024) { // 100MB Limit simulation
              alert("Fichier trop volumineux (Max 100Mo pour la démo)");
              return;
          }
          // In a real app, upload to server and get URL. Here using Base64 (heavy but works for demo)
          const reader = new FileReader();
          reader.onloadend = () => {
              if (typeof reader.result === 'string') {
                  setVideo(reader.result);
                  setShowVideoLinkInput(false);
              }
          };
          // Explicit cast to Blob to resolve type inference error
          reader.readAsDataURL(file as Blob);
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

      if (executionStep === 'start') {
          if (photos.length < 5) {
              alert('Il faut obligatoirement 5 photos minimum avant chantier.');
              return;
          }
      }
      if (executionStep === 'end') {
          if (photos.length < 5) {
              alert('Il faut obligatoirement 5 photos minimum fin de chantier.');
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
              await startMission(selectedMissionId, remark, photos, video);
              showToast('Mission démarrée. Client notifié.');
              window.location.reload();
              return;
          }
          if (executionStep === 'end') {
              await endMission(selectedMissionId, remark, photos, video);
              showToast('Mission terminée. Rapport envoyé.');
              window.location.reload();
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
    <div className="h-full bg-slate-50 flex flex-col font-sans relative overflow-hidden pb-4 md:pb-0">
       
       {/* Hidden Inputs for Uploads */}
       <input 
          type="file" 
          ref={photoInputRef} 
          className="hidden" 
          accept="image/*" 
          multiple 
          onChange={handlePhotoFileChange}
       />
       <input 
          type="file" 
          ref={videoInputRef} 
          className="hidden" 
          accept="video/*" 
          onChange={handleVideoFileChange}
       />

       {/* Desktop/Tablet Header */}
       <header className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center shadow-sm z-10 shrink-0">
           <div className="flex items-center gap-4">
               {/* Mobile Menu Toggle */}
               <button 
                   onClick={() => setShowMobileMenu(!showMobileMenu)}
                   className="md:hidden p-2 rounded-lg hover:bg-slate-100 transition"
               >
                   <div className="w-6 h-5 flex flex-col justify-center gap-1">
                       <div className={`w-full h-0.5 bg-slate-600 transition-all ${showMobileMenu ? 'rotate-45 translate-y-1.5' : ''}`}></div>
                       <div className={`w-full h-0.5 bg-slate-600 transition-all ${showMobileMenu ? 'opacity-0' : ''}`}></div>
                       <div className={`w-full h-0.5 bg-slate-600 transition-all ${showMobileMenu ? '-rotate-45 -translate-y-1.5' : ''}`}></div>
                   </div>
               </button>
               
               <div className="w-10 h-10 rounded-full bg-brand-blue text-white flex items-center justify-center font-bold text-lg border-2 border-blue-100">
                   {provider.firstName.charAt(0)}{provider.lastName.charAt(0)}
               </div>
               <div>
                   <h1 className="font-bold text-slate-800 text-lg hidden md:block">{provider?.firstName} {provider?.lastName}</h1>
                   <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-700 md:hidden">{provider?.firstName} {provider?.lastName}</span>
                        <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-[10px] font-bold border border-green-200 flex items-center gap-1">
                            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div> En ligne
                        </span>
                   </div>
               </div>
           </div>

           <div className="flex gap-4 items-center">
               {/* Notifications */}
               <div className="relative" ref={notificationRef}>
                   <button 
                    onClick={() => {
                        if (window.innerWidth < 768) {
                            setShowMobileNotifModal(true);
                        } else {
                            setShowNotifDropdown(!showNotifDropdown);
                        }
                    }}
                    className="p-2 rounded-full hover:bg-slate-100 text-slate-500 hover:text-brand-blue transition relative"
                   >
                        <Bell className="w-6 h-6" />
                        {unreadProviderNotifs.length > 0 && <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>}
                   </button>
                   
                   {showNotifDropdown && (
                       <div className="absolute top-full right-0 mt-2 w-72 sm:w-80 md:w-96 bg-white text-slate-800 rounded-xl shadow-xl border border-slate-100 z-[9999] text-sm overflow-hidden md:right-0 md:left-auto left-0 right-0 md:w-80">
                           <div className="bg-slate-50 px-3 sm:px-4 py-2 sm:py-3 border-b border-slate-100 font-bold text-slate-600 text-xs uppercase flex justify-between">
                               <span className="text-xs sm:text-sm">Notifications</span>
                               <span className="text-brand-blue text-xs sm:text-sm">{unreadProviderNotifs.length}</span>
                           </div>
                           <div className="max-h-48 sm:max-h-56 md:max-h-64 overflow-y-auto">
                                {allProviderNotifs.length === 0 && <div className="p-3 sm:p-4 text-center text-slate-400 italic text-xs sm:text-sm">Rien à signaler</div>}
                                {allProviderNotifs.slice(0, 5).map(n => (
                                    <div key={n.id} onClick={() => handleNotificationClick(n)} className={`p-2 sm:p-3 border-b hover:bg-blue-50 cursor-pointer transition ${!n.read ? 'bg-blue-50/50' : ''}`}>
                                        <span className="font-bold block text-brand-blue mb-1 truncate text-xs sm:text-sm">{n.title}</span>
                                        <p className="text-xs text-slate-600 line-clamp-2 break-words">{n.message}</p>
                                    </div>
                                ))}
                           </div>
                           <button 
                               onClick={() => { setShowNotifDropdown(false); setShowAllNotifsModal(true); }}
                               className="w-full py-2 text-center text-xs font-bold text-brand-blue bg-slate-50 hover:bg-slate-100 border-t border-slate-100 transition"
                           >
                               Voir toutes
                           </button>
                       </div>
                   )}
               </div>

               <button 
                onClick={() => { setSimulatedProviderId(null); logout(true); }} 
                className="hidden md:flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-red-500 transition px-3 py-2 rounded-lg hover:bg-red-50"
               >
                   <LogOut className="w-4 h-4" /> <span className="hidden lg:inline">Déconnexion</span>
               </button>
               <button 
                onClick={() => { setSimulatedProviderId(null); logout(true); }} 
                className="md:hidden p-2 text-slate-500"
               >
                   <LogOut className="w-5 h-5" />
               </button>
           </div>
       </header>

       {/* Mobile Menu Overlay */}
       {showMobileMenu && (
           <div className="md:hidden fixed inset-0 z-40 bg-black/50" onClick={() => setShowMobileMenu(false)}>
               <div 
                   ref={mobileMenuRef}
                   className="bg-white w-80 h-full shadow-xl overflow-y-auto"
                   onClick={(e) => e.stopPropagation()}
               >
                   <div className="p-4 border-b border-slate-200">
                       <div className="flex items-center justify-between">
                           <h2 className="font-bold text-lg text-slate-800">Menu prestataire</h2>
                           <button 
                               onClick={() => setShowMobileMenu(false)}
                               className="p-2 rounded-lg hover:bg-slate-100 transition"
                           >
                               <X className="w-5 h-5 text-slate-600" />
                           </button>
                       </div>
                   </div>
                   
                   <nav className="p-4 space-y-2">
                       <button 
                           onClick={() => { setActiveTab('dashboard'); setShowMobileMenu(false); }}
                           className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                               activeTab === 'dashboard' ? 'bg-brand-blue text-white shadow-md' : 'text-slate-600 hover:bg-slate-50'
                           }`}
                       >
                           <Briefcase className="w-4 h-4" /> Missions
                       </button>
                       <button 
                           onClick={() => { setActiveTab('live'); setShowMobileMenu(false); }}
                           className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                               activeTab === 'live' ? 'bg-red-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-50'
                           }`}
                       >
                           <Wifi className="w-4 h-4" /> Live Vidéo
                       </button>
                       <button 
                           onClick={() => { setActiveTab('scans'); setShowMobileMenu(false); }}
                           className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                               activeTab === 'scans' ? 'bg-brand-blue text-white shadow-md' : 'text-slate-600 hover:bg-slate-50'
                           }`}
                       >
                           <ScanLine className="w-4 h-4" /> Mes scans
                       </button>
                       <button 
                           onClick={() => { setActiveTab('leaves'); setShowMobileMenu(false); }}
                           className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                               activeTab === 'leaves' ? 'bg-brand-blue text-white shadow-md' : 'text-slate-600 hover:bg-slate-50'
                           }`}
                       >
                           <CalendarX className="w-4 h-4" /> Absences
                       </button>

                       {false ? (
                           <div className="border-t border-slate-200 pt-4 mt-4">
                               <div className="text-xs font-extrabold text-slate-500 uppercase mb-2">Parrainage</div>
                               <button
                                   onClick={() => { window.location.href = isReferrer ? '/parrainage/mon-compte-parrain' : '/parrainage/devenir-parrain-client'; setShowMobileMenu(false); }}
                                   className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition"
                               >
                                   <Award className="w-4 h-4" /> {isReferrer ? 'Mon compte parrain' : 'Devenir parrain (code)'}
                               </button>
                               <button
                                   onClick={() => { window.location.href = '/parrainage/inscrire-filleul'; setShowMobileMenu(false); }}
                                   className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition"
                               >
                                   <Package className="w-4 h-4" /> Inscrire un filleul
                               </button>
                               <button
                                   onClick={() => { window.location.href = '/parrainage/mes-points'; setShowMobileMenu(false); }}
                                   className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition"
                               >
                                   <History className="w-4 h-4" /> Mes points parrainage
                               </button>
                               <button
                                   onClick={() => { window.location.href = '/flyers'; setShowMobileMenu(false); }}
                                   className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition"
                               >
                                   <Megaphone className="w-4 h-4" /> Offres / Flyers
                               </button>
                           </div>
                       ) : null}
                       
                       <div className="border-t border-slate-200 pt-4 mt-4">
                           <button 
                               onClick={() => { setSimulatedProviderId(null); logout(true); }}
                               className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-red-500 hover:bg-red-50 transition"
                           >
                               <LogOut className="w-4 h-4" /> Déconnexion
                           </button>
                       </div>
                   </nav>
               </div>
           </div>
       )}

       <div className="flex-1 flex overflow-hidden relative">
           {/* Desktop Sidebar */}
           <nav className="hidden md:flex w-64 bg-white border-r border-slate-200 flex-col p-4 space-y-2 shrink-0">
                <div className="px-2 pb-2 text-xs font-extrabold text-slate-500 uppercase">Menu prestataire</div>
                <button 
                    onClick={() => setActiveTab('dashboard')}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'dashboard' ? 'bg-brand-blue text-white shadow-md' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                    <Briefcase className="w-4 h-4" /> Missions
                </button>
                <button 
                    onClick={() => setActiveTab('live')}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'live' ? 'bg-red-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                    <Wifi className="w-4 h-4" /> Live Vidéo
                </button>
                <button 
                    onClick={() => setActiveTab('scans')}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'scans' ? 'bg-brand-blue text-white shadow-md' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                    <ScanLine className="w-4 h-4" /> Mes scans
                </button>
                <button 
                    onClick={() => setActiveTab('leaves')}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'leaves' ? 'bg-brand-blue text-white shadow-md' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                    <CalendarX className="w-4 h-4" /> Absences
                </button>

                {false ? (
                    <div className="border-t border-slate-200 pt-4 mt-4">
                        <div className="text-xs font-extrabold text-slate-500 uppercase mb-2">Parrainage</div>
                        <button onClick={() => { window.location.href = isReferrer ? '/parrainage/mon-compte-parrain' : '/parrainage/devenir-parrain-client'; }} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all text-slate-600 hover:bg-slate-50"><Award className="w-4 h-4" /> {isReferrer ? 'Mon compte parrain' : 'Devenir parrain (code)'}</button>
                        <button onClick={() => { window.location.href = '/parrainage/inscrire-filleul'; }} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all text-slate-600 hover:bg-slate-50"><Package className="w-4 h-4" /> Inscrire un filleul</button>
                        <button onClick={() => { window.location.href = '/parrainage/mes-points'; }} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all text-slate-600 hover:bg-slate-50"><History className="w-4 h-4" /> Mes points parrainage</button>
                        <button onClick={() => { window.location.href = '/flyers'; }} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all text-slate-600 hover:bg-slate-50"><Megaphone className="w-4 h-4" /> Offres / Flyers</button>
                    </div>
                ) : null}
           </nav>

           {/* Main Content */}
           <main
             ref={mainScrollRef}
             className="flex-1 overflow-y-auto p-4 md:p-8"
             onTouchStart={handleTouchStart}
             onTouchMove={handleTouchMove}
             onTouchEnd={handleTouchEnd}
           >
               {/* Pull-to-refresh indicator (mobile only) */}
               {(isPulling || isRefreshing) && (
                 <div
                   className="flex items-center justify-center transition-all duration-200 md:hidden"
                   style={{ height: isRefreshing ? 48 : Math.min(pullDistance, 48), overflow: 'hidden' }}
                 >
                   <div className={`flex items-center gap-2 text-sm text-blue-600 font-medium ${isRefreshing ? 'animate-pulse' : ''}`}>
                     <svg className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} style={!isRefreshing ? { transform: `rotate(${Math.min(pullDistance / 70 * 180, 180)}deg)` } : {}} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                     </svg>
                     {isRefreshing ? 'Actualisation…' : pullDistance >= 70 ? 'Relâchez pour actualiser' : 'Tirez pour actualiser'}
                   </div>
                 </div>
               )}
               <div className="max-w-7xl mx-auto">
                   {activeTab === 'dashboard' && (
                       <div className="space-y-6">
                           {false && isReferrer && referralLink ? (
                               <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm">
                                   <div className="text-sm font-extrabold text-slate-800">Ton lien de parrainage</div>
                                   <div className="text-xs text-slate-500 mt-1">Partage ce lien pour que tes filleuls s’inscrivent automatiquement avec ton code.</div>
                                   <div className="mt-3 flex flex-col sm:flex-row gap-2">
                                       <input
                                           value={referralLink}
                                           readOnly
                                           className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-xs bg-slate-50"
                                       />
                                       <button
                                           type="button"
                                           onClick={async () => {
                                               try {
                                                   await navigator.clipboard.writeText(referralLink);
                                                   showToast('Lien copié ✅', 'success');
                                               } catch {
                                                   showToast('Impossible de copier le lien', 'warning');
                                               }
                                           }}
                                           className="px-4 py-2 rounded-xl font-extrabold text-xs bg-brand-blue text-white hover:bg-teal-700"
                                       >
                                           Copier
                                       </button>
                                   </div>
                               </div>
                           ) : null}
                           <h2 className="text-2xl font-bold text-slate-800 font-serif">Mes Missions</h2>
                           {providerMissions.length === 0 ? (
                               <div className="bg-white p-10 rounded-2xl shadow-sm text-center border border-slate-200">
                                   <Briefcase className="w-16 h-16 mx-auto text-slate-200 mb-4" />
                                   <p className="text-slate-400 font-bold">Aucune mission assignée pour le moment.</p>
                               </div>
                           ) : (
                               <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                                   {providerMissions.map(m => {
                                       const clientById = clients.find(c => String(c.id) === String(m.clientId || ''));
                                       const normalizedMissionClientName = String(m.clientName || '').trim().toLowerCase();
                                       const clientByName = !clientById && normalizedMissionClientName
                                           ? clients.find(c => String(c.name || '').trim().toLowerCase() === normalizedMissionClientName)
                                           : undefined;
                                       const client = clientById || clientByName;

                                       const address = String(client?.address || '').trim();
                                       const city = String(client?.city || '').trim();
                                       const addressLine = `${address}${city ? `, ${city}` : ''}`.trim();
                                       const phone = String(client?.phone || '').trim();
                                       const email = String(client?.email || '').trim();
                                       const pack = String(client?.pack || '').trim();

                                       return (
                                       <div key={m.id} className={`bg-white p-4 sm:p-5 rounded-2xl shadow-sm border transition-all hover:shadow-md flex flex-col ${m.status === 'completed' ? 'border-green-200 bg-green-50/30' : m.status === 'cancelled' ? 'border-red-200 bg-red-50/30 opacity-75' : 'border-slate-200'}`}>
                                           <div className="flex justify-between items-start mb-4">
                                                <div className="bg-brand-blue/10 text-brand-blue p-2 rounded-lg">
                                                    <Briefcase className="w-5 h-5" />
                                                </div>
                                                <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                                                    m.status === 'planned' ? 'bg-orange-100 text-orange-700' :
                                                    m.status === 'in_progress' ? 'bg-blue-100 text-blue-700 animate-pulse' :
                                                    m.status === 'completed' ? 'bg-green-100 text-green-700' :
                                                    'bg-red-100 text-red-700'
                                                }`}>
                                                    {m.status === 'planned' && 'Planifiée'}
                                                    {m.status === 'in_progress' && 'En cours'}
                                                    {m.status === 'completed' && 'Terminée'}
                                                    {m.status === 'cancelled' && 'Annulée'}
                                                </span>
                                           </div>
                                           
                                           <h3 className="font-bold text-slate-800 text-lg mb-1">{m.service}</h3>
                                           <div className="space-y-2 text-sm text-slate-500 mb-6 flex-1">
                                               <div className="flex items-center gap-2"><Clock className="w-4 h-4 text-slate-400"/> {m.date} • {m.startTime} - {m.endTime}</div>
                                               <div className="flex items-center gap-2"><MapPin className="w-4 h-4 text-slate-400"/> {m.clientName}</div>
                                               <div className="mt-2 p-3 rounded-xl border border-slate-200 bg-slate-50">
                                                   <div className="text-[11px] font-bold text-slate-700 uppercase">Client</div>
                                                   <div className="text-xs text-slate-700 mt-1">
                                                       <span className="font-bold">Adresse:</span> {addressLine || 'Non renseigné'}
                                                   </div>
                                                   <div className="text-xs text-slate-700 mt-1">
                                                       <span className="font-bold">Téléphone:</span> {phone || 'Non renseigné'}
                                                   </div>
                                                   <div className="text-xs text-slate-700 mt-1">
                                                       <span className="font-bold">Email:</span> {email || 'Non renseigné'}
                                                   </div>
                                                   <div className="text-xs text-slate-700 mt-1">
                                                       <span className="font-bold">Pack:</span> {pack || 'Non renseigné'}
                                                   </div>
                                               </div>
                                           </div>

                                           <div className="grid grid-cols-1 gap-2 mt-auto">
                                                 {m.status === 'planned' && (
                                                     <div className="flex gap-2">
                                                        <button onClick={() => openExecutionModal(m.id, 'start')} className="flex-1 bg-brand-blue text-white py-2 rounded-lg text-sm font-bold hover:bg-blue-700 transition">
                                                            Démarrer
                                                        </button>
                                                        <button onClick={() => openExecutionModal(m.id, 'cancel')} className="px-3 py-2 border border-red-200 text-red-500 rounded-lg hover:bg-red-50 transition" title="Annuler">
                                                            <X className="w-4 h-4" />
                                                        </button>
                                                     </div>
                                                 )}
                                                 {m.status === 'in_progress' && (
                                                      <div className="flex gap-2">
                                                          <button onClick={() => openExecutionModal(m.id, 'end')} className="flex-1 bg-green-600 text-white py-2 rounded-lg text-sm font-bold hover:bg-green-700 transition animate-pulse shadow-lg shadow-green-200">
                                                             Terminer
                                                          </button>
                                                          <button onClick={() => openExecutionModal(m.id, 'cancel')} className="px-3 py-2 border border-red-200 text-red-500 rounded-lg hover:bg-red-50 transition" title="Annuler (Maladie/Force Majeure)">
                                                              <AlertTriangle className="w-4 h-4" />
                                                          </button>
                                                      </div>
                                                 )}
                                                 {m.status === 'completed' && (
                                                     <div className="text-center text-xs font-bold text-green-600 py-2 bg-green-50 rounded-lg border border-green-100">
                                                         Mission validée
                                                     </div>
                                                 )}
                                           </div>
                                       </div>
                                   );
                                   })}
                               </div>
                           )}
                       </div>
                   )}

                   {activeTab === 'live' && (
                       <div className="space-y-6">
                           <h2 className="text-2xl font-bold text-slate-800 font-serif">Appel Vidéo</h2>
                            {showVideoCall && activeStream ? (
                               <VideoCallManagerImproved
                                   sessionId={activeStream.id}
                                   isInitiator={true}
                                   onEnd={endVideoCall}
                               />
                           ) : (
                               <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                                   <div className="text-center mb-6">
                                       <div className="bg-slate-100 p-4 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                                           <Video className="w-8 h-8 text-brand-blue" />
                                       </div>
                                       <h3 className="text-lg font-bold text-slate-800 mb-2">Démarrer un Appel Vidéo</h3>
                                       <p className="text-slate-600 text-sm">Sélectionnez une mission active pour lancer un appel vidéo sécurisé avec le client.</p>
                                   </div>
                                   
                                   {streamError && (
                                       <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg mb-4">
                                           <p className="text-sm">{streamError}</p>
                                       </div>
                                   )}
                                   
                                   <div className="space-y-4">
                                       <div>
                                           <label className="block text-sm font-medium text-slate-700 mb-2">Mission Active</label>
                                           <select 
                                               className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm outline-none focus:border-brand-blue"
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
                                           <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                                               <h4 className="font-medium text-blue-900 mb-2">Détails de l'appel</h4>
                                               <div className="space-y-1 text-sm text-blue-700">
                                                   <p><strong>Client:</strong> {selectedMissionForCall.clientName}</p>
                                                   <p><strong>Date:</strong> {selectedMissionForCall.date}</p>
                                                   <p><strong>Service:</strong> {selectedMissionForCall.service}</p>
                                               </div>
                                           </div>
                                       )}
                                       
                                       <button
                                           onClick={() => selectedMissionForCall && startVideoCall(selectedMissionForCall)}
                                           disabled={!selectedMissionForCall}
                                           className="w-full bg-brand-blue hover:bg-blue-600 disabled:bg-slate-300 text-white font-bold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                                       >
                                           <Video className="w-5 h-5" />
                                           Démarrer l'Appel Vidéo
                                       </button>
                                   </div>
                                   
                                   {activeMissions.length === 0 && (
                                       <div className="text-center py-8">
                                           <Briefcase className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                                           <p className="text-slate-500">Aucune mission active disponible pour lancer un appel vidéo.</p>
                                       </div>
                                   )}
                               </div>
                           )}
                       </div>
                   )}

                   {activeTab === 'scans' && (
                       <div className="space-y-6">
                           <div className="flex items-start justify-between gap-4 flex-col sm:flex-row">
                               <div>
                                   <h2 className="text-2xl font-bold text-slate-800 font-serif">Historique des scans</h2>
                                   <p className="text-sm text-slate-500">Tous les pointages que vous avez effectués (entrée/sortie), avec filtres.</p>
                               </div>
                               <div className="text-sm text-slate-500 font-medium">
                                   {providerScansHistory.length} scan(s)
                               </div>
                           </div>

                           <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
                               <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                   <div>
                                       <label className="text-xs font-bold text-slate-500 mb-1 block">Date début</label>
                                       <input
                                           type="date"
                                           className="w-full border border-slate-300 rounded-lg p-3 bg-slate-50"
                                           value={scanFilters.startDate}
                                           onChange={(e) => setScanFilters(prev => ({ ...prev, startDate: e.target.value }))}
                                       />
                                   </div>
                                   <div>
                                       <label className="text-xs font-bold text-slate-500 mb-1 block">Date fin</label>
                                       <input
                                           type="date"
                                           className="w-full border border-slate-300 rounded-lg p-3 bg-slate-50"
                                           value={scanFilters.endDate}
                                           onChange={(e) => setScanFilters(prev => ({ ...prev, endDate: e.target.value }))}
                                       />
                                   </div>
                                   <div>
                                       <label className="text-xs font-bold text-slate-500 mb-1 block">Client</label>
                                       <select
                                           className="w-full border border-slate-300 rounded-lg p-3 bg-slate-50"
                                           value={scanFilters.clientId}
                                           onChange={(e) => setScanFilters(prev => ({ ...prev, clientId: e.target.value }))}
                                       >
                                           <option value="">Tous</option>
                                           {(Array.from(new Set(providerScansHistory.map((s: any) => s.clientId))) as string[]).map((clientId) => {
                                               const scan = providerScansHistory.find((s: any) => s.clientId === clientId);
                                               return (
                                                   <option key={clientId} value={clientId}>
                                                       {scan?.clientName || clientId}
                                                   </option>
                                               );
                                           })}
                                       </select>
                                   </div>
                                   <div>
                                       <label className="text-xs font-bold text-slate-500 mb-1 block">Type</label>
                                       <select
                                           className="w-full border border-slate-300 rounded-lg p-3 bg-slate-50"
                                           value={scanFilters.type}
                                           onChange={(e) => setScanFilters(prev => ({ ...prev, type: e.target.value as any }))}
                                       >
                                           <option value="">Tous</option>
                                           <option value="entry">Entrée</option>
                                           <option value="exit">Sortie</option>
                                       </select>
                                   </div>
                               </div>
                           </div>

                           <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                               <div className="p-4 border-b bg-slate-50">
                                   <h3 className="font-bold text-slate-700">Détails des pointages</h3>
                               </div>
                               <div className="divide-y">
                                   {providerScansHistory.length === 0 ? (
                                       <div className="p-8 text-center text-slate-400">
                                           <ScanLine className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                           <p>Aucun scan enregistré.</p>
                                       </div>
                                   ) : (
                                       providerScansHistory.map((scan: any) => (
                                           <div key={scan.id} className="p-4 hover:bg-slate-50 transition">
                                               <div className="flex items-start justify-between gap-4 flex-col sm:flex-row">
                                                   <div>
                                                       <div className="flex items-center gap-2 mb-1">
                                                           <span className={`text-xs font-bold px-2 py-1 rounded-full ${scan.scanType === 'entry' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>{scan.scanType === 'entry' ? 'Entrée' : 'Sortie'}</span>
                                                           <span className="text-sm font-bold text-slate-800">{scan.clientName}</span>
                                                       </div>
                                                       <div className="text-xs text-slate-500">{new Date(scan.timestamp).toLocaleString('fr-FR')}</div>
                                                       {scan.locationData && (
                                                           <div className="text-xs text-slate-500 mt-1">Localisation: {typeof scan.locationData === 'string' ? scan.locationData : 'Disponible'}</div>
                                                       )}
                                                   </div>
                                                   <div className="text-xs text-slate-500">
                                                       <div><span className="font-bold">ID scan:</span> {scan.id}</div>
                                                       <div><span className="font-bold">ID client:</span> {scan.clientId}</div>
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
                       <div className="max-w-2xl mx-auto">
                           <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 mb-6">
                               <h3 className="font-bold text-slate-700 mb-4 text-lg">Poser des congés</h3>
                               <form onSubmit={handleSubmitLeave} className="space-y-4">
                                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                       <div>
                                           <label className="text-xs font-bold text-slate-500 mb-1 block">Date Début</label>
                                           <input type="date" className="w-full border border-slate-300 rounded-lg p-3 bg-slate-50" value={leaveForm.start} onChange={e => setLeaveForm({...leaveForm, start: e.target.value})} required />
                                       </div>
                                       <div>
                                           <label className="text-xs font-bold text-slate-500 mb-1 block">Heure Début</label>
                                           <input type="time" className="w-full border border-slate-300 rounded-lg p-3 bg-slate-50" value={leaveForm.startTime} onChange={e => setLeaveForm({...leaveForm, startTime: e.target.value})} required />
                                       </div>
                                   </div>
                                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                       <div>
                                           <label className="text-xs font-bold text-slate-500 mb-1 block">Date Fin</label>
                                           <input type="date" className="w-full border border-slate-300 rounded-lg p-3 bg-slate-50" value={leaveForm.end} onChange={e => setLeaveForm({...leaveForm, end: e.target.value})} required />
                                       </div>
                                       <div>
                                           <label className="text-xs font-bold text-slate-500 mb-1 block">Heure Fin</label>
                                           <input type="time" className="w-full border border-slate-300 rounded-lg p-3 bg-slate-50" value={leaveForm.endTime} onChange={e => setLeaveForm({...leaveForm, endTime: e.target.value})} required />
                                       </div>
                                   </div>
                                   <div className="md:col-span-2 pt-2">
                                        <button type="submit" className="w-full bg-brand-orange text-white font-bold py-3 rounded-lg hover:bg-orange-600 transition shadow-md">
                                            Envoyer demande
                                        </button>
                                   </div>
                               </form>
                           </div>

                           <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                               <h4 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2"><CalendarX className="w-4 h-4"/> Historique des absences</h4>
                               {provider.leaves.length === 0 ? (
                                   <p className="text-slate-400 text-sm italic">Aucune absence enregistrée.</p>
                               ) : (
                                   <div className="space-y-2">
                                       {provider.leaves.map(l => (
                                           <div key={l.id} className="flex justify-between items-center bg-slate-50 p-3 rounded-lg border border-slate-100">
                                               <div className="flex items-center gap-3">
                                                   <div className={`w-2 h-2 rounded-full ${l.status === 'approved' ? 'bg-green-500' : l.status === 'rejected' ? 'bg-red-500' : 'bg-yellow-400'}`}></div>
                                                   <div className="text-xs text-slate-600 font-medium">
                                                       <div className="font-bold">{l.startDate} - {l.endDate}</div>
                                                       <div className="text-slate-400">{l.startTime?.slice(0,5)} à {l.endTime?.slice(0,5)}</div>
                                                   </div>
                                               </div>
                                               <span className={`text-xs font-bold px-2 py-1 rounded ${l.status === 'approved' ? 'bg-green-100 text-green-700' : l.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                                   {l.status === 'approved' ? 'Validé' : l.status === 'rejected' ? 'Refusé' : 'En attente'}
                                               </span>
                                           </div>
                                       ))}
                                   </div>
                               )}
                           </div>
                       </div>
                   )}
               </div>
           </main>
       </div>

       {/* Mobile Bottom Nav */}
       <div className="md:hidden bg-white border-t border-slate-200 flex justify-around p-2 pb-safe z-30 shrink-0">
           <button onClick={() => setActiveTab('dashboard')} className={`flex flex-col items-center p-2 rounded-lg transition ${activeTab === 'dashboard' ? 'text-brand-blue' : 'text-slate-400'}`}>
               <Briefcase className="w-6 h-6" />
               <span className="text-[10px] font-bold mt-1">Missions</span>
           </button>
           <button onClick={() => setActiveTab('live')} className={`flex flex-col items-center p-2 rounded-lg transition ${activeTab === 'live' ? 'text-red-500' : 'text-slate-400'}`}>
               <Wifi className="w-6 h-6" />
               <span className="text-[10px] font-bold mt-1">Live</span>
           </button>
           <button onClick={() => setActiveTab('scans')} className={`flex flex-col items-center p-2 rounded-lg transition ${activeTab === 'scans' ? 'text-brand-blue' : 'text-slate-400'}`}>
               <ScanLine className="w-6 h-6" />
               <span className="text-[10px] font-bold mt-1">Scans</span>
           </button>
           <button onClick={() => setActiveTab('leaves')} className={`flex flex-col items-center p-2 rounded-lg transition ${activeTab === 'leaves' ? 'text-brand-blue' : 'text-slate-400'}`}>
               <CalendarX className="w-6 h-6" />
               <span className="text-[10px] font-bold mt-1">Absences</span>
           </button>
       </div>

       {/* ALL NOTIFICATIONS MODAL */}
       {showAllNotifsModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg h-[80vh] flex flex-col animate-in fade-in zoom-in duration-200">
                  <div className="p-4 border-b bg-cream-50 flex justify-between items-center shrink-0">
                      <h3 className="font-bold text-lg text-slate-800">Toutes les notifications</h3>
                      <button onClick={() => setShowAllNotifsModal(false)} className="p-2 rounded-full hover:bg-slate-200 transition"><X className="w-5 h-5 text-slate-500"/></button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-0">
                      {allProviderNotifs.length === 0 ? (
                          <div className="p-8 text-center text-slate-400 flex flex-col items-center">
                              <Bell className="w-12 h-12 mb-2 opacity-20" />
                              <p>Aucune notification</p>
                          </div>
                      ) : (
                          allProviderNotifs.map(n => (
                              <div key={n.id} onClick={() => handleNotificationClick(n)} className={`p-4 border-b hover:bg-blue-50 cursor-pointer transition flex items-start gap-3 ${!n.read ? 'bg-blue-50/30' : ''}`}>
                                  <div className={`p-2 rounded-full shrink-0 ${n.type === 'alert' ? 'bg-red-100 text-red-600' : 'bg-brand-blue/10 text-brand-blue'}`}>
                                      <Bell className="w-4 h-4" />
                                  </div>
                                  <div className="flex-1">
                                      <div className="flex justify-between items-start mb-1">
                                          <span className="font-bold text-slate-800 text-sm">{n.title}</span>
                                          <span className="text-xs text-slate-400 whitespace-nowrap ml-2">{new Date(n.date).toLocaleDateString()}</span>
                                      </div>
                                      <p className="text-sm text-slate-600">{n.message}</p>
                                  </div>
                                  {!n.read && <div className="w-2 h-2 rounded-full bg-brand-blue mt-2"></div>}
                              </div>
                          ))
                      )}
                  </div>
              </div>
          </div>
      )}

       {/* Execution Modal */}
       {selectedMissionId && executionStep && (
           <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/80 backdrop-blur-sm md:p-4">
               <div className="bg-white md:rounded-2xl shadow-2xl w-full md:max-w-4xl h-full md:h-auto md:max-h-[90vh] flex flex-col animate-in fade-in zoom-in duration-200">
                   <div className="bg-slate-50 p-4 border-b flex justify-between items-center md:rounded-t-2xl shrink-0">
                       <h3 className="font-bold text-lg text-slate-800">
                           {executionStep === 'start' ? 'Début de chantier' : executionStep === 'end' ? 'Fin de chantier' : 'Annulation'}
                       </h3>
                       <button onClick={() => setSelectedMissionId(null)} className="p-2 rounded-full hover:bg-slate-200 transition"><X className="w-5 h-5 text-slate-500"/></button>
                   </div>
                   
                   <div className="flex-1 p-6 overflow-y-auto space-y-8">
                        {executionStep !== 'cancel' ? (
                           <>
                               {/* PHOTOS SECTION */}
                               <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                                   <div className="flex justify-between items-center mb-4">
                                       <label className="font-bold text-slate-700 flex items-center gap-2 text-lg"><Camera className="w-5 h-5 text-brand-blue"/> Photos du chantier</label>
                                       <span className={`text-sm font-bold px-3 py-1 rounded-full ${photos.length < 5 ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                                           {photos.length}/10 (Min 5)
                                       </span>
                                   </div>
                                   
                                   <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                                       {photos.map((url, i) => (
                                           <div key={i} className="aspect-square bg-slate-100 rounded-lg overflow-hidden relative border border-slate-200 group">
                                               <img src={url} alt={`Preuve ${i}`} className="w-full h-full object-cover" />
                                               <button 
                                                onClick={() => removePhoto(i)}
                                                className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                               >
                                                   <Trash2 className="w-3 h-3" />
                                               </button>
                                           </div>
                                       ))}
                                       <button 
                                        onClick={handlePhotoClick}
                                        className="aspect-square bg-slate-50 rounded-lg flex flex-col items-center justify-center border-2 border-dashed border-slate-300 text-slate-400 hover:bg-slate-100 transition hover:border-brand-blue hover:text-brand-blue gap-1"
                                       >
                                           <UploadCloud className="w-8 h-8" />
                                           <span className="text-xs font-bold">Ajouter</span>
                                       </button>
                                   </div>
                                   <p className="text-xs text-slate-400 mt-2 italic">Formats acceptés: JPG, PNG. Prenez des photos claires de l'état des lieux.</p>
                               </div>

                               {/* VIDEO SECTION */}
                               <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                                   <label className="font-bold text-slate-700 flex items-center gap-2 mb-4 text-lg"><Video className="w-5 h-5 text-brand-orange"/> Vidéo (Facultatif)</label>
                                   
                                   {video ? (
                                       <div className="bg-green-50 p-4 rounded-lg border border-green-200 text-green-700 flex items-center justify-between">
                                           <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-green-200 rounded-full flex items-center justify-center">
                                                    <CheckCircle className="w-6 h-6 text-green-700"/> 
                                                </div>
                                                <div>
                                                    <p className="font-bold text-sm">Vidéo ajoutée avec succès</p>
                                                    <p className="text-xs opacity-80">Prête à l'envoi</p>
                                                </div>
                                           </div>
                                           <button onClick={removeVideo} className="text-red-500 hover:text-red-700 p-2 hover:bg-red-50 rounded">
                                               <Trash2 className="w-5 h-5" />
                                           </button>
                                       </div>
                                   ) : (
                                       <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                           <button onClick={handleVideoClick} className="py-8 border-2 border-dashed border-slate-300 rounded-xl text-slate-500 font-bold flex flex-col items-center justify-center gap-2 hover:bg-slate-50 hover:border-brand-blue hover:text-brand-blue transition group">
                                               <FileVideo className="w-8 h-8 group-hover:scale-110 transition-transform" />
                                               <span>Uploader une vidéo</span>
                                               <span className="text-xs font-normal opacity-70">MP4, MOV (Max 100Mo)</span>
                                           </button>
                                           
                                           {!showVideoLinkInput ? (
                                               <button onClick={() => setShowVideoLinkInput(true)} className="py-8 border-2 border-dashed border-slate-300 rounded-xl text-slate-500 font-bold flex flex-col items-center justify-center gap-2 hover:bg-slate-50 hover:border-brand-orange hover:text-brand-orange transition group">
                                                   <LinkIcon className="w-8 h-8 group-hover:scale-110 transition-transform" />
                                                   <span>Ajouter un lien</span>
                                                   <span className="text-xs font-normal opacity-70">YouTube, Vimeo, Drive...</span>
                                               </button>
                                           ) : (
                                               <div className="flex flex-col justify-center gap-2 p-4 border border-slate-200 rounded-xl bg-slate-50">
                                                   <input 
                                                    type="text" 
                                                    className="w-full p-2 border rounded bg-white text-sm"
                                                    placeholder="https://..."
                                                    value={videoLinkInput}
                                                    onChange={e => setVideoLinkInput(e.target.value)}
                                                   />
                                                   <div className="flex gap-2">
                                                       <button onClick={handleAddVideoLink} className="flex-1 bg-brand-orange text-white py-1 rounded text-sm font-bold">Valider</button>
                                                       <button onClick={() => setShowVideoLinkInput(false)} className="px-3 py-1 text-slate-500 text-sm">Annuler</button>
                                                   </div>
                                               </div>
                                           )}
                                       </div>
                                   )}
                               </div>

                               {/* REMARK SECTION */}
                               <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                                   <label className="font-bold text-slate-700 flex items-center gap-2 mb-2 text-lg"><MessageSquare className="w-5 h-5 text-slate-400"/> Remarque (Facultatif)</label>
                                   <textarea 
                                       className="w-full border border-slate-300 rounded-xl p-4 h-32 outline-none focus:border-brand-blue focus:ring-1 focus:ring-brand-blue transition bg-slate-50"
                                       placeholder="Observation particulière, problème rencontré, matériel manquant..."
                                       value={remark}
                                       onChange={(e) => setRemark(e.target.value)}
                                   ></textarea>
                               </div>
                           </>
                        ) : (
                           <div>
                               <div className="bg-red-50 p-6 rounded-xl border border-red-100 mb-6">
                                   <h4 className="font-bold text-red-800 flex items-center gap-2 mb-2 text-lg"><AlertTriangle className="w-6 h-6"/> Attention</h4>
                                   <p className="text-sm text-red-600">
                                       L'annulation d'une mission planifiée pénalise le client et impacte votre score de fiabilité. 
                                       Le secrétariat sera immédiatement notifié pour gérer le remplacement.
                                   </p>
                               </div>
                               <label className="font-bold text-slate-700 mb-2 block text-lg">Motif de l'annulation <span className="text-red-500">*</span></label>
                               <textarea 
                                   className="w-full border border-slate-300 rounded-xl p-4 h-40 outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition text-slate-700"
                                   placeholder="Ex: Panne de véhicule, Maladie, Cas de force majeure..."
                                   value={cancelReason}
                                   onChange={(e) => setCancelReason(e.target.value)}
                               ></textarea>
                           </div>
                        )}
                   </div>

                   <div className="p-4 border-t bg-slate-50 md:rounded-b-2xl shrink-0">
                       <button 
                            onClick={handleSubmitExecution}
                            disabled={isSubmittingExecution}
                            className={`w-full py-4 rounded-xl text-white font-bold text-lg shadow-lg transition transform active:scale-95 flex items-center justify-center gap-2 ${executionStep === 'cancel' ? 'bg-red-500 hover:bg-red-600' : 'bg-brand-blue hover:bg-blue-700'} ${isSubmittingExecution ? 'opacity-70 cursor-not-allowed' : ''}`}
                       >
                           {isSubmittingExecution ? (
                               <>
                                   <div className="w-5 h-5 border-2 border-white/60 border-t-white rounded-full animate-spin"></div>
                                   Envoi en cours...
                               </>
                           ) : (
                               <>
                                   {executionStep === 'start' && 'Démarrer la mission'}
                                   {executionStep === 'end' && 'Terminer et Envoyer'}
                                   {executionStep === 'cancel' && 'Confirmer Annulation'}
                               </>
                           )}
                       </button>
                   </div>
               </div>
           </div>
       )}
       
       {/* Toast */}
       {toast.show && (
           <div className={`fixed bottom-20 left-1/2 transform -translate-x-1/2 px-6 py-3 rounded-full text-sm font-bold shadow-2xl z-[70] flex items-center gap-2 animate-in fade-in slide-in-from-bottom-4 ${
               toast.type === 'error' ? 'bg-red-800 text-white' :
               toast.type === 'warning' ? 'bg-orange-800 text-white' :
               'bg-green-800 text-white'
           }`}>
               {toast.type === 'error' ? <AlertTriangle className="w-4 h-4" /> :
                toast.type === 'warning' ? <AlertTriangle className="w-4 h-4" /> :
                <CheckCircle className="w-4 h-4" />}
               {toast.message}
           </div>
       )}

    {/* Modal Mobile pour les notifications Provider */}
    {showMobileNotifModal && (
      <div className="md:hidden fixed inset-0 z-50 flex items-end justify-center bg-black/50">
        <div className="bg-white w-full max-h-[80vh] rounded-t-2xl shadow-xl overflow-hidden animate-in slide-in-from-bottom duration-300">
          <div className="bg-slate-50 px-4 py-3 border-b border-slate-100 flex justify-between items-center">
            <h3 className="font-bold text-slate-700">Notifications</h3>
            <button 
              onClick={() => setShowMobileNotifModal(false)}
              className="p-2 rounded-full hover:bg-slate-100 transition"
            >
              <X className="w-5 h-5 text-slate-600" />
            </button>
          </div>
          <div className="overflow-y-auto max-h-[60vh] p-4">
            {allProviderNotifs.length === 0 ? (
              <div className="text-center text-slate-400 py-8">Aucune notification</div>
            ) : (
              allProviderNotifs.slice(0, 10).map(n => (
                <div key={n.id} onClick={() => {
                  handleNotificationClick(n);
                  setShowMobileNotifModal(false);
                }} className={`p-3 mb-2 rounded-lg border border-slate-100 cursor-pointer hover:bg-blue-50 transition ${!n.read ? 'bg-blue-50/50' : ''}`}>
                  <span className="font-bold block text-brand-blue mb-1 truncate text-sm">{n.title}</span>
                  <p className="text-xs text-slate-600 line-clamp-2 break-words">{n.message}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    )}

    </div>
  );
};

export default ProviderPortal;
