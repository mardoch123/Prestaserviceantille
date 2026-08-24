import React, { useState, useMemo } from 'react';
import {
  Lock,
  Unlock,
  TrendingUp,
  Clock,
  CheckCircle,
  AlertCircle,
  Calendar,
  Filter,
  DollarSign,
  PieChart,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  LogOut,
  Shield,
  Eye,
  EyeOff,
  FileText,
  CreditCard,
  Wallet,
  TrendingDown,
  Send,
  XCircle,
  Ban,
  User,
  ChevronRight,
  X,
  ExternalLink,
  Download,
  Printer,
  MapPin,
  Briefcase,
  Package
} from 'lucide-react';
import { useData } from '../../../context/DataContext';
import { useAccountingAuth, formatTimeLeft } from '../useAccountingAuth';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { MARTINIQUE_TIMEZONE } from '../../../src/utils/martiniqueTime';
import type { Document, Mission, Client } from '../../../types';

dayjs.extend(utc);
dayjs.extend(timezone);

type TimeFilter = 'day' | 'week' | 'month' | 'year' | 'all';

// Document Status Types for Accounting
type DocumentStatus =
  | 'draft'           // Brouillon - pas encore envoyé
  | 'sent'            // Envoyé - en attente de signature
  | 'signed'          // Signé - devis validé, missions en cours
  | 'converted'       // Converti en facture
  | 'paid'            // Payé - facture réglée
  | 'pending'         // En attente de paiement
  | 'expired'         // Expiré
  | 'rejected';       // Refusé

  // PDF Export utility
