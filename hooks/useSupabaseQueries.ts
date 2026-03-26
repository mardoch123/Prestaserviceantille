/**
 * Hooks TanStack Query pour Presta Services Antilles
 * Ultra-fiable avec persistance offline via localForage
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../utils/supabaseClient';
import { queryClient } from '../utils/queryClient';

// Types
interface QueryOptions {
  enabled?: boolean;
  staleTime?: number;
}

// ==================== CLIENTS ====================
const CLIENTS_KEY = ['clients'];

export function useClients(options?: QueryOptions) {
  return useQuery({
    queryKey: CLIENTS_KEY,
    queryFn: async () => {
      const { data, error } = await supabase.from('clients').select('*');
      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 24 * 60 * 60 * 1000, // 24 heures
    ...options,
  });
}

export function usePrefetchClients() {
  return () => {
    queryClient.prefetchQuery({
      queryKey: CLIENTS_KEY,
      queryFn: async () => {
        const { data, error } = await supabase.from('clients').select('*');
        if (error) throw error;
        return data || [];
      },
    });
  };
}

// ==================== PROVIDERS ====================
const PROVIDERS_KEY = ['providers'];

export function useProviders(options?: QueryOptions) {
  return useQuery({
    queryKey: PROVIDERS_KEY,
    queryFn: async () => {
      const { data, error } = await supabase.from('providers').select('*');
      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    ...options,
  });
}

// ==================== MISSIONS ====================
const MISSIONS_KEY = ['missions'];

export function useMissions(options?: QueryOptions) {
  return useQuery({
    queryKey: MISSIONS_KEY,
    queryFn: async () => {
      // Date range: 6 mois avant à 6 mois après
      const now = new Date();
      const startDate = new Date(now.getFullYear(), now.getMonth() - 6, 1);
      const endDate = new Date(now.getFullYear(), now.getMonth() + 7, 0);

      const { data, error } = await supabase
        .from('missions')
        .select('*')
        .gte('date', startDate.toISOString().split('T')[0])
        .lte('date', endDate.toISOString().split('T')[0]);

      if (error) throw error;
      return data || [];
    },
    staleTime: 3 * 60 * 1000, // 3 minutes pour missions (changent souvent)
    gcTime: 24 * 60 * 60 * 1000,
    ...options,
  });
}

export function useMissionById(missionId: string | null) {
  return useQuery({
    queryKey: ['missions', missionId],
    queryFn: async () => {
      if (!missionId) return null;
      const { data, error } = await supabase
        .from('missions')
        .select('*')
        .eq('id', missionId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!missionId,
    staleTime: 2 * 60 * 1000,
  });
}

// ==================== DOCUMENTS ====================
const DOCUMENTS_KEY = ['documents'];

// Helper to map document fields from snake_case to camelCase
const mapDocumentRow = (d: any): any => ({
  ...d,
  clientId: d.client_id || d.clientId,
  clientName: d.client_name || d.clientName,
  unitPrice: d.unit_price || d.unitPrice,
  tvaRate: d.tva_rate || d.tvaRate,
  totalHT: d.total_ht || d.totalHT,
  totalTTC: d.total_ttc || d.totalTTC,
  taxCreditEnabled: d.tax_credit_enabled || d.taxCreditEnabled,
  slotsData: d.slots_data || d.slotsData,
  reminderSent: d.reminder_sent || d.reminderSent,
  signatureData: d.signature_data,
  signatureDate: d.signature_date,
  recurrenceEndDate: d.recurrence_end_date,
  frequency: d.frequency,
  packId: d.pack_id || d.packId
});

export function useDocuments(options?: QueryOptions) {
  return useQuery({
    queryKey: DOCUMENTS_KEY,
    queryFn: async () => {
      const { data, error } = await supabase.from('documents').select('*');
      if (error) throw error;
      // Map fields from snake_case to camelCase
      return (data || []).map(mapDocumentRow);
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    ...options,
  });
}

// ==================== NOTIFICATIONS ====================
const NOTIFICATIONS_KEY = ['notifications'];

export function useNotifications(options?: QueryOptions) {
  return useQuery({
    queryKey: NOTIFICATIONS_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .order('date', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data || [];
    },
    staleTime: 1 * 60 * 1000, // 1 minute pour notifications
    gcTime: 24 * 60 * 60 * 1000,
    refetchInterval: 30000, // Refetch auto toutes les 30s
    ...options,
  });
}

// ==================== PACKS ====================
const PACKS_KEY = ['packs'];

export function usePacks(options?: QueryOptions) {
  return useQuery({
    queryKey: PACKS_KEY,
    queryFn: async () => {
      const { data, error } = await supabase.from('packs').select('*');
      if (error) throw error;
      return data || [];
    },
    staleTime: 10 * 60 * 1000, // 10 minutes (rarement modifiés)
    gcTime: 24 * 60 * 60 * 1000,
    ...options,
  });
}

// ==================== CONTRACTS ====================
const CONTRACTS_KEY = ['contracts'];

export function useContracts(options?: QueryOptions) {
  return useQuery({
    queryKey: CONTRACTS_KEY,
    queryFn: async () => {
      const { data, error } = await supabase.from('contracts').select('*');
      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    ...options,
  });
}

// ==================== COMPANY SETTINGS ====================
const COMPANY_SETTINGS_KEY = ['company_settings'];

export function useCompanySettings(options?: QueryOptions) {
  return useQuery({
    queryKey: COMPANY_SETTINGS_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company_settings')
        .select('*')
        .single();
      if (error) throw error;
      return data;
    },
    staleTime: 30 * 60 * 1000, // 30 minutes (rarement modifié)
    gcTime: 24 * 60 * 60 * 1000,
    ...options,
  });
}

// ==================== MUTATIONS ====================

// Mutation pour créer un client avec invalidation automatique
export function useCreateClient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (clientData: any) => {
      const { data, error } = await supabase
        .from('clients')
        .insert(clientData)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      // Invalider le cache des clients
      queryClient.invalidateQueries({ queryKey: CLIENTS_KEY });
    },
  });
}

// Mutation pour mettre à jour une mission
export function useUpdateMission() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; [key: string]: any }) => {
      const { data, error } = await supabase
        .from('missions')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      // Invalider les queries concernées
      queryClient.invalidateQueries({ queryKey: MISSIONS_KEY });
      queryClient.invalidateQueries({ queryKey: ['missions', data.id] });
    },
  });
}

// Mutation pour marquer une notification comme lue
export function useMarkNotificationRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notificationId: string) => {
      const { data, error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
    },
  });
}

// ==================== HOOK COMPOSITE ====================

// Hook pour charger toutes les données critiques (dashboard)
export function useDashboardData() {
  const clients = useClients({ staleTime: 5 * 60 * 1000 });
  const providers = useProviders({ staleTime: 5 * 60 * 1000 });
  const missions = useMissions({ staleTime: 3 * 60 * 1000 });
  const notifications = useNotifications({ staleTime: 1 * 60 * 1000 });
  const documents = useDocuments({ staleTime: 5 * 60 * 1000 });

  return {
    clients,
    providers,
    missions,
    notifications,
    documents,
    isLoading: clients.isLoading || providers.isLoading || missions.isLoading,
    isError: clients.isError || providers.isError || missions.isError,
    // Données sont disponibles immédiatement depuis le cache persistant
    isReady: !clients.isLoading && !providers.isLoading && !missions.isLoading,
  };
}

// Hook pour précharger toutes les données (à appeler au démarrage)
export function usePrefetchAll() {
  const queryClient = useQueryClient();

  return () => {
    // Précharger les données critiques
    queryClient.prefetchQuery({
      queryKey: CLIENTS_KEY,
      queryFn: async () => {
        const { data } = await supabase.from('clients').select('*');
        return data || [];
      },
    });

    queryClient.prefetchQuery({
      queryKey: PROVIDERS_KEY,
      queryFn: async () => {
        const { data } = await supabase.from('providers').select('*');
        return data || [];
      },
    });

    queryClient.prefetchQuery({
      queryKey: MISSIONS_KEY,
      queryFn: async () => {
        const { data } = await supabase.from('missions').select('*');
        return data || [];
      },
    });

    queryClient.prefetchQuery({
      queryKey: DOCUMENTS_KEY,
      queryFn: async () => {
        const { data } = await supabase.from('documents').select('*');
        // Map fields from snake_case to camelCase
        return (data || []).map(mapDocumentRow);
      },
    });
  };
}

export default useDashboardData;
