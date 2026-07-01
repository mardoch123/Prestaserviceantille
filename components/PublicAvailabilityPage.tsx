import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  Copy,
  Check,
  Phone,
  Mail,
  Users,
} from 'lucide-react';
import { supabase } from '../utils/supabaseClient';

// ─── Types ──────────────────────────────────────────────────────────────────

type TimeSlot = { startTime: string; endTime: string };

type ServiceAvailability = {
  serviceType: string;
  freeSlots: TimeSlot[];
  totalProviders: number;
};

type DayAvailability = {
  date: string;
  dayOfWeek: number;
  dayOfMonth: number;
  month: number;
  year: number;
  isToday: boolean;
  isPast: boolean;
  isSunday: boolean;
  availableServices: ServiceAvailability[];
};

type ViewMode = 'week' | 'month';

// ─── Helpers ────────────────────────────────────────────────────────────────

const WEEKDAYS_SHORT = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
const MONTHS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

const OPEN_HOUR = 9;
const CLOSE_HOUR = 16;
const SERVICE_TYPES = ['Ménage', 'Jardinage', 'Bricolage', 'Autre'] as const;

const SERVICE_COLORS: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  'Ménage':    { bg: 'bg-blue-50',    border: 'border-blue-200',    text: 'text-blue-700',    dot: 'bg-blue-500' },
  'Jardinage': { bg: 'bg-green-50',   border: 'border-green-200',   text: 'text-green-700',   dot: 'bg-green-500' },
  'Bricolage': { bg: 'bg-orange-50',  border: 'border-orange-200',  text: 'text-orange-700',  dot: 'bg-orange-500' },
  'Autre':     { bg: 'bg-purple-50',  border: 'border-purple-200',  text: 'text-purple-700',  dot: 'bg-purple-500' },
};

const pad = (n: number) => String(n).padStart(2, '0');

const toDateStr = (d: Date): string =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

const addDays = (d: Date, n: number): Date => {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
};

const getMonday = (d: Date): Date => {
  const r = new Date(d);
  const day = r.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  r.setDate(r.getDate() + diff);
  return r;
};

const getToday = (): Date => {
  const now = new Date();
  const utc = new Date(now.getTime() + now.getTimezoneOffset() * 60000);
  const mtq = new Date(utc.getTime() - 4 * 3600000);
  return new Date(mtq.getFullYear(), mtq.getMonth(), mtq.getDate());
};

function mapSpecialtyToDomain(specialty: string): string {
  const s = (specialty || '').toLowerCase();
  if (s.includes('ménage') || s.includes('menage') || s.includes('nettoyage')) return 'Ménage';
  if (s.includes('jardin')) return 'Jardinage';
  if (s.includes('bricol')) return 'Bricolage';
  return 'Autre';
}

function getHourSlots(
  provider: any,
  dayOfWeek: number,
  busyMissions: { start_time: string; end_time: string }[]
): number[] {
  const hours = Array.from({ length: 7 }, (_, i) => i + OPEN_HOUR);
  const availabilityMode = provider.availability_mode || provider.availabilityMode || 'unavailable';
  const availabilityHours = provider.availability_hours || provider.availabilityHours || {};
  const nonInterventionHours = provider.non_intervention_hours || provider.nonInterventionHours || {};
  const nonInterventionDays = provider.non_intervention_days || provider.nonInterventionDays || [];

  // Check if this day is a non-intervention day (rest day)
  if (Array.isArray(nonInterventionDays) && nonInterventionDays.includes(dayOfWeek)) return [];

  const isInRange = (hour: number, ranges: Array<{ start: string; end: string }>): boolean => {
    if (!ranges || ranges.length === 0) return false;
    return ranges.some(r => {
      const sh = parseInt(r.start?.split(':')[0] || '0');
      const eh = parseInt(r.end?.split(':')[0] || '0');
      return hour >= sh && hour < eh;
    });
  };

  let allowedHours: number[];
  if (availabilityMode === 'available') {
    const ranges = availabilityHours[dayOfWeek] || [];
    if (ranges.length === 0) return [];
    allowedHours = hours.filter(h => isInRange(h, ranges));
  } else {
    const ranges = nonInterventionHours[dayOfWeek] || [];
    allowedHours = ranges.length === 0 ? hours : hours.filter(h => !isInRange(h, ranges));
  }

  return allowedHours.filter(hour => {
    return !busyMissions.some(m => {
      const sh = parseInt(m.start_time?.split(':')[0] || '0');
      const eh = parseInt(m.end_time?.split(':')[0] || '0');
      return hour >= sh && hour < eh;
    });
  });
}

