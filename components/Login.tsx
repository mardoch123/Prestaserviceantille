
import React, { useState } from 'react';
import { useData } from '../context/DataContext';
import { supabase } from '../utils/supabaseClient';
import { Lock, Loader2, Wand2, X, CheckCircle, AlertTriangle, Users, Briefcase, Copy } from 'lucide-react';

const Login: React.FC = () => {
  const { login, companySettings, addClient, addProvider } = useData();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Loading states for test generation
  const [creatingClient, setCreatingClient] = useState(false);
  const [creatingProvider, setCreatingProvider] = useState(false);

  // États pour la modale d'initialisation
  const [showInitModal, setShowInitModal] = useState(false);
  const [initStatus, setInitStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [initMessage, setInitMessage] = useState('');

  // États pour la modale d'affichage des identifiants (Pop-up)
  const [credentialModal, setCredentialModal] = useState<{ open: boolean, type: string, email: string, pass: string } | null>(null);

  // Check if running on specifically the production domain to hide dev tools
  const isProduction = window.location.origin === 'https://www.outremerfermetures.com/';

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
        // Success: Context will update currentUser, causing App to unmount Login
    } catch (err: any) {
        setError(err.message || 'Échec de la connexion.');
        setLoading(false); // Stop loading on error
    }
  };

  const handleOpenInitModal = () => {
      setShowInitModal(true);
      setInitStatus('idle');
      setInitMessage('');
  };

  const executeCreateAdmin = async () => {
    setInitStatus('loading');
    
    try {
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email: 'admin@presta.com',
            password: 'admin123',
        });

        if (authError && !authError.message.includes("already registered")) {
             throw authError;
        }
        
        let userId = authData.user?.id;
        if (!userId && authError?.message.includes("already registered")) {
             throw new Error("Compte déjà existant. Veuillez vous connecter directement.");
        }

        if (userId) {
            const { error: profileError } = await supabase.from('users').insert({
                id: userId,
                email: 'admin@presta.com',
                name: 'Admin Principal',
                role: 'admin'
            });

            if (profileError && !profileError.message.includes("duplicate key")) {
                throw profileError;
            }
            
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

  const generateTestClient = async () => {
      setCreatingClient(true);
      setError('');
      try {
          const email = `client_${Date.now()}@test.com`;
          const pass = await addClient({
              name: "Client Test",
              city: "Fort-de-France",
              address: "123 Rue de la Liberté",
              phone: "0696 11 22 33",
              email: email,
              pack: "-",
              status: "active",
              since: new Date().toISOString().split('T')[0],
              packsConsumed: 0,
              loyaltyHoursAvailable: 0
          });
          
          if (pass) {
              setCredentialModal({
                  open: true,
                  type: 'Client',
                  email: email,
                  pass: pass
              });
          } else {
              throw new Error("Erreur création client (pas de mot de passe retourné).");
          }
      } catch (err: any) {
          console.error(err);
          setError(err.message || "Impossible de créer le client test.");
      } finally {
          setCreatingClient(false);
      }
  };

  const generateTestProvider = async () => {
      setCreatingProvider(true);
      setError('');
      try {
          const email = `provider_${Date.now()}@test.com`;
          const pass = await addProvider({
              firstName: "Jean",
              lastName: "Testeur",
              email: email,
              phone: "0696 99 88 77",
              specialty: "Ménage",
              status: "Active"
          });
          
          if (pass) {
              setCredentialModal({
                  open: true,
                  type: 'Prestataire',
                  email: email,
                  pass: pass
              });
          } else {
              throw new Error("Erreur création prestataire (pas de mot de passe retourné).");
          }
      } catch (err: any) {
          console.error(err);
          setError(err.message || "Impossible de créer le prestataire test.");
      } finally {
          setCreatingProvider(false);
      }
  };

  const copyCredentials = () => {
      if (credentialModal) {
          navigator.clipboard.writeText(`Email: ${credentialModal.email}\nPass: ${credentialModal.pass}`);
      }
  };

  return (
    <div className="min-h-screen bg-cream-50 flex items-center justify-center relative overflow-hidden">
       <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5"></div>
       <div className="absolute -top-20 -right-20 w-96 h-96 bg-brand-orange/10 rounded-full blur-3xl"></div>
       <div className="absolute -bottom-20 -left-20 w-96 h-96 bg-brand-blue/10 rounded-full blur-3xl"></div>

       <div className="bg-white/80 backdrop-blur-md p-8 rounded-2xl shadow-2xl w-full max-w-md border border-white relative z-10">
          <div className="text-center mb-8">
             <div className="w-32 h-32 mx-auto mb-4 flex items-center justify-center">
                 {companySettings?.logoUrl ? (
                     <img src={companySettings.logoUrl} alt="Logo Entreprise" className="w-full h-full object-contain drop-shadow-md" />
                 ) : (
                     <div className="w-24 h-24 rounded-full bg-white border-4 border-brand-orange flex items-center justify-center shadow-md">
                        <span className="text-brand-blue font-bold text-xs">LOGO</span>
                     </div>
                 )}
             </div>
             <h1 className="text-2xl font-serif font-bold text-slate-800">Espace Connexion</h1>
             <p className="text-slate-500 text-sm mt-2">Accédez à votre tableau de bord</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Email</label>
                  <input 
                    type="email" 
                    required 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-blue focus:border-transparent outline-none transition"
                    placeholder="votre@email.com"
                  />
              </div>
              <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Mot de passe</label>
                  <div className="relative">
                      <input 
                        type="password" 
                        required 
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-blue focus:border-transparent outline-none transition pr-10"
                        placeholder="••••••••"
                      />
                      <Lock className="w-5 h-5 text-slate-400 absolute right-3 top-3.5" />
                  </div>
              </div>

              {error && (
                  <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm flex items-center gap-2 animate-pulse">
                      <AlertTriangle className="w-4 h-4" />
                      {error}
                  </div>
              )}

              <button 
                type="submit" 
                disabled={loading}
                className="w-full bg-brand-blue hover:bg-teal-700 text-white font-bold py-3 rounded-xl shadow-lg transition transform active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed flex justify-center items-center gap-2"
              >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Se connecter"}
              </button>
          </form>

          {/* Development Tools Section - Only shown if not in production */}
          {!isProduction && (
              <div className="mt-8 pt-6 border-t border-slate-200">
                  <p className="text-center text-xs font-bold text-slate-400 mb-4 uppercase tracking-wider">Outils de Développement</p>
                  
                  <div className="grid grid-cols-2 gap-3 mb-3">
                      <button 
                          onClick={generateTestClient} 
                          disabled={creatingClient}
                          className="flex flex-col items-center justify-center p-3 bg-purple-50 text-purple-700 rounded-xl hover:bg-purple-100 transition border border-purple-200"
                      >
                          {creatingClient ? <Loader2 className="w-5 h-5 animate-spin mb-1"/> : <Users className="w-5 h-5 mb-1"/>}
                          <span className="text-xs font-bold">Créer Client Test</span>
                      </button>
                      
                      <button 
                          onClick={generateTestProvider}
                          disabled={creatingProvider} 
                          className="flex flex-col items-center justify-center p-3 bg-orange-50 text-orange-700 rounded-xl hover:bg-orange-100 transition border border-orange-200"
                      >
                          {creatingProvider ? <Loader2 className="w-5 h-5 animate-spin mb-1"/> : <Briefcase className="w-5 h-5 mb-1"/>}
                          <span className="text-xs font-bold">Créer Pro Test</span>
                      </button>
                  </div>

                  <button 
                      onClick={handleOpenInitModal}
                      className="w-full text-xs text-slate-400 hover:text-brand-blue underline flex items-center justify-center gap-1"
                  >
                      <Wand2 className="w-3 h-3" /> Initialiser Admin (Si 1ère fois)
                  </button>
              </div>
          )}
       </div>

       {/* Modale d'initialisation Admin */}
       {showInitModal && (
           <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
               <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 text-center animate-in fade-in zoom-in duration-200">
                   <h3 className="text-lg font-bold text-slate-800 mb-2">Initialisation Admin</h3>
                   <p className="text-sm text-slate-500 mb-6">
                       Cela va créer un compte `admin@presta.com` / `admin123` et configurer les tables de base.
                   </p>
                   
                   {initStatus === 'loading' && <Loader2 className="w-8 h-8 text-brand-blue animate-spin mx-auto mb-4" />}
                   
                   {initStatus === 'success' && (
                       <div className="bg-green-50 text-green-700 p-3 rounded-lg mb-4 flex items-center justify-center gap-2">
                           <CheckCircle className="w-5 h-5" /> Succès !
                       </div>
                   )}

                   {initStatus === 'error' && (
                       <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">
                           {initMessage}
                       </div>
                   )}

                   <div className="flex gap-3 justify-center">
                       <button onClick={() => setShowInitModal(false)} className="px-4 py-2 text-slate-500 hover:bg-slate-100 rounded-lg font-bold text-sm">Fermer</button>
                       {initStatus !== 'success' && (
                           <button onClick={executeCreateAdmin} className="px-4 py-2 bg-brand-blue text-white rounded-lg font-bold text-sm hover:bg-teal-700">Lancer</button>
                       )}
                   </div>
               </div>
           </div>
       )}

       {/* Credential Pop-up Modal */}
       {credentialModal && (
           <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
               <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-300">
                   <div className="bg-green-600 p-6 text-center text-white">
                       <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
                           <CheckCircle className="w-8 h-8 text-white" />
                       </div>
                       <h3 className="text-xl font-bold">Compte Créé !</h3>
                       <p className="text-green-100 text-sm mt-1">{credentialModal.type} ajouté avec succès.</p>
                   </div>
                   
                   <div className="p-6">
                       <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-6 relative group">
                           <button 
                               onClick={copyCredentials}
                               className="absolute top-2 right-2 p-2 text-slate-400 hover:text-brand-blue hover:bg-white rounded-lg transition"
                               title="Copier"
                           >
                               <Copy className="w-4 h-4" />
                           </button>
                           <div className="mb-3">
                               <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Email</p>
                               <p className="font-mono text-slate-800 font-bold break-all select-all">{credentialModal.email}</p>
                           </div>
                           <div>
                               <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Mot de passe</p>
                               <p className="font-mono text-brand-blue font-bold text-lg select-all">{credentialModal.pass}</p>
                           </div>
                       </div>

                       <button 
                           onClick={() => {
                               setCredentialModal(null);
                               setEmail(credentialModal.email);
                               setPassword(credentialModal.pass);
                           }}
                           className="w-full bg-slate-800 text-white py-3 rounded-xl font-bold hover:bg-slate-700 transition shadow-lg"
                       >
                           Utiliser ces identifiants
                       </button>
                   </div>
               </div>
           </div>
       )}
    </div>
  );
};

export default Login;
