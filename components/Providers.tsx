import React, { useState, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { 
    Briefcase, 
    Search, 
    Filter, 
    UserPlus, 
    CheckCircle, 
    X, 
    Edit, 
    Trash2, 
    CheckSquare, 
    Square,
    Phone,
    Mail,
    Star,
    AlertTriangle
} from 'lucide-react';
import { Provider } from '../types';

const Providers: React.FC = () => {
    const { providers, addProvider, updateProvider, deleteProviders } = useData();
    const [searchQuery, setSearchQuery] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [currentEditId, setCurrentEditId] = useState<string | null>(null);
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [toast, setToast] = useState<{ show: boolean; message: string }>({ show: false, message: '' });

    // Form State
    const [providerForm, setProviderForm] = useState({
        firstName: '',
        lastName: '',
        phone: '',
        email: '',
        specialty: 'Polyvalent',
        status: 'Active' as 'Active' | 'Inactive' | 'Passive'
    });

    const location = useLocation();

    // Init from location
    React.useEffect(() => {
        if (location.state) {
            const state = location.state as { filter?: string };
            if (state.filter) setFilterStatus(state.filter);
        }
    }, [location]);

    const showToast = (message: string) => {
        setToast({ show: true, message });
        setTimeout(() => setToast({ show: false, message: '' }), 3000);
    };

    const filteredProviders = useMemo(() => {
        let result = providers;
        if (filterStatus !== 'all') {
            // Case-insensitive match for status 'Active', 'Passive', 'Inactive' vs 'active', 'passive'
            result = result.filter(p => p.status.toLowerCase() === filterStatus.toLowerCase());
        }
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            result = result.filter(p => 
                p.firstName.toLowerCase().includes(query) || 
                p.lastName.toLowerCase().includes(query) ||
                p.specialty.toLowerCase().includes(query)
            );
        }
        return result;
    }, [providers, filterStatus, searchQuery]);

    const toggleSelection = (id: string) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedIds(newSet);
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === filteredProviders.length) setSelectedIds(new Set());
        else setSelectedIds(new Set(filteredProviders.map(p => p.id)));
    };

    const openCreateModal = () => {
        setIsEditMode(false);
        setProviderForm({ firstName: '', lastName: '', phone: '', email: '', specialty: 'Polyvalent', status: 'Active' });
        setIsModalOpen(true);
    };

    const openEditModal = (provider: Provider) => {
        setIsEditMode(true);
        setCurrentEditId(provider.id);
        setProviderForm({
            firstName: provider.firstName,
            lastName: provider.lastName,
            phone: provider.phone,
            email: provider.email,
            specialty: provider.specialty,
            status: provider.status
        });
        setIsModalOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (isEditMode && currentEditId) {
                await updateProvider(currentEditId, providerForm);
                showToast('Prestataire mis à jour avec succès.');
            } else {
                await addProvider(providerForm);
                showToast('Prestataire ajouté. Email de bienvenue envoyé.');
            }
            setIsModalOpen(false);
        } catch (error) {
            alert('Erreur lors de l\'enregistrement.');
        }
    };

    const confirmBulkDelete = () => {
        if (selectedIds.size > 0) setDeleteConfirmOpen(true);
    };

    const executeBulkDelete = async () => {
        await deleteProviders(Array.from(selectedIds));
        setSelectedIds(new Set());
        setDeleteConfirmOpen(false);
        showToast('Prestataires supprimés.');
    };

    return (
        <div className="p-8 h-full overflow-y-auto bg-white/40 relative">
            {/* Toast */}
            <div className={`fixed bottom-6 right-6 z-[100] transition-all duration-500 transform ${toast.show ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0 pointer-events-none'}`}>
                <div className="bg-slate-800 text-white px-6 py-4 rounded-lg shadow-2xl flex items-center gap-3 border border-slate-700">
                    <div className="bg-green-500 p-1 rounded-full text-white"><CheckCircle className="w-4 h-4" /></div>
                    <div><h4 className="font-bold text-sm">Succès</h4><p className="text-xs text-slate-300">{toast.message}</p></div>
                </div>
            </div>

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h2 className="text-3xl font-serif font-bold text-slate-800">Prestataires</h2>
                    <p className="text-sm text-slate-500 mt-1">Gestion de l'équipe</p>
                </div>
                <div className="flex gap-4">
                    {selectedIds.size > 0 && (
                        <button onClick={confirmBulkDelete} className="bg-red-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-bold shadow-sm hover:bg-red-600 transition animate-in fade-in">
                            <Trash2 className="w-4 h-4" /> Supprimer ({selectedIds.size})
                        </button>
                    )}
                    <div className="flex items-center bg-white rounded-lg shadow-sm border border-beige-200 p-1">
                        <Filter className="w-4 h-4 text-slate-400 ml-2 mr-2" />
                        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="bg-transparent text-sm font-bold text-slate-700 p-2 outline-none cursor-pointer">
                            <option value="all">Tous</option>
                            <option value="active">Actifs</option>
                            <option value="passive">Passifs</option>
                            <option value="inactive">Inactifs</option>
                        </select>
                    </div>
                    <button onClick={openCreateModal} className="bg-brand-blue text-white px-4 py-2 rounded-lg flex items-center gap-2 font-bold shadow-sm hover:bg-teal-700 transition">
                        <UserPlus className="w-4 h-4" /> Nouveau
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-cream-50/50">
                    <div className="relative flex-1 max-w-md">
                        <input type="text" placeholder="Rechercher..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 bg-white focus:border-brand-blue outline-none transition-all"/>
                        <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                    </div>
                    <div className="text-sm text-slate-500"><strong>{filteredProviders.length}</strong> prestataire(s)</div>
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
                                <th className="px-6 py-4 font-bold">Nom</th>
                                <th className="px-6 py-4 font-bold">Spécialité</th>
                                <th className="px-6 py-4 font-bold">Statut</th>
                                <th className="px-6 py-4 font-bold">Contact</th>
                                <th className="px-6 py-4 font-bold text-center">Note</th>
                                <th className="px-6 py-4 font-bold text-right">Heures</th>
                                <th className="px-6 py-4 font-bold text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {filteredProviders.length > 0 ? (
                                filteredProviders.map(p => (
                                    <tr key={p.id} className={`hover:bg-cream-50 transition-colors ${selectedIds.has(p.id) ? 'bg-blue-50' : ''}`}>
                                        <td className="px-6 py-4">
                                            <button onClick={() => toggleSelection(p.id)} className="text-slate-400 hover:text-brand-blue">
                                                {selectedIds.has(p.id) ? <CheckSquare className="w-4 h-4 text-brand-blue" /> : <Square className="w-4 h-4" />}
                                            </button>
                                        </td>
                                        <td className="px-6 py-4 font-bold text-slate-700 flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600">
                                                {p.firstName.charAt(0)}{p.lastName.charAt(0)}
                                            </div>
                                            {p.firstName} {p.lastName}
                                        </td>
                                        <td className="px-6 py-4 text-slate-600">{p.specialty}</td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 rounded-full text-xs font-bold border ${p.status === 'Active' ? 'bg-green-100 text-green-700 border-green-200' : p.status === 'Passive' ? 'bg-orange-100 text-orange-700 border-orange-200' : 'bg-red-100 text-red-700 border-red-200'}`}>
                                                {p.status === 'Active' ? 'Actif' : p.status === 'Passive' ? 'Passif' : 'Inactif'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col gap-1 text-xs text-slate-500">
                                                <span className="flex items-center gap-1"><Phone className="w-3 h-3"/> {p.phone}</span>
                                                <span className="flex items-center gap-1"><Mail className="w-3 h-3"/> {p.email}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <div className="flex items-center justify-center gap-1 text-yellow-500 font-bold">
                                                <Star className="w-3 h-3 fill-yellow-500" /> {p.rating}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right font-mono text-slate-600">{p.hoursWorked} h</td>
                                        <td className="px-6 py-4 text-right">
                                            <button 
                                                onClick={() => openEditModal(p)}
                                                className="text-slate-400 hover:text-brand-blue p-1 rounded hover:bg-slate-100"
                                            >
                                                <Edit className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr><td colSpan={8} className="p-8 text-center text-slate-400">Aucun prestataire trouvé.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-cream-50">
                            <div>
                                <h3 className="text-xl font-serif font-bold text-slate-800">{isEditMode ? 'Modifier Prestataire' : 'Nouveau Prestataire'}</h3>
                                <p className="text-xs text-slate-500 mt-1">{isEditMode ? 'Mettre à jour les informations' : "Ajouter un membre à l'équipe"}</p>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full transition">
                                <X className="w-5 h-5 text-slate-500" />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">Prénom</label>
                                    <input required type="text" className="w-full p-2 border rounded bg-slate-50" value={providerForm.firstName} onChange={e => setProviderForm({...providerForm, firstName: e.target.value})} />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">Nom</label>
                                    <input required type="text" className="w-full p-2 border rounded bg-slate-50" value={providerForm.lastName} onChange={e => setProviderForm({...providerForm, lastName: e.target.value})} />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">Téléphone</label>
                                    <input required type="tel" className="w-full p-2 border rounded bg-slate-50" value={providerForm.phone} onChange={e => setProviderForm({...providerForm, phone: e.target.value})} />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">Email</label>
                                    <input required type="email" className="w-full p-2 border rounded bg-slate-50" value={providerForm.email} onChange={e => setProviderForm({...providerForm, email: e.target.value})} />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">Spécialité</label>
                                <select className="w-full p-2 border rounded bg-slate-50" value={providerForm.specialty} onChange={e => setProviderForm({...providerForm, specialty: e.target.value})}>
                                    <option value="Polyvalent">Polyvalent</option>
                                    <option value="Ménage">Ménage</option>
                                    <option value="Jardinage">Jardinage</option>
                                    <option value="Bricolage">Bricolage</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">Statut</label>
                                <select className="w-full p-2 border rounded bg-slate-50" value={providerForm.status} onChange={e => setProviderForm({...providerForm, status: e.target.value as any})}>
                                    <option value="Active">Actif</option>
                                    <option value="Passive">Passif (Congés/Indispo)</option>
                                    <option value="Inactive">Inactif</option>
                                </select>
                            </div>
                            
                            <div className="pt-4 flex justify-end gap-3">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-slate-500 hover:bg-slate-100 rounded font-bold">Annuler</button>
                                <button type="submit" className="px-6 py-2 bg-brand-blue text-white rounded font-bold hover:bg-teal-700 shadow-lg">Enregistrer</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
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