export type ProviderAvailabilityStatus = 'available' | 'busy' | 'leave' | 'unavailable';

export type ViewMode = 'day' | 'week' | 'month';

export type ProviderDomain = 'Ménage' | 'Jardinage' | 'Bricolage' | 'Autre';

export type TimeSlot = {
  startTime: string; // HH:mm
  endTime: string;   // HH:mm
};

export type ProviderAvailabilitySlot = {
  id: string;
  providerId: string;
  date: string; // YYYY-MM-DD
  slots: TimeSlot[];
  status: ProviderAvailabilityStatus;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ProviderWithAvailability = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  specialty: string;
  domain: ProviderDomain;
  status: 'Active' | 'Inactive' | 'Passive';
  rating: number;
  // Availability for a specific date range - maps date to status only
  availability: Map<string, ProviderAvailabilityStatus>;
  // Available time slots by date
  availableSlots?: Map<string, TimeSlot[]>;
};

export type ProviderScheduleAssignment = {
  id: string;
  providerId: string;
  missionId?: string | null;
  devisId?: string | null;
  clientId: string;
  clientName: string;
  date: string;
  startTime: string;
  endTime: string;
  serviceType: string;
  status: 'assigned' | 'completed' | 'cancelled';
  notes?: string | null;
  createdAt: string;
};

export type FilterOptions = {
  viewMode: ViewMode;
  selectedDate: string; // YYYY-MM-DD
  domain?: ProviderDomain | 'all';
  status?: ProviderAvailabilityStatus | 'all';
  searchQuery?: string;
};

export type CreateAssignmentInput = {
  providerId: string;
  clientId: string;
  clientName: string;
  date: string;
  startTime: string;
  endTime: string;
  serviceType: string;
  notes?: string;
};

export type AvailabilityCalendarDay = {
  date: string; // YYYY-MM-DD
  dayOfWeek: number; // 0-6 (Sunday-Saturday)
  dayOfMonth: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  providers: ProviderDayInfo[];
};

export type ProviderDayInfo = {
  providerId: string;
  providerName: string;
  domain: ProviderDomain;
  status: ProviderAvailabilityStatus;
  assignedSlots: TimeSlot[];
  availableSlots: TimeSlot[];
};

export type UnassignedMission = {
  id: string;
  clientId: string;
  clientName: string;
  date: string;
  startTime: string;
  endTime: string;
  service: string;
  status: 'planned' | 'in_progress' | 'completed' | 'cancelled';
  duration: number;
};
