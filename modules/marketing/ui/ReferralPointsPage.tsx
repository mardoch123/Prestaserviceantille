import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../../../context/DataContext';
import { getMyFilleulStats, getMyPointsSummary, getMyReferrerProfile, getPointsSummaryByCode } from '../client';
import type { MktFilleulStats, MktPointsLedgerEntry, MktPointsSummary, MktReferrer } from '../types';

const formatReason = (reason: string) => {
  switch (reason) {
    case 'invoice_paid':
      return 'Facture payée';
    case 'mission_completed':
      return 'Mission terminée';
    case 'manual_adjustment':
      return 'Ajustement manuel';
    case 'reward_redemption':
      return 'Récompense';
    default:
      return reason;
  }
};

const PointsHistory: React.FC<{ history: MktPointsLedgerEntry[] }> = ({ history }) => {
  if (!history.length) {
    return <div className="text-sm text-slate-500">Aucun mouvement pour le moment.</div>;
  }

  return (
    <div className="space-y-2">
      {history.map((h) => (
        <div key={h.id} className="bg-white rounded-xl border border-slate-100 p-3 flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-extrabold text-slate-800">{formatReason(String(h.reason || ''))}</div>
            <div className="text-xs text-slate-500">{new Date(h.created_at).toLocaleString()}</div>
          </div>
          <div className={`text-sm font-extrabold ${Number(h.points) >= 0 ? 'text-green-600' : 'text-red-600'}`}>{Number(h.points) >= 0 ? '+' : ''}{h.points}</div>
        </div>
      ))}
    </div>
  );
};

const ReferralPointsPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useData();

  const isLoggedIn = useMemo(() => !!currentUser?.id, [currentUser?.id]);

  const [mode, setMode] = useState<'auto' | 'code'>('auto');
  const [code, setCode] = useState('');

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<MktPointsSummary | null>(null);
  const [filleulStats, setFilleulStats] = useState<MktFilleulStats | null>(null);
  const [myReferrer, setMyReferrer] = useState<MktReferrer | null>(null);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      if (!currentUser?.id) {
        if (mounted) {
          setSummary(null);
          setFilleulStats(null);
          setMyReferrer(null);
          setLoading(false);
          setError(null);
        }
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const s = await getMyPointsSummary();
        if (mounted) setSummary(s);

        const fs = await getMyFilleulStats();
        if (mounted) setFilleulStats(fs);

        const rp = await getMyReferrerProfile();
        if (mounted) setMyReferrer(rp);
      } catch {
        if (mounted) setError("Impossible de charger les points.");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    run();

    return () => {
      mounted = false;
    };
  }, [currentUser?.id]);

  const onSubmitCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    setError(null);
    setSummary(null);

    const c = String(code || '').trim();
    if (!c) {
      setError('Code parrain requis.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await getPointsSummaryByCode(c);
      if (!res) {
        setError('Code invalide ou aucun point disponible.');
        return;
      }
      setSummary(res);
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
            <h1 className="text-xl font-extrabold text-slate-800">Mes points</h1>
            <div className="text-xs text-slate-500">Parrainage</div>
          </div>
        </div>

        <div className="mt-6 bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm font-extrabold text-slate-800">Mode</div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setMode('auto')}
                className={`px-3 py-2 rounded-xl text-xs font-extrabold border ${mode === 'auto' ? 'bg-brand-blue text-white border-brand-blue' : 'bg-white text-slate-700 border-slate-200'}`}
              >
                Connecté
              </button>
              <button
                type="button"
                onClick={() => setMode('code')}
                className={`px-3 py-2 rounded-xl text-xs font-extrabold border ${mode === 'code' ? 'bg-brand-orange text-white border-brand-orange' : 'bg-white text-slate-700 border-slate-200'}`}
              >
                Code parrain
              </button>
            </div>
          </div>

          {loading ? (
            <div className="mt-4 flex items-center gap-2 text-slate-600">
              <Loader2 className="w-5 h-5 animate-spin" />
              Chargement...
            </div>
          ) : null}

          {mode === 'auto' && !isLoggedIn ? (
            <div className="mt-4 text-sm text-slate-600">
              Tu n'es pas connecté. Passe en mode "Code parrain".
            </div>
          ) : null}

          {mode === 'code' ? (
            <form onSubmit={onSubmitCode} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Code parrain</label>
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-3 text-sm"
                  placeholder="Ex: PARRAIN-1234"
                />
              </div>

              {error ? <div className="text-sm text-red-600 font-bold">{error}</div> : null}

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-brand-orange text-white px-4 py-3 rounded-xl font-extrabold hover:bg-orange-600 disabled:opacity-60"
              >
                {submitting ? (
                  <span className="inline-flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Vérification...
                  </span>
                ) : (
                  'Voir mes points'
                )}
              </button>
            </form>
          ) : null}
        </div>

        {summary ? (
          <div className="mt-6">
            {myReferrer && String((myReferrer as any).status || 'active') !== 'active' ? (
              <div className="mb-4 bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
                <div className="text-sm font-extrabold text-slate-800">Compte parrain bloqué</div>
                <div className="mt-1 text-sm text-slate-600">Accès aux points indisponible.</div>
              </div>
            ) : myReferrer ? (
              <div className="mb-4 bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
                <div className="text-sm font-extrabold text-slate-800">Mon profil parrain</div>
                <div className="mt-1 text-sm text-slate-600">Code : <span className="font-extrabold text-slate-900">{String((myReferrer as any).referral_code || '')}</span></div>
                <div className="mt-1 text-xs text-slate-500">
                  Type : {(myReferrer as any).is_lambda ? 'Parrain lambda' : 'Parrain normal'} • Seuil Pack Ultime 6 : {Number((myReferrer as any).pack_ultime6_threshold || ((myReferrer as any).is_lambda ? 1500 : 1000))} points
                </div>
                <div className="mt-2 text-sm font-extrabold text-slate-800">
                  Packs Ultime 6 obtenus : <span className="text-brand-orange">{Number((myReferrer as any).pack_ultime6_earned_count || 0)}</span>
                </div>
              </div>
            ) : null}

            {filleulStats ? (
              <div className="mb-4 bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
                <div className="text-sm font-extrabold text-slate-800">Compteur de prestations (filleul)</div>
                <div className="mt-1 text-sm text-slate-600">Prestations payées : <span className="font-extrabold text-slate-900">{filleulStats.paid_invoices_count}</span> / 2</div>
                <div className="mt-1 text-xs text-slate-500">Après la 2ᵉ prestation payée, tu deviens automatiquement parrain.</div>
                <div className="mt-2 text-sm font-extrabold">
                  Statut : <span className={filleulStats.is_referrer ? 'text-green-700' : 'text-slate-700'}>{filleulStats.is_referrer ? 'Parrain actif' : 'Filleul'}</span>
                </div>
              </div>
            ) : null}

            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
              <div className="text-xs text-slate-500">Solde</div>
              <div className="text-3xl font-extrabold text-slate-900">{summary.balance}</div>
            </div>

            <div className="mt-4">
              <div className="text-sm font-extrabold text-slate-800 mb-2">Historique</div>
              <PointsHistory history={summary.history || []} />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default ReferralPointsPage;
