begin;
-- ROLLBACK: supabase/down/202610070002_duel_record_down.sql (drops only the objects below; nothing else depends on them, and the stored records are unverified wall data).
-- The PvpRecord of a duel, kept so the verifier sweep (scripts/verify-duels.mjs) has the fight to replay. A NEW table and a NEW function: duel_reports,
-- duel_starts, fight_results and report_duel(text, text, text) are NOT altered (the old three-argument call keeps working for every live client).
-- A page sends its record AFTER its report_duel: one row per (room, user), tied to that page's own report row (the FK), so it is gone when the report is
-- (the one-day retention in settle_forfeits, a revoked forfeit claim). `side` and `record` are what the page SAYS: the sweep trusts neither, it replays
-- the record and compares. Nobody reads or writes the table directly; clients go through report_duel_record, the verifier role reads.
create table public.duel_records (
  room text not null check (room ~ '^[a-z0-9]{8,32}$'),
  user_id uuid not null references auth.users (id) on delete cascade,
  side smallint not null check (side in (0, 1)),
  record jsonb not null check (jsonb_typeof(record) = 'object' and octet_length(record::text) <= 262144),
  created_at timestamptz not null default now(),
  primary key (room, user_id),
  foreign key (room, user_id) references public.duel_reports (room, user_id) on delete cascade
);
alter table public.duel_records enable row level security;
revoke all on public.duel_records from public, anon, authenticated;
grant select on public.duel_records to frankendom_verifier;
create policy "the verifier reads records" on public.duel_records for select to frankendom_verifier using (true);
create index duel_records_created on public.duel_records (created_at);

-- A signed-in page stores its record for a room it has already reported. A repeat changes nothing (first write wins). Returns true when this
-- page's record is on file, false when it has no report row to attach to (report_duel first), so a retry is safe. An oversize or malformed record
-- is refused (the table's checks), as is a page that is not signed in or has stored too many records this hour.
create function public.report_duel_record(p_room text, p_side integer, p_record jsonb) returns boolean
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'sign in to store a duel record' using errcode = 'insufficient_privilege'; end if;
  if p_side is null or p_side not in (0, 1) then raise exception 'side is 0 or 1' using errcode = 'check_violation'; end if;
  if p_record is null or jsonb_typeof(p_record) <> 'object' or octet_length(p_record::text) > 262144 then
    raise exception 'a duel record is a JSON object of at most 262144 bytes' using errcode = 'check_violation'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_room, 0));
  if not exists (select 1 from public.duel_reports where room = p_room and user_id = me) then return false; end if;
  if (select count(*) from public.duel_records where user_id = me and created_at > now() - interval '1 hour') >= 60 then
    raise exception 'duel record cap reached' using errcode = 'insufficient_privilege'; end if;
  insert into public.duel_records (room, user_id, side, record) values (p_room, me, p_side, p_record) on conflict (room, user_id) do nothing;
  return true;
end$$;
revoke all on function public.report_duel_record(text, integer, jsonb) from public, anon;
grant execute on function public.report_duel_record(text, integer, jsonb) to authenticated;
commit;
