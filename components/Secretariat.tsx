

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
    PackagePlus, 
    FileSignature, 
    CalendarX, 
    StickyNote, 
    CheckCircle, 
    Plus,
    Bell,
    Mail,
    ArrowRight,
    ArrowLeft,
    Check,
    FileText, 
    Stamp,
    MessageSquare,
    User,
    Send,
    Search,
    Euro,
    Paperclip,
    Edit,
    AlertTriangle,
    ExternalLink,
    Trash2,
    CheckSquare,
    Square,
    X,
    Save,
    ChevronRight,
    ChevronLeft,
    Clock,
    TrendingUp,
    Briefcase
} from 'lucide-react';
import { useData } from '../context/DataContext';
import { Pack, Reminder, Message, Client, Expense, Contract, Mission } from '../types';
import { useNavigate } from 'react-router-dom';

type Tab = 'packs' | 'absences' | 'agenda' | 'messaging' | 'expenses';

// EXACT LIST FROM PDF OCR
const SAP_SERVICES = [
    "Entretien de la maison et travaux ménagers",
    "Repassage à domicile",
    "Préparation de repas à domicile",
    "Livraison de repas à domicile",
    "Jardinage",
    "Petit bricolage (homme toutes mains)",
    "Maintenance et vigilance temporaire de domicile (gardiennage)",
    "Assistance administrative à domicile",
    "Accompagnement des personnes âgées ou handicapées",
    "Aide à la mobilité / Transport accompagné",
    "Soins d'esthétique à domicile pour personnes dépendantes",
    "Soutien scolaire à domicile",
    "Cours à domicile (hors scolaire)",
    "Assistance informatique et numérique à domicile",
    "Assistance aux démarches en ligne",
    "Surveillance et garde d'enfants à domicile",
    "Conduite du véhicule personnel des personnes dépendantes",
    "Téléassistance et visio-assistance"
];

