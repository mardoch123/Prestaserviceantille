/**
 * Module centralisé de calcul de disponibilités des prestataires.
 *
 * Règles métier :
 * - Granularité 30 min pour les services < 3h
 * - Blocs fixes Matin (08:00–12:00) / Après-midi (12:00–16:00) pour services >= 3h
 * - Respect strict des plages de travail (availabilityMode, availabilityHours,
 *   nonInterventionHours, nonInterventionDays)
 * - Vérification des congés approuvés (leaves)
 * - Chevauchement précis en minutes (pas en heures entières)
 * - Horaires globaux : 08:00–16:00
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export interface TimeSlot {
  startTime: string; // HH:mm
  endTime: string;   // HH:mm
}

/** Mission minimale nécessaire au calcul (snake_case ou camelCase) */
export interface MissionLike {
  providerId?: string;
  provider_id?: string;
  date: string;           // YYYY-MM-DD
  start_time?: string;    // HH:mm
  startTime?: string;
  end_time?: string;
  endTime?: string;
  status?: string;
}

/** Provider minimal nécessaire au calcul */
export interface ProviderLike {
  id: string;
  specialty?: string;
  availabilityMode?: 'unavailable' | 'available';
  availability_mode?: 'unavailable' | 'available';
  availabilityHours?: Record<number, Array<{ start: string; end: string }>>;
  availability_hours?: Record<number, Array<{ start: string; end: string }>>;
  nonInterventionHours?: Record<number, Array<{ start: string; end: string }>>;
  non_intervention_hours?: Record<number, Array<{ start: string; end: string }>>;
  nonInterventionDays?: number[];
  non_intervention_days?: number[];
  leaves?: Array<{ startDate: string; endDate: string; status?: string }>;
}

// ─── Constantes ─────────────────────────────────────────────────────────────

/** Heure d'ouverture globale (cohérent blocs matin/après-midi) */
export const AVAILABILITY_OPEN_HOUR = 8;
/** Heure de fermeture globale */
export const AVAILABILITY_CLOSE_HOUR = 16;
/** Taille d'un bloc flexible en minutes */
const BLOCK_SIZE_MIN = 30;
/** Seuil de durée (en heures) à partir duquel on bascule en blocs fixes */
const LONG_SERVICE_THRESHOLD = 3;

/**
 * Vérifie si un statut de prestataire est considéré comme "actif" (peut recevoir des missions).
 * Gère les valeurs FR (Actif/Passif) et EN (Active/Passive), case-insensitive.
 */
export function isProviderActive(provider: { status?: string }): boolean {
  const s = String(provider.status || '').toLowerCase().trim();
  return s === 'active' || s === 'actif' || s === 'passive' || s === 'passif';
}

/** Blocs fixes pour prestations longues (>= 3h) */
export const FIXED_BLOCKS: Array<{ label: string; startTime: string; endTime: string }> = [
  { label: 'Matin',       startTime: '08:00', endTime: '12:00' },
  { label: 'Après-midi',  startTime: '12:00', endTime: '16:00' },
];

// ─── Helpers internes ───────────────────────────────────────────────────────

const pad = (n: number) => String(n).padStart(2, '0');

export function timeToMinutes(time: string): number {
  const parts = time.split(':');
  const h = parseInt(parts[0] || '0', 10);
  const m = parseInt(parts[1] || '0', 10);
  return h * 60 + m;
}

