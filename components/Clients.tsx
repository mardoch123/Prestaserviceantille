
import React, { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { 
  Users, 
  Filter, 
  Search, 
  UserPlus, 
  Star,
  MapPin,
  Phone,
  X,
  CheckCircle,
  Mail,
  Home,
  Gift,
  Trash2,
  CheckSquare,
  Square,
  AlertTriangle,
  Loader2,
  Edit,
  KeyRound,
  Copy
} from 'lucide-react';

const Clients: React.FC = () => {
  const { clients, addClient, updateClient, deleteClients, addLoyaltyHours } = useData();
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const location = useLocation();

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Modal & Toast State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [currentEditId, setCurrentEditId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [toast, setToast] = useState<{ show: boolean; message: string }>({ show: false, message: '' });
  
  // Loyalty Modal
  const [loyaltyModalOpen, setLoyaltyModalOpen] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [hoursToOffer, setHoursToOffer] = useState(1);
  const [isSaving, setIsSaving] = useState(false);

  // Delete Confirmation
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  // Credential Modal State
  const [newCredential, setNewCredential] = useState<{ email: string, pass: string } | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    lastName: '',
    firstName: '',
    phone: '',
    email: '',
    address: '',
    city: '',
    type: 'particulier'
  });

  useEffect(() => {
    if (location.state) {
        const state = location.state as { filter?: string };
        if (state.filter) setFilterStatus(state.filter);
    }
  }, [location]);

  const filteredClients = useMemo(() => {
    let result = clients;
    if (filterStatus !== 'all') result = result.filter(c => c.status === filterStatus);
    if (searchQuery) {
        const query = searchQuery.toLowerCase();
        result = result.filter(c => c.name.toLowerCase().includes(query) || c.city.toLowerCase().includes(query) || c.phone.includes(query));
    }
    return result;
  }, [clients, filterStatus, searchQuery]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const openCreateModal = () => {
      setIsEditMode(false);
      setCurrentEditId(null);
      setFormData({ lastName: '', firstName: '', phone: '', email: '', address: '', city: '', type: 'particulier' });
      setIsModalOpen(true);
  };

  const openEditModal = (client: any) => {
      setIsEditMode(true);
      setCurrentEditId(client.id);
      const nameParts = client.name.split(' ');
      const lastName = nameParts.pop() || '';
      const firstName = nameParts.join(' ');
      
      setFormData({ 
          lastName, 
          firstName, 
          phone: client.phone, 
          email: client.email, 
          address: client.address, 
          city: client.city, 
          type: 'particulier' 
      });
      setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
        const fullName = `${formData.firstName} ${formData.lastName}`;
        
        if (isEditMode && currentEditId) {
            await updateClient(currentEditId, {
                name: fullName,
                city: formData.city,
                address: formData.address,
                phone: formData.phone,
                email: formData.email
            });
            showToast('Client modifié avec succès.');
            setIsModalOpen(false);
        } else {
            const newPass = await addClient({
                name: fullName,
                city: formData.city,
                address: formData.address,
                phone: formData.phone,
                email: formData.email,
                pack: '-',
                status: 'new',
                since: new Date().toISOString().split('T')[0],
                packsConsumed: 0,
                loyaltyHoursAvailable: 0
            });
            
            setIsModalOpen(false);
            
            if (newPass) {
                setNewCredential({ email: formData.email, pass: newPass });
            } else {
                showToast(`Client créé avec succès ! (Pas d'email envoyé)`);
            }
        }
        setFormData({ lastName: '', firstName: '', phone: '', email: '', address: '', city: '', type: 'particulier' });
    } catch (err: any) {
        alert("Erreur lors de l'enregistrement: " + err.message);
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleOfferHours = async () => {
      if (selectedClientId && hoursToOffer > 0) {
          setIsSaving(true);
          try {
             await addLoyaltyHours(selectedClientId, hoursToOffer);
             setLoyaltyModalOpen(false);
             showToast(`Heures offertes et enregistrées avec succès.`);
             setHoursToOffer(1);
          } catch(e) {
              alert("Erreur sauvegarde.");
          } finally {
              setIsSaving(false);
          }
      }
  };

  const showToast = (message: string) => {
    setToast({ show: true, message });
    setTimeout(() => setToast({ show: false, message: '' }), 3000);
  };

  const showCredentials = (client: any) => {
      alert(`[ACCÈS CLIENT]
      
Client : ${client.name}
Email : ${client.email}
Mot de passe initial : ${client.initialPassword || 'Non disponible (déjà modifié ou inconnu)'}

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
      if (selectedIds.size === filteredClients.length) {
          setSelectedIds(new Set());
      } else {
          setSelectedIds(new Set(filteredClients.map(c => c.id)));
      }
  };

  const confirmBulkDelete = () => {
      if (selectedIds.size > 0) {
          setDeleteConfirmOpen(true);
      }
  };

  const executeBulkDelete = async () => {
      await deleteClients(Array.from(selectedIds));
      setSelectedIds(new Set());
      setDeleteConfirmOpen(false);
      showToast('Clients supprimés avec succès.');
  };

  return (
    <div className="p-8 h-full overflow-y-auto bg-white/40 relative">
       <div className={`fixed bottom-6 right-6 z-[100] transition-all duration-500 transform ${toast.show ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0 pointer-events-none'}`}>
        <div className="bg-slate-800 text-white px-6 py-4 rounded-lg shadow-2xl flex items-center gap-3 border border-slate-700">
            <div className="bg-green-500 p-1 rounded-full text-white"><CheckCircle className="w-4 h-4" /></div>
            <div><h4 className="font-bold text-sm">Succès</h4><p className="text-xs text-slate-300">{toast.message}</p></div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div><h2 className="text-3xl font-serif font-bold text-slate-800">Clients</h2><p className="text-sm text-slate-500 mt-1">Gestion de la base client</p></div>
        <div className="flex gap-4">
           {selectedIds.size > 0 && (
               <button onClick={confirmBulkDelete} className="bg-red-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-bold shadow-sm hover:bg-red-600 transition animate-in fade-in">
                   <Trash2 className="w-4 h-4" /> Supprimer ({selectedIds.size})
               </button>
           )}
           <div className="flex items-center bg-white rounded-lg shadow-sm border border-beige-200 p-1">
            <Filter className="w-4 h-4 text-slate-400 ml-2 mr-2" />
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="bg-transparent text-sm font-bold text-slate-700 p-2 outline-none cursor-pointer">
                <option value="all">Tous les clients</option><option value="active">Clients Actifs</option><option value="new">Nouveaux Clients</option><option value="prospect">Prospects</option>
            </select>
          </div>
          <button onClick={openCreateModal} className="bg-brand-blue text-white px-4 py-2 rounded-lg flex items-center gap-2 font-bold shadow-sm hover:bg-teal-700 transition"><UserPlus className="w-4 h-4" /> Nouveau</button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
         <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-cream-50/50">
            <div className="relative flex-1 max-w-md">
                <input type="text" placeholder="Rechercher par nom, ville..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 bg-white focus:border-brand-blue focus:ring-1 focus:ring-brand-blue outline-none transition-all"/>
                <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            </div>
            <div className="text-sm text-slate-500"><strong>{filteredClients.length}</strong> client(s) trouvé(s)</div>
         </div>

         <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
                <thead className="text-xs text-slate-500 uppercase bg-slate-50/80 border-b border-slate-100">
                    <tr>
                        <th className="px-6 py-4 w-10">
                            <button onClick={toggleSelectAll} className="text-slate-500 hover:text-slate-700">
                                {selectedIds.size > 0 && selectedIds.size === filteredClients.length ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                            </button>
                        </th>
                        <th className="px-6 py-4 font-bold">Nom</th>
                        <th className="px-6 py-4 font-bold">Contact</th>
                        <th className="px-6 py-4 font-bold">Ville</th>
                        <th className="px-6 py-4 font-bold">Abonnement</th>
                        <th className="px-6 py-4 font-bold text-center">Statut</th>
                        <th className="px-6 py-4 font-bold text-right">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                    {filteredClients.length > 0 ? (
                        filteredClients.map(client => (
                            <tr key={client.id} className={`hover:bg-cream-50 transition-colors group ${selectedIds.has(client.id) ? 'bg-blue-50' : ''}`}>
                                <td className="px-6 py-4">
                                    <button onClick={() => toggleSelection(client.id)} className="text-slate-400 hover:text-brand-blue">
                                        {selectedIds.has(client.id) ? <CheckSquare className="w-4 h-4 text-brand-blue" /> : <Square className="w-4 h-4" />}
                                    </button>
                                </td>
                                <td className="px-6 py-4 font-bold text-slate-700 flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs text-slate-600 font-bold">{client.name.charAt(0)}</div>
                                    {client.name}
                                </td>
                                <td className="px-6 py-4 text-slate-600"><div className="flex items-center gap-2"><Phone className="w-3 h-3 text-slate-400" />{client.phone}</div></td>
                                <td className="px-6 py-4 text-slate-600"><div className="flex items-center gap-2"><MapPin className="w-3 h-3 text-slate-400" />{client.city}</div></td>
                                <td className="px-6 py-4">
                                    {client.pack && client.pack !== '-' ? (
                                        <span className="bg-blue-50 text-brand-blue px-2 py-1 rounded text-xs font-bold">
                                            {client.pack}
                                        </span>
                                    ) : (
                                        <span className="text-slate-400 italic">Aucun pack</span>
                                    )}
                                </td>
                                <td className="px-6 py-4 text-center">
                                    {client.status === 'active' && <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-bold border border-green-200">Actif</span>}
                                    {client.status === 'new' && <span className="bg-brand-orange/20 text-brand-orange px-2 py-1 rounded-full text-xs font-bold border border-brand-orange/30 flex items-center justify-center gap-1"><Star className="w-3 h-3" fill="currentColor" /> Nouveau</span>}
                                    {client.status === 'prospect' && <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded-full text-xs font-bold border border-slate-200">Prospect</span>}
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                        <button 
                                            onClick={() => showCredentials(client)}
                                            className="text-purple-600 hover:text-purple-800 text-xs font-bold px-3 py-1 bg-purple-50 border border-purple-200 rounded hover:bg-purple-100 transition"
                                            title="Voir Identifiants"
                                        >
                                            Voir ID
                                        </button>
                                        <button 
                                            onClick={() => openEditModal(client)}
                                            className="text-slate-400 hover:text-brand-blue p-1 rounded hover:bg-slate-100 border border-transparent hover:border-slate-200"
                                            title="Modifier"
                                        >
                                            <Edit className="w-4 h-4" />
                                        </button>
                                        <button 
                                            onClick={() => { setSelectedClientId(client.id); setLoyaltyModalOpen(true); }}
                                            className="text-yellow-500 hover:text-yellow-600 p-1 rounded hover:bg-yellow-50 border border-transparent hover:border-yellow-200"
                                            title="Cadeau Fidélité"
                                        >
                                            <Gift className="w-4 h-4" />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))
                    ) : (
                        <tr><td colSpan={7} className="px-6 py-8 text-center text-slate-400">Aucun client trouvé pour cette recherche.</td></tr>
                    )}
                </tbody>
            </table>
         </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
                <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-cream-50">
                    <div>
                        <h3 className="text-xl font-serif font-bold text-slate-800">{isEditMode ? 'Modifier Client' : 'Nouveau Client'}</h3>
                        <p className="text-xs text-slate-500 mt-1">{isEditMode ? 'Mettre à jour les informations' : 'Ajouter une fiche client'}</p>
                    </div>
                    <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full transition"><X className="w-5 h-5 text-slate-500" /></button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto max-h-[70vh]">
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div><label className="block text-sm font-bold text-slate-700 mb-1">Nom</label><input required type="text" name="lastName" value={formData.lastName} onChange={handleInputChange} className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"/></div>
                            <div><label className="block text-sm font-bold text-slate-700 mb-1">Prénom</label><input required type="text" name="firstName" value={formData.firstName} onChange={handleInputChange} className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"/></div>
                        </div>
                    </div>
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div><label className="block text-sm font-bold text-slate-700 mb-1">Téléphone</label><input required type="tel" name="phone" value={formData.phone} onChange={handleInputChange} className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"/></div>
                            <div><label className="block text-sm font-bold text-slate-700 mb-1">Email</label><input required type="email" name="email" value={formData.email} onChange={handleInputChange} className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"/></div>
                        </div>
                        <div>
                             <label className="block text-sm font-bold text-slate-700 mb-1">Adresse</label>
                             <input type="text" name="address" value={formData.address} onChange={handleInputChange} placeholder="Numéro et voie" className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg mb-2"/>
                             <input required type="text" name="city" value={formData.city} onChange={handleInputChange} placeholder="Ville" className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"/>
                        </div>
                    </div>
                    <div className="pt-4 flex justify-end gap-3">
                        <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-2 rounded-lg text-slate-600 font-bold hover:bg-slate-100 transition">Annuler</button>
                        <button 
                            type="submit" 
                            disabled={isSubmitting}
                            className="px-6 py-2 rounded-lg bg-brand-blue text-white font-bold hover:bg-teal-700 transition shadow-lg shadow-brand-blue/20 flex items-center gap-2 disabled:opacity-50"
                        >
                            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin"/> : <CheckCircle className="w-4 h-4" />} 
                            {isEditMode ? 'Mettre à jour' : 'Enregistrer'}
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
                       <h3 className="text-xl font-bold text-white">Client Créé</h3>
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

      {loyaltyModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
              <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full text-center">
                  <Gift className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-slate-800 mb-2">Cadeau Fidélité</h3>
                  <p className="text-slate-500 text-sm mb-4">Offrir des heures gratuites à ce client.</p>
                  <div className="flex items-center justify-center gap-4 mb-6">
                      <button onClick={() => setHoursToOffer(Math.max(1, hoursToOffer - 1))} className="w-8 h-8 rounded-full bg-slate-100 font-bold">-</button>
                      <span className="text-2xl font-bold text-brand-blue">{hoursToOffer}h</span>
                      <button onClick={() => setHoursToOffer(hoursToOffer + 1)} className="w-8 h-8 rounded-full bg-slate-100 font-bold">+</button>
                  </div>
                  <button onClick={handleOfferHours} disabled={isSaving} className="w-full bg-brand-blue text-white py-2 rounded-lg font-bold flex items-center justify-center gap-2">
                      {isSaving ? <Loader2 className="w-4 h-4 animate-spin"/> : null} 
                      {isSaving ? 'Enregistrement...' : 'Valider le cadeau'}
                  </button>
                  <button onClick={() => setLoyaltyModalOpen(false)} className="mt-2 text-slate-400 text-sm">Annuler</button>
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
                        Êtes-vous sûr de vouloir supprimer {selectedIds.size} client(s) ? Cette action est irréversible.
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

export default Clients;
