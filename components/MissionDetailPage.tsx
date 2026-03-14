import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { 
  ArrowLeft, 
  Clock, 
  Calendar, 
  MapPin, 
  User, 
  Briefcase, 
  CheckCircle, 
  XCircle, 
  Clock3,
  Edit3,
  Trash2,
  FileText,
  Phone,
  Mail,
  Navigation
} from 'lucide-react';
import dayjs from 'dayjs';

const MissionDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { missions, clients, providers, submitMissionReport } = useData();
  
  const [mission, setMission] = useState<any>(null);
  const [client, setClient] = useState<any>(null);
  const [provider, setProvider] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showReportModal, setShowReportModal] = useState(false);

  // Report form state
  const [reportRemark, setReportRemark] = useState('');
  const [reportPhotos, setReportPhotos] = useState<string[]>([]);
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);

  useEffect(() => {
    if (id && missions.length > 0) {
      const foundMission = missions.find(m => m.id === id);
      if (foundMission) {
        setMission(foundMission);
        const foundClient = clients.find(c => c.id === foundMission.clientId || c.name === foundMission.clientName);
        const foundProvider = providers.find(p => p.id === foundMission.providerId);
        setClient(foundClient);
        setProvider(foundProvider);
      }
    }
    setLoading(false);
  }, [id, missions, clients, providers]);

  const handleStatusChange = (newStatus: string) => {
    if (mission) {
      setMission({ ...mission, status: newStatus });
    }
  };

  const handleDelete = () => {
    if (mission && confirm('Êtes-vous sûr de vouloir supprimer cette mission ?')) {
      navigate('/planning');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-blue"></div>
      </div>
    );
  }

  if (!mission) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <Clock className="w-16 h-16 text-slate-300 mb-4" />
        <h1 className="text-xl font-bold text-slate-700 mb-2">Mission non trouvée</h1>
        <p className="text-slate-500 mb-4">La mission que vous recherchez n'existe pas ou a été supprimée.</p>
        <button
          onClick={() => navigate('/planning')}
          className="px-4 py-2 bg-brand-blue text-white rounded-lg hover:bg-brand-blue-dark"
        >
          Retour au planning
        </button>
      </div>
    );
  }

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'completed':
        return { color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle, label: 'Terminée' };
      case 'in_progress':
        return { color: 'bg-blue-100 text-blue-700', icon: Clock3, label: 'En cours' };
      case 'cancelled':
        return { color: 'bg-red-100 text-red-700', icon: XCircle, label: 'Annulée' };
      default:
        return { color: 'bg-amber-100 text-amber-700', icon: Calendar, label: 'Planifiée' };
    }
  };

  const status = getStatusConfig(mission.status);
  const StatusIcon = status.icon;

  return (
    <div className="h-full overflow-y-auto bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/planning')}
                className="p-2 hover:bg-slate-100 rounded-lg transition"
              >
                <ArrowLeft className="w-5 h-5 text-slate-600" />
              </button>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-xl font-bold text-slate-800">Mission</h1>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1.5 ${status.color}`}>
                    <StatusIcon className="w-4 h-4" />
                    {status.label}
                  </span>
                </div>
                <p className="text-sm text-slate-500">
                  {dayjs(mission.date).format('dddd DD MMMM YYYY')} • {mission.startTime} - {mission.endTime}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowReportModal(true)}
                className="px-3 py-2 bg-brand-blue text-white rounded-lg hover:bg-brand-blue-dark flex items-center gap-2"
              >
                <FileText className="w-4 h-4" />
                {mission.hasReport ? 'Voir rapport' : 'Ajouter rapport'}
              </button>
              <button
                onClick={handleDelete}
                className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Service Info */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h2 className="text-lg font-semibold text-slate-800 mb-4">Service</h2>
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-brand-blue/10 rounded-xl flex items-center justify-center shrink-0">
                  <Briefcase className="w-6 h-6 text-brand-blue" />
                </div>
                <div>
                  <h3 className="text-xl font-medium text-slate-800">{mission.service}</h3>
                  <p className="text-slate-500 mt-1">{mission.description || 'Aucune description'}</p>
                </div>
              </div>
            </div>

            {/* Location */}
            {mission.location && (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <h2 className="text-lg font-semibold text-slate-800 mb-4">Lieu d'intervention</h2>
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center shrink-0">
                    <MapPin className="w-6 h-6 text-emerald-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-slate-800">{mission.location}</p>
                    {mission.location && (
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mission.location)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-sm text-brand-blue hover:underline mt-2"
                      >
                        <Navigation className="w-4 h-4" />
                        Voir sur Google Maps
                      </a>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Status Management */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h2 className="text-lg font-semibold text-slate-800 mb-4">Gestion du statut</h2>
              <div className="flex flex-wrap gap-2">
                {['planned', 'in_progress', 'completed', 'cancelled'].map((status) => (
                  <button
                    key={status}
                    onClick={() => handleStatusChange(status)}
                    disabled={mission.status === status}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                      mission.status === status
                        ? 'bg-brand-blue text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {status === 'planned' && 'Planifiée'}
                    {status === 'in_progress' && 'En cours'}
                    {status === 'completed' && 'Terminée'}
                    {status === 'cancelled' && 'Annulée'}
                  </button>
                ))}
              </div>
            </div>

            {/* Report Section */}
            {mission.hasReport && (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <h2 className="text-lg font-semibold text-slate-800 mb-4">Rapport d'intervention</h2>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-50 p-4 rounded-lg">
                      <p className="text-sm text-slate-500">Heure de début</p>
                      <p className="font-medium">{mission.report?.startTime || '-'}</p>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-lg">
                      <p className="text-sm text-slate-500">Heure de fin</p>
                      <p className="font-medium">{mission.report?.endTime || '-'}</p>
                    </div>
                  </div>
                  {mission.report?.remarks && (
                    <div>
                      <p className="text-sm text-slate-500 mb-2">Remarques</p>
                      <p className="bg-slate-50 p-4 rounded-lg">{mission.report.remarks}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Client Card */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h3 className="text-sm font-semibold text-slate-500 uppercase mb-4">Client</h3>
              {client ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-brand-blue/10 rounded-full flex items-center justify-center">
                      <User className="w-6 h-6 text-brand-blue" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800">{client.name}</p>
                      <p className="text-sm text-slate-500">Client</p>
                    </div>
                  </div>
                  {client.email && (
                    <a href={`mailto:${client.email}`} className="flex items-center gap-2 text-sm text-slate-600 hover:text-brand-blue">
                      <Mail className="w-4 h-4" />
                      {client.email}
                    </a>
                  )}
                  {client.phone && (
                    <a href={`tel:${client.phone}`} className="flex items-center gap-2 text-sm text-slate-600 hover:text-brand-blue">
                      <Phone className="w-4 h-4" />
                      {client.phone}
                    </a>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center">
                    <User className="w-6 h-6 text-slate-400" />
                  </div>
                  <div>
                    <p className="font-medium text-slate-800">{mission.clientName}</p>
                    <p className="text-sm text-slate-500">Client</p>
                  </div>
                </div>
              )}
            </div>

            {/* Provider Card */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h3 className="text-sm font-semibold text-slate-500 uppercase mb-4">Prestataire assigné</h3>
              {provider ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-purple-50 rounded-full flex items-center justify-center">
                      <Briefcase className="w-6 h-6 text-purple-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800">{provider.firstName} {provider.lastName}</p>
                      <p className="text-sm text-slate-500">{provider.specialty || 'Prestataire'}</p>
                    </div>
                  </div>
                  {provider.email && (
                    <a href={`mailto:${provider.email}`} className="flex items-center gap-2 text-sm text-slate-600 hover:text-brand-blue">
                      <Mail className="w-4 h-4" />
                      {provider.email}
                    </a>
                  )}
                  {provider.phone && (
                    <a href={`tel:${provider.phone}`} className="flex items-center gap-2 text-sm text-slate-600 hover:text-brand-blue">
                      <Phone className="w-4 h-4" />
                      {provider.phone}
                    </a>
                  )}
                </div>
              ) : (
                <p className="text-sm text-slate-500">Aucun prestataire assigné</p>
              )}
            </div>

            {/* Mission Info */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h3 className="text-sm font-semibold text-slate-500 uppercase mb-4">Détails</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Date</span>
                  <span className="font-medium">{dayjs(mission.date).format('DD/MM/YYYY')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Horaire</span>
                  <span className="font-medium">{mission.startTime} - {mission.endTime}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Durée</span>
                  <span className="font-medium">
                    {(() => {
                      const start = dayjs(`2000-01-01 ${mission.startTime}`);
                      const end = dayjs(`2000-01-01 ${mission.endTime}`);
                      const diff = end.diff(start, 'hour', true);
                      return `${diff.toFixed(1)}h`;
                    })()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">ID Mission</span>
                  <span className="font-medium font-mono text-xs">{mission.id.slice(0, 8)}...</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Report Modal */}
      {showReportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">
              {mission.hasReport ? 'Rapport d\'intervention' : 'Ajouter un rapport'}
            </h3>
            
            {mission.hasReport ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 p-4 rounded-lg">
                    <p className="text-sm text-slate-500">Heure de début</p>
                    <p className="font-medium">{mission.report?.startTime || mission.startTime}</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-lg">
                    <p className="text-sm text-slate-500">Heure de fin</p>
                    <p className="font-medium">{mission.report?.endTime || mission.endTime}</p>
                  </div>
                </div>
                {mission.endRemark && (
                  <div>
                    <p className="text-sm text-slate-500 mb-2">Remarques</p>
                    <p className="bg-slate-50 p-4 rounded-lg">{mission.endRemark}</p>
                  </div>
                )}
                {mission.endPhotos && mission.endPhotos.length > 0 && (
                  <div>
                    <p className="text-sm text-slate-500 mb-2">Photos ({mission.endPhotos.length})</p>
                    <div className="grid grid-cols-3 gap-2">
                      {mission.endPhotos.map((photo: string, idx: number) => (
                        <img key={idx} src={photo} alt={`Photo ${idx + 1}`} className="w-full h-20 object-cover rounded-lg" />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Remarques sur l'intervention
                  </label>
                  <textarea
                    value={reportRemark}
                    onChange={(e) => setReportRemark(e.target.value)}
                    placeholder="Décrivez le déroulement de la mission..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-blue focus:border-brand-blue min-h-[100px]"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Photos (URLs, séparées par des virgules)
                  </label>
                  <textarea
                    value={reportPhotos.join(', ')}
                    onChange={(e) => setReportPhotos(e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                    placeholder="https://example.com/photo1.jpg, https://example.com/photo2.jpg"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-blue focus:border-brand-blue"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Entrez les URLs des photos séparées par des virgules
                  </p>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => setShowReportModal(false)}
                    className="flex-1 px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={async () => {
                      if (!reportRemark.trim()) {
                        alert('Veuillez ajouter des remarques');
                        return;
                      }
                      setIsSubmittingReport(true);
                      try {
                        await submitMissionReport?.(mission.id, reportRemark, reportPhotos, undefined);
                        setMission({ ...mission, hasReport: true, status: 'completed', endRemark: reportRemark, endPhotos: reportPhotos });
                        setShowReportModal(false);
                        setReportRemark('');
                        setReportPhotos([]);
                      } catch (error) {
                        console.error('Error submitting report:', error);
                        alert('Erreur lors de la soumission du rapport');
                      } finally {
                        setIsSubmittingReport(false);
                      }
                    }}
                    disabled={isSubmittingReport}
                    className="flex-1 px-4 py-2 bg-brand-blue text-white rounded-lg hover:bg-brand-blue-dark disabled:opacity-50"
                  >
                    {isSubmittingReport ? 'Envoi...' : 'Soumettre le rapport'}
                  </button>
                </div>
              </div>
            )}
            {mission.hasReport && (
              <div className="flex gap-2 justify-end mt-6">
                <button
                  onClick={() => setShowReportModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Fermer
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default MissionDetailPage;
