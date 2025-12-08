
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
    Provider, Mission, Pack, Contract, Reminder, Document, Client,
    AppNotification, Message, User, StreamSession, Expense, CompanySettings,
    CreateMissionDTO, CreateClientDTO, CreateProviderDTO, Leave, VisitScan
} from '../types';
import { supabase, isSupabaseConfigured } from '../utils/supabaseClient';
import { sendEmailViaEmailJS } from '../utils/emailService';

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

    packs: Pack[];
    addPack: (pack: Pack) => Promise<string | null>; // Returns ID if success
    deletePacks: (ids: string[]) => Promise<void>;

    contracts: Contract[];
    addContract: (contract: Contract) => Promise<void>;
    updateContract: (id: string, updates: Partial<Contract>) => Promise<void>;
    requestContractValidation: (contractId: string) => Promise<void>;
    validateContract: (contractId: string, approved: boolean) => Promise<void>;
    legalTemplate: string;

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

    visitScans: VisitScan[];
    registerScan: (clientId: string) => Promise<{ success: boolean; type?: 'entry' | 'exit'; message: string }>;

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

    isOnline: boolean;
    pendingSyncCount: number;
    loading: boolean;

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
        phone: '0590 12 34 56',
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
    const [reminders, setReminders] = useState<Reminder[]>([]);
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [messages, setMessages] = useState<Message[]>([]);
    const [notifications, setNotifications] = useState<AppNotification[]>([]);
    const [visitScans, setVisitScans] = useState<VisitScan[]>([]);

    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [simulatedClientId, setSimulatedClientId] = useState<string | null>(null);
    const [simulatedProviderId, setSimulatedProviderId] = useState<string | null>(null);
    const [activeStream, setActiveStream] = useState<StreamSession | null>(null);

    const [isOnline, setIsOnline] = useState(true);
    const [loading, setLoading] = useState(true);
    const [pendingSyncCount, setPendingSyncCount] = useState(0);

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

    // --- DATA FETCHING ---
    const refreshData = async () => {
        try {
            if (!isSupabaseConfigured) {
                // If not configured, we don't fetch but we MUST ensure loading stops
                return;
            }

            // Perform fetches in parallel but wrapped to not fail completely if one table is missing
            const fetchTable = async (table: string, query: any = '*') => {
                const { data, error } = await supabase.from(table).select(query);
                if (error) {
                    console.warn(`Failed to fetch ${table}:`, error.message);
                    return null;
                }
                return data;
            };

            const [
                cData, pData, mData, dData, packData, ctData,
                rData, eData, msgData, notifData, settingsData, vsData, leavesData
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
                supabase.from('company_settings').select('*').maybeSingle().then(r => r.data),
                fetchTable('visit_scans'),
                fetchTable('leaves')
            ]);

            if (cData) {
                setClients(cData.map((c: any) => ({
                    ...c,
                    packsConsumed: c.packs_consumed || 0,
                    loyaltyHoursAvailable: c.loyalty_hours_available || 0,
                    hasLeftReview: c.has_left_review,
                })));
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
                    const quantityMatch = desc.match(/Quantité: (.*?)(\||$)/);
                    const locationMatch = desc.match(/Lieu: (.*?)(\||$)/);
                    const freq = p.frequency ? capitalize(p.frequency) : 'Ponctuelle';

                    return {
                        ...p,
                        mainService: p.main_service || p.mainService,
                        priceHT: p.price_ht || p.priceHT,
                        priceTaxCredit: p.price_tax_credit || p.priceTaxCredit,
                        suppliesIncluded: p.supplies_included || p.suppliesIncluded,
                        suppliesDetails: p.supplies_details || p.suppliesDetails,
                        isSap: p.is_sap || p.isSap,
                        contractType: p.contract_type || p.contractType,
                        quantity: quantityMatch ? quantityMatch[1].trim() : (p.quantity || ''),
                        location: locationMatch ? locationMatch[1].trim() : (p.location || ''),
                        frequency: freq
                    };
                }));
            }
            if (ctData) {
                setContracts(ctData.map((c: any) => ({
                    ...c,
                    packId: c.pack_id || c.packId,
                    isSap: c.is_sap || c.isSap,
                    validationDate: c.validation_date || c.validationDate,
                    clientSignatureUrl: c.client_signature_url,
                    signedAt: c.signed_at
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
                    targetUserType: n.target_user_role, // Use role instead of specific ID for general mapping if simple
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
                        await supabase.from('missions').update({ reminder_48h_sent: true }).eq('id', m.id);
                        await addNotification('admin', 'info', 'Rappel 48h Envoyé', `Rappel annulation envoyé au client ${m.clientName} pour le ${m.date}.`, undefined);
                        await addNotification('client', 'info', 'Rappel Intervention', `Votre intervention du ${m.date} ne peut plus être annulée sans frais.`, m.clientId);
                    }
                }
            }
        });
    };

    const fetchUserProfile = async (authUser: any) => {
        try {
            if (!isSupabaseConfigured) return;
            const { data: profile } = await supabase.from('users').select('*').eq('id', authUser.id).maybeSingle();
            let userObj: User | null = null;
            if (profile) {
                userObj = {
                    id: authUser.id,
                    email: authUser.email || '',
                    name: profile.name || authUser.email?.split('@')[0] || 'Utilisateur',
                    role: profile.role || 'client',
                    relatedEntityId: profile.related_entity_id
                } as User;
            } else if (authUser.email === 'admin@presta.com') {
                userObj = {
                    id: authUser.id,
                    email: authUser.email,
                    name: 'Admin Principal',
                    role: 'admin'
                } as User;
            } else {
                userObj = {
                    id: authUser.id,
                    email: authUser.email || '',
                    name: 'Utilisateur',
                    role: 'client'
                } as User;
            }
            if (userObj) {
                setCurrentUser(userObj);
                if (userObj.role === 'client' && userObj.relatedEntityId) {
                    setSimulatedClientId(userObj.relatedEntityId);
                } else if (userObj.role === 'provider' && userObj.relatedEntityId) {
                    setSimulatedProviderId(userObj.relatedEntityId);
                }
                try { localStorage.setItem('presta_current_user', JSON.stringify(userObj)); } catch { }
            }
        } catch (e) {
            console.error("Error fetching user profile:", e);
        }
    };

    // --- AUTHENTICATION & INITIALIZATION ---
    useEffect(() => {
        let mounted = true;

        // SAFETY TIMEOUT: Force stop loading after 7 seconds
        const safetyTimer = setTimeout(() => {
            if (mounted && loading) {
                console.warn("Initialization timed out. Forcing app load.");
                setLoading(false);
                setIsOnline(false);
            }
        }, 7000);

        const initializeAuth = async () => {
            try {
                // Check LocalStorage first for instant UI response
                const cached = localStorage.getItem('presta_current_user');
                if (cached) {
                    const parsed = JSON.parse(cached);
                    setCurrentUser(parsed);
                    if (parsed.role === 'client' && parsed.relatedEntityId) setSimulatedClientId(parsed.relatedEntityId);
                    if (parsed.role === 'provider' && parsed.relatedEntityId) setSimulatedProviderId(parsed.relatedEntityId);
                }

                if (!isSupabaseConfigured) {
                    if (mounted) setLoading(false);
                    return;
                }

                // Check Supabase Session status directly
                const { data: { session }, error } = await supabase.auth.getSession();

                if (session?.user && mounted) {
                    await fetchUserProfile(session.user);
                    // IMPORTANT: Fetch data immediately if authenticated to prevent "empty dashboard"
                    await refreshData();
                } else {
                    // Even if no session, try to refresh data once (maybe public data?) or just stop loading
                    // In this app, data is protected, so if no session, we just stop loading to show Login.
                }

            } catch (error) {
                console.error("Auth check failed:", error);
            } finally {
                clearTimeout(safetyTimer);
                if (mounted) setLoading(false);
            }
        };

        initializeAuth();

        if (!isSupabaseConfigured) return;

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (!mounted) return;

            if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') && session?.user) {
                // Double check profile fetch if needed
                if (!currentUser || currentUser.id !== session.user.id) {
                    await fetchUserProfile(session.user);
                }
                // Ensure data is refreshed whenever auth state confirms a session
                await refreshData();
                setLoading(false);
            } else if (event === 'SIGNED_OUT') {
                setCurrentUser(null);
                setMissions([]);
                setClients([]);
                setProviders([]);
                setDocuments([]);
                localStorage.removeItem('presta_current_user');
                setLoading(false);
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
                const { data: { session } } = await supabase.auth.getSession();
                if (session) {
                    setIsOnline(true);
                    await refreshData();
                } else {
                    console.log("No active session found on wake.");
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
        const id = generateUUID();
        const now = new Date().toISOString();

        const { data, error } = await supabase.from('notifications').insert({
            id,
            title,
            message,
            type, // Added to Supabase even if not in standard SQL definition, assuming it maps if column exists or ignored
            date: now,
            is_read: false,
            link,
            created_at: now,
            target_user_role: targetUserType,
            target_user_id: targetUserId
        }).select();

        if (data) {
            const mappedNotif: AppNotification = {
                ...data[0],
                read: false,
                targetUserType,
                targetUserId
            };
            setNotifications(prev => [mappedNotif, ...prev]);
        }
    };

    // --- ACTIONS ---

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
                    link: `https://presta-antilles.app/reports`
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
                        link: 'https://presta-antilles.app/login'
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

                try {
                    const { error: fnError } = await supabase.functions.invoke('create-user', {
                        body: {
                            email: providerData.email,
                            password: password,
                            name: `${providerData.firstName} ${providerData.lastName}`,
                            role: 'provider',
                            relatedEntityId: newProvider.id
                        }
                    });
                    if (fnError) {
                        console.warn("Error creating provider auth:", fnError);
                    }

                    await sendEmail(providerData.email, 'Votre compte Prestataire est actif', 'welcome_provider', {
                        name: providerData.firstName,
                        login: providerData.email,
                        password: password,
                        link: 'https://presta-antilles.app/login'
                    });

                } catch (e) {
                    console.warn("Auth edge function failed/unavailable.", e);
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
                await fetchUserProfile(data.user);
                await refreshData();
                return true;
            }
        } catch (e) {
            console.warn("Auth login failed, attempting fallback...");
        }

        // Fallbacks for simulated environment
        const { data: clientData } = await supabase.from('clients').select('*').eq('email', email).maybeSingle();
        if (clientData) {
            const userObj: User = {
                id: clientData.id,
                email: clientData.email,
                name: clientData.name,
                role: 'client',
                relatedEntityId: clientData.id
            };
            setCurrentUser(userObj);
            setSimulatedClientId(clientData.id);
            try { localStorage.setItem('presta_current_user', JSON.stringify(userObj)); } catch { }

            // CRITICAL FIX: Refresh data and stop loading
            await refreshData();
            setLoading(false);
            return true;
        }

        const { data: providerData } = await supabase.from('providers').select('*').eq('email', email).maybeSingle();
        if (providerData) {
            const userObj: User = {
                id: providerData.id,
                email: providerData.email,
                name: `${providerData.first_name} ${providerData.last_name}`,
                role: 'provider',
                relatedEntityId: providerData.id
            };
            setCurrentUser(userObj);
            setSimulatedProviderId(providerData.id);
            try { localStorage.setItem('presta_current_user', JSON.stringify(userObj)); } catch { }

            // CRITICAL FIX: Refresh data and stop loading
            await refreshData();
            setLoading(false);
            return true;
        }

        return false;
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

        const { error } = await supabase.from('missions').update({ status: 'cancelled', cancellation_reason: reason }).eq('id', id);
        if (!error) {
            setMissions(prev => prev.map(mission => mission.id === id ? { ...mission, status: 'cancelled', cancellationReason: reason } : mission));

            // NOTIF ADMIN (Urgent)
            await addNotification('admin', 'alert', 'Annulation Prestataire', `Prestataire: ${m?.providerName} | Motif: ${reason}. Créneau libéré.`, undefined, `mission:${id}`);

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
                status: 'cancelled',
                cancellation_reason: 'Annulé par client',
                late_cancellation: isLate
            }).eq('id', id);

            if (!error) {
                setMissions(prev => prev.map(mission => mission.id === id ? { ...mission, status: 'cancelled', cancellationReason: 'Annulé par client', lateCancellation: isLate } : mission));

                if (isLate) {
                    await addNotification('client', 'alert', 'Annulation Tardive', `Votre mission a été annulée moins de 48h à l'avance. Elle est considérée comme réalisée et sera facturée à 50% (Hors SAP).`, m.clientId);
                    await addNotification('admin', 'alert', 'Annulation Tardive Client', `Le client ${m.clientName} a annulé < 48h. A facturer 50%.`, undefined, `mission:${id}`);
                    // EMAIL ADMIN
                    await sendEmail(companySettings.email, 'URGENT - Annulation Tardive Client', 'admin_client_cancelled_late', {
                        clientName: m.clientName,
                        date: m.date
                    });
                } else {
                    await addNotification('admin', 'info', 'Annulation Client', `Client: ${m.clientName} a annulé le RDV (Délai respecté).`, undefined, `mission:${id}`);
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
        await supabase.from('reviews').insert({ clientId, rating, comment, date: new Date().toISOString() });
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
                reminderSent: newDoc.reminder_sent
            }]);
            const client = clients.find(c => c.id === doc.clientId);
            if (client && client.email) {
                await sendEmail(client.email, `Nouveau Document : ${doc.type} ${doc.ref}`, 'new_document', {
                    type: doc.type,
                    ref: doc.ref,
                    total: doc.totalTTC
                });
            }
        }
    };

    const generateMissionsFromDocument = async (doc: Document) => {
        if (!doc.slotsData || !Array.isArray(doc.slotsData)) return;
        const missionsToCreate: any[] = [];
        const isRecurring = doc.frequency && doc.frequency !== 'Ponctuelle';
        const endDate = doc.recurrenceEndDate ? new Date(doc.recurrenceEndDate) : new Date(new Date().setFullYear(new Date().getFullYear() + 1));

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
                date: new Date().toISOString().split('T')[0]
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
                date: new Date().toISOString().split('T')[0]
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
            const hasConflict = docToSign.slotsData.some(slot => {
                if (!slot.date) return false;
                const slotStart = new Date(`${slot.date}T${slot.startTime}`);
                const slotEnd = new Date(`${slot.date}T${slot.endTime}`);

                return missions.some(m => {
                    if (m.status === 'cancelled' || !m.date) return false;
                    const mStart = new Date(`${m.date}T${m.startTime}`);
                    const mEnd = new Date(`${m.date}T${m.endTime}`);
                    // Check overlap
                    return (slotStart < mEnd && slotEnd > mStart);
                });
            });

            if (hasConflict) {
                alert("Impossible de signer ce devis : Un ou plusieurs créneaux ne sont plus disponibles. Veuillez contacter le secrétariat.");
                return; // Stop execution
            }
        }

        const now = new Date().toISOString();
        const { error } = await supabase.from('documents').update({ status: 'signed', signature_data: signatureData, signature_date: now }).eq('id', id);

        if (!error) {
            setDocuments(prev => prev.map(d => d.id === id ? { ...d, status: 'signed', signatureData, signatureDate: now } : d));

            // FIND ASSOCIATED CONTRACT (by pack name match usually)
            const quote = documents.find(d => d.id === id);
            if (quote) {
                // Heuristic: Find contract where pack name is inside quote description or just update all contracts for this client?
                // Ideally, link via packId if we had it stored on Document.
                // Fallback: If we can't link precisely, we'll try to find the contract linked to the pack used in the quote.

                // Try to find the pack
                const pack = packs.find(p => quote.description.includes(p.name));

                if (pack) {
                    const relatedContract = contracts.find(c => c.packId === pack.id);
                    if (relatedContract) {
                        // Update Contract Signature
                        await supabase.from('contracts').update({
                            client_signature_url: signatureData,
                            signed_at: now
                        }).eq('id', relatedContract.id);

                        setContracts(prev => prev.map(c => c.id === relatedContract.id ? { ...c, clientSignatureUrl: signatureData, signedAt: now } : c));
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
                date: new Date().toISOString().split('T')[0],
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
        const mergedDescription = `${pack.description}\n| Quantité: ${pack.quantity || 'Standard'} | Lieu: ${pack.location || 'Domicile Client'}`;
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

    const deletePacks = async (ids: string[]) => {
        const { error } = await supabase.from('packs').delete().in('id', ids);
        if (!error) {
            setPacks(prev => prev.filter(p => !ids.includes(p.id)));
        }
    };

    const addContract = async (contract: Contract) => {
        const finalId = generateUUID();
        const packId = (!contract.packId || contract.packId === "") ? null : contract.packId;
        const dbData = {
            id: finalId,
            name: contract.name,
            content: contract.content,
            pack_id: packId,
            status: contract.status,
            is_sap: contract.isSap,
            validation_date: contract.validationDate,
            admin_signature_url: contract.adminSignatureUrl,
            company_stamp_url: contract.companyStampUrl,
            validated_at: contract.validatedAt
        };
        const { data, error } = await supabase.from('contracts').insert(dbData).select();
        if (error) throw new Error("Erreur lors de la sauvegarde du contrat: " + error.message);
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

            const now = new Date().toISOString();
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
                'ecoagirmartinique@gmail.com',
                `Demande de validation - Contrat ${contract.id}`,
                'contract_validation_request',
                {
                    contractRef: contract.id,
                    clientName: clientName,
                    secretaryName: secretaryName,
                    link: 'https://presta-antilles.app/login'
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

            const now = new Date().toISOString();
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
                    'contact@presta-antilles.com',
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
        const now = new Date().toISOString();
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
        const now = new Date().toISOString();
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
        try {
            const todayStart = new Date();
            todayStart.setHours(0, 0, 0, 0);
            const { data: recentScans } = await supabase
                .from('visit_scans')
                .select('*')
                .eq('client_id', clientId)
                .eq('scanner_id', currentUser.id)
                .gte('timestamp', todayStart.toISOString())
                .order('timestamp', { ascending: false });
            const lastScan = recentScans && recentScans.length > 0 ? recentScans[0] : null;
            const newType: 'entry' | 'exit' = (lastScan && lastScan.scan_type === 'entry') ? 'exit' : 'entry';
            const newScan = {
                client_id: clientId,
                scanner_id: currentUser.id,
                scanner_name: currentUser.name,
                scan_type: newType,
                timestamp: new Date().toISOString()
            };
            const { data, error } = await supabase.from('visit_scans').insert(newScan).select();
            if (error) throw error;
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
                return { success: true, type: newType, message: newType === 'entry' ? "Entrée enregistrée" : "Sortie enregistrée" };
            }
            return { success: false, message: "Erreur inconnue lors du scan" };
        } catch (error: any) {
            console.error("Scan error:", error);
            return { success: false, message: String(error.message || "Erreur scan") };
        }
    };

    const deleteMissions = async (ids: string[]) => {
        const { error } = await supabase.from('missions').delete().in('id', ids);
        if (!error) {
            setMissions(prev => prev.filter(m => !ids.includes(m.id)));
        }
    };

    const logout = async (skipReload?: boolean) => {
        localStorage.removeItem('presta_current_user');
        localStorage.clear();

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

    const startLiveStream = (providerId: string, clientId: string) => {
        const session: StreamSession = {
            id: `stream-${Date.now()}`,
            providerId,
            clientId,
            status: 'active',
            startTime: new Date().toISOString()
        };
        setActiveStream(session);
    };

    const stopLiveStream = () => {
        setActiveStream(null);
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

    return (
        <DataContext.Provider value={{
            companySettings, updateCompanySettings,
            missions, addMission, startMission, endMission, cancelMissionByProvider, cancelMissionByClient, canCancelMission, assignProvider, deleteMissions,
            clients, addClient, updateClient, deleteClients, addLoyaltyHours, submitClientReview,
            providers, addProvider, updateProvider, deleteProviders, addLeave, updateLeaveStatus, resetProviderPassword,
            documents, addDocument, updateDocumentStatus, deleteDocument, deleteDocuments, duplicateDocument, convertQuoteToInvoice, markInvoicePaid, sendDocumentReminder, signQuoteWithData, refuseQuote, requestInvoice, refundTransaction,
            packs, addPack, deletePacks,
            contracts, addContract, updateContract, requestContractValidation, validateContract, legalTemplate,
            reminders, addReminder, toggleReminder,
            expenses, addExpense, updateExpense,
            messages, replyToClient, sendClientMessage,
            notifications, markNotificationRead,
            visitScans, registerScan,
            currentUser, login, logout,
            simulatedClientId, setSimulatedClientId,
            simulatedProviderId, setSimulatedProviderId,
            activeStream, startLiveStream, stopLiveStream,
            isOnline, pendingSyncCount, loading,
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
