
-- Enums
CREATE TYPE public.app_role AS ENUM ('admin', 'user');
CREATE TYPE public.item_category AS ENUM ('bedroom', 'kitchen', 'living_room', 'bathroom', 'decor', 'wardrobe', 'other');
CREATE TYPE public.item_type AS ENUM ('auction', 'free');
CREATE TYPE public.item_status AS ENUM ('available', 'claimed');

-- Profiles
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  phone text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles readable by authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "users insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- User roles
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

-- Items
CREATE TABLE public.items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  photo_url text NOT NULL,
  category public.item_category NOT NULL,
  type public.item_type NOT NULL,
  description text,
  starting_price numeric(10,2),
  status public.item_status NOT NULL DEFAULT 'available',
  claimed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.items TO authenticated;
GRANT ALL ON public.items TO service_role;
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "items readable by authenticated" ON public.items FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins insert items" ON public.items FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins update items" ON public.items FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins delete items" ON public.items FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Bids
CREATE TABLE public.bids (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount numeric(10,2) NOT NULL CHECK (amount > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (item_id, user_id)
);
GRANT SELECT, INSERT ON public.bids TO authenticated;
GRANT ALL ON public.bids TO service_role;
ALTER TABLE public.bids ENABLE ROW LEVEL SECURITY;
-- Users can insert their own bid, but cannot SELECT bids (blind auction)
CREATE POLICY "users insert own bid" ON public.bids FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
-- Admins can view all bids
CREATE POLICY "admins read bids" ON public.bids FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
-- Users can see whether THEY themselves bid (for locked-in UI), but not amount or others
CREATE POLICY "users read own bid" ON public.bids FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Bid counts RPC (returns counts per item for social proof, no bidder details)
CREATE OR REPLACE FUNCTION public.get_bid_count(_item_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::int FROM public.bids WHERE item_id = _item_id;
$$;
GRANT EXECUTE ON FUNCTION public.get_bid_count(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_all_bid_counts()
RETURNS TABLE(item_id uuid, bid_count integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT item_id, COUNT(*)::int as bid_count FROM public.bids GROUP BY item_id;
$$;
GRANT EXECUTE ON FUNCTION public.get_all_bid_counts() TO authenticated;

-- Atomic claim function for free items
CREATE OR REPLACE FUNCTION public.claim_free_item(_item_id uuid)
RETURNS public.items
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claimed public.items;
BEGIN
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
GRANT EXECUTE ON FUNCTION public.claim_free_item(uuid) TO authenticated;

-- Auto-create profile on signup (name & phone come from raw_user_meta_data)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', 'Friend'),
    COALESCE(NEW.raw_user_meta_data->>'phone', NEW.id::text)
  )
  ON CONFLICT (id) DO NOTHING;

  -- First user becomes admin
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user')
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.bids;
