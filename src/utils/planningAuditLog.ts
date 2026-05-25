import { Provider, Mission } from '../../types';
import dayjs from 'dayjs';

export type AuditActionType = 
  | 'mission_added'
  | 'mission_modified'
  | 'mission_deleted'
  | 'day_closed'
  | 'day_reopened'
  | 'whatsapp_sent'
  | 'exception_forced'
  | 'provider_changed'
  | 'slot_changed';

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actionType: AuditActionType;
  providerId?: string;
  providerName?: string;
  missionId?: string;
  missionDetails?: string;
  clientName?: string;
  sourceDocumentId?: string;
  previousValue?: string;
  newValue?: string;
  userId?: string;
  userName?: string;
  reason?: string;
  date: string;
}

const auditLog: AuditLogEntry[] = [];

export const getAuditLog = (): AuditLogEntry[] => [...auditLog];

export const getAuditLogForDate = (date: string): AuditLogEntry[] => {
  return auditLog.filter(entry => entry.date === date);
};

export const getAuditLogForProvider = (providerId: string): AuditLogEntry[] => {
  return auditLog.filter(entry => entry.providerId === providerId);
};

export const getAuditLogForDateRange = (startDate: string, endDate: string): AuditLogEntry[] => {
  return auditLog.filter(entry => entry.date >= startDate && entry.date <= endDate);
};

export const searchAuditLog = (
  query: string,
  options?: { startDate?: string; endDate?: string; actionType?: AuditActionType }
): AuditLogEntry[] => {
  let results = [...auditLog];
  
  if (options?.startDate) {
    results = results.filter(e => e.date >= options.startDate!);
  }
  if (options?.endDate) {
    results = results.filter(e => e.date <= options.endDate!);
  }
  if (options?.actionType) {
    results = results.filter(e => e.actionType === options.actionType);
  }
  
  if (query) {
    const lowerQuery = query.toLowerCase();
    results = results.filter(e => 
      e.providerName?.toLowerCase().includes(lowerQuery) ||
      e.clientName?.toLowerCase().includes(lowerQuery) ||
      e.missionDetails?.toLowerCase().includes(lowerQuery) ||
      e.reason?.toLowerCase().includes(lowerQuery) ||
      e.actionType.toLowerCase().includes(lowerQuery)
    );
  }
  
  return results.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
};

