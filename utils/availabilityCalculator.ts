/**
 * Module centralisé de calcul de disponibilités des prestataires.
 *
 * Règles métier :
 * - Créneaux fixes autorisés :
 *   • 6h : 09:00–15:00 ou 08:00–16:00
 *   • 4h : 09:00–13:00, 08:00–12:00 ou 13:00–17:00
 *     (un prestataire ne peut pas avoir 2 créneaux de 4h le même jour)
 *   • 3h : 09:00–12:00, 08:00–11:00, 13:00–16:00, 13:30–16:30 ou 14:00–17:00
 * - Temps de trajet : 30 min minimum entre deux prestations (TRAVEL_BUFFER_MIN)
 * - Respect strict des plages de travail (availabilityMode, availabilityHours,
 *   nonInterventionHours, nonInterventionDays)
 * - Vérification des congés approuvés (leaves)
 * - Jours fériés Martinique (bloquent la réservation)
 * - Max 2 prestations par jour et par prestataire
 */

import { isHoliday } from './holidays';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface TimeSlot {
  startTime: string; // HH:mm
  endTime: string;   // HH:mm
}

/** Mission minimale nécessaire au calcul (snake_case ou camelCase) */
export interface MissionLike {
  providerId?: string;
  provider_id?: string;
  provider2Id?: string;
  provider2_id?: string;
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
  status?: string;
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
  scheduledUnavailabilities?: Array<{ dayOfWeek: number; startTime: string; endTime: string; startDate: string; weeks: number }>;
  scheduled_unavailabilities?: Array<{ dayOfWeek: number; startTime: string; endTime: string; startDate: string; weeks: number }>;
  oneTimeUnavailabilities?: Array<{ date: string; startTime: string; endTime: string }>;
  one_time_unavailabilities?: Array<{ date: string; startTime: string; endTime: string }>;
}

// ─── Constantes ─────────────────────────────────────────────────────────────

/** Heure d'ouverture globale */
export const AVAILABILITY_OPEN_HOUR = 8;
/** Heure de fermeture globale (étendue à 17h pour le créneau 13h–17h) */
export const AVAILABILITY_CLOSE_HOUR = 17;
/** Nombre maximum de prestations par jour et par prestataire */
export const MAX_PRESTATIONS_PER_DAY = 2;
/**
 * Temps de trajet minimum entre deux prestations (en minutes).
 * Les prestataires ont besoin d'un intervalle pour se rendre à la prochaine prestation.
 */
export const TRAVEL_BUFFER_MIN = 30;

/**
 * Créneaux autorisés fixes pour la disponibilité.
 * Un prestataire ne peut être réservé que sur l'un de ces créneaux.
 * Règle : un prestataire ne peut pas avoir 2 créneaux de 4h le même jour.
 */
export const ALLOWED_SLOTS: Array<{ duration: number; startTime: string; endTime: string }> = [
  // 6h
  { duration: 6, startTime: '09:00', endTime: '15:00' },
  { duration: 6, startTime: '08:00', endTime: '16:00' },
  // 4h
  { duration: 4, startTime: '09:00', endTime: '13:00' },
  { duration: 4, startTime: '08:00', endTime: '12:00' },
  { duration: 4, startTime: '13:00', endTime: '17:00' },
  // 3h
  { duration: 3, startTime: '09:00', endTime: '12:00' },
  { duration: 3, startTime: '08:00', endTime: '11:00' },
  { duration: 3, startTime: '13:00', endTime: '16:00' },
  { duration: 3, startTime: '13:30', endTime: '16:30' },
  { duration: 3, startTime: '14:00', endTime: '17:00' },
];

/**
 * Vérifie si un statut de prestataire est considéré comme "actif" (peut recevoir des missions).
 * Gère les valeurs FR (Actif/Passif) et EN (Active/Passive), case-insensitive.
 */
export function isProviderActive(provider: { status?: string }): boolean {
  const s = String(provider.status || '').toLowerCase().trim();
  return s === 'active' || s === 'actif' || s === 'passive' || s === 'passif';
}

/**
 * Extrait les missions provisoires depuis les devis envoyés (status 'sent', non expirés).
 * Ces créneaux doivent être pris en compte pour bloquer les disponibilités et éviter le surbooking.
 *
 * @param documents  Liste des documents (devis, factures, etc.)
 * @returns          Missions provisoires au format MissionLike[]
 */
