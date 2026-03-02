import React, { useEffect, useMemo, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../../../utils/supabaseClient';
import { Loader2, Save, Trash2 } from 'lucide-react';
import type { MktCustomerRequest, MktCustomerRequestStatus } from '../types';

type RequestRow = MktCustomerRequest & { flyerTitle?: string | null };

const statusOptions: MktCustomerRequestStatus[] = ['new', 'contacted', 'qualified', 'converted', 'closed', 'spam'];

const statusLabelFr = (s: MktCustomerRequestStatus | string | null | undefined) => {
  const v = String(s || '').trim();
  switch (v) {
    case 'new':
      return 'Nouveau';
    case 'contacted':
      return 'Contacté';
    case 'qualified':
      return 'Qualifié';
    case 'converted':
      return 'Converti';
    case 'closed':
      return 'Clos';
    case 'spam':
      return 'Spam';
    default:
      return v || '-';
  }
};

const eventTypeLabelFr = (t: string | null | undefined) => {
  const v = String(t || '').trim();
  switch (v) {
    case 'status_change':
      return 'Changement de statut';
    case 'note':
      return 'Note';
    case 'request_created':
      return 'Demande créée';
    case 'created':
      return 'Créé';
    default:
      if (/request\s*created/i.test(v)) return 'Demande créée';
      return v || '-';
  }
};

const AdminCustomerRequestsPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<RequestRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showArchived, setShowArchived] = useState(false);

  const canUse = useMemo(() => isSupabaseConfigured, []);

  const load = async () => {
    if (!canUse) {
      setRows([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      let q = supabase
        .from('mkt_customer_requests')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      if (!showArchived) {
        q = q.not('status', 'in', '("closed","spam")');
      }

      const { data, error } = await q;

      if (error || !data) {
        setRows([]);
        return;
      }

      const flyerIds = Array.from(new Set((data as any[]).map((r) => r.source_flyer_id).filter(Boolean)));
      let flyerMap = new Map<string, string>();
      if (flyerIds.length) {
        const { data: flyers } = await supabase
          .from('mkt_flyers')
          .select('id,title')
          .in('id', flyerIds);

        (flyers as any[] | null | undefined)?.forEach((f) => flyerMap.set(String(f.id), String(f.title || '')));
      }

      const mapped = (data as any[]).map((r) => ({
        ...(r as any),
        flyerTitle: r.source_flyer_id ? flyerMap.get(String(r.source_flyer_id)) || null : null,
      }));

      setRows(mapped);

      // Mark unseen requests as seen by admin (best-effort)
      try {
        const unseenIds = (data as any[])
          .filter((r: any) => !r?.admin_seen_at)
          .map((r: any) => r?.id)
          .filter(Boolean);
        if (unseenIds.length) {
          await supabase
            .from('mkt_customer_requests')
            .update({ admin_seen_at: new Date().toISOString() })
            .in('id', unseenIds);
        }
      } catch {
        // ignore
      }
    } finally {
      setLoading(false);
    }
  };

  const loadHistory = async (requestId: string) => {
    setHistory([]);
    if (!canUse) return;

    const { data } = await supabase
      .from('mkt_customer_request_events')
      .select('*')
      .eq('request_id', requestId)
      .order('created_at', { ascending: false });

    setHistory((data as any[]) || []);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showArchived]);

  useEffect(() => {
    if (!selectedId) return;
    loadHistory(selectedId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const updateStatus = async (requestId: string, nextStatus: MktCustomerRequestStatus) => {
    if (saving) return;
    setSaving(true);
    try {
      const row = rows.find((r) => r.id === requestId);
      const prev = (row?.status || 'new') as MktCustomerRequestStatus;

      await supabase
        .from('mkt_customer_requests')
        .update({ status: nextStatus })
        .eq('id', requestId);

      await supabase
        .from('mkt_customer_request_events')
        .insert({
          request_id: requestId,
          event_type: 'status_change',
          from_status: prev,
          to_status: nextStatus,
          note: null,
          payload: null,
        } as any);

      await load();
      if (selectedId === requestId) await loadHistory(requestId);
    } finally {
      setSaving(false);
    }
  };

  const addNote = async () => {
    if (!selectedId) return;
    const n = String(note || '').trim();
    if (!n) return;

    if (saving) return;
    setSaving(true);
    try {
      await supabase
        .from('mkt_customer_request_events')
        .insert({
          request_id: selectedId,
          event_type: 'note',
          note: n,
          payload: null,
        } as any);

      setNote('');
      await loadHistory(selectedId);
    } finally {
      setSaving(false);
    }
  };

  const selected = selectedId ? rows.find((r) => r.id === selectedId) || null : null;

  const allSelected = rows.length > 0 && selectedIds.size === rows.length;

  const toggleRowSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedIds((prev) => {
      if (rows.length === 0) return prev;
      if (prev.size === rows.length) return new Set();
      return new Set(rows.map((r) => r.id));
    });
  };

  const bulkArchiveSelected = async () => {
    if (!canUse) return;
    if (saving) return;
    if (selectedIds.size === 0) return;

    const ok = window.confirm(`Supprimer ${selectedIds.size} demande(s) ?`);
    if (!ok) return;

    setSaving(true);
    try {
      const ids = Array.from(selectedIds);
      await supabase
        .from('mkt_customer_requests')
        .update({ status: 'closed' })
        .in('id', ids);

      setSelectedIds(new Set());
      if (selectedId && ids.includes(selectedId)) {
        setSelectedId(null);
        setHistory([]);
      }
      await load();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="h-full w-full overflow-y-auto p-6">
      <div>
        <div className="text-xs text-slate-500">Admin</div>
        <h1 className="text-2xl font-extrabold text-slate-800">Demandes clients (Flyers)</h1>
        <div className="text-xs text-slate-500 mt-1">Infos client, flyer, statut et historique.</div>
      </div>

      {loading ? (
        <div className="mt-10 flex items-center gap-2 text-slate-600">
          <Loader2 className="w-5 h-5 animate-spin" />
          Chargement...
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-white border border-slate-100 rounded-2xl overflow-hidden">
            <div className="p-3 border-b border-slate-100 bg-white flex items-center justify-between gap-3">
              <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-700">
                <input
                  type="checkbox"
                  checked={showArchived}
                  onChange={(e) => setShowArchived(e.target.checked)}
                />
                Supprimées
              </label>

              <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-700">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleSelectAll}
                />
                Tout sélectionner
              </label>

              <button
                onClick={bulkArchiveSelected}
                disabled={saving || selectedIds.size === 0}
                className="inline-flex items-center gap-2 bg-red-600 text-white px-3 py-2 rounded-xl font-extrabold hover:bg-red-700 disabled:opacity-60"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Supprimer la sélection ({selectedIds.size})
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-[980px] w-full text-sm">
                <thead className="bg-slate-50">
                  <tr className="text-left text-slate-600">
                    <th className="px-4 py-3 w-10"></th>
                    <th className="px-4 py-3">Client</th>
                    <th className="px-4 py-3">Flyer</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr
                      key={r.id}
                      className={`border-t border-slate-100 cursor-pointer ${selectedId === r.id ? 'bg-brand-blue/5' : ''}`}
                      onClick={() => setSelectedId(r.id)}
                    >
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(r.id)}
                          onChange={() => toggleRowSelection(r.id)}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-extrabold text-slate-800">{r.full_name}</div>
                        <div className="text-xs text-slate-500">{r.email || ''} {r.phone ? `• ${r.phone}` : ''}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-700">{r.flyerTitle || '-'}</div>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">{new Date(r.created_at).toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <select
                          value={r.status}
                          onChange={(e) => updateStatus(r.id, e.target.value as MktCustomerRequestStatus)}
                          className="border border-slate-200 rounded-xl px-3 py-2 font-bold"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {statusOptions.map((s) => (
                            <option key={s} value={s}>{statusLabelFr(s)}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}

                  {rows.length === 0 ? (
                    <tr>
                      <td className="px-4 py-8 text-center text-slate-600" colSpan={5}>
                        Aucune demande.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white border border-slate-100 rounded-2xl p-4">
            <div className="text-sm font-extrabold text-slate-800">Historique</div>

            {selected ? (
              <>
                <div className="text-xs text-slate-500 mt-1">{selected.full_name} • {selected.flyerTitle || '-'}</div>

                <div className="mt-4">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Ajouter une note</label>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-3 min-h-24"
                    placeholder="Note interne (appelé, devis envoyé, etc.)"
                  />
                  <button
                    onClick={addNote}
                    disabled={saving}
                    className="mt-3 inline-flex items-center gap-2 bg-brand-blue text-white px-4 py-2 rounded-xl font-extrabold hover:bg-teal-700 disabled:opacity-60"
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Ajouter
                  </button>
                </div>

                <div className="mt-5 space-y-3">
                  {history.map((h) => (
                    <div key={h.id} className="border border-slate-100 rounded-xl p-3 bg-slate-50">
                      <div className="text-xs font-bold text-slate-700">{eventTypeLabelFr(h.event_type)}</div>
                      <div className="text-[11px] text-slate-500">{new Date(h.created_at).toLocaleString()}</div>
                      {h.note ? <div className="text-sm text-slate-700 mt-2 whitespace-pre-wrap">{h.note}</div> : null}
                      {h.from_status || h.to_status ? (
                        <div className="text-xs text-slate-600 mt-2">{statusLabelFr(h.from_status)} → {statusLabelFr(h.to_status)}</div>
                      ) : null}
                    </div>
                  ))}

                  {history.length === 0 ? (
                    <div className="text-sm text-slate-600">Aucun historique.</div>
                  ) : null}
                </div>
              </>
            ) : (
              <div className="mt-4 text-sm text-slate-600">Sélectionne une demande à gauche.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminCustomerRequestsPage;
