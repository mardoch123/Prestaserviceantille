import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { createCustomerRequest, getFlyerById, mktAutoCreateClient } from '../client';
import type { MktFlyer } from '../types';
import { useData } from '../../../context/DataContext';
import MarketingPublicShell from './MarketingPublicShell';
import SearchableSelect from '../../../components/SearchableSelect';

type FormState = {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  message: string;
  city: string;
  address: string;
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
  const [emailDebugError, setEmailDebugError] = useState<string | null>(null);

  const [form, setForm] = useState<FormState>({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    message: '',
    city: '',
    address: '',
  });

  const CITY_OPTIONS = useMemo(
    () => [
      "Les Anses-d'Arlet",
      'Ajoupa-Bouillon',
      'Basse-Pointe',
      'Bellefontaine',
      'Le Carbet',
      'Case-Pilote',
      'Le Diamant',
      'Ducos',
      'Fonds-Saint-Denis',
      'Fort-de-France',
      'Le François',
      "Grand'Rivière",
      'Gros-Morne',
      'Le Lamentin',
      'Le Lorrain',
      'Macouba',
      'Le Marin',
      'Le Marigot',
      'Le Morne-Rouge',
      'Le Morne-Vert',
      'Le Prêcheur',
      'Rivière-Pilote',
      'Rivière-Salée',
      'Le Robert',
      'Saint-Esprit',
      'Saint-Joseph',
      'Saint-Pierre',
      'Sainte-Anne',
      'Sainte-Luce',
      'Sainte-Marie',
      'Schœlcher',
      'La Trinité',
      'Les Trois-Îlets',
      'Le Vauclin',
    ].map((c) => ({ value: c, label: c })),
    []
  );

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

    const firstName = String(form.first_name || '').trim();
    const lastName = String(form.last_name || '').trim();
    const fullName = `${firstName} ${lastName}`.trim();
    if (!firstName || !lastName) {
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

      // Ensure the client is actually created (best effort is sometimes blocked by edge/RLS).
      // Retry once to mitigate transient failures.
      try {
        setEmailDebugError(null);
        const city = String(form.city || '').trim() || null;
        const address = String(form.address || '').trim() || null;
        const attempt1 = await mktAutoCreateClient({
          full_name: fullName,
          email,
          phone: String(form.phone || '').trim() || null,
          address,
          city,
        });

        if (attempt1?.ok && attempt1?.emailSent === false) {
          console.warn('[FlyerRequestPage] welcome email not sent', attempt1?.emailError);
          if (attempt1?.emailError) setEmailDebugError(String(attempt1.emailError));
          setError(
            "Ta demande a bien été envoyée, mais l'email contenant tes identifiants n'a pas pu être envoyé automatiquement. L'équipe va te recontacter."
          );
        }

        if (!attempt1?.ok) {
          const errMsg1 = String(attempt1?.error || '').trim();
          if (errMsg1 && (errMsg1.includes('déjà utilisé') || errMsg1.toLowerCase().includes('doublon'))) {
            setError(`Ta demande a bien été envoyée. ${errMsg1} Si tu as déjà un compte, connecte-toi.`);
            return;
          }
          const attempt2 = await mktAutoCreateClient({
            full_name: fullName,
            email,
            phone: String(form.phone || '').trim() || null,
            address,
            city,
          });
          if (!attempt2?.ok) {
            const errMsg2 = String(attempt2?.error || '').trim();
            if (errMsg2 && (errMsg2.includes('déjà utilisé') || errMsg2.toLowerCase().includes('doublon'))) {
              setError(`Ta demande a bien été envoyée. ${errMsg2} Si tu as déjà un compte, connecte-toi.`);
              return;
            }
            console.warn('[FlyerRequestPage] mkt-auto-create-client failed', attempt2?.error || attempt1?.error);
            setError(
              "Ta demande a bien été envoyée, mais la création automatique de ton compte client a échoué. L'équipe va te recontacter pour te donner tes identifiants."
            );
          } else if (attempt2?.emailSent === false) {
            console.warn('[FlyerRequestPage] welcome email not sent (attempt2)', attempt2?.emailError);
            if (attempt2?.emailError) setEmailDebugError(String(attempt2.emailError));
            setError(
              "Ta demande a bien été envoyée, mais l'email contenant tes identifiants n'a pas pu être envoyé automatiquement. L'équipe va te recontacter."
            );
          }
        }
      } catch (err) {
        console.warn('[FlyerRequestPage] mkt-auto-create-client unexpected error', err);
      }

      setSent(true);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <MarketingPublicShell
      title="S'inscrire"
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

          {error ? (
            <div className="mt-6 bg-orange-50 border border-orange-200 text-orange-800 rounded-xl px-4 py-3 text-sm font-bold">
              {error}
            </div>
          ) : null}

          {emailDebugError ? (
            <div className="mt-3 bg-slate-50 border border-slate-200 text-slate-700 rounded-xl px-4 py-3 text-xs font-bold">
              Détail technique: {emailDebugError}
            </div>
          ) : null}

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
              <label className="block text-xs font-bold text-slate-700 mb-1">Nom</label>
              <input
                value={form.last_name}
                onChange={(e) => setForm((s) => ({ ...s, last_name: e.target.value }))}
                className="w-full border border-slate-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-brand-blue/30"
                placeholder="Ex: Dupont"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Prénom</label>
              <input
                value={form.first_name}
                onChange={(e) => setForm((s) => ({ ...s, first_name: e.target.value }))}
                className="w-full border border-slate-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-brand-blue/30"
                placeholder="Ex: Jean"
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
                <label className="block text-xs font-bold text-slate-700 mb-1">Ville</label>
                <SearchableSelect
                  options={CITY_OPTIONS}
                  value={form.city}
                  onChange={(value) => setForm((s) => ({ ...s, city: value }))}
                  placeholder="Sélectionner une ville"
                  triggerClassName="rounded-xl px-4 py-3"
                  dropdownClassName="rounded-xl"
                  usePortal
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Adresse</label>
                <input
                  value={form.address}
                  onChange={(e) => setForm((s) => ({ ...s, address: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-brand-blue/30"
                  placeholder="Ex: 12 rue ..."
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
