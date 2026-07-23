-- Ajout de la colonne is_overtime à la table missions
-- Permet de marquer les missions effectuées en heures supplémentaires
-- (ignore les validations de disponibilité lors de l'assignation)

ALTER TABLE missions ADD COLUMN IF NOT EXISTS is_overtime BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN missions.is_overtime IS 'Indique si la mission est en heures supplémentaires (bypass des contraintes de disponibilité)';
