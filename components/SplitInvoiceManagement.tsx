/**
 * Composant de gestion des factures fractionnées par pack
 * Affiche les statistiques de facturation et permet de générer manuellement des factures en attente
 * 
 * Fonctionnalités :
 * - Indicateurs visuels pour factures non consultées (pastille + fond coloré)
 * - Filtrage avancé (statut, tranche, sessions, dates)
 * - Navigation bidirectionnelle devis ↔ factures
 * - Marquage automatique comme "lue" à la consultation
 */

import React, { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    FileText, 
    CreditCard, 
    CheckCircle, 
    Clock, 
    AlertCircle, 
    ChevronDown, 
    ChevronRight,
    Package,
    TrendingUp,
    Eye,
    Zap,
    Send,
    Calendar,
    Filter,
    X,
    ArrowLeft,
    Circle,
    Search,
    MapPin,
    User,
    ExternalLink,
    Download
} from 'lucide-react';
import { useData } from '../context/DataContext';
import type { Document, PackBillingStats, SplitDetail, Mission } from '../types';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { MARTINIQUE_TIMEZONE } from '../src/utils/martiniqueTime';
import { pdf } from '@react-pdf/renderer';
import { InvoicePDF, SplitInvoicePDF } from './PDFComponents';
import { LOGO_BASE64, LOGO_SAP_BASE64, SIGNATURE_BASE64, STAMP_SIGNATURE_BASE64 } from '../src/assets/images';

dayjs.extend(utc);
dayjs.extend(timezone);

// Helper safe pour convertir toute valeur en nombre fini
const safeNum = (v: any): number => {
    if (v === null || v === undefined) return 0;
    const n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) ? n : 0;
};

type FilterStatus = 'all' | 'pending' | 'ready' | 'invoiced' | 'paid';
type FilterSplitIndex = 'all' | number;

interface SplitInvoiceManagementProps {
    onNavigateToDocument?: (docId: string) => void;
}

