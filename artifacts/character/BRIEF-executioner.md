# Frankendom: Origins — Opponent 6: THE EXECUTIONER (handover, 2026-09-18)

Owner's brief (2026-09-17, evening): a giant executioner — iron half-mask riveted over nose/mouth/chin, ragged black hood,
heavy buckle harness over bare arms, huge sword on the back. "Similar to the ogre — maybe 10% larger", then owner-locked at
**20% over the Pitborn (scale 1.36)**. Ladder (owner, 2026-09-18): the last rung, after the Nightborn — "the giant".

Design references: `artifacts/source/face/executioner/reference/masked-0{1..7}.png` (the masked/hooded GPT set — kit target,
NEVER scan fodder; git-ignored, local files). Scan set: `executioner-0{1..7}.png` (bare head, same man: front, ±35°, ±90°,
from below ~25°, from above ~20°; the GPT brief that produced them is `GPT-BRIEF-executioner-head.md` in the same folder).

## ⚠️ READ FIRST — the tree is RED, one test, known fix

> **RESOLVED 2026-09-18 16:45 (commit `2df0d8f`)** — everything in this section is now fixed and committed:
> decimate went to **0.08** (0.20 still shipped 60,827 ≥ 60k), the Blender parts build re-ran, and the shipped GLB is
> now **53,839 skinned tris**; the Jog "floating" assertion needed the flight bound scaled by fighter scale (probe data in
> the commit message); node tests 227/227; evidence `artifacts/character/executioner-v4/`. The uncommitted set this
> section describes was committed with it (matte iron, ladder rung, test updates). The text below is kept as the
> record of the diagnosis.

