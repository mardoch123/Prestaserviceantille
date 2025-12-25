-- Création de la table video_recordings pour stocker les enregistrements vidéo des appels
CREATE TABLE IF NOT EXISTS video_recordings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id VARCHAR(255) NOT NULL UNIQUE,
    provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'recording' CHECK (status IN ('recording', 'processing', 'ready', 'failed')),
    start_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    end_time TIMESTAMP WITH TIME ZONE,
    recording_url TEXT,
    replay_url TEXT,
    duration INTEGER DEFAULT 0, -- en secondes
    file_size BIGINT DEFAULT 0, -- en octets
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Création d'un index pour les recherches rapides par session
CREATE INDEX IF NOT EXISTS idx_video_recordings_session_id ON video_recordings(session_id);

-- Création d'index pour les recherches par client
CREATE INDEX IF NOT EXISTS idx_video_recordings_client_id ON video_recordings(client_id);

-- Création d'index pour les recherches par prestataire
CREATE INDEX IF NOT EXISTS idx_video_recordings_provider_id ON video_recordings(provider_id);

-- Création d'index pour les recherches par statut
CREATE INDEX IF NOT EXISTS idx_video_recordings_status ON video_recordings(status);

-- Création d'index pour les recherches par date
CREATE INDEX IF NOT EXISTS idx_video_recordings_start_time ON video_recordings(start_time DESC);

-- Trigger pour mettre à jour automatiquement le champ updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_video_recordings_updated_at 
    BEFORE UPDATE ON video_recordings 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Politiques RLS (Row Level Security) pour la sécurité
ALTER TABLE video_recordings ENABLE ROW LEVEL SECURITY;

-- Politique pour que les prestataires voient leurs propres enregistrements
CREATE POLICY "Providers can view their own recordings" ON video_recordings
    FOR SELECT USING (auth.uid()::text = provider_id::text);

-- Politique pour que les clients voient leurs propres enregistrements
CREATE POLICY "Clients can view their own recordings" ON video_recordings
    FOR SELECT USING (auth.uid()::text = client_id::text);

-- Politique pour que les admins voient tous les enregistrements
CREATE POLICY "Admins can view all recordings" ON video_recordings
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM auth.users 
            JOIN user_profiles ON auth.users.id = user_profiles.user_id 
            WHERE user_profiles.role = 'admin' AND auth.users.id = auth.uid()
        )
    );

-- Politique pour permettre au système de créer des enregistrements
CREATE POLICY "System can create recordings" ON video_recordings
    FOR INSERT WITH CHECK (true);

-- Politique pour permettre au système de mettre à jour les enregistrements
CREATE POLICY "System can update recordings" ON video_recordings
    FOR UPDATE USING (true);

-- Commentaires pour la documentation
COMMENT ON TABLE video_recordings IS 'Stocke les enregistrements vidéo des appels entre prestataires et clients';
COMMENT ON COLUMN video_recordings.id IS 'Identifiant unique de l''enregistrement';
COMMENT ON COLUMN video_recordings.session_id IS 'Identifiant unique de la session d''appel vidéo';
COMMENT ON COLUMN video_recordings.provider_id IS 'Référence au prestataire qui a initié l''appel';
COMMENT ON COLUMN video_recordings.client_id IS 'Référence au client qui a reçu l''appel';
COMMENT ON COLUMN video_recordings.status IS 'Statut de l''enregistrement: recording, processing, ready, failed';
COMMENT ON COLUMN video_recordings.start_time IS 'Date et heure de début de l''appel';
COMMENT ON COLUMN video_recordings.end_time IS 'Date et heure de fin de l''appel';
COMMENT ON COLUMN video_recordings.recording_url IS 'URL du fichier d''enregistrement vidéo';
COMMENT ON COLUMN video_recordings.replay_url IS 'URL du replay accessible au client';
COMMENT ON COLUMN video_recordings.duration IS 'Durée de l''appel en secondes';
COMMENT ON COLUMN video_recordings.file_size IS 'Taille du fichier en octets';
