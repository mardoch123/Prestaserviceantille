/**
 * ============================================================
 *  statusHelpers.ts — Utilitaires centralisés pour les statuts
 *  de mission à travers toute l'application.
 *
 *  - Labels FR cohérents
 *  - Couleurs harmonisées (charte unique)
 *  - Ordre logique de tri
 *  - Détection automatique des missions passées encore "planned"
 * ============================================================
 */

import type { Mission } from '../types';
import dayjs from 'dayjs';
import { getMartiniqueToday, MARTINIQUE_TIMEZONE } from '../src/utils/martiniqueTime';

// ---------------------------------------------------------------------------
// Labels français pour chaque statut de mission
// ---------------------------------------------------------------------------
export const MISSION_STATUS_LABELS: Record<Mission['status'], string> = {
    planned: 'Planifiée',
    in_progress: 'En cours',
    completed: 'Terminée',
    cancelled: 'Annulée',
};

// ---------------------------------------------------------------------------
// Couleurs harmonisées (charte unique sur tous les listings)
//   planned     = bleu marque / ambre
//   in_progress = bleu vif
//   completed   = vert émeraude
//   cancelled   = gris ardoise
// ---------------------------------------------------------------------------
export const MISSION_STATUS_COLORS: Record<Mission['status'], { bg: string; text: string; border: string }> = {
    planned:     { bg: 'bg-sky-100',    text: 'text-sky-800',    border: 'border-sky-300' },
    in_progress: { bg: 'bg-blue-100',   text: 'text-blue-700',   border: 'border-blue-300' },
    completed:   { bg: 'bg-emerald-100', text: 'text-emerald-800', border: 'border-emerald-300' },
    cancelled:   { bg: 'bg-slate-100',  text: 'text-slate-600',  border: 'border-slate-300' },
};

// ---------------------------------------------------------------------------
// Ordre logique des statuts pour le tri
//   Planifiée (0) → En cours (1) → Terminée (2) → Annulée (3)
// ---------------------------------------------------------------------------
export const MISSION_STATUS_ORDER: Record<Mission['status'], number> = {
    planned: 0,
    in_progress: 1,
    completed: 2,
    cancelled: 3,
};

// ---------------------------------------------------------------------------
// getEffectiveStatus
//   Détermine avec précision le statut effectif d'une mission :
//   - Annulée si explicitement annulée ou annulée dans le devis
//   - Terminée si status="completed", date passée, heure de fin dépassée,
//     rapport envoyé ou séance devis marquée "to_invoice" / "invoiced"
// ---------------------------------------------------------------------------
export function getEffectiveStatus(mission: any, documents?: any[]): Mission['status'] {
    if (!mission) return 'planned';

    // 1. Annulation explicite
    if (mission.status === 'cancelled' || mission.sessionStatus === 'cancelled') {
        return 'cancelled';
    }

    // 2. Vérifier si le devis source marque cette séance comme annulée ou facturée/réalisée
    if (documents && mission.sourceDocumentId && mission.date) {
        const doc = documents.find(d => String(d.id) === String(mission.sourceDocumentId));
        if (doc && (doc.slotsData || doc.slots_data)) {
            const raw = doc.slotsData || doc.slots_data;
            const slots = Array.isArray(raw) ? raw : (typeof raw === 'string' ? (() => { try { return JSON.parse(raw); } catch { return []; } })() : []);
            const slot = slots.find((s: any) => s.date === mission.date && (
                s.startTime === mission.startTime ||
                String(s.startTime || '').slice(0, 5) === String(mission.startTime || '').slice(0, 5)
            ));
            if (slot) {
                if (slot.sessionStatus === 'cancelled') return 'cancelled';
                if (slot.sessionStatus === 'completed' || slot.sessionStatus === 'invoiced' || slot.sessionStatus === 'to_invoice') {
                    return 'completed';
                }
            }
        }
    }

    // 3. Complétée explicitement ou via slot devis
    if (mission.status === 'completed' || mission.sessionStatus === 'completed' || mission.sessionStatus === 'invoiced' || mission.sessionStatus === 'to_invoice') {
        return 'completed';
    }

    // 4. Preuves d'intervention (rapport envoyé ou photos de fin)
    if (mission.reportSent || mission.report_sent) return 'completed';
    if ((mission.endPhotos && mission.endPhotos.length > 0) || (mission.end_photos && mission.end_photos.length > 0)) {
        return 'completed';
    }

    // 5. Date passée en Martinique
    const today = getMartiniqueToday();
    if (mission.date && mission.date < today) {
        return 'completed';
    }

    // 6. Mission du jour dont l'heure de fin est déjà passée
    if (mission.date && mission.date === today && mission.endTime) {
        const nowTime = dayjs().tz(MARTINIQUE_TIMEZONE).format('HH:mm');
        const end = String(mission.endTime).slice(0, 5);
        if (end && end <= nowTime) {
            return 'completed';
        }
    }

    if (mission.status === 'in_progress') return 'in_progress';
    return mission.status || 'planned';
}

// ---------------------------------------------------------------------------
// getStatusBadgeClasses
//   Retourne les classes Tailwind complètes pour un badge de statut.
// ---------------------------------------------------------------------------
export function getStatusBadgeClasses(status: Mission['status']): string {
    const colors = MISSION_STATUS_COLORS[status];
    if (!colors) return 'bg-slate-100 text-slate-600';
    return `${colors.bg} ${colors.text} px-2 py-0.5 rounded-full text-xs font-bold`;
}

// ---------------------------------------------------------------------------
// getStatusBorderClass
//   Retourne la classe Tailwind pour la bordure gauche d'une carte mission.
// ---------------------------------------------------------------------------
export function getStatusBorderClass(status: Mission['status']): string {
    switch (status) {
        case 'planned':     return 'border-amber-400';
        case 'in_progress': return 'border-blue-500';
        case 'completed':   return 'border-green-500';
        case 'cancelled':   return 'border-slate-300';
        default:            return 'border-slate-200';
    }
}

// ---------------------------------------------------------------------------
// getStatusLabel
//   Helper rapide pour obtenir le label FR d'un statut.
// ---------------------------------------------------------------------------
export function getStatusLabel(status: Mission['status']): string {
    return MISSION_STATUS_LABELS[status] || status;
}

// ---------------------------------------------------------------------------
// compareMissionsByStatus
//   Fonction de comparaison pour trier des missions par statut (ordre logique).
// ---------------------------------------------------------------------------
export function compareMissionsByStatus(a: Mission, b: Mission): number {
    const orderA = MISSION_STATUS_ORDER[getEffectiveStatus(a)] ?? 99;
    const orderB = MISSION_STATUS_ORDER[getEffectiveStatus(b)] ?? 99;
    return orderA - orderB;
}
