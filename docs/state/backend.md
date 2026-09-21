# Backend & Accounts — project state

One truth for the hosted Supabase project (`rxbewmzmovelckzoosss`) and the migrations under `supabase/migrations/`. Owned by the
Backend/Accounts lane; every migration from any lane gets this lane's "apply-ready" review before Dev/Deploy applies it at the deploy
that carries the client change, and this file is re-verified against the hosted project after each apply. Append new entries at the
TOP. "Verified" below means this lane's own query output (Supabase MCP `list_tables` / `list_migrations` / `execute_sql`), never a relay.

## Hosted project as it stands — verified 2026-09-22 ~00:20 UTC

Tables: `public.fighter_profiles` (1 row), `public.admins` (1 row), `public.fight_records` (0 rows), `public.daily_secret` (1 row, RLS
on, unreadable — see below), `public.daily_results` (0 rows, RLS on). View `public.daily_board` and function `public.daily_fight()`
both exist (confirmed directly via `pg_views`/`pg_proc`, since `list_tables` doesn't enumerate views). `auth.users`: 2. Roles named
`frankendom*`: none yet (0005 not applied). Hosted migration history (`supabase_migrations.schema_migrations`):
`20260920031013 werewolf_skeleton_encounters`, `20260920031925 revert_werewolf_skeleton_encounters`, `20260920041658
werewolf_skeleton_encounters_v2`, `20260920055946 werewolf_skeleton_encounters`, `20260920070348 victory_marks`, `20260920083450
dwarf_encounter`, `20260921065907 admins`, `20260921200632 202609210002_fight_records`, `20260921211439 202609210003_daily_warden`.
The first two repo files
(`202609190001_fighter_profiles`, `202609190002_creature_encounters`) were applied by hand and are not in the history; the
werewolf/skeleton change was applied three times with one revert. The history is therefore NOT `supabase db push`-able against the
repo; applies stay manual (MCP `apply_migration` named after the repo file) and this table is the map between the two.
`public.rls_auto_enable()` (event trigger `ensure_rls`) is Supabase's own platform function, not ours; the security advisor's WARN on it
is expected and stays.

**0002 fight_records — APPLIED** (Dev/Deploy, hosted migration `20260921200632`, carried by deploy #70 / trunk `3a11413`). Verified
independently here via `list_tables`(verbose)/`list_migrations`: schema matches what was reviewed byte-for-byte (see the table below),
RLS enabled, 0 rows. Deploy dev's own report of deploy #70 being live (release.json/VPS symlink match) was not independently checked
by this lane — that's Lead/Deploy's domain, not re-verified here.

### fighter_profiles (0001, 0002 creature encounters, 0003/20260920 werewolf+skeleton, 20260920 dwarf, 0004 victory_marks)
| column | type | rule |
|---|---|---|
| user_id | uuid pk → auth.users on delete cascade | owner only |
| display_name | text not null | 1–24 chars, trimmed, no control chars |
| encounter | text null | one of the roster ids in the check (veteran, pitborn, goblin, nightborn, executioner + the creature/dwarf additions) |
| revision | bigint not null default 1 | bumped by trigger `fighter_revision` → `bump_fighter_revision()` on every update; the client never writes it |
| victory_marks | integer not null default 0 | 0–100000, client-reported career marks (beta), never competitive authority |

RLS on. Policies: `owner_read` select, `owner_insert` insert, `owner_update` update — all `to authenticated`, `(select auth.uid()) = user_id`.
Grants: `authenticated` select (whole table) + insert/update on `(display_name, encounter, victory_marks)` and insert on `user_id`; `anon` nothing.
Client calls: `GET/POST/PATCH /rest/v1/fighter_profiles` (src/cloud-profile.ts, mocked in release check 14).

### admins (202609210001)
`user_id uuid pk → auth.users cascade`, `created_at timestamptz default now()`. RLS on; policy `self_read` select to authenticated on own row;
grant `select (user_id)` to authenticated only. No client insert/update/delete path exists (proven in `scripts/account-database-check.mjs`).
Rows are owner-managed in SQL. Current roster: one row (dom123dxb, inserted by the lead via SQL on Dom's word, 2026-09-21).
Client call: `GET /rest/v1/admins?select=user_id&user_id=eq.<uid>` (src/cloud-profile.ts `readAdmin`).

## After 202609210003–0005 land (files in PRs #327, #330, #348 — reviewed by this lane 2026-09-21; NOT applied yet)

Apply order and carrier, per Dom's standing yes in the deploy session: 0002 applied (above), 0003 at #327's deploy, 0004 BEFORE #330's
code, 0005 at #348's. All are additive: the live client is unaffected by an early apply. Dev/Deploy applies; this lane verifies after.

### fight_records (0002) — APPLIED, schema below as it exists on the hosted project today; one tightening still open
| column | rule |
|---|---|
| id text pk | `^[A-Za-z0-9_-]{8}$`, client-chosen; a collision is a 23505 the client must retry |
| user_id uuid → auth.users cascade | owner |
| opponent text | 1–32 chars |
| record text | ≤ 16 KB, base64url alphabet (src/record.ts encoding) |
| created_at | default now() |
Index `(user_id, created_at desc)`. RLS on. Policies: select `to anon, authenticated using (true)` (a shared link is public by intent);
insert `to authenticated` with check `auth.uid() = user_id and` fewer than 30 own rows in the last hour. No update/delete policy or grant.
Grants: select whole table to anon+authenticated; insert `(id, user_id, opponent, record)` to authenticated.
Client calls: `POST /rest/v1/fight_records` (src/share-store.ts), `GET /rest/v1/fight_records?select=record&id=eq.<id>`.
**0006 (PR #359, code merges tonight; hosted apply HELD for Dom's direct word in the morning — first item):** written, tests +
mutation-tests green (30/hour cap re-proven via a new `security definer` function keyed to `auth.uid()`, not a caller-supplied id —
an earlier draft took a `uid` argument, which would have let any signed-in player query another player's recent-post count via RPC;
fixed before merge). Narrows the select grant to `(id, opponent, record)`, dropping `user_id`/`created_at` from what a link-holder can
read. Not additive (it's a revoke), so per tonight's rule it needs Dom's own yes, not Strategy's or this lane's — Dev/Deploy's
authorization from Dom names 0002–0005 only. Apply-ready line already given to Dev/Deploy; nothing further from this lane until Dom
says go.

### daily_secret / daily_fight() / daily_results / daily_board (0003, PR #327) — APPLIED, verified live
Applied by Dev/Deploy (hosted migration `20260921211439 202609210003_daily_warden`, head lead/daily-warden `8550b1d`). Verified
independently here (fresh `list_tables`/`list_migrations`/`pg_views`/`pg_proc` plus role-scoped queries, not taken on Dev/Deploy's
report): `daily_secret` (1 row, RLS on) and `daily_results` (0 rows, RLS on) exist; `daily_board` view and `daily_fight()` function
both exist; `set role anon; select count(*) from daily_board` resolves (0); `daily_fight()` for tomorrow (UTC) returns no row, for
today returns `{day, number:-1, seed}` — `-1` is correct, day zero is `2026-09-22`.

The narrowed `daily_results` select grant was verified both ways, not just the refusal: `set role anon; select user_id from
daily_results` → refused (`42501 permission denied`); `set role anon; select day, number, opponent, weapon, outcome, ticks, location,
taken, verified, created_at from daily_results` → resolves (empty, no error) — so the grant is scoped, not accidentally revoked
entirely. Not that the client needs direct table access at all: confirmed in `src/daily.ts` (trunk) that the client only ever
`insert`s into `daily_results` and reads exclusively through the `daily_board` view (`fetchDailyBoard`) — the table-level select grant
on the permitted columns is defensive/pattern-consistency with `fight_records`, not load-bearing for anything shipped today.

**OPEN ACTION for Lead (not resolved by this lane, tracked here so it isn't lost — recorded 2026-09-22, not verified against the live
client code by me, only described by Lead in chat):** the client maps `number` to a rung with a positive modulo (`src/daily.ts:21`),
so `-1` plays the last rung safely, but the banner reportedly reads "Daily #-1" / "Daily #0" before the count is right for a player.
Proposed fix (Lead's, not this lane's, and NOT independently checked against `main.ts` here): show `number + 1` in the three banner
strings (`main.ts:385/390/401`) and the share text. Do **not** "fix" the check constraint — `day` zero staying `2026-09-22` in the DB
is correct and intentional. Lead owns this in the PR after #327; strike this note once it ships.

File content, as applied:
- `daily_secret (id boolean pk default true check (id), secret text)`: RLS on, no policies, all grants revoked from anon/authenticated;
  one row `encode(gen_random_bytes(32),'hex')`. The migration now opens with `create extension if not exists pgcrypto;` — hosted
  Supabase already has it enabled, this is a no-op there; the local RLS check's `initdb` cluster does not, so this line is required
  for the check to run at all (CI caught its absence).
- `daily_fight(on_day date default today-UTC) returns (day, number, seed)`: `security definer`, `set search_path = public`, stable; execute
  revoked from public, granted to anon+authenticated. `number = on_day - 2026-09-22`; `seed = first 8 hex of md5(day||secret) as int4`
  (the client uses it unsigned, `>>> 0`). The security advisor will WARN "anon can execute a definer function" — intentional, the seed is
  public by design and the secret never leaves the function. Now has `where on_day <= (now() at time zone 'utc')::date`, so a future
  day returns no row; `src/daily.ts fetchDaily` already treats that as "no daily warden today," no client change needed.
- `daily_results`: pk `(day, user_id)` = "insert own once"; `number int`, `opponent`/`weapon` 1–32, `outcome in (killed, died, draw,
  abandoned)`, `ticks 0–100000`, `location in (head, torso, legs) null`, `taken 0–1000 default 0`, `record` ≤ 16 KB base64url,
  `verified boolean default false` (server-only), `created_at`. Index `(day, outcome, ticks)`. RLS on. Policies: select public
  (anon+authenticated); insert to authenticated with check `auth.uid() = user_id and day = today-UTC`. No update/delete for clients.
  Grants: insert `(day, user_id, number, opponent, weapon, outcome, ticks, location, taken, record)`; select is now the narrowed column
  list `(day, number, opponent, weapon, outcome, ticks, location, taken, verified, created_at)` — `user_id` and `record` (the day's raw
  input stream, i.e. the solution to a one-attempt fight) are excluded, closing what a direct `/rest/v1/daily_results?select=*` call
  could otherwise read even though the board view never carried them. Also has `check (number = day - date '2026-09-22')`, so a client
  cannot post a mismatched day/number pair. Neither needs a client change: the board view still resolves (next line), and #327's insert
  already sends the derived `number`.
- `daily_board` view: the day's rows joined to `fighter_profiles.display_name`, never `record` or `user_id`; select granted to
  anon+authenticated. The view has no `security_invoker`, so it reads `fighter_profiles` as its owner — that is what lets a public board
  show a poster's display name past `owner_read`; the advisor will flag it (lint 0010), accepted and documented here.
Client calls: `POST /rest/v1/rpc/daily_fight`, `GET /rest/v1/daily_board?select=*&day=eq.<day>&order=created_at.asc&limit=200`,
`POST /rest/v1/daily_results` (src/daily.ts) — all three already in the check-14 mock on the #327 branch.
**Verifier follow-ups (owned here, after #348 merges):** `taken` and `location` are client-reported and feed the "cleanest kill" and
"where he killed people" boards, but `verify-daily.mjs` compares only opponent/weapon/outcome/ticks/seed/profile — the replay must also
confirm `taken` and `location`, and boards must rank verified rows only.

### fighter_profiles.loot (0004, PR #330) — apply-ready
`loot jsonb not null default '{"owned":[],"equipped":{}}'`, check: object with `owned` array and `equipped` object, `pg_column_size ≤ 4096`;
insert/update grant on `(loot)` to authenticated. Client-reported cosmetics; `src/loot.ts cleanLoot` validates on read (known ids only, worn ⊆
owned). Never rank/result/unlock authority.

### frankendom_verifier role + daily_results.checked_at (0005, PR #348) — apply-ready; password set by Dev/Deploy, not this lane
`alter table daily_results add column checked_at timestamptz` (refused rows are stamped so the sweep moves on; `--recheck` revisits).
`create role frankendom_verifier login` (Dev/Deploy sets the password on the host at apply time, straight into the VPS unit's env
file, never in the repo and never held by this lane — see the checklist below);
usage on schema public; `select (day, user_id, opponent, weapon, outcome, ticks, record, verified, checked_at, created_at)` and
`update (verified, checked_at)` on daily_results; execute on `daily_fight(date)`; its own RLS policies (select all, update all) on
daily_results. Nothing else. The VPS connects through the Supabase pooler as `frankendom_verifier.rxbewmzmovelckzoosss`.

**#348 arming checklist (takeover from Dev/Deploy; read from their PR branch, not written by this lane — no VPS writes here):**
1. Apply 0005 (this section) to hosted; confirm `frankendom_verifier` exists and its grants match above.
2. Dev/Deploy generates the password and runs `alter role frankendom_verifier password '<generated>';` themselves, at the moment
   they apply 0005, and writes it straight into `/etc/frankendom/verifier.env` (root:600) on the VPS. This lane never holds or
   sets the secret — one hand stays on the hosted DB, and nothing leaves the VPS onto the shared Mac or into chat. Backend verifies
   afterward (below), it doesn't generate.
3. `/etc/frankendom/verifier.env` on the VPS (Dev/Deploy writes; root:600, checked by `deploy.sh` before it arms the timer):
   ```
   DATABASE_URL=postgres://frankendom_verifier:<password>@<pooler-host>:<pooler-port>/postgres
   ```
   (the `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` pair is `verify-daily.mjs`'s alternate route — a service-role key bypasses RLS
   entirely, wider than this role needs, so the scoped `DATABASE_URL` role is the one to use, not the service-role fallback.)
4. `scripts/deploy.sh` (already in #348) rsyncs `src/**/*.ts`, `scripts/verify-daily.mjs` and the two `ops/frankendom-verify-daily.*`
   unit files to `/opt/frankendom-verifier/<revision>`, symlinks `current`, and — only if `verifier.env` already exists at root:600 —
   installs the units and runs `systemctl enable --now --quiet frankendom-verify-daily.timer`. Until the env file exists, it ships the
   code and leaves the timer alone (prints why); this is deploy.sh's existing behavior, not something new to build.
5. Unit shape: `frankendom-verify-daily.service` is a `oneshot` running `node scripts/verify-daily.mjs` with that env file, logging to
   `/var/log/frankendom-verify-daily.log`; `frankendom-verify-daily.timer` fires it every 2 minutes (`OnBootSec=2min`,
   `OnUnitActiveSec=2min`). `node scripts/verify-daily.mjs --dry` replays without writing; `--recheck` re-sweeps refused rows.
6. After arming: confirm a `daily_results` row moves from `verified=false` to `true` (or gets `checked_at` stamped with a refusal
   reason) within one timer cycle, and post that receipt here.

## Rules every lane inherits
- Client-reported data is never rank, result or unlock authority for anything competitive; only server-verified rows count.
- No secret readable by anon or authenticated; secrets live in RLS-on tables with no grants, read only by definer functions.
- Migrations ship inside the PR that needs them; Backend reviews ("apply-ready" or the change), Dev/Deploy applies at that PR's deploy,
  in order, reports table names; Backend verifies the applied state and updates this file. Nobody else touches the hosted project.
- Every new client REST/RPC path is told to the lead before it lands so release check 14's route mock learns it.
- `scripts/account-database-check.mjs` (real local PostgreSQL, zero production writes) is the RLS suite: every table's policies are
  proven there — second insert refused, update refused, secret unreadable, guest read-only. Supabase branching is not used (owner spend).
- A migration that needs a Postgres extension (e.g. `pgcrypto` for `gen_random_bytes`) must `create extension if not exists` it in the
  migration file itself, not assume it's already enabled — hosted Supabase has several pre-enabled, the check's local `initdb` cluster
  has none (caught by CI on 202609210003; fixed at lead/daily-warden `e0f7380`).
- A date used in `scripts/account-database-check.mjs` must be computed in the same zone as the guard it exercises: an unqualified
  `current_date` takes the *machine's* local timezone, while the daily-warden guards compare against `(now() at time zone 'utc')::date`.
  Past local midnight on a machine east of Greenwich (e.g. UTC+4, still yesterday in UTC), the two dates disagree and a genuinely correct
  guard reads as broken. The daily/loot block now opens with `set time zone 'UTC';`. Reproduced independently: the pre-fix check run
  under `TZ=Asia/Dubai` failed with "Authenticated cannot fetch today's daily seed"; the fixed check (lead/loot-data `d5b0a89`) passes
  under the same `TZ`.
