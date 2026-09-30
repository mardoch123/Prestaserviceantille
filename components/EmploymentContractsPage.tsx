/**
 * ============================================================
 *  EmploymentContractsPage.tsx — Administration des contrats de
 *  travail des prestataires salariés (CDI/CDD).
 *
 *  - Liste filtrable/triable (ListingFilterBar) avec stats rapides
 *  - Fiche détaillée avec aperçu PDF (rendu @react-pdf/renderer)
 *  - Actions : créer / modifier / envoyer par email / télécharger /
 *    téléverser le scan signé / rompre / supprimer
 * ============================================================
 */

import React, { useMemo, useRef, useState } from 'react';
import {
    FileSignature,
    Plus,
    Eye,
    Pencil,
    Trash2,
    Send,
    Download,
    Loader2,
    Paperclip,
    AlertTriangle,
    X,
    Users,
    FileText,
    CheckCircle2,
} from 'lucide-react';
import { PDFViewer } from '@react-pdf/renderer';
import { useData } from '../context/DataContext';
import { toast } from './mobile/Toast';
import ListingFilterBar, { FilterConfig, SortOption } from './ListingFilterBar';
import EmploymentContractFormModal from './EmploymentContractFormModal';
import { EmploymentContractPDF } from './PDFComponents';
import { EmploymentContract, EmploymentContractStatus } from '../types';
import { formatMartiniqueDate } from '../src/utils/martiniqueTime';

const DAY_LABELS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

