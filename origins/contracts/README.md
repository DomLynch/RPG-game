# Origins O1: shared contracts

Versioned TypeScript schemas, hand-written validators and a few pure server-side transactions for Frankendom: Origins. They come from the blueprint (`docs/briefs/origins/origins-blueprint-2026-10-06.md`, with Dom's rulings at the top), the clean-room specs in `docs/specs/origins/`, and Dom's decisions of 2026-10-06 passed on by the Lead. None of this is donor code.

**Status:** paper and prototype only. Nothing in `src/` imports this folder, and nothing ships. The dependency runs one way: the contracts import read-only from `src/` (`career.ts` `TITLES`/`MAX_LEVEL`/`RANK_STEPS`, `gear-stats.ts` `loadoutFor`/`CAPS`/`SLOT_WEIGHT`, `grades.ts`, `loot.ts`, `legends.ts`, `roster.ts`), so rank titles, gear pricing and today's ids each still have exactly one source. **Career level is not computed here:** the gate input is the server-verified `careerLevel`, which the progression model computes from career credit on its rising requirement curve. That curve lives in `origins/progression`, not in these contracts. There are no new dependencies.

**Checks** (run on the VPS, never on the shared Mac):

```sh
node --test origins/contracts/*.test.ts      # Node's built-in runner, like tests/*.test.ts
npx tsc -p <temp tsconfig extending ./tsconfig.json, types [vite/client, node], include [origins/contracts]>
```

Last run: 80 tests, 80 pass. `tsc` strict is clean. `eslint origins/contracts` is clean.

## Files

| File | Holds |
|---|---|
| `core.ts` | `Result`/`Issue` types, field readers, `schemaVersion` and `kind` checks, the timestamp, text and key formats |
| `ids.ts` | The namespaced, branded ID scheme and the legacy mappings |
| `items.ts` | `ItemDefinition`, `ItemInstance` (location, provenance, history, upgrade level), custody, one-of-each, `equipItem`, `resolveLoadout`, `LootTable` |
| `economy.ts` | `Trade` (only at the Concord Exchange) and the NPC-service pattern: `ServiceDefinition`, `UpgradeCostTable`, `UpgradeRequest`/`UpgradeReceipt`, `performUpgrade` (the blacksmith) |
| `world.ts` | Gates and access from the one career, `CharacterInstance`, `CharacterDefinition`, `FactionDefinition`/`FactionStanding`, `RegionDefinition`, `EncounterDefinition` |
| `story.ts` | `QuestDefinition` (stages, branching conditions, graph checks, migrations), `QuestState`, `migrateQuestState` |
| `registry.ts` | `loadContent`: loads a bundle of definitions and resolves every cross-reference. Lookups return a `Result`. `checkInstances` |
| `fixtures.ts` | Example content: a slice of chapter one, *The Stolen Name*, plus the Exchange forge |
| `*.test.ts` | One test file per module |

## How the validators behave

- Every reader takes `unknown` and returns `Result<T>`: either `{ ok: true, value }` or `{ ok: false, issues: [{ code, path, message }] }`. Readers never throw and never coerce, and they report every issue they find, not just the first.
- **Unknown fields are refused** (`unknown-field`). A field this build does not know is either a typo or newer data. An older build must never half-read a record and write it back without the fields it skipped; `src/loot.ts` `cleanLoot` does exactly that today (O0 baseline §5, collision 3).
- **Schema versions.** Every top-level record carries `kind` and `schemaVersion`. A missing version is `missing-version`. Any version the reader does not list, older or newer, is `unsupported-version`. Every contract is at version 1.
- **Unknown IDs.** A malformed id is `bad-id`. A well-formed id in the wrong namespace is `wrong-namespace`. A reserved legacy form that names nothing in today's tables is `legacy-unknown`. A reference to an id the loaded content does not define is `unknown-id`, reported at the path that made the reference. Registry lookups return `unknown-id` and never return `undefined`.
- **One inventory authority.** An `ItemInstance` carries its own single `location`, and nothing else lists items. `CharacterInstance` refuses `inventory`, `equipped`, `bank`, `victoryMarks`, `rank`, `level` and `stats` as unknown fields (the career level arrives in a `CareerStanding` read from the server, never stored on the character). `checkCustody` enforces one id = one copy, one mint key = one mint, and one occupant per slot.

## Contracts

| Contract | Version | What it is for | Blueprint package |
|---|---|---|---|
| ID scheme (`ids.ts`) | n/a | Stable, namespaced, branded ids. Legacy ids are embedded, not re-minted | O1 |
| `CharacterDefinition` | 1 | A named figure: lore identity, faction, relationships, quest roles, presentations, encounter forms (a roster opponent at a level 1..46 and/or an encounter), essential flag, a 24-hour routine | O1, O4 (NPCs), O6 |
| `CharacterInstance` | 1 | A player character. It links to the career through its account. Rank is always the title of the account's server-verified career level, and no copy of marks, credit, level, rank, stats or items is stored | O1, O3, O4 |
| `CareerStanding` and gates (`checkCareerStanding`, `verifiedTier`, `gateAccess`, `regionAccess`) | n/a | The input is `{ source, careerLevel }`: an integer 1..`MAX_LEVEL` (cap-parametric), server-verified, computed by `origins/progression` from career credit. The title is `TITLES[floor((level − 1) / 5)]`, as in `src/career.ts`, Origin at the top of any ladder. A legacy account's level is `levelOf(marks)`, so every existing rank is unchanged, and a level reached through world play opens gates the same way. Ruling 2: Gladiator (level 11) opens the outer gate, Champion the next realm, Origin the endgame. Ruling 3: membership is derived from the gate. A device standing, or an out-of-range or non-integer level, opens nothing | O4 |
| `FactionDefinition` | 1 | Dense ranks (up to 10, ascending standing) and directional reactions as one of four attitudes | O6 |
| `FactionStanding` | 1 | A character's standing, bounded to −1000..1000, plus rank and expelled. `attitudeOf`, `canPromote` (offered, never automatic), `adjustStanding` (clamped) | O6 |
| `RegionDefinition` | 1 | Gate, waypoints, portals (two-way references checked), landmarks, spawns, quest triggers, asset manifest | O3 (Exchange), O4 |
| `EncounterDefinition` | 1 | A staged boss or public event: ordered stages (kills to advance, population, weighted roster, stage loot), boss and boss loot (optional boss level and health, required by a world boss), decay, restart, personal reward threshold (share of the boss's health) | O2 (staged boss proof), O5, O6 |
| `QuestDefinition` | 1 | Named stages (progress, finish or fail), transitions guarded by typed conditions, journal text, stage rewards, a `storyVersion` and migrations. The graph is checked at load: no soft locks, no orphan stages, at least one finish | O2 (journal proof), O4 |
| `QuestState` | 1 | One character's progress: story version, stage, status, a chronological journal of final text, flags, and `rewarded` (stages whose rewards were granted; absent = `[]`). `checkQuestState`, `migrateQuestState`, `grantStageRewards` (once per stage, ever) | O2, O4 |
| `ItemDefinition` | 1 | Category, **four rarities**, power budget, material, appearance and story significance as five separate fields. Binding, stack size | O1, O2, O3 |
| `ItemInstance` | 1 | One physical copy: unique id, one location, version (optimistic lock), tier won at, optional `upgradeLevel` (absent = 0), binding, permanent provenance, append-only history | O2 (inventory proof), O3 |
| `LootTable` | 1 | Rolls (probability gate, repeat, independent or weighted with drop limits), entries with integer chances and level gates, one currency range, the take-one or collect presentation, personal distribution, a repeat-attempt fallback | O2, O6 |
| `Trade` | 1 | Two-sided escrowed trade. Settles only at the Concord Exchange. An accept names the offer version. Gifts are allowed | O3 |
| `ServiceDefinition` | 1 | The generic NPC-service pattern (npc, region, kind, cost table, what it accepts). Today `upgrade` only; an armourer or merchant adds a kind | O3 |
| `UpgradeCostTable` | 1 | Upgrade prices as data, with its own `revision`: one row per (level, rarity), coin plus up to 4 material lines. At load every line must be payable: a material, at most one stack of it (so 1 for a stack-1 material) | O3 |
| `UpgradeRequest` / `UpgradeReceipt` | 1 | The blacksmith's request (with idempotency key and expected version) and its receipt: one material line per instance spent, no instance twice, at most `MAX_UPGRADE_MATERIAL_INPUTS` (64) lines, so every receipt the smith writes parses | O3 |

### The fixed spine

Gear stays on Attack and RES, resolved before the fight by `src/gear-stats.ts`, with caps of 1.15 and 0.80. Nothing here changes timing. An item's power is either `slot-weight` (its slot's `SLOT_WEIGHT` × (effective tier level − 1), today's per-piece score) or `none`. `resolveLoadout` hands the kit to `loadoutFor`. The tests show:
- a full Origin set lands exactly on `CAPS`;
- nine upgrade levels on top of an Origin set change nothing;
- rarity never changes the result.

### Dom's decisions, 2026-10-06, as built

- **Pit-won pieces are tradeable.** Legacy loot definitions must be `binding: none`.
- **Provenance is permanent.** A Pit piece's provenance names `wonBy` (character), `fromLegend` (`<opponent>-<rung>`, checked against `PORTRAIT_KEYS`, the piece's opponent and the rank) and `atRank`, with `at` as the date. Trades and upgrades only append to `history`. `checkHistoryKept` proves the provenance is unchanged and the old history is a prefix of the new one.
- **One of each per player** (`checkOneOfEach`). A player is an account. The rule covers worn, pack, bank, account vault and open trade offers, and applies to single-copy definitions only (stackables merge). `settleTrade` refuses a trade that would break it, and nothing moves.
- **Trades are valid only at the Concord Exchange.** `Trade.region` must be `region:concord-exchange`. Any offer change clears both accepts and bumps the version. An accept names the version it accepts.
- **Trade cooldown, no hard limit** (Dom, 2026-10-07; `economy.ts` `tradeCooldown`). No piece binds for having been traded. A fresh piece (looted, Pit-won, minted or bought) cannot be offered until `FIRST_TRADE_DELAY_S` (72 h) after its mint `at`. After each change of hands the new owner waits `COOLDOWN_STEPS_S` (7, 14, then 30 days for the 3rd and every later trade), from the last `trade` history entry. The hop count is the number of `trade` entries, so it never decays and survives version bumps, upgrades, moves and splits. Never tradeable: bound and story-critical pieces, every stackable, anything with `cash-shop` provenance, and any non-gear `shop` purchase (shop consumables). Shop gear trades under the same cooldown and keeps its `shop` provenance. Metal is an account balance, never an item, and the `Trade` contract has no field for it. `changeOffer` refuses a piece that cannot be offered now (a cooling one at `offered[j].cooldown`, "tradeable again at <iso>"), and `settleTrade` re-checks every piece at settle time. The constants are frozen data, exported for the server and the UI.
- **No id counts twice.** Every function that takes a list of instance ids or instances refuses a repeat with `duplicate-id`: `changeOffer` (twice on one side, or already on the other side), `settleTrade` (an offer or a holdings list naming one piece twice), `performUpgrade` (one material stack offered twice) and `parseUpgradeReceipt`. `moveItem` and `equipItem` take one instance; `resolveLoadout` and `checkOneOfEach` take instances, and `checkCustody` reports a repeated id.
- **Owning is not wearing.** `equipItem` requires server-verified rank ≥ the piece's effective tier (won rank + upgrade levels). `moveItem` refuses to equip, and refuses any move that changes who holds the item: that is a trade.
- **Crafting is out.** There is no craft provenance, no recipes and no material rules beyond the blacksmith's optional cost lines.
- **NPC services; the blacksmith is first** (`performUpgrade`, server-only):
  - It raises `upgradeLevel` by one level per request. Each level is worth one rung of the piece's own slot weight, and the effective tier is clamped at Origin.
  - It refuses an upgrade that would have no effect: a zero-weight slot, or a piece already worth Origin.
  - It requires the payer's rank (a valid, server-verified career level) to reach the upgraded piece's effective tier.
  - A piece kept in the bank is upgraded only at the Concord Exchange (`place`; Strategy, 2026-10-06). The writer derives `place` from presence (in zone `exchange`, last pose at most PRESENCE_FRESH_MS old), never from the request body: launch gate X1. A worn or packed piece upgrades wherever the smith is.
  - It charges one-currency coin plus optional material lines from the cost table, all or nothing. A material stack offered twice is refused before anything is spent, and so is an offer of more than 64 instances.
  - A story-critical piece may be upgraded (Strategy, 2026-10-07): it keeps its story flag, binding, provenance and place, and stays live for the quest step that names it. A story-critical piece is never a material (it burns only on a quest step that names it), and the piece being upgraded is never its own material.
  - It writes a receipt (cost table id and revision included) and appends `history: { kind: 'upgrade', smith, level, receipt }`.
  - A repeated idempotency key returns the original receipt with no new charge. A reused key on a different request is refused. A stale item version is refused.
  - The upgrade level travels with the piece on trade.
  - The proposed prices are in `docs/specs/origins/blacksmith-costs-proposal.md`.

### ID scheme

`<namespace>:<local>`. Namespaces: `account`, `pc`, `character`, `faction`, `quest`, `region`, `encounter`, `item`, `inst`, `loottable`, `container`, `service`, `costtable`. The local part is lowercase `a-z 0-9 . _ -`, 1 to 96 characters. `account:` takes a lowercase uuid, which is the Supabase `auth.users.id` unchanged.

Legacy ids are embedded byte for byte, so nothing that is persisted today changes:

| Today | Contract id | Checked against |
|---|---|---|
| loot piece `veteran.Helmet` | `item:loot.veteran.Helmet` (the only mixed-case local part allowed) | `isLootId`; retired pieces included |
| legend face key `veteran-3` | `character:legend.veteran-3` | `PORTRAIT_KEYS` |
| roster opponent `veteran` | `character:opponent.veteran` | `isOpponentId` |

The tests round-trip every current and retired `LootId`, all 100 legend keys and every roster opponent. A legacy `item:loot.*` id is an item **definition** (today's `owned` is a set of collection unlocks), never an instance.

## Deliberate divergences from the specs

Each item below is a change made on purpose, with the reason.

**Inventory (eqemu-inventory):**
1. No numbered slot scheme, bags, cursor or augments. Locations are typed (`equipped`, `pack`, `bank`, `account-vault`, `guild-vault`, `trade-escrow`) with an index. *Reason:* the spec marks the slot scheme as tied to the EQ client; we want one location per instance.
2. Lore groups are replaced by **one of each** across every holding of a player, including the account vault. EQ exempts the shared bank. *Reason:* Dom's ruling, and duplication by parking items in a vault is exactly the hole to close.

**Loot (eqemu-loot):**
3. Chances and probabilities are integers 1..100. Zero is refused; EQ never drops at 0. Values above 100 are refused; EQ treats them as 100. *Reason:* an authoring error should be loud, and integers keep rolls exact on every engine.
4. `minDrop > dropLimit` is refused. EQ silently raises the limit. The auto-limit of 10 for lootdrops with more than 100 entries is not carried. A duplicate item in one roll is refused. *Reason:* no silent rewrites of content.
5. No global loot, no copper/silver/gold/platinum split (one currency, blueprint §8), no equip-on-NPC. Distribution is `personal` only. The killer-level "trivial" band became a plain `levelMin`/`levelMax` gate. Anti-farm is ruling 7's progression rule, not a loot filter. *Reason:* blueprint scope.
6. The contract does not fix when loot is rolled. EQ rolls at spawn; O2's roller decides, and must be seeded and deterministic.

**Bank (modernuo-bank):**
7. No gold piles, checks or weight. Money is one integer balance; items occupy indexed slots (bank 1,000, pack 64). There is no banker-speech protocol. *Reason:* one currency, server-authoritative.

**Secure trade (modernuo-secure-trade):**
8. A trade settles only at the Concord Exchange; there is no 2-tile distance rule. *Reason:* Dom's ruling.
9. An accept is bound to the offer version, and an accept against an older version is refused. *Reason:* closes the race the donor handles only by clearing ticks.
10. Completion never spills items onto the floor. A full pack refuses the whole trade, and nothing moves. *Reason:* blueprint §8, no item loss.
11. One-of-each, binding and story-critical checks happen at settlement. A trade between two characters of one account is refused; the account vault exists for that.
12. Currency offers are not modelled yet; trades are items only. An open question for O3.

**Quest journal (openmw-quest-journal):**
13. Stages are named, and the index never goes down (there is no `SetJournalIndex`). There is no restart propagation by display name.
14. An unknown stage or condition is a **content-load error**. OpenMW raises the index silently. *Reason:* blueprint test matrix, "no silent invented progression".
15. Saved journal text is kept even if its stage later disappears; OpenMW drops it on load. Story-version migration maps stages or falls back to a named checkpoint, and with no migration the state is refused. *Reason:* blueprint §9, "store the version of a story… provide migrations or a safe checkpoint".
    - **Changed (review fix):** the checkpoint is for active quests only. A finished or failed quest stays terminal: its ending must be mapped onto a current stage of the same kind, or the migration is refused (`no-migration`); mapping it onto a progress stage or the other kind of ending is a `rule-violation`. Before, a finished quest with no mapping went back to the active checkpoint, where its stage rewards could pay again.
    - **New:** `QuestState.rewarded` records each stage whose rewards were granted; `grantStageRewards` refuses a second grant (`duplicate-id`), and migrations carry the record through the stage map (an unmapped id is kept while a current stage has that name). *Reason:* rewards are paid once, ever.
16. The story graph is checked at load (reachability, a way out of every progress stage, at least one finish). This has no donor equivalent. *Reason:* "no irreversible soft lock".

**Factions (openmw-factions-disposition, gothic-guilds-attitudes):**
17. Standing is bounded to −1000..1000; OpenMW faction reputation is unbounded. *Reason:* blueprint §7, repeated safe actions must not buy unlimited favour.
18. Ranks are a dense list of up to 10. There are no name gaps, which in OpenMW can stall or lower promotions.
19. Reactions are one of four attitudes (the Gothic set) rather than integers. A pair that is not listed is **neutral**; in Gothic an uncovered table pair is hostile.
20. Expulsion caps attitude at angry. OpenMW zeroes the faction term instead.
21. There is no disposition, persuasion, barter formula, attribute or skill rank requirement, per-NPC permanent or temporary attitude, or crime pipeline. *Reason:* later story-module work, not O1 contracts.

**Routines (gothic-routines):**
22. A routine must cover the 24-hour day exactly once. Overlaps and gaps are refused, so neither the donor's first-match rule nor its gap fallback is needed; `start == end` is refused.

**Champion spawns (modernuo-champion-spawns):**
23. Stages are authored and fixed. There is no random 16..18 level count and no kill-count table.
24. Decay is authored (a window and a keep-progress percentage); UO uses 30 minutes and 20%. A public event must decay.
25. Rewards go to each contributor above a threshold, as personal loot. There is no single weighted artifact roll, which also removes the donor's infinite-loop bug. There are no valor, scrolls or gold rain.

**Upgrades (no donor spec; Dom's 2026-10-06 ruling):**
26. Each upgrade level is one rung of the piece's own slot weight, clamped at Origin. That makes an upgraded piece worth at most what the same piece won at Origin is worth, and its wearer needs that rank.
27. **Changed (review fix):** a cost line must be payable under the stacking and one-of-each rules, checked at content load (`checkCostTablePayable`): at most one stack of a material, so a stack-1 material (a boss trophy) can be asked for once per line, never twice. The proposal's level-9 "2 boss trophies" became 1. We are stricter than strictly necessary for stackables (several stacks could pay a larger line) on purpose: one stack always pays, and it keeps a receipt small.
28. **Changed (review fix):** a receipt has one material line per instance spent and refuses a repeated instance; the smith refuses more than 64 material instances, which is the receipt's own line limit, so a server receipt always parses.

**Career (ruling 7, one progression):**
29. **Changed (review fix):** gates, equipping and the smith read the server-verified **career level**, not victory marks. The contracts title a level exactly as `src/career.ts` (`TITLES`, five levels per title, `MAX_LEVEL`, cap-parametric), and they do not compute a level from marks or credit: the rising credit curve is the progression model's (`origins/progression`). Legacy accounts are unchanged because their level is today's `levelOf(marks)`. An out-of-range or non-integer level is refused (`checkCareerStanding`), and a gate reports it as `invalid`.

**Process:**
30. Tests use Node's built-in runner (`node:test`) rather than vitest, matching `tests/*.test.ts`. vitest is not a dependency (Lead confirmed).

## Proposal: legacy loot ids → item instances (needs arena Lead + Backend sign-off; not before beta)

This is a proposal only. Nothing in `src/`, `supabase/` or `scripts/` changes, and no SQL is written here. The contracts above already support it: `legacy-unlock` provenance, deterministic mint keys, and the `item:loot.*` mapping.

**What exists today** (O0 baseline §3, §5):
- `fighter_profiles.loot.owned` is a client-reported set of `LootId`s.
- The server's view is `standing_of().owned` = `account_seed.owned ∪ awards.piece`, where `awards` holds `(claim_id, piece, tier 1..10)` written by `frankendom_verifier` in `scripts/verify-loot.mjs`.
- A player holds at most one of each `LootId`. That already satisfies one-of-each, so the migration can never create a duplicate.

**Proposed steps, in order:**
1. **Characters first.** Create one `pc:` row per account that has a profile. One career per account remains; this is only the custody owner. The ids are server-minted and additive.
2. **An additive `item_instances` table, empty.**
   - Columns follow `ItemInstance` v1.
   - `mint_key` is unique.
   - A partial unique index enforces one-of-each per account for single-copy definitions.
   - The `version` column is used for compare-and-swap.
   - RLS allows owner read only; there is no client insert, update or delete.
   - Provenance and history are append-only, enforced by a trigger that refuses an update to `provenance` and allows only appends to `history`.
3. **Dual-write in the verifier, behind a flag.**
   - When `verify-loot.mjs` writes an `awards` row, it also mints an instance in the same transaction.
   - Mint key: `claim:<loot_claims.id>`.
   - `arena-award` provenance: `wonBy` = the account's `pc`, `fromLegend` = `<opponent>-<tier>`, `atRank` = `TIERS[tier-1]`, `at` = the claim time.
   - The `awards` table and `standing_of` stay exactly as they are; the Pit keeps reading them.
4. **Backfill, idempotent.**
   - For every `(account, LootId)` in `standing_of().owned` that has no instance yet, mint one with `legacy-unlock` provenance and the derived mint key `legacy:<uuid>:<lootid>`. A rerun collides on the unique key instead of minting again.
   - `fromLegend`/`atRank` come from `awards.tier` where it exists, otherwise from the client `taken[...].tier` if the Backend accepts that client-reported value for history only, otherwise `null`.
   - The location is the account vault.
5. **Verify before anything reads it.** For each account, the instance count must equal `|owned|`. No `mint_key` may collide. `checkCustody` and `checkOneOfEach` must pass over a dump.
6. **Readers last.** Origins (Exchange, trade, smith) reads `item_instances`. The Pit paperdoll, `cleanLoot`, `loot_claims` and the CHECK regexes are untouched.
   - Instances never enter the client save, so an older build's `cleanLoot` cannot erase them.
   - `Kit.gear` in PvP records stays `LootId` text.

**Rollback:**
- Turn off the dual-write flag.
- Everything is additive, so the arena never depended on it.
- Backfilled rows can be deleted by the `legacy:` mint-key prefix, and dual-written rows by `claim:`. `awards`, `loot_claims` and `account_seed` were never modified.
- If trades have already happened, roll back by freezing trade settlement, not by deleting rows, so that history stays true.

**Questions for sign-off:**
- When a Pit piece is traded away, the seller can win it again: Strategy's proposal (2026-10-06) is that the Pit re-offers a piece once the player no longer owns a copy, because the one-of-each rule checks current ownership only. That keeps tradeable pieces flowing into the Exchange, and each new copy gets its own provenance. So `dropFor` must check owned *instances*, not the `owned` collection record. Arena Lead and Backend confirm this together with the migration.
- Should `taken[...].tier` (client-reported) seed `atRank` for history, or should unknown stay `null`?
- How does the verifier map an account to its `pc` once multiple characters per account exist?

## Open items for the next audit round

- An O2 loot roller (seeded, deterministic) and an encounter runtime, built on `LootTable` and `EncounterDefinition`.
- A currency ledger contract (the balance is an input to `performUpgrade` today) and currency in trades.
- Guild vault roles and limits, and the market escrow (blueprint §8: later).
- The ruling-7 progression model (career credit from Pit and world play, and the rising level curve) lives in `origins/progression`. These contracts take its output, the server-verified career level, and encode no curve.
