/*
 * ============================================================
 *  Planning.tsx — Vue planning principal
 *  État final après Prompts 01–06
 * ============================================================
 *
 *  FONCTIONNALITÉS EXISTANTES (avant modifications) :
 *  - Vue calendrier hebdomadaire (desktop 6 col, mobile liste)
 *  - Création / édition / suppression de missions + bulk delete
 *  - Filtres : prestataire, client, statut, plage de dates, recherche
 *  - Missions provisoires (devis « sent » non expirés)
 *  - Rappels journaliers, missions non assignées + assignation
 *  - Statistiques (modal), récurrence, PullToRefresh, haptic
 *
 *  NOUVELLES FONCTIONNALITÉS (prompts 01–06) :
 *  01 — Créneaux horaires fixes (ALLOWED_SLOTS : 3h, 4h, 6h, 7h)
 *       Validation durée + plafond 7h/jour + détection chevauchements
 *  02 — Vue synthétique journalière (modal, statsDate = focusedDate)
 *       Prestataires planifiées / disponibles, compteurs période
 *  03 — Code couleur journaux (≥ 60 % jaune, ≥ 90 % orange, clos teal)
 *       Bouton « Clore » par colonne, légende masquable
 *  04 — Indicateurs de facturation (billingSignals useMemo) :
 *       Badge bleu ≥ 2 réalisées sur même devis (readyToInvoice)
 *       Badge violet ≥ 6 réalisées pack ultime + toast (ultimatePackDocs)
 *  05 — Messagerie WhatsApp :
 *       Bouton par prestataire → modal prévisualisation’dition → wa.me
 *       Bouton « Toutes » → modal envoi groupé avec suivi par prestataire
 *  06 — Responsive & accessibilité WCAG AA :
 *       role="dialog" aria-modal aria-labelledby sur tous les modaux
 *       role="progressbar" aria-value* sur barres de progression
 *       aria-label sur tous les boutons, min 32–44 px tactile
 *
 *  RÈGLES MÉTIER :
 *  - Durées valides : ALLOWED_DURATIONS = [3, 4, 6, 7] h
 *  - Plafond : MAX_PROVIDER_DAILY_HOURS = 7 h / prestataire / jour
 *  - Chevauchement d’horaires → rejet + message d’erreur
 *  - Statut « clos » = indicateur visuel seulement (non bloquant)
 *
 *  DÉPENDANCES INTERNES :
 *  statsDate (focusedDate) → dailySummaryData → synthèse + WhatsApp
 *  colDates → dayFillStatus → couleurs colonnes calendrier
 *  billingSignals → badges missions desktop + mobile + section synthèse
 *  getProviderDailyHours → validation 7h dans handleSubmit
 * ============================================================
 */
import React, { useState, useMemo, useRef, useEffect } from 'react';
import PageLoader from './PageLoader';
import dayjs from 'dayjs';
import { ChevronLeft, ChevronRight, Plus, X, CheckCircle, User, AlertCircle, Search, Mail, Repeat, Trash2, CheckSquare, Square, AlertTriangle, Loader2, Calendar, Bell, BellOff, Flag, Briefcase, FileText, FileSpreadsheet, RotateCcw, SlidersHorizontal, Copy as CopyIcon, Users, Clock, MessageCircle, Download, Printer, Package, CreditCard, ExternalLink, ArrowRight } from 'lucide-react';
import { useData } from '../context/DataContext';
import { Mission, Provider } from '../types';
import { useNavigate } from 'react-router-dom';
import { getMartiniqueToday } from '../src/utils/martiniqueTime';
import { getMartiniqueNow as getMartiniqueNowDayjs, MARTINIQUE_TIMEZONE } from '../src/utils/dayjsMartinique';
import SearchableSelect from './SearchableSelect';
import { matchesServiceTypeFilterFromText } from '../utils/serviceTypes';
import { getHolidayName } from '../utils/holidays';
import { getEffectiveStatus, getStatusBadgeClasses, getStatusLabel } from '../utils/statusHelpers';

// Mobile features integration
import { useHaptic } from '../hooks/useHaptic';
import { toast } from '../components/mobile/Toast';
import { PullToRefresh } from '../components/mobile/PullToRefresh';

// Prestataire fictif pour EDWARD Sylvie (prestations externalisées)
const EXTERNAL_PROVIDER_ID = '__external__';
const EXTERNAL_PROVIDER: Provider = {
    id: EXTERNAL_PROVIDER_ID,
    firstName: 'EDWARD',
    lastName: 'Sylvie',
    status: 'Active',
    specialty: 'Externe',
    leaves: [],
    hoursWorked: 0,
    rating: 0,
    phone: '',
    email: '',
};

function generateUUID() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

