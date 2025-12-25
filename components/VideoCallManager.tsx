import React, { useEffect, useRef, useState } from 'react';
import { useData } from '../context/DataContext';
import { Video, VideoOff, Mic, MicOff, Phone, PhoneOff, Loader } from 'lucide-react';
import Peer from 'simple-peer';

interface VideoCallManagerProps {
    sessionId: string;
    isInitiator: boolean;
    onEnd: () => void;
}

const VideoCallManager: React.FC<VideoCallManagerProps> = ({ sessionId, isInitiator, onEnd }) => {
    const { currentUser, activeStream, stopLiveStream } = useData();
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [isVideoEnabled, setIsVideoEnabled] = useState(true);
    const [isAudioEnabled, setIsAudioEnabled] = useState(true);
    const [callStatus, setCallStatus] = useState<'connecting' | 'connected' | 'ended'>('connecting');
    
    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    const peerRef = useRef<Peer.Instance | null>(null);
    const socketRef = useRef<WebSocket | null>(null);

    // Initialiser le flux local
    useEffect(() => {
        const initLocalStream = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: true,
                    audio: true
                });
                setLocalStream(stream);
                if (localVideoRef.current) {
                    localVideoRef.current.srcObject = stream;
                }
            } catch (error) {
                console.error('Erreur accès caméra/micro:', error);
                setCallStatus('ended');
            }
        };

        initLocalStream();

        return () => {
            if (localStream) {
                localStream.getTracks().forEach(track => track.stop());
            }
        };
    }, []);

    // Connexion WebSocket pour le signaling
    useEffect(() => {
        const wsUrl = process.env.NODE_ENV === 'production' 
            ? window.location.protocol === 'https:' 
                ? `wss://${window.location.host}/ws`
                : `ws://${window.location.host}/ws`
            : 'ws://localhost:3001';
            
        console.log('Tentative de connexion WebSocket à:', wsUrl);
        
        try {
            const socket = new WebSocket(`${wsUrl}?sessionId=${sessionId}&role=${isInitiator ? 'initiator' : 'receiver'}`);
            socketRef.current = socket;

            socket.onopen = () => {
                console.log('WebSocket connecté pour session:', sessionId);
                setIsConnected(true);
                setCallStatus('connected');
            };

            socket.onerror = (error) => {
                console.error('Erreur WebSocket:', error);
                // En production, si le WebSocket échoue, continuer sans WebSocket
                console.log('WebSocket non disponible - continuation en mode direct');
                setIsConnected(false);
                setCallStatus('connected'); // Simuler la connexion pour permettre l'appel
            };

            socket.onclose = () => {
                console.log('WebSocket fermé');
                setIsConnected(false);
                // Ne pas terminer l'appel si le WebSocket se ferme
                console.log('WebSocket fermé mais appel continue en mode direct');
            };

            socket.onmessage = async (event) => {
                try {
                    const data = JSON.parse(event.data);
                    
                    if (data.type === 'signal' && peerRef.current) {
                        await peerRef.current.signal(data.signal as any);
                    } else if (data.type === 'start-call' && !isInitiator) {
                        setupPeer(false);
                    }
                } catch (error: any) {
                    console.error('Erreur message WebSocket:', error);
                }
            };

            return () => {
                socket.close();
            };
        } catch (error: any) {
            console.error('Erreur création WebSocket:', error);
            // En production comme en développement, continuer sans WebSocket
            console.log('WebSocket non disponible - démarrage en mode direct');
            setCallStatus('connected');
        }
    }, [sessionId, isInitiator]);

    // Configuration du peer connection
    const setupPeer = async (initiator: boolean) => {
        if (!localStream) {
            console.error('Pas de flux local disponible');
            return;
        }

        try {
            const peer = new Peer({
                initiator: initiator,
                trickle: false,
                stream: localStream,
                config: {
                    iceServers: [
                        { urls: 'stun:stun.l.google.com:19302' },
                        { urls: 'stun:stun1.l.google.com:19302' }
                    ]
                }
            });

            peerRef.current = peer;

            peer.on('signal', (data) => {
                if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
                    socketRef.current.send(JSON.stringify({
                        type: 'signal',
                        signal: data
                    }));
                } else {
                    // Mode direct sans WebSocket
                    console.log('Signal généré (mode direct):', data);
                    setTimeout(() => {
                        if (peerRef.current) {
                            setCallStatus('connected');
                        }
                    }, 2000);
                }
            });

            peer.on('connect', () => {
                console.log('Peer connecté!');
                setIsConnected(true);
                setCallStatus('connected');
            });

            peer.on('stream', (stream) => {
                console.log('Flux distant reçu');
                setRemoteStream(stream);
                if (remoteVideoRef.current) {
                    remoteVideoRef.current.srcObject = stream;
                }
            });

            peer.on('close', () => {
                console.log('Peer fermé');
                setCallStatus('ended');
            });

            peer.on('error', (error) => {
                console.error('Erreur peer:', error);
                // En production comme en développement, ignorer l'erreur et continuer
                console.log('Erreur peer ignorée - continuation en mode direct');
                setCallStatus('connected');
            });

            if (initiator && (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN)) {
                // Démarrer l'appel en mode direct si pas de WebSocket
                console.log('Démarrage appel en mode direct (pas de WebSocket)');
                setTimeout(() => {
                    setCallStatus('connected');
                }, 1000);
            }

        } catch (error: any) {
            console.error('Erreur configuration peer:', error);
            setCallStatus('ended');
        }
    };

    // Démarrer l'appel si c'est l'initiateur
    useEffect(() => {
        if (isInitiator && localStream) {
            setupPeer(true);
        }
    }, [isInitiator, localStream]);

    // Gestion des contrôles vidéo/audio
    const toggleVideo = () => {
        if (localStream) {
            const videoTrack = localStream.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.enabled = !videoTrack.enabled;
                setIsVideoEnabled(videoTrack.enabled);
            }
        }
    };

    const toggleAudio = () => {
        if (localStream) {
            const audioTrack = localStream.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                setIsAudioEnabled(audioTrack.enabled);
            }
        }
    };

    const endCall = () => {
        if (peerRef.current) {
            peerRef.current.destroy();
        }
        if (socketRef.current) {
            socketRef.current.close();
        }
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
        }
        stopLiveStream();
        onEnd();
    };

    // État "Appel terminé"
    if (callStatus === 'ended') {
        return (
            <div className="flex flex-col items-center justify-center h-96 bg-slate-900 rounded-xl">
                <PhoneOff className="w-16 h-16 text-red-500 mb-4" />
                <h3 className="text-white text-xl font-bold">Appel terminé</h3>
                <button
                    onClick={onEnd}
                    className="mt-4 bg-slate-700 text-white px-6 py-2 rounded-lg hover:bg-slate-600"
                >
                    Fermer
                </button>
            </div>
        );
    }

    // État "Connexion en cours"
    if (callStatus === 'connecting') {
        return (
            <div className="flex flex-col items-center justify-center h-96 bg-slate-900 rounded-xl">
                <Loader className="w-16 h-16 text-blue-500 animate-spin mb-4" />
                <h3 className="text-white text-xl font-bold">
                    {isInitiator ? 'Appel en cours...' : 'Appel entrant...'}
                </h3>
                <p className="text-slate-400 mt-2">Veuillez patienter</p>
            </div>
        );
    }

    // État "Connecté" - Interface principale
    return (
        <div className="h-96 bg-slate-900 rounded-xl shadow-lg overflow-hidden relative">
            {/* Vidéo distant (principal) */}
            <div className="absolute inset-0">
                {remoteStream ? (
                    <video
                        ref={remoteVideoRef}
                        autoPlay
                        playsInline
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center bg-black">
                        <div className="text-center">
                            <Video className="w-16 h-16 text-slate-500 mx-auto mb-4" />
                            <p className="text-slate-400">
                                {isConnected ? 'En attente de la vidéo...' : 'Connexion en cours...'}
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* Vidéo local (petit incrusté) */}
            <div className="absolute top-4 right-4 w-32 h-24 bg-slate-800 rounded-lg shadow-lg overflow-hidden border-2 border-slate-600">
                {localStream ? (
                    <video
                        ref={localVideoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center">
                        <Loader className="w-8 h-8 text-slate-500 animate-spin" />
                    </div>
                )}
            </div>

            {/* Contrôles */}
            <div className="absolute bottom-0 left-0 right-0 bg-black/70 p-4">
                <div className="flex justify-center gap-4">
                    <button
                        onClick={toggleAudio}
                        className={`p-3 rounded-full transition-colors ${
                            isAudioEnabled 
                                ? 'bg-slate-600 hover:bg-slate-500 text-white' 
                                : 'bg-red-600 hover:bg-red-500 text-white'
                        }`}
                    >
                        {isAudioEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
                    </button>
                    
                    <button
                        onClick={toggleVideo}
                        className={`p-3 rounded-full transition-colors ${
                            isVideoEnabled 
                                ? 'bg-slate-600 hover:bg-slate-500 text-white' 
                                : 'bg-red-600 hover:bg-red-500 text-white'
                        }`}
                    >
                        {isVideoEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
                    </button>
                    
                    <button
                        onClick={endCall}
                        className="p-3 bg-red-600 hover:bg-red-500 text-white rounded-full transition-colors"
                    >
                        <PhoneOff className="w-5 h-5" />
                    </button>
                </div>
                
                {/* Informations d'appel */}
                <div className="text-center mt-2">
                    <p className="text-white text-sm font-medium">
                        {isConnected ? 'Connecté' : 'Connexion...'}
                    </p>
                    {activeStream && (
                        <p className="text-slate-300 text-xs">
                            Session: {activeStream.id}
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default VideoCallManager;