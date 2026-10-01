# Production Supabase security pass, 2026-10-01 (pre-beta)

Backend/Accounts, for Strategy. **Read only:** Supabase `get_advisors` (security + performance) and catalog queries on
`rxbewmzmovelckzoosss` at live a60d94a2. No migration, grant or setting was changed.

**Verdict: nothing critical or high.** Every public table has RLS on. No signed-out or signed-in player can read another
account's private rows, or write a server-truth column (marks, awards, verified flags, seeds). Everything below is low or
info. The one recommended fix is a small performance migration **after beta**.

## What players can reach (anon = signed out, auth = signed in)

| Object | anon | auth | RLS / policy | Needed by the game? |
|---|---|---|---|---|
| `fighter_profiles` | — | own row: read, insert, update (name, encounter, loot, victory_marks) | owner-only | yes: the device cache; server truth is `loot_claims`/`awards` (D3) |
| `loot_claims` | — | insert own (opponent, piece, record); read own | owner-only, `not verified` on insert | yes |
| `awards` | — | read own (via the claim join) | owner-only | yes |
| `daily_results` | read board columns (no `record`, no `user_id`) | + insert own, today, once | own-insert, public read | yes |
| `daily_board` (view) | read | read | security definer view (see S1) | yes: the public board |
| `fight_records` | read id/opponent/record | + insert own (30/h) | public read by id | yes: kill links |
| `perf_beacons` | insert listed columns | same | insert-only, caps | yes |
| `account_seed`, `daily_secret`, `share_limits`, `admins` | — | `admins`: read own row only | no client policy | yes (as locked) |
| RPC `daily_fight` | execute (definer) | same | today's seed only, never a future day | yes |
| RPC `mint_share` | execute (definer) | same | per-key, global and row caps | yes |
| RPC `my_standing`, `fight_records_recent` | — | execute (definer) | the caller's own figures | yes |
| RPC `daily_board_summary` | execute (invoker) | same | reads under RLS | yes |
| Trigger fns `award_needs_verified_claim`, `claim_stays_verified` | execute | execute | trigger-only; a direct call errors | harmless |

## Findings

| # | Object | Finding | Severity | Proposed fix |
|---|---|---|---|---|
| S1 | `daily_board` view | Advisor ERROR "security definer view": it reads `fighter_profiles` (owner-only) to show `display_name` on the public daily board. It exposes exactly 11 columns: day, number, opponent, weapon, outcome, ticks, location (= hit location head/torso/legs), taken, verified, created_at, display_name. No user id, no record. | Low (intended) | **Accept** for beta and document it. Post-beta option: a `public_name` table the board reads with an invoker view. Not worth the churn before Saturday. |
| S2 | `fight_records` | Short share ids are sequential base-36 (0009, by design), so anyone can enumerate every shared fight's record. Records hold inputs and outcome only, no identity. | Low (accepted 2026-09-22) | None. |
| S3 | `mint_share`, `daily_fight` | Callable signed-out as definer functions (advisor WARN). Both are capped or read-only, and guests sharing a kill link is a product feature. | Info | None. |
| S4 | Auth | Advisor WARN "leaked password protection disabled". Sign-in is **Google only**: 2 identities, 0 accounts with a password. | Info | Dom: confirm the Email/password provider is **off** in the Supabase dashboard (Auth → Providers). Then this warning cannot matter. Read-only SQL can't see that setting. |
| S5 | `daily_secret`, `share_limits` | Advisor INFO "RLS enabled, no policy". Intended: no client access at all. | Info | None. |
| S6 | `fighter_profiles` | A signed-in player can set their own `victory_marks` and `loot`. They are the device cache only: server marks and loot come from verified claims, and nothing public shows the cached values. | Info (by design, D3) | None. |
| P1 | RLS on `awards`, `daily_results`, `fight_records`, `loot_claims` (5 policies) | Advisor WARN `auth_rls_initplan`: `auth.uid()` is re-evaluated per row. The tables are tiny today. | Low (performance) | **Post-beta migration:** rewrite those 5 policies with `(select auth.uid())`. Same meaning, no grant change. |
| P2 | `daily_results.user_id` FK | Advisor INFO: no covering index (the PK leads with `day`). It matters only for account deletion and per-user lookups. | Low | Post-beta, same migration: `create index on public.daily_results (user_id)`. |
| P3 | `loot_claims_fight`, `fight_records_fight`, `*_unhashed` | Advisor INFO "unused index". They were created today (#1211) and are used by every verifier sweep. | None | None. Recheck in a week. |

## Dom-ask line (post-beta, for P1 + P2)

> **Dom, one small yes after beta:** a tidy-up of the game database's access rules so they stay fast as players grow. It changes
> **nothing** about who can see or change what, deletes **no data**, and is undone by one statement putting the old rules back.

## Before Saturday

No change required. One dashboard check for Dom: **S4**, the Email/password provider off.
