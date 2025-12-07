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
import { WifiOff, RotateCw, Loader2, AlertTriangle, RefreshCw, LogOut } from 'lucide-react';

// OfflineBanner removed

const LoadingScreen = () => {
    const [showReset, setShowReset] = useState(false);

    useEffect(() => {
        // Show reset option quickly (2s) to prevent being stuck
        const timer = setTimeout(() => setShowReset(true), 2000);
        return () => clearTimeout(timer);
    }, []);

    const handleReset = () => {
        localStorage.clear();
        window.location.reload();
    };

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-cream-50 text-slate-600 p-8 text-center">
            <Loader2 className="w-12 h-12 text-brand-blue animate-spin mb-4" />
            <p className="font-bold text-lg animate-pulse">Chargement de l'application...</p>
            <p className="text-xs text-slate-400 mt-2">Initialisation des modules...</p>

            {showReset && (
                <div className="mt-8 animate-in fade-in slide-in-from-bottom-4">
                    <button
                        onClick={handleReset}
                        className="bg-white border border-red-200 text-red-600 px-6 py-3 rounded-lg text-sm font-bold hover:bg-red-50 flex items-center gap-2 mx-auto shadow-sm transition"
                    >
                        <LogOut className="w-4 h-4" /> Problème de connexion ? Se reconnecter
                    </button>
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
                <ClientPortal />
            </div>
        );
    }

    if (currentUser.role === 'provider') {
        return (
            <div className="h-screen flex flex-col overflow-hidden">
                <ProviderPortal />
            </div>
        );
    }

    // Admin Layout
    return (
        <div className="flex h-screen bg-cream-50 font-sans overflow-hidden">
            <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

            {/* Main Content Wrapper */}
            <div className="flex-1 flex flex-col h-full relative overflow-hidden transition-all duration-300">

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
                        <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                </main>
            </div>
        </div>
    );
}

const App: React.FC = () => {
    return (
        <DataProvider>
            <HashRouter>
                <AppLayout />
            </HashRouter>
        </DataProvider>
    );
};

export default App;