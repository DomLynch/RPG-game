# Region 1: the Ash Frontier (content spec)

- Status: **spec only**. Nothing here ships. No `src/` change, no code, no JSON files yet. Section 6 lists the files a later PR writes.
- Scope: blueprint ruling 2 (Gladiator opens the outer gate, the Exchange, the first region and chapter one, *The Stolen Name*),
  ruling 3 (region 1 and chapter one are free), ruling 4 and the `legends-rule` skill (names), ruling 7 (one progression).
- Built on `origins/world` (zone params) and `origins/contracts` (`RegionDefinition`, `CharacterDefinition`, `EncounterDefinition`,
  `QuestDefinition`, `ItemDefinition`, `LootTable`). Also `origins/quests` (journal), `origins/talk` (`npc-talk`) and
  `origins/progression` (`TYPE_WEIGHTS`, `basePay`). Every record shape below is the parser's shape. Unknown fields are refused, so
  anything new a twist needs is named in section 7 as a contract question, never added here.
- Supersedes the test fixtures' slice of chapter one (`origins/contracts/fixtures.ts`). Those fixtures stay as they are, as test data.
- **Camera: frozen.** No camera, framing or `view` value is set here. Every zone takes the `view` defaults, and `CAMERA` stays read-only.
- **Crafting: out.** No recipes, no craft provenance, and every loot table has `fallback: null`.

## 1. Zones as world params

The Frontier is one world region, `region:ash-frontier`, with five zones. It hangs off the Concord Exchange by its **west gate**.
World `connections` only link zones inside one region (`origins/world/README.md`, "Not done"), so the Exchange-to-Frontier crossing
uses the contracts' region portal pair (`RegionDefinition.portals`: Exchange `to-frontier` at `west-gate` ↔ Frontier `to-exchange`
at `exchange-gate`), as the fixtures already have it.

**Exchange amendment.** One new landmark and one passage go in the existing `exchange` zone in `origins/world/concord.ts`. This is
data only, for a World-lane PR. No current landmark moves, so the `concord.test.ts` pins still hold:

```json
"layout":   { "west-gate": { "u": 0, "v": 0.5, "facing": 90 } },
"passages": { "west-road": { "from": "west-gate", "width": 3, "length": 12 } }
```

