import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Calendar, Clock, FileText, MapPin, User } from 'lucide-react';
import dayjs from 'dayjs';
import { useData } from '../context/DataContext';
import type { Mission } from '../types';
import { MARTINIQUE_TIMEZONE } from '../src/utils/dayjsMartinique';

const getStatusStyle = (status?: string) => {
  const s = String(status || '').toLowerCase();
  if (s === 'completed') return 'bg-green-100 text-green-700 border-green-200';
  if (s === 'in_progress') return 'bg-blue-100 text-blue-700 border-blue-200';
  if (s === 'planned') return 'bg-amber-100 text-amber-700 border-amber-200';
  if (s === 'cancelled') return 'bg-red-100 text-red-700 border-red-200';
  return 'bg-slate-100 text-slate-700 border-slate-200';
};

const AdminMissionDetails: React.FC = () => {
  const navigate = useNavigate();
  const { missionId } = useParams();
  const { missions, clients, providers, getMissionDetails } = useData();
  const [loading, setLoading] = useState(false);
  const [mission, setMission] = useState<Mission | null>(null);

  useEffect(() => {
    const id = String(missionId || '').trim();
    if (!id) return;

    const local = missions.find(m => String(m.id) === id) || null;
    if (local) {
      setMission(local);
      return;
    }

    let active = true;
    setLoading(true);
    getMissionDetails(id)
      .then((res) => {
        if (!active) return;
        setMission(res);
      })
      .catch((e) => {
        console.error('Failed to load mission details', e);
        if (!active) return;
        setMission(null);
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [missionId, missions, getMissionDetails]);

  const client = useMemo(() => {
    if (!mission?.clientId) return null;
    return clients.find(c => String(c.id) === String(mission.clientId)) || null;
  }, [clients, mission?.clientId]);

  const provider = useMemo(() => {
    if (!mission?.providerId) return null;
    return providers.find(p => String(p.id) === String(mission.providerId)) || null;
  }, [providers, mission?.providerId]);

  const title = mission ? `Mission ${mission.clientName || ''}`.trim() : 'Détail mission';

  return (
    <div className="h-full overflow-y-auto p-6 md:p-8 bg-cream-50/50">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="flex items-start gap-3">
            <button
              type="button"
              onClick={() => navigate('/planning')}
              className="p-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 transition"
              title="Retour"
              aria-label="Retour"
            >
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </button>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl md:text-2xl font-serif font-bold text-slate-800">{title}</h1>
                {mission?.status ? (
                  <span className={`text-xs font-bold px-2 py-1 rounded-full border ${getStatusStyle(mission.status)}`}>
                    {String(mission.status).toUpperCase()}
                  </span>
                ) : null}
              </div>
              <p className="text-xs text-slate-500 mt-1">Détail mission/planning (admin)</p>
            </div>
          </div>
          {mission ? (
            <button
              type="button"
              onClick={() => navigate('/reports')}
              className="hidden sm:inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-blue text-white font-bold hover:opacity-95 transition"
            >
              <FileText className="w-4 h-4" />
              Aller aux rapports
            </button>
          ) : null}
        </div>

        {loading && !mission ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 space-y-4">
              <div className="bg-white border border-slate-200 rounded-2xl p-5 animate-pulse h-40" />
              <div className="bg-white border border-slate-200 rounded-2xl p-5 animate-pulse h-72" />
            </div>
            <div className="lg:col-span-4 space-y-4">
              <div className="bg-white border border-slate-200 rounded-2xl p-5 animate-pulse h-56" />
            </div>
          </div>
        ) : null}

        {!loading && !mission ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center">
            <p className="text-slate-700 font-bold">Mission introuvable</p>
            <p className="text-sm text-slate-500 mt-1">Vérifie l’identifiant ou la synchronisation des données.</p>
            <button
              type="button"
              onClick={() => navigate('/planning')}
              className="mt-4 px-4 py-2 rounded-xl bg-slate-900 text-white font-bold"
            >
              Retour
            </button>
          </div>
        ) : null}

        {mission ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 space-y-6">
              <div className="bg-white border border-slate-200 rounded-2xl p-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
                      <User className="w-5 h-5 text-slate-600" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 font-bold uppercase">Client</p>
                      <p className="text-sm font-bold text-slate-800">{mission.clientName || client?.name || '—'}</p>
                      <p className="text-xs text-slate-600 mt-1">
                        {client?.address ? `${client.address}${client.city ? `, ${client.city}` : ''}` : (client?.city || '—')}
                      </p>
                      <p className="text-xs text-slate-600">{client?.email || '—'}</p>
                      <p className="text-xs text-slate-600">{client?.phone || '—'}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
                      <Calendar className="w-5 h-5 text-slate-600" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 font-bold uppercase">Date</p>
                      <p className="text-sm font-bold text-slate-800">
                        {mission.date ? dayjs.tz(mission.date, 'YYYY-MM-DD', MARTINIQUE_TIMEZONE).format('DD/MM/YYYY') : '—'}
                      </p>
                      <p className="text-xs text-slate-600 mt-1">Service: {mission.service || '—'}</p>
                      <p className="text-xs text-slate-600">Prestataire: {mission.providerName || 'À assigner'}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-slate-500" />
                  <h2 className="text-sm font-bold text-slate-800">Créneau</h2>
                </div>
                <div className="p-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                    <p className="text-xs font-bold text-slate-500">Début</p>
                    <p className="text-sm font-bold text-slate-800 mt-1">{mission.startTime || '—'}</p>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                    <p className="text-xs font-bold text-slate-500">Fin</p>
                    <p className="text-sm font-bold text-slate-800 mt-1">{mission.endTime || '—'}</p>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                    <p className="text-xs font-bold text-slate-500">Durée</p>
                    <p className="text-sm font-bold text-slate-800 mt-1">{Number.isFinite(Number(mission.duration)) ? `${Number(mission.duration).toFixed(2)}h` : '—'}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-slate-500" />
                  <h2 className="text-sm font-bold text-slate-800">Informations</h2>
                </div>
                <div className="p-5 space-y-4">
                  <div>
                    <p className="text-xs text-slate-500 font-bold uppercase">Lieu</p>
                    <p className="text-sm font-bold text-slate-800 mt-1">{client?.address ? `${client.address}${client.city ? `, ${client.city}` : ''}` : (client?.city || '—')}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 font-bold uppercase">Remarque début</p>
                    <p className="text-sm text-slate-800 mt-1 whitespace-pre-wrap">{(mission as any)?.startRemark || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 font-bold uppercase">Remarque fin</p>
                    <p className="text-sm text-slate-800 mt-1 whitespace-pre-wrap">{(mission as any)?.endRemark || '—'}</p>
                  </div>
                </div>
              </div>

              {(mission as any)?.endPhotos && Array.isArray((mission as any).endPhotos) && (mission as any).endPhotos.length > 0 ? (
                <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-100">
                    <h2 className="text-sm font-bold text-slate-800">Photos fin de chantier</h2>
                  </div>
                  <div className="p-5">
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                      {(mission as any).endPhotos.map((url: string, i: number) => (
                        <a
                          key={i}
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          className="aspect-square rounded-xl overflow-hidden border border-slate-200 bg-slate-50"
                          title="Ouvrir"
                        >
                          <img src={url} alt="Photo chantier" className="w-full h-full object-cover" />
                        </a>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="lg:col-span-4 space-y-6">
              <div className="bg-white border border-slate-200 rounded-2xl p-5">
                <h3 className="text-sm font-bold text-slate-800">Prestataire</h3>
                <div className="mt-3 text-sm">
                  <p className="text-slate-700 font-bold">{mission.providerName || (provider ? `${provider.firstName} ${provider.lastName}` : 'À assigner')}</p>
                  <p className="text-xs text-slate-600 mt-1">{provider?.email || '—'}</p>
                  <p className="text-xs text-slate-600">{provider?.phone || '—'}</p>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-5">
                <h3 className="text-sm font-bold text-slate-800">Actions</h3>
                <div className="mt-3 flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => navigate('/planning')}
                    className="w-full px-4 py-2 rounded-xl bg-slate-900 text-white font-bold hover:opacity-95 transition"
                  >
                    Aller au planning
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('/reports')}
                    className="w-full px-4 py-2 rounded-xl bg-slate-100 text-slate-800 font-bold hover:bg-slate-200 transition"
                  >
                    Voir les rapports
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default AdminMissionDetails;

