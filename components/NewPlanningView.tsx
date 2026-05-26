import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Calendar, ArrowLeft, Sun, Sunset, Clock, Plus, X, AlertCircle, CheckCircle, Send, Settings, Search, Grid3X3, FileText, Download, Printer, Link, History, Users } from 'lucide-react';
import dayjs from 'dayjs';
import { getMartiniqueNow as getMartiniqueNowDayjs, MARTINIQUE_TIMEZONE } from '../src/utils/dayjsMartinique';
import { Provider, Mission } from '../types';
import { sendEmailViaEmailJS } from '../utils/emailService';
import { getApiConfig, setApiConfig, MESSAGE_PROVIDERS } from '../src/config/apiConfig';
import type { MessageProvider } from '../src/config/apiConfig';
import { 
  getAuditLogForDate, 
  logMissionAdded, 
  logDayClosed, 
  logDayReopened, 
  logWhatsAppSent,
  logExceptionForced,
  formatAuditEntry,
  getActionTypeLabel,
  getActionTypeColor,
  AuditLogEntry
} from '../src/utils/planningAuditLog';

const printStyles = `
  @media print {
    .no-print { display: none !important; }
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .print-break { page-break-inside: avoid; }
  }
`;

interface TimeSlot {
  id: string;
  label: string;
  start: string;
  end: string;
  duration: number;
}

const TIME_SLOTS: TimeSlot[] = [
  { id: '8-11', label: '8h - 11h (3h)', start: '08:00', end: '11:00', duration: 3 },
  { id: '9-12', label: '9h - 12h (3h)', start: '09:00', end: '12:00', duration: 3 },
  { id: '9-15', label: '9h - 15h (6h)', start: '09:00', end: '15:00', duration: 6 },
  { id: '8-14', label: '8h - 14h (6h)', start: '08:00', end: '14:00', duration: 6 },
  { id: '13-16', label: '13h - 16h (3h)', start: '13:00', end: '16:00', duration: 3 },
  { id: '14-17', label: '14h - 17h (3h)', start: '14:00', end: '17:00', duration: 3 },
  { id: '8-15', label: '8h - 15h (7h)', start: '08:00', end: '15:00', duration: 7 },
  { id: '10-17', label: '10h - 17h (7h)', start: '10:00', end: '17:00', duration: 7 },
  { id: '8-12', label: '8h - 12h (4h)', start: '08:00', end: '12:00', duration: 4 },
  { id: '9-13', label: '9h - 13h (4h)', start: '09:00', end: '13:00', duration: 4 },
  { id: '13-17', label: '13h - 17h (4h)', start: '13:00', end: '17:00', duration: 4 },
  { id: '8-16', label: '8h - 16h (8h)', start: '08:00', end: '16:00', duration: 8 },
  { id: '9-16', label: '9h - 16h (7h)', start: '09:00', end: '16:00', duration: 7 },
  { id: '10-16', label: '10h - 16h (6h)', start: '10:00', end: '16:00', duration: 6 },
];

interface NewPlanningViewProps {
  onSwitchToOldVersion: () => void;
  providers: Provider[];
  missions: Mission[];
  documents?: any[];
  addMission?: (mission: Mission) => Promise<void>;
  assignProvider?: (missionId: string, providerId: string, providerName: string) => Promise<void>;
  updateMission?: (id: string, data: Partial<Mission>) => Promise<void>;
  convertQuoteToInvoice?: (quoteId: string) => Promise<void>;
  markInvoicePaid?: (id: string) => Promise<void>;
  updateDocumentStatus?: (id: string, status: string) => Promise<{ success: boolean; status: string }>;
  updateMessageConfig?: (config: { messageProvider?: 'smsmode' | 'wa_me' | 'custom'; messageApiKey?: string; messageBaseUrl?: string }) => Promise<void>;
  loadMissionsForRange?: (start: string, end: string, onProgress?: (p: number) => void) => Promise<boolean>;
}

