# Tier kits — 100 looks: one per opponent per rank (RE-CUT, Hero Look for Lead review, 2026-09-27)

Status: **ACCEPTED by Lead as the design (2026-09-27), with two changes folded in: the Server section (B4) and the budget note (B2).** **Amended by `docs/briefs/tier-looks-runtime.md`:** rank looks stream in after first playable and swap on an idle beat; opponents hide their own look as a set; the fight's size limit is a CI time gate, not a byte cap (B1/B2 below updated). Re-cut on Dom's ruling (via Strategy and Lead, 2026-09-27 afternoon). It replaces the three-silhouettes / 30-set plan that Strategy approved at 10:5x. Of that plan's rulings, only these still stand: no helmet at Recruit, the Knight keeps his closed great helm, and head finishers are a READY gate. Docs only, no generation spend. Lead reviews the delivery design (part B) before anything is built.

## A. The looks

### The ruling
Every opponent has a distinguishable look at every rank: 10 opponents × 10 ranks = **100 looks.**

**Amended 2026-09-27 (Dom via Strategy; supersedes the LOW/MID/HIGH split in the table below and the generation count after it):**
- **Ten looks per opponent, one own GLB per rank**, same body, face, rig and weapon. Dom's own GPT generates them (no HF spend); Armour fits.
- **Material ladder** (a naming guide for GPT, not a lock): L1 rags, L2 leather, L3 bone/hide + first metal, L4 copper, L5 bronze, L6 iron, L7 steel, L8 blackened steel ruby-set, L9 emerald-set plate, L10 gold. The climb shows early (L3 is ten wins) without going over the top.
- **GPT's budget per look:** ≤35k armour tris, <12 MB, chest <20k, one GLB per rank.
- **The gate per look** (a look is a whole-body swap streamed on the idle beat, not a loot slot, so the 20k body-slot cap does not apply): the load-time A/B (head ≤ base + 1.0 s, tripwire 25 s) + two fight-camera stills at 375 (ready idle + mid-fight) with the gzip line. If a look fails the time gate, Armour cuts the chest harder first (LockBorder off on interior seams). What passes on the phone tier is that set's budget; record it per set here.
- **First sample:** the Goblin L3 (GPT's mid-tier study, approved by Dom). The fit took 7 min because the GLB came on the Goblin's own rig (65 joints, 25 clips, face and knife untouched). The cut is 81,667 tris / 11.98 MB raw. Next from GPT: Goblin L2, L4, L5, then L6–L10. Each one = a 7-min fit + time gate + the two stills. Legend names per rank are the #904 roster.

| Ranks | Levels | Mesh | How the three or four ranks differ |
|---|---|---|---|
| 1–3 Recruit, Legionary, Gladiator | 1–15 | **LOW:** today's kit, as built | three rank tints (rag & scrap, leather, bone) |
| 4–6 Veteran, Champion, Praetorian | 16–30 | **MID `mid`:** ONE new mesh per opponent | three rank tints (copper, bronze, iron) |
| 7 Master | 31–35 | **HIGH `master`:** own mesh | steel / blackened |
| 8 Primus | 36–40 | **HIGH `primus`:** own mesh | emerald |
| 9 Invictus | 41–45 | **HIGH `invictus`:** own mesh | gold |
| 10 Origin | 46 | **HIGH `origin`:** own mesh | obsidian-ruby |

The four HIGH looks differ in **real geometry and texture**, each with its own generation. Dom: "emerald plate is not a green rag". The rank tint (`src/rank-tint.ts`) is used only where a mesh spans several ranks (LOW, MID). HIGH materials come from their own bake. Emerald, gold and ruby inserts get a `null` class in `CLASS_OF`, as Ruby does today, so the tint never repaints them.

That is **50 generations**: 10 MID (the Centurion's is the Sand Legionary, done) + 40 HIGH, **GPT-generated, no HF spend** (Dom via Strategy, 2026-09-27: Dom's own GPT makes the meshes; Armour receives each set as an A-pose GLB with its source noted, fits it to the opponent's existing rig on the /hero-set Blender step, and ships stills: ready idle + mid-fight at the fight camera, 375 and 1280; Hero Look keeps the runtime). **Order:**
1. The Centurion bronze proof (Armour, cut-and-fit of the GLB we already have, no generation; fixes pending).
2. MID for the other nine.
3. HIGH, rank 7 up to rank 10.

**No HF credits are needed** (the ~$50 ask is dropped, Dom 2026-09-27). MID and HIGH start when Dom's GPT output lands with Armour.

### Rules every look obeys
1. **No helmet at Recruit** (the low helmet is hidden at rank 1). From rank 2 the helmet covers the head, with the face opening left open. The one exception is the Knight, who keeps his closed great helm at LOW.
2. **No face or rig changes.** Every piece goes over the opponent's own head and body, on his own rig.
3. **The weapon never changes.** Weapons belong to the Weapons lane. A shield is part of the look for the Centurion (scutum) and the Shieldmaiden (board shield) only.
4. **Identity survives every look.** The Plague Doctor's beak, the Witch's hood line, the Nightborn's Ruby crown, the Goblin's asymmetry and the Pitborn's shoulder mass stay at every rank.
5. **Silhouette first, material second, colour third** (armour-sets direction). Each HIGH look carries one or two big devices that read at the fight camera at 375: crest, pauldron mass, cape, horns, shield face.
6. **Head finishers are a READY gate:** Split Crown and Decapitation are checked on every new helm, with the Finishers lane, before that look can be marked READY.

### MID + HIGH per opponent (design lines for the generation prompts)
The HIGH looks within one opponent must differ from each other at 375 by outline, not just colour. The "device" column is what carries that difference.

| Opponent | MID (ranks 4–6) | `master` steel/blackened | `primus` emerald | `invictus` gold | `origin` obsidian-ruby |
|---|---|---|---|---|---|
| **Centurion** | Sand Legionary (done): red banded cuirass, crested helm, scutum | Black legion: spiked helm and pauldrons, dark scale, tall shield with a red stripe | Emerald-lacquered lorica, green enamel plates, transverse crest | Lion praetorian: gold Corinthian helm with a lion, lion-boss cuirass, lion shield | Obsidian plate, ruby cores at sternum and knees, black crest |
| **Goblin** | Scrap raider: one oversized spiked pauldron, strapped chest plate, horned bone helm | Blackened scrap: two mismatched spiked pauldrons, chain skirt, iron horned cap | Stolen jade: emerald shards bolted onto scrap, green-glass-studded helm | Scrap-king: gold-leafed scrap crown, trophy mantle, coin necklace | Ruby-eyed skull helm, obsidian spikes, blood-red rag mantle |
| **Pitborn** | Chain brawler: iron collar and chest chain, one massive shoulder guard, brow-ridge helm | Spiked gorget, a pauldron each side, knee-spiked plate greaves | Emerald-studded chains, green-bronze gorget, beast-skull helm | Pit champion: gold-banded arm plates, lion-mane mantle, gold visor band | Obsidian gauntlet-pauldrons, ruby-studded collar, horned black helm |
| **Nightborn** | Duellist: high-collar cuirass, short one-sided cape, open helm carrying the crown | Night blade: long split cape, blackened filigree vambraces | Emerald court: green velvet cape, emerald collar clasp, crown-helm with emeralds | Gold night-lord: tall gold collar framing the face, gold filigree plate | Obsidian cape of plates, ruby crown-helm (the crown motif carried) |
| **Executioner** | Headsman: iron-banded hood-helm, apron-cuirass, one chained pauldron | Peaked blackened hood-helm, tabard over plate, hook pauldrons | Emerald-glass mask band, green-black tabard, chain censer | Gilded headsman: gold peaked helm, gold-edged tabard, gold chain of office | Obsidian peak helm, ruby-set collar, black-red tabard |
| **Dwarf** | Hold guard: nasal spangenhelm, mail under a plated belt, stacked round pauldrons | Forge-black: rune-plate breastplate, anvil pauldrons, grille brow | Emerald rune-forged: glowing-green rune inlays, crested helm | Gold forge-lord: horned gold great-helm (face open), gold-banded beard guard | Obsidian anvil plate, ruby rune-cores, magma-red trim |
| **Shieldmaiden** | Shield-wall: spectacle helm, scale over the hauberk, fur mantle, iron-rimmed round shield | Blackened lamellar, raven-wing helm, iron-faced shield | Emerald scale, green cloak, emerald-boss shield | Valkyrie gold: winged gold helm, gold lamellar, gold sunburst shield | Obsidian scale, ruby-boss shield, red-black cloak |
| **Knight** | Sergeant: bascinet with raised visor, coat of plates, surcoat | Blackened full plate, fluted pauldrons, black tabard | Emerald enamel plate, green heraldic tabard, crest | Gold paladin: crested gold great bascinet (visor up), gold-trimmed plate | Obsidian plate, ruby cross on the breast, black-red crest |
| **Plague Doctor** | Warden: wide hat over a studded hood, studded cuirass over the coat, vial bandolier | Blackened plated beak, layered black capes, iron censer chains | Emerald-glass lenses, green waxed mantle, green vials | Gold-leafed beak and crowned hat, gold censers | Obsidian beak, ruby lenses, blood-red capes |
| **Witch** | Coven-bound: hood over a circlet-helm, dark scale corset, charm bracers | Blackened scale, iron crown-helm, black split robe | **Witch-Bound Emerald** (the direction brief's "amazing" reference): blackened scale, emerald inserts at chest, shoulders and forearms, spiked crown-helm | Gold occult: gold circlet-crown, gold-thread robe, gold talismans | Obsidian crown-helm, ruby inserts, black-red robe |

Pieces per look: the wearing six (Helmet, Body, Arms, Gloves, Greaves, Boots). A Crest is added wherever the design has one (Centurion, Knight, Executioner, Dwarf HIGH), and a Shield for the Centurion and the Shieldmaiden.

## B. Delivery (for Lead's review)

### Measured today (every number is gzip -9 of the build's output, `scripts/optimize-glb.mjs`)
- **Per fight today** (`check-budget.mjs` on the deploy dist, trunk dfeb25b9): the worst pairing is the Centurion at **9,898,909**.
  - Base: shell 501,089 + audio 769,729 + hero 2,204,002 + props 500,046 + shared textures 1,022,447 = **4,997,313**.
  - The Centurion: body 3,652,510 + textures 298,394 + versus still 90,829 = **4,041,733**, plus his LOW carriers 628,243.
  - Other pairings run 7.44–8.90 MB.
- **The hero's worn loot:** `loot.glb` **2,042,781** is fetched on its own and sits outside PER_FIGHT today. Counting it, today's worst is 9.90 + 2.04 = **11.94 MB**. That is the ~11.7 figure: the hero's loot is already most of the headroom.
- **The bronze MID proof** (Armour's `armour/centurion-bronze` b745a0e4, run through the same optimizer):
  - carriers-veteran: 627,105 → 1,328,358 (**+701,253 per fight**).
  - loot.glb: 2,039,145 → 3,007,151 (+968,006).
  - The set on its own: 1,286,239 (39.8k tris including a 6k-tri longsword draw; two 1024 maps, 428 KB of JPEG).
  - The **+1.45 MB** figure is the gzip of the source files, before the optimizer's meshopt and quantisation, so it overstates the cost about 2×.
  - Other opponents' carriers are unchanged in dist (goblin 208,325 → 208,303), because the optimizer drops the images they don't use.

### (1) One look per fighter per fight: base first, rank look streamed and swapped at an idle beat
- **The fight opens on the base look** (the opponent's body + today's `carriers-<opponent>`; the hero as he stands). That is all first playable waits for. At ranks 4–10 the opponent's MID or HIGH look **streams in after first playable** and replaces the base look on screen at the first idle/ready beat, as a set (`tier-looks-runtime.md`). It is never shown alongside the base look, and it never gates the fight. A look is at most 8 files (6 slots + Crest + Shield).
- **Look lookup** is one data table beside `GRADES`:
  - Recruit, Legionary, Gladiator → `low`
  - Veteran, Champion, Praetorian → `mid`
  - Master → `master`, Primus → `primus`, Invictus → `invictus`, Origin → `origin`

  The five look tokens are exactly `mid`, `master`, `primus`, `invictus` and `origin`. Ranks 1–3 are LOW and have **no suffix**: their ids are today's `<opponent>.<slot>`.

  The rank tint still applies on top, so low and mid show three ranks each.
- **Why not one file per look:** per fight it would work for the opponent, but not for the hero (part 2).

### (2) The hero: one file per worn piece, a hard cap per slot
The hero wears pieces from many opponents and ranks, so **the delivery unit is one piece file per (opponent, look, slot)**, with its textures inside it at a slot-sized resolution. A fully mixed hero loads **at most 8 files** (Helmet, Crest, Body, Arms, Gloves, Greaves, Boots, Shield). A piece that both fighters wear is fetched once (browser cache). LOW pieces move to the same per-piece files, so the hero stops fetching all of `loot.glb` (2.04 MB) to wear three pieces.

Two alternatives lose:
- **Per-look files:** 8 slots from 8 different looks = 8 whole sets ≈ 8 × 1.29 = **10.3 MB**.
- **Per-piece geometry with a shared per-look atlas:** 8 atlases × 0.43 = **3.4 MB** of textures alone.

**Per-slot caps** (gzip, enforced per piece file by check-budget). Measured basis: about 19 B/tri gzip for geometry, 1024 colour ≈ 232 KB, 1024 ORM ≈ 196 KB (the bronze bake). **Estimated, not measured:** 512 maps ≈ 60 / 15 KB, 256 ≈ 15 / 4 KB. Armour's first per-slot bake replaces these with real numbers.

| Slot | Tris cap | Colour / ORM | Cap (gzip) |
|---|---|---|---|
| Body | 20,000 | 1024 / 512 | 680 KB |
| Arms | 11,000 | 512 / 256 | 290 KB |
| Helmet | 3,000 | 512 / 256 | 135 KB |
| Crest | 1,200 | 256 / 128 | 45 KB |
| Gloves | 2,200 | 256 / 128 | 60 KB |
| Greaves | 2,000 | 256 / 128 | 60 KB |
| Boots | 1,500 | 256 / 128 | 50 KB |
| Shield | 3,000 | 512 / 256 | 135 KB |
| **Full look** | | | **≤ 1,455 KB** |

**The fight's size limit is a CI time gate, not a byte cap** (Strategy on Dom's words, 2026-09-27): first playable ≤ 20 s at 9 Mbps, which Web is building. Rank looks and the hero's worn MID/HIGH pieces load after first playable, so they are outside that gate by construction. The 12 MB worst-case sum drafted here earlier is withdrawn.

**The slot caps stay as build defaults**, for stream time and phone memory, not as a fight gate. Body stays at 20k tris; Body ORM at 512, small pieces at 256. The bronze proof's own set (1.29 MB with a shared 1024 atlas) would have to be re-baked into per-slot maps to meet them.

- **Levers held in reserve** (for stream time and phone memory), in order:
  - Body tris 20k → 15k (−95 KB a Body).
  - WebP instead of JPEG for the maps. This is a build change; I haven't measured it.
  - A lighter Centurion body for fights at ranks 4–10,; his first playable carries the heaviest base (4.04 MB).
- **check-budget change** (Deploy / Auditer implement, I specify): measure every look file against its slot caps. Look files are not added into any per-fight sum; the time gate measures first playable on the base look only.

### (3) Tier-keyed loot ids (the shape to agree with Armour)
- **LOW ids stay exactly as they are**: `<opponent>.<slot>` (`veteran.Greaves`), so every saved ledger, award and test stays valid. **MID and HIGH sit beside them** as `<opponent>.<slot>@<look>`: `veteran.Greaves@mid`, `witch.Body@primus`. Each look is a distinct collectable: the LOW Greaves and the MID Greaves are two items.
- **Not a third dot segment.** `veteran.Greaves.Bronze` is a **draw name** (`<opponent>.<slot>.<material>`); `materialOf` reads everything after the second dot as the material. A dotted look would be misread as a material.
- **Draw names inside a look file stay** `<opponent>.<slot>.<material>`. The look rides in node extras (`extras.look`) and in the file name: `looks/<opponent>@<look>.<slot>.glb`.
- **Code seams (small):**
  - `slotOf` strips `@look`.
  - `LOOT` gains the look ids per opponent.
  - `kitAt(opponent, tier)` returns the look ids for that tier.
  - The server's `awardFor` mirrors it: a kill at Champion awards `veteran.Body@mid`.
  - `isLootId` accepts the new ids.
  - Owning `veteran.Greaves` and `veteran.Greaves@mid` are two different pieces, both in the pack.
- **Acceptance: Armour's failing loot tests on `armour/centurion-bronze`** (reproduced; trunk passes both files, 12/12):
  - `loot-wear.test.ts:20` fails at "the same draw answers for every opponent that wears it — one mesh, not six". The bronze gloves took the id `veteran.Gloves` from the shared `~kit.Gloves`. With `veteran.Gloves@mid` they no longer do, and the test passes untouched.
  - `loot.test.ts:174` fails with "legionary: none of its pieces wears LegionaryIron…". The bake sits in `src/assets/source/loot/` (loot.glb's folder) while its draws are named `veteran.*`. Look bakes move to `src/assets/source/looks/<opponent>@<look>/`, outside loot.glb, and the test passes untouched.
  - A third failure on that branch, `loot.test.ts:74` (the Dwarf's greaves, `TypeError … reading 'mesh'`), does not happen on trunk. It is a side effect of that branch's `loot.glb` rebuild, and Armour's to check.
- **The rule:** both tests pass **without editing them.** Editing a test to fit the new shape does not count as acceptance.

### (4) Server: ids the database accepts, looks the server decides
- **The blocker:** `supabase/migrations/202609230001_server_awards.sql` constrains `piece ~ '^[a-z]{1,32}\.[A-Za-z]{1,32}$'` on `loot_claims.piece` (line 26) and `awards.piece` (line 59), so every `@look` id is refused at insert.
- **Fix:** a new migration widens both checks to `'^[a-z]{1,32}\.[A-Za-z]{1,32}(@[a-z]{1,16})?$'`. Every LOW id still matches, so no existing row is affected. Backend builds it, after #621 and #778.
- **The server decides the look.** verify-loot and `src/awards.ts` name the look from **min(record.level, the account's server rank level before the claim)** (Lead's ruling to Backend), then use the B1 table. That is the same shape as `awardFor`'s tier. An above-rank record (the debug picker, or a forged one) is **not refused but capped**, so an award never outranks the account. The server **never trusts a client-named look**: it awards the look it computed, whatever the claim says.
- **Uniqueness still holds per look.** The schema has no (user, piece) uniqueness to break: only one claim per record (global `record_hash`) and one award per claim (`claim_id` primary key). Owning `veteran.Greaves` and `veteran.Greaves@mid` is two awards from two fights. Any per-piece uniqueness added later keys on the full id, look included.

### (5) TOTAL becomes a server-storage number
- **Today's dist:** 43,653,166 of 44,000,000. That includes the hero preview (`public/herolook/`, about 4.05 MB), which is removed when the Centurion bronze proof lands.
- **50 new looks** at ≤ 1,455 KB each = **≤ 73 MB**. Measured-like sets (≈ 1.3 MB) come to about 65 MB.
- **LOW** stays as today (loot.glb 2.04 MB and the ten carriers), re-cut per piece at about the same total.
- **Projected total ≈ 43.65 − 4.05 + 65…73 = 105–113 MB gzip** of server storage. Nothing per fight grows beyond part 1. That is the number for Lead to re-rule TOTAL against.

## What this does NOT change
The hero (the Recruit, own face), any face or rig, any weapon, the take-screen rules (no stats in beta; the row is the pick), `WORN_FROM` (in beta, every piece is still worn from Recruit), and the tint code.