export function getProvisionalMissionsFromDocuments(documents: any[]): MissionLike[] {
  if (!documents || documents.length === 0) return [];
  const now = new Date();

  return documents
    .filter((d: any) => d?.type === 'Devis' && d?.status === 'sent')
    .filter((d: any) => {
      // Filtrer les devis expirés
      const expStr = d.expirationDate || d.expiration_date;
      if (expStr) {
        try {
          if (new Date(expStr) < now) return false;
        } catch { /* ignore */ }
      }
      return true;
    })
    .filter((d: any) => Array.isArray(d.slotsData) && d.slotsData.length > 0)
    .flatMap((d: any) =>
      (d.slotsData || []).map((slot: any, idx: number) => ({
        id: `provisional-${d.id}-${idx}`,
        providerId: slot?.providerId || d.providerId || null,
        provider_id: slot?.providerId || d.providerId || null,
        date: slot?.date || '',
        start_time: slot?.startTime || '',
        startTime: slot?.startTime || '',
        end_time: slot?.endTime || '',
        endTime: slot?.endTime || '',
        status: 'planned', // considéré comme planifié pour bloquer la dispo
      }))
    )
    .filter((m: MissionLike) => !!m.date);
}

/** Blocs fixes pour prestations longues (>= 3h) */
export const FIXED_BLOCKS: Array<{ label: string; startTime: string; endTime: string }> = [
  { label: 'Matin',       startTime: '08:00', endTime: '12:00' },
  { label: 'Après-midi',  startTime: '13:00', endTime: '17:00' },
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
 * Retourne les indisponibilités programmées actives pour une date donnée.
 * Vérifie si la date tombe dans la fenêtre de N semaines à partir de startDate.
 */
export function getScheduledUnavailabilitiesForDate(
  provider: ProviderLike,
  dateStr: string
): Array<{ dayOfWeek: number; startTime: string; endTime: string; startDate: string; weeks: number }> {
  const scheds = provider.scheduledUnavailabilities || provider.scheduled_unavailabilities || [];
  if (!Array.isArray(scheds) || scheds.length === 0) return [];

  const date = new Date(dateStr + 'T12:00:00');
  const dateDay = date.getDay();

  return scheds.filter(su => {
    // Le jour de la semaine doit correspondre
    if (su.dayOfWeek !== dateDay) return false;

    // Vérifier que la date est dans la fenêtre de N semaines
    const startDate = new Date(su.startDate + 'T00:00:00');
    if (date < startDate) return false; // pas encore commencé

    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + (su.weeks * 7) - 1);
    if (date > endDate) return false; // fenêtre terminée

    return true;
  });
}

/**
 * Filtre les heures de travail en retirant celles bloquées par les indisponibilités programmées.
 */
export function filterHoursByScheduledUnavailabilities(
  provider: ProviderLike,
  dateStr: string,
  workingHours: number[]
): number[] {
  const activeScheds = getScheduledUnavailabilitiesForDate(provider, dateStr);
  if (activeScheds.length === 0) return workingHours;

  return workingHours.filter(h => {
    return !activeScheds.some(su => {
      const sh = parseInt((su.startTime || '00:00').split(':')[0], 10);
      const eh = parseInt((su.endTime || '00:00').split(':')[0], 10);
      return h >= sh && h < eh;
    });
  });
}

/**
 * Filtre les heures de travail en retirant celles bloquées par les indisponibilités ponctuelles.
 * Une indisponibilité ponctuelle concerne une date précise et un créneau horaire.
 */
export function filterHoursByOneTimeUnavailabilities(
  provider: ProviderLike,
  dateStr: string,
  workingHours: number[]
): number[] {
  const oneTimes = provider.oneTimeUnavailabilities || provider.one_time_unavailabilities || [];
  if (!Array.isArray(oneTimes) || oneTimes.length === 0) return workingHours;

  const activeForDate = oneTimes.filter(otu => otu.date === dateStr);
  if (activeForDate.length === 0) return workingHours;

  return workingHours.filter(h => {
    return !activeForDate.some(otu => {
      const sh = parseInt((otu.startTime || '00:00').split(':')[0], 10);
      const eh = parseInt((otu.endTime || '00:00').split(':')[0], 10);
      return h >= sh && h < eh;
    });
  });
}

/**
 * Vérifie si un prestataire est bloqué par une indisponibilité ponctuelle pour une date/créneau donné.
 */
