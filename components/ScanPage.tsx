import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { Loader2, CheckCircle, XCircle, LogIn } from 'lucide-react';

const ScanPage: React.FC = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { currentUser, registerScan } = useData();
    const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'unauthorized'>('loading');
    const [message, setMessage] = useState('');

    const clientId = searchParams.get('client');

    useEffect(() => {
        const processScan = async () => {
            if (!clientId) {
                setStatus('error');
                setMessage("Code QR invalide (Client ID manquant).");
                return;
            }

            if (!currentUser) {
                setStatus('unauthorized');
                // We keep the current URL as redirect target if your Login component supports it
                // Logic handled by rendering Redirect to Login or showing button below
                return;
            }

            try {
                // Determine scan type automatically (toggle) is handled by backend/context usually, 
                // or we default to 'entry' if no params. 
                // Context's registerScan typically handles 'toggle' logic based on last scan.
                const result = await registerScan(clientId);

                if (result.success) {
                    setStatus('success');
                } else {
                    setStatus('error');
                }
                setMessage(result.message);

            } catch (err: any) {
                console.error("Scan error:", err);
                setStatus('error');
                setMessage("Erreur lors de l'enregistrement du scan.");
            }
        };

        processScan();
    }, [clientId, currentUser, registerScan]);

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
        <div className="min-h-screen flex flex-col items-center justify-center bg-cream-50 p-6 text-center">
            <div className="bg-white p-8 rounded-xl shadow-xl max-w-sm w-full animate-in fade-in zoom-in">
                {status === 'loading' && (
                    <>
                        <Loader2 className="w-16 h-16 text-brand-blue animate-spin mx-auto mb-4" />
                        <h2 className="text-xl font-bold text-slate-800">Traitement en cours...</h2>
                        <p className="text-slate-500 mt-2">Enregistrement de votre passage</p>
                    </>
                )}

                {status === 'success' && (
                    <>
                        <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                            <CheckCircle className="w-8 h-8" />
                        </div>
                        <h2 className="text-xl font-bold text-slate-800 mb-2">Scan Enregistré !</h2>
                        <p className="text-slate-600 font-medium">{message}</p>
                        <button
                            onClick={() => navigate('/')}
                            className="mt-6 text-brand-blue font-bold hover:underline"
                        >
                            Retour à l'accueil
                        </button>
                    </>
                )}

                {status === 'error' && (
                    <>
                        <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                            <XCircle className="w-8 h-8" />
                        </div>
                        <h2 className="text-xl font-bold text-slate-800 mb-2">Erreur</h2>
                        <p className="text-slate-600">{message}</p>
                        <button
                            onClick={() => navigate('/')}
                            className="mt-6 bg-slate-100 text-slate-700 py-2 px-6 rounded-lg font-bold hover:bg-slate-200"
                        >
                            Retour
                        </button>
                    </>
                )}
            </div>
        </div>
    );
};

export default ScanPage;