const Planning: React.FC = () => {
    const { missions, providers, clients, packs, documents, addMission, assignProvider, assignSecondProvider, updateMission, deleteMissions, refreshData, reminders, addReminder, toggleReminder, serviceTypeFilter, requestMissionReschedule, loadMissionsForRange, clearAllMissionsCache, getMissionDetails, dataLoading, convertQuoteToInvoice, markInvoicePaid, updateDocumentStatus, companySettings } = useData();
    const navigate = useNavigate();
    const { buttonPress, success, error: hapticError } = useHaptic();

    const submitLockRef = useRef(false);

    // Filter State
    const [selectedProvider, setSelectedProvider] = useState<string>('all');
    const [selectedClient, setSelectedClient] = useState<string>('all');
    const [selectedStatus, setSelectedStatus] = useState<string>('all');
    const [currentWeekOffset, setCurrentWeekOffset] = useState(0);
    const [searchQuery, setSearchQuery] = useState('');
    const [customDateRange, setCustomDateRange] = useState(false);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [focusedDate, setFocusedDate] = useState(getMartiniqueToday());
    const [showMobileFilters, setShowMobileFilters] = useState(false);
    const [showMobileToolbar, setShowMobileToolbar] = useState(false);
    const [isMobileActionsOpen, setIsMobileActionsOpen] = useState(false);
    const [planningLoading, setPlanningLoading] = useState(false);
    const [planningProgress, setPlanningProgress] = useState(0);
    const [encouragementIndex, setEncouragementIndex] = useState(0);

    // Modal & Toast (using mobile toast now)
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isReminderModalOpen, setIsReminderModalOpen] = useState(false);
    const [isQuickPlanModalOpen, setIsQuickPlanModalOpen] = useState(false);
    const [isStatsModalOpen, setIsStatsModalOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // --- Helpers Devis / Prestations Planning ---
    // 1. Vérifie si un devis est au statut brouillon
    const isQuoteDraft = (doc: any): boolean => {
        if (!doc) return false;
        const s = String(doc.status || '').toLowerCase().trim();
        if (s === 'draft' || s === 'brouillon' || s === 'brouillons') return true;
        if (String(doc.id || '').startsWith('draft-') || String(doc.id || '').startsWith('local-draft-')) return true;
        return false;
    };

    // 2. Vérifie si le montant TTC d'un devis est égal à 0 (ou <= 0)
    const isQuoteZeroAmount = (doc: any): boolean => {
        if (!doc) return false;
        const ttc = doc.totalTTC !== undefined ? Number(doc.totalTTC) :
                    doc.total_ttc !== undefined ? Number(doc.total_ttc) :
                    doc.total !== undefined ? Number(doc.total) : 0;
        const safeTTC = isNaN(ttc) ? 0 : ttc;
        return safeTTC <= 0;
    };

    const isQuoteExpired = (doc: any): boolean => {
        if (!doc) return true;
        const s = String(doc.status || '').toLowerCase();
        // Signed, validated, paid or active quotes are NEVER expired
        if (s === 'signed' || s === 'validated' || s === 'accepted' || s === 'paid' || s === 'to_invoice') {
            return false;
        }
        if (s === 'expired' || s === 'rejected' || s === 'cancelled') {
            return true;
        }
        // Sent quotes are active and valid for planning
        return false;
    };

    // Helper pour vérifier si une prestation/mission doit être masquée du planning :
    // - Soit son devis source est en brouillon (Draft)
    // - Soit son devis source a un montant TTC égal à 0€
    const isMissionExcludedByQuote = (m: any, docs: any[]): boolean => {
        const docId = m?.sourceDocumentId || m?.source_document_id;
        if (!docId) return false;
        const doc = docs?.find(d => String(d.id) === String(docId));
        if (!doc) return false;
        // 1. Devis en brouillon
        if (isQuoteDraft(doc)) return true;
        // 2. Devis dont le montant TTC est égal à 0
        if (isQuoteZeroAmount(doc)) return true;
        return false;
    };

    // Prestations valides pour le planning (exclut les missions liées à un devis en brouillon ou à 0€ TTC)
    const validMissions = useMemo(() => {
        return (missions || []).filter(m => !isMissionExcludedByQuote(m, documents));
    }, [missions, documents]);

    // Selection State for Unassigned Missions
    const [selectedMissionId, setSelectedMissionId] = useState<string | null>(null);
    const [assignProviderId, setAssignProviderId] = useState<string>('');
    const [assignSecondProviderSelect, setAssignSecondProviderSelect] = useState<string>('');
    const [assignIsOvertime, setAssignIsOvertime] = useState(false);

    // BULK DELETE STATE
    const [selectedMissionIds, setSelectedMissionIds] = useState<Set<string>>(new Set());
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

    // Form State - Mission
    const initialFormState = {
        clientId: '',
        service: '',
        providerId: '',
        provider2Id: '',
        date: '',
        startTime: '09:00',
        endTime: '11:00',
        endDate: '', // Optionnel si différent
        recurrence: 'none',
        occurrences: 1,
        sourceDocumentId: '',
        isOvertime: false
    };
    const [missionForm, setMissionForm] = useState(initialFormState);

    // Form State - Reminder
    const [reminderForm, setReminderForm] = useState({
        text: '',
        date: getMartiniqueToday(),
        notifyEmail: true
    });

    const [quickPlanForm, setQuickPlanForm] = useState({
        clientId: '',
        date: getMartiniqueToday(),
        startTime: '09:00',
        endTime: '11:00'
    });

    // --- GRAFTED: Système de créneaux horaires ---
    // Analyse existante : missionForm.startTime & endTime alimentent addMission() via handleSubmit().
    // calculateDuration(), isProviderAvailable(), getProviderUnavailableReason() déjà présents.
    // Ces créneaux se greffent dans le modal isModalOpen (Nouvelle Mission) existant.
    const ALLOWED_SLOTS = [
        { key: '08:00-11:00', start: '08:00', end: '11:00', label: '8h–11h', duration: 3 },
        { key: '09:00-12:00', start: '09:00', end: '12:00', label: '9h–12h', duration: 3 },
        { key: '13:00-16:00', start: '13:00', end: '16:00', label: '13h–16h', duration: 3 },
        { key: '14:00-17:00', start: '14:00', end: '17:00', label: '14h–17h', duration: 3 },
        { key: '09:00-13:00', start: '09:00', end: '13:00', label: '9h–13h', duration: 4 },
        { key: '13:00-17:00', start: '13:00', end: '17:00', label: '13h–17h', duration: 4 },
        { key: '08:00-14:00', start: '08:00', end: '14:00', label: '8h–14h', duration: 6 },
        { key: '08:00-15:00', start: '08:00', end: '15:00', label: '8h–15h', duration: 7 },
        { key: '10:00-17:00', start: '10:00', end: '17:00', label: '10h–17h', duration: 7 },
    ] as const;
    const ALLOWED_DURATIONS = [3, 4, 6, 7];
    const MAX_PROVIDER_DAILY_HOURS = 7;
    const [selectedSlotKey, setSelectedSlotKey] = useState<string>('');

    // --- GRAFTED: Vue synthétique journalière ---
    const [showDailySummary, setShowDailySummary] = useState(false);
    const [billingSelectedDocs, setBillingSelectedDocs] = useState<Set<string>>(new Set());
    const [billingFilter, setBillingFilter] = useState('');
    const [billingValidating, setBillingValidating] = useState(false);

    // --- GRAFTED: Système de couleurs des journées ---
    const [closedDays, setClosedDays] = useState<Set<string>>(new Set());
    const [showColorLegend, setShowColorLegend] = useState(false);

    // --- GRAFTED: WhatsApp planning ---
    const [whatsappPreviewOpen, setWhatsappPreviewOpen] = useState(false);
    const [whatsappPreviewData, setWhatsappPreviewData] = useState<{ provider: Provider; phone: string; message: string } | null>(null);
    const [whatsappSendAllOpen, setWhatsappSendAllOpen] = useState(false);
    const [whatsappSentSet, setWhatsappSentSet] = useState<Set<string>>(new Set());

    // --- GRAFTED: Mini-dashboard semaine ---
    const [showWeekDashboard, setShowWeekDashboard] = useState(false);

    // --- GRAFTED: Fiche stats prestataire ---
    const [selectedProviderStats, setSelectedProviderStats] = useState<Provider | null>(null);

    // --- GRAFTED: Centre de notifications ---
    const [showNotifications, setShowNotifications] = useState(false);
    const [readNotificationIds, setReadNotificationIds] = useState<Set<string>>(new Set());

    // --- Modal facturation dédié ---
    const [showBillingModal, setShowBillingModal] = useState(false);
    // IDs des documents déjà facturés pendant cette session (pour l'état "déjà facturé")
    const [invoicedDocIds, setInvoicedDocIds] = useState<Set<string>>(new Set());

    // --- GRAFTED: Quick Assign & Sidebar ---
    const [quickAssignOpen, setQuickAssignOpen] = useState(false);
    const [quickAssignTarget, setQuickAssignTarget] = useState<{ date: string; providerId: string; providerName: string; startTime: string; endTime: string } | null>(null);
    const [quickAssignMission, setQuickAssignMission] = useState<Mission | null>(null);
    const [showUnassignedSidebar, setShowUnassignedSidebar] = useState(false);
    const [showDesktopFilters, setShowDesktopFilters] = useState(false);
    const [dayAssignOpen, setDayAssignOpen] = useState(false);
    const [dayAssignDate, setDayAssignDate] = useState<string | null>(null);

    // --- GRAFTED: Export functions ---
    const exportToPDFDay = async () => {
        const targetDate = statsDate || getMartiniqueToday();
        const dayMissions = validMissions.filter(m => m.date === targetDate && m.status !== 'cancelled');
        const dayProvisional = filteredProvisionalMissions.filter((p: any) => p.date === targetDate);

        const jsPDF = (await import('jspdf')).default;
        const doc = new jsPDF();

        doc.setFontSize(18);
        doc.text('Planning du jour', 105, 20, { align: 'center' });
        doc.setFontSize(12);
        doc.text(new Date(targetDate).toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }), 105, 30, { align: 'center' });

        let y = 45;
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text('Prestataire', 15, y);
        doc.text('Créneau', 60, y);
        doc.text('Client', 100, y);
        doc.text('Service', 155, y);
        doc.text('Statut', 185, y);
        doc.line(15, y + 2, 195, y + 2);
        y += 8;
        doc.setFont('helvetica', 'normal');

        const allItems = [
            ...dayMissions.map(m => ({ ...m, type: 'mission' })),
            ...dayProvisional.map(p => ({ ...p, type: 'provisional' }))
        ];

        if (allItems.length === 0) {
            doc.text('Aucune prestation planifiée', 105, y, { align: 'center' });
        } else {
            allItems.forEach(item => {
                const provider2Name = (item as any).provider2Name ? ` + ${(item as any).provider2Name}` : '';
                const provider = (item.providerName || 'À assigner') + provider2Name;
                const slot = `${item.startTime} - ${item.endTime}`;
                const client = item.clientName || '';
                const service = item.service || (item.type === 'provisional' ? 'Devis' : '');
                const status = item.type === 'provisional' ? 'En attente' : (item.status === 'completed' ? 'Terminé' : ((item as any).provider2Id ? 'Binôme' : 'Planifié'));

                doc.text(provider.substring(0, 30), 15, y);
                doc.text(slot, 60, y);
                doc.text(client.substring(0, 25), 100, y);
                doc.text(service.substring(0, 15), 155, y);
                doc.text(status, 185, y);
                y += 7;
                if (y > 270) { doc.addPage(); y = 20; }
            });
        }

        y += 10;
        const totalHours = dayMissions.reduce((acc, m) => acc + (m.duration || 0), 0);
        const uniqueProviders = new Set(dayMissions.map(m => m.providerId).filter(Boolean)).size;
        doc.setFont('helvetica', 'bold');
        doc.text(`Total: ${totalHours.toFixed(1)}h | ${uniqueProviders} prestataire(s) | ${dayMissions.length} prestation(s)`, 105, y, { align: 'center' });

        doc.save(`planning-${targetDate}.pdf`);
        toast.success('PDF exporté !');
    };

    const exportToPDFWeek = async () => {
        const { start: weekStart, end: weekEnd } = getWeekRange(currentWeekOffset);
        const weekMissions = validMissions.filter(m =>
            m.date >= weekStart.format('YYYY-MM-DD') &&
            m.date <= weekEnd.format('YYYY-MM-DD') &&
            m.status !== 'cancelled'
        );

        const jsPDF = (await import('jspdf')).default;
        const doc = new jsPDF('l', 'mm', 'a4');

        doc.setFontSize(16);
        doc.text(`Planning Semaine du ${weekStart.format('DD/MM')} au ${weekEnd.format('DD/MM')}`, 148, 15, { align: 'center' });

        const days = ['Jour', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
        let y = 25;
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        days.forEach((d, i) => doc.text(d, 20 + i * 35, y));
        y += 5;
        doc.line(15, y, 280, y);
        y += 5;

        for (let dayOffset = 0; dayOffset < 6; dayOffset++) {
            const dayDate = weekStart.add(dayOffset, 'day');
            const dayStr = dayDate.format('YYYY-MM-DD');
            const dayItems = weekMissions.filter(m => m.date === dayStr);

            doc.setFont('helvetica', 'normal');
            doc.text(dayDate.format('DD/MM'), 20 + dayOffset * 35, y);

            const missionText = dayItems.slice(0, 3).map(m =>
                `${m.startTime?.slice(0, 5)} ${m.providerName?.split(' ')[0] || '?'}`
            ).join('\n') || '-';
            const lines = missionText.split('\n');
            lines.forEach((line, i) => doc.text(line, 20 + dayOffset * 35, y + 5 + i * 4));
        }

        const totalHours = weekMissions.reduce((acc, m) => acc + (m.duration || 0), 0);
        doc.setFontSize(10);
        doc.text(`Total semaine: ${totalHours.toFixed(1)}h | ${weekMissions.length} prestations`, 148, 180, { align: 'center' });

        doc.save(`planning-semaine-${weekStart.format('YYYY-MM-DD')}.pdf`);
        toast.success('PDF semaine exporté !');
    };

    const exportToCSV = () => {
        const { start: weekStart, end: weekEnd } = getWeekRange(currentWeekOffset);
        const weekMissions = validMissions.filter(m =>
            m.date >= weekStart.format('YYYY-MM-DD') &&
            m.date <= weekEnd.format('YYYY-MM-DD') &&
            m.status !== 'cancelled'
        );

        const headers = ['Date', 'Prestataire', 'Début', 'Fin', 'Durée', 'Prestation', 'Client', 'Devis ID', 'Statut', 'Signal Facturation'];
        const rows = weekMissions.map(m => {
            const billingSignal = billingSignals.ultimatePackComplete.has(m.id) ? 'Pack complet' :
                billingSignals.readyToInvoice.has(m.id) ? 'À facturer' : '-';
            return [
                m.date,
                m.provider2Name ? `${m.providerName || 'À assigner'} + ${m.provider2Name}` : (m.providerName || 'À assigner'),
                m.startTime,
                m.endTime,
                m.duration?.toFixed(1) || '',
                m.service || '',
                m.clientName || '',
                m.sourceDocumentId || '',
                m.status,
                billingSignal
            ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
        });

        const csv = [headers.join(','), ...rows].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `prestations-${weekStart.format('YYYY-MM-DD')}-${weekEnd.format('YYYY-MM-DD')}.csv`;
        link.click();
        URL.revokeObjectURL(url);
        toast.success('CSV exporté !');
    };

    const handlePrint = () => window.print();

    // Calculate Week Date Range
    const getWeekRange = (offset: number) => {
        const now = getMartiniqueNowDayjs();
        const day = now.day() === 0 ? 7 : now.day();
        const start = now.startOf('day').subtract(day - 1, 'day').add(offset * 7, 'day');
        const end = start.add(6, 'day');
        return { start, end };
    };

    const { start: weekStart, end: weekEnd } = useMemo(() => getWeekRange(currentWeekOffset), [currentWeekOffset]);

    const { rangeStartStr, rangeEndStr } = useMemo(() => {
        if (customDateRange && startDate && endDate) {
            return { rangeStartStr: startDate, rangeEndStr: endDate };
        }
        return { rangeStartStr: weekStart.format('YYYY-MM-DD'), rangeEndStr: weekEnd.format('YYYY-MM-DD') };
    }, [customDateRange, startDate, endDate, weekStart, weekEnd]);

    const colDates = useMemo(() => {
        const base = Array.from({ length: 6 }, () => '');
        if (!rangeStartStr || !rangeEndStr) return base;

        if (!customDateRange) {
            return [0, 1, 2, 3, 4, 5].map(i => weekStart.add(i, 'day').format('YYYY-MM-DD'));
        }

        const start = dayjs.tz(rangeStartStr, 'YYYY-MM-DD', MARTINIQUE_TIMEZONE);
        const end = dayjs.tz(rangeEndStr, 'YYYY-MM-DD', MARTINIQUE_TIMEZONE);
        const byCol = new Map<number, string>();
        let cursor = start;
        while (cursor.isSame(end, 'day') || cursor.isBefore(end, 'day')) {
            const dateStr = cursor.format('YYYY-MM-DD');
            const dow = dayjs.tz(dateStr, 'YYYY-MM-DD', MARTINIQUE_TIMEZONE).day();
            const col = dow === 0 ? 5 : dow - 1;
            if (!byCol.has(col)) byCol.set(col, dateStr);
            cursor = cursor.add(1, 'day');
        }
        return [0, 1, 2, 3, 4, 5].map(i => byCol.get(i) || '');
    }, [customDateRange, rangeStartStr, rangeEndStr, weekStart]);

    useEffect(() => {
        const startStr = String(rangeStartStr || '').trim();
        const endStr = String(rangeEndStr || '').trim();
        if (!startStr || !endStr) return;

        const isInRange = (dateStr: string) => {
            const d = String(dateStr || '').trim();
            if (!d) return false;
            return d >= startStr && d <= endStr;
        };

        if (customDateRange && startDate && endDate && startDate === endDate) {
            setFocusedDate(startDate);
            return;
        }

        if (!isInRange(focusedDate)) {
            setFocusedDate(startStr);
        }
    }, [customDateRange, startDate, endDate, rangeStartStr, rangeEndStr, focusedDate]);

    const lastRangeRef = useRef<string>('');
    const pendingRangeRef = useRef<string>('');
    const backgroundRefreshInFlightRef = useRef(false);

    useEffect(() => {
        let startStr = '';
        let endStr = '';
        if (customDateRange && startDate && endDate) {
            startStr = startDate;
            endStr = endDate;
        } else {
            startStr = weekStart.format('YYYY-MM-DD');
            endStr = weekEnd.format('YYYY-MM-DD');
        }
        if (!startStr || !endStr) return;
        const key = `${startStr}_${endStr}`;
        if (lastRangeRef.current === key || pendingRangeRef.current === key) return;
        pendingRangeRef.current = key;
        let active = true;
        const run = async () => {
            try {
                setPlanningLoading(true);
                setPlanningProgress(15);
                if (loadMissionsForRange) {
                    const timeoutPromise = new Promise(resolve => setTimeout(() => resolve('timeout'), 3000));
                    const result = await Promise.race([
                        loadMissionsForRange(startStr, endStr, (p) => {
                            if (active) setPlanningProgress(p);
                        }),
                        timeoutPromise
                    ]);
                    if (result === 'timeout') {
                        pendingRangeRef.current = '';
                    } else if (result === true) {
                        lastRangeRef.current = key;
                    } else {
                        pendingRangeRef.current = '';
                    }
                }
                if (active) setPlanningProgress(100);
            } finally {
                if (active) {
                    setPlanningLoading(false);
                }
                pendingRangeRef.current = '';
            }
        };
        run();
        return () => {
            active = false;
        };
    }, [customDateRange, startDate, endDate, weekStart, weekEnd, loadMissionsForRange]);

    useEffect(() => {
        if (!loadMissionsForRange) return;

        let startStr = '';
        let endStr = '';
        if (customDateRange && startDate && endDate) {
            startStr = startDate;
            endStr = endDate;
        } else {
            startStr = weekStart.format('YYYY-MM-DD');
            endStr = weekEnd.format('YYYY-MM-DD');
        }
        if (!startStr || !endStr) return;

        const interval = setInterval(async () => {
            if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
            if (backgroundRefreshInFlightRef.current) return;
            backgroundRefreshInFlightRef.current = true;
            try {
                await loadMissionsForRange(startStr, endStr);
            } catch {
            } finally {
                backgroundRefreshInFlightRef.current = false;
            }
        }, 60000);

        return () => clearInterval(interval);
    }, [customDateRange, startDate, endDate, weekStart, weekEnd, loadMissionsForRange]);

    const encouragementMessages = [
        'On prépare votre planning… encore un instant.',
        'Merci pour votre patience, tout arrive.',
        'Vos missions se chargent, vous êtes presque prêt.',
        'On optimise l’affichage pour une navigation fluide.',
        'Dernières étapes, le planning est en route.'
    ];

    useEffect(() => {
        if (!planningLoading) return;
        const timer = setInterval(() => {
            setEncouragementIndex(prev => (prev + 1) % encouragementMessages.length);
        }, 2500);
        return () => clearInterval(timer);
    }, [planningLoading, encouragementMessages.length]);

    useEffect(() => {
        if (!planningLoading) return;
        const timer = setInterval(() => {
            setPlanningProgress(prev => {
                if (prev >= 90) return prev;
                return Math.min(90, prev + 2);
            });
        }, 600);
        return () => clearInterval(timer);
    }, [planningLoading]);



    // Format date range for display
    const dateRangeString = `Semaine du ${weekStart.format('DD/MM/YYYY')} au ${weekEnd.format('DD/MM/YYYY')}`;

    // Filter Logic (Missions & Reminders)
    const { filteredMissions, filteredReminders } = useMemo(() => {
        let startStr: string, endStr: string;

        if (customDateRange && startDate && endDate) {
            startStr = startDate;
            endStr = endDate;
        } else {
            startStr = weekStart.format('YYYY-MM-DD');
            endStr = weekEnd.format('YYYY-MM-DD');
        }

        // Missions
        let fMissions = validMissions
            .filter(m => matchesServiceTypeFilterFromText(m.service, serviceTypeFilter))
            .filter(m => m.date >= startStr && m.date <= endStr);

        // Filter by provider
        if (selectedProvider !== 'all') {
            fMissions = fMissions.filter(item => item.providerName === selectedProvider);
        }

        // Filter by client
        if (selectedClient !== 'all') {
            fMissions = fMissions.filter(item => item.clientName === selectedClient);
        }

        // Filter by status
        if (selectedStatus !== 'all') {
            fMissions = fMissions.filter(item => item.status === selectedStatus);
        }

        // Search query
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            fMissions = fMissions.filter(item =>
                item.clientName.toLowerCase().includes(query) ||
                (item.providerName && item.providerName.toLowerCase().includes(query)) ||
                item.service.toLowerCase().includes(query) ||
                item.date.includes(query)
            );
        }

        // Reminders (Only for the date range, no provider filter usually, unless tagged)
        let fReminders = reminders.filter(r => r.date >= startStr && r.date <= endStr);

        return { filteredMissions: fMissions, filteredReminders: fReminders };
    }, [validMissions, reminders, selectedProvider, selectedClient, selectedStatus, currentWeekOffset, searchQuery, weekStart, weekEnd, customDateRange, startDate, endDate, serviceTypeFilter]);

    const filteredProvisionalMissions = useMemo(() => {
        let startStr: string, endStr: string;

        if (customDateRange && startDate && endDate) {
            startStr = startDate;
            endStr = endDate;
        } else {
            startStr = weekStart.format('YYYY-MM-DD');
            endStr = weekEnd.format('YYYY-MM-DD');
        }

        // Include all quotes that have slots, excluding draft, 0€ TTC, and expired quotes
        const candidateDocs = (documents || [])
            .filter(d => !d.type || String(d.type).toLowerCase() === 'devis' || String(d.type).toLowerCase() === 'facture')
            .filter(d => !isQuoteDraft(d)) // Exclut les devis en brouillon
            .filter(d => !isQuoteZeroAmount(d)) // Exclut les devis à 0€ TTC
            .filter(d => !isQuoteExpired(d))
            .filter(d => {
                if (!serviceTypeFilter || serviceTypeFilter === 'all') return true;
                const category = String((d as any)?.category || '').trim().toLowerCase();
                const persisted = String((d as any)?.serviceType || (d as any)?.service_type || '').trim();
                if (serviceTypeFilter === 'Personnalisé') return persisted === 'Personnalisé' || category === 'custom';
                return persisted === serviceTypeFilter;
            });

        const provisional = candidateDocs.flatMap(d => {
            const raw = d.slotsData || (d as any).slots_data;
            let rawSlots: any[] = [];
            if (Array.isArray(raw)) {
                rawSlots = raw;
            } else if (typeof raw === 'string') {
                try {
                    const p = JSON.parse(raw);
                    if (Array.isArray(p)) rawSlots = p;
                } catch { }
            }
            if (rawSlots.length === 0) return [];
            const statusLower = String(d.status || '').toLowerCase();
            const isSigned = statusLower === 'signed' || statusLower === 'validated' || statusLower === 'accepted' || statusLower === 'paid' || statusLower === 'to_invoice';

            return rawSlots.map((slot: any, index: number) => {
                if (!slot?.date || slot.sessionStatus === 'cancelled') return null;

                // Check if a real mission already exists in `missions` state for this slot
                const hasRealMission = validMissions.some(m =>
                    m.status !== 'cancelled' &&
                    (
                        (m.sourceDocumentId === d.id && m.date === slot.date) ||
                        (m.clientId && d.clientId && m.clientId === d.clientId && m.date === slot.date && (m.startTime === slot.startTime || String(m.startTime || '').startsWith(slot.startTime)))
                    )
                );

                if (hasRealMission) return null; // Already rendered as a confirmed mission

                return {
                    id: slot.id ? `provisional-${slot.id}` : `provisional-${d.id}-${index}-${slot.date}-${slot.startTime || 'no-start'}`,
                    date: slot.date,
                    startTime: slot.startTime || '09:00',
                    endTime: slot.endTime || '12:00',
                    duration: typeof slot.duration === 'number' ? slot.duration : 3,
                    service: d.description || 'Prestation',
                    clientId: d.clientId,
                    clientName: d.clientName || 'Client',
                    providerId: null,
                    providerName: 'À assigner',
                    status: 'planned' as const,
                    color: 'gray',
                    sourceDocumentId: d.id,
                    isQuoteSlot: true,
                    quoteRef: d.ref,
                    isSignedQuote: isSigned,
                    quoteStatus: d.status
                };
            }).filter((item): item is NonNullable<typeof item> => Boolean(item));
        })
            .filter((item): item is NonNullable<typeof item> => Boolean(item && item.date))
            .filter((item) => item.date >= startStr && item.date <= endStr);

        let fProvisional: any[] = provisional;

        if (selectedProvider !== 'all' && selectedProvider !== 'À assigner') {
            fProvisional = fProvisional.filter((item: any) => item.providerName === selectedProvider);
        }

        if (selectedClient !== 'all') {
            fProvisional = fProvisional.filter((item: any) => item.clientName === selectedClient);
        }

        if (selectedStatus !== 'all' && selectedStatus !== 'planned') {
            fProvisional = fProvisional.filter((item: any) => item.status === selectedStatus);
        }

        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            fProvisional = fProvisional.filter((item: any) =>
                item.clientName.toLowerCase().includes(query) ||
                item.providerName.toLowerCase().includes(query) ||
                item.date.includes(query) ||
                (item.quoteRef && item.quoteRef.toLowerCase().includes(query))
            );
        }

        return fProvisional;
    }, [documents, validMissions, selectedProvider, selectedClient, selectedStatus, searchQuery, weekStart, weekEnd, customDateRange, startDate, endDate, serviceTypeFilter]);

    useEffect(() => {
        if (!planningLoading) return;
        const timeoutId = setTimeout(() => {
            setPlanningProgress(100);
            setPlanningLoading(false);
        }, 500);
        return () => clearTimeout(timeoutId);
    }, [planningLoading]);

    // --- SAFETY: Auto-reload when missions disappear unexpectedly ---
    const lastMissionsCountRef = useRef(missions.length);
    const safetyReloadTriggeredRef = useRef(false);

    useEffect(() => {
        // Skip if still loading or if reload already triggered in this session
        if (dataLoading || planningLoading || safetyReloadTriggeredRef.current) return;

        const currentCount = missions.length;
        const hadMissionsBefore = lastMissionsCountRef.current > 0;
        const hasNoMissionsNow = currentCount === 0;

        // If we had missions before but now we have none, and we're in a valid date range
        // This likely means TanStack Query invalidated the cache
        if (hadMissionsBefore && hasNoMissionsNow && !customDateRange) {
            console.log('[Planning] Missions disappeared unexpectedly, triggering reload...');
            safetyReloadTriggeredRef.current = true;

            // Force reload the current range111
            if (loadMissionsForRange) {
                const startStr = weekStart.format('YYYY-MM-DD');
                const endStr = weekEnd.format('YYYY-MM-DD');
                loadMissionsForRange(startStr, endStr).then(() => {
                    console.log('[Planning] Safety reload completed');
                    // Reset the flag after 5 seconds to allow future reloads if needed
                    setTimeout(() => {
                        safetyReloadTriggeredRef.current = false;
                    }, 5000);
                });
            }
        }

        lastMissionsCountRef.current = currentCount;
    }, [missions.length, dataLoading, planningLoading, customDateRange, weekStart, weekEnd, loadMissionsForRange]);

    // Reset safety flag when changing date ranges
    useEffect(() => {
        safetyReloadTriggeredRef.current = false;
        lastMissionsCountRef.current = missions.length;
    }, [currentWeekOffset, customDateRange, startDate, endDate, missions.length]);

    // Stats Logic
    const statsDate = focusedDate || getMartiniqueToday();
    const missionsCountToday = validMissions.filter(m => String(m.date || '') === String(statsDate)).length;
    const missionsCountWeek = filteredMissions.length;
    const missionsCompletedWeek = filteredMissions.filter(m => m.status === 'completed').length;

    const totalHoursToday = useMemo(() => {
        const computeDuration = (date: string, startTime: string, endTime: string, fallback: any) => {
            const start = String(startTime || '').trim();
            const end = String(endTime || '').trim();
            const d = String(date || '').trim();
            if (d && start && end) {
                const endDate = end < start ? dayjs.tz(d, 'YYYY-MM-DD', MARTINIQUE_TIMEZONE).add(1, 'day').format('YYYY-MM-DD') : d;
                const v = calculateDuration(d, start, endDate, end);
                if (Number.isFinite(v) && v > 0) return v;
            }
            const f = Number(fallback);
            return Number.isFinite(f) && f > 0 ? f : 0;
        };

        const missionsHours = (validMissions || [])
            .filter(m => String(m?.date || '') === statsDate)
            .filter(m => String((m as any)?.status || '') !== 'cancelled')
            .reduce((acc, m: any) => acc + computeDuration(m.date, m.startTime, m.endTime, m.duration), 0);

        const provisionalHours = (filteredProvisionalMissions || [])
            .filter((s: any) => String(s?.date || '') === statsDate)
            .reduce((acc: number, s: any) => acc + computeDuration(s.date, s.startTime, s.endTime, s.duration), 0);

        return Number((missionsHours + provisionalHours).toFixed(2));
    }, [validMissions, filteredProvisionalMissions, statsDate]);

    const totalHoursFiltered = filteredMissions
        .reduce((acc, m) => acc + m.duration, 0);

    const mobilePlanningDays = useMemo(() => {
        let startStr: string, endStr: string;

        if (customDateRange && startDate && endDate) {
            startStr = startDate;
            endStr = endDate;
        } else {
            startStr = weekStart.format('YYYY-MM-DD');
            endStr = weekEnd.format('YYYY-MM-DD');
        }

        const dates: string[] = [];
        let cursor = dayjs.tz(startStr, 'YYYY-MM-DD', MARTINIQUE_TIMEZONE);
        const end = dayjs.tz(endStr, 'YYYY-MM-DD', MARTINIQUE_TIMEZONE);
        while (cursor.isSame(end, 'day') || cursor.isBefore(end, 'day')) {
            dates.push(cursor.format('YYYY-MM-DD'));
            cursor = cursor.add(1, 'day');
        }

        return dates.map((dateStr) => {
            const remindersForDate = (filteredReminders || []).filter((r: any) => String(r?.date || '') === dateStr && !r.completed);
            const provisionalForDate = (filteredProvisionalMissions || []).filter((m: any) => String(m?.date || '') === dateStr);
            const missionsForDate = (filteredMissions || []).filter((m: any) => String(m?.date || '') === dateStr).filter((m: any) => m.status !== 'cancelled');
            return { dateStr, remindersForDate, provisionalForDate, missionsForDate };
        });
    }, [filteredReminders, filteredProvisionalMissions, filteredMissions, customDateRange, startDate, endDate, weekStart, weekEnd]);


    const handlePrevWeek = () => setCurrentWeekOffset(prev => prev - 1);
    const handleNextWeek = () => setCurrentWeekOffset(prev => prev + 1);
    const handleCurrentWeek = () => setCurrentWeekOffset(0);

    const isProviderNonWorkingDay = (providerId: string, dateStr: string) => {
        const provider = providers.find(p => p.id === providerId);
        if (!provider) return false;
        const day = dayjs.tz(dateStr, 'YYYY-MM-DD', MARTINIQUE_TIMEZONE).day();
        const days = (provider as any)?.nonInterventionDays;
        return Array.isArray(days) && days.includes(day);
    };

    const isProviderNonWorkingHours = (providerId: string, dateStr: string, startTime: string, endTime: string) => {
        const provider = providers.find(p => p.id === providerId);
        if (!provider) return false;
        const day = dayjs.tz(dateStr, 'YYYY-MM-DD', MARTINIQUE_TIMEZONE).day();
        const ranges = (provider as any)?.nonInterventionHours && typeof (provider as any)?.nonInterventionHours === 'object'
            ? (provider as any).nonInterventionHours[day]
            : undefined;

        const toMinutes = (t: any) => {
            const raw = String(t || '').trim();
            if (!raw) return NaN;
            const base = raw.includes(':') ? raw.split(':') : [];
            const h = base.length > 0 ? parseInt(base[0], 10) : NaN;
            const m = base.length > 1 ? parseInt(base[1], 10) : NaN;
            if (!Number.isFinite(h) || !Number.isFinite(m)) return NaN;
            return h * 60 + m;
        };

        const s = toMinutes(startTime);
        const e = toMinutes(endTime);
        if (!Number.isFinite(s) || !Number.isFinite(e)) return false;

        // Vérifier les plages récurrentes
        if (Array.isArray(ranges) && ranges.length > 0) {
            const hasRecurringBlock = ranges.some((r: any) => {
                const rStart = toMinutes(r?.start);
                const rEnd = toMinutes(r?.end);
                if (!Number.isFinite(rStart) || !Number.isFinite(rEnd)) return false;
                return s < rEnd && e > rStart;
            });
            if (hasRecurringBlock) return true;
        }

        // Vérifier les indisponibilités programmées multi-semaines
        const scheds = (provider as any)?.scheduledUnavailabilities;
        if (Array.isArray(scheds) && scheds.length > 0) {
            const dateObj = dayjs.tz(dateStr, 'YYYY-MM-DD', MARTINIQUE_TIMEZONE);
            const dateDay = dateObj.day();
            const dateObjStart = dateObj.startOf('day');
            const hasScheduledBlock = scheds.some((su: any) => {
                if (su.dayOfWeek !== dateDay) return false;
                const suStart = dayjs.tz(su.startDate, 'YYYY-MM-DD', MARTINIQUE_TIMEZONE).startOf('day');
                if (dateObjStart.isBefore(suStart)) return false;
                const suEnd = suStart.add(su.weeks * 7 - 1, 'day');
                if (dateObjStart.isAfter(suEnd)) return false;
                const rStart = toMinutes(su.startTime);
                const rEnd = toMinutes(su.endTime);
                if (!Number.isFinite(rStart) || !Number.isFinite(rEnd)) return false;
                return s < rEnd && e > rStart;
            });
            if (hasScheduledBlock) return true;
        }

        // Vérifier les indisponibilités ponctuelles
        const oneTimes = (provider as any)?.oneTimeUnavailabilities;
        if (Array.isArray(oneTimes) && oneTimes.length > 0) {
            const activeForDate = oneTimes.filter((otu: any) => otu.date === dateStr);
            if (activeForDate.length > 0) {
                const hasOneTimeBlock = activeForDate.some((otu: any) => {
                    const otuStart = toMinutes(otu.startTime);
                    const otuEnd = toMinutes(otu.endTime);
                    if (!Number.isFinite(otuStart) || !Number.isFinite(otuEnd)) return false;
                    return s < otuEnd && e > otuStart;
                });
                if (hasOneTimeBlock) return true;
            }
        }

        return false;
    };

    const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setMissionForm(prev => ({ ...prev, [name]: value }));
    };

    // --- GRAFTED: Vue synthétique journalière - Computed data ---
    const dailySummaryData = useMemo(() => {
        const targetDate = statsDate;
        const activeProviders = providers.filter(p => p?.status === 'Active');

        // Missions for the target date (non-cancelled)
        const dayMissions = validMissions.filter(m => m.date === targetDate && m.status !== 'cancelled');

        // Providers with missions that day
        const scheduledProviderIds = new Set(dayMissions.map(m => m.providerId).filter(Boolean));

        // Scheduled providers with their slots and hours
        const scheduledProviders = activeProviders
            .filter(p => scheduledProviderIds.has(p.id))
            .map(p => {
                const providerMissions = dayMissions.filter(m => m.providerId === p.id);
                const slots = providerMissions.map(m => ({
                    start: m.startTime,
                    end: m.endTime,
                    label: `${m.startTime.slice(0, 5)}–${m.endTime.slice(0, 5)}`
                }));
                const totalHours = providerMissions.reduce((acc, m) => acc + (m.duration || 0), 0);
                return { provider: p, slots, totalHours };
            })
            .sort((a, b) => b.totalHours - a.totalHours);

        // Available providers (not scheduled that day, and working that day)
        const availableProviders = activeProviders
            .filter(p => !scheduledProviderIds.has(p.id))
            .filter(p => !isProviderNonWorkingDay(p.id, targetDate))
            .map(p => {
                // Calculate available hours (max 7h - already worked 0h = 7h available)
                const availableHours = MAX_PROVIDER_DAILY_HOURS;
                // Get availability range for display
                let availabilityRange = '8h–17h';
                if (p.availabilityMode === 'available' && p.availabilityHours) {
                    const dayOfWeek = dayjs.tz(targetDate, 'YYYY-MM-DD', MARTINIQUE_TIMEZONE).day();
                    const ranges = p.availabilityHours[dayOfWeek];
                    if (ranges && ranges.length > 0) {
                        availabilityRange = `${ranges[0].start.slice(0, 5)}–${ranges[ranges.length - 1].end.slice(0, 5)}`;
                    }
                }
                return { provider: p, availableHours, availabilityRange };
            })
            .sort((a, b) => b.availableHours - a.availableHours);

        // Availability indicators by period
        const morningAvailable = activeProviders.filter(p => {
            if (scheduledProviderIds.has(p.id)) return false;
            if (isProviderNonWorkingDay(p.id, targetDate)) return false;
            // Check if available in morning (8h-12h)
            const dayOfWeek = dayjs.tz(targetDate, 'YYYY-MM-DD', MARTINIQUE_TIMEZONE).day();
            if (p.availabilityMode === 'available' && p.availabilityHours) {
                const ranges = p.availabilityHours[dayOfWeek];
                if (!ranges || ranges.length === 0) return false;
                return ranges.some(r => r.start <= '12:00' && r.end >= '08:00');
            }
            // Default: available 8h-17h
            return true;
        }).length;

        const afternoonAvailable = activeProviders.filter(p => {
            if (scheduledProviderIds.has(p.id)) return false;
            if (isProviderNonWorkingDay(p.id, targetDate)) return false;
            // Check if available in afternoon (12h-17h)
            const dayOfWeek = dayjs.tz(targetDate, 'YYYY-MM-DD', MARTINIQUE_TIMEZONE).day();
            if (p.availabilityMode === 'available' && p.availabilityHours) {
                const ranges = p.availabilityHours[dayOfWeek];
                if (!ranges || ranges.length === 0) return false;
                return ranges.some(r => r.start <= '17:00' && r.end >= '12:00');
            }
            return true;
        }).length;

        const fullDayAvailable = activeProviders.filter(p => {
            if (scheduledProviderIds.has(p.id)) return false;
            if (isProviderNonWorkingDay(p.id, targetDate)) return false;
            // Already has 0 hours, can take full 7h
            return true;
        }).length;

        return {
            date: targetDate,
            scheduledProviders,
            availableProviders,
            morningAvailable,
            afternoonAvailable,
            fullDayAvailable,
            totalScheduled: dayMissions.length,
            totalAvailable: availableProviders.length
        };
    }, [validMissions, providers, statsDate, isProviderNonWorkingDay]);

    // --- GRAFTED: Calcul du statut de remplissage par journée (couleurs) ---
    const dayFillStatus = useMemo(() => {
        const result = new Map<string, {
            plannedHours: number;
            capacityHours: number;
            fillRate: number;
            scheduledCount: number;
            status: 'normal' | 'busy' | 'full' | 'clos';
            bgColor: string;
        }>();
        const allDates = new Set<string>(colDates.filter(Boolean));
        allDates.forEach(dateStr => {
            const dayOfWeek = dayjs.tz(dateStr, 'YYYY-MM-DD', MARTINIQUE_TIMEZONE).day();
            const workingProviders = providers.filter(p => {
                if (p?.status !== 'Active') return false;
                const nid = p.nonInterventionDays;
                return !(Array.isArray(nid) && nid.includes(dayOfWeek));
            });
            const capacityHours = workingProviders.length * MAX_PROVIDER_DAILY_HOURS;
            const dayMissions = validMissions.filter(m => m.date === dateStr && m.status !== 'cancelled');
            const plannedHours = dayMissions.reduce((acc, m) => acc + (m.duration || 0), 0);
            const scheduledCount = new Set(dayMissions.map(m => m.providerId).filter(Boolean)).size;
            const fillRate = capacityHours > 0 ? plannedHours / capacityHours : 0;
            let status: 'normal' | 'busy' | 'full' | 'clos';
            let bgColor: string;
            if (closedDays.has(dateStr)) {
                status = 'clos'; bgColor = '#ccfbf1';
            } else if (fillRate >= 0.9) {
                status = 'full'; bgColor = '#ffedd5';
            } else if (fillRate >= 0.6) {
                status = 'busy'; bgColor = '#fef9c3';
            } else {
                status = 'normal'; bgColor = '#dcfce7';
            }
            result.set(dateStr, { plannedHours, capacityHours, fillRate, scheduledCount, status, bgColor });
        });
        return result;
    }, [validMissions, providers, closedDays, colDates]);

    const toggleCloseDay = (dateStr: string) => {
        setClosedDays(prev => {
            const next = new Set(prev);
            if (next.has(dateStr)) next.delete(dateStr); else next.add(dateStr);
            return next;
        });
    };

    // --- GRAFTED: Indicateurs de facturation (bleu = 2+ réalisées, violet = 6+ réalisées pack ultime) ---
    const billingSignals = useMemo(() => {
        const today = getMartiniqueToday();
        const oneMonthAgo = dayjs.tz(today, 'YYYY-MM-DD', MARTINIQUE_TIMEZONE).subtract(30, 'day').format('YYYY-MM-DD');

        // Construire un Set des clés "docId|date|startTime" des sessions annulées dans les slotsData
        const cancelledSlotKeys = new Set<string>();
        documents.forEach(d => {
            if (d.slotsData && Array.isArray(d.slotsData)) {
                for (const slot of d.slotsData) {
                    if (slot?.sessionStatus === 'cancelled' && slot.date && slot.startTime) {
                        cancelledSlotKeys.add(`${d.id}|${slot.date}|${slot.startTime}`);
                    }
                }
            }
        });

        const byDoc = new Map<string, typeof validMissions>();
        validMissions.forEach(m => {
            if (!m.sourceDocumentId) return;
            // Exclure les missions de plus de 1 mois (la facturation n'est plus pertinente)
            if (m.date && m.date < oneMonthAgo) return;
            // Exclure les missions liées à des sessions annulées dans le slotsData
            const slotKey = `${m.sourceDocumentId}|${m.date}|${m.startTime}`;
            if (cancelledSlotKeys.has(slotKey)) return;
            const group = byDoc.get(m.sourceDocumentId) ?? [];
            group.push(m);
            byDoc.set(m.sourceDocumentId, group);
        });

        const readyToInvoice = new Set<string>(); // mission ids
        const readyToInvoiceDocs = new Map<string, { completedCount: number; totalCount: number; clientName: string; docRef: string; completedMissions: { service: string; date: string }[]; pendingMissions: { service: string; date: string }[] }>();
        const ultimatePackComplete = new Set<string>(); // mission ids
        const ultimatePackDocs = new Map<string, { completedCount: number; totalCount: number; clientName: string; docRef: string; completedMissions: { service: string; date: string }[]; pendingMissions: { service: string; date: string }[] }>();

        byDoc.forEach((missionGroup, docId) => {
            // Exclure les documents déjà convertis en facture (linkedInvoiceId ou status 'converted')
            const doc = documents.find(d => d.id === docId);
            if (doc?.linkedInvoiceId || doc?.status === 'converted') return;

            const completed = missionGroup.filter(m => m.status === 'completed');
            const clientName = missionGroup[0]?.clientName ?? '—';
            const docRef = doc?.ref ?? docId.slice(0, 8);

            const completedMissions = completed.map(m => ({ service: m.service || 'Prestation', date: m.date || '' }));
            const pendingMissions = missionGroup.filter(m => m.status !== 'completed' && m.status !== 'cancelled').map(m => ({ service: m.service || 'Prestation', date: m.date || '' }));

            if (completed.length >= 6) {
                missionGroup.forEach(m => ultimatePackComplete.add(m.id));
                ultimatePackDocs.set(docId, { completedCount: completed.length, totalCount: missionGroup.length, clientName, docRef, completedMissions, pendingMissions });
            } else if (completed.length >= 2) {
                completed.forEach(m => readyToInvoice.add(m.id));
                readyToInvoiceDocs.set(docId, { completedCount: completed.length, totalCount: missionGroup.length, clientName, docRef, completedMissions, pendingMissions });
            } else if (completed.length === 1 && missionGroup.length === 1 && (missionGroup[0].duration || 0) >= 6) {
                // Pack Ultime 6 : une seule mission de 6h complétée = prêt à facturer
                completed.forEach(m => readyToInvoice.add(m.id));
                readyToInvoiceDocs.set(docId, { completedCount: 1, totalCount: missionGroup.length, clientName, docRef, completedMissions, pendingMissions });
            }
        });

        // Devis avec sessions à facturer (statut 'to_invoice', non brouillon et montant TTC > 0)
        const toInvoiceDocs = documents.filter(d => d.type === 'Devis' && d.status === 'to_invoice' && !isQuoteDraft(d) && !isQuoteZeroAmount(d));

        return { readyToInvoice, readyToInvoiceDocs, ultimatePackComplete, ultimatePackDocs, toInvoiceDocs };
    }, [validMissions, documents]);

    const shownPackToastRef = useRef<Set<string>>(new Set());
    useEffect(() => {
        billingSignals.ultimatePackDocs.forEach((data, docId) => {
            if (!shownPackToastRef.current.has(docId)) {
                shownPackToastRef.current.add(docId);
                toast.success(`Pack ultime complet : ${data.clientName} — Facture prête`);
            }
        });
    }, [billingSignals.ultimatePackDocs]);

    // --- GRAFTED: Handler validation facturation ---
    // Toast quand la 2ème prestation d'un pack est terminée (prêt à facturer)
    const shownBillingToastRef = useRef<Set<string>>(new Set());
    useEffect(() => {
        billingSignals.readyToInvoiceDocs.forEach((data, docId) => {
            if (!shownBillingToastRef.current.has(docId)) {
                shownBillingToastRef.current.add(docId);
                toast.success(`Pack ${data.clientName} : ${data.completedCount} prestations terminées — Prêt à facturer !`);
            }
        });
    }, [billingSignals.readyToInvoiceDocs]);

    const handleValidateBilling = async () => {
        if (billingSelectedDocs.size === 0) return;
        setBillingValidating(true);
        const docIds = Array.from(billingSelectedDocs);
        let successCount = 0;
        let errorCount = 0;
        for (const docId of docIds) {
            try {
                await convertQuoteToInvoice(docId);
                successCount++;
            } catch (e) {
                console.error('[Planning] Erreur conversion facture pour', docId, e);
                errorCount++;
            }
        }
        setBillingValidating(false);
        setBillingSelectedDocs(new Set());
        if (successCount > 0) toast.success(`${successCount} facture(s) générée(s) avec succès`);
        if (errorCount > 0) toast.error(`${errorCount} erreur(s) lors de la conversion`);
    };

    const toggleBillingDoc = (docId: string) => {
        setBillingSelectedDocs(prev => {
            const next = new Set(prev);
            if (next.has(docId)) next.delete(docId); else next.add(docId);
            return next;
        });
    };

    // Reset billing state when modal closes
    useEffect(() => {
        if (!showDailySummary) {
            setBillingSelectedDocs(new Set());
            setBillingFilter('');
        }
    }, [showDailySummary]);

    // --- GRAFTED: Vérifier si une date est passée ---
    const isDatePast = (dateStr: string): boolean => {
        const today = getMartiniqueToday();
        return dateStr < today;
    };

    // --- GRAFTED: Données agrégées pour le mini-dashboard semaine ---
    const weekDashboardData = useMemo(() => {
        const DAY_NAMES = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
        const activeProviders = providers.filter(p => p?.status === 'Active');

        const days = colDates
            .map((dateStr, idx) => {
                if (!dateStr) return null;
                const dayStatus = dayFillStatus.get(dateStr);
                const dayMissions = validMissions.filter(m => m.date === dateStr && m.status !== 'cancelled');
                const scheduledProviderIds = new Set(dayMissions.map(m => m.providerId).filter(Boolean));
                const dayOfWeek = dayjs.tz(dateStr, 'YYYY-MM-DD', MARTINIQUE_TIMEZONE).day();
                const workingProvidersCount = activeProviders.filter(p => {
                    const nid = (p as any).nonInterventionDays;
                    return !(Array.isArray(nid) && nid.includes(dayOfWeek));
                }).length;
                const hasPack = dayMissions.some(m => billingSignals.ultimatePackComplete.has(m.id));
                const hasInvoice = !hasPack && dayMissions.some(m => billingSignals.readyToInvoice.has(m.id));
                return {
                    dateStr,
                    dayName: DAY_NAMES[idx] ?? '',
                    dayNum: dayjs.tz(dateStr, 'YYYY-MM-DD', MARTINIQUE_TIMEZONE).format('DD/MM'),
                    scheduledCount: scheduledProviderIds.size,
                    totalProviders: workingProvidersCount,
                    plannedHours: dayStatus?.plannedHours ?? 0,
                    status: (dayStatus?.status ?? 'normal') as 'normal' | 'busy' | 'full' | 'clos',
                    bgColor: dayStatus?.bgColor ?? '#dcfce7',
                    hasBillingSignal: hasPack || hasInvoice,
                    billingType: hasPack ? 'pack' : hasInvoice ? 'invoice' : null,
                };
            })
            .filter((d): d is NonNullable<typeof d> => d !== null);

        const weekMissions = validMissions.filter(m => colDates.includes(m.date) && m.status !== 'cancelled');
        const weekProviderIds = new Set(weekMissions.map(m => m.providerId).filter(Boolean));
        const weekHours = weekMissions.reduce((acc, m) => acc + (m.duration || 0), 0);

        return {
            days,
            totalMissions: weekMissions.length,
            activeProvidersCount: weekProviderIds.size,
            totalHours: weekHours,
            readyToInvoiceCount: billingSignals.readyToInvoiceDocs.size + billingSignals.ultimatePackDocs.size,
        };
    }, [colDates, validMissions, providers, dayFillStatus, billingSignals]);

    // --- GRAFTED: Calcul des heures déjà planifiées pour un prestataire sur un jour donné ---
    const getProviderDailyHours = (providerId: string, dateStr: string, excludeMissionId?: string): number => {
        return validMissions
            .filter(m => m.providerId === providerId && m.date === dateStr && m.status !== 'cancelled')
            .filter(m => !excludeMissionId || m.id !== excludeMissionId)
            .reduce((acc, m) => {
                const d = calculateDuration(m.date, m.startTime, m.date, m.endTime);
                return acc + (Number.isFinite(d) && d > 0 ? d : 0);
            }, 0);
    };

    // --- GRAFTED: Heures supplémentaires déjà planifiées pour un prestataire sur un jour donné ---
    const getProviderOvertimeHours = (providerId: string, dateStr: string): number => {
        return validMissions
            .filter(m => m.providerId === providerId && m.date === dateStr && m.status !== 'cancelled' && m.isOvertime === true)
            .reduce((acc, m) => {
                const d = calculateDuration(m.date, m.startTime, m.date, m.endTime);
                return acc + (Number.isFinite(d) && d > 0 ? d : 0);
            }, 0);
    };

    // --- GRAFTED: Label enrichi pour la sélection de prestataire en mode heures sup. ---
    const getProviderSelectLabel = (p: any, dateStr: string, startTime: string, endTime: string, isOvertimeMode: boolean): { label: string; disabled: boolean; available: boolean } => {
        const name = getProviderDisplayName(p);
        const reason = dateStr ? getProviderUnavailableReason(p.id, dateStr, startTime, endTime) : null;
        const available = reason === null;
        const isActive = p.status === 'Active';

        if (!isActive) {
            return { label: `${name} (Inactif)`, disabled: true, available: false };
        }

        if (isOvertimeMode) {
            // En mode heures sup : tous les prestataires sont affichés et sélectionnables
            const overtimeHours = dateStr ? getProviderOvertimeHours(p.id, dateStr) : 0;
            let label = name;
            if (available) {
                label += ` (disponible)`;
            } else {
                label += ` (indisponible : ${reason})`;
            }
            if (overtimeHours > 0) {
                label += ` — ${overtimeHours.toFixed(1)}h sup. déjà`;
            }
            return { label, disabled: false, available };
        }

        // Mode normal : seuls les prestataires disponibles sont sélectionnables
        if (reason) {
            return { label: `${name} (${reason})`, disabled: true, available: false };
        }
        return { label: name, disabled: false, available: true };
    };

    function calculateDuration(startDate: string, startTime: string, endDate: string, endTime: string) {
        const start = dayjs.tz(`${startDate} ${startTime}`, 'YYYY-MM-DD HH:mm', MARTINIQUE_TIMEZONE);
        const end = dayjs.tz(`${endDate} ${endTime}`, 'YYYY-MM-DD HH:mm', MARTINIQUE_TIMEZONE);
        const diffMs = end.valueOf() - start.valueOf();
        return diffMs > 0 ? diffMs / (1000 * 60 * 60) : 0;
    }

    // --- GRAFTED: Suggestions automatiques de prestataires ---
    const providerSuggestions = useMemo(() => {
        if (!missionForm.date || !missionForm.startTime || !missionForm.endTime) {
            return { suggestions: [], reasons: new Map() };
        }

        const targetDate = missionForm.date;
        const startTime = missionForm.startTime;
        const endTime = missionForm.endTime;
        const duration = calculateDuration(targetDate, startTime, targetDate, endTime);
        const targetClientId = missionForm.clientId;

        const activeProviders = providers.filter(p => p?.status === 'Active');
        const reasons = new Map<string, string[]>();

        // Calculate week date range for this week
        const { start: weekStart, end: weekEnd } = getWeekRange(currentWeekOffset);
        const weekStartStr = weekStart.format('YYYY-MM-DD');
        const weekEndStr = weekEnd.format('YYYY-MM-DD');

        // Score each provider
        const scored = activeProviders.map(p => {
            const providerReasons: string[] = [];

            // Criterion 1: Available this day (eliminating)
            if (isProviderNonWorkingDay(p.id, targetDate)) {
                providerReasons.push('Ne travaille pas ce jour');
            }

            // Criterion 2: Has not reached 7h daily limit
            const dailyHours = getProviderDailyHours(p.id, targetDate);
            if (dailyHours + duration > MAX_PROVIDER_DAILY_HOURS) {
                providerReasons.push(`Dépasserait 7h aujourd'hui (${dailyHours.toFixed(1)}h + ${duration.toFixed(1)}h)`);
            }

            // Criterion 3: No overlap with existing missions
            const hasOverlap = missions.some(m => {
                if (m.status === 'cancelled' || m.date !== targetDate || m.providerId !== p.id) return false;
                if (!m.startTime || !m.endTime) return false;
                const mStart = dayjs.tz(`${m.date} ${m.startTime}`, 'YYYY-MM-DD HH:mm', MARTINIQUE_TIMEZONE);
                const mEnd = dayjs.tz(`${m.date} ${m.endTime}`, 'YYYY-MM-DD HH:mm', MARTINIQUE_TIMEZONE);
                if (!mStart.isValid() || !mEnd.isValid()) return false;
                const sStart = dayjs.tz(`${targetDate} ${startTime}`, 'YYYY-MM-DD HH:mm', MARTINIQUE_TIMEZONE);
                const sEnd = dayjs.tz(`${targetDate} ${endTime}`, 'YYYY-MM-DD HH:mm', MARTINIQUE_TIMEZONE);
                return sStart.valueOf() < mEnd.valueOf() && sEnd.valueOf() > mStart.valueOf();
            });
            if (hasOverlap) {
                providerReasons.push('Chevauchement avec une mission existante');
            }

            reasons.set(p.id, providerReasons);

            if (providerReasons.length > 0) {
                return { provider: p, score: -1000, dailyHours, weekHours: 0, hasWorkedForClient: false };
            }

            // Criterion 4: Priority to providers with least hours this week (workload balance)
            const weekHours = missions
                .filter(m => m.providerId === p.id && m.date >= weekStartStr && m.date <= weekEndStr && m.status !== 'cancelled')
                .reduce((acc, m) => acc + (m.duration || 0), 0);

            // Criterion 5: Priority to providers who have already worked for this client
            const hasWorkedForClient = targetClientId
                ? missions.some(m => m.providerId === p.id && m.clientId === targetClientId && m.status === 'completed')
                : false;

            // Scoring: lower is better
            // Weight: weekHours (0-50 range), hasWorkedForClient (-20 bonus)
            const score = weekHours + (hasWorkedForClient ? -20 : 0);

            return { provider: p, score, dailyHours, weekHours, hasWorkedForClient };
        });

        // Sort by score (lower = better) and take top 3
        const suggestions = scored
            .filter(s => s.score >= 0)
            .sort((a, b) => a.score - b.score)
            .slice(0, 3)
            .map(s => ({
                provider: s.provider,
                dailyHours: s.dailyHours,
                weekHours: s.weekHours,
                hasWorkedForClient: s.hasWorkedForClient,
                availableHours: Math.max(0, MAX_PROVIDER_DAILY_HOURS - s.dailyHours),
            }));

        return { suggestions, reasons };
    }, [missionForm.date, missionForm.startTime, missionForm.endTime, missionForm.clientId, providers, missions, currentWeekOffset]);

    // --- GRAFTED: Stats pour la fiche prestataire ---
    const providerStatsData = useMemo(() => {
        if (!selectedProviderStats) return null;

        const providerId = selectedProviderStats.id;
        const today = getMartiniqueToday();
        const now = dayjs.tz(today, 'YYYY-MM-DD', MARTINIQUE_TIMEZONE);

        // Week range
        const { start: weekStart, end: weekEnd } = getWeekRange(currentWeekOffset);
        const weekStartStr = weekStart.format('YYYY-MM-DD');
        const weekEndStr = weekEnd.format('YYYY-MM-DD');

        // Month range
        const monthStart = now.startOf('month');
        const monthEnd = now.endOf('month');
        const monthStartStr = monthStart.format('YYYY-MM-DD');
        const monthEndStr = monthEnd.format('YYYY-MM-DD');

        // Previous month
        const prevMonthStart = monthStart.subtract(1, 'month');
        const prevMonthEnd = monthStart.subtract(1, 'day');
        const prevMonthStartStr = prevMonthStart.format('YYYY-MM-DD');
        const prevMonthEndStr = prevMonthEnd.format('YYYY-MM-DD');

        // Week stats
        const weekMissions = missions.filter(m =>
            m.providerId === providerId &&
            m.date >= weekStartStr && m.date <= weekEndStr &&
            m.status !== 'cancelled'
        );
        const weekPlanned = weekMissions.length;
        const weekHours = weekMissions.reduce((acc, m) => acc + (m.duration || 0), 0);
        const weekWorkedDays = new Set(weekMissions.map(m => m.date)).size;

        // Provider working days this week
        const providerWorkingDaysThisWeek = [0, 1, 2, 3, 4, 5].filter(day => {
            const nid = (selectedProviderStats as any).nonInterventionDays;
            return !(Array.isArray(nid) && nid.includes(day));
        }).length;

        // Month stats
        const monthMissions = missions.filter(m =>
            m.providerId === providerId &&
            m.date >= monthStartStr && m.date <= monthEndStr &&
            m.status !== 'cancelled'
        );
        const monthHours = monthMissions.reduce((acc, m) => acc + (m.duration || 0), 0);
        const monthClients = new Set(monthMissions.map(m => m.clientId)).size;

        // Previous month stats
        const prevMonthMissions = missions.filter(m =>
            m.providerId === providerId &&
            m.date >= prevMonthStartStr && m.date <= prevMonthEndStr &&
            m.status !== 'cancelled'
        );
        const prevMonthHours = prevMonthMissions.reduce((acc, m) => acc + (m.duration || 0), 0);
        const monthDiff = monthHours - prevMonthHours;

        // 30-day presence calendar
        const presenceDays = Array.from({ length: 30 }, (_, i) => {
            const d = now.subtract(29 - i, 'day');
            const dateStr = d.format('YYYY-MM-DD');
            const dayOfWeek = d.day();
            const isWorkingDay = !((selectedProviderStats as any).nonInterventionDays || []).includes(dayOfWeek);
            const dayMission = missions.find(m => m.providerId === providerId && m.date === dateStr && m.status !== 'cancelled');
            const isToday = dateStr === today;

            return {
                dateStr,
                dayNum: d.date(),
                worked: !!dayMission,
                available: isWorkingDay && !dayMission,
                unavailable: !isWorkingDay,
                isToday,
            };
        });

        // Last 5 missions
        const lastMissions = missions
            .filter(m => m.providerId === providerId && m.status !== 'cancelled')
            .sort((a, b) => b.date.localeCompare(a.date) || b.startTime.localeCompare(a.startTime))
            .slice(0, 5)
            .map(m => {
                const client = clients.find(c => c.id === m.clientId);
                return {
                    ...m,
                    clientName: client?.name || m.clientName,
                    clientCity: client?.city,
                };
            });

        // Occupation rate (week)
        const maxWeeklyHours = providerWorkingDaysThisWeek * MAX_PROVIDER_DAILY_HOURS;
        const occupationRate = maxWeeklyHours > 0 ? Math.min(100, (weekHours / maxWeeklyHours) * 100) : 0;

        return {
            weekPlanned,
            weekHours,
            weekWorkedDays,
            providerWorkingDaysThisWeek,
            monthHours,
            monthMissions: monthMissions.length,
            monthClients,
            monthDiff,
            prevMonthHours,
            presenceDays,
            lastMissions,
            occupationRate,
        };
    }, [selectedProviderStats, missions, providers, clients, currentWeekOffset]);

    // --- GRAFTED: Centre de notifications intelligent ---
    const notificationsData = useMemo(() => {
        const today = getMartiniqueToday();
        const tomorrow = dayjs.tz(today, 'YYYY-MM-DD', MARTINIQUE_TIMEZONE).add(1, 'day').format('YYYY-MM-DD');
        const notifications: Array<{
            id: string;
            type: 'planning' | 'billing' | 'workload' | 'confirmation';
            title: string;
            message: string;
            priority: 'high' | 'medium' | 'low';
            action?: { label: string; onClick: () => void };
        }> = [];

        const activeProviders = providers.filter(p => p?.status === 'Active');

        // === PLANNING ALERTS ===
        // Tomorrow: available providers but no missions
        const tomorrowMissions = validMissions.filter(m => m.date === tomorrow && m.status !== 'cancelled');
        const tomorrowProviderIds = new Set(tomorrowMissions.map(m => m.providerId).filter(Boolean));
        const availableTomorrow = activeProviders.filter(p => {
            if (tomorrowProviderIds.has(p.id)) return false;
            const dayOfWeek = dayjs.tz(tomorrow, 'YYYY-MM-DD', MARTINIQUE_TIMEZONE).day();
            const nid = (p as any).nonInterventionDays;
            return !(Array.isArray(nid) && nid.includes(dayOfWeek));
        });
        if (availableTomorrow.length >= 3) {
            notifications.push({
                id: 'plan-tomorrow-empty',
                type: 'planning',
                title: 'Planning vide demain',
                message: `${availableTomorrow.length} prestataires disponibles demain mais aucune prestation planifiée`,
                priority: 'high',
            });
        }

        // Today: under-utilized providers
        activeProviders.forEach(p => {
            const dayOfWeek = dayjs.tz(today, 'YYYY-MM-DD', MARTINIQUE_TIMEZONE).day();
            const nid = (p as any).nonInterventionDays;
            if (Array.isArray(nid) && nid.includes(dayOfWeek)) return;

            const todayHours = getProviderDailyHours(p.id, today);
            if (todayHours > 0 && todayHours < 4) {
                const available = MAX_PROVIDER_DAILY_HOURS - todayHours;
                notifications.push({
                    id: `plan-underutilized-${p.id}`,
                    type: 'planning',
                    title: `${p.firstName || 'Prestataire'} sous-utilisé`,
                    message: `${p.firstName || 'Prestataire'} n'a que ${todayHours.toFixed(1)}h planifiées — ${available.toFixed(1)}h disponibles`,
                    priority: 'medium',
                });
            }
        });

        // === BILLING ALERTS ===
        // Ready to invoice
        billingSignals.readyToInvoiceDocs.forEach((data, docId) => {
            notifications.push({
                id: `bill-invoice-${docId}`,
                type: 'billing',
                title: 'Facturation possible',
                message: `Devis ${data.clientName} — ${data.completedCount} prestations réalisées`,
                priority: 'high',
                action: { label: 'Facturer', onClick: () => { setShowBillingModal(true); setShowNotifications(false); } },
            });
        });

        // Complete packs
        billingSignals.ultimatePackDocs.forEach((data, docId) => {
            notifications.push({
                id: `bill-pack-${docId}`,
                type: 'billing',
                title: 'Pack complet',
                message: `Pack ultime de ${data.clientName} complet — ${data.completedCount} prestations`,
                priority: 'high',
                action: { label: 'Facturer', onClick: () => { setShowBillingModal(true); setShowNotifications(false); } },
            });
        });

        // === WORKLOAD ALERTS ===
        // Full providers today
        activeProviders.forEach(p => {
            const dayOfWeek = dayjs.tz(today, 'YYYY-MM-DD', MARTINIQUE_TIMEZONE).day();
            const nid = (p as any).nonInterventionDays;
            if (Array.isArray(nid) && nid.includes(dayOfWeek)) return;

            const todayHours = getProviderDailyHours(p.id, today);
            if (todayHours >= MAX_PROVIDER_DAILY_HOURS) {
                notifications.push({
                    id: `workload-full-${p.id}`,
                    type: 'workload',
                    title: `${p.firstName || 'Prestataire'} complet`,
                    message: `${p.firstName || 'Prestataire'} a travaillé ${todayHours.toFixed(1)}h aujourd'hui — aucune prestation supplémentaire possible`,
                    priority: 'low',
                });
            }
        });

        // Providers with no missions this week
        const { start: weekStart, end: weekEnd } = getWeekRange(currentWeekOffset);
        const weekStartStr = weekStart.format('YYYY-MM-DD');
        const weekEndStr = weekEnd.format('YYYY-MM-DD');
        const unusedProviders = activeProviders.filter(p => {
            return !validMissions.some(m =>
                m.providerId === p.id &&
                m.date >= weekStartStr && m.date <= weekEndStr &&
                m.status !== 'cancelled'
            );
        });
        if (unusedProviders.length > 0 && unusedProviders.length <= 3) {
            notifications.push({
                id: 'workload-unused-week',
                type: 'workload',
                title: 'Prestataires inactives',
                message: `${unusedProviders.length} prestataire(s) n'ont eu aucune prestation cette semaine`,
                priority: 'medium',
            });
        }

        // Sort by priority
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        notifications.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

        return notifications.slice(0, 20);
    }, [validMissions, providers, billingSignals, currentWeekOffset]);

    // --- GRAFTED: Génération du message WhatsApp planning ---
    const buildWhatsAppMessage = (provider: Provider, targetDate: string): string => {
        const providerMissions = validMissions
            .filter(m => m.providerId === provider.id && m.date === targetDate && m.status !== 'cancelled')
            .sort((a, b) => a.startTime.localeCompare(b.startTime));
        const dateLabel = new Date(`${targetDate}T00:00:00`).toLocaleDateString('fr-FR', {
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
        });
        const total = providerMissions.reduce((acc, m) => acc + (m.duration || 0), 0);
        const lines = providerMissions.length > 0
            ? providerMissions.map(m => {
                const client = clients.find(c => c.id === m.clientId);
                const address = client?.address
                    ? `${client.address}${client.city ? ', ' + client.city : ''}`
                    : (client?.city || m.clientName);
                return `• ${m.startTime.slice(0, 5)}–${m.endTime.slice(0, 5)} : ${m.service || 'Prestation'} — ${address}`;
            }).join('\n')
            : '• Aucune prestation trouvée';
        const companyName = companySettings?.name || 'Presta Services Antilles';
        return `Bonjour ${provider.firstName || ''},\n\nVoici votre planning du ${dateLabel} :\n\n${lines}\n\nTotal : ${total.toFixed(1)}h de travail aujourd'hui.\n\nBonne journée ! 🙏\n${companyName}`;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (submitLockRef.current) return;
        submitLockRef.current = true;

        if (isSubmitting) return; // Prevent double submit
        setIsSubmitting(true);

        try {
            // Use endDate or fallback to date
            const finalEndDate = missionForm.endDate || missionForm.date;

            // Calculate duration based on full date/times
            let duration = calculateDuration(missionForm.date, missionForm.startTime, finalEndDate, missionForm.endTime);
            if (duration <= 0) duration = 1; // Fallback default

            // Get client and provider
            const client = clients.find(c => c.id === missionForm.clientId);
            const isExternalProvider = missionForm.providerId === EXTERNAL_PROVIDER_ID;
            const provider = isExternalProvider ? EXTERNAL_PROVIDER : providers.find(p => p.id === missionForm.providerId);
            const isExternalProvider2 = missionForm.provider2Id === EXTERNAL_PROVIDER_ID;
            const provider2 = missionForm.provider2Id
                ? (isExternalProvider2 ? EXTERNAL_PROVIDER : providers.find(p => p.id === missionForm.provider2Id) ?? null)
                : null;

            if (!client) { throw new Error("Client invalide"); }

            const isOvertimeMode = missionForm.isOvertime;

            // --- GRAFTED: Validation durée (3h, 4h, 6h ou 7h uniquement) ---
            const slotDurationHours = calculateDuration(missionForm.date, missionForm.startTime, finalEndDate, missionForm.endTime);
            const roundedDuration = Math.round(slotDurationHours * 10) / 10;
            const isValidDuration = ALLOWED_DURATIONS.some(d => Math.abs(slotDurationHours - d) < 0.05);
            if (!isValidDuration && !isOvertimeMode) {
                throw new Error(`Durée invalide (${roundedDuration}h). Les créneaux autorisés sont : 3h, 4h, 6h ou 7h.`);
            }

            // --- GRAFTED: Validation plafond 7h/jour par prestataire (ignoré en heures supplémentaires) ---
            if (provider && !isOvertimeMode && !isExternalProvider) {
                const existingHours = getProviderDailyHours(provider.id, missionForm.date);
                if (existingHours + slotDurationHours > MAX_PROVIDER_DAILY_HOURS) {
                    throw new Error(`${getProviderDisplayName(provider)} dépasserait 7h/jour (${existingHours.toFixed(1)}h déjà planifiées + ${roundedDuration}h = ${(existingHours + slotDurationHours).toFixed(1)}h).`);
                }
            }

            // Recurrence Logic
            const startDateObj = dayjs.tz(missionForm.date, 'YYYY-MM-DD', MARTINIQUE_TIMEZONE);
            if (!startDateObj.isValid()) { throw new Error("Date invalide"); }

            const count = missionForm.recurrence === 'none' ? 1 : parseInt(missionForm.occurrences.toString()) || 1;

            for (let i = 0; i < count; i++) {
                let currentDate = startDateObj;

                if (missionForm.recurrence === 'weekly') {
                    currentDate = startDateObj.add(i * 7, 'day');
                } else if (missionForm.recurrence === 'biweekly') {
                    currentDate = startDateObj.add(i * 14, 'day');
                } else if (missionForm.recurrence === 'monthly') {
                    currentDate = startDateObj.add(i, 'month');
                }

                const dateStr = currentDate.format('YYYY-MM-DD');

                if (provider && !isOvertimeMode && !isExternalProvider && isProviderNonWorkingDay(provider.id, dateStr)) {
                    throw new Error(`Impossible de programmer ${getProviderDisplayName(provider)} le ${dateStr} : ne travaille pas aujourd'hui.`);
                }

                if (provider && !isOvertimeMode && !isExternalProvider && isProviderNonWorkingHours(provider.id, dateStr, missionForm.startTime, missionForm.endTime)) {
                    throw new Error(`Impossible de programmer ${getProviderDisplayName(provider)} le ${dateStr} : indisponible sur ce créneau horaire.`);
                }

                // Vérifier le 2e prestataire
                if (provider2 && !isOvertimeMode && !isExternalProvider2 && isProviderNonWorkingDay(provider2.id, dateStr)) {
                    throw new Error(`Impossible de programmer ${getProviderDisplayName(provider2)} (2e prestataire) le ${dateStr} : ne travaille pas aujourd'hui.`);
                }
                if (provider2 && !isOvertimeMode && !isExternalProvider2 && isProviderNonWorkingHours(provider2.id, dateStr, missionForm.startTime, missionForm.endTime)) {
                    throw new Error(`Impossible de programmer ${getProviderDisplayName(provider2)} (2e prestataire) le ${dateStr} : indisponible sur ce créneau horaire.`);
                }

                // --- GRAFTED: Vérification chevauchement d'horaires pour la même prestataire (ignoré en heures supplémentaires) ---
                if (provider && !isOvertimeMode && !isExternalProvider) {
                    const hasOverlap = missions.some(m => {
                        if (m.status === 'cancelled' || m.date !== dateStr || m.providerId !== provider.id) return false;
                        if (!m.startTime || !m.endTime) return false;
                        const mStart = dayjs.tz(`${m.date} ${m.startTime}`, 'YYYY-MM-DD HH:mm', MARTINIQUE_TIMEZONE);
                        const mEnd = dayjs.tz(`${m.date} ${m.endTime}`, 'YYYY-MM-DD HH:mm', MARTINIQUE_TIMEZONE);
                        if (!mStart.isValid() || !mEnd.isValid()) return false;
                        const sStart = dayjs.tz(`${dateStr} ${missionForm.startTime}`, 'YYYY-MM-DD HH:mm', MARTINIQUE_TIMEZONE);
                        const sEnd = dayjs.tz(`${dateStr} ${missionForm.endTime}`, 'YYYY-MM-DD HH:mm', MARTINIQUE_TIMEZONE);
                        return sStart.valueOf() < mEnd.valueOf() && sEnd.valueOf() > mStart.valueOf();
                    });
                    if (hasOverlap) {
                        throw new Error(`Conflit d'horaire : ${getProviderDisplayName(provider)} a déjà une mission qui chevauche ${missionForm.startTime}–${missionForm.endTime} le ${dateStr}.`);
                    }
                }

                // Vérification chevauchement pour le 2e prestataire
                if (provider2 && !isOvertimeMode && !isExternalProvider2) {
                    const hasOverlap2 = missions.some(m => {
                        if (m.status === 'cancelled' || m.date !== dateStr) return false;
                        const mP1 = m.providerId === provider2.id;
                        const mP2 = m.provider2Id === provider2.id;
                        if (!mP1 && !mP2) return false;
                        if (!m.startTime || !m.endTime) return false;
                        const mStart = dayjs.tz(`${m.date} ${m.startTime}`, 'YYYY-MM-DD HH:mm', MARTINIQUE_TIMEZONE);
                        const mEnd = dayjs.tz(`${m.date} ${m.endTime}`, 'YYYY-MM-DD HH:mm', MARTINIQUE_TIMEZONE);
                        if (!mStart.isValid() || !mEnd.isValid()) return false;
                        const sStart = dayjs.tz(`${dateStr} ${missionForm.startTime}`, 'YYYY-MM-DD HH:mm', MARTINIQUE_TIMEZONE);
                        const sEnd = dayjs.tz(`${dateStr} ${missionForm.endTime}`, 'YYYY-MM-DD HH:mm', MARTINIQUE_TIMEZONE);
                        return sStart.valueOf() < mEnd.valueOf() && sEnd.valueOf() > mStart.valueOf();
                    });
                    if (hasOverlap2) {
                        throw new Error(`Conflit d'horaire : ${getProviderDisplayName(provider2)} (2e prestataire) a déjà une mission qui chevauche ${missionForm.startTime}–${missionForm.endTime} le ${dateStr}.`);
                    }
                }

                await addMission({
                    id: '', // Context will handle ID generation (or UUID)
                    date: dateStr,
                    startTime: missionForm.startTime,
                    endTime: missionForm.endTime,
                    duration: parseFloat(duration.toFixed(2)),
                    clientId: client.id,
                    clientName: client.name,
                    service: missionForm.service,
                    providerId: provider ? provider.id : null,
                    providerName: provider ? getProviderDisplayName(provider) : 'À assigner',
                    provider2Id: provider2 ? provider2.id : null,
                    provider2Name: provider2 ? getProviderDisplayName(provider2) : undefined,
                    status: 'planned',
                    color: provider ? 'orange' : 'gray',
                    sourceDocumentId: missionForm.sourceDocumentId || undefined,
                    isOvertime: isOvertimeMode
                });
            }

            toast.success(count > 1 ? `${count} missions planifiées !` : 'Mission ajoutée avec succès !');
            buttonPress();

            // Refresh data to get real IDs from DB for the newly created missions
            if (refreshData) await refreshData();

            setIsModalOpen(false);
            setMissionForm(initialFormState); // Reset form cleanly
            setSelectedSlotKey(''); // --- GRAFTED: Reset slot selection ---

        } catch (error: any) {
            console.error("Erreur planning", error);
            toast.error(error.message || 'Une erreur est survenue lors de la planification');
        } finally {
            submitLockRef.current = false;
            setIsSubmitting(false); // CRITICAL: Always reset submitting state
        }
    };

    const handleQuickPlanSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (submitLockRef.current) return;
        submitLockRef.current = true;

        if (isSubmitting) return;
        setIsSubmitting(true);
        try {
            const client = clients.find(c => c.id === quickPlanForm.clientId);
            if (!client) throw new Error('Client invalide');

            let duration = calculateDuration(quickPlanForm.date, quickPlanForm.startTime, quickPlanForm.date, quickPlanForm.endTime);
            if (duration <= 0) throw new Error("L'heure de fin doit être après l'heure de début");

            await addMission({
                id: '',
                date: quickPlanForm.date,
                startTime: quickPlanForm.startTime,
                endTime: quickPlanForm.endTime,
                duration: parseFloat(duration.toFixed(2)),
                clientId: client.id,
                clientName: client.name,
                service: 'Prestation manuelle',
                providerId: null,
                providerName: 'À assigner',
                status: 'planned',
                color: 'gray'
            });

            if (refreshData) await refreshData();

            toast.success('Prestation ajoutée !');
            buttonPress();
            setIsQuickPlanModalOpen(false);
            setQuickPlanForm({ clientId: '', date: getMartiniqueToday(), startTime: '09:00', endTime: '11:00' });
        } catch (error: any) {
            console.error('Erreur planification rapide', error);
            toast.error(error?.message || 'Erreur planification rapide');
            hapticError();
        } finally {
            submitLockRef.current = false;
            setIsSubmitting(false);
        }
    };

    const handleReminderSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!reminderForm.text || !reminderForm.date) return;
        setIsSubmitting(true);
        try {
            await addReminder({
                id: '',
                text: reminderForm.text,
                date: reminderForm.date,
                notifyEmail: reminderForm.notifyEmail,
                completed: false
            });
            toast.success('Rappel ajouté à l\'agenda !');
            buttonPress();
            setIsReminderModalOpen(false);
            setReminderForm({ text: '', date: getMartiniqueToday(), notifyEmail: true });
        } catch (err) {
            console.error(err);
            toast.error('Erreur ajout rappel');
            hapticError();
        } finally {
            setIsSubmitting(false);
        }
    };

    // --- Devis signés du client sélectionné (pour liaison lors de la création) ---
    const clientSignedQuotes = useMemo(() => {
        if (!missionForm.clientId) return [];
        const quotes = documents.filter(d =>
            d.clientId === missionForm.clientId &&
            d.type === 'Devis' &&
            !isQuoteDraft(d) &&
            !isQuoteZeroAmount(d) &&
            (d.status === 'signed' || d.status === 'validated')
        );
        // Trier par date décroissante (le plus récent en premier)
        quotes.sort((a, b) => {
            const da = (a as any)?.signedAt || (a as any)?.created_at || '';
            const db = (b as any)?.signedAt || (b as any)?.created_at || '';
            return String(db).localeCompare(String(da));
        });
        return quotes;
    }, [missionForm.clientId, documents]);

    // Auto-sélectionner le dernier devis signé quand le client change
    useEffect(() => {
        if (clientSignedQuotes.length > 0 && !missionForm.sourceDocumentId) {
            const latest = clientSignedQuotes[0];
            setMissionForm(prev => ({
                ...prev,
                sourceDocumentId: latest.id,
                service: latest.serviceType || latest.description || prev.service
            }));
        }
    }, [missionForm.clientId, clientSignedQuotes]);

    // Liste des prestataires incluant le prestataire externe fictif
    const providersWithExternal = useMemo(() => {
        return [...providers, EXTERNAL_PROVIDER];
    }, [providers]);


    // Get the specific reason why a provider is unavailable
    const getProviderUnavailableReason = (providerId: string, dateStr: string, startTime: string = '00:00', endTime: string = '23:59', excludeMissionId?: string): string | null => {
        // Le prestataire externe est toujours disponible
        if (providerId === EXTERNAL_PROVIDER_ID) return null;
        const provider = providers.find(p => p.id === providerId);
        if (!provider) return 'Prestataire introuvable';

        // Check non-working day
        if (isProviderNonWorkingDay(providerId, dateStr)) {
            return 'Ne travaille pas ce jour';
        }

        const missionStart = new Date(`${dateStr}T${startTime}`);
        const missionEnd = new Date(`${dateStr}T${endTime}`);

        // Check for conflicts with existing missions (as provider1 OR provider2)
        const conflictingMissions = missions.filter(m => {
            if (m.status === 'cancelled' || !m.date || !m.startTime || !m.endTime) return false;
            const matchesP1 = m.providerId === providerId;
            const matchesP2 = m.provider2Id === providerId;
            if (!matchesP1 && !matchesP2) return false;
            if (excludeMissionId && m.id === excludeMissionId) return false;
            const mStart = dayjs.tz(`${m.date} ${m.startTime}`, 'YYYY-MM-DD HH:mm', MARTINIQUE_TIMEZONE);
            const mEnd = dayjs.tz(`${m.date} ${m.endTime}`, 'YYYY-MM-DD HH:mm', MARTINIQUE_TIMEZONE);
            if (!mStart.isValid() || !mEnd.isValid()) return false;
            const slotStart = dayjs.tz(`${dateStr} ${startTime}`, 'YYYY-MM-DD HH:mm', MARTINIQUE_TIMEZONE);
            const slotEnd = dayjs.tz(`${dateStr} ${endTime}`, 'YYYY-MM-DD HH:mm', MARTINIQUE_TIMEZONE);
            return (slotStart.valueOf() < mEnd.valueOf() && slotEnd.valueOf() > mStart.valueOf());
        });

        if (conflictingMissions.length > 0) {
            return 'Déjà assigné à une mission sur ce créneau';
        }

        // Check for leaves
        for (const leave of (provider.leaves || [])) {
            if (leave.status === 'rejected') continue;

            const lStartTime = leave.startTime || '00:00';
            const lEndTime = leave.endTime || '23:59';
            const leaveStart = new Date(`${leave.startDate}T${lStartTime}`);
            const leaveEnd = new Date(`${leave.endDate}T${lEndTime}`);

            if (missionStart < leaveEnd && missionEnd > leaveStart) {
                return 'En congé';
            }
        }

        // Check non-working hours
        if (isProviderNonWorkingHours(providerId, dateStr, startTime, endTime)) {
            return 'Hors plage horaire de travail';
        }

        return null;
    };

    const isProviderAvailable = (providerId: string, dateStr: string, startTime: string = '00:00', endTime: string = '23:59', excludeMissionId?: string) => {
        return getProviderUnavailableReason(providerId, dateStr, startTime, endTime, excludeMissionId) === null;
    };

    // Get service type from mission by finding its source document (quote)
    const getMissionServiceType = (mission: Mission): string => {
        if (!mission.sourceDocumentId) return '';
        const doc = documents.find(d => d.id === mission.sourceDocumentId);
        return doc?.serviceType || doc?.description || '';
    };

    // Find providers whose specialty matches the service type
    const findProvidersByServiceType = (serviceType: string): Provider[] => {
        if (!serviceType) return providers.filter(p => p?.status === 'Active');
        const normalizedService = serviceType.toLowerCase();
        return providers.filter(p => {
            if (p?.status !== 'Active') return false;
            if (!p.specialty) return true; // If no specialty defined, consider compatible
            const normalizedSpecialty = p.specialty.toLowerCase();
            // Check if service type is contained in specialty or vice versa
            return normalizedSpecialty.includes(normalizedService) ||
                normalizedService.includes(normalizedSpecialty);
        });
    };

    // Check if any provider with matching specialty is available for a slot
    const hasAvailableProviderForService = (dateStr: string, startTime: string, endTime: string, serviceType: string, excludeMissionId?: string): { hasAvailable: boolean; compatibleProviders: Provider[]; availableCount: number } => {
        const compatibleProviders = findProvidersByServiceType(serviceType);
        if (compatibleProviders.length === 0) {
            return { hasAvailable: false, compatibleProviders: [], availableCount: 0 };
        }

        let availableCount = 0;
        for (const provider of compatibleProviders) {
            if (isProviderAvailable(provider.id, dateStr, startTime, endTime, excludeMissionId)) {
                availableCount++;
            }
        }

        return {
            hasAvailable: availableCount > 0,
            compatibleProviders,
            availableCount
        };
    };

    // Helper: nom complet sécurisé d'un prestataire
    const getProviderDisplayName = (p: any): string => {
        if (!p) return '';
        const first = p.firstName || p.first_name || '';
        const last = p.lastName || p.last_name || '';
        return `${first} ${last}`.trim() || 'Prestataire';
    };

    const handleAssignMission = async () => {
        if (!selectedMissionId || !assignProviderId) {
            toast.warning('Veuillez sélectionner une mission et un prestataire.');
            hapticError();
            return;
        }

        const isExternal = assignProviderId === EXTERNAL_PROVIDER_ID;
        const provider = isExternal ? EXTERNAL_PROVIDER : providers.find(p => p.id === assignProviderId);
        const mission = missions.find(m => m.id === selectedMissionId) || (unassignedMissions as any[]).find(m => m.id === selectedMissionId) || (filteredProvisionalMissions as any[]).find(p => p.id === selectedMissionId);

        if (!mission || !provider) {
            toast.error('Mission ou prestataire introuvable.');
            return;
        }

        // Check if provider is available (ignored in overtime mode or external)
        if (!assignIsOvertime && !isExternal && !isProviderAvailable(provider.id, mission.date, mission.startTime, mission.endTime, mission.id)) {
            toast.error(`${getProviderDisplayName(provider)} n'est pas disponible sur ce créneau (conflit avec une autre mission ou indisponibilité).`);
            hapticError();
            return;
        }

        setIsSubmitting(true);
        try {
            const isRealInState = missions.some(m => m.id === mission.id);
            if (isRealInState) {
                await assignProvider(mission.id, provider.id, getProviderDisplayName(provider));
                if (assignIsOvertime) {
                    await updateMission(mission.id, { isOvertime: true });
                }
            } else {
                // Create the mission with assigned provider
                await addMission({
                    id: (mission.id && !mission.id.startsWith('provisional-')) ? mission.id : generateUUID(),
                    date: mission.date,
                    startTime: mission.startTime || '09:00',
                    endTime: mission.endTime || '12:00',
                    duration: typeof mission.duration === 'number' ? mission.duration : 3,
                    clientId: mission.clientId,
                    clientName: mission.clientName || 'Client',
                    service: mission.service || 'Prestation',
                    providerId: provider.id,
                    providerName: getProviderDisplayName(provider),
                    status: 'planned',
                    color: 'gray',
                    source: 'devis',
                    sourceDocumentId: mission.sourceDocumentId,
                    isOvertime: assignIsOvertime
                });
            }
            toast.success(`Prestataire assigné${isExternal ? ' (externe)' : ' ! Email envoyé.'}`);
            success();
            if (refreshData) await refreshData();

            setSelectedMissionId(null);
            setAssignProviderId('');
            setAssignSecondProviderSelect('');
            setAssignIsOvertime(false);
        } catch (error: any) {
            toast.error(error?.message || 'Erreur lors de l\'assignation.');
            hapticError();
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleConfirmAssignment = async () => {
        if (!selectedMissionId || !assignProviderId) return;

        const isExternal1 = assignProviderId === EXTERNAL_PROVIDER_ID;
        const provider = isExternal1 ? EXTERNAL_PROVIDER : providers.find(p => p.id === assignProviderId);
        const isExternal2 = assignSecondProviderSelect === EXTERNAL_PROVIDER_ID;
        const provider2 = assignSecondProviderSelect
            ? (isExternal2 ? EXTERNAL_PROVIDER : providers.find(p => p.id === assignSecondProviderSelect) ?? null)
            : null;
        const mission = missions.find(m => m.id === selectedMissionId) || (unassignedMissions as any[]).find(m => m.id === selectedMissionId) || (filteredProvisionalMissions as any[]).find(p => p.id === selectedMissionId);

        if (!mission || !provider) {
            toast.error('Mission ou prestataire introuvable.');
            return;
        }

        if (isSubmitting) return;

        const isOvertimeMode = assignIsOvertime;

        // Check if 1st provider is available (ignored in overtime or external)
        if (!isOvertimeMode && !isExternal1 && !isProviderAvailable(provider.id, mission.date, mission.startTime, mission.endTime, mission.id)) {
            toast.warning(`Impossible de programmer ${getProviderDisplayName(provider)} : indisponible ou conflit avec une autre mission.`);
            return;
        }

        // Check if 2nd provider is available (if selected, ignored in overtime or external)
        if (provider2 && !isOvertimeMode && !isExternal2) {
            if (!isProviderAvailable(provider2.id, mission.date, mission.startTime, mission.endTime, mission.id)) {
                toast.warning(`Impossible de programmer ${getProviderDisplayName(provider2)} (2e prestataire) : indisponible ou conflit avec une autre mission.`);
                return;
            }
        }

        setIsSubmitting(true);
        try {
            const isRealInState = missions.some(m => m.id === mission.id);
            if (isRealInState) {
                // Assigner le 1er prestataire
                await assignProvider(mission.id, provider.id, getProviderDisplayName(provider));

                // Marquer comme heures supplémentaires si coché
                if (isOvertimeMode) {
                    await updateMission(mission.id, { isOvertime: true });
                }

                // Assigner le 2e prestataire si sélectionné
                if (provider2) {
                    await assignSecondProvider(mission.id, provider2.id, getProviderDisplayName(provider2));
                    toast.success(`Binôme assigné : ${getProviderDisplayName(provider)} + ${getProviderDisplayName(provider2)} !${isOvertimeMode ? ' (Heures sup.)' : ' Emails envoyés.'}`);
                } else {
                    toast.success(`Prestataire assigné${isExternal1 ? ' (externe)' : ''} !${isOvertimeMode ? ' (Heures sup.)' : ' Email envoyé.'}`);
                }
            } else {
                // Create the mission directly with provider(s)
                await addMission({
                    id: (mission.id && !mission.id.startsWith('provisional-')) ? mission.id : generateUUID(),
                    date: mission.date,
                    startTime: mission.startTime || '09:00',
                    endTime: mission.endTime || '12:00',
                    duration: typeof mission.duration === 'number' ? mission.duration : 3,
                    clientId: mission.clientId,
                    clientName: mission.clientName || 'Client',
                    service: mission.service || 'Prestation',
                    providerId: provider.id,
                    providerName: getProviderDisplayName(provider),
                    provider2Id: provider2 ? provider2.id : undefined,
                    provider2Name: provider2 ? getProviderDisplayName(provider2) : undefined,
                    status: 'planned',
                    color: 'gray',
                    source: 'devis',
                    sourceDocumentId: mission.sourceDocumentId,
                    isOvertime: isOvertimeMode
                });
                toast.success(`Mission créée et prestataire assigné avec succès !`);
            }
            success();
            if (refreshData) await refreshData();

            // Reset states => closes modal
            setSelectedMissionId(null);
            setAssignProviderId('');
            setAssignSecondProviderSelect('');
            setAssignIsOvertime(false);
        } catch (error: any) {
            toast.error(error?.message || 'Erreur lors de l\'assignation.');
            hapticError();
        } finally {
            setIsSubmitting(false);
        }
    };

    // BULK DELETE
    const toggleMissionSelection = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const newSet = new Set(selectedMissionIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedMissionIds(newSet);
    };

    // Mission Details Modal
    const [selectedMissionDetails, setSelectedMissionDetails] = useState<Mission | null>(null);
    const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

    const [isEditMissionModalOpen, setIsEditMissionModalOpen] = useState(false);
    const [editMissionForm, setEditMissionForm] = useState({
        providerId: '',
        date: '',
        startTime: '09:00',
        endTime: '11:00',
        service: '',
        status: 'planned' as Mission['status']
    });
    const [editMissionOriginalProviderId, setEditMissionOriginalProviderId] = useState<string>('');

    // State for warning modal when no provider available
    const [isNoProviderWarningOpen, setIsNoProviderWarningOpen] = useState(false);
    const [noProviderWarningData, setNoProviderWarningData] = useState<{
        missionId: string;
        nextDate: string;
        nextStart: string;
        nextEnd: string;
        serviceType: string;
        compatibleCount: number;
    } | null>(null);

    const [isProvisionalDetailsModalOpen, setIsProvisionalDetailsModalOpen] = useState(false);
    const [selectedProvisionalDetails, setSelectedProvisionalDetails] = useState<any>(null);

    const detailClient = selectedMissionDetails?.clientId ? clients.find(c => c.id === selectedMissionDetails.clientId) : undefined;

    const handleMissionClick = async (mission: Mission, e: React.MouseEvent) => {
        if (!e.shiftKey && !e.ctrlKey && !e.metaKey) {
            setSelectedMissionDetails(mission);
            setIsDetailsModalOpen(true);

            if (getMissionDetails) {
                try {
                    const fullDetails = await getMissionDetails(mission.id);
                    if (fullDetails) {
                        setSelectedMissionDetails(fullDetails);
                    }
                } catch (err) {
                    console.error("Failed to load mission details", err);
                }
            }
        }
    };

    const openEditMissionModal = () => {
        if (!selectedMissionDetails) return;

        const providerIdValue = selectedMissionDetails.providerId ? String(selectedMissionDetails.providerId) : '';
        setEditMissionOriginalProviderId(providerIdValue);
        setEditMissionForm({
            providerId: providerIdValue,
            date: selectedMissionDetails.date || getMartiniqueToday(),
            startTime: selectedMissionDetails.startTime || '09:00',
            endTime: selectedMissionDetails.endTime || '11:00',
            service: selectedMissionDetails.service || '',
            status: selectedMissionDetails.status || 'planned'
        });
        setIsEditMissionModalOpen(true);
    };

    // Handle force continue when no provider available
    const handleForceContinueEdit = async () => {
        if (!noProviderWarningData || !selectedMissionDetails) return;
        setIsNoProviderWarningOpen(false);

        setIsSubmitting(true);
        try {
            const { missionId, nextDate, nextStart, nextEnd } = noProviderWarningData;
            const nextProviderId = editMissionForm.providerId || '';
            const nextProvider = nextProviderId ? providers.find(p => p.id === nextProviderId) : undefined;

            // Apply date/time changes
            await updateMission(missionId, {
                date: nextDate,
                startTime: nextStart,
                endTime: nextEnd,
                service: editMissionForm.service,
                status: editMissionForm.status
            });

            // Handle provider change if needed
            if (nextProviderId !== editMissionOriginalProviderId) {
                if (!nextProviderId) {
                    await updateMission(missionId, {
                        providerId: null,
                        providerName: 'À assigner',
                        status: 'planned',
                        color: 'gray'
                    });
                } else if (nextProvider) {
                    await assignProvider(missionId, nextProvider.id, getProviderDisplayName(nextProvider));
                }
            }

            if (refreshData) await refreshData();
            toast.success('Mission modifiée (sans prestataire disponible pour ce type de service).');
            buttonPress();
            setIsEditMissionModalOpen(false);
            setNoProviderWarningData(null);
        } catch (error: any) {
            console.error('[editMission] error:', error);
            toast.error(error?.message || 'Erreur lors de la modification');
            hapticError();
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleEditMissionSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedMissionDetails) return;
        if (isSubmitting) return;

        try {
            const missionId = selectedMissionDetails.id;
            const nextDate = editMissionForm.date;
            const nextStart = editMissionForm.startTime;
            const nextEnd = editMissionForm.endTime;

            const scheduleChanged =
                String(nextDate || '') !== String(selectedMissionDetails.date || '') ||
                String(nextStart || '') !== String(selectedMissionDetails.startTime || '') ||
                String(nextEnd || '') !== String(selectedMissionDetails.endTime || '');

            const duration = calculateDuration(nextDate, nextStart, nextDate, nextEnd);
            if (scheduleChanged && (!duration || duration <= 0)) {
                throw new Error("L'heure de fin doit être après l'heure de début");
            }

            const nextProviderId = editMissionForm.providerId || '';
            const nextProvider = nextProviderId ? providers.find(p => p.id === nextProviderId) : undefined;

            // Si on garde un prestataire (ou on en met un), vérifier qu'il travaille ce jour-là
            if (nextProvider && isProviderNonWorkingDay(nextProvider.id, nextDate)) {
                throw new Error(`Impossible de programmer ${getProviderDisplayName(nextProvider)} le ${nextDate} : ne travaille pas aujourd'hui.`);
            }

            // Check if any provider with matching specialty is available for this slot
            if (scheduleChanged) {
                const serviceType = getMissionServiceType(selectedMissionDetails);
                const { hasAvailable, compatibleProviders, availableCount } = hasAvailableProviderForService(
                    nextDate, nextStart, nextEnd, serviceType, missionId
                );

                if (!hasAvailable) {
                    // Show warning modal - no provider available for this service type
                    setNoProviderWarningData({
                        missionId,
                        nextDate,
                        nextStart,
                        nextEnd,
                        serviceType,
                        compatibleCount: compatibleProviders.length
                    });
                    setIsNoProviderWarningOpen(true);
                    return; // Stop here, user must choose to continue or cancel
                }
            }

            setIsSubmitting(true);

            // 1) Si date/heure changent, appliquer directement sans confirmation client
            if (scheduleChanged) {
                await updateMission(missionId, {
                    date: nextDate,
                    startTime: nextStart,
                    endTime: nextEnd
                });
            }

            // 2) Mettre à jour les champs autorisés immédiatement (service/statut)
            await updateMission(missionId, {
                service: editMissionForm.service,
                status: editMissionForm.status
            });

            // 2) Si le prestataire change, réutiliser la logique existante (emails/notifs)
            if (nextProviderId !== editMissionOriginalProviderId) {
                if (!nextProviderId) {
                    await updateMission(missionId, {
                        providerId: null,
                        providerName: 'À assigner',
                        status: 'planned',
                        color: 'gray'
                    });
                } else if (nextProvider) {
                    // Check for conflicts before assigning new provider
                    if (!isProviderAvailable(nextProvider.id, nextDate, nextStart, nextEnd, missionId)) {
                        throw new Error(`${getProviderDisplayName(nextProvider)} n'est pas disponible sur ce créneau (conflit avec une autre mission ou indisponibilité).`);
                    }
                    await assignProvider(missionId, nextProvider.id, getProviderDisplayName(nextProvider));
                }
            }

            if (refreshData) await refreshData();

            toast.success(scheduleChanged ? 'Mission modifiée avec succès (date/heure mise à jour).' : 'Mission modifiée avec succès !');
            buttonPress();
            setIsEditMissionModalOpen(false);
        } catch (error: any) {
            console.error('[editMission] error:', error);
            toast.error(error?.message || 'Erreur lors de la modification');
            hapticError();
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleProvisionalMissionClick = (item: any, e: React.MouseEvent) => {
        if (!e.shiftKey && !e.ctrlKey && !e.metaKey) {
            const missionLike: Mission = {
                id: item.id || `provisional-${Date.now()}`,
                clientId: item.clientId || '',
                clientName: item.clientName || 'Client',
                providerId: item.providerId || null,
                providerName: item.providerName || 'À assigner',
                service: item.service || 'Prestation',
                date: item.date || getMartiniqueToday(),
                startTime: item.startTime || '09:00',
                endTime: item.endTime || '12:00',
                duration: typeof item.duration === 'number' ? item.duration : 3,
                status: item.status || 'planned',
                color: 'orange',
                sourceDocumentId: item.sourceDocumentId,
                source: 'devis'
            };
            setSelectedMissionDetails(missionLike);
            setIsDetailsModalOpen(true);
        }
    };

    const confirmBulkDeleteMissions = () => {
        if (selectedMissionIds.size > 0) {
            setDeleteConfirmOpen(true);
        }
    };

    const executeBulkDeleteMissions = async () => {
        await deleteMissions(Array.from(selectedMissionIds));
        setSelectedMissionIds(new Set());
        setDeleteConfirmOpen(false);
        if (refreshData) await refreshData();
        toast.success('Missions supprimées de la base de données.');
        buttonPress();
    };

    const handleCopyMissionDetails = async () => {
        if (!selectedMissionDetails) return;

        const mission = selectedMissionDetails;
        const client = detailClient;
        const formattedDate = mission.date
            ? dayjs.tz(mission.date, 'YYYY-MM-DD', MARTINIQUE_TIMEZONE).format('DD/MM/YYYY')
            : '—';

        const fullAddress = client?.address
            ? `${client.address}${client.city ? ', ' + client.city : ''}`
            : (client?.city || '—');

        const info = [
            `Mission: ${mission.service || '—'}`,
            `Date: ${formattedDate}`,
            `Horaires: ${mission.startTime || '—'} - ${mission.endTime || '—'}`,
            `Durée: ${mission.duration ? `${mission.duration}h` : '—'}`,
            `Client: ${client?.name || mission.clientName || '—'}`,
            `Téléphone client: ${client?.phone || '—'}`,
            `Adresse: ${fullAddress}`,
            `Prestataire: ${mission.providerName || 'À assigner'}${mission.provider2Name ? ` + ${mission.provider2Name} (binôme)` : ''}`,
            `Devis source: ${mission.sourceDocumentId || '—'}`
        ].join('\n');

        try {
            if (typeof navigator !== 'undefined' && navigator?.clipboard?.writeText) {
                await navigator.clipboard.writeText(info);
                toast.success('Informations mission copiées dans le presse-papiers.');
                buttonPress();
            } else {
                throw new Error('Clipboard API non disponible');
            }
        } catch (err) {
            console.error('[copyMissionDetails] error:', err);
            toast.error('Impossible de copier les informations.');
            hapticError();
        }
    };

    const unassignedMissions = useMemo<Mission[]>(() => {
        const realUnassigned = validMissions.filter(m => (!m.providerId || m.providerId === 'null') && m.status !== 'cancelled');
        const provUnassigned: Mission[] = filteredProvisionalMissions.map((p: any) => ({
            id: p.id,
            date: p.date,
            startTime: p.startTime,
            endTime: p.endTime,
            duration: p.duration,
            service: p.service,
            clientId: p.clientId,
            clientName: p.clientName,
            providerId: '',
            providerName: 'À assigner',
            status: 'planned' as const,
            color: 'gray',
            sourceDocumentId: p.sourceDocumentId,
            isProvisional: true,
            quoteRef: p.quoteRef,
            isSignedQuote: p.isSignedQuote
        } as any));
        return [...realUnassigned, ...provUnassigned];
    }, [validMissions, filteredProvisionalMissions]);

    // Actions & Missions filters
    const [unassignedFilterName, setUnassignedFilterName] = useState('');
    const [unassignedFilterPack, setUnassignedFilterPack] = useState('all');

    const filteredUnassignedMissions = useMemo(() => {
        let filtered = unassignedMissions;

        // Filter by client name
        if (unassignedFilterName.trim()) {
            const query = unassignedFilterName.toLowerCase();
            filtered = filtered.filter(m => m.clientName.toLowerCase().includes(query));
        }

        // Filter by pack (service type)
        if (unassignedFilterPack !== 'all') {
            filtered = filtered.filter(m => {
                const client = clients.find(c => c.id === m.clientId);
                return client?.pack === unassignedFilterPack;
            });
        }

        return filtered;
    }, [unassignedMissions, unassignedFilterName, unassignedFilterPack, clients]);
    const missionToAssign = unassignedMissions.find(m => m.id === selectedMissionId) || missions.find(m => m.id === selectedMissionId);

    const getDayIndex = (dateStr: string) => {
        const d = dayjs.tz(dateStr, 'YYYY-MM-DD', MARTINIQUE_TIMEZONE);
        const day = d.day();
        return day === 0 ? 5 : day - 1; // Correct mapping for Monday start
    };

    // Interaction Handlers for Stats Cards - Navigating to Statistics Page with Filters
    const handleStatClick = (filter: 'planned' | 'completed' | 'all', time: 'day' | 'week') => {
        navigate('/statistics', { state: { filter, time } });
    };

    const getMissionPlanningStyle = (mission: Mission): { container: string; border: string; label: string; borderColor: string; statusCls: string } => {
        const isUnassigned = (!mission.providerId || mission.providerId === 'null') && mission.status !== 'cancelled';
        const isSignedFromQuote = mission.source === 'devis' && mission.status !== 'cancelled';
        const hasBinome = !!mission.provider2Id;

        if (mission.status === 'completed') {
            return { container: 'bg-green-100 text-slate-800', border: 'border-green-500', label: hasBinome ? 'Binôme terminée' : 'Terminée', borderColor: '#22c55e', statusCls: 'bg-green-100 text-green-700' };
        }
        if (mission.status === 'cancelled') {
            return { container: 'bg-slate-100 text-slate-600 opacity-60', border: 'border-slate-300', label: 'Annulée', borderColor: '#cbd5e1', statusCls: 'bg-slate-100 text-slate-500' };
        }
        if (mission.status === 'in_progress') {
            return { container: 'bg-blue-100 text-slate-800', border: 'border-blue-600', label: hasBinome ? 'Binôme en cours' : 'En cours', borderColor: '#2563eb', statusCls: 'bg-blue-100 text-blue-700' };
        }
        if (isUnassigned) {
            return { container: 'bg-red-50 text-slate-800', border: 'border-red-500', label: 'Non assignée', borderColor: '#ef4444', statusCls: 'bg-red-100 text-red-700' };
        }
        if (isSignedFromQuote) {
            return { container: 'bg-purple-100 text-slate-800', border: 'border-purple-500', label: hasBinome ? 'Binôme (devis signé)' : 'Devis signé', borderColor: '#a855f7', statusCls: 'bg-purple-100 text-purple-700' };
        }
        if (hasBinome) {
            return { container: 'bg-violet-50 text-slate-800', border: 'border-violet-500', label: 'Binôme', borderColor: '#8b5cf6', statusCls: 'bg-violet-100 text-violet-700' };
        }
        return { container: 'bg-blue-50 text-slate-800', border: 'border-brand-blue', label: 'Assignée', borderColor: '#006699', statusCls: 'bg-blue-50 text-blue-700' };
    };

    const normalizeCommune = (value: string): string => {
        const v = String(value || '').trim();
        if (!v) return '';
        return v.replace(/bassin\s*pointe/ig, 'Basse-Pointe');
    };

    const applyStatsFilter = (scope: 'day-planned' | 'week-all' | 'week-completed') => {
        if (scope === 'day-planned') {
            const d = getMartiniqueToday();
            setCustomDateRange(true);
            setStartDate(d);
            setEndDate(d);
            setSelectedStatus('planned');
        } else if (scope === 'week-all') {
            setCustomDateRange(false);
            setStartDate('');
            setEndDate('');
            setSelectedStatus('all');
        } else if (scope === 'week-completed') {
            setCustomDateRange(false);
            setStartDate('');
            setEndDate('');
            setSelectedStatus('completed');
        }
        setIsStatsModalOpen(false);
    };

    return dataLoading ? <PageLoader /> : (
        <>
            <style>{`
        @media print {
          .no-print { display: none !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
            <div className="p-4 md:p-8 h-[100svh] md:h-full overflow-hidden md:overflow-y-auto bg-white/40 flex flex-col relative no-print">

                {isMobileActionsOpen && (
                    <div className="fixed inset-0 z-50 flex items-end md:hidden bg-slate-900/60 backdrop-blur-sm">
                        <div className="bg-white w-full rounded-t-2xl shadow-2xl overflow-hidden max-h-[85svh] flex flex-col">
                            <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50">
                                <div className="font-bold text-slate-800">Actions & Missions</div>
                                <button
                                    type="button"
                                    onClick={() => setIsMobileActionsOpen(false)}
                                    className="p-2 hover:bg-slate-200 rounded-full transition"
                                >
                                    <X className="w-5 h-5 text-slate-600" />
                                </button>
                            </div>
                            <div className="p-3 space-y-2 overflow-y-auto">
                                <button
                                    onClick={() => { setIsReminderModalOpen(true); setReminderForm({ text: '', date: getMartiniqueToday(), notifyEmail: true }); setIsMobileActionsOpen(false); }}
                                    className="w-full bg-yellow-100 text-yellow-800 py-2 rounded font-bold text-xs hover:bg-yellow-200 flex items-center justify-center gap-2 mb-2 border border-yellow-200"
                                >
                                    <Flag className="w-3 h-3" /> Ajouter un Rappel
                                </button>

                                {/* Mobile filters for unassigned missions */}
                                <div className="space-y-1.5 mb-2 pb-2 border-b border-slate-200">
                                    <div>
                                        <label className="text-[9px] font-bold text-slate-500 uppercase">Nom</label>
                                        <input
                                            type="text"
                                            placeholder="Filtrer..."
                                            value={unassignedFilterName}
                                            onChange={(e) => setUnassignedFilterName(e.target.value)}
                                            className="w-full px-1.5 py-1 text-[10px] border border-slate-300 rounded focus:outline-none focus:border-brand-blue leading-tight"
                                        />
                                    </div>
                                </div>

                                <div className="bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3">
                                    <div className="text-xs font-bold text-slate-700 mb-2">Légende</div>
                                    <div className="grid grid-cols-2 gap-2 text-xs font-semibold text-slate-700">
                                        <div className="flex items-center gap-2">
                                            <span className="w-3 h-3 rounded-full bg-orange-400"></span>
                                            En attente de validation
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="w-3 h-3 rounded-full bg-brand-blue"></span>
                                            Assignée
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="w-3 h-3 rounded-full bg-red-500"></span>
                                            Non assignée
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="w-3 h-3 rounded-full bg-purple-500"></span>
                                            Devis signé
                                        </div>
                                    </div>
                                </div>

                                {filteredUnassignedMissions.length === 0 ? (
                                    <p className="text-center text-xs text-slate-400 italic mt-4">Toutes les missions sont assignées.</p>
                                ) : (
                                    <>
                                        <div className="text-xs text-slate-500 font-bold mb-2">
                                            {filteredUnassignedMissions.length} mission{filteredUnassignedMissions.length > 1 ? 's' : ''} à assigner
                                        </div>
                                        {filteredUnassignedMissions.map(m => {
                                            const client = clients.find(c => c.id === m.clientId);
                                            return (
                                                <div key={m.id} className="bg-red-50 border border-red-100 p-2 rounded cursor-pointer hover:bg-red-100 shrink-0">
                                                    <p className="font-bold text-xs text-red-800 truncate">{m.clientName}</p>
                                                    <p className="text-[10px] text-red-600 truncate">{m.date} | {m.startTime} - {m.endTime} | {client?.city || 'Ville non spécifiée'}</p>
                                                    <button onClick={() => { setSelectedMissionId(m.id); setIsMobileActionsOpen(false); }} className="mt-1 w-full bg-red-200 text-red-800 text-[10px] font-bold rounded px-1 hover:bg-red-300">Assigner</button>
                                                </div>
                                            );
                                        })}
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* ===== MOBILE COMPACT TOOLBAR ===== */}
                <div className="md:hidden flex items-center justify-between gap-2 mb-2 bg-white/90 backdrop-blur-sm sticky top-0 z-20 py-2 px-1 -mx-1 border-b border-slate-100">
                    <div className="flex items-center gap-2 min-w-0">
                        <h2 className="text-lg font-serif font-bold text-slate-800 shrink-0">Planning</h2>
                        <span className="text-[11px] font-bold text-slate-500 truncate">{dateRangeString}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                        <button
                            type="button"
                            onClick={() => { setIsModalOpen(true); setSelectedSlotKey(''); }}
                            className="w-9 h-9 rounded-full bg-brand-blue text-white flex items-center justify-center shadow-sm active:scale-95 transition"
                            aria-label="Nouvelle mission"
                        >
                            <Plus className="w-4 h-4" />
                        </button>
                        <button
                            type="button"
                            onClick={() => setShowMobileToolbar(true)}
                            className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200 text-slate-600 flex items-center justify-center active:scale-95 transition"
                            aria-label="Outils et filtres"
                        >
                            <SlidersHorizontal className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* ===== MOBILE TOOLBAR POPUP ===== */}
                {showMobileToolbar && (
                    <div className="md:hidden fixed inset-0 z-50 flex items-end bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowMobileToolbar(false)}>
                        <div className="bg-white w-full rounded-t-2xl shadow-2xl max-h-[88svh] flex flex-col animate-in slide-in-from-bottom duration-200" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center justify-between p-4 border-b border-slate-100 shrink-0">
                                <h3 className="font-bold text-lg text-slate-800">Outils Planning</h3>
                                <button onClick={() => setShowMobileToolbar(false)} className="p-2 rounded-full hover:bg-slate-100 transition">
                                    <X className="w-5 h-5 text-slate-500" />
                                </button>
                            </div>
                            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                                {/* Navigation */}
                                <div>
                                    <p className="text-xs font-bold text-slate-500 mb-2 uppercase tracking-wide">Navigation</p>
                                    <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl">
                                        <button onClick={handlePrevWeek} className="flex-1 bg-[#006699] text-white py-2.5 rounded-lg text-sm font-bold flex items-center justify-center gap-1 active:scale-95 transition">
                                            <ChevronLeft className="w-4 h-4" /> Préc.
                                        </button>
                                        <button onClick={handleCurrentWeek} className="flex-1 bg-[#66BB44] text-white py-2.5 rounded-lg text-sm font-bold active:scale-95 transition">
                                            Aujourd'hui
                                        </button>
                                        <button onClick={handleNextWeek} className="flex-1 bg-[#006699] text-white py-2.5 rounded-lg text-sm font-bold flex items-center justify-center gap-1 active:scale-95 transition">
                                            Suiv. <ChevronRight className="w-4 h-4" />
                                        </button>
                                    </div>
                                    <p className="text-center text-xs text-slate-500 mt-2 font-bold">{dateRangeString}</p>
                                </div>

                                {/* Actions rapides */}
                                <div>
                                    <p className="text-xs font-bold text-slate-500 mb-2 uppercase tracking-wide">Actions</p>
                                    <div className="grid grid-cols-2 gap-2">
                                        <button onClick={() => { setIsStatsModalOpen(true); setShowMobileToolbar(false); }} className="flex items-center gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 active:bg-slate-100">
                                            <FileText className="w-4 h-4 text-slate-500" /> Statistiques
                                        </button>
                                        <button onClick={() => { navigate('/provider-availability'); setShowMobileToolbar(false); }} className="flex items-center gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 active:bg-slate-100">
                                            <Users className="w-4 h-4 text-slate-500" /> Disponibilité
                                        </button>
                                        <button onClick={() => { setShowNotifications(v => !v); setShowMobileToolbar(false); }} className="flex items-center gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 active:bg-slate-100 relative">
                                            <Bell className="w-4 h-4 text-slate-500" /> Notifications
                                            {notificationsData.length > 0 && (
                                                <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center">
                                                    {notificationsData.length > 9 ? '9+' : notificationsData.length}
                                                </span>
                                            )}
                                        </button>
                                        <button onClick={() => { handlePrint(); setShowMobileToolbar(false); }} className="flex items-center gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 active:bg-slate-100">
                                            <Printer className="w-4 h-4 text-slate-500" /> Imprimer
                                        </button>
                                    </div>
                                </div>

                                {/* Filtres */}
                                <div>
                                    <p className="text-xs font-bold text-slate-500 mb-2 uppercase tracking-wide">Filtres</p>
                                    <div className="space-y-2">
                                        <div className="relative">
                                            <input type="text" placeholder="Rechercher..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-brand-blue" />
                                            <Search className="w-3 h-3 text-slate-400 absolute right-3 top-3.5" />
                                        </div>
                                        <SearchableSelect options={[{ value: 'all', label: 'Tous les prestataires' }, ...providers.filter(p => p?.status === 'Active').map(p => ({ value: getProviderDisplayName(p), label: getProviderDisplayName(p) }))]} value={selectedProvider} onChange={(value) => setSelectedProvider(value)} className="w-full" />
                                        <SearchableSelect options={[{ value: 'all', label: 'Tous les clients' }, ...clients.map(c => ({ value: c.name, label: c.name }))]} value={selectedClient} onChange={(value) => setSelectedClient(value)} className="w-full" />
                                        <SearchableSelect options={[{ value: 'all', label: 'Tous' }, { value: 'planned', label: 'Prévues' }, { value: 'in_progress', label: 'En cours' }, { value: 'completed', label: 'Terminées' }, { value: 'cancelled', label: 'Annulées' }]} value={selectedStatus} onChange={(value) => setSelectedStatus(value)} className="w-full" />
                                        <button onClick={() => { setCustomDateRange(!customDateRange); if (!customDateRange) { setStartDate(''); setEndDate(''); } }} className={`w-full px-3 py-2.5 rounded-lg text-sm font-bold transition ${customDateRange ? 'bg-brand-blue text-white' : 'bg-slate-100 text-slate-700'}`}>
                                            <Calendar className="w-3 h-3 inline mr-1" /> Plage personnalisée
                                        </button>
                                        {customDateRange && (
                                            <div className="flex items-center gap-2">
                                                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="flex-1 text-sm border border-slate-300 rounded-lg px-2 py-2" />
                                                <span className="text-xs text-slate-500">au</span>
                                                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="flex-1 text-sm border border-slate-300 rounded-lg px-2 py-2" />
                                            </div>
                                        )}
                                        <button onClick={() => { setSelectedProvider('all'); setSelectedClient('all'); setSelectedStatus('all'); setSearchQuery(''); setCustomDateRange(false); setStartDate(''); setEndDate(''); }} className="w-full px-3 py-2.5 bg-slate-100 text-slate-700 rounded-lg text-sm font-bold active:bg-slate-200">
                                            <RotateCcw className="w-3 h-3 inline mr-1" /> Réinitialiser
                                        </button>
                                    </div>
                                </div>

                                {/* Synthèse */}
                                <button onClick={() => { setShowDailySummary(true); setShowMobileToolbar(false); }} className="w-full flex items-center justify-between px-4 py-3 bg-gradient-to-r from-indigo-500 to-blue-600 text-white rounded-xl active:opacity-90 shadow-md">
                                    <div className="flex items-center gap-2">
                                        <Users className="w-4 h-4 text-white" />
                                        <span className="font-bold text-sm">Synthèse du {dayjs.tz(statsDate, 'YYYY-MM-DD', MARTINIQUE_TIMEZONE).format('DD/MM')}</span>
                                    </div>
                                    <ChevronRight className="w-4 h-4 text-indigo-200" />
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* ===== DESKTOP COMPACT TOOLBAR ===== */}
                {/* Mobile navigation (stays outside desktop wrapper) */}
                <div className="md:hidden flex items-center gap-2 mb-2">
                    <div className="flex-1 flex items-center justify-between bg-slate-200/50 p-1 rounded-full">
                        <button onClick={handlePrevWeek} className="bg-[#006699] text-white w-9 h-9 rounded-full flex items-center justify-center hover:bg-blue-800" title="Semaine précédente" aria-label="Semaine précédente">
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button onClick={handleCurrentWeek} className="bg-[#66BB44] text-white w-9 h-9 rounded-full flex items-center justify-center shadow-sm hover:bg-green-600" title="Semaine en cours" aria-label="Semaine en cours">
                            <Calendar className="w-4 h-4" />
                        </button>
                        <button onClick={handleNextWeek} className="bg-[#006699] text-white w-9 h-9 rounded-full flex items-center justify-center hover:bg-blue-800" title="Semaine suivante" aria-label="Semaine suivante">
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                    <button
                        type="button"
                        onClick={async () => {
                            clearAllMissionsCache();
                            toast.success('Cache vidé ! Rechargement...');
                            if (refreshData) await refreshData();
                        }}
                        className="w-9 h-9 rounded-full border border-slate-200 bg-white flex items-center justify-center hover:bg-slate-50 text-amber-600 transition"
                        title="Vider le cache"
                        aria-label="Vider le cache"
                    >
                        <RotateCcw className="w-4 h-4" />
                    </button>
                    <button onClick={() => setShowMobileFilters(v => !v)} className={`w-9 h-9 rounded-full border border-slate-200 bg-white flex items-center justify-center hover:bg-slate-50 transition ${showMobileFilters ? 'text-brand-blue' : 'text-slate-700'}`} title={showMobileFilters ? 'Masquer les filtres' : 'Afficher les filtres'} aria-label={showMobileFilters ? 'Masquer les filtres' : 'Afficher les filtres'}>
                        <SlidersHorizontal className="w-4 h-4" />
                    </button>
                </div>

                {/* Mobile filters panel */}
                {showMobileFilters && (
                    <div className="md:hidden bg-white rounded-xl border border-slate-200 shadow-sm p-3 mb-3 space-y-3 animate-in slide-in-from-top duration-200">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-bold text-slate-700">Filtres</h3>
                            <button type="button" onClick={() => { setSelectedProvider('all'); setSelectedClient('all'); setSelectedStatus('all'); setSearchQuery(''); setCustomDateRange(false); setStartDate(''); setEndDate(''); setShowMobileFilters(false); }} className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1 font-bold">
                                <RotateCcw className="w-3 h-3" /> Reset
                            </button>
                        </div>
                        <div className="relative">
                            <input type="text" placeholder="Rechercher..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand-blue" />
                            <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-2.5" />
                        </div>
                        <SearchableSelect options={[{ value: 'all', label: 'Tous les prestataires' }, ...providers.filter(p => p?.status === 'Active').map(p => ({ value: getProviderDisplayName(p), label: getProviderDisplayName(p) }))]} value={selectedProvider} onChange={(value) => setSelectedProvider(value)} className="w-full" />
                        <SearchableSelect options={[{ value: 'all', label: 'Tous les clients' }, ...clients.map(c => ({ value: c.name, label: c.name }))]} value={selectedClient} onChange={(value) => setSelectedClient(value)} className="w-full" />
                        <SearchableSelect options={[{ value: 'all', label: 'Tous' }, { value: 'planned', label: 'Prévues' }, { value: 'in_progress', label: 'En cours' }, { value: 'completed', label: 'Terminées' }, { value: 'cancelled', label: 'Annulées' }]} value={selectedStatus} onChange={(value) => setSelectedStatus(value)} className="w-full" />
                        <button type="button" onClick={() => { setCustomDateRange(!customDateRange); if (!customDateRange) { setStartDate(''); setEndDate(''); } }} className={`w-full px-3 py-2 rounded-lg text-sm font-bold transition border ${customDateRange ? 'bg-brand-blue text-white border-brand-blue' : 'bg-white text-slate-700 border-slate-200'}`}>
                            <Calendar className="w-3.5 h-3.5 inline mr-1.5" />{customDateRange ? 'Plage personnalisée' : 'Plage par défaut'}
                        </button>
                        {customDateRange && (
                            <div className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2">
                                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="flex-1 text-sm border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-brand-blue" />
                                <span className="text-xs text-slate-500 font-bold">au</span>
                                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="flex-1 text-sm border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-brand-blue" />
                            </div>
                        )}
                    </div>
                )}

                <div className="hidden md:block">
                    {/* Compact toolbar row */}
                    <div className="flex items-center gap-3 mb-3 flex-wrap">
                        {/* Title */}
                        <h2 className="text-xl font-serif font-bold text-slate-800 shrink-0">Planning</h2>

                        {/* Navigation compacte */}
                        <div className="flex items-center bg-slate-100 rounded-full p-0.5 gap-0.5">
                            <button onClick={handlePrevWeek} className="w-8 h-8 rounded-full bg-white text-slate-700 flex items-center justify-center hover:bg-brand-blue hover:text-white transition shadow-sm" title="Semaine précédente" aria-label="Semaine précédente">
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            <button onClick={handleCurrentWeek} className="px-3 h-8 rounded-full bg-white text-slate-700 flex items-center justify-center hover:bg-emerald-500 hover:text-white transition shadow-sm text-xs font-bold">
                                {currentWeekOffset === 0 ? 'Cette semaine' : dayjs.tz(colDates[0], 'YYYY-MM-DD', MARTINIQUE_TIMEZONE).format('DD/MM')}
                            </button>
                            <button onClick={handleNextWeek} className="w-8 h-8 rounded-full bg-white text-slate-700 flex items-center justify-center hover:bg-brand-blue hover:text-white transition shadow-sm" title="Semaine suivante" aria-label="Semaine suivante">
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Bouton Vider Cache */}
                        <button
                            type="button"
                            onClick={async () => {
                                clearAllMissionsCache();
                                toast.success('Cache local vidé ! Rechargement des données...');
                                if (refreshData) await refreshData();
                                const startStr = weekStart.format('YYYY-MM-DD');
                                const endStr = weekEnd.format('YYYY-MM-DD');
                                if (loadMissionsForRange) {
                                    await loadMissionsForRange(startStr, endStr);
                                }
                            }}
                            className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 hover:text-amber-600 transition flex items-center gap-1 text-xs font-bold shadow-sm"
                            title="Nettoyer le cache local et recharger"
                        >
                            <RotateCcw className="w-3.5 h-3.5 text-amber-500" />
                            <span>Vider cache</span>
                        </button>

                        {/* Séparateur */}
                        <div className="w-px h-6 bg-slate-200" />

                        {/* Bouton Mission */}
                        <button type="button" onClick={() => { setIsModalOpen(true); setSelectedSlotKey(''); }} className="bg-brand-blue text-white px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-sm font-bold shadow-sm hover:bg-blue-700 transition">
                            <Plus className="w-4 h-4" /> Mission
                        </button>

                        {/* Bouton Facturation clignotant */}
                        {(billingSignals.readyToInvoiceDocs.size > 0 || billingSignals.ultimatePackDocs.size > 0) && (
                            <button
                                type="button"
                                onClick={() => setShowBillingModal(true)}
                                className="relative bg-gradient-to-r from-green-500 to-emerald-600 text-white px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-sm font-bold shadow-lg hover:from-green-600 hover:to-emerald-700 transition animate-pulse"
                            >
                                <FileText className="w-4 h-4" /> Facturation
                                <span className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center">
                                    {billingSignals.readyToInvoiceDocs.size + billingSignals.ultimatePackDocs.size}
                                </span>
                            </button>
                        )}

                        {selectedMissionIds.size > 0 && (
                            <button onClick={confirmBulkDeleteMissions} className="bg-red-500 text-white px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-sm font-bold shadow-sm hover:bg-red-600 transition">
                                <Trash2 className="w-3.5 h-3.5" /> {selectedMissionIds.size}
                            </button>
                        )}

                        <div className="flex-1" />

                        {/* Bouton Filtres */}
                        <button type="button" onClick={() => setShowDesktopFilters(v => !v)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold transition border ${showDesktopFilters ? 'bg-brand-blue text-white border-brand-blue' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}`}>
                            <SlidersHorizontal className="w-3.5 h-3.5" /> Filtres
                            {(selectedProvider !== 'all' || selectedClient !== 'all' || selectedStatus !== 'all' || searchQuery) && (
                                <span className={`w-2 h-2 rounded-full ${showDesktopFilters ? 'bg-white' : 'bg-brand-blue'}`} />
                            )}
                        </button>

                        {/* Bouton Semaine */}
                        <button type="button" onClick={() => setShowWeekDashboard(v => !v)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold transition border ${showWeekDashboard ? 'bg-indigo-500 text-white border-indigo-500' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}`}>
                            <Calendar className="w-3.5 h-3.5" /> Semaine
                        </button>

                        {/* Bouton Synthèse */}
                        <button type="button" onClick={() => setShowDailySummary(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold transition bg-gradient-to-r from-indigo-500 to-blue-600 text-white border-0 shadow-sm hover:from-indigo-600 hover:to-blue-700">
                            <Users className="w-3.5 h-3.5" /> Synthèse
                            <span className="text-[10px] opacity-80">{dailySummaryData.totalScheduled}</span>
                        </button>

                        {/* Bouton Légende */}
                        <button type="button" onClick={() => setShowColorLegend(v => !v)} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition border ${showColorLegend ? 'bg-slate-700 text-white border-slate-700' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
                            <span className="w-3 h-3 rounded-full bg-gradient-to-r from-green-200 via-yellow-200 to-orange-200 inline-block border border-slate-200" /> Légende
                        </button>

                        {/* Séparateur */}
                        <div className="w-px h-6 bg-slate-200" />

                        {/* Actions secondaires */}
                        <button type="button" onClick={() => setIsStatsModalOpen(true)} className="p-2 bg-white rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition" title="Statistiques">
                            <FileText className="w-4 h-4" />
                        </button>
                        <button type="button" onClick={() => navigate('/provider-availability')} className="p-2 bg-white rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition" title="Disponibilité">
                            <Users className="w-4 h-4" />
                        </button>
                        <button type="button" onClick={() => setShowNotifications(v => !v)} className="relative p-2 bg-white rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition" aria-label="Notifications">
                            <Bell className="w-4 h-4" />
                            {notificationsData.length > 0 && (
                                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center">
                                    {notificationsData.length > 9 ? '9+' : notificationsData.length}
                                </span>
                            )}
                        </button>
                        <div className="relative group">
                            <button type="button" className="p-2 bg-white rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition" aria-label="Exporter">
                                <Download className="w-4 h-4" />
                            </button>
                            <div className="absolute right-0 top-full mt-1 w-40 bg-white rounded-lg shadow-lg border border-slate-200 py-1 hidden group-hover:block z-20">
                                <button type="button" onClick={exportToPDFDay} className="w-full px-3 py-2 text-left text-xs font-bold text-slate-700 hover:bg-slate-100 flex items-center gap-2"><FileText className="w-3 h-3" /> PDF Jour</button>
                                <button type="button" onClick={exportToPDFWeek} className="w-full px-3 py-2 text-left text-xs font-bold text-slate-700 hover:bg-slate-100 flex items-center gap-2"><FileText className="w-3 h-3" /> PDF Semaine</button>
                                <button type="button" onClick={exportToCSV} className="w-full px-3 py-2 text-left text-xs font-bold text-slate-700 hover:bg-slate-100 flex items-center gap-2"><FileSpreadsheet className="w-3 h-3" /> Exporter CSV</button>
                                <button type="button" onClick={handlePrint} className="w-full px-3 py-2 text-left text-xs font-bold text-slate-700 hover:bg-slate-100 flex items-center gap-2"><Printer className="w-3 h-3" /> Imprimer</button>
                            </div>
                        </div>
                    </div>

                    {/* Panneau de filtres collapsible */}
                    {showDesktopFilters && (
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-3 animate-in slide-in-from-top duration-200">
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="text-sm font-bold text-slate-700">Filtres du planning</h3>
                                <button type="button" onClick={() => { setSelectedProvider('all'); setSelectedClient('all'); setSelectedStatus('all'); setSearchQuery(''); setCustomDateRange(false); setStartDate(''); setEndDate(''); }} className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1 font-bold">
                                    <RotateCcw className="w-3 h-3" /> Réinitialiser
                                </button>
                            </div>
                            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                                {/* Recherche */}
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Rechercher</label>
                                    <div className="relative">
                                        <input type="text" placeholder="Nom, client..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand-blue focus:ring-1 focus:ring-brand-blue/20" />
                                        <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-2.5" />
                                    </div>
                                </div>
                                {/* Prestataire */}
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Prestataire</label>
                                    <SearchableSelect
                                        options={[{ value: 'all', label: 'Tous les prestataires' }, ...providers.filter(p => p?.status === 'Active').map(p => ({ value: getProviderDisplayName(p), label: getProviderDisplayName(p) }))]}
                                        value={selectedProvider}
                                        onChange={(value) => setSelectedProvider(value)}
                                        className="w-full"
                                    />
                                </div>
                                {/* Client */}
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Client</label>
                                    <SearchableSelect
                                        options={[{ value: 'all', label: 'Tous les clients' }, ...clients.map(c => ({ value: c.name, label: c.name }))]}
                                        value={selectedClient}
                                        onChange={(value) => setSelectedClient(value)}
                                        className="w-full"
                                    />
                                </div>
                                {/* Statut */}
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Statut</label>
                                    <SearchableSelect
                                        options={[{ value: 'all', label: 'Tous' }, { value: 'planned', label: 'Prévues' }, { value: 'in_progress', label: 'En cours' }, { value: 'completed', label: 'Terminées' }, { value: 'cancelled', label: 'Annulées' }]}
                                        value={selectedStatus}
                                        onChange={(value) => setSelectedStatus(value)}
                                        className="w-full"
                                    />
                                </div>
                                {/* Plage de dates */}
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Plage de dates</label>
                                    <button type="button" onClick={() => { setCustomDateRange(!customDateRange); if (!customDateRange) { setStartDate(''); setEndDate(''); } }} className={`w-full px-3 py-2 rounded-lg text-sm font-bold transition border ${customDateRange ? 'bg-brand-blue text-white border-brand-blue' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}`}>
                                        <Calendar className="w-3.5 h-3.5 inline mr-1.5" />{customDateRange ? 'Personnalisée' : 'Par défaut'}
                                    </button>
                                </div>
                            </div>
                            {customDateRange && (
                                <div className="flex items-center gap-3 mt-3 bg-slate-50 rounded-lg px-3 py-2">
                                    <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-brand-blue" />
                                    <span className="text-xs text-slate-500 font-bold">au</span>
                                    <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-brand-blue" />
                                </div>
                            )}
                        </div>
                    )}

                    {/* Légende compacte */}
                    {showColorLegend && (
                        <div className="flex items-center gap-4 mb-3 px-1 animate-in slide-in-from-top duration-200">
                            <span className="flex items-center gap-1.5 text-[11px] text-slate-600 font-medium"><span className="w-3.5 h-3.5 rounded inline-block border border-slate-200" style={{ backgroundColor: '#dcfce7' }} /> &lt;60% Normal</span>
                            <span className="flex items-center gap-1.5 text-[11px] text-slate-600 font-medium"><span className="w-3.5 h-3.5 rounded inline-block border border-slate-200" style={{ backgroundColor: '#fef9c3' }} /> 60–89% Chargé</span>
                            <span className="flex items-center gap-1.5 text-[11px] text-slate-600 font-medium"><span className="w-3.5 h-3.5 rounded inline-block border border-slate-200" style={{ backgroundColor: '#ffedd5' }} /> ≥90% Complet</span>
                            <span className="flex items-center gap-1.5 text-[11px] text-slate-600 font-medium"><span className="w-3.5 h-3.5 rounded inline-block border border-slate-200" style={{ backgroundColor: '#ccfbf1' }} /> Jour clos</span>
                        </div>
                    )}

                    {/* Mini-dashboard semaine collapsible */}
                    {showWeekDashboard && (
                        <div className="mt-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-3 space-y-3">
                            {/* Mini-stats */}
                            <div className="flex flex-wrap gap-2">
                                <div className="flex items-center gap-1.5 bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100">
                                    <span className="text-sm font-black text-indigo-700">{weekDashboardData.totalMissions}</span>
                                    <span className="text-[11px] text-indigo-500">prestations</span>
                                </div>
                                <div className="flex items-center gap-1.5 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100">
                                    <span className="text-sm font-black text-emerald-700">{weekDashboardData.activeProvidersCount}</span>
                                    <span className="text-[11px] text-emerald-500">prestataires actives</span>
                                </div>
                                <div className="flex items-center gap-1.5 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-100">
                                    <span className="text-sm font-black text-amber-700">{weekDashboardData.totalHours.toFixed(1)}h</span>
                                    <span className="text-[11px] text-amber-500">de travail</span>
                                </div>
                                {weekDashboardData.readyToInvoiceCount > 0 && (
                                    <div className="flex items-center gap-1.5 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-200">
                                        <span className="text-sm font-black text-blue-700">{weekDashboardData.readyToInvoiceCount}</span>
                                        <span className="text-[11px] text-blue-500">devis à facturer</span>
                                    </div>
                                )}
                            </div>

                            {/* Day grid */}
                            <div className="flex gap-2 overflow-x-auto pb-1 snap-x snap-mandatory">
                                {weekDashboardData.days.map(day => {
                                    const isToday = day.dateStr === getMartiniqueToday();
                                    const isSelected = day.dateStr === statsDate;
                                    return (
                                        <button
                                            key={day.dateStr}
                                            type="button"
                                            onClick={() => setFocusedDate(day.dateStr)}
                                            className={`snap-start shrink-0 w-[calc(100%/3.2)] sm:w-[calc(100%/5)] md:flex-1 min-w-[72px] flex flex-col items-center gap-0.5 p-2 rounded-xl border-2 transition ${isSelected
                                                    ? 'border-[#006699] bg-[#006699]/10'
                                                    : isToday
                                                        ? 'border-emerald-400 bg-emerald-50/50'
                                                        : 'border-transparent'
                                                }`}
                                            style={!isSelected ? { backgroundColor: day.bgColor + '99' } : undefined}
                                            aria-label={`${day.dayName} ${day.dayNum} — ${day.scheduledCount} prestataire(s) planifiée(s) — ${day.plannedHours.toFixed(1)}h`}
                                            aria-pressed={isSelected}
                                        >
                                            <span className={`text-[11px] font-black uppercase tracking-wide ${isSelected ? 'text-[#006699]' : isToday ? 'text-emerald-700' : 'text-slate-600'}`}>
                                                {day.dayName}
                                            </span>
                                            <span className={`text-[10px] font-bold ${isSelected ? 'text-[#006699]' : 'text-slate-400'}`}>
                                                {day.dayNum}
                                            </span>
                                            <div className="mt-1 flex flex-col items-center">
                                                <span className="text-sm font-black text-slate-800 leading-none">
                                                    {day.scheduledCount}
                                                    <span className="text-[9px] font-normal text-slate-400">/{day.totalProviders}</span>
                                                </span>
                                                <span className="text-[10px] font-bold text-slate-500">{day.plannedHours.toFixed(0)}h</span>
                                            </div>
                                            {day.status === 'clos' && (
                                                <span className="mt-0.5 text-[8px] font-bold text-teal-700 bg-teal-50 border border-teal-200 px-1 rounded leading-tight">Clos</span>
                                            )}
                                            {day.hasBillingSignal && (
                                                <span
                                                    className={`mt-0.5 w-2 h-2 rounded-full ${day.billingType === 'pack' ? 'bg-violet-500' : 'bg-blue-500'}`}
                                                    title={day.billingType === 'pack' ? 'Pack complet' : 'Prêt à facturer'}
                                                />
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
                {/* End Desktop Toolbar wrapper */}

                {/* GRAFTED: Sidebar Prestations en attente */}
                {showUnassignedSidebar && filteredUnassignedMissions.length > 0 && (
                    <div className="hidden lg:flex w-56 shrink-0 flex-col bg-white shadow-sm border border-slate-200 rounded-xl overflow-hidden">
                        <div className="flex items-center justify-between px-3 py-2 bg-amber-50 border-b border-amber-100">
                            <div className="flex items-center gap-2">
                                <User className="w-4 h-4 text-amber-600" />
                                <span className="text-xs font-bold text-amber-800">À assigner</span>
                            </div>
                            <span className="text-[10px] font-black bg-amber-500 text-white px-1.5 py-0.5 rounded-full">
                                {filteredUnassignedMissions.length}
                            </span>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 space-y-2">
                            {filteredUnassignedMissions.slice(0, 10).map(m => {
                                const client = clients.find(c => c.id === m.clientId);
                                return (
                                    <button
                                        key={m.id}
                                        type="button"
                                        onClick={() => { setQuickAssignMission(m as Mission); setQuickAssignOpen(true); }}
                                        className="w-full p-2 bg-red-50 border border-red-100 rounded-lg text-left hover:bg-red-100 transition"
                                    >
                                        <div className="text-xs font-bold text-red-800 truncate">{client?.name || m.clientName}</div>
                                        <div className="text-[10px] text-red-600 mt-0.5">{m.date} • {m.startTime}-{m.endTime}</div>
                                        <div className="text-[9px] text-red-500 mt-0.5 truncate">{m.service || 'Prestation'}</div>
                                    </button>
                                );
                            })}
                            {filteredUnassignedMissions.length > 10 && (
                                <p className="text-[10px] text-slate-500 text-center">+{filteredUnassignedMissions.length - 10} autres</p>
                            )}
                        </div>
                        <button
                            type="button"
                            onClick={() => setShowUnassignedSidebar(false)}
                            className="p-2 text-[10px] font-bold text-slate-500 hover:text-slate-700 border-t border-slate-100"
                        >
                            Masquer
                        </button>
                    </div>
                )}

                {/* Main Grid */}
                <div className="flex-1 min-h-0 flex flex-col gap-4 lg:flex-row lg:gap-6 relative">
                    {planningLoading && (
                        <div className="absolute top-0 left-0 right-0 z-30 h-1 bg-amber-100/50 overflow-hidden pointer-events-none rounded-t-xl">
                            <div
                                className="bg-brand-blue h-full transition-all duration-300 animate-pulse"
                                style={{ width: `${Math.min(100, Math.max(15, Math.round(planningProgress)))}%` }}
                            />
                        </div>
                    )}

                    <div className="flex-1 min-h-0 bg-white shadow-sm border border-slate-200 flex flex-col overflow-x-hidden md:overflow-x-auto">
                        {/* Mobile list view — Compact day-focused layout */}
                        <div className="md:hidden flex-1 flex flex-col overflow-hidden">
                            {/* Day strip — horizontal scrollable week */}
                            <div className="shrink-0 bg-white border-b border-slate-200 px-2 py-2">
                                <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-hide">
                                    {mobilePlanningDays.map(({ dateStr, missionsForDate, provisionalForDate }) => {
                                        const d = dayjs.tz(dateStr, 'YYYY-MM-DD', MARTINIQUE_TIMEZONE);
                                        const isSelected = dateStr === statsDate;
                                        const isToday = dateStr === getMartiniqueToday();
                                        const dayStatus = dayFillStatus.get(dateStr);
                                        const count = missionsForDate.length + (provisionalForDate?.length || 0);
                                        const holidayName = getHolidayName(dateStr);
                                        const isHoliday = !!holidayName;
                                        return (
                                            <button
                                                key={dateStr}
                                                type="button"
                                                onClick={() => setFocusedDate(dateStr)}
                                                className={`shrink-0 flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl min-w-[44px] transition-all ${isHoliday
                                                        ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                                        : isSelected
                                                            ? 'bg-[#006699] text-white shadow-md scale-105'
                                                            : isToday
                                                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                                                : 'text-slate-700 hover:bg-slate-50'
                                                    }`}
                                                aria-label={`${d.format('dddd DD/MM')}${isHoliday ? ' — Férié' : ''} — ${count} mission${count !== 1 ? 's' : ''}`}
                                            >
                                                <span className={`text-[10px] font-bold uppercase leading-none ${isSelected ? 'text-white/80' : isHoliday ? 'text-purple-400' : 'text-slate-400'}`}>
                                                    {d.format('dd').charAt(0)}
                                                </span>
                                                <span className="text-sm font-bold leading-none">{d.format('D')}</span>
                                                {isHoliday ? (
                                                    <span className="text-[7px] font-black text-purple-500 leading-none">Férié</span>
                                                ) : count > 0 ? (
                                                    <span className={`text-[9px] font-black leading-none px-1 rounded-full ${isSelected ? 'bg-white/25 text-white' : 'bg-slate-200 text-slate-600'
                                                        }`}>{count}</span>
                                                ) : (
                                                    <span className="w-3 h-1" />
                                                )}
                                                {dayStatus && (
                                                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: dayStatus.status === 'clos' ? '#14b8a6' : dayStatus.status === 'full' ? '#f97316' : dayStatus.status === 'busy' ? '#eab308' : '#22c55e' }} />
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                                {/* Quick today button */}
                                {statsDate !== getMartiniqueToday() && (
                                    <button
                                        type="button"
                                        onClick={() => { setCurrentWeekOffset(0); setFocusedDate(getMartiniqueToday()); }}
                                        className="mt-1 w-full text-[10px] font-bold text-blue-600 bg-blue-50 py-1 rounded-lg hover:bg-blue-100 transition"
                                    >
                                        ← Revenir à aujourd'hui
                                    </button>
                                )}
                            </div>

                            {/* Selected day detail */}
                            <div className="flex-1 overflow-y-auto bg-slate-50">
                                {(() => {
                                    const selectedDay = mobilePlanningDays.find(d => d.dateStr === statsDate);
                                    if (!selectedDay) {
                                        return (
                                            <div className="text-center text-sm text-slate-400 py-16">
                                                <Calendar className="w-10 h-10 mx-auto mb-3 text-slate-300" />
                                                <p>Sélectionnez un jour ci-dessus</p>
                                            </div>
                                        );
                                    }
                                    const { dateStr, remindersForDate, provisionalForDate, missionsForDate } = selectedDay;
                                    const d = dayjs.tz(dateStr, 'YYYY-MM-DD', MARTINIQUE_TIMEZONE);
                                    const dayStatus = dayFillStatus.get(dateStr);
                                    const allItems = [...missionsForDate].sort((a: any, b: any) => (a.startTime || '').localeCompare(b.startTime || ''));
                                    const totalHours = allItems.reduce((acc: number, m: any) => acc + (m.duration || 0), 0) + (provisionalForDate || []).reduce((acc: number, p: any) => acc + (p.duration || 0), 0);

                                    return (
                                        <div className="pb-4">
                                            {/* Day header */}
                                            <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-4 py-2.5 flex items-center justify-between">
                                                <div>
                                                    <h3 className="font-bold text-base text-slate-800">
                                                        {d.format('dddd D MMMM')}
                                                    </h3>
                                                    <p className="text-[11px] text-slate-500 mt-0.5">
                                                        {allItems.length + (provisionalForDate?.length || 0)} prestation{allItems.length + (provisionalForDate?.length || 0) !== 1 ? 's' : ''} · {totalHours.toFixed(1)}h
                                                        {dayStatus && ` · ${dayStatus.plannedHours.toFixed(1)}/${dayStatus.capacityHours.toFixed(0)}h`}
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    {dayStatus && dayStatus.status !== 'normal' && (
                                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${dayStatus.status === 'clos' ? 'bg-teal-100 text-teal-700' :
                                                                dayStatus.status === 'full' ? 'bg-orange-100 text-orange-700' :
                                                                    dayStatus.status === 'busy' ? 'bg-amber-100 text-amber-700' :
                                                                        'bg-green-100 text-green-700'
                                                            }`}>
                                                            {dayStatus.status === 'clos' ? 'Clos' : dayStatus.status === 'full' ? 'Complet' : dayStatus.status === 'busy' ? 'Occupé' : 'Normal'}
                                                        </span>
                                                    )}
                                                    <button
                                                        type="button"
                                                        onClick={() => toggleCloseDay(dateStr)}
                                                        className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border transition ${closedDays.has(dateStr)
                                                                ? 'bg-amber-500 text-white border-amber-600 hover:bg-amber-600'
                                                                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                                                            }`}
                                                    >
                                                        {closedDays.has(dateStr) ? '↩ Ouvrir' : '🔒 Clore'}
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="px-3 pt-2 space-y-2">
                                                {/* Reminders */}
                                                {remindersForDate.map((r: any) => (
                                                    <div key={r.id} className="bg-amber-50 border border-amber-200 px-3 py-2 rounded-lg flex items-center gap-2">
                                                        <Bell className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                                        <p className="flex-1 text-xs font-bold text-amber-800 truncate">{r.text}</p>
                                                        <button onClick={() => toggleReminder(r.id)} className="text-amber-600 hover:text-green-600 shrink-0">
                                                            <CheckCircle className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                ))}

                                                {/* Provisional missions */}
                                                {provisionalForDate.map((item: any) => {
                                                    if (item.isSignedQuote) {
                                                        return (
                                                            <div
                                                                key={item.id}
                                                                className="rounded-lg p-2.5 cursor-pointer transition active:scale-[0.98] flex items-start gap-3 border border-slate-200 border-l-4 border-l-red-500 bg-red-50/70 shadow-sm"
                                                                onClick={(e) => handleProvisionalMissionClick(item, e)}
                                                            >
                                                                <div className="shrink-0 w-12 text-center pt-0.5">
                                                                    <div className="text-xs font-bold text-slate-800">{item.startTime?.slice(0, 5)}</div>
                                                                    <div className="text-[10px] text-slate-500">{item.endTime?.slice(0, 5)}</div>
                                                                    {item.duration && (
                                                                        <span className="text-[9px] font-bold text-slate-400">{item.duration}h</span>
                                                                    )}
                                                                </div>
                                                                <div className="flex-1 min-w-0 border-l-2 border-red-300 pl-2.5">
                                                                    <p className="font-bold text-xs text-slate-900 truncate">{item.clientName}</p>
                                                                    <p className="text-[10px] text-slate-600 truncate">{item.providerName || 'À assigner'} · {item.service || 'Prestation'}</p>
                                                                </div>
                                                            </div>
                                                        );
                                                    }
                                                    return (
                                                        <div
                                                            key={item.id}
                                                            className="bg-orange-50 border border-orange-200 rounded-lg p-2.5 cursor-pointer hover:bg-orange-100 active:bg-orange-150 transition flex items-center gap-3"
                                                            onClick={(e) => handleProvisionalMissionClick(item, e)}
                                                        >
                                                            <div className="shrink-0 w-12 text-center">
                                                                <div className="text-xs font-bold text-orange-700">{item.startTime?.slice(0, 5)}</div>
                                                                <div className="text-[10px] text-orange-500">{item.endTime?.slice(0, 5)}</div>
                                                            </div>
                                                            <div className="flex-1 min-w-0 border-l-2 border-orange-300 pl-2.5">
                                                                <p className="font-bold text-xs text-orange-900 truncate">{item.clientName}</p>
                                                                <p className="text-[10px] text-orange-700 truncate">{item.providerName || 'À assigner'} · {item.service || 'Devis'}</p>
                                                            </div>
                                                            <span className="shrink-0 text-[9px] font-bold bg-orange-200 text-orange-800 px-1.5 py-0.5 rounded">Attente</span>
                                                        </div>
                                                    );
                                                })}

                                                {/* Confirmed missions — compact timeline */}
                                                {allItems.map((item: any) => {
                                                    const style = getMissionPlanningStyle(item as Mission);
                                                    const clientCityRaw = item?.clientId ? (clients.find(c => c.id === item.clientId)?.city || '') : '';
                                                    const clientCity = normalizeCommune(clientCityRaw);
                                                    const billingBg = billingSignals.ultimatePackComplete.has(item.id) ? '#ede9fe' : billingSignals.readyToInvoice.has(item.id) ? '#dbeafe' : undefined;
                                                    const billingBadge = billingSignals.ultimatePackComplete.has(item.id) ? { text: 'Facture complète', cls: 'text-purple-700 bg-purple-100 border border-purple-200' } : billingSignals.readyToInvoice.has(item.id) ? { text: 'À facturer', cls: 'text-blue-700 bg-blue-100 border border-blue-200' } : null;
                                                    return (
                                                        <div
                                                            key={item.id}
                                                            className={`rounded-lg p-2.5 cursor-pointer transition active:scale-[0.98] flex items-start gap-3 border ${style.border}`}
                                                            style={{ backgroundColor: billingBg || undefined }}
                                                            onClick={(e) => handleMissionClick(item, e)}
                                                        >
                                                            {/* Time column */}
                                                            <div className="shrink-0 w-12 text-center pt-0.5">
                                                                <div className="text-xs font-bold text-slate-800">{item.startTime?.slice(0, 5)}</div>
                                                                <div className="text-[10px] text-slate-500">{item.endTime?.slice(0, 5)}</div>
                                                                {item.duration && (
                                                                    <span className="text-[9px] font-bold text-slate-400">{item.duration}h</span>
                                                                )}
                                                            </div>

                                                            {/* Content */}
                                                            <div className="flex-1 min-w-0 border-l-2 pl-2.5" style={{ borderColor: style.borderColor || '#e2e8f0' }}>
                                                                <div className="flex items-center justify-between gap-1">
                                                                    <p className="font-bold text-sm text-slate-800 truncate">{item.clientName}</p>
                                                                    {clientCity && <span className="text-[10px] text-slate-500 shrink-0 truncate max-w-[80px]">{clientCity}</span>}
                                                                </div>
                                                                <div className="flex items-center gap-1.5 mt-0.5">
                                                                    {item.providerId ? (
                                                                        <button
                                                                            type="button"
                                                                            onClick={(e) => { e.stopPropagation(); const p = providers.find(pr => pr.id === item.providerId); if (p) setSelectedProviderStats(p); }}
                                                                            className="text-[11px] font-bold text-slate-600 truncate hover:text-brand-blue hover:underline text-left"
                                                                        >
                                                                            {item.providerName}
                                                                        </button>
                                                                    ) : (
                                                                        <span className="text-[11px] font-bold text-slate-500 truncate">{item.providerName || 'Non assigné'}</span>
                                                                    )}
                                                                    {item.provider2Id && (
                                                                        <>
                                                                            <span className="text-[10px] text-violet-400">+</span>
                                                                            <button
                                                                                type="button"
                                                                                onClick={(e) => { e.stopPropagation(); const p = providers.find(pr => pr.id === item.provider2Id); if (p) setSelectedProviderStats(p); }}
                                                                                className="text-[11px] font-bold text-violet-600 truncate hover:text-violet-800 hover:underline text-left"
                                                                            >
                                                                                {item.provider2Name}
                                                                            </button>
                                                                        </>
                                                                    )}
                                                                    <span className="text-[10px] text-slate-400">·</span>
                                                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${style.statusCls || 'bg-slate-100 text-slate-600'}`}>{style.label}</span>
                                                                </div>
                                                                {item.service && (
                                                                    <p className="text-[10px] text-slate-500 mt-0.5 truncate">{item.service}</p>
                                                                )}
                                                                {billingBadge && (
                                                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded mt-1 inline-block ${billingBadge.cls}`}>{billingBadge.text}</span>
                                                                )}
                                                            </div>

                                                            {/* Selection checkbox */}
                                                            <button
                                                                onClick={(e) => toggleMissionSelection(item.id, e)}
                                                                className="p-1 shrink-0 hover:bg-white/80 rounded"
                                                                aria-label={selectedMissionIds.has(item.id) ? 'Désélectionner' : 'Sélectionner'}
                                                            >
                                                                {selectedMissionIds.has(item.id) ? (
                                                                    <CheckSquare className="w-4 h-4 text-brand-blue fill-white" />
                                                                ) : (
                                                                    <Square className="w-4 h-4 text-slate-300" />
                                                                )}
                                                            </button>
                                                        </div>
                                                    );
                                                })}

                                                {/* Empty state */}
                                                {remindersForDate.length === 0 && provisionalForDate.length === 0 && allItems.length === 0 && (
                                                    <div className="text-center py-10">
                                                        <Calendar className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                                                        <p className="text-xs text-slate-400">Aucune prestation ce jour</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>
                        </div>

                        {/* Desktop calendar view */}
                        <div className="hidden md:block min-w-[900px]">
                            <div className="grid grid-cols-6 border-b border-slate-200 text-center font-bold py-2">
                                {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'].map((d, idx) => {
                                    const dateStr = colDates[idx] || '';
                                    const isSelected = dateStr && dateStr === statsDate;
                                    const dayStatus = dateStr ? dayFillStatus.get(dateStr) : null;
                                    const headerBg = isSelected ? undefined : (dayStatus?.bgColor ?? '#f1f5f9');
                                    const statusLabel = dayStatus?.status === 'clos' ? 'Jour clos' : dayStatus?.status === 'full' ? 'Complet' : dayStatus?.status === 'busy' ? 'Chargé' : 'Normal';
                                    const tooltipText = dateStr && dayStatus
                                        ? `${dayStatus.scheduledCount} planifiée(s) — ${dayStatus.plannedHours.toFixed(1)}h/${dayStatus.capacityHours.toFixed(0)}h — ${statusLabel}`
                                        : 'Utiliser ce jour pour les statistiques';
                                    return (
                                        <button
                                            key={d}
                                            type="button"
                                            onClick={() => dateStr && setFocusedDate(dateStr)}
                                            disabled={!dateStr}
                                            className={`px-2 py-1 rounded-md mx-2 transition ${isSelected ? 'bg-brand-blue text-white' : 'text-slate-800 hover:opacity-90'} ${!dateStr ? 'opacity-40 cursor-not-allowed' : ''}`}
                                            style={isSelected ? undefined : { backgroundColor: headerBg }}
                                            title={tooltipText}
                                            aria-label={tooltipText}
                                        >
                                            <div className="text-sm">{d}</div>
                                            <div className={`text-[11px] ${isSelected ? 'text-white/90' : 'text-slate-500'}`}>{dateStr ? dayjs.tz(dateStr, 'YYYY-MM-DD', MARTINIQUE_TIMEZONE).format('DD/MM') : '—'}</div>
                                            {dateStr && getHolidayName(dateStr) && (
                                                <div className={`text-[8px] font-bold leading-tight ${isSelected ? 'text-yellow-200' : 'text-purple-600'}`}>Férié</div>
                                            )}
                                            {dayStatus?.status === 'clos' && <div className="text-[8px] font-bold text-teal-700 leading-tight">Clos</div>}
                                        </button>
                                    );
                                })}
                            </div>
                            <div className="grid grid-cols-6 flex-1 min-h-[400px] min-h-0">
                                {[0, 1, 2, 3, 4, 5].map(colIndex => {
                                    const colDateStr = colDates[colIndex] || '';
                                    const colDayStatus = colDateStr ? dayFillStatus.get(colDateStr) : null;
                                    const colBg = colDayStatus?.bgColor ? colDayStatus.bgColor + '66' : 'rgba(248,250,252,0.5)';
                                    return (
                                        <div
                                            key={colIndex}
                                            className="border-r border-slate-100 last:border-r-0 p-2 space-y-2 h-full overflow-y-auto"
                                            style={{ backgroundColor: colBg }}
                                            onDoubleClick={() => {
                                                if (colDateStr && filteredUnassignedMissions.length > 0) {
                                                    setQuickAssignTarget({
                                                        date: colDateStr,
                                                        providerId: '',
                                                        providerName: '',
                                                        startTime: '09:00',
                                                        endTime: '12:00'
                                                    });
                                                    setQuickAssignOpen(true);
                                                }
                                            }}
                                        >
                                            {/* GRAFTED: Clore toggle button & Assign button */}
                                            {colDateStr && (
                                                <div className="flex items-center justify-between">
                                                    <button
                                                        type="button"
                                                        onClick={() => { setDayAssignDate(colDateStr); setDayAssignOpen(true); }}
                                                        className="text-[10px] font-bold text-amber-600 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 px-1.5 py-0.5 rounded border border-amber-200 transition"
                                                        title="Voir les missions à assigner"
                                                    >
                                                        {(() => {
                                                            const dayUnassigned = filteredUnassignedMissions.filter(m => m.date === colDateStr);
                                                            return dayUnassigned.length > 0 ? `À assigner (${dayUnassigned.length})` : 'Assigner';
                                                        })()}
                                                    </button>
                                                    <div className="flex items-center gap-1">
                                                        {colDayStatus?.status === 'clos' && (
                                                            <span className="text-[8px] font-bold text-teal-700 bg-teal-50 border border-teal-200 px-1 rounded">Clos</span>
                                                        )}
                                                        <button
                                                            type="button"
                                                            onClick={() => toggleCloseDay(colDateStr)}
                                                            className="min-h-[32px] min-w-[32px] flex items-center justify-center text-[11px] text-slate-400 hover:text-teal-600 transition rounded"
                                                            aria-label={closedDays.has(colDateStr) ? 'Ouvrir la journée' : 'Clore la journée'}
                                                            title={closedDays.has(colDateStr) ? 'Ouvrir la journée' : 'Clore la journée'}
                                                        >
                                                            {closedDays.has(colDateStr) ? '↩' : '🔒'}
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                            {/* Reminders for this day */}
                                            {filteredReminders
                                                .filter(r => getDayIndex(r.date) === colIndex && !r.completed)
                                                .map(r => (
                                                    <div key={r.id} className="bg-yellow-100 border-l-4 border-yellow-400 p-2 rounded shadow-sm text-xs relative group animate-in zoom-in duration-200">
                                                        <div className="flex justify-between items-start">
                                                            <p className="font-bold text-yellow-800 line-clamp-2">{r.text}</p>
                                                            <button onClick={() => toggleReminder(r.id)} className="p-1 min-h-[32px] min-w-[32px] flex items-center justify-center text-yellow-600 hover:text-green-600 rounded transition" aria-label="Marquer comme effectué"><CheckCircle className="w-4 h-4" /></button>
                                                        </div>
                                                        {r.notifyEmail && <div className="absolute top-1 right-1 opacity-20"><Mail className="w-3 h-3" /></div>}
                                                    </div>
                                                ))
                                            }

                                            {/* Missions for this day */}
                                            {filteredProvisionalMissions
                                                .filter((item: any) => item && getDayIndex(item.date) === colIndex)
                                                .map((item: any) => {
                                                    if (item.isSignedQuote) {
                                                        return (
                                                            <div
                                                                key={item.id}
                                                                className="p-2 rounded text-xs cursor-pointer hover:scale-105 transition border-l-4 relative group bg-red-50 text-slate-800 border-red-500 shadow-sm"
                                                                onClick={(e) => handleProvisionalMissionClick(item, e)}
                                                            >
                                                                <div className="flex items-center justify-between gap-2">
                                                                    <p className="font-bold text-slate-800 pr-2 truncate">{item.clientName}</p>
                                                                    <span className="text-[10px] font-bold text-slate-700 shrink-0">
                                                                        {dayjs.tz(item.date, 'YYYY-MM-DD', MARTINIQUE_TIMEZONE).format('DD/MM')}
                                                                    </span>
                                                                </div>
                                                                <p className="text-[10px]">{item.startTime}-{item.endTime}</p>
                                                                <p className="text-[10px] font-bold text-slate-700 truncate">{item.providerName || 'À assigner'}</p>
                                                                <p className="text-[10px] text-slate-600 truncate">{item.service || 'Prestation'}</p>
                                                            </div>
                                                        );
                                                    }
                                                    return (
                                                        <div
                                                            key={item.id}
                                                            className="bg-orange-100 p-2 rounded text-xs cursor-pointer hover:scale-105 transition border-l-4 border-orange-500 relative group"
                                                            onClick={(e) => handleProvisionalMissionClick(item, e)}
                                                        >
                                                            <div className="flex justify-between">
                                                                <p className="font-bold text-orange-900 pr-4 truncate">{item.clientName}</p>
                                                                <span className="text-[9px] text-orange-700">{dayjs.tz(item.date, 'YYYY-MM-DD', MARTINIQUE_TIMEZONE).date()}</span>
                                                            </div>
                                                            <p className="text-[10px] text-orange-800">{item.startTime}-{item.endTime}</p>
                                                            <p className="text-[10px] font-bold text-orange-800 truncate">{item.providerName || 'À assigner'}</p>
                                                            <p className="text-[10px] text-orange-800 truncate">{item.service || 'Devis'}</p>
                                                            <p className="text-[9px] italic text-orange-700 truncate">En attente</p>
                                                        </div>
                                                    );
                                                })
                                            }
                                            {filteredMissions
                                                .filter(item => getDayIndex(item.date) === colIndex)
                                                .filter(item => item.status !== 'cancelled')
                                                .map(item => {
                                                    const style = getMissionPlanningStyle(item);
                                                    const clientCityRaw = item?.clientId ? (clients.find(c => c.id === item.clientId)?.city || '') : '';
                                                    const clientCity = normalizeCommune(clientCityRaw);
                                                    const billingBg = billingSignals.ultimatePackComplete.has(item.id) ? '#ede9fe' : billingSignals.readyToInvoice.has(item.id) ? '#dbeafe' : undefined;
                                                    const billingBadge = billingSignals.ultimatePackComplete.has(item.id) ? { text: 'Facture complète', cls: 'text-purple-700 bg-purple-100' } : billingSignals.readyToInvoice.has(item.id) ? { text: 'À facturer', cls: 'text-blue-700 bg-blue-100' } : null;
                                                    return (
                                                        <div
                                                            key={item.id}
                                                            className={`p-2 rounded text-xs cursor-pointer hover:scale-105 transition border-l-4 relative group ${style.container} ${style.border}`}
                                                            style={billingBg ? { backgroundColor: billingBg } : undefined}
                                                            onClick={(e) => handleMissionClick(item, e)}
                                                        >
                                                            <div className="absolute top-1 right-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                                                <button
                                                                    onClick={(e) => toggleMissionSelection(item.id, e)}
                                                                    className="p-1.5 min-h-[28px] min-w-[28px] flex items-center justify-center hover:bg-white/50 rounded"
                                                                    aria-label={selectedMissionIds.has(item.id) ? 'Désélectionner la mission' : 'Sélectionner la mission'}
                                                                >
                                                                    {selectedMissionIds.has(item.id) ? (
                                                                        <CheckSquare className="w-4 h-4 text-brand-blue fill-white" />
                                                                    ) : (
                                                                        <Square className="w-4 h-4 text-slate-400" />
                                                                    )}
                                                                </button>
                                                            </div>
                                                            {selectedMissionIds.has(item.id) && (
                                                                <div className="absolute inset-0 bg-blue-500/10 border-2 border-brand-blue rounded pointer-events-none"></div>
                                                            )}
                                                            <div className="flex items-center justify-between gap-2">
                                                                <p className="font-bold text-slate-800 pr-2 truncate">{item.clientName}</p>
                                                                <span className="text-[10px] font-bold text-slate-700 shrink-0">
                                                                    {dayjs.tz(item.date, 'YYYY-MM-DD', MARTINIQUE_TIMEZONE).format('DD/MM')}
                                                                </span>
                                                            </div>
                                                            <p className="text-[10px]">{item.startTime}-{item.endTime}</p>
                                                            {clientCity ? (
                                                                <p className="text-[10px] text-slate-600 truncate">{clientCity}</p>
                                                            ) : null}
                                                            {item.providerId ? (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => { const p = providers.find(pr => pr.id === item.providerId); if (p) setSelectedProviderStats(p); }}
                                                                    className="text-[10px] font-bold text-slate-700 truncate hover:text-brand-blue hover:underline text-left"
                                                                    aria-label={`Voir les statistiques de ${item.providerName}`}
                                                                >
                                                                    {item.providerName}
                                                                </button>
                                                            ) : (
                                                                <p className="text-[10px] font-bold text-slate-700 truncate">{item.providerName}</p>
                                                            )}
                                                            {item.provider2Id && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => { const p = providers.find(pr => pr.id === item.provider2Id); if (p) setSelectedProviderStats(p); }}
                                                                    className="text-[10px] font-bold text-violet-600 truncate hover:text-violet-800 hover:underline text-left"
                                                                    aria-label={`Voir les statistiques de ${item.provider2Name}`}
                                                                >
                                                                    + {item.provider2Name}
                                                                </button>
                                                            )}
                                                            {billingBadge && (
                                                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded mt-0.5 inline-block ${billingBadge.cls}`} role="status">{billingBadge.text}</span>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Actions & Missions - Responsive */}
                    <div className="hidden md:flex w-full md:w-64 bg-white border border-slate-200 flex-col h-full max-h-[600px]">
                        <div className="bg-slate-100 p-2 text-center font-bold text-slate-700 border-b border-slate-200 text-sm">
                            Actions & Missions
                        </div>

                        {/* Sticky filters section */}
                        <div className="p-2 space-y-1.5 border-b border-slate-200 bg-white shrink-0">
                            <button
                                onClick={() => { setIsReminderModalOpen(true); setReminderForm({ text: '', date: getMartiniqueToday(), notifyEmail: true }); }}
                                className="w-full bg-yellow-100 text-yellow-800 py-1.5 rounded font-bold text-[10px] hover:bg-yellow-200 flex items-center justify-center gap-1 border border-yellow-200"
                            >
                                <Flag className="w-3 h-3" /> Ajouter un Rappel
                            </button>

                            {/* Filters for unassigned missions */}
                            <div className="space-y-1">
                                <div>
                                    <label className="text-[9px] font-bold text-slate-500 uppercase">Nom</label>
                                    <input
                                        type="text"
                                        placeholder="Filtrer..."
                                        value={unassignedFilterName}
                                        onChange={(e) => setUnassignedFilterName(e.target.value)}
                                        className="w-full px-1.5 py-1 text-[10px] border border-slate-300 rounded focus:outline-none focus:border-brand-blue leading-tight"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Scrollable missions list */}
                        <div className="p-2 space-y-2 overflow-y-auto flex-1 min-h-0">

                            {filteredUnassignedMissions.length === 0 ? (
                                <p className="text-center text-xs text-slate-400 italic mt-4">Toutes les missions sont assignées.</p>
                            ) : (
                                <>
                                    <div className="text-xs text-slate-500 font-bold mb-2">
                                        {filteredUnassignedMissions.length} mission{filteredUnassignedMissions.length > 1 ? 's' : ''} à assigner
                                    </div>
                                    {filteredUnassignedMissions.map(m => {
                                        const client = clients.find(c => c.id === m.clientId);
                                        return (
                                            <div key={m.id} className="bg-red-50 border border-red-100 p-2 rounded cursor-pointer hover:bg-red-100 shrink-0">
                                                <p className="font-bold text-xs text-red-800 truncate">{m.clientName}</p>
                                                <p className="text-[10px] text-red-600 truncate">{m.date} | {m.startTime} - {m.endTime} | {client?.city || 'Ville non spécifiée'}</p>
                                                <button onClick={() => setSelectedMissionId(m.id)} className="mt-1 w-full bg-red-200 text-red-800 text-[10px] font-bold rounded px-1 hover:bg-red-300">Assigner</button>
                                            </div>
                                        );
                                    })}
                                </>
                            )}
                        </div>
                    </div>
                </div>

                <button
                    type="button"
                    onClick={() => setIsMobileActionsOpen(true)}
                    className="md:hidden fixed bottom-24 right-4 z-40 bg-brand-blue text-white rounded-full shadow-xl w-14 h-14 flex items-center justify-center"
                    title="Actions & Missions"
                >
                    <Briefcase className="w-6 h-6" />
                </button>

                {/* Légende déplacée dans le panneau "Actions & Missions" sur mobile pour ne pas masquer la vue */}

                {/* Footer Stats - Updated to reflect filtered items */}
                <div className="bg-slate-200 p-4 mt-6 flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center font-bold text-slate-800 rounded-lg">
                    <div className="flex items-center justify-between sm:justify-start gap-2">
                        <span>Total heures ({dayjs.tz(statsDate, 'YYYY-MM-DD', MARTINIQUE_TIMEZONE).format('DD/MM')}) :</span>
                        <span className="text-xl">{totalHoursToday}h</span>
                    </div>
                    <div className="flex items-center justify-between sm:justify-start gap-2">
                        <span>Total heures ({currentWeekOffset === 0 ? 'Cette semaine' : 'Semaine sélectionnée'}) :</span>
                        <span className="text-xl">{totalHoursFiltered}h</span>
                    </div>
                </div>

                {isStatsModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
                            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-cream-50">
                                <div>
                                    <h3 className="text-lg font-serif font-bold text-slate-800">Statistiques</h3>
                                    <p className="text-xs text-slate-500 mt-1">Aperçu rapide (jour & semaine)</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setIsStatsModalOpen(false)}
                                    className="p-2 hover:bg-slate-200 rounded-full transition"
                                    aria-label="Fermer"
                                    title="Fermer"
                                >
                                    <X className="w-5 h-5 text-slate-500" />
                                </button>
                            </div>

                            <div className="p-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <button
                                    type="button"
                                    onClick={() => applyStatsFilter('day-planned')}
                                    className="bg-slate-100 p-4 rounded-lg flex flex-col items-center justify-center border-l-4 border-slate-300 hover:bg-slate-200 transition text-center"
                                    title="Filtrer sur aujourd'hui"
                                >
                                    <span className="text-xs font-bold text-slate-700">Missions en cours</span>
                                    <span className="text-brand-blue font-serif text-2xl italic mt-1">{missionsCountToday}</span>
                                    <span className="text-[11px] text-teal-600 mt-1 italic">Nombre du jour</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => applyStatsFilter('week-all')}
                                    className="bg-slate-100 p-4 rounded-lg flex flex-col items-center justify-center border-l-4 border-slate-300 hover:bg-slate-200 transition text-center"
                                    title="Filtrer sur la semaine"
                                >
                                    <span className="text-xs font-bold text-slate-700">Total missions</span>
                                    <span className="text-brand-blue font-serif text-2xl italic mt-1">{missionsCountWeek}</span>
                                    <span className="text-[11px] text-teal-600 mt-1 italic">Cette semaine</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => applyStatsFilter('week-completed')}
                                    className="bg-slate-100 p-4 rounded-lg flex flex-col items-center justify-center border-l-4 border-slate-300 hover:bg-slate-200 transition text-center"
                                    title="Filtrer sur les missions terminées (semaine)"
                                >
                                    <span className="text-xs font-bold text-slate-700">Missions terminées</span>
                                    <span className="text-brand-blue font-serif text-2xl italic mt-1">{missionsCompletedWeek}</span>
                                    <span className="text-[11px] text-teal-600 mt-1 italic">Cette semaine</span>
                                </button>
                            </div>

                            <div className="p-5 border-t border-slate-100 flex justify-end">
                                <button
                                    type="button"
                                    onClick={() => setIsStatsModalOpen(false)}
                                    className="px-6 py-2 rounded-lg text-slate-600 font-bold hover:bg-slate-100 transition"
                                >
                                    Fermer
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {isQuickPlanModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
                            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-cream-50">
                                <div>
                                    <h3 className="text-lg font-serif font-bold text-slate-800">Planification rapide</h3>
                                    <p className="text-xs text-slate-500 mt-1">Créer une prestation manuellement</p>
                                </div>
                                <button type="button" onClick={() => setIsQuickPlanModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full transition">
                                    <X className="w-5 h-5 text-slate-500" />
                                </button>
                            </div>

                            <form onSubmit={handleQuickPlanSubmit} className="p-5 space-y-4 overflow-y-auto max-h-[80vh]">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Client</label>
                                    <select
                                        required
                                        name="clientId"
                                        value={quickPlanForm.clientId}
                                        onChange={() => { }}
                                        className="sr-only"
                                        tabIndex={-1}
                                    >
                                        <option value="">Sélectionner...</option>
                                        {clients.map(c => (
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                        ))}
                                    </select>
                                    <SearchableSelect
                                        options={clients.map(c => ({ value: c.id, label: c.name }))}
                                        value={quickPlanForm.clientId}
                                        onChange={(value) => setQuickPlanForm(prev => ({ ...prev, clientId: value }))}
                                        placeholder="Sélectionner..."
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Date de prestation</label>
                                    <input
                                        required
                                        type="date"
                                        value={quickPlanForm.date}
                                        onChange={(e) => setQuickPlanForm(prev => ({ ...prev, date: e.target.value }))}
                                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg focus:border-brand-blue outline-none"
                                    />
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-1">Heure début</label>
                                        <input
                                            required
                                            type="time"
                                            value={quickPlanForm.startTime}
                                            onChange={(e) => setQuickPlanForm(prev => ({ ...prev, startTime: e.target.value }))}
                                            className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg focus:border-brand-blue outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-1">Heure fin</label>
                                        <input
                                            required
                                            type="time"
                                            value={quickPlanForm.endTime}
                                            onChange={(e) => setQuickPlanForm(prev => ({ ...prev, endTime: e.target.value }))}
                                            className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg focus:border-brand-blue outline-none"
                                        />
                                    </div>
                                </div>

                                <div className="pt-2 flex justify-end gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setIsQuickPlanModalOpen(false)}
                                        className="px-5 py-2 rounded-lg text-slate-600 font-bold hover:bg-slate-100 transition"
                                        disabled={isSubmitting}
                                    >
                                        Annuler
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-5 py-2 rounded-lg bg-brand-blue text-white font-bold hover:opacity-90 transition disabled:opacity-60"
                                        disabled={isSubmitting}
                                    >
                                        {isSubmitting ? 'Création...' : 'Créer'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}


                {/* NEW MISSION MODAL */}
                {isModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
                            <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-cream-50">
                                <div>
                                    <h3 className="text-xl font-serif font-bold text-slate-800">Nouvelle Mission</h3>
                                    <p className="text-xs text-slate-500 mt-1">Ajouter une prestation au planning</p>
                                </div>
                                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full transition">
                                    <X className="w-5 h-5 text-slate-500" />
                                </button>
                            </div>

                            <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto max-h-[80vh]">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Client</label>
                                    <select
                                        required
                                        name="clientId"
                                        value={missionForm.clientId}
                                        onChange={() => { }}
                                        className="sr-only"
                                        tabIndex={-1}
                                    >
                                        <option value="">Sélectionner...</option>
                                        {clients.map(c => (
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                        ))}
                                    </select>
                                    <SearchableSelect
                                        options={clients.map(c => ({ value: c.id, label: c.name }))}
                                        value={missionForm.clientId}
                                        onChange={(value) => setMissionForm(prev => ({ ...prev, clientId: value, sourceDocumentId: '' }))}
                                        placeholder="Sélectionner..."
                                    />
                                </div>

                                {/* Liaison devis existant */}
                                {missionForm.clientId && clientSignedQuotes.length > 0 && (
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-1">
                                            Lier à un devis signé <span className="font-normal text-slate-400 text-xs">(optionnel)</span>
                                        </label>
                                        <SearchableSelect
                                            options={[
                                                { value: '', label: '(Aucun devis)' },
                                                ...clientSignedQuotes.map(d => ({
                                                    value: d.id,
                                                    label: `${d.ref} — ${d.description || d.serviceType || 'Prestation'}${d.totalTTC ? ` (${d.totalTTC}€ TTC)` : ''}`
                                                }))
                                            ]}
                                            value={missionForm.sourceDocumentId}
                                            onChange={(value) => {
                                                setMissionForm(prev => {
                                                    const selectedDoc = clientSignedQuotes.find(d => d.id === value);
                                                    return {
                                                        ...prev,
                                                        sourceDocumentId: value,
                                                        service: selectedDoc ? (selectedDoc.serviceType || selectedDoc.description || prev.service) : prev.service
                                                    };
                                                });
                                            }}
                                            placeholder="(Aucun devis)"
                                        />
                                    </div>
                                )}

                                {/* Date Logic */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-1">Date Début</label>
                                        <input
                                            required
                                            type="date"
                                            name="date"
                                            value={missionForm.date}
                                            onChange={(e) => {
                                                handleFormChange(e);
                                                // Auto-set end date to start date if empty
                                                if (!missionForm.endDate) setMissionForm(prev => ({ ...prev, endDate: e.target.value }));
                                            }}
                                            className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg focus:border-brand-blue outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-1">Date Fin (Si diff.)</label>
                                        <input
                                            type="date"
                                            name="endDate"
                                            value={missionForm.endDate}
                                            onChange={handleFormChange}
                                            className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg focus:border-brand-blue outline-none"
                                        />
                                    </div>
                                </div>

                                {/* Time Logic - GRAFTED: slot picker intégré dans le modal existant */}
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">
                                        Créneau horaire
                                        <span className="ml-1 text-xs font-normal text-slate-400">(3h, 4h, 6h ou 7h)</span>
                                    </label>
                                    <div className="grid grid-cols-3 gap-1.5 mb-3">
                                        {ALLOWED_SLOTS.map(slot => (
                                            <button
                                                key={slot.key}
                                                type="button"
                                                onClick={() => {
                                                    setSelectedSlotKey(slot.key);
                                                    setMissionForm(prev => ({ ...prev, startTime: slot.start, endTime: slot.end }));
                                                }}
                                                className={`px-1 py-2 rounded-lg text-xs font-bold border transition text-center ${selectedSlotKey === slot.key
                                                        ? 'bg-brand-blue text-white border-brand-blue shadow'
                                                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-brand-blue hover:bg-blue-50'
                                                    }`}
                                            >
                                                <div>{slot.label}</div>
                                                <div className={`text-[10px] mt-0.5 ${selectedSlotKey === slot.key ? 'text-blue-100' : 'text-slate-400'}`}>{slot.duration}h</div>
                                            </button>
                                        ))}
                                    </div>
                                    {selectedSlotKey && (
                                        <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs text-blue-700 font-semibold flex items-center gap-2 mb-3">
                                            <Clock className="w-3 h-3 shrink-0" />
                                            Créneau sélectionné : {ALLOWED_SLOTS.find(s => s.key === selectedSlotKey)?.label} — {ALLOWED_SLOTS.find(s => s.key === selectedSlotKey)?.duration}h
                                        </div>
                                    )}
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-1">Heure Début</label>
                                        <input
                                            required
                                            type="time"
                                            name="startTime"
                                            value={missionForm.startTime}
                                            onChange={(e) => { handleFormChange(e); setSelectedSlotKey(''); }}
                                            className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg focus:border-brand-blue outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-1">Heure Fin</label>
                                        <input
                                            required
                                            type="time"
                                            name="endTime"
                                            value={missionForm.endTime}
                                            onChange={(e) => { handleFormChange(e); setSelectedSlotKey(''); }}
                                            className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg focus:border-brand-blue outline-none"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 gap-4">
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-1">
                                            Prestataire
                                            {missionForm.isOvertime && (
                                                <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 bg-orange-100 text-orange-700 text-xs font-bold rounded border border-orange-300">
                                                    ⚡ Heures sup.
                                                </span>
                                            )}
                                        </label>
                                        <select
                                            name="providerId"
                                            value={missionForm.providerId}
                                            onChange={() => { }}
                                            className="sr-only"
                                            tabIndex={-1}
                                        >
                                            <option value="">(À assigner plus tard)</option>
                                            <option value={EXTERNAL_PROVIDER_ID}>🔵 EDWARD Sylvie</option>
                                            {providers.map(p => {
                                                const { label, disabled } = getProviderSelectLabel(p, missionForm.date, missionForm.startTime, missionForm.endTime, !!missionForm.isOvertime);
                                                return (
                                                    <option key={p.id} value={p.id} disabled={disabled}>
                                                        {label}
                                                    </option>
                                                );
                                            })}
                                        </select>
                                        <SearchableSelect
                                            options={[
                                                { value: '', label: '(À assigner plus tard)' },
                                                { value: EXTERNAL_PROVIDER_ID, label: '🔵 EDWARD Sylvie (toujours disponible)' },
                                                ...providers.map(p => {
                                                    const { label, disabled } = getProviderSelectLabel(p, missionForm.date, missionForm.startTime, missionForm.endTime, !!missionForm.isOvertime);
                                                    return { value: p.id, label, disabled };
                                                })
                                            ]}
                                            value={missionForm.providerId}
                                            onChange={(value) => setMissionForm(prev => ({ ...prev, providerId: value }))}
                                            placeholder="(À assigner plus tard)"
                                        />
                                        {missionForm.isOvertime && missionForm.date && missionForm.providerId && missionForm.providerId !== EXTERNAL_PROVIDER_ID && missionForm.providerId !== '' && (
                                            <div className="mt-1.5 flex items-center gap-1.5">
                                                <AlertTriangle className="w-3.5 h-3.5 text-orange-500" />
                                                <p className="text-[11px] text-orange-700">
                                                    {(() => {
                                                        const p = providers.find(pr => pr.id === missionForm.providerId);
                                                        if (!p) return null;
                                                        const available = missionForm.date ? getProviderUnavailableReason(p.id, missionForm.date, missionForm.startTime, missionForm.endTime) === null : true;
                                                        return available
                                                            ? 'Ce prestataire est normalement disponible sur ce créneau.'
                                                            : 'Ce prestataire sera traité en heures supplémentaires (indisponible normalement).';
                                                    })()}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-1">
                                            2e Prestataire <span className="font-normal text-slate-400 text-xs">(optionnel)</span>
                                            {missionForm.isOvertime && (
                                                <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 bg-orange-100 text-orange-700 text-xs font-bold rounded border border-orange-300">
                                                    ⚡ Heures sup.
                                                </span>
                                            )}
                                        </label>
                                        <SearchableSelect
                                            options={[
                                                { value: '', label: '(Aucun)' },
                                                { value: EXTERNAL_PROVIDER_ID, label: '🔵 EDWARD Sylvie' },
                                                ...providers.filter(p => p.id !== missionForm.providerId).map(p => {
                                                    const { label, disabled } = getProviderSelectLabel(p, missionForm.date, missionForm.startTime, missionForm.endTime, !!missionForm.isOvertime);
                                                    return { value: p.id, label, disabled };
                                                })
                                            ]}
                                            value={missionForm.provider2Id}
                                            onChange={(value) => setMissionForm(prev => ({ ...prev, provider2Id: value }))}
                                            placeholder="(Aucun)"
                                        />
                                        {missionForm.isOvertime && missionForm.date && missionForm.provider2Id && missionForm.provider2Id !== EXTERNAL_PROVIDER_ID && missionForm.provider2Id !== '' && (
                                            <div className="mt-1.5 flex items-center gap-1.5">
                                                <AlertTriangle className="w-3.5 h-3.5 text-orange-500" />
                                                <p className="text-[11px] text-orange-700">
                                                    {(() => {
                                                        const p = providers.find(pr => pr.id === missionForm.provider2Id);
                                                        if (!p) return null;
                                                        const available = missionForm.date ? getProviderUnavailableReason(p.id, missionForm.date, missionForm.startTime, missionForm.endTime) === null : true;
                                                        return available
                                                            ? 'Ce prestataire est normalement disponible sur ce créneau.'
                                                            : 'Ce prestataire sera traité en heures supplémentaires (indisponible normalement).';
                                                    })()}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* GRAFTED: Suggestions automatiques de prestataires */}
                                {missionForm.date && missionForm.startTime && missionForm.endTime && (
                                    <div className="mt-2">
                                        {missionForm.isOvertime && (
                                            <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 mb-3 text-xs text-orange-700 flex items-start gap-2">
                                                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-orange-500" />
                                                <div>
                                                    <div className="font-bold">Mode heures supplémentaires activé</div>
                                                    <div className="font-normal mt-0.5">
                                                        Tous les prestataires sont affichés dans la liste déroulante, y compris ceux normalement indisponibles.
                                                        Les prestataires indisponibles seront marqués <span className="font-bold">(indisponible&nbsp;: raison)</span>.
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                        {providerSuggestions.suggestions.length > 0 ? (
                                            <div className="space-y-2">
                                                <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wide">
                                                    <User className="w-3.5 h-3.5" /> Suggestions automatiques
                                                </div>
                                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                                    {providerSuggestions.suggestions.map(s => (
                                                        <button
                                                            key={s.provider.id}
                                                            type="button"
                                                            onClick={() => setMissionForm(prev => ({ ...prev, providerId: s.provider.id }))}
                                                            className={`p-3 rounded-xl border-2 text-left transition hover:shadow-md ${missionForm.providerId === s.provider.id
                                                                    ? 'border-brand-blue bg-blue-50'
                                                                    : 'border-emerald-200 bg-white hover:border-emerald-400'
                                                                }`}
                                                        >
                                                            <div className="flex items-center gap-2 mb-1.5">
                                                                <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-black text-indigo-700 shrink-0">
                                                                    {(s.provider.firstName || '')[0]}{(s.provider.lastName || '')[0] || ''}
                                                                </div>
                                                                <div className="min-w-0">
                                                                    <div className="font-bold text-sm text-slate-800 truncate">
                                                                        {s.provider.firstName || '?'} {(s.provider.lastName || '')[0] || ''}.
                                                                    </div>
                                                                    <div className="text-[10px] text-slate-500">
                                                                        {s.dailyHours.toFixed(1)}h aujourd'hui / {s.weekHours.toFixed(0)}h sem.
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center justify-between">
                                                                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">
                                                                    {s.availableHours.toFixed(1)}h dispo
                                                                </span>
                                                                {s.hasWorkedForClient && (
                                                                    <span className="text-[9px] font-bold text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded border border-violet-100">
                                                                        ✨ Client fidèle
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        ) : (
                                            <div className={`rounded-xl p-3 text-xs font-semibold flex items-start gap-2 ${missionForm.isOvertime ? 'bg-orange-50 border border-orange-200 text-orange-700' : 'bg-amber-50 border border-amber-200 text-amber-700'}`}>
                                                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                                                <div>
                                                    <div className="font-bold">
                                                        {missionForm.isOvertime ? 'Aucune prestataire normalement disponible' : 'Aucune prestataire disponible'}
                                                    </div>
                                                    <div className="font-normal mt-1">
                                                        {missionForm.isOvertime
                                                            ? 'Utilisez la liste déroulante pour sélectionner un prestataire en heures supplémentaires.'
                                                            : (Array.from(providerSuggestions.reasons.values()).flat().slice(0, 3).join(' • ') || 'Vérifiez les créneaux disponibles')
                                                        }
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Service</label>
                                    <SearchableSelect
                                        options={[
                                            { value: 'Ménage', label: 'Ménage' },
                                            { value: 'Jardinage', label: 'Jardinage' },
                                            { value: 'Bricolage', label: 'Bricolage' },
                                            { value: 'Autre', label: 'Autre' },
                                            { value: 'Personnalisé', label: 'Personnalisé' },
                                        ]}
                                        value={missionForm.service}
                                        onChange={(value) => setMissionForm(prev => ({ ...prev, service: value }))}
                                        placeholder="Sélectionner un service..."
                                        triggerClassName="p-0"
                                    />
                                </div>

                                {/* Recurrence Section */}
                                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                                    <div className="flex items-center gap-2 mb-2 text-brand-blue font-bold text-sm">
                                        <Repeat className="w-4 h-4" /> Options de Récurrence
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 mb-1">Type</label>
                                            <select
                                                name="recurrence"
                                                value={missionForm.recurrence}
                                                onChange={() => { }}
                                                className="sr-only"
                                                tabIndex={-1}
                                            >
                                                <option value="none">Ponctuel (1 fois)</option>
                                                <option value="weekly">Hebdomadaire (Tous les 7 jours)</option>
                                                <option value="biweekly">Bimensuel (Tous les 14 jours)</option>
                                                <option value="monthly">Mensuel (Même date)</option>
                                            </select>
                                            <SearchableSelect
                                                options={[
                                                    { value: 'none', label: 'Ponctuel (1 fois)' },
                                                    { value: 'weekly', label: 'Hebdomadaire (Tous les 7 jours)' },
                                                    { value: 'biweekly', label: 'Bimensuel (Tous les 14 jours)' },
                                                    { value: 'monthly', label: 'Mensuel (Même date)' }
                                                ]}
                                                value={missionForm.recurrence}
                                                onChange={(value) => setMissionForm(prev => ({ ...prev, recurrence: value }))}
                                            />
                                        </div>
                                        {missionForm.recurrence !== 'none' && (
                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 mb-1">Répétitions</label>
                                                <input
                                                    type="number"
                                                    name="occurrences"
                                                    min="2"
                                                    max="52"
                                                    value={missionForm.occurrences}
                                                    onChange={handleFormChange}
                                                    className="w-full p-2 bg-white border border-slate-200 rounded-lg text-sm outline-none"
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Heures supplémentaires */}
                                <div className="flex items-center gap-3 bg-orange-50 border border-orange-200 p-3 rounded-lg">
                                    <input
                                        type="checkbox"
                                        id="missionOvertime"
                                        checked={missionForm.isOvertime}
                                        onChange={(e) => setMissionForm(prev => ({ ...prev, isOvertime: e.target.checked }))}
                                        className="w-4 h-4 text-orange-600 accent-orange-500"
                                    />
                                    <label htmlFor="missionOvertime" className="text-sm font-bold text-orange-800 cursor-pointer select-none">
                                        En heures supplémentaires
                                        <span className="block text-xs font-normal text-orange-600 mt-0.5">
                                            Ignore les contraintes de disponibilité (conflits, jours de repos, horaires)
                                        </span>
                                    </label>
                                </div>

                                <div className="pt-4 flex justify-end gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setIsModalOpen(false)}
                                        className="px-6 py-2 rounded-lg text-slate-600 font-bold hover:bg-slate-100 transition"
                                        disabled={isSubmitting}
                                    >
                                        Annuler
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isSubmitting}
                                        className="px-6 py-2 rounded-lg bg-brand-blue text-white font-bold hover:bg-teal-700 transition shadow-lg shadow-brand-blue/20 flex items-center gap-2 disabled:opacity-70"
                                    >
                                        {isSubmitting ? <div className="w-10 h-3 bg-white/40 rounded animate-pulse" /> : <CheckCircle className="w-4 h-4" />}
                                        {isSubmitting ? 'Enregistrement...' : 'Planifier'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* REMINDER MODAL */}
                {isReminderModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
                        <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200">
                            <div className="p-4 bg-yellow-50 border-b border-yellow-100 flex justify-between items-center">
                                <h3 className="font-bold text-yellow-800 flex items-center gap-2"><Flag className="w-4 h-4" /> Nouveau Rappel</h3>
                                <button onClick={() => setIsReminderModalOpen(false)}><X className="w-5 h-5 text-slate-400" /></button>
                            </div>
                            <form onSubmit={handleReminderSubmit} className="p-6 space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">Message</label>
                                    <input
                                        required
                                        type="text"
                                        className="w-full border rounded p-2 text-sm"
                                        placeholder="Ex: Appeler Mr Dupont..."
                                        value={reminderForm.text}
                                        onChange={(e) => setReminderForm({ ...reminderForm, text: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">Date</label>
                                    <input
                                        required
                                        type="date"
                                        className="w-full border rounded p-2 text-sm"
                                        value={reminderForm.date}
                                        onChange={(e) => setReminderForm({ ...reminderForm, date: e.target.value })}
                                    />
                                </div>
                                <div className="flex items-center gap-2 pt-2">
                                    <input
                                        type="checkbox"
                                        id="notifyEmail"
                                        checked={reminderForm.notifyEmail}
                                        onChange={(e) => setReminderForm({ ...reminderForm, notifyEmail: e.target.checked })}
                                        className="w-4 h-4 text-brand-blue"
                                    />
                                    <label htmlFor="notifyEmail" className="text-sm font-bold text-slate-700">M'envoyer une notification par email</label>
                                </div>
                                <div className="flex justify-end pt-4">
                                    <button type="submit" disabled={isSubmitting} className="bg-brand-blue text-white px-4 py-2 rounded font-bold text-sm hover:bg-teal-700">
                                        {isSubmitting ? '...' : 'Ajouter au planning'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* ASSIGNMENT MODAL */}
                {selectedMissionId && missionToAssign && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/90 backdrop-blur-sm p-4">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
                            <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-cream-50">
                                <div>
                                    <h3 className="text-xl font-serif font-bold text-slate-800">Assigner Prestataire</h3>
                                    <p className="text-xs text-slate-500 mt-1">Envoyer l'ordre de mission</p>
                                </div>
                                <button disabled={isSubmitting} onClick={() => setSelectedMissionId(null)} className="p-2 hover:bg-slate-200 rounded-full transition disabled:opacity-50">
                                    <X className="w-5 h-5 text-slate-500" />
                                </button>
                            </div>

                            <div className="p-6 space-y-6 relative">
                                {isSubmitting && (
                                    <div className="absolute inset-0 z-10 bg-white/70 backdrop-blur-[1px] flex items-center justify-center">
                                        <div className="flex items-center gap-3 bg-white border border-slate-200 shadow-sm rounded-xl px-4 py-3">
                                            <Loader2 className="w-5 h-5 animate-spin text-brand-blue" />
                                            <div className="text-sm font-extrabold text-slate-700">Assignation en cours…</div>
                                        </div>
                                    </div>
                                )}
                                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 text-sm">
                                    <h4 className="font-bold text-slate-700 mb-2 border-b pb-1">Détails Mission</h4>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="text-slate-500">Client</div>
                                        <div className="font-bold text-slate-800">{missionToAssign.clientName}</div>
                                        <div className="text-slate-500">Date</div>
                                        <div className="font-bold text-slate-800">{missionToAssign.date}</div>
                                        <div className="text-slate-500">Horaire</div>
                                        <div className="font-bold text-slate-800">{missionToAssign.startTime} - {missionToAssign.endTime}</div>
                                        <div className="text-slate-500">Service</div>
                                        <div className="font-bold text-brand-blue">{missionToAssign.service}</div>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">
                                        1er Prestataire *
                                        {assignIsOvertime && (
                                            <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 bg-orange-100 text-orange-700 text-xs font-bold rounded border border-orange-300">
                                                ⚡ Heures sup.
                                            </span>
                                        )}
                                    </label>
                                    <SearchableSelect
                                        options={[
                                            { value: '', label: 'Sélectionner dans la liste...' },
                                            { value: EXTERNAL_PROVIDER_ID, label: '🔵 EDWARD Sylvie (toujours disponible)' },
                                            ...providers.map(p => {
                                                const dateStr = missionToAssign?.date || '';
                                                const startTime = missionToAssign?.startTime || '00:00';
                                                const endTime = missionToAssign?.endTime || '23:59';
                                                const { label, disabled: isDisabled } = getProviderSelectLabel(p, dateStr, startTime, endTime, !!assignIsOvertime);
                                                return { value: p.id, label, disabled: isDisabled };
                                            })
                                        ]}
                                        value={assignProviderId}
                                        onChange={(value) => setAssignProviderId(value)}
                                        placeholder="Sélectionner dans la liste..."
                                        disabled={isSubmitting}
                                        usePortal={true}
                                    />
                                    {assignIsOvertime && assignProviderId && assignProviderId !== EXTERNAL_PROVIDER_ID && missionToAssign?.date && (
                                        <div className="mt-1.5 flex items-center gap-1.5">
                                            <AlertTriangle className="w-3.5 h-3.5 text-orange-500" />
                                            <p className="text-[11px] text-orange-700">
                                                {(() => {
                                                    const p = providers.find(pr => pr.id === assignProviderId);
                                                    if (!p) return null;
                                                    const available = getProviderUnavailableReason(p.id, missionToAssign.date, missionToAssign.startTime, missionToAssign.endTime) === null;
                                                    return available
                                                        ? 'Ce prestataire est normalement disponible sur ce créneau.'
                                                        : 'Ce prestataire sera traité en heures supplémentaires (indisponible normalement).';
                                                })()}
                                            </p>
                                        </div>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-violet-700 mb-2">
                                        2e Prestataire (binôme, optionnel)
                                        {assignIsOvertime && (
                                            <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 bg-orange-100 text-orange-700 text-xs font-bold rounded border border-orange-300">
                                                ⚡ Heures sup.
                                            </span>
                                        )}
                                    </label>
                                    <SearchableSelect
                                        options={[
                                            { value: '', label: 'Aucun (prestataire seul)' },
                                            { value: EXTERNAL_PROVIDER_ID, label: '🔵 EDWARD Sylvie' },
                                            ...providers.filter(p => p.id !== assignProviderId).map(p => {
                                                const dateStr = missionToAssign?.date || '';
                                                const startTime = missionToAssign?.startTime || '00:00';
                                                const endTime = missionToAssign?.endTime || '23:59';
                                                const { label, disabled: isDisabled } = getProviderSelectLabel(p, dateStr, startTime, endTime, !!assignIsOvertime);
                                                return { value: p.id, label, disabled: isDisabled };
                                            })
                                        ]}
                                        value={assignSecondProviderSelect}
                                        onChange={(value) => setAssignSecondProviderSelect(value)}
                                        placeholder="Aucun (prestataire seul)"
                                        disabled={isSubmitting}
                                        usePortal={true}
                                    />
                                    {assignIsOvertime && assignSecondProviderSelect && assignSecondProviderSelect !== EXTERNAL_PROVIDER_ID && missionToAssign?.date && (
                                        <div className="mt-1.5 flex items-center gap-1.5">
                                            <AlertTriangle className="w-3.5 h-3.5 text-orange-500" />
                                            <p className="text-[11px] text-orange-700">
                                                {(() => {
                                                    const p = providers.find(pr => pr.id === assignSecondProviderSelect);
                                                    if (!p) return null;
                                                    const available = getProviderUnavailableReason(p.id, missionToAssign.date, missionToAssign.startTime, missionToAssign.endTime) === null;
                                                    return available
                                                        ? 'Ce prestataire est normalement disponible sur ce créneau.'
                                                        : 'Ce prestataire sera traité en heures supplémentaires (indisponible normalement).';
                                                })()}
                                            </p>
                                        </div>
                                    )}
                                </div>

                                {/* Heures supplémentaires */}
                                <div className="flex items-center gap-3 bg-orange-50 border border-orange-200 p-3 rounded-lg">
                                    <input
                                        type="checkbox"
                                        id="assignOvertime"
                                        checked={assignIsOvertime}
                                        onChange={(e) => setAssignIsOvertime(e.target.checked)}
                                        className="w-4 h-4 text-orange-600 accent-orange-500"
                                        disabled={isSubmitting}
                                    />
                                    <label htmlFor="assignOvertime" className="text-sm font-bold text-orange-800 cursor-pointer select-none">
                                        En heures supplémentaires
                                        <span className="block text-xs font-normal text-orange-600 mt-0.5">
                                            Ignore les contraintes de disponibilité
                                        </span>
                                    </label>
                                </div>

                                <div className="bg-blue-50 p-3 rounded-lg flex items-start gap-3">
                                    <Mail className="w-5 h-5 text-brand-blue mt-0.5" />
                                    <p className="text-xs text-blue-800">
                                        En validant, un email automatique contenant les détails (Date, Heure, Adresse, Client) sera envoyé au prestataire sélectionné.
                                    </p>
                                </div>

                                <div className="flex justify-end gap-3 pt-2">
                                    <button disabled={isSubmitting} onClick={() => setSelectedMissionId(null)} className="px-4 py-2 text-slate-500 font-bold hover:bg-slate-100 rounded-lg transition disabled:opacity-50">Annuler</button>
                                    <button
                                        onClick={handleConfirmAssignment}
                                        disabled={!assignProviderId || isSubmitting}
                                        className="px-6 py-2 bg-brand-blue text-white font-bold rounded-lg hover:bg-teal-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                    >
                                        {isSubmitting ? (
                                            <>
                                                <div className="w-16 h-4 bg-white/40 rounded animate-pulse" />
                                                Assignation...
                                            </>
                                        ) : (
                                            <>
                                                <Mail className="w-4 h-4" /> Envoyer & Assigner
                                            </>
                                        )}
                                    </button>
                                </div>
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
                                    Êtes-vous sûr de vouloir supprimer définitivement {selectedMissionIds.size} mission(s) ?
                                </p>
                                <div className="flex gap-3 w-full">
                                    <button
                                        onClick={() => setDeleteConfirmOpen(false)}
                                        className="flex-1 py-2 text-slate-600 font-bold bg-slate-100 hover:bg-slate-200 rounded-lg transition"
                                    >
                                        Annuler
                                    </button>
                                    <button
                                        onClick={executeBulkDeleteMissions}
                                        className="flex-1 py-2 text-white font-bold bg-red-600 hover:bg-red-700 rounded-lg transition shadow-md"
                                    >
                                        Supprimer
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {isProvisionalDetailsModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200 max-h-[85vh]">
                            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-cream-50">
                                <div>
                                    <h3 className="text-lg font-serif font-bold text-slate-800">
                                        {selectedProvisionalDetails?.isSignedQuote ? 'Séance Devis Signé' : 'Séance Devis (En attente)'}
                                    </h3>
                                    <p className="text-xs text-slate-500 mt-0.5">
                                        {selectedProvisionalDetails?.quoteRef ? `Réf : ${selectedProvisionalDetails.quoteRef}` : 'Détail de la séance'}
                                    </p>
                                </div>
                                <button
                                    onClick={() => {
                                        setIsProvisionalDetailsModalOpen(false);
                                        setSelectedProvisionalDetails(null);
                                    }}
                                    className="p-2 hover:bg-slate-200 rounded-full transition"
                                >
                                    <X className="w-5 h-5 text-slate-500" />
                                </button>
                            </div>
                            <div className="p-5 overflow-y-auto flex-1 min-h-0 space-y-4">
                                <div className={`p-3 rounded-xl border flex items-center gap-2 ${selectedProvisionalDetails?.isSignedQuote ? 'bg-blue-50 border-blue-200 text-blue-800' : 'bg-orange-50 border-orange-200 text-orange-800'}`}>
                                    {selectedProvisionalDetails?.isSignedQuote ? (
                                        <>
                                            <CheckCircle className="w-5 h-5 text-blue-600 shrink-0" />
                                            <span className="text-xs font-bold">Devis signé & validé — Prêt pour assignation prestataire</span>
                                        </>
                                    ) : (
                                        <>
                                            <AlertTriangle className="w-5 h-5 text-orange-600 shrink-0" />
                                            <span className="text-xs font-bold">En attente de validation / signature par le client</span>
                                        </>
                                    )}
                                </div>

                                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs space-y-2.5">
                                    <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                                        <span className="text-slate-500 font-medium">Client</span>
                                        <span className="font-bold text-slate-800">{selectedProvisionalDetails?.clientName || '—'}</span>
                                    </div>
                                    <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                                        <span className="text-slate-500 font-medium">Date</span>
                                        <span className="font-bold text-slate-800">{selectedProvisionalDetails?.date ? dayjs.tz(selectedProvisionalDetails.date, 'YYYY-MM-DD', MARTINIQUE_TIMEZONE).format('dddd DD/MM/YYYY') : '—'}</span>
                                    </div>
                                    <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                                        <span className="text-slate-500 font-medium">Créneau & Durée</span>
                                        <span className="font-bold text-slate-800">{selectedProvisionalDetails?.startTime || '—'} - {selectedProvisionalDetails?.endTime || '—'} ({selectedProvisionalDetails?.duration || 3}h)</span>
                                    </div>
                                    <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                                        <span className="text-slate-500 font-medium">Prestataire</span>
                                        <span className="font-bold text-slate-800">{selectedProvisionalDetails?.providerName || 'À assigner'}</span>
                                    </div>
                                    <div className="flex justify-between items-center py-1">
                                        <span className="text-slate-500 font-medium">Prestation</span>
                                        <span className="font-bold text-brand-blue">{selectedProvisionalDetails?.service || 'Devis'}</span>
                                    </div>
                                </div>

                                <div className="flex flex-col gap-2 pt-2">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const idToAssign = selectedProvisionalDetails?.id;
                                            setIsProvisionalDetailsModalOpen(false);
                                            setSelectedProvisionalDetails(null);
                                            if (idToAssign) {
                                                setSelectedMissionId(idToAssign);
                                            }
                                        }}
                                        className="w-full py-2.5 px-4 rounded-xl bg-brand-blue text-white font-bold text-xs hover:opacity-95 transition flex items-center justify-center gap-2 shadow-sm"
                                    >
                                        <User className="w-4 h-4" /> Assigner un prestataire à cette séance
                                    </button>
                                    {selectedProvisionalDetails?.sourceDocumentId && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const docId = selectedProvisionalDetails.sourceDocumentId;
                                                setIsProvisionalDetailsModalOpen(false);
                                                setSelectedProvisionalDetails(null);
                                                navigate(`/invoices/${docId}`);
                                            }}
                                            className="w-full py-2 px-4 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs hover:bg-slate-200 transition text-center"
                                        >
                                            Voir les détails complets du devis
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Mission Details Modal */}
                {isDetailsModalOpen && selectedMissionDetails && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
                        <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[94vh] overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col">
                            <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-cream-50">
                                <div>
                                    <h3 className="text-xl font-serif font-bold text-slate-800">Détails de la Mission</h3>
                                    <p className="text-xs text-slate-500 mt-1">Informations complètes sur la prestation</p>
                                </div>
                                <button onClick={() => { setIsDetailsModalOpen(false); setSelectedMissionDetails(null); }} className="p-2 hover:bg-slate-200 rounded-full transition">
                                    <X className="w-5 h-5 text-slate-500" />
                                </button>
                            </div>

                            <div className="p-6 space-y-6 overflow-y-auto flex-1">
                                {/* Client Information */}
                                <div className="bg-slate-50 p-4 rounded-lg">
                                    <h4 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                                        <User className="w-4 h-4" /> Client
                                    </h4>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                                        <div>
                                            <span className="text-slate-500">Nom complet:</span>
                                            <p className="font-semibold">{detailClient?.name || selectedMissionDetails.clientName || '—'}</p>
                                        </div>
                                        <div>
                                            <span className="text-slate-500">Prénom:</span>
                                            <p className="font-semibold">{(() => {
                                                const n = (detailClient?.name || selectedMissionDetails.clientName || '').trim();
                                                if (!n) return '—';
                                                const parts = n.split(' ').filter(Boolean);
                                                if (parts.length <= 1) return n;
                                                parts.pop();
                                                return parts.join(' ') || '—';
                                            })()}</p>
                                        </div>
                                        <div>
                                            <span className="text-slate-500">Nom:</span>
                                            <p className="font-semibold">{(() => {
                                                const n = (detailClient?.name || selectedMissionDetails.clientName || '').trim();
                                                if (!n) return '—';
                                                const parts = n.split(' ').filter(Boolean);
                                                if (parts.length <= 1) return n;
                                                return parts[parts.length - 1] || '—';
                                            })()}</p>
                                        </div>
                                        <div>
                                            <span className="text-slate-500">ID client:</span>
                                            <p className="font-semibold text-xs">{detailClient?.id || selectedMissionDetails.clientId || '—'}</p>
                                        </div>

                                        <div>
                                            <span className="text-slate-500">Téléphone:</span>
                                            <p className="font-semibold">{detailClient?.phone || '—'}</p>
                                        </div>
                                        <div>
                                            <span className="text-slate-500">Email:</span>
                                            <p className="font-semibold">{detailClient?.email || '—'}</p>
                                        </div>

                                        <div className="sm:col-span-2">
                                            <span className="text-slate-500">Adresse:</span>
                                            <p className="font-semibold">{detailClient?.address || '—'}</p>
                                        </div>

                                        <div>
                                            <span className="text-slate-500">Ville:</span>
                                            <p className="font-semibold">{detailClient?.city || '—'}</p>
                                        </div>
                                        <div>
                                            <span className="text-slate-500">Pack:</span>
                                            <p className="font-semibold">{detailClient?.pack || '—'}</p>
                                        </div>

                                        <div>
                                            <span className="text-slate-500">Statut client:</span>
                                            <p className="font-semibold">{detailClient?.status || '—'}</p>
                                        </div>
                                        <div>
                                            <span className="text-slate-500">Client depuis:</span>
                                            <p className="font-semibold">{detailClient?.since || '—'}</p>
                                        </div>

                                        <div>
                                            <span className="text-slate-500">Packs consommés:</span>
                                            <p className="font-semibold">{typeof detailClient?.packsConsumed === 'number' ? detailClient.packsConsumed : '—'}</p>
                                        </div>
                                        <div>
                                            <span className="text-slate-500">Heures fidélité:</span>
                                            <p className="font-semibold">{typeof detailClient?.loyaltyHoursAvailable === 'number' ? detailClient.loyaltyHoursAvailable : '—'}</p>
                                        </div>

                                        <div>
                                            <span className="text-slate-500">Avis laissé:</span>
                                            <p className="font-semibold">{detailClient?.hasLeftReview === true ? 'Oui' : detailClient?.hasLeftReview === false ? 'Non' : '—'}</p>
                                        </div>
                                        <div>
                                            <span className="text-slate-500">Mot de passe initial:</span>
                                            <p className="font-semibold">{detailClient?.initialPassword ? String(detailClient.initialPassword) : '—'}</p>
                                        </div>

                                        <div>
                                            <span className="text-slate-500">Date mission:</span>
                                            <p className="font-semibold">{dayjs.tz(selectedMissionDetails.date, 'YYYY-MM-DD', MARTINIQUE_TIMEZONE).format('DD/MM/YYYY')}</p>
                                        </div>
                                        <div>
                                            <span className="text-slate-500">Horaires:</span>
                                            <p className="font-semibold">{selectedMissionDetails.startTime} - {selectedMissionDetails.endTime}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Prestataire Information */}
                                <div className="bg-blue-50 p-4 rounded-lg">
                                    <h4 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                                        <Briefcase className="w-4 h-4" /> Prestataire
                                    </h4>
                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                        <div>
                                            <span className="text-slate-500">Nom:</span>
                                            <p className="font-semibold">{selectedMissionDetails.providerName}</p>
                                        </div>
                                        <div>
                                            <span className="text-slate-500">Statut:</span>
                                            <p className="font-semibold">
                                                {(() => {
                                                    const effStatus = getEffectiveStatus(selectedMissionDetails);
                                                    return (
                                                        <span className={getStatusBadgeClasses(effStatus)}>
                                                            {getStatusLabel(effStatus)}
                                                        </span>
                                                    );
                                                })()}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Mission Details */}
                                <div className="bg-green-50 p-4 rounded-lg">
                                    <h4 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                                        <Calendar className="w-4 h-4" /> Mission
                                    </h4>
                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                        <div>
                                            <span className="text-slate-500">Service:</span>
                                            <p className="font-semibold">{selectedMissionDetails.service}</p>
                                        </div>
                                        <div>
                                            <span className="text-slate-500">Horaires:</span>
                                            <p className="font-semibold">{selectedMissionDetails.startTime} - {selectedMissionDetails.endTime}</p>
                                        </div>
                                        <div>
                                            <span className="text-slate-500">Durée:</span>
                                            <p className="font-semibold">{selectedMissionDetails.duration}h</p>
                                        </div>
                                        <div>
                                            <span className="text-slate-500">ID Mission:</span>
                                            <p className="font-semibold text-xs">{selectedMissionDetails.id}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Additional Information */}
                                {selectedMissionDetails.sourceDocumentId && (() => {
                                    const parentQuote = documents.find(d => d.id === selectedMissionDetails.sourceDocumentId);
                                    if (!parentQuote) return (
                                        <div className="bg-purple-50 p-4 rounded-lg">
                                            <h4 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                                                <FileText className="w-4 h-4" /> Source
                                            </h4>
                                            <p className="text-sm">
                                                <span className="text-slate-500">Origine:</span>
                                                <span className="font-semibold ml-2">
                                                    {selectedMissionDetails.source === 'devis' ? 'Devis signé' : 'Création manuelle'}
                                                </span>
                                            </p>
                                        </div>
                                    );

                                    // Récupérer toutes les missions du pack
                                    const packMissions = missions
                                        .filter(m => m.sourceDocumentId === parentQuote.id)
                                        .sort((a, b) => (a.date || '').localeCompare(b.date || ''));
                                    const splitConfig = parentQuote.splitBillingConfig;
                                    const currentSessionIndex = packMissions.findIndex(m => m.id === selectedMissionDetails.id);

                                    return (
                                        <div className="space-y-4">
                                            {/* Info Devis Parent */}
                                            <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-200">
                                                <h4 className="font-bold text-indigo-800 mb-3 flex items-center gap-2">
                                                    <Package className="w-4 h-4" /> Devis Parent — Pack
                                                </h4>
                                                <div className="grid grid-cols-2 gap-3 text-sm">
                                                    <div>
                                                        <span className="text-slate-500">Référence :</span>
                                                        <span className="font-semibold ml-2 text-indigo-700">{parentQuote.ref}</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-slate-500">Client :</span>
                                                        <span className="font-semibold ml-2">{parentQuote.clientName || '—'}</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-slate-500">Montant total :</span>
                                                        <span className="font-semibold ml-2">{parentQuote.totalTTC?.toFixed(2) || '0.00'} €</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-slate-500">Sessions totales :</span>
                                                        <span className="font-semibold ml-2">{parentQuote.totalSessions || parentQuote.slotsData?.length || packMissions.length}</span>
                                                    </div>
                                                    {splitConfig && (
                                                        <>
                                                            <div>
                                                                <span className="text-slate-500">Tranches :</span>
                                                                <span className="font-semibold ml-2">{splitConfig.totalSplits}</span>
                                                            </div>
                                                            <div>
                                                                <span className="text-slate-500">Mode :</span>
                                                                <span className="font-semibold ml-2 text-xs">
                                                                    {splitConfig.billingMode === 'at_signature' ? 'À la signature' :
                                                                        splitConfig.billingMode === 'after_completion' ? 'Après complétion' : 'Mixte'}
                                                                </span>
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                                {/* Session courante */}
                                                {currentSessionIndex >= 0 && (
                                                    <div className="mt-3 pt-3 border-t border-indigo-200">
                                                        <span className="text-xs text-indigo-600 font-semibold">
                                                            Session {currentSessionIndex + 1} / {packMissions.length} du pack
                                                        </span>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Toutes les sessions du pack */}
                                            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                                                <h4 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                                                    <Calendar className="w-4 h-4" /> Toutes les Sessions ({packMissions.length})
                                                </h4>
                                                <div className="space-y-2">
                                                    {packMissions.map((m, idx) => {
                                                        const sessionNum = idx + 1;
                                                        const isCurrentMission = m.id === selectedMissionDetails.id;
                                                        const isCompleted = getEffectiveStatus(m) === 'completed';
                                                        const isInProgress = m.status === 'in_progress';
                                                        const isRealized = false; // désormais géré par getEffectiveStatus

                                                        // Trouver la tranche et la facture associée
                                                        const coveringSplit = splitConfig?.splits.find(s => s.sessions.includes(sessionNum));
                                                        const isInvoiced = coveringSplit?.status === 'invoiced' || coveringSplit?.status === 'paid';

                                                        return (
                                                            <div
                                                                key={m.id}
                                                                className={`flex items-center justify-between p-2.5 rounded-lg border ${isCurrentMission ? 'bg-indigo-100 border-indigo-300 ring-1 ring-indigo-200' :
                                                                        isInvoiced ? 'bg-blue-50 border-blue-200' :
                                                                            isCompleted ? 'bg-emerald-50 border-emerald-200' :
                                                                                isInProgress ? 'bg-amber-50 border-amber-200' :
                                                                                    isRealized ? 'bg-emerald-50 border-emerald-200' :
                                                                                        'bg-white border-slate-200'
                                                                    }`}
                                                            >
                                                                <div className="flex items-center gap-2">
                                                                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${isCurrentMission ? 'bg-indigo-500 text-white' :
                                                                            isInvoiced ? 'bg-blue-100 text-blue-700' :
                                                                                isCompleted ? 'bg-emerald-100 text-emerald-700' :
                                                                                    isInProgress ? 'bg-amber-100 text-amber-700' :
                                                                                        isRealized ? 'bg-emerald-100 text-emerald-700' :
                                                                                            'bg-slate-100 text-slate-500'
                                                                        }`}>
                                                                        {sessionNum}
                                                                    </span>
                                                                    <div>
                                                                        <div className="text-sm font-medium text-slate-700">
                                                                            {m.date ? dayjs.tz(m.date, 'YYYY-MM-DD', MARTINIQUE_TIMEZONE).format('DD/MM/YYYY') : '—'}
                                                                            <span className="text-xs text-slate-500 ml-1">{m.startTime}-{m.endTime}</span>
                                                                        </div>
                                                                        {m.providerName && (
                                                                            <div className="text-xs text-slate-500">{m.providerName}</div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                                <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${isCurrentMission ? 'bg-indigo-200 text-indigo-800' :
                                                                        isInvoiced ? 'bg-blue-100 text-blue-700' :
                                                                            isCompleted ? 'bg-emerald-100 text-emerald-700' :
                                                                                isInProgress ? 'bg-amber-100 text-amber-700' :
                                                                                    isRealized ? 'bg-emerald-100 text-emerald-700' :
                                                                                        'bg-slate-100 text-slate-500'
                                                                    }`}>
                                                                    {isCurrentMission ? '← Actuelle' :
                                                                        isInvoiced ? 'Facturée' :
                                                                            isCompleted ? 'Complétée' :
                                                                                isInProgress ? 'En cours' :
                                                                                    isRealized ? 'Réalisée' : 'À venir'}
                                                                </span>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>

                            <div className="p-6 border-t border-slate-100 flex flex-col sm:flex-row sm:justify-end gap-3 shrink-0">
                                {selectedMissionDetails.sourceDocumentId && (
                                    <button
                                        onClick={() => {
                                            setIsDetailsModalOpen(false);
                                            setSelectedMissionDetails(null);
                                            navigate(`/admin/devis/${selectedMissionDetails.sourceDocumentId}`);
                                        }}
                                        className="w-full sm:w-auto px-6 py-2 bg-indigo-50 text-indigo-700 font-bold rounded-lg hover:bg-indigo-100 transition flex items-center justify-center gap-2 border border-indigo-200"
                                    >
                                        <ExternalLink className="w-4 h-4" />
                                        <span className="text-sm text-indigo-700">Voir le devis {documents.find(d => d.id === selectedMissionDetails.sourceDocumentId)?.ref || ''}</span>
                                    </button>
                                )}
                                <button
                                    onClick={() => {
                                        setAssignProviderId('');
                                        setIsDetailsModalOpen(false);
                                        setSelectedMissionDetails(null);
                                        setSelectedMissionId(selectedMissionDetails.id);
                                    }}
                                    className="w-full sm:w-auto px-6 py-2 bg-brand-blue text-white font-bold rounded-lg hover:opacity-90 transition flex items-center justify-center gap-2"
                                >
                                    <Mail className="w-4 h-4" />
                                    <span className="text-sm text-white">Assigner prestataire</span>
                                </button>
                                <button
                                    onClick={handleCopyMissionDetails}
                                    className="w-full sm:w-auto px-6 py-2 bg-white border border-slate-200 text-slate-700 font-bold rounded-lg hover:bg-slate-50 transition flex items-center justify-center gap-2"
                                >
                                    <CopyIcon className="w-4 h-4" />
                                    <span className="text-sm text-slate-700">Copier les infos</span>
                                </button>
                                <button
                                    onClick={() => {
                                        setIsDetailsModalOpen(false);
                                        openEditMissionModal();
                                    }}
                                    className="w-full sm:w-auto px-6 py-2 bg-brand-blue text-white font-bold rounded-lg hover:opacity-90 transition"
                                >
                                    <span className="text-sm text-white">Modifier</span>
                                </button>
                                <button
                                    onClick={() => { setIsDetailsModalOpen(false); setSelectedMissionDetails(null); }}
                                    className="w-full sm:w-auto px-6 py-2 rounded-lg text-slate-600 font-bold hover:bg-slate-100 transition"
                                >
                                    <span className="text-sm text-slate-600">Fermer</span>
                                </button>
                                <button
                                    onClick={() => {
                                        toggleMissionSelection(selectedMissionDetails.id, { stopPropagation: () => { } } as any);
                                        setIsDetailsModalOpen(false);
                                        setSelectedMissionDetails(null);
                                    }}
                                    className="w-full sm:w-auto px-6 py-2 bg-red-100 text-red-600 font-bold rounded-lg hover:bg-red-200 transition"
                                >
                                    <span className="text-sm text-red-600">Sélectionner</span>
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {isEditMissionModalOpen && selectedMissionDetails && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
                        <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden animate-in fade-in zoom-in duration-200">
                            <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-cream-50">
                                <div>
                                    <h3 className="text-xl font-serif font-bold text-slate-800">Modifier la Mission</h3>
                                    <p className="text-xs text-slate-500 mt-1">Modifier prestataire, date, horaires et service</p>
                                </div>
                                <button onClick={() => setIsEditMissionModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full transition">
                                    <X className="w-5 h-5 text-slate-500" />
                                </button>
                            </div>

                            <form onSubmit={handleEditMissionSubmit} className="p-6 space-y-5 overflow-y-auto max-h-[70vh]">
                                <div className="grid grid-cols-1 gap-4">
                                    {/* Prestataire actuel clairement affiché */}
                                    {selectedMissionDetails?.providerName && selectedMissionDetails.providerId && selectedMissionDetails.providerId !== 'null' && (
                                        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-sm font-black text-blue-700 shrink-0">
                                                {(() => {
                                                    const prov = providers.find(p => p.id === selectedMissionDetails.providerId);
                                                    if (!prov) return '?';
                                                    return (prov.firstName?.charAt(0) || '') + (prov.lastName?.charAt(0) || '');
                                                })()}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">Prestataire actuel</div>
                                                <div className="text-sm font-black text-blue-900 truncate">{selectedMissionDetails.providerName}</div>
                                                <div className="text-[10px] text-blue-500">{selectedMissionDetails.service || 'Prestation'} • {selectedMissionDetails.date}</div>
                                            </div>
                                            {selectedMissionDetails.providerId === EXTERNAL_PROVIDER_ID && (
                                                <span className="text-[9px] font-black bg-blue-600 text-white px-2 py-0.5 rounded-full">EXTERNE</span>
                                            )}
                                        </div>
                                    )}
                                    {(!selectedMissionDetails?.providerId || selectedMissionDetails.providerId === 'null') && (
                                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                                                <AlertCircle className="w-5 h-5 text-amber-600" />
                                            </div>
                                            <div className="flex-1">
                                                <div className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">Non assignée</div>
                                                <div className="text-sm font-bold text-amber-800">Aucune jobeuse attribuée</div>
                                            </div>
                                        </div>
                                    )}
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-1">Modifier l'attribution</label>
                                        <SearchableSelect
                                            options={[
                                                { value: '', label: '(À assigner plus tard)' },
                                                { value: EXTERNAL_PROVIDER_ID, label: '🏢 EDWARD Sylvie' },
                                                ...providers.map(p => {
                                                    const name = getProviderDisplayName(p);
                                                    const reason = editMissionForm.date ? getProviderUnavailableReason(p.id, editMissionForm.date, editMissionForm.startTime, editMissionForm.endTime, selectedMissionDetails?.id) : null;
                                                    return {
                                                        value: p.id,
                                                        label: `${name}${reason ? ` (${reason})` : ''}`,
                                                        disabled: reason !== null
                                                    };
                                                })
                                            ]}
                                            value={editMissionForm.providerId}
                                            onChange={(value) => setEditMissionForm(prev => ({ ...prev, providerId: value }))}
                                            placeholder="Choisir une jobeuse..."
                                        />
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-bold text-slate-700 mb-1">Date</label>
                                            <input
                                                required
                                                type="date"
                                                value={editMissionForm.date}
                                                onChange={(e) => setEditMissionForm(prev => ({ ...prev, date: e.target.value }))}
                                                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg focus:border-brand-blue outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold text-slate-700 mb-1">Statut</label>
                                            <SearchableSelect
                                                options={[
                                                    { value: 'planned', label: 'Planifiée' },
                                                    { value: 'in_progress', label: 'En cours' },
                                                    { value: 'completed', label: 'Terminée' },
                                                    { value: 'cancelled', label: 'Annulée' },
                                                ]}
                                                value={editMissionForm.status}
                                                onChange={(value) => setEditMissionForm(prev => ({ ...prev, status: value as Mission['status'] }))}
                                                triggerClassName="font-bold"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-bold text-slate-700 mb-1">Heure début</label>
                                            <input
                                                required
                                                type="time"
                                                value={editMissionForm.startTime}
                                                onChange={(e) => setEditMissionForm(prev => ({ ...prev, startTime: e.target.value }))}
                                                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg focus:border-brand-blue outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold text-slate-700 mb-1">Heure fin</label>
                                            <input
                                                required
                                                type="time"
                                                value={editMissionForm.endTime}
                                                onChange={(e) => setEditMissionForm(prev => ({ ...prev, endTime: e.target.value }))}
                                                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg focus:border-brand-blue outline-none"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-1">Service</label>
                                        <SearchableSelect
                                            options={[
                                                { value: 'Ménage', label: 'Ménage' },
                                                { value: 'Jardinage', label: 'Jardinage' },
                                                { value: 'Bricolage', label: 'Bricolage' },
                                                { value: 'Autre', label: 'Autre' },
                                                { value: 'Personnalisé', label: 'Personnalisé' },
                                            ]}
                                            value={editMissionForm.service}
                                            onChange={(value) => setEditMissionForm(prev => ({ ...prev, service: value }))}
                                            placeholder="Sélectionner un service..."
                                        />
                                    </div>
                                </div>

                                <div className="pt-2 flex justify-end gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setIsEditMissionModalOpen(false)}
                                        className="px-6 py-2 rounded-lg text-slate-600 font-bold hover:bg-slate-100 transition"
                                        disabled={isSubmitting}
                                    >
                                        Annuler
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isSubmitting}
                                        className="px-6 py-2 rounded-lg bg-brand-blue text-white font-bold hover:opacity-90 transition disabled:opacity-70"
                                    >
                                        {isSubmitting ? 'Enregistrement...' : 'Enregistrer'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* No Provider Available Warning Modal */}
                {isNoProviderWarningOpen && noProviderWarningData && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-in fade-in zoom-in duration-200">
                            <div className="p-6 border-b border-slate-100 bg-amber-50">
                                <div className="flex items-center gap-3">
                                    <AlertTriangle className="w-6 h-6 text-amber-600" />
                                    <h3 className="text-lg font-serif font-bold text-slate-800">Attention</h3>
                                </div>
                            </div>

                            <div className="p-6 space-y-4">
                                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                                    <p className="text-sm text-amber-800">
                                        <strong>Aucun prestataire disponible</strong> pour ce créneau horaire avec la spécialité requise.
                                    </p>
                                    <p className="text-xs text-amber-700 mt-2">
                                        Type de service : <strong>{noProviderWarningData.serviceType || 'Non spécifié'}</strong><br />
                                        Date : {noProviderWarningData.nextDate}<br />
                                        Horaire : {noProviderWarningData.nextStart} - {noProviderWarningData.nextEnd}<br />
                                        Prestataires compatibles : {noProviderWarningData.compatibleCount}
                                    </p>
                                </div>

                                <p className="text-sm text-slate-600">
                                    Vous pouvez :
                                </p>
                                <ul className="text-sm text-slate-600 list-disc list-inside space-y-1">
                                    <li>Revenir à une date/heure où des prestataires sont disponibles</li>
                                    <li>Continuer quand même (la mission restera sans prestataire assigné)</li>
                                </ul>
                            </div>

                            <div className="p-6 border-t border-slate-100 flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsNoProviderWarningOpen(false)}
                                    className="flex-1 py-3 px-4 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-semibold transition"
                                >
                                    Revenir en arrière
                                </button>
                                <button
                                    type="button"
                                    onClick={handleForceContinueEdit}
                                    disabled={isSubmitting}
                                    className="flex-1 py-3 px-4 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-semibold transition disabled:opacity-50"
                                >
                                    {isSubmitting ? 'Sauvegarde...' : 'Continuer de force'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* GRAFTED: Modal Synthèse journalière */}
                {showDailySummary && (
                    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setShowDailySummary(false)}>
                        <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh]" role="dialog" aria-modal="true" aria-labelledby="summary-modal-title" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-indigo-600 to-blue-600 rounded-t-2xl shrink-0">
                                <div className="flex items-center gap-3">
                                    <Users className="w-5 h-5 text-white" />
                                    <div>
                                        <h2 id="summary-modal-title" className="text-base font-black text-white">
                                            {new Date(`${statsDate}T00:00:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                                        </h2>
                                        <p className="text-xs text-indigo-200">
                                            {dailySummaryData.totalScheduled} planifiées{!isDatePast(statsDate) && ` • ${dailySummaryData.totalAvailable} disponibles`}
                                            {isDatePast(statsDate) && <span className="ml-1 text-indigo-300 italic">(jour passé)</span>}
                                        </p>
                                    </div>
                                </div>
                                <button type="button" onClick={() => setShowDailySummary(false)} className="p-2 hover:bg-white/20 rounded-full transition" aria-label="Fermer la synthèse">
                                    <X className="w-5 h-5 text-white" />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-5 space-y-5">
                                <div className="flex flex-wrap gap-2">
                                    <div className="flex items-center gap-2 bg-indigo-600 text-white px-3 py-2 rounded-xl shadow">
                                        <span className="text-xs font-bold">📋 Prestations</span>
                                        <span className="text-xl font-black">{dailySummaryData.totalScheduled}</span>
                                        <span className="text-xs text-indigo-200">({dailySummaryData.scheduledProviders.reduce((acc, sp) => acc + sp.totalHours, 0).toFixed(1)}h)</span>
                                    </div>
                                    {!isDatePast(statsDate) && (
                                        <>
                                            <div className="flex items-center gap-2 bg-amber-500 text-white px-3 py-2 rounded-xl shadow">
                                                <span className="text-xs font-bold">☀️ Matin (8h–12h)</span>
                                                <span className="text-xl font-black">{dailySummaryData.morningAvailable}</span>
                                            </div>
                                            <div className="flex items-center gap-2 bg-sky-500 text-white px-3 py-2 rounded-xl shadow">
                                                <span className="text-xs font-bold">🌤 Après-midi (12h–17h)</span>
                                                <span className="text-xl font-black">{dailySummaryData.afternoonAvailable}</span>
                                            </div>
                                            <div className="flex items-center gap-2 bg-emerald-500 text-white px-3 py-2 rounded-xl shadow">
                                                <span className="text-xs font-bold">✅ Journée complète</span>
                                                <span className="text-xl font-black">{dailySummaryData.fullDayAvailable}</span>
                                            </div>
                                        </>
                                    )}
                                </div>

                                <div className={`grid grid-cols-1 ${!isDatePast(statsDate) ? 'md:grid-cols-2' : 'md:grid-cols-1'} gap-4`}>
                                    <div className="bg-indigo-50 rounded-2xl p-4 border border-indigo-200">
                                        <div className="flex items-center justify-between mb-3">
                                            <h4 className="text-xs font-black text-indigo-800 uppercase flex items-center gap-1.5">
                                                <User className="w-3.5 h-3.5" /> Planifiées
                                            </h4>
                                            {dailySummaryData.scheduledProviders.length > 0 && (
                                                <button type="button" onClick={() => { setWhatsappSentSet(new Set()); setWhatsappSendAllOpen(true); }}
                                                    className="text-[10px] font-bold text-white bg-green-500 px-2 py-1 rounded-lg hover:bg-green-600 transition flex items-center gap-1 shadow">
                                                    <MessageCircle className="w-3 h-3" /> Toutes
                                                </button>
                                            )}
                                        </div>
                                        {dailySummaryData.scheduledProviders.length === 0 ? (
                                            <p className="text-xs text-indigo-400 italic">Aucune prestation ce jour</p>
                                        ) : (
                                            <div className="space-y-2">
                                                {dailySummaryData.scheduledProviders.map(({ provider, slots, totalHours }) => (
                                                    <div key={provider.id} className="p-3 bg-white rounded-xl border border-indigo-200 shadow-sm">
                                                        <div className="flex items-center justify-between gap-2">
                                                            <span className="font-black text-sm text-indigo-900 truncate">{getProviderDisplayName(provider)}</span>
                                                            <span className={`text-xs font-black px-2 py-0.5 rounded-full text-white shrink-0 ${totalHours >= 7 ? 'bg-red-500' : totalHours >= 4 ? 'bg-amber-500' : 'bg-emerald-500'}`}>
                                                                {totalHours.toFixed(1)}h
                                                            </span>
                                                        </div>
                                                        <div className="flex flex-wrap gap-1 mt-2">
                                                            {slots.map((slot, idx) => (
                                                                <span key={idx} className="text-[10px] font-bold bg-indigo-600 text-white px-2 py-0.5 rounded-full">{slot.label}</span>
                                                            ))}
                                                        </div>
                                                        <div className="mt-2 h-2 bg-indigo-100 rounded-full overflow-hidden">
                                                            <div
                                                                role="progressbar"
                                                                aria-valuenow={Math.round((totalHours / MAX_PROVIDER_DAILY_HOURS) * 100)}
                                                                aria-valuemin={0}
                                                                aria-valuemax={100}
                                                                aria-label={`${totalHours.toFixed(1)}h sur ${MAX_PROVIDER_DAILY_HOURS}h`}
                                                                className={`h-full rounded-full transition-all ${totalHours >= 7 ? 'bg-red-500' : totalHours >= 4 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                                                                style={{ width: `${Math.min(100, (totalHours / MAX_PROVIDER_DAILY_HOURS) * 100)}%` }}
                                                            />
                                                        </div>
                                                        {provider.phone ? (
                                                            <button type="button"
                                                                onClick={() => {
                                                                    const phone = provider.phone.replace(/[^\d+]/g, '');
                                                                    const msg = buildWhatsAppMessage(provider, statsDate);
                                                                    setWhatsappPreviewData({ provider, phone, message: msg });
                                                                    setWhatsappPreviewOpen(true);
                                                                }}
                                                                className="mt-2 w-full min-h-[40px] flex items-center justify-center gap-1.5 text-xs font-bold text-white bg-green-500 rounded-xl hover:bg-green-600 transition shadow">
                                                                <MessageCircle className="w-4 h-4" /> WhatsApp
                                                            </button>
                                                        ) : (
                                                            <p className="mt-2 text-[10px] text-amber-700 font-bold bg-amber-50 border border-amber-200 rounded px-2 py-1">⚠ Numéro manquant</p>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {!isDatePast(statsDate) && (
                                        <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-200">
                                            <h4 className="text-xs font-black text-emerald-800 uppercase mb-3 flex items-center gap-1.5">
                                                <CheckCircle className="w-3.5 h-3.5" /> Disponibles
                                            </h4>
                                            {dailySummaryData.availableProviders.length === 0 ? (
                                                <p className="text-xs text-emerald-400 italic">Toutes les prestataires sont planifiées</p>
                                            ) : (
                                                <div className="space-y-2">
                                                    {dailySummaryData.availableProviders.map(({ provider, availableHours, availabilityRange }) => (
                                                        <div key={provider.id} className="p-3 bg-white rounded-xl border border-emerald-200 shadow-sm">
                                                            <div className="flex items-center justify-between gap-2">
                                                                <span className="font-black text-sm text-emerald-900 truncate">{getProviderDisplayName(provider)}</span>
                                                                <span className="text-xs font-black text-white bg-emerald-500 px-2 py-0.5 rounded-full shrink-0">{availableHours}h</span>
                                                            </div>
                                                            <div className="flex items-center gap-1.5 mt-1.5">
                                                                <Clock className="w-3 h-3 text-emerald-600" />
                                                                <span className="text-[11px] font-bold text-emerald-700">{availabilityRange}</span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {(billingSignals.ultimatePackDocs.size > 0 || billingSignals.readyToInvoiceDocs.size > 0) && (
                                    <div className="space-y-3 pt-3 border-t-2 border-slate-200">
                                        {/* Filtre facturation */}
                                        <div className="flex items-center gap-2">
                                            <div className="flex-1 relative">
                                                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                                <input
                                                    type="text"
                                                    value={billingFilter}
                                                    onChange={(e) => setBillingFilter(e.target.value)}
                                                    placeholder="Filtrer par nom de client..."
                                                    className="w-full pl-8 pr-3 py-2 text-xs rounded-lg border border-slate-300 focus:border-brand-blue focus:outline-none"
                                                />
                                            </div>
                                            {billingFilter && (
                                                <button type="button" onClick={() => setBillingFilter('')} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100">
                                                    <X className="w-3.5 h-3.5" />
                                                </button>
                                            )}
                                        </div>

                                        {billingSignals.ultimatePackDocs.size > 0 && (() => {
                                            const filtered = Array.from(billingSignals.ultimatePackDocs.entries()).filter(([, data]) =>
                                                !billingFilter || data.clientName.toLowerCase().includes(billingFilter.toLowerCase())
                                            );
                                            if (filtered.length === 0) return null;
                                            return (
                                                <div className="bg-violet-50 rounded-2xl p-4 border border-violet-300">
                                                    <h4 className="text-xs font-black text-violet-800 uppercase mb-2 flex items-center gap-1.5">
                                                        <span className="w-2.5 h-2.5 rounded-full bg-violet-600 inline-block" /> Packs complets
                                                    </h4>
                                                    <div className="space-y-1.5">
                                                        {filtered.map(([docId, data]) => (
                                                            <div key={docId} className="flex items-center gap-2 bg-violet-600 text-white rounded-xl px-3 py-2">
                                                                <button type="button" onClick={() => toggleBillingDoc(docId)} className="shrink-0">
                                                                    {billingSelectedDocs.has(docId)
                                                                        ? <CheckSquare className="w-4 h-4 text-white" />
                                                                        : <Square className="w-4 h-4 text-violet-300" />}
                                                                </button>
                                                                <span className="text-sm font-bold truncate flex-1">{data.clientName}</span>
                                                                <span className="text-[10px] font-black bg-violet-800 px-2 py-0.5 rounded-full shrink-0">{data.completedCount} réalisées</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            );
                                        })()}
                                        {billingSignals.readyToInvoiceDocs.size > 0 && (() => {
                                            const filtered = Array.from(billingSignals.readyToInvoiceDocs.entries()).filter(([, data]) =>
                                                !billingFilter || data.clientName.toLowerCase().includes(billingFilter.toLowerCase())
                                            );
                                            if (filtered.length === 0) return null;
                                            return (
                                                <div className="bg-blue-50 rounded-2xl p-4 border border-blue-300">
                                                    <h4 className="text-xs font-black text-blue-800 uppercase mb-2 flex items-center gap-1.5">
                                                        <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block" /> Prêts à facturer
                                                    </h4>
                                                    <div className="space-y-1.5">
                                                        {filtered.map(([docId, data]) => (
                                                            <div key={docId} className="flex items-center gap-2 bg-blue-600 text-white rounded-xl px-3 py-2">
                                                                <button type="button" onClick={() => toggleBillingDoc(docId)} className="shrink-0">
                                                                    {billingSelectedDocs.has(docId)
                                                                        ? <CheckSquare className="w-4 h-4 text-white" />
                                                                        : <Square className="w-4 h-4 text-blue-300" />}
                                                                </button>
                                                                <span className="text-sm font-bold truncate flex-1">{data.clientName}</span>
                                                                <span className="text-[10px] font-black bg-blue-800 px-2 py-0.5 rounded-full shrink-0">{data.completedCount} réalisées</span>
                                                                <button
                                                                    type="button"
                                                                    onClick={async () => {
                                                                        try {
                                                                            await convertQuoteToInvoice(docId);
                                                                            toast.success(`Facture générée pour ${data.clientName}`);
                                                                            if (refreshData) await refreshData();
                                                                        } catch (e: any) {
                                                                            toast.error(e?.message || 'Erreur conversion facture');
                                                                        }
                                                                    }}
                                                                    className="shrink-0 px-2 py-1 bg-green-500 hover:bg-green-400 rounded-lg text-[10px] font-black text-white transition"
                                                                    title="Générer la facture maintenant"
                                                                >
                                                                    Facturer
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            );
                                        })()}

                                        {/* Bouton Valider la facturation */}
                                        {billingSelectedDocs.size > 0 && (
                                            <button
                                                type="button"
                                                onClick={handleValidateBilling}
                                                disabled={billingValidating}
                                                className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-black text-sm hover:from-green-600 hover:to-emerald-700 disabled:opacity-50 transition shadow-lg"
                                            >
                                                {billingValidating ? (
                                                    <>
                                                        <Loader2 className="w-4 h-4 animate-spin" />
                                                        Conversion en cours...
                                                    </>
                                                ) : (
                                                    <>
                                                        <FileText className="w-4 h-4" />
                                                        Valider la facturation ({billingSelectedDocs.size} client{billingSelectedDocs.size > 1 ? 's' : ''})
                                                    </>
                                                )}
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="p-4 border-t border-slate-100 shrink-0">
                                <button type="button" onClick={() => setShowDailySummary(false)}
                                    className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition">
                                    Fermer
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* GRAFTED: Fiche stats prestataire */}
                {selectedProviderStats && providerStatsData && (
                    <div className="fixed inset-0 z-50 bg-black/60 flex items-end md:items-center justify-center md:p-4" onClick={() => setSelectedProviderStats(null)}>
                        <div
                            className="bg-white rounded-t-3xl md:rounded-2xl w-full md:max-w-2xl shadow-2xl flex flex-col max-h-[85vh] md:max-h-[90vh] animate-in slide-in-from-bottom-0 md:fade-in md:zoom-in-95 duration-200"
                            onClick={e => e.stopPropagation()}
                        >
                            {/* Header */}
                            <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-violet-600 to-purple-600 rounded-t-3xl md:rounded-t-2xl shrink-0">
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center text-xl font-black text-white">
                                        {(selectedProviderStats.firstName || '')[0]}{(selectedProviderStats.lastName || '')[0] || ''}
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-black text-white">{getProviderDisplayName(selectedProviderStats)}</h2>
                                        <p className="text-xs text-violet-200">{providerStatsData.weekPlanned} prestations cette semaine</p>
                                    </div>
                                </div>
                                <button type="button" onClick={() => setSelectedProviderStats(null)} className="p-2 hover:bg-white/20 rounded-full" aria-label="Fermer la fiche">
                                    <X className="w-5 h-5 text-white" />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                                {/* Week stats */}
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                    <div className="bg-indigo-50 rounded-xl p-3 border border-indigo-100">
                                        <div className="text-[10px] font-bold text-indigo-500 uppercase">Prestations</div>
                                        <div className="text-xl font-black text-indigo-700">{providerStatsData.weekPlanned}</div>
                                    </div>
                                    <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-100">
                                        <div className="text-[10px] font-bold text-emerald-500 uppercase">Heures sem.</div>
                                        <div className="text-xl font-black text-emerald-700">{providerStatsData.weekHours.toFixed(1)}h</div>
                                    </div>
                                    <div className="bg-amber-50 rounded-xl p-3 border border-amber-100">
                                        <div className="text-[10px] font-bold text-amber-500 uppercase">Jours trav.</div>
                                        <div className="text-xl font-black text-amber-700">{providerStatsData.weekWorkedDays}/{providerStatsData.providerWorkingDaysThisWeek}</div>
                                    </div>
                                    <div className="bg-sky-50 rounded-xl p-3 border border-sky-100">
                                        <div className="text-[10px] font-bold text-sky-500 uppercase">Occupation</div>
                                        <div className="text-xl font-black text-sky-700">{providerStatsData.occupationRate.toFixed(0)}%</div>
                                    </div>
                                </div>

                                {/* Occupation bar */}
                                <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
                                    <div className="flex justify-between text-xs font-bold text-slate-600 mb-1">
                                        <span>Taux d'occupation</span>
                                        <span>{providerStatsData.occupationRate.toFixed(0)}%</span>
                                    </div>
                                    <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                                        <div
                                            className={`h-2 rounded-full transition-all duration-300 ${providerStatsData.occupationRate >= 80 ? 'bg-emerald-500' :
                                                    providerStatsData.occupationRate >= 50 ? 'bg-amber-500' : 'bg-red-400'
                                                }`}
                                            style={{ width: `${providerStatsData.occupationRate}%` }}
                                        />
                                    </div>
                                </div>

                                {/* Month stats */}
                                <div className="bg-gradient-to-r from-slate-50 to-slate-100 rounded-xl p-4 border border-slate-200">
                                    <h3 className="text-xs font-black text-slate-700 uppercase mb-2">Ce mois</h3>
                                    <div className="grid grid-cols-3 gap-3">
                                        <div>
                                            <div className="text-lg font-black text-slate-800">{providerStatsData.monthHours.toFixed(1)}h</div>
                                            <div className="text-[10px] text-slate-500">Heures</div>
                                        </div>
                                        <div>
                                            <div className="text-lg font-black text-slate-800">{providerStatsData.monthMissions}</div>
                                            <div className="text-[10px] text-slate-500">Prestations</div>
                                        </div>
                                        <div>
                                            <div className="text-lg font-black text-slate-800">{providerStatsData.monthClients}</div>
                                            <div className="text-[10px] text-slate-500">Clients</div>
                                        </div>
                                    </div>
                                    {providerStatsData.monthDiff !== 0 && (
                                        <div className={`mt-2 text-xs font-bold ${providerStatsData.monthDiff >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                            {providerStatsData.monthDiff >= 0 ? '↑' : '↓'} {Math.abs(providerStatsData.monthDiff).toFixed(1)}h vs mois dernier
                                        </div>
                                    )}
                                </div>

                                {/* 30-day presence calendar */}
                                <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
                                    <h3 className="text-xs font-black text-slate-700 uppercase mb-2">30 derniers jours</h3>
                                    <div className="flex flex-wrap gap-1">
                                        {providerStatsData.presenceDays.map(day => (
                                            <div
                                                key={day.dateStr}
                                                className={`w-5 h-5 rounded-sm flex items-center justify-center text-[8px] font-bold ${day.isToday
                                                        ? 'ring-2 ring-brand-blue ring-offset-1'
                                                        : day.worked
                                                            ? 'bg-emerald-500 text-white'
                                                            : day.available
                                                                ? 'bg-slate-200 text-slate-400'
                                                                : 'bg-slate-100 text-slate-300'
                                                    }`}
                                                title={`${day.dateStr}${day.worked ? ' • Travaillé' : day.available ? ' • Disponible' : ' • Non disponible'}`}
                                            >
                                                {day.dayNum}
                                            </div>
                                        ))}
                                    </div>
                                    <div className="flex gap-3 mt-2 text-[10px] text-slate-500">
                                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-emerald-500" /> Travail</span>
                                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-slate-200" /> Dispo</span>
                                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-slate-100" /> Absent</span>
                                    </div>
                                </div>

                                {/* Last 5 missions */}
                                {providerStatsData.lastMissions.length > 0 && (
                                    <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
                                        <h3 className="text-xs font-black text-slate-700 uppercase mb-2">Dernières prestations</h3>
                                        <div className="space-y-2">
                                            {providerStatsData.lastMissions.map(m => (
                                                <div key={m.id} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-slate-100">
                                                    <div className="min-w-0">
                                                        <p className="text-xs font-bold text-slate-800 truncate">{m.clientName}</p>
                                                        <p className="text-[10px] text-slate-500">{m.date} • {m.startTime}-{m.endTime}</p>
                                                    </div>
                                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0 ${m.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                                                            m.status === 'planned' ? 'bg-blue-100 text-blue-700' :
                                                                'bg-slate-100 text-slate-600'
                                                        }`}>
                                                        {m.status === 'completed' ? 'Terminé' : m.status === 'planned' ? 'Planifié' : m.status}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="p-4 border-t border-slate-100 shrink-0">
                                <button type="button" onClick={() => setSelectedProviderStats(null)}
                                    className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition">
                                    Fermer
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* GRAFTED: Centre de notifications */}
                {showNotifications && (
                    <div className="fixed inset-0 z-50" onClick={() => setShowNotifications(false)}>
                        <div className="absolute top-16 right-4 w-80 md:w-96 max-h-[70vh] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200 shrink-0">
                                <div className="flex items-center gap-2">
                                    <Bell className="w-4 h-4 text-slate-600" />
                                    <span className="font-bold text-slate-800">Notifications</span>
                                    {notificationsData.length > 0 && (
                                        <span className="text-[10px] font-bold bg-red-500 text-white px-1.5 py-0.5 rounded-full">
                                            {notificationsData.length}
                                        </span>
                                    )}
                                </div>
                                {notificationsData.length > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => setReadNotificationIds(new Set(notificationsData.map(n => n.id)))}
                                        className="text-[10px] font-bold text-slate-500 hover:text-slate-700"
                                    >
                                        Tout marquer lu
                                    </button>
                                )}
                            </div>

                            <div className="flex-1 overflow-y-auto">
                                {notificationsData.length === 0 ? (
                                    <div className="p-6 text-center">
                                        <BellOff className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                                        <p className="text-sm text-slate-500">Aucune notification</p>
                                    </div>
                                ) : (
                                    <div className="divide-y divide-slate-100">
                                        {notificationsData.map(n => {
                                            const isRead = readNotificationIds.has(n.id);
                                            return (
                                                <div
                                                    key={n.id}
                                                    className={`p-3 hover:bg-slate-50 transition ${!isRead ? 'bg-blue-50/50' : ''}`}
                                                >
                                                    <div className="flex items-start gap-2">
                                                        <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${n.type === 'planning' ? 'bg-amber-500' :
                                                                n.type === 'billing' ? 'bg-blue-500' :
                                                                    n.type === 'workload' ? 'bg-orange-500' : 'bg-emerald-500'
                                                            }`} />
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center justify-between gap-2">
                                                                <span className={`text-xs font-bold truncate ${!isRead ? 'text-slate-800' : 'text-slate-600'}`}>
                                                                    {n.title}
                                                                </span>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setReadNotificationIds(prev => new Set([...prev, n.id]))}
                                                                    className="text-slate-400 hover:text-slate-600 shrink-0"
                                                                    aria-label="Marquer comme lu"
                                                                >
                                                                    <X className="w-3 h-3" />
                                                                </button>
                                                            </div>
                                                            <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">{n.message}</p>
                                                            {n.action && (
                                                                <button
                                                                    type="button"
                                                                    onClick={n.action.onClick}
                                                                    className="mt-1.5 text-[10px] font-bold text-brand-blue hover:underline"
                                                                >
                                                                    {n.action.label}
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* GRAFTED: Quick Assign Modal */}
                {quickAssignOpen && (
                    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => { setQuickAssignOpen(false); setQuickAssignMission(null); setQuickAssignTarget(null); }}>
                        <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl flex flex-col max-h-[90vh]" role="dialog" aria-modal="true" aria-labelledby="quickassign-title" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-emerald-600 to-teal-600 rounded-t-2xl shrink-0">
                                <div>
                                    <h2 id="quickassign-title" className="text-lg font-black text-white">Assignation rapide</h2>
                                    {quickAssignTarget && (
                                        <p className="text-xs text-emerald-200">{quickAssignTarget.date} • {quickAssignTarget.startTime}-{quickAssignTarget.endTime}</p>
                                    )}
                                </div>
                                <button type="button" onClick={() => { setQuickAssignOpen(false); setQuickAssignMission(null); setQuickAssignTarget(null); }} className="p-2 hover:bg-white/20 rounded-full" aria-label="Fermer">
                                    <X className="w-5 h-5 text-white" />
                                </button>
                            </div>

                            <div className="p-4 space-y-4 overflow-y-auto flex-1">
                                {quickAssignMission ? (
                                    <>
                                        <div className="bg-red-50 border border-red-100 rounded-xl p-3">
                                            <div className="text-xs font-bold text-red-800">Mission à assigner</div>
                                            <div className="text-sm font-bold text-red-900 mt-1">{quickAssignMission.clientName}</div>
                                            <div className="text-xs text-red-700 mt-1">{quickAssignMission.date} • {quickAssignMission.startTime}-{quickAssignMission.endTime}</div>
                                            <div className="text-xs text-red-600 mt-1">{quickAssignMission.service || 'Prestation'}</div>
                                            {quickAssignMission.providerName && quickAssignMission.providerId && quickAssignMission.providerId !== 'null' && (
                                                <div className="mt-2 pt-2 border-t border-red-200">
                                                    <div className="text-[10px] font-bold text-red-600 uppercase tracking-wider">Jobeuse actuelle</div>
                                                    <div className="text-xs font-black text-red-900">{quickAssignMission.providerName}</div>
                                                </div>
                                            )}
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold text-slate-600 mb-2">Sélectionner une prestataire</label>
                                            <div className="space-y-1 max-h-48 overflow-y-auto">
                                                {/* Prestataire externe (toujours disponible) */}
                                                <button
                                                    type="button"
                                                    onClick={async () => {
                                                        try {
                                                            await assignProvider(quickAssignMission.id, EXTERNAL_PROVIDER_ID, 'EDWARD Sylvie');
                                                            toast.success('EDWARD Sylvie assignée !');
                                                            if (refreshData) await refreshData();
                                                        } catch (err: any) {
                                                            toast.error(err?.message || "Erreur d'assignation");
                                                        }
                                                        setQuickAssignOpen(false);
                                                        setQuickAssignMission(null);
                                                        setQuickAssignTarget(null);
                                                    }}
                                                    className="w-full p-2 rounded-lg text-left transition flex items-center gap-2 bg-blue-50 border border-blue-200 hover:border-blue-400 hover:bg-blue-100"
                                                >
                                                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-xs font-black text-blue-700 shrink-0">ES</div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="text-xs font-bold text-blue-800 truncate">EDWARD Sylvie</div>
                                                        <div className="text-[10px] text-blue-600">Toujours disponible</div>
                                                    </div>
                                                    <CheckCircle className="w-4 h-4 text-blue-500" />
                                                </button>
                                                {providers.filter(p => p?.status === 'Active').map(p => {
                                                    const dayOfWeek = dayjs.tz(quickAssignMission.date, 'YYYY-MM-DD', MARTINIQUE_TIMEZONE).day();
                                                    const nid = (p as any).nonInterventionDays;
                                                    const isWorkingDay = !(Array.isArray(nid) && nid.includes(dayOfWeek));
                                                    const existingHours = getProviderDailyHours(p.id, quickAssignMission.date);
                                                    const missionDuration = calculateDuration(quickAssignMission.date, quickAssignMission.startTime, quickAssignMission.date, quickAssignMission.endTime);
                                                    const canAssign = isWorkingDay && existingHours + missionDuration <= MAX_PROVIDER_DAILY_HOURS;

                                                    return (
                                                        <button
                                                            key={p.id}
                                                            type="button"
                                                            disabled={!canAssign}
                                                            onClick={async () => {
                                                                try {
                                                                    await assignProvider(quickAssignMission.id, p.id, getProviderDisplayName(p));
                                                                    toast.success(`${getProviderDisplayName(p)} assigné(e) !`);
                                                                    if (refreshData) await refreshData();
                                                                } catch (err: any) {
                                                                    toast.error(err?.message || 'Erreur d\'assignation');
                                                                }
                                                                setQuickAssignOpen(false);
                                                                setQuickAssignMission(null);
                                                                setQuickAssignTarget(null);
                                                            }}
                                                            className={`w-full p-2 rounded-lg text-left transition flex items-center gap-2 ${canAssign
                                                                    ? 'bg-white border border-slate-200 hover:border-emerald-400 hover:bg-emerald-50'
                                                                    : 'bg-slate-100 border border-slate-200 opacity-50 cursor-not-allowed'
                                                                }`}
                                                        >
                                                            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-black text-indigo-700 shrink-0">
                                                                {(getProviderDisplayName(p).split(' ')[0] || '')[0]}{(getProviderDisplayName(p).split(' ')[1] || '')[0] || ''}
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <div className="text-xs font-bold text-slate-800 truncate">{getProviderDisplayName(p)}</div>
                                                                <div className="text-[10px] text-slate-500">
                                                                    {!isWorkingDay ? 'Jour de repos' : `${existingHours.toFixed(1)}h/${MAX_PROVIDER_DAILY_HOURS}h`}
                                                                </div>
                                                            </div>
                                                            {canAssign && <CheckCircle className="w-4 h-4 text-emerald-500" />}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </>
                                ) : quickAssignTarget ? (
                                    <>
                                        <div className="text-sm text-slate-600 mb-2">
                                            Créneau : <span className="font-bold">{quickAssignTarget.startTime}-{quickAssignTarget.endTime}</span> pour <span className="font-bold">{quickAssignTarget.providerName}</span>
                                        </div>

                                        {filteredUnassignedMissions.length === 0 ? (
                                            <div className="text-center py-4">
                                                <p className="text-sm text-slate-500">Aucune mission en attente</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-2 max-h-64 overflow-y-auto">
                                                {filteredUnassignedMissions.map(m => {
                                                    const client = clients.find(c => c.id === m.clientId);
                                                    const duration = calculateDuration(m.date, m.startTime, m.date, m.endTime);
                                                    const existingHours = getProviderDailyHours(quickAssignTarget.providerId, quickAssignTarget.date);
                                                    const canAssign = duration + existingHours <= MAX_PROVIDER_DAILY_HOURS;

                                                    return (
                                                        <button
                                                            key={m.id}
                                                            type="button"
                                                            disabled={!canAssign}
                                                            onClick={async () => {
                                                                try {
                                                                    await assignProvider(m.id, quickAssignTarget.providerId, quickAssignTarget.providerName);
                                                                    toast.success(`Mission assignée à ${quickAssignTarget.providerName} !`);
                                                                    if (refreshData) await refreshData();
                                                                } catch (err: any) {
                                                                    toast.error(err?.message || 'Erreur d\'assignation');
                                                                }
                                                                setQuickAssignOpen(false);
                                                                setQuickAssignMission(null);
                                                                setQuickAssignTarget(null);
                                                            }}
                                                            className={`w-full p-2 rounded-lg text-left transition ${canAssign
                                                                    ? 'bg-white border border-slate-200 hover:border-emerald-400 hover:bg-emerald-50'
                                                                    : 'bg-slate-100 border border-slate-200 opacity-50 cursor-not-allowed'
                                                                }`}
                                                        >
                                                            <div className="text-xs font-bold text-slate-800 truncate">{client?.name || m.clientName}</div>
                                                            <div className="text-[10px] text-slate-500">{m.date} • {m.startTime}-{m.endTime}</div>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </>
                                ) : null}
                            </div>

                            <div className="p-4 border-t border-slate-100 shrink-0">
                                <button type="button" onClick={() => { setQuickAssignOpen(false); setQuickAssignMission(null); setQuickAssignTarget(null); }}
                                    className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition">
                                    Annuler
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* GRAFTED: Day Assign Modal */}
                {dayAssignOpen && dayAssignDate && (
                    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => { setDayAssignOpen(false); setDayAssignDate(null); }}>
                        <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl flex flex-col max-h-[90vh]" role="dialog" aria-modal="true" aria-labelledby="dayassign-title" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center justify-between px-5 py-4 bg-amber-500 rounded-t-2xl shrink-0">
                                <div>
                                    <h2 id="dayassign-title" className="text-lg font-black text-white">Missions du {dayjs.tz(dayAssignDate, 'YYYY-MM-DD', MARTINIQUE_TIMEZONE).format('DD/MM')}</h2>
                                    <p className="text-xs text-amber-100">À assigner</p>
                                </div>
                                <button type="button" onClick={() => { setDayAssignOpen(false); setDayAssignDate(null); }} className="p-2 hover:bg-white/20 rounded-full" aria-label="Fermer">
                                    <X className="w-5 h-5 text-white" />
                                </button>
                            </div>

                            <div className="p-4 space-y-3 overflow-y-auto flex-1">
                                {(() => {
                                    const dayMissions = filteredUnassignedMissions.filter(m => m.date === dayAssignDate);
                                    if (dayMissions.length === 0) {
                                        return (
                                            <div className="text-center py-6">
                                                <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                                                <p className="text-sm font-bold text-slate-700">Toutes les missions sont assignées</p>
                                            </div>
                                        );
                                    }
                                    return dayMissions.map(m => {
                                        const client = clients.find(c => c.id === m.clientId);
                                        return (
                                            <div key={m.id} className="bg-red-50 border border-red-100 rounded-xl p-3">
                                                <div className="flex items-start justify-between">
                                                    <div>
                                                        <div className="text-sm font-bold text-red-900">{client?.name || m.clientName}</div>
                                                        <div className="text-xs text-red-700 mt-1">{m.startTime} - {m.endTime}</div>
                                                        <div className="text-xs text-red-600 mt-0.5">{m.service || 'Prestation'}</div>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => { setQuickAssignMission(m as Mission); setQuickAssignOpen(true); }}
                                                        className="bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition"
                                                    >
                                                        Assigner
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    });
                                })()}
                            </div>

                            <div className="p-4 border-t border-slate-100 shrink-0">
                                <button type="button" onClick={() => { setDayAssignOpen(false); setDayAssignDate(null); }}
                                    className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition">
                                    Fermer
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {whatsappPreviewOpen && whatsappPreviewData && (
                    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setWhatsappPreviewOpen(false)}>
                        <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]" role="dialog" aria-modal="true" aria-labelledby="wa-preview-title" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center justify-between p-5 border-b border-slate-100 shrink-0">
                                <div>
                                    <h2 id="wa-preview-title" className="text-lg font-bold text-slate-900">Pr\u00e9visualisation WhatsApp</h2>
                                    <p className="text-sm text-slate-500">{getProviderDisplayName(whatsappPreviewData.provider)}</p>
                                </div>
                                <button type="button" onClick={() => setWhatsappPreviewOpen(false)} className="p-2 hover:bg-slate-100 rounded-full" aria-label="Fermer la pr\u00e9visualisation">
                                    <X className="w-5 h-5 text-slate-500" />
                                </button>
                            </div>
                            <div className="p-5 space-y-3 overflow-y-auto flex-1">
                                {whatsappPreviewData.phone ? (
                                    <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                                        <MessageCircle className="w-4 h-4 text-green-600 shrink-0" />
                                        <span className="text-sm font-bold text-green-800">{whatsappPreviewData.phone}</span>
                                    </div>
                                ) : (
                                    <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-sm text-amber-700 font-bold">
                                        \u26a0\ufe0f Num\u00e9ro manquant \u2014 le lien ne fonctionnera pas
                                    </div>
                                )}
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 mb-1">Message (modifiable)</label>
                                    <textarea
                                        rows={10}
                                        value={whatsappPreviewData.message}
                                        onChange={e => setWhatsappPreviewData(prev => prev ? { ...prev, message: e.target.value } : null)}
                                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm font-mono focus:border-brand-blue outline-none resize-y"
                                    />
                                </div>
                            </div>
                            <div className="flex gap-3 p-5 border-t border-slate-100 shrink-0">
                                <button
                                    type="button"
                                    onClick={() => setWhatsappPreviewOpen(false)}
                                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition"
                                >
                                    Annuler
                                </button>
                                <a
                                    href={`https://wa.me/${whatsappPreviewData.phone.replace(/[^\d]/g, '')}?text=${encodeURIComponent(whatsappPreviewData.message)}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={() => setWhatsappPreviewOpen(false)}
                                    className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold transition flex items-center justify-center gap-2"
                                >
                                    <MessageCircle className="w-4 h-4" /> Confirmer et envoyer
                                </a>
                            </div>
                        </div>
                    </div>
                )}

                {/* GRAFTED: Modal Envoyer \u00e0 toutes */}
                {whatsappSendAllOpen && (
                    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setWhatsappSendAllOpen(false)}>
                        <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl flex flex-col max-h-[90vh]" role="dialog" aria-modal="true" aria-labelledby="wa-sendall-title" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center justify-between p-5 border-b border-slate-100 shrink-0">
                                <div>
                                    <h2 id="wa-sendall-title" className="text-lg font-bold text-slate-900">Envoyer \u00e0 toutes</h2>
                                    <p className="text-sm text-slate-500">{dailySummaryData.scheduledProviders.length} prestataire(s) planifi\u00e9e(s) le {dayjs.tz(statsDate, 'YYYY-MM-DD', MARTINIQUE_TIMEZONE).format('DD/MM')}</p>
                                </div>
                                <button type="button" onClick={() => setWhatsappSendAllOpen(false)} className="p-2 hover:bg-slate-100 rounded-full" aria-label="Fermer l'envoi groupé">
                                    <X className="w-5 h-5 text-slate-500" />
                                </button>
                            </div>
                            <div className="p-5 flex-1 overflow-y-auto">
                                <div className="space-y-2">
                                    {dailySummaryData.scheduledProviders.map(({ provider }) => {
                                        const phone = (provider.phone || '').replace(/[^\d+]/g, '');
                                        const msg = buildWhatsAppMessage(provider, statsDate);
                                        const sent = whatsappSentSet.has(provider.id);
                                        return (
                                            <div key={provider.id} className={`flex items-center justify-between gap-3 p-2 rounded-lg border ${sent ? 'bg-green-50 border-green-200' : 'bg-slate-50 border-slate-200'}`}>
                                                <div className="min-w-0">
                                                    <p className="font-bold text-sm text-slate-800 truncate">{getProviderDisplayName(provider)}</p>
                                                    {phone ? (
                                                        <p className="text-xs text-slate-500 truncate">{provider.phone}</p>
                                                    ) : (
                                                        <p className="text-[10px] text-amber-600 font-bold">Num\u00e9ro manquant</p>
                                                    )}
                                                </div>
                                                {phone ? (
                                                    <a
                                                        href={`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        onClick={() => setWhatsappSentSet(prev => new Set([...prev, provider.id]))}
                                                        className={`min-h-[40px] shrink-0 px-3 flex items-center gap-1.5 text-xs font-bold rounded-lg transition ${sent ? 'bg-green-100 text-green-700 border border-green-300' : 'bg-green-600 text-white hover:bg-green-700'}`}
                                                    >
                                                        <MessageCircle className="w-3.5 h-3.5" /> {sent ? '\u2713 Envoy\u00e9' : 'Envoyer'}
                                                    </a>
                                                ) : (
                                                    <span className="text-[10px] text-slate-400 italic shrink-0">\u2014</span>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                                <p className="mt-3 text-xs text-slate-400 italic text-center">
                                    {whatsappSentSet.size}/{dailySummaryData.scheduledProviders.length} envoy\u00e9(s)
                                </p>
                            </div>
                            <div className="p-5 border-t border-slate-100 shrink-0">
                                <button
                                    type="button"
                                    onClick={() => setWhatsappSendAllOpen(false)}
                                    className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition"
                                >
                                    Fermer
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* MODAL FACTURATION DÉTAILLÉ */}
                {showBillingModal && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4" onClick={() => setShowBillingModal(false)}>
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col" onClick={e => e.stopPropagation()}>
                            {/* Header */}
                            <div className="bg-gradient-to-r from-green-600 to-emerald-700 px-6 py-5 shrink-0">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className="text-xl font-black text-white flex items-center gap-2">
                                            <FileText className="w-5 h-5" /> Facturation en attente
                                        </h3>
                                        <p className="text-xs text-green-200 mt-1">
                                            {billingSignals.readyToInvoiceDocs.size + billingSignals.ultimatePackDocs.size} client(s) prêt(s) à facturer
                                        </p>
                                    </div>
                                    <button onClick={() => setShowBillingModal(false)} className="p-2 hover:bg-white/20 rounded-full transition">
                                        <X className="w-5 h-5 text-white" />
                                    </button>
                                </div>
                            </div>

                            {/* Content */}
                            <div className="p-5 space-y-4 overflow-y-auto flex-1">
                                {/* Packs ultimes */}
                                {billingSignals.ultimatePackDocs.size > 0 && (
                                    <div>
                                        <h4 className="text-xs font-black text-violet-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                            <span className="w-2 h-2 rounded-full bg-violet-600 inline-block" />
                                            Packs ultimes complets ({billingSignals.ultimatePackDocs.size})
                                        </h4>
                                        <div className="space-y-2">
                                            {Array.from(billingSignals.ultimatePackDocs.entries()).map(([docId, data]) => {
                                                const doc = documents.find(d => d.id === docId);
                                                return (
                                                    <div key={docId} className="bg-violet-50 border border-violet-200 rounded-xl p-4">
                                                        <div className="flex items-start justify-between mb-2">
                                                            <div className="flex-1 min-w-0">
                                                                <div className="text-sm font-black text-violet-900 truncate">{data.clientName}</div>
                                                                <div className="text-[10px] text-violet-600 mt-0.5">
                                                                    {doc?.ref && <span className="font-bold">{doc.ref}</span>}
                                                                    {doc?.totalTTC && <span className="ml-1">• {doc.totalTTC}€ TTC</span>}
                                                                </div>
                                                            </div>
                                                            <span className="shrink-0 text-[10px] font-black bg-violet-600 text-white px-2 py-0.5 rounded-full">
                                                                {data.completedCount} prestations
                                                            </span>
                                                        </div>
                                                        <div className="text-[10px] text-violet-700 mb-3">
                                                            {data.completedMissions?.map((m: any, i: number) => (
                                                                <div key={i} className="flex items-center gap-1">
                                                                    <CheckCircle className="w-3 h-3 text-green-500 shrink-0" />
                                                                    <span>{m.service} — {m.date}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={async () => {
                                                                try {
                                                                    await convertQuoteToInvoice(docId);
                                                                    setInvoicedDocIds(prev => new Set([...prev, docId]));
                                                                    toast.success(`Facture générée pour ${data.clientName}`);
                                                                    if (refreshData) await refreshData();
                                                                } catch (e: any) {
                                                                    toast.error(e?.message || 'Erreur conversion facture');
                                                                }
                                                            }}
                                                            disabled={invoicedDocIds.has(docId)}
                                                            className={`w-full py-2 rounded-lg text-xs font-black transition flex items-center justify-center gap-1.5 ${invoicedDocIds.has(docId)
                                                                    ? 'bg-green-100 text-green-700 border border-green-300 cursor-default'
                                                                    : 'bg-gradient-to-r from-violet-600 to-purple-700 hover:from-violet-700 hover:to-purple-800 text-white'
                                                                }`}
                                                        >
                                                            {invoicedDocIds.has(docId) ? (
                                                                <><CheckCircle className="w-3.5 h-3.5" /> Déjà facturé</>
                                                            ) : (
                                                                <><FileText className="w-3.5 h-3.5" /> Générer la facture</>
                                                            )}
                                                        </button>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* Packs prêts à facturer */}
                                {billingSignals.readyToInvoiceDocs.size > 0 && (
                                    <div>
                                        <h4 className="text-xs font-black text-blue-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                            <span className="w-2 h-2 rounded-full bg-blue-600 inline-block" />
                                            Prêts à facturer ({billingSignals.readyToInvoiceDocs.size})
                                        </h4>
                                        <div className="space-y-2">
                                            {Array.from(billingSignals.readyToInvoiceDocs.entries()).map(([docId, data]) => {
                                                const doc = documents.find(d => d.id === docId);
                                                const client = clients.find(c => c.id === doc?.clientId);
                                                return (
                                                    <div key={docId} className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                                                        <div className="flex items-start justify-between mb-2">
                                                            <div className="flex-1 min-w-0">
                                                                <div className="text-sm font-black text-blue-900 truncate">{data.clientName}</div>
                                                                <div className="text-[10px] text-blue-600 mt-0.5">
                                                                    {doc?.ref && <span className="font-bold">{doc.ref}</span>}
                                                                    {doc?.totalTTC && <span className="ml-1">• {doc.totalTTC}€ TTC</span>}
                                                                    {client?.pack && <span className="ml-1">• Pack {client.pack}</span>}
                                                                </div>
                                                            </div>
                                                            <span className="shrink-0 text-[10px] font-black bg-blue-600 text-white px-2 py-0.5 rounded-full">
                                                                {data.completedCount}/{data.totalCount} réalisées
                                                            </span>
                                                        </div>
                                                        {/* Détails des prestations */}
                                                        <div className="text-[10px] text-blue-700 space-y-0.5 mb-3">
                                                            {data.completedMissions?.map((m: any, i: number) => (
                                                                <div key={i} className="flex items-center gap-1">
                                                                    <CheckCircle className="w-3 h-3 text-green-500 shrink-0" />
                                                                    <span className="truncate">{m.service} — {m.date}</span>
                                                                </div>
                                                            ))}
                                                            {data.pendingMissions?.map((m: any, i: number) => (
                                                                <div key={i} className="flex items-center gap-1 opacity-60">
                                                                    <Clock className="w-3 h-3 text-orange-400 shrink-0" />
                                                                    <span className="truncate">{m.service} — {m.date} (en attente)</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                        {/* Infos client */}
                                                        {client && (
                                                            <div className="text-[10px] text-blue-600 bg-blue-100/50 rounded-lg p-2 mb-3 space-y-0.5">
                                                                {client.phone && <div>📞 {client.phone}</div>}
                                                                {client.email && <div>📧 {client.email}</div>}
                                                                {client.address && <div>📍 {client.address}{client.city ? `, ${client.city}` : ''}</div>}
                                                            </div>
                                                        )}
                                                        <button
                                                            type="button"
                                                            onClick={async () => {
                                                                try {
                                                                    await convertQuoteToInvoice(docId);
                                                                    setInvoicedDocIds(prev => new Set([...prev, docId]));
                                                                    toast.success(`Facture générée pour ${data.clientName}`);
                                                                    if (refreshData) await refreshData();
                                                                } catch (e: any) {
                                                                    toast.error(e?.message || 'Erreur conversion facture');
                                                                }
                                                            }}
                                                            disabled={invoicedDocIds.has(docId)}
                                                            className={`w-full py-2 rounded-lg text-xs font-black transition flex items-center justify-center gap-1.5 ${invoicedDocIds.has(docId)
                                                                    ? 'bg-green-100 text-green-700 border border-green-300 cursor-default'
                                                                    : 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white'
                                                                }`}
                                                        >
                                                            {invoicedDocIds.has(docId) ? (
                                                                <><CheckCircle className="w-3.5 h-3.5" /> Déjà facturé</>
                                                            ) : (
                                                                <><FileText className="w-3.5 h-3.5" /> Générer la facture</>
                                                            )}
                                                        </button>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* Tout facturer d'un coup */}
                                {(billingSignals.readyToInvoiceDocs.size + billingSignals.ultimatePackDocs.size) > 1 && (() => {
                                    const allDocIds = [
                                        ...Array.from(billingSignals.ultimatePackDocs.keys()),
                                        ...Array.from(billingSignals.readyToInvoiceDocs.keys())
                                    ];
                                    const remainingCount = allDocIds.filter(id => !invoicedDocIds.has(id)).length;
                                    if (remainingCount === 0) return null;
                                    return (
                                        <button
                                            type="button"
                                            onClick={async () => {
                                                setBillingValidating(true);
                                                let ok = 0, ko = 0;
                                                const newlyInvoiced = new Set<string>();
                                                for (const docId of allDocIds) {
                                                    if (invoicedDocIds.has(docId)) continue;
                                                    try {
                                                        await convertQuoteToInvoice(docId);
                                                        newlyInvoiced.add(docId);
                                                        ok++;
                                                    } catch (e) {
                                                        ko++;
                                                    }
                                                }
                                                if (newlyInvoiced.size > 0) {
                                                    setInvoicedDocIds(prev => new Set([...prev, ...newlyInvoiced]));
                                                }
                                                setBillingValidating(false);
                                                if (ok > 0) toast.success(`${ok} facture(s) générée(s) avec succès`);
                                                if (ko > 0) toast.error(`${ko} erreur(s) de conversion`);
                                                if (refreshData) await refreshData();
                                            }}
                                            disabled={billingValidating}
                                            className="w-full py-3 bg-gradient-to-r from-green-600 to-emerald-700 text-white rounded-xl font-black text-sm hover:from-green-700 hover:to-emerald-800 disabled:opacity-50 transition shadow-lg flex items-center justify-center gap-2"
                                        >
                                            {billingValidating ? (
                                                <><Loader2 className="w-4 h-4 animate-spin" /> Conversion en cours...</>
                                            ) : (
                                                <><FileText className="w-4 h-4" /> Tout facturer ({remainingCount} client{remainingCount > 1 ? 's' : ''})</>
                                            )}
                                        </button>
                                    );
                                })()}
                            </div>

                            {/* Footer */}
                            <div className="p-4 border-t border-slate-100 shrink-0">
                                <button
                                    type="button"
                                    onClick={() => setShowBillingModal(false)}
                                    className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition"
                                >
                                    Fermer
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
};

export default Planning;
