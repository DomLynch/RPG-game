# Veteran — lane state

The first opponent: the scarred man in the plain Chalcidian helm, trident, his own rig at 1.804 m. Rung 1 of the ladder,
and the fighter every other lane measures against — the Dwarf is built from his parts, the Skeleton from his donor, and
`check-budget`'s worst pairing is his.
Append new entries at the TOP. Keep evidence and remaining validation in every entry (AGENTS.md).
Filed as `veteran-polish.md` because that is the lane id `scripts/lane-identity.mjs` writes into this worktree's
`CLAUDE.local.md`, so the handoff instruction (`docs/state/${lane}.md`) resolves to this file; rename both together if
the character-name convention (`executioner.md`) is preferred.

## Now — 2026-09-24 (afternoon): done; next from Lead

Standing by. Nothing building, nothing open from this lane except this doc PR (#583). Lead's rulings (acting with Dom's
authority), each checked:

- **#665 Blade Bite: variant B is FINAL** and live. Merge `7b06a113` is an ancestor of live `e37a74c7` (the playtest sha,
  frozen until tomorrow's playtest; `release.json` read). **The C shavings strip is cancelled.** It comes back only if the
  playtest answers point at Blade Bite.
- **#638 is CLOSED as superseded.** #637 (`18ea2180`) and #643 (`d075d053`) are both ancestors of `e37a74c7`.
- **The Centurion equip loader + gladius/scutum re-land** (item 2 below) is **PARKED until Monday's sim window** (Lead ruling,
  2026-09-24 evening). Moving him off the trident is a RECORD_VERSION bump, the sim is frozen until then, it is not a playtest
  item, and `e37a74c7` is frozen. Lead assigns it at the Monday window with the playtest results in hand. Do not start it early.

## Now — 2026-09-24 ~11:30 (handoff, context restart)

**Pick up, in order:**

1. **#665 Veteran signature (`veteran/battle-scars`, head `48d9e350`, base `world/signature-effects`; the framework #655 is
   MERGED, so retarget the base to trunk if GitHub has not).** B = **Blade Bite** registered (metal curls tear off the trident
   on HIS parry; contact measured per frame as closest points between the two weapon segments). A (Battle Scars) is kept in the
   file but NOT registered, on Lead's word: he wears no torso armour, so a metal gouge on cloth breaks the truth rule. C =
   twisted shavings (7 ribbons, 2 stay caught in the tines). **Owed:** the C shavings strip (renders were held for World's
   Witch/arena captures), then Dom's yes/no/again. tsc clean, signature tests 7/7, not iPhone-checked.
2. **The Centurion equip loader + gladius/scutum re-land** — still mine, still unstarted. Spec is in the 2026-09-23 entries
   below and memory `frankendom_centurion_gladius_scutum_2026-09-23` (measure hand_r per rig; the exact row-2 exception
   wording; loader + swap + Combat re-pin as ONE bump). Read Stats' `opponent.wear()` PR first.
3. **#638 "Run 4" (`phase-r-int-4`, 80e458b3) is now superseded.** Both halves are live on their own: #637 Dwarf shells
   (`da4108ed`) and #643 Knight body-cover (`d075d053`, the bare-chest fix) are ancestors of live `91d9f749` (checked with
   `git merge-base --is-ancestor`, each). Ask Lead to confirm, then close #638; do not re-integrate it.

## Done — 2026-09-24 (morning)

- **#637 Dwarf built shells LIVE** — live `release.json` revision `91d9f749`, #637's merge `da4108ed` is its ancestor.
- **#665 opened** (08:26Z) for the signature brief, B + C variants as above.

## Now — 2026-09-24 07:30 (handoff after the Dwarf six)

**Pick up:** the **Centurion equip loader + re-land** (item 2 of the entry below). The Dwarf six is done from this lane's side:

- **Dwarf six: #637 (`char/dwarf-shells`, 18ea2180) ships ALONE as Run 4** (Lead READY'd it to Deploy ~07:20). Verify live after
  Deploy publishes: `release.json` revision contains 18ea2180, and the Dwarf's Body/Arms/Greaves read in the journal.
