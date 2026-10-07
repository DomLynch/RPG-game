# Origins server save and verify: schema + RPC draft (DRAFT, nothing here is applied)

Backend/Accounts lane, 2026-10-06. For review by Strategy, Lead and the Auditor. **No migration file exists yet.** Rule (Lead + Strategy, 2026-10-06): this migration is
ADDITIVE and Origins-only (new tables, functions and one new role; no ALTER, DROP or backfill of any existing live table), so it is applied on a Strategy + Lead GO
after review, a down-script in the same PR that DROPs exactly what it creates (tested on a branch DB first), and an Auditor prod probe before (live schema diff
shows no existing table touched) and after (RLS on every new table, anon can neither read nor write). Anything that touches an existing live table stays a draft
until Dom says yes at that sha. This doc is the design the migration would implement. Shapes are read from `origins/contracts` (trunk: items.ts, story.ts, world.ts, economy.ts) and the open PRs
#1443 (inventory, `origins/inventory/inventory.ts`), #1446 (quest journal), #1447 (talk), #1428 (levelling, `CareerState`). Where a PR is still moving, the
column is marked (PR).

## 0. Rulings (Strategy 2026-10-06, relayed by Expansion) and what is still open

1. **Who writes: decided.** One server-side writer (a VPS HTTP service next to the verifier) runs the pure `origins/*` modules and commits their results through
   `origins_commit`; the database enforces every invariant it can state without content. Same split as `loot_claims`/`awards`.
2. **Career is per account (decided).** Total CP is DERIVED, never stored: `seed_credit` (a FROZEN snapshot of `creditFromMarks(marks)` taken once at the first open,
   an idempotent `career-snapshot` event, never recomputed from live marks) + the CP of every verified Pit win AFTER the snapshot, priced by the #1428 weights
   (`award()`, first win per opponent x level only; each priced win is a `pit:<claim>` event carrying its `cp`) + `world_credit`. `origins_total_credit()` is the one
   place the sum is made. "After the snapshot" means `loot_claims.checked_at` later than the snapshot event, so a win the snapshot's marks already counted is in
   the seed and never paid twice. The check script drives a Pit-only account through the whole server pipeline and asserts it stalls at level 11.
3. **World bosses and mobs: preview-only, not written, until the encounter token + replay record exists** (built next, on the Pit verifier pattern). The migration
   already carries the token table and its issue/consume functions (`origins_encounters`, single use, expiry); nothing awards from them yet. Party and public
   bosses wait for an authoritative room (phase 2). Quests, talk, inventory, trades and Pit wins are server-authoritative now.
4. **Burns: yes.** The append-only mint/burn ledger stays; the `burn` op is the DB side of the `consume` op Expansion adds to #1443 as a follow-up (the ore handed to
   Orla, blacksmith materials). Conservation = live quantity equals the ledger sum, checked at commit.
