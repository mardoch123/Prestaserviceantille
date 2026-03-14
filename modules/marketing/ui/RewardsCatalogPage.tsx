import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Gift,
  Star,
  TrendingUp,
  Lock,
  Unlock,
  Sparkles,
  ChevronRight,
  Info,
  Trophy,
  Zap,
  CheckCircle2,
  Loader2,
  ArrowLeft,
  Search,
  Filter,
} from 'lucide-react';
import { useData } from '../../../context/DataContext';
import {
  getMyPointsSummary,
  getMyReferrerProfile,
  listActiveRewards,
} from '../client';
import type { MktPointsSummary, MktReferrer, MktReward } from '../types';
import MarketingPublicShell from './MarketingPublicShell';

interface RewardCardProps {
  reward: MktReward;
  canAfford: boolean;
  userPoints: number;
  isUnlocked: boolean;
}

const RewardCard: React.FC<RewardCardProps> = ({ reward, canAfford, userPoints, isUnlocked }) => {
  const progress = Math.min((userPoints / reward.points_cost) * 100, 100);

  return (
    <div
      className={`relative bg-white rounded-2xl p-6 transition-all duration-300 ${
        canAfford
          ? 'shadow-md hover:shadow-xl hover:-translate-y-1 cursor-pointer border-2 border-transparent hover:border-brand-orange'
          : 'shadow-sm border border-slate-100 opacity-75'
      }`}
    >
      {/* Status Badge */}
      {canAfford && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="px-4 py-1 rounded-full bg-gradient-to-r from-emerald-400 to-teal-500 text-white text-xs font-extrabold shadow-lg flex items-center gap-1">
            <Unlock className="w-3 h-3" />
            Disponible
          </span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div
          className={`w-16 h-16 rounded-2xl flex items-center justify-center ${
            canAfford
              ? 'bg-gradient-to-br from-purple-400 to-pink-500'
              : 'bg-gradient-to-br from-slate-300 to-slate-400'
          }`}
        >
          <Gift className="w-8 h-8 text-white" />
        </div>
        <div className="text-right">
          <div className="flex items-center gap-1 justify-end">
            <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
            <span className="text-2xl font-extrabold text-slate-900">{reward.points_cost}</span>
          </div>
          <div className="text-xs text-slate-500">points requis</div>
        </div>
      </div>

      {/* Content */}
      <h3 className="text-xl font-extrabold text-slate-900 mb-2">{reward.name}</h3>
      {reward.description && (
        <p className="text-slate-600 text-sm mb-4 line-clamp-2">{reward.description}</p>
      )}

      {/* Progress Bar */}
      {!canAfford && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500">Progression</span>
            <span className="font-bold text-slate-700">{Math.round(progress)}%</span>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-slate-400 to-slate-500 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="text-xs text-slate-500 text-center">
            Encore <span className="font-extrabold text-brand-orange">{reward.points_cost - userPoints}</span> points
          </div>
        </div>
      )}

      {/* Action Button */}
      {canAfford ? (
        <button className="w-full mt-4 bg-gradient-to-r from-brand-orange to-red-500 text-white px-4 py-3 rounded-xl font-extrabold hover:opacity-90 transition-opacity flex items-center justify-center gap-2">
          <Sparkles className="w-5 h-5" />
          Échanger maintenant
        </button>
      ) : (
        <div className="w-full mt-4 bg-slate-100 text-slate-400 px-4 py-3 rounded-xl font-extrabold flex items-center justify-center gap-2 cursor-not-allowed">
          <Lock className="w-5 h-5" />
          {isUnlocked ? 'Contactez l\'administrateur' : 'Points insuffisants'}
        </div>
      )}
    </div>
  );
};

const CategoryFilter: React.FC<{
  categories: string[];
  active: string;
  onChange: (cat: string) => void;
}> = ({ categories, active, onChange }) => {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={() => onChange('all')}
        className={`px-4 py-2 rounded-full text-sm font-extrabold transition-all ${
          active === 'all'
            ? 'bg-brand-blue text-white shadow-md'
            : 'bg-white text-slate-600 border border-slate-200 hover:border-brand-blue'
        }`}
      >
        Toutes
      </button>
      {categories.map((cat) => (
        <button
          key={cat}
          onClick={() => onChange(cat)}
          className={`px-4 py-2 rounded-full text-sm font-extrabold transition-all ${
            active === cat
              ? 'bg-brand-orange text-white shadow-md'
              : 'bg-white text-slate-600 border border-slate-200 hover:border-brand-orange'
          }`}
        >
          {cat}
        </button>
      ))}
    </div>
  );
};

const RewardsCatalogPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser, companySettings } = useData();
  const [loading, setLoading] = useState(true);
  const [rewards, setRewards] = useState<MktReward[]>([]);
  const [summary, setSummary] = useState<MktPointsSummary | null>(null);
  const [referrer, setReferrer] = useState<MktReferrer | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showAffordableOnly, setShowAffordableOnly] = useState(false);

  const isLoggedIn = useMemo(() => !!currentUser?.id, [currentUser?.id]);

  // Extract categories from reward names or descriptions
  const categories = useMemo(() => {
    const cats = new Set<string>();
    rewards.forEach((r) => {
      if (r.name.toLowerCase().includes('pack')) cats.add('Packs');
      else if (r.name.toLowerCase().includes('prestation')) cats.add('Prestations');
      else if (r.name.toLowerCase().includes('service')) cats.add('Services');
      else cats.add('Autres');
    });
    return Array.from(cats);
  }, [rewards]);

  // Filter rewards
  const filteredRewards = useMemo(() => {
    let filtered = rewards;

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (r) =>
          r.name.toLowerCase().includes(query) ||
          (r.description?.toLowerCase() || '').includes(query)
      );
    }

    // Category filter
    if (selectedCategory !== 'all') {
      filtered = filtered.filter((r) => {
        if (selectedCategory === 'Packs') return r.name.toLowerCase().includes('pack');
        if (selectedCategory === 'Prestations') return r.name.toLowerCase().includes('prestation');
        if (selectedCategory === 'Services') return r.name.toLowerCase().includes('service');
        return !r.name.toLowerCase().includes('pack') &&
               !r.name.toLowerCase().includes('prestation') &&
               !r.name.toLowerCase().includes('service');
      });
    }

    // Affordable only
    if (showAffordableOnly) {
      const userPoints = summary?.balance || 0;
      filtered = filtered.filter((r) => r.points_cost <= userPoints);
    }

    // Sort by points cost
    return filtered.sort((a, b) => a.points_cost - b.points_cost);
  }, [rewards, searchQuery, selectedCategory, showAffordableOnly, summary]);

  // Calculate stats
  const stats = useMemo(() => {
    const userPoints = summary?.balance || 0;
    const affordable = rewards.filter((r) => r.points_cost <= userPoints).length;
    const total = rewards.length;
    const nextReward = rewards
      .filter((r) => r.points_cost > userPoints)
      .sort((a, b) => a.points_cost - b.points_cost)[0];

    return { userPoints, affordable, total, nextReward };
  }, [rewards, summary]);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      setLoading(true);
      try {
        const [rew, sum, ref] = await Promise.all([
          listActiveRewards(),
          getMyPointsSummary(),
          getMyReferrerProfile(),
        ]);
        if (!mounted) return;
        setRewards(rew);
        setSummary(sum);
        setReferrer(ref);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    run();
    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return (
      <MarketingPublicShell
        title="Récompenses"
        subtitle="Catalogue"
        logoUrl={companySettings?.logoUrl}
        brandName={companySettings?.name}
      >
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 animate-spin text-brand-blue" />
        </div>
      </MarketingPublicShell>
    );
  }

  return (
    <MarketingPublicShell
      title="Catalogue des récompenses"
      subtitle="Parrainage"
      logoUrl={companySettings?.logoUrl}
      brandName={companySettings?.name}
      fullWidth
    >
      {/* Header */}
      <div className="bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <button
            onClick={() => navigate('/parrainage/dashboard')}
            className="flex items-center gap-2 text-slate-400 hover:text-white mb-6 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Retour au dashboard
          </button>

          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div>
              <h1 className="text-4xl font-extrabold text-white mb-2">
                Catalogue des récompenses
              </h1>
              <p className="text-slate-400 text-lg">
                Échangez vos points contre des prestations exclusives
              </p>
            </div>

            {isLoggedIn && (
              <div className="flex items-center gap-4">
                <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20">
                  <div className="text-sm text-slate-400 mb-1">Vos points disponibles</div>
                  <div className="text-3xl font-extrabold text-white flex items-center gap-2">
                    <Star className="w-8 h-8 text-yellow-400 fill-yellow-400" />
                    {stats.userPoints}
                  </div>
                </div>

                {stats.nextReward && (
                  <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20">
                    <div className="text-sm text-slate-400 mb-1">Prochaine récompense</div>
                    <div className="text-lg font-extrabold text-white">
                      {stats.nextReward.name}
                    </div>
                    <div className="text-sm text-brand-orange">
                      {stats.nextReward.points_cost - stats.userPoints} pts restants
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Stats Bar */}
          <div className="mt-8 grid grid-cols-3 gap-4 max-w-2xl">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
              <div className="text-2xl font-extrabold text-white">{stats.total}</div>
              <div className="text-sm text-slate-400">Récompenses</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
              <div className="text-2xl font-extrabold text-emerald-400">{stats.affordable}</div>
              <div className="text-sm text-slate-400">Disponibles</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
              <div className="text-2xl font-extrabold text-brand-orange">
                {stats.total - stats.affordable}
              </div>
              <div className="text-sm text-slate-400">À débloquer</div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col lg:flex-row lg:items-center gap-4">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Rechercher une récompense..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 outline-none"
              />
            </div>

            {/* Category Filter */}
            <CategoryFilter
              categories={categories}
              active={selectedCategory}
              onChange={setSelectedCategory}
            />

            {/* Affordable Toggle */}
            {isLoggedIn && (
              <label className="flex items-center gap-2 cursor-pointer whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={showAffordableOnly}
                  onChange={(e) => setShowAffordableOnly(e.target.checked)}
                  className="w-5 h-5 rounded border-slate-300 text-brand-orange focus:ring-brand-orange"
                />
                <span className="text-sm font-bold text-slate-700">Afficher uniquement les disponibles</span>
              </label>
            )}
          </div>
        </div>
      </div>

      {/* Rewards Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {filteredRewards.length === 0 ? (
          <div className="text-center py-16">
            <Gift className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-xl font-extrabold text-slate-900 mb-2">Aucune récompense trouvée</h3>
            <p className="text-slate-500">
              Essayez de modifier vos filtres ou revenez plus tard pour découvrir de nouvelles récompenses.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredRewards.map((reward) => (
              <RewardCard
                key={reward.id}
                reward={reward}
                canAfford={stats.userPoints >= reward.points_cost}
                userPoints={stats.userPoints}
                isUnlocked={true}
              />
            ))}
          </div>
        )}
      </div>

      {/* Info Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        <div className="bg-slate-50 rounded-2xl p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-brand-blue/10 flex items-center justify-center flex-shrink-0">
              <Info className="w-6 h-6 text-brand-blue" />
            </div>
            <div>
              <h3 className="text-lg font-extrabold text-slate-900 mb-2">Comment obtenir mes récompenses ?</h3>
              <p className="text-slate-600 mb-4">
                Pour échanger vos points contre une récompense, contactez directement l'administrateur
                ou rendez-vous sur votre dashboard parrain. Les récompenses disponibles sont
                marquées en vert.
              </p>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => navigate('/parrainage/dashboard')}
                  className="flex items-center gap-2 bg-brand-blue text-white px-4 py-2 rounded-lg font-extrabold hover:bg-teal-700 transition-colors"
                >
                  <Trophy className="w-4 h-4" />
                  Voir mon dashboard
                </button>
                <button
                  onClick={() => navigate('/parrainage/inscrire-filleul')}
                  className="flex items-center gap-2 bg-brand-orange text-white px-4 py-2 rounded-lg font-extrabold hover:bg-orange-600 transition-colors"
                >
                  <Zap className="w-4 h-4" />
                  Gagner plus de points
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </MarketingPublicShell>
  );
};

export default RewardsCatalogPage;
