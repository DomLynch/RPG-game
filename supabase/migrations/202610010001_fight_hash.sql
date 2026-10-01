begin;
-- One fight, one claim, keyed on the FIGHT, not on its string (Auditer F2 on 0895d84c, Strategy's ruling A+ 2026-10-01). 202609230001's
-- record_hash hashes the encoded record, and gzip is not canonical: the same fight re-gzipped is a new hash, a second mark and a second
-- award, and anyone's public kill link could be claimed as his own win. The database cannot gunzip, so the verifier writes `fight_hash`
-- (scripts/verify-loot.mjs: sha256 of src/record.ts fightBytes, the decoded fight with its build label blanked) on every claim and every
-- shared fight before it settles anything, and refuses a claim whose fight an earlier claim already won ("same fight as claim N") or
-- whose fight was first shared by another account or a guest ("someone else's shared fight"). record_hash stays: it still stops the
-- exact same string at insert (23505), which the client outbox already drops. No client change: clients cannot write either column.
alter table public.loot_claims add column fight_hash text check (fight_hash ~ '^[0-9a-f]{64}$');
alter table public.fight_records add column fight_hash text check (fight_hash ~ '^[0-9a-f]{64}$');
-- The database's own guarantee behind the verifier's refusal: two verified claims can never carry one fight (the sweep writes the hash
-- before it settles, so a duplicate's flip to verified fails here even if the verifier's check were wrong). Refused claims may share it.
create unique index loot_claims_one_win_per_fight on public.loot_claims (fight_hash) where verified;
create index loot_claims_fight on public.loot_claims (fight_hash);
create index fight_records_fight on public.fight_records (fight_hash, created_at, id);
create index loot_claims_unhashed on public.loot_claims (id) where fight_hash is null;
create index fight_records_unhashed on public.fight_records (created_at) where fight_hash is null;

-- The verifier: writes the hash on both tables, and reads a shared fight's owner, record and age. Still no insert, delete or other update.
grant select (fight_hash) on public.loot_claims to frankendom_verifier;
grant update (fight_hash) on public.loot_claims to frankendom_verifier;
grant select (id, user_id, record, created_at, fight_hash) on public.fight_records to frankendom_verifier;
grant update (fight_hash) on public.fight_records to frankendom_verifier;
create policy "the verifier hashes every shared fight" on public.fight_records for update to frankendom_verifier using (true) with check (true);
-- fight_records' select policy is to anon and authenticated only; the verifier gets its own.
create policy "the verifier reads every shared fight" on public.fight_records for select to frankendom_verifier using (true);
commit;
