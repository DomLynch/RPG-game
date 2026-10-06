# EQEmu behaviour spec: loot tables

- Donor: EQEmu (GPLv3), commit `4aceae18b94ffaafc08e2b17bc41cd72c77f795d`, read-only at `/opt/frankendom-shadow/work/expansion-donors/EQEmu` on the VPS.
- Spec author: analyst-eqemu. Clean-room: this document describes behaviour only. It contains no donor source. Implementers must not open the donor tree.
- Destination: economy (drops, coin) and progression (trivial-loot rule).

## 1. Purpose

Decide, when a monster spawns, which items and how much coin it carries. Its corpse later yields these. Data is a two-level tree:

```
NPC type ──loottable_id──► LOOTTABLE (coin range, avg coin)
                              │ 1..n LOOTTABLE ENTRY (lootdrop_id, multiplier, droplimit, mindrop, probability)
                              ▼
                           LOOTDROP (a named pool)
                              │ 1..n LOOTDROP ENTRY (item_id, chance, multiplier, charges, equip flag,
                              ▼                    npc level gate, killer "trivial" level gate)
                           ITEM
```

On top of that, **global loot** rows attach extra loottables to any NPC that matches filters (level band, race, class, body type, rare, raid, hot zone, zone list).

Important timing: **loot is rolled at spawn**, not at death. At death, only the killer-level "trivial" filter removes items (section 5.6).

## 2. Files, functions and call graph

| Path:line | Function | Role |
|---|---|---|
| zone/spawn2.cpp:299-302 | spawn path | after building the NPC: roll its own loottable, then (unless the NPC opts out of global loot) roll global loot |
| zone/loot.cpp:31-140 | NPC::AddLootTable(id, is_global) | coin roll + loop over loottable entries |
| zone/loot.cpp:142-250 | NPC::AddLootDropTable(lootdrop_id, drop_limit, min_drop) | item selection inside one lootdrop |
| zone/loot.cpp:252-281 | NPC::MeetsLootDropLevelRequirements | NPC-level gate per lootdrop entry |
| zone/loot.cpp:284-555 | NPC::AddLootDrop | create the loot item record; optionally equip it on the NPC (visual + stats) |
| zone/loot.cpp:607-613 | NPC::CheckGlobalLootTables | for each matching global entry roll its loottable with is_global=true |
| zone/loot.cpp:615-694 | ZoneDatabase::LoadGlobalLoot | build global-loot rule lists from DB at zone boot |
| zone/global_loot_manager.cpp:108-185 | GlobalLootEntry::PassesRules | filter evaluation |
| zone/loot.cpp:742-780 | NPC::CheckTrivialMinMaxLevelDrop(killer) | at death, drop items the killer is out of level band for |
| zone/attack.cpp:2780-2823 | NPC::Death (corpse block) | calls the trivial filter when killer (or pet owner) is a non-GM player, then creates the corpse |
| zone/zone_loot.cpp:27-414 | Zone::LoadLootTables / GetLootTable / GetLootTableEntries / GetLootdrop / GetLootdropEntries | cache + content (expansion) filtering |
| zone/sidecar_api/loot_simulator_controller.cpp; zone/gm_commands/lootsim.cpp | simulators | useful for goldens (section 9) |

Call graph (spawn):

```
Spawn2 spawn → NPC ctor → AddLootTable(npc.loottable_id, is_global=false)
                         → [if !skip_global_loot] CheckGlobalLootTables
                              → GlobalLootManager.GetGlobalLootTables(npc) → PassesRules per entry
                              → AddLootTable(table, is_global=true)   (per passing entry)
AddLootTable → (coin roll if !is_global) → for each loottable entry: repeat multiplier×GlobalLootMultiplier times:
                 probability gate → AddLootDropTable → AddLootDrop (per item chosen)
```

Call graph (death): NPC::Death → (killer is player, not GM) → CheckTrivialMinMaxLevelDrop → Corpse created from remaining items and coin.

## 3. Data (DB tables and meaning)

**loottable**: `id`, `name`, `mincash`, `maxcash`, `avgcoin` (all in copper), `done` (unused), expansion/content-flag filters.

**loottable_entries**: `loottable_id`, `lootdrop_id`, `multiplier` (default 1), `droplimit` (default 0), `mindrop` (default 0), `probability` (float percent, default 100).

