-- =============================================================================
-- SCRIPT SQL : Génération automatique des factures pour les devis déjà signés
-- =============================================================================
-- Ce script crée des factures automatiques pour tous les devis signés
-- qui n'ont pas encore de facture liée.
-- Les factures sont créées avec le statut 'paid' (payé) par défaut.
-- =============================================================================

-- Fonction pour générer un UUID v4
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Créer une fonction pour générer la référence de facture
CREATE OR REPLACE FUNCTION generate_invoice_ref(quote_ref TEXT)
RETURNS TEXT AS $$
DECLARE
    year TEXT;
    ts TEXT;
    rand TEXT;
BEGIN
    year := EXTRACT(YEAR FROM CURRENT_DATE)::TEXT;
    ts := TO_CHAR(EXTRACT(EPOCH FROM CURRENT_TIMESTAMP)::BIGINT, 'FM9999999999');
    rand := SUBSTRING(MD5(RANDOM()::TEXT), 1, 4);
    
    -- Remplacer DEV par FAC et ajouter un suffixe unique
    RETURN REPLACE(quote_ref, 'DEV', 'FAC') || '-AUTO-' || SUBSTRING(ts FROM LENGTH(ts)-3) || rand;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- PROCÉDURE PRINCIPALE : Créer les factures pour les devis signés
-- =============================================================================

DO $$
DECLARE
    quote_record RECORD;
    invoice_id UUID;
    invoice_ref TEXT;
    created_count INTEGER := 0;
    skipped_count INTEGER := 0;
    error_count INTEGER := 0;
BEGIN
    RAISE NOTICE 'Début du traitement des devis signés sans facture...';
    
    -- Parcourir tous les devis signés sans facture liée
    FOR quote_record IN 
        SELECT 
            id,
            ref,
            client_id,
            client_name,
            date,
            category,
            service_type,
            description,
            unit_price,
            quantity,
            tva_rate,
            total_ht,
            total_ttc,
            tax_credit_enabled,
            slots_data,
            pack_id,
            frequency,
            recurrence_end_date,
            status,
            linked_invoice_id
        FROM documents 
        WHERE type = 'Devis' 
          AND status IN ('signed', 'converted')
          AND (linked_invoice_id IS NULL OR linked_invoice_id = '')
        ORDER BY created_at DESC
    LOOP
        BEGIN
            -- Vérifier si une facture existe déjà pour ce devis (double vérification)
            IF quote_record.linked_invoice_id IS NOT NULL AND quote_record.linked_invoice_id != '' THEN
                RAISE NOTICE 'Devis % déjà lié à une facture, ignoré.', quote_record.ref;
                skipped_count := skipped_count + 1;
                CONTINUE;
            END IF;
            
            -- Vérifier si une facture avec référence similaire existe déjà
            IF EXISTS (SELECT 1 FROM documents WHERE ref LIKE REPLACE(quote_record.ref, 'DEV', 'FAC') || '%' AND type = 'Facture') THEN
                RAISE NOTICE 'Facture déjà existante pour le devis %, mise à jour du lien uniquement.', quote_record.ref;
                
                -- Mettre à jour le lien vers la facture existante
                UPDATE documents 
                SET linked_invoice_id = (
                    SELECT id FROM documents 
                    WHERE ref LIKE REPLACE(quote_record.ref, 'DEV', 'FAC') || '%' 
                      AND type = 'Facture' 
                    LIMIT 1
                ),
                status = 'converted'
                WHERE id = quote_record.id;
                
                skipped_count := skipped_count + 1;
                CONTINUE;
            END IF;
            
            -- Générer l'ID et la référence de la facture
            invoice_id := uuid_generate_v4();
            invoice_ref := generate_invoice_ref(quote_record.ref);
            
            -- Créer la facture
            INSERT INTO documents (
                id,
                ref,
                client_id,
                client_name,
                date,
                type,
                category,
                service_type,
                description,
                unit_price,
                quantity,
                tva_rate,
                total_ht,
                total_ttc,
                tax_credit_enabled,
                status,
                slots_data,
                pack_id,
                frequency,
                recurrence_end_date,
                linked_invoice_id,
                reminder_sent
            ) VALUES (
                invoice_id,
                invoice_ref,
                quote_record.client_id,
                quote_record.client_name,
                CURRENT_DATE,
                'Facture',
                quote_record.category,
                quote_record.service_type,
                quote_record.description,
                quote_record.unit_price,
                quote_record.quantity,
                quote_record.tva_rate,
                quote_record.total_ht,
                quote_record.total_ttc,
                quote_record.tax_credit_enabled,
                'paid',  -- Statut payé par défaut
                quote_record.slots_data,
                quote_record.pack_id,
                quote_record.frequency,
                quote_record.recurrence_end_date,
                quote_record.id,  -- Lien vers le devis source
                false
            );
            
            -- Mettre à jour le devis pour le lier à la facture
            UPDATE documents 
            SET 
                linked_invoice_id = invoice_id,
                status = 'converted'
            WHERE id = quote_record.id;
            
            RAISE NOTICE 'Facture % créée pour le devis % (montant: % €)', 
                invoice_ref, quote_record.ref, quote_record.total_ttc;
            
            created_count := created_count + 1;
            
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Erreur lors du traitement du devis %: %', quote_record.ref, SQLERRM;
            error_count := error_count + 1;
        END;
    END LOOP;
    
    -- Résumé
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Traitement terminé:';
    RAISE NOTICE '  - Factures créées: %', created_count;
    RAISE NOTICE '  - Devis ignorés (déjà liés): %', skipped_count;
    RAISE NOTICE '  - Erreurs: %', error_count;
    RAISE NOTICE '========================================';
    
END $$;

-- Nettoyer la fonction temporaire
DROP FUNCTION IF EXISTS generate_invoice_ref(TEXT);

-- =============================================================================
-- REQUÊTE DE VÉRIFICATION (optionnelle - exécuter après pour vérifier)
-- =============================================================================
/*
-- Liste des devis avec leur facture liée
SELECT 
    d.id AS devis_id,
    d.ref AS devis_ref,
    d.status AS devis_status,
    f.id AS facture_id,
    f.ref AS facture_ref,
    f.status AS facture_status,
    d.total_ttc
FROM documents d
LEFT JOIN documents f ON f.id = d.linked_invoice_id
WHERE d.type = 'Devis'
ORDER BY d.created_at DESC;

-- Compteur: devis signés sans facture (devrait être 0 après le script)
SELECT COUNT(*) AS devis_sans_facture
FROM documents 
WHERE type = 'Devis' 
  AND status IN ('signed', 'converted')
  AND (linked_invoice_id IS NULL OR linked_invoice_id = '');
  
-- Nouvelles factures créées aujourd'hui
SELECT * FROM documents 
WHERE type = 'Facture' 
  AND ref LIKE '%-AUTO-%'
  AND created_at >= CURRENT_DATE
ORDER BY created_at DESC;
*/