const NewPlanningView: React.FC<NewPlanningViewProps> = ({ 
  onSwitchToOldVersion, 
  providers, 
  missions,
  documents = [],
  addMission,
  assignProvider,
  updateMission,
  convertQuoteToInvoice,
  markInvoicePaid,
  updateDocumentStatus,
  loadMissionsForRange,
  updateMessageConfig
}) => {
  const [currentDate, setCurrentDate] = useState(getMartiniqueNowDayjs());
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<TimeSlot | null>(null);
  const [selectedMission, setSelectedMission] = useState<Mission | null>(null);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [assignSuccess, setAssignSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [closedDays, setClosedDays] = useState<Set<string>>(new Set());
  const [showBillingPanel, setShowBillingPanel] = useState(false);
  const [showApiSettings, setShowApiSettings] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<MessageProvider>(getApiConfig().provider);
  const [apiKey, setApiKey] = useState(getApiConfig().apiKey || '');
  const [customBaseUrl, setCustomBaseUrl] = useState(getApiConfig().baseUrl || '');
  const [statusFilter, setStatusFilter] = useState<'all' | 'unplanned' | 'planned' | 'available'>('all');
  const [timeSlotFilter, setTimeSlotFilter] = useState<'all' | 'morning' | 'afternoon' | 'full'>('all');
  const [sortOrder, setSortOrder] = useState<'name' | 'load_asc' | 'load_desc'>('name');
  const [searchQuery, setSearchQuery] = useState('');
  const [showWeeklyView, setShowWeeklyView] = useState(true);
  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'info'; message: string; undoAction?: () => void } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ missionId: string; providerName: string; timeSlot: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [smsSending, setSmsSending] = useState<{ current: number; total: number } | null>(null);
  const [sentMessages, setSentMessages] = useState<Set<string>>(new Set());
  const [specialtyFilter, setSpecialtyFilter] = useState<'all' | 'menage' | 'jardinage' | 'bricolage'>('all');
  const [providerNotes, setProviderNotes] = useState<Record<string, string>>({});
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [missionDateFilter, setMissionDateFilter] = useState<'day' | 'future' | 'all'>('day');
  const [customStartTime, setCustomStartTime] = useState('');
  const [customEndTime, setCustomEndTime] = useState('');
  const [showUnassignedPanel, setShowUnassignedPanel] = useState(false);
  const [panelSearch, setPanelSearch] = useState('');
  const [billingSearch, setBillingSearch] = useState('');
  const [quickAssignMission, setQuickAssignMission] = useState<Mission | null>(null);
  const [quickAssignProviderId, setQuickAssignProviderId] = useState('');
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const toggleCardExpand = (id: string) => setExpandedCards(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  const ShimmerLoader = ({ className }: { className?: string }) => (
    <div className={`animate-pulse bg-slate-200 rounded ${className}`} />
  );

  const ShimmerCard = () => (
    <div className="bg-white rounded-lg border border-slate-200 p-4">
      <div className="flex items-center gap-3 mb-3">
        <ShimmerLoader className="w-10 h-10 rounded-full" />
        <div className="flex-1">
          <ShimmerLoader className="h-4 w-24 mb-2" />
          <ShimmerLoader className="h-3 w-16" />
        </div>
      </div>
      <ShimmerLoader className="h-3 w-full mb-2" />
      <ShimmerLoader className="h-3 w-2/3" />
    </div>
  );

  const exportToPDF = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    
    const dayMissions = missions.filter(m => m.date === currentDateStr && m.status !== 'cancelled');
    const providersWithMissions = availableProviders.map(({ provider }) => {
      const pMissions = dayMissions.filter(m => m.providerId === provider.id);
      const totalHours = pMissions.reduce((sum, m) => sum + (m.duration || 0), 0);
      return { provider, missions: pMissions, totalHours };
    }).filter(p => p.missions.length > 0);
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Planning du ${currentDate.format('D MMMM YYYY')}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          h1 { color: #1e293b; margin-bottom: 5px; }
          .date { color: #64748b; margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #e2e8f0; padding: 10px; text-align: left; }
          th { background: #f1f5f9; }
          .status-planned { background: #dcfce7; }
          .status-partial { background: #fef3c7; }
          .status-full { background: #fed7aa; }
          .status-dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 5px; }
          .footer { margin-top: 30px; font-size: 12px; color: #94a3b8; }
        </style>
      </head>
      <body>
        <h1>📅 Planning du ${currentDate.format('D MMMM YYYY')}</h1>
        <p class="date">Généré le ${new Date().toLocaleDateString('fr-FR')}</p>
        
        <table>
          <thead>
            <tr>
              <th>Prestataire</th>
              <th>Créneau</th>
              <th>Durée</th>
              <th>Client</th>
              <th>Service</th>
              <th>Statut</th>
            </tr>
          </thead>
          <tbody>
            ${providersWithMissions.map(p => p.missions.map(m => `
              <tr>
                <td>${(() => {
                  const pa = p.provider as any;
                  const first = (pa?.firstName || pa?.first_name || '').toString().trim();
                  const last = (pa?.lastName || pa?.last_name || '').toString().trim();
                  const n = [first, last].filter(s => s.length > 0).join(' ');
                  if (n) return n;
                  if (pa?.name && pa.name.toString().trim()) return pa.name.toString().trim();
                  return pa?.specialty || 'Prestataire';
                })()}</td>
                <td>${m.startTime} - ${m.endTime}</td>
                <td>${m.duration}h</td>
                <td>${m.clientName || '-'}</td>
                <td>${m.service}</td>
                <td>${m.status === 'completed' ? '✅ Effectuée' : m.status === 'in_progress' ? '🔄 En cours' : '📋 Planifiée'}</td>
              </tr>
            `).join('')).join('')}
          </tbody>
        </table>
        
        <div class="footer">
          <p>Total: ${providersWithMissions.reduce((sum, p) => sum + p.totalHours, 0)}h | ${providersWithMissions.length} prestataire(s)</p>
        </div>
      </body>
      </html>
    `;
    
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.print();
  };

  const exportToCSV = () => {
    const startOfWeek = currentDate.startOf('week');
    const weekMissions: { date: string; provider: string; start: string; end: string; duration: number; client: string; service: string; status: string; sourceDoc: string }[] = [];
    
    for (let i = 0; i < 7; i++) {
      const date = startOfWeek.add(i, 'day');
      const dateStr = date.format('YYYY-MM-DD');
      const dayMissions = missions.filter(m => m.date === dateStr && m.status !== 'cancelled');
      
      dayMissions.forEach(m => {
        const p = providers.find(pr => pr.id === m.providerId);
        weekMissions.push({
          date: dateStr,
          provider: p ? `${p.firstName} ${p.lastName}` : m.providerName || 'Inconnu',
          start: m.startTime,
          end: m.endTime,
          duration: m.duration || 0,
          client: m.clientName || '',
          service: m.service,
          status: m.status,
          sourceDoc: m.sourceDocumentId || ''
        });
      });
    }
    
    const headers = ['Date', 'Prestataire', 'Début', 'Fin', 'Durée (h)', 'Client', 'Service', 'Statut', 'Devis'];
    const rows = weekMissions.map(m => [m.date, m.provider, m.start, m.end, m.duration.toString(), m.client, m.service, m.status, m.sourceDoc]);
    const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(';')).join('\n');
    
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `planning_semaine_${currentDate.format('YYYY-MM-DD')}.csv`;
    link.click();
    
    setToast({ type: 'success', message: '✅ Export CSV téléchargé' });
  };

  const handlePrint = () => {
    window.print();
  };

  const generateShareLink = () => {
    const shareUrl = `${window.location.origin}/planning?date=${currentDateStr}`;
    navigator.clipboard.writeText(shareUrl);
    setToast({ type: 'success', message: '🔗 Lien copié dans le presse-papiers' });
  };
  
  const today = getMartiniqueNowDayjs().format('YYYY-MM-DD');
  const todayFormatted = getMartiniqueNowDayjs().format('dddd D MMMM YYYY');
  
  const handlePrevDay = () => {
    setCurrentDate(prev => showWeeklyView ? prev.subtract(7, 'day') : prev.subtract(1, 'day'));
    setSelectedProviderId(null);
    setShowAssignModal(false);
    setSentMessages(new Set());
  };
  
  const handleNextDay = () => {
    setCurrentDate(prev => showWeeklyView ? prev.add(7, 'day') : prev.add(1, 'day'));
    setSelectedProviderId(null);
    setShowAssignModal(false);
    setSentMessages(new Set());
  };
  
  const handleGoToToday = () => {
    setCurrentDate(getMartiniqueNowDayjs());
    setSentMessages(new Set());
  };

  const currentDateStr = currentDate.format('YYYY-MM-DD');
  const isToday = currentDateStr === today;
  const dayOfWeek = currentDate.day();

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 't' || e.key === 'T') { setCurrentDate(getMartiniqueNowDayjs()); setSentMessages(new Set()); }
      if (e.key === 'ArrowLeft') handlePrevDay();
      if (e.key === 'ArrowRight') handleNextDay();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  const isDataReady = providers.length > 0 || missions.length > 0;
  
  React.useEffect(() => {
    setIsLoading(true);
    const delay = isDataReady ? 600 : 4000;
    const timer = setTimeout(() => setIsLoading(false), delay);
    return () => clearTimeout(timer);
  }, [currentDateStr, isDataReady]);

  const todayAuditLog = useMemo(() => getAuditLogForDate(currentDateStr), [currentDateStr]);

  const getProviderAvailabilityForDay = (provider: Provider) => {
    const nonDays = provider.nonInterventionDays || [];
    if (nonDays.includes(dayOfWeek)) {
      return { available: false, reason: 'Jour de repos' };
    }
    
    if (provider.availabilityMode === 'available') {
      const availHours = provider.availabilityHours?.[dayOfWeek];
      if (!availHours || availHours.length === 0) {
        return { available: true, hours: ['08:00-18:00'], mode: 'default' as const };
      }
      return { 
        available: true, 
        hours: availHours.map(h => `${h.start}-${h.end}`),
        mode: 'available' as const
      };
    }
    
    const nonHours = provider.nonInterventionHours?.[dayOfWeek];
    if (nonHours && nonHours.length > 0) {
      return { 
        available: true, 
        hours: nonHours.map(h => `${h.start}-${h.end}`),
        mode: 'unavailable' as const,
        isUnavailable: true
      };
    }
    
    return { 
      available: true, 
      hours: ['08:00-18:00'],
      mode: 'default' as const
    };
  };

  React.useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  useEffect(() => {
    if (showUnassignedPanel) { setPanelSearch(''); setQuickAssignMission(null); }
  }, [showUnassignedPanel]);

  const [isRangeLoading, setIsRangeLoading] = useState(false);

  // Load missions from DB for the visible date range when currentDate changes
  useEffect(() => {
    if (!loadMissionsForRange) return;
    const start = currentDate.subtract(1, 'week').format('YYYY-MM-DD');
    const end = currentDate.add(1, 'week').format('YYYY-MM-DD');
    setIsRangeLoading(true);
    loadMissionsForRange(start, end)
      .catch(() => {})
      .finally(() => setIsRangeLoading(false));
  }, [currentDate.format('YYYY-MM-DD')]); // eslint-disable-line react-hooks/exhaustive-deps

  const { availableProviders, unavailableProviders } = useMemo(() => {
    const available: { provider: Provider; availability: ReturnType<typeof getProviderAvailabilityForDay> }[] = [];
    const unavailable: { provider: Provider; reason: string }[] = [];
    
    providers.forEach(provider => {
      if (provider.status === 'Inactive' || provider.status === 'Passive') {
        unavailable.push({ provider, reason: 'Inactive' });
        return;
      }
      
      const hasMissionsToday = missions.some(
        m => m.providerId === provider.id && m.date === currentDateStr && m.status !== 'cancelled'
      );

      const availability = getProviderAvailabilityForDay(provider);
      if (availability.available || hasMissionsToday) {
        available.push({ 
          provider, 
          availability: availability.available ? availability : { available: true as const, hours: ['08:00-18:00'], mode: 'default' as const }
        });
      } else {
        unavailable.push({ provider, reason: availability.reason || 'Indisponible' });
      }
    });
    
    return { availableProviders: available, unavailableProviders: unavailable };
  }, [providers, dayOfWeek, missions, currentDateStr]);

  const providerMissions = useMemo(() => {
    const map = new Map<string, Mission[]>();
    availableProviders.forEach(({ provider }) => {
      const dayMissions = missions.filter(m => 
        m.providerId === provider.id && 
        m.date === currentDateStr &&
        m.status !== 'cancelled'
      );
      map.set(provider.id, dayMissions);
    });
    return map;
  }, [missions, availableProviders, currentDateStr]);

  const getUnassignedMissionsForProvider = useMemo(() => {
    return (providerId: string, dateMode: 'day' | 'future' | 'all' = 'day'): Mission[] => {
      const provider = providers.find(p => p.id === providerId);
      const specialty = provider?.specialty?.toLowerCase() || '';
      const todayStr = getMartiniqueNowDayjs().format('YYYY-MM-DD');

      const matchesSpecialty = (serviceType: string): boolean => {
        if (!specialty) return true;
        if (!serviceType) return true; // Unknown type — show to all providers
        if (specialty.includes('jardinage') || specialty.includes('jardin')) {
          return serviceType.includes('jardinage') || serviceType.includes('jardin');
        }
        if (specialty.includes('ménage') || specialty.includes('menage') || specialty.includes('entretien')) {
          return serviceType.includes('ménage') || serviceType.includes('menage') || serviceType.includes('entretien');
        }
        if (specialty.includes('bricolage')) {
          return serviceType.includes('bricolage');
        }
        return true;
      };

      const passesDate = (date: string): boolean => {
        if (dateMode === 'day') return date === currentDateStr;
        if (dateMode === 'future') return date >= todayStr;
        return true;
      };

      return missions
        .filter(m => {
          const isUnassigned = !m.providerId || m.providerId === 'null' || m.providerId === '';
          if (!isUnassigned) return false;
          if (m.status === 'cancelled' || m.status === 'completed') return false;
          if (!passesDate(m.date)) return false;
          const sourceDoc = documents.find((d: any) => d.id === m.sourceDocumentId);
          const svcType = (sourceDoc?.serviceType || sourceDoc?.category || m.serviceType || m.service || '').toLowerCase();
          return matchesSpecialty(svcType);
        })
        .sort((a, b) => a.date.localeCompare(b.date));
    };
  }, [missions, currentDateStr, providers, documents, missionDateFilter]);

  const filteredProviders = useMemo(() => {
    let filtered = availableProviders;
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(({ provider }) => {
        const first = (provider.firstName || '').toLowerCase();
        const last = (provider.lastName || '').toLowerCase();
        const spec = (provider.specialty || '').toLowerCase();
        return first.includes(query) || last.includes(query) || spec.includes(query);
      });
    }
    
    if (statusFilter !== 'all') {
      filtered = filtered.filter(({ provider }) => {
        const dayMissions = providerMissions.get(provider.id) || [];
        const totalHours = dayMissions.reduce((sum, m) => sum + (m.duration || 0), 0);
        
        if (statusFilter === 'unplanned') return totalHours === 0;
        if (statusFilter === 'planned') return totalHours > 0;
        if (statusFilter === 'available') return totalHours < 7;
        return true;
      });
    }
    
    if (timeSlotFilter !== 'all') {
      filtered = filtered.filter(({ provider }) => {
        const dayMissions = providerMissions.get(provider.id) || [];
        const hasMorning = dayMissions.some(m => parseInt(m.startTime.split(':')[0]) < 12);
        const hasAfternoon = dayMissions.some(m => parseInt(m.startTime.split(':')[0]) >= 12);
        
        if (timeSlotFilter === 'morning') return hasMorning && !hasAfternoon;
        if (timeSlotFilter === 'afternoon') return !hasMorning && hasAfternoon;
        if (timeSlotFilter === 'full') return hasMorning && hasAfternoon;
        return true;
      });
    }
    
    if (specialtyFilter !== 'all') {
      filtered = filtered.filter(({ provider }) => {
        const sp = provider.specialty?.toLowerCase() || '';
        if (specialtyFilter === 'menage') return sp.includes('ménage') || sp.includes('menage');
        if (specialtyFilter === 'jardinage') return sp.includes('jardinage') || sp.includes('jardin');
        if (specialtyFilter === 'bricolage') return sp.includes('bricolage');
        return true;
      });
    }
    
    // Sort
    filtered = [...filtered].sort((a, b) => {
      if (sortOrder === 'name') return `${a.provider.firstName} ${a.provider.lastName}`.localeCompare(`${b.provider.firstName} ${b.provider.lastName}`);
      const hA = (providerMissions.get(a.provider.id) || []).reduce((s, m) => s + (m.duration || 0), 0);
      const hB = (providerMissions.get(b.provider.id) || []).reduce((s, m) => s + (m.duration || 0), 0);
      return sortOrder === 'load_asc' ? hA - hB : hB - hA;
    });
    return filtered;
  }, [availableProviders, providerMissions, searchQuery, statusFilter, timeSlotFilter, specialtyFilter, sortOrder]);

  const dayStats = useMemo(() => {
    const totalProviders = availableProviders.length;
    const plannedCount = availableProviders.filter(({ provider }) => (providerMissions.get(provider.id) || []).length > 0).length;
    const fullCount = availableProviders.filter(({ provider }) => {
      const h = (providerMissions.get(provider.id) || []).reduce((s, m) => s + (m.duration || 0), 0);
      return h >= 7;
    }).length;
    const totalHours = availableProviders.reduce((sum, { provider }) => {
      return sum + (providerMissions.get(provider.id) || []).reduce((s, m) => s + (m.duration || 0), 0);
    }, 0);
    const unassignedMissions = missions.filter(m =>
      m.date === currentDateStr &&
      (!m.providerId || m.providerId === 'null' || m.providerId === '') &&
      m.status !== 'cancelled' && m.status !== 'completed'
    );
    return { totalProviders, plannedCount, fullCount, totalHours, unassignedCount: unassignedMissions.length, unassignedMissions };
  }, [availableProviders, providerMissions, missions, currentDateStr]);

  const provisionalMissionsForDay = useMemo(() => {
    return (documents || [])
      .filter((d: any) => d.type === 'Devis')
      .filter((d: any) => d.status === 'sent' || d.status === 'signed')
      .filter((d: any) => Array.isArray(d.slotsData) && d.slotsData.length > 0)
      .flatMap((d: any) => (d.slotsData || []).map((slot: any, idx: number) => ({
        id: `provisional-${d.id}-${idx}`,
        date: slot?.date,
        startTime: slot?.startTime || '',
        endTime: slot?.endTime || '',
        duration: typeof slot?.duration === 'number' ? slot.duration : 0,
        service: d.description || 'Devis',
        clientId: d.clientId,
        clientName: d.clientName || 'Client',
        providerId: null as null,
        providerName: 'À assigner',
        status: 'planned' as const,
        sourceDocumentId: d.id,
        isProvisional: true,
      })))
      .filter((item: any) => item.date === currentDateStr);
  }, [documents, currentDateStr]);

  const allFutureProvisional = useMemo(() => {
    const todayStr = getMartiniqueNowDayjs().format('YYYY-MM-DD');
    const list = (documents || [])
      .filter((d: any) => d.type === 'Devis')
      .filter((d: any) => d.status === 'sent' || d.status === 'signed')
      .filter((d: any) => Array.isArray(d.slotsData) && d.slotsData.length > 0)
      .flatMap((d: any) => (d.slotsData || []).map((slot: any, idx: number) => ({
        id: `provisional-${d.id}-${idx}`,
        date: slot?.date,
        startTime: slot?.startTime || '',
        endTime: slot?.endTime || '',
        service: d.description || 'Devis',
        clientName: d.clientName || 'Client',
        sourceDocumentId: d.id,
      })))
      .filter((item: any) => item.date && item.date >= todayStr)
      .sort((a: any, b: any) => a.date.localeCompare(b.date));
    const grouped: Record<string, any[]> = {};
    for (const m of list) {
      if (!grouped[m.date]) grouped[m.date] = [];
      grouped[m.date].push(m);
    }
    return { list, grouped };
  }, [documents]);

  const allFutureUnassigned = useMemo(() => {
    const todayStr = getMartiniqueNowDayjs().format('YYYY-MM-DD');
    const list = missions
      .filter(m =>
        m.date >= todayStr &&
        (!m.providerId || m.providerId === 'null' || m.providerId === '') &&
        m.status !== 'cancelled' && m.status !== 'completed'
      )
      .sort((a, b) => a.date.localeCompare(b.date));
    const grouped: Record<string, Mission[]> = {};
    for (const m of list) {
      if (!grouped[m.date]) grouped[m.date] = [];
      grouped[m.date].push(m);
    }
    return { list, grouped };
  }, [missions]);

  const sendAssignmentEmail = async (provider: Provider, mission: Mission) => {
    if (!provider.email) return;
    try {
      await sendEmailViaEmailJS(
        provider.email,
        'Nouvelle mission assignée',
        'provider_mission_assigned',
        {
          providerName: `${provider.firstName} ${provider.lastName}`,
          clientName: mission.clientName,
          missionId: mission.id,
          date: dayjs(mission.date).format('dddd D MMMM YYYY'),
          startTime: mission.startTime,
          endTime: mission.endTime,
          service: mission.service || mission.serviceType || 'Prestation',
        }
      );
    } catch {
      // Email failure is non-blocking
    }
  };

  const handleQuickAssign = async () => {
    if (!quickAssignMission || !quickAssignProviderId) return;
    const provider = providers.find(p => p.id === quickAssignProviderId);
    const providerName = `${provider?.firstName || ''} ${provider?.lastName || ''}`.trim();
    try {
      if (assignProvider && quickAssignMission.id) {
        await assignProvider(quickAssignMission.id, quickAssignProviderId, providerName);
      } else if (addMission) {
        await addMission({ ...quickAssignMission, id: '', providerId: quickAssignProviderId, providerName, status: 'planned', color: 'orange' });
      }
      if (provider) await sendAssignmentEmail(provider, quickAssignMission);
      setToast({ type: 'success', message: `✅ ${quickAssignMission.clientName} → ${provider?.firstName}${provider?.email ? ' · 📧 Email envoyé' : ''}` });
      setQuickAssignMission(null);
      setQuickAssignProviderId('');
    } catch (e: any) {
      setToast({ type: 'error', message: `❌ ${e.message}` });
    }
  };

  const weeklyStats = useMemo(() => {
    const startOfWeek = currentDate.startOf('week');
    const weekDays: { date: string; dayName: string; missions: Mission[]; totalHours: number }[] = [];
    
    for (let i = 0; i < 7; i++) {
      const date = startOfWeek.add(i, 'day');
      const dateStr = date.format('YYYY-MM-DD');
      const dayMissions = missions.filter(m => m.date === dateStr && m.status !== 'cancelled');
      const totalHours = dayMissions.reduce((sum, m) => sum + (m.duration || 0), 0);
      
      weekDays.push({
        date: dateStr,
        dayName: date.format('ddd'),
        missions: dayMissions,
        totalHours
      });
    }
    
    const allWeekMissions = missions.filter(m => {
      const missionDate = dayjs(m.date);
      return missionDate.isSame(currentDate, 'week') && m.status !== 'cancelled';
    });
    
    const uniqueProviders = new Set(allWeekMissions.map(m => m.providerId).filter(Boolean));
    const pendingBillings = allWeekMissions.filter(m => m.status === 'completed').length;
    
    return {
      days: weekDays,
      totalHours: allWeekMissions.reduce((sum, m) => sum + (m.duration || 0), 0),
      uniqueProviders: uniqueProviders.size,
      pendingBillings
    };
  }, [missions, currentDate]);

  interface BillingInfo {
    documentId: string;
    clientName: string;
    totalMissions: number;
    completedMissions: number;
    status: 'partial' | 'complete';
    isPackUltime?: boolean;
  }

  const billingAnalysis = useMemo((): BillingInfo[] => {
    const docMap = new Map<string, { clientName: string; total: number; completed: number; isPackUltime: boolean }>();
    
    missions.forEach(m => {
      const docId = m.sourceDocumentId;
      if (!docId) return;
      
      const existing = docMap.get(docId) || { clientName: m.clientName || '', total: 0, completed: 0, isPackUltime: false };
      existing.total += 1;
      if (m.status === 'completed') {
        existing.completed += 1;
      }
      if (existing.total >= 6) {
        existing.isPackUltime = true;
      }
      docMap.set(docId, existing);
    });
    
    const result: BillingInfo[] = [];
    docMap.forEach((data, docId) => {
      if (data.total >= 1) {
        result.push({
          documentId: docId,
          clientName: data.clientName,
          totalMissions: data.total,
          completedMissions: data.completed,
          status: data.completed >= data.total && data.total >= 1 ? 'complete' : 'partial',
          isPackUltime: data.isPackUltime
        });
      }
    });
    
    return result.sort((a, b) => {
      if (a.status === 'complete' && b.status !== 'complete') return -1;
      if (b.status === 'complete' && a.status !== 'complete') return 1;
      return b.completedMissions - a.completedMissions;
    });
  }, [missions]);

  const filteredBillingAnalysis = useMemo(() => {
    if (!billingSearch.trim()) return billingAnalysis;
    const q = billingSearch.trim().toLowerCase();
    return billingAnalysis.filter(b => {
      const name = (b.clientName || '').toLowerCase();
      return name.includes(q);
    });
  }, [billingAnalysis, billingSearch]);

  const partialBillings = filteredBillingAnalysis.filter(b => b.status === 'partial');
  const completeBillings = filteredBillingAnalysis.filter(b => b.status === 'complete');

  const getSpecialtyEmoji = (specialty?: string): string => {
    if (!specialty) return '👤';
    const s = specialty.toLowerCase();
    if (s.includes('ménage') || s.includes('menage') || s.includes('entretien')) return '🧹';
    if (s.includes('jardinage') || s.includes('jardin')) return '🌿';
    if (s.includes('bricolage')) return '🔧';
    if (s.includes('garde') || s.includes('enfant')) return '👶';
    if (s.includes('cuisine') || s.includes('cuisinier')) return '🍳';
    return '⭐';
  };

  const getProviderStatus = (providerId: string): 'unplanned' | 'partial' | 'full' => {
    const dayMissions = providerMissions.get(providerId) || [];
    if (dayMissions.length === 0) return 'unplanned';
    
    const hasMorning = dayMissions.some(m => {
      const start = parseInt(m.startTime.split(':')[0]);
      return start < 12;
    });
    const hasAfternoon = dayMissions.some(m => {
      const start = parseInt(m.startTime.split(':')[0]);
      return start >= 12;
    });
    
    if (hasMorning && hasAfternoon) return 'full';
    return 'partial';
  };

  const getAvailabilityIndicator = (providerId: string): 'morning' | 'afternoon' | 'full' | 'none' => {
    const dayMissions = providerMissions.get(providerId) || [];
    if (dayMissions.length === 0) return 'full';
    
    const hasMorning = dayMissions.some(m => {
      const start = parseInt(m.startTime.split(':')[0]);
      return start < 12;
    });
    const hasAfternoon = dayMissions.some(m => {
      const start = parseInt(m.startTime.split(':')[0]);
      return start >= 12;
    });
    
    if (!hasMorning && !hasAfternoon) return 'full';
    if (!hasMorning) return 'morning';
    if (!hasAfternoon) return 'afternoon';
    return 'none';
  };

  const getProviderTotalHours = (providerId: string): number => {
    const dayMissions = providerMissions.get(providerId) || [];
    return dayMissions.reduce((total, m) => total + (m.duration || 0), 0);
  };

  type DayColorStatus = 'available' | 'almost' | 'full' | 'closed';
  
  const getDayColorStatus = (providerId: string): DayColorStatus => {
    const isClosed = closedDays.has(`${providerId}-${currentDateStr}`);
    if (isClosed) return 'closed';
    
    const totalHours = getProviderTotalHours(providerId);
    if (totalHours >= 7) return 'full';
    if (totalHours >= 4) return 'almost';
    return 'available';
  };

  const getDayColorClasses = (status: DayColorStatus): string => {
    switch (status) {
      case 'available': return 'bg-emerald-50 border-emerald-400';
      case 'almost':   return 'bg-yellow-50 border-yellow-400';
      case 'full':     return 'bg-orange-100 border-orange-500';
      case 'closed':   return 'bg-cyan-100 border-cyan-500';
    }
  };

  const toggleClosedDay = (providerId: string) => {
    const key = `${providerId}-${currentDateStr}`;
    setClosedDays(prev => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  };

  const generateWhatsAppMessage = (provider: Provider, dayMissions: Mission[]): string => {
    const formattedDate = currentDate.format('dddd D MMMM');
    let message = `Bonjour ${provider.firstName} 👋\nVoici ton planning du ${formattedDate} :\n`;
    
    if (dayMissions.length === 0) {
      message += `\nAucune mission prévue ce jour.`;
    } else {
      dayMissions.forEach((mission, idx) => {
        const serviceType = mission.service || 'Prestation';
        message += `\n📍 ${mission.startTime} - ${mission.endTime} — ${serviceType}`;
        if (mission.clientName) {
          message += `\n   Client: ${mission.clientName}`;
        }
      });
    }
    
    message += `\n\nBonne journée ! 🌟`;
    return message;
  };

  const sendWhatsAppMessage = async (provider: Provider, dayMissions: Mission[]) => {
    const providerName = provider.firstName || provider.lastName || 'Prestataire';
    const phone = provider.phone?.replace(/[^0-9]/g, '');
    console.log('[sendWhatsAppMessage] Provider:', providerName, 'phone:', provider.phone, 'cleaned:', phone);
    if (!phone) {
      setToast({ type: 'error', message: `❌ Numéro de téléphone non disponible pour ${providerName}` });
      return false;
    }
    
    const messageKey = `${provider.id}-${currentDateStr}`;
    if (sentMessages.has(messageKey)) {
      setToast({ type: 'info', message: `📱 Message déjà envoyé à ${providerName} aujourd'hui` });
      return false;
    }
    
    const message = generateWhatsAppMessage(provider, dayMissions);
    const config = getApiConfig();
    
    if (config.provider === 'wa_me') {
      const formattedPhone = phone.startsWith('33') ? `+${phone}` : `33${phone}`;
      const encodedMessage = encodeURIComponent(message);
      const url = `https://wa.me/${formattedPhone}?text=${encodedMessage}`;
      window.open(url, '_blank');
      setSentMessages(prev => new Set(prev).add(messageKey));
      setToast({ type: 'info', message: `📱 Message ouvert pour ${providerName}` });
    } else {
      setSmsSending({ current: 1, total: 1 });
      try {
        const result = await sendSMSBatch([phone], message);
        setSmsSending(null);
        if (result.success.length > 0) {
          setSentMessages(prev => new Set(prev).add(messageKey));
          setToast({ type: 'success', message: `✅ SMS envoyé à ${providerName}` });
        } else {
          setToast({ type: 'error', message: `❌ Échec envoi SMS à ${providerName}` });
        }
      } catch (error) {
        setSmsSending(null);
        setToast({ type: 'error', message: `❌ Serveur API non démarré. Lancez "node server.js"` });
      }
    }
    return true;
  };

  const sendSMSBatch = async (phones: string[], message: string): Promise<{ success: string[]; failed: string[] }> => {
    console.log('[sendSMSBatch] Sending to:', phones, 'message length:', message.length);
    try {
      const response = await fetch('http://localhost:3001/api/send-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phones, message })
      });
      
      console.log('[sendSMSBatch] Response status:', response.status);
      
      const text = await response.text();
      console.log('[sendSMSBatch] Response text:', text);
      
      if (!response.ok) {
        console.log('[sendSMSBatch] Error response:', text);
        throw new Error(`Erreur ${response.status}: ${text || 'Erreur serveur'}`);
      }
      
      if (!text) {
        return { success: phones, failed: [] };
      }
      
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        return { success: phones, failed: [] };
      }
      
      if (!data.ok) {
        throw new Error(data.error || 'Erreur envoi SMS');
      }
      
      const success: string[] = [];
      const failed: string[] = [];
      data.results?.forEach((r: { phone: string; success: boolean }) => {
        if (r.success) success.push(r.phone);
        else failed.push(r.phone);
      });
      console.log('[sendSMSBatch] Result:', { success, failed });
      return { success, failed };
    } catch (error) {
      console.error('SMS batch error:', error);
      throw error;
    }
  };

  const sendAllWhatsAppMessages = async () => {
    const config = getApiConfig();
    const results: { success: string[]; failed: string[] } = { success: [], failed: [] };
    
    const providersWithMissions = availableProviders
      .filter(({ provider }) => (providerMissions.get(provider.id) || []).length > 0)
      .map(({ provider }) => ({
        provider,
        message: generateWhatsAppMessage(provider, providerMissions.get(provider.id) || [])
      }));

    if (providersWithMissions.length === 0) {
      setToast({ type: 'info', message: 'Aucune mission à envoyer' });
      return;
    }

    if (config.provider === 'wa_me') {
      for (const { provider, message } of providersWithMissions) {
        const phone = provider.phone?.replace(/[^0-9]/g, '');
        if (!phone) {
          results.failed.push(provider.firstName);
          continue;
        }
        const formattedPhone = phone.startsWith('33') ? `+${phone}` : `33${phone}`;
        const encodedMessage = encodeURIComponent(message);
        const url = `https://wa.me/${formattedPhone}?text=${encodedMessage}`;
        window.open(url, '_blank');
        results.success.push(provider.firstName);
        setSentMessages(prev => new Set(prev).add(`${provider.id}-${currentDateStr}`));
      }
      setToast({ type: 'info', message: `📱 ${results.success.length} messages WhatsApp ouverts` });
    } else {
      const phones = providersWithMissions
        .map(({ provider }) => provider.phone?.replace(/[^0-9]/g, ''))
        .filter(Boolean) as string[];
      
      const messages = providersWithMissions.map(({ message }) => message);
      const total = messages.length;
      
      setSmsSending({ current: 0, total });
      
      try {
        for (let i = 0; i < messages.length; i++) {
          setSmsSending({ current: i + 1, total });
          const result = await sendSMSBatch([phones[i]], messages[i]);
          const { provider } = providersWithMissions[i];
          if (result.success.length > 0) {
            results.success.push(provider.firstName);
            setSentMessages(prev => new Set(prev).add(`${provider.id}-${currentDateStr}`));
          } else {
            results.failed.push(provider.firstName);
          }
        }
        
        setSmsSending(null);
        setToast({ type: 'success', message: `✅ SMS envoyés: ${results.success.length} | Échecs: ${results.failed.length}` });
      } catch (error) {
        setSmsSending(null);
        setToast({ type: 'error', message: 'Erreur lors de l\'envoi des SMS' });
      }
    }
  };

  const checkTimeSlotOverlap = (providerId: string, newStart: string, newEnd: string): boolean => {
    const dayMissions = providerMissions.get(providerId) || [];
    const newStartMin = parseInt(newStart.split(':')[0]) * 60 + parseInt(newStart.split(':')[1]);
    const newEndMin = parseInt(newEnd.split(':')[0]) * 60 + parseInt(newEnd.split(':')[1]);
    
    return dayMissions.some(m => {
      const mStartMin = parseInt(m.startTime.split(':')[0]) * 60 + parseInt(m.startTime.split(':')[1]);
      const mEndMin = parseInt(m.endTime.split(':')[0]) * 60 + parseInt(m.endTime.split(':')[1]);
      return newStartMin < mEndMin && newEndMin > mStartMin;
    });
  };

  const validateTimeSlot = (providerId: string, slot: TimeSlot): string | null => {
    const provider = providers.find(p => p.id === providerId);
    if (!provider) return 'Prestataire non trouvé';
    
    const availability = getProviderAvailabilityForDay(provider);
    if (!availability.available) return `Indisponible: ${availability.reason}`;
    
    const slotStart = parseInt(slot.start.split(':')[0]);
    const slotEnd = parseInt(slot.end.split(':')[0]);
    
    if (availability.mode === 'available' && availability.hours) {
      const isInAvailableHours = availability.hours.some(h => {
        const [availStart, availEnd] = h.split('-').map(t => parseInt(t.split(':')[0]));
        return slotStart >= availStart && slotEnd <= availEnd;
      });
      if (!isInAvailableHours) return 'Créneau hors des heures disponibles';
    }
    
    if (checkTimeSlotOverlap(providerId, slot.start, slot.end)) {
      return 'Chevauchement avec une mission existante';
    }
    
    const currentHours = getProviderTotalHours(providerId);
    const newTotal = currentHours + slot.duration;
    if (newTotal > 7) {
      return `Dépassement: ${currentHours}h déjà planifiées + ${slot.duration}h = ${newTotal}h (max 7h)`;
    }
    
    return null;
  };

  const getAvailableTimeSlots = (providerId: string): TimeSlot[] => {
    return TIME_SLOTS.filter(slot => validateTimeSlot(providerId, slot) === null);
  };

  const handleAssignClick = (providerId: string) => {
    setSelectedProviderId(providerId);
    setSelectedTimeSlot(null);
    setSelectedMission(null);
    setAssignError(null);
    setAssignSuccess(null);
    setMissionDateFilter('day');
    setCustomStartTime('');
    setCustomEndTime('');
    setShowAssignModal(true);
  };

  const handleConfirmAssignment = async () => {
    if (!selectedProviderId || !selectedMission) return;

    const effectiveStart = customStartTime || selectedTimeSlot?.start;
    const effectiveEnd = customEndTime || selectedTimeSlot?.end;
    const effectiveDuration = selectedTimeSlot?.duration || (
      effectiveStart && effectiveEnd
        ? Math.round((parseInt(effectiveEnd.split(':')[0]) * 60 + parseInt(effectiveEnd.split(':')[1]) - parseInt(effectiveStart.split(':')[0]) * 60 - parseInt(effectiveStart.split(':')[1])) / 60 * 10) / 10
        : 0
    );

    if (!effectiveStart || !effectiveEnd) {
      setAssignError('Veuillez sélectionner un créneau horaire');
      return;
    }

    if (selectedTimeSlot) {
      const error = validateTimeSlot(selectedProviderId, selectedTimeSlot);
      if (error) {
        setAssignError(error);
        return;
      }
    }
    
    setIsSubmitting(true);
    setAssignError(null);
    
    try {
      const provider = providers.find(p => p.id === selectedProviderId);
      const providerName = `${provider?.firstName || ''} ${provider?.lastName || ''}`.trim();

      // Determine the target date for this mission
      const targetDate = selectedMission.date !== currentDateStr && missionDateFilter !== 'day'
        ? selectedMission.date
        : currentDateStr;

      if (assignProvider && selectedMission.id) {
        // Update time/date if changed, then assign
        if (updateMission) {
          await updateMission(selectedMission.id, {
            date: targetDate,
            startTime: effectiveStart,
            endTime: effectiveEnd,
            duration: effectiveDuration
          });
        }
        await assignProvider(selectedMission.id, selectedProviderId, providerName);
        if (provider) await sendAssignmentEmail(provider, { ...selectedMission, date: targetDate, startTime: effectiveStart, endTime: effectiveEnd });
        setAssignSuccess(`✅ Mission assignée à ${provider?.firstName}`);
        setToast({ type: 'success', message: `✅ ${selectedMission.clientName} → ${provider?.firstName}${provider?.email ? ' · 📧 Email envoyé' : ''}` });
      } else if (addMission) {
        const newMission: Mission = {
          ...selectedMission,
          id: '',
          providerId: selectedProviderId,
          providerName,
          date: targetDate,
          startTime: effectiveStart,
          endTime: effectiveEnd,
          duration: effectiveDuration,
          status: 'planned',
          color: 'orange'
        };
        await addMission(newMission);
        if (provider) await sendAssignmentEmail(provider, newMission);
        setAssignSuccess(`✅ Mission créée pour ${provider?.firstName}`);
        setToast({ type: 'success', message: `✅ Mission créée pour ${provider?.firstName}${provider?.email ? ' · 📧 Email envoyé' : ''}` });
      } else {
        setToast({ type: 'success', message: '✅ Prestation attribuée (mode simulation)' });
      }

      setSelectedTimeSlot(null);
      setSelectedMission(null);
      setCustomStartTime('');
      setCustomEndTime('');
      setTimeout(() => {
        setShowAssignModal(false);
        setAssignSuccess(null);
      }, 1500);
    } catch (err: any) {
      setToast({ type: 'error', message: `❌ ${err.message || 'Erreur lors de l\'attribution'}` });
    } finally {
      setIsSubmitting(false);
    }
  };

  const { plannedProviders, unplannedProviders } = useMemo(() => {
    const planned: typeof availableProviders = [];
    const unplanned: typeof availableProviders = [];
    
    availableProviders.forEach(item => {
      const status = getProviderStatus(item.provider.id);
      if (status === 'full') {
        planned.push(item);
      } else {
        unplanned.push(item);
      }
    });
    
    return { plannedProviders: planned, unplannedProviders: unplanned };
  }, [availableProviders, providerMissions]);

  const renderProviderCard = (
    provider: Provider, 
    availability: ReturnType<typeof getProviderAvailabilityForDay>,
    missionCount: number
  ) => {
    const status = getProviderStatus(provider.id);
    const availIndicator = getAvailabilityIndicator(provider.id);
    
    const statusColors = {
      unplanned: 'bg-slate-100 border-slate-300',
      partial: 'bg-amber-50 border-amber-300',
      full: 'bg-green-50 border-green-300'
    };
    
    const statusLabels = {
      unplanned: 'Non planifiée',
      partial: 'Partiellement planifiée',
      full: 'Planifiée'
    };
    
    const statusDotColors = {
      unplanned: 'bg-slate-400',
      partial: 'bg-amber-500',
      full: 'bg-green-500'
    };

    return (
      <div key={provider.id} className={`p-3 rounded-lg border-2 shadow-sm ${statusColors[status]}`}>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-full bg-pink-100 flex items-center justify-center">
            <span className="text-sm font-bold text-pink-600">
              {(provider.firstName || '')[0]}{(provider.lastName || '')[0]}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm text-slate-800 truncate">
              {provider.firstName} {provider.lastName}
            </p>
            <p className="text-xs text-slate-500">{provider.specialty}</p>
          </div>
          <div className={`w-2 h-2 rounded-full ${statusDotColors[status]}`} title={statusLabels[status]} />
        </div>
        
        <div className="flex items-center gap-2 text-xs text-slate-600 mb-2">
          <Clock className="w-3 h-3" />
          <span className="truncate">
            {availability.hours?.[0] || '08:00-18:00'}
            {availability.hours && availability.hours.length > 1 && ` (+${availability.hours.length - 1})`}
          </span>
        </div>
        
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-600">
            {missionCount} mission{missionCount !== 1 ? 's' : ''}
          </span>
          <div className="flex items-center gap-1">
            {availIndicator === 'morning' && (
              <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">Matin</span>
            )}
            {availIndicator === 'afternoon' && (
              <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">APM</span>
            )}
            {availIndicator === 'full' && (
              <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">Dispo</span>
            )}
            {availIndicator === 'none' && (
              <span className="text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">Complet</span>
            )}
          </div>
        </div>
        
        {status !== 'full' && (
          <button
            onClick={() => handleAssignClick(provider.id)}
            className="mt-2 w-full flex items-center justify-center gap-1 py-1.5 bg-blue-500 text-white text-xs font-bold rounded hover:bg-blue-600 transition"
          >
            <Plus className="w-3 h-3" />
            Ajouter
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-white">
      <style>{printStyles}</style>
      
      {isLoading && (
        <div className="absolute inset-0 z-50 bg-white/90 flex flex-col">
          <div className="flex-shrink-0 border-b border-slate-200 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <ShimmerLoader className="h-10 w-32" />
                <ShimmerLoader className="h-8 w-24" />
              </div>
              <div className="flex items-center gap-3">
                <ShimmerLoader className="h-8 w-16" />
                <ShimmerLoader className="h-8 w-16" />
                <ShimmerLoader className="h-8 w-16" />
                <ShimmerLoader className="h-10 w-10 rounded-full" />
              </div>
            </div>
          </div>
          <div className="flex-shrink-0 border-b border-slate-200 px-6 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ShimmerLoader className="h-8 w-48" />
                <ShimmerLoader className="h-8 w-32" />
                <ShimmerLoader className="h-8 w-32" />
              </div>
              <ShimmerLoader className="h-8 w-24" />
            </div>
          </div>
          <div className="flex-1 flex">
            <div className="w-72 border-r border-slate-200 p-4 space-y-3">
              <ShimmerLoader className="h-6 w-24 mb-4" />
              {[1, 2, 3, 4].map(i => (
                <ShimmerCard key={i} />
              ))}
            </div>
            <div className="flex-1 p-4">
              <div className="grid grid-cols-2 gap-4">
                {[1, 2, 3, 4].map(i => (
                  <ShimmerCard key={i} />
                ))}
              </div>
            </div>
          </div>
          <div className="p-4 text-center text-sm text-slate-500">
            Chargement du planning...
          </div>
        </div>
      )}
      
      <div className="flex-shrink-0 bg-white border-b border-slate-200 px-4 md:px-6 py-3 md:py-4 no-print">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 md:gap-4">
              <button
                onClick={onSwitchToOldVersion}
                className="flex items-center gap-1 md:gap-2 px-2 md:px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold text-sm transition"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden md:inline">← Version précédente</span>
              </button>
              <h1 className="text-xl md:text-2xl font-serif font-bold text-slate-800">
                Planning
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2 md:gap-3 overflow-x-auto pb-1 md:pb-0">
            <button
              onClick={exportToPDF}
              className="flex items-center gap-1 md:gap-2 px-2 md:px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold text-sm transition"
              title="Exporter en PDF"
            >
              <FileText className="w-4 h-4" />
              <span className="hidden sm:inline">PDF</span>
            </button>
            <button
              onClick={exportToCSV}
              className="flex items-center gap-1 md:gap-2 px-2 md:px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold text-sm transition"
              title="Exporter la semaine en CSV"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">CSV</span>
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-1 md:gap-2 px-2 md:px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold text-sm transition"
              title="Imprimer le planning"
            >
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline">Imprimer</span>
            </button>
            <button
              onClick={generateShareLink}
              className="flex items-center gap-1 md:gap-2 px-2 md:px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold text-sm transition"
              title="Copier le lien de partage"
            >
              <Link className="w-4 h-4" />
              <span className="hidden sm:inline">Partager</span>
            </button>
            <button
              onClick={() => setShowUnassignedPanel(true)}
              className="relative flex items-center gap-1 md:gap-2 px-2 md:px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-lg font-bold text-sm transition"
              title="Voir toutes les missions à assigner"
            >
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline">À assigner</span>
              {allFutureUnassigned.list.length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {allFutureUnassigned.list.length > 9 ? '9+' : allFutureUnassigned.list.length}
                </span>
              )}
            </button>
            <button
              onClick={sendAllWhatsAppMessages}
              disabled={!!smsSending}
              className="flex items-center gap-1 md:gap-2 px-2 md:px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-bold text-sm transition disabled:opacity-50"
              title="Envoyer le planning du jour à toutes les prestataires"
            >
              {smsSending ? (
                <>
                  <span className="animate-spin">⏳</span>
                  <span className="hidden sm:inline">{smsSending.current}/{smsSending.total}</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span className="hidden sm:inline">WhatsApp</span>
                </>
              )}
            </button>
            <button
              onClick={() => setShowApiSettings(true)}
              className="p-2 hover:bg-slate-100 rounded-lg transition"
              title="Paramètres API"
            >
              <Settings className="w-5 h-5 text-slate-500" />
            </button>
            <button
              onClick={() => setShowHistory(!showHistory)}
              className={`p-2 rounded-lg transition ${showHistory ? 'bg-blue-500 text-white' : 'hover:bg-slate-100 text-slate-500'}`}
              title="Historique du jour"
            >
              <History className="w-5 h-5" />
            </button>
            <div className="hidden md:block text-right">
              <p className="text-sm text-slate-500">Aujourd'hui</p>
              <p className="font-bold text-slate-800">{todayFormatted}</p>
            </div>
            <div className="w-8 md:w-10 h-8 md:h-10 rounded-full bg-blue-500 flex items-center justify-center">
              <Calendar className="w-4 md:w-5 h-4 md:h-5 text-white" />
            </div>
          </div>
        </div>
      </div>

      <div className="flex-shrink-0 bg-slate-50 border-b border-slate-200 px-4 md:px-6 py-3">
        <div className="flex items-center justify-between">
          <button
            onClick={handlePrevDay}
            className="p-2 hover:bg-slate-200 rounded-lg transition"
            title="Jour précédent"
          >
            <ChevronLeft className="w-5 h-5 text-slate-600" />
          </button>
          
          <div className="flex items-center gap-2">
            <button
              onClick={handleGoToToday}
              title="Aller à aujourd'hui (T)"
              className={`px-4 py-1.5 rounded-full text-sm font-bold transition ${
                isToday 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
              }`}
            >
              Aujourd'hui
            </button>
            <div className="relative">
              <button
                onClick={() => setShowDatePicker(!showDatePicker)}
                className="text-lg font-bold text-slate-800 px-2 hover:text-blue-600 transition flex items-center gap-1"
                title="Choisir une date"
              >
                {currentDate.format('D MMMM')}
                <span className="text-xs text-slate-400">▾</span>
              </button>
              {showDatePicker && (
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 z-50 bg-white rounded-xl shadow-xl border border-slate-200 p-2">
                  <input
                    type="date"
                    autoFocus
                    value={currentDateStr}
                    onChange={e => { if (e.target.value) { setCurrentDate(dayjs(e.target.value)); setSentMessages(new Set()); } setShowDatePicker(false); }}
                    onBlur={() => setTimeout(() => setShowDatePicker(false), 150)}
                    className="border-0 outline-none text-sm text-slate-700 cursor-pointer"
                  />
                </div>
              )}
            </div>
          </div>
          
          <button
            onClick={handleNextDay}
            className="p-2 hover:bg-slate-200 rounded-lg transition"
            title="Jour suivant"
          >
            <ChevronRight className="w-5 h-5 text-slate-600" />
          </button>
        </div>
      </div>

      <div className="flex-shrink-0 bg-white border-b border-slate-200 px-4 md:px-6 py-2">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 md:gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Rechercher..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-3 py-1.5 text-sm border border-slate-300 rounded-lg w-32 md:w-40 focus:outline-none focus:border-blue-500"
              />
            </div>
            
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
              className="text-sm border border-slate-300 rounded-lg px-2 py-1.5"
            >
              <option value="all">Tous</option>
              <option value="unplanned">Non planifiées</option>
              <option value="planned">Planifiées</option>
              <option value="available">Dispo</option>
            </select>
            
            <select
              value={timeSlotFilter}
              onChange={(e) => setTimeSlotFilter(e.target.value as typeof timeSlotFilter)}
              className="text-sm border border-slate-300 rounded-lg px-2 py-1.5"
            >
              <option value="all">Tous</option>
              <option value="morning">Matin</option>
              <option value="afternoon">AM</option>
              <option value="full">Jour</option>
            </select>

            <div className="flex items-center gap-1 border border-slate-200 rounded-lg p-0.5 bg-slate-50">
              {([['all', 'Tous'], ['menage', '🧹'], ['jardinage', '🌿'], ['bricolage', '🔧']] as const).map(([val, label]) => (
                <button
                  key={val}
                  onClick={() => setSpecialtyFilter(val)}
                  className={`px-2 py-1 rounded text-xs font-bold transition ${specialtyFilter === val ? 'bg-white shadow text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
                  title={val === 'all' ? 'Toutes spécialités' : val}
                >
                  {label}
                </button>
              ))}
            </div>

            <select
              value={sortOrder}
              onChange={e => setSortOrder(e.target.value as typeof sortOrder)}
              className="text-sm border border-slate-300 rounded-lg px-2 py-1.5 text-slate-600"
              title="Trier les prestataires"
            >
              <option value="name">A–Z</option>
              <option value="load_asc">Charge ↑</option>
              <option value="load_desc">Charge ↓</option>
            </select>

            {(searchQuery || statusFilter !== 'all' || timeSlotFilter !== 'all' || specialtyFilter !== 'all') && (
              <button
                onClick={() => { setSearchQuery(''); setStatusFilter('all'); setTimeSlotFilter('all'); setSpecialtyFilter('all'); }}
                className="flex items-center gap-1 text-xs px-2 py-1.5 bg-red-50 text-red-500 border border-red-200 rounded-lg font-bold hover:bg-red-100 transition"
                title="Effacer tous les filtres"
              >
                <X className="w-3 h-3" /> Effacer
              </button>
            )}
          </div>
          
          <div className="flex items-center gap-2 md:gap-3">
            <div className="hidden sm:flex items-center gap-2 text-xs text-slate-600">
              <span className="bg-slate-100 px-2 py-1 rounded">
                {weeklyStats.totalHours}h/sem
              </span>
              <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded">
                {weeklyStats.uniqueProviders} prest.
              </span>
              <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded">
                {weeklyStats.pendingBillings} facturer
              </span>
            </div>
            
            <button
              onClick={() => setShowWeeklyView(!showWeeklyView)}
              className={`p-1.5 rounded-lg transition ${showWeeklyView ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              title={showWeeklyView ? 'Vue jour' : 'Vue semaine'}
            >
              <Grid3X3 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowSidebar(!showSidebar)}
              className="md:hidden relative p-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition"
              title="Afficher les prestataires"
            >
              <Users className="w-4 h-4" />
              {(statusFilter !== 'all' || timeSlotFilter !== 'all' || specialtyFilter !== 'all') && (
                <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-blue-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                  {[statusFilter !== 'all', timeSlotFilter !== 'all', specialtyFilter !== 'all'].filter(Boolean).length}
                </span>
              )}
            </button>
          </div>
        </div>
        
        {showWeeklyView && (
          <div className="mt-3 pt-3 border-t border-slate-200">
            <div className="grid grid-cols-7 gap-2">
              {weeklyStats.days.map((day, idx) => {
                const isCurrentDay = day.date === currentDateStr;
                const colorClass = day.totalHours >= 7 ? 'bg-orange-200 border-orange-500' :
                                  day.totalHours >= 4 ? 'bg-yellow-100 border-yellow-400' :
                                  day.totalHours > 0 ? 'bg-emerald-100 border-emerald-400' :
                                  'bg-slate-100 border-slate-300';
                
                return (
                  <button
                    key={day.date}
                    onClick={() => setCurrentDate(dayjs(day.date))}
                    className={`p-2 rounded-lg border-2 text-center transition ${colorClass} ${isCurrentDay ? 'ring-2 ring-blue-500' : 'hover:border-slate-400'}`}
                  >
                    <div className="text-xs font-bold text-slate-600 capitalize">{day.dayName}</div>
                    <div className={`text-lg font-bold ${isCurrentDay ? 'text-blue-600' : 'text-slate-800'}`}>{dayjs(day.date).format('D')}</div>
                    <div className="text-xs text-slate-500">{day.missions.length} miss.</div>
                    <div className="text-xs font-medium text-slate-600">{day.totalHours}h</div>
                    {(() => {
                      const unassigned = missions.filter(m => m.date === day.date && (!m.providerId || m.providerId === 'null' || m.providerId === '') && m.status !== 'cancelled' && m.status !== 'completed').length;
                      return unassigned > 0 ? (
                        <div className="text-[10px] font-bold text-red-500 bg-red-50 rounded px-1 mt-0.5">{unassigned} ⚠</div>
                      ) : null;
                    })()}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 flex overflow-hidden relative">
        {showSidebar && (
          <div className="md:hidden fixed inset-0 z-50 flex">
            <div className="w-72 flex-shrink-0 border-r border-slate-200 bg-slate-50 overflow-y-auto h-full">
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-bold text-slate-600 uppercase tracking-wide">
                    Prestataires
                  </h2>
                  <button onClick={() => setShowSidebar(false)} className="p-1 hover:bg-slate-200 rounded">
                    <X className="w-4 h-4 text-slate-500" />
                  </button>
                </div>
                {plannedProviders.length > 0 && (
                  <div className="mb-4">
                    <h3 className="text-xs font-bold text-blue-500 mb-2 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                      Planifiées ({plannedProviders.length})
                    </h3>
                    <div className="space-y-2">
                      {plannedProviders.map(({ provider, availability }) => 
                        renderProviderCard(provider, availability, (providerMissions.get(provider.id) || []).length)
                      )}
                    </div>
                  </div>
                )}
                {unplannedProviders.length > 0 && (
                  <div className="mb-4">
                    <h3 className="text-xs font-bold text-slate-500 mb-2 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                      Disponibles ({unplannedProviders.length})
                    </h3>
                    <div className="space-y-2">
                      {unplannedProviders.map(({ provider, availability }) => 
                        renderProviderCard(provider, availability, (providerMissions.get(provider.id) || []).length)
                      )}
                    </div>
                  </div>
                )}
                {!isLoading && availableProviders.length === 0 && (
                  <p className="text-xs text-slate-400 text-center py-4">
                    Aucun prestataire disponible ce jour
                  </p>
                )}
                {unavailableProviders.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-slate-200">
                    <h3 className="text-xs font-bold text-slate-400 mb-2">Indisponibles ({unavailableProviders.length})</h3>
                    <div className="space-y-1">
                      {unavailableProviders.map(({ provider, reason }) => (
                        <div key={provider.id} className="text-xs text-slate-400 p-2 bg-slate-100 rounded">
                          {provider.firstName} {provider.lastName}
                          <span className="block text-slate-400">{reason}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="flex-1 bg-black/30" onClick={() => setShowSidebar(false)} />
          </div>
        )}
        <div className="hidden md:block w-72 flex-shrink-0 border-r border-slate-200 bg-slate-50 overflow-y-auto">
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-slate-600 uppercase tracking-wide">
                Prestataires
              </h2>
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold">
                {availableProviders.length}
              </span>
            </div>
            
            {unplannedProviders.length > 0 && (
              <div className="mb-4">
                <h3 className="text-xs font-bold text-slate-500 mb-2 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                  Disponibles
                </h3>
                <div className="space-y-2">
                  {unplannedProviders.map(({ provider, availability }) => 
                    renderProviderCard(
                      provider, 
                      availability, 
                      (providerMissions.get(provider.id) || []).length
                    )
                  )}
                </div>
              </div>
            )}
            
            {plannedProviders.length > 0 && (
              <div>
                <h3 className="text-xs font-bold text-slate-500 mb-2 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-green-500"></span>
                  Aujourd'hui
                </h3>
                <div className="space-y-2">
                  {plannedProviders.map(({ provider, availability }) => 
                    renderProviderCard(
                      provider, 
                      availability, 
                      (providerMissions.get(provider.id) || []).length
                    )
                  )}
                </div>
              </div>
            )}
            
            {!isLoading && availableProviders.length === 0 && (
              <p className="text-xs text-slate-400 text-center py-4">
                Aucun prestataire disponible ce jour
              </p>
            )}
            
            {(dayStats.unassignedMissions.length > 0 || provisionalMissionsForDay.length > 0) && (
              <div className="mt-4 pt-4 border-t border-orange-100">
                <h3 className="text-xs font-bold text-orange-600 mb-2 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-orange-400 animate-pulse"></span>
                  À assigner ({dayStats.unassignedMissions.length + provisionalMissionsForDay.length})
                </h3>
                <div className="space-y-1">
                  {dayStats.unassignedMissions.map(m => (
                    <div key={m.id} className="text-xs bg-red-50 border border-red-100 rounded p-2">
                      <div className="font-bold text-red-700 truncate">{m.clientName || 'Client'}</div>
                      <div className="text-red-500">{m.startTime}–{m.endTime} · {m.service || m.serviceType || '—'}</div>
                    </div>
                  ))}
                  {provisionalMissionsForDay.map((m: any) => (
                    <div key={m.id} className="text-xs bg-orange-50 border border-orange-200 rounded p-2">
                      <div className="font-bold text-orange-700 truncate">{m.clientName}</div>
                      <div className="text-orange-500">{m.startTime}–{m.endTime} · {m.service || '—'}</div>
                      <div className="text-[10px] text-orange-400 italic">Devis en attente</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {unavailableProviders.length > 0 && (
              <div className="mt-4 pt-4 border-t border-slate-200">
                <h3 className="text-xs font-bold text-slate-400 mb-2">Indisponibles</h3>
                <div className="space-y-1">
                  {unavailableProviders.map(({ provider, reason }) => (
                    <div key={provider.id} className="p-2 bg-slate-100 rounded text-xs opacity-50">
                      <span className="font-bold text-slate-600">{provider.firstName} {provider.lastName?.[0]}.</span>
                      <span className="text-slate-400 ml-1">{reason}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-auto bg-white">
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                {showWeeklyView
                  ? `Semaine du ${currentDate.startOf('week').format('D MMMM')} au ${currentDate.endOf('week').format('D MMMM')}`
                  : currentDate.format('dddd D MMMM')}
                {isRangeLoading && (
                  <span className="inline-flex items-center gap-1 text-xs font-normal text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                    <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse inline-block"></span>
                    Chargement…
                  </span>
                )}
              </h2>
              {!showWeeklyView && (
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-slate-500 font-bold">Légende:</span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-sm bg-emerald-400"></span>
                    <span className="text-slate-600">Dispo</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-sm bg-yellow-400"></span>
                    <span className="text-slate-600">Presque plein</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-sm bg-orange-500"></span>
                    <span className="text-slate-600">Plein</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-sm bg-cyan-500"></span>
                    <span className="text-slate-600">Clos</span>
                  </span>
                  <span className="flex items-center gap-1.5 ml-2 pl-2 border-l border-slate-300">
                    <span className="w-3 h-3 rounded-sm bg-pink-500"></span>
                    <span className="text-slate-600">Mission</span>
                  </span>
                </div>
              )}
            </div>
            
            {showWeeklyView && (
              <div className="grid grid-cols-7 gap-3 min-w-0">
                {weeklyStats.days.map((day) => {
                  let dayMissionsList = day.missions.filter(m => m.status !== 'cancelled');
                  if (searchQuery) {
                    const q = searchQuery.toLowerCase();
                    dayMissionsList = dayMissionsList.filter(m => {
                      const client = (m.clientName || '').toLowerCase();
                      const svc = (m.service || '').toLowerCase();
                      const prov = (m.providerName || '').toLowerCase();
                      return client.includes(q) || svc.includes(q) || prov.includes(q);
                    });
                  }
                  if (statusFilter !== 'all') {
                    dayMissionsList = dayMissionsList.filter(m => {
                      if (statusFilter === 'unplanned') return !m.providerId || m.providerId === 'null';
                      if (statusFilter === 'planned') return !!m.providerId && m.providerId !== 'null';
                      if (statusFilter === 'available') return m.status !== 'completed';
                      return true;
                    });
                  }
                  if (timeSlotFilter !== 'all') {
                    dayMissionsList = dayMissionsList.filter(m => {
                      const startHour = parseInt(m.startTime?.split(':')[0] || '0');
                      const hasMorning = startHour < 12;
                      const hasAfternoon = startHour >= 12;
                      if (timeSlotFilter === 'morning') return hasMorning;
                      if (timeSlotFilter === 'afternoon') return hasAfternoon;
                      if (timeSlotFilter === 'full') return hasMorning && hasAfternoon;
                      return true;
                    });
                  }
                  if (specialtyFilter !== 'all') {
                    dayMissionsList = dayMissionsList.filter(m => {
                      const svc = (m.service || '').toLowerCase();
                      if (specialtyFilter === 'menage') return svc.includes('ménage') || svc.includes('menage');
                      if (specialtyFilter === 'jardinage') return svc.includes('jardinage') || svc.includes('jardin');
                      if (specialtyFilter === 'bricolage') return svc.includes('bricolage');
                      return true;
                    });
                  }
                  const dayDate = dayjs(day.date);
                  const isTodayDay = day.date === today;
                  const dayUnassigned = missions.filter(m => m.date === day.date && (!m.providerId || m.providerId === 'null' || m.providerId === '') && m.status !== 'cancelled' && m.status !== 'completed');
                  const dayProv = allFutureProvisional.list.filter((m: any) => m.date === day.date);
                  return (
                    <div key={day.date} className={`border rounded-xl overflow-hidden flex flex-col ${isTodayDay ? 'border-blue-400 ring-2 ring-blue-200' : 'border-slate-200'}`}>
                      <button
                        onClick={() => { setCurrentDate(dayDate); }}
                        className={`px-2 py-2 text-center ${isTodayDay ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'} transition`}
                      >
                        <div className="text-xs font-bold uppercase">{dayDate.format('ddd')}</div>
                        <div className="text-lg font-bold">{dayDate.format('D')}</div>
                        <div className="text-[10px] opacity-80">{dayMissionsList.length} miss · {day.totalHours}h</div>
                        {dayUnassigned.length > 0 && (
                          <div className="text-[10px] text-red-200 font-bold mt-0.5">{dayUnassigned.length} ⚠</div>
                        )}
                      </button>
                      <div className="p-2 space-y-2 bg-white flex-1 overflow-y-auto max-h-[60vh]">
                        {dayMissionsList.length === 0 && dayProv.length === 0 && dayUnassigned.length === 0 && (
                          <p className="text-[10px] text-slate-400 italic text-center py-2">—</p>
                        )}
                        {dayProv.map((m: any) => (
                          <div key={m.id} className="bg-orange-50 border-l-2 border-orange-400 rounded p-1.5 text-[10px]">
                            <p className="font-bold text-orange-800 truncate">{m.clientName}</p>
                            <p className="text-orange-600">{m.startTime}–{m.endTime}</p>
                            <span className="text-[9px] text-orange-500 italic">En attente</span>
                          </div>
                        ))}
                        {dayUnassigned.map(m => (
                          <div key={m.id} className="bg-red-50 border-l-2 border-red-400 rounded p-1.5 text-[10px]">
                            <p className="font-bold text-red-800 truncate">{m.clientName || 'Client'}</p>
                            <p className="text-red-600">{m.startTime}–{m.endTime}</p>
                            <span className="text-[9px] text-red-500 italic">Non attribuée</span>
                          </div>
                        ))}
                        {dayMissionsList.map(m => {
                          const p = providers.find(pr => pr.id === m.providerId);
                          return (
                            <div key={m.id} className="bg-pink-50 border-l-2 border-pink-400 rounded p-1.5 text-[10px]">
                              <p className="font-bold text-slate-800 truncate">{m.clientName || m.service}</p>
                              <p className="text-slate-600">{m.startTime}–{m.endTime}</p>
                              <p className="text-[9px] text-slate-500 truncate">{p ? `${p.firstName} ${p.lastName}` : m.providerName || '—'}</p>
                              <div className="mt-1 flex items-center gap-1">
                                <span className={`text-[9px] px-1 py-0.5 rounded-full font-bold ${
                                  m.status === 'completed' ? 'bg-green-100 text-green-700' :
                                  m.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                                  'bg-pink-100 text-pink-700'
                                }`}>
                                  {m.status === 'completed' ? '✅' : m.status === 'in_progress' ? '🔄' : '📋'}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {!showWeeklyView && (<>{dayStats.totalProviders > 0 && (
              <div className="mb-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 flex flex-col">
                  <span className="text-xs text-blue-500 font-medium">Planifiés</span>
                  <span className="text-xl font-bold text-blue-700">{dayStats.plannedCount}<span className="text-sm font-medium text-blue-400">/{dayStats.totalProviders}</span></span>
                  <div className="w-full bg-blue-100 rounded-full h-1.5 mt-1">
                    <div className="bg-blue-400 h-1.5 rounded-full transition-all" style={{ width: `${dayStats.totalProviders > 0 ? (dayStats.plannedCount / dayStats.totalProviders) * 100 : 0}%` }} />
                  </div>
                </div>
                <div className="bg-green-50 border border-green-100 rounded-lg px-3 py-2 flex flex-col">
                  <span className="text-xs text-green-500 font-medium">Jours complets</span>
                  <span className="text-xl font-bold text-green-700">{dayStats.fullCount}<span className="text-sm font-medium text-green-400">/{dayStats.totalProviders}</span></span>
                  <div className="w-full bg-green-100 rounded-full h-1.5 mt-1">
                    <div className="bg-green-400 h-1.5 rounded-full transition-all" style={{ width: `${dayStats.totalProviders > 0 ? (dayStats.fullCount / dayStats.totalProviders) * 100 : 0}%` }} />
                  </div>
                </div>
                <div className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 flex flex-col">
                  <span className="text-xs text-amber-500 font-medium">Heures planifiées</span>
                  <span className="text-xl font-bold text-amber-700">{dayStats.totalHours}<span className="text-sm font-medium text-amber-400">h</span></span>
                  <div className="w-full bg-amber-100 rounded-full h-1.5 mt-1">
                    <div className="bg-amber-400 h-1.5 rounded-full transition-all" style={{ width: `${Math.min((dayStats.totalHours / (dayStats.totalProviders * 7)) * 100, 100)}%` }} />
                  </div>
                </div>
                <button
                  onClick={() => (dayStats.unassignedCount + provisionalMissionsForDay.length) > 0 && setShowUnassignedPanel(true)}
                  className={`border rounded-lg px-3 py-2 flex flex-col text-left transition ${
                    (dayStats.unassignedCount + provisionalMissionsForDay.length) > 0
                      ? 'bg-orange-50 border-orange-200 hover:bg-orange-100 cursor-pointer'
                      : 'bg-slate-50 border-slate-100 cursor-default'
                  }`}
                >
                  <span className={`text-xs font-medium ${
                    (dayStats.unassignedCount + provisionalMissionsForDay.length) > 0 ? 'text-orange-600' : 'text-slate-400'
                  }`}>À assigner</span>
                  <span className={`text-xl font-bold ${
                    (dayStats.unassignedCount + provisionalMissionsForDay.length) > 0 ? 'text-orange-700' : 'text-slate-400'
                  }`}>{dayStats.unassignedCount + provisionalMissionsForDay.length}</span>
                  {(dayStats.unassignedCount + provisionalMissionsForDay.length) === 0
                    ? <span className="text-xs text-green-500 mt-0.5">✓ Tout assigné</span>
                    : <span className="text-xs text-orange-500 mt-0.5">
                        {dayStats.unassignedCount > 0 && <span>{dayStats.unassignedCount} mission{dayStats.unassignedCount > 1 ? 's' : ''}</span>}
                        {dayStats.unassignedCount > 0 && provisionalMissionsForDay.length > 0 && ' + '}
                        {provisionalMissionsForDay.length > 0 && <span>{provisionalMissionsForDay.length} devis</span>}
                      </span>
                  }
                </button>
              </div>
            )}

            {provisionalMissionsForDay.length > 0 && (
              <div className="mb-4 border-2 border-orange-300 rounded-xl bg-orange-50 overflow-hidden">
                <div className="px-4 py-2 bg-orange-100 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-orange-700 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse inline-block"></span>
                    Devis en attente — créneaux à valider ({provisionalMissionsForDay.length})
                  </h3>
                  <span className="text-xs text-orange-600 font-medium bg-orange-200 px-2 py-0.5 rounded-full">En attente client</span>
                </div>
                <div className="p-3 flex flex-wrap gap-2">
                  {provisionalMissionsForDay.map((m: any) => (
                    <div key={m.id} className="bg-white border border-orange-200 rounded-lg px-3 py-2 text-xs shadow-sm min-w-[160px]">
                      <p className="font-bold text-orange-800 truncate">{m.clientName}</p>
                      <p className="text-orange-500 mt-0.5">{m.startTime && m.endTime ? `${m.startTime}–${m.endTime}` : 'Horaire ?'}</p>
                      <p className="text-slate-500 truncate mt-0.5">{m.service || '—'}</p>
                      <span className="mt-1.5 inline-block text-[10px] font-bold bg-orange-100 text-orange-600 rounded px-2 py-0.5">
                        🕐 En attente
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {dayStats.unassignedMissions.length > 0 && (
              <div className="mb-4 border-2 border-red-200 rounded-xl bg-red-50 overflow-hidden">
                <div className="px-4 py-2 bg-red-100 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-red-700 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse inline-block"></span>
                    Missions non attribuées ce jour ({dayStats.unassignedMissions.length})
                  </h3>
                  <button
                    onClick={() => setShowUnassignedPanel(true)}
                    className="text-xs font-bold text-red-600 hover:text-red-800 underline"
                  >
                    Assigner →
                  </button>
                </div>
                <div className="p-3 flex flex-wrap gap-2">
                  {dayStats.unassignedMissions.map(m => (
                    <div key={m.id} className="bg-white border border-red-200 rounded-lg px-3 py-2 text-xs shadow-sm min-w-[160px]">
                      <p className="font-bold text-red-800 truncate">{m.clientName || 'Client'}</p>
                      <p className="text-red-500 mt-0.5">{m.startTime && m.endTime ? `${m.startTime}–${m.endTime}` : 'Horaire ?'}</p>
                      <p className="text-slate-500 truncate mt-0.5">{m.service || m.serviceType || '—'}</p>
                      <button
                        onClick={() => { setShowUnassignedPanel(true); }}
                        className="mt-1.5 w-full text-[10px] font-bold bg-red-100 hover:bg-red-200 text-red-700 rounded px-2 py-1 transition"
                      >
                        + Assigner
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-3">
              {filteredProviders.map(({ provider, availability }) => {
                const dayMissions = providerMissions.get(provider.id) || [];
                const totalHours = getProviderTotalHours(provider.id);
                const availableSlots = getAvailableTimeSlots(provider.id);
                const colorStatus = getDayColorStatus(provider.id);
                const colorClasses = getDayColorClasses(colorStatus);
                const isClosed = colorStatus === 'closed';
                
                const isExpanded = expandedCards.has(provider.id);
                return (
                  <div key={provider.id} className={`border-2 rounded-xl overflow-hidden shadow-sm ${colorClasses}`}>
                    <div className="px-4 py-2 flex items-center justify-between bg-white/60">
                      <div className="flex items-center gap-3 min-w-0">
                        <button
                          className="relative w-9 h-9 rounded-full bg-pink-100 flex items-center justify-center flex-shrink-0 hover:scale-105 transition"
                          onClick={() => toggleCardExpand(provider.id)}
                          title={isExpanded ? 'Réduire' : 'Détailler'}
                        >
                          <span className="text-xs font-bold text-pink-600">
                            {(provider.firstName || '')[0]}{(provider.lastName || '')[0]}
                          </span>
                          <span className="absolute -bottom-0.5 -right-0.5 text-[11px]" title={provider.specialty || ''}>{getSpecialtyEmoji(provider.specialty)}</span>
                        </button>
                        <div className="min-w-0">
                          <p className="font-bold text-sm text-slate-800 truncate">
                            {provider.firstName} {provider.lastName}
                          </p>
                          <div className="flex items-center gap-2">
                            <p className="text-xs text-slate-500">{totalHours}h / 7h</p>
                            {provider.specialty && <span className="text-[10px] text-slate-400 hidden sm:inline truncate">{provider.specialty}</span>}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {dayMissions.length > 0 && (() => {
                          const isSent = sentMessages.has(`${provider.id}-${currentDateStr}`);
                          return isSent ? (
                          <span className="flex items-center gap-1 text-xs px-2 py-1 bg-gray-200 text-gray-500 rounded font-bold">
                            ✓ Envoyé
                          </span>
                          ) : (
                          <button
                            onClick={() => sendWhatsAppMessage(provider, dayMissions)}
                            className="flex items-center gap-1 text-xs px-2 py-1 bg-green-100 text-green-700 rounded font-bold hover:bg-green-200 transition"
                            title="Envoyer le planning par WhatsApp"
                          >
                            📱 WhatsApp
                          </button>
                          );
                        })()}
                        <button
                          onClick={() => toggleClosedDay(provider.id)}
                          className={`text-xs px-2 py-1 rounded font-bold transition ${
                            isClosed
                              ? 'bg-cyan-500 text-white hover:bg-cyan-600'
                              : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                          }`}
                          title={isClosed ? 'Rouvrir la journée' : 'Clôturer la journée'}
                        >
                          {isClosed ? '🩵 Clos' : 'Jour clos'}
                        </button>
                        {totalHours < 7 && availableSlots.length > 0 && (
                          <button
                            onClick={() => handleAssignClick(provider.id)}
                            className="flex items-center gap-1 px-3 py-1.5 bg-blue-500 text-white text-xs font-bold rounded hover:bg-blue-600 transition"
                          >
                            <Plus className="w-3 h-3" />
                            Ajouter
                          </button>
                        )}
                        {totalHours >= 7 && (
                          <span className={`text-xs px-2 py-1 rounded font-bold ${isClosed ? 'bg-cyan-200 text-cyan-800' : 'bg-green-100 text-green-700'}`}>
                            {isClosed ? 'Clos' : 'Jour complet'}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div className={`bg-white transition-all duration-200 overflow-hidden ${dayMissions.length === 0 && !isExpanded ? 'max-h-14' : ''}`}>
                      {/* Compact missions strip always visible */}
                      {dayMissions.length > 0 && !isExpanded && (
                        <div className="px-4 py-1.5 flex flex-wrap gap-1 border-t border-slate-100">
                          {dayMissions.map(m => (
                            <span key={m.id} className="text-[10px] bg-pink-50 text-pink-700 border border-pink-200 px-1.5 py-0.5 rounded-full font-medium">
                              {m.startTime}–{m.endTime} · {m.clientName || m.service}
                            </span>
                          ))}
                        </div>
                      )}
                    <div className={`p-4 ${!isExpanded && dayMissions.length > 0 ? 'hidden' : ''}`}>
                      <div className="relative h-12 bg-slate-100 rounded overflow-hidden">
                        {dayMissions.length === 0 && (
                          <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-sm">
                            Aucune mission planifiée
                          </div>
                        )}
                        
                        {dayMissions.map((mission, idx) => {
                          const startHour = parseInt(mission.startTime.split(':')[0]);
                          const endHour = parseInt(mission.endTime.split(':')[0]);
                          const leftPercent = ((startHour - 8) / 9) * 100;
                          const widthPercent = ((endHour - startHour) / 9) * 100;
                          
                          return (
                            <div
                              key={mission.id || idx}
                              className="absolute top-1 bottom-1 bg-pink-100 border border-pink-300 rounded flex items-center px-2 overflow-hidden"
                              style={{
                                left: `${Math.max(0, leftPercent)}%`,
                                width: `${Math.min(100 - leftPercent, widthPercent)}%`
                              }}
                            >
                              <span className="text-xs font-bold text-pink-700 truncate">
                                {mission.clientName || mission.service}
                              </span>
                              <span className="text-xs text-pink-500 ml-1">
                                {mission.startTime}-{mission.endTime}
                              </span>
                            </div>
                          );
                        })}
                        
                        <div className="absolute inset-0 flex pointer-events-none">
                          {[8, 9, 10, 11, 12, 13, 14, 15, 16, 17].map(hour => (
                            <div key={hour} className="flex-1 border-r border-slate-200 last:border-r-0">
                              <span className="text-[10px] text-slate-400 ml-1">{hour}h</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="mt-2 flex items-center gap-2">
                        <div className="flex-1 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-1.5 rounded-full transition-all duration-500 ${totalHours >= 7 ? 'bg-orange-400' : totalHours >= 4 ? 'bg-amber-400' : 'bg-green-400'}`}
                            style={{ width: `${Math.min((totalHours / 7) * 100, 100)}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-slate-400 w-8 text-right">{Math.round((totalHours / 7) * 100)}%</span>
                      </div>

                      {editingNoteId === provider.id ? (
                        <div className="mt-2 flex gap-1">
                          <input
                            autoFocus
                            type="text"
                            placeholder="Note rapide..."
                            defaultValue={providerNotes[provider.id] || ''}
                            onBlur={e => { setProviderNotes(prev => ({ ...prev, [provider.id]: e.target.value })); setEditingNoteId(null); }}
                            onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setEditingNoteId(null); }}
                            className="flex-1 text-xs border border-blue-300 rounded px-2 py-1 focus:outline-none focus:border-blue-500"
                          />
                        </div>
                      ) : (
                        <div
                          className="mt-1 cursor-pointer group"
                          onClick={() => setEditingNoteId(provider.id)}
                        >
                          {providerNotes[provider.id] ? (
                            <p className="text-xs text-slate-500 italic group-hover:text-blue-500 transition truncate">📝 {providerNotes[provider.id]}</p>
                          ) : (
                            <p className="text-[10px] text-slate-300 group-hover:text-slate-400 transition">+ Note...</p>
                          )}
                        </div>
                      )}
                    </div>
                    </div>
                  </div>
                );
              })}
              
              {!isLoading && availableProviders.length === 0 && (
                <div className="text-center py-12 text-slate-400">
                  <Calendar className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>Aucune prestataire disponible ce jour</p>
                </div>
              )}
              {!isLoading && availableProviders.length > 0 && filteredProviders.length === 0 && (
                <div className="text-center py-10 text-slate-400">
                  <Search className="w-10 h-10 mx-auto mb-2 opacity-40" />
                  <p className="font-medium">Aucun prestataire ne correspond aux filtres</p>
                  <button
                    onClick={() => { setSearchQuery(''); setStatusFilter('all'); setTimeSlotFilter('all'); setSpecialtyFilter('all'); }}
                    className="mt-3 text-sm text-blue-500 underline hover:text-blue-700"
                  >
                    Effacer les filtres
                  </button>
                </div>
              )}
            </div></>)}
          </div>
        </div>
      </div>

      {showBillingPanel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-slate-200">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <FileText className="w-5 h-5 text-purple-600" />
                Suivi Facturation
                <span className="text-sm font-medium bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                  {filteredBillingAnalysis.length} dossier{filteredBillingAnalysis.length !== 1 ? 's' : ''}
                </span>
              </h3>
              <button
                onClick={() => { setShowBillingPanel(false); setBillingSearch(''); }}
                className="p-1.5 hover:bg-slate-100 rounded-lg transition"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <div className="px-5 pt-4 pb-2">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Rechercher un client..."
                  value={billingSearch}
                  onChange={e => setBillingSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="p-5 overflow-y-auto flex-1 space-y-5">
              {billingAnalysis.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="font-medium">Aucune facturation en attente</p>
                </div>
              ) : (
                <>
                  {completeBillings.length > 0 && (
                    <div>
                      <h4 className="text-sm font-bold text-purple-700 mb-3 flex items-center gap-2">
                        <span className="w-2.5 h-2.5 bg-purple-500 rounded-full"></span>
                        Pack ultime — Facturation complète ({completeBillings.length})
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {completeBillings.map(billing => (
                          <div key={billing.documentId} className="bg-purple-50 border border-purple-200 rounded-xl px-4 py-3">
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <span className="text-sm font-bold text-purple-800">{billing.clientName}</span>
                              <span className="text-xs bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full font-bold">
                                {billing.completedMissions}/{billing.totalMissions} missions
                              </span>
                            </div>
                            <button
                              onClick={() => {
                                if (convertQuoteToInvoice) {
                                  convertQuoteToInvoice(billing.documentId).then(() => {
                                    setToast({ type: 'success', message: '✅ Facture créée avec succès' });
                                  }).catch(() => {
                                    setToast({ type: 'error', message: '❌ Erreur lors de la création de la facture' });
                                  });
                                } else {
                                  setToast({ type: 'info', message: '📄 Conversion devis → facture' });
                                }
                              }}
                              className="w-full text-sm bg-purple-500 text-white px-3 py-1.5 rounded-lg font-bold hover:bg-purple-600 transition"
                            >
                              Émettre la facture
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {partialBillings.length > 0 && (
                    <div>
                      <h4 className="text-sm font-bold text-blue-700 mb-3 flex items-center gap-2">
                        <span className="w-2.5 h-2.5 bg-blue-500 rounded-full"></span>
                        Facturation partielle ({partialBillings.length})
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {partialBillings.map(billing => (
                          <div key={billing.documentId} className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <span className="text-sm font-bold text-blue-800">{billing.clientName}</span>
                              <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-bold">
                                {billing.completedMissions}/{billing.totalMissions} missions
                              </span>
                            </div>
                            <button
                              onClick={() => {
                                if (updateDocumentStatus) {
                                  updateDocumentStatus(billing.documentId, 'sent').then(() => {
                                    setToast({ type: 'success', message: '✅ Document marqué comme envoyé' });
                                  }).catch(() => {
                                    setToast({ type: 'error', message: '❌ Erreur lors de la mise à jour' });
                                  });
                                } else if (markInvoicePaid) {
                                  markInvoicePaid(billing.documentId).then(() => {
                                    setToast({ type: 'success', message: '✅ Marque comme payé' });
                                  }).catch(() => {
                                    setToast({ type: 'error', message: '❌ Erreur' });
                                  });
                                } else {
                                  setToast({ type: 'info', message: '📄 Facturation partielle' });
                                }
                              }}
                              className="w-full text-sm bg-blue-500 text-white px-3 py-1.5 rounded-lg font-bold hover:bg-blue-600 transition"
                            >
                              Facturation partielle
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button
                onClick={() => setShowBillingPanel(false)}
                className="text-sm text-slate-600 bg-white border border-slate-200 px-4 py-2 rounded-lg hover:bg-slate-100 transition font-medium"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {(dayStats.unassignedCount + provisionalMissionsForDay.length) > 0 && !showUnassignedPanel && !showBillingPanel && (
        <button
          onClick={() => setShowUnassignedPanel(true)}
          className="fixed bottom-20 right-4 bg-orange-500 text-white px-4 py-2 rounded-full shadow-lg text-sm font-bold flex items-center gap-2 hover:bg-orange-600 transition z-40 animate-bounce"
        >
          <Users className="w-4 h-4" />
          {dayStats.unassignedCount + provisionalMissionsForDay.length} à assigner aujourd'hui !
        </button>
      )}

      <button
        onClick={() => setShowBillingPanel(true)}
        className="fixed bottom-4 right-4 bg-slate-800 text-white px-4 py-2 rounded-full shadow-lg text-sm font-bold flex items-center gap-2 hover:bg-slate-700 transition z-30"
      >
        <span className={`w-2 h-2 rounded-full ${billingAnalysis.length > 0 ? 'bg-green-400 animate-pulse' : 'bg-slate-500'}`}></span>
        Facturation
        {billingAnalysis.length > 0 && (
          <span className="bg-green-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full leading-none">
            {billingAnalysis.length}
          </span>
        )}
      </button>

      {showUnassignedPanel && (
        <div className="fixed inset-0 z-50 flex bg-slate-900/50 backdrop-blur-sm">
          <div className="hidden sm:flex flex-1" onClick={() => { setShowUnassignedPanel(false); setPanelSearch(''); setQuickAssignMission(null); }} />
          <div className="w-full sm:max-w-md bg-white h-full overflow-hidden flex flex-col shadow-2xl">
            <div className="p-4 border-b border-slate-200 bg-gradient-to-r from-amber-50 to-orange-50">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-lg font-bold text-amber-800">🗓 Missions à assigner</h3>
                  <p className="text-xs text-amber-600">
                    {allFutureUnassigned.list.length} mission{allFutureUnassigned.list.length !== 1 ? 's' : ''} en attente
                    {dayStats.unassignedCount > 0 && <span className="ml-1 text-red-600 font-bold">· {dayStats.unassignedCount} urgent{dayStats.unassignedCount > 1 ? 'es' : 'e'} aujourd'hui</span>}
                  </p>
                </div>
                <button onClick={() => { setShowUnassignedPanel(false); setPanelSearch(''); setQuickAssignMission(null); }} className="p-2 hover:bg-amber-100 rounded-lg transition">
                  <X className="w-5 h-5 text-amber-700" />
                </button>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Rechercher un client, service..."
                  value={panelSearch}
                  onChange={e => setPanelSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-amber-200 rounded-lg bg-white focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {(() => {
                const q = panelSearch.toLowerCase();
                const filteredGrouped = Object.entries(allFutureUnassigned.grouped)
                  .map(([date, ms]) => [date, q ? ms.filter(m => m.clientName.toLowerCase().includes(q) || (m.service || '').toLowerCase().includes(q) || (m.serviceType || '').toLowerCase().includes(q)) : ms] as [string, Mission[]])
                  .filter(([, ms]) => ms.length > 0);
                if (allFutureUnassigned.list.length === 0) return (
                  <div className="text-center py-12">
                    <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
                    <p className="text-slate-600 font-bold">Toutes les missions sont assignées !</p>
                    <p className="text-slate-400 text-xs mt-1">Excellent travail 🎉</p>
                  </div>
                );
                if (filteredGrouped.length === 0) return (
                  <div className="text-center py-8">
                    <Search className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                    <p className="text-slate-400 text-sm">Aucun résultat pour "{panelSearch}"</p>
                  </div>
                );
                return filteredGrouped.map(([date, dayMissions]) => (
                  <div key={date}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-bold text-slate-500 uppercase">
                        {dayjs(date).format('dddd D MMMM')}
                      </span>
                      <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-bold">{dayMissions.length}</span>
                    </div>
                    <div className="space-y-2">
                      {dayMissions.map(m => (
                        <div key={m.id} className={`border rounded-xl p-3 transition-all ${quickAssignMission?.id === m.id ? 'border-blue-400 bg-blue-50 shadow-md' : 'border-slate-200 bg-white hover:border-amber-300 hover:shadow-sm'}`}>
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-sm text-slate-800 truncate">{m.clientName}</p>
                              <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                                <span className="text-xs text-slate-500">{m.service || m.serviceType || '—'}</span>
                                {m.startTime && m.endTime && (
                                  <span className="text-xs font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">⏰ {m.startTime}–{m.endTime}</span>
                                )}
                              </div>
                            </div>
                            <button
                              onClick={() => { setCurrentDate(dayjs(date)); setQuickAssignMission(m); setQuickAssignProviderId(''); }}
                              className="shrink-0 text-xs bg-blue-500 text-white px-2.5 py-1.5 rounded-lg font-bold hover:bg-blue-600 transition active:scale-95"
                            >
                              Assigner
                            </button>
                          </div>
                          {quickAssignMission?.id === m.id && (
                            <div className="mt-3 space-y-2">
                              {(() => {
                                const mDate = m.date;
                                const mStart = m.startTime || '';
                                const mEnd = m.endTime || '';
                                const mDayOfWeek = dayjs(mDate).day();
                                const st = ((m as any).serviceType || m.service || '').toLowerCase();

                                const getName = (p: Provider) => {
                                  const pa = p as any;
                                  const first = (pa.firstName || pa.first_name || '').toString().trim();
                                  const last = (pa.lastName || pa.last_name || '').toString().trim();
                                  const n = [first, last].filter(s => s.length > 0).join(' ');
                                  if (n) return p.specialty ? `${n} — ${p.specialty}` : n;
                                  if (pa.name && pa.name.toString().trim()) return pa.name.toString().trim();
                                  const id = pa.phone ? pa.phone : pa.email ? pa.email.split('@')[0] : null;
                                  const spec = p.specialty || 'Prestataire';
                                  return id ? `${spec} · ${id}` : spec;
                                };

                                const matchesSpecialty = (p: Provider) => {
                                  const sp = p.specialty?.toLowerCase() || '';
                                  if (!sp || !st) return true;
                                  if (st.includes('ménage') || st.includes('menage')) return sp.includes('ménage') || sp.includes('menage') || sp.includes('entretien');
                                  if (st.includes('jardinage')) return sp.includes('jardin');
                                  if (st.includes('bricolage')) return sp.includes('bricolage');
                                  return true;
                                };

                                const available: Provider[] = [];
                                const busyList: Array<{ provider: Provider; reason: string }> = [];
                                const unavailList: Array<{ provider: Provider; reason: string }> = [];

                                providers.filter(matchesSpecialty).forEach(p => {
                                  if (p.status === 'Inactive' || p.status === 'Passive') return;
                                  const nonDays: number[] = (p as any).nonInterventionDays || [];
                                  if (nonDays.includes(mDayOfWeek)) {
                                    unavailList.push({ provider: p, reason: 'Repos ce jour' });
                                    return;
                                  }
                                  if (mStart && mEnd) {
                                    const conflict = missions.find(ex =>
                                      ex.providerId === p.id &&
                                      ex.date === mDate &&
                                      ex.status !== 'cancelled' &&
                                      ex.id !== m.id &&
                                      ex.startTime < mEnd &&
                                      ex.endTime > mStart
                                    );
                                    if (conflict) {
                                      busyList.push({ provider: p, reason: `Occupé ${conflict.startTime}–${conflict.endTime}` });
                                      return;
                                    }
                                  }
                                  available.push(p);
                                });

                                return (
                                  <select
                                    value={quickAssignProviderId}
                                    onChange={e => setQuickAssignProviderId(e.target.value)}
                                    className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 bg-white"
                                  >
                                    <option value="">— Choisir un prestataire —</option>
                                    {available.length > 0 && (
                                      <optgroup label={`✅ Disponibles (${available.length})`}>
                                        {available.map(p => (
                                          <option key={p.id} value={p.id}>
                                            {getName(p)}
                                          </option>
                                        ))}
                                      </optgroup>
                                    )}
                                    {busyList.length > 0 && (
                                      <optgroup label={`⚠ Occupés à cette heure (${busyList.length})`}>
                                        {busyList.map(({ provider: p, reason }) => (
                                          <option key={p.id} value={p.id} disabled>
                                            {getName(p)} · {reason}
                                          </option>
                                        ))}
                                      </optgroup>
                                    )}
                                    {unavailList.length > 0 && (
                                      <optgroup label={`🚫 Indisponibles ce jour (${unavailList.length})`}>
                                        {unavailList.map(({ provider: p, reason }) => (
                                          <option key={p.id} value={p.id} disabled>
                                            {getName(p)} · {reason}
                                          </option>
                                        ))}
                                      </optgroup>
                                    )}
                                    {available.length === 0 && (
                                      <option value="" disabled>Aucun prestataire libre à cette heure</option>
                                    )}
                                  </select>
                                );
                              })()}
                              <div className="flex gap-2">
                                <button
                                  onClick={handleQuickAssign}
                                  disabled={!quickAssignProviderId}
                                  className="flex-1 flex items-center justify-center gap-1.5 text-sm bg-green-500 text-white px-3 py-2 rounded-lg font-bold hover:bg-green-600 disabled:opacity-40 transition active:scale-95"
                                >
                                  <CheckCircle className="w-4 h-4" /> Confirmer
                                </button>
                                <button
                                  onClick={() => setQuickAssignMission(null)}
                                  className="text-sm bg-slate-100 text-slate-500 px-3 py-2 rounded-lg hover:bg-slate-200 transition"
                                >
                                  Annuler
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ));
              })()}
            </div>
          </div>
        </div>
      )}

      {showAssignModal && selectedProviderId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <h3 className="text-lg font-bold text-slate-800">
                Attribuer une mission
              </h3>
              <button
                onClick={() => setShowAssignModal(false)}
                className="p-1 hover:bg-slate-100 rounded"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            
            <div className="p-4 space-y-4 overflow-y-auto max-h-[60vh]">
              {assignError && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {assignError}
                </div>
              )}
              
              {assignSuccess && (
                <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
                  <CheckCircle className="w-4 h-4 flex-shrink-0" />
                  {assignSuccess}
                </div>
              )}
              
              {(() => {
                const provider = providers.find(p => p.id === selectedProviderId);
                const availableMissions = getUnassignedMissionsForProvider(selectedProviderId!, missionDateFilter);
                
                const providerDayMissions = providerMissions.get(selectedProviderId!) || [];
                const pa = provider as any;
                const providerFirst = (pa?.firstName || pa?.first_name || '').toString().trim();
                const providerLast = (pa?.lastName || pa?.last_name || '').toString().trim();
                const providerFullName = [providerFirst, providerLast].filter(s => s.length > 0).join(' ');
                const providerIdFallback = pa?.phone ? pa.phone : pa?.email ? pa.email.split('@')[0] : null;
                const providerSpec = provider?.specialty || 'Prestataire';
                const providerName = providerFullName || (pa?.name?.toString().trim()) || (providerIdFallback ? `${providerSpec} · ${providerIdFallback}` : providerSpec);
                const selectedConflict = selectedMission ? providerDayMissions.find(ex =>
                  ex.date === (selectedMission.date || currentDateStr) &&
                  ex.status !== 'cancelled' &&
                  ex.startTime < (selectedMission.endTime || '99:00') &&
                  ex.endTime > (selectedMission.startTime || '00:00')
                ) : null;

                return (
                  <div className="space-y-4">
                    {/* Provider info + day summary */}
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 rounded-full bg-pink-100 flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-bold text-pink-600">
                            {(provider?.firstName || '')[0]}{(provider?.lastName || '')[0]}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-800">{providerName}</p>
                          {provider?.specialty && <p className="text-xs text-slate-400">{provider.specialty}</p>}
                        </div>
                        <span className="ml-auto text-xs font-bold text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded-full">
                          {providerDayMissions.length} mission{providerDayMissions.length !== 1 ? 's' : ''} ce jour
                        </span>
                      </div>
                      {providerDayMissions.length > 0 ? (
                        <div className="space-y-1">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Planning du {currentDate.format('D/MM')} :</p>
                          {providerDayMissions.map(dm => (
                            <div key={dm.id} className="flex items-center gap-2 text-xs bg-white border border-pink-100 rounded px-2 py-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-pink-400 flex-shrink-0"></span>
                              <span className="font-bold text-pink-700">{dm.startTime}–{dm.endTime}</span>
                              <span className="text-slate-500 truncate">{dm.clientName}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-green-600 font-medium">✓ Libre ce jour</p>
                      )}
                    </div>

                    {selectedConflict && (
                      <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs">
                        <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold">Conflit d'horaire détecté !</p>
                          <p>Ce prestataire a déjà une mission {selectedConflict.startTime}–{selectedConflict.endTime} ({selectedConflict.clientName}) à cette date.</p>
                        </div>
                      </div>
                    )}

                    {/* Date scope filter */}
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Période de recherche</label>
                      <div className="flex gap-1">
                        {(['day', 'future', 'all'] as const).map(mode => (
                          <button
                            key={mode}
                            onClick={() => { setMissionDateFilter(mode); setSelectedMission(null); setSelectedTimeSlot(null); }}
                            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition ${
                              missionDateFilter === mode ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            {mode === 'day' ? `📅 ${currentDate.format('D/MM')}` : mode === 'future' ? '📆 À venir' : '🗂 Toutes'}
                          </button>
                        ))}
                      </div>
                    </div>

                    {availableMissions.length === 0 ? (
                      <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                        <p className="text-sm text-amber-700 font-bold">Aucune mission non assignée</p>
                        <p className="text-xs text-amber-600 mt-1">Spécialité: {provider?.specialty || 'Non définie'}</p>
                        <button
                          onClick={() => { setMissionDateFilter('all'); setSelectedMission(null); }}
                          className="mt-2 text-xs text-blue-600 underline"
                        >Rechercher sur toutes les dates</button>
                      </div>
                    ) : (
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">
                          Missions disponibles ({availableMissions.length})
                        </label>
                        <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                          {availableMissions.map(mission => {
                            const srcDoc = documents.find(d => d.id === mission.sourceDocumentId);
                            const serviceLabel = srcDoc?.serviceType || mission.serviceType || mission.service || '—';
                            return (
                              <button
                                key={mission.id}
                                onClick={() => {
                                  setSelectedMission(mission);
                                  // Auto-select time slot if mission has existing times
                                  if (mission.startTime && mission.endTime) {
                                    const match = TIME_SLOTS.find(s => s.start === mission.startTime && s.end === mission.endTime);
                                    if (match) {
                                      setSelectedTimeSlot(match);
                                      setCustomStartTime('');
                                      setCustomEndTime('');
                                    } else {
                                      setSelectedTimeSlot(null);
                                      setCustomStartTime(mission.startTime);
                                      setCustomEndTime(mission.endTime);
                                    }
                                  }
                                }}
                                className={`w-full p-3 rounded-lg text-left text-sm transition border-2 ${
                                  selectedMission?.id === mission.id
                                    ? 'bg-blue-50 border-blue-500'
                                    : 'bg-white border-slate-200 hover:border-blue-300'
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-slate-800">{mission.clientName}</span>
                                  <span className="text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">{dayjs(mission.date).format('D/MM')}</span>
                                </div>
                                <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                                  <span>{serviceLabel}</span>
                                  {mission.startTime && mission.endTime && (
                                    <span className="text-blue-500 font-medium">{mission.startTime}–{mission.endTime}</span>
                                  )}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {selectedMission && (
                      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-blue-800">📋 {selectedMission.clientName}</span>
                          {selectedMission.date !== currentDateStr && (
                            <span className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-bold">Reprogrammé au {currentDateStr}</span>
                          )}
                        </div>
                        <div className="text-blue-700">{selectedMission.service}{selectedMission.serviceType ? ` · ${selectedMission.serviceType}` : ''}</div>
                        {selectedMission.sourceDocumentId && (
                          <div className="text-blue-500">Devis #{selectedMission.sourceDocumentId.slice(0, 8)}</div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}
              
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  Créneau horaire
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {TIME_SLOTS.map(slot => {
                    const error = validateTimeSlot(selectedProviderId!, slot);
                    const isSelected = selectedTimeSlot?.id === slot.id && !customStartTime;
                    const isDisabled = error !== null;
                    
                    return (
                      <button
                        key={slot.id}
                        onClick={() => { if (!isDisabled) { setSelectedTimeSlot(slot); setCustomStartTime(''); setCustomEndTime(''); } }}
                        disabled={isDisabled}
                        className={`p-2 rounded-lg text-left text-sm transition ${
                          isSelected 
                            ? 'bg-blue-500 text-white border-2 border-blue-600'
                            : isDisabled
                              ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                              : 'bg-slate-50 text-slate-700 border border-slate-200 hover:border-blue-300 hover:bg-blue-50'
                        }`}
                      >
                        <div className="font-bold">{slot.label}</div>
                        {isDisabled && error && (
                          <div className="text-xs mt-1 opacity-75">{error}</div>
                        )}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <label className="block text-xs font-bold text-slate-500 mb-2">Ou horaire personnalisé</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="time"
                      value={customStartTime}
                      onChange={e => { setCustomStartTime(e.target.value); setSelectedTimeSlot(null); }}
                      className="flex-1 text-sm border border-slate-300 rounded px-2 py-1.5 focus:outline-none focus:border-blue-500"
                    />
                    <span className="text-slate-400 text-sm">→</span>
                    <input
                      type="time"
                      value={customEndTime}
                      onChange={e => { setCustomEndTime(e.target.value); setSelectedTimeSlot(null); }}
                      className="flex-1 text-sm border border-slate-300 rounded px-2 py-1.5 focus:outline-none focus:border-blue-500"
                    />
                    {(customStartTime || customEndTime) && (
                      <button onClick={() => { setCustomStartTime(''); setCustomEndTime(''); }} className="text-slate-400 hover:text-red-500">
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  {customStartTime && customEndTime && (
                    <p className="text-xs text-green-600 mt-1 font-medium">
                      ✓ Horaire personnalisé : {customStartTime}–{customEndTime}
                    </p>
                  )}
                </div>
              </div>
              
              <div className="pt-2 border-t border-slate-200">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">Total après attribution:</span>
                  <span className={`font-bold ${
                    selectedTimeSlot 
                      ? getProviderTotalHours(selectedProviderId) + selectedTimeSlot.duration > 7 
                        ? 'text-red-600' 
                        : 'text-green-600'
                      : 'text-slate-800'
                  }`}>
                    {selectedTimeSlot 
                      ? getProviderTotalHours(selectedProviderId) + selectedTimeSlot.duration
                      : getProviderTotalHours(selectedProviderId)
                    }h / 7h
                  </span>
                </div>
              </div>
            </div>
            
            <div className="p-4 border-t border-slate-200 flex gap-3">
              <button
                onClick={() => setShowAssignModal(false)}
                className="flex-1 py-2 px-4 bg-slate-100 text-slate-700 rounded-lg font-bold hover:bg-slate-200 transition"
              >
                Annuler
              </button>
              <button
                onClick={handleConfirmAssignment}
                disabled={!(selectedTimeSlot || (customStartTime && customEndTime)) || !selectedMission || isSubmitting}
                className={`flex-1 py-2 px-4 rounded-lg font-bold transition ${
                  (selectedTimeSlot || (customStartTime && customEndTime)) && selectedMission && !isSubmitting
                    ? 'bg-blue-500 text-white hover:bg-blue-600'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                {isSubmitting ? 'Attribution...' : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showApiSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <h3 className="text-lg font-bold text-slate-800">
                Paramètres API Messages
              </h3>
              <button
                onClick={() => setShowApiSettings(false)}
                className="p-1 hover:bg-slate-100 rounded"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  Fournisseur d'API
                </label>
                <select
                  value={selectedProvider}
                  onChange={(e) => setSelectedProvider(e.target.value as MessageProvider)}
                  className="w-full p-2 border border-slate-300 rounded-lg text-sm"
                >
                  {MESSAGE_PROVIDERS.map(provider => (
                    <option key={provider.id} value={provider.id}>
                      {provider.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-slate-500 mt-1">
                  {MESSAGE_PROVIDERS.find(p => p.id === selectedProvider)?.description}
                </p>
              </div>
              
              {selectedProvider === 'smsmode' && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-700">
                    ✓ API SMSMode intégrée - Les SMS seront envoyés automatiquement en arrière-plan
                  </p>
                </div>
              )}
              
              {selectedProvider === 'custom' && (
                <>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">
                      URL de base de l'API
                    </label>
                    <input
                      type="text"
                      value={customBaseUrl}
                      onChange={(e) => setCustomBaseUrl(e.target.value)}
                      placeholder="https://api.votre-fournisseur.com"
                      className="w-full p-2 border border-slate-300 rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">
                      Clé API
                    </label>
                    <input
                      type="text"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="Votre clé API"
                      className="w-full p-2 border border-slate-300 rounded-lg text-sm"
                    />
                  </div>
                </>
              )}
              
              {selectedProvider === 'wa_me' && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-sm text-green-700">
                    ✓ WhatsApp Web est gratuit et ne nécessite aucune configuration.
                  </p>
                </div>
              )}
            </div>
            
            <div className="p-4 border-t border-slate-200 flex gap-3">
              <button
                onClick={() => setShowApiSettings(false)}
                className="flex-1 py-2 px-4 bg-slate-100 text-slate-700 rounded-lg font-bold hover:bg-slate-200 transition"
              >
                Annuler
              </button>
              <button
                onClick={() => {
                  const config = {
                    provider: selectedProvider,
                    apiKey: apiKey || undefined,
                    baseUrl: customBaseUrl || undefined
                  };
                  setApiConfig(config);
                  
                  if (updateMessageConfig) {
                    updateMessageConfig({
                      messageProvider: selectedProvider,
                      messageApiKey: apiKey || undefined,
                      messageBaseUrl: customBaseUrl || undefined
                    }).then(() => {
                      setToast({ type: 'success', message: '✅ Configuration enregistrée' });
                      setShowApiSettings(false);
                    }).catch(() => {
                      setToast({ type: 'error', message: '❌ Erreur lors de l\'enregistrement' });
                    });
                  } else {
                    setShowApiSettings(false);
                  }
                }}
                className="flex-1 py-2 px-4 bg-blue-500 text-white rounded-lg font-bold hover:bg-blue-600 transition"
              >
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className={`fixed bottom-4 left-1/2 -translate-x-1/2 px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 z-50 ${
          toast.type === 'success' ? 'bg-green-500' : toast.type === 'error' ? 'bg-red-500' : 'bg-blue-500'
        } text-white`}>
          <span>{toast.message}</span>
          {toast.undoAction && (
            <button 
              onClick={() => { toast.undoAction?.(); setToast(null); }}
              className="underline font-bold hover:opacity-80"
            >
              Annuler
            </button>
          )}
          <button onClick={() => setToast(null)} className="ml-2 hover:opacity-80">✕</button>
        </div>
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div className="p-6 text-center">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">🗑️</span>
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-2">
                Supprimer la prestation ?
              </h3>
              <p className="text-sm text-slate-600">
                Supprimer la prestation de <strong>{deleteConfirm.providerName}</strong> sur le créneau <strong>{deleteConfirm.timeSlot}</strong> ?
              </p>
            </div>
            <div className="p-4 border-t border-slate-200 flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 py-2 px-4 bg-slate-100 text-slate-700 rounded-lg font-bold hover:bg-slate-200 transition"
              >
                Annuler
              </button>
              <button
                onClick={() => {
                  setToast({ type: 'info', message: '🗑️ Prestation supprimée' });
                  setDeleteConfirm(null);
                }}
                className="flex-1 py-2 px-4 bg-red-500 text-white rounded-lg font-bold hover:bg-red-600 transition"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}

      {!isLoading && availableProviders.length === 0 && (
        <div className="fixed inset-0 z-40 bg-white/80 flex items-center justify-center">
          <div className="text-center p-8">
            <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Calendar className="w-10 h-10 text-slate-400" />
            </div>
            <h3 className="text-lg font-bold text-slate-700 mb-2">
              Aucune prestataire disponible
            </h3>
            <p className="text-sm text-slate-500 mb-4 max-w-xs">
              Aucune prestataire disponible ce jour. Vérifiez les disponibilités ou sélectionnez une autre date.
            </p>
            <button
              onClick={handleNextDay}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg font-bold hover:bg-blue-600 transition"
            >
              Voir le jour suivant →
            </button>
          </div>
        </div>
      )}

      {showHistory && (
        <div className="fixed inset-y-0 right-0 w-80 bg-white shadow-xl z-40 flex flex-col">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <h3 className="font-bold text-slate-800">Historique du jour</h3>
            <button onClick={() => setShowHistory(false)} className="p-1 hover:bg-slate-100 rounded">
              <X className="w-5 h-5 text-slate-500" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {todayAuditLog.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-8">
                Aucune action enregistrée aujourd'hui
              </p>
            ) : (
              <div className="space-y-3">
                {todayAuditLog.map((entry) => (
                  <div key={entry.id} className="text-sm">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${getActionTypeColor(entry.actionType)}`}>
                        {getActionTypeLabel(entry.actionType)}
                      </span>
                      <span className="text-slate-400 text-xs">
                        {dayjs(entry.timestamp).format('HH:mm')}
                      </span>
                    </div>
                    <p className="text-slate-700">
                      {entry.actionType === 'mission_added' && `Prestation ajoutée pour ${entry.providerName} (${entry.newValue})`}
                      {entry.actionType === 'mission_modified' && `Modification: ${entry.previousValue} → ${entry.newValue}`}
                      {entry.actionType === 'mission_deleted' && `Prestation supprimée pour ${entry.providerName}`}
                      {entry.actionType === 'day_closed' && `Jour clos pour ${entry.providerName}`}
                      {entry.actionType === 'day_reopened' && `Jour rouvert pour ${entry.providerName}`}
                      {entry.actionType === 'whatsapp_sent' && `WhatsApp envoyé à ${entry.providerName}`}
                      {entry.actionType === 'exception_forced' && `⚠️ Exception forcée: ${entry.newValue}`}
                    </p>
                    {entry.clientName && (
                      <p className="text-slate-500 text-xs mt-1">Client: {entry.clientName}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NewPlanningView;
