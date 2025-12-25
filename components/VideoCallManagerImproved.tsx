import React, { useEffect, useRef, useState } from 'react';
import { useData } from '../context/DataContext';
import { 
  Video, 
  VideoOff, 
  Mic, 
  MicOff, 
  Phone, 
  PhoneOff, 
  Loader,
  Monitor,
  MonitorOff 
} from 'lucide-react';
import {
  LiveKitRoom,
  VideoConference,
  GridLayout,
  ParticipantTile,
  useTracks,
  useLocalParticipant,
  useConnectionState,
  ConnectionState,
  useDataChannel,
  useRoomContext,
} from '@livekit/components-react';
import { RoomEvent, RoomOptions, Room, Track } from 'livekit-client';

interface VideoCallManagerProps {
  sessionId: string;
  isInitiator: boolean;
  onEnd: () => void;
}

const VideoCallManagerImproved: React.FC<VideoCallManagerProps> = ({ sessionId, isInitiator, onEnd }) => {
  const { currentUser, activeStream, stopLiveStream } = useData();
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isScreenShareEnabled, setIsScreenShareEnabled] = useState(false);
  const [useLiveKit, setUseLiveKit] = useState(false);
  const [token, setToken] = useState<string>('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string>('');
  const [callStatus, setCallStatus] = useState<'connecting' | 'connected' | 'ended'>('connecting');
  
  const roomRef = useRef<Room | null>(null);
  const localParticipantRef = useRef<any>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);

  // URL du serveur LiveKit (désactivé pour le moment)
  const LIVEKIT_SERVER_URL = process.env.NODE_ENV === 'production' 
    ? 'wss://votre-livekit-server.com' 
    : 'ws://localhost:8080';

  // Initialisation du flux local
  useEffect(() => {
    const initLocalStream = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true
        });
        localStreamRef.current = stream;
        setCallStatus('connected');
      } catch (error) {
        console.error('Erreur accès caméra/micro:', error);
        setError('Impossible d\'accéder à la caméra et au micro');
      }
    };

    initLocalStream();

    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Configuration WebRTC simple (fallback)
  const setupWebRTCConnection = async () => {
    if (!localStreamRef.current) return;

    try {
      const configuration = {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      };

      const peerConnection = new RTCPeerConnection(configuration);
      peerConnectionRef.current = peerConnection;

      // Ajouter les flux locaux
      localStreamRef.current.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStreamRef.current!);
      });

      // Gérer les flux distants
      peerConnection.ontrack = (event) => {
        remoteStreamRef.current = event.streams[0];
      };

      peerConnection.oniceconnectionstatechange = () => {
        console.log('ICE connection state:', peerConnection.iceConnectionState);
        if (peerConnection.iceConnectionState === 'connected') {
          setCallStatus('connected');
        }
      };

      // Si c'est l'initiateur, créer une offre
      if (isInitiator) {
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        
        // Envoyer l'offre via le signaling ( WebSocket ou autre )
        console.log('Offer created:', offer);
      }

    } catch (error) {
      console.error('Erreur WebRTC:', error);
      setError('Erreur de connexion vidéo');
    }
  };

  useEffect(() => {
    if (localStreamRef.current) {
      setupWebRTCConnection();
    }
  }, [localStreamRef.current, isInitiator]);

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoEnabled(videoTrack.enabled);
      }
    }
  };

  const toggleAudio = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioEnabled(audioTrack.enabled);
      }
    }
  };

  const endCall = () => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
    }
    stopLiveStream();
    setCallStatus('ended');
    onEnd();
  };

  // État de connexion
  if (callStatus === 'connecting') {
    return (
      <div className="flex flex-col items-center justify-center h-96 bg-slate-900 rounded-xl">
        <Loader className="w-16 h-16 text-blue-500 animate-spin mb-4" />
        <h3 className="text-white text-xl font-bold">Connexion en cours...</h3>
        <p className="text-slate-400 mt-2">Veuillez patienter</p>
      </div>
    );
  }

  // Erreur de connexion
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-96 bg-slate-900 rounded-xl">
        <PhoneOff className="w-16 h-16 text-red-500 mb-4" />
        <h3 className="text-white text-xl font-bold">Erreur de connexion</h3>
        <p className="text-slate-400 mt-2">{error}</p>
        <button
          onClick={onEnd}
          className="mt-4 bg-slate-700 text-white px-6 py-2 rounded-lg hover:bg-slate-600"
        >
          Fermer
        </button>
      </div>
    );
  }

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

  // Interface principale
  return (
    <div className="h-96 bg-slate-900 rounded-xl shadow-lg overflow-hidden relative">
      {/* Vidéo distant (principal) */}
      <div className="absolute inset-0">
        {remoteStreamRef.current ? (
          <video
            autoPlay
            playsInline
            className="w-full h-full object-cover"
            ref={(video) => {
              if (video && remoteStreamRef.current) {
                video.srcObject = remoteStreamRef.current;
              }
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-black">
            <div className="text-center">
              <Video className="w-16 h-16 text-slate-500 mx-auto mb-4" />
              <p className="text-slate-400">
                {callStatus === 'connected' ? 'En attente de la vidéo...' : 'Connexion en cours...'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Vidéo local (petit incrusté) */}
      <div className="absolute top-4 right-4 w-32 h-24 bg-slate-800 rounded-lg shadow-lg overflow-hidden border-2 border-slate-600">
        {localStreamRef.current ? (
          <video
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
            ref={(video) => {
              if (video && localStreamRef.current) {
                video.srcObject = localStreamRef.current;
              }
            }}
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
            {callStatus === 'connected' ? 'Connecté' : 'Connexion...'}
          </p>
          <p className="text-slate-300 text-xs">
            Session: {sessionId}
          </p>
        </div>
      </div>
    </div>
  );
};

export default VideoCallManagerImproved;
