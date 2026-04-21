-- Crée le bucket (dossier de stockage global) pour les images des produits s'il n'existe pas
INSERT INTO storage.buckets (id, name, public)
VALUES ('product_images', 'product_images', true)
ON CONFLICT (id) DO NOTHING;

-- Autoriser la consultation (Read) publique des images
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'product_images' );

-- Autoriser un utilisateur à uploader une image SEULEMENT s'il est connecté ET que l'image fait moins de 1MB.
-- Note: les tailles sont en bytes (1048576 bytes = 1 MB)
-- On vérifie aussi que le dossier de destination porte son user_id (Dossier personnel).
CREATE POLICY "Users can upload their own product images"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'product_images' 
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Autoriser la suppression de SES propres images
CREATE POLICY "Users can delete their own product images"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'product_images' 
    AND auth.role() = 'authenticated' 
    AND (storage.foldername(name))[1] = auth.uid()::text
);
