import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
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
import {
  computeAvailabilitySlots,
  groupSlotsByTime,
  getProvisionalMissionsFromDocuments,
  mapSpecialtyToDomain,
  isMenageSpecialty,
  AVAILABILITY_OPEN_HOUR,
  AVAILABILITY_CLOSE_HOUR,
  MissionLike,
  GroupedSlot,
} from '../utils/availabilityCalculator';
import { getHolidayName } from '../utils/holidays';
import { Star } from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────

type ServiceAvailability = {
  serviceType: string;
  groupedSlots: GroupedSlot[];
  totalProviders: number;
  maxFreeProviderCount: number;
};

type DayAvailability = {
  date: string;
  dayOfWeek: number;
  dayOfMonth: number;
  month: number;
  year: number;
  isToday: boolean;
  isPast: boolean;
  isHoliday?: boolean;
  holidayName?: string | null;
  availableServices: ServiceAvailability[];
};

type ViewMode = 'week' | 'month';

// ─── Helpers ────────────────────────────────────────────────────────────────

const WEEKDAYS_SHORT = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
const MONTHS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

const OPEN_HOUR = AVAILABILITY_OPEN_HOUR;
const CLOSE_HOUR = AVAILABILITY_CLOSE_HOUR;
const SERVICE_TYPES = ['Ménage'] as const;

const SERVICE_COLORS: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  'Ménage':    { bg: 'bg-blue-50',    border: 'border-blue-200',    text: 'text-blue-700',    dot: 'bg-blue-500' },
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

// ─── (helpers locaux supprimés, logique centralisée dans availabilityCalculator.ts) ───

