
import React, { useState } from 'react';
import { useData } from '../context/DataContext';
import { supabase } from '../utils/supabaseClient';
import { Lock, Loader2, Wand2, X, CheckCircle, AlertTriangle } from 'lucide-react';

const Login: React.FC = () => {
  const { login, companySettings } = useData();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // États pour la modale d'initialisation
  const [showInitModal, setShowInitModal] = useState(false);
  const [initStatus, setInitStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [initMessage, setInitMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
        if (!password) {
            throw new Error('Le mot de passe est obligatoire.');
        }

        const success = await login(email, password);
        
        if (!success) {
          throw new Error('Identifiants incorrects.');
        }
        // Si succès, le composant sera démonté car currentUser changera via le contexte
    } catch (err: any) {
        setError(err.message || 'Échec de la connexion.');
        setLoading(false); // Important: arrêter le chargement en cas d'erreur
    }
  };

  // Ouvre la modale de confirmation
  const handleOpenInitModal = () => {
      setShowInitModal(true);
      setInitStatus('idle');
      setInitMessage('');
  };

  // Exécute la logique de création Supabase
  const executeCreateAdmin = async () => {
    setInitStatus('loading');
    
    try {
        // 1. Création de l'utilisateur Auth (Sécurité)
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email: 'admin@presta.com',
            password: 'admin123',
        });

        if (authError) {
             // Si l'utilisateur existe déjà dans Auth mais pas dans public.users, on continue
             if (!authError.message.includes("already registered")) {
                 throw authError;
             }
             console.log("Utilisateur Auth déjà existant, tentative de création du profil public...");
        }
        
        let userId = authData.user?.id;

        if (!userId && authError?.message.includes("already registered")) {
             // On ne peut pas récupérer l'ID si on n'est pas loggué. 
             // On demande à l'utilisateur de se connecter s'il a déjà créé le compte.
             throw new Error("Compte déjà existant. Veuillez vous connecter directement.");
        }

        if (userId) {
            // 2. Insertion du profil public
            const { error: profileError } = await supabase.from('users').insert({
                id: userId,
                email: 'admin@presta.com',
                name: 'Admin Principal',
                role: 'admin'
            });

            if (profileError) {
                // Ignorer erreur de duplication si le profil existe déjà
                if (!profileError.message.includes("duplicate key")) {
                    throw profileError;
                }
            }
            
            // 3. Insertion des paramètres entreprise par défaut
            await supabase.from('company_settings').insert({
                name: 'PRESTA SERVICES ANTILLES', 
                address: '31 Résidence L’Autre Bord – 97220 La Trinité', 
                siret: 'SAP944789700', 
                email: 'prestaservicesantilles.rh@gmail.com', 
                phone: '0696 00 00 00', 
                tva_rate_default: 2.1
            });

            setInitStatus('success');
            setEmail('admin@presta.com');
            setPassword('admin123');
        }

    } catch (err: any) {
        setInitStatus('error');
        setInitMessage(err.message || "Une erreur est survenue.");
    }
  };

  return (
    <div className="min-h-screen bg-cream-50 flex items-center justify-center relative overflow-hidden">
       {/* Decorative Elements */}
       <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5"></div>
       <div className="absolute -top-20 -right-20 w-96 h-96 bg-brand-orange/10 rounded-full blur-3xl"></div>
       <div className="absolute -bottom-20 -left-20 w-96 h-96 bg-brand-blue/10 rounded-full blur-3xl"></div>

       <div className="bg-white/80 backdrop-blur-md p-8 rounded-2xl shadow-2xl w-full max-w-md border border-white relative z-10">
          <div className="text-center mb-8">
             {/* Dynamic Logo from Company Settings */}
             <div className="w-32 h-32 mx-auto mb-4 flex items-center justify-center">
                 {companySettings?.logoUrl ? (
                     <img src={companySettings.logoUrl} alt="Logo Entreprise" className="w-full h-full object-contain drop-shadow-md" />
                 ) : (
                     <div className="w-24 h-24 rounded-full bg-white border-4 border-brand-orange flex items-center justify-center shadow-md">
                        <span className="text-brand-blue font-bold text-xs text-center leading-tight">PRESTA<br/>SERVICES<br/>ANTILLES</span>
                     </div>
                 )}
             </div>
             <h1 className="text-2xl font-serif font-bold text-slate-800">Espace Connexion</h1>
             <p className="text-slate-500 text-sm mt-2">
                 Portail unique pour Administrateurs, Clients et Prestataires.
                 <br/><span className="text-xs italic">Redirection automatique selon votre rôle.</span>
             </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                  <div className="bg-red-50 text-red-600 text-xs p-3 rounded border border-red-200 text-center font-bold">
                      {error}
                  </div>
              )}

              <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Email</label>
                  <input 
                    type="email" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg focus:border-brand-blue outline-none transition"
                    placeholder="votre@email.com"
                    required
                  />
              </div>

              <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Mot de passe</label>
                  <div className="relative">
                      <input 
                        type="password" 
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg focus:border-brand-blue outline-none transition"
                        placeholder="••••••••"
                        required
                      />
                      <Lock className="w-4 h-4 text-slate-400 absolute right-3 top-3.5" />
                  </div>
              </div>

              <button 
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl font-bold text-white shadow-lg transition transform hover:scale-[1.02] flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed bg-brand-blue hover:bg-blue-700"
              >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Se connecter'}
              </button>
          </form>

          {/* BOUTON DE SECOURS POUR CRÉATION ADMIN */}
          <div className="mt-8 pt-4 border-t border-slate-100">
             <button 
                type="button"
                onClick={handleOpenInitModal}
                className="w-full flex items-center justify-center gap-2 text-xs text-slate-400 hover:text-brand-blue transition font-bold opacity-60 hover:opacity-100"
             >
                 <Wand2 className="w-3 h-3" /> Initialiser Admin (1ère connexion)
             </button>
          </div>

          <div className="mt-2 text-center">
              <p className="text-xs text-slate-400">© 2023 Presta Services Antilles. Tous droits réservés.</p>
          </div>
       </div>

       {/* POP-UP / MODALE D'INITIALISATION */}
       {showInitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 animate-in fade-in zoom-in duration-200 relative">
                <button 
                    onClick={() => setShowInitModal(false)} 
                    className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
                    disabled={initStatus === 'loading'}
                >
                    <X className="w-5 h-5" />
                </button>

                <div className="text-center mb-6">
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                        <Wand2 className="w-6 h-6 text-brand-blue" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-800">Configuration Admin</h3>
                </div>

                {initStatus === 'idle' && (
                    <div className="space-y-4">
                        <p className="text-sm text-slate-600 text-center">
                            Cette action va créer le compte administrateur principal dans la base de données.
                        </p>
                        <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs font-mono text-slate-600 space-y-1">
                            <p><strong>Email :</strong> admin@presta.com</p>
                            <p><strong>Pass :</strong> admin123</p>
                        </div>
                        <button 
                            onClick={executeCreateAdmin}
                            className="w-full bg-brand-blue text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition"
                        >
                            Créer le compte maintenant
                        </button>
                    </div>
                )}

                {initStatus === 'loading' && (
                    <div className="text-center py-4">
                        <Loader2 className="w-10 h-10 text-brand-blue animate-spin mx-auto mb-4" />
                        <p className="text-sm font-bold text-slate-600">Configuration en cours...</p>
                        <p className="text-xs text-slate-400">Veuillez patienter quelques secondes.</p>
                    </div>
                )}

                {initStatus === 'success' && (
                    <div className="text-center space-y-4">
                        <div className="bg-green-100 text-green-700 p-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2">
                            <CheckCircle className="w-4 h-4" /> Compte créé avec succès !
                        </div>
                        <p className="text-sm text-slate-500">
                            Les identifiants ont été pré-remplis dans le formulaire. Vous pouvez vous connecter.
                        </p>
                        <button 
                            onClick={() => setShowInitModal(false)}
                            className="w-full bg-green-600 text-white py-2 rounded-xl font-bold hover:bg-green-700 transition"
                        >
                            Fermer et se connecter
                        </button>
                    </div>
                )}

                {initStatus === 'error' && (
                    <div className="text-center space-y-4">
                        <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm flex items-start gap-2 text-left">
                            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                            <span>{initMessage}</span>
                        </div>
                        <button 
                            onClick={() => setInitStatus('idle')}
                            className="w-full bg-slate-200 text-slate-700 py-2 rounded-xl font-bold hover:bg-slate-300 transition"
                        >
                            Réessayer
                        </button>
                    </div>
                )}
            </div>
        </div>
       )}
    </div>
  );
};

export default Login;
