-- SQL pour empêcher les scans multiples et ajouter le crédit d'impôt

-- 1. Ajouter le champ hasTaxCredit à la table documents
ALTER TABLE documents ADD COLUMN hasTaxCredit BOOLEAN DEFAULT FALSE;

-- 2. Créer un index pour optimiser la recherche de scans multiples
CREATE INDEX idx_scans_client_timestamp ON scans(clientId, timestamp);

-- 3. Ajouter une contrainte pour empêcher les scans multiples dans un court laps de temps
-- Cette contrainte vérifie qu'il n'y a pas déjà un scan du même type
-- pour le même client dans les 5 dernières minutes

-- Créer une fonction pour vérifier les scans multiples
CREATE OR REPLACE FUNCTION check_duplicate_scan(
    p_clientId VARCHAR(255),
    p_scanType VARCHAR(10),
    p_timestamp TIMESTAMP
) RETURNS BOOLEAN AS $$
DECLARE
    scan_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO scan_count
    FROM scans
    WHERE clientId = p_clientId
    AND scanType = p_scanType
    AND timestamp >= p_timestamp - INTERVAL '5 minutes'
    AND timestamp < p_timestamp;
    
    RETURN scan_count = 0;
END;
$$ LANGUAGE plpgsql;

-- 9. Table de pointage utilisée par l'application: visit_scans
-- Le code front insère dans "visit_scans" (client_id, scanner_id, scanner_name, scan_type, timestamp)

-- Extension pour gen_random_uuid (souvent déjà activée sur Supabase)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS visit_scans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id TEXT NOT NULL,
    scanner_id TEXT NOT NULL,
    scanner_name TEXT,
    scan_type TEXT NOT NULL CHECK (scan_type IN ('entry', 'exit')),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_visit_scans_client_timestamp
ON visit_scans (client_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_visit_scans_scanner_timestamp
ON visit_scans (scanner_id, timestamp DESC);

-- Anti-doublon court: empêche 2 scans identiques trop rapprochés pour le même client
CREATE OR REPLACE FUNCTION prevent_duplicate_visit_scans()
RETURNS TRIGGER AS $$
DECLARE
    scan_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO scan_count
    FROM visit_scans
    WHERE client_id = NEW.client_id
      AND scan_type = NEW.scan_type
      AND timestamp >= (NEW.timestamp - INTERVAL '5 seconds')
      AND timestamp < NEW.timestamp;

    IF scan_count > 0 THEN
        RAISE EXCEPTION 'Scan multiple détecté pour le client % de type %', NEW.client_id, NEW.scan_type;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_prevent_duplicate_visit_scans ON visit_scans;
CREATE TRIGGER trigger_prevent_duplicate_visit_scans
    BEFORE INSERT ON visit_scans
    FOR EACH ROW
    EXECUTE FUNCTION prevent_duplicate_visit_scans();

-- RLS (permissif) pour que l'app fonctionne même sans auth Supabase
ALTER TABLE visit_scans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "visit_scans_select_all" ON visit_scans;
CREATE POLICY "visit_scans_select_all" ON visit_scans
FOR SELECT USING (true);

DROP POLICY IF EXISTS "visit_scans_insert_all" ON visit_scans;
CREATE POLICY "visit_scans_insert_all" ON visit_scans
FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "visit_scans_update_all" ON visit_scans;
CREATE POLICY "visit_scans_update_all" ON visit_scans
FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "visit_scans_delete_all" ON visit_scans;
CREATE POLICY "visit_scans_delete_all" ON visit_scans
FOR DELETE USING (true);

-- 8. Empêcher les missions en doublon (même client + même jour + même heure de début)
-- NOTE: Les colonnes dans la table missions sont: client_id, date, start_time.
-- On crée une clé unique sur (client_id, date, start_time).
-- Cela empêche 2 programmations à la même heure pour le même client.
CREATE UNIQUE INDEX IF NOT EXISTS idx_missions_unique_client_date_start_time
ON missions (client_id, date, start_time);

-- Créer un trigger pour empêcher les scans multiples
CREATE OR REPLACE FUNCTION prevent_duplicate_scans()
RETURNS TRIGGER AS $$
BEGIN
    IF NOT check_duplicate_scan(NEW.clientId, NEW.scanType, NEW.timestamp) THEN
        RAISE EXCEPTION 'Scan multiple détecté pour le client % de type %', NEW.clientId, NEW.scanType;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Appliquer le trigger
DROP TRIGGER IF EXISTS trigger_prevent_duplicate_scans ON scans;
CREATE TRIGGER trigger_prevent_duplicate_scans
    BEFORE INSERT ON scans
    FOR EACH ROW
    EXECUTE FUNCTION prevent_duplicate_scans();

-- 4. Mettre à jour les documents existants pour le crédit d'impôt (exemple)
-- Vous pouvez ajuster cette requête selon vos besoins
UPDATE documents 
SET hasTaxCredit = TRUE 
WHERE type = 'Devis' 
AND (
    description ILIKE '%crédit d''impôt%' 
    OR description ILIKE '%tax credit%'
    OR clientName IN ('Client1', 'Client2') -- Mettre les noms des clients éligibles
);

-- 5. Créer une vue pour les devis avec crédit d'impôt
CREATE OR REPLACE VIEW quotes_with_tax_credit AS
SELECT 
    d.*,
    CASE 
        WHEN d.hasTaxCredit = TRUE THEN 
            (d.totalTTC * 0.5)::DECIMAL(10,2)
        ELSE 
            0
    END as taxCreditAmount,
    CASE 
        WHEN d.hasTaxCredit = TRUE THEN 
            (d.totalTTC * 0.5)::DECIMAL(10,2)
        ELSE 
            d.totalTTC
    END as clientPayAmount
FROM documents d
WHERE d.type = 'Devis';

-- 6. Index pour optimiser les performances
CREATE INDEX idx_documents_type_taxcredit ON documents(type, hasTaxCredit);
CREATE INDEX idx_scans_client_type_timestamp ON scans(clientId, scanType, timestamp);

-- 7. Procédure pour mettre à jour le crédit d'impôt sur un devis
CREATE OR REPLACE FUNCTION update_quote_tax_credit(
    p_documentId VARCHAR(255),
    p_hasTaxCredit BOOLEAN
) RETURNS VOID AS $$
BEGIN
    UPDATE documents 
    SET hasTaxCredit = p_hasTaxCredit,
        updatedAt = CURRENT_TIMESTAMP
    WHERE id = p_documentId;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Document non trouvé: %', p_documentId;
    END IF;
END;
$$ LANGUAGE plpgsql;
