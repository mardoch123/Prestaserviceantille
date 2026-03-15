/**
 * EXEMPLE D'INTÉGRATION MOBILE - MissionListPage
 * 
 * Ce fichier montre comment intégrer les fonctionnalités mobile dans un composant existant.
 * C'est un exemple/template, pas un vrai composant de l'app.
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSwipe } from '../hooks/useSwipe';
import { useHaptic } from '../hooks/useHaptic';
import { PullToRefresh } from '../components/mobile/PullToRefresh';
import { toast } from '../components/mobile/Toast';
import { TouchableListItem, SkeletonCard } from '../components/mobile/MobileTransitions';
import { useDeviceDetect, useScrollBottom } from '../hooks/useMobile';
import { useMobileSync } from '../services/mobileSync';

// Mock données pour l'exemple
interface Mission {
  id: string;
  title: string;
  date: string;
  status: 'pending' | 'completed' | 'in_progress';
}

const MissionListPageExample: React.FC = () => {
  const navigate = useNavigate();
  const { buttonPress, success } = useHaptic();
  const { isMobile } = useDeviceDetect();
  const { pendingJobs, forceSync } = useMobileSync();
  
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMission, setSelectedMission] = useState<string | null>(null);

  // Charger les missions
  const loadMissions = async () => {
    setLoading(true);
    try {
      // Simuler un appel API
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const mockMissions: Mission[] = [
        { id: '1', title: 'Ménage appartement', date: '2024-01-15', status: 'pending' },
        { id: '2', title: 'Jardinage villa', date: '2024-01-16', status: 'in_progress' },
        { id: '3', title: 'Bricolage salle de bain', date: '2024-01-17', status: 'completed' },
      ];
      
      setMissions(mockMissions);
      
      // Feedback haptic en cas de succès
      if (isMobile) {
        success();
      }
    } catch (error) {
      console.error('Erreur lors du chargement:', error);
      toast.error('Impossible de charger les missions');
    } finally {
      setLoading(false);
    }
  };

  // Charger au montage
  useEffect(() => {
    loadMissions();
  }, []);

  // Swipe pour navigation
  const swipeRef = useSwipe<HTMLDivElement>({
    onSwipeLeft: () => {
      // Swipe vers la gauche = aller à la page suivante
      buttonPress();
      navigate('/next-page');
    },
    onSwipeRight: () => {
      // Swipe vers la droite = retour
      buttonPress();
      navigate(-1);
    },
    threshold: 80,
  });

  // Infinite scroll
  const isNearBottom = useScrollBottom(() => {
    // Charger plus de missions quand on approche du bas
    console.log('Charger plus de missions...');
  }, 200, []);

  // Sélectionner une mission
  const handleMissionSelect = (mission: Mission) => {
    buttonPress(); // Feedback tactile
    setSelectedMission(mission.id);
    navigate(`/missions/${mission.id}`);
  };

  // Démarrer une mission (avec sync offline)
  const handleStartMission = async (missionId: string) => {
    buttonPress();
    
    try {
      // Mettre à jour localement immédiatement
      setMissions(prev => prev.map(m => 
        m.id === missionId ? { ...m, status: 'in_progress' as const } : m
      ));
      
      // Ajouter à la file de sync (pour offline)
      const { enqueueJob } = useMobileSync();
      await enqueueJob('mission_start', {
        missionId,
        timestamp: new Date().toISOString(),
      }, 1); // Priorité haute
      
      toast.success('Mission démarrée !');
    } catch (error) {
      toast.error('Erreur lors du démarrage');
    }
  };

  // Forcer la synchronisation manuelle
  const handleForceSync = async () => {
    buttonPress();
    
    if (pendingJobs === 0) {
      toast.info('Rien à synchroniser');
      return;
    }
    
    try {
      await forceSync();
      toast.success(`${pendingJobs} mission(s) synchronisée(s)`);
    } catch (error) {
      toast.error('Échec de la synchronisation');
    }
  };

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  return (
    <div 
      ref={swipeRef}
      className="min-h-screen bg-slate-50 pb-20" // pb-20 pour laisser place à la bottom nav
    >
      {/* Header avec badge de sync */}
      <div className="bg-white shadow-sm p-4 flex items-center justify-between sticky top-0 z-10">
        <h1 className="text-xl font-bold">Mes Missions</h1>
        
        {pendingJobs > 0 && (
          <button
            onClick={handleForceSync}
            className="flex items-center gap-2 px-3 py-1.5 bg-amber-100 text-amber-700 rounded-full text-sm font-medium active:scale-95 transition-transform"
          >
            <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
            {pendingJobs} en attente
          </button>
        )}
      </div>

      {/* Liste avec Pull to Refresh */}
      <PullToRefresh 
        onRefresh={loadMissions}
        className="min-h-[calc(100vh-200px)]"
      >
        <div className="p-4 space-y-3">
          {missions.map((mission) => (
            <TouchableListItem
              key={mission.id}
              onClick={() => handleMissionSelect(mission)}
              className={`
                bg-white rounded-xl p-4 shadow-sm border border-slate-100
                ${selectedMission === mission.id ? 'ring-2 ring-brand-blue' : ''}
              `}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold text-slate-800">{mission.title}</h3>
                  <p className="text-sm text-slate-500">{mission.date}</p>
                  
                  <span className={`
                    inline-block mt-2 px-2 py-0.5 text-xs font-medium rounded-full
                    ${mission.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : ''}
                    ${mission.status === 'in_progress' ? 'bg-blue-100 text-blue-700' : ''}
                    ${mission.status === 'pending' ? 'bg-amber-100 text-amber-700' : ''}
                  `}>
                    {mission.status === 'completed' && 'Terminée'}
                    {mission.status === 'in_progress' && 'En cours'}
                    {mission.status === 'pending' && 'En attente'}
                  </span>
                </div>
                
                {mission.status === 'pending' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStartMission(mission.id);
                    }}
                    className="ml-4 px-4 py-2 bg-brand-blue text-white rounded-lg text-sm font-medium active:scale-95 transition-transform"
                  >
                    Démarrer
                  </button>
                )}
              </div>
            </TouchableListItem>
          ))}
        </div>
        
        {/* Indicateur de scroll infini */}
        {isNearBottom && (
          <div className="py-4 flex justify-center">
            <div className="w-6 h-6 border-2 border-slate-300 border-t-brand-blue rounded-full animate-spin" />
          </div>
        )}
      </PullToRefresh>

      {/* Empty state */}
      {missions.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
            <span className="text-2xl">📋</span>
          </div>
          <p className="text-lg font-medium">Aucune mission</p>
          <p className="text-sm">Tirez vers le bas pour rafraîchir</p>
        </div>
      )}
    </div>
  );
};

export default MissionListPageExample;
