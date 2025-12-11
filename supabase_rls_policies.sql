-- ============================================
-- POLICIES RLS POUR PRESTA SERVICES ANTILLES
-- À exécuter dans la console SQL de Supabase
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
-- ALTERNATIVE: POLICIES AVEC ACCÈS PUBLIC
-- Si vous préférez garder RLS activé avec accès total
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
