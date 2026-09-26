# Armour — project state

Lane opened 2026-09-26 15:2x +04 by Strategy on Dom's order ("open a new armour lane, as we have a weapons lane"). Append new entries at the TOP. Keep evidence and remaining validation in every entry (AGENTS.md). Folder `~/Developer/frankendom-armour`, session name **Frankendom - Armour**, key `armour`.

## Now — armour lane, as of 2026-09-26 16:3x +04 (replace this section wholesale; it is the restart brief, not history)

**Who you are.** You own every non-weapon piece a fighter can wear, across every opponent and the hero: helmets, crests, body, arms, gloves, greaves, boots, shields. Weapons stay with the Weapons lane. Web owns the loot panel and the Profile tab. You own what a piece looks like, how it fits, and how it grades by rank.

**Standards, no exceptions.**
- Every piece is built for the body it sits on; a piece offered to the hero is fitted to the hero's mesh (the crest lesson: a 49 cm crest over a 30 cm helm floats 11 cm).
- Real materials: colour, roughness/metal, normal. No flat unlit slabs.
- Rank grading (Brief 19 + ruling C): graded by the rung it was TAKEN at, map-preserving tint on metal, trim and leather only; cloth and the body never tint. Dom has not yet ruled on helmet-only ladder vs greaves/arms, or wraps as cloth.
- Every visual change ships 375-wide A/B stills from the fight camera and the Profile tab BEFORE any PR. Dom judges from stills.
- Phone first: maps ≤512 px per piece unless Lead says otherwise.
- **Fight-camera readability is the first gate** (Strategy, from the 2026-09-26 audit sheets): at the opening camera the hero is ~110 CSS px tall, back to camera, in shadow, and no helmet, body or greaves can be told from another. A piece is not done until it changes the hero's SILHOUETTE or his light/dark balance at the fight camera. Report a per-piece measure with every fix (proposal sent to Lead with the re-baseline milestone: changed-pixel share vs the bare hero inside the figure clip, above the idle-breath noise floor, plus the mean-luminance delta of the changed pixels).
- **Distinct shapes per opponent, not recolours of one mesh** (Strategy): of ten helmets only the Witch's hood and the Doctor's hat change the outline; greaves are ten near-identical tubes. The Nightborn coat, Shieldmaiden mail and Witch robe are the models.

**Order (Lead, 2026-09-26 16:0x), after #831 READY.**
1. loot-layers reproducibility → PR `armour/loot-layers-rebaseline` (this entry). Then:
2. Crest gets its OWN paperdoll slot (Lead ruling a): `crest` key in `src/loot.ts` PAPERDOLL, Crest out of `head`; a cleanLoot migration moving `equipped.head = '<x>.Crest'` to `equipped.crest` (never lost; owned/pack untouched) with a unit test and a release row; Web adds the Profile card (coordinate the slot id); Backend confirmed the server needs nothing (loot_claims regex accepts `<opponent>.Crest`, no key names checked). One older build open elsewhere drops the key until it reloads. Stills 375 + 1280 of the Profile with helmet AND crest worn.
3. executioner.Crest: the red plume is a bag over the whole head (scale + seat).
4. witch.Helmet: the hood is a tent over shoulders and chest, flat black.
5. plaguedoctor.Arms shoulder blobs + the hood drawing as two straps beside the beak.
6. goblin.Body neck-ring float.
7. Full-set clipping pass (done once, `--sets`: nothing new beyond the Witch hood-over-robe), then the opponents' OWN-kit pass at the fight camera (not shot yet).
8. Job 4: Dwarf greaves/boots on his own scan (NOT_WORN today).
HOLD (not mine now): white wraps ride the rank-tint handoff; flat mail/robe is the ten-armour-materials brief Strategy writes; shields over the FEET card is Web's.
Coming via Lead: Veteran's `veteran/centurion-crest` after Dom judges (then the hero's crest, floats 3.8–16.9 cm too); `char/rank-tint` = 7b264c40 (handoff note docs/proposals/rank-tint-handoff.md) after CM's sheet v2.

**How you work.** Read `AGENTS.md` and `PROJECT_STATE.md` first. Report to Lead, milestones only. PRs off trunk; the deploy session merges and ships. Heavy renders only after Deploy posts FREE, max 4 shards. Memory at `~/.claude/projects/-Users-domininclynch-Developer-frankendom-armour/memory/`. Past ~200k context at a task close: rewrite this section, save memory, `/clear`.

## Done today
- 2026-09-26: **#831 Plague Doctor hat** (armour/pd-hat-felt @ 5ffaf355): crown and brim on a new plain `Felt` material (roughness .9, cloth in grades.ts); the family's ORM atlas is 256 px and tops out near roughness .7, so no baked patch could go matte. plaguedoctor out of NOT_WORN. Stills origin/evidence/armour-pd-hat. Gate 677/0.
- 2026-09-26: **#832 contact-sheet harness** (`scripts/armour-contact-sheet.mjs`, `--sets` for whole kits): 64 hero pieces at the fight camera + Profile at 375, trunk 9b07457d; sheets origin/evidence/armour-audit-0926; the 16-item list went to Lead and became the order above.
- 2026-09-26: **loot-layers re-baseline** (this PR): two renders of one loot.glb diff byte-identical, so trunk's 12 differing layers (dwarf.Boots, the Knight's six, the Doctor's five) were stale, rendered before the KnightIron / PlaguedoctorCloth bakes. Re-rendered from trunk 639bf1e1's loot.glb; `loot-layers.mjs` now stamps the loot.glb + warrior.glb hashes into the style.css block and `tests/loot-layers.test.ts` fails when they drift. Before/after: origin/evidence/armour-layers-rebaseline.
- 2026-09-26: lane opened (folder, identity file, this doc).

## Open
- Dom's rulings on the rank sheet (helmet-only ladder? wraps as cloth?).
- Crest branch (Veteran) and `char/rank-tint` (Character Main), via Lead, after Dom judges.
- #831 CI → READY to Lead; it rebuilds loot.glb so it lands before Veteran's crest.

## Gotchas
- `node_modules` is a symlink to the strategy worktree's; run `npm ci` here if a check needs a clean tree.
- loot.glb is rebuilt from per-piece sources; do not hand-edit the built file. Pipeline after any piece change: `WARRIOR_LOOT=1 node scripts/build-warrior.mjs` (needs untracked artifacts/source with animations2: `~/Developer/frankendom-char` has it) → `node scripts/split-loot.mjs` (all ten carriers change bytes) → `node scripts/loot-layers.mjs` (deterministic; the stamp test catches a forgotten run).
