import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, BadgeCheck, Gift, Loader2, Users } from 'lucide-react';
import { adminGetReferrerPerformance } from '../client';
import type { MktAdminReferrerPerformanceDetails } from '../client';
import { supabase } from '../../../utils/supabaseClient';

const AdminReferrerPerformanceDetailsPage: React.FC = () => {
  const navigate = useNavigate();
  const params = useParams();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<MktAdminReferrerPerformanceDetails | null>(null);

  const [statusSaving, setStatusSaving] = useState(false);
  const [reason, setReason] = useState('');

  useEffect(() => {
    const rid = String(params.referrerId || '').trim();
    if (!rid) {
      setLoading(false);
      setError('Parrain introuvable.');
      return;
    }

    let mounted = true;
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await adminGetReferrerPerformance(rid);
        if (!mounted) return;
        if (!res) {
          setData(null);
          setError('Parrain introuvable ou accès refusé.');
          return;
        }
        setData(res);
        setReason('');
      } catch {
        if (mounted) setError("Impossible de charger ce parrain.");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    run();
    return () => {
      mounted = false;
    };
  }, [params.referrerId]);

  return (
    <div className="min-h-screen bg-cream-50 font-sans">
      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={() => navigate('/admin/referrers-performance')}
            className="flex items-center gap-2 text-sm font-bold text-slate-700 hover:text-slate-900"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour
          </button>
          <div className="text-right">
            <div className="text-xs text-slate-500">Admin</div>
          </div>
        </div>

        {loading ? (
          <div className="mt-8 flex items-center gap-2 text-slate-600">
            <Loader2 className="w-5 h-5 animate-spin" /> Chargement...
          </div>
        ) : error ? (
          <div className="mt-8 text-sm font-bold text-red-600 bg-red-50 border border-red-100 rounded-xl p-3">{error}</div>
        ) : !data ? (
          <div className="mt-8 text-sm text-slate-600">Aucune donnée.</div>
        ) : (
          <>
            <div className="mt-6 bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <div className="text-xs text-slate-500">Code parrain</div>
                  <div className="text-2xl font-extrabold text-slate-800 tracking-wider">{String((data.referrer as any).referral_code || '')}</div>
                  <div className="text-xs text-slate-500 mt-1">
                    Type: {(data.referrer as any).is_lambda ? 'lambda' : 'normal'} | Statut: {String((data.referrer as any).status || '')}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    {String((data.referrer as any).full_name || '')} {String((data.referrer as any).email || '')}
                  </div>
                </div>

                <div className="w-full md:w-[360px]">
                  <div className="text-xs font-extrabold text-slate-700">Actions</div>
                  <div className="mt-2">
                    <label className="block text-xs font-bold text-slate-600 mb-1">Raison (optionnel)</label>
                    <input
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      className="w-full border border-slate-200 rounded-xl px-3 py-3 text-sm"
                      placeholder="Ex: fraude / abus"
                    />
                  </div>

                  <div className="mt-3 flex gap-2">
                    {String((data.referrer as any).status || 'active') === 'active' ? (
                      <button
                        disabled={statusSaving}
                        onClick={async () => {
                          if (statusSaving) return;
                          setStatusSaving(true);
                          setError(null);
                          try {
                            const { data: rpcData, error: rpcErr } = await supabase.rpc('mkt_admin_set_referrer_status', {
                              p_referrer_id: String((data.referrer as any).id),
                              p_status: 'blocked',
                              p_reason: String(reason || '').trim() || null,
                            });
                            if (rpcErr || !rpcData || (rpcData as any).ok !== true) {
                              setError('Blocage impossible.');
                              return;
                            }
                            const res = await adminGetReferrerPerformance(String((data.referrer as any).id));
                            setData(res);
                            setReason('');
                          } finally {
                            setStatusSaving(false);
                          }
                        }}
                        className="flex-1 bg-red-600 text-white px-4 py-3 rounded-xl font-extrabold hover:bg-red-700 disabled:opacity-60"
                      >
                        Bloquer
                      </button>
                    ) : (
                      <button
                        disabled={statusSaving}
                        onClick={async () => {
                          if (statusSaving) return;
                          setStatusSaving(true);
                          setError(null);
                          try {
                            const { data: rpcData, error: rpcErr } = await supabase.rpc('mkt_admin_set_referrer_status', {
                              p_referrer_id: String((data.referrer as any).id),
                              p_status: 'active',
                              p_reason: String(reason || '').trim() || null,
                            });
                            if (rpcErr || !rpcData || (rpcData as any).ok !== true) {
                              setError('Déblocage impossible.');
                              return;
                            }
                            const res = await adminGetReferrerPerformance(String((data.referrer as any).id));
                            setData(res);
                            setReason('');
                          } finally {
                            setStatusSaving(false);
                          }
                        }}
                        className="flex-1 bg-green-600 text-white px-4 py-3 rounded-xl font-extrabold hover:bg-green-700 disabled:opacity-60"
                      >
                        Débloquer
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-2">
                    <div className="flex items-center gap-2 text-xs font-extrabold text-slate-700"><Users className="w-4 h-4" /> Filleuls</div>
                    <div className="text-sm font-extrabold text-slate-900">{Number((data.stats as any).filleuls_total || 0)}</div>
                  </div>
                  <div className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-2">
                    <div className="flex items-center gap-2 text-xs font-extrabold text-slate-700"><BadgeCheck className="w-4 h-4" /> Factures</div>
                    <div className="text-sm font-extrabold text-slate-900">{Number((data.stats as any).paid_invoices_total || 0)}</div>
                  </div>
                  <div className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-2">
                    <div className="flex items-center gap-2 text-xs font-extrabold text-slate-700"><Gift className="w-4 h-4" /> Gagnés</div>
                    <div className="text-sm font-extrabold text-slate-900">{Number((data.stats as any).points_earned_total || 0)}</div>
                  </div>
                  <div className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-2">
                    <div className="text-xs font-extrabold text-slate-700">Solde</div>
                    <div className="text-sm font-extrabold text-slate-900">{Number((data.stats as any).points_balance || 0)}</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <div className="text-sm font-extrabold text-slate-800">Filleuls ({(data.referrals || []).length})</div>
                <div className="text-xs text-slate-500">Derniers en premier</div>
              </div>

              <div className="divide-y">
                {(data.referrals || []).length === 0 ? (
                  <div className="p-8 text-center text-slate-500">Aucun filleul.</div>
                ) : (
                  (data.referrals || []).map((rf: any) => (
                    <div key={String(rf.id)} className="p-4">
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                        <div>
                          <div className="text-sm font-extrabold text-slate-800">{String(rf.referred_full_name || rf.referred_email || rf.referred_phone || 'Filleul')}</div>
                          <div className="text-xs text-slate-500">Statut: {String(rf.status || '')}</div>
                          <div className="text-xs text-slate-500">Créé: {rf.created_at ? new Date(rf.created_at).toLocaleString() : ''}</div>
                        </div>
                        <div className="flex gap-3">
                          <div className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-2">
                            <div className="text-xs font-extrabold text-slate-700">Factures payées</div>
                            <div className="text-sm font-extrabold text-slate-900">{Number(rf.paid_invoices_count || 0)}</div>
                          </div>
                          <div className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-2">
                            <div className="text-xs font-extrabold text-slate-700">Devenu parrain</div>
                            <div className="text-sm font-extrabold text-slate-900">{rf.became_referrer_at ? 'Oui' : 'Non'}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AdminReferrerPerformanceDetailsPage;
