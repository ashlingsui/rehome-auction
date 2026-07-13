CREATE OR REPLACE FUNCTION public.unclaim_free_item(_item_id uuid)
RETURNS public.items
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  released public.items;
  ends_at timestamptz;
BEGIN
  SELECT auction_ends_at INTO ends_at FROM public.sale_settings WHERE id = true;
  IF ends_at IS NOT NULL AND now() >= ends_at THEN
    RAISE EXCEPTION 'The sale has closed.';
  END IF;

  UPDATE public.items
    SET status = 'available', claimed_by = NULL
    WHERE id = _item_id
      AND type = 'free'
      AND status = 'claimed'
      AND claimed_by = auth.uid()
    RETURNING * INTO released;
  IF released.id IS NULL THEN
    RAISE EXCEPTION 'You can only unclaim items you claimed yourself.';
  END IF;
  RETURN released;
END;
$function$;