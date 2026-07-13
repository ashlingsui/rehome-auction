
CREATE TABLE public.sale_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
  auction_ends_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, UPDATE ON public.sale_settings TO authenticated;
GRANT ALL ON public.sale_settings TO service_role;

ALTER TABLE public.sale_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "settings readable by authenticated"
  ON public.sale_settings FOR SELECT TO authenticated USING (true);

CREATE POLICY "admins update settings"
  ON public.sale_settings FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.sale_settings (id, auction_ends_at)
VALUES (true, now() + interval '48 hours')
ON CONFLICT (id) DO NOTHING;

-- Update claim_free_item to check expiry
CREATE OR REPLACE FUNCTION public.claim_free_item(_item_id uuid)
 RETURNS items
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  claimed public.items;
  ends_at timestamptz;
BEGIN
  SELECT auction_ends_at INTO ends_at FROM public.sale_settings WHERE id = true;
  IF ends_at IS NOT NULL AND now() >= ends_at THEN
    RAISE EXCEPTION 'The sale has closed.';
  END IF;

  UPDATE public.items
    SET status = 'claimed', claimed_by = auth.uid()
    WHERE id = _item_id
      AND type = 'free'
      AND status = 'available'
    RETURNING * INTO claimed;
  IF claimed.id IS NULL THEN
    RAISE EXCEPTION 'Item is no longer available';
  END IF;
  RETURN claimed;
END;
$function$;

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.sale_settings;
