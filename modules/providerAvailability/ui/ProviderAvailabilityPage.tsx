import React, { useState, useEffect, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Clock,
  Users,
  Filter,
  Search,
  Plus,
  X,
  CheckCircle2,
  AlertCircle,
  Briefcase,
  User,
  Check,
  ArrowRight,
  MapPin,
  CalendarDays,
  Smartphone,
} from 'lucide-react';
import type {
  ProviderWithAvailability,
  ViewMode,
  ProviderDomain,
  ProviderAvailabilityStatus,
  UnassignedMission,
} from '../types';
import {
  getProvidersWithAvailability,
  getUnassignedMissions,
  assignMissionToProvider,
} from '../client';
import { useData } from '../../../context/DataContext';

const domains: { value: ProviderDomain | 'all'; label: string; color: string }[] = [
  { value: 'all', label: 'Tous', color: 'bg-slate-500' },
  { value: 'Ménage', label: 'Ménage', color: 'bg-blue-500' },
  { value: 'Jardinage', label: 'Jardinage', color: 'bg-green-500' },
  { value: 'Bricolage', label: 'Bricolage', color: 'bg-orange-500' },
  { value: 'Autre', label: 'Autre', color: 'bg-purple-500' },
];

const statusConfig: Record<ProviderAvailabilityStatus, { label: string; color: string; bgColor: string; icon: React.ReactNode; borderColor: string }> = {
  available: {
    label: 'Libre',
    color: 'text-green-700',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    icon: <CheckCircle2 className="w-4 h-4" />,
  },
  busy: {
    label: 'Occupé',
    color: 'text-orange-700',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
    icon: <Clock className="w-4 h-4" />,
  },
  leave: {
    label: 'Congé',
    color: 'text-red-700',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    icon: <AlertCircle className="w-4 h-4" />,
  },
  unavailable: {
    label: 'Repos',
    color: 'text-slate-700',
    bgColor: 'bg-slate-100',
    borderColor: 'border-slate-200',
    icon: <X className="w-4 h-4" />,
  },
};

const weekDays = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
const weekDaysFull = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const monthNames = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

