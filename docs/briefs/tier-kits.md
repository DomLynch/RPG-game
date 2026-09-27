# Tier kits — three silhouettes per opponent (DRAFT, Hero Look for Lead → Strategy, 2026-09-27)

Status: **proposal, docs only, no generation spend.** Lead routes it to Strategy; nothing is built until Strategy (and Dom where he wants it) signs off.

Order (Dom via Strategy, 10:4x): the hero stays the Recruit with his own face. The Sand Legionary GLB becomes the **Centurion's Bronze set** (tier 5 Champion, levels 21–25). Armour cuts and fits it on the Centurion's rig as the proof of the recipe. This table covers **the other nine opponents**.

## Fixed inputs (from trunk, not invented here)
- **Tier = the rung the fight is met at**, not a property of the opponent (`src/grades.ts` `tierAt`, Strategy 2026-09-22). So each opponent needs a kit for every rung, and three silhouettes cover the ten rungs.
- **Ten rungs, 46 levels** (`src/career.ts`): Recruit 1–5, Legionary 6–10, Gladiator 11–15, Veteran 16–20, Champion 21–25, Praetorian 26–30, Master 31–35, Primus 36–40, Invictus 41–45, Origin 46.
- **Material ladder, Brief 14** (`GRADES`): rag & scrap → leather → bone → copper → bronze → iron → steel → blackened steel → emerald → gold & ruby.
- **Slots** (`src/loot.ts` `ARMOUR_SLOTS`): Helmet, Crest, Body, Arms, Gloves, Greaves, Boots, Shield (+ the weapon). The wearing six are Helmet, Body, Arms, Gloves, Greaves, Boots. From Legionary up every opponent wears the full six (SCOPE).
- **Order of reading** (armour-sets direction): silhouette first, material second, colour third. The rank tint (`src/rank-tint.ts`, live) already carries the colour inside a band; it never carries a band on its own.

