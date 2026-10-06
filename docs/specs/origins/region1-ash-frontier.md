# Region 1: the Ash Frontier (content spec)

- Status: **spec only**. Nothing here ships. No `src/` change, no code, no JSON files yet. Section 6 lists the files a later PR writes.
- Scope: blueprint ruling 2 (Gladiator opens the outer gate: the Exchange, the first region and chapter one, *The Stolen Name*),
  ruling 3 (region 1 and chapter one are free), ruling 4 and the `legends-rule` skill (names), ruling 7 (one progression).
- Built on: `origins/world` (zone params), `origins/contracts` (`RegionDefinition`, `CharacterDefinition`, `EncounterDefinition`,
  `QuestDefinition`, `ItemDefinition`, `LootTable`), `origins/quests` (journal), `origins/talk` (`npc-talk`), `origins/progression`
  (`TYPE_WEIGHTS`, `basePay`). Every record shape below is the parser's shape. Unknown fields are refused, so none are added.
- Supersedes the test fixtures' slice of chapter one (`origins/contracts/fixtures.ts`). Those fixtures stay as they are, as test data.
- **Camera: frozen.** This spec sets no camera, framing or `view` value. Every zone takes the `view` defaults, and `CAMERA` in
  `origins/world/schema.ts` stays read-only.
- **Crafting: out.** No recipes, no craft provenance, and every loot table has `fallback: null`.

## 1. Zones as world params

The Frontier is one world region, `region:ash-frontier`, with five zones. It hangs off the Concord Exchange by its **west gate**.
World `connections` only link zones inside one region (`origins/world/README.md`, "Not done"). The Exchange-to-Frontier crossing is
therefore the contracts' region portal pair (`RegionDefinition.portals`: Exchange `to-frontier` at `west-gate` ↔ Frontier
`to-exchange` at `exchange-gate`), as the fixtures already have it.

**Exchange amendment.** One new landmark and one passage go in the existing `exchange` zone in `origins/world/concord.ts`. This is
data only, a World-lane PR, and no current landmark moves, so `concord.test.ts` pins hold:

```json
"layout":   { "west-gate": { "u": 0, "v": 0.5, "facing": 90 } },
"passages": { "west-road": { "from": "west-gate", "width": 3, "length": 12 } }
```

`facing: 90` faces left, out of the plaza's left edge, so the road leaves the terrace between the contract board (v 0.22) and the forge (v 0.71).

**Frontier world data** (`WorldData`, `schemaVersion: 1`). The region layer sets the shared rules. Each zone writes only what differs:

