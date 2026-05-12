-- Add quantity column to packs table
ALTER TABLE packs ADD COLUMN IF NOT EXISTS quantity TEXT;
