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

const VideoCallManagerLiveKit: React.FC<VideoCallManagerProps> = ({ sessionId, isInitiator, onEnd }) => {
  const { currentUser, activeStream, stopLiveStream } = useData();
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isScreenShareEnabled, setIsScreenShareEnabled] = useState(false);
  const [token, setToken] = useState<string>('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string>('');
  
  const roomRef = useRef<Room | null>(null);
  const localParticipantRef = useRef<any>(null);

  // URL du serveur LiveKit (à configurer selon votre environnement)
  const LIVEKIT_SERVER_URL = process.env.NODE_ENV === 'production' 
    ? 'wss://votre-livekit-server.com' 
    : 'ws://localhost:8080';

  // Génération de token (à implémenter côté serveur)
  useEffect(() => {
    const generateToken = async () => {
      try {
        setIsConnecting(true);
        setError('');
        
        // Simulation - à remplacer par un appel API réel
        const response = await fetch('/api/livekit/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roomName: sessionId,
            participantName: currentUser?.name || 'Anonymous',
            isInitiator
          })
        });
        
        if (!response.ok) {
          throw new Error('Failed to generate token');
        }
        
        const data = await response.json();
        setToken(data.token);
      } catch (err) {
        console.error('Error generating token:', err);
        setError('Impossible de se connecter au service vidéo');
        
        // Fallback: mode simulation pour développement
        setTimeout(() => {
          setIsConnecting(false);
          setError('');
        }, 3000);
      } finally {
        setIsConnecting(false);
      }
    };

    generateToken();
  }, [sessionId, currentUser?.name, isInitiator]);

  const handleConnect = () => {
    console.log('Connecting to LiveKit room:', sessionId);
  };

  const handleDisconnect = () => {
    console.log('Disconnected from LiveKit room');
    stopLiveStream();
    onEnd();
  };

  const handleError = (error: Error) => {
    console.error('LiveKit connection error:', error);
    setError('Erreur de connexion vidéo');
  };

  const toggleVideo = () => {
    if (localParticipantRef.current) {
      const cameraTrack = localParticipantRef.current.getTrack(Track.Source.Camera);
      if (cameraTrack) {
        cameraTrack.enabled = !cameraTrack.enabled;
        setIsVideoEnabled(cameraTrack.enabled);
      }
    }
  };

  const toggleAudio = () => {
    if (localParticipantRef.current) {
      const micTrack = localParticipantRef.current.getTrack(Track.Source.Microphone);
      if (micTrack) {
        micTrack.enabled = !micTrack.enabled;
        setIsAudioEnabled(micTrack.enabled);
      }
    }
  };

  const toggleScreenShare = () => {
    if (localParticipantRef.current) {
      if (isScreenShareEnabled) {
        localParticipantRef.current.setScreenShareEnabled(false);
        setIsScreenShareEnabled(false);
      } else {
        localParticipantRef.current.setScreenShareEnabled(true);
        setIsScreenShareEnabled(true);
      }
    }
  };

  const endCall = () => {
    if (roomRef.current) {
      roomRef.current.disconnect();
    }
    stopLiveStream();
    onEnd();
  };

  // État de connexion
  if (isConnecting) {
    return (
      <div className="flex flex-col items-center justify-center h-96 bg-slate-900 rounded-xl">
        <div className="w-full max-w-xs px-6">
          <div className="animate-pulse space-y-3">
            <div className="h-6 bg-slate-700 rounded w-2/3 mx-auto" />
            <div className="h-4 bg-slate-700 rounded w-1/2 mx-auto" />
            <div className="h-10 bg-slate-800 rounded" />
          </div>
        </div>
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

  // Si pas de token, afficher l'interface de base
  if (!token) {
    return (
      <div className="flex flex-col items-center justify-center h-96 bg-slate-900 rounded-xl">
        <Video className="w-16 h-16 text-slate-500 mb-4" />
        <h3 className="text-white text-xl font-bold">Appel vidéo</h3>
        <p className="text-slate-400 mt-2">Session: {sessionId}</p>
        <div className="mt-4 flex gap-2">
          <button
            onClick={endCall}
            className="bg-red-600 hover:bg-red-500 text-white px-6 py-2 rounded-lg transition-colors"
          >
            <PhoneOff className="w-5 h-5 inline mr-2" />
            Terminer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-96 bg-slate-900 rounded-xl shadow-lg overflow-hidden relative">
      <LiveKitRoom
        token={token}
        serverUrl={LIVEKIT_SERVER_URL}
        connect={true}
        onConnected={handleConnect}
        onDisconnected={handleDisconnect}
        onError={handleError}
        options={{
          adaptiveStream: true,
          dynacast: true,
        }}
      >
        <VideoConference />
        
        {/* Contrôles personnalisés */}
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
              onClick={toggleScreenShare}
              className={`p-3 rounded-full transition-colors ${
                isScreenShareEnabled 
                  ? 'bg-blue-600 hover:bg-blue-500 text-white' 
                  : 'bg-slate-600 hover:bg-slate-500 text-white'
              }`}
            >
              {isScreenShareEnabled ? <MonitorOff className="w-5 h-5" /> : <Monitor className="w-5 h-5" />}
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
              Session: {sessionId}
            </p>
            {activeStream && (
              <p className="text-slate-300 text-xs">
                LiveKit Connecté
              </p>
            )}
          </div>
        </div>
      </LiveKitRoom>
    </div>
  );
};

export default VideoCallManagerLiveKit;
