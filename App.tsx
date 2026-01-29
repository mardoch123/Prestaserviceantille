import React, { useEffect, useRef, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { DataProvider, useData } from './context/DataContext';
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
import ClientPortal from './components/ClientPortal';
import ProviderPortal from './components/ProviderPortal';
import MissionReports from './components/MissionReports';
import Login from './components/Login';
import ScanPage from './components/ScanPage';
import ScanSuccess from './components/ScanSuccess';
import ContactPage from './components/ContactPage';
import ContactFormsAdmin from './components/ContactFormsAdmin';
import { WifiOff, RotateCw, Loader2, AlertTriangle, RefreshCw } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import type { PluginListenerHandle } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';

// Error Boundary to catch DataProvider context issues
class ErrorBoundary extends React.Component<
    { children: React.ReactNode },
    { hasError: boolean; error: Error | null }
> {
    constructor(props: { children: React.ReactNode }) {
        super(props);
        this.state = { hasError: false, error: null };
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

    useEffect(() => {
        const delay = mode === 'sync' ? 45000 : 4000;
        const timer = setTimeout(() => setShowBypass(true), delay);
        return () => clearTimeout(timer);
    }, [mode]);

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-cream-50 text-slate-600 p-8 text-center">
            <Loader2 className="w-12 h-12 text-brand-blue animate-spin mb-4" />
            <p className="font-bold text-lg animate-pulse">{mode === 'sync' ? 'Synchronisation en cours...' : "Chargement de l'application..."}</p>
            <p className="text-xs text-slate-400 mt-2">{mode === 'sync' ? "Récupération des données et mise à jour de l'affichage." : 'Initialisation des modules et connexion sécurisée.'}</p>

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
    );
}

const AppLayout: React.FC = () => {
    const { currentUser, loading, isOnline } = useData();
    const location = useLocation();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isManualReload, setIsManualReload] = useState(false);
    const pushListenersRef = useRef<PluginListenerHandle[]>([]);
    const pushTokenRef = useRef<string | null>(null);
    const pushRegisteredUserRef = useRef<string | null>(null);

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

        const sendDeviceToken = async (tokenValue: string) => {
            if (!tokenValue) return;

            const endpointBase = import.meta.env.VITE_API_BASE || '';
            if (!endpointBase) {
                console.warn('[push] VITE_API_BASE manquant. Exemple attendu: https://ton-app.vercel.app/api');
                return;
            }

            // IMPORTANT (mobile): endpoint must be ABSOLUTE
            const endpoint = `${String(endpointBase).replace(/\/$/, '')}/device-tokens`;

            // Secure using Supabase session access_token
            const { data } = await (await import('./utils/supabaseClient')).supabase.auth.getSession();
            const accessToken = data.session?.access_token || '';
            if (!accessToken) {
                console.warn('[push] Aucun access_token Supabase en session. Token push non envoyé.');
                return;
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
                    console.warn('[push] Échec de l\'enregistrement du token push', response.status, response.statusText);
                }
            } catch (error) {
                console.error('[push] Erreur lors de l\'envoi du token vers le backend', error);
            }
        };

        const initPush = async () => {
            try {
                const permission = await PushNotifications.checkPermissions();
                if (permission.receive !== 'granted') {
                    const request = await PushNotifications.requestPermissions();
                    if (request.receive !== 'granted') {
                        console.info('[push] Permission de notifications refusée');
                        return;
                    }
                }

                cleanupListeners();

                const registrationListener = await PushNotifications.addListener('registration', async (token) => {
                    if (!token?.value) return;

                    if (
                        pushTokenRef.current === token.value &&
                        pushRegisteredUserRef.current === currentUser.id
                    ) {
                        return;
                    }

                    pushTokenRef.current = token.value;
                    pushRegisteredUserRef.current = currentUser.id;
                    await sendDeviceToken(token.value);
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
                    console.info('[push] Action sur notification', notification);
                });
                pushListenersRef.current.push(actionListener);

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
            } catch (error) {
                console.error('[push] Erreur lors de l\'initialisation des notifications push', error);
            }
        };

        initPush();

        return () => {
            cleanupListeners();
        };
    }, [currentUser]);

    if (!isOnline) {
        return <OfflineScreen />;
    }

    if (location.pathname === '/contact') {
        return <ContactPage />;
    }

    if (loading) {
        return <LoadingScreen mode={isManualReload ? 'sync' : 'app'} />;
    }

    if (!currentUser) {
        return <Login />;
    }

    // IMPORTANT: permettre le scan via URL (QR Code) même pour les prestataires.
    // Sans cela, ProviderPortal masque la route /scan et le scan ne s'exécute jamais.
    if (currentUser.role === 'provider' && (location.pathname === '/scan' || location.pathname === '/scan-success')) {
        return (
            <div className="h-screen flex flex-col overflow-hidden">
                <OfflineBanner />
                {location.pathname === '/scan' ? <ScanPage /> : <ScanSuccess />}
            </div>
        );
    }

    // IMPORTANT: permettre le scan via URL (QR Code) même pour les clients.
    // Sinon, ClientPortal masque la route /scan et l'utilisateur reste bloqué.
    if (currentUser.role === 'client' && (location.pathname === '/scan' || location.pathname === '/scan-success')) {
        return (
            <div className="h-screen flex flex-col overflow-hidden">
                <OfflineBanner />
                {location.pathname === '/scan' ? <ScanPage /> : <ScanSuccess />}
            </div>
        );
    }

    if (currentUser.role === 'client') {
        return (
            <div className="h-screen flex flex-col overflow-hidden">
                <OfflineBanner />
                <ClientPortal />
            </div>
        );
    }

    if (currentUser.role === 'provider') {
        return (
            <div className="h-screen flex flex-col overflow-hidden">
                <OfflineBanner />
                <ProviderPortal />
            </div>
        );
    }

    // Admin and Super Admin Layout (both use same admin interface)
    return (
        <div className="flex h-screen bg-cream-50 font-sans overflow-hidden">
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
                        <Route path="/statistics" element={<Statistics />} />
                        <Route path="/clients" element={<Clients />} />
                        <Route path="/providers" element={<Providers />} />
                        <Route path="/invoices" element={<DevisFactures />} />
                        <Route path="/planning" element={<Planning />} />
                        <Route path="/financials" element={<Financials />} />
                        <Route path="/reservations" element={<Reservations />} />
                        <Route path="/secretariat" element={<Secretariat />} />
                        <Route path="/contact-forms" element={<ContactFormsAdmin />} />
                        <Route path="/settings" element={<Settings />} />
                        <Route path="/reports" element={<MissionReports />} />
                        <Route path="/scan" element={<ScanPage />} />
                        <Route path="/scan-success" element={<ScanSuccess />} />
                        <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                </main>
            </div>
        </div>
    );
}

const App: React.FC = () => {
    return (
        <ErrorBoundary>
            <DataProvider>
                <BrowserRouter>
                    <AppLayout />
                </BrowserRouter>
            </DataProvider>
        </ErrorBoundary>
    );
};

export default App;
