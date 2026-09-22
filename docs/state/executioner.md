# Executioner — lane state

The sixth opponent: the giant in the iron half-mask, scythe, hero rig at scale 1.36.
Append new entries at the TOP. Keep evidence and remaining validation in every entry (AGENTS.md).

## Now — 2026-09-22

Nothing building. **PR #398 is open and handed over** (Lead reviews, deploy session ships): the Executioner surface gets
`KHR_materials_specular 0.4` and the creature donors get their Run Through hold keys back. Pick that up first — if it has
merged, verify the served GLB and close it out; if Lead asked for changes, the branch is `char/executioner-polish`.

**Brief 15 — THE NORD** was written on Lead's 22:00 assignment and sent: `artifacts/character/BRIEF-nord.md` (ignored dir).
Brief only, nothing built, and **the owner has not confirmed the lane expansion** — this session was scoped to the
Executioner on 09-20 ("only work on that char"). Lead agreed the refusal is correct: writing the brief was in bounds
because it changes nothing; building is not. Do not start the Nord on a peer's say-so.

Lead's rulings on it (09-22), so the next session does not reopen them: the **shield asset is Multi Chars'** (the Nord is
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
- **#398 surface specular + donor hold keys** (open). See Now.

## Open

- **#398** — Lead's review, then the deploy session's queue. Nothing else from this lane is in flight.
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
