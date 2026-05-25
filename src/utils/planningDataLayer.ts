import { Provider, Mission } from '../../types';
import dayjs from 'dayjs';
import { MARTINIQUE_TIMEZONE } from './dayjsMartinique';

export interface ProviderAvailability {
  available: boolean;
  reason?: string;
  hours?: string[];
  mode?: 'available' | 'unavailable';
  isUnavailable?: boolean;
}

export interface DayMission {
  mission: Mission;
  provider: Provider | null;
}

export interface ProviderDayInfo {
  provider: Provider;
  missions: Mission[];
  totalHours: number;
  status: 'unplanned' | 'partial' | 'full';
  availability: ProviderAvailability;
}

export interface BillingStatus {
  documentId: string;
  clientName: string;
  totalMissions: number;
  completedMissions: number;
  status: 'pending' | 'partial' | 'complete';
  isPackUltime: boolean;
}

export interface TimeSlotValidation {
  isValid: boolean;
  error?: string;
}

const MAX_DAILY_HOURS = 7;

export const getDayOfWeek = (date: string | dayjs.Dayjs): number => {
  const d = typeof date === 'string' ? dayjs(date) : date;
  return d.tz(MARTINIQUE_TIMEZONE).day();
};

export const getProviderAvailabilityForDay = (
  provider: Provider,
  date: string | dayjs.Dayjs
): ProviderAvailability => {
  const dayOfWeek = getDayOfWeek(date);
  
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
      hours: availHours.map((h: { start: string; end: string }) => `${h.start}-${h.end}`),
      mode: 'available' as const
    };
  }
  
  const nonHours = provider.nonInterventionHours?.[dayOfWeek];
  if (nonHours && nonHours.length > 0) {
    return { 
      available: true, 
      hours: nonHours.map((h: { start: string; end: string }) => `${h.start}-${h.end}`),
      mode: 'unavailable' as const,
      isUnavailable: true
    };
  }
  
  return { 
    available: true, 
    hours: ['08:00-18:00'],
    mode: 'unavailable' as const
  };
};

export const getPrestatairesDisponibles = (
  providers: Provider[],
  date: string | dayjs.Dayjs
): Provider[] => {
  const dateStr = typeof date === 'string' ? date : date.format('YYYY-MM-DD');
  
  return providers.filter(provider => {
    if (provider.status === 'Inactive' || provider.status === 'Passive') {
      return false;
    }
    
    const availability = getProviderAvailabilityForDay(provider, dateStr);
    return availability.available;
  });
};

export const getPrestationsOfDay = (
  missions: Mission[],
  date: string | dayjs.Dayjs
): Mission[] => {
  const dateStr = typeof date === 'string' ? date : date.format('YYYY-MM-DD');
  
  return missions.filter(m => 
    m.date === dateStr && 
    m.status !== 'cancelled'
  );
};

export const getPrestationsOfProviderOnDay = (
  missions: Mission[],
  providerId: string,
  date: string | dayjs.Dayjs
): Mission[] => {
  const dateStr = typeof date === 'string' ? date : date.format('YYYY-MM-DD');
  
  return missions.filter(m => 
    m.providerId === providerId && 
    m.date === dateStr &&
    m.status !== 'cancelled'
  );
};

export const getProviderTotalHours = (missions: Mission[]): number => {
  return missions.reduce((total, m) => total + (m.duration || 0), 0);
};

export const checkTimeSlotOverlap = (
  existingMissions: Mission[],
  newStart: string,
  newEnd: string
): boolean => {
  const newStartMin = parseInt(newStart.split(':')[0]) * 60 + parseInt(newStart.split(':')[1]);
  const newEndMin = parseInt(newEnd.split(':')[0]) * 60 + parseInt(newEnd.split(':')[1]);
  
  return existingMissions.some(m => {
    const mStartMin = parseInt(m.startTime.split(':')[0]) * 60 + parseInt(m.startTime.split(':')[1]);
    const mEndMin = parseInt(m.endTime.split(':')[0]) * 60 + parseInt(m.endTime.split(':')[1]);
    return newStartMin < mEndMin && newEndMin > mStartMin;
  });
};

