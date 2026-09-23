# Multi-chars (scalable characters) — project state

The lane that makes a sixty-opponent roster affordable: the shared kit library, the grade ladder, loot pieces and the arena guard.
Asset-level entries also land in `character.md` (the character pipeline's own doc) — this file is the lane's standing state, not a copy of them.
Append new entries at the TOP. Keep evidence and remaining validation in every entry (AGENTS.md).

## Now — 2026-09-23, evening (handoff)

**UPDATE 19:0x — Phase R moved to tonight; the Witch's six are NOT shipped.** Work is on `multichar/witch-six` @ `c8d4380`
(off phase-r; nothing pushed into phase-r). `scripts/character/loot_dwarf.py` gained opt-in flags. The default path is the original
code, which is itself non-deterministic run to run (Dwarf Arms 722 vs 725 faces).
- `--boots` (feet → Boots), `--leg-radius 0.10` (leg-weighted verts far from the leg bone axis are robe → Body), `--boot-top 0.42`.
- `--weld D`, `--remesh Body,Greaves,Boots` (+ `--remesh-size`, `--remesh-ratio`; voxel shell → smooth → collapse, weights and
  UVs transferred back), `--no-skin` (drops her face from the hood), `--inflate 0.03`, and `--repose source/backups/veteran-v1`.
- **`--repose` is essential:** creatures.py binds a scan in its OWN A-pose (arms 74°), but loot binds to the player's T rest.
  Without it, bracers and gloves explode into sheets on the player. build-warrior.mjs now reads `<Family>Iron` maps for `['Dwarf','Witch']`.
- **Blocker: the robe surface.** Thin ragged TRELLIS cloth won't collapse-decimate (it stalls at 0.91), and the voxel shell reads as
  crumpled facets in the same-frame still (5,214 tris crumpled; 8,502 smoothed, over Lead's 8k). Needs a retopo'd or authored
  robe shell, not a remesh. Hood, bracers and gloves place correctly after `--repose`.
- The same-frame still = `public/game/img/fighter.webp` with `loot/witch.<Slot>.webp` alpha-stacked (loot-layers.mjs renders them
  in one frame). A loot build needs `artifacts/source` (gitignored): symlink it from another checkout.

**TOMORROW (2026-09-24), Dom's PRIORITY 1 via Strategy → Lead, 17:xx:** every opponent wears and offers SIX takeable armour
pieces + its weapon, Recruit rag & scrap first, **LIVE target 14:00**. Mine: **the Witch to all six**: Helmet = the hood,
Body = robe + cloak (per SCOPE.md), Arms, Gloves, Greaves, Boots; `witch.Trident` stays. Build on the **Nightborn lane's welded
pipeline once it lands (~09:00)**, not the untextured-Steel .12 cut (ruled out tonight). **One PR**; its body lists the six pieces,
their tri counts, loot.glb size, a same-frame phone still of the Witch WEARING them, and loot-layers green.

**Pick up:** nothing owed tonight (Lead, 17:04). The Witch is on `roster-v0` at `3707dee`; Combat retunes `ARCHETYPES.witch`
and makes the one RECORD_VERSION bump at 21:15 (`combat/bump8-roster` `64dc777` already carries 8). Reports go to **Lead only** (Dom).
Next Witch work when asked: finishers measured on her body (she ships `finishers: []`), then the cast clip, then the
Weapons lane's bladed staff replacing the stock trident. **Paused:** Greaves + `WORN_FROM` + stable drop index (WORN_FROM is post-beta).

## Done — 2026-09-23
- **The Witch moved launch → beta (Dom) and her real body is on roster-v0 `3707dee`.** Route: Kontext A-pose source
  (`docs/character-references/witch-source-v1.png`, prompt + json beside it) → TRELLIS.2 → `creatures.py` recipe `witch` on the
  frozen `source/backups/veteran-v1` donor (hero rig, trident clips). No new RigId, no bone scale, no parts.py.
  ROSTER `witch` (last rung, `finishers: []`), `ARCHETYPES.witch` = verbatim Veteran at scale 1 (by construction: the scan is
  normalised to the 1.80 m donor) as Combat's placeholder, `LOOT.witch = ['witch.Trident']`, `public/versus/witch.webp`.
  Receipts: `creature-check witch` 38/38 clips, 190 finite poses, 48,974 tris, worst grip gap 1.6 cm; per-fight 7,300,295 of 12 MB.
- **Brief 16 deliverable 1, the 3-way silhouette** (Witch / Shieldmaiden / Veteran, flat black, fighting camera): bare IoU
  0.578 / 0.672 / 0.620. Witch–Shieldmaiden is the least alike pair, so option (b) holds. Accepted by Lead.
- Flagged the dist TOTAL cap at 31.45 of 32 MB with three new bodies in; Lead raised it to 40 MB (`cd28ea4`), per-fight unchanged.

## Open
- `record-version-guard` is red on roster-v0 until Combat's 21:15 bump: the ONE expected red (Lead's rule; any other red is real).
- Witch hood/robe as loot carriers: **post-beta** (Lead: untextured Steel .12 cuts on TRELLIS surfaces read badly and turn loot-layers red).

## Gotchas — 2026-09-23
- **Kontext "arms out" webs a cloak wrist-to-ankle** (bat wings, which tear on every guard). Ask for arms ~30° off the sides and
  the cloak "behind her back only, not attached to her arms"; generate 3 seeds and pick.
- **`creatures.py` never recentred a scan.** Hers sat −5.5 cm in x at every height, so there's now a per-family `centre_x`.
  Measure band mid-x at 0.5/1.0/1.3/1.75 m before fitting any new scan.
- **Solve the arm from the scan's hand clusters, don't guess.** Compare the centroid (|x|>0.3, z 0.85–1.05) with the donor's
  posed `hand_l/r`. I guessed a y offset twice and made it worse; the gap was x (74° / 0.88). A narrower frame also needs its
  own arm edge, or the support hand gets no hand weights ("supporting hand detached (Infinity)").
- Silhouette "loadout" masks only show weapons **baked** into a GLB; the trident attaches at runtime, so the versus still is the loadout read.
- A fresh worktree can lack `@types/node` (typecheck:tests fails TS2688); `npm ci` fixes it.

## Now — 2026-09-22, end of session (handoff)

**Both coordinator sessions ended tonight.** Strategy's ended between issuing the tier instruction and my report; Lead
cleared shortly after and put its open items in **#504**. Their live decisions are recorded there and below so they do
not lapse. Nothing of mine is blocked.

**Open PRs, mine:** #495 (this doc), #470 (Brief 16), #474 + #478 (shield), **#510** (opponent tier, head `eb256b0`,
gate 470/0/2), **#513** (unscale fix, head `6836e2d`, gate 469/0/2).

