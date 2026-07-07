/**
 * Jours fériés en Martinique.
 *
 * Liste officielle :
 * - 1er janvier       : Jour de l'an
 * - Vendredi saint    : Vendredi saint (catholique, mobile)
 * - 1er mai           : Fête du travail
 * - 8 mai             : Victoire 1945
 * - Lundi de Pâques   : Mobile (lendemain du dimanche de Pâques)
 * - Jeudi de l'Ascension : Mobile (39 jours après Pâques)
 * - Lundi de Pentecôte   : Mobile (50 jours après Pâques)
 * - 14 juillet        : Fête nationale
 * - 15 août           : Assomption
 * - 1er novembre      : Toussaint
 * - 11 novembre       : Armistice
 * - 25 décembre       : Noël
 * - 22 mai            : Abolition de l'esclavage (Martinique)
 */

// ─── Calcul de Pâques (algorithme de Gauss / Computus) ─────────────────────

function computeEasterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 3=mars, 4=avril
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// ─── API publique ──────────────────────────────────────────────────────────

/**
 * Retourne la liste de tous les jours fériés Martinique pour une année donnée.
 * Clés = dates au format YYYY-MM-DD, valeurs = nom du jour férié.
 */
export function getHolidaysForYear(year: number): Record<string, string> {
  const easter = computeEasterSunday(year);

  const holidays: Record<string, string> = {};

  // Jours fixes
  holidays[`${year}-01-01`] = "Jour de l'an";
  holidays[`${year}-05-01`] = 'Fête du travail';
  holidays[`${year}-05-08`] = 'Victoire 1945';
  holidays[`${year}-05-22`] = 'Abolition de l\'esclavage';
  holidays[`${year}-07-14`] = 'Fête nationale';
  holidays[`${year}-08-15`] = 'Assomption';
  holidays[`${year}-11-01`] = 'Toussaint';
  holidays[`${year}-11-11`] = 'Armistice';
  holidays[`${year}-12-25`] = 'Noël';

  // Jours mobiles (basés sur Pâques)
  holidays[formatDate(addDays(easter, -2))] = 'Vendredi saint';
  holidays[formatDate(addDays(easter, 1))] = 'Lundi de Pâques';
  holidays[formatDate(addDays(easter, 39))] = 'Ascension';
  holidays[formatDate(addDays(easter, 50))] = 'Lundi de Pentecôte';

  return holidays;
}

/**
 * Vérifie si une date est un jour férié en Martinique.
 * @param dateStr Date au format YYYY-MM-DD
 * @returns true si la date est fériée
 */
export function isHoliday(dateStr: string): boolean {
  try {
    const d = new Date(dateStr + 'T12:00:00');
    const year = d.getFullYear();
    const holidays = getHolidaysForYear(year);
    return !!holidays[dateStr];
  } catch {
    return false;
  }
}

/**
 * Retourne le nom du jour férié pour une date donnée, ou null si ce n'est pas férié.
 * @param dateStr Date au format YYYY-MM-DD
 */
export function getHolidayName(dateStr: string): string | null {
  try {
    const d = new Date(dateStr + 'T12:00:00');
    const year = d.getFullYear();
    const holidays = getHolidaysForYear(year);
    return holidays[dateStr] || null;
  } catch {
    return null;
  }
}