export function isProviderBlockedByOneTimeUnavailability(
  provider: ProviderLike,
  dateStr: string,
  startTime: string,
  endTime: string
): boolean {
  const oneTimes = provider.oneTimeUnavailabilities || provider.one_time_unavailabilities || [];
  if (!Array.isArray(oneTimes) || oneTimes.length === 0) return false;

  const activeForDate = oneTimes.filter(otu => otu.date === dateStr);
  if (activeForDate.length === 0) return false;

  const s = timeToMinutes(startTime);
  const e = timeToMinutes(endTime);

  return activeForDate.some(otu => {
    const otuStart = timeToMinutes(otu.startTime || '00:00');
    const otuEnd = timeToMinutes(otu.endTime || '00:00');
    if (!Number.isFinite(otuStart) || !Number.isFinite(otuEnd)) return false;
    return s < otuEnd && e > otuStart;
  });
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
 * Vérifie si un créneau (en minutes) chevauche une liste de missions occupées,
 * en tenant compte du temps de trajet (TRAVEL_BUFFER_MIN).
 * Chevauchement avec buffer : slotStart < missionEnd + buffer AND slotEnd > missionStart - buffer
 */
export function checkMissionOverlap(
  slotStartMin: number,
  slotEndMin: number,
  busyMissions: Array<{ start_time?: string; startTime?: string; end_time?: string; endTime?: string }>,
  bufferMin: number = TRAVEL_BUFFER_MIN
): boolean {
  return busyMissions.some(m => {
    const rawStart = m.start_time || m.startTime || '';
    const rawEnd = m.end_time || m.endTime || '';
    if (!rawStart || !rawEnd) return false; // mission sans horaires → pas de chevauchement
    const mStart = timeToMinutes(rawStart);
    const mEnd = timeToMinutes(rawEnd);
    if (mEnd <= mStart) return false; // mission invalide (durée 0 ou négative)
    return slotStartMin < (mEnd + bufferMin) && slotEndMin > (mStart - bufferMin);
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
 * Normalise le statut d'une mission pour garantir la cohérence
 * entre les différentes sources de données (Supabase direct, DataContext, etc.).
 * Gère les variantes FR/EN, accents, majuscules/minuscules, tirets.
 */
function normalizeMissionStatus(status: any): string {
  const raw = String(status || '').trim();
  const plain = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/-+/g, '_');

  if (plain === 'in_progress' || plain === 'inprogress' || plain === 'en_cours' || plain === 'encours' || plain === 'demarree' || plain === 'demarre') return 'in_progress';
  if (plain === 'completed' || plain === 'complete' || plain === 'terminee' || plain === 'termine' || plain === 'done' || plain === 'finished') return 'completed';
  if (plain === 'cancelled' || plain === 'canceled' || plain === 'annulee' || plain === 'annule') return 'cancelled';
  if (plain === 'planned' || plain === 'planifiee' || plain === 'planifie') return 'planned';
  return 'planned';
}

/**
 * Compte le nombre de missions d'un prestataire pour une date donnée.
 * Les missions annulées ne sont pas comptées.
 */
export function getProviderDailyMissionCount(
  provider: ProviderLike,
  dateStr: string,
  missions: MissionLike[]
): number {
  const pid = normalizeProviderId(provider.id);
  return missions.filter(m => {
    const mPid = normalizeProviderId(m.providerId || m.provider_id);
    const mP2Id = normalizeProviderId(m.provider2Id || m.provider2_id);
    const matchesProvider = mPid === pid && mPid !== '';
    const matchesProvider2 = mP2Id === pid && mP2Id !== '';
    return (matchesProvider || matchesProvider2) &&
           m.date === dateStr &&
           normalizeMissionStatus(m.status) !== 'cancelled';
  }).length;
}

/**
 * Vérifie si un prestataire est libre pendant un créneau donné (en minutes).
 * Règle métier : max 2 prestations/jour/prestataire.
 */
export function isProviderFreeDuring(
  provider: ProviderLike,
  dateStr: string,
  startMin: number,
  endMin: number,
  missions: MissionLike[]
): boolean {
  if (isProviderOnLeave(provider, dateStr)) return false;

  // Vérifier indisponibilité ponctuelle
  if (isProviderBlockedByOneTimeUnavailability(provider, dateStr, minutesToTime(startMin), minutesToTime(endMin))) return false;

  const pid = normalizeProviderId(provider.id);

  const providerMissions = missions.filter(m => {
    const mPid = normalizeProviderId(m.providerId || m.provider_id);
    const mP2Id = normalizeProviderId(m.provider2Id || m.provider2_id);
    const matchesProvider = mPid === pid && mPid !== '';
    const matchesProvider2 = mP2Id === pid && mP2Id !== '';
    return (matchesProvider || matchesProvider2) &&
           m.date === dateStr &&
           normalizeMissionStatus(m.status) !== 'cancelled';
  });

  // Règle métier : max 2 prestations par jour et par prestataire
  if (providerMissions.length >= MAX_PRESTATIONS_PER_DAY) return false;

  return !checkMissionOverlap(startMin, endMin, providerMissions);
}

/**
 * Vérifie si un prestataire a déjà un créneau de 4h assigné pour une date donnée.
 * Règle : un prestataire ne peut pas avoir 2 créneaux de 4h le même jour.
 */
export function hasProviderExisting4hSlot(
  provider: ProviderLike,
  dateStr: string,
  missions: MissionLike[]
): boolean {
  const pid = normalizeProviderId(provider.id);
  return missions.some(m => {
    const mPid = normalizeProviderId(m.providerId || m.provider_id);
    const mP2Id = normalizeProviderId(m.provider2Id || m.provider2_id);
    const matchesProvider = mPid === pid && mPid !== '';
    const matchesProvider2 = mP2Id === pid && mP2Id !== '';
    if (!matchesProvider && !matchesProvider2) return false;
    if (m.date !== dateStr) return false;
    if (normalizeMissionStatus(m.status) === 'cancelled') return false;
    const rawStart = m.start_time || m.startTime || '';
    const rawEnd = m.end_time || m.endTime || '';
    if (!rawStart || !rawEnd) return false;
    const dur = timeToMinutes(rawEnd) - timeToMinutes(rawStart);
    return dur === 4 * 60;
  });
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
  // Jour férié Martinique → aucun créneau disponible
  if (isHoliday(dateStr)) return [];

  if (!providers || providers.length === 0) {
    return [];
  }

  // Dédupliquer les providers par ID (au cas où)
  const seenProviderIds = new Set<string>();
  const uniqueProviders = providers.filter(p => {
    const pid = normalizeProviderId(p.id);
    if (seenProviderIds.has(pid)) return false;
    seenProviderIds.add(pid);
    return true;
  }).filter(p => isMenageSpecialty(p.specialty || ''));

  const dayOfWeek = getDayOfWeek(dateStr);

  // Filtrer les créneaux autorisés par durée si demandée
  let allowedSlots = ALLOWED_SLOTS;
  if (serviceDuration && VALID_DURATIONS_H.includes(serviceDuration as any)) {
    allowedSlots = ALLOWED_SLOTS.filter(s => s.duration === serviceDuration);
  }

  const slots: TimeSlot[] = [];
  const seen = new Set<string>();

  for (const slotDef of allowedSlots) {
    const startMin = timeToMinutes(slotDef.startTime);
    const endMin = timeToMinutes(slotDef.endTime);
    const startH = Math.floor(startMin / 60);
    const endH = Math.ceil(endMin / 60);
    const key = `${startMin}-${endMin}`;

    if (seen.has(key)) continue;

    // Vérifier si au moins un prestataire est libre pour ce créneau
    const hasProvider = uniqueProviders.some(p => {
      if (isProviderOnLeave(p, dateStr)) return false;
      let workingHours = getProviderWorkingHours(p, dayOfWeek);
      // Filtrer par indisponibilités programmées multi-semaines
      workingHours = filterHoursByScheduledUnavailabilities(p, dateStr, workingHours);
      // Filtrer par indisponibilités ponctuelles
      workingHours = filterHoursByOneTimeUnavailabilities(p, dateStr, workingHours);
      if (workingHours.length === 0) return false;
      // Le prestataire doit travailler pendant TOUTES les heures du créneau
      for (let h = startH; h < endH; h++) {
        if (!workingHours.includes(h)) return false;
      }
      // Règle 4h : pas 2 créneaux de 4h le même jour
      if (slotDef.duration === 4 && hasProviderExisting4hSlot(p, dateStr, missions)) return false;
      // Et ne pas avoir de mission qui chevauche ce créneau
      return isProviderFreeDuring(p, dateStr, startMin, endMin, missions);
    });

    if (hasProvider) {
      seen.add(key);
      slots.push({
        startTime: slotDef.startTime,
        endTime: slotDef.endTime,
      });
    }
  }

  // Trier par heure de début
  return slots.sort((a, b) => a.startTime.localeCompare(b.startTime));
}

/**
 * Mots-clés reconnus comme spécialité « Ménage ».
 * Seuls les prestataires dont la spécialité contient l'un de ces mots-clés
 * sont affichés dans les disponibilités et le flux de réservation.
 */
const MENAGE_KEYWORDS = [
  'menage', 'ménage', 'nettoyage', 'entretien',
  'repassage', 'vitres', 'aspiration', 'domicile', 'maison',
];

/**
 * Vérifie si une spécialité prestataire correspond strictement au domaine « Ménage ».
 * Exclut jardinage, bricolage, et toute autre spécialité non liée au ménage.
 */
export function isMenageSpecialty(specialty: string): boolean {
  const normalized = String(specialty || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
  if (!normalized) return false;
  return MENAGE_KEYWORDS.some(kw => normalized.includes(kw));
}

/**
 * Mappe une spécialité prestataire vers un domaine de service standardisé.
 * Retourne 'Ménage' uniquement si la spécialité correspond au ménage, sinon null.
 */
export function mapSpecialtyToDomain(specialty: string): string | null {
  return isMenageSpecialty(specialty) ? 'Ménage' : null;
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
  const domain = serviceType; // 'Ménage', 'Bricolage', 'Autre'
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
  // Jour férié Martinique → aucun prestataire disponible
  if (isHoliday(dateStr)) return 0;

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

  // Filtrer uniquement les prestataires dont la spécialité est strictement « Ménage »
  filteredProviders = filteredProviders.filter(p => isMenageSpecialty(p.specialty || ''));

  return filteredProviders.filter(p => {
    // Vérifier congé
    if (isProviderOnLeave(p, dateStr)) return false;

    // Vérifier heures de travail pour ce jour
    let workingHours = getProviderWorkingHours(p, dayOfWeek);
    if (workingHours.length === 0) return false;

    // Filtrer par indisponibilités programmées multi-semaines
    workingHours = filterHoursByScheduledUnavailabilities(p, dateStr, workingHours);
    // Filtrer par indisponibilités ponctuelles
    workingHours = filterHoursByOneTimeUnavailabilities(p, dateStr, workingHours);
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

// ─── Nouveau type de créneau enrichi ────────────────────────────────────────

export interface EnrichedSlot {
  startTime: string;       // HH:mm
  endTime: string;         // HH:mm
  durationHours: number;   // 3, 4 ou 6
  providerCount: number;   // nombre de prestataires libres sur ce créneau
  providerIds: string[];   // IDs des prestataires libres
}

/**
 * Calcule les créneaux cumulatifs de 3h, 4h, 6h entre 9h et 16h.
 * Pour chaque créneau, retourne le nombre de prestataires disponibles.
 *
 * @param dateStr       Date au format YYYY-MM-DD
 * @param providers     Liste de prestataires
 * @param missions      Liste de missions (toutes dates)
 * @param serviceType   Type de service pour filtrer par spécialité (optionnel)
 * @returns             Créneaux enrichis avec nombre de prestataires
 */
export function computeAvailabilitySlots(
  dateStr: string,
  providers: ProviderLike[],
  missions: MissionLike[],
  serviceType?: string
): EnrichedSlot[] {
  // Jour férié Martinique → aucun créneau
  if (isHoliday(dateStr)) return [];

  if (!providers || providers.length === 0) return [];

  const dayOfWeek = getDayOfWeek(dateStr);

  // Filtrer par type de service si demandé
  let filteredProviders = providers;

  // Filtrer systématiquement par spécialité Ménage (exclure jardinage, bricolage, etc.)
  filteredProviders = filteredProviders.filter(p => isMenageSpecialty(p.specialty || ''));

  if (serviceType) {
    const domain = serviceType;
    filteredProviders = filteredProviders.filter(p => {
      const pDomain = mapSpecialtyToDomain(p.specialty || '');
      return pDomain === domain || domain === 'Autre' || domain === 'Personnalisé';
    });
  }

  // Dédupliquer les providers par ID (au cas où)
  const seenIds = new Set<string>();
  filteredProviders = filteredProviders.filter(p => {
    const pid = normalizeProviderId(p.id);
    if (seenIds.has(pid)) return false;
    seenIds.add(pid);
    return true;
  });

  // Filtrer uniquement les prestataires actifs/passifs (FR: Actif/Passif, EN: Active/Passive)
  filteredProviders = filteredProviders.filter(p => isProviderActive(p));

  if (filteredProviders.length === 0) return [];

  const slots: EnrichedSlot[] = [];
  const seen = new Set<string>();

  // Parcourir les créneaux autorisés fixes (du plus long au plus court)
  const sortedAllowed = [...ALLOWED_SLOTS].sort((a, b) => b.duration - a.duration);

  for (const slotDef of sortedAllowed) {
    const startMin = timeToMinutes(slotDef.startTime);
    const endMin = timeToMinutes(slotDef.endTime);
    const startH = Math.floor(startMin / 60);
    const endH = Math.ceil(endMin / 60);
    const key = `${startMin}-${endMin}`;

    if (seen.has(key)) continue;

    // Compter les prestataires libres pour ce créneau (sans doublons)
    const freeProviderIdsSet = new Set<string>();

    for (const p of filteredProviders) {
      const pid = normalizeProviderId(p.id);
      if (freeProviderIdsSet.has(pid)) continue; // Doublon

      if (isProviderOnLeave(p, dateStr)) continue;

      let workingHours = getProviderWorkingHours(p, dayOfWeek);
      if (workingHours.length === 0) continue;

      // Filtrer par indisponibilités programmées multi-semaines
      workingHours = filterHoursByScheduledUnavailabilities(p, dateStr, workingHours);
      // Filtrer par indisponibilités ponctuelles
      workingHours = filterHoursByOneTimeUnavailabilities(p, dateStr, workingHours);
      if (workingHours.length === 0) continue;

      // Le prestataire doit travailler pendant TOUTES les heures du créneau
      let coversAll = true;
      for (let h = startH; h < endH; h++) {
        if (!workingHours.includes(h)) {
          coversAll = false;
          break;
        }
      }
      if (!coversAll) continue;

      // Règle 4h : pas 2 créneaux de 4h le même jour
      if (slotDef.duration === 4 && hasProviderExisting4hSlot(p, dateStr, missions)) continue;

      // Vérifier pas de chevauchement + règle max 2/jour
      if (isProviderFreeDuring(p, dateStr, startMin, endMin, missions)) {
        freeProviderIdsSet.add(pid);
      }
    }

    const freeProviderIds = Array.from(freeProviderIdsSet);

    if (freeProviderIds.length > 0) {
      seen.add(key);
      slots.push({
        startTime: slotDef.startTime,
        endTime: slotDef.endTime,
        durationHours: slotDef.duration,
        providerCount: freeProviderIds.length,
        providerIds: freeProviderIds,
      });
    }
  }

  // Trier par heure de début, puis par durée décroissante
  return slots.sort((a, b) => {
    const timeCmp = a.startTime.localeCompare(b.startTime);
    if (timeCmp !== 0) return timeCmp;
    return b.durationHours - a.durationHours;
  });
}

/**
 * Regroupe les créneaux enrichis par plage horaire (start-end unique).
 * Pour chaque plage, indique les durées possibles et le nombre de prestataires max.
 */
export interface GroupedSlot {
  startTime: string;
  endTime: string;
  durations: number[];           // durées possibles [3, 4, 6]
  maxProviderCount: number;      // nb max de prestataires (sur toutes les durées)
  providersByDuration: Record<number, { count: number; ids: string[] }>;
}

export function groupSlotsByTime(slots: EnrichedSlot[]): GroupedSlot[] {
  const map = new Map<string, GroupedSlot>();

  for (const slot of slots) {
    const key = `${slot.startTime}-${slot.endTime}`;
    if (!map.has(key)) {
      map.set(key, {
        startTime: slot.startTime,
        endTime: slot.endTime,
        durations: [],
        maxProviderCount: 0,
        providersByDuration: {},
      });
    }
    const group = map.get(key)!;
    group.durations.push(slot.durationHours);
    group.providersByDuration[slot.durationHours] = {
      count: slot.providerCount,
      ids: slot.providerIds,
    };
    if (slot.providerCount > group.maxProviderCount) {
      group.maxProviderCount = slot.providerCount;
    }
  }

  return Array.from(map.values()).sort((a, b) => a.startTime.localeCompare(b.startTime));
}
