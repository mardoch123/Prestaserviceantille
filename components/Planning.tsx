import React, { useState, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { 
    Calendar, 
    Clock, 
    MapPin, 
    User, 
    Plus, 
    ChevronLeft, 
    ChevronRight,
    Search,
    Filter,
    X,
    CheckCircle
} from 'lucide-react';
import { CreateMissionDTO } from '../types';

const initialFormState = {
    clientId: '',
    providerId: '',
    service: 'Ménage Standard',
    date: new Date().toISOString().split('T')[0],
    startTime: '08:00',
    endTime: '10:00',
    recurrence: 'none',
    occurrences: 1
};

const Planning: React.FC = () => {
    const { missions, addMission, clients, providers, refreshData } = useData();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [missionForm, setMissionForm] = useState(initialFormState);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [viewDate, setViewDate] = useState(new Date());
    const [toast, setToast] = useState<{ show: boolean; message: string }>({ show: false, message: '' });

    const showToast = (message: string) => {
        setToast({ show: true, message });
        setTimeout(() => setToast({ show: false, message: '' }), 3000);
    };

    const calculateDuration = (startDate: string, startTime: string, endDate: string, endTime: string) => {
        if (!startDate || !startTime || !endTime) return 0;
        // Assume same day if endDate is empty or same as startDate
        const start = new Date(`${startDate}T${startTime}`);
        const end = new Date(`${endDate || startDate}T${endTime}`);
        const diffMs = end.getTime() - start.getTime();
        return Math.max(0, diffMs / (1000 * 60 * 60));
    };
  
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isSubmitting) return;
        setIsSubmitting(true);
        
        try {
            // Calculate duration based on times and dates
            let duration = calculateDuration(missionForm.date, missionForm.startTime, missionForm.date, missionForm.endTime);
            if (duration <= 0) duration = 1; // Fallback default
  
            // Get client and provider
            const client = clients.find(c => c.id === missionForm.clientId);
            const provider = providers.find(p => p.id === missionForm.providerId);
            
            if (!client) { alert("Client invalide"); setIsSubmitting(false); return; }
  
            // Recurrence Logic
            const startDateObj = new Date(missionForm.date);
            if(isNaN(startDateObj.getTime())) { alert("Date invalide"); setIsSubmitting(false); return; }
  
            const count = missionForm.recurrence === 'none' ? 1 : parseInt(missionForm.occurrences.toString()) || 1;
            
            for (let i = 0; i < count; i++) {
                const currentDate = new Date(startDateObj);
                
                if (missionForm.recurrence === 'weekly') {
                    currentDate.setDate(startDateObj.getDate() + (i * 7));
                } else if (missionForm.recurrence === 'biweekly') {
                    currentDate.setDate(startDateObj.getDate() + (i * 14));
                } else if (missionForm.recurrence === 'monthly') {
                    currentDate.setMonth(startDateObj.getMonth() + i);
                }
  
                const dateStr = currentDate.toISOString().split('T')[0];
  
                await addMission({
                    id: '', // Let Context/DB handle ID generation
                    date: dateStr,
                    startTime: missionForm.startTime,
                    endTime: missionForm.endTime,
                    duration: parseFloat(duration.toFixed(2)),
                    clientId: client.id,
                    clientName: client.name,
                    service: missionForm.service,
                    providerId: provider ? provider.id : null,
                    providerName: provider ? `${provider.firstName} ${provider.lastName}` : 'À assigner',
                    status: 'planned',
                    color: provider ? 'orange' : 'gray'
                });
            }
  
            showToast(count > 1 ? `${count} missions planifiées !` : 'Mission ajoutée avec succès !');
            
            // Refresh data to get real IDs from DB for the newly created missions
            if (refreshData) await refreshData();
  
            setIsModalOpen(false);
            setMissionForm(initialFormState); // Reset form cleanly
  
        } catch (error) {
            console.error("Erreur planning", error);
            alert("Une erreur est survenue lors de la planification.");
        } finally {
            setIsSubmitting(false);
        }
    };

    // Simple list view for now to satisfy component requirements
    const sortedMissions = [...missions].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return (
        <div className="p-8 h-full overflow-y-auto bg-white/40 relative">
             {/* Toast */}
            <div className={`fixed bottom-6 right-6 z-[100] transition-all duration-500 transform ${toast.show ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0 pointer-events-none'}`}>
                <div className="bg-slate-800 text-white px-6 py-4 rounded-lg shadow-2xl flex items-center gap-3 border border-slate-700">
                    <div className="bg-green-500 p-1 rounded-full text-white"><CheckCircle className="w-4 h-4" /></div>
                    <div><h4 className="font-bold text-sm">Succès</h4><p className="text-xs text-slate-300">{toast.message}</p></div>
                </div>
            </div>

            <div className="flex justify-between items-center mb-8">
                <div>
                    <h2 className="text-3xl font-serif font-bold text-slate-800">Planning</h2>
                    <p className="text-sm text-slate-500 mt-1">Gestion des emplois du temps</p>
                </div>
                <button onClick={() => setIsModalOpen(true)} className="bg-brand-blue text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow-sm hover:bg-teal-700 transition">
                    <Plus className="w-4 h-4" /> Nouvelle Mission
                </button>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="font-bold text-slate-700">Vue Liste (Toutes les missions)</h3>
                </div>
                <div className="space-y-4">
                    {sortedMissions.map(m => (
                        <div key={m.id} className="flex items-center p-4 border rounded-lg hover:shadow-md transition bg-white border-slate-100">
                            <div className="flex flex-col items-center justify-center w-16 h-16 bg-blue-50 rounded-lg text-brand-blue mr-4 shrink-0">
                                <span className="text-xs font-bold uppercase">{new Date(m.date).toLocaleString('default', { month: 'short' })}</span>
                                <span className="text-xl font-bold">{new Date(m.date).getDate()}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-start">
                                    <h4 className="font-bold text-slate-800 truncate">{m.clientName}</h4>
                                    <span className={`text-xs px-2 py-1 rounded font-bold ${m.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>{m.status}</span>
                                </div>
                                <p className="text-sm text-slate-600 truncate">{m.service}</p>
                                <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {m.startTime} - {m.endTime} ({m.duration}h)</span>
                                    <span className="flex items-center gap-1"><User className="w-3 h-3" /> {m.providerName || 'Non assigné'}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                    {sortedMissions.length === 0 && <p className="text-center text-slate-400 py-10">Aucune mission planifiée.</p>}
                </div>
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-cream-50">
                            <h3 className="font-bold text-xl text-slate-800">Planifier une Mission</h3>
                            <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full"><X className="w-5 h-5 text-slate-500" /></button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Client</label>
                                <select 
                                    className="w-full p-2 border rounded bg-slate-50"
                                    value={missionForm.clientId}
                                    onChange={e => setMissionForm({...missionForm, clientId: e.target.value})}
                                    required
                                >
                                    <option value="">Sélectionner...</option>
                                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Prestataire</label>
                                <select 
                                    className="w-full p-2 border rounded bg-slate-50"
                                    value={missionForm.providerId}
                                    onChange={e => setMissionForm({...missionForm, providerId: e.target.value})}
                                >
                                    <option value="">À assigner plus tard</option>
                                    {providers.map(p => <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Service</label>
                                <input 
                                    type="text" 
                                    className="w-full p-2 border rounded bg-slate-50" 
                                    value={missionForm.service}
                                    onChange={e => setMissionForm({...missionForm, service: e.target.value})}
                                    required
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Date</label>
                                    <input 
                                        type="date" 
                                        className="w-full p-2 border rounded bg-slate-50"
                                        value={missionForm.date}
                                        onChange={e => setMissionForm({...missionForm, date: e.target.value})}
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Récurrence</label>
                                    <select 
                                        className="w-full p-2 border rounded bg-slate-50"
                                        value={missionForm.recurrence}
                                        onChange={e => setMissionForm({...missionForm, recurrence: e.target.value})}
                                    >
                                        <option value="none">Aucune</option>
                                        <option value="weekly">Hebdomadaire</option>
                                        <option value="biweekly">Bimensuelle</option>
                                        <option value="monthly">Mensuelle</option>
                                    </select>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Début</label>
                                    <input 
                                        type="time" 
                                        className="w-full p-2 border rounded bg-slate-50"
                                        value={missionForm.startTime}
                                        onChange={e => setMissionForm({...missionForm, startTime: e.target.value})}
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Fin</label>
                                    <input 
                                        type="time" 
                                        className="w-full p-2 border rounded bg-slate-50"
                                        value={missionForm.endTime}
                                        onChange={e => setMissionForm({...missionForm, endTime: e.target.value})}
                                        required
                                    />
                                </div>
                            </div>
                            {missionForm.recurrence !== 'none' && (
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Nombre d'occurrences</label>
                                    <input 
                                        type="number" 
                                        className="w-full p-2 border rounded bg-slate-50"
                                        value={missionForm.occurrences}
                                        onChange={e => setMissionForm({...missionForm, occurrences: parseInt(e.target.value)})}
                                        min="2"
                                        max="52"
                                    />
                                </div>
                            )}

                            <button 
                                type="submit" 
                                disabled={isSubmitting}
                                className="w-full bg-brand-blue text-white py-3 rounded-xl font-bold hover:bg-teal-700 transition mt-4"
                            >
                                {isSubmitting ? 'Planification...' : 'Confirmer'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Planning;