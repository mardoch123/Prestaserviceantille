import { supabase } from '../../utils/supabaseClient';
import type {
  ProviderWithAvailability,
  ProviderAvailabilitySlot,
  ProviderScheduleAssignment,
  CreateAssignmentInput,
  ProviderAvailabilityStatus,
  AvailabilityCalendarDay,
  ProviderDayInfo,
  UnassignedMission,
} from './types';

/**
 * Get all active providers with their availability for a date range
 */
export async function getProvidersWithAvailability(
  startDate: string,
  endDate: string
): Promise<ProviderWithAvailability[]> {
  // Get all active providers (limit 100)
  const { data: providersData, error: providersError } = await supabase
    .from('providers')
    .select('id, first_name, last_name, email, phone, specialty, status, rating')
    .in('status', ['Active', 'Passive'])
    .order('first_name', { ascending: true })
    .limit(100);

  if (providersError) {
    console.error('Error fetching providers:', providersError);
    throw providersError;
  }

  if (!providersData || providersData.length === 0) {
    return [];
  }

  // Get provider availability slots for the date range (limit 100)
  const { data: availabilityData, error: availabilityError } = await supabase
    .from('provider_availability')
    .select('*')
    .gte('date', startDate)
    .lte('date', endDate)
    .limit(100);

  if (availabilityError) {
    console.error('Error fetching availability:', availabilityError);
    throw availabilityError;
  }

  // Get scheduled assignments (missions) for the date range (limit 100)
  const { data: missionsData, error: missionsError } = await supabase
    .from('missions')
    .select('id, provider_id, client_id, client_name, date, start_time, end_time, service, status')
    .gte('date', startDate)
    .lte('date', endDate)
    .not('provider_id', 'is', null)
    .limit(100);

  if (missionsError) {
    console.error('Error fetching missions:', missionsError);
    throw missionsError;
  }

  // Build availability map for each provider
  const availabilityMap = new Map<string, Map<string, ProviderAvailabilitySlot>>();
  const availableSlotsMap = new Map<string, Map<string, { startTime: string; endTime: string }[]>>();

  providersData.forEach((provider: any) => {
    availabilityMap.set(provider.id, new Map());
    availableSlotsMap.set(provider.id, new Map());
  });

  // Populate availability from database
  availabilityData?.forEach((slot: any) => {
    const providerMap = availabilityMap.get(slot.provider_id);
    const providerSlotsMap = availableSlotsMap.get(slot.provider_id);
    
    if (providerMap) {
      providerMap.set(slot.date, {
        id: slot.id,
        providerId: slot.provider_id,
        date: slot.date,
        slots: slot.slots || [],
        status: slot.status,
        notes: slot.notes,
        createdAt: slot.created_at,
        updatedAt: slot.updated_at,
      });
    }
    
    // Store available time slots for 'available' status
    if (providerSlotsMap && slot.status === 'available' && slot.slots && slot.slots.length > 0) {
      providerSlotsMap.set(slot.date, slot.slots);
    }
  });

  // Map providers with their availability
  return providersData.map((provider: any) => {
    const domain = mapSpecialtyToDomain(provider.specialty);
    const providerAvailability = availabilityMap.get(provider.id) || new Map();
    const providerAvailableSlots = availableSlotsMap.get(provider.id) || new Map();

    return {
      id: provider.id,
      firstName: provider.first_name,
      lastName: provider.last_name,
      email: provider.email || '',
      phone: provider.phone || '',
      specialty: provider.specialty || '',
      domain,
      status: provider.status,
      rating: provider.rating || 0,
      availability: providerAvailability,
      availableSlots: providerAvailableSlots,
    };
  });
}

/**
 * Get availability calendar data for a date range
 */
export async function getAvailabilityCalendar(
  startDate: string,
  endDate: string
): Promise<AvailabilityCalendarDay[]> {
  const providers = await getProvidersWithAvailability(startDate, endDate);

  // Generate calendar days
  const days: AvailabilityCalendarDay[] = [];
  const currentDate = new Date(startDate);
  const end = new Date(endDate);

  while (currentDate <= end) {
    const dateStr = currentDate.toISOString().split('T')[0];
    const dayOfWeek = currentDate.getDay();

    const providersForDay: ProviderDayInfo[] = providers.map((provider) => {
      const status = provider.availability.get(dateStr) || 'available';

      return {
        providerId: provider.id,
        providerName: `${provider.firstName} ${provider.lastName}`,
        domain: provider.domain,
        status,
        assignedSlots: [],
        availableSlots: status === 'available' ? [{ startTime: '08:00', endTime: '18:00' }] : [],
      };
    });

    days.push({
      date: dateStr,
      dayOfWeek,
      dayOfMonth: currentDate.getDate(),
      isCurrentMonth: true,
      isToday: dateStr === new Date().toISOString().split('T')[0],
      providers: providersForDay,
    });

    currentDate.setDate(currentDate.getDate() + 1);
  }

  return days;
}

