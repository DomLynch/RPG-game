begin;
-- One short share id for everyone (Dom via Strategy, 2026-09-22: a kill link ran to several WhatsApp screens). Ids are minted on the
-- server from a sequence, lowercase base-36, so they are as short as they can be ("1", "2", … "z", "10", … — 999,999 shares is
-- still 4 characters) and the same shape for guests and signed-in fighters: frankendom.com/s/<id>. Sequential ids are enumerable by
-- design: a shared fight is public by intent (0002), and the row exposes only (id, opponent, record) (0006). The old random
-- 8-character ids keep resolving; nothing is rewritten.
create sequence public.share_ids as bigint start with 1;
revoke all on sequence public.share_ids from public;

-- Lowercase base-36 of a non-negative bigint, no padding.
create function public.to_base36(n bigint) returns text language plpgsql immutable strict set search_path = '' as $$
declare digits constant text := '0123456789abcdefghijklmnopqrstuvwxyz'; v bigint := n; s text := '';
begin
  if v < 0 then raise exception 'to_base36: negative'; end if;
  if v = 0 then return '0'; end if;
  while v > 0 loop s := substr(digits, (v % 36)::integer + 1, 1) || s; v := v / 36; end loop;
  return s;
end $$;
revoke all on function public.to_base36(bigint) from public;

-- Guests share too: a guest's row has no owner. The foreign key stays for rows that have one.
alter table public.fight_records alter column user_id drop not null;
-- Old ids are 8 characters of [A-Za-z0-9_-]; minted ids are 1–6 lowercase base-36 characters. Both stay valid; nothing longer does.
alter table public.fight_records drop constraint fight_records_id_check;
alter table public.fight_records add constraint fight_records_id_check check (id ~ '^[a-z0-9]{1,6}$' or id ~ '^[A-Za-z0-9_-]{8}$');

-- mint_share: the only way the client stores a shared fight from here on. Runs as the table owner (no insert grant is needed and the
-- insert policy does not apply), so the caps live here: a signed-in fighter keeps the 0002/0006 cap of thirty an hour (the same
-- fight_records_recent() the insert policy uses); guests, who have no identity to count, share one coarse cap of sixty a minute
-- across all guests — enough to stop a loop, not a fairness mechanism. The table's own checks (opponent 1–32, record ≤ 16 KB
-- base64url) still fire on the insert and surface to the caller as errors. Returns the new id.
create function public.mint_share(record text, opponent text) returns text language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); new_id text;
begin
  -- Validate before taking a sequence value: a refused insert would still consume one (sequences are not transactional), and a loop
  -- of bad input must not be able to lengthen everyone's ids. Same predicates as the table's checks, same error class.
  if opponent is null or char_length(opponent) not between 1 and 32 then raise exception 'opponent must be 1–32 characters' using errcode = 'check_violation'; end if;
  if record is null or octet_length(record) > 16384 or record !~ '^[A-Za-z0-9_-]+$' then raise exception 'record must be base64url, at most 16 KB' using errcode = 'check_violation'; end if;
  if uid is null then
    if (select count(*) from public.fight_records where user_id is null and created_at > now() - interval '1 minute') >= 60 then
      raise exception 'too many guest shares this minute' using errcode = 'P0001';
    end if;
  elsif public.fight_records_recent() >= 30 then
    raise exception 'thirty shares an hour' using errcode = 'P0001';
  end if;
  new_id := public.to_base36(nextval('public.share_ids'));
  insert into public.fight_records (id, user_id, opponent, record) values (new_id, uid, mint_share.opponent, mint_share.record);
  return new_id;
end $$;
revoke all on function public.mint_share(text, text) from public;
grant execute on function public.mint_share(text, text) to anon, authenticated;
comment on function public.mint_share(text, text) is 'Stores a shared fight under the next short base-36 id and returns it; guests allowed (no owner); caps: 30/hour per fighter, 60/minute across all guests. Ids are sequential and public by design.';
commit;
