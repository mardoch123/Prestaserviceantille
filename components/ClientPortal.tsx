import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useData, LOGO_NORMAL } from '../context/DataContext';
import { Contract } from '../types';
import QRCodeManager from './QRCodeManager';
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
    Menu,
    Wifi,
    Lock,
    FileSignature,
    AlertTriangle,
    LogOut,
    MapPin,
    Phone,
    Mail,
    Award,
    Package,
    AlertCircle,
    Bell,
    ArrowRight,
    Camera,
    Video,
    Play,
    Loader,
    QrCode,
    History,
    Search,
    RotateCcw,
    Clock
} from 'lucide-react';

const ClientPortal: React.FC = () => {
    const {
        clients,
        documents,
        missions,
        simulatedClientId,
        signQuoteWithData,
        alertPopup, setAlertPopup,
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
        generateContractFromTemplate,
        downloadContract,
        providers,
        logout,
        currentUser,
        extendReadingSession,
        endReadingSession,
        videoRecordings,
        getVideoRecordings
    } = useData();

    // Determine client ID either from simulation or real login
    const activeClientId = simulatedClientId || (currentUser?.role === 'client' ? currentUser.relatedEntityId : null);
    const client = clients.find(c => c.id === activeClientId);

    // Get client's video recordings for replay
    const clientVideoRecordings = client ? getVideoRecordings(client.id) : [];

    // Document Filters
    const [documentFilter, setDocumentFilter] = useState<string>('all');
    const [documentStatusFilter, setDocumentStatusFilter] = useState<string>('all');
    const [documentSearch, setDocumentSearch] = useState<string>('');

    // Planning Filters
    const [planningStatusFilter, setPlanningStatusFilter] = useState<string>('all');
    const [planningSearch, setPlanningSearch] = useState<string>('');
    const [planningDateFilter, setPlanningDateFilter] = useState<string>('all');

    // Get client's documents
    const clientDocs = client ? documents.filter(d => d.clientId === client.id) : [];

    // Get client missions
    const clientMissions = client ? missions.filter(m => m.clientId === client.id || m.clientName === client.name) : [];

    // Filter documents
    const filteredClientDocs = useMemo(() => {
        return clientDocs.filter((doc: any) => {
            const matchesType = documentFilter === 'all' || doc.type === documentFilter;
            const matchesStatus = documentStatusFilter === 'all' || doc.status === documentStatusFilter;
            const matchesSearch = documentSearch === '' ||
                doc.ref.toLowerCase().includes(documentSearch.toLowerCase()) ||
                doc.type.toLowerCase().includes(documentSearch.toLowerCase());

            return matchesType && matchesStatus && matchesSearch;
        });
    }, [clientDocs, documentFilter, documentStatusFilter, documentSearch]);

    // Filter planning missions
    const filteredClientMissions = useMemo(() => {
        return clientMissions.filter(m => {
            const matchesStatus = planningStatusFilter === 'all' || m.status === planningStatusFilter;
            const matchesSearch = planningSearch === '' ||
                m.service.toLowerCase().includes(planningSearch.toLowerCase()) ||
                (m.providerName && m.providerName.toLowerCase().includes(planningSearch.toLowerCase())) ||
                m.date.includes(planningSearch);

            const today = new Date().toISOString().split('T')[0];
            let matchesDate = true;

            if (planningDateFilter === 'upcoming') {
                matchesDate = m.date >= today;
            } else if (planningDateFilter === 'past') {
                matchesDate = m.date < today;
            }
            // 'all' means no date filtering

            return matchesStatus && matchesSearch && matchesDate;
        });
    }, [clientMissions, planningStatusFilter, planningSearch, planningDateFilter]);

    const [activeTab, setActiveTab] = useState<'planning' | 'docs' | 'messages' | 'live' | 'profile' | 'qr-scans'>('planning');
    const [messageInput, setMessageInput] = useState('');
    const [toast, setToast] = useState<{ show: boolean; message: string; type?: 'success' | 'error' | 'warning' }>({ show: false, message: '', type: 'success' });

    // États pour la messagerie en temps réel
    const [isTyping, setIsTyping] = useState(false);
    const [adminTyping, setAdminTyping] = useState(false);
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const showToast = (message: string, type: 'success' | 'error' | 'warning' = 'success') => {
        setToast({ show: true, message, type });
        setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);
    };

    // Notification State
    const [showNotifDropdown, setShowNotifDropdown] = useState(false);
    const [showAllNotifsModal, setShowAllNotifsModal] = useState(false);
    const [showMobileNotifModal, setShowMobileNotifModal] = useState(false);

    // Mobile Menu State
    const [showMobileMenu, setShowMobileMenu] = useState(false);

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
    const [hasSignature, setHasSignature] = useState(false);
    const [showSignatureModal, setShowSignatureModal] = useState(false);
    const [showNotifications, setShowNotifications] = useState(false);

    // Chat Scroll
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (activeTab === 'messages') {
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

    // Get client missions and other data
    // All notifications
    const allClientNotifs = notifications.filter(n => n.targetUserType === 'client' && (!n.targetUserId || n.targetUserId === client.id));
    const unreadClientNotifs = allClientNotifs.filter(n => !n.read);
    const clientMessages = messages.filter(m => m.clientId === client.id);
    const isLive = activeStream && activeStream.clientId === client.id;

    const handleLogout = () => {
        logout(true);
    };

    const handleNotificationClick = (notif: any) => {
        markNotificationRead(notif.id);
        if (notif.link && notif.link.startsWith('mission:')) {
            setActiveTab('planning');
        } else if (notif.link === 'tab:messages') {
            setActiveTab('messages');
        } else if (notif.link === 'tab:live') {
            // Si la notification pointe vers un appel en cours, ouvrir l'onglet live
            setActiveTab('live');
        } else if (notif.type === 'message' && (notif.title.includes('devis') || notif.title.includes('Devis') || notif.message.includes('devis') || notif.message.includes('Devis'))) {
            // Si c'est une notification concernant un devis, ouvrir la page des documents
            setActiveTab('docs');
        } else if (notif.link && notif.link.startsWith('document:')) {
            // Si le lien pointe vers un document spécifique, ouvrir la page des documents
            setActiveTab('docs');
        }
        setShowNotifDropdown(false);
        setShowAllNotifsModal(false);
    };

    const openQuoteModal = (docId: string) => {
        setSelectedQuoteId(docId);
        setTermsAccepted(false);
        setQuoteModalOpen(true);
        extendReadingSession(); // Prolonger la session pendant lecture
        setTimeout(() => clearCanvas(), 100);
    };

    const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        setIsDrawing(true);
        setHasSignature(true); // Marquer qu'une signature a été apposée
        const rect = canvas.getBoundingClientRect();
        const x = ('touches' in e) ? e.touches[0].clientX - rect.left : (e as React.MouseEvent).clientX - rect.left;
        const y = ('touches' in e) ? e.touches[0].clientY - rect.top : (e as React.MouseEvent).clientY - rect.top;
        ctx.beginPath();
        ctx.moveTo(x, y);
    };

    const draw = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isDrawing) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const rect = canvas.getBoundingClientRect();
        const x = ('touches' in e) ? e.touches[0].clientX - rect.left : (e as React.MouseEvent).clientX - rect.left;
        const y = ('touches' in e) ? e.touches[0].clientY - rect.top : (e as React.MouseEvent).clientY - rect.top;
        ctx.lineTo(x, y);
        ctx.stroke();
    };

    const stopDrawing = () => { setIsDrawing(false); };
    const clearCanvas = () => {
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            ctx?.clearRect(0, 0, canvas.width, canvas.height);
            setHasSignature(false); // Réinitialiser l'état de signature
        }
    };

    const submitSignature = async () => {
        if (!termsAccepted) {
            alert("Veuillez accepter les conditions du contrat avant de signer.");
            return;
        }

        if (!hasSignature) {
            alert("Veuillez apposer votre signature dans la zone prévue à cet effet.");
            return;
        }

        // Vérifier si une prestation est en cours
        const ongoingMissions = clientMissions.filter(m => m.status === 'in_progress');
        if (ongoingMissions.length > 0) {
            alert("Une prestation est actuellement en cours. Vous ne pouvez signer le devis que lorsque la prestation est terminée.");
            return;
        }

        if (selectedQuoteId && canvasRef.current) {
            const dataUrl = canvasRef.current.toDataURL();
            try {
                await signQuoteWithData(selectedQuoteId, dataUrl);
                setQuoteModalOpen(false);
                endReadingSession(); // Terminer la session de lecture
                showToast('Devis signé ! Vos créneaux sont réservés.');
                setShowSignatureModal(false); // Fermer le modal sur mobile
            } catch (error) {
                console.error('Erreur lors de la signature:', error);
                // Ne pas afficher de message d'erreur ici car la notification est déjà gérée dans signQuoteWithData
            }
        }
    };

    const handleRefuse = (docId: string) => {
        if (window.confirm("Êtes-vous sûr de refuser ce devis ? Cela annulera la proposition.")) {
            refuseQuote(docId);
            setQuoteModalOpen(false);
            endReadingSession(); // Terminer la session de lecture
            showToast('Devis refusé. Le secrétariat a été notifié.');
        }
    };

    const handleDownloadInvoice = (doc: any) => {
        // Vérifier si la prestation est terminée avant de demander un avis
        const clientCompletedMissions = clientMissions.filter(m => m.status === 'completed');
        const hasCompletedPrestation = clientCompletedMissions.length > 0;

        // Si la prestation n'est pas terminée, afficher un message d'avertissement
        if (!hasCompletedPrestation) {
            showToast('Le téléchargement de la facture sera disponible après la fin de votre prestation.', 'warning');
            return;
        }

        // Si la prestation est terminée, permettre le téléchargement direct
        // et proposer de laisser un avis si ce n'est pas déjà fait
        if (!client.hasLeftReview && hasCompletedPrestation) {
            // Proposer de laisser un avis mais ne pas bloquer le téléchargement
            showToast('Téléchargement de la facture en cours... N\'oubliez pas de laisser un avis !');
        } else {
            showToast('Téléchargement de la facture en cours...');
        }

        // Generate proper PDF using print window
        const printWindow = window.open('', '', 'width=800,height=600');
        if (printWindow) {
            printWindow.document.write(`
          <html>
            <head>
              <title>FACTURE - ${doc.ref}</title>
              <style>
                body { font-family: 'Times New Roman', serif; font-size: 12pt; line-height: 1.5; padding: 40px; }
                .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 20px; }
                .company-info { margin-bottom: 20px; }
                .invoice-info { margin-bottom: 20px; }
                .client-info { margin-bottom: 20px; }
                .amount-info { margin: 20px 0; }
                .total { font-weight: bold; font-size: 14pt; margin-top: 10px; }
                .footer { margin-top: 50px; font-size: 10pt; color: #666; }
              </style>
            </head>
            <body>
              <div class="header">
                <h2>FACTURE</h2>
                <p><strong>N° ${doc.ref}</strong></p>
                <p>Date: ${doc.date}</p>
              </div>
              
              <div class="company-info">
                <h3>PRESTA SERVICES ANTILLES</h3>
                <p>31 Résidence L'Autre Bord – 97220 La Trinité</p>
                <p>N° SAP : SAP944789700</p>
                <p>Email: prestaservicesantilles.rh@gmail.com</p>
                <p>Téléphone: 0696 06 15 94</p>
              </div>
              
              <div class="client-info">
                <h4>Client:</h4>
                <p><strong>${client.name}</strong></p>
                <p>${client.address || ''}</p>
                <p>${client.city || ''}</p>
                <p>Email: ${client.email}</p>
                <p>Téléphone: ${client.phone}</p>
              </div>
              
              <div class="invoice-info">
                <h4>Détails de la facture:</h4>
                <p>${doc.description || 'Service standard'}</p>
              </div>
              
              <div class="amount-info">
                <p>Montant HT: ${doc.totalHT.toFixed(2)} €</p>
                <p>TVA: ${((doc.totalTTC - doc.totalHT)).toFixed(2)} €</p>
                <p class="total">Montant TTC: ${doc.totalTTC.toFixed(2)} €</p>
              </div>
              
              <div class="footer">
                <p><strong>Conditions de paiement:</strong></p>
                <p>- Paiement à réception</p>
                <p>- Délai de paiement: 30 jours</p>
                <p>Statut: ${doc.status}</p>
                <br>
                <p>Contact pour toute question: prestaservicesantilles.rh@gmail.com - 0696 06 15 94</p>
              </div>
            </body>
          </html>
          `);
            printWindow.document.close();
            printWindow.print();
        }

        showToast('Facture téléchargée avec succès.');
    };

    const handleDownloadContract = () => {
        showToast('Téléchargement du contrat signé...');

        console.log('Searching contracts for client:', client.id);
        console.log('Available contracts:', contracts.map(c => ({ id: c.id, clientId: c.clientId, status: c.status, name: c.name })));

        // First try to find contract by clientId (new approach)
        let clientContract = contracts.find(c =>
            c.clientId === client.id &&
            (c.status === 'active' || c.status === 'pending_validation')
        );

        // If not found, try fallback approach by matching client name in contract name
        if (!clientContract) {
            console.log('Contract not found by clientId, trying name matching fallback');
            clientContract = contracts.find(c =>
                c.name && c.name.toLowerCase().includes(client.name.toLowerCase()) &&
                (c.status === 'active' || c.status === 'pending_validation')
            );
        }

        // If still not found, try any contract for this client
        if (!clientContract) {
            console.log('Contract not found by name matching, trying any contract with client info');
            clientContract = contracts.find(c => {
                // Check if contract content contains client information
                const contentLower = c.content.toLowerCase();
                const clientNameLower = client.name.toLowerCase();
                const clientEmailLower = client.email.toLowerCase();

                return (contentLower.includes(clientNameLower) || contentLower.includes(clientEmailLower)) &&
                    (c.status === 'active' || c.status === 'pending_validation');
            });
        }

        console.log('Found contract:', clientContract);

        if (!clientContract) {
            showToast('Aucun contrat trouvé pour votre compte. Les contrats sont créés automatiquement lors de la signature d\'un devis.', 'warning');
            return;
        }

        // Use the downloadContract function from DataContext
        downloadContract(clientContract);
        showToast('Contrat téléchargé avec succès.');
    };

    const handleRequestInvoice = (docId: string) => {
        // Vérifier si la prestation est terminée avant de demander un avis
        const clientCompletedMissions = clientMissions.filter(m => m.status === 'completed');
        const hasCompletedPrestation = clientCompletedMissions.length > 0;

        // Si la prestation n'est pas terminée, afficher un message d'avertissement
        if (!hasCompletedPrestation) {
            showToast('La demande de facture sera disponible après la fin de votre prestation.', 'warning');
            return;
        }

        // Si la prestation est terminée, permettre la demande directe
        // et proposer de laisser un avis si ce n'est pas déjà fait
        if (!client.hasLeftReview && hasCompletedPrestation) {
            // Proposer de laisser un avis mais ne pas bloquer la demande
            requestInvoice(docId);
            showToast('Demande de facture envoyée au secrétariat. N\'oubliez pas de laisser un avis !');
        } else {
            requestInvoice(docId);
            showToast('Demande de facture envoyée au secrétariat.');
        }
    };

    const submitReview = () => {
        submitClientReview(client.id, reviewRating, reviewComment);

        // Si une facture est en attente, la débloquer
        if (pendingInvoiceDocId) {
            requestInvoice(pendingInvoiceDocId);
            setPendingInvoiceDocId(null);
            showToast('Merci pour votre avis ! Facture débloquée.');
        } else {
            showToast('Merci pour votre avis ! Votre retour est précieux pour nous.');
        }

        setReviewModalOpen(false);
        setReviewRating(5);
        setReviewComment('');
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

    const getQuoteContract = (): (Contract | null) => {
        if (!selectedQuote) return null;
        // Afficher le devis en priorité, pas le contrat
        // Le contrat ne doit être accessible qu'après consultation du devis
        return null; // Forcer l'affichage du devis uniquement
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
                link.download = `Preuve_Mission_${i + 1}.jpg`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }, i * 300);
        });
    };

    return (
        <div className="h-full bg-slate-50 flex flex-col overflow-hidden font-sans relative">
            <div className={`fixed top-6 right-6 z-[100] transition-all duration-500 transform ${toast.show ? 'translate-y-0 opacity-100' : '-translate-y-10 opacity-0 pointer-events-none'}`}>
                <div className={`px-6 py-4 rounded-lg shadow-2xl flex items-center gap-3 border ${toast.type === 'error' ? 'bg-red-800 text-white border-red-700' :
                    toast.type === 'warning' ? 'bg-orange-800 text-white border-orange-700' :
                        'bg-green-800 text-white border-green-700'
                    }`}>
                    <div className={`p-1 rounded-full text-white ${toast.type === 'error' ? 'bg-red-500' :
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

            <header className="bg-white border-b border-slate-200 px-4 md:px-6 py-4 flex justify-between items-center shadow-sm z-10 shrink-0">
                <div className="flex items-center gap-4">
                    {/* Mobile Menu Button */}
                    <button
                        onClick={() => setShowMobileMenu(!showMobileMenu)}
                        className="md:hidden p-2 rounded-lg hover:bg-slate-100 transition"
                    >
                        {showMobileMenu ? <X className="w-6 h-6 text-slate-600" /> : <Menu className="w-6 h-6 text-slate-600" />}
                    </button>

                    <div className="w-10 h-10 rounded-full bg-brand-orange text-white flex items-center justify-center font-bold text-lg">
                        {client.name.charAt(0)}
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-slate-800">{client.name}</h1>
                        <p className="text-xs text-slate-500 hidden md:block">Bienvenue</p>
                    </div>
                </div>
                <div className="flex items-center gap-4">

                    {/* Notification Bell */}
                    <div className="relative">
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
                            {unreadClientNotifs.length > 0 && <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>}
                        </button>

                        {showNotifDropdown && (
                            <div className="absolute top-full right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] bg-white rounded-xl shadow-xl border border-slate-100 z-50 overflow-hidden md:right-0 md:left-auto left-0 right-0">
                                <div className="bg-slate-50 px-3 sm:px-4 py-2 sm:py-3 border-b border-slate-100 flex justify-between items-center">
                                    <span className="font-bold text-xs sm:text-sm text-slate-700">Notifications</span>
                                    <span className="text-xs text-slate-500">{unreadClientNotifs.length} nouvelles</span>
                                </div>
                                <div className="max-h-48 sm:max-h-64 overflow-y-auto">
                                    {allClientNotifs.length === 0 ? (
                                        <div className="p-3 sm:p-4 text-center text-xs text-slate-400">Aucune notification.</div>
                                    ) : (
                                        allClientNotifs.slice(0, 5).map(n => (
                                            <div key={n.id} onClick={() => handleNotificationClick(n)} className={`p-2 sm:p-3 border-b border-slate-50 cursor-pointer hover:bg-cream-50 transition ${!n.read ? 'bg-blue-50/50' : ''}`}>
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

            {/* Mobile Menu */}
            {showMobileMenu && (
                <div className="md:hidden bg-white border-b border-slate-200 shadow-lg z-20">
                    <nav className="p-4 space-y-2">
                        <button
                            onClick={() => { setActiveTab('planning'); setShowMobileMenu(false); }}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-bold transition-colors ${activeTab === 'planning' ? 'bg-brand-blue text-white' : 'text-slate-600 hover:bg-slate-50'}`}
                        >
                            <Calendar className="w-4 h-4" /> Mon Planning
                        </button>
                        <button
                            onClick={() => { setActiveTab('docs'); setShowMobileMenu(false); }}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-bold transition-colors ${activeTab === 'docs' ? 'bg-brand-blue text-white' : 'text-slate-600 hover:bg-slate-50'}`}
                        >
                            <FileText className="w-4 h-4" /> Devis & Factures
                        </button>
                        <button
                            onClick={() => { setActiveTab('messages'); setShowMobileMenu(false); }}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-bold transition-colors ${activeTab === 'messages' ? 'bg-brand-blue text-white' : 'text-slate-600 hover:bg-slate-50'}`}
                        >
                            <MessageSquare className="w-4 h-4" /> Messages
                        </button>
                        <button
                            onClick={() => { setActiveTab('qr-scans'); setShowMobileMenu(false); }}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-bold transition-colors ${activeTab === 'qr-scans' ? 'bg-brand-blue text-white' : 'text-slate-600 hover:bg-slate-50'}`}
                        >
                            <QrCode className="w-4 h-4" /> QR Code & Pointage
                        </button>
                        <button
                            onClick={() => { setActiveTab('profile'); setShowMobileMenu(false); }}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-bold transition-colors ${activeTab === 'profile' ? 'bg-brand-blue text-white' : 'text-slate-600 hover:bg-slate-50'}`}
                        >
                            <User className="w-4 h-4" /> Mon Profil
                        </button>
                        <button
                            onClick={() => { setActiveTab('live'); setShowMobileMenu(false); }}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-bold transition-colors relative ${activeTab === 'live' ? 'bg-red-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
                        >
                            <Wifi className={`w-4 h-4 ${isLive ? 'animate-pulse' : ''}`} /> Direct Vidéo
                            {isLive && <span className="absolute right-3 w-2 h-2 bg-green-400 rounded-full ring-2 ring-white animate-pulse"></span>}
                        </button>
                    </nav>
                </div>
            )}

            <div className="flex-1 flex overflow-hidden">
                <nav className="w-64 bg-white border-r border-slate-200 p-4 space-y-2 hidden md:block shrink-0">
                    <button onClick={() => setActiveTab('planning')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-bold transition-colors ${activeTab === 'planning' ? 'bg-brand-blue text-white' : 'text-slate-600 hover:bg-slate-50'}`}><Calendar className="w-4 h-4" /> Mon Planning</button>
                    <button onClick={() => setActiveTab('docs')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-bold transition-colors ${activeTab === 'docs' ? 'bg-brand-blue text-white' : 'text-slate-600 hover:bg-slate-50'}`}><FileText className="w-4 h-4" /> Devis & Factures</button>
                    <button onClick={() => setActiveTab('messages')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-bold transition-colors ${activeTab === 'messages' ? 'bg-brand-blue text-white' : 'text-slate-600 hover:bg-slate-50'}`}><MessageSquare className="w-4 h-4" /> Messages</button>
                    <button onClick={() => setActiveTab('qr-scans')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-bold transition-colors ${activeTab === 'qr-scans' ? 'bg-brand-blue text-white' : 'text-slate-600 hover:bg-slate-50'}`}><QrCode className="w-4 h-4" /> QR Code & Pointage</button>
                    <button onClick={() => setActiveTab('profile')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-bold transition-colors ${activeTab === 'profile' ? 'bg-brand-blue text-white' : 'text-slate-600 hover:bg-slate-50'}`}><User className="w-4 h-4" /> Mon Profil</button>
                    <button onClick={() => setActiveTab('live')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-bold transition-colors relative ${activeTab === 'live' ? 'bg-red-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}><Wifi className={`w-4 h-4 ${isLive ? 'animate-pulse' : ''}`} /> Direct Vidéo {isLive && <span className="absolute right-3 w-2 h-2 bg-green-400 rounded-full ring-2 ring-white animate-pulse"></span>}</button>
                </nav>

                <main className="flex-1 p-4 md:p-8 overflow-y-auto">
                    {activeTab === 'qr-scans' && (
                        <QRCodeManager />
                    )}
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
                                                <LogOut className="w-4 h-4" /> Déconnexion
                                            </button>
                                        </div>
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-bold text-slate-800">{client.name}</h2>
                                        <p className="text-slate-500 flex items-center gap-1 text-sm mt-1"><MapPin className="w-3 h-3" /> {client.city}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                                    <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2 border-b border-slate-100 pb-2">
                                        <User className="w-5 h-5 text-brand-blue" /> Coordonnées
                                    </h3>
                                    <div className="space-y-4 text-sm">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-400 uppercase">Email</label>
                                            <div className="flex items-center gap-2 text-slate-700 font-medium">
                                                <Mail className="w-4 h-4 text-slate-400" /> {client.email}
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-400 uppercase">Téléphone</label>
                                            <div className="flex items-center gap-2 text-slate-700 font-medium">
                                                <Phone className="w-4 h-4 text-slate-400" /> {client.phone}
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-400 uppercase">Adresse</label>
                                            <div className="flex items-center gap-2 text-slate-700 font-medium">
                                                <MapPin className="w-4 h-4 text-slate-400" /> {client.address}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                                    <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2 border-b border-slate-100 pb-2">
                                        <Award className="w-5 h-5 text-yellow-500" /> Fidélité & Abonnement
                                    </h3>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 text-center">
                                            <span className="text-xs font-bold text-blue-600 uppercase block mb-1">Abonnement</span>
                                            <span className="font-bold text-slate-800 flex items-center justify-center gap-1">
                                                <Package className="w-4 h-4 text-brand-blue" /> {packs.find(p => p.name === client.pack)?.name || client.pack || 'Non défini'}
                                            </span>
                                        </div>
                                        <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-100 text-center">
                                            <span className="text-xs font-bold text-yellow-700 uppercase block mb-1">Heures Offertes</span>
                                            <span className="font-bold text-slate-800 text-xl flex items-center justify-center gap-1">
                                                <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" /> {client.loyaltyHoursAvailable}h
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

                            {/* Filtres du planning */}
                            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                    {/* Recherche */}
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Recherche</label>
                                        <div className="relative">
                                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                                            <input
                                                type="text"
                                                placeholder="Service, intervenant..."
                                                value={planningSearch}
                                                onChange={(e) => setPlanningSearch(e.target.value)}
                                                className="w-full pl-10 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue focus:border-transparent"
                                            />
                                        </div>
                                    </div>

                                    {/* Filtre par statut */}
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Statut</label>
                                        <select
                                            value={planningStatusFilter}
                                            onChange={(e) => setPlanningStatusFilter(e.target.value)}
                                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue focus:border-transparent"
                                        >
                                            <option value="all">Tous les statuts</option>
                                            <option value="planned">Prévues</option>
                                            <option value="in_progress">En cours</option>
                                            <option value="completed">Terminées</option>
                                            <option value="cancelled">Annulées</option>
                                        </select>
                                    </div>

                                    {/* Filtre par date */}
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Période</label>
                                        <select
                                            value={planningDateFilter}
                                            onChange={(e) => setPlanningDateFilter(e.target.value)}
                                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue focus:border-transparent"
                                        >
                                            <option value="all">Toutes les dates</option>
                                            <option value="upcoming">À venir</option>
                                            <option value="past">Passées</option>
                                        </select>
                                    </div>

                                    {/* Bouton de réinitialisation */}
                                    <div className="flex items-end">
                                        <button
                                            onClick={() => {
                                                setPlanningStatusFilter('all');
                                                setPlanningSearch('');
                                                setPlanningDateFilter('all');
                                            }}
                                            className="w-full px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition text-sm font-medium flex items-center justify-center gap-2"
                                        >
                                            <RotateCcw className="w-4 h-4" />
                                            Réinitialiser
                                        </button>
                                    </div>
                                </div>

                                {/* Nombre de résultats */}
                                <div className="mt-3 text-xs text-slate-500">
                                    {filteredClientMissions.length} mission{filteredClientMissions.length > 1 ? 's' : ''} trouvée{filteredClientMissions.length > 1 ? 's' : ''}
                                </div>
                            </div>

                            <div className="space-y-4">
                                {filteredClientMissions.length === 0 ? (
                                    <div className="text-center py-10">
                                        <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                                        <p className="text-slate-400">Aucune mission trouvée.</p>
                                    </div>
                                ) : (
                                    filteredClientMissions.map(m => {
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
                                                        <span className="flex items-center gap-2"><Calendar className="w-4 h-4" /> {m.date} à {m.startTime}</span>
                                                        <span className="flex items-center gap-2"><User className="w-4 h-4" /> Intervenant: <span className="font-bold text-slate-700">{m.providerName || 'À confirmer'}</span></span>
                                                    </div>
                                                    {/* Pack Info */}
                                                    {(() => {
                                                        const associatedPack = packs.find(p => p.name === client.pack) || (client.pack && client.pack !== 'Non défini' ? { name: client.pack } : null);
                                                        return associatedPack && (
                                                            <div className="text-xs bg-blue-50 text-blue-700 px-3 py-2 rounded-lg border border-blue-100 w-fit">
                                                                <span className="font-bold">Pack associé:</span> {associatedPack.name}
                                                            </div>
                                                        );
                                                    })()}

                                                    {/* Report Photos Preview */}
                                                    {m.status === 'completed' && m.endPhotos && m.endPhotos.length > 0 && (
                                                        <div className="mt-3">
                                                            <p className="text-xs font-bold text-slate-600 mb-1 flex items-center gap-1"><Camera className="w-3 h-3" /> Photos de fin de chantier</p>
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
                                                                <Download className="w-3 h-3" /> Télécharger toutes les photos
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
                                                                    <span className="text-xs font-bold text-red-600 block mb-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Annulation impossible</span>
                                                                    <p className="text-[10px] text-red-400">Moins de 48h avant l'intervention.</p>
                                                                </div>
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                                {clientMissions.length === 0 && <p className="text-center text-slate-400 py-10">Aucun rendez-vous à venir.</p>}
                            </div>
                        </div>
                    )}

                    {activeTab === 'docs' && (
                        <div className="space-y-6">
                            <h2 className="text-2xl font-bold text-slate-800">Mes Documents</h2>

                            {/* Section Avis */}
                            {(() => {
                                const clientCompletedMissions = clientMissions.filter(m => m.status === 'completed');
                                const hasCompletedPrestation = clientCompletedMissions.length > 0;

                                return hasCompletedPrestation && !client.hasLeftReview && (
                                    <div className="bg-gradient-to-r from-teal-50 to-blue-50 rounded-xl shadow-sm border border-teal-200 p-6">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <h3 className="text-lg font-semibold text-slate-800 mb-2">Partagez votre expérience</h3>
                                                <p className="text-slate-600 text-sm">Votre prestation est terminée ! Votre avis nous aide à améliorer nos services.</p>
                                            </div>
                                            <button
                                                onClick={() => setReviewModalOpen(true)}
                                                className="bg-brand-blue text-white px-6 py-3 rounded-lg font-semibold hover:bg-teal-700 transition-colors shadow-md"
                                            >
                                                Laisser un avis
                                            </button>
                                        </div>
                                    </div>
                                );
                            })()}

                            {/* Filtres */}
                            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                    {/* Recherche */}
                                    <div className="md:col-span-1">
                                        <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Recherche</label>
                                        <div className="relative">
                                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                                            <input
                                                type="text"
                                                placeholder="Référence, type..."
                                                value={documentSearch}
                                                onChange={(e) => setDocumentSearch(e.target.value)}
                                                className="w-full pl-10 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue focus:border-transparent"
                                            />
                                        </div>
                                    </div>

                                    {/* Filtre par type */}
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Type</label>
                                        <select
                                            value={documentFilter}
                                            onChange={(e) => setDocumentFilter(e.target.value)}
                                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue focus:border-transparent"
                                        >
                                            <option value="all">Tous les types</option>
                                            <option value="Devis">Devis</option>
                                            <option value="Facture">Factures</option>
                                        </select>
                                    </div>

                                    {/* Filtre par statut */}
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Statut</label>
                                        <select
                                            value={documentStatusFilter}
                                            onChange={(e) => setDocumentStatusFilter(e.target.value)}
                                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue focus:border-transparent"
                                        >
                                            <option value="all">Tous les statuts</option>
                                            <option value="sent">À signer</option>
                                            <option value="signed">Signé</option>
                                            <option value="paid">Payé</option>
                                            <option value="pending">À régler</option>
                                            <option value="converted">Facturé</option>
                                            <option value="rejected">Refusé</option>
                                        </select>
                                    </div>

                                    {/* Bouton de réinitialisation */}
                                    <div className="flex items-end">
                                        <button
                                            onClick={() => {
                                                setDocumentFilter('all');
                                                setDocumentStatusFilter('all');
                                                setDocumentSearch('');
                                            }}
                                            className="w-full px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition text-sm font-medium flex items-center justify-center gap-2"
                                        >
                                            <RotateCcw className="w-4 h-4" />
                                            Réinitialiser
                                        </button>
                                    </div>
                                </div>

                                {/* Nombre de résultats */}
                                <div className="mt-3 text-xs text-slate-500">
                                    {filteredClientDocs.length} document{filteredClientDocs.length > 1 ? 's' : ''} trouvé{filteredClientDocs.length > 1 ? 's' : ''}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {filteredClientDocs.length === 0 ? (
                                    <div className="col-span-full text-center py-10">
                                        <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                                        <p className="text-slate-400">Aucun document trouvé.</p>
                                    </div>
                                ) : (
                                    filteredClientDocs.map(doc => (
                                        <div key={doc.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 hover:shadow-md transition-shadow">
                                            {/* Header du document */}
                                            <div className="flex justify-between items-start mb-3">
                                                <div className="flex-1">
                                                    <button
                                                        onClick={() => openQuoteModal(doc.id)}
                                                        className="text-brand-blue hover:underline cursor-pointer font-bold text-lg"
                                                        title="Voir les détails du devis"
                                                    >
                                                        {doc.ref}
                                                    </button>
                                                    <div className="text-xs text-slate-500 mt-1">{doc.date}</div>
                                                </div>
                                                <span className={`px-2 py-1 rounded-full text-xs font-bold ${doc.type === 'Devis' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'
                                                    }`}>
                                                    {doc.type}
                                                </span>
                                            </div>

                                            {/* Statut et montant */}
                                            <div className="flex justify-between items-center mb-4">
                                                <div className="text-lg font-bold text-slate-800">
                                                    {doc.totalTTC.toFixed(2)} €
                                                </div>
                                                <div className="text-center">
                                                    {doc.status === 'sent' && <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded-full text-xs font-bold">À signer</span>}
                                                    {doc.status === 'signed' && <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-bold">Signé</span>}
                                                    {doc.status === 'paid' && <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-bold">Payé</span>}
                                                    {doc.status === 'pending' && <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full text-xs font-bold">À régler</span>}
                                                    {doc.status === 'converted' && <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded-full text-xs font-bold">Facturé</span>}
                                                    {doc.status === 'rejected' && <span className="bg-red-100 text-red-800 px-2 py-1 rounded-full text-xs font-bold">Refusé</span>}
                                                </div>
                                            </div>

                                            {/* Actions */}
                                            <div className="flex flex-wrap gap-2">
                                                <button
                                                    onClick={() => handleDownloadInvoice(doc)}
                                                    className="flex-1 bg-slate-100 text-slate-700 text-xs font-bold px-3 py-2 rounded hover:bg-slate-200 transition flex items-center justify-center gap-1"
                                                    title="Télécharger PDF"
                                                >
                                                    <Download className="w-3 h-3" /> Télécharger
                                                </button>

                                                {doc.type === 'Devis' && doc.status === 'sent' && (
                                                    <button
                                                        onClick={() => openQuoteModal(doc.id)}
                                                        className="flex-1 bg-brand-orange text-white text-xs font-bold px-3 py-2 rounded hover:bg-orange-600 transition flex items-center justify-center gap-1"
                                                    >
                                                        <PenTool className="w-3 h-3" /> Consulter
                                                    </button>
                                                )}

                                                {doc.type === 'Devis' && doc.status === 'signed' && (
                                                    <button
                                                        onClick={handleDownloadContract}
                                                        className="flex-1 bg-green-600 text-white text-xs font-bold px-3 py-2 rounded hover:bg-green-700 transition flex items-center justify-center gap-1"
                                                    >
                                                        <FileSignature className="w-3 h-3" /> Contrat
                                                    </button>
                                                )}

                                                {doc.type === 'Facture' && (
                                                    <button
                                                        onClick={() => handleRequestInvoice(doc.id)}
                                                        disabled={doc.status === 'paid' || doc.status === 'pending' || doc.status === 'converted'}
                                                        className={`flex-1 text-xs font-bold px-3 py-2 rounded transition flex items-center justify-center gap-1 ${doc.status === 'paid'
                                                            ? 'bate-100 text-slate-400 cursor-not-allowed'
                                                            : 'band-blue text-white hover:bg-blue-600'
                                                            }`}
                                                    >
                                                        {doc.status === 'paid' ? 'Facture Dispo' : client.hasLeftReview ? 'Réclamer' : 'Avis & Facture'}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))
                                )}
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
                        <div className="space-y-6">
                            {/* Section Appel en Direct */}
                            <div className="h-96 flex flex-col items-center justify-center bg-slate-900 rounded-xl shadow-lg overflow-hidden relative">
                                {isLive ? (
                                    <div className="w-full h-full flex flex-col">
                                        <div className="absolute top-4 left-4 z-10 bg-red-600 text-white px-3 py-1 rounded-full text-xs font-bold animate-pulse flex items-center gap-2">
                                            <span className="w-2 h-2 bg-white rounded-full"></span> DIRECT
                                        </div>
                                        <div className="absolute top-4 right-4 z-10 bg-black/50 text-white px-3 py-1 rounded-full text-xs flex items-center gap-2">
                                            <Lock className="w-3 h-3 text-green-400" /> Flux Sécurisé
                                        </div>

                                        {/* Informations sur l'appel */}
                                        <div className="absolute bottom-4 left-4 right-4 z-10 bg-black/70 text-white p-4 rounded-lg">
                                            <div className="flex justify-between items-start mb-2">
                                                <div>
                                                    <h4 className="font-bold text-lg">Appel Vidéo en Cours</h4>
                                                    <p className="text-sm text-slate-300">
                                                        {activeStream && (() => {
                                                            const provider = providers.find(p => p.id === activeStream.providerId);
                                                            return provider ? `${provider.firstName} ${provider.lastName}` : 'Intervenant';
                                                        })()}
                                                    </p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-xs text-slate-400">Débuté à</p>
                                                    <p className="text-sm font-mono">
                                                        {activeStream && new Date(activeStream.startTime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                                    </p>
                                                </div>
                                            </div>
                                            <button className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors">
                                                <Video className="w-5 h-5" />
                                                Rejoindre l'Appel
                                            </button>
                                        </div>

                                        <div className="flex-1 flex items-center justify-center bg-black relative">
                                            {activeStream && activeStream.streamUrl ? (
                                                <video
                                                    className="w-full h-full object-contain"
                                                    autoPlay
                                                    playsInline
                                                    muted
                                                    src={activeStream.streamUrl}
                                                />
                                            ) : (
                                                <div className="text-white text-center">
                                                    <Wifi className="w-16 h-16 mx-auto mb-4 text-green-500 animate-pulse" />
                                                    <h3 className="text-xl font-bold">Intervention en cours</h3>
                                                    <p className="text-sm text-slate-400">Connexion établie avec l'intervenant.</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-center text-slate-500 p-8">
                                        <Wifi className="w-16 h-16 mx-auto mb-4 opacity-20" />
                                        <h3 className="text-xl font-bold text-slate-400">Hors Ligne</h3>
                                        <p className="text-sm mb-4">Aucun flux vidéo actif pour le moment.</p>
                                        <p className="text-xs text-slate-500">Vous recevrez une notification lorsqu'un intervenant lancera un appel vidéo.</p>
                                    </div>
                                )}
                            </div>

                            {/* Section Vidéos en Replay */}
                            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                                <div className="p-6 border-b border-slate-200">
                                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                        <Video className="w-5 h-5 text-brand-blue" />
                                        Vidéos Précédentes
                                    </h3>
                                    <p className="text-sm text-slate-600 mt-1">Consultez les enregistrements de vos précédentes interventions.</p>
                                </div>

                                <div className="divide-y divide-slate-100">
                                    {clientVideoRecordings.length === 0 ? (
                                        <div className="p-8 text-center text-slate-400">
                                            <Video className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                            <p>Aucune vidéo enregistrée pour le moment.</p>
                                            <p className="text-xs mt-1">Les vidéos apparaîtront ici après chaque appel vidéo.</p>
                                        </div>
                                    ) : (
                                        clientVideoRecordings.map((recording) => (
                                            <div key={recording.id} className="p-4 hover:bg-slate-50 transition-colors">
                                                <div className="flex items-start justify-between">
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-2 mb-2">
                                                            <div className={`w-2 h-2 rounded-full ${recording.status === 'ready' ? 'bg-green-500' :
                                                                recording.status === 'processing' ? 'bg-yellow-500 animate-pulse' :
                                                                    recording.status === 'failed' ? 'bg-red-500' : 'bg-slate-400'
                                                                }`}></div>
                                                            <span className="text-xs font-medium text-slate-600 uppercase">
                                                                {recording.status === 'ready' ? 'Disponible' :
                                                                    recording.status === 'processing' ? 'En traitement' :
                                                                        recording.status === 'failed' ? 'Erreur' : 'Enregistrement'}
                                                            </span>
                                                        </div>
                                                        <h4 className="font-medium text-slate-800 mb-1">
                                                            Intervention du {new Date(recording.startTime).toLocaleDateString('fr-FR')}
                                                        </h4>
                                                        <p className="text-sm text-slate-600 mb-2">
                                                            {recording.providerId && (() => {
                                                                const provider = providers.find(p => p.id === recording.providerId);
                                                                return provider ? `avec ${provider.firstName} ${provider.lastName}` : 'Intervenant';
                                                            })()}
                                                        </p>
                                                        <div className="flex items-center gap-4 text-xs text-slate-500">
                                                            <span>Duration: {Math.floor(recording.duration / 60)}min {recording.duration % 60}s</span>
                                                            {recording.fileSize > 0 && (
                                                                <span>Taille: {(recording.fileSize / (1024 * 1024)).toFixed(1)} MB</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="ml-4">
                                                        {recording.status === 'ready' && recording.replayUrl ? (
                                                            <button className="bg-brand-blue text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors flex items-center gap-2">
                                                                <Play className="w-4 h-4" />
                                                                Voir
                                                            </button>
                                                        ) : recording.status === 'processing' ? (
                                                            <button disabled className="bg-slate-200 text-slate-500 px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2">
                                                                <Loader className="w-4 h-4 animate-spin" />
                                                                En cours
                                                            </button>
                                                        ) : (
                                                            <button disabled className="bg-slate-100 text-slate-400 px-3 py-2 rounded-lg text-sm font-medium">
                                                                Indisponible
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
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
            {quoteModalOpen && selectedQuote && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="p-4 border-b bg-cream-50 flex justify-between items-center">
                            <h3 className="font-serif font-bold text-xl text-slate-800">Consultation du Devis {selectedQuote.ref}</h3>
                            <button onClick={() => setQuoteModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full"><X className="w-5 h-5 text-slate-500" /></button>
                        </div>

                        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
                            {/* Document Viewer - Affiche le devis en priorité */}
                            <div className={`${selectedQuote.status === 'sent' ? 'flex-1 md:flex-1' : 'flex-1'} bg-slate-100 p-4 md:p-6 overflow-y-auto border-r border-slate-200`}>
                                <div className="bg-white shadow-sm p-4 md:p-8 min-h-full text-xs md:text-sm text-slate-800 leading-relaxed" style={{ fontFamily: 'Times New Roman, serif' }}>
                                    <div className="flex justify-between mb-8 border-b pb-4">
                                        <div className="w-20">
                                            <img src={LOGO_NORMAL} alt="Logo" className="w-full" />
                                        </div>
                                        <div className="text-right">
                                            <h1 className="font-bold text-xl uppercase text-brand-blue" style={{ fontFamily: 'Times New Roman, serif' }}>DEVIS</h1>
                                            <p>Réf: {selectedQuote.ref}</p>
                                            <p>Date: {selectedQuote.date}</p>
                                            <p>Type: {selectedQuote.type}</p>
                                        </div>
                                    </div>

                                    {/* Date de prestation */}
                                    <div className="mb-6 p-4 bg-orange-50 rounded-lg border border-orange-200">
                                        <h5 className="font-bold text-orange-800 mb-2">Date de Prestation :</h5>
                                        {selectedQuote.slotsData && selectedQuote.slotsData.length > 0 ? (
                                            <div className="text-sm">
                                                {selectedQuote.slotsData.map((slot: any, index: number) => (
                                                    <p key={index} className="mb-1">
                                                        <strong>Créneau {index + 1} :</strong> {slot.date || 'Date à définir'} à {slot.startTime || 'Heure à définir'}
                                                    </p>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="text-sm"><strong>Date à définir</strong> - Le secrétariat vous contactera pour fixer les dates.</p>
                                        )}
                                    </div>

                                    <div className="mb-6">
                                        <h4 className="font-bold border-b border-slate-300 mb-2">Entre les soussignés :</h4>
                                        <p><strong>PRESTA SERVICES ANTILLES</strong> (Le Prestataire)</p>
                                        <p>Et</p>
                                        <p><strong>{client.name}</strong> (Le Client)</p>

                                        {/* Informations complètes du client */}
                                        <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                                            <h5 className="font-bold text-blue-800 mb-2">Coordonnées Client :</h5>
                                            <p className="text-sm"><strong>Nom :</strong> {client.name}</p>
                                            <p className="text-sm"><strong>Adresse :</strong> {client.address || 'Non renseignée'}</p>
                                            <p className="text-sm"><strong>Ville :</strong> {client.city || 'Non renseignée'}</p>
                                            <p className="text-sm"><strong>Téléphone :</strong> {client.phone || 'Non renseigné'}</p>
                                            <p className="text-sm"><strong>Email :</strong> {client.email || 'Non renseigné'}</p>
                                        </div>
                                    </div>

                                    <div className="mb-6 p-4 bg-green-50 rounded-lg border border-green-200">
                                        <h5 className="font-bold text-green-800 mb-2">Détails du Devis :</h5>
                                        {/* Séparer la description et le lieu */}
                                        {selectedQuote.description.includes('|') ? (
                                            <>
                                                <p className="text-sm"><strong>Description :</strong> {selectedQuote.description.split('|')[0].trim()}</p>
                                                <p className="text-sm"><strong>Lieu :</strong> {selectedQuote.description.split('|')[1].replace('Lieu:', '').trim()}</p>
                                            </>
                                        ) : (
                                            <p className="text-sm"><strong>Description :</strong> {selectedQuote.description}</p>
                                        )}
                                        <p className="text-sm"><strong>Prix unitaire HT :</strong> {selectedQuote.unitPrice.toFixed(2)} €</p>
                                        <p className="text-sm"><strong>Taux TVA :</strong> {selectedQuote.tvaRate}%</p>
                                        <p className="text-sm font-bold text-lg"><strong>Total TTC :</strong> {selectedQuote.totalTTC.toFixed(2)} €</p>
                                    </div>

                                    {/* Section Contrat de Service masquée */}
                                    {/* <div className="mt-8 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                                  <h5 className="font-bold text-yellow-800 mb-2">Contrat de Service :</h5>
                                  <p className="text-sm mb-4">Le contrat complet sera disponible après validation de ce devis.</p>
                                  <p className="text-xs text-slate-600">En signant ce devis, vous acceptez les conditions générales de service qui vous seront présentées dans le contrat détaillé.</p>
                              </div> */}

                                    {/* Section contenu du contrat masquée */}
                                    {/* <div className="mb-6 whitespace-pre-wrap">
                                  {selectedContract?.content || 'Le contrat sera disponible après validation du devis.'}
                              </div> */}

                                    {/* Signatures on Contract */}
                                    <div className="mt-8 flex justify-between border-t pt-4">
                                        <div className="w-1/2 pr-4 border-r">
                                            <p className="font-bold mb-2">Pour l'Entreprise :</p>
                                            {selectedContract?.status === 'active' ? (
                                                <div className="text-green-600 font-bold text-xs uppercase border-2 border-green-600 p-2 inline-block rounded">
                                                    Validé & Signé
                                                </div>
                                            ) : (
                                                <div className="text-slate-400 font-bold text-xs uppercase border-2 border-slate-300 p-2 inline-block rounded">
                                                    En attente de validation
                                                </div>
                                            )}
                                        </div>
                                        <div className="w-1/2 pl-4">
                                            <p className="font-bold mb-2">Pour le Client :</p>
                                            <div className="border-2 border-slate-300 h-12 rounded flex items-center justify-center text-xs text-slate-400">
                                                En attente de signature
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

                            {/* Signature Pad - Only show for quotes that can be signed */}
                            {selectedQuote.status === 'sent' && (
                                <div className="hidden md:block md:w-1/3 bg-white flex flex-col p-6 md:sticky md:top-6">
                                    <h4 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
                                        <PenTool className="w-4 h-4" /> Zone de Signature
                                    </h4>
                                    <p className="text-xs text-slate-500 mb-2">Veuillez signer dans le cadre ci-dessous.</p>

                                    <div className="flex-1 border-2 border-dashed border-slate-300 rounded-xl bg-slate-50 relative touch-none mb-4 min-h-[300px] max-h-[400px]">
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
                                            style={{ touchAction: 'none' }}
                                        />
                                        {!isDrawing && (
                                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-10">
                                                <span className="text-2xl md:text-4xl font-serif italic text-slate-400">Signer ici</span>
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
                                            disabled={!termsAccepted || !hasSignature}
                                            className="w-full py-3 bg-brand-blue text-white font-bold rounded-xl hover:bg-teal-700 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition"
                                        >
                                            Signer et Valider
                                        </button>
                                        <button
                                            onClick={() => handleRefuse(selectedQuote.id)}
                                            className="w-full py-2 text-red-500 font-bold hover:bg-red-50 rounded-xl border border-transparent hover:border-red-100 transition"
                                        >
                                            Refuser
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Mobile Signature Button */}
                            {selectedQuote.status === 'sent' && (
                                <div className="md:hidden fixed bottom-20 right-4 z-40">
                                    <button
                                        onClick={() => setShowSignatureModal(true)}
                                        className="bg-brand-blue text-white px-4 py-3 rounded-full shadow-lg hover:bg-teal-700 transition flex items-center gap-2"
                                    >
                                        <PenTool className="w-4 h-4" />
                                        <span className="text-sm font-bold">Signer</span>
                                    </button>
                                </div>
                            )}

                            {/* Mobile Signature Modal */}
                            {showSignatureModal && (
                                <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm p-4 flex items-center justify-center md:hidden">
                                    <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
                                        <div className="flex items-center justify-between p-4 border-b">
                                            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                                <PenTool className="w-5 h-5" />
                                                Signature du Devis
                                            </h3>
                                            <button
                                                onClick={() => setShowSignatureModal(false)}
                                                className="p-2 hover:bg-slate-100 rounded-full transition"
                                            >
                                                <X className="w-5 h-5 text-slate-500" />
                                            </button>
                                        </div>

                                        <div className="flex-1 p-4 space-y-4">
                                            <p className="text-sm text-slate-600">
                                                Veuillez signer dans le cadre ci-dessous pour valider le devis.
                                            </p>

                                            <div className="border-2 border-dashed border-slate-300 rounded-xl bg-slate-50 relative touch-none min-h-[300px]">
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
                                                    style={{ touchAction: 'none' }}
                                                />
                                                {!isDrawing && (
                                                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-10">
                                                        <span className="text-2xl font-serif italic text-slate-400">Signer ici</span>
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
                                                    disabled={!termsAccepted || !hasSignature}
                                                    className="w-full py-3 bg-brand-blue text-white font-bold rounded-xl hover:bg-teal-700 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition"
                                                >
                                                    Signer et Valider
                                                </button>
                                                <button
                                                    onClick={() => handleRefuse(selectedQuote.id)}
                                                    className="w-full py-2 text-red-500 font-bold hover:bg-red-50 rounded-xl border border-transparent hover:border-red-100 transition"
                                                >
                                                    Refuser
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Quote Status Section */}
                            {selectedQuote.status !== 'sent' && (
                                <div className="w-full md:w-1/3 bg-white flex flex-col p-6">
                                    <h4 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
                                        <FileSignature className="w-4 h-4" /> Statut du Devis
                                    </h4>
                                    {selectedQuote.status === 'signed' ? (
                                        <div className="text-center">
                                            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                                <CheckCircle className="w-8 h-8 text-green-600" />
                                            </div>
                                            <p className="text-green-600 font-bold">Devis déjà signé</p>
                                            <p className="text-sm text-slate-500 mt-2">Ce devis a été validé et signé.</p>
                                        </div>
                                    ) : (
                                        <div className="text-center">
                                            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                                <Clock className="w-8 h-8 text-slate-400" />
                                            </div>
                                            <p className="text-slate-600 font-bold">Devis en traitement</p>
                                            <p className="text-sm text-slate-500 mt-2">Statut: {selectedQuote.status}</p>
                                        </div>
                                    )}

                                    {/* Download Contract Button */}
                                    <button
                                        onClick={() => {
                                            const pack = packs.find(p => p.name === client.pack);
                                            const contract = generateContractFromTemplate(selectedQuote, client, pack);
                                            if (contract) {
                                                downloadContract(contract);
                                                showToast("Contrat téléchargé avec succès");
                                            }
                                        }}
                                        className="w-full py-2 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 transition flex items-center justify-center gap-2 mt-4"
                                    >
                                        <FileText className="w-4 h-4" />
                                        Télécharger le contrat
                                    </button>
                                </div>
                            )}

                        </div>
                    </div>
                </div>
            )}

            {/* Notifications Panel */}
            {showNotifications && (
                <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm p-4 flex items-center justify-center">
                    <div className="bg-white rounded-2xl w-full max-w-md max-h-[80vh] overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
                        <div className="flex items-center justify-between p-4 border-b">
                            <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                <Bell className="w-5 h-5" />
                                Notifications
                            </h3>
                            <button
                                onClick={() => setShowNotifications(false)}
                                className="p-2 hover:bg-slate-100 rounded-full transition"
                            >
                                <X className="w-5 h-5 text-slate-500" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4">
                            {notifications.length === 0 ? (
                                <div className="text-center py-8 text-slate-400">
                                    <Bell className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                    <p>Aucune notification</p>
                                </div>
                            ) : (
                                notifications.map(n => (
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
        
        {/* Modal Mobile pour les notifications Client */}
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
                {allClientNotifs.length === 0 ? (
                <div className="text-center text-slate-400 py-8">Aucune notification</div>
                ) : (
                allClientNotifs.slice(0, 10).map(n => (
                    <div key={n.id} onClick={() => {
                    handleNotificationClick(n);
                    setShowMobileNotifModal(false);
                    }} className={`p-3 mb-2 rounded-lg border border-slate-100 cursor-pointer hover:bg-blue-50 transition ${!n.read ? 'bg-blue-50/50' : ''}`}>
                    <div className="flex justify-between items-start mb-1">
                        <span className={`text-xs font-bold ${n.type === 'alert' ? 'text-red-600' : 'text-brand-blue'}`}>{n.title}</span>
                        <span className="text-[10px] text-slate-400">{new Date(n.date).toLocaleDateString()}</span>
                    </div>
                    <p className="text-xs text-slate-600 line-clamp-2">{n.message}</p>
                    </div>
                ))
                )}
            </div>
            </div>
        </div>
        )}
        </div>
    )}

    
export default ClientPortal;
