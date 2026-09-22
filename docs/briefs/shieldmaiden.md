<!-- Moved here from the Executioner lane's artifacts/ (gitignored) so Strategy can review it as a PR.
     Amendments since it was written, all from Dom via Strategy on 2026-09-22 night, applied below:
     - The character is a WOMAN, "the Shieldmaiden" (roster rule: two women, eight men — her and the Witch).
     - A new one-hand BEARDED AXE family replaces the cleaver as her weapon; it hooks a held guard down. Sequenced
       with her, after the estoc stack, and it does not take Combat's time before the shield lands.
     - Deliverable 1's silhouette test runs TWICE, bare and in loadout: loadout-only passes trivially because the kit
       and weapon carry the read, and loot v2 makes gear takeable, so a silhouette that only works in loadout breaks
       the first time someone takes the piece carrying it. Three-way against the Witch and a male archetype.
     - Brief files are docs/briefs/<name>.md; the BRIEF- prefix was the gitignored-artifacts convention.
     - The shield is ONE asset: Veteran/Centurion base, hers a material variant and a size. If the round shape needs
       its own mesh, that is raised as a scope item before authoring, not absorbed.
     - Open, Dom's call, caused by the trident being two-handed (verified on trunk): the Centurion cannot hold a
       shield while wielding it, so "the Centurion carries a shield from Legionary" was written on wrong data. -->

# Brief 15 — THE SHIELDMAIDEN (character lane brief, 2026-09-22)

Written by the Executioner lane on Lead's assignment (22:00). **Brief only — nothing built.** Strategy reviews tonight.

Trunk read: `f480728`. Live: `607126a`. Loaded: `CLAUDE.local.md`, `docs/state/multichar.md`, `docs/state/character.md`
(Dwarf v2, Grade materials, Arena guard), `docs/state/combat.md` (the shield ruling), `src/roster.ts`, `src/career.ts`,
`src/moves.ts` (grip/guard-override comments), plus this lane's memory.

## 1. What he is

A Viking **woman**: tall and strong, braided, fur and mail, round shield. Display name "the Shieldmaiden" (Dom may rename; ids may use `shieldmaiden`). Seventh archetype of the ten-archetype launch roster.
She carries the **bearded axe** — a NEW one-hand family (header amendment, Dom via Strategy, 2026-09-22), so **this brief does**
**add a weapon family**. The cleaver reading below was written before that amendment and is corrected in §2: the bearded axe
is sequenced after the estoc stack and takes none of Combat's time before the shield lands, but it is not free.
She is the game's **shield-bearer**: the shield from the shield brief is his always-on trait, built once for him and
reused by the Centurion from Legionary grade.

Profile: a shield wall that punishes light spam and opens on heavies.
Identity test: **"beaten by breaking the shield, not out-trading it."**

## 2. What the hero rig actually buys — and what it does not

Lead is right to ask for this straight. The Shieldmaiden is `rig: 'hero'`, same as the Veteran, Pitborn, Executioner and Dwarf.

**It buys:**
- The hero skeleton and therefore the whole shared clip library — every family already authored on it binds to her with no
  refitting. **This no longer buys her base fight loop for free.** The pre-amendment brief rested "zero new animation authoring"
  on her carrying the Pitborn's `Cleaver_*` set; the bearded-axe amendment removes that saving, and the brief understated its own
  cost until this correction. A new one-hand family is ~13 clips to author against the hero skeleton, on Weapons' and the
  animation pipeline's time, not Combat's. What the rig still buys is that those clips need no per-character fitting.
- Finisher compatibility by construction: Split Crown's head bake, Run Through's hold, the Quiet One corpse, Decapitation
  — all keyed to hero bone names.
- The `guard.glb` pipeline's production techniques: own skin crops, animation diet, decimated body, measured packed
  breakdown (images / geometry / animation) rather than guessed budget.

