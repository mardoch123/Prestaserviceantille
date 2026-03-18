import { useState, useCallback, useRef, useEffect } from 'react';

export type UploadStatus = 'idle' | 'uploading' | 'completed' | 'error' | 'retrying';

export interface UploadJob {
  jobId: string;
  kind: 'start' | 'end';
  missionId: string;
  missionTitle?: string;
  remark?: string;
  photos?: string[];
  video?: string;
  createdAt: string;
  tries: number;
  status: UploadStatus;
  progress: number;
  totalItems: number;
  completedItems: number;
  errorMessage?: string;
  completedAt?: string;
}

interface UploadProgressState {
  jobs: UploadJob[];
  activeJob: UploadJob | null;
  isProcessing: boolean;
}

const UPLOAD_QUEUE_KEY = 'presta_upload_queue_v2';
const UPLOAD_PROGRESS_KEY = 'presta_upload_progress';

export function useUploadProgress() {
  const [state, setState] = useState<UploadProgressState>({
    jobs: [],
    activeJob: null,
    isProcessing: false,
  });

  // Load initial state from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(UPLOAD_QUEUE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setState(prev => ({ ...prev, jobs: parsed }));
        }
      }
    } catch {
      // ignore
    }
  }, []);

  // Persist jobs to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(UPLOAD_QUEUE_KEY, JSON.stringify(state.jobs));
    } catch {
      // ignore
    }
  }, [state.jobs]);

  const addJob = useCallback((job: Omit<UploadJob, 'status' | 'progress' | 'totalItems' | 'completedItems'>) => {
    const totalItems = (job.photos?.length || 0) + (job.video ? 1 : 0);
    const newJob: UploadJob = {
      ...job,
      status: 'idle',
      progress: 0,
      totalItems,
      completedItems: 0,
    };

    setState(prev => ({
      ...prev,
      jobs: [newJob, ...prev.jobs],
    }));

    return newJob.jobId;
  }, []);

  const updateJobProgress = useCallback((jobId: string, progress: number, completedItems?: number) => {
    setState(prev => ({
      ...prev,
      jobs: prev.jobs.map(j =>
        j.jobId === jobId
          ? { ...j, progress: Math.min(100, Math.max(0, progress)), completedItems: completedItems ?? j.completedItems, status: 'uploading' }
          : j
      ),
      activeJob: prev.activeJob?.jobId === jobId
        ? { ...prev.activeJob, progress: Math.min(100, Math.max(0, progress)), completedItems: completedItems ?? prev.activeJob.completedItems, status: 'uploading' }
        : prev.activeJob,
    }));
  }, []);

  const setJobStatus = useCallback((jobId: string, status: UploadStatus, errorMessage?: string) => {
    setState(prev => {
      const updatedJobs = prev.jobs.map(j =>
        j.jobId === jobId
          ? { ...j, status, errorMessage, ...(status === 'completed' ? { completedAt: new Date().toISOString(), progress: 100 } : {}) }
          : j
      );
      
      const updatedActiveJob = prev.activeJob?.jobId === jobId
        ? { ...prev.activeJob, status, errorMessage, ...(status === 'completed' ? { completedAt: new Date().toISOString(), progress: 100 } : {}) }
        : prev.activeJob;

      return {
        ...prev,
        jobs: updatedJobs,
        activeJob: updatedActiveJob,
      };
    });
  }, []);

  const setActiveJob = useCallback((job: UploadJob | null) => {
    setState(prev => ({
      ...prev,
      activeJob: job,
      isProcessing: job !== null,
    }));
  }, []);

  const removeJob = useCallback((jobId: string) => {
    setState(prev => ({
      ...prev,
      jobs: prev.jobs.filter(j => j.jobId !== jobId),
      activeJob: prev.activeJob?.jobId === jobId ? null : prev.activeJob,
    }));
  }, []);

  const retryJob = useCallback((jobId: string) => {
    setState(prev => ({
      ...prev,
      jobs: prev.jobs.map(j =>
        j.jobId === jobId
          ? { ...j, status: 'retrying' as const, tries: j.tries + 1, progress: 0, errorMessage: undefined }
          : j
      ),
    }));
  }, []);

  const clearCompletedJobs = useCallback(() => {
    setState(prev => ({
      ...prev,
      jobs: prev.jobs.filter(j => j.status !== 'completed'),
    }));
  }, []);

  const getPendingJobs = useCallback(() => {
    return state.jobs.filter(j => j.status === 'idle' || j.status === 'retrying');
  }, [state.jobs]);

  const getCompletedJobs = useCallback(() => {
    return state.jobs.filter(j => j.status === 'completed');
  }, [state.jobs]);

  const getFailedJobs = useCallback(() => {
    return state.jobs.filter(j => j.status === 'error');
  }, [state.jobs]);

  return {
    jobs: state.jobs,
    activeJob: state.activeJob,
    isProcessing: state.isProcessing,
    addJob,
    updateJobProgress,
    setJobStatus,
    setActiveJob,
    removeJob,
    retryJob,
    clearCompletedJobs,
    getPendingJobs,
    getCompletedJobs,
    getFailedJobs,
  };
}

export default useUploadProgress;
