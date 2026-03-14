import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useData } from '../context/DataContext';
import {
  Search,
  X,
  Users,
  FileText,
  Briefcase,
  Package,
  Megaphone,
  Clock,
  Calendar,
  Mail,
  Edit3,
  Trash2,
  UserPlus,
  Send,
  CheckCircle,
  AlertCircle,
  ChevronRight,
  Command,
  Sparkles,
  MapPin,
  Eye
} from 'lucide-react';
import dayjs from 'dayjs';

// Global event bus for search actions
export const SearchEvents = {
  emitters: new Map<string, Set<Function>>(),
  
  on(event: string, callback: Function) {
    if (!this.emitters.has(event)) {
      this.emitters.set(event, new Set());
    }
    this.emitters.get(event)!.add(callback);
  },
  
  off(event: string, callback: Function) {
    this.emitters.get(event)?.delete(callback);
  },
  
  emit(event: string, data?: any) {
    this.emitters.get(event)?.forEach(callback => callback(data));
  }
};

interface SearchResult {
  id: string;
  type: 'client' | 'provider' | 'document' | 'mission' | 'pack' | 'campaign' | 'feature';
  title: string;
  subtitle: string;
  icon: React.ElementType;
  color: string;
  data?: any;
  action: () => void;
  actions: {
    label: string;
    icon: React.ElementType;
    action: () => void;
    danger?: boolean;
  }[];
}

