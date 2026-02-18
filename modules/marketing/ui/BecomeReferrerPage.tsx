import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { createReferrerLead, mktEmailExistsGlobal } from '../client';
import { useData } from '../../../context/DataContext';
import MarketingPublicShell from './MarketingPublicShell';

const lambdaCookieKey = 'mkt_lambda_referral_code';

const getCookie = (name: string) => {
  try {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop()?.split(';').shift() || '';
    return '';
  } catch {
    return '';
  }
};

const setCookie = (name: string, value: string, days: number) => {
  try {
    const date = new Date();
    date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
    const expires = `expires=${date.toUTCString()}`;
    document.cookie = `${name}=${encodeURIComponent(value)};${expires};path=/;samesite=lax`;
  } catch {
    // ignore
  }
};

const randomCode = () => {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 8; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
};

const BecomeReferrerPage: React.FC = () => {
  const navigate = useNavigate();
  const { companySettings } = useData();

  const existingCookieCode = String(getCookie(lambdaCookieKey) || '').trim();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [referralCode, setReferralCode] = useState(existingCookieCode || randomCode());

  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(!!existingCookieCode);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    setError(null);

    if (existingCookieCode && String(referralCode || '').trim().toLowerCase() === existingCookieCode.toLowerCase()) {
      setError("Tu es déjà parrain sur ce navigateur avec ce code.");
      return;
    }

    const code = String(referralCode || '').trim();
    if (!code) {
      setError('Code parrain requis.');
      return;
    }

    const name = String(fullName || '').trim();
    const mail = String(email || '').trim();
    const tel = String(phone || '').trim();
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

    setSubmitting(true);
    try {
      const exists = await mktEmailExistsGlobal(mail);
      if (exists) {
        setError('Cet email existe déjà.');
        return;
      }

      const res = await createReferrerLead({
        referral_code: code,
        full_name: name,
        email: mail,
        phone: tel,
        is_lambda: true,
        pack_ultime6_threshold: 1500,
      } as any);

      if (!res) {
        setError("Impossible de créer le parrain pour le moment.");
        return;
      }

      setCookie(lambdaCookieKey, code, 365);
      setSent(true);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <MarketingPublicShell
      title="Parrainage"
      subtitle="Devenir parrain"
      onBack={() => navigate(-1)}
      logoUrl={companySettings?.logoUrl}
      brandName={companySettings?.name}
      maxWidthClassName="max-w-xl"
    >
      {sent ? (
        <div className="mt-8 bg-white border border-slate-100 rounded-2xl p-6">
          <div className="text-lg font-extrabold text-slate-800">Tu es désormais parrain</div>
          <div className="text-sm text-slate-600 mt-2">
            Code parrain : <span className="font-extrabold text-slate-800">{referralCode}</span>
          </div>
          <div className="text-xs text-slate-500 mt-2">
            Profil : parrain lambda • Seuil Pack Ultime 6 : 1500 points
          </div>

          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => navigate(`/parrainage/inscrire-filleul?code=${encodeURIComponent(referralCode)}`)}
              className="bg-brand-orange text-white px-4 py-3 rounded-xl font-extrabold hover:bg-orange-600"
            >
              Inscrire un filleul
            </button>
            <button
              onClick={() => navigate('/flyers')}
              className="bg-slate-100 text-slate-800 px-4 py-3 rounded-xl font-extrabold hover:bg-slate-200"
            >
              Voir les offres
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-8 bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
          <div className="text-sm text-slate-600 mt-1">
            Toute personne peut devenir parrain, même sans prestation. Ce profil sera marqué comme <span className="font-bold">parrain lambda</span>.
          </div>
          <div className="text-xs text-slate-500 mt-2">Seuil Pack Ultime 6 : 1500 points</div>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Code parrain</label>
              <div className="flex gap-2">
                <input
                  value={referralCode}
                  onChange={(e) => setReferralCode(e.target.value)}
                  className="flex-1 border border-slate-200 rounded-xl px-4 py-3"
                />
                <button
                  type="button"
                  onClick={() => setReferralCode(randomCode())}
                  className="px-4 py-3 rounded-xl font-extrabold bg-slate-100 text-slate-800 hover:bg-slate-200"
                >
                  Générer
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Nom</label>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-4 py-3"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-4 py-3"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Téléphone</label>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-4 py-3"
                />
              </div>
            </div>

            {error ? (
              <div className="text-sm font-bold text-red-600 bg-red-50 border border-red-100 rounded-xl p-3">{error}</div>
            ) : null}

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-brand-blue text-white px-4 py-3 rounded-xl font-extrabold hover:bg-teal-700 disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Création...
                </>
              ) : (
                'Valider'
              )}
            </button>
          </form>
        </div>
      )}
    </MarketingPublicShell>
  );
};

export default BecomeReferrerPage;
