-- Harden SECURITY DEFINER functions by revoking EXECUTE from PUBLIC/anon.
-- Only authenticated users (via RLS-backed policies) and service_role should call these.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_bid_count(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_all_bid_counts() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.claim_free_item(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.unclaim_free_item(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_bid_count(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_all_bid_counts() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.claim_free_item(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.unclaim_free_item(uuid) TO authenticated, service_role;