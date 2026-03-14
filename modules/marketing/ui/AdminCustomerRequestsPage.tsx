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

// Status color mapping for row background
const getStatusColorClass = (status: MktCustomerRequestStatus | string | null | undefined): string => {
  const v = String(status || '').trim();
  switch (v) {
    case 'new':
      return 'bg-blue-50/70 border-l-4 border-l-blue-500';
    case 'contacted':
      return 'bg-amber-50/70 border-l-4 border-l-amber-500';
    case 'qualified':
      return 'bg-purple-50/70 border-l-4 border-l-purple-500';
    case 'converted':
      return 'bg-emerald-50/70 border-l-4 border-l-emerald-500';
    case 'closed':
      return 'bg-slate-100/70 border-l-4 border-l-slate-400';
    case 'spam':
      return 'bg-red-50/70 border-l-4 border-l-red-500';
    default:
      return '';
  }
};

// Status badge color
const getStatusBadgeClass = (status: MktCustomerRequestStatus | string | null | undefined): string => {
  const v = String(status || '').trim();
  switch (v) {
    case 'new':
      return 'bg-blue-100 text-blue-700 border-blue-200';
    case 'contacted':
      return 'bg-amber-100 text-amber-700 border-amber-200';
    case 'qualified':
      return 'bg-purple-100 text-purple-700 border-purple-200';
    case 'converted':
      return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    case 'closed':
      return 'bg-slate-100 text-slate-600 border-slate-200';
    case 'spam':
      return 'bg-red-100 text-red-700 border-red-200';
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200';
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
  const [statusFilters, setStatusFilters] = useState<Set<MktCustomerRequestStatus>>(new Set(statusOptions));
  
  // Text filters
  const [filterName, setFilterName] = useState('');
  const [filterEmail, setFilterEmail] = useState('');
  const [filterFlyer, setFilterFlyer] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 12;

  const canUse = useMemo(() => isSupabaseConfigured, []);

  // Filter rows based on selected status filters and text filters
  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      // Status filter
      if (!statusFilters.has(r.status)) return false;
      
      // Name filter (search in full_name)
      if (filterName.trim()) {
        const nameLower = r.full_name?.toLowerCase() || '';
        if (!nameLower.includes(filterName.trim().toLowerCase())) return false;
      }
      
      // Email filter
      if (filterEmail.trim()) {
        const emailLower = r.email?.toLowerCase() || '';
        if (!emailLower.includes(filterEmail.trim().toLowerCase())) return false;
      }
      
      // Flyer/Pack filter
      if (filterFlyer.trim()) {
        const flyerLower = r.flyerTitle?.toLowerCase() || '';
        if (!flyerLower.includes(filterFlyer.trim().toLowerCase())) return false;
      }
      
      // Date from filter
      if (filterDateFrom) {
        const rowDate = new Date(r.created_at);
        const fromDate = new Date(filterDateFrom);
        if (rowDate < fromDate) return false;
      }
      
      // Date to filter
      if (filterDateTo) {
        const rowDate = new Date(r.created_at);
        const toDate = new Date(filterDateTo);
        toDate.setHours(23, 59, 59, 999); // End of day
        if (rowDate > toDate) return false;
      }
      
      return true;
    });
  }, [rows, statusFilters, filterName, filterEmail, filterFlyer, filterDateFrom, filterDateTo]);

  // Pagination logic
  const totalPages = Math.ceil(filteredRows.length / ITEMS_PER_PAGE);
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredRows.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredRows, currentPage]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilters, filterName, filterEmail, filterFlyer, filterDateFrom, filterDateTo]);

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

  const allSelected = paginatedRows.length > 0 && selectedIds.size === paginatedRows.length;

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
      if (paginatedRows.length === 0) return prev;
      if (prev.size === paginatedRows.length) return new Set();
      return new Set(paginatedRows.map((r) => r.id));
    });
  };

  const toggleStatusFilter = (status: MktCustomerRequestStatus) => {
    setStatusFilters((prev) => {
      const next = new Set(prev);
      if (next.has(status)) {
        next.delete(status);
      } else {
        next.add(status);
      }
      return next;
    });
  };

  const selectAllStatuses = () => {
    setStatusFilters(new Set(statusOptions));
  };

  const clearAllStatuses = () => {
    setStatusFilters(new Set());
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
            {/* Text Filters Bar */}
            <div className="p-3 border-b border-slate-100 bg-slate-50/50">
              <div className="text-xs font-bold text-slate-600 mb-2">Filtres de recherche :</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                <div>
                  <input
                    type="text"
                    placeholder="Nom / Prénom"
                    value={filterName}
                    onChange={(e) => setFilterName(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <input
                    type="text"
                    placeholder="Email"
                    value={filterEmail}
                    onChange={(e) => setFilterEmail(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <input
                    type="text"
                    placeholder="Flyer / Pack"
                    value={filterFlyer}
                    onChange={(e) => setFilterFlyer(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <input
                    type="date"
                    placeholder="Date début"
                    value={filterDateFrom}
                    onChange={(e) => setFilterDateFrom(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <input
                    type="date"
                    placeholder="Date fin"
                    value={filterDateTo}
                    onChange={(e) => setFilterDateTo(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs"
                  />
                </div>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <button
                  onClick={() => {
                    setFilterName('');
                    setFilterEmail('');
                    setFilterFlyer('');
                    setFilterDateFrom('');
                    setFilterDateTo('');
                    setStatusFilters(new Set(statusOptions));
                  }}
                  className="text-xs text-slate-500 hover:text-slate-700 underline"
                >
                  Réinitialiser tous les filtres
                </button>
              </div>
            </div>

            {/* Status Filter Bar */}
            <div className="p-3 border-b border-slate-100 bg-white">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-xs font-bold text-slate-600">Filtrer par statut :</span>
                <button
                  onClick={selectAllStatuses}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                    statusFilters.size === statusOptions.length
                      ? 'bg-brand-blue text-white border-brand-blue'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  Tous
                </button>
                <button
                  onClick={clearAllStatuses}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold border bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                >
                  Aucun
                </button>
                <div className="w-px h-5 bg-slate-200 mx-1"></div>
                {statusOptions.map((status) => {
                  const isSelected = statusFilters.has(status);
                  const badgeClass = getStatusBadgeClass(status);
                  return (
                    <button
                      key={status}
                      onClick={() => toggleStatusFilter(status)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                        isSelected
                          ? `${badgeClass} ring-2 ring-offset-1 ring-slate-300`
                          : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50 opacity-60'
                      }`}
                    >
                      {statusLabelFr(status)}
                    </button>
                  );
                })}
              </div>
              <div className="mt-2 text-xs text-slate-500">
                {filteredRows.length} demande(s) affichée(s) sur {rows.length} total
              </div>
            </div>

            {/* Status Legend */}
            <div className="p-3 border-b border-slate-100 bg-slate-50">
              <div className="text-xs font-bold text-slate-600 mb-2">Légende des statuts :</div>
              <div className="flex flex-wrap gap-2">
                {[
                  { status: 'new', label: 'Nouveau', color: 'bg-blue-500' },
                  { status: 'contacted', label: 'Contacté', color: 'bg-amber-500' },
                  { status: 'qualified', label: 'Qualifié', color: 'bg-purple-500' },
                  { status: 'converted', label: 'Converti', color: 'bg-emerald-500' },
                  { status: 'closed', label: 'Clos', color: 'bg-slate-400' },
                  { status: 'spam', label: 'Spam', color: 'bg-red-500' },
                ].map(({ status, label, color }) => (
                  <div key={status} className="flex items-center gap-1.5 px-2 py-1 bg-white rounded-lg border border-slate-200">
                    <div className={`w-3 h-3 rounded-full ${color}`}></div>
                    <span className="text-xs font-medium text-slate-700">{label}</span>
                  </div>
                ))}
              </div>
            </div>
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
                  {paginatedRows.map((r) => (
                    <tr
                      key={r.id}
                      className={`border-t border-slate-100 cursor-pointer transition-colors hover:bg-slate-50/50 ${
                        selectedId === r.id ? 'bg-brand-blue/5' : getStatusColorClass(r.status)
                      }`}
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
                          className={`border rounded-xl px-3 py-2 font-bold text-xs ${getStatusBadgeClass(r.status)}`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {statusOptions.map((s) => (
                            <option key={s} value={s}>{statusLabelFr(s)}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}

                  {paginatedRows.length === 0 ? (
                    <tr>
                      <td className="px-4 py-8 text-center text-slate-600" colSpan={5}>
                        Aucune demande.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="p-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
                <div className="text-xs text-slate-600">
                  Page {currentPage} sur {totalPages} ({filteredRows.length} total)
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold border bg-white text-slate-700 border-slate-200 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Précédent
                  </button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      // Show pages around current page
                      let pageNum;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          className={`w-8 h-8 rounded-lg text-xs font-bold border ${
                            currentPage === pageNum
                              ? 'bg-brand-blue text-white border-brand-blue'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold border bg-white text-slate-700 border-slate-200 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Suivant
                  </button>
                </div>
              </div>
            )}
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
