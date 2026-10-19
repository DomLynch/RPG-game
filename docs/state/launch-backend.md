# Launch track: Backend (auth, login, scale for thousands)

**Headline: scale is UNPROVEN until the Hugging Face load test runs (section 2).** Everything below the line about the database being healthy is a read of today's state, not a capacity claim.

Owner: Backend lane (Mac session until the VPS twin takes over). Written 2026-10-19 on Strategy's rulings (Dom: Backend owns auth, login and scale for thousands, after the sandbox archive). PLAN ONLY: nothing below has been run. Security freeze on: no new secrets, no tokens on the VPS. Read-only audit of production `rxbewmzmovelckzoosss` taken 2026-10-19 ~11:00 +04 (Supabase advisors, `list_tables`, three SQL reads); every number is from that read.

## 1. What is true today (measured, 2026-10-19)

- Project ACTIVE_HEALTHY, Postgres 17, 18 MB, region ap-south-1.
- `max_connections` 60, 14 in use with 3 users. The origins writer pool is 4.
- Auth: 3 users, 2 Google identities, 1 email, 0 anonymous.
- RLS is enabled on every public table; every public table has a primary key; anon can SELECT only `daily_board` and `pit_ladder`.
- Migrations: 73 files on trunk, 74 rows in prod's history (`werewolf_skeleton_encounters` is recorded twice). By name (Auditor's read, #3276 comment 6261654948): two early files (`creature_encounters`, `fighter_profiles`) have no history row, though their tables exist; and two history rows (`revert_werewolf_skeleton_encounters`, `werewolf_skeleton_encounters_v2`) have no file. Reconcile at the launch schema review; not a blocker.
- Connections: of the 60, about 14 are Supabase's own and in use today (5 background, 4 supabase_admin, 2 postgres, 1 authenticator, 1 pgbouncer, 1 frankendom_verifier), so pool headroom is about 46 of 60 before any pooler. Size against Supavisor (pgbouncer is present), not raw `max_connections`; read the compute tier from the dashboard.
- Scale: UNMEASURED. The one 100-account attempt never ran (`DEADLINE: load5 never under 6`, scale-1539.log) and #1692 was closed by the sweep. There is no number for "thousands concurrent".

## 2. Load test plan (not run)

Goal: one honest number per line, then the sizing ask to Dom with cost.

**Where:** the approved Hugging Face 32 GB CPU instance ($0.03/h, `vps-heavy-jobs` skill), or the VPS once load5 < 6. Not the VPS while the migration lanes saturate it. Never prod: a throwaway Postgres 17 with all trunk migrations applied (the `origins-writer-check.mjs` harness already builds one), the writer from trunk pointed at it, and a synthetic-session driver.

**Driver:** 1,000 synthetic sessions, ramped 100 -> 250 -> 500 -> 1,000 (hold each step 5 minutes), each doing the real loop: `open` -> `spawn_state` polls -> `encounter_start` -> `kill_report` -> save. Per-session pacing from the real client (read `origins/preview` timings), not a tight loop.

**Lines to report (one number each):**
1. Writer throughput at each step (requests/s per endpoint) and the step where p95 first passes 500 ms.
2. p50 / p95 / p99 latency for `open`, `spawn_state`, `kill_report`.
3. Errors and 5xx per 1,000 requests; any `pool timeout`.
4. Pool: 4 connections at what concurrency does the wait queue grow; the pool size that holds 1,000 sessions; connections needed vs `max_connections` 60 (Supabase reserves some for its own services: read the real headroom with `select count(*) from pg_stat_activity` at peak).
5. Postgres: CPU, locks/waits on `origins_item_ledger` and `origins_career` (the hot rows), table and WAL growth per 1,000 sessions.
6. Writer process: CPU, RSS, event-loop lag; one writer or many (the writer is single-instance on the VPS today).

