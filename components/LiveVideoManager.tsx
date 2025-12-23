import React, { useState, useEffect, useRef } from 'react';
import { useData } from '../context/DataContext';
import {
    Video,
    Wifi,
    Camera,
    Monitor,
    Play,
    Pause,
    Volume2,
    VolumeX,
    Maximize,
    Minimize,
    RefreshCw,
    Users,
    MapPin,
    Clock,
    X,
    AlertCircle,
    CheckCircle
} from 'lucide-react';

const LiveVideoManager: React.FC = () => {
    const {
        activeStream,
        stopLiveStream,
        videoRecordings,
        getVideoRecordings,
        clients,
        providers
    } = useData();

    const [selectedClientId, setSelectedClientId] = useState<string>('');
    const [selectedProviderId, setSelectedProviderId] = useState<string>('');
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Get all video recordings
    const allRecordings = getVideoRecordings();

    // Filter recordings by client or provider
    const filteredRecordings = allRecordings.filter(recording => {
        if (selectedClientId && recording.clientId !== selectedClientId) return false;
        if (selectedProviderId && recording.providerId !== selectedProviderId) return false;
        return true;
    });

    const handleStopStream = async () => {
        try {
            await stopLiveStream();
            setIsPlaying(false);
        } catch (error) {
            console.error('Error stopping stream:', error);
        }
    };

    const toggleFullscreen = () => {
        if (!containerRef.current) return;

        if (!isFullscreen) {
            containerRef.current.requestFullscreen?.();
        } else {
            document.exitFullscreen?.();
        }
        setIsFullscreen(!isFullscreen);
    };

    const toggleMute = () => {
        if (videoRef.current) {
            videoRef.current.muted = !isMuted;
            setIsMuted(!isMuted);
        }
    };

    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };

        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, []);

    return (
        <div className="p-8 h-full overflow-y-auto bg-white/40">
            <div className="mb-8">
                <h2 className="text-3xl font-serif font-bold text-slate-800 mb-2">Suivi des Appels Vidéo</h2>
                <p className="text-sm text-slate-500">
                    Suivi des appels vidéo en direct et consultation des historiques
                </p>
            </div>

            {/* Live Stream Section - Lecture seule */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-8">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <Wifi className={`w-5 h-5 ${activeStream ? 'text-red-500 animate-pulse' : 'text-slate-400'}`} />
                        Appel en Direct
                    </h3>
                    {activeStream && (
                        <div className="flex items-center gap-2 text-sm text-red-600 font-bold">
                            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                            EN DIRECT
                        </div>
                    )}
                </div>

                {/* Stream Information */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Client</label>
                        <select
                            value={selectedClientId}
                            onChange={(e) => setSelectedClientId(e.target.value)}
                            className="w-full p-2 border border-slate-200 rounded-lg text-sm"
                        >
                            <option value="">-- Sélectionner un client --</option>
                            {clients.map(client => (
                                <option key={client.id} value={client.id}>
                                    {client.name} - {client.city}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Prestataire</label>
                        <select
                            value={selectedProviderId}
                            onChange={(e) => setSelectedProviderId(e.target.value)}
                            className="w-full p-2 border border-slate-200 rounded-lg text-sm"
                        >
                            <option value="">-- Sélectionner un prestataire --</option>
                            {providers.map(provider => (
                                <option key={provider.id} value={provider.id}>
                                    {provider.firstName} {provider.lastName}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Video Player - Lecture seule */}
                <div
                    ref={containerRef}
                    className={`relative bg-black rounded-lg overflow-hidden ${isFullscreen ? 'fixed inset-0 z-50' : 'aspect-video'}`}
                >
                    {activeStream ? (
                        <div className="relative w-full h-full">
                            <video
                                ref={videoRef}
                                className="w-full h-full object-contain"
                                autoPlay
                                playsInline
                                muted={isMuted}
                            />
                            <div className="absolute top-4 right-4 flex items-center gap-2">
                                <button
                                    onClick={toggleMute}
                                    className="bg-black/50 text-white p-2 rounded-full hover:bg-black/70 transition"
                                >
                                    {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                                </button>
                                <button
                                    onClick={toggleFullscreen}
                                    className="bg-black/50 text-white p-2 rounded-full hover:bg-black/70 transition"
                                >
                                    {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
                                </button>
                            </div>
                            <div className="absolute bottom-4 left-4 bg-black/50 text-white px-3 py-1 rounded text-sm">
                                {(() => {
                                    const client = clients.find(c => c.id === activeStream.clientId);
                                    const provider = providers.find(p => p.id === activeStream.providerId);
                                    return `${client?.name || 'Client'} ↔ ${provider?.firstName || 'Prestataire'} ${provider?.lastName || ''}`;
                                })()}
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-white/50">
                            <Wifi className="w-16 h-16 mx-auto mb-4 opacity-20" />
                            <h3 className="text-xl font-bold text-slate-400">Aucun Appel en Cours</h3>
                            <p className="text-sm mb-4">Les appels vidéo apparaîtront ici lorsqu'ils seront démarrés par les prestataires.</p>
                        </div>
                    )}
                </div>

                {/* Emergency Stop Button */}
                {activeStream && (
                    <div className="mt-4 flex justify-center">
                        <button
                            onClick={handleStopStream}
                            className="bg-red-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-red-700 transition flex items-center gap-2"
                        >
                            <X className="w-4 h-4" />
                            Arrêter d'urgence
                        </button>
                    </div>
                )}
            </div>

            {/* Recordings Section */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <Monitor className="w-5 h-5 text-slate-600" />
                        Historique des Appels
                    </h3>
                    <div className="text-sm text-slate-500">
                        {filteredRecordings.length} enregistrement(s)
                    </div>
                </div>

                {/* Filter Controls */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Filtrer par client</label>
                        <select
                            value={selectedClientId}
                            onChange={(e) => setSelectedClientId(e.target.value)}
                            className="w-full p-2 border border-slate-200 rounded-lg text-sm"
                        >
                            <option value="">Tous les clients</option>
                            {clients.map(client => (
                                <option key={client.id} value={client.id}>
                                    {client.name} - {client.city}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Filtrer par prestataire</label>
                        <select
                            value={selectedProviderId}
                            onChange={(e) => setSelectedProviderId(e.target.value)}
                            className="w-full p-2 border border-slate-200 rounded-lg text-sm"
                        >
                            <option value="">Tous les prestataires</option>
                            {providers.map(provider => (
                                <option key={provider.id} value={provider.id}>
                                    {provider.firstName} {provider.lastName}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Recordings List */}
                <div className="space-y-3">
                    {filteredRecordings.length > 0 ? (
                        filteredRecordings.map(recording => {
                            const client = clients.find(c => c.id === recording.clientId);
                            const provider = providers.find(p => p.id === recording.providerId);
                            return (
                                <div key={recording.id} className="border border-slate-200 rounded-lg p-4 hover:bg-slate-50 transition">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                                                <Video className="w-5 h-5 text-blue-600" />
                                            </div>
                                            <div>
                                                <div className="font-medium text-slate-800">
                                                    {client?.name || 'Client'} ↔ {provider?.firstName || 'Prestataire'} {provider?.lastName || ''}
                                                </div>
                                                <div className="text-sm text-slate-500">
                                                    {new Date(recording.startTime).toLocaleDateString('fr-FR')} à {new Date(recording.startTime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                                                {recording.duration} min
                                            </span>
                                            <button className="text-blue-600 hover:text-blue-800 text-sm font-medium">
                                                Voir
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <div className="text-center py-8 text-slate-400">
                            <Video className="w-12 h-12 mx-auto mb-3 opacity-20" />
                            <p>Aucun enregistrement trouvé</p>
                            <p className="text-xs mt-1">Les enregistrements apparaîtront ici après les appels vidéo</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default LiveVideoManager;
