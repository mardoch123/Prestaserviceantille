/**
 * DataContext avec TanStack Query Integration
 * Remplace les appels Supabase directs par des hooks useQuery
 * pour un caching intelligent et des performances optimales
 */

import React, { useEffect, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  useClients,
  useProviders,
  useMissions,
  useDocuments,
  useNotifications,
  useCompanySettings,
  useCreateClient,
  useUpdateMission,
  usePrefetchAll,
} from '../hooks/useSupabaseQueries';
import { queryClient } from '../utils/queryClient';

// Hook personnalisé pour utiliser les données avec caching
export function useDataWithCache() {
  const queryClient = useQueryClient();
  
  // Données avec caching automatique
  const clientsQuery = useClients({ staleTime: 5 * 60 * 1000 });
  const providersQuery = useProviders({ staleTime: 5 * 60 * 1000 });
  const missionsQuery = useMissions({ staleTime: 3 * 60 * 1000 });
  const documentsQuery = useDocuments({ staleTime: 5 * 60 * 1000 });
  const notificationsQuery = useNotifications({ staleTime: 1 * 60 * 1000 });
  const companySettingsQuery = useCompanySettings({ staleTime: 30 * 60 * 1000 });

  // Mutations
  const createClientMutation = useCreateClient();
  const updateMissionMutation = useUpdateMission();
  const prefetchAll = usePrefetchAll();

  // Helper pour invalider le cache
  const invalidateCache = useCallback((key: string[]) => {
    queryClient.invalidateQueries({ queryKey: key });
  }, [queryClient]);

  // Helper pour refetch manuel
  const refetchAll = useCallback(async () => {
    await Promise.all([
      queryClient.refetchQueries({ queryKey: ['clients'] }),
      queryClient.refetchQueries({ queryKey: ['providers'] }),
      queryClient.refetchQueries({ queryKey: ['missions'] }),
      queryClient.refetchQueries({ queryKey: ['documents'] }),
      queryClient.refetchQueries({ queryKey: ['notifications'] }),
    ]);
  }, [queryClient]);

  return {
    // Données
    clients: clientsQuery.data ?? [],
    providers: providersQuery.data ?? [],
    missions: missionsQuery.data ?? [],
    documents: documentsQuery.data ?? [],
    notifications: notificationsQuery.data ?? [],
    companySettings: companySettingsQuery.data,
    
    // États de chargement
    isLoading: clientsQuery.isLoading || providersQuery.isLoading || missionsQuery.isLoading,
    isError: clientsQuery.isError || providersQuery.isError || missionsQuery.isError,
    
    // Cache info
    isFetching: clientsQuery.isFetching || providersQuery.isFetching || missionsQuery.isFetching,
    isStale: !clientsQuery.isStale && !providersQuery.isStale && !missionsQuery.isStale,
    
    // Actions
    refetchAll,
    invalidateCache,
    prefetchAll,
    
    // Mutations
    createClient: createClientMutation.mutate,
    updateMission: updateMissionMutation.mutate,
    
    // Queries individuelles pour accès avancé
    queries: {
      clients: clientsQuery,
      providers: providersQuery,
      missions: missionsQuery,
      documents: documentsQuery,
      notifications: notificationsQuery,
      companySettings: companySettingsQuery,
    },
  };
}

// Hook pour synchroniser les données cross-tab
export function useQuerySync() {
  const syncAttempted = useRef(false);
  
  useEffect(() => {
    if (syncAttempted.current) return;
    syncAttempted.current = true;
    
    // Invalider le cache quand on revient online
    const handleOnline = () => {
      console.log('[TanStack] Connexion rétablie, invalidation du cache...');
      queryClient.invalidateQueries();
    };
    
    // Refetch quand la fenêtre redevient visible
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('[TanStack] Fenêtre visible, refetch...');
        queryClient.refetchQueries({ queryKey: ['notifications'] });
      }
    };
    
    window.addEventListener('online', handleOnline);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);
}

// Composant pour précharger les données au montage
export function DataPrefetcher({ children }: { children: React.ReactNode }) {
  const prefetchAll = usePrefetchAll();
  
  useEffect(() => {
    // Précharger les données critiques au démarrage
    prefetchAll();
  }, [prefetchAll]);
  
  return <>{children}</>;
}

export default useDataWithCache;
