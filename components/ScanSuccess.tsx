import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, Home, Clock } from 'lucide-react';

const ScanSuccess: React.FC = () => {
    const navigate = useNavigate();
    const [countdown, setCountdown] = useState(5);
    const [isRedirecting, setIsRedirecting] = useState(false);

    useEffect(() => {
        if (isRedirecting) return;
        
        const timer = setInterval(() => {
            setCountdown(prev => {
                if (prev <= 1) {
                    setIsRedirecting(true);
                    navigate('/');
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [navigate, isRedirecting]);

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-cream-50 p-6">
            <div className="bg-white p-8 rounded-xl shadow-xl max-w-md w-full text-center animate-in fade-in zoom-in">
                <div className="relative mb-6">
                    <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                        <CheckCircle className="w-12 h-12 text-green-600" />
                    </div>
                    <div className="absolute inset-0 w-24 h-24 bg-green-500/20 rounded-full mx-auto animate-ping"></div>
                </div>
                
                <h1 className="text-2xl font-bold text-slate-800 mb-4">
                    Scan Enregistré avec Succès !
                </h1>
                
                <p className="text-slate-600 mb-8">
                    Votre passage a été correctement enregistré dans le système.
                </p>
                
                <button
                    onClick={() => navigate('/')}
                    className="w-full bg-brand-blue text-white py-3 rounded-lg font-bold hover:bg-teal-700 transition flex items-center justify-center gap-2"
                >
                    <Home className="w-5 h-5" />
                    Retour à l'accueil
                </button>
                
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                    <div className="flex items-center justify-center gap-2 text-green-700">
                        <Clock className="w-4 h-4" />
                        <span className="text-sm font-medium">
                            Redirection automatique dans {countdown}s...
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ScanSuccess;
