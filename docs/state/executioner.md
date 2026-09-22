# Executioner — lane state

The sixth opponent: the giant in the iron half-mask, scythe, hero rig at scale 1.36.
Append new entries at the TOP. Keep evidence and remaining validation in every entry (AGENTS.md).

## Now — 2026-09-23

**The lane is the Knight.** The Executioner is done and live (#398, `01b6642`); nothing open on him.

**Deliverable 1, the silhouette test, is shipped — PR #502** (`char/knight-silhouette`). Bare and in loadout, from the
approved reference (#494). The finding: **stripped, the Knight is nobody** — shoulder-over-height 0.367 in kit to
**0.246** bare, widest point 0.41 to 0.257, and no feature of the bare outline is his, because helm, pauldrons, skirt and
greaves are his whole identity and all six slots come off. The Pitborn lane measured the same failure on the
Shieldmaiden's direction A (0.284 → 0.240, #498), where the flat shoulder line A was chosen *for* is the lootable
shoulder plates.

**That bar is now withdrawn, and the finding stands anyway.** Lead and Strategy ruled the gate **in-kit at every rung**,
the bare pass **informational**, because the game has no stripped state: take-one removes at most one piece per kill, the
opponent respawns kitted, and `src/grades.ts:1` says a grade is a material variant on a shared mesh, so his Recruit
`Helmet` and `Body` carry the same outline as his Origin ones. Brief 17 §5a records the number with its re-read
condition — **it goes live again if `take-one` ever removes more than one piece**.

**My own earlier ratios are withdrawn** (Executioner 0.36, Knight 0.39–0.40, in `PROMPTS.md`). They came off threshold
masks that fused arms into the torso, which inflates a plate figure and barely touches a bare-armed one, so the direction
was an artifact. Corrected off u2net mattes: **Knight 0.367, Executioner 0.374, Veteran 0.360** — three humans inside
0.014, the Knight marginally *narrower*. Lead replaced both rows of #499 and Strategy fixed SCOPE.md on #492.

**Deliverable 2 is under way — `char/knight-body`, head `951c9be`, no PR yet.**

- `08965ee` the TRELLIS.2 reconstruction: 4,508,492 B, sha256 `1c683e97…`, seed 190926, 1024/100k/2048, one attempt.
- `8cf4bae` the pipeline wiring: `BUILD.knight = scale 1.18` and 1.85 m, **provisional**, a tie-break on the 0.367
  midpoint judged by Dom on the versus still (Strategy, 2026-09-23); a change is one number in each file.
- `951c9be` bounds the donor step at 30 min — the quality gate caught it as a third unbounded `spawnSync` against a
  ratchet allowing two.

## Open

- **The arm solve is blocked on the maul reaching trunk.** `creatures.py`'s `arm_angle` is seeded at **79** and is a
  *starting point*, not a measurement. Strategy's ship gate: the body PR carries the **solved** value against the **real**
  maul part (`weapons/maul-part`, `4f55780`), never the warhammer stand-in or the seed. The donor step itself is not
  blocked — identical `WEAPONS` reaches and the maul crowns at .76 like the warhammer's.
- **Remaining, in order:** donor step, Blender fit, pack, arm re-solve, versus still, then the generator-hash rebuild of
  `dwarf`, `executioner` and `veteran` **in the same PR**, each accessor-equivalent to trunk (§5, Dwarf v2 precedent).
- **`npm run quality:stop` on #502 has never run** — a deploy was in flight every time. Ruff clean, no release rows.
  Ask Deploy for the window.
- **Calibration owed to Strategy:** matte vs plate on the seven figures that have both a rig and a reference PNG, once
  #500 is on trunk. Small delta → #502 stands with the delta as its stated uncertainty and mattes are the instrument for
  reference-only characters; large delta → no cross-instrument comparison at all, which would hit the Shieldmaiden and
  the Witch too.
- **#469, this file's own PR, is still unmerged**, while four lanes are told to copy it as their worked example.

## Gotchas

- **Silhouettes need a subject matte, not a threshold.** Three threshold attempts failed: the backdrop is a *radial*
  vignette so a per-row left/right estimate sags mid-image; a closing wide enough to erase the figure over-reaches across
  that gradient; and **polished plate mirrors the backdrop** at its own luminance (163–171 against a 162–166 grey) — the
  same failure Pitborn hit on the shield face. The harness is `scripts/character/silhouette.py` (#502).
- **A border flood-fill is right for a hollow figure and wrong for plate.** An arm/hip gap is an *enclosed* hole, so the
  flood closes exactly the articulated outline the test exists to judge.
- **Do not re-run the outer-arm-edge fit as a measurement of `arm_angle`.** It reads **68.9° for both** the Veteran
  (solved 62) and the Executioner (solved 64). A method that cannot separate two known values cannot fix an unknown one.
  Only the *gap* survives: the Knight reads 84.7°, ~16° closer to vertical than either.
- **Never upscale a short mask to the comparison height** (#499) — it invents edge detail on one side of the pair only.
  My own sheet did it before `84195a4`.
- **Stance before breadth** (Pitborn's rule, #499): a comparison is only valid between figures in the same stance, and no
  measurement code can detect it — the shoulder-line finder is blind to what the arms are doing.
- **The 80 % coverage floor is not a silhouette measure.** `tests/loot.test.ts:95` compares **mesh surface area in m²**
  against the *player's* own draws in that slot. It cannot be taken from a reference or a mask; it runs the first time
  the draw exists.
- **The one-deployer hook scans the whole command string** — a heredoc containing "build" or "deploy" trips it even for a
  plain `git commit`. Write the message to a file and `git commit -F`.

## Now — 2026-09-22

Nothing building and nothing open from this lane. **#398 merged (`01b6642`) and is live** — verified on the served file,
not on the merge: `assets/executioner-9s1ZxRnx.glb`, HTTP 200, 4,414,104 B, carrying
`KHR_materials_specular { specularFactor: 0.4 }`, 38 clips, generator `54999ae9`.

**The owner widened this lane on 2026-09-22:** *"Your scope now includes the Knight (Brief 17): a masked heavy opponent
wielding the maul, two-hand … The Executioner stays yours."* Terms: brief first, **silhouette test at the fighter's camera
passes before any model work**, AAA judged on a **phone screenshot** (Dom plays on an iPhone — a Mac render is not the
instrument), **one PR per deliverable with its receipt**, report to Lead, **nothing ahead of the shield in Combat's queue**.

**The Knight's reference is APPROVED and landed — #494** (`docs/character-references/knight-source-v1.png`, lean plate + great helm, owner-picked 2026-09-22). **Deliverable 1, the silhouette test, is unblocked and is the next action.** Keep one finding from the approval: differentiation from the Executioner is **not** about mass (measured shoulder/height — Executioner 0.36, Knight 0.39-0.40) but about **soft outline versus hard** — his hood, bare arms and falling cloth against the Knight's squared pauldrons, flat plate edges and articulated limbs. The build must keep that contrast; "bulkier than the Veteran, thinner than the Executioner" is a build-spec number the reference does not settle.

~~Blocked on the reference image.~~ It gated deliverables 1 and 2 (for a masked character the
silhouette *is* the design) and is now satisfied. Brief 17 is landed as **PR #489** (`docs/briefs/knight.md`), approved by Strategy with
its §7 rulings written in.

**When the image arrives, deliverable 1 is the silhouette harness** — black shapes at the fighter's camera beside the
other nine, run **bare and in loadout**, the bare pass being the honest one (armour is takeable, and a full-plate
closed-helm figure reads in kit and vanishes stripped). One PR per deliverable, each with its receipt image; AAA is judged
on a **phone screenshot**, never a viewport render.

The Shieldmaiden (Brief 15, written here as "the Nord") is **not** this lane's — it stays with Lead. Brief 15 (written as
"the Nord", since renamed **the Shieldmaiden** and amended by Lead: a woman, and a new one-hand bearded axe family in
place of the cleaver) is moving to `docs/briefs/shieldmaiden.md` in PR #471. Brief 17 **the Knight** is landed in **#489**
as `docs/briefs/knight.md`, which creates `docs/briefs/` (so does #471 — different files, no conflict).
Brief only, nothing built, and **the owner has not confirmed the lane expansion** — this session was scoped to the
Executioner on 09-20 ("only work on that char"). Lead agreed the refusal is correct: writing the brief was in bounds
because it changes nothing; building is not. Do not start the Nord on a peer's say-so.

The Knight's own finding, worth keeping: **the maul is not a shelf-ready hero-rig weapon.** `moves.ts:406` makes `MAUL` a
cleaver spread with a two-hand grip and cleaver paths under a creature prefix, and no maul asset exists in the repo — the
geometry sits inside the **held** `minotaur.glb`. Promoting it is a real Weapons deliverable. And because a two-hander
stows the shield, the Knight has no shield; "cannot be cut" must come from plate and guard rules, which is Combat's to
define, not a character brief's to invent.

Lead's rulings on the Shieldmaiden (09-22), so the next session does not reopen them: the **shield asset is Multi Chars'** (the Nord is
its second consumer, he does not author it); **if Combat's shield slice misses beta freeze the Nord does not ship, and
must not ship shieldless** — his shield is always-on, so the Veteran's "start at Gladiator" fallback does not transfer;
the kit ships **Recruit-2 first** rather than waiting on the shared library; and an **owner reference image is a required
input**, not a nice-to-have. Scope fence: the hero rig and the hero's assets belong to Character Main — the Nord reads
the hero skeleton and clips, it never edits them.

## Done — 2026-09-20 → 22

- **#177 the scythe's haft** (live). `setBladeBlood` tinted every mesh of a two-handed `WeaponDrawn`, and every shipped
  two-hander ships its handle as its own material, so the whole scythe went red after a kill. `bloodiesMaterial(name,
  twoHanded)` in `finisher-blood.ts` bloodies the blade and never a handle (`/haft|handle|grip|wrap|leather|cord|wire|^ash$/`).
  Fixed the trident, cleaver, knife, estoc and maul hafts at the same time.
- **#206 the TRELLIS rebuild** (live `fefb8fe`, merge `60fccd4`). The procedural v5 body replaced by a fitted TRELLIS.2
  reconstruction; **v5 kept byte-for-byte at `src/assets/source/backups/executioner-v5.glb`** and used as his own donor, so
  the 1.32× root, the scythe `WeaponDrawn` and all 38 clips are inherited. 45,471 tris, 3.16 MB gzip (v5 3.69).
- **#293 the scythe's blade** (live `5debe58`). Owner, 09-21: "still turns red". The haft was fixed; the crescent was not —
  a broad metallic blade took the 55 % lerp toward `#7a1410` as a *red mirror*. Two-handed weapons now take the dark tone
  `#2a1516` with `metalness ≤ .3 / roughness ≥ .7` (a wet dark film); the sword path is unchanged. In `src/gore.ts`.
- **#398 surface specular + donor hold keys** (live, merge `01b6642`, release `607126a`). Skin-strength specular on the
  Executioner surface kills the wet-plastic sheen a normal-map-less reconstruction takes; `sync-hold-keys.mjs` puts
  `cb1ee6a`'s Run Through hold channels into the `executioner-v5` and `veteran-v1` donors, so a creature rebuild stops
  silently regressing the raised-palm hold. Dwarf and Veteran rebuilt in the same PR for the generator hash.

## Open

- **The Nord** — blocked on the owner confirming the lane expansion, then on an owner-approved reference image, Multi
  Chars' kit schema, and Combat's shield slice. All four are in the brief.
- **The mask reads dark under the hood in game.** A relit source was tried and **rejected**: the mask is recessed, so
  TRELLIS bakes it dark whatever the source lighting, and that bake shifted his skin red. It reads acceptably at gameplay
  distance; if it is ever revisited, the lever is geometry or a material, not the source image.
- **FLUX.1 [dev] is a non-commercial licence** (`src/assets/README.md`) — the owner confirms its terms on output use
  before commercial launch. TRELLIS.2 itself is MIT.

## Gotchas — the expensive ones

- **Any edit to `creatures.py` or `creature_pack.py` moves the generator hash**, and `creature-check` then reads every
  live creature as stale. Rebuild all of them in the same PR (today: dwarf, executioner, veteran) and show each
  accessor-equivalent to trunk. Measured on trunk `beb3120`: baseline passes `dwarf, executioner, veteran`; adding one
  family entry to `creature_pack.py`'s `base` map and re-running gives `Stale creature: rebuild with build-creatures.mjs`
  (`creature-check.mjs:11` digests both scripts into the pinned `generator` hash). **Adding a new character through the
  creature pipeline therefore costs a rebuild of every live creature** — plan it into the PR, it is not a defect.
- **`cb1ee6a` patched the Run Through hold keys into the shipped rigs but not into the creature donors**, so any creature
  rebuild silently regressed the raised-palm hold — `tests/characters.test.ts` catches it on the Veteran only.
  `scripts/character/sync-hold-keys.mjs <donor> <shipped>` syncs the 17 left-arm `Fin_RunThrough` channels. Applied to
  `executioner-v5` and `veteran-v1`; the dwarf donor already matched.
- **The `build-warrior` donor step is not byte-reproducible across machines.** Restore a donor from trunk and re-run
  fit/pack/Quiet-One instead of regenerating it, or the diff is noise you will chase.
- **`Death_QuietOne` is authored per body** on its own skin envelope, so it is the one clip a creature does not inherit
  verbatim; the donor's corpse sank the new body 0.21 m. `creature-check` excludes it from the inherited-clip comparison.
- **Solve a fitted arm against the reconstruction's PALM, not its hand centroid.** Palm-solving took the scythe grip gap
  from 0.04–0.08 m to 0.019 m. `keep_fingers` keeps the donor's finger weights so the clips curl his fingers on the haft.
- **A reconstruction ships no normal map**, so its smooth surface takes the full dielectric specular as a wet-plastic
  sheen. `SURFACE_EXTENSIONS` in `creature_pack.py` stamps skin-strength specular (the hand-built heads use 0.5 / 0.35).
- **The TRELLIS route is `gradio_client` + the local HF token** (`~/.cache/huggingface/token`, PRO). The HF MCP has
  `gradio=none` so `invoke` is disabled; the hf.co Space iframe is invisible to the Chrome extension; the direct
  `*.hf.space` URL freezes the tab. ~90 s per reconstruction at seed 190926 / 1024 / 100k faces / 2048 textures.
- **Playwright's default `waitForFunction` polling never fires on the game page** — pass `polling: 250`, or a passing run
  looks exactly like a frozen game (cost 40 minutes). `page.goto` needs `waitUntil: 'commit'`; headless GL is ~0.25 s a
  frame, so render only the frames that carry a blow.
- **Gate every browser run on `pgrep -f "bash scripts/deploy.sh"`.** One capture went out during a deploy on 09-22
  because the check and the run were chained in one command instead of the run being conditional on the check.