**Frontier world data** (`WorldData`, `schemaVersion: 1`):

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
          "zoneSize": { "width": 40, "depth": 100 },
          "layout": {
            "exchange-gate": { "u": 0.5, "v": 0, "facing": 180 },
            "milestone": { "u": 0.5, "v": 0.3, "facing": 0 },
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

Every connection is two-way and answered between the same landmark pair, which is what `resolveRegion` checks. Landmark names are
unique across the region, so they double as the contracts' waypoint ids (`LOCAL_KEY`).

| Zone | Size (u) | Band | Holds |
|---|---|---|---|
| `east-road` | 40 × 100 | 11–12 | the road out of the Exchange; the Charnel Road watchtower |
| `ferry-landing` | 60 × 60 | 11–15 | the Grey Ferry: Hesk, the dock, the night boat. No creatures, but not `safe`, because a Feud fight is held on the dock |
| `cinder-fields` | 120 × 120 | 11–13 | open creature ground: scavengers, the displaced shrine (Hrungnir's Bounty) |
| `black-mere` | 100 × 140 | 12–15 | the mere and its brood; the matriarch's hollow (public event); the causeway |
| `blood-ruin` | 60 × 80 | 13–14 | the Blood Court ruin: the jetty, the ruin gate, the crypt |

**Contracts region** (`region-definition`, fixture shape): `id: region:ash-frontier`, `gate: outer`, `waypoints` = the 21
landmark names above, `portals: [{ id: to-exchange, at: exchange-gate, to: region:concord-exchange, toPortal: to-frontier }]`, and
`assetManifest: regions/ash-frontier/manifest.json`. `triggers: []`: a Feud only advances on a fight's outcome, never on walking into
a place. Spawns:

| spawn id | at | encounter | characters |
|---|---|---|---|
| `feud-gate` | exchange-gate | `encounter:feud-west-gate` | — |
| `feud-tower` | watchtower | `encounter:feud-watchtower` | `character:courier-vell` |
| `feud-dock` | dock | `encounter:feud-dock` | `character:ferrymaster-hesk` |
| `feud-jetty` | ruin-jetty | `encounter:feud-jetty` | — |
| `feud-crypt` | crypt | `encounter:feud-crypt` | `character:scribe-ansel` |
| `bounty-shrine` | shrine | `encounter:bounty-hrungnir` | — |
| `bounty-toll` | milestone | `encounter:bounty-toll` | — |
| `bounty-reeds` | reed-bank | `encounter:bounty-peg-powler` | — |
| `matriarch` | mere-hollow | `encounter:mere-matriarch` | — |
| `scavengers` | ash-pits | null | `character:cinder-scavenger` |
| `brood` | reed-bank | null | `character:mere-brood` |
| `ghouls` | causeway-end | null | `character:ruin-ghoul` |

The `concord-exchange` region gains the `contract-board` waypoint and a `marrow` spawn there.

*Superseded with §3:* the five `feud-*` spawns and the dock-fight note on `ferry-landing`. Under systemic Feuds, `ferry-landing`
is the town of the Grey Ferry ([feuds.md](feuds.md) §10).

## 2. NPCs and talk

> *Superseded with §3:* the Feud talk lines below (Marrow's offer, the Sergeant's spare-or-execute flags, Ansel, Varney's debt)
> belonged to the scripted Feud. Grudge talk is in [feuds.md](feuds.md) §3.

Talk only frames the fights. It offers the Feud, delivers the choice, and taunts after a loss. Every record is
`npc-talk` v1 (`npc`, `lines[]` with `id`, `text`, `reply`, `priority`, `once`, `when`, `effects`). `Q` stands for
`quest:stolen-name`; write the full id in the file.

| id | name | where | faction | role |
|---|---|---|---|---|
| `character:recorder-marrow` | Marrow the Recorder | Exchange, contract board | `faction:concord` | giver |
| `character:courier-vell` | Vell the Courier | watchtower | `faction:ferry-court` | witness |
| `character:ferrymaster-hesk` | Hesk the Ferrymaster | dock | `faction:ferry-court` | ally |
| `character:scribe-ansel` | Ansel the Scribe | crypt | `faction:concord` | witness |
| `character:tithe-sergeant` | The Tithe Sergeant | watchtower | `faction:concord` | target |
| `character:steward-gall` | Mistress Gall | ruin jetty | `faction:blood-court` | target |
| `character:mere-mother` | Grendel's Mother | dock / mere-hollow | none | boss |
| `character:legend.nightborn-3` | Varney | crypt | `faction:blood-court` | boss |

`routine: []` for everyone. Each figure stands where its spawn puts it.

Lines, written as `id (priority, once): text → reply [when] {effects}`:

- **Marrow.** `offer` (10, yes): "My name is gone from the Roll." → "Then the Roll says you never fought. The courier who carried your
  page went west, and the Concord would rather you didn't follow." [quest-at Q null, tier-at-least Gladiator] {quest → `west-gate`}.
  `farewell` (99, no) {end}.
- **Tithe Sergeant**, after the watchtower win. `spare` (10, yes): "Live. Tell them I'm coming." → "I'll tell them. I'll also tell you
  the crypt has a side door." [quest-at Q `dock`, encounter-cleared `encounter:feud-watchtower`] {set-flag `sergeant-spared` true}.
  `execute` (10, yes): "No." → "So be it." (same conditions) {set-flag `sergeant-executed` true, end}. The two lines are
  exclusive: each one also requires the other flag to be false. After a loss the encounter is not cleared, so neither line is offered.
- **Vell** frames the watchtower ("They've had me ringed three days. The page went to the Blood Court under Concord seal.") with no
  effects.
- **Hesk** frames the dock ("She comes up under the planks when a boat's due. Keep off the rotten ones.") and rows you across after
  the dock fight. No quest effect is needed, because the jetty step starts on arrival.
- **Ansel**, after the crypt win. `return` (10, yes): "Write my name back." → "In my own hand, this time." [quest-at Q `crypt`]
  {quest → `returned`, choice `return`}. `expose` (11, yes): "You'll say whose seal it was, in the Exchange." → "Then I'm a dead man
  either way. Better a loud one." [quest-at Q `crypt`] {quest → `exposed`, choice `expose`}.
- **Varney**, after a crypt **loss**. `debt` (10, yes): "Finish it." → "Finish a guest? Take your page. You owe the Court now, and
  the Court remembers." [quest-at Q `crypt`] {quest → `indebted`, choice `debt`}.

Taunts on a loss live in the twist table (section 3). They play as the retry prompt, not as a talk tree.

## 3. Chapter one: *The Stolen Name* (a Feud)

> **SUPERSEDED (Dom, 2026-10-06):** Dom rejected this scripted Feud chain. Feuds are now systemic: see [feuds.md](feuds.md). It is
> kept below for the record. **The Bounties subsection at the end of this section stays in force.**

> **PROVISIONAL, pending Dom.** "Feud" and "Bounty" are working names that Dom may rename. Strategy ruled on 2026-10-06 that Feuds and
> Bounties **replace** classic quests, and the quest journal stays as the Feud log. No fetch, collect-N, kill-N or errand appears
> anywhere in this region.

**The model.**

- A **Feud** is a one-off story chain of 4–6 **fights with a twist**. It ends in a **unique provenance piece**.
- A **Bounty** is a short, repeatable single fight with a twist. It pays bound rewards (metal) up to a daily cap.
- The twist is the content: a changed condition such as an arena hazard, a style the foe forces on you, win without blocking, two
  foes in a row on one health bar, or a foe who flees at 30%.
- Each Feud teaches or tests **one** combat idea.
- A loss never resets the chain. It is either a **branch** or a **retry with a taunt**, and never a re-walk.
- A whole Feud takes about 10 minutes, with under a minute of travel in total. There are no collect-N steps, no escorts and no
  autoplay.
- Progress is never gated on holding an item. Every transition reads a fight's outcome.

**The Stolen Name.** At Gladiator your name has been struck from the Roll beneath the Pit. Someone in the Concord ordered it, and
the Blood Court keeps the page. **Combat idea: reading a heavy.** You learn to see the charge, then roll it, parry it or move away
from it.

| # | Stage (`quest-definition` stage) | Where | Foe(s) | Twist | Teaches | Win | Loss |
|---|---|---|---|---|---|---|---|
| 1 | `west-gate` | Exchange west gate | Court thrall (elite, L13) | **Win without blocking.** Guard is off. He throws only telegraphed heavies | see the charge, roll it | → `watchtower` | retry. Taunt: "The Roll has no room for you." |
| 2 | `watchtower` | Charnel Road watchtower | Court thrall, then the **Tithe Sergeant** (named, L12) | **Two foes in a row, one health bar** | read heavies while tired | → `dock`, then the **choice**: spare or execute the Sergeant | **branch** → `dock`. The Sergeant walks away, `escaped`, and returns in step 5 |
| 3 | `dock` | Grey Ferry dock | **Grendel's Mother** (L15) | **Arena hazard:** her heavy slam breaks the plank it lands on, so the ring shrinks. **She flees at 30%** into the mere | dodge a heavy *away from* danger | → `jetty` (Hesk rows you over) | retry. Taunt (Hesk): "She'll be back for the boat. So will you." |
| 4 | `jetty` | ruin jetty | **Mistress Gall**, Varney's steward (named, L13) | **A style forced on you:** only a parried heavy wounds her | parry the heavy | → `crypt` | retry. Taunt: "The master prefers guests who can dance." |
| 5 | `crypt` | crypt | **Varney** (L13), shaped by step 2 (below) | depends on step 2 | all of it | → choice ending: `returned` or `exposed` | **branch** → `indebted` ending |

**Who shows up in step 5** (the step 2 choice, read from the talk flags):

| Step 2 result | Step 5 | Twist |
|---|---|---|
| Spared (`sergeant-spared`) | Varney alone. The Sergeant's side door skips his court | **Candlelight:** the crypt is dark, and only the glow of Varney's charge shows the heavy |
| Executed (`sergeant-executed`) | Varney, with the court's tithe | **Blood tithe:** every heavy he lands on you heals him |
| Escaped (lost step 2) | The Tithe Sergeant, then Varney | **Two foes in a row, one health bar** |

**Travel** at `movement.runSpeed` 4.6 m/s and `scale.metresPerUnit` 1, from the zone layouts above:

| Leg | Distance |
|---|---|
| Contract board → west gate → Frontier exchange-gate (step 1) | 16 + 12 = 28 m |
| exchange-gate → watchtower (step 2) | 56 m |
| watchtower → crossroads → road-end → dock (step 3) | 47 + 54 = 101 m |
| dock → night boat → ruin-jetty (step 4) | 0: an instant portal with a short fade (ruled) |
| ruin-jetty → crypt (step 5) | 60 m |
| **Total** | **245 m ≈ 53 s** |

With five fights of about a minute each, the talk and the boat, a Feud runs about 8–10 minutes.

**Data, in today's shapes.** One `quest-definition`: `id: quest:stolen-name`, `scope: personal`, `gate: outer`,
`storyVersion: 1`, `start: west-gate`, `migrations: []`. Each fight is its own `encounter-definition`. Stage transitions read only
the encounter's outcome, plus the ending `choice`:

| Stage | Kind | Transitions out | Rewards (once ever) |
|---|---|---|---|
| `west-gate` | progress | → `watchtower` [encounter-cleared `encounter:feud-west-gate`] | — |
| `watchtower` | progress | → `dock` [encounter-cleared `encounter:feud-watchtower`] · → `dock` [**encounter-lost** `encounter:feud-watchtower`] † | — |
| `dock` | progress | → `jetty` [encounter-cleared `encounter:feud-dock`] (fled at 30% counts as cleared †) | — |
| `jetty` | progress | → `crypt` [encounter-cleared `encounter:feud-jetty`] | blood-court −50 |
| `crypt` | progress | → `returned` [cleared `feud-crypt`, choice `return`] · → `exposed` [cleared `feud-crypt`, choice `expose`] · → `indebted` [**encounter-lost** `feud-crypt`, choice `debt`] † | — |
| `returned` | finish | — | loot `loottable:feud-stolen-name-won`; concord +50, ferry-court +25 |
| `exposed` | finish | — | loot `loottable:feud-stolen-name-won`; concord −25, blood-court −100, ferry-court +25 |
| `indebted` | finish | — | loot `loottable:feud-stolen-name-debt`; blood-court +50, concord −25 |

† These need contract additions, listed in section 7: an `encounter-lost` condition kind, a fled outcome, the twist itself, and
step 5's variant choice. Today's shapes carry everything else unchanged. The graph passes `checkGraph`: every stage is reachable,
and every progress stage reaches an ending. A step whose only exit is `encounter-cleared` is a retry, not a soft lock, because the
encounter can always be fought again.

**Journal text** (≤ 600 characters each): `west-gate` "The Concord sent a thrall to stop me at the west gate." · `watchtower` "Vell was
ringed at the watchtower by the Tithe Sergeant's men." · `dock` "Grendel's Mother came up under the ferry." · `jetty` "Varney's
steward met the boat." · `crypt` "Varney keeps my page in the crypt, and Ansel, the scribe who struck it out." · endings: "My name is
back on the Roll." / "The whole Exchange heard whose seal it was." / "I have my page, and the Blood Court has my debt."

**Unique provenance piece.** Each ending mints its piece as `quest-reward` provenance (`quest: quest:stolen-name`, `stage:` the
ending). That makes the piece one of a kind per player, and its provenance permanently records which ending earned it:

- **Won** (`returned`, `exposed`): *Blood Court mail* (`item:feud.court-mail`, Body, rare, steel, tradeable under the cooldown in
  section 5) and the Roll page (`item:stolen-name-record`, story-critical, bound).
- **Indebted:** *Varney's marker* (`item:feud.blood-marker`, Crest cosmetic, relic, bound on acquire) and the Roll page.

**The choice changes who shows up later.** Step 2 decides step 5, and the ending decides chapter two. Chapter-two Feuds open on
`stage-reached quest:stolen-name <ending>`: the Concord hunts an exposer, the Blood Court calls in an indebted player's debt, and a
spared Sergeant reappears on the player's side. Chapter two is out of scope here.

**CP** (`origins/progression/model.ts`, the #1428 model). The journal emits one story event per stage reached for the first time
(`id = quest:stolen-name:<stage>`):

- 5 progress stages pay `TYPE_WEIGHTS['story-step']` (weight 100).
- The finish pays `TYPE_WEIGHTS['story-chapter']` (weight 500).
- `basePay` for these `atOwn` rows is `floor(killValue(you) × weight / 1000)`. Story pays once ever.

| Your level | Step | Chapter | Story total | Plus fights (solo, first time) |
|---|---|---|---|---|
| 11 | 200 | 1,000 | 2,000 | thrall 176 ×2, Sergeant 440, Gall 440, Varney 1,100. Grendel's Mother flees, so 0 |
| 13 | 220 | 1,100 | 2,200 | thrall 176 ×2, Sergeant 378, Gall 440, Varney 1,100 |

The kills are priced by their own rows (section 4). The Sergeant, Gall and the thralls are `rested` rows that draw on the allowance,
and Varney is `world-boss`, paid on the first win only. No new constant is introduced.

### Bounties (examples)

A Bounty is a single fight with a twist that can be repeated. It pays **metal**, up to a **daily cap**. Metal is the one bound NPC
currency: the same account balance as `LootTable.currency`, never an item (ruled). A Bounty pays no story credit; the kill pays its
own row.

| id | Where | Foe | Twist | Metal | Cap |
|---|---|---|---|---|---|
| `bounty:hrungnir` | the shrine | **Hrungnir** (named, L13, `knight` body) | **Embers:** the shrine floor burns whoever stands still for 2 s | 40 | 3 / day |
| `bounty:toll` | milestone | two court thralls (elite, L12) | **Two in a row, one health bar** | 30 | 3 / day |
| `bounty:peg-powler` | reed bank | **Peg Powler** (named, L14, `witch` body) | **Flees at 30%** into the reeds. Catch her within 15 s or the Bounty is forfeit for that attempt; it can be retried at once | 50 | 2 / day |

**`bounty-definition`** is a new content kind, as Strategy ruled: not a repeat hack on quests. Proposed shape, version 1:

```json
{ "kind": "bounty-definition", "schemaVersion": 1, "id": "bounty:hrungnir", "name": "The Stone at the Shrine",
  "region": "region:ash-frontier", "gate": "outer",
  "encounter": "encounter:bounty-hrungnir",
  "twist": { "kind": "hazard", "hazard": "embers" },
  "metal": 40, "dailyCap": 3 }
```

- `metal` is a positive integer, paid to the one currency balance on a win.
- `dailyCap` is wins paid per character per server day, UTC. Wins past the cap pay no metal; the kill still pays its CP row.
- `twist` uses the same shape as the encounter twist flag (section 7). The encounter's own flag is the one the fight reads. The
  bounty copy is display only and must match, a rule checked at load.
- A loss pays nothing and costs nothing. Retry at once.
- This needs a new id namespace, `bounty` (`origins/contracts/ids.ts`), a parser, and a `CONTENT_KINDS` entry in the registry. It
  belongs to the contracts PR.

## 4. Bosses and creatures

> *Superseded with §3:* every "Feud step" reference and the five `encounter:feud-*` rows. Grendel's Mother stays as the public
> event boss, the Bounty rows stand, and Varney has no encounter until a grudge or event uses him.

Every figure fights through `encounterForms`, as a roster opponent at a level. A kill is priced by the `TYPE_WEIGHTS` row the server
names in the `Kill` event (`target` = character id, `targetLevel` = the form's level).

| Character | Name | Body (roster) | Lvl | Row | Fought in |
|---|---|---|---|---|---|
| `character:mere-mother` | **Grendel's Mother** (matriarch) | `witch` | 15 | `world-boss` | Feud step 3 (flees, no kill); public event `mere-matriarch` (the kill) |
| `character:legend.nightborn-3` | Varney | `nightborn` | 13 | `world-boss` | Feud step 5 |
| `character:tithe-sergeant` | The Tithe Sergeant | `veteran` | 12 | `named` | Feud steps 2 and 5 |
| `character:steward-gall` | Mistress Gall | `shieldmaiden` | 13 | `named` | Feud step 4 |
| `character:hrungnir` | Hrungnir | `knight` | 13 | `named` | Bounty |
| `character:peg-powler` | Peg Powler | `witch` | 14 | `named` | Bounty |
| `character:court-thrall` | Court thrall | `pitborn` | 12–13 | `elite` | Feud steps 1 and 2; Bounty |
| `character:cinder-scavenger` | Cinder scavenger | `goblin` | 11 | `mob` | open world |
| `character:mere-brood` | Mere brood | `goblin` | 12 | `mob` | open world; matriarch stage |
| `character:ruin-ghoul` | Ruin ghoul | `goblin` | 11 | `mob` | open world |

No held roster body is used. The court thrall has two forms, `l12` and `l13`, each in `encounterForms`.

**Encounters** (`encounter-definition`). All Feud and Bounty encounters are `scope: solo`, `decay: null`, `restartSeconds: 0`.
The parser needs at least one stage before the boss. A two-foe step uses that stage as the first foe. A single-foe step needs either
`stages` allowed to be empty, or a dummy stage (contracts PR, section 7).

| id | stages → boss | Twist (proposed field, section 7) |
|---|---|---|
| `encounter:feud-west-gate` | — → court thrall L13 | `no-block` |
| `encounter:feud-watchtower` | court thrall L12 (1 kill) → Tithe Sergeant | `one-health-bar` |
| `encounter:feud-dock` | — → Grendel's Mother | `hazard: breaking-planks`, `flee-at: 30` |
| `encounter:feud-jetty` | — → Mistress Gall | `damage-only-on-parry` |
| `encounter:feud-crypt` | variant by step 2 → Varney | `candlelight` / `heal-on-hit` / `one-health-bar` |
| `encounter:bounty-hrungnir` / `-toll` / `-peg-powler` | as section 3 | `hazard: embers` / `one-health-bar` / `flee-at: 30, catch: 15` |
| `encounter:mere-matriarch` | `guard`: one brood guardian (1 kill, pop 1) → Grendel's Mother | none: `scope: public`, `decay` 900 s / keep 50%, `restartSeconds` 3600, `minContributionPercent` 10 |

**Boss rules (first win only).** The `world-boss` row is `once: true`, `party: 'each'`. The first kill of
`world-boss:<character id>` pays and adds that key to `beaten`. Every later kill returns `already-beaten` and 0 CP. A grey kill, or
a share under `MIN_CONTRIBUTION_PERMILLE` (100), does not use the boss up. The cap clears every flag (`allBossesOpen`). Grendel's
Mother fleeing in the Feud is not a kill, so her once-only award is paid at the public event.

**Lockout.** The model has no per-character lockout (progression proposal §3: "The 7-day lockout is gone"). `restartSeconds` is
only the world respawn. Ruled: follow the #1428 model.

**CP per kill.** `basePay = floor(killValue(min(target, you)) × falloff(target − you) × weight / 1e6)`, solo:

| Target | You 11 | You 13 | You 15 |
|---|---|---|---|
| Grendel's Mother, L15, world-boss 500 | 1,250 | 1,210 | 1,200 |
| Varney, L13, world-boss 500 | 1,100 | 1,100 | 990 |
| Named, L12 / L13 / L14, 200 | 440 / 440 / 500 | 378 / 440 / 484 | 210 / 396 / 414 |
| Court thrall, L12 / L13, elite 80 | 176 / 176 | 151 / 176 | 84 / 158 |
| Mob, L11 / L12, 20 | 40 / 44 | 36 / 37 | 20 / 21 |

Named, elite and mob rows are `rested`. They draw on `RESTED_PER_DAY_CP` (1,500), cap at `RESTED_CAP_CP` (3,000), and are cut by
repeat heat (`FREE_REPEATS` 3, `HEAT_UNIT_S` 360). So a farmed Bounty's CP fades on its own, separately from its metal cap.
Anything at `d ≤ −6` is grey and pays nothing.

## 5. Loot

> *Superseded with §3:* the Feud ending rewards (`item:feud.court-mail`, `item:feud.blood-marker`, `item:stolen-name-record`, and
> the two `feud-stolen-name-*` tables) are parked. Grudge rewards are metal ([feuds.md](feuds.md) §3).

Two provenance kinds are used (`items.ts` `PROVENANCE_KINDS`):

- **`loot`** for creature, boss and public-event drops: `{ mintKey: 'loot:<encounter or kill id>:<n>', wonBy, table, encounter }`.
- **`quest-reward`** for the Feud's ending pieces: `{ mintKey: 'quest:stolen-name:<ending>:<pc local>', wonBy, quest, stage }`.

Loot never gates progress: no Feud or Bounty step reads `has-item`. Feud steps drop nothing. Only the ending pays. Bounties pay
metal only.

**Tier.** Gear records the tier it was won at. The proposal is the zone's `difficulty.lootTier` (3), read as **Gladiator**, so
`equipItem` needs Gladiator and the fixed spine (Attack/RES caps 1.15/0.80) holds. Rarity is a label, never a stat.

**Items** (gear is `category: gear`, `power: slot-weight`, `stack: 1`, `story: none`, `binding: none` unless stated):

| id | name | slot | rarity | material | from |
|---|---|---|---|---|---|
| `item:frontier.ash-helm` | Ash-caked helm | Helmet | common | iron | scavenger, Varney table |
| `item:frontier.watch-greaves` | Watchtower greaves | Greaves | common | iron | scavenger, court thrall |
| `item:frontier.thrall-gloves` | Thrall's iron gloves | Gloves | fine | iron | court thrall, Varney table |
| `item:frontier.ferryman-boots` | Ferryman's boots | Boots | fine | leather | court thrall, matriarch |
| `item:frontier.mere-arms` | Drowned vambraces | Arms | fine | bronze | matriarch |
| `item:frontier.mere-shield` | The Mere-Mother's shield | Shield | relic | bone | matriarch (public event) |
| `item:feud.court-mail` | Blood Court mail | Body | rare | steel | Feud ending only (unique provenance) |
| `item:feud.blood-marker` | Varney's marker | Crest | relic | bone | Feud `indebted` only. `cosmetic`, `notable`, `on-acquire` |
| `item:stolen-name-record` | The Roll page | — | relic | bone | Feud ending only. `quest`, `story-critical`, `on-acquire` |
| `item:grave-iron` | Grave iron | — | fine | iron | open-world drop. `material`, `stack: 50`, blacksmith cost lines only |

No weapons drop in region 1 (ruled).

**Tables** (`loot-table`, `distribution: personal`, `fallback: null`; gear entries are `levelMin: 11, levelMax: null`):

| id | presentation | rolls | currency |
|---|---|---|---|
| `loottable:cinder-scavenger` | collect | indep. p50: grave-iron 40 ×2 · indep. p100: ash-helm 2, watch-greaves 2 | 3–12 |
| `loottable:ruin-ghoul` | collect | indep. p60: grave-iron 30 ×3 | null |
| `loottable:mere-brood` | collect | indep. p40: grave-iron 30 ×1 | null |
| `loottable:court-thrall` | take-one | weighted p25, limit 1, min 1: thrall-gloves 50, ferryman-boots 30, watch-greaves 20 | 10–30 |
| `loottable:mere-mother` | take-one | weighted p100, limit 1, min 1: mere-shield 25, mere-arms 45, ferryman-boots 30 | 100–250 |
| `loottable:ruin-boss` | take-one | weighted p100, limit 1, min 1: thrall-gloves 50, ash-helm 50 | 50–200 |
| `loottable:feud-stolen-name-won` | collect | indep. p100: court-mail 100, stolen-name-record 100 | null |
| `loottable:feud-stolen-name-debt` | collect | indep. p100: blood-marker 100, stolen-name-record 100 | null |

The two `collect` Feud tables are not progress gates. They are the shape the contracts already use to pay a stage. One of each per
account (`checkOneOfEach`) stops duplicates. **Boss loot is first win only** (ruled; revisit after beta). The boss table rolls
only on the kill that pays the once-row. A repeat boss kill rolls NO boss table and drops no ordinary creature loot; it pays only
what the model gives (0 credit for a world boss, `already-beaten`).

**Trading.** Frontier gear and the Feud mail trade only at the Exchange (`Trade.region` = `region:concord-exchange`; the Frontier
has `rules.tradeAllowed: false`). There is **no hard limit**. Each piece has its own cooldown: `FIRST_TRADE_DELAY_S` (72 h from
mint), then `COOLDOWN_STEPS_S` (7 / 14 / 30 days, capped at 30), from `tradeCooldown` on `expansion/trade-cooldown` (857e73c6, not
yet on trunk). Never tradeable: the page and the marker (bound), grave iron (stackable), and metal (an account balance, not an item).

## 6. Content-bundle files

> *Superseded with §3:* `quests.json`, the Feud records in `talk.json` and `encounters.json`, and the Feud acceptance checks.
> Grudge content kinds are listed in [feuds.md](feuds.md) §11.

`ORIGINS_CONTENT` (on `expansion/o3-writer-story`, `origins/server/content.ts`) names **one JSON file holding one array**.
Definitions go through `loadContent`, and `npc-talk` records go through `loadTalk`, with talk quest steps checked against the
quests. Proposed source layout: one array per kind, concatenated in this order into that file. The loader resolves
cross-references after parsing everything, so the order only keeps diffs readable.

| File (`origins/content/ash-frontier/`) | `kind` | Records |
|---|---|---|
| `factions.json` | `faction-definition` | 2: `faction:ferry-court`, `faction:blood-court`. `faction:concord` comes from the Exchange bundle |
| `items.json` | `item-definition` | 10 |
| `loot-tables.json` | `loot-table` | 8 |
| `characters.json` | `character-definition` | 14: Marrow, Vell, Hesk, Ansel, Sergeant, Gall, Grendel's Mother, Varney, Hrungnir, Peg Powler, court thrall, scavenger, brood, ghoul |
| `regions.json` | `region-definition` | 1 (`region:ash-frontier`), plus the Exchange amendment (waypoint `contract-board`, spawn `marrow`) |
| `encounters.json` | `encounter-definition` | 9: 5 Feud, 3 Bounty, 1 public |
| `quests.json` | `quest-definition` | 1: `quest:stolen-name` |
| `talk.json` | `npc-talk` | 6: Marrow, Sergeant, Vell, Hesk, Ansel, Varney |
| `world.json` | **not in the bundle** | the section 1 `WorldData`, read by `origins/world` `loadWorld` |
| `bounties.json` | `bounty-definition` (new) | 3. Loads only once the contracts PR adds the kind |

A duplicate id anywhere in the combined bundle is refused. Example record:

```json
{ "kind": "character-definition", "schemaVersion": 1, "id": "character:mere-mother", "name": "Grendel's Mother",
  "lore": { "source": "Beowulf (Old English poem, Cotton Vitellius A.xv)",
            "summary": "In the old poem she came up out of a haunted mere to avenge her son and was cut down in her own hall beneath the water. The Fracture set her mere on the Ash Frontier, and she drowns every boat the Ferry Court puts on it." },
  "faction": null, "essential": false, "relationships": [],
  "questRoles": [{ "quest": "quest:stolen-name", "role": "boss" }],
  "presentations": [{ "id": "default", "asset": "characters/mere-mother.glb" }],
  "encounterForms": [
    { "id": "feud", "opponent": "witch", "level": 15, "encounter": "encounter:feud-dock" },
    { "id": "public", "opponent": "witch", "level": 15, "encounter": "encounter:mere-matriarch" } ],
  "routine": [] }
```

**Acceptance for the data PR:**

- `loadStoryContent(bundle)` and `resolveRegion(world, 'region:ash-frontier', …)` both load with no issues.
- A journal test walks all three step 5 variants to every ending, including both loss branches.
- Each walk pays 5 story steps and 1 chapter, and nothing pays twice on replay.
- No Feud stage reads `has-item`.

## 7. Rulings and open questions

### Ruled (Strategy, 2026-10-06)

1. **Names.** Bosses and named climax targets are legends: Grendel's Mother, Varney, and the Bounty targets Hrungnir and Peg Powler.
   Mooks and side NPCs may be original (`lore.source: "original"`).
2. **Quests vs contracts.** Feuds and Bounties **replace** classic quests. The journal stays as the Feud log *(superseded: systemic Feuds keep no journal; see feuds.md)*. No fetch, collect-N or
   kill-N anywhere: the doc was re-checked, and the matriarch's public-event stage went from "3 brood kills" to one brood guardian.
3. **Lockout.** Follow the #1428 model: first win only, no 7-day lockout. `restartSeconds` is the world respawn only.
4. **Metal** is the one bound NPC currency, the same balance as `LootTable.currency`. Metals replace "tribute". One balance.
5. **Night boat.** An instant portal with a short fade. It counts as 0 travel.
6. **No weapon drops** in region 1.
7. **Region id.** `region:concord-exchange` wins: it is the id contracts and `Trade` use (`origins/contracts/economy.ts`
   `CONCORD_EXCHANGE`). World data renames `CONCORD_REGION` in `origins/world/concord.ts` from `region:concord` to match, in a
   World-lane PR. The applied migrations (`supabase/migrations/202610060001_origins_save.sql`, `202610060002_origins_spend.sql`)
   contain **neither** id and have no region column, so the DB needs no change.
8. **Bounty** is a new `bounty-definition` (encounter, twist, metal, dailyCap). Shape in section 3.
9. **Boss loot on the first win only.** Repeat kills pay the normal row. Revisit after beta.
10. **Twists are Origins encounter flags only.** They must not move the live ladder: the RNG fingerprint and RV stay unchanged, and
    the #1402 test must still pass. Combat owns the sim side. Cheap first:
    1. `flee-at`
    2. `one-health-bar`
    3. `no-block`
    4. `damage-only-on-parry` and `heal-on-hit`
    5. `hazard` and `candlelight` last (render work).

    Section 3 stays **PROVISIONAL** until Dom has seen the Feud and Bounty names.

### Open, for the coordinator and Backend in the contracts PR

1. **Contract fields a twist needs**, all on `EncounterDefinition` unless noted:
   - **(a)** `twist` (the ten flags in section 4);
   - **(b)** `stages` allowed to be empty;
   - **(c)** `variants` chosen by a talk flag (step 5);
   - **(d)** an outcome of `won`, `lost` or `fled`, so a flee counts as cleared;
   - **(e)** on `Condition`, a new kind, `encounter-lost`;
   - **(f)** retry taunt text;
   - **(g)** the `bounty-definition` kind and the `bounty` namespace.
2. *(Superseded with §3.)* **Talk flags into the server.** Step 5 reads the step 2 talk flags, but no server path connects them yet.
3. *(Superseded with §3.)* **Stage rewards blocked.** The writer refuses stages carrying loot or standing (501, `expansion/o3-writer-story`). The Feud's
   endings and the `jetty` stage carry them.
4. **World params outside `ORIGINS_CONTENT`.** A second file, or a new content kind?
5. **World-loot tier.** The zone's `lootTier` (Gladiator), or the killer's own title?
6. **Bodies and ground.** The matriarch and Peg Powler on `witch`, Gall on `shieldmaiden`, Hrungnir on `knight`, roster bodies for
   the rest. Also `terrain.ground: "ash"` needs an art preset, or keep `sand`.
7. **Two contribution measures** for the public event: `minContributionPercent` and `MIN_CONTRIBUTION_PERMILLE`. Which one governs
   CP, and which governs loot?

## 8. Names and sources (legends rule)

| Name | Source | Allowed because | Pronoun |
|---|---|---|---|
| Grendel's Mother | *Beowulf*, an anonymous Old English poem, c. 8th–11th century. Sole manuscript British Library Cotton Vitellius A.xv (the mere episode) | medieval literature by an author dead far beyond 70 years. She is known from the poem, not from scripture, and is no living people's folk hero. The backstory is original prose with no quotation. Her son Grendel is already the pitborn rung-5 legend; no relationship row is written, so the bundle needs no Grendel record | she |
| Hrungnir | Snorri Sturluson, *Prose Edda*, Skáldskaparmál, c. 1220 | Norse myth (a dead pantheon whose figures are already on the ladder: Thor, Odin, Loki); not yet a Pit legend; Bounty text is original prose. Confirmed by Strategy | he |
| Peg Powler | Tees river folklore; William Henderson, *Notes on the Folk-Lore of the Northern Counties of England and the Borders*, 1866 | English folklore, PD source, no living-religion tie, no living people's folk hero; Bounty text is original prose. Confirmed by Strategy | she |
| Varney | *Varney the Vampire; or, The Feast of Blood*, penny serial 1845–47, attributed to James Malcolm Rymer and Thomas Peckett Prest | pre-1929 literature, both authors dead 70+ years. Already `src/legends.ts` nightborn rung 3 and the contracts fixture (`Varney the Vampire, 1847`) | he |
| Marrow, Vell, Hesk, Ansel, the Tithe Sergeant, Mistress Gall, all mobs | original (`lore.source: "original"`) | — | Marrow she, Vell he, Hesk he, Ansel he, Gall she |

Considered and dropped: **Black Shuck** (East Anglian folklore). Its best-known early account, Abraham Fleming's 1577 pamphlet,
presents the dog as the Devil, which comes too close to the ruling 4 barred list. No name here hits `BARRED_NAMES`. Per the ruling, the Feud's climax
targets (Grendel's Mother, Varney) and both named Bounty targets are legends. Mid-chain foes and side NPCs are original.
