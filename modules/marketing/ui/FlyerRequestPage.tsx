import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { createCustomerRequest, getFlyerById } from '../client';
import type { MktFlyer } from '../types';

type FormState = {
  full_name: string;
  email: string;
  phone: string;
  message: string;
};

const FlyerRequestPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams();

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

    setSubmitting(true);
    try {
      const res = await createCustomerRequest({
        full_name: fullName,
        email: String(form.email || '').trim() || null,
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
    <div className="min-h-screen bg-cream-50 font-sans">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-sm font-bold text-slate-700 hover:text-slate-900"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour
          </button>
          <div className="text-right">
            <div className="text-xs text-slate-500">Demande</div>
          </div>
        </div>

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
            <div className="text-lg font-extrabold text-slate-800">Demande envoyée</div>
            <div className="text-sm text-slate-600 mt-2">
              Merci. L’équipe va te recontacter rapidement.
            </div>
            <div className="mt-6 flex gap-3">
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
          <div className="mt-6 bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
            <h1 className="text-xl font-extrabold text-slate-800">Faire une demande</h1>
            <div className="text-sm text-slate-600 mt-1">Offre: {flyer.title}</div>

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
                  'Envoyer la demande'
                )}
              </button>
            </form>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default FlyerRequestPage;
