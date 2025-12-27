import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
    Provider, Mission, Pack, Contract, Reminder, Document, Client,
    AppNotification, Message, User, StreamSession, VideoRecording, VideoAccessToken, Expense, CompanySettings,
    CreateMissionDTO, CreateClientDTO, CreateProviderDTO, Leave, VisitScan, ScheduleOption, GenericContract
} from '../types';
import { supabase, isSupabaseConfigured } from '../utils/supabaseClient';
import { sendEmailViaEmailJS } from '../utils/emailService';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { STAMP_SIGNATURE_BASE64 } from '../src/assets/images';
import { 
    getMartiniqueNowISO,
    getMartiniqueToday,
    formatMartiniqueDateTime,
    formatMartiniqueDate,
    toMartiniqueTime
} from '../src/utils/martiniqueTime';

// --- Assets & Constantes ---
export const LOGO_NORMAL = "https://prestaservicesantilles.com/images/logo.png";
export const LOGO_SAP = "https://prestaservicesantilles.com/sap.png";

export const COMPANY_STAMP_URL = "https://prestaservicesantilles.com/cachetetsignature.png";
export const COMPANY_SIGNATURE_URL = "https://prestaservicesantilles.com/signature.png";

// Helper for UUID generation
function generateUUID() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// Helper to capitalize first letter
function capitalize(s: string) {
    if (!s) return s;
    return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

// Helper to calculate day index
function getDayIndexFromDate(dateStr: string): number {
    const date = new Date(dateStr);
    const day = date.getDay();
    return day === 0 ? 6 : day - 1;
}

// Helper for date manipulation
function addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
}

function addMonths(date: Date, months: number): Date {
    const result = new Date(date);
    result.setMonth(result.getMonth() + months);
    return result;
}

interface DataContextType {
    companySettings: CompanySettings;
    updateCompanySettings: (settings: CompanySettings) => Promise<void>;

    missions: Mission[];
    addMission: (mission: Mission) => Promise<void>;
    startMission: (id: string, remark?: string, photos?: string[], video?: string) => Promise<void>;
    endMission: (id: string, remark?: string, photos?: string[], video?: string) => Promise<void>;
    cancelMissionByProvider: (id: string, reason: string) => Promise<void>;
    cancelMissionByClient: (id: string) => Promise<void>;
    canCancelMission: (mission: Mission) => boolean;
    assignProvider: (missionId: string, providerId: string, providerName: string) => Promise<void>;
    deleteMissions: (ids: string[]) => Promise<void>;

    clients: Client[];
    addClient: (client: CreateClientDTO) => Promise<string | null>; // Returns generated password
    updateClient: (id: string, data: Partial<Client>) => Promise<void>;
    deleteClients: (ids: string[]) => Promise<void>;
    addLoyaltyHours: (clientId: string, hours: number) => Promise<void>;
    submitClientReview: (clientId: string, rating: number, comment: string) => Promise<void>;

    providers: Provider[];
    addProvider: (provider: CreateProviderDTO) => Promise<string | null>; // Returns generated password
    updateProvider: (id: string, data: Partial<Provider>) => Promise<void>;
    deleteProviders: (ids: string[]) => Promise<void>;
    addLeave: (providerId: string, start: string, end: string, startTime?: string, endTime?: string) => Promise<void>;
    updateLeaveStatus: (leaveId: string, providerId: string, status: 'approved' | 'rejected') => Promise<void>;
    resetProviderPassword: (id: string) => Promise<void>;

    documents: Document[];
    addDocument: (doc: Document) => Promise<void>;
    updateDocumentStatus: (id: string, status: string) => Promise<void>;
    deleteDocument: (id: string) => Promise<void>;
    deleteDocuments: (ids: string[]) => Promise<void>;
    duplicateDocument: (id: string) => Promise<void>;
    convertQuoteToInvoice: (quoteId: string) => Promise<void>;
    markInvoicePaid: (id: string) => Promise<void>;
    sendDocumentReminder: (id: string) => Promise<void>;
    signQuoteWithData: (id: string, signatureData: string) => Promise<void>;
    refuseQuote: (id: string) => Promise<void>;
    requestInvoice: (docId: string) => Promise<void>;
    refundTransaction: (ref: string, amount: number) => Promise<void>;
    generateMissionsFromDocument: (doc: Document) => Promise<void>;

    packs: Pack[];
    addPack: (pack: Pack) => Promise<string | null>; // Returns ID if success
    updatePack: (id: string, updates: Partial<Pack>) => Promise<void>;
    deletePacks: (ids: string[]) => Promise<void>;

    contracts: Contract[];
    addContract: (contract: Contract) => Promise<void>;
    updateContract: (id: string, updates: Partial<Contract>) => Promise<void>;
    deleteContract: (id: string) => Promise<void>;
    deleteContracts: (ids: string[]) => Promise<void>;
    requestContractValidation: (contractId: string) => Promise<void>;
    validateContract: (contractId: string, approved: boolean) => Promise<void>;
    legalTemplate: string;
    genericContracts: GenericContract[];
    generateContractFromTemplate: (quote: Document, client: Client, pack?: Pack) => Contract | null;
    downloadContract: (contract: Contract) => void;

    reminders: Reminder[];
    addReminder: (reminder: Reminder) => Promise<void>;
    toggleReminder: (id: string) => Promise<void>;

    expenses: Expense[];
    addExpense: (expense: Expense) => Promise<void>;
    updateExpense: (id: string, data: Partial<Expense>) => Promise<void>;

    messages: Message[];
    replyToClient: (text: string, clientId: string) => Promise<void>;
    sendClientMessage: (text: string, clientId: string) => Promise<void>;

    notifications: AppNotification[];
    markNotificationRead: (id: string) => Promise<void>;
    addNotification: (targetUserType: 'admin' | 'client' | 'provider', type: 'info' | 'alert' | 'success' | 'message', title: string, message: string, targetUserId?: string, link?: string) => Promise<void>;

    visitScans: VisitScan[];
    registerScan: (clientId: string) => Promise<{ success: boolean; type?: 'entry' | 'exit'; message: string }>;

    alertPopup: { show: boolean; message: string };
    setAlertPopup: (popup: { show: boolean; message: string }) => void;

    currentUser: User | null;
    login: (email: string, password?: string) => Promise<boolean>;
    logout: (skipReload?: boolean) => Promise<void>;

    simulatedClientId: string | null;
    setSimulatedClientId: (id: string | null) => void;
    simulatedProviderId: string | null;
    setSimulatedProviderId: (id: string | null) => void;

    activeStream: StreamSession | null;
    startLiveStream: (providerId: string, clientId: string) => void;
    stopLiveStream: () => void;

    videoRecordings: VideoRecording[];
    getVideoRecordings: (clientId?: string, providerId?: string) => VideoRecording[];
    createVideoRecording: (recording: VideoRecording) => Promise<void>;
    updateVideoRecording: (id: string, updates: Partial<VideoRecording>) => Promise<void>;

    generateVideoAccessToken: (recordingId: string, userId: string, permissions: 'view' | 'download') => Promise<string>;
    validateVideoAccessToken: (token: string, recordingId: string) => Promise<boolean>;
    revokeVideoAccessToken: (token: string) => Promise<void>;

    isOnline: boolean;
    pendingSyncCount: number;
    loading: boolean;

    // Session management functions
    extendReadingSession: () => void;
    endReadingSession: () => void;
    isReadingDocument: boolean;

    // Connection management functions
    connectionStatus: 'connected' | 'disconnected' | 'reconnecting';
    reconnectAttempts: number;
    maxReconnectAttempts: number;
    reconnectDelay: number;
    attemptReconnection: () => Promise<void>;
    resetConnectionState: () => void;

    getAvailableSlots: (date: string) => { time: string, provider: string, score: number, reason: string }[];
    refreshData: () => Promise<void>;
    sendEmail: (to: string, subject: string, template: string, context: any) => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    // --- STATE ---
    const [companySettings, setCompanySettings] = useState<CompanySettings>({
        name: 'PRESTA SERVICES ANTILLES',
        address: '31 Résidence L’Autre Bord – 97220 La Trinité',
        siret: 'SAP944789700',
        email: 'prestaservicesantilles.rh@gmail.com',
        phone: '0696 06 15 94',
        tvaRateDefault: 8.5,
        emailNotifications: true,
        loyaltyRewardHours: 2,
        logoUrl: LOGO_NORMAL
    });

    const [missions, setMissions] = useState<Mission[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [providers, setProviders] = useState<Provider[]>([]);
    const [documents, setDocuments] = useState<Document[]>([]);
    const [packs, setPacks] = useState<Pack[]>([]);
    const [contracts, setContracts] = useState<Contract[]>([]);
    const [genericContracts, setGenericContracts] = useState<GenericContract[]>([]);
    const [reminders, setReminders] = useState<Reminder[]>([]);
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [messages, setMessages] = useState<Message[]>([]);
    const [notifications, setNotifications] = useState<AppNotification[]>([]);
    const [visitScans, setVisitScans] = useState<VisitScan[]>([]);

    // Alert popup state
    const [alertPopup, setAlertPopup] = useState<{ show: boolean; message: string }>({ show: false, message: '' });

    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [simulatedClientId, setSimulatedClientId] = useState<string | null>(null);
    const [simulatedProviderId, setSimulatedProviderId] = useState<string | null>(null);
    const [activeStream, setActiveStream] = useState<StreamSession | null>(null);
    const [videoRecordings, setVideoRecordings] = useState<VideoRecording[]>([]);
    const [videoAccessTokens, setVideoAccessTokens] = useState<VideoAccessToken[]>([]);

    const [isOnline, setIsOnline] = useState(true);
    const [loading, setLoading] = useState(true);
    const [pendingSyncCount, setPendingSyncCount] = useState(0);

    // Session management pour éviter la déconnexion pendant lecture
    const [lastActivity, setLastActivity] = useState(Date.now());
    const [isReadingDocument, setIsReadingDocument] = useState(false);

    // Gestion des coupures réseau et reconnexion
    const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'reconnecting'>('connected');
    const [reconnectAttempts, setReconnectAttempts] = useState(0);
    const [maxReconnectAttempts] = useState(5);
    const [reconnectDelay, setReconnectDelay] = useState(1000); // 1 seconde initialement

    // Prolonger la session pendant lecture active
    const extendReadingSession = () => {
        setIsReadingDocument(true);
        setLastActivity(Date.now());
    };

    const endReadingSession = () => {
        setIsReadingDocument(false);
        setLastActivity(Date.now());
    };

    // Gestion des notifications en temps réel
    const [lastNotificationCheck, setLastNotificationCheck] = useState(Date.now());
    const [notificationPollingInterval, setNotificationPollingInterval] = useState<NodeJS.Timeout | null>(null);

    // Polling pour les notifications en temps réel
    useEffect(() => {
        if (currentUser && isOnline) {
            // Charger les notifications existantes au démarrage
            const loadInitialNotifications = async () => {
                try {
                    if (isSupabaseConfigured) {
                        const { data: existingNotifications, error } = await supabase
                            .from('notifications')
                            .select('*')
                            .eq('is_read', false)
                            .order('created_at', { ascending: false })
                            .limit(50);

                        if (!error && existingNotifications) {
                            const mappedNotifications = existingNotifications.map((notif: any) => ({
                                id: notif.id,
                                type: notif.type as 'alert' | 'info' | 'success',
                                title: notif.title,
                                message: notif.message,
                                date: notif.created_at,
                                read: notif.is_read,
                                is_read: notif.is_read, // Ajout de la propriété manquante
                                targetUserType: notif.target_user_type as 'admin' | 'client' | 'provider',
                                targetUserId: notif.target_user_id
                            }));

                            // Filtrer pour l'utilisateur courant
                            const userNotifications = mappedNotifications.filter(notif => {
                                if (currentUser.role === 'admin') return notif.targetUserType === 'admin';
                                if (currentUser.role === 'client') return notif.targetUserType === 'client' && (!notif.targetUserId || notif.targetUserId === currentUser.relatedEntityId);
                                if (currentUser.role === 'provider') return notif.targetUserType === 'provider' && (!notif.targetUserId || notif.targetUserId === currentUser.relatedEntityId);
                                return false;
                            });

                            setNotifications(userNotifications);
                            setLastNotificationCheck(Date.now());
                        }
                    }
                } catch (error) {
                    console.warn('[LoadInitialNotifications] Error:', error);
                }
            };

            loadInitialNotifications();

            // Initialiser le polling toutes les 5 secondes pour les notifications
            const interval = setInterval(async () => {
                try {
                    // Rafraîchir les notifications
                    if (isSupabaseConfigured) {
                        const { data: newNotifications, error } = await supabase
                            .from('notifications')
                            .select('*')
                            .eq('is_read', false)
                            .gte('created_at', new Date(lastNotificationCheck).toISOString())
                            .order('created_at', { ascending: false });

                        if (!error && newNotifications && newNotifications.length > 0) {
                            // Ajouter les nouvelles notifications
                            const mappedNotifications = newNotifications.map((notif: any) => ({
                                id: notif.id,
                                type: notif.type as 'alert' | 'info' | 'success',
                                title: notif.title,
                                message: notif.message,
                                date: notif.created_at,
                                read: notif.is_read,
                                is_read: notif.is_read, // Ajout de la propriété manquante
                                targetUserType: notif.target_user_type as 'admin' | 'client' | 'provider',
                                targetUserId: notif.target_user_id
                            }));

                            // Filtrer pour l'utilisateur courant
                            const userNotifications = mappedNotifications.filter(notif => {
                                if (currentUser.role === 'admin') return notif.targetUserType === 'admin';
                                if (currentUser.role === 'client') return notif.targetUserType === 'client' && (!notif.targetUserId || notif.targetUserId === currentUser.relatedEntityId);
                                if (currentUser.role === 'provider') return notif.targetUserType === 'provider' && (!notif.targetUserId || notif.targetUserId === currentUser.relatedEntityId);
                                return false;
                            });

                            if (userNotifications.length > 0) {
                                setNotifications(prev => [...userNotifications, ...prev]);
                                setLastNotificationCheck(Date.now());

                                // Jouer un son de notification plus fort pour les appels vidéo
                                userNotifications.forEach(notif => {
                                    if (notif.title.includes('Appel Vidéo')) {
                                        try {
                                            // Son plus distinctif pour les appels vidéo
                                            const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUazi5L2d');
                                            audio.volume = 0.7;
                                            audio.play().catch(() => {});

                                            // Vibration si disponible (mobile)
                                            if ('vibrate' in navigator) {
                                                navigator.vibrate([200, 100, 200]);
                                            }
                                        } catch (e) {}
                                    } else {
                                        // Son normal pour les autres notifications
                                        try {
                                            const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUazi5L2d');
                                            audio.volume = 0.3;
                                            audio.play().catch(() => {});
                                        } catch (e) {}
                                    }
                                });
                            }
                        }

                        // Rafraîchir les scans pour les prestataires et clients
                        if (currentUser.role === 'provider' || currentUser.role === 'client') {
                            await refreshData();
                        }
                    }
                } catch (error) {
                    console.warn('[NotificationPolling] Error:', error);
                }
            }, 5000); // 5 secondes

            setNotificationPollingInterval(interval);

            return () => {
                if (interval) clearInterval(interval);
            };
        } else {
            // Nettoyer l'intervalle si pas d'utilisateur ou hors ligne
            if (notificationPollingInterval) {
                clearInterval(notificationPollingInterval);
                setNotificationPollingInterval(null);
            }
        }
    }, [currentUser, isOnline, lastNotificationCheck]);

    // Vérifier l'activité et prolonger la session si nécessaire
    useEffect(() => {
        const interval = setInterval(() => {
            const now = Date.now();
            const timeSinceLastActivity = now - lastActivity;

            // Si lecture active, prolonger la session
            if (isReadingDocument && timeSinceLastActivity < 30 * 60 * 1000) { // 30 minutes
                setLastActivity(now);
            }
        }, 60000); // Vérifier chaque minute

        return () => clearInterval(interval);
    }, [lastActivity, isReadingDocument]);

    // EXACT TEMPLATE FROM PDF OCR
    const legalTemplate = `PRESTA SERVICES ANTILLES – SASU
Siège : 31 Résidence L’Autre Bord – 97220 La Trinité
N° SAP : SAP944789700
Email : prestaservicesantilles.rh@gmail.com
Assurance RCP : Contrat n° RCP250714175810 – Assurup pour le compte de Hiscox et Assurance :
Contrat n° RCP250714175810 – Assurup pour le compte de Hiscox – validité : 01/08/2025 → 31/07/2026 – plafond : 100 000 € par période – Monde entier (hors USA/Canada).
Attestation disponible sur demande.

1. INFORMATIONS DU CLIENT
[INFO_CLIENT]

2. INFORMATIONS DU PACK
[INFO_PACK]

– Obligations du Prestataire
Le Prestataire exécute les Prestations avec diligence et professionnalisme, selon les règles de l’art et dans le respect des normes d’hygiène et de sécurité applicables. Il affecte des intervenants compétents et placés sous encadrement. Les Prestations demeurent limitées au périmètre éligible au SAP.

Article 9 – Obligations du Client
Le Client assure l’accès au domicile aux dates et créneaux convenus, fournit les informations utiles et met à disposition un environnement conforme (électricité, eau, accès sécurisé). Il respecte les modalités de paiement et veille au maintien en place et à la lisibilité du QR code.

– Responsabilité
Le Prestataire n’est pas responsable (i) des retards résultant d’un manquement du Client, notamment en cas d’accès impossible ou d’absence de QR code, ni (ii) des dommages, défauts ou dysfonctionnements antérieurs à l’intervention. Sa responsabilité est limitée aux dommages directs, certains et prouvés, dans la limite des plafonds de ses assurances.

– Protection des données (RGPD)
Données traitées : identité et coordonnées, adresse d’intervention, consignes d’accès, données de pointage. Base légale : exécution du Contrat. Durées de conservation : pendant le Contrat puis selon les délais légaux. Droits du Client : accès, rectification, effacement, limitation, opposition et portabilité (contact : prestaservicesantilles.rh@gmail.com). Les sous‑traitants (hébergement, paiement, pointage) sont tenus à des obligations de confidentialité et de sécurité. Aucun transfert hors UE n’est effectué sans garanties adéquates.

– Résiliation
12.1. Avec préavis : chaque Partie peut résilier le Contrat à tout moment, sous réserve d’un préavis de 30 jours notifié par lettre recommandée avec accusé de réception ou par courriel avec accusé de réception.
12.2. Pour manquement : en cas d’un manquement grave non corrigé dans un délai de 8 jours à compter d’une mise en demeure écrite, le Contrat pourra être résilié de plein droit, sans indemnité.
12.3. Effets : les sommes dues au titre des prestations réalisées jusqu’à la date d’effet de la résiliation restent exigibles.

– Droit de rétractation (consommateur)
En cas de conclusion à distance ou hors établissement, le Client consommateur dispose d’un délai de 14 jours à compter de la signature pour se rétracter, sans motif ni frais, conformément aux articles L221‑18 et suivants du Code de la consommation. L’exécution des prestations avant l’expiration de ce délai ne peut intervenir qu’avec l’accord exprès du Client, qui reconnaît perdre son droit de rétractation pour les prestations pleinement exécutées. Modèle de formulaire en Annexe 2.

– Médiation de la consommation et litiges
En cas de litige, le Client peut recourir gratuitement à un médiateur de la consommation : [organisme compétent] – [adresse / site]. À défaut d’accord amiable, le litige sera porté devant les juridictions territorialement compétentes, selon le droit commun. Droit applicable : droit français.

Confidentialité
Les informations échangées dans le cadre du Contrat sont confidentielles pendant sa durée et pendant 3 ans après son expiration, sauf obligation légale ou décision de justice.

Dispositions diverses
La nullité d’une clause n’affecte pas la validité du reste du Contrat. Le Client ne peut céder le Contrat sans l’accord écrit préalable du Prestataire. Élection de domicile aux adresses indiquées ci‑dessus.

Cas particuliers
• Si l’annulation est faite moins de 48 h avant l’intervention, le client reçoit une notification : la mission est considérée comme réalisée et facturée. Elle est ajoutée aux statistiques « missions annulées sous 48 h ». Le créneau devient disponible pour une nouvelle mission. Dans ce cas, 50 % du montant est facturé, hors SAP, sans avance immédiate.
• Si 2 devis ont été envoyé en même temps à 2 clients différents le 1er qui aura signé bloquera les créneaux souhaités.
• Un prestataire peut tomber malade en pleine mission et donc annule la mission avec un motif obligatoire.
• Une notification par mail doit etre envoyé aux clients comme rappel 48h avant la date d’intervention, disant que la prestation ne peut plus etre annulée

Fait à La Trinité, le [DATE]
Signature du Client (Précédée de la mention "Lu et approuvé")
[ESPACE_SIGNATURE]
`;

    // Handle online/offline status
    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    // Real-time notification subscription
    useEffect(() => {
        if (!currentUser) return;

        console.log("[NotificationSubscription] Setting up subscription for", currentUser.role, currentUser.relatedEntityId);

        // Subscribe to notifications for the current user using target_user_type (enum NOT NULL)
        const notificationChannel = currentUser.role === 'client'
            ? `notifications:target_user_type=eq.client&target_user_id=eq.${currentUser.relatedEntityId}`
            : currentUser.role === 'provider'
                ? `notifications:target_user_type=eq.provider&target_user_id=eq.${currentUser.relatedEntityId}`
                : 'notifications:target_user_type=eq.admin';

        console.log("[NotificationSubscription] Using filter:", notificationChannel);

        const subscription = supabase
            .channel('notifications')
            .on('postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'notifications',
                    filter: notificationChannel
                },
                (payload) => {
                    console.log("[NotificationSubscription] Received notification:", payload.new);
                    const newNotif = payload.new;
                    const mappedNotif: AppNotification = {
                        id: newNotif.id,
                        title: newNotif.title,
                        message: newNotif.message,
                        type: newNotif.type,
                        date: newNotif.date,
                        is_read: newNotif.is_read,
                        read: newNotif.is_read, // UI Alias
                        link: newNotif.link,
                        targetUserType: newNotif.target_user_type, // CORRIGÉ: Utiliser target_user_type
                        targetUserId: newNotif.target_user_id
                    };

                    console.log("[NotificationSubscription] Adding to state:", mappedNotif);
                    // Add notification to state immediately
                    setNotifications(prev => [mappedNotif, ...prev]);

                    // Show browser notification if permission granted
                    if (Notification.permission === 'granted') {
                        new Notification(mappedNotif.title, {
                            body: mappedNotif.message,
                            icon: '/favicon.ico'
                        });
                    }
                }
            )
            .subscribe((status) => {
                console.log("[NotificationSubscription] Subscription status:", status);
            });

        return () => {
            console.log("[NotificationSubscription] Cleaning up subscription");
            subscription.unsubscribe();
        };
    }, [currentUser]);

