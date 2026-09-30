begin;
-- Narrows fight_records' public select (Auditer finding, 2026-09-22): the select policy is correctly "by its id" in intent, but RLS
-- cannot express that — a policy only says WHO may read a row it can see, not which columns. With the whole-table select grant from
-- 202609210002, GET /rest/v1/fight_records?select=id,user_id,opponent,created_at,record lists every sharer's auth user id, when they
-- shared and their full record, even though the client only ever reads `record` (src/share-store.ts). Revokes the wider grant and
-- replaces it with exactly the columns a guest holding a link needs — reversible, but a revoke, not additive: no client change and
-- no data loss, but tighter than what shipped, so it goes through the same sign-off as any non-additive change tonight.
-- The insert policy's own rate-limit check (202609210002) counts each poster's rows in the last hour by querying user_id and
-- created_at directly — that needs SELECT on those columns for the inserting role, which this migration is about to take away.
-- Move the count into a definer function (runs as the table owner, bypasses grants and RLS) so narrowing the client-facing select
-- grant doesn't also break the policy that enforces it.
-- Zero-arg and keyed to auth.uid() internally, not a parameter: a version taking `uid` would let any authenticated caller ask via
-- POST /rest/v1/rpc/fight_records_recent for another player's recent-post count, a real (if small) activity leak.
create function public.fight_records_recent() returns integer language sql stable security definer set search_path = public as $$
  select count(*)::integer from public.fight_records where user_id = auth.uid() and created_at > now() - interval '1 hour'
$$;
revoke all on function public.fight_records_recent() from public;
grant execute on function public.fight_records_recent() to authenticated;
drop policy "a fighter stores his own, thirty an hour" on public.fight_records;
create policy "a fighter stores his own, thirty an hour" on public.fight_records for insert to authenticated
  with check (auth.uid() = user_id and public.fight_records_recent() < 30);
revoke select on public.fight_records from anon, authenticated;
grant select (id, opponent, record) on public.fight_records to anon, authenticated;
comment on table public.fight_records is 'Shared fight records by short id (beta): public read of (id, opponent, record) by anyone holding the id, owner-only bounded insert, no update or delete from the client. user_id and created_at never leave the server.';
commit;
