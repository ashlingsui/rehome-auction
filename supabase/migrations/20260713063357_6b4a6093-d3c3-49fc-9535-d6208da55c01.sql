
CREATE POLICY "authenticated read item photos"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'item-photos');

CREATE POLICY "admins upload item photos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'item-photos' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins update item photos"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'item-photos' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins delete item photos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'item-photos' AND public.has_role(auth.uid(), 'admin'));
