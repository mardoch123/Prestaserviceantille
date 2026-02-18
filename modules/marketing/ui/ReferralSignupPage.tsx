import React, { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { DEFAULT_SERVICE_TYPES } from '../../../utils/serviceTypes';
import { createClientLead } from '../client';
import { useData } from '../../../context/DataContext';
import MarketingPublicShell from './MarketingPublicShell';

type FormState = {
  full_name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  service_type: string;
  referral_code: string;
};

const ReferralSignupPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { companySettings } = useData();

  const initialCode = useMemo(() => String(searchParams.get('code') || '').trim(), [searchParams]);

  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<FormState>({
    full_name: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    service_type: DEFAULT_SERVICE_TYPES[0] || 'Autre',
    referral_code: '',
  });

  useEffect(() => {
    setForm((s) => ({
      ...s,
      referral_code: s.referral_code || initialCode,
    }));
  }, [initialCode]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    setError(null);

    const fullName = String(form.full_name || '').trim();
    const email = String(form.email || '').trim();
    const address = String(form.address || '').trim();
    const city = String(form.city || '').trim();

    if (!fullName) {
      setError('Nom et prénom requis.');
      return;
    }

    if (!email) {
      setError('Email requis.');
      return;
    }

    if (!address) {
      setError('Adresse requise.');
      return;
    }

    if (!city) {
      setError('Ville requise.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await createClientLead({
        full_name: fullName,
        email,
        phone: String(form.phone || '').trim() || null,
        address,
        city,
        service_type: String(form.service_type || '').trim() || null,
        referral_code: String(form.referral_code || '').trim() || null,
      });

      if (!res) {
        setError("Impossible d'envoyer la demande pour le moment.");
        return;
      }

      setSent(true);
    } catch (e: any) {
      const msg = String(e?.message || '');
      if (msg === 'referrer_blocked') {
        setError('Ce code parrain est bloqué.');
      } else if (msg.toLowerCase().includes('no api key found')) {
        setError("Erreur configuration Supabase: clé API manquante (header apikey)." );
      } else if (msg) {
        setError(msg);
      } else {
        setError('Une erreur est survenue.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <MarketingPublicShell
      title="Inscription"
      subtitle="Parrainage"
      onBack={() => navigate(-1)}
      logoUrl={companySettings?.logoUrl}
      brandName={companySettings?.name}
      maxWidthClassName="max-w-2xl"
    >
      {sent ? (
        <div className="mt-8 bg-white border border-slate-100 rounded-2xl p-6">
          <div className="text-lg font-extrabold text-slate-800">Demande envoyée</div>
          <div className="text-sm text-slate-600 mt-2">
            Merci. Ton compte sera validé par le secrétariat. Tu recevras tes identifiants par email.
          </div>
          <div className="mt-6 flex gap-3">
            <button
              onClick={() => navigate('/')}
              className="bg-brand-blue text-white px-4 py-3 rounded-xl font-extrabold hover:bg-teal-700"
            >
              Retour accueil
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-6 bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
          <div className="text-sm text-slate-600 mt-1">Remplis le formulaire pour créer ton compte.</div>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Nom & prénom</label>
              <input
                value={form.full_name}
                onChange={(e) => setForm((s) => ({ ...s, full_name: e.target.value }))}
                className="w-full border border-slate-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-brand-blue/30"
                placeholder="Ex: Jean Dupont"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-brand-blue/30"
                  placeholder="ex: jean@email.com"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Téléphone</label>
                <input
                  value={form.phone}
                  onChange={(e) => setForm((s) => ({ ...s, phone: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-brand-blue/30"
                  placeholder="ex: 0696..."
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Adresse</label>
                <input
                  value={form.address}
                  onChange={(e) => setForm((s) => ({ ...s, address: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-brand-blue/30"
                  placeholder="Ex: 12 rue des Hibiscus"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Ville</label>
                <input
                  value={form.city}
                  onChange={(e) => setForm((s) => ({ ...s, city: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-brand-blue/30"
                  placeholder="Ex: Fort-de-France"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Type de service</label>
              <select
                value={form.service_type}
                onChange={(e) => setForm((s) => ({ ...s, service_type: e.target.value }))}
                className="w-full border border-slate-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-brand-blue/30 bg-white"
              >
                {DEFAULT_SERVICE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Code parrain (optionnel)</label>
              <input
                value={form.referral_code}
                onChange={(e) => setForm((s) => ({ ...s, referral_code: e.target.value }))}
                className="w-full border border-slate-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-brand-blue/30"
                placeholder="Ex: ABCD1234"
              />
            </div>

            {error ? (
              <div className="text-sm font-bold text-red-600 bg-red-50 border border-red-100 rounded-xl p-3">{error}</div>
            ) : null}

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-brand-blue text-white px-4 py-3 rounded-xl font-extrabold hover:bg-teal-700 disabled:opacity-60 disabled:hover:bg-brand-blue flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Envoi...
                </>
              ) : (
                "Créer mon compte"
              )}
            </button>
          </form>
        </div>
      )}
    </MarketingPublicShell>
  );
};

export default ReferralSignupPage;