```json
{
  "schemaVersion": 1,
  "regions": {
    "region:ash-frontier": {
      "params": {
        "difficulty": { "levelMin": 11, "levelMax": 15, "lootTier": 3 },
        "economy": { "vendorTier": 3 },
        "rules": { "safe": false, "pvp": false, "tradeAllowed": false, "restAllowed": true },
        "density": { "npcs": 0.05, "props": 0.4, "creatures": 0.25 },
        "spawns": { "respawnSeconds": 300 },
        "ambience": { "preset": "ash-pit", "weather": "dust", "sound": "wind" },
        "terrain": { "biome": "ash-waste", "ground": "ash" }
      },
      "zones": {
        "east-road": {
          "zoneSize": { "width": 40, "depth": 160 },
          "layout": {
            "exchange-gate": { "u": 0.5, "v": 0, "facing": 180 },
            "milestone": { "u": 0.5, "v": 0.35, "facing": 0 },
            "watchtower": { "u": 0.82, "v": 0.55, "facing": -90 },
            "fields-turn": { "u": 0, "v": 0.7, "facing": 90 },
            "crossroads": { "u": 0.5, "v": 1, "facing": 0 }
          },
          "connections": {
            "ferry": { "to": "ferry-landing", "kind": "road", "here": "crossroads", "there": "road-end" },
            "fields": { "to": "cinder-fields", "kind": "road", "here": "fields-turn", "there": "road-gate" }
          },
          "difficulty": { "levelMin": 11, "levelMax": 12 }
        },
        "ferry-landing": {
          "zoneSize": { "width": 60, "depth": 60 },
          "layout": {
            "road-end": { "u": 0.5, "v": 0, "facing": 180 },
            "ferry-house": { "u": 0.2, "v": 0.5, "facing": 90 },
            "boathouse": { "u": 0.8, "v": 0.7, "facing": -90 },
            "mere-shore": { "u": 1, "v": 0.4, "facing": -90 },
            "dock": { "u": 0.5, "v": 0.9, "facing": 0 }
          },
          "connections": {
            "road": { "to": "east-road", "kind": "road", "here": "road-end", "there": "crossroads" },
            "mere": { "to": "black-mere", "kind": "road", "here": "mere-shore", "there": "landing-shore" },
            "night-boat": { "to": "blood-ruin", "kind": "portal", "here": "dock", "there": "ruin-jetty" }
          },
          "rules": { "safe": true },
          "density": { "npcs": 0.4, "creatures": 0 }
        },
        "cinder-fields": {
          "zoneSize": { "width": 120, "depth": 120 },
          "layout": {
            "road-gate": { "u": 1, "v": 0.5, "facing": -90 },
            "ash-pits": { "u": 0.5, "v": 0.5, "facing": 0 },
            "shrine": { "u": 0.2, "v": 0.8, "facing": 0 }
          },
          "connections": { "road": { "to": "east-road", "kind": "road", "here": "road-gate", "there": "fields-turn" } },
          "density": { "creatures": 0.35 },
          "spawns": { "respawnSeconds": 240 },
          "difficulty": { "levelMin": 11, "levelMax": 13 }
        },
        "black-mere": {
          "zoneSize": { "width": 100, "depth": 140 },
          "layout": {
            "landing-shore": { "u": 0, "v": 0.3, "facing": 90 },
            "reed-bank": { "u": 0.35, "v": 0.4, "facing": 0 },
            "mere-hollow": { "u": 0.5, "v": 0.65, "facing": 0 },
            "causeway": { "u": 0.5, "v": 1, "facing": 0 }
          },
          "connections": {
            "landing": { "to": "ferry-landing", "kind": "road", "here": "landing-shore", "there": "mere-shore" },
            "causeway": { "to": "blood-ruin", "kind": "road", "here": "causeway", "there": "causeway-end" }
          },
          "spawns": { "boss": "mere-hollow" },
          "density": { "creatures": 0.2 },
          "difficulty": { "levelMin": 12, "levelMax": 15 }
        },
        "blood-ruin": {
          "zoneSize": { "width": 60, "depth": 80 },
          "layout": {
            "causeway-end": { "u": 0.5, "v": 0, "facing": 180 },
            "ruin-jetty": { "u": 0, "v": 0.2, "facing": 90 },
            "ruin-gate": { "u": 0.5, "v": 0.45, "facing": 0 },
            "crypt": { "u": 0.5, "v": 0.85, "facing": 0 }
          },
          "connections": {
            "causeway": { "to": "black-mere", "kind": "road", "here": "causeway-end", "there": "causeway" },
            "night-boat": { "to": "ferry-landing", "kind": "portal", "here": "ruin-jetty", "there": "dock" }
          },
          "spawns": { "boss": "crypt" },
          "density": { "creatures": 0.15 },
          "difficulty": { "levelMin": 13, "levelMax": 14 }
        }
      }
    }
  }
}
```

Every connection is two-way and answered between the same landmark pair, as `resolveRegion` checks. Landmark names are unique across
the region, so they double as the contracts' waypoint ids (`LOCAL_KEY`). Zone summary:

| Zone | Size (u) | Band | Holds |
|---|---|---|---|
| `east-road` | 40 × 160 | 11–12 | the road out of the Exchange; the Charnel Road watchtower (siege, Vell) |
| `ferry-landing` | 60 × 60 | safe | the Grey Ferry: Hesk, the dock, the night boat to the ruin |
| `cinder-fields` | 120 × 120 | 11–13 | creature ground: scavengers, the displaced shrine (Old Cinder) |
| `black-mere` | 100 × 140 | 12–15 | the mere and its brood; the matriarch's hollow; the causeway |
| `blood-ruin` | 60 × 80 | 13–14 | the Blood Court ruin: the Vigil (party), Varney, the crypt |

**Contracts region** (`region-definition`, fixture shape): `id: region:ash-frontier`, `gate: outer`, `waypoints` = the 21
landmark names above, `portals: [{ id: to-exchange, at: exchange-gate, to: region:concord-exchange, toPortal: to-frontier }]`, and
`assetManifest: regions/ash-frontier/manifest.json`. Spawns:

| spawn id | at | encounter | characters |
|---|---|---|---|
| `siege` | watchtower | `encounter:watchtower-siege` | — |
| `vell` | watchtower | null | `character:courier-vell` |
| `hesk` | dock | null | `character:ferrymaster-hesk` |
| `scavengers` | ash-pits | null | `character:cinder-scavenger` |
| `old-cinder` | shrine | null | `character:old-cinder` |
| `brood` | reed-bank | null | `character:mere-brood` |
| `matriarch` | mere-hollow | `encounter:mere-matriarch` | — |
| `vigil` | ruin-gate | `encounter:ruin-vigil` | — |

Triggers are `ruin-door` (at ruin-gate, `quest:stolen-name` → `ruin`) and `crypt-page` (at crypt → `recovered`). A trigger only
asks the journal to advance, so it moves nothing unless that stage's conditions hold. The `concord-exchange` region adds the
`contract-board` waypoint and a `marrow` spawn there.

## 2. NPCs and talk

All four speaking NPCs are original except Varney. Names follow ruling 4; sources are in section 8.

