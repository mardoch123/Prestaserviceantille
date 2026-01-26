import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
    PackagePlus,
    FileSignature,
    CalendarX,
    StickyNote,
    CheckCircle,
    Plus,
    Bell,
    Mail,
    ArrowRight,
    ArrowLeft,
    Check,
    FileText,
    Stamp,
    MessageSquare,
    User,
    Send,
    Search,
    Euro,
    Paperclip,
    Edit,
    AlertTriangle,
    ExternalLink,
    Trash2,
    CheckSquare,
    Square,
    Video,
    Wifi,
    Camera,
    Users,
    MapPin,
    Clock,
    SlidersHorizontal,
    XCircle,
    Download,
    X,
    Calendar,
    Filter,
    TrendingUp,
    ChevronLeft,
    ChevronRight,
    Save,
    HelpCircle
} from 'lucide-react';
import { useData, COMPANY_STAMP_URL, COMPANY_SIGNATURE_URL, LOGO_NORMAL, LOGO_SAP } from '../context/DataContext';
import { 
    getMartiniqueToday,
    getMartiniqueNowISO,
    formatMartiniqueDate,
    formatMartiniqueDateTime
} from '../src/utils/martiniqueTime';
import { ContractPDF } from './PDFComponents';
import { LOGO_BASE64, LOGO_SAP_BASE64, SIGNATURE_BASE64, STAMP_SIGNATURE_BASE64 } from '../src/assets/images';
import { pdf } from '@react-pdf/renderer';
import { downloadHtmlAsPdf } from '../utils/htmlPdf';
import type { Pack, Contract, Reminder, Message, Expense, Client, Provider, Mission, Document, StreamSession, VideoRecording } from '../types';
import { useNavigate, useLocation } from 'react-router-dom';
import LiveVideoManager from './LiveVideoManager';
import SearchableSelect from './SearchableSelect';
import { matchesServiceTypeFilterFromText } from '../utils/serviceTypes';

type Tab = 'packs' | 'absences' | 'agenda' | 'messaging' | 'expenses' | 'live-videos';

// Type for intervention schedules (compatible with existing ScheduleOption)
type InterventionSchedule = {
    day: string;
    startTime: string;
    endTime: string;
};

// Extended Pack type to include intervention schedules (different from existing schedules)
type PackWithSchedules = Pack & {
    interventionSchedules?: InterventionSchedule[]
};

// EXACT LIST FROM PDF OCR
const SAP_SERVICES = [
    "Entretien de la maison et travaux ménagers",
    "Repassage à domicile",
    "Préparation de repas à domicile",
    "Livraison de repas à domicile",
    "Jardinage",
    "Petit bricolage (homme toutes mains)",
    "Maintenance et vigilance temporaire de domicile (gardiennage)",
    "Assistance administrative à domicile",
    "Accompagnement des personnes âgées ou handicapées",
    "Aide à la mobilité / Transport accompagné",
    "Soins d'esthétique à domicile pour personnes dépendantes",
    "Soutien scolaire à domicile",
    "Cours à domicile (hors scolaire)",
    "Assistance informatique et numérique à domicile",
    "Assistance aux démarches en ligne",
    "Surveillance et garde d'enfants à domicile",
    "Conduite du véhicule personnel des personnes dépendantes",
    "Téléassistance et visio-assistance"
];

const CONTRACT_TYPES = [
    "Contrat Prestataire Standard",
    "Contrat Mandataire",
    "Contrat Ponctuel",
    "Avenant au contrat"
];