export interface TimeSlot {
  id: string;
  label: string;
  start: string;
  end: string;
  duration: number;
}

export const PLANNING_TIME_SLOTS: TimeSlot[] = [
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
  { id: '9-16', label: '9h - 16h (7h)', start: '09:00', end: '16:00', duration: 7 },
  { id: '10-16', label: '10h - 16h (6h)', start: '10:00', end: '16:00', duration: 6 },
];

export const validateTimeSlot = (
  provider: Provider,
  slot: TimeSlot,
  existingMissions: Mission[],
  date: string | dayjs.Dayjs
): TimeSlotValidation => {
  const dateStr = typeof date === 'string' ? date : date.format('YYYY-MM-DD');
  const availability = getProviderAvailabilityForDay(provider, dateStr);
  
  if (!availability.available) {
    return { isValid: false, error: `Indisponible: ${availability.reason}` };
  }
  
  const slotStart = parseInt(slot.start.split(':')[0]);
  const slotEnd = parseInt(slot.end.split(':')[0]);
  
  if (availability.mode === 'available' && availability.hours) {
    const isInAvailableHours = availability.hours.some(h => {
      const [availStart, availEnd] = h.split('-').map(t => parseInt(t.split(':')[0]));
      return slotStart >= availStart && slotEnd <= availEnd;
    });
    if (!isInAvailableHours) {
      return { isValid: false, error: 'Créneau hors des heures disponibles' };
    }
  }
  
  if (checkTimeSlotOverlap(existingMissions, slot.start, slot.end)) {
    return { isValid: false, error: 'Chevauchement avec une mission existante' };
  }
  
  const currentHours = getProviderTotalHours(existingMissions);
  const newTotal = currentHours + slot.duration;
  
  if (newTotal > MAX_DAILY_HOURS) {
    return { 
      isValid: false, 
      error: `Dépassement: ${currentHours}h déjà planifiées + ${slot.duration}h = ${newTotal}h (max ${MAX_DAILY_HOURS}h)` 
    };
  }
  
  return { isValid: true };
};

export const getAvailableTimeSlots = (
  provider: Provider,
  existingMissions: Mission[],
  date: string | dayjs.Dayjs
): TimeSlot[] => {
  return PLANNING_TIME_SLOTS.filter(slot => 
    validateTimeSlot(provider, slot, existingMissions, date).isValid
  );
};

export const getProviderDayInfo = (
  provider: Provider,
  missions: Mission[],
  date: string | dayjs.Dayjs
): ProviderDayInfo => {
  const dateStr = typeof date === 'string' ? date : date.format('YYYY-MM-DD');
  const dayMissions = getPrestationsOfProviderOnDay(missions, provider.id, dateStr);
  const totalHours = getProviderTotalHours(dayMissions);
  const availability = getProviderAvailabilityForDay(provider, dateStr);
  
  let status: 'unplanned' | 'partial' | 'full' = 'unplanned';
  if (totalHours > 0) {
    const hasMorning = dayMissions.some(m => parseInt(m.startTime.split(':')[0]) < 12);
    const hasAfternoon = dayMissions.some(m => parseInt(m.startTime.split(':')[0]) >= 12);
    status = hasMorning && hasAfternoon ? 'full' : 'partial';
  }
  
  return {
    provider,
    missions: dayMissions,
    totalHours,
    status,
    availability
  };
};

