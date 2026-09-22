begin;
-- Guest shares, bounded (Auditer's read-only audit after 0009, 2026-09-22). Guest rows (user_id null) had a rate cap but no ceiling and no
-- retention, so the worst case grew without limit; and the caps lived as literals inside mint_share, so changing a number meant a
-- migration. The limits now live in one owner-managed row that no client can read; mint_share reads it; a daily job prunes old
-- guest rows. Signed-in shares are untouched: they belong to an account, count per fighter, and are never pruned.
create table public.share_limits (
  id boolean primary key default true check (id),
  guest_per_minute integer not null default 600 check (guest_per_minute between 1 and 100000),          -- across ALL guests: the backstop behind the per-caller cap
  guest_per_key_per_minute integer not null default 10 check (guest_per_key_per_minute between 1 and 10000),   -- per caller (salted hash of the request IP)
  guest_salt text not null default encode(gen_random_bytes(16), 'hex'),                                   -- the hash salt; never leaves this row
  guest_rows integer not null default 50000 check (guest_rows between 1 and 100000000),                 -- ceiling on stored guest rows (≈ 800 MB at the 16 KB max, far less in practice)
  guest_days integer not null default 30 check (guest_days between 1 and 3650)                  -- guest rows older than this are pruned daily; Dom 2026-09-22 (via Strategy): "30 days live"; signed-in rows are never pruned
);
alter table public.share_limits enable row level security;
revoke all on public.share_limits from public, anon, authenticated;
insert into public.share_limits default values;

-- Per-caller cap for guests: PostgREST hands the request headers to SQL (request.headers), so a guest can be bucketed by the IP the
-- gateway saw — stored only as a salted SHA-256, never the address, in a column no client can read (the 0006 select grant lists
-- id, opponent, record and nothing else). No header (direct SQL: the verifier, the local check) → no key → the global backstop only.
alter table public.fight_records add column guest_key text check (guest_key ~ '^[0-9a-f]{64}$');
create index fight_records_guest_key_recent on public.fight_records (guest_key, created_at desc) where guest_key is not null;

create or replace function public.mint_share(record text, opponent text) returns text language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); new_id text; lim public.share_limits; ip text; key text;
begin
  if opponent is null or char_length(opponent) not between 1 and 32 then raise exception 'opponent must be 1–32 characters' using errcode = 'check_violation'; end if;
  if record is null or octet_length(record) > 16384 or record !~ '^[A-Za-z0-9_-]+$' then raise exception 'record must be base64url, at most 16 KB' using errcode = 'check_violation'; end if;
  if uid is null then
    select * into lim from public.share_limits;
    begin   -- the gateway's client address, if this call came through PostgREST; anything unparseable is simply "no key"
      ip := nullif(btrim(split_part(coalesce(current_setting('request.headers', true)::json ->> 'cf-connecting-ip', current_setting('request.headers', true)::json ->> 'x-forwarded-for', ''), ',', 1)), '');
    exception when others then ip := null; end;
    if ip is not null then
      key := encode(sha256(convert_to(ip || lim.guest_salt, 'utf8')), 'hex');
      if (select count(*) from public.fight_records where guest_key = key and created_at > now() - interval '1 minute') >= lim.guest_per_key_per_minute then
        raise exception 'too many shares from here this minute' using errcode = 'P0001';
      end if;
    end if;
    if (select count(*) from public.fight_records where user_id is null and created_at > now() - interval '1 minute') >= lim.guest_per_minute then
      raise exception 'too many guest shares this minute' using errcode = 'P0001';
    end if;
    if (select count(*) from public.fight_records where user_id is null) >= lim.guest_rows then
      raise exception 'guest shares are full' using errcode = 'P0001';
    end if;
  elsif public.fight_records_recent() >= 30 then
    raise exception 'thirty shares an hour' using errcode = 'P0001';
  end if;
  new_id := public.to_base36(nextval('public.share_ids'));
  insert into public.fight_records (id, user_id, opponent, record, guest_key) values (new_id, uid, mint_share.opponent, mint_share.record, key);
  return new_id;
end $$;

-- Retention: guest rows older than share_limits.guest_days go. Owner-only; the daily job below calls it, and the local RLS check calls it
-- directly. Returns the number pruned.
create function public.prune_guest_shares() returns integer language sql security definer set search_path = public as $$
  with gone as (delete from public.fight_records where user_id is null and created_at < now() - make_interval(days => (select guest_days from public.share_limits)) returning 1)
  select count(*)::integer from gone
$$;
revoke all on function public.prune_guest_shares() from public, anon, authenticated;

-- The daily job, where pg_cron exists (hosted Supabase: yes; the local check cluster: no — guarded). cron.schedule by name is an upsert.
do $$ begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('frankendom_guest_share_retention', '17 4 * * *', 'select public.prune_guest_shares()');
  end if;
end $$;

-- Hygiene: Supabase's default grant gave clients TRUNCATE, TRIGGER and REFERENCES on tables created without a revoke-all. Unreachable
-- through PostgREST, but least privilege is the rule here.
revoke truncate, trigger, references on public.fight_records, public.daily_results, public.daily_board from anon, authenticated;
commit;
