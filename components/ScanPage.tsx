import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { Loader2, CheckCircle, XCircle, LogIn, Clock, User, MapPin, RefreshCw } from 'lucide-react';
import { usePullToRefresh } from '../hooks/usePullToRefresh';

// Ajouter les animations CSS personnalisées
const style = document.createElement('style');
style.textContent = `
    @keyframes bounce-in {
        0% { transform: scale(0.3); opacity: 0; }
        50% { transform: scale(1.05); }
        70% { transform: scale(0.9); }
        100% { transform: scale(1); opacity: 1; }
    }
    
    @keyframes slide-right {
        0% { transform: translateX(-100%); }
        100% { transform: translateX(100%); }
    }
    
    @keyframes ping {
        0% { transform: scale(1); opacity: 1; }
        75%, 100% { transform: scale(2); opacity: 0; }
    }
    
    @keyframes shake {
        0%, 100% { transform: translateX(0); }
        10%, 30%, 50%, 70%, 90% { transform: translateX(-2px); }
        20%, 40%, 60%, 80% { transform: translateX(2px); }
    }
    
    .animate-bounce-in { animation: bounce-in 0.6s ease-out; }
    .animate-slide-right { animation: slide-right 1.5s ease-in-out infinite; }
    .animate-ping { animation: ping 1s cubic-bezier(0, 0, 0.2, 1) infinite; }
    .animate-shake { animation: shake 0.5s ease-in-out; }
`;
document.head.appendChild(style);

