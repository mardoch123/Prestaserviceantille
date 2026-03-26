import React, { useEffect, useRef, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { DataProvider, useData } from './context/DataContext';
import { DataPrefetcher } from './context/DataContext.tanstack';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Dashboard from './components/Dashboard';
import Secretariat from './components/Secretariat';
import DevisFactures from './components/DevisFactures';
import Planning from './components/Planning';
import Statistics from './components/Statistics';
import Clients from './components/Clients';
import Providers from './components/Providers';
import Financials from './components/Financials';
import Reservations from './components/Reservations';
import Settings from './components/Settings';
import QRCodeManager from './components/QRCodeManager';
import AdminDevisDetails from './components/AdminDevisDetails';
import AdminMissionDetails from './components/AdminMissionDetails';
import AdminNotificationDetails from './components/AdminNotificationDetails';
import ClientPortal from './components/ClientPortal';
import ProviderPortal from './components/ProviderPortal';
import NewServiceRequestPage from './components/NewServiceRequestPage';
import MissionReports from './components/MissionReports';
import DemoAccounts from './components/DemoAccounts';
import Login from './components/Login';
import ScanPage from './components/ScanPage';
import ScanSuccess from './components/ScanSuccess';
import ContactPage from './components/ContactPage';
import ContactFormsAdmin from './components/ContactFormsAdmin';
import { WifiOff, RotateCw, Loader2, AlertTriangle, RefreshCw } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import type { PluginListenerHandle } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { LocalNotifications } from '@capacitor/local-notifications';
import FlyersPromotionsPage from './modules/marketing/ui/FlyersPromotionsPage';
import FlyerDetailsPage from './modules/marketing/ui/FlyerDetailsPage';
import FlyerRequestPage from './modules/marketing/ui/FlyerRequestPage';
import OfferOfMomentModal from './modules/marketing/ui/OfferOfMomentModal';
import AdminFlyersPage from './modules/marketing/ui/AdminFlyersPage';
import AdminCustomerRequestsPage from './modules/marketing/ui/AdminCustomerRequestsPage';
import AdminReferralsPage from './modules/marketing/ui/AdminReferralsPage';
import AdminDeletedReferralsPage from './modules/marketing/ui/AdminDeletedReferralsPage';
import AdminReferralLeadsPage from './modules/marketing/ui/AdminReferralLeadsPage';
import AdminRewardsPointsPage from './modules/marketing/ui/AdminRewardsPointsPage';
import AdminReferrersPerformancePage from './modules/marketing/ui/AdminReferrersPerformancePage';
import AdminReferrerPerformanceDetailsPage from './modules/marketing/ui/AdminReferrerPerformanceDetailsPage';
import BecomeReferrerPage from './modules/marketing/ui/BecomeReferrerPage';
import BecomeReferrerClientPage from './modules/marketing/ui/BecomeReferrerClientPage';
import RegisterFilleulPage from './modules/marketing/ui/RegisterFilleulPage';
import ReferralSignupPage from './modules/marketing/ui/ReferralSignupPage';
import ReferralPointsPage from './modules/marketing/ui/ReferralPointsPage';
import ReferrerAccountPage from './modules/marketing/ui/ReferrerAccountPage';
import MyFilleulsPage from './modules/marketing/ui/MyFilleulsPage';
import ReferralLandingPage from './modules/marketing/ui/ReferralLandingPage';
import ReferrerDashboardPage from './modules/marketing/ui/ReferrerDashboardPage';
import RewardsCatalogPage from './modules/marketing/ui/RewardsCatalogPage';
import { AccountingStatistics } from './modules/accounting';
import AdminServiceRequestsPage from './modules/serviceRequests/ui/AdminServiceRequestsPage';
import AdminServiceRequestDetailPage from './modules/serviceRequests/ui/AdminServiceRequestDetailPage';
import { ProviderAvailabilityPage } from './modules/providerAvailability';
import AdminEmailMarketing from './components/AdminEmailMarketing';
import DocumentDetailPage from './components/DocumentDetailPage';
import MissionDetailPage from './components/MissionDetailPage';
import ClientDetailPage from './components/ClientDetailPage';
import ProviderDetailPage from './components/ProviderDetailPage';
import { App as CapacitorApp } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';

// Mobile components & hooks
import { ToastContainer } from './components/mobile/Toast';
import { useMobileViewport, useDisableDoubleTapZoom } from './hooks/useMobile';
import './src/styles/mobile.css';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { queryClient, initQueryPersistance } from './utils/queryClient';
import { registerServiceWorker } from './utils/serviceWorkerRegistration';

const initNativeFeatures = async () => {
    try {
        // Initialiser TanStack Query persistance
        await initQueryPersistance();
        
        // Enregistrer Service Worker (production uniquement)
        if (process.env.NODE_ENV === 'production') {
            registerServiceWorker();
        }
        
        if (Capacitor.isNativePlatform()) {
            try {
                await StatusBar.setStyle({ style: Style.Light });
                await StatusBar.setBackgroundColor({ color: '#FFFFFF' });
            } catch (e) {
                console.warn('StatusBar error', e);
            }
            
            CapacitorApp.addListener('appStateChange', ({ isActive }) => {
                console.log('App state changed. Is active?', isActive);
            });

            CapacitorApp.addListener('backButton', ({ canGoBack }) => {
                if (!canGoBack) {
                    CapacitorApp.exitApp();
                } else {
                    window.history.back();
                }
            });
        }
    } catch (e) {
        console.warn('Native features init failed:', e);
    }
};

// Error Boundary to catch DataProvider context issues
class ErrorBoundary extends React.Component<
    { children: React.ReactNode },
    { hasError: boolean; error: Error | null }
> {
    constructor(props: { children: React.ReactNode }) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    componentDidMount() {
        initNativeFeatures();
    }

    static getDerivedStateFromError(error: Error) {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error('[ErrorBoundary] Caught error:', error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            const isContextError = this.state.error?.message.includes('DataProvider');

            return (
                <div className="min-h-screen flex flex-col items-center justify-center bg-cream-50 p-8 text-center">
                    <div className="bg-white rounded-xl shadow-lg p-8 max-w-md">
                        <AlertTriangle className="w-16 h-16 text-orange-500 mx-auto mb-4" />
                        <h1 className="text-2xl font-bold text-slate-800 mb-2">
                            {isContextError ? 'Contexte Perdu' : 'Erreur Application'}
                        </h1>
                        <p className="text-slate-600 mb-4">
                            {isContextError
                                ? "Le contexte de l'application a été perdu suite à un rechargement. Veuillez actualiser la page."
                                : "Une erreur inattendue s'est produite."
                            }
                        </p>
                        <button
                            onClick={() => window.location.reload()}
                            className="bg-brand-blue text-white px-6 py-3 rounded-lg font-bold hover:bg-teal-700 flex items-center gap-2 mx-auto"
                        >
                            <RefreshCw className="w-4 h-4" />
                            Actualiser la page
                        </button>
                        {!isContextError && (
                            <details className="mt-4 text-left">
                                <summary className="text-sm text-slate-500 cursor-pointer">Détails techniques</summary>
                                <pre className="mt-2 text-xs bg-slate-100 p-2 rounded overflow-auto">
                                    {this.state.error?.message}
                                </pre>
                            </details>
                        )}
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

const FlyersPublicRoutes = () => {
    return (
        <Routes>
            <Route path="/flyers" element={<FlyersPromotionsPage />} />
            <Route path="/flyers/:id" element={<FlyerDetailsPage />} />
            <Route path="/flyers/:id/request" element={<FlyerRequestPage />} />
        </Routes>
    );
};

const ReferralPublicRoutes = () => {
    return (
        <Routes>
            <Route path="/parrainage" element={<ReferralLandingPage />} />
            <Route path="/parrainage/dashboard" element={<ReferrerDashboardPage />} />
            <Route path="/parrainage/recompenses" element={<RewardsCatalogPage />} />
            <Route path="/parrainage/devenir-parrain" element={<BecomeReferrerPage />} />
            <Route path="/parrainage/inscrire-filleul" element={<RegisterFilleulPage />} />
            <Route path="/parrainage/inscription" element={<ReferralSignupPage />} />
            <Route path="/parrainage/devenir-parrain-client" element={<BecomeReferrerClientPage />} />
            <Route path="/parrainage/mes-points" element={<ReferralPointsPage />} />
            <Route path="/parrainage/mon-compte-parrain" element={<ReferrerAccountPage />} />
            <Route path="/parrainage/mes-filleuls" element={<MyFilleulsPage />} />
        </Routes>
    );
};

const OfflineBanner = () => {
    const { isOnline, pendingSyncCount } = useData();

    if (isOnline && pendingSyncCount === 0) return null;

    return (
        <div className={`w-full py-2 px-4 text-sm font-bold text-center flex items-center justify-center gap-2 transition-colors duration-300 ${isOnline ? 'bg-green-600 text-white' : 'bg-slate-800 text-white'}`}>
            {!isOnline ? (
                <>
                    <WifiOff className="w-4 h-4" />
                    Mode Hors-Ligne : {pendingSyncCount} action(s) en attente de synchronisation
                </>
            ) : (
                <>
                    <RotateCw className="w-4 h-4 animate-spin" />
                    Synchronisation en cours ({pendingSyncCount} restant)...
                </>
            )}
        </div>
    );
};

const OfflineScreen = () => {
    const { attemptReconnection, connectionStatus, reconnectAttempts, maxReconnectAttempts } = useData();
    const [isTrying, setIsTrying] = useState(false);

    const handleRetry = async () => {
        if (isTrying) return;
        setIsTrying(true);
        try {
            await attemptReconnection();
        } finally {
            setIsTrying(false);
        }
    };

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-cream-50 p-8 text-center">
            <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full">
                <WifiOff className="w-16 h-16 text-slate-700 mx-auto mb-4" />
                <h1 className="text-2xl font-bold text-slate-800 mb-2">Pas de connexion Internet</h1>
                <p className="text-slate-600 mb-6">
                    Vérifie ta connexion (Wi‑Fi / 4G) puis réessaie.
                </p>

                <div className="text-xs text-slate-500 mb-4">
                    Statut: <span className="font-bold">{connectionStatus}</span>
                    <br />
                    Tentatives: <span className="font-bold">{reconnectAttempts}</span> / {maxReconnectAttempts}
                </div>

                <button
                    onClick={handleRetry}
                    className="bg-brand-blue text-white px-6 py-3 rounded-lg font-bold hover:bg-teal-700 flex items-center gap-2 mx-auto disabled:opacity-60"
                    disabled={isTrying}
                >
                    <RefreshCw className={`w-4 h-4 ${isTrying ? 'animate-spin' : ''}`} />
                    Réessayer
                </button>
            </div>
        </div>
    );
};

const LoadingScreen = ({ mode }: { mode?: 'app' | 'sync' }) => {
    const [showBypass, setShowBypass] = useState(false);
    const { companySettings } = useData();

    useEffect(() => {
        const delay = mode === 'sync' ? 45000 : 4000;
        const timer = setTimeout(() => setShowBypass(true), delay);
        return () => clearTimeout(timer);
    }, [mode]);

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-cream-50 text-slate-600 p-8 text-center">
            <div className="w-full max-w-md flex flex-col items-center">
                <div className="w-full flex justify-center mb-6">
                    {companySettings?.logoUrl ? (
                        <img src={companySettings.logoUrl} alt="Logo" className="h-16 w-auto object-contain" />
                    ) : (
                        <div className="h-16 w-16 rounded-2xl bg-white border border-slate-200 flex items-center justify-center shadow-sm">
                            <Loader2 className="w-6 h-6 text-brand-blue" />
                        </div>
                    )}
                </div>

                <p className="font-bold text-lg animate-pulse">{mode === 'sync' ? 'Synchronisation en cours...' : "Chargement de l'application..."}</p>
                <p className="text-xs text-slate-400 mt-2">{mode === 'sync' ? "Récupération des données et mise à jour de l'affichage." : 'Initialisation des modules et connexion sécurisée.'}</p>

                <div className="mt-6 flex flex-col items-center gap-3">
                    <div className="flex items-center gap-3 text-slate-500">
                        <div className="w-10 h-10 rounded-2xl bg-white border border-slate-200 flex items-center justify-center shadow-sm animate-bounce [animation-delay:-0.2s]">
                            <span className="text-xl">🧹</span>
                        </div>
                        <div className="w-10 h-10 rounded-2xl bg-white border border-slate-200 flex items-center justify-center shadow-sm animate-bounce [animation-delay:-0.1s]">
                            <span className="text-xl">🛠️</span>
                        </div>
                        <div className="w-10 h-10 rounded-2xl bg-white border border-slate-200 flex items-center justify-center shadow-sm animate-bounce">
                            <span className="text-xl">🏠</span>
                        </div>
                    </div>
                    <div className="text-[11px] text-slate-400 font-bold">Préparation de tes services...</div>
                </div>

                {showBypass && (
                    <div className="mt-8 animate-in fade-in slide-in-from-bottom-4">
                        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 max-w-sm">
                            <p className="text-sm text-orange-800 font-bold flex items-center justify-center gap-2 mb-2">
                                <AlertTriangle className="w-4 h-4" /> {mode === 'sync' ? 'La synchronisation semble longue...' : 'Le chargement semble long...'}
                            </p>
                            <p className="text-xs text-orange-600 mb-4">
                                {mode === 'sync'
                                    ? "Si la synchronisation ne se termine pas, veuillez réactualiser la page."
                                    : "Cela peut arriver si la connexion est lente ou si la base de données est en veille."}
                            </p>
                            <button
                                onClick={() => window.location.reload()}
                                className="bg-white border border-orange-300 text-orange-700 px-4 py-2 rounded-lg text-xs font-bold hover:bg-orange-100 flex items-center gap-2 mx-auto"
                            >
                                <RefreshCw className="w-3 h-3" /> Recharger la page
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

const AppLayout: React.FC = () => {
    const { currentUser, loading, isOnline } = useData();
    const location = useLocation();
    const navigate = useNavigate();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isManualReload, setIsManualReload] = useState(false);
    const pushListenersRef = useRef<PluginListenerHandle[]>([]);
    const [showOfferOfMomentModal, setShowOfferOfMomentModal] = useState(false);
    const pushTokenRef = useRef<string | null>(null);
    const pushRegisteredUserRef = useRef<string | null>(null);

    // Initialize mobile viewport and disable double-tap zoom
    useMobileViewport();
    useDisableDoubleTapZoom();

    useEffect(() => {
        const hash = window.location.hash || '';
        if (hash.startsWith('#/')) {
            const nextPath = hash.slice(1);
            window.history.replaceState(null, '', nextPath);
        }
    }, []);

    useEffect(() => {
        try {
            const navEntry = (performance.getEntriesByType?.('navigation')?.[0] as any) || null;
            const type = navEntry?.type || '';
            setIsManualReload(type === 'reload');
        } catch {
            setIsManualReload(false);
        }
    }, []);

    useEffect(() => {
        const cleanupListeners = () => {
            pushListenersRef.current.forEach(listener => listener.remove());
            pushListenersRef.current = [];
        };

        if (!currentUser) {
            cleanupListeners();
            pushTokenRef.current = null;
            pushRegisteredUserRef.current = null;
            return;
        }

        if (!Capacitor.isNativePlatform()) {
            return;
        }

        const ensureSessionAvailable = async () => {
            const supabase = (await import('./utils/supabaseClient')).supabase;
            const { data } = await supabase.auth.getSession();
            return !!data.session?.access_token;
        };

        const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

        const sendDeviceToken = async (tokenValue: string): Promise<boolean> => {
            if (!tokenValue) return false;

            const endpointBase = import.meta.env.VITE_API_BASE || '';
            if (!endpointBase) {
                console.warn('[push] VITE_API_BASE manquant. Exemple attendu: https://ton-app.vercel.app/api');
                return false;
            }

            const normalizedBase = String(endpointBase).replace(/\/$/, '');
            const apiBase = normalizedBase.endsWith('/api') ? normalizedBase : `${normalizedBase}/api`;

            // IMPORTANT (mobile): endpoint must be ABSOLUTE
            const endpoint = `${apiBase}/device-tokens`;

            // Secure using Supabase session access_token
            const supabase = (await import('./utils/supabaseClient')).supabase;
            const { data } = await supabase.auth.getSession();
            const accessToken = data.session?.access_token || '';
            if (!accessToken) {
                console.warn('[push] Aucun access_token Supabase en session. Token push non envoyé (retry nécessaire).');
                return false;
            }

            const payload = {
                token: tokenValue,
                platform: Capacitor.getPlatform(),
            };

            try {
                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${accessToken}`,
                    },
                    body: JSON.stringify(payload),
                });

                if (!response.ok) {
                    let body = '';
                    try {
                        body = await response.text();
                    } catch { }
                    console.warn('[push] Échec de l\'enregistrement du token push', {
                        endpoint,
                        status: response.status,
                        statusText: response.statusText,
                        body
                    });
                    return false;
                }

                return true;
            } catch (error) {
                console.error('[push] Erreur lors de l\'envoi du token vers le backend', error);
                return false;
            }
        };

        const sendDeviceTokenWithRetry = async (tokenValue: string) => {
            // In some cases (auto-login / session restore), the push registration event can
            // arrive before Supabase session is fully available. We retry a few times.
            const maxAttempts = 5;
            for (let attempt = 1; attempt <= maxAttempts; attempt++) {
                const ok = await sendDeviceToken(tokenValue);
                if (ok) return;

                await sleep(800 * attempt);
            }

            console.warn('[push] Échec final: impossible d\'enregistrer le token push après retry');
        };

        const initPush = async () => {
            try {
                const hasSession = await ensureSessionAvailable();
                if (!hasSession) {
                    console.warn('[push] Session Supabase absente: enregistrement du device token impossible.');
                    return;
                }

                const permission = await PushNotifications.checkPermissions();
                if (permission.receive !== 'granted') {
                    const request = await PushNotifications.requestPermissions();
                    if (request.receive !== 'granted') {
                        console.info('[push] Permission de notifications refusée');
                        return;
                    }
                }

                try {
                    const localPermission = await LocalNotifications.checkPermissions();
                    if ((localPermission as any)?.display !== 'granted') {
                        await LocalNotifications.requestPermissions();
                    }
                } catch (e) {
                    console.warn('[notifications] LocalNotifications permission request failed', e);
                }

                cleanupListeners();

                const registrationListener = await PushNotifications.addListener('registration', async (token) => {
                    if (!token?.value) return;

                    console.info('[push] registration token reçu', {
                        platform: Capacitor.getPlatform(),
                        tokenPreview: `${token.value.slice(0, 12)}...${token.value.slice(-6)}`,
                    });

                    pushTokenRef.current = token.value;
                    pushRegisteredUserRef.current = currentUser.id;
                    await sendDeviceTokenWithRetry(token.value);
                });
                pushListenersRef.current.push(registrationListener);

                const registrationErrorListener = await PushNotifications.addListener('registrationError', (error) => {
                    console.error('[push] Erreur d\'enregistrement des notifications', error);
                });
                pushListenersRef.current.push(registrationErrorListener);

                const receivedListener = await PushNotifications.addListener('pushNotificationReceived', (notification) => {
                    console.info('[push] Notification reçue', notification);
                });
                pushListenersRef.current.push(receivedListener);

                const actionListener = await PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
                    try {
                        const data: any = (notification as any)?.notification?.data || (notification as any)?.notification?.extra || (notification as any)?.data || {};
                        const link = typeof data?.link === 'string' ? String(data.link) : '';
                        if (!link) {
                            console.info('[push] Action sur notification (sans lien)', notification);
                            return;
                        }
                        if (link.startsWith('document:')) {
                            const id = String(link.split(':')[1] || '').trim();
                            if (id) navigate(`/admin/devis/${id}`);
                            return;
                        }
                        if (link.startsWith('mission:')) {
                            const id = String(link.split(':')[1] || '').trim();
                            if (id) navigate(`/admin/planning/missions/${id}`);
                            return;
                        }
                        if (link === 'tab:planning') {
                            navigate('/planning');
                            return;
                        }
                        if (typeof link === 'string' && link.startsWith('/')) {
                            navigate(link);
                            return;
                        }
                        console.info('[push] Action sur notification (lien non supporté)', { link });
                    } catch (e) {
                        console.warn('[push] Action sur notification (parse failed)', e);
                    }
                });
                pushListenersRef.current.push(actionListener);

                const localActionListener = await LocalNotifications.addListener('localNotificationActionPerformed', (event: any) => {
                    try {
                        const data: any = event?.notification?.extra || event?.notification?.data || event?.extra || {};
                        const link = typeof data?.link === 'string' ? String(data.link) : '';
                        if (!link) return;
                        if (link.startsWith('document:')) {
                            const id = String(link.split(':')[1] || '').trim();
                            if (id) navigate(`/admin/devis/${id}`);
                            return;
                        }
                        if (link.startsWith('mission:')) {
                            const id = String(link.split(':')[1] || '').trim();
                            if (id) navigate(`/admin/planning/missions/${id}`);
                            return;
                        }
                        if (link === 'tab:planning') {
                            navigate('/planning');
                            return;
                        }
                        if (typeof link === 'string' && link.startsWith('/')) {
                            navigate(link);
                            return;
                        }
                    } catch (e) {
                        console.warn('[local] Action sur notification (parse failed)', e);
                    }
                });
                pushListenersRef.current.push(localActionListener);

                // Create default Android channel (required when using default_notification_channel_id)
                if (Capacitor.getPlatform() === 'android') {
                    try {
                        await PushNotifications.createChannel({
                            id: 'presta_default_channel',
                            name: 'Notifications',
                            description: 'Notifications Presta Services Antilles',
                            importance: 5,
                            visibility: 1,
                            sound: 'default',
                            lights: true,
                            vibration: true,
                        });
                    } catch (e) {
                        console.warn('[push] createChannel failed (may already exist)', e);
                    }
                }

                await PushNotifications.register();

                if (pushTokenRef.current) {
                    await sendDeviceTokenWithRetry(pushTokenRef.current);
                }
            } catch (error) {
                console.error('[push] Erreur lors de l\'initialisation des notifications push', error);
            }
        };

        initPush();

        return () => {
            cleanupListeners();
        };
    }, [currentUser]);

    const isContactRoute = location.pathname === '/contact' || (window.location.hash || '').startsWith('#/contact');
    const isFlyersRoute = location.pathname === '/flyers' || location.pathname.startsWith('/flyers/');
    const isReferralRoute = location.pathname.startsWith('/parrainage');

    const isAdminLike = currentUser?.role === 'admin' || currentUser?.role === 'super_admin';

    const [isOfferModalOpen, setIsOfferModalOpen] = useState(false);
    const offerModalKey = 'mkt_offer_of_moment_last_closed_day';

    useEffect(() => {
        try {
            if (isContactRoute || isFlyersRoute) return;
            if (isAdminLike) return;

            const today = new Date();
            const utcDay = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, '0')}-${String(today.getUTCDate()).padStart(2, '0')}`;
            const lastClosed = localStorage.getItem(offerModalKey) || '';
            if (lastClosed === utcDay) return;

            const t = setTimeout(() => setIsOfferModalOpen(true), 450);
            return () => clearTimeout(t);
        } catch {
            // ignore
        }
    }, [isContactRoute, isFlyersRoute, isAdminLike]);

    const closeOfferModal = () => {
        try {
            const today = new Date();
            const utcDay = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, '0')}-${String(today.getUTCDate()).padStart(2, '0')}`;
            localStorage.setItem(offerModalKey, utcDay);
        } catch {
            // ignore
        }
        setIsOfferModalOpen(false);
    };

    if (isContactRoute) {
        return <ContactPage />;
    }

    if (isFlyersRoute) {
        return <FlyersPublicRoutes />;
    }

    if (isReferralRoute) {
        return <ReferralPublicRoutes />;
    }

    if (!isOnline) {
        return <OfflineScreen />;
    }

    if (loading) {
        return <LoadingScreen mode={isManualReload ? 'sync' : 'app'} />;
    }

    const offerModal = isAdminLike ? null : (
        <OfferOfMomentModal
            open={isOfferModalOpen}
            onClose={closeOfferModal}
            title="Offre du moment"
        />
    );

    if (!currentUser) {
        return (
            <>
                {offerModal}
                <Login />
            </>
        );
    }

    // IMPORTANT: permettre le scan via URL (QR Code) même pour les prestataires.
    // Sans cela, ProviderPortal masque la route /scan et le scan ne s'exécute jamais.
    if (currentUser.role === 'provider' && (location.pathname === '/scan' || location.pathname === '/scan-success')) {
        return (
            <div className="h-screen flex flex-col overflow-hidden">
                <OfflineBanner />
                <ToastContainer />
                {location.pathname === '/scan' ? <ScanPage /> : <ScanSuccess />}
            </div>
        );
    }

    // IMPORTANT: permettre le scan via URL (QR Code) même pour les clients.
    // Sinon, ClientPortal masque la route /scan et l'utilisateur reste bloqué.
    if (currentUser.role === 'client' && (location.pathname === '/scan' || location.pathname === '/scan-success' || location.pathname === '/nouvelle-demande')) {
        return (
            <div className="h-screen flex flex-col overflow-hidden">
                <OfflineBanner />
                <ToastContainer />
                {location.pathname === '/scan' ? <ScanPage /> : location.pathname === '/scan-success' ? <ScanSuccess /> : <NewServiceRequestPage />}
            </div>
        );
    }

    if (currentUser.role === 'client') {
        return (
            <div className="h-screen flex flex-col overflow-hidden">
                <OfflineBanner />
                <ToastContainer />
                <ClientPortal />
                {offerModal}
            </div>
        );
    }

    if (currentUser.role === 'provider') {
        return (
            <div className="h-screen flex flex-col overflow-hidden">
                <OfflineBanner />
                <ToastContainer />
                <ProviderPortal />
                {offerModal}
            </div>
        );
    }

    // Admin and Super Admin Layout (both use same admin interface)
    return (
        <div className="flex h-screen bg-cream-50 font-sans overflow-hidden">
            <ToastContainer />
            <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

            {/* Main Content Wrapper */}
            <div className="flex-1 flex flex-col h-full relative overflow-hidden transition-all duration-300">

                {/* Offline Banner */}
                <OfflineBanner />

                {/* Header at the top */}
                <Header onMenuClick={() => setIsSidebarOpen(true)} />

                {/* Content Area */}
                <main className="flex-1 overflow-hidden relative bg-cream-50/50">
                    {/* Decorative background elements inside the scrollable area's container */}
                    <div className="absolute top-0 right-0 w-64 h-64 bg-brand-orange/5 rounded-full blur-3xl -z-10 transform translate-x-1/2 -translate-y-1/2 pointer-events-none"></div>
                    <div className="absolute bottom-0 left-0 w-96 h-96 bg-brand-blue/5 rounded-full blur-3xl -z-10 transform -translate-x-1/2 translate-y-1/2 pointer-events-none"></div>

                    <Routes>
                        <Route path="/" element={<Dashboard />} />
                        <Route path="/qrcode" element={<QRCodeManager />} />
                        <Route path="/admin/devis/:devisId" element={<AdminDevisDetails />} />
                        <Route path="/admin/planning/missions/:missionId" element={<AdminMissionDetails />} />
                        <Route path="/admin/notifications/:notificationId" element={<AdminNotificationDetails />} />
                        <Route path="/parrainage/devenir-parrain-client" element={<BecomeReferrerClientPage />} />
                        <Route path="/statistics" element={<Statistics />} />
                        <Route path="/clients" element={<Clients />} />
                        <Route path="/clients/:id" element={<ClientDetailPage />} />
                        <Route path="/providers" element={<Providers />} />
                        <Route path="/providers/:id" element={<ProviderDetailPage />} />
                        <Route path="/invoices" element={<DevisFactures />} />
                        <Route path="/invoices/:id" element={<DocumentDetailPage />} />
                        <Route path="/planning" element={<Planning />} />
                        <Route path="/planning/missions/:id" element={<MissionDetailPage />} />
                        <Route path="/financials" element={<Financials />} />
                        <Route path="/reservations" element={<Reservations />} />
                        <Route path="/secretariat" element={<Secretariat />} />
                        <Route path="/contact-forms" element={<ContactFormsAdmin />} />
                        <Route path="/demo-accounts" element={<DemoAccounts />} />
                        <Route path="/admin/flyers" element={<AdminFlyersPage />} />
                        <Route path="/admin/flyer-requests" element={<AdminCustomerRequestsPage />} />
                        <Route path="/admin/filleuls" element={<AdminReferralLeadsPage />} />
                        <Route path="/admin/referrals" element={<AdminReferralsPage />} />
                        <Route path="/admin/referrals/deleted" element={<AdminDeletedReferralsPage />} />
                        <Route path="/admin/rewards" element={<AdminRewardsPointsPage />} />
                        <Route path="/admin/referrers-performance" element={<AdminReferrersPerformancePage />} />
                        <Route path="/admin/referrers-performance/:referrerId" element={<AdminReferrerPerformanceDetailsPage />} />
                        <Route path="/admin/service-requests" element={<AdminServiceRequestsPage />} />
                        <Route path="/admin/service-requests/:requestId" element={<AdminServiceRequestDetailPage />} />
                        <Route path="/admin/email-marketing" element={<AdminEmailMarketing />} />
                        <Route path="/provider-availability" element={<ProviderAvailabilityPage />} />
                        <Route path="/nouvelle-demande" element={<NewServiceRequestPage />} />
                        <Route path="/accounting" element={<AccountingStatistics />} />
                        <Route path="/settings" element={<Settings />} />
                        <Route path="/reports" element={<MissionReports />} />
                        <Route path="/scan" element={<ScanPage />} />
                        <Route path="/scan-success" element={<ScanSuccess />} />
                        <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                </main>
            </div>
            {offerModal}
        </div>
    );
}

const App: React.FC = () => {
    return (
        <ErrorBoundary>
            <QueryClientProvider client={queryClient}>
                <DataProvider>
                    <DataPrefetcher>
                        <BrowserRouter>
                            <ToastContainer />
                            <AppLayout />
                        </BrowserRouter>
                    </DataPrefetcher>
                </DataProvider>
                {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
            </QueryClientProvider>
        </ErrorBoundary>
    );
};

export default App;
