import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { createClientLead, mktEmailExistsGlobal } from '../client.ts';
import { useData } from '../../../context/DataContext';
import SearchableSelect from '../../../components/SearchableSelect';

const useQuery = () => {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
};

const RegisterFilleulPage: React.FC = () => {
  const navigate = useNavigate();
  const query = useQuery();
  const { currentUser, companySettings } = useData();

  const clientReferrerCodeKey = 'mkt_client_referral_code';

  const [referralCode, setReferralCode] = useState(query.get('code') || '');
  const [codeLocked, setCodeLocked] = useState(false);
  const [showCreateCodePrompt, setShowCreateCodePrompt] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const martiniqueCities = useMemo(() => ([
    'Fort-de-France',
    'Le Lamentin',
    'Schoelcher',
    'Le Robert',
    'Trinité',
    'Le François',
    'Ducos',
    'Rivière-Salée',
    'Le Marin',
    'Sainte-Marie',
    'Saint-Joseph',
    'La Trinité',
    'Le Vauclin',
    'Sainte-Anne',
    'Saint-Pierre',
    'Le Carbet',
    'Case-Pilote',
    'Bellefontaine',
    'Le Morne-Rouge',
    'Le Prêcheur',
    'Rivière-Pilote',
    'Les Trois-Îlets',
    'Les Anses-d\'Arlet',
    'Le Diamant',
    'Le Lorrain',
    'Macouba',
    'Basse-Pointe',
    'Le Marigot',
    'Gros-Morne',
    'Sainte-Luce',
    'Grand\'Rivière'
  ]), []);

  useEffect(() => {
    if (!currentUser?.id) return;
    try {
      const code = String(localStorage.getItem(clientReferrerCodeKey) || '').trim();
      if (!code) return;
      setReferralCode(code);
      setCodeLocked(true);
    } catch {
      // ignore
    }
  }, [currentUser?.id]);

  useEffect(() => {
    if (!currentUser?.id) return;
    try {
      const stored = String(localStorage.getItem(clientReferrerCodeKey) || '').trim();
      const urlCode = String(query.get('code') || '').trim();
      if (!stored && !urlCode) {
        setShowCreateCodePrompt(true);
      }
    } catch {
      // ignore
    }
  }, [currentUser?.id, query]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    setError(null);

    const code = String(referralCode || '').trim();
    if (!code) {
      setError('Code parrain requis.');
      return;
    }

    const name = String(fullName || '').trim();
    const mail = String(email || '').trim();
    const tel = String(phone || '').trim();
    const addr = String(address || '').trim();
    const cty = String(city || '').trim();
    if (!name) {
      setError('Nom requis.');
      return;
    }
    if (!mail) {
      setError('Email requis.');
      return;
    }
    if (!tel) {
      setError('Téléphone requis.');
      return;
    }
    if (!addr) {
      setError('Adresse requise.');
      return;
    }
    if (!cty) {
      setError('Ville requise.');
      return;
    }

    setSubmitting(true);
    try {
      const exists = await mktEmailExistsGlobal(mail);
      if (exists) {
        setError('Cet email existe déjà.');
        return;
      }

      const res = await createClientLead({
        referral_code: code,
        full_name: name,
        email: mail,
        phone: tel,
        address: addr,
        city: cty,
        service_type: null,
      } as any);

      if (!res) {
        setError("Impossible d'inscrire le filleul pour le moment.");
        return;
      }

      setSent(true);
    } catch (e: any) {
      const msg = String(e?.message || '');
      if (msg === 'referrer_blocked') {
        setError('Ce code parrain est bloqué. Inscription impossible.');
        return;
      }
      if (msg.toLowerCase().includes('no api key found')) {
        setError("Erreur configuration Supabase: clé API manquante (header apikey)." );
      } else if (msg) {
        setError(msg);
      } else {
        setError("Impossible d'inscrire le filleul pour le moment.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-cream-50 font-sans">
      <div className="max-w-xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-sm font-bold text-slate-700 hover:text-slate-900"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour
          </button>
          <div className="text-right">
            <div className="text-xs text-slate-500">Parrainage</div>
          </div>
        </div>

        {sent ? (
          <div className="mt-8 bg-white border border-slate-100 rounded-2xl p-6">
            <div className="flex flex-col items-center text-center">
              {companySettings?.logoUrl ? (
                <img src={companySettings.logoUrl} alt="Logo" className="h-20 w-auto object-contain" />
              ) : null}
              {companySettings?.name ? (
                <div className="mt-2 text-sm font-extrabold text-slate-800">{companySettings.name}</div>
              ) : null}
            </div>
            <div className="text-lg font-extrabold text-slate-800">Filleul inscrit</div>
            <div className="text-sm text-slate-600 mt-2">Le filleul est activé automatiquement.</div>
            <div className="mt-6">
              <button
                onClick={() => navigate('/flyers')}
                className="bg-brand-blue text-white px-4 py-3 rounded-xl font-extrabold hover:bg-teal-700"
              >
                Voir les offres
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-8 bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
            <div className="flex flex-col items-center text-center">
              {companySettings?.logoUrl ? (
                <img src={companySettings.logoUrl} alt="Logo" className="h-20 w-auto object-contain" />
              ) : null}
              {companySettings?.name ? (
                <div className="mt-2 text-sm font-extrabold text-slate-800">{companySettings.name}</div>
              ) : null}
            </div>
            <h1 className="text-xl font-extrabold text-slate-800">Inscrire un filleul</h1>
            <div className="text-sm text-slate-600 mt-1">Le parrain peut inscrire un proche.</div>

            {showCreateCodePrompt ? (
              <div className="mt-6 bg-orange-50 border border-orange-100 rounded-2xl p-5">
                <div className="text-sm font-extrabold text-orange-800">Tu n'as pas encore de code parrain</div>
                <div className="text-sm text-orange-700 mt-2">Crée ton code parrain pour pouvoir inscrire un filleul.</div>
                <div className="mt-4 flex flex-col sm:flex-row gap-3">
                  <button
                    type="button"
                    onClick={() => navigate('/parrainage/devenir-parrain-client')}
                    className="bg-brand-blue text-white px-4 py-3 rounded-xl font-extrabold hover:bg-teal-700"
                  >
                    Créer mon code
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCreateCodePrompt(false)}
                    className="bg-white border border-orange-200 text-orange-800 px-4 py-3 rounded-xl font-extrabold hover:bg-orange-100"
                  >
                    Plus tard
                  </button>
                </div>
              </div>
            ) : null}

            <form onSubmit={onSubmit} className="mt-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Code parrain</label>
                <input
                  value={referralCode}
                  onChange={(e) => setReferralCode(e.target.value)}
                  disabled={codeLocked}
                  className={`w-full border border-slate-200 rounded-xl px-4 py-3 ${codeLocked ? 'bg-slate-50 text-slate-500 cursor-not-allowed' : ''}`}
                  placeholder="Ex: ABCD1234"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Nom du filleul</label>
                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-4 py-3"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Email du filleul</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-4 py-3"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Téléphone du filleul</label>
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-4 py-3"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Adresse</label>
                <input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-4 py-3"
                  placeholder="Numéro et voie"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Ville</label>
                <SearchableSelect
                  options={martiniqueCities.map((c) => ({ value: c, label: c }))}
                  value={city}
                  onChange={(v) => setCity(v)}
                  placeholder="Sélectionner une ville..."
                  usePortal
                  dropdownClassName="max-h-80"
                />
              </div>

              {error ? (
                <div className="text-sm font-bold text-red-600 bg-red-50 border border-red-100 rounded-xl p-3">{error}</div>
              ) : null}

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-brand-orange text-white px-4 py-3 rounded-xl font-extrabold hover:bg-orange-600 disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Inscription...
                  </>
                ) : (
                  'Valider'
                )}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

export default RegisterFilleulPage;
