-- Création de la table des produits
CREATE TABLE IF NOT EXISTS products (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    name TEXT NOT NULL,
    price NUMERIC NOT NULL,
    stock INTEGER NOT NULL DEFAULT 0,
    barcode TEXT,
    image_url TEXT,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Création de la table des ventes (sales)
CREATE TABLE IF NOT EXISTS sales (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    total NUMERIC NOT NULL,
    payment_method TEXT NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Création de la table des éléments de vente (sale_items)
CREATE TABLE IF NOT EXISTS sale_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),
    quantity INTEGER NOT NULL,
    price NUMERIC NOT NULL
);

-- Activation du Row Level Security (RLS) pour protéger les données
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------
-- POLITIQUES DE SÉCURITÉ (RLS Policies)
-- Chaque utilisateur ne peut voir, modifier ou supprimer que ses propres données.
-- --------------------------------------------------------

-- Policies pour products
CREATE POLICY "Users can view their own products" ON products FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own products" ON products FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own products" ON products FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own products" ON products FOR DELETE USING (auth.uid() = user_id);

-- Policies pour sales
CREATE POLICY "Users can view their own sales" ON sales FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own sales" ON sales FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own sales" ON sales FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own sales" ON sales FOR DELETE USING (auth.uid() = user_id);

-- Policies pour sale_items (On vérifie que la vente appartient à l'utilisateur)
CREATE POLICY "Users can view their own sale items" ON sale_items FOR SELECT USING (
    EXISTS (SELECT 1 FROM sales WHERE sales.id = sale_items.sale_id AND sales.user_id = auth.uid())
);
CREATE POLICY "Users can insert their own sale items" ON sale_items FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM sales WHERE sales.id = sale_items.sale_id AND sales.user_id = auth.uid())
);
CREATE POLICY "Users can update their own sale items" ON sale_items FOR UPDATE USING (
    EXISTS (SELECT 1 FROM sales WHERE sales.id = sale_items.sale_id AND sales.user_id = auth.uid())
);
CREATE POLICY "Users can delete their own sale items" ON sale_items FOR DELETE USING (
    EXISTS (SELECT 1 FROM sales WHERE sales.id = sale_items.sale_id AND sales.user_id = auth.uid())
);
