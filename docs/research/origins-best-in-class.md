# Origins best in class: what the old games do best, and what we take (patterns only)

Status: research proposal for Dom to approve as a batch (2026-10-07). Docs only, nothing is built. Mobs first and deepest (Part A), then combat, world/zone structure and quest structure (Part B). Where `docs/specs/origins/mobs.md` (#1647) already decides something, the parts cite it instead of re-deciding.

## Rules at the top (non-negotiable, Dom 2026-10-07)

1. **One engine.** Every creature fight is the Pit duel: the same `src/` engine, no dice, no hit chance, no auto-swing, no tab-target, no second combat engine, no combat code copied into `origins/`. Any donor pattern that resolves a fight by dice or auto-swing is **SKIP** for the fight itself; only its presentation or world value may be kept. World-only behaviour (noticing, flee, beast moves, packs, caster tells, the plus-or-minus 10% seeded damage roll on world mobs) is an add-on layer over `src/`. A combat change is proven in the Pit first under the RV gates.
2. **Nothing pauses in the open world.** Overlays are visual only over a running clock; a creature fight is locked 1v1 (any third party can watch, not hit or steal); no escape by pause, backgrounding or disconnect (see #1665).
3. **Patterns only, no GPL code.** EQEmu, ModernUO, OpenMW, Exult, GemRB, OpenEnroth (LGPL) and Cataclysm (CC BY-SA) are behaviour-only reads, restated in our words. MIT donors (daggerfall-unity, OpenGothic, ZenKit, OpenTESArena, world-of-claudecraft) may be adapted with a `THIRD_PARTY_NOTICES` line. Games that ship without data (OpenMW, Exult, GemRB, OpenEnroth) were read for schemas and AI only; no proprietary data was fetched or stored. The licence class of every donor is in each part.
4. **Variety comes from data rows plus few rigs.** Stat-moving variety is Combat's call.

## Ranked top 10 for Dom to approve as one batch

Each line: what it is, the verdict, the row or kit it becomes. Details, sources and the five (or seven) fields per item are in the parts below.

1. **Tier ladder inside a body family** (Part A, M1/M8). One rig, three to five rungs, all data. TAKE. Becomes a `rungs` list on the family row; the cheapest source of distinct foes.
2. **Zone dial that picks the rung, with a level window from an ordered mob table** (Part A, M8; Part B, W4). One number per zone shifts the mix; grey creatures only attack in the deepest tier. TAKE. Becomes `difficulty.levelMin/Max` plus a weakest-first mob table per zone in `generateZone`; makes 600 zones tunable and testable.
3. **Free visual spread: scale jitter, tint pool, dressing, gear** (Part A, M8). Doubles the roster with no combat risk. TAKE. Becomes `MobLook` variants (Characters' #1643/#1644 path).
4. **Leader plus a bounded follower band, one attacker at a time** (Part A, M3; Part B, C5/C9). The camp differs even when the bodies are the same; the pack stays inside the 1v1 duel (waiting members are presentation actors on a ring, Combat's #1658). ADAPT. Becomes `leader` and `order` on the camp row.
5. **Behaviour presets and a signature move kit** (Part A, M8; Part B, C2). A readable difference in play from one id; world layer only, each move a trigger, chance and cooldown range. ADAPT. Becomes `behaviour` preset id and 1-3 `moves` per kind; Combat proves any move in the Pit first.
6. **Situation-keyed tactic table with a reaction slot** (Part B, C1; Gothic). The warden picks its next step from a table keyed by situation. ADAPT. Becomes the warden's per-kind tactic row (Combat's call, Pit first).
7. **Caster tells with a breakable flag, plus the flee package** (Part B, C3/C6). No move both unparryable and unbreakable; flee never when the hero is nearly dead or allies are fighting, deterministic, no dice. ADAPT. Becomes `tell` and `flee` rows (mobs.md section 5 already covers flee-at).
8. **Rarity curves over level, placeholder plus rare** (Part A, M4/M7). The roster drifts smoothly with one field; named events come out of ordinary camps. TAKE. Becomes `rarity` and a `rare` class enum on the spawn row.
9. **Derived card words: danger, occurrence, group size** (Part A, M6). Readability with nothing to author. TAKE. Becomes derived fields on the con ring and versus card (mobs.md section 1 owns the ring).
10. **Quest template with typed slots and a task graph, every quest ending in an ordinary Pit duel** (Part B, Q2; Daggerfall). TAKE. Becomes a `questTemplate` row the generator fills per zone.

Also strong, not in the ten: explicit directed travel graph (Part B, W2), population split filler/camps/singles with a budget (W5; median camp of 3 matches our 2-3), habitat curves (W6), what it carries is what it wears (Part A).

## First body-family batch (proposal)

Part A, section M9, proposes eight families from about five rigs: hound, boar, bear, stalker cat, serpent, spider, giant and a hooved look-swap. Four-legged beasts and one large monster are in it, as Strategy asked. It lines up with Characters' #1648 body-families spec by name only; neither side has read the other, so Characters should compare M9 against #1648 before anything is built.

## Unverified, in one place

The UO density figures rest on 6 spawn files; Mount & Blade, Kingdom Come, Souls, For Honor and Chivalry are public design knowledge from memory with no source checked; Gothic quest scripts are proprietary and not in the donor set; Arena's level-keyed choice, Barony's miniboss roll and several lever-table cells are marked `?`. Every number in a "Becomes" field is a proposal for Combat or World to tune. The parts list their own gaps.

---

# Donor research, Part A: creatures, mobs and opponent variety (patterns only)

- Author: analyst (Part A of the donor research document). Docs only. 2026-10-07.
- Reads: 23 donor trees under `/mnt/frankendom-donors` (pinned in `PINS.txt`), read-only over ssh. Nothing was cloned, fetched or stored. No game data was touched.
- Cites, does not repeat: `docs/specs/origins/mobs.md` (branch `expansion/spec-mobs`). Where that file already decides something this document says "decided in mobs.md section N" and moves on. Existing sibling specs also not repeated: `modernuo-champion-spawns.md`, `gothic-guilds-attitudes.md`, `eqemu-loot.md`, `eqemu-faction.md`, `openmw-factions-disposition.md`.
- Clean-room: every pattern below is restated in our words. No donor code, identifier tables or data rows are reproduced. Names of record fields are mentioned only where they are the plain pattern name (for example "chance of none").

## 0. Rules this document obeys

**One-engine rule (Dom, non-negotiable).** Every creature fight is the Pit duel: same `src/` engine, no dice, no hit chance, no auto-swing, no tab-target, no second combat engine. Any donor pattern that settles a fight by dice, hit chance, auto-attack or a separate combat resolver is **SKIP for the fight itself**; only its presentation or world value is kept, as an add-on layer over the duel. A combat change is proven in the Pit first.

**Variety rule.** Opponent variety comes from data rows plus few rigs. Stat-moving variety (health, damage, resistances) is Combat's call and is listed as SKIP or ADAPT with "Combat decides"; visual and world variety (scale, tint, pack, spawn mix, behaviour set, labels) is free and is where most of the verdicts land.

**Per-item format.** Item, Best at, Source, Verdict (TAKE / ADAPT / SKIP with a one-line reason), Becomes (the row field or generator kit it turns into). "Becomes" names fields of the `MobRow` in mobs.md section 7 (`id, name, source, role, family, look{opponent,tint,scale,gear,dressing,later}, behaviour{aggro,viewHalf,hearRadius,leash,roam,campSize,activity,engage}, loot, level, habitat, weight, named`) and, where a pattern needs more, the proposed **additive optional fields** in section G below. Proposed fields are proposals for the row owner, not decisions.

## 0.1 Licence class per donor (read from each repo's licence file before use)

| Donor (pin) | Licence file says | Class | How used here |
|---|---|---|---|
| daggerfall-unity `2343305` | MIT | MIT-adapt | shapes and numbers described in own words |
| OpenGothic `801f6ed5` | MIT | MIT-adapt | same |
| ZenKit `ddf27dec` | MIT | MIT-adapt | same |
| afritz1-OpenTESArena `67872ae` | MIT | MIT-adapt | same |
| TurningWheel-Barony `962a5ce` | BSD 2-Clause | permissive-adapt | shapes only (no code pasted) |
| openmw `71fc0a4a` | GPL-3.0 | GPL-behaviour-only | behaviour in our words, no code |
| exult-exult `0e3cd67` | GPL-2.0 | GPL-behaviour-only | same |
| xu4-engine-u4 `6a7ee3d` | GPL-3.0 | GPL-behaviour-only | same |
| gemrb-gemrb `fb5bf56` | GPL-2.0 | GPL-behaviour-only | same |
| xoreos-xoreos `6774724` | GPL-3.0 | GPL-behaviour-only | same |
| OpenEnroth-OpenEnroth `860bf44` | LGPL-3.0 | copyleft, treated as behaviour-only | same |
| vcmi-vcmi `c251cd6` | GPL-2.0 | GPL-behaviour-only | same |
| ihhub-fheroes2 `9754fef` | GPL-2.0 | GPL-behaviour-only | same |
| OpenDiablo2 `7f92c57` | GPL-3.0 | GPL-behaviour-only | same |
| EQEmu `4aceae18` | GPL-3.0 | GPL-behaviour-only | same |
| ModernUO `261ea01a` | GPL-3.0 | GPL-behaviour-only | same |
| crawl-crawl `43d89d9` | GPL-2.0 or later | GPL-behaviour-only | same |
| CleverRaven-Cataclysm-DDA `074aa98` | CC BY-SA 3.0 (code and data) | share-alike, treated as behaviour-only | no rows or text copied |
| wesnoth-wesnoth `9ec35a2f` | GPL-2.0 | GPL-behaviour-only | same |
| rathena-rathena `d4b8e7b` | GPL-3.0 | GPL-behaviour-only | same |
| otland-forgottenserver `1561fa9` | GPL-2.0 | GPL-behaviour-only | same |
| ryzom-ryzomcore `5fed1e3` | AGPL-3.0 | GPL-behaviour-only (strictest) | same |
| 0ad-0ad `61a3b950` | `LICENSE.txt` plus GPL-2.0 text beside it; per PINS code GPL-2.0, art CC BY-SA | GPL-behaviour-only | same |

Games whose engines ship without game data (OpenMW, Exult, GemRB, OpenEnroth, xoreos, OpenTESArena, OpenDiablo2): only the schemas, loaders and AI code were read. Public references (UESP for Morrowind and Daggerfall, the Ultima and Infinity Engine wikis, the Aurora toolset documentation) are named as plain text where they would help a human; none was fetched in this pass.

## G. Proposed additive row fields (used by the "Becomes" lines below)

All optional. All additive to mobs.md section 7. None changes `src/` or the duel. Row owner decides names.

| Field | Meaning | Comes from item |
|---|---|---|
| `tier` | rung inside a family: `A`, `B`, `C` (or 1 to 5); same `family`, same rig, different `look`, `level`, `role` knobs | M1.1, M8.1 |
| `variantOf` | id of the base row a variant overrides (only the listed fields differ) | M1.1, M8.1 |
| `look.scaleJitter` | `[lo, hi]` per-instance size spread, seeded by slot | M1.3, M8.2 |
| `look.pool` | list of tint/body-pick alternatives drawn per spawn | M1.3, M8.2 |
| `idleSet` | weighted list of idle beats (`{beat, weight}`) | M2.8 |
| `curiosity` | `{ chance, seconds, retrySeconds }` for non-hostile approach | M2.7 |
| `triggers` | `{ anger?: [], fear?: [], placate?: [] }` named world triggers | M2.1 |
| `temperament` | `placid / wary / bold / savage`; shifts `behaviour.aggro` and parley | M2.5 |
| `bravery` | 0..1, shifts the flee-at point of a `beast` row inside Combat's allowed band | M2.6 |
| `mode` | named behaviour preset that expands to a bundle of `behaviour` fields | M2.4, M8.3 |
| `guild` | ecology tag (`wolfkin`, `ghoulkind`, `broodkind`) used for assist and rivalry | M2.3, M8.6 |
| `pack` | `{ leaderOf?: id, followers: [{ id, size:[min,max], chance }], minLevel?, natural?: bool }` | M3.2, M3.3 |
| `packRole` | `solo / alpha / follower / straggler` | M3.1, M3.2 |
| `spawn.curve` and `spawn.rarity` | `flat / semi / peak / rise / fall` over `level`, rarity 0..1000 | M4.1 |
| `spawn.tierOdds` | zone-level odds of A/B/C rungs | M4.2 |
| `spawn.window` | `{ phases?: [], seasons?: [], afterDay?, untilDay? }` | M4.6, M8.9 |
| `spawn.gate` | named zone counter and minimum value that must hold | M4.7 |
| `spawn.trigger` | `{ on: 'near' / 'far' / 'step', once?: bool, nocturnal?: bool, chance }` ambush markers | M4.8 |
| `class` | `normal / champion / named / boss / event` | M7.4 |
| `loot.named`, `loot.rare` | extra table ids for the named/champion/rare form of this row | M5.1 |
| `carries` | up to N slots `{ item, chance, qty }` that are both drop and visible gear | M5.2 |
| `harvest` | family-bound material drop (`hide`, `tusk`, `bone`, `claw`) | M5.3 |
| `conLabel` | `{ danger, occurrence }` words shown on the tap card | M6.1 |
| `placeholderOf` | id of the common row a rare form hides behind | M7.1 |
| `traits` | `[{ id, weight }]` per family: cosmetic/behavioural marks drawn per spawn | M8.7 |
| `ecology.foes` | list of `guild` tags this kind ignores or squabbles with (visual only) | M2.3, M8.6 |

Zone and group level knobs named in the items (also proposals): zone `dial` 0..5 (M4.2, M8.5), `spawn.highChance` (M4.5), `SpawnGroup.promote` and zone `championChance` (M7.5), `SpawnGroup` all-or-nothing flag (M4.3), zone `counters` (M4.7).

---

## M1. Roster and body types: beasts, monsters, humanoids; variety from few rigs

Ranked best first. mobs.md section 7 already fixes the one-row-one-kind shape and `family` = roster body; this section is about how many foes a body can carry.

**M1.1 Item: one family, a ladder of rungs that share a body (the "hound ladder")**
- **Best at:** Crawl lines a whole hound family up as five rows of one quadruped shape that differ by size class, speed, toughness, bite strength and one special per rung; the last rung adds a spell. UO does the same with its wolves: four wolf kinds share one AI and one pack tag, differ by body variants and by rolled ranges, and the top wolf is roughly double the health and 2 to 3 times the bite. TFS carries eight wolf rows (winter, war, ghost, gloom, starving, thornfire, crystal) that differ by outfit, speed, health and elemental leanings only.
- **Source:** crawl-crawl `crawl-ref/source/dat/mons/hound.yaml`, `wolf.yaml`, `warg.yaml`, `hell-hound.yaml` (genus and size fields); ModernUO `Projects/UOContent/Mobiles/Animals/Canines/{GreyWolf,TimberWolf,DireWolf,WhiteWolf}.cs`; otland-forgottenserver `data/monster/monsters/{wolf,war_wolf,winter_wolf}.xml`.
- **Verdict:** TAKE. A ladder is pure data and needs no new rig; the duel numbers behind each rung are Combat's.
- **Becomes:** `family` shared; `tier`, `variantOf`, `level`, `role`, `look.scale`, `look.tint`, `look.gear` per rung; one `pack` rule per family.

**M1.2 Item: a three-rung A/B/C naming per family, not per creature**
- **Best at:** Might and Magic keeps every monster in three tiers named by suffix (A, B, C); the world placement names only the family and a per-zone dial picks the rung, so a designer places "wolf" and the zone decides which wolf (see M4.2).
- **Source:** OpenEnroth `src/Engine/Objects/Actor.cpp` (the encounter spawner, A/B/C suffix selection) and `src/Engine/Objects/Monsters.h` (the row struct).
- **Verdict:** TAKE. It is the cheapest way to make a family span levels; our rows already carry `level`.
- **Becomes:** `tier: 'A'|'B'|'C'`, `family`, `level: [lo,hi]`; generator kit "family ladder": three rows from one template, each overriding `level`, `look`, `role`.

**M1.3 Item: free visual spread: size jitter, palette pool, body-pick pool**
- **Best at:** Gothic stores a per-individual model scale (three axes) and fatness on every creature record, so one mesh reads as many animals. Diablo 2 holds a palette index per monster and ships eight palettes per animation token, so the same sprite becomes a sick, a frozen, a burnt version. UO picks a body at random from a short list for one species (grey wolves have two bodies). Arena keeps a per-creature scale and vertical offset in its creature table.
- **Source:** ZenKit `include/zenkit/vobs/Misc.hh` (`VNpc` model_scale, fatness, overlays); OpenDiablo2 `d2core/d2records/monster_stats_record.go` (palette index field); ModernUO `GreyWolf.cs` (random body from list); afritz1-OpenTESArena `OpenTESArena/src/Entities/CreatureDefinitionLibrary.h` (scale, yOffset).
- **Verdict:** TAKE. Zero combat impact; ties straight into mobs.md 7.5.1 tint-contrast and 1.3 con ring.
- **Becomes:** `look.scaleJitter`, `look.pool`, `look.tint`, `look.dressing`; validator rule "every pooled tint passes tint-contrast".

**M1.4 Item: overlays and "dressing" as the second axis on a rig**
- **Best at:** Gothic separates the body from what is layered on it: each creature record lists animation/visual overlays, so a base rig takes different movement sets and looks. Wesnoth likewise separates a race (a family label shared by many unit types) from the unit type. A rig plus 3 to 6 dressings (soot, burnt, moss, frost, bone) is how a small art budget gets a large roster.
- **Source:** ZenKit `include/zenkit/vobs/Misc.hh` (`VNpc` overlays); wesnoth-wesnoth `data/core/units/goblins/Wolf_Rider.cfg` (race line).
- **Verdict:** ADAPT. Our `look.dressing` already exists as `{soot, burnt}`; widen it to a small named set, additive, owner Characters.
- **Becomes:** `look.dressing` extended with named layers; row-level `look.gear` unchanged.

**M1.5 Item: shape vocabulary instead of per-creature animation sets**
- **Best at:** Crawl tags every monster with one of about twenty-five body shapes (quadruped, tailless quadruped, winged quadruped, snake, insect, arachnid, blob, orb ...), and uses the shape for messages and logic. Daggerfall splits movement behaviour into five kinds (ground, flying, aquatic, spectral, guard) and keeps one animation sheet layout for all. The pattern: a small closed list of body shapes drives the rig choice, so a new creature picks a shape rather than inventing a skeleton.
- **Source:** crawl-crawl `crawl-ref/source/mon-enum.h` (body shape list); daggerfall-unity `Assets/Scripts/DaggerfallUnityEnums.cs` (behaviour kinds), `Assets/Scripts/Utility/EnemyBasics.cs` (one animation layout, many records).
- **Verdict:** TAKE. This is exactly the shape of the first body-family batch in M9.
- **Becomes:** `family` constrained to a closed shape list (`lean-quad`, `heavy-quad`, `serpent`, `arachnid`, `biped-large`, `biped`); validator `family-no-look` already enforces a look per family.

**M1.6 Item: affinity/kind tag per creature (animal, undead, daedra, golem, water, human)**
- **Best at:** Daggerfall tags each enemy with an affinity and a team; EQ tags a body type (humanoid, undead, giant, animal, insect, plant, dragon ...). The tag drives grouping, special weapons and resistances in those games. For us the tag is the one-word "what is it" on the card and the key for ecology (M2.3) and harvest (M5.3).
- **Source:** daggerfall-unity `DaggerfallUnityEnums.cs` (`MobileAffinity`, `MobileTeams`); EQEmu `common/bodytypes.h`.
- **Verdict:** ADAPT. Keep the tag as presentation and ecology; do not let it open a damage-type system (that would be a combat change).
- **Becomes:** `guild` (ecology tag) plus a `kind` word on `conLabel`; no stat effect.

**M1.7 Item: size-class word per row (small, medium, large) driving ring radius and pack spacing**
- **Best at:** Crawl and rathena both have a size class on every row; it decides what can stand next to what. For a tap game it decides ring radius, nameplate height and camera nudge.
- **Source:** crawl-crawl `crawl-ref/source/dat/mons/*.yaml` (size field); rathena-rathena `db/re/mob_db.yml` header comments (Size and Race fields).
- **Verdict:** TAKE. Pure presentation; pairs with `look.scale`.
- **Becomes:** `size` derived from `look.scale` at validation (no new authored field), read by the ring and waiting-ring code (mobs.md 5.5).

---

## M2. AI and perception (aggro, leash, assist, flee)

mobs.md sections 2 (noticing, alert beat, hear radius, fight-noise pull, social pull, give up and leash) and 5.6 (animals flee at low health) decide most of this. Items below are what those sections do not cover.

**M2.1 Item: anger, fear and placate triggers as a data list per kind (the "why does it turn hostile" list)**
- **Best at:** Cataclysm describes hostility as three short lists on the monster: what makes it angry (being stalked, a friend attacked, a friend died, the player looking weak, the player close, the player near its young), what makes it afraid (sound, fire, being hurt, friend died) and what calms it (carrying food it likes). One row therefore expresses a shy deer, a bold wolf and a bribable bear without code.
- **Source:** CleverRaven-Cataclysm-DDA `data/json/monsters/mammal.json` (wolf row: anger and flag lists), `data/json/monsters/bird.json` (fear lists).
- **Verdict:** ADAPT. World layer only: triggers move the creature between `idle`, `suspect`, `hunt`, `flee-and-return`; the fight stays the duel. "Player looks weak" maps to mobs.md 1 con bands (a grey kill never hunts).
- **Becomes:** `triggers.anger/fear/placate` (closed vocabulary of about 8 words), read by the state machine of mobs.md 0.5; `behaviour.engage`.

**M2.2 Item: witnessed death shifts neighbours' nerve (pack morale)**
- **Best at:** Infinity Engine gives each creature a morale number and a "morale break" line. When a creature dies, everyone within view range loses a point if it was their own kind, and enemies gain two. When morale falls to the break line the creature panics (run, berserk or freeze, mostly run) and recovers as morale climbs. A pack therefore breaks when its leader falls, and a camp near a fight grows bolder.
- **Source:** gemrb-gemrb `gemrb/core/Scriptable/Actor.cpp` (morale handler, panic handler, died-trigger broadcast to neighbours).
- **Verdict:** ADAPT. The panic is the existing `fled` outcome and the rally rule of mobs.md 5.6; the new part is that a *felled camp-mate* nudges `bravery` of neighbours for a short window. No dice: use a deterministic count (deaths seen against a threshold).
- **Becomes:** `bravery` plus a world rule "each camp-mate felled within view lowers neighbours' flee-at slack for `windowSeconds`"; `pack.natural` leaders make the effect larger.

**M2.3 Item: ecology guild table (who ignores whom, who is prey)**
- **Best at:** Gothic keeps a square guild-by-guild attitude table consulted for creature-to-creature relations (wolf guild is hostile to humans, neutral to its own); UO keeps explicit "opposition groups" (two lists of creature kinds that fight each other, e.g. one insect-folk against one serpent-folk); Ryzom marks fauna as herbivore or predator and has a corpse-eating activity. The shared idea: a short list of `guild` tags and a tiny relation table gives a believable ecology with no per-pair work. `gothic-guilds-attitudes.md` already specs the table for NPCs; this item is the creature-only slice.
- **Source:** OpenGothic `common/game/gamescript.cpp` (guild attitude lookup); ZenKit `include/zenkit/SaveGame.hh` (42 by 42 attitude matrix); ModernUO `Projects/UOContent/Mobiles/AI/OppositionGroup.cs`; ryzom-ryzomcore `ryzom/server/src/ai_share/ai_types.h` (herbivore/predator type).
- **Verdict:** ADAPT. Creature-versus-creature scuffles are visual world dressing (two camps squabble, a ghoul eats a felled scavenger); they never become a second combat engine and never touch the duel.
- **Becomes:** `guild`, `ecology.foes` (list of guild tags); a presentation-only `corpse eater` idle for `guild` carrion kinds.

**M2.4 Item: behaviour as named presets over a flag bundle**
- **Best at:** rAthena stores monster behaviour as about 25 independent switches (can move, aggressive, assists same kind, looter, never random-walks, changes target when hit, targets only weaker foes, detects hidden, ...), then publishes a table of about 20 named presets that expand to a bundle ("passive", "aggressive, assist", "plant: immobile, no attack"). Rows pick a preset; odd rows set the bits directly. 0 A.D. does the same with a template chain: a base fauna template, a wild/hunt branch, then one-line leaves that set only the stance (violent, aggressive, defensive, passive-defensive, passive, skittish).
- **Source:** rathena-rathena `doc/mob_db_mode_list.txt`; 0ad-0ad `binaries/data/mods/public/simulation/templates/template_unit_fauna*.xml`.
- **Verdict:** TAKE (presets), SKIP (the "change target when hit", "random target" bits: they are target-pick rules of a tab-target engine, not tap).
- **Becomes:** `mode` = a preset id that expands to `behaviour.{aggro,viewHalf,hearRadius,leash,roam,engage}` and `triggers`; presets live in one table; rows override single fields.

**M2.5 Item: temperament and a pre-fight parley (menace, not dice)**
- **Best at:** Heroes gives every wandering stack a temperament from compliant to savage and, when the hero walks up, compares the two armies' strength and the hero's diplomacy to decide: fight, flee, or join (sometimes for gold). It is the only place a roaming monster is allowed to "decline" to fight you. For us a weak hero is already handled by con bands; the portable part is that **temperament shifts the aggro ring and the decline behaviour**, so two rows of one body behave differently.
- **Source:** vcmi-vcmi `lib/mapObjects/CGCreature.h` and `CGCreature.cpp` (character enum and the strength/disposition comparison). fheroes2 was not read for this item.
- **Verdict:** ADAPT. "Join" is out (no recruitment); "flee instead of fight when badly outmatched" is the part we keep, driven by con band, not by a roll.
- **Becomes:** `temperament`; scales `behaviour.aggro` and sets whether a grey/green kind turns and walks away instead of hunting (mobs.md 2.2 already bars grey from hunting).

**M2.6 Item: bravery as a number combined with health (flee point per row)**
- **Best at:** Morrowind gives every creature two 0 to 100 sliders, fight and flee, and evaluates flee as "missing health times a weight plus the flee slider times a weight"; at or above 100 it always runs. Same machinery gives a coward that runs at the first scratch and a stubborn beast that never runs. M&M offers four fixed classes (never runs, always runs, runs at a fifth of health, runs at a tenth).
- **Source:** openmw `apps/openmw/mwmechanics/aicombataction.cpp` (flee rating); `components/esm3/aipackage.hpp` (the fight/flee/alarm bytes); OpenEnroth `src/Engine/Objects/MonsterEnums.h` (AI type classes).
- **Verdict:** ADAPT. mobs.md 5.6 already fixes `fleesNow` below 30 percent for `beast` and "never" for named. Allow a row to pick one of three rungs inside Combat's band (`bravery`), still deterministic.
- **Becomes:** `bravery` mapped to `MOB_STYLE.beast.fleeBelow` offsets (Combat's table), never above Combat's cap.

**M2.7 Item: curiosity for non-hostile animals (the approach-and-sniff beat)**
- **Best at:** Ryzom's fauna AI includes a "curiosity" activity: a passive animal walks toward a nearby player, lingers for tens of seconds with a short "say hello" beat, then returns to grazing and will not repeat for a few minutes. It is the cheapest "the world notices me" effect and costs one timer.
- **Source:** ryzom-ryzomcore `ryzom/server/src/ai_service/ai_profile_fauna.cpp` and `.h` (curiosity profile and its timers).
- **Verdict:** ADAPT. Pure presentation: deer-like and hound-pup kinds approach, never fight; hostile kinds ignore it. Optional.
- **Becomes:** `curiosity: { chance, seconds, retrySeconds }`; used by `placid` and `wary` temperaments only.

**M2.8 Item: weighted idle beats (it fidgets differently each time)**
- **Best at:** Morrowind's wander package carries eight idle-animation weights per creature or NPC: how likely each fidget is while standing. Cheap, and it makes a standing camp look alive.
- **Source:** openmw `apps/openmw/mwmechanics/aiwander.cpp` (idle table), `components/esm3/aipackage.hpp` (wander block).
- **Verdict:** TAKE. It is exactly mobs.md section 3 "idle" with weights instead of a fixed loop.
- **Becomes:** `idleSet: [{beat, weight}]` (rig supplies 2 to 4 beats: scratch, sniff, look-up, shake).

---

## M3. Roles, packs, leaders and followers

mobs.md 5.3 decides the four duel roles (`brute`, `skirmisher`, `caster`, `beast`) and 3.3 decides camps of 2 to 3. This section is about composition.

**M3.1 Item: UO's four AI roles (melee, archer, mage, animal)**
- **Best at:** UO splits creatures by what they do in a fight, with separate "move toward and hit", "keep range", "keep range and cast", and "skittish, runs when hurt" behaviours.
- **Source:** ModernUO `Projects/UOContent/Mobiles/AI/{MeleeAI,ArcherAI,MageAI,AnimalAI}.cs`.
- **Verdict:** decided in mobs.md section 5.3 (the four kinds and their world approach); here SKIP as already absorbed. The only extra is `packRole` (below).
- **Becomes:** `role` (existing); `packRole` for pack position.

**M3.2 Item: leader with a bounded follower band and a start condition**
- **Best at:** Crawl attaches to a leader kind (a) a chance for a band to exist at all, (b) a minimum depth, (c) the follower kind(s) chosen with equal weight, (d) a follower count range that excludes the leader, and (e) a flag marking a "natural leader" so kills credit it. Special leaders override per branch. One row of config makes "a warchief with 2 to 5 orcs" without a camp editor.
- **Source:** crawl-crawl `crawl-ref/source/mon-place.cc` (band tables, band choice function).
- **Verdict:** TAKE. Fits the zone generator: the leader row owns the `pack` rule; followers are normal rows.
- **Becomes:** `pack: { followers:[{id,size:[2,5],chance}], minLevel, natural }`, `packRole: 'alpha'` on the leader; the camp size cap of mobs.md 3.3 stays the hard limit (campSize 1 to 3), so follower counts are clipped to it unless a row declares `campSize` larger and Dom approves.

**M3.3 Item: minions and group sizes on the base row (Diablo packs)**
- **Best at:** Diablo 2 puts group rules on the base record: a minimum and maximum number of the same kind spawned together, up to two minion kinds with a party min and max, a sparse-population percentage that thins a kind out, and a "next in class" pointer so a map picks the right rung for its area level. Champion packs then add random modifiers on top (see M7.2).
- **Source:** OpenDiablo2 `d2core/d2records/monster_stats_record.go` (group min/max, minion fields, population reduction, next-in-class, rarity).
- **Verdict:** TAKE (group size and minion fields), ADAPT (next-in-class as the generator picking the rung by zone level).
- **Becomes:** `pack.followers`, `campSize`, `spawn.rarity`, `tier` + `variantOf` chain; generator kit "pack kit" (leader + 1 to 2 follower kinds).

**M3.4 Item: group size shrinks as the rung climbs; size words on the card**
- **Best at:** Heroes sets the default neutral stack size from the creature's tier (weak tiers come in dozens, strong tiers in single digits) with a few named outliers. One rule yields believable crowd sizes with no per-row tuning.
- **Source:** ihhub-fheroes2 `src/fheroes2/monster/monster.cpp` (random size by tier with overrides).
- **Verdict:** ADAPT. Use as the generator default for `campSize` by `tier` (low rung 3, middle 2, top 1) with row override.
- **Becomes:** `campSize` default function of `tier`; validator warns when a top rung has `campSize` above 1.

**M3.5 Item: followers keep a formation behind the leader**
- **Best at:** Barony keeps a formation shape for allied followers: it tracks melee and ranged followers separately, hands out slots relative to the leader, recomputes them when the leader moves, and reassigns a follower whose path fails. A pack that *moves* in a readable shape (alpha forward, followers staggered) is a strong silhouette on a small screen.
- **Source:** TurningWheel-Barony `src/actmonster.cpp` and `src/monster.hpp` (ally formation shape and slot assignment).
- **Verdict:** ADAPT. Presentation of a pack on the move and when circling in the waiting ring of mobs.md 5.5; not a combat feature.
- **Becomes:** `packRole` (alpha/follower/straggler) read by the waiting ring offsets; generator kit "wolf pack" gives alpha 0 m, followers at fixed offsets behind and to the side.

**M3.6 Item: follower variants (the leader's followers are weighted)**
- **Best at:** Barony's monster definitions list follower variants with weights, so a leader's retinue is itself variable (mostly plain, sometimes a named elite). Shows a second place variety can hide: inside the pack, not the individual.
- **Source:** TurningWheel-Barony `src/mod_tools.hpp` (follower variants list and its weighted pick).
- **Verdict:** TAKE. Weighted follower list already falls out of `pack.followers` with `chance`.
- **Becomes:** `pack.followers[].chance`; generator draws the retinue from the seeded stream of mobs.md 4.3.

**M3.7 Item: wolf-rider style linked kinds (a rider and its mount fight as one)**
- **Best at:** Wesnoth treats a goblin on a wolf as one unit (race wolf, its own advancement choices). For our duel a "rider" is one humanoid-on-quadruped opponent; the duel engine is single-opponent.
- **Source:** wesnoth-wesnoth `data/core/units/goblins/Wolf_Rider.cfg`.
- **Verdict:** SKIP for now. A two-body opponent is a rig and combat question for Characters and Combat; park until the first body-family batch (M9) has shipped.
- **Becomes:** nothing now; a `look.gear` slot "mount" reserved by name only.

---

## M4. Spawn: camps, placeholders, rares, levelled lists, respawn, region and day/night

mobs.md 4 decides slots, spawn groups, weights, respawn window, refusal rules, persistence; 3.4 decides day/night-lite. This section adds *how the list of candidates is built and shaped*.

**M4.1 Item: five rarity curves over depth/level (flat, semi, peak, rise, fall)**
- **Best at:** Crawl gives each monster-in-region entry a range, a rarity from 0 to 1000 and a curve shape: full weight across the range (flat), half weight at the ends (semi), zero outside and full in the middle (peak), growing with depth (rise), shrinking (fall). Weights are re-evaluated at each depth, so a kind fades in and out and the roster drifts smoothly instead of switching on at a level.
- **Source:** crawl-crawl `crawl-ref/source/random-pick.h` (curve function), `mon-pick-data.h` (entries).
- **Verdict:** TAKE. The weight is data and the pick is the existing seeded draw of mobs.md 4.3. Zero combat impact.
- **Becomes:** `spawn.curve`, `spawn.rarity`, `level:[lo,hi]` on each `SpawnGroup.entries[]`; mobs.md 4.2 entry fields `weight` is the rarity at the middle of the band.

**M4.2 Item: zone dial picks the rung (the A/B/C odds table)**
- **Best at:** Might and Magic gives each map up to three encounter families, each with a count range, and one "difficulty setting" (six values) per family indexing a small table of rung odds: setting zero is all A, the top setting leans to C. Individual spawn points can also force a rung. Designers tune danger by one number per family per map.
- **Source:** OpenEnroth `src/Engine/Objects/Actor.cpp` (spawn of an encounter: count range, difficulty set, forced-rung variants).
- **Verdict:** TAKE. Maps onto `zone.difficulty` and `generateZone` varying a single dial.
- **Becomes:** `spawn.tierOdds` per zone (or a zone `dial` 0..5 expanded by a table), `tier` on rows, `campSize`; a spawn point may name a forced `tier`.

**M4.3 Item: spend a danger budget, not a headcount (the party-level budget)**
- **Best at:** Infinity Engine spawn points list creatures, a difficulty multiplier, a maximum and a day chance and night chance. The spawner keeps adding creatures until the sum of their experience values reaches multiplier times party level (always at least one), or the maximum is hit. After a trigger the point waits a frequency, and re-arms **only if the party cannot see it and has moved off**. A named *spawn group* is "all or nothing": the whole listed band appears or none.
- **Source:** gemrb-gemrb `gemrb/core/Map.h` (spawn point fields), `gemrb/core/Map.cpp` (trigger spawn, re-arm rule, spawn group load and the rest-interruption budget).
- **Verdict:** ADAPT. Budget spawning is a good *generator* method (fill a camp until its danger sum matches the zone dial); at runtime mobs.md 4.5 already refuses in view and near. Do not scale to the hero's level: our zones have fixed level bands.
- **Becomes:** generator kit "camp budget": `sum(danger(row)) <= zone.dial * campBudget`, with `danger(row)` = the con-gap payout `falloffPermille` weight or the row's `level`; spawn-group "all or nothing" flag on `SpawnGroup`.

**M4.4 Item: levelled lists that nest, with a "chance of nothing"**
- **Best at:** Morrowind's creature lists hold entries of (creature or another list, minimum level) plus a chance that the list yields nothing. A pick takes either every entry the player's level qualifies for, or only those at the highest qualifying level (a flag), and recurses into nested lists. A region may also name a "sleep" list: when the player rests outdoors there, a roll scaled by the hours slept can wake them partway with a creature from that list. It is the origin of the levelled-list idiom.
- **Source:** openmw `apps/openmw/mwmechanics/levelledlist.cpp` (pick), `components/esm3/loadlevlist.hpp` (flags, chance-none), `components/esm3/loadregn.hpp` and `apps/openmw/mwgui/waitdialog.cpp` (region sleep list). Public reference: UESP "Morrowind: Leveled Lists" (plain text only).
- **Verdict:** ADAPT. Our levels are fixed per zone, so the nesting and chance-of-nothing are the useful parts; "player level qualifies" is replaced by the zone band. A "rest ambush" is a spawn marker (M4.8), only if the game has a rest verb.
- **Becomes:** `SpawnGroup.entries[]` may hold a `group` reference (nested), `chanceNone` per group, `levelMin` per entry; generator flattens nesting at build time.

**M4.5 Item: a sliding window over a danger-ordered list (Daggerfall's twenty-slot ladders)**
- **Best at:** Daggerfall defines a 20-slot list per dungeon type (and per climate by day/night outdoors) *ordered from weakest to strongest*, with repeats for weighting. A pick takes a random slot in a window around the player's level (three below to three above); on roughly 15 picks in 100 the window widens to everything up to level plus one; on roughly 5 in 100 it may reach any slot (a very low-level player is capped a little above their level). Only the slot index depends on level, so authoring is "order the list".
- **Source:** daggerfall-unity `Assets/Scripts/Utility/RandomEncounters.cs` (tables and `ChooseRandomEnemy`).
- **Verdict:** ADAPT. Keep the data idea (one ordered list per habitat, repeats = weight, small chance of a rare-high slot) as a compact way to author a habitat; drive the window from the zone band rather than the player.
- **Becomes:** `habitat` list per zone template; ordered `entries[]` with `weight`; a `spawn.highChance` zone knob (default small).

**M4.6 Item: nested groups with seasons, day/night and "starts after / ends before" windows**
- **Best at:** Cataclysm's monster groups nest other groups, each entry with a weight, a pack size range, a cost multiplier, a set of conditions (season, time of day) and optional start and end day offsets. The same region spawns a different roster in spring versus winter or in the first weeks versus later.
- **Source:** CleverRaven-Cataclysm-DDA `data/json/monstergroups/wilderness.json`, `mammal.json`, `amphibian.json`.
- **Verdict:** ADAPT. We have day/night-lite (mobs.md 3.4) and a "light seasons" idea in `living-world.md`; the data shape is what is new. Do not copy rows.
- **Becomes:** `spawn.window: { phases, seasons, afterDay, untilDay }` on entries; `pack_size` becomes `pack.followers[].size`.

**M4.7 Item: world-state counters that switch a spawn on or off**
- **Best at:** EQEmu lets a spawn point depend on a named counter in the zone (day/night, an event stage, "was the boss killed"), and lets timed events set, add or multiply those counters; a change can despawn, repop or send a signal. One counter drives a whole class of dependent spawns.
- **Source:** EQEmu `zone/spawn2.h` and `zone/spawn2.cpp` (spawn condition and spawn event classes).
- **Verdict:** ADAPT. A zone `flags` map set by the World lane (feud outcomes, rifts of `living-world.md`) can gate spawns; it is data-only.
- **Becomes:** `spawn.gate: { counter, min }`; zone-level `counters` owned by World.

**M4.8 Item: trigger markers (U7 "eggs") for ambushes, once-only and night-only**
- **Best at:** Ultima VII spawns monsters from invisible trigger objects ("eggs") with a trigger kind (avatar near, party near, avatar steps on, avatar leaves, on load), a chance, a once flag, a nocturnal flag and auto-reset. It is how U7 does the ambush on the road and the "something in the crypt wakes".
- **Source:** exult-exult `objs/egg.h` and `objs/egg.cc` (egg criteria and flags, monster egg type).
- **Verdict:** ADAPT. Gives authored set-pieces a small shape: where, when, how often. Spawn group stays the baseline; trigger markers add the surprise. Must obey mobs.md 4.5 (never in view).
- **Becomes:** `spawn.trigger: { on, once, nocturnal, chance }` on a `SpawnGroup`.

---

## M5. Loot tables

mobs.md 6 decides: con gate (grey drops nothing), category-matrix authoring shortcut, global pools, level gates on entries, seeded-at-kill rolls, anti-farm via respawn. `eqemu-loot.md` is the table model. Items below add shapes mobs.md does not carry.

**M5.1 Item: separate tables for normal, champion, unique and quest forms of one kind**
- **Best at:** Diablo 2 gives each monster record four treasure-class slots (ordinary, champion, unique, quest) and a separate set for each of three difficulties. The base kind stays one row; the *form* it appears in decides how rich the drop is. That is how a pack leader out-drops its followers with no new row.
- **Source:** OpenDiablo2 `d2core/d2records/monster_stats_record.go` (treasure class fields), `d2core/d2records/difficultylevels_record.go`.
- **Verdict:** TAKE. Matches mobs.md 6.3 and 7 (`loot` per row) and extends it for variants.
- **Becomes:** `loot` (normal), `loot.named`, `loot.rare`; selected by `class` (M7.4).

**M5.2 Item: what it carries is what it wears (one list, both drop and look)**
- **Best at:** Ultima VII keeps a ten-slot equipment record per monster (item shape, probability, quantity) that is both what spawns on it and what it drops; Barony's monster definition lists item slots with a spawn chance, a drop chance and a slot weight. A bandit with a helm *looks* like a bandit with a helm and drops that helm at the stated chance. It ties the visual roster to the loot roster.
- **Source:** exult-exult `shapes/shapeinf/monstinf.h` (equipment elements and records); TurningWheel-Barony `src/mod_tools.hpp` (item slot entries with spawn percent, drop percent, slot weight).
- **Verdict:** ADAPT. Fits `look.gear` (cosmetic) plus `loot`: the `carries` list is the single source and the compiler produces both `look.gear` and a `LootTable` fragment. Shown gear that never drops is a defect; keep them in step.
- **Becomes:** `carries: [{item, chance, qty}]`; compiled into `look.gear` and `loot` at build time; validator `loot-tier` still applies.

**M5.3 Item: family-bound harvest (hide, tusk, bone, claw) as a second, guaranteed-style drop**
- **Best at:** UO tags creatures with a meat type, a hide type (regular, spined, horned, barbed) and, for dragons, a scale colour; Cataclysm's carcasses have harvest tables bound to the kind (a wolf yields fur and a skull). Beasts then feel like animals rather than coin machines, and crafting inputs come from families, not from random tables.
- **Source:** ModernUO `Projects/UOContent/Mobiles/BaseCreature.cs` (meat, scale, hide enums); CleverRaven-Cataclysm-DDA `data/json/monsters/mammal.json` (harvest id on the wolf row).
- **Verdict:** ADAPT. Only if the economy lane wants material drops; it is a loot-table fragment bound by `family`. No combat effect.
- **Becomes:** `harvest` (one id per family), compiled to a `LootTable` roll after the creature's own; subject to the con gate (grey yields nothing).

**M5.4 Item: zone-level drops and per-kind-in-zone drops**
- **Best at:** rAthena keeps a map-drop file where each map has "drops for every monster on this map" and "drops for specific monsters on this map", both unaffected by server drop rates. A zone can have a signature item without editing any monster.
- **Source:** rathena-rathena `db/map_drops.yml` and its header comment.
- **Verdict:** decided in mobs.md section 6.3(c) (global pools with filters); the per-kind-in-zone case is the same filter with `character` and `zone`. SKIP as duplicate.
- **Becomes:** existing `global-loot` content row.

**M5.5 Item: chance and count per drop line, with a "fixed, ignore modifiers" flag**
- **Best at:** TFS puts, on each monster, a list of drop lines each with a chance and a maximum count, and its bestiary block has a danger word. rAthena has a "fixed item drop" mode that ignores rate modifiers. Shows the minimum useful row: chance, qty, immune-to-boost.
- **Source:** otland-forgottenserver `data/monster/monsters/wolf.xml` (loot and bestiary blocks); rathena-rathena `doc/mob_db_mode_list.txt` (fixed drop bit).
- **Verdict:** decided by `eqemu-loot.md` and mobs.md 6.2 (`rolls[]`, `probability`, `quantity`); SKIP as duplicate. The fixed-drop flag maps to "named drops ignore patron luck", which belongs to the Luck lane.
- **Becomes:** nothing new.

**M5.6 Item: coin ranges and category chance matrix from the exe tables**
- **Best at:** Daggerfall's loot table key per enemy plus a per-category chance matrix.
- **Source:** daggerfall-unity `Assets/Scripts/Game/Items/LootTables.cs`.
- **Verdict:** decided in mobs.md section 6.3(b). SKIP as duplicate.
- **Becomes:** existing category-matrix compile step.

---

## M6. Con and difficulty readability

mobs.md 1 decides the seven-band con colour from `falloffPermille`, the dash-count ring, the threat bar, and the night ground light. Items add *words and shapes* on the tap card and nameplate.

**M6.1 Item: two plain words on the card: danger and occurrence**
- **Best at:** TFS's per-monster bestiary block carries a danger word (the files use harmless, trivial, easy, medium, hard) and an occurrence word (common, uncommon, rare, very rare), plus a free location line. The tap card of a creature then answers "is this worth my time" and "how often will I see it" in two words, independent of colour.
- **Source:** otland-forgottenserver `data/monster/monsters/wolf.xml` and `war_wolf.xml` (bestiary block).
- **Verdict:** TAKE. The danger word is *derived* from the con band (never authored, so it cannot disagree with colour); occurrence is derived from `spawn.rarity` (M4.1). Words, not numbers.
- **Becomes:** `conLabel` computed at build: `{ danger: conBand(...), occurrence: bucket(spawn.rarity) }`; no authored field.

**M6.2 Item: group size as one word (Few, Several, Pack, Lots, Horde, Throng, Swarm, Zounds, Legion)**
- **Best at:** Heroes shows an army's size as a word from a ladder of nine, not a number, with a setting to show the number instead. At a glance it separates a pair of wolves from a pack.
- **Source:** ihhub-fheroes2 `src/fheroes2/army/army.cpp` (size string function and its nine buckets).
- **Verdict:** TAKE (a short ladder for a visible camp: Pair, Few, Pack, Horde), ADAPT (bucket edges to our camp max of 3 and leader packs).
- **Becomes:** `campSize` + `pack.followers` summed at spawn, bucketed on the nameplate of the leader; no authored field.

**M6.3 Item: named and elite forms look different at a glance (palette shift, name colour)**
- **Best at:** Diablo 2 changes the name colour of unique and champion monsters, and uses palette shifts to mark variants of one sprite. EQ's naming convention itself carries the cue: ordinary mobs have lower-case article names, named mobs are capitalised or carry a marker character, and the server uses that convention (plus a rare flag and a raid flag) to pick its stat template.
- **Source:** OpenDiablo2 `d2core/d2records/monster_stats_record.go` (palette id and hard-coded name colour note); EQEmu `zone/npc_scale_manager.cpp` (scaling type detection by name case, rare flag, raid flag).
- **Verdict:** TAKE. Already hinted at in mobs.md 1.2 ("named a double ring, elite a notched ring"); the name-case convention costs nothing.
- **Becomes:** `class` drives ring shape and name style; `name` case rule in the content validator (`named` => capitalised, no article).

**M6.4 Item: level pips and a role word (what it is, how deep it is)**
- **Best at:** Wesnoth marks every unit with its level and a "usage" word (scout, fighter, mixed fighter, archer, healer) so the roster is legible in a list; a unit's race gives the family label.
- **Source:** wesnoth-wesnoth `data/core/units/goblins/Wolf_Rider.cfg` (level, usage, race lines).
- **Verdict:** ADAPT. Our `role` (`brute`, `skirmisher`, `caster`, `beast`) is the usage word; showing it on the card costs a label.
- **Becomes:** card shows `role` + `tier` rung (I, II, III); nothing authored.

**M6.5 Item: three-tag chip: body shape, size, kin**
- **Best at:** rAthena's roster rows carry small tags (size, race, secondary race groups, element) that players use to judge a foe before engaging.
- **Source:** rathena-rathena `db/re/mob_db.yml` (header comments describing Size, Race, RaceGroups, Element).
- **Verdict:** ADAPT. Keep size and kin (`guild`); drop element (damage types are a combat-system question, SKIP).
- **Becomes:** card chip from `size` (M1.7) and `guild` (M2.3).

---

## M7. Named and rare mobs

mobs.md 4.2 has a `rare` flag on spawn entries and 7.5 forbids generating `named` rows. `modernuo-champion-spawns.md` covers the multi-wave champion encounter; not repeated.

**M7.1 Item: placeholder plus rare (the EQ "PH / named" camp)**
- **Best at:** EQ camps are ordinary spawn groups where one entry has a small chance to be the named creature instead of the common one; the common stand-in is the "placeholder". Players learn to camp, the named drop is a real event, and no new content system exists.
- **Source:** EQEmu `zone/spawngroup.cpp` (chance per entry), `zone/spawn2.cpp` (respawn window); the named detection rule is in `zone/npc_scale_manager.cpp`.
- **Verdict:** ADAPT. A named creature is an encounter (`named` rows are not generated, mobs.md 7.6). The placeholder pattern fits as: the generator places a *marker* that, with a small seeded chance and a long cooldown, swaps the common row for a fixed named encounter id. The named fight is still a duel.
- **Becomes:** `placeholderOf` on the named row; `SpawnGroup.entries[].rare` (existing) plus `limit: 1`; cooldown via `respawn.seconds` x multiple.

**M7.2 Item: champion packs and super-uniques (a random affix on a pack, a fixed boss with its own retinue)**
- **Best at:** Diablo 2 has three kinds: ordinary packs; champions, where a chance roll lifts a pack leader and gives the whole pack a modifier; and super-uniques, fixed named bosses defined with their own minions and placement. A property row lists which modifiers a kind may take.
- **Source:** OpenDiablo2 `d2common/d2enum/monumod_const_index.go` (champion chance and bonus constants), `d2core/d2records/monster_stats_record.go` (property key, minion fields).
- **Verdict:** ADAPT. Affixes that change fight numbers are Combat's (SKIP here). Affixes that change *behaviour or look* are free: "swift" (a longer lunge), "pale" (tint), "scarred" (named prefix). Keep to those; stat-moving affixes only after Pit proof.
- **Becomes:** `class: 'champion'`, `look.tint`, `behaviour.*`, `name` prefix from a closed list; `loot.named`.

**M7.3 Item: three stat templates by prominence (trash, named, raid), keyed by level**
- **Best at:** EQEmu has a base-stat template per (prominence, level): ordinary mobs, named/rare mobs, raid bosses. A row says only its level and prominence; the numbers come from the table. Variety without per-row tuning.
- **Source:** EQEmu `zone/npc_scale_manager.h` and `zone/npc_scale_manager.cpp`.
- **Verdict:** ADAPT. The idea matches `fightSetup(level)` plus Combat's role/`MOB_STYLE` tables; the prominence axis (`class`) is the new column. Numbers are Combat's, proven in the Pit.
- **Becomes:** `class` + `level` -> Combat's style/level tables; no stats in the row.

**M7.4 Item: a closed class enum on every row (normal, boss, guardian, event)**
- **Best at:** rAthena puts a class on every monster (default normal; the others include boss, guardian, event) and a separate mode flag for the top-end "MVP" kind that gets a visible marker and shared rewards. A single enum answers "what kind of thing is this" in one place.
- **Source:** rathena-rathena `db/re/mob_db.yml` (header comments, Class field), `doc/mob_db_mode_list.txt` (MVP mode).
- **Verdict:** TAKE (enum), SKIP (MVP shared-damage ranking: a multiplayer reward split, not a creature property).
- **Becomes:** `class: 'normal'|'champion'|'named'|'boss'|'event'`; `named` and `boss` rows are never generated (existing `named-generated`).

**M7.5 Item: a promotion roll with a kill-switch flag (Barony's "miniboss")**
- **Best at:** Barony can promote an ordinary monster to a stronger named form on spawn, and many spawn sites switch the chance off (summons, scripted fights). The kill-switch flag is the part to copy: a promotion roll must be disable-able per spawn site.
- **Source:** TurningWheel-Barony `src/stat.hpp` (the disable-promotion flag) and its set sites in `src/actmonster.cpp`, `src/actsummontrap.cpp`. The roll site itself was **not located** in this pass.
- **Verdict:** ADAPT, with the gap stated: the roll is unverified. Only the "per-site off switch" is claimed.
- **Becomes:** `SpawnGroup.promote: false` (default off) and a zone-level `championChance` knob.

---

## M8. Opponent diversity levers (new, important)

**Question:** how does each game make many distinct foes from few assets? Levers: (1) tier ladder or levelled list, (2) visual swap (palette, size, body pick), (3) named or champion variants, (4) faction/ecology, (5) behaviour sets, (6) resistances/weaknesses, (7) packs and leaders, (8) day/night or region spawns.

Legend: `##` the game leans on it hard, `#` present in the files read, `-` absent or not seen, `?` not verified (not read, or read too thinly to say). Cells are from the files named in the items, not from memory of the games.

| Game | 1 tier / levelled list | 2 visual swap | 3 named / champion | 4 faction / ecology | 5 behaviour sets | 6 resist / weak | 7 packs / leaders | 8 day-night / region |
|---|---|---|---|---|---|---|---|---|
| Morrowind (openmw) | ## nested levelled lists | # creature scale field | # fixed named by placement | # faction/disposition (sibling spec) | # fight/flee sliders, idle weights | ? | - | ## region sleep list, cell respawn |
| Daggerfall (DFU) | ## 20-slot ladders | # gender/texture swaps, sprite per record | - | # teams, affinity | # general/flying/aquatic/spectral | # metal-gated hits, affinity | # team | ## climate x day/night tables |
| Ultima VII (exult) | - | # shape per monster | # fixed | # alignment | # attack mode, can summon/teleport | ## vulnerable/immune bit masks | - | ## trigger eggs, nocturnal flag |
| Ultima IV (xu4) | ## tiles ordered weak to strong + era mask | # sprite per tile | - | # good/evil flags | ## ability flags (steals, divides, ambushes, camouflage) | - | - | ## by terrain tile, by moves elapsed |
| Gothic (OpenGothic/ZenKit) | - | ## per-model scale and fatness, overlays | # scripted | ## 42x42 guild table | # fight tactic, scripted states | # 8 protection slots | # guild | # respawn time per NPC |
| Infinity Engine (gemrb) | # spawn group by level | ? palette slots seen in the actor, not mined | # fixed | # enemy-ally axis | # morale break, panic | ? | # spawn groups all-or-nothing | ## day/night chance, rest spawns |
| Might and Magic (OpenEnroth) | ## A/B/C per family + zone dial | # | - | # hostility range classes | ## 4 AI types, 6 movement types | ## 11 resistance slots | # count range per family | # per-map encounter families |
| Heroes (vcmi, fheroes2) | ## upgrade chains | - | - | # faction | ## temperament + join/flee/fight | - | ## stack size by tier | - |
| Diablo 2 (OpenDiablo2) | ## base/next-in-class by area level | ## 8 palettes per token | ## champion, super-unique | # monster type group | # AI id + params | ## per-element resist | ## minions, group min/max | # per-difficulty versions |
| Arena (OpenTESArena) | ? level-keyed in map data (not verified) | # scale per creature | # final boss | - | # flags (ghost, disease chance) | ? | - | ? |
| EQ (EQEmu) | # spawn groups | # texture/size per row | ## named, placeholder, raid | ## faction | ## special-ability tag list (about 55) | ## per-element resist rows | # assist radius | ## spawn conditions and events, time windows |
| UO (ModernUO) | # | ## rolled stat ranges, body lists | # champion spawn (sibling spec) | ## opposition groups, pack instincts | ## 4 roles | ## 5 resistances | ## pack instinct | # spawner windows |
| Crawl | ## rarity curves by depth | - | ## uniques | # genus | # shape, ability sets | ## per-element | ## bands | # branches |
| Cataclysm DDA | ## nested groups | - | # | ## faction, species | ## anger/fear/placate lists | # armour types | ## pack_size | ## seasons, start/end day |
| Wesnoth | # advancement chains | # race pool | - | # race | # usage word | # movement types (not mined) | - | ## time-of-day alignment |
| Barony | ## per-biome weighted table | # | # promotion (unverified roll) | - | # | - | ## leader + follower variants | # per-level |
| rAthena | - | ? | # class boss/MVP | # race/size/element tags | ## mode bits + presets | # element field | # assist mode | # per-map drops |
| TFS | - | ## outfit id per variant row | # bosses | - | # flags (run on health, static attack, target distance) | ## per-element percentages | - | # raids, spawn radius |
| Ryzom | - | - | - | ## herbivore/predator | ## activity profiles | - | # herd groups | ? |
| 0 A.D. | - | - | - | - | ## stance leaf templates | - | # herd | - |

**M8.1 Item: tier ladder inside a family**
- **Best at:** Every game that builds a large roster from few rigs leans here: UO wolves, M&M A/B/C, Crawl's hound genus, D2's base-and-next chain, Wesnoth's advancement chains, TFS wolf variants. One body, 4 to 6 rungs, each rung moves level, size, tint, role, and one trait.
- **Source:** see M1.1, M1.2, M3.3; crawl-crawl `dat/mons/`, ModernUO `Mobiles/Animals/Canines/`, OpenEnroth `Actor.cpp`.
- **Verdict:** TAKE. Highest value-for-cost lever; no combat system change.
- **Becomes:** `tier`, `variantOf`, `level`, `role`, `look.*`; generator kit "ladder" (template -> 3 to 5 rows).

**M8.2 Item: free visual spread (scale jitter, tint pool, dressing, gear)**
- **Best at:** Gothic (per-model scale/fatness), D2 (eight palettes), UO (body lists), Arena (scale). Costs art once; combined with a ladder it gives 2 to 3 times the roster.
- **Source:** see M1.3, M1.4.
- **Verdict:** TAKE. Constrained by `tint-contrast` (mobs.md 7.5.1).
- **Becomes:** `look.scaleJitter`, `look.pool`, `look.dressing`, `look.gear` (via `carries`).

**M8.3 Item: behaviour presets (named bundles) instead of per-row tuning**
- **Best at:** rAthena presets, 0 A.D. stance leaves, M&M four AI types and six movement types, Cataclysm trigger lists. A preset gives readable *difference in play* (shy, bold, stalker, ambusher) for the price of one id.
- **Source:** see M2.1, M2.4; OpenEnroth `MonsterEnums.h`.
- **Verdict:** TAKE.
- **Becomes:** `mode`, `triggers`, `temperament`, `behaviour.*`.

**M8.4 Item: pack composition and leaders (what stands with it)**
- **Best at:** Crawl bands, D2 minions and champion packs, Barony follower variants, Heroes stack-by-tier. A pack makes the *encounter* different even if every body is the same.
- **Source:** see M3.2, M3.3, M3.6.
- **Verdict:** TAKE.
- **Becomes:** `pack`, `packRole`, `campSize`.

**M8.5 Item: zone dial and era dial (the same family reads differently by place and time)**
- **Best at:** M&M's per-map rung odds; Daggerfall's window over an ordered list; Ultima IV's "era" mask, which turns on harder rungs as the player's move count passes thresholds by AND-ing two random draws (weaker rungs stay more likely). One number per zone or per world-age yields a different mix.
- **Source:** OpenEnroth `Actor.cpp`; daggerfall-unity `RandomEncounters.cs`; xu4-engine-u4 `src/creature.cpp` (random creature for a tile; the era mask).
- **Verdict:** TAKE (zone dial), ADAPT (era dial as a World-owned "heat" knob tied to rifts in `living-world.md`).
- **Becomes:** `spawn.tierOdds`, zone `dial`, `spawn.window.afterDay`.

**M8.6 Item: ecology (kin, prey, rivals) as scenery**
- **Best at:** Gothic guild table, UO opposition groups, Ryzom predator and herbivore, Cataclysm default faction. Rivals standing 40 m apart who ignore each other until a flag flips, or a carrion kind picking at a felled kind, tell a story with no extra assets.
- **Source:** see M2.3.
- **Verdict:** ADAPT (visual, never a second fight engine).
- **Becomes:** `guild`, `ecology.foes`.

**M8.7 Item: per-individual traits that change look and behaviour, not numbers**
- **Best at:** Wesnoth gives every recruited unit two or more random traits from its race's pool (quick, strong, resilient ...) each with a small upside and a small cost; two units of one type are never quite the same. The portable form: traits that change *look and world behaviour only* (scarred, limping, lean, thick-furred: tint or a mark on the rig, slightly different aggro or roam), named on the card.
- **Source:** wesnoth-wesnoth `data/core/macros/traits.cfg` (trait pool and effects); `data/core/units/goblins/Wolf_Rider.cfg` (trait count per unit).
- **Verdict:** ADAPT. A stat-moving trait is a combat change: SKIP until proven in the Pit; the cosmetic/behavioural subset is free.
- **Becomes:** `traits: [{id, weight}]` per family, expanded to `look.pool` entries and small `behaviour` offsets; visible on the card.

**M8.8 Item: resistances and weaknesses**
- **Best at:** U7 (vulnerable and immune masks), M&M (eleven resistance slots), TFS (percent per element), Gothic (eight protection slots), Wesnoth (movement-type resist tables). It is the strongest *mechanical* variety lever in those games, because it makes you change what you do.
- **Source:** exult-exult `shapes/shapeinf/monstinf.h`; OpenEnroth `Monsters.h`; otland-forgottenserver `data/monster/monsters/winter_wolf.xml`; ZenKit `Misc.hh` (protection array).
- **Verdict:** SKIP for the fight itself (the duel has no damage-type table; adding one is a combat change, proven in the Pit first). KEEP the world value only: a kind may be *driven back* by fire or torchlight or lured by a bait, as a world trigger (M2.1 `fear: fire`).
- **Becomes:** `triggers.fear` only. No resistance field.

**M8.9 Item: day/night and region windows**
- **Best at:** Daggerfall (separate outdoor tables for night and day), IE (day chance and night chance per spawn), U7 (nocturnal flag), Ryzom (activity by time), Cataclysm (season and day windows), EQ (time windows). Cheap and strongly felt.
- **Source:** see M4.5, M4.6, M4.8; mobs.md 3.4.
- **Verdict:** TAKE; mobs.md 3.4 already decides day/night-lite and `behaviour.activity`.
- **Becomes:** `behaviour.activity`, `spawn.window`.

**How many distinct foes one body can carry (worked count).** Take one lean quadruped rig. Levers: tier ladder (3 rungs) x tint pool (3) = 9 looks; pack role (alpha/follower) = 2 behaviours; temperament (placid pup/bold/savage) = 3; a named form = 1; a night-only nocturnal variant (pale, shy by day) = 1. Even with only the first two levers a family clears five clearly different foes; with the full set a single rig reads as roughly fifteen. None of it touches the duel math.

---

## M9. Proposed FIRST body-family batch

**Alignment note.** Characters' body-families spec (#1648) owns rigs, silhouettes and the family list. This batch is a *request* shaped by the donor patterns; it does not decide #1648's contents (I did not read it). Moveset hooks name only **existing** `MoveId`s and `AiProfile` knobs from `src/moves.ts` (ours); numbers are Combat's, proven in the Pit.

**What the duel needs from any new body (from `src/moves.ts` and mobs.md 5.3):**
- A **windup tell** readable at 375 px: the swing's first phase is the only warning. Existing timings at 60 Hz: a light is 20 ticks of windup (333 ms), a thrust 16, a heavy 32, a kick 18. Our own comment in `moves.ts` records that a 14-tick tell (233 ms) read as "under human reaction". So a beast tell is **at least 16 ticks and a silhouette change** (head drop, haunch coil, rear-up), not a colour flash.
- A **reach** number per attack (light 1.65, jab 1.0, lunge 2.4, ironrush 2.0, cleave 1.6, stomp 1.4, shove 1.3 in the existing tables) and a direction (right, left, overhead, thrust, low) so the player's guard read has something to read.
- A **posture/stagger/knockback** profile so a bite feels like a bite and a charge like a charge.
- A **role** that already exists (`brute`, `skirmisher`, `caster`, `beast`), and (for a `beast`) the existing `fleesNow` and `flee-at` flow.

The eight families below need about five rigs (lean quadruped, heavy quadruped, serpent, arachnid, large biped); three families are look-swaps of a rig above. Myth names are *candidates* for the `source` citation under legends-rule (allowed: Greek, Norse, Celtic myth and folklore; nothing from living-religion scripture; no modern depiction); the content owner makes every final choice.

**F1. Hound / wolf (lean quadruped)**
- **Silhouette:** low head, long muzzle, deep chest, raised hackles; reads as a long low wedge.
- **Foes it carries (5+):** (1) lean pup-class stray (tier A, small, placid `curiosity`), (2) grey hound (B), (3) ash wolf (C), (4) pale winter wolf (C, tint pool, season window), (5) alpha wolf with a 2 to 4 pack (`packRole: alpha`), (6) black night-hound (`activity: nocturnal`, tint), (7) named: a garm-class hound at a placeholder camp (candidates: Garm or Garmr, Norse; Cu Sith, Cwn Annwn, Celtic; Black Shuck, English folklore).
- **Levers used (M8):** tier ladder, tint pool, scale jitter, packs and leaders, day/night, named placeholder, temperament, fear-of-fire.
- **Moveset hook:** a lunge from outside reach (existing `skill_lunge` shape: 16-tick thrust timing, long reach, step-in), a short snap (existing `skill_jab` or `light_left`), `circle` and `disengage` high, `guard` low; a **haunch-coil + head-drop** windup. Role `beast`; flee at the `beast` threshold (Combat's number).
- **Row fields:** `family: 'hound'`, `role: 'beast'`, `tier`, `look{opponent:'hound', tint, scale}`, `look.scaleJitter`, `look.pool`, `pack{followers,size}`, `packRole`, `behaviour{aggro,viewHalf,hearRadius,leash,roam,campSize,activity}`, `temperament`, `triggers.fear:['fire']`, `idleSet`, `harvest:'hide'`, `loot`, `loot.named`, `spawn.curve`, `spawn.window`.

**F2. Boar (heavy quadruped)**
- **Silhouette:** high shoulder, low head, tusks, short thick legs; a block with a point.
- **Foes it carries (5+):** (1) shoat/sow (A, defensive: guards young, `anger: near-baby`), (2) wild boar (B), (3) tusker (C, large tusk dressing), (4) red-bristle razor-back (tint, `savage`), (5) moss-hide bog boar (habitat `mere`), (6) named: Erymanthian or Calydonian boar (Greek), Gullinbursti (Norse), Twrch Trwyth (Welsh).
- **Levers used:** tier ladder, dressing (tusk, mud), tint pool, temperament, habitat, ecology (bog), named, scale jitter.
- **Moveset hook:** a **charge**: long windup with a visible head-low paw-scrape, then an existing `skill_ironrush`-shape move (thrust, step-in, poise during the windup so light pokes do not stagger it) that **breaks into a recovery the player can punish**; secondary a low upward tusk hook (direction `low`, like `skill_stomp`'s read). Role `brute` for the big ones, `beast` for the young.
- **Row fields:** `family: 'boar'`, `role`, `tier`, `look{opponent:'boar', tint, gear?, dressing}`, `temperament`, `triggers.anger:['near-young','hurt']`, `habitat`, `behaviour.engage:'tap'`, `pack` (sow + shoats), `harvest:'tusk'`, `loot`, `class`.

**F3. Bear (heavy quadruped that rears)**
- **Silhouette:** huge rounded shoulders, small head; rears onto hind legs for the big attack (a tall silhouette = unmistakable tell).
- **Foes it carries (5+):** (1) cave cub (curious), (2) brown bear (B), (3) black-muzzle (tint), (4) grey old bear (C, scarred trait), (5) cold-country white bear (tint, `habitat` snow), (6) named: Artio (Celtic), Callisto-as-bear (Greek).
- **Levers used:** tier ladder, tint, scale jitter, traits (scarred), placate (carrying meat), temperament, habitat.
- **Moveset hook:** **rear-up overhead** (existing heavy timing, 32-tick windup, overhead direction, `breaksGuard` as the existing charged heavy), a swipe light, `braceHeavy` high. Role `brute`. No flee for adults (cubs flee).
- **Row fields:** `family: 'bear'`, `role: 'brute'`, `tier`, `look{opponent:'bear', tint, scale}`, `look.scaleJitter`, `triggers.placate:['meat']`, `temperament`, `traits`, `harvest:'hide'`.

**F4. Stalker cat (lean quadruped, cat proportions)**
- **Silhouette:** low belly, long tail, shoulder-blade rise; stands still, then pounces.
- **Foes it carries (5+):** (1) wildcat (A), (2) hill cat (B), (3) night cat (nocturnal tint), (4) crag lion (C, large), (5) twin-lair pair (campSize 2, no leader), (6) named: Nemean lion (Greek), Cath Palug (Welsh).
- **Levers used:** tier ladder, tint, day/night, pack (pair), named. Same rig as F1 with different proportions and idle set.
- **Moveset hook:** **pounce** (existing `skill_lunge` shape) from a standing stalk, then `disengage`. Role `skirmisher`: this is the "poke and withdraw" kind of mobs.md 5.3, not a ranged system. Tell: **flattened ears and a hip wiggle** for 16 ticks.
- **Row fields:** `family: 'cat'`, `role: 'skirmisher'`, `tier`, `look`, `behaviour.activity:'nocturnal'`, `temperament:'wary'`, `idleSet`, `pack` (pair).

**F5. Large monster: giant / troll (large biped)**
- **Silhouette:** double the hero's height, small head, heavy forearms, club or stone in hand.
- **Foes it carries (5+):** (1) hill troll (A, club), (2) moss troll (tint, dressing), (3) frost jotun (C, frost dressing, `habitat` cold), (4) stone-skin troll that goes still at dawn (`activity: nocturnal`, a story beat from folklore), (5) one-eyed river giant (tint, scale jitter), (6) named: Gogmagog (Welsh/Brythonic chronicle), Hrungnir (Norse; **already a Bounty in region1**, do not duplicate), Grendel (literature, allowed).
- **Levers used:** tier ladder, scale jitter (large), dressing, tint pool, day/night, named, `carries` for visible club/rocks, leader (a giant with 1 to 2 smaller kin).
- **Moveset hook:** **two slow readable blows**: an overhead (existing `skill_cleave` or `heavy_overhead` family, 32-tick windup, 1.6 m reach or longer) and a **stomp** (existing `skill_stomp` shape: low direction, top posture). Role `brute`. Windup tell: **both arms rising** plus a shadow decal. Big, slow, forgiving to read.
- **Row fields:** `family: 'giant'`, `role: 'brute'`, `tier`, `look{opponent:'giant', tint, scale:1.6..1.9, gear, dressing}`, `look.scaleJitter`, `behaviour{aggro, leash, activity}`, `carries`, `class`, `loot.named`, `pack{followers:[smaller kin]}`.

**F6. Serpent / wyrm (limbless)**
- **Silhouette:** a low S-curve with a raised head; no legs makes it the cheapest rig to animate.
- **Foes it carries (5+):** (1) marsh adder (A, small), (2) reed viper (tint), (3) bog constrictor (B), (4) cave lindworm (C, large, scale jitter), (5) stone-scaled serpent (dressing), (6) named: Python (Greek), Ladon (Greek), Nidhogg (Norse), a Jormungandr-kin in a mere.
- **Levers used:** tier ladder, tint, dressing, habitat (the existing `black-mere`), scale jitter, nocturnal variant.
- **Moveset hook:** **coil then strike**: a long head-back tell (16 ticks), a thrust-direction strike with long reach (existing `skill_lunge` shape), and a `skill_miasma`-shape poison cone for the venomous rung (existing move, no new engine). Role `beast` (small) or `caster`-like for the venom rung only if Combat agrees.
- **Row fields:** `family: 'serpent'`, `role`, `tier`, `look`, `habitat`, `idleSet`, `harvest`, `loot`.

**F7. Spider / arachnid (eight legs)**
- **Silhouette:** wide low body with eight splayed legs; reads at any scale.
- **Foes it carries (5+):** (1) cellar spider (A), (2) pale cave spider (tint), (3) hunting spider (B), (4) web-lurker (ambusher: a trigger marker, M4.8), (5) great old spider (C, scale jitter), (6) named: Arachne (Greek, Ovid).
- **Levers used:** tier ladder, tint, trigger markers, scale, named.
- **Moveset hook:** a quick **jab** from a crouch (existing `skill_jab` shape), a leap lunge for the big rung, `step`/`dash` high. Role `beast` (small), `skirmisher` (big). Tell: **front legs rise** for 16 ticks.
- **Row fields:** `family: 'spider'`, `role`, `tier`, `look`, `spawn.trigger{on:'near',once:true}`, `behaviour.engage:'contact'` for the ambusher only if World agrees.

**F8. Horned hooved (boar rig, antler gear)**
- **Silhouette:** boar-heavy body with a rack or horns; the same rig as F2, a different `look.gear` set.
- **Foes it carries (5+):** (1) hind (A, placid), (2) stag (B), (3) ram-horn (tint), (4) white hart (a pale named rarity), (5) wild bull (C, large, charge), (6) named: Cretan bull (Greek), the Ceryneian hind (Greek), the white stag of Celtic folklore.
- **Levers used:** tier ladder, gear swap (antlers, horns) on the F2 rig, tint, curiosity, placate, named.
- **Moveset hook:** reuse F2's charge; the hind uses the bear's `curiosity` and flees instead of fighting. Role `beast` or `brute`.
- **Row fields:** `family: 'boar'` (same rig) with `look.gear:['antlers']` or a `family: 'hoofed'` alias pointing to the same rig; `temperament:'placid'`, `curiosity`, `triggers.fear`.

**Out of this batch (named so they are not forgotten):** flyers (a ground duel needs a grounded presentation), swimmers, riders on mounts (M3.7), and any two-body opponent.

**Batch economics.** Five rigs (lean quad, heavy quad, serpent, arachnid, large biped) carry eight families and, by the counts above, roughly forty distinct named-or-common foes before any new art beyond tint, scale and gear. That sits inside "opponent variety from data rows plus few rigs".

---

## Not verified, stated plainly

- **Arena (OpenTESArena):** I read the creature table struct (level, health range, damage range, scale, loot chance bits, ghost flag) and where map data picks a creature; I did **not** find or read how the level-keyed random choice works. The lever table marks it `?`.
- **Barony miniboss:** I found the flag that disables promotion and its set sites; I could not locate the roll that promotes. M7.5 claims only the flag.
- **xoreos (KotOR/NWN):** it ships loaders and a simple fixed-radius perception check, but no encounter system or spawn rules; the NWN "encounter blueprint" idea (creature list, max creatures, respawn, difficulty) is from public Aurora toolset documentation and was **not verified in code**. No NWN or KotOR item is therefore ranked.
- **Heroes (vcmi/fheroes2):** the join/flee/fight comparison and size-by-tier were read; the exact factor values were not copied and the formulas were not tested.
- **EQEmu (placeholder camps):** the engine carries chances and named detection; the "placeholder" idea is a *convention* over spawn groups, not a coded concept. M7.1 says so.
- **Daggerfall class enemies** (humanoid classes levelled to the player) were seen in `EnemyEntity.cs` but not mined for variety; only the monster ladders were.
- **UESP, EQ wikis, Aurora toolset docs:** named as plain-text references only; none was fetched.
- **#1648 (Characters' body families):** not read. Its branch exists on the remote; this document does not depend on its contents.
- **Games not asked for but present** (Veloren, Dawn of Light, OpenDAoC, AzerothCore, Flare, KeeperRL, FOnline, tibia client, Endless Sky, Unciv, RCT/TTD/city builders): not read for Part A.
- **GPL numbers:** where a threshold or timer is mentioned for a GPL/AGPL donor it is described as behaviour in a range or a word, not as a table, and was not tuned against our duel.

---

## Top picks from part A (ranked, 10 max)

1. **Tier ladder inside a family (M8.1 / M1.1 / M1.2).** One rig, three to five rungs, all data; the cheapest and strongest source of distinct foes.
2. **Rarity curves over level (M4.1).** Smooth roster drift with one data field; no combat impact.
3. **Zone dial that picks the rung (M4.2).** A single number per zone changes the mix; plugs straight into `generateZone`.
4. **Free visual spread: scale jitter, tint pool, dressing, gear (M1.3 / M8.2).** Doubles the roster for zero combat risk; constrained by tint-contrast.
5. **Leader plus bounded follower band (M3.2 / M3.3).** Makes the encounter itself differ with the same bodies; fits camp limits.
6. **Behaviour presets and trigger lists (M2.4 / M2.1).** Readable play difference (shy, bold, ambusher) from one id; world layer only.
7. **What it carries is what it wears (M5.2).** Ties visible gear to the drop table so the roster and loot never drift apart.
8. **Two-word card: danger and occurrence, plus group size word (M6.1 / M6.2).** Readability with no authored data (both derived).
9. **Placeholder plus rare, with class enum (M7.1 / M7.4).** Named events from ordinary camps; named fights stay duels.
10. **First body-family batch (M9): hound, boar, bear, stalker cat, serpent, spider, giant, hooved.** Eight families, about five rigs, line up with Characters' body-families spec (#1648).

---

# PART B: Patterns from old games' engines (combat, world, quests)

- Author: analyst, 2026-10-07. Docs-only. Patterns in our words; no donor code is quoted anywhere in this file. Read on the VPS at `/mnt/frankendom-donors` (pinned in `PINS.txt`). Nothing was cloned or fetched; no proprietary game data was stored.
- Fits: our duel as read in `docs/COMBAT_REFERENCE.md` and `docs/duel-architecture.md` (60 Hz fixed step; light cut 20/8/22 ticks, thrust 16/5/21, heavy 32/5/31, kick 18/1/25 and unparryable; parry window 10 ticks; perfect block 3; chain window 18; posture, stamina, directional guard; warden `AiProfile` knobs reaction, accuracy, parry, dodge, aggression, pressure, lapse, feint, guard, disengage, circle, step, interrupt, kick, read, dash). Our creature spec `/tmp/mobs.md` (sections 1-7, "mobs.md" below) is cited, not repeated: it already owns the four kinds (brute, skirmisher, caster, beast), the notice/suspect/hunt beat, the approach parameter set (mobs.md 5.5), beast flee at 30 percent via the `flee-at` twist (5.6), action rows (5.4), spawn groups (4) and the row format (7).
- ONE-ENGINE RULE (Dom) applied to every item: each item says Pit (changes what the warden does inside `src/`, so it is proven in the Pit first under the RV gates and only selects among moves that already exist) or world-only (an add-on layer over `src/`, never in the fight resolution). Any donor pattern that resolves a fight by dice, hit chance, auto-swing or tab-target is SKIP for the fight itself; where a donor pattern is built on one, only the layout around the fight is borrowed.
- Ranking: C is best first. W and Q are ordered by how much a 600-zone generator gains.

## 0. Licence record (checked in each repo's licence file, 2026-10-07)

| Donor (pin from PINS.txt) | Licence class | Rule used here |
|---|---|---|
| OpenGothic `801f6ed5`, ZenKit `ddf27dec` | MIT | shapes and numbers in our words, nothing pasted. Gothic game scripts and data are proprietary and are not in these repos; only the loader shapes were read |
| daggerfall-unity `2343305`, SCAR `e62b63a`, CombatPathingRevolution `0061785` | MIT | as above |
| afritz1-OpenTESArena `67872ae`, 2004Scape-Server `647886c`, LostCityRS-Engine-TS `1d25566`, inkjs `6b115341` | MIT | as above; OpenTESArena ships no game data, only loaders and generators |
| TurningWheel-Barony `962a5ce` | BSD-2 (LICENSE.txt, Turning Wheel) | as MIT |
| ModernUO `261ea01a` | GPL-3 (LICENSE) | GPL-behaviour-only |
| EQEmu `4aceae18` | GPL-3 (LICENSE.md) | GPL-behaviour-only |
| openmw `71fc0a4a` | GPL-3 | GPL-behaviour-only; reads schemas only, no game data present |
| exult-exult `0e3cd67`, gemrb-gemrb `fb5bf56` | GPL-2 | GPL-behaviour-only; no game data present |
| OpenEnroth-OpenEnroth `860bf44` | LGPL-3 | treated as GPL-behaviour-only; no game data present |
| otland-forgottenserver `1561fa9`, wesnoth-wesnoth `9ec35a2f`, crawl-crawl `43d89d9`, 0ad-0ad `61a3b950` (code) | GPL-2 | GPL-behaviour-only |
| veloren-veloren `81283b7`, rathena-rathena `d4b8e7b` | GPL-3 | GPL-behaviour-only |
| CleverRaven-Cataclysm-DDA `074aa98` | CC-BY-SA-3.0 (code and data) | shape only; share-alike would attach to anything copied, so nothing is copied |

Measurement note: where this file gives a count or median taken from a donor's data files (UO spawners, rAthena spawn lines), it is our own aggregate over those files, not a copy of any row. Sample sizes are stated at each use.

---

# SECTION C: COMBAT (12 items, best first)

## C1. Situation-keyed tactic table with "reaction" slots (Gothic)

- **Item:** The opponent chooses its next step from a small table keyed by the situation, not from one global weighting.
- **What it is:** Each fighter kind has a tactic record with a list of options per situation: target inside striking range and in front, inside the longer "walking" range, target running at us, target is winding up inside our range and facing us (the "reaction" slot, which can say parry, hop back, step aside), and "I was just hit" (usually a sidestep). One option is drawn at random from the situation's short list (at most six entries) and then played out as a queue.
- **Source:** MIT. `OpenGothic/common/game/fightalgo.cpp` and `fightalgo.h` (the situation ladder: pre-hit reaction first, then weapon-range rows split by facing and by running or standing, then a longer walking-range band, then caster and ranged rows); `OpenGothic/common/game/definitions/fightaidefinitions.cpp` (tactic records are named per slot and numbered per creature kind); `ZenKit/include/zenkit/addon/daedalus.hh` (the record is just six move ids). The facing test is a 30 degree cone. The Gothic scripts that fill the rows are proprietary and were not read.
- **How it improves our duel:** Our warden already has a defence plan per noticed swing and offence utility scores, but the situation split is implicit. A table makes each mob kind legible to the player: a brute has one reaction row (brace), a beast has hop-back and sidestep rows, so the same swing teaches different lessons per kind. It also gives a clean home for "after I am hit": clearing the plan and sidestepping is the rule that stops a mob from swinging through its own stagger.
- **Pit or world-only:** Pit (it is the warden's decision layer). Authoring format only; no new move, no new rule.
- **Verdict:** ADAPT. Take the situation keys and the "reaction when the hero winds up" slot; skip the Gothic range numbers (they are in Gothic units and weapon lengths). Our distances come from `reach` already in `moves.ts`.
- **Becomes:** Optional `tactic` block on the mob row, read by Combat into `AiProfile` weights, never new moves: `{ inReach: MoveId[], inClose: MoveId[], heroClosing: MoveId[], heroWinding: ('parry'|'backstep'|'sidestep'|'brace')[], afterHit: ('sidestep'|'backstep'|'press')[] }`, each list at most six entries, one drawn with the seeded stream. A missing block means the profile as it is today (bit for bit).

## C2. Signature move kit: trigger, chance, cooldown (ability rows)

- **Item:** Each creature kind owns one to three named special moves, each with a trigger, a chance and a cooldown range, shared across many creatures.
- **What it is:** ModernUO attaches shared ability objects to a creature type. Each ability declares when it may fire (on thinking, on landing damage, on taking damage, while in combat, on death, on movement), a chance, and a minimum and maximum cooldown; the cooldown is tracked per creature and cleared on death. Barony does the same more crudely: one special move per species plus one cooldown constant per species in a header table. The Forgotten Server monster files list attacks as rows with an interval, a chance and a range or radius, plus self-defence rows (heal, speed buff) with their own chance. rAthena's skill rows add a "state" (idle, attack, chase, angry before first hit) and a condition (always, on spawn, my health below a percent, when meleed, when shot, when allies are fewer than started).
- **Source:** ModernUO (GPL-3, behaviour only): `Projects/UOContent/Mobiles/Abilities/MonsterAbility.cs`, `MonsterAbilityTrigger.cs`, `MonsterAbilities.cs`, uses in `Mobiles/Monsters/*`. TurningWheel-Barony (BSD-2): `src/monster.hpp` (special cooldown table, 35 entries, cooldowns 75 to 500 ticks). otland-forgottenserver (GPL-2): `src/monsters.h`, `data/monster/monsters/*.xml` (shape only; Tibia creature stats are not recorded here). rathena (GPL-3): `db/pre-re/mob_skill_db.txt` header.
- **How it improves our duel:** Our mob roster has the four kinds and a profile, but a mob that only differs by numbers is hard to remember. A signature move (a lunge for the beast, a charged heavy for the brute, a witchfire opener for the caster) with a cooldown makes each kind recognisable and caps how often the hero faces the worst move. It reuses the move table: the kit names existing `MoveId`s.
- **Pit or world-only:** Pit for a move the duel throws; world-only for anything that happens outside the duel (summoning an extra creature, a world-side buff). Summons are world-only: the duel stays 1v1.
- **Verdict:** ADAPT. Take trigger plus chance plus cooldown range. Skip UO's area effects, damage-over-time and equipment-destroy abilities (they resolve outside the duel's rules).
- **Becomes:** `kit: KitRow[]` on the mob row, `KitRow { move: MoveId, trigger: 'opener'|'whenGuarded'|'afterHit'|'hpBelow'|'always', chance: 0..1, cooldownMin: s, cooldownMax: s, state?: 'before-first-hit'|'after' }`. This is mobs.md 5.4's action row with two additions (a trigger, a cooldown range). The `state` field is rAthena's "angry" idea: the opener set before the hero first lands a hit and the set after differ.

## C3. Caster tells and interrupt windows

- **Item:** A caster's spell is a visible wind-up with an owner-defined "can be broken" flag, and what breaks it is a hit that staggers.
- **What it is:** Three donors agree. rAthena gives every mob skill row a cast time and a "cancelable" flag: damage during the cast cancels it when the flag is on. Crawl tags each spell slot with its school (natural, vocal, magical, wizard, priest, breath, noisy, emergency) and the school decides what stops it (silence stops vocal and wizard and priest casts but not a natural breath); a breath slot also sets a shared timer that must run out before the next breath, and an emergency slot is only used when hurt. ModernUO's mage AI backs off to keep range when the target is close, walks back in when out of range, and picks a counter-spell when the target is itself a caster.
- **Source:** rathena (GPL-3) `db/pre-re/mob_skill_db.txt` (header). crawl-crawl (GPL-2) `crawl-ref/source/externs.h` (spell flag list), `mon-spell.h`, `mon-cast.cc` (slot choice by frequency weight). ModernUO (GPL-3) `Mobiles/AI/MageAI.cs`. Public design knowledge for the Souls and For Honor "colour or sound flash on an unblockable" idea, no donor source.
- **How it improves our duel:** Our caster opener is a `skill_*` move with a marker. The fair-play rule from the combat reference (tell before damage) already holds; what is missing is a defined answer. Proposal: a caster wind-up is always longer than a cut (so the hero can reach it), carries the same marker every time, and is breakable by exactly the tools we have: a kick (18-tick, unparryable, 18 stagger) or any hit that staggers during the wind-up. A breath-style shared timer stops the caster chaining two heavy casts. No caster move may be unparryable and unbreakable at once.
- **Pit or world-only:** Pit (the wind-up is a duel move). The marker art and the world-side "caster hums when it notices you" tell are presentation.
- **Verdict:** ADAPT. Take the cancelable flag, the school tag as an authoring label, and the shared breath timer. Skip silence (we have no status effects) and mana.
- **Becomes:** On each `skill_*` row in `kit`: `breakable: boolean` (default true), `tellTicks` (must be at least the light-cut wind-up of 20), `school: 'natural'|'learned'|'breath'` (label for Characters' marker colour and for the shared timer), `sharedTimer?: string` (rows with the same string share one cooldown, so two breath moves cannot chain). Validator rule: no kit row may have `breakable: false` and also be unparryable.

## C4. Combo ladders with a chain chance, a window, and "a hit wipes the plan" (Gothic, SCAR)

- **Item:** Multi-swing sequences are data, each link has a chance and a time window, and a hit taken clears the queue.
- **What it is:** Gothic fighters draw named sequences: a single attack, a left-right pair, a front pair, a triple, a whirl (four alternating swings) and a "master" chain (two sides then four straight). The queue is cleared the moment the fighter takes a hit. SCAR (a Skyrim mod) puts the same on every attack animation: an optional "combo window opens" mark in the animation, a chance that the chain continues at all (default always), and next-attack rows each with distance band, arc, chance, and an optional start and end time within the animation.
- **Source:** MIT. `OpenGothic/common/game/fightalgo.cpp` (combo expansion and the hit-clears-queue rule); `SCAR/docs/EN/Developers Manual For SCAR 2.0+.md` ("Attack Combos Stage": next attack chance, trigger time). Already summarised for rows (not for chains) in mobs.md 5.4.
- **How it improves our duel:** The duel has real chains (opposite cut or heavy inside 18 ticks uses 16/8/18 timing; heavy chains 22/5/31). Mobs can use them in a readable, authored way: a brute's chain is cut then heavy; a skirmisher's is thrust then back. The "hit clears the plan" rule is already how the warden behaves (reads committed state each tick); naming it in the row keeps authors from writing chains that fight the engine.
- **Pit or world-only:** Pit (opponent move selection). Chains use only the existing 18-tick chain window; no new timing.
- **Verdict:** ADAPT. Take chain chance and the allowed window; skip Gothic's four-to-six-swing whirl and master chains (they are longer than our stamina budget and would turn the duel into a script).
- **Becomes:** `chains: { from: MoveId, to: MoveId, chance: 0..1, startsAfter: ticks, endsBefore: ticks }[]` on the mob row, with `endsBefore` clamped to the engine's 18-tick chain window by the validator; chain length capped at 3 in v1. Combat decides whether the warden consumes it directly or it only seeds the profile.

## C5. Pack: one attacker at a time (token ring), assist cap, spacing (EQEmu, Wesnoth, Forgotten Server; Souls and For Honor design)

- **Item:** In a group, one member holds the duel; the others wait on a ring and rotate in, and the number who join a pull is capped.
- **What it is:** EQEmu lets only a limited number of idle neighbours answer a call for help at once (five by default, and the slots free up after a timer of about six seconds). Wesnoth's wolf pack sends the nearest wolf first and places the rest two to three tiles from each other, at the same distance from the prey as the first, with the spacing target loosening for each later wolf. The Forgotten Server lets a monster switch target on an interval and chance, which spreads attackers. Souls and For Honor give the same idea a name from design lore: only a couple of enemies actively attack, the rest circle (public design knowledge, no donor source).
- **Source:** EQEmu (GPL-3) `common/ruletypes.h` (assist cap and its timer), `zone/mob_ai.cpp` (assist). wesnoth (GPL-2) `data/ai/micro_ais/cas/ca_wolves_move.lua`. otland-forgottenserver (GPL-2) `src/monster.cpp` (target change). Our own start: combat-study 2A and mobs.md state `ring` (waiting ring 4 to 6 m for joiners).
- **How it improves our duel:** Our fight is strictly 1v1, so a pack must queue rather than mob the hero. The token rule makes that explicit: one duel is live; the rest hold the ring, cannot be tapped into a second simultaneous duel, and step in when the first falls or flees. That is Dom's "nothing less, nothing more" held under a crowd.
- **Pit or world-only:** world-only. It decides who is in the duel next, never what happens inside it.
- **Verdict:** TAKE (it is already half specified; this adds the cap and the spacing). Skip any "everyone attacks at once" mode and any group-damage maths.
- **Becomes:** Pack fields on the camp (not per mob): `pack: { assistCap: 3 (1 to 5), assistFreeAfter: s (6), ringRadius: 4..6 m, ringSpacing: arc metres, nextUpDelay: s }`. Rotation rule: the next fighter is the ring member with the longest wait, ties by seeded roll. A mob at `ring` may not be targeted; a tap on one asks "wait for your turn". Test: never more than one live duel per hero.

## C6. Flee package: when, who, and when not (EQEmu, OpenEnroth, Crawl)

- **Item:** Add the "exceptions" that make fleeing feel intentional: pity for a nearly dead hero, no flee when allies are fighting, flee chance, cornered creatures turn and fight, flee ends when the creature recovers.
- **What it is:** EQEmu: a creature flees below a health percent (default 25), but not when the hero is nearly dead (it presses to finish), not when other creatures are fighting alongside (unless a rule says otherwise), only after a roll that rises when the hero out-levels it, and it stops fleeing as soon as it is no longer below the line. OpenEnroth stores three tiers in the creature record: never runs, runs at 20 percent, runs at 10 percent, always runs (peasants). Crawl: a fleeing monster that gets cornered stops fleeing and fights.
- **Source:** EQEmu (GPL-3) `zone/fearpath.cpp`, `common/ruletypes.h`. OpenEnroth (LGPL-3) `src/Engine/Objects/MonsterEnums.h` (AI type enum, comments name 20 and 10 percent). crawl-crawl (GPL-2) `crawl-ref/source/mon-behv.cc` (cornered event). mobs.md 5.6 already has the beast rule, speed, window, rally and leash.
- **How it improves our duel:** mobs.md makes beasts flee deterministically below 30 percent. These extras fix two feel problems: a beast that runs from a hero at 10 percent health looks cowardly and robs the player of the kill (add the pity rule), and a beast that flees into a wall should not stand still (cornered fights). They need no chance roll: all four rules are deterministic given state.
- **Pit or world-only:** world-only. The duel ends with the existing `fled` result; these rules only decide whether `fleesNow` may fire.
- **Verdict:** ADAPT. Take pity, allies-fighting and cornered; skip the con-based chance roll (our flee is deterministic and testable without a seed).
- **Becomes:** `fleeRules` on the style, all booleans or small numbers: `{ pityBelowHeroHealth: 0.2, noFleeIfAlliesFighting: true, corneredFights: true, endsWhenAbove: fleeBelow + 0.05 }`. `fleesNow` stays Combat's function; the extras are conjuncts in the world layer. A tier name (`never`, `late` 10 percent, `normal` 20 percent, `early` 30 percent) is an authoring label over `fleeBelow`.

## C7. Beast approach: circle then commit, hop back, dance at range (Veloren, ModernUO, Forgotten Server, Daggerfall Unity)

- **Item:** A beast's in-world approach is a short script of circle, charge and hop back, with an advance-or-retreat decision re-rolled every one to three seconds.
- **What it is:** Veloren's charging beast picks left or right at random, circles the target at roughly 85 degrees off the line to it for a set number of seconds while inside the charge radius, then charges; touching the target resets it to melee. Its backstabber strafes inside 4.5 m to get behind a target that faces it, then closes. Daggerfall Unity re-rolls "move in or back off" every one to three seconds, biased by the level gap (higher level means more advance, capped at four), never retreats from a target that is unseen, paralysed, has its back turned or has its weapon put away, and strafes about one time in four for one to two seconds. ModernUO animals back off with a fifty percent chance when not committed. The Forgotten Server has a "static attack" chance: otherwise a creature at its preferred distance sidesteps.
- **Source:** veloren (GPL-3) `server/agent/src/attack.rs` (circle-charge and backstab handlers, read only). daggerfall-unity (MIT) `Assets/Scripts/Game/EnemyMotor.cs` (advance or retreat decision, strafe decision). ModernUO (GPL-3) `Mobiles/AI/AnimalAI.cs`. otland-forgottenserver (GPL-2) `src/monster.cpp` (distance step, static attack). mobs.md 5.5 has the CPR radii; this item adds the decision loop and the commit beat.
- **How it improves our duel:** The duel already makes the warden circle just outside cut range when low on stamina or posture. The world-side approach is where the beast earns its name: it should stalk before the fight and arrive from a flank so the first exchange starts at an angle, then the duel takes over. The "no retreat from an exposed hero" rule is a fairness gain: a creature that backs off while the hero is mid-roll or guard-down wastes the player's opening.
- **Pit or world-only:** world-only for the approach (before `startEncounterDuel` and on `ring`); Pit only for the existing `circle`, `disengage` and `dash` knobs. Backstab-seeking is SKIP inside the duel (the duel turns both fighters to face each other, and rear arc is +15 percent only).
- **Verdict:** ADAPT. Take circle-then-commit, the 1-3 s re-roll with the level-gap bias, and the exposed-hero rule; SKIP the backstab for the fight.
- **Becomes:** `approach` additions: `{ decideEvery: [1, 3] s, gapBias: 0.5 per level (cap 4), noRetreatIf: ['heroGuardDown','heroRolling','heroBackTurned'], circleDirChoice: 'seeded', circleAngleDeg: 85, circleSeconds: [1.5, 3], commitBeat: s, strafeChance: 0.25, strafeSeconds: [1, 2] }`.

## C8. Phase and trigger rows (rAthena, EQEmu, Barony)

- **Item:** For named creatures and bosses, a row can swap the warden's profile or fire a one-time move when a trigger fires: below a health percent, on first blood, after the hero has parried N times.
- **What it is:** rAthena skill rows carry a condition: on spawn, my health under a percent, my health inside a range, when meleed, when shot, when helpers are fewer than the starting number. EQEmu has an enrage state that starts under a health percent, lasts a set time, and has a cooldown. Barony's lich dodges away on a quarter of hits it takes, and has a distinct boss state machine.
- **Source:** rathena (GPL-3) `db/pre-re/mob_skill_db.txt` (condition list). EQEmu (GPL-3) `zone/mob_ai.cpp` (enrage start and end). TurningWheel-Barony (BSD-2) `src/actmonster.cpp` (the lich's dodge-on-hit branch) and `src/monster_lich.cpp`.
- **How it improves our duel:** Bosses and named foes are the only fights that should surprise the player. A one-line "second profile at half health" is the cheapest phase change that stays inside the engine: same moves, different weights (more heavy, less guard, shorter lapse).
- **Pit or world-only:** Pit. It must be deterministic (no hidden dice): the trigger reads committed state and the swap is a pure function of it; proven in the Pit first.
- **Verdict:** ADAPT for named and bosses only. SKIP for common mobs (it makes them harder to read). SKIP the percent-on-hit dodge roll as written: a dodge decision is already the warden's `dodge` knob.
- **Becomes:** `phases: { when: 'hpBelow'|'afterHeroParry'|'firstBlood', value: number, profile: AiProfilePatch, once: true, durationSeconds?: s }[]` on named and boss rows only. The patch overrides only the knobs that exist today.

## C9. Leader, guardian and aggro-tolerance rules (Wesnoth, 2004Scape engine)

- **Item:** Camps get roles: a stationed guardian that never leaves its post, a leader that does not rush in, and a rule for when a creature ignores a hero.
- **What it is:** Wesnoth ships guardian behaviours (a stationed one that defends a post within a distance, a zone guardian that holds an area, a "return" guardian that goes home after any fight) and default leader values: the leader's aggression is deeply negative so it avoids fights and stays near its keep. The 2004Scape engine has named "hunt" rules per creature (what to look for, with a sight or walkable-line test, a "nobody nearby" pause) and one check that only turns on outside the dangerous zone: creatures there ignore heroes who are far stronger than them, but inside the wilderness they always engage. Its creature config also fixes the wander radius (default 5) and leash (default wander plus 2).
- **Source:** wesnoth (GPL-2) `data/ai/utils/default_config.cfg` (leader and caution values), `data/ai/micro_ais/mai-defs/guardian.lua`, `patrol.lua`. LostCityRS-Engine-TS (MIT) `src/engine/entity/hunt/*.ts` and `src/cache/config/NpcType.ts` (wander, max range, hunt range, respawn defaults), `src/engine/entity/NpcMode.ts` (wander, patrol, escape, face).
- **How it improves our duel:** Our camps (mobs.md 3.3) have social pull but no roles. A leader that waits until its followers are down makes a pack feel like a unit, and gives the boss-of-camp fight a natural position as the last duel. The "tolerance outside the danger zone" rule fits our grey rule and gives the zone generator a lever: safe zones keep grey creatures passive, deep zones set `alwaysAggro`.
- **Pit or world-only:** world-only (order of engagement and aggro). The fight with the leader is the ordinary duel.
- **Verdict:** ADAPT. Take stationed, zone and return guardians and the leader-last order. Skip Wesnoth's recruitment, village and gold values (a turn-based strategy economy).
- **Becomes:** Mob row `role` stays the style id; add `post: 'free'|'stationed'|'patrol'|'zone'` and `postRadius`; camp row gets `leader?: slotId`, `leaderEngagesWhenFollowersAtMost: n`; zone row gets `greyAggro: boolean` (true in the deepest tier only). Patrol is a list of waypoints plus an out-and-back flag.

## C10. Souls-style enemy authoring rules (design knowledge, no donor source)

- **Item:** A short checklist for what makes a creature fair to read in a timing duel.
- **What it is:** Public design knowledge from the Souls family: each enemy has two to four distinct attacks, every attack has a unique silhouette and wind-up length so the player learns it by shape, a long recovery after a heavy swing is the punish window, big swings carry armour (they cannot be interrupted), and the player's own stamina is the shared limiter. Nothing here is from a donor repo.
- **Source:** public design knowledge, no donor source.
- **How it improves our duel:** We already have the pieces (the heavy's hyper-armour from tick 24, the 31-tick heavy recovery, the guard counter window, the posture bar). The value is the authoring rule: no two moves on one mob may share a wind-up length within 4 ticks (the warden's reaction at normal is 14 ticks, so closer than that is unreadable), and every move above 25 damage must have a recovery of at least 25 ticks. A validator can enforce both on the row.
- **Pit or world-only:** Pit (authoring check on duel moves); the checker itself is a docs and test artifact, not engine code.
- **Verdict:** TAKE as a validator, not as new mechanics.
- **Becomes:** Row validator in the mob-row checks: `distinctTells` (pairwise difference of `tellTicks` at least 4 within a kit), `punishWindow` (recovery at least 25 ticks for any move with damage above 25), `moveCount` 2 to 4 for common kinds, 3 to 5 for named, 4 to 7 for bosses.

## C11. Morale and anger meters (Cataclysm DDA; EQEmu; ModernUO)

- **Item:** Replace the single "is health under the line" flee test with a pair of small meters that react to events.
- **What it is:** CDDA gives each creature an aggression number and a morale number and three trigger lists: things that make it angry (a friend attacked, a friend died, being hurt, the player getting close), things that frighten it (fire, a loud noise, being hurt, the player close, a friend dying) and things that calm it (the player looking weak). Being hurt adds a few points scaled by damage. A creature flees when morale falls below zero and attacks when aggression is high enough. EQEmu's "placate" idea is similar, and ModernUO ties fleeing to a chance per role.
- **Source:** CleverRaven-Cataclysm-DDA (CC-BY-SA-3.0) `data/json/monsters/*.json` (trigger lists and the two numbers; shape only) and `src/monster.cpp` (trigger processing). EQEmu (GPL-3) `zone/fearpath.cpp`.
- **How it improves our duel:** It makes the world layer explain why a creature does what it does. A pack creature whose friend just died gets scared; a beast hurt by fire runs; a guardian turns aggressive when a camp-mate is attacked. All of it resolves into states the world layer already has (`suspect`, `hunt`, `flee`, `return`); nothing reaches the duel except the existing `fleesNow` and the opponent profile.
- **Pit or world-only:** world-only.
- **Verdict:** ADAPT, small. Use two meters and at most four triggers per kind in v1. SKIP the fire, sound, bright-light and stalking triggers until the world has those events.
- **Becomes:** Mob row `temper: { aggression: 0..100, morale: 0..100, anger: ('friendAttacked'|'friendDied'|'hurt'|'heroClose')[], fear: ('friendDied'|'hurt'|'heroClose')[], calm: ('heroWeak')[] }` (CDDA's `placate` is `calm`). `fleeNow` is the world layer's `fleesNow(style, health) OR morale < 0`; `morale < 0` can only turn a flee on for kinds that may flee at all.

## C12. Duel-game lessons: Mount & Blade, Kingdom Come, For Honor, Chivalry (design knowledge, no donor source)

- **Item:** A short ledger of what these four teach and what we already have.
- **What it is:** Public design knowledge only. Mount & Blade: directional attacks and blocks with an AI that reads the attacker's direction after a delay scaled by difficulty. Kingdom Come: stamina-limited combos, "perfect block" opening a riposte, and the lesson that fighting several enemies at once is punishing. For Honor: a three-direction guard stance where the stance indicator is the information, plus an unblockable cue and a guard-break. Chivalry: slash, overhead and stab with feints and "drags" (changing a swing late).
- **Source:** public design knowledge, no donor source.
- **How it improves our duel:** Almost all of it exists: directional guard (the `read` knob is the M&B reaction-delay idea), feint, perfect block with riposte, guard counter, stamina floor, chained timing. Two small ideas are new. First, show the mob's guard side (For Honor style) as a thin cue on the mob so directional guard can be learned without the debug overlay. Second, a "drag" is a late-changed swing; in our engine the nearest thing is the chamber hold, which a mob can already use as a bait.
- **Pit or world-only:** Pit for the first cue only if it is derived from `Fighter.guard side` (presentation, no rules). Everything else is already built.
- **Verdict:** SKIP the mechanics (already built); TAKE the guard-side cue as a presentation task.
- **Becomes:** No data field. One presentation task in the Characters backlog: a guard-side tick above the mob's health bar during a held guard. No `src/` change.

---

# SECTION W: WORLD AND ZONE STRUCTURE (8 items)

## W1. The zone row: identity, level band, safe point, graveyard, weather (EQEmu, UO regions, Morrowind regions)

- **Item:** One flat record per zone that carries everything the engine must know about it.
- **What it is:** The EQEmu zone record names the zone, gives its minimum and maximum level, a safe point (where a hero lands when something goes wrong), a graveyard zone (where death sends you), weather chances in four slots with durations, fog colours and clip distances, flags (can bind, can fight, can levitate) and an experience multiplier. UO regions are typed (guarded town, plain town, dungeon, and others), carry a priority, a list of rectangles (a region can be several patches), a "go here" point, a music id and an entrance point. Morrowind regions carry a weather probability table summing to 100, a list of ambient sounds each with a chance, a leveled list of creatures you meet if you sleep outside, and a map colour.
- **Source:** EQEmu (GPL-3) `common/repositories/base/base_zone_repository.h` (field list, read as a schema). ModernUO (GPL-3) `Distribution/Data/regions.json` (398 region records). openmw (GPL-3) `components/esm3/loadregn.hpp` (schema; no game data).
- **How it improves our duel:** Not the duel; the 600-zone content. A fixed schema lets the generator produce zones that all validate, and the level band (min and max) is the dial that makes the danger gradient (W4) enforceable by a test.
- **Pit or world-only:** world-only.
- **Verdict:** TAKE the flat-row idea and these fields: level band, safe point, return point, weather weights, ambient sound list with chance, sleep-ambush list, map colour. Skip XP multipliers and bind rules (not our game's economy).
- **Becomes:** `ZoneRow { id, name, levelMin, levelMax, safePoint, returnZone, weather: {kind: weight}[], ambience: {sound, chance}[], restAmbush?: mobTableId, mapColor, music, flags: { greyAggro, canRest, canFight } }`. Priority and multi-rectangle areas matter only if two zone shapes overlap; v1 zones are single polygons, so skip priority.

## W2. Travel graph: directed edges with entry rectangle and landing point (EQEmu, UO teleporters, Gothic waynet, Morrowind cells)

- **Item:** Zones are nodes; the connections between them are explicit directed edges with an entry zone, a landing position and facing.
- **What it is:** EQEmu stores zone connections as a table: for each source zone, an entry box (a point with width and height) and a target zone, position and heading. UO teleporters are source-to-destination coordinate pairs with a "back" flag that adds the return edge. Gothic navigation is a graph of named waypoints and edges, with a flag marking "free points" where creatures do an activity. Morrowind's exterior is a grid of cells addressed by integer coordinates, joined by adjacency, with interior cells reached through doors.
- **Source:** EQEmu (GPL-3) `common/repositories/base/base_zone_points_repository.h`. ModernUO (GPL-3) `Distribution/Data/teleporters.json`. ZenKit (MIT) `include/zenkit/world/WayNet.hh` (waypoint and edge structs). openmw (GPL-3) `components/esm3/loadcell.hpp` (grid x and y, interior flag).
- **How it improves our duel:** Not the duel; the travel graph is what makes 600 zones a world instead of a list. Explicit edges let the generator guarantee reachability and place the danger gradient along the graph (W4).
- **Pit or world-only:** world-only.
- **Verdict:** TAKE. Directed edges (with an optional return edge) plus a connectivity test.
- **Becomes:** `ZoneEdge { from, to, entryRect, landing: {pos, facing}, twoWay: boolean, minLevel?: number }`. Generator rules: the zone graph is a spanning tree from the start zone plus a loop edge for every 8 to 10 zones; the longest hop count from start equals the intended level span; a validator checks reachability, no zone with fewer than one edge, and `landing` is walkable.

## W3. Seeded hierarchy and weighted block rolls (OpenTESArena)

- **Item:** Every zone, camp and landmark derives from one world seed by a fixed hierarchy of sub-seeds; open ground is a grid of blocks, each rolled from a weighted table with a fixed town at the centre.
- **What it is:** OpenTESArena (a re-implementation of Arena, which ships no game data in the repo) stores, for each location, separate seeds for the city, the wilderness around it, the province, the ruler and the sky; a wilderness dungeon's seed is the province seed offset by its block coordinates. A wilderness is a fixed grid where each block rolls "ordinary, village, dungeon, tavern" by percentages read from the original program, with the city fixed at the centre. Locations are typed (city, dungeon, main-quest dungeon) and carry a "visible by default" flag.
- **Source:** afritz1-OpenTESArena (MIT) `OpenTESArena/src/WorldMap/LocationDefinition.h`, `LocationDefinition.cpp` (wild dungeon seed derivation), `OpenTESArena/src/World/ArenaWildUtils.cpp` (block roll). The percentages come from the original game's program and are not recorded here.
- **How it improves our duel:** Reproducibility: a zone regenerates identically from `(worldSeed, zoneId)`, so a bug found in one zone is recreatable and a QA hash is possible. It also lets a creature's roll seed (`mixSeed(TUNING.seed, slotIndex)` in mobs.md) hang off the zone seed.
- **Pit or world-only:** world-only.
- **Verdict:** TAKE the hierarchy; ADAPT the block roll (our zones are small, so the block is a "pad" inside a zone: ordinary, camp, landmark, point of interest).
- **Becomes:** `zoneSeed = mix(worldSeed, zoneId)`; `sub = mix(zoneSeed, 'layout'|'camps'|'mobs'|'loot'|'quests')`. `discovered: boolean` on a zone for map reveal. Pad table: `padRoll: { ordinary: w, camp: w, landmark: w, poi: w }` with a fixed anchor pad at the zone centre or entry.

## W4. Danger gradient: a level window drawn from an ordered table, with a safe-zone tolerance rule (Daggerfall Unity, rAthena, UO, 2004Scape)

- **Item:** Each zone has an ordered mob table (weakest first); the generator draws a window of it by the zone's level, with a weighted easier tail and a rare wide tail.
- **What it is:** Daggerfall Unity keeps, per dungeon type, an ordered list of encounters weakest first (20 entries in the classic lists). The window is chosen by the hero's level: most of the time within three either side, one time in seven or so from the bottom up to a notch above, and rarely the whole list (or a restricted low range when the hero is under level 6). Climate and in-town versus out-of-town and day versus night each have their own table. rAthena and EQEmu pair a zone with level ranges; 2004Scape turns "ignore the far stronger hero" on only outside the dangerous area (see C9).
- **Source:** daggerfall-unity (MIT) `Assets/Scripts/Utility/RandomEncounters.cs` (tables, window choice around lines 1470 to 1530) and `Assets/Scripts/Utility/RDBLayout.cs` (a seeded list of enemies per dungeon from the dungeon-type table). Measured by us, not copied: UO shared Trammel dungeon spawn files in ModernUO (sample of 6 files: Blighted Grove, Britain Sewer, Covetous, Deceit, Despise, Destard; the 7th file had a different record shape and stopped the script) give a median of 3 to 4 creatures per spawner and 1 to 3 entry kinds per spawner. EQEmu zone row (W1).
- **How it improves our duel:** The danger gradient is the only way a 600-zone world stays tunable. Our con ladder (grey to red, mobs.md 1) already prices level gaps; a window means a zone never throws a red creature at a zone-tier hero by accident, and the 15 percent easy tail gives relief.
- **Pit or world-only:** world-only (which creature appears). The creature's fight is still its Pit profile.
- **Verdict:** TAKE. Our zones have a fixed level, so the window is drawn around `zoneLevel`, not the hero's level (so the zone stays the same for everyone, which matters for a shared world).
- **Becomes:** `ZoneRow.mobTable: MobId[]` ordered weakest to strongest (length 8 to 20), `window: { main: ±3 at 80%, easyTail: bottom..level+1 at 15%, wideTail: whole list at 5% (low-tier zones clamp to level+2) }`, drawn with the zone's `mobs` sub-seed. A zone-tier `greyAggro` flag (C9) is set only in the deepest tier.

## W5. Density and camps: filler, clusters, singles (rAthena, UO, EQEmu, Forgotten Server)

- **Item:** A zone's population is a budget split into three kinds of spawn: map-wide filler, clustered camps and single named points.
- **What it is:** rAthena spawn lines are one row each with a map, an optional centre and box, a creature, a count, a respawn and a variance. Over the pre-renewal field maps (145 maps, 1,402 rows, our count) 739 rows are zone-wide filler (a median of 20 creatures, no box), 388 are clustered camps (a median of 3 creatures in a box about 20 wide), and 275 are single-point spawns (a median of 1, bosses and rares); a map has a median of 143 creatures (range 4 to 325); a camp respawns after a median of 5 minutes. UO spawners are the same idea with a home range (median 10 in the dungeon sample, 2 in a sewer, 25 in one large dungeon), a count of 3 to 6, a 5 to 10 minute delay window, and weighted entries. EQEmu spawn groups choose one of several creatures per slot by weight with a group limit; the Forgotten Server's spawn is a centre, a radius and per-creature intervals.
- **Source:** rathena (GPL-3) `npc/pre-re/mobs/fields/*.txt` (shape; our aggregate above, nothing copied). ModernUO (GPL-3) `Distribution/Data/Spawns/shared/trammel/*.json` (6-file sample, medians above). EQEmu (GPL-3) `zone/spawn2.cpp`, `zone/spawngroup.cpp`. otland-forgottenserver (GPL-2) `src/spawn.h`. mobs.md section 4 already specifies slots, weighted groups, area cap and 2 to 3 minute respawn.
- **How it improves our duel:** A budget keeps a zone from feeling empty or crowded, and a ratio between camps, filler and singles gives the player a rhythm: roaming single enemies to fight any time, camps as set pieces, a named foe as the goal. It also bounds the preview's live creature cap (`TUNING.cap`).
- **Pit or world-only:** world-only.
- **Verdict:** TAKE the three-way split; ADAPT the numbers to our zone size and our cap. Our camps stay 2 to 3 creatures (mobs.md 3.3) because the duel is 1v1; the rAthena median of 3 matches.
- **Becomes:** `ZoneRow.population: { budget: n, fillerShare: 0.5, campShare: 0.4, singleShare: 0.1, camps: Camp[], fillerTable, singles: MobId[] }`, `Camp { center, radius: 8..20 m, count: 2..3, respawn: 150..180 s (mobs.md), entries: {mob, weight}[], leader?: slotId, post: 'free'|'stationed'|'patrol' }`. Check: the sum of counts never exceeds the cap; at least one camp and one single in every zone above tier 2.

## W6. Habitat curves: species density follows the land (Veloren)

- **Item:** Each creature type has a preference curve over the zone's attributes (temperature, cover, rock, wetness) and its density in an area is base density times how close the area is to that preference.
- **What it is:** Veloren's wildlife layer gives every species a density function: a base density times how close the local temperature is to the species' preferred value, times a terrain multiplier (tree cover for forest animals, rock for mountain animals, a rare chance only on high ground for a few). Spawn entries are packs: weighted groups with a minimum and maximum size, allowed times of day and a spawn mode (land, ice, water, underwater, air).
- **Source:** veloren (GPL-3) `world/src/layer/wildlife.rs` (read only: the densities list, the `Pack` and `SpawnEntry` structs and their doc comment).
- **How it improves our duel:** Zones look right and are explainable: a mere-side zone has mere-brood, a scorched zone has scavengers, without a hand-written table for every zone. It cuts the content-authoring load of 600 zones to a per-creature record.
- **Pit or world-only:** world-only.
- **Verdict:** ADAPT. Use three axes (cold-heat, cover, wet), not Veloren's full climate; skip air and underwater modes.
- **Becomes:** `MobRow.habitat: { heat: {at: 0..1, tol: 0.2}, cover: {at, tol}, wet: {at, tol}, weight: 1 }` and `ZoneRow.climate: { heat, cover, wet }`; the generator's weight for a mob in a zone is `weight * closeness(heat) * closeness(cover) * closeness(wet)`, then thresholded by the level window (W4). `packs: { min, max, dayPeriods: ('dawn'|'day'|'dusk'|'night')[] }` on the row.

## W7. Placement by weighted site kinds, same-kind spacing, retry budget, and avoid-class constraints (Veloren, 0 A.D.)

- **Item:** Landmarks and camps are placed by trying a weighted kind, finding a spot that respects distance from things of the same or hostile kind, and giving up after a few tries.
- **What it is:** Veloren first founds settlements, then runs a fixed number of attempts per civilisation: roll a site kind from a weighted list (giant tree, gnarling camp, chapel, pirate hideout, jungle ruin, and so on), find a place that keeps a minimum distance (40 chunks) from enemies of that kind, retry up to five times per attempt. 0 A.D.'s random map scripts place hills, forests, mines and food with "avoid classes": each feature class has a tile class, and each placement call lists classes to stay a given distance from, with counts scaled by map size.
- **Source:** veloren (GPL-3) `world/src/civ/mod.rs` (site generation loop, read only). 0ad-0ad (GPL-2) `binaries/data/mods/public/maps/random/mainland.js` (avoid-class placement calls; shape only).
- **How it improves our duel:** Not the duel. It produces zones where a camp never sits on the road, two landmarks never touch, and a boss camp never spawns next to the start gate, with one small declarative constraint list.
- **Pit or world-only:** world-only.
- **Verdict:** TAKE the avoid-class constraint list and the retry budget.
- **Becomes:** In the generator: `Place { kind, weight, count: scaleByZoneArea(min, max), avoid: { class: string, dist: m }[], attempts: 5 }`, classes `road`, `camp`, `landmark`, `start`, `water`, `edge`. Failure after the budget logs the zone seed and skips the placement; the zone still validates if its minimums are met.

## W8. Zone identity and landmarks: ambience, sky, one silhouette feature (Gothic zones, Morrowind cells, EQEmu fog)

- **Item:** Every zone declares its look and its one memorable feature as data.
- **What it is:** Gothic world files carry zone volumes for fog, far-plane and music (default and local). Morrowind cells carry ambient colour, sunlight colour, fog colour and fog density. EQEmu zones carry up to five fog sets with clip distances and a sky type. UO regions carry a music id and a "go here" point; the Arena wilderness chooses a skybox seed per location.
- **Source:** ZenKit (MIT) `include/zenkit/vobs/Zone.hh` (music, far-plane and fog zone structs). openmw (GPL-3) `components/esm3/loadcell.hpp` (ambient and fog struct). EQEmu (GPL-3) `common/repositories/base/base_zone_repository.h` (fog fields). afritz1-OpenTESArena (MIT) `LocationDefinition.h` (sky seed).
- **How it improves our duel:** The fight camera (375 wide) reads the zone's colour grade; a distinct per-zone palette is how a player knows where they are among 600 zones. The landmark is also the anchor for camps (W5) and quests (Q2).
- **Pit or world-only:** world-only (presentation and layout).
- **Verdict:** TAKE (data only; art is World's and Characters' lane).
- **Becomes:** `ZoneRow.look: { ambient, sun, fog, fogDensity, sky, music }` and `ZoneRow.landmark: { kind: 'tower'|'ruin'|'tree'|'monolith'|..., pos, silhouetteTag }`; validator: no two adjacent zones share a `silhouetteTag`.

---

# SECTION Q: QUEST STRUCTURE (8 items, each a data shape)

## Q1. Journal topic with status and appended entries (Gothic, Morrowind)

- **Item:** A quest is a named topic with a status and an ordered list of text entries; the player's journal is only that list.
- **What it is:** OpenGothic's quest log is a vector of quests, each with a name, a section (mission or note), a status (running, success, failed, obsolete) and a list of entry strings; new entries append, and an "obsolete" status on an unknown quest is ignored. Morrowind journals use an integer index per topic with a status bit on entries (name, finished, restart).
- **Source:** OpenGothic (MIT) `common/game/questlog.h`, `questlog.cpp`. openmw (GPL-3) `components/esm3/loadinfo.hpp` (quest status enum), `components/esm3/journalentry.hpp` and `queststate.hpp` (index per topic).
- **How it improves our duel:** Not the duel. It is the simplest durable quest state a server can save and a generator can emit.
- **Pit or world-only:** world-only.
- **Verdict:** TAKE.
- **Becomes:** `QuestState { id, section: 'mission'|'note', status: 'running'|'done'|'failed'|'obsolete', entries: {text, at}[] }` saved per hero; text comes from the template's message table (Q2), never stored raw in the world row.

## Q2. Procedural quest = template with typed slots and a task graph (Daggerfall Unity)

- **Item:** A quest is a small script with declared slots (a person, a place with a scope and type, an item, a foe class, a clock) and tasks, each a trigger plus actions; the generator fills the slots from zone data.
- **What it is:** Daggerfall quests are text: a message block with templated tokens (giver, place, days left) and a data block that declares resources then lists tasks. A place resource says whether it is local to the giver's town or remote and what kind. A task has a trigger (a click on a person, an item picked up, a foe killed, another task done, another-and-another combined with "when") and actions (say a message, place a person at a place, create a foe, start a clock, log a step, end the quest). A clock runs a same-named task when it expires. Headless tasks start on quest start; one task type persists until a condition then stops all its members. A quest registry lists the quests with group, membership, minimum rank or reputation and a one-time flag.
- **Source:** MIT. `daggerfall-unity/Assets/Scripts/Game/Questing/Task.cs` (task types), `Clock.cs`, `Place.cs` (local and remote scope), `Actions/*` (82 action files), `Assets/StreamingAssets/Quests/__DEMO0*.txt` (the DFU-authored demo shape only; the original-game quest text is not used or recorded) and `Assets/StreamingAssets/Tables/QuestList-DFU.txt`.
- **How it improves our duel:** Quests give fights a reason. A template with a `kill` task whose foe class is a mob from the zone's table (W4) makes every quest a Pit duel against a creature already in the world, so no new fight rules exist.
- **Pit or world-only:** world-only. Quest actions never alter a duel; a `kill` objective is satisfied by a normal win.
- **Verdict:** TAKE (best quest pattern in the set). Take the slot declarations, local or remote place scope, tasks with triggers and the clock. Skip most of the 82 actions (spells, diseases, face swaps).
- **Becomes:** `QuestTemplate { id, slots: { npc?: Role, place?: {scope:'local'|'remote', kind}, foe?: {tier, mobTag}, item?: {tag}, clock?: {days} }, tasks: Task[], messages: {id, text with {slot} tokens}[] }`, `Task { name, trigger: 'start'|'talk:npc'|'kill:foe'|'have:item'|'enter:place'|'clock'|'all:[tasks]', actions: ('say:id'|'spawn:foe@place'|'place:npc@place'|'give:item'|'clock:start|stop'|'log:step'|'end:success|fail')[] }`.

## Q3. Offer gating: registry rows with faction, rank or reputation, one-time flag (Daggerfall Unity, Morrowind)

- **Item:** Which quests a giver may offer is one table, not code.
- **What it is:** Daggerfall's quest list has a row per quest with the quest name, the group (a guild or a social class), membership (non-member, member, prospect, or a temple), a minimum requirement (a value under 10 means rank or hero level; 10 and up means minimum reputation) and flags (one-time, adult). Morrowind faction records list ten ranks, each with attribute, skill and reputation requirements, plus a table of how each faction feels about each other faction.
- **Source:** daggerfall-unity (MIT) `Assets/StreamingAssets/Tables/QuestList-DFU.txt` (header and schema only). openmw (GPL-3) `components/esm3/loadfact.hpp`.
- **How it improves our duel:** Gating by rank keeps the danger gradient (W4) honest: a quest never offers a fight above the hero's tier. It also gives factions a ladder to climb that is separate from the Pit's own rank.
- **Pit or world-only:** world-only.
- **Verdict:** ADAPT. Use rank and reputation requirements and a one-time flag; skip membership kinds beyond joined or not.
- **Becomes:** `QuestOffer { template, faction?, minRank?, minRep?, minLevel, maxLevel, oneTime, repeatAfter?: days }`; `Faction { id, ranks: Rank[10], rivals: {faction, stance: -100..100}[] }`, `Rank { name, repNeeded, levelNeeded }`.

## Q4. Faction line = ordered chain of templates with rank gates and rivals (Morrowind)

- **Item:** A faction's story is an ordered list of quest templates, each unlocking the next rank, with rival factions closing off as you rise.
- **What it is:** Morrowind faction advancement is rank-gated (the ten-rank table above), with a reaction table that makes some factions refuse members of others. The quests themselves are keyed by faction and rank in the dialogue filter (Q5).
- **Source:** openmw (GPL-3) `components/esm3/loadfact.hpp` (ranks, reactions) and `loadinfo.hpp` (rank and faction filters on dialogue). Public design knowledge for the quest content; none stored.
- **How it improves our duel:** Fights become chapters: each rung ends in a named duel (the faction's champion), which the Bounty system already pays.
- **Pit or world-only:** world-only; the duels are ordinary Pit fights with named profiles.
- **Verdict:** ADAPT. 3 to 4 faction lines of 5 rungs for v1.
- **Becomes:** `FactionLine { faction, rungs: { rank, template, champion?: MobId }[], joinTemplate, leaveRule, rivalClosesAtRank }`.

## Q5. Dialogue as a state graph with conditions, weights and journal side effects (GemRB, Morrowind, inkjs)

- **Item:** Conversation is a set of states; each state has a line, an entry condition and a weight; each transition has player text, a condition, actions and a target state, and may write a journal entry.
- **What it is:** In the Infinity Engine format a dialogue is a list of initial states in order: the first whose condition passes is used (or a weighted random pick among passing ones). A state's transitions each carry player text, a journal text reference, a condition, a list of actions and a next state, with flags for terminating the conversation and for adding a quest, solved or user journal entry. Morrowind's topic responses are a linked list filtered by speaker, race, class, faction, rank, cell and the hero's rank, first match wins, optionally running a result script. inkjs (MIT, the ink runtime) models the same with knots, choices, variables and visit counts.
- **Source:** gemrb-gemrb (GPL-2) `gemrb/core/Dialog.h` (state and transition structs, read as a schema). openmw (GPL-3) `components/esm3/loadinfo.hpp`. inkjs (MIT) `src/engine/StoryState.ts` (visit counts, variables).
- **How it improves our duel:** Short, cheap, testable conversation: a giver offers, the hero accepts or refuses, and the journal gets its line. It also lets a duel's win or loss feed the next line (a defeated champion speaks differently).
- **Pit or world-only:** world-only.
- **Verdict:** ADAPT. First-match-wins plus a weight tiebreak; skip ink's full language (ink is a good authoring tool but a heavy runtime for generated one-liners).
- **Becomes:** `Dialog { states: { id, line, when?: Cond, weight?: number, choices: { text, when?: Cond, do: Action[], next?: stateId, journal?: {quest, entryId, status?}, end?: boolean }[] }[] }`, `Cond` over flags, rank, faction, visit count and quest status (Q7).

## Q6. Objectives: kill, fetch, visit, talk with filters and time limits (rAthena quest database, Daggerfall clocks)

- **Item:** An objective is a typed row with a target filter, a count and an optional time limit.
- **What it is:** The rAthena quest database lists, per quest, a title, a time limit, kill targets (monster, count, optionally filtered by race, size, element, level range and map) and item drops from named monsters with a rate. Daggerfall clocks add a countdown in game days that fires a task on expiry.
- **Source:** rathena (GPL-3) `db/quest_db.yml` (header comment; shape only). daggerfall-unity (MIT) `Clock.cs`.
- **How it improves our duel:** Level-range and zone filters on a kill objective tie the quest to the danger gradient and stop trivial kills (grey creatures) from counting: the same grey rule as the pay ladder.
- **Pit or world-only:** world-only.
- **Verdict:** TAKE.
- **Becomes:** `Objective { type: 'kill'|'fetch'|'visit'|'talk', target: { mob?, tag?, zone?, levelMin?, levelMax? }, count, timeLimitDays?, countsGrey: false, dropRule?: { mob, item, rate } }`.

## Q7. Global flags and named quest variables (Daggerfall Unity, Gothic, GemRB)

- **Item:** A flat table of named integers and booleans lets quests and dialogue talk to each other and to the world.
- **What it is:** Daggerfall has 64 named global flags (a story-state bit for each important event), saved with the game. Gothic scripts keep a mission variable per quest and tests on whether an NPC has said a line. GemRB (Baldur's Gate engine) keeps global variables by scope, which dialogue and scripts read and write.
- **Source:** daggerfall-unity (MIT) `Assets/StreamingAssets/Tables/Quests-GlobalVars.txt` (schema). OpenGothic (MIT) `common/game/gamescript.cpp` (script externals, variables live in the proprietary scripts and were not read). gemrb-gemrb (GPL-2) `gemrb/core/Dialog.h` (conditions are evaluated by the engine). The Gothic mission-variable convention is public modding knowledge and was not verified in source.
- **How it improves our duel:** A defeated named creature, a freed camp or a closed rift can change the world for the hero (a zone's camps stay down, a vendor's prices change) without code: set a flag, and zone rows and dialogue read it.
- **Pit or world-only:** world-only.
- **Verdict:** TAKE. Namespaced keys, integer values, a hard cap per hero.
- **Becomes:** `flags: Record<string, number>` per hero with keys `zone.<id>.<name>`, `quest.<id>.<name>`, `faction.<id>.<name>`; Conditions in rows read them; a validator rejects reads of undeclared keys.

## Q8. Quest giver schedules (Ultima VII, Gothic routines)

- **Item:** A giver is somewhere in the zone at each time of day, from a short schedule.
- **What it is:** Each Ultima VII character has a list of schedule changes: a time in three-hour units, an activity (stand, loiter, wander, sit, eat, sleep, tend shop, patrol, and about 30 more) and a position. The game moves the character to the position and plays the activity when the time comes. Gothic's routines are the same idea with named waypoints.
- **Source:** exult-exult (GPL-2) `schedule.h` (activity list and the schedule-change struct, read as a shape); OpenGothic (MIT) `common/game/gamescript.cpp` (routine hooks). Our own gothic-routines.md is the prior read.
- **How it improves our duel:** Givers cluster at places and times, so a zone feels inhabited and a hero can plan: the guard captain at the gate by day, the fence at the fire by night. It also feeds the day and night lite in mobs.md section 3.4.
- **Pit or world-only:** world-only.
- **Verdict:** ADAPT. Four slots a day (not eight), a short activity list for v1 (stand, wander, sit, sleep, patrol).
- **Becomes:** `giver.schedule: { slot: 'dawn'|'day'|'dusk'|'night', activity, spot: LandmarkId|CampId }[]`; the quest offer is available only while the giver is at a place the hero can reach.

---

# Top picks from part B (ranked)

1. C1 situation-keyed tactic table with a "hero is winding up" reaction slot: biggest authoring gain inside the existing warden, no new moves.
2. C5 one-at-a-time token ring with an assist cap: keeps packs inside the 1v1 duel, already half specified.
3. W4 level window drawn from an ordered mob table, with a grey-aggro flag only in the deepest tier: the lever that makes 600 zones tunable and testable.
4. Q2 quest as a template with typed slots and a task graph: every generated quest ends in an ordinary Pit duel.
5. C2 signature kit with trigger, chance and cooldown range: one recognisable move per kind, capped by cooldown.
6. W5 population split into filler, camps and singles with a budget: gives each zone a rhythm and a hard cap.
7. C3 caster tells with a breakable flag and a shared timer: defines the interrupt answer with the tools we already have (kick, stagger).
8. W2 explicit directed travel graph with a connectivity test: turns a list of zones into a world.
9. C6 flee exceptions (pity, allies fighting, cornered, endsWhenAbove): deterministic, no dice, fixes the flee feel.
10. W6 habitat curves per creature: removes per-zone hand tables for 600 zones.

---

# Unverified, and what I did not do

- Not read this pass: OpenGothic perception code (relied on mobs.md 0.1, which cites it), ModernUO `MageAI.cs` beyond its range logic and dispel choice, EQEmu spawn code in detail (relied on mobs.md), the full Veloren agent file (read three handlers only), Wesnoth hunter and big-animal scripts beyond their parameter lists, gemrb dialogue loaders (read the struct only), Gothic Daedalus quest scripts (proprietary and not in a donor).
- Counts I computed: the UO sample is 6 spawn files (the script stopped at a 7th with a different record shape), so the medians are indicative only; the rAthena sample is 145 maps from `npc/pre-re/mobs/fields` (a regex pass; rows it did not match were not counted).
- The Kingdom Come, Mount & Blade, Souls, For Honor and Chivalry statements in C10 and C12 are public design knowledge from memory, with no source checked here.
- Every numeric "default" in a Becomes field is a proposal for Combat or World to tune on a build, not a measurement of ours. Combat numbers in C1 to C8 must be proven in the Pit under the RV gates before any row ships.
- No code was copied from GPL repos; where a donor gave a concept (the cancelable cast, the assist cap) it is restated in our words and our own field names.
