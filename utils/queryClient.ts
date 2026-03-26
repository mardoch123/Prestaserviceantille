/**
 * Configuration TanStack Query avec persistance localForage
 * Ultra-fiable pour connexions lentes et instables
 */

import { QueryClient, QueryClientConfig } from '@tanstack/react-query';
import { persistQueryClient, PersistedClient, Persister } from '@tanstack/react-query-persist-client';
import localforage from 'localforage';
import { BroadcastChannel } from 'broadcast-channel';

// Configuration de localForage pour le cache
const queryStorage = localforage.createInstance({
  name: 'presta_query_cache',
  storeName: 'queries',
  description: 'Cache persistant pour TanStack Query',
  driver: [
    localforage.INDEXEDDB,
    localforage.LOCALSTORAGE,
  ],
});

// Persister personnalisé avec localForage
const localForagePersister: Persister = {
  persistClient: async (client: PersistedClient) => {
    await queryStorage.setItem('presta-react-query', client);
  },
  restoreClient: async () => {
    const client = await queryStorage.getItem<PersistedClient>('presta-react-query');
    return client ?? undefined;
  },
  removeClient: async () => {
    await queryStorage.removeItem('presta-react-query');
  },
};

// Configuration optimisée pour réseaux lents
export const queryClientConfig: QueryClientConfig = {
  defaultOptions: {
    queries: {
      // Données considérées fraîches pendant 5 minutes
      staleTime: 5 * 60 * 1000,
      // Cache conservé pendant 24h
      gcTime: 24 * 60 * 60 * 1000,
      // Retry intelligent avec backoff
      retry: (failureCount, error: any) => {
        // Ne pas retry sur les erreurs 4xx
        if (error?.status >= 400 && error?.status < 500) return false;
        // Max 3 retries avec délai croissant
        return failureCount < 3;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * Math.pow(2, attemptIndex), 30000),
      // Refetch automatique quand la fenêtre redevient visible
      refetchOnWindowFocus: true,
      // Refetch quand on revient online
      refetchOnReconnect: true,
      // Ne pas refetch si offline
      networkMode: 'offlineFirst',
    },
    mutations: {
      // Retry pour les mutations importantes
      retry: 2,
      retryDelay: 1000,
      // Mode offline avec queue
      networkMode: 'offlineFirst',
    },
  },
};

// Créer le QueryClient
export const queryClient = new QueryClient(queryClientConfig);

// Initialiser la persistance
export async function initQueryPersistance() {
  await persistQueryClient({
    queryClient,
    persister: localForagePersister,
    maxAge: 24 * 60 * 60 * 1000, // 24 heures
    buster: 'v1', // Version du cache (incrémenter pour invalider)
  });

  // Synchronisation cross-tab avec BroadcastChannel
  if (typeof window !== 'undefined' && BroadcastChannel) {
    const channel = new BroadcastChannel('presta-query-sync');
    
    channel.onmessage = (event) => {
      if (event.type === 'invalidate-queries') {
        queryClient.invalidateQueries({ queryKey: event.queryKey });
      }
    };

    // Invalider les queries dans les autres tabs
    queryClient.getQueryCache().subscribe((event) => {
      if (event.type === 'updated' && event.query.state.status === 'success') {
        channel.postMessage({
          type: 'invalidate-queries',
          queryKey: event.query.queryKey,
        });
      }
    });
  }
}

// Helper pour invalider le cache
export function invalidateQueries(queryKey: string[]) {
  return queryClient.invalidateQueries({ queryKey });
}

// Helper pour préfetcher des données
export function prefetchQuery(queryKey: string[], fetchFn: () => Promise<any>) {
  return queryClient.prefetchQuery({
    queryKey,
    queryFn: fetchFn,
    staleTime: 5 * 60 * 1000,
  });
}

// Helper pour obtenir le statut de connexion
export function isQueryClientOnline() {
  return queryClient.getQueryCache().getAll().every(q => q.state.status !== 'error');
}

export default queryClient;