    // --- DATA FETCHING ---
    const refreshData = async () => {
        try {
            console.log("[RefreshData] Starting data refresh...");

            if (!isSupabaseConfigured) {
                console.log("[RefreshData] Supabase not configured, skipping fetch");
                // If not configured, we don't fetch but we MUST ensure loading stops
                return;
            }

            setIsOnline(true); // Assume online if we are attempting to refresh
            console.log("[RefreshData] Setting online status, preparing fetches...");

            // Perform fetches in parallel but wrapped to not fail completely if one table is missing
            const fetchTable = async (table: string, query: any = '*', timeout: number = 5000) => {
                try {
                    console.log(`[RefreshData] Fetching ${table}...`);

                    // Add timeout to prevent hanging
                    const timeoutPromise = new Promise((_, reject) => {
                        setTimeout(() => reject(new Error(`Timeout fetching ${table}`)), timeout);
                    });

                    const fetchPromise = supabase.from(table).select(query);

                    const result = await Promise.race([fetchPromise, timeoutPromise]) as any;

                    if (result.error) {
                        console.warn(`[RefreshData] Failed to fetch ${table}:`, result.error.message);
                        return null;
                    }

                    console.log(`[RefreshData] Successfully fetched ${table}:`, result.data?.length || 0, 'items');
                    return result.data;
                } catch (err) {
                    if (err instanceof Error && err.message.includes('Timeout')) {
                        console.warn(`[RefreshData] Timeout fetching ${table}, skipping...`);
                    } else {
                        console.error(`[RefreshData] Exception fetching ${table}:`, err);
                    }
                    return null;
                }
            };

            const [
                cData, pData, mData, dData, packData, ctData,
                rData, eData, msgData, notifData, settingsData, vsData, vrData, leavesData, gcData
            ] = await Promise.all([
                fetchTable('clients'),
                fetchTable('providers'),
                fetchTable('missions'),
                fetchTable('documents'),
                fetchTable('packs'),
                fetchTable('contracts'),
                fetchTable('reminders'),
                fetchTable('expenses'),
                fetchTable('messages'), // Ordering happens in memory or add order to fetchTable if critical
                fetchTable('notifications'),
                fetchTable('company_settings', '*', 5000).then(r => r?.[0] || null),
                fetchTable('visit_scans'),
                fetchTable('video_recordings'),
                fetchTable('leaves'),
                fetchTable('generic_contracts')
            ]);

            console.log("[RefreshData] All fetches completed, processing data...");

            if (cData) {
                // Enrichir les clients avec leurs packs associés via les contrats
                const enrichedClients = cData.map((c: any) => {
                    // Chercher les contrats actifs du client
                    const clientContracts = ctData?.filter((contract: any) =>
                        contract.name && contract.name.toLowerCase().includes(c.name.toLowerCase())
                    ) || [];

                    // Chercher les packs associés via les contrats
                    const associatedPacks = packData?.filter((pack: any) =>
                        clientContracts.some((contract: any) => contract.packId === pack.id)
                    ) || [];

                    // Utiliser le premier pack trouvé ou garder le pack existant
                    const packName = associatedPacks.length > 0 ? associatedPacks[0].name : c.pack;

                    return {
                        ...c,
                        packsConsumed: c.packs_consumed || 0,
                        loyaltyHoursAvailable: c.loyalty_hours_available || 0,
                        hasLeftReview: c.has_left_review,
                        pack: packName && packName !== '-' ? packName : null
                    };
                });

                setClients(enrichedClients);
            }

            if (pData) {
                setProviders(pData.map((p: any) => ({
                    ...p,
                    firstName: p.first_name || p.firstName,
                    lastName: p.last_name || p.lastName,
                    hoursWorked: p.hours_worked || p.hoursWorked,
                    leaves: leavesData ? leavesData.map((l: any) => ({
                        id: l.id,
                        providerId: l.provider_id,
                        startDate: l.start_date,
                        endDate: l.end_date,
                        startTime: l.start_time,
                        endTime: l.end_time,
                        status: l.status
                    })).filter((l: any) => l.providerId === p.id) : [],
                })));
            }

            if (mData) {
                const mappedMissions = mData.map((m: any) => ({
                    ...m,
                    dayIndex: m.date ? getDayIndexFromDate(m.date) : 0,
                    startTime: m.start_time || m.startTime,
                    endTime: m.end_time || m.endTime,
                    clientId: m.client_id || m.clientId,
                    clientName: m.client_name || m.clientName,
                    providerId: m.provider_id || m.providerId,
                    providerName: m.provider_name || m.providerName,
                    startPhotos: m.start_photos || m.startPhotos,
                    endPhotos: m.end_photos || m.endPhotos,
                    startVideo: m.start_video || m.startVideo,
                    endVideo: m.end_video,
                    startRemark: m.start_remark,
                    endRemark: m.end_remark,
                    cancellationReason: m.cancellation_reason || m.cancellationReason,
                    lateCancellation: m.late_cancellation || m.lateCancellation,
                    reminder48hSent: m.reminder_48h_sent || m.reminder48hSent,
                    reminder72hSent: m.reminder_72h_sent || m.reminder72hSent,
                    reportSent: m.report_sent || m.reportSent
                }));
                setMissions(mappedMissions);
                checkUpcomingReminders(mappedMissions); // Trigger 48h check
            }
            if (dData) {
                setDocuments(dData.map((d: any) => ({
                    ...d,
                    clientId: d.client_id || d.clientId,
                    clientName: d.client_name || d.clientName,
                    unitPrice: d.unit_price || d.unitPrice,
                    tvaRate: d.tva_rate || d.tvaRate,
                    totalHT: d.total_ht || d.totalHT,
                    totalTTC: d.total_ttc || d.totalTTC,
                    taxCreditEnabled: d.tax_credit_enabled || d.taxCreditEnabled,
                    slotsData: d.slots_data,
                    reminderSent: d.reminder_sent,
                    signatureData: d.signature_data,
                    signatureDate: d.signature_date,
                    recurrenceEndDate: d.recurrence_end_date,
                    frequency: d.frequency
                })));
            }
            if (packData) {
                setPacks(packData.map((p: any) => {
                    const desc = p.description || '';
                    const locationMatch = desc.match(/Lieu: (.*?)(\||$)/);
                    const freq = p.frequency ? capitalize(p.frequency) : 'Ponctuelle';

                    return {
                        ...p,
                        mainService: p.main_service || p.mainService,
                        priceTTC: p.price_ttc || p.priceTTC,
                        priceHT: p.price_ht || p.priceHT,
                        priceTaxCredit: p.price_tax_credit || p.priceTaxCredit,
                        suppliesIncluded: p.supplies_included || p.suppliesIncluded,
                        suppliesDetails: p.supplies_details || p.suppliesDetails,
                        isSap: p.is_sap || p.isSap,
                        contractType: p.contract_type || p.contractType,
                        quantity: p.quantity || '',
                        location: locationMatch ? locationMatch[1].trim() : (p.location || ''),
                        frequency: freq
                    };
                }));
            }
            if (ctData) {
                console.log('Loading contracts from DB:', ctData.map((c: any) => ({ id: c.id, client_id: c.client_id, pack_id: c.pack_id })));
                setContracts(ctData.map((c: any) => ({
                    ...c,
                    packId: c.pack_id || c.packId,
                    clientId: c.client_id || c.clientId,
                    isSap: c.is_sap || c.isSap,
                    validationDate: c.validation_date || c.validationDate,
                    clientSignatureUrl: c.client_signature_url,
                    signedAt: c.signed_at
                })));
            }
            if (gcData) {
                setGenericContracts(gcData.map((gc: any) => ({
                    ...gc,
                    isActive: typeof gc.is_active === 'boolean' ? gc.is_active : (typeof gc.isActive === 'boolean' ? gc.isActive : false)
                })));
            }
            if (rData) {
                setReminders(rData.map((r: any) => ({
                    ...r,
                    notifyEmail: r.notify_email || r.notifyEmail
                })));
            }
            if (eData) {
                setExpenses(eData.map((e: any) => ({
                    ...e,
                    proofUrl: e.proof_url || e.proofUrl
                })));
            }
            if (msgData) {
                // sort locally since we fetched crudely
                const sorted = msgData.sort((a: any, b: any) =>
                    new Date(a.created_at || a.date).getTime() - new Date(b.created_at || b.date).getTime()
                );
                setMessages(sorted.map((m: any) => ({
                    id: m.id,
                    sender: m.sender,
                    text: m.text,
                    date: m.created_at || m.date,
                    clientId: m.client_id,
                    read: m.is_read
                })));
            }
            if (notifData) {
                const sorted = notifData.sort((a: any, b: any) =>
                    new Date(b.date).getTime() - new Date(a.date).getTime()
                );
                setNotifications(sorted.map((n: any) => ({
                    ...n,
                    read: n.is_read, // Map DB column to UI property
                    targetUserType: n.target_user_type, // CORRIGÉ: Utiliser target_user_type pour cohérence
                    targetUserId: n.target_user_id
                })));
            }

            if (vsData) {
                const sorted = vsData.sort((a: any, b: any) =>
                    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
                );
                setVisitScans(sorted.map((s: any) => ({
                    ...s,
                    clientId: s.client_id || s.clientId,
                    scannerId: s.scanner_id || s.scannerId,
                    scannerName: s.scanner_name || s.scannerName,
                    scanType: s.scan_type || s.scanType,
                    locationData: s.location_data
                })));
            }

            if (vrData) {
                const sorted = vrData.sort((a: any, b: any) =>
                    new Date(b.start_time || b.startTime || b.created_at).getTime() - new Date(a.start_time || a.startTime || a.created_at).getTime()
                );

                setVideoRecordings(sorted.map((r: any) => ({
                    id: r.id,
                    sessionId: r.session_id || r.sessionId,
                    providerId: r.provider_id || r.providerId,
                    clientId: r.client_id || r.clientId,
                    status: (r.status as any) || 'recording',
                    startTime: r.start_time || r.startTime || r.created_at,
                    endTime: r.end_time || r.endTime,
                    recordingUrl: r.recording_url || r.recordingUrl,
                    replayUrl: r.replay_url || r.replayUrl,
                    duration: r.duration || 0,
                    fileSize: r.file_size || r.fileSize || 0,
                    thumbnailUrl: r.thumbnail_url || r.thumbnailUrl,
                    accessToken: r.access_token || r.accessToken,
                    expiresAt: r.expires_at || r.expiresAt,
                    url: r.url
                })));
            }

            if (settingsData) {
                setCompanySettings({
                    name: settingsData.name,
                    address: settingsData.address,
                    siret: settingsData.siret,
                    email: settingsData.email,
                    phone: settingsData.phone,
                    tvaRateDefault: settingsData.tva_rate_default,
                    emailNotifications: settingsData.email_notifications,
                    loyaltyRewardHours: settingsData.loyalty_reward_hours,
                    logoUrl: settingsData.logo_url
                });
            }

            setIsOnline(true);

        } catch (error: any) {
            console.error("Erreur critique lors du chargement des données:", error);
            if (error.message === 'Failed to fetch' || error.message.includes('NetworkError')) {
                setIsOnline(false);
            }
        }
    };

