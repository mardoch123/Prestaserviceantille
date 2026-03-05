import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useData } from '../context/DataContext';
import { Document, Contract } from '../types';
import QRCodeManager from './ScanPage';
import ClientQRCode from './ClientQRCode';
import VideoCallManagerImproved from './VideoCallManagerImproved';
import { COMPANY_STAMP_URL, COMPANY_SIGNATURE_URL, LOGO_NORMAL, LOGO_SAP } from '../context/DataContext';
import { LOGO_BASE64, LOGO_SAP_BASE64, SIGNATURE_BASE64, STAMP_SIGNATURE_BASE64 } from '../src/assets/images';
import { SignedQuotePDF, InvoicePDF, ContractPDF } from './PDFComponents';
import { pdf } from '@react-pdf/renderer';
import { downloadHtmlAsPdf } from '../utils/htmlPdf';
import { 
    getMartiniqueNowISO,
    getMartiniqueToday,
    formatMartiniqueDateTime,
    formatMartiniqueDate
} from '../src/utils/martiniqueTime';
import { 
    User,
    Calendar,
    Clock,
    MapPin,
    Phone,
    Mail,
    Award,
    Package,
    Megaphone,
    AlertCircle,
    AlertTriangle,
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
    Clock as ClockIcon,
    MessageCircle,
    MessageSquare,
    Star,
    Send,
    PenTool,
    X,
    Menu,
    Wifi,
    Lock,
    FileSignature,
    LogOut,
    MapPin as MapPinIcon,
    Phone as PhoneIcon,
    Mail as MailIcon,
    Download,
    FileText,
    CheckCircle,
    ChevronDown
} from 'lucide-react';