5. **Erasure (done in the migration):** deleting an `auth.users` row cascades through every `origins_*` table by itself (items, events, journal and the rest are
   append-only against direct deletes only, not against cascades; each erased live item books a burn so the ledger still balances for every other holder), and
   `origins_purge_account(p_account)` does the same for one account while keeping the login. A trade the erased account was in stays open with a null side for
   the survivor to cancel (their escrow is released). **Status 2026-10-06:** (b) the writer service shipped as #1455 (`origins/server`, `open` + `create_character`, ops registered by later PRs), its `/origins/*` nginx route, limits and installer are #1463 (not installed); the migration is applied (202610060001, version 20261006151221) with the flag OFF. **Still open:** (c) faction standing is not in this migration.
   Follow-up migration `202610060002_origins_spend` (applied, version 20261006152956) adds the event kinds `burn`, `upgrade` and `paid`, `origins_event(p_account, p_event_id)` (one stored event of that account, for replaying a retried spend's original receipt) and `origins_unpaid(p_account)` (quest-stage events with unpaid reward lines and no `paid:<event_id>` of the same account and kind). Errata in that file's header comments (they are left as applied so the repo bytes equal prod's): the ruling date is 2026-10-06, not 10-07, and the coin question is answered (Strategy ruled materials only; coin is designed with trading). Its down-script stops being a rollback once any `burn`, `upgrade` or `paid` event exists (events are append-only); after that, undoing it needs a new forward migration.

## 1. Tables (all in `public`, RLS on every one, `revoke all ... from public, anon, authenticated` then explicit column grants)

Naming: `origins_*`. Reads by the owner through RLS; **no client INSERT/UPDATE/DELETE on any table**, all writes by the writer role `frankendom_origins`
(a new role like `frankendom_verifier`, created in the migration, password set out of band, never in git).

| table | key | what it holds |
|---|---|---|
| `origins_access` | `account uuid` pk | the server flag: an allowlist of accounts. Every RPC and read policy requires `exists(select 1 from origins_access where account = auth.uid())` AND the global switch below. Public stays OFF. |
| `origins_config` | `key text` pk | `origins_enabled` (bool). One row; writer-readable, owner-readable. |
| `origins_characters` | `id text` pk (`pc:...`) | CharacterInstance: `account uuid` fk auth.users, `name` (<=32, unique per account), `created_at`, `schema_version`, `pack_slots int` (<= 64) and `bank_slots int` (<= 1000), because #1443 lets a character open a smaller grid. A cap per account (proposal: 5) enforced in the create RPC. |
| `origins_career` | `account uuid` pk | `seed_credit` (frozen), `world_credit` (never decreases: trigger), `rested`, `rested_at`, `heat jsonb`, `story text[]`, `beaten text[]` (first-win-only bosses and legends, cleared at the cap), `version`. Total CP is `origins_total_credit()`, derived (0.2). Matches `CareerState` (#1428) with the credit split. |
| `origins_events` | `event_id text` pk | the idempotency ledger: `kind` (boss, mob, quest-stage, story-step, talk, mint), `account`, `character`, `payload jsonb`, `at`. A retried event violates the pk and pays nothing. Event ids are derived server-side: `boss:<character>:<boss>`, `quest:<character>:<quest>:<stage>`, `story:<character>:<step>`, never taken from the client. |
| `origins_items` | `id text` pk | ItemInstance. `item`, `version int`, `quantity int check (> 0)`, `tier`, `upgrade_level int`, **location columns** `loc_kind`, `loc_owner` (pc), `loc_account`, `loc_container`, `loc_index`, `loc_slot`, `bound_to`, `mint_key text not null unique` (all rows, live or retired), `provenance jsonb` (written once, trigger refuses UPDATE of it), `history jsonb` (trigger: new value must start with the old, append-only), `holder_account uuid` and `single_copy bool` (set by trigger/at mint), `retired_at`, `retire_reason`. |
| `origins_item_ledger` | `id bigserial` pk | append-only: `mint_root text`, `delta int`, `reason` (mint, burn), `item_id`, `at`. Never updated or deleted (trigger). |
| `origins_trades` | `container text` pk | open/settled trade: both sides, offers, state, `settled_at`. Escrowed items sit in `origins_items` with `loc_kind = 'trade-escrow'`. |
| `origins_quest_state` | (`character`, `quest`) pk | QuestState without the journal: `story_version`, `stage`, `status`, `flags jsonb`, `rewarded text[]`, `version`. |
| `origins_quest_journal` | (`character`, `quest`, `seq`) pk | the append-only entries `{stage, text, at}`; UPDATE and DELETE refused by trigger; the text is final when written (journal.ts). |
| `origins_talk` | `character` pk | `told text[]` (once-lines said), `flags jsonb`. Updated under a row lock inside the commit, so two clicks cannot both say a once-line. |

Faction standing (`FactionStanding` in world.ts) is not in this brief and is not in this draft; it is one more table of the same shape when it is wanted.

### Constraints the database holds by itself
- **Location is the only record**: columns above, `check` that exactly the fields of `loc_kind` are set, and `loc_index` in range: pack `0 .. pack_slots-1`
  (trigger reads the character's grid size, never above `PACK_SLOTS = 64`), bank `0 .. bank_slots-1` (never above `BANK_SLOTS = 1000`).
- **One item per place**: partial unique indexes on (`loc_owner`, `loc_index`) for pack, the same for bank, (`loc_owner`, `loc_slot`) for equipped, (`loc_account`,
  `loc_index`) for the account vault, all `where retired_at is null`.
- **Mint key unique forever**; a split child key is `parent || '::s' || version` (#1443 `SPLIT_MARK`), so the root is `split_part(mint_key, '::s', 1)` and the
  unique index stays on the full key. A retired row keeps its key, so a key can never be minted twice.
- **Conservation**: a deferred constraint trigger, run at commit for every mint root a transaction touched: `sum(quantity) of live rows with that root =
  sum(delta) in origins_item_ledger for it`. A bug in the writer cannot commit a duplicated or lost stack.
- **One of each, account-wide**: `unique (holder_account, item) where single_copy and retired_at is null and loc_kind <> 'guild-vault'`. `holder_account` is set by
  trigger from the character's account (or the vault's account, or the escrow's `from` character's account, so an offered item still counts as held). This
  is the re-check on commit: the index itself refuses the second copy, wherever the two sit.
- **Optimistic lock**: every item move compares `version` and bumps it (`checkHistoryKept` semantics); a stale write updates 0 rows and the commit aborts.
- **Reward once**: quest-stage rewards, story events, boss awards all insert their `origins_events` row first in the same transaction; a duplicate aborts the
  whole batch (so the reward is paid exactly once and the retry is a clean no-op, the writer treats the unique violation on a replay as "already done").

## 2. RPCs (security definer, `set search_path = ''`, `revoke all ... from public, anon, authenticated`, `grant execute ... to frankendom_origins` only)

The client never calls a write RPC. It calls the writer service (section 0.1) with its Supabase access token; the writer verifies the token, checks
`origins_access`, runs the pure modules against rows it read under a lock, and commits.

1. `origins_create_character(p_account uuid, p_name text) -> text`: the cap, the unique name, default grid sizes.
2. `origins_open(p_account) -> jsonb`: one snapshot for the writer (marks, characters, career with total, items, quests, journal, talk), career row locked. `origins_snapshot(p_account, p_marks, p_credit)`: the once-only seed, refused unless the marks it was computed from are still the account's.
3. `origins_commit(p_account uuid, p_batch jsonb) -> jsonb`: **the one write path.** `p_batch` is an ordered list of ops, each with the expected `version` where it changes a row: `mint`, `put` (move, equip, unequip, bind, upgrade and the trade hop are all a new location plus history to append), `split`, `merge`, `burn`, `event`, `career_set`, `quest_set`, `talk_set`; any other op is refused (O0011). (The client-facing writer ops `quest_advance` and `talk_pick` are not DB ops: the writer runs the pure modules and commits their result as `quest_set`/`talk_set`/`career_set` plus `event`.) All or nothing in one transaction, every deferred constraint above checked at commit. Returns the new versions. This is where "every item move and trade atomic" lives.
4. `origins_settle_trade(p_container text, p_expected jsonb) -> jsonb`: moves both escrows, appends one `trade` history entry per item, applies `settleTrade(packSizeOf)` results that the writer computed (fills only up to the receiver's real free slots; the overflow goes back to the sender), all in one transaction. Same constraints hold.
5. `origins_pit_pending(p_account)`: verified Pit claims after the snapshot with no `pit:<claim>` event yet (and their award, if any); the writer prices each with `award()` and commits the event (+ the `arena-award` mint). Pit wins stay "exactly as today": the Pit pipeline is unchanged and Origins reads its output. Also `origins_total_credit`, `origins_issue_encounter`, `origins_consume_encounter`, `origins_open_trade`, `origins_settle_trade`, `origins_cancel_trade`.
6. Reads for the client without the writer: owner `select` policies (`account = auth.uid()` or via the character) on characters, career, items, quest state, journal, talk, with column grants (no `history`/`provenance` hidden, they are shown on inspect).

## 3. What the writer verifies before it writes

| event | check |
|---|---|
| Pit win | as today: replay + fight_hash through the existing verifier; Origins only reads `awards`. |
| quest stage | `journal.advance` runs server-side on facts the server holds (`hasItem` from `origins_items`, encounters cleared from `origins_events`, standing, the verified career tier); rewards and the story event insert `quest:...` / `story:...` in the same commit, so once each. |
| talk line | `talk.pick` on the stored `told`/`flags`; its quest advance goes through the same quest path. |
| item move / equip / split / merge / burn | the #1443 functions on the locked rows; DB constraints are the second check. |
| trade | `settle` as above. |
| world boss / mob CP | **not written until the encounter token + replay record exists (0.3)**: needs a replay record or an authoritative encounter. When it exists: >= 10% contribution (`MIN_CONTRIBUTION_PERMILLE`), one award per character per boss (`boss:` event id), through the levelling rule, `beaten` set for first-win-only. |

## 4. Order, rollout, proof

1. Review this doc (Strategy, Lead, Auditor). Answer 0.1 (writer runtime), 0.2 (boss source), 0.3, 0.4, 0.5.
2. Draft PR with the migration (`supabase/migrations/2026...origins_save.sql`) plus `..._origins_save_down.sql` (drops exactly what it creates, in reverse order) and a pg
   test script. I run both on a VPS PG16 and a branch database first, never `db push`, never hosted. It reads `awards` / `my_standing` only (select), so it is class 1.
   Apply only on the Strategy + Lead GO with the Auditor's before/after probes.
3. Probe plan (for the Auditor; add the before/after schema diff and the anon read/write refusal on every new table): with the writer role, mint a stack, split it, try to commit a split that does not sum (must abort); try a second copy of a
   stack-1 item from a second character on one account (must abort); replay a quest-stage reward (must pay once); two concurrent moves of one item (one
   must lose); a client token trying every write (must fail); the flag OFF (every read and RPC refuses).
4. Writer service + route (`/origins`, unlinked, flag OFF) after the migration is applied, not before.