- **#638 "Run 4" integration (`phase-r-int-4`, 80e458b3 = #603 Knight + #637) stays OPEN, NOT merged** — the Knight's worn Body is a
  `replace` that strips the tunic and leaves him bare-chested (evidence/dwarf-recut `run4-knight-front.png`). **Executioner owns the
  fix** (sent the ringHull chest-shell recipe 07:25). When it lands: re-merge onto phase-r, rebuild loot.glb ONCE, loot suites +
  grades, tsc, build, check-budget, in-arena back frames, then hand #638 back to Lead.

## Done — 2026-09-24 (overnight)

- **#614** (cut Body/Arms, re-wound Greaves) merged in 3c (#629 → trunk fa0c27d1, live) and **read as shards worn**: greaves dark
  shards + a spike, the girdle under the tunic, the arms one shard. Lead ruled NOT READY → fix PR.
- **#637 built shells** in `build-warrior.mjs` (`@build:dwarf-belt/plates/greaves`, the Witch pattern): a closed steel greave knee to ankle
  (fit median 1.2 / max 1.6 cm, better than the authored Veteran's 1.5 / 2.0), a leather war-belt over the tunic + a front apron, and
  a steel dome on each shoulder. Dead cuts `dwarf_upper/arms/greaves.glb` removed. loot.glb 9.61 → 8.92 MB; loot 41/41, tsc, build,
  check-budget PASS (dwarf 8.52 M of 12 M). Stills next to the Goblin on `evidence/dwarf-recut` (`shells-*`, `run4-*`).
- The **paperdoll layers 3c shipped were stale** (18:25, before the Greaves re-wind); #637 carries the re-render.

## Gotchas — 2026-09-24

- **TRELLIS surface cuts do not read as worn armour.** Built shells (`ringHull` over `playerWorn()`) do. Use them for any new piece.
- **A piece rigid to `upperarm_*` turns on its side in the idle** (the bind is a T): skin shoulder pieces half clavicle / half upper arm.
- **An apron rigid to the pelvis lets the kilt through**, and rays miss thin kilt flaps even at 48 azimuths: measure the kit's
  furthest-forward point and push, and skin the lower apron toward both thighs.
- **Re-run `node scripts/loot-layers.mjs` after every loot.glb bake** — the journal otherwise shows the previous pieces.
- **The in-game rig does not show loot unless the pieces clear the kit**; the render check that works is loot-layers' page with all six
  worn + a camera yaw + an `ArmedWalk` frame (scratch script pattern in memory `frankendom_dwarf_six_pieces_2026-09-24`).
- **A `replace` Body must cover what it hides** — the loot tests did not catch the Knight's bare chest; only a front render did.

## Now — 2026-09-24 (written 2026-09-23 evening, on Lead's word)

**Tell Lead by 09:30 which goes first, with ETAs.** Two items, both mine:

1. **Dom's PRIORITY 1: the Dwarf's six armour pieces.** Every opponent wears and offers six takeable armour pieces + its weapon,
   Recruit rag & scrap first, LIVE target 2026-09-24 14:00. The Dwarf has `dwarf.Greaves`, `dwarf.Gloves` (+ `dwarf.Warhammer`);
   add **Helmet, Body, Arms, Boots**. Build on Nightborn's welded pipeline once it lands (~09:00). One PR; body: the six listed,
   tri counts, loot.glb size, a same-frame phone still of the Dwarf WEARING them, loot-layers green. The Centurion's set is already
   six (+Crest, Shield).
2. **The runtime equip loader + the Centurion re-land** (Strategy, 2026-09-23 ~15:25; the veteran.glb rebuild is off the table).
   `loadWarriors` fetches `weapons/player/<weapon>.glb` for the opponent and grafts its `WeaponDrawn` (rigid under `hand_r`,
   contact in extras, the same shape as his baked trident node) over the rig's own BEFORE `buildWarriors`, so blade/contact/trail
   derive unchanged. Conditions: hand_r scale MEASURED per rig (numbers in the body); the row-2 roster-browser-check exception
   worded exactly "the opponent's equip .glb only, ≤ 250 KB", in the row's comment with the ruling time, no other exception, and the
   boot budget row unchanged; the re-land = loader + the swap re-applied + Combat's re-pin as ONE bump, with rows 2/11/12 asserting
   the gladius + scutum DRAWN (the mesh, not just `@WeaponDrawn`). Afterwards: the player-wield half of #309 on the same loader, as a
   separate PR.

**Why the Centurion is still on the trident:** #547 (gladius + scutum + carry pose + `veteran.Gladius` loot) reached trunk via #557,
failed Publish B's rows 2/11/12 (fixed in **#559, HELD**), and in the fight frames **he still drew the trident mesh**:
veteran.glb's baked `WeaponDrawn` is the trident, and nothing in `src` loaded an equip file (loot.ts's #309 contract had no code).
Combat's B' undo (`39fd0a5`, reviewed OK by this lane) put him back on the trident. **Re-land material, keep:** #547's commits
(`char/centurion-scutum`), #559 (`char/centurion-release-rows`: the scutum's loot.glb loads 1 s after first paint; the veteran
polearm rows assert sword family + `data-carried`), `char/centurion-gladius-scutum`. When re-landing: keep `veteran.Trident` as a
`RETIRED_LOOT` id (Lead upheld: `cleanLoot` silently drops unknown ids, so a taken trident would vanish).

