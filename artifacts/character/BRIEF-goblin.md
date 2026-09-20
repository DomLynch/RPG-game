# Frankendom: Origins — Opponent 4: THE GOBLIN (pit-runner)

Owner's brief of 2026-09-16 (22:2x), as built by the character lane the same night on `char/goblin-v1`. Runs beside the Pitborn (PR #81,
merged before this lane branched — both seams the brief lists as prerequisites were already on trunk: hit regions scale with
`Fighter.scale`, opponents are data). Ladder: Veteran → Pitborn → Goblin (the lead's).

## Identity (owner-locked)
Small, fast, mean. 0.75–0.80× the human rig: short legs, long arms, hunched, big head with a wide mouth and long ears, thin neck,
grey-brown mottled skin, filthy. Rag tunic, scavenged leather scraps, a bone-and-string necklace of trophies (teeth, a finger), one iron
bracer that doesn't match, bare feet. No pointed hat, no cartoon green, nothing cute. Silhouette test: the low, wide, long-armed shape
must read next to the hero at 3 m on 393×852, moving.

## What shipped (this branch)
- **Head**: KeenTools scan of the owner's seven GPT portraits (`artifacts/source/face/goblin/goblin-0{1..7}.png` — front, ±35°, ±90°,
  from below, from above; scan `artifacts/source/keentools/01a0ab81-4cff-7871-bac7-adfa28d57d0b.glb`, billed job 2026-09-16 22:36).
  `head.FIGHTERS.goblin`: stubbled bald scalp (`buzz`, hair_lum .30), scars, `skin_mul (0.80, 0.77, 0.78)` — the first body rendered
  (178,154,125) beside a (143,115,97) cheek; now (152,119,95) on the upper arm. Long ears are geometry (`parts.ears()`): two flattened
  cones rooted by raycast where the scan's own ears sit, up-out-back, wearing the scan's photo tile at a cheek texel so they take the face's
  colour whatever the correction did.
- **Rig — re-proportioned, not shrunk** (`build-warrior.mjs BUILD.goblin`): per-bone scale about each joint in its rest frame, applied
  through every part's skin weights before binding and baked into new rest positions + inverse binds (`reproportion`): legs ×.84 (thigh and
  calf), arms ×1.16 (upper and fore; hands and grip untouched), neck ×.9 long / ×.86 girth, head ×1.17; hunch spine_02/03 +9°, neck −8°,
  Head −8°; the pelvis drops by exactly the legs' loss (0.142 m) so the soles stay where a man's are; the walk bob scales with the legs
  (`bob .84`); root scale .835. Standing 1.357 m to the hero's 1.745 = **×0.778** → `OPPONENTS.goblin.scale 0.78` (the hit capsule follows
  the measured height, not the root scale). Rotations are untouched, so the library clips are the hero's to the bit; the IK-authored clips
  (Draw, swings, strafes, kick, defences) re-solve on his limbs with the hand goals lifted by the drop. Roll: a floor clamp re-solves the arms
  where the longer arms on lower shoulders would plant the hands 10 cm under the floor (lowest now +0.045 m).
- **Gait as data**: `stride = .835 × .84 = .70` written to the GLB root's extras; `characters.ts` divides the ArmedWalk/strafe time-scale by
  it, so his feet plant at the simulation's travel speed and he scurries (no clip change).
- **Kit** (`parts.KIT.goblin`): rag tunic (linen .31/.28/.23, grime .94), the baldric as his one leather scrap, thin belt, rag wraps,
  barefoot, no helm, no frame gains. Trophies in `build-warrior.mjs`: the necklace cord fitted by raycast over everything worn (36 azimuths,
  lower at the front), five bone teeth and a three-knuckle finger each set off the chest at its own height; one rust-brown iron bracer with two
  bronze rivet bands on the LEFT forearm (the sword hand stays free). Steel `#4a3a2c` rough .9; Heraldry `#3a3229`.
