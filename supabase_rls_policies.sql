-- ============================================
-- POLICIES RLS POUR PRESTA SERVICES ANTILLES
-- À exécuter dans la console SQL de Supabase
-- ============================================
-- 
-- PROBLÈME : Vos tables ont RLS activé mais sans policies
-- RÉSULTAT : Aucune donnée n'est accessible, même authentifié
-- 
-- SOLUTION RAPIDE (DÉVELOPPEMENT) :
-- Exécutez la section ci-dessous pour désactiver RLS
-- 
-- COMMENT UTILISER :
-- 1. Ouvrez https://supabase.com/dashboard
-- 2. Sélectionnez votre projet
-- 3. Allez dans "SQL Editor" (menu latéral)
-- 4. Cliquez "New Query"
-- 5. Copiez-collez le code ci-dessous
-- 6. Cliquez "RUN" (bouton vert)
-- 7. Actualisez votre application (F5)
-- 
-- ============================================

-- DÉSACTIVER RLS TEMPORAIREMENT (DÉVELOPPEMENT UNIQUEMENT)
-- ATTENTION: À SÉCURISER EN PRODUCTION

-- Clients
ALTER TABLE clients DISABLE ROW LEVEL SECURITY;

-- Providers
ALTER TABLE providers DISABLE ROW LEVEL SECURITY;

-- Missions
ALTER TABLE missions DISABLE ROW LEVEL SECURITY;

-- Documents
ALTER TABLE documents DISABLE ROW LEVEL SECURITY;

-- Packs
ALTER TABLE packs DISABLE ROW LEVEL SECURITY;

-- Contracts
ALTER TABLE contracts DISABLE ROW LEVEL SECURITY;

-- Reminders
ALTER TABLE reminders DISABLE ROW LEVEL SECURITY;

-- Expenses
ALTER TABLE expenses DISABLE ROW LEVEL SECURITY;

-- Messages
ALTER TABLE messages DISABLE ROW LEVEL SECURITY;

-- Notifications
ALTER TABLE notifications DISABLE ROW LEVEL SECURITY;

-- Company Settings
ALTER TABLE company_settings DISABLE ROW LEVEL SECURITY;

-- Visit Scans
ALTER TABLE visit_scans DISABLE ROW LEVEL SECURITY;

-- Leaves
ALTER TABLE leaves DISABLE ROW LEVEL SECURITY;

-- Users (si existe)
ALTER TABLE users DISABLE ROW LEVEL SECURITY;

-- Reviews (si existe)
ALTER TABLE reviews DISABLE ROW LEVEL SECURITY;

-- ============================================
-- MESSAGE DE SUCCÈS ATTENDU :
-- "Success. No rows returned"
-- 
-- Si erreur "table does not exist" :
-- C'est normal pour users/reviews si vous ne les avez pas créées
-- Les autres tables DOIVENT exister
-- ============================================

-- ============================================
-- ALTERNATIVE: POLICIES AVEC ACCÈS PUBLIC
-- Si vous préférez garder RLS activé avec accès total
-- Commentez la section ci-dessus et décommentez celle-ci
-- ============================================

/*
-- Activer RLS
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE packs ENABLE ROW LEVEL SECURITY;
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE visit_scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE leaves ENABLE ROW LEVEL SECURITY;

-- Supprimer les anciennes policies si elles existent
DROP POLICY IF EXISTS "Allow all for clients" ON clients;
DROP POLICY IF EXISTS "Allow all for providers" ON providers;
DROP POLICY IF EXISTS "Allow all for missions" ON missions;
DROP POLICY IF EXISTS "Allow all for documents" ON documents;
DROP POLICY IF EXISTS "Allow all for packs" ON packs;
DROP POLICY IF EXISTS "Allow all for contracts" ON contracts;
DROP POLICY IF EXISTS "Allow all for reminders" ON reminders;
DROP POLICY IF EXISTS "Allow all for expenses" ON expenses;
DROP POLICY IF EXISTS "Allow all for messages" ON messages;
DROP POLICY IF EXISTS "Allow all for notifications" ON notifications;
DROP POLICY IF EXISTS "Allow all for company_settings" ON company_settings;
DROP POLICY IF EXISTS "Allow all for visit_scans" ON visit_scans;
DROP POLICY IF EXISTS "Allow all for leaves" ON leaves;

-- Créer des policies pour accès total (DÉVELOPPEMENT)
CREATE POLICY "Allow all for clients" ON clients FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for providers" ON providers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for missions" ON missions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for documents" ON documents FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for packs" ON packs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for contracts" ON contracts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for reminders" ON reminders FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for expenses" ON expenses FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for messages" ON messages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for notifications" ON notifications FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for company_settings" ON company_settings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for visit_scans" ON visit_scans FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for leaves" ON leaves FOR ALL USING (true) WITH CHECK (true);
*/

-- ============================================
-- VÉRIFICATION POST-EXÉCUTION
-- Exécutez cette requête pour tester :
-- ============================================

-- SELECT COUNT(*) FROM clients;
-- Si vous voyez un nombre, c'est bon ! ✅
-- Si erreur, RLS bloque encore ❌

-- ============================================
-- POUR PRODUCTION : POLICIES SÉCURISÉES
-- À configurer plus tard selon vos besoins
-- ============================================

/*
-- Exemple : Seulement les admins peuvent tout voir
CREATE POLICY "Admins can view all clients" 
ON clients FOR SELECT 
USING (
  auth.jwt() ->> 'email' = 'admin@presta.com'
  OR 
  auth.jwt() ->> 'role' = 'admin'
);

-- Exemple : Les clients ne voient que leurs données
CREATE POLICY "Clients can view own data" 
ON clients FOR SELECT 
USING (
  auth.uid() = id
);

-- À adapter selon votre structure de permissions
*/
