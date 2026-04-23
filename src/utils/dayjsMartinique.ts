import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import 'dayjs/locale/fr';

// Extensions des plugins dayjs
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.locale('fr');

// Fuseau horaire de la Martinique
export const MARTINIQUE_TIMEZONE = 'America/Martinique';

// Fonction pour formater une date avec le fuseau de la Martinique
export const formatMartiniqueDateTime = (date: Date | string | number, format: string = 'DD/MM/YYYY HH:mm'): string => {
  return dayjs(date).tz(MARTINIQUE_TIMEZONE).format(format);
};

// Fonction pour formater juste la date
export const formatMartiniqueDate = (date: Date | string | number, format: string = 'DD/MM/YYYY'): string => {
  return dayjs(date).tz(MARTINIQUE_TIMEZONE).format(format);
};

// Fonction pour formater juste l'heure
export const formatMartiniqueTime = (date: Date | string | number, format: string = 'HH:mm'): string => {
  return dayjs(date).tz(MARTINIQUE_TIMEZONE).format(format);
};

// Fonction pour obtenir la date actuelle en Martinique
export const getMartiniqueNow = (): dayjs.Dayjs => {
  return dayjs().tz(MARTINIQUE_TIMEZONE);
};

// Fonction pour convertir une date locale en Martinique
export const toMartiniqueTime = (date: Date | string | number): dayjs.Dayjs => {
  return dayjs(date).tz(MARTINIQUE_TIMEZONE);
};

// Formatages courants pour les PDFs
export const PDF_DATE_FORMAT = 'DD MMMM YYYY';
export const PDF_DATETIME_FORMAT = 'DD MMMM YYYY à HH:mm';

// Fonctions spécifiques pour les PDFs
export const formatPDFDate = (date: Date | string | number): string => {
  const formatted = dayjs(date).tz(MARTINIQUE_TIMEZONE).format(PDF_DATE_FORMAT);
  return formatted.replace(/(\d{2}\s+)([^\s]+)/, (_m, p1, month) => {
    const m = String(month || '');
    if (!m) return `${p1}${m}`;
    return `${p1}${m.charAt(0).toUpperCase()}${m.slice(1)}`;
  });
};

export const formatPDFDateTime = (date: Date | string | number): string => {
  const formatted = dayjs(date).tz(MARTINIQUE_TIMEZONE).format(PDF_DATETIME_FORMAT);
  return formatted.replace(/(\d{2}\s+)([^\s]+)/, (_m, p1, month) => {
    const m = String(month || '');
    if (!m) return `${p1}${m}`;
    return `${p1}${m.charAt(0).toUpperCase()}${m.slice(1)}`;
  });
};

// Fonction sécurisée pour formater une date (évite les erreurs sur iPhone avec des dates invalides)
export const safeFormatDate = (
  date: Date | string | number | null | undefined,
  format: string = 'DD/MM/YYYY'
): string => {
  if (!date) return '';
  const d = dayjs(date);
  if (!d.isValid()) return '';
  return d.tz(MARTINIQUE_TIMEZONE).format(format);
};

// Fonction sécurisée pour formater une date avec Intl.DateTimeFormat (fallback sécurisé)
export const safeLocaleDateString = (
  date: Date | string | number | null | undefined,
  locale: string = 'fr-FR',
  options?: Intl.DateTimeFormatOptions
): string => {
  if (!date) return '';

  // Vérifier si la date est valide
  let d: Date;
  if (date instanceof Date) {
    d = date;
  } else {
    d = new Date(date);
  }

  // Vérifier si la date est valide (pas Invalid Date)
  if (!Number.isFinite(d.getTime())) {
    return '';
  }

  try {
    return d.toLocaleDateString(locale, options);
  } catch (e) {
    // Fallback sur dayjs si toLocaleDateString échoue
    return safeFormatDate(date, 'DD/MM/YYYY');
  }
};
