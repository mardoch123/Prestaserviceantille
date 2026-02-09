import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, Plus, Save, Trash2, Gift, Coins } from 'lucide-react';
import type { MktReferrer, MktReward, MktRewardRule, MktRewardRuleAppliesTo } from '../types';
import {
  adminAdjustReferrerPoints,
  adminGrantReward,
  deleteRewardAdmin,
  deleteRewardRuleAdmin,
  findReferrerByCodeAdmin,
  getReferrerBalanceAdmin,
  listAllRewardsAdmin,
  listRewardRulesAdmin,
  upsertRewardAdmin,
  upsertRewardRuleAdmin,
} from '../client';

type RewardForm = {
  id?: string;
  name: string;
  description: string;
  points_cost: string;
  is_active: boolean;
};

type RuleForm = {
  id?: string;
  reward_id: string;
  points_threshold: string;
  applies_to: MktRewardRuleAppliesTo;
  is_active: boolean;
  note: string;
};

const AdminRewardsPointsPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [rewards, setRewards] = useState<MktReward[]>([]);
  const [rules, setRules] = useState<MktRewardRule[]>([]);

  const [rewardOpen, setRewardOpen] = useState(false);
  const [rewardSaving, setRewardSaving] = useState(false);
  const [rewardForm, setRewardForm] = useState<RewardForm>({
    name: '',
    description: '',
    points_cost: '0',
    is_active: true,
  });

  const [ruleOpen, setRuleOpen] = useState(false);
  const [ruleSaving, setRuleSaving] = useState(false);
  const [ruleForm, setRuleForm] = useState<RuleForm>({
    reward_id: '',
    points_threshold: '',
    applies_to: 'all',
    is_active: true,
    note: '',
  });

  const [targetCode, setTargetCode] = useState('');
  const [targetLoading, setTargetLoading] = useState(false);
  const [targetReferrer, setTargetReferrer] = useState<MktReferrer | null>(null);
  const [targetBalance, setTargetBalance] = useState<number | null>(null);

  const [adjustPoints, setAdjustPoints] = useState('');
  const [adjustNote, setAdjustNote] = useState('');
  const [adjustLoading, setAdjustLoading] = useState(false);

  const [grantRewardId, setGrantRewardId] = useState('');
  const [grantCostOverride, setGrantCostOverride] = useState('');
  const [grantNote, setGrantNote] = useState('');
  const [grantLoading, setGrantLoading] = useState(false);

  const rewardById = useMemo(() => {
    const m = new Map<string, MktReward>();
    (rewards || []).forEach(r => m.set(r.id, r));
    return m;
  }, [rewards]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [rs, rr] = await Promise.all([listAllRewardsAdmin(), listRewardRulesAdmin()]);
      setRewards(rs);
      setRules(rr);
    } catch (e: any) {
      setError(String(e?.message || 'Erreur chargement'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openCreateReward = () => {
    setRewardForm({ name: '', description: '', points_cost: '0', is_active: true });
    setRewardOpen(true);
  };

  const openEditReward = (r: MktReward) => {
    setRewardForm({
      id: r.id,
      name: r.name || '',
      description: r.description || '',
      points_cost: String(r.points_cost ?? 0),
      is_active: !!r.is_active,
    });
    setRewardOpen(true);
  };

  const saveReward = async () => {
    if (rewardSaving) return;
    const name = String(rewardForm.name || '').trim();
    if (!name) return;

    setRewardSaving(true);
    try {
      await upsertRewardAdmin({
        id: rewardForm.id,
        name,
        description: String(rewardForm.description || '').trim() || null,
        points_cost: Number(String(rewardForm.points_cost || '0').trim() || 0),
        is_active: !!rewardForm.is_active,
      } as any);
      setRewardOpen(false);
      await load();
    } finally {
      setRewardSaving(false);
    }
  };

  const removeReward = async (id: string) => {
    if (!id) return;
    await deleteRewardAdmin(id);
    await load();
  };

  const openCreateRule = () => {
    const firstRewardId = (rewards || [])[0]?.id || '';
    setRuleForm({ reward_id: firstRewardId, points_threshold: '', applies_to: 'all', is_active: true, note: '' });
    setRuleOpen(true);
  };

  const openEditRule = (r: MktRewardRule) => {
    setRuleForm({
      id: r.id,
      reward_id: r.reward_id,
      points_threshold: String(r.points_threshold ?? ''),
      applies_to: (r.applies_to || 'all') as any,
      is_active: !!r.is_active,
      note: r.note || '',
    });
    setRuleOpen(true);
  };

  const saveRule = async () => {
    if (ruleSaving) return;

    const rewardId = String(ruleForm.reward_id || '').trim();
    const points = Number(String(ruleForm.points_threshold || '').trim() || 0);
    if (!rewardId || !points || points <= 0) return;

    setRuleSaving(true);
    try {
      await upsertRewardRuleAdmin({
        id: ruleForm.id,
        reward_id: rewardId,
        points_threshold: points,
        applies_to: ruleForm.applies_to,
        is_active: !!ruleForm.is_active,
        note: String(ruleForm.note || '').trim() || null,
      } as any);
      setRuleOpen(false);
      await load();
    } finally {
      setRuleSaving(false);
    }
  };

  const removeRule = async (id: string) => {
    if (!id) return;
    await deleteRewardRuleAdmin(id);
    await load();
  };

  const loadTarget = async () => {
    if (targetLoading) return;
    setTargetLoading(true);
    setError(null);
    setTargetReferrer(null);
    setTargetBalance(null);
    try {
      const code = String(targetCode || '').trim();
      if (!code) return;
      const r = await findReferrerByCodeAdmin(code);
      if (!r) {
        setError('Parrain introuvable.');
        return;
      }
      setTargetReferrer(r);
      const b = await getReferrerBalanceAdmin(r.id);
      setTargetBalance(b);
    } finally {
      setTargetLoading(false);
    }
  };

  const doAdjustPoints = async () => {
    if (!targetReferrer?.id || adjustLoading) return;
    const pts = Number(String(adjustPoints || '').trim() || 0);
    if (!pts || pts === 0) return;

    setAdjustLoading(true);
    setError(null);
    try {
      const note = String(adjustNote || '').trim();
      const res = await adminAdjustReferrerPoints(targetReferrer.id, pts, note || undefined);
      if (!res || (res as any).ok !== true) {
        setError('Ajustement impossible pour le moment.');
        return;
      }
      const b = await getReferrerBalanceAdmin(targetReferrer.id);
      setTargetBalance(b);
      setAdjustPoints('');
      setAdjustNote('');
      await load();
    } finally {
      setAdjustLoading(false);
    }
  };

  const doGrantReward = async () => {
    if (!targetReferrer?.id || grantLoading) return;
    const rid = String(grantRewardId || '').trim();
    if (!rid) return;

    const override = String(grantCostOverride || '').trim();
    const overrideValue = override === '' ? null : Number(override);

    setGrantLoading(true);
    setError(null);
    try {
      const note = String(grantNote || '').trim();
      const res = await adminGrantReward(
        targetReferrer.id,
        rid,
        overrideValue,
        note || undefined
      );
      if (!res || (res as any).ok !== true) {
        setError('Attribution impossible pour le moment.');
        return;
      }
      const b = await getReferrerBalanceAdmin(targetReferrer.id);
      setTargetBalance(b);
      setGrantCostOverride('');
      setGrantNote('');
      await load();
    } finally {
      setGrantLoading(false);
    }
  };

  return (
    <div className="h-full w-full overflow-y-auto p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs text-slate-500">Admin</div>
          <h1 className="text-2xl font-extrabold text-slate-800">Récompenses & Points</h1>
          <div className="text-xs text-slate-500 mt-1">Gérer les récompenses, les seuils, les ajustements points et les attributions manuelles.</div>
        </div>
      </div>

      {error ? (
        <div className="mt-4 bg-red-50 border border-red-100 text-red-700 rounded-xl p-3 text-sm font-bold">{error}</div>
      ) : null}

      {loading ? (
        <div className="mt-10 flex items-center gap-2 text-slate-600">
          <Loader2 className="w-5 h-5 animate-spin" />
          Chargement...
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2 font-extrabold text-slate-800">
                <Gift className="w-5 h-5 text-brand-orange" />
                Récompenses
              </div>
              <button
                onClick={openCreateReward}
                className="inline-flex items-center gap-2 bg-brand-blue text-white px-4 py-2 rounded-xl font-extrabold hover:bg-teal-700"
              >
                <Plus className="w-4 h-4" />
                Ajouter
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-[700px] w-full text-sm">
                <thead className="bg-slate-50">
                  <tr className="text-left text-slate-600">
                    <th className="px-4 py-3">Nom</th>
                    <th className="px-4 py-3">Coût</th>
                    <th className="px-4 py-3">Actif</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {rewards.map((r) => (
                    <tr key={r.id} className="border-t border-slate-100">
                      <td className="px-4 py-3">
                        <button onClick={() => openEditReward(r)} className="font-extrabold text-slate-800 hover:underline">
                          {r.name}
                        </button>
                        <div className="text-xs text-slate-500 line-clamp-1">{r.description || ''}</div>
                      </td>
                      <td className="px-4 py-3 font-extrabold">{Number(r.points_cost || 0)}</td>
                      <td className="px-4 py-3 font-bold">{r.is_active ? 'Oui' : 'Non'}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => removeReward(r.id)}
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl font-bold text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                          Supprimer
                        </button>
                      </td>
                    </tr>
                  ))}

                  {rewards.length === 0 ? (
                    <tr>
                      <td className="px-4 py-8 text-center text-slate-600" colSpan={4}>
                        Aucune récompense.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2 font-extrabold text-slate-800">
                <Coins className="w-5 h-5 text-brand-orange" />
                Seuils (règles)
              </div>
              <button
                onClick={openCreateRule}
                className="inline-flex items-center gap-2 bg-brand-blue text-white px-4 py-2 rounded-xl font-extrabold hover:bg-teal-700"
              >
                <Plus className="w-4 h-4" />
                Ajouter
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-[900px] w-full text-sm">
                <thead className="bg-slate-50">
                  <tr className="text-left text-slate-600">
                    <th className="px-4 py-3">Seuil</th>
                    <th className="px-4 py-3">Récompense</th>
                    <th className="px-4 py-3">Applique à</th>
                    <th className="px-4 py-3">Actif</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {rules.map((r) => (
                    <tr key={r.id} className="border-t border-slate-100">
                      <td className="px-4 py-3 font-extrabold">{Number(r.points_threshold || 0)}</td>
                      <td className="px-4 py-3">
                        <button onClick={() => openEditRule(r)} className="font-extrabold text-slate-800 hover:underline">
                          {rewardById.get(r.reward_id)?.name || r.reward_id}
                        </button>
                        <div className="text-xs text-slate-500 line-clamp-1">{r.note || ''}</div>
                      </td>
                      <td className="px-4 py-3 font-bold">{r.applies_to}</td>
                      <td className="px-4 py-3 font-bold">{r.is_active ? 'Oui' : 'Non'}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => removeRule(r.id)}
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl font-bold text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                          Supprimer
                        </button>
                      </td>
                    </tr>
                  ))}

                  {rules.length === 0 ? (
                    <tr>
                      <td className="px-4 py-8 text-center text-slate-600" colSpan={5}>
                        Aucune règle.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            <div className="p-5 border-t border-slate-100 text-xs text-slate-500">
              Priorité auto: le système choisit la règle active avec le seuil le plus élevé qui reste ≤ au solde.
            </div>
          </div>

          <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden xl:col-span-2">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div className="font-extrabold text-slate-800">Parrain cible</div>
            </div>

            <div className="p-5 grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Code parrain</label>
                <div className="flex items-center gap-2">
                  <input
                    value={targetCode}
                    onChange={(e) => setTargetCode(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-4 py-3"
                    placeholder="PAR-XXXXXXX"
                  />
                  <button
                    onClick={loadTarget}
                    disabled={targetLoading}
                    className="inline-flex items-center gap-2 bg-slate-900 text-white px-4 py-3 rounded-xl font-extrabold disabled:opacity-60"
                  >
                    {targetLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Charger'}
                  </button>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4">
                <div className="text-xs text-slate-500">Parrain</div>
                <div className="mt-1 font-extrabold text-slate-800">{targetReferrer ? (targetReferrer.full_name || '—') : '—'}</div>
                <div className="text-xs text-slate-500 mt-1">Type: {targetReferrer ? ((targetReferrer as any).is_lambda ? 'lambda' : 'normal') : '—'}</div>
              </div>

              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4">
                <div className="text-xs text-slate-500">Solde points</div>
                <div className="mt-1 font-extrabold text-slate-800">{targetBalance === null ? '—' : Number(targetBalance)}</div>
                <div className="text-xs text-slate-500 mt-1">ID: {targetReferrer ? targetReferrer.id : '—'}</div>
              </div>
            </div>

            <div className="px-5 pb-5 grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="border border-slate-100 rounded-2xl p-4">
                <div className="font-extrabold text-slate-800">Modifier manuellement les points</div>
                <div className="text-xs text-slate-500 mt-1">Ex: +500 / -200</div>

                <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Points</label>
                    <input value={adjustPoints} onChange={(e) => setAdjustPoints(e.target.value)} className="w-full border border-slate-200 rounded-xl px-4 py-3" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 mb-1">Note</label>
                    <input value={adjustNote} onChange={(e) => setAdjustNote(e.target.value)} className="w-full border border-slate-200 rounded-xl px-4 py-3" placeholder="Optionnel" />
                  </div>
                </div>

                <div className="mt-3 flex justify-end">
                  <button
                    onClick={doAdjustPoints}
                    disabled={!targetReferrer?.id || adjustLoading}
                    className="inline-flex items-center gap-2 bg-brand-blue text-white px-4 py-2 rounded-xl font-extrabold hover:bg-teal-700 disabled:opacity-60"
                  >
                    {adjustLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Appliquer
                  </button>
                </div>
              </div>

              <div className="border border-slate-100 rounded-2xl p-4">
                <div className="font-extrabold text-slate-800">Attribuer une récompense</div>
                <div className="text-xs text-slate-500 mt-1">Crée une redemption + débite les points (si coût &gt; 0)</div>

                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Récompense</label>
                    <select value={grantRewardId} onChange={(e) => setGrantRewardId(e.target.value)} className="w-full border border-slate-200 rounded-xl px-4 py-3">
                      <option value="">Sélectionner...</option>
                      {rewards.map(r => (
                        <option key={r.id} value={r.id}>{r.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Coût override</label>
                    <input value={grantCostOverride} onChange={(e) => setGrantCostOverride(e.target.value)} className="w-full border border-slate-200 rounded-xl px-4 py-3" placeholder="Laisser vide = coût défaut" />
                  </div>
                </div>

                <div className="mt-3">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Note</label>
                  <input value={grantNote} onChange={(e) => setGrantNote(e.target.value)} className="w-full border border-slate-200 rounded-xl px-4 py-3" placeholder="Optionnel" />
                </div>

                <div className="mt-3 flex justify-end">
                  <button
                    onClick={doGrantReward}
                    disabled={!targetReferrer?.id || grantLoading || !grantRewardId}
                    className="inline-flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-xl font-extrabold hover:bg-black disabled:opacity-60"
                  >
                    {grantLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Gift className="w-4 h-4" />}
                    Attribuer
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {rewardOpen ? (
        <div className="fixed inset-0 z-[9999]">
          <button className="absolute inset-0 bg-black/40" onClick={() => setRewardOpen(false)} aria-label="Fermer" />
          <div className="absolute inset-x-0 top-10 px-4">
            <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <div className="text-lg font-extrabold text-slate-800">{rewardForm.id ? 'Modifier une récompense' : 'Créer une récompense'}</div>
                <button
                  onClick={saveReward}
                  disabled={rewardSaving}
                  className="inline-flex items-center gap-2 bg-brand-blue text-white px-4 py-2 rounded-xl font-extrabold hover:bg-teal-700 disabled:opacity-60"
                >
                  {rewardSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Enregistrer
                </button>
              </div>

              <div className="p-5 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Nom</label>
                  <input value={rewardForm.name} onChange={(e) => setRewardForm((s) => ({ ...s, name: e.target.value }))} className="w-full border border-slate-200 rounded-xl px-4 py-3" />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Description</label>
                  <textarea value={rewardForm.description} onChange={(e) => setRewardForm((s) => ({ ...s, description: e.target.value }))} className="w-full border border-slate-200 rounded-xl px-4 py-3 min-h-24" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Coût (points)</label>
                    <input value={rewardForm.points_cost} onChange={(e) => setRewardForm((s) => ({ ...s, points_cost: e.target.value }))} className="w-full border border-slate-200 rounded-xl px-4 py-3" />
                  </div>
                  <div className="flex items-end">
                    <label className="inline-flex items-center gap-2 text-sm font-bold text-slate-700">
                      <input type="checkbox" checked={rewardForm.is_active} onChange={(e) => setRewardForm((s) => ({ ...s, is_active: e.target.checked }))} />
                      Actif
                    </label>
                  </div>
                </div>
              </div>

              <div className="px-5 py-4 border-t border-slate-100 flex justify-end">
                <button onClick={() => setRewardOpen(false)} className="px-4 py-2 rounded-xl font-bold text-slate-700 hover:bg-slate-100">
                  Fermer
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {ruleOpen ? (
        <div className="fixed inset-0 z-[9999]">
          <button className="absolute inset-0 bg-black/40" onClick={() => setRuleOpen(false)} aria-label="Fermer" />
          <div className="absolute inset-x-0 top-10 px-4">
            <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <div className="text-lg font-extrabold text-slate-800">{ruleForm.id ? 'Modifier une règle' : 'Créer une règle'}</div>
                <button
                  onClick={saveRule}
                  disabled={ruleSaving}
                  className="inline-flex items-center gap-2 bg-brand-blue text-white px-4 py-2 rounded-xl font-extrabold hover:bg-teal-700 disabled:opacity-60"
                >
                  {ruleSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Enregistrer
                </button>
              </div>

              <div className="p-5 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Récompense</label>
                  <select value={ruleForm.reward_id} onChange={(e) => setRuleForm((s) => ({ ...s, reward_id: e.target.value }))} className="w-full border border-slate-200 rounded-xl px-4 py-3">
                    {(rewards || []).map((r) => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Seuil (points)</label>
                    <input value={ruleForm.points_threshold} onChange={(e) => setRuleForm((s) => ({ ...s, points_threshold: e.target.value }))} className="w-full border border-slate-200 rounded-xl px-4 py-3" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Applique à</label>
                    <select value={ruleForm.applies_to} onChange={(e) => setRuleForm((s) => ({ ...s, applies_to: e.target.value as any }))} className="w-full border border-slate-200 rounded-xl px-4 py-3">
                      <option value="all">all</option>
                      <option value="normal">normal</option>
                      <option value="lambda">lambda</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <label className="inline-flex items-center gap-2 text-sm font-bold text-slate-700">
                    <input type="checkbox" checked={ruleForm.is_active} onChange={(e) => setRuleForm((s) => ({ ...s, is_active: e.target.checked }))} />
                    Actif
                  </label>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Note</label>
                  <input value={ruleForm.note} onChange={(e) => setRuleForm((s) => ({ ...s, note: e.target.value }))} className="w-full border border-slate-200 rounded-xl px-4 py-3" />
                </div>
              </div>

              <div className="px-5 py-4 border-t border-slate-100 flex justify-end">
                <button onClick={() => setRuleOpen(false)} className="px-4 py-2 rounded-xl font-bold text-slate-700 hover:bg-slate-100">
                  Fermer
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default AdminRewardsPointsPage;
