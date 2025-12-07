
import React, { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { 
  Filter, 
  Search, 
  UserPlus, 
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  X,
  Phone,
  CalendarX,
  Trash2,
  CheckSquare,
  Square,
  AlertTriangle,
  Mail,
  Edit,
  KeyRound,
  Loader2
} from 'lucide-react';

// Extended List of Specialties
const PROVIDER_SPECIALTIES = [
    "Ménage / Entretien",
    "Jardinage",
    "Bricolage",
    "Plomberie",
    "Électricité",
    "Peinture",
    "Climatisation",
    "Piscine / Entretien Bassin",
    "Maçonnerie",
    "Menuiserie",
    "Serrurerie",
    "Aide à domicile (Personnes âgées)",
    "Garde d'enfants",
    "Soutien scolaire",
    "Assistance administrative",
    "Informatique / Numérique",
    "Coiffure à domicile",
    "Esthétique à domicile",
    "Livraison de repas",
    "Déménagement",
    "Gardiennage",
    "Autre"
];

const Providers: React.FC = () => {
  const { providers, addProvider, updateProvider, deleteProviders, addLeave, resetProviderPassword } = useData();
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const location = useLocation();

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [currentEditId, setCurrentEditId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [selectedProviderId, setSelectedProviderId] = useState<string>('');
  
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  
  const [toast, setToast] = useState<{ show: boolean; message: string }>({ show: false, message: '' });

  // Credential Modal State
  const [newCredential, setNewCredential] = useState<{ email: string, pass: string } | null>(null);

  const [formData, setFormData] = useState({
    lastName: '',
    firstName: '',
    specialty: 'Ménage / Entretien',
    phone: '',
    email: '',
    status: 'Active'
  });

  const [leaveForm, setLeaveForm] = useState({
      startDate: '',
      endDate: ''
  });

  useEffect(() => {
    if (location.state) {
        const state = location.state as { filter?: string };
        if (state.filter) setFilterStatus(state.filter);
    }
  }, [location]);

  const filteredProviders = useMemo(() => {
    let result = providers;
    if (filterStatus !== 'all') {
        result = result.filter(p => p.status.toLowerCase() === filterStatus.toLowerCase());
    }
    if (searchQuery) {
        const query = searchQuery.toLowerCase();
        result = result.filter(p => 
            p.lastName.toLowerCase().includes(query) || 
            p.firstName.toLowerCase().includes(query) ||
            p.specialty.toLowerCase().includes(query)
        );
    }
    return result;
  }, [providers, filterStatus, searchQuery]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const openCreateModal = () => {
      setIsEditMode(false);
      setCurrentEditId(null);
      setFormData({ lastName: '', firstName: '', specialty: 'Ménage / Entretien', phone: '', email: '', status: 'Active' });
      setIsModalOpen(true);
  };

  const openEditModal = (provider: any) => {
      setIsEditMode(true);
      setCurrentEditId(provider.id);
      setFormData({
          lastName: provider.lastName,
          firstName: provider.firstName,
          specialty: provider.specialty,
          phone: provider.phone,
          email: provider.email,
          status: provider.status
      });
      setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setIsSubmitting(true);
      
      try {
          if (isEditMode && currentEditId) {
              await updateProvider(currentEditId, {
                  lastName: formData.lastName,
                  firstName: formData.firstName,
                  specialty: formData.specialty,
                  phone: formData.phone,
                  email: formData.email,
                  status: formData.status as any
              });
              showToast(`Fiche de ${formData.firstName} ${formData.lastName} mise à jour.`);
              setIsModalOpen(false);
          } else {
              // Creating new provider
              const newPass = await addProvider({
                  lastName: formData.lastName,
                  firstName: formData.firstName,
                  specialty: formData.specialty,
                  phone: formData.phone,
                  email: formData.email,
                  status: formData.status as 'Active',
              });
              
              setIsModalOpen(false);
              
              if (newPass) {
                  // Open the credential modal
                  setNewCredential({ email: formData.email, pass: newPass });
              } else {
                  showToast(`Prestataire créé avec succès ! (Pas d'email envoyé)`);
              }
          }
          // Reset form
          setFormData({ lastName: '', firstName: '', specialty: 'Ménage / Entretien', phone: '', email: '', status: 'Active' });
      } catch (error) {
          console.error("Erreur soumission prestataire:", error);
          showToast("Une erreur est survenue.");
      } finally {
          setIsSubmitting(false);
      }
  };

  const handleLeaveSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (selectedProviderId && leaveForm.startDate && leaveForm.endDate) {
          addLeave(selectedProviderId, leaveForm.startDate, leaveForm.endDate);
          setIsLeaveModalOpen(false);
          showToast('Congés déclarés avec succès. Le planning sera mis à jour.');
          setLeaveForm({ startDate: '', endDate: '' });
      }
  };

  const handleResetPassword = (id: string) => {
      if(window.confirm("Êtes-vous sûr de vouloir réinitialiser le mot de passe de ce prestataire ?")) {
          resetProviderPassword(id);
          showToast('Mot de passe réinitialisé et envoyé par email.');
      }
  };

  const showToast = (message: string) => {
    setToast({ show: true, message });
    setTimeout(() => setToast({ show: false, message: '' }), 3000);
  };

  const openLeaveModal = (id: string) => {
      setSelectedProviderId(id);
      setIsLeaveModalOpen(true);
  };

  const showCredentials = (provider: any) => {
      alert(`[ACCÈS PRESTATAIRE]
      
Intervenant : ${provider.firstName} ${provider.lastName}
Email : ${provider.email}
Mot de passe initial : ${provider.initialPassword || 'Non disponible (déjà modifié ou inconnu)'}

Lien de connexion : https://presta-antilles.app/login`);
  };

  const toggleSelection = (id: string) => {
      const newSet = new Set(selectedIds);
      if (newSet.has(id)) {
          newSet.delete(id);
      } else {
          newSet.add(id);
      }
      setSelectedIds(newSet);
  };

  const toggleSelectAll = () => {
      if (selectedIds.size === filteredProviders.length) {
          setSelectedIds(new Set());
      } else {
          setSelectedIds(new Set(filteredProviders.map(p => p.id)));
      }
  };

  const confirmBulkDelete = () => {
      if (selectedIds.size > 0) {
          setDeleteConfirmOpen(true);
      }
  };

  const executeBulkDelete = async () => {
      await deleteProviders(Array.from(selectedIds));
      setSelectedIds(new Set());
      setDeleteConfirmOpen(false);
      showToast('Prestataires supprimés avec succès.');
  };

  return (
    <div className="p-8 h-full overflow-y-auto bg-white/40 relative">
      
       <div className={`fixed bottom-6 right-6 z-[100] transition-all duration-500 transform ${toast.show ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0 pointer-events-none'}`}>
        <div className="bg-slate-800 text-white px-6 py-4 rounded-lg shadow-2xl flex items-center gap-3 border border-slate-700">
            <div className="bg-green-500 p-1 rounded-full text-white">
                <CheckCircle className="w-4 h-4" />
            </div>
            <div>
                <h4 className="font-bold text-sm">Succès</h4>
                <p className="text-xs text-slate-300">{toast.message}</p>
            </div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h2 className="text-3xl font-serif font-bold text-slate-800">Prestataires</h2>
          <p className="text-sm text-slate-500 mt-1">Suivi des équipes et heures travaillées</p>
        </div>
        
        <div className="flex gap-4">
            {selectedIds.size > 0 && (
               <button onClick={confirmBulkDelete} className="bg-red-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-bold shadow-sm hover:bg-red-600 transition animate-in fade-in">
                   <Trash2 className="w-4 h-4" /> Supprimer ({selectedIds.size})
               </button>
            )}
           <div className="flex items-center bg-white rounded-lg shadow-sm border border-beige-200 p-1">
            <Filter className="w-4 h-4 text-slate-400 ml-2 mr-2" />
            <select 
                value={filterStatus} 
                onChange={(e) => setFilterStatus(e.target.value)}
                className="bg-transparent text-sm font-bold text-slate-700 p-2 outline-none cursor-pointer"
            >
                <option value="all">Tous</option>
                <option value="active">Actifs</option>
                <option value="passive">Passifs</option>
                <option value="inactive">Inactifs</option>
            </select>
          </div>
          <button 
            onClick={openCreateModal}
            className="bg-brand-blue text-white px-4 py-2 rounded-lg flex items-center gap-2 font-bold shadow-sm hover:bg-teal-700 transition"
          >
              <UserPlus className="w-4 h-4" /> Ajouter
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
         <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-cream-50/50">
            <h3 className="font-bold text-slate-700">Liste des intervenants</h3>
            <div className="relative w-64">
                <input 
                    type="text" 
                    placeholder="Nom, spécialité..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 bg-white focus:border-brand-blue focus:ring-1 focus:ring-brand-blue outline-none"
                />
                <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            </div>
         </div>

         <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
                <thead className="text-xs text-slate-500 uppercase bg-slate-50/80 border-b border-slate-100">
                    <tr>
                        <th className="px-6 py-4 w-10">
                            <button onClick={toggleSelectAll} className="text-slate-500 hover:text-slate-700">
                                {selectedIds.size > 0 && selectedIds.size === filteredProviders.length ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                            </button>
                        </th>
                        <th className="px-6 py-4 font-bold">Prestataire</th>
                        <th className="px-6 py-4 font-bold">Contact</th>
                        <th className="px-6 py-4 font-bold">Spécialité</th>
                        <th className="px-6 py-4 font-bold text-center">Heures (Mois)</th>
                        <th className="px-6 py-4 font-bold text-center">Statut</th>
                        <th className="px-6 py-4 font-bold text-right">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                    {filteredProviders.length > 0 ? (
                        filteredProviders.map(p => (
                            <tr key={p.id} className={`hover:bg-cream-50 transition-colors group ${selectedIds.has(p.id) ? 'bg-blue-50' : ''}`}>
                                <td className="px-6 py-4">
                                    <button onClick={() => toggleSelection(p.id)} className="text-slate-400 hover:text-brand-blue">
                                        {selectedIds.has(p.id) ? <CheckSquare className="w-4 h-4 text-brand-blue" /> : <Square className="w-4 h-4" />}
                                    </button>
                                </td>
                                <td className="px-6 py-4 font-bold text-slate-700">
                                    {p.firstName} {p.lastName}
                                    {p.leaves.length > 0 && <span className="ml-2 text-[10px] bg-yellow-100 text-yellow-800 px-1 rounded">Congés déclarés</span>}
                                </td>
                                <td className="px-6 py-4 text-slate-600">
                                    <div className="flex flex-col text-xs">
                                        <span className="flex items-center gap-1"><Phone className="w-3 h-3 text-slate-400"/> {p.phone}</span>
                                        <span className="flex items-center gap-1"><Mail className="w-3 h-3 text-slate-400"/> {p.email}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-slate-600">
                                    <span className="bg-slate-100 px-2 py-1 rounded text-xs font-medium">{p.specialty}</span>
                                </td>
                                <td className="px-6 py-4 text-center">
                                    <div className="flex items-center justify-center gap-2 font-mono text-slate-600">
                                        <Clock className="w-3 h-3 text-slate-400" />
                                        {p.hoursWorked}h
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-center">
                                    {p.status === 'Active' && <span className="inline-flex items-center gap-1 text-xs font-bold text-green-700 bg-green-100 px-2 py-1 rounded-full border border-green-200"><CheckCircle className="w-3 h-3"/> Actif</span>}
                                    {p.status === 'Passive' && <span className="inline-flex items-center gap-1 text-xs font-bold text-orange-700 bg-orange-100 px-2 py-1 rounded-full border border-orange-200"><AlertCircle className="w-3 h-3"/> Passif</span>}
                                    {p.status === 'Inactive' && <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-full border border-slate-200"><XCircle className="w-3 h-3"/> Inactif</span>}
                                </td>
                                <td className="px-6 py-4 text-right flex justify-end gap-2">
                                    <button 
                                        onClick={() => showCredentials(p)}
                                        className="text-purple-600 hover:text-purple-800 text-xs font-bold px-3 py-1 bg-purple-50 border border-purple-200 rounded hover:bg-purple-100 transition" 
                                        title="Voir Identifiants"
                                    >
                                        Voir ID
                                    </button>
                                    <button 
                                        onClick={() => openEditModal(p)}
                                        className="text-slate-400 hover:text-brand-blue p-1 rounded hover:bg-slate-100 border border-transparent hover:border-slate-200" 
                                        title="Modifier"
                                    >
                                        <Edit className="w-4 h-4" />
                                    </button>
                                    <button 
                                        onClick={() => handleResetPassword(p.id)}
                                        className="text-slate-400 hover:text-brand-orange p-1 rounded hover:bg-slate-100 border border-transparent hover:border-slate-200" 
                                        title="Réinitialiser Mot de Passe"
                                    >
                                        <KeyRound className="w-4 h-4" />
                                    </button>
                                    <button 
                                        onClick={() => openLeaveModal(p.id)} 
                                        className="text-slate-500 hover:text-brand-orange font-bold text-xs border border-slate-200 rounded px-2 py-1 flex items-center gap-1"
                                    >
                                        <CalendarX className="w-3 h-3" /> Congés
                                    </button>
                                </td>
                            </tr>
                        ))
                    ) : (
                        <tr>
                            <td colSpan={7} className="px-6 py-8 text-center text-slate-400">
                                Aucun prestataire trouvé.
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
         </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
                <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-cream-50">
                    <div>
                        <h3 className="text-xl font-serif font-bold text-slate-800">{isEditMode ? 'Modifier Prestataire' : 'Nouveau Prestataire'}</h3>
                        <p className="text-xs text-slate-500 mt-1">{isEditMode ? 'Mettre à jour les informations' : "Ajouter un membre à l'équipe"}</p>
                    </div>
                    <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full transition">
                        <X className="w-5 h-5 text-slate-500" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                     <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1">Nom</label>
                            <input 
                                required
                                type="text" 
                                name="lastName"
                                value={formData.lastName}
                                onChange={handleInputChange}
                                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg focus:border-brand-blue focus:ring-1 focus:ring-brand-blue outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1">Prénom</label>
                            <input 
                                required
                                type="text" 
                                name="firstName"
                                value={formData.firstName}
                                onChange={handleInputChange}
                                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg focus:border-brand-blue focus:ring-1 focus:ring-brand-blue outline-none"
                            />
                        </div>
                    </div>
                    
                    <div>
                         <label className="block text-sm font-bold text-slate-700 mb-1">Spécialité</label>
                         <select 
                            name="specialty"
                            value={formData.specialty}
                            onChange={handleInputChange}
                            className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg focus:border-brand-blue focus:ring-1 focus:ring-brand-blue outline-none"
                         >
                             {PROVIDER_SPECIALTIES.map(specialty => (
                                 <option key={specialty} value={specialty}>{specialty}</option>
                             ))}
                         </select>
                    </div>

                     <div className="grid grid-cols-2 gap-4">
                         <div>
                             <label className="block text-sm font-bold text-slate-700 mb-1 flex items-center gap-2">
                                <Phone className="w-3 h-3 text-slate-400" /> Mobile
                             </label>
                             <input 
                                required
                                type="tel" 
                                name="phone"
                                value={formData.phone}
                                onChange={handleInputChange}
                                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg focus:border-brand-blue focus:ring-1 focus:ring-brand-blue outline-none"
                             />
                        </div>
                        <div>
                             <label className="block text-sm font-bold text-slate-700 mb-1 flex items-center gap-2">
                                <Mail className="w-3 h-3 text-slate-400" /> Email (Obligatoire)
                             </label>
                             <input 
                                required
                                type="email" 
                                name="email"
                                value={formData.email}
                                onChange={handleInputChange}
                                placeholder="Pour envoi identifiants"
                                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg focus:border-brand-blue focus:ring-1 focus:ring-brand-blue outline-none"
                             />
                        </div>
                    </div>

                    {isEditMode && (
                        <div>
                             <label className="block text-sm font-bold text-slate-700 mb-1">Statut</label>
                             <select 
                                name="status"
                                value={formData.status}
                                onChange={handleInputChange}
                                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"
                             >
                                 <option value="Active">Actif</option>
                                 <option value="Passive">Passif</option>
                                 <option value="Inactive">Inactif</option>
                             </select>
                        </div>
                    )}

                     <div className="pt-4 flex justify-end gap-3">
                        <button 
                            type="button"
                            onClick={() => setIsModalOpen(false)}
                            className="px-6 py-2 rounded-lg text-slate-600 font-bold hover:bg-slate-100 transition"
                            disabled={isSubmitting}
                        >
                            Annuler
                        </button>
                        <button 
                            type="submit"
                            disabled={isSubmitting}
                            className="px-6 py-2 rounded-lg bg-brand-blue text-white font-bold hover:bg-teal-700 transition shadow-lg shadow-brand-blue/20 flex items-center gap-2 disabled:opacity-70"
                        >
                            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin"/> : <CheckCircle className="w-4 h-4" />} 
                            {isEditMode ? 'Enregistrer' : 'Ajouter & Envoyer ID'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
      )}

      {/* Credential Pop-up */}
      {newCredential && (
           <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
               <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden animate-in fade-in zoom-in duration-200">
                   <div className="bg-green-600 p-4 text-center">
                       <CheckCircle className="w-12 h-12 text-white mx-auto mb-2" />
                       <h3 className="text-xl font-bold text-white">Prestataire Créé</h3>
                   </div>
                   <div className="p-6">
                       <p className="text-sm text-slate-600 mb-4 text-center">
                           Voici les identifiants générés pour ce nouveau compte :
                       </p>
                       <div className="bg-slate-100 p-4 rounded-lg border border-slate-200 space-y-3">
                           <div>
                               <span className="text-xs font-bold text-slate-500 uppercase block">Email</span>
                               <span className="text-sm font-mono text-slate-800 font-bold break-all">{newCredential.email}</span>
                           </div>
                           <div>
                               <span className="text-xs font-bold text-slate-500 uppercase block">Mot de passe initial</span>
                               <span className="text-lg font-mono text-brand-blue font-bold tracking-wider">{newCredential.pass}</span>
                           </div>
                       </div>
                       <button 
                           onClick={() => setNewCredential(null)}
                           className="w-full mt-6 bg-slate-800 text-white py-3 rounded-xl font-bold hover:bg-slate-700 transition"
                       >
                           Fermer
                       </button>
                   </div>
               </div>
           </div>
      )}

      {isLeaveModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
                <div className="p-6 border-b border-slate-100 bg-cream-50">
                    <h3 className="text-xl font-serif font-bold text-slate-800">Déclarer Congés</h3>
                </div>
                <form onSubmit={handleLeaveSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">Date Début</label>
                        <input type="date" required className="w-full p-2 border rounded" value={leaveForm.startDate} onChange={e => setLeaveForm({...leaveForm, startDate: e.target.value})} />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">Date Fin</label>
                        <input type="date" required className="w-full p-2 border rounded" value={leaveForm.endDate} onChange={e => setLeaveForm({...leaveForm, endDate: e.target.value})} />
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                         <button type="button" onClick={() => setIsLeaveModalOpen(false)} className="px-4 py-2 rounded text-slate-600 font-bold">Annuler</button>
                         <button type="submit" className="px-4 py-2 rounded bg-brand-orange text-white font-bold">Valider</button>
                    </div>
                </form>
            </div>
          </div>
      )}

      {deleteConfirmOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm animate-in fade-in zoom-in duration-200">
                <div className="flex flex-col items-center text-center">
                    <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-4">
                        <AlertTriangle className="w-6 h-6" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-800 mb-2">Confirmer la suppression</h3>
                    <p className="text-sm text-slate-500 mb-6">
                        Êtes-vous sûr de vouloir supprimer {selectedIds.size} prestataire(s) ? Cette action est irréversible.
                    </p>
                    <div className="flex gap-3 w-full">
                        <button 
                            onClick={() => setDeleteConfirmOpen(false)}
                            className="flex-1 py-2 text-slate-600 font-bold bg-slate-100 hover:bg-slate-200 rounded-lg transition"
                        >
                            Annuler
                        </button>
                        <button 
                            onClick={executeBulkDelete}
                            className="flex-1 py-2 text-white font-bold bg-red-600 hover:bg-red-700 rounded-lg transition shadow-md"
                        >
                            Supprimer
                        </button>
                    </div>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default Providers;
