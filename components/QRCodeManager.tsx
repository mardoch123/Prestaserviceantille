import React, { useState, useMemo } from 'react';
import { useData } from '../context/DataContext';
import {
    QrCode,
    Printer,
    History,
    Search,
    MapPin,
    Clock,
    UserCheck,
    ScanLine,
    ArrowRight
} from 'lucide-react';

const QRCodeManager: React.FC = () => {
    const { clients, visitScans, registerScan, currentUser, simulatedClientId } = useData();
    const [activeTab, setActiveTab] = useState<'generate' | 'scan' | 'history'>('generate');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedClientForScan, setSelectedClientForScan] = useState<string>('');
    const [scanResult, setScanResult] = useState<{ type?: string, message: string } | null>(null);
    const [scanFilters, setScanFilters] = useState({
        startDate: '',
        endDate: '',
        clientId: '',
        scannerId: '', // Ajout du filtre par prestataire
        type: ''
    });

    // Determine if current user can access QR codes
    const canAccessQRCodes = currentUser?.role === 'admin' || 
                            (currentUser?.role === 'client' && simulatedClientId);

    // Filter clients based on user role
    const accessibleClients = useMemo(() => {
        if (currentUser?.role === 'client' && simulatedClientId) {
            // Client can only see their own QR code
            const ownClient = clients.find(c => c.id === simulatedClientId);
            return ownClient ? [ownClient] : [];
        }
        return clients; // Admin can see all clients
    }, [clients, currentUser?.role, simulatedClientId]);

    // --- Generate Logic ---
    const filteredClients = useMemo(() => {
        if (!searchQuery) return accessibleClients;
        return accessibleClients.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()));
    }, [accessibleClients, searchQuery]);

    const handlePrint = (clientId: string) => {
        const client = clients.find(c => c.id === clientId);
        if (!client) return;

        const baseUrl = window.location.origin;
        const qrData = `${baseUrl}/#/scan?client=${clientId}`;
        const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrData)}`;

        const printWindow = window.open('', '', 'width=600,height=800');
        if (printWindow) {
            printWindow.document.write(`
                <html>
                <head>
                    <title>QR Code - ${client.name}</title>
                    <style>
                        body { font-family: 'Arial', sans-serif; text-align: center; padding: 40px; }
                        .card { border: 2px solid #333; padding: 40px; border-radius: 20px; display: inline-block; max-width: 400px; }
                        .logo { font-size: 24px; font-weight: bold; color: #2A9D8F; margin-bottom: 10px; }
                        .title { font-size: 18px; font-weight: bold; margin-bottom: 20px; text-transform: uppercase; }
                        .client { font-size: 16px; margin-bottom: 30px; font-style: italic; }
                        .qr { width: 250px; height: 250px; margin-bottom: 30px; }
                        .instructions { font-size: 12px; color: #666; line-height: 1.5; }
                        @media print {
                            body { margin: 0; padding: 0; display: flex; justify-content: center; align-items: center; height: 100vh; }
                            .no-print { display: none; }
                        }
                    </style>
                </head>
                <body>
                    <div class="card">
                        <div class="logo">PRESTA SERVICES ANTILLES</div>
                        <div class="title">Pointage Prestataire</div>
                        <div class="client">Client : ${client.name}</div>
                        <img src="${qrApiUrl}" class="qr" alt="QR Code" />
                        <div class="instructions">
                            1. Ouvrez l'application Presta Services<br/>
                            2. Scannez ce code à votre arrivée (Entrée)<br/>
                            3. Scannez ce code à votre départ (Sortie)<br/>
                            4. Le pointage sera automatiquement enregistré
                        </div>
                    </div>
                    <br/><br/>
                    <button class="no-print" onclick="window.print()">Imprimer</button>
                </body>
                </html>
            `);
            printWindow.document.close();
        }
    };

    // --- Scan Logic ---
    const handleSimulateScan = async () => {
        if (!selectedClientForScan) return;

        setScanResult(null);
        
        // Jouer un son de scan (simulation)
        try {
            const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUazi5L2d');
            audio.volume = 0.3;
            await audio.play();
        } catch (e) {
            // Ignorer les erreurs audio
        }

        // Animation de scan
        await new Promise(r => setTimeout(r, 1200));

        const result = await registerScan(selectedClientForScan);
        
        // Ajouter une notification visuelle permanente
        if (result.success) {
            // Jouer un son de succès
            try {
                const successAudio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUazi5L2d');
                successAudio.volume = 0.5;
                await successAudio.play();
            } catch (e) {
                // Ignorer les erreurs audio
            }
        }

        setScanResult({
            type: result.success ? 'success' : 'error',
            message: result.message
        });

        // Effacer le résultat après 5 secondes pour un nouveau scan
        if (result.success) {
            setTimeout(() => {
                setScanResult(null);
                setSelectedClientForScan('');
            }, 5000);
        }
    };

    // --- History Logic ---
    const scansHistory = useMemo(() => {
        let filtered = visitScans;

        // Filter by client if user is client
        if (currentUser?.role === 'client' && simulatedClientId) {
            filtered = filtered.filter(s => s.clientId === simulatedClientId);
        }

        // Apply admin filters
        if (currentUser?.role === 'admin') {
            // Filter by selected client
            if (scanFilters.clientId) {
                filtered = filtered.filter(s => s.clientId === scanFilters.clientId);
            }
            
            // Filter by selected prestataire (scanner)
            if (scanFilters.scannerId) {
                filtered = filtered.filter(s => s.scannerId === scanFilters.scannerId);
            }
            
            // Filter by scan type
            if (scanFilters.type) {
                filtered = filtered.filter(s => s.scanType === scanFilters.type);
            }
        }

        // Apply date filters
        if (scanFilters.startDate) {
            filtered = filtered.filter(s => new Date(s.timestamp) >= new Date(scanFilters.startDate));
        }
        if (scanFilters.endDate) {
            const end = new Date(scanFilters.endDate);
            end.setHours(23, 59, 59, 999);
            filtered = filtered.filter(s => new Date(s.timestamp) <= end);
        }

        return filtered
            .map((scan: any) => {
                const client = clients.find((c: any) => c.id === scan.clientId);
                return {
                    ...scan,
                    clientName: client ? client.name : 'Client Inconnu',
                    scannerName: currentUser?.name || 'Système'
                };
            })
            .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }, [visitScans, clients, scanFilters, currentUser, simulatedClientId]);

    return (
        <div className="p-8 h-full overflow-y-auto bg-white/40">
            <div className="mb-8">
                <h2 className="text-3xl font-serif font-bold text-slate-800">Gestion des QR Codes</h2>
                <p className="text-sm text-slate-500">
                    {currentUser?.role === 'client' 
                        ? 'Votre QR Code personnel et historique de pointage' 
                        : 'Génération de codes clients et suivi des pointages'
                    }
                </p>
            </div>

            {!canAccessQRCodes && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                    <p className="text-yellow-800 text-sm">
                        Vous n'avez pas les permissions nécessaires pour accéder aux QR Codes.
                    </p>
                </div>
            )}

            {canAccessQRCodes && (
                <>
                    {/* Tab Navigation */}
                    <div className="flex gap-2 mb-8 bg-slate-100 p-1 rounded-lg">
                        <button
                            onClick={() => setActiveTab('generate')}
                            className={`px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 transition-all ${activeTab === 'generate' ? 'bg-white text-brand-blue shadow-sm' : 'text-slate-500'}`}
                        >
                            <QrCode className="w-4 h-4" /> {currentUser?.role === 'client' ? 'Mon QR Code' : 'Générateur'}
                        </button>
                        {(currentUser?.role === 'admin' || (currentUser?.role === 'client' && simulatedClientId)) && (
                            <button
                                onClick={() => setActiveTab('history')}
                                className={`px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 transition-all ${activeTab === 'history' ? 'bg-white text-brand-blue shadow-sm' : 'text-slate-500'}`}
                            >
                                <History className="w-4 h-4" /> Historique
                            </button>
                        )}
                        {currentUser?.role === 'admin' && (
                            <button
                                onClick={() => setActiveTab('scan')}
                                className={`px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 transition-all ${activeTab === 'scan' ? 'bg-white text-brand-blue shadow-sm' : 'text-slate-500'}`}
                            >
                                <ScanLine className="w-4 h-4" /> Scanner
                            </button>
                        )}
                    </div>

                    {activeTab === 'generate' && (
                        <div>
                            {currentUser?.role === 'admin' && (
                                <div className="relative mb-6">
                                    <input
                                        type="text"
                                        placeholder="Rechercher un client..."
                                        className="pl-10 pr-4 py-2 border rounded-lg text-sm outline-none focus:border-brand-blue w-full"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                    />
                                    <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                                </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {filteredClients.map(client => (
                                    <div key={client.id} className="border border-slate-200 rounded-xl p-4 flex items-center justify-between hover:shadow-md transition">
                                        <div>
                                            <p className="font-bold text-slate-800">{client.name}</p>
                                            <p className="text-xs text-slate-500 flex items-center gap-1"><MapPin className="w-3 h-3" /> {client.city}</p>
                                        </div>
                                        <button
                                            onClick={() => handlePrint(client.id)}
                                            className="bg-slate-100 p-2 rounded-full hover:bg-brand-blue hover:text-white transition text-slate-600"
                                            title="Imprimer QR Code"
                                        >
                                            <Printer className="w-5 h-5" />
                                        </button>
                                    </div>
                                ))}
                                {filteredClients.length === 0 && (
                                    <p className="col-span-full text-center text-slate-400 py-8">Aucun client trouvé.</p>
                                )}
                            </div>
                        </div>
                    )}

                    {/* --- HISTORY TAB --- */}
                    {activeTab === 'history' && (
                        <div className="space-y-6">
                            {/* Filters */}
                            {currentUser?.role === 'admin' && (
                                <div className="flex gap-4 items-center bg-white p-4 rounded-lg shadow-sm flex-wrap">
                                    <select
                                        value={scanFilters.clientId}
                                        onChange={(e) => setScanFilters(prev => ({ ...prev, clientId: e.target.value }))}
                                        className="px-3 py-2 border border-slate-200 rounded-lg text-sm"
                                    >
                                        <option value="">Tous les clients</option>
                                        {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                    <select
                                        value={scanFilters.scannerId}
                                        onChange={(e) => setScanFilters(prev => ({ ...prev, scannerId: e.target.value }))}
                                        className="px-3 py-2 border border-slate-200 rounded-lg text-sm"
                                    >
                                        <option value="">Tous les prestataires</option>
                                        {Array.from(new Set(visitScans.map(s => s.scannerId))).map(scannerId => {
                                            const scan = visitScans.find(s => s.scannerId === scannerId);
                                            return (
                                                <option key={scannerId} value={scannerId}>
                                                    {scan?.scannerName || `Prestataire ${scannerId}`}
                                                </option>
                                            );
                                        })}
                                    </select>
                                    <select
                                        value={scanFilters.type}
                                        onChange={(e) => setScanFilters(prev => ({ ...prev, type: e.target.value as any }))}
                                        className="px-3 py-2 border border-slate-200 rounded-lg text-sm"
                                    >
                                        <option value="">Tous les types</option>
                                        <option value="entry">Entrées</option>
                                        <option value="exit">Sorties</option>
                                    </select>
                                </div>
                            )}

                            {/* Date filters for all users */}
                            <div className="flex gap-4 items-center bg-white p-4 rounded-lg shadow-sm">
                                <div className="flex items-center gap-2">
                                    <Clock className="w-4 h-4 text-slate-400" />
                                    <input 
                                        type="date" 
                                        className="border rounded px-2 py-1 bg-slate-50" 
                                        value={scanFilters.startDate} 
                                        onChange={e => setScanFilters({ ...scanFilters, startDate: e.target.value })} 
                                        title="Date Début" 
                                    />
                                    <span className="text-slate-300">-</span>
                                    <input 
                                        type="date" 
                                        className="border rounded px-2 py-1 bg-slate-50" 
                                        value={scanFilters.endDate} 
                                        onChange={e => setScanFilters({ ...scanFilters, endDate: e.target.value })} 
                                        title="Date Fin" 
                                    />
                                </div>
                                {(scanFilters.startDate || scanFilters.endDate || scanFilters.clientId || scanFilters.scannerId || scanFilters.type) && (
                                    <button 
                                        onClick={() => setScanFilters({ startDate: '', endDate: '', clientId: '', scannerId: '', type: '' })} 
                                        className="ml-auto text-red-500 text-xs hover:underline"
                                    >
                                        Effacer filtres
                                    </button>
                                )}
                            </div>

                            {/* Scans List */}
                            <div className="space-y-2">
                                {scansHistory.length === 0 ? (
                                    <div className="bg-white p-8 rounded-lg text-center text-slate-400">
                                        <History className="w-12 h-12 mx-auto mb-4 opacity-50" />
                                        <p>Aucun pointage trouvé</p>
                                    </div>
                                ) : (
                                    scansHistory.map(scan => (
                                        <div key={scan.id} className="bg-white p-4 rounded-lg shadow-sm flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                                                    scan.scanType === 'entry' ? 'bg-green-100' : 'bg-red-100'
                                                }`}>
                                                    {scan.scanType === 'entry' ? 
                                                        <ArrowRight className="w-5 h-5 text-green-600" /> :
                                                        <ArrowRight className="w-5 h-5 text-red-600 rotate-180" />
                                                    }
                                                </div>
                                                <div>
                                                    <p className="font-semibold text-slate-800">{scan.clientName}</p>
                                                    <p className="text-xs text-slate-500">
                                                        {new Date(scan.timestamp).toLocaleString('fr-FR')}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <span className={`text-xs font-bold px-2 py-1 rounded ${
                                                    scan.scanType === 'entry' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                                }`}>
                                                    {scan.scanType === 'entry' ? 'Entrée' : 'Sortie'}
                                                </span>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}

                    {/* --- SCANNER TAB --- */}
                    {activeTab === 'scan' && currentUser?.role === 'admin' && (
                        <div className="flex flex-col items-center justify-center h-[500px] bg-slate-900 rounded-xl shadow-inner relative overflow-hidden animate-in fade-in">
                            <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>

                            <div className="bg-white p-8 rounded-2xl shadow-2xl max-w-md w-full text-center z-10">
                                <div className="w-16 h-16 bg-brand-blue/10 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <ScanLine className="w-8 h-8 text-brand-blue animate-pulse" />
                                </div>
                                <h3 className="text-2xl font-bold text-slate-800 mb-2">Scanner QR Code</h3>
                                <p className="text-slate-500 text-sm mb-6">
                                    Simulez le scan d'un code client avec votre compte actuel ({currentUser?.name || 'Inconnu'}).
                                </p>

                                <select
                                    value={selectedClientForScan}
                                    onChange={(e) => setSelectedClientForScan(e.target.value)}
                                    className="w-full p-3 border border-slate-200 rounded-lg mb-4 text-sm"
                                >
                                    <option value="">-- Choisir un QR Code (Client) --</option>
                                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>

                                <button
                                    onClick={handleSimulateScan}
                                    disabled={!selectedClientForScan}
                                    className="w-full bg-brand-blue text-white py-3 rounded-lg font-bold hover:bg-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Simuler Scan
                                </button>

                                {scanResult && (
                                    <div className={`mt-6 p-4 rounded-xl text-sm font-medium animate-in fade-in zoom-in duration-300 flex items-center gap-3 ${
                                        scanResult.type === 'success' ? 'bg-green-50 border-2 border-green-200 text-green-800' :
                                        'bg-red-50 border-2 border-red-200 text-red-800'
                                    }`}>
                                        {scanResult.type === 'success' ? (
                                            <>
                                                <div className="flex-shrink-0 w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                                                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                    </svg>
                                                </div>
                                                <div className="flex-1">
                                                    <p className="font-bold text-green-800">{scanResult.message}</p>
                                                    <p className="text-xs text-green-600 mt-1">Le pointage a été enregistré avec succès</p>
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                <div className="flex-shrink-0 w-8 h-8 bg-red-500 rounded-full flex items-center justify-center animate-pulse">
                                                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                    </svg>
                                                </div>
                                                <div className="flex-1">
                                                    <p className="font-bold text-red-800">{scanResult.message}</p>
                                                    <p className="text-xs text-red-600 mt-1">Une erreur est survenue lors du pointage</p>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default QRCodeManager;