const generateId = (): string => `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

export const logMissionAdded = (
  provider: Provider,
  mission: Mission,
  timeSlot: string
): AuditLogEntry => {
  const entry: AuditLogEntry = {
    id: generateId(),
    timestamp: new Date().toISOString(),
    actionType: 'mission_added',
    providerId: provider.id,
    providerName: `${provider.firstName} ${provider.lastName}`,
    missionId: mission.id,
    missionDetails: timeSlot,
    clientName: mission.clientName,
    sourceDocumentId: mission.sourceDocumentId,
    date: mission.date,
    newValue: `${mission.startTime}-${mission.endTime} (${mission.duration}h)`
  };
  auditLog.unshift(entry);
  return entry;
};

export const logMissionModified = (
  provider: Provider,
  mission: Mission,
  previousSlot: string,
  newSlot: string
): AuditLogEntry => {
  const entry: AuditLogEntry = {
    id: generateId(),
    timestamp: new Date().toISOString(),
    actionType: 'mission_modified',
    providerId: provider.id,
    providerName: `${provider.firstName} ${provider.lastName}`,
    missionId: mission.id,
    missionDetails: `${previousSlot} → ${newSlot}`,
    clientName: mission.clientName,
    date: mission.date,
    previousValue: previousSlot,
    newValue: newSlot
  };
  auditLog.unshift(entry);
  return entry;
};

export const logMissionDeleted = (
  provider: Provider,
  mission: Mission,
  reason?: string
): AuditLogEntry => {
  const entry: AuditLogEntry = {
    id: generateId(),
    timestamp: new Date().toISOString(),
    actionType: 'mission_deleted',
    providerId: provider.id,
    providerName: `${provider.firstName} ${provider.lastName}`,
    missionId: mission.id,
    missionDetails: `${mission.startTime}-${mission.endTime}`,
    clientName: mission.clientName,
    date: mission.date,
    reason
  };
  auditLog.unshift(entry);
  return entry;
};

export const logDayClosed = (provider: Provider, date: string): AuditLogEntry => {
  const entry: AuditLogEntry = {
    id: generateId(),
    timestamp: new Date().toISOString(),
    actionType: 'day_closed',
    providerId: provider.id,
    providerName: `${provider.firstName} ${provider.lastName}`,
    date
  };
  auditLog.unshift(entry);
  return entry;
};

export const logDayReopened = (provider: Provider, date: string): AuditLogEntry => {
  const entry: AuditLogEntry = {
    id: generateId(),
    timestamp: new Date().toISOString(),
    actionType: 'day_reopened',
    providerId: provider.id,
    providerName: `${provider.firstName} ${provider.lastName}`,
    date
  };
  auditLog.unshift(entry);
  return entry;
};

export const logWhatsAppSent = (provider: Provider, missionCount: number): AuditLogEntry => {
  const entry: AuditLogEntry = {
    id: generateId(),
    timestamp: new Date().toISOString(),
    actionType: 'whatsapp_sent',
    providerId: provider.id,
    providerName: `${provider.firstName} ${provider.lastName}`,
    newValue: `${missionCount} mission(s)`,
    date: dayjs().format('YYYY-MM-DD')
  };
  auditLog.unshift(entry);
  return entry;
};

export const logExceptionForced = (
  provider: Provider,
  action: string,
  reason: string
): AuditLogEntry => {
  const entry: AuditLogEntry = {
    id: generateId(),
    timestamp: new Date().toISOString(),
    actionType: 'exception_forced',
    providerId: provider.id,
    providerName: `${provider.firstName} ${provider.lastName}`,
    newValue: action,
    reason,
    date: dayjs().format('YYYY-MM-DD')
  };
  auditLog.unshift(entry);
  return entry;
};

export const formatAuditEntry = (entry: AuditLogEntry): string => {
  const time = dayjs(entry.timestamp).format('HH:mm');
  
  switch (entry.actionType) {
    case 'mission_added':
      return `${time} — Prestation ajoutée pour ${entry.providerName} (${entry.newValue})`;
    case 'mission_modified':
      return `${time} — Prestation modifiée pour ${entry.providerName}: ${entry.previousValue} → ${entry.newValue}`;
    case 'mission_deleted':
      return `${time} — Prestation supprimée pour ${entry.providerName} (${entry.missionDetails})`;
    case 'day_closed':
      return `${time} — Jour clos pour ${entry.providerName}`;
    case 'day_reopened':
      return `${time} — Jour rouvert pour ${entry.providerName}`;
    case 'whatsapp_sent':
      return `${time} — Planning envoyé par WhatsApp à ${entry.providerName} (${entry.newValue})`;
    case 'exception_forced':
      return `${time} — ⚠️ Exception forcée: ${entry.newValue} (raison: ${entry.reason})`;
    default:
      return `${time} — ${entry.actionType}`;
  }
};

export const getActionTypeLabel = (actionType: AuditActionType): string => {
  const labels: Record<AuditActionType, string> = {
    mission_added: 'Ajout',
    mission_modified: 'Modification',
    mission_deleted: 'Suppression',
    day_closed: 'Clôture',
    day_reopened: 'Réouverture',
    whatsapp_sent: 'WhatsApp',
    exception_forced: 'Exception',
    provider_changed: 'Changement prestataire',
    slot_changed: 'Changement créneau'
  };
  return labels[actionType];
};

export const getActionTypeColor = (actionType: AuditActionType): string => {
  const colors: Record<AuditActionType, string> = {
    mission_added: 'bg-green-100 text-green-700',
    mission_modified: 'bg-blue-100 text-blue-700',
    mission_deleted: 'bg-red-100 text-red-700',
    day_closed: 'bg-cyan-100 text-cyan-700',
    day_reopened: 'bg-slate-100 text-slate-700',
    whatsapp_sent: 'bg-green-100 text-green-700',
    exception_forced: 'bg-amber-100 text-amber-700',
    provider_changed: 'bg-purple-100 text-purple-700',
    slot_changed: 'bg-indigo-100 text-indigo-700'
  };
  return colors[actionType];
};
