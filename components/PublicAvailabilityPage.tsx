import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  Share2,
  Copy,
  Check,
  Phone,
  Mail,
  ArrowLeft,
} from 'lucide-react';
import { supabase } from '../utils/supabaseClient';

// ─── Types ──────────────────────────────────────────────────────────────────

type TimeSlot = { startTime: string; endTime: string };

type DayAvailability = {
  date: string; // YYYY-MM-DD
  dayOfWeek: number; // 0=Dim
  dayOfMonth: number;
  month: number;
  year: number;
  isToday: boolean;
  isPast: boolean;
  isSunday: boolean;
  freeSlots: TimeSlot[];
  busyCount: number;
};

type ViewMode = 'week' | 'month';

// ─── Helpers ────────────────────────────────────────────────────────────────

const WEEKDAYS_SHORT = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
const WEEKDAYS_FULL = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const MONTHS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

const OPEN_HOUR = 8;  // 08:00
const CLOSE_HOUR = 18; // 18:00
const SLOT_STEP_MIN = 30;

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
  const diff = day === 0 ? -6 : 1 - day; // Monday start
  r.setDate(r.getDate() + diff);
  return r;
};

const getToday = (): Date => {
  const now = new Date();
  // Use Martinique time (UTC-4)
  const utc = new Date(now.getTime() + now.getTimezoneOffset() * 60000);
  const mtq = new Date(utc.getTime() - 4 * 3600000);
  return new Date(mtq.getFullYear(), mtq.getMonth(), mtq.getDate());
};

/**
 * Given occupied intervals in a day, return free slots between OPEN_HOUR and CLOSE_HOUR
 */
function computeFreeSlots(occupied: TimeSlot[]): TimeSlot[] {
  // Convert all times to minutes from midnight
  const toMin = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };
  const toStr = (m: number) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;

  const openMin = OPEN_HOUR * 60;
  const closeMin = CLOSE_HOUR * 60;

  // Sort occupied slots by start time
  const sorted = [...occupied]
    .map(s => ({ start: toMin(s.startTime), end: toMin(s.endTime) }))
    .filter(s => s.end > openMin && s.start < closeMin)
    .sort((a, b) => a.start - b.start);

  // Merge overlapping
  const merged: { start: number; end: number }[] = [];
  for (const s of sorted) {
    if (merged.length > 0 && s.start <= merged[merged.length - 1].end) {
      merged[merged.length - 1].end = Math.max(merged[merged.length - 1].end, s.end);
    } else {
      merged.push({ ...s });
    }
  }

  // Compute gaps
  const free: TimeSlot[] = [];
  let cursor = openMin;
  for (const s of merged) {
    const gapStart = Math.max(cursor, openMin);
    const gapEnd = Math.min(s.start, closeMin);
    if (gapEnd - gapStart >= SLOT_STEP_MIN) {
      free.push({ startTime: toStr(gapStart), endTime: toStr(gapEnd) });
    }
    cursor = Math.max(cursor, s.end);
  }
  if (closeMin - cursor >= SLOT_STEP_MIN) {
    free.push({ startTime: toStr(cursor), endTime: toStr(closeMin) });
  }

  return free;
}

