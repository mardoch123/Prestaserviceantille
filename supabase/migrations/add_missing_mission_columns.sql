-- Add missing columns to missions table to fix planning display issues
-- These columns are used in DataContext.tsx but were missing from previous migrations

ALTER TABLE public.missions 
ADD COLUMN IF NOT EXISTS start_remark TEXT,
ADD COLUMN IF NOT EXISTS end_remark TEXT,
ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
ADD COLUMN IF NOT EXISTS late_cancellation BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS reminder_48h_sent BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS reminder_72h_sent BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS reminder_24h_provider_sent BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS report_sent BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS source_document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL;

-- Index for source_document_id for performance
CREATE INDEX IF NOT EXISTS idx_missions_source_document_id ON public.missions(source_document_id);
