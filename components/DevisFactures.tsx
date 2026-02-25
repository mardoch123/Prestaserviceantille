import React, { useState, useEffect, useMemo, useRef } from 'react';
import dayjs from 'dayjs';
import { Plus, Search, X, CheckCircle, Filter, FileText, Mail, Copy, Trash2, Paperclip, ArrowRight, RefreshCw, CreditCard, Send, AlertTriangle, RotateCcw, Zap, CheckSquare, Square, Calendar, ChevronDown, ChevronUp, PlusCircle, Loader2, Clock, PenTool, UploadCloud } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { matchesServiceTypeFilterFromText } from '../utils/serviceTypes';
import { Mission, Document, Contract } from '../types';
import SearchableSelect from './SearchableSelect';
import { getMartiniqueNowISO, getMartiniqueToday } from '../src/utils/martiniqueTime';
import { getMartiniqueNow as getMartiniqueNowDayjs, MARTINIQUE_TIMEZONE } from '../src/utils/dayjsMartinique';
import { supabase } from '../utils/supabaseClient';

// Hook pour détecter si l'écran est mobile
const useIsMobile = () => {
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    return isMobile;
};

interface InterventionSlot {
    id: string;
    date: string;
    startTime: string;
    endTime: string;
    duration: number;
}

type QuoteDraftFormState = {
    selectedClientId: string;
    serviceType: 'pack' | 'custom';
    selectedPackId: string;
    packQuantity: number;
    customDescription: string;
    unitPrice: number;
    tvaRate: 0 | 2.1 | 8.5;
    taxCreditActive: boolean;
    interventionSlots: InterventionSlot[];
    packSpecificConfig: any;
    customLines: Array<{
        id: string;
        description: string;
        unitPrice: number;
        quantity: number;
    }>;
};

type QuoteDraft = {
    id: string;
    ref: string;
    createdAt: string;
    updatedAt: string;
    userId: string;
    form: QuoteDraftFormState;
};

