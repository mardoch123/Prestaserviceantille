-- Migration: Allow admin to sign expired quotes when created_at is also updated
-- This fixes the "Quote expired: signature blocked" error for admin signatures

-- Drop existing trigger first
DROP TRIGGER IF EXISTS trigger_prevent_signing_expired_quotes ON documents;

-- Recreate the function with the fix
CREATE OR REPLACE FUNCTION prevent_signing_expired_quotes()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.type = 'Devis' AND NEW.status = 'signed' AND (OLD.status IS DISTINCT FROM 'signed') THEN
    -- Allow if created_at is also being updated (admin renewal of expired quote)
    IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RETURN NEW;
    END IF;
    IF OLD.status = 'expired' OR OLD.created_at < (now() - interval '48 hours') THEN
      RAISE EXCEPTION 'Quote expired: signature blocked';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Recreate the trigger
CREATE TRIGGER trigger_prevent_signing_expired_quotes
  BEFORE UPDATE OF status ON documents
  FOR EACH ROW
  EXECUTE FUNCTION prevent_signing_expired_quotes();

-- Also update the frontend to set created_at when renewing expired quotes for signature
-- This has been done in DocumentDetailPage.tsx and DevisFactures.tsx