export function minutesToTime(minutes: number): string {
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

function getDayOfWeek(dateStr: string): number {
  const d = new Date(dateStr + 'T12:00:00');
  return d.getDay();
}

/** Normalise un nom de champ provider (camelCase ou snake_case) */
function getField<T>(obj: ProviderLike, camel: string, snake: string): T | undefined {
  return (obj as any)[camel] ?? (obj as any)[snake];
}

// ─── Fonctions publiques ────────────────────────────────────────────────────

/**
 * Retourne les heures de travail réelles d'un prestataire pour un jour de semaine donné.
 * Respecte availabilityMode, availabilityHours, nonInterventionHours et nonInterventionDays.
 *
 * @returns tableau d'heures (0–23) pendant lesquelles le prestataire travaille
 */
export function getProviderWorkingHours(provider: ProviderLike, dayOfWeek: number): number[] {
  const mode = provider.availabilityMode || provider.availability_mode || 'unavailable';
  const availabilityHours = provider.availabilityHours || provider.availability_hours || {};
  const nonInterventionHours = provider.nonInterventionHours || provider.non_intervention_hours || {};
  const nonInterventionDays = provider.nonInterventionDays || provider.non_intervention_days || [];

  // Plage de travail globale (08h–15h → couvre blocs 08:00–12:00 et 12:00–16:00)
  const allHours = Array.from({ length: AVAILABILITY_CLOSE_HOUR - AVAILABILITY_OPEN_HOUR }, (_, i) => i + AVAILABILITY_OPEN_HOUR);

  // Jour de non-intervention (repos)
  if (Array.isArray(nonInterventionDays) && nonInterventionDays.includes(dayOfWeek)) {
    return [];
  }

  const isInRange = (hour: number, ranges: Array<{ start: string; end: string }>): boolean => {
    if (!ranges || ranges.length === 0) return false;
    return ranges.some(r => {
      const sh = parseInt((r.start || '00:00').split(':')[0], 10);
      const eh = parseInt((r.end || '00:00').split(':')[0], 10);
      return hour >= sh && hour < eh;
    });
  };

  if (mode === 'available') {
    // Mode "available" : le prestataire n'est disponible QUE pendant availabilityHours
    const hasAnyHours = Object.keys(availabilityHours).length > 0;
    const ranges = availabilityHours[dayOfWeek] || [];
    // Si aucune plage n'est configurée du tout, ou pas pour ce jour → considère toutes les heures standard
    // (le prestataire n'a pas encore configuré ses plages → disponible par défaut)
    if (!hasAnyHours || ranges.length === 0) return allHours;
    return allHours.filter(h => isInRange(h, ranges));
  } else {
    // Mode "unavailable" (défaut) : disponible SAUF pendant nonInterventionHours
    const ranges = nonInterventionHours[dayOfWeek] || [];
    if (ranges.length === 0) return allHours;
    return allHours.filter(h => !isInRange(h, ranges));
  }
}

/**
 * Vérifie si un prestataire est en congé approuvé pour une date donnée.
 */
export function isProviderOnLeave(provider: ProviderLike, dateStr: string): boolean {
  const leaves = provider.leaves || [];
  return leaves.some(l =>
    dateStr >= l.startDate && dateStr <= l.endDate && (l.status === 'approved' || !l.status)
  );
}

/**
 * Vérifie si un créneau (en minutes) chevauche une liste de missions occupées.
 * Chevauchement : slotStart < missionEnd AND slotEnd > missionStart
 */
export function checkMissionOverlap(
  slotStartMin: number,
  slotEndMin: number,
  busyMissions: Array<{ start_time?: string; startTime?: string; end_time?: string; endTime?: string }>
): boolean {
  return busyMissions.some(m => {
    const rawStart = m.start_time || m.startTime || '';
    const rawEnd = m.end_time || m.endTime || '';
    if (!rawStart || !rawEnd) return false; // mission sans horaires → pas de chevauchement
    const mStart = timeToMinutes(rawStart);
    const mEnd = timeToMinutes(rawEnd);
    if (mEnd <= mStart) return false; // mission invalide (durée 0 ou négative)
    return slotStartMin < mEnd && slotEndMin > mStart;
  });
}

/**
 * Normalise un ID provider en string (gère UUID, number, null, undefined).
 */
function normalizeProviderId(id: any): string {
  if (id === null || id === undefined) return '';
  return String(id).trim();
}

/**
 * Vérifie si un prestataire est libre pendant un créneau donné (en minutes).
 */
export function isProviderFreeDuring(
  provider: ProviderLike,
  dateStr: string,
  startMin: number,
  endMin: number,
  missions: MissionLike[]
): boolean {
  if (isProviderOnLeave(provider, dateStr)) return false;

  const pid = normalizeProviderId(provider.id);

  const providerMissions = missions.filter(m => {
    const mPid = normalizeProviderId(m.providerId || m.provider_id);
    return mPid === pid &&
           mPid !== '' &&
           m.date === dateStr &&
           m.status !== 'cancelled';
  });

  return !checkMissionOverlap(startMin, endMin, providerMissions);
}

/**
 * Créneaux de durée valides (en heures) pour la réservation.
 */
export const VALID_DURATIONS_H = [3, 4, 6] as const;

/**
 * Calcule les créneaux libres de 3h, 4h ou 6h consécutifs pour une date donnée.
 * Pour chaque heure de début possible (par tranches d'1h), vérifie si au moins un
 * prestataire est disponible pour la durée complète.
 *
 * @param dateStr       Date au format YYYY-MM-DD
 * @param providers     Liste de prestataires
 * @param missions      Liste de missions (toutes dates)
 * @param serviceDuration  Durée souhaitée en heures (optionnel, par défaut essaie toutes les durées valides)
 * @returns             Créneaux libres { startTime, endTime }
 */
export function computeFreeSlots(
  dateStr: string,
  providers: ProviderLike[],
  missions: MissionLike[],
  serviceDuration?: number | null
): TimeSlot[] {
  if (!providers || providers.length === 0) {
    return [];
  }

  const dayOfWeek = getDayOfWeek(dateStr);
  const openHour = AVAILABILITY_OPEN_HOUR;  // 8
  const closeHour = AVAILABILITY_CLOSE_HOUR; // 16

  // Durées à tester : si serviceDuration spécifié et valide, n'utiliser que celle-là
  const durations = serviceDuration && VALID_DURATIONS_H.includes(serviceDuration as any)
    ? [serviceDuration]
    : [...VALID_DURATIONS_H];

  const slots: TimeSlot[] = [];
  const seen = new Set<string>(); // éviter les doublons

  // Pour chaque durée (6h, 4h, 3h - du plus long au plus court)
  for (const duration of durations.sort((a, b) => b - a)) {
    // Pour chaque heure de début possible
    for (let startH = openHour; startH + duration <= closeHour; startH++) {
      const endH = startH + duration;
      const startMin = startH * 60;
      const endMin = endH * 60;
      const key = `${startMin}-${endMin}`;

      // Vérifier si au moins un prestataire est libre pour cette durée complète
      const hasProvider = providers.some(p => {
        if (isProviderOnLeave(p, dateStr)) return false;
        const workingHours = getProviderWorkingHours(p, dayOfWeek);
        // Le prestataire doit travailler pendant TOUTES les heures du créneau
        for (let h = startH; h < endH; h++) {
          if (!workingHours.includes(h)) return false;
        }
        // Et ne pas avoir de mission qui chevauche ce créneau
        return isProviderFreeDuring(p, dateStr, startMin, endMin, missions);
      });

      if (hasProvider && !seen.has(key)) {
        seen.add(key);
        slots.push({
          startTime: minutesToTime(startMin),
          endTime: minutesToTime(endMin),
        });
      }
    }
  }

  // Trier par heure de début
  return slots.sort((a, b) => a.startTime.localeCompare(b.startTime));
}

/**
 * Mappe une spécialité prestataire vers un domaine de service standardisé.
 */
export function mapSpecialtyToDomain(specialty: string): string {
  const s = (specialty || '').toLowerCase();
  if (s.includes('ménage') || s.includes('menage') || s.includes('nettoyage')) return 'Ménage';
  if (s.includes('jardin')) return 'Jardinage';
  if (s.includes('bricol')) return 'Bricolage';
  return 'Autre';
}

/**
 * Calcule les créneaux libres filtrés par type de service.
 * Ne considère que les prestataires dont la spécialité correspond au service demandé.
 */
export function computeFreeSlotsForServiceType(
  dateStr: string,
  providers: ProviderLike[],
  missions: MissionLike[],
  serviceType: string,
  serviceDuration?: number | null
): TimeSlot[] {
  const domain = serviceType; // 'Ménage', 'Jardinage', 'Bricolage', 'Autre'
  const domainProviders = providers.filter(p => mapSpecialtyToDomain(p.specialty || '') === domain);

  if (domainProviders.length === 0) return [];

  return computeFreeSlots(dateStr, domainProviders, missions, serviceDuration);
}

/**
 * Compte le nombre de prestataires réellement disponibles sur un créneau horaire donné.
 *
 * @param dateStr       Date au format YYYY-MM-DD
 * @param startTime     Heure de début (HH:mm)
 * @param endTime       Heure de fin (HH:mm)
 * @param providers     Liste de prestataires
 * @param missions      Liste de missions (toutes dates)
 * @param serviceType   Type de service pour filtrer par spécialité (optionnel)
 * @returns             Nombre de prestataires libres
 */
export function getAvailableProvidersCount(
  dateStr: string,
  startTime: string,
  endTime: string,
  providers: ProviderLike[],
  missions: MissionLike[],
  serviceType?: string
): number {
  if (!providers || providers.length === 0) return 0;

  const startMin = timeToMinutes(startTime);
  const endMin = timeToMinutes(endTime);
  const dayOfWeek = getDayOfWeek(dateStr);

  let filteredProviders = providers;
  if (serviceType) {
    const domain = serviceType;
    filteredProviders = providers.filter(p => {
      const pDomain = mapSpecialtyToDomain(p.specialty || '');
      return pDomain === domain || domain === 'Autre' || domain === 'Personnalisé';
    });
  }

  return filteredProviders.filter(p => {
    // Vérifier congé
    if (isProviderOnLeave(p, dateStr)) return false;

    // Vérifier heures de travail pour ce jour
    const workingHours = getProviderWorkingHours(p, dayOfWeek);
    if (workingHours.length === 0) return false;

    // Le prestataire doit couvrir la totalité du créneau demandé
    const startH = Math.floor(startMin / 60);
    const endH = Math.ceil(endMin / 60);
    for (let h = startH; h < endH; h++) {
      if (!workingHours.includes(h)) return false;
    }

    // Vérifier missions existantes
    return isProviderFreeDuring(p, dateStr, startMin, endMin, missions);
  }).length;
}

/**
 * Calcule la durée d'un créneau en minutes.
 */
export function slotDurationMinutes(slot: TimeSlot): number {
  return timeToMinutes(slot.endTime) - timeToMinutes(slot.startTime);
}
