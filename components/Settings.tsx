
import React, { useState, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { Save, Building, Mail, Phone, FileText, Bell, Star, Upload, Loader2, CheckCircle } from 'lucide-react';

const Settings: React.FC = () => {
  const { companySettings, updateCompanySettings } = useData();
  const [form, setForm] = useState(companySettings);
  const [loading, setLoading] = useState(false);

  // Sync form with context if it changes (e.g. after initial load)
  useEffect(() => {
      setForm(companySettings);
  }, [companySettings]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const { name, value, type, checked } = e.target;
      setForm(prev => ({
          ...prev,
          [name]: type === 'checkbox' ? checked : value
      }));
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onloadend = () => {
              // Simulating an upload to storage bucket which returns a URL
              // Here we just store the base64 string as the URL
              setForm(prev => ({ ...prev, logoUrl: reader.result as string }));
          };
          reader.readAsDataURL(file);
      }
  };

  const handleSave = async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);
      try {
          await updateCompanySettings(form);
          alert("Paramètres et Logo enregistrés dans la base de données !");
      } catch (error) {
          alert("Erreur lors de la sauvegarde.");
      } finally {
          setLoading(false);
      }
  };

  return (
    <div className="p-8 h-full overflow-y-auto bg-white/40">
        <div className="mb-8">
            <h2 className="text-3xl font-serif font-bold text-slate-800">Paramètres</h2>
            <p className="text-sm text-slate-500">Configuration générale de l'application et de l'entreprise</p>
        </div>

        <form onSubmit={handleSave} className="max-w-3xl mx-auto space-y-6">
            
            {/* Logo Setting */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <h3 className="text-lg font-bold text-slate-700 mb-4 flex items-center gap-2">
                    <Building className="w-5 h-5 text-brand-blue" /> Identité & Logo
                </h3>
                <div className="flex items-center gap-6 mb-6">
                     <div className="w-24 h-24 border-2 border-dashed border-slate-300 rounded-xl flex items-center justify-center overflow-hidden bg-slate-50 relative group">
                         {form.logoUrl ? (
                             <img src={form.logoUrl} alt="Logo" className="w-full h-full object-contain" />
                         ) : (
                             <span className="text-xs text-slate-400 text-center">Aucun logo</span>
                         )}
                         <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                             <Upload className="w-6 h-6 text-white" />
                         </div>
                     </div>
                     <div className="flex-1">
                         <label className="block text-sm font-bold text-slate-700 mb-2">Logo de l'application</label>
                         <input 
                            type="file" 
                            accept="image/*" 
                            onChange={handleLogoUpload} 
                            className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-brand-blue file:text-white hover:file:bg-blue-700 cursor-pointer"
                         />
                         <p className="text-xs text-slate-400 mt-2">Format recommandé : PNG transparent, carré. (Sera sauvegardé en base de données)</p>
                     </div>
                </div>
                
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-bold text-slate-500 mb-1">Nom de la société</label>
                        <input name="name" value={form.name} onChange={handleChange} className="w-full p-2 border rounded-lg" />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-slate-500 mb-1">Adresse Siège</label>
                        <input name="address" value={form.address} onChange={handleChange} className="w-full p-2 border rounded-lg" />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-slate-500 mb-1">Numéro SIRET / SAP</label>
                        <input name="siret" value={form.siret} onChange={handleChange} className="w-full p-2 border rounded-lg" />
                    </div>
                </div>
            </div>

            {/* Contact Info */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <h3 className="text-lg font-bold text-slate-700 mb-4 flex items-center gap-2">
                    <Mail className="w-5 h-5 text-brand-orange" /> Coordonnées
                </h3>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-bold text-slate-500 mb-1">Email Contact</label>
                        <input name="email" value={form.email} onChange={handleChange} className="w-full p-2 border rounded-lg" />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-slate-500 mb-1">Téléphone</label>
                        <input name="phone" value={form.phone} onChange={handleChange} className="w-full p-2 border rounded-lg" />
                    </div>
                </div>
            </div>
            
            {/* Loyalty Settings */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <h3 className="text-lg font-bold text-slate-700 mb-4 flex items-center gap-2">
                    <Star className="w-5 h-5 text-yellow-500" /> Fidélité Client
                </h3>
                <div>
                    <label className="block text-sm font-bold text-slate-500 mb-1">Heures offertes tous les 10 packs consommés</label>
                    <input 
                        type="number" 
                        name="loyaltyRewardHours" 
                        value={form.loyaltyRewardHours} 
                        onChange={(e) => setForm(prev => ({...prev, loyaltyRewardHours: Number(e.target.value)}))} 
                        className="w-full p-2 border rounded-lg font-bold" 
                        min="0"
                    />
                    <p className="text-xs text-slate-400 mt-2">
                        Le client sera notifié automatiquement lorsqu'il atteint 10 packs.
                    </p>
                </div>
            </div>

            {/* Preferences */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <h3 className="text-lg font-bold text-slate-700 mb-4 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-green-600" /> Préférences Facturation
                </h3>
                <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                        <label className="block text-sm font-bold text-slate-500 mb-1">Taux TVA par défaut (%)</label>
                        <input type="number" name="tvaRateDefault" value={form.tvaRateDefault} onChange={handleChange} className="w-full p-2 border rounded-lg" step="0.1" />
                    </div>
                </div>
                <div className="flex items-center gap-3 pt-2 border-t border-slate-100">
                    <input 
                        type="checkbox" 
                        id="emailNotif" 
                        name="emailNotifications" 
                        checked={form.emailNotifications} 
                        onChange={handleChange}
                        className="w-5 h-5 text-brand-blue rounded"
                    />
                    <label htmlFor="emailNotif" className="text-sm font-bold text-slate-700 flex items-center gap-2">
                        <Bell className="w-4 h-4 text-slate-400" /> Activer les notifications par email (Admin)
                    </label>
                </div>
            </div>

            <div className="flex justify-end">
                <button 
                    type="submit" 
                    disabled={loading}
                    className="bg-brand-blue text-white px-8 py-3 rounded-xl font-bold shadow-lg hover:bg-teal-700 flex items-center gap-2 transition-transform active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />} 
                    {loading ? 'Sauvegarde en cours...' : 'Enregistrer les paramètres'}
                </button>
            </div>

        </form>
    </div>
  );
};

export default Settings;