## The three bands
| Band | Rungs (levels) | Materials in the band | What the tint does inside the band |
|---|---|---|---|
| **Low: scavenged** | Recruit, Legionary, Gladiator (1–15) | rag & scrap → leather → bone | Recruit dull scrap; Legionary studs on hide; Gladiator's metal goes pale ivory (the one sideways step) |
| **Mid: forged** | Veteran, Champion, Praetorian, Master (16–35) | copper → bronze → iron → steel | warm copper → worn bronze → grey iron → bright steel (Master = the hero's own palette) |
| **High: masterwork** | Primus, Invictus, Origin (36–46) | blackened steel → emerald → gold & ruby | near-black → emerald → gold with ruby trim |

The bands match the direction brief's three design tiers (1–3 scavenged, 4–7 forged, 8–10 masterwork). **The silhouette changes twice, at Veteran (level 16) and at Primus (level 36).** Inside a band the mesh stays the same and the tint moves the material. Each silhouette is authored with the material classes the tint already reads (metal, trim, leather, cloth, bone), so no new tint code is needed. The Centurion's Bronze set is a mid silhouette.

## Rules every row obeys
1. **Helms cover from Legionary (tier 2) up.** At Recruit the low helmet piece is not worn, like today's "a Recruit's kit carries no crest" rule in `src/loot.ts`: a presentation line, not an award change. From Legionary the head piece covers the crown, back and sides. The mid and high helms add cheek guards or a nasal. The face opening stays open at every tier.
2. **No face or rig changes.** Every piece fits over the opponent's existing head and body, on his existing rig (hero rig for seven of the nine; the Goblin and Nightborn keep their own rigs). No re-sculpted heads, no new bones, no body swaps.
3. **The weapon never changes** (weapon identity; the Weapons lane owns it). The Shieldmaiden's shield is the only shield in the nine, and it changes with her.
4. **Gloves stay the shared `~kit.Gloves` mesh** for eight of the nine, tint only, because one mesh across the roster is the cheapest piece in the game. The Knight keeps his own gauntlets and they change with his set.
5. **Identity survives every band.** Each opponent keeps his signature at every tier (the Plague Doctor's beak, the Witch's hood line, the Nightborn's Ruby crown, the Goblin's asymmetry). A higher band is the same person better equipped, never a different character.
6. **Low = today's built kit** (Phase R, already in `loot.json`), plus a covering helm wherever today's head piece does not cover. That is the cheapest band, so most of the new build lands in mid and high.

## The table
Legend: **New** = a new mesh for that slot in that band. **Carry** = the same mesh as the band below, re-tinted. Today's piece names are from `src/assets/source/loot/loot.json`.

### Goblin (knife, own goblin rig)
| Band | Silhouette read at 375 | New | Carry |
|---|---|---|---|
| Low | Today: scrap cap, trophy necklace, one bracer, iron shin plates, rag foot bindings. Bare-chested runt. | Helmet only if the scrap cap does not cover the crown and back from Legionary (check at the still) | Body, Arms, Greaves, Boots, Gloves |
| Mid | Scrap-plate raider: one oversized spiked pauldron (left), a riveted plate over the chest held on straps, a horned bone-and-plate helm. Asymmetry up, still a runt. | Helmet (horned), Body (chest plate + straps, necklace kept), Arms (the big single pauldron) | Greaves, Boots, Gloves |
| High | Scrap-king: two mismatched pauldrons, a trophy-hung mantle of bone and horn, a crowned horned helm, plated shins. Cleverer and nastier, never comic. | Helmet (crowned horns), Body (mantle + trophies), Arms (second pauldron), Greaves | Boots, Gloves |

### Pitborn (cleaver, hero rig)
| Band | Silhouette | New | Carry |
|---|---|---|---|
| Low | Today: rag sash and belt worn over, bone plates on the arms, pit greaves and boots. A brute from the pits. | Helmet if today's does not cover (check) | Body, Arms, Greaves, Boots, Gloves |
| Mid | Chain-bound brawler: a heavy iron collar and chain across the chest, one massive shoulder guard, a squat open-faced helm with a brow ridge. Mass stays in the shoulders. | Helmet, Body (collar + chain, sash kept under), Arms (shoulder guard over the bone plates) | Greaves, Boots, Gloves |
| High | Pit champion: a spiked collar-gorget, a pauldron on each side, heavy plate greaves with knee spikes, a spiked open helm. The widest shoulders in the roster. | Helmet, Body (gorget), Arms (paired pauldrons), Greaves | Boots, Gloves |

### Nightborn (estoc, own nightborn rig)
| Band | Silhouette | New | Carry |
|---|---|---|---|
| Low | Today: night-noble tunic, arms, greaves, boots; the authored **Ruby crown** is his head piece (exempt from the tint, `CLASS_OF` Ruby: null). | From Legionary, a close-fitting coif under the crown so the head reads covered; the crown stays on top | Body, Arms, Greaves, Boots, Gloves |
| Mid | Duellist noble: a high-collared fitted doublet-cuirass, a short shoulder cape (one side), a sallet-style open helm the crown rides on. Slim at every tier; he is the fencer. | Helmet (open helm carrying the crown), Body (high-collar cuirass + short cape), Arms (slim vambraces) | Greaves, Boots, Gloves |
| High | Night lord: a long split cape to the calves, a tall collar framing the face, filigree plate on the forearms and shins, the crown built into a crested helm. The outline is the cape. | Helmet (crown-helm), Body (long cape + collar), Arms, Greaves | Boots, Gloves |

### Executioner (scythe, hero rig)
| Band | Silhouette | New | Carry |
|---|---|---|---|
| Low | Today: hooded helmet and crest piece, tunic, arms, greaves, boots. | Nothing if the hood covers (it should; check) | all |
| Mid | Headsman: a leather-and-iron hood-helm with a riveted brow band, a heavy apron-cuirass, one chained pauldron. The heaviest-looking low-to-mid step. | Helmet (hood-helm), Body (apron-cuirass), Arms (chained pauldron) | Crest, Greaves, Boots, Gloves |
| High | Grim headsman: a tall peaked iron hood-helm, a long tabard over plate, scythe-hook motifs on the pauldrons, plated greaves. Tall and narrow against the Pitborn's width. | Helmet (peaked), Crest (drop it or make it a peak finial), Body (tabard over plate), Arms, Greaves | Boots, Gloves |

### Dwarf (warhammer, hero rig, short)
| Band | Silhouette | New | Carry |
|---|---|---|---|
| Low | Today: iron helm, war-belt and apron, shoulder plates, greaves (worn off: they float off his calves, `loot.ts`), boots. | Nothing (the iron helm covers) | all |
| Mid | Hold guard: a round spangenhelm with a nasal, a mail shirt under a broad plated belt, stacked round pauldrons, plated boots. Squarer and heavier. | Helmet (nasal), Body (mail + plated belt), Arms (stacked pauldrons), Boots | Greaves (still off his calves), Gloves |
| High | Forge-lord: a horned or crested great-helm with a face-grille brow (face still open), a rune-plate breastplate, anvil-heavy pauldrons, plated boots. The squarest outline in the game. | Helmet, Body, Arms, Boots | Greaves, Gloves |

### Shieldmaiden (gladius + her board shield, hero rig)
| Band | Silhouette | New | Carry |
|---|---|---|---|
| Low | Today: cap, hauberk and mail skirt, arm plates, leg wraps, boots, board shield. | Helmet if the cap does not cover from Legionary (check) | all |
| Mid | Shield-wall guard: a spectacle helm (eye-ring brow, face open), a scale shirt over the hauberk, a fur-trimmed shoulder mantle, an iron-rimmed round shield with a painted device. | Helmet, Body (scale over hauberk), Arms (mantle), Shield (iron rim + boss + device) | Greaves, Boots, Gloves |
| High | Valkyrie guard: a winged or crested spectacle helm, lamellar over mail, a long cloak, plated greaves, a round shield with a metal face and a raised boss. | Helmet, Body (lamellar + cloak), Arms, Greaves, Shield | Boots, Gloves |

### Knight (maul, hero rig)
| Band | Silhouette | New | Carry |
|---|---|---|---|
| Low | Today: great helm, chest, arms, own gauntlets, greaves, sabatons, cut from his TRELLIS body. | Nothing (the great helm covers) | all |
| Mid | Sergeant-at-arms: a bascinet with its visor raised (face open), a coat of plates over mail, round couters and poleyns, a surcoat. | Helmet (bascinet), Body (coat of plates + surcoat), Arms | Greaves, Gloves, Boots |
| High | Paladin: a crested great bascinet (visor up), full articulated plate with fluted pauldrons, a heraldic tabard, gauntlets with cuffs. | Helmet, Body, Arms, Gloves (his own), Greaves | Boots |

**Knight risk:** his low helm is a closed great helm, which fights the "face open" rule once the face reads at the kill screen. Decide whether his low helm stays closed (today's look) or gets a visor slit wide enough to read. Needs Strategy's ruling.

### Plague Doctor (longsword, hero rig)
| Band | Silhouette | New | Carry |
|---|---|---|---|
| Low | Today: beak mask with matte Felt hat, waxed coat, arms, greaves, boots. | Nothing (hat + hood cover) | all |
| Mid | Warden of the sick: a wider-brimmed hat over a leather hood with iron studs, the coat with a studded leather cuirass over it, bandolier vials across the chest, riveted bracers. The beak stays. | Helmet (hat + studded hood, beak kept), Body (cuirass over coat + bandolier), Arms (bracers) | Greaves, Boots, Gloves |
| High | Plague lord: a tall crowned hat, a mantle of layered waxed capes, a plated beak (face behind it unchanged), censer chains at the belt, plated boots. | Helmet (crowned hat + plated beak), Body (mantle + censers), Arms, Boots | Greaves, Gloves |

**Plague Doctor rule check:** his beak IS his head piece, not his face; no face change is involved. A "plated beak" re-skins the helmet slot only.

### Witch (trident, hero rig)
| Band | Silhouette | New | Carry |
|---|---|---|---|
| Low | Today: hood, laced bodice, cross-gartered wraps under the robe, bracers, boots. | Nothing (the hood covers) | all |
| Mid | Coven-bound: a hood over a thin circlet-helm, a corset of dark scale, bone-and-metal charms on the bracers, a split robe. | Helmet (hood + circlet), Body (scale corset), Arms (charm bracers) | Greaves, Boots, Gloves |
| High | **Witch-Bound Emerald** (the direction brief's "amazing" reference): blackened scale mail, emerald inserts at chest, shoulders and forearms, a spiked crown-helm under the hood edge. Occult, never a wizard robe. | Helmet (crown-helm), Body (scale + chest inserts), Arms (shoulder + forearm inserts), Greaves | Boots, Gloves |

The Witch's high silhouette is where the direction brief's emerald set lands. Its emerald inserts are authored artwork, so they get a `null` class like Ruby and stay green at every high rung.

## Build count (what Strategy is pricing)
| | Low | Mid | High | Total |
|---|---|---|---|---|
| New pieces (upper bound; low helms only if the check fails) | 0–4 helms (Goblin, Pitborn, Shieldmaiden, Nightborn coif) | 29 | 39 | 68–72 |
| Opponent kits | 9 (built) | 9 | 9 | 27 |

Counting rules: Shield counted for the Shieldmaiden only, Gloves for the Knight's high only, the Executioner's Crest in high only. Cost per piece is the recipe's (generation + cut + fit), priced by Lead from Armour's Centurion proof, which is the first real measurement of that recipe on an opponent rig.

## Open questions for Strategy
1. **Band edges.** This draft uses the direction brief's 1–3 / 4–7 / 8–10. The other natural split, 1–3 / 4–6 / 7–10, puts steel (Master) with the masterwork. The draft keeps steel in mid because Master is the hero's own palette ("the player's equal").
2. **Recruit helmet off.** The low helmet is hidden at Recruit to honour "helms cover from tier 2 up". Confirm this reading, not "no helm piece exists at tier 1".
3. **Knight's closed helm at low** (above).
4. **Finishers.** Split Crown and Decapitation hit the head. Every new helm must pass the Finishers lane's head-split check. Mid and high helms are bigger than today's, and a bigger helm is more likely to clip a split.
5. **Budget.** A fight shows one opponent in one band, but today `loot.glb` ships every opponent's pieces in one file. So 68–72 new pieces either grow every fight's download, or they need the file split per band so a fight loads only its own. Either way the storage headroom (374 KB left after the hero preview; it comes back when the preview flag is removed) blocks any build until Lead and Deploy decide.

## What this does NOT change
The hero (Recruit, own face), any face or rig, any weapon, the take-screen rules (no stats in beta; the row is the pick), `WORN_FROM` (every piece still worn from Recruit in beta), and the rank tint's code.
