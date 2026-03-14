import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Gift,
  Users,
  Trophy,
  TrendingUp,
  Share2,
  Copy,
  CheckCircle2,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  Sparkles,
  Target,
  Zap,
  Star,
  Loader2,
  ChevronRight,
  UserPlus,
  Clock,
  Award,
} from 'lucide-react';
import { useData } from '../../../context/DataContext';
import {
  getMyPointsSummary,
  getMyReferrerProfile,
  getMyReferrerStats,
  listMyReferrals,
  listMyPendingClientLeads,
  listActiveRewards,
} from '../client';
import type {
  MktPointsSummary,
  MktReferrer,
  MktReferrerStats,
  MktReferral,
  ClientLead,
  MktReward,
} from '../types';
import MarketingPublicShell from './MarketingPublicShell';
import { TabNavigation, TabPanel } from './TabNavigation';

// --- Components ---

const StatCard: React.FC<{
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  trend?: { value: number; positive: boolean };
  color: string;
  bgGradient: string;
}> = ({ icon: Icon, label, value, trend, color, bgGradient }) => (
  <div className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-lg transition-all duration-300 group">
    <div className="flex items-start justify-between">
      <div className={`w-14 h-14 rounded-2xl ${bgGradient} flex items-center justify-center group-hover:scale-110 transition-transform`}>
        <Icon className={`w-7 h-7 ${color}`} />
      </div>
      {trend && (
        <div className={`flex items-center gap-1 text-sm font-bold ${trend.positive ? 'text-emerald-600' : 'text-red-600'}`}>
          {trend.positive ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
          {trend.value}%
        </div>
      )}
    </div>
    <div className="mt-4">
      <div className="text-3xl font-extrabold text-slate-900">{value}</div>
      <div className="text-sm text-slate-500 mt-1">{label}</div>
    </div>
  </div>
);

const ProgressCard: React.FC<{
  referrer: MktReferrer;
  summary: MktPointsSummary | null;
}> = ({ referrer, summary }) => {
  const threshold = referrer?.pack_ultime6_threshold || (referrer?.is_lambda ? 1500 : 1000);
  const current = summary?.balance || 0;
  const percentage = Math.min((current / threshold) * 100, 100);
  const remaining = Math.max(0, threshold - current);

  return (
    <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-6 text-white">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center">
          <Trophy className="w-6 h-6 text-white" />
        </div>
        <div>
          <h3 className="text-lg font-extrabold">Objectif Pack Ultime 6</h3>
          <p className="text-sm text-slate-400">Continuez à parrainer pour débloquer cette récompense</p>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-400">Progression</span>
          <span className="font-bold">{Math.round(percentage)}%</span>
        </div>
        <div className="h-3 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-emerald-400 to-teal-500 rounded-full transition-all duration-700"
            style={{ width: `${percentage}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="font-bold text-emerald-400">{current} points</span>
          <span className="text-slate-500">{threshold} points</span>
        </div>
      </div>

      {remaining > 0 && (
        <div className="mt-4 p-3 bg-white/5 rounded-xl flex items-center gap-2">
          <Target className="w-5 h-5 text-brand-orange" />
          <span className="text-sm">
            Encore <span className="font-extrabold text-brand-orange">{remaining}</span> points à gagner
          </span>
        </div>
      )}

      {percentage >= 100 && (
        <div className="mt-4 p-3 bg-emerald-500/20 rounded-xl flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-emerald-400" />
          <span className="text-sm font-bold text-emerald-400">
            Félicitations ! Vous avez débloqué le Pack Ultime 6 !
          </span>
        </div>
      )}
    </div>
  );
};

const QuickActions: React.FC<{
  referrer: MktReferrer;
  shareUrl: string;
  onCopy: () => void;
  copied: boolean;
}> = ({ referrer, shareUrl, onCopy, copied }) => {
  const navigate = useNavigate();

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm">
      <h3 className="text-lg font-extrabold text-slate-900 mb-4">Actions rapides</h3>

      <div className="space-y-3">
        <div className="p-4 bg-slate-50 rounded-xl">
          <div className="text-sm text-slate-500 mb-2">Votre code parrain</div>
          <div className="flex items-center gap-3">
            <div className="flex-1 bg-white rounded-lg px-4 py-3 font-mono font-bold text-slate-900 border border-slate-200">
              {referrer?.referral_code}
            </div>
            <button
              onClick={onCopy}
              className="flex items-center gap-2 bg-brand-blue text-white px-4 py-3 rounded-lg font-extrabold hover:bg-teal-700 transition-colors"
            >
              {copied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copié' : 'Copier'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            onClick={() => navigate('/parrainage/inscrire-filleul')}
            className="flex items-center justify-center gap-2 bg-brand-orange text-white px-4 py-3 rounded-xl font-extrabold hover:bg-orange-600 transition-colors"
          >
            <UserPlus className="w-5 h-5" />
            Inscrire un filleul
          </button>
          <button
            onClick={() => navigate('/parrainage/mes-filleuls')}
            className="flex items-center justify-center gap-2 bg-white border-2 border-slate-200 text-slate-700 px-4 py-3 rounded-xl font-extrabold hover:border-brand-blue hover:text-brand-blue transition-colors"
          >
            <Users className="w-5 h-5" />
            Voir mes filleuls
          </button>
        </div>

        <button
          onClick={() => navigate('/parrainage/recompenses')}
          className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white px-4 py-3 rounded-xl font-extrabold hover:opacity-90 transition-opacity"
        >
          <Gift className="w-5 h-5" />
          Découvrir les récompenses
        </button>
      </div>
    </div>
  );
};

const PointsHistory: React.FC<{ history: MktPointsSummary['history'] }> = ({ history }) => {
  const formatReason = (reason: string) => {
    const reasons: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; color: string }> = {
      mission_completed: { label: 'Mission terminée', icon: CheckCircle2, color: 'text-emerald-600 bg-emerald-100' },
      invoice_paid: { label: 'Facture payée', icon: TrendingUp, color: 'text-blue-600 bg-blue-100' },
      manual_adjustment: { label: 'Ajustement', icon: Zap, color: 'text-amber-600 bg-amber-100' },
      reward_redemption: { label: 'Récompense', icon: Gift, color: 'text-purple-600 bg-purple-100' },
    };
    return reasons[reason] || { label: reason, icon: Star, color: 'text-slate-600 bg-slate-100' };
  };

  if (!history?.length) {
    return (
      <div className="text-center py-12">
        <Clock className="w-12 h-12 text-slate-300 mx-auto mb-4" />
        <p className="text-slate-500">Aucun mouvement pour le moment</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {history.slice(0, 10).map((entry, index) => {
        const { label, icon: Icon, color } = formatReason(entry.reason);
        const isPositive = entry.points >= 0;

        return (
          <div
            key={entry.id}
            className="flex items-center gap-4 p-4 bg-white rounded-xl border border-slate-100 hover:shadow-sm transition-shadow"
          >
            <div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center flex-shrink-0`}>
              <Icon className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-slate-900">{label}</div>
              <div className="text-xs text-slate-500">
                {new Date(entry.created_at).toLocaleDateString('fr-FR', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </div>
            </div>
            <div className={`font-extrabold text-lg ${isPositive ? 'text-emerald-600' : 'text-red-600'}`}>
              {isPositive ? '+' : ''}{entry.points}
            </div>
          </div>
        );
      })}
    </div>
  );
};

