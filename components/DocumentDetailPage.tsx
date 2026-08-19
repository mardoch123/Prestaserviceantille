import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { ArrowLeft, FileText, Eye, Printer, Send, CheckCircle, XCircle, Clock, Calendar, User, Building2, Euro, FileSignature, UploadCloud } from 'lucide-react';
import dayjs from 'dayjs';
import { downloadHtmlAsPdf } from '../utils/htmlPdf';
import { supabase } from '../utils/supabaseClient';

const DocumentDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { documents, clients, updateDocumentStatus, sendDocumentReminder, signQuoteAsAdmin } = useData();
  
  const [document, setDocument] = useState<any>(null);
  const [client, setClient] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'details' | 'history'>('details');
  const [isSignModalOpen, setIsSignModalOpen] = useState(false);
  const [signatureData, setSignatureData] = useState('');
  const [isSigning, setIsSigning] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [clientSignaturePreview, setClientSignaturePreview] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (id && documents.length > 0) {
      const foundDoc = documents.find(d => d.id === id);
      if (foundDoc) {
        setDocument(foundDoc);
        const foundClient = clients.find(c => c.id === foundDoc.clientId || c.name === foundDoc.clientName);
        setClient(foundClient);
      }
    }
    setLoading(false);
  }, [id, documents, clients]);

  const contentRef = useRef<HTMLDivElement>(null);

  const handleDownload = async () => {
    if (document) {
      try {
        // Get the document HTML content
        const docHtml = contentRef.current?.innerHTML || '';
        
        await downloadHtmlAsPdf({
          html: docHtml,
          filename: `${document.type}_${document.ref || document.reference}.pdf`,
          title: `${document.type} ${document.ref || document.reference}`
        });
      } catch (error) {
        console.error('Error generating PDF:', error);
        alert('Erreur lors de la génération du PDF');
      }
    }
  };

  const handleSendReminder = async () => {
    if (document) {
      await sendDocumentReminder?.(document.id);
      alert('Rappel envoyé !');
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (document) {
      await updateDocumentStatus?.(document.id, newStatus);
      setDocument({ ...document, status: newStatus });
    }
  };

  // Signature canvas handlers
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    setIsDrawing(true);
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    ctx.beginPath();
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    ctx.lineTo(clientX - rect.left, clientY - rect.top);
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
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setSignatureData('');
  };

  const openSignModal = async () => {
    if (document && document.type === 'Devis') {
      let docToSign = document;
      
      // If document is expired, reset creation date to today and status to 'sent'
      if (document.status === 'expired') {
        const now = new Date().toISOString();
        
        const { error } = await supabase
          .from('documents')
          .update({ 
            created_at: now,
            status: 'sent'
          })
          .eq('id', document.id);
        
        if (error) {
          console.error('Error updating document date:', error);
          alert('Erreur lors de la mise à jour du document');
          return;
        }
        
        docToSign = { ...document, createdAt: now, status: 'sent' };
        setDocument(docToSign);
      }
      
      // Detect client signature
      setClientSignaturePreview(docToSign.signatureData || '');
      setSignatureData('');
      setIsSignModalOpen(true);
    }
  };

  const handleSignSubmit = async () => {
    if (!signatureData || !document) return;
    
    setIsSigning(true);
    try {
      await signQuoteAsAdmin?.(document.id, signatureData);
      setDocument({ ...document, status: 'signed' });
      setIsSignModalOpen(false);
      setSignatureData('');
      alert('Devis signé avec succès !');
    } catch (error: any) {
      console.error('Error signing quote:', error);
      alert(error?.message || 'Erreur lors de la signature du devis');
    } finally {
      setIsSigning(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-blue"></div>
      </div>
    );
  }

  if (!document) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <FileText className="w-16 h-16 text-slate-300 mb-4" />
        <h1 className="text-xl font-bold text-slate-700 mb-2">Document non trouvé</h1>
        <p className="text-slate-500 mb-4">Le document que vous recherchez n'existe pas ou a été supprimé.</p>
        <button
          onClick={() => navigate('/invoices')}
          className="px-4 py-2 bg-brand-blue text-white rounded-lg hover:bg-brand-blue-dark"
        >
          Retour aux documents
        </button>
      </div>
    );
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'signed':
      case 'paid':
        return <CheckCircle className="w-5 h-5 text-emerald-500" />;
      case 'rejected':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'sent':
        return <Send className="w-5 h-5 text-blue-500" />;
      default:
        return <Clock className="w-5 h-5 text-amber-500" />;
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      draft: 'Brouillon',
      sent: 'Envoyé',
      signed: 'Signé',
      rejected: 'Refusé',
      paid: 'Payé',
      converted: 'Converti',
      expired: 'Expiré'
    };
    return labels[status] || status;
  };

  return (
    <div className="h-full overflow-y-auto bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/invoices')}
                className="p-2 hover:bg-slate-100 rounded-lg transition"
              >
                <ArrowLeft className="w-5 h-5 text-slate-600" />
              </button>
              <div>
                <div className="flex items-center gap-2">
                  <FileText className="w-6 h-6 text-brand-blue" />
                  <h1 className="text-xl font-bold text-slate-800">
                    {document.type} {document.ref || document.reference}
                  </h1>
                </div>
                <p className="text-sm text-slate-500">
                  Créé le {dayjs(document.createdAt).format('DD/MM/YYYY')}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {document.type === 'Devis' && document.status !== 'signed' && (
                <button
                  onClick={openSignModal}
                  className="px-3 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 flex items-center gap-2"
                >
                  <FileSignature className="w-4 h-4" />
                  Signer
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Status Card */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-slate-800">Statut du document</h2>
                <div className="flex items-center gap-2 px-3 py-1 bg-slate-100 rounded-full">
                  {getStatusIcon(document.status)}
                  <span className="text-sm font-medium capitalize">{getStatusLabel(document.status)}</span>
                </div>
              </div>
              
              <div className="flex flex-wrap gap-2">
                {['draft', 'sent', 'signed', 'rejected', 'paid'].map((status) => (
                  <button
                    key={status}
                    onClick={() => handleStatusChange(status)}
                    disabled={document.status === status}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                      document.status === status
                        ? 'bg-brand-blue text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {getStatusLabel(status)}
                  </button>
                ))}
              </div>
            </div>

            {/* Document Preview */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200">
                <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                  <Eye className="w-5 h-5" />
                  Aperçu du document
                </h2>
              </div>
              <div className="p-8 bg-slate-50 min-h-[500px]">
                <div ref={contentRef} className="bg-white shadow-lg max-w-2xl mx-auto p-8 rounded-lg">
                  <div className="border-b-2 border-brand-blue pb-4 mb-6">
                    <h1 className="text-2xl font-bold text-brand-blue">PRESTA SERVICES ANTILLES</h1>
                    <p className="text-sm text-slate-600">31 Résidence L'Autre Bord – 97220 La Trinité</p>
                  </div>
                  
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <p className="text-sm text-slate-500">Document</p>
                      <p className="text-xl font-bold text-slate-800">{document.type} {document.ref}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-slate-500">Date</p>
                      <p className="font-medium">{dayjs(document.createdAt).format('DD/MM/YYYY')}</p>
                    </div>
                  </div>

                  <div className="mb-6">
                    <p className="text-sm text-slate-500 mb-1">Client</p>
                    <p className="font-semibold text-slate-800">{document.clientName}</p>
                    {client && (
                      <>
                        <p className="text-sm text-slate-600">{client.email}</p>
                        <p className="text-sm text-slate-600">{client.phone}</p>
                      </>
                    )}
                  </div>

                  <div className="border-t border-slate-200 pt-4 mb-6">
                    <p className="text-sm text-slate-500 mb-2">Détails</p>
                    <div className="space-y-2">
                      {document.items?.map((item: any, idx: number) => (
                        <div key={idx} className="flex justify-between py-2">
                          <span>{item.description}</span>
                          <span className="font-medium">{item.amount?.toFixed(2)} €</span>
                        </div>
                      )) || (
                        <div className="flex justify-between py-2">
                          <span>Prestation</span>
                          <span className="font-medium">{document.totalHT?.toFixed(2) || '0.00'} €</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="border-t-2 border-slate-800 pt-4">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold">Total TTC</span>
                      <span className="text-2xl font-bold text-brand-blue">
                        {document.totalTTC?.toFixed(2) || document.total?.toFixed(2) || '0.00'} €
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Client Info */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h3 className="text-sm font-semibold text-slate-500 uppercase mb-4">Client</h3>
              {client ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-brand-blue/10 rounded-full flex items-center justify-center">
                      <User className="w-5 h-5 text-brand-blue" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-800">{client.name}</p>
                      <p className="text-sm text-slate-500">Client</p>
                    </div>
                  </div>
                  {client.email && (
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <span className="w-5">@</span>
                      {client.email}
                    </div>
                  )}
                  {client.phone && (
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <span className="w-5">📞</span>
                      {client.phone}
                    </div>
                  )}
                  {client.address && (
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <Building2 className="w-4 h-4" />
                      {client.address}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-slate-500">Client non trouvé</p>
              )}
            </div>

            {/* Actions */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h3 className="text-sm font-semibold text-slate-500 uppercase mb-4">Actions</h3>
              <div className="space-y-2">
                <button
                  onClick={() => window.print()}
                  className="w-full px-4 py-2 bg-slate-50 text-slate-700 rounded-lg hover:bg-slate-100 flex items-center gap-2"
                >
                  <Printer className="w-4 h-4" />
                  Imprimer
                </button>
              </div>
            </div>

            {/* Document Info */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h3 className="text-sm font-semibold text-slate-500 uppercase mb-4">Informations</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Type</span>
                  <span className="font-medium">{document.type}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Référence</span>
                  <span className="font-medium">{document.ref || document.reference || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Date de création</span>
                  <span className="font-medium">{dayjs(document.createdAt).format('DD/MM/YYYY')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Montant HT</span>
                  <span className="font-medium">{document.totalHT?.toFixed(2) || '0.00'} €</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Montant TTC</span>
                  <span className="font-medium">{document.totalTTC?.toFixed(2) || document.total?.toFixed(2) || '0.00'} €</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">TVA</span>
                  <span className="font-medium">{document.tvaRate || 8.5}%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Signature Modal */}
      {isSignModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <div>
                <h3 className="text-lg font-bold text-slate-800">Signature du devis</h3>
                <p className="text-sm text-slate-500">Signez pour valider le devis</p>
              </div>
              <button 
                onClick={() => { setIsSignModalOpen(false); setClientSignaturePreview(''); }}
                className="p-2 hover:bg-slate-100 rounded-full transition"
              >
                <XCircle className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              {/* Client signature detected */}
              {clientSignaturePreview ? (
                <>
                  <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-green-800 text-sm">Signature client détectée</p>
                      <p className="text-xs text-green-700">Le client a déjà signé. Utilisez sa signature ou dessinez la vôtre.</p>
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-xl p-3">
                    <p className="text-[10px] uppercase font-bold text-slate-400 mb-2">Signature du client</p>
                    <img src={clientSignaturePreview} alt="Signature client" className="w-full max-h-28 object-contain" />
                  </div>

                  {!signatureData ? (
                    <div className="flex gap-2">
                      <button
                        onClick={() => setSignatureData(clientSignaturePreview)}
                        className="flex-1 py-2 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition flex items-center justify-center gap-1.5"
                      >
                        <CheckCircle className="w-3.5 h-3.5" /> Utiliser
                      </button>
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="flex-1 py-2 text-sm font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition flex items-center justify-center gap-1.5"
                      >
                        <UploadCloud className="w-3.5 h-3.5" /> Importer image
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                      <CheckCircle className="w-4 h-4 text-blue-600" />
                      <span className="text-sm font-medium text-blue-800 flex-1">Signature prête</span>
                      <button
                        onClick={() => setSignatureData('')}
                        className="text-xs text-blue-700 font-bold underline"
                      >
                        Changer
                      </button>
                    </div>
                  )}

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      try {
                        const reader = new FileReader();
                        reader.onload = () => setSignatureData(reader.result as string);
                        reader.readAsDataURL(file);
                      } catch {
                        alert('Erreur lors du chargement.');
                      }
                    }}
                  />
                </>
              ) : (
                <>
                  <div className="border-2 border-slate-300 rounded-lg bg-slate-50 mb-4 overflow-hidden">
                    <canvas
                      ref={canvasRef}
                      width={350}
                      height={200}
                      className="cursor-crosshair touch-none w-full"
                      onMouseDown={startDrawing}
                      onMouseMove={draw}
                      onTouchStart={startDrawing}
                      onTouchMove={draw}
                      onTouchEnd={stopDrawing}
                      onMouseLeave={stopDrawing}
                    />
                  </div>
                  
                  <div className="flex gap-2">
                    <button
                      onClick={clearSignature}
                      className="flex-1 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition"
                    >
                      Effacer
                    </button>
                  </div>
                </>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => { setIsSignModalOpen(false); setClientSignaturePreview(''); }}
                  className="flex-1 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition"
                >
                  Annuler
                </button>
                <button
                  onClick={handleSignSubmit}
                  disabled={!signatureData || isSigning}
                  className="flex-1 px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSigning ? 'Signature en cours...' : 'Valider la signature'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentDetailPage;
