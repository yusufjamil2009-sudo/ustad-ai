-- Coin mutation and purchase functions are server-only. They are SECURITY
-- DEFINER and were reachable by anon/authenticated through the Data API, which
-- would let a caller mint or move coins. Only the app server (service_role)
-- calls them (wallet.server.ts / tournament-engine.server.ts).
revoke all on function public.ustad_coin_apply(text, text, text, bigint, text, text) from public, anon, authenticated;
grant execute on function public.ustad_coin_apply(text, text, text, bigint, text, text) to service_role;

revoke all on function public.ustad_shop_buy(text, text, bigint, text, integer, bigint) from public, anon, authenticated;
grant execute on function public.ustad_shop_buy(text, text, bigint, text, integer, bigint) to service_role;

-- Internal trigger function: never called directly.
revoke all on function public.ustad_coin_offer_touch() from public, anon, authenticated;
grant execute on function public.ustad_coin_offer_touch() to service_role;