Uncommitted work in this worktree (a later session's, 2026-09-18 ~15:17, **do not revert**): the ladder registration
(`src/ladder.ts` + `tests/ladder.test.ts` + `tests/graphics.test.ts` picker list), the matte blackened-iron finish
(`build-warrior.mjs finishMaterials`: the Executioner's Steel/Bronze drop the ORM map for scalar factors — metalness .45,
roughness .88 — and his bronze factor is `#4a4239`; everyone else untouched), and `head.py FIGHTERS.executioner.decimate
0.26 → 0.20` with the comment explaining why: **the shipped GLB breaks the 60k skinned-triangle ceiling**
(`tests/characters.test.ts:56`).

The catch: `decimate` is applied in the **Blender parts build**, and the parts were NOT rebuilt (parts/items mtimes are the
v3 build's; the 15:17 `executioner.glb` is a build-warrior re-assemble, geometry unchanged). Current count **60,827 ≥ 60,000**
→ `npm run quality` fails in `tests/characters.test.ts` ("shipped executioner.glb … bounded running flight").

Fix (all from the worktree root, ~6 min):

```bash
HEAD_KT=1 blender -b -P scripts/character/parts.py -- --body realistic --fighter executioner   # bakes decimate 0.20
WARRIOR_FIGHTER=executioner node scripts/build-warrior.mjs
node scripts/bake-blades.mjs          # expect a no-op (git status src/blade-paths.ts clean)
npm run build && node scripts/check-budget.mjs
npm run quality                        # must be green, then commit the whole in-flight set together
```

If 0.20 still reads over 60k, the next lever is the hood (1,472 faces — the rag pattern costs) or the mask (710), not the
scan again. Evidence after the fix: `node scripts/character-preview.mjs --label executioner-v4 --enemy /src/assets/executioner.glb`.

## What shipped on `char/executioner-v1`

Commits: `df0e4e3` (v2: the fighter) → merge `3991a1a` (trunk zoom-lock) → `9887120` (PROJECT_STATE entry) → `9d26d9a`
(v3: owner review — hood's throat bib cut, it read as a floating plate on the sternum; greaves blackened iron). Evidence:
`artifacts/character/executioner-v1/` (baseline: bare stand-in face, red pteruges), `-v2/` (mask + hood land), `-v3/`
(current look; the quality gate was green at v3 because the executioner triangle test didn't exist yet).

- **Head**: STAND-IN — the hero's KeenTools scan (`01a0a628-….glb`), the Nightborn precedent. His own scan is blocked, see
  below. `FIGHTERS.executioner`: chin off (the jaw sits behind iron), `hair 'buzz'`, hair_lum 0.14, `decimate 0.20`,
  `cams ((0,0),(35,0),(-35,0),(90,0),(-90,0),(0,25),(0,-20))` — positive elevation is camera-below (the veteran convention).
- **The mask** (`parts.executioner_mask()`): an iron half-plate, Helmet slot, rigid to Head. Fit by raycasting a 41×16 grid
  onto the bare scanned face (eyes from the `kt_eye_l/r` objects, `scan_eyes()`), 6 mm stand-off, a raised centre rib; top
  edge under the eyes with a nose-bridge tab, bottom edge under the chin rising along the jaw. Rivets and cheek perforations
  are texture-level, deferred. Steel `#33302e`.
- **The hood** (`parts.executioner_hood()`): cloth dome on the helm's skull measurements +3 cm, face opening narrower than
  the helm's with a brow overhang, side flaps to the jaw, long back over the nape, every hem ragged by a fixed tear pattern.
  Heraldry, dyed `#171310` (near-black, above the 12% phone floor). **Slot is Crest, not Helmet** — see traps.
- **Frame**: `BUILD.executioner { scale: 1.36, hunch: [] }` (pitborn 1.13 × 1.20; verified in the GLB: root node scale
  1.224/1.319 = the warrior base 0.9/0.97 × 1.36). Stands straight. `KIT`: charcoal linen (0.16, 0.15, 0.17), grime 0.85,
  build + brute, greaves, boots, ears off.
- **Runtime**: `OpponentId 'executioner'`; `OPPONENTS.executioner { weapon 'longsword', scale 1.36, health 160, poise 12,
  profiles: PROFILES }` — PROVISIONAL: the Veteran's brain until the combat lead writes his profile; the longsword's data
  until the weapons lane ships his blade (the reference's back-sword is theirs; the character lane never makes a weapon live).
  `scene.ts OPPONENT_GLB.executioner`. Test in game with `?opponent=executioner`.
- **Budget**: PASS at v3 — 8.35 / 9 MB gzip per fight; his GLB 6.49 MB raw / ~3.73 MB gzip (under the veteran's 3.95).

## The KeenTools 402 (his real head)

The account has been out of credits since 2026-09-16 23:0x (the Nightborn is on the same stand-in). **The Executioner's 7
portraits are already uploaded** — avatar `01a0b094-dcd8-7792-835d-5bdb88f42cf6`, status `not_started`. Once credits land:

```bash
node scripts/create-head.mjs artifacts/source/keentools --avatar 01a0b094-dcd8-7792-835d-5bdb88f42cf6
```

(one billed `/process` + one billed redirect; do NOT re-init or the upload bills again.) Then point
`FIGHTERS.executioner.kt_glb` at the new GLB, commit it, rebuild, re-render. Only his eyes and brow are visible in game —
judge the eye line against `reference/masked-01.png` at `details-opponent.png` "eyes".

## Traps this lane found (beyond the original handover)

1. **An item replaces every part already in its slot.** Mask and hood both started on Helmet; loading the hood deleted the
   mask (found by counting Steel meshes in the shipped GLB). The veteran's helm/crest pair is the pattern: the mask holds
   Helmet (which also hides the Hair slot), the hood holds Crest.
2. **`KIT.brute` used to mean tusks.** The Executioner is a brute but a man — the tusks call is now gated
   `FIGHTER == 'pitborn'`.
3. **Decimate is Blender-side.** Editing `head.py` and re-running `build-warrior.mjs` alone changes nothing — the parts
   build must re-run.
4. **The 402 comes AFTER the uploads.** Resume with `--avatar <id>`; never re-init (re-bills) and stop polling the moment
   the model URL arrives (the redirect bills once).
5. **The preview defaults to the veteran.** Pass `--enemy /src/assets/executioner.glb` or you're auditing the wrong man.
6. **A fresh worktree is missing the git-ignored sources** (`artifacts/source/{base,human-base-meshes,lps,keentools,…}` —
   copy from another lane, ~900 MB) **and `node_modules`** (`npm ci`); `.env.keentools.local` doesn't carry over either.

## Not done / other lanes

- Real KeenTools head (blocked on credits, above).
- Mask rivets + cheek perforations (texture-level; needs a Steel detail map or authored normal).
- The hood reads smooth; a drape pass (dome noise, deeper rag) is the v-next polish if the owner wants it.
- Weapon: longsword placeholder — the weapons lane ships the blade, the combat lead flips it.
- AI: PROFILES is the Veteran's brain, provisional; the combat lead owns the profile and the fight's feel.
- Ship path when approved: PR into trunk → CI → merge → `git merge --ff-only` → `bash scripts/deploy.sh`
  (needs `.env.production.local` copied in) → check `frankendom.com/release.json` and the served GLB's sha256 against
  `src/assets/executioner.glb`. Deploy publishes your checkout — merge first, be on the trunk tip.
