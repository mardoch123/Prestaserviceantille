import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../../utils/supabaseClient';

type Row = {
  id: string;
  referrer_id: string;
  referral_code: string;
  referred_full_name: string | null;
  referred_email: string | null;
  referred_phone: string | null;
  referred_client_id: string | null;
  status: string;
  paid_invoices_count?: number | null;
  became_referrer_at?: string | null;
  deleted_at: string | null;
  deleted_by: string | null;
  deleted_reason: string | null;
  created_at: string;
  updated_at: string;
  mkt_referrers?: {
    referral_code: string;
    full_name: string | null;
    email: string | null;
    phone: string | null;
  } | null;
};

const AdminReferralsPage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [statusOpen, setStatusOpen] = useState(false);
  const [statusRow, setStatusRow] = useState<Row | null>(null);
  const [statusReason, setStatusReason] = useState('');
  const [statusSaving, setStatusSaving] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteRow, setDeleteRow] = useState<Row | null>(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [pointsLost, setPointsLost] = useState<number | null>(null);

  const activeRows = useMemo(() => (rows || []).filter(r => !r.deleted_at), [rows]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: e } = await supabase
        .from('mkt_referrals')
        .select('*, mkt_referrers:referrer_id(referral_code, full_name, email, phone)')
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (e) {
        setError(String((e as any)?.message || 'Erreur chargement'));
        setRows([]);
        return;
      }
      setRows((data || []) as any);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openDelete = async (r: Row) => {
    setDeleteRow(r);
    setDeleteReason('');
    setPointsLost(null);
    setDeleteOpen(true);

    try {
      const { data, error } = await supabase
        .from('mkt_points_ledger')
        .select('points')
        .eq('source_referral_id', r.id)
        .eq('reason', 'invoice_paid');

      if (error) return;
      const lost = (data || []).reduce((sum: number, x: any) => sum + Number(x?.points || 0), 0);
      setPointsLost(lost);
    } catch {
      // ignore
    }
  };

  const confirmDelete = async () => {
    if (!deleteRow || deleteLoading) return;

    setDeleteLoading(true);
    try {
      const { data, error } = await supabase.rpc('mkt_delete_referral', {
        p_referral_id: deleteRow.id,
        p_reason: String(deleteReason || '').trim() || null,
      });

      if (error || !data || (data as any).ok !== true) {
        setError('Suppression impossible pour le moment.');
        return;
      }

      setDeleteOpen(false);
      setDeleteRow(null);
      await load();
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-cream-50 font-sans">
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-800">Filleuls</h1>
            <div className="text-xs text-slate-500">Parrainage</div>
          </div>

          <button
            onClick={() => navigate('/admin/referrals/deleted')}
            className="bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-xl font-extrabold hover:bg-slate-50 text-sm"
          >
            Voir supprimés
          </button>
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
                    <th className="text-left p-3 font-extrabold">Statut</th>
                    <th className="text-left p-3 font-extrabold">Prestations payées</th>
                    <th className="text-right p-3 font-extrabold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {activeRows.map((r) => (
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
                        <span className={`inline-flex px-2 py-1 rounded-lg font-extrabold text-xs ${r.status === 'blocked' ? 'bg-red-50 text-red-700' : 'bg-slate-100 text-slate-700'}`}>{r.status}</span>
                      </td>
                      <td className="p-3">
                        <span className="font-extrabold text-slate-800">{Number((r as any).paid_invoices_count || 0)}</span>
                        {r.became_referrer_at ? <span className="ml-2 text-xs text-green-700 font-extrabold">Devenu parrain</span> : null}
                      </td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => {
                            setStatusRow(r);
                            setStatusReason('');
                            setStatusOpen(true);
                          }}
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900 text-white font-extrabold hover:bg-slate-800 mr-2"
                        >
                          {r.status === 'blocked' ? 'Débloquer' : 'Bloquer'}
                        </button>
                        <button
                          onClick={() => openDelete(r)}
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-red-600 text-white font-extrabold hover:bg-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                          Supprimer
                        </button>
                      </td>
                    </tr>
                  ))}
                  {!activeRows.length ? (
                    <tr>
                      <td colSpan={5} className="p-6 text-center text-slate-500">Aucun filleul.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {deleteOpen && deleteRow ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="p-5 border-b border-slate-100">
              <div className="text-lg font-extrabold text-slate-900">Supprimer un filleul</div>
              <div className="text-sm text-slate-600 mt-1">
                Cette action supprimera aussi tous les points générés par ce filleul.
              </div>
            </div>

            <div className="p-5 space-y-3">
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-sm text-amber-900">
                <div className="font-extrabold">Avertissement</div>
                <div className="mt-1">Points qui seront perdus : <span className="font-extrabold">{pointsLost === null ? '...' : pointsLost}</span></div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Raison (optionnel)</label>
                <input
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-3 text-sm"
                  placeholder="Ex: Doublon / erreur"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={() => { setDeleteOpen(false); setDeleteRow(null); }}
                  className="px-4 py-2 rounded-xl border border-slate-200 font-extrabold text-slate-700 hover:bg-slate-50"
                >
                  Annuler
                </button>
                <button
                  onClick={confirmDelete}
                  disabled={deleteLoading}
                  className="px-4 py-2 rounded-xl bg-red-600 text-white font-extrabold hover:bg-red-700 disabled:opacity-60"
                >
                  {deleteLoading ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Suppression...
                    </span>
                  ) : (
                    'Confirmer'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {statusOpen && statusRow ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="p-5 border-b border-slate-100">
              <div className="text-lg font-extrabold text-slate-900">{statusRow.status === 'blocked' ? 'Débloquer' : 'Bloquer'} un filleul</div>
              <div className="text-sm text-slate-600 mt-1">Le blocage stoppe la génération de points pour ce filleul.</div>
            </div>

            <div className="p-5 space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Raison (optionnel)</label>
                <input
                  value={statusReason}
                  onChange={(e) => setStatusReason(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-3 text-sm"
                  placeholder="Ex: abus"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={() => { setStatusOpen(false); setStatusRow(null); }}
                  className="px-4 py-2 rounded-xl border border-slate-200 font-extrabold text-slate-700 hover:bg-slate-50"
                >
                  Annuler
                </button>
                <button
                  disabled={statusSaving}
                  onClick={async () => {
                    if (!statusRow || statusSaving) return;
                    setStatusSaving(true);
                    setError(null);
                    try {
                      const nextStatus = statusRow.status === 'blocked' ? 'validated' : 'blocked';
                      const { data, error: e } = await supabase.rpc('mkt_admin_set_referral_status', {
                        p_referral_id: statusRow.id,
                        p_status: nextStatus,
                        p_reason: String(statusReason || '').trim() || null,
                      });
                      if (e) {
                        setError(String(e.message || 'Action impossible.'));
                        return;
                      }
                      if (!data || (data as any).ok !== true) {
                        const code = String((data as any)?.error || '').trim();
                        setError(code ? `Action impossible (${code}).` : 'Action impossible.');
                        return;
                      }
                      setStatusOpen(false);
                      setStatusRow(null);
                      await load();
                    } finally {
                      setStatusSaving(false);
                    }
                  }}
                  className={`px-4 py-2 rounded-xl text-white font-extrabold disabled:opacity-60 ${statusRow.status === 'blocked' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}
                >
                  {statusSaving ? (
                    <span className="inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> En cours...</span>
                  ) : (
                    statusRow.status === 'blocked' ? 'Débloquer' : 'Bloquer'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default AdminReferralsPage;
