-- Add message provider configuration to company_settings table
-- This allows storing WhatsApp/SMS API configuration in the database

ALTER TABLE company_settings 
ADD COLUMN IF NOT EXISTS message_provider VARCHAR(20) DEFAULT 'wa_me',
ADD COLUMN IF NOT EXISTS message_api_key TEXT,
ADD COLUMN IF NOT EXISTS message_base_url TEXT;

-- Set default value for existing records
UPDATE company_settings 
SET message_provider = 'wa_me' 
WHERE message_provider IS NULL;

COMMENT ON COLUMN company_settings.message_provider IS 'Message provider: smsmode, wa_me, or custom';
COMMENT ON COLUMN company_settings.message_api_key IS 'API key for SMSMode or custom provider';
COMMENT ON COLUMN company_settings.message_base_url IS 'Custom API base URL for custom provider';
