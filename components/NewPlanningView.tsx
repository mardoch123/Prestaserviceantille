import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Calendar, ArrowLeft, Sun, Sunset, Clock, Plus, X, AlertCircle, CheckCircle, Send, Settings, Search, Grid3X3, FileText, Download, Printer, Link, History, Users } from 'lucide-react';
import dayjs from 'dayjs';
import { getMartiniqueNow as getMartiniqueNowDayjs, MARTINIQUE_TIMEZONE } from '../src/utils/dayjsMartinique';
import { Provider, Mission } from '../types';
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
  convertQuoteToInvoice?: (quoteId: string) => Promise<void>;
  markInvoicePaid?: (id: string) => Promise<void>;
  updateDocumentStatus?: (id: string, status: string) => Promise<{ success: boolean; status: string }>;
  updateMessageConfig?: (config: { messageProvider?: 'smsmode' | 'wa_me' | 'custom'; messageApiKey?: string; messageBaseUrl?: string }) => Promise<void>;
}

const NewPlanningView: React.FC<NewPlanningViewProps> = ({ 
  onSwitchToOldVersion, 
  providers, 
  missions,
  documents = [],
  addMission,
  convertQuoteToInvoice,
  markInvoicePaid,
  updateDocumentStatus,
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
  const [showBillingPanel, setShowBillingPanel] = useState(true);
  const [showApiSettings, setShowApiSettings] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<MessageProvider>(getApiConfig().provider);
  const [apiKey, setApiKey] = useState(getApiConfig().apiKey || '');
  const [customBaseUrl, setCustomBaseUrl] = useState(getApiConfig().baseUrl || '');
  const [statusFilter, setStatusFilter] = useState<'all' | 'unplanned' | 'planned' | 'available'>('all');
  const [timeSlotFilter, setTimeSlotFilter] = useState<'all' | 'morning' | 'afternoon' | 'full'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showWeeklyView, setShowWeeklyView] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'info'; message: string; undoAction?: () => void } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ missionId: string; providerName: string; timeSlot: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [smsSending, setSmsSending] = useState<{ current: number; total: number } | null>(null);
  const [sentMessages, setSentMessages] = useState<Set<string>>(new Set());

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
                <td>${p.provider.firstName} ${p.provider.lastName}</td>
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
    setCurrentDate(prev => prev.subtract(1, 'day'));
    setSelectedProviderId(null);
    setShowAssignModal(false);
    setSentMessages(new Set());
  };
  
  const handleNextDay = () => {
    setCurrentDate(prev => prev.add(1, 'day'));
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

  const isDataReady = providers.length > 0 || missions.length > 0;
  
  React.useEffect(() => {
    if (!isDataReady) {
      setIsLoading(true);
    } else {
      setIsLoading(true);
      const timer = setTimeout(() => setIsLoading(false), 600);
      return () => clearTimeout(timer);
    }
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
        return { available: false, reason: 'Pas de disponibilité' };
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

  const { availableProviders, unavailableProviders } = useMemo(() => {
    const available: { provider: Provider; availability: ReturnType<typeof getProviderAvailabilityForDay> }[] = [];
    const unavailable: { provider: Provider; reason: string }[] = [];
    
    providers.forEach(provider => {
      if (provider.status === 'Inactive' || provider.status === 'Passive') {
        unavailable.push({ provider, reason: 'Inactive' });
        return;
      }
      
      const availability = getProviderAvailabilityForDay(provider);
      if (availability.available) {
        available.push({ provider, availability });
      } else {
        unavailable.push({ provider, reason: availability.reason || 'Indisponible' });
      }
    });
    
    return { availableProviders: available, unavailableProviders: unavailable };
  }, [providers, dayOfWeek]);

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
    return (providerId: string): Mission[] => {
      const provider = providers.find(p => p.id === providerId);
      const specialty = provider?.specialty?.toLowerCase() || '';
      
      return missions.filter(m => {
        const isUnassigned = !m.providerId || m.providerId === 'null';
        const isSameDate = m.date === currentDateStr;
        const isNotCancelled = m.status !== 'cancelled';
        
        if (!isUnassigned || !isSameDate || !isNotCancelled) return false;
        
        // Get service type from the linked quote (devis)
        const sourceDoc = documents.find(d => d.id === m.sourceDocumentId);
        const missionServiceType = (sourceDoc?.serviceType || sourceDoc?.description || m.serviceType || m.service || '').toLowerCase();
        
        if (specialty.includes('jardinage') || specialty.includes('jardin')) {
          return missionServiceType.includes('jardinage') || missionServiceType.includes('jardin');
        }
        if (specialty.includes('ménage') || specialty.includes('menage')) {
          return missionServiceType.includes('ménage') || missionServiceType.includes('menage');
        }
        if (specialty.includes('bricolage')) {
          return missionServiceType.includes('bricolage');
        }
        
        return true;
      });
    };
  }, [missions, currentDateStr, providers, documents]);

  const filteredProviders = useMemo(() => {
    let filtered = availableProviders;
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(({ provider }) => 
        provider.firstName.toLowerCase().includes(query) ||
        provider.lastName.toLowerCase().includes(query)
      );
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
    
    return filtered;
  }, [availableProviders, providerMissions, searchQuery, statusFilter, timeSlotFilter]);

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
      if (data.completed >= 2) {
        result.push({
          documentId: docId,
          clientName: data.clientName,
          totalMissions: data.total,
          completedMissions: data.completed,
          status: data.completed >= data.total && data.total >= 6 ? 'complete' : 'partial',
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

  const partialBillings = billingAnalysis.filter(b => b.status === 'partial');
  const completeBillings = billingAnalysis.filter(b => b.status === 'complete');

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
      case 'available': return 'bg-green-50 border-green-200';
      case 'almost': return 'bg-amber-50 border-amber-200';
      case 'full': return 'bg-orange-50 border-orange-200';
      case 'closed': return 'bg-cyan-50 border-cyan-200';
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
    setShowAssignModal(true);
  };

  const handleConfirmAssignment = async () => {
    if (!selectedProviderId || !selectedTimeSlot || !selectedMission) return;
    
    const error = validateTimeSlot(selectedProviderId, selectedTimeSlot);
    if (error) {
      setAssignError(error);
      return;
    }
    
    setIsSubmitting(true);
    setAssignError(null);
    
    try {
      const provider = providers.find(p => p.id === selectedProviderId);
      
      if (addMission) {
        const newMission: Mission = {
          ...selectedMission,
          id: '',
          providerId: selectedProviderId,
          providerName: `${provider?.firstName} ${provider?.lastName}`,
          date: currentDateStr,
          startTime: selectedTimeSlot.start,
          endTime: selectedTimeSlot.end,
          duration: selectedTimeSlot.duration,
          status: 'planned',
          color: 'blue'
        };
        
        await addMission(newMission);
        setToast({ type: 'success', message: `✅ Prestation ajoutée avec succès pour ${provider?.firstName}` });
        setSelectedTimeSlot(null);
        setSelectedMission(null);
        
        setTimeout(() => {
          setShowAssignModal(false);
        }, 1500);
      } else {
        setToast({ type: 'success', message: '✅ Prestation attribuée (mode simulation)' });
        setTimeout(() => {
          setShowAssignModal(false);
        }, 1500);
      }
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
              className={`px-4 py-1.5 rounded-full text-sm font-bold transition ${
                isToday 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
              }`}
            >
              Aujourd'hui
            </button>
            <span className="text-lg font-bold text-slate-800 px-2">
              {currentDate.format('D MMMM')}
            </span>
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
              className="md:hidden p-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition"
              title="Afficher les prestataires"
            >
              <Users className="w-4 h-4" />
            </button>
          </div>
        </div>
        
        {showWeeklyView && (
          <div className="mt-3 pt-3 border-t border-slate-200">
            <div className="grid grid-cols-7 gap-2">
              {weeklyStats.days.map((day, idx) => {
                const isCurrentDay = day.date === currentDateStr;
                const colorClass = day.totalHours >= 7 ? 'bg-orange-100 border-orange-300' : 
                                  day.totalHours >= 4 ? 'bg-amber-100 border-amber-300' :
                                  day.totalHours > 0 ? 'bg-green-100 border-green-300' :
                                  'bg-slate-100 border-slate-200';
                
                return (
                  <button
                    key={day.date}
                    onClick={() => setCurrentDate(dayjs(day.date))}
                    className={`p-2 rounded-lg border-2 text-center transition ${colorClass} ${isCurrentDay ? 'ring-2 ring-blue-500' : 'hover:border-slate-400'}`}
                  >
                    <div className="text-xs font-bold text-slate-600">{day.dayName}</div>
                    <div className="text-lg font-bold text-slate-800">{dayjs(day.date).format('D')}</div>
                    <div className="text-xs text-slate-500">{day.missions.length} miss.</div>
                    <div className="text-xs font-medium text-slate-600">{day.totalHours}h</div>
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
              <h2 className="text-lg font-bold text-slate-800">
                {currentDate.format('dddd D MMMM')}
              </h2>
              <div className="flex items-center gap-3 text-xs">
                <span className="text-slate-500 font-bold">Légende:</span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 bg-green-100 border border-green-300 rounded"></span>
                  Dispo
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 bg-amber-100 border border-amber-300 rounded"></span>
                  Presque plein
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 bg-orange-100 border border-orange-300 rounded"></span>
                  Plein
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 bg-cyan-100 border border-cyan-300 rounded"></span>
                  Clos
                </span>
                <span className="flex items-center gap-1 ml-2 pl-2 border-l border-slate-300">
                  <span className="w-3 h-3 bg-pink-100 border border-pink-300 rounded"></span>
                  Mission
                </span>
              </div>
            </div>
            
            <div className="space-y-3">
              {filteredProviders.map(({ provider, availability }) => {
                const dayMissions = providerMissions.get(provider.id) || [];
                const totalHours = getProviderTotalHours(provider.id);
                const availableSlots = getAvailableTimeSlots(provider.id);
                const colorStatus = getDayColorStatus(provider.id);
                const colorClasses = getDayColorClasses(colorStatus);
                const isClosed = colorStatus === 'closed';
                
                return (
                  <div key={provider.id} className={`border-2 rounded-lg overflow-hidden ${colorClasses}`}>
                    <div className="px-4 py-2 flex items-center justify-between bg-white/50">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-pink-100 flex items-center justify-center">
                          <span className="text-xs font-bold text-pink-600">
                            {(provider.firstName || '')[0]}{(provider.lastName || '')[0]}
                          </span>
                        </div>
                        <div>
                          <p className="font-bold text-sm text-slate-800">
                            {provider.firstName} {provider.lastName}
                          </p>
                          <p className="text-xs text-slate-500">
                            {totalHours}h / 7h
                          </p>
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
                              ? 'bg-cyan-200 text-cyan-800 hover:bg-cyan-300' 
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
                    
                    <div className="p-4 bg-white">
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
            </div>
          </div>
        </div>
      </div>

      {showBillingPanel && (
        <div className="flex-shrink-0 border-t border-slate-200 bg-slate-50 p-4 max-h-48 overflow-y-auto">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
              <span className="text-xs bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full">
                {billingAnalysis.length}
              </span>
              Suivi Facturation
            </h3>
            <button
              onClick={() => setShowBillingPanel(false)}
              className="text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          
          {billingAnalysis.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-2">
              Aucune facturation en attente
            </p>
          ) : (
            <div className="space-y-2">
              {completeBillings.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-purple-700 mb-1 flex items-center gap-1">
                    <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
                    Pack ultime — Facturation complète ({completeBillings.length})
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {completeBillings.map(billing => (
                      <div key={billing.documentId} className="bg-purple-50 border border-purple-200 rounded-lg px-3 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-purple-800">{billing.clientName}</span>
                          <span className="text-xs text-purple-600">{billing.completedMissions}/{billing.totalMissions}</span>
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
                          className="mt-1 w-full text-xs bg-purple-500 text-white px-2 py-1 rounded font-bold hover:bg-purple-600 transition"
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
                  <h4 className="text-xs font-bold text-blue-700 mb-1 flex items-center gap-1">
                    <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                    Facturation partielle ({partialBillings.length})
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {partialBillings.map(billing => (
                      <div key={billing.documentId} className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-blue-800">{billing.clientName}</span>
                          <span className="text-xs text-blue-600">{billing.completedMissions}/{billing.totalMissions}</span>
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
                          className="mt-1 w-full text-xs bg-blue-500 text-white px-2 py-1 rounded font-bold hover:bg-blue-600 transition"
                        >
                          Facturation partielle
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {!showBillingPanel && (
        <button
          onClick={() => setShowBillingPanel(true)}
          className="fixed bottom-4 right-4 bg-slate-800 text-white px-4 py-2 rounded-full shadow-lg text-sm font-bold flex items-center gap-2 hover:bg-slate-700 transition"
        >
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
          Facturation ({billingAnalysis.length})
        </button>
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
                const availableMissions = getUnassignedMissionsForProvider(selectedProviderId);
                
                if (availableMissions.length === 0) {
                  return (
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                      <p className="text-sm text-amber-700 font-bold">Aucune mission disponible pour ce prestataire</p>
                      <p className="text-xs text-amber-600 mt-1">
                        Spécialité du prestataire: {provider?.specialty || 'Non définie'}
                      </p>
                    </div>
                  );
                }
                
                return (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">
                        Missions disponibles ({availableMissions.length})
                      </label>
                      <div className="space-y-2 max-h-40 overflow-y-auto">
                        {availableMissions.map((mission, idx) => (
                          <button
                            key={mission.id}
                            onClick={() => setSelectedMission(mission)}
                            className={`w-full p-3 rounded-lg text-left text-sm transition border-2 ${
                              selectedMission?.id === mission.id
                                ? 'bg-blue-50 border-blue-500'
                                : 'bg-white border-slate-200 hover:border-blue-300'
                            }`}
                          >
                            <div className="font-bold text-slate-800">{mission.clientName}</div>
                            <div className="text-xs text-slate-500">{mission.service} {mission.serviceType && `• ${mission.serviceType}`}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                    
                    {selectedMission && (
                      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                        <h4 className="text-sm font-bold text-blue-800 mb-3">Informations du client</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex items-start gap-2">
                            <span className="font-medium text-blue-700">Client:</span>
                            <span className="text-blue-900">{selectedMission.clientName}</span>
                          </div>
                          <div className="flex items-start gap-2">
                            <span className="font-medium text-blue-700">Service:</span>
                            <span className="text-blue-900">{selectedMission.service}</span>
                          </div>
                          {selectedMission.serviceType && (
                            <div className="flex items-start gap-2">
                              <span className="font-medium text-blue-700">Type:</span>
                              <span className="text-blue-900">{selectedMission.serviceType}</span>
                            </div>
                          )}
                          {selectedMission.sourceDocumentId && (
                            <div className="flex items-start gap-2">
                              <span className="font-medium text-blue-700">Devis:</span>
                              <span className="text-blue-900 font-mono text-xs">{selectedMission.sourceDocumentId.slice(0, 8)}...</span>
                            </div>
                          )}
                        </div>
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
                    const error = validateTimeSlot(selectedProviderId, slot);
                    const isSelected = selectedTimeSlot?.id === slot.id;
                    const isDisabled = error !== null;
                    
                    return (
                      <button
                        key={slot.id}
                        onClick={() => !isDisabled && setSelectedTimeSlot(slot)}
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
                disabled={!selectedTimeSlot || !selectedMission || isSubmitting}
                className={`flex-1 py-2 px-4 rounded-lg font-bold transition ${
                  selectedTimeSlot && selectedMission && !isSubmitting
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
