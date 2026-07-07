import React, { useState, useEffect, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Clock,
  Users,
  Filter,
  Search,
  X,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import type {
  ProviderWithAvailability,
  ViewMode,
  ProviderDomain,
  ProviderAvailabilityStatus,
} from '../types';
import {
  getProvidersWithAvailability,
} from '../client';
import { useData } from '../../../context/DataContext';
import {
  computeAvailabilitySlots,
  groupSlotsByTime,
  isProviderActive,
  isMenageSpecialty,
  type EnrichedSlot,
  type GroupedSlot,
} from '../../../utils/availabilityCalculator';

const domains: { value: ProviderDomain | 'all'; label: string; color: string }[] = [
  { value: 'all', label: 'Tous', color: 'bg-slate-500' },
  { value: 'Ménage', label: 'Ménage', color: 'bg-blue-500' },
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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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
  // Loading state
  useEffect(() => {
    setLoading(false);
  }, []);

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

    const workingHours = Array.from({ length: 8 }, (_, i) => i + 8); // 08:00 to 15:00 (blocs matin 8h-12h, après-midi 12h-16h)

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

        // Check scheduled unavailabilities (multi-week)
        const scheds = (provider as any).scheduledUnavailabilities || [];
        const hasScheduledUnavailability = Array.isArray(scheds) && scheds.some((su: any) => {
          if (su.dayOfWeek !== dayOfWeek) return false;
          const suStart = new Date(su.startDate + 'T00:00:00');
          const currentDate = new Date(dateStr + 'T12:00:00');
          if (currentDate < suStart) return false;
          const suEndDate = new Date(suStart);
          suEndDate.setDate(suEndDate.getDate() + (su.weeks * 7) - 1);
          if (currentDate > suEndDate) return false;
          return true;
        });

        // Determine status
        let status: ProviderAvailabilityStatus;
        if (isOnLeave) {
          status = 'leave';
        } else if (isDayUnavailable || hasScheduledUnavailability) {
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

  // Service types for the "Créneaux Libres" section — seul "Ménage"
  const serviceTypes = ['Ménage'] as const;

  // Get status for provider on specific date (must be before useMemo that uses it)
  const getProviderStatus = (provider: ProviderWithAvailability, date: string): ProviderAvailabilityStatus => {
    return provider.availability.get(date) || 'available';
  };

  // Get available time slots for provider on specific date
  const getProviderAvailableSlots = (provider: ProviderWithAvailability, date: string): { startTime: string; endTime: string }[] => {
    return provider.availableSlots?.get(date) || [];
  };

  // Compute available slots grouped by service type for the selected date
  const slotsByServiceType = useMemo(() => {
    const todayStr = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`;

    const result: Record<string, { groupedSlots: GroupedSlot[]; enrichedSlots: EnrichedSlot[]; providerCount: number }> = {};

    for (const svcType of serviceTypes) {
      // Filtrer strictement par spécialité Ménage + actifs
      const activeProviders = filteredProviders.filter(p => isProviderActive(p) && isMenageSpecialty(p.specialty || ''));
      if (activeProviders.length === 0) {
        result[svcType] = { groupedSlots: [], enrichedSlots: [], providerCount: 0 };
        continue;
      }

      // Calcul centralisé : créneaux cumulatifs avec nombre de prestataires
      const enrichedSlots = computeAvailabilitySlots(todayStr, activeProviders, (allMissions || []) as any[]);
      const groupedSlots = groupSlotsByTime(enrichedSlots);
      const freeProviderIds = new Set(enrichedSlots.flatMap(s => s.providerIds));

      result[svcType] = {
        groupedSlots,
        enrichedSlots,
        providerCount: freeProviderIds.size,
      };
    }

    return result;
  }, [filteredProviders, selectedDate, allMissions]);

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

  return (
    <div className="h-full flex flex-col bg-cream-50">
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
            <div className="p-2.5 md:p-3 bg-brand-blue rounded-xl shrink-0">
              <Users className="w-7 h-7 md:w-8 md:h-8 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl md:text-2xl font-bold text-slate-800 truncate">Créneaux Libres</h1>
              <p className="text-xs md:text-sm text-slate-500">Disponibilité des prestataires par service</p>
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
                    style={{ gridTemplateColumns: `80px repeat(7, 1fr)` }}
                  >
                    <div className="p-1.5 md:p-3 border-r border-slate-200 font-medium text-slate-700 text-[10px] md:text-sm">
                      <span className="hidden md:inline">Prestataires</span>
                      <span className="md:hidden">Prest.</span>
                    </div>
                    {Array.from({ length: 7 }, (_, i) => {
                      const hour = i + 9; // 09:00 to 15:00 (ferme à 16:00)
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
                          style={{ gridTemplateColumns: `80px repeat(7, 1fr)` }}
                        >
                          {/* Provider Info */}
                          <div className="p-1.5 md:p-3 border-r border-slate-200 flex items-center gap-1.5 md:gap-2">
                            <div className={`w-1 md:w-2 h-5 md:h-8 rounded-full shrink-0 ${
                              provider.domain === 'Ménage' ? 'bg-blue-500' :
                              provider.domain === 'Bricolage' ? 'bg-orange-500' : 'bg-purple-500'
                            }`} />
                            <div className="min-w-0 overflow-hidden">
                              <p className="font-medium text-slate-800 text-[10px] md:text-sm truncate leading-tight">
                                <span className="hidden md:inline">{provider.firstName} {provider.lastName}</span>
                                <span className="md:hidden">{provider.firstName?.charAt(0)}. {provider.lastName}</span>
                              </p>
                              <p className="text-[9px] md:text-xs text-slate-500 truncate hidden sm:block">{provider.specialty}</p>
                            </div>
                          </div>

                          {/* Hour Cells */}
                          {Array.from({ length: 7 }, (_, i) => {
                            const hour = i + 9; // 09:00 to 15:00
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
                            const isAvailable = hourStatus !== 'leave' && hourStatus !== 'unavailable';

                            return (
                              <div
                                key={hour}
                                className={`p-0.5 md:p-1 border-r border-slate-200 last:border-r-0 min-h-[35px] md:min-h-[50px] transition-all group relative ${
                                  isAvailable ? '' : 'cursor-not-allowed opacity-60'
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
                                
                                <div className={`h-full rounded flex flex-col items-center justify-center p-0.5 border transition-all ${config.bgColor} ${config.borderColor}`}>
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
                    style={{ gridTemplateColumns: `80px repeat(${calendarDays.length}, 1fr)` }}
                  >
                    <div className="p-1.5 md:p-3 border-r border-slate-200 font-medium text-slate-700 text-[10px] md:text-sm">
                      <span className="hidden md:inline">Prestataires</span>
                      <span className="md:hidden">Prest.</span>
                    </div>
                    {calendarDays.map((day, index) => {
                      const dateStr = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
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
                        style={{ gridTemplateColumns: `80px repeat(${calendarDays.length}, 1fr)` }}
                      >
                        {/* Provider Info */}
                        <div className="p-1.5 md:p-3 border-r border-slate-200 flex items-center gap-1.5 md:gap-2">
                          <div className={`w-1 md:w-2 h-5 md:h-8 rounded-full shrink-0 ${
                            provider.domain === 'Ménage' ? 'bg-blue-500' :
                            provider.domain === 'Bricolage' ? 'bg-orange-500' : 'bg-purple-500'
                          }`} />
                          <div className="min-w-0 overflow-hidden">
                            <p className="font-medium text-slate-800 text-[10px] md:text-sm truncate leading-tight">
                              <span className="hidden md:inline">{provider.firstName} {provider.lastName}</span>
                              <span className="md:hidden">{provider.firstName?.charAt(0)}. {provider.lastName}</span>
                            </p>
                            <p className="text-[9px] md:text-xs text-slate-500 truncate hidden sm:block">{provider.specialty}</p>
                          </div>
                        </div>

                        {/* Day Cells */}
                        {calendarDays.map((day, dayIndex) => {
                          const dateStr = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
                          const status = getProviderStatus(provider, dateStr);
                          const config = statusConfig[status];
                          const isAvailable = status !== 'leave' && status !== 'unavailable';
                          const availableSlots = getProviderAvailableSlots(provider, dateStr);
                          const hasCustomSlots = availableSlots.length > 0;

                          return (
                            <div
                              key={dayIndex}
                              className={`p-1 md:p-2 border-r border-slate-200 last:border-r-0 min-h-[40px] md:min-h-[60px] transition-all group relative ${
                                isAvailable ? '' : 'cursor-not-allowed opacity-60'
                              }`}
                            >
                              {/* Tooltip avec horaires */}
                              {hasCustomSlots && (
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block z-50">
                                  <div className="bg-slate-800 text-white text-[10px] px-2 py-1.5 rounded-lg shadow-lg whitespace-nowrap">
                                    <div className="font-semibold mb-0.5">Créneaux libres:</div>
                                    {availableSlots.map((slot: any, idx: number) => (
                                      <div key={idx}>{slot.startTime} - {slot.endTime}</div>
                                    ))}
                                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
                                  </div>
                                </div>
                              )}
                              
                              <div className={`h-full rounded-lg flex flex-col items-center justify-center gap-0.5 md:gap-1 p-1 border-2 transition-all ${config.bgColor} ${config.borderColor}`}>
                                <span className={config.color}>{React.cloneElement(config.icon as React.ReactElement, { className: 'w-3 h-3 md:w-4 md:h-4' })}</span>
                                <span className={`text-[8px] md:text-xs font-semibold ${config.color}`}>
                                  {config.label}
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
      </div>

      {/* Créneaux Libres par type de service */}
      <div className="bg-white border-t border-slate-200 px-3 md:px-6 py-4 md:py-5">
        <h2 className="text-base md:text-lg font-bold text-slate-800 mb-3 flex items-center gap-2">
          <Clock className="w-5 h-5 text-brand-blue" />
          Créneaux Libres — {selectedDate.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {serviceTypes.map((svcType) => {
            const data = slotsByServiceType[svcType];
            const hasAvailability = data && data.groupedSlots.length > 0;
            const domainColor = 'border-blue-200 bg-blue-50';
            const dotColor = 'bg-blue-500';
            const textColor = 'text-blue-700';

            return (
              <div
                key={svcType}
                className={`rounded-xl border-2 p-3 md:p-4 transition-all ${domainColor} ${
                  hasAvailability ? 'shadow-sm' : 'opacity-60'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-3 h-3 rounded-full ${dotColor}`} />
                  <span className={`font-bold text-sm ${textColor}`}>{svcType}</span>
                  <span className="text-xs text-slate-500 ml-auto">{data?.providerCount || 0} prest.</span>
                </div>
                {hasAvailability ? (
                  <div className="space-y-2">
                    {data.groupedSlots.map((slot, i) => {
                      const durationHours = [...slot.durations].sort((a, b) => b - a);
                      const bestCount = slot.maxProviderCount;
                      return (
                        <div key={i} className="bg-white/80 rounded-lg p-2 border border-slate-100">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className={`text-xs font-bold ${textColor}`}>
                              {slot.startTime} — {slot.endTime}
                            </span>
                            <span className={`text-xs font-bold ${bestCount >= 2 ? 'text-green-600' : 'text-blue-600'}`}>
                              {bestCount} libre{bestCount > 1 ? 's' : ''}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {durationHours.map((dur) => {
                              const info = slot.providersByDuration[dur];
                              const count = info?.count || 0;
                              return (
                                <span
                                  key={dur}
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                    count > 0
                                      ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                      : 'bg-slate-100 text-slate-300 border border-slate-100'
                                  }`}
                                >
                                  Pack {dur}h {count > 0 && <span className="text-[9px] opacity-70">({count})</span>}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 italic">Aucun créneau disponible</p>
                )}
              </div>
            );
          })}
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
        </div>
      </div>
    </div>
  );
};

// Helper function — filtre strict Ménage
function mapSpecialtyToDomain(specialty: string): any {
  return isMenageSpecialty(specialty) ? 'Ménage' : null;
}

export default ProviderAvailabilityPage;
