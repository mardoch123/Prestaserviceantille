import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

// Utilitaire pour gérer l'heure de la Martinique (UTC-4)
export const MARTINIQUE_TIMEZONE = 'America/Martinique';

/**
 * Convertit une date en heure de la Martinique
 * @param date Date à convertir (par défaut: date actuelle)
 * @returns Date convertie en heure de la Martinique
 */
export const toMartiniqueTime = (date: Date = new Date()): Date => {
  return dayjs(date).tz(MARTINIQUE_TIMEZONE).toDate();
};

/**
 * Formate une date/heure en format Martinique
 * @param date Date à formater
 * @param options Options de formatage
 * @returns Chaîne de caractères formatée
 */
export const formatMartiniqueDateTime = (
  date: Date | string | undefined | null, 
  options?: Intl.DateTimeFormatOptions
): string => {
  if (!date) return '';
  
  const dateObj = (() => {
    if (typeof date !== 'string') return date;
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return dayjs.tz(date, 'YYYY-MM-DD', MARTINIQUE_TIMEZONE).toDate();
    }
    return new Date(date);
  })();
  
  if (!dateObj || isNaN(dateObj.getTime())) return '';
  
  const baseOptions: Intl.DateTimeFormatOptions = {
    timeZone: MARTINIQUE_TIMEZONE,
    hour12: false
  };

  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  };

  // Si des options sont fournies, on utilise uniquement ces options (en conservant le timeZone)
  // afin d'éviter d'ajouter implicitement date/heure non désirées.
  const finalOptions = options
    ? { ...baseOptions, ...options }
    : { ...baseOptions, ...defaultOptions };

  return dateObj.toLocaleString('fr-FR', finalOptions);
};

/**
 * Formate uniquement la date en format Martinique
 * @param date Date à formater
 * @returns Chaîne de caractères formatée (JJ/MM/AAAA)
 */
export const formatMartiniqueDate = (date: Date | string): string => {
  return formatMartiniqueDateTime(date, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
};

/**
 * Formate uniquement l'heure en format Martinique
 * @param date Date à formater
 * @returns Chaîne de caractères formatée (HH:MM)
 */
export const formatMartiniqueTime = (date: Date | string): string => {
  return formatMartiniqueDateTime(date, {
    hour: '2-digit',
    minute: '2-digit'
  });
};

/**
 * Obtient la date et heure actuelle de la Martinique en ISO
 * @returns Chaîne ISO de la date/heure Martinique
 */
export const getMartiniqueNowISO = (): string => {
  return dayjs().tz(MARTINIQUE_TIMEZONE).toISOString();
};

/**
 * Obtient la date actuelle de la Martinique en format YYYY-MM-DD
 * @returns Chaîne de la date au format ISO
 */
export const getMartiniqueToday = (): string => {
  return dayjs().tz(MARTINIQUE_TIMEZONE).format('YYYY-MM-DD');
};

/**
 * Vérifie si une date est aujourd'hui en Martinique
 * @param date Date à vérifier
 * @returns boolean
 */
export const isTodayInMartinique = (date: Date | string): boolean => {
  const dateObj = (() => {
    if (typeof date !== 'string') return date;
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return dayjs.tz(date, 'YYYY-MM-DD', MARTINIQUE_TIMEZONE).toDate();
    }
    return new Date(date);
  })();
  const martiniqueDate = formatMartiniqueDate(dateObj);
  const today = getMartiniqueToday();
  return martiniqueDate === today;
};

/**
 * Ajoute des heures à une date en tenant compte du fuseau Martinique
 * @param date Date de départ
 * @param hours Nombre d'heures à ajouter
 * @returns Nouvelle date
 */
export const addHoursInMartinique = (date: Date | string, hours: number): Date => {
  const dateObj = (() => {
    if (typeof date !== 'string') return date;
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return dayjs.tz(date, 'YYYY-MM-DD', MARTINIQUE_TIMEZONE).toDate();
    }
    return new Date(date);
  })();
  return dayjs(dateObj).tz(MARTINIQUE_TIMEZONE).add(hours, 'hour').toDate();
};