| id | name | where | faction | role | essential |
|---|---|---|---|---|---|
| `character:recorder-marrow` | Marrow the Recorder | Exchange, contract board | `faction:concord` | giver | yes |
| `character:courier-vell` | Vell the Courier | Charnel Road watchtower | `faction:ferry-court` | witness | yes |
| `character:ferrymaster-hesk` | Hesk the Ferrymaster | Grey Ferry dock | `faction:ferry-court` | ally | yes |
| `character:legend.nightborn-3` | Varney | Blood Court ruin | `faction:blood-court` | boss | no |

`routine: []` for all four: each one stands where the spawn puts them. Routines across the 24-hour day can come later.

Talk records follow `loadTalk` (`kind: npc-talk`, `schemaVersion: 1`, `npc`, `lines[]`). `"Q"` is shorthand for `quest:stolen-name` (write the full id in the file), and every
quest effect has `choice: null`. **No line or transition reads a `flag`.** The server does not yet write `QuestState.flags`
(`origins/quests/README.md`, "Not done"), so story gates use only `quest-at`, `has-item` and `encounter-cleared`.

**Marrow the Recorder**

```json
{ "kind": "npc-talk", "schemaVersion": 1, "npc": "character:recorder-marrow", "lines": [
  { "id": "greet", "priority": 0, "once": false, "text": "Recorder.", "reply": "The Roll beneath the Pit keeps every name that has bled there. State your business.", "when": [], "effects": [] },
  { "id": "offer", "priority": 10, "once": true, "text": "My name is gone from the Roll.", "reply": "Then the Roll says you never fought. Pages do go missing. Find out who carried yours.",
    "when": [{ "kind": "quest-at", "quest": "Q", "stage": null }, { "kind": "tier-at-least", "tier": "Gladiator" }], "effects": [{ "kind": "quest", "quest": "Q", "stage": "erased", "choice": null }] },
  { "id": "who-carried", "priority": 10, "once": true, "text": "Who carried the page out?", "reply": "The ledger names a Ferry Court courier, Vell. He never came back to the Grey Ferry.",
    "when": [{ "kind": "quest-at", "quest": "Q", "stage": "erased" }], "effects": [{ "kind": "quest", "quest": "Q", "stage": "courier", "choice": null }] },
  { "id": "press", "priority": 10, "once": true, "text": "Vell says he took the page to the Blood Court, under your seal.", "reply": "The page burned in the archive fire. That is the Concord's account, and it is written down. Take a courier's word across the Mere if you like.",
    "when": [{ "kind": "quest-at", "quest": "Q", "stage": "testimony" }], "effects": [{ "kind": "quest", "quest": "Q", "stage": "account", "choice": null }] },
  { "id": "return", "priority": 10, "once": true, "text": "I am putting my name back on the Roll.", "reply": "Give it here. There. The Roll has you again, and nobody will ask how.",
    "when": [{ "kind": "quest-at", "quest": "Q", "stage": "recovered" }, { "kind": "has-item", "item": "item:stolen-name-record" }], "effects": [{ "kind": "quest", "quest": "Q", "stage": "returned", "choice": null }] },
  { "id": "expose", "priority": 11, "once": true, "text": "This page was struck out under your seal.", "reply": "Then read it to the whole Exchange. The Concord will answer for it, and so will I.",
    "when": [{ "kind": "quest-at", "quest": "Q", "stage": "recovered" }, { "kind": "has-item", "item": "item:stolen-name-record" }], "effects": [{ "kind": "quest", "quest": "Q", "stage": "exposed", "choice": null }] },
  { "id": "after-exposed", "priority": 30, "once": false, "text": "Recorder?", "reply": "You have had what you wanted from me.", "when": [{ "kind": "quest-at", "quest": "Q", "stage": "exposed" }], "effects": [{ "kind": "end" }] },
  { "id": "farewell", "priority": 99, "once": false, "text": "Farewell.", "reply": "Ink dries. Names fade. Go.", "when": [], "effects": [{ "kind": "end" }] }
] }
```

**Vell the Courier** (same shape; written below as `id (priority, once): text → reply [when] {effects}`)

- `besieged` (0, no): "Vell?" → "Keep your head down. The Court's thralls have had this tower ringed for three days." [quest-at courier]
- `testimony` (10, yes): "The thralls are dead. What happened to my page?" → "I carried it to the Blood Court's ruin under Concord seal, as ordered. Here, take my token: the night boat will carry anyone who shows it." [quest-at courier, encounter-cleared `encounter:watchtower-siege`] {quest → `testimony`}
- `who-ordered` (20, no): "Who sent you?" → "The Recorder signed my orders. Ask her why." [quest-at testimony]
- `token-help` (20, no): "How do I cross?" → "Show Hesk the token after dark. Or kill what lives in the Mere." [quest-at crossing]
- `farewell` (99, no): "Farewell." → "Mind the road." {end}

