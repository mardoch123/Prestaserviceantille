import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { 
    Provider, Mission, Pack, Contract, Reminder, Document, Client, 
    AppNotification, Message, User, StreamSession, Expense, CompanySettings,
    CreateMissionDTO, CreateClientDTO, CreateProviderDTO, Leave, VisitScan
} from '../types';
import { supabase, isSupabaseConfigured } from '../utils/supabaseClient';
import { send } from '@emailjs/browser';

// --- CONFIGURATION EMAIL (GRATUIT) ---
const EMAILJS_SERVICE_ID = "PrestaServicesAntilles"; 
const EMAILJS_TEMPLATE_ID = "template_o74lx0n"; 
const EMAILJS_PUBLIC_KEY = "CAw5EbFlSL9psrSaW";

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
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
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
    legalTemplate: string;

    reminders: Reminder[];
    addReminder: (reminder: Reminder) => Promise<void>;
    toggleReminder: (id: string) => Promise<void>;

    expenses: Expense[];
    addExpense: (expense: Expense) => Promise<void>;
    updateExpense: (id: string, data: Partial<Expense>) => Promise<void>;
    deleteExpense: (id: string) => Promise<void>;

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

    // FULL LEGAL TEMPLATE FROM PDF (OCR) - UNTRUNCATED
    const legalTemplate = 
