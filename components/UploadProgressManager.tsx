import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Upload, X, CheckCircle, AlertCircle, RefreshCw, Loader2, UploadCloud, FileImage, FileVideo } from 'lucide-react';
import type { UploadJob, UploadStatus } from '../hooks/useUploadProgress';

interface UploadProgressManagerProps {
  jobs: UploadJob[];
  activeJob: UploadJob | null;
  isProcessing: boolean;
  onRetry: (jobId: string) => void;
  onRemove: (jobId: string) => void;
  onClearCompleted: () => void;
}

const UploadProgressManager: React.FC<UploadProgressManagerProps> = ({
  jobs,
  activeJob,
  isProcessing,
  onRetry,
  onRemove,
  onClearCompleted,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [showToast, setShowToast] = useState<{ show: boolean; message: string; type: 'success' | 'error' } | null>(null);
  const previousJobsRef = useRef<UploadJob[]>([]);
  
  const pendingJobs = jobs.filter(j => j.status === 'idle' || j.status === 'uploading' || j.status === 'retrying');
  const completedJobs = jobs.filter(j => j.status === 'completed');
  const failedJobs = jobs.filter(j => j.status === 'error');

  // Show toast notification when jobs complete or fail
  useEffect(() => {
    const previousJobs = previousJobsRef.current;
    
    // Check for newly completed jobs
    jobs.forEach(job => {
      const prevJob = previousJobs.find(j => j.jobId === job.jobId);
      if (job.status === 'completed' && prevJob?.status !== 'completed') {
        setShowToast({
          show: true,
          message: `${job.kind === 'start' ? 'Démarrage' : 'Clôture'} de mission terminé avec succès!`,
          type: 'success'
        });
        setTimeout(() => setShowToast(null), 4000);
      }
      if (job.status === 'error' && prevJob?.status !== 'error') {
        setShowToast({
          show: true,
          message: `Échec de l'upload - ${job.errorMessage || 'Erreur inconnue'}`,
          type: 'error'
        });
        setTimeout(() => setShowToast(null), 5000);
      }
    });
    
    previousJobsRef.current = jobs;
  }, [jobs]);

  // Auto-expand when there are active uploads
  useEffect(() => {
    if (isProcessing && !isExpanded) {
      setIsExpanded(true);
    }
  }, [isProcessing]);

  const getStatusIcon = (status: UploadStatus) => {
    switch (status) {
      case 'uploading':
      case 'retrying':
        return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-emerald-500" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return <UploadCloud className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: UploadStatus) => {
    switch (status) {
      case 'uploading':
      case 'retrying':
        return 'bg-blue-500';
      case 'completed':
        return 'bg-emerald-500';
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-gray-300';
    }
  };

  const getStatusText = (status: UploadStatus) => {
    switch (status) {
      case 'uploading':
        return 'Upload en cours...';
      case 'retrying':
        return 'Nouvelle tentative...';
      case 'completed':
        return 'Terminé';
      case 'error':
        return 'Erreur';
      default:
        return 'En attente';
    }
  };

  const formatTime = (dateStr?: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  };

  // Don't render if no jobs
  if (jobs.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[80] flex flex-col items-end gap-2 max-w-sm w-full">
      {/* Collapsed view - Summary badge */}
      {!isExpanded && (
        <button
          onClick={() => setIsExpanded(true)}
          className="flex items-center gap-2 bg-white rounded-full shadow-lg px-4 py-2 border border-gray-200 hover:shadow-xl transition-all"
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
              <span className="text-sm font-medium text-gray-700">
                Upload en cours... {activeJob?.progress}%
              </span>
            </>
          ) : completedJobs.length > 0 ? (
            <>
              <CheckCircle className="w-4 h-4 text-emerald-500" />
              <span className="text-sm font-medium text-gray-700">
                {completedJobs.length} upload{completedJobs.length > 1 ? 's' : ''} terminé{completedJobs.length > 1 ? 's' : ''}
              </span>
            </>
          ) : failedJobs.length > 0 ? (
            <>
              <AlertCircle className="w-4 h-4 text-red-500" />
              <span className="text-sm font-medium text-gray-700">
                {failedJobs.length} échec{failedJobs.length > 1 ? 's' : ''}
              </span>
            </>
          ) : (
            <>
              <UploadCloud className="w-4 h-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">
                {pendingJobs.length} en attente
              </span>
            </>
          )}
          <span className="text-xs text-gray-400">Cliquer pour voir</span>
        </button>
      )}

      {/* Expanded view - Full panel */}
      {isExpanded && (
        <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full overflow-hidden animate-in slide-in-from-bottom-4 fade-in duration-200">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-gray-50 to-white border-b border-gray-100">
            <div className="flex items-center gap-2">
              <Upload className="w-5 h-5 text-emerald-500" />
              <span className="font-semibold text-gray-800">Uploads en cours</span>
              {(pendingJobs.length > 0 || failedJobs.length > 0) && (
                <span className="bg-emerald-100 text-emerald-700 text-xs font-medium px-2 py-0.5 rounded-full">
                  {pendingJobs.length + failedJobs.length}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {completedJobs.length > 0 && (
                <button
                  onClick={onClearCompleted}
                  className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100 transition"
                  title="Effacer les terminés"
                >
                  Effacer terminés
                </button>
              )}
              <button
                onClick={() => setIsExpanded(false)}
                className="p-1.5 hover:bg-gray-100 rounded-full transition"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
          </div>

          {/* Active job with detailed progress */}
          {activeJob && (activeJob.status === 'uploading' || activeJob.status === 'retrying') && (
            <div className="px-4 py-4 bg-blue-50 border-b border-blue-100">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
                  <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">
                    {activeJob.kind === 'start' ? 'Démarrage mission' : 'Fin de mission'}
                  </p>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {activeJob.completedItems} / {activeJob.totalItems} fichiers
                  </p>
                  
                  {/* Progress bar with percentage */}
                  <div className="mt-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-semibold text-blue-700">
                        {activeJob.progress}%
                      </span>
                      <span className="text-xs text-gray-500">
                        {activeJob.status === 'retrying' ? 'Nouvelle tentative...' : 'Upload en cours...'}
                      </span>
                    </div>
                    <div className="h-3 bg-blue-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-300 ease-out"
                        style={{ width: `${activeJob.progress}%` }}
                      />
                    </div>
                  </div>

                  {/* File type indicators */}
                  <div className="flex items-center gap-3 mt-3">
                    {activeJob.photos && activeJob.photos.length > 0 && (
                      <div className="flex items-center gap-1.5 text-xs text-gray-600">
                        <FileImage className="w-3.5 h-3.5" />
                        <span>{activeJob.photos.length} photos</span>
                      </div>
                    )}
                    {activeJob.video && (
                      <div className="flex items-center gap-1.5 text-xs text-gray-600">
                        <FileVideo className="w-3.5 h-3.5" />
                        <span>1 vidéo</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Job list */}
          <div className="max-h-64 overflow-y-auto">
            {/* Pending jobs */}
            {pendingJobs
              .filter(j => j.jobId !== activeJob?.jobId)
              .map(job => (
                <div
                  key={job.jobId}
                  className="px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition"
                >
                  <div className="flex items-center gap-3">
                    {getStatusIcon(job.status)}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">
                        {job.kind === 'start' ? 'Démarrage' : 'Clôture'} mission
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-gray-500">
                          {job.totalItems} fichier{job.totalItems > 1 ? 's' : ''}
                        </span>
                        <span className="text-xs text-gray-400">•</span>
                        <span className="text-xs text-gray-500">
                          {getStatusText(job.status)}
                        </span>
                      </div>
                      {job.status === 'uploading' && (
                        <div className="mt-2">
                          <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${getStatusColor(job.status)} rounded-full transition-all duration-300`}
                              style={{ width: `${job.progress}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-500 mt-1">{job.progress}%</span>
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => onRemove(job.jobId)}
                      className="p-1.5 hover:bg-red-50 rounded-full transition"
                    >
                      <X className="w-4 h-4 text-gray-400 hover:text-red-500" />
                    </button>
                  </div>
                </div>
              ))}

            {/* Failed jobs */}
            {failedJobs.length > 0 && (
              <div className="bg-red-50">
                <div className="px-4 py-2 bg-red-100/50">
                  <span className="text-xs font-medium text-red-700">Échecs ({failedJobs.length})</span>
                </div>
                {failedJobs.map(job => (
                  <div
                    key={job.jobId}
                    className="px-4 py-3 border-b border-red-100 hover:bg-red-100/30 transition"
                  >
                    <div className="flex items-center gap-3">
                      <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">
                          {job.kind === 'start' ? 'Démarrage' : 'Clôture'} mission
                        </p>
                        <p className="text-xs text-red-600 mt-0.5 truncate">
                          {job.errorMessage || 'Erreur lors de l\'upload'}
                        </p>
                      </div>
                      <button
                        onClick={() => onRetry(job.jobId)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-white border border-red-200 rounded-lg text-xs font-medium text-red-600 hover:bg-red-50 transition"
                      >
                        <RefreshCw className="w-3 h-3" />
                        Réessayer
                      </button>
                      <button
                        onClick={() => onRemove(job.jobId)}
                        className="p-1.5 hover:bg-red-100 rounded-full transition"
                      >
                        <X className="w-4 h-4 text-red-400" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Completed jobs (collapsible) */}
            {completedJobs.length > 0 && (
              <div>
                <button
                  onClick={() => setShowCompleted(!showCompleted)}
                  className="w-full px-4 py-2 bg-emerald-50 hover:bg-emerald-100/50 transition flex items-center justify-between"
                >
                  <span className="text-xs font-medium text-emerald-700">
                    Terminés ({completedJobs.length})
                  </span>
                  <span className="text-xs text-emerald-600">
                    {showCompleted ? 'Masquer' : 'Voir'}
                  </span>
                </button>
                {showCompleted && completedJobs.map(job => (
                  <div
                    key={job.jobId}
                    className="px-4 py-2 border-b border-gray-100 hover:bg-gray-50 transition"
                  >
                    <div className="flex items-center gap-3">
                      <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-700">
                          {job.kind === 'start' ? 'Démarrage' : 'Clôture'} mission
                        </p>
                        <p className="text-xs text-gray-400">
                          Terminé à {formatTime(job.completedAt)}
                        </p>
                      </div>
                      <button
                        onClick={() => onRemove(job.jobId)}
                        className="p-1.5 hover:bg-gray-200 rounded-full transition"
                      >
                        <X className="w-4 h-4 text-gray-400" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      {/* Toast notification for completed/failed uploads */}
      {showToast?.show && (
        <div className={`fixed bottom-28 right-4 z-[90] px-4 py-3 rounded-xl shadow-2xl border flex items-center gap-3 animate-in slide-in-from-bottom-4 fade-in duration-200 ${
          showToast.type === 'success' 
            ? 'bg-emerald-500 text-white border-emerald-400' 
            : 'bg-red-500 text-white border-red-400'
        }`}>
          {showToast.type === 'success' ? (
            <CheckCircle className="w-5 h-5" />
          ) : (
            <AlertCircle className="w-5 h-5" />
          )}
          <span className="text-sm font-medium">{showToast.message}</span>
          <button 
            onClick={() => setShowToast(null)}
            className="ml-2 p-1 hover:bg-white/20 rounded-full transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};

export default UploadProgressManager;