**lootdrop**: `id`, `name`, expansion/content-flag filters.

**lootdrop_entries**: `lootdrop_id`, `item_id`, `item_charges` (default 1; becomes stack size/charges of the instance), `equip_item` (default 1: NPC may wear it), `chance` (float percent; legacy SQL default 1), `disabled_chance` (ignored by the roll), `trivial_min_level`, `trivial_max_level` (killer-level band, 0 = unbounded), `multiplier` (default 1 in schema; see 5.4), `npc_min_level`, `npc_max_level` (0 = unbounded), expansion/content filters.

**global_loot**: `id`, `description`, `loottable_id`, `enabled`, `min_level`, `max_level`, `rare`, `raid`, `race` / `class` / `bodytype` (pipe-separated integer lists), `zone` (pipe-separated zone ids; empty = every zone), `hot_zone`, content filters.

**npc_types** (fields used): `loottable_id`, `rare_spawn` (the "named" flag), `raid_target`, `skip_global_loot`, `level`.

Runtime record per carried item ("LootItem", common/loot.h:25-46): item_id, equip_slot (or invalid), charges, loot slot, six augment ids, attuned flag, trivial_min_level, trivial_max_level, npc_min_level, npc_max_level, source lootdrop_id. Coin is held as four counters (platinum, gold, silver, copper).

## 4. Constants and rule defaults

| Name | Value | Where |
|---|---|---|
| Rule Zone:GlobalLootMultiplier | 1 (int) | common/ruletypes.h:379. Despite the name it multiplies **every** loottable entry's iteration count, own and global (loot.cpp:116-118) |
| Large-lootdrop auto limit | if a lootdrop has more than 100 entries and droplimit is 0 (with mindrop > 0), droplimit becomes 10 | loot.cpp:173-175 |
| Coin denomination | 1 pp = 1000 cp, 1 gp = 100 cp, 1 sp = 10 cp | loot.cpp:103-114 |
| NPC dual-wield equip chance | 100 (percent, always) | common/features.h:183 |
| Rule NPC:MinorNPCCorpseDecayTime | 450000 ms (NPC level ≤ 54) | ruletypes.h:675; selection at attack.cpp (level > 54 uses major) |
| Rule NPC:MajorNPCCorpseDecayTime | 1500000 ms (NPC level ≥ 55) | ruletypes.h:676 |
| Rule NPC:EmptyNPCCorpseDecayTime | 0 ms | ruletypes.h:678 |
| Rule NPC:CorpseUnlockTimer | 150000 ms (corpse becomes free-for-all) | ruletypes.h:677 |
| Rule Character:CheckCursorEmptyWhenLooting | true | ruletypes.h:133 |

## 5. Behaviour, in order of operations

### 5.1 AddLootTable(loottable_id, is_global)

1. Skip entirely if the NPC has no type id (GM-made spawn) or is being resumed from a saved zone state (its loot is restored instead).
2. If not global, reset the four coin counters to 0.
3. Look up the loottable; if missing or it fails the expansion/content filter, stop.
4. **Coin (only when not global).** Let lo = mincash, hi = maxcash; if lo > hi swap them. Let avg = avgcoin.
   - If hi > 0 and avg > 0 and lo ≤ avg ≤ hi:
     upper_chance = (avg − lo) / (hi − lo) (float).
     Draw u ∈ [0,1). If u < upper_chance: cash = uniform integer in [avg, hi]; else cash = uniform integer in [lo, avg].
     (Edge: if lo = hi = avg the division is 0/0; in practice the integer roll then returns avg either way. Implementers should special-case lo = hi to return lo.)
   - Otherwise cash = uniform integer in [lo, hi] (inclusive both ends).
   - If cash ≠ 0, split greedily: pp = ⌊cash/1000⌋, then gp = ⌊rest/100⌋, sp = ⌊rest/10⌋, cp = rest. Note: coin is **overwritten**, not added; if cash is 0 the counters stay at the reset 0.
