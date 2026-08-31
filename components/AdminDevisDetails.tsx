import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Calendar, CreditCard, MapPin, Package, User, Download, XCircle, RotateCcw, RefreshCw, CheckCircle2, Clock } from 'lucide-react';
import dayjs from 'dayjs';
import 'dayjs/locale/fr';
import { useData } from '../context/DataContext';
import type { Document } from '../types';
import { MARTINIQUE_TIMEZONE } from '../src/utils/dayjsMartinique';
import { getMartiniqueToday } from '../src/utils/martiniqueTime';
import { pdf } from '@react-pdf/renderer';
import { InvoicePDF, SplitInvoicePDF } from './PDFComponents';
import { LOGO_BASE64, LOGO_SAP_BASE64, SIGNATURE_BASE64, STAMP_SIGNATURE_BASE64 } from '../src/assets/images';
import { toast } from './mobile/Toast';

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
  const { documents, clients, packs, missions, getDocumentDetails, toggleSessionStatus, resyncMissionsFromDocument } = useData();
  const [loading, setLoading] = useState(false);
  const [doc, setDoc] = useState<Document | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [resyncing, setResyncing] = useState(false);
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
  
  const slots = useMemo(() => {
    const raw = Array.isArray((doc as any)?.slotsData)
      ? (doc as any).slotsData
      : Array.isArray((doc as any)?.slots_data)
      ? (doc as any).slots_data
      : [];
    return [...raw].sort((a: any, b: any) => {
      const cmpDate = String(a?.date || '').localeCompare(String(b?.date || ''));
      if (cmpDate !== 0) return cmpDate;
      return String(a?.startTime || '').localeCompare(String(b?.startTime || ''));
    });
  }, [doc]);

  const totalSlotsHours = useMemo(() => {
    return slots.reduce((acc: number, s: any) => acc + (Number(s?.duration) || 0), 0);
  }, [slots]);

  const handleResyncPlanning = async () => {
    if (!doc?.id) return;
    setResyncing(true);
    try {
      const res = await resyncMissionsFromDocument(doc.id);
      toast.success(`${res.created} mission(s) créée(s) · ${res.alreadyExist} déjà présente(s) au planning`);
    } catch (err: any) {
      toast.error(err?.message || 'Erreur lors de la synchronisation');
    } finally {
      setResyncing(false);
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
                {doc?.status ? <span className={`text-xs font-bold px-2 py-1 rounded-full border ${getStatusStyle(doc.status)}`}>{String(doc.status).toUpperCase()}</span> : null}
              </div>
              <p className="text-xs text-slate-500 mt-1">Détail complet et calendrier des séances (admin)</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {doc ? (
              <button 
                type="button" 
                onClick={handleResyncPlanning} 
                disabled={resyncing}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500 text-white font-bold text-xs hover:bg-amber-600 transition shadow-sm disabled:opacity-50"
                title="Créer ou vérifier les missions de ce devis dans le planning"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${resyncing ? 'animate-spin' : ''}`} />
                <span>Synchroniser planning</span>
              </button>
            ) : null}
            {doc ? <button type="button" onClick={() => navigate('/invoices', { state: { documentId: doc.id, filter: 'devis' } })} className="hidden sm:inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-blue text-white font-bold hover:opacity-95 transition text-xs"><Package className="w-4 h-4" />Ouvrir l’éditeur</button> : null}
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
                  <div className="flex items-start gap-3"><div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center"><Calendar className="w-5 h-5 text-slate-600" /></div><div><p className="text-xs text-slate-500 font-bold uppercase">Date & Réf</p><p className="text-sm font-bold text-slate-800">{doc.date ? dayjs.tz(doc.date, 'YYYY-MM-DD', MARTINIQUE_TIMEZONE).format('DD/MM/YYYY') : '—'}</p><p className="text-xs text-slate-600 mt-1">Référence: {doc.ref || '—'}</p><p className="text-xs text-slate-600">Type de service: {(doc as any)?.serviceType || '—'}</p></div></div>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-slate-500" />
                    <h2 className="text-sm font-bold text-slate-800">Prestation & Séances détaillées</h2>
                  </div>
                  {slots.length > 0 && (
                    <span className="text-xs font-bold text-brand-blue bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-full">
                      {slots.length} séance(s) · {totalSlotsHours.toFixed(1)}h total
                    </span>
                  )}
                </div>
                <div className="p-5 space-y-4">
                  {pack ? (
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4"><p className="text-xs text-slate-500 font-bold uppercase">Pack</p><p className="text-sm font-bold text-slate-800 mt-1">{pack.name}</p><p className="text-xs text-slate-600 mt-1">{pack.description || '—'}</p><div className="mt-3 grid grid-cols-2 gap-3 text-xs"><div className="bg-white border border-slate-200 rounded-lg p-3"><p className="text-slate-500 font-bold">Service</p><p className="text-slate-800 font-bold mt-1">{pack.mainService || '—'}</p></div><div className="bg-white border border-slate-200 rounded-lg p-3"><p className="text-slate-500 font-bold">Heures</p><p className="text-slate-800 font-bold mt-1">{Number.isFinite(Number(pack.hours)) ? `${pack.hours}h` : '—'}</p></div></div></div>
                  ) : (
                    <div><p className="text-xs text-slate-500 font-bold uppercase">Description</p><p className="text-sm text-slate-800 mt-1 whitespace-pre-wrap">{parsed.main || doc.description || '—'}</p></div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4"><p className="text-xs font-bold text-slate-500">Lieu</p><p className="text-sm font-bold text-slate-800 mt-1 flex items-center gap-2"><MapPin className="w-4 h-4 text-slate-500" />{parsed.meta['lieu'] || client?.address || '—'}</p></div>
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4"><p className="text-xs font-bold text-slate-500">Durée totale</p><p className="text-sm font-bold text-slate-800 mt-1 flex items-center gap-2"><Clock className="w-4 h-4 text-slate-500" />{totalSlotsHours > 0 ? `${totalSlotsHours}h` : (parsed.meta['durée'] || parsed.meta['duree'] || '—')}</p></div>
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4"><p className="text-xs font-bold text-slate-500">TVA</p><p className="text-sm font-bold text-slate-800 mt-1">{doc.tvaRate != null ? `${doc.tvaRate}%` : '—'}</p></div>
                  </div>

                  {slots.length > 0 ? (
                    <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                      <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                        <p className="text-xs font-bold text-slate-700">Toutes les séances du devis selon les dates</p>
                        <span className="text-[11px] text-slate-500">Classées par ordre chronologique</span>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                          <thead className="text-xs text-slate-500 bg-white">
                            <tr>
                              <th className="text-left px-4 py-3 font-bold">#</th>
                              <th className="text-left px-4 py-3 font-bold">Date de prestation</th>
                              <th className="text-left px-4 py-3 font-bold">Horaires</th>
                              <th className="text-left px-4 py-3 font-bold">Durée</th>
                              <th className="text-left px-4 py-3 font-bold">Prestataire au planning</th>
                              <th className="text-left px-4 py-3 font-bold">Statut séance</th>
                              {doc.status === 'signed' ? <th className="text-left px-4 py-3 font-bold">Action</th> : null}
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
                              
                              // Find corresponding planning mission
                              const matchingMission = (missions || []).find((m: any) => 
                                (m.sourceDocumentId === doc.id || (m as any).source_document_id === doc.id || (m.clientId === doc.clientId)) &&
                                m.date === s.date &&
                                m.startTime === s.startTime &&
                                m.status !== 'cancelled'
                              );

                              const assignedProviderName = matchingMission?.providerName || (matchingMission?.providerId ? 'Assigné' : 'À assigner');

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

                              const formattedDate = s?.date 
                                ? dayjs.tz(String(s.date), 'YYYY-MM-DD', MARTINIQUE_TIMEZONE).locale('fr').format('dddd D MMMM YYYY')
                                : '—';

                              return (
                                <tr key={idx} className={`border-t border-slate-100 hover:bg-slate-50/80 transition ${isCancelled ? 'bg-red-50/50 opacity-60' : ''}`}>
                                  <td className="px-4 py-3 font-mono text-xs text-slate-400 font-bold">Séance {idx + 1}</td>
                                  <td className="px-4 py-3 text-slate-800 font-bold capitalize">{formattedDate}</td>
                                  <td className="px-4 py-3 text-slate-700 font-semibold">{s?.startTime || '—'} à {s?.endTime || '—'}</td>
                                  <td className="px-4 py-3 text-slate-700">{Number.isFinite(Number(s?.duration)) ? `${Number(s.duration).toFixed(1)}h` : '—'}</td>
                                  <td className="px-4 py-3">
                                    <span className={`text-xs font-semibold px-2 py-0.5 rounded ${matchingMission?.providerId ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                                      {assignedProviderName}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3"><span className={`text-xs font-bold px-2 py-1 rounded-full border ${statusBadge}`}>{statusLabel}</span></td>
                                  {doc.status === 'signed' ? (
                                    <td className="px-4 py-3">
                                      {confirmCancelIdx === idx ? (
                                        <div className="flex items-center gap-1">
                                          <button type="button" onClick={() => { toggleSessionStatus(doc.id, idx, isCancelled ? 'planned' : 'cancelled'); setConfirmCancelIdx(null); }} className="px-2 py-1 rounded text-xs font-bold bg-red-600 text-white hover:bg-red-700 transition" title="Confirmer">Confirmer</button>
                                          <button type="button" onClick={() => setConfirmCancelIdx(null)} className="px-2 py-1 rounded text-xs font-bold bg-slate-200 text-slate-700 hover:bg-slate-300 transition" title="Annuler">Non</button>
                                        </div>
                                      ) : (
                                        <button type="button" onClick={() => setConfirmCancelIdx(idx)} className={`px-2 py-1 rounded text-xs font-bold transition flex items-center gap-1 ${isCancelled ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-red-100 text-red-700 hover:bg-red-200'}`} title={isCancelled ? 'Rétablir' : 'Marquer non réalisée'}>
                                          {isCancelled ? <RotateCcw className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                                          {isCancelled ? 'Rétablir' : 'Annuler'}
                                        </button>
                                      )}
                                    </td>
                                  ) : null}
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-slate-400 italic bg-slate-50 p-4 rounded-xl border border-slate-200">
                      Aucun créneau enregistré sur ce devis.
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="lg:col-span-4 space-y-6">
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <CreditCard className="w-4 h-4 text-slate-500" />
                  <h2 className="text-sm font-bold text-slate-800">Résumé financier</h2>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm"><span className="text-slate-500 font-bold">Total HT</span><span className="text-slate-800 font-bold">{formatEUR(doc.totalHT)}</span></div>
                  <div className="flex items-center justify-between text-sm"><span className="text-slate-500 font-bold">TVA</span><span className="text-slate-800 font-bold">{doc.tvaRate != null ? `${doc.tvaRate}%` : '—'}</span></div>
                  <div className="flex items-center justify-between text-sm"><span className="text-slate-500 font-bold">Total TTC</span><span className="text-slate-900 font-bold text-lg">{formatEUR(doc.totalTTC)}</span></div>
                  <div className="h-px bg-slate-100 my-3" />
                  <div className="flex items-center justify-between text-sm"><span className="text-slate-500 font-bold">Nombre de séances</span><span className="text-slate-800 font-bold">{slots.length}</span></div>
                  <div className="flex items-center justify-between text-sm"><span className="text-slate-500 font-bold">Total d'heures</span><span className="text-slate-800 font-bold">{totalSlotsHours}h</span></div>
                  <div className="flex items-center justify-between text-sm"><span className="text-slate-500 font-bold">Crédit d’impôt</span><span className={`font-bold ${doc.taxCreditEnabled ? 'text-green-700' : 'text-slate-700'}`}>{doc.taxCreditEnabled ? 'Oui (50%)' : 'Non'}</span></div>
                  <div className="flex items-center justify-between text-sm"><span className="text-slate-500 font-bold">Fréquence</span><span className="text-slate-800 font-bold">{(doc as any)?.frequency || 'Ponctuelle'}</span></div>
                  {(doc as any)?.recurrenceEndDate && (
                    <div className="flex items-center justify-between text-sm"><span className="text-slate-500 font-bold">Fin récurrence</span><span className="text-slate-800 font-bold">{(doc as any).recurrenceEndDate}</span></div>
                  )}
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                <h3 className="text-sm font-bold text-slate-800">Actions rapides</h3>
                <div className="mt-3 flex flex-col gap-2.5">
                  <button type="button" onClick={handleDownloadPdf} disabled={downloading} className="w-full px-4 py-2.5 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 transition disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm text-xs">
                    {downloading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Download className="w-4 h-4" />}
                    {downloading ? 'Génération...' : 'Télécharger le Devis PDF'}
                  </button>
                  <button type="button" onClick={handleResyncPlanning} disabled={resyncing} className="w-full px-4 py-2.5 rounded-xl bg-amber-500 text-white font-bold hover:bg-amber-600 transition disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm text-xs">
                    <RefreshCw className={`w-4 h-4 ${resyncing ? 'animate-spin' : ''}`} />
                    Synchroniser avec le Planning
                  </button>
                  <button type="button" onClick={() => navigate('/planning')} className="w-full px-4 py-2.5 rounded-xl bg-slate-100 text-slate-800 font-bold hover:bg-slate-200 transition text-xs flex items-center justify-center gap-2">
                    <Calendar className="w-4 h-4 text-slate-500" />
                    Voir sur le Planning
                  </button>
                  <button type="button" onClick={() => navigate('/invoices', { state: { documentId: doc.id, filter: 'devis' } })} className="w-full px-4 py-2.5 rounded-xl bg-slate-900 text-white font-bold hover:opacity-95 transition text-xs">
                    Éditer dans Devis/Factures
                  </button>
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
