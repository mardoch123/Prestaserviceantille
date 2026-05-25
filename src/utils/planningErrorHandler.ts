import { Provider, Mission } from '../../types';
import dayjs from 'dayjs';
import { TimeSlot, validateTimeSlot, getAvailableTimeSlots, PLANNING_TIME_SLOTS } from './planningDataLayer';

export interface PlanningError {
  type: 'overlap' | 'exceeds_limit' | 'unavailable' | 'data_conflict' | 'offline';
  title: string;
  message: string;
  details?: string;
  suggestedAction?: string;
}

export interface ConflictResolution {
  action: 'modify_slot' | 'choose_other_provider' | 'force' | 'cancel';
  reason?: string;
  forcedBy?: string;
  forcedAt?: string;
}

export interface ForcedAction {
  id: string;
  providerId: string;
  providerName: string;
  action: string;
  reason: string;
  forcedBy: string;
  forcedAt: string;
  missionId?: string;
}

const forcedActionsLog: ForcedAction[] = [];

export const getForcedActionsLog = (): ForcedAction[] => [...forcedActionsLog];

export const logForcedAction = (
  providerId: string,
  providerName: string,
  action: string,
  reason: string,
  missionId?: string
): void => {
  forcedActionsLog.push({
    id: `force_${Date.now()}`,
    providerId,
    providerName,
    action,
    reason,
    forcedBy: 'admin',
    forcedAt: new Date().toISOString(),
    missionId
  });
};

export const checkSlotConflicts = (
  provider: Provider,
  slot: TimeSlot,
  existingMissions: Mission[],
  date: dayjs.Dayjs | string
): PlanningError | null => {
  const validation = validateTimeSlot(provider, slot, existingMissions, date);
  
  if (!validation.isValid && validation.error) {
    if (validation.error.includes('Chevauchement')) {
      const overlappingMissions = existingMissions.filter(m => {
        const newStart = parseInt(slot.start.split(':')[0]);
        const newEnd = parseInt(slot.end.split(':')[0]);
        const mStart = parseInt(m.startTime.split(':')[0]);
        const mEnd = parseInt(m.endTime.split(':')[0]);
        return newStart < mEnd && newEnd > mStart;
      });
      
      const overlappingInfo = overlappingMissions
        .map(m => `${m.startTime}-${m.endTime}`)
        .join(', ');
      
      const alternativeSlots = getAvailableTimeSlots(provider, existingMissions, date);
      
      return {
        type: 'overlap',
        title: 'Créneau déjà occupé',
        message: `Ce créneau chevauche une prestation déjà planifiée (${overlappingInfo})`,
        details: `Choisissez un autre créneau ou attribuez cette prestation à une autre prestataire.`,
        suggestedAction: alternativeSlots.length > 0 
          ? `Alternative recommandée : ${alternativeSlots[0].label}`
          : undefined
      };
    }
    
    if (validation.error.includes('Dépassement')) {
      const currentHours = existingMissions.reduce((sum, m) => sum + (m.duration || 0), 0);
      const remainingHours = 7 - currentHours;
      
      return {
        type: 'exceeds_limit',
        title: 'Limite quotidienne dépassée',
        message: `${provider.firstName} a déjà ${currentHours}h de travail planifiées aujourd'hui.`,
        details: `Ajouter ce créneau de ${slot.duration}h dépasserait la limite de 7h.`,
        suggestedAction: remainingHours > 0 
          ? `Choisissez un créneau de ${remainingHours}h ou moins`
          : 'Cette prestataire ne peut plus accepter de mission aujourd\'hui'
      };
    }
    
    if (validation.error.includes('Indisponible') || validation.error.includes('hors des heures')) {
      const availableSlots = getAvailableTimeSlots(provider, existingMissions, date);
      
      return {
        type: 'unavailable',
        title: 'Prestataire non disponible',
        message: `${provider.firstName} n'est pas disponible sur ce créneau horaire.`,
        details: validation.error,
        suggestedAction: availableSlots.length > 0 
          ? `Créneaux disponibles : ${availableSlots.slice(0, 3).map(s => s.label).join(', ')}`
          : 'Aucune disponibilité pour cette prestataire aujourd\'hui'
      };
    }
    
    return {
      type: 'overlap',
      title: 'Erreur de planification',
      message: validation.error,
      details: 'Veuillez vérifier les disponibilités et réessayer.'
    };
  }
  
  return null;
};