function mergeHoursToSlots(hours: number[]): TimeSlot[] {
  if (hours.length === 0) return [];
  const sorted = [...hours].sort((a, b) => a - b);
  const slots: TimeSlot[] = [];
  let start = sorted[0];
  let end = sorted[0] + 1;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === end) {
      end = sorted[i] + 1;
    } else {
      slots.push({ startTime: `${pad(start)}:00`, endTime: `${pad(end)}:00` });
      start = sorted[i];
      end = sorted[i] + 1;
    }
  }
  slots.push({ startTime: `${pad(start)}:00`, endTime: `${pad(end)}:00` });
  return slots;
}

function slotDuration(slot: TimeSlot): number {
  const [sh, sm] = slot.startTime.split(':').map(Number);
  const [eh, em] = slot.endTime.split(':').map(Number);
  return (eh * 60 + em) - (sh * 60 + sm);
}

// ─── Component ──────────────────────────────────────────────────────────────

const PublicAvailabilityPage: React.FC = () => {
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [anchorDate, setAnchorDate] = useState<Date>(getToday());
  const [missions, setMissions] = useState<any[]>([]);
  const [providers, setProviders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const fetchData = useCallback(async (startDate: string, endDate: string) => {
    setLoading(true);
    try {
      const [missionsRes, providersRes] = await Promise.all([
        supabase
          .from('missions')
          .select('date, start_time, end_time, provider_id')
          .gte('date', startDate)
          .lte('date', endDate)
          .neq('status', 'cancelled'),
        supabase
          .from('providers')
          .select('id, specialty, status, availability_mode, availability_hours, non_intervention_hours, non_intervention_days')
          .in('status', ['Active', 'Passive']),
      ]);
      if (missionsRes.error) throw missionsRes.error;
      if (providersRes.error) throw providersRes.error;
      setMissions((missionsRes.data || []) as any[]);
      setProviders((providersRes.data || []) as any[]);
    } catch (e) {
      console.error('[PublicAvailability] fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  const { rangeStart, rangeEnd } = useMemo(() => {
    if (viewMode === 'week') {
      const mon = getMonday(anchorDate);
      const sun = addDays(mon, 6);
      return { rangeStart: toDateStr(mon), rangeEnd: toDateStr(sun) };
    } else {
      const first = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1);
      const last = new Date(anchorDate.getFullYear(), anchorDate.getMonth() + 1, 0);
      const gridStart = addDays(first, -first.getDay());
      const gridEnd = addDays(last, 6 - last.getDay());
      return { rangeStart: toDateStr(gridStart), rangeEnd: toDateStr(gridEnd) };
    }
  }, [viewMode, anchorDate]);

  useEffect(() => {
    fetchData(rangeStart, rangeEnd);
  }, [rangeStart, rangeEnd, fetchData]);

  // Group providers by service domain
  const providersByDomain = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const svc of SERVICE_TYPES) map[svc] = [];
    for (const p of providers) {
      const domain = mapSpecialtyToDomain(p.specialty);
      if (map[domain]) map[domain].push(p);
    }
    return map;
  }, [providers]);

  // Build day availability map — segmented by service type
  const dayMap = useMemo(() => {
    const map = new Map<string, DayAvailability>();
    const today = getToday();
    const start = new Date(rangeStart);
    const end = new Date(rangeEnd);

    for (let d = new Date(start); d <= end; d = addDays(d, 1)) {
      const dateStr = toDateStr(d);
      const dayOfWeek = d.getDay();
      const isPast = d < today;
      const isSunday = dayOfWeek === 0;

      const dayData: DayAvailability = {
        date: dateStr,
        dayOfWeek,
        dayOfMonth: d.getDate(),
        month: d.getMonth(),
        year: d.getFullYear(),
        isToday: isSameDay(d, today),
        isPast,
        isSunday,
        availableServices: [],
      };

      if (!isPast && !isSunday) {
        for (const svcType of SERVICE_TYPES) {
          const domainProviders = providersByDomain[svcType] || [];
          if (domainProviders.length === 0) continue;

          const allFreeHours = new Set<number>();
          for (const provider of domainProviders) {
            const providerMissions = missions.filter(
              m => m.provider_id === provider.id && m.date === dateStr
            );
            const freeHours = getHourSlots(provider, dayOfWeek, providerMissions);
            freeHours.forEach(h => allFreeHours.add(h));
          }

          const freeSlots = mergeHoursToSlots(Array.from(allFreeHours));
          if (freeSlots.length > 0) {
            dayData.availableServices.push({
              serviceType: svcType,
              freeSlots,
              totalProviders: domainProviders.length,
            });
          }
        }
      }

      map.set(dateStr, dayData);
    }
    return map;
  }, [rangeStart, rangeEnd, missions, providersByDomain]);

  // ── Navigation ──
  const navigate = (dir: -1 | 1) => {
    if (viewMode === 'week') {
      setAnchorDate(addDays(anchorDate, dir * 7));
    } else {
      setAnchorDate(new Date(anchorDate.getFullYear(), anchorDate.getMonth() + dir, 1));
    }
  };

  const goToday = () => setAnchorDate(getToday());

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // ── Week view data ──
  const weekDays = useMemo(() => {
    const mon = getMonday(anchorDate);
    return Array.from({ length: 7 }, (_, i) => {
      const d = addDays(mon, i);
      return dayMap.get(toDateStr(d)) || null;
    }).filter(Boolean) as DayAvailability[];
  }, [anchorDate, dayMap]);

  // ── Month view data ──
  const monthGrid = useMemo(() => {
    const first = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1);
    const last = new Date(anchorDate.getFullYear(), anchorDate.getMonth() + 1, 0);
    const gridStart = addDays(first, -first.getDay());
    const gridEnd = addDays(last, 6 - last.getDay());
    const days: DayAvailability[] = [];
    for (let d = new Date(gridStart); d <= gridEnd; d = addDays(d, 1)) {
      const key = toDateStr(d);
      days.push(dayMap.get(key) || {
        date: key,
        dayOfWeek: d.getDay(),
        dayOfMonth: d.getDate(),
        month: d.getMonth(),
        year: d.getFullYear(),
        isToday: false,
        isPast: false,
        isSunday: d.getDay() === 0,
        availableServices: [],
      });
    }
    return days;
  }, [anchorDate, dayMap]);

  // Stats for hero banner
  const totalAvailableServicesWeek = weekDays.reduce(
    (s, d) => s + d.availableServices.length, 0
  );
  const totalFreeHoursWeek = weekDays.reduce(
    (s, d) => s + d.availableServices.reduce(
      (h, svc) => h + svc.freeSlots.reduce((t, sl) => t + slotDuration(sl), 0), 0
    ), 0
  );

  return (
    <div className="min-h-screen bg-cream-50 font-sans">
      {/* ── Header ── */}
      <header className="bg-white border-b border-slate-100 shadow-sm sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="https://anciens.prestaservicesantilles.com/images/logo.png"
              alt="Presta Services Antilles"
              className="h-16 md:h-20 w-auto object-contain"
            />
            <div>
              <h1 className="text-base md:text-xl font-bold text-slate-800 leading-tight">Presta Services Antilles</h1>
              <p className="text-xs md:text-sm text-slate-500 font-medium">Disponibilités — Créneaux Libres</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={copyLink}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-brand-blue/10 text-brand-blue text-sm font-bold hover:bg-brand-blue/20 transition-colors"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span className="hidden sm:inline">{copied ? 'Lien copié !' : 'Partager'}</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {/* ── Hero Banner ── */}
        <div className="bg-gradient-to-br from-brand-blue to-teal-700 rounded-2xl p-6 mb-6 text-white shadow-lg">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex-1">
              <h2 className="text-2xl font-bold mb-1">Nos créneaux disponibles</h2>
              <p className="text-white/80 text-sm">
                Consultez en temps réel les plages horaires libres par type de service pour planifier votre prochaine prestation.
              </p>
            </div>
            <div className="flex gap-4 text-center">
              <div className="bg-white/15 rounded-xl px-4 py-3 backdrop-blur-sm">
                <div className="text-2xl font-bold">{totalAvailableServicesWeek}</div>
                <div className="text-xs text-white/70">services dispo.</div>
              </div>
              <div className="bg-white/15 rounded-xl px-4 py-3 backdrop-blur-sm">
                <div className="text-2xl font-bold">{Math.round(totalFreeHoursWeek / 60 * 10) / 10}h</div>
                <div className="text-xs text-white/70">heures libres</div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Toolbar ── */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-3 mb-6 flex flex-col sm:flex-row items-center gap-3">
          <div className="flex items-center gap-2">
            <button onClick={() => navigate(-1)} className="p-2 rounded-xl hover:bg-slate-100 text-slate-600 transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button onClick={goToday} className="px-3 py-1.5 rounded-xl text-xs font-bold text-brand-blue bg-brand-blue/10 hover:bg-brand-blue/20 transition-colors">
              Aujourd'hui
            </button>
            <button onClick={() => navigate(1)} className="p-2 rounded-xl hover:bg-slate-100 text-slate-600 transition-colors">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-1 text-center font-bold text-slate-800">
            {viewMode === 'week'
              ? `Semaine du ${weekDays[0]?.dayOfMonth || '?'} ${MONTHS[weekDays[0]?.month || 0]?.slice(0, 3)} ${weekDays[0]?.year || ''}`
              : `${MONTHS[anchorDate.getMonth()]} ${anchorDate.getFullYear()}`
            }
          </div>
          <div className="flex bg-slate-100 rounded-xl p-1 gap-1">
            <button onClick={() => setViewMode('week')} className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${viewMode === 'week' ? 'bg-white text-brand-blue shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              Semaine
            </button>
            <button onClick={() => setViewMode('month')} className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${viewMode === 'month' ? 'bg-white text-brand-blue shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              Mois
            </button>
          </div>
        </div>

        {/* ── Loading ── */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="w-8 h-8 text-brand-blue animate-spin" />
            <p className="text-sm text-slate-500">Chargement des disponibilités...</p>
          </div>
        )}

        {/* ── Week View ── */}
        {!loading && viewMode === 'week' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3">
            {weekDays.map((day) => (
              <DayCard key={day.date} day={day} />
            ))}
          </div>
        )}

        {/* ── Month View ── */}
        {!loading && viewMode === 'month' && (
          <div>
            <div className="grid grid-cols-7 gap-1 mb-2">
              {WEEKDAYS_SHORT.map(d => (
                <div key={d} className="text-center text-xs font-bold text-slate-400 py-1">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {monthGrid.map((day) => {
                const isCurrentMonth = day.month === anchorDate.getMonth();
                const hasServices = day.availableServices.length > 0;
                return (
                  <div
                    key={day.date}
                    className={`rounded-xl p-2 min-h-[80px] transition-colors ${
                      !isCurrentMonth
                        ? 'bg-slate-50 opacity-40'
                        : day.isToday
                        ? 'bg-brand-blue/10 ring-2 ring-brand-blue/30'
                        : 'bg-white border border-slate-100'
                    }`}
                  >
                    <div className={`text-sm font-bold mb-1 ${
                      day.isToday ? 'text-brand-blue' : 'text-slate-700'
                    }`}>
                      {day.dayOfMonth}
                    </div>
                    {day.isPast || day.isSunday ? (
                      <span className="text-[10px] text-slate-400">
                        {day.isSunday ? 'Fermé' : ''}
                      </span>
                    ) : hasServices ? (
                      <div className="space-y-0.5">
                        <div className="text-[10px] font-bold text-green-600 flex items-center gap-0.5">
                          <CheckCircle2 className="w-3 h-3" />
                          {day.availableServices.length} service{day.availableServices.length > 1 ? 's' : ''}
                        </div>
                        {day.availableServices.slice(0, 3).map((svc) => {
                          const c = SERVICE_COLORS[svc.serviceType] || SERVICE_COLORS['Autre'];
                          return (
                            <div key={svc.serviceType} className={`text-[9px] ${c.bg} ${c.text} rounded px-1 py-0.5 font-semibold truncate`}>
                              {svc.serviceType}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-[10px] text-orange-500 flex items-center gap-0.5">
                        <XCircle className="w-3 h-3" /> Complet
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Legend ── */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-sm text-slate-500">
          {SERVICE_TYPES.map((svc) => {
            const c = SERVICE_COLORS[svc];
            return (
              <div key={svc} className="flex items-center gap-1.5">
                <span className={`w-3 h-3 rounded-full ${c.dot} inline-block`} />
                <span>{svc}</span>
              </div>
            );
          })}
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-slate-300 inline-block" />
            <span>Passé / Fermé</span>
          </div>
        </div>

        {/* ── Contact CTA ── */}
        <div className="mt-8 bg-white rounded-2xl shadow-sm border border-slate-100 p-6 text-center">
          <h3 className="text-lg font-bold text-slate-800 mb-2">Un créneau vous intéresse ?</h3>
          <p className="text-sm text-slate-500 mb-4">
            Contactez-nous pour réserver votre plage horaire ou obtenir plus d'informations.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <a href="tel:+596696000000" className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-blue text-white font-bold hover:bg-teal-700 transition-colors">
              <Phone className="w-4 h-4" /> Nous appeler
            </a>
            <a href="mailto:contact@prestaservicesantilles.com" className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-100 text-slate-700 font-bold hover:bg-slate-200 transition-colors">
              <Mail className="w-4 h-4" /> Nous écrire
            </a>
          </div>
        </div>

        {/* ── Footer ── */}
        <footer className="mt-8 text-center text-xs text-slate-400 pb-6">
          <p>© {new Date().getFullYear()} Presta Services Antilles — Tous droits réservés</p>
          <p className="mt-1">Horaires d'ouverture : {pad(OPEN_HOUR)}h00 — {pad(CLOSE_HOUR)}h00</p>
        </footer>
      </main>
    </div>
  );
};

// ── Day Card sub-component ──

const DayCard: React.FC<{ day: DayAvailability }> = ({ day }) => {
  const isClosed = day.isSunday;
  const hasServices = day.availableServices.length > 0 && !day.isPast && !isClosed;

  return (
    <div
      className={`rounded-2xl overflow-hidden shadow-sm border transition-all ${
        day.isToday
          ? 'border-brand-blue/40 ring-2 ring-brand-blue/20 bg-white'
          : day.isPast || isClosed
          ? 'border-slate-100 bg-slate-50'
          : hasServices
          ? 'border-green-200 bg-white hover:shadow-md'
          : 'border-orange-200 bg-white'
      }`}
    >
      {/* Day header */}
      <div
        className={`px-3 py-2.5 text-center ${
          day.isToday
            ? 'bg-brand-blue text-white'
            : day.isPast || isClosed
            ? 'bg-slate-100 text-slate-400'
            : hasServices
            ? 'bg-green-50 text-green-800'
            : 'bg-orange-50 text-orange-800'
        }`}
      >
        <div className="text-[11px] font-bold uppercase tracking-wide">
          {WEEKDAYS_SHORT[day.dayOfWeek]}
        </div>
        <div className="text-xl font-bold">{day.dayOfMonth}</div>
      </div>

      {/* Body */}
      <div className="p-3 space-y-2">
        {day.isPast ? (
          <div className="text-xs text-slate-400 text-center py-3">Passé</div>
        ) : isClosed ? (
          <div className="text-xs text-slate-400 text-center py-3 flex flex-col items-center gap-1">
            <XCircle className="w-4 h-4" />
            <span>Fermé</span>
          </div>
        ) : hasServices ? (
          day.availableServices.map((svc) => {
            const c = SERVICE_COLORS[svc.serviceType] || SERVICE_COLORS['Autre'];
            return (
              <div key={svc.serviceType} className={`rounded-lg border ${c.border} ${c.bg} px-2.5 py-2`}>
                <div className={`text-[11px] font-bold ${c.text} flex items-center gap-1.5 mb-1`}>
                  <span className={`w-2 h-2 rounded-full ${c.dot} inline-block`} />
                  {svc.serviceType}
                  <span className="text-[9px] text-slate-400 font-normal ml-auto">{svc.totalProviders} prest.</span>
                </div>
                <div className="space-y-0.5">
                  {svc.freeSlots.map((slot, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      <CheckCircle2 className={`w-3 h-3 ${c.text} flex-shrink-0`} />
                      <span className={`text-[11px] font-bold ${c.text}`}>
                        {slot.startTime} — {slot.endTime}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })
        ) : (
          <div className="text-xs text-orange-500 text-center py-3 flex flex-col items-center gap-1">
            <XCircle className="w-4 h-4" />
            <span className="font-bold">Complet</span>
            <span className="text-orange-400 text-[10px]">Aucun créneau libre</span>
          </div>
        )}
      </div>

      {/* Footer stats */}
      {!day.isPast && !isClosed && (
        <div className="px-3 py-2 border-t border-slate-50 text-center">
          <span className={`text-[10px] font-bold ${hasServices ? 'text-green-600' : 'text-orange-500'}`}>
            {hasServices
              ? `${day.availableServices.length} service${day.availableServices.length > 1 ? 's' : ''} disponible${day.availableServices.length > 1 ? 's' : ''}`
              : 'Aucun service disponible'
            }
          </span>
        </div>
      )}
    </div>
  );
};

export default PublicAvailabilityPage;