const exportDocumentsToPDF = (documents: Document[], title: string, totalAmount: number) => {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  const dateStr = new Date().toLocaleDateString('fr-FR');
  
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${title} - ${dateStr}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 40px; color: #333; }
        h1 { color: #1e293b; border-bottom: 3px solid #10b981; padding-bottom: 10px; }
        .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; }
        .date { color: #64748b; font-size: 14px; }
        .summary { background: #f1f5f9; padding: 20px; border-radius: 8px; margin-bottom: 30px; }
        .summary-row { display: flex; justify-content: space-between; margin: 10px 0; }
        .summary-label { font-weight: bold; color: #475569; }
        .summary-value { font-size: 24px; color: #059669; font-weight: bold; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th { background: #1e293b; color: white; padding: 12px; text-align: left; }
        td { padding: 12px; border-bottom: 1px solid #e2e8f0; }
        tr:hover { background: #f8fafc; }
        .status-badge { padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: bold; }
        .status-paid { background: #d1fae5; color: #059669; }
        .status-pending { background: #fed7aa; color: #ea580c; }
        .status-signed { background: #dbeafe; color: #2563eb; }
        .status-sent { background: #e9d5ff; color: #9333ea; }
        .status-expired { background: #fee2e2; color: #dc2626; }
        .status-rejected { background: #f1f5f9; color: #64748b; }
        .status-draft { background: #f1f5f9; color: #475569; }
        .amount { font-weight: bold; color: #1e293b; }
        .type-facture { color: #059669; }
        .type-devis { color: #2563eb; }
        .footer { margin-top: 40px; text-align: center; color: #94a3b8; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>${title}</h1>
        <div class="date">Généré le ${dateStr}</div>
      </div>
      
      <div class="summary">
        <div class="summary-row">
          <span class="summary-label">Nombre de documents</span>
          <span>${documents.length}</span>
        </div>
        <div class="summary-row">
          <span class="summary-label">Montant Total</span>
          <span class="summary-value">${totalAmount.toFixed(2)} €</span>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Référence</th>
            <th>Type</th>
            <th>Client</th>
            <th>Date</th>
            <th>Statut</th>
            <th style="text-align: right;">Montant TTC</th>
          </tr>
        </thead>
        <tbody>
          ${documents.map(doc => {
            const statusClass = 'status-' + doc.status;
            const statusLabels: Record<string, string> = {
              'paid': 'Payé',
              'pending': 'En attente',
              'signed': 'Signé',
              'sent': 'Envoyé',
              'expired': 'Expiré',
              'rejected': 'Refusé',
              'draft': 'Brouillon',
              'converted': 'Converti'
            };
            const statusLabel = statusLabels[doc.status] || doc.status;
            const typeClass = doc.type === 'Facture' ? 'type-facture' : 'type-devis';
            const dateFormatted = new Date(doc.date).toLocaleDateString('fr-FR');
            return '<tr>' +
              '<td><strong>' + doc.ref + '</strong></td>' +
              '<td class="' + typeClass + '">' + doc.type + '</td>' +
              '<td>' + doc.clientName + '</td>' +
              '<td>' + dateFormatted + '</td>' +
              '<td><span class="status-badge ' + statusClass + '">' + statusLabel + '</span></td>' +
              '<td class="amount" style="text-align: right;">' + (doc.totalTTC || 0).toFixed(2) + ' €</td>' +
              '</tr>';
          }).join('')}
        </tbody>
      </table>

      <div class="footer">
        <p>Document généré par le module Comptabilité - Presta Service Antilles</p>
      </div>
      
      <script>
        window.onload = function() {
          setTimeout(function() {
            window.print();
          }, 500);
        };
      </script>
    </body>
    </html>
  `;

  printWindow.document.write(htmlContent);
  printWindow.document.close();
};

// Login Component
const AccountingLogin: React.FC<{
  onLogin: (code: string) => void;
  error: string | null;
}> = ({ onLogin, error }) => {
  const [code, setCode] = useState('');
  const [showCode, setShowCode] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onLogin(code);
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Security Badge */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-slate-800 to-slate-900 shadow-2xl mb-4">
            <Shield className="w-10 h-10 text-brand-orange" />
          </div>
          <h1 className="text-3xl font-serif font-bold text-slate-800 mb-2">
            Comptabilité
          </h1>
          <p className="text-slate-500">
            Accès sécurisé aux données financières
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
          <div className="bg-gradient-to-r from-slate-800 to-slate-900 p-6">
            <div className="flex items-center gap-3">
              <Lock className="w-5 h-5 text-brand-orange" />
              <span className="text-white font-semibold">Authentification requise</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Code d'accès comptable
              </label>
              <div className="relative">
                <input
                  type={showCode ? 'text' : 'password'}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Entrez le code..."
                  className="w-full px-4 py-3 pr-12 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-blue focus:border-transparent outline-none transition-all"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowCode(!showCode)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showCode ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                <span className="text-sm text-red-700">{error}</span>
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-brand-blue hover:bg-teal-700 text-white font-semibold py-3 rounded-lg transition-all duration-200 flex items-center justify-center gap-2"
            >
              <Unlock className="w-5 h-5" />
              Accéder aux statistiques
            </button>

            <p className="text-xs text-slate-400 text-center">
              Session de 1 heure. Code requis à chaque connexion.
            </p>
          </form>
        </div>

        {/* Security Note */}
        <div className="mt-6 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 rounded-full">
            <Shield className="w-4 h-4 text-slate-500" />
            <span className="text-xs text-slate-500">Données chiffrées et sécurisées</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// Document Detail Modal
const DocumentDetailModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  title: string;
  documents: Document[];
  totalAmount: number;
  status: string;
}> = ({ isOpen, onClose, title, documents, totalAmount, status }) => {
  const navigate = useNavigate();

  if (!isOpen) return null;

  const getStatusColor = (docStatus: string) => {
    switch (docStatus) {
      case 'paid': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'pending': return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'signed': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'sent': return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'expired': return 'bg-red-100 text-red-700 border-red-200';
      case 'rejected': return 'bg-gray-100 text-gray-700 border-gray-200';
      case 'draft': return 'bg-slate-100 text-slate-700 border-slate-200';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  const getStatusLabel = (docStatus: string) => {
    switch (docStatus) {
      case 'paid': return 'Payé';
      case 'pending': return 'En attente';
      case 'signed': return 'Signé';
      case 'sent': return 'Envoyé';
      case 'expired': return 'Expiré';
      case 'rejected': return 'Refusé';
      case 'draft': return 'Brouillon';
      case 'converted': return 'Converti';
      default: return docStatus;
    }
  };

  const handleDocumentClick = (doc: Document) => {
    navigate(`/admin/devis/${doc.id}`);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-800 to-slate-900 p-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">{title}</h2>
            <p className="text-slate-400 text-sm mt-1">
              {documents.length} document{documents.length > 1 ? 's' : ''} • Total: {totalAmount.toFixed(2)} €
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {documents.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <FileText className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p>Aucun document pour ce statut sur la période sélectionnée</p>
            </div>
          ) : (
            <div className="space-y-3">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  onClick={() => handleDocumentClick(doc)}
                  className="bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl p-4 cursor-pointer transition-all group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                        doc.type === 'Facture' ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600'
                      }`}>
                        {doc.type === 'Facture' ? <CreditCard className="w-6 h-6" /> : <FileText className="w-6 h-6" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-800">{doc.ref}</span>
                          <span className={`px-2 py-0.5 text-xs font-medium rounded-full border ${getStatusColor(doc.status)}`}>
                            {getStatusLabel(doc.status)}
                          </span>
                        </div>
                        <p className="text-sm text-slate-600 mt-0.5">{doc.clientName}</p>
                        <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                          <span>{dayjs(doc.date).format('DD/MM/YYYY')}</span>
                          <span>•</span>
                          <span>{doc.serviceType || 'Service personnalisé'}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="font-bold text-slate-800 text-lg">{(doc.totalTTC || 0).toFixed(2)} €</p>
                        <p className="text-xs text-slate-500">TTC</p>
                      </div>
                      <div className="w-10 h-10 rounded-full bg-slate-200 group-hover:bg-brand-blue flex items-center justify-center transition-all">
                        <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-white" />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 p-4 bg-slate-50 flex justify-between items-center">
          <p className="text-sm text-slate-500">
            Cliquez sur un document pour voir les détails
          </p>
          <div className="flex items-center gap-4">
            <button
              onClick={() => exportDocumentsToPDF(documents, title, totalAmount)}
              className="flex items-center gap-2 px-4 py-2 bg-brand-blue text-white rounded-lg hover:bg-teal-700 transition-all font-medium"
            >
              <Download className="w-4 h-4" />
              Exporter PDF
            </button>
            <div className="text-right">
              <p className="text-sm text-slate-500">Montant total</p>
              <p className="text-xl font-bold text-slate-800">{totalAmount.toFixed(2)} €</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Mission Detail Modal - NO REVENUE (missions don't have prices)
const MissionDetailModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  title: string;
  missions: Mission[];
  status: string;
  documents: Document[];
  clients?: Client[];
  onUpdateMission?: (missionId: string, data: Partial<Mission>) => Promise<void>;
  onCancelMission?: (missionId: string) => Promise<void>;
  onCompleteMission?: (missionId: string) => Promise<void>;
  currentUser?: { role: string } | null;
}> = ({ isOpen, onClose, title, missions, status, documents, clients = [], onUpdateMission, onCancelMission, onCompleteMission, currentUser }) => {
  const navigate = useNavigate();
  const [selectedMission, setSelectedMission] = useState<Mission | null>(null);
  const [multiplier, setMultiplier] = useState<number>(1);
  const [isProcessing, setIsProcessing] = useState(false);

  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super_admin';

  if (!isOpen) return null;

  const getStatusColor = (missionStatus: string) => {
    switch (missionStatus) {
      case 'completed': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'in_progress': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'planned': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'cancelled': return 'bg-red-100 text-red-700 border-red-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getStatusLabel = (missionStatus: string) => {
    switch (missionStatus) {
      case 'completed': return 'Terminée';
      case 'in_progress': return 'En cours';
      case 'planned': return 'Planifiée';
      case 'cancelled': return 'Annulée';
      default: return missionStatus;
    }
  };

  const getLinkedDocument = (mission: Mission) => {
    return documents.find(d => d.id === mission.sourceDocumentId);
  };

  const getClientCity = (mission: Mission) => {
    const client = clients.find(c => c.id === mission.clientId);
    return client?.city || client?.address || 'Non spécifiée';
  };

  const handleMissionClick = (mission: Mission) => {
    setSelectedMission(mission);
    setMultiplier(1);
  };

  const handleValidateMission = async () => {
    if (!selectedMission || !onCompleteMission) return;
    setIsProcessing(true);
    try {
      await onCompleteMission(selectedMission.id);
      setSelectedMission(null);
    } catch (err) {
      console.error('Error completing mission:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancelMission = async () => {
    if (!selectedMission || !onCancelMission) return;
    if (!window.confirm('Êtes-vous sûr de vouloir annuler cette mission ?')) return;
    setIsProcessing(true);
    try {
      await onCancelMission(selectedMission.id);
      setSelectedMission(null);
    } catch (err) {
      console.error('Error cancelling mission:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExtendDuration = async () => {
    if (!selectedMission || !onUpdateMission || multiplier <= 1) return;
    setIsProcessing(true);
    try {
      const newDuration = selectedMission.duration * multiplier;
      await onUpdateMission(selectedMission.id, { 
        duration: newDuration,
        endTime: calculateNewEndTime(selectedMission.startTime, newDuration)
      });
      setSelectedMission(null);
    } catch (err) {
      console.error('Error extending mission:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const calculateNewEndTime = (startTime: string, duration: number) => {
    const [hours, minutes] = startTime.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes + duration * 60;
    const newHours = Math.floor(totalMinutes / 60);
    const newMinutes = totalMinutes % 60;
    return `${String(newHours).padStart(2, '0')}:${String(newMinutes).padStart(2, '0')}`;
  };

  const calculateNewPrice = (mission: Mission) => {
    const linkedDoc = getLinkedDocument(mission);
    if (!linkedDoc) return 0;
    return linkedDoc.totalTTC * multiplier;
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-600 to-amber-700 p-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">{title}</h2>
            <p className="text-amber-100 text-sm mt-1">
              {missions.length} mission{missions.length > 1 ? 's' : ''} • Les missions n'ont pas de prix, seuls les devis ont des prix
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {missions.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <Briefcase className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p>Aucune mission pour ce statut sur la période sélectionnée</p>
            </div>
          ) : (
            <div className="space-y-3">
              {missions.map((mission) => {
                const linkedDoc = getLinkedDocument(mission);
                const isSelected = selectedMission?.id === mission.id;
                return (
                  <div
                    key={mission.id}
                    className={`border rounded-xl p-4 cursor-pointer transition-all ${
                      isSelected 
                        ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-200' 
                        : 'bg-slate-50 hover:bg-slate-100 border-slate-200'
                    }`}
                  >
                    <div onClick={() => handleMissionClick(mission)}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                            mission.status === 'completed' ? 'bg-emerald-100 text-emerald-600' : 
                            mission.status === 'in_progress' ? 'bg-blue-100 text-blue-600' :
                            mission.status === 'cancelled' ? 'bg-red-100 text-red-600' :
                            'bg-amber-100 text-amber-600'
                          }`}>
                            <Briefcase className="w-6 h-6" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-800">{mission.service}</span>
                              <span className={`px-2 py-0.5 text-xs font-medium rounded-full border ${getStatusColor(mission.status)}`}>
                                {getStatusLabel(mission.status)}
                              </span>
                            </div>
                            <p className="text-sm text-slate-600 mt-0.5">{mission.clientName}</p>
                            <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                              <span>{dayjs(mission.date).format('DD/MM/YYYY')}</span>
                              <span>•</span>
                              <span>{mission.startTime} - {mission.endTime}</span>
                              <span>•</span>
                              <span>{mission.duration}h</span>
                            </div>
                            <div className="flex items-center gap-2 mt-1 text-xs">
                              <MapPin className="w-3 h-3 text-slate-400" />
                              <span className="text-slate-500">Commune: {getClientCity(mission)}</span>
                            </div>
                            {linkedDoc && (
                              <div className="mt-2 flex items-center gap-2">
                                <FileText className="w-3 h-3 text-slate-400" />
                                <span className="text-xs text-slate-500">{linkedDoc.ref} • {(linkedDoc.totalTTC || 0).toFixed(2)} €</span>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          {/* NO PRICE DISPLAY FOR MISSIONS - Only quote info shown below */}
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                            isSelected ? 'bg-amber-600 text-white' : 'bg-slate-200 text-slate-500'
                          }`}>
                            <ChevronRight className="w-5 h-5" />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Admin Actions for Selected Mission */}
                    {isSelected && isAdmin && (
                      <div className="mt-4 pt-4 border-t border-amber-200">
                        <div className="text-sm font-bold text-slate-700 mb-3">Actions administrateur :</div>

                        {/* Duration Modifier - NO PRICE CHANGE, missions don't have prices */}
                        <div className="bg-white rounded-lg p-3 mb-3 border border-slate-200">
                          <div className="text-xs font-medium text-slate-600 mb-2">Modifier la durée de la mission :</div>
                          <div className="flex items-center gap-3 mb-2">
                            <span className="text-sm">Multiplier par :</span>
                            <select
                              value={multiplier}
                              onChange={(e) => setMultiplier(Number(e.target.value))}
                              className="border border-slate-200 rounded-lg px-3 py-1 text-sm"
                            >
                              <option value={1}>×1 (original)</option>
                              <option value={2}>×2</option>
                              <option value={3}>×3</option>
                              <option value={4}>×4</option>
                            </select>
                          </div>
                          {multiplier > 1 && (
                            <div className="text-xs text-slate-600 mb-2">
                              Durée : {mission.duration}h → {mission.duration * multiplier}h
                              <span className="text-slate-400 ml-2">(Les missions n&apos;ont pas de prix, seuls les devis ont des prix)</span>
                            </div>
                          )}
                          <button
                            onClick={handleExtendDuration}
                            disabled={isProcessing || multiplier <= 1}
                            className="w-full py-2 bg-brand-blue text-white rounded-lg font-medium text-sm hover:bg-teal-700 disabled:opacity-50"
                          >
                            {isProcessing ? 'Traitement...' : 'Appliquer la modification'}
                          </button>
                        </div>

                        {/* Validate / Cancel Buttons */}
                        <div className="flex gap-2">
                          {mission.status !== 'completed' && (
                            <button
                              onClick={handleValidateMission}
                              disabled={isProcessing}
                              className="flex-1 py-2 bg-emerald-600 text-white rounded-lg font-medium text-sm hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                              <CheckCircle className="w-4 h-4" />
                              Valider la mission
                            </button>
                          )}
                          {mission.status !== 'cancelled' && (
                            <button
                              onClick={handleCancelMission}
                              disabled={isProcessing}
                              className="flex-1 py-2 bg-red-600 text-white rounded-lg font-medium text-sm hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                              <XCircle className="w-4 h-4" />
                              Annuler la mission
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 p-4 bg-slate-50 flex justify-between items-center">
          <p className="text-sm text-slate-500">
            {isAdmin ? 'Cliquez sur une mission pour voir les actions admin' : 'Cliquez sur une mission pour voir les détails'}
          </p>
          <div className="text-right">
            <p className="text-sm text-slate-500">Total missions</p>
            <p className="text-xl font-bold text-slate-800">{missions.length}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

// Clickable Stat Card Component
interface StatCardProps {
  title: string;
  subtitle?: string;
  value: string;
  subtext?: string;
  icon: any;
  color: 'blue' | 'green' | 'orange' | 'red' | 'purple' | 'slate' | 'emerald' | 'amber';
  onClick?: () => void;
  clickable?: boolean;
}
const StatCard: React.FC<StatCardProps> = ({ title, value, subtext, icon: Icon, color, onClick, clickable = false }) => {
  const colorClasses = {
    blue: 'from-blue-500 to-blue-600',
    green: 'from-emerald-500 to-emerald-600',
    orange: 'from-orange-500 to-orange-600',
    red: 'from-red-500 to-red-600',
    purple: 'from-violet-500 to-violet-600',
    slate: 'from-slate-700 to-slate-800',
    emerald: 'from-emerald-600 to-emerald-700',
    amber: 'from-amber-500 to-amber-600',
  };

  const bgClasses = {
    blue: 'bg-blue-50 border-blue-200 hover:border-blue-300',
    green: 'bg-emerald-50 border-emerald-200 hover:border-emerald-300',
    orange: 'bg-orange-50 border-orange-200 hover:border-orange-300',
    red: 'bg-red-50 border-red-200 hover:border-red-300',
    purple: 'bg-violet-50 border-violet-200 hover:border-violet-300',
    slate: 'bg-slate-50 border-slate-200 hover:border-slate-300',
    emerald: 'bg-emerald-50 border-emerald-200 hover:border-emerald-300',
    amber: 'bg-amber-50 border-amber-200 hover:border-amber-300',
  };

  return (
    <div
      onClick={onClick}
      className={`${bgClasses[color]} rounded-xl border p-6 transition-all ${
        clickable ? 'cursor-pointer hover:shadow-lg transform hover:scale-[1.02]' : 'hover:shadow-md'
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-slate-600 mb-1">{title}</p>
          <h3 className="text-2xl font-bold text-slate-800">{value}</h3>
          {subtext && <p className="text-xs text-slate-500 mt-1">{subtext}</p>}
        </div>
        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${colorClasses[color]} flex items-center justify-center shadow-lg flex-shrink-0`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
      {clickable && (
        <div className="mt-3 pt-3 border-t border-current border-opacity-20">
          <div className="flex items-center gap-1 text-xs font-medium text-slate-500">
            <span>Cliquez pour voir le détail</span>
            <ExternalLink className="w-3 h-3" />
          </div>
        </div>
      )}
    </div>
  );
};

// Main Component
const AccountingStatistics: React.FC = () => {
  const { isAuthenticated, authenticate, logout, error, sessionTimeLeft } = useAccountingAuth();
  const { documents, missions, dataLoading, clients, updateMission, cancelMissionByClient, completeMission, currentUser, getAllPackBillingStats, getSplitInvoicesForQuote } = useData();
  const navigate = useNavigate();
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('month');

  // Modal state for documents
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalDocuments, setModalDocuments] = useState<Document[]>([]);
  const [modalAmount, setModalAmount] = useState(0);
  const [modalStatus, setModalStatus] = useState('');

  // Modal state for missions - NO REVENUE
  const [missionModalOpen, setMissionModalOpen] = useState(false);
  const [missionModalTitle, setMissionModalTitle] = useState('');
  const [missionModalMissions, setMissionModalMissions] = useState<Mission[]>([]);
  const [missionModalStatus, setMissionModalStatus] = useState('');

  // Pack billing statistics
  const packBillingStats = useMemo(() => getAllPackBillingStats(), [documents, missions]);

  // Filter documents by time
  const filteredDocuments = useMemo(() => {
    const now = dayjs().tz(MARTINIQUE_TIMEZONE);

    return documents.filter((doc: Document) => {
      if (!doc.date) return false;
      const docDate = dayjs.tz(doc.date, MARTINIQUE_TIMEZONE);

      switch (timeFilter) {
        case 'day':
          return docDate.isSame(now, 'day');
        case 'week':
          {
          // Monday-based week (European format)
          const dayOfWeek = now.day() === 0 ? 6 : now.day() - 1;
          const weekStart = now.subtract(dayOfWeek, 'day').startOf('day');
          const weekEnd = weekStart.add(6, 'day').endOf('day');
          return docDate.valueOf() >= weekStart.valueOf() && docDate.valueOf() <= weekEnd.valueOf();
          }
        case 'month':
          return docDate.isSame(now, 'month');
        case 'year':
          return docDate.isSame(now, 'year');
        case 'all':
        default:
          return true;
      }
    });
  }, [documents, timeFilter]);

  // Filter missions by time (for mission counts)
  const filteredMissions = useMemo(() => {
    const now = dayjs().tz(MARTINIQUE_TIMEZONE);

    return missions.filter((mission: Mission) => {
      if (!mission.date) return false;
      const missionDate = dayjs.tz(mission.date, MARTINIQUE_TIMEZONE);

      switch (timeFilter) {
        case 'day':
          return missionDate.isSame(now, 'day');
        case 'week':
          {
          const dayOfWeek = now.day() === 0 ? 6 : now.day() - 1;
          const weekStart = now.subtract(dayOfWeek, 'day').startOf('day');
          const weekEnd = weekStart.add(6, 'day').endOf('day');
          return missionDate.valueOf() >= weekStart.valueOf() && missionDate.valueOf() <= weekEnd.valueOf();
          }
        case 'month':
          return missionDate.isSame(now, 'month');
        case 'year':
          return missionDate.isSame(now, 'year');
        case 'all':
        default:
          return true;
      }
    });
  }, [missions, timeFilter]);

  // Expert Accounting Statistics
  const stats = useMemo(() => {
    const docs = filteredDocuments;

    // ==== DEVIS (QUOTES) ANALYSIS ====
    const quotes = docs.filter(d => d.type === 'Devis');

    // Devis par statut avec montants - avec gestion des valeurs null/undefined
    const quotesByStatus = {
      draft: {           // Brouillon - créé mais pas envoyé
        count: quotes.filter(d => d.status === 'draft').length,
        amount: quotes.filter(d => d.status === 'draft').reduce((sum, d) => sum + (d.totalTTC || 0), 0),
        documents: quotes.filter(d => d.status === 'draft')
      },
      sent: {            // Envoyé - en attente de réponse client
        count: quotes.filter(d => d.status === 'sent').length,
        amount: quotes.filter(d => d.status === 'sent').reduce((sum, d) => sum + (d.totalTTC || 0), 0),
        documents: quotes.filter(d => d.status === 'sent')
      },
      signed: {          // Signé - validé, missions en cours
        count: quotes.filter(d => d.status === 'signed').length,
        amount: quotes.filter(d => d.status === 'signed').reduce((sum, d) => sum + (d.totalTTC || 0), 0),
        documents: quotes.filter(d => d.status === 'signed')
      },
      converted: {       // Converti en facture
        count: quotes.filter(d => d.status === 'converted').length,
        amount: quotes.filter(d => d.status === 'converted').reduce((sum, d) => sum + (d.totalTTC || 0), 0),
        documents: quotes.filter(d => d.status === 'converted')
      },
      expired: {         // Expiré
        count: quotes.filter(d => d.status === 'expired').length,
        amount: quotes.filter(d => d.status === 'expired').reduce((sum, d) => sum + (d.totalTTC || 0), 0),
        documents: quotes.filter(d => d.status === 'expired')
      },
      rejected: {        // Refusé
        count: quotes.filter(d => d.status === 'rejected').length,
        amount: quotes.filter(d => d.status === 'rejected').reduce((sum, d) => sum + (d.totalTTC || 0), 0),
        documents: quotes.filter(d => d.status === 'rejected')
      }
    };

    // ==== FACTURES (INVOICES) ANALYSIS ====
    const invoices = docs.filter(d => d.type === 'Facture');

    // Factures par statut avec montants - avec gestion des valeurs null/undefined
    const invoicesByStatus = {
      draft: {           // Brouillon
        count: invoices.filter(d => d.status === 'draft').length,
        amount: invoices.filter(d => d.status === 'draft').reduce((sum, d) => sum + (d.totalTTC || 0), 0),
        documents: invoices.filter(d => d.status === 'draft')
      },
      sent: {            // Envoyée
        count: invoices.filter(d => d.status === 'sent').length,
        amount: invoices.filter(d => d.status === 'sent').reduce((sum, d) => sum + (d.totalTTC || 0), 0),
        documents: invoices.filter(d => d.status === 'sent')
      },
      pending: {         // En attente de paiement
        count: invoices.filter(d => d.status === 'pending').length,
        amount: invoices.filter(d => d.status === 'pending').reduce((sum, d) => sum + (d.totalTTC || 0), 0),
        documents: invoices.filter(d => d.status === 'pending')
      },
      paid: {            // Payée
        count: invoices.filter(d => d.status === 'paid').length,
        amount: invoices.filter(d => d.status === 'paid').reduce((sum, d) => sum + (d.totalTTC || 0), 0),
        documents: invoices.filter(d => d.status === 'paid')
      }
    };

    // ==== CALCULS COMPTABLES EXPERTS (Basés UNIQUEMENT sur les Devis) ====

    // 1. ENCAISSEMENTS (Cash-in) - Devis convertis en facture payée
    const encaisse = quotesByStatus.converted.amount;

    // 2. À ENCAISSER (Accounts Receivable) - Devis signés en attente de paiement
    const aEncaisser = quotesByStatus.signed.amount;

    // 3. EN COURS (Work in Progress) - Devis signés en cours d'exécution
    const enCours = quotesByStatus.signed.amount;

    // 4. EN NÉGOCIATION (Pipeline) - Devis envoyés mais pas encore signés
    const enNegociation = quotesByStatus.sent.amount;

    // 5. POTENTIEL TOTAL - Tous les devis (hors refusés uniquement)
    const potentielTotal = quotesByStatus.converted.amount + 
                          quotesByStatus.signed.amount + 
                          quotesByStatus.sent.amount + 
                          quotesByStatus.draft.amount + 
                          quotesByStatus.expired.amount;

    // ==== MISSIONS ANALYSIS - COUNT ONLY (NO PRICE) ====
    const missionsEnCoursList = filteredMissions.filter(m =>
      m.status === 'in_progress' || m.status === 'planned'
    );
    const missionsEnCours = missionsEnCoursList.length;
    // NO REVENUE CALCULATION - Missions don't have prices, only quotes do

    const missionsTermineesList = filteredMissions.filter(m =>
      m.status === 'completed'
    );
    const missionsTerminees = missionsTermineesList.length;
    // NO REVENUE CALCULATION

    const missionsAnnuleesList = filteredMissions.filter(m =>
      m.status === 'cancelled'
    );
    const missionsAnnulees = missionsAnnuleesList.length;
    // NO REVENUE CALCULATION

    // ==== MÉTRIQUES DE PERFORMANCE (Basées uniquement sur les Devis) ====

    // Taux de conversion : devis signés / (devis envoyés + devis signés)
    const tauxConversion = quotesByStatus.sent.count + quotesByStatus.signed.count > 0
      ? (quotesByStatus.signed.count / (quotesByStatus.sent.count + quotesByStatus.signed.count)) * 100
      : 0;

    // Panier moyen (devis) - tous les devis
    const totalQuotesAmount = quotes.reduce((sum, d) => sum + (d.totalTTC || 0), 0);
    const panierMoyenDevis = quotes.length > 0 ? totalQuotesAmount / quotes.length : 0;

    // ==== REVENUE BY SERVICE TYPE (QUOTES ONLY - EXCLUDING REJECTED) ====
    // Calculate total revenue (TTC) by service type from QUOTES ONLY (excluding rejected)
    const revenueByService: Record<string, { amount: number; count: number; documents: Document[] }> = {};

    // Only include non-rejected quotes in revenue calculations
    const activeQuotes = quotes.filter(q => q.status !== 'rejected');
    
    activeQuotes.forEach(doc => {
      const serviceType = doc.serviceType || 'Autre';
      if (!revenueByService[serviceType]) {
        revenueByService[serviceType] = { amount: 0, count: 0, documents: [] };
      }
      revenueByService[serviceType].amount += doc.totalTTC || 0;
      revenueByService[serviceType].count += 1;
      revenueByService[serviceType].documents.push(doc);
    });

    // Sort by amount descending
    const sortedRevenueByService = Object.entries(revenueByService)
      .sort(([,a], [,b]) => b.amount - a.amount)
      .reduce((acc, [key, value]) => {
        acc[key] = value;
        return acc;
      }, {} as Record<string, { amount: number; count: number; documents: Document[] }>);

    return {
      // Devis
      quotesByStatus,
      totalQuotes: quotes.length,

      // Factures
      invoicesByStatus,
      totalInvoices: invoices.length,

      // Financiers (basés sur les devis uniquement)
      encaisse,
      aEncaisser,
      enCours,
      enNegociation,
      potentielTotal,

      // Missions - COUNT ONLY, NO REVENUE
      missionsEnCours,
      missionsEnCoursList,
      missionsTerminees,
      missionsTermineesList,
      missionsAnnulees,
      missionsAnnuleesList,

      // Métriques (basées uniquement sur les devis)
      tauxConversion,
      panierMoyenDevis,

      // Revenue by service (from quotes)
      revenueByService: sortedRevenueByService,
    };
  }, [filteredDocuments, filteredMissions]);

  // Open modal helper for documents
  const openDocumentModal = (title: string, documents: Document[], amount: number, status: string) => {
    setModalTitle(title);
    setModalDocuments(documents);
    setModalAmount(amount);
    setModalStatus(status);
    setModalOpen(true);
  };

  // Open modal helper for missions - NO REVENUE
  const openMissionModal = (title: string, missions: Mission[], status: string) => {
    setMissionModalTitle(title);
    setMissionModalMissions(missions);
    setMissionModalStatus(status);
    setMissionModalOpen(true);
  };

  // Previous period comparison (mock calculation)
  const previousPeriodComparison = useMemo(() => {
    return {
      revenue: { value: 12.5, positive: true },
      pending: { value: 8.3, positive: false },
      conversion: { value: 5.2, positive: true },
    };
  }, []);

  if (!isAuthenticated) {
    return <AccountingLogin onLogin={authenticate} error={error} />;
  }

  if (dataLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-brand-blue border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-500">Chargement des données comptables...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 h-full overflow-y-auto bg-gradient-to-br from-slate-50 to-white">
      {/* Document Detail Modal */}
      <DocumentDetailModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={modalTitle}
        documents={modalDocuments}
        totalAmount={modalAmount}
        status={modalStatus}
      />

      {/* Mission Detail Modal */}
      <MissionDetailModal
        isOpen={missionModalOpen}
        onClose={() => setMissionModalOpen(false)}
        title={missionModalTitle}
        missions={missionModalMissions}
        status={missionModalStatus}
        documents={filteredDocuments}
        clients={clients}
        onUpdateMission={updateMission}
        onCancelMission={cancelMissionByClient}
        onCompleteMission={completeMission}
        currentUser={currentUser}
      />

      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-brand-orange" />
            </div>
            <h1 className="text-3xl font-serif font-bold text-slate-800">Comptabilité</h1>
            <span className="px-3 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full">
              LIVE
            </span>
          </div>
          <p className="text-slate-500">Analyse financière experte et suivi des encaissements</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Session Timer */}
          {sessionTimeLeft && (
            <div className="flex items-center gap-2 px-4 py-2 bg-slate-100 rounded-lg">
              <Clock className="w-4 h-4 text-slate-500" />
              <span className="text-sm font-medium text-slate-600">
                Session: {formatTimeLeft(sessionTimeLeft)}
              </span>
            </div>
          )}

          {/* Time Filter */}
          <div className="flex items-center bg-white rounded-lg shadow-sm border border-slate-200 p-1">
            <Filter className="w-4 h-4 text-slate-400 ml-2 mr-2" />
            <select
              value={timeFilter}
              onChange={(e) => setTimeFilter(e.target.value as TimeFilter)}
              className="bg-transparent text-sm font-semibold text-slate-700 p-2 outline-none cursor-pointer"
            >
              <option value="day">Aujourd'hui</option>
              <option value="week">Cette semaine</option>
              <option value="month">Ce mois</option>
              <option value="year">Cette année</option>
              <option value="all">Tout l'historique</option>
            </select>
          </div>

          {/* Logout */}
          <button
            onClick={logout}
            className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-all font-medium"
          >
            <LogOut className="w-4 h-4" />
            Déconnexion
          </button>
        </div>
      </div>

      {/* ==== SECTION: ENCAISSEMENTS (Cash Position) ==== */}
      <div className="mb-8">
        <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
          <Wallet className="w-5 h-5 text-emerald-600" />
          Position de Trésorerie
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="ENCAISSÉ"
            subtitle="Devis convertis en factures payées"
            value={`${(stats.encaisse || 0).toFixed(2)} €`}
            subtext={`${stats.quotesByStatus.converted.count} devis converti(s)`}
            icon={CheckCircle}
            color="emerald"
            clickable={stats.quotesByStatus.converted.count > 0}
            onClick={() => openDocumentModal(
              'Devis Convertis - Payés',
              stats.quotesByStatus.converted.documents,
              stats.encaisse,
              'converted'
            )}
          />
          <StatCard
            title="À ENCAISSER"
            subtitle="Devis signés en attente"
            value={`${(stats.aEncaisser || 0).toFixed(2)} €`}
            subtext={`${stats.quotesByStatus.signed.count} devis signé(s)`}
            icon={Clock}
            color="orange"
            clickable={stats.aEncaisser > 0}
            onClick={() => openDocumentModal(
              'Devis Signés - À Encaisser',
              stats.quotesByStatus.signed.documents,
              stats.aEncaisser,
              'signed'
            )}
          />
          <StatCard
            title="EN COURS"
            subtitle="Devis signés - missions en cours"
            value={`${(stats.enCours || 0).toFixed(2)} €`}
            subtext={`${stats.quotesByStatus.signed.count} devis signé(s)`}
            icon={FileText}
            color="blue"
            clickable={stats.quotesByStatus.signed.count > 0}
            onClick={() => openDocumentModal(
              'Devis Signés - En Cours',
              stats.quotesByStatus.signed.documents,
              stats.enCours,
              'signed'
            )}
          />
          <StatCard
            title="POTENTIEL TOTAL"
            subtitle="Tous les devis (hors refusés)"
            value={`${(stats.potentielTotal || 0).toFixed(2)} €`}
            subtext={`${stats.totalQuotes - stats.quotesByStatus.rejected.count} devis non-refusé(s)`}
            icon={TrendingUp}
            color="purple"
            clickable={false}
          />
        </div>
      </div>

      {/* ==== SECTION: PIPELINE DE VENTE (Sales Pipeline) ==== */}
      <div className="mb-8">
        <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-blue-600" />
          Pipeline de Vente
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="EN NÉGOCIATION"
            subtitle="Devis envoyés non signés"
            value={`${(stats.enNegociation || 0).toFixed(2)} €`}
            subtext={`${stats.quotesByStatus.sent.count} devis envoyé(s)`}
            icon={Send}
            color="purple"
            clickable={stats.quotesByStatus.sent.count > 0}
            onClick={() => openDocumentModal(
              'Devis Envoyés - En Négociation',
              stats.quotesByStatus.sent.documents,
              stats.enNegociation,
              'sent'
            )}
          />
          <StatCard
            title="BROUILLONS"
            subtitle="Devis en préparation"
            value={`${(stats.quotesByStatus.draft.amount || 0).toFixed(2)} €`}
            subtext={`${stats.quotesByStatus.draft.count} brouillon(s)`}
            icon={FileText}
            color="slate"
            clickable={stats.quotesByStatus.draft.count > 0}
            onClick={() => openDocumentModal(
              'Brouillons de Devis',
              stats.quotesByStatus.draft.documents,
              stats.quotesByStatus.draft.amount,
              'draft'
            )}
          />
          <StatCard
            title="EXPIRÉS"
            subtitle="Devis non convertis"
            value={`${(stats.quotesByStatus.expired.amount || 0).toFixed(2)} €`}
            subtext={`${stats.quotesByStatus.expired.count} devis expiré(s)`}
            icon={XCircle}
            color="red"
            clickable={stats.quotesByStatus.expired.count > 0}
            onClick={() => openDocumentModal(
              'Devis Expirés',
              stats.quotesByStatus.expired.documents,
              stats.quotesByStatus.expired.amount,
              'expired'
            )}
          />
          <StatCard
            title="REFUSÉS"
            subtitle="Devis rejetés"
            value={`${(stats.quotesByStatus.rejected.amount || 0).toFixed(2)} €`}
            subtext={`${stats.quotesByStatus.rejected.count} devis refusé(s)`}
            icon={Ban}
            color="red"
            clickable={stats.quotesByStatus.rejected.count > 0}
            onClick={() => openDocumentModal(
              'Devis Refusés',
              stats.quotesByStatus.rejected.documents,
              stats.quotesByStatus.rejected.amount,
              'rejected'
            )}
          />
        </div>
      </div>

      {/* ==== SECTION: MISSIONS (Operations) ==== */}
      <div className="mb-8">
        <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
          <User className="w-5 h-5 text-amber-600" />
          Suivi des Missions
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard
            title="MISSIONS EN COURS"
            subtitle="Planifiées ou démarrées"
            value={stats.missionsEnCours.toString()}
            subtext={`${stats.missionsEnCours} mission(s) active(s)`}
            icon={Clock}
            color="amber"
            clickable={stats.missionsEnCours > 0}
            onClick={() => openMissionModal(
              'Missions en Cours',
              stats.missionsEnCoursList,
              'in_progress'
            )}
          />
          <StatCard
            title="MISSIONS TERMINÉES"
            subtitle="Réalisées avec succès"
            value={stats.missionsTerminees.toString()}
            subtext={`${stats.missionsTerminees} mission(s) complétée(s)`}
            icon={CheckCircle}
            color="green"
            clickable={stats.missionsTerminees > 0}
            onClick={() => openMissionModal(
              'Missions Terminées',
              stats.missionsTermineesList,
              'completed'
            )}
          />
          <StatCard
            title="MISSIONS ANNULÉES"
            subtitle="Annulations sur la période"
            value={stats.missionsAnnulees.toString()}
            subtext={`${stats.missionsAnnulees} mission(s) annulée(s)`}
            icon={XCircle}
            color="red"
            clickable={stats.missionsAnnulees > 0}
            onClick={() => openMissionModal(
              'Missions Annulées',
              stats.missionsAnnuleesList,
              'cancelled'
            )}
          />
        </div>
      </div>

      {/* ==== SECTION: MÉTRIQUES DE PERFORMANCE ==== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Performance Metrics */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <h4 className="font-semibold text-slate-700 mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-slate-400" />
            Indicateurs de Performance
          </h4>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-slate-600">Taux de Conversion</span>
                <span className="font-bold text-slate-800">{(stats.tauxConversion || 0).toFixed(1)}%</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div
                  className="bg-brand-blue h-2 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(stats.tauxConversion, 100)}%` }}
                />
              </div>
              <p className="text-xs text-slate-500 mt-1">Devis signés / Devis envoyés</p>
            </div>

            <div className="pt-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-600">Panier moyen (Devis)</span>
                <span className="font-bold text-slate-800">{(stats.panierMoyenDevis || 0).toFixed(2)} €</span>
              </div>
            </div>
          </div>
        </div>

        {/* Document Summary - FOCUSED ON QUOTES ONLY */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <h4 className="font-semibold text-slate-700 mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5 text-slate-400" />
            Récapitulatif Devis
          </h4>
          <div className="space-y-3">
            <div className="flex justify-between items-center p-3 bg-emerald-50 rounded-lg">
              <span className="text-sm text-slate-700">Total Devis</span>
              <div className="text-right">
                <span className="font-bold text-emerald-700">{stats.totalQuotes}</span>
              </div>
            </div>
            <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
              <span className="text-sm text-slate-700">Devis Signés (En Cours)</span>
              <div className="text-right">
                <span className="font-bold text-blue-700">{stats.quotesByStatus.signed.count}</span>
              </div>
            </div>
            <div className="flex justify-between items-center p-3 bg-purple-50 rounded-lg">
              <span className="text-sm text-slate-700">Devis Actifs</span>
              <span className="font-bold text-purple-700">
                {stats.quotesByStatus.signed.count + stats.quotesByStatus.sent.count + stats.quotesByStatus.converted.count}
              </span>
            </div>
          </div>
        </div>

        {/* Revenue by Service Type - QUOTES ONLY */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <h4 className="font-semibold text-slate-700 mb-4 flex items-center gap-2">
            <PieChart className="w-5 h-5 text-slate-400" />
            CA par Service (Devis)
          </h4>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {Object.entries(stats.revenueByService).length > 0 ? (
              Object.entries(stats.revenueByService).map(([service, data], idx) => (
                <div 
                  key={idx} 
                  className="flex justify-between items-center py-2 border-b border-slate-50 last:border-0 cursor-pointer hover:bg-slate-50 rounded px-2 -mx-2"
                  onClick={() => openDocumentModal(
                    `Documents - ${service}`,
                    data.documents,
                    data.amount,
                    'service'
                  )}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-brand-blue"></div>
                    <div>
                      <span className="text-sm text-slate-700 font-medium">{service}</span>
                      <span className="text-xs text-slate-400 ml-2">({data.count} doc{data.count > 1 ? 's' : ''})</span>
                    </div>
                  </div>
                  <span className="font-bold text-slate-800">{(data.amount || 0).toFixed(2)} €</span>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-400 text-center py-4">Aucune donnée disponible</p>
            )}
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-slate-600">Total CA par service</span>
              <span className="font-bold text-brand-blue">
                {Object.values(stats.revenueByService).reduce((sum, s) => sum + (s.amount || 0), 0).toFixed(2)} €
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ==== SECTION: FACTURATION PAR PACK (Prestations non facturées) ==== */}
      {packBillingStats.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Package className="w-5 h-5 text-purple-600" />
            Facturation par Pack - Prestations non facturées
          </h2>
          
          {/* Statistiques globales des packs */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-5 text-white shadow-lg">
              <div className="flex items-center justify-between mb-2">
                <Package className="w-8 h-8 opacity-80" />
                <span className="text-2xl font-bold">{packBillingStats.length}</span>
              </div>
              <p className="text-sm opacity-90">Packs actifs</p>
            </div>
            <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-5 text-white shadow-lg">
              <div className="flex items-center justify-between mb-2">
                <CheckCircle className="w-8 h-8 opacity-80" />
                <span className="text-2xl font-bold">
                  {packBillingStats.reduce((sum, s) => sum + s.invoicedSessions, 0)}
                </span>
              </div>
              <p className="text-sm opacity-90">Sessions facturées</p>
            </div>
            <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl p-5 text-white shadow-lg">
              <div className="flex items-center justify-between mb-2">
                <Clock className="w-8 h-8 opacity-80" />
                <span className="text-2xl font-bold">
                  {packBillingStats.reduce((sum, s) => sum + s.remainingSessions, 0)}
                </span>
              </div>
              <p className="text-sm opacity-90">Sessions restantes</p>
            </div>
            <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-xl p-5 text-white shadow-lg">
              <div className="flex items-center justify-between mb-2">
                <DollarSign className="w-8 h-8 opacity-80" />
                <span className="text-2xl font-bold">
                  {packBillingStats.reduce((sum, s) => sum + s.remainingAmount, 0).toFixed(0)} €
                </span>
              </div>
              <p className="text-sm opacity-90">Restant à facturer</p>
            </div>
          </div>

          {/* Tableau détaillé par pack */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-bold text-slate-600 uppercase">Devis / Client</th>
                    <th className="text-center px-4 py-3 text-xs font-bold text-slate-600 uppercase">Sessions</th>
                    <th className="text-center px-4 py-3 text-xs font-bold text-slate-600 uppercase">Progression</th>
                    <th className="text-right px-4 py-3 text-xs font-bold text-slate-600 uppercase">Montants</th>
                    <th className="text-center px-4 py-3 text-xs font-bold text-slate-600 uppercase">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {packBillingStats.map((stats) => (
                    <tr 
                      key={stats.quoteId} 
                      className="hover:bg-slate-50 cursor-pointer transition-colors"
                      onClick={() => navigate(`/admin/devis/${stats.quoteId}`)}
                    >
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-800">{stats.quoteRef}</div>
                        <div className="text-sm text-slate-500">{stats.clientName}</div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="text-sm font-semibold text-slate-700">
                          {stats.invoicedSessions} / {stats.totalSessions}
                        </div>
                        <div className="text-xs text-slate-500">{stats.completedMissions} missions réalisées</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-slate-100 rounded-full h-2">
                            <div 
                              className={`h-2 rounded-full transition-all ${
                                stats.billingStatus === 'completed' ? 'bg-emerald-500' :
                                stats.billingStatus === 'in_progress' ? 'bg-brand-blue' :
                                'bg-slate-300'
                              }`}
                              style={{ width: `${stats.billingProgress}%` }}
                            />
                          </div>
                          <span className="text-xs font-bold text-slate-600 w-10 text-right">
                            {stats.billingProgress.toFixed(0)}%
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="text-sm font-semibold text-slate-700">
                          {stats.invoicedAmount.toFixed(2)} €
                        </div>
                        <div className="text-xs text-amber-600 font-medium">
                          Reste: {stats.remainingAmount.toFixed(2)} €
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-1 text-xs font-bold rounded-full ${
                          stats.billingStatus === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                          stats.billingStatus === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                          'bg-slate-100 text-slate-600'
                        }`}>
                          {stats.billingStatus === 'completed' ? 'Terminé' :
                           stats.billingStatus === 'in_progress' ? 'En cours' : 'Non démarré'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Footer Note */}
      <div className="mt-8 flex items-center justify-center gap-2 text-sm text-slate-400">
        <Shield className="w-4 h-4" />
        <span>Données sécurisées - Accès réservé aux comptables autorisés</span>
      </div>
    </div>
  );
};

export default AccountingStatistics;
