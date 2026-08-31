import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Calendar, CreditCard, MapPin, Package, User, Download, XCircle, RotateCcw, AlertTriangle, RefreshCw, CheckCircle2, Clock, ExternalLink } from 'lucide-react';
import dayjs from 'dayjs';
import { useData } from '../context/DataContext';
import type { Document } from '../types';
import { MARTINIQUE_TIMEZONE } from '../src/utils/dayjsMartinique';
import { getMartiniqueToday } from '../src/utils/martiniqueTime';
import { toast } from './mobile/Toast';
import { pdf } from '@react-pdf/renderer';
import { InvoicePDF, SplitInvoicePDF } from './PDFComponents';
import { LOGO_BASE64, LOGO_SAP_BASE64, SIGNATURE_BASE64, STAMP_SIGNATURE_BASE64 } from '../src/assets/images';

const formatEUR = (value: any) => {
  const v = Number(value);
  if (!Number.isFinite(v)) return '—';
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(v);
};

const getStatusStyle = (status?: string) => {
  const s = String(status || '').toLowerCase();
  if (s === 'paid') return 'bg-green-100 text-green-700 border-green-200';
  if (s === 'signed' || s === 'validated') return 'bg-blue-100 text-blue-700 border-blue-200';
  if (s === 'to_invoice') return 'bg-amber-100 text-amber-700 border-amber-200';
  if (s === 'sent') return 'bg-amber-100 text-amber-700 border-amber-200';
  if (s === 'expired' || s === 'rejected') return 'bg-red-100 text-red-700 border-red-200';
  return 'bg-slate-100 text-slate-700 border-slate-200';
};

const parseDescriptionMeta = (description?: string) => {
  const raw = String(description || '').trim();
  if (!raw) return { main: '', meta: {} as Record<string, string> };
  const parts = raw.split('|').map(p => p.trim()).filter(Boolean);
  const meta: Record<string, string> = {};
  const mainParts: string[] = [];
  for (const p of parts) {
    const idx = p.indexOf(':');
    if (idx > 0) {
      const key = p.slice(0, idx).trim().toLowerCase();
      const val = p.slice(idx + 1).trim();
      if (key && val) meta[key] = val; else mainParts.push(p);
    } else {
      mainParts.push(p);
    }
  }
  return { main: mainParts.join(' | '), meta };
};