const STATUS_META: Record<EmploymentContractStatus, { label: string; cls: string }> = {
    draft: { label: 'Brouillon', cls: 'bg-amber-100 text-amber-700 border-amber-200' },
    active: { label: 'Actif', cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
    terminated: { label: 'Rompu', cls: 'bg-red-100 text-red-700 border-red-200' },
};

const fmtEur = (n: number | undefined | null) =>
    `${Number(n ?? 0).toFixed(2).replace('.', ',')} €`;

const fmtHours = (n: number | undefined | null) => {
    const v = Number(n ?? 0);
    return `${Number.isInteger(v) ? v : v.toFixed(2).replace('.', ',')} h`;
};

const EmploymentContractsPage: React.FC = () => {
    const {
        employmentContracts,
        providers,
        deleteEmploymentContract,
        downloadEmploymentContractPdf,
        getEmploymentContractPdfUrl,
        sendEmploymentContract,
        updateEmploymentContract,
        uploadEmploymentContractSignedScan,
    } = useData();

    const [search, setSearch] = useState('');
    const [sortValue, setSortValue] = useState('created_desc');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
    const [filters, setFilters] = useState<Record<string, string | string[]>>({ status: 'all', type: 'all' });

    const [formOpen, setFormOpen] = useState(false);
    const [editing, setEditing] = useState<EmploymentContract | null>(null);
    const [selected, setSelected] = useState<EmploymentContract | null>(null);
    const [showPdfPreview, setShowPdfPreview] = useState(false);
    const [busyAction, setBusyAction] = useState<string | null>(null);
    const scanInputRef = useRef<HTMLInputElement>(null);

    // Toujours lire la version la plus fraîche du state (après save/envoi)
    const liveSelected = useMemo(
        () => (selected ? (employmentContracts || []).find(c => c.id === selected.id) || selected : null),
        [selected, employmentContracts]
    );

    // ---- Filtres / tri ----
    const sortOptions: SortOption[] = [
        { value: 'created_desc', label: 'Date de création' },
        { value: 'name', label: 'Nom salarié' },
        { value: 'startDate', label: 'Prise d\'effet' },
        { value: 'monthlyGross', label: 'Salaire brut' },
    ];

    const filterConfigs: FilterConfig[] = [
        { key: 'status', label: 'Statut', options: [{ value: 'all', label: 'Tous' }, { value: 'draft', label: 'Brouillon' }, { value: 'active', label: 'Actif' }, { value: 'terminated', label: 'Rompu' }] },
        { key: 'type', label: 'Type', options: [{ value: 'all', label: 'Tous' }, { value: 'cdi', label: 'CDI' }, { value: 'cdd', label: 'CDD' }] },
    ];

    const filtered = useMemo(() => {
        let list = [...(employmentContracts || [])];
        const q = search.trim().toLowerCase();
        if (q) {
            list = list.filter(c =>
                `${c.employeeFirstName} ${c.employeeLastName}`.toLowerCase().includes(q) ||
                (c.employeeEmail || '').toLowerCase().includes(q) ||
                (c.jobTitle || '').toLowerCase().includes(q)
            );
        }
        const status = String(filters.status || 'all');
        if (status !== 'all') list = list.filter(c => c.status === status);
        const type = String(filters.type || 'all');
        if (type !== 'all') list = list.filter(c => (c.contractType || 'cdi') === type);

        const dir = sortDirection === 'asc' ? 1 : -1;
        list.sort((a, b) => {
            switch (sortValue) {
                case 'name': return dir * a.employeeLastName.localeCompare(b.employeeLastName);
                case 'startDate': return dir * String(a.startDate).localeCompare(String(b.startDate));
                case 'monthlyGross': return dir * (Number(a.monthlyGross || 0) - Number(b.monthlyGross || 0));
                default: return dir * (String(a.createdAt || '').localeCompare(String(b.createdAt || '')));
            }
        });
        return list;
    }, [employmentContracts, search, filters, sortValue, sortDirection]);

    const stats = useMemo(() => {
        const all = employmentContracts || [];
        return {
            total: all.length,
            active: all.filter(c => c.status === 'active').length,
            draft: all.filter(c => c.status === 'draft').length,
            terminated: all.filter(c => c.status === 'terminated').length,
        };
    }, [employmentContracts]);

    // ---- Actions ----
    const handleDelete = async (contract: EmploymentContract) => {
        const ok = window.confirm(
            `Supprimer définitivement le contrat de ${contract.employeeFirstName} ${contract.employeeLastName} ? ` +
            'Le PDF et le scan signé associés seront aussi supprimés.'
        );
        if (!ok) return;
        setBusyAction(`delete-${contract.id}`);
        try {
            await deleteEmploymentContract(contract.id);
            toast.success('Contrat supprimé.');
            if (selected?.id === contract.id) setSelected(null);
        } catch (e: any) {
            toast.error(e?.message || 'Erreur lors de la suppression.');
        } finally {
            setBusyAction(null);
        }
    };

    const handleSend = async (contract: EmploymentContract) => {
        setBusyAction(`send-${contract.id}`);
        try {
            await sendEmploymentContract(contract);
            toast.success('Contrat envoyé au prestataire (email + notification).');
        } catch (e: any) {
            console.error('[EmploymentContracts] envoi échoué:', e);
            toast.error(e?.message || "Erreur lors de l'envoi du contrat.");
        } finally {
            setBusyAction(null);
        }
    };

    const handleDownload = async (contract: EmploymentContract) => {
        setBusyAction(`dl-${contract.id}`);
        try {
            await downloadEmploymentContractPdf(contract);
        } catch (e: any) {
            toast.error(e?.message || 'Erreur lors de la génération du PDF.');
        } finally {
            setBusyAction(null);
        }
    };

    const handleScanUpload = async (file: File) => {
        if (!liveSelected) return;
        setBusyAction(`scan-${liveSelected.id}`);
        try {
            await uploadEmploymentContractSignedScan(liveSelected, file);
            toast.success('Scan du contrat signé téléversé.');
        } catch (e: any) {
            toast.error(e?.message || "Erreur lors de l'upload du scan.");
        } finally {
            setBusyAction(null);
        }
    };

    const handleTerminate = async (contract: EmploymentContract) => {
        const date = window.prompt('Date de fin du contrat (YYYY-MM-DD) :', new Date().toISOString().slice(0, 10));
        if (!date) return;
        const reason = window.prompt('Motif de la rupture :', 'Démission') || 'Non précisé';
        setBusyAction(`term-${contract.id}`);
        try {
            await updateEmploymentContract(contract.id, {
                status: 'terminated',
                terminationDate: date,
                terminationReason: reason,
            });
            toast.success('Contrat marqué comme rompu.');
        } catch (e: any) {
            toast.error(e?.message || 'Erreur lors de la rupture du contrat.');
        } finally {
            setBusyAction(null);
        }
    };

    const openEdit = (contract: EmploymentContract) => {
        setEditing(contract);
        setFormOpen(true);
    };

    const openCreate = () => {
        setEditing(null);
        setFormOpen(true);
    };

    const providerName = (id?: string | null) => {
        if (!id) return null;
        const p = (providers || []).find(pr => pr.id === id);
        return p ? `${p.firstName} ${p.lastName}` : null;
    };

    return (
        <div className="p-4 md:p-8 h-full overflow-y-auto bg-white/40 relative">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
                <div>
                    <h2 className="text-3xl font-serif font-bold text-slate-800 flex items-center gap-3">
                        <FileSignature className="w-8 h-8 text-brand-blue" />
                        Contrats de Travail
                    </h2>
                    <p className="text-sm text-slate-500">CDI / CDD des prestataires salariés — rédaction, envoi et archivage des contrats signés</p>
                </div>
                <button
                    onClick={openCreate}
                    className="bg-brand-blue text-white px-5 py-2.5 rounded-lg font-bold hover:bg-teal-700 transition flex items-center gap-2 shadow-sm self-start md:self-auto"
                >
                    <Plus className="w-4 h-4" /> Nouveau contrat
                </button>
            </div>

            {/* Stats rapides */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                {[
                    { label: 'Total', value: stats.total, icon: FileText, color: 'text-brand-blue bg-blue-50' },
                    { label: 'Actifs', value: stats.active, icon: CheckCircle2, color: 'text-emerald-600 bg-emerald-50' },
                    { label: 'Brouillons', value: stats.draft, icon: AlertTriangle, color: 'text-amber-600 bg-amber-50' },
                    { label: 'Rompus', value: stats.terminated, icon: X, color: 'text-red-500 bg-red-50' },
                ].map(s => (
                    <div key={s.label} className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${s.color}`}>
                            <s.icon className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-xl font-bold text-slate-800 leading-none">{s.value}</p>
                            <p className="text-xs text-slate-500 font-medium">{s.label}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Filtres */}
            <ListingFilterBar
                searchValue={search}
                onSearchChange={setSearch}
                searchPlaceholder="Rechercher un salarié, un email, un poste…"
                sortOptions={sortOptions}
                sortValue={sortValue}
                onSortChange={setSortValue}
                sortDirection={sortDirection}
                onSortDirectionToggle={() => setSortDirection(d => (d === 'asc' ? 'desc' : 'asc'))}
                filters={filterConfigs}
                filterValues={filters}
                onFilterChange={(key, value) => setFilters(prev => ({ ...prev, [key]: value }))}
                filteredCount={filtered.length}
                totalCount={(employmentContracts || []).length}
                entityLabel="contrat(s)"
                onReset={() => { setSearch(''); setFilters({ status: 'all', type: 'all' }); setSortValue('created_desc'); setSortDirection('desc'); }}
                hasActiveFilters={!!search || filters.status !== 'all' || filters.type !== 'all'}
            />

            {/* Liste */}
            {filtered.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-12 text-center">
                    <Users className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                    <p className="text-slate-500 font-medium">
                        {(employmentContracts || []).length === 0
                            ? 'Aucun contrat de travail. Créez le premier contrat CDI/CDD d\'un prestataire salarié.'
                            : 'Aucun contrat ne correspond aux filtres actuels.'}
                    </p>
                </div>
            ) : (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                                <tr>
                                    <th className="px-4 py-3 text-left font-bold">Salarié(e)</th>
                                    <th className="px-4 py-3 text-left font-bold">Type</th>
                                    <th className="px-4 py-3 text-left font-bold">Prise d'effet</th>
                                    <th className="px-4 py-3 text-left font-bold hidden lg:table-cell">Heures</th>
                                    <th className="px-4 py-3 text-left font-bold hidden md:table-cell">Brut mensuel</th>
                                    <th className="px-4 py-3 text-left font-bold">Statut</th>
                                    <th className="px-4 py-3 text-left font-bold hidden md:table-cell">Documents</th>
                                    <th className="px-4 py-3 text-right font-bold">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filtered.map(c => {
                                    const meta = STATUS_META[c.status] || STATUS_META.draft;
                                    return (
                                        <tr key={c.id} className="hover:bg-slate-50/70 transition-colors">
                                            <td className="px-4 py-3">
                                                <button onClick={() => { setSelected(c); setShowPdfPreview(false); }} className="text-left">
                                                    <p className="font-bold text-slate-800 hover:text-brand-blue transition">
                                                        {c.employeeFirstName} {c.employeeLastName}
                                                    </p>
                                                    <p className="text-xs text-slate-400">{c.jobTitle || '—'}</p>
                                                </button>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="font-bold text-slate-600">{(c.contractType || 'cdi').toUpperCase()}</span>
                                            </td>
                                            <td className="px-4 py-3 text-slate-600">{c.startDate ? formatMartiniqueDate(c.startDate) : '—'}</td>
                                            <td className="px-4 py-3 text-slate-600 hidden lg:table-cell">{fmtHours(c.weeklyHours)} / sem.</td>
                                            <td className="px-4 py-3 text-slate-600 hidden md:table-cell font-medium">{fmtEur(c.monthlyGross)}</td>
                                            <td className="px-4 py-3">
                                                <span className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-bold border ${meta.cls}`}>{meta.label}</span>
                                            </td>
                                            <td className="px-4 py-3 hidden md:table-cell">
                                                <div className="flex gap-1.5">
                                                    {c.pdfPath && <span title="PDF généré" className="text-brand-blue"><FileText className="w-4 h-4" /></span>}
                                                    {c.signedScanPath && <span title="Scan signé archivé" className="text-emerald-600"><CheckCircle2 className="w-4 h-4" /></span>}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex justify-end gap-1">
                                                    <button onClick={() => { setSelected(c); setShowPdfPreview(false); }} title="Voir la fiche" className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100">
                                                        <Eye className="w-4 h-4" />
                                                    </button>
                                                    <button onClick={() => openEdit(c)} title="Modifier" className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100">
                                                        <Pencil className="w-4 h-4" />
                                                    </button>
                                                    <button onClick={() => handleSend(c)} disabled={busyAction === `send-${c.id}`} title="Envoyer par email" className="p-1.5 rounded-lg text-brand-blue hover:bg-blue-50 disabled:opacity-40">
                                                        {busyAction === `send-${c.id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                                    </button>
                                                    <button onClick={() => handleDelete(c)} disabled={busyAction === `delete-${c.id}`} title="Supprimer" className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 disabled:opacity-40">
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ===== Fiche détaillée (drawer) ===== */}
            {liveSelected && (
                <div className="fixed inset-0 z-50 flex items-stretch justify-end bg-slate-900/40 backdrop-blur-sm" onMouseDown={e => { if (e.target === e.currentTarget) setSelected(null); }}>
                    <div className="bg-cream-50 w-full max-w-2xl h-full overflow-y-auto shadow-2xl flex flex-col">
                        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between z-10">
                            <div>
                                <h3 className="text-lg font-serif font-bold text-slate-800">
                                    Contrat {(liveSelected.contractType || 'cdi').toUpperCase()} — {liveSelected.employeeFirstName} {liveSelected.employeeLastName}
                                </h3>
                                <p className="text-xs text-slate-500">
                                    {providerName(liveSelected.providerId) ? `Prestataire lié : ${providerName(liveSelected.providerId)}` : 'Aucun prestataire lié'}
                                </p>
                            </div>
                            <button onClick={() => setSelected(null)} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500" aria-label="Fermer">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6 space-y-5">
                            {/* Actions fiche */}
                            <div className="flex flex-wrap gap-2">
                                <button onClick={() => setShowPdfPreview(v => !v)} className="px-3.5 py-2 rounded-lg text-xs font-bold bg-white border border-slate-200 hover:border-brand-blue text-slate-700 flex items-center gap-1.5">
                                    <Eye className="w-3.5 h-3.5" /> {showPdfPreview ? 'Masquer l\'aperçu PDF' : 'Aperçu PDF'}
                                </button>
                                <button onClick={() => handleDownload(liveSelected)} disabled={busyAction === `dl-${liveSelected.id}`} className="px-3.5 py-2 rounded-lg text-xs font-bold bg-white border border-slate-200 hover:border-brand-blue text-slate-700 flex items-center gap-1.5 disabled:opacity-50">
                                    {busyAction === `dl-${liveSelected.id}` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />} Télécharger
                                </button>
                                <button onClick={() => handleSend(liveSelected)} disabled={busyAction === `send-${liveSelected.id}`} className="px-3.5 py-2 rounded-lg text-xs font-bold bg-brand-blue text-white hover:bg-teal-700 flex items-center gap-1.5 disabled:opacity-60">
                                    {busyAction === `send-${liveSelected.id}` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />} Envoyer au prestataire
                                </button>
                                <button onClick={() => openEdit(liveSelected)} className="px-3.5 py-2 rounded-lg text-xs font-bold bg-white border border-slate-200 hover:border-brand-blue text-slate-700 flex items-center gap-1.5">
                                    <Pencil className="w-3.5 h-3.5" /> Modifier
                                </button>
                                {liveSelected.status === 'active' && (
                                    <button onClick={() => handleTerminate(liveSelected)} className="px-3.5 py-2 rounded-lg text-xs font-bold bg-white border border-red-200 hover:bg-red-50 text-red-600 flex items-center gap-1.5">
                                        <AlertTriangle className="w-3.5 h-3.5" /> Rompre le contrat
                                    </button>
                                )}
                            </div>

                            {/* Aperçu PDF inline */}
                            {showPdfPreview && (
                                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden" style={{ height: '70vh' }}>
                                    <PDFViewer showToolbar={false} style={{ width: '100%', height: '100%', border: 0 }}>
                                        <EmploymentContractPDF contract={liveSelected} />
                                    </PDFViewer>
                                </div>
                            )}

                            {/* Récapitulatif */}
                            <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
                                <h4 className="text-sm font-bold text-brand-blue">Récapitulatif</h4>
                                <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                                    {[
                                        ['Statut', (STATUS_META[liveSelected.status] || STATUS_META.draft).label],
                                        ['Prise d\'effet', liveSelected.startDate ? formatMartiniqueDate(liveSelected.startDate) : '—'],
                                        ['Emploi', liveSelected.jobTitle || '—'],
                                        ['Classification', liveSelected.classification || '—'],
                                        ['Heures hebdo', fmtHours(liveSelected.weeklyHours)],
                                        ['Heures mensuelles', fmtHours(liveSelected.monthlyHours)],
                                        ['Taux horaire brut', fmtEur(liveSelected.hourlyRate)],
                                        ['Brut mensuel', fmtEur(liveSelected.monthlyGross)],
                                        ['Net estimé', liveSelected.monthlyNetEstimate ? fmtEur(liveSelected.monthlyNetEstimate) : '—'],
                                        ['Période d\'essai', liveSelected.trialPeriodWeeks ? `${liveSelected.trialPeriodWeeks} semaine(s)` : 'Aucune'],
                                    ].map(([k, v]) => (
                                        <div key={k as string}>
                                            <dt className="text-xs text-slate-400 font-bold uppercase">{k}</dt>
                                            <dd className="text-slate-700 font-medium">{v}</dd>
                                        </div>
                                    ))}
                                </dl>
                                <div>
                                    <p className="text-xs text-slate-400 font-bold uppercase mb-1">Horaires</p>
                                    {(liveSelected.schedule || []).length === 0 ? (
                                        <p className="text-sm text-slate-500">Non précisé</p>
                                    ) : (
                                        <ul className="text-sm text-slate-700 space-y-0.5">
                                            {(liveSelected.schedule || []).map((s, i) => (
                                                <li key={i}>
                                                    {(s.days || []).map(d => DAY_LABELS[d] || `J${d}`).join(', ')} : {s.start} – {s.end}
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                                {liveSelected.status === 'terminated' && (
                                    <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg p-3">
                                        Rompu le {liveSelected.terminationDate ? formatMartiniqueDate(liveSelected.terminationDate) : '—'} — {liveSelected.terminationReason || 'motif non précisé'}
                                    </div>
                                )}
                            </div>

                            {/* Documents */}
                            <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
                                <h4 className="text-sm font-bold text-brand-blue">Documents & signature</h4>
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-slate-600">PDF du contrat</span>
                                    {liveSelected.pdfPath ? (
                                        <a href={getEmploymentContractPdfUrl(liveSelected) || '#'} target="_blank" rel="noopener noreferrer" className="font-bold text-brand-blue hover:underline flex items-center gap-1">
                                            <FileText className="w-4 h-4" /> Ouvrir
                                        </a>
                                    ) : (
                                        <span className="text-slate-400 italic">Jamais généré — « Envoyer » ou « Télécharger » le génère</span>
                                    )}
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-slate-600">Scan signé retourné</span>
                                    {liveSelected.signedScanPath ? (
                                        <a
                                            href={(() => {
                                                const url = getEmploymentContractPdfUrl({ ...liveSelected, pdfPath: liveSelected.signedScanPath });
                                                return url || '#';
                                            })()}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="font-bold text-emerald-600 hover:underline flex items-center gap-1"
                                        >
                                            <CheckCircle2 className="w-4 h-4" /> Consulter
                                        </a>
                                    ) : (
                                        <button
                                            onClick={() => scanInputRef.current?.click()}
                                            disabled={busyAction === `scan-${liveSelected.id}`}
                                            className="font-bold text-brand-blue hover:underline flex items-center gap-1 disabled:opacity-50"
                                        >
                                            {busyAction === `scan-${liveSelected.id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />} Téléverser un scan
                                        </button>
                                    )}
                                </div>
                                <input
                                    ref={scanInputRef}
                                    type="file"
                                    accept="image/png,image/jpeg,application/pdf"
                                    className="hidden"
                                    onChange={e => {
                                        const f = e.target.files?.[0];
                                        if (f) handleScanUpload(f);
                                        e.target.value = '';
                                    }}
                                />
                                <p className="text-[11px] text-slate-400">
                                    Workflow hors ligne : envoyer le PDF (email + lien), le salarié imprime, signe (« Lu et approuvé ») et retourne un scan PDF/image à archiver ici.
                                </p>
                                {liveSelected.sentAt && (
                                    <p className="text-xs text-slate-500">Envoyé le {formatMartiniqueDate(liveSelected.sentAt)}</p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal formulaire */}
            {formOpen && (
                <EmploymentContractFormModal
                    contract={editing}
                    onClose={() => setFormOpen(false)}
                    onSaved={() => {
                        setFormOpen(false);
                        setEditing(null);
                    }}
                />
            )}
        </div>
    );
};

export default EmploymentContractsPage;
