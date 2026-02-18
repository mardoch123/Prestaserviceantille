import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { createCustomerRequest, getFlyerById } from '../client';
import type { MktFlyer } from '../types';
import { useData } from '../../../context/DataContext';
import MarketingPublicShell from './MarketingPublicShell';

type FormState = {
  full_name: string;
  email: string;
  phone: string;
  message: string;
};

const FlyerRequestPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { companySettings } = useData();

  const [loading, setLoading] = useState(true);
  const [flyer, setFlyer] = useState<MktFlyer | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<FormState>({
    full_name: '',
    email: '',
    phone: '',
    message: '',
  });

  const flyerId = useMemo(() => String(id || '').trim(), [id]);

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      try {
        setLoading(true);
        const row = await getFlyerById(flyerId);
        if (!mounted) return;
        setFlyer(row);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    run();

    return () => {
      mounted = false;
    };
  }, [flyerId]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    setError(null);

    const fullName = String(form.full_name || '').trim();
    if (!fullName) {
      setError('Nom et prénom requis.');
      return;
    }

    const email = String(form.email || '').trim();
    if (!email) {
      setError('Email requis.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await createCustomerRequest({
        full_name: fullName,
        email,
        phone: String(form.phone || '').trim() || null,
        message: String(form.message || '').trim() || null,
        source_flyer_id: flyerId || null,
      });

      if (!res) {
        setError("Impossible d'envoyer la demande pour le moment.");
        return;
      }

      setSent(true);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <MarketingPublicShell
      title="Faire une demande"
      subtitle={flyer ? `Offre: ${flyer.title}` : ''}
      onBack={() => navigate(-1)}
      logoUrl={companySettings?.logoUrl}
      brandName={companySettings?.name}
      maxWidthClassName="max-w-2xl"
    >
      {loading ? (
        <div className="mt-10 flex items-center justify-center gap-2 text-slate-600">
          <Loader2 className="w-5 h-5 animate-spin" />
          Chargement...
        </div>
      ) : null}

      {!loading && !flyer ? (
        <div className="mt-8 bg-white border border-slate-100 rounded-xl p-6 text-center text-slate-700">
          Flyer introuvable.
        </div>
      ) : null}

      {!loading && flyer && sent ? (
        <div className="mt-8 bg-white border border-slate-100 rounded-2xl p-6">
          <div className="flex flex-col items-center text-center">
            <div className="mt-4 text-lg font-extrabold text-slate-800">Demande envoyée</div>
            <div className="text-sm text-slate-600 mt-2">
              Merci. L’équipe va te recontacter rapidement.
            </div>
          </div>
          <div className="mt-6 flex flex-wrap gap-3 justify-center">
            <button
              onClick={() => navigate(`/flyers/${flyer.id}`)}
              className="bg-slate-100 text-slate-800 px-4 py-3 rounded-xl font-extrabold hover:bg-slate-200"
            >
              Retour au flyer
            </button>
            <button
              onClick={() => navigate('/flyers')}
              className="bg-brand-blue text-white px-4 py-3 rounded-xl font-extrabold hover:bg-teal-700"
            >
              Voir les flyers
            </button>
          </div>
        </div>
      ) : null}

      {!loading && flyer && !sent ? (
        <div className="mt-6 bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
          <form onSubmit={onSubmit} className="space-y-4 px-6 py-6">
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

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Message</label>
              <textarea
                value={form.message}
                onChange={(e) => setForm((s) => ({ ...s, message: e.target.value }))}
                className="w-full border border-slate-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-brand-blue/30 min-h-28"
                placeholder="Décris ton besoin (dates, service, adresse, etc.)"
              />
            </div>

            {error ? (
              <div className="text-sm font-bold text-red-600 bg-red-50 border border-red-100 rounded-xl p-3">{error}</div>
            ) : null}

            <div className="pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-brand-blue text-white px-4 py-3 rounded-xl font-extrabold hover:bg-teal-700 disabled:opacity-60 disabled:hover:bg-brand-blue flex items-center justify-center gap-2 opacity-100"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Envoi...
                  </>
                ) : (
                  'Envoyer ma demande'
                )}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </MarketingPublicShell>
  );
};

export default FlyerRequestPage;
