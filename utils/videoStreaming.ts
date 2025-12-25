// Configuration pour le streaming vidéo
export interface StreamConfig {
    iceServers: RTCIceServer[];
    constraints: MediaStreamConstraints;
}

export const defaultStreamConfig: StreamConfig = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' }
    ],
    constraints: {
        video: {
            width: { ideal: 1280, max: 1920 },
            height: { ideal: 720, max: 1080 },
            frameRate: { ideal: 30, max: 60 },
            facingMode: 'user'
        },
        audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            sampleRate: 48000
        }
    }
};

export class VideoStreamManager {
    private localStream: MediaStream | null = null;
    private peerConnection: RTCPeerConnection | null = null;
    private remoteStream: MediaStream | null = null;
    private config: StreamConfig;

    constructor(config: StreamConfig = defaultStreamConfig) {
        this.config = config;
    }

    async startLocalStream(): Promise<MediaStream> {
        try {
            // Arrêter le stream existant s'il y en a un
            if (this.localStream) {
                this.stopLocalStream();
            }

            // Demander l'accès à la caméra et au micro
            this.localStream = await navigator.mediaDevices.getUserMedia(this.config.constraints);
            
            return this.localStream;
        } catch (error) {
            console.error('Erreur lors du démarrage du stream local:', error);
            throw new Error('Impossible d\'accéder à la caméra et/ou au micro');
        }
    }

    stopLocalStream(): void {
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => {
                track.stop();
            });
            this.localStream = null;
        }
    }

    async createPeerConnection(): Promise<RTCPeerConnection> {
        try {
            // Arrêter la connexion existante s'il y en a une
            if (this.peerConnection) {
                this.closePeerConnection();
            }

            // Créer une nouvelle connexion peer-to-peer
            this.peerConnection = new RTCPeerConnection(this.config);

            // Ajouter les tracks du stream local
            if (this.localStream) {
                this.localStream.getTracks().forEach(track => {
                    this.peerConnection!.addTrack(track, this.localStream!);
                });
            }

            // Écouter les tracks distants
            this.peerConnection.ontrack = (event) => {
                console.log('Track distant reçu:', event);
                this.remoteStream = event.streams[0];
            };

            // Écouter les changements d'état de la connexion
            this.peerConnection.onconnectionstatechange = () => {
                console.log('État de la connexion:', this.peerConnection?.connectionState);
            };

            // Écouter les changements d'état ICE
            this.peerConnection.oniceconnectionstatechange = () => {
                console.log('État ICE:', this.peerConnection?.iceConnectionState);
            };

            return this.peerConnection;
        } catch (error) {
            console.error('Erreur lors de la création de la connexion peer-to-peer:', error);
            throw new Error('Impossible de créer la connexion vidéo');
        }
    }

    async createOffer(): Promise<RTCSessionDescriptionInit> {
        if (!this.peerConnection) {
            throw new Error('La connexion peer-to-peer n\'est pas initialisée');
        }

        try {
            const offer = await this.peerConnection.createOffer();
            await this.peerConnection.setLocalDescription(offer);
            return offer;
        } catch (error) {
            console.error('Erreur lors de la création de l\'offre:', error);
            throw new Error('Impossible de créer l\'offre vidéo');
        }
    }

    async createAnswer(offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> {
        if (!this.peerConnection) {
            throw new Error('La connexion peer-to-peer n\'est pas initialisée');
        }

        try {
            await this.peerConnection.setRemoteDescription(offer);
            const answer = await this.peerConnection.createAnswer();
            await this.peerConnection.setLocalDescription(answer);
            return answer;
        } catch (error) {
            console.error('Erreur lors de la création de la réponse:', error);
            throw new Error('Impossible de créer la réponse vidéo');
        }
    }

    async handleAnswer(answer: RTCSessionDescriptionInit): Promise<void> {
        if (!this.peerConnection) {
            throw new Error('La connexion peer-to-peer n\'est pas initialisée');
        }

        try {
            await this.peerConnection.setRemoteDescription(answer);
        } catch (error) {
            console.error('Erreur lors du traitement de la réponse:', error);
            throw new Error('Impossible de traiter la réponse vidéo');
        }
    }

    async addIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
        if (!this.peerConnection) {
            throw new Error('La connexion peer-to-peer n\'est pas initialisée');
        }

        try {
            await this.peerConnection.addIceCandidate(candidate);
        } catch (error) {
            console.error('Erreur lors de l\'ajout du candidat ICE:', error);
            // Ne pas lancer d'erreur pour les candidats ICE
        }
    }

    closePeerConnection(): void {
        if (this.peerConnection) {
            this.peerConnection.close();
            this.peerConnection = null;
        }
        this.remoteStream = null;
    }

    getLocalStream(): MediaStream | null {
        return this.localStream;
    }

    getRemoteStream(): MediaStream | null {
        return this.remoteStream;
    }

    getConnectionState(): RTCPeerConnectionState | null {
        return this.peerConnection?.connectionState || null;
    }

    isStreaming(): boolean {
        return this.localStream !== null && this.localStream.active;
    }

    // Méthodes utilitaires pour l'enregistrement
    async startRecording(stream: MediaStream, duration: number = 0): Promise<MediaRecorder> {
        try {
            const options: MediaRecorderOptions = {
                mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus') 
                    ? 'video/webm;codecs=vp9,opus' 
                    : 'video/webm'
            };

            const mediaRecorder = new MediaRecorder(stream, options);
            const chunks: Blob[] = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    chunks.push(event.data);
                }
            };

            mediaRecorder.onstop = () => {
                const blob = new Blob(chunks, { type: mediaRecorder.mimeType });
                console.log('Enregistrement terminé, taille:', blob.size);
            };

            mediaRecorder.start(1000); // Enregistrer par intervalles de 1 seconde

            // Arrêter automatiquement après la durée spécifiée
            if (duration > 0) {
                setTimeout(() => {
                    if (mediaRecorder.state === 'recording') {
                        mediaRecorder.stop();
                    }
                }, duration);
            }
            
            return mediaRecorder;
        } catch (error) {
            console.error('Erreur lors de l\'enregistrement:', error);
            throw new Error('Impossible de démarrer l\'enregistrement vidéo');
        }
    }

    // Vérifier la compatibilité du navigateur
    static isSupported(): boolean {
        return !!(navigator.mediaDevices && 
                 navigator.mediaDevices.getUserMedia !== undefined && 
                 window.RTCPeerConnection);
    }

    // Obtenir les permissions
    static async checkPermissions(): Promise<{ camera: boolean; microphone: boolean }> {
        try {
            const cameraPermission = await navigator.permissions.query({ name: 'camera' as PermissionName });
            const microphonePermission = await navigator.permissions.query({ name: 'microphone' as PermissionName });
            
            return {
                camera: cameraPermission.state === 'granted',
                microphone: microphonePermission.state === 'granted'
            };
        } catch (error) {
            console.warn('Impossible de vérifier les permissions:', error);
            return { camera: false, microphone: false };
        }
    }
}
