
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_bid_count(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_all_bid_counts() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.claim_free_item(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.unclaim_free_item(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.enforce_bid_window() FROM PUBLIC, anon;