const Secretariat: React.FC = () => {
    const {
        packs,
        addPack,
        updatePack,
        deletePacks,
        providers,
        reminders,
        addReminder,
        toggleReminder,
        contracts,
        updateContract,
        addContract,
        messages,
        clients,
        replyToClient,
        expenses,
        addExpense,
        companySettings,
        missions,
        legalTemplate,
        updateLeaveStatus,
        updateExpense,
        requestContractValidation,
        validateContract,
        currentUser,
        documents,
        activeStream,
        startLiveStream,
        stopLiveStream,
        videoRecordings,
        getVideoRecordings,
        deleteContracts,
        genericContracts,
        generateContractFromTemplate,
        serviceTypeFilter,
        markClientMessagesRead
    } = useData();

    const [activeTab, setActiveTab] = useState<Tab>('packs');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalType, setModalType] = useState<'pack' | 'contract' | 'reminder' | 'expense'>('pack');
    const navigate = useNavigate();
    const location = useLocation();

    // Fonction pour calculer la durée totale d'un pack
    const calculatePackDuration = (pack: any) => {
        // Extraire le nombre de jours de la fréquence si disponible
        const frequency = pack.frequency || '';
        let days = 1; // Par défaut, 1 jour

        // D'abord, vérifier si la description contient un nombre de jours explicite
        if (pack.description && pack.description.includes('(')) {
            console.log('Description found:', pack.description);
            const daysMatch = pack.description.match(/\((\d+)\s*jours?\)/i);
            console.log('First regex match:', daysMatch);
            if (daysMatch) {
                days = parseInt(daysMatch[1]);
                console.log('Days from first regex:', days);
            } else {
                // Essayer une autre regex sans la parenthèse fermante
                const altDaysMatch = pack.description.match(/\((\d+)\s*jours?/i);
                console.log('Second regex match:', altDaysMatch);
                if (altDaysMatch) {
                    days = parseInt(altDaysMatch[1]);
                    console.log('Days from second regex:', days);
                } else {
                    // Essayer une regex encore plus simple
                    const simpleDaysMatch = pack.description.match(/(\d+)\s*jours?/i);
                    console.log('Simple regex match:', simpleDaysMatch);
                    if (simpleDaysMatch) {
                        days = parseInt(simpleDaysMatch[1]);
                        console.log('Days from simple regex:', days);
                    }
                }
            }
        }

        // Si aucun nombre trouvé dans la description, utiliser les valeurs par défaut selon la fréquence
        if (days === 1) {
            // Gérer les différents types de fréquence
            if (frequency.includes('Ultime 6')) {
                days = 1; // Pack Ultime 6 = 1 jour
            } else if (frequency.includes('Tranquility')) {
                days = frequency.includes('4j') ? 4 : 3; // Tranquility = 3 ou 4 jours
            } else if (frequency.toLowerCase() === 'regulier') {
                // Pour les packs réguliers, essayer d'extraire le nombre de jours de plusieurs sources
                // 1. D'abord vérifier le champ quantity
                if (pack.quantity) {
                    const quantityDays = parseInt(pack.quantity);
                    if (!isNaN(quantityDays) && quantityDays > 0) {
                        days = quantityDays;
                    }
                } else {
                    days = regularDaysCount || 1;
                }
            } else if (frequency === 'Hebdomadaire') {
                days = 1; // Hebdomadaire = 1 jour par semaine
            } else if (frequency === 'Bimensuelle') {
                days = 2; // Bimensuelle = 2 jours par mois
            } else if (frequency === 'Mensuelle') {
                days = 4; // Mensuelle = environ 4 jours par mois (moyenne)
            } else if (frequency === 'Ponctuelle') {
                days = 1; // Ponctuelle = 1 jour
            } else {
                // Chercher des motifs comme "3 jours", "4 jours", etc.
                const daysMatch = frequency.match(/(\d+)\s*jours?/i);
                if (daysMatch) {
                    days = parseInt(daysMatch[1]);
                }
            }
        }

        // Calculer la durée totale
        const totalHours = pack.hours * days;

        // Afficher toujours le total d'heures avec le détail
        return `${totalHours}h total (${pack.hours}h × ${days}j)`;
    };

    // --- EXPENSE FILTERS STATE ---
    const [expenseFilters, setExpenseFilters] = useState({
        startDate: '',
        endDate: '',
        category: '',
        minAmount: '',
        maxAmount: ''
    });

    // Delete Modal State
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

    // Custom Confirmation Modal
    const [confirmationModal, setConfirmationModal] = useState<{ open: boolean; title: string; message: string; onConfirm: () => void; }>({ open: false, title: '', message: '', onConfirm: () => { } });

    // Pack Details Modal State
    const [packDetailsModal, setPackDetailsModal] = useState<{ open: boolean; pack: Pack | null }>({ open: false, pack: null });

    // Contract Edit Modal State
    const [contractEditModalOpen, setContractEditModalOpen] = useState(false);
    const [editingContractContent, setEditingContractContent] = useState('');
    const [editingContractId, setEditingContractId] = useState<string | null>(null);

    const contractEditorRef = useRef<HTMLDivElement | null>(null);
    const [useRichContractEditor, setUseRichContractEditor] = useState(true);

    // Selection State for Packs
    const [selectedPackIds, setSelectedPackIds] = useState<Set<string>>(new Set());

    // Selection State for Contracts
    const [selectedContractIds, setSelectedContractIds] = useState<Set<string>>(new Set());

    // Toast
    const [toast, setToast] = useState<{ show: boolean; message: string; type?: 'success' | 'error' | 'warning' }>({ show: false, message: '', type: 'success' });

    const showToast = (message: string, type: 'success' | 'error' | 'warning' = 'success') => {
        setToast({ show: true, message, type });
        setTimeout(() => setToast({ show: false, message: '', type }), 3000);
    };

    // --- MESSAGING STATE ---
    const [selectedChatClientId, setSelectedChatClientId] = useState<string | null>(null);
    const [adminMessageInput, setAdminMessageInput] = useState('');
    const [chatClientSearch, setChatClientSearch] = useState('');
    const chatEndRef = useRef<HTMLDivElement>(null);
    const chatMessagesContainerRef = useRef<HTMLDivElement>(null);

    // Handle external redirects (e.g., from notifications)
    useEffect(() => {
        if (location.state) {
            const state = location.state as { tab?: string; clientId?: string };
            if (state.tab === 'messaging') {
                setActiveTab('messaging');
                if (state.clientId) {
                    setSelectedChatClientId(state.clientId);
                }
            } else if (state.tab === 'absences') {
                setActiveTab('absences');
            } else if (state.tab === 'live-videos') {
                setActiveTab('live-videos');
            }
        }
    }, [location]);

    // Scroll to bottom of chat
    useEffect(() => {
        if (activeTab === 'messaging' && selectedChatClientId) {
            markClientMessagesRead(selectedChatClientId);
            // Small timeout to ensure DOM is rendered
            setTimeout(() => {
                const container = chatMessagesContainerRef.current;
                if (container) {
                    container.scrollTop = container.scrollHeight;
                }
            }, 100);
        }
    }, [messages, selectedChatClientId, activeTab]);

    // --- PACK FORM STATE (UPDATED TO MATCH PDF PROCESS) ---
    const [packStep, setPackStep] = useState(1);
    const [packForm, setPackForm] = useState<Partial<PackWithSchedules>>({
        type: 'ponctuel',
        hours: 3,
        frequency: 'Ponctuelle', // Default per PDF
        priceHT: 0,
        suppliesIncluded: false,
        isSap: true,
        quantity: '',
        location: 'Domicile Client',
        contractType: 'Contrat Prestataire Standard',
        interventionSchedules: []
    });

    // Extra state for "Régulier" days count
    const [regularDaysCount, setRegularDaysCount] = useState(1);

    // Pack editing state
    const [editingPackId, setEditingPackId] = useState<string | null>(null);

    // --- CONTRACT EDIT STATE ---
    const [contractForm, setContractForm] = useState<Partial<Contract>>({ name: '', content: '' });

    // --- CONTRACT FILTERS STATE ---
    const [contractFilters, setContractFilters] = useState({
        status: 'all',
        isSap: 'all',
        search: ''
    });

    // Contract specific selectors for PDF Logic
    const [selectedClientIdForContract, setSelectedClientIdForContract] = useState<string>('');
    const [selectedPackIdForContract, setSelectedPackIdForContract] = useState<string>('');
    const [contractLogoType, setContractLogoType] = useState<'SAP' | 'Standard'>('SAP');

    // Reminder Form
    const [reminderForm, setReminderForm] = useState<Partial<Reminder>>({
        notifyEmail: false
    });

    // Expense Form
    const [expenseForm, setExpenseForm] = useState<Partial<Expense>>({
        id: '',
        category: 'fournitures',
        amount: 0,
        description: '',
        date: getMartiniqueToday()
    });

    const filteredExpenses = useMemo(() => {
        return expenses.filter(exp => {
            const date = new Date(exp.date);
            const start = expenseFilters.startDate ? new Date(expenseFilters.startDate) : null;
            const end = expenseFilters.endDate ? new Date(expenseFilters.endDate) : null;
            const amount = exp.amount;
            const min = expenseFilters.minAmount ? parseFloat(expenseFilters.minAmount) : 0;
            const max = expenseFilters.maxAmount ? parseFloat(expenseFilters.maxAmount) : Infinity;

            if (start && date < start) return false;
            if (end && date > end) return false;
            if (expenseFilters.category && exp.category !== expenseFilters.category) return false;
            if (amount < min) return false;
            if (amount <= max && max !== Infinity && amount > max) return false;

            return true;
        });
    }, [expenses, expenseFilters]);

    // Contract filtering logic
    const filteredContracts = useMemo(() => {
        const filtered = contracts.filter(contract => {
            // Filter by status
            if (contractFilters.status !== 'all' && contract.status !== contractFilters.status) {
                return false;
            }

            // Filter by SAP
            if (contractFilters.isSap !== 'all') {
                const isSap = contract.isSap === true;
                if (contractFilters.isSap === 'sap' && !isSap) return false;
                if (contractFilters.isSap === 'non-sap' && isSap) return false;
            }

            // Filter by search term
            if (contractFilters.search) {
                const searchLower = contractFilters.search.toLowerCase();
                const nameMatch = contract.name.toLowerCase().includes(searchLower);
                const contentMatch = contract.content.toLowerCase().includes(searchLower);
                if (!nameMatch && !contentMatch) return false;
            }

            return true;
        });
        const getSortTime = (c: Contract) => {
            const raw = c.generatedAt || c.createdAt || c.validatedAt || c.validationDate || c.signedAt || '';
            const t = new Date(raw).getTime();
            return Number.isFinite(t) ? t : 0;
        };

        return filtered
            .slice()
            .sort((a, b) => getSortTime(b) - getSortTime(a));
    }, [contracts, contractFilters]);

    const handleDownloadContractPDF = async (contract: Contract) => {
        try {
            // Récupérer les informations du client si disponible
            const client = clients.find(c => c.id === contract.clientId);
            
            // Récupérer la signature du client depuis les documents signés
            let clientSignature = null;
            if (contract.clientId) {
                const clientDocuments = documents.filter(doc =>
                    doc.clientId === contract.clientId &&
                    doc.type === 'Devis' &&
                    doc.status === 'signed' &&
                    doc.signatureData
                );

                if (clientDocuments.length > 0) {
                    // Prendre le document signé le plus récent
                    const latestSignedDoc = clientDocuments.sort((a, b) =>
                        new Date(b.signatureDate || '').getTime() - new Date(a.signatureDate || '').getTime()
                    )[0];

                    clientSignature = latestSignedDoc.signatureData || '';
                }
            }
            
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

            const getContractAmountFromContent = (content: string): number => {
                if (!content) return 0;
                const patterns = [
                    /total\s*[:\s]*(\d+(?:[\.,]\d+)?)\s*€?/gi,
                    /montant\s*total\s*[:\s]*(\d+(?:[\.,]\d+)?)\s*€?/gi,
                    /(\d+(?:[\.,]\d+)?)\s*€/g
                ];

                for (const pattern of patterns) {
                    const matches = content.match(pattern);
                    if (matches && matches.length > 0) {
                        const amountMatch = matches[0].match(/(\d+(?:[\.,]\d+)?)/);
                        if (amountMatch) {
                            return parseFloat(amountMatch[1].replace(',', '.'));
                        }
                    }
                }

                return 0;
            };

            const resolvedTvaRate = (() => {
                if (contract.quoteId) {
                    const linked = documents.find((d: any) => String(d?.id) === String(contract.quoteId));
                    const raw = (linked as any)?.tvaRate;
                    const n = typeof raw === 'number' ? raw : Number(raw);
                    if (Number.isFinite(n)) return n;
                }
                if (typeof (contract as any).isSap === 'boolean') return (contract as any).isSap ? 0 : 0;
                return 0;
            })();

            const logoBase64 = resolvedTvaRate === 0 ? await ensurePngDataUrl(LOGO_SAP_BASE64) : await ensurePngDataUrl(LOGO_BASE64);
            const companySignatureBase64 = await ensurePngDataUrl(SIGNATURE_BASE64);
            const companyStampBase64 = await ensurePngDataUrl(STAMP_SIGNATURE_BASE64);
            const clientSignatureBase64 = await ensurePngDataUrl(clientSignature);

            const linkedQuoteTotal = contract.quoteId
                ? (documents.find(d => d.id === contract.quoteId)?.totalTTC || 0)
                : 0;
            
            // Préparation des données pour le PDF
            const pdfData = {
                ref: contract.name || `Contrat_${contract.id}`,
                date: contract.createdAt || getMartiniqueNowISO(),
                duration: contract.duration || 'Durée définie dans les conditions',
                clientName: client?.name || 'Client',
                clientEmail: client?.email || '',
                clientPhone: client?.phone || '',
                clientSignature: clientSignatureBase64,
                companySignature: companySignatureBase64,
                companyStamp: companyStampBase64,
                tvaRate: resolvedTvaRate,
                logoBase64,
                content: contract.content || '',

                companySignatureUrl: COMPANY_SIGNATURE_URL,
                companyStampUrl: COMPANY_STAMP_URL,
                logoUrl: resolvedTvaRate === 0 ? LOGO_SAP : LOGO_NORMAL,
                total: linkedQuoteTotal || contract.amount || getContractAmountFromContent(contract.content || '') || 0,
                paymentTerms: contract.paymentTerms || 'Selon conditions générales de vente',
                object: contract.object || 'Contrat de services entre Presta Services Antilles et le client',
                services: contract.services || [
                    {
                        name: 'Service principal',
                        description: contract.object || 'Description des services à fournir'
                    }
                ]
            };

            const contractHtml = String(contract.content || '').trim();
            const looksLikeHtml = /<\s*html\b|<\s*body\b|<\s*div\b|<\s*h1\b|<\s*style\b/i.test(contractHtml);

            if (looksLikeHtml && contractHtml) {
                const logoNormalBase64 = await ensurePngDataUrl(LOGO_BASE64);
                const logoSapBase64 = await ensurePngDataUrl(LOGO_SAP_BASE64);
                const selectedLogoBase64 = resolvedTvaRate === 0 ? logoSapBase64 : logoNormalBase64;
                const sanitizeFilenamePart = (v: any) =>
                    String(v || '')
                        .replace(/[\\/:*?"<>|]/g, '_')
                        .replace(/\s+/g, ' ')
                        .trim();

                const clientNamePart = sanitizeFilenamePart(client?.name || 'Client');
                const contractNamePart = sanitizeFilenamePart(contract?.name || contract?.id || 'Contrat');
                const filename = `Contrat_${clientNamePart}_${contractNamePart}.pdf`;
                await downloadHtmlAsPdf({
                    html: contractHtml,
                    filename,
                    title: contract.name || `Contrat_${contract.id}`,
                    zoom: 0.92,
                    signatureImages: {
                        client: clientSignatureBase64 || null,
                        company: companySignatureBase64 || null,
                        companyStamp: companyStampBase64 || null
                    },
                    signatureDates: {
                        client: contract.signedAt || contract.createdAt || null,
                        company: contract.validatedAt || null
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
                alert('Contrat téléchargé avec succès.');
                return;
            }

            // Génération du PDF avec react-pdf
            const blob = await pdf(<ContractPDF doc={pdfData} packs={packs} />).toBlob();
            
            // Téléchargement du fichier
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            {
                const sanitizeFilenamePart = (v: any) =>
                    String(v || '')
                        .replace(/[\\/:*?"<>|]/g, '_')
                        .replace(/\s+/g, ' ')
                        .trim();

                const clientNamePart = sanitizeFilenamePart(client?.name || 'Client');
                const contractNamePart = sanitizeFilenamePart(contract?.name || contract?.id || 'Contrat');
                link.download = `Contrat_${clientNamePart}_${contractNamePart}.pdf`;
            }
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            alert('Contrat téléchargé avec succès.');
        } catch (error) {
            console.error('Erreur lors de la génération du PDF:', error);
            alert('Erreur lors du téléchargement du contrat.');
        }
    };

    const openConfirmation = (title: string, message: string, onConfirm: () => void) => {
        setConfirmationModal({ open: true, title, message, onConfirm });
    };

    const closeConfirmation = () => {
        setConfirmationModal({ ...confirmationModal, open: false });
    };

    const handleNextPackStep = () => {
        if (packStep === 1 && !packForm.name) { showToast("Le nom du pack est obligatoire.", 'error'); return; }
        if (packStep === 2 && !packForm.mainService) { showToast("Veuillez choisir un service principal.", 'error'); return; }
        setPackStep(prev => prev + 1);
    };

    const handlePrevPackStep = () => setPackStep(prev => prev - 1);

    const handleSavePack = async () => {
        // Vérifier si une date est obligatoire et sélectionnée
        if (packForm.frequency === 'Ponctuelle' && !packForm.date) {
            showToast("La date est obligatoire pour les packs ponctuels. Veuillez sélectionner une date.", 'error');
            return;
        }

        const priceTTC = packForm.priceTTC || 0;
        const tva = 0.021; // 2.1% from PDF
        const priceHT = priceTTC / (1 + tva);
        const taxCredit = priceTTC * 0.5;

        let finalDescription = packForm.description || '';
        if (packForm.frequency === 'regulier' || packForm.type === 'regulier') {
            finalDescription += ` (${regularDaysCount} jours)`;
        }

        if (editingPackId) {
            // MODE ÉDITION
            const updates: Partial<Pack> = {
                name: packForm.name || 'Pack',
                mainService: packForm.mainService || 'Service',
                description: finalDescription || `Pack ${packForm.name} - ${packForm.mainService}`,
                hours: packForm.hours || 3,
                frequency: packForm.frequency || 'Ponctuelle',
                type: packForm.frequency === 'Ponctuelle' ? 'ponctuel' : 'regulier',
                quantity: packForm.quantity,
                location: packForm.location,
                priceTTC: priceTTC,
                priceHT: parseFloat(priceHT.toFixed(2)),
                priceTaxCredit: parseFloat(taxCredit.toFixed(2)),
                suppliesIncluded: packForm.suppliesIncluded || false,
                suppliesDetails: packForm.suppliesDetails,
                contractType: packForm.contractType || 'Contrat Prestataire Standard',
                isSap: true,
                schedules: []
            };

            await updatePack(editingPackId, updates);
            showToast('Pack modifié avec succès !');
        } else {
            // MODE CRÉATION
            const newPack: Pack = {
                id: '', // Will be generated
                name: packForm.name || 'Nouveau Pack',
                mainService: packForm.mainService || 'Service',
                description: finalDescription || `Pack ${packForm.name} - ${packForm.mainService}`,
                hours: packForm.hours || 3,
                frequency: packForm.frequency || 'Ponctuelle',
                type: packForm.frequency === 'Ponctuelle' ? 'ponctuel' : 'regulier',
                quantity: packForm.quantity,
                location: packForm.location,
                priceTTC: priceTTC,
                priceHT: parseFloat(priceHT.toFixed(2)),
                priceTaxCredit: parseFloat(taxCredit.toFixed(2)),
                suppliesIncluded: packForm.suppliesIncluded || false,
                suppliesDetails: packForm.suppliesDetails,
                contractType: packForm.contractType || 'Contrat Prestataire Standard',
                isSap: true,
                schedules: []
            };

            const createdPackId = await addPack(newPack);

            if (createdPackId) {
                // AUTO-GENERATE CONTRACT
                const contractContent = legalTemplate.replace('[INFO_PACK]', `Nom : ${newPack.name}\nService : ${newPack.mainService}\nType Contrat : ${newPack.contractType}`);

                await addContract({
                    id: '',
                    name: `Contrat Type - ${newPack.name}`,
                    content: contractContent,
                    packId: createdPackId,
                    status: 'draft',
                    isSap: true
                });

                showToast('Pack créé et Contrat Type généré automatiquement !');
            } else {
                showToast('Pack créé avec succès.');
            }
        }

        closePackModal();
    };

    const handleEditPack = (pack: Pack) => {
        setEditingPackId(pack.id);
        setPackForm({
            name: pack.name,
            mainService: pack.mainService,
            description: pack.description,
            hours: pack.hours,
            frequency: pack.frequency,
            type: pack.type,
            quantity: pack.quantity,
            location: pack.location,
            priceTTC: pack.priceTTC,
            priceHT: pack.priceHT,
            priceTaxCredit: pack.priceTaxCredit,
            suppliesIncluded: pack.suppliesIncluded,
            suppliesDetails: pack.suppliesDetails,
            contractType: pack.contractType,
            isSap: pack.isSap,
            interventionSchedules: []
        });
        setModalType('pack');
        setIsModalOpen(true);
    };

    const closePackModal = () => {
        setIsModalOpen(false);
        setPackStep(1);
        setEditingPackId(null);
        setPackForm({
            type: 'ponctuel',
            hours: 3,
            frequency: 'Ponctuelle',
            priceTTC: 0,
            suppliesIncluded: false,
            isSap: true,
            quantity: '',
            location: 'Domicile Client',
            contractType: 'Contrat Prestataire Standard',
            interventionSchedules: []
        } as Partial<PackWithSchedules>);
        setRegularDaysCount(1);
    };

    // Pack Selection Logic
    const togglePackSelection = (id: string) => {
        const newSet = new Set(selectedPackIds);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setSelectedPackIds(newSet);
    };

    const confirmDeletePacks = () => {
        if (selectedPackIds.size > 0) {
            setDeleteConfirmOpen(true);
        }
    };

    const executeDeletePacks = async () => {
        try {
            await deletePacks(Array.from(selectedPackIds));
            setSelectedPackIds(new Set());
            setDeleteConfirmOpen(false);
            showToast('Packs supprimés avec succès.');
        } catch (e: any) {
            console.error('[executeDeletePacks] delete failed:', e);
            showToast(e?.message || 'Erreur lors de la suppression des packs.', 'error');
        }
    };

    const confirmDeleteContracts = () => {
        if (selectedContractIds.size > 0) {
            openConfirmation(
                "Confirmer la suppression",
                `Supprimer ${selectedContractIds.size} contrat(s) sélectionné(s) ? Cette action est irréversible.`,
                async () => {
                    await deleteContracts(Array.from(selectedContractIds));
                    setSelectedContractIds(new Set());
                    showToast('Contrats supprimés avec succès.');
                }
            );
        }
    };

    const openContractModal = (contract?: Contract) => {
        if (contract) {
            // If editing existing contract, ensure we have IDs if present
            setSelectedClientIdForContract(''); // Reset selectors on edit generally unless linked
            setSelectedPackIdForContract(contract.packId || '');
            setContractLogoType(contract.isSap ? 'SAP' : 'Standard');
            setContractForm({
                id: contract.id,
                name: contract.name,
                content: contract.content,
                status: contract.status
            });
        } else {
            setContractForm({
                id: '', // Will be generated
                name: 'Nouveau Contrat',
                content: legalTemplate,
                status: 'draft'
            });
            setSelectedClientIdForContract('');
            setSelectedPackIdForContract('');
            setContractLogoType('SAP');
        }
        setModalType('contract');
        setIsModalOpen(true);
    };

    // State for quote selection modal
    const [showQuoteSelectionModal, setShowQuoteSelectionModal] = useState(false);
    const [selectedQuoteForContract, setSelectedQuoteForContract] = useState<any[]>([]);

    const handleGenerateContractContent = () => {
        // VALIDATION: Must select Client and Pack
        if (!selectedClientIdForContract || !selectedPackIdForContract) {
            showToast("Veuillez sélectionner un client et un pack avant de générer le contrat.", 'error');
            return;
        }

        // Check if client has existing quotes (devis)
        const clientQuotes = documents.filter((doc: any) =>
            doc.clientId === selectedClientIdForContract &&
            doc.type === 'Devis' &&
            (doc.status === 'sent' || doc.status === 'signed')
        );

        if (clientQuotes.length === 0) {
            showToast("Ce client n'a aucun devis. Veuillez créer un devis d'abord.", 'error');
            return;
        }

        if (clientQuotes.length > 1) {
            // Show modal to select which quote to use
            setSelectedQuoteForContract(clientQuotes);
            setShowQuoteSelectionModal(true);
            return;
        }

        // Use the single quote found
        proceedWithContractGeneration(clientQuotes[0]);
    };

    const proceedWithContractGeneration = (selectedQuote: any) => {
        // Utiliser les contrats génériques si disponibles
        const client = clients.find(c => c.id === selectedClientIdForContract);
        const pack = packs.find(p => p.id === selectedPackIdForContract);

        if (client && pack && genericContracts.length > 0) {
            // Utiliser la fonction generateContractFromTemplate du DataContext
            const contract = generateContractFromTemplate(selectedQuote, client, pack);

            if (contract) {
                setContractForm(prev => ({
                    ...prev,
                    content: contract.content,
                    packId: selectedPackIdForContract,
                    name: contract.name
                }));
                setShowQuoteSelectionModal(false);
                showToast("Contrat généré avec succès en utilisant le modèle générique.");
                return;
            }
        }

        // Fallback à l'ancienne méthode si aucun contrat générique n'est disponible
        let content = legalTemplate;

        // Inject Client Info
        if (client) {
            const clientInfo = `Nom : ${client.name}\nAdresse : ${client.address}, ${client.city}\nTéléphone : ${client.phone}\nEmail : ${client.email}`;
            content = content.replace('[INFO_CLIENT]', clientInfo);
        }

        // Inject Pack Info
        if (pack) {
            // Get intervention schedules from quote slots_data
            let scheduleInfo = '';
            if (selectedQuote.slots_data && selectedQuote.slots_data.length > 0) {
                // Parse slots_data from quote (JSON format)
                try {
                    const slotsData = typeof selectedQuote.slots_data === 'string'
                        ? JSON.parse(selectedQuote.slots_data)
                        : selectedQuote.slots_data;

                    if (Array.isArray(slotsData) && slotsData.length > 0) {
                        scheduleInfo = `\nHoraires d'intervention : ${slotsData.map((slot: any) => {
                            const day = slot.day || slot.date || '';
                            const startTime = slot.startTime || slot.start_time || slot.start || '';
                            const endTime = slot.endTime || slot.end_time || slot.end || '';
                            return `${day} de ${startTime} à ${endTime}`;
                        }).join(', ')}`;
                    }
                } catch (error) {
                    console.warn('Error parsing slots_data:', error);
                }
            }

            // Fallback to pack intervention schedules if no slots_data found
            if (!scheduleInfo && (pack as any).interventionSchedules && (pack as any).interventionSchedules.length > 0) {
                scheduleInfo = `\nHoraires d'intervention : ${(pack as any).interventionSchedules.map((s: InterventionSchedule) => `${s.day} de ${s.startTime} à ${s.endTime}`).join(', ')}`;
            }

            const packInfo = `Nom du Pack : ${pack.name}\nService : ${pack.mainService}\nDurée : ${pack.hours}h (${pack.frequency})\nLieu : ${pack.location || 'Domicile Client'}\nTarif TTC : ${pack.priceTTC} €\nMatériel inclus : ${pack.suppliesIncluded ? 'Oui' : 'Non'}${scheduleInfo}`;
            content = content.replace('[INFO_PACK]', packInfo);
        }

        // Inject Date
        content = content.replace('[DATE]', formatMartiniqueDate(new Date()));

        setContractForm(prev => ({ ...prev, content, packId: selectedPackIdForContract }));
        setShowQuoteSelectionModal(false);
        showToast("Contrat généré avec les informations sélectionnées (ancien modèle).");
    };

    const handleSaveContract = async () => {
        const contractPayload = {
            ...contractForm,
            isSap: contractLogoType === 'SAP',
            clientId: selectedClientIdForContract || undefined
        } as Contract;

        try {
            if (contractForm.id && contractForm.name) {
                const existing = contracts.find(c => c.id === contractForm.id);
                if (existing) {
                    await updateContract(existing.id, {
                        name: contractForm.name,
                        content: contractForm.content,
                        packId: selectedPackIdForContract || existing.packId,
                        isSap: contractLogoType === 'SAP',
                        clientId: selectedClientIdForContract || existing.clientId
                    });
                    showToast('Contrat modifié.');
                } else {
                    await addContract(contractPayload);
                    showToast('Nouveau contrat sauvegardé.');
                }
                setIsModalOpen(false);
            } else {
                // New creation
                await addContract(contractPayload);
                showToast('Nouveau contrat sauvegardé.');
                setIsModalOpen(false);
            }
        } catch (error: any) {
            showToast("Erreur: " + error.message, 'error');
        }
    };

    const closeContractEditModal = () => {
        setContractEditModalOpen(false);
        setEditingContractContent('');
        setEditingContractId(null);
    };

    const stripHtmlToText = (html: string) => {
        try {
            const div = document.createElement('div');
            div.innerHTML = html;
            return (div.textContent || div.innerText || '').trim();
        } catch {
            return (html || '').trim();
        }
    };

    const escapeHtml = (value: string) => {
        return (value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    };

    const toHtmlForContractPreview = (value: string) => {
        if (!value) return '';

        // Preview volontairement "lecture" : on part sur du texte (HTML -> texte)
        // pour rendre l'affichage plus aéré et standardisé (sans toucher aux données sauvegardées)
        const text = stripHtmlToText(value)
            .replace(/\r\n/g, '\n')
            .replace(/\r/g, '\n');

        // Forcer une séparation claire des articles
        // (insère une ligne vide avant chaque "Article" si besoin)
        const withArticleBreaks = text
            .replace(/\n\s*(Article\b)/gi, '\n\n$1')
            .replace(/\s+(Article\b)/gi, (m, p1) => `\n\n${p1}`);

        const lines = withArticleBreaks.split('\n');
        const htmlLines = lines.map((line) => {
            const trimmed = (line || '').trim();
            if (!trimmed) return '';
            if (/^article\b/i.test(trimmed)) {
                return `<strong>${escapeHtml(trimmed)}</strong>`;
            }
            return escapeHtml(line);
        });

        return htmlLines.join('<br/>');
    };

    const isProbablyHtml = (value: string) => {
        if (!value) return false;
        return /<\s*\w+[^>]*>/.test(value);
    };

    const toHtmlForEditor = (value: string) => {
        if (!value) return '';
        if (isProbablyHtml(value)) return value;
        const escaped = value
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
        return escaped.replace(/\n/g, '<br/>');
    };

    const syncEditorFromState = () => {
        if (!contractEditorRef.current) return;
        const currentHtml = contractEditorRef.current.innerHTML || '';
        const desiredHtml = toHtmlForEditor(editingContractContent || '');
        if (currentHtml !== desiredHtml) {
            contractEditorRef.current.innerHTML = desiredHtml;
        }
    };

    const execEditorCommand = (command: string, value?: string) => {
        if (!contractEditorRef.current) return;
        contractEditorRef.current.focus();
        try {
            document.execCommand(command, false, value);
        } catch {
            // ignore
        }
        setEditingContractContent(contractEditorRef.current.innerHTML || '');
    };

    useEffect(() => {
        if (!contractEditModalOpen) return;
        if (!useRichContractEditor) return;
        const t = window.setTimeout(() => {
            syncEditorFromState();
        }, 0);
        return () => window.clearTimeout(t);
    }, [contractEditModalOpen, useRichContractEditor, editingContractContent]);

    const contractPreviewHtml = useMemo(() => {
        return toHtmlForContractPreview(editingContractContent || '');
    }, [editingContractContent]);

    const handleDownloadPDF = (contract: Contract) => {
        // Simulated PDF Download via Print Window
        const printWindow = window.open('', '', 'width=800,height=600');
        if (printWindow) {
            // Use SAP logo if contract is SAP, otherwise use normal logo
            const logoToUse = contract.isSap ? LOGO_SAP : LOGO_NORMAL;

            // Récupérer la signature du client depuis les documents
            let clientSignature = '';
            let clientSignatureDate = '';

            if (contract.clientId) {
                const clientDocuments = documents.filter(doc =>
                    doc.clientId === contract.clientId &&
                    doc.type === 'Devis' &&
                    doc.status === 'signed' &&
                    doc.signatureData
                );

                if (clientDocuments.length > 0) {
                    // Prendre le document signé le plus récent
                    const latestSignedDoc = clientDocuments.sort((a, b) =>
                        new Date(b.signatureDate || '').getTime() - new Date(a.signatureDate || '').getTime()
                    )[0];

                    clientSignature = latestSignedDoc.signatureData || '';
                    clientSignatureDate = latestSignedDoc.signatureDate || '';
                }
            }

            printWindow.document.write(`
            <html>
              <head>
                <title>CONTRAT - ${contract.name}</title>
                <style>
                  body { font-family: 'Times New Roman', serif; font-size: 12pt; line-height: 1.5; padding: 40px; }
                  .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #333; padding-bottom: 10px; }
                  .logo { max-width: 150px; margin-bottom: 10px; }
                  .section-title { font-weight: bold; text-transform: uppercase; margin-top: 20px; text-decoration: underline; }
                  .content { white-space: pre-wrap; }
                  .signatures { margin-top: 50px; display: flex; justify-content: space-between; }
                  .sig-box { width: 45%; border: 1px solid #ccc; height: 150px; padding: 10px; position: relative; }
                  .stamp { position: absolute; bottom: 10px; right: 10px; max-width: 80px; opacity: 0.8; }
                  .client-sig { max-width: 120px; max-height: 60px; margin-top: 10px; }
                  .sig-date { font-size: 10pt; color: #666; margin-top: 5px; }
                </style>
              </head>
              <body>
                <div class="header">
                   <img src="${logoToUse}" class="logo" />
                   <h2>${companySettings.name}</h2>
                   <p>${companySettings.address} | N° SAP: ${companySettings.siret}</p>
                </div>
                <div class="content">
                  ${contract.content}
                </div>
                <div class="signatures">
                   <div class="sig-box">
                      <strong>Pour le Client :</strong>
                      <br/>(Lu et approuvé)
                      ${clientSignature ? `<br/><img src="${clientSignature}" class="client-sig" />` : ''}
                      ${clientSignatureDate ? `<div class="sig-date">Signé le ${new Date(clientSignatureDate).toLocaleDateString('fr-FR')}</div>` : ''}
                   </div>
                   <div class="sig-box">
                      <strong>Pour l'Entreprise :</strong>
                      ${contract.status === 'active' ? `<br/><img src="${COMPANY_STAMP_URL}" class="stamp" /><br/><img src="${COMPANY_SIGNATURE_URL}" style="max-width:100px;" />` : ''}
                   </div>
                </div>
              </body>
            </html>
          `);
            printWindow.document.close();
            printWindow.print();
        }
    };

    const handleSendAdminMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (selectedChatClientId && adminMessageInput.trim()) {
            await replyToClient(adminMessageInput, selectedChatClientId);
            setAdminMessageInput('');
            // Re-scroll handled by useEffect
        }
    };

    const handleLeaveStatusUpdate = async (leaveId: string, providerId: string, status: 'approved' | 'rejected') => {
        await updateLeaveStatus(leaveId, providerId, status);
        showToast(status === 'approved' ? 'Absence validée. Planning mis à jour.' : 'Absence refusée.');
    };

    const saveContractEdit = async () => {
        if (editingContractId && editingContractContent.trim()) {
            try {
                await updateContract(editingContractId, {
                    content: editingContractContent,
                    isModifiable: true
                });
                showToast('Contrat modifié avec succès.');
                closeContractEditModal();
            } catch (error: any) {
                showToast('Erreur lors de la modification: ' + error.message, 'error');
            }
        } else {
            showToast('Le contenu du contrat ne peut pas être vide.', 'error');
        }
    };

    const handleSaveReminder = () => {
        if (reminderForm.text && reminderForm.date) {
            addReminder({
                id: `r-${Date.now()}`,
                text: reminderForm.text,
                date: reminderForm.date,
                notifyEmail: reminderForm.notifyEmail || false,
                completed: false
            });
            showToast(reminderForm.notifyEmail ? 'Rappel enregistré avec notification email.' : 'Rappel enregistré.');
            setIsModalOpen(false);
        }
    };

    const handleSaveExpense = async () => {
        if (expenseForm.description && expenseForm.amount && expenseForm.date) {
            if (expenseForm.id) {
                // MODE MODIFICATION
                await updateExpense(expenseForm.id, {
                    description: expenseForm.description,
                    amount: expenseForm.amount,
                    date: expenseForm.date,
                    category: expenseForm.category || 'autre'
                });
                showToast('Dépense mise à jour.');
            } else {
                // MODE CRÉATION
                addExpense({
                    id: `e-${Date.now()}`,
                    description: expenseForm.description,
                    amount: expenseForm.amount,
                    date: expenseForm.date,
                    category: expenseForm.category || 'autre',
                    proofUrl: 'https://via.placeholder.com/150'
                });
                showToast('Dépense ajoutée à la comptabilité.');
            }
            setIsModalOpen(false);
            setExpenseForm({ id: '', category: 'fournitures', amount: 0, description: '', date: '' });
        } else {
            showToast('Veuillez remplir tous les champs obligatoires.', 'error');
        }
    };

    const handleEditExpense = (expense: Expense) => {
        setExpenseForm(expense);
        setModalType('expense');
        setIsModalOpen(true);
    };

    const handleAdminValidation = async (contractId: string) => {
        if (currentUser?.role !== 'super_admin') {
            showToast('Action non autorisée. Réservé au Super Admin.', 'error');
            return;
        }
        await validateContract(contractId, true); // True for validate
        showToast('Contrat validé et cacheté définitivement.');
    };

    const handleRequestValidation = async (contractId: string) => {
        // Function to request validation for a contract
        await updateContract(contractId, {
            status: 'pending_validation'
        });
        showToast('Demande de validation envoyée.');
    };

    // --- ABSENCE CONFLICT LOGIC ---
    const absenceConflicts = useMemo(() => {
        const conflicts: { mission: Mission, providerName: string, leaveStart: string, leaveEnd: string }[] = [];
        providers.forEach(provider => {
            provider.leaves.forEach(leave => {
                if (leave.status === 'rejected') return; // Ignore rejected leaves
                const start = new Date(leave.startDate);
                const end = new Date(leave.endDate);

                // Find missions during this leave
                const providerMissions = missions.filter(m => m.providerId === provider.id && m.status === 'planned');
                providerMissions.forEach((mission: Mission) => {
                    if (mission.date) {
                        const missionDate = new Date(mission.date);
                        if (missionDate >= start && missionDate <= end) {
                            // TODO: Enhance conflict check with times if needed
                            conflicts.push({
                                mission,
                                providerName: `${provider.firstName} ${provider.lastName}`,
                                leaveStart: leave.startDate,
                                leaveEnd: leave.endDate
                            });
                        }
                    }
                });
            });
        });
        return conflicts;
    }, [providers, missions]);

    // Agenda Data (Sorted Missions)
    const agendaMissions = useMemo(() => {
        return [...missions]
            .filter(m => m.status === 'planned')
            .filter(m => matchesServiceTypeFilterFromText(m.service, serviceTypeFilter))
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }, [missions, serviceTypeFilter]);

    // Expenses Stats (Computed from Filtered)
    const totalExpenses = filteredExpenses.reduce((acc, curr) => acc + curr.amount, 0);

    // Chat Logic
    const chatClients = clients;

    const clientIndexById = useMemo(() => {
        return new Map((chatClients || []).map((c: any, idx: number) => [String(c?.id || ''), idx]));
    }, [chatClients]);

    const lastMessageTimestampByClientId = useMemo(() => {
        const map = new Map<string, number>();
        (messages || []).forEach((m: any) => {
            const clientId = String(m?.clientId || '');
            const t = new Date(m?.date || '').getTime();
            if (!clientId || !Number.isFinite(t)) return;
            const prev = map.get(clientId);
            if (prev === undefined || t > prev) map.set(clientId, t);
        });
        return map;
    }, [messages]);

    const unreadClientMessagesCountByClientId = useMemo(() => {
        const map = new Map<string, number>();
        (messages || []).forEach((m: any) => {
            if (String(m?.sender || '') !== 'client') return;
            const clientId = String(m?.clientId || '');
            if (!clientId) return;
            const isRead = m?.read === true;
            if (isRead) return;
            map.set(clientId, (map.get(clientId) || 0) + 1);
        });
        return map;
    }, [messages]);

    const unreadChatClientsCount = useMemo(() => {
        return unreadClientMessagesCountByClientId.size;
    }, [unreadClientMessagesCountByClientId]);

    const filteredChatClients = useMemo(() => {
        const q = String(chatClientSearch || '').trim().toLowerCase();
        const base = !q
            ? (chatClients || [])
            : (chatClients || []).filter((c: any) => String(c?.name || '').toLowerCase().includes(q));

        const getIdx = (id: any) => clientIndexById.get(String(id || '')) ?? 0;
        const getLast = (id: any) => lastMessageTimestampByClientId.get(String(id || '')) ?? 0;

        return base
            .slice()
            .sort((a: any, b: any) => {
                const ta = getLast(a?.id);
                const tb = getLast(b?.id);
                if (tb !== ta) return tb - ta;
                return getIdx(a?.id) - getIdx(b?.id);
            });
    }, [chatClients, chatClientSearch, clientIndexById, lastMessageTimestampByClientId]);
    // Sort messages to ensure chronological order
    const currentChatMessages = useMemo(() => {
        return messages
            .filter(m => m.clientId === selectedChatClientId)
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }, [messages, selectedChatClientId]);

    return (
        <div className="p-8 h-full overflow-y-auto bg-white/40 relative">
            {/* Toast */}
            <div className={`fixed bottom-6 right-6 z-[100] transition-all duration-500 transform ${toast.show ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0 pointer-events-none'}`}>
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

            <h2 className="text-3xl font-serif font-bold text-slate-800 mb-6">Secrétariat</h2>

            {/* Tabs */}
            <div className="flex flex-wrap gap-1 mb-6 bg-slate-100 p-1 rounded-lg w-fit">
                <button
                    onClick={() => setActiveTab('packs')}
                    className={`px-4 py-2 rounded-md text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'packs' ? 'bg-white text-brand-blue shadow-sm' : 'text-slate-500'}`}
                >
                    <PackagePlus className="w-4 h-4" /> Packs & Contrats
                </button>
                <button
                    onClick={() => setActiveTab('absences')}
                    className={`px-4 py-2 rounded-md text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'absences' ? 'bg-white text-brand-blue shadow-sm' : 'text-slate-500'}`}
                >
                    <CalendarX className="w-4 h-4" /> Absences
                </button>
                <button
                    onClick={() => setActiveTab('agenda')}
                    className={`px-4 py-2 rounded-md text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'agenda' ? 'bg-white text-brand-blue shadow-sm' : 'text-slate-500'}`}
                >
                    <StickyNote className="w-4 h-4" /> Agenda
                </button>
                <button
                    onClick={() => setActiveTab('messaging')}
                    className={`px-4 py-2 rounded-md text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'messaging' ? 'bg-white text-brand-blue shadow-sm' : 'text-slate-500'}`}
                >
                    <MessageSquare className="w-4 h-4" /> Messagerie
                    {unreadChatClientsCount > 0 && (
                        <span className="min-w-[22px] h-[22px] px-2 inline-flex items-center justify-center rounded-full bg-red-600 text-white text-xs font-bold">
                            {unreadChatClientsCount}
                        </span>
                    )}
                </button>
                <button
                    onClick={() => setActiveTab('expenses')}
                    className={`px-4 py-2 rounded-md text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'expenses' ? 'bg-white text-brand-blue shadow-sm' : 'text-slate-500'}`}
                >
                    <Euro className="w-4 h-4" /> Dépenses
                </button>
                <button
                    onClick={() => setActiveTab('live-videos')}
                    className={`px-4 py-2 rounded-md text-sm font-bold transition-all flex items-center gap-2 relative ${activeTab === 'live-videos' ? 'bg-white text-brand-blue shadow-sm' : 'text-slate-500'}`}
                >
                    <Video className="w-4 h-4" /> Vidéos en Direct
                    {activeStream && <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>}
                </button>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 min-h-[500px] p-6">
                {/* --- TAB: PACKS & CONTRACTS --- */}
                {activeTab === 'packs' && (
                    <div className="space-y-8">
                        <div className="flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <h3 className="text-lg font-bold text-slate-700">Gestion des Packs</h3>
                                {selectedPackIds.size > 0 && (
                                    <button onClick={confirmDeletePacks} className="bg-red-500 text-white px-3 py-1 rounded text-xs font-bold flex items-center gap-1 hover:bg-red-600 animate-in fade-in">
                                        <Trash2 className="w-3 h-3" /> Supprimer ({selectedPackIds.size})
                                    </button>
                                )}
                            </div>
                            <button onClick={() => { setModalType('pack'); setPackStep(1); setIsModalOpen(true); }} className="bg-brand-blue text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-teal-700">
                                <Plus className="w-4 h-4" /> Créer un Pack
                            </button>
                        </div>
                        {/* Packs List */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {packs.map((pack: Pack) => (
                                <div key={pack.id} className={`border rounded-lg p-4 hover:shadow-md transition bg-cream-50/30 relative ${selectedPackIds.has(pack.id) ? 'border-brand-blue ring-1 ring-brand-blue' : 'border-slate-200'}`}>
                                    <button
                                        onClick={() => togglePackSelection(pack.id)}
                                        className="absolute top-2 right-2 text-slate-400 hover:text-brand-blue"
                                    >
                                        {selectedPackIds.has(pack.id) ? <CheckSquare className="w-5 h-5 text-brand-blue" /> : <Square className="w-5 h-5" />}
                                    </button>

                                    <div className="flex justify-between items-start mb-2 pr-6">
                                        <h4 className="font-bold text-slate-800">{pack.name}</h4>
                                    </div>
                                    <span className="bg-blue-100 text-brand-blue text-xs px-2 py-1 rounded-full font-bold mb-2 inline-block">{pack.frequency}</span>
                                    <p className="text-xs text-slate-500 mb-3 line-clamp-2 font-bold">{pack.mainService}</p>

                                    <div className="text-xs text-slate-500 mb-2">
                                        {pack.location && <span className="block">Lieu: {pack.location}</span>}
                                    </div>

                                    <div className="flex justify-between text-sm font-bold text-slate-700 border-t border-slate-100 pt-2">
                                        <span>{calculatePackDuration(pack)}</span>
                                        <span>{pack.priceTTC}€ TTC</span>
                                    </div>
                                    <div className="mt-2 flex items-center justify-between">
                                        <span className="text-xs text-green-600 font-medium">
                                            Crédit Impôt: {pack.priceTaxCredit}€
                                        </span>
                                        <div className="flex items-center gap-2">
                                            {pack.isSap && <span className="text-[10px] bg-brand-blue text-white px-1 rounded">SAP</span>}
                                            <button
                                                onClick={() => handleEditPack(pack)}
                                                className="text-xs bg-blue-100 hover:bg-blue-200 text-blue-600 px-2 py-1 rounded flex items-center gap-1 transition-colors"
                                                title="Modifier le pack"
                                            >
                                                <Edit className="w-3 h-3" />
                                                Modifier
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setPackDetailsModal({ open: true, pack });
                                                }}
                                                className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 px-2 py-1 rounded flex items-center gap-1 transition-colors"
                                                title="Voir les détails du pack"
                                            >
                                                <FileText className="w-3 h-3" />
                                                Détails
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="border-t border-slate-100 my-6"></div>
                        <div className="flex justify-between items-center mb-4">
                            <div className="flex items-center gap-3">
                                <h3 className="text-lg font-bold text-slate-700">Contrats Associés</h3>
                                {selectedContractIds.size > 0 && (
                                    <button onClick={confirmDeleteContracts} className="bg-red-500 text-white px-3 py-1 rounded text-xs font-bold flex items-center gap-1 hover:bg-red-600 animate-in fade-in">
                                        <Trash2 className="w-3 h-3" /> Supprimer ({selectedContractIds.size})
                                    </button>
                                )}
                            </div>
                            <button onClick={() => openContractModal()} className="text-brand-blue text-sm font-bold hover:underline flex items-center gap-1">
                                <Plus className="w-3 h-3" /> Nouveau Contrat
                            </button>
                        </div>

                        {/* Contract Filters */}
                        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm mb-4">
                            <div className="flex flex-wrap gap-4 items-center">
                                <div className="flex items-center gap-2 text-slate-500 font-bold text-sm bg-slate-50 px-3 py-2 rounded">
                                    <Filter className="w-4 h-4" /> Filtres
                                </div>

                                <div className="flex items-center gap-2">
                                    <label className="text-sm text-slate-600">Statut:</label>
                                    <select
                                        value={contractFilters.status}
                                        onChange={e => setContractFilters({ ...contractFilters, status: e.target.value })}
                                        className="border rounded px-3 py-1 text-sm"
                                    >
                                        <option value="all">Tous</option>
                                        <option value="draft">Brouillon</option>
                                        <option value="pending_validation">En attente validation</option>
                                        <option value="active">Actif</option>
                                    </select>
                                </div>

                                <div className="flex items-center gap-2">
                                    <label className="text-sm text-slate-600">Type:</label>
                                    <select
                                        value={contractFilters.isSap}
                                        onChange={e => setContractFilters({ ...contractFilters, isSap: e.target.value })}
                                        className="border rounded px-3 py-1 text-sm"
                                    >
                                        <option value="all">Tous</option>
                                        <option value="sap">SAP</option>
                                        <option value="non-sap">Non SAP</option>
                                    </select>
                                </div>

                                <div className="flex items-center gap-2">
                                    <Search className="w-4 h-4 text-slate-400" />
                                    <input
                                        type="text"
                                        placeholder="Rechercher..."
                                        value={contractFilters.search}
                                        onChange={e => setContractFilters({ ...contractFilters, search: e.target.value })}
                                        className="border rounded px-3 py-1 text-sm"
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                            {filteredContracts.map(contract => (
                                <div key={contract.id} className={`flex items-center justify-between p-4 border rounded-lg ${contract.status === 'pending_validation' ? 'border-orange-200 bg-orange-50' : 'border-slate-200'}`}>
                                    <div className="flex items-center gap-3">
                                        {/* Checkbox for selection */}
                                        <button
                                            onClick={() => {
                                                const newSelection = new Set(selectedContractIds);
                                                if (newSelection.has(contract.id)) {
                                                    newSelection.delete(contract.id);
                                                } else {
                                                    newSelection.add(contract.id);
                                                }
                                                setSelectedContractIds(newSelection);
                                            }}
                                            className="text-slate-400 hover:text-brand-blue"
                                        >
                                            {selectedContractIds.has(contract.id) ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                                        </button>
                                        <div className="p-2 bg-slate-100 rounded">
                                            <FileSignature className="w-5 h-5 text-slate-500" />
                                        </div>
                                        <div>
                                            <p className="font-bold text-slate-700">{contract.name}</p>
                                            <div className="flex items-center gap-2 mt-1">
                                                {contract.status === 'draft' && <span className="text-xs bg-slate-200 text-slate-600 px-2 rounded font-bold">Brouillon</span>}
                                                {contract.status === 'pending_validation' && <span className="text-xs bg-orange-200 text-orange-800 px-2 rounded font-bold">En attente validation</span>}
                                                {contract.status === 'active' && <span className="text-xs bg-green-200 text-green-800 px-2 rounded font-bold flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Validé & Cacheté</span>}
                                                {contract.isSap && <span className="text-[10px] bg-blue-100 text-blue-800 px-1.5 rounded font-bold border border-blue-200">SAP</span>}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => openContractModal(contract)}
                                            className="text-slate-400 hover:text-brand-blue p-1 border border-transparent hover:border-slate-200 rounded"
                                            title="Modifier / Renommer"
                                        >
                                            <Edit className="w-4 h-4" />
                                        </button>

                                        {contract.status === 'draft' && (
                                            <button
                                                onClick={() => openConfirmation("Confirmer demande", "Envoyer une demande de validation ?", () => handleRequestValidation(contract.id))}
                                                className="text-brand-orange hover:text-orange-700 transition text-xs font-bold px-3 py-1 rounded flex items-center gap-1 bg-orange-50 border border-orange-200"
                                            >
                                                <Mail className="w-3 h-3" /> Demander Validation
                                            </button>
                                        )}

                                        {contract.status === 'pending_validation' && (
                                            currentUser?.role === 'super_admin' ? (
                                                <div className="flex gap-1">
                                                    <button
                                                        onClick={() => openConfirmation("Rejeter Contrat", "Refuser la validation de ce contrat ?", () => validateContract(contract.id, false))}
                                                        className="text-red-600 hover:text-red-700 transition text-xs font-bold border border-red-200 px-3 py-1 rounded flex items-center gap-1 bg-red-50"
                                                    >
                                                        <XCircle className="w-3 h-3" /> Rejeter
                                                    </button>
                                                    <button
                                                        onClick={() => openConfirmation("Valider Contrat", "Valider définitivement ce contrat ?", () => handleAdminValidation(contract.id))}
                                                        className="text-white hover:bg-green-700 transition text-xs font-bold border border-transparent px-3 py-1 rounded flex items-center gap-1 bg-green-600 shadow-sm"
                                                    >
                                                        <Stamp className="w-3 h-3" /> Valider (Super Admin)
                                                    </button>
                                                </div>
                                            ) : (
                                                <span className="text-xs text-orange-600 italic font-medium flex items-center gap-1 bg-orange-50 px-2 py-1 rounded border border-orange-100">
                                                    <Clock className="w-3 h-3" /> En attente validation Super Admin
                                                </span>
                                            )
                                        )}

                                        {contract.status === 'active' && (
                                            <button
                                                onClick={() => handleDownloadContractPDF(contract)}
                                                className="text-green-600 hover:text-green-700 transition text-xs font-bold px-3 py-1 rounded flex items-center gap-1 bg-green-50 border border-green-200"
                                            >
                                                <Download className="w-3 h-3" /> Télécharger PDF
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* ... [AGENDA, MESSAGING, COMPTABILITÉ - Updated Messaging] ... */}
                {activeTab === 'agenda' && (
                    <div>
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-lg font-bold text-slate-700">Agenda des Missions</h3>
                            <button onClick={() => navigate('/planning')} className="text-sm text-brand-blue font-bold hover:underline flex items-center gap-1">
                                Voir Planning Complet <ArrowRight className="w-4 h-4" />
                            </button>
                        </div>
                        {agendaMissions.length === 0 ? (
                            <div className="text-center p-8 text-slate-400 bg-slate-50 rounded-lg">
                                <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                Aucune mission planifiée prochainement.
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {agendaMissions.map(mission => (
                                    <div key={mission.id} className="flex items-center p-4 border rounded-lg hover:shadow-sm bg-white transition border-slate-200">
                                        <div className="flex flex-col items-center justify-center w-16 h-16 bg-blue-50 rounded-lg text-brand-blue mr-4">
                                            <span className="text-xs font-bold uppercase">{new Date(mission.date).toLocaleString('default', { month: 'short' })}</span>
                                            <span className="text-xl font-bold">{new Date(mission.date).getDate()}</span>
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex justify-between items-start">
                                                <h4 className="font-bold text-slate-800">{mission.clientName}</h4>
                                                <span className="text-xs font-bold bg-slate-100 text-slate-600 px-2 py-1 rounded">{mission.startTime} - {mission.endTime}</span>
                                            </div>
                                            <p className="text-sm text-slate-600">{mission.service}</p>
                                            <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                                                <User className="w-3 h-3" />
                                                {mission.providerName || "À assigner"}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'messaging' && (
                    <div className="flex flex-col lg:flex-row h-[600px] border rounded-lg overflow-hidden">
                        {/* Sidebar Users */}
                        <div className="w-full lg:w-1/3 border-r border-slate-200 bg-slate-50 overflow-y-auto">
                            <div className="p-4 border-b bg-white">
                                <div className="font-bold text-slate-700">Conversations</div>
                                <div className="mt-3 relative">
                                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                    <input
                                        type="text"
                                        value={chatClientSearch}
                                        onChange={(e) => setChatClientSearch(e.target.value)}
                                        placeholder="Rechercher un client..."
                                        className="w-full border rounded-lg pl-9 pr-3 py-2 text-sm outline-none focus:border-brand-blue"
                                    />
                                </div>
                            </div>
                            {filteredChatClients.map(client => (
                                <div
                                    key={client.id}
                                    onClick={() => {
                                        setSelectedChatClientId(client.id);
                                        markClientMessagesRead(client.id);
                                    }}
                                    className={`p-4 border-b cursor-pointer hover:bg-blue-50 transition ${selectedChatClientId === client.id ? 'bg-blue-100 border-l-4 border-l-brand-blue' : ''}`}
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="font-bold text-slate-800 text-sm">{client.name}</div>
                                        {(() => {
                                            const count = unreadClientMessagesCountByClientId.get(String(client.id || '')) || 0;
                                            if (count <= 0) return null;
                                            return (
                                                <span className="min-w-[22px] h-[22px] px-2 inline-flex items-center justify-center rounded-full bg-red-600 text-white text-xs font-bold">
                                                    {count}
                                                </span>
                                            );
                                        })()}
                                    </div>
                                    <div className="text-xs text-slate-500 truncate">{client.city}</div>
                                </div>
                            ))}
                        </div>

                        {/* Chat Area */}
                        <div className="w-full lg:w-2/3 flex flex-col bg-white min-h-0">
                            {selectedChatClientId ? (
                                <>
                                    <div className="p-4 border-b bg-slate-50 flex justify-between items-center">
                                        <span className="font-bold text-slate-700">{chatClients.find(c => c.id === selectedChatClientId)?.name}</span>
                                    </div>
                                    <div ref={chatMessagesContainerRef} className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4 bg-slate-50/30">
                                        {currentChatMessages.length === 0 ? (
                                            <div className="text-center text-slate-400 text-sm mt-10">Aucun message. Démarrer la conversation.</div>
                                        ) : (
                                            currentChatMessages.map(msg => (
                                                <div key={msg.id} className={`flex ${msg.sender === 'admin' ? 'justify-end' : 'justify-start'}`}>
                                                    <div className={`max-w-[80%] lg:max-w-[60%] p-3 rounded-xl text-sm shadow-sm ${msg.sender === 'admin' ? 'bg-brand-blue text-white rounded-tr-none' : 'bg-white text-slate-800 border border-slate-200 rounded-tl-none'}`}>
                                                        <p>{msg.text}</p>
                                                        <div className="flex justify-between items-center mt-1 gap-4">
                                                            <span className={`text-[10px] ${msg.sender === 'admin' ? 'text-blue-200' : 'text-slate-400'}`}>
                                                                {formatMartiniqueDateTime(msg.date)}
                                                            </span>
                                                            {msg.sender === 'admin' && (
                                                                <span className="text-[10px] text-blue-200">
                                                                    {msg.read ? 'Lu' : 'Envoyé'}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                        {/* Hidden element to scroll to */}
                                        <div ref={chatEndRef} />
                                    </div>
                                    <form onSubmit={handleSendAdminMessage} className="p-4 border-t bg-white flex gap-2">
                                        <input
                                            type="text"
                                            className="flex-1 border rounded-lg px-4 py-2 text-sm outline-none focus:border-brand-blue"
                                            placeholder="Votre réponse..."
                                            value={adminMessageInput}
                                            onChange={e => setAdminMessageInput(e.target.value)}
                                        />
                                        <button type="submit" className="bg-brand-blue text-white p-2 rounded-lg hover:bg-teal-700 disabled:opacity-50" disabled={!adminMessageInput.trim()}>
                                            <Send className="w-5 h-5" />
                                        </button>
                                    </form>
                                </>
                            ) : (
                                <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                                    <MessageSquare className="w-12 h-12 mb-2 opacity-20" />
                                    <p>Sélectionnez une conversation</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'expenses' && (
                    <div>
                        <div className="flex justify-between items-center mb-6 flex-col sm:flex-row gap-4">
                            <h3 className="text-lg font-bold text-slate-700">Comptabilité Générale</h3>
                            <button onClick={() => { setExpenseForm({ id: '', category: 'fournitures', amount: 0, description: '', date: getMartiniqueToday() }); setIsModalOpen(true); }} className="bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-slate-700 w-full sm:w-auto">
                                <Plus className="w-4 h-4" /> Saisir Dépense
                            </button>
                        </div>
                        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
                            <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm flex items-center gap-4">
                                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center text-red-600">
                                    <TrendingUp className="w-6 h-6" />
                                </div>
                                <div>
                                    <p className="text-xs text-slate-500 uppercase font-bold">Total Filtré</p>
                                    <p className="text-2xl font-bold text-slate-800">{totalExpenses.toFixed(2)} €</p>
                                </div>
                            </div>
                            {/* FILTERS UI */}
                            <div className="lg:col-span-3 bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                                <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center">
                                    <div className="flex items-center gap-2 text-slate-500 font-bold text-sm bg-slate-50 px-3 py-2 rounded whitespace-nowrap">
                                        <Filter className="w-4 h-4" /> Filtres
                                    </div>

                                    <div className="flex flex-col sm:flex-row items-center gap-2 w-full lg:w-auto">
                                        <div className="flex items-center gap-2 w-full">
                                            <Calendar className="w-4 h-4 text-slate-400" />
                                            <input
                                                type="date"
                                                value={expenseFilters.startDate}
                                                onChange={e => setExpenseFilters({ ...expenseFilters, startDate: e.target.value })}
                                                className="border rounded px-2 py-1 text-xs flex-1"
                                                title="Date début"
                                            />
                                        </div>
                                        <span className="text-slate-300 hidden sm:inline">-</span>
                                        <div className="flex items-center gap-2 w-full">
                                            <input
                                                type="date"
                                                value={expenseFilters.endDate}
                                                onChange={e => setExpenseFilters({ ...expenseFilters, endDate: e.target.value })}
                                                className="border rounded px-2 py-1 text-xs flex-1"
                                                title="Date fin"
                                            />
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 border-l pl-4">
                                        <SlidersHorizontal className="w-4 h-4 text-slate-400" />
                                        <select
                                            value={expenseFilters.category}
                                            onChange={e => setExpenseFilters({ ...expenseFilters, category: e.target.value })}
                                            className="border rounded px-2 py-1 text-xs bg-white"
                                        >
                                            <option value="">Toutes Catégories</option>
                                            <option value="fournitures">Fournitures</option>
                                            <option value="carburant">Carburant</option>
                                            <option value="administratif">Administratif</option>
                                            <option value="autre">Autre</option>
                                        </select>
                                    </div>

                                    <div className="flex items-center gap-2 border-l pl-4">
                                        <Euro className="w-4 h-4 text-slate-400" />
                                        <input
                                            type="number"
                                            placeholder="Min"
                                            value={expenseFilters.minAmount}
                                            onChange={e => setExpenseFilters({ ...expenseFilters, minAmount: e.target.value })}
                                            className="border rounded px-2 py-1 text-xs w-20"
                                        />
                                        <span className="text-slate-300">-</span>
                                        <input
                                            type="number"
                                            placeholder="Max"
                                            value={expenseFilters.maxAmount}
                                            onChange={e => setExpenseFilters({ ...expenseFilters, maxAmount: e.target.value })}
                                            className="border rounded px-2 py-1 text-xs w-20"
                                        />
                                    </div>

                                    {(expenseFilters.startDate || expenseFilters.endDate || expenseFilters.category || expenseFilters.minAmount || expenseFilters.maxAmount) && (
                                        <button
                                            onClick={() => setExpenseFilters({ startDate: '', endDate: '', category: '', minAmount: '', maxAmount: '' })}
                                            className="text-xs text-red-500 hover:text-red-700 underline ml-auto"
                                        >
                                            Effacer
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                        
                        {/* TABLEAU DES DÉPENSES - EN DEHORS DE LA GRILLE */}
                        <div className="bg-white border rounded-lg overflow-x-auto -mx-6 px-6">
                            <table className="w-full text-sm text-left min-w-[800px]">
                                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                                    <tr>
                                        <th className="px-4 py-3 min-w-[100px]">Date</th>
                                        <th className="px-4 py-3 min-w-[200px]">Description</th>
                                        <th className="px-4 py-3 min-w-[120px]">Catégorie</th>
                                        <th className="px-4 py-3 text-right min-w-[100px]">Montant</th>
                                        <th className="px-4 py-3 text-center min-w-[80px]">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredExpenses.length === 0 ? (
                                        <tr><td colSpan={5} className="p-8 text-center text-slate-400">Aucune dépense trouvée avec ces filtres.</td></tr>
                                    ) : (
                                        filteredExpenses.map((expense) => (
                                            <tr key={expense.id} className="hover:bg-slate-50 group">
                                                <td className="px-4 py-4 text-slate-600 whitespace-nowrap">{expense.date}</td>
                                                <td className="px-4 py-4 font-bold text-slate-700">{expense.description}</td>
                                                <td className="px-4 py-4 whitespace-nowrap">
                                                    <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs capitalize">{expense.category}</span>
                                                </td>
                                                <td className="px-4 py-4 text-right font-bold text-red-500 whitespace-nowrap">- {expense.amount.toFixed(2)} €</td>
                                                <td className="px-4 py-4 text-center">
                                                    <button
                                                        onClick={() => handleEditExpense(expense)}
                                                        className="bg-slate-100 text-slate-500 p-1.5 rounded hover:bg-brand-blue hover:text-white transition opacity-0 group-hover:opacity-100"
                                                        title="Modifier"
                                                    >
                                                        <Edit className="w-3 h-3" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* --- TAB: ABSENCES --- */}
                {activeTab === 'absences' && (
                    <div>
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-bold text-slate-700 mb-4">Absences Prestataires (Congés)</h3>
                            {/* Alert if conflicts */}
                            {absenceConflicts.length > 0 && (
                                <div className="text-red-600 font-bold flex items-center gap-2 text-sm bg-red-50 px-3 py-1 rounded-full border border-red-200">
                                    <AlertTriangle className="w-4 h-4" /> {absenceConflicts.length} Conflit(s) détecté(s)
                                </div>
                            )}
                        </div>

                        {providers.every(p => p.leaves.length === 0) ? (
                            <div className="text-center p-8 text-slate-400 bg-slate-50 rounded-lg">
                                <CalendarX className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                Aucune absence déclarée pour le moment.
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {providers.map(provider => {
                                    if (provider.leaves.length === 0) return null;
                                    return (
                                        <div key={provider.id} className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
                                            <div className="flex justify-between items-start mb-3">
                                                <h4 className="font-bold text-slate-800 flex items-center gap-2">
                                                    <User className="w-4 h-4" />
                                                    {provider.firstName} {provider.lastName}
                                                </h4>
                                                <span className="text-xs bg-slate-100 px-2 py-1 rounded text-slate-600">{provider.leaves.length} absence(s)</span>
                                            </div>
                                            <div className="space-y-2">
                                                {provider.leaves.map((leave, i) => (
                                                    <div key={i} className="text-sm bg-slate-50 p-2 rounded flex flex-col gap-2">
                                                        <div className="flex justify-between items-center">
                                                            <span className="text-slate-600 flex flex-col">
                                                                <span>Du <strong>{leave.startDate}</strong> au <strong>{leave.endDate}</strong></span>
                                                                {(leave.startTime && leave.endTime) && (
                                                                    <span className="text-xs text-slate-400">({leave.startTime} - {leave.endTime})</span>
                                                                )}
                                                            </span>
                                                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${leave.status === 'approved' ? 'bg-green-100 text-green-700' : leave.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                                                {leave.status === 'approved' ? 'Validé' : leave.status === 'rejected' ? 'Refusé' : 'En attente'}
                                                            </span>
                                                        </div>
                                                        {leave.status === 'pending' && (
                                                            <div className="flex justify-end gap-2 border-t border-slate-200 pt-2">
                                                                <button
                                                                    onClick={() => openConfirmation("Refuser Congés", "Refuser la demande de congés ?", () => handleLeaveStatusUpdate(leave.id, provider.id, 'rejected'))}
                                                                    className="text-xs bg-white border border-red-200 text-red-600 px-2 py-1 rounded hover:bg-red-50 flex items-center gap-1 font-bold"
                                                                >
                                                                    <X className="w-3 h-3" /> Refuser
                                                                </button>
                                                                <button
                                                                    onClick={() => openConfirmation("Valider Congés", "Accepter la demande de congés ?", () => handleLeaveStatusUpdate(leave.id, provider.id, 'approved'))}
                                                                    className="text-xs bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700 flex items-center gap-1 font-bold shadow-sm"
                                                                >
                                                                    <Check className="w-3 h-3" /> Valider
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* --- TAB: LIVE VIDEOS --- */}
                {activeTab === 'live-videos' && (
                    <LiveVideoManager />
                )}
            </div>

            {/* --- MODALS --- */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
                    <div className={`bg-white rounded-2xl shadow-2xl w-full ${modalType === 'contract' ? 'max-w-4xl h-[90vh]' : 'max-w-xl'} overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200`}>
                        <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-cream-50">
                            <div>
                                <h3 className="text-xl font-serif font-bold text-slate-800">
                                    {modalType === 'pack' && (editingPackId ? 'Modifier Pack' : 'Créer Pack (Processus)')}
                                    {modalType === 'contract' && 'Création Contrat SAP'}
                                    {modalType === 'reminder' && 'Nouveau Rappel'}
                                    {modalType === 'expense' && 'Saisir Dépense'}
                                </h3>
                            </div>
                            <button onClick={closePackModal} className="p-2 hover:bg-slate-200 rounded-full transition"><X className="w-5 h-5 text-slate-500" /></button>
                        </div>

                        <div className={`p-6 overflow-y-auto ${modalType === 'contract' ? 'flex-1' : ''}`}>

                            {/* PACK FORM - Unchanged except for logic in handleSavePack */}
                            {modalType === 'pack' && (
                                <div className="space-y-6">
                                    {/* STEP 1: Nom du Pack */}
                                    {packStep === 1 && (
                                        <div className="space-y-4">
                                            <h4 className="font-bold text-brand-blue flex items-center gap-2">
                                                <span className="w-6 h-6 rounded-full bg-brand-blue text-white flex items-center justify-center text-xs">1</span>
                                                Nom du Pack
                                            </h4>
                                            <div>
                                                <label className="font-bold text-slate-700 block mb-1">Saisir un nom distinctif et commercial</label>
                                                <input
                                                    type="text"
                                                    className="w-full p-3 border rounded-lg focus:border-brand-blue outline-none"
                                                    value={packForm.name || ''}
                                                    onChange={e => setPackForm({ ...packForm, name: e.target.value })}
                                                    placeholder="Ex : Pack Zen Jardin, Ultime 6..."
                                                    autoFocus
                                                />
                                            </div>
                                        </div>
                                    )}
                                    {packStep === 2 && (
                                        <div className="space-y-4">
                                            <h4 className="font-bold text-brand-blue flex items-center gap-2">
                                                <span className="w-6 h-6 rounded-full bg-brand-blue text-white flex items-center justify-center text-xs">2</span>
                                                Type de prestation principale
                                            </h4>
                                            <div>
                                                <label className="font-bold text-slate-700 block mb-2">Choisir parmi les services éligibles SAP :</label>
                                                <div className="max-h-60 overflow-y-auto border rounded-lg divide-y divide-slate-100">
                                                    {SAP_SERVICES.map(s => (
                                                        <div
                                                            key={s}
                                                            onClick={() => setPackForm({ ...packForm, mainService: s })}
                                                            className={`p-3 cursor-pointer text-sm font-medium hover:bg-blue-50 transition ${packForm.mainService === s ? 'bg-blue-50 text-brand-blue border-l-4 border-l-brand-blue' : 'text-slate-600'}`}
                                                        >
                                                            {s}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    {packStep === 3 && (
                                        <div className="space-y-4">
                                            <h4 className="font-bold text-brand-blue flex items-center gap-2">
                                                <span className="w-6 h-6 rounded-full bg-brand-blue text-white flex items-center justify-center text-xs">3</span>
                                                Détails du pack
                                            </h4>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="font-bold text-slate-700 block mb-1 text-xs uppercase">Durée de la prestation (h)</label>
                                                    <input type="number" placeholder="Ex: 3" className="w-full p-2 border rounded" value={packForm.hours || ''} onChange={e => setPackForm({ ...packForm, hours: Number(e.target.value) })} />
                                                </div>
                                                <div>
                                                    <label className="font-bold text-slate-700 block mb-1 text-xs uppercase">Fréquence / Type</label>
                                                    <select
                                                        className="w-full p-2 border rounded"
                                                        value={packForm.frequency || 'Ponctuelle'}
                                                        onChange={e => {
                                                            const val = e.target.value;
                                                            setPackForm({ ...packForm, frequency: val as any, type: val === 'Ponctuelle' ? 'ponctuel' : 'regulier' });
                                                        }}
                                                    >
                                                        <option value="Ponctuelle">Ponctuelle (1 fois)</option>
                                                        <option value="Hebdomadaire">Hebdomadaire (Chaque semaine)</option>
                                                        <option value="Bimensuelle">Bimensuelle (2 fois/mois)</option>
                                                        <option value="Mensuelle">Mensuelle</option>
                                                        <option value="regulier">Régulier (Personnalisé)</option>
                                                    </select>
                                                </div>
                                            </div>

                                            {/* Intervention Schedules - Mobile Friendly */}
                                            <div className="space-y-3">
                                                <div className="flex justify-between items-center">
                                                    <label className="font-bold text-slate-700 text-xs uppercase">Horaires d'intervention</label>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const currentSchedules = packForm.interventionSchedules || [];
                                                            const newSchedule: InterventionSchedule = {
                                                                day: 'Lundi',
                                                                startTime: '09:00',
                                                                endTime: '12:00'
                                                            };
                                                            setPackForm({
                                                                ...packForm,
                                                                interventionSchedules: [...currentSchedules, newSchedule]
                                                            });
                                                        }}
                                                        className="bg-brand-blue text-white px-3 py-1 rounded text-xs font-bold hover:bg-teal-700"
                                                    >
                                                        + Ajouter un créneau
                                                    </button>
                                                </div>

                                                <div className="space-y-2 max-h-40 overflow-y-auto">
                                                    {(packForm.interventionSchedules || []).map((schedule: any, index: number) => (
                                                        <div key={index} className="flex gap-2 items-center bg-slate-50 p-2 rounded">
                                                            <select
                                                                value={schedule.day}
                                                                onChange={(e) => {
                                                                    const newSchedules = [...(packForm.schedules || [])];
                                                                    newSchedules[index] = { ...schedule, day: e.target.value };
                                                                    setPackForm({ ...packForm, schedules: newSchedules });
                                                                }}
                                                                className="flex-1 p-1 border rounded text-xs"
                                                            >
                                                                <option value="Lundi">Lundi</option>
                                                                <option value="Mardi">Mardi</option>
                                                                <option value="Mercredi">Mercredi</option>
                                                                <option value="Jeudi">Jeudi</option>
                                                                <option value="Vendredi">Vendredi</option>
                                                                <option value="Samedi">Samedi</option>
                                                                <option value="Dimanche">Dimanche</option>
                                                            </select>
                                                            <input
                                                                type="time"
                                                                value={schedule.startTime}
                                                                onChange={(e) => {
                                                                    const newSchedules = [...(packForm.schedules || [])];
                                                                    newSchedules[index] = { ...schedule, startTime: e.target.value };
                                                                    setPackForm({ ...packForm, schedules: newSchedules });
                                                                }}
                                                                className="p-1 border rounded text-xs"
                                                            />
                                                            <span className="text-xs">à</span>
                                                            <input
                                                                type="time"
                                                                value={schedule.endTime}
                                                                onChange={(e) => {
                                                                    const newSchedules = [...(packForm.schedules || [])];
                                                                    newSchedules[index] = { ...schedule, endTime: e.target.value };
                                                                    setPackForm({ ...packForm, schedules: newSchedules });
                                                                }}
                                                                className="p-1 border rounded text-xs"
                                                            />
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    const newSchedules = [...(packForm.schedules || [])];
                                                                    newSchedules.splice(index, 1);
                                                                    setPackForm({ ...packForm, schedules: newSchedules });
                                                                }}
                                                                className="text-red-500 hover:text-red-700 p-1"
                                                            >
                                                                <X className="w-3 h-3" />
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>

                                                {(packForm.interventionSchedules || []).length === 0 && (
                                                    <p className="text-xs text-slate-500 italic">Aucun créneau défini. Cliquez sur "+ Ajouter un créneau" pour définir les horaires.</p>
                                                )}
                                            </div>

                                            {(packForm.frequency === 'regulier' || packForm.type === 'regulier') && (
                                                <div className="bg-blue-50 p-3 rounded border border-blue-200">
                                                    <label className="font-bold text-slate-700 block mb-1 text-xs uppercase">Nombre de jours d'intervention</label>
                                                    <div className="flex items-center gap-2">
                                                        <input
                                                            type="number"
                                                            min="1"
                                                            className="w-20 p-2 border rounded text-center font-bold"
                                                            value={regularDaysCount}
                                                            onChange={e => setRegularDaysCount(Number(e.target.value))}
                                                        />
                                                        <span className="text-sm text-slate-600">jours</span>
                                                    </div>
                                                </div>
                                            )}

                                            <div>
                                                <label className="font-bold text-slate-700 block mb-1 text-xs uppercase">Type de Contrat</label>
                                                <select className="w-full p-2 border rounded" value={packForm.contractType || 'Contrat Prestataire Standard'} onChange={e => setPackForm({ ...packForm, contractType: e.target.value })}>
                                                    {CONTRACT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                                </select>
                                            </div>

                                            <div>
                                                <label className="font-bold text-slate-700 block mb-1 text-xs uppercase">Lieu de réalisation</label>
                                                <input type="text" placeholder="Ex: Domicile Client" className="w-full p-2 border rounded" value={packForm.location || 'Domicile Client'} onChange={e => setPackForm({ ...packForm, location: e.target.value })} />
                                            </div>

                                            <div className="bg-slate-50 p-3 rounded border border-slate-200">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <input type="checkbox" checked={packForm.suppliesIncluded} onChange={e => setPackForm({ ...packForm, suppliesIncluded: e.target.checked })} className="w-4 h-4 text-brand-blue" />
                                                    <span className="font-bold text-slate-700 text-sm">Matériel / Produits fournis (Oui/Non)</span>
                                                </div>
                                                {packForm.suppliesIncluded && (
                                                    <input type="text" placeholder="Détail fournitures (ex: Désinfectants, Lave-vitres...)" className="w-full p-2 border rounded text-sm" value={packForm.suppliesDetails || ''} onChange={e => setPackForm({ ...packForm, suppliesDetails: e.target.value })} />
                                                )}
                                            </div>

                                            <div>
                                                <label className="font-bold text-slate-700 block mb-1 text-xs uppercase">Tarif TTC (€)</label>
                                                <input type="number" placeholder="Ex: 99" className="w-full p-2 border rounded font-bold text-lg" value={packForm.priceTTC || ''} onChange={e => setPackForm({ ...packForm, priceTTC: Number(e.target.value) })} />

                                                {/* Simulation HT & Reste à charge */}
                                                <div className="mt-2 text-sm space-y-2">
                                                    <div className="bg-slate-100 p-2 rounded flex justify-between">
                                                        <span>Tarif HT (calculé) :</span>
                                                        <strong>{((packForm.priceTTC || 0) / 1.021).toFixed(2)} €</strong>
                                                    </div>
                                                    <div className="bg-green-50 p-2 rounded border border-green-200 flex justify-between text-green-800">
                                                        <span>Montant avec avance immédiate (-50%) :</span>
                                                        <strong>{((packForm.priceTTC || 0) * 0.5).toFixed(2)} €</strong>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* STEP 4: Validation */}
                                    {packStep === 4 && (
                                        <div className="space-y-4 text-center">
                                            <h4 className="font-bold text-brand-blue flex items-center justify-center gap-2 mb-4">
                                                <span className="w-6 h-6 rounded-full bg-brand-blue text-white flex items-center justify-center text-xs">4</span>
                                                Confirmation & Contrat
                                            </h4>

                                            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 text-left space-y-2 text-sm">
                                                <p><strong>Nom :</strong> {packForm.name}</p>
                                                <p><strong>Service :</strong> {packForm.mainService}</p>
                                                <p><strong>Contrat :</strong> {packForm.contractType}</p>
                                                <p><strong>Détails :</strong> {packForm.hours}h, {packForm.frequency} {packForm.type === 'regulier' ? `(${regularDaysCount} jours)` : ''}</p>
                                                <p><strong>Prix Client (Avance) :</strong> {((packForm.priceTTC || 0) * 0.5).toFixed(2)} €</p>
                                            </div>

                                            <div className="flex flex-col items-center gap-2 text-green-600 bg-green-50 p-3 rounded">
                                                <CheckCircle className="w-8 h-8" />
                                                <span className="text-sm font-bold">Un contrat type sera généré automatiquement.</span>
                                            </div>
                                        </div>
                                    )}

                                    <div className="flex justify-between pt-4 border-t border-slate-100">
                                        {packStep > 1 && (
                                            <button onClick={handlePrevPackStep} className="px-4 py-2 text-slate-500 font-bold hover:bg-slate-100 rounded flex items-center gap-1">
                                                <ChevronLeft className="w-4 h-4" /> Précédent
                                            </button>
                                        )}
                                        {packStep < 4 ? (
                                            <button onClick={handleNextPackStep} className="ml-auto px-6 py-2 bg-brand-blue text-white rounded font-bold flex items-center gap-2">
                                                Suivant <ChevronRight className="w-4 h-4" />
                                            </button>
                                        ) : (
                                            <button onClick={handleSavePack} className="ml-auto px-6 py-2 bg-green-600 text-white rounded font-bold flex items-center gap-2 shadow-lg">
                                                <Save className="w-4 h-4" /> Valider
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* UPDATED CONTRACT FORM TO MATCH PDF */}
                            {modalType === 'contract' && (
                                <div className="flex flex-col h-full gap-4">
                                    {/* Visual Header per PDF */}
                                    <div className="bg-cream-100 p-4 rounded-lg border border-beige-200 text-sm text-slate-700 font-serif space-y-1 text-center">
                                        <h4 className="font-bold text-lg uppercase text-brand-blue">{companySettings.name} – SASU</h4>
                                        <p>Siège : {companySettings.address} | Email : {companySettings.email}</p>
                                        <p>N° SAP : {companySettings.siret}</p>
                                        <p className="text-xs italic mt-2 border-t border-beige-300 pt-1 w-fit mx-auto">
                                            Assurance RCP : Contrat n° RCP250714175810 – Assurup (Hiscox) | Validité : 01/08/2025 au 31/07/2026
                                        </p>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 mb-1">Nom du contrat</label>
                                            <input type="text" className="w-full p-2 border rounded text-sm font-bold" placeholder="Ex: Contrat Standard 2024" value={contractForm.name} onChange={e => setContractForm({ ...contractForm, name: e.target.value })} />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 mb-1">Type de Logo (PDF)</label>
                                            <div className="flex items-center gap-4 py-2">
                                                <label className="flex items-center gap-2 cursor-pointer">
                                                    <input type="radio" name="logoType" value="SAP" checked={contractLogoType === 'SAP'} onChange={() => setContractLogoType('SAP')} />
                                                    <span className="text-sm font-bold">Logo SAP</span>
                                                </label>
                                                <label className="flex items-center gap-2 cursor-pointer">
                                                    <input type="radio" name="logoType" value="Standard" checked={contractLogoType === 'Standard'} onChange={() => setContractLogoType('Standard')} />
                                                    <span className="text-sm font-bold">Hors SAP</span>
                                                </label>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Selection Logic */}
                                    <div className="bg-slate-50 p-4 rounded border border-slate-200 flex flex-col md:flex-row gap-4 items-start md:items-end">
                                        <div className="w-full md:flex-1">
                                            <SearchableSelect
                                                label="Client (Infos obligatoires)"
                                                options={clients.map(c => ({ value: c.id, label: c.name }))}
                                                value={selectedClientIdForContract}
                                                onChange={setSelectedClientIdForContract}
                                                placeholder="-- Sélectionner un client --"
                                            />
                                        </div>
                                        <div className="w-full md:flex-1">
                                            <SearchableSelect
                                                label="Pack (Infos Pack)"
                                                options={packs.map(p => ({ value: p.id, label: p.name }))}
                                                value={selectedPackIdForContract}
                                                onChange={setSelectedPackIdForContract}
                                                placeholder="-- Sélectionner un pack --"
                                            />
                                        </div>
                                        <button
                                            onClick={handleGenerateContractContent}
                                            className="w-full md:w-auto bg-brand-blue text-white px-4 py-2 rounded font-bold text-sm hover:bg-teal-700 mt-2 md:mt-0"
                                        >
                                            Générer Contrat
                                        </button>
                                    </div>

                                    <div className="flex flex-col md:flex-row gap-4 mb-4">
                                        <div className="flex-1">
                                            <label className="block text-sm font-bold text-slate-700 mb-1">Nom du Contrat</label>
                                            <input
                                                className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-blue focus:border-transparent"
                                                value={contractForm.name}
                                                onChange={e => setContractForm({ ...contractForm, name: e.target.value })}
                                                placeholder="Nom du contrat..."
                                            />
                                        </div>
                                        <div className="flex items-end gap-2">
                                            <button
                                                onClick={handleGenerateContractContent}
                                                className="w-full md:w-auto bg-brand-blue text-white px-4 py-2 rounded font-bold text-sm hover:bg-teal-700 mt-2 md:mt-0"
                                            >
                                                Générer Contrat
                                            </button>
                                            {contractForm.content && (
                                                <button
                                                    onClick={() => {
                                                        setEditingContractContent(contractForm.content || '');
                                                        setEditingContractId(contractForm.id || 'new');
                                                        setContractEditModalOpen(true);
                                                    }}
                                                    className="w-full md:w-auto bg-green-600 text-white px-4 py-2 rounded font-bold text-sm hover:bg-green-700 mt-2 md:mt-0 flex items-center gap-2"
                                                >
                                                    <Edit className="w-4 h-4" />
                                                    Modifier Texte
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex-1 relative border rounded overflow-hidden">
                                        <textarea
                                            className="w-full h-96 p-6 font-mono text-sm leading-relaxed resize-none bg-white outline-none"
                                            value={contractForm.content}
                                            onChange={e => setContractForm({ ...contractForm, content: e.target.value })}
                                        />
                                    </div>

                                    {/* Footer Visual */}
                                    <div className="flex flex-col md:flex-row justify-between items-center md:items-end p-4 bg-slate-50 border border-slate-200 rounded text-center text-xs text-slate-500 gap-6 md:gap-0">
                                        <div className="w-full md:w-1/3 border-t border-slate-300 pt-2">
                                            <p className="font-bold">Signature du Client</p>
                                            <p>(Précédée de la mention "Lu et approuvé")</p>
                                            <div className="h-16 md:h-10 mt-2 bg-white border border-dashed border-slate-300 rounded flex items-center justify-center">Espace Signature</div>
                                        </div>
                                        <div className="w-full md:w-1/3 border-t border-slate-300 pt-2">
                                            <p className="font-bold">L'Entreprise</p>
                                            <p>(Cachet et Signature)</p>
                                            <div className="h-16 md:h-10 mt-2 bg-white border border-dashed border-slate-300 rounded flex items-center justify-center font-bold text-red-300 relative overflow-hidden">
                                                {contractForm.status === 'active' ? (
                                                    <>
                                                        <img src={COMPANY_STAMP_URL} alt="Cachet" className="absolute bottom-0 right-0 w-16 opacity-50" />
                                                        <span className="relative z-10 text-green-600">VALIDÉ & CACHETÉ</span>
                                                    </>
                                                ) : 'EN ATTENTE VALIDATION'}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex justify-end gap-2 pt-2">
                                        <button onClick={() => setIsModalOpen(false)} className="px-6 py-2 border rounded font-bold text-slate-500">Annuler</button>
                                        <button onClick={handleSaveContract} className="px-6 py-2 bg-brand-blue text-white rounded font-bold hover:bg-teal-700 flex items-center gap-2">
                                            <Save className="w-4 h-4" /> Enregistrer le Contrat
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* ... [Reminder and Expense forms unchanged] ... */}
                            {modalType === 'reminder' && (
                                <div className="space-y-4">
                                    <div><label className="font-bold text-slate-700 block mb-1">Message</label><input type="text" className="w-full p-2 border rounded" value={reminderForm.text} onChange={e => setReminderForm({ ...reminderForm, text: e.target.value })} placeholder="Ex: Relancer client X" /></div>
                                    <div><label className="font-bold text-slate-700 block mb-1">Date</label><input type="date" className="w-full p-2 border rounded" value={reminderForm.date} onChange={e => setReminderForm({ ...reminderForm, date: e.target.value })} /></div>
                                    <div className="flex items-center gap-2"><input type="checkbox" checked={reminderForm.notifyEmail} onChange={e => setReminderForm({ ...reminderForm, notifyEmail: e.target.checked })} className="w-5 h-5" /><span className="font-bold text-slate-700">Notification Email</span></div>
                                    <div className="flex justify-end pt-4"><button onClick={handleSaveReminder} className="px-6 py-2 bg-brand-orange text-white rounded font-bold">Ajouter</button></div>
                                </div>
                            )}

                            {modalType === 'expense' && (
                                <div className="space-y-4">
                                    <div><label className="font-bold text-slate-700 block mb-1">Description</label><input type="text" className="w-full p-2 border rounded" value={expenseForm.description || ''} onChange={e => setExpenseForm({ ...expenseForm, description: e.target.value })} /></div>
                                    <div><label className="font-bold text-slate-700 block mb-1">Montant (€)</label><input type="number" className="w-full p-2 border rounded" value={expenseForm.amount || 0} onChange={e => setExpenseForm({ ...expenseForm, amount: Number(e.target.value) })} /></div>
                                    <div><label className="font-bold text-slate-700 block mb-1">Date</label><input type="date" className="w-full p-2 border rounded" value={expenseForm.date || ''} onChange={e => setExpenseForm({ ...expenseForm, date: e.target.value })} /></div>
                                    <div><label className="font-bold text-slate-700 block mb-1">Catégorie</label><select className="w-full p-2 border rounded" value={expenseForm.category || 'fournitures'} onChange={e => setExpenseForm({ ...expenseForm, category: e.target.value as any })}><option value="fournitures">Fournitures</option><option value="carburant">Carburant</option><option value="administratif">Administratif</option><option value="autre">Autre</option></select></div>
                                    <div className="flex justify-end pt-4">
                                        <button onClick={handleSaveExpense} className="px-6 py-2 bg-slate-800 text-white rounded font-bold">
                                            {expenseForm.id ? 'Mettre à jour' : 'Enregistrer'}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {deleteConfirmOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm animate-in fade-in zoom-in duration-200">
                        <div className="flex flex-col items-center text-center">
                            <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-4">
                                <AlertTriangle className="w-6 h-6" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-800 mb-2">Confirmer la suppression</h3>
                            <p className="text-sm text-slate-500 mb-6">
                                Êtes-vous sûr de vouloir supprimer {selectedPackIds.size} pack(s) ? Cette action est irréversible.
                            </p>
                            <div className="flex gap-3 w-full">
                                <button
                                    onClick={() => setDeleteConfirmOpen(false)}
                                    className="flex-1 py-2 text-slate-600 font-bold bg-slate-100 hover:bg-slate-200 rounded-lg transition"
                                >
                                    Annuler
                                </button>
                                <button
                                    onClick={executeDeletePacks}
                                    className="flex-1 py-2 text-white font-bold bg-red-600 hover:bg-red-700 rounded-lg transition shadow-md"
                                >
                                    Supprimer
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Custom Confirmation Modal */}
            {confirmationModal.open && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm animate-in fade-in zoom-in duration-200">
                        <div className="flex flex-col items-center text-center">
                            <div className="w-12 h-12 bg-blue-100 text-brand-blue rounded-full flex items-center justify-center mb-4">
                                <HelpCircle className="w-6 h-6" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-800 mb-2">{confirmationModal.title}</h3>
                            <p className="text-sm text-slate-500 mb-6">{confirmationModal.message}</p>
                            <div className="flex gap-3 w-full">
                                <button onClick={closeConfirmation} className="flex-1 py-2 text-slate-600 font-bold bg-slate-100 hover:bg-slate-200 rounded-lg transition">Annuler</button>
                                <button onClick={() => { confirmationModal.onConfirm(); closeConfirmation(); }} className="flex-1 py-2 text-white font-bold bg-brand-blue hover:bg-teal-700 rounded-lg transition shadow-md">Confirmer</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Quote Selection Modal */}
            {showQuoteSelectionModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl shadow-2xl p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-bold text-slate-800">Sélectionner un devis</h3>
                            <button onClick={() => setShowQuoteSelectionModal(false)} className="text-slate-400 hover:text-slate-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <p className="text-sm text-slate-600 mb-4">
                            Plusieurs devis ont été trouvés pour ce client. Veuillez en sélectionner un pour générer le contrat.
                        </p>
                        <div className="space-y-3">
                            {selectedQuoteForContract.map((quote: any) => (
                                <div key={quote.id} className="border border-slate-200 rounded-lg p-4 hover:border-brand-blue hover:bg-blue-50 cursor-pointer transition-all" onClick={() => proceedWithContractGeneration(quote)}>
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h4 className="font-bold text-slate-800">{quote.ref}</h4>
                                            <p className="text-sm text-slate-600">Date: {quote.date}</p>
                                            <p className="text-sm text-slate-600">Montant: {quote.totalTTC} €</p>
                                            <p className="text-sm text-slate-600">Statut: {quote.status === 'sent' ? 'Envoyé' : 'Signé'}</p>
                                        </div>
                                        <div className="text-brand-blue">
                                            <CheckCircle className="w-5 h-5" />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Contract Edit Modal */}
            {contractEditModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl shadow-2xl p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
                        <div className="flex justify-between items-center mb-4">
                            <div>
                                <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                    <Edit className="w-5 h-5 text-green-600" />
                                    Modifier le texte du contrat
                                </h3>
                                <p className="text-sm text-slate-600 mt-1">
                                    Modifiez facilement le contenu du contrat avec l'éditeur ci-dessous
                                </p>
                            </div>
                            <button onClick={closeContractEditModal} className="text-slate-400 hover:text-slate-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="flex-1 flex flex-col min-h-0">
                            <div className="flex-1 relative border-2 border-green-200 rounded-lg overflow-hidden bg-green-50">
                                <div className="absolute top-2 left-2 bg-green-600 text-white px-2 py-1 rounded text-xs font-bold flex items-center gap-1">
                                    <Edit className="w-3 h-3" />
                                    Mode Édition
                                </div>
                                <div className="absolute top-2 right-2 flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setUseRichContractEditor(v => !v)}
                                        className="px-2 py-1 rounded text-xs font-bold border bg-white text-slate-700 hover:bg-slate-50"
                                    >
                                        {useRichContractEditor ? 'Mode simple' : 'Éditeur enrichi'}
                                    </button>
                                </div>

                                {useRichContractEditor ? (
                                    <div className="w-full h-96 p-4 bg-white">
                                        <div className="flex flex-wrap items-center gap-2 pb-3 mb-3 border-b border-slate-200">
                                            <button type="button" onClick={() => execEditorCommand('bold')} className="px-2 py-1 rounded border bg-slate-50 hover:bg-slate-100 text-sm font-bold">B</button>
                                            <button type="button" onClick={() => execEditorCommand('italic')} className="px-2 py-1 rounded border bg-slate-50 hover:bg-slate-100 text-sm italic">I</button>
                                            <button type="button" onClick={() => execEditorCommand('underline')} className="px-2 py-1 rounded border bg-slate-50 hover:bg-slate-100 text-sm underline">U</button>
                                            <div className="w-px h-6 bg-slate-200 mx-1" />
                                            <button type="button" onClick={() => execEditorCommand('insertUnorderedList')} className="px-2 py-1 rounded border bg-slate-50 hover:bg-slate-100 text-sm">Liste</button>
                                            <button type="button" onClick={() => execEditorCommand('insertOrderedList')} className="px-2 py-1 rounded border bg-slate-50 hover:bg-slate-100 text-sm">1.2.3.</button>
                                            <div className="w-px h-6 bg-slate-200 mx-1" />
                                            <button type="button" onClick={() => execEditorCommand('removeFormat')} className="px-2 py-1 rounded border bg-slate-50 hover:bg-slate-100 text-sm">Nettoyer</button>
                                            <div className="flex-1" />
                                            <div className="text-xs text-slate-500">
                                                {stripHtmlToText(editingContractContent).length} caractères
                                            </div>
                                        </div>

                                        <div
                                            ref={contractEditorRef}
                                            className="w-full h-[calc(100%-56px)] overflow-auto outline-none text-sm leading-relaxed"
                                            contentEditable
                                            suppressContentEditableWarning
                                            onInput={() => setEditingContractContent(contractEditorRef.current?.innerHTML || '')}
                                            onBlur={() => setEditingContractContent(contractEditorRef.current?.innerHTML || '')}
                                        />
                                    </div>
                                ) : (
                                    <textarea
                                        className="w-full h-96 p-6 font-mono text-sm leading-relaxed resize-none bg-white outline-none border-0"
                                        value={editingContractContent}
                                        onChange={e => setEditingContractContent(e.target.value)}
                                        placeholder="Contenu du contrat..."
                                        autoFocus
                                    />
                                )}

                                <div className="mt-4 border border-slate-200 rounded-lg bg-white overflow-hidden">
                                    <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                                        <div className="text-xs font-bold text-slate-700">Aperçu (lecture)</div>
                                        <div className="text-[11px] text-slate-500">Articles mis en gras</div>
                                    </div>
                                    <div
                                        className="p-4 max-h-56 overflow-auto text-sm leading-relaxed text-slate-800"
                                        dangerouslySetInnerHTML={{ __html: contractPreviewHtml }}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-between items-center mt-4 pt-4 border-t border-slate-200">
                            <div className="text-sm text-slate-500">
                                <p>• Le contrat sera marqué comme modifiable</p>
                                <p>• Les modifications seront sauvegardées automatiquement</p>
                            </div>
                            <div className="flex gap-3">
                                <button
                                    onClick={closeContractEditModal}
                                    className="px-6 py-2 text-slate-600 font-bold bg-slate-100 hover:bg-slate-200 rounded-lg transition"
                                >
                                    Annuler
                                </button>
                                <button
                                    onClick={saveContractEdit}
                                    className="px-6 py-2 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 transition shadow-md flex items-center gap-2"
                                >
                                    <Save className="w-4 h-4" />
                                    Sauvegarder les modifications
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Pack Details Modal */}
            {packDetailsModal.open && packDetailsModal.pack && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6">
                            <div className="flex justify-between items-start mb-4">
                                <h3 className="text-xl font-bold text-slate-800">Détails du Pack</h3>
                                <button
                                    onClick={() => setPackDetailsModal({ open: false, pack: null })}
                                    className="text-slate-400 hover:text-slate-600 transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-slate-50 p-3 rounded">
                                        <p className="text-xs text-slate-500 uppercase font-bold">Nom du pack</p>
                                        <p className="font-bold text-slate-800">{packDetailsModal.pack.name}</p>
                                    </div>
                                    <div className="bg-slate-50 p-3 rounded">
                                        <p className="text-xs text-slate-500 uppercase font-bold">Service principal</p>
                                        <p className="font-bold text-slate-800">{packDetailsModal.pack.mainService}</p>
                                    </div>
                                </div>

                                <div className="bg-blue-50 p-3 rounded">
                                    <p className="text-xs text-blue-500 uppercase font-bold mb-2">Description</p>
                                    <p className="text-slate-700">{packDetailsModal.pack.description}</p>
                                </div>

                                <div className="grid grid-cols-3 gap-4">
                                    <div className="bg-green-50 p-3 rounded">
                                        <p className="text-xs text-green-500 uppercase font-bold">Durée</p>
                                        <p className="font-bold text-green-800">{packDetailsModal.pack.hours}h</p>
                                    </div>
                                    <div className="bg-purple-50 p-3 rounded">
                                        <p className="text-xs text-purple-500 uppercase font-bold">Fréquence</p>
                                        <p className="font-bold text-purple-800">{packDetailsModal.pack.frequency}</p>
                                    </div>
                                    <div className="bg-orange-50 p-3 rounded">
                                        <p className="text-xs text-orange-500 uppercase font-bold">Lieu</p>
                                        <p className="font-bold text-orange-800">{packDetailsModal.pack.location || 'Domicile Client'}</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 gap-4">
                                    <div className="bg-yellow-50 p-3 rounded">
                                        <p className="text-xs text-yellow-500 uppercase font-bold">Prix TTC</p>
                                        <p className="font-bold text-yellow-800">{packDetailsModal.pack.priceTTC}€</p>
                                    </div>
                                </div>
                                {/* Prix HT masqué */}
                                {/* <div className="bg-slate-50 p-3 rounded">
                                    <p className="text-xs text-slate-500 uppercase font-bold">Prix HT</p>
                                    <p className="font-bold text-slate-800">{packDetailsModal.pack.priceHT}€</p>
                                </div> */}

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-green-50 p-3 rounded">
                                        <p className="text-xs text-green-500 uppercase font-bold">Crédit Impôt</p>
                                        <p className="font-bold text-green-800">{packDetailsModal.pack.priceTaxCredit}€</p>
                                    </div>
                                    <div className="bg-blue-50 p-3 rounded">
                                        <p className="text-xs text-blue-500 uppercase font-bold">Type de contrat</p>
                                        <p className="font-bold text-blue-800">{packDetailsModal.pack.contractType}</p>
                                    </div>
                                </div>

                                <div className="bg-purple-50 p-3 rounded">
                                    <p className="text-xs text-purple-500 uppercase font-bold">Matériel inclus</p>
                                    <p className="font-bold text-purple-800">{packDetailsModal.pack.suppliesIncluded ? 'Oui' : 'Non'}</p>
                                </div>


                                {packDetailsModal.pack.suppliesDetails && (
                                    <div className="bg-amber-50 p-3 rounded">
                                        <p className="text-xs text-amber-500 uppercase font-bold mb-2">Détails du matériel</p>
                                        <p className="text-slate-700">{packDetailsModal.pack.suppliesDetails}</p>
                                    </div>
                                )}

                                {packDetailsModal.pack.quantity && (
                                    <div className="bg-slate-50 p-3 rounded">
                                        <p className="text-xs text-slate-500 uppercase font-bold mb-2">Quantité/Spécificités</p>
                                        <p className="text-slate-700">{packDetailsModal.pack.quantity}</p>
                                    </div>
                                )}

                                {/* Debug information - Masqué */}
                                {/* <div className="bg-red-50 p-3 rounded border border-red-200">
                                    <p className="text-xs text-red-500 uppercase font-bold mb-2">Débogage - Données brutes</p>
                                    <p className="text-xs text-slate-600 font-mono">
                                        Frequency: {packDetailsModal.pack.frequency}<br/>
                                        Quantity: {packDetailsModal.pack.quantity || 'non défini'}<br/>
                                        Hours: {packDetailsModal.pack.hours}<br/>
                                        Description: {packDetailsModal.pack.description}<br/>
                                        Calculé: {calculatePackDuration(packDetailsModal.pack)}
                                    </p>
                                </div> */}
                            </div>

                            <div className="flex justify-end mt-6 pt-4 border-t border-slate-200">
                                <button
                                    onClick={() => setPackDetailsModal({ open: false, pack: null })}
                                    className="px-6 py-2 bg-slate-600 text-white rounded-lg font-bold hover:bg-slate-700 transition"
                                >
                                    Fermer
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Secretariat;
