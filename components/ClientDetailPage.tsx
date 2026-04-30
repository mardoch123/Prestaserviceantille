import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { 
  ArrowLeft, 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  Building2, 
  Calendar,
  FileText,
  Clock,
  Euro,
  Edit3,
  Trash2,
  MessageSquare,
  History,
  CheckCircle,
  XCircle,
  Clock3
} from 'lucide-react';
import dayjs from 'dayjs';

const ClientDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { clients, missions, documents, deleteClients } = useData();
  
  const [client, setClient] = useState<any>(null);
  const [clientMissions, setClientMissions] = useState<any[]>([]);
  const [clientDocuments, setClientDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'info' | 'missions' | 'documents' | 'history'>('info');

  useEffect(() => {
    // Check for client ID in URL params (from search navigation)
    const clientIdFromQuery = searchParams.get('id');
    const effectiveId = id || clientIdFromQuery;
    
    if (effectiveId && clients.length > 0) {
      const foundClient = clients.find(c => c.id === effectiveId);
      if (foundClient) {
        setClient(foundClient);
        
        // Get client missions
        const foundMissions = missions.filter(m => m.clientId === effectiveId || m.clientName === foundClient.name);
        setClientMissions(foundMissions);
        
        // Get client documents
        const foundDocs = documents.filter(d => d.clientId === effectiveId || d.clientName === foundClient.name);
        setClientDocuments(foundDocs);
      }
    }
    setLoading(false);
  }, [id, clients, missions, documents, searchParams]);

  const handleDelete = async () => {
    if (client && confirm('Êtes-vous sûr de vouloir supprimer ce client ?')) {
      await deleteClients?.([client.id]);
      navigate('/clients');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
      case 'paid':
        return <CheckCircle className="w-4 h-4 text-emerald-500" />;
      case 'cancelled':
      case 'rejected':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'in_progress':
        return <Clock3 className="w-4 h-4 text-blue-500" />;
      default:
        return <Clock className="w-4 h-4 text-amber-500" />;
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      planned: 'Planifiée',
      in_progress: 'En cours',
      completed: 'Terminée',
      cancelled: 'Annulée',
      draft: 'Brouillon',
      sent: 'Envoyé',
      signed: 'Signé',
      paid: 'Payé'
    };
    return labels[status] || status;
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-blue"></div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-slate-50 p-4">
        <User className="w-16 h-16 text-slate-300 mb-4" />
        <h1 className="text-xl font-bold text-slate-700 mb-2">Client non trouvé</h1>
        <p className="text-slate-500 mb-4">Le client que vous recherchez n'existe pas ou a été supprimé.</p>
        <button
          onClick={() => navigate('/clients')}
          className="px-4 py-2 bg-brand-blue text-white rounded-lg hover:bg-brand-blue-dark"
        >
          Retour aux clients
        </button>
      </div>
    );
  }

  const totalSpent = clientDocuments
    .filter(d => d.status === 'paid' || d.status === 'signed')
    .reduce((sum, d) => sum + (d.totalTTC || d.total || 0), 0);

  return (
    <div className="h-full overflow-y-auto bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/clients')}
                className="p-2 hover:bg-slate-100 rounded-lg transition"
              >
                <ArrowLeft className="w-5 h-5 text-slate-600" />
              </button>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-brand-blue/10 rounded-full flex items-center justify-center">
                  <User className="w-6 h-6 text-brand-blue" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-slate-800">{client.name || 'Client sans nom'}</h1>
                  <p className="text-sm text-slate-500">
                    Client depuis {dayjs(client.since).format('DD/MM/YYYY')}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate(`/clients?edit=${client.id}`)}
                className="px-3 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 flex items-center gap-2"
              >
                <Edit3 className="w-4 h-4" />
                Modifier
              </button>
              <button
                onClick={handleDelete}
                className="px-3 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Supprimer
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mt-4">
            {[
              { id: 'info', label: 'Informations', icon: User },
              { id: 'missions', label: `Missions (${clientMissions.length})`, icon: Clock },
              { id: 'documents', label: `Documents (${clientDocuments.length})`, icon: FileText },
              { id: 'history', label: 'Historique', icon: History }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                  activeTab === tab.id
                    ? 'bg-brand-blue text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {activeTab === 'info' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Info */}
            <div className="lg:col-span-2 space-y-6">
              {/* Contact Info */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                  <User className="w-5 h-5" />
                  Informations de contact
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {client.email && (
                    <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                      <Mail className="w-5 h-5 text-slate-400" />
                      <div>
                        <p className="text-sm text-slate-500">Email</p>
                        <p className="font-medium text-slate-800">{client.email}</p>
                      </div>
                    </div>
                  )}
                  {client.phone && (
                    <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                      <Phone className="w-5 h-5 text-slate-400" />
                      <div>
                        <p className="text-sm text-slate-500">Téléphone</p>
                        <p className="font-medium text-slate-800">{client.phone}</p>
                      </div>
                    </div>
                  )}
                  {client.address && (
                    <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                      <MapPin className="w-5 h-5 text-slate-400" />
                      <div>
                        <p className="text-sm text-slate-500">Adresse</p>
                        <p className="font-medium text-slate-800">{client.address}</p>
                      </div>
                    </div>
                  )}
                  {client.city && (
                    <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                      <Building2 className="w-5 h-5 text-slate-400" />
                      <div>
                        <p className="text-sm text-slate-500">Ville</p>
                        <p className="font-medium text-slate-800">{client.city}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <Clock className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-slate-800">{clientMissions.length}</p>
                      <p className="text-sm text-slate-500">Missions</p>
                    </div>
                  </div>
                </div>
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                      <FileText className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-slate-800">{clientDocuments.length}</p>
                      <p className="text-sm text-slate-500">Documents</p>
                    </div>
                  </div>
                </div>
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                      <Euro className="w-5 h-5 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-slate-800">{totalSpent.toFixed(2)}€</p>
                      <p className="text-sm text-slate-500">Total dépensé</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Quick Actions */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <h3 className="text-sm font-semibold text-slate-500 uppercase mb-4">Actions rapides</h3>
                <div className="space-y-2">
                  <button
                    onClick={() => navigate('/planning', { state: { selectedClientId: client.id } })}
                    className="w-full px-4 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 flex items-center gap-2"
                  >
                    <Calendar className="w-4 h-4" />
                    Nouvelle mission
                  </button>
                  <button
                    onClick={() => navigate(`/invoices?clientId=${client.id}`)}
                    className="w-full px-4 py-2 bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100 flex items-center gap-2"
                  >
                    <FileText className="w-4 h-4" />
                    Nouveau devis
                  </button>
                  {client.email && (
                    <a
                      href={`mailto:${client.email}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full px-4 py-2 bg-slate-50 text-slate-700 rounded-lg hover:bg-slate-100 flex items-center gap-2"
                    >
                      <Mail className="w-4 h-4" />
                      Envoyer un email
                    </a>
                  )}
                  {client.phone && (
                    <a
                      href={`tel:${client.phone}`}
                      className="w-full px-4 py-2 bg-slate-50 text-slate-700 rounded-lg hover:bg-slate-100 flex items-center gap-2"
                    >
                      <Phone className="w-4 h-4" />
                      Appeler
                    </a>
                  )}
                </div>
              </div>

              {/* Notes */}
              {client.notes && (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                  <h3 className="text-sm font-semibold text-slate-500 uppercase mb-4">Notes</h3>
                  <p className="text-slate-700 whitespace-pre-wrap">{client.notes}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'missions' && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200">
            <div className="px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-800">Missions du client</h2>
            </div>
            {clientMissions.length === 0 ? (
              <div className="p-8 text-center">
                <Clock className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500">Aucune mission pour ce client</p>
                <button
                  onClick={() => navigate('/planning', { state: { selectedClientId: client.id } })}
                  className="mt-4 px-4 py-2 bg-brand-blue text-white rounded-lg hover:bg-brand-blue-dark"
                >
                  Créer une mission
                </button>
              </div>
            ) : (
              <div className="divide-y divide-slate-200">
                {clientMissions.map(mission => (
                  <div 
                    key={mission.id} 
                    className="p-4 hover:bg-slate-50 cursor-pointer"
                    onClick={() => navigate(`/planning/missions/${mission.id}`)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {getStatusIcon(mission.status)}
                        <div>
                          <p className="font-medium text-slate-800">{mission.service}</p>
                          <p className="text-sm text-slate-500">
                            {mission.date} • {mission.startTime} - {mission.endTime}
                          </p>
                        </div>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        mission.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                        mission.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                        mission.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                        'bg-amber-100 text-amber-700'
                      }`}>
                        {getStatusLabel(mission.status)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'documents' && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200">
            <div className="px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-800">Documents du client</h2>
            </div>
            {clientDocuments.length === 0 ? (
              <div className="p-8 text-center">
                <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500">Aucun document pour ce client</p>
                <button
                  onClick={() => navigate('/invoices', { state: { selectedClientId: client.id } })}
                  className="mt-4 px-4 py-2 bg-brand-blue text-white rounded-lg hover:bg-brand-blue-dark"
                >
                  Créer un devis
                </button>
              </div>
            ) : (
              <div className="divide-y divide-slate-200">
                {clientDocuments.map(doc => (
                  <div 
                    key={doc.id} 
                    className="p-4 hover:bg-slate-50 cursor-pointer"
                    onClick={() => navigate(`/invoices/${doc.id}`)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <FileText className="w-5 h-5 text-slate-400" />
                        <div>
                          <p className="font-medium text-slate-800">{doc.type} {doc.ref || doc.reference}</p>
                          <p className="text-sm text-slate-500">
                            {dayjs(doc.createdAt).format('DD/MM/YYYY')} • {(doc.totalTTC || doc.total || 0).toFixed(2)} €
                          </p>
                        </div>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        doc.status === 'paid' || doc.status === 'signed' ? 'bg-emerald-100 text-emerald-700' :
                        doc.status === 'sent' ? 'bg-blue-100 text-blue-700' :
                        doc.status === 'rejected' ? 'bg-red-100 text-red-700' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {getStatusLabel(doc.status)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">Historique</h2>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-brand-blue rounded-full mt-2" />
                <div>
                  <p className="text-slate-800">Client créé</p>
                  <p className="text-sm text-slate-500">{dayjs(client.since).format('DD/MM/YYYY HH:mm')}</p>
                </div>
              </div>
              {clientMissions.length > 0 && (
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full mt-2" />
                  <div>
                    <p className="text-slate-800">{clientMissions.length} mission(s) créée(s)</p>
                    <p className="text-sm text-slate-500">Dernière: {clientMissions[clientMissions.length - 1]?.date || 'N/A'}</p>
                  </div>
                </div>
              )}
              {clientDocuments.length > 0 && (
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-amber-500 rounded-full mt-2" />
                  <div>
                    <p className="text-slate-800">{clientDocuments.length} document(s) créé(s)</p>
                    <p className="text-sm text-slate-500">Dernier: {dayjs(clientDocuments[clientDocuments.length - 1]?.createdAt).format('DD/MM/YYYY')}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ClientDetailPage;