export const getStatutFacturation = (missions: Mission[], documentId: string): BillingStatus | null => {
  const docMissions = missions.filter(m => m.sourceDocumentId === documentId);
  
  if (docMissions.length === 0) {
    return null;
  }
  
  const totalMissions = docMissions.length;
  const completedMissions = docMissions.filter(m => m.status === 'completed').length;
  const isPackUltime = totalMissions >= 6;
  
  let status: 'pending' | 'partial' | 'complete' = 'pending';
  if (completedMissions >= 2) {
    status = completedMissions >= totalMissions && isPackUltime ? 'complete' : 'partial';
  }
  
  const firstMission = docMissions[0];
  
  return {
    documentId,
    clientName: firstMission?.clientName || 'Client inconnu',
    totalMissions,
    completedMissions,
    status,
    isPackUltime
  };
};

export const getAllBillingStatuses = (missions: Mission[]): BillingStatus[] => {
  const docIds = new Set<string>();
  missions.forEach(m => {
    if (m.sourceDocumentId) {
      docIds.add(m.sourceDocumentId);
    }
  });
  
  const statuses: BillingStatus[] = [];
  docIds.forEach(docId => {
    const status = getStatutFacturation(missions, docId);
    if (status && status.status !== 'pending') {
      statuses.push(status);
    }
  });
  
  return statuses.sort((a, b) => {
    if (a.status === 'complete' && b.status !== 'complete') return -1;
    if (b.status === 'complete' && a.status !== 'complete') return 1;
    return b.completedMissions - a.completedMissions;
  });
};

export const getProviderStatus = (providerId: string, missions: Mission[], date: string | dayjs.Dayjs): 'unplanned' | 'partial' | 'full' => {
  const dayMissions = getPrestationsOfProviderOnDay(missions, providerId, date);
  
  if (dayMissions.length === 0) return 'unplanned';
  
  const hasMorning = dayMissions.some(m => parseInt(m.startTime.split(':')[0]) < 12);
  const hasAfternoon = dayMissions.some(m => parseInt(m.startTime.split(':')[0]) >= 12);
  
  if (hasMorning && hasAfternoon) return 'full';
  return 'partial';
};

export const getAvailabilityIndicator = (providerId: string, missions: Mission[], date: string | dayjs.Dayjs): 'morning' | 'afternoon' | 'full' | 'none' => {
  const dayMissions = getPrestationsOfProviderOnDay(missions, providerId, date);
  
  if (dayMissions.length === 0) return 'full';
  
  const hasMorning = dayMissions.some(m => parseInt(m.startTime.split(':')[0]) < 12);
  const hasAfternoon = dayMissions.some(m => parseInt(m.startTime.split(':')[0]) >= 12);
  
  if (!hasMorning && !hasAfternoon) return 'full';
  if (!hasMorning) return 'morning';
  if (!hasAfternoon) return 'afternoon';
  return 'none';
};

export type DayColorStatus = 'available' | 'almost' | 'full' | 'closed';

export const getDayColorStatus = (
  providerId: string,
  missions: Mission[],
  date: string | dayjs.Dayjs,
  closedDays: Set<string> = new Set()
): DayColorStatus => {
  const dateStr = typeof date === 'string' ? date : date.format('YYYY-MM-DD');
  const isClosed = closedDays.has(`${providerId}-${dateStr}`);
  if (isClosed) return 'closed';
  
  const dayMissions = getPrestationsOfProviderOnDay(missions, providerId, dateStr);
  const totalHours = getProviderTotalHours(dayMissions);
  
  if (totalHours >= MAX_DAILY_HOURS) return 'full';
  if (totalHours >= 4) return 'almost';
  return 'available';
};

export const formatProviderPhone = (phone: string | undefined): string => {
  if (!phone) return '';
  const digits = phone.replace(/[^0-9]/g, '');
  return digits.startsWith('33') ? `+${digits}` : `33${digits}`;
};

export const generatePlanningMessage = (
  provider: Provider,
  missions: Mission[],
  date: dayjs.Dayjs
): string => {
  const formattedDate = date.format('dddd D MMMM');
  let message = `Bonjour ${provider.firstName} 👋\nVoici ton planning du ${formattedDate} :\n`;
  
  if (missions.length === 0) {
    message += `\nAucune mission prévue ce jour.`;
  } else {
    missions.forEach(mission => {
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