const SplitInvoiceManagement: React.FC<SplitInvoiceManagementProps> = ({ onNavigateToDocument }) => {
    const navigate = useNavigate();
    const { 
        documents, 
        missions, 
        getAllPackBillingStats, 
        getSplitInvoicesForQuote,
        generateSplitInvoice,
        markSplitInvoiceRead,
        backfillSplitBilling,
        rollbackBackfillSplitBilling,
        runAutoGenerateSplitInvoices,
        clients,
        packs
    } = useData();

    const [expandedQuoteId, setExpandedQuoteId] = useState<string | null>(null);
    const [isGenerating, setIsGenerating] = useState<Set<string>>(new Set());
    
    // États de filtrage
    const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
    const [filterSplitIndex, setFilterSplitIndex] = useState<FilterSplitIndex>('all');
    const [filterDateFrom, setFilterDateFrom] = useState('');
    const [filterDateTo, setFilterDateTo] = useState('');
    const [showFilters, setShowFilters] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    
    // États de pagination
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 10;

    // États backfill/rollback
    const [isBackfilling, setIsBackfilling] = useState(false);
    const [isRollingBack, setIsRollingBack] = useState(false);
    const [isAutoGenerating, setIsAutoGenerating] = useState(false);
    const [backfillResult, setBackfillResult] = useState<string | null>(null);

    // Récupérer toutes les statistiques de facturation par pack
    const packStats = useMemo(() => getAllPackBillingStats(), [documents, missions]);

    // Calculer les statistiques globales
    const globalStats = useMemo(() => {
        const totalPacks = packStats.length;
        const totalSessions = packStats.reduce((sum, s) => sum + s.totalSessions, 0);
        const totalInvoicedSessions = packStats.reduce((sum, s) => sum + s.invoicedSessions, 0);
        const totalRemainingSessions = packStats.reduce((sum, s) => sum + s.remainingSessions, 0);
        const totalAmount = packStats.reduce((sum, s) => sum + s.totalAmount, 0);
        const totalInvoicedAmount = packStats.reduce((sum, s) => sum + s.invoicedAmount, 0);
        const totalRemainingAmount = packStats.reduce((sum, s) => sum + s.remainingAmount, 0);
        const packsInProgress = packStats.filter(s => s.billingStatus === 'in_progress').length;
        const packsCompleted = packStats.filter(s => s.billingStatus === 'completed').length;
        const packsNotStarted = packStats.filter(s => s.billingStatus === 'not_started').length;

        return {
            totalPacks,
            totalSessions,
            totalInvoicedSessions,
            totalRemainingSessions,
            totalAmount,
            totalInvoicedAmount,
            totalRemainingAmount,
            packsInProgress,
            packsCompleted,
            packsNotStarted,
            billingProgress: totalSessions > 0 ? (totalInvoicedSessions / totalSessions) * 100 : 0
        };
    }, [packStats]);

    // Filtrer les packs selon les critères
    const filteredPackStats = useMemo(() => {
        return packStats.filter(stats => {
            // Recherche textuelle
            if (searchQuery) {
                const q = searchQuery.toLowerCase();
                const quote = documents.find(d => d.id === stats.quoteId);
                const matchRef = stats.quoteRef.toLowerCase().includes(q);
                const matchClient = stats.clientName.toLowerCase().includes(q);
                const matchInvoiceRefs = getSplitInvoicesForQuote(stats.quoteId).some(inv => 
                    inv.ref.toLowerCase().includes(q)
                );
                if (!matchRef && !matchClient && !matchInvoiceRefs) return false;
            }

            // Si un filtre de statut est actif, vérifier qu'au moins une tranche du pack correspond
            if (filterStatus !== 'all') {
                const quote = documents.find(d => d.id === stats.quoteId);
                const config = quote?.splitBillingConfig;
                if (!config) return false;
                
                const hasMatchingSplit = config.splits.some(split => {
                    if (filterStatus === 'pending') return split.status === 'pending';
                    if (filterStatus === 'invoiced') return split.status === 'invoiced';
                    if (filterStatus === 'paid') return split.status === 'paid';
                    if (filterStatus === 'ready') {
                        const maxSession = Math.max(...split.sessions);
                        return split.status === 'pending' && (split.trigger === 'signature' || stats.completedMissions >= maxSession);
                    }
                    return true;
                });
                if (!hasMatchingSplit) return false;
            }

            // Filtre par index de tranche
            if (filterSplitIndex !== 'all') {
                const quote = documents.find(d => d.id === stats.quoteId);
                const config = quote?.splitBillingConfig;
                if (!config) return false;
                const hasSplit = config.splits.some(s => s.index === filterSplitIndex);
                if (!hasSplit) return false;
            }

            // Filtre par dates
            if (filterDateFrom || filterDateTo) {
                const splitInvoices = getSplitInvoicesForQuote(stats.quoteId);
                const hasInvoiceInRange = splitInvoices.some(inv => {
                    const invDate = dayjs(inv.date);
                    if (filterDateFrom && invDate.isBefore(dayjs(filterDateFrom), 'day')) return false;
                    if (filterDateTo && invDate.isAfter(dayjs(filterDateTo), 'day')) return false;
                    return true;
                });
                if (splitInvoices.length > 0 && !hasInvoiceInRange) return false;
            }

            return true;
        });
    }, [packStats, filterStatus, filterSplitIndex, filterDateFrom, filterDateTo, searchQuery, documents]);

    // Pagination
    const totalPages = Math.max(1, Math.ceil(filteredPackStats.length / ITEMS_PER_PAGE));
    const paginatedPackStats = useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        return filteredPackStats.slice(start, start + ITEMS_PER_PAGE);
    }, [filteredPackStats, currentPage]);

    // Réinitialiser la page quand les filtres changent
    React.useEffect(() => {
        setCurrentPage(1);
    }, [filterStatus, filterSplitIndex, filterDateFrom, filterDateTo, searchQuery]);

    // Gérer la génération manuelle d'une facture
    const handleGenerateInvoice = async (quoteId: string, splitIndex: number) => {
        const key = `${quoteId}-${splitIndex}`;
        setIsGenerating(prev => new Set(prev).add(key));
        try {
            await generateSplitInvoice(quoteId, splitIndex);
        } catch (e) {
            console.error('Error generating split invoice:', e);
        } finally {
            setIsGenerating(prev => {
                const next = new Set(prev);
                next.delete(key);
                return next;
            });
        }
    };

    // Basculer l'expansion d'un pack
    const toggleExpand = (quoteId: string) => {
        setExpandedQuoteId(prev => prev === quoteId ? null : quoteId);
    };

    // Naviguer vers un document et le marquer comme lu
    const handleNavigateToInvoice = useCallback(async (invoiceId: string) => {
        await markSplitInvoiceRead(invoiceId);
        onNavigateToDocument?.(invoiceId);
    }, [markSplitInvoiceRead, onNavigateToDocument]);

    // Naviguer vers le devis parent
    const handleNavigateToQuote = useCallback((quoteId: string) => {
        onNavigateToDocument?.(quoteId);
    }, [onNavigateToDocument]);

    // Réinitialiser les filtres
    const resetFilters = () => {
        setFilterStatus('all');
        setFilterSplitIndex('all');
        setFilterDateFrom('');
        setFilterDateTo('');
        setSearchQuery('');
    };

    // Handlers backfill/rollback/auto-generate
    const handleBackfill = async () => {
        if (!window.confirm('Configurer et générer les factures pour tous les devis signés des 6 derniers mois ?')) return;
        setIsBackfilling(true);
        setBackfillResult(null);
        try {
            const result = await backfillSplitBilling();
            setBackfillResult(`✓ Backfill terminé : ${result.configured} pack(s) configuré(s), ${result.invoicesGenerated} facture(s) générée(s)${result.errors.length > 0 ? `, ${result.errors.length} erreur(s)` : ''}`);
        } catch (e) {
            setBackfillResult(`Erreur : ${e instanceof Error ? e.message : 'inconnue'}`);
        } finally {
            setIsBackfilling(false);
        }
    };

    const handleRollback = async () => {
        if (!window.confirm('ATTENTION : Supprimer toutes les factures fractionnées et réinitialiser la configuration ? Cette action est irréversible.')) return;
        setIsRollingBack(true);
        setBackfillResult(null);
        try {
            const result = await rollbackBackfillSplitBilling();
            setBackfillResult(`✓ Rollback terminé : ${result.deletedInvoices} facture(s) supprimée(s), ${result.resetConfigs} config(s) réinitialisée(s)`);
        } catch (e) {
            setBackfillResult(`Erreur : ${e instanceof Error ? e.message : 'inconnue'}`);
        } finally {
            setIsRollingBack(false);
        }
    };

    const handleAutoGenerate = async () => {
        setIsAutoGenerating(true);
        setBackfillResult(null);
        try {
            const result = await runAutoGenerateSplitInvoices();
            setBackfillResult(`✓ Auto-génération : ${result.generated} facture(s) générée(s) pour ${result.quotesProcessed} devis`);
        } catch (e) {
            setBackfillResult(`Erreur : ${e instanceof Error ? e.message : 'inconnue'}`);
        } finally {
            setIsAutoGenerating(false);
        }
    };

    // Télécharger le PDF d'une facture
    const handleDownloadInvoicePdf = async (invoice: Document) => {
        try {
            const client = clients.find(c => c.id === invoice.clientId);
            if (!client) {
                console.error('Client not found for invoice:', invoice.id);
                return;
            }

            const resolvedTvaRate = (() => {
                const raw = (invoice as any)?.tvaRate;
                const n = typeof raw === 'number' ? raw : Number(raw);
                return Number.isFinite(n) ? n : 0;
            })();

            const logoBase64 = resolvedTvaRate === 0 ? LOGO_SAP_BASE64 : LOGO_BASE64;

            const packNameFromId = invoice.packId ? (packs.find(p => p.id === invoice.packId)?.name || '') : '';
            const descLower = String(invoice.description || '').toLowerCase();
            const packNameFromText = String(
                (packs || []).find(p => {
                    const n = String(p?.name || '').toLowerCase();
                    return n && descLower.includes(n);
                })?.name || ''
            );
            const packName = packNameFromId || packNameFromText || '';

            const parentQuote = invoice.parentQuoteId ? documents.find(d => d.id === invoice.parentQuoteId) : null;

            const pdfData = {
                ref: invoice.ref,
                date: invoice.date,
                dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                paid: invoice.status === 'paid',
                status: invoice.status,
                tvaRate: resolvedTvaRate,
                taxCreditEnabled: !!(invoice.hasTaxCredit || invoice.taxCreditEnabled),
                clientName: client.name,
                clientEmail: client.email,
                clientPhone: client.phone,
                companySignature: SIGNATURE_BASE64,
                companyStamp: STAMP_SIGNATURE_BASE64,
                logoBase64,
                subtotal: invoice.totalHT || 0,
                tax: invoice.totalTTC && invoice.totalHT ? (invoice.totalTTC - invoice.totalHT) : 0,
                total: invoice.totalTTC || 0,
                packId: invoice.packId,
                packName,
                splitIndex: invoice.splitIndex,
                totalSplits: invoice.totalSplits,
                coveredSessions: invoice.coveredSessions,
                parentQuoteRef: parentQuote?.ref,
                items: [
                    {
                        description: packName || invoice.description || 'Service standard',
                        quantity: 1,
                        unitPrice: invoice.totalHT || 0,
                        total: invoice.totalHT || 0
                    }
                ],
                slotsData: invoice.slotsData || [],
                paymentInfo: 'Paiement par virement bancaire ou chèque. Délai de paiement: 30 jours.'
            };

            const isSplitInvoice = invoice.type === 'Facture' && invoice.parentQuoteId;
            const PdfComponent = isSplitInvoice ? SplitInvoicePDF : InvoicePDF;
            const blob = await pdf(<PdfComponent doc={pdfData} packs={packs as any} />).toBlob();

            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            const sanitize = (v: any) => String(v || '').replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, ' ').trim();
            const clientPart = sanitize(client?.name || 'Client');
            const refPart = sanitize(invoice?.ref || '');
            link.download = `Facture_${clientPart}${refPart ? `_${refPart}` : ''}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Erreur lors du téléchargement du PDF:', error);
        }
    };

    // Obtenir le badge de statut pour une tranche
    const getSplitStatusBadge = (split: SplitDetail, completedSessions: number, isUnread?: boolean) => {
        if (split.status === 'paid') {
            return <span className="px-2 py-1 text-xs font-bold rounded-full bg-emerald-100 text-emerald-700">Payée</span>;
        }
        if (split.status === 'invoiced') {
            return (
                <span className={`px-2 py-1 text-xs font-bold rounded-full ${
                    isUnread ? 'bg-indigo-200 text-indigo-800 ring-2 ring-indigo-400 ring-offset-1' : 'bg-blue-100 text-blue-700'
                }`}>
                    {isUnread ? '★ Non lue' : 'Facturée'}
                </span>
            );
        }
        
        // Vérifier si la tranche est prête
        const maxSession = Math.max(...split.sessions);
        const isReady = split.trigger === 'signature' || completedSessions >= maxSession;
        
        if (isReady) {
            return <span className="px-2 py-1 text-xs font-bold rounded-full bg-amber-100 text-amber-700 animate-pulse">Prête</span>;
        }
        return <span className="px-2 py-1 text-xs font-bold rounded-full bg-slate-100 text-slate-600">En attente</span>;
    };

    // Compter les factures non lues pour un pack
    const getUnreadCountForQuote = (quoteId: string): number => {
        return getSplitInvoicesForQuote(quoteId).filter(inv => !inv.isRead).length;
    };

    // Vérifier s'il y a des filtres actifs
    const hasActiveFilters = filterStatus !== 'all' || filterSplitIndex !== 'all' || filterDateFrom || filterDateTo || searchQuery;

    if (packStats.length === 0) {
        return (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
                <Package className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-slate-700 mb-2">Aucun pack en cours de facturation</h3>
                <p className="text-sm text-slate-500">
                    Les packs avec plusieurs séances apparaîtront ici pour le suivi de la facturation fractionnée.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Statistiques globales */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-5 text-white shadow-lg">
                    <div className="flex items-center justify-between mb-2">
                        <Package className="w-8 h-8 opacity-80" />
                        <span className="text-2xl font-bold">{globalStats.totalPacks}</span>
                    </div>
                    <p className="text-sm opacity-90">Packs actifs</p>
                    <p className="text-xs opacity-70 mt-1">{globalStats.packsInProgress} en cours</p>
                </div>

                <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-5 text-white shadow-lg">
                    <div className="flex items-center justify-between mb-2">
                        <CheckCircle className="w-8 h-8 opacity-80" />
                        <span className="text-2xl font-bold">{globalStats.totalInvoicedSessions}</span>
                    </div>
                    <p className="text-sm opacity-90">Sessions facturées</p>
                    <p className="text-xs opacity-70 mt-1">sur {globalStats.totalSessions} total</p>
                </div>

                <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl p-5 text-white shadow-lg">
                    <div className="flex items-center justify-between mb-2">
                        <Clock className="w-8 h-8 opacity-80" />
                        <span className="text-2xl font-bold">{globalStats.totalRemainingSessions}</span>
                    </div>
                    <p className="text-sm opacity-90">Sessions restantes</p>
                    <p className="text-xs opacity-70 mt-1">à facturer</p>
                </div>

                <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-5 text-white shadow-lg">
                    <div className="flex items-center justify-between mb-2">
                        <TrendingUp className="w-8 h-8 opacity-80" />
                        <span className="text-2xl font-bold">{globalStats.billingProgress.toFixed(0)}%</span>
                    </div>
                    <p className="text-sm opacity-90">Progression</p>
                    <p className="text-xs opacity-70 mt-1">{globalStats.totalInvoicedAmount.toFixed(0)} € / {globalStats.totalAmount.toFixed(0)} €</p>
                </div>
            </div>

            {/* Actions d'automatisation */}
            <div className="bg-white rounded-xl border border-slate-200 p-4">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                        <Zap className="w-4 h-4 text-amber-500" />
                        Automatisation
                    </h3>
                    <span className="text-xs text-slate-400">Cron : toutes les 2 heures</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        onClick={handleAutoGenerate}
                        disabled={isAutoGenerating}
                        className="flex items-center gap-2 px-4 py-2 bg-brand-blue text-white text-sm font-medium rounded-lg hover:bg-teal-700 transition disabled:opacity-50"
                    >
                        {isAutoGenerating ? (
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                            <Zap className="w-4 h-4" />
                        )}
                        Générer les factures en attente
                    </button>
                    <button
                        onClick={handleBackfill}
                        disabled={isBackfilling}
                        className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white text-sm font-medium rounded-lg hover:bg-amber-600 transition disabled:opacity-50"
                    >
                        {isBackfilling ? (
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                            <Calendar className="w-4 h-4" />
                        )}
                        Backfill 6 derniers mois
                    </button>
                    <button
                        onClick={handleRollback}
                        disabled={isRollingBack}
                        className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white text-sm font-medium rounded-lg hover:bg-red-600 transition disabled:opacity-50"
                    >
                        {isRollingBack ? (
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                            <ArrowLeft className="w-4 h-4" />
                        )}
                        Rollback
                    </button>
                </div>
                {backfillResult && (
                    <div className={`mt-3 p-3 rounded-lg text-sm font-medium ${
                        backfillResult.startsWith('✓') ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                        'bg-red-50 text-red-700 border border-red-200'
                    }`}>
                        {backfillResult}
                    </div>
                )}
            </div>

            {/* Barre de progression globale */}
            <div className="bg-white rounded-xl border border-slate-200 p-4">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-slate-700">Progression globale de facturation</span>
                    <span className="text-sm font-bold text-brand-blue">{globalStats.billingProgress.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-3">
                    <div 
                        className="bg-gradient-to-r from-brand-blue to-emerald-500 h-3 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(globalStats.billingProgress, 100)}%` }}
                    />
                </div>
                <div className="flex justify-between mt-2 text-xs text-slate-500">
                    <span>{globalStats.totalInvoicedAmount.toFixed(2)} € facturés</span>
                    <span>{globalStats.totalRemainingAmount.toFixed(2)} € restants</span>
                </div>
            </div>

            {/* Barre de recherche et filtres */}
            <div className="bg-white rounded-xl border border-slate-200 p-4">
                <div className="flex items-center gap-3 mb-3">
                    <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Rechercher par référence, client, facture..."
                            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/30 focus:border-brand-blue"
                        />
                    </div>
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
                            showFilters || hasActiveFilters
                                ? 'bg-brand-blue text-white'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                    >
                        <Filter className="w-4 h-4" />
                        Filtres
                        {hasActiveFilters && (
                            <span className="w-5 h-5 bg-white/30 rounded-full text-xs flex items-center justify-center">!</span>
                        )}
                    </button>
                </div>

                {/* Panneau de filtres avancés */}
                {showFilters && (
                    <div className="border-t border-slate-100 pt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        {/* Filtre par statut */}
                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Statut tranche</label>
                            <select
                                value={filterStatus}
                                onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/30"
                            >
                                <option value="all">Tous les statuts</option>
                                <option value="ready">★ Prête à facturer</option>
                                <option value="pending">En attente</option>
                                <option value="invoiced">Facturée</option>
                                <option value="paid">Payée</option>
                            </select>
                        </div>

                        {/* Filtre par index de tranche */}
                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">N° de tranche</label>
                            <select
                                value={filterSplitIndex}
                                onChange={(e) => setFilterSplitIndex(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/30"
                            >
                                <option value="all">Toutes les tranches</option>
                                {Array.from({ length: 12 }, (_, i) => (
                                    <option key={i} value={i}>Tranche {i + 1}</option>
                                ))}
                            </select>
                        </div>

                        {/* Filtre date début */}
                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Date début</label>
                            <input
                                type="date"
                                value={filterDateFrom}
                                onChange={(e) => setFilterDateFrom(e.target.value)}
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/30"
                            />
                        </div>

                        {/* Filtre date fin */}
                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Date fin</label>
                            <input
                                type="date"
                                value={filterDateTo}
                                onChange={(e) => setFilterDateTo(e.target.value)}
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/30"
                            />
                        </div>

                        {/* Bouton réinitialiser */}
                        {hasActiveFilters && (
                            <div className="sm:col-span-2 lg:col-span-4 flex justify-end">
                                <button
                                    onClick={resetFilters}
                                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition"
                                >
                                    <X className="w-3 h-3" />
                                    Réinitialiser les filtres
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Liste des packs avec leurs factures fractionnées */}
            <div className="space-y-4">
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-brand-blue" />
                    Détail par Pack
                    {hasActiveFilters && (
                        <span className="text-sm font-normal text-slate-500">
                            ({filteredPackStats.length} / {packStats.length} packs)
                        </span>
                    )}
                </h3>

                {filteredPackStats.length === 0 && hasActiveFilters && (
                    <div className="bg-white rounded-xl border border-slate-200 p-6 text-center">
                        <Filter className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                        <p className="text-sm text-slate-500">Aucun pack ne correspond aux filtres appliqués.</p>
                        <button onClick={resetFilters} className="mt-3 text-sm text-brand-blue hover:underline">
                            Réinitialiser les filtres
                        </button>
                    </div>
                )}

                {paginatedPackStats.map((stats) => {
                    const quote = documents.find(d => d.id === stats.quoteId);
                    const splitInvoices = getSplitInvoicesForQuote(stats.quoteId);
                    const isExpanded = expandedQuoteId === stats.quoteId;
                    const config = quote?.splitBillingConfig;
                    const unreadCount = getUnreadCountForQuote(stats.quoteId);

                    return (
                        <div key={stats.quoteId} className={`bg-white rounded-xl border-2 overflow-hidden shadow-sm transition-all ${
                            stats.billingStatus === 'completed' ? 'border-emerald-400 shadow-emerald-100' :
                            stats.billingStatus === 'in_progress' ? 'border-orange-400 shadow-orange-100' :
                            'border-blue-400 shadow-blue-100'
                        } ${unreadCount > 0 ? 'ring-2 ring-indigo-200' : ''}`}>
                            {/* Header du pack — CLIQUABLE pour aller au devis */}
                            <div 
                                className="p-4 cursor-pointer hover:bg-slate-50 transition-colors"
                                onClick={() => toggleExpand(stats.quoteId)}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center relative ${
                                            stats.billingStatus === 'completed' ? 'bg-emerald-100 text-emerald-600' :
                                            stats.billingStatus === 'in_progress' ? 'bg-orange-100 text-orange-600' :
                                            'bg-blue-100 text-blue-600'
                                        }`}>
                                            <Package className="w-6 h-6" />
                                            {unreadCount > 0 && (
                                                <span className="absolute -top-1 -right-1 w-5 h-5 bg-indigo-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center ring-2 ring-white">
                                                    {unreadCount}
                                                </span>
                                            )}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-slate-800">{stats.quoteRef}</span>
                                                <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${
                                                    stats.billingStatus === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                                                    stats.billingStatus === 'in_progress' ? 'bg-orange-100 text-orange-700' :
                                                    'bg-blue-100 text-blue-700'
                                                }`}>
                                                    {stats.billingStatus === 'completed' ? '✓ Terminé' :
                                                     stats.billingStatus === 'in_progress' ? '◐ En cours' : '○ Non démarré'}
                                                </span>
                                                {unreadCount > 0 && (
                                                    <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-indigo-100 text-indigo-700">
                                                        {unreadCount} non lue{unreadCount > 1 ? 's' : ''}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-sm text-slate-600">{stats.clientName}</p>
                                            <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                                                <span className="flex items-center gap-1">
                                                    <CheckCircle className="w-3 h-3" />
                                                    {stats.completedMissions} missions réalisées
                                                </span>
                                                <span>•</span>
                                                <span>{stats.totalSessions} sessions au total</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="text-right">
                                            <p className="text-lg font-bold text-slate-800">{stats.totalAmount.toFixed(2)} €</p>
                                            <p className="text-xs text-slate-500">{stats.billingProgress.toFixed(0)}% facturé</p>
                                        </div>
                                        {isExpanded ? (
                                            <ChevronDown className="w-5 h-5 text-slate-400" />
                                        ) : (
                                            <ChevronRight className="w-5 h-5 text-slate-400" />
                                        )}
                                    </div>
                                </div>

                                {/* Barre de progression du pack */}
                                <div className="mt-3">
                                    <div className="w-full bg-slate-100 rounded-full h-2">
                                        <div 
                                            className={`h-2 rounded-full transition-all duration-500 ${
                                                stats.billingStatus === 'completed' ? 'bg-emerald-500' :
                                                stats.billingStatus === 'in_progress' ? 'bg-orange-400' :
                                                'bg-blue-400'
                                            }`}
                                            style={{ width: `${stats.billingProgress}%` }}
                                        />
                                    </div>
                                    <div className="flex justify-between mt-1 text-xs text-slate-500">
                                        <span>{stats.invoicedSessions} / {stats.totalSessions} sessions facturées</span>
                                        <span>{stats.remainingSessions} restantes</span>
                                    </div>
                                </div>
                            </div>

                            {/* Contenu expandable */}
                            {isExpanded && (
                                <div className="border-t border-slate-200 bg-slate-50 p-4">
                                    {/* Navigation vers le devis parent */}
                                    <div className="flex items-center justify-between mb-4">
                                        <h4 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                            <FileText className="w-4 h-4" />
                                            {config ? `Tranches de facturation (${config.totalSplits})` : 'Sessions du pack'}
                                        </h4>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                navigate(`/admin/devis/${stats.quoteId}`);
                                            }}
                                            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-brand-blue hover:bg-teal-700 rounded-lg transition shadow-sm"
                                            title="Voir le devis parent"
                                        >
                                            <ExternalLink className="w-3 h-3" />
                                            Voir devis {stats.quoteRef}
                                        </button>
                                    </div>
                                    
                                    {/* Tranches de facturation (si config disponible) */}
                                    {config && (
                                    <div className="space-y-2">
                                        {config.splits.map((split) => {
                                            const invoice = splitInvoices.find(inv => inv.id === split.invoiceId);
                                            const isGeneratingThis = isGenerating.has(`${stats.quoteId}-${split.index}`);
                                            const maxSession = Math.max(...split.sessions);
                                            const isReady = split.trigger === 'signature' || stats.completedMissions >= maxSession;
                                            const isUnread = invoice && !invoice.isRead;

                                            return (
                                                <div 
                                                    key={split.index}
                                                    className={`bg-white rounded-lg border p-3 transition-all ${
                                                        isUnread ? 'border-indigo-300 bg-indigo-50/30 shadow-sm shadow-indigo-100' :
                                                        split.status === 'paid' ? 'border-emerald-200' :
                                                        split.status === 'invoiced' ? 'border-blue-200' :
                                                        isReady ? 'border-amber-200' :
                                                        'border-slate-200'
                                                    }`}
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-3">
                                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold relative ${
                                                                split.status === 'paid' ? 'bg-emerald-100 text-emerald-700' :
                                                                split.status === 'invoiced' ? 'bg-blue-100 text-blue-700' :
                                                                isReady ? 'bg-amber-100 text-amber-700' :
                                                                'bg-slate-100 text-slate-600'
                                                            }`}>
                                                                {split.index + 1}
                                                                {isUnread && (
                                                                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-indigo-500 rounded-full ring-2 ring-white" />
                                                                )}
                                                            </div>
                                                            <div>
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-sm font-semibold text-slate-700">
                                                                        Session{split.sessions.length > 1 ? 's' : ''} {split.sessions.join(', ')}
                                                                    </span>
                                                                    {getSplitStatusBadge(split, stats.completedMissions, !!isUnread)}
                                                                </div>
                                                                <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                                                                    <span className="flex items-center gap-1">
                                                                        {split.trigger === 'signature' ? (
                                                                            <><Zap className="w-3 h-3" /> À la signature</>
                                                                        ) : (
                                                                            <><Clock className="w-3 h-3" /> Après session {split.triggerSession}</>
                                                                        )}
                                                                    </span>
                                                                    <span>•</span>
                                                                    <span className="font-semibold">{split.amount.toFixed(2)} €</span>
                                                                    {invoice && (
                                                                        <>
                                                                            <span>•</span>
                                                                            <span className="text-slate-400">{invoice.ref}</span>
                                                                        </>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        
                                                        <div className="flex items-center gap-2">
                                                            {invoice && (
                                                                <>
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            handleNavigateToInvoice(invoice.id);
                                                                        }}
                                                                        className={`p-2 rounded-lg transition ${
                                                                            isUnread 
                                                                                ? 'text-indigo-600 hover:bg-indigo-100 font-semibold'
                                                                                : 'text-slate-500 hover:text-brand-blue hover:bg-blue-50'
                                                                        }`}
                                                                        title={isUnread ? "Facture non consultée - Cliquer pour lire" : "Voir la facture"}
                                                                    >
                                                                        {isUnread ? (
                                                                            <Circle className="w-4 h-4 fill-indigo-500" />
                                                                        ) : (
                                                                            <Eye className="w-4 h-4" />
                                                                        )}
                                                                    </button>
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            handleDownloadInvoicePdf(invoice);
                                                                        }}
                                                                        className="p-2 text-emerald-600 hover:bg-emerald-100 rounded-lg transition"
                                                                        title={`Télécharger PDF ${invoice.ref}`}
                                                                    >
                                                                        <Download className="w-4 h-4" />
                                                                    </button>
                                                                </>
                                                            )}
                                                            {split.status === 'pending' && isReady && (
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleGenerateInvoice(stats.quoteId, split.index);
                                                                    }}
                                                                    disabled={isGeneratingThis}
                                                                    className="flex items-center gap-1 px-3 py-1.5 bg-brand-blue hover:bg-teal-700 text-white text-xs font-bold rounded-lg transition disabled:opacity-50"
                                                                >
                                                                    {isGeneratingThis ? (
                                                                        <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                                                    ) : (
                                                                        <Zap className="w-3 h-3" />
                                                                    )}
                                                                    Générer
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    )}

                                    {/* Sessions du Pack — Vue détaillée (toutes les sessions) */}
                                    {(() => {
                                        const totalSessions = config?.totalSessions || stats.totalSessions;
                                        if (!totalSessions || totalSessions < 1) return null;

                                        // Missions du pack triées par date
                                        const packMissions = missions
                                            .filter(m => m.sourceDocumentId === stats.quoteId)
                                            .sort((a, b) => {
                                                const dateA = a.date || '';
                                                const dateB = b.date || '';
                                                return dateA.localeCompare(dateB);
                                            });

                                        return (
                                            <div className="mt-4 pt-4 border-t border-slate-200">
                                                <h4 className="text-sm font-bold text-slate-700 flex items-center gap-2 mb-3">
                                                    <Calendar className="w-4 h-4 text-brand-blue" />
                                                    Sessions du Pack ({packMissions.length} / {totalSessions} {packMissions.length < totalSessions ? '— en attente de planification' : 'planifiées'})
                                                </h4>
                                                <div className="space-y-2">
                                                    {Array.from({ length: totalSessions }, (_, idx) => {
                                                        const sessionNum = idx + 1;
                                                        const mission = packMissions[idx] || null;
                                                        const today = dayjs().format('YYYY-MM-DD');
                                                        const isPastDate = mission?.date ? mission.date <= today : false;
                                                        const isCompleted = mission?.status === 'completed' || (isPastDate && mission?.status !== 'cancelled');
                                                        const isPlanned = !!mission && !isCompleted && mission.status !== 'cancelled';
                                                        const isFuture = !mission;

                                                        // Trouver la tranche qui couvre cette session
                                                        const coveringSplit = config?.splits.find(s => s.sessions.includes(sessionNum));
                                                        const coveringInvoice = coveringSplit?.invoiceId
                                                            ? splitInvoices.find(inv => inv.id === coveringSplit.invoiceId)
                                                            : null;

                                                        // Statut : facturée (vert) | réalisée non facturée (orange) | à venir (bleu)
                                                        const isInvoiced = coveringSplit?.status === 'invoiced' || coveringSplit?.status === 'paid';
                                                        const sessionState: 'invoiced' | 'completed' | 'planned' | 'future' =
                                                            isInvoiced ? 'invoiced' :
                                                            isCompleted ? 'completed' :
                                                            isPlanned ? 'planned' : 'future';

                                                        const stateColors = {
                                                            invoiced: { bg: 'bg-emerald-50', border: 'border-emerald-300', circle: 'bg-emerald-500 text-white', badge: 'bg-emerald-100 text-emerald-700' },
                                                            completed: { bg: 'bg-orange-50', border: 'border-orange-300', circle: 'bg-orange-500 text-white', badge: 'bg-orange-100 text-orange-700' },
                                                            planned: { bg: 'bg-orange-50', border: 'border-orange-200', circle: 'bg-orange-400 text-white', badge: 'bg-orange-100 text-orange-600' },
                                                            future: { bg: 'bg-blue-50', border: 'border-blue-200', circle: 'bg-blue-400 text-white', badge: 'bg-blue-100 text-blue-700' },
                                                        };
                                                        const colors = stateColors[sessionState];

                                                        const badgeLabel = {
                                                            invoiced: '✓ Facturée',
                                                            completed: '◐ Réalisée (non facturée)',
                                                            planned: '◐ Planifiée',
                                                            future: '○ À venir',
                                                        };

                                                        return (
                                                            <div
                                                                key={sessionNum}
                                                                className={`flex items-center justify-between p-3 rounded-lg border transition-all ${colors.bg} ${colors.border}`}
                                                            >
                                                                <div className="flex items-center gap-3">
                                                                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${colors.circle}`}>
                                                                        {sessionNum}
                                                                    </div>
                                                                    <div>
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="text-sm font-medium text-slate-700">
                                                                                {mission?.date
                                                                                    ? dayjs.tz(mission.date, 'YYYY-MM-DD', MARTINIQUE_TIMEZONE).format('DD/MM/YYYY')
                                                                                    : isFuture ? '— Non planifiée' : '— Date à venir'
                                                                                }
                                                                            </span>
                                                                            {mission && (
                                                                                <span className="text-xs text-slate-500">
                                                                                    {mission.startTime} - {mission.endTime}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                        <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500">
                                                                            {mission?.providerName && (
                                                                                <span className="flex items-center gap-1">
                                                                                    <User className="w-3 h-3" />
                                                                                    {mission.providerName}
                                                                                </span>
                                                                            )}
                                                                            {mission?.service && (
                                                                                <span className="text-slate-400">• {mission.service}</span>
                                                                            )}
                                                                            {coveringSplit && (
                                                                                <span className="text-slate-400">• Tranche {coveringSplit.index + 1}</span>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${colors.badge}`}>
                                                                        {badgeLabel[sessionState]}
                                                                    </span>
                                                                    {coveringInvoice && (
                                                                        <button
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                handleNavigateToInvoice(coveringInvoice.id);
                                                                            }}
                                                                            className="p-1.5 text-blue-500 hover:bg-blue-100 rounded-lg transition"
                                                                            title={`Voir facture ${coveringInvoice.ref}`}
                                                                        >
                                                                            <ExternalLink className="w-3.5 h-3.5" />
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    })()}

                                    {/* Actions rapides */}
                                    {stats.remainingSessions > 0 && (
                                        <div className="mt-4 pt-4 border-t border-slate-200">
                                            <div className="flex items-center justify-between">
                                                <div className="text-sm text-slate-600">
                                                    <span className="font-semibold">{stats.remainingAmount.toFixed(2)} €</span> restant à facturer
                                                </div>
                                                {stats.nextSplitSessions && (
                                                    <div className="text-xs text-amber-700 bg-amber-50 px-3 py-1 rounded-full">
                                                        Prochaine tranche : Sessions {stats.nextSplitSessions.join(', ')}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}

                {/* Pagination */}
                {filteredPackStats.length > ITEMS_PER_PAGE && (
                    <div className="flex items-center justify-between bg-white rounded-xl border border-slate-200 p-4 mt-4">
                        <div className="text-sm text-slate-500">
                            Page {currentPage} sur {totalPages} — {filteredPackStats.length} pack(s)
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setCurrentPage(1)}
                                disabled={currentPage === 1}
                                className="px-2 py-1 text-xs font-medium rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                            >
                                ««
                            </button>
                            <button
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="px-3 py-1 text-xs font-medium rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                            >
                                ‹ Préc
                            </button>
                            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                                let page: number;
                                if (totalPages <= 5) {
                                    page = i + 1;
                                } else if (currentPage <= 3) {
                                    page = i + 1;
                                } else if (currentPage >= totalPages - 2) {
                                    page = totalPages - 4 + i;
                                } else {
                                    page = currentPage - 2 + i;
                                }
                                return (
                                    <button
                                        key={page}
                                        onClick={() => setCurrentPage(page)}
                                        className={`w-8 h-8 text-xs font-bold rounded-lg transition ${
                                            page === currentPage
                                                ? 'bg-brand-blue text-white'
                                                : 'border border-slate-200 text-slate-600 hover:bg-slate-50'
                                        }`}
                                    >
                                        {page}
                                    </button>
                                );
                            })}
                            <button
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                                className="px-3 py-1 text-xs font-medium rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                            >
                                Suiv ›
                            </button>
                            <button
                                onClick={() => setCurrentPage(totalPages)}
                                disabled={currentPage === totalPages}
                                className="px-2 py-1 text-xs font-medium rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                            >
                                »»
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SplitInvoiceManagement;
