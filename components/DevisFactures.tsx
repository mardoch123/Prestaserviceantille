
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Plus, Search, X, CheckCircle, Filter, FileText, Mail, Copy, Trash2, Paperclip, ArrowRight, RefreshCw, CreditCard, Send, AlertTriangle, RotateCcw, Zap, CheckSquare, Square, Calendar, ChevronDown, ChevronUp, PlusCircle, Loader2 } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useData } from '../context/DataContext'; 
import { Mission, Document } from '../types';

interface InterventionSlot {
    id: string;
    date: string;
    startTime: string;
    endTime: string;
    duration: number;
}

const DevisFactures: React.FC = () => {
  const { packs, addMission, documents, addDocument, convertQuoteToInvoice, deleteDocument, deleteDocuments, duplicateDocument, clients, markInvoicePaid, updateDocumentStatus, sendDocumentReminder } = useData();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'devis' | 'facture'>('devis');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Selection State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  // Delete Confirmation Modal State (Single & Bulk)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<{ id: string, ref: string } | null>(null);
  const [isBulkDelete, setIsBulkDelete] = useState(false);
  
  // Toast State & Ref for timeout clearing
  const [toast, setToast] = useState<{ show: boolean; message: string }>({ show: false, message: '' });
  const toastTimeoutRef = useRef<number | null>(null);

  const location = useLocation();

  // --- Form State ---
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [serviceType, setServiceType] = useState<'pack' | 'custom'>('pack');
  const [selectedPackId, setSelectedPackId] = useState<string>('');
  const [packQuantity, setPackQuantity] = useState<number>(1);
  const [customDescription, setCustomDescription] = useState('');
  const [unitPrice, setUnitPrice] = useState<number>(0);
  
  const [tvaRate, setTvaRate] = useState<0|2.1|8.5>(2.1);
  const [taxCreditActive, setTaxCreditActive] = useState(false);
  
  // Loading state
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Planification Prévisionnelle Enhancements
  const [interventionSlots, setInterventionSlots] = useState<InterventionSlot[]>([]);
  
  // Use Case Logic States
  const [packSpecificConfig, setPackSpecificConfig] = useState<{
      frequencyChoice?: string; // "4j x 3h" or "3j x 4h" for Tranquility
      customDays?: number; // For Personnalisé
      customTotalHours?: number; // For Personnalisé
  }>({});

  const selectedClient = clients.find(c => c.id === selectedClientId);

  useEffect(() => {
      if (location.state) {
          const state = location.state as { filter?: string };
          if (state.filter) {
              setFilterStatus(state.filter);
          }
      }
  }, [location]);

  const openModal = (mode: 'devis' | 'facture') => {
    setModalMode(mode);
    setIsModalOpen(true);
    setSelectedClientId('');
    setServiceType('pack');
    setPackQuantity(1);
    setUnitPrice(0);
    setCustomDescription('');
    setTvaRate(2.1); 
    setTaxCreditActive(false);
    setSelectedPackId('');
    setInterventionSlots([]);
    setPackSpecificConfig({});
  };

  const calculateDuration = (start: string, end: string): number => {
      if (!start || !end) return 0;
      const [h1, m1] = start.split(':').map(Number);
      const [h2, m2] = end.split(':').map(Number);
      const date1 = new Date(0, 0, 0, h1, m1);
      const date2 = new Date(0, 0, 0, h2, m2);
      const diffMs = date2.getTime() - date1.getTime();
      return diffMs > 0 ? diffMs / (1000 * 60 * 60) : 0;
  };

  // Helper to add hours to time string
  const addHoursToTime = (time: string, hoursToAdd: number): string => {
      const [h, m] = time.split(':').map(Number);
      const date = new Date(0, 0, 0, h, m);
      date.setHours(date.getHours() + Math.floor(hoursToAdd));
      date.setMinutes(date.getMinutes() + (hoursToAdd % 1) * 60);
      return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  };

  useEffect(() => {
      if (serviceType === 'pack' && selectedPackId) {
          const pack = packs.find(p => p.id === selectedPackId);
          if (pack) {
              setUnitPrice(pack.priceHT);
              setCustomDescription(`${pack.name} - ${pack.description}`);
              
              // RESET CONFIG ON PACK CHANGE
              setPackSpecificConfig({});
              setInterventionSlots([]);

              // Initial Setup based on Pack Name (Logic from images)
              if (pack.name.includes("Tranquility")) {
                  // Default to first option
                  setPackSpecificConfig({ frequencyChoice: "4j_3h" }); 
              } else if (pack.name.includes("Ultime 6")) {
                  // Auto generate single slot 6h
                  setInterventionSlots([{ 
                      id: 'slot-ultime', 
                      date: new Date().toISOString().split('T')[0], 
                      startTime: '09:00', 
                      endTime: '15:00', 
                      duration: 6 
                  }]);
              } else if (pack.name.includes("personnalisé")) {
                  // Reset for manual entry
                  setPackSpecificConfig({ customDays: 1, customTotalHours: 2 });
                  setInterventionSlots([{ 
                      id: 'slot-custom-0', 
                      date: new Date().toISOString().split('T')[0], 
                      startTime: '09:00', 
                      endTime: '11:00', 
                      duration: 2 
                  }]);
              }
          }
      }
  }, [selectedPackId, serviceType, packs]);

  // Handler for Generating Slots based on Configuration
  const generateSlots = () => {
      const pack = packs.find(p => p.id === selectedPackId);
      if (!pack) return;

      const newSlots: InterventionSlot[] = [];
      const baseDate = new Date(); // Start from today or logic

      if (pack.name.includes("Tranquility")) {
          // Logic for Tranquility: 12h total
          // Option 1: 4 days x 3 hours
          // Option 2: 3 days x 4 hours
          const choice = packSpecificConfig.frequencyChoice || "4j_3h";
          const days = choice === "4j_3h" ? 4 : 3;
          const hours = choice === "4j_3h" ? 3 : 4;

          for(let i=0; i<days; i++) {
              const date = new Date(baseDate);
              date.setDate(date.getDate() + (i * 2)); // Spread every 2 days by default
              newSlots.push({
                  id: `slot-tranquility-${i}`,
                  date: date.toISOString().split('T')[0],
                  startTime: '09:00',
                  endTime: addHoursToTime('09:00', hours),
                  duration: hours
              });
          }
      } else if (pack.name.includes("personnalisé")) {
          const days = packSpecificConfig.customDays || 1;
          const totalHours = packSpecificConfig.customTotalHours || 2;
          const hoursPerDay = totalHours / days;

          for(let i=0; i<days; i++) {
              const date = new Date(baseDate);
              date.setDate(date.getDate() + i);
              newSlots.push({
                  id: `slot-custom-${i}`,
                  date: date.toISOString().split('T')[0],
                  startTime: '09:00',
                  endTime: addHoursToTime('09:00', hoursPerDay),
                  duration: hoursPerDay
              });
          }
      }
      setInterventionSlots(newSlots);
  };

  const updateSlot = (index: number, field: keyof InterventionSlot, value: string) => {
      const newSlots = [...interventionSlots];
      const currentSlot = newSlots[index];
      
      if (field === 'startTime') {
          // Keep duration constant if possible, shift end time
          const end = addHoursToTime(value, currentSlot.duration);
          newSlots[index] = { ...currentSlot, startTime: value, endTime: end };
      } else if (field === 'endTime') {
          // Recalculate duration
          const dur = calculateDuration(currentSlot.startTime, value);
          newSlots[index] = { ...currentSlot, endTime: value, duration: dur };
      } else {
          newSlots[index] = { ...currentSlot, [field]: value };
      }
      setInterventionSlots(newSlots);
  };

  const addNewSlot = () => {
      const lastSlot = interventionSlots[interventionSlots.length - 1];
      let newDate = new Date().toISOString().split('T')[0];
      if (lastSlot) {
          const d = new Date(lastSlot.date);
          d.setDate(d.getDate() + 1);
          newDate = d.toISOString().split('T')[0];
      }
      
      setInterventionSlots([...interventionSlots, {
          id: `manual-${Date.now()}`,
          date: newDate,
          startTime: '09:00',
          endTime: '11:00',
          duration: 2
      }]);
  };

  const removeSlot = (index: number) => {
      const newSlots = [...interventionSlots];
      newSlots.splice(index, 1);
      setInterventionSlots(newSlots);
  };

  const showToast = (message: string) => {
      if (toastTimeoutRef.current) { clearTimeout(toastTimeoutRef.current); }
      setToast({ show: true, message });
      toastTimeoutRef.current = window.setTimeout(() => { setToast({ show: false, message: '' }); }, 3000);
  };

  const handleSuccess = async () => {
    setIsSubmitting(true);
    try {
        const client = clients.find(c => c.id === selectedClientId);
        const clientName = client?.name || 'Client Inconnu';
        const totalHT = unitPrice * packQuantity;
        const tvaAmount = totalHT * (tvaRate / 100);
        const totalTTC = totalHT + tvaAmount;

        // Determine description suffix based on slots if custom
        let finalDescription = customDescription;
        const totalHours = interventionSlots.reduce((acc, s) => acc + s.duration, 0);
        if(serviceType === 'pack' && packs.find(p=>p.id === selectedPackId)?.name.includes("personnalisé")) {
            finalDescription += ` (${interventionSlots.length} jours, Total ${totalHours}h)`;
        }

        const newDoc: Document = {
            id: '', 
            ref: `${modalMode === 'devis' ? 'DEV' : 'FAC'}-${new Date().getFullYear()}-${Math.floor(Math.random() * 10000)}`,
            clientId: selectedClientId,
            clientName: clientName,
            date: new Date().toISOString().split('T')[0],
            type: modalMode === 'devis' ? 'Devis' : 'Facture',
            category: serviceType,
            description: finalDescription,
            unitPrice: unitPrice,
            quantity: packQuantity,
            tvaRate: tvaRate,
            totalHT: totalHT,
            totalTTC: totalTTC,
            taxCreditEnabled: taxCreditActive,
            status: modalMode === 'devis' ? 'sent' : 'paid',
            slotsData: modalMode === 'devis' ? interventionSlots : undefined,
        };

        await addDocument(newDoc);

        if (modalMode === 'facture' && interventionSlots.length > 0) {
            for (const slot of interventionSlots) {
                 if (slot.date) {
                     await addMission({
                         id: '',
                         date: slot.date,
                         startTime: slot.startTime,
                         endTime: slot.endTime,
                         duration: slot.duration,
                         clientName,
                         clientId: selectedClientId,
                         service: finalDescription,
                         providerId: null,
                         providerName: 'À assigner',
                         status: 'planned',
                         color: 'gray',
                         source: 'devis'
                     });
                 }
            }
        }
        
        setIsModalOpen(false);
        showToast(modalMode === 'devis' ? 'Devis envoyé (Valable 24h) !' : 'Facture générée avec succès !');
    } catch (e: any) {
        alert("Erreur création document: " + e.message);
    } finally {
        setIsSubmitting(false);
    }
  };

  // --- ACTION HANDLERS ---

  const handleConversion = (docId: string, e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      
      if(window.confirm("Confirmer la conversion en facture ?")) {
          convertQuoteToInvoice(docId);
          setFilterStatus('all'); 
          showToast('Devis converti en facture !');
      }
  };
  
  const handleSendEmail = (docRef: string, e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      showToast(`Facture ${docRef} envoyée par email au client.`);
  };

  const handleMarkPaid = (docId: string, e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if(window.confirm("Confirmez-vous avoir reçu le paiement ?")) {
          markInvoicePaid(docId);
          showToast('Facture marquée comme payée.');
      }
  };

  const handleManualReminder = (docId: string, e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      sendDocumentReminder(docId);
      showToast('Relance envoyée (Notification + Email).');
  };

  const confirmDelete = (id: string, ref: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDocumentToDelete({ id, ref });
    setIsBulkDelete(false);
    setIsDeleteModalOpen(true);
  };

  const confirmBulkDelete = () => {
    if (selectedIds.size > 0) {
        setIsBulkDelete(true);
        setIsDeleteModalOpen(true);
    }
  };

  const executeDelete = async () => {
      if (isBulkDelete) {
          await deleteDocuments(Array.from(selectedIds));
          setSelectedIds(new Set());
          showToast(`${selectedIds.size} document(s) supprimé(s).`);
      } else if (documentToDelete) {
          await deleteDocument(documentToDelete.id);
          showToast(`Document ${documentToDelete.ref} supprimé définitivement.`);
      }
      setIsDeleteModalOpen(false);
      setDocumentToDelete(null);
  };

  const handleDuplicate = async (id: string, ref: string, e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      try {
          await duplicateDocument(id);
          setFilterStatus('all'); 
          showToast('Document dupliqué !');
      } catch (err: any) {
          alert("Erreur duplication: " + err.message);
      }
  };

  const handleStatusChange = (id: string, newStatus: string, e: React.ChangeEvent<HTMLSelectElement>) => {
      e.preventDefault();
      e.stopPropagation();
      updateDocumentStatus(id, newStatus);
      showToast('Statut mis à jour manuellement.');
  };

  // Bulk Actions
  const toggleSelection = (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      const newSet = new Set(selectedIds);
      if (newSet.has(id)) {
          newSet.delete(id);
      } else {
          newSet.add(id);
      }
      setSelectedIds(newSet);
  };

  const toggleSelectAll = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (selectedIds.size === filteredDocs.length) {
          setSelectedIds(new Set());
      } else {
          setSelectedIds(new Set(filteredDocs.map(d => d.id)));
      }
  };

  const filteredDocs = useMemo(() => {
      let docs = documents;
      if (filterStatus !== 'all') docs = docs.filter(doc => doc.status === filterStatus);
      if (searchQuery) {
          const query = searchQuery.toLowerCase();
          docs = docs.filter(doc => doc.clientName.toLowerCase().includes(query) || doc.ref.toLowerCase().includes(query));
      }
      return docs;
  }, [filterStatus, searchQuery, documents]);

  const totalHT = unitPrice * packQuantity;
  const tvaAmount = totalHT * (tvaRate / 100);
  const totalTTC = totalHT + tvaAmount;
  const taxCreditAmount = taxCreditActive ? totalTTC * 0.5 : 0;
  const clientToPay = totalTTC - taxCreditAmount;

  // Helper to check pack name safely
  const packNameIncludes = (str: string) => {
      const pack = packs.find(p => p.id === selectedPackId);
      return pack?.name.toLowerCase().includes(str.toLowerCase()) || false;
  };

  return (
    <div className="p-4 md:p-8 h-full overflow-y-auto bg-white/40 relative">
      {/* Toast Container */}
      <div className={`fixed bottom-6 right-6 z-[9999] transition-all duration-500 transform ${toast.show ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0 pointer-events-none'}`}>
        <div className="bg-slate-800 text-white px-6 py-4 rounded-lg shadow-2xl flex items-center gap-3 border border-slate-700">
            <div className="bg-green-500 p-1 rounded-full text-white"><CheckCircle className="w-4 h-4" /></div>
            <div><h4 className="font-bold text-sm">Action effectuée</h4><p className="text-xs text-slate-300">{toast.message}</p></div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div><h2 className="text-3xl font-serif font-bold text-slate-800">Devis/Factures</h2><p className="text-sm text-slate-500 mt-1">Gestion commerciale et facturation</p></div>
        <div className="flex items-center bg-white rounded-lg shadow-sm border border-beige-200 p-1">
          <Filter className="w-4 h-4 text-slate-400 ml-2 mr-2" />
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="bg-transparent text-sm font-bold text-slate-700 p-2 outline-none cursor-pointer">
            <option value="all">Tous les documents</option><option value="sent">Devis envoyés</option><option value="signed">Devis signés</option><option value="converted">Facturés</option><option value="paid">Payées</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        <div className="lg:col-span-1 flex gap-4">
             {selectedIds.size > 0 ? (
                 <button onClick={confirmBulkDelete} className="flex-1 flex flex-col items-center justify-center p-6 bg-red-100 rounded-lg hover:bg-red-200 transition border border-red-200 shadow-sm group animate-in fade-in">
                    <Trash2 className="w-5 h-5 text-red-600 mb-2"/><span className="text-sm font-bold text-red-700">Supprimer ({selectedIds.size})</span>
                 </button>
             ) : (
                 <>
                    <button onClick={() => openModal('devis')} className="flex-1 flex flex-col items-center justify-center p-6 bg-cream-100 rounded-lg hover:bg-cream-200 transition border border-beige-200 shadow-sm group"><Plus className="w-5 h-5 text-brand-blue mb-2 group-hover:scale-110 transition-transform"/><span className="text-sm font-bold text-slate-700">Créer devis</span></button>
                    <button onClick={() => openModal('facture')} className="flex-1 flex flex-col items-center justify-center p-6 bg-cream-100 rounded-lg hover:bg-cream-200 transition border border-beige-200 shadow-sm group"><Plus className="w-5 h-5 text-brand-orange mb-2 group-hover:scale-110 transition-transform"/><span className="text-sm font-bold text-slate-700">Créer facture</span></button>
                 </>
             )}
        </div>
        <div className="lg:col-span-2 bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-center">
            <Search className="w-5 h-5 text-slate-400 mr-3" /><input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Rechercher..." className="flex-1 bg-transparent outline-none text-sm" />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 flex flex-col shadow-sm min-h-[400px] overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-500 uppercase bg-slate-50 sticky top-0 z-10">
                <tr>
                    <th className="px-6 py-3 w-10">
                         <button onClick={toggleSelectAll} className="text-slate-500 hover:text-slate-700">
                             {selectedIds.size > 0 && selectedIds.size === filteredDocs.length ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                         </button>
                    </th>
                    <th className="px-6 py-3">Réf</th>
                    <th className="px-6 py-3">Client</th>
                    <th className="px-6 py-3">Date</th>
                    <th className="px-6 py-3">Type</th>
                    <th className="px-6 py-3 text-right">TTC</th>
                    <th className="px-6 py-3 text-center">Statut (Modifiable)</th>
                    <th className="px-6 py-3 text-center">Actions</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
                {filteredDocs.length > 0 ? (
                    filteredDocs.map(doc => (
                        <tr key={doc.id} className={`hover:bg-cream-50 transition-colors ${selectedIds.has(doc.id) ? 'bg-blue-50' : ''}`}>
                            <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                                <button onClick={(e) => toggleSelection(doc.id, e)} className="text-slate-400 hover:text-brand-blue">
                                    {selectedIds.has(doc.id) ? <CheckSquare className="w-4 h-4 text-brand-blue" /> : <Square className="w-4 h-4" />}
                                </button>
                            </td>
                            <td className="px-6 py-4 font-medium text-slate-900 cursor-pointer">{doc.ref}</td>
                            <td className="px-6 py-4 cursor-pointer"><div className="font-bold text-slate-700">{doc.clientName}</div></td>
                            <td className="px-6 py-4 cursor-pointer">{doc.date}</td>
                            <td className="px-6 py-4 cursor-pointer"><span className={`px-2 py-1 rounded text-xs ${doc.type === 'Devis' ? 'bg-blue-50 text-brand-blue' : 'bg-purple-50 text-purple-600'}`}>{doc.type}</span></td>
                            <td className="px-6 py-4 text-right font-bold cursor-pointer">{doc.totalTTC.toFixed(2)} €</td>
                            <td className="px-6 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                                <div className="relative inline-block" onClick={(e) => e.stopPropagation()}>
                                    <select 
                                        value={doc.status} 
                                        onChange={(e) => handleStatusChange(doc.id, e.target.value, e)}
                                        onClick={(e) => e.stopPropagation()}
                                        className={`appearance-none cursor-pointer text-xs font-bold px-3 py-1 pr-6 rounded-full outline-none border transition-all
                                            ${doc.status === 'signed' ? 'bg-green-100 text-green-800 border-green-200' : ''}
                                            ${doc.status === 'sent' ? 'bg-orange-100 text-orange-800 border-orange-200' : ''}
                                            ${doc.status === 'expired' ? 'bg-red-100 text-red-800 border-red-200' : ''}
                                            ${doc.status === 'paid' ? 'bg-teal-100 text-teal-800 border-teal-200' : ''}
                                            ${doc.status === 'converted' ? 'bg-slate-100 text-slate-600 border-slate-200' : ''}
                                            ${doc.status === 'pending' ? 'bg-yellow-100 text-yellow-800 border-yellow-200' : ''}
                                            ${doc.status === 'rejected' ? 'bg-red-5 text-red-800 border-red-100' : ''}
                                        `}
                                    >
                                        {doc.type === 'Devis' && (
                                            <>
                                                <option value="sent">Envoyé</option>
                                                <option value="signed">Signé</option>
                                                <option value="rejected">Refusé</option>
                                                <option value="converted">Facturé</option>
                                                <option value="expired">Expiré</option>
                                            </>
                                        )}
                                        {doc.type === 'Facture' && (
                                            <>
                                                <option value="pending">En attente</option>
                                                <option value="paid">Payée</option>
                                                <option value="rejected">Annulée</option>
                                            </>
                                        )}
                                    </select>
                                </div>

                                {doc.reminderSent && (
                                    <div className="mt-1">
                                        <span className="text-[10px] text-orange-600 font-bold flex items-center justify-center gap-1 bg-orange-50 px-1 rounded border border-orange-200 w-fit mx-auto">
                                            <RotateCcw className="w-3 h-3" /> Relance auto
                                        </span>
                                    </div>
                                )}
                            </td>
                            <td className="px-6 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                                <div className="flex items-center justify-center gap-2">
                                    
                                    {/* CONVERT BUTTON */}
                                    {doc.type === 'Devis' && doc.status === 'signed' && (
                                        <button 
                                            onClick={(e) => handleConversion(doc.id, e)} 
                                            className="bg-brand-orange text-white text-xs px-3 py-1 rounded-lg hover:bg-orange-600 transition shadow-sm flex items-center gap-1" 
                                            title="Convertir après paiement"
                                        >
                                            <RefreshCw className="w-3 h-3 pointer-events-none"/> Convertir
                                        </button>
                                    )}
                                    
                                    {/* SEND EMAIL BUTTON */}
                                    {(doc.type === 'Facture' || doc.status === 'converted') && (
                                        <button 
                                            onClick={(e) => handleSendEmail(doc.ref, e)} 
                                            className="text-slate-400 hover:text-brand-blue p-1 hover:bg-slate-100 rounded transition" 
                                            title="Envoyer par email"
                                        >
                                            <Send className="w-4 h-4 pointer-events-none"/>
                                        </button>
                                    )}
                                    
                                    {/* MARK PAID BUTTON */}
                                    {doc.status === 'pending' && doc.type === 'Facture' && (
                                        <button 
                                            onClick={(e) => handleMarkPaid(doc.id, e)} 
                                            className="bg-green-600 text-white text-xs px-3 py-1 rounded-lg hover:bg-green-700 transition shadow-sm flex items-center gap-1" 
                                            title="Marquer comme payé (Externe)"
                                        >
                                            <CreditCard className="w-3 h-3 pointer-events-none"/> Encaisser
                                        </button>
                                    )}
                                    
                                    {/* REMINDER BUTTON */}
                                    {doc.type === 'Devis' && doc.status === 'sent' && (
                                        <button 
                                            onClick={(e) => handleManualReminder(doc.id, e)} 
                                            className="text-slate-400 hover:text-orange-500 p-1 hover:bg-orange-50 rounded transition" 
                                            title="Forcer une relance maintenant"
                                        >
                                            <Zap className="w-4 h-4 pointer-events-none"/>
                                        </button>
                                    )}

                                    {/* DUPLICATE BUTTON */}
                                    <button 
                                        onClick={(e) => handleDuplicate(doc.id, doc.ref, e)} 
                                        className="text-slate-400 hover:text-brand-blue p-1 hover:bg-slate-100 rounded transition" 
                                        title="Dupliquer"
                                    >
                                        <Copy className="w-4 h-4 pointer-events-none"/>
                                    </button>
                                    
                                    {/* DELETE BUTTON */}
                                    <button 
                                        onClick={(e) => confirmDelete(doc.id, doc.ref, e)} 
                                        className="text-slate-400 hover:text-red-500 p-1 hover:bg-red-50 rounded transition" 
                                        title="Supprimer"
                                    >
                                        <Trash2 className="w-4 h-4 pointer-events-none"/>
                                    </button>
                                </div>
                            </td>
                        </tr>
                    ))
                ) : (
                    <tr><td colSpan={8} className="px-6 py-8 text-center text-slate-400">Aucun document trouvé.</td></tr>
                )}
            </tbody>
          </table>
      </div>
      
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto flex flex-col">
              <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-cream-50 rounded-t-2xl sticky top-0 z-10">
                <div><h3 className="text-2xl font-serif font-bold text-slate-800">{modalMode === 'devis' ? 'Édition de Devis' : 'Édition de Facture'}</h3><p className="text-xs text-slate-500 mt-1">Infos obligatoires <span className="text-red-500">*</span></p></div>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full transition"><X className="w-6 h-6 text-slate-500" /></button>
            </div>
            <div className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-8">
                 <div className="lg:col-span-7 space-y-8">
                    <section>
                        <h4 className="text-sm font-bold mb-4 flex items-center gap-2 text-slate-500 uppercase"><span className="bg-brand-blue text-white w-6 h-6 rounded-full flex items-center justify-center text-xs">1</span> Client (Autofill)</h4>
                        <select className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg mb-4" value={selectedClientId} onChange={(e) => setSelectedClientId(e.target.value)}>
                            <option value="">Sélectionner un client...</option>
                            {clients.map(c => <option key={c.id} value={c.id}>{c.name} - {c.city}</option>)}
                        </select>
                        
                        {/* Autofill Visualization */}
                        {selectedClient && (
                            <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 text-sm text-slate-700">
                                <p className="font-bold text-blue-800 mb-2 flex items-center gap-2"><CheckCircle className="w-3 h-3" /> Données chargées</p>
                                <div className="grid grid-cols-2 gap-2">
                                    <div><span className="text-xs text-slate-500 uppercase block">Nom</span><span className="font-bold">{selectedClient.name}</span></div>
                                    <div><span className="text-xs text-slate-500 uppercase block">Ville</span><span className="font-bold">{selectedClient.city}</span></div>
                                    <div><span className="text-xs text-slate-500 uppercase block">Téléphone</span><span className="font-bold">{selectedClient.phone}</span></div>
                                    <div><span className="text-xs text-slate-500 uppercase block">Email</span><span className="font-bold">{selectedClient.email}</span></div>
                                </div>
                            </div>
                        )}
                    </section>

                    <section>
                        <h4 className="text-sm font-bold mb-4 flex items-center gap-2 text-slate-500 uppercase"><span className="bg-brand-blue text-white w-6 h-6 rounded-full flex items-center justify-center text-xs">2</span> Prestation</h4>
                        <div className="grid grid-cols-2 gap-4 mb-4">
                            <button onClick={() => setServiceType('pack')} className={`p-3 border rounded-lg text-sm font-bold transition ${serviceType === 'pack' ? 'border-brand-blue bg-blue-50 text-brand-blue' : 'border-slate-200 text-slate-500'}`}>Pack Existant</button>
                            <button onClick={() => setServiceType('custom')} className={`p-3 border rounded-lg text-sm font-bold transition ${serviceType === 'custom' ? 'border-brand-blue bg-blue-50 text-brand-blue' : 'border-slate-200 text-slate-500'}`}>Sur Mesure</button>
                        </div>
                        {serviceType === 'pack' ? (
                            <div className="space-y-4">
                                <select className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg" value={selectedPackId} onChange={(e) => setSelectedPackId(e.target.value)}>
                                    <option value="">Sélectionner un pack...</option>
                                    {packs.map(p => <option key={p.id} value={p.id}>{p.name} - {p.priceHT}€ HT</option>)}
                                </select>
                                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"><span className="text-sm font-bold text-slate-600">Prix Unitaire HT</span><span className="font-mono font-bold text-slate-800">{unitPrice} €</span></div>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <input type="text" placeholder="Description de la prestation" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg" value={customDescription} onChange={(e) => setCustomDescription(e.target.value)} />
                                <div className="grid grid-cols-2 gap-4">
                                    <input type="number" placeholder="Prix Unitaire HT" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg" value={unitPrice} onChange={(e) => setUnitPrice(Number(e.target.value))} />
                                    <input type="number" placeholder="Quantité" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg" value={packQuantity} onChange={(e) => setPackQuantity(Number(e.target.value))} />
                                </div>
                            </div>
                        )}
                    </section>

                    {modalMode === 'devis' && selectedPackId && (
                        <section>
                             <h4 className="text-sm font-bold mb-4 flex items-center gap-2 text-slate-500 uppercase"><span className="bg-brand-blue text-white w-6 h-6 rounded-full flex items-center justify-center text-xs">3</span> Planification Prévisionnelle</h4>
                             
                             {/* Specific Use Case Controls based on Pack Name */}
                             
                             {/* CAS 1: PACK TRANQUILITY (12h) */}
                             {packNameIncludes('Tranquility') && (
                                 <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 mb-4 space-y-4 animate-in fade-in">
                                     <div className="flex justify-between items-center">
                                         <label className="text-sm font-bold text-slate-700">Fréquence :</label>
                                         <select 
                                            className="p-2 border rounded-lg bg-white text-sm font-bold"
                                            value={packSpecificConfig.frequencyChoice || "4j_3h"}
                                            onChange={(e) => setPackSpecificConfig({...packSpecificConfig, frequencyChoice: e.target.value})}
                                         >
                                             <option value="4j_3h">4 jours x 3 heures</option>
                                             <option value="3j_4h">3 jours x 4 heures</option>
                                         </select>
                                     </div>
                                     <p className="text-xs text-blue-600">Le pack Tranquility compte 12 heures ajustables.</p>
                                     <button onClick={generateSlots} className="w-full bg-blue-600 text-white py-2 rounded font-bold text-xs hover:bg-blue-700">
                                         Générer les créneaux
                                     </button>
                                 </div>
                             )}

                             {/* CAS 2: PACK ULTIME 6 (6h) */}
                             {packNameIncludes('Ultime 6') && (
                                 <div className="bg-purple-50 p-4 rounded-lg border border-purple-100 mb-4 space-y-4 animate-in fade-in">
                                     <div className="flex items-center gap-2 text-purple-800 font-bold text-sm">
                                         <Zap className="w-4 h-4"/> Pack Ultime 6 (Journée unique)
                                     </div>
                                     <p className="text-xs text-purple-600">Le pack Ultime 6 compte 6 heures en 1 journée.</p>
                                     <div className="flex items-center gap-2 bg-white p-2 rounded border border-purple-200 text-xs">
                                         <AlertTriangle className="w-3 h-3 text-orange-500" /> Ces créneaux sont libres : aucun client n'a réservé à ces heures.
                                     </div>
                                 </div>
                             )}

                             {/* CAS 3: PACK PERSONNALISÉ */}
                             {packNameIncludes('personnalisé') && (
                                 <div className="bg-slate-100 p-4 rounded-lg border border-slate-200 mb-4 space-y-4 animate-in fade-in">
                                     <div className="grid grid-cols-2 gap-4">
                                         <div>
                                             <label className="block text-xs font-bold text-slate-500 mb-1">Nbre de jours</label>
                                             <input 
                                                type="number" 
                                                className="w-full p-2 border rounded bg-white font-bold"
                                                min="1"
                                                value={packSpecificConfig.customDays || 1}
                                                onChange={(e) => setPackSpecificConfig({...packSpecificConfig, customDays: parseInt(e.target.value)})}
                                             />
                                         </div>
                                         <div>
                                             <label className="block text-xs font-bold text-slate-500 mb-1">Nbre d'heures (Total)</label>
                                             <input 
                                                type="number" 
                                                className="w-full p-2 border rounded bg-white font-bold"
                                                min="1"
                                                value={packSpecificConfig.customTotalHours || 2}
                                                onChange={(e) => setPackSpecificConfig({...packSpecificConfig, customTotalHours: parseInt(e.target.value)})}
                                             />
                                         </div>
                                     </div>
                                     <button onClick={generateSlots} className="w-full bg-slate-700 text-white py-2 rounded font-bold text-xs hover:bg-slate-800">
                                         Calculer et Générer
                                     </button>
                                 </div>
                             )}

                             {/* SLOTS DISPLAY */}
                             <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                                 <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 flex justify-between items-center">
                                     <span className="text-xs font-bold text-slate-500 uppercase">Dates d'intervention</span>
                                     <button onClick={addNewSlot} className="text-brand-blue hover:bg-blue-50 p-1 rounded"><PlusCircle className="w-4 h-4"/></button>
                                 </div>
                                 
                                 {interventionSlots.length === 0 ? (<div className="p-6 text-center text-slate-400 text-sm">Aucun créneau défini. Cliquez sur générer ou ajoutez manuellement.</div>) : (
                                     interventionSlots.map((slot, index) => (
                                         <div key={slot.id} className="p-3 border-b border-slate-100 last:border-0 flex items-center gap-3 hover:bg-slate-50">
                                             <span className="text-xs font-bold text-slate-400 w-4">{index + 1}</span>
                                             <input type="date" className="flex-1 p-2 border rounded bg-white text-sm" value={slot.date} onChange={(e) => updateSlot(index, 'date', e.target.value)} />
                                             <div className="flex items-center gap-1">
                                                 <input type="time" className="p-2 border rounded bg-white text-sm w-20 text-center" value={slot.startTime} onChange={(e) => updateSlot(index, 'startTime', e.target.value)} />
                                                 <span className="text-slate-400 text-xs">à</span>
                                                 <input type="time" className="p-2 border rounded bg-white text-sm w-20 text-center" value={slot.endTime} onChange={(e) => updateSlot(index, 'endTime', e.target.value)} />
                                             </div>
                                             <span className="text-xs font-bold bg-green-100 text-green-700 px-2 py-1 rounded w-12 text-center">{slot.duration}h</span>
                                             <button onClick={() => removeSlot(index)} className="text-red-400 hover:text-red-600"><X className="w-4 h-4"/></button>
                                         </div>
                                     ))
                                 )}
                                 
                                 {/* Total calculation */}
                                 {interventionSlots.length > 0 && (
                                     <div className="p-3 bg-slate-50 text-right text-xs font-bold text-slate-600 border-t border-slate-200">
                                         Total : <span className="text-brand-blue text-sm">{interventionSlots.reduce((acc, s) => acc + s.duration, 0)} heures</span>
                                     </div>
                                 )}
                             </div>
                             
                             <p className="text-[10px] text-slate-400 mt-2 italic">
                                 Les créneaux sont reportés sur le contrat avec les informations clients.
                                 La signature du devis entraîne la signature du contrat après lecture par le client.
                             </p>
                        </section>
                    )}
                    <div className="flex justify-end">
                        <button 
                            className="px-6 py-2 rounded-lg bg-brand-blue text-white font-bold hover:bg-teal-700 flex items-center gap-2 disabled:opacity-50" 
                            onClick={handleSuccess} 
                            disabled={!selectedClientId || isSubmitting}
                        >
                            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin"/> : <CheckCircle className="w-4 h-4" />} 
                            {isSubmitting ? 'Traitement...' : 'Valider et Envoyer'}
                        </button>
                    </div>
                 </div>

                 <div className="lg:col-span-5 bg-slate-50 p-6 rounded-xl h-fit border border-slate-200">
                     <div className="flex justify-between items-start mb-6">
                         <h4 className="font-serif font-bold text-xl text-slate-800">Récapitulatif</h4>
                         {modalMode === 'devis' && (
                             <div className="text-right text-xs">
                                 <p className="text-slate-500">Durée de validité du devis</p>
                                 <p className="font-bold text-red-600">24 heures</p>
                             </div>
                         )}
                     </div>

                     {/* 24h Warning */}
                     {modalMode === 'devis' && (
                         <div className="bg-orange-50 p-3 rounded-lg border border-orange-200 mb-4 text-xs text-orange-800 flex items-start gap-2">
                             <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                             <p>
                                 <strong>Attention :</strong> Si ce devis n’est pas validé par le client sous 24h, les dates prévisionnelles indiquées ci-contre ne seront pas bloquées.
                             </p>
                         </div>
                     )}
                     
                     <div className="bg-white p-4 rounded-lg border border-slate-200 mb-4 shadow-sm text-sm">
                         <table className="w-full mb-4">
                             <thead>
                                 <tr className="text-xs text-slate-400 border-b border-slate-100">
                                     <th className="text-left py-2 font-bold uppercase">Description</th>
                                     <th className="text-center py-2 font-bold uppercase">Prix U.</th>
                                     <th className="text-center py-2 font-bold uppercase">Qté</th>
                                     <th className="text-right py-2 font-bold uppercase">Total HT</th>
                                 </tr>
                             </thead>
                             <tbody>
                                 <tr>
                                     <td className="py-3 text-slate-700 font-medium">{customDescription || "Pack..."}</td>
                                     <td className="py-3 text-center text-slate-500">{unitPrice.toFixed(2)}€</td>
                                     <td className="py-3 text-center text-slate-700">{packQuantity}</td>
                                     <td className="py-3 text-right text-slate-800 font-bold">{totalHT.toFixed(2)} €</td>
                                 </tr>
                             </tbody>
                         </table>
                         
                         <div className="space-y-2 pt-2 border-t border-slate-100 text-slate-600">
                             <div className="flex justify-between"><span>Total HT</span><span>{totalHT.toFixed(2)} €</span></div>
                             <div className="flex justify-between items-center">
                                 <span>TVA</span>
                                 <select 
                                     className="bg-slate-50 border rounded p-1 text-xs font-bold text-slate-700 outline-none focus:border-brand-blue" 
                                     value={tvaRate} 
                                     onChange={(e) => setTvaRate(Number(e.target.value) as any)}
                                 >
                                     <option value={0}>0%</option>
                                     <option value={2.1}>2.1% (Particulier)</option>
                                     <option value={8.5}>8.5% (Professionnel)</option>
                                 </select>
                             </div>
                             <div className="flex justify-between text-slate-500 text-xs"><span>Montant TVA</span><span>{tvaAmount.toFixed(2)} €</span></div>
                         </div>
                         <div className="flex justify-between font-bold text-lg text-slate-800 pt-4 border-t border-slate-100 mt-2"><span>Total TTC</span><span>{totalTTC.toFixed(2)} €</span></div>
                     </div>

                     {/* TAX CREDIT SECTION */}
                     <div className="bg-white p-4 rounded-lg border border-slate-200 mb-6">
                         <div className="flex items-center justify-between mb-3">
                             <span className="text-sm font-bold text-slate-700">Avance immédiate (Crédit d'impôt)</span>
                             <div 
                                 onClick={() => setTaxCreditActive(!taxCreditActive)} 
                                 className={`w-10 h-6 rounded-full p-1 cursor-pointer transition-colors ${taxCreditActive ? 'bg-green-500' : 'bg-slate-300'}`}
                             >
                                 <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${taxCreditActive ? 'translate-x-4' : ''}`}></div>
                             </div>
                         </div>
                         
                         <div className={`text-xs p-2 rounded mb-2 font-bold border ${taxCreditActive ? 'bg-green-50 text-green-800 border-green-100' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                             Statut : {taxCreditActive ? "ACTIVÉ (-50%)" : "NON ACTIVÉ"}
                         </div>

                         {taxCreditActive ? (
                             <div className="text-xs text-slate-600 space-y-3 animate-in fade-in">
                                 <p className="italic border-l-2 border-green-300 pl-2 bg-green-50/50 p-1">
                                     "Conformément à l’article 199 sexdecies du CGI, les prestations ouvrent droit à un crédit d’impôt de 50 %."
                                 </p>
                                 <div className="pt-2 border-t border-dashed border-slate-200 space-y-1">
                                     <div className="flex justify-between font-bold text-brand-blue text-sm pt-1">
                                         <span>Reste à charge client</span>
                                         <span>{clientToPay.toFixed(2)} €</span>
                                     </div>
                                     <div className="flex justify-between text-green-600 text-xs">
                                         <span>Montant URSSAF (Avance immédiate)</span>
                                         <span className="font-bold">{taxCreditAmount.toFixed(2)} €</span>
                                     </div>
                                 </div>
                             </div>
                         ) : (
                             <div className="text-xs text-slate-400 italic">
                                 Le client paiera la totalité du montant TTC.
                             </div>
                         )}
                     </div>
                     
                     {modalMode === 'devis' && (<div className="space-y-2"><div className="p-3 bg-slate-100 rounded-lg border border-slate-200 text-slate-600 text-xs flex items-center gap-2"><Paperclip className="w-4 h-4 text-slate-400"/><span>Le contrat de prestation sera automatiquement joint à l'email.</span></div></div>)}
                 </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && (documentToDelete || isBulkDelete) && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
              <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm animate-in fade-in zoom-in duration-200">
                  <div className="flex flex-col items-center text-center">
                      <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-4">
                          <AlertTriangle className="w-6 h-6" />
                      </div>
                      <h3 className="text-lg font-bold text-slate-800 mb-2">Confirmer la suppression</h3>
                      <p className="text-sm text-slate-500 mb-6">
                          Êtes-vous sûr de vouloir supprimer {isBulkDelete ? `${selectedIds.size} document(s)` : `le document ${documentToDelete?.ref}`} ? Cette action est irréversible.
                      </p>
                      <div className="flex gap-3 w-full">
                          <button 
                              onClick={() => setIsDeleteModalOpen(false)}
                              className="flex-1 py-2 text-slate-600 font-bold bg-slate-100 hover:bg-slate-200 rounded-lg transition"
                          >
                              Annuler
                          </button>
                          <button 
                              onClick={executeDelete}
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

export default DevisFactures;
