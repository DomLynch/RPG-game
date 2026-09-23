begin;
-- Server-authoritative marks and loot (brief 19 deliverable 3; Strategy's ruling 2026-09-23, design agreed with Backend). Every verified
-- ladder win is one server mark and at most one award; `fighter_profiles.victory_marks` and `.loot` stay as the device's caches and are
-- read once, by the seed below, and never again. Server marks = account_seed.marks + count(verified claims); server owned = account_seed.owned ∪ awards.
--
-- account_seed: progress earned before this migration, grandfathered rather than reset. Written ONLY by the `insert … select` below, at
-- apply time: no uuid or loot is in git, no function or grant can write it again, so it is one-off by construction.
create table public.account_seed (
  user_id uuid primary key references auth.users (id) on delete cascade,
  marks integer not null check (marks between 0 and 100000),
  owned jsonb not null check (jsonb_typeof(owned) = 'array'),   -- no size cap: copied once from loot's own 4 KB bound, and a cap here could only fail the apply
  seeded_at timestamptz not null default now()
);
alter table public.account_seed enable row level security;
revoke all on public.account_seed from public, anon, authenticated;
insert into public.account_seed (user_id, marks, owned)
  select user_id, victory_marks, case when jsonb_typeof(loot->'owned') = 'array' then loot->'owned' else '[]'::jsonb end from public.fighter_profiles;

-- loot_claims: the client posts one for EVERY ladder win, before Share is offered. Unverified until the verifier replays the record.
-- `piece` is only the "Take one" weapon choice; an armour drop carries none, the verifier computes it (src/loot.ts dropFor). The record
-- hash is unique GLOBALLY: one fight, one claim, whoever posts it first.
create table public.loot_claims (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  opponent text not null check (opponent ~ '^[a-z]{1,32}$'),
  piece text check (piece ~ '^[a-z]{1,32}\.[A-Za-z]{1,32}$'),
  record text not null check (octet_length(record) <= 16384 and record ~ '^[A-Za-z0-9_-]+$'),
  record_hash text not null generated always as (encode(sha256(record::bytea), 'hex')) stored unique,
  verified boolean not null default false,
  checked_at timestamptz,
  created_at timestamptz not null default now()
);
create index loot_claims_owner_recent on public.loot_claims (user_id, created_at desc);
create index loot_claims_pending on public.loot_claims (created_at) where not verified;
alter table public.loot_claims enable row level security;
revoke all on public.loot_claims from public, anon, authenticated;
-- The rate cap counts the caller's own claims through a definer function: the insert policy cannot see rows it has no select on.
create function public.loot_claims_recent() returns bigint language sql stable security definer set search_path = '' as
  $$select count(*) from public.loot_claims where user_id = auth.uid() and created_at > now() - interval '1 hour'$$;
revoke all on function public.loot_claims_recent() from public, anon;
grant execute on function public.loot_claims_recent() to authenticated;
create policy "a fighter claims his own wins, sixty an hour" on public.loot_claims for insert to authenticated
  with check (user_id = auth.uid() and not verified and public.loot_claims_recent() < 60);
create policy "a fighter reads his own claims" on public.loot_claims for select to authenticated using (user_id = auth.uid());
grant insert (opponent, piece, record) on public.loot_claims to authenticated;
grant select (id, user_id, opponent, piece, verified, created_at) on public.loot_claims to authenticated;   -- user_id: the awards policy joins on it; RLS keeps it to his own rows

-- awards: no user_id column. The owner is the claim's, through the join, so a leaked verifier credential has nothing to redirect an
-- award with: it can only award the piece of a claim that already exists, is verified, and has no award yet.
create table public.awards (
  claim_id bigint primary key references public.loot_claims (id) on delete cascade,
  piece text not null check (piece ~ '^[a-z]{1,32}\.[A-Za-z]{1,32}$'),
  tier smallint not null check (tier between 1 and 10),   -- src/grades.ts levelOf(tierAt(server marks before the win))
  awarded_at timestamptz not null default now()
);
alter table public.awards enable row level security;
revoke all on public.awards from public, anon, authenticated;
create policy "a fighter reads his own awards" on public.awards for select to authenticated
  using (exists (select 1 from public.loot_claims c where c.id = claim_id and c.user_id = auth.uid()));
grant select (claim_id, piece, tier, awarded_at) on public.awards to authenticated;
-- Every award is backed by a verified claim, and a verified claim stays verified.
create function public.award_needs_verified_claim() returns trigger language plpgsql set search_path = '' as $$
begin
  if not exists (select 1 from public.loot_claims where id = new.claim_id and verified) then
    raise exception 'claim % is not verified', new.claim_id using errcode = 'check_violation';
  end if;
  return new;
end$$;
create trigger awards_verified before insert on public.awards for each row execute function public.award_needs_verified_claim();
create function public.claim_stays_verified() returns trigger language plpgsql set search_path = '' as $$
begin
  if old.verified and not new.verified then raise exception 'claim % is verified and stays so', old.id using errcode = 'check_violation'; end if;
  return new;
end$$;
create trigger loot_claims_verified_one_way before update on public.loot_claims for each row execute function public.claim_stays_verified();

-- The verifier (202609210005's role, the VPS sweep): reads pending claims and the seed, flips `verified`, inserts an award. Nothing else.
grant select on public.account_seed to frankendom_verifier;
grant select (id, user_id, opponent, piece, record, verified, checked_at, created_at) on public.loot_claims to frankendom_verifier;
grant update (verified, checked_at) on public.loot_claims to frankendom_verifier;
grant select on public.awards to frankendom_verifier;
grant insert (claim_id, piece, tier) on public.awards to frankendom_verifier;
create policy "the verifier reads the seed" on public.account_seed for select to frankendom_verifier using (true);
create policy "the verifier reads every claim" on public.loot_claims for select to frankendom_verifier using (true);
create policy "the verifier marks claims checked" on public.loot_claims for update to frankendom_verifier using (true) with check (true);
create policy "the verifier reads every award" on public.awards for select to frankendom_verifier using (true);
create policy "the verifier awards" on public.awards for insert to frankendom_verifier with check (true);

-- One account's server standing, as the client and the verifier read it. Never reads fighter_profiles: the device caches are not truth.
create function public.standing_of(account uuid) returns table (marks integer, owned jsonb) language sql stable security definer set search_path = '' as $$
  select coalesce((select s.marks from public.account_seed s where s.user_id = account), 0)
           + (select count(*) from public.loot_claims c where c.user_id = account and c.verified)::integer,
         (select coalesce(jsonb_agg(p order by p), '[]'::jsonb) from (
            select jsonb_array_elements_text(s.owned) as p from public.account_seed s where s.user_id = account
            union
            select a.piece from public.awards a join public.loot_claims c on c.id = a.claim_id where c.user_id = account) pieces)
$$;
revoke all on function public.standing_of(uuid) from public, anon, authenticated;
grant execute on function public.standing_of(uuid) to frankendom_verifier;
create function public.my_standing() returns table (marks integer, owned jsonb) language sql stable security definer set search_path = '' as
  $$select * from public.standing_of(auth.uid()) where auth.uid() is not null$$;
revoke all on function public.my_standing() from public, anon;
grant execute on function public.my_standing() to authenticated;

comment on table public.account_seed is 'Pre-server progress, grandfathered once by migration 202609230001. No client access; no writer after apply.';
comment on table public.loot_claims is 'One claim per ladder win (global unique record hash); owner insert, verifier flips verified. The mark ledger.';
comment on table public.awards is 'Loot the verifier awarded against a verified claim. No user_id: the owner is the claim''s.';
commit;