const ClientPortal: React.FC = () => {
    const {
        clients,
        documents,
        missions,
        simulatedClientId,
        simulatedProviderId,
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
        getVideoRecordings,
        stopLiveStream,
        missionChangeRequests,
        respondToMissionReschedule
    } = useData();

    // Determine client ID either from simulation or real login
    const activeClientId = simulatedClientId || (currentUser?.role === 'client' ? currentUser.relatedEntityId : null);
    const client = clients.find(c => String((c as any).id || '') === String(activeClientId || ''));

    const profileLoadTimeoutRef = useRef<number | null>(null);

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
    const [selectedChangeRequestId, setSelectedChangeRequestId] = useState<string | null>(null);
    const [isChangeRequestModalOpen, setIsChangeRequestModalOpen] = useState(false);
    const [isRespondingRequest, setIsRespondingRequest] = useState(false);

    // Get client's documents
    // Filter: Show only documents that are 'sent' (or further in the process like signed/paid) AND have a positive balance (totalTTC > 0)
    // Exclude 'draft', 'pending', and 0-balance quotes.
    const clientDocs = client ? documents.filter(d => 
        d.clientId === client.id && 
        (d.totalTTC || 0) > 0 &&
        ['sent', 'signed', 'validated', 'paid', 'completed'].includes(d.status)
    ) : [];

    // Get client missions
    const connectedProviderId = useMemo(() => {
        // If the connected user is a provider, use their related entity id
        if (currentUser?.role === 'provider') {
            return String(currentUser?.relatedEntityId || '').trim() || null;
        }
        // If we are in simulation mode, use simulated provider id when available
        return String((simulatedProviderId as any) || '').trim() || null;
    }, [currentUser?.role, (currentUser as any)?.relatedEntityId, simulatedProviderId]);

    const clientMissions = useMemo(() => {
        if (!client) return [];

        const base = missions.filter((m: any) => m.clientId === client.id || m.clientName === client.name);
        // If we can identify a provider, restrict missions to that provider
        if (connectedProviderId) {
            return base.filter((m: any) => String(m?.providerId || '').trim() === connectedProviderId);
        }
        return base;
    }, [client, missions, connectedProviderId]);

    const clientPendingChangeRequests = useMemo(() => {
        if (!client) return [];
        const clientId = String((client as any).id || '');
        return missionChangeRequests
            .filter(req => String((req as any).clientId || '') === clientId && String((req as any).status || '').toLowerCase() === 'pending')
            .map(req => ({
                ...req,
                mission: missions.find(m => m.id === req.missionId) || null
            }));
    }, [client, missionChangeRequests, missions]);

    const selectedChangeRequest = useMemo(() => {
        if (!selectedChangeRequestId) return null;
        return missionChangeRequests.find(req => req.id === selectedChangeRequestId) || null;
    }, [missionChangeRequests, selectedChangeRequestId]);

    // Filter documents
    const filteredClientDocs = useMemo(() => {
        const filtered = clientDocs.filter((doc: any) => {
            const matchesType = documentFilter === 'all' || doc.type === documentFilter;
            const matchesStatus = documentStatusFilter === 'all' || doc.status === documentStatusFilter;
            const matchesSearch = documentSearch === '' ||
                doc.ref.toLowerCase().includes(documentSearch.toLowerCase()) ||
                doc.type.toLowerCase().includes(documentSearch.toLowerCase());

            return matchesType && matchesStatus && matchesSearch;
        });
        return filtered
            .slice()
            .sort((a: any, b: any) => new Date((b as any).created_at || b.date).getTime() - new Date((a as any).created_at || a.date).getTime());
    }, [clientDocs, documentFilter, documentStatusFilter, documentSearch]);

    // Filter planning missions
    const filteredClientMissions = useMemo(() => {
        return clientMissions.filter(m => {
            const matchesStatus = planningStatusFilter === 'all' || m.status === planningStatusFilter;
            const matchesSearch = planningSearch === '' ||
                m.service.toLowerCase().includes(planningSearch.toLowerCase()) ||
                (m.providerName && m.providerName.toLowerCase().includes(planningSearch.toLowerCase())) ||
                m.date.includes(planningSearch);

            const today = getMartiniqueToday();
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
    
    // New State for Saturation Error
    const [showSaturationError, setShowSaturationError] = useState(false);
    const [saturationErrorMessage, setSaturationErrorMessage] = useState('');

    const messageInputRef = useRef<HTMLInputElement>(null);

    // États pour la messagerie en temps réel
    const [isTyping, setIsTyping] = useState(false);
    const [adminTyping, setAdminTyping] = useState(false);
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const showToast = (message: string, type: 'success' | 'error' | 'warning' = 'success') => {
        setToast({ show: true, message, type });
        setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);
    };

    const isQuoteExpired = (doc: any): boolean => {
        if (!doc) return true;
        if (String(doc.status || '') === 'expired') return true;
        const createdAtRaw = (doc as any)?.created_at || (doc as any)?.createdAt;
        if (!createdAtRaw) return false; // fallback: if we can't read created_at, don't hide by time
        const createdAtMs = new Date(createdAtRaw).getTime();
        if (!Number.isFinite(createdAtMs)) return false;
        return (Date.now() - createdAtMs) > (48 * 60 * 60 * 1000);
    };

    // Notification State
    const [showNotifDropdown, setShowNotifDropdown] = useState(false);
    const [showAllNotifsModal, setShowAllNotifsModal] = useState(false);
    const [showMobileNotifModal, setShowMobileNotifModal] = useState(false);
    const notifDropdownRef = useRef<HTMLDivElement>(null);

    // Mobile Menu State
    const [showMobileMenu, setShowMobileMenu] = useState(false);
    const [isReferrer, setIsReferrer] = useState(false);
    const [referralCode, setReferralCode] = useState('');

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
    const [isSubmittingSignature, setIsSubmittingSignature] = useState(false);
    const [showNotifications, setShowNotifications] = useState(false);
    const [showVideoCall, setShowVideoCall] = useState(false);
    const [isCallInitiator, setIsCallInitiator] = useState(false);
    const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

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

    useEffect(() => {
        if (!showNotifDropdown) return;

        const handleOutside = (event: MouseEvent | TouchEvent) => {
            const target = event.target as Node | null;
            if (!target) return;
            if (!notifDropdownRef.current) return;
            if (notifDropdownRef.current.contains(target)) return;
            setShowNotifDropdown(false);
        };

        document.addEventListener('mousedown', handleOutside);
        document.addEventListener('touchstart', handleOutside);
        return () => {
            document.removeEventListener('mousedown', handleOutside);
            document.removeEventListener('touchstart', handleOutside);
        };
    }, [showNotifDropdown]);

    useEffect(() => {
        try {
            const v = String(localStorage.getItem('mkt_client_is_referrer') || '').trim();
            setIsReferrer(v === '1' || v.toLowerCase() === 'true');
        } catch {
            setIsReferrer(false);
        }
    }, [currentUser?.id, showMobileMenu]);

    useEffect(() => {
        try {
            const code = String(localStorage.getItem('mkt_client_referral_code') || '').trim();
            setReferralCode(code);
        } catch {
            setReferralCode('');
        }
    }, [currentUser?.id]);

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

    useEffect(() => {
        if (activeTab !== 'messages') return;
        const t = setTimeout(() => {
            messageInputRef.current?.focus();
        }, 50);
        return () => clearTimeout(t);
    }, [activeTab]);

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
    const allClientNotifs = notifications
        .filter(n => n.targetUserType === 'client' && (!n.targetUserId || n.targetUserId === client.id))
        .slice()
        .sort((a, b) => new Date(b.created_at || b.date).getTime() - new Date(a.created_at || a.date).getTime());
    const unreadClientNotifs = allClientNotifs.filter(n => !n.read);
    const clientMessages = messages.filter(m => m.clientId === client.id);
    
    // Améliorer la détection des appels actifs pour les clients
    const isLive = activeStream && (
        activeStream.clientId === client.id || 
        currentUser?.role === 'admin' // Les admins peuvent voir tous les appels
    );
    
    // Vérifier s'il y a des appels vidéo récents pour ce client
    const hasRecentVideoCalls = videoRecordings.some(r => 
        r.clientId === client.id && 
        (r.status === 'recording' || r.status === 'processing')
    );

    const handleLogout = () => {
        logout(true);
    };

    const handleNotificationClick = (notif: any) => {
        markNotificationRead(notif.id);
        setShowNotifDropdown(false);
        setShowAllNotifsModal(false);
        setShowMobileNotifModal(false);

        const title = String(notif?.title || '');
        const message = String(notif?.message || '');
        const link = typeof notif?.link === 'string' ? notif.link : '';

        const parseMissionChangeId = (value: string) => {
            if (!value) return null;
            const match = value.match(/mission-change:([a-f0-9-]+)/i);
            return match ? match[1] : null;
        };

        const missionChangeId = parseMissionChangeId(link);
        if (missionChangeId) {
            setActiveTab('planning');
            setSelectedChangeRequestId(missionChangeId);
            setIsChangeRequestModalOpen(true);
            return;
        }

        if (link && link.startsWith('document:')) {
            const documentId = String(link.split(':')[1] || '').trim();
            if (documentId) {
                setActiveTab('docs');
                openQuoteModal(documentId);
                return;
            }
        }

        const isDocNotif =
            link === 'documents' ||
            link === 'tab:docs' ||
            link.startsWith('document:') ||
            /\bdevis\b/i.test(title) ||
            /\bdevis\b/i.test(message) ||
            /\bcontrat\b/i.test(title) ||
            /\bcontrat\b/i.test(message);

        const isMessageNotif =
            link === 'tab:messages' ||
            link.startsWith('tab:messages:') ||
            notif?.type === 'message' ||
            /\bmessage\b/i.test(title) ||
            /\bmessage\b/i.test(message);

        if (link && link.startsWith('mission:')) {
            setActiveTab('planning');
        } else if (isDocNotif) {
            setActiveTab('docs');
        } else if (isMessageNotif) {
            setActiveTab('messages');
        } else if (link === 'tab:live') {
            // Si la notification pointe vers un appel en cours, ouvrir l'onglet live
            setActiveTab('live');
        }
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

        if (selectedQuoteId && canvasRef.current) {
            const dataUrl = canvasRef.current.toDataURL();
            try {
                setIsSubmittingSignature(true);
                await signQuoteWithData(selectedQuoteId, dataUrl);
                setQuoteModalOpen(false);
                endReadingSession(); // Terminer la session de lecture
                showToast('Devis signé ! Vos créneaux sont réservés.');
                setShowSignatureModal(false); // Fermer le modal sur mobile
            } catch (error: any) {
                console.error('Erreur lors de la signature:', error);
                
                // Handle specific saturation error
                const msg = String(error?.message || '');
                if (msg.includes('SATURATION_ERROR')) {
                    const cleanMsg = msg.replace('SATURATION_ERROR:', '').trim();
                    setSaturationErrorMessage(cleanMsg);
                    setShowSaturationError(true);
                    setQuoteModalOpen(false); // Close signature modal
                } else {
                    // Ne pas afficher de message d'erreur ici car la notification est déjà gérée dans signQuoteWithData
                    // sauf si c'est une erreur inattendue
                    if (!msg.includes('Devis expiré')) {
                         alert("Erreur lors de la signature : " + msg);
                    }
                }
            } finally {
                setIsSubmittingSignature(false);
            }
        }
    };

    const handleContactSupportRedirect = () => {
        setShowSaturationError(false);
        setActiveTab('messages');
        setMessageInput(`Bonjour, je souhaite signer le devis mais le système indique : ${saturationErrorMessage}`);
    };

    const handleRefuse = (docId: string) => {
        if (window.confirm("Êtes-vous sûr de refuser ce devis ? Cela annulera la proposition.")) {
            refuseQuote(docId);
            setQuoteModalOpen(false);
            endReadingSession(); // Terminer la session de lecture
            showToast('Devis refusé. Le secrétariat a été notifié.');
        }
    };

    const handleDownloadInvoice = async (doc: any) => {
        // Vérifier si la prestation est terminée avant de demander un avis
        const clientCompletedMissions = clientMissions.filter(m => m.status === 'completed');
        const hasCompletedPrestation = clientCompletedMissions.length > 0;


        // Si la prestation est terminée, permettre le téléchargement direct
        // et proposer de laisser un avis si ce n'est pas déjà fait
        if (!client.hasLeftReview && hasCompletedPrestation) {
            // Proposer de laisser un avis mais ne pas bloquer le téléchargement
            showToast('Téléchargement de la facture en cours... N\'oubliez pas de laisser un avis !');
        } else {
            showToast('Téléchargement de la facture en cours...');
        }

        const convertDataUrlToPng = async (dataUrl: string): Promise<string> => {
            return await new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => {
                    try {
                        const canvas = document.createElement('canvas');
                        canvas.width = img.naturalWidth || img.width;
                        canvas.height = img.naturalHeight || img.height;
                        const ctx = canvas.getContext('2d');
                        if (!ctx) return reject(new Error('Canvas context not available'));
                        ctx.drawImage(img, 0, 0);
                        resolve(canvas.toDataURL('image/png'));
                    } catch (e) {
                        reject(e);
                    }
                };
                img.onerror = () => reject(new Error('Image decode failed'));
                img.src = dataUrl;
            });
        };

        const ensurePngDataUrl = async (value: any): Promise<any> => {
            if (!value || typeof value !== 'string') return value;
            if (!value.startsWith('data:image/')) return value;
            if (value.startsWith('data:image/png')) return value;
            try {
                return await convertDataUrlToPng(value);
            } catch {
                return value;
            }
        };

        try {
            const resolvedTvaRate = (() => {
                const raw = (doc as any)?.tvaRate;
                const n = typeof raw === 'number' ? raw : Number(raw);
                return Number.isFinite(n) ? n : 0;
            })();
            const logoBase64 = resolvedTvaRate === 0 ? LOGO_SAP_BASE64 : await ensurePngDataUrl(LOGO_BASE64);
            const companySignature = await ensurePngDataUrl(SIGNATURE_BASE64);
            const companyStamp = await ensurePngDataUrl(STAMP_SIGNATURE_BASE64);

            const packNameFromId = doc.packId ? (packs.find((p: any) => p.id === doc.packId)?.name || '') : '';
            const packNameFromField = String((doc as any).packName || '').trim();
            const descLower = String(doc.description || '').toLowerCase();
            const packNameFromText = String(
                (packs || []).find((p: any) => {
                    const n = String(p?.name || '').toLowerCase();
                    return n && descLower.includes(n);
                })?.name || ''
            );
            const packName = packNameFromId || packNameFromField || packNameFromText || '';

            const invoiceSlotsData = (() => {
                const directSlots = Array.isArray(doc?.slotsData) ? doc.slotsData : [];
                if (directSlots.length > 0) return directSlots;

                const linkedQuote = documents.find((d: any) => d?.type === 'Devis' && d?.linkedInvoiceId === doc?.id);
                const quoteSlots = Array.isArray((linkedQuote as any)?.slotsData) ? (linkedQuote as any).slotsData : [];
                return quoteSlots;
            })();

            // Préparation des données pour le PDF
            const pdfData = {
                ref: doc.ref,
                date: doc.date,
                dueDate: doc.dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 jours après
                paid: doc.status === 'paid',
                status: doc.status,
                tvaRate: resolvedTvaRate,
                taxCreditEnabled: !!(doc.hasTaxCredit || doc.taxCreditEnabled),
                clientName: client.name,
                clientEmail: client.email,
                clientPhone: client.phone,
                companySignature,
                companyStamp,
                logoBase64,
                subtotal: doc.totalHT || 0,
                tax: doc.totalTTC && doc.totalHT ? (doc.totalTTC - doc.totalHT) : 0,
                total: doc.totalTTC || 0,
                packId: doc.packId,
                packName,
                items: [
                    {
                        description: packName || doc.description || 'Service standard',
                        location: doc.location || doc.address || doc.lieu || undefined,
                        quantity: 1,
                        unitPrice: doc.totalHT || 0,
                        total: doc.totalHT || 0
                    }
                ],
                slotsData: invoiceSlotsData,
                paymentInfo: 'Paiement par virement bancaire ou chèque. Délai de paiement: 30 jours.'
            };

            const sanitizeFilenamePart = (v: any) =>
                String(v || '')
                    .replace(/[\\/:*?"<>|]/g, '_')
                    .replace(/\s+/g, ' ')
                    .trim();

            const clientNamePart = sanitizeFilenamePart(client?.name || 'Client');
            const refPart = sanitizeFilenamePart(doc?.ref || '');

            // Génération du PDF avec react-pdf
            const blob = await pdf(<InvoicePDF doc={pdfData} packs={packs} />).toBlob();
            
            // Téléchargement du fichier
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `Facture_${clientNamePart}${refPart ? `_${refPart}` : ''}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            showToast('Facture téléchargée avec succès.');
        } catch (error) {
            console.error('Erreur lors de la signature:', error);
            // Ne pas afficher de message d'erreur ici car la notification est déjà gérée dans signQuoteWithData
        }
    };

    const handleDownloadSignedQuote = async (doc: any) => {
        showToast('Téléchargement du devis...');

        const convertDataUrlToPng = async (dataUrl: string): Promise<string> => {
            return await new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => {
                    try {
                        const canvas = document.createElement('canvas');
                        canvas.width = img.naturalWidth || img.width;
                        canvas.height = img.naturalHeight || img.height;
                        const ctx = canvas.getContext('2d');
                        if (!ctx) return reject(new Error('Canvas context not available'));
                        ctx.drawImage(img, 0, 0);
                        resolve(canvas.toDataURL('image/png'));
                    } catch (e) {
                        reject(e);
                    }
                };
                img.onerror = () => reject(new Error('Image decode failed'));
                img.src = dataUrl;
            });
        };

        const ensurePngDataUrl = async (value: any): Promise<any> => {
            if (!value || typeof value !== 'string') return value;
            if (!value.startsWith('data:image/')) return value;
            if (value.startsWith('data:image/png')) return value;
            try {
                return await convertDataUrlToPng(value);
            } catch {
                return value;
            }
        };

        try {
            const sanitizeFilenamePart = (v: any) =>
                String(v || '')
                    .replace(/[\\/:*?"<>|]/g, '_')
                    .replace(/\s+/g, ' ')
                    .trim();

            const clientNamePart = sanitizeFilenamePart(client?.name || 'Client');
            const refPart = sanitizeFilenamePart(doc?.ref || '');

            const resolvedTvaRate = (() => {
                const raw = (doc as any)?.tvaRate;
                const n = typeof raw === 'number' ? raw : Number(raw);
                return Number.isFinite(n) ? n : 0;
            })();
            const logoBase64 = resolvedTvaRate === 0 ? LOGO_SAP_BASE64 : await ensurePngDataUrl(LOGO_BASE64);
            const companySignature = await ensurePngDataUrl(SIGNATURE_BASE64);
            const companyStamp = await ensurePngDataUrl(STAMP_SIGNATURE_BASE64);
            const clientSignature = await ensurePngDataUrl(doc.signatureData || null);

            const packNameFromId = doc.packId ? (packs.find((p: any) => p.id === doc.packId)?.name || '') : '';
            const packNameFromField = String((doc as any).packName || '').trim();
            const descLower = String(doc.description || '').toLowerCase();
            const packNameFromText = String(
                (packs || []).find((p: any) => {
                    const n = String(p?.name || '').toLowerCase();
                    return n && descLower.includes(n);
                })?.name || ''
            );
            const packName = packNameFromId || packNameFromField || packNameFromText || '';

            const meta = parseQuoteDescriptionMeta((doc as any).description);
            const resolvedLocation =
                String(doc.location || doc.address || doc.lieu || '').trim() ||
                String(meta.lieu || '').trim() ||
                undefined;

            // Préparation des données pour le PDF
            const pdfData = {
                ref: doc.ref,
                date: doc.date,
                signed: doc.status === 'signed',
                status: doc.status,
                tvaRate: resolvedTvaRate,
                taxCreditEnabled: !!(doc.hasTaxCredit || doc.taxCreditEnabled),
                clientName: client.name,
                clientEmail: client.email,
                clientPhone: client.phone,
                clientSignature,
                companySignature,
                companyStamp,
                logoBase64,
                subtotal: doc.totalHT || 0,
                tax: doc.totalTTC && doc.totalHT ? (doc.totalTTC - doc.totalHT) : 0,
                total: doc.totalTTC || 0,
                notes: doc.description || '',
                packId: doc.packId,
                packName,
                items: [
                    {
                        description: packName || meta.pack || doc.description || 'Service standard',
                        location: resolvedLocation,
                        quantity: 1,
                        unitPrice: doc.totalHT || 0,
                        total: doc.totalHT || 0
                    }
                ],
                slotsData: doc.slotsData || []
            };

            // Génération du PDF avec react-pdf
            const blob = await pdf(<SignedQuotePDF doc={pdfData} packs={packs} />).toBlob();

            // Téléchargement du fichier
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `Devis_${clientNamePart}${refPart ? `_${refPart}` : ''}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            showToast('Devis signé téléchargé avec succès.');
        } catch (error) {
            console.error('Erreur lors de la génération du PDF:', error);
            showToast('Erreur lors du téléchargement du devis signé.', 'error');
        }
    };

    // Fonction pour extraire le montant du contenu du contrat
    const getContractAmountFromContent = (content: string): number => {
        if (!content) return 0;
        
        // Chercher les montants dans le contenu (formats possibles)
        const patterns = [
            /(\d+(?:\.\d+)?)\s*€/g,
            /(\d+(?:\.\d+)?)\s*euros?/gi,
            /(\d+(?:\.\d+)?)\s*EUR/gi,
            /montant\s*[:\s]*(\d+(?:\.\d+)?)\s*€?/gi,
            /prix\s*[:\s]*(\d+(?:\.\d+)?)\s*€?/gi,
            /tarif\s*[:\s]*(\d+(?:\.\d+)?)\s*€?/gi
        ];
        
        for (const pattern of patterns) {
            const matches = content.match(pattern);
            if (matches && matches.length > 0) {
                // Prendre le premier montant trouvé
                const amountMatch = matches[0].match(/(\d+(?:\.\d+)?)/);
                if (amountMatch) {
                    return parseFloat(amountMatch[1]);
                }
            }
        }
        
        return 0;
    };

    const handleDownloadContract = async (quoteDoc?: any) => {
        showToast('Téléchargement du contrat...');

        // IMPORTANT: certains boutons appelaient onClick={handleDownloadContract} (donc React passe l'event).
        // On sécurise: si l'argument ressemble à un event et n'a pas d'id de devis, on l'ignore.
        const normalizedQuoteDoc = (() => {
            if (!quoteDoc) return undefined;
            const maybeEvent =
                typeof quoteDoc === 'object' &&
                (typeof quoteDoc.preventDefault === 'function' ||
                    (quoteDoc as any)?.nativeEvent ||
                    (quoteDoc as any)?.currentTarget ||
                    (quoteDoc as any)?.target);

            if (maybeEvent && !(quoteDoc as any)?.id) return undefined;
            return quoteDoc;
        })();

        const quoteForDownload = normalizedQuoteDoc || selectedQuote;
        const hasStrictQuoteContext = !!(normalizedQuoteDoc?.id || normalizedQuoteDoc?.ref);

        console.log('Searching contracts for client:', client.id);
        console.log('Available contracts:', contracts.map(c => ({ id: c.id, clientId: c.clientId, status: c.status, name: c.name })));

        const looksLikeHtml = (s: any) => /<\s*html\b|<\s*body\b|<\s*div\b|<\s*h1\b|<\s*style\b/i.test(String(s || '').trim());

        const pickBestContract = (candidates: any[]) => {
            const list = (Array.isArray(candidates) ? candidates : []).filter(Boolean);
            if (list.length === 0) return null;

            const getBestDate = (c: any) => {
                const raw =
                    c?.updatedAt || c?.updated_at ||
                    c?.validatedAt || c?.validated_at ||
                    c?.signedAt || c?.signed_at ||
                    c?.createdAt || c?.created_at ||
                    c?.validationDate || c?.validation_date ||
                    0;
                const ts = new Date(raw || 0).getTime();
                return Number.isFinite(ts) ? ts : 0;
            };

            // Prefer contracts that actually contain HTML content (same branch as admin download)
            const htmlFirst = list.sort((a, b) => {
                const aHtml = looksLikeHtml(a?.content);
                const bHtml = looksLikeHtml(b?.content);
                if (aHtml !== bHtml) return aHtml ? -1 : 1;

                const aDate = getBestDate(a);
                const bDate = getBestDate(b);
                if (aDate !== bDate) return bDate - aDate;

                // final fallback on id for stability
                return String(b?.id || '').localeCompare(String(a?.id || ''));
            });

            return htmlFirst[0] || null;
        };

        // 1) If we know which quote the user clicked, bind the contract to that quote.
        const quoteId = normalizedQuoteDoc?.id;
        const quoteRef = normalizedQuoteDoc?.ref;

        let clientContract = quoteId
            ? pickBestContract(
                contracts.filter(
                    (c: any) =>
                        String(c?.quoteId || c?.quote_id || '') === String(quoteId) &&
                        (c.status === 'active' || c.status === 'pending_validation' || c.status === 'draft')
                )
            )
            : null;

        // 1bis) si le contrat est bien lié au devis mais a un statut différent, on retente sans filtre de statut
        if (!clientContract && quoteId) {
            clientContract = pickBestContract(
                contracts.filter((c: any) => String(c?.quoteId || c?.quote_id || '') === String(quoteId))
            );
        }

        // 2) Fallback par référence de devis (utile si quoteId n'a pas été sauvegardé sur des anciens contrats)
        if (!clientContract && quoteRef) {
            clientContract = pickBestContract(
                contracts.filter((c: any) => {
                    const name = String(c?.name || '');
                    const content = String(c?.content || '');
                    return (
                        (name.includes(String(quoteRef)) || content.includes(String(quoteRef)))
                    );
                })
            );
        }

        // IMPORTANT: si on télécharge depuis un devis, on ne doit JAMAIS retomber sur un autre contrat du client.
        // Si aucun contrat lié au devis n'est trouvé, on génère un contrat depuis le template pour CE devis.
        if (!clientContract && hasStrictQuoteContext && quoteForDownload) {
            console.log('[ContractDownload] Aucun contrat DB lié au devis. Génération via template.', {
                quoteId: (quoteForDownload as any)?.id,
                quoteRef: (quoteForDownload as any)?.ref
            });
            const pack = (quoteForDownload as any)?.packId
                ? packs.find((p: any) => p.id === (quoteForDownload as any).packId)
                : packs.find((p: any) => p.name === client.pack);

            const generated = generateContractFromTemplate(quoteForDownload, client, pack);
            if (generated) {
                await downloadContract(generated);
                showToast('Contrat téléchargé avec succès.');
                return;
            }
        }

        // Mode non-strict (ex: bouton générique) : on autorise les fallbacks existants
        if (!clientContract && !hasStrictQuoteContext) {
            // Fallback: contract(s) by clientId
            clientContract = pickBestContract(
                contracts.filter(c =>
                    c.clientId === client.id &&
                    (c.status === 'active' || c.status === 'pending_validation')
                )
            );
        }

        if (!clientContract && !hasStrictQuoteContext) {
            console.log('Contract not found by clientId, trying name matching fallback');
            clientContract = pickBestContract(
                contracts.filter(c =>
                    c.name && c.name.toLowerCase().includes(client.name.toLowerCase()) &&
                    (c.status === 'active' || c.status === 'pending_validation')
                )
            );
        }

        if (!clientContract && !hasStrictQuoteContext) {
            console.log('Contract not found by name matching, trying any contract with client info');
            clientContract = pickBestContract(contracts.filter(c => {
                const contentLower = String(c.content || '').toLowerCase();
                const clientNameLower = client.name.toLowerCase();
                const clientEmailLower = client.email.toLowerCase();

                return (contentLower.includes(clientNameLower) || contentLower.includes(clientEmailLower)) &&
                    (c.status === 'active' || c.status === 'pending_validation');
            }));
        }

        console.log('[ContractDownload] Found contract:', {
            requestedQuoteId: quoteId,
            requestedQuoteRef: quoteRef,
            contractId: clientContract?.id,
            contractQuoteId: (clientContract as any)?.quoteId || (clientContract as any)?.quote_id
        });

        if (!clientContract) {
            showToast('Aucun contrat trouvé pour votre compte. Les contrats sont créés automatiquement lors de la signature d\'un devis.', 'warning');
            return;
        }

        try {
            const sanitizeFilenamePart = (v: any) =>
                String(v || '')
                    .replace(/[\\/:*?"<>|]/g, '_')
                    .replace(/\s+/g, ' ')
                    .trim();

            const clientNamePart = sanitizeFilenamePart(client?.name || 'Client');
            const contractNamePart = sanitizeFilenamePart(clientContract?.name || clientContract?.id || 'Contrat');
            const quoteRefPart = sanitizeFilenamePart((quoteForDownload as any)?.ref || '');

            const convertDataUrlToPng = async (dataUrl: string): Promise<string> => {
                return await new Promise((resolve, reject) => {
                    const img = new Image();
                    img.onload = () => {
                        const canvas = document.createElement('canvas');
                        canvas.width = img.width;
                        canvas.height = img.height;
                        const ctx = canvas.getContext('2d');
                        if (!ctx) {
                            reject(new Error('Canvas context not available'));
                            return;
                        }
                        ctx.drawImage(img, 0, 0);
                        resolve(canvas.toDataURL('image/png'));
                    };
                    img.onerror = () => reject(new Error('Image load failed'));
                    img.src = dataUrl;
                });
            };

            const ensurePngDataUrl = async (value: any): Promise<any> => {
                if (!value || typeof value !== 'string') return value;
                if (!value.startsWith('data:image/')) return value;
                if (value.startsWith('data:image/png')) return value;
                try {
                    return await convertDataUrlToPng(value);
                } catch {
                    return value;
                }
            };

            const logoBase64 = await ensurePngDataUrl(LOGO_BASE64);
            const companySignatureBase64 = await ensurePngDataUrl(SIGNATURE_BASE64);
            const companyStampBase64 = await ensurePngDataUrl(STAMP_SIGNATURE_BASE64);

            // La signature client est souvent stockée sur le devis (Document.signatureData), pas sur le contrat.
            // On garde la logique existante mais on ajoute un fallback robuste.
            let clientSignatureSource: any = clientContract.clientSignatureUrl || null;
            if (!clientSignatureSource) {
                clientSignatureSource = (quoteForDownload as any)?.signatureData || (quoteForDownload as any)?.clientSignatureUrl || null;
            }
            if (!clientSignatureSource) {
                const signedDocs = documents
                    .filter(d => d.clientId === client.id && d.type === 'Devis' && d.status === 'signed' && d.signatureData)
                    .sort((a: any, b: any) => new Date(b.signatureDate || '').getTime() - new Date(a.signatureDate || '').getTime());
                if (signedDocs.length > 0) clientSignatureSource = signedDocs[0].signatureData;
            }
            const clientSignatureBase64 = await ensurePngDataUrl(clientSignatureSource);

            // Préparation des données pour le PDF
            const pdfData = {
                ref: clientContract.name || `Contrat_${clientContract.id}`,
                date: clientContract.createdAt || getMartiniqueNowISO(),
                duration: clientContract.duration || 'Durée définie dans les conditions',
                clientName: client.name,
                clientEmail: client.email,
                clientPhone: client.phone,
                clientSignature: clientSignatureBase64,
                companySignature: companySignatureBase64,
                companyStamp: companyStampBase64,
                tvaRate: (() => {
                    const fromSelectedQuote = (quoteForDownload as any)?.tvaRate;
                    if (typeof fromSelectedQuote !== 'undefined' && fromSelectedQuote !== null) {
                        const n = typeof fromSelectedQuote === 'number' ? fromSelectedQuote : Number(fromSelectedQuote);
                        if (Number.isFinite(n)) return n;
                    }

                    const fromQuoteId = (clientContract as any)?.quoteId;
                    if (fromQuoteId) {
                        const linked = documents.find((d: any) => String(d?.id) === String(fromQuoteId));
                        const raw = (linked as any)?.tvaRate;
                        const n = typeof raw === 'number' ? raw : Number(raw);
                        if (Number.isFinite(n)) return n;
                    }

                    // fallback: contract.isSap flag if available
                    if ((clientContract as any)?.isSap) return 0;
                    return 0;
                })(),
                logoBase64: (() => {
                    // If TVA=0 => SAP, else normal
                    const raw = (quoteForDownload as any)?.tvaRate;
                    const n = typeof raw === 'number' ? raw : Number(raw);
                    const effective = Number.isFinite(n) ? n : ((clientContract as any)?.isSap ? 0 : 0);
                    return effective === 0 ? LOGO_SAP_BASE64 : (logoBase64 as any);
                })(),
                content: clientContract.content || '',

                companySignatureUrl: COMPANY_SIGNATURE_URL,
                companyStampUrl: COMPANY_STAMP_URL,
                logoUrl: LOGO_NORMAL,
                total: clientContract.amount || getContractAmountFromContent(clientContract.content) || 0,
                paymentTerms: clientContract.paymentTerms || 'Selon conditions générales de vente',
                object: clientContract.object || 'Contrat de services entre Presta Services Antilles et le client',
                // Important: ne pas ré-injecter tout le contenu du contrat dans "services.description",
                // sinon ça crée un doublon en bas (et perd la mise en forme).
                services: clientContract.services || [
                    {
                        name: 'Service principal',
                        description: clientContract.object || 'Description des services à fournir'
                    }
                ]
            };

            const contractHtml = String(clientContract.content || '').trim();
            const looksLikeHtml = /<\s*html\b|<\s*body\b|<\s*div\b|<\s*h1\b|<\s*style\b/i.test(contractHtml);

            if (looksLikeHtml && contractHtml) {
                const logoNormalBase64 = await ensurePngDataUrl(LOGO_BASE64);
                const logoSapBase64 = await ensurePngDataUrl(LOGO_SAP_BASE64);
                const effectiveTvaRate = (() => {
                    const raw = (pdfData as any).tvaRate;
                    const n = typeof raw === 'number' ? raw : Number(raw);
                    return Number.isFinite(n) ? n : 0;
                })();
                const selectedLogoBase64 = effectiveTvaRate === 0 ? logoSapBase64 : logoNormalBase64;
                const filename = hasStrictQuoteContext && quoteRefPart
                    ? `Contrat_${clientNamePart}_Devis_${quoteRefPart}.pdf`
                    : `Contrat_${clientNamePart}_${contractNamePart}.pdf`;
                await downloadHtmlAsPdf({
                    html: contractHtml,
                    filename,
                    title: clientContract.name || `Contrat_${clientContract.id}`,
                    zoom: 0.92,
                    signatureImages: {
                        client: clientSignatureBase64 || null,
                        company: companySignatureBase64 || null,
                        companyStamp: companyStampBase64 || null
                    },
                    signatureDates: {
                        client: (quoteForDownload as any)?.signatureDate || (quoteForDownload as any)?.signedAt || clientContract.signedAt || clientContract.createdAt || null,
                        company: clientContract.validatedAt || null
                    },
                    imageReplacements: {
                        // Provide a generic 'logo' entry so injectLogoIfMissing picks the correct one
                        ['logo']: selectedLogoBase64,
                        [LOGO_NORMAL]: logoNormalBase64,
                        [LOGO_SAP]: logoSapBase64,
                        [COMPANY_SIGNATURE_URL]: companySignatureBase64,
                        [COMPANY_STAMP_URL]: companyStampBase64,

                        // Variantes fréquentes (format/chemins) pour garantir l'affichage logo + cachet
                        ['https://prestaservicesantilles.com/cachetetsignature.webp']: companyStampBase64,
                        ['/cachetetsignature.webp']: companyStampBase64,
                        ['/cachetetsignature.png']: companyStampBase64,
                        ['/images/logo.png']: logoNormalBase64,
                        ['images/logo.png']: logoNormalBase64,
                        ['/src/assets/images/logo.webp']: logoNormalBase64,
                        ['src/assets/images/logo.webp']: logoNormalBase64,
                        ['/assets/images/logo.webp']: logoNormalBase64,
                        ['assets/images/logo.webp']: logoNormalBase64,
                        ['/images/logo.webp']: logoNormalBase64,
                        ['images/logo.webp']: logoNormalBase64,
                        ['/sap.png']: logoSapBase64,
                        ['sap.png']: logoSapBase64
                    }
                });
                showToast('Contrat téléchargé avec succès.');
                return;
            }

            // Génération du PDF avec react-pdf
            const blob = await pdf(<ContractPDF doc={pdfData} packs={packs} />).toBlob();
            
            // Téléchargement du fichier
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = hasStrictQuoteContext && quoteRefPart
                ? `Contrat_${clientNamePart}_Devis_${quoteRefPart}.pdf`
                : `Contrat_${clientNamePart}_${contractNamePart}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            showToast('Contrat téléchargé avec succès.');
        } catch (error) {
            console.error('Erreur lors de la génération du PDF:', error);
            showToast('Erreur lors du téléchargement du contrat.', 'error');
        }
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

    const handleRespondChangeRequest = async (decision: 'approved' | 'rejected') => {
        if (!selectedChangeRequest) return;
        if (isRespondingRequest) return;
        setIsRespondingRequest(true);
        try {
            await respondToMissionReschedule(selectedChangeRequest.id, decision);
            showToast(decision === 'approved'
                ? 'Créneau modifié avec succès !'
                : 'Votre refus a bien été transmis.');
            setIsChangeRequestModalOpen(false);
            setSelectedChangeRequestId(null);
        } catch (error: any) {
            console.error('[ClientPortal] respond change request error:', error);
            showToast(error?.message || 'Impossible de traiter la demande pour le moment.', 'error');
        } finally {
            setIsRespondingRequest(false);
        }
    };

    const selectedQuote = documents.find(d => d.id === selectedQuoteId);

    const parseQuoteDescriptionMeta = (rawValue: any) => {
        const raw = String(rawValue || '');
        const parts = raw.split('|').map(p => p.trim()).filter(Boolean);
        const meta: { pack?: string; duree?: string; lieu?: string; description?: string } = {};

        for (const part of parts) {
            const lower = part.toLowerCase();
            if (lower.startsWith('pack:')) {
                meta.pack = part.replace(/^pack\s*:\s*/i, '').trim();
                continue;
            }
            if (lower.startsWith('durée:') || lower.startsWith('duree:')) {
                meta.duree = part.replace(/^dur(?:ée|e)\s*:\s*/i, '').trim();
                continue;
            }
            if (lower.startsWith('lieu:')) {
                meta.lieu = part.replace(/^lieu\s*:\s*/i, '').trim();
                continue;
            }

            if (!meta.description) {
                meta.description = part;
            } else {
                meta.description = `${meta.description} | ${part}`;
            }
        }

        // Compat: parfois "Lieu: ..." est collé dans la description (sans séparateur "|")
        // => on l'extrait pour l'afficher sur une ligne dédiée.
        if (!meta.lieu && meta.description) {
            const lieuRegex = /\bLieu\s*:\s*(.+)$/i;
            const match = lieuRegex.exec(meta.description);
            if (match && typeof match.index === 'number') {
                const extractedLieu = String(match[1] || '').trim();
                if (extractedLieu) meta.lieu = extractedLieu;

                const before = meta.description.slice(0, match.index).trim();
                meta.description = before.replace(/[\s.]+$/g, '').trim();
            }
        }

        if (!meta.description) meta.description = raw.trim();
        return meta;
    };

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
        <div className="h-full bg-slate-50 flex flex-col overflow-hidden font-sans relative pb-4 md:pb-0">
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
                    <div className="relative" ref={notifDropdownRef}>
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
                                                    <span className="text-[10px] text-slate-400">{formatMartiniqueDate(new Date(n.date))}</span>
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
                    <div className="px-4 pt-4 pb-2 text-xs font-extrabold text-slate-500 uppercase">Menu client</div>
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
                            onClick={() => { window.location.href = isReferrer ? '/parrainage/mon-compte-parrain' : '/parrainage/devenir-parrain-client'; }}
                            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-bold transition-colors text-slate-600 hover:bg-slate-50"
                        >
                            <Award className="w-4 h-4" /> {isReferrer ? 'Mon compte parrain' : 'Devenir parrain (code)'}
                        </button>
                        <button
                            onClick={() => { window.location.href = '/parrainage/inscrire-filleul'; }}
                            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-bold transition-colors text-slate-600 hover:bg-slate-50"
                        >
                            <Package className="w-4 h-4" /> Inscrire un filleul
                        </button>
                        <button
                            onClick={() => { window.location.href = '/parrainage/mes-points'; }}
                            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-bold transition-colors text-slate-600 hover:bg-slate-50"
                        >
                            <History className="w-4 h-4" /> Mes points parrainage
                        </button>
                        <button
                            onClick={() => { window.location.href = '/flyers'; }}
                            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-bold transition-colors text-slate-600 hover:bg-slate-50"
                        >
                            <Megaphone className="w-4 h-4" /> Offres / Flyers
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
                    <div className="px-2 pb-2 text-xs font-extrabold text-slate-500 uppercase">Menu client</div>
                    <button onClick={() => setActiveTab('planning')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-bold transition-colors ${activeTab === 'planning' ? 'bg-brand-blue text-white' : 'text-slate-600 hover:bg-slate-50'}`}><Calendar className="w-4 h-4" /> Mon Planning</button>
                    <button onClick={() => setActiveTab('docs')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-bold transition-colors ${activeTab === 'docs' ? 'bg-brand-blue text-white' : 'text-slate-600 hover:bg-slate-50'}`}><FileText className="w-4 h-4" /> Devis & Factures</button>
                    <button onClick={() => setActiveTab('messages')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-bold transition-colors ${activeTab === 'messages' ? 'bg-brand-blue text-white' : 'text-slate-600 hover:bg-slate-50'}`}><MessageSquare className="w-4 h-4" /> Messages</button>
                    <button onClick={() => setActiveTab('qr-scans')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-bold transition-colors ${activeTab === 'qr-scans' ? 'bg-brand-blue text-white' : 'text-slate-600 hover:bg-slate-50'}`}><QrCode className="w-4 h-4" /> QR Code & Pointage</button>
                    <button onClick={() => setActiveTab('profile')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-bold transition-colors ${activeTab === 'profile' ? 'bg-brand-blue text-white' : 'text-slate-600 hover:bg-slate-50'}`}><User className="w-4 h-4" /> Mon Profil</button>
                    
                    <button onClick={() => { window.location.href = isReferrer ? '/parrainage/mon-compte-parrain' : '/parrainage/devenir-parrain-client'; }} className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-bold transition-colors text-slate-600 hover:bg-slate-50"><Award className="w-4 h-4" /> {isReferrer ? 'Mon compte parrain' : 'Devenir parrain (code)'}</button>
                    <button onClick={() => { window.location.href = '/parrainage/inscrire-filleul'; }} className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-bold transition-colors text-slate-600 hover:bg-slate-50"><Package className="w-4 h-4" /> Inscrire un filleul</button>
                    <button onClick={() => { window.location.href = '/parrainage/mes-points'; }} className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-bold transition-colors text-slate-600 hover:bg-slate-50"><History className="w-4 h-4" /> Mes points parrainage</button>
                    <button onClick={() => { window.location.href = '/flyers'; }} className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-bold transition-colors text-slate-600 hover:bg-slate-50"><Megaphone className="w-4 h-4" /> Offres / Flyers</button>
                    
                    <button onClick={() => setActiveTab('live')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-bold transition-colors relative ${activeTab === 'live' ? 'bg-red-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}><Wifi className={`w-4 h-4 ${isLive ? 'animate-pulse' : ''}`} /> Direct Vidéo {isLive && <span className="absolute right-3 w-2 h-2 bg-green-400 rounded-full ring-2 ring-white animate-pulse"></span>}</button>
                </nav>

                <main className="flex-1 p-4 md:p-8 overflow-y-auto pb-24 md:pb-8">
                    {activeTab === 'qr-scans' && (
                        <ClientQRCode />
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
                            {isReferrer && referralLink ? (
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
                            <h2 className="text-2xl font-bold text-slate-800">Mon Planning</h2>

                            <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 sm:p-5 shadow-sm">
                                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
                                    <div>
                                        <p className="text-sm font-semibold text-amber-700 uppercase">Demande du secrétariat</p>
                                        <h3 className="text-lg font-bold text-slate-800">Validation de changement de créneau</h3>
                                        <p className="text-sm text-slate-600">
                                            Merci de confirmer ou refuser la proposition avant la prochaine intervention.
                                        </p>
                                    </div>
                                    <span className="px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-xs font-bold self-start md:self-auto">
                                        {clientPendingChangeRequests.length} en attente
                                    </span>
                                </div>

                                {clientPendingChangeRequests.length === 0 ? (
                                    <div className="bg-white border border-amber-100 rounded-xl p-4 text-sm text-slate-600">
                                        Aucune demande en attente pour le moment.
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {clientPendingChangeRequests.map(req => (
                                            <div key={req.id} className="bg-white border border-amber-100 rounded-xl p-4 flex flex-col gap-3 shadow-sm">
                                                <div className="flex flex-wrap items-center justify-between gap-2">
                                                    <div>
                                                        <p className="text-xs text-slate-500 uppercase tracking-wide">Mission</p>
                                                        <p className="font-bold text-slate-800">
                                                            {req.mission?.service || 'Intervention'}
                                                        </p>
                                                        {req.mission?.providerName && (
                                                            <p className="text-xs text-slate-500">
                                                                Prestataire: <span className="font-medium text-slate-700">{req.mission.providerName}</span>
                                                            </p>
                                                        )}
                                                    </div>
                                                    <button
                                                        onClick={() => {
                                                            setSelectedChangeRequestId(req.id);
                                                            setIsChangeRequestModalOpen(true);
                                                        }}
                                                        className="w-full sm:w-auto px-4 py-2 bg-amber-600 text-white text-sm font-semibold rounded-lg hover:bg-amber-700 transition"
                                                    >
                                                        Voir la proposition
                                                    </button>
                                                </div>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                                                    <div className="border border-slate-100 rounded-lg p-3">
                                                        <p className="text-[11px] uppercase text-slate-400 font-bold">Créneau actuel</p>
                                                        <p className="font-semibold text-slate-800 mt-1">{formatMartiniqueDate(req.oldDate)}</p>
                                                        <p className="text-slate-600 text-sm">{req.oldStartTime} - {req.oldEndTime}</p>
                                                    </div>
                                                    <div className="border border-amber-200 rounded-lg p-3 bg-amber-50">
                                                        <p className="text-[11px] uppercase text-amber-600 font-bold">Nouveau créneau proposé</p>
                                                        <p className="font-semibold text-slate-800 mt-1">{formatMartiniqueDate(req.newDate)}</p>
                                                        <p className="text-slate-700 text-sm">{req.newStartTime} - {req.newEndTime}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Filtres du planning */}
                            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
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
                                            <div key={m.id} className={`bg-white p-4 sm:p-6 rounded-xl border-l-4 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ${m.status === 'cancelled' ? 'border-red-400 opacity-60' : m.status === 'completed' ? 'border-green-500' : 'border-brand-blue'}`}>
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
                                                onClick={() => {
                                                    const url = 'https://www.google.com/search?q=Presta+Services+Antilles+avis';
                                                    window.open(url, '_blank');
                                                }}
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
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
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
                                                    {doc.type === 'Devis' ? (
                                                        <button
                                                            onClick={() => openQuoteModal(doc.id)}
                                                            className="text-brand-blue hover:underline cursor-pointer font-bold text-lg"
                                                            title="Voir les détails du devis"
                                                        >
                                                            {doc.ref}
                                                        </button>
                                                    ) : (
                                                        <span className="text-slate-700 font-bold text-lg">
                                                            {doc.ref}
                                                        </span>
                                                    )}
                                                    <div className="text-xs text-slate-500 mt-1">
                                                    {(() => {
                                                        const ts = (doc as any)?.created_at || (doc as any)?.createdAt || doc.date;
                                                        if (!ts) return doc.date;

                                                        // Éviter les décalages quand doc.date est un simple YYYY-MM-DD (interprété en UTC par Date)
                                                        const rawDate = String((doc as any)?.date || '').trim();
                                                        const dateStr = /^\d{4}-\d{2}-\d{2}$/.test(rawDate)
                                                            ? rawDate.split('-').reverse().join('/')
                                                            : formatMartiniqueDate(ts);

                                                        const timeStr = formatMartiniqueDateTime(ts, { hour: '2-digit', minute: '2-digit' });
                                                        return (
                                                            <>
                                                                {dateStr}
                                                                {timeStr ? <span className="ml-1">à {timeStr}</span> : null}
                                                            </>
                                                        );
                                                    })()}
                                                    {(() => {
                                                        const packFromId = (doc as any).packId
                                                            ? (packs.find((p: any) => p.id === (doc as any).packId)?.name || '')
                                                            : '';
                                                        const meta = parseQuoteDescriptionMeta((doc as any).description);
                                                        const packName = packFromId || meta.pack || '';
                                                        const isCustom = (doc as any)?.category === 'custom';
                                                        const label = packName || (isCustom ? 'Sur mesure' : '');

                                                        if (!label) return null;

                                                        return (
                                                            <span className="block text-xs text-blue-600 font-medium mt-1">
                                                                {label}
                                                            </span>
                                                        );
                                                    })()}
                                                </div>
                                                </div>
                                                <span className={`px-2 py-1 rounded-full text-xs font-bold ${doc.type === 'Devis' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'
                                                    }`}>
                                                    {doc.type}
                                                </span>
                                            </div>

                                            {/* Statut et montant */}
                                            <div className="flex justify-between items-center mb-4">
                                                <div className="text-lg font-bold text-slate-800">
                                                    {doc.totalTTC ? doc.totalTTC.toFixed(2) : '0.00'} €
                                                </div>
                                                <div className="text-center">
                                                    {doc.status === 'sent' && <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded-full text-xs font-bold">À signer</span>}
                                                    {doc.status === 'signed' && <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-bold">Signé</span>}
                                                    {doc.status === 'paid' && <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-bold">Payé</span>}
                                                    {doc.status === 'pending' && <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full text-xs font-bold">À régler</span>}
                                                    {doc.status === 'converted' && <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded-full text-xs font-bold">Facturé</span>}
                                                    {doc.status === 'rejected' && <span className="bg-red-100 text-red-800 px-2 py-1 rounded-full text-xs font-bold">Refusé</span>}
                                                    {doc.type === 'Devis' && doc.status === 'sent' && isQuoteExpired(doc) && (
                                                        <span className="bg-slate-200 text-slate-700 px-2 py-1 rounded-full text-xs font-bold">Expiré</span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Actions */}
                                            <div className="flex flex-wrap gap-2">
                                                {/* Dropdown d'actions pour les devis */}
                                                {doc.type === 'Devis' ? (
                                                    <div className="relative">
                                                        <button
                                                            onClick={() => setActiveDropdown(activeDropdown === doc.id ? null : doc.id)}
                                                            className="flex-1 bg-brand-blue text-white text-xs font-bold px-3 py-2 rounded hover:bg-blue-600 transition flex items-center justify-center gap-1"
                                                        >
                                                            Actions <ChevronDown className="w-3 h-3" />
                                                        </button>
                                                        {activeDropdown === doc.id && (
                                                            <div className="absolute top-full left-0 mt-1 w-52 bg-white border border-slate-200 rounded-lg shadow-xl z-10 overflow-hidden">
                                                                {doc.status === 'signed' && (
                                                                    <button
                                                                        onClick={() => {
                                                                            handleDownloadContract(doc);
                                                                            setActiveDropdown(null);
                                                                        }}
                                                                        className="w-full text-left px-4 py-3 text-sm hover:bg-slate-50 transition flex items-center gap-3 border-b border-slate-100"
                                                                    >
                                                                        <FileText className="w-4 h-4 text-blue-600" /> 
                                                                        <div>
                                                                            <div className="font-medium">Télécharger contrat</div>
                                                                            <div className="text-xs text-slate-500">Format PDF</div>
                                                                        </div>
                                                                    </button>
                                                                )}
                                                                {doc.status === 'signed' && (
                                                                    <button
                                                                        onClick={() => {
                                                                            handleDownloadInvoice(doc);
                                                                            setActiveDropdown(null);
                                                                        }}
                                                                        className="w-full text-left px-4 py-3 text-sm hover:bg-slate-50 transition flex items-center gap-3 border-b border-slate-100"
                                                                    >
                                                                        <Download className="w-4 h-4 text-green-600" /> 
                                                                        <div>
                                                                            <div className="font-medium">Facture</div>
                                                                            <div className="text-xs text-slate-500">Télécharger PDF</div>
                                                                        </div>
                                                                    </button>
                                                                )}
                                                                {doc.status === 'signed' && (
                                                                    <button
                                                                        onClick={() => {
                                                                            handleDownloadSignedQuote(doc);
                                                                            setActiveDropdown(null);
                                                                        }}
                                                                        className="w-full text-left px-4 py-3 text-sm hover:bg-slate-50 transition flex items-center gap-3"
                                                                    >
                                                                        <FileSignature className="w-4 h-4 text-purple-600" /> 
                                                                        <div>
                                                                            <div className="font-medium">Télécharger devis</div>
                                                                            <div className="text-xs text-slate-500">Avec signatures</div>
                                                                        </div>
                                                                    </button>
                                                                )}
                                                                {doc.status !== 'signed' && (
                                                                    <button
                                                                        onClick={() => {
                                                                            handleDownloadContract(doc);
                                                                            setActiveDropdown(null);
                                                                        }}
                                                                        className="w-full text-left px-4 py-3 text-sm hover:bg-slate-50 transition flex items-center gap-3 border-b border-slate-100"
                                                                    >
                                                                        <FileText className="w-4 h-4 text-blue-600" /> 
                                                                        <div>
                                                                            <div className="font-medium">Télécharger contrat</div>
                                                                            <div className="text-xs text-slate-500">Format PDF</div>
                                                                        </div>
                                                                    </button>
                                                                )}
                                                                {doc.status !== 'signed' && (
                                                                    <button
                                                                        onClick={() => {
                                                                            handleDownloadSignedQuote(doc);
                                                                            setActiveDropdown(null);
                                                                        }}
                                                                        className="w-full text-left px-4 py-3 text-sm hover:bg-slate-50 transition flex items-center gap-3"
                                                                    >
                                                                        <FileSignature className="w-4 h-4 text-purple-600" /> 
                                                                        <div>
                                                                            <div className="font-medium">Télécharger devis</div>
                                                                            <div className="text-xs text-slate-500">Format PDF</div>
                                                                        </div>
                                                                    </button>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    /* Bouton simple pour les factures */
                                                    <button
                                                        onClick={() => handleDownloadInvoice(doc)}
                                                        className="flex-1 bg-slate-100 text-slate-700 text-xs font-bold px-3 py-2 rounded hover:bg-slate-200 transition flex items-center justify-center gap-1"
                                                        title="Télécharger la facture"
                                                    >
                                                        <Download className="w-3 h-3" /> Facture
                                                    </button>
                                                )}

                                                {doc.type === 'Devis' && doc.status === 'sent' && !isQuoteExpired(doc) && (
                                                    <button
                                                        onClick={() => openQuoteModal(doc.id)}
                                                        className="flex-1 bg-brand-orange text-white text-xs font-bold px-3 py-2 rounded hover:bg-orange-600 transition flex items-center justify-center gap-1"
                                                    >
                                                        <PenTool className="w-3 h-3" /> Consulter
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
                                                <p className={`text-[10px] mt-1 text-right ${msg.sender === 'client' ? 'text-blue-200' : 'text-slate-400'}`}>{formatMartiniqueDateTime(msg.date)}</p>
                                            </div>
                                        </div>
                                    ))
                                )}
                                <div ref={messagesEndRef} />
                            </div>
                            <form onSubmit={handleSendMessage} className="p-4 bg-white border-t border-slate-100 flex gap-2">
                                <input
                                    ref={messageInputRef}
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
                            {showVideoCall && activeStream ? (
                                <VideoCallManagerImproved
                                    sessionId={activeStream.id}
                                    isInitiator={isCallInitiator}
                                    onEnd={() => {
                                        setShowVideoCall(false);
                                        setIsCallInitiator(false);
                                    }}
                                />
                            ) : (
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
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => {
                                                            setShowVideoCall(true);
                                                            setIsCallInitiator(false);
                                                        }}
                                                        className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors"
                                                    >
                                                        <Video className="w-5 h-5" />
                                                        Rejoindre l'Appel
                                                    </button>
                                                    <button 
                                                        onClick={() => {
                                                            stopLiveStream();
                                                            showToast('Appel vidéo terminé');
                                                        }}
                                                        className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors"
                                                    >
                                                        <X className="w-5 h-5" />
                                                        Raccrocher
                                                    </button>
                                                </div>
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
                                                        <p className="text-slate-400">L'intervenant vous contacte en vidéo</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="text-center text-slate-500 p-8">
                                            <Wifi className="w-16 h-16 mx-auto mb-4 opacity-20" />
                                            <h3 className="text-xl font-bold text-slate-400">Hors Ligne</h3>
                                            <p className="text-sm mb-4">Aucun flux vidéo actif pour le moment.</p>
                                            <p className="text-xs text-slate-500 mb-6">Vous recevrez une notification lorsqu'un intervenant lancera un appel vidéo.</p>
                                            
                                            {/* Afficher les appels vidéo récents */}
                                            {hasRecentVideoCalls && (
                                                <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                                                    <h4 className="font-medium text-blue-900 mb-2 flex items-center gap-2">
                                                        <Video className="w-4 h-4" />
                                                        Appels vidéo récents
                                                    </h4>
                                                    <div className="text-sm text-blue-700">
                                                        <p>Vous avez des appels vidéo récents. Consultez la section Replay ci-dessous.</p>
                                                    </div>
                                                </div>
                                            )}
                                            
                                            {/* Instructions pour tester */}
                                            <div className="mt-6 p-4 bg-amber-50 rounded-lg border border-amber-200">
                                                <h4 className="font-medium text-amber-900 mb-2 flex items-center gap-2">
                                                    <AlertTriangle className="w-4 h-4" />
                                                    Test d'appel vidéo
                                                </h4>
                                                <div className="text-sm text-amber-700 text-left">
                                                    <p>• Un intervenant peut démarrer un appel depuis son portail</p>
                                                    <p>• Vous recevrez une notification sonore et visuelle</p>
                                                    <p>• Cliquez sur la notification pour rejoindre l'appel</p>
                                                    <p>• L'appel sera enregistré automatiquement</p>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {selectedQuote && selectedQuote.status === 'sent' && isQuoteExpired(selectedQuote) && (
                                <div className="w-full md:w-1/3 bg-white flex flex-col p-6 border-t md:border-t-0 md:border-l border-slate-200">
                                    <h4 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
                                        <Lock className="w-4 h-4" /> Devis expiré
                                    </h4>
                                    <div className="text-sm text-slate-700 bg-orange-50 border border-orange-200 rounded-xl p-4">
                                        Ce devis a expiré (délai de 48h dépassé). La signature est désactivée.
                                    </div>
                                </div>
                            )}

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
                                                            <button
                                                                onClick={() => {
                                                                    const url = recording.replayUrl || recording.recordingUrl || (recording as any).url;
                                                                    if (url) window.open(url, '_blank', 'noopener,noreferrer');
                                                                }}
                                                                className="bg-brand-blue text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors"
                                                            >
                                                                <Play className="w-4 h-4" />
                                                                Voir
                                                            </button>
                                                        ) : recording.status === 'processing' ? (
                                                            <button disabled className="bg-slate-200 text-slate-500 px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2">
                                                                <div className="w-10 h-3 bg-slate-300/70 rounded animate-pulse" />
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
            <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex justify-around items-center h-14 pb-safe z-40">
                <button
                    onClick={() => setActiveTab('planning')}
                    className={`p-2 rounded-lg transition ${activeTab === 'planning' ? 'text-brand-blue' : 'text-slate-400'}`}
                    aria-label="Planning"
                >
                    <Calendar className="w-6 h-6" />
                </button>
                <button
                    onClick={() => setActiveTab('docs')}
                    className={`p-2 rounded-lg transition ${activeTab === 'docs' ? 'text-brand-blue' : 'text-slate-400'}`}
                    aria-label="Documents"
                >
                    <FileText className="w-6 h-6" />
                </button>
                <button
                    onClick={() => setActiveTab('messages')}
                    className={`p-2 rounded-lg transition ${activeTab === 'messages' ? 'text-brand-blue' : 'text-slate-400'}`}
                    aria-label="Messages"
                >
                    <MessageSquare className="w-6 h-6" />
                </button>
                <button
                    onClick={() => setActiveTab('profile')}
                    className={`p-2 rounded-lg transition ${activeTab === 'profile' ? 'text-brand-blue' : 'text-slate-400'}`}
                    aria-label="Profil"
                >
                    <User className="w-6 h-6" />
                </button>
            </div>

            {isChangeRequestModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="p-4 border-b bg-amber-50 flex justify-between items-center">
                            <div>
                                <h3 className="font-bold text-lg text-slate-800">Proposition de changement de créneau</h3>
                                <p className="text-xs text-slate-600">Merci de confirmer ou refuser la proposition.</p>
                            </div>
                            <button
                                onClick={() => {
                                    setIsChangeRequestModalOpen(false);
                                    setSelectedChangeRequestId(null);
                                }}
                                className="p-2 hover:bg-amber-100 rounded-full transition"
                            >
                                <X className="w-5 h-5 text-slate-600" />
                            </button>
                        </div>

                        <div className="p-5 space-y-4">
                            {!selectedChangeRequest ? (
                                <div className="bg-white border border-slate-200 rounded-xl p-4 text-sm text-slate-600">
                                    Impossible d'afficher la proposition pour le moment. Merci de réessayer.
                                </div>
                            ) : (
                                (() => {
                                    const mission = missions.find(m => m.id === selectedChangeRequest.missionId) || null;
                                    return (
                                        <>
                                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                                                <p className="text-xs text-slate-500 uppercase tracking-wide">Mission</p>
                                                <p className="font-bold text-slate-800">
                                                    {mission?.service || 'Intervention'}
                                                </p>
                                                {mission?.providerName ? (
                                                    <p className="text-xs text-slate-500 mt-1">
                                                        Prestataire: <span className="font-medium text-slate-700">{mission.providerName}</span>
                                                    </p>
                                                ) : null}
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div className="border border-slate-200 rounded-xl p-4">
                                                    <p className="text-[11px] uppercase text-slate-400 font-bold">Créneau actuel</p>
                                                    <p className="font-semibold text-slate-800 mt-2 flex items-center gap-2">
                                                        <Calendar className="w-4 h-4 text-slate-400" />
                                                        {formatMartiniqueDate(selectedChangeRequest.oldDate)}
                                                    </p>
                                                    <p className="text-slate-600 text-sm flex items-center gap-2 mt-1">
                                                        <ClockIcon className="w-4 h-4 text-slate-400" />
                                                        {selectedChangeRequest.oldStartTime} - {selectedChangeRequest.oldEndTime}
                                                    </p>
                                                </div>
                                                <div className="border border-amber-200 bg-amber-50 rounded-xl p-4">
                                                    <p className="text-[11px] uppercase text-amber-700 font-bold">Nouveau créneau proposé</p>
                                                    <p className="font-semibold text-slate-800 mt-2 flex items-center gap-2">
                                                        <Calendar className="w-4 h-4 text-amber-600" />
                                                        {formatMartiniqueDate(selectedChangeRequest.newDate)}
                                                    </p>
                                                    <p className="text-slate-700 text-sm flex items-center gap-2 mt-1">
                                                        <ClockIcon className="w-4 h-4 text-amber-600" />
                                                        {selectedChangeRequest.newStartTime} - {selectedChangeRequest.newEndTime}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2">
                                                <button
                                                    onClick={() => handleRespondChangeRequest('rejected')}
                                                    disabled={isRespondingRequest}
                                                    className="flex-1 px-4 py-3 rounded-xl font-bold border border-red-200 text-red-600 hover:bg-red-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    Refuser
                                                </button>
                                                <button
                                                    onClick={() => handleRespondChangeRequest('approved')}
                                                    disabled={isRespondingRequest}
                                                    className="flex-1 px-4 py-3 rounded-xl font-bold bg-green-600 text-white hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    Accepter
                                                </button>
                                            </div>
                                        </>
                                    );
                                })()
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* QUOTE SIGNATURE MODAL */}
            {showSaturationError ? (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/90 backdrop-blur-md p-6">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 text-center animate-in fade-in zoom-in duration-300">
                        <div className="w-20 h-20 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-6 border-4 border-red-100">
                            <AlertTriangle className="w-10 h-10 text-red-500" />
                        </div>
                        <h3 className="text-2xl font-serif font-bold text-slate-800 mb-3">Créneaux Indisponibles</h3>
                        <p className="text-slate-600 mb-8 leading-relaxed">
                            Désolé, nous n'avons plus de prestataire disponible pour le moment sur les créneaux demandés.
                            <br/><br/>
                            <span className="text-xs bg-slate-100 px-2 py-1 rounded text-slate-500 font-mono">{saturationErrorMessage}</span>
                        </p>
                        
                        <div className="space-y-3">
                            <button
                                onClick={handleContactSupportRedirect}
                                className="w-full py-4 rounded-xl bg-slate-900 text-white font-bold text-lg hover:bg-slate-800 transition shadow-lg shadow-slate-200 flex items-center justify-center gap-2"
                            >
                                <MessageSquare className="w-5 h-5" />
                                Contacter le support
                            </button>
                            <button
                                onClick={() => setShowSaturationError(false)}
                                className="w-full py-3 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition"
                            >
                                Fermer
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}

            {quoteModalOpen && selectedQuote && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="p-4 border-b bg-cream-50 flex justify-between items-center">
                            <h3 className="font-serif font-bold text-xl text-slate-800">Consultation du Devis {selectedQuote.ref}</h3>
                            <div className="flex items-center gap-2">
                                {selectedQuote.status === 'sent' && !isQuoteExpired(selectedQuote) && (
                                    <>
                                        <button
                                            onClick={() => handleDownloadContract(selectedQuote)}
                                            className="px-3 py-2 text-green-600 font-bold hover:bg-green-50 rounded-xl border border-transparent hover:border-green-100 transition text-sm"
                                        >
                                            Télécharger contrat
                                        </button>
                                        <button
                                            onClick={() => handleRefuse(selectedQuote.id)}
                                            className="px-3 py-2 text-red-500 font-bold hover:bg-red-50 rounded-xl border border-transparent hover:border-red-100 transition text-sm"
                                        >
                                            Refuser
                                        </button>
                                    </>
                                )}
                                {selectedQuote.status === 'signed' && (
                                    <>
                                        <button
                                            onClick={() => handleDownloadSignedQuote(selectedQuote)}
                                            className="px-3 py-2 text-purple-600 font-bold hover:bg-purple-50 rounded-xl border border-transparent hover:border-purple-100 transition text-sm"
                                        >
                                            Télécharger devis
                                        </button>
                                        <button
                                            onClick={() => handleDownloadContract(selectedQuote)}
                                            className="px-3 py-2 text-green-600 font-bold hover:bg-green-50 rounded-xl border border-transparent hover:border-green-100 transition text-sm"
                                        >
                                            Télécharger contrat
                                        </button>
                                    </>
                                )}
                                <button onClick={() => setQuoteModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full"><X className="w-5 h-5 text-slate-500" /></button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
                            {/* Document Viewer - Partie plus grande pour le devis */}
                            <div className="flex-1 md:flex-[2] bg-slate-100 p-4 md:p-6 overflow-y-auto border-r border-slate-200">
                                <div className="bg-white shadow-sm p-4 md:p-8 min-h-full text-xs md:text-sm text-slate-800 leading-relaxed" style={{ fontFamily: 'Times New Roman, serif' }}>
                                    <div className="flex justify-between mb-8 border-b pb-4">
                                        <div className="w-20">
                                            <img
                                                src={LOGO_NORMAL}
                                                alt="Logo"
                                                className="w-full"
                                                onError={(e) => {
                                                    const img = e.currentTarget as HTMLImageElement;
                                                    if (img && img.src !== LOGO_BASE64) img.src = LOGO_BASE64;
                                                }}
                                            />
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
                                                        <strong>Créneau {index + 1} :</strong> {slot.date || 'Date à définir'} de {slot.startTime || 'Heure à définir'} à {slot.endTime || 'Heure de fin à définir'}
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
                                        {(() => {
                                            const meta = parseQuoteDescriptionMeta((selectedQuote as any).description);
                                            const packFromId = (selectedQuote as any).packId ? (packs.find((p: any) => p.id === (selectedQuote as any).packId)?.name || '') : '';
                                            const packToShow = packFromId || meta.pack || '';

                                            return (
                                                <>
                                                    {packToShow ? (
                                                        <p className="text-sm"><strong>Pack :</strong> {packToShow}</p>
                                                    ) : null}
                                                    <p className="text-sm"><strong>Description :</strong> {meta.description || ''}</p>
                                                    {meta.duree ? (
                                                        <p className="text-sm"><strong>Durée :</strong> {meta.duree}</p>
                                                    ) : null}
                                                    {meta.lieu ? (
                                                        <p className="text-sm"><strong>Lieu :</strong> {meta.lieu}</p>
                                                    ) : null}
                                                </>
                                            );
                                        })()}
                                        <p className="text-sm"><strong>Taux TVA :</strong> {selectedQuote.tvaRate || 0}%</p>
                                        <p className="text-sm font-bold text-lg"><strong>Total TTC :</strong> {selectedQuote.totalTTC ? selectedQuote.totalTTC.toFixed(2) : '0.00'} €</p>
                                        
                                        {/* Affichage du crédit d'impôt si activé */}
                                        {(selectedQuote.hasTaxCredit || selectedQuote.taxCreditEnabled) && (
                                            <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                                                <p className="text-sm text-green-800 font-bold">
                                                    <strong>Crédit d'impôt : </strong>
                                                    -{((selectedQuote.totalTTC || 0) * 0.5).toFixed(2)} € (50%)
                                                </p>
                                                <p className="text-sm text-green-700 font-bold mt-1">
                                                    <strong>Reste à charge après crédit d'impôt : </strong>
                                                    {((selectedQuote.totalTTC || 0) * 0.5).toFixed(2)} €
                                                </p>
                                            </div>
                                        )}
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
                                            <p className="font-bold mb-2">Pour l'entreprise :</p>
                                            <div className="space-y-2">
                                                <img src="https://anciens.prestaservicesantilles.com/cachetetsignature.png" alt="Signature entreprise" className="h-12 border border-slate-300 rounded" />
                                                {selectedQuote.status === 'signed' && (
                                                    <div className="text-green-600 font-bold text-xs uppercase border-2 border-green-600 p-2 inline-block rounded">
                                                        Validé & Signé
                                                    </div>
                                                )}
                                                {selectedQuote.signatureDate && (
                                                    <p className="text-xs text-slate-600">Signé le {new Date(selectedQuote.signatureDate).toLocaleDateString('fr-FR')}</p>
                                                )}
                                            </div>
                                        </div>
                                        <div className="w-1/2 pl-4">
                                            <p className="font-bold mb-2">Pour le client :</p>
                                            {selectedQuote.status === 'signed' && selectedQuote.signatureData ? (
                                                <div className="space-y-2">
                                                    <img src={selectedQuote.signatureData} alt="Signature client" className="h-16 border border-slate-300 rounded shadow-sm" />
                                                    <p className="text-xs text-green-600 font-bold">Signature enregistrée</p>
                                                    {selectedQuote.signatureDate && (
                                                        <p className="text-xs text-slate-600">Signé le {new Date(selectedQuote.signatureDate).toLocaleDateString('fr-FR')}</p>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="border-2 border-slate-300 h-12 rounded flex items-center justify-center text-xs text-slate-400">
                                                    
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Legal Checkbox */}
                                    <div className="mt-8 p-4 bg-blue-50 border border-blue-100 rounded-lg">
                                        <label className="flex items-start gap-3 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                className="mt-1 w-5 h-5 text-brand-blue rounded"
                                                checked={selectedQuote.status === 'signed' ? true : termsAccepted}
                                                onChange={(e) => setTermsAccepted(e.target.checked)}
                                                disabled={selectedQuote.status === 'signed'}
                                            />
                                            <span className="text-sm font-bold text-slate-700">
                                                Je reconnais avoir pris connaissance des conditions générales de vente et j'accepte les termes du contrat.{" "}
                                                {(() => {
                                                    const total = Number(selectedQuote.totalTTC || 0);
                                                    const creditActive = !!((selectedQuote as any).hasTaxCredit || (selectedQuote as any).taxCreditEnabled);
                                                    const toPay = creditActive ? total * 0.5 : total;
                                                    return (
                                                        <>
                                                            Je m'engage à régler le montant de {toPay.toFixed(2)} € TTC. 
                                                            {creditActive ? (
                                                                <span className="block text-green-700 font-bold mt-1">
                                                                    Crédit d'impôt activé (-50%) : reste à charge {toPay.toFixed(2)} €
                                                                </span>
                                                            ) : null}
                                                        </>
                                                    );
                                                })()}
                                                {selectedQuote.status === 'signed' && (
                                                    <span className="block text-green-600 font-bold mt-1">✓ Conditions acceptées et signées</span>
                                                )}
                                            </span>
                                        </label>
                                    </div>
                                </div>
                            </div>

                            {/* Signature Pad - Only show for quotes that can be signed */}
                            {selectedQuote.status === 'sent' && !isQuoteExpired(selectedQuote) && (
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
                                            disabled={!termsAccepted || !hasSignature || isSubmittingSignature}
                                            className="w-full py-3 bg-brand-blue text-white font-bold rounded-xl hover:bg-teal-700 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition"
                                        >
                                            {isSubmittingSignature ? (
                                                <span className="inline-flex items-center justify-center gap-2">
                                                    <div className="w-10 h-3 bg-white/40 rounded animate-pulse" />
                                                    Signature en cours...
                                                </span>
                                            ) : (
                                                'Signer et Valider'
                                            )}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Mobile Action Buttons */}
                            {selectedQuote.status === 'sent' && !isQuoteExpired(selectedQuote) && (
                                <div className="md:hidden fixed bottom-24 right-4 z-40 flex flex-col gap-2">
                                    <button
                                        onClick={() => handleDownloadContract(selectedQuote)}
                                        className="bg-green-600 text-white px-4 py-3 rounded-full shadow-lg hover:bg-green-700 transition flex items-center gap-2"
                                    >
                                        <Download className="w-4 h-4" />
                                        <span className="text-sm font-bold">Contrat</span>
                                    </button>
                                    <button
                                        onClick={() => setShowSignatureModal(true)}
                                        disabled={!termsAccepted}
                                        className="bg-brand-blue text-white px-4 py-3 rounded-full shadow-lg hover:bg-teal-700 transition flex items-center gap-2"
                                    >
                                        <PenTool className="w-4 h-4" />
                                        <span className="text-sm font-bold">Signer</span>
                                    </button>
                                </div>
                            )}
                            
                            {/* Mobile Download Contract Button for Signed Quotes */}
                            {selectedQuote.status === 'signed' && (
                                <div className="md:hidden fixed bottom-24 right-4 z-40">
                                    <button
                                        onClick={() => handleDownloadContract(selectedQuote)}
                                        className="bg-green-600 text-white px-4 py-3 rounded-full shadow-lg hover:bg-green-700 transition flex items-center gap-2"
                                    >
                                        <Download className="w-4 h-4" />
                                        <span className="text-sm font-bold">Contrat</span>
                                    </button>
                                </div>
                            )}

                            {/* Mobile Signature Modal */}
                            {showSignatureModal && !isQuoteExpired(selectedQuote) && (
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

                                            <div className="text-sm font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                                                {(() => {
                                                    const total = Number((selectedQuote as any)?.totalTTC || 0);
                                                    const creditActive = !!((selectedQuote as any)?.hasTaxCredit || (selectedQuote as any)?.taxCreditEnabled);
                                                    const toPay = creditActive ? total * 0.5 : total;
                                                    return (
                                                        <>
                                                            Montant à régler : {toPay.toFixed(2)} € TTC
                                                            {creditActive ? (
                                                                <span className="block text-xs text-green-700 mt-1">Crédit d'impôt activé (-50%)</span>
                                                            ) : null}
                                                        </>
                                                    );
                                                })()}
                                            </div>

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
                                                    onClick={() => handleDownloadContract(selectedQuote)}
                                                    className="w-full py-2 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 transition flex items-center justify-center gap-2"
                                                >
                                                    <Download className="w-4 h-4" />
                                                    Télécharger le contrat
                                                </button>
                                                <button
                                                    onClick={submitSignature}
                                                    disabled={!termsAccepted || !hasSignature || isSubmittingSignature}
                                                    className="w-full py-3 bg-brand-blue text-white font-bold rounded-xl hover:bg-teal-700 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition"
                                                >
                                                    {isSubmittingSignature ? (
                                                        <span className="inline-flex items-center justify-center gap-2">
                                                            <div className="w-10 h-3 bg-white/40 rounded animate-pulse" />
                                                            Signature en cours...
                                                        </span>
                                                    ) : (
                                                        'Signer et Valider'
                                                    )}
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
                                        onClick={async () => {
                                            try {
                                                await handleDownloadContract(selectedQuote);
                                            } catch (e) {
                                                // Fallback: conserver la logique existante (génération via template)
                                                const pack = packs.find(p => p.name === client.pack);
                                                const newContract = generateContractFromTemplate(selectedQuote, client, pack);
                                                if (newContract) {
                                                    downloadContract(newContract);
                                                    showToast("Contrat téléchargé avec succès");
                                                }
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

            {showAllNotifsModal && (
                <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm p-4 flex items-center justify-center">
                    <div className="bg-white rounded-2xl w-full max-w-md max-h-[80vh] overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
                        <div className="flex items-center justify-between p-4 border-b">
                            <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                <Bell className="w-5 h-5" />
                                Notifications
                            </h3>
                            <button
                                onClick={() => setShowAllNotifsModal(false)}
                                className="p-2 hover:bg-slate-100 rounded-full transition"
                            >
                                <X className="w-5 h-5 text-slate-500" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4">
                            {allClientNotifs.length === 0 ? (
                                <div className="text-center py-8 text-slate-400">
                                    <Bell className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                    <p>Aucune notification</p>
                                </div>
                            ) : (
                                allClientNotifs.map(n => (
                                    <div
                                        key={n.id}
                                        onClick={() => handleNotificationClick(n)}
                                        className={`p-4 border-b hover:bg-blue-50 cursor-pointer transition flex items-start gap-3 ${!n.read ? 'bg-blue-50/30' : ''}`}
                                    >
                                        <div className={`p-2 rounded-full shrink-0 ${n.type === 'alert' ? 'bg-red-100 text-red-600' : 'bg-brand-blue/10 text-brand-blue'}`}>
                                            <Bell className="w-4 h-4" />
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex justify-between items-start mb-1">
                                                <span className="font-bold text-slate-800 text-sm">{n.title}</span>
                                                <span className="text-xs text-slate-400 whitespace-nowrap ml-2">{formatMartiniqueDate(new Date(n.date))}</span>
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
    );
};

export default ClientPortal;
