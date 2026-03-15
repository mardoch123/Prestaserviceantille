import { Capacitor } from '@capacitor/core';
import { Network } from '@capacitor/network';

// Storage utilisant localStorage (fonctionne sur web et natif)
const storage = {
  getItem(key: string): string | null {
    return localStorage.getItem(key);
  },
  
  setItem(key: string, value: string): void {
    localStorage.setItem(key, value);
  },
  
  removeItem(key: string): void {
    localStorage.removeItem(key);
  }
};

// Types pour la file d'attente de synchronisation
type SyncJobType = 'mission_start' | 'mission_end' | 'document_update' | 'client_update' | 'provider_update';

interface SyncJob {
  id: string;
  type: SyncJobType;
  payload: any;
  timestamp: string;
  retryCount: number;
  priority: number; // 1 = haute, 2 = normale, 3 = basse
}

interface SyncState {
  isOnline: boolean;
  lastSync: string | null;
  pendingJobs: number;
  isSyncing: boolean;
}

const SYNC_QUEUE_KEY = 'sync_queue';
const SYNC_STATE_KEY = 'sync_state';
const MAX_RETRIES = 3;
const RETRY_DELAY = 5000; // 5 secondes

/**
 * Service de synchronisation pour l'app mobile
 * Gère la file d'attente offline et la sync avec Supabase
 */
export class MobileSyncService {
  private static instance: MobileSyncService;
  private syncInProgress = false;
  private listeners: Set<(state: SyncState) => void> = new Set();

  static getInstance(): MobileSyncService {
    if (!MobileSyncService.instance) {
      MobileSyncService.instance = new MobileSyncService();
    }
    return MobileSyncService.instance;
  }

  constructor() {
    this.initNetworkListener();
  }

  // Écoute les changements de connexion
  private async initNetworkListener() {
    if (!Capacitor.isNativePlatform()) return;

    // État initial
    const status = await Network.getStatus();
    await this.updateNetworkState(status.connected);

    // Écoute des changements
    Network.addListener('networkStatusChange', async (status) => {
      await this.updateNetworkState(status.connected);
      if (status.connected) {
        // Lancer la sync automatiquement quand on revient online
        await this.processSyncQueue();
      }
    });
  }

  private async updateNetworkState(connected: boolean) {
    const state = await this.getSyncState();
    state.isOnline = connected;
    await this.saveSyncState(state);
    this.notifyListeners(state);
  }

  // Ajoute un job à la file d'attente (mode offline)
  async enqueueJob(type: SyncJobType, payload: any, priority = 2): Promise<void> {
    const job: SyncJob = {
      id: this.generateId(),
      type,
      payload,
      timestamp: new Date().toISOString(),
      retryCount: 0,
      priority,
    };

    const queue = this.getQueue();
    // Insérer selon la priorité
    const insertIndex = queue.findIndex(j => j.priority > priority);
    if (insertIndex === -1) {
      queue.push(job);
    } else {
      queue.splice(insertIndex, 0, job);
    }

    this.saveQueue(queue);
    this.updatePendingCount();

    // Essayer de sync immédiatement si online
    const state = this.getSyncState();
    if (state.isOnline && !this.syncInProgress) {
      await this.processSyncQueue();
    }
  }

  // Traite la file d'attente de synchronisation
  async processSyncQueue(): Promise<void> {
    if (this.syncInProgress) return;

    const state = this.getSyncState();
    if (!state.isOnline) {
      console.log('[Sync] Hors ligne - sync reportée');
      return;
    }

    this.syncInProgress = true;
    state.isSyncing = true;
    this.saveSyncState(state);
    this.notifyListeners(state);

    try {
      const queue = this.getQueue();
      const failedJobs: SyncJob[] = [];

      for (const job of queue) {
        try {
          await this.executeJob(job);
          console.log(`[Sync] Job ${job.id} (${job.type}) exécuté avec succès`);
        } catch (error) {
          console.error(`[Sync] Job ${job.id} échoué:`, error);
          job.retryCount++;

          if (job.retryCount < MAX_RETRIES) {
            failedJobs.push(job);
          } else {
            // Max retries atteint - marquer comme échoué définitivement
            this.handleFailedJob(job, error as Error);
          }
        }
      }

      this.saveQueue(failedJobs);
      state.lastSync = new Date().toISOString();

      // Si des jobs ont échoué, planifier une nouvelle tentative
      if (failedJobs.length > 0) {
        setTimeout(() => this.processSyncQueue(), RETRY_DELAY);
      }
    } finally {
      this.syncInProgress = false;
      state.isSyncing = false;
      this.saveSyncState(state);
      this.updatePendingCount();
      this.notifyListeners(state);
    }
  }

