-- CORRECTIF immédiat : "permission denied for table employment_contracts"
-- La migration 20260930_add_employment_contracts.sql a été exécutée sans les
-- GRANTs ; RLS ne suffit pas, PostgREST (rôle authenticated) a besoin de
-- privilèges explicites sur la table. À exécuter une seule fois dans le
-- Supabase SQL Editor (ou psql en superutilisateur). Idempotent.

GRANT SELECT ON public.employment_contracts TO anon, authenticated, service_role;
GRANT INSERT ON public.employment_contracts TO authenticated, service_role;
GRANT UPDATE ON public.employment_contracts TO authenticated, service_role;
GRANT DELETE ON public.employment_contracts TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