**Hesk the Ferrymaster**

- `greet` (0, no): "Ferrymaster." → "The Grey Ferry runs when the Mere lets it. Lately it does not."
- `missing` (10, no): "Where is Vell?" → "Up the Charnel Road at the old watchtower, if the thralls left anything of him." [quest-at courier]
- `cross` (10, yes): "I need to cross to the ruin." → "Nobody crosses while the mother hunts the Mere. Kill her, or come back after dark with a Court token." [quest-at account] {quest → `crossing`}
- `fight-cross` (10, yes): "The Mere is quiet now." → "Then we row in daylight. Get in." [quest-at crossing, encounter-cleared `encounter:mere-matriarch`] {quest → `ruin`}
- `night-cross` (11, yes): "Vell's token. The night boat." → "No lamps and no talking. In." [quest-at crossing, has-item `item:ferry-token`] {quest → `ruin`}
- `bargain` (10, yes): "The Ferry Court can have this page, for a price." → "A struck-out name under a Concord seal. The Court will hold that over the Exchange for years. You will never want for passage." [quest-at recovered, has-item `item:stolen-name-record`] {quest → `bargained`}
- `farewell` (99, no): "Farewell." → "Keep your feet dry." {end}

**Varney**

- `greet` (0, no): "Varney." → "A guest who came past my vigil, or around it. Either way, sit. The Court is always hungry for news." [quest-at ruin]
- `parley` (10, yes): "I killed the mother of the Mere." → "Then the water is yours and my boats are worth nothing. Take your page. A host knows when a bargain is cheaper than a war." [quest-at ruin, has-item `item:mere-mother-tooth`] {quest → `recovered`}
- `farewell` (99, no): "I am leaving." → "Everyone does, eventually." {end}

The Recorder's `press` line sets up the twist: the page did not burn, and the forgery was done under the Concord's own seal. Both
`return` and `expose` sit with Marrow, so the player chooses in front of the official who signed the orders.

## 3. Chapter one: *The Stolen Name*

One quest, `quest:stolen-name`, `scope: personal`, `gate: outer`, `storyVersion: 1`, `migrations: []`. Every path runs **seven
progress stages and one finish**. There are two branch points, one at the crossing and one at the ruin, and three endings.

| # | Stage | Kind | Reached by | Conditions out | Rewards (once ever, `grantStageRewards`) |
|---|---|---|---|---|---|
| 1 | `erased` | progress | Marrow `offer` (start) | → `courier`: none | — |
| 2 | `courier` | progress | Marrow `who-carried` | → `testimony`: encounter-cleared `watchtower-siege` | — |
| 3 | `testimony` | progress | Vell `testimony` | → `account`: none | loot `loottable:vell-token` (ferry token); ferry-court +50 |
| 4 | `account` | progress | Marrow `press` | → `crossing`: none | — |
| 5 | `crossing` | progress | Hesk `cross` | → `ruin`: encounter-cleared `mere-matriarch` (**fight**) *or* has-item `ferry-token` (**infiltrate**) | — |
| 6 | `ruin` | progress | Hesk `fight-cross` / `night-cross`, or trigger `ruin-door` | → `recovered`: encounter-cleared `ruin-vigil` (**fight**) *or* has-item `mere-mother-tooth` (**negotiate**) | blood-court −50 |
| 7 | `recovered` | progress | Varney `parley`, or trigger `crypt-page` | → `returned` / `bargained` / `exposed`: has-item `stolen-name-record` | loot `loottable:stolen-name-record` (the page) |
| 8a | `returned` | finish | Marrow `return` | — | concord +50, ferry-court +25 |
| 8b | `bargained` | finish | Hesk `bargain` | — | ferry-court +100, concord −50 |
| 8c | `exposed` | finish | Marrow `expose` | — | concord −25, blood-court −100, ferry-court +25 |

Journal text (each ≤ 600 characters):

1. "My name is gone from the Roll kept beneath the Pit. As far as the Roll knows, I never fought."
2. "The archive ledger names Vell, a Ferry Court courier, as the last hand on my page. He never came back to the Grey Ferry."
3. "I broke the siege at the Charnel Road watchtower. Vell swears he carried my page to the Blood Court's ruin under Concord seal."
4. "The Recorder says the page burned in the archive fire. Vell's orders, under her seal, say otherwise. The answer is across the Black Mere."
5. "The Ferry Court will not cross the Black Mere while the mother of the mere hunts it."
6. "The Blood Court's ruin. Varney keeps its ledger, and my page is in it."
7. "The page is mine. My name is on it, and beside it a second hand that struck it out."
8. returned: "My name is back on the Roll." · bargained: "The Ferry Court holds the page now, and owes me for it." · exposed: "The whole Exchange heard whose seal struck my name out."