- **Correct knuckles for free.** `parts.py` carries `fit_finger_bones` (hero v44, #405, on trunk at `parts.py:688`):
  any humanoid built through `parts.py` gets its rig knuckles fitted to its own mesh automatically. The Shieldmaiden included.
  Not yet written up in `docs/state/character.md` in the new-humanoid form — that file covers the rebuild case only.

**It does not buy the character.** The guard reused the hero *body mesh*; the Shieldmaiden does not. He is a new TRELLIS build
exactly as the Dwarf was — new source image, new reconstruction, new fit, new textures, new 45k-triangle budget spent.
The guard came in at 231,620 B packed only because its body was the hero's. **Nobody should read "hero rig" as "cheap
reskin"**: the rig is the cheap part, the body is the whole job.

## 3. What the shield actually does in the sim — Combat owns this, the Shieldmaiden inherits it

Stated, not assumed, from `docs/state/combat.md` (Combat lane, owner GO 18:40, 2026-09-22):

> The shield is a **GuardProfile, not a damage multiplier**: it covers **two of the five guard sides**, sets `stopsHeavy`
> (a heavy no longer breaks the guard), and is cheaper to hold (costScale down). **No flat attack penalty** — the one-hand
> weapon table is the attack cost. The only legible cost is that posture drains faster while the shield guard is held, so
> a shield turtle is not available.

Consequences this brief accepts rather than relitigates:
- **The Shieldmaiden defines no shield rule.** Not the sides, not `stopsHeavy`, not the costScale, not the posture drain. If his
  fight does not read right, the fix is a conversation with Combat, not a number in this lane.
- **`grip` is Weapons' field** (ONE-HAND knife/cleaver/estoc/trident-as-spear; TWO-HAND warhammer/scythe/hero's sword).
  The bearded axe is ONE-HAND per the amendment, so the Shieldmaiden holds shield and axe together with no stow case in her own
  fight — the one property the cleaver plan was relied on for that the axe preserves.
- **His profile must actually be raised by his AI.** Combat's own bar for the Veteran applies here: "a profile he never
  uses is the same bug as a tell nobody can see."
- **The identity test is unreachable until Combat's shield slice lands.** "Beaten by breaking the shield" is not
  measurable against a shield that does nothing. Combat's queue is knife → cleaver → estoc → shield and **none of it
  moves for this** (Lead, explicit). So deliverables 3–5 below are gated on that slice, and the Veteran's
  "start at Gladiator instead" fallback does **not** transfer — the Shieldmaiden's shield is always-on, so he has no beta-safe
  degraded form. **If the shield rules miss beta freeze, the Shieldmaiden does not ship; he does not ship shieldless.**

## 4. Does this imply a fight-GLB rebuild? Yes — and exactly which

Lead asked this because `pitborn.glb` and the polished Veteran are Season-2 creature donors. The precise answer:

- **`pitborn.glb` is NOT rebuilt.** It is a donor (`base`) for the Minotaur and Werewolf, not a creature family itself;
  nothing in this brief touches it.
- **The Skeleton is NOT put at risk by a Veteran rebuild.** Its donor is `src/assets/source/backups/veteran-v1.glb`, not
  the live `veteran.glb` (`creature_pack.py` `base` map). Rebuilding `veteran.glb` leaves the Skeleton's donor untouched.
