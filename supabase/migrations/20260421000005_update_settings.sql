-- Add store_name and currency_symbol to user_settings
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_settings' AND column_name = 'store_name') THEN
        ALTER TABLE user_settings ADD COLUMN store_name TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_settings' AND column_name = 'currency_symbol') THEN
        ALTER TABLE user_settings ADD COLUMN currency_symbol TEXT DEFAULT 'R';
    END IF;
END $$;
