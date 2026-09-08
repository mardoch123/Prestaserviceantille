import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    FileText, 
    CreditCard, 
    CheckCircle, 
    Clock, 
    ChevronDown, 
    ChevronUp,
    Package,
    Search,
    User,
    ExternalLink,
    Bell,
    RefreshCw,
    Filter,
    X
} from 'lucide-react';
import { useData } from '../context/DataContext';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { MARTINIQUE_TIMEZONE, getMartiniqueToday } from '../src/utils/martiniqueTime';
import { toast } from './mobile/Toast';
import Pagination from './Pagination';

dayjs.extend(utc);
dayjs.extend(timezone);

type PeriodFilter = 'all' | 'this_week' | 'this_month' | 'last_month';
type StatusFilter = 'all' | 'to_invoice' | 'in_progress' | 'invoiced';
type ServiceFilter = 'all' | 'Ménage' | 'Jardinage' | 'Bricolage' | 'Autre';

interface SplitInvoiceManagementProps {
    onNavigateToDocument?: (docId: string) => void;
}

const ITEMS_PER_PAGE = 8;

const SplitInvoiceManagement: React.FC<SplitInvoiceManagementProps> = ({ onNavigateToDocument }) => {
    const navigate = useNavigate();
    const { 
        documents, 
        missions, 
        convertQuoteToInvoice,
        notifyQuotesToInvoiceThreshold,
        checkSessionsToInvoice,
        addNotification
    } = useData();

    // Filtres
    const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('all');
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
    const [serviceFilter, setServiceFilter] = useState<ServiceFilter>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [expandedQuoteId, setExpandedQuoteId] = useState<string | null>(null);

    // États actions
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isNotifyingAll, setIsNotifyingAll] = useState(false);

    // Bornes temporelles (Fuseau Martinique)
    const periodBounds = useMemo(() => {
        const now = dayjs().tz(MARTINIQUE_TIMEZONE);
        const dayOfWeek = (now.day() + 6) % 7; // Lundi = 0
        const startOfWeek = now.subtract(dayOfWeek, 'day').startOf('day').format('YYYY-MM-DD');
        const endOfWeek = dayjs(startOfWeek).add(6, 'day').endOf('day').format('YYYY-MM-DD');

        const startOfMonth = now.startOf('month').format('YYYY-MM-DD');
        const endOfMonth = now.endOf('month').format('YYYY-MM-DD');

        const startOfLastMonth = now.subtract(1, 'month').startOf('month').format('YYYY-MM-DD');
        const endOfLastMonth = now.subtract(1, 'month').endOf('month').format('YYYY-MM-DD');

        return {
            startOfWeek,
            endOfWeek,
            startOfMonth,
            endOfMonth,
            startOfLastMonth,
            endOfLastMonth
        };
    }, []);

    // Construction et calcul des données de facturation pour tous les devis signés
    const allBillingItems = useMemo(() => {
        const today = getMartiniqueToday();
        const targetQuotes = documents.filter(d =>
            d.type === 'Devis' &&
            (d.status === 'signed' || d.status === 'to_invoice' || d.status === 'validated')
        );

        return targetQuotes.map(doc => {
            const slots = doc.slotsData && Array.isArray(doc.slotsData) ? doc.slotsData : [];
            const totalSessions = slots.length || doc.quantity || 1;
            const totalAmount = doc.totalTTC || 0;
            const pricePerSession = totalSessions > 0 ? (totalAmount / totalSessions) : totalAmount;

            // Séances réalisées (passées ou marquées complétées)
            const completedSlots = slots.filter((s: any) => 
                s.sessionStatus !== 'cancelled' && 
                ((s.date && s.date <= today) || s.sessionStatus === 'completed' || s.sessionStatus === 'to_invoice')
            );
            const completedSessions = completedSlots.length;
            const completedAmount = completedSessions * pricePerSession;

            // Paliers de 2 séances ou 180 €
            const sessionMilestones = Math.floor(completedSessions / 2);
            const amountMilestones = Math.floor(completedAmount / 180);
            const isSingleSession180 = (totalSessions === 1 && completedSessions >= 1 && totalAmount >= 180);
            const milestonesReached = Math.max(sessionMilestones, amountMilestones, isSingleSession180 ? 1 : 0);

            // Factures déjà émises pour ce devis
            const existingInvoices = documents.filter(d =>
                d.type === 'Facture' &&
                (d.linkedInvoiceId === doc.id || d.parentQuoteId === doc.id)
            );
            const alreadyInvoicedCount = existingInvoices.length;
            const pendingMilestones = Math.max(0, milestonesReached - alreadyInvoicedCount);

            // Montant à facturer pour les paliers en attente
            const calculatedAmount = Math.min(
                pendingMilestones > 0 ? pendingMilestones * 180 : 180,
                Math.max(0, totalAmount - (alreadyInvoicedCount * 180))
            );
            const amountToInvoice = calculatedAmount > 0 ? calculatedAmount : (pricePerSession * 2);

            // Statut calculé
            let calculatedStatus: 'to_invoice' | 'invoiced' | 'in_progress' = 'in_progress';
            if (pendingMilestones > 0 || doc.status === 'to_invoice' || slots.some((s: any) => s.sessionStatus === 'to_invoice')) {
                calculatedStatus = 'to_invoice';
            } else if (alreadyInvoicedCount >= Math.ceil(totalSessions / 2) || (alreadyInvoicedCount > 0 && completedSessions === totalSessions)) {
                calculatedStatus = 'invoiced';
            }

            // Dates pour le filtrage
            const slotDates = slots.map((s: any) => s.date).filter(Boolean);
            const minDate = slotDates.length > 0 ? slotDates.sort()[0] : doc.date;
            const maxDate = slotDates.length > 0 ? slotDates.sort()[slotDates.length - 1] : doc.date;

            return {
                id: doc.id,
                ref: doc.ref,
                clientName: doc.clientName || 'Client',
                clientId: doc.clientId,
                serviceType: doc.serviceType || 'Ménage',
                date: doc.date,
                minDate,
                maxDate,
                slotDates,
                slots,
                totalSessions,
                totalAmount,
                pricePerSession,
                completedSessions,
                completedAmount,
                milestonesReached,
                alreadyInvoicedCount,
                pendingMilestones,
                amountToInvoice,
                status: calculatedStatus,
                existingInvoices,
                rawDoc: doc
            };
        });
    }, [documents, missions]);

    // Filtrage dynamique
    const filteredItems = useMemo(() => {
        return allBillingItems.filter(item => {
            // Recherche
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase().trim();
                const matchRef = item.ref.toLowerCase().includes(q);
                const matchClient = item.clientName.toLowerCase().includes(q);
                if (!matchRef && !matchClient) return false;
            }

            // Filtre statut
            if (statusFilter !== 'all' && item.status !== statusFilter) {
                return false;
            }

            // Filtre service
            if (serviceFilter !== 'all') {
                const normalizedService = (item.serviceType || '').toLowerCase();
                const targetService = serviceFilter.toLowerCase();
                if (!normalizedService.includes(targetService)) return false;
            }

            // Filtre période
            if (periodFilter === 'this_week') {
                const hasInWeek = item.slotDates.some(d => d >= periodBounds.startOfWeek && d <= periodBounds.endOfWeek);
                const docInWeek = item.date >= periodBounds.startOfWeek && item.date <= periodBounds.endOfWeek;
                if (!hasInWeek && !docInWeek) return false;
            } else if (periodFilter === 'this_month') {
                const hasInMonth = item.slotDates.some(d => d >= periodBounds.startOfMonth && d <= periodBounds.endOfMonth);
                const docInMonth = item.date >= periodBounds.startOfMonth && item.date <= periodBounds.endOfMonth;
                if (!hasInMonth && !docInMonth) return false;
            } else if (periodFilter === 'last_month') {
                const hasInLastMonth = item.slotDates.some(d => d >= periodBounds.startOfLastMonth && d <= periodBounds.endOfLastMonth);
                const docInLastMonth = item.date >= periodBounds.startOfLastMonth && item.date <= periodBounds.endOfLastMonth;
                if (!hasInLastMonth && !docInLastMonth) return false;
            }

            return true;
        });
    }, [allBillingItems, searchQuery, statusFilter, serviceFilter, periodFilter, periodBounds]);

    // Réinitialiser la page si les filtres changent
    React.useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, statusFilter, serviceFilter, periodFilter]);

    // Pagination
    const paginatedItems = useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        return filteredItems.slice(start, start + ITEMS_PER_PAGE);
    }, [filteredItems, currentPage]);

    // KPIs globaux
    const kpis = useMemo(() => {
        const toInvoiceCount = allBillingItems.filter(i => i.status === 'to_invoice').length;
        const totalToInvoiceAmount = allBillingItems
            .filter(i => i.status === 'to_invoice')
            .reduce((sum, i) => sum + i.amountToInvoice, 0);
        const totalCompletedSessions = allBillingItems.reduce((sum, i) => sum + i.completedSessions, 0);
        const invoicedCount = allBillingItems.filter(i => i.status === 'invoiced').length;

        return {
            toInvoiceCount,
            totalToInvoiceAmount,
            totalCompletedSessions,
            invoicedCount
        };
    }, [allBillingItems]);

    // Handlers actions
    const handleRefresh = async () => {
        setIsRefreshing(true);
        try {
            const r = await checkSessionsToInvoice();
            toast.success(`${r.toInvoice} prestation(s) à facturer détectée(s)`);
        } catch (e: any) {
            toast.error('Erreur rafraîchissement: ' + (e?.message || 'inconnue'));
        } finally {
            setIsRefreshing(false);
        }
    };

    const handleNotifyAll = async () => {
        setIsNotifyingAll(true);
        try {
            const r = await notifyQuotesToInvoiceThreshold();
            toast.success(`${r.notified} notification(s) envoyée(s) pour ${r.toInvoiceQuotes.length} prestation(s) à facturer`);
        } catch (e: any) {
            toast.error('Erreur notification: ' + (e?.message || 'inconnue'));
        } finally {
            setIsNotifyingAll(false);
        }
    };

    const handleNotifySingle = async (item: typeof allBillingItems[0]) => {
        try {
            await addNotification(
                'admin',
                'alert',
                'Prestation à facturer (Seuil 2 séances / 180 €)',
                `Devis ${item.ref} (${item.clientName}) : ${item.completedSessions} séance(s) réalisée(s). Montant à facturer : ~${item.amountToInvoice.toFixed(2)} €.`,
                undefined,
                `document:${item.id}`
            );
            toast.success(`Notification envoyée pour le devis ${item.ref}`);
        } catch (e: any) {
            toast.error('Erreur: ' + (e?.message || 'inconnue'));
        }
    };

    const handleManualInvoice = async (item: typeof allBillingItems[0]) => {
        if (!window.confirm(`Confirmer la création manuelle de la facture pour le devis ${item.ref} (${item.amountToInvoice.toFixed(2)} €) ?`)) {
            return;
        }
        try {
            await convertQuoteToInvoice(item.id);
            toast.success(`Devis ${item.ref} converti en facture`);
        } catch (e: any) {
            toast.error('Erreur facturation: ' + (e?.message || 'inconnue'));
        }
    };

    const toggleExpand = (quoteId: string) => {
        setExpandedQuoteId(prev => prev === quoteId ? null : quoteId);
    };

    return (
        <div className="space-y-5">
            {/* 1. Header synthétique & Actions principales */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2.5">
                            <div className="p-2 bg-brand-blue/10 rounded-xl text-brand-blue">
                                <Bell className="w-5 h-5" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-slate-800">Suivi Facturation & Notifications</h2>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    Seuil automatique : <strong>2 séances ou 180 €</strong> • Notifications sans factures automatiques
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2.5 flex-wrap">
                        <button
                            type="button"
                            onClick={handleNotifyAll}
                            disabled={isNotifyingAll}
                            className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white transition flex items-center gap-2 shadow-sm disabled:opacity-50"
                        >
                            {isNotifyingAll ? (
                                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : (
                                <Bell className="w-3.5 h-3.5" />
                            )}
                            Notifier Tout ({kpis.toInvoiceCount})
                        </button>

                        <button
                            type="button"
                            onClick={handleRefresh}
                            disabled={isRefreshing}
                            className="px-3.5 py-2 rounded-xl text-xs font-bold border border-slate-200 text-slate-700 hover:bg-slate-50 transition flex items-center gap-1.5 disabled:opacity-50"
                        >
                            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                            Rafraîchir
                        </button>
                    </div>
                </div>

                {/* 2. KPIs compacts et lisibles */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-4 border-t border-slate-100">
                    <div className="bg-amber-50/70 border border-amber-200/60 rounded-xl p-3">
                        <div className="text-[11px] font-bold text-amber-800 uppercase tracking-wide">À Facturer (Seuil)</div>
                        <div className="text-2xl font-black text-amber-900 mt-0.5">{kpis.toInvoiceCount}</div>
                        <div className="text-[11px] text-amber-700 mt-0.5">≥ 2 séances ou 180 €</div>
                    </div>

                    <div className="bg-blue-50/70 border border-blue-200/60 rounded-xl p-3">
                        <div className="text-[11px] font-bold text-blue-800 uppercase tracking-wide">Montant au seuil</div>
                        <div className="text-2xl font-black text-blue-900 mt-0.5">{kpis.totalToInvoiceAmount.toFixed(2)} €</div>
                        <div className="text-[11px] text-blue-700 mt-0.5">Prêt à être notifié</div>
                    </div>

                    <div className="bg-emerald-50/70 border border-emerald-200/60 rounded-xl p-3">
                        <div className="text-[11px] font-bold text-emerald-800 uppercase tracking-wide">Séances Réalisées</div>
                        <div className="text-2xl font-black text-emerald-900 mt-0.5">{kpis.totalCompletedSessions}</div>
                        <div className="text-[11px] text-emerald-700 mt-0.5">Sur l'ensemble des devis</div>
                    </div>

                    <div className="bg-slate-50 border border-slate-200/70 rounded-xl p-3">
                        <div className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">Facturés / À jour</div>
                        <div className="text-2xl font-black text-slate-800 mt-0.5">{kpis.invoicedCount}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">Devis à jour</div>
                    </div>
                </div>
            </div>

            {/* 3. Barre de filtres unifiée : Période (Semaine / Mois), Statut, Service & Recherche */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-3">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    {/* Recherche */}
                    <div className="relative flex-1">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Rechercher par référence, nom client..."
                            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:border-brand-blue outline-none transition"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>

                    {/* Filtre Période rapide (Semaine / Mois) */}
                    <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                        <button
                            type="button"
                            onClick={() => setPeriodFilter('all')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                                periodFilter === 'all'
                                    ? 'bg-white text-slate-800 shadow-sm'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            Toutes
                        </button>
                        <button
                            type="button"
                            onClick={() => setPeriodFilter('this_week')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                                periodFilter === 'this_week'
                                    ? 'bg-white text-slate-800 shadow-sm'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            Cette semaine
                        </button>
                        <button
                            type="button"
                            onClick={() => setPeriodFilter('this_month')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                                periodFilter === 'this_month'
                                    ? 'bg-white text-slate-800 shadow-sm'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            Ce mois
                        </button>
                        <button
                            type="button"
                            onClick={() => setPeriodFilter('last_month')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                                periodFilter === 'last_month'
                                    ? 'bg-white text-slate-800 shadow-sm'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            Mois dernier
                        </button>
                    </div>
                </div>

                {/* Filtres secondaires : Statut & Service */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
                    <div className="flex flex-wrap items-center gap-2">
                        {/* Filtre Statut */}
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium mr-1">
                            <Filter className="w-3.5 h-3.5" /> Statut :
                        </div>
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 outline-none"
                        >
                            <option value="all">Tous les statuts</option>
                            <option value="to_invoice">🔔 À facturer (Seuil atteint)</option>
                            <option value="in_progress">⏳ En cours (Prochain seuil)</option>
                            <option value="invoiced">✓ Facturés / À jour</option>
                        </select>

                        {/* Filtre Service */}
                        <select
                            value={serviceFilter}
                            onChange={(e) => setServiceFilter(e.target.value as ServiceFilter)}
                            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 outline-none"
                        >
                            <option value="all">Tous les services</option>
                            <option value="Ménage">Ménage</option>
                            <option value="Jardinage">Jardinage</option>
                            <option value="Bricolage">Bricolage</option>
                            <option value="Autre">Autre</option>
                        </select>
                    </div>

                    <div className="text-xs text-slate-400 font-semibold">
                        {filteredItems.length} résultat{filteredItems.length > 1 ? 's' : ''} trouvé{filteredItems.length > 1 ? 's' : ''}
                    </div>
                </div>
            </div>

            {/* 4. Liste organisée des devis avec pagination */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                {paginatedItems.length === 0 ? (
                    <div className="p-10 text-center text-slate-400">
                        <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                        <p className="text-sm font-bold text-slate-700">Aucune prestation trouvée</p>
                        <p className="text-xs text-slate-500 mt-1">Modifiez vos critères de recherche ou de filtre temporel.</p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100">
                        {paginatedItems.map((item) => {
                            const isExpanded = expandedQuoteId === item.id;
                            const isJardinage = String(item.serviceType || '').toLowerCase().includes('jardin');
                            const progressPercent = item.totalSessions > 0 
                                ? Math.min(100, Math.round((item.completedSessions / item.totalSessions) * 100))
                                : 0;

                            return (
                                <div key={item.id} className="p-4 hover:bg-slate-50/70 transition">
                                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                                        {/* Colonne Devis & Client */}
                                        <div className="flex items-start gap-3 min-w-[260px]">
                                            <div className={`p-2 rounded-xl mt-0.5 ${
                                                item.status === 'to_invoice' 
                                                    ? 'bg-amber-100 text-amber-800'
                                                    : item.status === 'invoiced'
                                                        ? 'bg-emerald-100 text-emerald-800'
                                                        : 'bg-slate-100 text-slate-600'
                                            }`}>
                                                {item.status === 'to_invoice' ? (
                                                    <Bell className="w-4 h-4" />
                                                ) : item.status === 'invoiced' ? (
                                                    <CheckCircle className="w-4 h-4" />
                                                ) : (
                                                    <Clock className="w-4 h-4" />
                                                )}
                                            </div>

                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => onNavigateToDocument?.(item.id) || navigate(`/admin/devis/${item.id}`)}
                                                        className="font-bold text-slate-800 hover:text-brand-blue transition text-sm flex items-center gap-1"
                                                    >
                                                        {item.ref}
                                                        <ExternalLink className="w-3 h-3 text-slate-400" />
                                                    </button>

                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                                        isJardinage 
                                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                            : 'bg-blue-50 text-blue-700 border-blue-200'
                                                    }`}>
                                                        {item.serviceType}
                                                    </span>
                                                </div>

                                                <div className="text-xs text-slate-600 font-medium mt-0.5 flex items-center gap-1">
                                                    <User className="w-3 h-3 text-slate-400" />
                                                    {item.clientName}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Avancement Séances */}
                                        <div className="min-w-[180px]">
                                            <div className="flex items-center justify-between text-xs font-semibold text-slate-600 mb-1">
                                                <span>Avancement</span>
                                                <span className="font-bold text-slate-800">
                                                    {item.completedSessions} / {item.totalSessions} séance{item.totalSessions > 1 ? 's' : ''} ({progressPercent}%)
                                                </span>
                                            </div>
                                            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                                                <div 
                                                    className={`h-full rounded-full transition-all duration-300 ${
                                                        item.status === 'to_invoice'
                                                            ? 'bg-amber-500'
                                                            : item.status === 'invoiced'
                                                                ? 'bg-emerald-500'
                                                                : 'bg-brand-blue'
                                                    }`}
                                                    style={{ width: `${progressPercent}%` }}
                                                />
                                            </div>
                                        </div>

                                        {/* Montant & Seuil */}
                                        <div className="text-left lg:text-right min-w-[150px]">
                                            {item.status === 'to_invoice' ? (
                                                <div>
                                                    <div className="text-sm font-black text-amber-900">
                                                        ~{item.amountToInvoice.toFixed(2)} €
                                                    </div>
                                                    <span className="inline-block text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full mt-0.5">
                                                        Seuil atteint ({item.completedSessions} s.)
                                                    </span>
                                                </div>
                                            ) : item.status === 'invoiced' ? (
                                                <div>
                                                    <div className="text-sm font-bold text-emerald-900">
                                                        {item.totalAmount.toFixed(2)} €
                                                    </div>
                                                    <span className="inline-block text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full mt-0.5">
                                                        Facturé / À jour
                                                    </span>
                                                </div>
                                            ) : (
                                                <div>
                                                    <div className="text-sm font-bold text-slate-700">
                                                        {item.completedAmount.toFixed(2)} € / {item.totalAmount.toFixed(2)} €
                                                    </div>
                                                    <span className="inline-block text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full mt-0.5">
                                                        Prochain seuil à 2 s.
                                                    </span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Actions rapides */}
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            {item.status === 'to_invoice' && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleNotifySingle(item)}
                                                    className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white transition flex items-center gap-1 shadow-sm"
                                                    title="Notifier qu'il faut facturer"
                                                >
                                                    <Bell className="w-3 h-3" /> Notifier
                                                </button>
                                            )}

                                            <button
                                                type="button"
                                                onClick={() => onNavigateToDocument?.(item.id) || navigate(`/admin/devis/${item.id}`)}
                                                className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 transition"
                                            >
                                                Voir
                                            </button>

                                            {item.status === 'to_invoice' && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleManualInvoice(item)}
                                                    className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition flex items-center gap-1"
                                                    title="Créer la facture manuellement"
                                                >
                                                    <CreditCard className="w-3 h-3" /> Facturer
                                                </button>
                                            )}

                                            <button
                                                type="button"
                                                onClick={() => toggleExpand(item.id)}
                                                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
                                                title="Afficher les séances"
                                            >
                                                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Vue dépliée : détail des séances & factures */}
                                    {isExpanded && (
                                        <div className="mt-3 pt-3 border-t border-slate-100 space-y-2 text-xs">
                                            <div className="font-bold text-slate-600">Séances du devis ({item.slots.length}) :</div>
                                            {item.slots.length === 0 ? (
                                                <div className="text-slate-400 italic">Aucun créneau d'intervention planifié.</div>
                                            ) : (
                                                <div className="flex flex-wrap gap-1.5">
                                                    {item.slots.map((slot: any, idx: number) => {
                                                        const isCompleted = (slot.date && slot.date <= getMartiniqueToday()) || slot.sessionStatus === 'completed' || slot.sessionStatus === 'to_invoice';
                                                        return (
                                                            <div 
                                                                key={idx} 
                                                                className={`px-2 py-1 rounded border text-xs flex items-center gap-1.5 ${
                                                                    slot.sessionStatus === 'cancelled'
                                                                        ? 'bg-red-50 text-red-700 border-red-200 line-through opacity-60'
                                                                        : slot.sessionStatus === 'to_invoice'
                                                                            ? 'bg-amber-50 text-amber-800 border-amber-300 font-semibold'
                                                                            : isCompleted
                                                                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200 font-medium'
                                                                                : 'bg-slate-50 text-slate-600 border-slate-200'
                                                                }`}
                                                            >
                                                                <span>S{idx + 1}: {slot.date || 'Non daté'}</span>
                                                                {slot.startTime && <span>({slot.startTime}-{slot.endTime})</span>}
                                                                {slot.duration && <span>{slot.duration}h</span>}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}

                                            {/* Factures émises */}
                                            {item.existingInvoices.length > 0 && (
                                                <div className="pt-2">
                                                    <div className="font-bold text-slate-600 mb-1">Factures déjà générées ({item.existingInvoices.length}) :</div>
                                                    <div className="flex flex-wrap gap-2">
                                                        {item.existingInvoices.map((inv) => (
                                                            <button
                                                                key={inv.id}
                                                                type="button"
                                                                onClick={() => onNavigateToDocument?.(inv.id) || navigate(`/admin/devis/${inv.id}`)}
                                                                className="px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg font-bold hover:bg-blue-100 flex items-center gap-1 text-xs"
                                                            >
                                                                <FileText className="w-3 h-3" />
                                                                {inv.ref} ({inv.totalTTC?.toFixed(2)} €)
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Pagination */}
                {filteredItems.length > 0 && (
                    <Pagination
                        page={currentPage}
                        pageSize={ITEMS_PER_PAGE}
                        total={filteredItems.length}
                        onPageChange={setCurrentPage}
                    />
                )}
            </div>
        </div>
    );
};

export default SplitInvoiceManagement;
