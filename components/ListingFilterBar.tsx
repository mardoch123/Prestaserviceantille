/**
 * ============================================================
 *  ListingFilterBar.tsx — Composant générique de filtres/tri
 *  réutilisable sur tous les listings de l'application.
 *
 *  Fonctionnalités :
 *  - Barre de recherche
 *  - Sélecteur de tri + inversion asc/desc
 *  - Filtres dynamiques (simple ou multi-sélection)
 *  - Compteur "X sur Y élément(s)"
 *  - Chips de filtres actifs avec retrait individuel
 *  - Bouton "Réinitialiser"
 *  - Responsive : panneau filtres mobile
 * ============================================================
 */

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, ArrowUpDown, ArrowUp, ArrowDown, X, RotateCcw, SlidersHorizontal, ChevronDown, Check } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types publics
// ---------------------------------------------------------------------------
export interface SortOption {
    value: string;
    label: string;
}

export interface FilterConfig {
    key: string;
    label: string;
    options: Array<{ value: string; label: string }>;
    multiple?: boolean;
    placeholder?: string;
}

export interface ListingFilterBarProps {
    // Recherche
    searchValue: string;
    onSearchChange: (v: string) => void;
    searchPlaceholder?: string;

    // Tri
    sortOptions: SortOption[];
    sortValue: string;
    onSortChange: (v: string) => void;
    sortDirection: 'asc' | 'desc';
    onSortDirectionToggle: () => void;

    // Filtres dynamiques
    filters: FilterConfig[];
    filterValues: Record<string, string | string[]>;
    onFilterChange: (key: string, value: string | string[]) => void;

    // Compteurs
    filteredCount: number;
    totalCount: number;
    entityLabel?: string; // ex: "mission(s)", "client(s)" — défaut "élément(s)"

    // Reset
    onReset: () => void;
    hasActiveFilters: boolean;

    // Mobile
    mobileBreakpoint?: number; // défaut 768
}

