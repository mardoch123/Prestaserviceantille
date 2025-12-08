import React, { useState, useMemo, useEffect } from 'react';
import { useData } from '../context/DataContext';
import {
    QrCode,
    Printer,
    History,
    Search,
    MapPin,
    Clock,
    UserCheck,
    CheckCircle,
    XCircle,
    ScanLine,
    ArrowRight
} from 'lucide-react';

const QRCodeManager: React.FC = () => {
    const { clients, visitScans, registerScan, currentUser } = useData();
    const [activeTab, setActiveTab] = useState<'generate' | 'scan' | 'history'>('generate');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedClientForScan, setSelectedClientForScan] = useState<string>('');
    const [scanResult, setScanResult] = useState<{ type?: string, message: string } | null>(null);

    // --- Generate Logic ---
    const filteredClients = useMemo(() => {
        if (!searchQuery) return clients;
        return clients.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()));
    }, [clients, searchQuery]);

    const handlePrint = (clientId: string) => {
        const client = clients.find(c => c.id === clientId);
        if (!client) return;

        // Construct a URL that represents the scan action
        // Ideally this URL opens the app at the scanning page with the client pre-selected
        // We use window.location.origin to support both localhost and production
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
                            3. Scannez ce code à votre départ (Sortie)
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

        setScanResult(null); // Reset UI

        // Add artificial delay for realism
        await new Promise(r => setTimeout(r, 800));

        const result = await registerScan(selectedClientForScan);
        setScanResult({
            type: result.type,
            message: result.message
        });
    };

    // --- History Logic ---
    const [scanFilters, setScanFilters] = useState({
        startDate: '',
        endDate: '',
        clientId: '',
        type: ''
    });

    const scansHistory = useMemo(() => {
        let filtered = visitScans;

        if (scanFilters.startDate) {
            filtered = filtered.filter(s => new Date(s.timestamp) >= new Date(scanFilters.startDate));
        }
        if (scanFilters.endDate) {
            // End of day
            const end = new Date(scanFilters.endDate);
            end.setHours(23, 59, 59, 999);
            filtered = filtered.filter(s => new Date(s.timestamp) <= end);
        }
        if (scanFilters.clientId) {
            filtered = filtered.filter(s => s.clientId === scanFilters.clientId);
        }
        if (scanFilters.type) {
            filtered = filtered.filter(s => s.scanType === scanFilters.type);
        }

        return filtered.map(scan => {
            const client = clients.find(c => c.id === scan.clientId);
            return {
                ...scan,
                clientName: client ? client.name : 'Client Inconnu'
            };
        }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }, [visitScans, clients, scanFilters]);

    return (
        <div className="p-8 h-full overflow-y-auto bg-white/40">
            <div className="mb-8">
                <h2 className="text-3xl font-serif font-bold text-slate-800">Gestion des QR Codes</h2>
                <p className="text-sm text-slate-500">Génération de codes clients et suivi des pointages</p>
            </div>

            {/* Navigation Tabs */}
            <div className="flex space-x-1 bg-slate-100 p-1 rounded-lg w-fit mb-8">
                <button
                    onClick={() => setActiveTab('generate')}
                    className={`px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 transition-all ${activeTab === 'generate' ? 'bg-white text-brand-blue shadow-sm' : 'text-slate-500'}`}
                >
                    <QrCode className="w-4 h-4" /> Générateur
                </button>
                <button
                    onClick={() => setActiveTab('scan')}
                    className={`px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 transition-all ${activeTab === 'scan' ? 'bg-white text-brand-blue shadow-sm' : 'text-slate-500'}`}
                >
                    <ScanLine className="w-4 h-4" /> Scanner (Simulateur)
                </button>
                <button
                    onClick={() => setActiveTab('history')}
                    className={`px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 transition-all ${activeTab === 'history' ? 'bg-white text-brand-blue shadow-sm' : 'text-slate-500'}`}
                >
                    <History className="w-4 h-4" /> Historique
                </button>
            </div>

            {/* --- GENERATOR TAB --- */}
            {activeTab === 'generate' && (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 animate-in fade-in">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="font-bold text-lg text-slate-700">Liste des clients</h3>
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="Rechercher un client..."
                                className="pl-10 pr-4 py-2 border rounded-lg text-sm outline-none focus:border-brand-blue"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                        </div>
                    </div>

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

            {/* --- SCANNER TAB --- */}
            {activeTab === 'scan' && (
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
                            className="w-full p-3 border border-slate-300 rounded-lg mb-4 text-sm font-bold bg-slate-50 outline-none focus:border-brand-blue"
                            value={selectedClientForScan}
                            onChange={(e) => setSelectedClientForScan(e.target.value)}
                        >
                            <option value="">-- Choisir un QR Code (Client) --</option>
                            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>

                        <button
                            onClick={handleSimulateScan}
                            disabled={!selectedClientForScan}
                            className="w-full bg-brand-blue text-white py-3 rounded-xl font-bold shadow-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition transform active:scale-95"
                        >
                            SIMULER LE SCAN
                        </button>

                        {scanResult && (
                            <div className={`mt-6 p-4 rounded-xl border flex items-center gap-3 animate-in slide-in-from-bottom-4 ${scanResult.type ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
                                {scanResult.type ? <CheckCircle className="w-6 h-6" /> : <XCircle className="w-6 h-6" />}
                                <div className="text-left">
                                    <p className="font-bold text-sm">{scanResult.message}</p>
                                    {scanResult.type && <p className="text-xs opacity-80">{new Date().toLocaleTimeString()}</p>}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* --- HISTORY TAB --- */}
            {activeTab === 'history' && (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden animate-in fade-in">
                    <div className="p-6 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                        <h3 className="font-bold text-slate-700">Derniers pointages</h3>
                    </div>

                    {/* FILTERS */}
                    <div className="p-4 bg-white border-b border-slate-100 flex flex-wrap gap-4 items-center text-sm">
                        <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-slate-400" />
                            <input type="date" className="border rounded px-2 py-1 bg-slate-50" value={scanFilters.startDate} onChange={e => setScanFilters({ ...scanFilters, startDate: e.target.value })} title="Date Début" />
                            <span className="text-slate-300">-</span>
                            <input type="date" className="border rounded px-2 py-1 bg-slate-50" value={scanFilters.endDate} onChange={e => setScanFilters({ ...scanFilters, endDate: e.target.value })} title="Date Fin" />
                        </div>
                        <div className="flex items-center gap-2 border-l pl-4">
                            <MapPin className="w-4 h-4 text-slate-400" />
                            <select className="border rounded px-2 py-1 bg-slate-50 max-w-[150px]" value={scanFilters.clientId} onChange={e => setScanFilters({ ...scanFilters, clientId: e.target.value })}>
                                <option value="">Tous les clients</option>
                                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                        <div className="flex items-center gap-2 border-l pl-4">
                            <ArrowRight className="w-4 h-4 text-slate-400" />
                            <select className="border rounded px-2 py-1 bg-slate-50" value={scanFilters.type} onChange={e => setScanFilters({ ...scanFilters, type: e.target.value })}>
                                <option value="">Type (Tous)</option>
                                <option value="entry">Entrées</option>
                                <option value="exit">Sorties</option>
                            </select>
                        </div>

                        {(scanFilters.startDate || scanFilters.endDate || scanFilters.clientId || scanFilters.type) && (
                            <button onClick={() => setScanFilters({ startDate: '', endDate: '', clientId: '', type: '' })} className="ml-auto text-red-500 text-xs hover:underline">Effacer filtres</button>
                        )}
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 text-xs uppercase text-slate-500 border-b border-slate-100">
                                <tr>
                                    <th className="px-6 py-4">Date & Heure</th>
                                    <th className="px-6 py-4">Client</th>
                                    <th className="px-6 py-4">Scanner (Prestataire)</th>
                                    <th className="px-6 py-4 text-center">Type</th>
                                    <th className="px-6 py-4 text-right">Statut</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {scansHistory.length === 0 ? (
                                    <tr><td colSpan={5} className="p-8 text-center text-slate-400">Aucun historique de scan trouvé.</td></tr>
                                ) : (
                                    scansHistory.map(scan => (
                                        <tr key={scan.id} className="hover:bg-slate-50">
                                            <td className="px-6 py-4 text-slate-600 font-mono text-xs">
                                                {new Date(scan.timestamp).toLocaleString()}
                                            </td>
                                            <td className="px-6 py-4 font-bold text-slate-700">{scan.clientName}</td>
                                            <td className="px-6 py-4 text-slate-600 flex items-center gap-2">
                                                <UserCheck className="w-4 h-4 text-slate-400" /> {scan.scannerName}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className={`px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-1 w-fit mx-auto ${scan.scanType === 'entry'
                                                    ? 'bg-green-100 text-green-700 border-green-200'
                                                    : 'bg-orange-100 text-orange-700 border-orange-200'
                                                    }`}>
                                                    {scan.scanType === 'entry' ? <ArrowRight className="w-3 h-3" /> : <LogOut className="w-3 h-3 transform rotate-180" />}
                                                    {scan.scanType === 'entry' ? 'ENTRÉE' : 'SORTIE'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <span className="text-xs text-slate-400 flex items-center justify-end gap-1">
                                                    <MapPin className="w-3 h-3" /> Géolocalisé
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default QRCodeManager;

function LogOut(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" x2="9" y1="12" y2="12" />
        </svg>
    )
}
