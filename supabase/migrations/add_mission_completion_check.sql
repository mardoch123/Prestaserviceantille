-- Suivi post-prestation : email de confirmation envoyé au prestataire
-- 2h après la fin de mission si celle-ci n'est pas déclarée terminée.
-- Ces colonnes sont utilisées par DataContext.tsx et l'edge function
-- mission-completion-check mais n'existaient pas encore dans les migrations.

ALTER TABLE public.missions
ADD COLUMN IF NOT EXISTS completion_check_sent BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS completion_check_sent_at TIMESTAMPTZ;

-- Index partiel pour sélectionner rapidement les missions en attente de vérification
CREATE INDEX IF NOT EXISTS idx_missions_completion_check_pending
ON public.missions(date)
WHERE completion_check_sent IS NOT TRUE;
