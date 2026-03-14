import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Gift,
  Users,
  Trophy,
  Star,
  Share2,
  Zap,
  ChevronRight,
  Sparkles,
  TrendingUp,
  Shield,
  Heart,
  ArrowRight,
  Copy,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import { useData } from '../../../context/DataContext';
import {
  getMyPointsSummary,
  getMyReferrerProfile,
  getMyReferrerStats,
  listActiveRewards,
  listActiveFlyers,
} from '../client';
import type { MktPointsSummary, MktReferrer, MktReferrerStats, MktReward, MktFlyer } from '../types';
import MarketingPublicShell from './MarketingPublicShell';

const FEATURES = [
  {
    icon: Gift,
    title: 'Gagnez des points',
    description: 'Accumulez des points à chaque prestation de vos filleuls',
    color: 'from-orange-400 to-red-500',
  },
  {
    icon: Users,
    title: 'Parrainez facilement',
    description: 'Invitez vos proches en quelques clics et suivez leur parcours',
    color: 'from-blue-400 to-cyan-500',
  },
  {
    icon: Trophy,
    title: 'Des récompenses uniques',
    description: 'Échangez vos points contre des prestations gratuites',
    color: 'from-purple-400 to-pink-500',
  },
  {
    icon: Zap,
    title: 'Pack Ultime 6',
    description: 'Atteignez 1000 points et obtenez le Pack Ultime 6 offert',
    color: 'from-emerald-400 to-teal-500',
  },
];

const STEPS = [
  {
    number: '01',
    title: 'Créez votre code',
    description: 'Générez votre code parrain unique en quelques secondes',
  },
  {
    number: '02',
    title: 'Partagez',
    description: 'Invitez vos amis, famille et connaissances via votre lien personnalisé',
  },
  {
    number: '03',
    title: 'Gagnez',
    description: 'Recevez des points à chaque prestation réalisée par vos filleuls',
  },
];

const ReferralLandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser, companySettings } = useData();
  const [loading, setLoading] = useState(true);
  const [referrer, setReferrer] = useState<MktReferrer | null>(null);
  const [stats, setStats] = useState<MktReferrerStats | null>(null);
  const [summary, setSummary] = useState<MktPointsSummary | null>(null);
  const [rewards, setRewards] = useState<MktReward[]>([]);
  const [flyers, setFlyers] = useState<MktFlyer[]>([]);
  const [copied, setCopied] = useState(false);

  const isLoggedIn = useMemo(() => !!currentUser?.id, [currentUser?.id]);
  const hasReferrerProfile = useMemo(() => !!referrer && referrer.status === 'active', [referrer]);

  const shareUrl = useMemo(() => {
    const code = String(referrer?.referral_code || '').trim();
    if (!code) return '';
    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      return `${origin}/parrainage/inscrire-filleul?code=${encodeURIComponent(code)}`;
    } catch {
      return '';
    }
  }, [referrer]);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      setLoading(true);
      try {
        const [r, s, sum, rew, fly] = await Promise.all([
          getMyReferrerProfile(),
          getMyReferrerStats(),
          getMyPointsSummary(),
          listActiveRewards(),
          listActiveFlyers(),
        ]);
        if (!mounted) return;
        setReferrer(r);
        setStats(s);
        setSummary(sum);
        setRewards(rew.slice(0, 3));
        setFlyers(fly.slice(0, 3));
      } finally {
        if (mounted) setLoading(false);
      }
    };
    run();
    return () => {
      mounted = false;
    };
  }, [isLoggedIn]);

  const copyShareLink = async () => {
    const url = String(shareUrl || '').trim();
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const progressToPack = useMemo(() => {
    const threshold = referrer?.pack_ultime6_threshold || (referrer?.is_lambda ? 1500 : 1000);
    const current = summary?.balance || 0;
    const percentage = Math.min((current / threshold) * 100, 100);
    return { threshold, current, percentage, remaining: Math.max(0, threshold - current) };
  }, [referrer, summary]);

  const heroBackground = "bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900";

  return (
    <MarketingPublicShell
      title="Programme de Parrainage"
      subtitle="Gagnez ensemble"
      logoUrl={companySettings?.logoUrl}
      brandName={companySettings?.name}
      hideBack
      fullWidth
    >
      {/* Hero Section */}
      <div className={`${heroBackground} relative overflow-hidden`}>
        {/* Decorative elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-brand-orange/20 rounded-full blur-3xl" />
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-brand-blue/20 rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-500/10 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 text-white text-sm font-medium mb-6">
              <Sparkles className="w-4 h-4 text-yellow-400" />
              <span>Nouveau programme de parrainage</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white mb-6 leading-tight">
              Gagnez des récompenses
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-brand-orange to-yellow-400">
                en parrainant vos proches
              </span>
            </h1>

            <p className="text-lg sm:text-xl text-slate-300 max-w-2xl mx-auto mb-8">
              Invitez vos amis et famille à découvrir nos services. Accumulez des points et échangez-les contre des prestations exclusives.
            </p>

            {loading ? (
              <div className="flex items-center justify-center gap-2 text-white">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Chargement...</span>
              </div>
            ) : hasReferrerProfile ? (
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-4 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-brand-orange to-red-500 flex items-center justify-center">
                    <Share2 className="w-6 h-6 text-white" />
                  </div>
                  <div className="text-left">
                    <div className="text-xs text-slate-400">Votre code parrain</div>
                    <div className="text-xl font-extrabold text-white tracking-wider">{referrer?.referral_code}</div>
                  </div>
                </div>
                <button
                  onClick={copyShareLink}
                  className="flex items-center gap-2 bg-white text-slate-900 px-6 py-4 rounded-xl font-extrabold hover:bg-slate-100 transition-colors"
                >
                  {copied ? (
                    <>
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                      Lien copié !
                    </>
                  ) : (
                    <>
                      <Copy className="w-5 h-5" />
                      Copier mon lien
                    </>
                  )}
                </button>
                <button
                  onClick={() => navigate('/parrainage/dashboard')}
                  className="flex items-center gap-2 bg-brand-orange text-white px-6 py-4 rounded-xl font-extrabold hover:bg-orange-600 transition-colors"
                >
                  Mon dashboard
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <button
                  onClick={() => navigate('/parrainage/devenir-parrain')}
                  className="flex items-center gap-2 bg-brand-orange text-white px-8 py-4 rounded-xl font-extrabold hover:bg-orange-600 transition-colors text-lg"
                >
                  <Star className="w-5 h-5" />
                  Devenir parrain
                  <ArrowRight className="w-5 h-5" />
                </button>
                <button
                  onClick={() => navigate('/parrainage/devenir-parrain-client')}
                  className="flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 text-white px-8 py-4 rounded-xl font-extrabold hover:bg-white/20 transition-colors"
                >
                  <Heart className="w-5 h-5" />
                  Client existant
                </button>
              </div>
            )}

            {/* Stats Preview */}
            {hasReferrerProfile && (
              <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto">
                <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-6">
                  <div className="text-3xl font-extrabold text-white">{summary?.balance || 0}</div>
                  <div className="text-sm text-slate-400 flex items-center gap-1 justify-center mt-1">
                    <Gift className="w-4 h-4" />
                    Points
                  </div>
                </div>
                <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-6">
                  <div className="text-3xl font-extrabold text-white">{stats?.referrals_count || 0}</div>
                  <div className="text-sm text-slate-400 flex items-center gap-1 justify-center mt-1">
                    <Users className="w-4 h-4" />
                    Filleuls
                  </div>
                </div>
                <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-6">
                  <div className="text-3xl font-extrabold text-white">{referrer?.pack_ultime6_earned_count || 0}</div>
                  <div className="text-sm text-slate-400 flex items-center gap-1 justify-center mt-1">
                    <Trophy className="w-4 h-4" />
                    Packs Ultime 6
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Progress to Pack Section - Only for referrers */}
      {hasReferrerProfile && (
        <div className="bg-slate-50 py-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="bg-white rounded-3xl shadow-lg border border-slate-100 p-6 sm:p-8">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                <div className="flex items-start gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center flex-shrink-0">
                    <Trophy className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-extrabold text-slate-900">Pack Ultime 6</h3>
                    <p className="text-slate-600 mt-1">
                      Atteignez {progressToPack.threshold} points pour obtenir le Pack Ultime 6 gratuitement
                    </p>
                  </div>
                </div>

                <div className="flex-1 max-w-xl">
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="font-bold text-slate-700">{progressToPack.current} points</span>
                    <span className="text-slate-500">{progressToPack.threshold} points</span>
                  </div>
                  <div className="h-4 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-400 to-teal-500 rounded-full transition-all duration-500"
                      style={{ width: `${progressToPack.percentage}%` }}
                    />
                  </div>
                  <div className="text-center mt-2">
                    <span className="text-sm text-slate-600">
                      Plus que <span className="font-extrabold text-brand-orange">{progressToPack.remaining}</span> points !
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => navigate('/parrainage/inscrire-filleul')}
                  className="flex items-center gap-2 bg-brand-orange text-white px-6 py-3 rounded-xl font-extrabold hover:bg-orange-600 transition-colors whitespace-nowrap"
                >
                  <Share2 className="w-5 h-5" />
                  Inviter
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* How it Works Section */}
      <div className="py-16 sm:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900">Comment ça marche ?</h2>
            <p className="text-lg text-slate-600 mt-4 max-w-2xl mx-auto">
              En 3 étapes simples, commencez à gagner des récompenses
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {STEPS.map((step, index) => (
              <div
                key={step.number}
                className="relative group"
              >
                {index < STEPS.length - 1 && (
                  <div className="hidden md:block absolute top-12 left-1/2 w-full h-0.5 bg-gradient-to-r from-slate-200 to-slate-300" />
                )}
                <div className="relative bg-slate-50 rounded-2xl p-8 text-center hover:shadow-lg transition-all duration-300 group-hover:-translate-y-1">
                  <div className="w-24 h-24 mx-auto mb-6 rounded-2xl bg-white shadow-md flex items-center justify-center">
                    <span className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-brand-orange to-brand-blue">
                      {step.number}
                    </span>
                  </div>
                  <h3 className="text-xl font-extrabold text-slate-900 mb-3">{step.title}</h3>
                  <p className="text-slate-600">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="py-16 sm:py-24 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900">Les avantages du parrainage</h2>
            <p className="text-lg text-slate-600 mt-4 max-w-2xl mx-auto">
              Découvrez pourquoi rejoindre notre programme de parrainage
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {FEATURES.map((feature) => (
              <div
                key={feature.title}
                className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-lg transition-all duration-300 group"
              >
                <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${feature.color} flex items-center justify-center mb-5 group-hover:scale-110 transition-transform`}>
                  <feature.icon className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-lg font-extrabold text-slate-900 mb-2">{feature.title}</h3>
                <p className="text-slate-600 text-sm">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Rewards Preview Section */}
      {rewards.length > 0 && (
        <div className="py-16 sm:py-24 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-3xl font-extrabold text-slate-900">Récompenses disponibles</h2>
                <p className="text-slate-600 mt-2">Échangez vos points contre ces prestations</p>
              </div>
              <button
                onClick={() => navigate('/parrainage/recompenses')}
                className="hidden sm:flex items-center gap-2 text-brand-orange font-extrabold hover:gap-3 transition-all"
              >
                Voir tout
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {rewards.map((reward) => (
                <div
                  key={reward.id}
                  className="bg-slate-50 rounded-2xl p-6 hover:shadow-lg transition-all duration-300 group cursor-pointer"
                  onClick={() => navigate('/parrainage/recompenses')}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-400 to-pink-500 flex items-center justify-center">
                      <Gift className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex items-center gap-1 bg-white px-3 py-1 rounded-full shadow-sm">
                      <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                      <span className="font-extrabold text-slate-900">{reward.points_cost}</span>
                    </div>
                  </div>
                  <h3 className="text-lg font-extrabold text-slate-900 mb-2">{reward.name}</h3>
                  {reward.description && (
                    <p className="text-slate-600 text-sm line-clamp-2">{reward.description}</p>
                  )}
                </div>
              ))}
            </div>

            <button
              onClick={() => navigate('/parrainage/recompenses')}
              className="sm:hidden w-full mt-6 flex items-center justify-center gap-2 bg-brand-orange text-white px-6 py-3 rounded-xl font-extrabold"
            >
              Voir toutes les récompenses
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Current Offers Section */}
      {flyers.length > 0 && (
        <div className="py-16 sm:py-24 bg-slate-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-3xl font-extrabold text-slate-900">Offres du moment</h2>
                <p className="text-slate-600 mt-2">Profitez de nos promotions exclusives</p>
              </div>
              <button
                onClick={() => navigate('/flyers')}
                className="hidden sm:flex items-center gap-2 text-brand-blue font-extrabold hover:gap-3 transition-all"
              >
                Voir toutes les offres
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {flyers.map((flyer) => (
                <div
                  key={flyer.id}
                  className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 cursor-pointer group"
                  onClick={() => navigate(`/flyers/${flyer.id}`)}
                >
                  {flyer.image_url ? (
                    <div className="aspect-[16/10] overflow-hidden">
                      <img
                        src={flyer.image_url}
                        alt={flyer.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                  ) : (
                    <div className="aspect-[16/10] bg-gradient-to-br from-brand-blue/10 to-brand-orange/10 flex items-center justify-center">
                      <TrendingUp className="w-12 h-12 text-slate-300" />
                    </div>
                  )}
                  <div className="p-5">
                    <h3 className="text-lg font-extrabold text-slate-900 mb-2 line-clamp-1">{flyer.title}</h3>
                    <div className="flex items-center gap-2">
                      {flyer.promo_price && (
                        <span className="text-xl font-extrabold text-brand-orange">
                          {flyer.promo_price.toFixed(2)} €
                        </span>
                      )}
                      {flyer.normal_price && flyer.promo_price && (
                        <span className="text-sm text-slate-400 line-through">
                          {flyer.normal_price.toFixed(2)} €
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => navigate('/flyers')}
              className="sm:hidden w-full mt-6 flex items-center justify-center gap-2 bg-brand-blue text-white px-6 py-3 rounded-xl font-extrabold"
            >
              Voir toutes les offres
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Trust Section */}
      <div className="py-16 sm:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl p-8 sm:p-12 text-center">
            <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-white/10 flex items-center justify-center">
              <Shield className="w-8 h-8 text-brand-orange" />
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-4">
              Rejoignez notre communauté de parrains
            </h2>
            <p className="text-lg text-slate-300 max-w-2xl mx-auto mb-8">
              Des centaines de clients nous font confiance. Devenez parrain et partagez les avantages avec votre entourage.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              {!hasReferrerProfile ? (
                <>
                  <button
                    onClick={() => navigate('/parrainage/devenir-parrain')}
                    className="flex items-center gap-2 bg-brand-orange text-white px-8 py-4 rounded-xl font-extrabold hover:bg-orange-600 transition-colors"
                  >
                    <Sparkles className="w-5 h-5" />
                    Commencer maintenant
                  </button>
                  <button
                    onClick={() => navigate('/parrainage/mes-points')}
                    className="flex items-center gap-2 bg-white/10 text-white px-8 py-4 rounded-xl font-extrabold hover:bg-white/20 transition-colors"
                  >
                    <TrendingUp className="w-5 h-5" />
                    Voir mes points
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => navigate('/parrainage/dashboard')}
                    className="flex items-center gap-2 bg-brand-orange text-white px-8 py-4 rounded-xl font-extrabold hover:bg-orange-600 transition-colors"
                  >
                    <TrendingUp className="w-5 h-5" />
                    Accéder à mon dashboard
                  </button>
                  <button
                    onClick={() => navigate('/parrainage/inscrire-filleul')}
                    className="flex items-center gap-2 bg-white/10 text-white px-8 py-4 rounded-xl font-extrabold hover:bg-white/20 transition-colors"
                  >
                    <Users className="w-5 h-5" />
                    Inscrire un filleul
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </MarketingPublicShell>
  );
};

export default ReferralLandingPage;
