import { isMenageSpecialty } from './availabilityCalculator';

export type ServiceTypeFilter = 'all' | 'Ménage' | 'Jardinage' | 'Bricolage' | 'Autre' | 'Personnalisé';

export const DEFAULT_SERVICE_TYPES: Exclude<ServiceTypeFilter, 'all'>[] = ['Ménage', 'Jardinage', 'Bricolage'];

const normalize = (value: string): string =>
    String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();

const JARDINAGE_KEYWORDS = [
  'jardin', 'jardinage', 'paysag', 'tonte', 'gazon',
  'taille', 'haie', 'elag', 'abattage', 'debrouss',
  'plantation', 'fleur', 'pelouse',
];

const BRICOLAGE_KEYWORDS = [
  'bricol', 'plomber', 'electric', 'peinture', 'macon',
  'menuis', 'serrur', 'climat', 'piscine', 'repar',
  'install', 'montage', 'travaux', 'homme toutes mains',
];

/**
 * Détecte le type de service à partir du texte d'une mission.
 * Utilisé pour le filtre sidebar (planning, dashboard, etc.)
 */
export const getServiceTypeFromText = (text: string): string => {
    const normalized = normalize(text);
    if (!normalized) return 'Autre';

    if (JARDINAGE_KEYWORDS.some(kw => normalized.includes(kw))) return 'Jardinage';
    if (BRICOLAGE_KEYWORDS.some(kw => normalized.includes(kw))) return 'Bricolage';
    if (isMenageSpecialty(text)) return 'Ménage';

    return 'Autre';
};

export const matchesServiceTypeFilterFromText = (text: string, filter: ServiceTypeFilter): boolean => {
    if (!filter || filter === 'all') return true;
    const type = getServiceTypeFromText(text);
    return type === filter;
};

export const getServiceTypeOptions = (items: Array<{ text?: string | null }>): ServiceTypeFilter[] => {
    const set = new Set<Exclude<ServiceTypeFilter, 'all'>>();
    for (const it of items) {
        const txt = String(it?.text || '').trim();
        if (!txt) continue;
        const t = getServiceTypeFromText(txt) as Exclude<ServiceTypeFilter, 'all'>;
        if (t) set.add(t);
    }

    const ordered: Exclude<ServiceTypeFilter, 'all'>[] = [...DEFAULT_SERVICE_TYPES];

    for (const t of set) {
        if (!ordered.includes(t)) ordered.push(t);
    }

    return ['all', ...ordered];
};