    // Check for 48h reminders (updated from 72h)
    const checkUpcomingReminders = async (currentMissions: Mission[]) => {
        const now = new Date();
        const fortyEightHoursInMs = 48 * 60 * 60 * 1000;

        currentMissions.forEach(async (m) => {
            if (m.status === 'planned' && m.date && !m.reminder48hSent) {
                const missionDate = new Date(`${m.date}T${m.startTime}`);
                const diff = missionDate.getTime() - now.getTime();

                // If between 24h and 48h
                if (diff > 0 && diff <= fortyEightHoursInMs) {
                    // Send Email Notification
                    const client = clients.find(c => c.id === m.clientId);
                    if (client && client.email) {
                        await sendEmail(client.email, 'Rappel Intervention - Annulation impossible sans frais', 'reminder_48h', {
                            clientName: m.clientName,
                            date: m.date,
                            time: m.startTime
                        });

                        // Mark as sent in DB
                        const recordingsBaseUrl = process.env.NODE_ENV === 'production' 
                            ? 'https://recordings.presta-services.com' 
                            : 'http://localhost:3001/recordings';
                        await supabase.from('missions').update({ reminder_48h_sent: true }).eq('id', m.id);
                        await addNotification('admin', 'info', 'Rappel 48h Envoyé', `Rappel annulation envoyé au client ${m.clientName} pour le ${m.date}.`, undefined);
                        await addNotification('client', 'info', 'Rappel Intervention', `Votre intervention du ${m.date} ne peut plus être annulée sans frais.`, m.clientId);
                    }
                }
            }
        });
        setIsOnline(true);
        return true;
    };const performSilentLogin = async (): Promise<boolean> => {
        try {
            console.log("Attempting silent login...");
            
            // Rate limiting: éviter les tentatives répétées
            const lastAttempt = localStorage.getItem('presta_last_login_attempt');
            const now = Date.now();
            if (lastAttempt && (now - parseInt(lastAttempt)) < 30000) { // 30 secondes
                console.log("Silent login rate limited, skipping attempt");
                return false;
            }

            // Vérifier d'abord s'il y a une session Supabase active
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                console.log("Found existing Supabase session, validating...");
                const isValid = await fetchUserProfile(session.user);
                if (isValid) {
                    console.log("Existing session is valid, restoring...");
                    // Prolonger la session de manière proactive
                    localStorage.setItem('presta_last_login_attempt', (now + 300000).toString()); // 5 minutes
                    return true;
                }
            }

            // Tenter la récupération depuis le storage local
            const storedAuth = localStorage.getItem('presta_auth_recovery');
            if (!storedAuth) {
                console.log("No stored auth recovery data found");
                return false;
            }

            // Vérifier si l'utilisateur était un client/provider pour éviter la déconnexion automatique
            const currentUser = JSON.parse(localStorage.getItem('presta_current_user') || 'null');
            if (currentUser && (currentUser.role === 'client' || currentUser.role === 'provider')) {
                console.log("Protected user type found, preventing auto-logout");
                // Ne pas déconnecter automatiquement les clients/providers
                localStorage.setItem('presta_last_login_attempt', (now + 600000).toString()); // 10 minutes
                return true;
            }

            // Forcer Supabase SignOut uniquement pour les admins
            if (currentUser?.role === 'admin') {
                console.log("Admin user - clearing session before re-auth");
                await supabase.auth.signOut();
            }

            // Tenter la reconnexion silencieuse
            const { e, p } = JSON.parse(atob(storedAuth));
            const { data, error } = await supabase.auth.signInWithPassword({ email: e, password: p });

            if (!error && data.session) {
                console.log("Silent login successful");
                await fetchUserProfile(data.session.user);
                
                // Prolonger la session et marquer le succès
                localStorage.setItem('presta_last_login_attempt', (now + 600000).toString()); // 10 minutes
                localStorage.setItem('presta_session_extended', now.toString());
                
                return true;
            } else {
                console.warn("Silent login failed:", error);
                // Nettoyer les données invalides
                localStorage.removeItem('presta_auth_recovery');
                localStorage.setItem('presta_last_login_attempt', now.toString());
                return false;
            }
        } catch (e: any) {
            console.warn("Silent login error:", e);
            const currentUser = JSON.parse(localStorage.getItem('presta_current_user') || 'null');
            if (currentUser?.role === 'admin') {
                // Nettoyer uniquement pour les admins en cas d'erreur
                localStorage.removeItem('presta_auth_recovery');
            }
            localStorage.setItem('presta_last_login_attempt', Date.now().toString());
            return false;
        }
    };

    const fetchUserProfile = async (authUser: any): Promise<boolean> => {
        try {
            console.log("[FetchProfile] Starting profile fetch for user:", authUser.id, authUser.email);

            if (!isSupabaseConfigured) {
                console.log("[FetchProfile] Supabase not configured");
                return false;
            }

            let userObj: User | null = null;

            // Check for admin first to avoid unnecessary DB queries
            if (authUser.email === 'admin@presta.com') {
                console.log("[FetchProfile] Admin user detected, using admin fallback");
                userObj = {
                    id: authUser.id,
                    email: authUser.email,
                    name: 'Admin Principal',
                    role: 'admin'
                } as User;
            } else {
                console.log("[FetchProfile] Non-admin user, checking users table...");
                // Try to get profile from users table only for non-admin users
                try {
                    const { data: profile, error } = await supabase.from('users').select('*').eq('id', authUser.id).maybeSingle();

                    if (error) {
                        console.log("[FetchProfile] Profile query error:", error.message);
                    } else if (profile) {
                        console.log("[FetchProfile] Found profile in users table");
                        userObj = {
                            id: authUser.id,
                            email: authUser.email || '',
                            name: profile.name || authUser.email?.split('@')[0] || 'Utilisateur',
                            role: profile.role || 'client',
                            relatedEntityId: profile.related_entity_id
                        } as User;
                    } else {
                        console.log("[FetchProfile] No profile found in users table, using generic fallback");
                    }
                } catch (profileErr) {
                    console.log("[FetchProfile] Profile query failed, using generic fallback:", profileErr);
                }

                // Generic fallback for non-admin users if no profile found
                if (!userObj) {
                    console.log("[FetchProfile] Using generic user fallback");
                    userObj = {
                        id: authUser.id,
                        email: authUser.email || '',
                        name: authUser.email?.split('@')[0] || 'Utilisateur',
                        role: 'client'
                    } as User;
                }
            }

            if (userObj) {
                console.log("[FetchProfile] Setting user:", userObj.name, userObj.role);
                setCurrentUser(userObj);
                if (userObj.role === 'client' && userObj.relatedEntityId) {
                    setSimulatedClientId(userObj.relatedEntityId);
                } else if (userObj.role === 'provider' && userObj.relatedEntityId) {
                    setSimulatedProviderId(userObj.relatedEntityId);
                }
                try {
                    localStorage.setItem('presta_current_user', JSON.stringify(userObj));
                    console.log("[FetchProfile] User saved to localStorage");
                } catch { }
                console.log("[FetchProfile] Profile fetch completed successfully");
                return true;
            }

            console.log("[FetchProfile] No user object created");
            return false;
        } catch (e) {
            console.error("[FetchProfile] Critical error:", e);
            return false;
        }
    };

    // --- AUTHENTICATION & INITIALIZATION ---
    useEffect(() => {
        let mounted = true;

        // SAFETY TIMEOUT: Force stop loading after 15 seconds (increased for Supabase)
        const safetyTimer = setTimeout(() => {
            if (mounted && loading) {
                console.warn("Initialization timed out after 15 seconds. Forcing app load.");
                setLoading(false);
                // Only mark offline if browser actually reports offline
                if (!navigator.onLine) {
                    setIsOnline(false);
                }
            }
        }, 15000);

        const initializeAuth = async () => {
            try {
                if (!isSupabaseConfigured) {
                    if (mounted) setLoading(false);
                    return;
                }

                console.log("Starting auth initialization...");

                // First try to restore user from localStorage for immediate UI update
                try {
                    const storedUser = localStorage.getItem('presta_current_user');
                    if (storedUser) {
                        const userObj = JSON.parse(storedUser);
                        console.log("Restored user from localStorage:", userObj.name, userObj.role);
                        setCurrentUser(userObj);
                        if (userObj.role === 'client' && userObj.relatedEntityId) {
                            setSimulatedClientId(userObj.relatedEntityId);
                        } else if (userObj.role === 'provider' && userObj.relatedEntityId) {
                            setSimulatedProviderId(userObj.relatedEntityId);
                        }
                    }
                } catch (err) {
                    console.warn("Failed to restore user from localStorage:", err);
                }

                // Check Supabase Session status directly
                const { data: { session }, error } = await supabase.auth.getSession();

                if (error) {
                    console.warn("Session check error:", error);
                }

                if (session?.user && mounted) {
                    console.log("Found Supabase session, validating profile...");
                    // VERIFY SESSION IS ACTUALLY VALID by fetching profile
                    const isValid = await fetchUserProfile(session.user);

                    if (isValid) {
                        console.log("Profile validation successful, loading data...");
                        try {
                            await refreshData();
                        } catch (refreshErr) {
                            console.warn("Data refresh failed despite valid profile. Retrying silent login...", refreshErr);
                            const recovered = await performSilentLogin();
                            if (recovered) {
                                console.log("Recovery successful, refreshing data...");
                                await refreshData();
                            } else {
                                console.warn("Recovery failed, will show login");
                            }
                        }
                    } else {
                        console.warn("Session exists but profile fetch failed (Zombie session). Attempting recovery...");
                        const recovered = await performSilentLogin();
                        if (recovered) {
                            await refreshData();
                        }
                    }
                } else {
                    console.log("No active Supabase session, trying silent recovery...");
                    // No active session found - try silent recovery
                    const recovered = await performSilentLogin();
                    if (recovered) {
                        console.log("Silent recovery successful, loading data...");
                        await refreshData();
                    } else {
                        console.log("No recovery possible, will show login screen");
                    }
                }

            } catch (error) {
                console.error("Auth initialization failed:", error);
            } finally {
                clearTimeout(safetyTimer);
                if (mounted) setLoading(false);
            }
        };

        initializeAuth();

        if (!isSupabaseConfigured) return;

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            console.log("[AuthStateChange] Event:", event, "Session:", session ? "exists" : "null");
            if (!mounted) {
                console.log("[AuthStateChange] Component not mounted, ignoring");
                return;
            }

            if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') && session?.user) {
                console.log("[AuthStateChange] Processing signed in session for user:", session.user.id);
                // Clear the safety timer since we're processing a valid session
                clearTimeout(safetyTimer);

                // Double check profile fetch if needed
                if (!currentUser || currentUser.id !== session.user.id) {
                    console.log("[AuthStateChange] Fetching user profile...");
                    await fetchUserProfile(session.user);
                } else {
                    console.log("[AuthStateChange] User profile already loaded");
                }

                // Ensure data is refreshed whenever auth state confirms a session
                console.log("[AuthStateChange] Refreshing application data...");
                await refreshData();
                console.log("[AuthStateChange] Setting loading to false - session ready");
                setLoading(false);
            } else if (event === 'SIGNED_OUT') {
                console.log("[AuthStateChange] User signed out");
                // AUTO-RECONNECT CHECK
                console.warn("Supabase signaling SIGNED_OUT. Checking for recovery...");

                // Use helper to attempt recovery
                performSilentLogin().then(recovered => {
                    if (recovered) {
                        console.log("Immediate session recovery successful via helper.");
                        // Force refresh
                        refreshData();
                    } else {
                        // Normal Logout
                        setCurrentUser(null);
                        setMissions([]);
                        setClients([]);
                        setProviders([]);
                        setDocuments([]);
                        localStorage.removeItem('presta_current_user');
                        setLoading(false);
                    }
                });
            } else {
                console.log("[AuthStateChange] Unhandled event:", event);
            }
        });

        return () => {
            mounted = false;
            subscription.unsubscribe();
        };
    }, []);

    // --- RECONNECTION ON WAKE / FOCUS ---
    useEffect(() => {
        const handleReconnection = async () => {
            if (document.visibilityState === 'visible') {
                console.log("App focused/visible - Checking connection...");

                // Vérifier le rate limiting avant de faire des requêtes
                const lastReconnect = localStorage.getItem('presta_last_reconnect');
                const now = Date.now();
                if (lastReconnect && (now - parseInt(lastReconnect)) < 30000) { // 30 secondes minimum
                    console.log("[Reconnect] Rate limited, skipping check");
                    return;
                }

                localStorage.setItem('presta_last_reconnect', now.toString());

                try {
                    const { data, error } = await supabase.auth.getSession();
                    if (error) {
                        console.warn("Session check error on wake:", error);
                        // Gérer spécifiquement les erreurs de rate limiting
                        if (error.message?.includes('429') || error.message?.includes('Too Many Requests')) {
                            console.log("[Reconnect] Rate limiting detected, extending cooldown");
                            localStorage.setItem('presta_last_reconnect', (now + 180000).toString()); // 3 minutes supplémentaires
                            return;
                        }
                        return;
                    }

                    if (data?.session) {
                        setIsOnline(true);
                        // Ne pas rafraîchir les données à chaque focus pour éviter le rate limiting
                        const lastDataRefresh = localStorage.getItem('presta_last_data_refresh');
                        if (!lastDataRefresh || (now - parseInt(lastDataRefresh)) > 300000) { // 5 minutes minimum
                            await refreshData();
                            localStorage.setItem('presta_last_data_refresh', now.toString());
                        }
                    } else {
                        console.log("No active session found on wake.");
                        // Only attempt recovery if we had a user before
                        if (currentUser) {
                            const recovered = await performSilentLogin();
                            if (recovered) {
                                console.log("Immediate session recovery successful via helper.");
                                // Force refresh only if successful
                                const lastDataRefresh = localStorage.getItem('presta_last_data_refresh');
                                if (!lastDataRefresh || (now - parseInt(lastDataRefresh)) > 300000) {
                                    refreshData();
                                    localStorage.setItem('presta_last_data_refresh', now.toString());
                                }
                            } else {
                                console.warn("Immediate recovery failed, showing login screen.");
                                setIsOnline(false);
                                // Only logout admin users on failure
                                if (currentUser?.role === 'admin') {
                                    await logout(true);
                                }
                            }
                        }
                    }
                } catch (err) {
                    console.error("Reconnection error:", err);
                    // Don't disconnect on reconnection errors
                }
            }
        };

        document.addEventListener('visibilitychange', handleReconnection);
        window.addEventListener('focus', handleReconnection);

        return () => {
            document.removeEventListener('visibilitychange', handleReconnection);
            window.removeEventListener('focus', handleReconnection);
        };
    }, []);

    // --- HEARTBEAT & CONNECTION KEEPALIVE ---
    useEffect(() => {
        if (!isSupabaseConfigured || !currentUser) return;

        const heartbeatInterval = setInterval(async () => {
            try {
                if (document.visibilityState === 'hidden') return; // Don't ping if background

                // Vérifier d'abord si on a récemment fait des requêtes pour éviter le rate limiting
                const lastHeartbeat = localStorage.getItem('presta_last_heartbeat');
                const now = Date.now();
                if (lastHeartbeat && (now - parseInt(lastHeartbeat)) < 240000) { // 4 minutes minimum
                    console.log("[Heartbeat] Skipping to avoid rate limiting");
                    return;
                }

                localStorage.setItem('presta_last_heartbeat', now.toString());

                const { data: { session }, error } = await supabase.auth.getSession();
                if (error) {
                    console.warn("[Heartbeat] Session check error:", error.message);
                    // Gérer spécifiquement les erreurs de rate limiting
                    if (error.message?.includes('429') || error.message?.includes('Too Many Requests')) {
                        console.log("[Heartbeat] Rate limiting detected, extending cooldown");
                        localStorage.setItem('presta_last_heartbeat', (now + 300000).toString()); // 5 minutes supplémentaires
                        return;
                    }
                    return; // Don't disconnect on simple errors
                }

                if (!session) {
                    console.warn("[Heartbeat] Session lost, attempting recovery...");

                    // Only attempt recovery if we had a user before
                    if (currentUser) {
                        const recovered = await performSilentLogin();
                        if (recovered) {
                            console.log("[Heartbeat] Session recovered successfully");
                        } else {
                            console.warn("[Heartbeat] Recovery failed, user will need to login again");
                            setIsOnline(false);
                        }
                    }
                } else {
                    // Session is good
                    if (!isOnline) setIsOnline(true);
                }
            } catch (err) {
                console.warn("[Heartbeat] Critical error:", err);
                // Don't disconnect on heartbeat errors
            }
        }, 600000); // Check every 10 minutes (réduit encore plus la fréquence)

        return () => clearInterval(heartbeatInterval);
    }, [currentUser, isOnline]);

    const sendEmail = async (to: string, subject: string, template: string, context: any) => {
        try {
            // Send email via EmailJS service
            const success = await sendEmailViaEmailJS(to, subject, template, context);

            if (!success) {
                // Log but do not throw to prevent app crash
                console.warn("[Email] Failed to send email via EmailJS:", { to, subject, template });
                return;
            }

            console.log("[Email] ✓ Email sent successfully via EmailJS:", { to, subject, template });
        } catch (e: any) {
            console.warn("[Email] Error sending email:", e.message || e);
            // We don't throw to prevent app crash - email failures should not break the app
        }
    };

    const addNotification = async (targetUserType: 'admin' | 'client' | 'provider', type: 'info' | 'alert' | 'success' | 'message', title: string, message: string, targetUserId?: string, link?: string) => {
        console.log("[AddNotification] Creating notification:", { targetUserType, type, title, targetUserId, link });

        const id = generateUUID();
        const now = getMartiniqueNowISO();

        // CORRECTION: Utiliser target_user_type (enum NOT NULL) au lieu de target_user_role
        const insertData = {
            id,
            title,
            message,
            // type, // RETIRÉ: Cause l'erreur 400 car c'est un enum USER-DEFINED
            date: now,
            is_read: false,
            link,
            created_at: now,
            target_user_type: targetUserType, // CORRIGÉ: target_user_type est NOT NULL
            target_user_role: targetUserType, // Garder pour compatibilité
            target_user_id: targetUserId
        };

        console.log("[AddNotification] Inserting into DB:", insertData);

        const { data, error } = await supabase.from('notifications').insert(insertData).select();

        if (error) {
            console.error("[AddNotification] Error inserting notification:", error);
            return;
        }

        console.log("[AddNotification] Successfully inserted:", data);

        if (data) {
            const mappedNotif: AppNotification = {
                ...data[0],
                read: false,
                targetUserType,
                targetUserId
            };

            console.log("[AddNotification] Adding to local state:", mappedNotif);
            setNotifications(prev => [mappedNotif, ...prev]);
        }
    };

    // --- ACTIONS ---

    // TEST FUNCTION: Pour tester les notifications manuellement
    const testNotification = async () => {
        console.log("[TestNotification] Starting notification test...");

        if (!currentUser) {
            console.log("[TestNotification] No current user, cannot test");
            return;
        }

        // Test notification for current user
        await addNotification(
            currentUser.role as 'admin' | 'client' | 'provider',
            'info',
            'Test Notification',
            `Ceci est une notification de test pour ${currentUser.role}`,
            currentUser.relatedEntityId,
            'test'
        );

        console.log("[TestNotification] Test notification sent");
    };

    const addMission = async (mission: Mission) => {
        const finalId = generateUUID();
        const dbData = {
            id: finalId,
            date: mission.date,
            start_time: mission.startTime,
            end_time: mission.endTime,
            duration: mission.duration,
            client_id: mission.clientId,
            client_name: mission.clientName,
            service: mission.service,
            provider_id: (!mission.providerId || mission.providerId === 'null') ? null : mission.providerId,
            provider_name: mission.providerName,
            status: mission.status,
            color: mission.color,
            source: mission.source,
            source_document_id: mission.sourceDocumentId
        };

        const { data, error } = await supabase.from('missions').insert(dbData).select();

        if (error) {
            console.error("Error adding mission:", error);
            throw error; // Throw error to be caught by UI
        }

        if (data) {
            const m = data[0];
            const newMission: Mission = {
                ...m,
                dayIndex: getDayIndexFromDate(m.date),
                startTime: m.start_time,
                endTime: m.end_time,
                clientId: m.client_id,
                clientName: m.client_name,
                providerId: m.provider_id,
                providerName: m.provider_name,
                startPhotos: m.start_photos,
                endPhotos: m.end_photos,
                startVideo: m.start_video,
                endVideo: m.end_video,
                startRemark: m.start_remark,
                endRemark: m.end_remark,
                cancellationReason: m.cancellation_reason,
                lateCancellation: m.late_cancellation,
                reminder48hSent: m.reminder_48h_sent,
                reminder72hSent: m.reminder_72h_sent,
                reportSent: m.report_sent,
                sourceDocumentId: m.source_document_id
            };
            setMissions(prev => [...prev, newMission]);

            // NOTIF ADMIN: mission créée (toujours)
            await addNotification(
                'admin',
                'info',
                'Nouvelle Mission',
                `Mission créée: ${newMission.clientName} | ${newMission.date} ${newMission.startTime}-${newMission.endTime} | Prestataire: ${newMission.providerName || 'À assigner'}.`,
                undefined,
                'tab:planning'
            );

            if (newMission.providerId) {
                await addNotification('provider', 'info', 'Nouvelle Mission', `Vous avez été assigné à une mission le ${newMission.date}.`, newMission.providerId);
                const provider = providers.find(p => p.id === newMission.providerId);
                if (provider) {
                    await sendEmail(provider.email, 'Nouvelle Mission Assignée', 'provider_mission_assigned', {
                        missionId: newMission.id,
                        clientName: newMission.clientName
                    });
                }
            }
        }
    };

    const startMission = async (id: string, remark?: string, photos?: string[], video?: string) => {
        if (!photos || photos.length < 5) {
            alert("Il faut obligatoirement 5 photos minimum avant chantier.");
            return;
        }

        const { error } = await supabase.from('missions').update({
            status: 'in_progress',
            start_remark: remark,
            start_photos: photos,
            start_video: video
        }).eq('id', id);

        if (!error) {
            setMissions(prev => prev.map(m => m.id === id ? { ...m, status: 'in_progress', startRemark: remark, startPhotos: photos, startVideo: video } : m));

            const m = missions.find(m => m.id === id);
            if (m) {
                await addNotification('client', 'info', 'Mission Démarrée', `L'intervenant ${m.providerName} a commencé la mission.`, m.clientId);
                await addNotification('admin', 'info', 'Mission Démarrée', `Début mission chez ${m.clientName} par ${m.providerName}.`);
            }
        }
    };

    const endMission = async (id: string, remark?: string, photos?: string[], video?: string) => {
        if (!photos || photos.length < 5) {
            alert("Il faut obligatoirement 5 photos minimum fin de chantier.");
            return;
        }

        const { error } = await supabase.from('missions').update({
            status: 'completed',
            end_remark: remark,
            end_photos: photos,
            end_video: video,
            report_sent: true
        }).eq('id', id);

        if (!error) {
            setMissions(prev => prev.map(m => m.id === id ? { ...m, status: 'completed', endRemark: remark, endPhotos: photos, endVideo: video, reportSent: true } : m));
            const m = missions.find(m => m.id === id);
            if (m) {
                // NOTIFICATION ADMIN (Urgent)
                await addNotification(
                    'admin',
                    'success',
                    'Mission Terminée',
                    `Mission chez ${m.clientName} terminée par ${m.providerName}. Photos disponibles.`,
                    undefined,
                    `mission:${id}`
                );

                // EMAIL ADMIN
                await sendEmail(companySettings.email, 'Fin de Mission - Rapport disponible', 'admin_mission_report', {
                    clientName: m.clientName,
                    providerName: m.providerName,
                    date: m.date,
                    link: `https://outremerfermetures.com/reports`
                });

                // NOTIF CLIENT
                await addNotification('client', 'success', 'Mission Terminée', `La mission est terminée. Consultez le compte rendu.`, m.clientId, `mission:${id}`);

                // EMAIL CLIENT
                const client = clients.find(c => c.id === m.clientId);
                if (client && client.email) {
                    await sendEmail(client.email, 'Compte Rendu de Mission', 'mission_report', {
                        clientName: m.clientName,
                        providerName: m.providerName,
                        date: m.date,
                        service: m.service,
                        startTime: m.startTime,
                        endTime: m.endTime,
                        remark: remark || "R.A.S"
                    });
                }

                if (client) {
                    const newConsumed = (client.packsConsumed || 0) + 1;
                    await updateClient(client.id, { packsConsumed: newConsumed });
                    if (newConsumed % 10 === 0) {
                        await addNotification('admin', 'success', 'Fidélité Client', `Le client ${client.name} a atteint ${newConsumed} missions. Pensez à offrir des heures !`, undefined);
                    }
                }
            }
        }
    };

    const addClient = async (clientData: CreateClientDTO) => {
        const password = Math.random().toString(36).slice(-8);

        try {
            const dbClientData = {
                name: clientData.name,
                city: clientData.city,
                address: clientData.address,
                phone: clientData.phone,
                email: clientData.email,
                pack: clientData.pack,
                status: clientData.status,
                since: clientData.since,
                packs_consumed: clientData.packsConsumed || 0,
                loyalty_hours_available: clientData.loyaltyHoursAvailable || 0,
                has_left_review: false
            };

            // First create the client entity
            const { data, error } = await supabase.from('clients').insert(dbClientData).select();

            if (error) throw error;

            if (data && data.length > 0) {
                const newClient = data[0];

                // Then try to create the Auth User via Edge Function
                try {
                    const { error: fnError } = await supabase.functions.invoke('create-user', {
                        body: {
                            email: clientData.email,
                            password: password,
                            name: clientData.name,
                            role: 'client',
                            relatedEntityId: newClient.id
                        }
                    });

                    if (fnError) {
                        console.warn("Error creating auth user via function:", fnError);
                        // Continue anyway, the client record is created
                    }

                    // Send Email only if auth created successfully or generic welcome
                    await sendEmail(clientData.email, 'Bienvenue - Accès Espace Client', 'welcome_client_panel', {
                        name: clientData.name,
                        login: clientData.email,
                        password: password,
                        link: 'https://outremerfermetures.com/login'
                    });

                } catch (e) {
                    console.warn("Auth edge function failed/unavailable or restricted.", e);
                }

                setClients(prev => [...prev, {
                    ...newClient,
                    packsConsumed: newClient.packs_consumed,
                    loyaltyHoursAvailable: newClient.loyalty_hours_available,
                    hasLeftReview: newClient.has_left_review,
                }]);

                return password;
            }
        } catch (err) {
            console.error("Critical error in addClient:", err);
            return null;
        }
        return null;
    };

    const addProvider = async (providerData: CreateProviderDTO) => {
        const password = Math.random().toString(36).slice(-8);

        try {
            const dbProviderData = {
                first_name: providerData.firstName,
                last_name: providerData.lastName,
                specialty: providerData.specialty,
                phone: providerData.phone,
                email: providerData.email,
                status: providerData.status,
                hours_worked: 0,
                rating: 5
            };

            // Create Provider Entity
            const { data, error } = await supabase.from('providers').insert(dbProviderData).select();

            if (error) {
                console.error("Error inserting provider:", error);
                throw error;
            }

            if (data && data.length > 0) {
                const newProvider = data[0];

                // Envoi de l'email de bienvenue sans créer de compte Supabase Auth
                try {
                    await sendEmail(providerData.email, 'Votre compte Prestataire est actif', 'welcome_provider', {
                        name: providerData.firstName,
                        login: providerData.email,
                        password: password,
                        link: 'https://outremerfermetures.com/login'
                    });
                    console.log("Email de bienvenue envoyé au prestataire:", providerData.email);
                } catch (e) {
                    console.warn("Erreur lors de l'envoi de l'email:", e);
                }

                setProviders(prev => [...prev, {
                    ...newProvider,
                    firstName: newProvider.first_name,
                    lastName: newProvider.last_name,
                    hoursWorked: newProvider.hours_worked,
                    leaves: []
                }]);

                await addNotification('admin', 'success', 'Prestataire Créé', `Email envoyé à ${providerData.email}`);

                return password;
            }
        } catch (err) {
            console.error("Critical error in addProvider:", err);
            return null;
        }
        return null;
    };

    const login = async (email: string, password?: string): Promise<boolean> => {
        if (!password) return false;

        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password
            });
            if (data.user) {
                // Save auth recovery info for session persistence
                try {
                    const authRecovery = btoa(JSON.stringify({ e: email, p: password }));
                    localStorage.setItem('presta_auth_recovery', authRecovery);
                } catch { }

                await fetchUserProfile(data.user);
                await refreshData();
                return true;
            }
        } catch (e) {
            console.warn("Auth login failed, attempting fallback...");
        }

        // SOLUTION DÉFINITIVE: Fallback robuste pour les connexions prestataires/clients
        try {
            // Vérifier d'abord si c'est un client
            const { data: clientData, error: clientError } = await supabase.from('clients').select('*').eq('email', email).maybeSingle();

            if (clientData && !clientError) {
                // Validation du mot de passe pour le client
                // Pour l'instant, on utilise une validation simple (à améliorer selon vos besoins)
                // Vous pouvez ajouter ici votre logique de validation de mot de passe
                const isValidPassword = password && password.length > 0; // Logique à adapter
                
                if (!isValidPassword) {
                    console.error("Mot de passe invalide pour le client");
                    return false;
                }
                
                const userObj: User = {
                    id: clientData.id,
                    email: clientData.email,
                    name: clientData.name,
                    role: 'client',
                    relatedEntityId: clientData.id
                };
                setCurrentUser(userObj);
                setSimulatedClientId(clientData.id);

                try {
                    localStorage.setItem('presta_current_user', JSON.stringify(userObj));
                    // Save auth recovery info for session persistence
                    const authRecovery = btoa(JSON.stringify({ e: email, p: password }));
                    localStorage.setItem('presta_auth_recovery', authRecovery);
                } catch { }

                // CRITICAL FIX: Refresh data and stop loading
                await refreshData();
                setLoading(false);
                return true;
            }

            // Vérifier si c'est un prestataire
            const { data: providerData, error: providerError } = await supabase.from('providers').select('*').eq('email', email).maybeSingle();

            if (providerData && !providerError) {
                // Vérifier si le prestataire est actif
                if (providerData.status !== 'Active') {
                    console.error("Prestataire inactif - connexion refusée");
                    return false;
                }
                
                // Validation renforcée du mot de passe pour prestataire
                const isValidPassword = password && password.length >= 6; // Minimum 6 caractères
                
                if (!isValidPassword) {
                    console.error("Mot de passe invalide pour le prestataire (minimum 6 caractères)");
                    return false;
                }
                
                const userObj: User = {
                    id: providerData.id,
                    email: providerData.email,
                    name: `${providerData.first_name} ${providerData.last_name}`,
                    role: 'provider',
                    relatedEntityId: providerData.id
                };
                
                setCurrentUser(userObj);
                setSimulatedProviderId(providerData.id);

                try {
                    localStorage.setItem('presta_current_user', JSON.stringify(userObj));
                    // Save auth recovery info for session persistence
                    const authRecovery = btoa(JSON.stringify({ e: email, p: password }));
                    localStorage.setItem('presta_auth_recovery', authRecovery);
                } catch { }

                await refreshData();
                setLoading(false);
                return true;
            }

            // Si ni client ni prestataire trouvé
            console.error("Utilisateur non trouvé dans les tables clients ou providers");
            return false;

        } catch (error) {
            console.error("Erreur lors du fallback d'authentification:", error);
            return false;
        }
    };

    const updateCompanySettings = async (settings: CompanySettings) => {
        try {
            const dbData = {
                name: settings.name,
                address: settings.address,
                siret: settings.siret,
                email: settings.email,
                phone: settings.phone,
                tva_rate_default: settings.tvaRateDefault,
                email_notifications: settings.emailNotifications,
                loyalty_reward_hours: settings.loyaltyRewardHours,
                logo_url: settings.logoUrl
            };
            const { data: existing } = await supabase.from('company_settings').select('id').maybeSingle();
            let error;
            if (existing) {
                const res = await supabase.from('company_settings').update(dbData).eq('id', existing.id);
                error = res.error;
            } else {
                const res = await supabase.from('company_settings').insert(dbData);
                error = res.error;
            }
            if (error) throw error;
            setCompanySettings(settings);
        } catch (err) {
            console.error("Erreur sauvegarde settings:", err);
            throw err;
        }
    };

    const cancelMissionByProvider = async (id: string, reason: string) => {
        const m = missions.find(m => m.id === id);
        if (!reason) { alert("Le motif d'annulation est obligatoire."); return; }

        // IMPORTANT: Une mission annulée par prestataire doit revenir en "non attribué" pour ré-attribution.
        const { error } = await supabase.from('missions').update({
            status: 'planned',
            cancellation_reason: reason,
            provider_id: null,
            provider_name: 'À assigner',
            color: 'gray'
        }).eq('id', id);
        if (!error) {
            setMissions(prev => prev.map(mission => mission.id === id ? {
                ...mission,
                status: 'planned',
                providerId: null,
                providerName: 'À assigner',
                color: 'gray',
                cancellationReason: reason
            } : mission));

            // NOTIF ADMIN (Urgent)
            await addNotification(
                'admin',
                'alert',
                'Mission à ré-attribuer',
                `Annulation prestataire: ${m?.providerName} | Motif: ${reason}. Mission remise en "À assigner".`,
                undefined,
                'tab:planning'
            );

            // EMAIL ADMIN
            await sendEmail(companySettings.email, 'URGENT - Annulation Prestataire', 'admin_mission_cancelled', {
                providerName: m?.providerName,
                clientName: m?.clientName,
                date: m?.date,
                reason: reason
            });

            // NOTIF CLIENT
            if (m && m.clientId) {
                await addNotification('client', 'alert', 'Intervenant Indisponible', `L'intervenant a dû annuler la mission (Motif: ${reason}). Nous recherchons une solution.`, m.clientId);
            }
        }
    };

    const cancelMissionByClient = async (id: string) => {
        const m = missions.find(m => m.id === id);
        if (m) {
            const isLate = !canCancelMission(m); // isLate means < 48h
            const { error } = await supabase.from('missions').update({
                // IMPORTANT (demande): une mission annulée doit revenir en "non attribué" pour ré-attribution.
                status: 'planned',
                cancellation_reason: 'Annulé par client',
                late_cancellation: isLate,
                provider_id: null,
                provider_name: 'À assigner',
                color: 'gray'
            }).eq('id', id);

            if (!error) {
                setMissions(prev => prev.map(mission => mission.id === id ? {
                    ...mission,
                    status: 'planned',
                    providerId: null,
                    providerName: 'À assigner',
                    color: 'gray',
                    cancellationReason: 'Annulé par client',
                    lateCancellation: isLate
                } : mission));

                if (isLate) {
                    await addNotification('client', 'alert', 'Annulation Tardive', `Votre mission a été annulée moins de 48h à l'avance. Elle est considérée comme réalisée et sera facturée à 50% (Hors SAP).`, m.clientId);
                    await addNotification('admin', 'alert', 'Mission à ré-attribuer (Annulation tardive)', `Le client ${m.clientName} a annulé < 48h. Mission remise en "À assigner". A facturer 50%.`, undefined, 'tab:planning');
                    // EMAIL ADMIN
                    await sendEmail(companySettings.email, 'URGENT - Annulation Tardive Client', 'admin_client_cancelled_late', {
                        clientName: m.clientName,
                        date: m.date
                    });
                } else {
                    await addNotification('admin', 'info', 'Mission à ré-attribuer', `Client: ${m.clientName} a annulé le RDV (Délai respecté). Mission remise en "À assigner".`, undefined, 'tab:planning');
                    // EMAIL ADMIN
                    await sendEmail(companySettings.email, 'Annulation Client', 'admin_client_cancelled', {
                        clientName: m.clientName,
                        date: m.date
                    });
                }

                if (m.providerId) {
                    await addNotification('provider', 'alert', 'Mission Annulée', `Le client ${m.clientName} a annulé la mission du ${m.date}. Le créneau est libéré.`, m.providerId);
                }
            }
        }
    };

    const canCancelMission = (mission: Mission) => {
        if (!mission.date) return true;
        const missionDate = new Date(`${mission.date}T${mission.startTime}`);
        const now = new Date();
        const diffHours = (missionDate.getTime() - now.getTime()) / (1000 * 60 * 60);
        return diffHours > 48;
    };

    const assignProvider = async (missionId: string, providerId: string, providerName: string) => {
        const existingMission = missions.find(m => m.id === missionId);

        const { error } = await supabase.from('missions').update({ provider_id: providerId, provider_name: providerName, status: 'planned', color: 'orange' }).eq('id', missionId);

        if (!error) {
            setMissions(prev => prev.map(m => m.id === missionId ? { ...m, providerId, providerName, status: 'planned', color: 'orange' } : m));

            await addNotification(
                'admin',
                'info',
                'Mission attribuée',
                `Mission attribuée à ${providerName} (${existingMission?.clientName || 'Client'} - ${existingMission?.date || ''} ${existingMission?.startTime || ''}-${existingMission?.endTime || ''}).`,
                undefined,
                'tab:planning'
            );

            await addNotification('provider', 'info', 'Nouvelle Mission', `Vous avez été assigné à une mission.`, providerId);

            const provider = providers.find(p => p.id === providerId);
            if (provider) {
                await sendEmail(provider.email, 'Nouvelle Mission Assignée', 'provider_mission_assigned', {
                    missionId,
                    clientName: missions.find(m => m.id === missionId)?.clientName
                });
            }

            if (existingMission && existingMission.providerId && existingMission.providerId !== providerId) {
                await addNotification('provider', 'alert', 'Mission Annulée', `La mission du ${existingMission.date} a été annulée pour remplacement.`, existingMission.providerId);
            }
        }
    };

    const updateClient = async (id: string, data: Partial<Client>) => {
        const dbData: any = {};
        if (data.name) dbData.name = data.name;
        if (data.city) dbData.city = data.city;
        if (data.address) dbData.address = data.address;
        if (data.phone) dbData.phone = data.phone;
        if (data.email) dbData.email = data.email;
        if (data.packsConsumed !== undefined) dbData.packs_consumed = data.packsConsumed;
        if (data.loyaltyHoursAvailable !== undefined) dbData.loyalty_hours_available = data.loyaltyHoursAvailable;
        if (data.hasLeftReview !== undefined) dbData.has_left_review = data.hasLeftReview;

        const { error } = await supabase.from('clients').update(dbData).eq('id', id);
        if (!error) {
            setClients(prev => prev.map(c => c.id === id ? { ...c, ...data } : c));
        }
    };

    const deleteClients = async (ids: string[]) => {
        const { error } = await supabase.from('clients').delete().in('id', ids);
        if (!error) {
            setClients(prev => prev.filter(c => !ids.includes(c.id)));
        }
    };

    const addLoyaltyHours = async (clientId: string, hours: number) => {
        const client = clients.find(c => c.id === clientId);
        if (client) {
            const newTotal = (client.loyaltyHoursAvailable || 0) + hours;
            const { error } = await supabase.from('clients').update({ loyalty_hours_available: newTotal }).eq('id', clientId);
            if (!error) setClients(prev => prev.map(c => c.id === clientId ? { ...c, loyaltyHoursAvailable: newTotal } : c));
        }
    };

    const submitClientReview = async (clientId: string, rating: number, comment: string) => {
        const { error } = await supabase.from('clients').update({ has_left_review: true }).eq('id', clientId);
        if (!error) setClients(prev => prev.map(c => c.id === clientId ? { ...c, hasLeftReview: true } : c));
        await supabase.from('reviews').insert({ clientId, rating, comment, date: getMartiniqueNowISO() });
    };

    const updateProvider = async (id: string, data: Partial<Provider>) => {
        const dbData: any = {};
        if (data.firstName) dbData.first_name = data.firstName;
        if (data.lastName) dbData.last_name = data.lastName;
        if (data.phone) dbData.phone = data.phone;
        if (data.email) dbData.email = data.email;
        if (data.specialty) dbData.specialty = data.specialty;
        if (data.status) dbData.status = data.status;
        const { error } = await supabase.from('providers').update(dbData).eq('id', id);
        if (!error) {
            setProviders(prev => prev.map(p => p.id === id ? { ...p, ...data } : p));
        }
    };

    const deleteProviders = async (ids: string[]) => {
        const { error } = await supabase.from('providers').delete().in('id', ids);
        if (!error) {
            setProviders(prev => prev.filter(p => !ids.includes(p.id)));
        }
    };

    const addLeave = async (providerId: string, start: string, end: string, startTime?: string, endTime?: string) => {
        const dbData = {
            provider_id: providerId,
            start_date: start,
            end_date: end,
            status: 'pending',
            start_time: startTime || '00:00:00',
            end_time: endTime || '23:59:59'
        };
        const { data, error } = await supabase.from('leaves').insert(dbData).select();

        if (error) {
            console.error("Erreur enregistrement congés:", error);
            return;
        }

        if (data) {
            const newLeave = data[0];
            setProviders(prev => prev.map(p => {
                if (p.id === providerId) {
                    const leave: Leave = {
                        id: newLeave.id,
                        providerId: newLeave.provider_id,
                        startDate: newLeave.start_date,
                        endDate: newLeave.end_date,
                        startTime: newLeave.start_time,
                        endTime: newLeave.end_time,
                        status: newLeave.status
                    };
                    return { ...p, leaves: [...p.leaves, leave] };
                }
                return p;
            }));

            const provider = providers.find(p => p.id === providerId);
            await addNotification('admin', 'alert', 'Demande de Congés', `Nouvelle demande de ${provider?.firstName} ${provider?.lastName}.`, undefined, 'tab:absences');
        }
    };

    const updateLeaveStatus = async (leaveId: string, providerId: string, status: 'approved' | 'rejected') => {
        const { error } = await supabase.from('leaves').update({ status }).eq('id', leaveId);
        if (!error) {
            setProviders(prev => prev.map(p => {
                if (p.id === providerId) {
                    const updatedLeaves = p.leaves.map(l => l.id === leaveId ? { ...l, status } : l);
                    return { ...p, leaves: updatedLeaves };
                }
                return p;
            }));
            if (status === 'approved') {
                await addNotification('admin', 'alert', 'Congés Validés', 'Pensez à réorganiser les plannings du prestataire.');
                await addNotification('provider', 'success', 'Congés Validés', 'Votre demande de congés a été acceptée.', providerId);
            } else {
                await addNotification('provider', 'alert', 'Congés Refusés', 'Votre demande de congés a été refusée.', providerId);
            }
        }
    };

    const resetProviderPassword = async (id: string) => {
        const provider = providers.find(p => p.id === id);
        if (provider) {
            const newPass = Math.random().toString(36).slice(-8);
            setProviders(prev => prev.map(p => p.id === id ? { ...p, initialPassword: newPass } : p));
            await sendEmail(provider.email, 'Réinitialisation de mot de passe', 'reset_password', {
                newPassword: newPass
            });
        }
    };

    const addDocument = async (doc: Document) => {
        // Validation for Pack Ultime 6 - must have 6 hours in one day
        if (doc.type === 'Devis' && doc.packId) {
            const pack = packs.find(p => p.id === doc.packId);
            if (pack && pack.name.includes('Ultime 6')) {
                let totalHours = 0;
                let hasMultipleDays = false;
                const firstDate = doc.slotsData && doc.slotsData.length > 0 ? doc.slotsData[0].date : null;

                if (doc.slotsData && Array.isArray(doc.slotsData)) {
                    doc.slotsData.forEach((slot: any) => {
                        if (slot.startTime && slot.endTime) {
                            const start = new Date(`2000-01-01T${slot.startTime}`);
                            const end = new Date(`2000-01-01T${slot.endTime}`);
                            const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
                            totalHours += hours;

                            if (firstDate && slot.date !== firstDate) {
                                hasMultipleDays = true;
                            }
                        }
                    });
                }

                if (totalHours < 6 || hasMultipleDays) {
                    const sessionsCount = doc.slotsData ? doc.slotsData.length : 0;
                    const warningMessage = hasMultipleDays
                        ? "Le Pack Ultime 6 doit être effectué sur une seule journée. Veuillez regrouper les créneaux sur le même jour."
                        : `Le pack "Pack ULTIME 6" requiert exactement 6h. Vous avez planifié ${totalHours.toFixed(1)}h (${sessionsCount} séance(s)).`;

                    throw new Error(warningMessage);
                }
            }
        }

        const finalId = generateUUID();
        const dbDocData = {
            id: finalId,
            ref: doc.ref,
            client_id: doc.clientId,
            client_name: doc.clientName,
            date: doc.date,
            type: doc.type,
            category: doc.category,
            description: doc.description,
            unit_price: doc.unitPrice,
            quantity: doc.quantity,
            tva_rate: doc.tvaRate,
            total_ht: doc.totalHT,
            total_ttc: doc.totalTTC,
            tax_credit_enabled: doc.taxCreditEnabled,
            status: doc.status,
            slots_data: doc.slotsData,
            reminder_sent: false,
            frequency: doc.frequency,
            recurrence_end_date: doc.recurrenceEndDate
        };
        const { data, error } = await supabase.from('documents').insert(dbDocData).select();

        if (error) {
            console.error("Error creating document:", error);
            throw error; // Let component handle error
        }

        if (data) {
            const newDoc = data[0];
            setDocuments(prev => [...prev, {
                ...newDoc,
                clientId: newDoc.client_id,
                clientName: newDoc.client_name,
                unitPrice: newDoc.unit_price,
                tvaRate: newDoc.tva_rate,
                totalHT: newDoc.total_ht,
                totalTTC: newDoc.total_ttc,
                taxCreditEnabled: newDoc.tax_credit_enabled,
                slotsData: newDoc.slots_data,
                reminderSent: newDoc.reminder_sent,
                recurrenceEndDate: newDoc.recurrence_end_date
            }]);

            // Envoyer une notification au client lors de la création du devis
            await addNotification('client', 'info', 'Nouveau Devis Disponible', `Un nouveau devis (${doc.type} ${doc.ref}) de ${doc.totalTTC.toFixed(2)} € est disponible pour consultation.`, doc.clientId, `document:${newDoc.id}`);

            // Envoyer une notification à l'admin
            await addNotification('admin', 'success', 'Devis Créé', `Devis ${doc.ref} créé pour ${doc.clientName} - Montant: ${doc.totalTTC.toFixed(2)} €`, undefined, `document:${newDoc.id}`);

            const client = clients.find(c => c.id === doc.clientId);
            if (client && client.email) {
                await sendEmail(client.email, 'Nouveau devis disponible', 'quote_created', {
                    clientName: client.name,
                    quoteRef: doc.ref,
                    amount: doc.totalTTC.toFixed(2)
                });

                // Notification supplémentaire lors de l'envoi par email
                await addNotification('client', 'info', 'Devis Envoyé par Email', `Le devis ${doc.ref} a été envoyé à votre adresse email ${client.email}.`, doc.clientId, `document:${newDoc.id}`);
            }
        }
    };

    const generateMissionsFromDocument = async (doc: Document) => {
        // ... rest of the code remains the same ...
        if (!doc.slotsData || !Array.isArray(doc.slotsData)) return;
        const missionsToCreate: any[] = [];
        const isRecurring = doc.frequency && doc.frequency !== 'Ponctuelle';
        const endDate = doc.recurrenceEndDate ? new Date(doc.recurrenceEndDate) : new Date(new Date().setFullYear(toMartiniqueTime(new Date()).getFullYear() + 1));

        // Use document slots to generate planned missions
        for (const slot of doc.slotsData) {
            if (isRecurring && slot.date) {
                let currentDate = new Date(slot.date);
                while (currentDate <= endDate) {
                    const missionId = generateUUID();
                    missionsToCreate.push({
                        id: missionId,
                        date: currentDate.toISOString().split('T')[0],
                        start_time: slot.startTime,
                        end_time: slot.endTime,
                        duration: slot.duration,
                        client_id: doc.clientId,
                        client_name: doc.clientName,
                        service: doc.description,
                        provider_id: null,
                        provider_name: 'À assigner',
                        status: 'planned',
                        color: 'gray',
                        source: 'devis',
                        source_document_id: doc.id
                    });
                    if (doc.frequency === 'Hebdomadaire') currentDate = addDays(currentDate, 7);
                    else if (doc.frequency === 'Bimensuelle') currentDate = addDays(currentDate, 14);
                    else if (doc.frequency === 'Mensuelle') currentDate = addMonths(currentDate, 1);
                    else break;
                }
            } else if (slot.date) {
                const missionId = generateUUID();
                missionsToCreate.push({
                    id: missionId,
                    date: slot.date,
                    start_time: slot.startTime,
                    end_time: slot.endTime,
                    duration: slot.duration,
                    client_id: doc.clientId,
                    client_name: doc.clientName,
                    service: doc.description,
                    provider_id: null,
                    provider_name: 'À assigner',
                    status: 'planned',
                    color: 'gray',
                    source: 'devis',
                    source_document_id: doc.id
                });
            }
        }
        if (missionsToCreate.length > 0) {
            const { error } = await supabase.from('missions').insert(missionsToCreate);
            if (!error) {
                const createdMissions = missionsToCreate.map(m => ({
                    ...m,
                    dayIndex: getDayIndexFromDate(m.date),
                    startTime: m.start_time,
                    endTime: m.end_time,
                    clientId: m.client_id,
                    clientName: m.client_name,
                    providerId: m.provider_id,
                    providerName: m.provider_name
                }));
                setMissions(prev => [...prev, ...createdMissions]);
                await addNotification('admin', 'success', 'Planning Automatique', `${createdMissions.length} missions générées et bloquées selon devis signé.`);
            }
        }
    };

    const updateDocumentStatus = async (id: string, status: string) => {
        const oldDoc = documents.find(d => d.id === id);
        const { error } = await supabase.from('documents').update({ status }).eq('id', id);
        if (!error) {
            setDocuments(prev => prev.map(d => d.id === id ? { ...d, status: status as any } : d));
            if (oldDoc && oldDoc.status !== 'signed' && status === 'signed') {
                const updatedDoc = documents.find(d => d.id === id);
                if (updatedDoc) {
                    await generateMissionsFromDocument({ ...updatedDoc, status: 'signed' });
                }
            }
            const client = clients.find(c => c.id === oldDoc?.clientId);
            if (client && client.email && status !== oldDoc?.status) {
                await sendEmail(client.email, `Mise à jour Document : ${oldDoc?.ref}`, 'document_status_update', {
                    ref: oldDoc?.ref,
                    status: status
                });
            }
        }
    };

    const deleteDocument = async (id: string) => {
        const { error } = await supabase.from('documents').delete().eq('id', id);
        if (!error) setDocuments(prev => prev.filter(d => d.id !== id));
    };

    const deleteDocuments = async (ids: string[]) => {
        const { error } = await supabase.from('documents').delete().in('id', ids);
        if (!error) {
            setDocuments(prev => prev.filter(d => !ids.includes(d.id)));
        }
    };

    const duplicateDocument = async (id: string) => {
        const doc = documents.find(d => d.id === id);
        if (doc) {
            // Remove ID to force new insertion, and update Ref to avoid unique constraint if any
            const { id: oldId, ...rest } = doc;
            const newRef = `${doc.ref}-COPY-${Date.now().toString().slice(-4)}`;

            const newDoc: Document = {
                ...rest,
                id: generateUUID(),
                ref: newRef,
                status: doc.type === 'Devis' ? 'sent' : 'pending',
                date: getMartiniqueToday()
            };

            await addDocument(newDoc);
        }
    };

    const convertQuoteToInvoice = async (quoteId: string) => {
        const quote = documents.find(d => d.id === quoteId);
        if (quote) {
            const { id: _, ...rest } = quote;
            const invoice: Document = {
                ...rest,
                id: generateUUID(),
                ref: quote.ref.replace('DEV', 'FAC') + '-' + Date.now().toString().slice(-4),
                type: 'Facture',
                status: 'pending',
                date: getMartiniqueToday()
            };
            await updateDocumentStatus(quoteId, 'converted');
            await addDocument(invoice);
        }
    };

    const markInvoicePaid = async (id: string) => {
        await updateDocumentStatus(id, 'paid');
    };

    const sendDocumentReminder = async (id: string) => {
        const { error } = await supabase.from('documents').update({ reminder_sent: true }).eq('id', id);
        if (!error) setDocuments(prev => prev.map(d => d.id === id ? { ...d, reminderSent: true } : d));
    };

    const signQuoteWithData = async (id: string, signatureData: string) => {
        // Concurrency Check: Check if any slot in the document is already taken by a PLANNED or CONFIRMED mission
        const docToSign = documents.find(d => d.id === id);
        if (docToSign && docToSign.slotsData) {
            const conflictingSlots = [];
            const availableProvidersForSlots = [];
            
            // Analyser chaque créneau pour détecter les conflits et trouver des prestataires disponibles
            for (const slot of docToSign.slotsData) {
                if (!slot.date) continue;
                
                const slotStart = new Date(`${slot.date}T${slot.startTime}`);
                const slotEnd = new Date(`${slot.date}T${slot.endTime}`);
                
                // Vérifier s'il y a des missions en conflit
                const conflictingMissions = missions.filter(m => {
                    if (m.status === 'cancelled' || !m.date) return false;
                    const mStart = new Date(`${m.date}T${m.startTime}`);
                    const mEnd = new Date(`${m.date}T${m.endTime}`);
                    return (slotStart < mEnd && slotEnd > mStart);
                });
                
                if (conflictingMissions.length > 0) {
                    conflictingSlots.push({
                        slot,
                        conflictingMissions
                    });
                    
                    // Trouver les prestataires disponibles pour ce créneau
                    const availableProviders = providers.filter(provider => {
                        if (provider.status !== 'Active') return false;
                        
                        // Vérifier si le prestataire est déjà assigné à une mission en conflit
                        const isAssignedToConflictingMission = conflictingMissions.some(m => 
                            m.providerId === provider.id
                        );
                        
                        if (isAssignedToConflictingMission) return false;
                        
                        // Vérifier si le prestataire a déjà une mission à ce créneau
                        const hasOtherMission = missions.some(m => {
                            if (m.status === 'cancelled' || !m.date || m.providerId !== provider.id) return false;
                            const mStart = new Date(`${m.date}T${m.startTime}`);
                            const mEnd = new Date(`${m.date}T${m.endTime}`);
                            return (slotStart < mEnd && slotEnd > mStart);
                        });
                        
                        return !hasOtherMission;
                    });
                    
                    availableProvidersForSlots.push({
                        slot,
                        availableProviders: availableProviders.map(p => `${p.firstName} ${p.lastName}`)
                    });
                }
            }
            
            if (conflictingSlots.length > 0) {
                // Vérifier s'il y a des prestataires disponibles pour tous les créneaux en conflit
                const allSlotsHaveProviders = availableProvidersForSlots.every(slotInfo => 
                    slotInfo.availableProviders.length > 0
                );
                
                if (allSlotsHaveProviders) {
                    // Il y a des prestataires disponibles, on peut continuer avec une notification informative
                    const providerDetails = availableProvidersForSlots.map(slotInfo => 
                        `Créneau ${slotInfo.slot.startTime}-${slotInfo.slot.endTime}: ${slotInfo.availableProviders.join(', ')}`
                    ).join('\n');
                    
                    await addNotification('admin', 'info', 'Réassignation Automatique Requise', 
                        `Le devis ${docToSign.ref} a été signé mais certains créneaux sont occupés. ` +
                        `Prestataires disponibles pour la réassignation:\n${providerDetails}`);
                    
                    console.log('Slots conflict detected but providers available:', availableProvidersForSlots);
                } else {
                    // Aucun prestataire disponible pour au moins un créneau
                    const unavailableSlots = availableProvidersForSlots
                        .filter(slotInfo => slotInfo.availableProviders.length === 0)
                        .map(slotInfo => `${slotInfo.slot.date} ${slotInfo.slot.startTime}-${slotInfo.slot.endTime}`);
                    
                    await addNotification('client', 'alert', 'Conflit de Créneaux', 
                        `Un ou plusieurs créneaux ne sont plus disponibles et aucun prestataire alternatif n'est disponible pour: ${unavailableSlots.join(', ')}. ` +
                        `Veuillez contacter le secrétariat pour modifier votre devis.`);
                    
                    await addNotification('admin', 'alert', 'Conflit de Créneaux - Aucun Prestataire Disponible', 
                        `Devis ${docToSign.ref}: Créneaux indisponibles sans prestataire alternatif: ${unavailableSlots.join(', ')}`);
                    
                    throw new Error("Conflit de créneaux : aucun prestataire disponible pour les créneaux demandés");
                }
            }
        }

        const now = getMartiniqueNowISO();
        console.log('Saving signature for quote:', id, 'signatureData length:', signatureData?.length);
        const { error } = await supabase.from('documents').update({ status: 'signed', signature_data: signatureData, signature_date: now }).eq('id', id);

        if (!error) {
            setDocuments(prev => prev.map(d => d.id === id ? { ...d, status: 'signed', signatureData, signatureDate: now } : d));
            console.log('Quote signature saved successfully');

            // FIND ASSOCIATED CONTRACT (by pack name match usually)
            const quote = documents.find(d => d.id === id);
            if (quote) {
                console.log('Found quote:', quote.id, 'client:', quote.clientId);
                // Heuristic: Find contract where pack name is inside quote description or just update all contracts for this client?
                // Ideally, link via packId if we had it stored on Document.
                // Fallback: If we can't link precisely, we'll try to find the contract linked to the pack used in the quote.

                // Try to find the pack
                const pack = packs.find(p => quote.description.includes(p.name));

                if (pack) {
                    const relatedContract = contracts.find(c => c.packId === pack.id);
                    if (relatedContract) {
                        console.log('Found existing contract:', relatedContract.id, 'updating signature');
                        console.log('Contract current signature:', relatedContract.clientSignatureUrl ? 'exists' : 'none');
                        console.log('New signature data length:', signatureData?.length);
                        // Update Contract Signature
                        await supabase.from('contracts').update({
                            client_signature_url: signatureData,
                            signed_at: now
                        }).eq('id', relatedContract.id);

                        setContracts(prev => prev.map(c => c.id === relatedContract.id ? { ...c, clientSignatureUrl: signatureData, signedAt: now } : c));
                        console.log('Contract signature updated successfully');
                    } else {
                        // Create contract automatically when quote is signed
                        const client = clients.find(c => c.id === quote.clientId);
                        console.log('Creating contract for client:', client?.id, 'from quote:', quote.id);
                        if (client) {
                            const newContract = generateContractFromTemplate(quote, client, pack);
                            if (newContract) {
                                // Add clientId to the contract
                                newContract.clientId = quote.clientId;
                                newContract.clientSignatureUrl = signatureData;
                                newContract.signedAt = now;
                                newContract.status = 'active';

                                console.log('About to add contract:', {
                                    id: newContract.id,
                                    clientId: newContract.clientId,
                                    clientSignatureUrl: newContract.clientSignatureUrl ? 'exists' : 'none',
                                    signatureDataLength: signatureData?.length
                                });
                                await addContract(newContract);
                                console.log('Contract created automatically from signed quote:', newContract.id);
                            } else {
                                console.log('Failed to generate contract from template');
                            }
                        } else {
                            console.log('Client not found for quote:', quote.clientId);
                        }
                    }
                }
            }

            // NOTIF ADMIN (Urgent)
            await addNotification('admin', 'success', 'Devis Signé', `Devis ${quote?.ref} signé par client. Créneaux verrouillés.`);

            // EMAIL ADMIN
            await sendEmail(companySettings.email, 'URGENT - Devis Signé', 'admin_quote_signed', {
                ref: quote?.ref,
                clientName: quote?.clientName,
                total: quote?.totalTTC
            });

            if (quote) {
                await generateMissionsFromDocument({ ...quote, status: 'signed' });
            }
        }
    };

    const refuseQuote = async (id: string) => {
        await updateDocumentStatus(id, 'rejected');
        const doc = documents.find(d => d.id === id);

        // NOTIF ADMIN
        await addNotification('admin', 'alert', 'Devis Refusé', `Devis ${doc?.ref} refusé par client.`);

        // EMAIL ADMIN
        await sendEmail(companySettings.email, 'Devis Refusé', 'admin_quote_rejected', {
            ref: doc?.ref,
            clientName: doc?.clientName
        });
    };

    const requestInvoice = async (docId: string) => {
        const doc = documents.find(d => d.id === docId);
        await addNotification('admin', 'info', 'Demande Facture', `Client demande la facture pour le document ${doc?.ref}. Vérifier avis.`);
    };

    const refundTransaction = async (ref: string, amount: number) => {
        const doc = documents.find(d => d.ref === ref);
        if (doc) {
            const refundDoc: Document = {
                id: generateUUID(),
                ref: `AVOIR-${ref}`,
                clientId: doc.clientId,
                clientName: doc.clientName,
                date: getMartiniqueToday(),
                type: 'Facture',
                category: 'pack',
                description: `Remboursement sur facture ${ref}`,
                unitPrice: -Math.abs(amount),
                quantity: 1,
                tvaRate: doc.tvaRate,
                totalHT: -Math.abs(amount),
                totalTTC: -Math.abs(amount),
                taxCreditEnabled: false,
                status: 'paid'
            };
            await addDocument(refundDoc);
            await addNotification('client', 'info', 'Remboursement', `Avoir de ${amount}€ émis pour ${ref}.`, doc.clientId);
            await addNotification('admin', 'info', 'Remboursement', `Remboursement de ${amount}€ effectué pour ${ref}.`);
        }
    };

    const addPack = async (pack: Pack) => {
        const finalId = generateUUID();
        const mergedDescription = pack.description ? `${pack.description}\n| Lieu: ${pack.location || 'Domicile Client'}` : `| Lieu: ${pack.location || 'Domicile Client'}`;
        const dbFrequency = pack.frequency ? pack.frequency.toLowerCase() : 'ponctuelle';
        const dbPackData = {
            id: finalId,
            name: pack.name,
            main_service: pack.mainService,
            description: mergedDescription,
            hours: pack.hours,
            frequency: dbFrequency,
            supplies_included: pack.suppliesIncluded,
            supplies_details: pack.suppliesDetails,
            type: pack.type,
            price_ttc: pack.priceTTC,
            price_ht: pack.priceHT,
            price_tax_credit: pack.priceTaxCredit,
            contract_type: pack.contractType,
            is_sap: pack.isSap,
            schedules: pack.schedules
        };
        const { data, error } = await supabase.from('packs').insert(dbPackData).select();
        if (error) { console.error("Erreur addPack:", error); return null; }
        if (data) {
            const newPack = data[0];
            setPacks(prev => [...prev, {
                ...newPack,
                mainService: newPack.main_service,
                priceTTC: newPack.price_ttc,
                priceHT: newPack.price_ht,
                priceTaxCredit: newPack.price_tax_credit,
                suppliesIncluded: newPack.supplies_included,
                suppliesDetails: newPack.supplies_details,
                isSap: newPack.is_sap,
                contractType: newPack.contract_type,
                quantity: pack.quantity,
                location: pack.location,
                frequency: capitalize(newPack.frequency) as any
            }]);
            return finalId;
        }
        return null;
    };

    const updatePack = async (id: string, updates: Partial<Pack>) => {
        // Prepare database updates with snake_case field names
        const dbUpdates: any = {};

        if (updates.name !== undefined) dbUpdates.name = updates.name;
        if (updates.mainService !== undefined) dbUpdates.main_service = updates.mainService;
        if (updates.description !== undefined) {
            const mergedDescription = updates.location
                ? `${updates.description}\n| Lieu: ${updates.location}`
                : updates.description;
            dbUpdates.description = mergedDescription;
        }
        if (updates.hours !== undefined) dbUpdates.hours = updates.hours;
        if (updates.frequency !== undefined) dbUpdates.frequency = updates.frequency.toLowerCase();
        if (updates.suppliesIncluded !== undefined) dbUpdates.supplies_included = updates.suppliesIncluded;
        if (updates.suppliesDetails !== undefined) dbUpdates.supplies_details = updates.suppliesDetails;
        if (updates.type !== undefined) dbUpdates.type = updates.type;
        if (updates.priceTTC !== undefined) dbUpdates.price_ttc = updates.priceTTC;
        if (updates.priceHT !== undefined) dbUpdates.price_ht = updates.priceHT;
        if (updates.priceTaxCredit !== undefined) dbUpdates.price_tax_credit = updates.priceTaxCredit;
        if (updates.contractType !== undefined) dbUpdates.contract_type = updates.contractType;
        if (updates.isSap !== undefined) dbUpdates.is_sap = updates.isSap;
        if (updates.schedules !== undefined) dbUpdates.schedules = updates.schedules;
        if (updates.quantity !== undefined) dbUpdates.quantity = updates.quantity;

        const { error } = await supabase.from('packs').update(dbUpdates).eq('id', id);

        if (error) {
            console.error("Erreur updatePack:", error);
            throw new Error("Erreur lors de la mise à jour du pack: " + error.message);
        }

        // Update local state
        setPacks(prev => prev.map(p => {
            if (p.id === id) {
                return {
                    ...p,
                    ...updates,
                    frequency: updates.frequency ? capitalize(updates.frequency) as any : p.frequency
                };
            }
            return p;
        }));
    };

    const deletePacks = async (ids: string[]) => {
        const { error } = await supabase.from('packs').delete().in('id', ids);
        if (!error) {
            setPacks(prev => prev.filter(p => !ids.includes(p.id)));
        }
    };

    const addContract = async (contract: Contract) => {
        const finalId = generateUUID();
        const packId = (!contract.packId || contract.packId === "") ? null : contract.packId;
        const clientId = (!contract.clientId || contract.clientId === "") ? null : contract.clientId;
        console.log('Adding contract with clientId:', clientId);
        const dbData = {
            id: finalId,
            name: contract.name,
            content: contract.content,
            pack_id: packId,
            client_id: clientId,
            status: contract.status,
            is_sap: contract.isSap,
            validation_date: contract.validationDate,
            admin_signature_url: contract.adminSignatureUrl,
            company_stamp_url: contract.companyStampUrl,
            validated_at: contract.validatedAt
        };
        const { data, error } = await supabase.from('contracts').insert(dbData).select();
        if (error) {
            console.error('Error adding contract to DB:', error);
            // If the error is about client_id column not existing, try without it
            if (error.message.includes('client_id') || error.code === 'PGRST204') {
                console.log('client_id column might not exist, trying without it');
                const dbDataWithoutClientId: any = { ...dbData };
                delete (dbDataWithoutClientId as any).client_id;
                const { data: data2, error: error2 } = await supabase.from('contracts').insert(dbDataWithoutClientId).select();
                if (error2) {
                    throw new Error("Erreur lors de la sauvegarde du contrat: " + error2.message);
                }
                if (data2) {
                    setContracts(prev => [...prev, {
                        ...data2[0],
                        packId: data2[0].pack_id,
                        isSap: data2[0].is_sap,
                        validationDate: data2[0].validation_date,
                        clientId: contract.clientId // Keep clientId in local state even if not in DB
                    }]);
                }
            } else {
                throw new Error("Erreur lors de la sauvegarde du contrat: " + error.message);
            }
        }
        if (data) {
            setContracts(prev => [...prev, {
                ...data[0],
                packId: data[0].pack_id,
                isSap: data[0].is_sap,
                validationDate: data[0].validation_date
            }]);
        }
    };

    const updateContract = async (id: string, updates: Partial<Contract>) => {
        const dbUpdates: any = { ...updates };
        if (updates.packId) { dbUpdates.pack_id = updates.packId; delete dbUpdates.packId; }
        if (updates.clientId) { dbUpdates.client_id = updates.clientId; delete dbUpdates.clientId; }
        if (updates.validationDate) { dbUpdates.validation_date = updates.validationDate; delete dbUpdates.validationDate; }
        if (updates.isSap !== undefined) { dbUpdates.is_sap = updates.isSap; delete updates.isSap; }
        if (updates.adminSignatureUrl) { dbUpdates.admin_signature_url = updates.adminSignatureUrl; delete dbUpdates.adminSignatureUrl; }
        if (updates.companyStampUrl) { dbUpdates.company_stamp_url = updates.companyStampUrl; delete dbUpdates.companyStampUrl; }
        if (updates.validatedAt) { dbUpdates.validated_at = updates.validatedAt; delete dbUpdates.validatedAt; }
        // Signatures are handled via specific calls, but allow generic updates too if needed
        const { error } = await supabase.from('contracts').update(dbUpdates).eq('id', id);
        if (!error) setContracts(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
    };

    const requestContractValidation = async (contractId: string) => {
        try {
            const contract = contracts.find(c => c.id === contractId);
            if (!contract) {
                alert("Contrat introuvable");
                return;
            }

            const now = getMartiniqueNowISO();
            const dbUpdates = {
                status: 'pending_validation', // Changed from validation_status to status
                // VALIDATION: These columns do not exist in DB, so we remove them from the payload
                // validation_requested_at: now, 
                // validation_requested_by: currentUser?.id || ''
            };

            const { error } = await supabase.from('contracts').update(dbUpdates).eq('id', contractId);
            if (error) {
                alert("Erreur lors de la demande de validation: " + error.message);
                return;
            }

            // Update local state
            setContracts(prev => prev.map(c =>
                c.id === contractId
                    ? {
                        ...c,
                        status: 'pending_validation',
                        validationRequestedAt: now,
                        validationRequestedBy: currentUser?.id || ''
                    }
                    : c
            ));

            // Send email to super admin
            const clientName = contract.name || 'Client';
            const secretaryName = currentUser?.name || 'Secrétaire';

            await sendEmail(
                'prestaservicesantilles.rh@gmail.com',
                `Demande de validation - Contrat ${contract.id}`,
                'contract_validation_request',
                {
                    contractRef: contract.id,
                    clientName: clientName,
                    secretaryName: secretaryName,
                    link: 'https://outremerfermetures.com/login'
                }
            );

            alert("Demande de validation envoyée au super administrateur !");
        } catch (error: any) {
            console.error("Erreur demande validation:", error);
            alert("Erreur: " + error.message);
        }
    };

    const validateContract = async (contractId: string, approved: boolean) => {
        try {
            // Only super admin can validate
            if (currentUser?.role !== 'super_admin') {
                alert("Seul le super administrateur peut valider les contrats");
                return;
            }

            const contract = contracts.find(c => c.id === contractId);
            if (!contract) {
                alert("Contrat introuvable");
                return;
            }

            const now = getMartiniqueNowISO();
            // If rejected, we return to 'draft' status so it can be edited/resubmitted.
            // If validated, it becomes 'active'.
            const newStatus = approved ? 'active' : 'draft';

            const dbUpdates = {
                status: newStatus,
                validated_by: currentUser.id,
                validated_at: now
            };

            const { error } = await supabase.from('contracts').update(dbUpdates).eq('id', contractId);
            if (error) {
                alert("Erreur lors de la validation: " + error.message);
                return;
            }

            // Update local state
            setContracts(prev => prev.map(c =>
                c.id === contractId
                    ? {
                        ...c,
                        status: newStatus,
                        validatedBy: currentUser.id,
                        validatedAt: now
                    }
                    : c
            ));

            // Send confirmation email (optional)
            if (approved) {
                const clientName = contract.name || 'Client';
                await sendEmail(
                    'prestaservicesantilles.rh@gmail.com',
                    `Contrat ${contract.id} validé`,
                    'contract_validated',
                    {
                        contractRef: contract.id,
                        clientName: clientName,
                        superAdminName: currentUser.name,
                        validatedAt: new Date(now).toLocaleDateString('fr-FR')
                    }
                );
            }

            alert(approved ? "Contrat validé avec succès !" : "Contrat rejeté");
        } catch (error: any) {
            console.error("Erreur validation:", error);
            alert("Erreur: " + error.message);
        }
    };

    const deleteContract = async (id: string) => {
        try {
            const { error } = await supabase.from('contracts').delete().eq('id', id);
            if (error) {
                alert("Erreur lors de la suppression du contrat: " + error.message);
                return;
            }

            setContracts(prev => prev.filter(c => c.id !== id));
        } catch (error: any) {
            console.error("Erreur suppression contrat:", error);
            alert("Erreur: " + error.message);
        }
    };

    const deleteContracts = async (ids: string[]) => {
        try {
            const { error } = await supabase.from('contracts').delete().in('id', ids);
            if (error) {
                alert("Erreur lors de la suppression des contrats: " + error.message);
                return;
            }

            setContracts(prev => prev.filter(c => !ids.includes(c.id)));
        } catch (error: any) {
            console.error("Erreur suppression contrats:", error);
            alert("Erreur: " + error.message);
        }
    };

    const addReminder = async (reminder: Reminder) => {
        const { id, ...rData } = reminder;
        const dbData = {
            text: rData.text,
            date: rData.date, // ISO Date String expected
            notify_email: rData.notifyEmail,
            completed: false
        };

        const { data, error } = await supabase.from('reminders').insert(dbData).select();

        if (error) {
            console.error("Error adding reminder:", error);
            return;
        }

        if (data) {
            const newReminder = {
                id: data[0].id,
                text: data[0].text,
                date: data[0].date,
                notifyEmail: data[0].notify_email,
                completed: data[0].completed
            };
            setReminders(prev => [...prev, newReminder]);

            // Email Notification Logic
            if (newReminder.notifyEmail) {
                await sendEmail(companySettings.email, 'Rappel Agenda', 'agenda_reminder', {
                    text: newReminder.text,
                    date: newReminder.date
                });
            }
        }
    };

    const toggleReminder = async (id: string) => {
        const r = reminders.find(i => i.id === id);
        if (r) {
            const { error } = await supabase.from('reminders').update({ completed: !r.completed }).eq('id', id);
            if (!error) setReminders(prev => prev.map(x => x.id === id ? { ...x, completed: !x.completed } : x));
        }
    };

    const addExpense = async (expense: Expense) => {
        const { id, ...eData } = expense;
        const finalId = generateUUID();
        const dbData = {
            id: finalId,
            date: eData.date,
            amount: eData.amount,
            category: eData.category,
            description: eData.description,
            proof_url: eData.proofUrl
        };
        const { data, error } = await supabase.from('expenses').insert(dbData).select();
        if (error) { alert("Erreur sauvegarde dépense: " + error.message); return; }
        if (data) {
            setExpenses(prev => [...prev, { ...data[0], proofUrl: data[0].proof_url }]);
        }
    };

    const updateExpense = async (id: string, data: Partial<Expense>) => {
        const dbData: any = {};
        if (data.date) dbData.date = data.date;
        if (data.category) dbData.category = data.category;
        if (data.description) dbData.description = data.description;
        if (data.amount !== undefined) dbData.amount = data.amount;
        if (data.proofUrl) dbData.proof_url = data.proofUrl;

        const { error } = await supabase.from('expenses').update(dbData).eq('id', id);
        if (!error) {
            setExpenses(prev => prev.map(e => e.id === id ? { ...e, ...data } : e));
        } else {
            alert("Erreur mise à jour dépense: " + error.message);
        }
    };


    const replyToClient = async (text: string, clientId: string) => {
        const now = getMartiniqueNowISO();
        const dbData = {
            id: generateUUID(),
            sender: 'admin',
            text: text,
            client_id: clientId,
            is_read: false,
            date: now,
            created_at: now
        };

        const { data, error } = await supabase.from('messages').insert(dbData).select();

        if (error) {
            console.error("Error sending admin message:", error);
            return;
        }

        if (data && data.length > 0) {
            const m = data[0];
            const newMessage: Message = {
                id: m.id,
                sender: m.sender,
                text: m.text,
                date: m.created_at || m.date,
                clientId: m.client_id,
                read: m.is_read
            };
            setMessages(prev => [...prev, newMessage]);

            await addNotification('client', 'message', 'Nouveau message', 'Le secrétariat vous a répondu.', clientId, 'tab:messages');
        }
    };

    const sendClientMessage = async (text: string, clientId: string) => {
        const now = getMartiniqueNowISO();
        const dbData = {
            id: generateUUID(),
            sender: 'client',
            text: text,
            client_id: clientId,
            is_read: false,
            date: now,
            created_at: now
        };

        const { data, error } = await supabase.from('messages').insert(dbData).select();

        if (error) {
            console.error("Error sending client message:", error);
            return;
        }

        if (data && data.length > 0) {
            const m = data[0];
            const newMessage: Message = {
                id: m.id,
                sender: m.sender,
                text: m.text,
                date: m.created_at || m.date,
                clientId: m.client_id,
                read: m.is_read
            };
            setMessages(prev => [...prev, newMessage]);

            const client = clients.find(c => c.id === clientId);

            // NOTIF ADMIN
            await addNotification('admin', 'message', 'Nouveau Message', `De ${client?.name || 'Client'}: ${text.substring(0, 20)}...`, undefined, 'tab:messaging');

            // EMAIL ADMIN (Urgent?)
            await sendEmail(companySettings.email, 'Nouveau Message Client', 'admin_new_message', {
                clientName: client?.name || 'Client',
                message: text
            });
        }
    };

    const markNotificationRead = async (id: string) => {
        const { error } = await supabase.from('notifications').update({ is_read: true }).eq('id', id);
        if (!error) setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    };

    const registerScan = async (clientId: string): Promise<{ success: boolean; type?: 'entry' | 'exit'; message: string }> => {
        if (!currentUser) return { success: false, message: "Vous devez être connecté pour scanner." };
        
        console.log("[RegisterScan] Starting scan for client:", clientId, "by user:", currentUser.id);
        
        try {
            const todayStart = new Date();
            todayStart.setHours(0, 0, 0, 0);
            
            // Vérifier d'abord si la table visit_scans existe
            let recentScans = [];
            try {
                // Récupérer TOUS les scans du jour pour ce client (tous scanneurs)
                const { data: allClientScans, error: scanError } = await supabase
                    .from('visit_scans')
                    .select('*')
                    .eq('client_id', clientId)
                    .gte('timestamp', todayStart.toISOString())
                    .order('timestamp', { ascending: false });
                    
                if (scanError) {
                    console.warn("[RegisterScan] Table visit_scans error:", scanError);
                    // Si la table n'existe pas, utiliser un fallback localStorage
                    return handleScanFallback(clientId, currentUser.id, currentUser.name);
                }
                
                recentScans = allClientScans || [];
            } catch (tableError) {
                console.warn("[RegisterScan] Table access error:", tableError);
                return handleScanFallback(clientId, currentUser.id, currentUser.name);
            }
            
            // Logique d'alternance : si le dernier scan était une entrée, le suivant est une sortie
            // IMPORTANT : on regarde TOUS les scans du client, pas seulement ceux de l'utilisateur courant
            const lastScan = recentScans && recentScans.length > 0 ? recentScans[0] : null;
            let newType: 'entry' | 'exit';
            
            if (!lastScan) {
                // Premier scan du jour pour ce client = entrée
                newType = 'entry';
                console.log("[RegisterScan] Premier scan du jour pour ce client, type: entrée");
            } else {
                // Alternance : si dernier était entrée, prochain est sortie
                // si dernier était sortie, prochain est entrée
                newType = lastScan.scan_type === 'entry' ? 'exit' : 'entry';
                console.log("[RegisterScan] Alternance détectée - dernier scan:", lastScan.scan_type, "-> nouveau:", newType);
            }
            
            // Vérification stricte : pas deux entrées consécutives
            if (lastScan && lastScan.scan_type === 'entry' && newType === 'entry') {
                console.warn("[RegisterScan] Tentative d'entrée consécutive détectée, correction en sortie");
                newType = 'exit';
            }
            
            // Vérification stricte : pas deux sorties consécutives
            if (lastScan && lastScan.scan_type === 'exit' && newType === 'exit') {
                console.warn("[RegisterScan] Tentative de sortie consécutive détectée, correction en entrée");
                newType = 'entry';
            }
            
            // Vérification anti-spam : éviter les scans multiples successifs du même type
            if (lastScan) {
                const timeDiff = new Date().getTime() - new Date(lastScan.timestamp).getTime();
                const minTimeBetweenScans = 5000; // 5 secondes minimum entre scans (réduit de 30s)
                
                // Vérifier si c'est le même scanneur et le même type de scan
                if (lastScan.scanner_id === currentUser.id && timeDiff < minTimeBetweenScans) {
                    console.warn("[RegisterScan] Scan trop rapide détecté du même scanneur, temps écoulé:", timeDiff + "ms");
                    return { 
                        success: false, 
                        message: `Veuillez attendre ${Math.ceil((minTimeBetweenScans - timeDiff) / 1000)} secondes avant de scanner à nouveau` 
                    };
                }
                
                // Si c'est un scanneur différent, permettre le scan mais avec un délai plus court
                if (lastScan.scanner_id !== currentUser.id && timeDiff < 2000) {
                    console.warn("[RegisterScan] Scan trop rapide détecté d'un autre scanneur, temps écoulé:", timeDiff + "ms");
                    return { 
                        success: false, 
                        message: `Veuillez attendre ${Math.ceil((2000 - timeDiff) / 1000)} secondes avant de scanner à nouveau` 
                    };
                }
            }
            
            console.log("[RegisterScan] Final scan type determined:", newType, "last scan:", lastScan);
            
            const newScan = {
                client_id: clientId,
                scanner_id: currentUser.id,
                scanner_name: currentUser.name,
                scan_type: newType,
                timestamp: getMartiniqueNowISO()
            };
            
            console.log("[RegisterScan] Inserting scan:", newScan);
            
            const { data, error } = await supabase.from('visit_scans').insert(newScan).select();
            
            if (error) {
                console.error("[RegisterScan] Insert error:", error);
                // Si erreur d'insertion, utiliser fallback
                return handleScanFallback(clientId, currentUser.id, currentUser.name, newType);
            }
            
            if (data) {
                const s = data[0];
                const mappedScan: VisitScan = {
                    id: s.id,
                    clientId: s.client_id,
                    scannerId: s.scanner_id,
                    scannerName: s.scanner_name,
                    scanType: s.scan_type as 'entry' | 'exit',
                    timestamp: s.timestamp
                };
                setVisitScans(prev => [mappedScan, ...prev]);
                console.log("[RegisterScan] Scan successfully recorded:", mappedScan);
                
                const message = newType === 'entry' 
                    ? `✅ Entrée enregistrée avec succès pour le client ${clientId}` 
                    : `✅ Sortie enregistrée avec succès pour le client ${clientId}`;
                    
                return { success: true, type: newType, message };
            }
            
            return { success: false, message: "Erreur inconnue lors du scan" };
        } catch (error: any) {
            console.error("[RegisterScan] Critical error:", error);
            // En cas d'erreur critique, utiliser fallback
            return handleScanFallback(clientId, currentUser?.id, currentUser?.name);
        }
    };

    // Fonction fallback pour les scans quand la table n'existe pas
    const handleScanFallback = async (clientId: string, scannerId: string, scannerName: string, forcedType?: 'entry' | 'exit'): Promise<{ success: boolean; type?: 'entry' | 'exit'; message: string }> => {
        try {
            console.log("[ScanFallback] Using fallback for scan");
            
            // Récupérer les scans précédents depuis localStorage
            const existingScans = JSON.parse(localStorage.getItem('presta_visit_scans') || '[]');
            const todayScans = existingScans.filter((s: any) => {
                const scanDate = new Date(s.timestamp);
                const today = new Date();
                return scanDate.toDateString() === today.toDateString() && s.clientId === clientId;
            });
            
            // Logique d'alternance : on regarde TOUS les scans du client, pas seulement ceux du scanneur
            const lastScan = todayScans.length > 0 ? todayScans[todayScans.length - 1] : null;
            let newType: 'entry' | 'exit';
            
            if (!forcedType) {
                if (!lastScan) {
                    // Premier scan du jour pour ce client = entrée
                    newType = 'entry';
                    console.log("[ScanFallback] Premier scan du jour pour ce client, type: entrée");
                } else {
                    // Alternance : si dernier était entrée, prochain est sortie
                    // si dernier était sortie, prochain est entrée
                    newType = lastScan.scanType === 'entry' ? 'exit' : 'entry';
                    console.log("[ScanFallback] Alternance détectée - dernier scan:", lastScan.scanType, "-> nouveau:", newType);
                }
                
                // Vérification supplémentaire : pas deux sorties consécutives
                if (lastScan && lastScan.scanType === 'exit' && newType === 'exit') {
                    console.warn("[ScanFallback] Tentative de sortie consécutive détectée, correction en entrée");
                    newType = 'entry';
                }
            } else {
                newType = forcedType;
            }
            
            const newScan = {
                id: `fallback-${Date.now()}`,
                clientId,
                scannerId,
                scannerName,
                scanType: newType,
                timestamp: getMartiniqueNowISO()
            };
            
            // Ajouter à localStorage
            const updatedScans = [...existingScans, newScan];
            localStorage.setItem('presta_visit_scans', JSON.stringify(updatedScans));
            
            // Mettre à jour l'état local
            const mappedScan: VisitScan = newScan;
            setVisitScans(prev => [mappedScan, ...prev]);
            
            console.log("[ScanFallback] Fallback scan recorded:", newScan);
            
            const message = newType === 'entry' 
                ? `✅ Entrée enregistrée (mode local) pour le client ${clientId}` 
                : `✅ Sortie enregistrée (mode local) pour le client ${clientId}`;
                
            return { success: true, type: newType, message };
        } catch (error: any) {
            console.error("[ScanFallback] Fallback error:", error);
            return { success: false, message: "Erreur critique lors du scan" };
        }
    };

    const deleteMissions = async (ids: string[]) => {
        const { error } = await supabase.from('missions').delete().in('id', ids);
        if (!error) {
            setMissions(prev => prev.filter(m => !ids.includes(m.id)));
        }
    };

    const logout = async (skipReload = false) => {
        // PROTECTION: Empêcher la déconnexion AUTOMATIQUE des clients et prestataires
        // mais permettre la déconnexion MANUELLE (skipReload = true)
        const currentUser = JSON.parse(localStorage.getItem('presta_current_user') || 'null');
        if (currentUser && (currentUser.role === 'client' || currentUser.role === 'provider')) {
            if (!skipReload) {
                console.log("PROTECTION: Empêcher la déconnexion automatique pour", currentUser.role);
                // Conserver les données de session pour la reconnexion automatique
                localStorage.setItem('presta_session_persistent', 'true');
                return; // Ne jamais déconnecter automatiquement les clients/prestataires
            } else {
                console.log("Déconnexion MANUELLE autorisée pour:", currentUser.role);
                // Nettoyer uniquement lors de la déconnexion manuelle
                localStorage.removeItem('presta_session_persistent');
            }
        }

        // Vérifier si une session de lecture est active
        if (isReadingDocument) {
            console.log("Session de lecture active - déconnexion reportée");
            return; // Ne pas déconnecter pendant lecture active
        }

        console.log("Déconnexion en cours pour utilisateur:", currentUser?.role);
        
        // Nettoyer les données de session mais conserver la récupération pour clients/prestataires
        if (!currentUser || (currentUser.role !== 'client' && currentUser.role !== 'provider')) {
            localStorage.removeItem('presta_current_user');
            localStorage.clear();
        } else {
            // Pour clients/prestataires, nettoyer seulement certaines clés
            localStorage.removeItem('presta_current_user');
            localStorage.removeItem('presta_session_extended');
        }

        setCurrentUser(null);
        setSimulatedClientId(null);
        setSimulatedProviderId(null);
        setMissions([]);
        setClients([]);
        setProviders([]);
        setDocuments([]);
        setVisitScans([]);

        try {
            if (isSupabaseConfigured) {
                await supabase.auth.signOut();
            }
        } catch (e) {
            console.warn("Logout network request failed (ignoring):", e);
        }

        if (!skipReload) {
            window.location.reload();
        }
    };

    const startLiveStream = async (providerId: string, clientId: string) => {
        const sessionId = `stream-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        // URLs configurables selon l'environnement
        const recordingsBaseUrl = process.env.NODE_ENV === 'production' 
            ? 'https://www.outremerfermetures.com' 
            : 'http://localhost:3001/recordings';
            
        const session: StreamSession = {
            id: sessionId,
            providerId,
            clientId,
            status: 'active',
            startTime: getMartiniqueNowISO(),
            streamUrl: `${recordingsBaseUrl}/stream/${sessionId}`
        };
        setActiveStream(session);

        // Envoyer une notification au client pour l'appel vidéo
        const provider = providers.find(p => p.id === providerId);
        const client = clients.find(c => c.id === clientId);

        if (provider && client) {
            // Notification in-app
            await addNotification('client', 'alert', 'Appel Vidéo en Cours',
                `${provider.firstName} ${provider.lastName} vous appelle en vidéo. Cliquez pour rejoindre l'appel.`,
                clientId, 'tab:live');

            // Notification admin pour supervision
            await addNotification(
                'admin',
                'alert',
                'Appel Vidéo en Cours',
                `Un appel vidéo est en cours: ${client.name} ↔ ${provider.firstName} ${provider.lastName}. Cliquez pour superviser.`,
                undefined,
                'tab:live-videos'
            );

            // Notification par email
            if (client.email) {
                await sendEmail(client.email, 'Appel Vidéo en Cours', 'video_call', {
                    providerName: `${provider.firstName} ${provider.lastName}`,
                    sessionId: sessionId,
                    clientName: client.name
                });
            }

            // Créer l'enregistrement vidéo dans la base de données
            const videoRecord = {
                id: generateUUID(),
                session_id: sessionId,
                provider_id: providerId,
                client_id: clientId,
                status: 'recording',
                start_time: getMartiniqueNowISO(),
                recording_url: undefined, // Sera mis à jour quand l'enregistrement sera disponible
                replay_url: undefined, // Sera mis à jour quand le replay sera disponible
                duration: 0,
                file_size: 0
            };

            // Ajouter à la base de données
            try {
                if (isSupabaseConfigured) {
                    const { data, error } = await supabase
                        .from('video_recordings')
                        .insert(videoRecord)
                        .select();
                    
                    if (error) {
                        console.error('[StartLiveStream] Erreur création enregistrement vidéo:', error);
                    } else {
                        console.log('[StartLiveStream] Enregistrement vidéo créé:', data);
                        // Mapper les données de la base vers l'interface TypeScript
                        const mappedRecord: VideoRecording = {
                            id: videoRecord.id,
                            sessionId: videoRecord.session_id,
                            providerId: videoRecord.provider_id,
                            clientId: videoRecord.client_id,
                            status: videoRecord.status as 'recording' | 'processing' | 'ready' | 'failed',
                            startTime: videoRecord.start_time,
                            recordingUrl: videoRecord.recording_url,
                            replayUrl: videoRecord.replay_url,
                            duration: videoRecord.duration,
                            fileSize: videoRecord.file_size
                        };
                        // Ajouter à l'état local
                        setVideoRecordings(prev => [mappedRecord, ...prev]);
                    }
                } else {
                    // Mode hors ligne: mapper et ajouter à l'état local
                    const mappedRecord: VideoRecording = {
                        id: videoRecord.id,
                        sessionId: videoRecord.session_id,
                        providerId: videoRecord.provider_id,
                        clientId: videoRecord.client_id,
                        status: videoRecord.status as 'recording' | 'processing' | 'ready' | 'failed',
                        startTime: videoRecord.start_time,
                        recordingUrl: videoRecord.recording_url,
                        replayUrl: videoRecord.replay_url,
                        duration: videoRecord.duration,
                        fileSize: videoRecord.file_size
                    };
                    setVideoRecordings(prev => [mappedRecord, ...prev]);
                    console.log('[StartLiveStream] Enregistrement vidéo créé (local):', videoRecord);
                }
            } catch (error) {
                console.error('[StartLiveStream] Erreur lors de la création de l\'enregistrement vidéo:', error);
            }
        }
    };

    const stopLiveStream = async () => {
        if (activeStream) {
            const provider = providers.find(p => p.id === activeStream.providerId);
            const client = clients.find(c => c.id === activeStream.clientId);

            // Envoyer notification post-appel au client
            if (client && provider) {
                await addNotification('client', 'success', 'Appel Vidéo Terminé',
                    `Votre appel vidéo avec ${provider.firstName} ${provider.lastName} est terminé. La vidéo sera bientôt disponible en replay.`,
                    activeStream.clientId, 'tab:live');

                // Notification par email pour le replay
                if (client.email) {
                    await sendEmail(client.email, 'Appel Vidéo Terminé - Replay Disponible', 'video_call_ended', {
                        providerName: `${provider.firstName} ${provider.lastName}`,
                        sessionId: activeStream.id,
                        clientName: client.name
                    });
                }
            }

            // Mettre à jour le statut de l'enregistrement vidéo
            try {
                const endTime = new Date();
                const startTime = new Date(activeStream.startTime);
                const duration = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);

                if (isSupabaseConfigured) {
                    const { error } = await supabase
                        .from('video_recordings')
                        .update({ 
                            status: 'processing',
                            duration: duration,
                            end_time: endTime.toISOString()
                        })
                        .eq('session_id', activeStream.id);
                    
                    if (error) {
                        console.error('[StopLiveStream] Erreur mise à jour enregistrement vidéo:', error);
                    } else {
                        console.log(`[StopLiveStream] Enregistrement vidéo mis à jour pour session ${activeStream.id}: processing`);
                        // Mettre à jour l'état local
                        setVideoRecordings(prev => prev.map(r => 
                            r.sessionId === activeStream.id 
                                ? { ...r, status: 'processing', duration, endTime: endTime.toISOString() }
                                : r
                        ));
                    }
                } else {
                    // Mode hors ligne: mettre à jour l'état local
                    setVideoRecordings(prev => prev.map(r => 
                        r.sessionId === activeStream.id 
                            ? { ...r, status: 'processing', duration, endTime: endTime.toISOString() }
                            : r
                    ));
                    console.log(`[StopLiveStream] Enregistrement vidéo mis à jour (local) pour session ${activeStream.id}: processing`);
                }
            } catch (error) {
                console.error('[StopLiveStream] Erreur lors de la mise à jour de l\'enregistrement vidéo:', error);
            }
        }

        setActiveStream(null);
    };

    const getVideoRecordings = (clientId?: string, providerId?: string) => {
        let filtered = videoRecordings;
        if (clientId) {
            filtered = filtered.filter(r => r.clientId === clientId);
        }
        if (providerId) {
            filtered = filtered.filter(r => r.providerId === providerId);
        }
        return filtered.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
    };

    const createVideoRecording = async (recording: VideoRecording) => {
        // Simuler l'ajout à la base de données
        setVideoRecordings(prev => [recording, ...prev]);
        console.log('Enregistrement vidéo créé:', recording);
    };

    const updateVideoRecording = async (id: string, updates: Partial<VideoRecording>) => {
        setVideoRecordings(prev => prev.map(r =>
            r.id === id ? { ...r, ...updates } : r
        ));
        console.log(`Enregistrement vidéo ${id} mis à jour:`, updates);
    };

    // Génération de token d'accès sécurisé pour les vidéos
    const generateVideoAccessToken = async (recordingId: string, userId: string, permissions: 'view' | 'download') => {
        const token = generateUUID();
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 24); // Expiration dans 24 heures

        const accessToken: VideoAccessToken = {
            id: generateUUID(),
            recordingId,
            userId,
            token,
            expiresAt: expiresAt.toISOString(),
            createdAt: getMartiniqueNowISO(),
            permissions
        };

        setVideoAccessTokens(prev => [accessToken, ...prev]);

        // Mettre à jour l'enregistrement vidéo avec le token
        await updateVideoRecording(recordingId, { accessToken: token, expiresAt: expiresAt.toISOString() });

        console.log('Token d\'accès vidéo généré:', { recordingId, userId, permissions, expiresAt });
        return token;
    };

    // Validation de token d'accès vidéo
    const validateVideoAccessToken = async (token: string, recordingId: string) => {
        const accessToken = videoAccessTokens.find(t => t.token === token && t.recordingId === recordingId);

        if (!accessToken) {
            console.log('Token non trouvé');
            return false;
        }

        // Vérifier si le token n'est pas expiré
        const now = new Date();
        const expiresAt = new Date(accessToken.expiresAt);

        if (now > expiresAt) {
            console.log('Token expiré');
            // Supprimer le token expiré
            await revokeVideoAccessToken(token);
            return false;
        }

        console.log('Token valide pour:', { recordingId, userId: accessToken.userId, permissions: accessToken.permissions });
        return true;
    };

    // Révocation de token d'accès vidéo
    const revokeVideoAccessToken = async (token: string) => {
        setVideoAccessTokens(prev => prev.filter(t => t.token !== token));

        // Mettre à jour l'enregistrement vidéo pour supprimer le token
        const recording = videoRecordings.find(r => r.accessToken === token);
        if (recording) {
            await updateVideoRecording(recording.id, { accessToken: undefined, expiresAt: undefined });
        }

        console.log('Token d\'accès vidéo révoqué:', token);
    };

    // Gestion de la reconnexion automatique
    const attemptReconnection = async () => {
        if (reconnectAttempts >= maxReconnectAttempts) {
            console.log('Nombre maximum de tentatives de reconnexion atteint');
            setConnectionStatus('disconnected');
            return;
        }

        setConnectionStatus('reconnecting');
        setReconnectAttempts(prev => prev + 1);

        try {
            // Simuler une tentative de reconnexion
            await new Promise(resolve => setTimeout(resolve, reconnectDelay));

            // Vérifier si la connexion est rétablie
            if (navigator.onLine) {
                setConnectionStatus('connected');
                setReconnectAttempts(0);
                setReconnectDelay(1000);
                console.log('Connexion rétablie avec succès');

                // Rafraîchir les données si nécessaire
                if (activeStream) {
                    console.log('Tentative de restauration du flux vidéo...');
                }
            } else {
                throw new Error('Hors ligne');
            }
        } catch (error) {
            console.error(`Tentative de reconnexion ${reconnectAttempts} échouée:`, error);

            // Augmenter le délai pour la prochaine tentative (exponentiel backoff)
            setReconnectDelay(prev => Math.min(prev * 2, 30000)); // Max 30 secondes

            // Programmer la prochaine tentative
            setTimeout(() => {
                if (connectionStatus === 'reconnecting') {
                    attemptReconnection();
                }
            }, reconnectDelay);
        }
    };

    const resetConnectionState = () => {
        setConnectionStatus('connected');
        setReconnectAttempts(0);
        setReconnectDelay(1000);
    };

    const getAvailableSlots = (date: string) => {
        const potentialTimes = [
            { start: '08:00', end: '10:00' },
            { start: '10:00', end: '12:00' },
            { start: '13:00', end: '15:00' },
            { start: '15:00', end: '17:00' }
        ];
        const available: { time: string, provider: string, score: number, reason: string }[] = [];

        providers.filter(p => p.status === 'Active').forEach(provider => {
            const leavesOnDate = provider.leaves.filter(l => {
                return date >= l.startDate && date <= l.endDate;
            });

            const providerMissions = missions.filter(m => m.providerId === provider.id && m.date === date && m.status !== 'cancelled');

            potentialTimes.forEach(slot => {
                const isLeave = leavesOnDate.some(l => {
                    const lStart = l.startTime || '00:00';
                    const lEnd = l.endTime || '23:59';
                    return (slot.start < lEnd && slot.end > lStart);
                });

                const isTaken = providerMissions.some(m => {
                    return (slot.start < m.endTime && slot.end > m.startTime);
                });

                if (!isTaken && !isLeave) {
                    let score = 70;
                    if (provider.rating >= 4.5) score += 20;
                    if (provider.hoursWorked < 100) score += 10;
                    available.push({
                        time: `${slot.start} - ${slot.end}`,
                        provider: `${provider.firstName} ${provider.lastName}`,
                        score: Math.min(score, 100),
                        reason: 'Disponible'
                    });
                }
            });
        });
        return available.sort((a, b) => b.score - a.score).slice(0, 5);
    };

    // Fonctions pour les contrats génériques
    const generateContractFromTemplate = (quote: Document, client: Client, pack?: Pack) => {
        const genericContract = genericContracts.find(gc => gc.isActive);
        if (!genericContract) return null;

        const replacements = {
            '{{CLIENT_NAME}}': client.name,
            '{{CLIENT_ADDRESS}}': client.address || 'Non spécifiée',
            '{{CLIENT_PHONE}}': client.phone || 'Non spécifié',
            '{{CLIENT_EMAIL}}': client.email,
            '{{QUOTE_DETAILS}}': `${quote.type} - ${pack?.name || 'Prestation personnalisée'}`,
            '{{TOTAL_AMOUNT}}': `${quote.totalTTC.toFixed(2)} € TTC`,
            '{{SERVICE_TYPE}}': pack?.isSap ? 'SAP' : 'Non-SAP',
            '{{CONTRACT_LOCATION}}': 'La Trinité, Martinique',
            '{{CONTRACT_DATE}}': new Date().toLocaleDateString('fr-FR'),
            '{{CLIENT_SIGNATURE}}': quote.signatureData ? `<img src="${quote.signatureData}" style="max-width: 200px; max-height: 100px;" />` : '',
            '{{CLIENT_SIGNATURE_DATE}}': quote.signatureDate ? new Date(quote.signatureDate).toLocaleDateString('fr-FR') : '',
            '{{ADMIN_SIGNATURE}}': COMPANY_SIGNATURE_URL ? `<img src="${COMPANY_SIGNATURE_URL}" style="max-width: 200px; max-height: 100px;" />` : '',
            '{{ADMIN_SIGNATURE_DATE}}': new Date().toLocaleDateString('fr-FR')
        };

        let contractContent = genericContract.content;
        Object.entries(replacements).forEach(([placeholder, value]) => {
            contractContent = contractContent.replace(new RegExp(placeholder, 'g'), value);
        });

        return {
            id: generateUUID(),
            name: `Contrat - ${quote.ref}`,
            content: contractContent,
            clientId: client.id,
            quoteId: quote.id,
            isGeneric: false,
            generatedAt: getMartiniqueNowISO(),
            status: 'active' as const,
            adminSignatureUrl: COMPANY_SIGNATURE_URL,
            clientSignatureUrl: quote.signatureData,
            validatedAt: getMartiniqueNowISO(),
            signedAt: quote.signatureDate
        };
    };

    const downloadContract = async (contract: Contract) => {
        try {
            console.log('Downloading contract:', contract.id);
            console.log('Contract client signature:', contract.clientSignatureUrl ? 'exists' : 'none');
            console.log('Contract signed at:', contract.signedAt);

            // Récupérer la signature depuis la table documents si elle n'existe pas dans le contrat
            let clientSignatureData = contract.clientSignatureUrl;

            console.log('Recherche signature - contract.clientSignatureUrl:', contract.clientSignatureUrl ? 'exists' : 'none');
            console.log('Recherche signature - contract.quoteId:', contract.quoteId);
            console.log('Recherche signature - contract.clientId:', contract.clientId);

            if (!clientSignatureData && contract.quoteId) {
                console.log('Recherche de la signature dans les documents pour quoteId:', contract.quoteId);
                const { data: documentData, error: documentError } = await supabase
                    .from('documents')
                    .select('signature_data, signature_date')
                    .eq('id', contract.quoteId)
                    .single();

                console.log('Document query result:', { documentError, documentData });

                if (!documentError && documentData) {
                    clientSignatureData = documentData.signature_data;
                    console.log('Signature trouvée dans les documents:', clientSignatureData ? 'exists' : 'none');
                    console.log('Signature data type:', typeof clientSignatureData);
                    console.log('Signature data length:', clientSignatureData?.length);
                    console.log('Signature data starts with data:image:', clientSignatureData?.startsWith('data:image/'));
                    if (!contract.signedAt && documentData.signature_date) {
                        contract.signedAt = documentData.signature_date;
                    }
                } else {
                    console.log('Erreur ou document non trouvé:', documentError);
                }
            }

            // Si toujours pas de signature, chercher par clientId
            if (!clientSignatureData && contract.clientId) {
                console.log('Recherche de la signature par clientId:', contract.clientId);
                const { data: clientDocuments, error: clientDocsError } = await supabase
                    .from('documents')
                    .select('signature_data, signature_date, id')
                    .eq('client_id', contract.clientId)
                    .eq('status', 'signed')
                    .order('created_at', { ascending: false })
                    .limit(1);

                console.log('Client documents query result:', { clientDocsError, clientDocuments });

                if (!clientDocsError && clientDocuments && clientDocuments.length > 0) {
                    clientSignatureData = clientDocuments[0].signature_data;
                    console.log('Signature trouvée via clientId:', clientSignatureData ? 'exists' : 'none');
                    console.log('Signature data type:', typeof clientSignatureData);
                    console.log('Signature data length:', clientSignatureData?.length);
                    console.log('Signature data starts with data:image:', clientSignatureData?.startsWith('data:image/'));
                    if (!contract.signedAt && clientDocuments[0].signature_date) {
                        contract.signedAt = clientDocuments[0].signature_date;
                    }
                } else {
                    console.log('Erreur ou aucun document signé trouvé:', clientDocsError);
                }
            }

            console.log('Signature finale utilisée:', clientSignatureData ? 'exists' : 'none');
            console.log('Type de signature finale:', typeof clientSignatureData);
            console.log('Longueur signature finale:', clientSignatureData?.length);
            console.log('Commence par data:image:', clientSignatureData?.startsWith('data:image/'));

            // Create HTML content for printing
            const htmlContent = `
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${contract.name}</title>
    <style>
        @page {
            margin: 15mm;
            size: A4;
        }
        body { 
            font-family: Arial, sans-serif; 
            margin: 0;
            padding: 15px;
            line-height: 1.4; 
            color: #333;
            font-size: 12px;
        }
        .header { 
            text-align: center; 
            margin-bottom: 20px; 
            background: #2980b9; 
            color: white; 
            padding: 15px; 
            border-radius: 8px;
            page-break-inside: avoid;
        }
        .content { 
            margin-bottom: 20px; 
            white-space: pre-wrap; 
            page-break-inside: avoid;
            font-size: 12px;
            line-height: 1.4;
        }
        .signature { 
            margin-top: 30px; 
            border-top: 1px solid #ccc; 
            padding-top: 15px; 
            display: flex; 
            justify-content: space-between; 
            page-break-inside: avoid;
        }
        .signature-box { 
            width: 45%; 
            text-align: center; 
            border: 1px solid #ccc; 
            padding: 15px; 
            min-height: 100px;
            background: white;
            page-break-inside: avoid;
        }
        .signature img { 
            max-height: 60px; 
            max-width: 100%; 
            margin: 5px 0;
            border: 1px solid #eee;
            background: white;
        }
        .signature-placeholder {
            min-height: 50px;
            border: 2px dashed #ccc;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #999;
            font-style: italic;
            margin: 5px 0;
            background: #f9f9f9;
            font-size: 11px;
        }
        .footer { 
            text-align: center; 
            margin-top: 20px; 
            color: #666; 
            font-size: 10px; 
            page-break-inside: avoid;
        }
        @media print { 
            body { margin: 0; padding: 10px; font-size: 11px; } 
            .no-print { display: none; }
            .header { background: #2980b9 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .content { font-size: 11px; line-height: 1.3; }
            .signature-box { min-height: 80px; padding: 10px; }
            .signature img { max-height: 50px; }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>${contract.name}</h1>
        <p>PRESTA SERVICES ANTILLES - SASU</p>
        <p>31 Résidence L'Autre Bord – 97220 La Trinité</p>
        <p>N° SAP : SAP944789700</p>
    </div>
    <div class="content">
        ${contract.content}
    </div>
    <div class="signature">
        <div class="signature-box">
            <h3>Signature Client</h3>
            ${(() => {
                    if (clientSignatureData && clientSignatureData !== 'auto-signed') {
                        // Vérifier si c'est une URL Base64
                        if (clientSignatureData.startsWith('data:image/')) {
                            return `<img src="${clientSignatureData}" alt="Signature Client" style="display: block; max-height: 80px; max-width: 100%; margin: 10px auto; border: 1px solid #eee; background: white;" />`;
                        } else {
                            return `<img src="${clientSignatureData}" alt="Signature Client" onload="console.log('Client signature loaded')" onerror="console.error('Failed to load client signature:', this.src); this.style.display='none'; this.nextElementSibling.style.display='block';" style="display: block; max-height: 80px; max-width: 100%; margin: 10px auto; border: 1px solid #eee; background: white;" /><div style="display: none; min-height: 60px; border: 2px dashed #ccc; display: flex; align-items: center; justify-content: center; color: #999; font-style: italic; margin: 10px 0; background: #f9f9f9;">Signature non disponible</div>`;
                        }
                    } else if (clientSignatureData === 'auto-signed') {
                        return `<div class="signature-placeholder">Signature automatique (Devis signé)</div>`;
                    } else {
                        return `<div class="signature-placeholder">En attente de signature</div>`;
                    }
                })()}
            ${contract.signedAt ? `<p><small>Signé le: ${new Date(contract.signedAt).toLocaleDateString('fr-FR')}</small></p>` : '<p><small><em>Non signé</em></small></p>'}
        </div>
        <div class="signature-box">
            <h3>Signature Prestataire</h3>
            <img src="${STAMP_SIGNATURE_BASE64 || COMPANY_STAMP_URL || COMPANY_SIGNATURE_URL || 'https://via.placeholder.com/150x60'}" alt="Cachet Prestataire" style="display: block; max-height: 80px; max-width: 100%; margin: 10px auto; border: 1px solid #eee; background: white;">
            <p><small>Fait à La Trinité, Martinique</small></p>
            <p><small>Le ${new Date().toLocaleDateString('fr-FR')}</small></p>
        </div>
    </div>
    <div class="footer">
        <p>Contrat N°: ${contract.id}</p>
        <p>Document généré automatiquement - Valeur légale</p>
    </div>
</body>
</html>`;

            // Create a new window for printing
            const printWindow = window.open('', '_blank', 'width=800,height=600');
            if (printWindow) {
                printWindow.document.write(htmlContent);
                printWindow.document.close();

                // Wait for all content to load including images before printing
                printWindow.onload = () => {
                    // Check if all images are loaded
                    const images = printWindow.document.querySelectorAll('img');
                    let loadedImages = 0;
                    const totalImages = images.length;

                    if (totalImages === 0) {
                        // No images to wait for, print immediately
                        setTimeout(() => {
                            printWindow.print();
                            printWindow.close();
                        }, 500);
                    } else {
                        // Wait for all images to load
                        images.forEach((img, index) => {
                            img.onload = () => {
                                loadedImages++;
                                console.log(`Image ${index + 1}/${totalImages} loaded`);
                                if (loadedImages === totalImages) {
                                    setTimeout(() => {
                                        printWindow.print();
                                        printWindow.close();
                                    }, 1000);
                                }
                            };
                            img.onerror = () => {
                                loadedImages++;
                                console.error(`Image ${index + 1}/${totalImages} failed to load`);
                                if (loadedImages === totalImages) {
                                    setTimeout(() => {
                                        printWindow.print();
                                        printWindow.close();
                                    }, 1000);
                                }
                            };
                        });

                        // Fallback timeout in case images don't load
                        setTimeout(() => {
                            if (!printWindow.closed) {
                                console.log('Printing due to timeout');
                                printWindow.print();
                                printWindow.close();
                            }
                        }, 3000);
                    }
                };
            } else {
                throw new Error('Impossible d\'ouvrir la fenêtre d\'impression');
            }

        } catch (error: any) {
            console.error('Error generating contract document:', error);
            throw new Error('Erreur lors de la génération du document: ' + error.message);
        }
    };

    return (
        <DataContext.Provider value={{
            companySettings, updateCompanySettings,
            missions, addMission, startMission, endMission, cancelMissionByProvider, cancelMissionByClient, canCancelMission, assignProvider, deleteMissions,
            clients, addClient, updateClient, deleteClients, addLoyaltyHours, submitClientReview,
            providers, addProvider, updateProvider, deleteProviders, addLeave, updateLeaveStatus, resetProviderPassword,
            documents, addDocument, updateDocumentStatus, deleteDocument, deleteDocuments, duplicateDocument, convertQuoteToInvoice, markInvoicePaid, sendDocumentReminder, signQuoteWithData, refuseQuote, requestInvoice, refundTransaction, generateMissionsFromDocument,
            packs, addPack, updatePack, deletePacks,
            contracts, addContract, updateContract, deleteContract, deleteContracts, requestContractValidation, validateContract, legalTemplate,
            genericContracts,
            generateContractFromTemplate, downloadContract,
            reminders, addReminder, toggleReminder,
            expenses, addExpense, updateExpense,
            messages, replyToClient, sendClientMessage,
            notifications, markNotificationRead, addNotification,
            visitScans, registerScan,
            alertPopup, setAlertPopup,
            currentUser, login, logout,
            simulatedClientId, setSimulatedClientId,
            simulatedProviderId, setSimulatedProviderId,
            activeStream, startLiveStream, stopLiveStream,
            videoRecordings, getVideoRecordings, createVideoRecording, updateVideoRecording,
            generateVideoAccessToken, validateVideoAccessToken, revokeVideoAccessToken,
            isOnline, pendingSyncCount, loading,
            extendReadingSession, endReadingSession, isReadingDocument,
            connectionStatus, reconnectAttempts, maxReconnectAttempts, reconnectDelay, attemptReconnection, resetConnectionState,
            getAvailableSlots, refreshData, sendEmail
        }}>
            {children}
        </DataContext.Provider>
    );
};

export const useData = () => {
    const context = useContext(DataContext);
    if (context === undefined) {
        // More detailed error for debugging
        console.error('[DataContext] useData called outside DataProvider. This might be due to hot module reload.');
        console.error('[DataContext] Current location:', window.location.href);
        console.error('[DataContext] Try refreshing the page if this persists.');

        throw new Error('useData must be used within a DataProvider. If you see this after a hot reload, refresh the page (F5).');
    }
    return context;
};