5. Let G = Rule Zone:GlobalLootMultiplier. For each loottable entry (DB order), repeat k = 1 … (entry.multiplier × G):
   - p = entry.probability.
   - If 0 ≤ p ≤ 100, draw r ∈ [0,100) uniformly; otherwise r = 0.
   - Roll the lootdrop if p ≠ 0 and (p = 100 or r ≤ p). Consequences: p = 0 never rolls; p = 100 always; p > 100 always (r forced to 0); p < 0 never (r = 0 is not ≤ negative p).
   - "Roll the lootdrop" = AddLootDropTable(entry.lootdrop_id, entry.droplimit, entry.mindrop).

### 5.2 AddLootDropTable(lootdrop_id, drop_limit, min_drop)

Fetch the lootdrop and its entries (entries failing content filters are omitted). If the lootdrop id is unknown or it has no entries, stop.

**Mode A: independent rolls** (drop_limit = 0 and min_drop = 0):
For each entry in order, repeat `entry.multiplier` times: draw r ∈ [0,100); if r ≤ entry.chance **and** the NPC passes the entry's level gate (5.3), add the item (5.4). Every entry is independent; any number of items may drop. Note `multiplier` = 0 in this mode means the entry can never drop.

**Mode B: weighted picks** (otherwise):
1. If entry count > 100 and drop_limit = 0, set drop_limit = 10.
2. If drop_limit < min_drop, set drop_limit = min_drop.
3. Over all entries whose item exists and that pass the level gate ("eligible"):
   - roll_total = Σ chance.
   - bypass = true if any eligible entry has chance ≥ 100.
   - no_loot_prob = Π over eligible entries with chance < 100 of (100 − chance)/100.
   If no entry is eligible, stop.
4. drops = 0. Repeat drop_limit times (iteration i = 0 … drop_limit−1):
   - Attempt this iteration if drops < min_drop, or bypass, or a fresh draw u ∈ [0,1) satisfies u ≥ no_loot_prob. (The draw of u only happens when the first two conditions are false.)
   - If attempting: draw w ∈ [0, roll_total). Walk entries in order, skipping ineligible ones; for each eligible entry: if w < chance, select it; otherwise w ← w − chance and continue. (Weighted pick proportional to chance.)
   - On selection: add the item once (5.4), drops += 1. Then for c = 1 … (max(entry.multiplier,1) − 1): draw r ∈ [0,100); if r ≤ chance add another copy. These extra copies **do not** increment drops.
   - If the walk ends without a selection (only possible via floating-point leftovers), nothing drops this iteration.
5. The same item can be selected in several iterations (sampling with replacement).

Key consequence: in Mode B the per-iteration "something drops" chance is 1 − Π(1 − cᵢ/100), i.e. the probability that at least one of the entries would have dropped independently; which one drops is then chosen by weight cᵢ / Σc. With a single entry this reduces to its own chance.

### 5.3 NPC level gate (MeetsLootDropLevelRequirements)

Entry passes unless (npc_min_level > 0 and NPC level < npc_min_level) or (npc_max_level > 0 and NPC level > npc_max_level). Lets one loot table serve a level-ranged spawn.

### 5.4 AddLootDrop (adding one item)

- Abort if resuming from zone suspend or item data missing.
- Record: item id, charges = entry.item_charges, no augments, not attuned, trivial min/max copied from the entry, equip_slot = none, source lootdrop id.
- Bow item type marks the NPC as bow-equipped; arrow type as arrow-equipped (behavioural flags for ranged AI).
- **Equipping** (only if entry.equip_item > 0 and the item is not flagged "no pet"): scan equipment slots in slot order (charm, ear1, head, face, ear2, neck, shoulders, arms, back, wrist1, wrist2, range, hands, primary, secondary, finger1, finger2, chest, legs, feet, waist, power source, ammo). For each slot the item can go in:
  - Empty slot: take it immediately and stop scanning.
  - Occupied slot: it is an upgrade if new AC > old AC, or AC equal and new HP > old HP. If the item fits only this one slot, replace (the old item stays in loot but is marked unequipped) and stop. If it fits several slots, remember this slot as a candidate and keep scanning for an empty one; candidate is overwritten by later upgrade slots, so the **last** upgradable slot wins if no empty slot is found.
  - After the scan, if nothing taken but a candidate exists, take the candidate.
  - Visual: primary slot sets "weapon equipped" (and two-hander flag for 2H types); secondary only shows if the NPC is a pet, or can dual-wield (always passes the 100% roll), or the item has no damage, and the item is a 1H weapon, shield or light source.
  - If equipped, NPC stats are recalculated (so loot can make a monster stronger).
