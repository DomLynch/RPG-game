# Tier looks on fighters: stream after first playable, swap on an idle beat, hide the opponent's own look AS A SET (Hero Look, 2026-09-27; follow-up to #900)

Status: docs PR for Lead (Strategy's streaming ruling on Dom's words, and Armour's hybrid finding). Docs only; Lead assigns the runtime swap an owner after it merges. It amends `docs/briefs/tier-kits.md` (#900) B1/B2 in the same PR. Found by Armour in the Centurion bronze proof: the legionary helmet, greaves and boots went on over his own tunic and cloak and made a hybrid.

## Streaming: the rank look never gates the fight (Strategy on Dom's words, via Lead, 2026-09-27)
1. **The fight opens on the base look**: today's LOW look (the opponent's body + his `carriers-<opponent>`; the hero's `warrior.glb` as he stands). The rank look (MID/HIGH piece files, or a scanned rig's fitted figure) **streams in after first playable** and swaps on. The 100 looks add **0 s to time-to-fight, at any size.**
2. **When the swap happens:** only on the first **idle/ready beat**. Never mid-exchange (either fighter in an attack, parry, riposte or stagger phase), and never during a finisher or the kill-cam. A late look waits for the next idle beat. If the fight ends first, the look shows on the result screen or the next fight.
3. **The hero's worn pieces follow the same rule.** He opens in his base look, and his worn MID/HIGH pieces swap on at the same idle beat. The swap is one change per fighter, never piece by piece mid-fight.
4. **The size limit is a CI time gate, not a byte cap:** first playable ≤ 20 s at 9 Mbps (Web is building it). Look files are outside that gate by construction, because they load after first playable. B2's slot caps stay as build defaults for phone memory and stream time, not as a fight gate.

Consequences for the rest of this doc and for #900:
- **Scanned rigs:** the fitted look figure no longer "replaces `CreatureBody` in the fight download". The base body always loads first, and the look file streams after first playable and then hides `CreatureBody` as a set. Bytes add, time-to-fight does not.
- **#900 B1/B2 edits** (made in this PR):
  - B1 "one look per fighter, and it replaces LOW" → the base look loads first; the rank look streams after first playable and replaces the base look on screen at the first idle beat.
  - B2 "Worst case per fight … 11.95 MB of 12.00" and its budget note → the fight's size limit is the CI time gate (first playable ≤ 20 s at 9 Mbps). The rank looks stream and are not counted. Slot caps are defaults for stream time and phone memory. The Body 20k default is unchanged.
  - B2 check-budget line: drop "add the hero's worst case into PER_FIGHT". Instead, look files are measured against their slot caps, and the time gate measures first playable on the base look only.
- **Runtime swap owner:** assigned by Lead once this doc merges. Docs only here.

## The set rule
- **Opponent (tier look at ranks 4–10):** when a MID or HIGH look is on, **every one of his own look draws goes off and the tier look goes on, as a set.** There is no per-slot `replace` on an opponent. A look is all or nothing: at ranks 1–3 his own draws (plus the LOW carrier), at ranks 4–10 the tier look.
- **What stays on at every rank:** his identity draws (face, eyes, teeth, the separately drawn head, authored signature pieces named below), his skin where he has a separate skin draw, and his weapon.
- **Hero:** unchanged. Per-piece mixing stays as #900 B2 designs it, because the hero's own draws ARE cut by slot (`warrior.glb` draws carry `extras.slot`).

## Why per-slot replace fails on opponents (measured on trunk dfeb25b9, the fighter GLBs' own draws)
Two kinds of rig, and neither is cut by the loot slots:

**Built rigs** (Pitborn, Goblin, Nightborn, Shieldmaiden): draws are merged **per material**, not per slot. Several carry no slot at all (`Steel`, `Leather`, `Wrap`, `Antique brass` with `slot: ''`), so a Greaves `replace` cannot find the greaves inside the untagged `Steel` draw. The skin is its own draw (`Skin`), and the head is separate (`Face`, `Photo`, `PhotoEyes`, `PhotoTeeth`).

**Scanned rigs** (Centurion, Executioner, Dwarf, Plague Doctor, Knight, Witch): the whole costume is **fused into one `CreatureBody`** (`VeteranSurface`, `ExecutionerSurface`, ...), together with arms, legs and hands. Only the Centurion has his head in separate draws. On the other five the head is inside `CreatureBody` too. Per-slot hiding is impossible, and hiding `CreatureBody` as a set removes his skin (and on five of them his head) with it.

