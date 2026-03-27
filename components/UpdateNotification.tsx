import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Download, X, Sparkles, RefreshCw } from 'lucide-react';

interface VersionInfo {
    version: string;
    buildDate: string;
    buildNumber: number;
}

/**
 * UpdateNotification Component
 * Détecte quand une nouvelle version de l'application est disponible
 * en comparant le numéro de version depuis version.json
 * 
 * Système de version: v1.0.1, v1.0.2, etc.
 * Chaque build incrémente automatiquement le numéro
 */
const UpdateNotification: React.FC = () => {
    const [showUpdateModal, setShowUpdateModal] = useState(false);
    const [isChecking, setIsChecking] = useState(false);
    const [currentVersion, setCurrentVersion] = useState<VersionInfo | null>(null);
    const [newVersion, setNewVersion] = useState<VersionInfo | null>(null);
    const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const lastCheckRef = useRef<number>(0);
    const hasUpdateRef = useRef(false);
    const dismissedVersionRef = useRef<string>('');

    // Get initial version from the loaded app
    useEffect(() => {
        // Try to get the build version from the meta tag
        const versionMeta = document.querySelector('meta[name="app-version"]');
        const buildNumberMeta = document.querySelector('meta[name="app-build-number"]');
        
        const initialVersion: VersionInfo = {
            version: versionMeta?.getAttribute('content') || '1.0.0',
            buildDate: new Date().toISOString(),
            buildNumber: parseInt(buildNumberMeta?.getAttribute('content') || '0', 10)
        };
        
        setCurrentVersion(initialVersion);

        // Load dismissed version from localStorage
        const dismissed = localStorage.getItem('app-update-dismissed-version');
        if (dismissed) {
            dismissedVersionRef.current = dismissed;
        }

        // Store current version in session
        sessionStorage.setItem('app-current-version', JSON.stringify(initialVersion));
    }, []);

    // Check for updates by fetching version.json
    const checkForUpdates = useCallback(async () => {
        // Prevent checking too frequently (min 60 seconds between checks)
        const now = Date.now();
        if (now - lastCheckRef.current < 60000) return;
        lastCheckRef.current = now;

        // Skip if modal already shown or update already detected
        if (showUpdateModal || hasUpdateRef.current) return;

        // Skip if document is not visible
        if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;

        setIsChecking(true);
        try {
            // Fetch version.json with cache-busting
            const response = await fetch(`/version.json?_t=${Date.now()}`, {
                method: 'GET',
                cache: 'no-store',
                headers: {
                    'Accept': 'application/json',
                }
            });

            if (!response.ok) {
                console.log('[UpdateNotification] version.json not found or error');
                setIsChecking(false);
                return;
            }

            const remoteVersion: VersionInfo = await response.json();
            
            // Validate version data
            if (!remoteVersion.version || !remoteVersion.buildNumber) {
                console.log('[UpdateNotification] Invalid version data received');
                setIsChecking(false);
                return;
            }

            const localVersionStr = currentVersion?.version || '1.0.0';
            const remoteVersionStr = remoteVersion.version;

            // Compare versions
            const isNewer = isVersionNewer(remoteVersionStr, localVersionStr);
            
            // Check if user already dismissed this version
            const wasDismissed = dismissedVersionRef.current === remoteVersionStr;

            if (isNewer && !wasDismissed) {
                console.log('[UpdateNotification] New version detected:', {
                    current: localVersionStr,
                    new: remoteVersionStr,
                    build: remoteVersion.buildNumber
                });
                setNewVersion(remoteVersion);
                setShowUpdateModal(true);
                hasUpdateRef.current = true;
            } else {
                console.log('[UpdateNotification] No update needed:', {
                    current: localVersionStr,
                    remote: remoteVersionStr,
                    isNewer,
                    wasDismissed
                });
            }
        } catch (error) {
            console.log('[UpdateNotification] Check failed:', error);
        } finally {
            setIsChecking(false);
        }
    }, [showUpdateModal, currentVersion]);

    // Compare two version strings (e.g., "1.0.1" vs "1.0.2")
    const isVersionNewer = (newVersion: string, currentVersion: string): boolean => {
        const parseVersion = (v: string): number[] => {
            return v.replace(/^v/, '').split('.').map(n => parseInt(n, 10) || 0);
        };

        const newParts = parseVersion(newVersion);
        const currentParts = parseVersion(currentVersion);

        for (let i = 0; i < Math.max(newParts.length, currentParts.length); i++) {
            const newPart = newParts[i] || 0;
            const currentPart = currentParts[i] || 0;
            
            if (newPart > currentPart) return true;
            if (newPart < currentPart) return false;
        }
        
        return false;
    };

    // Handle reload
    const handleUpdate = useCallback(() => {
        localStorage.removeItem('app-update-dismissed-version');
        sessionStorage.removeItem('app-current-version');
        
        if ('caches' in window) {
            caches.keys().then(cacheNames => {
                cacheNames.forEach(cacheName => {
                    caches.delete(cacheName);
                });
            });
        }
        
        window.location.href = window.location.pathname + '?_v=' + Date.now();
    }, []);

    // Dismiss the notification
    const handleDismiss = useCallback(() => {
        setShowUpdateModal(false);
        
        if (newVersion?.version) {
            dismissedVersionRef.current = newVersion.version;
            localStorage.setItem('app-update-dismissed-version', newVersion.version);
        }
        
        setTimeout(() => {
            hasUpdateRef.current = false;
        }, 60 * 60 * 1000);
    }, [newVersion]);

    // Setup periodic checking
    useEffect(() => {
        if (!currentVersion) return;

        const initialTimeout = setTimeout(() => {
            checkForUpdates();
        }, 30000);

        checkIntervalRef.current = setInterval(() => {
            checkForUpdates();
        }, 10 * 60 * 1000);

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                lastCheckRef.current = 0;
                checkForUpdates();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            clearTimeout(initialTimeout);
            if (checkIntervalRef.current) {
                clearInterval(checkIntervalRef.current);
            }
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [checkForUpdates, currentVersion]);

    if (!showUpdateModal || !newVersion) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full mx-4 transform transition-all animate-in zoom-in-95 duration-200">
                <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-brand-blue to-teal-500 rounded-xl flex items-center justify-center shadow-lg">
                        <Sparkles className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-bold text-slate-800 mb-1">
                            Mise à jour disponible !
                        </h3>
                        <p className="text-sm text-slate-600 leading-relaxed">
                            Une nouvelle version de l'application est prête.
                        </p>
                        <div className="mt-2 text-xs text-slate-500 bg-slate-100 rounded-lg px-3 py-2">
                            <div className="flex items-center justify-between">
                                <span>Version actuelle:</span>
                                <span className="font-medium">{currentVersion?.version || 'inconnue'}</span>
                            </div>
                            <div className="flex items-center justify-between mt-1">
                                <span>Nouvelle version:</span>
                                <span className="font-bold text-emerald-600">{newVersion.version}</span>
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={handleDismiss}
                        className="flex-shrink-0 p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                        title="Ignorer"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="mt-6 flex gap-3">
                    <button
                        onClick={handleDismiss}
                        className="flex-1 px-4 py-2.5 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                    >
                        Plus tard
                    </button>
                    <button
                        onClick={handleUpdate}
                        className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-brand-blue hover:bg-teal-700 rounded-xl transition-colors flex items-center justify-center gap-2 shadow-lg shadow-brand-blue/25"
                    >
                        <RefreshCw className="w-4 h-4" />
                        Actualiser
                    </button>
                </div>
            </div>
        </div>
    );
};

export default UpdateNotification;
