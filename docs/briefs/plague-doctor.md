# Brief 18 — the Plague Doctor

Owner: the Nightborn lane. Written 2026-09-22 on Dom's word in this lane's session, verbatim: *"Your scope now includes
the Plague Doctor (Brief 18): a masked opponent wielding the longsword. Write the brief first, build to Strategy's bar
(silhouette test at the fighter's camera passes before any model work; AAA face and build judged on a phone screenshot),
one PR per deliverable with its receipt, report to Lead. Nothing ahead of the shield in Combat's queue. The Nightborn
stays yours."* Draft for Strategy's review.

**He is content, and the brief is built so he stays content.** Nothing here asks Combat for a rule, an AI branch or a
tuning pass ahead of the shield. Where a want would cross that line it is written below as a *request to Lead*, not as a
step in the plan.

## What he is

A masked opponent with the longsword: the beaked mask, the wide brim, the long waxed coat. The fantasy is a man who
treats a duel as a procedure — he opens you, steps out of measure, and waits for the wound to do the work.

**Identity test, and the one that decides whether he is a reskin: he must be beatable by closing.** If a player can win
by standing at his measure and trading, he has no identity; if crowding him is *the* answer and the player can find it in
one fight, he has one. That test is a battery row, and it is the last deliverable, not the first.

## The two decisions that make him cheap

**1. The longsword costs nothing.** `src/characters.ts:26` — `longsword: { Thrust: 'Riposte' }`. One role override; he
inherits the entire sword clip family the hero already ships. Compare the Witch's bladed staff at 19 overrides
(`trident`, `scythe`, `warhammer` rows) or a creature family at 21 (`maul`, `reaper`). **No new weapon family, no new
blade table** — he fights on the hero rig, so `bladePathsByRig.hero.longsword` is already baked.

**Ruling, so nobody re-litigates it from the relay version: longsword, per Dom in this session; a cane/sheath is
silhouette dressing, not a weapon family.** The cane-sword framing came through the Strategy relay, not from Dom's
keyboard — the two sources disagree, and this brief follows his words. Lead has endorsed that as the lane's ruling. A sheath
carried as a cane is a silhouette idea, and a nice one — but it is a **Weapons-shelf question** (a part, its draw, its
stow node), not a new family, and nothing in this brief depends on it. If Weapons wants it, it lands after he ships.

**2. The mask deletes the face problem.** KeenTools has returned `402 Insufficient credits` since 09-17; it blocked the
Nightborn (solved by TRELLIS.2, `scripts/character/trellis_head.py`) and the Executioner (shipped on a stand-in head).
**A beaked mask covers the whole face**, so this character needs no scan, no TRELLIS run, no credits and no head
pipeline at all. The precedent is already in the tree: the Executioner's iron half-mask and hood ride the `helm` slot in
`scripts/character/parts.py` `KIT`, and Brief 17's Knight is built on the same reasoning. **This is why he is the
cheapest of the remaining archetypes and why this lane can build him without unblocking anything.**

## Kit — the one new table row

`KIT['plague_doctor']` in `parts.py`, beside the existing six. Per that table's own vocabulary
(`linen`, `grime`, `greaves`, `build`, `bare`, `brute`, `helm`, `barefoot`, `ears`, plus the Nightborn's `closed`,
`collar`, `boots`):

| field | value | why |
|---|---|---|
| `linen` | waxed black-brown, **never under ~0.12 value** | the Nightborn's floor comment: below ~12 % value the folds and occlusion have nothing to shade at phone size |
| `grime` | high | a coat that has been in the pits |
| `helm` | `True` | the mask + brim ride the helm slot, as the Executioner's half-mask + hood do |
| `closed`, `collar`, `boots` | `True` | the coat is closed to the throat; he is shod |
| `build`, `brute`, `bare`, `barefoot`, `ears` | `False` | a man's frame, covered, no scan features needed |

New geometry, all in the helm slot and the coat: **the beak mask, the brim, the coat skirt, the glove cuffs.** Nothing
else. No new bones, no `BUILD` re-proportion entry — he is the hero rig at scale 1, so every clip, finisher and blade
table transfers untouched (contrast the Goblin and Dwarf, which needed `BUILD.bones` work).

## Silhouette — deliverable 1, before any model work

Dom's bar, as Lead relayed it: **the fighter's camera, bare and in loadout.** Armour is takeable (loot v1 already
exports per-slot draws), so a silhouette that only reads in full kit fails the moment someone loots the coat.

The read has to survive a beaked mask being a small object at duel distance. The silhouette carriers, in order:
**the brim** (the widest horizontal in the roster — nothing else on the ladder has one), **the coat skirt's line below
the knee**, and **the beak's downward point breaking the head's round**. Bare, the read falls to the coat alone; if it
does not hold bare, the brim is doing all the work and the build is wrong.

Test: `node scripts/character-preview.mjs --label <x> --enemy /src/assets/plague-doctor.glb` at the fighter's camera,
against the nine, bare and kitted. **Passes before any texture or surface work starts.**

## AAA on a phone, not on a Mac

Dom plays on an iPhone. Every look judgement is a **phone screenshot** at the lock camera, never a desktop render. Two
values from the Nightborn's own build carry straight over: the ~0.12 value floor above, and the fact that a decimated
head reads faceted close up (`decimate: 0.14`) — the mask should be authored at a density that survives the portrait,
since it is the one part of him a player ever sees large.

**The gate looks at him unmasked at least once** (Lead, 09-22). A phone screenshot of a masked head cannot see the one
thing it is supposed to gate — see trap 1 below.

## His brain — what he ships with, and what waits

`src/roster.ts` is explicit: *"Adding an individual must not add AI branches."* `ARCHETYPES` (`src/moves.ts:454`) is
keyed by archetype name and the Wraith already proves the pattern by reusing `nightborn`.

**He ships on an existing archetype.** The closest fit to poke-and-withdraw is `nightborn`; the alternative is `veteran`.
Which one is a measurement, taken from the ladder battery once he exists — not a guess made here.

**The bespoke brain is a request to Lead, not a step in this plan.** If the battery says he needs his own row to pass the
identity test, that is a Combat ask, and by Dom's instruction it queues **behind the shield**.

## "Lets it bleed" — the rule already exists; the picture does not

The routing identity ("opens a wound, backs off and lets it bleed") maps onto rules that are already in the tree, which
is the cheap way to have it:

- `RULES.wound = 240` ticks — four seconds at 60 Hz (`src/moves.ts:122`), with `woundRegen: .8` throttling stamina
  recovery while it runs.
- `attrition: { stamina: 8, floor: 40, legSpeed: .85 }` (`src/moves.ts:147`) — **every blade wound permanently lowers the
  wounded fighter's maximum stamina for that duel** (floor 40), and a leg wound slows his walk. A fighter who opens you
  and disengages is already rewarded by this; no new rule is needed to make bleeding matter.

**The picture is the part that does not exist.** `createWoundDecals` (`src/gore.ts:84`) builds fixed geometry, and its
only caller is `throatCut` — the Quiet One's finisher (`src/gore.ts:132`). **No wound mark draws during a normal fight.**
So if the fantasy needs a visible bleed, that is new Visuals work on a body-anchored effect across ten archetypes
including a goblin and a dwarf — the exact problem Dom removed the standing wound mark for. **Not assumed, not scoped
here:** he ships without a bleed visual, and whether to add one is Dom's and Visuals' call.

## The two traps that will bite this build specifically

Both are silent failures — the species that presents as something other than itself. Written here because a masked
longsword fighter walks into both.

1. **`parts.py` falls through to a stand-in head without erroring.** `os.path.exists(HEADMOD.KT_GLB)` is a silent
   fallback, and the head assets are gitignored and present only in the worktrees that were handed a copy (Scalable
   Chars lost two builds to this on 09-22; docs/state/character.md). **For a masked character this is the worst possible
   silent substitution, because the mask can hide the evidence** — the build succeeds, the screenshot looks plausible,
   and the wrong head is underneath. The mask must be verified on a *bare-head* render before the mask goes on.
2. **A weapon-variant GLB must stay byte-identical to its base.** `tests/weapons.test.ts:460` asserts
   `nightborn-estoc.glb` equals `nightborn.glb` byte for byte; when they drift, the `deepEqual` on two ~7 MB buffers
   **hangs ~280 s instead of failing**, so the symptom looks like a slow suite — the thing everyone waits through rather
   than investigates. **A longsword variant is precisely that shape.** If this character ever gets a weapon-variant GLB,
   rebuild it in the same commit as the body, always.

## Deliverables — one PR each, with its receipt

1. **This brief.** → Strategy review.
2. **Silhouette test**: the fighter's camera, bare and kitted, against the nine. Receipt: the stills. No model work before
   it passes.
3. **The kit**: `KIT['plague_doctor']`, mask + brim + coat, `plague-doctor.glb`, `ROSTER` row on the hero rig with
   `weapon: 'longsword'`. Receipts: `npm run quality:stop`, `check-budget`, phone screenshot at the lock camera.
4. **The ladder row**: archetype chosen by measurement, battery rows for the identity test. Receipt: the 24-seed battery.

## Budget — the constraint most likely to stop him

`scripts/check-budget.mjs:12`: **12 MB gzip per fight**, 32 MB for dist, plus `loot.glb` under 1.5 MB and `guard.glb`
under 400 KB on their own lines. He is another opponent GLB in dist and another possible worst-case pairing. The
Nightborn's own TRELLIS head pushed dist to 31.57 / 32 MB in September before later work brought it down; **dist, not the
per-fight number, is what a tenth archetype threatens.** Measure before authoring textures, not after.