## Per opponent: what goes off, what stays
| Opponent | Rig kind | OFF under a tier look | STAYS ON | What the tier look must bring |
|---|---|---|---|---|
| Centurion (`veteran`) | scanned | `CreatureBody` (VeteranSurface), `Bronze.Helmet` | `Face`, `Photo`, `PhotoEyes`, `PhotoTeeth`, trident | **its own skin** (the generated figure's base body, which Armour's proof dropped) |
| Executioner | scanned, head fused | `CreatureBody` below the neck | his head (split out of `CreatureBody` at build), scythe | its own skin |
| Dwarf | scanned, head fused | `CreatureBody` below the neck, `Steel.Helmet`, `Antique brass.Helmet` | his head (split), warhammer | its own skin, at his proportions (`unscale: dwarf`) |
| Plague Doctor | scanned, head fused | `CreatureBody` below the neck | his head + beak (split), longsword | its own skin |
| Knight | scanned, head fused | `CreatureBody` below the neck | his head (split; the great helm is part of his look, so at ranks 4–10 the look's helm replaces it), maul | its own skin |
| Witch | scanned, head fused | `CreatureBody` below the neck | her head (split), trident / staff draws | its own skin, **female** (never the hero's body) |
| Pitborn | built | `Steel`, `Steel.Body`, `Antique brass`, `Antique brass.Body`, `Heraldry`, `Gambeson`, `Wrap`, `Wrap.Arms`, `BoneWorn` | `Skin`, `Face`, `Photo`, `PhotoEyes`, `PhotoTeeth`, `Bone` (slot Face), cleaver, and the untagged `Leather` (240 tris on hand_l/hand_r 50/50 = his weapon grips) | nothing extra: his `Skin` stays |
| Goblin | built | `Steel*` (4), `Antique brass*` (2), `Leather*` (2; the untagged one is 1,152 tris on spine_03 = torso belt and straps), `Heraldry`, `Gambeson`, `Wrap`, `Wrap.Boots`, `Bone` | `Skin`, `Face`, `Photo`, `PhotoEyes`, `PhotoTeeth`, knife | nothing extra |
| Nightborn | built | `Steel`, `Steel.Body`, `Antique brass`, `Leather` (112 tris on calf_l/calf_r = shin straps), `Leather.Body`, `Heraldry`, `Gambeson`, `Wrap` | `Skin`, face draws, estoc; `Ruby` crown stays at `mid` (the open helm carries it) and goes off where the look's own crown-helm replaces it (the HIGH looks) | nothing extra |
| Shieldmaiden | built | `Steel*`, `Antique brass*`, `Leather.Body`, the head-strap part of the untagged `Leather`, `Heraldry`, `Gambeson`, `Wrap`, `Wrap.Arms` | `Skin`, face draws, gladius, the grip part of the untagged `Leather` | nothing extra; her shield is part of the look |

**Leather draws, by dominant skin bone** (Armour, read from each `src/assets/<rig>.glb`): the untagged `Leather` is not one thing.
- **Pitborn:** 240 tris on the hands = grips (stay).
- **Goblin:** 1,152 tris on spine_03 = belt and straps (off).
- **Nightborn:** 112 tris on the calves = shin straps (off).
- **Shieldmaiden:** 460 tris on hand_r 42 % / hand_l 42 % / Head 15 % = grips plus a head strap. **Split at build by dominant bone:** the hand-weighted triangles stay with the gladius, and the Head-weighted strap goes off with her look (the tier look brings its own helm).
- **The scanned rigs** (Centurion, Executioner, Dwarf, Plague Doctor, Knight, Witch) have no skinned `Leather` draw. The unskinned `Leather` nodes listed among their weapon parts are weapon wraps and stay with the weapon.
- **The hero** (`warrior.glb`, 312 tris on pelvis = belt) is outside this table: hero mixing stays per piece.

## What this changes in #900
1. **Scanned rigs:** the opponent's look file is **a full fitted figure without a head**: the set plus the generated skin, fitted on his rig with the recipe (`creatures.py` HERO_SETS route, own head kept). It is not pieces laid over his body. At ranks 4–10 it streams in after first playable and, at the first idle beat, **hides his `CreatureBody` as a set** (see Streaming). It adds bytes after first playable, never time-to-fight.
2. **Head split at build** for the five fused-head rigs: `CreatureBody` → `CreatureHead` (kept at every rank) + `CreatureBody` (hidden under a look). Cut at the neck line per rig, like the hero fit's HEAD_SKIN in reverse. No face change: the same vertices, just split into two draws.
3. **Hero piece files** still drop the generated skin (Armour's loot-legionary step is right for the hero). Only the opponent's look file keeps it.
4. **Hands:** the generated skin brings the hand-sliver risk from the hero fit (hands hanging against the thighs take thigh weight). The unverified fix is on `herolook/sand-legionary` 587627c2 (weight smoothing walled at the hand). Each scanned-rig look's stills must show the sword hand in Attack, Heavy and Riposte.
5. **Built rigs:** the look is pieces over his `Skin`, all own look draws off. Loader change: hide by the OFF list above, not by slot.

## Acceptance
- A fight at rank 4+ opens on the base look and swaps at an idle beat: never mid-exchange, never in a finisher or kill-cam (runtime owner's test, once assigned).
- The Centurion bronze proof re-run with the set rule shows no own tunic or cloak under the legionary pieces (fight camera + kill frame, 375).
- One built-rig look (whichever MID comes first) shows no own `Steel` / `Leather` / `Wrap` draw under the look.
- Hero mixing unchanged: `loot-wear.test.ts` passes untouched.
