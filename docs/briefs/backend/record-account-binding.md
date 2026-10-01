# Record → account binding (design brief)

Backend/Accounts, 2026-10-01, for Strategy. **Status: POST-BETA (Strategy, 2026-10-01). No migration or `src/` work before Saturday;
Strategy puts the Dom ask to him after it.** **Design only:** no migration applied, no `src/` change. It closes the hole Stats flagged
in `docs/state/backend.md` (2026-09-23): *records carry no account binding*, so a record cannot be tied to the account that fought it.

## The hole today (trunk f95ccdd7, live a60d94a2)

- A fight record is `build, opponent, weapon, skill, level, seed, ticks, outcome, intents` (`src/record.ts`). Nothing in it names an
  account, and nothing on the server says which account was fighting when.
- **Ladder loot claims** (`loot_claims`): since #1211 (F2, live), one *fight* is one claim, and a fight first shared by someone else is
  refused. What is still open: **a stolen record never shared** (copied from a screen recording, a support paste, a leaked replay) can
  be claimed by whoever posts it first. So can **a near-copy**: one tick's input nudged so it still wins. That is a new fight and a new
  hash, which F2 cannot see.
- **Seed-shopping:** the seed is client-chosen (`src/match.ts`: a fixed 731 opener, then `nextSeed` per rematch), so a player can
  replay a known-easy seed forever.
- **Daily** (`daily_results`): one row per account per day, and everyone fights the same seed (`daily_fight`). Nothing stops account B
  posting account A's winning daily record as B's own and taking A's place on the board.

## Design

### 1. Ladder: the server issues the seed, and the seed is the binding

The record already carries `seed`, so if the server hands out the seed it also records who fought. **No record-format change and no
`RECORD_VERSION` bump.**

- New table **`fight_starts`**: `id bigint identity pk`, `user_id uuid not null default auth.uid() references auth.users on delete
  cascade`, `opponent text`, `level smallint`, `seed integer not null unique`, `created_at timestamptz default now()`.
- New RPC **`start_fight(opponent text, level int) returns (id bigint, seed int)`**, security definer with `search_path = ''`. Signed-in
  only (`auth.uid()` not null). Range checks on opponent and level. A cap of 120 starts an hour per account, checked per row as
  `loot_claims_rate` does. It draws a random 32-bit seed, retrying on the unique index, inserts the row and returns it.
- `loot_claims` gains **`fight_start bigint unique references fight_starts(id)`**, so one claim per start. The client inserts it
  (`grant insert (fight_start)`).
- **Verifier** (`scripts/verify-loot.mjs`): a claim created on or after `bind_from` must carry `fight_start`, and that start must be the
  claimer's (`fight_starts.user_id = claim.user_id`), with the record's `seed`, `opponent` and `level` equal to the start's. Notes
  (verbatim, short): `"not started on the server"`, `"not your fight"`, `"not this fight's seed"`. A refusal touches no standing or
  award, as with F2. A stolen or nudged record carries someone else's seed, and that seed's start row belongs to them, so it is refused.
- **`bind_from`**: one owner-managed row (`public.binding_limits`, the `share_limits` pattern) that Deploy sets to *publish time + 15
  minutes*, so tabs still running the old client can finish their claims. Claims created before it keep today's rules.

### 2. Daily: same seed for everyone, so it is bound like F2

A per-account seed would break "everyone fights the same warden today", so daily gets the A+ treatment instead:

- `daily_results` gains a verifier-written `fight_hash` (the decoded fight, as `scripts/verify-loot.mjs` `fightHash`) and a **unique
  `(day, fight_hash)`**. The daily verifier hashes first, then refuses a result whose fight another account already posted that day
  (`"someone else's daily"`). It also refuses one whose fight was first shared by another account (the `fight_records` rule from F2).
- The residual is the same as F2: a nudged copy that still wins is a new fight. Daily rewards are board position only, which Strategy
  accepted for F2.

### 3. RLS and grants

| Object | anon | authenticated | frankendom_verifier |
|---|---|---|---|
| `fight_starts` | nothing | nothing (no select; the RPC returns the row) | `select (id, user_id, opponent, level, seed)` + a select policy |
| `start_fight()` | — | execute | — |
| `loot_claims.fight_start` | — | insert (own rows, the existing policy) | select |
| `binding_limits` | nothing | nothing | select |
| `daily_results.fight_hash` | — | nothing | select, update (with its own update policy) |

Every new table: `enable row level security; revoke all … from public, anon, authenticated` first. `fight_records` already revokes
client update and delete (202610010001), and the `awards-database-check` emulated defaults catch any table that forgets.

### 4. Migration and backfill (existing rows)

- One migration, `20261003xxxx_record_binding.sql`: the two tables, the RPC, the `loot_claims` column, the `daily_results` column and
  index, the grants and policies. **No existing row is rewritten.**
- `loot_claims` (6 hosted, all one account): `fight_start` stays null. They predate `bind_from`, so they keep their verified state and
  their award.
- `daily_results`: `fight_hash` is backfilled by the daily verifier's first sweep (the F2 pattern; the database cannot gunzip).
  **Before** adding the unique `(day, fight_hash)`, check hosted for a same-day duplicate. **RULED (Strategy 2026-10-01): keep the
  earlier row** by `created_at`. The later duplicate is removed in the second step, and the migration's output **logs every dropped
  `(day, user_id)`** so the board change is on record. Dom's yes covers it (the ask says so).