const DevisFactures: React.FC = () => {
    const { packs, addMission, documents, addDocument, updateDocument, upsertDocumentDraft, convertQuoteToInvoice, deleteDocument, deleteDocuments, duplicateDocument, clients, markInvoicePaid, updateDocumentStatus, sendDocumentReminder, sendQuoteSignatureReminder, addNotification, missions, providers, addContract, generateContractFromTemplate, downloadContract, contracts, currentUser, signQuoteAsAdmin, serviceTypeFilter, sendEmail } = useData();
    const isMobile = useIsMobile();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState<'devis' | 'facture'>('devis');
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc'); // Tri par ordre de création (desc = plus récent d'abord)

    // Selection State
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // Delete Confirmation Modal State (Single & Bulk)
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [documentToDelete, setDocumentToDelete] = useState<{ id: string, ref: string } | null>(null);
    const [isBulkDelete, setIsBulkDelete] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    // Document Detail Modal State
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [selectedDocument, setSelectedDocument] = useState<any>(null);

    const [isAdminSignModalOpen, setIsAdminSignModalOpen] = useState(false);
    const [adminSignDocumentId, setAdminSignDocumentId] = useState<string | null>(null);
    const [adminSignatureDataUrl, setAdminSignatureDataUrl] = useState<string>('');
    const [adminSignatureFileName, setAdminSignatureFileName] = useState<string>('');
    const [isAdminSigning, setIsAdminSigning] = useState(false);
    const [isAdminSignDragOver, setIsAdminSignDragOver] = useState(false);
    const adminSignatureInputRef = useRef<HTMLInputElement | null>(null);

    const location = useLocation();
    const navigate = useNavigate();

    // --- Form State ---
    const [selectedClientId, setSelectedClientId] = useState<string>('');
    const [serviceType, setServiceType] = useState<'pack' | 'custom'>('pack');
    const [selectedPackId, setSelectedPackId] = useState<string>('');
    const [packQuantity, setPackQuantity] = useState<number>(1);
    const [customDescription, setCustomDescription] = useState('');
    const [unitPrice, setUnitPrice] = useState<number>(0);

    const [tvaRate, setTvaRate] = useState<0 | 2.1 | 8.5>(2.1);
    const [taxCreditActive, setTaxCreditActive] = useState(false);

    // Loading state
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [duplicatingIds, setDuplicatingIds] = useState<Set<string>>(new Set());
    const [prefilledRef, setPrefilledRef] = useState<string>('');
    const [editingDocumentId, setEditingDocumentId] = useState<string | null>(null);
    const [editingDocumentStatus, setEditingDocumentStatus] = useState<string>('');

    const isPrefillingFromDbRef = useRef(false);

    const [loadingActions, setLoadingActions] = useState<Set<string>>(new Set());

    const startAction = (key: string) => {
        setLoadingActions(prev => {
            const next = new Set(prev);
            next.add(key);
            return next;
        });
    };

    const stopAction = (key: string) => {
        setLoadingActions(prev => {
            const next = new Set(prev);
            next.delete(key);
            return next;
        });
    };

    const renewExpiredQuote = async (doc: any, e?: React.MouseEvent) => {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }

        const id = String(doc?.id || '').trim();
        if (!id) return;
        if (isLocalDraftDocId(id)) return;
        if (String(doc?.type || '') !== 'Devis') return;
        if (String(doc?.status || '') !== 'expired') return;

        const ok = window.confirm(`Renouveler le devis ${doc?.ref || ''} ? Il repassera en Envoyé et sera re-signable.`);
        if (!ok) return;

        const key = `renew:${id}`;
        const nowIso = new Date().toISOString();
        const today = getMartiniqueToday();

        try {
            startAction(key);
            const res = await supabase
                .from('documents')
                .update({ status: 'sent', created_at: nowIso, date: today })
                .eq('id', id)
                .select()
                .maybeSingle();
            if (res.error) throw res.error;

            showToast('Devis renouvelé.', 'success');
            window.location.reload();
        } catch (err: any) {
            console.error('[DevisFactures] renewExpiredQuote error:', err);
            showToast(`Erreur renouvellement devis: ${err?.message || err}`, 'error');
        } finally {
            stopAction(key);
        }
    };

    // Planification Prévisionnelle Enhancements
    const [interventionSlots, setInterventionSlots] = useState<InterventionSlot[]>([]);

    const [providersModalOpen, setProvidersModalOpen] = useState(false);
    const [providersModalTitle, setProvidersModalTitle] = useState('');
    const [providersModalItems, setProvidersModalItems] = useState<any[]>([]);

    const getAvailableProvidersForSlot = (slot: InterventionSlot): any[] => {
        if (!slot?.date) return [];

        const slotStart = dayjs.tz(`${slot.date} ${slot.startTime}`, 'YYYY-MM-DD HH:mm', MARTINIQUE_TIMEZONE);
        const slotEnd = dayjs.tz(`${slot.date} ${slot.endTime}`, 'YYYY-MM-DD HH:mm', MARTINIQUE_TIMEZONE);
        if (!slotStart.isValid() || !slotEnd.isValid()) return [];

        const conflictingMissions = missions.filter(m => {
            if (m.status === 'cancelled' || !m.date) return false;
            const mStart = dayjs.tz(`${m.date} ${m.startTime}`, 'YYYY-MM-DD HH:mm', MARTINIQUE_TIMEZONE);
            const mEnd = dayjs.tz(`${m.date} ${m.endTime}`, 'YYYY-MM-DD HH:mm', MARTINIQUE_TIMEZONE);
            if (!mStart.isValid() || !mEnd.isValid()) return false;
            return (slotStart.valueOf() < mEnd.valueOf() && slotEnd.valueOf() > mStart.valueOf());
        });

        return providers.filter((provider: any) => {
            const isActive = provider.status === 'Active';
            if (!isActive) return false;

            const day = dayjs.tz(slot.date, 'YYYY-MM-DD', MARTINIQUE_TIMEZONE).day();
            const nonWorkingDays = (provider as any)?.nonInterventionDays;
            if (Array.isArray(nonWorkingDays) && nonWorkingDays.includes(day)) return false;

            const hourRanges = (provider as any)?.nonInterventionHours && typeof (provider as any)?.nonInterventionHours === 'object'
                ? (provider as any).nonInterventionHours[day]
                : undefined;
            if (Array.isArray(hourRanges) && hourRanges.length > 0) {
                const s = String(slot.startTime || '').slice(0, 5);
                const e = String(slot.endTime || '').slice(0, 5);
                const blocked = hourRanges.some((r: any) => {
                    const rStart = String(r?.start || '').slice(0, 5);
                    const rEnd = String(r?.end || '').slice(0, 5);
                    if (!rStart || !rEnd) return false;
                    return s < rEnd && e > rStart;
                });
                if (blocked) return false;
            }

            const hasLeave = provider.leaves && provider.leaves.some((leave: any) => {
                const startTime = leave?.startTime ? String(leave.startTime).slice(0, 5) : '00:00';
                const endTime = leave?.endTime ? String(leave.endTime).slice(0, 5) : '23:59';

                const leaveStart = dayjs.tz(`${leave.startDate} ${startTime}`, 'YYYY-MM-DD HH:mm', MARTINIQUE_TIMEZONE);
                const leaveEnd = dayjs.tz(`${leave.endDate} ${endTime}`, 'YYYY-MM-DD HH:mm', MARTINIQUE_TIMEZONE);
                if (!leaveStart.isValid() || !leaveEnd.isValid()) return false;

                return slotStart.valueOf() < leaveEnd.valueOf() && slotEnd.valueOf() > leaveStart.valueOf();
            });
            if (hasLeave) return false;

            const hasConflict = conflictingMissions.some(m => m.providerId === provider.id);
            if (hasConflict) return false;

            return true;
        });
    };

    const slotAvailability = useMemo(() => {
        const map = new Map<string, any[]>();
        (interventionSlots || []).forEach((slot) => {
            if (!slot?.id) return;
            map.set(slot.id, getAvailableProvidersForSlot(slot));
        });
        return map;
    }, [interventionSlots, providers, missions]);

    const openProvidersModal = (slot: InterventionSlot) => {
        const list = slotAvailability.get(slot.id) || [];
        setProvidersModalItems(list);
        setProvidersModalTitle(`${slot.date} ${slot.startTime}-${slot.endTime}`);
        setProvidersModalOpen(true);
    };

    // Use Case Logic States
    const [packSpecificConfig, setPackSpecificConfig] = useState<{
        frequencyChoice?: string; // "4j x 3h" or "3j x 4h" for Tranquility
        customDays?: number; // For Personnalisé
        customTotalHours?: number; // For Personnalisé
    }>({});

    // État pour les lignes de prestations personnalisées
    const [customLines, setCustomLines] = useState<Array<{
        id: string;
        description: string;
        unitPrice: number;
        quantity: number;
    }>>([]);

    const DRAFT_LIMIT = 10;
    const draftBlockedMessage = "Ce devis ne sera pas enregistré comme brouillon car vous avez déjà 10 devis brouillons enregistrés.";

    const draftStorageKey = useMemo(() => {
        const uid = String(currentUser?.id || 'anonymous');
        return `presta_quote_drafts_v1:${uid}`;
    }, [currentUser?.id]);

    const [localQuoteDrafts, setLocalQuoteDrafts] = useState<QuoteDraft[]>([]);
    const [localDraftId, setLocalDraftId] = useState<string | null>(null);
    const [isDraftBlocked, setIsDraftBlocked] = useState(false);
    const [isDraftDirty, setIsDraftDirty] = useState(false);
    const autosaveTimeoutRef = useRef<number | null>(null);

    const generateUUID = () => {
        if (typeof crypto !== 'undefined' && (crypto as any).randomUUID) {
            return (crypto as any).randomUUID();
        }
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    };

    const isLocalDraftDocId = (id?: string | null) => {
        return String(id || '').startsWith('localdraft:');
    };

    const parseLocalDraftIdFromDocId = (docId: string) => {
        return String(docId || '').replace(/^localdraft:/, '');
    };

    const loadLocalDrafts = (): QuoteDraft[] => {
        try {
            const raw = localStorage.getItem(draftStorageKey);
            const parsed = raw ? JSON.parse(raw) : [];
            const items = Array.isArray(parsed) ? parsed : [];
            return items
                .filter(Boolean)
                .map((d: any) => ({
                    id: String(d.id || ''),
                    ref: String(d.ref || ''),
                    createdAt: String(d.createdAt || ''),
                    updatedAt: String(d.updatedAt || ''),
                    userId: String(d.userId || ''),
                    form: d.form as QuoteDraftFormState
                }))
                .filter((d: QuoteDraft) => !!d.id)
                .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))
                .slice(0, DRAFT_LIMIT);
        } catch {
            return [];
        }
    };

    const persistLocalDrafts = (items: QuoteDraft[]) => {
        try {
            localStorage.setItem(draftStorageKey, JSON.stringify(items.slice(0, DRAFT_LIMIT)));
        } catch { }
    };

    useEffect(() => {
        const drafts = loadLocalDrafts();
        setLocalQuoteDrafts(drafts);
    }, [draftStorageKey]);

    const getNowMartinique = (): Date => new Date();

    const getTodayMartiniqueStr = (): string => getMartiniqueToday();

    const toMartiniqueISODate = (d: Date): string => {
        return dayjs(d).tz(MARTINIQUE_TIMEZONE).format('YYYY-MM-DD');
    };

    const pad2 = (n: number) => String(n).padStart(2, '0');

    const roundUpToNext5Minutes = (d: Date): Date => {
        // IMPORTANT: le navigateur peut être dans un autre fuseau. On calcule en Martinique via dayjs.tz.
        const base = dayjs(d).tz(MARTINIQUE_TIMEZONE).second(0).millisecond(0);
        const minutes = base.minute();
        const rounded = Math.ceil(minutes / 5) * 5;
        const next = rounded === 60 ? base.add(1, 'hour').minute(0) : base.minute(rounded);
        return next.toDate();
    };

    const toHHMM = (d: Date): string => dayjs(d).tz(MARTINIQUE_TIMEZONE).format('HH:mm');

    const isDateTodayMartinique = (dateStr: string): boolean => {
        return String(dateStr || '') === getTodayMartiniqueStr();
    };

    const getMinStartTimeForSlot = (slotDate: string): string | undefined => {
        if (!slotDate) return undefined;
        if (!isDateTodayMartinique(slotDate)) return undefined;
        return toHHMM(roundUpToNext5Minutes(getNowMartinique()));
    };

    const isSlotStartInPast = (slotDate: string, startTime: string): boolean => {
        if (!slotDate || !startTime) return false;
        const slotStart = dayjs.tz(`${slotDate} ${startTime}`, 'YYYY-MM-DD HH:mm', MARTINIQUE_TIMEZONE);
        return slotStart.isBefore(getMartiniqueNowDayjs());
    };

    const toMartiniqueDayStart = (dateStr: string) => {
        if (!dateStr) return null;
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
            return dayjs.tz(dateStr, 'YYYY-MM-DD', MARTINIQUE_TIMEZONE).startOf('day');
        }
        return dayjs.tz(dateStr, MARTINIQUE_TIMEZONE).startOf('day');
    };

    const toMartiniqueDayEnd = (dateStr: string) => {
        if (!dateStr) return null;
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
            return dayjs.tz(dateStr, 'YYYY-MM-DD', MARTINIQUE_TIMEZONE).endOf('day');
        }
        return dayjs.tz(dateStr, MARTINIQUE_TIMEZONE).endOf('day');
    };

    const selectedClient = clients.find(c => c.id === selectedClientId);
    const detailClient = selectedDocument ? clients.find(c => c.id === selectedDocument.clientId) : undefined;

    useEffect(() => {
        if (!location.state) return;

        const state = location.state as { filter?: string; documentId?: string };

        if (state.filter) {
            const filter = String(state.filter);
            if (filter === 'devis' || filter === 'quote') {
                setFilterStatus('all');
                setColumnFilters(prev => ({
                    ...prev,
                    type: 'devis'
                }));
            } else {
                setFilterStatus(filter);
            }
        }

        if (state.documentId) {
            const docId = String(state.documentId);
            const doc = (documents || []).find((d: any) => String(d?.id || '') === docId);
            if (doc) {
                openDetailModal(doc);
            }
        }

        if (state.filter || state.documentId) {
            navigate(location.pathname, { replace: true, state: {} });
        }
    }, [location.state, location.pathname, documents, navigate]);

    const openModal = (mode: 'devis' | 'facture') => {
        setModalMode(mode);
        setIsModalOpen(true);
        setPrefilledRef('');
        setEditingDocumentId(null);
        setLocalDraftId(null);
        if (mode === 'devis') {
            const drafts = loadLocalDrafts();
            setIsDraftBlocked(drafts.length >= DRAFT_LIMIT);
        } else {
            setIsDraftBlocked(false);
        }
        setIsDraftDirty(false);
        setSelectedClientId('');
        setServiceType('pack');
        setPackQuantity(1);
        setUnitPrice(0);
        setCustomDescription('');
        setTvaRate(0); // TVA à 0% par défaut pour les particuliers
        setTaxCreditActive(false);
        setSelectedPackId('');
        setInterventionSlots([]);
        setPackSpecificConfig({});
        setCustomLines([]); // Réinitialiser les lignes personnalisées
    };

    const closeModal = (options?: { skipAutosave?: boolean }) => {
        if (modalMode === 'devis') {
            if (autosaveTimeoutRef.current) {
                clearTimeout(autosaveTimeoutRef.current);
                autosaveTimeoutRef.current = null;
            }

            if (!options?.skipAutosave) {
                if (!isDraftBlocked && isDraftDirty) {
                    const res = doDraftAutosave(true);
                    if (res === 'blocked') {
                        showToast(draftBlockedMessage, 'warning');
                    }
                }
                if (isDraftBlocked && isDraftDirty) {
                    showToast(draftBlockedMessage, 'warning');
                }
            }
        }
        setIsModalOpen(false);
        setPrefilledRef('');
        setEditingDocumentId(null);
        setLocalDraftId(null);
        setIsDraftBlocked(false);
        setIsDraftDirty(false);
    };

    const openDuplicateModal = (doc: any) => {
        const nextMode: 'devis' | 'facture' = doc?.type === 'Facture' ? 'facture' : 'devis';
        setModalMode(nextMode);
        setIsModalOpen(true);
        setEditingDocumentId(String(doc?.id || ''));
        setEditingDocumentStatus(String(doc?.status || ''));

        setLocalDraftId(null);
        setIsDraftBlocked(false);
        setIsDraftDirty(false);

        // Prefill the form with the existing document values
        setSelectedClientId(String(doc?.clientId || ''));
        const initialPackId = String(doc?.packId || '');
        if (initialPackId) {
            setServiceType('pack');
        } else {
            setServiceType((doc?.category === 'custom' ? 'custom' : 'pack') as any);
        }
        setSelectedPackId(initialPackId);
        setPackQuantity(Number(doc?.quantity || 1));
        setUnitPrice(Number(doc?.unitPrice || 0));
        setCustomDescription(String(doc?.description || ''));
        setTvaRate((Number(doc?.tvaRate || 0) as any));
        setTaxCreditActive(!!doc?.taxCreditEnabled);
        setInterventionSlots(normalizeSlots(doc?.slotsData));
        setPackSpecificConfig({});
        setCustomLines([]);

        setPrefilledRef(String(doc?.ref || ''));

        // Best-effort: fetch the latest persisted draft/validated data from DB so pack/slots are restored.
        void (async () => {
            try {
                const docId = String(doc?.id || '').trim();
                if (!docId) return;
                const status = String(doc?.status || '').trim().toLowerCase();
                const type = String(doc?.type || '').trim().toLowerCase();
                if (type !== 'devis') return;
                if (status !== 'draft' && status !== 'validated') return;

                console.log('[DevisFactures] Prefill from DB for', { docId, status });

                const { data: dbDoc, error } = await supabase
                    .from('documents')
                    .select('*')
                    .eq('id', docId)
                    .maybeSingle();

                if (error) {
                    console.warn('[DevisFactures] Prefill DB fetch error (possible RLS):', error);
                    return;
                }
                if (!dbDoc) {
                    console.warn('[DevisFactures] Prefill DB fetch returned null (possible RLS) for', docId);
                    return;
                }

                const clientId = String((dbDoc as any).client_id || (dbDoc as any).clientId || '');
                const packIdRaw = (dbDoc as any).pack_id ?? (dbDoc as any).packId;
                const packId = packIdRaw ? String(packIdRaw) : '';
                const slots = (dbDoc as any).slots_data || (dbDoc as any).slotsData;

                console.log('[DevisFactures] Prefill DB values:', {
                    clientId,
                    packId,
                    slotsCount: Array.isArray(slots) ? slots.length : null,
                });

                // Prevent pack-change effect from wiping restored slots.
                isPrefillingFromDbRef.current = true;
                try {
                    if (clientId) setSelectedClientId(clientId);
                    if (packId) {
                        setServiceType('pack');
                        setSelectedPackId(packId);
                    }
                    setInterventionSlots(normalizeSlots(slots));
                } finally {
                    setTimeout(() => {
                        isPrefillingFromDbRef.current = false;
                    }, 0);
                }
            } catch (e) {
                console.warn('[DevisFactures] Prefill DB fetch unexpected error:', e);
            }
        })();
    };

    const openLocalDraftModal = (draft: QuoteDraft) => {
        setModalMode('devis');
        setIsModalOpen(true);
        setEditingDocumentId(null);
        setEditingDocumentStatus('draft');
        setLocalDraftId(String(draft.id || ''));
        setIsDraftBlocked(false);
        setIsDraftDirty(false);

        setSelectedClientId(String(draft.form.selectedClientId || ''));
        setServiceType((draft.form.serviceType || 'pack') as any);
        setSelectedPackId(String(draft.form.selectedPackId || ''));
        setPackQuantity(Number(draft.form.packQuantity || 1));
        setUnitPrice(Number(draft.form.unitPrice || 0));
        setCustomDescription(String(draft.form.customDescription || ''));
        setTvaRate((Number(draft.form.tvaRate || 0) as any));
        setTaxCreditActive(!!draft.form.taxCreditActive);
        setInterventionSlots(Array.isArray(draft.form.interventionSlots) ? draft.form.interventionSlots : []);
        setPackSpecificConfig(draft.form.packSpecificConfig || {});
        setCustomLines(Array.isArray(draft.form.customLines) ? draft.form.customLines : []);
        setPrefilledRef(String(draft.ref || ''));
    };

    // Fonctions pour gérer les lignes personnalisées
    const addCustomLine = () => {
        const newLine = {
            id: `custom-${Date.now()}`,
            description: '',
            unitPrice: 0,
            quantity: 1
        };
        setCustomLines([...customLines, newLine]);
        setIsDraftDirty(true);
        scheduleDraftAutosave();
    };

    const updateCustomLine = (id: string, field: 'description' | 'unitPrice' | 'quantity', value: string | number) => {
        setCustomLines(customLines.map(line =>
            line.id === id ? { ...line, [field]: field === 'unitPrice' || field === 'quantity' ? Number(value) : value } : line
        ));
        setIsDraftDirty(true);
        scheduleDraftAutosave();
    };

    const removeCustomLine = (id: string) => {
        setCustomLines(customLines.filter(line => line.id !== id));
        setIsDraftDirty(true);
        scheduleDraftAutosave();
    };

    // Calculer le total des lignes personnalisées
    const calculateCustomTotal = () => {
        return customLines.reduce((total, line) => total + (line.unitPrice * line.quantity), 0);
    };

    const isPackUltime6Name = (name: any): boolean => {
        const normalized = String(name || '')
            .trim()
            .toLowerCase()
            .replace(/\s+/g, ' ');
        return normalized === 'pack ultime 6';
    };

    // Fonction pour calculer la durée totale d'un pack (identique à Secretariat.tsx)
    const calculatePackDuration = (pack: any) => {
        const frequency = pack.frequency || '';
        let days = 1;

        const isUltime6 = isPackUltime6Name(pack?.name);

        // D'abord, vérifier si la description contient un nombre de jours explicite
        if (pack.description && pack.description.includes('(')) {
            const daysMatch = pack.description.match(/\((\d+)\s*jours?\)/i);
            if (daysMatch) {
                days = parseInt(daysMatch[1]);
            } else {
                const altDaysMatch = pack.description.match(/\((\d+)\s*jours?/i);
                if (altDaysMatch) {
                    days = parseInt(altDaysMatch[1]);
                } else {
                    const simpleDaysMatch = pack.description.match(/(\d+)\s*jours?/i);
                    if (simpleDaysMatch) {
                        days = parseInt(simpleDaysMatch[1]);
                    }
                }
            }
        }

        // Si aucun nombre trouvé dans la description, utiliser les valeurs par défaut selon la fréquence
        if (days === 1) {
            if (isUltime6) {
                days = 1;
            } else if (frequency.includes('Tranquility')) {
                days = frequency.includes('4j') ? 4 : 3;
            } else if (frequency.toLowerCase() === 'regulier') {
                if (pack.quantity) {
                    const quantityDays = parseInt(pack.quantity);
                    if (!isNaN(quantityDays) && quantityDays > 0) {
                        days = quantityDays;
                    }
                }
            } else if (frequency === 'Hebdomadaire') {
                days = 1;
            } else if (frequency === 'Bimensuelle') {
                days = 2;
            } else if (frequency === 'Mensuelle') {
                days = 4;
            } else if (frequency === 'Ponctuelle') {
                days = 1;
            } else {
                const daysMatch = frequency.match(/(\d+)\s*jours?/i);
                if (daysMatch) {
                    days = parseInt(daysMatch[1]);
                }
            }
        }

        const totalHours = pack.hours * days;
        return totalHours;
    };

    const calculateDuration = (start: string, end: string): number => {
        if (!start || !end) return 0;
        const [h1, m1] = start.split(':').map(Number);
        const [h2, m2] = end.split(':').map(Number);
        const date1 = new Date(0, 0, 0, h1, m1);
        const date2 = new Date(0, 0, 0, h2, m2);
        const diffMs = date2.getTime() - date1.getTime();
        return diffMs > 0 ? diffMs / (1000 * 60 * 60) : 0;
    };

    const normalizeSlot = (raw: any, fallbackIndex: number): InterventionSlot | null => {
        if (!raw || typeof raw !== 'object') return null;
        const id = String(raw.id || raw.slotId || raw.slot_id || `slot-${fallbackIndex}`);
        const date = String(raw.date || raw.day || raw.slotDate || raw.slot_date || '');
        const startTime = String(raw.startTime || raw.start_time || raw.start || '');
        const endTime = String(raw.endTime || raw.end_time || raw.end || '');
        const durationRaw = raw.duration ?? raw.hours ?? raw.totalHours;
        const duration = Number.isFinite(durationRaw) ? Number(durationRaw) : calculateDuration(startTime, endTime);
        if (!date) return null;
        return { id, date, startTime, endTime, duration };
    };

    const normalizeSlots = (slots: any): InterventionSlot[] => {
        if (!Array.isArray(slots)) return [];
        return slots
            .map((s, idx) => normalizeSlot(s, idx))
            .filter(Boolean) as InterventionSlot[];
    };

    // Helper to add hours to time string
    const addHoursToTime = (time: string, hoursToAdd: number): string => {
        const [h, m] = time.split(':').map(Number);
        const date = new Date(0, 0, 0, h, m);
        date.setHours(date.getHours() + Math.floor(hoursToAdd));
        date.setMinutes(date.getMinutes() + (hoursToAdd % 1) * 60);
        return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    };

    useEffect(() => {
        if (serviceType === 'pack' && selectedPackId) {
            if (isPrefillingFromDbRef.current) {
                return;
            }
            const pack = packs.find(p => p.id === selectedPackId);
            if (pack) {
                setUnitPrice(pack.priceTTC);
                setCustomDescription(pack.description);

                // RESET CONFIG ON PACK CHANGE
                setPackSpecificConfig({});
                setInterventionSlots([]);

                // Initial Setup based on Pack Name (Logic from images)
                if (pack.name.includes("Tranquility")) {
                    // Default to first option
                    setPackSpecificConfig({ frequencyChoice: "4j_3h" });
                } else if (isPackUltime6Name(pack.name)) {
                    // Auto generate single slot 6h
                    setInterventionSlots([{
                        id: 'slot-ultime',
                        date: getMartiniqueToday(),
                        startTime: '09:00',
                        endTime: '17:00',
                        duration: 6
                    }]);
                } else if (pack.name.includes("personnalisé")) {
                    // Reset for manual entry
                    setPackSpecificConfig({ customDays: 1, customTotalHours: 2 });
                    setInterventionSlots([{
                        id: 'slot-custom-0',
                        date: getMartiniqueToday(),
                        startTime: '09:00',
                        endTime: '11:00',
                        duration: 2
                    }]);
                }
            }
        }
    }, [selectedPackId, serviceType, packs]);

    // Handler for Generating Slots based on Configuration
    const generateSlots = () => {
        const pack = packs.find(p => p.id === selectedPackId);
        if (!pack) return;

        const newSlots: InterventionSlot[] = [];
        const baseDate = (() => {
            const todayStr = getTodayMartiniqueStr();
            const defaultStart = '09:00';
            const base = dayjs.tz(todayStr, 'YYYY-MM-DD', MARTINIQUE_TIMEZONE).startOf('day');
            if (isSlotStartInPast(todayStr, defaultStart)) {
                return base.add(1, 'day');
            }
            return base;
        })();

        if (pack.name.includes("Tranquility")) {
            // Logic for Tranquility: 12h total
            // Option 1: 4 days x 3 hours
            // Option 2: 3 days x 4 hours
            const choice = packSpecificConfig.frequencyChoice || "4j_3h";
            const days = choice === "4j_3h" ? 4 : 3;
            const hours = choice === "4j_3h" ? 3 : 4;

            for (let i = 0; i < days; i++) {
                const date = baseDate.add(i * 2, 'day'); // Spread every 2 days by default
                newSlots.push({
                    id: `slot-tranquility-${i}`,
                    date: toMartiniqueISODate(date.toDate()),
                    startTime: '09:00',
                    endTime: addHoursToTime('09:00', hours),
                    duration: hours
                });
            }
        } else if (isPackUltime6Name(pack.name)) {
            // Pack ULTIME 6: 6h en une seule journée de 9h à 15h
            newSlots.push({
                id: `slot-ultime-6`,
                date: toMartiniqueISODate(baseDate.toDate()),
                startTime: '09:00',
                endTime: '15:00',
                duration: 6
            });
        } else if (pack.name.includes("personnalisé")) {
            const days = packSpecificConfig.customDays || 1;
            const totalHours = packSpecificConfig.customTotalHours || 2;
            const hoursPerDay = totalHours / days;

            for (let i = 0; i < days; i++) {
                const date = baseDate.add(i, 'day');
                newSlots.push({
                    id: `slot-custom-${i}`,
                    date: toMartiniqueISODate(date.toDate()),
                    startTime: '09:00',
                    endTime: addHoursToTime('09:00', hoursPerDay),
                    duration: hoursPerDay
                });
            }
        }
        setInterventionSlots(newSlots);
    };

    const isAnyProviderAvailableForSlot = (slot: InterventionSlot): boolean => {
        if (!slot.date) return false;

        const slotStart = dayjs.tz(`${slot.date} ${slot.startTime}`, 'YYYY-MM-DD HH:mm', MARTINIQUE_TIMEZONE);
        const slotEnd = dayjs.tz(`${slot.date} ${slot.endTime}`, 'YYYY-MM-DD HH:mm', MARTINIQUE_TIMEZONE);

        const conflictingMissions = missions.filter(m => {
            if (m.status === 'cancelled' || !m.date) return false;
            const mStart = dayjs.tz(`${m.date} ${m.startTime}`, 'YYYY-MM-DD HH:mm', MARTINIQUE_TIMEZONE);
            const mEnd = dayjs.tz(`${m.date} ${m.endTime}`, 'YYYY-MM-DD HH:mm', MARTINIQUE_TIMEZONE);
            return (slotStart.valueOf() < mEnd.valueOf() && slotEnd.valueOf() > mStart.valueOf());
        });

        const availableProviders = providers.filter(provider => {
            const isActive = provider.status === 'Active';
            if (!isActive) return false;

            const day = dayjs.tz(slot.date, 'YYYY-MM-DD', MARTINIQUE_TIMEZONE).day();
            const nonWorkingDays = (provider as any)?.nonInterventionDays;
            if (Array.isArray(nonWorkingDays) && nonWorkingDays.includes(day)) return false;

            const hourRanges = (provider as any)?.nonInterventionHours && typeof (provider as any)?.nonInterventionHours === 'object'
                ? (provider as any).nonInterventionHours[day]
                : undefined;
            if (Array.isArray(hourRanges) && hourRanges.length > 0) {
                const s = String(slot.startTime || '').slice(0, 5);
                const e = String(slot.endTime || '').slice(0, 5);
                const blocked = hourRanges.some((r: any) => {
                    const rStart = String(r?.start || '').slice(0, 5);
                    const rEnd = String(r?.end || '').slice(0, 5);
                    if (!rStart || !rEnd) return false;
                    return s < rEnd && e > rStart;
                });
                if (blocked) return false;
            }

            const hasLeave = provider.leaves && provider.leaves.some(leave => {
                const startTime = (leave as any)?.startTime ? String((leave as any).startTime).slice(0, 5) : '00:00';
                const endTime = (leave as any)?.endTime ? String((leave as any).endTime).slice(0, 5) : '23:59';

                const leaveStart = dayjs.tz(`${leave.startDate} ${startTime}`, 'YYYY-MM-DD HH:mm', MARTINIQUE_TIMEZONE);
                const leaveEnd = dayjs.tz(`${leave.endDate} ${endTime}`, 'YYYY-MM-DD HH:mm', MARTINIQUE_TIMEZONE);
                if (!leaveStart.isValid() || !leaveEnd.isValid()) return false;

                return slotStart.valueOf() < leaveEnd.valueOf() && slotEnd.valueOf() > leaveStart.valueOf();
            });
            if (hasLeave) return false;

            const hasConflict = conflictingMissions.some(m => m.providerId === provider.id);
            if (hasConflict) return false;

            return true;
        });

        return availableProviders.length > 0;
    };

    const getPackDays = (pack: any): number => {
        const frequency = pack.frequency || '';
        let days = 1;

        const isUltime6 = isPackUltime6Name(pack?.name);

        if (pack.description && pack.description.includes('(')) {
            const daysMatch = pack.description.match(/\((\d+)\s*jours?\)/i);
            if (daysMatch) {
                days = parseInt(daysMatch[1]);
            } else {
                const altDaysMatch = pack.description.match(/\((\d+)\s*jours?/i);
                if (altDaysMatch) {
                    days = parseInt(altDaysMatch[1]);
                } else {
                    const simpleDaysMatch = pack.description.match(/(\d+)\s*jours?/i);
                    if (simpleDaysMatch) {
                        days = parseInt(simpleDaysMatch[1]);
                    }
                }
            }
        }

        if (days === 1) {
            if (isUltime6) {
                days = 1;
            } else if (frequency.includes('Tranquility')) {
                days = frequency.includes('4j') ? 4 : 3;
            } else if (frequency.toLowerCase() === 'regulier') {
                if (pack.quantity) {
                    const quantityDays = parseInt(pack.quantity);
                    if (!isNaN(quantityDays) && quantityDays > 0) {
                        days = quantityDays;
                    }
                }
            } else if (frequency === 'Hebdomadaire') {
                days = 1;
            } else if (frequency === 'Bimensuelle') {
                days = 2;
            } else if (frequency === 'Mensuelle') {
                days = 4;
            } else if (frequency === 'Ponctuelle') {
                days = 1;
            } else {
                const daysMatch = frequency.match(/(\d+)\s*jours?/i);
                if (daysMatch) {
                    days = parseInt(daysMatch[1]);
                }
            }
        }

        return days;
    };

    const generateInterventionSlotsWithAvailability = () => {
        const pack = packs.find(p => p.id === selectedPackId);
        if (!pack) return;

        const maxLookaheadDays = 90;
        const sessions: Array<{ duration: number; startTime: string; endTime: string }> = [];

        if (pack.name.includes("Tranquility")) {
            const choice = packSpecificConfig.frequencyChoice || "4j_3h";
            const days = choice === "4j_3h" ? 4 : 3;
            const hours = choice === "4j_3h" ? 3 : 4;
            for (let i = 0; i < days; i++) {
                sessions.push({
                    duration: hours,
                    startTime: '09:00',
                    endTime: addHoursToTime('09:00', hours)
                });
            }
        } else if (isPackUltime6Name(pack.name)) {
            sessions.push({ duration: 6, startTime: '09:00', endTime: '15:00' });
        } else if (pack.name.includes("personnalisé")) {
            const days = packSpecificConfig.customDays || 1;
            const totalHours = packSpecificConfig.customTotalHours || 2;
            const hoursPerDay = totalHours / days;
            for (let i = 0; i < days; i++) {
                sessions.push({
                    duration: hoursPerDay,
                    startTime: '09:00',
                    endTime: addHoursToTime('09:00', hoursPerDay)
                });
            }
        } else {
            const days = getPackDays(pack);
            const hoursPerDay = Number(pack.hours) || 2;
            for (let i = 0; i < days; i++) {
                sessions.push({
                    duration: hoursPerDay,
                    startTime: '09:00',
                    endTime: addHoursToTime('09:00', hoursPerDay)
                });
            }
        }

        const startDateStr = getTodayMartiniqueStr();
        const newSlots: InterventionSlot[] = [];
        let cursorDate = dayjs.tz(startDateStr, 'YYYY-MM-DD', MARTINIQUE_TIMEZONE).startOf('day');

        // Si l'horaire par défaut est déjà passé pour aujourd'hui, commencer au lendemain
        if (sessions.length > 0 && sessions[0]?.startTime && isSlotStartInPast(startDateStr, sessions[0].startTime)) {
            cursorDate = cursorDate.add(1, 'day');
        }

        for (let i = 0; i < sessions.length; i++) {
            let found = false;
            for (let offset = 0; offset < maxLookaheadDays; offset++) {
                const candidate = cursorDate.add(offset, 'day');
                const candidateStr = candidate.format('YYYY-MM-DD');

                // Ne jamais proposer un créneau dans le passé (cas: aujourd'hui mais heure déjà passée)
                if (candidateStr === getTodayMartiniqueStr() && isSlotStartInPast(candidateStr, sessions[i].startTime)) {
                    continue;
                }

                const candidateSlot: InterventionSlot = {
                    id: `slot-auto-${i}-${candidateStr}`,
                    date: candidateStr,
                    startTime: sessions[i].startTime,
                    endTime: sessions[i].endTime,
                    duration: sessions[i].duration
                };

                if (isAnyProviderAvailableForSlot(candidateSlot)) {
                    newSlots.push(candidateSlot);
                    cursorDate = candidate.add(1, 'day');
                    found = true;
                    break;
                }
            }

            if (!found) {
                showToast(
                    `Impossible de générer tous les créneaux : aucun prestataire disponible dans les ${maxLookaheadDays} prochains jours pour la séance ${i + 1}.`,
                    'warning'
                );
                break;
            }
        }

        if (newSlots.length > 0) {
            setInterventionSlots(newSlots);
            showToast('Créneaux générés selon la disponibilité des prestataires.', 'success');
        }
    };

    const updateSlot = (index: number, field: keyof InterventionSlot, value: string, options?: { validate?: boolean }) => {
        const newSlots = [...interventionSlots];
        const currentSlot = newSlots[index];

        const shouldValidate = options?.validate !== false;

        if (field === 'date' && shouldValidate) {
            const nextDate = value;
            if (nextDate && nextDate < getTodayMartiniqueStr()) {
                showToast("La date doit être aujourd'hui ou une date future.", 'warning');
                return;
            }
            const minStart = getMinStartTimeForSlot(nextDate);
            if (minStart && currentSlot.startTime && currentSlot.startTime < minStart) {
                const nextStart = minStart;
                const nextEnd = addHoursToTime(nextStart, currentSlot.duration);
                newSlots[index] = { ...currentSlot, date: nextDate, startTime: nextStart, endTime: nextEnd };
                setInterventionSlots(newSlots);
                showToast("Heure ajustée car la date sélectionnée est aujourd'hui.", 'warning');
                return;
            }
        }

        if (field === 'startTime' && shouldValidate && currentSlot.date) {
            const minStart = getMinStartTimeForSlot(currentSlot.date);
            if (minStart && value && value < minStart) {
                showToast("Impossible de choisir une heure passée pour aujourd'hui. Choisissez une heure future ou une date ultérieure.", 'warning');
                return;
            }
        }

        if (field === 'startTime') {
            // Garder la durée constante si possible, décaler l'heure de fin
            const end = addHoursToTime(value, currentSlot.duration);
            newSlots[index] = { ...currentSlot, startTime: value, endTime: end };
        } else if (field === 'endTime') {
            // Recalculer la durée
            const dur = calculateDuration(currentSlot.startTime, value);
            newSlots[index] = { ...currentSlot, endTime: value, duration: dur };

            // Vérifier si cette modification respecte les contraintes du pack
            if (serviceType === 'pack' && selectedPackId) {
                const pack = packs.find(p => p.id === selectedPackId);
                if (pack) {
                    // Fonction pour calculer la durée totale d'un pack (identique à Secretariat.tsx)
                    const calculatePackDuration = (pack: any) => {
                        const frequency = pack.frequency || '';
                        let days = 1;

                        const isUltime6 = isPackUltime6Name(pack?.name);

                        // D'abord, vérifier si la description contient un nombre de jours explicite
                        if (pack.description && pack.description.includes('(')) {
                            const daysMatch = pack.description.match(/\((\d+)\s*jours?\)/i);
                            if (daysMatch) {
                                days = parseInt(daysMatch[1]);
                            } else {
                                const altDaysMatch = pack.description.match(/\((\d+)\s*jours?/i);
                                if (altDaysMatch) {
                                    days = parseInt(altDaysMatch[1]);
                                } else {
                                    const simpleDaysMatch = pack.description.match(/(\d+)\s*jours?/i);
                                    if (simpleDaysMatch) {
                                        days = parseInt(simpleDaysMatch[1]);
                                    }
                                }
                            }
                        }

                        // Si aucun nombre trouvé dans la description, utiliser les valeurs par défaut selon la fréquence
                        if (days === 1) {
                            if (isUltime6) {
                                days = 1;
                            } else if (frequency.includes('Tranquility')) {
                                days = frequency.includes('4j') ? 4 : 3;
                            } else if (frequency.toLowerCase() === 'regulier') {
                                if (pack.quantity) {
                                    const quantityDays = parseInt(pack.quantity);
                                    if (!isNaN(quantityDays) && quantityDays > 0) {
                                        days = quantityDays;
                                    }
                                }
                            } else if (frequency === 'Hebdomadaire') {
                                days = 1;
                            } else if (frequency === 'Bimensuelle') {
                                days = 2;
                            } else if (frequency === 'Mensuelle') {
                                days = 4;
                            } else if (frequency === 'Ponctuelle') {
                                days = 1;
                            } else {
                                const daysMatch = frequency.match(/(\d+)\s*jours?/i);
                                if (daysMatch) {
                                    days = parseInt(daysMatch[1]);
                                }
                            }
                        }

                        const totalHours = pack.hours * days;
                        return totalHours;
                    };

                    // Validation des créneaux pour les packs spécifiques
                    if (isPackUltime6Name(pack.name) && Math.abs(dur - 6) > 0.01) {
                        showToast("Le pack 'Ultime 6' requiert exactement 6h par séance.", 'error');
                        return; // Annuler la modification
                    }

                    if (pack.name.includes("Tranquility")) {
                        const expectedHours = packSpecificConfig.frequencyChoice === "4j_3h" ? 3 : 4;
                        if (Math.abs(dur - expectedHours) > 0.01) {
                            showToast(`Le pack 'Tranquility' requiert ${expectedHours}h par séance.`);
                            return; // Annuler la modification
                        }
                    }
                }
            }
        } else {
            newSlots[index] = { ...currentSlot, [field]: value };
        }

        if (newSlots[index]?.date && newSlots[index]?.startTime && isSlotStartInPast(newSlots[index].date, newSlots[index].startTime)) {
            showToast("Créneau invalide : l'heure doit être supérieure à l'heure actuelle ou la date doit être ultérieure.", 'warning');
            return;
        }
        setInterventionSlots(newSlots);
        setIsDraftDirty(true);
        scheduleDraftAutosave();
    };

    const addNewSlot = () => {
        // Vérifier les contraintes du pack avant d'ajouter une séance
        if (serviceType === 'pack' && selectedPackId) {
            const pack = packs.find(p => p.id === selectedPackId);
            if (pack) {
                if (isPackUltime6Name(pack.name) && interventionSlots.length >= 1) {
                    showToast("Le pack 'Ultime 6' ne permet qu'une seule séance de 6h.");
                    return;
                }

                if (pack.name.includes("Tranquility")) {
                    if (interventionSlots.length >= 4) {
                        showToast("Le pack 'Tranquility' ne permet que 4 séances maximum (3x4h ou 4x3h).");
                        return;
                    }
                }
            }
        }

        const lastSlot = interventionSlots[interventionSlots.length - 1];
        let newDate = getMartiniqueToday();
        if (lastSlot) {
            newDate = dayjs
                .tz(lastSlot.date, 'YYYY-MM-DD', MARTINIQUE_TIMEZONE)
                .add(1, 'day')
                .format('YYYY-MM-DD');
        }

        // Définir la durée par défaut selon le pack
        let defaultDuration = 2;
        if (serviceType === 'pack' && selectedPackId) {
            const pack = packs.find(p => p.id === selectedPackId);
            if (pack) {
                if (isPackUltime6Name(pack.name)) {
                    defaultDuration = 6;
                } else if (pack.name.includes("Tranquility")) {
                    defaultDuration = packSpecificConfig.frequencyChoice === "4j_3h" ? 3 : 4;
                }
            }
        }

        // Force 6h pour Pack Ultime 6 si détecté dans le nom du pack sélectionné
        if (serviceType === 'pack' && selectedPackId) {
            const pack = packs.find(p => p.id === selectedPackId);
            if (pack && isPackUltime6Name(pack.name)) {
                defaultDuration = 6;
            }
        }

        setInterventionSlots([...interventionSlots, {
            id: `manual-${Date.now()}`,
            date: newDate,
            startTime: '09:00',
            endTime: addHoursToTime('09:00', defaultDuration),
            duration: defaultDuration
        }]);
        setIsDraftDirty(true);
        scheduleDraftAutosave();
    };

    const removeSlot = (index: number) => {
        const newSlots = [...interventionSlots];
        newSlots.splice(index, 1);
        setInterventionSlots(newSlots);
        setIsDraftDirty(true);
        scheduleDraftAutosave();
    };

    // Validation stricte des heures et séances selon le pack
    const validatePackConstraints = (): { isValid: boolean; message: string } => {
        if (serviceType !== 'pack' || !selectedPackId) {
            return { isValid: true, message: '' };
        }

        const pack = packs.find(p => p.id === selectedPackId);
        if (!pack) {
            return { isValid: false, message: 'Pack non trouvé' };
        }

        const isUltime6 = isPackUltime6Name(pack?.name);

        const totalHours = interventionSlots.reduce((acc, s) => acc + s.duration, 0);
        const sessionCount = interventionSlots.length;

        // Calculer le nombre total d'heures requis pour ce pack
        const requiredTotalHours = calculatePackDuration(pack);

        // Validation stricte : les heures doivent être exactement égales au total requis
        if (Math.abs(totalHours - requiredTotalHours) > 0.01) {
            return {
                isValid: false,
                message: `Le pack "${pack.name}" requiert exactement ${requiredTotalHours}h. Vous avez planifié ${totalHours.toFixed(1)}h (${sessionCount} séance(s)).`
            };
        }

        // Validation du nombre de séances selon le pack
        if (isUltime6 && sessionCount !== 1) {
            return {
                isValid: false,
                message: `Le pack "Ultime 6" ne permet qu'une seule séance de 6h. Vous avez planifié ${sessionCount} séance(s).`
            };
        }

        // Message de succès pour Pack Ultime 6 correctement configuré
        if (isUltime6 && sessionCount === 1 && Math.abs(totalHours - 6) <= 0.01) {
            return {
                isValid: true,
                message: `Pack Ultime 6 correctement configuré : 6h sur une journée (9h-15h).`
            };
        }

        if (pack.name.includes("Tranquility")) {
            // Pack Tranquility : 12h total, peut être 4x3h ou 3x4h
            if (sessionCount !== 3 && sessionCount !== 4) {
                return {
                    isValid: false,
                    message: `Le pack "Tranquility" ne permet que 3 séances de 4h ou 4 séances de 3h. Vous avez planifié ${sessionCount} séance(s).`
                };
            }

            // Vérifier que chaque séance a la bonne durée
            const expectedHoursPerSession = sessionCount === 4 ? 3 : 4;
            const hasInvalidSession = interventionSlots.some(s => Math.abs(s.duration - expectedHoursPerSession) > 0.01);

            if (hasInvalidSession) {
                return {
                    isValid: false,
                    message: `Le pack "Tranquility" avec ${sessionCount} séances requiert ${expectedHoursPerSession}h par séance.`
                };
            }
        }

        return { isValid: true, message: '' };
    };

    // Vérification des disponibilités des prestataires
    const checkProviderAvailability = (): { isValid: boolean; message: string } => {
        if (interventionSlots.length === 0) {
            return { isValid: true, message: '' };
        }

        // Vérifier chaque créneau planifié
        for (const slot of interventionSlots) {
            if (!slot.date) continue;

            const slotStart = dayjs.tz(`${slot.date} ${slot.startTime}`, 'YYYY-MM-DD HH:mm', MARTINIQUE_TIMEZONE);
            const slotEnd = dayjs.tz(`${slot.date} ${slot.endTime}`, 'YYYY-MM-DD HH:mm', MARTINIQUE_TIMEZONE);

            // Vérifier les missions existantes pour ce créneau
            const conflictingMissions = missions.filter(m => {
                if (m.status === 'cancelled' || !m.date) return false;
                const mStart = dayjs.tz(`${m.date} ${m.startTime}`, 'YYYY-MM-DD HH:mm', MARTINIQUE_TIMEZONE);
                const mEnd = dayjs.tz(`${m.date} ${m.endTime}`, 'YYYY-MM-DD HH:mm', MARTINIQUE_TIMEZONE);
                return (slotStart.valueOf() < mEnd.valueOf() && slotEnd.valueOf() > mStart.valueOf());
            });

            // Compter les prestataires disponibles pour ce créneau
            const availableProviders = providers.filter(provider => {
                // Vérifier si le prestataire est actif (utiliser status !== 'Inactive' et !== 'Passive')
                const isActive = provider.status === 'Active';
                if (!isActive) {
                    console.log(`Provider ${provider.firstName} ${provider.lastName} is not active: ${provider.status}`);
                    return false;
                }

                const day = dayjs.tz(slot.date, 'YYYY-MM-DD', MARTINIQUE_TIMEZONE).day();
                const nonWorkingDays = (provider as any)?.nonInterventionDays;
                if (Array.isArray(nonWorkingDays) && nonWorkingDays.includes(day)) {
                    console.log(`Provider ${provider.firstName} ${provider.lastName} non working day: ${day}`);
                    return false;
                }

                const hourRanges = (provider as any)?.nonInterventionHours && typeof (provider as any)?.nonInterventionHours === 'object'
                    ? (provider as any).nonInterventionHours[day]
                    : undefined;
                if (Array.isArray(hourRanges) && hourRanges.length > 0) {
                    const s = String(slot.startTime || '').slice(0, 5);
                    const e = String(slot.endTime || '').slice(0, 5);
                    const blocked = hourRanges.some((r: any) => {
                        const rStart = String(r?.start || '').slice(0, 5);
                        const rEnd = String(r?.end || '').slice(0, 5);
                        if (!rStart || !rEnd) return false;
                        return s < rEnd && e > rStart;
                    });
                    if (blocked) {
                        console.log(`Provider ${provider.firstName} ${provider.lastName} non working hours: ${s}-${e}`);
                        return false;
                    }
                }

                // Vérifier si le prestataire a des congés à cette date
                const hasLeave = provider.leaves && provider.leaves.some(leave => {
                    const startTime = (leave as any)?.startTime ? String((leave as any).startTime).slice(0, 5) : '00:00';
                    const endTime = (leave as any)?.endTime ? String((leave as any).endTime).slice(0, 5) : '23:59';

                    const leaveStart = dayjs.tz(`${leave.startDate} ${startTime}`, 'YYYY-MM-DD HH:mm', MARTINIQUE_TIMEZONE);
                    const leaveEnd = dayjs.tz(`${leave.endDate} ${endTime}`, 'YYYY-MM-DD HH:mm', MARTINIQUE_TIMEZONE);
                    if (!leaveStart.isValid() || !leaveEnd.isValid()) return false;

                    return slotStart.valueOf() < leaveEnd.valueOf() && slotEnd.valueOf() > leaveStart.valueOf();
                });

                if (hasLeave) {
                    console.log(`Provider ${provider.firstName} ${provider.lastName} has leave on ${slot.date}`);
                    return false;
                }

                // Vérifier si le prestataire a déjà des missions à ce créneau
                const hasConflict = conflictingMissions.some(m => m.providerId === provider.id);
                if (hasConflict) {
                    console.log(`Provider ${provider.firstName} ${provider.lastName} has conflict mission`);
                    return false;
                }

                console.log(`Provider ${provider.firstName} ${provider.lastName} is AVAILABLE`);
                return true;
            });

            console.log(`Total providers: ${providers.length}, Available providers: ${availableProviders.length}`);

            // S'il y a au moins un prestataire disponible, accepter la prestation
            if (availableProviders.length > 0) {
                return { isValid: true, message: '' };
            }

            // S'il n'y a aucun prestataire disponible pour ce créneau
            return {
                isValid: false,
                message: `Aucun prestataire disponible pour le créneau du ${slot.date} de ${slot.startTime} à ${slot.endTime}. (${providers.length} prestataires au total, ${availableProviders.length} disponibles). Veuillez choisir d'autres dates.`
            };
        }

        return { isValid: true, message: '' };
    };


    const [toast, setToast] = useState<{ show: boolean; message: string; type?: 'success' | 'error' | 'warning' }>({ show: false, message: '', type: 'success' });
    const toastTimeoutRef = useRef<number | null>(null);

    const showToast = (message: string, type: 'success' | 'error' | 'warning' = 'success') => {
        if (toastTimeoutRef.current) { clearTimeout(toastTimeoutRef.current); }
        setToast({ show: true, message, type });
        toastTimeoutRef.current = window.setTimeout(() => { setToast({ show: false, message: '', type }); }, 3000);
    };

    const handleDownloadContract = (doc: Document) => {
        if (!selectedClient) {
            showToast("Veuillez sélectionner un client", 'error');
            return;
        }

        // Rechercher d'abord un contrat existant pour ce client
        const existingContract = contracts.find(c =>
            c.clientId === selectedClient.id &&
            (c.packId === doc.packId || c.name.includes(doc.ref))
        );

        if (existingContract) {
            console.log('Contrat existant trouvé:', existingContract.id);
            downloadContract(existingContract);
            showToast("Contrat téléchargé avec succès");
        } else {
            // Fallback: générer un nouveau contrat si aucun n'existe
            console.log('Aucun contrat existant, génération depuis le devis');
            const pack = packs.find(p => p.id === doc.packId);
            const contract = generateContractFromTemplate(doc, selectedClient, pack);

            if (contract) {
                downloadContract(contract);
                showToast("Contrat téléchargé avec succès");
            } else {
                showToast("Erreur lors de la génération du contrat");
            }
        }
    };

    const openDetailModal = (doc: any) => {
        console.log('[DevisFactures] openDetailModal click:', {
            id: doc?.id,
            ref: doc?.ref,
            type: doc?.type,
            status: doc?.status,
        });
        if (isLocalDraftDocId(String(doc?.id || ''))) {
            const draftId = parseLocalDraftIdFromDocId(String(doc?.id || ''));
            const draft = localQuoteDrafts.find(d => String(d.id) === String(draftId));
            if (draft) {
                openLocalDraftModal(draft);
                return;
            }
        }
        // If it's a draft/validated quote, open edit modal directly (with existing slots/hours)
        const type = String(doc?.type || '').trim().toLowerCase();
        const status = String(doc?.status || '').trim().toLowerCase();
        if (type === 'devis' && (status === 'draft' || status === 'validated')) {
            openDuplicateModal(doc);
            return;
        }
        setSelectedDocument(doc);
        setIsDetailModalOpen(true);
    };

    const buildDraftFormState = (): QuoteDraftFormState => {
        return {
            selectedClientId,
            serviceType,
            selectedPackId,
            packQuantity,
            customDescription,
            unitPrice,
            tvaRate,
            taxCreditActive,
            interventionSlots,
            packSpecificConfig,
            customLines
        };
    };

    const getOrCreateDraftRef = () => {
        if (prefilledRef) return prefilledRef;
        const year = new Date().getFullYear();
        const ts = Date.now().toString(36).toUpperCase();
        const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
        const ref = `DEV-DRAFT-${year}-${ts}${rand}`;
        setPrefilledRef(ref);
        return ref;
    };

    const upsertLocalDraft = (draft: QuoteDraft) => {
        const existing = localQuoteDrafts.find(d => d.id === draft.id);
        const next = [draft, ...localQuoteDrafts.filter(d => d.id !== draft.id)];
        const sorted = next
            .map(d => ({ ...d, createdAt: existing?.createdAt || d.createdAt }))
            .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))
            .slice(0, DRAFT_LIMIT);
        setLocalQuoteDrafts(sorted);
        persistLocalDrafts(sorted);
    };

    const deleteLocalDraftById = (id: string) => {
        const next = localQuoteDrafts.filter(d => String(d.id) !== String(id));
        setLocalQuoteDrafts(next);
        persistLocalDrafts(next);
    };

    const doDraftAutosave = (force?: boolean): 'noop' | 'saved' | 'blocked' => {
        if (modalMode !== 'devis') return 'noop';
        if (!isModalOpen) return 'noop';
        if (isDraftBlocked) return 'noop';
        if (!force && !isDraftDirty) return 'noop';

        const existingDraftId = localDraftId;
        const drafts = loadLocalDrafts();
        const now = getMartiniqueNowISO();

        if (!existingDraftId && drafts.length >= DRAFT_LIMIT) {
            setIsDraftBlocked(true);
            return 'blocked';
        }

        const id = existingDraftId || generateUUID();
        const ref = getOrCreateDraftRef();
        const draft: QuoteDraft = {
            id,
            ref,
            createdAt: drafts.find(d => d.id === id)?.createdAt || now,
            updatedAt: now,
            userId: String(currentUser?.id || 'anonymous'),
            form: buildDraftFormState()
        };

        try {
            const clientId = String(selectedClientId || '').trim();
            if (clientId) {
                const client = clients.find(c => String(c.id) === clientId);

                const persistedStatus = String(editingDocumentStatus || '').trim();
                const shouldPreserveValidated = persistedStatus === 'validated';

                if (shouldPreserveValidated) {
                    // Do NOT overwrite validated -> draft.
                    void (async () => {
                        const payload: any = {
                            client_id: clientId,
                            client_name: String(client?.name || ''),
                            pack_id: selectedPackId ? String(selectedPackId) : null,
                            slots_data: Array.isArray(interventionSlots) ? interventionSlots : [],
                        };
                        console.log('[DevisFactures] Autosave validated (preserve status) update:', { id, payload });
                        const { error } = await supabase
                            .from('documents')
                            .update(payload)
                            .eq('id', id);
                        if (error) console.warn('[DevisFactures] Autosave validated update error (possible RLS):', error);
                    })();
                } else {
                    console.log('[DevisFactures] Autosave draft upsert:', { id, clientId, packId: selectedPackId, slotsCount: interventionSlots?.length });
                    void upsertDocumentDraft({
                        id,
                        ref,
                        clientId,
                        clientName: String(client?.name || ''),
                        packId: selectedPackId ? String(selectedPackId) : null,
                        category: serviceType,
                        description: String(customDescription || ''),
                        unitPrice: Number(unitPrice || 0),
                        quantity: Number(packQuantity || 1),
                        tvaRate: Number(tvaRate || 0),
                        totalHT: 0,
                        totalTTC: 0,
                        taxCreditEnabled: !!taxCreditActive,
                        slotsData: Array.isArray(interventionSlots) ? interventionSlots : [],
                    });
                }
            }
        } catch {
            // ignore
        }

        setLocalDraftId(id);
        upsertLocalDraft(draft);
        setIsDraftDirty(false);
        return 'saved';
    };

    function scheduleDraftAutosave(force?: boolean) {
        if (modalMode !== 'devis') return;
        if (!isModalOpen) return;
        if (isDraftBlocked) return;
        if (autosaveTimeoutRef.current) {
            clearTimeout(autosaveTimeoutRef.current);
        }
        autosaveTimeoutRef.current = window.setTimeout(() => {
            autosaveTimeoutRef.current = null;
            doDraftAutosave(force);
        }, 250);
    }

    const markDraftDirty = () => {
        if (modalMode !== 'devis') return;
        if (!isModalOpen) return;
        setIsDraftDirty(true);
        scheduleDraftAutosave();
    };

    useEffect(() => {
        const onBeforeUnload = (e: BeforeUnloadEvent) => {
            if (!isModalOpen) return;
            if (modalMode !== 'devis') return;
            if (!isDraftBlocked) return;
            if (!isDraftDirty) return;
            e.preventDefault();
            e.returnValue = draftBlockedMessage;
        };
        window.addEventListener('beforeunload', onBeforeUnload);
        return () => window.removeEventListener('beforeunload', onBeforeUnload);
    }, [isModalOpen, modalMode, isDraftBlocked, isDraftDirty, draftBlockedMessage]);

    const readFileAsDataUrl = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                if (typeof reader.result === 'string') resolve(reader.result);
                else reject(new Error('Lecture fichier impossible'));
            };
            reader.onerror = () => reject(new Error('Lecture fichier impossible'));
            reader.readAsDataURL(file);
        });
    };

    const openAdminSignModal = (docId: string) => {
        setAdminSignDocumentId(docId);
        setAdminSignatureDataUrl('');
        setAdminSignatureFileName('');
        setIsAdminSignDragOver(false);
        setIsAdminSignModalOpen(true);
    };

    const closeAdminSignModal = () => {
        if (isAdminSigning) return;
        setIsAdminSignModalOpen(false);
        setAdminSignDocumentId(null);
        setAdminSignatureDataUrl('');
        setAdminSignatureFileName('');
        setIsAdminSignDragOver(false);
    };

    const handleAdminSignatureFile = async (file?: File) => {
        if (!file) return;
        if (!file.type || !file.type.startsWith('image/')) {
            showToast('Veuillez sélectionner une image valide.', 'error');
            return;
        }
        try {
            const dataUrl = await readFileAsDataUrl(file);
            setAdminSignatureDataUrl(dataUrl);
            setAdminSignatureFileName(file.name || 'signature');
        } catch (e) {
            showToast('Erreur lors du chargement de l\'image.', 'error');
        }
    };

    const confirmAdminSign = async () => {
        if (!adminSignDocumentId) return;
        setIsAdminSigning(true);
        try {
            await signQuoteAsAdmin(adminSignDocumentId, adminSignatureDataUrl ? adminSignatureDataUrl : undefined);
            showToast('Devis signé (admin) ! Vos créneaux sont réservés.', 'success');
            setIsAdminSigning(false);
            setIsAdminSignModalOpen(false);
            setAdminSignDocumentId(null);
            setAdminSignatureDataUrl('');
            setAdminSignatureFileName('');
            setIsAdminSignDragOver(false);
        } catch (e) {
            console.error('[DevisFactures] Admin sign failed:', e);
            showToast('Erreur lors de la signature admin du devis.', 'error');
        } finally {
            setIsAdminSigning(false);
        }
    };

    const handleSuccess = async (mode?: 'send' | 'validate_only') => {
        setIsSubmitting(true);
        try {
            const existingDoc = editingDocumentId ? (documents || []).find((d: any) => String(d?.id || '') === String(editingDocumentId || '')) : null;
            const prevStatus = String((existingDoc as any)?.status || '');
            const isValidateOnly = modalMode === 'devis' && mode === 'validate_only';
            const nextQuoteStatus = isValidateOnly ? 'validated' : 'sent';

            if (!selectedClientId) {
                showToast('Veuillez sélectionner un client', 'warning');
                setIsSubmitting(false);
                return;
            }
            // Validation pour les devis : vérifier que la planification prévisionnelle est générée
            if (modalMode === 'devis') {
                if (interventionSlots.length === 0) {
                    showToast("Veuillez d'abord créer les jours et heures d'intervention (planification prévisionnelle) avant de valider le devis.", 'warning');
                    setIsSubmitting(false);
                    return;
                }

                // Validation stricte des contraintes du pack
                const validation = validatePackConstraints();
                if (!validation.isValid) {
                    showToast(validation.message, 'error');
                    setIsSubmitting(false);
                    return;
                }

                // Afficher un message de succès pour Pack Ultime 6 si applicable
                if (validation.message && validation.message.includes('correctement configuré')) {
                    showToast(validation.message, 'success');
                }

                // Vérification des disponibilités des prestataires
                const availabilityCheck = checkProviderAvailability();
                if (!availabilityCheck.isValid) {
                    showToast(availabilityCheck.message, 'warning');
                    setIsSubmitting(false);
                    return;
                }

                // Validation stricte date/heure (Martinique):
                // - aucune date passée
                // - si date = aujourd'hui, aucune heure passée
                const todayStr = getTodayMartiniqueStr();
                for (const slot of interventionSlots) {
                    if (!slot?.date) continue;
                    if (slot.date < todayStr) {
                        showToast("Impossible de choisir une date antérieure à aujourd'hui (Martinique).", 'warning');
                        setIsSubmitting(false);
                        return;
                    }
                    if (slot?.startTime && isSlotStartInPast(slot.date, slot.startTime)) {
                        showToast("Impossible de choisir une heure antérieure à l'heure actuelle (Martinique).", 'warning');
                        setIsSubmitting(false);
                        return;
                    }
                }
            }

            const client = clients.find(c => c.id === selectedClientId);
            const clientName = client?.name || 'Client Inconnu';
            
            // Calcul différent pour le mode personnalisé
            let totalHT: number;
            if (serviceType === 'custom') {
                totalHT = calculateCustomTotal();
            } else {
                totalHT = unitPrice * packQuantity;
            }
            
            const tvaAmount = totalHT * (tvaRate / 100);
            const totalTTC = totalHT + tvaAmount;

            // Determine description suffix based on slots if custom
            let finalDescription = customDescription;
            const totalHours = interventionSlots.reduce((acc, s) => acc + s.duration, 0);
            
            if (serviceType === 'custom') {
                // Pour les devis personnalisés, la description doit être l'ensemble des désignations des lignes personnalisées
                if (customLines.length > 0) {
                    finalDescription = customLines
                        .map(line => line.description || `Ligne personnalisée`)
                        .filter(desc => desc.trim() !== '')
                        .join(' | ');
                    
                    // Ajouter les informations de planification si disponibles
                    if (interventionSlots.length > 0) {
                        finalDescription += ` (${interventionSlots.length} jours, Total ${totalHours}h)`;
                    }
                } else {
                    finalDescription = 'Devis personnalisé - Veuillez ajouter des lignes de prestation';
                }
            } else if (serviceType === 'pack' && packs.find(p => p.id === selectedPackId)?.name.includes("personnalisé")) {
                finalDescription += ` (${interventionSlots.length} jours, Total ${totalHours}h)`;
            }

            let enrichedDescription = finalDescription;
            const normalized = String(enrichedDescription || '').toLowerCase();
            const clientLocation = `${(client?.address || '').trim()}${client?.city ? `, ${client.city}` : ''}`.trim();
            const selectedPack = serviceType === 'pack' ? packs.find(p => p.id === selectedPackId) : undefined;
            const packName = String(selectedPack?.name || '').trim();
            const packLocation = String(selectedPack?.location || '').trim();
            const resolvedLocation = packLocation || clientLocation || 'Domicile Client';

            if (packName && !normalized.includes('pack:')) {
                enrichedDescription = `Pack: ${packName} | ${enrichedDescription}`;
            }

            if (interventionSlots.length > 0 && !String(enrichedDescription || '').toLowerCase().includes('durée:')) {
                enrichedDescription += ` | Durée: ${interventionSlots.length} jour(s), Total ${totalHours}h`;
            }

            if (resolvedLocation && !String(enrichedDescription || '').toLowerCase().includes('lieu:')) {
                enrichedDescription += ` | Lieu: ${resolvedLocation}`;
            }

            
            const trimmedPrefilledRef = String(prefilledRef || '').trim();
            const isDraftRef = /^((DEV|FAC)-DRAFT-)/i.test(trimmedPrefilledRef);
            const ref = (!trimmedPrefilledRef || isDraftRef)
                ? ''
                : trimmedPrefilledRef;

            const docToPersist: Document = {
                id: editingDocumentId || '',
                ref,
                clientId: selectedClientId,
                clientName: clientName,
                date: getMartiniqueToday(),
                type: modalMode === 'devis' ? 'Devis' : 'Facture',
                category: serviceType,
                description: enrichedDescription,
                unitPrice: unitPrice,
                quantity: packQuantity,
                tvaRate: tvaRate,
                totalHT: totalHT,
                totalTTC: totalTTC,
                taxCreditEnabled: taxCreditActive,
                status: modalMode === 'devis' ? (nextQuoteStatus as any) : 'paid',
                slotsData: interventionSlots.length > 0 ? interventionSlots : (modalMode === 'devis' ? interventionSlots : undefined),
                packId: serviceType === 'pack' ? selectedPackId : undefined,
            };

            if (editingDocumentId) {
                await updateDocument(editingDocumentId, {
                    ref: docToPersist.ref,
                    clientId: docToPersist.clientId,
                    clientName: docToPersist.clientName,
                    date: docToPersist.date,
                    type: docToPersist.type,
                    category: docToPersist.category,
                    description: docToPersist.description,
                    unitPrice: docToPersist.unitPrice,
                    quantity: docToPersist.quantity,
                    tvaRate: docToPersist.tvaRate,
                    totalHT: docToPersist.totalHT,
                    totalTTC: docToPersist.totalTTC,
                    taxCreditEnabled: docToPersist.taxCreditEnabled,
                    status: docToPersist.status,
                    slotsData: docToPersist.slotsData,
                    packId: docToPersist.packId,
                });
            } else {
                await addDocument(docToPersist);
            }

            if (modalMode === 'devis' && localDraftId) {
                deleteLocalDraftById(localDraftId);
            }

            const isSendingQuoteNow = modalMode === 'devis' && nextQuoteStatus === 'sent' && prevStatus !== 'sent';

            // GÉNÉRATION AUTOMATIQUE DU CONTRAT LORS DE L'ENVOI D'UN DEVIS
            if (isSendingQuoteNow) {
                const client = clients.find(c => c.id === selectedClientId);
                const pack = packs.find(p => p.id === selectedPackId);

                if (client) {
                    const contract = generateContractFromTemplate(docToPersist, client, pack);

                    if (contract) {
                        // Rendre le contrat automatiquement validé et actif
                        const validatedContract = {
                            ...contract,
                            status: 'active' as const,
                            validationStatus: 'validated' as const,
                            validatedAt: getMartiniqueNowISO(),
                            validatedBy: currentUser?.id || 'system',
                            validationDate: getMartiniqueToday(),
                            clientSignatureUrl: docToPersist.signedAt ? 'auto-signed' : undefined,
                            signedAt: docToPersist.signedAt || getMartiniqueNowISO()
                        };

                        await addContract(validatedContract);

                        // NOTIFICATION POUR LE CLIENT: Contrat généré et validé automatiquement
                        await addNotification(
                            'client',
                            'success',
                            'Contrat créé et validé',
                            `Votre contrat a été automatiquement généré et validé pour le devis ${docToPersist.ref}. Vous pouvez le télécharger dans votre espace client.`,
                            selectedClientId,
                            'documents'
                        );
                    } else {
                        showToast('Erreur lors de la génération du contrat.', 'error');
                    }
                }
            }

            // NOTIFICATION POUR LE CLIENT: Envoyer une notification lors de l'envoi du devis
            if (isSendingQuoteNow) {
                await addNotification(
                    'client',
                    'info',
                    'Nouveau devis reçu',
                    `Vous avez reçu un nouveau devis ${docToPersist.ref} d'un montant de ${docToPersist.totalTTC}€. Consultez-le dans votre espace client.`,
                    selectedClientId,
                    'documents'
                );
            }

            setIsDraftDirty(false);
            setLocalDraftId(null);
            closeModal({ skipAutosave: true });
            if (modalMode === 'devis') {
                showToast(isValidateOnly ? 'Devis validé (non envoyé) !' : 'Devis envoyé (Valable 48h) !');
            } else {
                showToast('Facture générée avec succès !');
            }
        } catch (e: any) {
            showToast("Erreur création document: " + e.message, 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    // --- ACTION HANDLERS ---

    const handleConversion = async (docId: string, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (window.confirm("Confirmer la conversion en facture ?")) {
            const key = `convert:${docId}`;
            startAction(key);
            try {
                await convertQuoteToInvoice(docId);
                setFilterStatus('all');
                showToast('Devis converti en facture !');
            } catch (err: any) {
                showToast('Erreur conversion en facture.', 'error');
            } finally {
                stopAction(key);
            }
        }
    };

    const handleSendEmail = async (doc: any, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        const docId = String(doc?.id || '');
        const key = `email:${docId || String(doc?.ref || '')}`;
        startAction(key);
        try {
            const client = clients.find(c => c.id === String(doc?.clientId || ''));
            const to = client?.email || '';
            if (!to) {
                showToast('Email client introuvable.', 'error');
                return;
            }

            await sendEmail(to, `Document ${String(doc?.ref || '')}`, 'new_document', {
                type: doc?.type || 'Document',
                ref: doc?.ref || '',
                link: 'https://www.prestaservicesantilles.com/'
            });
            showToast(`Email envoyé au client (${to}).`, 'success');
        } catch (err: any) {
            showToast('Erreur envoi email.', 'error');
        } finally {
            stopAction(key);
        }
    };

    const handleMarkPaid = async (docId: string, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (window.confirm("Confirmez-vous avoir reçu le paiement ?")) {
            const key = `paid:${docId}`;
            startAction(key);
            try {
                await markInvoicePaid(docId);
                showToast('Facture marquée comme payée.');
            } catch (err: any) {
                showToast('Erreur encaissement facture.', 'error');
            } finally {
                stopAction(key);
            }
        }
    };

    const handleManualReminder = async (docId: string, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const key = `reminder:${docId}`;
        startAction(key);
        try {
            await sendDocumentReminder(docId);
            showToast('Relance envoyée (Notification + Email).');
        } catch (err: any) {
            showToast('Erreur envoi relance.', 'error');
        } finally {
            stopAction(key);
        }
    };

    const handleManualSignatureReminder = async (docId: string, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const key = `signatureReminder:${docId}`;
        startAction(key);
        try {
            await sendQuoteSignatureReminder(docId);
            showToast('Rappel signature devis envoyé.', 'success');
        } catch (err) {
            console.error('[DevisFactures] Signature reminder failed:', err);
            showToast('Erreur envoi rappel signature devis.', 'error');
        } finally {
            stopAction(key);
        }
    };

    const confirmDelete = (id: string, ref: string, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDocumentToDelete({ id, ref });
        setIsBulkDelete(false);
        setIsDeleteModalOpen(true);
    };

    const copyToClipboard = async (text: string) => {
        try {
            await navigator.clipboard.writeText(text);
            showToast('Lien copié dans le presse-papiers');
        } catch (err) {
            showToast('Erreur lors de la copie du lien');
        }
    };

    const confirmBulkDelete = () => {
        if (selectedIds.size > 0) {
            setIsBulkDelete(true);
            setIsDeleteModalOpen(true);
        }
    };

    const executeDelete = async () => {
        setIsDeleting(true);
        try {
            if (isBulkDelete) {
                const count = selectedIds.size;
                const all = Array.from(selectedIds);
                const localIds = all.filter(id => isLocalDraftDocId(id));
                const remoteIds = all.filter(id => !isLocalDraftDocId(id));
                if (remoteIds.length > 0) {
                    await deleteDocuments(remoteIds);
                }
                if (localIds.length > 0) {
                    localIds.forEach(id => deleteLocalDraftById(parseLocalDraftIdFromDocId(id)));
                }
                setSelectedIds(new Set());
                showToast(`${count} document(s) supprimé(s).`);
            } else if (documentToDelete) {
                if (isLocalDraftDocId(documentToDelete.id)) {
                    deleteLocalDraftById(parseLocalDraftIdFromDocId(documentToDelete.id));
                    showToast(`Brouillon ${documentToDelete.ref} supprimé.`);
                } else {
                    await deleteDocument(documentToDelete.id);
                    showToast(`Document ${documentToDelete.ref} supprimé définitivement.`);
                }
            }
            setIsDeleteModalOpen(false);
            setDocumentToDelete(null);
        } catch (err: any) {
            showToast('Erreur suppression document(s).', 'error');
        } finally {
            setIsDeleting(false);
        }
    };

    const handleDuplicate = async (id: string, ref: string, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        try {
            setDuplicatingIds(prev => {
                const next = new Set(prev);
                next.add(id);
                return next;
            });

            const duplicated = await duplicateDocument(id);
            if (!duplicated) {
                throw new Error('Duplication impossible');
            }

            openDuplicateModal(duplicated);
            setFilterStatus('all');
        } catch (err: any) {
            alert("Erreur duplication: " + err.message);
        } finally {
            setDuplicatingIds(prev => {
                const next = new Set(prev);
                next.delete(id);
                return next;
            });
        }
    };

    const handleStatusChange = (id: string, newStatus: string, e: React.ChangeEvent<HTMLSelectElement>) => {
        e.preventDefault();
        e.stopPropagation();
        updateDocumentStatus(id, newStatus);
        showToast('Statut mis à jour manuellement.');
    };

    // Bulk Actions
    const toggleSelection = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setSelectedIds(newSet);
    };

    const toggleSelectAll = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (selectedIds.size === columnFilteredDocs.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(columnFilteredDocs.map(d => d.id)));
        }
    };

    const localDraftDocs = useMemo(() => {
        const items: any[] = [];
        for (const draft of localQuoteDrafts) {
            const client = clients.find(c => String(c.id) === String(draft.form.selectedClientId || ''));
            const pack = packs.find(p => String(p.id) === String(draft.form.selectedPackId || ''));

            const isCustom = draft.form.serviceType === 'custom';
            const customTotalHT = Array.isArray(draft.form.customLines)
                ? draft.form.customLines.reduce((acc, l) => acc + (Number(l.unitPrice || 0) * Number(l.quantity || 0)), 0)
                : 0;

            const totalHT = isCustom ? customTotalHT : (Number(draft.form.unitPrice || 0) * Number(draft.form.packQuantity || 1));
            const tvaRateDraft = Number(draft.form.tvaRate || 0) as any;
            const totalTTC = totalHT + (totalHT * (tvaRateDraft / 100));

            const description = String(draft.form.customDescription || (pack?.description || '') || '');
            items.push({
                id: `localdraft:${draft.id}`,
                ref: draft.ref,
                clientId: String(draft.form.selectedClientId || ''),
                clientName: client?.name || (draft.form.selectedClientId ? 'Client' : 'Brouillon'),
                date: String((draft.updatedAt || '').slice(0, 10) || getMartiniqueToday()),
                type: 'Devis',
                category: draft.form.serviceType,
                description,
                unitPrice: Number(draft.form.unitPrice || 0),
                quantity: Number(draft.form.packQuantity || 1),
                tvaRate: tvaRateDraft,
                totalHT,
                totalTTC,
                taxCreditEnabled: !!draft.form.taxCreditActive,
                status: 'draft',
                slotsData: Array.isArray(draft.form.interventionSlots) ? draft.form.interventionSlots : [],
                packId: draft.form.serviceType === 'pack' ? String(draft.form.selectedPackId || '') : undefined
            } as any);
        }
        return items;
    }, [localQuoteDrafts, clients, packs]);

    const allDocs = useMemo(() => {
        return [...documents, ...(localDraftDocs as any)];
    }, [documents, localDraftDocs]);

    const filteredDocs = useMemo(() => {
        let docs = [...allDocs]; // Copie pour éviter les mutations

        // Filtrage global par type de service
        docs = docs.filter(doc => matchesServiceTypeFilterFromText(doc.description, serviceTypeFilter));
        
        // Filtrage par statut
        if (filterStatus !== 'all') docs = docs.filter(doc => doc.status === filterStatus);
        
        // Filtrage par recherche
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            docs = docs.filter(doc => doc.clientName.toLowerCase().includes(query) || doc.ref.toLowerCase().includes(query));
        }
        
        // Tri par ordre de création (date)
        docs.sort((a, b) => {
            const dateA = new Date(a.date).getTime();
            const dateB = new Date(b.date).getTime();
            return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
        });
        
        return docs;
    }, [filterStatus, searchQuery, allDocs, sortOrder, serviceTypeFilter]);

    // Filtres par colonne (tableau)
    const [columnFilters, setColumnFilters] = useState({
        ref: '',
        client: '',
        date: '',
        type: '',
        pack: '',
        ttc: '',
        status: ''
    });

    const columnFilteredDocs = useMemo(() => {
        let result = filteredDocs;

        const resolvePackForDocument = (d: any) => {
            if (!d) return undefined;
            if (d.packId) {
                return packs.find(p => p.id === d.packId);
            }
            const packNameRaw = String((d.packName || '') as any).trim();
            if (packNameRaw) {
                return packs.find(p => p.name === packNameRaw) || packs.find(p => p.name.toLowerCase() === packNameRaw.toLowerCase());
            }
            const descriptionRaw = String((d.description || '') as any);
            if (descriptionRaw) {
                return packs.find(p => descriptionRaw.toLowerCase().includes(p.name.toLowerCase()));
            }
            return undefined;
        };

        if (columnFilters.ref) {
            const q = columnFilters.ref.toLowerCase();
            result = result.filter(d => (d.ref || '').toLowerCase().includes(q));
        }

        if (columnFilters.client) {
            const q = columnFilters.client.toLowerCase();
            result = result.filter(d => (d.clientName || '').toLowerCase().includes(q));
        }

        if (columnFilters.date) {
            const q = columnFilters.date.toLowerCase();
            result = result.filter(d => (d.date || '').toLowerCase().includes(q));
        }

        if (columnFilters.type) {
            const q = columnFilters.type.toLowerCase();
            result = result.filter(d => (d.type || '').toLowerCase().includes(q));
        }

        if (columnFilters.pack) {
            const q = columnFilters.pack.toLowerCase();
            result = result.filter(d => {
                const pack = resolvePackForDocument(d);
                if (!pack) return false;
                return pack.name.toLowerCase().includes(q);
            });
        }

        if (columnFilters.ttc) {
            const q = columnFilters.ttc.toLowerCase();
            result = result.filter(d => String(d.totalTTC ?? '').toLowerCase().includes(q));
        }

        if (columnFilters.status) {
            const q = columnFilters.status.toLowerCase();
            result = result.filter(d => (d.status || '').toLowerCase().includes(q));
        }

        return result;
    }, [filteredDocs, columnFilters]);

    // Calculs qui s'adaptent au type de service
    const baseAmount = serviceType === 'custom' ? calculateCustomTotal() : (unitPrice * packQuantity);
    const totalHT = serviceType === 'custom' ? baseAmount : (unitPrice * packQuantity);
    const tvaAmount = totalHT * (tvaRate / 100);
    const totalTTC = totalHT + tvaAmount;
    const taxCreditAmount = taxCreditActive ? totalTTC * 0.5 : 0;
    const clientToPay = totalTTC - taxCreditAmount;

    // Helper to check pack name safely
    const packNameIncludes = (str: string) => {
        const pack = packs.find(p => p.id === selectedPackId);
        return pack?.name.toLowerCase().includes(str.toLowerCase()) || false;
    };

    return (
        <div className="p-4 md:p-8 h-full overflow-y-auto bg-white/40 relative">
            {/* Toast Container */}
            <div className={`fixed bottom-6 right-6 z-[9999] transition-all duration-500 transform ${toast.show ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0 pointer-events-none'}`}>
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

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div><h2 className="text-3xl font-serif font-bold text-slate-800">Devis/Factures</h2><p className="text-sm text-slate-500 mt-1">Gestion commerciale et facturation</p></div>
                <div className="flex items-center bg-white rounded-lg shadow-sm border border-beige-200 p-1">
                    <Filter className="w-4 h-4 text-slate-400 ml-2 mr-2" />
                    <SearchableSelect
                        options={[
                            { value: 'all', label: 'Tous les documents' },
                            { value: 'draft', label: 'Brouillons' },
                            { value: 'sent', label: 'Devis envoyés' },
                            { value: 'signed', label: 'Devis signés' },
                            { value: 'rejected', label: 'Refusés' },
                            { value: 'converted', label: 'Facturés' },
                            { value: 'expired', label: 'Expirés' },
                            { value: 'validated', label: 'Validés' },
                        ]}
                        value={filterStatus}
                        onChange={(value) => setFilterStatus(value)}
                        className="min-w-[220px]"
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
                <div className="lg:col-span-1 flex gap-4">
                    {selectedIds.size > 0 ? (
                        <button onClick={confirmBulkDelete} className="flex-1 flex flex-col items-center justify-center p-6 bg-red-100 rounded-lg hover:bg-red-200 transition border border-red-200 shadow-sm group animate-in fade-in">
                            <Trash2 className="w-5 h-5 text-red-600 mb-2" /><span className="text-sm font-bold text-red-700">Supprimer ({selectedIds.size})</span>
                        </button>
                    ) : (
                        <>
                            <button onClick={() => openModal('devis')} className="flex-1 flex flex-col items-center justify-center p-6 bg-cream-100 rounded-lg hover:bg-cream-200 transition border border-beige-200 shadow-sm group"><Plus className="w-5 h-5 text-brand-blue mb-2 group-hover:scale-110 transition-transform" /><span className="text-sm font-bold text-slate-700">Créer devis</span></button>
                            <button onClick={() => openModal('facture')} className="flex-1 flex flex-col items-center justify-center p-6 bg-cream-100 rounded-lg hover:bg-cream-200 transition border border-beige-200 shadow-sm group"><Plus className="w-5 h-5 text-brand-orange mb-2 group-hover:scale-110 transition-transform" /><span className="text-sm font-bold text-slate-700">Créer facture</span></button>
                        </>
                    )}
                </div>
                <div className="lg:col-span-2 bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-center">
                    <Search className="w-5 h-5 text-slate-400 mr-3" /><input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Rechercher..." className="flex-1 bg-transparent outline-none text-sm" />
                </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 flex flex-col shadow-sm min-h-[400px] overflow-hidden">
                {isMobile ? (
                    // Affichage mobile en cartes
                    <div className="p-4 space-y-3">
                        {/* Header mobile avec sélection */}
                        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                            <button onClick={toggleSelectAll} className="text-slate-500 hover:text-slate-700 flex items-center gap-2">
                                {selectedIds.size > 0 && selectedIds.size === columnFilteredDocs.length ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                                <span className="text-xs">Tout sélectionner</span>
                            </button>
                            {selectedIds.size > 0 && (
                                <span className="text-xs text-brand-blue font-bold">{selectedIds.size} sélectionné(s)</span>
                            )}
                        </div>

                        {/* Cartes des documents */}
                        {columnFilteredDocs.length > 0 ? (
                            columnFilteredDocs.map(doc => (
                                <div key={doc.id} className={`border rounded-lg p-4 space-y-3 transition-colors ${selectedIds.has(doc.id) ? 'bg-blue-50 border-brand-blue' : 'border-slate-200 hover:bg-cream-50'}`}>
                                    {/* Header de la carte avec sélection et référence */}
                                    <div className="flex items-start justify-between">
                                        <button
                                            onClick={(e) => toggleSelection(doc.id, e)}
                                            className="text-slate-400 hover:text-brand-blue mt-1"
                                        >
                                            {selectedIds.has(doc.id) ? <CheckSquare className="w-4 h-4 text-brand-blue" /> : <Square className="w-4 h-4" />}
                                        </button>
                                        <div className="flex-1 ml-3">
                                            <div className="flex items-center justify-between">
                                                <span
                                                    className="font-bold text-slate-900 cursor-pointer hover:text-brand-blue transition-colors"
                                                    onClick={() => openDetailModal(doc)}
                                                >
                                                    {doc.ref}
                                                </span>
                                                <span className={`px-2 py-1 rounded text-xs ${doc.type === 'Devis' ? 'bg-blue-50 text-brand-blue' : 'bg-purple-50 text-purple-600'}`}>
                                                    {doc.type}
                                                </span>
                                            </div>
                                            <div className="text-slate-700 font-bold mt-1">{doc.clientName}</div>
                                            <div className="text-xs text-slate-500 mt-1">{doc.date}</div>
                                        </div>
                                    </div>

                                    {/* Montant et statut */}
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <div className="text-lg font-bold text-slate-900">{doc.totalTTC ? doc.totalTTC.toFixed(2) : '0.00'} €</div>
                                        </div>
                                        <div className="text-center">
                                            <div onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
                                                {isLocalDraftDocId(doc.id) ? (
                                                    <span className="inline-flex items-center justify-center bg-slate-100 text-slate-700 border border-slate-200 px-3 py-2 rounded-lg text-xs font-bold min-w-[150px]">
                                                        Brouillon
                                                    </span>
                                                ) : (
                                                    <SearchableSelect
                                                        options={doc.type === 'Devis'
                                                            ? [
                                                                { value: 'draft', label: 'Brouillon' },
                                                                { value: 'sent', label: 'Envoyé' },
                                                                { value: 'signed', label: 'Signé' },
                                                                { value: 'rejected', label: 'Refusé' },
                                                                { value: 'converted', label: 'Facturé' },
                                                                { value: 'expired', label: 'Expiré' },
                                                                { value: 'validated', label: 'Validé' },
                                                            ]
                                                            : [
                                                                { value: 'pending', label: 'En attente' },
                                                                { value: 'paid', label: 'Payée' },
                                                                { value: 'rejected', label: 'Annulée' }
                                                            ]}
                                                        value={doc.status}
                                                        onChange={(value) => {
                                                            if (
                                                                doc.type === 'Devis' &&
                                                                doc.status !== 'signed' &&
                                                                value === 'signed' &&
                                                                (currentUser?.role === 'admin' || currentUser?.role === 'super_admin')
                                                            ) {
                                                                openAdminSignModal(doc.id);
                                                                return;
                                                            }
                                                            updateDocumentStatus(doc.id, value);
                                                            showToast('Statut mis à jour manuellement.');
                                                        }}
                                                        isClearable={false}
                                                        className="min-w-[150px]"
                                                        triggerClassName={`${doc.status === 'draft' ? 'bg-slate-100 text-slate-700 border-slate-200' : ''}
                                                            ${doc.status === 'signed' ? 'bg-green-100 text-green-800 border-green-200' : ''}
                                                            ${doc.status === 'sent' ? 'bg-orange-100 text-orange-800 border-orange-200' : ''}
                                                            ${doc.status === 'expired' ? 'bg-red-100 text-red-800 border-red-200' : ''}
                                                            ${doc.status === 'paid' ? 'bg-teal-100 text-teal-800 border-teal-200' : ''}
                                                            ${doc.status === 'converted' ? 'bg-slate-100 text-slate-600 border-slate-200' : ''}
                                                            ${doc.status === 'pending' ? 'bg-yellow-100 text-yellow-800 border-yellow-200' : ''}
                                                            ${doc.status === 'rejected' ? 'bg-red-50 text-red-800 border-red-100' : ''}
                                                            ${doc.status === 'validated' ? 'bg-blue-100 text-blue-800 border-blue-200' : ''}
                                                        }`}
                                                    />
                                                )}
                                            </div>
                                            {doc.reminderSent && (
                                                <div className="mt-1">
                                                    <span className="text-[10px] text-orange-600 font-bold flex items-center justify-center gap-1 bg-orange-50 px-1 rounded border border-orange-200 w-fit">
                                                        <RotateCcw className="w-3 h-3" /> Relance auto
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                                        {!isLocalDraftDocId(doc.id) && doc.type === 'Devis' && doc.status === 'expired' && (
                                            <button
                                                onClick={(e) => renewExpiredQuote(doc, e)}
                                                disabled={loadingActions.has(`renew:${doc.id}`)}
                                                className="text-slate-400 hover:text-brand-orange p-1 hover:bg-orange-50 rounded transition disabled:opacity-50"
                                                title="Renouveler le devis"
                                            >
                                                {loadingActions.has(`renew:${doc.id}`)
                                                    ? <Loader2 className="w-4 h-4 animate-spin pointer-events-none" />
                                                    : <RotateCcw className="w-4 h-4 pointer-events-none" />
                                                }
                                            </button>
                                        )}
                                        {!isLocalDraftDocId(doc.id) && doc.type === 'Devis' && doc.status === 'sent' && (currentUser?.role === 'admin' || currentUser?.role === 'super_admin') && (
                                            <button
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    openAdminSignModal(doc.id);
                                                }}
                                                className="text-slate-400 hover:text-brand-blue p-1 hover:bg-blue-50 rounded transition"
                                                title="Signer le devis (admin)"
                                            >
                                                <PenTool className="w-4 h-4" />
                                            </button>
                                        )}

                                        {/* CONVERT BUTTON */}
                                        {!isLocalDraftDocId(doc.id) && doc.type === 'Devis' && doc.status === 'signed' && (
                                            <button
                                                onClick={(e) => handleConversion(doc.id, e)}
                                                className="bg-brand-orange text-white text-xs px-3 py-1 rounded-lg hover:bg-orange-600 transition shadow-sm flex items-center gap-1"
                                                title="Convertir après paiement"
                                            >
                                                <RefreshCw className="w-3 h-3 pointer-events-none" /> Convertir
                                            </button>
                                        )}

                                        {/* CONTRACT DOWNLOAD BUTTON */}
                                        {!isLocalDraftDocId(doc.id) && doc.type === 'Devis' && (doc.status === 'signed' || doc.status === 'paid' || doc.status === 'converted') && (
                                            <button
                                                onClick={(e) => handleDownloadContract(doc)}
                                                className="text-slate-400 hover:text-green-600 p-1 hover:bg-green-50 rounded transition"
                                                title="Télécharger le contrat"
                                            >
                                                <FileText className="w-4 h-4" />
                                            </button>
                                        )}

                                        {/* SEND EMAIL BUTTON */}
                                        {!isLocalDraftDocId(doc.id) && (doc.type === 'Facture' || doc.status === 'converted') && (
                                            <button
                                                onClick={(e) => handleSendEmail(doc, e)}
                                                className="text-slate-400 hover:text-brand-blue p-1 hover:bg-slate-100 rounded transition"
                                                title="Envoyer par email"
                                            >
                                                <Mail className="w-4 h-4" />
                                            </button>
                                        )}

                                        {/* DOWNLOAD BUTTON */}
                                        {!isLocalDraftDocId(doc.id) ? (
                                            <button
                                                onClick={() => window.open(`/documents/${doc.ref}`, '_blank')}
                                                className="text-slate-400 hover:text-brand-blue p-1 hover:bg-slate-100 rounded transition"
                                                title="Télécharger"
                                            >
                                                <Paperclip className="w-4 h-4" />
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => openDetailModal(doc)}
                                                className="text-slate-400 hover:text-brand-blue p-1 hover:bg-slate-100 rounded transition"
                                                title="Continuer l'édition"
                                            >
                                                <PenTool className="w-4 h-4" />
                                            </button>
                                        )}

                                        {/* COPY BUTTON */}
                                        <button
                                            onClick={() => copyToClipboard(doc.ref)}
                                            className="text-slate-400 hover:text-brand-blue p-1 hover:bg-slate-100 rounded transition"
                                            title="Copier le lien"
                                        >
                                            <Copy className="w-4 h-4" />
                                        </button>

                                        {/* DELETE BUTTON */}
                                        <button
                                            onClick={(e) => confirmDelete(doc.id, doc.ref, e)}
                                            className="text-slate-400 hover:text-red-600 p-1 hover:bg-red-50 rounded transition"
                                            title="Supprimer"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-8 text-slate-500">
                                <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                                Aucun devis ou facture trouvé
                            </div>
                        )}
                    </div>
                ) : (
                    // Affichage desktop en tableau
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-slate-500 uppercase bg-slate-50 sticky top-0 z-10">
                            <tr>
                                <th className="px-6 py-3 w-10">
                                    <button onClick={toggleSelectAll} className="text-slate-500 hover:text-slate-700">
                                        {selectedIds.size > 0 && selectedIds.size === columnFilteredDocs.length ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                                    </button>
                                </th>
                                <th className="px-6 py-3">
                                    <div className="flex items-center gap-1">
                                        Réf
                                        <button
                                            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                                            className="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-100 rounded"
                                            title={`Tri par ordre de création: ${sortOrder === 'asc' ? 'croissant' : 'décroissant'}`}
                                        >
                                            {sortOrder === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                        </button>
                                    </div>
                                </th>
                                <th className="px-6 py-3">Client</th>
                                <th className="px-6 py-3">
                                    <div className="flex items-center gap-1">
                                        Date
                                        <button
                                            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                                            className="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-100 rounded"
                                            title={`Tri par date: ${sortOrder === 'asc' ? 'plus ancien d\'abord' : 'plus récent d\'abord'}`}
                                        >
                                            {sortOrder === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                        </button>
                                    </div>
                                </th>
                                <th className="px-6 py-3">Type</th>
                                <th className="px-6 py-3">Pack</th>
                                <th className="px-6 py-3 text-right">TTC</th>
                                <th className="px-6 py-3 text-center">Statut (Modifiable)</th>
                                <th className="px-6 py-3 text-center">Actions</th>
                            </tr>
                            <tr className="bg-white/60">
                                <th className="px-6 py-2"></th>
                                <th className="px-6 py-2">
                                    <input
                                        value={columnFilters.ref}
                                        onChange={(e) => setColumnFilters(prev => ({ ...prev, ref: e.target.value }))}
                                        placeholder="Filtrer..."
                                        className="w-full border border-slate-200 rounded px-2 py-1 text-xs font-medium text-slate-700 bg-white"
                                    />
                                </th>
                                <th className="px-6 py-2">
                                    <input
                                        value={columnFilters.client}
                                        onChange={(e) => setColumnFilters(prev => ({ ...prev, client: e.target.value }))}
                                        placeholder="Client..."
                                        className="w-full border border-slate-200 rounded px-2 py-1 text-xs font-medium text-slate-700 bg-white"
                                    />
                                </th>
                                <th className="px-6 py-2">
                                    <input
                                        value={columnFilters.date}
                                        onChange={(e) => setColumnFilters(prev => ({ ...prev, date: e.target.value }))}
                                        placeholder="Date..."
                                        className="w-full border border-slate-200 rounded px-2 py-1 text-xs font-medium text-slate-700 bg-white"
                                    />
                                </th>
                                <th className="px-6 py-2">
                                    <input
                                        value={columnFilters.type}
                                        onChange={(e) => setColumnFilters(prev => ({ ...prev, type: e.target.value }))}
                                        placeholder="Type..."
                                        className="w-full border border-slate-200 rounded px-2 py-1 text-xs font-medium text-slate-700 bg-white"
                                    />
                                </th>
                                <th className="px-6 py-2">
                                    <input
                                        value={columnFilters.pack}
                                        onChange={(e) => setColumnFilters(prev => ({ ...prev, pack: e.target.value }))}
                                        placeholder="Pack..."
                                        className="w-full border border-slate-200 rounded px-2 py-1 text-xs font-medium text-slate-700 bg-white"
                                    />
                                </th>
                                <th className="px-6 py-2">
                                    <input
                                        value={columnFilters.ttc}
                                        onChange={(e) => setColumnFilters(prev => ({ ...prev, ttc: e.target.value }))}
                                        placeholder="TTC..."
                                        className="w-full border border-slate-200 rounded px-2 py-1 text-xs font-medium text-slate-700 bg-white"
                                    />
                                </th>
                                <th className="px-6 py-2">
                                    <input
                                        value={columnFilters.status}
                                        onChange={(e) => setColumnFilters(prev => ({ ...prev, status: e.target.value }))}
                                        placeholder="Statut..."
                                        className="w-full border border-slate-200 rounded px-2 py-1 text-xs font-medium text-slate-700 bg-white"
                                    />
                                </th>
                                <th className="px-6 py-2"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {columnFilteredDocs.length > 0 ? (
                                columnFilteredDocs.map(doc => (
                                    <tr key={doc.id} className={`hover:bg-cream-50 transition-colors ${selectedIds.has(doc.id) ? 'bg-blue-50' : ''}`}>
                                        <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                                            <button onClick={(e) => toggleSelection(doc.id, e)} className="text-slate-400 hover:text-brand-blue">
                                                {selectedIds.has(doc.id) ? <CheckSquare className="w-4 h-4 text-brand-blue" /> : <Square className="w-4 h-4" />}
                                            </button>
                                        </td>
                                        <td className="px-6 py-4 font-medium text-slate-900 cursor-pointer hover:text-brand-blue transition-colors" onClick={() => openDetailModal(doc)}>{doc.ref}</td>
                                        <td className="px-6 py-4 cursor-pointer hover:text-brand-blue transition-colors" onClick={() => openDetailModal(doc)}><div className="font-bold text-slate-700">{doc.clientName}</div></td>
                                        <td className="px-6 py-4 cursor-pointer hover:text-brand-blue transition-colors" onClick={() => openDetailModal(doc)}>{doc.date}</td>
                                        <td className="px-6 py-4 cursor-pointer hover:text-brand-blue transition-colors" onClick={() => openDetailModal(doc)}><span className={`px-2 py-1 rounded text-xs ${doc.type === 'Devis' ? 'bg-blue-50 text-brand-blue' : 'bg-purple-50 text-purple-600'}`}>{doc.type}</span></td>
                                        <td className="px-6 py-4 cursor-pointer hover:text-brand-blue transition-colors" onClick={() => openDetailModal(doc)}>
                                            {(() => {
                                                const pack = (() => {
                                                    if (doc.packId) return packs.find(p => p.id === doc.packId);
                                                    const packNameRaw = String((doc as any).packName || '').trim();
                                                    if (packNameRaw) {
                                                        return packs.find(p => p.name === packNameRaw) || packs.find(p => p.name.toLowerCase() === packNameRaw.toLowerCase());
                                                    }
                                                    const descriptionRaw = String((doc as any).description || '');
                                                    if (descriptionRaw) {
                                                        return packs.find(p => descriptionRaw.toLowerCase().includes(p.name.toLowerCase()));
                                                    }
                                                    return undefined;
                                                })();

                                                if (pack) {
                                                    return (
                                                        <div className="flex flex-col gap-1">
                                                            <span className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 px-3 py-1.5 rounded-lg text-xs font-semibold text-blue-700 shadow-sm">
                                                                {pack.name}
                                                            </span>
                                                            <span className="text-xs text-slate-500 font-medium">
                                                                {pack.priceTTC}€ TTC
                                                            </span>
                                                        </div>
                                                    );
                                                }

                                                return <span className="text-slate-400 text-xs font-medium italic">Personnalisé</span>;
                                            })()}
                                        </td>
                                        <td className="px-6 py-4 text-right font-bold cursor-pointer hover:text-brand-blue transition-colors" onClick={() => openDetailModal(doc)}>{doc.totalTTC ? doc.totalTTC.toFixed(2) : '0.00'} €</td>
                                        <td className="px-6 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                                            <div className="relative inline-block" onClick={(e) => e.stopPropagation()}>
                                                <div onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
                                                    {isLocalDraftDocId(doc.id) ? (
                                                        <span className="inline-flex items-center justify-center bg-slate-100 text-slate-700 border border-slate-200 px-3 py-2 rounded-lg text-xs font-bold min-w-[150px]">
                                                            Brouillon
                                                        </span>
                                                    ) : (
                                                        <SearchableSelect
                                                            options={doc.type === 'Devis'
                                                                ? [
                                                                    { value: 'draft', label: 'Brouillon' },
                                                                    { value: 'sent', label: 'Envoyé' },
                                                                    { value: 'signed', label: 'Signé' },
                                                                    { value: 'rejected', label: 'Refusé' },
                                                                    { value: 'converted', label: 'Facturé' },
                                                                    { value: 'expired', label: 'Expiré' },
                                                                    { value: 'validated', label: 'Validé' },
                                                                ]
                                                                : [
                                                                    { value: 'pending', label: 'En attente' },
                                                                    { value: 'paid', label: 'Payée' },
                                                                    { value: 'rejected', label: 'Annulée' }
                                                                ]}
                                                            value={doc.status}
                                                            onChange={(value) => {
                                                                if (
                                                                    doc.type === 'Devis' &&
                                                                    doc.status !== 'signed' &&
                                                                    value === 'signed' &&
                                                                    (currentUser?.role === 'admin' || currentUser?.role === 'super_admin')
                                                                ) {
                                                                    openAdminSignModal(doc.id);
                                                                    return;
                                                                }
                                                                updateDocumentStatus(doc.id, value);
                                                                showToast('Statut mis à jour manuellement.');
                                                            }}
                                                            isClearable={false}
                                                            className="min-w-[150px]"
                                                            triggerClassName={`${doc.status === 'draft' ? 'bg-slate-100 text-slate-700 border-slate-200' : ''}
                                                                ${doc.status === 'signed' ? 'bg-green-100 text-green-800 border-green-200' : ''}
                                                                ${doc.status === 'sent' ? 'bg-orange-100 text-orange-800 border-orange-200' : ''}
                                                                ${doc.status === 'expired' ? 'bg-red-100 text-red-800 border-red-200' : ''}
                                                                ${doc.status === 'paid' ? 'bg-teal-100 text-teal-800 border-teal-200' : ''}
                                                                ${doc.status === 'converted' ? 'bg-slate-100 text-slate-600 border-slate-200' : ''}
                                                                ${doc.status === 'pending' ? 'bg-yellow-100 text-yellow-800 border-yellow-200' : ''}
                                                                ${doc.status === 'rejected' ? 'bg-red-50 text-red-800 border-red-100' : ''}
                                                                ${doc.status === 'validated' ? 'bg-blue-100 text-blue-800 border-blue-200' : ''}
                                                            }`}
                                                        />
                                                    )}
                                                </div>
                                            </div>

                                            {doc.reminderSent && (
                                                <div className="mt-1">
                                                    <span className="text-[10px] text-orange-600 font-bold flex items-center justify-center gap-1 bg-orange-50 px-1 rounded border border-orange-200 w-fit mx-auto">
                                                        <RotateCcw className="w-3 h-3" /> Relance auto
                                                    </span>
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                                            <div className="flex items-center justify-center gap-2">

                                                {!isLocalDraftDocId(doc.id) && doc.type === 'Devis' && doc.status === 'expired' && (
                                                    <button
                                                        onClick={(e) => renewExpiredQuote(doc, e)}
                                                        disabled={loadingActions.has(`renew:${doc.id}`)}
                                                        className="text-slate-400 hover:text-brand-orange p-1 hover:bg-orange-50 rounded transition disabled:opacity-50"
                                                        title="Renouveler le devis"
                                                    >
                                                        {loadingActions.has(`renew:${doc.id}`)
                                                            ? <Loader2 className="w-4 h-4 animate-spin pointer-events-none" />
                                                            : <RotateCcw className="w-4 h-4 pointer-events-none" />
                                                        }
                                                    </button>
                                                )}

                                                {!isLocalDraftDocId(doc.id) && doc.type === 'Devis' && doc.status === 'sent' && (currentUser?.role === 'admin' || currentUser?.role === 'super_admin') && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            openAdminSignModal(doc.id);
                                                        }}
                                                        className="text-slate-400 hover:text-brand-blue p-1 hover:bg-blue-50 rounded transition"
                                                        title="Signer le devis (admin)"
                                                    >
                                                        <PenTool className="w-4 h-4 pointer-events-none" />
                                                    </button>
                                                )}

                                                {/* CONVERT BUTTON */}
                                                {!isLocalDraftDocId(doc.id) && doc.type === 'Devis' && doc.status === 'paid' && (
                                                    <button
                                                        onClick={(e) => handleConversion(doc.id, e)}
                                                        disabled={loadingActions.has(`convert:${doc.id}`)}
                                                        className="bg-brand-orange text-white text-xs px-3 py-1 rounded-lg hover:bg-orange-600 transition shadow-sm flex items-center gap-1 disabled:opacity-50"
                                                        title="Convertir après paiement"
                                                    >
                                                        {loadingActions.has(`convert:${doc.id}`)
                                                            ? <Loader2 className="w-3 h-3 animate-spin pointer-events-none" />
                                                            : <RefreshCw className="w-3 h-3 pointer-events-none" />
                                                        }
                                                        Convertir
                                                    </button>
                                                )}

                                                {/* SEND EMAIL BUTTON */}
                                                {!isLocalDraftDocId(doc.id) && (doc.type === 'Facture' || doc.status === 'converted') && (
                                                    <button
                                                        onClick={(e) => handleSendEmail(doc, e)}
                                                        className="text-slate-400 hover:text-brand-blue p-1 hover:bg-slate-100 rounded transition"
                                                        title="Envoyer par email"
                                                    >
                                                        <Send className="w-4 h-4 pointer-events-none" />
                                                    </button>
                                                )}

                                                {/* MARK PAID BUTTON */}
                                                {!isLocalDraftDocId(doc.id) && doc.status === 'pending' && doc.type === 'Facture' && (
                                                    <button
                                                        onClick={(e) => handleMarkPaid(doc.id, e)}
                                                        disabled={loadingActions.has(`paid:${doc.id}`)}
                                                        className="bg-green-600 text-white text-xs px-3 py-1 rounded-lg hover:bg-green-700 transition shadow-sm flex items-center gap-1 disabled:opacity-50"
                                                        title="Marquer comme payé (Externe)"
                                                    >
                                                        {loadingActions.has(`paid:${doc.id}`)
                                                            ? <Loader2 className="w-3 h-3 animate-spin pointer-events-none" />
                                                            : <CreditCard className="w-3 h-3 pointer-events-none" />
                                                        }
                                                        Encaisser
                                                    </button>
                                                )}

                                                {/* REMINDER BUTTON */}
                                                {!isLocalDraftDocId(doc.id) && doc.type === 'Devis' && doc.status === 'sent' && (
                                                    <button
                                                        onClick={(e) => handleManualReminder(doc.id, e)}
                                                        disabled={loadingActions.has(`reminder:${doc.id}`)}
                                                        className="text-slate-400 hover:text-orange-500 p-1 hover:bg-orange-50 rounded transition disabled:opacity-50"
                                                        title="Forcer une relance maintenant"
                                                    >
                                                        {loadingActions.has(`reminder:${doc.id}`)
                                                            ? <Loader2 className="w-4 h-4 animate-spin pointer-events-none" />
                                                            : <Zap className="w-4 h-4 pointer-events-none" />
                                                        }
                                                    </button>
                                                )}

                                                {/* SIGNATURE REMINDER BUTTON */}
                                                {!isLocalDraftDocId(doc.id) && doc.type === 'Devis' && doc.status === 'sent' && (
                                                    <button
                                                        onClick={(e) => handleManualSignatureReminder(doc.id, e)}
                                                        disabled={loadingActions.has(`signatureReminder:${doc.id}`)}
                                                        className="text-slate-400 hover:text-teal-600 p-1 hover:bg-teal-50 rounded transition disabled:opacity-50"
                                                        title="Envoyer rappel signature devis (avec identifiants + temps restant)"
                                                    >
                                                        {loadingActions.has(`signatureReminder:${doc.id}`)
                                                            ? <Loader2 className="w-4 h-4 animate-spin pointer-events-none" />
                                                            : <Clock className="w-4 h-4 pointer-events-none" />
                                                        }
                                                    </button>
                                                )}

                                                {/* DUPLICATE BUTTON */}
                                                {!isLocalDraftDocId(doc.id) && (
                                                    <button
                                                        onClick={(e) => handleDuplicate(doc.id, doc.ref, e)}
                                                        disabled={duplicatingIds.has(doc.id)}
                                                        className="text-slate-400 hover:text-brand-blue p-1 hover:bg-slate-100 rounded transition disabled:opacity-50"
                                                        title="Dupliquer"
                                                    >
                                                        {duplicatingIds.has(doc.id)
                                                            ? <Loader2 className="w-4 h-4 animate-spin pointer-events-none" />
                                                            : <Copy className="w-4 h-4 pointer-events-none" />
                                                        }
                                                    </button>
                                                )}

                                                {/* DELETE BUTTON */}
                                                <button
                                                    onClick={(e) => confirmDelete(doc.id, doc.ref, e)}
                                                    className="text-slate-400 hover:text-red-500 p-1 hover:bg-red-50 rounded transition"
                                                    title="Supprimer"
                                                >
                                                    <Trash2 className="w-4 h-4 pointer-events-none" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr><td colSpan={8} className="px-6 py-8 text-center text-slate-400">Aucun document trouvé.</td></tr>
                            )}
                        </tbody>
                    </table>
                )}
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto flex flex-col">
                        <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-cream-50 rounded-t-2xl sticky top-0 z-10">
                            <div><h3 className="text-2xl font-serif font-bold text-slate-800">{modalMode === 'devis' ? 'Édition de Devis' : 'Édition de Facture'}</h3><p className="text-xs text-slate-500 mt-1">Infos obligatoires <span className="text-red-500">*</span></p></div>
                            <button onClick={() => closeModal()} className="p-2 hover:bg-slate-200 rounded-full transition"><X className="w-6 h-6 text-slate-500" /></button>
                        </div>
                        <div className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-8" onBlurCapture={() => scheduleDraftAutosave()}>
                            <div className="lg:col-span-7 space-y-8">
                                <section>
                                    <h4 className="text-sm font-bold mb-4 flex items-center gap-2 text-slate-500 uppercase"><span className="bg-brand-blue text-white w-6 h-6 rounded-full flex items-center justify-center text-xs">1</span> Client (Autofill)</h4>
                                    <SearchableSelect
                                        options={clients.map(c => ({ value: c.id, label: `${c.name} - ${c.city}` }))}
                                        value={selectedClientId}
                                        onChange={(value) => {
                                            setSelectedClientId(value);
                                            markDraftDirty();
                                        }}
                                        placeholder="Sélectionner un client..."
                                        className="mb-4"
                                    />

                                    {/* Autofill Visualization */}
                                    {selectedClient && (
                                        <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 text-sm text-slate-700">
                                            <p className="font-bold text-blue-800 mb-2 flex items-center gap-2"><CheckCircle className="w-3 h-3" /> Données chargées</p>
                                            <div className="grid grid-cols-2 gap-2">
                                                <div><span className="text-xs text-slate-500 uppercase block">Nom</span><span className="font-bold">{selectedClient.name}</span></div>
                                                <div><span className="text-xs text-slate-500 uppercase block">Ville</span><span className="font-bold">{selectedClient.city}</span></div>
                                                <div><span className="text-xs text-slate-500 uppercase block">Téléphone</span><span className="font-bold">{selectedClient.phone}</span></div>
                                                <div><span className="text-xs text-slate-500 uppercase block">Email</span><span className="font-bold">{selectedClient.email}</span></div>
                                            </div>
                                        </div>
                                    )}
                                </section>

                                <section>
                                    <h4 className="text-sm font-bold mb-4 flex items-center gap-2 text-slate-500 uppercase"><span className="bg-brand-blue text-white w-6 h-6 rounded-full flex items-center justify-center text-xs">2</span> Prestation</h4>
                                    <div className="grid grid-cols-2 gap-4 mb-4">
                                        <button onClick={() => { setServiceType('pack'); markDraftDirty(); }} className={`p-3 border rounded-lg text-sm font-bold transition ${serviceType === 'pack' ? 'border-brand-blue bg-blue-50 text-brand-blue' : 'border-slate-200 text-slate-500'}`}>Pack Existant</button>
                                        <button onClick={() => { setServiceType('custom'); markDraftDirty(); }} className={`p-3 border rounded-lg text-sm font-bold transition ${serviceType === 'custom' ? 'border-brand-blue bg-blue-50 text-brand-blue' : 'border-slate-200 text-slate-500'}`}>Sur Mesure</button>
                                    </div>
                                    {serviceType === 'pack' ? (
                                        <div className="space-y-4">
                                            <SearchableSelect
                                                options={packs.map(p => ({ value: p.id, label: `${p.name} - ${p.priceTTC}€ TTC` }))}
                                                value={selectedPackId}
                                                onChange={(value) => {
                                                    setSelectedPackId(value);
                                                    markDraftDirty();
                                                }}
                                                placeholder="Sélectionner un pack..."
                                            />
                                            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"><span className="text-sm font-bold text-slate-600">Prix Unitaire TTC</span><span className="font-mono font-bold text-slate-800">{unitPrice} €</span></div>
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            {/* Lignes personnalisées multiples */}
                                            <div className="bg-slate-50 rounded-lg p-4">
                                                <div className="flex justify-between items-center mb-3">
                                                    <h5 className="text-sm font-bold text-slate-700">Lignes de prestation</h5>
                                                    <button
                                                        onClick={addCustomLine}
                                                        className="bg-brand-blue text-white px-3 py-1 rounded text-xs font-bold hover:bg-blue-700 flex items-center gap-1"
                                                    >
                                                        <Plus className="w-3 h-3" /> Ajouter une ligne
                                                    </button>
                                                </div>

                                                {customLines.length === 0 ? (
                                                    <div className="text-center py-6 text-slate-500 text-sm">
                                                        <p>Aucune ligne de prestation ajoutée</p>
                                                        <button
                                                            onClick={addCustomLine}
                                                            className="mt-2 text-brand-blue hover:underline font-bold"
                                                        >
                                                            Ajouter votre première ligne
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="space-y-2">
                                                        {customLines.map((line, index) => (
                                                            <div key={line.id} className="bg-white border border-slate-200 rounded-lg p-3">
                                                                <div className="flex items-center justify-between mb-2">
                                                                    <span className="text-xs font-bold text-slate-500">Ligne {index + 1}</span>
                                                                    <button
                                                                        onClick={() => removeCustomLine(line.id)}
                                                                        className="text-red-500 hover:text-red-700 text-xs"
                                                                    >
                                                                        <Trash2 className="w-3 h-3" />
                                                                    </button>
                                                                </div>
                                                                <div className="grid grid-cols-12 gap-2">
                                                                    <input
                                                                        type="text"
                                                                        placeholder="Description"
                                                                        className="col-span-6 p-2 border border-slate-200 rounded text-sm"
                                                                        value={line.description}
                                                                        onChange={(e) => updateCustomLine(line.id, 'description', e.target.value)}
                                                                    />
                                                                    <input
                                                                        type="number"
                                                                        placeholder="Quantité"
                                                                        className="col-span-2 p-2 border border-slate-200 rounded text-sm"
                                                                        min="1"
                                                                        value={line.quantity}
                                                                        onChange={(e) => updateCustomLine(line.id, 'quantity', e.target.value)}
                                                                    />
                                                                    <input
                                                                        type="number"
                                                                        placeholder="Prix TTC"
                                                                        className="col-span-3 p-2 border border-slate-200 rounded text-sm"
                                                                        min="0"
                                                                        step="0.01"
                                                                        value={line.unitPrice}
                                                                        onChange={(e) => updateCustomLine(line.id, 'unitPrice', e.target.value)}
                                                                    />
                                                                    <div className="col-span-1 flex items-center justify-end">
                                                                        <span className="text-sm font-bold text-slate-800">
                                                                            {(line.unitPrice * line.quantity).toFixed(2)}€
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Total des lignes personnalisées */}
                                            {customLines.length > 0 && (
                                                <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                                                    <span className="text-sm font-bold text-blue-700">Total TTC</span>
                                                    <span className="font-mono font-bold text-blue-800">{calculateCustomTotal().toFixed(2)} €</span>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </section>

                                {modalMode === 'devis' && (selectedPackId || serviceType === 'custom') && (
                                    <section>
                                        <h4 className="text-sm font-bold mb-4 flex items-center gap-2 text-slate-500 uppercase"><span className="bg-brand-blue text-white w-6 h-6 rounded-full flex items-center justify-center text-xs">3</span> Planification Prévisionnelle</h4>

                                        {/* Section pour les devis sur mesure */}
                                        {serviceType === 'custom' && (
                                            <div className="bg-amber-50 p-4 rounded-lg border border-amber-100 mb-4 space-y-4 animate-in fade-in">
                                                <div className="flex items-center gap-2 text-amber-800 font-bold text-sm">
                                                    <Clock className="w-4 h-4" /> Planification des prestations sur mesure
                                                </div>
                                                <p className="text-xs text-amber-600">Veuillez définir les créneaux horaires pour vos prestations personnalisées.</p>

                                                {/* Affichage des créneaux existants */}
                                                <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                                                    {interventionSlots.length === 0 ? (
                                                        <div className="p-4 text-center text-slate-400 text-sm">
                                                            <p>Aucun créneau planifié</p>
                                                            <button
                                                                onClick={addNewSlot}
                                                                className="mt-2 bg-amber-600 text-white px-3 py-1 rounded text-xs font-bold hover:bg-amber-700"
                                                            >
                                                                Ajouter un créneau
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <div className="divide-y divide-slate-100">
                                                            {interventionSlots.map((slot, index) => {
                                                                const avail = slotAvailability.get(slot.id) || [];
                                                                const availCount = avail.length;
                                                                return (
                                                                <div key={slot.id} className="p-4 space-y-3">
                                                                    <div className="flex justify-between items-center">
                                                                        <span className="text-sm font-bold text-slate-700">Créneau {index + 1}</span>
                                                                        <button
                                                                            onClick={() => removeSlot(index)}
                                                                            className="text-red-500 hover:text-red-700 text-xs"
                                                                        >
                                                                            <Trash2 className="w-3 h-3" />
                                                                        </button>
                                                                    </div>
                                                                    <div className="grid grid-cols-3 gap-2">
                                                                        <input
                                                                            type="date"
                                                                            className="p-2 border border-slate-200 rounded text-sm"
                                                                            min={getTodayMartiniqueStr()}
                                                                            value={slot.date}
                                                                            onChange={(e) => updateSlot(index, 'date', e.target.value, { validate: false })}
                                                                            onBlur={(e) => updateSlot(index, 'date', e.target.value, { validate: true })}
                                                                        />
                                                                        <input
                                                                            type="time"
                                                                            className="p-2 border border-slate-200 rounded text-sm"
                                                                            min={getMinStartTimeForSlot(slot.date)}
                                                                            value={slot.startTime}
                                                                            onChange={(e) => updateSlot(index, 'startTime', e.target.value, { validate: false })}
                                                                            onBlur={(e) => updateSlot(index, 'startTime', e.target.value, { validate: true })}
                                                                        />
                                                                        <input
                                                                            type="time"
                                                                            className="p-2 border border-slate-200 rounded text-sm"
                                                                            min={getMinStartTimeForSlot(slot.date)}
                                                                            value={slot.endTime}
                                                                            onChange={(e) => updateSlot(index, 'endTime', e.target.value, { validate: false })}
                                                                            onBlur={(e) => updateSlot(index, 'endTime', e.target.value, { validate: true })}
                                                                        />
                                                                    </div>
                                                                    <div className="text-xs text-slate-500">
                                                                        Durée : {slot.duration.toFixed(1)}h
                                                                    </div>

                                                                    <div className="flex items-center justify-between">
                                                                        <div className="text-xs font-bold text-slate-500">
                                                                            Prestataires disponibles :
                                                                        </div>
                                                                        {availCount === 0 && (
                                                                            <span title="Aucun prestataire disponible">
                                                                                <AlertTriangle className="w-4 h-4 text-red-500" />
                                                                            </span>
                                                                        )}
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => openProvidersModal(slot)}
                                                                            className={`text-xs font-extrabold px-3 py-1 rounded-full border ${availCount === 0
                                                                                ? 'bg-red-50 text-red-700 border-red-200'
                                                                                : 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
                                                                            }`}
                                                                        >
                                                                            {availCount}
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={addNewSlot}
                                                        className="flex-1 bg-amber-600 text-white py-2 rounded font-bold text-xs hover:bg-amber-700"
                                                    >
                                                        Ajouter un créneau
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        {/* Specific Use Case Controls based on Pack Name */}

                                        {serviceType === 'pack' && selectedPackId && (
                                            <div className="bg-green-50 p-4 rounded-lg border border-green-100 mb-4 space-y-3 animate-in fade-in">
                                                <div className="flex items-center gap-2 text-green-800 font-bold text-sm">
                                                    <Calendar className="w-4 h-4" /> Génération automatique
                                                </div>
                                                <p className="text-xs text-green-700">
                                                    Génère les jours et dates d'intervention selon le nombre d'heures/jours requis par le pack et la disponibilité des prestataires.
                                                </p>
                                                <button
                                                    onClick={generateInterventionSlotsWithAvailability}
                                                    className="w-full bg-green-600 text-white py-2 rounded font-bold text-xs hover:bg-green-700"
                                                >
                                                    Générer les jours et dates d'intervention
                                                </button>
                                            </div>
                                        )}

                                        {/* CAS 1: PACK TRANQUILITY (12h) */}
                                        {packNameIncludes('Tranquility') && (
                                            <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 mb-4 space-y-4 animate-in fade-in">
                                                <div className="flex justify-between items-center">
                                                    <label className="text-sm font-bold text-slate-700">Fréquence :</label>
                                                    <select
                                                        className="p-2 border rounded-lg bg-white text-sm font-bold"
                                                        value={packSpecificConfig.frequencyChoice || "4j_3h"}
                                                        onChange={(e) => {
                                                            setPackSpecificConfig({ ...packSpecificConfig, frequencyChoice: e.target.value });
                                                            markDraftDirty();
                                                        }}
                                                    >
                                                        <option value="4j_3h">4 jours x 3 heures</option>
                                                        <option value="3j_4h">3 jours x 4 heures</option>
                                                    </select>
                                                </div>
                                                <p className="text-xs text-blue-600">Le pack Tranquility compte 12 heures ajustables.</p>
                                                <button onClick={generateInterventionSlotsWithAvailability} className="w-full bg-blue-600 text-white py-2 rounded font-bold text-xs hover:bg-blue-700">
                                                    Générer les créneaux
                                                </button>
                                            </div>
                                        )}

                                        {/* CAS 2: PACK ULTIME 6 (6h) */}
                                        {isPackUltime6Name(packs.find(p => p.id === selectedPackId)?.name) && (
                                            <div className="bg-purple-50 p-4 rounded-lg border border-purple-100 mb-4 space-y-4 animate-in fade-in">
                                                <div className="flex items-center gap-2 text-purple-800 font-bold text-sm">
                                                    <Zap className="w-4 h-4" /> Pack Ultime 6 (Journée unique)
                                                </div>
                                                <p className="text-xs text-purple-600">Le pack Ultime 6 compte 6 heures en 1 journée (9h-15h).</p>
                                                <div className="flex items-center gap-2 bg-white p-2 rounded border border-purple-200 text-xs">
                                                    <AlertTriangle className="w-3 h-3 text-orange-500" /> Ces créneaux sont libres : aucun client n'a réservé à ces heures.
                                                </div>
                                            </div>
                                        )}

                                        {/* CAS 3: PACK PERSONNALISÉ */}
                                        {packNameIncludes('personnalisé') && (
                                            <div className="bg-slate-100 p-4 rounded-lg border border-slate-200 mb-4 space-y-4 animate-in fade-in">
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div>
                                                        <label className="block text-xs font-bold text-slate-500 mb-1">Nbre de jours</label>
                                                        <input
                                                            type="number"
                                                            className="w-full p-2 border rounded bg-white font-bold"
                                                            min="1"
                                                            value={packSpecificConfig.customDays || 1}
                                                            onChange={(e) => {
                                                                setPackSpecificConfig({ ...packSpecificConfig, customDays: parseInt(e.target.value) });
                                                                markDraftDirty();
                                                            }}
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-bold text-slate-500 mb-1">Nbre d'heures (Total)</label>
                                                        <input
                                                            type="number"
                                                            className="w-full p-2 border rounded bg-white font-bold"
                                                            min="1"
                                                            value={packSpecificConfig.customTotalHours || 2}
                                                            onChange={(e) => {
                                                                setPackSpecificConfig({ ...packSpecificConfig, customTotalHours: parseInt(e.target.value) });
                                                                markDraftDirty();
                                                            }}
                                                        />
                                                    </div>
                                                </div>
                                                <button onClick={generateInterventionSlotsWithAvailability} className="w-full bg-slate-700 text-white py-2 rounded font-bold text-xs hover:bg-slate-800">
                                                    Calculer et Générer
                                                </button>
                                            </div>
                                        )}

                                        {/* SLOTS DISPLAY - seulement pour les packs (pas pour les devis sur mesure) */}
                                        {serviceType === 'pack' && (
                                            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                                                <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 flex justify-between items-center">
                                                    <span className="text-xs font-bold text-slate-500 uppercase">Dates d'intervention</span>
                                                    <button onClick={addNewSlot} className="text-brand-blue hover:bg-blue-50 p-1 rounded"><PlusCircle className="w-4 h-4" /></button>
                                                </div>

                                                {interventionSlots.length === 0 ? (<div className="p-6 text-center text-slate-400 text-sm">Aucun créneau défini. Cliquez sur générer ou ajoutez manuellement.</div>) : (
                                                    interventionSlots.map((slot, index) => {
                                                        const avail = slotAvailability.get(slot.id) || [];
                                                        const availCount = avail.length;
                                                        return (
                                                        <div key={slot.id} className="p-3 border-b border-slate-100 last:border-0 flex items-center gap-3 hover:bg-slate-50">
                                                            <span className="text-xs font-bold text-slate-400 w-4">{index + 1}</span>
                                                            {availCount === 0 && (
                                                                <span title="Aucun prestataire disponible">
                                                                    <AlertTriangle className="w-4 h-4 text-red-500" />
                                                                </span>
                                                            )}
                                                            <input type="date" className="flex-1 p-2 border rounded bg-white text-sm" min={getTodayMartiniqueStr()} value={slot.date} onChange={(e) => updateSlot(index, 'date', e.target.value, { validate: false })} onBlur={(e) => updateSlot(index, 'date', e.target.value, { validate: true })} />
                                                            <div className="flex items-center gap-1">
                                                                <input type="time" className="p-2 border rounded bg-white text-sm w-20 text-center" min={getMinStartTimeForSlot(slot.date)} value={slot.startTime} onChange={(e) => updateSlot(index, 'startTime', e.target.value, { validate: false })} onBlur={(e) => updateSlot(index, 'startTime', e.target.value, { validate: true })} />
                                                                <span className="text-slate-400 text-xs">à</span>
                                                                <input type="time" className="p-2 border rounded bg-white text-sm w-20 text-center" min={getMinStartTimeForSlot(slot.date)} value={slot.endTime} onChange={(e) => updateSlot(index, 'endTime', e.target.value, { validate: false })} onBlur={(e) => updateSlot(index, 'endTime', e.target.value, { validate: true })} />
                                                            </div>
                                                            <span className="text-xs font-bold bg-green-100 text-green-700 px-2 py-1 rounded w-12 text-center">{slot.duration}h</span>
                                                            <button
                                                                type="button"
                                                                onClick={() => openProvidersModal(slot)}
                                                                className={`text-[11px] font-extrabold px-2 py-1 rounded-full border ${availCount === 0
                                                                    ? 'bg-red-50 text-red-700 border-red-200'
                                                                    : 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
                                                                }`}
                                                                title="Voir les prestataires disponibles"
                                                            >
                                                                {availCount}
                                                            </button>
                                                            <button onClick={() => removeSlot(index)} className="text-red-400 hover:text-red-600"><X className="w-4 h-4" /></button>
                                                        </div>
                                                        );
                                                    })
                                                )}

                                                {/* Total calculation */}
                                                {interventionSlots.length > 0 && (
                                                    <div className="p-3 bg-slate-50 text-right text-xs font-bold text-slate-600 border-t border-slate-100">
                                                        Total : <span className="text-brand-blue text-sm">{interventionSlots.reduce((acc, s) => acc + s.duration, 0)} heures</span>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        <p className="text-[10px] text-slate-400 mt-2 italic">
                                            Les créneaux sont reportés sur le contrat avec les informations clients.
                                            La signature du devis entraîne la signature du contrat après lecture par le client.
                                        </p>
                                    </section>
                                )}
                                <div className="flex justify-end">
                                    {modalMode === 'devis' && (() => {
                                        const existingDoc = editingDocumentId ? (documents || []).find((d: any) => String(d?.id || '') === String(editingDocumentId || '')) : null;
                                        const prevStatus = String((existingDoc as any)?.status || '');
                                        if (prevStatus === 'validated') {
                                            return (
                                                <button
                                                    className="px-6 py-2 rounded-lg bg-brand-blue text-white font-bold hover:bg-teal-700 flex items-center gap-2 disabled:opacity-50"
                                                    onClick={() => handleSuccess('send')}
                                                    disabled={!selectedClientId || isSubmitting}
                                                >
                                                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                                    {isSubmitting ? 'Traitement...' : 'Envoyer'}
                                                </button>
                                            );
                                        }
                                        return (
                                            <div className="flex gap-3">
                                                <button
                                                    className="px-6 py-2 rounded-lg bg-slate-100 text-slate-700 font-bold hover:bg-slate-200 flex items-center gap-2 disabled:opacity-50"
                                                    onClick={() => handleSuccess('validate_only')}
                                                    disabled={!selectedClientId || isSubmitting}
                                                >
                                                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                                                    {isSubmitting ? 'Traitement...' : 'Valider'}
                                                </button>
                                                <button
                                                    className="px-6 py-2 rounded-lg bg-brand-blue text-white font-bold hover:bg-teal-700 flex items-center gap-2 disabled:opacity-50"
                                                    onClick={() => handleSuccess('send')}
                                                    disabled={!selectedClientId || isSubmitting}
                                                >
                                                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                                                    {isSubmitting ? 'Traitement...' : 'Valider et Envoyer'}
                                                </button>
                                            </div>
                                        );
                                    })()}

                                    {modalMode !== 'devis' && (
                                        <button
                                            className="px-6 py-2 rounded-lg bg-brand-blue text-white font-bold hover:bg-teal-700 flex items-center gap-2 disabled:opacity-50"
                                            onClick={() => handleSuccess('send')}
                                            disabled={!selectedClientId || isSubmitting}
                                        >
                                            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                                            {isSubmitting ? 'Traitement...' : 'Valider et Envoyer'}
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div className="lg:col-span-5 bg-slate-50 p-6 rounded-xl h-fit border border-slate-200">
                                <div className="flex justify-between items-start mb-6">
                                    <h4 className="font-serif font-bold text-xl text-slate-800">Récapitulatif</h4>
                                    {modalMode === 'devis' && (
                                        <div className="text-right text-xs">
                                            <p className="text-slate-500">Durée de validité du devis</p>
                                            <p className="font-bold text-red-600">48 heures</p>
                                        </div>
                                    )}
                                </div>

                                {/* 24h Warning */}
                                {modalMode === 'devis' && (
                                    <div className="bg-orange-50 p-3 rounded-lg border border-orange-200 mb-4 text-xs text-orange-800 flex items-start gap-2">
                                        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                                        <p>
                                            <strong>Attention :</strong> Si ce devis n’est pas validé par le client sous 48h, les dates prévisionnelles indiquées ci-contre ne seront pas bloquées.
                                        </p>
                                    </div>
                                )}

                                <div className="bg-white p-4 rounded-lg border border-slate-200 mb-4 shadow-sm text-sm">
                                    <table className="w-full text-sm">
                                        <thead className="border-b border-slate-200">
                                            <tr>
                                                <th className="text-left py-2 font-bold uppercase">Description</th>
                                                <th className="text-center py-2 font-bold uppercase">Prix U.</th>
                                                <th className="text-right py-2 font-bold uppercase">Total HT</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {serviceType === 'custom' ? (
                                                // Afficher les lignes personnalisées
                                                customLines.map((line, index) => (
                                                    <tr key={line.id}>
                                                        <td className="py-3 text-slate-700 font-medium">{line.description || `Ligne ${index + 1}`}</td>
                                                        <td className="py-3 text-center text-slate-500">{line.unitPrice.toFixed(2)}€</td>
                                                        <td className="py-3 text-right text-slate-800 font-bold">{(line.unitPrice * line.quantity).toFixed(2)} €</td>
                                                    </tr>
                                                ))
                                            ) : (
                                                // Afficher le pack
                                                <tr>
                                                    <td className="py-3 text-slate-700 font-medium">{customDescription || "Pack..."}</td>
                                                    <td className="py-3 text-center text-slate-500">{unitPrice.toFixed(2)}€</td>
                                                    <td className="py-3 text-right text-slate-800 font-bold">{totalHT.toFixed(2)} €</td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>

                                    <div className="space-y-2 pt-2 border-t border-slate-100 text-slate-600">
                                        <div className="flex justify-between"><span>Total HT : </span><span>{serviceType === 'custom' ? calculateCustomTotal().toFixed(2) : totalHT.toFixed(2)} €</span></div>
                                        <div className="flex justify-between items-center">
                                            <span>TVA : </span>
                                            <select
                                                className="bg-slate-50 border rounded p-1 text-xs font-bold text-slate-700 outline-none focus:border-brand-blue"
                                                value={tvaRate}
                                                onChange={(e) => {
                                                    setTvaRate(Number(e.target.value) as any);
                                                    markDraftDirty();
                                                }}
                                            >
                                                <option value={0}>0%</option>
                                                <option value={2.1}>2.1% (Particulier)</option>
                                                <option value={8.5}>8.5% (Professionnel)</option>
                                            </select>
                                        </div>
                                        <div className="flex justify-between text-slate-500 text-xs"><span>Montant TVA : </span><span>{((serviceType === 'custom' ? calculateCustomTotal() : totalHT) * (tvaRate / 100)).toFixed(2)} €</span></div>
                                    </div>
                                    <div className="flex justify-between font-bold text-lg text-slate-800 pt-4 border-t border-slate-100 mt-2"><span>Total HT : </span><span>{((serviceType === 'custom' ? calculateCustomTotal() : totalHT) * (1 + tvaRate / 100)).toFixed(2)} €</span></div>
                                </div>

                                {/* TAX CREDIT SECTION */}
                                <div className="bg-white p-4 rounded-lg border border-slate-200 mb-6">
                                    <div className="flex items-center justify-between mb-3">
                                        <span className="text-sm font-bold text-slate-700">Avance immédiate (Crédit d'impôt)</span>
                                        <div
                                            onClick={() => {
                                                setTaxCreditActive(!taxCreditActive);
                                                markDraftDirty();
                                            }}
                                            className={`w-10 h-6 rounded-full p-1 cursor-pointer transition-colors ${taxCreditActive ? 'bg-green-500' : 'bg-slate-300'}`}
                                        >
                                            <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${taxCreditActive ? 'translate-x-4' : ''}`}></div>
                                        </div>
                                    </div>

                                    <div className={`text-xs p-2 rounded mb-2 font-bold border ${taxCreditActive ? 'bg-green-50 text-green-800 border-green-100' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                                        Statut : {taxCreditActive ? "ACTIVÉ (-50%)" : "NON ACTIVÉ"}
                                    </div>

                                    {taxCreditActive ? (
                                        <div className="text-xs text-slate-600 space-y-3 animate-in fade-in">
                                            <p className="italic border-l-2 border-green-300 pl-2 bg-green-50/50 p-1">
                                                "Conformément à l'article 199 sexdecies du CGI, les prestations ouvrent droit à un crédit d'impôt de 50 %."
                                            </p>
                                            <div className="pt-2 border-t border-dashed border-slate-200 space-y-1">
                                                <div className="flex justify-between font-bold text-brand-blue text-sm pt-1">
                                                    <span>Reste à charge client : </span>
                                                    <span>{clientToPay.toFixed(2)} €</span>
                                                </div>
                                                <div className="flex justify-between text-green-600 text-xs">
                                                    <span>Montant URSSAF (Avance immédiate) : </span>
                                                    <span className="font-bold">{taxCreditAmount.toFixed(2)} €</span>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="text-xs text-slate-400 italic">
                                            Le client paiera la totalité du montant TTC.
                                        </div>
                                    )}
                                </div>

                                {modalMode === 'devis' && (<div className="space-y-2"><div className="p-3 bg-slate-100 rounded-lg border border-slate-200 text-slate-600 text-xs flex items-center gap-2"><Paperclip className="w-4 h-4 text-slate-400" /><span>Le contrat de prestation sera automatiquement joint à l'email.</span></div></div>)}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Document Detail Modal */}
            {isDetailModalOpen && selectedDocument && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-cream-50 rounded-t-2xl sticky top-0 z-10">
                            <div>
                                <h3 className="text-2xl font-serif font-bold text-slate-800">Détails du {selectedDocument.type}</h3>
                                <p className="text-xs text-slate-500 mt-1">Référence : {selectedDocument.ref}</p>
                            </div>
                            <button onClick={() => setIsDetailModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full transition">
                                <X className="w-6 h-6 text-slate-500" />
                            </button>
                        </div>

                        <div className="p-6 space-y-6">
                            {/* Client Information */}
                            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                                <h4 className="font-bold text-slate-800 mb-3">Informations Client</h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                                    <div><span className="text-slate-500">Nom complet : </span><span className="font-medium">{detailClient?.name || selectedDocument.clientName || '—'}</span></div>
                                    <div><span className="text-slate-500">Prénom : </span><span className="font-medium">{(() => {
                                        const n = (detailClient?.name || selectedDocument.clientName || '').trim();
                                        if (!n) return '—';
                                        const parts = n.split(' ').filter(Boolean);
                                        if (parts.length <= 1) return n;
                                        parts.pop();
                                        return parts.join(' ') || '—';
                                    })()}</span></div>
                                    <div><span className="text-slate-500">Nom : </span><span className="font-medium">{(() => {
                                        const n = (detailClient?.name || selectedDocument.clientName || '').trim();
                                        if (!n) return '—';
                                        const parts = n.split(' ').filter(Boolean);
                                        if (parts.length <= 1) return n;
                                        return parts[parts.length - 1] || '—';
                                    })()}</span></div>
                                    <div><span className="text-slate-500">ID client : </span><span className="font-medium">{detailClient?.id || selectedDocument.clientId || '—'}</span></div>

                                    <div><span className="text-slate-500">Téléphone : </span><span className="font-medium">{detailClient?.phone || '—'}</span></div>
                                    <div><span className="text-slate-500">Email : </span><span className="font-medium">{detailClient?.email || '—'}</span></div>

                                    <div className="sm:col-span-2"><span className="text-slate-500">Adresse : </span><span className="font-medium">{detailClient?.address || '—'}</span></div>
                                    <div><span className="text-slate-500">Ville : </span><span className="font-medium">{detailClient?.city || '—'}</span></div>
                                    <div><span className="text-slate-500">Pack : </span><span className="font-medium">{detailClient?.pack || '—'}</span></div>

                                    <div><span className="text-slate-500">Statut client : </span><span className="font-medium">{detailClient?.status || '—'}</span></div>
                                    <div><span className="text-slate-500">Client depuis : </span><span className="font-medium">{detailClient?.since || '—'}</span></div>

                                    <div><span className="text-slate-500">Packs consommés : </span><span className="font-medium">{typeof detailClient?.packsConsumed === 'number' ? detailClient.packsConsumed : '—'}</span></div>
                                    <div><span className="text-slate-500">Heures fidélité : </span><span className="font-medium">{typeof detailClient?.loyaltyHoursAvailable === 'number' ? detailClient.loyaltyHoursAvailable : '—'}</span></div>

                                    <div><span className="text-slate-500">Avis laissé : </span><span className="font-medium">{detailClient?.hasLeftReview === true ? 'Oui' : detailClient?.hasLeftReview === false ? 'Non' : '—'}</span></div>
                                    <div><span className="text-slate-500">Mot de passe initial : </span><span className="font-medium">{detailClient?.initialPassword ? String(detailClient.initialPassword) : '—'}</span></div>
                                </div>
                            </div>

                            <div className="bg-white p-4 rounded-lg border border-slate-200">
                                <h4 className="font-bold text-slate-800 mb-3">Informations {selectedDocument.type}</h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                                    <div><span className="text-slate-500">Référence : </span><span className="font-medium">{selectedDocument.ref}</span></div>
                                    <div><span className="text-slate-500">Date : </span><span className="font-medium">{selectedDocument.date}</span></div>
                                    <div><span className="text-slate-500">Statut : </span><span className={`font-medium ${selectedDocument.status === 'signed' ? 'text-green-600' : selectedDocument.status === 'sent' ? 'text-orange-600' : 'text-red-600'}`}>{selectedDocument.status}</span></div>
                                    <div><span className="text-slate-500">Type : </span><span className="font-medium">{selectedDocument.type}</span></div>
                                </div>

                                {selectedDocument.type === 'Devis' && selectedDocument.status === 'sent' && (currentUser?.role === 'admin' || currentUser?.role === 'super_admin') && (
                                    <div className="mt-4 flex justify-end">
                                        <button
                                            onClick={() => openAdminSignModal(selectedDocument.id)}
                                            className="px-4 py-2 rounded-lg bg-brand-blue text-white font-bold hover:bg-teal-700 flex items-center gap-2"
                                        >
                                            <PenTool className="w-4 h-4" />
                                            Signer (admin)
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Service Details */}
                            <div className="bg-white p-4 rounded-lg border border-slate-200">
                                <h4 className="font-bold text-slate-800 mb-3">Détails de la Prestation</h4>
                                <div className="space-y-2 text-sm">
                                    {(() => {
                                        const raw = String(selectedDocument.description || '');
                                        const parts = raw.split('|');
                                        const descriptionPart = (parts[0] || '').trim();

                                        let locationPart = '';
                                        if (parts.length > 1) {
                                            locationPart = parts.slice(1).join('|').replace(/\bLieu\s*:/i, '').trim();
                                        } else {
                                            const match = raw.match(/\bLieu\s*:\s*(.*)$/i);
                                            if (match && match[1]) locationPart = match[1].trim();
                                        }

                                        return (
                                            <div>
                                                <div>
                                                    <span className="text-slate-500">Description : </span>
                                                    <span className="font-medium">{descriptionPart || raw}</span>
                                                </div>
                                                {locationPart ? (
                                                    <div className="mt-1">
                                                        <span className="text-slate-500 font-bold">Lieu : </span>
                                                        <br />
                                                        <span className="font-medium">{locationPart}</span>
                                                    </div>
                                                ) : null}
                                            </div>
                                        );
                                    })()}
                                    <div><span className="text-slate-500">Prix unitaire HT : </span><span className="font-medium">{selectedDocument.unitPrice ? selectedDocument.unitPrice.toFixed(2) : '0.00'} €</span></div>
                                    <div><span className="text-slate-500">Taux TVA : </span><span className="font-medium">{selectedDocument.tvaRate || 0}%</span></div>
                                </div>
                            </div>

                            {/* Financial Summary */}
                            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                                <h4 className="font-bold text-slate-800 mb-3">Récapitulatif Financier</h4>
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between"><span>Total HT : </span><span className="font-medium">{selectedDocument.totalHT ? selectedDocument.totalHT.toFixed(2) : '0.00'} €</span></div>
                                    <div className="flex justify-between"><span>Montant TVA : </span><span className="font-medium">{selectedDocument.totalTTC && selectedDocument.totalHT ? (selectedDocument.totalTTC - selectedDocument.totalHT).toFixed(2) : '0.00'} €</span></div>
                                    <div className="flex justify-between font-bold text-lg pt-2 border-t border-slate-200"><span>Total TTC : </span><span className="font-medium">{selectedDocument.totalTTC ? selectedDocument.totalTTC.toFixed(2) : '0.00'} €</span></div>
                                    
                                    {/* Crédit d'impôt */}
                                    {selectedDocument.taxCreditEnabled && (
                                        <div className="mt-3 pt-3 border-t border-green-200 space-y-2">
                                            <div className="flex items-center gap-2 mb-2">
                                                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                                                <span className="text-sm font-bold text-green-700">Crédit d'impôt ACTIVÉ</span>
                                            </div>
                                            <div className="bg-green-50 p-3 rounded-lg border border-green-200">
                                                <p className="text-xs text-green-700 italic mb-2">"Conformément à l'article 199 sexdecies du CGI, les prestations ouvrent droit à un crédit d'impôt de 50 %."</p>
                                                <div className="space-y-1">
                                                    <div className="flex justify-between text-green-700">
                                                        <span className="text-sm">Montant crédit d'impôt (50%) : </span>
                                                        <span className="font-bold">{(selectedDocument.totalTTC * 0.5).toFixed(2)} €</span>
                                                    </div>
                                                    <div className="flex justify-between font-bold text-green-800 text-base pt-2 border-t border-green-300">
                                                        <span>Reste à charge client : </span>
                                                        <span>{(selectedDocument.totalTTC * 0.5).toFixed(2)} €</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    
                                    {!selectedDocument.taxCreditEnabled && (
                                        <div className="mt-3 pt-3 border-t border-slate-200">
                                            <div className="flex items-center gap-2">
                                                <div className="w-3 h-3 bg-slate-400 rounded-full"></div>
                                                <span className="text-sm font-medium text-slate-500">Crédit d'impôt NON ACTIVÉ</span>
                                            </div>
                                            <p className="text-xs text-slate-400 mt-1">Le client paiera la totalité du montant TTC.</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Intervention Slots (if available) */}
                            {selectedDocument.slotsData && selectedDocument.slotsData.length > 0 && (
                                <div className="bg-white p-4 rounded-lg border border-slate-200">
                                    <h4 className="font-bold text-slate-800 mb-3">Créneaux d'Intervention Prévus</h4>
                                    <div className="space-y-2">
                                        {selectedDocument.slotsData.map((slot: any, index: number) => (
                                            <div key={index} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                                                <div className="flex items-center gap-3">
                                                    <span className="text-xs font-bold text-slate-400 w-4">{index + 1}</span>
                                                    <div>
                                                        <div className="font-medium text-slate-700">{slot.date}</div>
                                                        <div className="text-sm text-slate-500">{slot.startTime} - {slot.endTime} ({slot.duration}h)</div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Signature Information (if signed) */}
                            {selectedDocument.status === 'signed' && selectedDocument.signatureDate && (
                                <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                                    <h4 className="font-bold text-green-800 mb-3">Informations de Signature</h4>
                                    <div className="space-y-2 text-sm">
                                        <div><span className="text-green-600">Date de signature : </span><span className="font-medium">{new Date(selectedDocument.signatureDate).toLocaleDateString()}</span></div>
                                        <div><span className="text-green-600">Heure de signature : </span><span className="font-medium">{new Date(selectedDocument.signatureDate).toLocaleTimeString()}</span></div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {isAdminSignModalOpen && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
                        <div className="flex items-center justify-between p-4 border-b bg-cream-50">
                            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                <PenTool className="w-5 h-5" />
                                Signature Admin
                            </h3>
                            <button
                                onClick={closeAdminSignModal}
                                disabled={isAdminSigning}
                                className="p-2 hover:bg-slate-200 rounded-full transition disabled:opacity-50"
                            >
                                <X className="w-5 h-5 text-slate-500" />
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            <div className="text-sm text-slate-600">
                                Vous pouvez ajouter une image de signature (facultatif). Si vous ne mettez rien, le devis sera quand même marqué signé.
                            </div>

                            <input
                                ref={adminSignatureInputRef}
                                type="file"
                                accept="image/*"
                                onChange={(e) => handleAdminSignatureFile(e.target.files?.[0])}
                                className="hidden"
                            />

                            <div
                                onClick={() => adminSignatureInputRef.current?.click()}
                                onDragOver={(e) => {
                                    e.preventDefault();
                                    setIsAdminSignDragOver(true);
                                }}
                                onDragLeave={(e) => {
                                    e.preventDefault();
                                    setIsAdminSignDragOver(false);
                                }}
                                onDrop={(e) => {
                                    e.preventDefault();
                                    setIsAdminSignDragOver(false);
                                    const file = e.dataTransfer.files?.[0];
                                    handleAdminSignatureFile(file);
                                }}
                                className={`w-full rounded-xl border-2 border-dashed p-6 cursor-pointer transition ${isAdminSignDragOver ? 'border-brand-blue bg-blue-50' : 'border-slate-200 bg-slate-50 hover:bg-slate-100'}`}
                            >
                                {adminSignatureDataUrl ? (
                                    <div className="space-y-3">
                                        <div className="bg-white rounded-lg border border-slate-200 p-3">
                                            <img src={adminSignatureDataUrl} alt="Signature" className="w-full max-h-56 object-contain" />
                                        </div>
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="text-slate-500 font-bold truncate">{adminSignatureFileName || 'signature'}</span>
                                            <button
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    setAdminSignatureDataUrl('');
                                                    setAdminSignatureFileName('');
                                                }}
                                                className="text-red-600 hover:text-red-700 font-bold"
                                            >
                                                Retirer
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center text-center gap-2">
                                        <UploadCloud className="w-10 h-10 text-slate-400" />
                                        <div className="text-sm font-bold text-slate-700">Déposez une image ici ou cliquez pour choisir</div>
                                        <div className="text-xs text-slate-500">PNG, JPG, WEBP…</div>
                                    </div>
                                )}
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    onClick={closeAdminSignModal}
                                    disabled={isAdminSigning}
                                    className="flex-1 py-2 text-slate-600 font-bold bg-slate-100 hover:bg-slate-200 rounded-lg transition disabled:opacity-50"
                                >
                                    Annuler
                                </button>
                                <button
                                    onClick={confirmAdminSign}
                                    disabled={isAdminSigning}
                                    className="flex-1 py-2 text-white font-bold bg-brand-blue hover:bg-teal-700 rounded-lg transition shadow-md disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {isAdminSigning ? <Loader2 className="w-4 h-4 animate-spin" /> : <PenTool className="w-4 h-4" />}
                                    Marquer signé
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {providersModalOpen && (
                <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden max-h-[80vh] flex flex-col">
                        <div className="p-4 border-b border-slate-100 bg-cream-50 flex items-center justify-between">
                            <div>
                                <div className="text-xs text-slate-500">Disponibilités</div>
                                <div className="text-sm font-extrabold text-slate-800">{providersModalTitle}</div>
                            </div>
                            <button
                                onClick={() => setProvidersModalOpen(false)}
                                className="p-2 hover:bg-slate-200 rounded-full transition"
                                aria-label="Fermer"
                            >
                                <X className="w-5 h-5 text-slate-500" />
                            </button>
                        </div>

                        <div className="p-4 overflow-y-auto">
                            {providersModalItems.length === 0 ? (
                                <div className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl p-3">
                                    Aucun prestataire disponible sur ce créneau.
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {providersModalItems.map((p: any) => (
                                        <div key={p.id} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-xl">
                                            <div className="min-w-0">
                                                <div className="font-bold text-slate-800 text-sm truncate">{p.firstName} {p.lastName}</div>
                                                <div className="text-xs text-slate-500 truncate">{p.specialty || ''}</div>
                                            </div>
                                            <div className="text-xs font-bold text-green-700 bg-green-50 border border-green-100 px-2 py-1 rounded-full">Dispo</div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {isDeleteModalOpen && (documentToDelete || isBulkDelete) && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm animate-in fade-in zoom-in duration-200">
                        <div className="flex flex-col items-center text-center">
                            <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-4">
                                <AlertTriangle className="w-6 h-6" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-800 mb-2">Confirmer la suppression</h3>
                            <p className="text-sm text-slate-500 mb-6">
                                Êtes-vous sûr de vouloir supprimer {isBulkDelete ? `${selectedIds.size} document(s)` : `le document ${documentToDelete?.ref}`} ? Cette action est irréversible.
                            </p>
                            <div className="flex gap-3 w-full">
                                <button
                                    onClick={() => setIsDeleteModalOpen(false)}
                                    disabled={isDeleting}
                                    className="flex-1 py-2 text-slate-600 font-bold bg-slate-100 hover:bg-slate-200 rounded-lg transition disabled:opacity-50"
                                >
                                    Annuler
                                </button>
                                <button
                                    onClick={executeDelete}
                                    disabled={isDeleting}
                                    className="flex-1 py-2 text-white font-bold bg-red-600 hover:bg-red-700 rounded-lg transition shadow-md disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                                    Supprimer
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DevisFactures;
