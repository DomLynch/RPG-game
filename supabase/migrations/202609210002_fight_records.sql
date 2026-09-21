begin;
-- Shared fight records (beta plan brief 3, the short-id share route; Strategy 2026-09-21). A signed-in fighter's Share stores the encoded
-- record (src/record.ts, base64url gzip) under a short unguessable id so the link carries the id, not the record; guests keep the record
-- in the URL. Anyone with the id can read the row (a shared link is public by intent); only the signed-in owner can insert, at most
-- 30 an hour, at most 16 KB each. Never updated or deleted by the client. Brief 4's daily submit reuses this record shape.
create table public.fight_records (
  id text primary key check (id ~ '^[A-Za-z0-9_-]{8}$'),
  user_id uuid not null references auth.users (id) on delete cascade,
  opponent text not null check (char_length(opponent) between 1 and 32),
  record text not null check (octet_length(record) <= 16384 and record ~ '^[A-Za-z0-9_-]+$'),
  created_at timestamptz not null default now()
);
create index fight_records_owner_recent on public.fight_records (user_id, created_at desc);
alter table public.fight_records enable row level security;
create policy "a shared fight is read by its id" on public.fight_records for select to anon, authenticated using (true);
create policy "a fighter stores his own, thirty an hour" on public.fight_records for insert to authenticated
  with check (auth.uid() = user_id and (select count(*) from public.fight_records r where r.user_id = auth.uid() and r.created_at > now() - interval '1 hour') < 30);
grant select on public.fight_records to anon, authenticated;
grant insert (id, user_id, opponent, record) on public.fight_records to authenticated;
comment on table public.fight_records is 'Shared fight records by short id (beta): public read by id, owner-only bounded insert, no update or delete from the client.';
commit;
