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
  return dayjs(date).tz(MARTINIQUE_TIMEZONE).format(PDF_DATE_FORMAT);
};

export const formatPDFDateTime = (date: Date | string | number): string => {
  return dayjs(date).tz(MARTINIQUE_TIMEZONE).format(PDF_DATETIME_FORMAT);
};