- **Data**: `OpponentId 'goblin'`, `OPPONENTS.goblin { weapon 'knife', scale .78, health 100, poise 0 }` with a PROVISIONAL profile on the
  knobs that exist (reaction 10/8, parry 0, dodge .5/.6, aggression .7/.8, discipline 25/20); `WeaponId 'knife'` = longsword placeholder
  (the cleaver pattern; `bladePaths.knife` aliases the longsword's, re-baked, longsword/trident/cleaver tables byte-identical);
  `scene.ts OPPONENT_GLB.goblin`; `?opponent=goblin` picks him.
- **Budget**: goblin.glb 5.82 MB raw / 3.26 MB gzip, 55.9k triangles (cap 60k), 31 images; dist 14.63 / 16 MB gzip. The brief's "≤ 45k
  tris, ≤ +500 KB" predates the per-fighter 2K tiles the Veteran and Pitborn set (3.88 / 3.19 MB): a fourth opponent will not fit the 16 MB cap
  without 1K tiles per opponent (≈ −1.5 MB each) or a cap decision — the lead's call.

## Evidence (`artifacts/character/goblin-v1/`, `artifacts/goblin/`)
`inspection-turntable.png` (hero + goblin at 8 angles), `clips-goblin.png` (his own 21 clips, 24 keys), `faces.png`, `details-opponent.png`,
`gameplay-{portrait,landscape}-{ready,attack}.png` (lock 390×844 / 844×390), `sequence.png` + `sequence.webm` (the 6 s exchange),
`stats.json` (Δ vs pitborn-v3: enemy gzip +69 KB, draw calls +2). Real app: `artifacts/goblin/live-goblin.mjs` → `live-393x852*.png`,
`live-852x393*.png` — goblin.glb requested, HUD 100/100 vs 150/150, the fight starts, no page errors. Tests: `tests/characters.test.ts`
(clip contract, proportions from the rig, pelvis drop = legs' loss, root scale, stride datum, height ratio ±.02, roll floor),
`tests/opponents.test.ts` (data entry, knife alias, capsule at 1.13 m, AI-vs-AI finishes: median 18.2 s, 12.5–23.0 at normal — under the
25–45 s target because he neither parries nor guards well with today's knobs; the battery is not pinned for him until the AI knobs land).

## Knife timings — PROPOSED for the combat + weapons lanes (not landed; the knife slot is the longsword's data)
Wind-up ≥ 12 ticks everywhere (readability rule); feints = the first ~40 % of the wind-up (`feintUntil`); damage and cost below a sword's.
| move | sword windup/active/recovery | knife (proposed) | chained | feintUntil | chamber | damage | stamina | posture |
|---|---|---|---|---|---|---|---|---|
| light (cut) | 20/8/22 | 14/6/16 | 12/6/14 | 6 | 6 | 10 | 18 | 14 |
| thrust | 16/5/21 | 12/4/15 | — | 5 | 5 | 9 | 14 | 12 |
| heavy | 32/5/31 | 22/5/26 | 16/5/26 | 8 | 7 | 14 | 26 | 24 |
| riposte | 12/5/19 | 12/4/15 | — | 5 | — | 18 | 16 | 0 |
| heavy riposte / counter / critical | 20/5/25 | 16/5/20 | — | 6 | — | 22 / 16 / 30 | 26 | 0 / 22 / 0 |
| kick | 18/1/25 | 18/1/25 | — | — | — | 4 | 25 | 24 |
Each timing is its own baked table: add `{ weapon: 'knife', glb: 'src/assets/goblin.glb', node: 'WeaponDrawn' }` to
`scripts/blade-manifest.json` when the knife mesh lands (until then a bake from `SwordDrawn` on goblin.glb gives his real, scaled sword sweep).
Reach follows the bake (the brief's ~1.3 m).

## Not built here (by the brief's lane rules) — see `artifacts/goblin/REQUESTS.md`
AI knobs (feint rate, guard share 0, back-step after landing, circling, per-opponent stamina regen), the knife mesh and its data, the
camera at close range against a 1.36 m man, voice/foley.

## Head pass (same night, after the first faces sheet)
The portraits' grey backdrop had been projected onto the crown at grazing angles and the fill treated it as photographed — a pale cap with a
hard edge. `head.FIGHTERS.goblin.backdrop_cool`: a cool texel (blue ≥ 85 % of red; skin and stubble run .6–.7) above the hairline is marked
unseen so the fill covers it (per fighter — grey hair is cool too); `hair_lum .42` so the fill's tone is the photographed stubble (lum ~.32),
not its shadows. The scan's own pinnae are flattened against the skull (92 % of what stands proud of the temple's skull line, `parts.ears()`)
and the goblin ear is rooted 12 mm behind and 8 mm below the canal with a wider base to cover them.

## Polish pass — 2026-09-20 (PR: char/goblin-polish)
Ears lofted from rings (`parts.ears()`: a fat lobe at the root, widest a third up, a torn notch on the outer rim) instead of two-ring
cones the leaf shaping never reached; skin_mul (0.77, 0.77, 0.80) — the body read warmer than the grey face at the collar. The pink patch
behind each ear was NOT the pinna: the scan unwraps the skull band behind the ears to the tile's outer edges (u .86–.97 / .03–.14 at v
.44–.74, measured from the mesh) and the projection painted the photographed ear onto it; the crown fill's boundary feather never
reaches small edge islands. `head.FIGHTERS.goblin.ear_fill`: that band and the flaps are marked unseen and the fill is FORCED there
(`crown_fill(force=)`). The scan's real ear flaps (|x| .10–.13, 6–15 cm behind the eyes, down to 8 cm below — not where the canal ray
lands) are flattened 92 % and re-mapped to the skull texels behind them. Evidence: `artifacts/character/goblin-polish/` (ears-before-after,
views, faces, turntable, lock stills; Δ vs goblin-v1 +48 KB gzip). Live probe reads his hp from the data (120) and the renamed button.

## Open on the character side (owner's eye first)
The flattened flap still prints a faint outline in profile; the bracer reads leather-brown rather than rusted iron at phone size (its own 1K rust maps
would fix it); the necklace finger sits on his right, small.
