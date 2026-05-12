import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../utils/supabaseClient';
import { SafeImage } from './SafeImage';
import { useData } from '../context/DataContext';
import { Lock, Loader2, Eye, EyeOff, CheckCircle, AlertTriangle, ArrowLeft } from 'lucide-react';

const ResetPassword: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { companySettings } = useData();
    
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const [isValidToken, setIsValidToken] = useState<boolean | null>(null);

    useEffect(() => {
        const verifyToken = async () => {
            const token = searchParams.get('token');
            const type = searchParams.get('type');
            
            if (token && type === 'recovery') {
                try {
                    const { error } = await supabase.auth.getSession();
                    if (error) {
                        setIsValidToken(false);
                        setMessage({ type: 'error', text: 'Lien de réinitialisation invalide ou expiré.' });
                    } else {
                        setIsValidToken(true);
                    }
                } catch {
                    setIsValidToken(false);
                    setMessage({ type: 'error', text: 'Lien de réinitialisation invalide ou expiré.' });
                }
            } else {
                setIsValidToken(false);
                setMessage({ type: 'error', text: 'Lien de réinitialisation invalide.' });
            }
        };
        
        verifyToken();
    }, [searchParams]);

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!newPassword) {
            setMessage({ type: 'error', text: 'Veuillez entrer un nouveau mot de passe.' });
            return;
        }
        
        if (newPassword.length < 6) {
            setMessage({ type: 'error', text: 'Le mot de passe doit contenir au moins 6 caractères.' });
            return;
        }
        
        if (newPassword !== confirmPassword) {
            setMessage({ type: 'error', text: 'Les mots de passe ne correspondent pas.' });
            return;
        }
        
        setLoading(true);
        setMessage(null);
        
        try {
            const { error } = await supabase.auth.updateUser({
                password: newPassword
            });
            
            if (error) {
                setMessage({ type: 'error', text: error.message });
            } else {
                setMessage({ type: 'success', text: 'Mot de passe réinitialisé avec succès !' });
                setTimeout(() => {
                    navigate('/login');
                }, 3000);
            }
        } catch (err: any) {
            setMessage({ type: 'error', text: err?.message || 'Une erreur est survenue.' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-cream-50 flex items-center justify-center relative overflow-hidden p-4">
            <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5"></div>
            <div className="absolute -top-20 -right-20 w-96 h-96 bg-brand-orange/10 rounded-full blur-3xl"></div>
            <div className="absolute -bottom-20 -left-20 w-96 h-96 bg-brand-blue/10 rounded-full blur-3xl"></div>

            <div className="bg-white/80 backdrop-blur-md p-8 rounded-2xl shadow-2xl w-full max-w-md border border-white relative z-10">
                <button 
                    onClick={() => navigate('/login')}
                    className="flex items-center gap-2 text-slate-500 hover:text-slate-700 mb-4 transition"
                >
                    <ArrowLeft className="w-4 h-4" /> Retour
                </button>

                <div className="text-center mb-8">
                    <div className="w-24 h-24 mx-auto mb-4 flex items-center justify-center">
                        {companySettings?.logoUrl ? (
                            <SafeImage
                                src={companySettings.logoUrl}
                                alt="Logo Entreprise"
                                className="w-full h-full object-contain drop-shadow-md"
                                timeout={5000}
                                retryCount={1}
                            />
                        ) : (
                            <div className="w-20 h-20 rounded-full bg-white border-4 border-brand-orange flex items-center justify-center shadow-md">
                                <span className="text-brand-blue font-bold text-xs">LOGO</span>
                            </div>
                        )}
                    </div>
                    <h1 className="text-2xl font-serif font-bold text-slate-800">Nouveau mot de passe</h1>
                    <p className="text-slate-500 text-sm mt-2">Entrez votre nouveau mot de passe</p>
                </div>

                {message && (
                    <div className={`mb-6 p-4 rounded-xl text-center ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                        {message.type === 'success' ? (
                            <CheckCircle className="w-8 h-8 mx-auto mb-2" />
                        ) : (
                            <AlertTriangle className="w-8 h-8 mx-auto mb-2" />
                        )}
                        <p className="font-medium">{message.text}</p>
                    </div>
                )}

                {isValidToken === false ? (
                    <div className="text-center">
                        <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
                        <p className="text-slate-600 mb-4">Ce lien de réinitialisation est invalide ou a expiré.</p>
                        <button
                            onClick={() => navigate('/login')}
                            className="bg-brand-blue text-white px-6 py-3 rounded-xl font-bold hover:bg-teal-700 transition"
                        >
                            Retour à la connexion
                        </button>
                    </div>
                ) : (
                    <form onSubmit={handleResetPassword} className="space-y-4">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">Nouveau mot de passe</label>
                            <div className="relative">
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-blue focus:border-transparent outline-none transition pr-12"
                                    placeholder="••••••••"
                                    disabled={loading}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-3.5 text-slate-400 hover:text-brand-blue transition"
                                    disabled={loading}
                                >
                                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">Confirmer le mot de passe</label>
                            <div className="relative">
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-blue focus:border-transparent outline-none transition pr-12"
                                    placeholder="••••••••"
                                    disabled={loading}
                                />
                                <Lock className="w-5 h-5 text-slate-400 absolute right-3 top-3.5" />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading || isValidToken === null}
                            className="w-full bg-brand-blue hover:bg-teal-700 text-white font-bold py-3 rounded-xl shadow-lg transition transform active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed flex justify-center items-center gap-2"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    Réinitialisation...
                                </>
                            ) : (
                                'Réinitialiser le mot de passe'
                            )}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
};

export default ResetPassword;