  // Exécute un job selon son type
  private async executeJob(job: SyncJob): Promise<void> {
    const { supabase } = await import('../utils/supabaseClient');

    switch (job.type) {
      case 'mission_start':
        const { error: startError } = await supabase
          .from('missions')
          .update({
            status: 'in_progress',
            start_remark: job.payload.remark,
            start_photos: job.payload.photos,
            start_video: job.payload.video,
          })
          .eq('id', job.payload.missionId);
        if (startError) throw startError;
        break;

      case 'mission_end':
        const { error: endError } = await supabase
          .from('missions')
          .update({
            status: 'completed',
            end_remark: job.payload.remark,
            end_photos: job.payload.photos,
            end_video: job.payload.video,
            report_sent: true,
          })
          .eq('id', job.payload.missionId);
        if (endError) throw endError;
        break;

      case 'document_update':
        const { error: docError } = await supabase
          .from('documents')
          .update(job.payload.updates)
          .eq('id', job.payload.documentId);
        if (docError) throw docError;
        break;

      case 'client_update':
        const { error: clientError } = await supabase
          .from('clients')
          .update(job.payload.updates)
          .eq('id', job.payload.clientId);
        if (clientError) throw clientError;
        break;

      case 'provider_update':
        const { error: providerError } = await supabase
          .from('providers')
          .update(job.payload.updates)
          .eq('id', job.payload.providerId);
        if (providerError) throw providerError;
        break;

      default:
        throw new Error(`Type de job inconnu: ${job.type}`);
    }
  }

  // Gère les jobs qui ont échoué définitivement
  private handleFailedJob(job: SyncJob, error: Error): void {
    console.error(`[Sync] Job ${job.id} abandonné après ${MAX_RETRIES} tentatives`);
    const value = storage.getItem('failed_sync_jobs');
    const failed = value ? JSON.parse(value) : [];
    failed.push({ ...job, finalError: error.message, failedAt: new Date().toISOString() });
    storage.setItem('failed_sync_jobs', JSON.stringify(failed.slice(-50)));
  }

  // Méthodes utilitaires
  private getQueue(): SyncJob[] {
    const value = storage.getItem(SYNC_QUEUE_KEY);
    return value ? JSON.parse(value) : [];
  }

  private saveQueue(queue: SyncJob[]): void {
    storage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
  }

  getSyncState(): SyncState {
    const value = storage.getItem(SYNC_STATE_KEY);
    return value ? JSON.parse(value) : { isOnline: true, lastSync: null, pendingJobs: 0, isSyncing: false };
  }

  private saveSyncState(state: SyncState): void {
    storage.setItem(SYNC_STATE_KEY, JSON.stringify(state));
  }

  private updatePendingCount(): void {
    const queue = this.getQueue();
    const state = this.getSyncState();
    state.pendingJobs = queue.length;
    this.saveSyncState(state);
  }

  // S'abonner aux changements d'état
  subscribe(listener: (state: SyncState) => void): () => void {
    this.listeners.add(listener);
    // Envoyer l'état initial
    listener(this.getSyncState());
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(state: SyncState): void {
    this.listeners.forEach(listener => listener(state));
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // Force une synchronisation manuelle
  async forceSync(): Promise<boolean> {
    const state = this.getSyncState();
    if (!state.isOnline) {
      throw new Error('Impossible de synchroniser : hors ligne');
    }
    await this.processSyncQueue();
    return true;
  }

  // Vide la file d'attente (utile pour reset)
  clearQueue(): void {
    storage.removeItem(SYNC_QUEUE_KEY);
    this.updatePendingCount();
  }

  // Récupère les jobs en échec
  getFailedJobs(): any[] {
    const value = storage.getItem('failed_sync_jobs');
    return value ? JSON.parse(value) : [];
  }
}

// Hook React pour utiliser le service de sync
import { useEffect, useState, useCallback } from 'react';

export function useMobileSync() {
  const [syncState, setSyncState] = useState<SyncState>({
    isOnline: true,
    lastSync: null,
    pendingJobs: 0,
    isSyncing: false,
  });

  const syncService = MobileSyncService.getInstance();

  useEffect(() => {
    return syncService.subscribe(setSyncState);
  }, []);

  const enqueueJob = useCallback(
    (type: SyncJobType, payload: any, priority?: number) =>
      syncService.enqueueJob(type, payload, priority),
    []
  );

  const forceSync = useCallback(() => syncService.forceSync(), []);

  const clearQueue = useCallback(() => syncService.clearQueue(), []);

  return {
    ...syncState,
    enqueueJob,
    forceSync,
    clearQueue,
  };
}

export default MobileSyncService;