// Helper pour récupérer les noms des prestataires à partir de leurs IDs (sans doublons)
const getProviderNamesFromIds = (ids: string[], providersList: any[]): string[] => {
  const uniqueIds = [...new Set(ids.map(String))]; // Dédupliquer les IDs
  return uniqueIds
    .map(id => {
      const p = providersList.find(pr => String(pr.id) === String(id));
      if (!p) return null;
      const name = `${p.firstName || p.first_name || ''} ${p.lastName || p.last_name || ''}`.trim();
      return name || 'Prestataire';
    })
    .filter((n): n is string => n !== null);
};

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
      const [missionsRes, providersRes, documentsRes, leavesRes] = await Promise.all([
        supabase
          .from('missions')
          .select('date, start_time, end_time, provider_id, status')
          .gte('date', startDate)
          .lte('date', endDate)
          .neq('status', 'cancelled'),
        supabase
          .from('providers')
          .select('id, first_name, last_name, specialty, status, availability_mode, availability_hours, non_intervention_hours, non_intervention_days'),
        supabase
          .from('documents')
          .select('id, type, status, slots_data, created_at, client_id, client_name')
          .eq('type', 'Devis')
          .eq('status', 'sent'),
        supabase
          .from('leaves')
          .select('id, provider_id, start_date, end_date, start_time, end_time, status')
          .eq('status', 'approved'),
      ]);
      if (missionsRes.error) throw missionsRes.error;
      if (providersRes.error) throw providersRes.error;
      if (documentsRes.error) throw documentsRes.error;
      // leavesRes.error est ignoré car la table peut ne pas exister
      const m = (missionsRes.data || []) as any[];
      // Filtrer côté client les providers actifs (compatible FR + EN)
      const allProvidersRaw = (providersRes.data || []) as any[];
      const leavesData = (leavesRes.data || []) as any[];

      // Dédupliquer les providers par ID (au cas où la table aurait des doublons)
      const allProviders = allProvidersRaw.filter((prov, index, self) => 
        index === self.findIndex((p) => String(p.id) === String(prov.id))
      );

      console.log('[PublicAvailability] Providers:', allProvidersRaw.length, 'total,', allProviders.length, 'après déduplication');

      // Attacher les leaves aux providers correspondants
      const p = allProviders
        .filter((prov: any) => {
          const s = String(prov.status || '').toLowerCase().trim();
          return s === 'active' || s === 'actif' || s === 'passive' || s === 'passif';
        })
        .map((prov: any) => ({
          ...prov,
          // Mapper les noms snake_case vers camelCase
          firstName: prov.first_name || prov.firstName,
          lastName: prov.last_name || prov.lastName,
          availabilityMode: prov.availability_mode || 'unavailable',
          availabilityHours: prov.availability_hours || {},
          nonInterventionHours: prov.non_intervention_hours || {},
          nonInterventionDays: prov.non_intervention_days || [],
          leaves: leavesData
            .filter((l: any) => l.provider_id === prov.id)
            .map((l: any) => ({
              startDate: l.start_date,
              endDate: l.end_date,
              startTime: l.start_time,
              endTime: l.end_time,
              status: l.status,
            })),
        }));

      // Construire les missions provisoires depuis les devis envoyés (non expirés)
      // pour bloquer les créneaux déjà réservés par des devis en attente de signature
      const docs = (documentsRes.data || []).map((d: any) => {
        // Calculer la date d'expiration à partir de created_at + 48h
        let expirationDate = null;
        if (d.created_at) {
          const createdAtMs = new Date(d.created_at).getTime();
          if (Number.isFinite(createdAtMs)) {
            expirationDate = new Date(createdAtMs + 48 * 60 * 60 * 1000).toISOString();
          }
        }
        return {
          ...d,
          slotsData: d.slots_data,
          expirationDate,
          clientId: d.client_id,
          clientName: d.client_name,
        };
      });
      const provisionalMissions = getProvisionalMissionsFromDocuments(docs);

      // Combiner missions réelles + missions provisoires pour le calcul
      const allMissions: MissionLike[] = [
        ...m,
        ...provisionalMissions,
      ];

      console.log('[PublicAvailability] Fetched:', allProviders.length, 'total providers (après dédup),', p.length, 'active,', m.length, 'missions,', provisionalMissions.length, 'provisional from devis,', leavesData.length, 'approved leaves');
      console.log('[PublicAvailability] Provider IDs:', p.map((pr: any) => pr.id).join(', '));
      p.forEach((prov: any) => console.log(`  Provider: ${prov.id} | ${prov.firstName} ${prov.lastName} | status=${prov.status} | specialty=${prov.specialty} | domain=${mapSpecialtyToDomain(prov.specialty)} | leaves=${prov.leaves?.length || 0} | nonInterventionDays=${JSON.stringify(prov.nonInterventionDays)}`));
      setMissions(allMissions);
      setProviders(p);
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

  // Group providers by service domain — seul "Ménage" : uniquement les prestataires Ménage / Entretien
  const providersByDomain = useMemo(() => {
    const map: Record<string, any[]> = { 'Ménage': [] };
    for (const p of providers) {
      // Filtrer strictement par spécialité Ménage (exclure jardinage, bricolage, etc.)
      if (!isMenageSpecialty(p.specialty || '')) continue;
      map['Ménage'].push(p);
    }
    return map;
  }, [providers]);

  // Build day availability map — segmented by service type (granularité 30 min)
  const dayMap = useMemo(() => {
    const map = new Map<string, DayAvailability>();
    const today = getToday();
    const start = new Date(rangeStart);
    const end = new Date(rangeEnd);

    for (let d = new Date(start); d <= end; d = addDays(d, 1)) {
      const dateStr = toDateStr(d);
      const dayOfWeek = d.getDay();
      const isPast = d < today;
      const holidayName = getHolidayName(dateStr);

      const dayData: DayAvailability = {
        date: dateStr,
        dayOfWeek,
        dayOfMonth: d.getDate(),
        month: d.getMonth(),
        year: d.getFullYear(),
        isToday: isSameDay(d, today),
        isPast,
        isHoliday: !!holidayName,
        holidayName,
        availableServices: [],
      };

      if (!isPast) {
        for (const svcType of SERVICE_TYPES) {
          const domainProviders = providersByDomain[svcType] || [];
          if (domainProviders.length === 0) continue;

          // Calcul centralisé : créneaux cumulatifs avec nombre de prestataires
          // Pas de filtre par spécialité : tous les prestataires sont sous "Ménage"
          const enrichedSlots = computeAvailabilitySlots(dateStr, domainProviders, missions);
          const groupedSlots = groupSlotsByTime(enrichedSlots);

          // Compter les prestataires RÉELLEMENT libres ce jour-là (dédupliqués par ID)
          const freeProviderIds = new Set(enrichedSlots.flatMap(s => s.providerIds));
          const actualFreeCount = freeProviderIds.size;

          if (groupedSlots.length > 0) {
            const maxFreeProviderCount = Math.max(...groupedSlots.map(g => g.maxProviderCount));
            dayData.availableServices.push({
              serviceType: svcType,
              groupedSlots,
              totalProviders: actualFreeCount,
              maxFreeProviderCount,
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
        availableServices: [],
      });
    }
    return days;
  }, [anchorDate, dayMap]);

  // Stats for hero banner — dédupliquées par prestataire (ID unique) et par type de service
  const heroStats = useMemo(() => {
    const byService: Record<string, { providerIds: Set<string>; daysCount: number }> = {};
    for (const svc of SERVICE_TYPES) {
      byService[svc] = { providerIds: new Set(), daysCount: 0 };
    }
    for (const d of weekDays) {
      for (const svc of d.availableServices) {
        // Collecter les IDs uniques de prestataires libres via les créneaux
        for (const slot of svc.groupedSlots) {
          // Récupérer les IDs pour la durée max
          const maxDur = [...slot.durations].sort((a, b) => b - a)[0];
          if (maxDur) {
            const ids = slot.providersByDuration[maxDur]?.ids || [];
            ids.forEach(id => byService[svc.serviceType]?.providerIds.add(String(id)));
          }
        }
        byService[svc.serviceType].daysCount++;
      }
    }
    return byService;
  }, [weekDays]);

  const totalAvailableServicesWeek = weekDays.reduce(
    (s, d) => s + d.availableServices.length, 0
  );
  const totalUniqueProvidersWeek = (() => {
    const allIds = new Set<string>();
    for (const svc of SERVICE_TYPES) {
      heroStats[svc]?.providerIds.forEach(id => allIds.add(id));
    }
    return allIds.size;
  })();

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
                <div className="text-2xl font-bold">{totalUniqueProvidersWeek}</div>
                <div className="text-xs text-white/70">prestataires libres</div>
              </div>
            </div>
            {/* Compteurs par type de service */}
            <div className="flex flex-wrap gap-3 mt-3">
              {SERVICE_TYPES.map(svcType => {
                const stats = heroStats[svcType];
                const count = stats?.providerIds.size || 0;
                if (count === 0) return null;
                const c = SERVICE_COLORS[svcType] || SERVICE_COLORS['Autre'];
                return (
                  <div key={svcType} className={`${c.bg} ${c.text} rounded-lg px-3 py-1.5 text-xs font-bold flex items-center gap-1.5 border ${c.border}`}>
                    <span className={`w-2 h-2 rounded-full ${c.dot} inline-block`} />
                    {svcType} : {count} prestataire{count > 1 ? 's' : ''}
                  </div>
                );
              })}
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
              <DayCard key={day.date} day={day} providers={providers} />
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
                        : day.isHoliday
                        ? 'bg-purple-50 border border-purple-200'
                        : day.isToday
                        ? 'bg-brand-blue/10 ring-2 ring-brand-blue/30'
                        : 'bg-white border border-slate-100'
                    }`}
                  >
                    <div className={`text-sm font-bold mb-1 ${
                      day.isHoliday ? 'text-purple-600' : day.isToday ? 'text-brand-blue' : 'text-slate-700'
                    }`}>
                      {day.dayOfMonth}
                    </div>
                    {day.isHoliday ? (
                      <div className="text-[9px] text-purple-600 font-bold flex items-center gap-0.5">
                        <Star className="w-2.5 h-2.5" /> Férié
                      </div>
                    ) : day.isPast ? (
                      <span className="text-[10px] text-slate-400"></span>
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
                        <XCircle className="w-3 h-3" /> Saturé
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
            <span>Passé</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-orange-400 inline-block" />
            <span>Saturé</span>
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
          <p className="mt-1">Horaires d'ouverture : {pad(OPEN_HOUR)}h00 — {pad(CLOSE_HOUR)}h00 | 7j/7</p>
        </footer>
      </main>
    </div>
  );
};

// ── Day Card sub-component ──

const DayCard: React.FC<{ day: DayAvailability; providers?: any[] }> = ({ day, providers = [] }) => {
  const [showModal, setShowModal] = useState(false);
  const hasServices = day.availableServices.length > 0 && !day.isPast;
  const totalSlots = day.availableServices.reduce((s, svc) => s + svc.groupedSlots.length, 0);
  const totalProviders = day.availableServices.reduce((s, svc) => s + svc.totalProviders, 0);

  return (
    <>
      <div
        className={`rounded-2xl overflow-hidden shadow-sm border transition-all ${
          day.isHoliday
            ? 'border-purple-200 bg-purple-50'
            : day.isToday
            ? 'border-brand-blue/40 ring-2 ring-brand-blue/20 bg-white'
            : day.isPast
            ? 'border-slate-100 bg-slate-50'
            : hasServices
            ? 'border-green-200 bg-white hover:shadow-md cursor-pointer'
            : 'border-orange-200 bg-white'
        }`}
        onClick={() => hasServices && !day.isHoliday && setShowModal(true)}
      >
        {/* Day header */}
        <div
          className={`px-3 py-2.5 text-center ${
            day.isHoliday
              ? 'bg-purple-500 text-white'
              : day.isToday
              ? 'bg-brand-blue text-white'
              : day.isPast
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
          {day.isHoliday && <div className="text-[9px] font-bold uppercase tracking-wider">Férié</div>}
        </div>

        {/* Body */}
        <div className="px-3 py-3">
          {day.isHoliday ? (
            <div className="text-xs text-purple-600 text-center py-2 flex flex-col items-center gap-1">
              <Star className="w-4 h-4" />
              <span className="font-bold">{day.holidayName || 'Jour férié'}</span>
              <span className="text-[10px] text-purple-400">Aucune réservation</span>
            </div>
          ) : day.isPast ? (
            <div className="text-xs text-slate-400 text-center py-2">Passé</div>
          ) : hasServices ? (
            <div className="flex flex-col items-center gap-2">
              <div className="text-2xl font-bold text-green-600">{totalSlots}</div>
              <div className="text-[10px] text-slate-500 text-center">
                créneau{totalSlots > 1 ? 'x' : ''} disponible{totalSlots > 1 ? 's' : ''}
              </div>
              {/* Compteur par type de service */}
              <div className="flex flex-col gap-0.5 w-full">
                {day.availableServices.map((svc) => {
                  const c = SERVICE_COLORS[svc.serviceType] || SERVICE_COLORS['Autre'];
                  return (
                    <div key={svc.serviceType} className={`text-[9px] ${c.bg} ${c.text} rounded px-1.5 py-0.5 font-semibold text-center`}>
                      {svc.serviceType} : {svc.totalProviders} libre{svc.totalProviders > 1 ? 's' : ''}
                    </div>
                  );
                })}
              </div>
              <button className="mt-1 flex items-center gap-1 text-[11px] font-bold text-green-600 hover:text-green-800 transition">
                Voir les horaires
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="text-xs text-orange-500 text-center py-2 flex flex-col items-center gap-1">
              <XCircle className="w-4 h-4" />
              <span className="font-bold">Saturé</span>
            </div>
          )}
        </div>
      </div>

      {/* Modal with detailed slots */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-brand-blue to-teal-700 px-6 py-4 text-white flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold">{WEEKDAYS_SHORT[day.dayOfWeek]} {day.dayOfMonth}</h3>
                <p className="text-sm text-white/80">{totalSlots} créneau{totalSlots > 1 ? 'x' : ''} • {day.availableServices.length} service{day.availableServices.length > 1 ? 's' : ''}</p>
              </div>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-white/20 rounded-lg transition">
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-3 overflow-y-auto max-h-[60vh]">
              {day.availableServices.map((svc) => {
                const c = SERVICE_COLORS[svc.serviceType] || SERVICE_COLORS['Autre'];
                return (
                  <div key={svc.serviceType} className={`rounded-lg border ${c.border} ${c.bg} px-3 py-2.5`}>
                    <div className={`text-sm font-bold ${c.text} flex items-center gap-1.5 mb-2`}>
                      <span className={`w-2.5 h-2.5 rounded-full ${c.dot} inline-block`} />
                      {svc.serviceType}
                      <span className="text-[10px] text-slate-400 font-normal ml-auto">
                        {svc.totalProviders} prestataire{svc.totalProviders > 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {svc.groupedSlots.map((slot, i) => {
                        const durationHours = [...slot.durations].sort((a, b) => b - a);
                        const bestCount = slot.maxProviderCount;
                        return (
                          <div key={i} className="bg-white/80 rounded-lg p-2.5 border border-slate-100">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-1.5">
                                <Clock className={`w-4 h-4 ${c.text}`} />
                                <span className={`text-sm font-bold ${c.text}`}>
                                  {slot.startTime} — {slot.endTime}
                                </span>
                              </div>
                              <span className={`text-xs font-bold ${bestCount >= 2 ? 'text-green-600' : 'text-blue-600'}`}>
                                {bestCount} libre{bestCount > 1 ? 's' : ''}
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {durationHours.map(dur => {
                                const info = slot.providersByDuration[dur];
                                const count = info?.count || 0;
                                const providerNames = count > 0 && info?.ids ? getProviderNamesFromIds(info.ids, providers) : [];
                                return (
                                  <span
                                    key={dur}
                                    className={`px-2.5 py-1 rounded text-xs font-bold ${
                                      count > 0
                                        ? `${c.bg} ${c.text} border ${c.border}`
                                        : 'bg-slate-100 text-slate-300 border border-slate-100'
                                    }`}
                                    title={count > 0 ? `${count} prestataire${count > 1 ? 's' : ''} libre${count > 1 ? 's' : ''} pour ${dur}h` : 'Aucun prestataire libre'}
                                  >
                                    Pack {dur}h {count > 0 && <span className="text-[10px] opacity-70">({count})</span>}
                                  </span>
                                );
                              })}
                            </div>
                            {/* Afficher les noms des prestataires pour la durée max */}
                            {(() => {
                              const maxDur = durationHours.find(d => (slot.providersByDuration[d]?.count || 0) > 0);
                              if (maxDur) {
                                const info = slot.providersByDuration[maxDur];
                                const names = info?.ids ? getProviderNamesFromIds(info.ids, providers) : [];
                                if (names.length > 0) {
                                  return (
                                    <div className="mt-1.5 text-[10px] text-gray-600 border-t border-slate-100 pt-1.5">
                                      <span className="font-bold text-gray-700">{names.length} libre{names.length > 1 ? 's' : ''} :</span> {names.join(', ')}
                                    </div>
                                  );
                                }
                              }
                              return null;
                            })()}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default PublicAvailabilityPage;
