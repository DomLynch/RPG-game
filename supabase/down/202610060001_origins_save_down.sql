begin;
-- Drops exactly what 202610060001_origins_save.sql creates, in reverse dependency order. Nothing else depends on these objects; no existing table is touched.
drop function public.origins_cancel_trade(text, jsonb), public.origins_settle_trade(text, jsonb), public.origins_open_trade(text, text, text),
  public.origins_commit(uuid, jsonb), public.origins_apply(jsonb, uuid[]), public.origins_consume_encounter(uuid, text),
  public.origins_issue_encounter(uuid, text, text, bigint, text, int, int), public.origins_pit_pending(uuid), public.origins_total_credit(uuid), public.origins_open(uuid), public.origins_snapshot(uuid, int, bigint),
  public.origins_create_character(uuid, text);
drop table public.origins_talk, public.origins_quest_journal, public.origins_quest_state, public.origins_trades, public.origins_item_ledger,
  public.origins_items, public.origins_encounters, public.origins_events, public.origins_career, public.origins_characters, public.origins_access, public.origins_config;
drop function public.origins_conserved(), public.origins_item_guard(), public.origins_versioned(), public.origins_career_credit_up(), public.origins_no_change(),
  public.origins_owns(text, uuid), public.origins_allowed(uuid);
revoke usage on schema public from frankendom_origins;
drop role frankendom_origins;
commit;