The transition shape (stage 5 shown) is the contracts' own:

```json
{ "id": "crossing", "kind": "progress", "journal": "The Ferry Court will not cross the Black Mere while the mother of the mere hunts it.",
  "rewards": { "loot": null, "standing": [] },
  "transitions": [
    { "to": "ruin", "when": [{ "kind": "encounter-cleared", "encounter": "encounter:mere-matriarch" }], "label": "Cross the quiet mere" },
    { "to": "ruin", "when": [{ "kind": "has-item", "item": "item:ferry-token" }], "label": "Take the night boat" } ] }
```

**Graph checks.** Every stage is reachable from `erased`, and every progress stage has a way to an ending. No path needs anything
that can be lost for good. The fight route stays open even if the ferry token is traded away: it binds on equip and trades only
under the cooldown in section 5. The page is story-critical and binds on acquire (`checkInstance`), so the endings can always be
reached once stage 7 has paid. No `choice` conditions are used: the talk line names the stage, and the three endings sit on
different lines.

**Patronage.** The endings move standing and nothing else. Follow-up quests open on `stage-reached` against the ending (for example
`quest:stolen-name` / `bargained`), which is the prior-stage condition `origins/quests/fixtures.ts` `smithsFavour` already uses.
Chapter two's quests are out of scope here.