## Done — 2026-09-23

- **#538 `wear()` on creature-pipeline bodies** (merged). The Veteran's, Dwarf's and Executioner's Body slot names empty nodes, and
  the body is one untagged `CreatureBody` draw, so `wear()` threw "no Body draw"; it now falls back to `CreatureBody`. Test in
  `tests/loot-wear.test.ts`, mutation-checked.
- **#566 worn shields render both sides** (Lead-reviewed, READY to Deploy, head `be2e8e1`; not yet verified live). Owner's iPhone
  15:21: the shield was a hoop. loot.glb's `~kit.Shield.Leather` face is a single-sided disc (every normal +Z) on the hero's
  FrontSide Leather, culled from behind. Shield-slot draws get a DoubleSide material copy, once per material. Same-frame 375×812
  stills on the non-merge branch `evidence/shield-face`. **Receipt still owed: Dom's iPhone after it's live.**
- **#547** (above) and **#559** (held) built and reviewed; **#483** (this doc) merged.

## Gotchas — 2026-09-23

- **`Material.clone()` copies `userData` but not `onBeforeCompile`.** A lighting pass that marks materials in userData would skip
  a clone and leave it unpatched. Carry the hooks over explicitly.
- **Release rows run against `dist`**: `npm run build` before running any row solo.
- **`scripts/versus-cards.mjs`'s page code is a template literal**, so a backtick in a comment breaks it.
- **Rung 1 is `initialDuel()`:** changing the Centurion's weapon moves every sim test that fights him (13 at #547). Those re-pins
  are Combat's; budget for them in any swap.
- **The deploy lock** is `~/.claude/hooks/deploy_guard.py` `active_lock()`: wait on it in a background until-loop.

## Now — 2026-09-22 (late)