**Beyond the writer + Postgres (Auditor's gap list): "thousands of players" also goes through three more paths, each gets its own measured line:**
7. **Presence WebSocket server** (other players in Zone 1; a single instance on the VPS): concurrent sockets held, broadcast fan-out p95, server CPU and RSS, at 100 / 250 / 500 / 1,000 connected clients.
8. **nginx and static-asset egress** on the VPS: bytes/s and requests/s at the same four steps (the 3D assets dominate a first load), and whether one nginx and one uplink carry it.
9. **Supabase Auth sign-in rate:** sign-ins per minute the project accepts (Google OAuth and email), the per-IP and per-hour limits, and what a launch-hour burst of new sign-ins does. Read the limits from the dashboard; a burst test only against a branch Dom approves.

**What a local Postgres cannot tell us (must be read or tested on Supabase, not guessed):** Supabase compute tier and its connection ceiling, pooler (Supavisor) limits, PostgREST/Auth rate limits (sign-ins per hour per IP, email sends per hour on the default SMTP), egress. Action: read the org's plan and limits from the dashboard, then run a small (100-session) confirm against a Supabase branch only if Dom approves the branch cost. Nothing is assumed about the tier here.

**Exit:** a table of the six lines above at 100/250/500/1,000, the bottleneck named, and a sizing ask: Supabase tier, pool size, writer count, with monthly cost.

## 3. Advisor items: intent checks (one line each; no change made)

Each was checked against the function/view definition and the repo's own tests.

1. **`public.daily_board` is SECURITY DEFINER (ERROR lint).** Intended. A join of `daily_results` and `fighter_profiles` (display_name, `not is_test`) with no `user_id` column, so guests read the board without table access; `scripts/account-database-check.mjs:158` asserts "Guest can read the daily board". Changing it to `security_invoker` would break guest reads unless table policies are added. Decision for Strategy: accept (document), or redesign as a summary function.
2. **anon can execute `daily_fight` (WARN).** Intended. Returns the day's seed from a hidden secret, refuses future days; `account-database-check.mjs:127-154` asserts guests and signed-in users both get today's seed. Note the browser check says this client does not call it today, so it is unused surface: candidate to revoke from anon when the daily mode is confirmed dead.
3. **anon can execute `mint_share` (WARN).** Intended. Guest share links; rate-limited per hashed IP, per minute and in total (`share_limits`), 16 KB record cap; asserted in `account-database-check.mjs:193-205`. Keep.
4. **Leaked-password protection OFF (WARN, Auth).** A dashboard toggle (Supabase Auth, password security), not a migration. Matters only for email+password accounts (1 today). Dom's checklist below.

5. **Advisor 0029: ten SECURITY DEFINER functions callable by `authenticated` (WARN).** The Auditor read each one (#3276 comment 6261654948) and found them safe: every one either scopes to `auth.uid()` (the `report_*` functions refuse a null uid and cap starts per hour) or returns public, non-PII data (`leaderboards` capped at 50, excludes `is_test`); every one pins `search_path`. They are: `daily_fight` (seed; see the ruling below), `fight_records_recent` (own share count for the hourly cap), `leaderboards` (public board), `mint_share` (guest and fighter share links), `my_standing` (own standing), `origins_me_allowed` (own access flag), `origins_me_owns` (own character check), `report_duel`, `report_duel_record`, `report_duel_start` (own duel reports). The other 85 SECURITY DEFINER functions are callable by neither anon nor authenticated.
6. **The 27 "RLS enabled, no policy" INFO findings are correct, do not add policies.** They are the deny-by-default writer tables (`origins_item_ledger`, `origins_trades`, `share_limits`, ...): no policy means neither `anon` nor `authenticated` can touch them, and every write goes through a function or the writer. Adding a policy to "fix" the lint would open them.

Rulings (Strategy, 2026-10-19): `daily_board` stays security-definer (exposes no user data, tested); redesign only at the launch schema review if the load test shows it. Anon EXECUTE on `daily_fight` is revoked by #3277 (unused surface), applied after today's sandbox archive.

Result: all the SQL items are by design (the ten signed-in functions, the two anon ones, the view). The one change ruled is revoking anon on `daily_fight` (#3277, its own Auditor read and Lead's GO).

Later PR (not now): 13 unindexed foreign keys (`duel_counted_wins.opponent`, `duel_records.user_id`, `duel_reports.user_id`, `duel_season_ratings.user_id`, `duel_starts.user_id`, `origins_creature_claims.token`, `origins_encounters.account` and `.character`, `origins_events.character`, `origins_items.loc_from`, `origins_skill_practice.character`, `origins_spawn_engages.instance`, `origins_trade_audit.character`) and 17 never-used indexes. Index adds are cheap; index drops wait until real traffic, because "unused" is true of a 3-user database.

## 4. Google OAuth + login checklist for Dom (dashboard only, five lines)

1. Google Cloud Console -> APIs & Services -> Credentials -> the OAuth client: Authorized redirect URI is exactly `https://rxbewmzmovelckzoosss.supabase.co/auth/v1/callback`; Authorized JavaScript origins include `https://frankendom.com`.
2. OAuth consent screen: publishing status is **In production** (not Testing: Testing caps users at 100 and expires tokens in 7 days); scopes limited to email, profile, openid.
3. Consent screen -> authorized domains include `frankendom.com`; privacy-policy and terms links set to live pages.
4. Supabase -> Authentication -> URL Configuration: Site URL `https://frankendom.com`; Redirect URLs list only the real origins (no wildcards left over from testing). Email templates (confirm, reset) carry the Frankendom name and the same domain; custom SMTP set before launch (the default sender is rate-limited to a handful of emails per hour).
5. Supabase -> Authentication -> Passwords: turn on **Prevent use of leaked passwords** (HaveIBeenPwned) and set the minimum length; confirm Google is the primary path and email sign-up is on or off on purpose.

## 5. Empty and pre-beta tables (leave until the launch schema review)

Empty today (0 rows): `duel_metrics`, `duel_starts`, `duel_reports`, `duel_records`, `duel_ratings`, `duel_counted_wins`, `duel_season_ratings`, `daily_results`, `origins_access`, `origins_encounters`, `origins_quest_state`, `origins_quest_journal`, `origins_talk`, `origins_trades`, `origins_trade_audit`, `origins_encounter_runs`, `origins_creature_claims`, `scorecard_notes`, `control_trials`, `origins_live_events`, `origins_switches`, `origins_character_build`, `origins_skill_xp`, `origins_skill_practice`, `origins_grimoire`, `origins_character_renown`. Many are features that have shipped but have no traffic yet (trades, skills, grimoire): they are not mess, they are untested-at-volume, and the load test should exercise them. Pre-beta leftovers to decide on at the schema review: `fight_records`, `fight_results`, `loot_claims`, `awards`, `daily_secret`, `daily_results`, `account_seed`, `perf_beacons` (494 rows of beacons).

## 6. Order of work

1. This doc merged (docs-only PR, Auditor read).
2. Strategy rules on `daily_board` / `daily_fight` (accept or redesign).
3. Dom takes the checklist in section 4.
4. After the sandbox archive: build the driver, run the load test per section 2, post the six lines, then the sizing ask with cost.
