# Brief — the first enemy who is not the hero's twin (hand-off to a separate lane)

> Status 2026-09-16: step 1 (head) and step 4 (runtime, `veteran.glb` for the opponent) shipped as `veteran-v1`, named the
> **Veteran** — GAME_SPEC's Hoplite is shield-and-spear and the sim has neither, so a longsword man in bronze is a visual
> variant, not roster step 2. Steps 2–3 (heavier build; kit dye, helm + crest, greaves, scars) shipped the same day. Gate notes folded in below were
> found on review: the budget cap is in `scripts/check-budget.mjs` (raised to 12 MB), the crested helm needs the 1.87 m
> bounds ceiling raised, `warrior.glb` was hardcoded in the tests/harness/bake, and the crown fill assumed dark hair.

Owner (2026-09-16): the player is done ("perfect"); the opponent is currently the same man recoloured. A separate dev
does this so the hero lane stays clean. Read `src/assets/README.md` (every pass), `artifacts/character/README.md`
(harness), `BRIEF-body-pass-v36.md` (how the last passes were judged) and GAME_SPEC.md "Art direction" and "Roster".

## What we have on disk (checked 2026-09-16)
- `artifacts/source/base/…/Superhero_Male_FullBody.gltf` + `Superhero_Female_FullBody.gltf` (Quaternius Universal Base,
  CC0-style Standard licence), the Blender Studio realistic male/female bodies (`human-base-meshes`, CC0), the
  Universal Animation Library 1 + 2 (our 21 clips), the Modular Fantasy Outfits pack (Peasant + Ranger sets, both sexes),
  a bronze helmet we already author (`src/assets/source/items/helmet_bronze.glb`, `crest_red.glb`), the longsword.
- `~/Downloads/Bestiary - Dungeon Monsters Kit[Standard]` (Quaternius, free tier): **only two of the seven monsters —
  Imp (15.3k tris, 2.68 m, emissive horns) and Puglin (pig-goblin, 7.6k tris, 2.0 m).** Same 55-bone UE skeleton as our
  rig (ours adds the pinky chain and ball leaf bones), so our 21 clips would retarget directly. But they are cartoon-
  proportioned, saturated and glowing — GAME_SPEC's materials rule says no to all three, and the roster puts Orc/Goblin
  on *our* humanoid skeleton with reproportioning, monsters later. The goblin, ogre, werewolf and skeleton are in the
  paid SOURCE version only. No vampire, no ogre, nothing else downloaded.

## Recommendation: the Hoplite/Veteran — a second *human* on the same pipeline (roster step 2)
Cheapest, on-spec, and it kills "twins" outright. Same rig, same clips, same combat capsule (the sim is tuned for
equal-height fighters), same longsword move set. What changes is everything the eye uses to tell two men apart:
1. **A new photogrammetry head** from a different man: eight GPT portraits per `artifacts/source/face/GPT-BRIEF-jaw-shots.md`
   (front, ±35°, ±90°, three from below), older, broken nose, scar through the brow, greying close crop, heavier stubble.
   `node scripts/create-head.mjs` (KeenTools key in the owner's scratchpad `kt.env`, one billed job ≈ 4 min), then the same
   `head.py` path (`KT_GLB` → a per-fighter setting). `keentools_skin_tone` derives the body tone from the face, so a
   darker/olive or ruddier man re-tones the body for free.
2. **Body**: the same Studio body; optional +6–8 % on shoulders/arms via a `build_shape` (B2 in the body brief, skipped for
   the hero, fine for a heavier opponent) — or leave it.
3. **Kit**: bronze helmet (`helmet_bronze.glb` + crest), a different tunic (Peasant set from the outfits pack, or the exomis
   in an undyed grey with different grime), leather greaves, the pteruges in a different dye (the runtime already
   recolours `Heraldry` for the opponent), a scar decal or two on the skin tile.
4. **Runtime**: `src/characters.ts` (visual lane's file) loads `warrior.glb` for both fighters and recolours the opponent.
   Add `enemy.glb` (same skeleton + clips; the build script parametrised by fighter) and load it for the opponent.
   Budget: a second full GLB is ≈ +3 MB gzip (cap lifted by the owner, but keep textures at 1K where the phone can't
   tell); the leaner route shares the body/clips and ships only the enemy's head, kit and textures — more engineering,
   do it second if the budget bites.

Not recommended now: the Imp or Puglin (style clash, glow, cartoon proportions — would need re-texturing and
re-proportioning that costs more than a second human and still reads as a different game); buying the SOURCE bestiary
(the Orc/Goblin should come from our skeleton per the roster; a werewolf/ogre breaks camera and capsules).

## Acceptance
- Two clearly different men in the same arena shot at the phone camera; the opponent reads as older/heavier/scarred.
- Same gate (`npm run quality`), triangle cap per fighter, blade paths byte-identical, no change to the sim.
- Review folder `artifacts/character/enemy-v1/` with `face-front/left/right.png`, the phone still with both fighters,
  and a before/after against v41. Owner judges from renders; audit each step once and say what it caught.

## Pipeline reminders
`HEAD_PHOTO=1 HEAD_KT=1 blender -b -P scripts/character/parts.py -- --body realistic` → `node scripts/build-warrior.mjs`
→ `node scripts/bake-blades.mjs` → `node scripts/character-preview.mjs --label <x>` → `npm run quality` → PR into
`codex/01a09a76/task-1` → merge → ff → `bash scripts/deploy.sh` → `release.json` + served-GLB sha256 == local. Blender's
`Image.pixels` are raw bytes/255 (see README v37). Work in your own worktree; do not touch `~/Desktop/Business/frankendom`.
