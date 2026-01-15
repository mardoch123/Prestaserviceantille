export type ServiceTypeFilter = 'all' | 'Ménage' | 'Jardinage' | 'Bricolage' | 'Autre';

export const DEFAULT_SERVICE_TYPES: Exclude<ServiceTypeFilter, 'all'>[] = ['Ménage', 'Jardinage', 'Bricolage', 'Autre'];

const normalize = (value: string): string =>
    String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();

export const getServiceTypeFromText = (text: string): Exclude<ServiceTypeFilter, 'all'> => {
    const t = normalize(text);

    if (!t.trim()) return 'Autre';

    if (t.includes('jardin') || t.includes('tonte') || t.includes('elag') || t.includes('debrou') || t.includes('taille')) {
        return 'Jardinage';
    }

    if (
        t.includes('brico') ||
        t.includes('montage') ||
        t.includes('reparation') ||
        t.includes('petit travaux') ||
        t.includes('plomberie') ||
        t.includes('electric') ||
        t.includes('peinture')
    ) {
        return 'Bricolage';
    }

    if (
        t.includes('menage') ||
        t.includes('nettoyage') ||
        t.includes('vitre') ||
        t.includes('repass') ||
        t.includes('aspirat')
    ) {
        return 'Ménage';
    }

    return 'Autre';
};

export const matchesServiceTypeFilterFromText = (text: string, filter: ServiceTypeFilter): boolean => {
    if (!filter || filter === 'all') return true;
    return getServiceTypeFromText(text) === filter;
};

export const getServiceTypeOptions = (items: Array<{ text?: string | null }>): ServiceTypeFilter[] => {
    const set = new Set<Exclude<ServiceTypeFilter, 'all'>>();
    for (const it of items) {
        const txt = String(it?.text || '').trim();
        if (!txt) continue;
        set.add(getServiceTypeFromText(txt));
    }

    const ordered: Exclude<ServiceTypeFilter, 'all'>[] = [...DEFAULT_SERVICE_TYPES];

    for (const t of set) {
        if (!ordered.includes(t)) ordered.push(t);
    }

    return ['all', ...ordered];
};