**Next to author: the shared Greaves piece**, the moment #478 lands. Three opponents lack it — Pitborn, Goblin,
Nightborn (`src/loot.ts` `LOOT`) — and it is `over`, so the #434 coverage rule is satisfied by construction, the same
argument that put Gloves first. **Helmet second**, with the identity question answered in its own PR body: three
archetypes dropping one shared helmet reads worse than three dropping one shared greave, and that belongs in a PR
body, not inside an asset decision. **Boots third.**

**Library rule, from the Goblin lane's measurement — put it in the Greaves PR as a rule, not a note about the Goblin
(Lead's wording): pin a shaft by FRACTION of the calf's length, never by absolute height.** Girth at matched fractions
is identical to the hero's (254.1 vs 252.9 mm at 25 %), but the same fraction sits **18.3 mm lower at 25 % and 36.4 mm
lower at 50 %**, so an absolute-height shaft climbs past his calf belly. It bites **Greaves harder than Boots** — a
greave is all shaft and no foot. Also from that measurement: his foot is **not** re-proportioned (513 of 828 verts are
the hero's exactly, 0.00 mm after one rigid `(0, 0, +8.24 mm)` shift that falls out of the calf axis not being
vertical), but the 315 calf-weighted verts deviate up to 4.87 mm in the heel band, so a shoe cut on the hero's heel
sits ~3–5 mm proud at the back. Sole is at exactly `y = 0`; `BUILD.goblin.floor = .12` is the `Roll` clip's wrist lift,
**not** a sole offset. Receipt: `/tmp/frankendom-share/goblin-boots-measurement.json`, measured against
`src/assets/goblin.glb` sha256 `e5a4076d6417…` — ask again if that GLB is rebuilt.

**Boots cost line owed to Strategy with the Greaves PR: a bounded range labelled a floor, never one number.** The hero
already ships authored footwear in the `Boots` slot (`parts.py:446`, `:450`) at **4,192 tri for the pair**, but it is
a sandal plus an ankle band (42.9 mm, 53.4 mm), so a shafted boot is strictly more; `parts.py:521` anchors the other
end at "13k triangles undecimated". The Pitborn's own foot measurement is **queued** with that lane behind the
Shieldmaiden's slots and #478 — deliberately not expedited, since Greaves does not need it.

**Boots ruling, which reversed my proposal.** I argued a shared slot should only be worn by an opponent whose own kit
has it. Strategy overruled it on Dom's Brief 14 line of 18:10 — **from Legionary every opponent wears the full six,
Goblin and Pitborn included** — and the reframing is better: `barefoot: True` is a **Recruit-grade** fact, not a
permanent archetype one, so boots arrive at Legionary as kit fitted **over** the authored foot and **nothing rebuilds
`pitborn.glb`**, which was the part I cared about. The grade floor is Brief 14's general rule, not a barefoot special
case: at Recruit everyone wears 2 of 6.

**The grade-floor schema, approved and NOT yet built** (PR 1 of 3 is #510; 2 and 3 remain):
`WORN_FROM: Partial<Record<LootId, Tier>>` defaulting to Recruit, `LootId` and `LOOT` untouched — sharing is a fact
about the file, a floor is a fact about *when it is worn*, neither about the id. Pin becomes "LOOT lists exactly the
file's draws, every floored id still has one, an opponent below a floor does not wear that slot", mutation-proved.
**Strategy ruled the drop-order shift must be AVOIDED:** keep a stable index over the opponent's full list with
floored pieces **skipped, not removed**, so an existing player's sequence is unchanged minus what the opponent is not
wearing at that rung. `dropFor` picks `pieces[subRank(marks) % pieces.length]`, so a naive filter would change which
piece drops — cost the stable-index version in the PR body with the two rows it touches.

**The simulation boundary cost me a design and is worth knowing before the next one.** `src/roster.ts` is in `SIM`
(`eslint.config.js`) and `tests/sim-boundary.test.ts` lets SIM files import **only each other** — its regex catches
`import type` too. So the tier field could not live on `ROSTER`; it is in `src/grades.ts`, which already owns `Tier`,
`TIERS` and `levelOf`. **Stats imports `tierAt` / `OpponentAt` from `grades.ts`, never `roster.ts`**, and resolves the
loadout outside the sim. Lead had independently told Combat that Brief 14's `grade?: GradeRecord` goes on `ROSTER`;
same boundary, same wrong direction, corrected in #504.

**The Witch.** Approved reference is A, recorded below. **Strategy ruled the silhouette PR WAITS for the
Shieldmaiden's body** — no relaxed two-way, no reorder of Knight → Plague Doctor → Shieldmaiden → Witch. She is
**Pitborn's lane**, not the Executioner's (they wrote Brief 15 on assignment), and her body is gated on #478, so
Pitborn is the session to ask. Her bearded axe is a **new one-hand family** (~13 clips) per Brief 15 at `f6af593`, so
she and the Witch are close in cost and the Witch is not the expensive one by the margin Brief 16 claimed.

**Two measurement rules learned the hard way tonight, both from differencing things defined differently:**
1. **Never erode a mask you are about to difference, and define both masks in one function.** Three hole counts were
   quoted (20,677 → 6,973 → **5,056 px / 2.47 %, adds 0**); the first counted enclosed negative space, the other two
   were `MinFilter(3)` applied to one side or both. The background gate is **max per-row left/right difference ≤ 25**,
   not corner spread — and it cannot see a figure too bright to threshold, which is why the unlit **plate** (`--flat`,
   PR #500) is the second half of the gate.
2. **A bare figure is only comparable to another bare figure cut to the same slot list.** The roster's `LOOT` rows are
   not uniform, so "bare" is not one definition — annotate it with a *what survives stripping* column rather than
   normalising it away. D1 is **mattes, not plates**, for the four launch characters (no mesh), with the Executioner
   lane's matte-vs-plate delta carried as the uncertainty; plate the seven rigged fighters, re-plate each launch
   character from the day it has a mesh. The Witch's first appearance sits on the **reference** side of that delta and
   the PR must say so.

## Now — 2026-09-22, late
**In flight.** The Witch (Brief 16, #470) is mine as of tonight. Her reference sheet is generated and **Dom has picked A**:
**approved reference `docs/character-references/witch-a-deep-hood.png`, owner pick 2026-09-22 23:05** (relayed by Strategy, same line to Lead) —
deep pointed hood, long ragged cloak to the calves, face in shadow, bladed staff. That file is now the reference Brief 16 builds to;
`witch-b-hood-back.png` and `witch-c-wide-brim.png` stay committed as the rejected candidates, not as options.
All three, with their prompts and seed, are in `witch-candidates.json`; the assembled sheet is at `artifacts/character/witch/witch-sheet.png` (**not committed — `artifacts/` is
gitignored**, `.gitignore:4`). Method is the Nightborn lane's, not a script in this repo: FLUX.1-dev **Space** via `gradio_client`,
reusing `kontext.py`'s `token()`, seed 190926, 896×1152, guidance 3.5, 28 steps, from a throwaway script in the scratchpad. `kontext.py`
itself **cannot** do this — it is image→image (`--image` is `required=True`) and there is no text-to-image script in `scripts/character/`.

**The reskin check is open, and the reason is worth keeping.** The plan was to score each candidate's silhouette against the Nightborn's
(a hooded woman in dark layers is closest to *his* outline). Silhouettes come from each image's own pixels — median of three background
corners, mark darker than bg−18, `MinFilter(3)`, **per image**, because a single global cutoff turns a darker render into a solid black
panel. That method needs a plain background, so the script **measures the background before trusting it** and refuses above a spread of
25. His gameplay still came back `[151, 139, 212]`, spread **73**; a scan of every PNG in the Nightborn lane's evidence directories found
**the best spread anywhere is 51**. So no IoU was emitted rather than one that had thresholded the arena. **Blocked on one flat-background
render of the Nightborn**, which his own preview harness produces trivially — asked of that lane, not worked around here.

**Open, in order.** The six-slot kit library: 16 pieces still missing (Pitborn Helmet/Body/Greaves/Boots, Goblin Helmet/Greaves/Boots,
Dwarf Helmet/Body/Arms/Boots, Nightborn Greaves). **A design question blocks Boots**: the Pitborn and the Goblin are `barefoot = True` in
`parts.py`'s `KIT` (hero, veteran, nightborn and executioner are `False`, and the sandal loop at `parts.py:957` skips a fighter on that
flag), so under "every opponent wears six from Legionary on" they would drop boots they never wore. Either a shared slot may only be worn
by an opponent whose own kit has it, or the six-slot rule overrides the archetype and two fighters' `KIT` changes — and that second route
rebuilds `pitborn.glb`, which banks the Season-2 creature re-bake debt.

**Waiting on the publish hold, not on me:** #468 (creature-donor correction), #470 (Witch brief), #474 (shield spec), #478 (shield asset,
rebased on merged #461 at `04ac652`, gate re-run on the rebased tree: 466 pass / 0 fail / 2 known skips).

**Ruling that governs the Witch:** no body work until her dependency is on trunk; bodies land Knight → Plague Doctor → Shieldmaiden →
Witch, so she is last of four; her cast clip is last of hers; all four are launch scope, beta stays the six live archetypes.

**Next stage, and the two things that gate it.** Strategy's line with the pick (23:05) is: silhouette PR lands, then park behind the
beta-critical kit work, cast clip last. Two gates sit in front of that PR and neither is mine to clear:
1. **Brief 16's deliverable 1 is a three-way** — the Witch, the Shieldmaiden and a male archetype as black shapes at the fighting
   camera, run **bare and in loadout**. The Shieldmaiden is the Executioner lane's (Brief 15) and lands **before** the Witch in the
   bodies order above, so the three-way cannot be rendered until her body exists. A two-way against a male archetype only answers half
   the question the brief asks — whether two women on one rig read as the same person — so shipping that as the silhouette PR would
   pass for the wrong reason.
2. **The reskin check still needs one flat-background render of the Nightborn** from his lane — routing asked of Lead 2026-09-22.

## Shared draws, and gloves as their first customer — 2026-09-22
The schema change is in: a piece the whole roster wears is exported **once**, named `~<id>.<material>`, and loot.glb carries its own
`<opponent>.<slot>` → `~<id>` map so the file is self-describing and no second asset has to be kept in step. An opponent wears it with
`{"slot", "layer", "shared"}` in `loot.json` and contributes no geometry. Old-style per-opponent draws are untouched: `lootPiecesOf()`
gives every piece the ids it answers to and falls back to its own name, so **an old file and a new one both load** and the loader never
had to land in the same PR as the asset.

One correction to the ruling's arithmetic, in our favour: loot always binds to the **player's** rig, so a shared piece needs exactly one
fit here — the per-rig-family dimension only exists in the opponents' own fight GLBs, which loot never touches. The library is `~kit.*`,
not `~human.*`.

**Gloves** are the first piece through it: the only slot no opponent wore, fingerless (the fingers animate; a rigidly-bound glove over
them would tear open on a fist), fitted by raycast from the hand's own axis at six stations × 12 azimuths with a median fallback for rays
that miss — a hand is not a closed surface from its own axis, unlike the goblin's neck. **800 triangles for both hands, +7,524 B packed
gzip for all six opponents.** Under the old schema the same gloves would have cost 6 × 800 = 4,800 triangles and about six times the
bytes. Budget after: `loot 983,064 of 1,500,000` (check-budget on the dist build). Evidence: full gate 466 pass / 0 fail / 2 skips;
mutation-proved by suppressing the map write (the pin fails, 4 pass / 2 fail) and restoring it (6 / 0, file byte-identical).

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
- **The six-slot kit across three rig families.** Live today: Pitborn 1 armour piece, Dwarf 1, Goblin 2, Nightborn 4, Veteran 6,
  Executioner 6 — against a target of six from Legionary on. Sixteen pieces missing after the gloves; the remainder are per-opponent shapes, not one shared piece. Shared pieces fitted per rig
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
- **Creature donors — corrected 2026-09-22 against the code, because the first version of this entry (mine) was too broad.**
  `scripts/creature-check.mjs:39` pairs each family with its base: minotaur→`pitborn`, werewolf→`pitborn`, wraith→`nightborn`, but
  **skeleton→`source/backups/veteran-v1`**, executioner→`source/backups/executioner-v5`, dwarf→`source/creatures/dwarf-donor`. So the
  Skeleton keys on a **frozen backup**, not the live Veteran: rebuilding the Veteran fight GLB does **not** make it stale. And the three
  that do key on live fight GLBs are all `hold: true`, which the check filters out (`.filter(([id]) => !ROSTER[id].hold)`), so rebuilding
  `pitborn.glb` would not fail `creature-check` today either — it leaves a **latent re-bake debt** that bites when Season 2 unholds them.
  Gloves and the shield stay loot-only for that reason (and for not churning fight rigs), not because the gate would go red. Verify against
  the script before repeating either version of this.
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
