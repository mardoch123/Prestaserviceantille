import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Gift, Users, BadgeCheck, Loader2 } from 'lucide-react';
import { useData } from '../../../context/DataContext';
import { getMyPointsSummary, getMyReferrerProfile, getMyReferrerStats } from '../client';
import type { MktPointsSummary, MktReferrer, MktReferrerStats } from '../types';
import MarketingPublicShell from './MarketingPublicShell';

const ReferrerAccountPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser, companySettings } = useData();

  const isLoggedIn = useMemo(() => !!currentUser?.id, [currentUser?.id]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [summary, setSummary] = useState<MktPointsSummary | null>(null);
  const [stats, setStats] = useState<MktReferrerStats | null>(null);
  const [referrer, setReferrer] = useState<MktReferrer | null>(null);

  const shareUrl = useMemo(() => {
    const code = String((referrer as any)?.referral_code || '').trim();
    if (!code) return '';
    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      if (!origin) return '';
      return `${origin}/parrainage/inscrire-filleul?code=${encodeURIComponent(code)}`;
    } catch {
      return '';
    }
  }, [referrer]);

  const copyShareLink = async () => {
    const url = String(shareUrl || '').trim();
    if (!url) return;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        alert('Lien copié.');
        return;
      }
    } catch {
      // ignore
    }
    try {
      const ta = document.createElement('textarea');
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      alert('Lien copié.');
    } catch {
      alert('Copie impossible.');
    }
  };

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      if (!isLoggedIn) {
        if (mounted) {
          setLoading(false);
          setError(null);
          setSummary(null);
          setStats(null);
          setReferrer(null);
        }
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const [s, st, r] = await Promise.all([
          getMyPointsSummary(),
          getMyReferrerStats(),
          getMyReferrerProfile(),
        ]);
        if (!mounted) return;
        setSummary(s);
        setStats(st);
        setReferrer(r);
      } catch {
        if (mounted) setError("Impossible de charger ton compte parrain.");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    run();
    return () => {
      mounted = false;
    };
  }, [isLoggedIn]);

  if (!isLoggedIn) {
    return (
      <MarketingPublicShell
        title="Mon compte parrain"
        subtitle="Parrainage"
        onBack={() => navigate(-1)}
        logoUrl={companySettings?.logoUrl}
        brandName={companySettings?.name}
        maxWidthClassName="max-w-3xl"
      >
        <div className="mt-8 bg-white border border-slate-100 rounded-2xl p-6">
          <div className="text-lg font-extrabold text-slate-800">Connecte-toi pour accéder à ton compte parrain</div>
          <div className="text-sm text-slate-600 mt-2">Tu pourras suivre tes gains, tes filleuls et tes avantages.</div>
        </div>
      </MarketingPublicShell>
    );
  }

  return (
    <MarketingPublicShell
      title="Mon compte parrain"
      subtitle="Parrainage"
      onBack={() => navigate(-1)}
      logoUrl={companySettings?.logoUrl}
      brandName={companySettings?.name}
      maxWidthClassName="max-w-3xl"
    >
      {loading ? (
        <div className="mt-8 flex items-center gap-2 text-slate-600">
          <Loader2 className="w-5 h-5 animate-spin" />
          Chargement...
        </div>
      ) : error ? (
        <div className="mt-8 text-sm font-bold text-red-600 bg-red-50 border border-red-100 rounded-xl p-3">{error}</div>
      ) : !referrer ? (
        <div className="mt-8 bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
          <div className="text-xl font-extrabold text-slate-800">Tu n'as pas encore de compte parrain</div>
          <div className="text-sm text-slate-600 mt-2">Crée ton code parrain pour suivre tes gains ici.</div>
          <div className="mt-6">
            <button
              onClick={() => navigate('/parrainage/devenir-parrain-client')}
              className="bg-brand-blue text-white px-4 py-3 rounded-xl font-extrabold hover:bg-teal-700"
            >
              Créer mon code parrain
            </button>
          </div>
        </div>
      ) : String((referrer as any).status || 'active') !== 'active' ? (
        <div className="mt-8 bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
          <div className="text-xl font-extrabold text-slate-800">Ton compte parrain est bloqué</div>
          <div className="text-sm text-slate-600 mt-2">Tu ne peux plus accéder à tes points, ni inscrire de filleuls.</div>
        </div>
      ) : (
        <>
          <div className="mt-8 bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <div className="text-xs text-slate-500">Mon code parrain</div>
                <div className="text-2xl font-extrabold text-slate-800 tracking-wider">{String((referrer as any).referral_code || '')}</div>
                <div className="text-xs text-slate-500 mt-1">Profil : {(referrer as any).is_lambda ? 'parrain lambda' : 'parrain normal'}</div>
                {shareUrl ? (
                  <div className="mt-3">
                    <div className="text-xs text-slate-500">Lien de parrainage</div>
                    <div className="mt-1 flex flex-col sm:flex-row sm:items-center gap-2">
                      <a
                        href={shareUrl}
                        className="text-xs font-extrabold text-brand-blue hover:underline break-all"
                        target="_blank"
                        rel="noreferrer"
                      >
                        {shareUrl}
                      </a>
                      <button
                        type="button"
                        onClick={copyShareLink}
                        className="px-3 py-2 rounded-xl font-extrabold bg-slate-100 text-slate-800 hover:bg-slate-200 text-xs"
                      >
                        Copier
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => navigate(`/parrainage/inscrire-filleul?code=${encodeURIComponent(String((referrer as any).referral_code || ''))}`)}
                  className="bg-brand-orange text-white px-4 py-3 rounded-xl font-extrabold hover:bg-orange-600"
                >
                  Inscrire un filleul
                </button>
                <button
                  onClick={() => navigate('/parrainage/mes-filleuls')}
                  className="bg-white border border-slate-200 text-slate-800 px-4 py-3 rounded-xl font-extrabold hover:bg-slate-50"
                >
                  Mes filleuls
                </button>
                <button
                  onClick={() => navigate('/flyers')}
                  className="bg-slate-100 text-slate-800 px-4 py-3 rounded-xl font-extrabold hover:bg-slate-200"
                >
                  Voir les offres
                </button>
              </div>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center gap-2 text-slate-700 font-extrabold">
                <Gift className="w-5 h-5 text-brand-orange" /> Points
              </div>
              <div className="mt-3 text-3xl font-extrabold text-slate-800">{summary ? Number((summary as any).balance || 0) : 0}</div>
              <div className="text-xs text-slate-500 mt-1">Solde actuel</div>
            </div>

            <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center gap-2 text-slate-700 font-extrabold">
                <Users className="w-5 h-5 text-brand-blue" /> Filleuls
              </div>
              <div className="mt-3 text-3xl font-extrabold text-slate-800">{stats ? Number((stats as any).referrals_count || 0) : 0}</div>
              <div className="text-xs text-slate-500 mt-1">Nombre inscrits</div>
            </div>

            <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center gap-2 text-slate-700 font-extrabold">
                <BadgeCheck className="w-5 h-5 text-green-600" /> Factures payées
              </div>
              <div className="mt-3 text-3xl font-extrabold text-slate-800">{stats ? Number((stats as any).paid_invoices_count || 0) : 0}</div>
              <div className="text-xs text-slate-500 mt-1">Cumul sur tes filleuls</div>
            </div>
          </div>

          <div className="mt-6 bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
            <div className="text-lg font-extrabold text-slate-800">Historique des points</div>
            <div className="text-sm text-slate-600 mt-1">Les derniers mouvements (50 max).</div>

            <div className="mt-4 space-y-2">
              {(summary as any)?.history?.length ? (
                (summary as any).history.map((h: any) => (
                  <div key={String(h.id)} className="bg-slate-50 rounded-xl border border-slate-100 p-3 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-extrabold text-slate-800">{String(h.reason || '')}</div>
                      <div className="text-xs text-slate-500">{h.created_at ? new Date(h.created_at).toLocaleString() : ''}</div>
                    </div>
                    <div className={`text-sm font-extrabold ${Number(h.points) >= 0 ? 'text-green-600' : 'text-red-600'}`}>{Number(h.points) >= 0 ? '+' : ''}{Number(h.points || 0)}</div>
                  </div>
                ))
              ) : (
                <div className="text-sm text-slate-500">Aucun mouvement pour le moment.</div>
              )}
            </div>
          </div>
        </>
      )}
    </MarketingPublicShell>
  );
};

export default ReferrerAccountPage;
