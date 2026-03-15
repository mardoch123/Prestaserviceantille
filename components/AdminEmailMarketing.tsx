import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Send,
  Users,
  Eye,
  History,
  ChevronDown,
  ChevronUp,
  Trash2,
  AlertCircle,
  CheckCircle,
  Clock,
  Mail,
  Search,
  Filter,
  X,
  FileText,
  Check,
  Loader2,
  Megaphone,
  Calendar,
  Package
} from 'lucide-react';
import { useData } from '../context/DataContext';
import type { Pack } from '../types';
import {
  getMarketingCampaigns,
  getEmailLogs,
  getTargetClients,
  createManualCampaign,
  sendCampaign,
  deleteCampaign,
  type MarketingCampaign,
  type MarketingEmailLog,
  type TargetClient
} from '../modules/marketing/ui/marketingEmailClient';
import { sendEmailViaEmailJS } from '../utils/emailService';
import { htmlToPlainText } from '../utils/emailTemplates';
import { supabase } from '../utils/supabaseClient';

interface EmailEditorState {
  name: string;
  subject: string;
  htmlContent: string;
  selectedPackId?: string;
}

interface TargetFilters {
  allClients: boolean;
  minDaysSinceRegistration?: number;
  maxDaysSinceRegistration?: number;
  specificClientIds: string[];
  hasMissions?: boolean;
  missionStatus: string[];
  minDaysSinceLastMission?: number;
  maxDaysSinceLastMission?: number;
}

