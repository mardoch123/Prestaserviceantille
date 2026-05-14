-- ============================================================
-- FIX: Password Reset System
-- Search in clients/providers tables (not auth.users)
-- Update initial_password in the correct table
-- ============================================================

-- Drop old table if exists (we'll recreate with proper schema)
DROP TABLE IF EXISTS password_reset_tokens;

CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    user_type TEXT NOT NULL CHECK (user_type IN ('client', 'provider')),
    entity_id TEXT NOT NULL,
    token VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON password_reset_tokens(token);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_email ON password_reset_tokens(email);

-- RLS
ALTER TABLE password_reset_tokens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "password_reset_tokens_all" ON password_reset_tokens;
CREATE POLICY "password_reset_tokens_all" ON password_reset_tokens
FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- Function: create_password_reset_token
-- Searches in clients AND providers tables
-- ============================================================
CREATE OR REPLACE FUNCTION create_password_reset_token(p_email TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_client RECORD;
    v_provider RECORD;
    v_token VARCHAR(255);
    v_user_type TEXT;
    v_entity_id TEXT;
    v_found_email TEXT;
BEGIN
    -- Search in clients table first
    SELECT id, email INTO v_client
    FROM clients
    WHERE email ILIKE p_email
    LIMIT 1;

    IF FOUND THEN
        v_user_type := 'client';
        v_entity_id := v_client.id::text;
        v_found_email := v_client.email;
    ELSE
        -- Search in providers table
        SELECT id, email INTO v_provider
        FROM providers
        WHERE email ILIKE p_email
        LIMIT 1;

        IF FOUND THEN
            v_user_type := 'provider';
            v_entity_id := v_provider.id::text;
            v_found_email := v_provider.email;
        ELSE
            -- Don't reveal if email exists - return success without token
            RETURN JSON_BUILD_OBJECT('success', true, 'message', 'Si cet email existe, un lien a été envoyé');
        END IF;
    END IF;

    -- Invalidate any existing tokens for this email
    UPDATE password_reset_tokens
    SET used_at = now()
    WHERE email ILIKE p_email AND used_at IS NULL;

    -- Generate random token
    v_token := encode(gen_random_bytes(32), 'hex');

    -- Insert token
    INSERT INTO password_reset_tokens (email, user_type, entity_id, token, expires_at)
    VALUES (v_found_email, v_user_type, v_entity_id, v_token, now() + interval '1 hour');

    RETURN JSON_BUILD_OBJECT(
        'success', true,
        'token', v_token,
        'email', v_found_email,
        'user_type', v_user_type
    );
END;
$$;

-- ============================================================
-- Function: reset_password_with_token
-- Updates initial_password in clients or providers table
-- Also updates Supabase Auth if the user exists there
-- ============================================================
CREATE OR REPLACE FUNCTION reset_password_with_token(p_token TEXT, p_new_password TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_token_record RECORD;
BEGIN
    -- Find valid token
    SELECT id, email, user_type, entity_id, expires_at INTO v_token_record
    FROM password_reset_tokens
    WHERE token = p_token
        AND used_at IS NULL
        AND expires_at > now()
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN JSON_BUILD_OBJECT('success', false, 'error', 'Token invalide ou expiré');
    END IF;

    -- Update initial_password in the correct table
    IF v_token_record.user_type = 'client' THEN
        UPDATE clients
        SET initial_password = p_new_password
        WHERE id::text = v_token_record.entity_id;
    ELSIF v_token_record.user_type = 'provider' THEN
        UPDATE providers
        SET initial_password = p_new_password
        WHERE id::text = v_token_record.entity_id;
    END IF;

    -- Also update Supabase Auth password if user exists there
    BEGIN
        UPDATE auth.users
        SET encrypted_password = crypt(p_new_password, gen_salt('bf')),
            updated_at = now()
        WHERE email ILIKE v_token_record.email;
    EXCEPTION WHEN others THEN
        -- Ignore if auth.users update fails (user might not exist in auth)
        NULL;
    END;

    -- Mark token as used
    UPDATE password_reset_tokens
    SET used_at = now()
    WHERE id = v_token_record.id;

    RETURN JSON_BUILD_OBJECT(
        'success', true, 
        'message', 'Mot de passe réinitialisé avec succès',
        'user_type', v_token_record.user_type
    );
END;
$$;

-- ============================================================
-- Function: verify_password_reset_token
-- Checks if a token is valid without consuming it
-- ============================================================
CREATE OR REPLACE FUNCTION verify_password_reset_token(p_token TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_token_record RECORD;
BEGIN
    SELECT id, email, user_type, entity_id, expires_at INTO v_token_record
    FROM password_reset_tokens
    WHERE token = p_token
        AND used_at IS NULL
        AND expires_at > now()
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN JSON_BUILD_OBJECT('valid', false, 'error', 'Token invalide ou expiré');
    END IF;

    RETURN JSON_BUILD_OBJECT(
        'valid', true,
        'email', v_token_record.email,
        'user_type', v_token_record.user_type
    );
END;
$$;