/**
 * Create a new schedule assignment for a provider
 */
export async function createProviderAssignment(
  input: CreateAssignmentInput
): Promise<ProviderScheduleAssignment | null> {
  const { data, error } = await supabase
    .from('missions')
    .insert({
      provider_id: input.providerId,
      client_id: input.clientId,
      client_name: input.clientName,
      date: input.date,
      start_time: input.startTime,
      end_time: input.endTime,
      service: input.serviceType,
      status: 'planned',
      color: 'blue',
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating assignment:', error);
    throw error;
  }

  if (!data) return null;

  return {
    id: data.id,
    providerId: data.provider_id,
    missionId: data.id,
    clientId: data.client_id,
    clientName: data.client_name,
    date: data.date,
    startTime: data.start_time,
    endTime: data.end_time,
    serviceType: data.service,
    status: 'assigned',
    notes: data.notes,
    createdAt: data.created_at,
  };
}

/**
 * Update provider availability status for a specific date
 */
export async function updateProviderAvailability(
  providerId: string,
  date: string,
  status: ProviderAvailabilityStatus,
  slots?: { startTime: string; endTime: string }[],
  notes?: string
): Promise<ProviderAvailabilitySlot | null> {
  // Check if availability record exists
  const { data: existing, error: checkError } = await supabase
    .from('provider_availability')
    .select('id')
    .eq('provider_id', providerId)
    .eq('date', date)
    .single();

  if (checkError && checkError.code !== 'PGRST116') {
    console.error('Error checking existing availability:', checkError);
    throw checkError;
  }

  const now = new Date().toISOString();
  const slotsData = slots?.map(s => ({ startTime: s.startTime, endTime: s.endTime })) || [];

  if (existing) {
    // Update existing record
    const { data, error } = await supabase
      .from('provider_availability')
      .update({
        status,
        slots: slotsData,
        notes,
        updated_at: now,
      })
      .eq('id', existing.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating availability:', error);
      throw error;
    }

    return data ? mapDbToAvailabilitySlot(data) : null;
  } else {
    // Create new record
    const { data, error } = await supabase
      .from('provider_availability')
      .insert({
        provider_id: providerId,
        date,
        status,
        slots: slotsData,
        notes,
        created_at: now,
        updated_at: now,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating availability:', error);
      throw error;
    }

    return data ? mapDbToAvailabilitySlot(data) : null;
  }
}

/**
 * Get unassigned missions (missions without provider_id) for a date range
 */
export async function getUnassignedMissions(
  startDate: string,
  endDate: string
): Promise<UnassignedMission[]> {
  // First try: provider_id is null (limit 100)
  const { data: data1, error: error1 } = await supabase
    .from('missions')
    .select('id, client_id, client_name, date, start_time, end_time, service, status, duration, provider_id')
    .gte('date', startDate)
    .lte('date', endDate)
    .is('provider_id', null)
    .neq('status', 'cancelled')
    .order('date', { ascending: true })
    .limit(100);

  if (error1) {
    console.error('Error fetching unassigned missions (null check):', error1);
  }

  // Second try: provider_id is empty string (as fallback) (limit 100)
  const { data: data2, error: error2 } = await supabase
    .from('missions')
    .select('id, client_id, client_name, date, start_time, end_time, service, status, duration, provider_id')
    .gte('date', startDate)
    .lte('date', endDate)
    .eq('provider_id', '')
    .neq('status', 'cancelled')
    .order('date', { ascending: true })
    .limit(100);

  if (error2) {
    console.error('Error fetching unassigned missions (empty check):', error2);
  }

  // Combine results and remove duplicates
  const allMissions = [...(data1 || []), ...(data2 || [])];
  const uniqueMissions = allMissions.filter((m, index, self) => 
    index === self.findIndex((t) => t.id === m.id)
  );

  console.log(`Found ${uniqueMissions.length} unassigned missions between ${startDate} and ${endDate}`);

  return uniqueMissions.map((m: any) => ({
    id: m.id,
    clientId: m.client_id,
    clientName: m.client_name,
    date: m.date,
    startTime: m.start_time,
    endTime: m.end_time,
    service: m.service,
    status: m.status,
    duration: m.duration || 0,
  }));
}

/**
 * Check if a provider has a mission time conflict
 */
export async function checkProviderMissionConflict(
  providerId: string,
  date: string,
  startTime: string,
  endTime: string,
  excludeMissionId?: string
): Promise<{ hasConflict: boolean; conflictingMission?: any }> {
  // Get all missions for this provider on this date
  const { data: missions, error } = await supabase
    .from('missions')
    .select('id, client_name, start_time, end_time, service, status')
    .eq('provider_id', providerId)
    .eq('date', date)
    .neq('status', 'cancelled');

  if (error) {
    console.error('Error checking mission conflicts:', error);
    throw error;
  }

  // Convert times to minutes for comparison
  const missionStart = timeToMinutes(startTime);
  const missionEnd = timeToMinutes(endTime);

  // Check for conflicts
  for (const mission of (missions || [])) {
    // Skip the mission we're trying to assign (in case of update)
    if (excludeMissionId && mission.id === excludeMissionId) continue;

    const existingStart = timeToMinutes(mission.start_time);
    const existingEnd = timeToMinutes(mission.end_time);

    // Check if time ranges overlap
    // Overlap occurs when: missionStart < existingEnd AND missionEnd > existingStart
    if (missionStart < existingEnd && missionEnd > existingStart) {
      return {
        hasConflict: true,
        conflictingMission: mission
      };
    }
  }

  return { hasConflict: false };
}

/**
 * Assign an existing unassigned mission to a provider
 */
export async function assignMissionToProvider(
  missionId: string,
  providerId: string,
  providerName: string
): Promise<void> {
  // First, get the mission details to check for conflicts
  const { data: mission, error: missionError } = await supabase
    .from('missions')
    .select('date, start_time, end_time')
    .eq('id', missionId)
    .single();

  if (missionError) {
    console.error('Error fetching mission:', missionError);
    throw missionError;
  }

  // Check for time conflicts
  const conflictCheck = await checkProviderMissionConflict(
    providerId,
    mission.date,
    mission.start_time,
    mission.end_time,
    missionId
  );

  if (conflictCheck.hasConflict) {
    const conflict = conflictCheck.conflictingMission;
    throw new Error(
      `Conflit d'horaire : le prestataire a déjà une mission assignée de ${conflict.start_time} à ${conflict.end_time} pour ${conflict.client_name}`
    );
  }

  const { error } = await supabase
    .from('missions')
    .update({
      provider_id: providerId,
      provider_name: providerName,
      color: 'orange',
      updated_at: new Date().toISOString(),
    })
    .eq('id', missionId);

  if (error) {
    console.error('Error assigning mission:', error);
    throw error;
  }
}

/**
 * Get clients for assignment dropdown (limit 100)
 */
export async function getClientsForAssignment(): Promise<{ id: string; name: string }[]> {
  const { data, error } = await supabase
    .from('clients')
    .select('id, name')
    .eq('status', 'active')
    .order('name', { ascending: true })
    .limit(100);

  if (error) {
    console.error('Error fetching clients:', error);
    throw error;
  }

  return (data || []).map((c: any) => ({ id: c.id, name: c.name }));
}

// Helper functions
function mapSpecialtyToDomain(specialty: string): any {
  const specialtyLower = (specialty || '').toLowerCase();
  if (specialtyLower.includes('ménage') || specialtyLower.includes('menage')) return 'Ménage';
  if (specialtyLower.includes('jardin')) return 'Jardinage';
  if (specialtyLower.includes('bricol')) return 'Bricolage';
  return 'Autre';
}

function mapDbToAvailabilitySlot(data: any): ProviderAvailabilitySlot {
  return {
    id: data.id,
    providerId: data.provider_id,
    date: data.date,
    slots: data.slots || [],
    status: data.status,
    notes: data.notes,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

function calculateAvailableSlots(
  assignedSlots: { startTime: string; endTime: string }[],
  status: string
): { startTime: string; endTime: string }[] {
  if (status === 'leave' || status === 'unavailable') return [];

  // Standard working hours: 08:00 - 18:00
  const workStart = 8 * 60; // 8:00 in minutes
  const workEnd = 18 * 60; // 18:00 in minutes

  // Convert assigned slots to minute ranges
  const busyRanges = assignedSlots.map((slot) => ({
    start: timeToMinutes(slot.startTime),
    end: timeToMinutes(slot.endTime),
  }));

  // Find free slots
  const availableSlots: { startTime: string; endTime: string }[] = [];
  let currentStart = workStart;

  // Sort busy ranges by start time
  busyRanges.sort((a, b) => a.start - b.start);

  for (const busy of busyRanges) {
    if (busy.start > currentStart) {
      availableSlots.push({
        startTime: minutesToTime(currentStart),
        endTime: minutesToTime(busy.start),
      });
    }
    currentStart = Math.max(currentStart, busy.end);
  }

  // Add remaining time after last busy slot
  if (currentStart < workEnd) {
    availableSlots.push({
      startTime: minutesToTime(currentStart),
      endTime: minutesToTime(workEnd),
    });
  }

  return availableSlots;
}

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

/**
 * Get provider by ID
 */
export async function getProviderById(providerId: string): Promise<{ id: string; firstName: string; lastName: string; specialty: string } | null> {
  const { data, error } = await supabase
    .from('providers')
    .select('id, first_name, last_name, specialty')
    .eq('id', providerId)
    .single();

  if (error) {
    console.error('Error fetching provider:', error);
    return null;
  }

  if (!data) return null;

  return {
    id: data.id,
    firstName: data.first_name,
    lastName: data.last_name,
    specialty: data.specialty || '',
  };
}
