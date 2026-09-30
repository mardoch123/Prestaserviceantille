/**
 * ============================================================
 *  EmploymentContractFormModal.tsx — Formulaire de création /
 *  édition d'un contrat de travail prestataire (CDI/CDD salariés).
 *
 *  Sections calquées sur la table `employment_contracts` :
 *  Salarié / Objet / Durée du travail / Rémunération / Clauses / Fin de vie.
 *  Cohérence automatique : monthlyHours = weeklyHours × 52 / 12,
 *  monthlyGross = monthlyHours × hourlyRate.
 * ============================================================
 */

import React, { useMemo, useState } from 'react';
import { X, Plus, Trash2, Save, Loader2 } from 'lucide-react';
import { useData } from '../context/DataContext';
import { toast } from './mobile/Toast';
import SearchableSelect from './SearchableSelect';
import {
    EmploymentContract,
    CreateEmploymentContractDTO,
    ContractScheduleEntry,
    ContractSupervisor,
    EMPLOYMENT_CONTRACT_DEFAULTS,
} from '../types';

const DAY_LABELS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

const inputCls = "w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/30 focus:border-brand-blue transition";
const labelCls = "block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1";
const sectionCls = "border border-slate-200 rounded-xl p-5 bg-white";

interface Props {
    contract: EmploymentContract | null; // null = création
    onClose: () => void;
    onSaved: () => void;
}