const Secretariat: React.FC = () => {
  const { 
      packs, 
      addPack, 
      deletePacks,
      providers, 
      reminders, 
      addReminder, 
      toggleReminder, 
      contracts, 
      updateContract, 
      addContract,
      messages, 
      clients, 
      replyToClient, 
      expenses, 
      addExpense, 
      companySettings,
      missions,
      legalTemplate,
      updateLeaveStatus
  } = useData();

  const [activeTab, setActiveTab] = useState<Tab>('packs');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'pack' | 'contract' | 'reminder' | 'expense'>('pack');
  const navigate = useNavigate();
  
  // Delete Modal State
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  
  // Selection State for Packs
  const [selectedPackIds, setSelectedPackIds] = useState<Set<string>>(new Set());

  // Toast
  const [toast, setToast] = useState<{ show: boolean; message: string }>({ show: false, message: '' });
  const showToast = (message: string) => {
    setToast({ show: true, message });
    setTimeout(() => setToast({ show: false, message: '' }), 3000);
  };

  // --- MESSAGING STATE ---
  const [selectedChatClientId, setSelectedChatClientId] = useState<string | null>(null);
  const [adminMessageInput, setAdminMessageInput] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom of chat
  useEffect(() => {
      if(activeTab === 'messaging' && selectedChatClientId) {
          chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }
  }, [messages, selectedChatClientId, activeTab]);

  // --- PACK FORM STATE (UPDATED TO MATCH PDF PROCESS) ---
  const [packStep, setPackStep] = useState(1);
  const [packForm, setPackForm] = useState<Partial<Pack>>({
      type: 'ponctuel',
      hours: 3,
      frequency: 'Ponctuelle', // Default per PDF
      priceHT: 0,
      suppliesIncluded: false,
      isSap: true,
      quantity: '',
      location: 'Domicile Client',
      schedules: []
  });

  // --- CONTRACT EDIT STATE ---
  const [contractForm, setContractForm] = useState<Partial<Contract>>({ name: '', content: '' });
  
  // Contract specific selectors for PDF Logic
  const [selectedClientIdForContract, setSelectedClientIdForContract] = useState<string>('');
  const [selectedPackIdForContract, setSelectedPackIdForContract] = useState<string>('');
  const [contractLogoType, setContractLogoType] = useState<'SAP' | 'Standard'>('SAP');

  // Reminder Form
  const [reminderForm, setReminderForm] = useState<Partial<Reminder>>({
      notifyEmail: false
  });

  // Expense Form
  const [expenseForm, setExpenseForm] = useState<Partial<Expense>>({
      category: 'fournitures',
      amount: 0
  });

  const handleNextPackStep = () => {
      if (packStep === 1 && !packForm.name) { alert("Le nom du pack est obligatoire."); return; }
      if (packStep === 2 && !packForm.mainService) { alert("Veuillez choisir un service principal."); return; }
      setPackStep(prev => prev + 1);
  };

  const handlePrevPackStep = () => setPackStep(prev => prev - 1);

  const handleSavePack = async () => {
      const priceHT = packForm.priceHT || 0;
      const tva = 0.021; // 2.1% from PDF
      const priceTTC = priceHT * (1 + tva);
      const taxCredit = priceTTC * 0.5;

      const newPack: Pack = {
            id: `p-${Date.now()}`, // Temporary ID, Context will re-generate valid UUID if needed
            name: packForm.name || 'Nouveau Pack',
            mainService: packForm.mainService || 'Service',
            description: `Pack ${packForm.name} - ${packForm.mainService}`,
            hours: packForm.hours || 3,
            frequency: packForm.frequency || 'Ponctuelle',
            type: packForm.frequency === 'Ponctuelle' ? 'ponctuel' : 'regulier',
            quantity: packForm.quantity,
            location: packForm.location,
            priceHT: priceHT,
            priceTaxCredit: parseFloat(taxCredit.toFixed(2)),
            suppliesIncluded: packForm.suppliesIncluded || false,
            suppliesDetails: packForm.suppliesDetails,
            contractType: 'Contrat SAP Standard',
            isSap: true,
            schedules: []
      };
        
      await addPack(newPack); 
      showToast('Pack créé avec succès selon le processus standard !');
      closePackModal();
  };

  const closePackModal = () => {
      setIsModalOpen(false);
      setPackStep(1);
      setPackForm({ 
          type: 'ponctuel', 
          hours: 3, 
          frequency: 'Ponctuelle', 
          priceHT: 0, 
          suppliesIncluded: false, 
          isSap: true, 
          quantity: '',
          location: 'Domicile Client',
          schedules: [] 
      });
  };
  
  // Pack Selection Logic
  const togglePackSelection = (id: string) => {
      const newSet = new Set(selectedPackIds);
      if (newSet.has(id)) {
          newSet.delete(id);
      } else {
          newSet.add(id);
      }
      setSelectedPackIds(newSet);
  };
  
  const confirmDeletePacks = () => {
      if (selectedPackIds.size > 0) {
          setDeleteConfirmOpen(true);
      }
  };

  const executeDeletePacks = async () => {
      await deletePacks(Array.from(selectedPackIds));
      setSelectedPackIds(new Set());
      setDeleteConfirmOpen(false);
      showToast('Packs supprimés avec succès.');
  };

  const openContractModal = (contract?: Contract) => {
      if (contract) {
          setContractForm(contract);
          setSelectedClientIdForContract(''); // Reset selectors on edit
          setSelectedPackIdForContract(contract.packId || '');
          setContractLogoType(contract.isSap ? 'SAP' : 'Standard');
      } else {
          setContractForm({
              id: `c-${Date.now()}`, // Temporary, will be generated by context
              name: 'Nouveau Contrat',
              content: legalTemplate,
              status: 'draft'
          });
          setSelectedClientIdForContract('');
          setSelectedPackIdForContract('');
          setContractLogoType('SAP');
      }
      setModalType('contract');
      setIsModalOpen(true);
  };
  
  const handleGenerateContractContent = () => {
      let content = legalTemplate;
      
      // Inject Client Info
      const client = clients.find(c => c.id === selectedClientIdForContract);
      if (client) {
          const clientInfo = `Nom : ${client.name}\nAdresse : ${client.address}, ${client.city}\nTéléphone : ${client.phone}\nEmail : ${client.email}`;
          content = content.replace('[INFO_CLIENT]', clientInfo);
      } else {
          content = content.replace('[INFO_CLIENT]', '[À COMPLÉTER PAR LE CLIENT]');
      }

      // Inject Pack Info
      const pack = packs.find(p => p.id === selectedPackIdForContract);
      if (pack) {
          const packInfo = `Nom du Pack : ${pack.name}\nService : ${pack.mainService}\nDurée : ${pack.hours}h (${pack.frequency})\nQuantité : ${pack.quantity || 'Standard'}\nLieu : ${pack.location || 'Domicile Client'}\nTarif HT : ${pack.priceHT} €\nMatériel inclus : ${pack.suppliesIncluded ? 'Oui' : 'Non'}`;
          content = content.replace('[INFO_PACK]', packInfo);
      } else {
          content = content.replace('[INFO_PACK]', '[SÉLECTIONNEZ UN PACK]');
      }
      
      // Inject Date
      content = content.replace('[DATE]', new Date().toLocaleDateString());

      setContractForm(prev => ({ ...prev, content, packId: selectedPackIdForContract }));
      showToast("Contrat généré avec les informations sélectionnées.");
  };

  const handleSaveContract = () => {
      const contractPayload = {
          ...contractForm,
          isSap: contractLogoType === 'SAP'
      } as Contract;

      if (contractForm.id && contractForm.name) {
          const existing = contracts.find(c => c.id === contractForm.id);
          if (existing) {
              updateContract(existing.id, { 
                  name: contractForm.name, 
                  content: contractForm.content,
                  status: 'draft',
                  isSap: contractLogoType === 'SAP' // Ensure choice is saved on update too
              });
              showToast('Contrat modifié. Veuillez demander la validation.');
          } else {
              addContract(contractPayload);
              showToast('Nouveau contrat créé.');
          }
          setIsModalOpen(false);
      }
  };

  const handleRequestValidation = (contractId: string) => {
      updateContract(contractId, { status: 'pending_validation' });
      showToast('Demande de validation envoyée à l\'administrateur par email.');
  };

  const handleSaveReminder = () => {
      if (reminderForm.text && reminderForm.date) {
          addReminder({
              id: `r-${Date.now()}`,
              text: reminderForm.text,
              date: reminderForm.date,
              notifyEmail: reminderForm.notifyEmail || false,
              completed: false
          });
          showToast(reminderForm.notifyEmail ? 'Rappel enregistré avec notification email.' : 'Rappel enregistré.');
          setIsModalOpen(false);
      }
  };

  const handleSaveExpense = () => {
      if (expenseForm.description && expenseForm.amount && expenseForm.date) {
          addExpense({
              id: `e-${Date.now()}`,
              description: expenseForm.description,
              amount: expenseForm.amount,
              date: expenseForm.date,
              category: expenseForm.category || 'autre',
              proofUrl: 'https://via.placeholder.com/150'
          });
          showToast('Dépense ajoutée à la comptabilité.');
          setIsModalOpen(false);
          setExpenseForm({ category: 'fournitures', amount: 0 });
      }
  };
  
  const handleAdminValidation = (contractId: string) => {
      updateContract(contractId, { 
          status: 'active', 
          validationDate: new Date().toLocaleDateString()
      });
      showToast('Contrat validé par l\'administration. Cachet apposé.');
  };

  const handleSendAdminMessage = (e: React.FormEvent) => {
      e.preventDefault();
      if (selectedChatClientId && adminMessageInput.trim()) {
          replyToClient(adminMessageInput, selectedChatClientId);
          setAdminMessageInput('');
      }
  };

  const handleLeaveStatusUpdate = async (leaveId: string, providerId: string, status: 'approved' | 'rejected') => {
      await updateLeaveStatus(leaveId, providerId, status);
      showToast(status === 'approved' ? 'Absence validée.' : 'Absence refusée.');
  };

  // --- ABSENCE CONFLICT LOGIC ---
  const absenceConflicts = useMemo(() => {
      const conflicts: { mission: Mission, providerName: string, leaveStart: string, leaveEnd: string }[] = [];
      providers.forEach(provider => {
          provider.leaves.forEach(leave => {
              const start = new Date(leave.startDate);
              const end = new Date(leave.endDate);
              
              // Find missions during this leave
              const providerMissions = missions.filter(m => m.providerId === provider.id && m.status === 'planned');
              providerMissions.forEach(mission => {
                  if (mission.date) {
                      const missionDate = new Date(mission.date);
                      if (missionDate >= start && missionDate <= end) {
                          conflicts.push({
                              mission,
                              providerName: `${provider.firstName} ${provider.lastName}`,
                              leaveStart: leave.startDate,
                              leaveEnd: leave.endDate
                          });
                      }
                  }
              });
          });
      });
      return conflicts;
  }, [providers, missions]);

  const companyHeader = `${companySettings.name} – SASU\nSiège : ${companySettings.address}\nN° SIRET : ${companySettings.siret}`;

  // Get unique clients who have messages for Chat UI
  const chatClients = clients; 
  const currentChatMessages = messages.filter(m => m.clientId === selectedChatClientId);

  // Agenda Data (Sorted Missions)
  const agendaMissions = useMemo(() => {
      return [...missions]
        .filter(m => m.status === 'planned')
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [missions]);

  // Expenses Stats
  const totalExpenses = expenses.reduce((acc, curr) => acc + curr.amount, 0);

  return (
    <div className="p-8 h-full overflow-y-auto bg-white/40 relative">
      {/* Toast */}
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

      <h2 className="text-3xl font-serif font-bold text-slate-800 mb-6">Secrétariat</h2>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 mb-6 bg-slate-100 p-1 rounded-lg w-fit">
          <button 
            onClick={() => setActiveTab('packs')}
            className={`px-4 py-2 rounded-md text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'packs' ? 'bg-white text-brand-blue shadow-sm' : 'text-slate-500'}`}
          >
              <PackagePlus className="w-4 h-4" /> Packs & Contrats
          </button>
          <button 
            onClick={() => setActiveTab('absences')}
            className={`px-4 py-2 rounded-md text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'absences' ? 'bg-white text-brand-blue shadow-sm' : 'text-slate-500'}`}
          >
              <CalendarX className="w-4 h-4" /> Absences
          </button>
          <button 
            onClick={() => setActiveTab('agenda')}
            className={`px-4 py-2 rounded-md text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'agenda' ? 'bg-white text-brand-blue shadow-sm' : 'text-slate-500'}`}
          >
              <StickyNote className="w-4 h-4" /> Agenda
          </button>
          <button 
            onClick={() => setActiveTab('messaging')}
            className={`px-4 py-2 rounded-md text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'messaging' ? 'bg-white text-brand-blue shadow-sm' : 'text-slate-500'}`}
          >
              <MessageSquare className="w-4 h-4" /> Messagerie
          </button>
          <button 
            onClick={() => setActiveTab('expenses')}
            className={`px-4 py-2 rounded-md text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'expenses' ? 'bg-white text-brand-blue shadow-sm' : 'text-slate-500'}`}
          >
              <Euro className="w-4 h-4" /> Comptabilité
          </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 min-h-[500px] p-6">
          
          {/* --- TAB: PACKS & CONTRACTS --- */}
          {activeTab === 'packs' && (
              <div className="space-y-8">
                  <div className="flex justify-between items-center">
                      <div className="flex items-center gap-3">
                          <h3 className="text-lg font-bold text-slate-700">Gestion des Packs</h3>
                          {selectedPackIds.size > 0 && (
                              <button onClick={confirmDeletePacks} className="bg-red-500 text-white px-3 py-1 rounded text-xs font-bold flex items-center gap-1 hover:bg-red-600 animate-in fade-in">
                                  <Trash2 className="w-3 h-3" /> Supprimer ({selectedPackIds.size})
                              </button>
                          )}
                      </div>
                      <button onClick={() => { setModalType('pack'); setPackStep(1); setIsModalOpen(true); }} className="bg-brand-blue text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-teal-700">
                          <Plus className="w-4 h-4" /> Créer un Pack
                      </button>
                  </div>
                  {/* Packs List */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {packs.map(pack => (
                          <div key={pack.id} className={`border rounded-lg p-4 hover:shadow-md transition bg-cream-50/30 relative ${selectedPackIds.has(pack.id) ? 'border-brand-blue ring-1 ring-brand-blue' : 'border-slate-200'}`}>
                              <button 
                                onClick={() => togglePackSelection(pack.id)}
                                className="absolute top-2 right-2 text-slate-400 hover:text-brand-blue"
                              >
                                  {selectedPackIds.has(pack.id) ? <CheckSquare className="w-5 h-5 text-brand-blue"/> : <Square className="w-5 h-5"/>}
                              </button>
                              
                              <div className="flex justify-between items-start mb-2 pr-6">
                                  <h4 className="font-bold text-slate-800">{pack.name}</h4>
                              </div>
                              <span className="bg-blue-100 text-brand-blue text-xs px-2 py-1 rounded-full font-bold mb-2 inline-block">{pack.frequency}</span>
                              <p className="text-xs text-slate-500 mb-3 line-clamp-2 font-bold">{pack.mainService}</p>
                              
                              <div className="text-xs text-slate-500 mb-2">
                                  {pack.quantity && <span className="block">Quantité: {pack.quantity}</span>}
                                  {pack.location && <span className="block">Lieu: {pack.location}</span>}
                              </div>

                              <div className="flex justify-between text-sm font-bold text-slate-700 border-t border-slate-100 pt-2">
                                  <span>{pack.hours}h</span>
                                  <span>{pack.priceHT}€ HT</span>
                              </div>
                              <div className="mt-2 flex items-center justify-between">
                                  <span className="text-xs text-green-600 font-medium">
                                    Crédit Impôt: {pack.priceTaxCredit}€
                                  </span>
                                  {pack.isSap && <span className="text-[10px] bg-brand-blue text-white px-1 rounded">SAP</span>}
                              </div>
                          </div>
                      ))}
                  </div>
                  <div className="border-t border-slate-100 my-6"></div>
                  <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-bold text-slate-700">Contrats Associés</h3>
                      <button onClick={() => openContractModal()} className="text-brand-blue text-sm font-bold hover:underline flex items-center gap-1">
                          <Plus className="w-3 h-3" /> Nouveau Contrat Standard
                      </button>
                  </div>
                  <div className="space-y-3">
                      {contracts.map(contract => (
                          <div key={contract.id} className={`flex items-center justify-between p-4 border rounded-lg ${contract.status === 'pending_validation' ? 'border-orange-200 bg-orange-50' : 'border-slate-200'}`}>
                              <div className="flex items-center gap-3">
                                  <div className="p-2 bg-slate-100 rounded">
                                      <FileSignature className="w-5 h-5 text-slate-500" />
                                  </div>
                                  <div>
                                      <p className="font-bold text-slate-700">{contract.name}</p>
                                      <div className="flex items-center gap-2 mt-1">
                                          {contract.status === 'draft' && <span className="text-xs bg-slate-200 text-slate-600 px-2 rounded font-bold">Brouillon</span>}
                                          {contract.status === 'pending_validation' && <span className="text-xs bg-orange-200 text-orange-800 px-2 rounded font-bold">En attente validation</span>}
                                          {contract.status === 'active' && <span className="text-xs bg-green-200 text-green-800 px-2 rounded font-bold flex items-center gap-1"><CheckCircle className="w-3 h-3"/> Validé & Cacheté</span>}
                                          {contract.isSap && <span className="text-[10px] bg-blue-100 text-blue-800 px-1.5 rounded font-bold border border-blue-200">SAP</span>}
                                      </div>
                                  </div>
                              </div>
                              <div className="flex items-center gap-2">
                                  <button 
                                    onClick={() => openContractModal(contract)}
                                    className="text-slate-400 hover:text-brand-blue p-1 border border-transparent hover:border-slate-200 rounded" 
                                    title="Modifier / Renommer"
                                  >
                                      <Edit className="w-4 h-4" />
                                  </button>
                                  
                                  {contract.status === 'draft' && (
                                      <button 
                                        onClick={() => handleRequestValidation(contract.id)}
                                        className="text-brand-orange hover:text-orange-700 transition text-xs font-bold px-3 py-1 rounded flex items-center gap-1 bg-orange-50 border border-orange-200"
                                      >
                                          <Mail className="w-3 h-3" /> Demander Validation
                                      </button>
                                  )}

                                  {contract.status === 'pending_validation' && (
                                      <button 
                                        onClick={() => handleAdminValidation(contract.id)}
                                        className="text-brand-blue hover:text-teal-700 transition text-xs font-bold border border-brand-blue/30 px-3 py-1 rounded flex items-center gap-1 bg-blue-50"
                                      >
                                          <Stamp className="w-3 h-3" /> Valider (Admin)
                                      </button>
                                  )}
                              </div>
                          </div>
                      ))}
                  </div>
              </div>
          )}

          {/* --- TAB: AGENDA --- */}
          {activeTab === 'agenda' && (
              <div>
                  <div className="flex items-center justify-between mb-6">
                      <h3 className="text-lg font-bold text-slate-700">Agenda des Missions</h3>
                      <button onClick={() => navigate('/planning')} className="text-sm text-brand-blue font-bold hover:underline flex items-center gap-1">
                          Voir Planning Complet <ArrowRight className="w-4 h-4" />
                      </button>
                  </div>
                  {agendaMissions.length === 0 ? (
                      <div className="text-center p-8 text-slate-400 bg-slate-50 rounded-lg">
                          <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                          Aucune mission planifiée prochainement.
                      </div>
                  ) : (
                      <div className="space-y-3">
                          {agendaMissions.map(mission => (
                              <div key={mission.id} className="flex items-center p-4 border rounded-lg hover:shadow-sm bg-white transition border-slate-200">
                                  <div className="flex flex-col items-center justify-center w-16 h-16 bg-blue-50 rounded-lg text-brand-blue mr-4">
                                      <span className="text-xs font-bold uppercase">{new Date(mission.date).toLocaleString('default', { month: 'short' })}</span>
                                      <span className="text-xl font-bold">{new Date(mission.date).getDate()}</span>
                                  </div>
                                  <div className="flex-1">
                                      <div className="flex justify-between items-start">
                                          <h4 className="font-bold text-slate-800">{mission.clientName}</h4>
                                          <span className="text-xs font-bold bg-slate-100 text-slate-600 px-2 py-1 rounded">{mission.startTime} - {mission.endTime}</span>
                                      </div>
                                      <p className="text-sm text-slate-600">{mission.service}</p>
                                      <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                                          <User className="w-3 h-3" />
                                          {mission.providerName || "À assigner"}
                                      </div>
                                  </div>
                              </div>
                          ))}
                      </div>
                  )}
              </div>
          )}

          {/* --- TAB: MESSAGING --- */}
          {activeTab === 'messaging' && (
              <div className="flex h-[600px] border rounded-lg overflow-hidden">
                  {/* Sidebar Users */}
                  <div className="w-1/3 border-r border-slate-200 bg-slate-50 overflow-y-auto">
                      <div className="p-4 border-b bg-white font-bold text-slate-700">Conversations</div>
                      {chatClients.map(client => (
                          <div 
                              key={client.id}
                              onClick={() => setSelectedChatClientId(client.id)}
                              className={`p-4 border-b cursor-pointer hover:bg-blue-50 transition ${selectedChatClientId === client.id ? 'bg-blue-100 border-l-4 border-l-brand-blue' : ''}`}
                          >
                              <div className="font-bold text-slate-800 text-sm">{client.name}</div>
                              <div className="text-xs text-slate-500 truncate">{client.city}</div>
                          </div>
                      ))}
                  </div>

                  {/* Chat Area */}
                  <div className="w-2/3 flex flex-col bg-white">
                      {selectedChatClientId ? (
                          <>
                              <div className="p-4 border-b bg-slate-50 flex justify-between items-center">
                                  <span className="font-bold text-slate-700">{chatClients.find(c => c.id === selectedChatClientId)?.name}</span>
                              </div>
                              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/30">
                                  {currentChatMessages.length === 0 ? (
                                      <div className="text-center text-slate-400 text-sm mt-10">Aucun message. Démarrer la conversation.</div>
                                  ) : (
                                      currentChatMessages.map(msg => (
                                          <div key={msg.id} className={`flex ${msg.sender === 'admin' ? 'justify-end' : 'justify-start'}`}>
                                              <div className={`max-w-[80%] p-3 rounded-xl text-sm shadow-sm ${msg.sender === 'admin' ? 'bg-brand-blue text-white rounded-tr-none' : 'bg-white text-slate-800 border border-slate-200 rounded-tl-none'}`}>
                                                  <p>{msg.text}</p>
                                                  <span className={`text-[10px] block text-right mt-1 ${msg.sender === 'admin' ? 'text-blue-200' : 'text-slate-400'}`}>{msg.date}</span>
                                              </div>
                                          </div>
                                      ))
                                  )}
                                  <div ref={chatEndRef} />
                              </div>
                              <form onSubmit={handleSendAdminMessage} className="p-4 border-t bg-white flex gap-2">
                                  <input 
                                      type="text" 
                                      className="flex-1 border rounded-lg px-4 py-2 text-sm outline-none focus:border-brand-blue"
                                      placeholder="Votre réponse..."
                                      value={adminMessageInput}
                                      onChange={e => setAdminMessageInput(e.target.value)}
                                  />
                                  <button type="submit" className="bg-brand-blue text-white p-2 rounded-lg hover:bg-teal-700 disabled:opacity-50" disabled={!adminMessageInput.trim()}>
                                      <Send className="w-5 h-5" />
                                  </button>
                              </form>
                          </>
                      ) : (
                          <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                              <MessageSquare className="w-12 h-12 mb-2 opacity-20" />
                              <p>Sélectionnez une conversation</p>
                          </div>
                      )}
                  </div>
              </div>
          )}

          {/* --- TAB: COMPTABILITÉ --- */}
          {activeTab === 'expenses' && (
              <div>
                  <div className="flex justify-between items-center mb-6">
                      <h3 className="text-lg font-bold text-slate-700">Comptabilité Générale</h3>
                      <button onClick={() => { setModalType('expense'); setIsModalOpen(true); }} className="bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-slate-700">
                          <Plus className="w-4 h-4" /> Saisir Dépense
                      </button>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                      <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm flex items-center gap-4">
                          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center text-red-600">
                              <TrendingUp className="w-6 h-6" />
                          </div>
                          <div>
                              <p className="text-xs text-slate-500 uppercase font-bold">Total Dépenses</p>
                              <p className="text-2xl font-bold text-slate-800">{totalExpenses.toFixed(2)} €</p>
                          </div>
                      </div>
                  </div>

                  <div className="bg-white border rounded-lg overflow-hidden">
                      <table className="w-full text-sm text-left">
                          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                              <tr>
                                  <th className="px-6 py-3">Date</th>
                                  <th className="px-6 py-3">Description</th>
                                  <th className="px-6 py-3">Catégorie</th>
                                  <th className="px-6 py-3 text-right">Montant</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                              {expenses.length === 0 ? (
                                  <tr><td colSpan={4} className="p-8 text-center text-slate-400">Aucune dépense enregistrée.</td></tr>
                              ) : (
                                  expenses.map((expense) => (
                                      <tr key={expense.id} className="hover:bg-slate-50">
                                          <td className="px-6 py-4 text-slate-600">{expense.date}</td>
                                          <td className="px-6 py-4 font-bold text-slate-700">{expense.description}</td>
                                          <td className="px-6 py-4">
                                              <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs capitalize">{expense.category}</span>
                                          </td>
                                          <td className="px-6 py-4 text-right font-bold text-red-500">- {expense.amount.toFixed(2)} €</td>
                                      </tr>
                                  ))
                              )}
                          </tbody>
                      </table>
                  </div>
              </div>
          )}

          {/* --- TAB: ABSENCES --- */}
          {activeTab === 'absences' && (
              <div>
                   <div className="flex justify-between items-center mb-6">
                       <h3 className="text-lg font-bold text-slate-700 mb-4">Absences Prestataires (Congés)</h3>
                       {/* Alert if conflicts */}
                       {absenceConflicts.length > 0 && (
                           <div className="text-red-600 font-bold flex items-center gap-2 text-sm bg-red-50 px-3 py-1 rounded-full border border-red-200">
                               <AlertTriangle className="w-4 h-4"/> {absenceConflicts.length} Conflit(s) détecté(s)
                           </div>
                       )}
                   </div>
                   
                   {providers.every(p => p.leaves.length === 0) ? (
                       <div className="text-center p-8 text-slate-400 bg-slate-50 rounded-lg">
                           <CalendarX className="w-8 h-8 mx-auto mb-2 opacity-50" />
                           Aucune absence déclarée pour le moment.
                       </div>
                   ) : (
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                           {providers.map(provider => {
                               if (provider.leaves.length === 0) return null;
                               return (
                                   <div key={provider.id} className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
                                       <div className="flex justify-between items-start mb-3">
                                            <h4 className="font-bold text-slate-800 flex items-center gap-2">
                                                <User className="w-4 h-4 text-slate-400"/>
                                                {provider.firstName} {provider.lastName}
                                            </h4>
                                            <span className="text-xs bg-slate-100 px-2 py-1 rounded text-slate-600">{provider.leaves.length} absence(s)</span>
                                       </div>
                                       <div className="space-y-2">
                                           {provider.leaves.map((leave, i) => (
                                               <div key={i} className="text-sm bg-slate-50 p-2 rounded flex flex-col gap-2">
                                                   <div className="flex justify-between items-center">
                                                       <span className="text-slate-600">Du <strong>{leave.startDate}</strong> au <strong>{leave.endDate}</strong></span>
                                                       <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${leave.status === 'approved' ? 'bg-green-100 text-green-700' : leave.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                                           {leave.status === 'approved' ? 'Validé' : leave.status === 'rejected' ? 'Refusé' : 'En attente'}
                                                       </span>
                                                   </div>
                                                   {leave.status === 'pending' && (
                                                       <div className="flex justify-end gap-2 border-t border-slate-200 pt-2">
                                                           <button 
                                                               onClick={() => handleLeaveStatusUpdate(leave.id, provider.id, 'rejected')}
                                                               className="text-xs bg-white border border-red-200 text-red-600 px-2 py-1 rounded hover:bg-red-50 flex items-center gap-1 font-bold"
                                                           >
                                                               <X className="w-3 h-3" /> Refuser
                                                           </button>
                                                           <button 
                                                               onClick={() => handleLeaveStatusUpdate(leave.id, provider.id, 'approved')}
                                                               className="text-xs bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700 flex items-center gap-1 font-bold shadow-sm"
                                                           >
                                                               <Check className="w-3 h-3" /> Valider
                                                           </button>
                                                       </div>
                                                   )}
                                               </div>
                                           ))}
                                       </div>
                                   </div>
                               );
                           })}
                       </div>
                   )}
              </div>
          )}
      </div>

      {/* --- MODALS --- */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
            <div className={`bg-white rounded-2xl shadow-2xl w-full ${modalType === 'contract' ? 'max-w-4xl h-[90vh]' : 'max-w-xl'} overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200`}>
                <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-cream-50">
                    <div>
                        <h3 className="text-xl font-serif font-bold text-slate-800">
                            {modalType === 'pack' && 'Créer Pack (Processus)'}
                            {modalType === 'contract' && 'Création Contrat SAP'}
                            {modalType === 'reminder' && 'Nouveau Rappel'}
                            {modalType === 'expense' && 'Saisir Dépense'}
                        </h3>
                    </div>
                    <button onClick={closePackModal} className="p-2 hover:bg-slate-200 rounded-full transition"><X className="w-5 h-5 text-slate-500" /></button>
                </div>

                <div className={`p-6 overflow-y-auto ${modalType === 'contract' ? 'flex-1' : ''}`}>
                    
                    {/* UPDATED PACK FORM: Process Based (Steps) */}
                    {modalType === 'pack' && (
                        <div className="space-y-6">
                             {/* STEP 1: Nom du Pack */}
                             {packStep === 1 && (
                                 <div className="space-y-4">
                                     <h4 className="font-bold text-brand-blue flex items-center gap-2">
                                         <span className="w-6 h-6 rounded-full bg-brand-blue text-white flex items-center justify-center text-xs">1</span> 
                                         Nom du Pack
                                     </h4>
                                     <div>
                                         <label className="font-bold text-slate-700 block mb-1">Saisir un nom distinctif et commercial</label>
                                         <input 
                                            type="text" 
                                            className="w-full p-3 border rounded-lg focus:border-brand-blue outline-none" 
                                            value={packForm.name || ''} 
                                            onChange={e => setPackForm({...packForm, name: e.target.value})} 
                                            placeholder="Ex : Pack Zen Jardin, Ultime 6..." 
                                            autoFocus
                                         />
                                     </div>
                                 </div>
                             )}

                             {/* STEP 2: Type de prestation */}
                             {packStep === 2 && (
                                 <div className="space-y-4">
                                     <h4 className="font-bold text-brand-blue flex items-center gap-2">
                                         <span className="w-6 h-6 rounded-full bg-brand-blue text-white flex items-center justify-center text-xs">2</span> 
                                         Type de prestation principale
                                     </h4>
                                     <div>
                                         <label className="font-bold text-slate-700 block mb-2">Choisir parmi les services éligibles SAP :</label>
                                         <div className="max-h-60 overflow-y-auto border rounded-lg divide-y divide-slate-100">
                                             {SAP_SERVICES.map(s => (
                                                 <div 
                                                    key={s} 
                                                    onClick={() => setPackForm({...packForm, mainService: s})}
                                                    className={`p-3 cursor-pointer text-sm font-medium hover:bg-blue-50 transition ${packForm.mainService === s ? 'bg-blue-50 text-brand-blue border-l-4 border-l-brand-blue' : 'text-slate-600'}`}
                                                 >
                                                     {s}
                                                 </div>
                                             ))}
                                         </div>
                                     </div>
                                 </div>
                             )}

                             {/* STEP 3: Détails du Pack */}
                             {packStep === 3 && (
                                 <div className="space-y-4">
                                     <h4 className="font-bold text-brand-blue flex items-center gap-2">
                                         <span className="w-6 h-6 rounded-full bg-brand-blue text-white flex items-center justify-center text-xs">3</span> 
                                         Détails du pack
                                     </h4>
                                     <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="font-bold text-slate-700 block mb-1 text-xs uppercase">Durée de la prestation</label>
                                            <input type="number" placeholder="Ex: 3" className="w-full p-2 border rounded" value={packForm.hours || ''} onChange={e => setPackForm({...packForm, hours: Number(e.target.value)})} />
                                            <p className="text-[10px] text-slate-400 mt-1">Ex : 2h, 3h, 6h...</p>
                                        </div>
                                        <div>
                                            <label className="font-bold text-slate-700 block mb-1 text-xs uppercase">Fréquence</label>
                                            <select className="w-full p-2 border rounded" value={packForm.frequency || 'Ponctuelle'} onChange={e => setPackForm({...packForm, frequency: e.target.value as any})}>
                                                <option value="Ponctuelle">Ponctuelle (1 fois)</option>
                                                <option value="Hebdomadaire">Hebdomadaire (Chaque semaine)</option>
                                                <option value="Bimensuelle">Bimensuelle (2 fois/mois)</option>
                                                <option value="Mensuelle">Mensuelle</option>
                                            </select>
                                        </div>
                                     </div>

                                     <div>
                                         <label className="font-bold text-slate-700 block mb-1 text-xs uppercase">Quantité</label>
                                         <input type="text" placeholder="Ex: 3 pièces, 50m², 2 personnes..." className="w-full p-2 border rounded" value={packForm.quantity || ''} onChange={e => setPackForm({...packForm, quantity: e.target.value})} />
                                     </div>

                                     <div>
                                         <label className="font-bold text-slate-700 block mb-1 text-xs uppercase">Lieu de réalisation</label>
                                         <input type="text" placeholder="Ex: Domicile Client" className="w-full p-2 border rounded" value={packForm.location || 'Domicile Client'} onChange={e => setPackForm({...packForm, location: e.target.value})} />
                                     </div>

                                     <div className="bg-slate-50 p-3 rounded border border-slate-200">
                                         <div className="flex items-center gap-2 mb-2">
                                             <input type="checkbox" checked={packForm.suppliesIncluded} onChange={e => setPackForm({...packForm, suppliesIncluded: e.target.checked})} className="w-4 h-4 text-brand-blue" />
                                             <span className="font-bold text-slate-700 text-sm">Matériel / Produits fournis (Oui/Non)</span>
                                         </div>
                                         {packForm.suppliesIncluded && (
                                             <input type="text" placeholder="Détail fournitures (ex: Désinfectants, Lave-vitres...)" className="w-full p-2 border rounded text-sm" value={packForm.suppliesDetails || ''} onChange={e => setPackForm({...packForm, suppliesDetails: e.target.value})} />
                                         )}
                                     </div>

                                     <div>
                                         <label className="font-bold text-slate-700 block mb-1 text-xs uppercase">Tarif Total HT (€)</label>
                                         <input type="number" placeholder="Ex: 99" className="w-full p-2 border rounded font-bold text-lg" value={packForm.priceHT || ''} onChange={e => setPackForm({...packForm, priceHT: Number(e.target.value)})} />
                                         
                                         {/* Simulation TTC & Reste à charge */}
                                         <div className="mt-2 text-sm bg-green-50 text-green-800 p-2 rounded border border-green-200">
                                             <div className="flex justify-between">
                                                 <span>TVA (2.1%) :</span>
                                                 <strong>{((packForm.priceHT || 0) * 0.021).toFixed(2)} €</strong>
                                             </div>
                                             <div className="flex justify-between border-t border-green-200 pt-1 mt-1">
                                                 <span>Total TTC :</span>
                                                 <strong>{((packForm.priceHT || 0) * 1.021).toFixed(2)} €</strong>
                                             </div>
                                             <div className="flex justify-between text-xs mt-1 text-green-700">
                                                 <span>Reste à charge (Crédit d'impôt immédiat) :</span>
                                                 <strong>~{((packForm.priceHT || 0) * 1.021 * 0.5).toFixed(2)} €</strong>
                                             </div>
                                         </div>
                                     </div>
                                 </div>
                             )}

                             {/* STEP 4: Validation */}
                             {packStep === 4 && (
                                 <div className="space-y-4 text-center">
                                     <h4 className="font-bold text-brand-blue flex items-center justify-center gap-2 mb-4">
                                         <span className="w-6 h-6 rounded-full bg-brand-blue text-white flex items-center justify-center text-xs">4</span> 
                                         Contrat / Validation
                                     </h4>
                                     
                                     <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 text-left space-y-2 text-sm">
                                         <p><strong>Nom :</strong> {packForm.name}</p>
                                         <p><strong>Service :</strong> {packForm.mainService}</p>
                                         <p><strong>Détails :</strong> {packForm.hours}h, {packForm.frequency}, {packForm.quantity}</p>
                                         <p><strong>Prix :</strong> {((packForm.priceHT || 0) * 1.021).toFixed(2)} € TTC</p>
                                     </div>

                                     <div className="flex flex-col items-center gap-2 text-green-600 bg-green-50 p-3 rounded">
                                         <CheckCircle className="w-8 h-8" />
                                         <span className="text-sm font-bold">Génération automatique du contrat SAP incluse.</span>
                                     </div>
                                 </div>
                             )}

                             <div className="flex justify-between pt-4 border-t border-slate-100">
                                {packStep > 1 && (
                                    <button onClick={handlePrevPackStep} className="px-4 py-2 text-slate-500 font-bold hover:bg-slate-100 rounded flex items-center gap-1">
                                        <ChevronLeft className="w-4 h-4"/> Précédent
                                    </button>
                                )}
                                {packStep < 4 ? (
                                    <button onClick={handleNextPackStep} className="ml-auto px-6 py-2 bg-brand-blue text-white rounded font-bold flex items-center gap-2">
                                        Suivant <ChevronRight className="w-4 h-4"/>
                                    </button>
                                ) : (
                                    <button onClick={handleSavePack} className="ml-auto px-6 py-2 bg-green-600 text-white rounded font-bold flex items-center gap-2 shadow-lg">
                                        <Save className="w-4 h-4"/> Valider et Créer le Pack
                                    </button>
                                )}
                             </div>
                        </div>
                    )}

                    {/* UPDATED CONTRACT FORM TO MATCH PDF */}
                    {modalType === 'contract' && (
                        <div className="flex flex-col h-full gap-4">
                            {/* Visual Header per PDF */}
                            <div className="bg-cream-100 p-4 rounded-lg border border-beige-200 text-sm text-slate-700 font-serif space-y-1 text-center">
                                <h4 className="font-bold text-lg uppercase text-brand-blue">{companySettings.name} – SASU</h4>
                                <p>Siège : {companySettings.address} | Email : {companySettings.email}</p>
                                <p>N° SAP : {companySettings.siret}</p>
                                <p className="text-xs italic mt-2 border-t border-beige-300 pt-1 w-fit mx-auto">
                                    Assurance RCP : Contrat n° RCP250714175810 – Assurup (Hiscox) | Validité : 01/08/2025 au 31/07/2026
                                </p>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">Nom du contrat</label>
                                    <input type="text" className="w-full p-2 border rounded text-sm font-bold" placeholder="Ex: Contrat Standard 2024" value={contractForm.name} onChange={e => setContractForm({...contractForm, name: e.target.value})} />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">Type de Logo (PDF)</label>
                                    <div className="flex items-center gap-4">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input type="radio" name="logoType" value="SAP" checked={contractLogoType === 'SAP'} onChange={() => setContractLogoType('SAP')} />
                                            <span className="text-sm font-bold">Logo SAP</span>
                                        </label>
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input type="radio" name="logoType" value="Standard" checked={contractLogoType === 'Standard'} onChange={() => setContractLogoType('Standard')} />
                                            <span className="text-sm font-bold">Hors SAP</span>
                                        </label>
                                    </div>
                                </div>
                            </div>

                            {/* Selection Logic */}
                            <div className="bg-slate-50 p-4 rounded border border-slate-200 flex gap-4 items-end">
                                <div className="flex-1">
                                    <label className="block text-xs font-bold text-slate-500 mb-1">Client (Infos obligatoires)</label>
                                    <select 
                                        className="w-full p-2 border rounded text-sm"
                                        value={selectedClientIdForContract}
                                        onChange={e => setSelectedClientIdForContract(e.target.value)}
                                    >
                                        <option value="">-- Sélectionner un client --</option>
                                        {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>
                                <div className="flex-1">
                                    <label className="block text-xs font-bold text-slate-500 mb-1">Pack (Infos Pack)</label>
                                    <select 
                                        className="w-full p-2 border rounded text-sm"
                                        value={selectedPackIdForContract}
                                        onChange={e => setSelectedPackIdForContract(e.target.value)}
                                    >
                                        <option value="">-- Sélectionner un pack --</option>
                                        {packs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                    </select>
                                </div>
                                <button 
                                    onClick={handleGenerateContractContent}
                                    className="bg-brand-blue text-white px-4 py-2 rounded font-bold text-sm hover:bg-teal-700"
                                >
                                    Générer Contrat
                                </button>
                            </div>

                            <div className="flex-1 relative border rounded overflow-hidden">
                                <textarea 
                                    className="w-full h-full p-6 font-mono text-sm leading-relaxed resize-none bg-white outline-none" 
                                    value={contractForm.content} 
                                    onChange={e => setContractForm({...contractForm, content: e.target.value})} 
                                />
                            </div>

                            {/* Footer Visual */}
                            <div className="flex justify-between items-end p-4 bg-slate-50 border border-slate-200 rounded text-center text-xs text-slate-500">
                                <div className="w-1/3 border-t border-slate-300 pt-2">
                                    <p className="font-bold">Signature du Client</p>
                                    <p>(Précédée de la mention "Lu et approuvé")</p>
                                    <div className="h-10 mt-2 bg-white border border-dashed border-slate-300 rounded flex items-center justify-center">Espace Signature</div>
                                </div>
                                <div className="w-1/3 border-t border-slate-300 pt-2">
                                    <p className="font-bold">L'Entreprise</p>
                                    <p>(Cachet et Signature)</p>
                                    <div className="h-10 mt-2 bg-white border border-dashed border-slate-300 rounded flex items-center justify-center font-bold text-red-300">
                                        {contractForm.status === 'active' ? 'VALIDÉ & CACHETÉ' : 'EN ATTENTE VALIDATION'}
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-end gap-2 pt-2">
                                <button onClick={() => setIsModalOpen(false)} className="px-6 py-2 border rounded font-bold text-slate-500">Annuler</button>
                                <button onClick={handleSaveContract} className="px-6 py-2 bg-brand-blue text-white rounded font-bold hover:bg-teal-700 flex items-center gap-2">
                                    <Save className="w-4 h-4" /> Enregistrer le Contrat
                                </button>
                            </div>
                        </div>
                    )}
                    
                    {/* ... [Reminder and Expense forms unchanged] ... */}
                    {modalType === 'reminder' && (
                        <div className="space-y-4">
                            <div><label className="font-bold text-slate-700 block mb-1">Message</label><input type="text" className="w-full p-2 border rounded" value={reminderForm.text} onChange={e => setReminderForm({...reminderForm, text: e.target.value})} placeholder="Ex: Relancer client X" /></div>
                            <div><label className="font-bold text-slate-700 block mb-1">Date</label><input type="date" className="w-full p-2 border rounded" value={reminderForm.date} onChange={e => setReminderForm({...reminderForm, date: e.target.value})} /></div>
                            <div className="flex items-center gap-2"><input type="checkbox" checked={reminderForm.notifyEmail} onChange={e => setReminderForm({...reminderForm, notifyEmail: e.target.checked})} className="w-5 h-5" /><span className="font-bold text-slate-700">Notification Email</span></div>
                            <div className="flex justify-end pt-4"><button onClick={handleSaveReminder} className="px-6 py-2 bg-brand-orange text-white rounded font-bold">Ajouter</button></div>
                        </div>
                    )}
                    
                    {modalType === 'expense' && (
                         <div className="space-y-4">
                            <div><label className="font-bold text-slate-700 block mb-1">Description</label><input type="text" className="w-full p-2 border rounded" value={expenseForm.description} onChange={e => setExpenseForm({...expenseForm, description: e.target.value})} /></div>
                            <div><label className="font-bold text-slate-700 block mb-1">Montant (€)</label><input type="number" className="w-full p-2 border rounded" value={expenseForm.amount} onChange={e => setExpenseForm({...expenseForm, amount: Number(e.target.value)})} /></div>
                            <div><label className="font-bold text-slate-700 block mb-1">Date</label><input type="date" className="w-full p-2 border rounded" value={expenseForm.date} onChange={e => setExpenseForm({...expenseForm, date: e.target.value})} /></div>
                            <div><label className="font-bold text-slate-700 block mb-1">Catégorie</label><select className="w-full p-2 border rounded" value={expenseForm.category} onChange={e => setExpenseForm({...expenseForm, category: e.target.value as any})}><option value="fournitures">Fournitures</option><option value="carburant">Carburant</option><option value="administratif">Administratif</option><option value="autre">Autre</option></select></div>
                            <div className="flex justify-end pt-4"><button onClick={handleSaveExpense} className="px-6 py-2 bg-slate-800 text-white rounded font-bold">Enregistrer</button></div>
                        </div>
                    )}
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
                        Êtes-vous sûr de vouloir supprimer {selectedPackIds.size} pack(s) ? Cette action est irréversible.
                    </p>
                    <div className="flex gap-3 w-full">
                        <button 
                            onClick={() => setDeleteConfirmOpen(false)}
                            className="flex-1 py-2 text-slate-600 font-bold bg-slate-100 hover:bg-slate-200 rounded-lg transition"
                        >
                            Annuler
                        </button>
                        <button 
                            onClick={executeDeletePacks}
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

export default Secretariat;