export const checkDataConflicts = (
  provider: Provider,
  missions: Mission[],
  date: dayjs.Dayjs | string
): PlanningError[] => {
  const errors: PlanningError[] = [];
  const dateStr = typeof date === 'string' ? date : date.format('YYYY-MM-DD');
  
  const dayMissions = missions.filter(m => 
    m.providerId === provider.id && 
    m.date === dateStr &&
    m.status !== 'cancelled'
  );
  
  const totalHours = dayMissions.reduce((sum, m) => sum + (m.duration || 0), 0);
  
  if (totalHours > 7) {
    errors.push({
      type: 'data_conflict',
      title: 'Incohérence de données détectée',
      message: `Cette journée affiche ${totalHours}h de travail, mais la limite est de 7h.`,
      details: 'Les données peuvent avoir été modifiées par ailleurs.',
      suggestedAction: 'Vérifier et corriger les attributions si nécessaire'
    });
  }
  
  return errors;
};

export const formatErrorForUser = (error: PlanningError): string => {
  let message = `⚠️ ${error.title}\n\n${error.message}`;
  
  if (error.details) {
    message += `\n\n📋 Détails : ${error.details}`;
  }
  
  if (error.suggestedAction) {
    message += `\n\n💡 Solution : ${error.suggestedAction}`;
  }
  
  return message;
};

export const getAlternativeSlots = (
  provider: Provider,
  existingMissions: Mission[],
  date: dayjs.Dayjs | string,
  maxResults: number = 3
): TimeSlot[] => {
  return getAvailableTimeSlots(provider, existingMissions, date).slice(0, maxResults);
};

export const findAlternativeProvider = (
  providers: Provider[],
  slot: TimeSlot,
  missions: Mission[],
  date: dayjs.Dayjs | string,
  excludeProviderId?: string
): { provider: Provider; slot: TimeSlot } | null => {
  const dateStr = typeof date === 'string' ? date : date.format('YYYY-MM-DD');
  
  for (const provider of providers) {
    if (provider.id === excludeProviderId) continue;
    if (provider.status === 'Inactive' || provider.status === 'Passive') continue;
    
    const providerMissions = missions.filter(m => 
      m.providerId === provider.id && 
      m.date === dateStr &&
      m.status !== 'cancelled'
    );
    
    const validation = validateTimeSlot(provider, slot, providerMissions, dateStr);
    
    if (validation.isValid) {
      return { provider, slot };
    }
    
    const alternatives = getAvailableTimeSlots(provider, providerMissions, date).slice(0, 1);
    if (alternatives.length > 0) {
      return { provider, slot: alternatives[0] };
    }
  }
  
  return null;
};

export interface ConflictModalProps {
  error: PlanningError;
  alternativeSlots?: TimeSlot[];
  alternativeProvider?: { provider: Provider; slot: TimeSlot } | null;
  onModifySlot: (slot: TimeSlot) => void;
  onChooseOtherProvider: () => void;
  onForce: (reason: string) => void;
  onCancel: () => void;
}

export const getConflictResolutionActions = (
  error: PlanningError
): { canModify: boolean; canChooseOther: boolean; canForce: boolean } => {
  switch (error.type) {
    case 'overlap':
    case 'unavailable':
      return { canModify: true, canChooseOther: true, canForce: true };
    case 'exceeds_limit':
      return { canModify: true, canChooseOther: true, canForce: false };
    case 'data_conflict':
      return { canModify: false, canChooseOther: false, canForce: true };
    case 'offline':
      return { canModify: false, canChooseOther: false, canForce: false };
    default:
      return { canModify: false, canChooseOther: false, canForce: false };
  }
};
