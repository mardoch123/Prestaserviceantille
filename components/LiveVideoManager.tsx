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
        startLiveStream,
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

    const handleStartStream = async () => {
        if (!selectedClientId || !selectedProviderId) {
            alert('Veuillez sélectionner un client et un prestataire');
            return;
        }

        try {
            await startLiveStream(selectedProviderId, selectedClientId);
            setIsPlaying(true);
        } catch (error) {
            console.error('Error starting stream:', error);
            alert('Erreur lors du démarrage du stream');
        }
    };

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
                <h2 className="text-3xl font-serif font-bold text-slate-800 mb-2">Vidéos en Direct</h2>
                <p className="text-sm text-slate-500">
                    Gestion des streams vidéo en direct et enregistrements des prestations
                </p>
            </div>

            {/* Live Stream Section */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-8">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <Wifi className={`w-5 h-5 ${activeStream ? 'text-red-500 animate-pulse' : 'text-slate-400'}`} />
                        Stream en Direct
                    </h3>
                    {activeStream && (
                        <div className="flex items-center gap-2 text-sm text-red-600 font-bold">
                            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                            EN DIRECT
                        </div>
                    )}
                </div>

                {/* Stream Controls */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Client</label>
                        <select
                            value={selectedClientId}
                            onChange={(e) => setSelectedClientId(e.target.value)}
                            className="w-full p-2 border border-slate-200 rounded-lg text-sm"
                            disabled={!!activeStream}
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
                            disabled={!!activeStream}
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

                {/* Video Player */}
                <div
                    ref={containerRef}
                    className={`relative bg-black rounded-lg overflow-hidden ${isFullscreen ? 'fixed inset-0 z-50' : 'aspect-video'}`}
                >
                    {activeStream ? (
                        <>
                            <video
                                ref={videoRef}
                                className="w-full h-full object-cover"
                                autoPlay
                                playsInline
                                muted={isMuted}
                            />
                            
                            {/* Video Controls Overlay */}
                            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
                                <div className="flex items-center justify-between text-white">
                                    <div className="flex items-center gap-4">
                                        <button
                                            onClick={toggleMute}
                                            className="p-2 hover:bg-white/20 rounded-full transition"
                                        >
                                            {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                                        </button>
                                        <div className="flex items-center gap-2 text-sm">
                                            <Users className="w-4 h-4" />
                                            <span>
                                                {clients.find(c => c.id === activeStream.clientId)?.name} × 
                                                {providers.find(p => p.id === activeStream.providerId)?.firstName} {providers.find(p => p.id === activeStream.providerId)?.lastName}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={toggleFullscreen}
                                            className="p-2 hover:bg-white/20 rounded-full transition"
                                        >
                                            {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
                                        </button>
                                        <button
                                            onClick={handleStopStream}
                                            className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition"
                                        >
                                            <X className="w-4 h-4" /> Arrêter
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Live Indicator */}
                            <div className="absolute top-4 left-4 bg-red-600 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-2">
                                <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                                LIVE
                            </div>
                        </>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-white/60">
                            <Video className="w-16 h-16 mb-4" />
                            <p className="text-lg font-medium mb-2">Aucun stream en cours</p>
                            <p className="text-sm text-white/40 mb-6">
                                Sélectionnez un client et un prestataire pour commencer
                            </p>
                            <button
                                onClick={handleStartStream}
                                disabled={!selectedClientId || !selectedProviderId}
                                className="bg-brand-blue hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed px-6 py-3 rounded-lg font-bold flex items-center gap-2 transition"
                            >
                                <Play className="w-5 h-5" /> Démarrer le Stream
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Recordings Section */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <Monitor className="w-5 h-5" />
                        Enregistrements Vidéo
                    </h3>
                    <div className="flex items-center gap-2 text-sm text-slate-500">
                        <span>{filteredRecordings.length} enregistrement{filteredRecordings.length > 1 ? 's' : ''}</span>
                    </div>
                </div>

                {/* Filters */}
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
                                    {client.name}
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
                <div className="space-y-4">
                    {filteredRecordings.length === 0 ? (
                        <div className="text-center py-12 text-slate-400">
                            <Monitor className="w-12 h-12 mx-auto mb-4 opacity-50" />
                            <p>Aucun enregistrement trouvé</p>
                            <p className="text-sm mt-2">Les enregistrements apparaîtront ici après les streams</p>
                        </div>
                    ) : (
                        filteredRecordings.map(recording => (
                            <div key={recording.id} className="flex items-center justify-between p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                                        <Video className="w-6 h-6 text-blue-600" />
                                    </div>
                                    <div>
                                        <div className="font-medium text-slate-800">
                                            {clients.find(c => c.id === recording.clientId)?.name} × 
                                            {providers.find(p => p.id === recording.providerId)?.firstName} {providers.find(p => p.id === recording.providerId)?.lastName}
                                        </div>
                                        <div className="text-sm text-slate-500 flex items-center gap-4">
                                            <span className="flex items-center gap-1">
                                                <Clock className="w-3 h-3" />
                                                {new Date(recording.startTime).toLocaleString('fr-FR')}
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <MapPin className="w-3 h-3" />
                                                {clients.find(c => c.id === recording.clientId)?.city}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className={`text-xs px-2 py-1 rounded font-bold ${
                                        recording.status === 'ready' ? 'bg-green-100 text-green-700' :
                                        recording.status === 'processing' ? 'bg-yellow-100 text-yellow-700' :
                                        'bg-slate-100 text-slate-700'
                                    }`}>
                                        {recording.status === 'ready' ? 'Terminé' :
                                         recording.status === 'processing' ? 'En traitement' : 'En attente'}
                                    </span>
                                    <button
                                        className="p-2 hover:bg-slate-100 rounded-lg transition"
                                        title="Voir la vidéo"
                                    >
                                        <Play className="w-4 h-4 text-slate-600" />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

export default LiveVideoManager;
