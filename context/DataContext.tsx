import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { 
    Provider, Mission, Pack, Contract, Reminder, Document, Client, 
    AppNotification, Message, User, StreamSession, Expense, CompanySettings,
    CreateMissionDTO, CreateClientDTO, CreateProviderDTO, Leave
} from '../types';
import { supabase, isSupabaseConfigured } from '../utils/supabaseClient';

// --- Assets ---
export const LOGO_NORMAL = "https://prestaservicesantilles.com/images/logo.png"; 
export const LOGO_SAP = "https://prestaservicesantilles.com/images/logo.png";
export const CACHET_SIGNATURE = "https://via.placeholder.com/150?text=Cachet";

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
    addClient: (client: CreateClientDTO) => Promise<void>;
    updateClient: (id: string, data: Partial<Client>) => Promise<void>; 
    deleteClients: (ids: string[]) => Promise<void>; 
    addLoyaltyHours: (clientId: string, hours: number) => Promise<void>;
    submitClientReview: (clientId: string, rating: number, comment: string) => Promise<void>;

    providers: Provider[];
    addProvider: (provider: CreateProviderDTO) => Promise<void>;
    updateProvider: (id: string, data: Partial<Provider>) => Promise<void>; 
    deleteProviders: (ids: string[]) => Promise<void>; 
    addLeave: (providerId: string, start: string, end: string) => Promise<void>;
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
    addPack: (pack: Pack) => Promise<void>;
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

    messages: Message[];
    replyToClient: (text: string, clientId: string) => Promise<void>;
    sendClientMessage: (text: string, clientId: string) => Promise<void>;

    notifications: AppNotification[];
    markNotificationRead: (id: string) => Promise<void>;

    currentUser: User | null;
    login: (email: string, password?: string) => Promise<boolean>;
    logout: () => Promise<void>;
    
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
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    // --- STATE ---
    const [companySettings, setCompanySettings] = useState<CompanySettings>({
        name: 'PRESTA SERVICES ANTILLES',
        address: '123 Route de la Plage, 97100 Guadeloupe',
        siret: '123 456 789 00012',
        email: 'contact@presta-antilles.com',
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
Assurance RCP : Contrat n° RCP250714175810 – Assurup pour le compte de Hiscox

Infos obligatoires
Assurance :
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
12.2. Pour manquement : en cas de manquement grave non corrigé dans un délai de 8 jours à compter d’une mise en demeure écrite, le Contrat pourra être résilié de plein droit, sans indemnité.
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
                console.warn("Supabase not configured. Skipping data fetch.");
                setLoading(false);
                return;
            }

            // Check session before fetching
            const { data: { session }, error: authError } = await supabase.auth.getSession();
            if (authError || !session?.user) {
                // If fetching session fails or no session, stop here
                if (authError) console.warn("Auth session check failed:", authError.message);
                return;
            }

            const [
                { data: cData }, 
                { data: pData }, 
                { data: mData }, 
                { data: dData }, 
                { data: packData }, 
                { data: ctData },
                { data: rData },
                { data: eData },
                { data: msgData },
                { data: notifData },
                { data: settingsData }
            ] = await Promise.all([
                supabase.from('clients').select('*'),
                supabase.from('providers').select('*'),
                supabase.from('missions').select('*'),
                supabase.from('documents').select('*'),
                supabase.from('packs').select('*'),
                supabase.from('contracts').select('*'),
                supabase.from('reminders').select('*'),
                supabase.from('expenses').select('*'),
                supabase.from('messages').select('*'),
                supabase.from('notifications').select('*').order('date', { ascending: false }),
                supabase.from('company_settings').select('*').maybeSingle()
            ]);

            if (cData) {
                setClients(cData.map((c: any) => ({
                    ...c,
                    packsConsumed: c.packs_consumed || 0,
                    loyaltyHoursAvailable: c.loyalty_hours_available || 0,
                    hasLeftReview: c.has_left_review,
                })));
            }
            
            const { data: leavesData } = await supabase.from('leaves').select('*');
            if (pData) {
                setProviders(pData.map((p: any) => ({
                    ...p,
                    firstName: p.first_name || p.firstName,
                    lastName: p.last_name || p.lastName,
                    hoursWorked: p.hours_worked || p.hoursWorked,
                    leaves: leavesData ? leavesData.filter((l: any) => l.providerId === p.id) : [],
                })));
            }

            if (mData) {
                setMissions(mData.map((m: any) => ({
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
                    endRemark: m.end_remark || m.endRemark,
                    cancellationReason: m.cancellation_reason || m.cancellationReason,
                    lateCancellation: m.late_cancellation || m.lateCancellation,
                    reminder48hSent: m.reminder_48h_sent || m.reminder48hSent,
                    reminder72hSent: m.reminder_72h_sent || m.reminder72hSent,
                    reportSent: m.report_sent || m.reportSent
                })));
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
                    signatureDate: d.signature_date
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
                    validationDate: c.validation_date || c.validationDate
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
                setMessages(msgData.map((m: any) => ({
                    ...m,
                    clientId: m.client_id || m.clientId
                })));
            }
            if (notifData) setNotifications(notifData);
            
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
            
            // Set online if successful
            setIsOnline(true);

        } catch (error: any) {
            console.error("Erreur lors du chargement des données:", error);
            if (error.message === 'Failed to fetch' || error.message.includes('NetworkError')) {
                setIsOnline(false);
            }
        }
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
                     role: profile.role || 'admin',
                     relatedEntityId: profile.relatedEntityId
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
                     role: 'admin'
                 } as User;
            }
            if (userObj) {
                setCurrentUser(userObj);
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
                if (!isSupabaseConfigured) {
                    if (mounted) setLoading(false);
                    return;
                }

                // Check active session
                const { data: { session }, error } = await supabase.auth.getSession();
                
                if (error) {
                     console.warn("Auth initialization error:", error.message);
                } else if (session?.user && mounted) {
                    await fetchUserProfile(session.user);
                    // CRITICAL: Only refresh data if we have a valid session
                    await refreshData();
                } else if (mounted) {
                    // No session found, ensure we are clean
                    setCurrentUser(null);
                    localStorage.removeItem('presta_current_user');
                }
            } catch (error) {
                console.error("Auth check failed:", error);
                if(mounted) {
                    setCurrentUser(null);
                    localStorage.removeItem('presta_current_user');
                }
            } finally {
                // Force stop loading after attempt
                if (mounted) {
                    setLoading(false);
                }
            }
        };

        initializeAuth();

        // If not configured, we don't attach listener
        if (!isSupabaseConfigured) return;

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (!mounted) return;
            
            // Handle various auth events that signify a valid session
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

    // --- ACTIONS ---

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
            
            // Check if settings row exists, if not insert it
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

    const addMission = async (mission: Mission) => {
        const { id, ...missionData } = mission;
        const finalId = generateUUID(); 
        
        const dbMissionData = {
            id: finalId,
            date: missionData.date,
            start_time: missionData.startTime,
            end_time: missionData.endTime,
            duration: missionData.duration,
            client_id: missionData.clientId,
            client_name: missionData.clientName,
            provider_id: missionData.providerId,
            provider_name: missionData.providerName,
            service: missionData.service,
            status: missionData.status,
            color: missionData.color,
            source: missionData.source
        };

        const { data, error } = await supabase.from('missions').insert(dbMissionData).select();
        
        if (error) throw error;
        
        if (data) {
             const newMission = data[0];
             const mappedMission: Mission = {
                ...newMission,
                dayIndex: getDayIndexFromDate(newMission.date), 
                startTime: newMission.start_time,
                endTime: newMission.end_time,
                clientId: newMission.client_id,
                clientName: newMission.client_name,
                providerId: newMission.provider_id,
                providerName: newMission.provider_name
             };
            setMissions(prev => [...prev, mappedMission]);
            await addNotification('admin', 'info', 'Nouvelle Mission', `Mission planifiée pour ${mission.clientName} le ${mission.date}`);
        }
    };

    const deleteMissions = async (ids: string[]) => {
        const { error } = await supabase.from('missions').delete().in('id', ids);
        if (!error) {
            setMissions(prev => prev.filter(m => !ids.includes(m.id)));
        }
    };

    const startMission = async (id: string, remark?: string, photos?: string[], video?: string) => {
        const { error } = await supabase.from('missions').update({ 
            status: 'in_progress', 
            start_remark: remark, 
            start_photos: photos, 
            start_video: video 
        }).eq('id', id);

        if (!error) {
            setMissions(prev => prev.map(m => m.id === id ? { ...m, status: 'in_progress', startRemark: remark, startPhotos: photos, startVideo: video } : m));
        }
    };

    const endMission = async (id: string, remark?: string, photos?: string[], video?: string) => {
        const { error } = await supabase.from('missions').update({ 
            status: 'completed', 
            end_remark: remark, 
            end_photos: photos, 
            end_video: video 
        }).eq('id', id);

        if (!error) {
            setMissions(prev => prev.map(m => m.id === id ? { ...m, status: 'completed', endRemark: remark, endPhotos: photos, endVideo: video } : m));
            const m = missions.find(m => m.id === id);
            if (m) {
                await addNotification('admin', 'success', 'Mission terminée', `Mission chez ${m.clientName} terminée`, undefined, `mission:${id}`);
            }
        }
    };

    const cancelMissionByProvider = async (id: string, reason: string) => {
        const { error } = await supabase.from('missions').update({ status: 'cancelled', cancellation_reason: reason }).eq('id', id);
        if (!error) {
            setMissions(prev => prev.map(m => m.id === id ? { ...m, status: 'cancelled', cancellationReason: reason } : m));
            await addNotification('admin', 'alert', 'Annulation Prestataire', `Motif : ${reason}`, undefined, `mission:${id}`);
        }
    };

    const cancelMissionByClient = async (id: string) => {
        const m = missions.find(m => m.id === id);
        if (m) {
            const isLate = !canCancelMission(m);
            const { error } = await supabase.from('missions').update({ status: 'cancelled', cancellation_reason: 'Annulé par client', late_cancellation: isLate }).eq('id', id);
            if (!error) {
                setMissions(prev => prev.map(mission => mission.id === id ? { ...mission, status: 'cancelled', cancellationReason: 'Annulé par client', lateCancellation: isLate } : mission));
                await addNotification('admin', 'alert', 'Annulation Client', `Client: ${m.clientName}`, undefined, `mission:${id}`);
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
        const { error } = await supabase.from('missions').update({ provider_id: providerId, provider_name: providerName, status: 'planned', color: 'orange' }).eq('id', missionId);
        
        if (!error) {
            setMissions(prev => prev.map(m => m.id === missionId ? { ...m, providerId, providerName, status: 'planned', color: 'orange' } : m));
            await addNotification('provider', 'info', 'Nouvelle Mission', `Vous avez été assigné à une mission.`, providerId);
        }
    };

    const addClient = async (clientData: CreateClientDTO) => {
        const password = Math.random().toString(36).slice(-8);

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

        const { data, error } = await supabase.from('clients').insert(dbClientData).select();
        
        if (error) throw error;

        if (data && data.length > 0) {
            const newClient = data[0];
            setClients(prev => [...prev, {
                ...newClient,
                packsConsumed: newClient.packs_consumed,
                loyaltyHoursAvailable: newClient.loyalty_hours_available,
                hasLeftReview: newClient.has_left_review,
                initialPassword: password 
            }]);
            
            alert(`[SIMULATION EMAIL ENVOYÉ À ${clientData.email}]\n\n"Bonjour, votre compte est créé.\nLogin: ${clientData.email}\nPass: ${password}\nLien: https://presta-antilles.app/login"`);
        }
    };

    const updateClient = async (id: string, data: Partial<Client>) => {
        const dbData: any = {};
        if(data.name) dbData.name = data.name;
        if(data.city) dbData.city = data.city;
        if(data.address) dbData.address = data.address;
        if(data.phone) dbData.phone = data.phone;
        if(data.email) dbData.email = data.email;
        
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
        if(!error) setClients(prev => prev.map(c => c.id === clientId ? { ...c, hasLeftReview: true } : c));
        await supabase.from('reviews').insert({ clientId, rating, comment, date: new Date().toISOString() });
    };

    const addProvider = async (providerData: CreateProviderDTO) => {
        const password = Math.random().toString(36).slice(-8);

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

        const { data, error } = await supabase.from('providers').insert(dbProviderData).select();
        
        if (error) { console.error(error); return; }

        if (data) {
             const newProvider = data[0];
             setProviders(prev => [...prev, {
                 ...newProvider,
                 firstName: newProvider.first_name,
                 lastName: newProvider.last_name,
                 hoursWorked: newProvider.hours_worked,
                 leaves: [],
                 initialPassword: password 
             }]);

             await addNotification('admin', 'success', 'Prestataire Créé', `Email envoyé à ${providerData.email}`);
             
             alert(`[SIMULATION EMAIL ENVOYÉ À ${providerData.email}]\n\n"Bonjour ${providerData.firstName},\nVotre compte prestataire est actif.\nLogin: ${providerData.email}\nPass: ${password}\nLien: https://presta-antilles.app/login"`);
        }
    };

    const updateProvider = async (id: string, data: Partial<Provider>) => {
        const dbData: any = {};
        if(data.firstName) dbData.first_name = data.firstName;
        if(data.lastName) dbData.last_name = data.lastName;
        if(data.phone) dbData.phone = data.phone;
        if(data.email) dbData.email = data.email;
        if(data.specialty) dbData.specialty = data.specialty;
        if(data.status) dbData.status = data.status;

        const { error } = await supabase.from('providers').update(dbData).eq('id', id);
        if(!error) {
            setProviders(prev => prev.map(p => p.id === id ? { ...p, ...data } : p));
        }
    };

    const deleteProviders = async (ids: string[]) => {
        const { error } = await supabase.from('providers').delete().in('id', ids);
        if (!error) {
            setProviders(prev => prev.filter(p => !ids.includes(p.id)));
        }
    };

    const addLeave = async (providerId: string, start: string, end: string) => {
        const { data } = await supabase.from('leaves').insert({
            providerId, startDate: start, endDate: end, status: 'pending'
        }).select();

        if (data) {
            setProviders(prev => prev.map(p => {
                if (p.id === providerId) {
                    return { ...p, leaves: [...p.leaves, data[0]] };
                }
                return p;
            }));
        }
    };

    const updateLeaveStatus = async (leaveId: string, providerId: string, status: 'approved' | 'rejected') => {
        const { error } = await supabase.from('leaves').update({ status }).eq('id', leaveId);
        if (!error) {
            setProviders(prev => prev.map(p => {
                if(p.id === providerId) {
                    const updatedLeaves = p.leaves.map(l => l.id === leaveId ? { ...l, status } : l);
                    return { ...p, leaves: updatedLeaves };
                }
                return p;
            }));
        }
    };

    const resetProviderPassword = async (id: string) => {
        const provider = providers.find(p => p.id === id);
        if(provider) {
            const newPass = Math.random().toString(36).slice(-8);
            setProviders(prev => prev.map(p => p.id === id ? { ...p, initialPassword: newPass } : p));
            alert(`[SIMULATION EMAIL]\nNouveau mot de passe envoyé à ${provider.email} : ${newPass}`);
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
            reminder_sent: false
        };

        const { data, error } = await supabase.from('documents').insert(dbDocData).select();
        
        if (error) {
            console.error("Error creating document", error);
            return;
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
        }
    };

    const updateDocumentStatus = async (id: string, status: string) => {
        const { error } = await supabase.from('documents').update({ status }).eq('id', id);
        if (!error) setDocuments(prev => prev.map(d => d.id === id ? { ...d, status: status as any } : d));
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
            const { id: _, ...rest } = doc;
            const newDoc: Document = { 
                ...rest, 
                id: `temp-${Date.now()}`,
                ref: `${doc.ref}-COPY`, 
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
                id: `temp-inv-${Date.now()}`,
                ref: quote.ref.replace('DEV', 'FAC'),
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
        if(!error) setDocuments(prev => prev.map(d => d.id === id ? { ...d, reminderSent: true } : d));
    };

    const signQuoteWithData = async (id: string, signatureData: string) => {
        const { error } = await supabase.from('documents').update({ status: 'signed', signature_data: signatureData, signature_date: new Date().toISOString() }).eq('id', id);
        if(!error) {
            setDocuments(prev => prev.map(d => d.id === id ? { ...d, status: 'signed', signatureData, signatureDate: new Date().toISOString() } : d));
            await addNotification('admin', 'success', 'Devis Signé', `Devis signé par client.`);
        }
    };

    const refuseQuote = async (id: string) => {
        await updateDocumentStatus(id, 'rejected');
        await addNotification('admin', 'alert', 'Devis Refusé', `Devis refusé par client.`);
    };

    const requestInvoice = async (docId: string) => {
        await addNotification('admin', 'info', 'Demande Facture', `Client demande facture pour document ${docId}`);
    };

    const refundTransaction = async (ref: string, amount: number) => {
        const doc = documents.find(d => d.ref === ref);
        if(doc) {
            const refundDoc: Document = {
                id: `refund-${Date.now()}`,
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
            await addNotification('client', 'info', 'Remboursement', `Avoir de ${amount}€ émis.`, doc.clientId);
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
        
        if (error) {
             alert(`Erreur de sauvegarde: ${error.message}`);
             return;
        }

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
        }
    };

    const deletePacks = async (ids: string[]) => {
        const { error } = await supabase.from('packs').delete().in('id', ids);
        if (!error) {
            setPacks(prev => prev.filter(p => !ids.includes(p.id)));
        }
    };

    const addContract = async (contract: Contract) => {
        const finalId = generateUUID();
        const packId = contract.packId === "" ? null : contract.packId;

        const dbData = {
            id: finalId,
            name: contract.name,
            content: contract.content,
            pack_id: packId,
            status: contract.status,
            is_sap: contract.isSap,
            validation_date: contract.validationDate
        };

        const { data, error } = await supabase.from('contracts').insert(dbData).select();
        
        if (error) {
            alert("Erreur lors de la sauvegarde du contrat: " + error.message);
            return;
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
        if (updates.validationDate) { dbUpdates.validation_date = updates.validationDate; delete dbUpdates.validationDate; }
        if (updates.isSap !== undefined) { dbUpdates.is_sap = updates.isSap; delete updates.isSap; }
        
        const { error } = await supabase.from('contracts').update(dbUpdates).eq('id', id);
        if (!error) setContracts(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
    };

    const addReminder = async (reminder: Reminder) => {
        const { id, ...rData } = reminder;
        const dbData = { ...rData, notify_email: rData.notifyEmail };
        const { data } = await supabase.from('reminders').insert(dbData).select();
        if (data) {
            setReminders(prev => [...prev, { ...data[0], notifyEmail: data[0].notify_email }]);
        }
    };

    const toggleReminder = async (id: string) => {
        const r = reminders.find(i => i.id === id);
        if (r) {
            const { error } = await supabase.from('reminders').update({ completed: !r.completed }).eq('id', id);
            if(!error) setReminders(prev => prev.map(x => x.id === id ? { ...x, completed: !x.completed } : x));
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
        
        if (error) {
            alert("Erreur sauvegarde dépense: " + error.message);
            return;
        }

        if (data) {
             setExpenses(prev => [...prev, { ...data[0], proofUrl: data[0].proof_url }]);
        }
    };

    const replyToClient = async (text: string, clientId: string) => {
        const dbData = { sender: 'admin', text, client_id: clientId, date: new Date().toLocaleTimeString(), read: false };
        const { data } = await supabase.from('messages').insert(dbData).select();
        if(data) {
            setMessages(prev => [...prev, { ...data[0], clientId: data[0].client_id }]);
        }
    };

    const sendClientMessage = async (text: string, clientId: string) => {
        const dbData = { sender: 'client', text, client_id: clientId, date: new Date().toLocaleTimeString(), read: false };
        const { data } = await supabase.from('messages').insert(dbData).select();
        if (data) {
            setMessages(prev => [...prev, { ...data[0], clientId: data[0].client_id }]);
            await addNotification('admin', 'message', 'Nouveau Message', `De client: ${text.substring(0, 20)}...`);
        }
    };

    const addNotification = async (targetUserType: 'admin' | 'client' | 'provider', type: 'info' | 'alert' | 'success' | 'message', title: string, message: string, targetUserId?: string, link?: string) => {
        const { data } = await supabase.from('notifications').insert({
            targetUserType, 
            targetUserId: targetUserId || null,
            type, 
            title, 
            message, 
            date: new Date().toLocaleTimeString(), 
            read: false, 
            link
        }).select();
        
        if (data) {
            setNotifications(prev => [data[0] as AppNotification, ...prev]);
        }
    };

    const markNotificationRead = async (id: string) => {
        const { error } = await supabase.from('notifications').update({ read: true }).eq('id', id);
        if (!error) setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    };

    const login = async (email: string, password?: string): Promise<boolean> => {
        if (!password) return false;

        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (error) throw new Error(error.message);
        
        if (data.user) {
            await fetchUserProfile(data.user);
            await refreshData();
            return true;
        }
        return false;
    };

    const logout = async () => {
        localStorage.removeItem('presta_current_user');
        localStorage.clear(); 
        
        setCurrentUser(null);
        setSimulatedClientId(null);
        setSimulatedProviderId(null);
        setMissions([]);
        setClients([]);
        setProviders([]);
        setDocuments([]);
        
        try {
            if (isSupabaseConfigured) {
                await supabase.auth.signOut();
            }
        } catch (e) {
            console.warn("Logout network request failed (ignoring):", e);
        }
        
        window.location.reload();
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
            const onLeave = provider.leaves.some(l => {
                return date >= l.startDate && date <= l.endDate;
            });
            if(onLeave) return;

            const providerMissions = missions.filter(m => m.providerId === provider.id && m.date === date && m.status !== 'cancelled');

            potentialTimes.forEach(slot => {
                 const isTaken = providerMissions.some(m => {
                     return (slot.start < m.endTime && slot.end > m.startTime);
                 });
                 
                 if (!isTaken) {
                     let score = 70;
                     if(provider.rating >= 4.5) score += 20;
                     if(provider.hoursWorked < 100) score += 10;

                     available.push({
                         time: `${slot.start} - ${slot.end}`,
                         provider: `${provider.firstName} ${provider.lastName}`,
                         score: Math.min(score, 100),
                         reason: 'Disponible'
                     });
                 }
            });
        });
        
        return available.sort((a,b) => b.score - a.score).slice(0, 5);
    };

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
            expenses, addExpense,
            messages, replyToClient, sendClientMessage,
            notifications, markNotificationRead,
            currentUser, login, logout,
            simulatedClientId, setSimulatedClientId,
            simulatedProviderId, setSimulatedProviderId,
            activeStream, startLiveStream, stopLiveStream,
            isOnline, pendingSyncCount, loading,
            getAvailableSlots, refreshData
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