export const ProviderAvailabilityPage: React.FC = () => {
  const { providers: allProviders, missions: allMissions } = useData();
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [domainFilter, setDomainFilter] = useState<ProviderDomain | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedProvider, setSelectedProvider] = useState<ProviderWithAvailability | null>(null);
  const [selectedDateForAssignment, setSelectedDateForAssignment] = useState<string | null>(null);
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);
  const [unassignedMissions, setUnassignedMissions] = useState<UnassignedMission[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState<string | null>(null);
  const [selectedMissionId, setSelectedMissionId] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [modalSearchQuery, setModalSearchQuery] = useState('');

  // Calculate date range based on view mode
  const dateRange = useMemo(() => {
    const start = new Date(selectedDate);
    const end = new Date(selectedDate);

    switch (viewMode) {
      case 'day':
      case 'hourly':
        // Hourly view shows a single day
        break;
      case 'week':
        start.setDate(start.getDate() - start.getDay());
        end.setDate(end.getDate() + (6 - end.getDay()));
        break;
      case 'month':
        start.setDate(1);
        end.setMonth(end.getMonth() + 1);
        end.setDate(0);
        break;
    }

    // Use local date formatting to avoid UTC conversion issues
    const formatLocalDate = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    return {
      start: formatLocalDate(start),
      end: formatLocalDate(end),
      startDate: start,
      endDate: end,
    };
  }, [selectedDate, viewMode]);

  // Load data - only when date range changes, not when providers/missions change
  useEffect(() => {
    loadData();
  }, [dateRange.start, dateRange.end]);

  const loadData = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      // Fetch unassigned missions for the date range
      const missions = await getUnassignedMissions(dateRange.start, dateRange.end);
      setUnassignedMissions(missions);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  // Helper: Check if a given time falls within any of the time ranges
  const isTimeInRanges = (hour: number, ranges?: Array<{ start: string; end: string }>): boolean => {
    if (!ranges || ranges.length === 0) return false;
    return ranges.some(range => {
      const startHour = parseInt(range.start?.split(':')[0] || '0');
      const endHour = parseInt(range.end?.split(':')[0] || '0');
      return hour >= startHour && hour < endHour;
    });
  };

  // Helper: Get available hours for a provider on a specific day
  const getProviderAvailableHours = (provider: any, dayOfWeek: number): number[] => {
    const availabilityMode = provider.availabilityMode || 'unavailable';
    const availabilityHours = provider.availabilityHours || {};
    const nonInterventionHours = provider.nonInterventionHours || {};

    const workingHours = Array.from({ length: 12 }, (_, i) => i + 8); // 08:00 to 19:00

    if (availabilityMode === 'available') {
      // Mode "available": Provider is ONLY available during availabilityHours
      const ranges = availabilityHours[dayOfWeek] || [];
      if (ranges.length === 0) return []; // No availability defined = not available at all
      return workingHours.filter(hour => isTimeInRanges(hour, ranges));
    } else {
      // Mode "unavailable" (default): Provider is available except during nonInterventionHours
      const ranges = nonInterventionHours[dayOfWeek] || [];
      if (ranges.length === 0) return workingHours; // No restrictions = fully available
      return workingHours.filter(hour => !isTimeInRanges(hour, ranges));
    }
  };

  // Calculate provider availability based on real data
  const providersWithAvailability = useMemo(() => {
    console.log('Calculating providers with availability:', {
      allProvidersCount: allProviders?.length,
      allMissionsCount: allMissions?.length,
      dateRange
    });

    if (!allProviders || allProviders.length === 0) {
      console.warn('No providers data available');
      return [];
    }

    const providers = allProviders.filter(p => {
      const isActive = p.status === 'Active' || p.status === 'Passive';
      console.log(`Provider ${p.firstName} ${p.lastName}: status=${p.status}, isActive=${isActive}`);
      return isActive;
    });

    console.log(`Filtered ${providers.length} active providers from ${allProviders.length} total`);

    return providers.map(provider => {
      const availability = new Map<string, ProviderAvailabilityStatus>();
      const availabilityMode = (provider as any).availabilityMode || 'unavailable';

      // Generate availability for each day in range
      const current = new Date(dateRange.startDate);
      const end = new Date(dateRange.endDate);

      while (current <= end) {
        const dateStr = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`;
        const dayOfWeek = current.getDay();

        // Check if provider is on leave (leaves are stored on provider)
        const providerLeaves = (provider.leaves || []).filter((l: any) =>
          dateStr >= l.startDate &&
          dateStr <= l.endDate &&
          l.status === 'approved'
        );

        const isOnLeave = providerLeaves.length > 0;

        // Check availability based on mode
        let isDayUnavailable = false;
        if (availabilityMode === 'available') {
          // Mode "available": Check if provider has ANY availability hours this day
          const availableHours = getProviderAvailableHours(provider, dayOfWeek);
          isDayUnavailable = availableHours.length === 0;
        } else {
          // Mode "unavailable" (default): Check non-intervention days
          const nonInterventionDays = (provider as any).nonInterventionDays || [];
          isDayUnavailable = nonInterventionDays.includes(dayOfWeek);
        }

        // Check if provider has missions this day
        const providerMissions = allMissions?.filter(m =>
          m.providerId === provider.id &&
          m.date === dateStr &&
          m.status !== 'cancelled'
        ) || [];

        const hasMissions = providerMissions.length > 0;

        // Determine status
        let status: ProviderAvailabilityStatus;
        if (isOnLeave) {
          status = 'leave';
        } else if (isDayUnavailable) {
          status = 'unavailable';
        } else if (hasMissions) {
          status = 'busy';
        } else {
          status = 'available';
        }

        availability.set(dateStr, status);

        current.setDate(current.getDate() + 1);
      }

      const domain = mapSpecialtyToDomain(provider.specialty);

      return {
        ...provider,
        domain,
        availability,
        availabilityMode,
        getAvailableHours: (dayOfWeek: number) => getProviderAvailableHours(provider, dayOfWeek),
      };
    });
  }, [allProviders, allMissions, dateRange.start, dateRange.end]);

  // Filter providers
  const filteredProviders = useMemo(() => {
    return providersWithAvailability.filter((provider) => {
      const matchesDomain = domainFilter === 'all' || provider.domain === domainFilter;
      const matchesSearch =
        searchQuery === '' ||
        `${provider.firstName} ${provider.lastName}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
        provider.specialty.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesDomain && matchesSearch;
    });
  }, [providersWithAvailability, domainFilter, searchQuery]);

  // Filter unassigned missions for selected date with search
  const unassignedMissionsForSelectedDate = useMemo(() => {
    if (!selectedDateForAssignment) return [];
    let missions = unassignedMissions.filter(m => m.date === selectedDateForAssignment);
    
    if (modalSearchQuery.trim()) {
      const query = modalSearchQuery.toLowerCase();
      missions = missions.filter(m =>
        m.clientName.toLowerCase().includes(query) ||
        m.service.toLowerCase().includes(query)
      );
    }
    
    return missions;
  }, [unassignedMissions, selectedDateForAssignment, modalSearchQuery]);

  // Get upcoming missions for selected provider
  const upcomingMissionsForProvider = useMemo(() => {
    if (!selectedProvider) return [];
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    return (allMissions || [])
      .filter(m =>
        m.providerId === selectedProvider.id &&
        m.date >= today &&
        m.status !== 'cancelled' &&
        m.status !== 'completed'
      )
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 5); // Show next 5 missions
  }, [allMissions, selectedProvider]);

  // Navigation handlers
  const goToPrevious = () => {
    const newDate = new Date(selectedDate);
    switch (viewMode) {
      case 'day':
      case 'hourly':
        newDate.setDate(newDate.getDate() - 1);
        break;
      case 'week':
        newDate.setDate(newDate.getDate() - 7);
        break;
      case 'month':
        newDate.setMonth(newDate.getMonth() - 1);
        break;
    }
    setSelectedDate(newDate);
  };

  const goToNext = () => {
    const newDate = new Date(selectedDate);
    switch (viewMode) {
      case 'day':
      case 'hourly':
        newDate.setDate(newDate.getDate() + 1);
        break;
      case 'week':
        newDate.setDate(newDate.getDate() + 7);
        break;
      case 'month':
        newDate.setMonth(newDate.getMonth() + 1);
        break;
    }
    setSelectedDate(newDate);
  };

  const goToToday = () => {
    setSelectedDate(new Date());
  };

  // Assignment handler
  const handleProviderClick = (provider: ProviderWithAvailability, date: string) => {
    const availability = provider.availability.get(date);
    if (availability === 'leave' || availability === 'unavailable') {
      return;
    }
    
    // Check if there are unassigned missions for this date
    const missionsForDate = unassignedMissions.filter(m => m.date === date);
    if (missionsForDate.length === 0) {
      setShowSuccessMessage('Aucune mission à attribuer pour cette date');
      setTimeout(() => setShowSuccessMessage(null), 3000);
      return;
    }
    
    setSelectedProvider(provider);
    setSelectedDateForAssignment(date);
    setSelectedMissionId(null);
    setShowAssignmentModal(true);
    setModalSearchQuery(''); // Reset search when opening modal
  };

  const handleAssignMission = async () => {
    if (!selectedProvider || !selectedMissionId) return;

    setIsSubmitting(true);
    try {
      const mission = unassignedMissions.find(m => m.id === selectedMissionId);
      if (!mission) return;

      await assignMissionToProvider(
        selectedMissionId,
        selectedProvider.id,
        `${selectedProvider.firstName} ${selectedProvider.lastName}`
      );

      setShowSuccessMessage(`Mission attribuée à ${selectedProvider.firstName} ${selectedProvider.lastName}`);
      setTimeout(() => setShowSuccessMessage(null), 3000);

      setShowAssignmentModal(false);
      setSelectedProvider(null);
      setSelectedDateForAssignment(null);
      setSelectedMissionId(null);
      setModalSearchQuery('');
      
      // Silent refresh - don't show full page loader
      loadData(true);
    } catch (error: any) {
      console.error('Error assigning mission:', error);
      const errorMessage = error?.message || 'Erreur lors de l\'attribution de la mission';
      setShowSuccessMessage(errorMessage);
      setTimeout(() => setShowSuccessMessage(null), 5000);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Generate calendar days
  const calendarDays = useMemo(() => {
    const days: Date[] = [];
    const current = new Date(dateRange.startDate);
    const end = new Date(dateRange.endDate);

    while (current <= end) {
      days.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }

    return days;
  }, [dateRange]);

  // Get status for provider on specific date
  const getProviderStatus = (provider: ProviderWithAvailability, date: string): ProviderAvailabilityStatus => {
    return provider.availability.get(date) || 'available';
  };

  // Get available time slots for provider on specific date
  const getProviderAvailableSlots = (provider: ProviderWithAvailability, date: string): { startTime: string; endTime: string }[] => {
    return provider.availableSlots?.get(date) || [];
  };

  // Format date display
  const formatDateRange = () => {
    const start = dateRange.startDate;
    const end = dateRange.endDate;

    if (viewMode === 'day' || viewMode === 'hourly') {
      return `${start.getDate()} ${monthNames[start.getMonth()]} ${start.getFullYear()}`;
    }

    if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
      return `${start.getDate()} - ${end.getDate()} ${monthNames[start.getMonth()]} ${start.getFullYear()}`;
    }

    return `${start.getDate()} ${monthNames[start.getMonth()]} - ${end.getDate()} ${monthNames[end.getMonth()]} ${start.getFullYear()}`;
  };

  // Count unassigned missions for a date
  const getUnassignedCountForDate = (date: string) => {
    return unassignedMissions.filter(m => m.date === date).length;
  };

  return (
    <div className="h-full flex flex-col bg-cream-50">
      {/* Success Toast */}
      {showSuccessMessage && (
        <div className="fixed top-4 right-4 z-50 bg-green-500 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 animate-in fade-in slide-in-from-top-4">
          <Check className="w-5 h-5" />
          <span className="font-medium">{showSuccessMessage}</span>
        </div>
      )}

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-4 md:px-6 py-3 md:py-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-brand-blue rounded-lg shrink-0">
              <Users className="w-5 h-5 md:w-6 md:h-6 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg md:text-xl font-bold text-slate-800 truncate">Disponibilité Prestataires</h1>
              <p className="text-xs md:text-sm text-slate-500 hidden sm:block">Attribuez les missions non assignées</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* View Mode Toggles - Desktop */}
            <div className="hidden md:flex items-center gap-1 bg-slate-100 rounded-lg p-1">
              {(['day', 'week', 'month', 'hourly'] as ViewMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    viewMode === mode
                      ? 'bg-white text-brand-blue shadow-sm'
                      : 'text-slate-600 hover:text-slate-800'
                  }`}
                >
                  {mode === 'day' ? 'Jour' : mode === 'week' ? 'Sem.' : mode === 'month' ? 'Mois' : 'Horaire'}
                </button>
              ))}
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 bg-slate-100 rounded-lg"
            >
              <Filter className="w-5 h-5 text-slate-600" />
            </button>
          </div>
        </div>

        {/* Filters Row */}
        <div className={`flex flex-wrap items-center gap-2 md:gap-3 mt-3 ${isMobileMenuOpen ? 'block' : 'hidden md:flex'}`}>
          {/* Date Navigation */}
          <div className="flex items-center gap-1 md:gap-2">
            <button
              onClick={goToPrevious}
              className="p-1.5 md:p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-4 h-4 md:w-5 md:h-5 text-slate-600" />
            </button>
            <button
              onClick={goToToday}
              className="px-2 md:px-3 py-1.5 text-xs md:text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors whitespace-nowrap"
            >
              Aujourd'hui
            </button>
            <button
              onClick={goToNext}
              className="p-1.5 md:p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <ChevronRight className="w-4 h-4 md:w-5 md:h-5 text-slate-600" />
            </button>
            <span className="text-sm md:text-lg font-semibold text-slate-800 ml-1 md:min-w-[180px]">
              {formatDateRange()}
            </span>
          </div>

          <div className="hidden md:block h-6 w-px bg-slate-300 mx-2" />

          {/* Domain Filter */}
          <div className="flex items-center gap-1 md:gap-2">
            <Filter className="w-3 h-3 md:w-4 md:h-4 text-slate-500" />
            <select
              value={domainFilter}
              onChange={(e) => setDomainFilter(e.target.value as ProviderDomain | 'all')}
              className="px-2 md:px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs md:text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue"
            >
              {domains.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>

          {/* Search */}
          <div className="flex items-center gap-1 md:gap-2 flex-1 md:flex-none">
            <Search className="w-3 h-3 md:w-4 md:h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Rechercher..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="px-2 md:px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs md:text-sm w-full md:w-48 focus:outline-none focus:ring-2 focus:ring-brand-blue"
            />
          </div>

          {/* Mobile View Mode */}
          <div className="flex md:hidden items-center gap-1 bg-slate-100 rounded-lg p-1 ml-auto">
            {(['day', 'week', 'hourly'] as ViewMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                  viewMode === mode
                    ? 'bg-white text-brand-blue shadow-sm'
                    : 'text-slate-600'
                }`}
              >
                {mode === 'day' ? 'J' : mode === 'hourly' ? 'H' : 'S'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
        {/* Calendar Section */}
        <div className="flex-1 overflow-auto p-2 md:p-4 lg:p-6">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="flex items-center gap-3 text-slate-500">
                <div className="w-6 h-6 border-2 border-brand-blue border-t-transparent rounded-full animate-spin" />
                <span>Chargement...</span>
              </div>
            </div>
          ) : allProviders.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-500">
              <Users className="w-10 h-10 md:w-12 md:h-12 mb-3 text-slate-300" />
              <p className="text-sm md:text-base">Chargement des prestataires...</p>
              <p className="text-xs text-slate-400 mt-2">Si ce message persiste, vérifiez la connexion</p>
            </div>
          ) : filteredProviders.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-500">
              <Users className="w-10 h-10 md:w-12 md:h-12 mb-3 text-slate-300" />
              <p className="text-sm md:text-base">Aucun prestataire trouvé</p>
              <p className="text-xs text-slate-400 mt-2">
                Filtre: {domainFilter}, Recherche: "{searchQuery}"
              </p>
              <p className="text-xs text-slate-400">
                Total prestataires: {allProviders.length}, Actifs: {allProviders.filter(p => p.status === 'Active' || p.status === 'Passive').length}
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              {viewMode === 'hourly' ? (
                // HOURLY VIEW
                <>
                  {/* Hourly Header - Hours */}
                  <div 
                    className="grid border-b border-slate-200 bg-slate-50"
                    style={{ gridTemplateColumns: `140px repeat(12, 1fr)` }}
                  >
                    <div className="p-2 md:p-3 border-r border-slate-200 font-medium text-slate-700 text-xs md:text-sm">
                      Prestataires
                    </div>
                    {Array.from({ length: 12 }, (_, i) => {
                      const hour = i + 8; // 08:00 to 19:00
                      return (
                        <div
                          key={hour}
                          className="p-1 md:p-2 text-center border-r border-slate-200 last:border-r-0"
                        >
                          <div className="text-[10px] md:text-xs text-slate-600 font-semibold">
                            {hour.toString().padStart(2, '0')}:00
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Provider Rows with Hourly Slots */}
                  <div className="divide-y divide-slate-100">
                    {filteredProviders.map((provider) => {
                      const dateStr = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`;
                      const dayOfWeek = selectedDate.getDay();
                      const dayStatus = getProviderStatus(provider, dateStr);
                      const isDayUnavailable = dayStatus === 'leave' || dayStatus === 'unavailable';

                      // Get available hours for this provider on this day
                      const availableHours = (provider as any).getAvailableHours?.(dayOfWeek) || [];

                      // Get missions for this provider on this date
                      const providerMissions = (allMissions || []).filter(m =>
                        m.providerId === provider.id &&
                        m.date === dateStr &&
                        m.status !== 'cancelled'
                      );

                      return (
                        <div
                          key={provider.id}
                          className="grid hover:bg-slate-50/50 transition-colors"
                          style={{ gridTemplateColumns: `140px repeat(12, 1fr)` }}
                        >
                          {/* Provider Info */}
                          <div className="p-2 md:p-3 border-r border-slate-200 flex items-center gap-2">
                            <div className={`w-1.5 md:w-2 h-6 md:h-8 rounded-full shrink-0 ${
                              provider.domain === 'Ménage' ? 'bg-blue-500' :
                              provider.domain === 'Jardinage' ? 'bg-green-500' :
                              provider.domain === 'Bricolage' ? 'bg-orange-500' : 'bg-purple-500'
                            }`} />
                            <div className="min-w-0 overflow-hidden">
                              <p className="font-medium text-slate-800 text-xs md:text-sm truncate">
                                {provider.firstName} {provider.lastName}
                              </p>
                              <p className="text-[10px] md:text-xs text-slate-500 truncate hidden sm:block">{provider.specialty}</p>
                            </div>
                          </div>

                          {/* Hour Cells */}
                          {Array.from({ length: 12 }, (_, i) => {
                            const hour = i + 8;
                            const hourStr = `${hour.toString().padStart(2, '0')}:00`;
                            const nextHourStr = `${(hour + 1).toString().padStart(2, '0')}:00`;

                            // Check if there's a mission during this hour
                            const missionDuringHour = providerMissions.find(m => {
                              const startHour = parseInt(m.startTime?.split(':')[0] || '0');
                              const endHour = parseInt(m.endTime?.split(':')[0] || '0');
                              return hour >= startHour && hour < endHour;
                            });

                            // Check if this specific hour is available
                            const isHourAvailable = availableHours.includes(hour);

                            // Determine status for this hour
                            let hourStatus: ProviderAvailabilityStatus;
                            if (dayStatus === 'leave') {
                              hourStatus = 'leave';
                            } else if (!isHourAvailable) {
                              hourStatus = 'unavailable';
                            } else if (missionDuringHour) {
                              hourStatus = 'busy';
                            } else {
                              hourStatus = 'available';
                            }

                            const config = statusConfig[hourStatus];
                            const unassignedCount = getUnassignedCountForDate(dateStr);
                            const canAssign = hourStatus !== 'leave' && hourStatus !== 'unavailable';

                            return (
                              <div
                                key={hour}
                                onClick={() => canAssign && handleProviderClick(provider, dateStr)}
                                className={`p-0.5 md:p-1 border-r border-slate-200 last:border-r-0 min-h-[35px] md:min-h-[50px] transition-all group relative ${
                                  canAssign && unassignedCount > 0
                                    ? 'cursor-pointer hover:bg-slate-100' 
                                    : canAssign
                                      ? 'cursor-pointer hover:bg-slate-50'
                                      : 'cursor-not-allowed opacity-60'
                                }`}
                              >
                                {/* Tooltip with mission info */}
                                {missionDuringHour && (
                                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block z-50">
                                    <div className="bg-slate-800 text-white text-[10px] px-2 py-1.5 rounded-lg shadow-lg whitespace-nowrap">
                                      <div className="font-semibold">{missionDuringHour.clientName}</div>
                                      <div>{missionDuringHour.startTime} - {missionDuringHour.endTime}</div>
                                      <div>{missionDuringHour.service}</div>
                                      <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
                                    </div>
                                  </div>
                                )}
                                
                                <div className={`h-full rounded flex flex-col items-center justify-center p-0.5 border transition-all ${
                                  canAssign && unassignedCount > 0
                                    ? `${config.bgColor} ${config.borderColor} hover:scale-105` 
                                    : `${config.bgColor} ${config.borderColor}`
                                }`}>
                                  <span className={config.color}>
                                    {React.cloneElement(config.icon as React.ReactElement, { className: 'w-3 h-3 md:w-3.5 md:h-3.5' })}
                                  </span>
                                  
                                  {/* Mission indicator */}
                                  {missionDuringHour && (
                                    <span className="text-[7px] md:text-[8px] text-orange-700 font-medium mt-0.5 truncate w-full text-center">
                                      {missionDuringHour.clientName.slice(0, 8)}...
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                // STANDARD DAY/WEEK/MONTH VIEW
                <>
                  {/* Calendar Header - Days */}
                  <div 
                    className="grid border-b border-slate-200 bg-slate-50"
                    style={{ gridTemplateColumns: `120px repeat(${calendarDays.length}, 1fr)` }}
                  >
                    <div className="p-2 md:p-3 border-r border-slate-200 font-medium text-slate-700 text-xs md:text-sm">
                      Prestataires
                    </div>
                    {calendarDays.map((day, index) => {
                      const dateStr = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
                      const unassignedCount = getUnassignedCountForDate(dateStr);
                      const now = new Date();
                      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
                      const isToday = dateStr === todayStr;
                      
                      return (
                        <div
                          key={index}
                          className={`p-1 md:p-3 text-center border-r border-slate-200 last:border-r-0 ${
                            isToday ? 'bg-brand-blue/10' : ''
                          }`}
                        >
                          <div className="text-[10px] md:text-xs text-slate-500 uppercase">{weekDays[day.getDay()]}</div>
                          <div className={`text-sm md:text-lg font-semibold ${isToday ? 'text-brand-blue' : 'text-slate-700'}`}>
                            {day.getDate()}
                          </div>
                          {unassignedCount > 0 && (
                            <div className="mt-0.5 md:mt-1">
                              <span className="inline-flex items-center justify-center w-4 h-4 md:w-5 md:h-5 bg-red-500 text-white text-[8px] md:text-[10px] font-bold rounded-full">
                                {unassignedCount}
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Provider Rows */}
                  <div className="divide-y divide-slate-100">
                    {filteredProviders.map((provider) => (
                      <div
                        key={provider.id}
                        className="grid hover:bg-slate-50/50 transition-colors"
                        style={{ gridTemplateColumns: `120px repeat(${calendarDays.length}, 1fr)` }}
                      >
                        {/* Provider Info */}
                        <div className="p-2 md:p-3 border-r border-slate-200 flex items-center gap-2">
                          <div className={`w-1.5 md:w-2 h-6 md:h-8 rounded-full shrink-0 ${
                            provider.domain === 'Ménage' ? 'bg-blue-500' :
                            provider.domain === 'Jardinage' ? 'bg-green-500' :
                            provider.domain === 'Bricolage' ? 'bg-orange-500' : 'bg-purple-500'
                          }`} />
                          <div className="min-w-0 overflow-hidden">
                            <p className="font-medium text-slate-800 text-xs md:text-sm truncate">
                              {provider.firstName} {provider.lastName}
                            </p>
                            <p className="text-[10px] md:text-xs text-slate-500 truncate hidden sm:block">{provider.specialty}</p>
                          </div>
                        </div>

                        {/* Day Cells */}
                        {calendarDays.map((day, dayIndex) => {
                          const dateStr = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
                          const status = getProviderStatus(provider, dateStr);
                          const config = statusConfig[status];
                          const canAssign = status !== 'leave' && status !== 'unavailable';
                          const unassignedCount = getUnassignedCountForDate(dateStr);
                          const availableSlots = getProviderAvailableSlots(provider, dateStr);
                          const hasCustomSlots = availableSlots.length > 0;

                          return (
                            <div
                              key={dayIndex}
                              onClick={() => canAssign && handleProviderClick(provider, dateStr)}
                              className={`p-1 md:p-2 border-r border-slate-200 last:border-r-0 min-h-[40px] md:min-h-[60px] transition-all group relative ${
                                canAssign && unassignedCount > 0
                                  ? 'cursor-pointer hover:bg-slate-100' 
                                  : canAssign
                                    ? 'cursor-pointer hover:bg-slate-50'
                                    : 'cursor-not-allowed opacity-60'
                              }`}
                            >
                              {/* Tooltip avec horaires */}
                              {hasCustomSlots && (
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block z-50">
                                  <div className="bg-slate-800 text-white text-[10px] px-2 py-1.5 rounded-lg shadow-lg whitespace-nowrap">
                                    <div className="font-semibold mb-0.5">Créneaux libres:</div>
                                    {availableSlots.map((slot, idx) => (
                                      <div key={idx}>{slot.startTime} - {slot.endTime}</div>
                                    ))}
                                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
                                  </div>
                                </div>
                              )}
                              
                              <div className={`h-full rounded-lg flex flex-col items-center justify-center gap-0.5 md:gap-1 p-1 border-2 transition-all ${
                                canAssign && unassignedCount > 0
                                  ? `${config.bgColor} ${config.borderColor} hover:scale-105 hover:shadow-md` 
                                  : `${config.bgColor} ${config.borderColor}`
                              }`}>
                                <span className={config.color}>{React.cloneElement(config.icon as React.ReactElement, { className: 'w-3 h-3 md:w-4 md:h-4' })}</span>
                                <span className={`text-[8px] md:text-xs font-semibold ${config.color}`}>
                                  {canAssign && unassignedCount > 0 ? `${unassignedCount} mission${unassignedCount > 1 ? 's' : ''}` : config.label}
                                </span>
                                
                                {/* Indicateur de créneaux horaires */}
                                {hasCustomSlots && status === 'available' && (
                                  <span className="text-[7px] md:text-[9px] text-green-600 font-medium mt-0.5">
                                    {availableSlots.length} créneau{availableSlots.length > 1 ? 'x' : ''}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Unassigned Missions Sidebar - Desktop */}
        <div className="hidden lg:block w-80 bg-white border-l border-slate-200 flex flex-col">
          <div className="p-4 border-b border-slate-200 bg-slate-50">
            <h2 className="font-bold text-slate-800 flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-brand-blue" />
              Missions à attribuer
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              {unassignedMissions.length} mission{unassignedMissions.length > 1 ? 's' : ''} en attente
            </p>
            {unassignedMissions.length === 0 && !loading && (
              <p className="text-xs text-orange-500 mt-1">
                Aucune mission trouvée pour la période {dateRange.start} au {dateRange.end}
              </p>
            )}
          </div>
          
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {loading ? (
              <div className="text-center py-8 text-slate-400">
                <div className="w-8 h-8 border-2 border-brand-blue border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                <p className="text-sm">Chargement des missions...</p>
              </div>
            ) : unassignedMissions.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <CheckCircle2 className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Toutes les missions sont attribuées</p>
                <p className="text-xs text-slate-400 mt-2">
                  Période: {dateRange.start} au {dateRange.end}
                </p>
              </div>
            ) : (
              unassignedMissions.map((mission) => (
                <div 
                  key={mission.id} 
                  className="bg-orange-50 border border-orange-200 rounded-lg p-3 hover:bg-orange-100 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-slate-800 text-sm truncate">{mission.clientName}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{mission.service}</p>
                    </div>
                    <span className="text-[10px] bg-orange-200 text-orange-800 px-1.5 py-0.5 rounded whitespace-nowrap">
                      {mission.duration}h
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                    <CalendarIcon className="w-3 h-3" />
                    <span>{new Date(mission.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</span>
                    <Clock className="w-3 h-3 ml-1" />
                    <span>{mission.startTime}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="bg-white border-t border-slate-200 px-3 md:px-6 py-2 md:py-3">
        <div className="flex flex-wrap items-center gap-3 md:gap-6">
          <span className="text-xs md:text-sm font-medium text-slate-600">Légende:</span>
          {Object.entries(statusConfig).map(([key, config]) => (
            <div key={key} className="flex items-center gap-1 md:gap-2">
              <div className={`w-3 h-3 md:w-4 md:h-4 rounded ${config.bgColor} ${config.borderColor} border flex items-center justify-center`}>
                <span className={config.color}>{React.cloneElement(config.icon as React.ReactElement, { className: 'w-2 h-2 md:w-3 md:h-3' })}</span>
              </div>
              <span className="text-[10px] md:text-sm text-slate-600">{config.label}</span>
            </div>
          ))}
          <div className="hidden md:flex ml-auto text-sm text-slate-500 items-center gap-1">
            <Smartphone className="w-4 h-4" />
            <span>Cliquez sur une case avec missions pour attribuer</span>
          </div>
        </div>
      </div>

      {/* Assignment Modal */}
      {showAssignmentModal && selectedProvider && selectedDateForAssignment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 md:p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-auto animate-in fade-in zoom-in duration-200">
            <div className="p-4 md:p-6 border-b border-slate-200 bg-gradient-to-r from-brand-blue/5 to-transparent">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-brand-blue flex items-center justify-center shrink-0">
                    <User className="w-4 h-4 md:w-5 md:h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-base md:text-lg font-bold text-slate-800">Attribuer une mission</h2>
                    <p className="text-xs md:text-sm text-slate-500">
                      {selectedProvider.firstName} {selectedProvider.lastName}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowAssignmentModal(false)}
                  className="p-1.5 md:p-2 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <X className="w-4 h-4 md:w-5 md:h-5 text-slate-500" />
                </button>
              </div>
              
              {/* Date Badge */}
              <div className="mt-3 md:mt-4 inline-flex items-center gap-1.5 md:gap-2 bg-brand-blue/10 text-brand-blue px-2 md:px-3 py-1 md:py-1.5 rounded-full text-xs md:text-sm font-medium">
                <CalendarIcon className="w-3 h-3 md:w-4 md:h-4" />
                {new Date(selectedDateForAssignment).toLocaleDateString('fr-FR', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </div>
            </div>

            <div className="p-4 md:p-6">
              {/* Provider Info Card */}
              <div className="bg-slate-50 rounded-lg p-3 mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <User className="w-4 h-4 text-brand-blue" />
                  <span className="font-medium text-slate-800">{selectedProvider.firstName} {selectedProvider.lastName}</span>
                  <span className="text-xs bg-slate-200 text-slate-600 px-2 py-0.5 rounded">{selectedProvider.specialty}</span>
                </div>
                
                {/* Upcoming Missions */}
                {upcomingMissionsForProvider.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-200">
                    <p className="text-xs font-medium text-slate-600 mb-2 flex items-center gap-1">
                      <CalendarIcon className="w-3 h-3" />
                      Prochaines missions ({upcomingMissionsForProvider.length}):
                    </p>
                    <div className="space-y-1 max-h-24 overflow-y-auto">
                      {upcomingMissionsForProvider.map(mission => (
                        <div key={mission.id} className="text-xs text-slate-600 flex items-center gap-2">
                          <span className="w-1.5 h-1.5 bg-orange-400 rounded-full"></span>
                          <span className="font-medium">{new Date(mission.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</span>
                          <span className="truncate">{mission.clientName}</span>
                          <span className="text-slate-400">({mission.startTime}-{mission.endTime})</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Search Bar */}
              <div className="mb-4">
                <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2">
                  <Search className="w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Rechercher une mission (client, service...)"
                    value={modalSearchQuery}
                    onChange={(e) => setModalSearchQuery(e.target.value)}
                    className="flex-1 text-sm outline-none text-slate-700 placeholder:text-slate-400"
                  />
                  {modalSearchQuery && (
                    <button
                      onClick={() => setModalSearchQuery('')}
                      className="p-1 hover:bg-slate-100 rounded"
                    >
                      <X className="w-3 h-3 text-slate-400" />
                    </button>
                  )}
                </div>
              </div>

              <h3 className="text-sm font-medium text-slate-700 mb-3">
                Missions disponibles ({unassignedMissionsForSelectedDate.length})
              </h3>
              
              {unassignedMissionsForSelectedDate.length === 0 ? (
                <div className="text-center py-6 text-slate-400 bg-slate-50 rounded-lg">
                  <Briefcase className="w-10 h-10 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">
                    {modalSearchQuery 
                      ? 'Aucune mission correspond à votre recherche'
                      : 'Aucune mission pour cette date'
                    }
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[40vh] overflow-y-auto">
                  {unassignedMissionsForSelectedDate.map((mission) => (
                    <div
                      key={mission.id}
                      onClick={() => setSelectedMissionId(mission.id)}
                      className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                        selectedMissionId === mission.id
                          ? 'border-brand-blue bg-brand-blue/5'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium text-slate-800 text-sm">{mission.clientName}</p>
                          <p className="text-xs text-slate-500 mt-0.5">{mission.service}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-xs font-medium text-slate-600">{mission.duration}h</span>
                        </div>
                      </div>
                      <div className="mt-2 flex items-center gap-3 text-xs text-slate-500">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {mission.startTime} - {mission.endTime}
                        </span>
                      </div>
                      {selectedMissionId === mission.id && (
                        <div className="mt-2 flex items-center gap-1 text-brand-blue text-xs font-medium">
                          <Check className="w-3 h-3" />
                          Sélectionnée
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="p-4 md:p-6 border-t border-slate-200 bg-slate-50 flex justify-between items-center">
              <button
                onClick={() => setShowAssignmentModal(false)}
                className="px-3 md:px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg transition-colors text-sm"
              >
                Annuler
              </button>
              
              <button
                onClick={handleAssignMission}
                disabled={!selectedMissionId || isSubmitting}
                className="px-3 md:px-4 py-2 bg-brand-blue text-white rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm flex items-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Attribution...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Attribuer
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Helper function
function mapSpecialtyToDomain(specialty: string): any {
  const specialtyLower = (specialty || '').toLowerCase();
  if (specialtyLower.includes('ménage') || specialtyLower.includes('menage')) return 'Ménage';
  if (specialtyLower.includes('jardin')) return 'Jardinage';
  if (specialtyLower.includes('bricol')) return 'Bricolage';
  return 'Autre';
}

export default ProviderAvailabilityPage;