- Fires a quest event "loot added" (plumbing).
- Item appended to the NPC's loot list.

### 5.5 Global loot (CheckGlobalLootTables, PassesRules, LoadGlobalLoot)

Loading (zone boot): only rows with `enabled = 1` and passing content filters. If `zone` is non-empty and the current zone id is not in its pipe list, skip. Rules are attached **only for non-zero / non-empty columns**: min_level, max_level, rare, raid, each race/class/bodytype value, hot_zone.

Evaluation for an NPC (any failure returns false immediately):
- LevelMin: NPC level < value → fail. LevelMax: NPC level > value → fail.
- Raid: value ≠ 0 requires NPC is a raid target. (Value 0 would mean "must not be raid" but is never attached because 0 rows are skipped.)
- Rare: value ≠ 0 requires NPC is a rare spawn (named). Same 0-skip caveat.
- HotZone: value ≠ 0 requires the zone is currently a hot zone.
- Race / Class / BodyType: within one type the listed values are OR'ed; if any value of a type is present, the NPC must match at least one of them. Types combine with AND.
Each passing entry's loottable is rolled with is_global = true (no coin change; coin from the NPC's own table is preserved). Rolled after the NPC's own table. NPCs with `skip_global_loot` never get global loot.

### 5.6 Trivial-loot filter at death (CheckTrivialMinMaxLevelDrop)

Runs only if a corpse is created and the killer (resolved to the pet owner if a pet killed) is a player who is not a GM. Killer level K. Every carried item with (trivial_min_level > 0 and K < trivial_min_level) or (trivial_max_level > 0 and K > trivial_max_level) is removed (and its worn appearance cleared). Coin is not affected.

This is the donor's only anti-farm loot rule: an over-levelled killer loses items tagged with a trivial max level.

### 5.7 Corpse

Corpse made from the remaining list and coin, unless the NPC is a pet, merc, swarm pet, or a merchant (unless Merchant:AllowCorpse), and only if killed by a player, a player's pet, or a player's swarm pet (or an LDoN treasure case, or a queued-for-corpse NPC). Decay timer: 450 s for NPC level ≤ 54, 1500 s otherwise. Looting restricted to allowed looters for 150 s, then open.

## 6. RNG use

All draws use one per-zone Mersenne Twister (mt19937) seeded from the OS (common/random.h). Primitives:
- Int(a, b): uniform integer in [a, b] inclusive; swaps if a > b.
- Real(a, b): uniform double in [a, b) (half-open).
Draw sequence per AddLootTable: [coin: Real(0,1) then Int(...), or just Int(...)] → per loottable iteration: Real(0,100) (only when 0 ≤ p ≤ 100) → per lootdrop per mode as described. For golden replay the implementer must expose an injectable RNG that can consume an explicit list of draws in this order.

## 7. Edge cases

- Loottable entry with probability 100 skips the draw entirely (draw count differs from p = 99.9).
- `<=` comparisons on half-open draws: chance 0 can drop in Mode A only if the draw is exactly 0.0 (practically never; implement as "≤" to match).
- Mode B with all eligible entries at chance 0: roll_total 0, no_loot_prob 1 → only min_drop forces attempts; draw w ∈ [0,0) returns 0 and "0 < 0" fails, so nothing drops even with min_drop. Edge to replicate.
- Mode B with min_drop > drop_limit: drop_limit is raised to min_drop.
- A drop beyond min_drop still needs the no-loot gate each iteration, so "mindrop 1, droplimit 3" gives 1 guaranteed + up to 2 more.
- Duplicate items allowed; multiplier copies in Mode B are bonus copies outside the limit.
- Global-loot "must NOT be rare / raid / hot" is not expressible (0 rows skipped).
- Coin overwritten each non-global AddLootTable call; calling the own table twice rerolls coin.

## 8. Plumbing to strip

DB repositories and caching (zone_loot.cpp), content/expansion filtering (keep only if Frankendom wants era gating), wear-change and appearance packets, light-source updates, quest event "loot added", logging, saylinks, loot statistics recording, zone-suspend resume, GM `#lootsim` and sidecar HTTP. Keep: the selection algorithm, coin split, NPC level gate, equip-upgrade rule (if NPCs wear loot), global-loot filter, trivial-killer filter.

