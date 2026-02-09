import React, { useEffect, useState } from 'react';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../../utils/supabaseClient';

type Row = {
  id: string;
  referrer_id: string;
  referral_code: string;
  referred_full_name: string | null;
  referred_email: string | null;
  referred_phone: string | null;
  status: string;
  deleted_at: string | null;
  deleted_by: string | null;
  deleted_reason: string | null;
  created_at: string;
  mkt_referrers?: {
    referral_code: string;
    full_name: string | null;
  } | null;
};

const AdminDeletedReferralsPage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [lostByReferral, setLostByReferral] = useState<Record<string, number>>({});

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data, error: e } = await supabase
          .from('mkt_referrals')
          .select('*, mkt_referrers:referrer_id(referral_code, full_name)')
          .not('deleted_at', 'is', null)
          .order('deleted_at', { ascending: false });

        if (e) {
          setError(String((e as any)?.message || 'Erreur chargement'));
          return;
        }

        const list = (data || []) as any as Row[];
        if (!mounted) return;
        setRows(list);

        const ids = list.map(r => r.id);
        if (ids.length) {
          const { data: auditRows, error: auditErr } = await supabase
            .from('mkt_audit_log')
            .select('entity_id, after, created_at')
            .eq('entity_table', 'mkt_referrals')
            .eq('action', 'referral_deleted')
            .in('entity_id', ids)
            .order('created_at', { ascending: false });

          if (!auditErr) {
            const map: Record<string, number> = {};
            (auditRows || []).forEach((ar: any) => {
              const k = String(ar?.entity_id || '');
              if (!k) return;
              const lp = Number(ar?.after?.lost_points || 0);
              if (map[k] === undefined) map[k] = lp;
            });
            setLostByReferral(map);
          }
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    run();

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="min-h-screen bg-cream-50 font-sans">
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-sm font-bold text-slate-700 hover:text-slate-900"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour
          </button>

          <div className="text-right">
            <h1 className="text-2xl font-extrabold text-slate-800">Filleuls supprimés</h1>
            <div className="text-xs text-slate-500">Points perdus associés</div>
          </div>
        </div>

        {error ? (
          <div className="mt-4 bg-red-50 border border-red-100 text-red-700 rounded-xl p-3 text-sm font-bold">{error}</div>
        ) : null}

        {loading ? (
          <div className="mt-8 flex items-center gap-2 text-slate-600">
            <Loader2 className="w-5 h-5 animate-spin" />
            Chargement...
          </div>
        ) : (
          <div className="mt-6 bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="overflow-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="text-left p-3 font-extrabold">Filleul</th>
                    <th className="text-left p-3 font-extrabold">Parrain</th>
                    <th className="text-left p-3 font-extrabold">Supprimé le</th>
                    <th className="text-left p-3 font-extrabold">Raison</th>
                    <th className="text-right p-3 font-extrabold">Points perdus</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-t border-slate-100">
                      <td className="p-3">
                        <div className="font-extrabold text-slate-800">{r.referred_full_name || '—'}</div>
                        <div className="text-xs text-slate-500">{r.referred_email || r.referred_phone || '—'}</div>
                      </td>
                      <td className="p-3">
                        <div className="font-extrabold text-slate-800">{r.mkt_referrers?.full_name || '—'}</div>
                        <div className="text-xs text-slate-500">Code: {r.mkt_referrers?.referral_code || r.referral_code}</div>
                      </td>
                      <td className="p-3">
                        <div className="text-slate-700 font-bold">{r.deleted_at ? new Date(r.deleted_at).toLocaleString() : '—'}</div>
                      </td>
                      <td className="p-3">
                        <div className="text-slate-700">{r.deleted_reason || '—'}</div>
                      </td>
                      <td className="p-3 text-right">
                        <span className="font-extrabold text-red-700">{Number(lostByReferral[r.id] || 0)}</span>
                      </td>
                    </tr>
                  ))}
                  {!rows.length ? (
                    <tr>
                      <td colSpan={5} className="p-6 text-center text-slate-500">Aucun filleul supprimé.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDeletedReferralsPage;
