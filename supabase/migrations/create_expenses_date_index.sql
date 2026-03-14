-- Créer un index sur la colonne date de la table expenses pour améliorer les performances
-- Cela réduira considérablement le temps de requête pour les filtres par date

CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date DESC);

-- Vérifier que l'index a été créé
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'expenses';
