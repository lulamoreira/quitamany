
CREATE POLICY "leitura publica videos-instagram" ON storage.objects
  FOR SELECT USING (bucket_id = 'videos-instagram');
CREATE POLICY "upload videos por admin ou editor" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'videos-instagram'
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'editor'))
  );
CREATE POLICY "update videos por admin ou editor" ON storage.objects
  FOR UPDATE TO authenticated USING (
    bucket_id = 'videos-instagram'
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'editor'))
  );
CREATE POLICY "delete videos por admin ou editor" ON storage.objects
  FOR DELETE TO authenticated USING (
    bucket_id = 'videos-instagram'
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'editor'))
  );
