import React, { useState, useMemo, useRef, useEffect } from 'react';
import PageLoader from './PageLoader';
import dayjs from 'dayjs';
import { ChevronLeft, ChevronRight, Plus, X, CheckCircle, User, AlertCircle, Search, Mail, Repeat, Trash2, CheckSquare, Square, AlertTriangle, Loader2, Calendar, Bell, Flag, Briefcase, FileText, RotateCcw, SlidersHorizontal, Copy as CopyIcon } from 'lucide-react';
import { useData } from '../context/DataContext'; 
import { Mission } from '../types';
import { useNavigate } from 'react-router-dom';
import { getMartiniqueToday } from '../src/utils/martiniqueTime';
import { getMartiniqueNow as getMartiniqueNowDayjs, MARTINIQUE_TIMEZONE } from '../src/utils/dayjsMartinique';
import SearchableSelect from './SearchableSelect';
import { matchesServiceTypeFilterFromText } from '../utils/serviceTypes';

const Planning: React.FC = () => {
  const { missions, providers, clients, packs, documents, addMission, assignProvider, updateMission, deleteMissions, refreshData, reminders, addReminder, toggleReminder, serviceTypeFilter, requestMissionReschedule, loadMissionsForRange, getMissionDetails, dataLoading } = useData();
  const navigate = useNavigate();

  const submitLockRef = useRef(false);

  // Filter State
  const [selectedProvider, setSelectedProvider] = useState<string>('all');
  const [selectedClient, setSelectedClient] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [currentWeekOffset, setCurrentWeekOffset] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [customDateRange, setCustomDateRange] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [focusedDate, setFocusedDate] = useState(getMartiniqueToday());
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [isMobileActionsOpen, setIsMobileActionsOpen] = useState(false);
  const [planningLoading, setPlanningLoading] = useState(false);
  const [planningProgress, setPlanningProgress] = useState(0);
  const [encouragementIndex, setEncouragementIndex] = useState(0);
  
  // Modal & Toast
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isReminderModalOpen, setIsReminderModalOpen] = useState(false);
  const [isQuickPlanModalOpen, setIsQuickPlanModalOpen] = useState(false);
  const [isStatsModalOpen, setIsStatsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<{ show: boolean; message: string; type?: 'success' | 'error' | 'warning' }>({ show: false, message: '', type: 'success' });

  const showToast = (message: string, type: 'success' | 'error' | 'warning' = 'success') => {
      setToast({ show: true, message, type });
      setTimeout(() => setToast({ show: false, message: '', type }), 3000);
  };

  const isQuoteExpired = (doc: any): boolean => {
      if (!doc) return true;
      if (String(doc.status || '') === 'expired') return true;
      const createdAtRaw = (doc as any)?.created_at || (doc as any)?.createdAt;
      if (!createdAtRaw) return false;
      const createdAtMs = new Date(createdAtRaw).getTime();
      if (!Number.isFinite(createdAtMs)) return false;
      return (Date.now() - createdAtMs) > (48 * 60 * 60 * 1000);
  };

  // Selection State for Unassigned Missions
  const [selectedMissionId, setSelectedMissionId] = useState<string | null>(null);
  const [assignProviderId, setAssignProviderId] = useState<string>('');
  
  // BULK DELETE STATE
  const [selectedMissionIds, setSelectedMissionIds] = useState<Set<string>>(new Set());
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  // Form State - Mission
  const initialFormState = {
      clientId: '',
      service: '',
      providerId: '',
      date: '',
      startTime: '09:00',
      endTime: '11:00',
      endDate: '', // Optionnel si différent
      recurrence: 'none',
      occurrences: 1
  };
  const [missionForm, setMissionForm] = useState(initialFormState);

  // Form State - Reminder
  const [reminderForm, setReminderForm] = useState({
      text: '',
      date: getMartiniqueToday(),
      notifyEmail: true
  });

  const [quickPlanForm, setQuickPlanForm] = useState({
      clientId: '',
      date: getMartiniqueToday(),
      startTime: '09:00',
      endTime: '11:00'
  });

  // Calculate Week Date Range
  const getWeekRange = (offset: number) => {
      const now = getMartiniqueNowDayjs();
      const day = now.day() === 0 ? 7 : now.day();
      const start = now.startOf('day').subtract(day - 1, 'day').add(offset * 7, 'day');
      const end = start.add(6, 'day');
      return { start, end };
  };

  const { start: weekStart, end: weekEnd } = useMemo(() => getWeekRange(currentWeekOffset), [currentWeekOffset]);

  const { rangeStartStr, rangeEndStr } = useMemo(() => {
      if (customDateRange && startDate && endDate) {
          return { rangeStartStr: startDate, rangeEndStr: endDate };
      }
      return { rangeStartStr: weekStart.format('YYYY-MM-DD'), rangeEndStr: weekEnd.format('YYYY-MM-DD') };
  }, [customDateRange, startDate, endDate, weekStart, weekEnd]);

  const colDates = useMemo(() => {
      const base = Array.from({ length: 6 }, () => '');
      if (!rangeStartStr || !rangeEndStr) return base;

      if (!customDateRange) {
          return [0, 1, 2, 3, 4, 5].map(i => weekStart.add(i, 'day').format('YYYY-MM-DD'));
      }

      const start = dayjs.tz(rangeStartStr, 'YYYY-MM-DD', MARTINIQUE_TIMEZONE);
      const end = dayjs.tz(rangeEndStr, 'YYYY-MM-DD', MARTINIQUE_TIMEZONE);
      const byCol = new Map<number, string>();
      let cursor = start;
      while (cursor.isSame(end, 'day') || cursor.isBefore(end, 'day')) {
          const dateStr = cursor.format('YYYY-MM-DD');
          const dow = dayjs.tz(dateStr, 'YYYY-MM-DD', MARTINIQUE_TIMEZONE).day();
          const col = dow === 0 ? 5 : dow - 1;
          if (!byCol.has(col)) byCol.set(col, dateStr);
          cursor = cursor.add(1, 'day');
      }
      return [0, 1, 2, 3, 4, 5].map(i => byCol.get(i) || '');
  }, [customDateRange, rangeStartStr, rangeEndStr, weekStart]);

  useEffect(() => {
      const startStr = String(rangeStartStr || '').trim();
      const endStr = String(rangeEndStr || '').trim();
      if (!startStr || !endStr) return;

      const isInRange = (dateStr: string) => {
          const d = String(dateStr || '').trim();
          if (!d) return false;
          return d >= startStr && d <= endStr;
      };

      if (customDateRange && startDate && endDate && startDate === endDate) {
          setFocusedDate(startDate);
          return;
      }

      if (!isInRange(focusedDate)) {
          setFocusedDate(startStr);
      }
  }, [customDateRange, startDate, endDate, rangeStartStr, rangeEndStr, focusedDate]);

  const lastRangeRef = useRef<string>('');
  const pendingRangeRef = useRef<string>('');
  const backgroundRefreshInFlightRef = useRef(false);

  useEffect(() => {
      let startStr = '';
      let endStr = '';
      if (customDateRange && startDate && endDate) {
          startStr = startDate;
          endStr = endDate;
      } else {
          startStr = weekStart.format('YYYY-MM-DD');
          endStr = weekEnd.format('YYYY-MM-DD');
      }
      if (!startStr || !endStr) return;
      const key = `${startStr}_${endStr}`;
      if (lastRangeRef.current === key || pendingRangeRef.current === key) return;
      pendingRangeRef.current = key;
      let active = true;
      const run = async () => {
          try {
              setPlanningLoading(true);
              setPlanningProgress(5);
              if (loadMissionsForRange) {
                  const timeoutPromise = new Promise(resolve => setTimeout(() => resolve('timeout'), 12000));
                  const result = await Promise.race([
                      loadMissionsForRange(startStr, endStr, (p) => {
                          if (active) setPlanningProgress(p);
                      }),
                      timeoutPromise
                  ]);
                  if (result === 'timeout') {
                      if (active) {
                          setPlanningProgress(100);
                          showToast('Chargement prolongé, le planning continue en arrière-plan.', 'warning');
                      }
                      pendingRangeRef.current = '';
                      return;
                  }
                  if (result === true) {
                      lastRangeRef.current = key;
                  } else {
                      pendingRangeRef.current = '';
                  }
              }
              if (active) setPlanningProgress(100);
          } finally {
              if (active) {
                  setTimeout(() => {
                      if (active) setPlanningLoading(false);
                  }, 300);
              }
              pendingRangeRef.current = '';
          }
      };
      run();
      return () => {
          active = false;
      };
  }, [customDateRange, startDate, endDate, weekStart, weekEnd, loadMissionsForRange]);

  useEffect(() => {
      if (!loadMissionsForRange) return;

      let startStr = '';
      let endStr = '';
      if (customDateRange && startDate && endDate) {
          startStr = startDate;
          endStr = endDate;
      } else {
          startStr = weekStart.format('YYYY-MM-DD');
          endStr = weekEnd.format('YYYY-MM-DD');
      }
      if (!startStr || !endStr) return;

      const interval = setInterval(async () => {
          if (backgroundRefreshInFlightRef.current) return;
          backgroundRefreshInFlightRef.current = true;
          try {
              await loadMissionsForRange(startStr, endStr);
          } catch {
          } finally {
              backgroundRefreshInFlightRef.current = false;
          }
      }, 5000);

      return () => clearInterval(interval);
  }, [customDateRange, startDate, endDate, weekStart, weekEnd, loadMissionsForRange]);

  const encouragementMessages = [
      'On prépare votre planning… encore un instant.',
      'Merci pour votre patience, tout arrive.',
      'Vos missions se chargent, vous êtes presque prêt.',
      'On optimise l’affichage pour une navigation fluide.',
      'Dernières étapes, le planning est en route.'
  ];

  useEffect(() => {
      if (!planningLoading) return;
      const timer = setInterval(() => {
          setEncouragementIndex(prev => (prev + 1) % encouragementMessages.length);
      }, 2500);
      return () => clearInterval(timer);
  }, [planningLoading, encouragementMessages.length]);

  useEffect(() => {
      if (!planningLoading) return;
      const timer = setInterval(() => {
          setPlanningProgress(prev => {
              if (prev >= 90) return prev;
              return Math.min(90, prev + 2);
          });
      }, 600);
      return () => clearInterval(timer);
  }, [planningLoading]);



  // Format date range for display
  const dateRangeString = `Semaine du ${weekStart.format('DD/MM/YYYY')} au ${weekEnd.format('DD/MM/YYYY')}`;

  // Filter Logic (Missions & Reminders)
  const { filteredMissions, filteredReminders } = useMemo(() => {
      let startStr: string, endStr: string;
      
      if (customDateRange && startDate && endDate) {
          startStr = startDate;
          endStr = endDate;
      } else {
          startStr = weekStart.format('YYYY-MM-DD');
          endStr = weekEnd.format('YYYY-MM-DD');
      }
      
      // Missions
      let fMissions = missions
        .filter(m => matchesServiceTypeFilterFromText(m.service, serviceTypeFilter))
        .filter(m => m.date >= startStr && m.date <= endStr);
      
      // Filter by provider
      if (selectedProvider !== 'all') {
          fMissions = fMissions.filter(item => item.providerName === selectedProvider);
      }
      
      // Filter by client
      if (selectedClient !== 'all') {
          fMissions = fMissions.filter(item => item.clientName === selectedClient);
      }
      
      // Filter by status
      if (selectedStatus !== 'all') {
          fMissions = fMissions.filter(item => item.status === selectedStatus);
      }
      
      // Search query
      if (searchQuery) {
          const query = searchQuery.toLowerCase();
          fMissions = fMissions.filter(item => 
              item.clientName.toLowerCase().includes(query) ||
              (item.providerName && item.providerName.toLowerCase().includes(query)) ||
              item.service.toLowerCase().includes(query) ||
              item.date.includes(query)
          );
      }

      // Reminders (Only for the date range, no provider filter usually, unless tagged)
      let fReminders = reminders.filter(r => r.date >= startStr && r.date <= endStr);
      
      return { filteredMissions: fMissions, filteredReminders: fReminders };
  }, [missions, reminders, selectedProvider, selectedClient, selectedStatus, currentWeekOffset, searchQuery, weekStart, weekEnd, customDateRange, startDate, endDate, serviceTypeFilter]);

  const filteredProvisionalMissions = useMemo(() => {
      let startStr, endStr;
      
      if (customDateRange && startDate && endDate) {
          startStr = startDate;
          endStr = endDate;
      } else {
          startStr = weekStart.format('YYYY-MM-DD');
          endStr = weekEnd.format('YYYY-MM-DD');
      }

      const provisional = (documents || [])
          .filter(d => d.type === 'Devis')
          .filter(d => d.status === 'sent')
          .filter(d => !isQuoteExpired(d))
          .filter(d => {
              if (!serviceTypeFilter || serviceTypeFilter === 'all') return true;
              const category = String((d as any)?.category || '').trim().toLowerCase();
              const persisted = String((d as any)?.serviceType || (d as any)?.service_type || '').trim();
              if (serviceTypeFilter === 'Personnalisé') return persisted === 'Personnalisé' || category === 'custom';
              return persisted === serviceTypeFilter;
          })
          .filter(d => Array.isArray(d.slotsData) && d.slotsData.length > 0)
          .flatMap(d => (d.slotsData || []).map((slot: any, index: number) => ({
              id: `provisional-${d.id}-${index}-${slot?.date || 'no-date'}-${slot?.startTime || 'no-start'}`,
              date: slot?.date,
              startTime: slot?.startTime,
              endTime: slot?.endTime,
              duration: typeof slot?.duration === 'number' ? slot.duration : 0,
              service: d.description || 'Devis',
              clientId: d.clientId,
              clientName: d.clientName,
              providerId: null,
              providerName: 'À assigner',
              status: 'planned' as const,
              sourceDocumentId: d.id
          })))
          .filter(item => !!item.date)
          .filter(item => item.date >= startStr && item.date <= endStr);

      let fProvisional = provisional;

      if (selectedProvider !== 'all') {
          fProvisional = fProvisional.filter(item => item.providerName === selectedProvider);
      }

      if (selectedClient !== 'all') {
          fProvisional = fProvisional.filter(item => item.clientName === selectedClient);
      }

      if (selectedStatus !== 'all') {
          fProvisional = fProvisional.filter(item => item.status === selectedStatus);
      }

      if (searchQuery) {
          const query = searchQuery.toLowerCase();
          fProvisional = fProvisional.filter(item =>
              item.clientName.toLowerCase().includes(query) ||
              item.providerName.toLowerCase().includes(query) ||
              item.date.includes(query)
          );
      }

      return fProvisional;
  }, [documents, selectedProvider, selectedClient, selectedStatus, searchQuery, weekStart, weekEnd, customDateRange, startDate, endDate, serviceTypeFilter]);

  useEffect(() => {
      if (!planningLoading) return;
      const hasContent = filteredMissions.length > 0 || filteredProvisionalMissions.length > 0 || filteredReminders.length > 0;
      if (hasContent) {
          setPlanningProgress(100);
          setPlanningLoading(false);
          return;
      }
      const timeoutId = setTimeout(() => {
          setPlanningProgress(100);
          setPlanningLoading(false);
      }, 15000);
      return () => clearTimeout(timeoutId);
  }, [planningLoading, filteredMissions.length, filteredProvisionalMissions.length, filteredReminders.length]);

  // Stats Logic
  const statsDate = focusedDate || getMartiniqueToday();
  const missionsCountToday = missions.filter(m => String(m.date || '') === String(statsDate)).length; 
  const missionsCountWeek = filteredMissions.length; 
  const missionsCompletedWeek = filteredMissions.filter(m => m.status === 'completed').length;

  const totalHoursToday = useMemo(() => {
      const computeDuration = (date: string, startTime: string, endTime: string, fallback: any) => {
          const start = String(startTime || '').trim();
          const end = String(endTime || '').trim();
          const d = String(date || '').trim();
          if (d && start && end) {
              const endDate = end < start ? dayjs.tz(d, 'YYYY-MM-DD', MARTINIQUE_TIMEZONE).add(1, 'day').format('YYYY-MM-DD') : d;
              const v = calculateDuration(d, start, endDate, end);
              if (Number.isFinite(v) && v > 0) return v;
          }
          const f = Number(fallback);
          return Number.isFinite(f) && f > 0 ? f : 0;
      };

      const missionsHours = (missions || [])
          .filter(m => String(m?.date || '') === statsDate)
          .filter(m => String((m as any)?.status || '') !== 'cancelled')
          .reduce((acc, m: any) => acc + computeDuration(m.date, m.startTime, m.endTime, m.duration), 0);

      const provisionalHours = (documents || [])
          .filter((d: any) => d?.type === 'Devis')
          .filter((d: any) => d?.status === 'sent')
          .filter((d: any) => !isQuoteExpired(d))
          .filter((d: any) => Array.isArray(d?.slotsData) && d.slotsData.length > 0)
          .flatMap((d: any) => (d.slotsData || []).map((slot: any) => ({
              date: slot?.date,
              startTime: slot?.startTime,
              endTime: slot?.endTime,
              duration: slot?.duration
          })))
          .filter((s: any) => String(s?.date || '') === statsDate)
          .reduce((acc: number, s: any) => acc + computeDuration(s.date, s.startTime, s.endTime, s.duration), 0);

      return Number((missionsHours + provisionalHours).toFixed(2));
  }, [missions, documents, statsDate, isQuoteExpired]);

  const totalHoursFiltered = filteredMissions
      .reduce((acc, m) => acc + m.duration, 0);

  const mobilePlanningDays = useMemo(() => {
      let startStr: string, endStr: string;

      if (customDateRange && startDate && endDate) {
          startStr = startDate;
          endStr = endDate;
      } else {
          startStr = weekStart.format('YYYY-MM-DD');
          endStr = weekEnd.format('YYYY-MM-DD');
      }

      const dates: string[] = [];
      let cursor = dayjs.tz(startStr, 'YYYY-MM-DD', MARTINIQUE_TIMEZONE);
      const end = dayjs.tz(endStr, 'YYYY-MM-DD', MARTINIQUE_TIMEZONE);
      while (cursor.isSame(end, 'day') || cursor.isBefore(end, 'day')) {
          dates.push(cursor.format('YYYY-MM-DD'));
          cursor = cursor.add(1, 'day');
      }

      return dates.map((dateStr) => {
          const remindersForDate = (filteredReminders || []).filter((r: any) => String(r?.date || '') === dateStr && !r.completed);
          const provisionalForDate = (filteredProvisionalMissions || []).filter((m: any) => String(m?.date || '') === dateStr);
          const missionsForDate = (filteredMissions || []).filter((m: any) => String(m?.date || '') === dateStr).filter((m: any) => m.status !== 'cancelled');
          return { dateStr, remindersForDate, provisionalForDate, missionsForDate };
      });
  }, [filteredReminders, filteredProvisionalMissions, filteredMissions, customDateRange, startDate, endDate, weekStart, weekEnd]);


  const handlePrevWeek = () => setCurrentWeekOffset(prev => prev - 1);
  const handleNextWeek = () => setCurrentWeekOffset(prev => prev + 1);
  const handleCurrentWeek = () => setCurrentWeekOffset(0);

  const isProviderNonWorkingDay = (providerId: string, dateStr: string) => {
      const provider = providers.find(p => p.id === providerId);
      if (!provider) return false;
      const day = dayjs.tz(dateStr, 'YYYY-MM-DD', MARTINIQUE_TIMEZONE).day();
      const days = (provider as any)?.nonInterventionDays;
      return Array.isArray(days) && days.includes(day);
  };

  const isProviderNonWorkingHours = (providerId: string, dateStr: string, startTime: string, endTime: string) => {
      const provider = providers.find(p => p.id === providerId);
      if (!provider) return false;
      const day = dayjs.tz(dateStr, 'YYYY-MM-DD', MARTINIQUE_TIMEZONE).day();
      const ranges = (provider as any)?.nonInterventionHours && typeof (provider as any)?.nonInterventionHours === 'object'
          ? (provider as any).nonInterventionHours[day]
          : undefined;
      if (!Array.isArray(ranges) || ranges.length === 0) return false;

      const toMinutes = (t: any) => {
          const raw = String(t || '').trim();
          if (!raw) return NaN;
          const base = raw.includes(':') ? raw.split(':') : [];
          const h = base.length > 0 ? parseInt(base[0], 10) : NaN;
          const m = base.length > 1 ? parseInt(base[1], 10) : NaN;
          if (!Number.isFinite(h) || !Number.isFinite(m)) return NaN;
          return h * 60 + m;
      };

      const s = toMinutes(startTime);
      const e = toMinutes(endTime);
      if (!Number.isFinite(s) || !Number.isFinite(e)) return false;

      return ranges.some((r: any) => {
          const rStart = toMinutes(r?.start);
          const rEnd = toMinutes(r?.end);
          if (!Number.isFinite(rStart) || !Number.isFinite(rEnd)) return false;
          return s < rEnd && e > rStart;
      });
  };

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const { name, value } = e.target;
      setMissionForm(prev => ({ ...prev, [name]: value }));
  };

  function calculateDuration(startDate: string, startTime: string, endDate: string, endTime: string) {
      const start = dayjs.tz(`${startDate} ${startTime}`, 'YYYY-MM-DD HH:mm', MARTINIQUE_TIMEZONE);
      const end = dayjs.tz(`${endDate} ${endTime}`, 'YYYY-MM-DD HH:mm', MARTINIQUE_TIMEZONE);
      const diffMs = end.valueOf() - start.valueOf();
      return diffMs > 0 ? diffMs / (1000 * 60 * 60) : 0;
  }

  const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (submitLockRef.current) return;
      submitLockRef.current = true;

      if (isSubmitting) return; // Prevent double submit
      setIsSubmitting(true);
      
      try {
          // Use endDate or fallback to date
          const finalEndDate = missionForm.endDate || missionForm.date;
          
          // Calculate duration based on full date/times
          let duration = calculateDuration(missionForm.date, missionForm.startTime, finalEndDate, missionForm.endTime);
          if (duration <= 0) duration = 1; // Fallback default

          // Get client and provider
          const client = clients.find(c => c.id === missionForm.clientId);
          const provider = providers.find(p => p.id === missionForm.providerId);
          
          if (!client) { throw new Error("Client invalide"); }

          // Recurrence Logic
          const startDateObj = dayjs.tz(missionForm.date, 'YYYY-MM-DD', MARTINIQUE_TIMEZONE);
          if (!startDateObj.isValid()) { throw new Error("Date invalide"); }

          const count = missionForm.recurrence === 'none' ? 1 : parseInt(missionForm.occurrences.toString()) || 1;
          
          for (let i = 0; i < count; i++) {
              let currentDate = startDateObj;

              if (missionForm.recurrence === 'weekly') {
                  currentDate = startDateObj.add(i * 7, 'day');
              } else if (missionForm.recurrence === 'biweekly') {
                  currentDate = startDateObj.add(i * 14, 'day');
              } else if (missionForm.recurrence === 'monthly') {
                  currentDate = startDateObj.add(i, 'month');
              }

              const dateStr = currentDate.format('YYYY-MM-DD');

              if (provider && isProviderNonWorkingDay(provider.id, dateStr)) {
                  throw new Error(`Impossible de programmer ${provider.firstName} ${provider.lastName} le ${dateStr} : ne travaille pas aujourd'hui.`);
              }

              if (provider && isProviderNonWorkingHours(provider.id, dateStr, missionForm.startTime, missionForm.endTime)) {
                  throw new Error(`Impossible de programmer ${provider.firstName} ${provider.lastName} le ${dateStr} : indisponible sur ce créneau horaire.`);
              }

              await addMission({
                  id: '', // Context will handle ID generation (or UUID)
                  date: dateStr,
                  startTime: missionForm.startTime,
                  endTime: missionForm.endTime,
                  duration: parseFloat(duration.toFixed(2)),
                  clientId: client.id,
                  clientName: client.name,
                  service: missionForm.service,
                  providerId: provider ? provider.id : null,
                  providerName: provider ? `${provider.firstName} ${provider.lastName}` : 'À assigner',
                  status: 'planned',
                  color: provider ? 'orange' : 'gray'
              });
          }

          showToast(count > 1 ? `${count} missions planifiées !` : 'Mission ajoutée avec succès !');
          
          // Refresh data to get real IDs from DB for the newly created missions
          if (refreshData) await refreshData();

          setIsModalOpen(false);
          setMissionForm(initialFormState); // Reset form cleanly

      } catch (error: any) {
          console.error("Erreur planning", error);
          alert("Une erreur est survenue : " + error.message);
      } finally {
          submitLockRef.current = false;
          setIsSubmitting(false); // CRITICAL: Always reset submitting state
      }
  };

  const handleQuickPlanSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (submitLockRef.current) return;
      submitLockRef.current = true;

      if (isSubmitting) return;
      setIsSubmitting(true);
      try {
          const client = clients.find(c => c.id === quickPlanForm.clientId);
          if (!client) throw new Error('Client invalide');

          let duration = calculateDuration(quickPlanForm.date, quickPlanForm.startTime, quickPlanForm.date, quickPlanForm.endTime);
          if (duration <= 0) throw new Error("L'heure de fin doit être après l'heure de début");

          await addMission({
              id: '',
              date: quickPlanForm.date,
              startTime: quickPlanForm.startTime,
              endTime: quickPlanForm.endTime,
              duration: parseFloat(duration.toFixed(2)),
              clientId: client.id,
              clientName: client.name,
              service: 'Prestation manuelle',
              providerId: null,
              providerName: 'À assigner',
              status: 'planned',
              color: 'gray'
          });

          if (refreshData) await refreshData();

          showToast('Prestation ajoutée !');
          setIsQuickPlanModalOpen(false);
          setQuickPlanForm({ clientId: '', date: getMartiniqueToday(), startTime: '09:00', endTime: '11:00' });
      } catch (error: any) {
          console.error('Erreur planification rapide', error);
          showToast(error?.message || 'Erreur planification rapide', 'error');
      } finally {
          submitLockRef.current = false;
          setIsSubmitting(false);
      }
  };

  const handleReminderSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!reminderForm.text || !reminderForm.date) return;
      setIsSubmitting(true);
      try {
          await addReminder({
              id: '', 
              text: reminderForm.text,
              date: reminderForm.date,
              notifyEmail: reminderForm.notifyEmail,
              completed: false
          });
          showToast('Rappel ajouté à l\'agenda !');
          setIsReminderModalOpen(false);
          setReminderForm({ text: '', date: getMartiniqueToday(), notifyEmail: true });
      } catch (err) {
          console.error(err);
          showToast('Erreur ajout rappel', 'error');
      } finally {
          setIsSubmitting(false);
      }
  };

  
  const isProviderAvailable = (providerId: string, dateStr: string, startTime: string = '00:00', endTime: string = '23:59') => {
      const provider = providers.find(p => p.id === providerId);
      if (!provider) return false;

      if (isProviderNonWorkingDay(providerId, dateStr)) return false;
      
      const missionStart = new Date(`${dateStr}T${startTime}`);
      const missionEnd = new Date(`${dateStr}T${endTime}`);
      
      for (const leave of provider.leaves) {
          // Skip if rejected
          if (leave.status === 'rejected') continue;

          // Default full day if times missing
          const lStartTime = leave.startTime || '00:00';
          const lEndTime = leave.endTime || '23:59';

          const leaveStart = new Date(`${leave.startDate}T${lStartTime}`);
          const leaveEnd = new Date(`${leave.endDate}T${lEndTime}`);
          
          // Check overlap
          // Overlap condition: (StartA < EndB) and (EndA > StartB)
          if (missionStart < leaveEnd && missionEnd > leaveStart) {
              return false;
          }
      }
      return true;
  };

  const handleAssignMission = async () => {
      if (!selectedMissionId || !assignProviderId) {
          showToast('Veuillez sélectionner une mission et un prestataire.', 'warning');
          return;
      }

      setIsSubmitting(true);
      try {
          const mission = missions.find(m => m.id === selectedMissionId);
          const provider = providers.find(p => p.id === assignProviderId);
          
          if (mission && provider) {
              // Ensure we are using valid IDs from refreshed data
              await assignProvider(mission.id, provider.id, `${provider.firstName} ${provider.lastName}`);
              
              showToast(`Prestataire assigné ! Email envoyé.`);
              if (refreshData) await refreshData();
              
              // Reset states
              setSelectedMissionId(null);
              setAssignProviderId('');
          }
      } catch (error) {
          showToast('Erreur lors de l\'assignation.', 'error');
      } finally {
          setIsSubmitting(false);
      }
  };

  const handleConfirmAssignment = async () => {
      if (selectedMissionId && assignProviderId) {
          const mission = missions.find(m => m.id === selectedMissionId);
          const provider = providers.find(p => p.id === assignProviderId);
          
          if (mission && provider) {
              if (isSubmitting) return;
              if (isProviderNonWorkingDay(provider.id, mission.date)) {
                  showToast(`Impossible de programmer ${provider.firstName} ${provider.lastName} : ne travaille pas aujourd'hui.`, 'warning');
                  return;
              }
              if (isProviderNonWorkingHours(provider.id, mission.date, mission.startTime, mission.endTime)) {
                  showToast(`Impossible de programmer ${provider.firstName} ${provider.lastName} : indisponible sur ce créneau horaire.`, 'warning');
                  return;
              }
              setIsSubmitting(true);
              try {
                  // Ensure we are using valid IDs from refreshed data
                  await assignProvider(mission.id, provider.id, `${provider.firstName} ${provider.lastName}`);
                  
                  showToast(`Prestataire assigné ! Email envoyé.`);
                  if (refreshData) await refreshData();
                  
                  // Reset states => closes modal
                  setSelectedMissionId(null);
                  setAssignProviderId('');
              } catch (error) {
                  showToast('Erreur lors de l\'assignation.', 'error');
              } finally {
                  setIsSubmitting(false);
              }
          }
      }
  };
  
  // BULK DELETE
  const toggleMissionSelection = (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      const newSet = new Set(selectedMissionIds);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      setSelectedMissionIds(newSet);
  };

  // Mission Details Modal
  const [selectedMissionDetails, setSelectedMissionDetails] = useState<Mission | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

  const [isEditMissionModalOpen, setIsEditMissionModalOpen] = useState(false);
  const [editMissionForm, setEditMissionForm] = useState({
      providerId: '',
      date: '',
      startTime: '09:00',
      endTime: '11:00',
      service: '',
      status: 'planned' as Mission['status']
  });
  const [editMissionOriginalProviderId, setEditMissionOriginalProviderId] = useState<string>('');

  const [isProvisionalDetailsModalOpen, setIsProvisionalDetailsModalOpen] = useState(false);
  const [selectedProvisionalDetails, setSelectedProvisionalDetails] = useState<any>(null);

  const detailClient = selectedMissionDetails?.clientId ? clients.find(c => c.id === selectedMissionDetails.clientId) : undefined;

  const handleMissionClick = async (mission: Mission, e: React.MouseEvent) => {
      if (!e.shiftKey && !e.ctrlKey && !e.metaKey) {
          setSelectedMissionDetails(mission);
          setIsDetailsModalOpen(true);
          
          if (getMissionDetails) {
              try {
                  const fullDetails = await getMissionDetails(mission.id);
                  if (fullDetails) {
                      setSelectedMissionDetails(fullDetails);
                  }
              } catch (err) {
                  console.error("Failed to load mission details", err);
              }
          }
      }
  };

  const openEditMissionModal = () => {
      if (!selectedMissionDetails) return;

      const providerIdValue = selectedMissionDetails.providerId ? String(selectedMissionDetails.providerId) : '';
      setEditMissionOriginalProviderId(providerIdValue);
      setEditMissionForm({
          providerId: providerIdValue,
          date: selectedMissionDetails.date || getMartiniqueToday(),
          startTime: selectedMissionDetails.startTime || '09:00',
          endTime: selectedMissionDetails.endTime || '11:00',
          service: selectedMissionDetails.service || '',
          status: selectedMissionDetails.status || 'planned'
      });
      setIsEditMissionModalOpen(true);
  };

  const handleEditMissionSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!selectedMissionDetails) return;
      if (isSubmitting) return;

      setIsSubmitting(true);
      try {
          const missionId = selectedMissionDetails.id;

          const nextDate = editMissionForm.date;
          const nextStart = editMissionForm.startTime;
          const nextEnd = editMissionForm.endTime;

          const scheduleChanged =
              String(nextDate || '') !== String(selectedMissionDetails.date || '') ||
              String(nextStart || '') !== String(selectedMissionDetails.startTime || '') ||
              String(nextEnd || '') !== String(selectedMissionDetails.endTime || '');

          const duration = calculateDuration(nextDate, nextStart, nextDate, nextEnd);
          if (scheduleChanged && (!duration || duration <= 0)) {
              throw new Error("L'heure de fin doit être après l'heure de début");
          }

          const nextProviderId = editMissionForm.providerId || '';
          const nextProvider = nextProviderId ? providers.find(p => p.id === nextProviderId) : undefined;

          // Si on garde un prestataire (ou on en met un), vérifier qu'il travaille ce jour-là
          if (nextProvider && isProviderNonWorkingDay(nextProvider.id, nextDate)) {
              throw new Error(`Impossible de programmer ${nextProvider.firstName} ${nextProvider.lastName} le ${nextDate} : ne travaille pas aujourd'hui.`);
          }

          // 1) Si date/heure changent, créer une demande de modification (validation client)
          if (scheduleChanged) {
              await requestMissionReschedule(missionId, nextDate, nextStart, nextEnd);
          }

          // 2) Mettre à jour les champs autorisés immédiatement (service/statut)
          await updateMission(missionId, {
              service: editMissionForm.service,
              status: editMissionForm.status
          });

          // 2) Si le prestataire change, réutiliser la logique existante (emails/notifs)
          if (nextProviderId !== editMissionOriginalProviderId) {
              if (!nextProviderId) {
                  await updateMission(missionId, {
                      providerId: null,
                      providerName: 'À assigner',
                      status: 'planned',
                      color: 'gray'
                  });
              } else if (nextProvider) {
                  await assignProvider(missionId, nextProvider.id, `${nextProvider.firstName} ${nextProvider.lastName}`);
              }
          }

          if (refreshData) await refreshData();

          showToast(scheduleChanged ? 'Demande de modification envoyée au client (en attente de validation).' : 'Mission modifiée avec succès !');
          setIsEditMissionModalOpen(false);
      } catch (error: any) {
          console.error('[editMission] error:', error);
          showToast(error?.message || 'Erreur lors de la modification', 'error');
      } finally {
          setIsSubmitting(false);
      }
  };

  const handleProvisionalMissionClick = (item: any, e: React.MouseEvent) => {
      if (!e.shiftKey && !e.ctrlKey && !e.metaKey) {
          setSelectedProvisionalDetails(item);
          setIsProvisionalDetailsModalOpen(true);
      }
  };
  
  const confirmBulkDeleteMissions = () => {
       if (selectedMissionIds.size > 0) {
           setDeleteConfirmOpen(true);
       }
  };

  const executeBulkDeleteMissions = async () => {
       await deleteMissions(Array.from(selectedMissionIds));
       setSelectedMissionIds(new Set());
       setDeleteConfirmOpen(false);
       if (refreshData) await refreshData();
       showToast('Missions supprimées de la base de données.');
  };

  const handleCopyMissionDetails = async () => {
      if (!selectedMissionDetails) return;

      const mission = selectedMissionDetails;
      const client = detailClient;
      const formattedDate = mission.date
          ? dayjs.tz(mission.date, 'YYYY-MM-DD', MARTINIQUE_TIMEZONE).format('DD/MM/YYYY')
          : '—';

      const info = [
          `Mission: ${mission.service || '—'}`,
          `Date: ${formattedDate}`,
          `Horaires: ${mission.startTime || '—'} - ${mission.endTime || '—'}`,
          `Durée: ${mission.duration ? `${mission.duration}h` : '—'}`,
          `Client: ${client?.name || mission.clientName || '—'}`,
          `Téléphone client: ${client?.phone || '—'}`,
          `Adresse: ${client?.address || '—'}`,
          `Prestataire: ${mission.providerName || 'À assigner'}`,
          `Devis source: ${mission.sourceDocumentId || '—'}`
      ].join('\n');

      try {
          if (typeof navigator !== 'undefined' && navigator?.clipboard?.writeText) {
              await navigator.clipboard.writeText(info);
              showToast('Informations mission copiées dans le presse-papiers.');
          } else {
              throw new Error('Clipboard API non disponible');
          }
      } catch (err) {
          console.error('[copyMissionDetails] error:', err);
          showToast('Impossible de copier les informations.', 'error');
      }
  };

  const unassignedMissions = missions.filter(m => (!m.providerId || m.providerId === 'null') && m.status !== 'cancelled');
  const missionToAssign = missions.find(m => m.id === selectedMissionId);

  const getDayIndex = (dateStr: string) => {
      const d = dayjs.tz(dateStr, 'YYYY-MM-DD', MARTINIQUE_TIMEZONE);
      const day = d.day();
      return day === 0 ? 5 : day - 1; // Correct mapping for Monday start
  };

  // Interaction Handlers for Stats Cards - Navigating to Statistics Page with Filters
  const handleStatClick = (filter: 'planned' | 'completed' | 'all', time: 'day' | 'week') => {
      navigate('/statistics', { state: { filter, time } });
  };

  const getMissionPlanningStyle = (mission: Mission): { container: string; border: string; label: string } => {
      const isUnassigned = (!mission.providerId || mission.providerId === 'null') && mission.status !== 'cancelled';
      const isSignedFromQuote = mission.source === 'devis' && mission.status !== 'cancelled';

      if (mission.status === 'completed') {
          return { container: 'bg-green-100 text-slate-800', border: 'border-green-500', label: 'Terminée' };
      }
      if (mission.status === 'cancelled') {
          return { container: 'bg-slate-100 text-slate-600 opacity-60', border: 'border-slate-300', label: 'Annulée' };
      }
      if (mission.status === 'in_progress') {
          return { container: 'bg-blue-100 text-slate-800', border: 'border-blue-600', label: 'En cours' };
      }
      if (isUnassigned) {
          return { container: 'bg-red-50 text-slate-800', border: 'border-red-500', label: 'Non assignée' };
      }
      if (isSignedFromQuote) {
          return { container: 'bg-purple-100 text-slate-800', border: 'border-purple-500', label: 'Devis signé' };
      }
      return { container: 'bg-blue-50 text-slate-800', border: 'border-brand-blue', label: 'Assignée' };
  };

  const normalizeCommune = (value: string): string => {
      const v = String(value || '').trim();
      if (!v) return '';
      return v.replace(/bassin\s*pointe/ig, 'Basse-Pointe');
  };

  const applyStatsFilter = (scope: 'day-planned' | 'week-all' | 'week-completed') => {
      if (scope === 'day-planned') {
          const d = getMartiniqueToday();
          setCustomDateRange(true);
          setStartDate(d);
          setEndDate(d);
          setSelectedStatus('planned');
      } else if (scope === 'week-all') {
          setCustomDateRange(false);
          setStartDate('');
          setEndDate('');
          setSelectedStatus('all');
      } else if (scope === 'week-completed') {
          setCustomDateRange(false);
          setStartDate('');
          setEndDate('');
          setSelectedStatus('completed');
      }
      setIsStatsModalOpen(false);
  };

  return dataLoading ? <PageLoader /> : (
    <div className="p-4 md:p-8 h-[100svh] md:h-full overflow-hidden md:overflow-y-auto bg-white/40 flex flex-col relative">
       
       {/* Toast Notification */}
       <div className={`fixed bottom-6 right-6 z-[100] transition-all duration-500 transform ${toast.show ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0 pointer-events-none'}`}>
        <div className={`px-6 py-4 rounded-lg shadow-2xl flex items-center gap-3 border ${
            toast.type === 'error' ? 'bg-red-800 text-white border-red-700' :
            toast.type === 'warning' ? 'bg-orange-800 text-white border-orange-700' :
            'bg-green-800 text-white border-green-700'
        }`}>
            <div className={`p-1 rounded-full text-white ${
                toast.type === 'error' ? 'bg-red-500' :
                toast.type === 'warning' ? 'bg-orange-500' :
                'bg-green-500'
            }`}>
                {toast.type === 'error' ? <AlertTriangle className="w-4 h-4" /> :
                 toast.type === 'warning' ? <AlertTriangle className="w-4 h-4" /> :
                 <CheckCircle className="w-4 h-4" />}
            </div>
            <div>
                <h4 className="font-bold text-sm">
                    {toast.type === 'error' ? 'Erreur' :
                     toast.type === 'warning' ? 'Attention' :
                     'Succès'}
                </h4>
                <p className="text-xs opacity-90">{toast.message}</p>
            </div>
        </div>
      </div>

      {isMobileActionsOpen && (
        <div className="fixed inset-0 z-50 flex items-end md:hidden bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white w-full rounded-t-2xl shadow-2xl overflow-hidden max-h-[85svh] flex flex-col">
                <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50">
                    <div className="font-bold text-slate-800">Actions & Missions</div>
                    <button
                        type="button"
                        onClick={() => setIsMobileActionsOpen(false)}
                        className="p-2 hover:bg-slate-200 rounded-full transition"
                    >
                        <X className="w-5 h-5 text-slate-600" />
                    </button>
                </div>
                <div className="p-3 space-y-2 overflow-y-auto">
                    <button 
                        onClick={() => { setIsReminderModalOpen(true); setReminderForm({ text: '', date: getMartiniqueToday(), notifyEmail: true }); setIsMobileActionsOpen(false); }}
                        className="w-full bg-yellow-100 text-yellow-800 py-2 rounded font-bold text-xs hover:bg-yellow-200 flex items-center justify-center gap-2 mb-4 border border-yellow-200"
                    >
                        <Flag className="w-3 h-3" /> Ajouter un Rappel
                    </button>

                    <div className="bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3">
                        <div className="text-xs font-bold text-slate-700 mb-2">Légende</div>
                        <div className="grid grid-cols-2 gap-2 text-xs font-semibold text-slate-700">
                            <div className="flex items-center gap-2">
                                <span className="w-3 h-3 rounded-full bg-orange-400"></span>
                                En attente de validation
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="w-3 h-3 rounded-full bg-brand-blue"></span>
                                Assignée
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="w-3 h-3 rounded-full bg-red-500"></span>
                                Non assignée
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="w-3 h-3 rounded-full bg-purple-500"></span>
                                Devis signé
                            </div>
                        </div>
                    </div>

                    {unassignedMissions.length === 0 ? (
                        <p className="text-center text-xs text-slate-400 italic mt-4">Toutes les missions sont assignées.</p>
                    ) : (
                        <>
                            <div className="text-xs text-slate-500 font-bold mb-2">
                                {unassignedMissions.length} mission{unassignedMissions.length > 1 ? 's' : ''} à assigner
                            </div>
                            {unassignedMissions.map(m => (
                                <div key={m.id} className="bg-red-50 border border-red-100 p-2 rounded cursor-pointer hover:bg-red-100 shrink-0">
                                    <p className="font-bold text-xs text-red-800 truncate">{m.clientName}</p>
                                    <p className="text-[10px] text-red-600 truncate">{m.date} | {m.service}</p>
                                    <button onClick={() => { setSelectedMissionId(m.id); setIsMobileActionsOpen(false); }} className="mt-1 w-full bg-red-200 text-red-800 text-[10px] font-bold rounded px-1 hover:bg-red-300">Assigner</button>
                                </div>
                            ))}
                        </>
                    )}
                </div>
            </div>
        </div>
      )}

      <div className="flex flex-col gap-2 md:flex-row md:justify-between md:items-end mb-2 md:mb-6">
           <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
               <h2 className="text-2xl md:text-3xl font-serif font-bold text-slate-800">Planning</h2>
               {false && (
                <button
                    type="button"
                    onClick={() => setIsQuickPlanModalOpen(true)}
                    className="bg-brand-blue text-white px-3 py-1.5 rounded-lg flex items-center gap-2 font-bold shadow-sm hover:opacity-90 transition"
                >
                    <Plus className="w-4 h-4" /> Planification rapide
                </button>
                )}

               {selectedMissionIds.size > 0 && (
                   <button onClick={confirmBulkDeleteMissions} className="bg-red-500 text-white px-3 py-1.5 rounded-lg flex items-center gap-2 font-bold shadow-sm hover:bg-red-600 transition animate-in fade-in">
                       <Trash2 className="w-4 h-4" /> Supprimer ({selectedMissionIds.size})
                   </button>
               )}
           </div>
           
           {/* Date Range Display */}
           <div className="flex items-center gap-2 md:self-auto">
               <div className="bg-white px-3 py-1.5 md:px-4 md:py-2 rounded-lg shadow-sm border border-slate-200 text-sm font-bold text-slate-600">
                   {dateRangeString}
               </div>
               <button
                   type="button"
                   onClick={() => setIsStatsModalOpen(true)}
                   className="bg-white px-3 py-1.5 md:px-4 md:py-2 rounded-lg shadow-sm border border-slate-200 text-sm font-bold text-slate-700 hover:bg-slate-50 transition"
                   title="Afficher les statistiques"
               >
                   Statistiques
               </button>
           </div>
      </div>



       {/* Filters & Navigation */}
       <div className="flex flex-col gap-2 md:gap-4 mb-2 md:mb-6 lg:flex-row lg:items-center lg:justify-between">
           <div className="w-full lg:w-auto">
                <div className="md:hidden flex items-center gap-2">
                    <div className="flex-1 flex items-center justify-between bg-slate-200/50 p-1 rounded-full">
                        <button
                            onClick={handlePrevWeek}
                            className="bg-[#006699] text-white w-9 h-9 rounded-full flex items-center justify-center hover:bg-blue-800"
                            title="Semaine précédente"
                            aria-label="Semaine précédente"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button
                            onClick={handleCurrentWeek}
                            className="bg-[#66BB44] text-white w-9 h-9 rounded-full flex items-center justify-center shadow-sm hover:bg-green-600"
                            title="Semaine en cours"
                            aria-label="Semaine en cours"
                        >
                            <Calendar className="w-4 h-4" />
                        </button>
                        <button
                            onClick={handleNextWeek}
                            className="bg-[#006699] text-white w-9 h-9 rounded-full flex items-center justify-center hover:bg-blue-800"
                            title="Semaine suivante"
                            aria-label="Semaine suivante"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                    <button
                        onClick={() => setShowMobileFilters(v => !v)}
                        className={`w-9 h-9 rounded-full border border-slate-200 bg-white flex items-center justify-center hover:bg-slate-50 transition ${showMobileFilters ? 'text-brand-blue' : 'text-slate-700'}`}
                        title={showMobileFilters ? 'Masquer les filtres' : 'Afficher les filtres'}
                        aria-label={showMobileFilters ? 'Masquer les filtres' : 'Afficher les filtres'}
                    >
                        <SlidersHorizontal className="w-4 h-4" />
                    </button>
                </div>

                <div className="hidden md:flex flex-row items-center gap-4">
                    <span className="text-brand-blue italic text-sm font-bold">Navigation :</span>
                    <div className="w-full sm:w-auto flex flex-col sm:flex-row sm:items-center gap-2 bg-slate-200/50 p-2 sm:p-1 rounded-2xl sm:rounded-full">
                        <button onClick={handlePrevWeek} className="w-full sm:w-auto bg-[#006699] text-white px-4 py-2 sm:py-1 rounded-xl sm:rounded-full text-sm font-bold flex items-center justify-center gap-1 hover:bg-blue-800">
                            <ChevronLeft className="w-3 h-3" /> Précédente
                        </button>
                        <button onClick={handleCurrentWeek} className="w-full sm:w-auto bg-[#66BB44] text-white px-4 py-2 sm:py-1 rounded-xl sm:rounded-full text-sm font-bold shadow-sm hover:bg-green-600">
                            En cours
                        </button>
                        <button onClick={handleNextWeek} className="w-full sm:w-auto bg-[#006699] text-white px-4 py-2 sm:py-1 rounded-xl sm:rounded-full text-sm font-bold flex items-center justify-center gap-1 hover:bg-blue-800">
                            Suivante <ChevronRight className="w-3 h-3" />
                        </button>
                    </div>
                </div>
           </div>

           <div className={`${showMobileFilters ? 'flex' : 'hidden'} md:flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:gap-2`}>
               <div className="relative w-full sm:w-48">
                   <input 
                      type="text"
                      placeholder="Rechercher..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full border border-slate-300 rounded px-3 py-2 sm:py-1 text-sm focus:outline-none focus:border-brand-blue"
                   />
                   <Search className="w-3 h-3 text-slate-400 absolute right-3 top-3 sm:top-2" />
               </div>
               
               <div className="w-full sm:w-64">
                    <div className="text-brand-blue italic text-sm font-bold mb-1 sm:hidden">Prestataire :</div>
                    <div className="hidden sm:block text-brand-blue italic text-sm font-bold">Prestataire :</div>
                    <div className="relative w-full">
                        <SearchableSelect
                            options={[
                                { value: 'all', label: 'Tous les prestataires' },
                                ...providers.filter(p => p.status === 'Active').map(p => ({ value: `${p.firstName} ${p.lastName}`, label: `${p.firstName} ${p.lastName}` }))
                            ]}
                            value={selectedProvider}
                            onChange={(value) => setSelectedProvider(value)}
                            className="w-full"
                        />
                    </div>
               </div>
               
               <div className="w-full sm:w-48">
                    <div className="text-brand-blue italic text-sm font-bold mb-1 sm:hidden">Client :</div>
                    <div className="hidden sm:block text-brand-blue italic text-sm font-bold">Client :</div>
                    <div className="relative w-full">
                        <SearchableSelect
                            options={[
                                { value: 'all', label: 'Tous les clients' },
                                ...clients.map(c => ({ value: c.name, label: c.name }))
                            ]}
                            value={selectedClient}
                            onChange={(value) => setSelectedClient(value)}
                            className="w-full"
                        />
                    </div>
               </div>
               
               <div className="w-full sm:w-36">
                    <div className="text-brand-blue italic text-sm font-bold mb-1 sm:hidden">Statut :</div>
                    <div className="hidden sm:block text-brand-blue italic text-sm font-bold">Statut :</div>
                    <div className="relative w-full">
                        <SearchableSelect
                            options={[
                                { value: 'all', label: 'Tous' },
                                { value: 'planned', label: 'Prévues' },
                                { value: 'in_progress', label: 'En cours' },
                                { value: 'completed', label: 'Terminées' },
                                { value: 'cancelled', label: 'Annulées' }
                            ]}
                            value={selectedStatus}
                            onChange={(value) => setSelectedStatus(value)}
                            className="w-full"
                        />
                    </div>
               </div>
               
               <button
                   onClick={() => {
                       setCustomDateRange(!customDateRange);
                       if (!customDateRange) {
                           setStartDate('');
                           setEndDate('');
                       }
                   }}
                   className={`w-full sm:w-auto px-3 py-2 sm:py-1 rounded text-sm font-bold transition ${
                       customDateRange 
                           ? 'bg-brand-blue text-white' 
                           : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                   }`}
               >
                   <Calendar className="w-3 h-3 inline mr-1" />
                   Plage perso
               </button>
               
               {customDateRange && (
                   <div className="w-full flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2 bg-slate-100 rounded px-3 py-2 sm:py-1">
                       <input
                           type="date"
                           value={startDate}
                           onChange={(e) => setStartDate(e.target.value)}
                           className="w-full sm:w-auto text-sm border border-slate-300 rounded px-2 py-2 sm:py-1 focus:outline-none focus:border-brand-blue"
                       />
                       <span className="text-xs text-slate-500 text-center sm:text-left">au</span>
                       <input
                           type="date"
                           value={endDate}
                           onChange={(e) => setEndDate(e.target.value)}
                           className="w-full sm:w-auto text-sm border border-slate-300 rounded px-2 py-2 sm:py-1 focus:outline-none focus:border-brand-blue"
                       />
                   </div>
               )}
               
               <button
                   onClick={() => {
                       setSelectedProvider('all');
                       setSelectedClient('all');
                       setSelectedStatus('all');
                       setSearchQuery('');
                       setCustomDateRange(false);
                       setStartDate('');
                       setEndDate('');
                   }}
                   className="w-full sm:w-auto px-3 py-2 sm:py-1 bg-slate-100 text-slate-700 rounded text-sm font-bold hover:bg-slate-200 transition"
               >
                   <RotateCcw className="w-3 h-3 inline mr-1" />
                   Reset
               </button>
           </div>
       </div>

       {/* Main Grid */}
       <div className="flex-1 min-h-0 flex flex-col gap-4 lg:flex-row lg:gap-6 relative">
            {planningLoading && (
                <div className="absolute inset-0 z-10 bg-white/80 backdrop-blur-sm flex items-center justify-center rounded-xl border border-slate-200">
                    <div className="flex flex-col items-center gap-4 p-6 bg-white rounded-2xl shadow-xl border border-slate-100 max-w-sm w-full mx-4">
                        <div className="w-full animate-pulse space-y-3">
                            <div className="h-6 bg-slate-200 rounded w-2/3 mx-auto" />
                            <div className="h-4 bg-slate-200 rounded w-3/4 mx-auto" />
                        </div>
                        <div className="w-full space-y-2 text-center">
                            <h3 className="text-lg font-bold text-slate-800">Chargement du planning</h3>
                            <p className="text-sm text-slate-500 italic min-h-[1.25rem]">{encouragementMessages[encouragementIndex]}</p>
                            
                            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden mt-2">
                                <div
                                    className="bg-brand-blue h-2 rounded-full transition-all duration-300"
                                    style={{ width: `${Math.min(100, Math.max(0, Math.round(planningProgress)))}%` }}
                                />
                            </div>
                            <div className="text-xs font-bold text-slate-400 text-right">{Math.min(100, Math.max(0, Math.round(planningProgress)))}%</div>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex-1 min-h-0 bg-white shadow-sm border border-slate-200 flex flex-col overflow-x-hidden md:overflow-x-auto">
                {/* Mobile list view */}
                <div className="md:hidden p-3 space-y-4 flex-1 overflow-y-auto">
                    {mobilePlanningDays.length === 0 ? (
                        <div className="text-center text-sm text-slate-400 py-10">
                            Aucun élément sur la période sélectionnée.
                        </div>
                    ) : (
                        mobilePlanningDays.map(({ dateStr, remindersForDate, provisionalForDate, missionsForDate }) => (
                            <div key={dateStr} className="border border-slate-200 rounded-lg overflow-hidden">
                                <button
                                    type="button"
                                    onClick={() => setFocusedDate(dateStr)}
                                    className={`w-full text-left px-4 py-2 font-bold text-sm flex items-center justify-between ${dateStr === statsDate ? 'bg-brand-blue text-white' : 'bg-slate-100 text-slate-800 hover:bg-slate-200'}`}
                                    title="Utiliser ce jour pour les statistiques"
                                >
                                    {new Date(`${dateStr}T00:00:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}
                                    {dateStr === statsDate ? <span className="text-xs font-bold">Sélectionné</span> : <span className="text-xs font-bold opacity-70">Sélectionner</span>}
                                </button>
                                <div className="p-3 space-y-2 bg-white">
                                    {remindersForDate.map((r: any) => (
                                        <div key={r.id} className="bg-yellow-100 border-l-4 border-yellow-400 p-3 rounded shadow-sm text-sm">
                                            <div className="flex justify-between items-start gap-3">
                                                <p className="font-bold text-yellow-900">{r.text}</p>
                                                <button onClick={() => toggleReminder(r.id)} className="text-yellow-700 hover:text-green-700 shrink-0">
                                                    <CheckCircle className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}

                                    {provisionalForDate.map((item: any) => (
                                        <div
                                            key={item.id}
                                            className="bg-orange-100 p-3 rounded text-sm cursor-pointer hover:bg-orange-200 transition border-l-4 border-orange-500"
                                            onClick={(e) => handleProvisionalMissionClick(item, e)}
                                        >
                                            <p className="font-bold text-orange-900 truncate">{item.clientName}</p>
                                            <p className="text-xs text-orange-800 mt-1">{item.startTime} - {item.endTime}</p>
                                            <p className="text-xs font-bold text-orange-800 truncate">{item.providerName || 'À assigner'}</p>
                                            <p className="text-xs text-orange-800 truncate">{item.service || 'Devis'}</p>
                                            <p className="text-xs italic text-orange-700 truncate">En attente</p>
                                        </div>
                                    ))}

                                    {missionsForDate.map((item: any) => {
                                        const style = getMissionPlanningStyle(item as Mission);
                                        const clientCityRaw = item?.clientId ? (clients.find(c => c.id === item.clientId)?.city || '') : '';
                                        const clientCity = normalizeCommune(clientCityRaw);
                                        return (
                                            <div
                                                key={item.id}
                                                className={`p-3 rounded text-sm cursor-pointer transition border-l-4 ${style.container} ${style.border}`}
                                                onClick={(e) => handleMissionClick(item, e)}
                                            >
                                                <div className="flex justify-between items-start gap-3">
                                                    <div className="min-w-0">
                                                        <div className="flex items-center justify-between gap-2">
                                                            <p className="font-bold text-slate-800 truncate">{item.clientName}</p>
                                                            <span className="text-xs font-bold text-slate-700 shrink-0">
                                                                {dayjs.tz(item.date, 'YYYY-MM-DD', MARTINIQUE_TIMEZONE).format('DD/MM')}
                                                            </span>
                                                        </div>
                                                        <p className="text-xs text-slate-600 mt-1">{item.startTime} - {item.endTime}</p>
                                                        {clientCity ? (
                                                            <p className="text-xs text-slate-600 truncate">{clientCity}</p>
                                                        ) : null}
                                                        <p className="text-xs font-bold text-slate-700 truncate">{item.providerName}</p>
                                                        <p className="text-[11px] font-bold mt-1 text-slate-600">{style.label}</p>
                                                    </div>
                                                    <button
                                                        onClick={(e) => toggleMissionSelection(item.id, e)}
                                                        className="p-1 hover:bg-white/80 rounded shrink-0"
                                                        title="Sélectionner"
                                                    >
                                                        {selectedMissionIds.has(item.id) ? (
                                                            <CheckSquare className="w-5 h-5 text-brand-blue fill-white" />
                                                        ) : (
                                                            <Square className="w-5 h-5 text-slate-400" />
                                                        )}
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}

                                    {remindersForDate.length === 0 && provisionalForDate.length === 0 && missionsForDate.length === 0 ? (
                                        <div className="text-xs text-slate-400 italic">Aucun élément.</div>
                                    ) : null}
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Desktop calendar view */}
                <div className="hidden md:block min-w-[900px]">
                    <div className="grid grid-cols-6 bg-slate-100 border-b border-slate-200 text-center font-bold py-2">
                        {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'].map((d, idx) => {
                            const dateStr = colDates[idx] || '';
                            const isSelected = dateStr && dateStr === statsDate;
                            return (
                                <button
                                    key={d}
                                    type="button"
                                    onClick={() => dateStr && setFocusedDate(dateStr)}
                                    disabled={!dateStr}
                                    className={`px-2 py-1 rounded-md mx-2 transition ${isSelected ? 'bg-brand-blue text-white' : 'text-slate-800 hover:bg-slate-200'} ${!dateStr ? 'opacity-40 cursor-not-allowed' : ''}`}
                                    title="Utiliser ce jour pour les statistiques"
                                >
                                    <div className="text-sm">{d}</div>
                                    <div className={`text-[11px] ${isSelected ? 'text-white/90' : 'text-slate-500'}`}>{dateStr ? dayjs.tz(dateStr, 'YYYY-MM-DD', MARTINIQUE_TIMEZONE).format('DD/MM') : '—'}</div>
                                </button>
                            );
                        })}
                    </div>
                    <div className="grid grid-cols-6 flex-1 min-h-[400px] min-h-0">
                     {[0,1,2,3,4,5].map(colIndex => (
                        <div key={colIndex} className="border-r border-slate-100 last:border-r-0 p-2 bg-slate-50/30 space-y-2 h-full overflow-y-auto">
                            {/* Reminders for this day */}
                            {filteredReminders
                                .filter(r => getDayIndex(r.date) === colIndex && !r.completed)
                                .map(r => (
                                    <div key={r.id} className="bg-yellow-100 border-l-4 border-yellow-400 p-2 rounded shadow-sm text-xs relative group animate-in zoom-in duration-200">
                                        <div className="flex justify-between items-start">
                                            <p className="font-bold text-yellow-800 line-clamp-2">{r.text}</p>
                                            <button onClick={() => toggleReminder(r.id)} className="text-yellow-600 hover:text-green-600"><CheckCircle className="w-3 h-3"/></button>
                                        </div>
                                        {r.notifyEmail && <div className="absolute top-1 right-1 opacity-20"><Mail className="w-3 h-3"/></div>}
                                    </div>
                                ))
                            }

                            {/* Missions for this day */}
                            {filteredProvisionalMissions
                                .filter(item => getDayIndex(item.date) === colIndex)
                                .map(item => (
                                    <div
                                        key={item.id}
                                        className="bg-orange-100 p-2 rounded text-xs cursor-pointer hover:scale-105 transition border-l-4 border-orange-500 relative group"
                                        onClick={(e) => handleProvisionalMissionClick(item, e)}
                                    >
                                        <div className="flex justify-between">
                                            <p className="font-bold text-orange-900 pr-4 truncate">{item.clientName}</p>
                                            <span className="text-[9px] text-orange-700">{dayjs.tz(item.date, 'YYYY-MM-DD', MARTINIQUE_TIMEZONE).date()}</span>
                                        </div>
                                        <p className="text-[10px] text-orange-800">{item.startTime}-{item.endTime}</p>
                                        <p className="text-[10px] font-bold text-orange-800 truncate">{item.providerName || 'À assigner'}</p>
                                        <p className="text-[10px] text-orange-800 truncate">{item.service || 'Devis'}</p>
                                        <p className="text-[9px] italic text-orange-700 truncate">En attente</p>
                                    </div>
                                ))
                            }
                            {filteredMissions
                                .filter(item => getDayIndex(item.date) === colIndex)
                                .filter(item => item.status !== 'cancelled')
                                .map(item => {
                                    const style = getMissionPlanningStyle(item);
                                    const clientCityRaw = item?.clientId ? (clients.find(c => c.id === item.clientId)?.city || '') : '';
                                    const clientCity = normalizeCommune(clientCityRaw);
                                    return (
                                        <div
                                            key={item.id}
                                            className={`p-2 rounded text-xs cursor-pointer hover:scale-105 transition border-l-4 relative group ${style.container} ${style.border}`}
                                            onClick={(e) => handleMissionClick(item, e)}
                                        >
                                            <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={(e) => toggleMissionSelection(item.id, e)}
                                                    className="p-1 hover:bg-white/50 rounded"
                                                    title="Sélectionner"
                                                >
                                                    {selectedMissionIds.has(item.id) ? (
                                                        <CheckSquare className="w-4 h-4 text-brand-blue fill-white" />
                                                    ) : (
                                                        <Square className="w-4 h-4 text-slate-400" />
                                                    )}
                                                </button>
                                            </div>
                                            {selectedMissionIds.has(item.id) && (
                                                <div className="absolute inset-0 bg-blue-500/10 border-2 border-brand-blue rounded pointer-events-none"></div>
                                            )}
                                            <div className="flex items-center justify-between gap-2">
                                                <p className="font-bold text-slate-800 pr-2 truncate">{item.clientName}</p>
                                                <span className="text-[10px] font-bold text-slate-700 shrink-0">
                                                    {dayjs.tz(item.date, 'YYYY-MM-DD', MARTINIQUE_TIMEZONE).format('DD/MM')}
                                                </span>
                                            </div>
                                            <p className="text-[10px]">{item.startTime}-{item.endTime}</p>
                                            {clientCity ? (
                                                <p className="text-[10px] text-slate-600 truncate">{clientCity}</p>
                                            ) : null}
                                            <p className="text-[10px] font-bold text-slate-700 truncate">{item.providerName}</p>
                                        </div>
                                    );
                                })}
                        </div>
                     ))}
                    </div>
                </div>
            </div>
            
            {/* Actions & Missions - Responsive */}
            <div className="hidden md:flex w-full md:w-64 bg-white border border-slate-200 flex-col md:h-auto">
                <div className="bg-slate-100 p-3 text-center font-bold text-slate-700 border-b border-slate-200">
                    Actions & Missions
                </div>
                <div className="p-2 space-y-2 overflow-y-auto max-h-64 md:max-h-96 md:flex-1">
                    <button 
                        onClick={() => { setIsReminderModalOpen(true); setReminderForm({ text: '', date: getMartiniqueToday(), notifyEmail: true }); }}
                        className="w-full bg-yellow-100 text-yellow-800 py-2 rounded font-bold text-xs hover:bg-yellow-200 flex items-center justify-center gap-2 mb-4 border border-yellow-200"
                    >
                        <Flag className="w-3 h-3" /> Ajouter un Rappel
                    </button>

                    {unassignedMissions.length === 0 ? (
                        <p className="text-center text-xs text-slate-400 italic mt-4">Toutes les missions sont assignées.</p>
                    ) : (
                        <>
                            <div className="text-xs text-slate-500 font-bold mb-2">
                                {unassignedMissions.length} mission{unassignedMissions.length > 1 ? 's' : ''} à assigner
                            </div>
                            {unassignedMissions.map(m => (
                                <div key={m.id} className="bg-red-50 border border-red-100 p-2 rounded cursor-pointer hover:bg-red-100 shrink-0">
                                    <p className="font-bold text-xs text-red-800 truncate">{m.clientName}</p>
                                    <p className="text-[10px] text-red-600 truncate">{m.date} | {m.service}</p>
                                    <button onClick={() => setSelectedMissionId(m.id)} className="mt-1 w-full bg-red-200 text-red-800 text-[10px] font-bold rounded px-1 hover:bg-red-300">Assigner</button>
                                </div>
                            ))}
                        </>
                    )}
                </div>
            </div>
       </div>

       <button
           type="button"
           onClick={() => setIsMobileActionsOpen(true)}
           className="md:hidden fixed bottom-24 right-4 z-40 bg-brand-blue text-white rounded-full shadow-xl w-14 h-14 flex items-center justify-center"
           title="Actions & Missions"
       >
           <Briefcase className="w-6 h-6" />
       </button>

       {/* Légende déplacée dans le panneau "Actions & Missions" sur mobile pour ne pas masquer la vue */}

       {/* Footer Stats - Updated to reflect filtered items */}
       <div className="bg-slate-200 p-4 mt-6 flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center font-bold text-slate-800 rounded-lg">
            <div className="flex items-center justify-between sm:justify-start gap-2">
                <span>Total heures ({dayjs.tz(statsDate, 'YYYY-MM-DD', MARTINIQUE_TIMEZONE).format('DD/MM')}) :</span>
                <span className="text-xl">{totalHoursToday}h</span>
            </div>
            <div className="flex items-center justify-between sm:justify-start gap-2">
                <span>Total heures ({currentWeekOffset === 0 ? 'Cette semaine' : 'Semaine sélectionnée'}) :</span>
                <span className="text-xl">{totalHoursFiltered}h</span>
            </div>
       </div>

       {isStatsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-cream-50">
                    <div>
                        <h3 className="text-lg font-serif font-bold text-slate-800">Statistiques</h3>
                        <p className="text-xs text-slate-500 mt-1">Aperçu rapide (jour & semaine)</p>
                    </div>
                    <button
                        type="button"
                        onClick={() => setIsStatsModalOpen(false)}
                        className="p-2 hover:bg-slate-200 rounded-full transition"
                        aria-label="Fermer"
                        title="Fermer"
                    >
                        <X className="w-5 h-5 text-slate-500" />
                    </button>
                </div>

                <div className="p-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <button
                        type="button"
                        onClick={() => applyStatsFilter('day-planned')}
                        className="bg-slate-100 p-4 rounded-lg flex flex-col items-center justify-center border-l-4 border-slate-300 hover:bg-slate-200 transition text-center"
                        title="Filtrer sur aujourd'hui"
                    >
                        <span className="text-xs font-bold text-slate-700">Missions en cours</span>
                        <span className="text-brand-blue font-serif text-2xl italic mt-1">{missionsCountToday}</span>
                        <span className="text-[11px] text-teal-600 mt-1 italic">Nombre du jour</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => applyStatsFilter('week-all')}
                        className="bg-slate-100 p-4 rounded-lg flex flex-col items-center justify-center border-l-4 border-slate-300 hover:bg-slate-200 transition text-center"
                        title="Filtrer sur la semaine"
                    >
                        <span className="text-xs font-bold text-slate-700">Total missions</span>
                        <span className="text-brand-blue font-serif text-2xl italic mt-1">{missionsCountWeek}</span>
                        <span className="text-[11px] text-teal-600 mt-1 italic">Cette semaine</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => applyStatsFilter('week-completed')}
                        className="bg-slate-100 p-4 rounded-lg flex flex-col items-center justify-center border-l-4 border-slate-300 hover:bg-slate-200 transition text-center"
                        title="Filtrer sur les missions terminées (semaine)"
                    >
                        <span className="text-xs font-bold text-slate-700">Missions terminées</span>
                        <span className="text-brand-blue font-serif text-2xl italic mt-1">{missionsCompletedWeek}</span>
                        <span className="text-[11px] text-teal-600 mt-1 italic">Cette semaine</span>
                    </button>
                </div>

                <div className="p-5 border-t border-slate-100 flex justify-end">
                    <button
                        type="button"
                        onClick={() => setIsStatsModalOpen(false)}
                        className="px-6 py-2 rounded-lg text-slate-600 font-bold hover:bg-slate-100 transition"
                    >
                        Fermer
                    </button>
                </div>
            </div>
        </div>
       )}

       {isQuickPlanModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
                <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-cream-50">
                    <div>
                        <h3 className="text-lg font-serif font-bold text-slate-800">Planification rapide</h3>
                        <p className="text-xs text-slate-500 mt-1">Créer une prestation manuellement</p>
                    </div>
                    <button type="button" onClick={() => setIsQuickPlanModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full transition">
                        <X className="w-5 h-5 text-slate-500" />
                    </button>
                </div>

                <form onSubmit={handleQuickPlanSubmit} className="p-5 space-y-4 overflow-y-auto max-h-[80vh]">
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">Client</label>
                        <select
                            required
                            name="clientId"
                            value={quickPlanForm.clientId}
                            onChange={() => {}}
                            className="sr-only"
                            tabIndex={-1}
                        >
                            <option value="">Sélectionner...</option>
                            {clients.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                        <SearchableSelect
                            options={clients.map(c => ({ value: c.id, label: c.name }))}
                            value={quickPlanForm.clientId}
                            onChange={(value) => setQuickPlanForm(prev => ({ ...prev, clientId: value }))}
                            placeholder="Sélectionner..."
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">Date de prestation</label>
                        <input
                            required
                            type="date"
                            value={quickPlanForm.date}
                            onChange={(e) => setQuickPlanForm(prev => ({ ...prev, date: e.target.value }))}
                            className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg focus:border-brand-blue outline-none"
                        />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1">Heure début</label>
                            <input
                                required
                                type="time"
                                value={quickPlanForm.startTime}
                                onChange={(e) => setQuickPlanForm(prev => ({ ...prev, startTime: e.target.value }))}
                                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg focus:border-brand-blue outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1">Heure fin</label>
                            <input
                                required
                                type="time"
                                value={quickPlanForm.endTime}
                                onChange={(e) => setQuickPlanForm(prev => ({ ...prev, endTime: e.target.value }))}
                                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg focus:border-brand-blue outline-none"
                            />
                        </div>
                    </div>

                    <div className="pt-2 flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={() => setIsQuickPlanModalOpen(false)}
                            className="px-5 py-2 rounded-lg text-slate-600 font-bold hover:bg-slate-100 transition"
                            disabled={isSubmitting}
                        >
                            Annuler
                        </button>
                        <button
                            type="submit"
                            className="px-5 py-2 rounded-lg bg-brand-blue text-white font-bold hover:opacity-90 transition disabled:opacity-60"
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? 'Création...' : 'Créer'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
       )}


       {/* NEW MISSION MODAL */}
       {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
                <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-cream-50">
                    <div>
                        <h3 className="text-xl font-serif font-bold text-slate-800">Nouvelle Mission</h3>
                        <p className="text-xs text-slate-500 mt-1">Ajouter une prestation au planning</p>
                    </div>
                    <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full transition">
                        <X className="w-5 h-5 text-slate-500" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto max-h-[80vh]">
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">Client</label>
                        <select
                            required
                            name="clientId"
                            value={missionForm.clientId}
                            onChange={() => {}}
                            className="sr-only"
                            tabIndex={-1}
                        >
                            <option value="">Sélectionner...</option>
                            {clients.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                        <SearchableSelect
                            options={clients.map(c => ({ value: c.id, label: c.name }))}
                            value={missionForm.clientId}
                            onChange={(value) => setMissionForm(prev => ({ ...prev, clientId: value }))}
                            placeholder="Sélectionner..."
                        />
                    </div>

                    {/* Date Logic */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                         <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1">Date Début</label>
                            <input 
                                required
                                type="date" 
                                name="date"
                                value={missionForm.date}
                                onChange={(e) => {
                                    handleFormChange(e);
                                    // Auto-set end date to start date if empty
                                    if(!missionForm.endDate) setMissionForm(prev => ({...prev, endDate: e.target.value}));
                                }}
                                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg focus:border-brand-blue outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1">Date Fin (Si diff.)</label>
                            <input 
                                type="date" 
                                name="endDate"
                                value={missionForm.endDate}
                                onChange={handleFormChange}
                                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg focus:border-brand-blue outline-none"
                            />
                        </div>
                    </div>

                    {/* Time Logic */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                             <label className="block text-sm font-bold text-slate-700 mb-1">Heure Début</label>
                             <input 
                                required
                                type="time" 
                                name="startTime"
                                value={missionForm.startTime}
                                onChange={handleFormChange}
                                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg focus:border-brand-blue outline-none"
                            />
                        </div>
                        <div>
                             <label className="block text-sm font-bold text-slate-700 mb-1">Heure Fin</label>
                             <input 
                                required
                                type="time" 
                                name="endTime"
                                value={missionForm.endTime}
                                onChange={handleFormChange}
                                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg focus:border-brand-blue outline-none"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                        <div>
                             <label className="block text-sm font-bold text-slate-700 mb-1">Prestataire</label>
                             <select
                                name="providerId"
                                value={missionForm.providerId}
                                onChange={() => {}}
                                className="sr-only"
                                tabIndex={-1}
                             >
                                <option value="">(À assigner plus tard)</option>
                                {providers.map(p => {
                                    const nonWorking = missionForm.date ? isProviderNonWorkingDay(p.id, missionForm.date) : false;
                                    const available = missionForm.date ? isProviderAvailable(p.id, missionForm.date, missionForm.startTime, missionForm.endTime) : true;
                                    return (
                                        <option key={p.id} value={p.id} disabled={!available}>
                                            {p.firstName} {p.lastName} {nonWorking ? '(Ne travaille pas ce jour)' : (!available ? '(Congés/Indisp.)' : '')}
                                        </option>
                                    );
                                })}
                             </select>
                             <SearchableSelect
                                options={[
                                    { value: '', label: '(À assigner plus tard)' },
                                    ...providers.map(p => {
                                        const nonWorking = missionForm.date ? isProviderNonWorkingDay(p.id, missionForm.date) : false;
                                        const available = missionForm.date ? isProviderAvailable(p.id, missionForm.date, missionForm.startTime, missionForm.endTime) : true;
                                        return {
                                            value: p.id,
                                            label: `${p.firstName} ${p.lastName}${nonWorking ? ' (Ne travaille pas ce jour)' : (!available ? ' (Congés/Indisp.)' : '')}`,
                                            disabled: !available
                                        };
                                    })
                                ]}
                                value={missionForm.providerId}
                                onChange={(value) => setMissionForm(prev => ({ ...prev, providerId: value }))}
                                placeholder="(À assigner plus tard)"
                             />
                        </div>
                    </div>

                     <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">Service</label>
                        <input 
                            required
                            type="text" 
                            name="service"
                            value={missionForm.service}
                            onChange={handleFormChange}
                            placeholder="Ex: Ménage, Jardinage..."
                            className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg focus:border-brand-blue focus:ring-1 focus:ring-brand-blue outline-none"
                        />
                    </div>
                    
                    {/* Recurrence Section */}
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                        <div className="flex items-center gap-2 mb-2 text-brand-blue font-bold text-sm">
                            <Repeat className="w-4 h-4" /> Options de Récurrence
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">Type</label>
                                <select
                                    name="recurrence"
                                    value={missionForm.recurrence}
                                    onChange={() => {}}
                                    className="sr-only"
                                    tabIndex={-1}
                                >
                                    <option value="none">Ponctuel (1 fois)</option>
                                    <option value="weekly">Hebdomadaire (Tous les 7 jours)</option>
                                    <option value="biweekly">Bimensuel (Tous les 14 jours)</option>
                                    <option value="monthly">Mensuel (Même date)</option>
                                </select>
                                <SearchableSelect
                                    options={[
                                        { value: 'none', label: 'Ponctuel (1 fois)' },
                                        { value: 'weekly', label: 'Hebdomadaire (Tous les 7 jours)' },
                                        { value: 'biweekly', label: 'Bimensuel (Tous les 14 jours)' },
                                        { value: 'monthly', label: 'Mensuel (Même date)' }
                                    ]}
                                    value={missionForm.recurrence}
                                    onChange={(value) => setMissionForm(prev => ({ ...prev, recurrence: value }))}
                                />
                            </div>
                            {missionForm.recurrence !== 'none' && (
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">Répétitions</label>
                                    <input 
                                        type="number" 
                                        name="occurrences"
                                        min="2"
                                        max="52"
                                        value={missionForm.occurrences}
                                        onChange={handleFormChange}
                                        className="w-full p-2 bg-white border border-slate-200 rounded-lg text-sm outline-none"
                                    />
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="pt-4 flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={() => setIsModalOpen(false)}
                            className="px-6 py-2 rounded-lg text-slate-600 font-bold hover:bg-slate-100 transition"
                            disabled={isSubmitting}
                        >
                            Annuler
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="px-6 py-2 rounded-lg bg-brand-blue text-white font-bold hover:bg-teal-700 transition shadow-lg shadow-brand-blue/20 flex items-center gap-2 disabled:opacity-70"
                        >
                            {isSubmitting ? <div className="w-10 h-3 bg-white/40 rounded animate-pulse" /> : <CheckCircle className="w-4 h-4" />}
                            {isSubmitting ? 'Enregistrement...' : 'Planifier'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
       )}

       {/* REMINDER MODAL */}
       {isReminderModalOpen && (
           <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
               <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200">
                   <div className="p-4 bg-yellow-50 border-b border-yellow-100 flex justify-between items-center">
                       <h3 className="font-bold text-yellow-800 flex items-center gap-2"><Flag className="w-4 h-4"/> Nouveau Rappel</h3>
                       <button onClick={() => setIsReminderModalOpen(false)}><X className="w-5 h-5 text-slate-400"/></button>
                   </div>
                   <form onSubmit={handleReminderSubmit} className="p-6 space-y-4">
                       <div>
                           <label className="block text-xs font-bold text-slate-500 mb-1">Message</label>
                           <input 
                                required
                                type="text"
                                className="w-full border rounded p-2 text-sm"
                                placeholder="Ex: Appeler Mr Dupont..."
                                value={reminderForm.text}
                                onChange={(e) => setReminderForm({...reminderForm, text: e.target.value})}
                           />
                       </div>
                       <div>
                           <label className="block text-xs font-bold text-slate-500 mb-1">Date</label>
                           <input 
                                required
                                type="date"
                                className="w-full border rounded p-2 text-sm"
                                value={reminderForm.date}
                                onChange={(e) => setReminderForm({...reminderForm, date: e.target.value})}
                           />
                       </div>
                       <div className="flex items-center gap-2 pt-2">
                           <input 
                                type="checkbox"
                                id="notifyEmail"
                                checked={reminderForm.notifyEmail}
                                onChange={(e) => setReminderForm({...reminderForm, notifyEmail: e.target.checked})}
                                className="w-4 h-4 text-brand-blue"
                           />
                           <label htmlFor="notifyEmail" className="text-sm font-bold text-slate-700">M'envoyer une notification par email</label>
                       </div>
                       <div className="flex justify-end pt-4">
                           <button type="submit" disabled={isSubmitting} className="bg-brand-blue text-white px-4 py-2 rounded font-bold text-sm hover:bg-teal-700">
                               {isSubmitting ? '...' : 'Ajouter au planning'}
                           </button>
                       </div>
                   </form>
               </div>
           </div>
       )}

       {/* ASSIGNMENT MODAL */}
       {selectedMissionId && missionToAssign && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/90 backdrop-blur-sm p-4">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
                    <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-cream-50">
                        <div>
                            <h3 className="text-xl font-serif font-bold text-slate-800">Assigner Prestataire</h3>
                            <p className="text-xs text-slate-500 mt-1">Envoyer l'ordre de mission</p>
                        </div>
                        <button disabled={isSubmitting} onClick={() => setSelectedMissionId(null)} className="p-2 hover:bg-slate-200 rounded-full transition disabled:opacity-50">
                            <X className="w-5 h-5 text-slate-500" />
                        </button>
                    </div>
                    
                    <div className="p-6 space-y-6 relative">
                        {isSubmitting && (
                            <div className="absolute inset-0 z-10 bg-white/70 backdrop-blur-[1px] flex items-center justify-center">
                                <div className="flex items-center gap-3 bg-white border border-slate-200 shadow-sm rounded-xl px-4 py-3">
                                    <Loader2 className="w-5 h-5 animate-spin text-brand-blue" />
                                    <div className="text-sm font-extrabold text-slate-700">Assignation en cours…</div>
                                </div>
                            </div>
                        )}
                        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 text-sm">
                            <h4 className="font-bold text-slate-700 mb-2 border-b pb-1">Détails Mission</h4>
                            <div className="grid grid-cols-2 gap-2">
                                <div className="text-slate-500">Client</div>
                                <div className="font-bold text-slate-800">{missionToAssign.clientName}</div>
                                <div className="text-slate-500">Date</div>
                                <div className="font-bold text-slate-800">{missionToAssign.date}</div>
                                <div className="text-slate-500">Horaire</div>
                                <div className="font-bold text-slate-800">{missionToAssign.startTime} - {missionToAssign.endTime}</div>
                                <div className="text-slate-500">Service</div>
                                <div className="font-bold text-brand-blue">{missionToAssign.service}</div>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">Choisir un prestataire</label>
                            <select 
                                className="w-full p-3 bg-white border border-slate-300 rounded-lg outline-none focus:border-brand-blue focus:ring-1 focus:ring-brand-blue"
                                value={assignProviderId}
                                onChange={(e) => setAssignProviderId(e.target.value)}
                                disabled={isSubmitting}
                            >
                                <option value="">Sélectionner dans la liste...</option>
                                {providers.map(p => {
                                    const available = missionToAssign.date ? isProviderAvailable(p.id, missionToAssign.date, missionToAssign.startTime, missionToAssign.endTime) : true;
                                    const isActive = p.status === 'Active';
                                    const canAssign = available && isActive;
                                    return (
                                        <option key={p.id} value={p.id} disabled={!canAssign} className={!canAssign ? 'text-slate-400' : ''}>
                                            {p.firstName} {p.lastName} {isActive ? (available ? '✅' : '(Indisponible/Congés)') : '(Inactif)'}
                                        </option>
                                    )
                                })}
                            </select>
                        </div>
                        
                        <div className="bg-blue-50 p-3 rounded-lg flex items-start gap-3">
                            <Mail className="w-5 h-5 text-brand-blue mt-0.5" />
                            <p className="text-xs text-blue-800">
                                En validant, un email automatique contenant les détails (Date, Heure, Adresse, Client) sera envoyé au prestataire sélectionné.
                            </p>
                        </div>

                        <div className="flex justify-end gap-3 pt-2">
                            <button disabled={isSubmitting} onClick={() => setSelectedMissionId(null)} className="px-4 py-2 text-slate-500 font-bold hover:bg-slate-100 rounded-lg transition disabled:opacity-50">Annuler</button>
                            <button 
                                onClick={handleConfirmAssignment}
                                disabled={!assignProviderId || isSubmitting}
                                className="px-6 py-2 bg-brand-blue text-white font-bold rounded-lg hover:bg-teal-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                {isSubmitting ? (
                                    <>
                                        <div className="w-16 h-4 bg-white/40 rounded animate-pulse" />
                                        Assignation...
                                    </>
                                ) : (
                                    <>
                                        <Mail className="w-4 h-4" /> Envoyer & Assigner
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
       )}

       {/* Delete Confirmation Modal */}
       {deleteConfirmOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm animate-in fade-in zoom-in duration-200">
                <div className="flex flex-col items-center text-center">
                    <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-4">
                        <AlertTriangle className="w-6 h-6" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-800 mb-2">Confirmer la suppression</h3>
                    <p className="text-sm text-slate-500 mb-6">
                        Êtes-vous sûr de vouloir supprimer définitivement {selectedMissionIds.size} mission(s) ? 
                    </p>
                    <div className="flex gap-3 w-full">
                        <button 
                            onClick={() => setDeleteConfirmOpen(false)}
                            className="flex-1 py-2 text-slate-600 font-bold bg-slate-100 hover:bg-slate-200 rounded-lg transition"
                        >
                            Annuler
                        </button>
                        <button 
                            onClick={executeBulkDeleteMissions}
                            className="flex-1 py-2 text-white font-bold bg-red-600 hover:bg-red-700 rounded-lg transition shadow-md"
                        >
                            Supprimer
                        </button>
                    </div>
                </div>
            </div>
        </div>
      )}

      {isProvisionalDetailsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200 max-h-[68vh]">
                <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-cream-50">
                    <div>
                        <h3 className="text-lg font-serif font-bold text-slate-800">Détails (En attente)</h3>
                    </div>
                    <button
                        onClick={() => {
                            setIsProvisionalDetailsModalOpen(false);
                            setSelectedProvisionalDetails(null);
                        }}
                        className="p-2 hover:bg-slate-200 rounded-full transition"
                    >
                        <X className="w-5 h-5 text-slate-500" />
                    </button>
                </div>
                <div className="p-6 overflow-y-auto flex-1 min-h-0">
                    <p className="text-sm font-bold text-orange-700">En attente de validation par le client</p>

                    <div className="mt-4 bg-slate-50 border border-slate-200 rounded-lg p-4 text-sm">
                        <div className="grid grid-cols-2 gap-2">
                            <div className="text-slate-500">Client</div>
                            <div className="font-bold text-slate-800">{selectedProvisionalDetails?.clientName || '—'}</div>
                            <div className="text-slate-500">Date</div>
                            <div className="font-bold text-slate-800">{selectedProvisionalDetails?.date || '—'}</div>
                            <div className="text-slate-500">Horaire</div>
                            <div className="font-bold text-slate-800">{selectedProvisionalDetails?.startTime || '—'} - {selectedProvisionalDetails?.endTime || '—'}</div>
                            <div className="text-slate-500">Prestataire</div>
                            <div className="font-bold text-slate-800">{selectedProvisionalDetails?.providerName || 'À assigner'}</div>
                            <div className="text-slate-500">Service</div>
                            <div className="font-bold text-brand-blue">{selectedProvisionalDetails?.service || 'Devis'}</div>
                            <div className="text-slate-500">Devis</div>
                            <div className="font-bold text-slate-800 text-xs">{selectedProvisionalDetails?.sourceDocumentId || '—'}</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* Mission Details Modal */}
      {isDetailsModalOpen && selectedMissionDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[94vh] overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col">
                <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-cream-50">
                    <div>
                        <h3 className="text-xl font-serif font-bold text-slate-800">Détails de la Mission</h3>
                        <p className="text-xs text-slate-500 mt-1">Informations complètes sur la prestation</p>
                    </div>
                    <button onClick={() => { setIsDetailsModalOpen(false); setSelectedMissionDetails(null); }} className="p-2 hover:bg-slate-200 rounded-full transition">
                        <X className="w-5 h-5 text-slate-500" />
                    </button>
                </div>
                
                <div className="p-6 space-y-6 overflow-y-auto flex-1">
                    {/* Client Information */}
                    <div className="bg-slate-50 p-4 rounded-lg">
                        <h4 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                            <User className="w-4 h-4" /> Client
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                            <div>
                                <span className="text-slate-500">Nom complet:</span>
                                <p className="font-semibold">{detailClient?.name || selectedMissionDetails.clientName || '—'}</p>
                            </div>
                            <div>
                                <span className="text-slate-500">Prénom:</span>
                                <p className="font-semibold">{(() => {
                                    const n = (detailClient?.name || selectedMissionDetails.clientName || '').trim();
                                    if (!n) return '—';
                                    const parts = n.split(' ').filter(Boolean);
                                    if (parts.length <= 1) return n;
                                    parts.pop();
                                    return parts.join(' ') || '—';
                                })()}</p>
                            </div>
                            <div>
                                <span className="text-slate-500">Nom:</span>
                                <p className="font-semibold">{(() => {
                                    const n = (detailClient?.name || selectedMissionDetails.clientName || '').trim();
                                    if (!n) return '—';
                                    const parts = n.split(' ').filter(Boolean);
                                    if (parts.length <= 1) return n;
                                    return parts[parts.length - 1] || '—';
                                })()}</p>
                            </div>
                            <div>
                                <span className="text-slate-500">ID client:</span>
                                <p className="font-semibold text-xs">{detailClient?.id || selectedMissionDetails.clientId || '—'}</p>
                            </div>

                            <div>
                                <span className="text-slate-500">Téléphone:</span>
                                <p className="font-semibold">{detailClient?.phone || '—'}</p>
                            </div>
                            <div>
                                <span className="text-slate-500">Email:</span>
                                <p className="font-semibold">{detailClient?.email || '—'}</p>
                            </div>

                            <div className="sm:col-span-2">
                                <span className="text-slate-500">Adresse:</span>
                                <p className="font-semibold">{detailClient?.address || '—'}</p>
                            </div>

                            <div>
                                <span className="text-slate-500">Ville:</span>
                                <p className="font-semibold">{detailClient?.city || '—'}</p>
                            </div>
                            <div>
                                <span className="text-slate-500">Pack:</span>
                                <p className="font-semibold">{detailClient?.pack || '—'}</p>
                            </div>

                            <div>
                                <span className="text-slate-500">Statut client:</span>
                                <p className="font-semibold">{detailClient?.status || '—'}</p>
                            </div>
                            <div>
                                <span className="text-slate-500">Client depuis:</span>
                                <p className="font-semibold">{detailClient?.since || '—'}</p>
                            </div>

                            <div>
                                <span className="text-slate-500">Packs consommés:</span>
                                <p className="font-semibold">{typeof detailClient?.packsConsumed === 'number' ? detailClient.packsConsumed : '—'}</p>
                            </div>
                            <div>
                                <span className="text-slate-500">Heures fidélité:</span>
                                <p className="font-semibold">{typeof detailClient?.loyaltyHoursAvailable === 'number' ? detailClient.loyaltyHoursAvailable : '—'}</p>
                            </div>

                            <div>
                                <span className="text-slate-500">Avis laissé:</span>
                                <p className="font-semibold">{detailClient?.hasLeftReview === true ? 'Oui' : detailClient?.hasLeftReview === false ? 'Non' : '—'}</p>
                            </div>
                            <div>
                                <span className="text-slate-500">Mot de passe initial:</span>
                                <p className="font-semibold">{detailClient?.initialPassword ? String(detailClient.initialPassword) : '—'}</p>
                            </div>

                            <div>
                                <span className="text-slate-500">Date mission:</span>
                                <p className="font-semibold">{dayjs.tz(selectedMissionDetails.date, 'YYYY-MM-DD', MARTINIQUE_TIMEZONE).format('DD/MM/YYYY')}</p>
                            </div>
                            <div>
                                <span className="text-slate-500">Horaires:</span>
                                <p className="font-semibold">{selectedMissionDetails.startTime} - {selectedMissionDetails.endTime}</p>
                            </div>
                        </div>
                    </div>

                    {/* Prestataire Information */}
                    <div className="bg-blue-50 p-4 rounded-lg">
                        <h4 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                            <Briefcase className="w-4 h-4" /> Prestataire
                        </h4>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <span className="text-slate-500">Nom:</span>
                                <p className="font-semibold">{selectedMissionDetails.providerName}</p>
                            </div>
                            <div>
                                <span className="text-slate-500">Statut:</span>
                                <p className="font-semibold">
                                    <span className={`px-2 py-1 rounded text-xs ${
                                        selectedMissionDetails.status === 'completed' ? 'bg-green-100 text-green-700' :
                                        selectedMissionDetails.status === 'planned' ? 'bg-orange-100 text-orange-700' :
                                        selectedMissionDetails.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                                        'bg-gray-100 text-gray-700'
                                    }`}>
                                        {selectedMissionDetails.status === 'completed' ? 'Terminée' :
                                         selectedMissionDetails.status === 'planned' ? 'Planifiée' :
                                         selectedMissionDetails.status === 'in_progress' ? 'En cours' :
                                         selectedMissionDetails.status}
                                    </span>
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Mission Details */}
                    <div className="bg-green-50 p-4 rounded-lg">
                        <h4 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                            <Calendar className="w-4 h-4" /> Mission
                        </h4>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <span className="text-slate-500">Service:</span>
                                <p className="font-semibold">{selectedMissionDetails.service}</p>
                            </div>
                            <div>
                                <span className="text-slate-500">Horaires:</span>
                                <p className="font-semibold">{selectedMissionDetails.startTime} - {selectedMissionDetails.endTime}</p>
                            </div>
                            <div>
                                <span className="text-slate-500">Durée:</span>
                                <p className="font-semibold">{selectedMissionDetails.duration}h</p>
                            </div>
                            <div>
                                <span className="text-slate-500">ID Mission:</span>
                                <p className="font-semibold text-xs">{selectedMissionDetails.id}</p>
                            </div>
                        </div>
                    </div>

                    {/* Additional Information */}
                    {selectedMissionDetails.source && (
                        <div className="bg-purple-50 p-4 rounded-lg">
                            <h4 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                                <FileText className="w-4 h-4" /> Source
                            </h4>
                            <p className="text-sm">
                                <span className="text-slate-500">Origine:</span>
                                <span className="font-semibold ml-2">
                                    {selectedMissionDetails.source === 'devis' ? 'Devis signé' : 'Création manuelle'}
                                </span>
                                {selectedMissionDetails.sourceDocumentId && (
                                    <span className="text-xs text-slate-400 ml-2">
                                        (ID: {selectedMissionDetails.sourceDocumentId})
                                    </span>
                                )}
                            </p>
                        </div>
                    )}
                </div>

                <div className="p-6 border-t border-slate-100 flex flex-col sm:flex-row sm:justify-end gap-3 shrink-0">
                    {selectedMissionDetails.sourceDocumentId && (
                        <button
                            onClick={() => navigate('/invoices', { state: { documentId: selectedMissionDetails.sourceDocumentId, filter: 'devis' } })}
                            className="w-full sm:w-auto px-6 py-2 bg-slate-100 text-slate-700 font-bold rounded-lg hover:bg-slate-200 transition flex items-center justify-center gap-2"
                        >
                            <FileText className="w-4 h-4" />
                            <span className="text-sm text-slate-700">Voir le devis</span>
                        </button>
                    )}
                    <button
                        onClick={() => {
                            setAssignProviderId('');
                            setIsDetailsModalOpen(false);
                            setSelectedMissionDetails(null);
                            setSelectedMissionId(selectedMissionDetails.id);
                        }}
                        className="w-full sm:w-auto px-6 py-2 bg-brand-blue text-white font-bold rounded-lg hover:opacity-90 transition flex items-center justify-center gap-2"
                    >
                        <Mail className="w-4 h-4" />
                        <span className="text-sm text-white">Assigner prestataire</span>
                    </button>
                    <button
                        onClick={handleCopyMissionDetails}
                        className="w-full sm:w-auto px-6 py-2 bg-white border border-slate-200 text-slate-700 font-bold rounded-lg hover:bg-slate-50 transition flex items-center justify-center gap-2"
                    >
                        <CopyIcon className="w-4 h-4" />
                        <span className="text-sm text-slate-700">Copier les infos</span>
                    </button>
                    <button
                        onClick={() => {
                            setIsDetailsModalOpen(false);
                            openEditMissionModal();
                        }}
                        className="w-full sm:w-auto px-6 py-2 bg-brand-blue text-white font-bold rounded-lg hover:opacity-90 transition"
                    >
                        <span className="text-sm text-white">Modifier</span>
                    </button>
                    <button 
                        onClick={() => { setIsDetailsModalOpen(false); setSelectedMissionDetails(null); }}
                        className="w-full sm:w-auto px-6 py-2 rounded-lg text-slate-600 font-bold hover:bg-slate-100 transition"
                    >
                        <span className="text-sm text-slate-600">Fermer</span>
                    </button>
                    <button 
                        onClick={() => { 
                            toggleMissionSelection(selectedMissionDetails.id, { stopPropagation: () => {} } as any);
                            setIsDetailsModalOpen(false);
                            setSelectedMissionDetails(null);
                        }}
                        className="w-full sm:w-auto px-6 py-2 bg-red-100 text-red-600 font-bold rounded-lg hover:bg-red-200 transition"
                    >
                        <span className="text-sm text-red-600">Sélectionner</span>
                    </button>
                </div>
            </div>
        </div>
      )}

      {isEditMissionModalOpen && selectedMissionDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-cream-50">
                    <div>
                        <h3 className="text-xl font-serif font-bold text-slate-800">Modifier la Mission</h3>
                        <p className="text-xs text-slate-500 mt-1">Modifier prestataire, date, horaires et service</p>
                    </div>
                    <button onClick={() => setIsEditMissionModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full transition">
                        <X className="w-5 h-5 text-slate-500" />
                    </button>
                </div>

                <form onSubmit={handleEditMissionSubmit} className="p-6 space-y-5 overflow-y-auto max-h-[70vh]">
                    <div className="grid grid-cols-1 gap-4">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1">Prestataire</label>
                            <SearchableSelect
                                options={[
                                    { value: '', label: '(À assigner plus tard)' },
                                    ...providers.map(p => {
                                        const nonWorking = editMissionForm.date ? isProviderNonWorkingDay(p.id, editMissionForm.date) : false;
                                        const available = editMissionForm.date ? isProviderAvailable(p.id, editMissionForm.date, editMissionForm.startTime, editMissionForm.endTime) : true;
                                        return {
                                            value: p.id,
                                            label: `${p.firstName} ${p.lastName}${nonWorking ? ' (Ne travaille pas ce jour)' : (!available ? ' (Congés/Indisp.)' : '')}`,
                                            disabled: !available
                                        };
                                    })
                                ]}
                                value={editMissionForm.providerId}
                                onChange={(value) => setEditMissionForm(prev => ({ ...prev, providerId: value }))}
                                placeholder="(À assigner plus tard)"
                            />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Date</label>
                                <input
                                    required
                                    type="date"
                                    value={editMissionForm.date}
                                    onChange={(e) => setEditMissionForm(prev => ({ ...prev, date: e.target.value }))}
                                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg focus:border-brand-blue outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Statut</label>
                                <select
                                    value={editMissionForm.status}
                                    onChange={(e) => setEditMissionForm(prev => ({ ...prev, status: e.target.value as Mission['status'] }))}
                                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg focus:border-brand-blue outline-none font-bold"
                                >
                                    <option value="planned">Planifiée</option>
                                    <option value="in_progress">En cours</option>
                                    <option value="completed">Terminée</option>
                                    <option value="cancelled">Annulée</option>
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Heure début</label>
                                <input
                                    required
                                    type="time"
                                    value={editMissionForm.startTime}
                                    onChange={(e) => setEditMissionForm(prev => ({ ...prev, startTime: e.target.value }))}
                                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg focus:border-brand-blue outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Heure fin</label>
                                <input
                                    required
                                    type="time"
                                    value={editMissionForm.endTime}
                                    onChange={(e) => setEditMissionForm(prev => ({ ...prev, endTime: e.target.value }))}
                                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg focus:border-brand-blue outline-none"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1">Service</label>
                            <input
                                required
                                type="text"
                                value={editMissionForm.service}
                                onChange={(e) => setEditMissionForm(prev => ({ ...prev, service: e.target.value }))}
                                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg focus:border-brand-blue outline-none"
                            />
                        </div>
                    </div>

                    <div className="pt-2 flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={() => setIsEditMissionModalOpen(false)}
                            className="px-6 py-2 rounded-lg text-slate-600 font-bold hover:bg-slate-100 transition"
                            disabled={isSubmitting}
                        >
                            Annuler
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="px-6 py-2 rounded-lg bg-brand-blue text-white font-bold hover:opacity-90 transition disabled:opacity-70"
                        >
                            {isSubmitting ? 'Enregistrement...' : 'Enregistrer'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
      )}
    </div>
  );
};

export default Planning;
