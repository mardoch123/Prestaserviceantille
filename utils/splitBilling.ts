/**
 * Module de calcul de facturation fractionnée par pack
 * 
 * Règles métier dynamiques (1 à N séances, y compris 12+) :
 * - 1 séance  : 1 tranche, facturation immédiate à la signature
 * - 2 séances : 2 tranches (1 à la signature + 1 après complétion)
 * - 3-6 séances : tranches de 2, mode mixed (1ère à signature, reste après complétion)
 * - 7-12 séances : tranches de 2, mode mixed (1ère à signature, reste après complétion)
 * - 13+ séances : tranches de 3, mode after_completion
 * 
 * La logique s'adapte automatiquement à tout nombre de séances.
 */

import type { SplitBillingConfig, SplitDetail, PackBillingStats, Document, Mission } from '../types';

/**
 * Détermine le nombre optimal de sessions par tranche selon le total
 * 
 * @param totalSessions Nombre total de séances
 * @returns Nombre de séances par tranche
 */
function getOptimalSessionsPerSplit(totalSessions: number): number {
    if (totalSessions <= 2) return 1;
    if (totalSessions <= 12) return 2;
    return 3; // 13+ : tranches de 3 pour limiter le nombre de factures
}

/**
 * Calcule la configuration de facturation par tranches pour un pack
 * 
 * S'adapte dynamiquement à tout nombre de séances (1, 2, 3, ..., 12, 13+)
 * 
 * @param totalSessions Nombre total de séances dans le pack
 * @param totalAmount Montant total TTC du devis
 * @param forceMode Force un mode de facturation spécifique (optionnel)
 * @returns Configuration de facturation par tranches
 */
export function calculateSplitBillingConfig(
    totalSessions: number,
    totalAmount: number,
    forceMode?: 'at_signature' | 'after_completion' | 'mixed'
): SplitBillingConfig {
    if (totalSessions <= 0) {
        throw new Error('Le nombre de sessions doit être supérieur à 0');
    }

    let billingMode: 'at_signature' | 'after_completion' | 'mixed';
    let splits: SplitDetail[] = [];

    // Déterminer la stratégie de facturation selon le nombre de séances
    if (totalSessions === 1) {
        // Pack de 1 séance : Facturation immédiate à la signature
        const sessionsPerSplit = 1;
        billingMode = forceMode || 'at_signature';
        splits = [{
            index: 0,
            sessions: [1],
            status: 'pending',
            amount: totalAmount,
            trigger: 'signature'
        }];

        return { totalSessions, sessionsPerSplit, totalSplits: 1, billingMode, splits };
    }

    if (totalSessions === 2) {
        // Pack de 2 séances : 1 à la signature + 1 après réalisation
        const sessionsPerSplit = 1;
        billingMode = forceMode || 'mixed';
        const amountPerSplit = totalAmount / 2;
        splits = [
            {
                index: 0,
                sessions: [1],
                status: 'pending',
                amount: Math.round(amountPerSplit * 100) / 100,
                trigger: 'signature'
            },
            {
                index: 1,
                sessions: [2],
                status: 'pending',
                amount: Math.round(amountPerSplit * 100) / 100,
                trigger: 'completion',
                triggerSession: 2
            }
        ];

        // Ajuster le mode si forcé
        if (forceMode && forceMode !== billingMode) {
            billingMode = forceMode;
            splits = splits.map(split => ({
                ...split,
                trigger: forceMode === 'at_signature' ? 'signature' as const : 
                         forceMode === 'after_completion' ? 'completion' as const : split.trigger
            }));
        }

        return { totalSessions, sessionsPerSplit, totalSplits: splits.length, billingMode, splits };
    }

    // 3 séances et plus : logique dynamique
    const sessionsPerSplit = getOptimalSessionsPerSplit(totalSessions);
    
    // Déterminer le mode par défaut selon la taille du pack
    if (totalSessions <= 12) {
        // 3-12 séances : mode mixed (1ère tranche à la signature, les autres après complétion)
        billingMode = forceMode || 'mixed';
    } else {
        // 13+ séances : mode after_completion
        billingMode = forceMode || 'after_completion';
    }

    splits = generateSplitsForSessions(totalSessions, sessionsPerSplit, totalAmount, billingMode);

    // Ajuster le mode si forcé
    if (forceMode && forceMode !== billingMode) {
        billingMode = forceMode;
        splits = splits.map(split => ({
            ...split,
            trigger: forceMode === 'at_signature' ? 'signature' as const : 
                     forceMode === 'after_completion' ? 'completion' as const : split.trigger
        }));
    }

    return {
        totalSessions,
        sessionsPerSplit,
        totalSplits: splits.length,
        billingMode,
        splits
    };
}

/**
 * Génère les tranches pour un nombre donné de sessions
 */
