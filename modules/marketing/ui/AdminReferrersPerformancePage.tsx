import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Search, Filter, Users, Gift, MoreVertical, Ban, CheckCircle, Copy } from 'lucide-react';
import { adminListReferrersPerformance, adminSetReferrerStatus } from '../client';
import type { MktAdminReferrerPerformanceRow } from '../client';
import { supabase, isSupabaseConfigured } from '../../../utils/supabaseClient';

const AdminReferrersPerformancePage: React.FC = () => {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<MktAdminReferrerPerformanceRow[]>([]);

  const [openActionsId, setOpenActionsId] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [onlyLambda, setOnlyLambda] = useState<boolean | null>(null);
  const [status, setStatus] = useState<string>('');
  const [minFilleuls, setMinFilleuls] = useState<string>('');
  const [minPointsEarned, setMinPointsEarned] = useState<string>('');

  const filters = useMemo(() => {
    const mf = String(minFilleuls || '').trim();
    const mp = String(minPointsEarned || '').trim();
    return {
      search: String(search || '').trim() || undefined,
      is_lambda: typeof onlyLambda === 'boolean' ? onlyLambda : undefined,
      status: String(status || '').trim() || undefined,
      min_filleuls: mf ? Number(mf) : undefined,
      min_points_earned: mp ? Number(mp) : undefined,
    };
  }, [search, onlyLambda, status, minFilleuls, minPointsEarned]);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await adminListReferrersPerformance(filters);
      setItems(rows || []);
    } catch {
      setError("Impossible de charger la liste des parrains.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onClick = () => setOpenActionsId(null);
    window.addEventListener('click', onClick);
    return () => window.removeEventListener('click', onClick);
  }, []);

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(String(text || ''));
    } catch {
      // ignore
    }
  };

  const doSetStatus = async (referrerId: string, nextStatus: 'active' | 'blocked') => {
    const rid = String(referrerId || '').trim();
    if (!rid) return;

    let reason: string | undefined;
    if (nextStatus === 'blocked') {
      reason = window.prompt('Raison du blocage (optionnel) :') || undefined;
    }

    const ok = window.confirm(nextStatus === 'blocked' ? 'Bloquer ce parrain ?' : 'Débloquer ce parrain ?');
    if (!ok) return;

    setActionLoadingId(rid);
    setError(null);
    try {
      const res = await adminSetReferrerStatus(rid, nextStatus, reason);
      if (!res || (res as any).ok !== true) {
        setError('Action impossible pour le moment.');
        return;
      }
      setOpenActionsId(null);
      await refresh();
    } finally {
      setActionLoadingId(null);
    }
  };

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    // Mark unseen referrers as seen by admin (best-effort)
    (async () => {
      try {
        await supabase
          .from('mkt_referrers')
          .update({ admin_seen_at: new Date().toISOString() })
          .is('admin_seen_at', null);
      } catch {
        // ignore
      }
    })();
  }, []);

  return (
    <div className="min-h-screen bg-cream-50 font-sans">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <div className="text-xs text-slate-500">Admin</div>
            <h1 className="text-2xl font-extrabold text-slate-800">Parrains (performance)</h1>
            <div className="text-sm text-slate-600 mt-1">Triés par points gagnés, puis nombre de filleuls.</div>
          </div>

          <button
            onClick={refresh}
            className="bg-brand-blue text-white px-4 py-3 rounded-xl font-extrabold hover:bg-teal-700"
          >
            Rafraîchir
          </button>
        </div>

        <div className="mt-6 bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">Recherche</label>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Code, nom, email, téléphone"
                  className="w-full border border-slate-200 rounded-xl px-10 py-3"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Type</label>
              <select
                value={onlyLambda === null ? '' : onlyLambda ? 'lambda' : 'normal'}
                onChange={(e) => {
                  const v = e.target.value;
                  if (!v) setOnlyLambda(null);
                  else setOnlyLambda(v === 'lambda');
                }}
                className="w-full border border-slate-200 rounded-xl px-4 py-3"
              >
                <option value="">Tous</option>
                <option value="normal">Normal</option>
                <option value="lambda">Lambda</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Statut</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full border border-slate-200 rounded-xl px-4 py-3">
                <option value="">Tous</option>
                <option value="active">Actif</option>
                <option value="blocked">Bloqué</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Min filleuls</label>
              <input value={minFilleuls} onChange={(e) => setMinFilleuls(e.target.value)} className="w-full border border-slate-200 rounded-xl px-4 py-3" placeholder="Ex: 2" />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Min points gagnés</label>
              <input value={minPointsEarned} onChange={(e) => setMinPointsEarned(e.target.value)} className="w-full border border-slate-200 rounded-xl px-4 py-3" placeholder="Ex: 200" />
            </div>

            <div className="md:col-span-5 flex items-center justify-between gap-3 mt-2">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Filter className="w-4 h-4" />
                Les filtres s'appliquent au prochain rafraîchissement.
              </div>
              <button
                onClick={refresh}
                className="bg-slate-900 text-white px-4 py-2 rounded-xl text-sm font-extrabold hover:bg-slate-800"
              >
                Appliquer
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="mt-8 flex items-center gap-2 text-slate-600">
            <Loader2 className="w-5 h-5 animate-spin" /> Chargement...
          </div>
        ) : error ? (
          <div className="mt-8 text-sm font-bold text-red-600 bg-red-50 border border-red-100 rounded-xl p-3">{error}</div>
        ) : (
          <div className="mt-6 bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div className="text-sm font-extrabold text-slate-800">{items.length} parrain(s)</div>
              <div className="text-xs text-slate-500">Ordre performance</div>
            </div>

            <div className="divide-y">
              {items.length === 0 ? (
                <div className="p-8 text-center text-slate-500">Aucun parrain trouvé.</div>
              ) : (
                items.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => navigate(`/admin/referrers-performance/${encodeURIComponent(String(r.id))}`)}
                    className="w-full text-left p-4 hover:bg-slate-50 transition"
                  >
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-extrabold text-slate-800">
                          {String(r.referral_code || '')} {r.is_lambda ? <span className="text-xs font-extrabold text-brand-orange">(lambda)</span> : null}
                        </div>
                        <div className="text-xs text-slate-500">{r.full_name || r.email || r.phone || ''}</div>
                      </div>
                      <div className="flex flex-wrap gap-3 items-center justify-end">
                        <div className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-2">
                          <div className="flex items-center gap-2 text-xs font-extrabold text-slate-700"><Users className="w-4 h-4" /> Filleuls</div>
                          <div className="text-sm font-extrabold text-slate-900">{Number(r.filleuls_total || 0)}</div>
                        </div>
                        <div className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-2">
                          <div className="flex items-center gap-2 text-xs font-extrabold text-slate-700"><Gift className="w-4 h-4" /> Points gagnés</div>
                          <div className="text-sm font-extrabold text-slate-900">{Number(r.points_earned_total || 0)}</div>
                        </div>
                        <div className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-2">
                          <div className="text-xs font-extrabold text-slate-700">Solde</div>
                          <div className="text-sm font-extrabold text-slate-900">{Number(r.points_balance || 0)}</div>
                        </div>

                        <div className="relative">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              const id = String(r.id || '');
                              setOpenActionsId((curr) => (curr === id ? null : id));
                            }}
                            className="inline-flex items-center justify-center w-10 h-10 rounded-xl border border-slate-200 bg-white hover:bg-slate-50"
                            aria-label="Actions"
                          >
                            <MoreVertical className="w-4 h-4 text-slate-700" />
                          </button>

                          {openActionsId === String(r.id || '') ? (
                            <div
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                              }}
                              className="absolute right-0 mt-2 w-56 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden z-20"
                            >
                              <button
                                type="button"
                                onClick={() => copyText(String(r.referral_code || ''))}
                                className="w-full px-4 py-3 text-left text-sm font-bold text-slate-700 hover:bg-slate-50 inline-flex items-center gap-2"
                              >
                                <Copy className="w-4 h-4" />
                                Copier le code
                              </button>

                              {r.email ? (
                                <button
                                  type="button"
                                  onClick={() => copyText(String(r.email || ''))}
                                  className="w-full px-4 py-3 text-left text-sm font-bold text-slate-700 hover:bg-slate-50 inline-flex items-center gap-2"
                                >
                                  <Copy className="w-4 h-4" />
                                  Copier l'email
                                </button>
                              ) : null}

                              <div className="h-px bg-slate-100" />

                              {String(r.status || '') === 'blocked' ? (
                                <button
                                  type="button"
                                  disabled={actionLoadingId === String(r.id || '')}
                                  onClick={() => doSetStatus(String(r.id || ''), 'active')}
                                  className="w-full px-4 py-3 text-left text-sm font-extrabold text-green-700 hover:bg-green-50 inline-flex items-center gap-2 disabled:opacity-60"
                                >
                                  <CheckCircle className="w-4 h-4" />
                                  Débloquer
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  disabled={actionLoadingId === String(r.id || '')}
                                  onClick={() => doSetStatus(String(r.id || ''), 'blocked')}
                                  className="w-full px-4 py-3 text-left text-sm font-extrabold text-red-700 hover:bg-red-50 inline-flex items-center gap-2 disabled:opacity-60"
                                >
                                  <Ban className="w-4 h-4" />
                                  Bloquer
                                </button>
                              )}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminReferrersPerformancePage;
