# Origins server save and verify: schema + RPC draft (DRAFT, nothing here is applied)

Backend/Accounts lane, 2026-10-06. For review by Strategy, Lead and the Auditor. **No migration file exists yet.** Rule (Lead + Strategy, 2026-10-06): this migration is
ADDITIVE and Origins-only (new tables, functions and one new role; no ALTER, DROP or backfill of any existing live table), so it is applied on a Strategy + Lead GO
after review, a down-script in the same PR that DROPs exactly what it creates (tested on a branch DB first), and an Auditor prod probe before (live schema diff
shows no existing table touched) and after (RLS on every new table, anon can neither read nor write). Anything that touches an existing live table stays a draft
until Dom says yes at that sha. This doc is the design the migration would implement. Shapes are read from `origins/contracts` (trunk: items.ts, story.ts, world.ts, economy.ts) and the open PRs
#1443 (inventory, `origins/inventory/inventory.ts`), #1446 (quest journal), #1447 (talk), #1428 (levelling, `CareerState`). Where a PR is still moving, the
column is marked (PR).

## 0. Decisions and blockers up front

1. **Who writes.** The DB has no content definitions (item stack size, binding, tier gates, quest graphs), and re-implementing the pure TS modules in plpgsql
   would give two authorities that drift. So: **one server-side writer runs the pure modules and commits their results through one SQL function; the
   database enforces every invariant it can state without content** (unique location, unique mint key, conservation, account-wide one-of-each, slot ranges,
   optimistic versions, append-only history/journal, idempotent events). Same split as today's `loot_claims`/`awards` (client claims, role
   `frankendom_verifier` writes, RLS + revoke on everything). **Open: where the writer runs** (a Supabase Edge Function importing the TS, or a small VPS HTTP
   service next to the verifier). The DB side is identical either way; I recommend the VPS service (the verifier already runs the TS sim there, and a
   second runtime would double the module-loading problem).
