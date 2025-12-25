import React, { useState, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { Video, VideoOff, Phone, PhoneOff, Users, Eye, EyeOff, Wifi, Lock, AlertCircle, CheckCircle } from 'lucide-react';
import VideoCallManagerImproved from './VideoCallManagerImproved';

interface AdminVideoSupervisorProps {
    onClose?: () => void;
}

const AdminVideoSupervisor: React.FC<AdminVideoSupervisorProps> = ({ onClose }) => {
    const { 
        activeStream, 
        providers, 
        clients, 
        stopLiveStream, 
        currentUser,
        startLiveStream 
    } = useData();

    const [showVideoCall, setShowVideoCall] = useState(false);
    const [isSupervising, setIsSupervising] = useState(false);
    const [supervisionMode, setSupervisionMode] = useState<'watch' | 'join'>('watch');

    // Vérifier si l'admin peut superviser
    const canSupervise = currentUser?.role === 'admin' && activeStream;

    // Récupérer les informations du stream actif
    const streamProvider = activeStream ? providers.find(p => p.id === activeStream.providerId) : null;
    const streamClient = activeStream ? clients.find(c => c.id === activeStream.clientId) : null;

    // Démarrer la supervision
    const startSupervision = async (mode: 'watch' | 'join') => {
        if (!activeStream || !currentUser) return;

        try {
            setSupervisionMode(mode);
            
            if (mode === 'join') {
                // Rejoindre l'appel en tant que participant
                setShowVideoCall(true);
                setIsSupervising(true);
            } else {
                // Mode surveillance silencieuse
                setIsSupervising(true);
            }
        } catch (error: any) {
            console.error('Erreur lors du démarrage de la supervision:', error);
        }
    };

    // Arrêter la supervision
    const stopSupervision = () => {
        setShowVideoCall(false);
        setIsSupervising(false);
        if (onClose) onClose();
    };

    // Terminer l'appel (admin seulement)
    const terminateCall = async () => {
        if (!activeStream) return;

        try {
            await stopLiveStream();
            stopSupervision();
        } catch (error: any) {
            console.error('Erreur lors de la terminaison de lappel:', error);
        }
    };

    if (!canSupervise) {
        return (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <div className="text-center py-8">
                    <Eye className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <h3 className="text-lg font-bold text-slate-800 mb-2">Supervision Vidéo</h3>
                    <p className="text-slate-600 mb-4">Aucun appel vidéo en cours à superviser.</p>
                    <p className="text-sm text-slate-500">
                        Les appels vidéo actifs apparaîtront ici pour supervision.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* En-tête de supervision */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="bg-red-100 p-3 rounded-full">
                            <Wifi className="w-6 h-6 text-red-600 animate-pulse" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-slate-800">Appel Vidéo Actif</h3>
                            <p className="text-sm text-slate-600">Supervision en temps réel</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="px-3 py-1 bg-red-600 text-white text-xs font-bold rounded-full animate-pulse">
                            LIVE
                        </span>
                        {isSupervising && (
                            <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-full">
                                Supervision Active
                            </span>
                        )}
                    </div>
                </div>

                {/* Informations du stream */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                        <h4 className="font-medium text-blue-900 mb-2 flex items-center gap-2">
                            <Users className="w-4 h-4" />
                            Prestataire
                        </h4>
                        <div className="text-sm text-blue-700 space-y-1">
                            <p><strong>Nom:</strong> {streamProvider?.firstName} {streamProvider?.lastName}</p>
                            <p><strong>ID:</strong> {streamProvider?.id}</p>
                        </div>
                    </div>
                    <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
                        <h4 className="font-medium text-green-900 mb-2 flex items-center gap-2">
                            <Users className="w-4 h-4" />
                            Client
                        </h4>
                        <div className="text-sm text-green-700 space-y-1">
                            <p><strong>Nom:</strong> {streamClient?.name}</p>
                            <p><strong>ID:</strong> {streamClient?.id}</p>
                        </div>
                    </div>
                </div>

                {/* Informations techniques */}
                <div className="bg-slate-50 border border-slate-200 p-4 rounded-lg mb-6">
                    <h4 className="font-medium text-slate-700 mb-2 flex items-center gap-2">
                        <Lock className="w-4 h-4" />
                        Informations Techniques
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm text-slate-600">
                        <div>
                            <p><strong>Session ID:</strong></p>
                            <p className="font-mono text-xs">{activeStream.id}</p>
                        </div>
                        <div>
                            <p><strong>Démarré à:</strong></p>
                            <p>{new Date(activeStream.startTime).toLocaleTimeString('fr-FR', { 
                                hour: '2-digit', 
                                minute: '2-digit' 
                            })}</p>
                        </div>
                        <div>
                            <p><strong>Statut:</strong></p>
                            <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-full">
                                Actif
                            </span>
                        </div>
                    </div>
                </div>

                {/* Actions de supervision */}
                {!isSupervising ? (
                    <div className="flex gap-3">
                        <button
                            onClick={() => startSupervision('watch')}
                            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                        >
                            <Eye className="w-5 h-5" />
                            Surveillance Silencieuse
                        </button>
                        <button
                            onClick={() => startSupervision('join')}
                            className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                        >
                            <Video className="w-5 h-5" />
                            Rejoindre l'Appel
                        </button>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {supervisionMode === 'join' && showVideoCall && (
                            <VideoCallManagerImproved
                                sessionId={activeStream.id}
                                isInitiator={false}
                                onEnd={stopSupervision}
                            />
                        )}
                        
                        <div className="flex gap-3">
                            <button
                                onClick={stopSupervision}
                                className="flex-1 bg-slate-600 hover:bg-slate-700 text-white font-bold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                            >
                                <EyeOff className="w-5 h-5" />
                                Arrêter Supervision
                            </button>
                            <button
                                onClick={terminateCall}
                                className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                            >
                                <PhoneOff className="w-5 h-5" />
                                Terminer l'Appel
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Mode surveillance silencieuse */}
            {isSupervising && supervisionMode === 'watch' && (
                <div className="bg-slate-900 rounded-xl shadow-lg overflow-hidden">
                    <div className="p-4 border-b border-slate-700">
                        <div className="flex items-center justify-between text-white">
                            <div className="flex items-center gap-3">
                                <div className="w-3 h-3 bg-red-600 rounded-full animate-pulse"></div>
                                <span className="font-bold">Mode Surveillance</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-slate-400">
                                <Lock className="w-4 h-4" />
                                Invisible pour les participants
                            </div>
                        </div>
                    </div>
                    <div className="h-96 flex items-center justify-center bg-black">
                        <div className="text-center text-slate-400">
                            <Eye className="w-16 h-16 mx-auto mb-4" />
                            <h3 className="text-xl font-bold text-white mb-2">Surveillance Active</h3>
                            <p className="text-sm">Vous supervisez l'appel sans être visible</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminVideoSupervisor;
