# Brief 17 — THE KNIGHT (character lane brief)

Written by the Executioner lane on Lead's routing, 2026-09-22. **Owner widened this lane to the Knight on 2026-09-22**
("Your scope now includes the Knight (Brief 17) … The Executioner stays yours"), so this lane builds him; the Executioner
remains ours too. Reporting line is Lead.

Build order is the owner's: **the brief first** (this file), then the silhouette test at the fighter's camera **before any
model work**, AAA face and build judged on a **phone screenshot**, **one PR per deliverable with its receipt**, and
**nothing ahead of the shield in Combat's queue**.

## 1. What he is

**"the Knight"** — not "Iron Knight". Iron is the **Praetorian** tier material in the ten-tier ladder, and his plate has to
read at steel (Master), emerald (Invictus) and gold (Origin) too; naming him after one rung fights his own grade ladder.

Dom's own words, 2026-09-22: *"a masked heavy opponent wielding the maul, two-hand."* Lead's routing adds full plate,
closed helm, **no face**. Those agree — **masked is the requirement, the closed helm is the proposal** for meeting it, and
the silhouette test in §2 is where that proposal is judged rather than assumed. Identity: **cannot be cut — the player wins by breaking his
posture.** Profile: heavy guard, slow commits, punishes impatience.

Identity test: **posture-break finishes win; light-spam wins 0/24.**

## 2. Deliverable 1 — the silhouette test, run TWICE

Leading with it because it gates everything else and because it is cheap to get wrong.

Black shapes at the **fighter's camera**, beside the other nine, **before any texture work**. Run it twice:

- **Bare** — the honest pass. No kit, no weapon.
- **In loadout** — kit and maul on.

