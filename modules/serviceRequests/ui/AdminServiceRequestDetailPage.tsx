import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { 
  Loader2, 
  ArrowLeft, 
  User, 
  Calendar, 
  Clock, 
  Package, 
  FileText,
  CheckCircle,
  XCircle,
  Euro,
  MapPin,
  Phone,
  Mail,
  AlertCircle,
  Printer,
  Download
} from 'lucide-react';
import { useData } from '../../../context/DataContext';
import { supabase } from '../../../utils/supabaseClient';
import { sendEmailViaEmailJS } from '../../../utils/emailService';
import type { CustomerServiceRequest } from '../types';
import { 
  getCustomerServiceRequestById, 
  validateCustomerServiceRequest,
  rejectCustomerServiceRequest,
  markRequestAsSeen
} from '../client';
import dayjs from 'dayjs';

const AdminServiceRequestDetailPage: React.FC = () => {
  const { requestId } = useParams<{ requestId: string }>();
  const navigate = useNavigate();
  const { 
    clients, 
    packs, 
    addDocument, 
    updateDocumentStatus,
    addMission,
    addNotification,
    currentUser 
  } = useData();

  const [request, setRequest] = useState<CustomerServiceRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [validating, setValidating] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load request
  useEffect(() => {
    if (!requestId) return;

    const load = async () => {
      setLoading(true);
      try {
        const data = await getCustomerServiceRequestById(requestId);
        setRequest(data);
        
        // Mark as seen when viewing
        if (data && !data.adminSeenAt) {
          await markRequestAsSeen(requestId);
        }
      } catch (err) {
        console.error('Error loading request:', err);
        setError('Erreur lors du chargement de la demande');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [requestId]);

  // Get client details
  const client = request ? clients.find((c: any) => c.id === request.clientId) : null;

  // Get pack details
  const pack = request?.packId ? packs.find((p: any) => p.id === request.packId) : null;

  // Handle validation
  const handleValidate = async () => {
    if (!request || !currentUser) return;

    const ok = window.confirm(
      'Valider cette demande ?\n\nCela va :\n1. Générer un devis signé au format PDF\n2. Insérer les missions dans le planning\n3. Envoyer un email de confirmation au client'
    );
    if (!ok) return;

    setValidating(true);
    setError(null);

    try {
      // Step 1: Create the devis (quote) document
      const devisId = await createSignedDevis();
      if (!devisId) throw new Error('Erreur lors de la création du devis');

      // Step 2: Create missions in planning
      const missionIds = await createMissions(devisId);

      // Step 3: Validate the request
      const validatedRequest = await validateCustomerServiceRequest(
        request.id,
        currentUser.id,
        devisId,
        missionIds
      );

      // Step 4: Send confirmation email to client
      if (validatedRequest) {
        await sendConfirmationEmail(validatedRequest);
      }

      // Step 5: Notify admin
      await addNotification(
        'admin',
        'success',
        'Demande validée',
        `La demande de ${request.clientName} a été validée. Devis ${devisId.slice(0, 8)}... créé avec ${missionIds.length} mission(s).`,
        undefined,
        `/admin/service-requests/${request.id}`
      );

      // Update local state
      setRequest(validatedRequest);
      
      alert('Demande validée avec succès ! Le devis a été généré et les missions ont été créées.');
    } catch (err: any) {
      console.error('Error validating request:', err);
      setError(err.message || 'Erreur lors de la validation');
    } finally {
      setValidating(false);
    }
  };

  // Create signed devis
  const createSignedDevis = async (): Promise<string | null> => {
    if (!request || !client) return null;

    const devisId = crypto.randomUUID();
    const now = new Date();
    const ref = `DEV-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;

    // Calculate totals
    const unitPrice = request.estimatedPrice || pack?.priceTTC || 0;
    const quantity = request.requestedSlots.length || 1;
    const totalHT = unitPrice * quantity * 0.979; // TVA 2.1%
    const totalTTC = unitPrice * quantity;
    const tvaRate = 2.1;

    const description = request.packName 
      ? `${request.packName} - ${request.serviceType}`
      : request.customServiceDescription || request.serviceType;

    const slotsData = request.requestedSlots.map(slot => ({
      id: crypto.randomUUID(),
      date: slot.date,
      startTime: slot.startTime,
      endTime: slot.endTime,
      duration: slot.duration
    }));

    const dbDoc = {
      id: devisId,
      ref,
      client_id: request.clientId,
      client_name: request.clientName,
      type: 'Devis',
      status: 'signed', // Directly signed since client already signed
      category: request.serviceType,
      service_type: request.serviceType,
      description,
      unit_price: unitPrice,
      quantity,
      tva_rate: tvaRate,
      total_ht: totalHT,
      total_ttc: totalTTC,
      tax_credit_enabled: false,
      date: now.toISOString().split('T')[0],
      slots_data: slotsData as any,
      signature_data: request.signatureDataUrl,
      signature_date: now.toISOString(),
      reminder_sent: false,
      pack_id: request.packId || null,
      frequency: 'Ponctuelle',
    };

    const { error } = await supabase.from('documents').insert(dbDoc);

    if (error) {
      console.error('Error creating devis:', error);
      throw new Error('Erreur lors de la création du devis');
    }

    return devisId;
  };

  // Create missions in planning
  const createMissions = async (devisId: string): Promise<string[]> => {
    if (!request) return [];

    const missionIds: string[] = [];
    const missionsToCreate: any[] = [];

    for (const slot of request.requestedSlots) {
      const missionId = crypto.randomUUID();
      missionIds.push(missionId);

      missionsToCreate.push({
        id: missionId,
        date: slot.date,
        start_time: slot.startTime,
        end_time: slot.endTime,
        duration: slot.duration,
        client_id: request.clientId,
        client_name: request.clientName,
        service: request.packName 
          ? `${request.packName} - ${request.serviceType}`
          : request.customServiceDescription || request.serviceType,
        provider_id: null,
        provider_name: 'À assigner',
        status: 'planned',
        color: 'gray',
        source: 'devis',
        source_document_id: devisId,
      });
    }

    if (missionsToCreate.length > 0) {
      const { error } = await supabase.from('missions').insert(missionsToCreate);

      if (error) {
        console.error('Error creating missions:', error);
        throw new Error('Erreur lors de la création des missions');
      }

      // Add to local state via DataContext
      for (const m of missionsToCreate) {
        await addMission({
          id: m.id,
          date: m.date,
          startTime: m.start_time,
          endTime: m.end_time,
          duration: m.duration,
          clientId: m.client_id,
          clientName: m.client_name,
          service: m.service,
          providerId: null,
          providerName: 'À assigner',
          status: 'planned',
          color: 'gray',
          source: 'devis',
          sourceDocumentId: devisId,
          dayIndex: dayjs(m.date).day() === 0 ? 6 : dayjs(m.date).day() - 1,
        });
      }
    }

    return missionIds;
  };

  // Send confirmation email to client
  const sendConfirmationEmail = async (validatedRequest: CustomerServiceRequest) => {
    if (!validatedRequest) return;

    const firstSlot = validatedRequest.requestedSlots[0];
    const serviceDate = firstSlot 
      ? `${firstSlot.date} ${firstSlot.startTime}-${firstSlot.endTime}`
      : 'À confirmer';

    await sendEmailViaEmailJS(
      validatedRequest.clientEmail,
      'Votre demande de service a été validée',
      'client_request_validated',
      {
        clientName: validatedRequest.clientName,
        serviceType: validatedRequest.serviceType,
        serviceDate,
        devisRef: validatedRequest.generatedDevisId 
          ? `DEV-${validatedRequest.generatedDevisId.slice(0, 8)}...`
          : 'Généré',
        link: 'https://www.prestaservicesantilles.com/'
      }
    );
  };

  // Handle rejection
  const handleReject = async () => {
    if (!request || !currentUser) return;

    const ok = window.confirm('Rejeter cette demande ? Le client sera notifié.');
    if (!ok) return;

    setRejecting(true);
    try {
      await rejectCustomerServiceRequest(request.id, currentUser.id);
      
      // Notify client of rejection
      await sendEmailViaEmailJS(
        request.clientEmail,
        'Votre demande de service',
        'default',
        {
          clientName: request.clientName,
          message: `Votre demande de service (${request.serviceType}) n'a pas pu être acceptée. Nous vous invitons à nous contacter pour discuter d'alternatives.`
        }
      );

      const updated = await getCustomerServiceRequestById(request.id);
      setRequest(updated);
    } catch (err: any) {
      console.error('Error rejecting request:', err);
      setError(err.message || 'Erreur lors du rejet');
    } finally {
      setRejecting(false);
    }
  };

  // Print signature
  const handlePrintSignature = () => {
    if (!request?.signatureDataUrl) return;
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head><title>Signature - ${request.clientName}</title></head>
        <body style="text-align: center; padding: 20px;">
          <h2>Signature de ${request.clientName}</h2>
          <p>Service: ${request.serviceType}</p>
          <p>Date: ${new Date(request.createdAt).toLocaleDateString('fr-FR')}</p>
          <img src="${request.signatureDataUrl}" style="max-width: 100%; border: 1px solid #ccc;" />
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  if (loading) {
    return (
      <div className="h-full w-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-brand-blue" />
      </div>
    );
  }

  if (!request) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center p-6">
        <AlertCircle className="w-16 h-16 text-red-400 mb-4" />
        <h2 className="text-xl font-bold text-slate-800 mb-2">Demande non trouvée</h2>
        <p className="text-slate-500 mb-4">La demande que vous recherchez n'existe pas ou a été supprimée.</p>
        <button
          onClick={() => navigate('/admin/service-requests')}
          className="px-4 py-2 bg-brand-blue text-white rounded-xl font-bold hover:bg-teal-700 flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour à la liste
        </button>
      </div>
    );
  }

  const statusColors = {
    pending: 'bg-amber-100 text-amber-700 border-amber-200',
    validated: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    rejected: 'bg-red-100 text-red-700 border-red-200',
    cancelled: 'bg-slate-100 text-slate-600 border-slate-200',
  };

  const statusLabels = {
    pending: 'En attente',
    validated: 'Validée',
    rejected: 'Rejetée',
    cancelled: 'Annulée',
  };

  return (
    <div className="h-full w-full overflow-y-auto p-6">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/admin/service-requests')}
          className="mb-4 inline-flex items-center gap-2 text-slate-500 hover:text-slate-700 text-sm font-medium"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour aux demandes
        </button>

        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs text-slate-500 mb-1">Détail de la demande</div>
            <h1 className="text-2xl font-extrabold text-slate-800">
              Demande de {request.clientName}
            </h1>
            <div className="flex items-center gap-3 mt-2">
              <span className={`px-3 py-1 rounded-full text-xs font-bold border ${statusColors[request.status]}`}>
                {statusLabels[request.status]}
              </span>
              <span className="text-sm text-slate-500">
                Soumise le {new Date(request.createdAt).toLocaleDateString('fr-FR')} à {new Date(request.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>

          {/* Actions */}
          {request.status === 'pending' && (
            <div className="flex items-center gap-3">
              <button
                onClick={handleReject}
                disabled={rejecting}
                className="px-4 py-2 bg-red-100 text-red-700 rounded-xl font-bold hover:bg-red-200 disabled:opacity-60 flex items-center gap-2"
              >
                {rejecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                Rejeter
              </button>
              <button
                onClick={handleValidate}
                disabled={validating}
                className="px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 disabled:opacity-60 flex items-center gap-2"
              >
                {validating ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                Valider la demande
              </button>
            </div>
          )}
        </div>

        {error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
            <AlertCircle className="w-4 h-4 inline mr-2" />
            {error}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column - Client & Service Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Client Information */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6">
            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <User className="w-5 h-5 text-brand-blue" />
              Informations client
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-slate-500">Nom</label>
                <p className="font-semibold text-slate-800">{request.clientName}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500">Email</label>
                <p className="font-semibold text-slate-800 flex items-center gap-2">
                  <Mail className="w-4 h-4 text-slate-400" />
                  {request.clientEmail}
                </p>
              </div>
              {request.clientPhone && (
                <div>
                  <label className="text-xs font-medium text-slate-500">Téléphone</label>
                  <p className="font-semibold text-slate-800 flex items-center gap-2">
                    <Phone className="w-4 h-4 text-slate-400" />
                    {request.clientPhone}
                  </p>
                </div>
              )}
              {(request.clientAddress || request.clientCity) && (
                <div>
                  <label className="text-xs font-medium text-slate-500">Adresse</label>
                  <p className="font-semibold text-slate-800 flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-slate-400" />
                    {[request.clientAddress, request.clientCity].filter(Boolean).join(', ')}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Service Information */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6">
            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Package className="w-5 h-5 text-brand-orange" />
              Service demandé
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-slate-500">Type de service</label>
                <p className="font-semibold text-slate-800">{request.serviceType}</p>
              </div>
              {request.packName && (
                <div>
                  <label className="text-xs font-medium text-slate-500">Pack sélectionné</label>
                  <p className="font-semibold text-slate-800 flex items-center gap-2">
                    <Package className="w-4 h-4 text-brand-orange" />
                    {request.packName}
                  </p>
                </div>
              )}
              {request.estimatedPrice && (
                <div>
                  <label className="text-xs font-medium text-slate-500">Prix estimé</label>
                  <p className="font-semibold text-slate-800 flex items-center gap-2">
                    <Euro className="w-4 h-4 text-slate-400" />
                    {request.estimatedPrice.toFixed(2)} €
                  </p>
                </div>
              )}
            </div>
            {request.customServiceDescription && (
              <div className="mt-4">
                <label className="text-xs font-medium text-slate-500">Description personnalisée</label>
                <p className="mt-1 p-3 bg-slate-50 rounded-lg text-slate-700 text-sm">
                  {request.customServiceDescription}
                </p>
              </div>
            )}
          </div>

          {/* Requested Slots */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6">
            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-emerald-500" />
              Créneaux demandés ({request.requestedSlots.length})
            </h2>
            <div className="space-y-2">
              {request.requestedSlots.map((slot, index) => (
                <div 
                  key={index}
                  className="flex items-center gap-4 p-3 bg-slate-50 rounded-xl"
                >
                  <div className="w-8 h-8 rounded-full bg-brand-blue/10 text-brand-blue flex items-center justify-center font-bold text-sm">
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-slate-800">
                      {new Date(slot.date).toLocaleDateString('fr-FR', { 
                        weekday: 'long', 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      })}
                    </div>
                    <div className="text-sm text-slate-500 flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      {slot.startTime} - {slot.endTime} ({slot.duration}h)
                    </div>
                  </div>
                </div>
              ))}
              {request.requestedSlots.length === 0 && (
                <p className="text-slate-500 text-center py-4">Aucun créneau spécifié</p>
              )}
            </div>
          </div>

          {/* Generated Documents */}
          {request.generatedDevisId && (
            <div className="bg-white border border-slate-200 rounded-2xl p-6">
              <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-500" />
                Documents générés
              </h2>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => navigate(`/admin/devis/${request.generatedDevisId}`)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-xl text-sm font-bold hover:bg-blue-100"
                >
                  <FileText className="w-4 h-4" />
                  Voir le devis généré
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right column - Signature & Actions */}
        <div className="space-y-6">
          {/* Signature */}
          {request.signatureDataUrl && (
            <div className="bg-white border border-slate-200 rounded-2xl p-6">
              <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-emerald-500" />
                Signature client
              </h2>
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50">
                <img 
                  src={request.signatureDataUrl} 
                  alt="Signature du client"
                  className="w-full h-auto max-h-48 object-contain"
                />
              </div>
              <div className="mt-4 flex gap-2">
                <button
                  onClick={handlePrintSignature}
                  className="flex-1 px-3 py-2 bg-slate-100 text-slate-700 rounded-lg text-xs font-bold hover:bg-slate-200 flex items-center justify-center gap-2"
                >
                  <Printer className="w-4 h-4" />
                  Imprimer
                </button>
                <a
                  href={request.signatureDataUrl}
                  download={`signature-${request.clientName}.png`}
                  className="flex-1 px-3 py-2 bg-slate-100 text-slate-700 rounded-lg text-xs font-bold hover:bg-slate-200 flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Télécharger
                </a>
              </div>
            </div>
          )}

          {/* Validation Info */}
          {request.validatedAt && (
            <div className="bg-white border border-slate-200 rounded-2xl p-6">
              <h2 className="text-lg font-bold text-slate-800 mb-4">
                Informations de validation
              </h2>
              <div className="space-y-3 text-sm">
                <div>
                  <label className="text-xs font-medium text-slate-500">Validée le</label>
                  <p className="font-semibold text-slate-800">
                    {new Date(request.validatedAt).toLocaleString('fr-FR')}
                  </p>
                </div>
                {request.generatedDevisId && (
                  <div>
                    <label className="text-xs font-medium text-slate-500">Devis généré</label>
                    <p className="font-semibold text-emerald-600">
                      <CheckCircle className="w-4 h-4 inline mr-1" />
                      Oui
                    </p>
                  </div>
                )}
                {request.generatedMissionIds && request.generatedMissionIds.length > 0 && (
                  <div>
                    <label className="text-xs font-medium text-slate-500">Missions créées</label>
                    <p className="font-semibold text-emerald-600">
                      <CheckCircle className="w-4 h-4 inline mr-1" />
                      {request.generatedMissionIds.length} mission(s)
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Help */}
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
            <h3 className="text-sm font-bold text-blue-800 mb-2">Actions disponibles</h3>
            <ul className="text-xs text-blue-700 space-y-1">
              <li>• Valider = Générer devis + missions + email client</li>
              <li>• Rejeter = Notifier le client du refus</li>
              <li>• Une fois validée, la demande ne peut plus être modifiée</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminServiceRequestDetailPage;
