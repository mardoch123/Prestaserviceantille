
import React from 'react';
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
import ClientPortal from './components/ClientPortal';
import ProviderPortal from './components/ProviderPortal';
import Login from './components/Login';
import { WifiOff, RotateCw } from 'lucide-react';

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

const AppLayout: React.FC = () => {
    const { currentUser } = useData();

    if (!currentUser) {
        return <Login />;
    }

    if (currentUser.role === 'client') {
        return (
            <div className="h-screen flex flex-col">
                <OfflineBanner />
                <ClientPortal />
            </div>
        );
    }

    if (currentUser.role === 'provider') {
        return (
             <div className="h-screen flex flex-col">
                <OfflineBanner />
                <ProviderPortal />
            </div>
        );
    }

    // Admin Layout
    return (
        <div className="flex h-screen bg-cream-50 font-sans overflow-hidden">
            <Sidebar />
            
            {/* Main Content Wrapper */}
            <div className="flex-1 flex flex-col h-full relative overflow-hidden">
              
              {/* Offline Banner */}
              <OfflineBanner />

              {/* Header at the top */}
              <Header />

              {/* Content Area */}
              <main className="flex-1 overflow-hidden relative bg-cream-50/50">
                  {/* Decorative background elements inside the scrollable area's container */}
                  <div className="absolute top-0 right-0 w-64 h-64 bg-brand-orange/5 rounded-full blur-3xl -z-10 transform translate-x-1/2 -translate-y-1/2 pointer-events-none"></div>
                  <div className="absolute bottom-0 left-0 w-96 h-96 bg-brand-blue/5 rounded-full blur-3xl -z-10 transform -translate-x-1/2 translate-y-1/2 pointer-events-none"></div>
                  
                  <Routes>
                      <Route path="/" element={<Dashboard />} />
                      <Route path="/statistics" element={<Statistics />} />
                      <Route path="/clients" element={<Clients />} />
                      <Route path="/providers" element={<Providers />} />
                      <Route path="/invoices" element={<DevisFactures />} />
                      <Route path="/planning" element={<Planning />} />
                      <Route path="/financials" element={<Financials />} />
                      <Route path="/reservations" element={<Reservations />} />
                      <Route path="/secretariat" element={<Secretariat />} />
                      <Route path="/settings" element={<Settings />} />
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