const FilleulsList: React.FC<{
  referrals: MktReferral[];
  pendingLeads: ClientLead[];
}> = ({ referrals, pendingLeads }) => {
  const navigate = useNavigate();

  const statusConfig: Record<string, { label: string; className: string }> = {
    pending: { label: 'En attente', className: 'bg-amber-100 text-amber-700' },
    validated: { label: 'Validé', className: 'bg-emerald-100 text-emerald-700' },
    rewarded: { label: 'Récompensé', className: 'bg-purple-100 text-purple-700' },
    rejected: { label: 'Refusé', className: 'bg-red-100 text-red-700' },
    blocked: { label: 'Bloqué', className: 'bg-slate-100 text-slate-700' },
  };

  return (
    <div className="space-y-6">
      {/* Pending Leads */}
      {pendingLeads.length > 0 && (
        <div>
          <h4 className="text-sm font-extrabold text-slate-500 uppercase tracking-wider mb-3">
            En attente de validation ({pendingLeads.length})
          </h4>
          <div className="space-y-2">
            {pendingLeads.map((lead) => (
              <div key={lead.id} className="flex items-center gap-4 p-4 bg-amber-50 rounded-xl border border-amber-100">
                <div className="w-10 h-10 rounded-full bg-amber-200 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-amber-700" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-slate-900">{lead.full_name}</div>
                  <div className="text-xs text-slate-500">{lead.email}</div>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700">
                  En attente
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Validated Referrals */}
      <div>
        <h4 className="text-sm font-extrabold text-slate-500 uppercase tracking-wider mb-3">
          Filleuls validés ({referrals.length})
        </h4>
        {referrals.length === 0 ? (
          <div className="text-center py-12 bg-slate-50 rounded-2xl">
            <Users className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500 mb-4">Aucun filleul validé pour le moment</p>
            <button
              onClick={() => navigate('/parrainage/inscrire-filleul')}
              className="text-brand-orange font-extrabold hover:underline"
            >
              Inscrire mon premier filleul
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {referrals.map((referral) => {
              const status = statusConfig[referral.status] || statusConfig.pending;
              return (
                <div key={referral.id} className="flex items-center gap-4 p-4 bg-white rounded-xl border border-slate-100 hover:shadow-sm transition-shadow">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-blue to-cyan-500 flex items-center justify-center">
                    <span className="text-white font-bold text-sm">
                      {(referral.referred_full_name || '?').charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-slate-900">{referral.referred_full_name || '—'}</div>
                    <div className="text-xs text-slate-500">{referral.referred_email || referral.referred_phone || '—'}</div>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${status.className}`}>
                    {status.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

const RewardsPreview: React.FC<{ rewards: MktReward[] }> = ({ rewards }) => {
  const navigate = useNavigate();

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {rewards.slice(0, 4).map((reward) => (
        <div
          key={reward.id}
          className="bg-white p-5 rounded-xl border border-slate-100 hover:shadow-md transition-all cursor-pointer group"
          onClick={() => navigate('/parrainage/recompenses')}
        >
          <div className="flex items-start justify-between mb-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-400 to-pink-500 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Gift className="w-6 h-6 text-white" />
            </div>
            <div className="flex items-center gap-1 bg-slate-100 px-3 py-1 rounded-full">
              <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
              <span className="font-extrabold text-slate-900">{reward.points_cost}</span>
            </div>
          </div>
          <h4 className="font-extrabold text-slate-900 mb-1">{reward.name}</h4>
          {reward.description && (
            <p className="text-sm text-slate-500 line-clamp-2">{reward.description}</p>
          )}
        </div>
      ))}

      <button
        onClick={() => navigate('/parrainage/recompenses')}
        className="flex flex-col items-center justify-center gap-2 p-5 rounded-xl border-2 border-dashed border-slate-300 hover:border-brand-orange hover:text-brand-orange transition-colors group"
      >
        <ChevronRight className="w-8 h-8 text-slate-400 group-hover:text-brand-orange" />
        <span className="font-extrabold text-slate-600 group-hover:text-brand-orange">Voir toutes les récompenses</span>
      </button>
    </div>
  );
};

// --- Main Component ---

const ReferrerDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser, companySettings } = useData();
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);

  const [referrer, setReferrer] = useState<MktReferrer | null>(null);
  const [stats, setStats] = useState<MktReferrerStats | null>(null);
  const [summary, setSummary] = useState<MktPointsSummary | null>(null);
  const [referrals, setReferrals] = useState<MktReferral[]>([]);
  const [pendingLeads, setPendingLeads] = useState<ClientLead[]>([]);
  const [rewards, setRewards] = useState<MktReward[]>([]);
  const [copied, setCopied] = useState(false);

  const isLoggedIn = useMemo(() => !!currentUser?.id, [currentUser?.id]);

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
    if (!isLoggedIn) {
      navigate('/parrainage');
      return;
    }

    let mounted = true;
    const run = async () => {
      setLoading(true);
      try {
        const [r, s, sum, ref, leads, rew] = await Promise.all([
          getMyReferrerProfile(),
          getMyReferrerStats(),
          getMyPointsSummary(),
          listMyReferrals(),
          listMyPendingClientLeads(),
          listActiveRewards(),
        ]);
        if (!mounted) return;
        setReferrer(r);
        setStats(s);
        setSummary(sum);
        setReferrals(ref);
        setPendingLeads(leads);
        setRewards(rew);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    run();
    return () => {
      mounted = false;
    };
  }, [isLoggedIn, navigate]);

  useEffect(() => {
    if (!loading && !referrer) {
      navigate('/parrainage/devenir-parrain');
    }
  }, [loading, referrer, navigate]);

  const copyShareLink = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  if (loading) {
    return (
      <MarketingPublicShell
        title="Dashboard"
        subtitle="Parrainage"
        logoUrl={companySettings?.logoUrl}
        brandName={companySettings?.name}
      >
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 animate-spin text-brand-blue" />
        </div>
      </MarketingPublicShell>
    );
  }

  if (!referrer) return null;

  const tabs = [
    { id: 'overview', label: 'Vue d\'ensemble', icon: TrendingUp },
    { id: 'points', label: 'Points & Historique', icon: Gift },
    { id: 'filleuls', label: 'Mes filleuls', icon: Users, badge: pendingLeads.length },
    { id: 'rewards', label: 'Récompenses', icon: Award },
  ];

  return (
    <MarketingPublicShell
      title="Dashboard Parrain"
      subtitle="Mon compte"
      logoUrl={companySettings?.logoUrl}
      brandName={companySettings?.name}
      fullWidth
    >
      {/* Header Stats */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-sm flex items-center justify-center">
                <Trophy className="w-8 h-8 text-brand-orange" />
              </div>
              <div>
                <h1 className="text-2xl font-extrabold text-white">Bienvenue, {referrer.full_name || 'Parrain'}</h1>
                <p className="text-slate-400 flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full bg-brand-orange/20 text-brand-orange text-xs font-bold">
                    {referrer.is_lambda ? 'Lambda' : 'Standard'}
                  </span>
                  <span>•</span>
                  <span>Code: {referrer.referral_code}</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <div className="text-3xl font-extrabold text-white">{summary?.balance || 0}</div>
                <div className="text-sm text-slate-400">points disponibles</div>
              </div>
              <button
                onClick={() => navigate('/parrainage/inscrire-filleul')}
                className="flex items-center gap-2 bg-brand-orange text-white px-6 py-3 rounded-xl font-extrabold hover:bg-orange-600 transition-colors"
              >
                <Share2 className="w-5 h-5" />
                Inviter
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tabs */}
        <div className="mb-8 overflow-x-auto">
          <TabNavigation
            tabs={tabs}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            variant="default"
          />
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <TabPanel>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Stats Cards */}
              <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-4">
                <StatCard
                  icon={Gift}
                  label="Points totaux"
                  value={summary?.balance || 0}
                  color="text-brand-orange"
                  bgGradient="bg-gradient-to-br from-orange-100 to-red-100"
                />
                <StatCard
                  icon={Users}
                  label="Filleuls"
                  value={stats?.referrals_count || 0}
                  color="text-brand-blue"
                  bgGradient="bg-gradient-to-br from-blue-100 to-cyan-100"
                />
                <StatCard
                  icon={Trophy}
                  label="Packs Ultime 6"
                  value={referrer?.pack_ultime6_earned_count || 0}
                  color="text-emerald-600"
                  bgGradient="bg-gradient-to-br from-emerald-100 to-teal-100"
                />
              </div>

              {/* Progress Card */}
              <div className="lg:col-span-1">
                <ProgressCard referrer={referrer} summary={summary} />
              </div>

              {/* Quick Actions */}
              <div className="lg:col-span-1">
                <QuickActions
                  referrer={referrer}
                  shareUrl={shareUrl}
                  onCopy={copyShareLink}
                  copied={copied}
                />
              </div>

              {/* Recent Activity */}
              <div className="lg:col-span-2 bg-white rounded-2xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-extrabold text-slate-900">Activité récente</h3>
                  <button
                    onClick={() => setActiveTab('points')}
                    className="text-sm text-brand-orange font-bold hover:underline"
                  >
                    Voir tout
                  </button>
                </div>
                <PointsHistory history={summary?.history?.slice(0, 5) || []} />
              </div>
            </div>
          </TabPanel>
        )}

        {activeTab === 'points' && (
          <TabPanel>
            <div className="max-w-3xl mx-auto">
              <div className="bg-white rounded-2xl p-8 shadow-sm mb-6">
                <div className="text-center">
                  <div className="text-sm text-slate-500 mb-2">Solde actuel</div>
                  <div className="text-6xl font-extrabold text-slate-900">{summary?.balance || 0}</div>
                  <div className="text-lg text-slate-400 mt-1">points</div>
                </div>

                <div className="mt-8 p-4 bg-slate-50 rounded-xl">
                  <h4 className="font-bold text-slate-900 mb-3">Comment gagner des points ?</h4>
                  <ul className="space-y-2 text-sm text-slate-600">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      Chaque prestation payée par vos filleuls vous rapporte des points
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      Atteignez {referrer?.pack_ultime6_threshold || 1000} points pour débloquer le Pack Ultime 6
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      Échangez vos points contre des récompenses exclusives
                    </li>
                  </ul>
                </div>
              </div>

              <div className="bg-white rounded-2xl p-6 shadow-sm">
                <h3 className="text-lg font-extrabold text-slate-900 mb-4">Historique complet</h3>
                <PointsHistory history={summary?.history || []} />
              </div>
            </div>
          </TabPanel>
        )}

        {activeTab === 'filleuls' && (
          <TabPanel>
            <div className="max-w-3xl mx-auto">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-extrabold text-slate-900">Gestion des filleuls</h3>
                <button
                  onClick={() => navigate('/parrainage/inscrire-filleul')}
                  className="flex items-center gap-2 bg-brand-orange text-white px-4 py-2 rounded-lg font-extrabold hover:bg-orange-600 transition-colors"
                >
                  <UserPlus className="w-4 h-4" />
                  Nouveau filleul
                </button>
              </div>
              <FilleulsList referrals={referrals} pendingLeads={pendingLeads} />
            </div>
          </TabPanel>
        )}

        {activeTab === 'rewards' && (
          <TabPanel>
            <div className="max-w-3xl mx-auto">
              <div className="bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl p-6 text-white mb-6">
                <div className="flex items-center gap-3 mb-2">
                  <Gift className="w-8 h-8" />
                  <h3 className="text-xl font-extrabold">Catalogue des récompenses</h3>
                </div>
                <p className="text-white/80">
                  Échangez vos {summary?.balance || 0} points contre des prestations exclusives
                </p>
              </div>
              <RewardsPreview rewards={rewards} />
            </div>
          </TabPanel>
        )}
      </div>
    </MarketingPublicShell>
  );
};

export default ReferrerDashboardPage;