**The bare pass is the one that counts** (Multi Chars' refinement, adopted). A loadout-only silhouette passes trivially
because the kit and the weapon carry the read — and loot v2 makes gear **takeable**, so a silhouette that only works in
loadout breaks the moment a player takes the piece carrying it. A full-plate closed-helm figure is exactly the shape most
at risk here: strip his kit and he is a man-shaped block. If he fails bare, the answer is proportion and helm profile, not
a bigger pauldron.

## 3. What the hero rig buys — and what it does not

Same honesty as Brief 15 §2, not repeated in full: the hero rig buys the skeleton, the shared clip library and finisher
compatibility by construction. It does **not** buy the character — the body is a new TRELLIS build, new source image, new
reconstruction, new fit, new textures, new 45k-triangle budget. **"Hero rig" is not "cheap reskin"; the rig is the cheap
part and the body is the whole job.**

One free win, verified on trunk: `parts.py` carries `fit_finger_bones` (hero v44, #405, `parts.py:688`), so any humanoid
built through `parts.py` gets its rig knuckles fitted to its own mesh automatically.

## 4. The maul — what it actually is today, measured

Lead's routing says "existing family via `creaturePaths`; Weapons gives it a proper blade table on the hero rig". Checked
on trunk rather than inherited, and the gap is bigger than "a blade table":

- **The data already exists; the asset does not — and that split decides who does what.** `src/moves.ts:406` on trunk
  `3405a95`, read in full: `const MAUL: Weapon = { ...CLEAVER, id: 'maul', grip: 'two-hand', moves: { ...CLEAVER_MOVES,
  thrust: { ...CLEAVER_MOVES.thrust, stepIn: .3, reach: 1.4 } }, paths: creaturePaths(CLEAVER_PATHS, 'Maul'),
  guard: 'shaft', material: 'wood', fight: { thrustShare: .1, close: 1.15 } }`. So it is the **cleaver** spread with a
  two-hand grip, a longer thrust (`stepIn .3`, `reach 1.4`), cleaver paths under the `'Maul'` creature prefix, a
  `guard: 'shaft'` profile, `material: 'wood'` and a low `thrustShare` of .1. **"Maul, two-hand" is already true in the
  data.** `src/moves.ts` is **Weapons' file — this lane does not edit it**; the hero-rig **asset** is this lane's work.
- **Its geometry lives inside the held Minotaur's GLB.** `git ls-tree` finds no `maul` asset anywhere; the maul's
  materials (`MaulAshHaft`, `MaulLeather`, `WeatheredStone`, `MaulIronBands`) were measured inside `minotaur.glb` on this
  lane's own read. `build-creature-weapons.mjs` covers `minotaur` and `wraith` only.
- **The Minotaur is `hold: true`** — off the beta ladder and out of the beta bundle.

So the honest split: **the numbers are done, the object is not.** A hero-rig maul part and its blade/contact table have to
be authored, and no maul mesh exists anywhere in the repo to start from — `git ls-tree -r <trunk> | grep -ci maul`
returns **0**, and the Minotaur's maul geometry lives inside the **held** `minotaur.glb`. **Do not plan the Knight as
"maul already exists"** (the data does, the asset doesn't) and equally do not plan a new weapon family (it isn't one).
Re-verify with the two commands above before building.

`guard: 'shaft'` is worth noticing against his identity: he already blocks on the haft in the data. Whether that is enough
for "cannot be cut", or whether plate needs a rule that doesn't exist, is §7.3 — a question for Combat, not an edit.

Consequence worth stating: `MAUL.grip` is **two-hand**, and a two-hander stows the shield. The Knight therefore has **no
shield** — the shield-bearer is the **Shieldmaiden** (Brief 15, formerly briefed as "the Nord"; renamed and amended
2026-09-22 — a woman, and a new one-hand **bearded axe** family replaces the cleaver, hooking a held guard down). His "cannot be cut" identity has to come from plate and guard rules,
not from a shield.

## 5. The generator-hash bill

Per §7c of Brief 15, measured not assumed: `creature-check.mjs` digests `creatures.py` + `creature_pack.py` into one
`generator` hash pinned against every non-held family. A new pipeline character means a new entry in
`creature_pack.py`'s `base` map, which moves the hash and turns **every live non-held family stale**. Demonstrated on
trunk `beb3120`: baseline passes `dwarf, executioner, veteran`; add one `nord`-style entry → `AssertionError: Stale
creature: rebuild with build-creatures.mjs`; revert → clean.

**So the Knight's build PR rebuilds `dwarf`, `executioner` and `veteran` in the same PR, each shown accessor-equivalent to
trunk** (Dwarf v2 precedent). Plan it in; it is a cost, not a defect.

Two rebuild traps already paid for by this lane, to apply on day one:
1. `cb1ee6a`'s Run Through hold keys live in shipped rigs but not in donors — `scripts/character/sync-hold-keys.mjs
   <donor> <shipped>` (fixed for `executioner-v5` and `veteran-v1` in #398, live).
2. The `build-warrior` donor step is **not byte-reproducible across machines** — restore a donor from trunk and re-run
   fit/pack/Quiet-One instead of regenerating it.

### 5a. His six takeable pieces — named, mapped to the approved reference

Strategy's ruling (Dom, 2026-09-22 23:12): every character wears **six takeable pieces of his own** in the shared
library, each a `loot.glb` draw with tier materials — **nothing on the body is rig dressing**. If it reads as gear, it is
loot.

**Naming is not authoring.** All six are named here so the brief is checkable; the build order in §6 is unchanged —
Recruit-2 first, the rest as the kit library can carry them. Nothing is gated on six authored meshes.

Mapped to the owner-approved reference (#494, lean plate + great helm):

| Slot | Piece | From the reference? |
|---|---|---|
| `Helmet` | Great helm, flat-topped, slit visor and breath holes, over a mail coif | Yes |
| `Body` | Dark plate cuirass with squared layered pauldrons, over black mail sleeves; broad leather belt and a leather tasset skirt to mid-thigh | Yes |
| `Arms` | Polished steel vambraces and couters on the forearm | Yes |
| `Gloves` | Dark leather gloves | Yes |
| `Greaves` | Dark plate poleyns and cuisses over dark hose | Yes |
| `Boots` | Hard brown leather shoes | Yes |

**All six map, and that is the problem, not the success.** The Shieldmaiden's §5a has two slots the reference does not
fill, because she keeps identity the gear cannot take — pinned crown braids. The Knight's reference fills every slot,
which means deliverable 1 found exactly what the arithmetic predicts: **stripped, he is nobody.** Measured on the
approved reference (#502): shoulder-over-height **0.367 in kit, 0.246 bare**, widest point 0.41 to 0.257, and no feature
of the bare outline is his. The Executioner keeps his hood and hair, the Veteran his mass, the Shieldmaiden her braids.
The Knight keeps a thin man in hose.

**This is not only his.** The Pitborn lane ran the same bare pass on the Shieldmaiden's approved direction A and reports
the same failure (#498): 0.284 to **0.240** stripped, and the flat hard shoulder line A was chosen *for* turns out to be
the shoulder plates, which are lootable. Two of the launch characters now fail the same test for the same structural
reason, so the remedy is likely a roster-level decision rather than a paragraph in either brief — either an unlootable
identity element on the body, or an explicit ruling that stripped means generic. Recorded here because it changes what
this brief can promise; the decision is Lead's and Strategy's, and that lane has put it to them independently.

**Open question for Dom, not a decision taken here: the Knight needs one non-takeable silhouette feature of his own in
the bare build.** Because the ruling says nothing on the body is rig dressing, that feature cannot be gear — it has to be
the body. And §7's build instruction as routed, *"more bulky than the veteran, but thinner than the executioner"*, gives
the bare body nothing to be: applied to a stripped figure it specifies only that he is smaller than the character he is
meant to rival. This is a paragraph for the owner's letter, not a schedule item, and nothing waits on it.

**`Body` is a `replace` piece**, so it hides the player's own torso draws and is subject to the coverage floor already on
trunk: `tests/loot.test.ts:95` fails any `replace` piece whose draw area is under **80 % of the player's own draws in
that slot** (the Pitborn's 0.36 m² rag sash against a 1.36 m² gambeson, 26 %, is the bug that bought the rule).

Two things follow, and the second corrects an instruction this lane was given:

- The floor is **mesh surface area in m²**, compared against `warrior.glb`'s own `Gambeson` / `Leather.Body` draws — not
  against this character, and not a silhouette measure. **It therefore cannot be measured from the reference or from the
  #502 masks at all.** It is a test, and the test is the instrument; it runs the first time the Knight's `Body` draw
  exists in `loot.glb`. Saying "plate should clear 80 % easily" is a prediction, and so is saying it has been measured.
- The prediction is nonetheless a confident one and worth recording so a failure is surprising: a full cuirass with
  pauldrons and a tasset skirt to mid-thigh is a larger draw than a gambeson, and every piece that belongs shipped at
  103–159 %. If the Knight's `Body` comes in under the floor, that is a modelling defect to fix, not a rule to argue
  with.

**One gate interaction to flag rather than resolve here.** §6 gates deliverable 1 as "no texture work before it passes
**bare**". On the approved reference it does not pass bare. Read strictly that blocks the build, which is not what the
gate was for — the gate exists so a masked character is not modelled before its outline is known, and the outline is now
known, including the part that is missing. Lead and Strategy to say whether the open question above satisfies the gate or
supersedes it; this lane starts no model work until they do.

## 6. Deliverables and gates

| # | Deliverable | Gate |
|---|---|---|
| 1 | **Silhouette test, bare + loadout**, black shapes at the fighter's camera beside the other nine | **Owner reference image** (§7.5 — a masked character's silhouette *is* the design). No texture work before it passes **bare**. |
| 2 | **Body on the hero rig + versus still** | (1) + the same reference image, which is a **required input** — Dwarf and Executioner both had one, without it the first build is a guess. |
| 3 | **Maul on the hero rig** | **Weapons' lane, not this one.** Part + blade/contact table, delivered on the shelf; the combat lane flips it. Blocks his fight, not his body. |
| 4 | **Kit — Recruit-2 first**, the full six later | Not blocked (the Nord ruling applies: gating a new character on Multi Chars' kit library stacks two long poles). |
| 5 | **Fairness battery vs every offered weapon** (longsword, warhammer, trident, scythe) | (3). Identity pins intact, inside the wins/24 cap, **no weakened pins**. Light-spam must win 0/24. |
| 6 | **Finisher fits, measured per finisher** | (2). Measured, not asserted — a closed helm and full plate are the hardest case for Split Crown and Decapitation, which bake and cut a **head**. Expect this to be the real work. |
| 7 | **The ladder rung** | (5). Owner's call. |

## 7. Decisions — ruled by Strategy, 2026-09-22 (brief approved)

1. **Masked is Dom's requirement; full plate + closed helm is the proposal**, and the twice-run silhouette test in §2
   judges it, with the **bare pass counting**. Confirmed as written.
2. **The maul part is Weapons', on the shelf rule — this lane does not model it.** Lead confirms the handoff. This lane
   authors the character; `src/moves.ts` (where the maul's numbers already live) is not ours to edit either.
3. **"Cannot be cut" gets NO new sim rule.** Nobody writes plate immunity. His identity comes from three things that
   exist or are already in flight: (a) he wears the **heaviest kit**, so under Brief 19 he sits in the **top RES bracket** —
   numerically the hardest man to cut once gear stats land; (b) **`guard: 'shaft'`** is already in his weapon data;
   (c) his **AI profile absorbs and punishes instead of dodging**, so the way through him is the existing
   **posture-break → critical** path. **Win condition: break his posture, then the critical.** If beta shows him beatable
   by standing and swinging, **Combat retunes the profile** — the fix is a tuning pass, never a new mechanic.
   *(The RES bracket depends on Brief 19's gear stats landing; this lane has not verified that brief and does not own it.)*
4. **Finishers on a closed helm: no rule restriction.** The helm is part of the **head mesh** and splits or comes off with
   it. The **Finishers lane measures each fit** in deliverable 6, and any finisher that fails its measured fit is
   restricted for him **by list**, not by inventing a helm-off mechanic.
5. **Reference image** — confirmed a **required input gating deliverables 1 and 2** (Lead's correction, Strategy accepted,
   2026-09-22). **For a masked character the silhouette IS the design**: there is no generic shape to test until Dom picks
   one, so the twice-run silhouette test cannot start either. Strategy is asking him for it. **Until it arrives this
   character is blocked on Dom and on nothing else.**

## 8. Dom's mandate — verbatim, as routed

- **One PR per deliverable. No exploratory branches. No PR without its receipt image.**
- **Work from the state files and the brief; the PR body is the report.**
- **AAA bar is the Nightborn's TRELLIS.2 face and Dwarf v2**, judged on a **phone screenshot at the fighter's camera** —
  never a viewport render.
- Dom, 2026-09-22: *"brief the devs and let's get this done, fast and efficiently, minimal tokens with AAA grade visuals."*

## 9. Scope fences

- **The hero rig and the hero's assets are Character Main's.** This build *reads* the hero skeleton and clips; it never
  edits them. Anything that would touch them stops and goes to Lead.
- **`src/moves.ts` is Weapons'.** The maul's numbers are already there and correct; this lane authors the asset.
- **Nothing ahead of the shield in Combat's queue** (owner, 2026-09-22). The maul is content, not a rules change. **If
  this character turns out to need a combat-rule or AI edit to work, that is a request to Lead, not an edit by this lane.**
- **Not beta-critical.**