const AdminDevisDetails: React.FC = () => {
  const navigate = useNavigate();
  const { devisId } = useParams();
  const { documents, clients, packs, missions, providers, getDocumentDetails, toggleSessionStatus, resyncMissionsFromDocument } = useData();
  const [loading, setLoading] = useState(false);
  const [doc, setDoc] = useState<Document | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [syncingPlanning, setSyncingPlanning] = useState(false);
  const [confirmCancelIdx, setConfirmCancelIdx] = useState<number | null>(null);

  useEffect(() => {
    const id = String(devisId || '').trim();
    if (!id) return;
    const local = documents.find(d => String(d.id) === id) || null;
    if (local) {
      setDoc(local);
      return;
    }
    let active = true;
    setLoading(true);
    getDocumentDetails(id).then((res) => { if (active) setDoc(res); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [devisId, documents, getDocumentDetails]);

  const client = useMemo(() => (doc?.clientId ? (clients.find(c => String(c.id) === String(doc.clientId)) || null) : null), [clients, doc?.clientId]);
  const pack = useMemo(() => (doc?.packId ? (packs.find(p => String(p.id) === String(doc.packId)) || null) : null), [packs, doc?.packId]);
  const parsed = useMemo(() => parseDescriptionMeta(doc?.description), [doc?.description]);
  const slots = useMemo(() => (Array.isArray((doc as any)?.slotsData) ? (doc as any).slotsData : (Array.isArray((doc as any)?.slots_data) ? (doc as any).slots_data : [])), [doc]);

  const handleSyncPlanning = async () => {
    if (!doc?.id) return;
    setSyncingPlanning(true);
    try {
      const res = await resyncMissionsFromDocument(doc.id);
      if (res.created > 0 && res.alreadyExist > 0) {
        toast.success(`${res.total} séances synchronisées (${res.created} créées, ${res.alreadyExist} existantes) au planning.`);
      } else if (res.created > 0) {
        toast.success(`${res.created} séance(s) ajoutée(s) au planning avec succès !`);
      } else {
        toast.success(`Toutes les ${res.alreadyExist || res.total} séances sont actives et visibles au planning.`);
      }
    } catch (err: any) {
      console.error('[AdminDevisDetails] Erreur synchronisation:', err);
      toast.error('Erreur lors de la synchronisation : ' + (err?.message || 'inconnue'));
    } finally {
      setSyncingPlanning(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!doc) return;
    setDownloading(true);
    try {
      const client = doc.clientId ? clients.find(c => String(c.id) === String(doc.clientId)) : null;
      const resolvedTvaRate = (() => {
        const raw = (doc as any)?.tvaRate;
        const n = typeof raw === 'number' ? raw : Number(raw);
        return Number.isFinite(n) ? n : 0;
      })();
      const logoBase64 = resolvedTvaRate === 0 ? LOGO_SAP_BASE64 : LOGO_BASE64;
      const packName = doc.packId ? (packs.find(p => String(p.id) === String(doc.packId))?.name || '') : '';
      const parentQuote = (doc as any).parentQuoteId ? documents.find(d => d.id === (doc as any).parentQuoteId) : null;

      const pdfData = {
        ref: doc.ref, date: doc.date,
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        paid: doc.status === 'paid', status: doc.status,
        tvaRate: resolvedTvaRate, taxCreditEnabled: !!(doc.hasTaxCredit || doc.taxCreditEnabled),
        clientName: client?.name || doc.clientName || '—',
        clientEmail: client?.email || '', clientPhone: client?.phone || '',
        companySignature: SIGNATURE_BASE64, companyStamp: STAMP_SIGNATURE_BASE64, logoBase64,
        subtotal: doc.totalHT || 0,
        tax: doc.totalTTC && doc.totalHT ? (doc.totalTTC - doc.totalHT) : 0,
        total: doc.totalTTC || 0,
        packId: doc.packId, packName,
        splitIndex: (doc as any).splitIndex, totalSplits: (doc as any).totalSplits,
        coveredSessions: (doc as any).coveredSessions, parentQuoteRef: parentQuote?.ref,
        items: [{ description: packName || doc.description || 'Service standard', quantity: 1, unitPrice: doc.totalHT || 0, total: doc.totalHT || 0 }],
        slotsData: slots,
        paymentInfo: 'Paiement par virement bancaire ou chèque. Délai de paiement: 30 jours.'
      };

      const isSplitInvoice = doc.type === 'Facture' && (doc as any).parentQuoteId;
      const PdfComponent = isSplitInvoice ? SplitInvoicePDF : InvoicePDF;
      const blob = await pdf(<PdfComponent doc={pdfData} packs={packs as any} />).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const sanitize = (v: any) => String(v || '').replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, ' ').trim();
      link.download = `${doc.type === 'Facture' ? 'Facture' : 'Devis'}_${sanitize(client?.name || doc.clientName || 'Client')}_${sanitize(doc.ref)}.pdf`;
      document.body.appendChild(link); link.click(); document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e) { console.error('PDF download error:', e); }
    finally { setDownloading(false); }
  };

  const title = doc?.type ? `${doc.type} ${doc.ref || ''}`.trim() : 'Détail devis';

  return (
    <div className="h-full overflow-y-auto p-6 md:p-8 bg-cream-50/50">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="flex items-start gap-3">
            <button type="button" onClick={() => navigate('/invoices', { state: { filter: 'devis' } })} className="p-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 transition" title="Retour" aria-label="Retour"><ArrowLeft className="w-5 h-5 text-slate-600" /></button>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl md:text-2xl font-serif font-bold text-slate-800">{title}</h1>
                {doc?.status ? <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${getStatusStyle(doc.status)}`}>{String(doc.status).toUpperCase()}</span> : null}
              </div>
              <p className="text-xs text-slate-500 mt-1">Détail complet & gestion des séances</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {doc ? (
              <button
                type="button"
                onClick={handleSyncPlanning}
                disabled={syncingPlanning}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-amber-500 text-white font-bold text-xs hover:bg-amber-600 transition shadow-sm disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncingPlanning ? 'animate-spin' : ''}`} />
                {syncingPlanning ? 'Synchronisation...' : 'Synchroniser planning'}
              </button>
            ) : null}
            {doc ? (
              <button
                type="button"
                onClick={() => navigate('/invoices', { state: { documentId: doc.id, filter: 'devis' } })}
                className="hidden sm:inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-blue text-white font-bold text-xs hover:opacity-95 transition"
              >
                <Package className="w-4 h-4" /> Ouvrir l’éditeur
              </button>
            ) : null}
          </div>
        </div>

        {loading && !doc ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 space-y-4"><div className="bg-white border border-slate-200 rounded-2xl p-5 animate-pulse h-40" /><div className="bg-white border border-slate-200 rounded-2xl p-5 animate-pulse h-72" /></div>
            <div className="lg:col-span-4 space-y-4"><div className="bg-white border border-slate-200 rounded-2xl p-5 animate-pulse h-56" /></div>
          </div>
        ) : null}

        {!loading && !doc ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center">
            <p className="text-slate-700 font-bold">Devis introuvable</p>
            <p className="text-sm text-slate-500 mt-1">Vérifie l’identifiant ou la synchronisation des données.</p>
            <button type="button" onClick={() => navigate('/invoices', { state: { filter: 'devis' } })} className="mt-4 px-4 py-2 rounded-xl bg-slate-900 text-white font-bold">Retour</button>
          </div>
        ) : null}

        {doc ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 space-y-6">
              <div className="bg-white border border-slate-200 rounded-2xl p-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex items-start gap-3"><div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center"><User className="w-5 h-5 text-slate-600" /></div><div><p className="text-xs text-slate-500 font-bold uppercase">Client</p><p className="text-sm font-bold text-slate-800">{doc.clientName || client?.name || '—'}</p><p className="text-xs text-slate-600 mt-1">{client?.address ? `${client.address}${client.city ? `, ${client.city}` : ''}` : (client?.city || '—')}</p><p className="text-xs text-slate-600">{client?.email || '—'}</p><p className="text-xs text-slate-600">{client?.phone || '—'}</p></div></div>
                  <div className="flex items-start gap-3"><div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center"><Calendar className="w-5 h-5 text-slate-600" /></div><div><p className="text-xs text-slate-500 font-bold uppercase">Date</p><p className="text-sm font-bold text-slate-800">{doc.date ? dayjs.tz(doc.date, 'YYYY-MM-DD', MARTINIQUE_TIMEZONE).format('DD/MM/YYYY') : '—'}</p><p className="text-xs text-slate-600 mt-1">Référence: {doc.ref || '—'}</p><p className="text-xs text-slate-600">Type de service: {(doc as any)?.serviceType || '—'}</p></div></div>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2"><Package className="w-4 h-4 text-slate-500" /><h2 className="text-sm font-bold text-slate-800">Prestation</h2></div>
                <div className="p-5 space-y-4">
                  {pack ? (
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4"><p className="text-xs text-slate-500 font-bold uppercase">Pack</p><p className="text-sm font-bold text-slate-800 mt-1">{pack.name}</p><p className="text-xs text-slate-600 mt-1">{pack.description || '—'}</p><div className="mt-3 grid grid-cols-2 gap-3 text-xs"><div className="bg-white border border-slate-200 rounded-lg p-3"><p className="text-slate-500 font-bold">Service</p><p className="text-slate-800 font-bold mt-1">{pack.mainService || '—'}</p></div><div className="bg-white border border-slate-200 rounded-lg p-3"><p className="text-slate-500 font-bold">Heures</p><p className="text-slate-800 font-bold mt-1">{Number.isFinite(Number(pack.hours)) ? `${pack.hours}h` : '—'}</p></div></div></div>
                  ) : (
                    <div><p className="text-xs text-slate-500 font-bold uppercase">Description</p><p className="text-sm text-slate-800 mt-1 whitespace-pre-wrap">{parsed.main || doc.description || '—'}</p></div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4"><p className="text-xs font-bold text-slate-500">Lieu</p><p className="text-sm font-bold text-slate-800 mt-1 flex items-center gap-2"><MapPin className="w-4 h-4 text-slate-500" />{parsed.meta['lieu'] || client?.address || '—'}</p></div>
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4"><p className="text-xs font-bold text-slate-500">Durée</p><p className="text-sm font-bold text-slate-800 mt-1">{parsed.meta['durée'] || parsed.meta['duree'] || '—'}</p></div>
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4"><p className="text-xs font-bold text-slate-500">TVA</p><p className="text-sm font-bold text-slate-800 mt-1">{doc.tvaRate != null ? `${doc.tvaRate}%` : '—'}</p></div>
                  </div>

                  {slots.length > 0 ? (
                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                      <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-slate-600" />
                          <p className="text-xs font-bold text-slate-800">Séances du devis ({slots.length} séance{slots.length > 1 ? 's' : ''})</p>
                        </div>
                        <button
                          type="button"
                          onClick={handleSyncPlanning}
                          disabled={syncingPlanning}
                          className="text-[11px] font-bold text-brand-blue hover:underline flex items-center gap-1"
                        >
                          <RefreshCw className={`w-3 h-3 ${syncingPlanning ? 'animate-spin' : ''}`} />
                          Synchroniser les séances
                        </button>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                          <thead className="text-xs text-slate-500 bg-white border-b border-slate-200">
                            <tr>
                              <th className="text-left px-4 py-3 font-bold">Séance</th>
                              <th className="text-left px-4 py-3 font-bold">Date</th>
                              <th className="text-left px-4 py-3 font-bold">Créneau</th>
                              <th className="text-left px-4 py-3 font-bold">Durée</th>
                              <th className="text-left px-4 py-3 font-bold">Prestataire</th>
                              <th className="text-left px-4 py-3 font-bold">Statut</th>
                              <th className="text-right px-4 py-3 font-bold">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {slots.map((s: any, idx: number) => {
                              const sessionStatus = s?.sessionStatus || 'planned';
                              const isCancelled = sessionStatus === 'cancelled';
                              const isInvoiced = sessionStatus === 'invoiced';
                              const isToInvoice = sessionStatus === 'to_invoice';
                              const today = getMartiniqueToday();
                              const isDatePassed = s?.date ? s.date < today : false;
                              const isRealized = isDatePassed && !isCancelled && !isInvoiced && !isToInvoice;

                              // Matching mission in state
                              const matchedMission = missions.find(m =>
                                (m.sourceDocumentId === doc.id && m.date === s.date) ||
                                (doc.clientId && m.clientId === doc.clientId && m.date === s.date && (m.startTime === s.startTime || String(m.startTime || '').startsWith(s.startTime)))
                              );

                              const providerDisplay = matchedMission?.providerName && matchedMission.providerName !== 'À assigner'
                                ? matchedMission.providerName
                                : 'À assigner';

                              const statusBadge = isCancelled
                                ? 'bg-red-100 text-red-700 border-red-200'
                                : isInvoiced
                                ? 'bg-green-100 text-green-700 border-green-200'
                                : isToInvoice
                                ? 'bg-amber-100 text-amber-700 border-amber-200'
                                : isRealized
                                ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                                : 'bg-blue-100 text-blue-700 border-blue-200';
                              const statusLabel = isCancelled ? 'Annulée' : isInvoiced ? 'Facturée' : isToInvoice ? 'À facturer' : isRealized ? 'Réalisée' : 'Planifiée';

                              return (
                                <tr key={idx} className={`border-t border-slate-100 hover:bg-slate-50/80 transition ${isCancelled ? 'bg-red-50/50 opacity-60' : ''}`}>
                                  <td className="px-4 py-3 text-slate-700 font-bold text-xs">
                                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-700 text-[11px] font-bold">
                                      {idx + 1}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-slate-800 font-bold">
                                    {s?.date ? (
                                      <div>
                                        <span>{dayjs.tz(String(s.date), 'YYYY-MM-DD', MARTINIQUE_TIMEZONE).format('DD/MM/YYYY')}</span>
                                        <span className="block text-[10px] text-slate-500 font-normal capitalize">
                                          {dayjs.tz(String(s.date), 'YYYY-MM-DD', MARTINIQUE_TIMEZONE).format('dddd')}
                                        </span>
                                      </div>
                                    ) : '—'}
                                  </td>
                                  <td className="px-4 py-3 text-slate-700 font-medium">
                                    {s?.startTime || '—'} - {s?.endTime || '—'}
                                  </td>
                                  <td className="px-4 py-3 text-slate-700 font-medium">
                                    {Number.isFinite(Number(s?.duration)) ? `${Number(s.duration).toFixed(1)}h` : '—'}
                                  </td>
                                  <td className="px-4 py-3">
                                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${providerDisplay !== 'À assigner' ? 'bg-slate-100 text-slate-800 font-bold' : 'bg-amber-50 text-amber-800 border border-amber-200'}`}>
                                      {providerDisplay}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3">
                                    <span className={`text-xs font-bold px-2 py-1 rounded-full border ${statusBadge}`}>
                                      {statusLabel}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-right">
                                    <div className="flex items-center justify-end gap-1">
                                      <button
                                        type="button"
                                        onClick={() => navigate('/planning')}
                                        className="p-1.5 rounded-lg text-slate-500 hover:text-brand-blue hover:bg-slate-100 transition"
                                        title="Voir au planning"
                                        aria-label="Voir au planning"
                                      >
                                        <Calendar className="w-4 h-4" />
                                      </button>
                                      {doc.status === 'signed' ? (
                                        confirmCancelIdx === idx ? (
                                          <div className="flex items-center gap-1">
                                            <button type="button" onClick={() => { toggleSessionStatus(doc.id, idx, isCancelled ? 'planned' : 'cancelled'); setConfirmCancelIdx(null); }} className="px-2 py-1 rounded text-xs font-bold bg-red-600 text-white hover:bg-red-700 transition" title="Confirmer">Confirmer</button>
                                            <button type="button" onClick={() => setConfirmCancelIdx(null)} className="px-2 py-1 rounded text-xs font-bold bg-slate-200 text-slate-700 hover:bg-slate-300 transition" title="Annuler">Non</button>
                                          </div>
                                        ) : (
                                          <button type="button" onClick={() => setConfirmCancelIdx(idx)} className={`px-2 py-1 rounded text-xs font-bold transition flex items-center gap-1 ${isCancelled ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-red-100 text-red-700 hover:bg-red-200'}`} title={isCancelled ? 'Rétablir' : 'Marquer non réalisée'}>
                                            {isCancelled ? <RotateCcw className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                                            {isCancelled ? 'Rétablir' : 'Annuler'}
                                          </button>
                                        )
                                      ) : null}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-slate-400 italic">Aucun créneau enregistré sur ce devis.</div>
                  )}
                </div>
              </div>
            </div>

            <div className="lg:col-span-4 space-y-6">
              <div className="bg-white border border-slate-200 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-4"><CreditCard className="w-4 h-4 text-slate-500" /><h2 className="text-sm font-bold text-slate-800">Résumé</h2></div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm"><span className="text-slate-500 font-bold">Total HT</span><span className="text-slate-800 font-bold">{formatEUR(doc.totalHT)}</span></div>
                  <div className="flex items-center justify-between text-sm"><span className="text-slate-500 font-bold">TVA</span><span className="text-slate-800 font-bold">{doc.tvaRate != null ? `${doc.tvaRate}%` : '—'}</span></div>
                  <div className="flex items-center justify-between text-sm"><span className="text-slate-500 font-bold">Total TTC</span><span className="text-slate-900 font-bold text-lg">{formatEUR(doc.totalTTC)}</span></div>
                  <div className="h-px bg-slate-100 my-3" />
                  <div className="flex items-center justify-between text-sm"><span className="text-slate-500 font-bold">Crédit d’impôt</span><span className={`font-bold ${doc.taxCreditEnabled ? 'text-green-700' : 'text-slate-700'}`}>{doc.taxCreditEnabled ? 'Oui' : 'Non'}</span></div>
                  <div className="flex items-center justify-between text-sm"><span className="text-slate-500 font-bold">Fréquence</span><span className="text-slate-800 font-bold">{(doc as any)?.frequency || '—'}</span></div>
                  <div className="flex items-center justify-between text-sm"><span className="text-slate-500 font-bold">Fin récurrence</span><span className="text-slate-800 font-bold">{(doc as any)?.recurrenceEndDate || '—'}</span></div>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-5">
                <h3 className="text-sm font-bold text-slate-800">Actions</h3>
                <div className="mt-3 flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={handleSyncPlanning}
                    disabled={syncingPlanning}
                    className="w-full px-4 py-2.5 rounded-xl bg-amber-500 text-white font-bold text-xs hover:bg-amber-600 transition disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
                  >
                    <RefreshCw className={`w-4 h-4 ${syncingPlanning ? 'animate-spin' : ''}`} />
                    {syncingPlanning ? 'Synchronisation...' : 'Synchroniser les séances au planning'}
                  </button>
                  <button type="button" onClick={handleDownloadPdf} disabled={downloading} className="w-full px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-700 transition disabled:opacity-50 flex items-center justify-center gap-2">
                    {downloading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Download className="w-4 h-4" />}
                    {downloading ? 'Génération...' : 'Télécharger PDF'}
                  </button>
                  <button type="button" onClick={() => navigate('/invoices', { state: { documentId: doc.id, filter: 'devis' } })} className="w-full px-4 py-2 rounded-xl bg-slate-900 text-white font-bold text-xs hover:opacity-95 transition">Ouvrir dans Devis/Factures</button>
                  <button type="button" onClick={() => navigate('/planning')} className="w-full px-4 py-2 rounded-xl bg-slate-100 text-slate-800 font-bold text-xs hover:bg-slate-200 transition">Aller au planning</button>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default AdminDevisDetails;
