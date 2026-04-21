-- Create product_history table
CREATE TABLE IF NOT EXISTS product_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    change_type TEXT NOT NULL, -- 'price', 'stock', 'initial'
    old_value NUMERIC,
    new_value NUMERIC NOT NULL,
    notes TEXT
);

-- Enable RLS
ALTER TABLE product_history ENABLE ROW LEVEL SECURITY;

-- Policies for product_history
CREATE POLICY "Users can view their own product history" ON product_history
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own product history" ON product_history
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Trigger to log initial product creation (optional, but good for "initial stock")
-- Actually, it's better to handle it in the application code since we already have the logic there.
