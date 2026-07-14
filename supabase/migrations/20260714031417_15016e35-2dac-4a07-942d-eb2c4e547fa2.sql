
ALTER TABLE public.sale_settings
  ADD COLUMN IF NOT EXISTS auction_starts_at timestamptz NOT NULL DEFAULT now();

-- Guard: bids only after start
CREATE OR REPLACE FUNCTION public.enforce_bid_window()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  starts_at timestamptz;
  ends_at timestamptz;
BEGIN
  SELECT auction_starts_at, auction_ends_at INTO starts_at, ends_at
    FROM public.sale_settings WHERE id = true;
  IF starts_at IS NOT NULL AND now() < starts_at THEN
    RAISE EXCEPTION 'The sale has not started yet.';
  END IF;
  IF ends_at IS NOT NULL AND now() >= ends_at THEN
    RAISE EXCEPTION 'The sale has closed.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_bid_window_trg ON public.bids;
CREATE TRIGGER enforce_bid_window_trg
  BEFORE INSERT ON public.bids
  FOR EACH ROW EXECUTE FUNCTION public.enforce_bid_window();

-- Update claim to also check start time
CREATE OR REPLACE FUNCTION public.claim_free_item(_item_id uuid)
RETURNS items
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claimed public.items;
  starts_at timestamptz;
  ends_at timestamptz;
BEGIN
  SELECT auction_starts_at, auction_ends_at INTO starts_at, ends_at
    FROM public.sale_settings WHERE id = true;
  IF starts_at IS NOT NULL AND now() < starts_at THEN
    RAISE EXCEPTION 'The sale has not started yet.';
  END IF;
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
$$;

CREATE OR REPLACE FUNCTION public.unclaim_free_item(_item_id uuid)
RETURNS items
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  released public.items;
  starts_at timestamptz;
  ends_at timestamptz;
BEGIN
  SELECT auction_starts_at, auction_ends_at INTO starts_at, ends_at
    FROM public.sale_settings WHERE id = true;
  IF starts_at IS NOT NULL AND now() < starts_at THEN
    RAISE EXCEPTION 'The sale has not started yet.';
  END IF;
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
$$;