- **But a TRELLIS Shieldmaiden is a new creature family, and that does imply a rebuild — measured, not assumed.**
  `creature-check.mjs:11` digests `creatures.py` + `creature_pack.py` into one `generator` hash and pins it against every
  non-held family's stored `creatureSource.generatorSha256`. Experiment on trunk `beb3120`, 2026-09-22: baseline
  `creature-check` passes `dwarf, executioner, veteran`; adding a single `"nord": "source/creatures/nord-donor"` entry to
  the `base` map and re-running gives `AssertionError: Stale creature: rebuild with build-creatures.mjs`. Reverted, tree
  clean. So the Shieldmaiden's build PR **must rebuild every non-held creature in the same PR** — today `dwarf`, `executioner`,
  `veteran` — and show each accessor-equivalent to trunk. Dwarf v2 precedent (`character.md`: "Generator hash moved
  (creatures.py), so every creature is rebuilt in this PR"). This is a cost to plan for, not a defect.
- **Two rebuild traps this lane has already paid for**, both to be applied on day one rather than rediscovered:
  1. `cb1ee6a`'s Run Through hold keys were patched into shipped rigs but **not into the donors**, so any rebuild
     regressed the raised-palm hold. `scripts/character/sync-hold-keys.mjs <donor> <shipped>` fixes a donor; run it on
     any new Shieldmaiden donor and re-verify the three existing ones (PR #398, pending).
  2. The `build-warrior` donor step is **not byte-reproducible across machines** — restore a donor from trunk and re-run
     fit/pack/Quiet-One rather than regenerating it, or the diff is noise.

## 5. Deliverables, in Lead's order, with what each is gated on

| # | Deliverable | Gate |
|---|---|---|
| 1 | **Body on the hero rig + versus still** | None. Can start on Strategy's go. Source image → TRELLIS (Dwarf used resolution 1536) → fit → 45k triangles → versus still at the owner's angles. |
| 2 | **Kit — all six named (§5a), Recruit-2 authored first** (Lead, 09-22; six-slot naming per Strategy, 09-22 23:12) | Not blocked. Gating a new character on Multi Chars' kit library stacks two long poles (their schema change is critical path and all six live opponents still lack Gloves), and Recruit-2 is what every archetype wears today. Tiers are material variants on shared meshes; the ten-tier ladder is `career.ts`'s `TITLES` (Recruit rag & scrap → Origin gold & ruby, Invictus emerald). `LOOT` is pinned against the file's draws, so slots land **with** their meshes — several asset PRs, not one data PR. |
| 3 | **Fairness battery vs every offered weapon** (longsword, warhammer, trident, scythe today) | **Blocked on Combat's shield slice.** Inside the wins/24 cap with identity pins intact, no weakened pins. |
| 4 | **Finisher fits, measured per finisher** | Needs (1). Measured per finisher, not asserted — hero rig makes them work, it does not make them *fit* a fur-and-mail silhouette. |
| 5 | **The ladder rung** | Needs (3). Owner's call on placement, as with the Dwarf. |

### 5a. Her six takeable pieces — named, mapped to the approved reference

Strategy's ruling (Dom, 2026-09-22 23:12): every character wears **six takeable pieces of her own** in the shared library,
each a `loot.glb` draw with tier materials — **nothing on the body is rig dressing**. The robe/hauberk question that
prompted it was the Witch's, and the answer generalises: if it reads as gear, it is loot.

**Naming is not authoring.** All six are named here so the brief is checkable; the build order in deliverable 2 is
unchanged — Recruit-2 first, the rest as the kit library can carry them. Gating her on six authored meshes would stack
two long poles, which is what deliverable 2 already refuses.

Mapped to **direction A**, Dom's approved reference (#498, "i think A", confirmed by pasting A's own panels back):

| Slot | Piece | From the reference? |
|---|---|---|
| `Helmet` | **Open** — see below | **No.** A is bare-headed. |
| `Body` | Riveted mail hauberk to mid-thigh over a padded dark wool gambeson | Yes |
| `Arms` | Squared layered iron shoulder plates + plain iron vambraces | Yes |
| `Gloves` | **Open** — see below | **No.** A's hands are bare. |
| `Greaves` | Dark trousers with straight leg wraps, broad studded belt | Yes |
| `Boots` | Hard low boots | Yes |

**The two open slots are not mine to invent, and must not be authored from a guess.** A shows no helmet and no gloves, so
naming them requires Dom's letter the way the direction did:

- `Helmet` — A's read is two tight crown braids pinned flat, and a closed helm destroys exactly the hard flat crown line
  that won the pick. Proposal for Dom: a **mail coif worn down at the shoulders**, so the slot is real and takeable while
  the braids stay the silhouette. A great helm would make her the Knight.
- `Gloves` — proposal: **plain leather half-gloves**, consistent with the vambraces and adding nothing to the outline.
  Note that A's bare panel has a generator artifact at the hands (the palms sit half-open); that artifact is **not** the
  absence of gloves being specified, and nobody should author from it either way.

Both are proposals awaiting the owner, recorded here so the brief names six rather than four and so the gap is visible
instead of discovered during authoring.

**`Body` is a `replace` piece**, so it hides her own torso draws and is subject to the coverage rule already on trunk:
any `replace` piece covering less than 80 % of what it hides fails. **Correction (Executioner lane, 2026-09-23): that rule
is not a silhouette measure and cannot be checked from a reference or a mask.** `tests/loot.test.ts` compares the loot draw's
**mesh surface area in m²** against the PLAYER's own draws in that slot (`warrior.glb`'s `Gambeson` / `Leather.Body`) — it is
a test, and it runs the first time her `Body` draw exists in `loot.glb`. The earlier line here said the hauberk "clears that
comfortably — but it is measured, not asserted", and nothing had been measured. What can honestly be said now is a
**prediction with its reasoning**: a mail hauberk to mid-thigh over a gambeson is a larger draw than the tunic it hides, and
every piece that belongs shipped at 103–159 % against a 26 % failure (the Pitborn rag sash that bought the rule). A
prediction is what that is until the draw exists.

