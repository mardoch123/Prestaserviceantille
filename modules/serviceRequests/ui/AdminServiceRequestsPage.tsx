import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Loader2, 
  CheckCircle, 
  XCircle, 
  Eye, 
  Calendar, 
  User, 
  Package, 
  Clock,
  FileText,
  Filter,
  Search,
  Trash2,
  AlertCircle,
  CheckSquare,
  Square
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../../../utils/supabaseClient';
import ListingFilterBar from '../../../components/ListingFilterBar';
import type { CustomerServiceRequest, CustomerServiceRequestStatus } from '../types';
import { 
  getCustomerServiceRequests, 
  markRequestAsSeen,
  markRequestsAsSeen,
  deleteCustomerServiceRequest 
} from '../client';

const statusLabelFr: Record<CustomerServiceRequestStatus, string> = {
  pending: 'En attente',
  validated: 'Validée',
  rejected: 'Rejetée',
  cancelled: 'Annulée',
};

const statusColors: Record<CustomerServiceRequestStatus, string> = {
  pending: 'bg-amber-100 text-amber-700 border-amber-200',
  validated: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  rejected: 'bg-red-100 text-red-700 border-red-200',
  cancelled: 'bg-slate-100 text-slate-600 border-slate-200',
};

const AdminServiceRequestsPage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<CustomerServiceRequest[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<CustomerServiceRequestStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState<'date_desc' | 'date_asc' | 'client'>('date_desc');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [deleting, setDeleting] = useState(false);
  const [markingSeen, setMarkingSeen] = useState(false);

  const canUse = useMemo(() => isSupabaseConfigured, []);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  // Load requests
  const loadRequests = async () => {
    if (!canUse) {
      setRequests([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const data = await getCustomerServiceRequests(
        statusFilter === 'all' ? undefined : statusFilter
      );
      setRequests(data);
      
      // Mark unseen pending requests as seen
      const unseenPending = data
        .filter(r => r.status === 'pending' && !r.adminSeenAt)
        .map(r => r.id);
      
      if (unseenPending.length > 0) {
        await markRequestsAsSeen(unseenPending);
      }
    } catch (error) {
      console.error('Error loading requests:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  // Filter, search and sort
  const filteredRequests = useMemo(() => {
    let result = requests;
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(r => 
        r.clientName.toLowerCase().includes(query) ||
        r.clientEmail.toLowerCase().includes(query) ||
        r.serviceType.toLowerCase().includes(query) ||
        (r.packName && r.packName.toLowerCase().includes(query))
      );
    }

    // Sort
    if (sortKey === 'date_desc' || sortKey === 'date_asc') {
      result = [...result].sort((a, b) => sortKey === 'date_desc'
        ? new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
        : new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());
    } else if (sortKey === 'client') {
      result = [...result].sort((a, b) => (a.clientName || '').localeCompare(b.clientName || ''));
    }
    
    return result;
  }, [requests, searchQuery, sortKey]);

  // Pagination logic
  const totalPages = Math.ceil(filteredRequests.length / ITEMS_PER_PAGE);
  const paginatedRequests = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredRequests.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredRequests, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter]);

  // Selection handlers
  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === paginatedRequests.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedRequests.map(r => r.id)));
    }
  };

  const allSelected = paginatedRequests.length > 0 && selectedIds.size === paginatedRequests.length;

  // Delete selected
  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    
    const ok = window.confirm(`Supprimer ${selectedIds.size} demande(s) ?`);
    if (!ok) return;

    setDeleting(true);
    try {
      const ids = Array.from(selectedIds);
      for (const id of ids) {
        await deleteCustomerServiceRequest(id);
      }
      setSelectedIds(new Set());
      await loadRequests();
    } catch (error) {
      console.error('Error deleting requests:', error);
      alert('Erreur lors de la suppression');
    } finally {
      setDeleting(false);
    }
  };

  // Mark as seen
  const handleMarkAsSeen = async () => {
    if (selectedIds.size === 0) return;
    
    setMarkingSeen(true);
    try {
      await markRequestsAsSeen(Array.from(selectedIds));
      await loadRequests();
    } catch (error) {
      console.error('Error marking as seen:', error);
    } finally {
      setMarkingSeen(false);
    }
  };

  // Format slots display
  const formatSlots = (slots: { date: string; startTime: string; endTime: string }[]) => {
    if (slots.length === 0) return '-';
    if (slots.length === 1) {
      return `${slots[0].date} ${slots[0].startTime}-${slots[0].endTime}`;
    }
    return `${slots.length} créneaux`;
  };

  // Count pending
  const pendingCount = requests.filter(r => r.status === 'pending').length;

  if (loading) {
    return (
      <div className="h-full w-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-brand-blue" />
      </div>
    );
  }

  return (
    <div className="h-full w-full overflow-y-auto p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="text-xs text-slate-500">Admin</div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-extrabold text-slate-800">Nouvelles demandes clients</h1>
          {pendingCount > 0 && (
            <span className="px-3 py-1 rounded-full bg-red-100 text-red-700 text-sm font-bold border border-red-200">
              {pendingCount} en attente
            </span>
          )}
        </div>
        <div className="text-xs text-slate-500 mt-1">
          Gérez les demandes de service soumises par les clients
        </div>
      </div>

      {/* ListingFilterBar — Filtres, tri et recherche */}
      <div className="mb-4">
        <ListingFilterBar
          searchValue={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder="Client, service, pack..."
          sortOptions={[
            { value: 'date_desc', label: 'Date récente' },
            { value: 'date_asc', label: 'Date ancienne' },
            { value: 'client', label: 'Client A-Z' },
          ]}
          sortValue={sortKey}
          onSortChange={(v) => setSortKey(v as any)}
          sortDirection={sortDirection}
          onSortDirectionToggle={() => setSortDirection((d: 'asc' | 'desc') => d === 'asc' ? 'desc' : 'asc')}
          filters={[
            {
              key: 'status',
              label: 'Statut',
              placeholder: 'Tous',
              options: [
                { value: 'pending', label: 'En attente' },
                { value: 'validated', label: 'Validée' },
                { value: 'rejected', label: 'Rejetée' },
                { value: 'cancelled', label: 'Annulée' },
              ],
            },
          ]}
          filterValues={{ status: statusFilter }}
          onFilterChange={(key, value) => {
            if (key === 'status') setStatusFilter(value as CustomerServiceRequestStatus | 'all');
          }}
          filteredCount={filteredRequests.length}
          totalCount={requests.length}
          entityLabel="demande(s)"
          onReset={() => {
            setSearchQuery('');
            setStatusFilter('all');
            setSortKey('date_desc');
            setSortDirection('desc');
          }}
          hasActiveFilters={searchQuery !== '' || statusFilter !== 'all' || sortKey !== 'date_desc'}
        />
      </div>

      {/* Bulk Actions */}
      {selectedIds.size > 0 && (
        <div className="mb-4 flex items-center gap-3 bg-white rounded-xl border border-slate-200 p-3">
          <span className="text-sm text-slate-600">{selectedIds.size} sélectionné(s)</span>
          <button
            onClick={handleMarkAsSeen}
            disabled={markingSeen}
            className="px-3 py-2 bg-brand-blue text-white rounded-xl text-xs font-bold hover:bg-teal-700 disabled:opacity-60 flex items-center gap-2"
          >
            {markingSeen ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
            Marquer comme vu
          </button>
          <button
            onClick={handleDeleteSelected}
            disabled={deleting}
            className="px-3 py-2 bg-red-600 text-white rounded-xl text-xs font-bold hover:bg-red-700 disabled:opacity-60 flex items-center gap-2"
          >
            {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            Supprimer
          </button>
        </div>
      )}

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr className="text-left text-slate-600">
                <th className="px-4 py-3 w-10">
                  <button 
                    onClick={toggleSelectAll}
                    className="flex items-center justify-center"
                  >
                    {allSelected ? (
                      <CheckSquare className="w-5 h-5 text-brand-blue" />
                    ) : (
                      <Square className="w-5 h-5 text-slate-400" />
                    )}
                  </button>
                </th>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Service</th>
                <th className="px-4 py-3">Pack</th>
                <th className="px-4 py-3">Créneaux demandés</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3">Date demande</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedRequests.map((request) => (
                <tr
                  key={request.id}
                  className={`border-t border-slate-100 hover:bg-slate-50/50 transition-colors ${
                    request.status === 'pending' && !request.adminSeenAt 
                      ? 'bg-blue-50/50' 
                      : ''
                  }`}
                >
                  <td className="px-4 py-3">
                    <button 
                      onClick={() => toggleSelection(request.id)}
                      className="flex items-center justify-center"
                    >
                      {selectedIds.has(request.id) ? (
                        <CheckSquare className="w-5 h-5 text-brand-blue" />
                      ) : (
                        <Square className="w-5 h-5 text-slate-400" />
                      )}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-slate-400" />
                      <div>
                        <div className="font-bold text-slate-800">{request.clientName}</div>
                        <div className="text-xs text-slate-500">{request.clientEmail}</div>
                        {request.clientPhone && (
                          <div className="text-xs text-slate-400">{request.clientPhone}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-medium text-slate-700">{request.serviceType}</span>
                  </td>
                  <td className="px-4 py-3">
                    {request.packName ? (
                      <div className="flex items-center gap-2">
                        <Package className="w-4 h-4 text-brand-orange" />
                        <span className="text-slate-700">{request.packName}</span>
                      </div>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-slate-400" />
                      <span className="text-slate-600">{formatSlots(request.requestedSlots)}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold border ${statusColors[request.status]}`}>
                      {statusLabelFr[request.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {new Date(request.createdAt).toLocaleDateString('fr-FR')}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => navigate(`/admin/service-requests/${request.id}`)}
                      className="inline-flex items-center gap-2 px-3 py-1.5 bg-brand-blue/10 text-brand-blue rounded-lg text-xs font-bold hover:bg-brand-blue/20 transition-colors"
                    >
                      <Eye className="w-4 h-4" />
                      Voir détail
                    </button>
                  </td>
                </tr>
              ))}

              {paginatedRequests.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-500">
                    <AlertCircle className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                    <p>Aucune demande trouvée</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
            <div className="text-xs text-slate-600">
              Page {currentPage} sur {totalPages} ({filteredRequests.length} total)
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 rounded-lg text-xs font-bold border bg-white text-slate-700 border-slate-200 hover:bg-slate-50 disabled:opacity-50"
              >
                Précédent
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
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
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 rounded-lg text-xs font-bold border bg-white text-slate-700 border-slate-200 hover:bg-slate-50 disabled:opacity-50"
              >
                Suivant
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Summary */}
      <div className="mt-4 flex items-center gap-6 text-sm text-slate-600">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-amber-400"></span>
          <span>{requests.filter(r => r.status === 'pending').length} en attente</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-emerald-400"></span>
          <span>{requests.filter(r => r.status === 'validated').length} validées</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-red-400"></span>
          <span>{requests.filter(r => r.status === 'rejected').length} rejetées</span>
        </div>
      </div>
    </div>
  );
};

export default AdminServiceRequestsPage;