**This doc is PR #483 (`char/veteran-state`), open, docs-only, and is the handoff.** It sat red on trunk's own
`TS2304: Cannot find name 'lorarii'` (`src/arena.ts:446`, a dangling reference #467 left when it removed the binding —
found running this lane's gate on a docs-only branch, reported with the reproduction, not fixed here); trunk `cb8ff5b`
(#477) has since relanded it and the branch carries that merge, so `npx tsc --noEmit` is exit 0 again. Note for whoever
reviews #477: Lead's named intent was to drop the getter *and* the `?perf=1` field; what shipped is a stub
`get guards() { return { built: 0, of: 0 }; }`. Not this lane's to police, just flagged.

Nothing else building and nothing else open from this lane. **v2 is live** — verified on the served file, not on the merge:
`assets/veteran-Duk__Zy1.glb`, HTTP 200, 5,644,176 B, 38 clips, generator `54999ae9`, materials
`WeaponTrident, WeaponTridentShaft, Bronze, Face, Photo, PhotoEyes, PhotoTeeth, VeteranSurface` — the grafted head draws
(`Photo/Face/PhotoEyes/PhotoTeeth`) and the helm are all present, and `creatureSource.skinMatched` carries both swapped
maps. Live revision `607126a`; `#237` (v2 body), `#363` (release checks) and `#398` (donor hold keys) are all ancestors
of it (checked with `git merge-base --is-ancestor`, each one).

**Two open items belong to other lanes and this lane must not pre-empt them.** The **shield** is Combat's slice (owner GO
18:40, 2026-09-22, `docs/state/combat.md`): a `GuardProfile` covering two of five guard sides with `stopsHeavy` and a
cheaper hold, no flat attack penalty, and the Veteran OPPONENT carries it from Legionary grade up — with the agreed
scope protection that if the rules miss beta freeze his shield starts at **Gladiator** instead, so beta never ships a
shield that does nothing. **#370, his authored opening**, is Combat's and is held on the owner's own verdict on feel —
nothing technical left (`docs/state/combat.md`). No shield asset request has reached this lane.

## Done — 2026-09-19 → 22

- **#237 the v2 body with his own scanned head** (live, merge `1e39fa1`). `src/assets/veteran.glb` became a TRELLIS.2
  reconstruction of a Kontext A-pose source made from his own portrait, fitted through the creature pipeline with the v1
  build as its own weight donor (`src/assets/source/backups/veteran-v1.glb`, byte-identical to the last shipped v1).
  The reconstruction's own head was **cut away and the v1 KeenTools head grafted back**: cut at the jaw (1.585 m), cut
  again where the smooth neck ends (throat 1.53 m in front, 1.555 m at the sides and nape) because the reconstruction's
  beard and nape hair are crumpled geometry that lights as white shards, then a 3 cm taper into the scanned neck
  (`tuck_neck`, which must run **after** decimation — edge collapses had re-exposed 5 mm). `creature_pack.py`
  `KEEP_SLOTS` retains `Helmet`, `Face` and `Eyes` with the weapon. The exposed strip of reconstruction neck is painted
  matte bare skin (`paint_neck`, base colour **and** metallic-roughness), and `match_skin` scales skin-weighted texels to
  the mean of the texels the scanned neck strip actually shows (gain ≈ 1.24/1.35/1.25 RGB). 39k surface budget so the
  12.7k scanned head fits under the 60k skinned ceiling (58k total). Evidence: in-game harness renders of `2b4067d`
  (face, helm, neck, nape clean), neck coverage measured per 5 mm row and direction, `quality:stop` 383/383,
  creature-check, build and budget PASS.
- **#363 the two release checks now open the file that ships** (live, merge `8b74504`). `veteran-neck-check.mjs` and
  `veteran-polish-check.mjs` are both `release_commands` run with no args, and both defaulted to the v1 backup — so
  neither had audited `veteran.glb` since v2 shipped (Auditer's finding). Both retargeted. The neck check **passes**
  unchanged, because the grafted head draws are byte-identical POSITION buffers to the v1 backup (verified directly):
  `{"maxSeamMm":0.0010110464163598373,"passed":true}`, 191 poses. The polish check crashed — it asserted reviewed-source
  parity for `Leather`/`Gambeson`, which do not exist on a one-material reconstructed body. Lead's ruling (option b,
  minimal): assert parity only for manifest parts present, **require `Bronze`/`Photo`/`Face`** to exist at all, record
  the rest as `skippedParts`. `{"materialSourceParity":true,"skippedParts":["Leather","Gambeson"],"renderErrors":[],"passed":true}`.
  Regression-tested the guard by renaming `Bronze` away — still fails. No threshold or reviewed map changed.
- **The Opened finisher's legs allowance, `.30 → .35`** (in #237, `tests/characters.test.ts`). CI caught it, the local
  Stop gate could not: it is a `[slow]` test. The finisher lays the severed legs on their broadest face; on the v1
  Studio body that is the hip (waist rests 0.24 m up), on the v2 body it is the stiff baked skirt (0.375 m). Measured
  across all 64 roll options — no orientation gets both flat and low. A half balanced on a limb sits 0.5 m+, which the
  0.40 total still rejects, so the assertion keeps its purpose. Full slow characters suite 35/35 across all six fighters.
- **#172 the v1 neck and material finish** (2026-09-19, `docs/state/character.md`). The Studio-body Veteran's continuous
  neck contour, shared collar skin weights, blended skin maps and restrained worn-bronze on the trident. 191 poses at
  maximum separation 0.001011 mm; asset sha `6101410c…`. That fit is what the v1 backup still carries, and what the
  neck check audits through the graft.

## Open

- **His hero-hands test is SKIPPED on trunk, and the fix is a shared-file job.** `tests/hero-hands.test.ts` runs six
  bodies; the Veteran's row is skipped with "donor `veteran-v1.glb` predates the finger fix; also used by
  skeleton/veteran-polish-check/veteran-neck-check — owner decision pending" (run on trunk `becec83`: 6 tests, 4 pass,
  the Veteran and Executioner rows skipped). Rebuilding through `parts.py` does **not** fix it: `creatures.py`'s
  `keep_fingers` copies the donor's already-baked finger weights verbatim, and the donor is a static backup older than
  the finger fix. Fixing means regenerating that donor through a realistic-body `parts.py` run and re-running the
  TRELLIS transfer — which moves a file the Skeleton's recipe and both release checks also read. Flagged to Lead by
  Scalable Chars, not silently skipped (`docs/state/character.md`).