**CP** (`origins/progression/model.ts`, the #1428 model). The journal emits one story event per stage reached for the first time,
with `id = quest:stolen-name:<stage>` as the dedupe key. Progress stages pay the `TYPE_WEIGHTS['story-step']` row (weight 100,
`once`, `atOwn`, `solo`). The finish pays `TYPE_WEIGHTS['story-chapter']` (weight 500, same flags). A fail stage pays nothing,
and this quest has none. `basePay` for an `atOwn` row is `floor(killValue(you) × weight / 1000)`, so "100 a step, 500 a chapter"
is permille of your own kill value, not flat CP:

| Your level | `killValue` | Step | Chapter | Whole chapter (7 steps + finish) |
|---|---|---|---|---|
| 11 (Gladiator I) | 2,000 | 200 | 1,000 | 2,400 (`requirement(11)` = 2,025) |
| 13 | 2,200 | 220 | 1,100 | 2,640 |
| 15 | 2,400 | 240 | 1,200 | 2,880 |

Story is once ever: `state.story` is never cleared, not even at the cap (`allBossesOpen` clears bosses only). No new constant is
introduced.

## 4. Bosses and creatures

Each figure fights through its `encounterForms`, as a roster opponent at a level. The kill is priced by the `TYPE_WEIGHTS` row the
server names in the `Kill` event (`target` = the character id, `targetLevel` = the form's level):

| Character | Name | Body (roster) | Lvl | Row | Where | Loot |
|---|---|---|---|---|---|---|
| `character:mere-mother` | **Grendel's Mother** (matriarch) | `witch` | 15 | `world-boss` | mere-hollow, public | `loottable:mere-mother` |
| `character:legend.nightborn-3` | Varney | `nightborn` | 13 | `world-boss` | crypt, party | `loottable:ruin-boss` |
| `character:tithe-sergeant` | The Tithe Sergeant | `veteran` | 12 | `named` | watchtower, solo | `loottable:tithe-sergeant` |
| `character:old-cinder` | Old Cinder | `dwarf` | 13 | `named` | shrine, roams | `loottable:old-cinder` |
| `character:court-thrall` | Court thrall | `pitborn` | 13 | `elite` | siege, vigil | `loottable:court-thrall` |
| `character:cinder-scavenger` | Cinder scavenger | `goblin` | 11 | `mob` | ash-pits, siege | `loottable:cinder-scavenger` |
| `character:mere-brood` | Mere brood | `goblin` | 12 | `mob` | reed-bank, matriarch stage | `loottable:mere-brood` |
| `character:ruin-ghoul` | Ruin ghoul | `goblin` | 11 | `mob` | vigil | `loottable:ruin-ghoul` |

No held roster body is used (minotaur, wraith, werewolf and skeleton stay held).

**Encounters** (`encounter-definition`):

| id | scope | stages (killsToAdvance / population / roster) | boss | decay | restartSeconds | minContributionPercent |
|---|---|---|---|---|---|---|
| `encounter:watchtower-siege` | solo | `ring`: 5 / 2 / scavenger 3, thrall 1 | tithe-sergeant | null | 0 | 10 |
| `encounter:mere-matriarch` | public | `brood`: 12 / 6 / mere-brood 1 | mere-mother | 900 s, keep 50% | 3600 | 10 |
| `encounter:ruin-vigil` | party | `outer-court`: 6 / 3 / ghoul 1; `crypt`: 4 / 2 / thrall 1 | Varney | null | 0 | 10 |

**Boss rules (first win only).** A `world-boss` row is `once: true`, `party: 'each'`. The first kill of `world-boss:<character id>`
pays and adds that key to `beaten`. Every later kill returns `already-beaten` and 0 CP. Each eligible member gets their own award,
but only with `contributionPermille ≥ MIN_CONTRIBUTION_PERMILLE` (100) and within `partyEligible`. A grey kill, or a share under
10%, does not use the boss up. Reaching the cap clears every beaten flag (`allBossesOpen`).

**Lockout.** The model has **no per-character lockout** (progression-proposal §3: "The 7-day lockout is gone"; decision 2).
`restartSeconds` is the world respawn, shared by everyone: 1 h for the public matriarch, so new Gladiators always find her, and 0
for the two instanced encounters. The parser would allow up to 604,800 s (7 days), but that would starve new players of a once-only
boss. See open question 1.

**CP per kill.** `basePay = floor(killValue(min(target, you)) × falloff(target − you) × weight / 1e6)`, solo:

| Target | You 11 | You 13 | You 15 |
|---|---|---|---|
| Grendel's Mother, L15, world-boss 500 | 1,250 (d +4, ×1.25) | 1,210 (d +2, ×1.10) | 1,200 |
| Varney, L13, world-boss 500 | 1,100 (d +2) | 1,100 | 990 (d −2, ×0.90) |
| Named, L12 / L13, 200 | 440 / 440 | 378 / 440 | 210 / 396 |
| Court thrall, L13, elite 80 | 176 | 176 | 158 |
| Mob, L11 / L12, 20 | 40 / 44 | 36 / 37 | 20 / 21 |

Named, elite and mob rows are `rested: true`. They draw on the allowance (`RESTED_PER_DAY_CP` 1,500, `RESTED_CAP_CP` 3,000) and on
repeat heat per kind (`FREE_REPEATS` 3, `HEAT_UNIT_S` 360). In a party, a `split` row pays `partySharePermille(n)`, coloured by the
highest member. Everything here is grey at `d ≤ −RANK_STEPS − 1`, so an L11 scavenger pays nothing from L17. With the allowance
empty, a kill still drops loot and counts for quests.

## 5. Loot

Every instance minted here carries one of two provenance kinds (`items.ts` `PROVENANCE_KINDS`):

- **`loot`**: `{ kind, mintKey: 'loot:<encounter or kill id>:<n>', at, wonBy, table, encounter }`, for every creature and boss drop.
  `encounter` is null for an open-world kill.
- **`quest-reward`**: `{ kind, mintKey: 'quest:stolen-name:<stage>:<pc local>', at, wonBy, quest, stage }`, for stage loot
  (stages 3 and 7). The mint key makes a retried grant collide instead of minting twice.

**Tier.** Gear has `power: 'slot-weight'` and records the tier it was won at. The proposal: the zone's `difficulty.lootTier` (3)
read as a title, **Gladiator**. So `equipItem` needs Gladiator, and the fixed spine holds (Attack/RES caps 1.15/0.80, resolved
before the fight). Rarity is a label, never a stat.

**Items** (`item-definition`; gear is `category: gear`, `binding: none`, `stack: 1`, `story: none`):

| id | name | slot | rarity | material | from |
|---|---|---|---|---|---|
| `item:frontier.ash-helm` | Ash-caked helm | Helmet | common | iron | scavenger, sergeant, Old Cinder, Varney |
| `item:frontier.watch-greaves` | Watchtower greaves | Greaves | common | iron | scavenger, thrall, sergeant, Old Cinder |
| `item:frontier.thrall-gloves` | Thrall's iron gloves | Gloves | fine | iron | thrall, sergeant, Varney |
| `item:frontier.ferryman-boots` | Ferryman's boots | Boots | fine | leather | thrall, matriarch |
| `item:frontier.mere-arms` | Drowned vambraces | Arms | fine | bronze | matriarch |
| `item:frontier.mere-shield` | The Mere-Mother's shield | Shield | relic | bone | matriarch (the recognisable boss piece) |
| `item:frontier.court-mail` | Blood Court mail | Body | rare | steel | Varney (the recognisable boss piece) |
| `item:grave-iron` | Grave iron | — | fine | iron | material, `stack: 50` (blacksmith cost lines only) |
| `item:ferry-token` | Ferryman's token | Crest | rare | bronze | cosmetic, `notable`, `on-equip`, quest reward |
| `item:mere-mother-tooth` | The Mere-Mother's tooth | — | rare | bone | `quest`, `notable`, `on-acquire`, matriarch drop |
| `item:stolen-name-record` | The Roll page | — | relic | bone | `quest`, `story-critical`, `on-acquire`, quest reward |

No weapons drop here: a weapon slot changes the moveset, not just Attack/RES (open question 8).

**Tables** (`loot-table`, `distribution: personal`, `fallback: null`). Chances are integers 1–100. Gear entries carry
`levelMin: 11, levelMax: null`.

| id | presentation | rolls | currency |
|---|---|---|---|
| `loottable:cinder-scavenger` | collect | indep. p50: grave-iron 40 ×2 · indep. p100: ash-helm 2, watch-greaves 2 | 3–12 |
| `loottable:ruin-ghoul` | collect | indep. p60: grave-iron 30 ×3 | null |
| `loottable:mere-brood` | collect | indep. p40: grave-iron 30 ×1 | null |
| `loottable:court-thrall` | take-one | weighted p25, limit 1, min 1: thrall-gloves 50, ferryman-boots 30, watch-greaves 20 · indep. p100: grave-iron 60 ×3 | 10–30 |
| `loottable:tithe-sergeant` | take-one | weighted p100, limit 1, min 1: watch-greaves 40, ash-helm 40, thrall-gloves 20 | 40–80 |
| `loottable:old-cinder` | take-one | weighted p100, limit 1, min 1: ash-helm 50, watch-greaves 50 | 30–60 |
| `loottable:mere-mother` | collect | indep. p100: mere-mother-tooth 100 · weighted p100, limit 1, min 1: mere-shield 25, mere-arms 45, ferryman-boots 30 | 100–250 |
| `loottable:ruin-boss` | take-one | weighted p100, limit 2, min 1: court-mail 40, thrall-gloves 30, ash-helm 30 | 50–200 |
| `loottable:vell-token` | collect | indep. p100: ferry-token 100 | null |
| `loottable:stolen-name-record` | collect | indep. p100: stolen-name-record 100 | null |

The matriarch's table is `collect`, so the tooth (the negotiate key) can never be passed over the way a take-one offer can. One of
each per account (`checkOneOfEach`) already stops a second copy of any single-copy piece. Boss loot rolls on every kill and boss CP
pays once (open question 4).

**Trading.** Frontier gear is `binding: none`, so it trades, but only at the Exchange (`Trade.region` = `region:concord-exchange`;
the Frontier sets `rules.tradeAllowed: false`). There is **no hard limit**. Each piece has a cooldown: `FIRST_TRADE_DELAY_S`
(72 h from mint), then `COOLDOWN_STEPS_S` (7 / 14 / 30 days per change of hands, capped at 30), from `tradeCooldown` on
`expansion/trade-cooldown` (857e73c6, not yet on trunk). Never tradeable: the page and the tooth (bound), grave iron (stackable),
and the token once it is equipped.

## 6. Content-bundle files

`ORIGINS_CONTENT` (on `expansion/o3-writer-story`, `origins/server/content.ts`) names **one JSON file holding one array**.
Definitions go through `loadContent`, and `npc-talk` records go through `loadTalk`, with every talk quest step checked against the
quests. Proposed source layout: one array per kind, concatenated in this order into the single bundle file. Order does not matter
to the loader, since cross-references resolve after every record has parsed, but a fixed order keeps diffs readable:

| File (`origins/content/ash-frontier/`) | `kind` | Records |
|---|---|---|
| `factions.json` | `faction-definition` | 2: `faction:ferry-court`, `faction:blood-court` (fixture shapes); `faction:concord` comes from the Exchange bundle |
| `items.json` | `item-definition` | 11 (section 5) |
| `loot-tables.json` | `loot-table` | 10 (section 5) |
| `characters.json` | `character-definition` | 11 (sections 2 and 4) |
| `regions.json` | `region-definition` | 1: `region:ash-frontier`, plus an amendment to the Exchange's `region:concord-exchange` (waypoint `contract-board`, spawn `marrow`) |
| `encounters.json` | `encounter-definition` | 3 (section 4) |
| `quests.json` | `quest-definition` | 1: `quest:stolen-name` (section 3) |
| `talk.json` | `npc-talk` | 4 (section 2) |
| `world.json` | **not in the bundle** | the `WorldData` of section 1, read by `origins/world` `loadWorld`; `loadContent` refuses unknown kinds |

A duplicate id anywhere in the combined bundle is refused, so the Exchange content and this region must not both define a record.
Two example records show the shapes:

```json
{ "kind": "character-definition", "schemaVersion": 1, "id": "character:mere-mother", "name": "Grendel's Mother",
  "lore": { "source": "Beowulf (Old English poem, Cotton Vitellius A.xv)",
            "summary": "In the old poem she came up out of a haunted mere to avenge her son and was cut down in her own hall beneath the water. The Fracture set her mere on the Ash Frontier, and she drowns every boat the Ferry Court puts on it." },
  "faction": null, "essential": false, "relationships": [],
  "questRoles": [{ "quest": "quest:stolen-name", "role": "boss" }],
  "presentations": [{ "id": "default", "asset": "characters/mere-mother.glb" }],
  "encounterForms": [{ "id": "boss", "opponent": "witch", "level": 15, "encounter": "encounter:mere-matriarch" }],
  "routine": [] }
```

```json
{ "kind": "loot-table", "schemaVersion": 1, "id": "loottable:mere-mother", "presentation": "collect", "distribution": "personal",
  "rolls": [
    { "probability": 100, "repeat": 1, "mode": "independent", "dropLimit": 0, "minDrop": 0,
      "entries": [{ "item": "item:mere-mother-tooth", "chance": 100, "quantity": 1, "levelMin": null, "levelMax": null }] },
    { "probability": 100, "repeat": 1, "mode": "weighted", "dropLimit": 1, "minDrop": 1,
      "entries": [
        { "item": "item:frontier.mere-shield", "chance": 25, "quantity": 1, "levelMin": 11, "levelMax": null },
        { "item": "item:frontier.mere-arms", "chance": 45, "quantity": 1, "levelMin": 11, "levelMax": null },
        { "item": "item:frontier.ferryman-boots", "chance": 30, "quantity": 1, "levelMin": 11, "levelMax": null } ] } ],
  "currency": { "min": 100, "max": 250 }, "fallback": null }
```

**Acceptance for the data PR:** `loadStoryContent(bundle)` returns ok. `resolveRegion(world, 'region:ash-frontier', …)` resolves
every zone with no issues. A journal test walks every route pair (fight or infiltrate, then fight or negotiate, plus the token traded away)
to each ending. Each route pays 7 story steps and 1 chapter, and nothing pays twice on replay.

## 7. Open questions for Strategy and Dom

1. **Boss lockout.** This brief says 7 days. The #1428 model and proposal say no lockout: first win only, every boss reopened at the
   cap. The spec follows the model and uses `restartSeconds` only as the world respawn (1 h public, 0 instanced). Confirm, or say
   whether a 7-day per-character lockout comes back. That would be a model change, not content.
2. **Region id split.** World data calls the hub `region:concord` (zones `pit-yard`, `exchange`). The contracts and `Trade` call it
   `region:concord-exchange`. Which id wins? The Frontier links to the contracts' id.
3. **World params outside `ORIGINS_CONTENT`.** Ship `world.json` as a second file read by `loadWorld`, or add a `world-data` content
   kind to the bundle?
4. **Boss loot on repeat kills.** The spec: CP on the first win, loot on every kill (one of each still applies). Or should loot be
   first-win-only too?
5. **Stage rewards blocked.** The writer refuses any stage whose rewards carry loot or standing (501, `expansion/o3-writer-story`).
   Stages 3, 6, 7 and all three endings carry one or the other, so chapter one cannot complete on the server until those writes exist.
6. **World-loot tier.** The spec uses the zone's `lootTier` read as a title (Gladiator). The alternative is the killer's own title.
7. **Bodies.** The matriarch on the `witch` body (she keeps "she", per the pronoun rule). Mobs reuse the goblin, pitborn, veteran and
   dwarf bodies. Does Art want new bodies before region 1 ships?
8. **No weapon drops** in region 1 (a weapon changes the moveset). Confirm.
9. **Two contribution measures.** `EncounterDefinition.rewards.minContributionPercent` (share of the top contributor) and
   `MIN_CONTRIBUTION_PERMILLE` (10% of the boss) both say "10". Which one does the server enforce for CP, and which for loot?
10. **Travel gating.** The night boat and the causeway are open geography. The story is gated in the journal only, and the world
    schema has no quest-gate field. Is that enough, or should the night boat refuse players without the token?
11. **New ids.** `terrain.ground: "ash"` needs an art preset. Keep it, or use the default `sand` until one exists?

## 8. Names and sources (legends rule)

| Name | Source | Allowed because | Pronoun |
|---|---|---|---|
| Grendel's Mother | *Beowulf*, Old English poem, anonymous, c. 8th–11th century, sole manuscript British Library Cotton Vitellius A.xv (the mere episode) | medieval literature, author dead far beyond 70 years. She is known from the poem, not from scripture, and no living people holds her as a folk hero. The backstory is original prose and cites the poem, not any film. Her son Grendel is already the pitborn rung-5 legend; no relationship row is written, so the bundle needs no Grendel record | she |
| Varney | *Varney the Vampire; or, The Feast of Blood*, penny serial 1845–47, attributed to James Malcolm Rymer and Thomas Peckett Prest | pre-1929 literature, both authors dead 70+ years. Already `src/legends.ts` nightborn rung 3 and the contracts fixture (`Varney the Vampire, 1847`) | he |
| Marrow, Vell, Hesk, the Tithe Sergeant, Old Cinder, all mobs | original (`lore.source: "original"`) | — | Marrow she, Vell he, Hesk he |

Considered and dropped: **Black Shuck** (East Anglian folklore). The best-known early account, Abraham Fleming's 1577 pamphlet,
presents the dog as the Devil, which comes too close to the ruling 4 barred list. One creature is never worth the risk. No name here
hits `BARRED_NAMES`.
