export type ServiceTypeFilter = 'all' | 'Ménage' | 'Jardinage' | 'Bricolage' | 'Autre' | 'Personnalisé';

export const DEFAULT_SERVICE_TYPES: Exclude<ServiceTypeFilter, 'all'>[] = ['Ménage', 'Jardinage', 'Bricolage', 'Autre', 'Personnalisé'];

const normalize = (value: string): string =>
    String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();

export const getServiceTypeFromText = (text: string): Exclude<ServiceTypeFilter, 'all'> => {
    const t = normalize(text);

    if (!t.trim()) return 'Autre';

    // Ménage en premier (ordre cohérent avec mapSpecialtyToDomain dans availabilityCalculator.ts)
    if (
        t.includes('menage') ||
        t.includes('nettoyage') ||
        t.includes('vitre') ||
        t.includes('repass') ||
        t.includes('aspirat') ||
        t.includes('entretien') ||
        t.includes('maison') ||
        t.includes('domicile')
    ) {
        return 'Ménage';
    }

    if (
        t.includes('jardin') ||
        t.includes('tonte') ||
        t.includes('elag') ||
        t.includes('debrou') ||
        t.includes('taille') ||
        t.includes('desher') ||
        t.includes('haie') ||
        t.includes('pelouse')
    ) {
        return 'Jardinage';
    }

    if (
        t.includes('brico') ||
        t.includes('montage') ||
        t.includes('reparation') ||
        t.includes('petit travaux') ||
        t.includes('plomberie') ||
        t.includes('electric') ||
        t.includes('peinture') ||
        t.includes('installation') ||
        t.includes('fixation') ||
        t.includes('perç') ||
        t.includes('perc')
    ) {
        return 'Bricolage';
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