const EmploymentContractFormModal: React.FC<Props> = ({ contract, onClose, onSaved }) => {
    const { providers, addEmploymentContract, updateEmploymentContract } = useData();
    const isEdit = !!contract;

    const [form, setForm] = useState<Omit<CreateEmploymentContractDTO, 'duties' | 'supervisors' | 'workLocations' | 'schedule'> & {
        duties: string[];
        supervisors: ContractSupervisor[];
        workLocations: string[];
        schedule: ContractScheduleEntry[];
    }>(() => {
        if (contract) {
            const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = contract;
            return rest as any;
        }
        return { ...EMPLOYMENT_CONTRACT_DEFAULTS };
    });
    const [saving, setSaving] = useState(false);
    // Champs texte libres pour les listes (convertis au submit)
    const [dutiesText, setDutiesText] = useState(form.duties.join('\n'));
    const [locationsText, setLocationsText] = useState(form.workLocations.join('\n'));

    const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
        setForm(prev => ({ ...prev, [key]: value }));

    const num = (v: any): number => {
        const n = parseFloat(String(v ?? '').replace(',', '.'));
        return Number.isFinite(n) ? n : 0;
    };

    // Sélection prestataire → snapshot salarié
    const providerOptions = useMemo(
        () => (providers || []).map(p => ({
            value: p.id,
            label: `${p.firstName} ${p.lastName}${p.specialty ? ` — ${p.specialty}` : ''}`,
        })),
        [providers]
    );

    const handleProviderSelect = (providerId: string) => {
        const p = (providers || []).find(pr => pr.id === providerId);
        if (!p) {
            set('providerId', null);
            return;
        }
        setForm(prev => ({
            ...prev,
            providerId: p.id,
            employeeFirstName: p.firstName || prev.employeeFirstName,
            employeeLastName: p.lastName || prev.employeeLastName,
            employeeEmail: p.email || prev.employeeEmail,
        }));
    };

    // Cohérence automatique durée × rémunération
    const weeklyHoursNum = num(form.weeklyHours);
    const computedMonthlyHours = Math.round((weeklyHoursNum * 52 / 12) * 100) / 100;
    const computedMonthlyGross = Math.round(computedMonthlyHours * num(form.hourlyRate) * 100) / 100;

    // ---- Schedule (jours + horaires) ----
    const updateScheduleEntry = (idx: number, patch: Partial<ContractScheduleEntry>) => {
        set('schedule', (form.schedule || []).map((s, i) => i === idx ? { ...s, ...patch } : s));
    };
    const addScheduleEntry = () => {
        set('schedule', [...(form.schedule || []), { days: [1], start: '09:00', end: '16:00' }]);
    };
    const removeScheduleEntry = (idx: number) => {
        set('schedule', (form.schedule || []).filter((_, i) => i !== idx));
    };
    const toggleScheduleDay = (idx: number, day: number) => {
        const entry = (form.schedule || [])[idx];
        if (!entry) return;
        const days = entry.days.includes(day) ? entry.days.filter(d => d !== day) : [...entry.days, day].sort();
        updateScheduleEntry(idx, { days });
    };

    // ---- Superviseurs ----
    const updateSupervisor = (idx: number, patch: Partial<ContractSupervisor>) => {
        set('supervisors', (form.supervisors || []).map((s, i) => i === idx ? { ...s, ...patch } : s));
    };
    const addSupervisor = () => {
        set('supervisors', [...(form.supervisors || []), { name: '', role: '' }]);
    };
    const removeSupervisor = (idx: number) => {
        set('supervisors', (form.supervisors || []).filter((_, i) => i !== idx));
    };

    const handleSubmit = async () => {
        if (!form.employeeFirstName.trim() || !form.employeeLastName.trim()) {
            toast.error('Le nom et le prénom du salarié sont obligatoires.');
            return;
        }
        if (!form.startDate) {
            toast.error('La date de prise d\'effet est obligatoire.');
            return;
        }
        if (form.nonCompetition && !(num(form.nonCompetitionCompensationPercent) > 0)) {
            toast.error('La clause de non-concurrence exige une contrepartie financière (> 0 %).');
            return;
        }

        const payload: CreateEmploymentContractDTO = {
            ...form,
            duties: dutiesText.split('\n').map(s => s.trim()).filter(Boolean),
            workLocations: locationsText.split('\n').map(s => s.trim()).filter(Boolean),
            schedule: (form.schedule || []).filter(s => Array.isArray(s.days) && s.days.length > 0),
            weeklyHours: weeklyHoursNum,
            monthlyHours: computedMonthlyHours,
            monthlyGross: computedMonthlyGross,
            employeeFirstName: form.employeeFirstName.trim(),
            employeeLastName: form.employeeLastName.trim(),
        };

        setSaving(true);
        try {
            if (isEdit && contract) {
                await updateEmploymentContract(contract.id, payload);
                toast.success('Contrat de travail mis à jour.');
            } else {
                const created = await addEmploymentContract(payload);
                if (!created) throw new Error('Création du contrat échouée.');
                toast.success('Contrat de travail créé.');
            }
            onSaved();
        } catch (e: any) {
            console.error('[EmploymentContractForm] erreur:', e);
            toast.error(e?.message || 'Erreur lors de l\'enregistrement du contrat.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/50 backdrop-blur-sm p-4 overflow-y-auto" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="bg-cream-50 w-full max-w-4xl rounded-2xl shadow-2xl my-6 flex flex-col max-h-[92vh]">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white rounded-t-2xl sticky top-0 z-10">
                    <div>
                        <h3 className="text-xl font-serif font-bold text-slate-800">
                            {isEdit ? 'Modifier le contrat de travail' : 'Nouveau contrat de travail'}
                        </h3>
                        <p className="text-xs text-slate-500">
                            {isEdit ? `${form.employeeFirstName} ${form.employeeLastName}` : 'CDI/CDD salarié — modèle Presta Services Antilles'}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500" aria-label="Fermer">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-5">
                    {/* ===== Salarié ===== */}
                    <div className={sectionCls}>
                        <h4 className="text-sm font-bold text-brand-blue mb-4">Salarié(e)</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="md:col-span-2">
                                <label className={labelCls}>Prestataire (pré-remplissage)</label>
                                <SearchableSelect
                                    options={providerOptions}
                                    value={form.providerId || ''}
                                    onChange={handleProviderSelect}
                                    placeholder="Sélectionner un prestataire existant…"
                                    isClearable
                                />
                            </div>
                            <div>
                                <label className={labelCls}>Prénom *</label>
                                <input className={inputCls} value={form.employeeFirstName} onChange={e => set('employeeFirstName', e.target.value)} />
                            </div>
                            <div>
                                <label className={labelCls}>Nom *</label>
                                <input className={inputCls} value={form.employeeLastName} onChange={e => set('employeeLastName', e.target.value)} />
                            </div>
                            <div>
                                <label className={labelCls}>Email</label>
                                <input className={inputCls} type="email" value={form.employeeEmail || ''} onChange={e => set('employeeEmail', e.target.value)} />
                            </div>
                            <div>
                                <label className={labelCls}>Civilité</label>
                                <select className={inputCls} value={form.employeeGender || 'f'} onChange={e => set('employeeGender', e.target.value as 'f' | 'm')}>
                                    <option value="f">Femme (« la salariée »)</option>
                                    <option value="m">Homme (« le salarié »)</option>
                                </select>
                            </div>
                            <div className="md:col-span-2">
                                <label className={labelCls}>Adresse de domicile</label>
                                <textarea className={inputCls} rows={2} value={form.employeeAddress || ''} onChange={e => set('employeeAddress', e.target.value)} />
                            </div>
                        </div>
                    </div>

                    {/* ===== Objet du contrat ===== */}
                    <div className={sectionCls}>
                        <h4 className="text-sm font-bold text-brand-blue mb-4">Objet du contrat</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className={labelCls}>Type</label>
                                <select className={inputCls} value={form.contractType || 'cdi'} onChange={e => set('contractType', e.target.value as 'cdi' | 'cdd')}>
                                    <option value="cdi">CDI</option>
                                    <option value="cdd">CDD</option>
                                </select>
                            </div>
                            <div>
                                <label className={labelCls}>Date de prise d'effet *</label>
                                <input className={inputCls} type="date" value={form.startDate} onChange={e => set('startDate', e.target.value)} />
                            </div>
                            <div>
                                <label className={labelCls}>Emploi occupé</label>
                                <input className={inputCls} value={form.jobTitle || ''} onChange={e => set('jobTitle', e.target.value)} />
                            </div>
                            <div>
                                <label className={labelCls}>Classification</label>
                                <input className={inputCls} value={form.classification || ''} onChange={e => set('classification', e.target.value)} />
                            </div>
                            <div className="md:col-span-2">
                                <label className={labelCls}>Fonctions / missions confiées (une par ligne)</label>
                                <textarea className={inputCls} rows={5} value={dutiesText} onChange={e => setDutiesText(e.target.value)} />
                            </div>
                            <div className="md:col-span-2">
                                <label className={labelCls}>Lieux d'exécution (un par ligne)</label>
                                <textarea className={inputCls} rows={3} value={locationsText} onChange={e => setLocationsText(e.target.value)} />
                            </div>
                            <div className="md:col-span-2">
                                <div className="flex items-center justify-between mb-2">
                                    <label className={`${labelCls} mb-0`}>Autorité hiérarchique</label>
                                    <button type="button" onClick={addSupervisor} className="text-xs font-bold text-brand-blue hover:underline flex items-center gap-1">
                                        <Plus className="w-3 h-3" /> Ajouter
                                    </button>
                                </div>
                                <div className="space-y-2">
                                    {(form.supervisors || []).map((s, idx) => (
                                        <div key={idx} className="flex gap-2 items-center">
                                            <input className={inputCls} placeholder="Nom" value={s.name} onChange={e => updateSupervisor(idx, { name: e.target.value })} />
                                            <input className={inputCls} placeholder="Qualité (ex. Président)" value={s.role} onChange={e => updateSupervisor(idx, { role: e.target.value })} />
                                            <button type="button" onClick={() => removeSupervisor(idx)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg" aria-label="Supprimer">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ===== Durée du travail ===== */}
                    <div className={sectionCls}>
                        <h4 className="text-sm font-bold text-brand-blue mb-4">Durée du travail</h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                            <div>
                                <label className={labelCls}>Heures hebdomadaires</label>
                                <input className={inputCls} type="number" step="0.25" min="0" value={String(form.weeklyHours ?? '')} onChange={e => set('weeklyHours', num(e.target.value))} />
                            </div>
                            <div>
                                <label className={labelCls}>Heures mensuelles (calculées)</label>
                                <input className={inputCls} value={computedMonthlyHours.toFixed(2)} disabled />
                                <p className="text-[10px] text-slate-400 mt-1">hebdo × 52 / 12</p>
                            </div>
                            <div>
                                <label className={labelCls}>Convention collective</label>
                                <input className={inputCls} value={form.collectiveAgreement || ''} onChange={e => set('collectiveAgreement', e.target.value)} />
                            </div>
                        </div>
                        <label className={labelCls}>Plages horaires hebdomadaires</label>
                        <div className="space-y-3">
                            {(form.schedule || []).map((entry, idx) => (
                                <div key={idx} className="border border-slate-200 rounded-lg p-3 bg-slate-50">
                                    <div className="flex flex-wrap gap-1 mb-2">
                                        {DAY_LABELS.map((d, day) => (
                                            <button
                                                key={day}
                                                type="button"
                                                onClick={() => toggleScheduleDay(idx, day)}
                                                className={`px-2.5 py-1 rounded-full text-xs font-bold transition ${entry.days.includes(day) ? 'bg-brand-blue text-white' : 'bg-white border border-slate-300 text-slate-500 hover:border-brand-blue'}`}
                                            >
                                                {d}
                                            </button>
                                        ))}
                                        <button type="button" onClick={() => removeScheduleEntry(idx)} className="ml-auto p-1 text-red-500 hover:bg-red-50 rounded" aria-label="Supprimer la plage">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                    <div className="flex gap-3 items-center">
                                        <input type="time" className={inputCls + " !w-auto"} value={entry.start} onChange={e => updateScheduleEntry(idx, { start: e.target.value })} />
                                        <span className="text-slate-400 text-sm">→</span>
                                        <input type="time" className={inputCls + " !w-auto"} value={entry.end} onChange={e => updateScheduleEntry(idx, { end: e.target.value })} />
                                    </div>
                                </div>
                            ))}
                            <button type="button" onClick={addScheduleEntry} className="text-xs font-bold text-brand-blue hover:underline flex items-center gap-1">
                                <Plus className="w-3 h-3" /> Ajouter une plage
                            </button>
                        </div>
                    </div>

                    {/* ===== Rémunération ===== */}
                    <div className={sectionCls}>
                        <h4 className="text-sm font-bold text-brand-blue mb-4">Rémunération</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div>
                                <label className={labelCls}>Taux horaire brut (€)</label>
                                <input className={inputCls} type="number" step="0.01" min="0" value={String(form.hourlyRate ?? '')} onChange={e => set('hourlyRate', num(e.target.value))} />
                            </div>
                            <div>
                                <label className={labelCls}>Brut mensuel (calculé)</label>
                                <input className={inputCls} value={`${computedMonthlyGross.toFixed(2)} €`} disabled />
                                <p className="text-[10px] text-slate-400 mt-1">mensuel heures × taux</p>
                            </div>
                            <div>
                                <label className={labelCls}>Net mensuel estimé (€)</label>
                                <input className={inputCls} type="number" step="1" min="0" value={String(form.monthlyNetEstimate ?? '')} onChange={e => set('monthlyNetEstimate', num(e.target.value))} />
                            </div>
                            <div>
                                <label className={labelCls}>Période de paiement</label>
                                <input className={inputCls} value={form.paymentPeriod || ''} onChange={e => set('paymentPeriod', e.target.value)} />
                            </div>
                        </div>
                    </div>

                    {/* ===== Clauses ===== */}
                    <div className={sectionCls}>
                        <h4 className="text-sm font-bold text-brand-blue mb-4">Clauses</h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className={labelCls}>Période d'essai (semaines, vide = aucune)</label>
                                <input
                                    className={inputCls}
                                    type="number"
                                    min="0"
                                    value={form.trialPeriodWeeks ?? ''}
                                    onChange={e => set('trialPeriodWeeks', e.target.value === '' ? null : num(e.target.value))}
                                />
                            </div>
                            <div>
                                <label className={labelCls}>Congés (jours / mois)</label>
                                <input className={inputCls} type="number" step="0.5" min="0" value={String(form.leaveDaysPerMonth ?? 2.5)} onChange={e => set('leaveDaysPerMonth', num(e.target.value))} />
                            </div>
                            <div className="flex flex-col justify-end gap-2">
                                <label className="flex items-center gap-2 text-sm text-slate-700 font-medium cursor-pointer">
                                    <input type="checkbox" className="w-4 h-4 accent-brand-blue" checked={!!form.confidentiality} onChange={e => set('confidentiality', e.target.checked)} />
                                    Clause de confidentialité
                                </label>
                                <label className="flex items-center gap-2 text-sm text-slate-700 font-medium cursor-pointer">
                                    <input type="checkbox" className="w-4 h-4 accent-brand-blue" checked={!!form.nonCompetition} onChange={e => set('nonCompetition', e.target.checked)} />
                                    Clause de non-concurrence
                                </label>
                            </div>
                            {form.nonCompetition && (
                                <>
                                    <div>
                                        <label className={labelCls}>Durée non-concurrence (mois)</label>
                                        <input className={inputCls} type="number" min="1" value={String(form.nonCompetitionMonths ?? 1)} onChange={e => set('nonCompetitionMonths', num(e.target.value))} />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className={labelCls}>Contrepartie financière (% brut) *</label>
                                        <input
                                            className={inputCls}
                                            type="number"
                                            step="0.5"
                                            min="0"
                                            value={String(form.nonCompetitionCompensationPercent ?? '')}
                                            onChange={e => set('nonCompetitionCompensationPercent', num(e.target.value))}
                                        />
                                        <p className="text-[10px] text-orange-600 mt-1 font-medium">
                                            Obligatoire : sans contrepartie financière, la clause est nulle (jurisprudence FR).
                                        </p>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    {/* ===== Cycle de vie & signature ===== */}
                    <div className={sectionCls}>
                        <h4 className="text-sm font-bold text-brand-blue mb-4">Cycle de vie & signature</h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className={labelCls}>Statut</label>
                                <select className={inputCls} value={form.status} onChange={e => set('status', e.target.value as EmploymentContract['status'])}>
                                    <option value="draft">Brouillon</option>
                                    <option value="active">Actif</option>
                                    <option value="terminated">Rompu</option>
                                </select>
                            </div>
                            {form.status === 'terminated' && (
                                <>
                                    <div>
                                        <label className={labelCls}>Date de fin</label>
                                        <input className={inputCls} type="date" value={form.terminationDate || ''} onChange={e => set('terminationDate', e.target.value)} />
                                    </div>
                                    <div>
                                        <label className={labelCls}>Motif de rupture</label>
                                        <input className={inputCls} value={form.terminationReason || ''} onChange={e => set('terminationReason', e.target.value)} />
                                    </div>
                                </>
                            )}
                            <div>
                                <label className={labelCls}>Lieu de signature</label>
                                <input className={inputCls} value={form.placeOfSignature || ''} onChange={e => set('placeOfSignature', e.target.value)} />
                            </div>
                            <div>
                                <label className={labelCls}>Fait à / le (date d'édition)</label>
                                <input className={inputCls} type="date" value={form.issuedAt || ''} onChange={e => set('issuedAt', e.target.value)} />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-white rounded-b-2xl sticky bottom-0">
                    <button onClick={onClose} className="px-5 py-2.5 rounded-lg text-sm font-bold text-slate-600 hover:bg-slate-100 transition">
                        Annuler
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={saving}
                        className="px-5 py-2.5 rounded-lg text-sm font-bold bg-brand-blue text-white hover:bg-teal-700 transition flex items-center gap-2 disabled:opacity-60"
                    >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        {isEdit ? 'Enregistrer les modifications' : 'Créer le contrat'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default EmploymentContractFormModal;