## 9. Golden cases (derived by hand from the rules above)

G-L1 Coin split: cash 1234 cp → 1 pp, 2 gp, 3 sp, 4 cp. Cash 999 → 0/9/9/9.

G-L2 Coin with avg: lo 10, hi 100, avg 40 → upper_chance = 30/90 = 0.3333. Draw u = 0.20 → Int(40,100). Draw u = 0.50 → Int(10,40). P(cash ≥ 40) ≈ 0.333 + 0.667 × 1/31.

G-L3 Coin without avg: lo 100, hi 10 (swapped) → Int(10,100).

G-L4 Loottable gate: probability 25 with draws r = 24.9 → roll lootdrop; r = 25.0 → roll (≤); r = 25.1 → skip. Probability 100 → no draw consumed. Probability 150 → no draw, always.

G-L5 Loottable multiplier 3, GlobalLootMultiplier 2 → 6 independent gate checks → lootdrop may be rolled up to 6 times.

G-L6 Mode A: lootdrop entries {X chance 30 mult 2, Y chance 100 mult 1}, droplimit 0, mindrop 0. Draws for X: 10.0 (drop), 50.0 (no); for Y: 99.99 (drop). Result: X×1, Y×1. Expected count of X = 0.6.

G-L7 Mode B, droplimit 1, mindrop 0, entries A 50, B 25, C 25 (all eligible, mult 1): roll_total 100, no_loot_prob = 0.5 × 0.75 × 0.75 = 0.28125. Distribution: none 0.28125, A 0.359375, B 0.1796875, C 0.1796875. Draws u = 0.10 (< 0.28125 → nothing) → empty. Draws u = 0.90, w = 60.0 → 60 ≥ 50 → w = 10 → 10 < 25 → B.

G-L8 Mode B, droplimit 1, mindrop 1, same entries: always exactly one item; A 0.5, B 0.25, C 0.25; no u draw consumed.

G-L9 Mode B with a 100-chance entry: entries A 100, B 50, droplimit 2, mindrop 0 → bypass, two weighted picks every time from weights 100:50 → P(A) = 2/3 per pick.

G-L10 Mode B, entry A chance 40 multiplier 3, droplimit 1, mindrop 1: pick A (forced), then 2 bonus draws, each ≤ 40 adds a copy. Draws 10.0, 70.0 → A×2 total; drops counter = 1.

G-L11 NPC level gate: entry npc_min 20, npc_max 30; NPC level 19 or 31 → entry ineligible (excluded from roll_total too); level 20 and 30 eligible.

G-L12 Trivial filter: item trivial_max 30; killer level 40 → removed at death. Killer level 30 → kept. Pet of a level-40 player kills → removed. GM killer → kept.

G-L13 Global loot: entry min 10, max 50, race list {1,2}, class list {} → NPC race 2 level 50 passes; race 3 fails; level 51 fails. Entry rare = 1 → only rare spawns.

G-L14 Equip: NPC wearing chest AC 10 HP 0; loot chest AC 10 HP 5 (chest-only) → replaces. Loot ring that fits finger1 and finger2, both empty → finger1.

### How to capture real goldens on the VPS later (do not build now)

- Harness already in donor: `zone sidecar:serve-http` (zone/cli/cli_sidecar_serve_http.cpp) boots an HTTP API on port 9099 (default) with optional Authorization key; `GET /api/v1/loot-simulate?loottable_id=&npc_id=` spawns the NPC and runs AddLootTable 100 times, returning per-item rolled percentages. The in-game `#lootsim <npc> <loottable> <iterations≤1000>` does the same with global tables.
- For exact (not statistical) goldens: patch a test build so `EQ::Random` is seeded with a fixed seed (or reads a draw script), log every draw, and compare our implementation fed the same draw list.
- Needs: CMake + vcpkg build of `zone` (and `shared_memory` for item data), MariaDB with the PEQ content database (tables loottable, loottable_entries, lootdrop, lootdrop_entries, global_loot, npc_types, items) plus hand-made fixture rows for G-L6 … G-L13. Build should run on the VPS in a scratch directory outside /var/www/frankendom; no world/login server is needed for the sidecar.
