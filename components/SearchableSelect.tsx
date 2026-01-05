import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Search, ChevronDown, X } from 'lucide-react';

interface Option {
    value: string;
    label: string;
    disabled?: boolean;
}

interface SearchableSelectProps {
    options: Option[];
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    label?: string;
    className?: string;
    disabled?: boolean;
    isClearable?: boolean;
    triggerClassName?: string;
    dropdownClassName?: string;
    usePortal?: boolean;
}

const SearchableSelect: React.FC<SearchableSelectProps> = ({
    options,
    value,
    onChange,
    placeholder = 'Sélectionner...',
    label,
    className = '',
    disabled = false,
    isClearable = true,
    triggerClassName = '',
    dropdownClassName = '',
    usePortal = false
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [highlightedIndex, setHighlightedIndex] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLDivElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const [portalStyle, setPortalStyle] = useState<React.CSSProperties>({});

    // Filter options based on search query
    const filteredOptions = options.filter(option =>
        option.label.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Get selected option label
    const selectedOption = options.find(opt => opt.value === value);
    const selectedLabel = selectedOption ? selectedOption.label : '';

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node;
            const inContainer = containerRef.current?.contains(target);
            const inDropdown = dropdownRef.current?.contains(target);
            if (!inContainer && !inDropdown) {
                setIsOpen(false);
                setSearchQuery('');
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (!isOpen || !usePortal) return;

        const updatePosition = () => {
            const rect = triggerRef.current?.getBoundingClientRect();
            if (!rect) return;
            const gap = 4;
            const viewportHeight = window.innerHeight;
            const viewportPadding = 8;
            const availableBelow = viewportHeight - rect.bottom - viewportPadding;
            const availableAbove = rect.top - viewportPadding;
            const openUp = availableBelow < 200 && availableAbove > availableBelow;
            const available = openUp ? availableAbove : availableBelow;
            const maxHeight = Math.max(160, Math.min(360, available - gap));
            setPortalStyle({
                position: 'fixed',
                top: openUp ? undefined : rect.bottom + gap,
                bottom: openUp ? viewportHeight - rect.top + gap : undefined,
                left: rect.left,
                width: rect.width,
                zIndex: 9999,
                maxHeight
            });
        };

        updatePosition();
        window.addEventListener('resize', updatePosition);
        window.addEventListener('scroll', updatePosition, true);
        return () => {
            window.removeEventListener('resize', updatePosition);
            window.removeEventListener('scroll', updatePosition, true);
        };
    }, [isOpen, usePortal]);

    // Reset highlighted index when filtered options change
    useEffect(() => {
        setHighlightedIndex(0);
    }, [searchQuery]);

    // Focus input when dropdown opens
    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isOpen]);

    const handleToggle = () => {
        if (!disabled) {
            setIsOpen(!isOpen);
            if (!isOpen) {
                setSearchQuery('');
            }
        }
    };

    const handleSelect = (optionValue: string) => {
        onChange(optionValue);
        setIsOpen(false);
        setSearchQuery('');
    };

    const handleClear = (e: React.MouseEvent) => {
        e.stopPropagation();
        onChange('');
        setSearchQuery('');
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (!isOpen) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setIsOpen(true);
            }
            return;
        }

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setHighlightedIndex(prev =>
                    prev < filteredOptions.length - 1 ? prev + 1 : prev
                );
                break;
            case 'ArrowUp':
                e.preventDefault();
                setHighlightedIndex(prev => prev > 0 ? prev - 1 : 0);
                break;
            case 'Enter':
                e.preventDefault();
                if (filteredOptions[highlightedIndex] && !filteredOptions[highlightedIndex].disabled) {
                    handleSelect(filteredOptions[highlightedIndex].value);
                }
                break;
            case 'Escape':
                e.preventDefault();
                setIsOpen(false);
                setSearchQuery('');
                break;
        }
    };

    return (
        <div ref={containerRef} className={`relative ${className}`}>
            {label && (
                <label className="block text-sm font-bold text-slate-700 mb-1">
                    {label}
                </label>
            )}

            <div
                ref={triggerRef}
                className={`relative w-full bg-slate-50 border rounded-lg cursor-pointer transition-all ${disabled
                    ? 'bg-slate-100 cursor-not-allowed opacity-60'
                    : isOpen
                        ? 'border-brand-blue ring-1 ring-brand-blue'
                        : 'border-slate-200 hover:border-slate-300'
                    } ${triggerClassName}`}
                onClick={handleToggle}
            >
                <div className="flex items-center p-2 pr-8">
                    {isOpen ? (
                        <input
                            ref={inputRef}
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Rechercher..."
                            className="flex-1 bg-transparent outline-none text-sm"
                            onClick={(e) => e.stopPropagation()}
                        />
                    ) : (
                        <span className={`flex-1 text-sm ${value ? 'text-slate-900' : 'text-slate-400'}`}>
                            {selectedLabel || placeholder}
                        </span>
                    )}
                </div>

                <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                    {isOpen ? (
                        <Search className="w-4 h-4 text-slate-400" />
                    ) : value && isClearable ? (
                        <button
                            onClick={handleClear}
                            className="pointer-events-auto p-1 hover:bg-slate-200 rounded transition"
                            title="Effacer"
                        >
                            <X className="w-3 h-3 text-slate-500" />
                        </button>
                    ) : (
                        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                    )}
                </div>
            </div>

            {isOpen && (() => {
                const dropdown = (
                    <div
                        ref={dropdownRef}
                        style={usePortal ? portalStyle : undefined}
                        className={`${usePortal ? '' : 'absolute'} z-50 w-full ${usePortal ? '' : 'mt-1'} bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto overscroll-contain touch-pan-y ${dropdownClassName}`}
                    >
                        {filteredOptions.length === 0 ? (
                            <div className="p-3 text-sm text-slate-400 text-center">
                                Aucun résultat trouvé
                            </div>
                        ) : (
                            filteredOptions.map((option, index) => (
                                <div
                                    key={option.value}
                                    className={`px-3 py-2 text-sm transition-colors ${option.disabled
                                        ? 'text-slate-400 cursor-not-allowed bg-slate-50'
                                        : index === highlightedIndex
                                            ? 'bg-blue-50 text-brand-blue cursor-pointer'
                                            : option.value === value
                                                ? 'bg-slate-50 text-slate-900 font-medium cursor-pointer'
                                                : 'text-slate-700 hover:bg-slate-50 cursor-pointer'
                                        }`}
                                    onClick={() => !option.disabled && handleSelect(option.value)}
                                    onMouseEnter={() => !option.disabled && setHighlightedIndex(index)}
                                >
                                    {option.label}
                                </div>
                            ))
                        )}
                    </div>
                );

                return usePortal ? createPortal(dropdown, document.body) : dropdown;
            })()}
        </div>
    );
};

export default SearchableSelect;