const ScanPage: React.FC = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { currentUser, registerScan, visitScans, clients } = useData();
    const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'unauthorized'>('loading');
    const [message, setMessage] = useState('');
    const [scanType, setScanType] = useState<'entry' | 'exit' | null>(null);
    const [clientScans, setClientScans] = useState<any[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [processedClientId, setProcessedClientId] = useState<string | null>(null);

    const clientId = searchParams.get('client');

    // Pull-to-refresh functionality
    const { containerRef, isPulling, pullDistance, isRefreshing, pullProgress } = usePullToRefresh({
        onRefresh: () => {
            navigate('/');
            return Promise.resolve();
        },
        threshold: 80
    });

    useEffect(() => {
        let timeoutId: NodeJS.Timeout;
        
        // Éviter les traitements multiples du même clientId
        if (!clientId || isProcessing || processedClientId === clientId) {
            return;
        }

        // Attendre que les données clients soient chargées
        if (!clients || clients.length === 0) {
            return;
        }

        const processScan = async () => {
            setIsProcessing(true);
            setProcessedClientId(clientId);
            
            if (!clientId) {
                setStatus('error');
                setMessage("Code QR invalide (Client ID manquant).");
                setIsProcessing(false);
                return;
            }

            if (!currentUser) {
                setStatus('unauthorized');
                setIsProcessing(false);
                return;
            }

            // Timeout de 10 secondes pour éviter le blocage
            timeoutId = setTimeout(() => {
                setStatus('error');
                setMessage("Délai d'attente dépassé. Veuillez réessayer.");
                setIsProcessing(false);
            }, 10000);

            try {
                // Jouer un son de scan
                try {
                    const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUazi5L2d');
                    audio.volume = 0.4;
                    await audio.play();
                } catch (e) {
                    // Ignorer les erreurs audio
                }

                // Vérifier si le client existe
                const client = clients.find(c => c.id === clientId);
                if (!client) {
                    clearTimeout(timeoutId);
                    setStatus('error');
                    setMessage("Client non trouvé. Veuillez vérifier le code QR.");
                    setIsProcessing(false);
                    return;
                }

                // Récupérer les scans précédents du client aujourd'hui
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const clientTodayScans = visitScans.filter(scan => 
                    scan.clientId === clientId && 
                    new Date(scan.timestamp) >= today
                ).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

                // Déterminer le type de scan (alternance entrée/sortie)
                let scanType: 'entry' | 'exit';
                if (clientTodayScans.length === 0) {
                    // Premier scan du jour = entrée
                    scanType = 'entry';
                } else {
                    const lastScan = clientTodayScans[0];
                    // Si le dernier scan était une entrée, le suivant doit être une sortie
                    // Si le dernier scan était une sortie, le suivant doit être une entrée
                    scanType = lastScan.scanType === 'entry' ? 'exit' : 'entry';
                }

                const result = await registerScan(clientId);

                // Annuler le timeout si le scan réussit
                clearTimeout(timeoutId);

                if (result.success) {
                    setScanType(result.type || 'entry');
                    setStatus('success');
                    
                    // Récupérer tous les scans du client pour les afficher
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const clientTodayScans = visitScans.filter(scan => 
                        scan.clientId === clientId && 
                        new Date(scan.timestamp) >= today
                    ).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
                    setClientScans(clientTodayScans);
                    
                    // Jouer un son de succès
                    try {
                        const successAudio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUazi5L2d');
                        successAudio.volume = 0.6;
                        await successAudio.play();
                    } catch (e) {
                        // Ignorer les erreurs audio
                    }
                } else {
                    setStatus('error');
                }
                setMessage(result.message);

            } catch (err: any) {
                // Annuler le timeout en cas d'erreur
                clearTimeout(timeoutId);
                console.error("Scan error:", err);
                setStatus('error');
                
                // Messages d'erreur plus spécifiques
                if (err.message && err.message.includes('Network')) {
                    setMessage("Erreur réseau. Veuillez vérifier votre connexion.");
                } else if (err.message && err.message.includes('403')) {
                    setMessage("Accès non autorisé. Veuillez vous reconnecter.");
                } else {
                    setMessage("Erreur lors de l'enregistrement du scan: " + (err.message || "Erreur inconnue"));
                }
            } finally {
                setIsProcessing(false);
            }
        };

        processScan();

        // Nettoyage du timeout si le composant est démonté
        return () => {
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
        };
    }, [clientId, currentUser, clients]); // Ajout de clients dans les dépendances

    if (status === 'unauthorized') {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-cream-50 p-6 text-center">
                <div className="bg-white p-8 rounded-xl shadow-xl max-w-sm w-full">
                    <div className="w-16 h-16 bg-blue-100 text-brand-blue rounded-full flex items-center justify-center mx-auto mb-4">
                        <LogIn className="w-8 h-8" />
                    </div>
                    <h2 className="text-xl font-bold text-slate-800 mb-2">Connexion Requise</h2>
                    <p className="text-slate-600 mb-6">
                        Vous devez être connecté pour enregistrer un scan.
                    </p>
                    <button
                        onClick={() => navigate('/')} // Assuming '/' redirects to login if not auth
                        className="w-full bg-brand-blue text-white py-3 rounded-lg font-bold hover:bg-teal-700 transition"
                    >
                        Se connecter
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div ref={containerRef} className="min-h-screen flex flex-col items-center justify-center bg-cream-50 p-6 text-center pb-8 relative">
            {/* Pull-to-refresh indicator */}
            {(isPulling || isRefreshing) && (
                <div 
                    className="absolute top-0 left-0 right-0 flex items-center justify-center bg-white/80 backdrop-blur-sm border-b border-slate-200 transition-all duration-300"
                    style={{ height: `${Math.min(pullDistance, 80)}px`, opacity: pullProgress }}
                >
                    <RefreshCw 
                        className={`w-6 h-6 text-brand-blue ${isRefreshing ? 'animate-spin' : ''}`} 
                        style={{ transform: `rotate(${pullProgress * 360}deg)` }}
                    />
                </div>
            )}
            
            <div className="bg-white p-8 rounded-xl shadow-xl max-w-sm w-full animate-in fade-in zoom-in">
                {status === 'loading' && (
                    <>
                        <div className="relative">
                            <Loader2 className="w-16 h-16 text-brand-blue animate-spin mx-auto mb-4" />
                            <div className="absolute inset-0 w-16 h-16 bg-brand-blue/20 rounded-full mx-auto mb-4 animate-ping"></div>
                        </div>
                        <h2 className="text-xl font-bold text-slate-800">Traitement en cours...</h2>
                        <p className="text-slate-500 mt-2">Enregistrement de votre passage</p>
                        <div className="mt-4 flex justify-center">
                            <div className="w-48 h-1 bg-slate-200 rounded-full overflow-hidden">
                                <div className="h-full bg-brand-blue animate-slide-right"></div>
                            </div>
                        </div>
                    </>
                )}

                {status === 'success' && (
                    <>
                        <div className="relative">
                            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce-in">
                                <CheckCircle className="w-8 h-8 text-green-600" />
                            </div>
                            <div className="absolute inset-0 w-16 h-16 bg-green-500/20 rounded-full mx-auto mb-4 animate-ping"></div>
                        </div>
                        <h2 className="text-xl font-bold text-slate-800 mb-2">Scan Enregistré !</h2>
                        <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
                            <p className="text-green-800 font-medium">{message}</p>
                            {scanType && (
                                <div className="mt-2 flex items-center justify-center gap-2">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                                        scanType === 'entry' ? 'bg-blue-100' : 'bg-orange-100'
                                    }`}>
                                        {scanType === 'entry' ? (
                                            <LogIn className="w-4 h-4 text-blue-600" />
                                        ) : (
                                            <LogIn className="w-4 h-4 text-orange-600 rotate-180" />
                                        )}
                                    </div>
                                    <span className={`text-sm font-bold ${
                                        scanType === 'entry' ? 'text-blue-700' : 'text-orange-700'
                                    }`}>
                                        {scanType === 'entry' ? 'Entrée' : 'Sortie'} enregistrée
                                    </span>
                                </div>
                            )}
                        </div>
                        <div className="text-xs text-slate-500 mb-4">
                            {new Date().toLocaleString('fr-FR', { 
                                weekday: 'long', 
                                year: 'numeric', 
                                month: 'long', 
                                day: 'numeric', 
                                hour: '2-digit', 
                                minute: '2-digit' 
                            })}
                        </div>

                        {/* Historique des scans du jour */}
                        {clientScans.length > 1 && (
                            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                <h4 className="font-bold text-blue-800 mb-2 flex items-center gap-2">
                                    <Clock className="w-4 h-4" />
                                    Historique des scans du jour ({clientScans.length})
                                </h4>
                                <div className="space-y-2 max-h-32 overflow-y-auto">
                                    {clientScans.map((scan, index) => {
                                        const client = clients.find(c => c.id === scan.clientId);
                                        return (
                                            <div key={scan.id} className="flex items-center justify-between text-xs bg-white p-2 rounded border border-blue-100">
                                                <div className="flex items-center gap-2">
                                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                                                        scan.scanType === 'entry' ? 'bg-green-100' : 'bg-orange-100'
                                                    }`}>
                                                        {scan.scanType === 'entry' ? (
                                                            <LogIn className="w-3 h-3 text-green-600" />
                                                        ) : (
                                                            <LogIn className="w-3 h-3 text-orange-600 rotate-180" />
                                                        )}
                                                    </div>
                                                    <div>
                                                        <span className={`font-bold ${
                                                            scan.scanType === 'entry' ? 'text-green-700' : 'text-orange-700'
                                                        }`}>
                                                            {scan.scanType === 'entry' ? 'Entrée' : 'Sortie'}
                                                        </span>
                                                        <span className="text-slate-500 ml-2">
                                                            {new Date(scan.timestamp).toLocaleTimeString('fr-FR', { 
                                                                hour: '2-digit', 
                                                                minute: '2-digit' 
                                                            })}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="text-slate-400">
                                                    {scan.scannerName}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        <button
                            onClick={(e) => {
                                // Empêcher les clics multiples
                                const button = e.currentTarget;
                                button.disabled = true;
                                
                                // Rediriger vers une page de succès simple après un seul scan
                                if (clientScans.length === 1) {
                                    navigate('/scan-success');
                                } else {
                                    navigate('/');
                                }
                            }}
                            className="w-full bg-green-600 text-white py-3 rounded-lg font-bold hover:bg-green-700 transition disabled:bg-green-400 disabled:cursor-not-allowed"
                        >
                            Retour à l'accueil
                        </button>
                    </>
                )}

                {status === 'error' && (
                    <>
                        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-shake">
                            <XCircle className="w-8 h-8 text-red-600" />
                        </div>
                        <h2 className="text-xl font-bold text-slate-800 mb-2">Erreur</h2>
                        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                            <p className="text-red-800">{message}</p>
                        </div>
                        <div className="space-y-2">
                            <button
                                onClick={(e) => {
                                    // Empêcher les clics multiples
                                    const button = e.currentTarget;
                                    button.disabled = true;
                                    button.textContent = 'Chargement...';
                                    
                                    // Réinitialiser les états et recharger
                                    setIsProcessing(false);
                                    setProcessedClientId(null);
                                    setStatus('loading');
                                    setMessage('');
                                    
                                    // Forcer une nouvelle tentative de scan
                                    setTimeout(() => {
                                        window.location.reload();
                                    }, 100);
                                }}
                                className="w-full bg-slate-100 text-slate-700 py-2 px-6 rounded-lg font-bold hover:bg-slate-200 transition disabled:bg-slate-300 disabled:cursor-not-allowed"
                            >
                                Réessayer
                            </button>
                            <button
                                onClick={() => navigate('/')}
                                className="w-full text-slate-500 py-2 px-6 rounded-lg font-bold hover:bg-slate-100 transition"
                            >
                                Retour
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default ScanPage;
