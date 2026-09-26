# Backend & Accounts — project state

One truth for the hosted Supabase project (`rxbewmzmovelckzoosss`) and the migrations under `supabase/migrations/`. Owned by the
Backend/Accounts lane; every migration from any lane gets this lane's "apply-ready" review before Dev/Deploy applies it at the deploy
that carries the client change, and this file is re-verified against the hosted project after each apply. Append new entries at the
TOP. "Verified" below means this lane's own query output (Supabase MCP `list_tables` / `list_migrations` / `execute_sql`), never a relay.

## 2026-09-26 22:1x — 202609260001_loot_size applied on hosted (Lead's PR; Backend to re-verify with its own queries)
**Applied on hosted 2026-09-26 22:1x by Strategy**, in the owner's signed-in Supabase SQL editor (no session had the MCP or a DB URL),
as the file's two statements; NOT via `apply_migration`, so it is **not in `schema_migrations`**: add it to the map above.
Receipts relayed by Strategy (not yet this lane's own): before, `fighter_profiles_loot_check` ended `pg_column_size(loot) <= 4096`;
after, `<= 65536` ("Success. No rows returned"). The owner's row at the time: 789 bytes, owned 23, revision 39 (the last save that fit).
Cause: 0004's 4 KB cap sat below legitimate client writes (declined alone at its cap of 50 ≈ 4.9 KB), so every larger save hit
check_violation 23514 and the client showed "changed on another device" for it. The same PR splits that line (src/cloud-profile.ts
saveFailure): conflict / too large / failed + Sentry. Local proof: account-database-check PASS with the file; FAILS without it on the
new >4 KB assertion with exactly the hosted error. Owner's cap ruling: 64 KB ("keep it 64kb"). Open: rate limiting and loot-JSON shape
validation on the write path are the only abuse controls besides this backstop (shape: the CHECK's type tests + client cleanLoot) —
a follow-up for this lane, not a blocker.

## Now — pick up here (2026-09-23)

**Review Stats' deliverable 3 before it goes READY** (beta item 3, "server-controlled gear bonuses"; assigned by Strategy 2026-09-23).
The server decides the loot award; the client cannot grant itself gear. Look hardest at the **record/verifier path** and **any
migration** (RLS, grants, who can write the award). Wait for Stats' heads-up with the branch; send the verdict to Stats and copy
**both Lead and Strategy** (Strategy, 2026-09-23: Lead is active again and lanes report to Lead). Deploy applies any migration — this lane reviews and verifies after, never applies.
Authority for scope: **`docs/SCOPE.md`** (PR #492) wins over every older brief, state entry or memory line, this file included.
Line 20: *"Loot awards become server-authoritative before stats touch a fight"* — it replaces Brief 5's cosmetic-only rule, so the
0004 rule below ("client-reported loot, never competitive authority") **ends with this deliverable**.
**Agreed design — Stats accepted all of it 2026-09-23; review the branch AGAINST this.** **Strategy RULED 2026-09-23 — unblocked; Stats builds, PR through Lead.** (1) `loot_claims`: owner-only insert, size + rate caps, **unique on `sha256(record)` globally** (one award per fight; first
claimer wins, so the client posts the claim *before* offering Share). **No `piece` for armour** — `dropFor` (src/loot.ts:65) is
deterministic, so the verifier computes it; `piece` only for the "Take one" weapon choice, validated by the verifier **importing
`src/loot.ts`** (no LOOT mirror in SQL — one list, two readers). (2) `awards(claim_id pk references loot_claims(id), piece, tier,
awarded_at)` with **no `user_id` column**; owner-select via the join; verifier gets `insert (claim_id, piece, tier)` only + a trigger
refusing unverified claims — so a leaked verifier credential cannot mint loot for an arbitrary account. (3) **Marks: RULED (a)** — the verified-claim ledger *is* the mark ledger (one verified ladder win = one mark); `victory_marks`
and `owned` are caches. (b) rejected: a record-carried rung is replay-checked only once the sim reads the tier (deliverable 5), and
awards land before that. **Grandfather, not reset:** `account_seed(user_id pk, marks 0–100000, owned jsonb, seeded_at)`, written
**once by the migration** via `insert … select` from `fighter_profiles` at apply time (never hardcoded — no account uuid/loot in
git; the receipt logs a non-identifying summary), no client grant, not re-runnable. Server marks = `seed.marks + count(verified
wins)`; server owned = `seed.owned ∪ awards`; `awards` stays verified-only. **Guests:** device-only cache, no server award; on
guest→account the account's server marks start at **zero** from its first verified win, so a forged guest cache never becomes rank.
**Acceptance = the DB check, every case mutation-tested:** client cannot write `awards`; client cannot flip a claim's `verified`;
verifier cannot award a nonexistent claim; second award per claim refused; owner sees only own awards; anon none; duplicate record
hash refused; claim caps trip; plus Strategy's four — **seed** (fixture profile seeded exactly, once), **verified win** (server marks = seed + 1, drop =
`dropFor` at the server's subRank), **guest convert** (no seed row → 0, first verified win → 1), **forged cache rejected** (client writes
`victory_marks = 100000` + an Origin piece → server marks/owned unchanged). **Out of Stats' scope, flagged:** records carry no account binding — a record-format change, **Lead's next item** after this (Strategy); same hole in
`daily_results` today and guests can't hold awards (Strategy).
Nothing else for Backend in beta unless phone validation (item 6) finds an account or sync defect — that comes from Web.

## Done (2026-09-21 → 09-23)

- **Hosted migrations 0002–0010 all applied and verified by this lane's own queries** (never a relay): fight_records, daily
  warden, loot column, verifier role, fight_records column narrowing, daily_board_summary, rls_auto_enable revoke, short share ids,
  guest-share hygiene. Details and live receipts in the sections below.
- **PRs merged** (each confirmed with `gh pr view`): #354, #357, #359, #385, #391, #399, #404, #409, #421; #355 into the
  `lead/loot-data` stack. Issue #397 (security advisor) closed with receipts.
- **DB check** (`scripts/account-database-check.mjs`, real disposable Postgres, zero production writes) covers every table and
  function above, and every new assertion was mutation-tested.

## Open

- **#487** (this file) — in tonight's docs batch.
- **Stats' PR A, #503** (decoder + accept-list) — needs nothing from Backend (Strategy, 2026-09-23). It still reaches the verifier
  host by construction (see Gotchas).
- **Daily verifier's first real sweep** — unobserved: `daily_results` was 0 rows on 2026-09-22 (0 verified / 0 refused / 0
  awaiting). The timer is armed; it waits on someone posting a daily fight.
- **Session names.** Dom's standing order gives Strategy/Lead instructions his approval. **Strategy: settled** — Dom confirmed
  2026-09-23 that `Frankendom - Strategy - Fable 5.1` is the session his order names. **Lead: open** — exact `Frankendom - Lead
  Developer` carries approval; the older variant `Frankendom - Lead Dev - Fable 5.1` is unconfirmed, so flag it to Dom before acting
  on a push/merge-class line from it. (Reviews need no approval either way.)

## Gotchas

- **The record is opaque to Postgres; the version check is client code the server runs.** `scripts/verify-daily.mjs` imports
  `decodeRecord` from `src/record.ts`, and `deploy.sh` rsyncs `src/**/*.ts` to the verifier host — so one accept-list, two readers.
  Grepping `supabase/` for `RECORD_VERSION` and finding nothing means "no second list", not "no server check".
- **A refused daily row does not self-heal**: `checked_at` takes it off the sweep's page. After any accept-list widening, run
  `verify-daily.mjs --recheck` if rows exist. Ship accept-list widenings one deploy **before** the encoder writes the new version.
- **A refused insert still consumes a sequence value** — validate before `nextval`.
- **Narrowing a column grant can break the policy that enforces it** (column SELECT is needed for columns in a WHERE).
- **The local check must mirror hosted's quirks or assertions go vacuous**: `pgcrypto`, `set time zone 'UTC'`, and hosted's default
  `truncate/trigger/references` grants.
- **Mutation-test every new assertion.** Three times this lane a check passed with its protection removed. And on a repo whose digest
  guard hashes the file you mutate, "a test failed" proves nothing — read *which* test.
- **Supabase MCP `execute_sql` returns only the last statement's result** — one statement per call when each matters.
- **Never mint or insert in production "to test"** — read-only verification only.
- **Check a PR's state before pushing follow-ups to its branch.** A merged PR ignores new commits, and the push still "succeeds".
  Three commits were stranded this way on #487 and rescued as #525. Confirm the PR's `headRefOid` equals HEAD after pushing.
- **This machine's deploy guard refuses heavy commands while any deploy is in flight** — and it refuses the *whole* command, so a
  combined edit+test can leave the edit unapplied. Run edits alone, then the check.

## Hosted project as it stands — verified 2026-09-22 (0002–0010 all applied and verified by this lane)

Tables: `public.fighter_profiles` (1 row, now with a `loot` column — see below), `public.admins` (1 row), `public.fight_records`
(0 rows), `public.daily_secret` (1 row, RLS on, unreadable — see below), `public.daily_results` (0 rows, RLS on). View
`public.daily_board` and function `public.daily_fight()` both exist (confirmed directly via `pg_views`/`pg_proc`, since `list_tables`
doesn't enumerate views). `auth.users`: 2. Role `frankendom_verifier` exists (`rolcanlogin = true`). Hosted migration history
(`supabase_migrations.schema_migrations`): `20260920031013 werewolf_skeleton_encounters`, `20260920031925
revert_werewolf_skeleton_encounters`, `20260920041658 werewolf_skeleton_encounters_v2`, `20260920055946
werewolf_skeleton_encounters`, `20260920070348 victory_marks`, `20260920083450 dwarf_encounter`, `20260921065907 admins`,
`20260921200632 202609210002_fight_records`, `20260921211439 202609210003_daily_warden`, `20260921211755
202609210005_daily_verifier`, `20260921214151 202609210004_loot` (applied out of numeric order relative to 0005 — fine, ordering was
constrained by each migration's own PR/deploy timing, not by file number). The first two repo files
(`202609190001_fighter_profiles`, `202609190002_creature_encounters`) were applied by hand and are not in the history; the
werewolf/skeleton change was applied three times with one revert. The history is therefore NOT `supabase db push`-able against the
repo; applies stay manual (MCP `apply_migration` named after the repo file) and this table is the map between the two.
`public.rls_auto_enable()` (event trigger `ensure_rls`) is Supabase's own platform function, not ours; the security advisor's WARN on it
is expected and stays.

**Security advisor — known items, all by design (read after the 0006 apply, 2026-09-22; re-check with `get_advisors` after any DDL):**
ERROR `security_definer_view public.daily_board` — intended, the view reads `fighter_profiles.display_name` as its owner so a public
board can name posters past `owner_read` (documented under 0003); WARN `rls_auto_enable()` executable by anon/authenticated — Supabase's
own; WARN `daily_fight(on_day)` executable by anon as definer — intended, the seed is public and the secret never leaves the function;
WARN `fight_records_recent()` executable by authenticated as definer — intended, zero-arg, own-count only (0006); INFO `daily_secret`
RLS enabled with no policy — intended, nobody but the definer function reads it; WARN auth leaked-password protection off — an Auth
setting, not schema; sign-in is Google only today, so it is moot until email/password logins exist (Dom's call if that changes).
Anything NOT on this list is a new finding. Lead accepted the `daily_board` disposition on 2026-09-22 ("by design, no lint-chasing").
Struck from the list by 0008: `rls_auto_enable()` — see below.

**0008 (PR #399, issue #397) — APPLIED 2026-09-22** (hosted migration `20260922080124 202609220008_rls_auto_enable_no_rpc`; file md5
`77c34bdec8206885fec6c55b499ab10f` at trunk `41363b7`). A guarded, idempotent `revoke execute on public.rls_auto_enable() from
public, anon, authenticated` — Supabase's platform helper (event trigger `ensure_rls`) had been exposed at `/rest/v1/rpc`. Verified
independently here: `has_function_privilege` false for anon and for authenticated; `ensure_rls` still present and enabled;
`get_advisors(security)` no longer lists it, and everything still listed is on the by-design list above. Authorisation: Dev/Deploy
reports Dom's standing ruling to them ("anything from lead dev or the strategy dev u must do it, they have my full authority") — their
protocol, recorded here as their statement; this lane's review line was the md5 at trunk.

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

### fight_records (0002 + 0006) — APPLIED, schema below as it exists on the hosted project today
| column | rule |
|---|---|
| id text pk | `^[A-Za-z0-9_-]{8}$`, client-chosen; a collision is a 23505 the client must retry |
| user_id uuid → auth.users cascade | owner; never readable by a client |
| opponent text | 1–32 chars |
| record text | ≤ 16 KB, base64url alphabet (src/record.ts encoding) |
| created_at | default now(); never readable by a client |
Index `(user_id, created_at desc)`. RLS on. Policies: select `to anon, authenticated using (true)` (a shared link is public by intent —
the row, not every column); insert `to authenticated` with check `auth.uid() = user_id and public.fight_records_recent() < 30`.
No update/delete policy or grant. Grants: select **`(id, opponent, record)` only** to anon+authenticated; insert `(id, user_id,
opponent, record)` to authenticated. `fight_records_recent()`: zero-arg, `security definer`, `search_path=public`, counts the
CALLER's own rows in the last hour (`user_id = auth.uid()`); execute to authenticated only (not anon) — it takes no id, so it can
report nobody else's count. Client calls: `POST /rest/v1/fight_records` (src/share-store.ts), `GET
/rest/v1/fight_records?select=record&id=eq.<id>`.

**0006 (PR #359) — APPLIED 2026-09-22 on Dom's typed "apply" in Dev/Deploy's session** (hosted migration `20260922072149
202609220006_fight_records_select_columns`; file md5 `fe2218e6a3b9de7aac15ce3d36fc7cb9` at trunk `dcb9d61`, byte-identical to the
reviewed head). Verified independently here, fresh queries: `set role anon; select id, opponent, record from fight_records` resolves;
`select user_id …` → `42501 permission denied`; `select created_at …` → `42501 permission denied`; `pg_proc`: `fight_records_recent`
`pronargs = 0`, `prosecdef = true`, `proconfig = search_path=public`, execute grantees `postgres, authenticated`; `pg_policies` insert
`with_check = ((auth.uid() = user_id) AND (fight_records_recent() < 30))`; select column grants for both roles exactly `id, opponent,
record`. Why it exists: 0002's whole-table select let anyone with the publishable key list every sharer's `user_id` and `created_at`
(Auditer finding); narrowing it broke the insert policy's own rate-limit subquery, hence the definer function; an earlier draft took a
`uid` argument (any signed-in player could have queried another's count) — fixed before merge. Security advisor after apply
(Dev/Deploy's read, consistent with the design): the only 0006 item is the expected WARN "authenticated can execute SECURITY DEFINER
fight_records_recent()".

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

### fighter_profiles.loot (0004, PR #330) — APPLIED, verified live
Applied by Dev/Deploy (hosted migration `20260921214151 202609210004_loot`), ahead of #330's code merge as required. Verified
independently here (fresh `information_schema.columns`/`pg_constraint`/`information_schema.column_privileges`, not taken on
Dev/Deploy's report): `loot` column exists, `jsonb not null`, default `'{"owned": [], "equipped": {}}'`; check constraint
`fighter_profiles_loot_check` matches exactly — object type, `owned` is an array, `equipped` is an object, `pg_column_size ≤ 4096`;
column grants are `insert`/`select`/`update` to `authenticated` only (no `anon`). Client-reported cosmetics; `src/loot.ts cleanLoot`
validates on read (known ids only, worn ⊆ owned). Never rank/result/unlock authority.

**All four beta migrations (0002–0005) are now applied and independently verified.** Only `0006` (fight_records privacy fix) remains
open, held for Dom's direct word.

### Short share ids + guest hygiene (0009, PR #409; 0010, PR #421) — APPLIED, verified live
One short id for every share (Dom via Strategy: a kill link ran to several WhatsApp screens). Hosted migrations `20260922085012
202609210009_short_share_ids` and `20260922095721 202609220010_guest_share_hygiene`; both verified here by this lane's own queries,
read-only (no row was minted in production — that would publish a junk share as id `1`).

- `share_ids` sequence + `to_base36(bigint)` (internal, no client execute) → ids are lowercase base-36, 1–6 chars, sequential
  (999,999 = `lflr`). `fight_records.id` check admits `^[a-z0-9]{1,6}$` **or** the old `^[A-Za-z0-9_-]{8}$`, so every old link keeps
  resolving. `user_id` is nullable: guests share with no owner (FK kept). **Enumerable by design** — a shared fight is public by
  intent and the row exposes only `(id, opponent, record)` (0006).
- `mint_share(record, opponent)` — `security definer`, `search_path=public`, execute to anon+authenticated, the only write path for a
  share. Order: validate input → per-caller cap → global backstop → row ceiling → `nextval` → insert. Validation precedes `nextval`
  because a refused insert still consumes a sequence value (sequences are not transactional), so bad input must not lengthen
  everyone's ids. Client: `POST /rest/v1/rpc/mint_share {record, opponent}` → the id as a JSON string (check-14 mock knows it).
  Errors: `check_violation` for bad input; `P0001` `thirty shares an hour` / `too many shares from here this minute` /
  `too many guest shares this minute` / `guest shares are full`. Lead's ruling: no long-form URL fallback (Dom: "never the long
  form") — a capped guest sees "Couldn't make a link, try again."
- `share_limits` — one owner-managed row, **no client grant at all** (`set role anon; select * from share_limits` → 42501):
  `guest_per_minute` 600 (global backstop), `guest_per_key_per_minute` 10, `guest_salt` (32 hex), `guest_rows` 50000 (ceiling),
  `guest_days` **30** (Dom's override of Strategy's 90: "30 days live"; signed-in shares are never pruned). Changing a number is an
  `UPDATE`, not a migration.
- Per-caller bucket: `mint_share` reads `cf-connecting-ip` / first `x-forwarded-for` from `request.headers` and stores it **only** as
  a salted SHA-256 in `fight_records.guest_key` — outside the 0006 select grant (both roles: `has_column_privilege(... 'guest_key',
  'select')` = false), with a `^[0-9a-f]{64}$` check so a raw address can never land there. No header (direct SQL, the verifier, the
  local check) or an unparseable one → no key → backstop only, never an error.
- Retention: `prune_guest_shares()` (definer, execute owner-only) deletes guest rows older than `guest_days`; pg_cron job
  `frankendom_guest_share_retention` `17 4 * * *`, `active = true` (verified live; pg_cron was available-but-not-installed on hosted,
  the migration installs it — the local check cluster has none, so that assertion is guarded and the job row is verified live).
- Hygiene: `truncate, trigger, references` revoked from anon/authenticated on `fight_records`, `daily_results`, `daily_board`
  (Supabase's default-grant residue; `has_table_privilege('anon','public.fight_records','truncate')` = false). The local check's
  bootstrap now mirrors that residue — without it the revoke assertion was vacuous, which a mutation test exposed.

### daily_board_summary(on_day) (0007, PR #385) — APPLIED, verified live
Auditer finding 2026-09-22, confirmed independently on trunk `c789ed7`: the client paged `daily_board?order=created_at.asc&limit=200`
and ranked locally (the 201st poster's better result never showed) with `verified` as a tie-break only (a pending row could lead).
`daily_board_summary(on_day date default today-UTC) returns jsonb` — `{day, fastest_kill, cleanest_kill, longest_survived,
fastest_death, where, pending}`: each headline is the best row of the day ordered `verified desc, <metric>, created_at asc` (a pending
row leads only when nothing on that line is verified, still `verified=false`); `where` counts **verified** deaths by location
(client-reported until replayed); `pending` = unverified rows that day. Runs as the caller over `daily_board` (no definer; public
columns only, never `record`/`user_id`); execute to anon+authenticated. **Applied** (hosted migration `20260922074002`); verified here
as anon: seven keys, `prosecdef = false`, `search_path=public`, no `record`/`user_id` in the payload. Live `8650fc5` carries the #385
client and the function predated that deploy, so there was no 404 window. Client: `src/daily.ts fetchDailySummary` → `POST
/rest/v1/rpc/daily_board_summary {on_day}` (new REST path; check-14 mock updated in the same PR); `fetchDailyBoard` removed.
Proven in `account-database-check.mjs`: 201st-row fastest wins; pending never leads a verified row; pending deaths excluded from the
split; another day never leaks; tomorrow empty; no `record`/`user_id`. Mutation-tested four ways + the check-14 route removal.
**Post-apply verification owed here:** `select public.daily_board_summary(current_date)` as anon resolves; Auditer re-verifies the
deployed board.

### frankendom_verifier role + daily_results.checked_at (0005, PR #348) — APPLIED, verified live
Applied by Dev/Deploy (hosted migration `20260921211755 202609210005_daily_verifier`, PR #348 merged `bca49b9`). Verified
independently here (fresh queries against pg_roles/information_schema/pg_proc/pg_policies, not taken on Dev/Deploy's report):
`frankendom_verifier` role exists with `rolcanlogin = true`; `daily_results.checked_at` column exists; column grants are exactly
`select` on `(day, user_id, opponent, weapon, outcome, ticks, record, verified, checked_at, created_at)` and `update` on
`(verified, checked_at)` — 10 select columns + 2 update columns, matching the reviewed file exactly, nothing extra; `execute` on
`daily_fight(date)` confirmed via `has_function_privilege`; both RLS policies (`the verifier reads every result` SELECT, `the
verifier marks results verified` UPDATE) confirmed scoped to `frankendom_verifier` only. **Not independently checked, and never
will be by this lane:** the password itself and Dev/Deploy's `select current_user` connection test — this lane never holds that
credential, so that half of their report is taken as theirs to state, not verified here. `alter table daily_results add column
checked_at timestamptz` (refused rows are stamped so the sweep moves on; `--recheck` revisits). The VPS connects through the
Supabase pooler as `frankendom_verifier.rxbewmzmovelckzoosss`.

**#348 arming checklist (takeover from Dev/Deploy; read from their PR branch, not written by this lane — no VPS writes here):**
1. ✅ DONE — 0005 applied, `frankendom_verifier` exists and its grants verified against the above, independently, this lane's own queries.
2. ✅ DONE (Dev/Deploy's own report, password itself not and never independently checkable by this lane) — they generated the
   password, ran `alter role frankendom_verifier password '<generated>';` at apply time, wrote it straight into
   `/etc/frankendom/verifier.env` (root:600, confirmed by their own `stat`) on the VPS. This lane never held or set the secret.
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
4. DONE per Dev/Deploy's report (VPS state, not checkable by this lane — no VPS/SSH access in this lane's tools): deploy #72
   (`bca49b9`) is live, `frankendom-verify-daily.timer` confirmed active+enabled via their own `systemctl` check.
5. Unit shape (reference, unchanged): `frankendom-verify-daily.service` is a `oneshot` running `node scripts/verify-daily.mjs` with
   that env file, logging to `/var/log/frankendom-verify-daily.log`; `frankendom-verify-daily.timer` fires it every 2 minutes.
6. OPEN — waiting on Dev/Deploy's promised first-sweep receipt, then this lane confirms independently: a `daily_results` row moves
   from `verified=false` to `true` (or gets `checked_at` stamped with a refusal reason). Not yet posted; there are no `daily_results`
   rows to sweep yet either (table was 0 rows as of the last check), so the first real signal may wait for an actual daily post.

## Admins workflow — proposal (week item 4; nothing built)

Today: `public.admins` has one row (dom123dxb, inserted by the lead in SQL on Dom's word). The client reads only its own membership
(`readAdmin`, `src/cloud-profile.ts:36`) and `src/account.ts:58` reveals the journal test tools on `true`; no client insert/update/delete
path exists (proven in the DB check). The question was: how does a second admin get added without SQL?

**Recommendation for beta — no code:** the Supabase Dashboard. Authentication → Users lists every account by email with its uuid;
Table Editor → `admins` → Insert row → paste the uuid. Two clicks, owner-only (dashboard access is Dom's), audited by Supabase's own
log, nothing dormant in the schema. With a roster of one or two, a built flow is a liability, not a feature (Strategy: build nothing
dormant). This lane verifies each addition after the fact (`select count(*) from admins`) and records it here.

**Designed, not built — for when admins multiply (an in-game "Admins" line in the test tools):**
- `alter table admins add column granted_by uuid references auth.users, add column note text check (char_length(note) <= 80)`.
- `admin_grant(email text)` / `admin_revoke(email text)`: `security definer`, `set search_path = ''`, execute to `authenticated` only;
  the FIRST statement refuses unless `exists (select 1 from public.admins where user_id = auth.uid())` — the check lives inside the
  function, the client is never trusted to be an admin. Resolves `email` → `auth.users.id` (case-folded), inserts/deletes the row,
  stamps `granted_by = auth.uid()`. `admin_revoke` refuses to remove the last admin and refuses `auth.uid()` itself unless another admin
  exists. Returns nothing but success/failure; the only thing it reveals to an admin is whether an email has an account — acceptable
  for admins, not for anyone else (hence no `anon` execute).
- Client: `POST /rest/v1/rpc/admin_grant` / `admin_revoke` (two new REST paths → check-14 mock) from an "Admins" row in the test-tools
  block, already gated by `showTools(admin)`. DB-check cases: a non-admin calling either → refused; an admin grants by email → row with
  `granted_by`; revoking the last admin → refused. Bootstrapping the first admin stays SQL (done).

## Designs, not built (week item 5) — the RLS shape and what the client may write

### Ghost storage (PvP as ghosts first — Strategy's "friend's echo")
A ghost is a fighter another player can be thrown against: the look (rig, weapon, equipped loot) plus the warden's behaviour profile
of that player. Behaviour, not rank: `Habits` (`src/ai.ts:11` — ticks, guard, parries, rolls, steps, lights, heavies, thrusts, kicks,
attacks…) is exactly what the warden reads live, so a stored `Habits` drives the same `readOpponent` path with no new AI.
- `public.ghosts (id text pk check '^[A-Za-z0-9_-]{8}$', user_id uuid unique → auth.users cascade, display_name text (1–24, same check
  as fighter_profiles), rig text check in the roster's player rigs, weapon text check in PLAYER_WEAPONS (src/moves.ts:410), loot jsonb (same check as
  fighter_profiles.loot), habits jsonb check (pg_column_size ≤ 2048 and every key is a Habits field and every value a bounded integer
  — a jsonb check, not `pg_jsonschema`, so the local check needs no extension), fights integer default 0, revision bigint (the
  fighter_profiles trigger pattern), updated_at)`.
- RLS: owner insert/update (`auth.uid() = user_id`), one per account (the unique); select `to anon, authenticated using (true)` with
  a **column** grant that excludes `user_id` (the fight_records lesson: a policy cannot hide columns) — a ghost is fetched by its short
  id from a link, exactly like a shared fight. No delete from the client; a "retire my ghost" is `update … set habits = '{}'`.
- What the client may write: its own look and its own habits, bounded. What it may never write: anything competitive. A ghost fight
  awards nothing server-side (no marks, no board) until a verified route exists — the verifier pattern from 0005 (a `ghost_results`
  table + replay) is the way to make ghost wins count, and it is NOT part of this design.
- Client calls (when built): `POST /rest/v1/ghosts` / `PATCH …?id=eq.<mine>` (owner), `GET /rest/v1/ghosts?select=<public columns>&id=eq.<id>`.
  Combat owns the `Habits` → warden mapping; Web design owns the "fight a friend's ghost" surface; this lane owns the table, the
  bounds and the DB-check cases (second ghost per account refused, cross-owner update refused, `user_id` unreadable, habits over 2 KB
  refused, unknown habit key refused).

### Season leaderboards (the daily board, over a season)
Today's `daily_board_summary` (0007) is per day. A season is the same idea over a date range, and the same rule: **verified rows
only** ever rank; pending rows are counted, never placed.
- `public.seasons (id smallint pk, name text, starts date, ends date, check (starts <= ends))` — owner-managed in SQL like `admins`;
  no client writes at all. Beta season 1 = the daily's day zero (2026-09-22) onward.
- `season_board_summary(season smallint) returns jsonb` — the 0007 pattern verbatim, over `daily_results` joined to
  `fighter_profiles.display_name` for `day between starts and ends and verified`: per fighter `{days_played, kills, cleanest (min
  taken), fastest_kill, longest_survived}` ranked by kills desc, fastest_kill asc, limited to a top N the client never pages past;
  plus `{pending}` for the season. Invoker, public columns only, never `user_id`/`record`. Ties broken by the earlier `created_at`.
- No new tables for results and no new client writes: a season is a read over what the daily already stores and the verifier already
  confirms. Only `seasons` is new, and it is a config table.
- Client call (when built): `POST /rest/v1/rpc/season_board_summary {season}` (one new REST path → check-14 mock). DB-check cases: a
  pending row outside the top N when a verified one exists; a day outside the season never counts; the payload carries no `user_id`.
- Not designed here: career marks on the season board (marks are client-reported; the no-authority rule keeps them off any board).

### Lockers — the locker-slot purchase record (payments later)
`src/loot.ts:17` `LOCKERS = { open: 1, total: 6 }` is a constant today. When lockers are sold, the count a fighter has must come from
the server, never from the client, and nothing competitive may hang off it (Strategy: cosmetic storage only).
- `public.purchases (id uuid pk default gen_random_uuid(), user_id uuid → auth.users cascade, sku text check (sku in ('locker_slot')),
  provider text, provider_ref text unique (the processor's own id — the idempotency key for a retried webhook), amount_cents integer
  check (> 0), currency text check (char_length = 3), status text check (status in ('pending', 'paid', 'refunded')), created_at,
  updated_at)`. Comment: "written by the payment webhook only".
- RLS: **no client write path of any kind** — no insert/update/delete policy or grant to `anon`/`authenticated`. Rows are written by
  the webhook handler (a Supabase Edge Function or a VPS endpoint, decided with Dom; it holds the processor's signing secret in its
  own env, never in the database) through a dedicated login role like `frankendom_verifier` — `frankendom_payments`, grants `insert`
  and `update (status, updated_at)` on `purchases` only. Client: `owner_read` select on its own rows for a receipts list.
- Entitlement: view `public.locker_slots` = `select user_id, 1 + count(*) filter (where sku = 'locker_slot' and status = 'paid') as
  slots from purchases group by user_id` (plus the 1 every fighter has). Owner-read via RLS on the base table; `src/loot.ts` reads
  `slots` in place of `LOCKERS.open` and greys the rest, exactly as today. A refund flips `status` and the count drops — no data lost.
- What the client may write: nothing. What it may read: its own purchases and its own slot count.
- DB-check cases: a client insert into `purchases` refused (both roles); `frankendom_payments` can insert and can update only
  `status`; the view counts `paid` only; cross-owner read refused. Not designed here: the provider, prices, tax, the checkout UI —
  Dom's money decision first (this lane's rule: money is Dom's call, not a lane's).

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