### 5. Client change (a separate PR, after the migration)

- `src/match.ts`: a signed-in **career ladder** fight awaits `start_fight(opponent, level)` and uses the returned seed instead of
  731/`nextSeed`. Prefetch the next start while the end-of-fight screen is up, so a rematch has no visible wait.
- `src/loot-claims.ts` (the outbox, #1209): the claim body carries `fight_start`, and the outbox entry keeps it across reloads.
- **Fallbacks (RULED, Strategy 2026-10-01):** a guest, offline, or failed `start_fight` keeps today's local seed (731, then `nextSeed`),
  and the fight is **practice**: it plays normally but never becomes a claim. The end-of-fight screen says, in one line, **"Practice: sign
  in to count"**. Sparring and replay are unchanged.
- **Gate impact (seed injection):** the fallback keeps every **signed-out** gate on the 731 opener, unchanged. Only gates that sign in
  *and* play a career fight meet `start_fight`. Both of those fake the API by intercepting `/rest/v1/*` in the page, so the injection is
  one more stubbed route, **`/rest/v1/rpc/start_fight` → `{ id: <n>, seed: 731 }`**. No `?seed=` debug path and no product change.
  - `scripts/account-browser-check.mjs` (release row `account-browser-check`; **owner: Backend/Accounts**, this lane). It stubs
    `loot_claims` today. Add the `start_fight` stub, and assert the claim body carries `fight_start`, the same PR as the client change.
  - `scripts/hero-preview-check.mjs` (**owner: Hero Look**). It seeds a signed-in session. Without the stub, its fight falls back to
    practice on 731, so its frames are unchanged, but it should stub `start_fight` too so it exercises the signed-in path. One line,
    same PR; Backend writes it and Hero Look reviews.
  - Headless scripts that call `initialPractice(731, …)` directly (arena/audio/armour previews) never touch the fight-start path:
    unaffected.

### 6. Run order against the duel migrations

`202609300001_duel_metrics` → `202610020001_duel_metrics_result` → **`record_binding`**. They share no table, so the order is only
numbering. Within this change: **migration → verifier publish (with `bind_from` unset = binding off) → client publish → Deploy sets
`bind_from`**. The verifier never requires a binding before a client that sends one is live.

### 7. Rollback

1. Unset `bind_from` (`update public.binding_limits set bind_from = null`): binding stops being required, with no deploy.
2. Roll the client back (`scripts/rollback.sh`), so seeds go back to local and nothing sends `fight_start`.
3. Only then, if the schema itself is the problem, as owner in one transaction:
   `drop function public.start_fight(text, int); alter table public.loot_claims drop column fight_start; drop table public.fight_starts,
   public.binding_limits; drop index public.daily_results_one_fight_per_day; alter table public.daily_results drop column fight_hash;`
   plus the `schema_migrations` row. No claim, award or daily result is deleted.

### 8. Tests the build PR must carry (fail-first)

- (a) A claim whose record was fought on another account's start → `"not your fight"`. (b) A start-less claim after `bind_from` →
  refused; before it → today's rules. (c) The record's seed ≠ the start's → refused. (d) Two claims on one start → unique violation at
  insert.
- (e) A daily result posted by B with A's fight → `"someone else's daily"`, and A's row is untouched.
- (f) `start_fight` as anon → refused; the 121st start in an hour → refused; a client cannot select or update `fight_starts`.
- Mutants: drop the user check, drop the seed check, drop the `bind_from` gate. Each must turn a test red.

## Dom ask (plain English, send when the build PR is READY)

> **Dom — one yes needed: tie each fight to the account that fought it.**
> **ADDS:** when a signed-in player starts a ladder fight, the server now deals the fight's random setup and remembers who it dealt it
> to. A win can only earn marks and loot for that account. A small new list of "fights started" holds the account, the opponent, the
> level and that random number; nothing personal beyond the account. For the daily fight, the server now refuses a second account
> posting the same fight that day.
> **CHANGES:** a signed-in ladder fight asks the server for its setup first (one quick call, made during the previous fight's end
> screen). Guests and offline play still work but count as practice. The first fight is no longer the same fixed fight for everyone.
> **DATA DELETED:** none, with one possible exception: if two accounts already posted the very same daily fight on the same day, the
> later copy comes off the daily board (the earlier one stays), and each one removed is listed. Earlier claims and awards keep exactly
> what they have.
> **UNDO:** one switch turns the requirement off with no release; a rollback puts the old client back; one statement removes the new
> parts.
> Guests and offline play still work; the end screen says "Practice: sign in to count".
> Reply **yes** and Deploy applies it in the run that ships the client.

## Strategy's rulings (2026-10-01)

1. Guest, offline or failed start = practice, not counted, for beta; one UI line, "Practice: sign in to count".
2. A same-day daily duplicate at backfill: keep the earlier row and log the dropped ids in the migration output.
3. **Post-beta.** It touches the fight-start path and the 731-opener gate, so nothing ships before Saturday. Strategy asks Dom after.
