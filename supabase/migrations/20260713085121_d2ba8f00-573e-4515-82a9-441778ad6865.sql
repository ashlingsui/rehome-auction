
-- 1. Profiles: restrict SELECT to own row or admin
DROP POLICY IF EXISTS "profiles readable by authenticated" ON public.profiles;

CREATE POLICY "users read own profile"
ON public.profiles FOR SELECT
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "admins read all profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 2. Lock down SECURITY DEFINER function execute privileges
-- handle_new_user: trigger-only, no direct callers
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- has_role: used inside RLS policies (runs as definer, no EXECUTE needed by anon)
-- but is also called from server code via rpc as authenticated
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

-- get_bid_count / get_all_bid_counts: called by authenticated users
REVOKE ALL ON FUNCTION public.get_bid_count(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_bid_count(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.get_all_bid_counts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_all_bid_counts() TO authenticated;

-- claim_free_item / unclaim_free_item: called by authenticated users
REVOKE ALL ON FUNCTION public.claim_free_item(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_free_item(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.unclaim_free_item(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.unclaim_free_item(uuid) TO authenticated;
