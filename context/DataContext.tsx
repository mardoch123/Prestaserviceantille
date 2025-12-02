

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { 
    Provider, Mission, Pack, Contract, Reminder, Document, Client, 
    AppNotification, Message, User, StreamSession, Expense, CompanySettings,
    CreateMissionDTO, CreateClientDTO, CreateProviderDTO
} from '../types';
import { supabase } from '../utils/supabaseClient';

// --- Assets ---
export const LOGO_NORMAL = "https://via.placeholder.com/150"; 
export const LOGO_SAP = "https://via.placeholder.com/100?text=SAP";
export const CACHET_SIGNATURE = "https://via.placeholder.com/150?text=Cachet";

// Helper for UUID generation if crypto is not available or for simple usage
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
    deleteMissions: (ids: string[]) => Promise<void>; // BULK DELETE

    clients: Client[];
    addClient: (client: CreateClientDTO) => Promise<void>;
    deleteClients: (ids: string[]) => Promise<void>; // BULK DELETE
    addLoyaltyHours: (clientId: string, hours: number) => Promise<void>;
    submitClientReview: (clientId: string, rating: number, comment: string) => Promise<void>;

    providers: Provider[];
    addProvider: (provider: CreateProviderDTO) => Promise<void>;
    deleteProviders: (ids: string[]) => Promise<void>; // BULK DELETE
    addLeave: (providerId: string, start: string, end: string) => Promise<void>;

    documents: Document[];
    addDocument: (doc: Document) => Promise<void>;
    updateDocumentStatus: (id: string, status: string) => Promise<void>;
    deleteDocument: (id: string) => Promise<void>;
    deleteDocuments: (ids: string[]) => Promise<void>; // BULK DELETE
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
    deletePacks: (ids: string[]) => Promise<void>; // BULK DELETE

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

    // TEMPLATE CONFORME AU PDF (Page 1, 2, 3)
    const legalTemplate = `PRESTA SERVICES ANTILLES – SASU
Siège : 31 Résidence L’Autre Bord – 97220 La Trinité
N° SAP : SAP944789700
Email : prestaservicesantilles.rh@gmail.com
Assurance RCP : Contrat n° RCP250714175810 – Assurup (Hiscox)
Validité : 01/08/2025 -> 31/07/2026 – Plafond : 100 000 € – Monde entier (hors USA/Canada)

CONTRAT DE PRESTATION DE SERVICE (SAP)

1. INFORMATIONS DU CLIENT
[INFO_CLIENT]

2. INFORMATIONS DU PACK
[INFO_PACK]

--------------------------------------------------------------
CONDITIONS GÉNÉRALES & OBLIGATIONS

Article 1 – Obligations du Prestataire
Le Prestataire exécute les Prestations avec diligence et professionnalisme, selon les règles de l’art et dans le respect des normes d’hygiène et de sécurité applicables. Il affecte des intervenants compétents et placés sous encadrement. Les Prestations demeurent limitées au périmètre éligible au SAP.

Article 9 – Obligations du Client
Le Client assure l’accès au domicile aux dates et créneaux convenus, fournit les informations utiles et met à disposition un environnement conforme (électricité, eau, accès sécurisé). Il respecte les modalités de paiement et veille au maintien en place et à la lisibilité du QR code.

Article 10 – Responsabilité
Le Prestataire n’est pas responsable (i) des retards résultant d’un manquement du Client, notamment en cas d’accès impossible ou d’absence de QR code, ni (ii) des dommages, défauts ou dysfonctionnements antérieurs à l’intervention. Sa responsabilité est limitée aux dommages directs, certains et prouvés, dans la limite des plafonds de ses assurances.

Article 11 – Protection des données (RGPD)
Données traitées : identité et coordonnées, adresse d’intervention, consignes d’accès, données de pointage. Base légale : exécution du Contrat. Durées de conservation : pendant le Contrat puis selon les délais légaux. Droits du Client : accès, rectification, effacement, limitation, opposition et portabilité (contact : prestaservicesantilles.rh@gmail.com).

Article 12 – Résiliation
12.1. Avec préavis : chaque Partie peut résilier le Contrat à tout moment, sous réserve d’un préavis de 30 jours notifié par lettre recommandée avec accusé de réception.
12.2. Pour manquement : en cas de manquement grave non corrigé dans un délai de 8 jours à compter d’une mise en demeure écrite, le Contrat pourra être résilié de plein droit.
12.3. Effets : les sommes dues au titre des prestations réalisées jusqu’à la date d’effet de la résiliation restent exigibles.

Article 13 – Droit de rétractation (consommateur)
En cas de conclusion à distance, le Client dispose d’un délai de 14 jours pour se rétracter. L’exécution avant la fin de ce délai nécessite accord exprès.

Article 14 – Cas Particuliers & Annulation (Règles spécifiques)
- Si l’annulation est faite moins de 48 h avant l’intervention, la mission est considérée comme réalisée et facturée à 50% du montant (Hors SAP, sans avance immédiate).
- Le créneau devient disponible pour une nouvelle mission.
- Une notification de rappel est envoyée 48h avant l'intervention (email).

Dispositions diverses : La nullité d’une clause n’affecte pas la validité du reste du Contrat.
Validation : Ce contrat doit être validé par l'administrateur avant mise en service.

Fait à La Trinité, le [DATE]
`;

    // --- DATA FETCHING ---
    const refreshData = async () => {
        try {
            setLoading(true);
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
                supabase.from('company_settings').select('*').single()
            ]);

            if (cData) {
                const mappedClients = cData.map((c: any) => ({
                    ...c,
                    packsConsumed: c.packs_consumed || 0,
                    loyaltyHoursAvailable: c.loyalty_hours_available || 0,
                    hasLeftReview: c.has_left_review
                }));
                setClients(mappedClients);
            }
            
            const { data: leavesData } = await supabase.from('leaves').select('*');
            if (pData) {
                const mappedProviders = pData.map((p: any) => ({
                    ...p,
                    firstName: p.first_name || p.firstName,
                    lastName: p.last_name || p.lastName,
                    hoursWorked: p.hours_worked || p.hoursWorked,
                    leaves: leavesData ? leavesData.filter((l: any) => l.providerId === p.id) : []
                }));
                setProviders(mappedProviders);
            }

            if (mData) {
                const mappedMissions = mData.map((m: any) => ({
                    ...m,
                    dayIndex: m.day_index || m.dayIndex,
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
                }));
                setMissions(mappedMissions);
            }
            if (dData) {
                const mappedDocs = dData.map((d: any) => ({
                    ...d,
                    clientId: d.client_id || d.clientId,
                    clientName: d.client_name || d.clientName,
                    unitPrice: d.unit_price || d.unitPrice,
                    tvaRate: d.tva_rate || d.tvaRate,
                    totalHT: d.total_ht || d.totalHT,
                    totalTTC: d.total_ttc || d.totalTTC,
                    taxCreditEnabled: d.tax_credit_enabled || d.taxCreditEnabled
                }));
                setDocuments(mappedDocs);
            }
            if (packData) {
                const mappedPacks = packData.map((p: any) => {
                    // Extract quantity and location from description if available
                    // Format used in saving: "... | Quantité: ... | Lieu: ..."
                    const desc = p.description || '';
                    const quantityMatch = desc.match(/Quantité: (.*?)(\||$)/);
                    const locationMatch = desc.match(/Lieu: (.*?)(\||$)/);
                    
                    // Map DB enum (lowercase) back to UI (Capitalized)
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
                });
                setPacks(mappedPacks);
            }
            if (ctData) {
                 const mappedContracts = ctData.map((c: any) => ({
                    ...c,
                    packId: c.pack_id || c.packId,
                    isSap: c.is_sap || c.isSap,
                    validationDate: c.validation_date || c.validationDate
                 }));
                 setContracts(mappedContracts);
            }
            if (rData) {
                const mappedReminders = rData.map((r: any) => ({
                    ...r,
                    notifyEmail: r.notify_email || r.notifyEmail
                }));
                setReminders(mappedReminders);
            }
            if (eData) {
                const mappedExpenses = eData.map((e: any) => ({
                    ...e,
                    proofUrl: e.proof_url || e.proofUrl
                }));
                setExpenses(mappedExpenses);
            }
            if (msgData) {
                const mappedMessages = msgData.map((m: any) => ({
                    ...m,
                    clientId: m.client_id || m.clientId
                }));
                setMessages(mappedMessages);
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

        } catch (error) {
            console.error("Erreur lors du chargement des données:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        refreshData();
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (session?.user) {
                 const { data: profile } = await supabase.from('users').select('*').eq('id', session.user.id).single();
                 setCurrentUser({
                     id: session.user.id,
                     email: session.user.email || '',
                     name: profile?.name || session.user.email?.split('@')[0] || 'Utilisateur',
                     role: profile?.role || 'admin',
                     relatedEntityId: profile?.relatedEntityId
                 });
            } else {
                setCurrentUser(null);
            }
        });
        return () => subscription.unsubscribe();
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
            const { error } = await supabase
                .from('company_settings')
                .update(dbData)
                .eq('name', companySettings.name); 

            if (error) throw error;
            setCompanySettings(settings);
        } catch (err) {
            console.error("Erreur sauvegarde settings:", err);
            throw err;
        }
    };

    // MISSIONS
    const addMission = async (mission: Mission) => {
        const { id, ...missionData } = mission;
        
        const dbMissionData = {
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
            source: missionData.source,
            day_index: missionData.dayIndex
        };

        const { data, error } = await supabase.from('missions').insert(dbMissionData).select();
        
        if (error) { console.error("Erreur ajout mission:", error); return; }
        if (data) {
             const newMission = data[0];
             const mappedMission: Mission = {
                ...newMission,
                dayIndex: newMission.day_index,
                startTime: newMission.start_time,
                endTime: newMission.end_time,
                clientId: newMission.client_id,
                clientName: newMission.client_name,
                providerId: newMission.provider_id,
                providerName: newMission.provider_name
             };
            setMissions(prev => [...prev, mappedMission]);
            addNotification('admin', 'info', 'Nouvelle Mission', `Mission planifiée pour ${mission.clientName} le ${mission.date}`);
        }
    };

    const deleteMissions = async (ids: string[]) => {
        const { error } = await supabase.from('missions').delete().in('id', ids);
        if (!error) {
            setMissions(prev => prev.filter(m => !ids.includes(m.id)));
        } else {
            console.error("Erreur suppression missions:", error);
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
                addNotification('admin', 'success', 'Mission terminée', `Mission chez ${m.clientName} terminée`, undefined, `mission:${id}`);
            }
        }
    };

    const cancelMissionByProvider = async (id: string, reason: string) => {
        const { error } = await supabase.from('missions').update({ status: 'cancelled', cancellation_reason: reason }).eq('id', id);
        if (!error) {
            setMissions(prev => prev.map(m => m.id === id ? { ...m, status: 'cancelled', cancellationReason: reason } : m));
            addNotification('admin', 'alert', 'Annulation Prestataire', `Motif : ${reason}`, undefined, `mission:${id}`);
        }
    };

    const cancelMissionByClient = async (id: string) => {
        const m = missions.find(m => m.id === id);
        if (m) {
            const isLate = !canCancelMission(m);
            const { error } = await supabase.from('missions').update({ status: 'cancelled', cancellation_reason: 'Annulé par client', late_cancellation: isLate }).eq('id', id);
            if (!error) {
                setMissions(prev => prev.map(mission => mission.id === id ? { ...mission, status: 'cancelled', cancellationReason: 'Annulé par client', lateCancellation: isLate } : mission));
                addNotification('admin', 'alert', 'Annulation Client', `Client: ${m.clientName}`, undefined, `mission:${id}`);
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
        }
    };

    // CLIENTS
    const addClient = async (clientData: CreateClientDTO) => {
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
        
        if (error) {
            console.error("Erreur ajout client:", error);
            throw error;
        }

        if (data && data.length > 0) {
            const newClient = data[0];
            const mappedClient: Client = {
                ...newClient,
                packsConsumed: newClient.packs_consumed,
                loyaltyHoursAvailable: newClient.loyalty_hours_available,
                hasLeftReview: newClient.has_left_review
            };
            setClients(prev => [...prev, mappedClient]);
        }
    };

    const deleteClients = async (ids: string[]) => {
        const { error } = await supabase.from('clients').delete().in('id', ids);
        if (!error) {
            setClients(prev => prev.filter(c => !ids.includes(c.id)));
        } else {
             console.error("Erreur suppression clients:", error);
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

    // PROVIDERS
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
             const mapped: Provider = {
                 ...newProvider,
                 firstName: newProvider.first_name,
                 lastName: newProvider.last_name,
                 hoursWorked: newProvider.hours_worked,
                 leaves: []
             };
             setProviders(prev => [...prev, mapped]);

             addNotification('admin', 'success', 'Prestataire Créé', `Email envoyé à ${providerData.email} avec ID et MDP.`);
             
             setTimeout(() => {
                alert(`[SIMULATION EMAIL]
------------------------------------------------
À: ${providerData.email}
Objet: Vos accès Prestataire - Presta Services Antilles

Bonjour ${providerData.firstName},

Votre compte prestataire a été créé. Vous pouvez désormais accéder à votre espace de gestion.

Lien de connexion : https://presta-antilles.app/login
Identifiant : ${providerData.email}
Mot de passe : ${password}

Cordialement,
L'équipe Presta Services Antilles`);
             }, 500);
        }
    };

    const deleteProviders = async (ids: string[]) => {
        const { error } = await supabase.from('providers').delete().in('id', ids);
        if (!error) {
            setProviders(prev => prev.filter(p => !ids.includes(p.id)));
        } else {
            console.error("Erreur suppression prestataires:", error);
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

    // DOCUMENTS
    const addDocument = async (doc: Document) => {
        const { id, ...docData } = doc;
        const dbDocData = {
            ref: docData.ref,
            client_id: docData.clientId,
            client_name: docData.clientName,
            date: docData.date,
            type: docData.type,
            category: docData.category,
            description: docData.description,
            unit_price: docData.unitPrice,
            quantity: docData.quantity,
            tva_rate: docData.tvaRate,
            total_ht: docData.totalHT,
            total_ttc: docData.totalTTC,
            tax_credit_enabled: docData.taxCreditEnabled,
            status: docData.status,
            slotsData: docData.slotsData
        };

        const { data } = await supabase.from('documents').insert(dbDocData).select();
        if (data) {
             const newDoc = data[0];
             const mappedDoc: Document = {
                 ...newDoc,
                 clientId: newDoc.client_id,
                 clientName: newDoc.client_name,
                 unitPrice: newDoc.unit_price,
                 tvaRate: newDoc.tva_rate,
                 totalHT: newDoc.total_ht,
                 totalTTC: newDoc.total_ttc,
                 taxCreditEnabled: newDoc.tax_credit_enabled
             };
             setDocuments(prev => [...prev, mappedDoc]);
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
        } else {
             console.error("Erreur suppression documents:", error);
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
        const { error } = await supabase.from('documents').update({ reminderSent: true }).eq('id', id);
        if(!error) setDocuments(prev => prev.map(d => d.id === id ? { ...d, reminderSent: true } : d));
    };

    const signQuoteWithData = async (id: string, signatureData: string) => {
        const { error } = await supabase.from('documents').update({ status: 'signed', signatureData, signatureDate: new Date().toISOString() }).eq('id', id);
        if(!error) {
            setDocuments(prev => prev.map(d => d.id === id ? { ...d, status: 'signed', signatureData, signatureDate: new Date().toISOString() } : d));
            addNotification('admin', 'success', 'Devis Signé', `Devis signé par client.`);
        }
    };

    const refuseQuote = async (id: string) => {
        await updateDocumentStatus(id, 'rejected');
        addNotification('admin', 'alert', 'Devis Refusé', `Devis refusé par client.`);
    };

    const requestInvoice = async (docId: string) => {
        addNotification('admin', 'info', 'Demande Facture', `Client demande facture pour document ${docId}`);
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
            addNotification('client', 'info', 'Remboursement', `Avoir de ${amount}€ émis.`, doc.clientId);
        }
    };

    // PACKS
    const addPack = async (pack: Pack) => {
        // Generate UUID if not present or if it's a temp ID
        const finalId = (pack.id && pack.id.length > 10 && !pack.id.startsWith('p-')) ? pack.id : generateUUID();
        
        // Merge quantity and location into description so they persist in DB text field
        const mergedDescription = `${pack.description}\n| Quantité: ${pack.quantity || 'Standard'} | Lieu: ${pack.location || 'Domicile Client'}`;

        // Ensure frequency is lowercase to match enum defined in DB (ponctuelle, hebdomadaire, etc)
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
             console.error("Erreur sauvegarde Pack:", error);
             alert(`Erreur de sauvegarde base de données: ${error.message}`);
             return;
        }

        if (data) {
             const newPack = data[0];
             const mappedPack: Pack = {
                 ...newPack,
                 mainService: newPack.main_service,
                 priceHT: newPack.price_ht,
                 priceTaxCredit: newPack.price_tax_credit,
                 suppliesIncluded: newPack.supplies_included,
                 suppliesDetails: newPack.supplies_details,
                 isSap: newPack.is_sap,
                 contractType: newPack.contract_type,
                 // Restore from passed state for immediate UI feedback (or parse description)
                 quantity: pack.quantity,
                 location: pack.location,
                 // Capitalize for UI
                 frequency: capitalize(newPack.frequency) as any
             };
             setPacks(prev => [...prev, mappedPack]);
        }
    };

    const deletePacks = async (ids: string[]) => {
        const { error } = await supabase.from('packs').delete().in('id', ids);
        if (!error) {
            setPacks(prev => prev.filter(p => !ids.includes(p.id)));
        } else {
             console.error("Erreur suppression packs:", error);
        }
    };

    const addContract = async (contract: Contract) => {
        const { id, ...cData } = contract;
        // Map camelCase to snake_case if needed, but assuming table is consistent or mapper is handling read
        const dbData = {
            name: cData.name,
            content: cData.content,
            pack_id: cData.packId,
            status: cData.status,
            is_sap: cData.isSap,
            validation_date: cData.validationDate
        };
        const { data } = await supabase.from('contracts').insert(dbData).select();
        if (data) {
             const mapped = {
                ...data[0],
                packId: data[0].pack_id,
                isSap: data[0].is_sap,
                validationDate: data[0].validation_date
             };
             setContracts(prev => [...prev, mapped]);
        }
    };

    const updateContract = async (id: string, updates: Partial<Contract>) => {
        const dbUpdates: any = { ...updates };
        if (updates.packId) { dbUpdates.pack_id = updates.packId; delete dbUpdates.packId; }
        if (updates.validationDate) { dbUpdates.validation_date = updates.validationDate; delete dbUpdates.validationDate; }
        
        const { error } = await supabase.from('contracts').update(dbUpdates).eq('id', id);
        if (!error) setContracts(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
    };

    const addReminder = async (reminder: Reminder) => {
        const { id, ...rData } = reminder;
        const dbData = { ...rData, notify_email: rData.notifyEmail };
        const { data } = await supabase.from('reminders').insert(dbData).select();
        if (data) {
            const mapped = { ...data[0], notifyEmail: data[0].notify_email };
            setReminders(prev => [...prev, mapped]);
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
        const dbData = { ...eData, proof_url: eData.proofUrl };
        const { data } = await supabase.from('expenses').insert(dbData).select();
        if (data) {
             const mapped = { ...data[0], proofUrl: data[0].proof_url };
             setExpenses(prev => [...prev, mapped]);
        }
    };

    const replyToClient = async (text: string, clientId: string) => {
        const dbData = { sender: 'admin', text, client_id: clientId, date: new Date().toLocaleTimeString(), read: false };
        const { data } = await supabase.from('messages').insert(dbData).select();
        if(data) {
            const mapped = { ...data[0], clientId: data[0].client_id };
            setMessages(prev => [...prev, mapped]);
        }
    };

    const sendClientMessage = async (text: string, clientId: string) => {
        const dbData = { sender: 'client', text, client_id: clientId, date: new Date().toLocaleTimeString(), read: false };
        const { data } = await supabase.from('messages').insert(dbData).select();
        
        if (data) {
            const mapped = { ...data[0], clientId: data[0].client_id };
            setMessages(prev => [...prev, mapped]);
            addNotification('admin', 'message', 'Nouveau Message', `De client: ${text.substring(0, 20)}...`);
        }
    };

    const addNotification = async (targetUserType: 'admin' | 'client' | 'provider', type: 'info' | 'alert' | 'success' | 'message', title: string, message: string, targetUserId?: string, link?: string) => {
        const { data } = await supabase.from('notifications').insert({
            targetUserType, targetUserId, type, title, message, date: new Date().toLocaleTimeString(), read: false, link
        }).select();
        if (data) setNotifications(prev => [data[0] as AppNotification, ...prev]);
    };

    const markNotificationRead = async (id: string) => {
        const { error } = await supabase.from('notifications').update({ read: true }).eq('id', id);
        if (!error) setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    };

    const login = async (email: string, password?: string): Promise<boolean> => {
        if (!password) {
            console.error("Password required");
            return false;
        }

        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (error) {
            console.error("Login failed:", error.message);
            return false;
        }
        return true;
    };

    const logout = async () => {
        await supabase.auth.signOut();
        setCurrentUser(null);
        setSimulatedClientId(null);
        setSimulatedProviderId(null);
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
            clients, addClient, deleteClients, addLoyaltyHours, submitClientReview,
            providers, addProvider, deleteProviders, addLeave,
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
            getAvailableSlots
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