- **A faint lighter patch of the scanned collar tile at the nape**, in close-ups only, not at gameplay distance. Known
  and accepted at ship; the lever if it is revisited is the collar tile, not the body.
- **His kit is the reconstruction's grey tunic and dark skirt, not v1's beige gambeson and umber skirt.** Owner's call
  taken 2026-09-21 ("do as you think best"): keep the grey — it suits the starter "poor veteran", and recolouring a
  baked surface would look worse than what shipped. Reversible as a texture pass if the owner ever wants v1's colours.
- **FLUX.1 [dev] is a non-commercial licence** (`src/assets/README.md`); his Kontext source was made with it. The owner
  confirms its terms on output use before commercial launch. TRELLIS.2 itself is MIT.

## Gotchas — the expensive ones

- **The pipeline reads the DONOR, but other lanes patch the SHIPPED file.** `cb1ee6a` (2026-09-21) put the Run Through
  hold fix — 17 left-arm `Fin_RunThrough` channels, the raised-palm bug — into `src/assets/veteran.glb` and not into
  `backups/veteran-v1.glb`, so any rebuild silently regressed it; `tests/characters.test.ts` catches it on the Veteran.
  `#398` synced the donors (`scripts/character/sync-hold-keys.mjs <donor> <shipped>`) and trunk is now **synced**
  (verified: both sides hash `e43cdafb94da`). Before any future rebuild, re-run that script or re-verify the hashes —
  the next in-place clip patch re-opens the trap.
- **Any edit to `creatures.py` or `creature_pack.py` moves the generator hash**, and `creature-check` then reads every
  live creature as stale — the Dwarf and Executioner must be rebuilt in the same PR. Both were, twice, in this lane's
  work (`docs/state/executioner.md` measures the same effect from the other side).
- **`quality:stop` skips `[slow]` tests, so it cannot see the finisher suites.** The Opened regression above reached CI
  green-to-red because of exactly this. Run `node --test tests/characters.test.ts` (no skip pattern) before pushing any
  Veteran asset change.
- **"Veteran" is also a grade name.** `src/grades.ts`'s ten tiers ARE `career.ts`'s `TITLES`, and tier 4 is *Veteran
  copper* (`docs/state/character.md`, brief 14). A grep for "veteran" now returns rank data as well as this character;
  read which one a line means before changing it.
- **He is the budget's worst case.** With the Season 2 creatures held, `check-budget`'s worst pairing is the Veteran
  (`docs/state/character.md`); his fight measured 9.8 MB gzip of 12 at v2. Any texture added to him is measured against
  that cap first.
- **Every player weapon is also a warden's weapon** (`docs/state/combat.md`, `weapons.md`): he carries the trident, so a
  trident change is simultaneously a change to him, and every other weapon's signed rows *against* him move with it —
  the knife's `thrust from range 18/24` and the scythe's `19/24` were both read off him.
- **He is other lanes' base.** The Dwarf is built from his parts (`WARRIOR_PARTS_VARIANT`, 1.494 m to his 1.804) on his
  AI profiles; the Skeleton's recipe uses his donor; the warhammer shelf rig is `veteran-warhammer.glb`; loot v2 exports
  his Helmet/Crest/Body/Arms/Greaves/Boots and his linen is the reference `Gambeson_<opponent>` bake. Changing his rig
  or donor is never only his.