function formatSlot(slot: TimeSlot): string {
  return `${slot.startTime} — ${slot.endTime}`;
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
  const [missions, setMissions] = useState<{ date: string; start_time: string; end_time: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  // ── Fetch missions from Supabase ──
  const fetchMissions = useCallback(async (startDate: string, endDate: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('missions')
        .select('date, start_time, end_time')
        .gte('date', startDate)
        .lte('date', endDate)
        .neq('status', 'cancelled');
      if (error) throw error;
      setMissions((data || []) as any[]);
    } catch (e) {
      console.error('[PublicAvailability] fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Compute visible range and fetch ──
  const { rangeStart, rangeEnd } = useMemo(() => {
    if (viewMode === 'week') {
      const mon = getMonday(anchorDate);
      const sun = addDays(mon, 6);
      return { rangeStart: toDateStr(mon), rangeEnd: toDateStr(sun) };
    } else {
      const first = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1);
      const last = new Date(anchorDate.getFullYear(), anchorDate.getMonth() + 1, 0);
      // Extend to fill calendar grid
      const gridStart = addDays(first, -first.getDay());
      const gridEnd = addDays(last, 6 - last.getDay());
      return { rangeStart: toDateStr(gridStart), rangeEnd: toDateStr(gridEnd) };
    }
  }, [viewMode, anchorDate]);

  useEffect(() => {
    fetchMissions(rangeStart, rangeEnd);
  }, [rangeStart, rangeEnd, fetchMissions]);

  // ── Build day availability map ──
  const dayMap = useMemo(() => {
    const map = new Map<string, DayAvailability>();
    const today = getToday();
    const start = new Date(rangeStart);
    const end = new Date(rangeEnd);

    for (let d = new Date(start); d <= end; d = addDays(d, 1)) {
      const dateStr = toDateStr(d);
      const occupied = missions
        .filter(m => m.date === dateStr)
        .map(m => ({ startTime: m.start_time, endTime: m.end_time }));

      const isPast = d < today;
      const isSunday = d.getDay() === 0;

      map.set(dateStr, {
        date: dateStr,
        dayOfWeek: d.getDay(),
        dayOfMonth: d.getDate(),
        month: d.getMonth(),
        year: d.getFullYear(),
        isToday: isSameDay(d, today),
        isPast,
        isSunday,
        freeSlots: isPast || isSunday ? [] : computeFreeSlots(occupied),
        busyCount: occupied.length,
      });
    }
    return map;
  }, [rangeStart, rangeEnd, missions]);

  // ── Navigation ──
  const navigate = (dir: -1 | 1) => {
    if (viewMode === 'week') {
      setAnchorDate(addDays(anchorDate, dir * 7));
    } else {
      setAnchorDate(new Date(anchorDate.getFullYear(), anchorDate.getMonth() + dir, 1));
    }
  };

  const goToday = () => setAnchorDate(getToday());

  // ── Copy link ──
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
        freeSlots: [],
        busyCount: 0,
      });
    }
    return days;
  }, [anchorDate, dayMap]);

  const totalFreeSlotsWeek = weekDays.reduce((s, d) => s + d.freeSlots.length, 0);
  const totalFreeHoursWeek = weekDays.reduce(
    (s, d) => s + d.freeSlots.reduce((h, sl) => h + slotDuration(sl), 0), 0
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
              className="h-10 w-auto object-contain"
            />
            <div className="hidden sm:block">
              <h1 className="text-lg font-bold text-slate-800">Disponibilités</h1>
              <p className="text-xs text-slate-500">Créneaux libres — Martinique</p>
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
                Consultez en temps réel les plages horaires libres pour planifier votre prochaine prestation.
              </p>
            </div>
            <div className="flex gap-4 text-center">
              <div className="bg-white/15 rounded-xl px-4 py-3 backdrop-blur-sm">
                <div className="text-2xl font-bold">{totalFreeSlotsWeek}</div>
                <div className="text-xs text-white/70">créneaux cette semaine</div>
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
          {/* Navigation */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate(-1)}
              className="p-2 rounded-xl hover:bg-slate-100 text-slate-600 transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={goToday}
              className="px-3 py-1.5 rounded-xl text-xs font-bold text-brand-blue bg-brand-blue/10 hover:bg-brand-blue/20 transition-colors"
            >
              Aujourd'hui
            </button>
            <button
              onClick={() => navigate(1)}
              className="p-2 rounded-xl hover:bg-slate-100 text-slate-600 transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Title */}
          <div className="flex-1 text-center font-bold text-slate-800">
            {viewMode === 'week'
              ? `Semaine du ${weekDays[0]?.dayOfMonth || '?'} ${MONTHS[weekDays[0]?.month || 0]?.slice(0, 3)} ${weekDays[0]?.year || ''}`
              : `${MONTHS[anchorDate.getMonth()]} ${anchorDate.getFullYear()}`
            }
          </div>

          {/* View toggle */}
          <div className="flex bg-slate-100 rounded-xl p-1 gap-1">
            <button
              onClick={() => setViewMode('week')}
              className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${
                viewMode === 'week' ? 'bg-white text-brand-blue shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Semaine
            </button>
            <button
              onClick={() => setViewMode('month')}
              className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${
                viewMode === 'month' ? 'bg-white text-brand-blue shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
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
              <DayCard key={day.date} day={day} compact={false} />
            ))}
          </div>
        )}

        {/* ── Month View ── */}
        {!loading && viewMode === 'month' && (
          <div>
            {/* Weekday headers */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {WEEKDAYS_SHORT.map(d => (
                <div key={d} className="text-center text-xs font-bold text-slate-400 py-1">{d}</div>
              ))}
            </div>
            {/* Day grid */}
            <div className="grid grid-cols-7 gap-1">
              {monthGrid.map((day) => {
                const isCurrentMonth = day.month === anchorDate.getMonth();
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
                    ) : day.freeSlots.length > 0 ? (
                      <div className="space-y-0.5">
                        <div className="text-[10px] font-bold text-green-600 flex items-center gap-0.5">
                          <CheckCircle2 className="w-3 h-3" /> {day.freeSlots.length} créneau{day.freeSlots.length > 1 ? 'x' : ''}
                        </div>
                        {day.freeSlots.slice(0, 2).map((sl, i) => (
                          <div key={i} className="text-[9px] text-green-700 bg-green-50 rounded px-1 py-0.5 truncate">
                            {sl.startTime}–{sl.endTime}
                          </div>
                        ))}
                        {day.freeSlots.length > 2 && (
                          <div className="text-[9px] text-slate-400">+{day.freeSlots.length - 2} autres</div>
                        )}
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
        <div className="mt-6 flex flex-wrap items-center justify-center gap-6 text-sm text-slate-500">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-green-500 inline-block" />
            <span>Disponible</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-orange-400 inline-block" />
            <span>Complet</span>
          </div>
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
            <a
              href="tel:+596696000000"
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-blue text-white font-bold hover:bg-teal-700 transition-colors"
            >
              <Phone className="w-4 h-4" /> Nous appeler
            </a>
            <a
              href="mailto:contact@prestaservicesantilles.com"
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-100 text-slate-700 font-bold hover:bg-slate-200 transition-colors"
            >
              <Mail className="w-4 h-4" /> Nous écrire
            </a>
          </div>
        </div>

        {/* ── Footer ── */}
        <footer className="mt-8 text-center text-xs text-slate-400 pb-6">
          <p>© {new Date().getFullYear()} Presta Services Antilles — Tous droits réservés</p>
          <p className="mt-1">Horaires d'ouverture : {pad(OPEN_HOUR)}h00 — {pad(CLOSE_HOUR)}h00 | Fermé le dimanche</p>
        </footer>
      </main>
    </div>
  );
};

// ── Day Card sub-component ──

const DayCard: React.FC<{ day: DayAvailability; compact?: boolean }> = ({ day, compact }) => {
  const isClosed = day.isSunday;
  const hasSlots = day.freeSlots.length > 0 && !day.isPast && !isClosed;

  return (
    <div
      className={`rounded-2xl overflow-hidden shadow-sm border transition-all ${
        day.isToday
          ? 'border-brand-blue/40 ring-2 ring-brand-blue/20 bg-white'
          : day.isPast || isClosed
          ? 'border-slate-100 bg-slate-50'
          : hasSlots
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
            : hasSlots
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
      <div className="p-3 space-y-1.5">
        {day.isPast ? (
          <div className="text-xs text-slate-400 text-center py-3">Passé</div>
        ) : isClosed ? (
          <div className="text-xs text-slate-400 text-center py-3 flex flex-col items-center gap-1">
            <XCircle className="w-4 h-4" />
            <span>Fermé</span>
          </div>
        ) : hasSlots ? (
          day.freeSlots.map((slot, i) => (
            <div
              key={i}
              className="flex items-center gap-2 bg-green-50 border border-green-100 rounded-lg px-2.5 py-1.5"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
              <span className="text-xs font-bold text-green-700">{formatSlot(slot)}</span>
            </div>
          ))
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
          <span className={`text-[10px] font-bold ${hasSlots ? 'text-green-600' : 'text-orange-500'}`}>
            {hasSlots
              ? `${day.freeSlots.length} créneau${day.freeSlots.length > 1 ? 'x' : ''} libre${day.freeSlots.length > 1 ? 's' : ''}`
              : 'Aucun créneau'
            }
          </span>
        </div>
      )}
    </div>
  );
};

export default PublicAvailabilityPage;