## 6. Budget — to be measured, not assumed

Every non-held fighter GLB ships in the dist bundle (the `import.meta.glob` list in `scene.ts`); only hero + selected
opponent are fetched per fight. So the Shieldmaiden costs **per-fight** budget only against himself, but **dist** budget always.
Caps: 12 MB per fight, 32 MB dist. The dist number must be re-measured on the day — `loot.glb` alone is at 1,407,428 B
against a 1,500,000 cap (6 % headroom), and Multi Chars' own arithmetic already shows a complete six-slot set for six
opponents running ~60 % over on triangles. **If the Shieldmaiden's six slots do not fit, that is a Brief 14 conversation before
his kit is authored, not after.**

## 7. Decisions — answered by Lead, 2026-09-22

1. **Shield asset owner: Multi Chars.** Lead's brief said "built once for him"; their lane doc already claims the Veteran
   shield with its two transforms and the back attachment point. One asset, one owner — **the Shieldmaiden uses it, he does not
   author it.** Lead is telling them the Shieldmaiden is the second consumer so it is built for both from the start.
2. **Beta consequence accepted and going to Strategy:** if Combat's shield rules miss beta freeze, **the Shieldmaiden does not
   ship, and he does not ship shieldless.** No beta date may be committed for him before that slice lands.
3. **Kit: Recruit-2 first**, not waiting on the shared library — gating a new character on Multi Chars' critical path
   stacks two long poles, and Recruit-2 is what every archetype wears today.
4. **Reference image: Dom's, and a required input** — not a nice-to-have. Dwarf and Executioner both had one before any
   build; without it the first build is a guess.

Still open, and not Lead's to give: **the owner's go for this lane to build a second character at all.** This session was
scoped to the Executioner on 09-20. The brief changes nothing and was in bounds; building is not, until Dom says so.

## 7b. Scope fences on the build itself

- **The hero rig and the main character's assets are not this lane's.** Dom has fixed Character Main to the hero only,
  and the same fence applies here in reverse: if the Shieldmaiden's build would touch the hero rig or the hero's assets, it stops
  and goes to Lead. The Shieldmaiden reuses the hero *skeleton and clips* — that is a read, not an edit.
- **No claim on Combat's time before the shield lands.** Their queue is knife → cleaver → estoc → shield.

## 7c. Method — how the rebuild question got settled

Worth stating as practice, not just as a finding. **Three lanes were wrong about the creature hazard tonight, in three
different directions**, and what settled it was a one-line experiment rather than another round of reasoning: add one
family entry to `creature_pack.py`'s `base` map, run `node scripts/creature-check.mjs`, read the assertion, revert.
Two minutes, no build, tree clean afterwards.

So for anything this brief asserts about the pipeline: **run the cheapest experiment that could falsify it before writing
it down**, and put the receipt in the document rather than the conclusion. A claim a reader cannot re-run is a claim the
next lane will inherit wrongly.

## 8. Not on the beta-critical path

Stated so it cannot be misread later: this is **not beta-critical**, and it must not take Combat's time before the shield
lands. Nothing in this brief asks Combat, Weapons or the deploy lane for anything today.
