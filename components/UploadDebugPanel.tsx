import React, { useState, useEffect } from 'react';
import { X, RefreshCw, Bug, Eye, EyeOff, Trash2, Download } from 'lucide-react';

interface UploadDebugPanelProps {
  uploadJobs: any[];
  activeUploadJob: any;
  isUploadProcessing: boolean;
}

const UploadDebugPanel: React.FC<UploadDebugPanelProps> = ({
  uploadJobs,
  activeUploadJob,
  isUploadProcessing,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [localStorageData, setLocalStorageData] = useState<any>({});
  const [logs, setLogs] = useState<string[]>([]);

  useEffect(() => {
    const interval = setInterval(() => {
      try {
        const data: any = {};
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && (key.includes('mission') || key.includes('upload') || key.includes('queue'))) {
            try {
              data[key] = JSON.parse(localStorage.getItem(key) || 'null');
            } catch {
              data[key] = localStorage.getItem(key);
            }
          }
        }
        setLocalStorageData(data);

        // Récupérer les logs
        const debugLogs = localStorage.getItem('debug_upload_logs');
        if (debugLogs) {
          setLogs(JSON.parse(debugLogs).slice(-50));
        }
      } catch (e) {
        console.error('Debug panel error:', e);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const clearLogs = () => {
    localStorage.removeItem('debug_upload_logs');
    setLogs([]);
  };

  const exportDebugData = () => {
    const data = {
      timestamp: new Date().toISOString(),
      uploadJobs,
      activeUploadJob,
      isUploadProcessing,
      localStorage: localStorageData,
      logs,
      userAgent: navigator.userAgent,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `upload-debug-${Date.now()}.json`;
    a.click();
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-20 right-4 z-[100] bg-purple-600 text-white p-3 rounded-full shadow-lg hover:bg-purple-700 transition"
        title="Debug Upload Jobs"
      >
        <Bug className="w-5 h-5" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-[100] bg-white rounded-xl shadow-2xl border border-purple-200 w-[400px] max-h-[80vh] overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-purple-700 text-white p-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bug className="w-5 h-5" />
          <span className="font-bold">Debug Upload Jobs</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={exportDebugData}
            className="p-1.5 hover:bg-white/20 rounded transition"
            title="Exporter les données"
          >
            <Download className="w-4 h-4" />
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1.5 hover:bg-white/20 rounded transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="overflow-y-auto max-h-[60vh]">
        {/* Status */}
        <div className="p-3 border-b border-gray-100">
          <h4 className="font-semibold text-gray-800 mb-2">État du système</h4>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Jobs actifs:</span>
              <span className="font-mono">{uploadJobs.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Processing:</span>
              <span className={isUploadProcessing ? 'text-green-600 font-semibold' : 'text-gray-500'}>
                {isUploadProcessing ? 'OUI' : 'NON'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Job actif:</span>
              <span className="font-mono text-xs truncate max-w-[150px]">
                {activeUploadJob?.jobId || 'Aucun'}
              </span>
            </div>
          </div>
        </div>

        {/* Upload Jobs */}
        <div className="p-3 border-b border-gray-100">
          <h4 className="font-semibold text-gray-800 mb-2">Jobs en mémoire ({uploadJobs.length})</h4>
          {uploadJobs.length === 0 ? (
            <p className="text-sm text-gray-500 italic">Aucun job en mémoire</p>
          ) : (
            <div className="space-y-2">
              {uploadJobs.map((job) => (
                <div
                  key={job.jobId}
                  className={`p-2 rounded-lg text-xs border ${
                    job.jobId === activeUploadJob?.jobId
                      ? 'bg-blue-50 border-blue-200'
                      : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <span className="font-mono truncate max-w-[150px]">{job.jobId.slice(0, 8)}...</span>
                    <span
                      className={`px-1.5 py-0.5 rounded ${
                        job.status === 'completed'
                          ? 'bg-green-100 text-green-700'
                          : job.status === 'error'
                          ? 'bg-red-100 text-red-700'
                          : job.status === 'uploading'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {job.status}
                    </span>
                  </div>
                  <div className="mt-1 text-gray-600">
                    {job.kind === 'start' ? 'Démarrage' : 'Clôture'} - {job.progress}%
                  </div>
                  <div className="text-gray-500">
                    {job.photos?.length || 0} photos, {job.video ? '1 vidéo' : '0 vidéo'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* LocalStorage */}
        <div className="p-3 border-b border-gray-100">
          <h4 className="font-semibold text-gray-800 mb-2">LocalStorage</h4>
          {Object.keys(localStorageData).length === 0 ? (
            <p className="text-sm text-gray-500 italic">Aucune donnée trouvée</p>
          ) : (
            <div className="space-y-2">
              {Object.entries(localStorageData).map(([key, value]) => (
                <details key={key} className="text-xs">
                  <summary className="cursor-pointer text-purple-600 hover:text-purple-800 font-mono">
                    {key}
                  </summary>
                  <pre className="mt-1 p-2 bg-gray-50 rounded overflow-x-auto text-gray-700 max-h-[100px]">
                    {JSON.stringify(value, null, 2)}
                  </pre>
                </details>
              ))}
            </div>
          )}
        </div>

        {/* Logs */}
        <div className="p-3">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-semibold text-gray-800">Logs ({logs.length})</h4>
            <button
              onClick={clearLogs}
              className="p-1 hover:bg-red-100 text-red-600 rounded transition"
              title="Effacer les logs"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
          <div className="bg-gray-900 text-green-400 p-2 rounded-lg text-xs font-mono max-h-[150px] overflow-y-auto space-y-1">
            {logs.length === 0 ? (
              <span className="text-gray-500">Aucun log</span>
            ) : (
              logs.map((log, i) => (
                <div key={i} className="border-b border-gray-800 pb-1 last:border-0">
                  {log}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default UploadDebugPanel;
