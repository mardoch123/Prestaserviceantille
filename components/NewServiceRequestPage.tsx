import React, { useState, useRef, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { type ServiceTypeFilter } from '../utils/serviceTypes';
import { getMartiniqueToday, formatMartiniqueDate } from '../src/utils/martiniqueTime';
import SearchableSelect from './SearchableSelect';
import { createCustomerServiceRequest } from '../modules/serviceRequests/client';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  Home,
  Flower2,
  Wrench,
  HelpCircle,
  Package,
  Calendar,
  Clock,
  PenTool,
  Upload,
  X,
  Check,
  Sparkles,
  MapPin,
  Send,
  Plus,
  Trash2,
  AlertCircle
} from 'lucide-react';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { getMartiniqueNow, MARTINIQUE_TIMEZONE } from '../src/utils/dayjsMartinique';

dayjs.extend(utc);
dayjs.extend(timezone);

type Step = 'service' | 'pack' | 'slots' | 'signature' | 'confirmation';
type ServiceMode = 'pack' | 'custom';

interface InterventionSlot {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  duration: number;
}

const SERVICE_ICONS: Record<string, React.ReactNode> = {
  'Ménage': <Home className="w-6 h-6" />,
  'Jardinage': <Flower2 className="w-6 h-6" />,
  'Bricolage': <Wrench className="w-6 h-6" />,
  'Autre': <HelpCircle className="w-6 h-6" />,
  'Personnalisé': <Sparkles className="w-6 h-6" />,
};

const SERVICE_COLORS: Record<string, string> = {
  'Ménage': 'bg-blue-500',
  'Jardinage': 'bg-green-500',
  'Bricolage': 'bg-orange-500',
  'Autre': 'bg-slate-500',
  'Personnalisé': 'bg-purple-500',
};

const NewServiceRequestPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    packs,
    providers,
    missions,
    currentUser,
    clients,
    simulatedClientId,
    addDocument,
    sendClientMessage,
    companySettings
  } = useData();

  const activeClientId = simulatedClientId || (currentUser?.role === 'client' ? currentUser.relatedEntityId : null);
  const client = clients.find(c => String((c as any).id || '') === String(activeClientId || ''));

  const [currentStep, setCurrentStep] = useState<Step>('service');
  const [selectedService, setSelectedService] = useState<ServiceTypeFilter | null>(null);
  
  // Mode pack ou personnalisé (comme dans DevisFactures)
  const [serviceMode, setServiceMode] = useState<ServiceMode>('pack');
  const [selectedPackId, setSelectedPackId] = useState<string>('');
  const [packQuantity, setPackQuantity] = useState<number>(1);
  const [customDescription, setCustomDescription] = useState('');
  const [customUnitPrice, setCustomUnitPrice] = useState<number>(0);
  
  // Slots comme dans DevisFactures
  const [interventionSlots, setInterventionSlots] = useState<InterventionSlot[]>([]);
  
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [uploadedSignature, setUploadedSignature] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [requestId, setRequestId] = useState<string>('');
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [address, setAddress] = useState(client?.address || '');
  
  // État pour le crédit d'impôt (comme dans DevisFactures) - coché par défaut
  const [taxCreditActive, setTaxCreditActive] = useState(true);
  const [agreementChecked, setAgreementChecked] = useState(false);
  
  // Toast notification state
  const [toast, setToast] = useState<{message: string, type: 'success' | 'warning' | 'error'} | null>(null);
  
  const showToast = (message: string, type: 'success' | 'warning' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // TOUS les packs disponibles (pas de filtrage par type de service)
  const allPacks = useMemo(() => packs, [packs]);

  // Pack sélectionné
  const selectedPack = useMemo(() => packs.find(p => p.id === selectedPackId), [packs, selectedPackId]);

  // Calculs des prix (comme dans DevisFactures)
  const baseAmount = useMemo(() => {
    if (serviceMode === 'pack' && selectedPack) {
      return selectedPack.priceTTC * packQuantity;
    }
    return customUnitPrice;
  }, [serviceMode, selectedPack, packQuantity, customUnitPrice]);

  const tvaRate = 0; // TVA à 0% pour les particuliers
  const totalHT = baseAmount;
  const tvaAmount = totalHT * (tvaRate / 100);
  const totalTTC = totalHT + tvaAmount;
  const taxCreditAmount = taxCreditActive ? totalTTC * 0.5 : 0;
  const clientToPay = totalTTC - taxCreditAmount;

  // Mettre à jour le prix unitaire quand le pack change
  useEffect(() => {
    if (serviceMode === 'pack' && selectedPackId) {
      const pack = packs.find(p => p.id === selectedPackId);
      if (pack) {
        setCustomUnitPrice(pack.priceTTC);
        setCustomDescription(pack.description);
      }
    }
  }, [selectedPackId, serviceMode, packs]);

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsDrawing(true);
    const rect = canvas.getBoundingClientRect();
    const x = ('touches' in e) ? e.touches[0].clientX - rect.left : (e as React.MouseEvent).clientX - rect.left;
    const y = ('touches' in e) ? e.touches[0].clientY - rect.top : (e as React.MouseEvent).clientY - rect.top;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = ('touches' in e) ? e.touches[0].clientX - rect.left : (e as React.MouseEvent).clientX - rect.left;
    const y = ('touches' in e) ? e.touches[0].clientY - rect.top : (e as React.MouseEvent).clientY - rect.top;
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (canvas) {
      setSignatureData(canvas.toDataURL());
    }
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
      setSignatureData(null);
      setUploadedSignature(null);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setUploadedSignature(event.target?.result as string);
        setSignatureData(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Fonction pour vérifier la disponibilité des prestataires (comme dans DevisFactures)
  const getAvailableProvidersForSlot = (slot: InterventionSlot): any[] => {
    if (!slot?.date) return [];

    const slotStart = dayjs.tz(`${slot.date} ${slot.startTime}`, 'YYYY-MM-DD HH:mm', MARTINIQUE_TIMEZONE);
    const slotEnd = dayjs.tz(`${slot.date} ${slot.endTime}`, 'YYYY-MM-DD HH:mm', MARTINIQUE_TIMEZONE);
    if (!slotStart.isValid() || !slotEnd.isValid()) return [];

    const conflictingMissions = missions.filter(m => {
      if (m.status === 'cancelled' || !m.date) return false;
      const mStart = dayjs.tz(`${m.date} ${m.startTime}`, 'YYYY-MM-DD HH:mm', MARTINIQUE_TIMEZONE);
      const mEnd = dayjs.tz(`${m.date} ${m.endTime}`, 'YYYY-MM-DD HH:mm', MARTINIQUE_TIMEZONE);
      if (!mStart.isValid() || !mEnd.isValid()) return false;
      const overlap = slotStart.isBefore(mEnd) && slotEnd.isAfter(mStart);
      return overlap;
    });

    return providers.filter(provider => {
      const isActive = provider.status === 'Active';
      if (!isActive) return false;

      const day = dayjs.tz(slot.date, 'YYYY-MM-DD', MARTINIQUE_TIMEZONE).day();
      const nonWorkingDays = (provider as any)?.nonInterventionDays;
      if (Array.isArray(nonWorkingDays) && nonWorkingDays.includes(day)) return false;

      const nonWorkingHours = (provider as any)?.nonInterventionHours;
      if (nonWorkingHours?.[day]) {
        const slotStartHour = slotStart.hour();
        const slotEndHour = slotEnd.hour();
        for (const range of nonWorkingHours[day]) {
          const start = parseInt(range.start.split(':')[0], 10);
          const end = parseInt(range.end.split(':')[0], 10);
          if (slotStartHour < end && slotEndHour > start) return false;
        }
      }

      const providerMissionCount = conflictingMissions.filter(m => m.providerId === provider.id).length;
      const capacity = (provider as any).capacity ?? 1;
      return providerMissionCount < capacity;
    });
  };

  // Vérifier si un créneau est disponible
  const isSlotAvailable = (slot: InterventionSlot): boolean => {
    return getAvailableProvidersForSlot(slot).length > 0;
  };

  // Générer des créneaux automatiquement selon le pack
  const generateSlots = () => {
    const pack = packs.find(p => p.id === selectedPackId);
    if (!pack && serviceMode === 'pack') {
      showToast('Veuillez sélectionner un pack d\'abord', 'warning');
      return;
    }

    const maxLookaheadDays = 90;
    const today = getMartiniqueToday();
    const newSlots: InterventionSlot[] = [];

    // Déterminer les sessions à créer selon le pack
    let sessions: { startTime: string; endTime: string; duration: number }[] = [];
    
    if (serviceMode === 'pack' && pack) {
      // Si le pack a des schedules définis, les utiliser
      if (pack.schedules && pack.schedules.length > 0) {
        // Générer les créneaux selon les schedules du pack
        pack.schedules.forEach((schedule: any) => {
          const days = schedule.days || 1;
          const hoursPerDay = schedule.hoursPerDay || 2;
          for (let i = 0; i < days; i++) {
            sessions.push({
              startTime: '08:00',
              endTime: `${8 + hoursPerDay}:00`.padStart(5, '0'),
              duration: hoursPerDay
            });
          }
        });
      } else if (pack.interventionSchedules && pack.interventionSchedules.length > 0) {
        // Utiliser les interventionSchedules si disponibles
        pack.interventionSchedules.forEach((sched: any) => {
          sessions.push({
            startTime: sched.startTime || '08:00',
            endTime: sched.endTime || '10:00',
            duration: sched.duration || 2
          });
        });
      } else {
        // Pack Ultime 6 = 1 séance de 6h
        if (pack.name?.toLowerCase().includes('ultime 6') || pack.hours === 6) {
          sessions = [{ startTime: '08:00', endTime: '14:00', duration: 6 }];
        } else {
          // Calculer le nombre de jours selon les heures du pack
          // Par défaut 2h par jour, mais ajuster selon le total d'heures
          const hoursPerDay = 2;
          const daysNeeded = Math.ceil(pack.hours / hoursPerDay);
          for (let i = 0; i < daysNeeded; i++) {
            const duration = Math.min(hoursPerDay, pack.hours - (i * hoursPerDay));
            sessions.push({
              startTime: '08:00',
              endTime: `${8 + duration}:00`.padStart(5, '0'),
              duration: duration
            });
          }
        }
      }
    } else {
      // Mode personnalisé - 1 session de 2h par défaut
      sessions = [{ startTime: '08:00', endTime: '10:00', duration: 2 }];
    }

    let cursorDate = dayjs.tz(today, 'YYYY-MM-DD', MARTINIQUE_TIMEZONE).startOf('day');
    
    // Si aujourd'hui est déjà passé pour le créneau par défaut, commencer demain
    const now = getMartiniqueNow();
    if (sessions.length > 0 && sessions[0]?.startTime) {
      const slotDateTime = cursorDate.hour(parseInt(sessions[0].startTime.split(':')[0]));
      if (slotDateTime.isBefore(now)) {
        cursorDate = cursorDate.add(1, 'day');
      }
    }

    for (let i = 0; i < sessions.length; i++) {
      let attempts = 0;
      while (newSlots.filter(s => s.id?.includes(`slot-${i}`)).length === 0 && attempts < maxLookaheadDays) {
        const candidateStr = cursorDate.format('YYYY-MM-DD');
        
        // Vérifier que ce n'est pas dans le passé
        const candidateDateTime = cursorDate.hour(parseInt(sessions[i].startTime.split(':')[0]));
        if (candidateDateTime.isBefore(now)) {
          cursorDate = cursorDate.add(1, 'day');
          attempts++;
          continue;
        }

        const candidateSlot: InterventionSlot = {
          id: `slot-auto-${i}-${candidateStr}`,
          date: candidateStr,
          startTime: sessions[i].startTime,
          endTime: sessions[i].endTime,
          duration: sessions[i].duration,
        };

        if (isSlotAvailable(candidateSlot)) {
          newSlots.push(candidateSlot);
          cursorDate = cursorDate.add(1, 'day');
          break;
        }
        
        cursorDate = cursorDate.add(1, 'day');
        attempts++;
      }
    }

    if (newSlots.length > 0) {
      setInterventionSlots(newSlots);
      showToast(`${newSlots.length} créneau(x) généré(s) sur ${sessions.length} prévu(s)`, 'success');
    } else {
      showToast('Aucun créneau disponible trouvé. Veuillez ajouter manuellement.', 'warning');
    }
  };

  // Ajouter un créneau manuellement
  const addNewSlot = () => {
    // Vérifier les contraintes du pack
    if (serviceMode === 'pack' && selectedPackId) {
      const pack = packs.find(p => p.id === selectedPackId);
      if (pack) {
        // Pack Ultime 6 = max 1 séance
        if (pack.name?.toLowerCase().includes('ultime 6') && interventionSlots.length >= 1) {
          showToast("Le pack 'Ultime 6' ne permet qu'une seule séance de 6h.", 'warning');
          return;
        }
        // Vérifier les heures totales
        const totalHours = interventionSlots.reduce((acc, s) => acc + s.duration, 0);
        if (totalHours >= pack.hours) {
          showToast(`Le pack ${pack.name} est limité à ${pack.hours}h.`, 'warning');
          return;
        }
      }
    }

    const today = getMartiniqueToday();
    const newSlot: InterventionSlot = {
      id: `slot-manual-${Date.now()}`,
      date: today,
      startTime: '08:00',
      endTime: '10:00',
      duration: 2,
    };

    // Forcer 6h pour Pack Ultime 6
    if (serviceMode === 'pack' && selectedPackId) {
      const pack = packs.find(p => p.id === selectedPackId);
      if (pack?.name?.toLowerCase().includes('ultime 6')) {
        newSlot.startTime = '08:00';
        newSlot.endTime = '14:00';
        newSlot.duration = 6;
      }
    }

    setInterventionSlots([...interventionSlots, newSlot]);
  };

  // Mettre à jour un créneau
  const updateSlot = (index: number, field: keyof InterventionSlot, value: string | number) => {
    const newSlots = [...interventionSlots];
    const currentSlot = newSlots[index];
    
    if (field === 'startTime' && typeof value === 'string') {
      // Calculer la nouvelle heure de fin en gardant la même durée
      const [hours, minutes] = value.split(':').map(Number);
      const newEnd = dayjs().hour(hours).minute(minutes).add(currentSlot.duration, 'hour');
      newSlots[index] = { 
        ...currentSlot, 
        startTime: value, 
        endTime: newEnd.format('HH:mm')
      };
    } else if (field === 'endTime' && typeof value === 'string') {
      // Recalculer la durée
      const start = dayjs(`2000-01-01 ${currentSlot.startTime}`);
      const end = dayjs(`2000-01-01 ${value}`);
      const dur = Math.max(1, end.diff(start, 'hour', true));
      newSlots[index] = { 
        ...currentSlot, 
        endTime: value, 
        duration: dur 
      };
    } else {
      newSlots[index] = { ...currentSlot, [field]: value };
    }
    
    setInterventionSlots(newSlots);
  };

  // Supprimer un créneau
  const removeSlot = (index: number) => {
    setInterventionSlots(interventionSlots.filter((_, i) => i !== index));
  };

  // Calculer la disponibilité pour chaque créneau
  const slotAvailability = useMemo(() => {
    const map = new Map<string, any[]>();
    interventionSlots.forEach((slot) => {
      if (!slot?.id) return;
      map.set(slot.id, getAvailableProvidersForSlot(slot));
    });
    return map;
  }, [interventionSlots, providers, missions]);

  const handleSubmit = async () => {
    if (!client) return;
    
    setIsSubmitting(true);
    const pack = packs.find(p => p.id === selectedPackId);
    const finalSignature = signatureData || uploadedSignature;
    
    try {
      // Créer une vraie demande de service via le module serviceRequests
      const serviceRequest = await createCustomerServiceRequest(
        {
          clientId: client.id,
          serviceType: selectedService || 'Autre',
          packId: serviceMode === 'pack' ? selectedPackId : null,
          customServiceDescription: serviceMode === 'custom' ? customDescription : null,
          requestedSlots: interventionSlots.map(s => ({
            date: s.date,
            startTime: s.startTime,
            endTime: s.endTime,
            duration: s.duration
          })),
          signatureDataUrl: finalSignature || '',
          estimatedPrice: clientToPay,
        },
        {
          name: client.name,
          email: client.email,
          phone: client.phone,
          address: address || client.address,
          city: client.city,
        },
        pack?.name || null
      );

      if (serviceRequest) {
        setRequestId(serviceRequest.id);
        
        // Also send a message in the chat for notification
        const serviceTypeLabel = serviceMode === 'pack' 
          ? `Pack: ${pack?.name || 'Non spécifié'}` 
          : `Sur mesure: ${customDescription || 'Non spécifié'}`;
        
        const message = `
Nouvelle demande de service #${serviceRequest.id}
Client: ${client.name}
Service: ${selectedService}
Type: ${serviceTypeLabel}
Adresse: ${address}
Créneaux sélectionnés:
${interventionSlots.map(s => `- ${formatMartiniqueDate(s.date)}: ${s.startTime} - ${s.endTime} (${s.duration}h)`).join('\n')}
${additionalNotes ? `Notes additionnelles: ${additionalNotes}` : ''}
        `.trim();
        
        await sendClientMessage(message, client.id);
      }
      
      setIsSubmitting(false);
      setCurrentStep('confirmation');
    } catch (error) {
      console.error('Error submitting request:', error);
      setIsSubmitting(false);
      alert('Une erreur est survenue lors de l\'envoi de votre demande. Veuillez réessayer.');
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 'service':
        return !!selectedService && selectedService !== 'all';
      case 'pack':
        if (serviceMode === 'pack') {
          return !!selectedPackId;
        } else {
          return customDescription.trim().length > 0 && customUnitPrice > 0;
        }
      case 'slots':
        return interventionSlots.length > 0;
      case 'signature':
        return !!(signatureData || uploadedSignature) && address.trim().length > 0 && agreementChecked;
      default:
        return false;
    }
  };

  const steps: { id: Step; label: string; icon: React.ReactNode }[] = [
    { id: 'service', label: 'Service', icon: <Package className="w-4 h-4" /> },
    { id: 'pack', label: 'Prestation', icon: <Sparkles className="w-4 h-4" /> },
    { id: 'slots', label: 'Créneaux', icon: <Calendar className="w-4 h-4" /> },
    { id: 'signature', label: 'Validation', icon: <PenTool className="w-4 h-4" /> },
  ];

  if (!client) {
    return (
      <div className="flex-1 flex items-center justify-center bg-cream-50">
        <div className="text-center">
          <p className="text-slate-500">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto overflow-x-hidden bg-cream-50 p-3 sm:p-6 relative">
      {/* Toast notification */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg max-w-sm animate-in fade-in slide-in-from-right-4 ${
          toast.type === 'success' ? 'bg-green-100 text-green-800 border border-green-200' :
          toast.type === 'warning' ? 'bg-amber-100 text-amber-800 border border-amber-200' :
          'bg-red-100 text-red-800 border border-red-200'
        }`}>
          <div className="flex items-center gap-2">
            {toast.type === 'success' && <CheckCircle className="w-5 h-5" />}
            {toast.type === 'warning' && <AlertCircle className="w-5 h-5" />}
            <span className="text-sm font-medium">{toast.message}</span>
            <button onClick={() => setToast(null)} className="ml-2 hover:opacity-70">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
      <div className="max-w-5xl mx-auto w-full">
        {/* Header */}
        <div className="mb-4 sm:mb-6">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-slate-600 hover:text-slate-900 font-medium mb-3 text-sm sm:text-base"
          >
            <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
            Retour
          </button>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Nouvelle demande de service</h1>
          <p className="text-sm text-slate-500">Créez une nouvelle demande de prestation</p>
        </div>
        {currentStep !== 'confirmation' && (
          <div className="mb-6 sm:mb-8 overflow-x-auto pb-2 -mx-2 px-2">
            <div className="flex items-center justify-between min-w-[300px]">
              {steps.map((step, index) => (
                <div key={step.id} className="flex items-center shrink-0">
                  <div
                    className={`flex flex-col items-center ${
                      steps.findIndex(s => s.id === currentStep) >= index
                        ? 'text-brand-blue'
                        : 'text-slate-400'
                    }`}
                  >
                    <div
                      className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center mb-1 ${
                        steps.findIndex(s => s.id === currentStep) > index
                          ? 'bg-green-500 text-white'
                          : steps.findIndex(s => s.id === currentStep) === index
                          ? 'bg-brand-blue text-white'
                          : 'bg-slate-200 text-slate-500'
                      }`}
                    >
                      {steps.findIndex(s => s.id === currentStep) > index ? (
                        <Check className="w-4 h-4 sm:w-5 sm:h-5" />
                      ) : (
                        <span className="scale-90">{step.icon}</span>
                      )}
                    </div>
                    <span className="text-[10px] sm:text-xs font-medium whitespace-nowrap">{step.label}</span>
                  </div>
                  {index < steps.length - 1 && (
                    <div
                      className={`w-8 sm:w-16 md:w-24 h-1 mx-1 sm:mx-2 rounded ${
                        steps.findIndex(s => s.id === currentStep) > index
                          ? 'bg-green-500'
                          : 'bg-slate-200'
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 1: Service Selection */}
        {currentStep === 'service' && (
          <div className="space-y-4 sm:space-y-6 animate-in fade-in slide-in-from-bottom-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 shadow-sm">
              <h2 className="text-base sm:text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                <span className="bg-brand-blue text-white w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0">1</span>
                <span className="break-words">Choisissez votre type de service</span>
              </h2>
              <p className="text-slate-500 mb-4 sm:mb-6 text-sm">Sélectionnez la catégorie qui correspond à votre besoin</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                {(['Ménage', 'Jardinage', 'Bricolage', 'Autre', 'Personnalisé'] as ServiceTypeFilter[]).map((service) => (
                  <button
                    key={service}
                    onClick={() => setSelectedService(service)}
                    className={`p-4 sm:p-5 rounded-xl border-2 text-left transition-all w-full overflow-hidden ${
                      selectedService === service
                        ? 'border-brand-blue bg-blue-50 shadow-md'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
                    }`}
                  >
                    <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-lg ${SERVICE_COLORS[service]} text-white flex items-center justify-center mb-2 sm:mb-3 shrink-0`}>
                      {React.cloneElement(SERVICE_ICONS[service] as React.ReactElement, { className: "w-5 h-5 sm:w-6 sm:h-6" })}
                    </div>
                    <h3 className="text-base sm:text-lg font-bold text-slate-800 mb-1 truncate">{service}</h3>
                    <p className="text-xs sm:text-sm text-slate-500 line-clamp-2">
                      {service === 'Ménage' && 'Nettoyage, repassage, vitres, entretien de votre domicile'}
                      {service === 'Jardinage' && 'Tonte, taille, débroussaillage, entretien de votre jardin'}
                      {service === 'Bricolage' && 'Petits travaux, réparations, montage, installations'}
                      {service === 'Autre' && 'Services personnalisés selon vos besoins spécifiques'}
                      {service === 'Personnalisé' && 'Interventions sur mesure et demandes spéciales'}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setCurrentStep('pack')}
                disabled={!canProceed()}
                className="flex items-center gap-2 bg-brand-blue text-white px-6 py-3 rounded-xl font-bold hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                Continuer
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Pack Selection - Style DevisFactures */}
        {currentStep === 'pack' && (
          <div className="space-y-4 sm:space-y-6 animate-in fade-in slide-in-from-bottom-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 shadow-sm">
              <h2 className="text-base sm:text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                <span className="bg-brand-blue text-white w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0">2</span>
                <span className="break-words">Choisissez votre prestation</span>
              </h2>

              {/* Toggle Pack / Sur Mesure */}
              <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-4 sm:mb-6">
                <button 
                  onClick={() => setServiceMode('pack')} 
                  className={`p-2 sm:p-3 border rounded-lg text-xs sm:text-sm font-bold transition break-words ${
                    serviceMode === 'pack' 
                      ? 'border-brand-blue bg-blue-50 text-brand-blue' 
                      : 'border-slate-200 text-slate-500'
                  }`}
                >
                  Pack Existant
                </button>
                <button 
                  onClick={() => setServiceMode('custom')} 
                  className={`p-2 sm:p-3 border rounded-lg text-xs sm:text-sm font-bold transition break-words ${
                    serviceMode === 'custom' 
                      ? 'border-brand-blue bg-blue-50 text-brand-blue' 
                      : 'border-slate-200 text-slate-500'
                  }`}
                >
                  Sur Mesure
                </button>
              </div>

              {serviceMode === 'pack' ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Pack</label>
                    <SearchableSelect
                      options={allPacks.map((p: any) => ({ 
                        value: p.id, 
                        label: `${p.name} - ${p.priceTTC.toFixed(2)}€ TTC (${p.hours}h)` 
                      }))}
                      value={selectedPackId}
                      onChange={(value) => setSelectedPackId(value)}
                      placeholder="Sélectionnez un pack..."
                    />
                  </div>

                  {selectedPackId && (
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                      {(() => {
                        const pack = packs.find(p => p.id === selectedPackId);
                        if (!pack) return null;
                        return (
                          <div className="space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="font-bold text-slate-800">{pack.name}</span>
                              <span className="text-xl font-bold text-brand-blue">{pack.priceTTC.toFixed(2)} €</span>
                            </div>
                            <p className="text-sm text-slate-600">{pack.description}</p>
                            <div className="flex gap-2 text-xs">
                              <span className="px-2 py-1 bg-white rounded">{pack.hours}h d'intervention</span>
                              <span className="px-2 py-1 bg-white rounded">{pack.frequency}</span>
                              {pack.suppliesIncluded && (
                                <span className="px-2 py-1 bg-green-100 text-green-700 rounded">Fournitures incluses</span>
                              )}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Quantité</label>
                    <input
                      type="number"
                      min={1}
                      value={packQuantity}
                      onChange={(e) => setPackQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-32 px-4 py-2 rounded-lg border border-slate-300 focus:border-brand-blue focus:outline-none"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Description de la prestation</label>
                    <textarea
                      value={customDescription}
                      onChange={(e) => setCustomDescription(e.target.value)}
                      placeholder="Décrivez votre besoin..."
                      rows={3}
                      className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:border-brand-blue focus:outline-none resize-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Prix estimé (€ TTC)</label>
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      value={customUnitPrice}
                      onChange={(e) => setCustomUnitPrice(parseFloat(e.target.value) || 0)}
                      className="w-40 px-4 py-2 rounded-lg border border-slate-300 focus:border-brand-blue focus:outline-none"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-between">
              <button
                onClick={() => setCurrentStep('service')}
                className="flex items-center gap-2 text-slate-600 px-6 py-3 rounded-xl font-medium hover:bg-slate-100 transition"
              >
                <ArrowLeft className="w-5 h-5" />
                Retour
              </button>
              <button
                onClick={() => setCurrentStep('slots')}
                disabled={!canProceed()}
                className="flex items-center gap-2 bg-brand-blue text-white px-6 py-3 rounded-xl font-bold hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                Continuer
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Slots - Style DevisFactures */}
        {currentStep === 'slots' && (
          <div className="space-y-4 sm:space-y-6 animate-in fade-in slide-in-from-bottom-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 shadow-sm">
              <h2 className="text-base sm:text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                <span className="bg-brand-blue text-white w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0">3</span>
                <span className="break-words">Planification des interventions</span>
              </h2>

              {/* Actions */}
              <div className="flex flex-wrap gap-2 sm:gap-3 mb-4 sm:mb-6">
                <button
                  onClick={generateSlots}
                  className="flex items-center gap-1.5 sm:gap-2 bg-brand-blue text-white px-3 sm:px-4 py-2 rounded-lg font-bold hover:bg-teal-700 transition text-xs sm:text-sm"
                >
                  <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">Générer les créneaux</span>
                  <span className="sm:hidden">Générer</span>
                </button>
                <button
                  onClick={addNewSlot}
                  className="flex items-center gap-1.5 sm:gap-2 bg-white border-2 border-slate-200 text-slate-700 px-3 sm:px-4 py-2 rounded-lg font-bold hover:border-slate-300 transition text-xs sm:text-sm"
                >
                  <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">Ajouter manuellement</span>
                  <span className="sm:hidden">Ajouter</span>
                </button>
              </div>

              {/* Liste des créneaux */}
              {interventionSlots.length === 0 ? (
                <div className="p-6 sm:p-8 text-center text-slate-400 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
                  <Calendar className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-3 opacity-50" />
                  <p className="text-sm sm:text-base">Aucun créneau défini.</p>
                  <p className="text-xs sm:text-sm mt-1">Cliquez sur "Générer" ou "Ajouter"</p>
                </div>
              ) : (
                <div className="space-y-3 overflow-x-hidden">
                  {interventionSlots.map((slot, index) => {
                    const avail = slotAvailability.get(slot.id) || [];
                    const availCount = avail.length;
                    const hasAvailability = availCount > 0;

                    return (
                      <div 
                        key={slot.id} 
                        className={`p-3 sm:p-4 rounded-xl border-2 transition overflow-hidden ${
                          hasAvailability 
                            ? 'border-green-200 bg-green-50' 
                            : 'border-red-200 bg-red-50'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                          <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3 w-full">
                            <div className="min-w-0">
                              <label className="text-xs font-bold text-slate-500 mb-1 block truncate">Date</label>
                              <input
                                type="date"
                                value={slot.date}
                                min={getMartiniqueToday()}
                                onChange={(e) => updateSlot(index, 'date', e.target.value)}
                                className="w-full px-2 sm:px-3 py-2 rounded-lg border border-slate-300 text-sm focus:border-brand-blue focus:outline-none"
                              />
                            </div>
                            <div className="min-w-0">
                              <label className="text-xs font-bold text-slate-500 mb-1 block truncate">Début</label>
                              <input
                                type="time"
                                value={slot.startTime}
                                onChange={(e) => updateSlot(index, 'startTime', e.target.value)}
                                className="w-full px-2 sm:px-3 py-2 rounded-lg border border-slate-300 text-sm focus:border-brand-blue focus:outline-none"
                              />
                            </div>
                            <div className="min-w-0">
                              <label className="text-xs font-bold text-slate-500 mb-1 block truncate">Fin</label>
                              <input
                                type="time"
                                value={slot.endTime}
                                onChange={(e) => updateSlot(index, 'endTime', e.target.value)}
                                className="w-full px-2 sm:px-3 py-2 rounded-lg border border-slate-300 text-sm focus:border-brand-blue focus:outline-none"
                              />
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                            <div className={`text-xs sm:text-sm font-medium whitespace-nowrap ${hasAvailability ? 'text-green-700' : 'text-red-700'}`}>
                              {hasAvailability ? (
                                <span className="flex items-center gap-1">
                                  <Check className="w-3 h-3 sm:w-4 sm:h-4" />
                                  <span className="hidden sm:inline">{availCount} prestataire(s)</span>
                                  <span className="sm:hidden">{availCount} disp.</span>
                                </span>
                              ) : (
                                <span className="flex items-center gap-1">
                                  <AlertCircle className="w-3 h-3 sm:w-4 sm:h-4" />
                                  <span>Indisponible</span>
                                </span>
                              )}
                            </div>
                            <button
                              onClick={() => removeSlot(index)}
                              className="p-1.5 sm:p-2 text-red-500 hover:bg-red-100 rounded-lg transition shrink-0"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Total heures */}
              {interventionSlots.length > 0 && (
                <div className="mt-4 p-4 bg-blue-50 rounded-xl border border-blue-200">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-700">Total heures planifiées:</span>
                    <span className="text-lg font-bold text-brand-blue">
                      {interventionSlots.reduce((acc, s) => acc + s.duration, 0)}h
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row justify-between gap-3 sm:gap-0">
              <button
                onClick={() => setCurrentStep('pack')}
                className="flex items-center justify-center gap-2 text-slate-600 px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl font-medium hover:bg-slate-100 transition text-sm sm:text-base order-2 sm:order-1"
              >
                <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
                Retour
              </button>
              <button
                onClick={() => setCurrentStep('signature')}
                disabled={!canProceed()}
                className="flex items-center justify-center gap-2 bg-brand-blue text-white px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl font-bold hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition text-sm sm:text-base order-1 sm:order-2"
              >
                Continuer
                <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Signature */}
        {currentStep === 'signature' && (
          <div className="space-y-4 sm:space-y-6 animate-in fade-in slide-in-from-bottom-4">
            {/* Logo */}
            <div className="flex justify-center mb-6">
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200">
                <div className="flex items-center gap-3">
                  {companySettings?.logoUrl ? (
                    <img 
                      src={companySettings.logoUrl} 
                      alt="Logo" 
                      className="w-12 h-12 object-contain rounded-xl"
                    />
                  ) : (
                    <div className="w-12 h-12 bg-brand-blue rounded-xl flex items-center justify-center">
                      <Sparkles className="w-7 h-7 text-white" />
                    </div>
                  )}
                  <div>
                    <h1 className="text-xl font-bold text-slate-800">
                      {companySettings?.name || 'Presta Services Antilles'}
                    </h1>
                    <p className="text-xs text-slate-500">Services à la personne</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 shadow-sm">
              <h2 className="text-base sm:text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                <span className="bg-brand-blue text-white w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0">4</span>
                <span className="break-words">Signature et validation</span>
              </h2>

              <div className="space-y-4">
                {/* Récapitulatif complet */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                  <h4 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                    <Package className="w-4 h-4" />
                    Récapitulatif de votre demande
                  </h4>
                  
                  {/* Détails du pack */}
                  {serviceMode === 'pack' && selectedPack && (
                    <div className="mb-4 p-3 bg-white rounded-lg border border-slate-200">
                      <h5 className="font-bold text-slate-800 mb-2">{selectedPack.name}</h5>
                      <p className="text-sm text-slate-600 mb-3">{selectedPack.description}</p>
                      <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                        <div className="bg-slate-50 p-2 rounded">
                          <span className="text-slate-500 block">Durée</span>
                          <span className="font-medium">{selectedPack.hours}h d'intervention</span>
                        </div>
                        <div className="bg-slate-50 p-2 rounded">
                          <span className="text-slate-500 block">Fréquence</span>
                          <span className="font-medium">{selectedPack.frequency}</span>
                        </div>
                        {selectedPack.suppliesIncluded && (
                          <div className="bg-green-50 p-2 rounded col-span-2">
                            <span className="text-green-700 font-medium">Fournitures incluses</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Planning */}
                  {interventionSlots.length > 0 && (
                    <div className="mb-4">
                      <h5 className="font-bold text-slate-800 mb-2 flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        Planning des interventions
                      </h5>
                      <div className="space-y-2">
                        {interventionSlots.map((slot, idx) => (
                          <div key={slot.id} className="flex justify-between items-center p-2 bg-white rounded border border-slate-200 text-sm">
                            <span className="font-medium">Séance {idx + 1}</span>
                            <span className="text-slate-600">
                              {formatMartiniqueDate(slot.date)} - {slot.startTime} à {slot.endTime} ({slot.duration}h)
                            </span>
                          </div>
                        ))}
                      </div>
                      <div className="mt-2 text-right text-sm font-medium text-slate-700">
                        Total: {interventionSlots.reduce((acc, s) => acc + s.duration, 0)} heures
                      </div>
                    </div>
                  )}

                  {/* Détails de prix */}
                  <div className="border-t border-slate-200 pt-3">
                    <h5 className="font-bold text-slate-800 mb-2">Détail des prix</h5>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-600">Prix HT:</span>
                        <span>{totalHT.toFixed(2)} €</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600">TVA ({tvaRate}%):</span>
                        <span>{tvaAmount.toFixed(2)} €</span>
                      </div>
                      <div className="flex justify-between font-medium">
                        <span className="text-slate-700">Total TTC:</span>
                        <span className="text-brand-blue">{totalTTC.toFixed(2)} €</span>
                      </div>
                      
                      {/* Toggle Crédit d'impôt */}
                      <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-bold text-amber-800">Avance immédiate (Crédit d'impôt)</span>
                          <div
                            onClick={() => setTaxCreditActive(!taxCreditActive)}
                            className={`w-10 h-6 rounded-full p-1 cursor-pointer transition-colors ${taxCreditActive ? 'bg-green-500' : 'bg-slate-300'}`}
                          >
                            <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${taxCreditActive ? 'translate-x-4' : ''}`}></div>
                          </div>
                        </div>
                        <div className={`text-xs p-2 rounded mb-2 font-bold border ${taxCreditActive ? 'bg-green-50 text-green-800 border-green-100' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                          Statut: {taxCreditActive ? "ACTIVÉ (-50%)" : "NON ACTIVÉ"}
                        </div>
                        {taxCreditActive && (
                          <div className="text-xs text-slate-600 space-y-1">
                            <p className="italic border-l-2 border-green-300 pl-2 bg-green-50/50 p-1">
                              "Conformément à l'article 199 sexdecies du CGI, les prestations ouvrent droit à un crédit d'impôt de 50%."
                            </p>
                            <div className="flex justify-between text-green-600 font-medium pt-1">
                              <span>Montant du crédit d'impôt (50%):</span>
                              <span>-{taxCreditAmount.toFixed(2)} €</span>
                            </div>
                            <div className="flex justify-between text-brand-blue font-bold pt-1 border-t border-green-200">
                              <span>Reste à payer:</span>
                              <span>{clientToPay.toFixed(2)} €</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    <MapPin className="w-4 h-4 inline mr-1" />
                    Adresse d'intervention
                  </label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Entrez l'adresse complète..."
                    className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:border-brand-blue focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    Notes additionnelles (optionnel)
                  </label>
                  <textarea
                    value={additionalNotes}
                    onChange={(e) => setAdditionalNotes(e.target.value)}
                    placeholder="Précisez vos besoins spécifiques..."
                    rows={3}
                    className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:border-brand-blue focus:outline-none resize-none"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-4">
                    <label className="text-sm font-bold text-slate-700">
                      <PenTool className="w-4 h-4 inline mr-1" />
                      Signature électronique
                    </label>
                    <div className="flex gap-2">
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-1 text-sm text-brand-blue hover:underline"
                      >
                        <Upload className="w-4 h-4" />
                        Importer
                      </button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                      <button
                        onClick={clearSignature}
                        className="text-sm text-red-500 hover:underline"
                      >
                        Effacer
                      </button>
                    </div>
                  </div>

                  {uploadedSignature ? (
                    <div className="border-2 border-dashed border-slate-300 rounded-xl p-4 flex justify-center bg-slate-50">
                      <img
                        src={uploadedSignature}
                        alt="Signature importée"
                        className="max-h-40 object-contain"
                      />
                    </div>
                  ) : (
                    <div className="relative">
                      <canvas
                        ref={canvasRef}
                        width={600}
                        height={160}
                        onMouseDown={startDrawing}
                        onMouseMove={draw}
                        onMouseUp={stopDrawing}
                        onMouseLeave={stopDrawing}
                        onTouchStart={startDrawing}
                        onTouchMove={draw}
                        onTouchEnd={stopDrawing}
                        className="w-full h-40 border-2 border-dashed border-slate-300 rounded-xl bg-slate-50 cursor-crosshair touch-none"
                      />
                      <p className="text-xs text-slate-400 text-center mt-2">
                        Signez dans la zone ci-dessus avec votre souris ou votre doigt
                      </p>
                    </div>
                  )}
                </div>

                {/* Case à cocher "Je suis d'accord" */}
                <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                  <input
                    type="checkbox"
                    id="agreement"
                    checked={agreementChecked}
                    onChange={(e) => setAgreementChecked(e.target.checked)}
                    className="w-5 h-5 mt-0.5 text-brand-blue border-slate-300 rounded focus:ring-brand-blue"
                  />
                  <label htmlFor="agreement" className="text-sm text-slate-700 cursor-pointer">
                    <span className="font-bold">Je suis d'accord</span> avec les conditions de la prestation. 
                    Je confirme avoir pris connaissance du récapitulatif et des tarifs affichés ci-dessus. 
                    Je m'engage à régler le montant indiqué après déduction du crédit d'impôt si applicable.
                  </label>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-between gap-3 sm:gap-0">
              <button
                onClick={() => setCurrentStep('slots')}
                className="flex items-center justify-center gap-2 text-slate-600 px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl font-medium hover:bg-slate-100 transition text-sm sm:text-base order-2 sm:order-1"
              >
                <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
                Retour
              </button>
              <button
                onClick={handleSubmit}
                disabled={!canProceed() || isSubmitting}
                className="flex items-center justify-center gap-2 bg-green-600 text-white px-4 sm:px-8 py-2.5 sm:py-3 rounded-xl font-bold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition text-sm sm:text-base order-1 sm:order-2"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Envoi...
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5" />
                    Valider la demande
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Confirmation */}
        {currentStep === 'confirmation' && (
          <div className="text-center py-12 animate-in fade-in zoom-in">
            <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-12 h-12 text-green-600" />
            </div>
            <h2 className="text-3xl font-bold text-slate-800 mb-4">Demande envoyée avec succès !</h2>
            <p className="text-slate-500 mb-2">Votre demande a bien été transmise au secrétariat.</p>
            <p className="text-sm text-slate-400 mb-8">Référence: <strong>{requestId}</strong></p>
            
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 mb-8 max-w-md mx-auto">
              <p className="text-sm text-slate-700">
                Vous recevrez une confirmation par email et SMS dès que votre demande sera traitée.
                Un devis vous sera envoyé prochainement.
              </p>
            </div>

            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-2 bg-brand-blue text-white px-8 py-3 rounded-xl font-bold hover:bg-teal-700 transition mx-auto"
            >
              <CheckCircle className="w-5 h-5" />
              Retour à mon espace
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default NewServiceRequestPage;