export const AdminEmailMarketingPage: React.FC = () => {
  const navigate = useNavigate();
  const { clients, packs, currentUser } = useData();
  const [hasError, setHasError] = useState(false);

  // Error boundary effect
  useEffect(() => {
    const handleError = (error: ErrorEvent) => {
      console.error('Email Marketing Error:', error);
      setHasError(true);
    };
    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  // Tab state
  const [activeTab, setActiveTab] = useState<'compose' | 'history' | 'campaigns'>('compose');

  // Editor state
  const [editor, setEditor] = useState<EmailEditorState>({
    name: '',
    subject: '',
    htmlContent: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #0f766e;">Titre de votre message</h2>
  <p>Bonjour,</p>
  <p>Votre message ici...</p>
  <a href="https://www.prestaservicesantilles.com/" style="display: inline-block; background: #0d9488; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0;">En savoir plus</a>
  <p style="color: #64748b; font-size: 12px; margin-top: 30px;">
    Presta Services Antilles - Simplifiez votre quotidien
  </p>
</div>`
  });

  // Target filters
  const [filters, setFilters] = useState<TargetFilters>({
    allClients: true,
    specificClientIds: [],
    missionStatus: []
  });

  // UI state
  const [showPreview, setShowPreview] = useState(true);
  const [showTargetingOptions, setShowTargetingOptions] = useState(true);
  const [showClientSelector, setShowClientSelector] = useState(false);
  const [clientSearch, setClientSearch] = useState('');
  const [targetClients, setTargetClients] = useState<TargetClient[]>([]);
  const [isLoadingTargets, setIsLoadingTargets] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ success: boolean; message: string } | null>(null);

  // History data
  const [campaigns, setCampaigns] = useState<MarketingCampaign[]>([]);
  const [emailLogs, setEmailLogs] = useState<MarketingEmailLog[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Load history on tab change
  useEffect(() => {
    if (activeTab === 'history' || activeTab === 'campaigns') {
      loadHistory();
    }
  }, [activeTab]);

  const loadHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const [campaignsRes, logsRes] = await Promise.all([
        getMarketingCampaigns(),
        getEmailLogs(100)
      ]);

      if (campaignsRes.error) console.error('Failed to load campaigns:', campaignsRes.error);
      if (logsRes.error) console.error('Failed to load logs:', logsRes.error);

      setCampaigns(campaignsRes.data || []);
      setEmailLogs(logsRes.data || []);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Helper function to generate pack email content
  const generatePackEmailContent = (pack: Pack): string => {
    const frequencyLabels: Record<string, string> = {
      'Ponctuelle': 'Intervention ponctuelle',
      'Hebdomadaire': 'Tous les week',
      'Bimensuelle': '2 fois par mois',
      'Mensuelle': '1 fois par mois',
      'regulier': 'Régulièrement'
    };

    const formatPrice = (price: number): string => {
      return new Intl.NumberFormat('fr-FR', {
        style: 'currency',
        currency: 'EUR'
      }).format(price);
    };

    return `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #0f766e;">🎉 Nouveau pack disponible !</h2>
  <p>Bonjour,</p>
  <p>Nous avons le plaisir de vous annoncer l'arrivée d'un nouveau pack :</p>
  
  <div style="background: linear-gradient(135deg, #f0fdfa 0%, #ccfbf1 100%); border-left: 4px solid #0d9488; padding: 20px; margin: 20px 0; border-radius: 8px;">
    <h3 style="margin-top: 0; color: #115e59; font-size: 20px;">${pack.name}</h3>
    
    ${pack.description ? `<p style="color: #334155; margin: 10px 0; font-style: italic;">${pack.description}</p>` : ''}
    
    <div style="display: flex; flex-wrap: wrap; gap: 15px; margin: 15px 0;">
      ${pack.hours ? `<div style="background: white; padding: 10px 15px; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <span style="font-size: 12px; color: #64748b; display: block;">Durée</span>
        <span style="font-weight: bold; color: #0f766e;">${pack.hours}h</span>
      </div>` : ''}
      
      ${pack.frequency ? `<div style="background: white; padding: 10px 15px; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <span style="font-size: 12px; color: #64748b; display: block;">Fréquence</span>
        <span style="font-weight: bold; color: #0f766e;">${frequencyLabels[pack.frequency] || pack.frequency}</span>
      </div>` : ''}
      
      ${pack.quantity ? `<div style="background: white; padding: 10px 15px; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <span style="font-size: 12px; color: #64748b; display: block;">Quantité</span>
        <span style="font-weight: bold; color: #0f766e;">${pack.quantity}</span>
      </div>` : ''}
    </div>
    
    ${pack.location ? `<p style="margin: 10px 0; color: #475569;">
      <strong>📍 Lieu :</strong> ${pack.location}
    </p>` : ''}
    
    ${pack.suppliesIncluded ? `<p style="margin: 10px 0; color: #059669; font-weight: 500;">
      ✅ Fournitures incluses ${pack.suppliesDetails ? `(${pack.suppliesDetails})` : ''}
    </p>` : ''}
    
    <div style="background: white; padding: 15px; border-radius: 8px; margin-top: 15px; text-align: center; border: 2px solid #0d9488;">
      <span style="font-size: 14px; color: #64748b; display: block; margin-bottom: 5px;">Prix TTC</span>
      <span style="font-size: 32px; font-weight: bold; color: #0f766e;">${formatPrice(pack.priceTTC)}</span>
      ${pack.priceTaxCredit > 0 ? `<p style="margin: 8px 0 0 0; color: #059669; font-size: 13px;">💰 Après crédit d'impôt : ${formatPrice(pack.priceTaxCredit)}</p>` : ''}
    </div>
  </div>
  
  <p>Ne manquez pas cette opportunité ! Contactez-nous dès maintenant pour en profiter.</p>
  
  <div style="text-align: center; margin: 30px 0;">
    <a href="https://www.prestaservicesantilles.com/" style="display: inline-block; background: linear-gradient(135deg, #0d9488, #0f766e); color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">En savoir plus</a>
  </div>
  
  <p style="color: #64748b; font-size: 12px; margin-top: 30px; text-align: center;">
    Presta Services Antilles - Simplifiez votre quotidien<br>
    📞 0696 06 15 94 | 📧 prestaservicesantilles.rh@gmail.com
  </p>
</div>`;
  };
  useEffect(() => {
    const loadTargetClients = async () => {
      if (!filters.allClients && filters.specificClientIds.length === 0) {
        setTargetClients([]);
        return;
      }

      setIsLoadingTargets(true);
      const { data, error } = await getTargetClients({
        target_all_clients: filters.allClients,
        target_min_days_since_registration: filters.minDaysSinceRegistration,
        target_max_days_since_registration: filters.maxDaysSinceRegistration,
        target_specific_client_ids: filters.specificClientIds.length > 0 ? filters.specificClientIds : undefined,
        target_has_missions: filters.hasMissions,
        target_mission_status: filters.missionStatus.length > 0 ? filters.missionStatus : undefined,
        target_min_days_since_last_mission: filters.minDaysSinceLastMission,
        target_max_days_since_last_mission: filters.maxDaysSinceLastMission
      });

      if (error) {
        console.error('Failed to load target clients:', error);
      } else {
        setTargetClients(data || []);
      }
      setIsLoadingTargets(false);
    };

    const timeout = setTimeout(loadTargetClients, 300);
    return () => clearTimeout(timeout);
  }, [filters]);

  // Filter clients for selector
  const filteredClients = useMemo(() => {
    if (!clientSearch.trim()) return clients.slice(0, 50);
    const search = clientSearch.toLowerCase();
    return clients.filter(c =>
      c.name?.toLowerCase().includes(search) ||
      c.email?.toLowerCase().includes(search)
    ).slice(0, 50);
  }, [clients, clientSearch]);

  // Quick templates
  const quickTemplates = [
    { name: 'Nouveau pack', icon: Package, color: 'bg-emerald-100 text-emerald-700' },
    { name: 'Rappel inactif', icon: Clock, color: 'bg-amber-100 text-amber-700' },
    { name: 'Offre spéciale', icon: Megaphone, color: 'bg-rose-100 text-rose-700' },
    { name: 'Newsletter', icon: Mail, color: 'bg-blue-100 text-blue-700' }
  ];

  const applyTemplate = (templateName: string) => {
    switch (templateName) {
      case 'Nouveau pack':
        // Check if a pack is selected
        if (!editor.selectedPackId) {
          setSendResult({ success: false, message: 'Veuillez d\'abord sélectionner un pack dans la section "Pack promotionnel"' });
          setTimeout(() => setSendResult(null), 3000);
          return;
        }
        
        const selectedPack = packs.find(p => p.id === editor.selectedPackId);
        if (!selectedPack) {
          setSendResult({ success: false, message: 'Pack non trouvé' });
          setTimeout(() => setSendResult(null), 3000);
          return;
        }
        
        setEditor(prev => ({
          ...prev,
          name: `Nouveau pack : ${selectedPack.name}`,
          subject: `🎉 Découvrez notre nouveau pack : ${selectedPack.name} !`,
          htmlContent: generatePackEmailContent(selectedPack)
        }));
        break;
      case 'Rappel inactif':
        setEditor(prev => ({
          ...prev,
          name: 'Rappel - Nos packs vous attendent',
          subject: 'Vos services d\'entretien vous attendent !',
          htmlContent: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #0f766e;">Nos packs vous attendent !</h2>
  <p>Bonjour,</p>
  <p>Nous avons remarqué que vous êtes inscrit chez Presta Services Antilles depuis quelques temps. Avez-vous découvert tous nos packs ?</p>
  <div style="background: #fffbeb; border-left: 4px solid #f59e0b; padding: 20px; margin: 20px 0;">
    <h3 style="margin-top: 0; color: #b45309;">Pourquoi choisir nos services ?</h3>
    <ul style="margin-bottom: 0;">
      <li>Ménage régulier ou ponctuel</li>
      <li>Entretien de vos espaces extérieurs</li>
      <li>Services à la personne</li>
      <li>Et bien plus encore !</li>
    </ul>
  </div>
  <a href="https://www.prestaservicesantilles.com/" style="display: inline-block; background: #0d9488; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0;">Découvrir nos offres</a>
  <p style="color: #64748b; font-size: 12px; margin-top: 30px;">
    Presta Services Antilles - Simplifiez votre quotidien<br>
    📞 0696 06 15 94 | 📧 prestaservicesantilles.rh@gmail.com
  </p>
</div>`
        }));
        break;
      case 'Offre spéciale':
        setEditor(prev => ({
          ...prev,
          name: 'Offre spéciale limitée',
          subject: 'Offre spéciale - Profitez-en maintenant !',
          htmlContent: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background: linear-gradient(135deg, #0d9488, #0f766e); color: white; padding: 30px; text-align: center;">
    <h2 style="margin: 0; font-size: 28px;">OFFRE SPÉCIALE</h2>
    <p style="margin: 10px 0 0 0; font-size: 18px;">Profitez-en avant qu'il ne soit trop tard !</p>
  </div>
  <div style="padding: 30px;">
    <p>Bonjour,</p>
    <p>Nous avons une offre exceptionnelle rien que pour vous !</p>
    <div style="background: #fef2f2; border: 2px dashed #ef4444; padding: 20px; margin: 20px 0; text-align: center;">
      <p style="font-size: 32px; font-weight: bold; color: #dc2626; margin: 0;">-XX%</p>
      <p style="color: #991b1b; margin: 10px 0;">Sur votre prochaine prestation</p>
    </div>
    <a href="https://www.prestaservicesantilles.com/" style="display: inline-block; background: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: bold;">J'en profite !</a>
    <p style="color: #64748b; font-size: 12px; margin-top: 30px;">
      Offre limitée dans le temps. Presta Services Antilles
    </p>
  </div>
</div>`
        }));
        break;
      case 'Newsletter':
        setEditor(prev => ({
          ...prev,
          name: 'Newsletter mensuelle',
          subject: 'Votre newsletter Presta Services Antilles',
          htmlContent: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background: #f8fafc; padding: 20px; border-bottom: 3px solid #0d9488;">
    <h2 style="color: #0f766e; margin: 0;">Newsletter</h2>
    <p style="color: #64748b; margin: 5px 0 0 0;">Toute l'actualité de Presta Services Antilles</p>
  </div>
  <div style="padding: 30px;">
    <p>Bonjour,</p>
    <p>Découvrez les dernières nouvelles et nos offres du moment !</p>
    
    <div style="background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 20px 0;">
      <h3 style="color: #0f766e; margin-top: 0;">🆕 Nouveau service</h3>
      <p>Description de votre nouveauté...</p>
    </div>
    
    <div style="background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 20px 0;">
      <h3 style="color: #0f766e; margin-top: 0;">💡 Conseil du mois</h3>
      <p>Votre conseil personnalisé...</p>
    </div>
    
    <a href="https://www.prestaservicesantilles.com/" style="display: inline-block; background: #0d9488; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0;">Visiter notre site</a>
  </div>
  <div style="background: #f8fafc; padding: 20px; text-align: center; color: #64748b; font-size: 12px;">
    Presta Services Antilles - Simplifiez votre quotidien
  </div>
</div>`
        }));
        break;
    }
  };

  const handleSend = async () => {
    if (!editor.name.trim() || !editor.subject.trim() || !editor.htmlContent.trim()) {
      setSendResult({ success: false, message: 'Veuillez remplir tous les champs obligatoires' });
      return;
    }

    if (targetClients.length === 0) {
      setSendResult({ success: false, message: 'Aucun client ciblé. Vérifiez vos filtres.' });
      return;
    }

    setIsSending(true);
    setSendResult(null);

    try {
      // Create campaign with 'sending' status
      const { campaignId, error: createError } = await createManualCampaign({
        name: editor.name,
        subject: editor.subject,
        html_content: editor.htmlContent,
        target_all_clients: filters.allClients,
        target_min_days_since_registration: filters.minDaysSinceRegistration,
        target_max_days_since_registration: filters.maxDaysSinceRegistration,
        target_specific_client_ids: filters.specificClientIds.length > 0 ? filters.specificClientIds : undefined,
        target_has_missions: filters.hasMissions,
        target_mission_status: filters.missionStatus.length > 0 ? filters.missionStatus : undefined,
        target_min_days_since_last_mission: filters.minDaysSinceLastMission,
        target_max_days_since_last_mission: filters.maxDaysSinceLastMission
      });

      if (createError || !campaignId) {
        setSendResult({ success: false, message: createError || 'Erreur lors de la création de la campagne' });
        setIsSending(false);
        return;
      }

      // Update campaign status to 'sending'
      await supabase
        .from('marketing_campaigns')
        .update({ status: 'sending', sent_at: new Date().toISOString() })
        .eq('id', campaignId);

      // Send emails with delay (2 per minute = 1 every 30 seconds)
      let sentCount = 0;
      let failedCount = 0;
      const totalClients = targetClients.length;
      const DELAY_MS = 30000; // 30 seconds between emails

      for (let i = 0; i < targetClients.length; i++) {
        const client = targetClients[i];
        
        // Update progress
        setSendResult({
          success: true,
          message: `Envoi en cours... ${i + 1}/${totalClients} (${sentCount} envoyés, ${failedCount} échecs)`
        });

        try {
          // Convert HTML to plain text for the email
          const plainTextContent = htmlToPlainText(editor.htmlContent);
          
          const success = await sendEmailViaEmailJS(
            client.client_email,
            editor.subject,
            'default',
            {
              name: client.client_name,
              clientName: client.client_name,
              message: plainTextContent
            }
          );

          // Log the email
          await supabase.from('marketing_email_logs').insert({
            campaign_id: campaignId,
            client_id: client.client_id,
            client_email: client.client_email,
            client_name: client.client_name,
            subject: editor.subject,
            html_content: editor.htmlContent,
            status: success ? 'sent' : 'failed',
            sent_at: success ? new Date().toISOString() : null
          });

          if (success) {
            sentCount++;
          } else {
            failedCount++;
          }

          // Update campaign progress
          await supabase
            .from('marketing_campaigns')
            .update({ sent_count: sentCount, failed_count: failedCount })
            .eq('id', campaignId);

        } catch (e) {
          failedCount++;
          console.error('Failed to send email to', client.client_email, e);
        }

        // Wait 30 seconds before sending next email (except for the last one)
        if (i < targetClients.length - 1) {
          await new Promise(resolve => setTimeout(resolve, DELAY_MS));
        }
      }

      // Mark campaign as completed
      await supabase
        .from('marketing_campaigns')
        .update({ 
          status: failedCount > 0 && sentCount === 0 ? 'failed' : 'sent',
          sent_count: sentCount,
          failed_count: failedCount
        })
        .eq('id', campaignId);

      setSendResult({
        success: true,
        message: `Campagne terminée ! ${sentCount} email(s) envoyé(s) avec succès${failedCount > 0 ? `, ${failedCount} échec(s)` : ''}`
      });

      // Reset form
      setEditor({
        name: '',
        subject: '',
        htmlContent: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #0f766e;">Titre de votre message</h2>
  <p>Bonjour,</p>
  <p>Votre message ici...</p>
  <a href="https://www.prestaservicesantilles.com/" style="display: inline-block; background: #0d9488; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0;">En savoir plus</a>
  <p style="color: #64748b; font-size: 12px; margin-top: 30px;">
    Presta Services Antilles - Simplifiez votre quotidien
  </p>
</div>`
      });
      setFilters({
        allClients: true,
        specificClientIds: [],
        missionStatus: []
      });
      
      // Refresh campaigns list
      loadHistory();
    } catch (e: any) {
      setSendResult({ success: false, message: e.message || 'Erreur lors de l\'envoi' });
    } finally {
      setIsSending(false);
    }
  };

  const toggleClientSelection = (clientId: string) => {
    setFilters(prev => ({
      ...prev,
      allClients: false,
      specificClientIds: prev.specificClientIds.includes(clientId)
        ? prev.specificClientIds.filter(id => id !== clientId)
        : [...prev.specificClientIds, clientId]
    }));
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'sent':
        return <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-medium">Envoyé</span>;
      case 'sending':
        return <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> En cours</span>;
      case 'pending':
        return <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">En attente</span>;
      case 'failed':
        return <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">Échec</span>;
      case 'draft':
        return <span className="px-2 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-medium">Brouillon</span>;
      default:
        return <span className="px-2 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-medium">{status}</span>;
    }
  };

  return (
    <div className="h-full flex flex-col bg-slate-50">
      {hasError && (
        <div className="p-4 bg-red-100 text-red-700 border-b border-red-200">
          <p className="font-medium">Une erreur s'est produite lors du chargement de cette page.</p>
          <p className="text-sm">Veuillez rafraîchir la page ou contacter le support.</p>
        </div>
      )}
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center">
            <Mail className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">Email Marketing</h1>
            <p className="text-sm text-slate-500">Rédigez et envoyez des emails à vos clients</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('compose')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'compose'
                ? 'bg-emerald-100 text-emerald-700'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Send className="w-4 h-4 inline mr-2" />
            Rédiger
          </button>
          <button
            onClick={() => setActiveTab('campaigns')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'campaigns'
                ? 'bg-emerald-100 text-emerald-700'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Megaphone className="w-4 h-4 inline mr-2" />
            Campagnes
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'history'
                ? 'bg-emerald-100 text-emerald-700'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <History className="w-4 h-4 inline mr-2" />
            Historique
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {activeTab === 'compose' && (
          <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Editor Panel */}
            <div className="space-y-6">
              {/* Quick Templates */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
                <h3 className="text-sm font-semibold text-slate-700 mb-3">Modèles rapides</h3>
                <div className="grid grid-cols-2 gap-2">
                  {quickTemplates.map(template => (
                    <button
                      key={template.name}
                      onClick={() => applyTemplate(template.name)}
                      className={`flex items-center gap-2 p-3 rounded-lg text-left transition-colors hover:bg-slate-50 ${template.color}`}
                    >
                      <template.icon className="w-4 h-4" />
                      <span className="text-sm font-medium">{template.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Campaign Details */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 space-y-4">
                <h3 className="text-sm font-semibold text-slate-700">Détails de la campagne</h3>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Nom de la campagne *</label>
                  <input
                    type="text"
                    value={editor.name}
                    onChange={e => setEditor(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Ex: Newsletter Juillet 2024"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Objet de l'email *</label>
                  <input
                    type="text"
                    value={editor.subject}
                    onChange={e => setEditor(prev => ({ ...prev, subject: e.target.value }))}
                    placeholder="Ex: Découvrez nos nouveautés !"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>

                {/* Pack Selection for Promotions */}
                <div className="pt-4 border-t border-slate-200">
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-2">
                    <Package className="w-4 h-4 text-emerald-600" />
                    Pack promotionnel (optionnel)
                  </label>
                  <p className="text-xs text-slate-500 mb-2">
                    Sélectionnez un pack pour le template "Nouveau pack" - les informations seront automatiquement intégrées
                  </p>
                  <select
                    value={editor.selectedPackId || ''}
                    onChange={e => setEditor(prev => ({ ...prev, selectedPackId: e.target.value || undefined }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm"
                  >
                    <option value="">-- Sélectionner un pack --</option>
                    {packs.map(pack => (
                      <option key={pack.id} value={pack.id}>
                        {pack.name} - {pack.priceTTC.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
                      </option>
                    ))}
                  </select>
                  
                  {editor.selectedPackId && (
                    <div className="mt-3 p-3 bg-emerald-50 rounded-lg border border-emerald-100">
                      {(() => {
                        const selectedPack = packs.find(p => p.id === editor.selectedPackId);
                        if (!selectedPack) return null;
                        return (
                          <div className="space-y-1">
                            <p className="text-sm font-semibold text-emerald-800">{selectedPack.name}</p>
                            <p className="text-xs text-emerald-600">
                              {selectedPack.hours}h • {selectedPack.frequency} • {selectedPack.priceTTC.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
                            </p>
                            <p className="text-xs text-emerald-700 mt-2">
                              Cliquez sur le template "Nouveau pack" pour générer l'email avec ces données
                            </p>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              </div>

              {/* Targeting */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
                <button
                  onClick={() => setShowTargetingOptions(!showTargetingOptions)}
                  className="flex items-center justify-between w-full"
                >
                  <div className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-slate-500" />
                    <h3 className="text-sm font-semibold text-slate-700">Ciblage</h3>
                  </div>
                  {showTargetingOptions ? <ChevronUp className="w-5 h-5 text-slate-500" /> : <ChevronDown className="w-5 h-5 text-slate-500" />}
                </button>

                {showTargetingOptions && (
                  <div className="mt-4 space-y-4">
                    {/* Target All */}
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={filters.allClients}
                        onChange={e => setFilters(prev => ({ ...prev, allClients: e.target.checked, specificClientIds: [] }))}
                        className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                      />
                      <span className="text-sm text-slate-700">Tous les clients ({clients.length})</span>
                    </label>

                    {/* Or Specific Clients */}
                    {!filters.allClients && (
                      <div className="pl-6 space-y-2">
                        <button
                          onClick={() => setShowClientSelector(!showClientSelector)}
                          className="text-sm text-emerald-600 hover:text-emerald-700 font-medium"
                        >
                          {filters.specificClientIds.length > 0
                            ? `${filters.specificClientIds.length} client(s) sélectionné(s)`
                            : 'Sélectionner des clients spécifiques'}
                        </button>

                        {showClientSelector && (
                          <div className="bg-slate-50 rounded-lg p-3 max-h-64 overflow-auto">
                            <div className="relative mb-2">
                              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                              <input
                                type="text"
                                value={clientSearch}
                                onChange={e => setClientSearch(e.target.value)}
                                placeholder="Rechercher un client..."
                                className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm"
                              />
                            </div>
                            <div className="space-y-1">
                              {filteredClients.map(client => (
                                <label
                                  key={client.id}
                                  className="flex items-center gap-2 p-2 hover:bg-white rounded-lg cursor-pointer"
                                >
                                  <input
                                    type="checkbox"
                                    checked={filters.specificClientIds.includes(client.id)}
                                    onChange={() => toggleClientSelection(client.id)}
                                    className="w-4 h-4 text-emerald-600 rounded border-slate-300"
                                  />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-slate-700 truncate">
                                      {client.name || 'Sans nom'}
                                    </p>
                                    <p className="text-xs text-slate-500 truncate">{client.email}</p>
                                  </div>
                                </label>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Registration Date Filter */}
                    <div className="border-t border-slate-200 pt-4">
                      <p className="text-sm font-medium text-slate-700 mb-2">Inscrit depuis (jours)</p>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          value={filters.minDaysSinceRegistration || ''}
                          onChange={e => setFilters(prev => ({ ...prev, minDaysSinceRegistration: e.target.value ? parseInt(e.target.value) : undefined }))}
                          placeholder="Min"
                          className="w-24 px-3 py-2 border border-slate-300 rounded-lg text-sm"
                        />
                        <span className="text-slate-400">à</span>
                        <input
                          type="number"
                          value={filters.maxDaysSinceRegistration || ''}
                          onChange={e => setFilters(prev => ({ ...prev, maxDaysSinceRegistration: e.target.value ? parseInt(e.target.value) : undefined }))}
                          placeholder="Max"
                          className="w-24 px-3 py-2 border border-slate-300 rounded-lg text-sm"
                        />
                      </div>
                    </div>

                    {/* Mission Filters - Radio buttons for mutually exclusive options */}
                    <div className="border-t border-slate-200 pt-4">
                      <p className="text-sm font-medium text-slate-700 mb-2">Missions</p>
                      <div className="space-y-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="missionFilter"
                            checked={filters.hasMissions === undefined}
                            onChange={() => setFilters(prev => ({ ...prev, hasMissions: undefined }))}
                            className="w-4 h-4 text-emerald-600 border-slate-300"
                          />
                          <span className="text-sm text-slate-700">Tous les clients</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="missionFilter"
                            checked={filters.hasMissions === true}
                            onChange={() => setFilters(prev => ({ ...prev, hasMissions: true }))}
                            className="w-4 h-4 text-emerald-600 border-slate-300"
                          />
                          <span className="text-sm text-slate-700">A des missions</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="missionFilter"
                            checked={filters.hasMissions === false}
                            onChange={() => setFilters(prev => ({ ...prev, hasMissions: false }))}
                            className="w-4 h-4 text-emerald-600 border-slate-300"
                          />
                          <span className="text-sm text-slate-700">N'a pas de missions</span>
                        </label>
                      </div>

                      {filters.hasMissions === true && (
                        <div className="mt-3">
                          <p className="text-xs text-slate-500 mb-1">Dernière mission (jours)</p>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              value={filters.minDaysSinceLastMission || ''}
                              onChange={e => setFilters(prev => ({ ...prev, minDaysSinceLastMission: e.target.value ? parseInt(e.target.value) : undefined }))}
                              placeholder="Min"
                              className="w-24 px-3 py-2 border border-slate-300 rounded-lg text-sm"
                            />
                            <span className="text-slate-400">à</span>
                            <input
                              type="number"
                              value={filters.maxDaysSinceLastMission || ''}
                              onChange={e => setFilters(prev => ({ ...prev, maxDaysSinceLastMission: e.target.value ? parseInt(e.target.value) : undefined }))}
                              placeholder="Max"
                              className="w-24 px-3 py-2 border border-slate-300 rounded-lg text-sm"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Target Count */}
                <div className="mt-4 p-3 bg-emerald-50 rounded-lg border border-emerald-100">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-emerald-700">
                      {isLoadingTargets ? 'Calcul...' : `${targetClients.length} client(s) ciblé(s)`}
                    </span>
                    {isLoadingTargets && <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />}
                  </div>
                </div>

                {/* Target Client List - Moved here from right panel */}
                <div className="mt-4 bg-slate-50 rounded-lg border border-slate-200 overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-200 bg-white">
                    <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      Liste des clients ciblés ({targetClients.length})
                    </h4>
                  </div>
                  <div className="max-h-64 overflow-auto">
                    {targetClients.length === 0 ? (
                      <div className="p-6 text-center text-slate-400">
                        <Filter className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">Ajustez vos filtres pour cibler des clients</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-100">
                        {targetClients.map(client => (
                          <div key={client.client_id} className="px-4 py-3 hover:bg-white">
                            <p className="text-sm font-medium text-slate-700">{client.client_name}</p>
                            <p className="text-xs text-slate-500">{client.client_email}</p>
                            <div className="flex items-center gap-2 mt-1">
                              {client.has_missions ? (
                                <span className="text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                                  {client.days_since_last_mission !== undefined
                                    ? `Dernière mission il y a ${client.days_since_last_mission}j`
                                    : 'A des missions'}
                                </span>
                              ) : (
                                <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded">Aucune mission</span>
                              )}
                              <span className="text-xs text-slate-400">
                                Inscrit depuis {client.days_since_registration}j
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* HTML Editor */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
                <h3 className="text-sm font-semibold text-slate-700 mb-3">Contenu HTML</h3>
                <textarea
                  value={editor.htmlContent}
                  onChange={e => setEditor(prev => ({ ...prev, htmlContent: e.target.value }))}
                  rows={12}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="<div>Votre contenu HTML ici...</div>"
                />
                <p className="text-xs text-slate-500 mt-2">
                  Vous pouvez utiliser du HTML pour formater votre email. Assurez-vous d'inclure le style inline.
                </p>
              </div>

              {/* Send Button */}
              {sendResult && (
                <div className={`p-4 rounded-lg flex items-center gap-2 ${sendResult.success ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                  {sendResult.success ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                  <span className="text-sm font-medium">{sendResult.message}</span>
                </div>
              )}

              <button
                onClick={handleSend}
                disabled={isSending || targetClients.length === 0}
                className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-lg font-semibold hover:from-emerald-600 hover:to-teal-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSending ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Envoi en cours...
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5" />
                    Envoyer à {targetClients.length} client{targetClients.length > 1 ? 's' : ''}
                  </>
                )}
              </button>
            </div>

            {/* Preview Panel */}
            <div className="space-y-4 lg:sticky lg:top-6 lg:self-start">
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <Eye className="w-4 h-4" />
                    Aperçu
                  </h3>
                  <button
                    onClick={() => setShowPreview(!showPreview)}
                    className="text-sm text-emerald-600 hover:text-emerald-700"
                  >
                    {showPreview ? 'Masquer' : 'Afficher'}
                  </button>
                </div>

                {showPreview && (
                  <div className="p-4">
                    <div className="border border-slate-200 rounded-lg overflow-hidden">
                      <div className="bg-slate-100 px-4 py-2 border-b border-slate-200 text-xs text-slate-500">
                        Objet: {editor.subject || '(sans objet)'}
                      </div>
                      <div
                        className="p-4 bg-white"
                        dangerouslySetInnerHTML={{ __html: editor.htmlContent }}
                      />
                    </div>
                  </div>
                )}

                {!showPreview && (
                  <div className="p-8 text-center text-slate-400">
                    <Eye className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Cliquez sur "Afficher" pour voir l'aperçu</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'campaigns' && (
          <div className="max-w-4xl mx-auto">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              {isLoadingHistory ? (
                <div className="p-8 text-center">
                  <Loader2 className="w-8 h-8 animate-spin text-emerald-600 mx-auto mb-2" />
                  <p className="text-slate-500">Chargement...</p>
                </div>
              ) : campaigns.length === 0 ? (
                <div className="p-8 text-center text-slate-400">
                  <Megaphone className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Aucune campagne pour le moment</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {campaigns.map(campaign => (
                    <div key={campaign.id} className="px-6 py-4 hover:bg-slate-50">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-semibold text-slate-800 truncate">{campaign.name}</h3>
                            {getStatusBadge(campaign.status)}
                          </div>
                          <p className="text-sm text-slate-500 mt-1">{campaign.subject}</p>
                          <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {new Date(campaign.created_at).toLocaleDateString('fr-FR')}
                            </span>
                            <span className="flex items-center gap-1">
                              <Mail className="w-3 h-3" />
                              {campaign.sent_count} envoyé(s)
                            </span>
                            {campaign.type !== 'manual' && (
                              <span className="px-2 py-0.5 bg-slate-100 rounded">
                                {campaign.type === 'auto_new_pack' && 'Auto: Nouveau pack'}
                                {campaign.type === 'auto_no_mission' && 'Auto: Sans mission'}
                                {campaign.type === 'auto_post_mission' && 'Auto: Post-mission'}
                              </span>
                            )}
                          </div>
                        </div>
                        {campaign.status === 'draft' && (
                          <button
                            onClick={async () => {
                              const { success } = await deleteCampaign(campaign.id);
                              if (success) loadHistory();
                            }}
                            className="p-2 text-slate-400 hover:text-red-500"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="max-w-4xl mx-auto">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              {isLoadingHistory ? (
                <div className="p-8 text-center">
                  <Loader2 className="w-8 h-8 animate-spin text-emerald-600 mx-auto mb-2" />
                  <p className="text-slate-500">Chargement...</p>
                </div>
              ) : emailLogs.length === 0 ? (
                <div className="p-8 text-center text-slate-400">
                  <History className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Aucun email envoyé pour le moment</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {emailLogs.map(log => (
                    <div key={log.id} className="px-6 py-4 hover:bg-slate-50">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <Mail className={`w-4 h-4 ${log.status === 'sent' ? 'text-emerald-500' : log.status === 'failed' ? 'text-red-500' : 'text-amber-500'}`} />
                            <p className="text-sm font-medium text-slate-700 truncate">{log.client_email}</p>
                            {getStatusBadge(log.status)}
                          </div>
                          <p className="text-sm text-slate-600 mt-1">{log.subject}</p>
                          <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
                            <span>{new Date(log.created_at).toLocaleString('fr-FR')}</span>
                            {log.sent_at && (
                              <span className="text-emerald-600">
                                Envoyé le {new Date(log.sent_at).toLocaleString('fr-FR')}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminEmailMarketingPage;
