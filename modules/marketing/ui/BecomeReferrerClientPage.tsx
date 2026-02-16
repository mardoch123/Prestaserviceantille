import React, { useEffect, useState } from 'react';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../../../context/DataContext';
import { createReferrerLead, getMyReferrerProfile } from '../client';

const randomCode = () => {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 8; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
};

const BecomeReferrerClientPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser, clients, companySettings } = useData();

  const clientReferrerFlagKey = 'mkt_client_is_referrer';
  const clientReferrerCodeKey = 'mkt_client_referral_code';

  const [loading, setLoading] = useState(true);
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [referralCode, setReferralCode] = useState(randomCode());

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        if (!currentUser?.id) {
          return;
        }

        try {
          const clientProfile = (clients || []).find((c: any) => String(c?.id || '') === String(currentUser?.relatedEntityId || '')) as any;
          if (clientProfile) {
            setFullName((prev) => prev || String(clientProfile?.name || '').trim());
            setEmail((prev) => prev || String(clientProfile?.email || '').trim());
            setPhone((prev) => prev || String(clientProfile?.phone || '').trim());
          } else {
            setFullName((prev) => prev || String(currentUser?.name || '').trim());
            setEmail((prev) => prev || String(currentUser?.email || '').trim());
          }
        } catch {
          setFullName((prev) => prev || String(currentUser?.name || '').trim());
          setEmail((prev) => prev || String(currentUser?.email || '').trim());
        }

        const existing = await getMyReferrerProfile();
        if (!mounted) return;
        if (existing) {
          const existingCode = String((existing as any).referral_code || '');
          setReferralCode(existingCode);
          setFullName(String((existing as any).full_name || ''));
          setEmail(String((existing as any).email || ''));
          setPhone(String((existing as any).phone || ''));
          try {
            localStorage.setItem(clientReferrerFlagKey, '1');
            if (existingCode) localStorage.setItem(clientReferrerCodeKey, existingCode);
          } catch {
            // ignore
          }
          setSent(true);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    run();

    return () => {
      mounted = false;
    };
  }, [currentUser?.id, currentUser?.relatedEntityId, (clients || []).length]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    setError(null);

    if (!currentUser?.id) {
      setError("Connecte-toi pour devenir parrain.");
      return;
    }

    const code = String(referralCode || '').trim();
    if (!code) {
      setError('Code parrain requis.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await createReferrerLead({
        referral_code: code,
        full_name: String(fullName || '').trim() || null,
        email: String(email || '').trim() || null,
        phone: String(phone || '').trim() || null,
        auth_user_id: currentUser.id,
        is_lambda: false,
        pack_ultime6_threshold: 1000,
      } as any);

      if (!res) {
        setError("Impossible de créer le parrain pour le moment.");
        return;
      }

      try {
        localStorage.setItem(clientReferrerFlagKey, '1');
        localStorage.setItem(clientReferrerCodeKey, code);
      } catch {
        // ignore
      }

      setSent(true);
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

        {loading ? (
          <div className="mt-8 flex items-center gap-2 text-slate-600">
            <Loader2 className="w-5 h-5 animate-spin" />
            Chargement...
          </div>
        ) : sent ? (
          <div className="mt-8 bg-white border border-slate-100 rounded-2xl p-6">
            <div className="flex flex-col items-center text-center">
              {companySettings?.logoUrl ? (
                <img src={companySettings.logoUrl} alt="Logo" className="h-14 w-auto object-contain" />
              ) : null}
              {companySettings?.name ? (
                <div className="mt-2 text-sm font-extrabold text-slate-800">{companySettings.name}</div>
              ) : null}
            </div>
            <div className="text-lg font-extrabold text-slate-800">Tu es désormais parrain</div>
            <div className="text-sm text-slate-600 mt-2">
              Code parrain : <span className="font-extrabold text-slate-800">{referralCode}</span>
            </div>
            <div className="text-xs text-slate-500 mt-2">
              Profil : parrain normal • Seuil Pack Ultime 6 : 1000 points
            </div>

            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => navigate(`/parrainage/inscrire-filleul?code=${encodeURIComponent(referralCode)}`)}
                className="bg-brand-orange text-white px-4 py-3 rounded-xl font-extrabold hover:bg-orange-600"
              >
                Inscrire un filleul
              </button>
              <button
                onClick={() => navigate('/parrainage/mes-points')}
                className="bg-slate-100 text-slate-800 px-4 py-3 rounded-xl font-extrabold hover:bg-slate-200"
              >
                Mes points
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-8 bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
            <div className="flex flex-col items-center text-center">
              {companySettings?.logoUrl ? (
                <img src={companySettings.logoUrl} alt="Logo" className="h-14 w-auto object-contain" />
              ) : null}
              {companySettings?.name ? (
                <div className="mt-2 text-sm font-extrabold text-slate-800">{companySettings.name}</div>
              ) : null}
            </div>
            <h1 className="text-xl font-extrabold text-slate-800">Devenir parrain</h1>
            <div className="text-sm text-slate-600 mt-1">
              En tant que client, tu peux devenir <span className="font-bold">parrain normal</span>.
            </div>
            <div className="text-xs text-slate-500 mt-2">Seuil Pack Ultime 6 : 1000 points</div>

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
                <label className="block text-xs font-bold text-slate-700 mb-1">Nom (optionnel)</label>
                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-4 py-3"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Email (optionnel)</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-4 py-3"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Téléphone (optionnel)</label>
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
      </div>
    </div>
  );
};

export default BecomeReferrerClientPage;
