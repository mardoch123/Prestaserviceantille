-- Table: customer_service_requests
-- Purpose: Store new service requests submitted by clients via the client portal
-- Features: Email notification to admin on new request, validation workflow with automatic devis/planning generation

CREATE TABLE IF NOT EXISTS customer_service_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Client information
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    client_name TEXT NOT NULL,
    client_email TEXT NOT NULL,
    client_phone TEXT,
    client_address TEXT,
    client_city TEXT,
    
    -- Service details
    service_type TEXT NOT NULL,
    pack_id UUID REFERENCES packs(id) ON DELETE SET NULL,
    pack_name TEXT,
    custom_service_description TEXT,
    
    -- Requested slots (JSON array of slots)
    requested_slots JSONB NOT NULL DEFAULT '[]',
    
    -- Client signature (base64 image)
    signature_data_url TEXT,
    
    -- Pricing estimate
    estimated_price DECIMAL(10,2),
    
    -- Status workflow
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'validated', 'rejected', 'cancelled')),
    
    -- Admin tracking
    admin_seen_at TIMESTAMP WITH TIME ZONE,
    validated_at TIMESTAMP WITH TIME ZONE,
    validated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    
    -- Linked entities after validation
    generated_devis_id UUID REFERENCES documents(id) ON DELETE SET NULL,
    generated_mission_ids UUID[] DEFAULT '{}',
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_customer_service_requests_status ON customer_service_requests(status);
CREATE INDEX IF NOT EXISTS idx_customer_service_requests_client_id ON customer_service_requests(client_id);
CREATE INDEX IF NOT EXISTS idx_customer_service_requests_created_at ON customer_service_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_customer_service_requests_admin_seen ON customer_service_requests(admin_seen_at) WHERE admin_seen_at IS NULL;

-- Trigger function to update updated_at
CREATE OR REPLACE FUNCTION update_customer_service_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_customer_service_requests_updated_at ON customer_service_requests;
CREATE TRIGGER trigger_customer_service_requests_updated_at
    BEFORE UPDATE ON customer_service_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_customer_service_requests_updated_at();

-- Enable RLS
ALTER TABLE customer_service_requests ENABLE ROW LEVEL SECURITY;

-- Policy: Admins can see all requests
CREATE POLICY "Admins can view all service requests"
    ON customer_service_requests
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND (users.role = 'admin' OR users.role = 'super_admin')
        )
    );

-- Policy: Admins can update all requests
CREATE POLICY "Admins can update service requests"
    ON customer_service_requests
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND (users.role = 'admin' OR users.role = 'super_admin')
        )
    );

-- Policy: Clients can see their own requests
CREATE POLICY "Clients can view own service requests"
    ON customer_service_requests
    FOR SELECT
    TO authenticated
    USING (client_id = auth.uid());

-- Policy: Clients can create requests
CREATE POLICY "Clients can create service requests"
    ON customer_service_requests
    FOR INSERT
    TO authenticated
    WITH CHECK (
        client_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role = 'client'
        )
    );
