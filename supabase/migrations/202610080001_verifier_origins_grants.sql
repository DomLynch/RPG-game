-- GRANT only: frankendom_verifier gets exactly frankendom_origins' rights (execute on the 26 origins_* functions below, read from the live ACL on 2026-10-08;
-- both roles already have usage on public; neither has table grants or memberships). Nothing wider: no table, column, policy or role change.
-- Why: the Origins writer then runs on /etc/frankendom/verifier.env instead of a second role password. frankendom_origins keeps its grants untouched.
begin;
grant execute on function
  public.origins_accept_trade(text,text,integer,boolean),
  public.origins_active(uuid),
  public.origins_cancel_trade(text,text,jsonb),
  public.origins_change_offer(text,text,integer,jsonb),
  public.origins_commit(uuid,jsonb),
  public.origins_consume_encounter(uuid,text),
  public.origins_create_character(uuid,text),
  public.origins_event(uuid,text),
  public.origins_expire_trades(),
  public.origins_issue_encounter(uuid,text,text,bigint,text,integer,integer),
  public.origins_open(uuid),
  public.origins_open_trade(text,text,text),
  public.origins_pit_pending(uuid),
  public.origins_purge_account(uuid),
  public.origins_reverse_trade(text,uuid,text,jsonb),
  public.origins_save_location(uuid,integer,integer,text,bigint),
  public.origins_saved_location(uuid),
  public.origins_set_active(uuid,text),
  public.origins_settle_trade(text,integer,jsonb),
  public.origins_snapshot(uuid,integer,bigint),
  public.origins_total_credit(uuid),
  public.origins_trade_audit_prune(integer),
  public.origins_trade_audit_record(text,uuid,text,text,text,text,text),
  public.origins_trade_counts(uuid,timestamptz),
  public.origins_trade_limits(uuid),
  public.origins_unpaid(uuid)
  to frankendom_verifier;
commit;
