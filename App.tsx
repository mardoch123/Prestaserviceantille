
import React, { useEffect, useState } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
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
import { WifiOff, RotateCw, Loader2, AlertTriangle, RefreshCw } from 'lucide-react';

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

const LoadingScreen = () => {
    const [showBypass, setShowBypass] = useState(false);

    useEffect(() => {
        // If loading takes more than 4 seconds, show the bypass option
        const timer = setTimeout(() => setShowBypass(true), 4000);
        return () => clearTimeout(timer);
    }, []);

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-cream-50 text-slate-600 p-8 text-center">
            <Loader2 className="w-12 h-12 text-brand-blue animate-spin mb-4" />
            <p className="font-bold text-lg animate-pulse">Chargement de l'application...</p>
            <p className="text-xs text-slate-400 mt-2">Initialisation des modules et connexion sécurisée.</p>

            {showBypass && (
                <div className="mt-8 animate-in fade-in slide-in-from-bottom-4">
                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 max-w-sm">
                        <p className="text-sm text-orange-800 font-bold flex items-center justify-center gap-2 mb-2">
                            <AlertTriangle className="w-4 h-4" /> Le chargement semble long...
                        </p>
                        <p className="text-xs text-orange-600 mb-4">
                            Cela peut arriver si la connexion est lente ou si la base de données est en veille.
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
    const { currentUser, loading } = useData();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    if (loading) {
        return <LoadingScreen />;
    }

    if (!currentUser) {
        return <Login />;
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
                        <Route path="/settings" element={<Settings />} />
                        <Route path="/reports" element={<MissionReports />} />
                        <Route path="/scan" element={<ScanPage />} />
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
                <HashRouter>
                    <AppLayout />
                </HashRouter>
            </DataProvider>
        </ErrorBoundary>
    );
};

export default App;
