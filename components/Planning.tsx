
import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Plus, X, CheckCircle, User, AlertCircle, Search, Mail, Repeat, Trash2, CheckSquare, Square, AlertTriangle, Loader2, Calendar, Bell, Flag } from 'lucide-react';
import { useData } from '../context/DataContext'; 
import { Mission } from '../types';
import { useNavigate } from 'react-router-dom';

const Planning: React.FC = () => {
  const { missions, providers, clients, addMission, assignProvider, deleteMissions, refreshData, reminders, addReminder, toggleReminder } = useData(); 
  const navigate = useNavigate();

  // Filter State
  const [selectedProvider, setSelectedProvider] = useState<string>('all');
  const [currentWeekOffset, setCurrentWeekOffset] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal & Toast
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isReminderModalOpen, setIsReminderModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<{ show: boolean; message: string }>({ show: false, message: '' });

  // Selection State for Unassigned Missions
  const [selectedMissionId, setSelectedMissionId] = useState<string | null>(null);
  const [assignProviderId, setAssignProviderId] = useState<string>('');
  
  // BULK DELETE STATE
  const [selectedMissionIds, setSelectedMissionIds] = useState<Set<string>>(new Set());
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  // Form State - Mission
  const initialFormState = {
      clientId: '',
      service: '',
      providerId: '',
      date: '',
      startTime: '09:00',
      endTime: '11:00',
      endDate: '', // Optionnel si différent
      recurrence: 'none',
      occurrences: 1
  };
  const [missionForm, setMissionForm] = useState(initialFormState);

  // Form State - Reminder
  const [reminderForm, setReminderForm] = useState({
      text: '',
      date: new Date().toISOString().split('T')[0],
      notifyEmail: true
  });

  // Calculate Week Date Range
  const getWeekRange = (offset: number) => {
      const curr = new Date(); 
      const day = curr.getDay() || 7; 
      const first = curr.getDate() - day + 1 + (offset * 7);
      
      const firstDay = new Date(curr.setDate(first));
      const lastDay = new Date(curr.setDate(first + 6));
      
      return { start: firstDay, end: lastDay };
  };

  const { start: weekStart, end: weekEnd } = getWeekRange(currentWeekOffset);

  // Format date range for display
  const dateRangeString = `Du ${weekStart.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })} au ${weekEnd.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}`;

  // Filter Logic (Missions & Reminders)
  const { filteredMissions, filteredReminders } = useMemo(() => {
      const startStr = weekStart.toISOString().split('T')[0];
      const endStr = weekEnd.toISOString().split('T')[0];
      
      // Missions
      let fMissions = missions.filter(m => m.date >= startStr && m.date <= endStr);
      if (selectedProvider !== 'all') {
          fMissions = fMissions.filter(item => item.providerName === selectedProvider);
      }
      if (searchQuery) {
          const query = searchQuery.toLowerCase();
          fMissions = fMissions.filter(item => 
              item.clientName.toLowerCase().includes(query) ||
              (item.providerName && item.providerName.toLowerCase().includes(query)) ||
              item.service.toLowerCase().includes(query)
          );
      }

      // Reminders (Only for the week view, no provider filter usually, unless tagged)
      let fReminders = reminders.filter(r => r.date >= startStr && r.date <= endStr);
      
      return { filteredMissions: fMissions, filteredReminders: fReminders };
  }, [missions, reminders, selectedProvider, currentWeekOffset, searchQuery, weekStart, weekEnd]);

  // Stats Logic
  const today = new Date().toISOString().split('T')[0];
  const missionsCountToday = missions.filter(m => m.date === today).length; 
  const missionsCountWeek = filteredMissions.length; 
  const missionsCompletedWeek = filteredMissions.filter(m => m.status === 'completed').length;

  const totalHoursToday = missions
      .filter(m => m.date === today)
      .reduce((acc, m) => acc + m.duration, 0);

  const totalHoursFiltered = filteredMissions
      .reduce((acc, m) => acc + m.duration, 0);


  const handlePrevWeek = () => setCurrentWeekOffset(prev => prev - 1);
  const handleNextWeek = () => setCurrentWeekOffset(prev => prev + 1);
  const handleCurrentWeek = () => setCurrentWeekOffset(0);

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const { name, value } = e.target;
      setMissionForm(prev => ({ ...prev, [name]: value }));
  };

  const calculateDuration = (startDate: string, startTime: string, endDate: string, endTime: string) => {
      const start = new Date(`${startDate}T${startTime}`);
      const end = new Date(`${endDate}T${endTime}`);
      const diffMs = end.getTime() - start.getTime();
      return diffMs > 0 ? diffMs / (1000 * 60 * 60) : 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (isSubmitting) return; // Prevent double submit
      setIsSubmitting(true);
      
      try {
          // Use endDate or fallback to date
          const finalEndDate = missionForm.endDate || missionForm.date;
          
          // Calculate duration based on full date/times
          let duration = calculateDuration(missionForm.date, missionForm.startTime, finalEndDate, missionForm.endTime);
          if (duration <= 0) duration = 1; // Fallback default

          // Get client and provider
          const client = clients.find(c => c.id === missionForm.clientId);
          const provider = providers.find(p => p.id === missionForm.providerId);
          
          if (!client) { throw new Error("Client invalide"); }

          // Recurrence Logic
          const startDateObj = new Date(missionForm.date);
          if(isNaN(startDateObj.getTime())) { throw new Error("Date invalide"); }

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
                  id: '', // Context will handle ID generation (or UUID)
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
          if (refreshData) {
              const timeout = new Promise<void>((resolve) => setTimeout(() => resolve(), 3000));
              await Promise.race([refreshData(), timeout]);
          }

          setIsModalOpen(false);
          setMissionForm(initialFormState); // Reset form cleanly

      } catch (error: any) {
          console.error("Erreur planning", error);
          alert("Une erreur est survenue : " + error.message);
      } finally {
          setIsSubmitting(false); // CRITICAL: Always reset submitting state
      }
  };

  const handleReminderSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!reminderForm.text || !reminderForm.date) return;
      setIsSubmitting(true);
      try {
          await addReminder({
              id: '', 
              text: reminderForm.text,
              date: reminderForm.date,
              notifyEmail: reminderForm.notifyEmail,
              completed: false
          });
          showToast('Rappel ajouté à l\'agenda !');
          setIsReminderModalOpen(false);
          setReminderForm({ text: '', date: new Date().toISOString().split('T')[0], notifyEmail: true });
      } catch (err) {
          console.error(err);
          alert("Erreur ajout rappel");
      } finally {
          setIsSubmitting(false);
      }
  };

  const showToast = (message: string) => {
      setToast({ show: true, message });
      setTimeout(() => setToast({ show: false, message: '' }), 3000);
  };

  const isProviderAvailable = (providerId: string, dateStr: string, startTime: string = '00:00', endTime: string = '23:59') => {
      const provider = providers.find(p => p.id === providerId);
      if (!provider) return false;
      
      const missionStart = new Date(`${dateStr}T${startTime}`);
      const missionEnd = new Date(`${dateStr}T${endTime}`);
      
      for (const leave of provider.leaves) {
          // Skip if rejected
          if (leave.status === 'rejected') continue;

          // Default full day if times missing
          const lStartTime = leave.startTime || '00:00';
          const lEndTime = leave.endTime || '23:59';

          const leaveStart = new Date(`${leave.startDate}T${lStartTime}`);
          const leaveEnd = new Date(`${leave.endDate}T${lEndTime}`);
          
          // Check overlap
          // Overlap condition: (StartA < EndB) and (EndA > StartB)
          if (missionStart < leaveEnd && missionEnd > leaveStart) {
              return false;
          }
      }
      return true;
  };

  const handleConfirmAssignment = async () => {
      if (selectedMissionId && assignProviderId) {
          const mission = missions.find(m => m.id === selectedMissionId);
          const provider = providers.find(p => p.id === assignProviderId);
          
          if (mission && provider) {
              // Ensure we are using valid IDs from refreshed data
              await assignProvider(mission.id, provider.id, `${provider.firstName} ${provider.lastName}`);
              
              showToast(`Prestataire assigné ! Email envoyé.`);
              if (refreshData) await refreshData();
              
              // Reset states
              setSelectedMissionId(null);
              setAssignProviderId('');
          }
      }
  };
  
  // BULK DELETE
  const toggleMissionSelection = (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      const newSet = new Set(selectedMissionIds);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      setSelectedMissionIds(newSet);
  };
  
  const confirmBulkDeleteMissions = () => {
       if (selectedMissionIds.size > 0) {
           setDeleteConfirmOpen(true);
       }
  };

  const executeBulkDeleteMissions = async () => {
       await deleteMissions(Array.from(selectedMissionIds));
       setSelectedMissionIds(new Set());
       setDeleteConfirmOpen(false);
       if (refreshData) await refreshData();
       showToast('Missions supprimées de la base de données.');
  };

  const unassignedMissions = missions.filter(m => (!m.providerId || m.providerId === 'null') && m.status !== 'cancelled');
  const missionToAssign = missions.find(m => m.id === selectedMissionId) || unassignedMissions.find(m => m.id === selectedMissionId) || null;

  const getDayIndex = (dateStr: string) => {
      const d = new Date(dateStr);
      const day = d.getDay(); 
      return day === 0 ? 5 : day - 1; // Correct mapping for Monday start
  };

  // Interaction Handlers for Stats Cards - Navigating to Statistics Page with Filters
  const handleStatClick = (filter: 'planned' | 'completed' | 'all', time: 'day' | 'week') => {
      navigate('/statistics', { state: { filter, time } });
  };

  return (
    <div className="p-4 md:p-8 h-full overflow-y-auto bg-white/40 flex flex-col relative">
       
       {/* Toast Notification */}
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

      <div className="flex justify-between items-end mb-6">
           <div className="flex items-center gap-4">
               <h2 className="text-3xl font-serif font-bold text-slate-800">Planning</h2>
               {selectedMissionIds.size > 0 && (
                   <button onClick={confirmBulkDeleteMissions} className="bg-red-500 text-white px-3 py-1.5 rounded-lg flex items-center gap-2 font-bold shadow-sm hover:bg-red-600 transition animate-in fade-in">
                       <Trash2 className="w-4 h-4" /> Supprimer ({selectedMissionIds.size})
                   </button>
               )}
           </div>
           
           {/* Date Range Display */}
           <div className="hidden md:block bg-white px-4 py-2 rounded-lg shadow-sm border border-slate-200 text-sm font-bold text-slate-600">
               {dateRangeString}
           </div>
      </div>

       {/* Stats - Interactive Cards */}
       <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
           <div 
                onClick={() => handleStatClick('planned', 'day')}
                className="bg-slate-100 p-4 rounded-none flex flex-col items-center justify-center border-l-4 border-slate-300 cursor-pointer hover:bg-slate-200 transition"
                title="Voir le détail du jour dans Statistiques"
           >
               <span className="font-bold text-slate-800">Missions en cours</span>
               <span className="text-brand-blue font-serif text-xl italic mt-1">{missionsCountToday}</span>
               <span className="text-xs text-teal-500 mt-1 italic">Nombre du jour</span>
           </div>
           <div 
                onClick={() => handleStatClick('all', 'week')}
                className="bg-slate-100 p-4 rounded-none flex flex-col items-center justify-center border-l-4 border-slate-300 cursor-pointer hover:bg-slate-200 transition"
                title="Voir le détail de la semaine dans Statistiques"
           >
               <span className="font-bold text-slate-800">Total missions</span>
               <span className="text-brand-blue font-serif text-xl italic mt-1">{missionsCountWeek}</span>
               <span className="text-xs text-teal-500 mt-1 italic">Cette Semaine</span>
           </div>
           <div 
                onClick={() => handleStatClick('completed', 'week')}
                className="bg-slate-100 p-4 rounded-none flex flex-col items-center justify-center border-l-4 border-slate-300 cursor-pointer hover:bg-slate-200 transition"
                title="Voir les missions terminées dans Statistiques"
           >
               <span className="font-bold text-slate-800">Missions terminées</span>
               <span className="text-brand-blue font-serif text-xl italic mt-1">{missionsCompletedWeek}</span>
               <span className="text-xs text-teal-500 mt-1 italic">Cette Semaine</span>
           </div>
       </div>

       {/* Filters & Navigation */}
       <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
           <div className="flex items-center gap-4">
                <span className="text-brand-blue italic text-sm font-bold">Navigation :</span>
                <div className="flex items-center gap-1 bg-slate-200/50 p-1 rounded-full">
                    <button onClick={handlePrevWeek} className="bg-[#006699] text-white px-4 py-1 rounded-full text-sm font-bold flex items-center gap-1 hover:bg-blue-800">
                        <ChevronLeft className="w-3 h-3" /> Précédente
                    </button>
                    <button onClick={handleCurrentWeek} className="bg-[#66BB44] text-white px-4 py-1 rounded-full text-sm font-bold shadow-sm mx-2 hover:bg-green-600">
                        En cours
                    </button>
                    <button onClick={handleNextWeek} className="bg-[#006699] text-white px-4 py-1 rounded-full text-sm font-bold flex items-center gap-1 hover:bg-blue-800">
                         Suivante <ChevronRight className="w-3 h-3" />
                    </button>
                </div>
           </div>

           <div className="flex items-center gap-2">
               <div className="relative">
                   <input 
                      type="text"
                      placeholder="Rechercher..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-48 border border-slate-300 rounded px-3 py-1 text-sm focus:outline-none focus:border-brand-blue"
                   />
                   <Search className="w-3 h-3 text-slate-400 absolute right-3 top-2" />
               </div>
               
               <span className="text-brand-blue italic text-sm font-bold">Prestataire :</span>
               <div className="relative w-64">
                    <select 
                        value={selectedProvider}
                        onChange={(e) => setSelectedProvider(e.target.value)}
                        className="w-full appearance-none bg-slate-100 border border-slate-400 rounded px-3 py-1 text-sm font-bold text-slate-700 cursor-pointer focus:outline-none"
                    >
                        <option value="all">Tous les prestataires</option>
                        {providers.map(p => (
                            <option key={p.id} value={`${p.firstName} ${p.lastName}`}>{p.firstName} {p.lastName}</option>
                        ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-700">
                        <span className="text-xs">▼</span>
                    </div>
                </div>
           </div>
       </div>

       {/* Main Grid */}
       <div className="flex-1 flex gap-6 min-h-[400px]">
            <div className="flex-1 bg-white shadow-sm border border-slate-200 flex flex-col">
                <div className="grid grid-cols-6 bg-slate-100 border-b border-slate-200 text-center font-bold text-slate-800 py-2">
                    {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'].map(d => <div key={d}>{d}</div>)}
                </div>
                <div className="grid grid-cols-6 flex-1 min-h-[400px]">
                     {[0,1,2,3,4,5].map(colIndex => (
                        <div key={colIndex} className="border-r border-slate-100 last:border-r-0 p-2 bg-slate-50/30 space-y-2">
                            {/* Reminders for this day */}
                            {filteredReminders
                                .filter(r => getDayIndex(r.date) === colIndex && !r.completed)
                                .map(r => (
                                    <div key={r.id} className="bg-yellow-100 border-l-4 border-yellow-400 p-2 rounded shadow-sm text-xs relative group animate-in zoom-in duration-200">
                                        <div className="flex justify-between items-start">
                                            <p className="font-bold text-yellow-800 line-clamp-2">{r.text}</p>
                                            <button onClick={() => toggleReminder(r.id)} className="text-yellow-600 hover:text-green-600"><CheckCircle className="w-3 h-3"/></button>
                                        </div>
                                        {r.notifyEmail && <div className="absolute top-1 right-1 opacity-20"><Mail className="w-3 h-3"/></div>}
                                    </div>
                                ))
                            }

                            {/* Missions for this day */}
                            {filteredMissions
                                .filter(item => getDayIndex(item.date) === colIndex)
                                .filter(item => item.status !== 'cancelled')
                                .map(item => (
                                    <div 
                                        key={item.id} 
                                        className={`bg-${item.color === 'gray' ? 'slate-200' : item.color + '-100'} p-2 rounded text-xs cursor-pointer hover:scale-105 transition border-l-4 border-${item.color === 'gray' ? 'slate-500' : 'brand-blue'} relative group`}
                                        onClick={(e) => toggleMissionSelection(item.id, e)}
                                    >
                                        <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                             {selectedMissionIds.has(item.id) ? (
                                                 <CheckSquare className="w-4 h-4 text-brand-blue fill-white" />
                                             ) : (
                                                 <Square className="w-4 h-4 text-slate-400" />
                                             )}
                                        </div>
                                        {selectedMissionIds.has(item.id) && (
                                            <div className="absolute inset-0 bg-blue-500/10 border-2 border-brand-blue rounded pointer-events-none"></div>
                                        )}
                                        <div className="flex justify-between">
                                            <p className="font-bold text-slate-800 pr-4 truncate">{item.clientName}</p>
                                            <span className="text-[9px] text-slate-500">{new Date(item.date).getDate()}</span>
                                        </div>
                                        <p className="text-[10px]">{item.startTime}-{item.endTime}</p>
                                        <p className="text-[9px] italic text-slate-500 truncate">{item.providerName}</p>
                                    </div>
                                ))
                            }
                        </div>
                     ))}
                </div>
            </div>
            
            <div className="hidden md:block w-64 bg-white border border-slate-200 flex flex-col">
                <div className="bg-slate-100 p-3 text-center font-bold text-slate-700 border-b border-slate-200">
                    Actions & Missions
                </div>
                <div className="p-2 space-y-2 overflow-y-auto flex-1">
                    <button 
                        onClick={() => { setIsReminderModalOpen(true); setReminderForm({ text: '', date: new Date().toISOString().split('T')[0], notifyEmail: true }); }}
                        className="w-full bg-yellow-100 text-yellow-800 py-2 rounded font-bold text-xs hover:bg-yellow-200 flex items-center justify-center gap-2 mb-4 border border-yellow-200"
                    >
                        <Flag className="w-3 h-3" /> Ajouter un Rappel
                    </button>

                    {unassignedMissions.length === 0 ? (
                        <p className="text-center text-xs text-slate-400 italic mt-4">Toutes les missions sont assignées.</p>
                    ) : (
                        unassignedMissions.map(m => (
                            <div key={m.id} className="bg-red-50 border border-red-100 p-2 rounded cursor-pointer hover:bg-red-100">
                                <p className="font-bold text-xs text-red-800">{m.clientName}</p>
                                <p className="text-[10px] text-red-600">{m.date} | {m.service}</p>
                                <button onClick={() => setSelectedMissionId(m.id)} className="mt-1 w-full bg-red-200 text-red-800 text-[10px] font-bold rounded px-1 hover:bg-red-300">Assigner</button>
                            </div>
                        ))
                    )}
                </div>
                <button onClick={() => { setIsModalOpen(true); setMissionForm(initialFormState); }} className="m-2 bg-brand-orange text-white py-2 rounded font-bold text-sm hover:bg-orange-600 flex items-center justify-center gap-2">
                    <Plus className="w-4 h-4" /> Ajouter Mission
                </button>
            </div>
       </div>

       {/* Footer Stats - Updated to reflect filtered items */}
       <div className="bg-slate-200 p-4 mt-6 flex justify-between items-center font-bold text-slate-800 rounded-lg">
            <div className="flex items-center gap-2">
                <span>Total heures (Auj.) :</span>
                <span className="text-xl">{totalHoursToday}h</span>
            </div>
            <div className="flex items-center gap-2">
                <span>Total heures ({currentWeekOffset === 0 ? 'Cette semaine' : 'Semaine sélectionnée'}) :</span>
                <span className="text-xl">{totalHoursFiltered}h</span>
            </div>
       </div>


       {/* NEW MISSION MODAL */}
       {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
                <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-cream-50">
                    <div>
                        <h3 className="text-xl font-serif font-bold text-slate-800">Nouvelle Mission</h3>
                        <p className="text-xs text-slate-500 mt-1">Ajouter une prestation au planning</p>
                    </div>
                    <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full transition">
                        <X className="w-5 h-5 text-slate-500" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto max-h-[80vh]">
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">Client</label>
                        <select 
                            required
                            name="clientId"
                            value={missionForm.clientId}
                            onChange={handleFormChange}
                            className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg focus:border-brand-blue focus:ring-1 focus:ring-brand-blue outline-none"
                        >
                            <option value="">Sélectionner...</option>
                            {clients.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Date Logic */}
                    <div className="grid grid-cols-2 gap-4">
                         <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1">Date Début</label>
                            <input 
                                required
                                type="date" 
                                name="date"
                                value={missionForm.date}
                                onChange={(e) => {
                                    handleFormChange(e);
                                    // Auto-set end date to start date if empty
                                    if(!missionForm.endDate) setMissionForm(prev => ({...prev, endDate: e.target.value}));
                                }}
                                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg focus:border-brand-blue outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1">Date Fin (Si diff.)</label>
                            <input 
                                type="date" 
                                name="endDate"
                                value={missionForm.endDate}
                                onChange={handleFormChange}
                                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg focus:border-brand-blue outline-none"
                            />
                        </div>
                    </div>

                    {/* Time Logic */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                             <label className="block text-sm font-bold text-slate-700 mb-1">Heure Début</label>
                             <input 
                                required
                                type="time" 
                                name="startTime"
                                value={missionForm.startTime}
                                onChange={handleFormChange}
                                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg focus:border-brand-blue outline-none"
                            />
                        </div>
                        <div>
                             <label className="block text-sm font-bold text-slate-700 mb-1">Heure Fin</label>
                             <input 
                                required
                                type="time" 
                                name="endTime"
                                value={missionForm.endTime}
                                onChange={handleFormChange}
                                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg focus:border-brand-blue outline-none"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                        <div>
                             <label className="block text-sm font-bold text-slate-700 mb-1">Prestataire</label>
                             <select 
                                name="providerId"
                                value={missionForm.providerId}
                                onChange={handleFormChange}
                                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg focus:border-brand-blue focus:ring-1 focus:ring-brand-blue outline-none"
                             >
                                <option value="">(À assigner plus tard)</option>
                                {providers.map(p => {
                                    const available = missionForm.date ? isProviderAvailable(p.id, missionForm.date, missionForm.startTime, missionForm.endTime) : true;
                                    return (
                                        <option key={p.id} value={p.id} disabled={!available}>
                                            {p.firstName} {p.lastName} {!available ? '(Congés/Indisp.)' : ''}
                                        </option>
                                    );
                                })}
                             </select>
                        </div>
                    </div>

                     <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">Service</label>
                        <input 
                            required
                            type="text" 
                            name="service"
                            value={missionForm.service}
                            onChange={handleFormChange}
                            placeholder="Ex: Ménage, Jardinage..."
                            className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg focus:border-brand-blue focus:ring-1 focus:ring-brand-blue outline-none"
                        />
                    </div>
                    
                    {/* Recurrence Section */}
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                        <div className="flex items-center gap-2 mb-2 text-brand-blue font-bold text-sm">
                            <Repeat className="w-4 h-4" /> Options de Récurrence
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">Type</label>
                                <select 
                                    name="recurrence"
                                    value={missionForm.recurrence}
                                    onChange={handleFormChange}
                                    className="w-full p-2 bg-white border border-slate-200 rounded-lg text-sm outline-none"
                                >
                                    <option value="none">Ponctuel (1 fois)</option>
                                    <option value="weekly">Hebdomadaire (Tous les 7 jours)</option>
                                    <option value="biweekly">Bimensuel (Tous les 14 jours)</option>
                                    <option value="monthly">Mensuel (Même date)</option>
                                </select>
                            </div>
                            {missionForm.recurrence !== 'none' && (
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">Répétitions</label>
                                    <input 
                                        type="number" 
                                        name="occurrences"
                                        min="2"
                                        max="52"
                                        value={missionForm.occurrences}
                                        onChange={handleFormChange}
                                        className="w-full p-2 bg-white border border-slate-200 rounded-lg text-sm outline-none"
                                    />
                                </div>
                            )}
                        </div>
                    </div>

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
                            {isSubmitting ? 'Enregistrement...' : 'Planifier'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
       )}

       {/* REMINDER MODAL */}
       {isReminderModalOpen && (
           <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
               <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200">
                   <div className="p-4 bg-yellow-50 border-b border-yellow-100 flex justify-between items-center">
                       <h3 className="font-bold text-yellow-800 flex items-center gap-2"><Flag className="w-4 h-4"/> Nouveau Rappel</h3>
                       <button onClick={() => setIsReminderModalOpen(false)}><X className="w-5 h-5 text-slate-400"/></button>
                   </div>
                   <form onSubmit={handleReminderSubmit} className="p-6 space-y-4">
                       <div>
                           <label className="block text-xs font-bold text-slate-500 mb-1">Message</label>
                           <input 
                                required
                                type="text"
                                className="w-full border rounded p-2 text-sm"
                                placeholder="Ex: Appeler Mr Dupont..."
                                value={reminderForm.text}
                                onChange={(e) => setReminderForm({...reminderForm, text: e.target.value})}
                           />
                       </div>
                       <div>
                           <label className="block text-xs font-bold text-slate-500 mb-1">Date</label>
                           <input 
                                required
                                type="date"
                                className="w-full border rounded p-2 text-sm"
                                value={reminderForm.date}
                                onChange={(e) => setReminderForm({...reminderForm, date: e.target.value})}
                           />
                       </div>
                       <div className="flex items-center gap-2 pt-2">
                           <input 
                                type="checkbox"
                                id="notifyEmail"
                                checked={reminderForm.notifyEmail}
                                onChange={(e) => setReminderForm({...reminderForm, notifyEmail: e.target.checked})}
                                className="w-4 h-4 text-brand-blue"
                           />
                           <label htmlFor="notifyEmail" className="text-sm font-bold text-slate-700">M'envoyer une notification par email</label>
                       </div>
                       <div className="flex justify-end pt-4">
                           <button type="submit" disabled={isSubmitting} className="bg-brand-blue text-white px-4 py-2 rounded font-bold text-sm hover:bg-teal-700">
                               {isSubmitting ? '...' : 'Ajouter au planning'}
                           </button>
                       </div>
                   </form>
               </div>
           </div>
       )}

       {/* ASSIGNMENT MODAL */}
       {selectedMissionId !== null && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/90 backdrop-blur-sm p-4">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
                    <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-cream-50">
                        <div>
                            <h3 className="text-xl font-serif font-bold text-slate-800">Assigner Prestataire</h3>
                            <p className="text-xs text-slate-500 mt-1">Envoyer l'ordre de mission</p>
                        </div>
                        <button onClick={() => setSelectedMissionId(null)} className="p-2 hover:bg-slate-200 rounded-full transition">
                            <X className="w-5 h-5 text-slate-500" />
                        </button>
                    </div>
                    
                    <div className="p-6 space-y-6">
                        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 text-sm">
                            <h4 className="font-bold text-slate-700 mb-2 border-b pb-1">Détails Mission</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                <div className="text-slate-500">Client</div>
                                <div className="font-bold text-slate-800">{missionToAssign?.clientName || '—'}</div>
                                <div className="text-slate-500">Date</div>
                                <div className="font-bold text-slate-800">{missionToAssign?.date || '—'}</div>
                                <div className="text-slate-500">Horaire</div>
                                <div className="font-bold text-slate-800">{missionToAssign?.startTime || '—'} - {missionToAssign?.endTime || '—'}</div>
                                <div className="text-slate-500">Service</div>
                                <div className="font-bold text-brand-blue">{missionToAssign?.service || '—'}</div>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">Choisir un prestataire</label>
                            <select 
                                className="w-full p-3 bg-white border border-slate-300 rounded-lg outline-none focus:border-brand-blue focus:ring-1 focus:ring-brand-blue"
                                value={assignProviderId}
                                onChange={(e) => setAssignProviderId(e.target.value)}
                            >
                                <option value="">Sélectionner dans la liste...</option>
                                {providers.map(p => {
                                    const available = missionToAssign ? isProviderAvailable(p.id, missionToAssign.date, missionToAssign.startTime, missionToAssign.endTime) : true;
                                    return (
                                        <option key={p.id} value={p.id} disabled={!available} className={!available ? 'text-slate-400' : ''}>
                                            {p.firstName} {p.lastName} {available ? '✅' : '(Indisponible/Congés)'}
                                        </option>
                                    )
                                })}
                            </select>
                        </div>
                        
                        <div className="bg-blue-50 p-3 rounded-lg flex items-start gap-3">
                            <Mail className="w-5 h-5 text-brand-blue mt-0.5" />
                            <p className="text-xs text-blue-800">
                                En validant, un email automatique contenant les détails (Date, Heure, Adresse, Client) sera envoyé au prestataire sélectionné.
                            </p>
                        </div>

                        <div className="flex justify-end gap-3 pt-2">
                            <button onClick={() => setSelectedMissionId(null)} className="px-4 py-2 text-slate-500 font-bold hover:bg-slate-100 rounded-lg transition">Annuler</button>
                            <button 
                                onClick={handleConfirmAssignment}
                                disabled={!assignProviderId || !missionToAssign}
                                className="px-6 py-2 bg-brand-blue text-white font-bold rounded-lg hover:bg-teal-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                <Mail className="w-4 h-4" /> Envoyer & Assigner
                            </button>
                        </div>
                    </div>
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
                        Êtes-vous sûr de vouloir supprimer définitivement {selectedMissionIds.size} mission(s) ? 
                    </p>
                    <div className="flex gap-3 w-full">
                        <button 
                            onClick={() => setDeleteConfirmOpen(false)}
                            className="flex-1 py-2 text-slate-600 font-bold bg-slate-100 hover:bg-slate-200 rounded-lg transition"
                        >
                            Annuler
                        </button>
                        <button 
                            onClick={executeBulkDeleteMissions}
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

export default Planning;
