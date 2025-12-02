
import React, { useState, useEffect } from 'react';
import { 
    Calendar, 
    User, 
    CheckCircle, 
    ChevronRight,
    ChevronLeft,
    Search,
    Zap,
    Star
} from 'lucide-react';
import { useData } from '../context/DataContext';
import { Mission } from '../types';

const Reservations: React.FC = () => {
  const { addMission, clients, getAvailableSlots } = useData();
  const [step, setStep] = useState(1);
  const [selectedService, setSelectedService] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedSlot, setSelectedSlot] = useState<string>('');
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [newClientName, setNewClientName] = useState('');
  
  const [availableSmartSlots, setAvailableSmartSlots] = useState<{ time: string, provider: string, score: number, reason: string }[]>([]);

  // Update slots when date changes
  useEffect(() => {
      if (selectedDate) {
          const slots = getAvailableSlots(selectedDate);
          setAvailableSmartSlots(slots);
      } else {
          setAvailableSmartSlots([]);
      }
  }, [selectedDate, getAvailableSlots]);

  const handleNext = () => setStep(prev => prev + 1);
  const handleBack = () => setStep(prev => prev - 1);

  const handleConfirm = () => {
      const slotInfo = availableSmartSlots.find(s => s.time === selectedSlot);
      const client = clients.find(c => c.id === selectedClientId) || { name: newClientName, id: 'temp' };
      
      const newMission: Mission = {
          id: `m-res-${Date.now()}`, // Will be handled by DB
          date: selectedDate,
          startTime: selectedSlot.split(' - ')[0],
          endTime: selectedSlot.split(' - ')[1],
          duration: 2, // Simplified for demo
          clientName: client.name,
          clientId: client.id === 'temp' ? undefined : client.id,
          service: selectedService,
          providerName: slotInfo?.provider,
          providerId: 'auto-assign', // Backend/Context should resolve name to ID if needed, or we fetch ID in getAvailableSlots
          status: 'planned',
          color: 'orange',
          source: 'reservation'
      };
      
      addMission(newMission);
      alert(`Réservation confirmée pour ${client.name} !`);
      
      // Reset
      setStep(1);
      setSelectedService('');
      setSelectedDate('');
      setSelectedSlot('');
      setSelectedClientId('');
      setNewClientName('');
  };

  return (
    <div className="p-8 h-full overflow-y-auto bg-white/40 relative flex flex-col">
        <div className="mb-8">
            <h2 className="text-3xl font-serif font-bold text-slate-800">Nouvelle Réservation</h2>
            <p className="text-sm text-slate-500">Assistant de réservation intelligent (Données Réelles)</p>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-slate-200 rounded-full h-2 mb-8">
            <div 
                className="bg-brand-blue h-2 rounded-full transition-all duration-500 ease-out" 
                style={{ width: `${(step / 3) * 100}%` }}
            ></div>
        </div>

        <div className="flex-1 bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden flex flex-col">
            
            {/* STEP 1: SERVICE SELECTION */}
            {step === 1 && (
                <div className="p-8 animate-in fade-in slide-in-from-right-4">
                    <h3 className="text-xl font-bold text-slate-800 mb-6 text-center">Que souhaite le client ?</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {['Ménage Standard', 'Grand Nettoyage', 'Jardinage', 'Bricolage', 'Garde d\'enfant', 'Assistance'].map(service => (
                            <div 
                                key={service}
                                onClick={() => { setSelectedService(service); handleNext(); }}
                                className="group cursor-pointer border-2 border-slate-100 rounded-xl p-6 hover:border-brand-blue hover:bg-blue-50 transition-all flex flex-col items-center text-center"
                            >
                                <div className="w-16 h-16 bg-white rounded-full shadow-sm flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition-transform">
                                    ✨
                                </div>
                                <h4 className="font-bold text-slate-700 group-hover:text-brand-blue">{service}</h4>
                                <p className="text-xs text-slate-400 mt-2">Estimation: 2h</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* STEP 2: SMART CALENDAR */}
            {step === 2 && (
                <div className="p-8 animate-in fade-in slide-in-from-right-4 flex-1 flex flex-col">
                    <h3 className="text-xl font-bold text-slate-800 mb-6 text-center">Quand intervenir ?</h3>
                    
                    <div className="flex gap-8 h-full">
                        {/* Left: Date Picker */}
                        <div className="w-1/3 border-r border-slate-100 pr-8">
                            <label className="block text-sm font-bold text-slate-500 mb-2">Choisir une date</label>
                            <input 
                                type="date" 
                                className="w-full p-4 border rounded-xl bg-slate-50 font-bold text-slate-700 outline-none focus:border-brand-blue"
                                value={selectedDate}
                                min={new Date().toISOString().split('T')[0]}
                                onChange={(e) => setSelectedDate(e.target.value)}
                            />
                            
                            {selectedDate && (
                                <div className="mt-6 bg-blue-50 p-4 rounded-xl border border-blue-100">
                                    <div className="flex items-center gap-2 mb-2 text-brand-blue font-bold">
                                        <Zap className="w-4 h-4" /> Analyse en temps réel
                                    </div>
                                    <p className="text-xs text-blue-800">
                                        Nous scannons les plannings et congés de vos prestataires pour cette date.
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Right: Slots */}
                        <div className="flex-1">
                            {!selectedDate ? (
                                <div className="h-full flex items-center justify-center text-slate-400 flex-col">
                                    <Calendar className="w-12 h-12 mb-2 opacity-20" />
                                    <p>Sélectionnez une date pour voir les disponibilités.</p>
                                </div>
                            ) : (
                                <div className="space-y-4 max-h-[400px] overflow-y-auto">
                                    {availableSmartSlots.length === 0 ? (
                                         <div className="text-center text-red-400 p-8 border border-red-100 rounded-xl bg-red-50">
                                             Aucun prestataire disponible pour cette date sur les créneaux standards.
                                         </div>
                                    ) : (
                                        availableSmartSlots.map((slot, idx) => (
                                            <div 
                                                key={idx}
                                                onClick={() => setSelectedSlot(slot.time)}
                                                className={`p-4 border rounded-xl cursor-pointer transition-all flex justify-between items-center ${selectedSlot === slot.time ? 'border-brand-orange bg-orange-50 ring-1 ring-brand-orange' : 'border-slate-200 hover:border-brand-blue hover:bg-slate-50'}`}
                                            >
                                                <div>
                                                    <h4 className="font-bold text-lg text-slate-800">{slot.time}</h4>
                                                    <p className="text-sm text-slate-500 flex items-center gap-2">
                                                        <User className="w-3 h-3"/> {slot.provider}
                                                    </p>
                                                </div>
                                                <div className="text-right">
                                                    <div className="flex items-center gap-1 justify-end text-green-600 font-bold text-sm">
                                                        <Star className="w-3 h-3 fill-green-600" /> {slot.score}% Match
                                                    </div>
                                                    <p className="text-xs text-slate-400 italic">{slot.reason}</p>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* STEP 3: CLIENT & CONFIRM */}
            {step === 3 && (
                <div className="p-8 animate-in fade-in slide-in-from-right-4 flex-1 flex flex-col items-center max-w-2xl mx-auto w-full">
                     <h3 className="text-xl font-bold text-slate-800 mb-6 text-center">Pour qui ?</h3>
                     
                     <div className="w-full space-y-6">
                        <div className="relative">
                            <Search className="absolute left-4 top-3.5 text-slate-400 w-5 h-5" />
                            <select 
                                className="w-full pl-12 p-3 bg-slate-50 border border-slate-200 rounded-xl appearance-none outline-none focus:border-brand-blue font-bold text-slate-700"
                                onChange={(e) => setSelectedClientId(e.target.value)}
                                value={selectedClientId}
                            >
                                <option value="">Rechercher un client existant...</option>
                                {clients.map(c => (
                                    <option key={c.id} value={c.id}>{c.name} - {c.city}</option>
                                ))}
                            </select>
                        </div>
                        
                        <div className="relative flex py-2 items-center">
                            <div className="flex-grow border-t border-slate-200"></div>
                            <span className="flex-shrink-0 mx-4 text-slate-400 text-xs font-bold uppercase">Ou nouveau client</span>
                            <div className="flex-grow border-t border-slate-200"></div>
                        </div>

                        <input 
                            type="text" 
                            placeholder="Nom du nouveau client (Rapide)"
                            className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:border-brand-blue"
                            value={newClientName}
                            onChange={(e) => setNewClientName(e.target.value)}
                            disabled={!!selectedClientId}
                        />

                        <div className="bg-cream-100 p-6 rounded-xl border border-beige-200 mt-8">
                            <h4 className="font-serif font-bold text-lg text-slate-800 mb-4 border-b border-beige-300 pb-2">Récapitulatif</h4>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <span className="block text-xs text-slate-500 uppercase">Service</span>
                                    <span className="font-bold text-brand-blue">{selectedService}</span>
                                </div>
                                <div>
                                    <span className="block text-xs text-slate-500 uppercase">Date & Heure</span>
                                    <span className="font-bold text-slate-700">{selectedDate} | {selectedSlot}</span>
                                </div>
                                <div>
                                    <span className="block text-xs text-slate-500 uppercase">Prestataire</span>
                                    <span className="font-bold text-slate-700">{availableSmartSlots.find(s => s.time === selectedSlot)?.provider}</span>
                                </div>
                            </div>
                        </div>
                     </div>
                </div>
            )}

            {/* FOOTER NAV */}
            <div className="p-6 border-t border-slate-100 flex justify-between bg-slate-50">
                <button 
                    onClick={handleBack} 
                    disabled={step === 1}
                    className="px-6 py-2 rounded-lg font-bold text-slate-500 hover:bg-slate-200 disabled:opacity-30 flex items-center gap-2"
                >
                    <ChevronLeft className="w-4 h-4" /> Retour
                </button>

                {step < 3 ? (
                    <button 
                        onClick={handleNext}
                        disabled={(step === 1 && !selectedService) || (step === 2 && (!selectedDate || !selectedSlot))}
                        className="px-6 py-2 rounded-lg bg-brand-blue text-white font-bold hover:bg-teal-700 disabled:opacity-50 flex items-center gap-2"
                    >
                        Suivant <ChevronRight className="w-4 h-4" />
                    </button>
                ) : (
                    <button 
                        onClick={handleConfirm}
                        disabled={!selectedClientId && !newClientName}
                        className="px-8 py-2 rounded-lg bg-green-600 text-white font-bold hover:bg-green-700 shadow-lg flex items-center gap-2"
                    >
                        <CheckCircle className="w-4 h-4" /> Confirmer Réservation
                    </button>
                )}
            </div>
        </div>
    </div>
  );
};

export default Reservations;
