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
import { getMartiniqueToday } from '../src/utils/martiniqueTime';

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
//   planned     = amber/orange
//   in_progress = bleu
//   completed   = vert
//   cancelled   = gris
// ---------------------------------------------------------------------------
export const MISSION_STATUS_COLORS: Record<Mission['status'], { bg: string; text: string; border: string }> = {
    planned:     { bg: 'bg-amber-100',  text: 'text-amber-700',  border: 'border-amber-300' },
    in_progress: { bg: 'bg-blue-100',   text: 'text-blue-700',   border: 'border-blue-300' },
    completed:   { bg: 'bg-green-100',  text: 'text-green-700',  border: 'border-green-300' },
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
//   Si une mission est encore "planned" mais que sa date est dans le passé,
//   on la considère comme "completed" automatiquement.
//   Cela corrige le bug où une mission passée reste indéfiniment "Planifiée".
// ---------------------------------------------------------------------------
export function getEffectiveStatus(mission: Pick<Mission, 'status' | 'date'>): Mission['status'] {
    if (mission.status === 'planned' && mission.date && mission.date < getMartiniqueToday()) {
        return 'completed';
    }
    return mission.status;
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