function generateSplitsForSessions(
    totalSessions: number,
    sessionsPerSplit: number,
    totalAmount: number,
    billingMode: 'at_signature' | 'after_completion' | 'mixed'
): SplitDetail[] {
    const splits: SplitDetail[] = [];
    const totalSplits = Math.ceil(totalSessions / sessionsPerSplit);
    const amountPerSplit = totalAmount / totalSplits;

    for (let i = 0; i < totalSplits; i++) {
        const startSession = i * sessionsPerSplit + 1;
        const endSession = Math.min((i + 1) * sessionsPerSplit, totalSessions);
        const sessions = Array.from({ length: endSession - startSession + 1 }, (_, idx) => startSession + idx);
        
        // Déterminer le trigger selon le mode
        let trigger: 'signature' | 'completion';
        if (billingMode === 'at_signature') {
            trigger = 'signature';
        } else if (billingMode === 'after_completion') {
            trigger = 'completion';
        } else {
            // Mode mixed : première tranche à la signature, les autres après réalisation
            trigger = i === 0 ? 'signature' : 'completion';
        }

        splits.push({
            index: i,
            sessions,
            status: 'pending',
            amount: Math.round(amountPerSplit * 100) / 100,
            trigger,
            triggerSession: trigger === 'completion' ? endSession : undefined
        });
    }

    // Ajuster le dernier montant pour compenser les arrondis
    if (splits.length > 0) {
        const sumWithoutLast = splits.slice(0, -1).reduce((sum, s) => sum + s.amount, 0);
        splits[splits.length - 1].amount = Math.round((totalAmount - sumWithoutLast) * 100) / 100;
    }

    return splits;
}

/**
 * Détermine si une tranche est prête à être facturée
 * 
 * @param split La tranche à vérifier
 * @param completedSessions Nombre de sessions déjà complétées
 * @returns true si la tranche peut être facturée
 */
export function isSplitReadyForInvoicing(
    split: SplitDetail,
    completedSessions: number
): boolean {
    if (split.status !== 'pending') return false;

    if (split.trigger === 'signature') {
        // Toujours prête (à facturer immédiatement)
        return true;
    }

    // Pour trigger = 'completion', vérifier que toutes les sessions de la tranche sont complétées
    const maxSessionInSplit = Math.max(...split.sessions);
    return completedSessions >= maxSessionInSplit;
}

/**
 * Construit un Set de clés "date|startTime" des sessions annulées dans le slotsData du devis
 */
function getCancelledSlotKeys(quote: Document): Set<string> {
    const cancelled = new Set<string>();
    if (quote.slotsData && Array.isArray(quote.slotsData)) {
        for (const slot of quote.slotsData) {
            if (slot?.sessionStatus === 'cancelled' && slot.date && slot.startTime) {
                cancelled.add(`${slot.date}|${slot.startTime}`);
            }
        }
    }
    return cancelled;
}

/**
 * Calcule le nombre de sessions complétées pour un devis donné
 * Exclut les sessions marquées 'cancelled' dans le slotsData du devis
 * 
 * @param quoteId ID du devis
 * @param missions Liste de toutes les missions
 * @param quote Le devis parent (optionnel, pour vérifier les slots annulés)
 * @returns Nombre de sessions complétées
 */
export function getCompletedSessionsForQuote(
    quoteId: string,
    missions: Mission[],
    quote?: Document
): number {
    const today = new Date().toISOString().split('T')[0];
    const quoteMissions = missions.filter(m => m.sourceDocumentId === quoteId);
    const cancelledKeys = quote ? getCancelledSlotKeys(quote) : new Set<string>();
    // Compter comme complétées : missions status 'completed' + missions dont la date est passée (sauf annulées)
    // Exclure aussi les missions correspondant à des slots 'cancelled' dans le slotsData
    return quoteMissions.filter(m => {
        if (m.status === 'cancelled') return false;
        const slotKey = `${m.date}|${m.startTime}`;
        if (cancelledKeys.has(slotKey)) return false;
        return m.status === 'completed' || m.date <= today;
    }).length;
}

/**
 * Calcule les statistiques de facturation pour un pack/devis
 * 
 * @param quote Le devis parent
 * @param splitInvoices Les factures fractionnées liées au devis
 * @param missions Les missions liées au devis
 * @returns Statistiques de facturation du pack
 */
