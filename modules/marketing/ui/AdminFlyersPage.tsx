import React, { useEffect, useMemo, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../../../utils/supabaseClient';
import { Loader2, Plus, Save, Trash2 } from 'lucide-react';
import type { MktFlyer } from '../types';

type FlyerForm = {
  id?: string;
  title: string;
  description: string;
  image_url: string;
  target_url: string;
  normal_price: string;
  promo_price: string;
  observations: string;
  starts_at: string;
  ends_at: string;
  is_active: boolean;
  is_featured: boolean;
  featured_rank: string;
};

const toInputDatetimeLocal = (iso: string | null | undefined) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const fromInputDatetimeLocal = (value: string) => {
  const v = String(value || '').trim();
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
};

const fileToDataUrl = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('read_failed'));
    reader.readAsDataURL(file);
  });
};

const AdminFlyersPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState<MktFlyer[]>([]);

  const [formOpen, setFormOpen] = useState(false);
  const [imageMode, setImageMode] = useState<'url' | 'upload'>('url');
  const [form, setForm] = useState<FlyerForm>({
    title: '',
    description: '',
    image_url: '',
    target_url: '',
    normal_price: '',
    promo_price: '',
    observations: '',
    starts_at: '',
    ends_at: '',
    is_active: true,
    is_featured: false,
    featured_rank: '',
  });

  const canUse = useMemo(() => isSupabaseConfigured, []);

  const load = async () => {
    if (!canUse) {
      setRows([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('mkt_flyers')
        .select('*')
        .order('created_at', { ascending: false });

      if (error || !data) {
        setRows([]);
        return;
      }

      setRows(data as any);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openCreate = () => {
    const pad = (n: number) => String(n).padStart(2, '0');
    const toLocalInput = (d: Date) => {
      const yy = d.getFullYear();
      const mm = pad(d.getMonth() + 1);
      const dd = pad(d.getDate());
      const hh = pad(d.getHours());
      const mi = pad(d.getMinutes());
      return `${yy}-${mm}-${dd}T${hh}:${mi}`;
    };

    const now = new Date();
    const monthLater = new Date(now);
    monthLater.setMonth(monthLater.getMonth() + 1);

    setImageMode('url');
    setForm({
      title: '',
      description: '',
      image_url: '',
      target_url: '',
      normal_price: '',
      promo_price: '',
      observations: '',
      starts_at: toLocalInput(now),
      ends_at: toLocalInput(monthLater),
      is_active: true,
      is_featured: false,
      featured_rank: '',
    });
    setFormOpen(true);
  };

  const getStatusLabel = (f: MktFlyer) => {
    const now = Date.now();
    if (!f?.is_active) return 'Désactivé';
    const startMs = f?.starts_at ? new Date(f.starts_at).getTime() : NaN;
    const endMs = f?.ends_at ? new Date(f.ends_at).getTime() : NaN;
    if (Number.isFinite(startMs) && now < startMs) return 'Programmé';
    if (Number.isFinite(endMs) && now > endMs) return 'Expiré';
    return 'Actif';
  };

  const openEdit = (f: MktFlyer) => {
    setImageMode('url');
    setForm({
      id: f.id,
      title: f.title || '',
      description: f.description || '',
      image_url: f.image_url || '',
      target_url: f.target_url || '',
      normal_price: f.normal_price === null || f.normal_price === undefined ? '' : String(f.normal_price),
      promo_price: f.promo_price === null || f.promo_price === undefined ? '' : String(f.promo_price),
      observations: f.observations || '',
      starts_at: toInputDatetimeLocal(f.starts_at),
      ends_at: toInputDatetimeLocal(f.ends_at),
      is_active: !!f.is_active,
      is_featured: !!(f as any).is_featured,
      featured_rank: (f as any).featured_rank === null || (f as any).featured_rank === undefined ? '' : String((f as any).featured_rank),
    });
    setFormOpen(true);
  };

  const save = async () => {
    if (!canUse) return;
    if (saving) return;

    const title = String(form.title || '').trim();
    if (!title) return;

    setSaving(true);
    try {
      const payload: any = {
        title,
        description: String(form.description || '').trim() || null,
        image_url: String(form.image_url || '').trim() || null,
        target_url: String(form.target_url || '').trim() || null,
        normal_price: String(form.normal_price || '').trim() === '' ? null : Number(form.normal_price),
        promo_price: String(form.promo_price || '').trim() === '' ? null : Number(form.promo_price),
        observations: String(form.observations || '').trim() || null,
        starts_at: fromInputDatetimeLocal(form.starts_at),
        ends_at: fromInputDatetimeLocal(form.ends_at),
        is_active: !!form.is_active,
        is_featured: !!form.is_featured,
        featured_rank: String(form.featured_rank || '').trim() === '' ? null : Number(form.featured_rank),
      };

      if (form.id) {
        await supabase.from('mkt_flyers').update(payload).eq('id', form.id);
      } else {
        await supabase.from('mkt_flyers').insert(payload);
      }

      setFormOpen(false);
      await load();
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!canUse) return;
    if (!id) return;
    await supabase.from('mkt_flyers').delete().eq('id', id);
    await load();
  };

  const toggleActive = async (f: MktFlyer) => {
    if (!canUse) return;
    if (!f?.id) return;
    await supabase
      .from('mkt_flyers')
      .update({ is_active: !f.is_active })
      .eq('id', f.id);
    await load();
  };

  return (
    <div className="h-full w-full overflow-y-auto p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs text-slate-500">Admin</div>
          <h1 className="text-2xl font-extrabold text-slate-800">Gestion des flyers</h1>
          <div className="text-xs text-slate-500 mt-1">Créer, modifier, supprimer, programmer et mettre en avant les offres du slider.</div>
        </div>

        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 bg-brand-blue text-white px-4 py-3 rounded-xl font-extrabold hover:bg-teal-700"
        >
          <Plus className="w-4 h-4" />
          Nouveau flyer
        </button>
      </div>

      {loading ? (
        <div className="mt-10 flex items-center gap-2 text-slate-600">
          <Loader2 className="w-5 h-5 animate-spin" />
          Chargement...
        </div>
      ) : (
        <div className="mt-6 bg-white border border-slate-100 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-[1000px] w-full text-sm">
              <thead className="bg-slate-50">
                <tr className="text-left text-slate-600">
                  <th className="px-4 py-3">Titre</th>
                  <th className="px-4 py-3">Statut</th>
                  <th className="px-4 py-3">Actif</th>
                  <th className="px-4 py-3">Début</th>
                  <th className="px-4 py-3">Fin</th>
                  <th className="px-4 py-3">Prix</th>
                  <th className="px-4 py-3">Promo</th>
                  <th className="px-4 py-3">Slider</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-slate-100">
                    <td className="px-4 py-3">
                      <button onClick={() => openEdit(r)} className="font-extrabold text-slate-800 hover:underline">
                        {r.title}
                      </button>
                      <div className="text-xs text-slate-500 line-clamp-1">{r.description || ''}</div>
                    </td>
                    <td className="px-4 py-3 font-bold text-slate-700">{getStatusLabel(r)}</td>
                    <td className="px-4 py-3 font-bold">{r.is_active ? 'Oui' : 'Non'}</td>
                    <td className="px-4 py-3 text-xs text-slate-600">{r.starts_at ? new Date(r.starts_at).toLocaleString() : '-'}</td>
                    <td className="px-4 py-3 text-xs text-slate-600">{r.ends_at ? new Date(r.ends_at).toLocaleString() : '-'}</td>
                    <td className="px-4 py-3 font-bold">{r.normal_price === null ? '-' : `${Number(r.normal_price).toFixed(2)} €`}</td>
                    <td className="px-4 py-3 font-extrabold text-brand-orange">{r.promo_price === null ? '-' : `${Number(r.promo_price).toFixed(2)} €`}</td>
                    <td className="px-4 py-3 font-bold">{(r as any).is_featured ? `Oui (#${(r as any).featured_rank ?? '-'})` : 'Non'}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => toggleActive(r)}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-xl font-bold text-slate-700 hover:bg-slate-100"
                      >
                        {r.is_active ? 'Désactiver' : 'Activer'}
                      </button>
                      <button
                        onClick={() => remove(r.id)}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-xl font-bold text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                        Supprimer
                      </button>
                    </td>
                  </tr>
                ))}

                {rows.length === 0 ? (
                  <tr>
                    <td className="px-4 py-8 text-center text-slate-600" colSpan={9}>
                      Aucun flyer.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {formOpen ? (
        <div className="fixed inset-0 z-[9999]">
          <button className="absolute inset-0 bg-black/40" onClick={() => setFormOpen(false)} aria-label="Fermer" />
          <div className="absolute inset-x-0 top-10 px-4">
            <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden max-h-[90vh] flex flex-col">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <div className="text-lg font-extrabold text-slate-800">{form.id ? 'Modifier un flyer' : 'Créer un flyer'}</div>
                <button
                  onClick={save}
                  disabled={saving}
                  className="inline-flex items-center gap-2 bg-brand-blue text-white px-4 py-2 rounded-xl font-extrabold hover:bg-teal-700 disabled:opacity-60"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Enregistrer
                </button>
              </div>

              <div className="p-5 space-y-4 overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Titre</label>
                    <input
                      value={form.title}
                      onChange={(e) => setForm((s) => ({ ...s, title: e.target.value }))}
                      className="w-full border border-slate-200 rounded-xl px-4 py-3"
                      placeholder="Ex: -20% sur le ménage (Semaine spéciale)"
                    />
                    <div className="text-[11px] text-slate-500 mt-1">Titre court et clair (recommandé: 5 à 60 caractères).</div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-bold text-slate-700 mb-1">Image</label>
                      <select
                        value={imageMode}
                        onChange={(e) => setImageMode(e.target.value as any)}
                        className="border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-700"
                      >
                        <option value="url">Depuis un lien</option>
                        <option value="upload">Charger une photo</option>
                      </select>
                    </div>

                    {imageMode === 'url' ? (
                      <input
                        value={form.image_url}
                        onChange={(e) => setForm((s) => ({ ...s, image_url: e.target.value }))}
                        className="w-full border border-slate-200 rounded-xl px-4 py-3"
                        placeholder="Lien direct vers une image (PNG/JPG). Ex: https://..."
                      />
                    ) : (
                      <input
                        type="file"
                        accept="image/*"
                        onChange={async (e) => {
                          const file = (e.target.files || [])[0];
                          if (!file) return;
                          try {
                            const url = await fileToDataUrl(file);
                            setForm((s) => ({ ...s, image_url: url }));
                          } catch {
                            // ignore
                          }
                        }}
                        className="w-full border border-slate-200 rounded-xl px-4 py-3 bg-white"
                      />
                    )}

                    {String(form.image_url || '').trim() ? (
                      <div className="mt-2 border border-slate-100 rounded-xl overflow-hidden bg-slate-50">
                        <img src={form.image_url} alt="Aperçu" className="w-full h-40 object-cover" />
                      </div>
                    ) : null}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Description</label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm((s) => ({ ...s, description: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl px-4 py-3 min-h-24"
                    placeholder="Décris l’offre en 2-4 lignes (ce qui est inclus, conditions, zone géographique, etc.)"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Observations</label>
                  <textarea
                    value={form.observations}
                    onChange={(e) => setForm((s) => ({ ...s, observations: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl px-4 py-3 min-h-20"
                    placeholder="Informations complémentaires (ex: limité aux 20 premières demandes, hors week-end, etc.)"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">URL cible (clic sur l’offre)</label>
                  <input
                    value={form.target_url}
                    onChange={(e) => setForm((s) => ({ ...s, target_url: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl px-4 py-3"
                    placeholder="Page web à ouvrir au clic (optionnel). Ex: https://prestataire.com/offre"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Prix normal</label>
                    <input
                      value={form.normal_price}
                      onChange={(e) => setForm((s) => ({ ...s, normal_price: e.target.value }))}
                      className="w-full border border-slate-200 rounded-xl px-4 py-3"
                      placeholder="Ex: 120"
                      inputMode="decimal"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Prix promo</label>
                    <input
                      value={form.promo_price}
                      onChange={(e) => setForm((s) => ({ ...s, promo_price: e.target.value }))}
                      className="w-full border border-slate-200 rounded-xl px-4 py-3"
                      placeholder="Ex: 89"
                      inputMode="decimal"
                    />
                  </div>
                  <div className="flex items-end gap-3">
                    <label className="inline-flex items-center gap-2 text-sm font-bold text-slate-700">
                      <input type="checkbox" checked={form.is_active} onChange={(e) => setForm((s) => ({ ...s, is_active: e.target.checked }))} />
                      Actif
                    </label>
                    <label className="inline-flex items-center gap-2 text-sm font-bold text-slate-700">
                      <input type="checkbox" checked={form.is_featured} onChange={(e) => setForm((s) => ({ ...s, is_featured: e.target.checked }))} />
                      Mis en avant (slider)
                    </label>
                  </div>
                </div>

                <div className="text-[11px] text-slate-500">
                  - <strong>Actif</strong> : l’offre peut être affichée au public (si les dates le permettent).
                  <br />
                  - <strong>Mis en avant</strong> : affiche l’offre dans le slider / pop-up “Offre du moment”.
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Début promo</label>
                    <input
                      type="datetime-local"
                      value={form.starts_at}
                      onChange={(e) => setForm((s) => ({ ...s, starts_at: e.target.value }))}
                      className="w-full border border-slate-200 rounded-xl px-4 py-3"
                    />
                    <div className="text-[11px] text-slate-500 mt-1">Début d’affichage de l’offre (prérempli : aujourd’hui).</div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Fin promo</label>
                    <input
                      type="datetime-local"
                      value={form.ends_at}
                      onChange={(e) => setForm((s) => ({ ...s, ends_at: e.target.value }))}
                      className="w-full border border-slate-200 rounded-xl px-4 py-3"
                    />
                    <div className="text-[11px] text-slate-500 mt-1">Fin d’affichage de l’offre (prérempli : +1 mois).</div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Ordre slider</label>
                    <input
                      value={form.featured_rank}
                      onChange={(e) => setForm((s) => ({ ...s, featured_rank: e.target.value }))}
                      className="w-full border border-slate-200 rounded-xl px-4 py-3"
                      placeholder="Ex: 1 (le plus haut)"
                      inputMode="numeric"
                    />
                    <div className="text-[11px] text-slate-500 mt-1">Plus petit = plus haut.</div>
                  </div>
                </div>
              </div>

              <div className="px-5 py-4 border-t border-slate-100 flex justify-end">
                <button onClick={() => setFormOpen(false)} className="px-4 py-2 rounded-xl font-bold text-slate-700 hover:bg-slate-100">
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

export default AdminFlyersPage;