export const GlobalSearchBar: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { clients, providers, documents, missions, packs, currentUser } = useData();

  // Keyboard shortcut to open search (Cmd+K or Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(true);
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const [isFocused, setIsFocused] = useState(false);

  // Helper to navigate with item selection - navigates to detail pages
  const navigateToItem = (path: string, itemId: string, itemType: string, itemData?: any) => {
    // Navigate directly to the detail page with correct routes
    if (itemType === 'mission') {
      navigate(`/planning/missions/${itemId}`);
    } else if (itemType === 'client') {
      navigate(`/clients/${itemId}`);
    } else if (itemType === 'provider') {
      navigate(`/providers/${itemId}`);
    } else {
      navigate(`${path}/${itemId}`);
    }
  };

  const searchResults = useMemo<SearchResult[]>(() => {
    if (!query.trim()) return [];
    
    const q = query.toLowerCase().trim();
    const results: SearchResult[] = [];

    // Search clients - now opens client details directly with full info
    clients.forEach(client => {
      if (client.name?.toLowerCase().includes(q) || client.email?.toLowerCase().includes(q) || client.phone?.toLowerCase().includes(q)) {
        results.push({
          id: `client-${client.id}`,
          type: 'client',
          title: client.name || 'Client sans nom',
          subtitle: `${client.email || ''} ${client.phone ? `• ${client.phone}` : ''} ${client.city ? `• ${client.city}` : ''}`,
          icon: Users,
          color: 'bg-blue-500',
          data: client,
          action: () => {
            navigateToItem('/clients', client.id, 'client', client);
            setIsOpen(false);
            setQuery('');
          },
          actions: [
            { label: 'Voir détails', icon: Eye, action: () => {
              navigateToItem('/clients', client.id, 'client', client);
              setIsOpen(false);
              setQuery('');
            }},
            { label: 'Modifier', icon: Edit3, action: () => {
              navigateToItem('/clients', client.id, 'client-edit', client);
              setIsOpen(false);
              setQuery('');
            }}
          ]
        });
      }
    });

    // Search providers - now opens provider details directly with full info
    providers.forEach(provider => {
      const fullName = `${provider.firstName} ${provider.lastName}`.toLowerCase();
      if (fullName.includes(q) || provider.email?.toLowerCase().includes(q) || provider.phone?.toLowerCase().includes(q)) {
        results.push({
          id: `provider-${provider.id}`,
          type: 'provider',
          title: `${provider.firstName} ${provider.lastName}`,
          subtitle: `${provider.email || ''} ${provider.phone ? `• ${provider.phone}` : ''} ${provider.specialty ? `• ${provider.specialty}` : ''}`,
          icon: Briefcase,
          color: 'bg-purple-500',
          data: provider,
          action: () => {
            navigateToItem('/providers', provider.id, 'provider', provider);
            setIsOpen(false);
            setQuery('');
          },
          actions: [
            { label: 'Voir détails', icon: Eye, action: () => {
              navigateToItem('/providers', provider.id, 'provider', provider);
              setIsOpen(false);
              setQuery('');
            }},
            { label: 'Assigner mission', icon: Send, action: () => {
              navigate('/planning', { state: { selectedProviderId: provider.id } });
              setIsOpen(false);
              setQuery('');
            }}
          ]
        });
      }
    });

    // Search documents (quotes/invoices) - opens document details with full info
    documents.forEach(doc => {
      const docRef = (doc as any).reference || (doc as any).ref || '';
      if (docRef.toLowerCase().includes(q) || doc.clientName?.toLowerCase().includes(q)) {
        results.push({
          id: `doc-${doc.id}`,
          type: 'document',
          title: `${doc.type} ${docRef}`,
          subtitle: `${doc.clientName || ''} • ${doc.totalTTC?.toFixed(2) || '0.00'} € • ${doc.status || 'N/A'}`,
          icon: FileText,
          color: doc.type === 'Devis' ? 'bg-orange-500' : 'bg-green-500',
          data: doc,
          action: () => {
            navigateToItem('/invoices', doc.id, 'document', doc);
            setIsOpen(false);
            setQuery('');
          },
          actions: [
            { label: 'Voir détails', icon: Eye, action: () => {
              navigateToItem('/invoices', doc.id, 'document', doc);
              setIsOpen(false);
              setQuery('');
            }},
            { label: 'Télécharger', icon: CheckCircle, action: () => {
              navigateToItem('/invoices', doc.id, 'document-download', doc);
              setIsOpen(false);
              setQuery('');
            }}
          ]
        });
      }
    });

    // Search missions - opens mission details with full info including location
    missions.forEach(mission => {
      const missionLocation = (mission as any).location || (mission as any).address || '';
      if (mission.clientName?.toLowerCase().includes(q) || mission.service?.toLowerCase().includes(q) || missionLocation.toLowerCase().includes(q)) {
        const provider = providers.find(p => p.id === mission.providerId);
        results.push({
          id: `mission-${mission.id}`,
          type: 'mission',
          title: `${mission.service}`,
          subtitle: `${mission.clientName} • ${mission.date} ${mission.startTime}-${mission.endTime}${provider ? ` • ${provider.firstName} ${provider.lastName}` : ''}`,
          icon: Clock,
          color: mission.status === 'in_progress' ? 'bg-red-500' : mission.status === 'completed' ? 'bg-green-500' : 'bg-yellow-500',
          data: mission,
          action: () => {
            navigateToItem('/planning', mission.id, 'mission', mission);
            setIsOpen(false);
            setQuery('');
          },
          actions: [
            { label: 'Voir détails', icon: Eye, action: () => {
              navigateToItem('/planning', mission.id, 'mission', mission);
              setIsOpen(false);
              setQuery('');
            }},
            { label: 'Voir sur planning', icon: Calendar, action: () => {
              navigate('/planning', { state: { selectedMissionId: mission.id, selectedDate: mission.date } });
              setIsOpen(false);
              setQuery('');
            }}
          ]
        });
      }
    });

    // Search packs - now opens pack details directly with full info
    packs.forEach(pack => {
      if (pack.name?.toLowerCase().includes(q) || pack.mainService?.toLowerCase().includes(q)) {
        results.push({
          id: `pack-${pack.id}`,
          type: 'pack',
          title: pack.name || 'Pack sans nom',
          subtitle: `${pack.mainService || ''} • ${(pack as any).priceHT ? `${(pack as any).priceHT} €` : ''} ${(pack as any).duration ? `• ${(pack as any).duration}` : ''}`,
          icon: Package,
          color: 'bg-teal-500',
          data: pack,
          action: () => {
            navigateToItem('/secretariat', pack.id, 'pack', pack);
            setIsOpen(false);
            setQuery('');
          },
          actions: [
            { label: 'Voir détails', icon: Eye, action: () => {
              navigateToItem('/secretariat', pack.id, 'pack', pack);
              setIsOpen(false);
              setQuery('');
            }},
            { label: 'Modifier', icon: Edit3, action: () => {
              navigateToItem('/secretariat', pack.id, 'pack-edit', pack);
              setIsOpen(false);
              setQuery('');
            }}
          ]
        });
      }
    });

    // Feature shortcuts with Comptabilite added
    const features = [
      { name: 'Nouveau client', path: '/clients', icon: UserPlus, keyword: 'client nouveau ajouter creer' },
      { name: 'Nouveau devis', path: '/invoices', icon: FileText, keyword: 'devis nouveau creer facture' },
      { name: 'Email Marketing', path: '/admin/email-marketing', icon: Megaphone, keyword: 'marketing email campagne envoyer' },
      { name: 'Planning', path: '/planning', icon: Calendar, keyword: 'planning agenda calendrier mission' },
      { name: 'Prestataires', path: '/providers', icon: Briefcase, keyword: 'prestataire intervenant' },
      { name: 'Comptabilite', path: '/accounting', icon: CheckCircle, keyword: 'comptabilite stats chiffre affaire finances' },
      { name: 'Secretariat', path: '/secretariat', icon: Mail, keyword: 'secretariat packs contrats' },
      { name: 'Rapports', path: '/reports', icon: Clock, keyword: 'rapports missions compte rendu' }
    ];

    features.forEach(feature => {
      if (feature.keyword.includes(q) || feature.name.toLowerCase().includes(q)) {
        results.push({
          id: `feature-${feature.path}`,
          type: 'feature',
          title: feature.name,
          subtitle: 'Accès rapide',
          icon: feature.icon,
          color: 'bg-emerald-500',
          action: () => navigate(feature.path),
          actions: [{ label: 'Ouvrir', icon: ChevronRight, action: () => navigate(feature.path) }]
        });
      }
    });

    return results.slice(0, 15); // Limit results
  }, [query, clients, providers, documents, missions, packs, navigate]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % searchResults.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + searchResults.length) % searchResults.length);
    } else if (e.key === 'Enter' && searchResults[selectedIndex]) {
      searchResults[selectedIndex].action();
      setIsOpen(false);
      setQuery('');
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-slate-500 hover:border-slate-300 hover:text-slate-700 transition-all shadow-sm hover:shadow-md hover:scale-105 active:scale-95 transform duration-200 w-full"
      >
        <Search className="w-4 h-4" />
        <span className="text-sm">Rechercher...</span>
        <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 border border-slate-200 rounded text-xs text-slate-500 ml-auto">
          <Command className="w-3 h-3" />K
        </kbd>
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={() => setIsOpen(false)}
      />
      
      {/* Search Modal */}
      <div className="relative w-full max-w-2xl mx-4 bg-white rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-4">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-4 border-b border-slate-100">
          <Search className="w-5 h-5 text-slate-400" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelectedIndex(0); }}
            onKeyDown={handleKeyDown}
            placeholder="Rechercher clients, devis, missions, fonctionnalités..."
            className="flex-1 text-lg outline-none text-slate-700 placeholder:text-slate-400"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="p-1 hover:bg-slate-100 rounded-full"
            >
              <X className="w-4 h-4 text-slate-400" />
            </button>
          )}
          <kbd className="hidden sm:inline-flex items-center px-2 py-1 bg-slate-100 border border-slate-200 rounded text-xs text-slate-500">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-96 overflow-y-auto">
          {searchResults.length === 0 ? (
            <div className="p-8 text-center">
              {query ? (
                <>
                  <Search className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                  <p className="text-slate-500">Aucun résultat pour "{query}"</p>
                </>
              ) : (
                <>
                  <Sparkles className="w-12 h-12 text-emerald-200 mx-auto mb-3" />
                  <p className="text-slate-500">Commencez à taper pour rechercher...</p>
                  <div className="flex flex-wrap justify-center gap-2 mt-4">
                    <span className="px-3 py-1 bg-slate-100 rounded-full text-xs text-slate-600">Clients</span>
                    <span className="px-3 py-1 bg-slate-100 rounded-full text-xs text-slate-600">Devis</span>
                    <span className="px-3 py-1 bg-slate-100 rounded-full text-xs text-slate-600">Missions</span>
                    <span className="px-3 py-1 bg-slate-100 rounded-full text-xs text-slate-600">Fonctionnalités</span>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="py-2">
              {searchResults.map((result, index) => (
                <div
                  key={result.id}
                  className={`px-4 py-3 cursor-pointer transition-colors ${
                    index === selectedIndex ? 'bg-emerald-50' : 'hover:bg-slate-50'
                  }`}
                  onClick={() => {
                    result.action();
                    setIsOpen(false);
                    setQuery('');
                  }}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-lg ${result.color} flex items-center justify-center text-white shrink-0`}>
                      <result.icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-800 truncate">{result.title}</p>
                      <p className="text-sm text-slate-500 truncate">{result.subtitle}</p>
                    </div>
                    
                    {/* Quick Actions */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 sm:opacity-100">
                      {result.actions.slice(0, 2).map((action, idx) => (
                        <button
                          key={idx}
                          onClick={(e) => {
                            e.stopPropagation();
                            action.action();
                            setIsOpen(false);
                          }}
                          className={`p-1.5 rounded-md text-xs font-medium transition-colors ${
                            action.danger 
                              ? 'text-red-600 hover:bg-red-50' 
                              : 'text-slate-600 hover:bg-slate-100'
                          }`}
                          title={action.label}
                        >
                          <action.icon className="w-4 h-4" />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 bg-white border rounded">↑↓</kbd> Navigation</span>
            <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 bg-white border rounded">↵</kbd> Ouvrir</span>
          </div>
          <span>{searchResults.length} résultat(s)</span>
        </div>
      </div>
    </div>
  );
};

export default GlobalSearchBar;