export function calculatePackBillingStats(
    quote: Document,
    splitInvoices: Document[],
    missions: Mission[]
): PackBillingStats {
    const totalSessions = quote.totalSessions || quote.slotsData?.length || 1;
    const today = new Date().toISOString().split('T')[0];
    const quoteMissions = missions.filter(m => m.sourceDocumentId === quote.id);
    const cancelledKeys = getCancelledSlotKeys(quote);
    // Compter comme complétées : missions status 'completed' + missions dont la date est passée (sauf annulées)
    // Exclure les missions correspondant à des slots 'cancelled' dans le slotsData
    const completedMissions = quoteMissions.filter(m => {
        if (m.status === 'cancelled') return false;
        const slotKey = `${m.date}|${m.startTime}`;
        if (cancelledKeys.has(slotKey)) return false;
        return m.status === 'completed' || m.date <= today;
    }).length;

    // Calculer les sessions déjà facturées
    const invoicedSessions = splitInvoices.reduce((sum, inv) => {
        return sum + (inv.coveredSessions?.length || 0);
    }, 0);

    const invoicedAmount = splitInvoices.reduce((sum, inv) => sum + (inv.totalTTC || 0), 0);
    const remainingSessions = Math.max(0, totalSessions - invoicedSessions);
    const remainingAmount = Math.max(0, (quote.totalTTC || 0) - invoicedAmount);
    const billingProgress = totalSessions > 0 ? (invoicedSessions / totalSessions) * 100 : 0;

    // Déterminer le statut global
    let billingStatus: 'not_started' | 'in_progress' | 'completed';
    if (invoicedSessions === 0) {
        billingStatus = 'not_started';
    } else if (invoicedSessions >= totalSessions) {
        billingStatus = 'completed';
    } else {
        billingStatus = 'in_progress';
    }

    // Déterminer la prochaine tranche à facturer
    const config = quote.splitBillingConfig;
    let nextSplitSessions: number[] | undefined;
    if (config && billingStatus !== 'completed') {
        const nextSplit = config.splits.find(s => 
            s.status === 'pending' && isSplitReadyForInvoicing(s, completedMissions)
        );
        if (nextSplit) {
            nextSplitSessions = nextSplit.sessions;
        }
    }

    return {
        quoteId: quote.id,
        quoteRef: quote.ref,
        clientName: quote.clientName,
        totalSessions,
        invoicedSessions,
        remainingSessions,
        totalAmount: quote.totalTTC || 0,
        invoicedAmount,
        remainingAmount,
        billingProgress,
        billingStatus,
        nextSplitSessions,
        completedMissions
    };
}

/**
 * Génère une référence unique pour une facture fractionnée
 * 
 * @param baseRef Référence du devis parent
 * @param splitIndex Index de la tranche
 * @param totalSplits Nombre total de tranches
 * @returns Référence de la facture fractionnée
 */
export function generateSplitInvoiceRef(
    baseRef: string,
    splitIndex: number,
    totalSplits: number
): string {
    // Convertir la référence du devis en référence de facture
    const invoiceRef = baseRef.replace(/^DEV/i, 'FAC');
    return `${invoiceRef}-${String(splitIndex + 1).padStart(2, '0')}-${String(totalSplits).padStart(2, '0')}`;
}

/**
 * Vérifie si un devis est éligible à la facturation fractionnée
 * 
 * @param quote Le devis à vérifier
 * @returns true si le devis peut être fractionné
 */
export function isEligibleForSplitBilling(quote: Document): boolean {
    // Un devis est éligible à la facturation fractionnée s'il :
    // 1. Est de type 'Devis'
    // 2. A un statut 'signed' (signé)
    // 3. A au moins 1 session
    // 4. N'a pas déjà été converti en facture unique
    if (quote.type !== 'Devis') return false;
    if (quote.status !== 'signed' && quote.status !== 'to_invoice') return false;
    if (quote.linkedInvoiceId) return false; // Déjà converti
    
    const sessionCount = quote.totalSessions || quote.slotsData?.length || 0;
    const quantity = quote.quantity || 1;
    
    return sessionCount >= 1 || quantity >= 1;
}

/**
 * Calcule le montant par session pour un devis
 */
export function getAmountPerSession(quote: Document): number {
    const totalSessions = quote.totalSessions || quote.slotsData?.length || 1;
    const totalAmount = quote.totalTTC || 0;
    return totalSessions > 0 ? Math.round((totalAmount / totalSessions) * 100) / 100 : 0;
}

/**
 * Récupère les tranches prêtes à être facturées pour un devis
 * 
 * @param quote Le devis parent
 * @param missions Liste des missions
 * @returns Liste des tranches prêtes à facturer
 */
export function getReadySplitsForQuote(
    quote: Document,
    missions: Mission[]
): SplitDetail[] {
    if (!quote.splitBillingConfig) return [];
    const completedSessions = getCompletedSessionsForQuote(quote.id, missions, quote);
    return quote.splitBillingConfig.splits.filter(s => 
        s.status === 'pending' && isSplitReadyForInvoicing(s, completedSessions)
    );
}

/**
 * Génère un libellé lisible pour une tranche
 * Ex: "Tranche 2/5 - Sessions 3,4"
 */
export function formatSplitLabel(split: SplitDetail, totalSplits: number): string {
    return `Tranche ${split.index + 1}/${totalSplits} - Session${split.sessions.length > 1 ? 's' : ''} ${split.sessions.join(', ')}`;
}
