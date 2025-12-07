
import React, { useState, useRef, useEffect } from 'react';
import { useData, LOGO_NORMAL } from '../context/DataContext';
import { 
  FileText, 
  Calendar, 
  MessageSquare, 
  User, 
  CheckCircle, 
  Download, 
  MessageCircle,
  Star,
  Send,
  PenTool,
  X,
  Wifi,
  Lock,
  FileSignature,
  LogOut,
  MapPin,
  Phone,
  Mail,
  Award,
  Package,
  AlertCircle,
  Bell,
  ArrowRight,
  Camera
} from 'lucide-react';

const ClientPortal: React.FC = () => {
  const { 
    clients, 
    documents, 
    missions, 
    simulatedClientId, 
    signQuoteWithData,
    refuseQuote,
    requestInvoice,
    sendClientMessage,
    cancelMissionByClient,
    canCancelMission,
    notifications,
    markNotificationRead,
    activeStream,
    messages,
    submitClientReview,
    contracts,
    packs,
    logout,
    currentUser
  } = useData();

  // Determine client ID either from simulation or real login
  const activeClientId = simulatedClientId || (currentUser?.role === 'client' ? currentUser.relatedEntityId : null);
  const client = clients.find(c => c.id === activeClientId);

  const [activeTab, setActiveTab] = useState<'planning' | 'docs' | 'messages' | 'live' | 'profile'>('planning');
  const [messageInput, setMessageInput] = useState('');
  const [toast, setToast] = useState<{ show: boolean; message: string }>({ show: false, message: '' });
  
  // Notification State
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const [showAllNotifsModal, setShowAllNotifsModal] = useState(false);

  // Modals
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [pendingInvoiceDocId, setPendingInvoiceDocId] = useState<string | null>(null);
  const [quoteModalOpen, setQuoteModalOpen] = useState(false);
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);
  const [termsAccepted, setTermsAccepted] = useState(false);
  
  // Lightbox State
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  
  // Review Form
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');

  // Signature Canvas Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  // Chat Scroll
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
      if(activeTab === 'messages') {
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }
  }, [messages, activeTab]);

  useEffect(() => {
      if (activeStream && activeStream.clientId === client?.id) {
          setActiveTab('live');
      }
  }, [activeStream, client]);

  if (!client) {
    return (
      <div className="h-full flex items-center justify-center flex-col bg-slate-100 p-8">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md text-center">
          <User className="w-16 h-16 mx-auto text-slate-300 mb-4" />
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Chargement du profil...</h2>
          <p className="text-slate-500 mb-6">Veuillez patienter.</p>
        </div>
      </div>
    );
  }

  const clientDocs = documents.filter(d => d.clientId === client.id);
  const clientMissions = missions.filter(m => m.clientId === client.id || m.clientName === client.name);
  // All notifications
  const allClientNotifs = notifications.filter(n => n.targetUserType === 'client' && (!n.targetUserId || n.targetUserId === client.id));
  const unreadClientNotifs = allClientNotifs.filter(n => !n.read);
  const clientMessages = messages.filter(m => m.clientId === client.id);
  const isLive = activeStream && activeStream.clientId === client.id;

  const showToast = (message: string) => {
    setToast({ show: true, message });
    setTimeout(() => setToast({ show: false, message: '' }), 3000);
  };

  const handleLogout = () => {
      logout();
  };

  const handleNotificationClick = (notif: any) => {
      markNotificationRead(notif.id);
      if (notif.link && notif.link.startsWith('mission:')) {
          setActiveTab('planning');
      } else if (notif.link === 'tab:messages') {
          setActiveTab('messages');
      }
      setShowNotifDropdown(false);
      setShowAllNotifsModal(false);
  };

  const openQuoteModal = (docId: string) => {
      setSelectedQuoteId(docId);
      setTermsAccepted(false);
      setQuoteModalOpen(true);
      setTimeout(() => clearCanvas(), 100);
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
      const canvas = canvasRef.current;
      if(!canvas) return;
      const ctx = canvas.getContext('2d');
      if(!ctx) return;
      
      setIsDrawing(true);
      const rect = canvas.getBoundingClientRect();
      const x = ('touches' in e) ? e.touches[0].clientX - rect.left : (e as React.MouseEvent).clientX - rect.left;
      const y = ('touches' in e) ? e.touches[0].clientY - rect.top : (e as React.MouseEvent).clientY - rect.top;
      ctx.beginPath();
      ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
      if(!isDrawing) return;
      const canvas = canvasRef.current;
      if(!canvas) return;
      const ctx = canvas.getContext('2d');
      if(!ctx) return;

      const rect = canvas.getBoundingClientRect();
      const x = ('touches' in e) ? e.touches[0].clientX - rect.left : (e as React.MouseEvent).clientX - rect.left;
      const y = ('touches' in e) ? e.touches[0].clientY - rect.top : (e as React.MouseEvent).clientY - rect.top;
      ctx.lineTo(x, y);
      ctx.stroke();
  };

  const stopDrawing = () => { setIsDrawing(false); };
  const clearCanvas = () => {
      const canvas = canvasRef.current;
      if(canvas) {
          const ctx = canvas.getContext('2d');
          ctx?.clearRect(0, 0, canvas.width, canvas.height);
      }
  };

  const submitSignature = () => {
      if(!termsAccepted) {
          alert("Veuillez accepter les conditions du contrat avant de signer.");
          return;
      }
      if(selectedQuoteId && canvasRef.current) {
          const dataUrl = canvasRef.current.toDataURL();
          signQuoteWithData(selectedQuoteId, dataUrl);
          setQuoteModalOpen(false);
          showToast('Devis signé ! Vos créneaux sont réservés.');
      }
  };

  const handleRefuse = (docId: string) => {
    if(window.confirm("Êtes-vous sûr de refuser ce devis ? Cela annulera la proposition.")) {
      refuseQuote(docId);
      setQuoteModalOpen(false);
      showToast('Devis refusé. Le secrétariat a été notifié.');
    }
  };

  const handleDownloadInvoice = (doc: any) => {
      // Check if review needed
      if (!client.hasLeftReview) {
          setPendingInvoiceDocId(doc.id);
          setReviewModalOpen(true);
          return;
      }

      showToast('Téléchargement de la facture en cours...');
      setTimeout(() => {
          // Simulation of PDF download
          const element = document.createElement('a');
          element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(`FACTURE ${doc.ref}\n\nMontant: ${doc.totalTTC}€\n\nCeci est une simulation PDF.`));
          element.setAttribute('download', `${doc.ref}.pdf`);
          element.style.display = 'none';
          document.body.appendChild(element);
          element.click();
          document.body.removeChild(element);
      }, 1000);
  };
  
  const handleDownloadContract = () => {
      showToast('Téléchargement du contrat signé...');
      setTimeout(() => {
          alert("Simulation: Le contrat PDF signé a été téléchargé.");
      }, 500);
  };

  const handleRequestInvoice = (docId: string) => {
     if (!client.hasLeftReview) {
         setPendingInvoiceDocId(docId);
         setReviewModalOpen(true);
     } else {
         requestInvoice(docId);
         showToast('Demande de facture envoyée au secrétariat.');
     }
  };

  const submitReview = () => {
      if (pendingInvoiceDocId) {
        submitClientReview(client.id, reviewRating, reviewComment);
        requestInvoice(pendingInvoiceDocId);
        setReviewModalOpen(false);
        setPendingInvoiceDocId(null);
        showToast('Merci pour votre avis ! Facture débloquée.');
      }
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (messageInput.trim()) {
      sendClientMessage(messageInput, client.id);
      setMessageInput('');
      showToast('Message envoyé au secrétariat.');
    }
  };

  const handleCancelMission = (missionId: string) => {
      cancelMissionByClient(missionId);
      showToast('Demande d\'annulation envoyée.');
  };

  const selectedQuote = documents.find(d => d.id === selectedQuoteId);
  
  const getQuoteContract = () => {
      if (!selectedQuote) return null;
      const pack = packs.find(p => p.name === selectedQuote.description || selectedQuote.description.includes(p.name));
      if (pack) {
          return contracts.find(c => c.packId === pack.id) || contracts[0];
      }
      return contracts[0];
  };
  
  const selectedContract = getQuoteContract();

  // Helper to download all images
  const handleDownloadAllImages = (urls: string[]) => {
      showToast('Téléchargement des photos en cours...');
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

  return (
    <div className="h-full bg-slate-50 flex flex-col overflow-hidden font-sans relative">
       <div className={`fixed top-6 right-6 z-[100] transition-all duration-500 transform ${toast.show ? 'translate-y-0 opacity-100' : '-translate-y-10 opacity-0 pointer-events-none'}`}>
        <div className="bg-brand-blue text-white px-6 py-4 rounded-lg shadow-2xl flex items-center gap-3">
            <CheckCircle className="w-5 h-5" />
            <p className="text-sm font-bold">{toast.message}</p>
        </div>
      </div>

      <header className="bg-white border-b border-slate-200 px-4 md:px-6 py-4 flex justify-between items-center shadow-sm z-10 shrink-0">
        <div className="flex items-center gap-4">
           <div className="w-10 h-10 rounded-full bg-brand-orange text-white flex items-center justify-center font-bold text-lg">
             {client.name.charAt(0)}
           </div>
           <div>
             <h1 className="text-xl font-bold text-slate-800">Espace Client</h1>
             <p className="text-xs text-slate-500 hidden md:block">Bienvenue, {client.name}</p>
           </div>
        </div>
        <div className="flex items-center gap-4">
            
            {/* Notification Bell */}
            <div className="relative">
                <button 
                    onClick={() => setShowNotifDropdown(!showNotifDropdown)}
                    className="p-2 rounded-full hover:bg-slate-100 text-slate-500 hover:text-brand-blue transition relative"
                >
                    <Bell className="w-6 h-6" />
                    {unreadClientNotifs.length > 0 && <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>}
                </button>
                
                {showNotifDropdown && (
                    <div className="absolute top-full right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-slate-100 z-50 overflow-hidden">
                        <div className="bg-slate-50 px-4 py-3 border-b border-slate-100 flex justify-between items-center">
                            <span className="font-bold text-sm text-slate-700">Notifications</span>
                            <span className="text-xs text-slate-500">{unreadClientNotifs.length} nouvelles</span>
                        </div>
                        <div className="max-h-64 overflow-y-auto">
                            {allClientNotifs.length === 0 ? (
                                <div className="p-4 text-center text-xs text-slate-400">Aucune notification.</div>
                            ) : (
                                allClientNotifs.slice(0, 5).map(n => (
                                    <div key={n.id} onClick={() => handleNotificationClick(n)} className={`p-3 border-b border-slate-50 cursor-pointer hover:bg-cream-50 transition ${!n.read ? 'bg-blue-50/50' : ''}`}>
                                        <div className="flex justify-between items-start mb-1">
                                            <span className={`text-xs font-bold ${n.type === 'alert' ? 'text-red-600' : 'text-brand-blue'}`}>{n.title}</span>
                                            <span className="text-[10px] text-slate-400">{new Date(n.date).toLocaleDateString()}</span>
                                        </div>
                                        <p className="text-xs text-slate-600 line-clamp-2">{n.message}</p>
                                    </div>
                                ))
                            )}
                        </div>
                        <button 
                            onClick={() => { setShowNotifDropdown(false); setShowAllNotifsModal(true); }}
                            className="w-full py-2 text-center text-xs font-bold text-brand-blue bg-slate-50 hover:bg-slate-100 border-t border-slate-100 transition"
                        >
                            Voir toutes les notifications
                        </button>
                    </div>
                )}
            </div>
            
            <button 
                onClick={handleLogout}
                className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-red-500 transition border border-slate-200 px-3 py-2 rounded-lg hover:bg-red-50"
            >
                <LogOut className="w-4 h-4" /> <span className="hidden md:inline">Déconnexion</span>
            </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
         <nav className="w-64 bg-white border-r border-slate-200 p-4 space-y-2 hidden md:block shrink-0">
            <button onClick={() => setActiveTab('planning')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-bold transition-colors ${activeTab === 'planning' ? 'bg-brand-blue text-white' : 'text-slate-600 hover:bg-slate-50'}`}><Calendar className="w-4 h-4" /> Mon Planning</button>
            <button onClick={() => setActiveTab('docs')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-bold transition-colors ${activeTab === 'docs' ? 'bg-brand-blue text-white' : 'text-slate-600 hover:bg-slate-50'}`}><FileText className="w-4 h-4" /> Devis & Factures</button>
            <button onClick={() => setActiveTab('messages')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-bold transition-colors ${activeTab === 'messages' ? 'bg-brand-blue text-white' : 'text-slate-600 hover:bg-slate-50'}`}><MessageSquare className="w-4 h-4" /> Messages</button>
            <button onClick={() => setActiveTab('profile')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-bold transition-colors ${activeTab === 'profile' ? 'bg-brand-blue text-white' : 'text-slate-600 hover:bg-slate-50'}`}><User className="w-4 h-4" /> Mon Profil</button>
            <button onClick={() => setActiveTab('live')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-bold transition-colors relative ${activeTab === 'live' ? 'bg-red-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}><Wifi className={`w-4 h-4 ${isLive ? 'animate-pulse' : ''}`} /> Direct Vidéo {isLive && <span className="absolute right-3 w-2 h-2 bg-green-400 rounded-full ring-2 ring-white animate-pulse"></span>}</button>
         </nav>

         <main className="flex-1 p-4 md:p-8 overflow-y-auto">
             {activeTab === 'profile' && (
                 <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4">
                     <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                         <div className="h-32 bg-gradient-to-r from-brand-blue to-teal-600"></div>
                         <div className="px-8 pb-8">
                             <div className="relative flex justify-between items-end -mt-12 mb-6">
                                 <div className="w-24 h-24 rounded-full border-4 border-white bg-slate-200 flex items-center justify-center text-3xl font-bold text-slate-500 shadow-md">
                                     {client.name.charAt(0)}
                                 </div>
                                 <div className="flex gap-3">
                                     <button onClick={handleLogout} className="bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded-lg font-bold text-sm hover:bg-slate-50 flex items-center gap-2">
                                         <LogOut className="w-4 h-4"/> Déconnexion
                                     </button>
                                 </div>
                             </div>
                             <div>
                                 <h2 className="text-2xl font-bold text-slate-800">{client.name}</h2>
                                 <p className="text-slate-500 flex items-center gap-1 text-sm mt-1"><MapPin className="w-3 h-3"/> {client.city}</p>
                             </div>
                         </div>
                     </div>

                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                         <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                             <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2 border-b border-slate-100 pb-2">
                                 <User className="w-5 h-5 text-brand-blue"/> Coordonnées
                             </h3>
                             <div className="space-y-4 text-sm">
                                 <div>
                                     <label className="block text-xs font-bold text-slate-400 uppercase">Email</label>
                                     <div className="flex items-center gap-2 text-slate-700 font-medium">
                                         <Mail className="w-4 h-4 text-slate-400"/> {client.email}
                                     </div>
                                 </div>
                                 <div>
                                     <label className="block text-xs font-bold text-slate-400 uppercase">Téléphone</label>
                                     <div className="flex items-center gap-2 text-slate-700 font-medium">
                                         <Phone className="w-4 h-4 text-slate-400"/> {client.phone}
                                     </div>
                                 </div>
                                 <div>
                                     <label className="block text-xs font-bold text-slate-400 uppercase">Adresse</label>
                                     <div className="flex items-center gap-2 text-slate-700 font-medium">
                                         <MapPin className="w-4 h-4 text-slate-400"/> {client.address}
                                     </div>
                                 </div>
                             </div>
                         </div>

                         <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                             <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2 border-b border-slate-100 pb-2">
                                 <Award className="w-5 h-5 text-yellow-500"/> Fidélité & Abonnement
                             </h3>
                             <div className="grid grid-cols-2 gap-4">
                                 <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 text-center">
                                     <span className="text-xs font-bold text-blue-600 uppercase block mb-1">Abonnement</span>
                                     <span className="font-bold text-slate-800 flex items-center justify-center gap-1">
                                         <Package className="w-4 h-4 text-brand-blue"/> {client.pack}
                                     </span>
                                 </div>
                                 <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-100 text-center">
                                     <span className="text-xs font-bold text-yellow-700 uppercase block mb-1">Heures Offertes</span>
                                     <span className="font-bold text-slate-800 text-xl flex items-center justify-center gap-1">
                                         <Star className="w-4 h-4 text-yellow-500 fill-yellow-500"/> {client.loyaltyHoursAvailable}h
                                     </span>
                                 </div>
                             </div>
                             <div className="mt-4 pt-4 border-t border-slate-100">
                                 <p className="text-xs text-slate-500 italic text-center">
                                     Continuez à consommer des packs pour gagner plus d'heures gratuites !
                                 </p>
                             </div>
                         </div>
                     </div>
                 </div>
             )}

             {activeTab === 'planning' && (
                 <div className="space-y-6">
                     <h2 className="text-2xl font-bold text-slate-800">Mon Planning</h2>
                     <div className="space-y-4">
                         {clientMissions.map(m => {
                                 const cancelable = canCancelMission(m);
                                 return (
                                     <div key={m.id} className={`bg-white p-6 rounded-xl border-l-4 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ${m.status === 'cancelled' ? 'border-red-400 opacity-60' : m.status === 'completed' ? 'border-green-500' : 'border-brand-blue'}`}>
                                         <div className="flex-1">
                                             <div className="flex items-center gap-2 mb-1">
                                                 <span className="font-bold text-lg text-slate-800">{m.service}</span>
                                                 {m.status === 'completed' && <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full font-bold">Terminé</span>}
                                                 {m.status === 'cancelled' && <span className="bg-red-100 text-red-800 text-xs px-2 py-1 rounded-full font-bold">Annulé</span>}
                                                 {m.status === 'planned' && <span className="bg-orange-100 text-orange-800 text-xs px-2 py-1 rounded-full font-bold">Prévu</span>}
                                             </div>
                                             <div className="text-slate-500 text-sm flex flex-col gap-1 mb-2">
                                                 <span className="flex items-center gap-2"><Calendar className="w-4 h-4"/> {m.date} à {m.startTime}</span>
                                                 <span className="flex items-center gap-2"><User className="w-4 h-4"/> Intervenant: <span className="font-bold text-slate-700">{m.providerName || 'À confirmer'}</span></span>
                                             </div>
                                             {/* Pack Info */}
                                             <div className="text-xs bg-blue-50 text-blue-700 px-3 py-2 rounded-lg border border-blue-100 w-fit">
                                                 <span className="font-bold">Pack associé:</span> {client.pack}
                                             </div>
                                             
                                             {/* Report Photos Preview */}
                                             {m.status === 'completed' && m.endPhotos && m.endPhotos.length > 0 && (
                                                 <div className="mt-3">
                                                     <p className="text-xs font-bold text-slate-600 mb-1 flex items-center gap-1"><Camera className="w-3 h-3"/> Photos de fin de chantier</p>
                                                     <div className="flex gap-2 overflow-x-auto pb-2">
                                                         {m.endPhotos.map((url, i) => (
                                                             <div key={i} className="w-16 h-16 shrink-0 rounded-lg overflow-hidden border border-slate-200 cursor-pointer hover:opacity-80 transition" onClick={() => setLightboxImage(url)}>
                                                                 <img src={url} className="w-full h-full object-cover" alt="Preuve" />
                                                             </div>
                                                         ))}
                                                     </div>
                                                     <button 
                                                        onClick={() => handleDownloadAllImages(m.endPhotos!)}
                                                        className="text-xs text-brand-blue font-bold hover:underline flex items-center gap-1 mt-1"
                                                     >
                                                         <Download className="w-3 h-3"/> Télécharger toutes les photos
                                                     </button>
                                                 </div>
                                             )}
                                         </div>
                                         <div className="flex flex-col gap-2 items-end w-full md:w-auto">
                                             {m.status === 'planned' && (
                                                 <>
                                                    {cancelable ? (
                                                        <button onClick={() => handleCancelMission(m.id)} className="w-full md:w-auto text-red-500 text-sm font-bold border border-red-200 px-4 py-2 rounded-lg hover:bg-red-50 transition">Annuler RDV</button>
                                                    ) : (
                                                        <div className="text-center md:text-right bg-red-50 p-2 rounded-lg border border-red-100">
                                                            <span className="text-xs font-bold text-red-600 block mb-1 flex items-center gap-1"><AlertCircle className="w-3 h-3"/> Annulation impossible</span>
                                                            <p className="text-[10px] text-red-400">Moins de 48h avant l'intervention.</p>
                                                        </div>
                                                    )}
                                                 </>
                                             )}
                                         </div>
                                     </div>
                                 );
                             })}
                         {clientMissions.length === 0 && <p className="text-center text-slate-400 py-10">Aucun rendez-vous à venir.</p>}
                     </div>
                 </div>
             )}

             {activeTab === 'docs' && (
                 <div className="space-y-6">
                     <h2 className="text-2xl font-bold text-slate-800">Mes Documents</h2>
                     
                     <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                         <table className="w-full text-sm text-left">
                             <thead className="bg-slate-50 text-xs uppercase text-slate-500 border-b border-slate-100">
                                 <tr>
                                     <th className="px-6 py-4">Date</th>
                                     <th className="px-6 py-4">Référence</th>
                                     <th className="px-6 py-4">Type</th>
                                     <th className="px-6 py-4 text-right">Montant</th>
                                     <th className="px-6 py-4 text-center">Statut</th>
                                     <th className="px-6 py-4 text-right">Actions</th>
                                 </tr>
                             </thead>
                             <tbody className="divide-y divide-slate-50">
                                 {clientDocs.length === 0 ? (
                                     <tr><td colSpan={6} className="p-8 text-center text-slate-400">Aucun document.</td></tr>
                                 ) : (
                                     clientDocs.map(doc => (
                                         <tr key={doc.id} className="hover:bg-slate-50">
                                             <td className="px-6 py-4 text-slate-500">{doc.date}</td>
                                             <td className="px-6 py-4 font-bold text-slate-700">{doc.ref}</td>
                                             <td className="px-6 py-4">{doc.type}</td>
                                             <td className="px-6 py-4 text-right font-bold">{doc.totalTTC.toFixed(2)} €</td>
                                             <td className="px-6 py-4 text-center">
                                                 {doc.status === 'sent' && <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded-full text-xs font-bold">À signer</span>}
                                                 {doc.status === 'signed' && <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-bold">Signé</span>}
                                                 {doc.status === 'paid' && <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-bold">Payé</span>}
                                                 {doc.status === 'pending' && <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full text-xs font-bold">À régler</span>}
                                                 {doc.status === 'converted' && <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded-full text-xs font-bold">Facturé</span>}
                                                 {doc.status === 'rejected' && <span className="bg-red-100 text-red-800 px-2 py-1 rounded-full text-xs font-bold">Refusé</span>}
                                             </td>
                                             <td className="px-6 py-4 text-right flex justify-end gap-2">
                                                 <button onClick={() => handleDownloadInvoice(doc)} className="p-1 text-slate-400 hover:text-brand-blue" title="Télécharger PDF"><Download className="w-4 h-4"/></button>
                                                 
                                                 {doc.type === 'Devis' && doc.status === 'sent' && (
                                                     <button onClick={() => openQuoteModal(doc.id)} className="bg-brand-orange text-white text-xs font-bold px-3 py-1 rounded shadow-sm hover:bg-orange-600 flex items-center gap-1">
                                                         <PenTool className="w-3 h-3" /> Signer
                                                     </button>
                                                 )}
                                                 
                                                 {doc.type === 'Devis' && doc.status === 'signed' && (
                                                     <button onClick={handleDownloadContract} className="bg-green-600 text-white text-xs font-bold px-3 py-1 rounded shadow-sm hover:bg-green-700 flex items-center gap-1">
                                                         <FileSignature className="w-3 h-3" /> Contrat
                                                     </button>
                                                 )}

                                                 {doc.type === 'Facture' && (
                                                     <button 
                                                        onClick={() => handleRequestInvoice(doc.id)} 
                                                        disabled={doc.status === 'paid' || doc.status === 'pending' || doc.status === 'converted'}
                                                        className={`text-xs font-bold ${doc.status === 'paid' ? 'text-slate-400 cursor-not-allowed' : 'text-brand-blue hover:underline'}`}
                                                     >
                                                         {doc.status === 'paid' ? 'Facture Dispo' : client.hasLeftReview ? 'Réclamer' : 'Avis & Facture'}
                                                     </button>
                                                 )}
                                             </td>
                                         </tr>
                                     ))
                                 )}
                             </tbody>
                         </table>
                     </div>
                 </div>
             )}

             {activeTab === 'messages' && (
                 <div className="h-full flex flex-col bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                     <div className="p-4 border-b border-slate-100 bg-slate-50">
                         <h2 className="font-bold text-slate-700">Messagerie Sécurisée</h2>
                         <p className="text-xs text-slate-500">En direct avec le secrétariat</p>
                     </div>
                     <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
                         {clientMessages.length === 0 ? (
                             <p className="text-center text-slate-400 mt-10">Aucun message.</p>
                         ) : (
                             clientMessages.map(msg => (
                                 <div key={msg.id} className={`flex ${msg.sender === 'client' ? 'justify-end' : 'justify-start'}`}>
                                     <div className={`max-w-[80%] p-3 rounded-xl shadow-sm text-sm ${msg.sender === 'client' ? 'bg-brand-blue text-white rounded-tr-none' : 'bg-white text-slate-700 border border-slate-200 rounded-tl-none'}`}>
                                         <p>{msg.text}</p>
                                         <p className={`text-[10px] mt-1 text-right ${msg.sender === 'client' ? 'text-blue-200' : 'text-slate-400'}`}>{new Date(msg.date).toLocaleString()}</p>
                                     </div>
                                 </div>
                             ))
                         )}
                         <div ref={messagesEndRef} />
                     </div>
                     <form onSubmit={handleSendMessage} className="p-4 bg-white border-t border-slate-100 flex gap-2">
                         <input 
                             type="text" 
                             className="flex-1 border border-slate-300 rounded-lg px-4 py-2 text-sm outline-none focus:border-brand-blue"
                             placeholder="Votre message..."
                             value={messageInput}
                             onChange={(e) => setMessageInput(e.target.value)}
                         />
                         <button type="submit" className="bg-brand-blue text-white p-2 rounded-lg hover:bg-teal-700 transition disabled:opacity-50" disabled={!messageInput.trim()}>
                             <Send className="w-5 h-5" />
                         </button>
                     </form>
                 </div>
             )}

             {activeTab === 'live' && (
                 <div className="h-full flex flex-col items-center justify-center bg-slate-900 rounded-xl shadow-lg overflow-hidden relative">
                     {isLive ? (
                         <div className="w-full h-full flex flex-col">
                             <div className="absolute top-4 left-4 z-10 bg-red-600 text-white px-3 py-1 rounded-full text-xs font-bold animate-pulse flex items-center gap-2">
                                 <span className="w-2 h-2 bg-white rounded-full"></span> DIRECT
                             </div>
                             <div className="absolute top-4 right-4 z-10 bg-black/50 text-white px-3 py-1 rounded-full text-xs flex items-center gap-2">
                                 <Lock className="w-3 h-3 text-green-400" /> Flux Sécurisé
                             </div>
                             <div className="flex-1 flex items-center justify-center bg-black">
                                 {/* Simulated Video Stream Receiver */}
                                 <div className="text-white text-center">
                                     <Wifi className="w-16 h-16 mx-auto mb-4 text-green-500 animate-pulse" />
                                     <h3 className="text-xl font-bold">Intervention en cours</h3>
                                     <p className="text-sm text-slate-400">Connexion établie avec l'intervenant.</p>
                                 </div>
                             </div>
                         </div>
                     ) : (
                         <div className="text-center text-slate-500">
                             <Wifi className="w-16 h-16 mx-auto mb-4 opacity-20" />
                             <h3 className="text-xl font-bold text-slate-400">Hors Ligne</h3>
                             <p className="text-sm">Aucun flux vidéo actif pour le moment.</p>
                         </div>
                     )}
                 </div>
             )}
         </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <div className="md:hidden bg-white border-t border-slate-200 flex justify-around p-2 pb-safe z-30 shrink-0">
           <button onClick={() => setActiveTab('planning')} className={`flex flex-col items-center p-2 rounded-lg transition ${activeTab === 'planning' ? 'text-brand-blue' : 'text-slate-400'}`}>
               <Calendar className="w-6 h-6" />
               <span className="text-[10px] font-bold mt-1">Planning</span>
           </button>
           <button onClick={() => setActiveTab('docs')} className={`flex flex-col items-center p-2 rounded-lg transition ${activeTab === 'docs' ? 'text-brand-blue' : 'text-slate-400'}`}>
               <FileText className="w-6 h-6" />
               <span className="text-[10px] font-bold mt-1">Docs</span>
           </button>
           <button onClick={() => setActiveTab('messages')} className={`flex flex-col items-center p-2 rounded-lg transition ${activeTab === 'messages' ? 'text-brand-blue' : 'text-slate-400'}`}>
               <MessageSquare className="w-6 h-6" />
               <span className="text-[10px] font-bold mt-1">Chat</span>
           </button>
           <button onClick={() => setActiveTab('profile')} className={`flex flex-col items-center p-2 rounded-lg transition ${activeTab === 'profile' ? 'text-brand-blue' : 'text-slate-400'}`}>
               <User className="w-6 h-6" />
               <span className="text-[10px] font-bold mt-1">Profil</span>
           </button>
      </div>

      {/* QUOTE SIGNATURE MODAL */}
      {quoteModalOpen && selectedQuote && selectedContract && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
                  <div className="p-4 border-b bg-cream-50 flex justify-between items-center">
                      <h3 className="font-serif font-bold text-xl text-slate-800">Signature du Devis {selectedQuote.ref}</h3>
                      <button onClick={() => setQuoteModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full"><X className="w-5 h-5 text-slate-500" /></button>
                  </div>
                  
                  <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
                      {/* Document Viewer */}
                      <div className="flex-1 bg-slate-100 p-6 overflow-y-auto border-r border-slate-200">
                          <div className="bg-white shadow-sm p-8 min-h-full text-xs md:text-sm font-serif text-slate-800 leading-relaxed">
                              <div className="flex justify-between mb-8 border-b pb-4">
                                  <div className="w-20">
                                      <img src={LOGO_NORMAL} alt="Logo" className="w-full" />
                                  </div>
                                  <div className="text-right">
                                      <h1 className="font-bold text-xl uppercase text-brand-blue">{selectedContract.name}</h1>
                                      <p>Réf: {selectedQuote.ref}</p>
                                  </div>
                              </div>
                              
                              <div className="mb-6">
                                  <h4 className="font-bold border-b border-slate-300 mb-2">Entre les soussignés :</h4>
                                  <p><strong>PRESTA SERVICES ANTILLES</strong> (Le Prestataire)</p>
                                  <p>Et</p>
                                  <p><strong>{client.name}</strong> (Le Client)</p>
                              </div>

                              <div className="mb-6 whitespace-pre-wrap">
                                  {selectedContract.content}
                              </div>

                              {/* Signatures on Contract */}
                              <div className="mt-8 flex justify-between border-t pt-4">
                                  <div className="w-1/2 pr-4 border-r">
                                      <p className="font-bold mb-2">Pour l'Entreprise :</p>
                                      {selectedContract.status === 'active' && (
                                          <div className="text-green-600 font-bold text-xs uppercase border-2 border-green-600 p-2 inline-block rounded">
                                              Validé & Signé
                                          </div>
                                      )}
                                  </div>
                                  <div className="w-1/2 pl-4">
                                      <p className="font-bold mb-2">Pour le Client (Lu et approuvé) :</p>
                                      {/* This area will be filled after signature */}
                                      <div className="h-20 border border-dashed border-slate-300 bg-slate-50 flex items-center justify-center text-slate-400 italic">
                                          (Signature apposée électroniquement)
                                      </div>
                                  </div>
                              </div>

                              {/* Legal Checkbox */}
                              <div className="mt-8 p-4 bg-blue-50 border border-blue-100 rounded-lg">
                                  <label className="flex items-start gap-3 cursor-pointer">
                                      <input 
                                          type="checkbox" 
                                          className="mt-1 w-5 h-5 text-brand-blue rounded"
                                          checked={termsAccepted}
                                          onChange={(e) => setTermsAccepted(e.target.checked)}
                                      />
                                      <span className="text-sm font-bold text-slate-700">
                                          Je reconnais avoir pris connaissance des conditions générales de vente et j'accepte les termes du contrat.
                                          Je m'engage à régler le montant de {selectedQuote.totalTTC.toFixed(2)} € TTC.
                                      </span>
                                  </label>
                              </div>
                          </div>
                      </div>

                      {/* Signature Pad */}
                      <div className="w-full md:w-1/3 bg-white flex flex-col p-6">
                          <h4 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
                              <PenTool className="w-4 h-4" /> Zone de Signature
                          </h4>
                          <p className="text-xs text-slate-500 mb-2">Veuillez signer dans le cadre ci-dessous.</p>
                          
                          <div className="flex-1 border-2 border-dashed border-slate-300 rounded-xl bg-slate-50 relative touch-none mb-4">
                              <canvas 
                                  ref={canvasRef}
                                  className="absolute inset-0 w-full h-full cursor-crosshair"
                                  width={300}
                                  height={400}
                                  onMouseDown={startDrawing}
                                  onMouseMove={draw}
                                  onMouseUp={stopDrawing}
                                  onMouseLeave={stopDrawing}
                                  onTouchStart={startDrawing}
                                  onTouchMove={draw}
                                  onTouchEnd={stopDrawing}
                              />
                              {!isDrawing && (
                                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-10">
                                      <span className="text-4xl font-serif italic text-slate-400">Signer ici</span>
                                  </div>
                              )}
                              <button 
                                  onClick={clearCanvas} 
                                  className="absolute top-2 right-2 text-xs bg-white border px-2 py-1 rounded shadow-sm hover:bg-slate-100"
                              >
                                  Effacer
                              </button>
                          </div>

                          <div className="flex flex-col gap-3">
                              <button 
                                  onClick={submitSignature}
                                  disabled={!termsAccepted}
                                  className="w-full py-3 bg-brand-blue text-white font-bold rounded-xl hover:bg-teal-700 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition"
                              >
                                  Signer et Valider
                              </button>
                              <button 
                                  onClick={() => handleRefuse(selectedQuote.id)}
                                  className="w-full py-2 text-red-500 font-bold hover:bg-red-50 rounded-xl border border-transparent hover:border-red-100 transition"
                              >
                                  Refuser le devis
                              </button>
                          </div>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* REVIEW MODAL */}
      {reviewModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4">
              <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 text-center animate-in fade-in zoom-in duration-200">
                  <div className="w-16 h-16 bg-yellow-100 text-yellow-500 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Star className="w-8 h-8 fill-yellow-500" />
                  </div>
                  <h3 className="text-2xl font-serif font-bold text-slate-800 mb-2">Votre avis compte !</h3>
                  <p className="text-slate-500 text-sm mb-6">
                      Pour accéder à votre facture, merci de laisser une note sur votre dernière prestation.
                  </p>

                  <div className="flex justify-center gap-2 mb-6">
                      {[1, 2, 3, 4, 5].map(star => (
                          <button 
                              key={star} 
                              onClick={() => setReviewRating(star)}
                              className="focus:outline-none transition-transform hover:scale-110"
                          >
                              <Star 
                                  className={`w-8 h-8 ${star <= reviewRating ? 'text-yellow-400 fill-yellow-400' : 'text-slate-200'}`} 
                              />
                          </button>
                      ))}
                  </div>
                  
                  <textarea 
                      className="w-full border border-slate-200 rounded-lg p-3 mb-6 bg-slate-50 text-sm"
                      rows={3}
                      placeholder="Un commentaire ? (Optionnel)"
                      value={reviewComment}
                      onChange={(e) => setReviewComment(e.target.value)}
                  ></textarea>

                  <button 
                      onClick={submitReview}
                      className="w-full bg-brand-blue text-white font-bold py-3 rounded-xl shadow-lg hover:bg-teal-700 transition"
                  >
                      Envoyer et Débloquer Facture
                  </button>
                  <button 
                      onClick={() => setReviewModalOpen(false)}
                      className="mt-3 text-sm text-slate-400 hover:text-slate-600"
                  >
                      Annuler
                  </button>
              </div>
          </div>
      )}

      {/* ALL NOTIFICATIONS MODAL */}
      {showAllNotifsModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg h-[80vh] flex flex-col animate-in fade-in zoom-in duration-200">
                  <div className="p-4 border-b bg-cream-50 flex justify-between items-center shrink-0">
                      <h3 className="font-bold text-lg text-slate-800">Toutes les notifications</h3>
                      <button onClick={() => setShowAllNotifsModal(false)} className="p-2 rounded-full hover:bg-slate-200 transition"><X className="w-5 h-5 text-slate-500"/></button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-0">
                      {allClientNotifs.length === 0 ? (
                          <div className="p-8 text-center text-slate-400 flex flex-col items-center">
                              <Bell className="w-12 h-12 mb-2 opacity-20" />
                              <p>Aucune notification</p>
                          </div>
                      ) : (
                          allClientNotifs.map(n => (
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
                  src={lightboxImage} 
                  alt="Full size" 
                  className="max-w-full max-h-full object-contain rounded-lg shadow-2xl animate-in zoom-in duration-200"
                  onClick={(e) => e.stopPropagation()} // Prevent closing when clicking image
              />
          </div>
      )}
    </div>
  );
};

export default ClientPortal;