// ---------------------------------------------------------------------------
// Multi-select dropdown (interne)
// ---------------------------------------------------------------------------
const MultiSelectDropdown: React.FC<{
    filter: FilterConfig;
    selectedValues: string[];
    onChange: (values: string[]) => void;
}> = ({ filter, selectedValues, onChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (!containerRef.current?.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const toggleValue = (val: string) => {
        if (selectedValues.includes(val)) {
            onChange(selectedValues.filter(v => v !== val));
        } else {
            onChange([...selectedValues, val]);
        }
    };

    const selectedLabels = filter.options
        .filter(o => selectedValues.includes(o.value))
        .map(o => o.label);

    const displayText = selectedLabels.length === 0
        ? (filter.placeholder || filter.label)
        : selectedLabels.length <= 2
            ? selectedLabels.join(', ')
            : `${selectedLabels.length} sélectionnés`;

    const isPlaceholder = selectedLabels.length === 0;

    return (
        <div ref={containerRef} className="relative">
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full flex items-center justify-between px-3 py-2 bg-slate-50 border rounded-lg text-sm transition
                    ${isOpen ? 'border-[#2A9D8F] ring-1 ring-[#2A9D8F]' : 'border-slate-200 hover:border-slate-300'}`}
            >
                <span className={`truncate ${isPlaceholder ? 'text-slate-400' : 'text-slate-700'}`}>
                    {displayText}
                </span>
                <ChevronDown className={`w-4 h-4 text-slate-400 ml-2 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute z-[100] left-0 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
                    {filter.options.map(opt => {
                        const checked = selectedValues.includes(opt.value);
                        return (
                            <button
                                key={opt.value}
                                type="button"
                                onClick={() => toggleValue(opt.value)}
                                className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors
                                    ${checked ? 'bg-blue-50 text-[#2A9D8F]' : 'text-slate-700 hover:bg-slate-50'}`}
                            >
                                <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition
                                    ${checked ? 'bg-[#2A9D8F] border-[#2A9D8F]' : 'border-slate-300'}`}>
                                    {checked && <Check className="w-3 h-3 text-white" />}
                                </div>
                                <span>{opt.label}</span>
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

// ---------------------------------------------------------------------------
// Composant principal
// ---------------------------------------------------------------------------
const ListingFilterBar: React.FC<ListingFilterBarProps> = ({
    searchValue,
    onSearchChange,
    searchPlaceholder = 'Rechercher...',
    sortOptions,
    sortValue,
    onSortChange,
    sortDirection,
    onSortDirectionToggle,
    filters,
    filterValues,
    onFilterChange,
    filteredCount,
    totalCount,
    entityLabel = 'élément(s)',
    onReset,
    hasActiveFilters,
    mobileBreakpoint = 768,
}) => {
    const [isMobile, setIsMobile] = useState(window.innerWidth < mobileBreakpoint);
    const [showMobilePanel, setShowMobilePanel] = useState(false);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < mobileBreakpoint);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [mobileBreakpoint]);

    // Compter les filtres actifs (hors recherche)
    const activeFilterCount = useMemo(() => {
        let count = 0;
        for (const f of filters) {
            const val = filterValues[f.key];
            if (Array.isArray(val)) {
                if (val.length > 0) count++;
            } else if (val && val !== 'all' && val !== '') {
                count++;
            }
        }
        return count;
    }, [filters, filterValues]);

    // Construire les chips de filtres actifs
    const activeChips = useMemo(() => {
        const chips: Array<{ key: string; label: string; onRemove: () => void }> = [];
        for (const f of filters) {
            const val = filterValues[f.key];
            if (Array.isArray(val)) {
                for (const v of val) {
                    const opt = f.options.find(o => o.value === v);
                    if (opt) {
                        chips.push({
                            key: `${f.key}:${v}`,
                            label: `${f.label}: ${opt.label}`,
                            onRemove: () => onFilterChange(f.key, val.filter(x => x !== v)),
                        });
                    }
                }
            } else if (val && val !== 'all' && val !== '') {
                const opt = f.options.find(o => o.value === val);
                if (opt) {
                    chips.push({
                        key: f.key,
                        label: `${f.label}: ${opt.label}`,
                        onRemove: () => onFilterChange(f.key, f.multiple ? [] : 'all'),
                    });
                }
            }
        }
        return chips;
    }, [filters, filterValues, onFilterChange]);

    // -----------------------------------------------------------------------
    // Rendu des filtres (desktop ou mobile)
    // -----------------------------------------------------------------------
    const renderFilterFields = () => (
        <>
            {filters.map(f => {
                const val = filterValues[f.key];
                if (f.multiple) {
                    return (
                        <div key={f.key}>
                            <label className="block text-[11px] uppercase font-bold text-slate-400 mb-1">{f.label}</label>
                            <MultiSelectDropdown
                                filter={f}
                                selectedValues={Array.isArray(val) ? val : []}
                                onChange={(values) => onFilterChange(f.key, values)}
                            />
                        </div>
                    );
                }
                return (
                    <div key={f.key}>
                        <label className="block text-[11px] uppercase font-bold text-slate-400 mb-1">{f.label}</label>
                        <select
                            value={typeof val === 'string' ? val : 'all'}
                            onChange={(e) => onFilterChange(f.key, e.target.value)}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2A9D8F] focus:border-transparent"
                        >
                            <option value="all">{f.placeholder || `Tous — ${f.label}`}</option>
                            {f.options.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                        </select>
                    </div>
                );
            })}
        </>
    );

    // -----------------------------------------------------------------------
    // Vue mobile : panneau collapsible
    // -----------------------------------------------------------------------
    if (isMobile) {
        return (
            <div className="space-y-3">
                {/* Ligne principale : recherche + bouton filtres */}
                <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            value={searchValue}
                            onChange={(e) => onSearchChange(e.target.value)}
                            placeholder={searchPlaceholder}
                            className="w-full pl-10 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2A9D8F] focus:border-transparent"
                        />
                        {searchValue && (
                            <button
                                onClick={() => onSearchChange('')}
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-200 rounded"
                            >
                                <X className="w-3 h-3 text-slate-400" />
                            </button>
                        )}
                    </div>
                    <button
                        onClick={() => setShowMobilePanel(!showMobilePanel)}
                        className="relative flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 transition"
                    >
                        <SlidersHorizontal className="w-4 h-4" />
                        Filtres
                        {activeFilterCount > 0 && (
                            <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-[#F4A261] text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                                {activeFilterCount}
                            </span>
                        )}
                    </button>
                </div>

                {/* Panneau filtres mobile */}
                {showMobilePanel && (
                    <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
                        {/* Tri */}
                        <div className="flex items-center gap-2">
                            <div className="flex-1">
                                <label className="block text-[11px] uppercase font-bold text-slate-400 mb-1">Trier par</label>
                                <select
                                    value={sortValue}
                                    onChange={(e) => onSortChange(e.target.value)}
                                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2A9D8F]"
                                >
                                    {sortOptions.map(opt => (
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    ))}
                                </select>
                            </div>
                            <button
                                type="button"
                                onClick={onSortDirectionToggle}
                                className="mt-5 p-2 bg-slate-100 rounded-lg hover:bg-slate-200 transition"
                                title={sortDirection === 'asc' ? 'Croissant' : 'Décroissant'}
                            >
                                {sortDirection === 'desc' ? <ArrowDown className="w-4 h-4 text-slate-600" /> : <ArrowUp className="w-4 h-4 text-slate-600" />}
                            </button>
                        </div>

                        {/* Filtres dynamiques */}
                        <div className="grid grid-cols-1 gap-3">
                            {renderFilterFields()}
                        </div>

                        {/* Reset */}
                        {hasActiveFilters && (
                            <button
                                onClick={onReset}
                                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition text-sm font-medium"
                            >
                                <RotateCcw className="w-4 h-4" />
                                Réinitialiser les filtres
                            </button>
                        )}
                    </div>
                )}

                {/* Chips de filtres actifs */}
                {activeChips.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                        {activeChips.map(chip => (
                            <span key={chip.key} className="inline-flex items-center gap-1 px-2 py-1 bg-[#2A9D8F]/10 text-[#2A9D8F] rounded-full text-xs font-medium">
                                {chip.label}
                                <button onClick={chip.onRemove} className="hover:bg-[#2A9D8F]/20 rounded-full p-0.5">
                                    <X className="w-3 h-3" />
                                </button>
                            </span>
                        ))}
                    </div>
                )}

                {/* Compteur */}
                <div className="text-xs text-slate-500">
                    {filteredCount} sur {totalCount} {entityLabel}
                </div>
            </div>
        );
    }

    // -----------------------------------------------------------------------
    // Vue desktop
    // -----------------------------------------------------------------------
    return (
        <div className="space-y-3">
            <div className="bg-white rounded-xl border border-slate-200 p-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                    {/* Recherche */}
                    <div>
                        <label className="block text-[11px] uppercase font-bold text-slate-400 mb-1">Recherche</label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                value={searchValue}
                                onChange={(e) => onSearchChange(e.target.value)}
                                placeholder={searchPlaceholder}
                                className="w-full pl-10 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2A9D8F] focus:border-transparent"
                            />
                            {searchValue && (
                                <button
                                    onClick={() => onSearchChange('')}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-200 rounded"
                                >
                                    <X className="w-3 h-3 text-slate-400" />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Tri */}
                    <div>
                        <label className="block text-[11px] uppercase font-bold text-slate-400 mb-1">Trier par</label>
                        <div className="flex gap-1">
                            <select
                                value={sortValue}
                                onChange={(e) => onSortChange(e.target.value)}
                                className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2A9D8F] focus:border-transparent"
                            >
                                {sortOptions.map(opt => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                            </select>
                            <button
                                type="button"
                                onClick={onSortDirectionToggle}
                                className="px-2 py-2 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition"
                                title={sortDirection === 'asc' ? 'Ordre croissant' : 'Ordre décroissant'}
                            >
                                {sortDirection === 'desc'
                                    ? <ArrowDown className="w-4 h-4 text-slate-600" />
                                    : <ArrowUp className="w-4 h-4 text-slate-600" />
                                }
                            </button>
                        </div>
                    </div>

                    {/* Filtres dynamiques */}
                    {renderFilterFields()}

                    {/* Reset */}
                    {hasActiveFilters && (
                        <div className="flex items-end">
                            <button
                                onClick={onReset}
                                className="w-full px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition text-sm font-medium flex items-center justify-center gap-2"
                            >
                                <RotateCcw className="w-4 h-4" />
                                Réinitialiser
                            </button>
                        </div>
                    )}
                </div>

                {/* Chips + compteur */}
                <div className="mt-3 flex items-center justify-between flex-wrap gap-2">
                    {/* Chips de filtres actifs */}
                    <div className="flex flex-wrap gap-1.5">
                        {activeChips.map(chip => (
                            <span key={chip.key} className="inline-flex items-center gap-1 px-2 py-1 bg-[#2A9D8F]/10 text-[#2A9D8F] rounded-full text-xs font-medium">
                                {chip.label}
                                <button onClick={chip.onRemove} className="hover:bg-[#2A9D8F]/20 rounded-full p-0.5">
                                    <X className="w-3 h-3" />
                                </button>
                            </span>
                        ))}
                    </div>

                    {/* Compteur */}
                    <div className="text-xs text-slate-500">
                        {filteredCount} sur {totalCount} {entityLabel}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ListingFilterBar;
