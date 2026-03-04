ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS initial_password TEXT;

ALTER TABLE public.providers
ADD COLUMN IF NOT EXISTS initial_password TEXT;
