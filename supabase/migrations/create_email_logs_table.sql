-- Création de la table email_logs pour le suivi du quota EmailJS
-- Cette table stocke tous les emails envoyés pour avoir des statistiques précises

CREATE TABLE IF NOT EXISTS public.email_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    recipient_email TEXT NOT NULL,
    subject TEXT,
    template_type TEXT,
    status TEXT CHECK (status IN ('sent', 'failed', 'pending')),
    sent_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour les requêtes courantes
CREATE INDEX IF NOT EXISTS idx_email_logs_created_at ON public.email_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON public.email_logs(status);
CREATE INDEX IF NOT EXISTS idx_email_logs_recipient ON public.email_logs(recipient_email);

-- Index composite pour la requête de quota mensuelle
CREATE INDEX IF NOT EXISTS idx_email_logs_status_created_at 
    ON public.email_logs(status, created_at) 
    WHERE status = 'sent';

-- Commentaires sur les colonnes
COMMENT ON TABLE public.email_logs IS 'Table de log pour tous les emails envoyés via EmailJS - utilisée pour le suivi du quota';
COMMENT ON COLUMN public.email_logs.recipient_email IS 'Email du destinataire';
COMMENT ON COLUMN public.email_logs.subject IS 'Sujet de l''email';
COMMENT ON COLUMN public.email_logs.template_type IS 'Type de template utilisé (ex: reminder_48h, newsletter, etc.)';
COMMENT ON COLUMN public.email_logs.status IS 'Statut: sent, failed, ou pending';
COMMENT ON COLUMN public.email_logs.sent_at IS 'Date/heure d''envoi de l''email';
COMMENT ON COLUMN public.email_logs.error_message IS 'Message d''erreur si l''envoi a échoué';
COMMENT ON COLUMN public.email_logs.created_at IS 'Date/heure de création du log';

-- Permissions
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

-- Les admins peuvent tout voir
CREATE POLICY "Admins can view all email logs" ON public.email_logs
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('admin', 'super_admin')
        )
    );

-- Les admins peuvent insérer
CREATE POLICY "Admins can insert email logs" ON public.email_logs
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('admin', 'super_admin')
        )
    );

-- Le service role peut tout faire (pour les Edge Functions)
CREATE POLICY "Service role can manage email logs" ON public.email_logs
    FOR ALL
    USING (true)
    WITH CHECK (true);
