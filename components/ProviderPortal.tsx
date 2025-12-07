
import React, { useState, useRef, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { 
  Briefcase, 
  Clock, 
  MapPin, 
  Camera, 
  Video, 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  LogOut, 
  Bell,
  CalendarX,
  MessageSquare, 
  UploadCloud,
  X,
  Wifi,
  Mic,
  MicOff,
  Lock,
  Link as LinkIcon,
  FileVideo,
  Trash2
} from 'lucide-react';

const ProviderPortal: React.FC = () => {
  const { 
    providers, 
    missions, 
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
    activeStream
  } = useData();

  const provider = providers.find(p => p.id === simulatedProviderId);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'leaves' | 'live'>('dashboard');
  const [toast, setToast] = useState<{ show: boolean; message: string }>({ show: false, message: '' });
  
  // Notification State
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const [showAllNotifsModal, setShowAllNotifsModal] = useState(false);

  // Live Stream State
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamMissionId, setStreamMissionId] = useState<string>('');
  const [micMuted, setMicMuted] = useState(false);
  const [streamError, setStreamError] = useState('');

  // Execution Modals
  const [selectedMissionId, setSelectedMissionId] = useState<string | null>(null);
  const [executionStep, setExecutionStep] = useState<'start' | 'end' | 'cancel' | null>(null);
  
  // Execution Form
  const [remark, setRemark] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [video, setVideo] = useState<string | undefined>(undefined);
  const [cancelReason, setCancelReason] = useState('');

  // Leaves Form
  const [leaveForm, setLeaveForm] = useState({ start: '', end: '', startTime: '08:00', endTime: '18:00' });

  // File Input Refs
  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const [videoLinkInput, setVideoLinkInput] = useState('');
  const [showVideoLinkInput, setShowVideoLinkInput] = useState(false);

  // Data Calculations
  const providerMissions = provider ? missions.filter(m => m.providerId === provider.id) : [];
  // All notifications
  const allProviderNotifs = provider ? notifications.filter(n => n.targetUserType === 'provider' && (!n.targetUserId || n.targetUserId === provider.id)) : [];
  const unreadProviderNotifs = allProviderNotifs.filter(n => !n.read);
  const activeMissions = providerMissions.filter(m => m.status === 'in_progress' || m.status === 'planned');

  // Cleanup on unmount
  useEffect(() => {
      return () => {
          if (activeStream) {
              stopLiveStream();
          }
      };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!provider) {
    return (
      <div className="h-full flex items-center justify-center flex-col bg-slate-100 p-8">
         <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md text-center">
            <Briefcase className="w-16 h-16 mx-auto text-slate-300 mb-4" />
            <h2 className="text-2xl font-bold text-slate-800 mb-2">Espace Prestataire</h2>
            <p className="text-slate-500 mb-6">Veuillez sélectionner un prestataire depuis l'interface Admin pour simuler sa vue.</p>
            <button onClick={() => setSimulatedProviderId(null)} className="bg-brand-orange text-white px-6 py-2 rounded-lg font-bold">Retour Admin</button>
         </div>
      </div>
    );
  }

  const showToast = (message: string) => {
    setToast({ show: true, message });
    setTimeout(() => setToast({ show: false, message: '' }), 3000);
  };

  const handleNotificationClick = (notif: any) => {
      markNotificationRead(notif.id);
      if (notif.link && notif.link.startsWith('mission:')) {
          setActiveTab('dashboard');
      }
      setShowNotifDropdown(false);
      setShowAllNotifsModal(false);
  };

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

  // --- PHOTO HANDLERS ---
  const handlePhotoClick = () => {
     if(photos.length >= 10) {
         showToast('Maximum 10 photos.');
         return;
     }
     photoInputRef.current?.click();
  };

  const handlePhotoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
     if (e.target.files && e.target.files.length > 0) {
         const newPhotos: string[] = [];
         // Ensure files is strictly typed as File[] to avoid 'unknown' inference issues
         const files = Array.from(e.target.files) as File[];
         
         // Limit to remaining slots
         const remaining = 10 - photos.length;
         const filesToProcess = files.slice(0, remaining);

         let processedCount = 0;
         filesToProcess.forEach(file => {
             const reader = new FileReader();
             reader.onloadend = () => {
                 if (typeof reader.result === 'string') {
                     newPhotos.push(reader.result);
                 }
                 processedCount++;
                 if (processedCount === filesToProcess.length) {
                     setPhotos(prev => [...prev, ...newPhotos]);
                 }
             };
             reader.readAsDataURL(file as Blob);
         });
     }
     if (e.target) e.target.value = ''; // Reset
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

  const handleSubmitExecution = () => {
      if(!selectedMissionId) return;

      if (executionStep === 'start') {
          if (photos.length < 5) {
              alert('Il faut obligatoirement 5 photos minimum avant chantier.');
              return;
          }
          startMission(selectedMissionId, remark, photos, video);
          showToast('Mission démarrée. Client notifié.');
      } else if (executionStep === 'end') {
          if (photos.length < 5) {
              alert('Il faut obligatoirement 5 photos minimum fin de chantier.');
              return;
          }
          endMission(selectedMissionId, remark, photos, video);
          showToast('Mission terminée. Rapport envoyé.');
      } else if (executionStep === 'cancel') {
          if (!cancelReason.trim()) {
              alert('Motif obligatoire.');
              return;
          }
          cancelMissionByProvider(selectedMissionId, cancelReason);
          showToast('Mission annulée. Secrétariat notifié.');
      }

      setExecutionStep(null);
      setSelectedMissionId(null);
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
      try {
          setStreamError('');
          
          const mission = activeMissions.find(m => m.id === streamMissionId);
          if(!mission || !mission.clientId) {
              setStreamError('Veuillez sélectionner une mission valide pour sécuriser le flux.');
              return;
          }

          if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error("Votre navigateur ne supporte pas l'accès caméra.");
          }

          const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
          if (videoRef.current) {
              videoRef.current.srcObject = stream;
          }
          setIsStreaming(true);
          
          startLiveStream(provider.id, mission.clientId);
          
      } catch (err: any) {
          console.error("Camera Error:", err);
          if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
              setStreamError('Aucune caméra trouvée sur cet appareil.');
          } else if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
              setStreamError('Permission caméra refusée.');
          } else {
              setStreamError(err.message || 'Erreur accès caméra.');
          }
      }
  };
  
  const stopCamera = () => {
      if (videoRef.current && videoRef.current.srcObject) {
          const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
          tracks.forEach(track => track.stop());
          videoRef.current.srcObject = null;
      }
      setIsStreaming(false);
      stopLiveStream();
  };
  
  const toggleMic = () => {
      if (videoRef.current && videoRef.current.srcObject) {
          const audioTracks = (videoRef.current.srcObject as MediaStream).getAudioTracks();
          audioTracks.forEach(track => track.enabled = !micMuted);
          setMicMuted(!micMuted);
      }
  };
  
  return (
    <div className="h-full bg-slate-50 flex flex-col font-sans relative overflow-hidden">
       
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
               <div className="w-10 h-10 rounded-full bg-brand-blue text-white flex items-center justify-center font-bold text-lg border-2 border-blue-100">
                   {provider.firstName.charAt(0)}{provider.lastName.charAt(0)}
               </div>
               <div>
                   <h1 className="font-bold text-slate-800 text-lg hidden md:block">Espace Prestataire</h1>
                   <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-700 md:hidden">Espace Pro</span>
                        <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-[10px] font-bold border border-green-200 flex items-center gap-1">
                            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div> En ligne
                        </span>
                   </div>
               </div>
           </div>

           <div className="flex gap-4 items-center">
               {/* Notifications */}
               <div className="relative">
                   <button 
                    onClick={() => setShowNotifDropdown(!showNotifDropdown)}
                    className="p-2 rounded-full hover:bg-slate-100 text-slate-500 hover:text-brand-blue transition relative"
                   >
                        <Bell className="w-6 h-6" />
                        {unreadProviderNotifs.length > 0 && <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>}
                   </button>
                   
                   {showNotifDropdown && (
                       <div className="absolute top-full right-0 mt-2 w-80 bg-white text-slate-800 rounded-xl shadow-xl border border-slate-100 z-50 text-sm overflow-hidden">
                           <div className="bg-slate-50 px-4 py-3 border-b border-slate-100 font-bold text-slate-600 text-xs uppercase flex justify-between">
                               <span>Notifications</span>
                               <span className="text-brand-blue">{unreadProviderNotifs.length}</span>
                           </div>
                           <div className="max-h-64 overflow-y-auto">
                                {allProviderNotifs.length === 0 && <div className="p-4 text-center text-slate-400 italic">Rien à signaler</div>}
                                {allProviderNotifs.slice(0, 5).map(n => (
                                    <div key={n.id} onClick={() => handleNotificationClick(n)} className={`p-3 border-b hover:bg-blue-50 cursor-pointer transition ${!n.read ? 'bg-blue-50/50' : ''}`}>
                                        <span className="font-bold block text-brand-blue mb-1">{n.title}</span>
                                        <p className="text-xs text-slate-600 line-clamp-2">{n.message}</p>
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
                onClick={() => setSimulatedProviderId(null)} 
                className="hidden md:flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-red-500 transition px-3 py-2 rounded-lg hover:bg-red-50"
               >
                   <LogOut className="w-4 h-4" /> <span className="hidden lg:inline">Déconnexion</span>
               </button>
               <button 
                onClick={() => setSimulatedProviderId(null)} 
                className="md:hidden p-2 text-slate-500"
               >
                   <LogOut className="w-5 h-5" />
               </button>
           </div>
       </header>

       <div className="flex-1 flex overflow-hidden relative">
           {/* Desktop Sidebar */}
           <nav className="hidden md:flex w-64 bg-white border-r border-slate-200 flex-col p-4 space-y-2 shrink-0">
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
                    onClick={() => setActiveTab('leaves')}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'leaves' ? 'bg-brand-blue text-white shadow-md' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                    <CalendarX className="w-4 h-4" /> Absences
                </button>
           </nav>

           {/* Main Content */}
           <main className="flex-1 overflow-y-auto p-4 md:p-8">
               <div className="max-w-7xl mx-auto">
                   {activeTab === 'dashboard' && (
                       <div className="space-y-6">
                           <h2 className="text-2xl font-bold text-slate-800 font-serif">Mes Missions</h2>
                           {providerMissions.length === 0 ? (
                               <div className="bg-white p-10 rounded-2xl shadow-sm text-center border border-slate-200">
                                   <Briefcase className="w-16 h-16 mx-auto text-slate-200 mb-4" />
                                   <p className="text-slate-400 font-bold">Aucune mission assignée pour le moment.</p>
                               </div>
                           ) : (
                               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                   {providerMissions.map(m => (
                                       <div key={m.id} className={`bg-white p-5 rounded-2xl shadow-sm border transition-all hover:shadow-md flex flex-col ${m.status === 'completed' ? 'border-green-200 bg-green-50/30' : m.status === 'cancelled' ? 'border-red-200 bg-red-50/30 opacity-75' : 'border-slate-200'}`}>
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
                                   ))}
                               </div>
                           )}
                       </div>
                   )}

                   {activeTab === 'live' && (
                       <div className="h-[600px] bg-slate-900 rounded-2xl overflow-hidden shadow-2xl border border-slate-800 flex flex-col relative">
                            <div className="flex-1 relative bg-black">
                                {!isStreaming && (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 p-6 text-center">
                                        <div className="bg-slate-800 p-4 rounded-full mb-4">
                                            <Lock className="w-8 h-8 text-green-400" />
                                        </div>
                                        <h3 className="text-white font-bold text-lg mb-2">Connexion Sécurisée</h3>
                                        <p className="text-xs mb-4 text-slate-400">Le flux vidéo sera crypté et visible uniquement par le client sélectionné.</p>
                                        
                                        <div className="w-full max-w-xs">
                                            <select 
                                                className="w-full bg-slate-800 text-white border border-slate-700 rounded-lg p-3 mb-4 text-sm outline-none focus:border-brand-blue"
                                                value={streamMissionId}
                                                onChange={(e) => setStreamMissionId(e.target.value)}
                                            >
                                                <option value="">Sélectionner la mission...</option>
                                                {activeMissions.map(m => (
                                                    <option key={m.id} value={m.id}>Client: {m.clientName} - {m.date}</option>
                                                ))}
                                            </select>
                                            
                                            {streamError && <p className="text-red-500 text-xs mb-4 font-bold bg-red-100/10 p-2 rounded">{streamError}</p>}

                                            <button 
                                                onClick={startCamera} 
                                                disabled={!streamMissionId}
                                                className={`w-full px-8 py-3 rounded-full font-bold text-white shadow-lg flex items-center justify-center gap-2 transition ${!streamMissionId ? 'bg-slate-700 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700'}`}
                                            >
                                                <Video className="w-5 h-5" /> LANCER LE DIRECT
                                            </button>
                                        </div>
                                    </div>
                                )}
                                <video 
                                    ref={videoRef} 
                                    autoPlay 
                                    playsInline 
                                    muted 
                                    className={`w-full h-full object-cover ${!isStreaming ? 'hidden' : 'block'}`} 
                                />
                                
                                {isStreaming && (
                                    <div className="absolute top-4 left-4 flex flex-col gap-1 z-10">
                                        <div className="bg-red-600 text-white px-3 py-1 rounded text-xs font-bold animate-pulse flex items-center gap-2 w-fit">
                                            <span className="w-2 h-2 bg-white rounded-full"></span> EN DIRECT
                                        </div>
                                        <div className="bg-black/50 text-white px-2 py-0.5 rounded text-[10px] flex items-center gap-1">
                                            <Lock className="w-3 h-3 text-green-400" /> Sécurisé
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Controls */}
                            {isStreaming && (
                                <div className="p-4 bg-slate-800 flex justify-between items-center border-t border-slate-700">
                                    <div className="text-white text-xs">
                                        <p className="font-bold opacity-70">Diffusé vers</p>
                                        <p className="text-green-400 font-mono">{activeMissions.find(m => m.id === streamMissionId)?.clientName || 'Client'}</p>
                                    </div>
                                    <div className="flex gap-4">
                                        <button onClick={toggleMic} className={`p-3 rounded-full transition-colors ${micMuted ? 'bg-red-500 text-white' : 'bg-slate-700 text-white hover:bg-slate-600'}`}>
                                            {micMuted ? <MicOff className="w-5 h-5"/> : <Mic className="w-5 h-5"/>}
                                        </button>
                                        <button onClick={stopCamera} className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-full text-sm transition-colors">
                                            ARRÊTER
                                        </button>
                                    </div>
                                </div>
                            )}
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
                            className={`w-full py-4 rounded-xl text-white font-bold text-lg shadow-lg transition transform active:scale-95 flex items-center justify-center gap-2 ${executionStep === 'cancel' ? 'bg-red-500 hover:bg-red-600' : 'bg-brand-blue hover:bg-blue-700'}`}
                       >
                           {executionStep === 'start' && 'Démarrer la mission'}
                           {executionStep === 'end' && 'Terminer et Envoyer'}
                           {executionStep === 'cancel' && 'Confirmer Annulation'}
                       </button>
                   </div>
               </div>
           </div>
       )}
       
       {/* Toast */}
       {toast.show && (
           <div className="fixed bottom-20 left-1/2 transform -translate-x-1/2 bg-slate-800 text-white px-6 py-3 rounded-full text-sm font-bold shadow-2xl z-[70] flex items-center gap-2 animate-in fade-in slide-in-from-bottom-4">
               <CheckCircle className="w-4 h-4 text-green-400" /> {toast.message}
           </div>
       )}

    </div>
  );
};

export default ProviderPortal;