2. **BLOCKER for world-boss and mob awards: there is no authoritative source for them yet.** "Contribution of at least 10%" and "a boss was defeated" must come
   from a server that saw the fight. Pit wins have one (replay + fight_hash). Origins combat in the preview is client-side, so today the server could only
   record a client's word. Options: (a) solo encounters are replay-verified like Pit (the verifier re-runs the input record; needs an Origins record format),
   (b) party/public bosses need an authoritative encounter room (the duel relay's pattern), (c) until either exists, boss/mob CP is not awarded server-side
   and the preview runs without it. Quest rewards and talk effects do not have this problem (section 3).
3. **Career is per account, not per character** (world.ts: "there is one career per account; a second character shares it"). The brief says per character;
   I follow the contract unless Strategy says otherwise: `origins_career` is keyed by account.
4. **Career credit must not have two writers.** Pit marks already live in `fight_results`/`awards` (server-verified). Proposal: `origins_career.credit` holds only
   *world* CP; the account's career CP is `creditFromMarks(pit marks) + world credit`, computed in the writer from `my_standing` + this table. Then Pit wins
   keep working exactly as today and nothing double counts. Needs the #1428 owner to confirm `CareerState.credit` can be that sum.
5. **Destroying items.** The brief's conservation rule (sum of quantities per mint root = minted) has no way to express a consumed or sold stack. I add an
   append-only quantity ledger (mints +n, burns -n); conservation is "live quantity = ledger sum". #1443's `checkConservation` takes a `minted` map; the writer
   builds it from the ledger. Needs the #1443 owner to confirm burns exist in their model.

## 1. Tables (all in `public`, RLS on every one, `revoke all ... from public, anon, authenticated` then explicit column grants)

Naming: `origins_*`. Reads by the owner through RLS; **no client INSERT/UPDATE/DELETE on any table**, all writes by the writer role `frankendom_origins`
(a new role like `frankendom_verifier`, created in the migration, password set out of band, never in git).

| table | key | what it holds |
|---|---|---|
| `origins_access` | `account uuid` pk | the server flag: an allowlist of accounts. Every RPC and read policy requires `exists(select 1 from origins_access where account = auth.uid())` AND the global switch below. Public stays OFF. |
| `origins_config` | `key text` pk | `origins_enabled` (bool). One row; writer-readable, owner-readable. |
| `origins_characters` | `id text` pk (`pc:...`) | CharacterInstance: `account uuid` fk auth.users, `name` (<=32, unique per account), `created_at`, `schema_version`, `pack_slots int` (<= 64) and `bank_slots int` (<= 1000), because #1443 lets a character open a smaller grid. A cap per account (proposal: 5) enforced in the create RPC. |
| `origins_career` | `account uuid` pk | `credit bigint` (world CP only, see 0.4, never decreases: trigger), `rested bigint`, `rested_at bigint`, `heat jsonb`, `boss_at jsonb`, `story text[]`, `beaten text[]` (first-win-only bosses and legends, cleared at the cap), `version int`. Matches `CareerState` (PR #1428). |
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
2. `origins_open(p_account uuid) -> jsonb`: one snapshot for the writer (characters, career, items, quest state, journal, talk) with `for update` option, so the modules run on a consistent read.
3. `origins_commit(p_account uuid, p_batch jsonb) -> jsonb`: **the one write path.** `p_batch` is an ordered list of ops, each with the expected `version`: `mint`, `move`, `split`, `merge`, `burn`, `equip`, `unequip`, `quest_advance`, `talk_pick`, `career_apply`, `event`. All or nothing in one transaction, every deferred constraint above checked at commit. Returns the new versions. This is where "every item move and trade atomic" lives.
4. `origins_settle_trade(p_container text, p_expected jsonb) -> jsonb`: moves both escrows, appends one `trade` history entry per item, applies `settleTrade(packSizeOf)` results that the writer computed (fills only up to the receiver's real free slots; the overflow goes back to the sender), all in one transaction. Same constraints hold.
5. `origins_import_arena(p_account uuid) -> int`: mints `arena-award` / `legacy-unlock` instances from the existing `awards` rows (mint key = claim id, or `legacyUnlockMintKey`), idempotent on the mint key. This is how Pit wins stay "exactly as today": the Pit pipeline is unchanged and Origins reads its output.
6. Reads for the client without the writer: owner `select` policies (`account = auth.uid()` or via the character) on characters, career, items, quest state, journal, talk, with column grants (no `history`/`provenance` hidden, they are shown on inspect).

## 3. What the writer verifies before it writes

| event | check |
|---|---|
| Pit win | as today: replay + fight_hash through the existing verifier; Origins only reads `awards`. |
| quest stage | `journal.advance` runs server-side on facts the server holds (`hasItem` from `origins_items`, encounters cleared from `origins_events`, standing, the verified career tier); rewards and the story event insert `quest:...` / `story:...` in the same commit, so once each. |
| talk line | `talk.pick` on the stored `told`/`flags`; its quest advance goes through the same quest path. |
| item move / equip / split / merge / burn | the #1443 functions on the locked rows; DB constraints are the second check. |
| trade | `settle` as above. |
| world boss / mob CP | **blocked, see 0.2**: needs a replay record or an authoritative encounter. When it exists: >= 10% contribution (`MIN_CONTRIBUTION_PERMILLE`), one award per character per boss (`boss:` event id), through the levelling rule, `beaten` set for first-win-only. |

## 4. Order, rollout, proof

1. Review this doc (Strategy, Lead, Auditor). Answer 0.1 (writer runtime), 0.2 (boss source), 0.3, 0.4, 0.5.
2. Draft PR with the migration (`supabase/migrations/2026...origins_save.sql`) plus `..._origins_save_down.sql` (drops exactly what it creates, in reverse order) and a pg
   test script. I run both on a VPS PG16 and a branch database first, never `db push`, never hosted. It reads `awards` / `my_standing` only (select), so it is class 1.
   Apply only on the Strategy + Lead GO with the Auditor's before/after probes.
3. Probe plan (for the Auditor; add the before/after schema diff and the anon read/write refusal on every new table): with the writer role, mint a stack, split it, try to commit a split that does not sum (must abort); try a second copy of a
   stack-1 item from a second character on one account (must abort); replay a quest-stage reward (must pay once); two concurrent moves of one item (one
   must lose); a client token trying every write (must fail); the flag OFF (every read and RPC refuses).
4. Writer service + route (`/origins`, unlinked, flag OFF) after the migration is applied, not before.
