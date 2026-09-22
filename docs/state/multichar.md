# Multi-chars (scalable characters) — project state

The lane that makes a sixty-opponent roster affordable: the shared kit library, the grade ladder, loot pieces and the arena guard.
Asset-level entries also land in `character.md` (the character pipeline's own doc) — this file is the lane's standing state, not a copy of them.
Append new entries at the TOP. Keep evidence and remaining validation in every entry (AGENTS.md).

## Now — 2026-09-22
Brief 14's table is on trunk; the **loot manifest schema change** is next and nothing else starts before it. The file today stores one
copy of every piece **per opponent**, because a draw is named `<opponent>.<slot>.<material>`. That was right when every piece was authored
for one fighter and is wrong the moment the kit library is shared. Lead ruled (18:18) to take the schema change and **not** raise the cap:
one draw per (piece, rig family), the manifest mapping opponent + slot → shared draw + material, and **`LootId` stays `<opponent>.<slot>`**
so drop identity, provenance and the journal are untouched. The loader is Lead's; my file PR must resolve **both ways** — new manifest and
old-style draw name — so trunk survives the gap between my file landing and their loader.

Then the six-slot kit. **Gloves first**: the only slot no opponent wears today, so it is genuinely one shared piece rather than six; it is
`over`, so the coverage rule below is satisfied by construction instead of by measurement; and it is loot-only, so no fight rig is rebuilt.

## Done — 2026-09-22
- **#428 the arena guard** (Brief 13): one cheap shared lorarius, `WARRIOR_GUARD=1` on the hero rig — decimated body, cap, coiled whip,
  five clips, animation diet, own small skin crops. 231,620 B packed gzip against the 400 KB `guard` row after the first build came in at
  1,050,136 B; the fix came from **measuring** the packed breakdown (images 419,069 / geometry 495,676 / animation 29,272), not from
  guessing — my first guess, animation, was wrong. The world lane instances it six times (#430/#435): 148,404 tris, 86 draws, frame p95
  17.6 ms at the phone tier.
  Guard contract, measured off the shipped GLB: `Pace` travels **0.963 m/s at timeScale 1** (0.642 m forward foot separation, two steps per
  the 1.333 s cycle); there is **no `stride` userData** and there should not be (that is a re-proportioned rig's leg correction and the guard
  is the hero rig); `Raise` 0.50 s and `Lash` 0.60 s are LoopOnce + clamp; fingers and toes carry **no tracks at all** (stripped for budget —
  a finger that must move is a rebuild, not a runtime fix). **The world lane does not play `Turn`** (their decision, #435): a guard tracks the
  nearest fighter, which is a continuous heading, and `Turn`'s in-GLB `root.quaternion` track would compose with their outer-root yaw and spin
  him 360°. So a rebuild that changes or drops that root track cannot break them.
- **#434 the skin audit and the coverage rule.** Dom took a Pitborn chest piece and fought bare-chested. The reported cause was wrong and the
  correction is the finding — see Gotchas.
- **#438 → #451 the grade ladder.** Eight tiers first, then the owner's ten. `TIERS` is `career.ts`'s `TITLES` **itself**, not a copy, so a
  tier and a rank cannot drift and `levelOf(tier)` derives 1..10 — a `grade` record whose `level` and `tier` disagree is a data error rather
  than a second meaning. Recruit rag & scrap · Legionary leather · Gladiator bone · Veteran copper · Champion bronze · Praetorian iron ·
  Master steel · Primus blackened · Invictus **emerald** · Origin gold & ruby. A grade repaints metal, trim and leather only; cloth is the
  house dye (`grade.house`), so two opponents of one house wear the same linen over different metal. Two taste decisions defended in code:
  the Gladiator's bone steps **sideways** rather than up (four rungs of progressively better brown is worse than a landmark — pinned as less
  lit than the copper above it), and copper sits deliberately off bronze because Veteran and Champion are adjacent. Emerald at 9 is Dom's
  (18:15): blackened at 8 and black vanadium at 9 read flat against each other.

## Open
- **The manifest / shared-draw schema change**, with both-ways resolution. Blocks everything else.
- **The six-slot kit across three rig families.** Live today: Pitborn 1 armour piece, Dwarf 1, Goblin 2, Nightborn 4, Veteran 6,
  Executioner 6 — against a target of six from Legionary on. Seventeen pieces missing; **all six lack Gloves**. Shared pieces fitted per rig
  family by raycast, tiers as material variants on the same mesh.
- **The Veteran shield** (Dom GO 18:40), third in order. Loot-only (see Gotchas). Mine: the asset with **two transforms** — in the off-hand
  and flat on the back — plus the back attachment point on the player rig. Lead's: the equip/stow decision, the loader picking off-hand versus
  back by reading Weapons' `grip` field (ONE-HAND knife, cleaver, estoc, trident-as-spear; TWO-HAND warhammer, scythe, hero sword). Combat own
  the shield's fight rules; Web design own the panel copy.
- **The Dwarf's second Recruit piece.** Recruit wears 2 of 6 and he has one; Lead left the choice to me, with the constraint that it must
  cover at least what it replaces. To be justified in its PR body.

## Gotchas — the expensive ones
- **A sparse `replace` piece undresses the player, and neither vertex count nor bounding box catches it.** `pitborn.Body` was his rag sash at
  **0.359 m² against the player's 1.359 m² chest kit — 26 %** — and `layer: replace` hid the player's whole tunic to put it on. The sash spans
  nearly the tunic's full height, so only **triangle area** sees it. `tests/loot.test.ts` fails any `replace` piece under 80 % of what it hides
  (Helmet and Crest exempt: they hide hair). Everything that belongs measures 103–159 %; the one that didn't measured 26 %. Note the diagnosis
  that was reported — "the Body draw is skin" — was false: **no loot draw uses the `Skin` material anywhere in the file.**
- **A grade must never be a different mesh.** Tiers are material variants on the *same* piece, so the coverage rule above stays true by
  construction as the roster grows; a lighter tier replacing a heavier piece would otherwise undress the player by exactly that mechanism.
- **`LOOT` is pinned against the file's draws** (`tests/loot-data.test.ts`), so a slot declared without a mesh **fails the pin**. That is the
  behaviour we want, and it means slots land **with** their meshes — several asset PRs, not one data PR followed by art.
- **Two fight rigs are Season-2 creature donors.** `pitborn.glb` carries the Minotaur and Werewolf; the polished **Veteran** carries the
  Skeleton (`PROJECT_STATE.md`). Rebuilding either to hang a new slot on it makes a creature stale at `creature-check` **as a side effect of an
  asset change** — which is why gloves and the shield are loot-only. A Veteran visibly carrying the shield mid-fight is a Season-2 rebuild
  conversation with its own decision and re-bake, not something this lane absorbs quietly.
- **The budget arithmetic that forced the schema change.** `loot.glb` is **1,407,428 B packed gzip against a 1,500,000 cap** — 6 % headroom —
  carrying 19 pieces / 72,027 triangles. A complete six-slot set costs about **21,000 triangles** (the Veteran's six 20,412, the Executioner's
  six 21,730). Six opponents × six slots ≈ 126,000 triangles ≈ **2.4 MB, roughly 60 % over**. A per-opponent copy scales with the roster; a
  per-(piece, rig family) copy scales with the kit.
- **Budgets are measured on the packed dist file**, meshopt then gzip — not on the source GLB. A test that gzips the unpacked source would
  fail honest builds (mine did, before `optimizeGlb` went in).
- **Mutation-prove every new guard.** Restore the defect, watch the test fail, revert, confirm the asset is byte-identical and it passes. A
  guard never seen to fail isn't a guard. Done for the coverage rule (#434), the ladder-order drift guard (#451) and the material
  classification (#438).
- **A missing per-fighter KeenTools head used to fall back silently** to a generic CC0 head; it was caught only by an unexpected +3 MB size
  jump. `parts.py` now fails loudly (`HEAD_KT`).
- **`nightborn-estoc.glb` must stay byte-identical to `nightborn.glb`** or `tests/weapons.test.ts` hangs ~280 s on a Buffer deepEqual.
