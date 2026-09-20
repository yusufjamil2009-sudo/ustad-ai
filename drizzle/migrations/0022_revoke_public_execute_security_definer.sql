REVOKE ALL ON FUNCTION public.ustad_coin_apply(text, text, text, bigint, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ustad_create_guest_account(text, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ustad_issue_fresh_session(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ustad_refresh_session(text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ustad_revoke_session(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ustad_shop_buy(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ustad_ticket_consume(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ustad_ticket_grant(text, integer) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.ustad_coin_apply(text, text, text, bigint, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.ustad_create_guest_account(text, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.ustad_issue_fresh_session(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.ustad_refresh_session(text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.ustad_revoke_session(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.ustad_shop_buy(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.ustad_ticket_consume(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.ustad_ticket_grant(text, integer) TO service_role;