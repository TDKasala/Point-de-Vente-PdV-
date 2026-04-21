-- Ajouter une colonne statut aux ventes si elle n'existe pas
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales' AND column_name = 'status') THEN
        ALTER TABLE sales ADD COLUMN status text DEFAULT 'completed';
    END IF;
END $$;