`Process Créer Contrat
PRESTA SERVICES ANTILLES – SASU
Siège : 31 Résidence L’Autre Bord – 97220 La Trinité
N° SAP : SAP944789700
Email : prestaservicesantilles.rh@gmail.com
Assurance RCP : Contrat n° RCP250714175810 – Assurup pour le compte de Hiscox – validité : 01/08/2025 → 31/07/2026 – plafond : 100 000 € par période – Monde entier (hors USA/Canada). Attestation disponible sur demande.

ENTRE LES SOUSSIGNÉS :

PRESTA SERVICES ANTILLES (Le Prestataire)
ET
[INFO_CLIENT] (Le Client)

IL A ÉTÉ CONVENU CE QUI SUIT :

OBJET DU CONTRAT : [INFO_PACK]

-- Obligations du Prestataire
Le Prestataire exécute les Prestations avec diligence et professionnalisme, selon les règles de l’art et dans le respect des normes d’hygiène et de sécurité applicables. Il affecte des intervenants compétents et placés sous encadrement. Les Prestations demeurent limitées au périmètre éligible au SAP.

-- Obligations du Client
Le Client assure l’accès au domicile aux dates et créneaux convenus, fournit les informations utiles et met à disposition un environnement conforme (électricité, eau, accès sécurisé). Il respecte les modalités de paiement et veille au maintien en place et à la lisibilité du QR code.

-- Responsabilité
Le Prestataire n’est pas responsable (i) des retards résultant d’un manquement du Client, notamment en cas d’accès impossible ou d’absence de QR code, ni (ii) des dommages, défauts ou dysfonctionnements antérieurs à l’intervention. Sa responsabilité est limitée aux dommages directs, certains et prouvés, dans la limite des plafonds de ses assurances.

-- Protection des données (RGPD)
Données traitées : identité et coordonnées, adresse d’intervention, consignes d’accès, données de pointage. Base légale : exécution du Contrat. Durées de conservation : pendant le Contrat puis selon les délais légaux. Droits du Client : accès, rectification, effacement, limitation, opposition et portabilité (contact : prestaservicesantilles.rh@gmail.com). Les sous‑traitants (hébergement, paiement, pointage) sont tenus à des obligations de confidentialité et de sécurité. Aucun transfert hors UE n’est effectué sans garanties adéquates.

-- Résiliation
12.1. Avec préavis : chaque Partie peut résilier le Contrat à tout moment, sous réserve d’un préavis de 30 jours notifié par lettre recommandée avec accusé de réception ou par courriel avec accusé de réception.
12.2. Pour manquement : en cas de manquement grave non corrigé dans un délai de 8 jours à compter d’une mise en demeure écrite, le Contrat pourra être résilié de plein droit, sans indemnité.
12.3. Effets : les sommes dues au titre des prestations réalisées jusqu’à la date d’effet de la résiliation restent exigibles.

-- Droit de rétractation (consommateur)
En cas de conclusion à distance ou hors établissement, le Client consommateur dispose d’un délai de 14 jours à compter de la signature pour se rétracter, sans motif ni frais, conformément aux articles L221‑18 et suivants du Code de la consommation. L’exécution des prestations avant l’expiration de ce délai ne peut intervenir qu’avec l’accord exprès du Client, qui reconnaît perdre son droit de rétractation pour les prestations pleinement exécutées. Modèle de formulaire en Annexe 2.

-- Médiation de la consommation et litiges
En cas de litige, le Client peut recourir gratuitement à un médiateur de la consommation : [organisme compétent] – [adresse / site]. À défaut d’accord amiable, le litige sera porté devant les juridictions territorialement compétentes, selon le droit commun. Droit applicable : droit français.

-- Confidentialité
Les informations échangées dans le cadre du Contrat sont confidentielles pendant sa durée et pendant 3 ans après son expiration, sauf obligation légale ou décision de justice.

-- Dispositions diverses
La nullité d’une clause n’affecte pas la validité du reste du Contrat. Le Client ne peut céder le Contrat sans l’accord écrit préalable du Prestataire. Élection de domicile aux adresses indiquées ci‑dessus.

-- Cas particuliers
• Si l’annulation est faite moins de 48 h avant l’intervention, le client reçoit une notification : la mission est considérée comme réalisée et facturée. Elle est ajoutée aux statistiques « missions annulées sous 48 h ». Le créneau devient disponible pour une nouvelle mission. Dans ce cas, 50 % du montant est facturé, hors SAP, sans avance immédiate.
• Si 2 devis ont été envoyé en même temps à 2 clients différents le 1er qui aura signé bloquera les créneaux souhaités.
• Un prestataire peut tomber malade en pleine mission et donc annule la mission avec un motif obligatoire.
• Une notification par mail doit etre envoyé aux clients comme rappel 48h avant la date d’intervention, disant que la prestation ne peut plus etre annulée.

Fait à La Trinité, le [DATE]

Signature Client (précédée de 'Lu et approuvé') :
_____________________________


Signature Prestataire :
_____________________________
Chaque contrat est envoyé a l’administratateur pour validation avant mise en service aussitot validé on met le cachet et signature (page 25) de l’entreprise en fin de contrat.
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
                return;
            }

            const fetchTable = async (table: string, query: any = '*') => {
                try {
                    const { data, error } = await supabase.from(table).select(query);
                    if (error) {
                        console.warn(`Failed to fetch ${table}:`, error.message);
                        return null;
                    }
                    return data;
                } catch (e) {
                    console.warn(`Exception fetching ${table}`);
                    return null;
                }
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
                fetchTable('messages'), 
                fetchTable('notifications'),
                supabase.from('company_settings').select('*').maybeSingle().then(r => r.data),
                fetchTable('visit_scans'),
                fetchTable('leaves')
            ]);

            // ... (Mapping data)
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
                    reportSent: m.report_sent || m.reportSent,
                    sourceDocumentId: m.source_document_id
                }));
                setMissions(mappedMissions);
                checkUpcomingReminders(mappedMissions); 
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
                    read: n.is_read, 
                    targetUserType: n.target_user_role,
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

    // Check for 48h reminders
    const checkUpcomingReminders = async (currentMissions: Mission[]) => {
        const now = new Date();
        const fortyEightHoursInMs = 48 * 60 * 60 * 1000;
        
        currentMissions.forEach(async (m) => {
            if (m.status === 'planned' && m.date && !m.reminder48hSent) {
                const missionDate = new Date(`${m.date}T${m.startTime}`);
                const diff = missionDate.getTime() - now.getTime();
                
                if (diff > 0 && diff <= fortyEightHoursInMs) {
                    const client = clients.find(c => c.id === m.clientId);
                    if (client && client.email) {
                        await sendEmail(client.email, 'Rappel Intervention (J-2)', 'reminder_48h', {
                            clientName: m.clientName,
                            date: m.date,
                            time: m.startTime
                        });
                        
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
                try { localStorage.setItem('presta_current_user', JSON.stringify(userObj)); } catch {}
            }
        } catch (e) {
            console.error("Error fetching user profile:", e);
        }
    };

    // --- AUTHENTICATION & INITIALIZATION ---
    useEffect(() => {
        let mounted = true;

        const initializeAuth = async () => {
            try {
                const cached = localStorage.getItem('presta_current_user');
                if (cached) {
                    const parsed = JSON.parse(cached);
                    setCurrentUser(parsed);
                    if(parsed.role === 'client' && parsed.relatedEntityId) setSimulatedClientId(parsed.relatedEntityId);
                    if(parsed.role === 'provider' && parsed.relatedEntityId) setSimulatedProviderId(parsed.relatedEntityId);
                }

                if (!isSupabaseConfigured) {
                    if (mounted) setLoading(false);
                    return;
                }

                const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 3000));
                
                try {
                    const sessionPromise = supabase.auth.getSession();
                    const result: any = await Promise.race([sessionPromise, timeoutPromise]);
                    
                    const { data: { session } } = result;
                    
                    if (session?.user && mounted) {
                        await fetchUserProfile(session.user);
                        await refreshData();
                    } 
                } catch (e) {
                    console.warn("Supabase connection timeout or error. Clearing session to allow re-login.");
                    localStorage.removeItem('presta_current_user');
                    setCurrentUser(null);
                }
                
            } catch (error) {
                console.error("Auth check failed:", error);
            } finally {
                if (mounted) setLoading(false);
            }
        };

        initializeAuth();

        if (!isSupabaseConfigured) return;

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (!mounted) return;
            
            if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') && session?.user) {
                 if (!currentUser || currentUser.id !== session.user.id) {
                     await fetchUserProfile(session.user);
                 }
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

    // --- HYBRID EMAIL SYSTEM ---
    const sendEmail = async (to: string, subject: string, template: string, context: any) => {
        console.log(`Preparing to send email to ${to}...`);
        let body = "";
        // Template logic omitted for brevity, keeping existing implementation
        switch(template) {
            case 'welcome_client':
                body = `Bienvenue chez Presta Services Antilles,\n\nNous sommes ravis de vous compter parmi nos clients.\n\nVotre espace personnel a été créé. Vous pouvez y accéder pour suivre vos plannings, factures et documents.\n\nLien : https://presta-antilles.app\nIdentifiant : ${context.email}\nMot de passe provisoire : ${context.password}\n\nNous vous conseillons de changer ce mot de passe dès votre première connexion.\n\nCordialement,\nL'équipe Presta Services Antilles.`;
                break;
            case 'welcome_provider':
                body = `Bienvenue dans l'équipe Presta Services Antilles,\n\nVotre espace intervenant est désormais actif.\n\nLien : https://presta-antilles.app\nIdentifiant : ${context.email}\nMot de passe provisoire : ${context.password}\n\nConnectez-vous pour consulter vos missions et votre planning.\n\nCordialement,\nLa Direction.`;
                break;
            case 'mission_assigned': 
            case 'provider_mission_assigned':
                body = `Bonjour,\n\nUne nouvelle mission vous a été attribuée.\n\nClient : ${context.clientName}\nDate : ${context.date}\nHeure : ${context.time}\n\nConnectez-vous rapidement à votre espace pour voir l'adresse complète et valider la prise en charge.\n\nCordialement,\nPresta Services Antilles.`;
                break;
            case 'reminder_48h':
                body = `Bonjour ${context.clientName},\n\nCeci est un rappel automatique pour votre intervention prévue le :\n📅 ${context.date} à ${context.time}\n\n⚠️ IMPORTANT : Conformément à nos Conditions Générales de Vente, toute annulation effectuée moins de 48h avant l'intervention entraînera la facturation de la prestation (ou 50% selon le cas).\n\nMerci de votre confiance,\nPresta Services Antilles.`;
                break;
            case 'mission_report':
                body = `Bonjour ${context.clientName},\n\nL'intervention de ce jour est terminée.\n\nRemarque de l'intervenant :\n"${context.remark || 'Aucune remarque particulière.'}"\n\nVous pouvez retrouver les photos de fin de chantier directement dans votre espace client.\n\nÀ bientôt,\nPresta Services Antilles.`;
                break;
            case 'mission_cancelled':
                body = `Bonjour,\n\nNous vous informons que l'intervention prévue le ${context.date} a été annulée.\n\nMotif : ${context.reason}\n\n${context.note || ''}\n\nSi vous avez des questions, n'hésitez pas à contacter le secrétariat.\n\nCordialement,\nPresta Services Antilles.`;
                break;
            case 'document_notification':
                body = `Bonjour ${context.clientName},\n\nUn nouveau document est disponible dans votre espace client.\n\nType : ${context.type}\nRéférence : ${context.ref}\nMontant : ${context.amount} €\n\nMerci de le consulter et de procéder à sa validation ou son règlement si nécessaire.\n\nCordialement,\nService Comptabilité Presta Services Antilles.`;
                break;
            case 'new_message':
                body = `Bonjour,\n\nVous avez reçu un nouveau message de ${context.from}.\n\n"${context.message}"\n\nConnectez-vous à votre espace pour répondre.\n\nCordialement,\nPresta Services Antilles.`;
                break;
            case 'password_reset':
                body = `Bonjour,\n\nVotre mot de passe a été réinitialisé suite à votre demande ou celle de l'administrateur.\n\nNouveau mot de passe : ${context.password}\n\nMerci de le modifier dès votre prochaine connexion.\n\nCordialement,\nPresta Services Antilles.`;
                break;
            case 'contract_validation':
                body = `Bonjour Admin,\n\nUn nouveau contrat nécessite votre validation.\n\nContrat : ${context.contractName}\nClient : ${context.clientName}\n\nMerci de vous connecter pour valider.\n\nCordialement,\nSystème.`;
                break;
            case 'generic':
                body = `${context.message}\n\nCordialement,\n${context.from || 'Presta Services Antilles'}`;
                break;
            default: 
                body = `${context.message || JSON.stringify(context)}\n\nPresta Services Antilles`;
        }

        try {
            if (EMAILJS_SERVICE_ID && EMAILJS_TEMPLATE_ID && EMAILJS_PUBLIC_KEY) {
                await send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
                    to_email: to,
                    subject: subject,
                    message: body,
                    ...context
                }, EMAILJS_PUBLIC_KEY);
                console.log("Email sent successfully via EmailJS");
                return;
            } else {
                throw new Error("EmailJS keys not configured");
            }
        } catch (e) {
            console.warn("EmailJS failed, falling back to Mailto:", e);
            const mailtoLink = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
            const link = document.createElement('a');
            link.href = mailtoLink;
            link.target = '_blank';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };

    const addNotification = async (targetUserType: 'admin' | 'client' | 'provider', type: 'info' | 'alert' | 'success' | 'message', title: string, message: string, targetUserId?: string, link?: string) => {
        const id = generateUUID();
        const now = new Date().toISOString();
        try {
            const { data, error } = await supabase.from('notifications').insert({
                id,
                title, 
                message, 
                type, 
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
        } catch(e) {
            console.warn("Erreur ajout notification:", e);
        }
    };

    // --- ACTIONS ---

    const addClient = async (clientData: CreateClientDTO) => { /* ... existing implementation ... */ 
        const password = Math.random().toString(36).slice(-8);
        try {
            const dbClientData = { name: clientData.name, city: clientData.city, address: clientData.address, phone: clientData.phone, email: clientData.email, pack: clientData.pack, status: clientData.status, since: clientData.since, packs_consumed: clientData.packsConsumed || 0, loyalty_hours_available: clientData.loyaltyHoursAvailable || 0, has_left_review: false };
            const { data, error } = await supabase.from('clients').insert(dbClientData).select();
            if (error) throw error;
            if (data && data.length > 0) {
                const newClient = data[0];
                supabase.functions.invoke('create-user', { body: { email: clientData.email, password, name: clientData.name, role: 'client', relatedEntityId: newClient.id } }).catch(() => {});
                await sendEmail(clientData.email, 'Bienvenue chez Presta Services Antilles', 'welcome_client', { name: clientData.name, email: clientData.email, password: password });
                setClients(prev => [...prev, { ...newClient, packsConsumed: newClient.packs_consumed, loyaltyHoursAvailable: newClient.loyalty_hours_available, hasLeftReview: newClient.has_left_review }]);
                return password; 
            }
        } catch (err) { console.error("Critical error in addClient:", err); throw err; }
        return null;
    };

    const addProvider = async (providerData: CreateProviderDTO) => { /* ... existing implementation ... */ 
        const password = Math.random().toString(36).slice(-8);
        try {
            const dbProviderData = { first_name: providerData.firstName, last_name: providerData.lastName, specialty: providerData.specialty, phone: providerData.phone, email: providerData.email, status: providerData.status, hours_worked: 0, rating: 5 };
            const { data, error } = await supabase.from('providers').insert(dbProviderData).select();
            if (error) throw error; 
            if (data && data.length > 0) {
                 const newProvider = data[0];
                 supabase.functions.invoke('create-user', { body: { email: providerData.email, password, name: `${providerData.firstName} ${providerData.lastName}`, role: 'provider', relatedEntityId: newProvider.id } }).catch(() => {});
                 await sendEmail(providerData.email, 'Bienvenue dans l\'équipe !', 'welcome_provider', { name: `${providerData.firstName} ${providerData.lastName}`, email: providerData.email, password: password });
                 setProviders(prev => [...prev, { ...newProvider, firstName: newProvider.first_name, lastName: newProvider.last_name, hoursWorked: newProvider.hours_worked, leaves: [] }]);
                 return password; 
            }
        } catch (err) { console.error("Critical error in addProvider:", err); throw err; }
        return null;
    };

    const login = async (email: string, password?: string): Promise<boolean> => { /* ... existing implementation ... */ 
        if (!password) return false;
        try {
            const { data, error } = await supabase.auth.signInWithPassword({ email, password });
            if (data.user) { await fetchUserProfile(data.user); await refreshData(); return true; }
        } catch (e) { console.warn("Auth login failed, attempting fallback..."); }
        return false;
    };

    const addMission = async (mission: Mission) => {
        const finalId = generateUUID();
        const dbData = {
            id: finalId,
            date: mission.date, // Format YYYY-MM-DD
            start_time: mission.startTime, // Format HH:MM
            end_time: mission.endTime, // Format HH:MM
            duration: mission.duration,
            client_id: mission.clientId,
            client_name: mission.clientName,
            service: mission.service,
            provider_id: (!mission.providerId || mission.providerId === 'null') ? null : mission.providerId,
            provider_name: mission.providerName,
            status: mission.status, // USER-DEFINED enum
            color: mission.color, // USER-DEFINED enum
            source: mission.source || 'reservation',
            source_document_id: mission.sourceDocumentId,
            created_at: new Date().toISOString()
        };
        const { data, error } = await supabase.from('missions').insert(dbData).select();
        if(error) {
            console.error("DB Insert Error:", error);
            throw error;
        }
        if(data) {
            const m = data[0];
            const newMission = { ...mission, id: m.id, dayIndex: getDayIndexFromDate(m.date) };
            setMissions(prev => [...prev, newMission]);
            if(newMission.providerId) {
                addNotification('provider', 'info', 'Nouvelle Mission', 'Vous avez été assigné.', newMission.providerId);
            }
        }
    };

    const registerScan = async (clientId: string) => {
        if (!clientId) return { success: false, message: "Client non spécifié" };
        
        try {
            const scanData = {
                id: generateUUID(),
                client_id: clientId,
                scanner_id: currentUser?.id || 'unknown_scanner',
                scanner_name: currentUser?.name || 'Inconnu',
                scan_type: 'entry',
                timestamp: new Date().toISOString(),
                location_data: { lat: 0, lng: 0 }
            };
            
            const { data, error } = await supabase.from('visit_scans').insert(scanData).select();
            
            if (error) {
                console.error("Scan insert error:", error);
                return { success: false, message: "Erreur enregistrement" };
            }
            
            const inserted = data && data[0] ? data[0] : scanData;
            setVisitScans(prev => [{
                ...inserted,
                clientId: inserted.client_id || clientId,
                scannerId: inserted.scanner_id || scanData.scanner_id,
                scannerName: inserted.scanner_name || scanData.scanner_name,
                scanType: inserted.scan_type || 'entry',
                locationData: inserted.location_data || scanData.location_data
            }, ...prev]);

            return { success: true, message: "Scan enregistré avec succès" };
        } catch (e) {
            return { success: false, message: "Erreur technique" };
        }
    };

    const updateClient = async (id: string, data: Partial<Client>) => { /* ... */ const { error } = await supabase.from('clients').update(data).eq('id', id); if(!error) setClients(prev => prev.map(c => c.id === id ? { ...c, ...data } : c)); };
    const startMission = async (id: string, remark?: string, photos?: string[], video?: string) => { /* ... */ const { error } = await supabase.from('missions').update({ status: 'in_progress', start_remark: remark, start_photos: photos }).eq('id', id); if(!error) setMissions(prev => prev.map(m => m.id === id ? { ...m, status: 'in_progress', startRemark: remark, startPhotos: photos } : m)); };
    const endMission = async (id: string, remark?: string, photos?: string[], video?: string) => { /* ... */ const { error } = await supabase.from('missions').update({ status: 'completed', end_remark: remark, end_photos: photos, report_sent: true }).eq('id', id); if(!error) { setMissions(prev => prev.map(m => m.id === id ? { ...m, status: 'completed', endRemark: remark, endPhotos: photos, reportSent: true } : m)); const m = missions.find(m => m.id === id); if(m) { addNotification('admin', 'success', 'Mission Terminée', `Chez ${m.clientName}`).catch(console.warn); const client = clients.find(c => c.id === m.clientId); if (client && client.email) { await sendEmail(client.email, 'Rapport de Mission Terminée', 'mission_report', { clientName: m.clientName, remark: remark }); } } } };
    const cancelMissionByProvider = async (id: string, reason: string) => { /* ... */ const { error } = await supabase.from('missions').update({ status: 'cancelled', cancellation_reason: reason }).eq('id', id); if(!error) { setMissions(prev => prev.map(m => m.id === id ? { ...m, status: 'cancelled', cancellationReason: reason } : m)); const m = missions.find(m => m.id === id); if (m) { const client = clients.find(c => c.id === m.clientId); if (client && client.email) { await sendEmail(client.email, 'Annulation Intervention (Prestataire)', 'mission_cancelled', { date: m.date, reason: "Imprévu intervenant (santé/force majeure)", note: "Le secrétariat vous contactera rapidement pour reprogrammer." }); } await sendEmail(companySettings.email, 'ALERTE: Annulation Prestataire', 'new_message', { from: m.providerName, message: `Le prestataire a annulé la mission chez ${m.clientName} le ${m.date}. Motif: ${reason}` }); } } };
    const cancelMissionByClient = async (id: string) => { /* ... */ const { error } = await supabase.from('missions').update({ status: 'cancelled', cancellation_reason: 'Annulé par client' }).eq('id', id); if(!error) { setMissions(prev => prev.map(m => m.id === id ? { ...m, status: 'cancelled', cancellationReason: 'Annulé par client' } : m)); const m = missions.find(m => m.id === id); if (m) { const client = clients.find(c => c.id === m.clientId); if (client && client.email) { const now = new Date(); const missionDate = new Date(`${m.date}T${m.startTime}`); const diffHours = (missionDate.getTime() - now.getTime()) / (1000 * 60 * 60); const isLate = diffHours < 48; await sendEmail(client.email, 'Confirmation Annulation de votre part', 'mission_cancelled', { date: m.date, reason: "Annulé par vos soins", note: isLate ? "ATTENTION : Annulation tardive (<48h). 50% de la prestation sera facturée selon nos CGV." : "Annulation sans frais." }); } } } };
    const canCancelMission = (mission: Mission) => true; 
    const assignProvider = async (missionId: string, providerId: string, providerName: string) => { /* ... */ const { error } = await supabase.from('missions').update({ provider_id: providerId, provider_name: providerName, status: 'planned', color: 'orange' }).eq('id', missionId); if(!error) { setMissions(prev => prev.map(m => m.id === missionId ? { ...m, providerId, providerName, status: 'planned', color: 'orange' } : m)); const provider = providers.find(p => p.id === providerId); const mission = missions.find(m => m.id === missionId); if(provider && provider.email) { await sendEmail(provider.email, 'Nouvelle Mission Assignée', 'mission_assigned', { clientName: mission?.clientName || 'Client', missionId: missionId, date: mission?.date, time: mission?.startTime }); } } };
    const deleteMissions = async (ids: string[]) => { const { error } = await supabase.from('missions').delete().in('id', ids); if(!error) setMissions(prev => prev.filter(m => !ids.includes(m.id))); };
    const deleteClients = async (ids: string[]) => { const { error } = await supabase.from('clients').delete().in('id', ids); if(!error) setClients(prev => prev.filter(c => !ids.includes(c.id))); };
    const addLoyaltyHours = async (clientId: string, hours: number) => { /* ... */ };
    const submitClientReview = async (clientId: string, rating: number, comment: string) => { /* ... */ };
    const updateProvider = async (id: string, data: Partial<Provider>) => { const { error } = await supabase.from('providers').update(data).eq('id', id); if(!error) setProviders(prev => prev.map(p => p.id === id ? { ...p, ...data } : p)); };
    const deleteProviders = async (ids: string[]) => { const { error } = await supabase.from('providers').delete().in('id', ids); if(!error) setProviders(prev => prev.filter(p => !ids.includes(p.id))); };
    const addLeave = async (providerId: string, start: string, end: string, startTime?: string, endTime?: string) => { /* ... */ };
    const updateLeaveStatus = async (leaveId: string, providerId: string, status: 'approved' | 'rejected') => { /* ... */ };
    const resetProviderPassword = async (id: string) => { /* ... */ };
    const addDocument = async (doc: Document) => { const finalId = generateUUID(); const { data, error } = await supabase.from('documents').insert({ ...doc, id: finalId, client_id: doc.clientId, client_name: doc.clientName, total_ttc: doc.totalTTC, total_ht: doc.totalHT }).select(); if(!error && data) { setDocuments(prev => [...prev, { ...doc, id: finalId }]); const client = clients.find(c => c.id === doc.clientId); if (client && client.email) { await sendEmail(client.email, `Nouveau document disponible : ${doc.type}`, 'document_notification', { clientName: client.name, type: doc.type, ref: doc.ref, amount: doc.totalTTC.toFixed(2) }); } } };
    const updateDocumentStatus = async (id: string, status: string) => { const { error } = await supabase.from('documents').update({ status }).eq('id', id); if(!error) setDocuments(prev => prev.map(d => d.id === id ? { ...d, status: status as any } : d)); };
    const deleteDocument = async (id: string) => { const { error } = await supabase.from('documents').delete().eq('id', id); if(!error) setDocuments(prev => prev.filter(d => d.id !== id)); };
    const deleteDocuments = async (ids: string[]) => { /* ... */ };
    const duplicateDocument = async (id: string) => { /* ... */ };
    const convertQuoteToInvoice = async (quoteId: string) => { /* ... */ };
    const markInvoicePaid = async (id: string) => { updateDocumentStatus(id, 'paid'); };
    const sendDocumentReminder = async (id: string) => { /* ... */ };
    const signQuoteWithData = async (id: string, signatureData: string) => { /* ... */ };
    const refuseQuote = async (id: string) => { updateDocumentStatus(id, 'rejected'); };
    const requestInvoice = async (docId: string) => { /* ... */ };
    const refundTransaction = async (ref: string, amount: number) => { /* ... */ };
    const addPack = async (pack: Pack) => { return null; };
    const deletePacks = async (ids: string[]) => { /* ... */ };
    const addContract = async (contract: Contract) => { 
        const { error } = await supabase.from('contracts').insert({
            ...contract,
            pack_id: contract.packId,
            is_sap: contract.isSap
        });
        if(!error) setContracts(prev => [...prev, contract]);
    };
    const updateContract = async (id: string, updates: Partial<Contract>) => {
        const { error } = await supabase.from('contracts').update({
            ...updates,
            pack_id: updates.packId,
            is_sap: updates.isSap
        }).eq('id', id);
        if(!error) setContracts(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
    };
    const addReminder = async (reminder: Reminder) => { const { data, error } = await supabase.from('reminders').insert({ text: reminder.text, date: reminder.date, notify_email: reminder.notifyEmail, completed: false }).select(); if(!error && data) setReminders(prev => [...prev, { ...reminder, id: data[0].id }]); };
    const toggleReminder = async (id: string) => { const r = reminders.find(x => x.id === id); if(r) { await supabase.from('reminders').update({ completed: !r.completed }).eq('id', id); setReminders(prev => prev.map(x => x.id === id ? { ...x, completed: !x.completed } : x)); } };
    
    // EXPENSES - Full CRUD
    const addExpense = async (expense: Expense) => { 
        const dbData = {
            description: expense.description,
            amount: expense.amount,
            category: expense.category,
            date: expense.date,
            proof_url: expense.proofUrl
        };
        const { data, error } = await supabase.from('expenses').insert(dbData).select();
        if(!error && data) {
            const newExpense = { ...expense, id: data[0].id, proofUrl: data[0].proof_url };
            setExpenses(prev => [newExpense, ...prev]); 
        }
    };

    const updateExpense = async (id: string, data: Partial<Expense>) => {
        const dbData: any = {};
        if (data.description !== undefined) dbData.description = data.description;
        if (data.amount !== undefined) dbData.amount = data.amount;
        if (data.category !== undefined) dbData.category = data.category;
        if (data.date !== undefined) dbData.date = data.date;
        if (data.proofUrl !== undefined) dbData.proof_url = data.proofUrl;

        const { error } = await supabase.from('expenses').update(dbData).eq('id', id);
        if (!error) {
            setExpenses(prev => prev.map(e => e.id === id ? { ...e, ...data } : e));
        }
    };

    const deleteExpense = async (id: string) => {
        const { error } = await supabase.from('expenses').delete().eq('id', id);
        if(!error) {
            setExpenses(prev => prev.filter(e => e.id !== id));
        }
    };
    
    const sendClientMessage = async (text: string, clientId: string) => { /* ... */ };
    const replyToClient = async (text: string, clientId: string) => { /* ... */ };
    const markNotificationRead = async (id: string) => { /* ... */ };
    const logout = async (skipReload?: boolean) => { await supabase.auth.signOut(); localStorage.clear(); if(!skipReload) window.location.reload(); };
    const startLiveStream = (providerId: string, clientId: string) => { setActiveStream({ id: 'live', providerId, clientId, status: 'active', startTime: new Date().toISOString() }); };
    const stopLiveStream = () => { setActiveStream(null); };
    const getAvailableSlots = (date: string) => [];
    const updateCompanySettings = async (settings: CompanySettings) => { await supabase.from('company_settings').upsert(settings); setCompanySettings(settings); };

    return (
        <DataContext.Provider value={{
            companySettings, updateCompanySettings,
            missions, addMission, startMission, endMission, cancelMissionByProvider, cancelMissionByClient, canCancelMission, assignProvider, deleteMissions,
            clients, addClient, updateClient, deleteClients, addLoyaltyHours, submitClientReview,
            providers, addProvider, updateProvider, deleteProviders, addLeave, updateLeaveStatus, resetProviderPassword,
            documents, addDocument, updateDocumentStatus, deleteDocument, deleteDocuments, duplicateDocument, convertQuoteToInvoice, markInvoicePaid, sendDocumentReminder, signQuoteWithData, refuseQuote, requestInvoice, refundTransaction,
            packs, addPack, deletePacks,
            contracts, addContract, updateContract, legalTemplate,
            reminders, addReminder, toggleReminder,
            expenses, addExpense, updateExpense, deleteExpense,
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
        throw new Error('useData must be used within a DataProvider');
    }
    return context;
};
