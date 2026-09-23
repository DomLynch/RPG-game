# Character — project state

## Now — hero lane (main character only), 2026-09-22
**Scope:** the player character (`warrior.glb`) ONLY. Dom, in the hero session: "you are main char only (IGNORE THE
MINATUR AND WRAITH)… only update the main char if I ask". Other fighters, creature donors and new archetypes are other
lanes' — a brief relayed by Lead or Strategy is not Dom asking. Brief 16 (the Witch) was declined on this and routed:
the (a) new-RigId vs (b) mesh-only-proportions question is Scalable Chars', who own `BUILD.bones` and the inverse unscale.
**Shipped:** hero hands v44 (#405, merged 163587d) — see the entry below. Trunk cb8ff5b; live 607126a does not carry it yet,
it goes out with the next deploy whose release run passes.
**Parked on Dom's word (beta row 3):** the Veteran and Executioner still carry the pre-v43 spider hand, because
`creatures.py keep_fingers` copies their TRELLIS donors' baked weights and both donors
(`src/assets/source/backups/{veteran-v1,executioner-v5}.glb`) predate the fix. Regenerating those donors is an
other-fighter change; `tests/hero-hands.test.ts` keeps both rows `skip:`-flagged so the gap stays visible. Scalable Chars
already rebuilt pitborn/goblin/nightborn (entry below).
**For new characters:** `parts.py` now carries `fit_finger_bones`, so ANY humanoid built through it — new archetypes
included — gets correct knuckles for free; only bodies whose `body_*` parts predate it need a rebuild.
**Worktree:** ~/Developer/frankendom-char. Memory key: `-Users-domininclynch-Developer-frankendom-char`.

Entries moved verbatim from the root PROJECT_STATE.md on 2026-09-21 (state split). Append new entries at the TOP. Keep evidence and remaining validation in every entry (AGENTS.md).

## Loot v2 — every visible armour slot is takeable (Scalable Chars, 2026-09-22; owner via Strategy/Lead: "any armour or weapon slot")
loot.glb now carries every armour slot each beta humanoid visibly wears, not one to three fixed pieces: Veteran and Executioner
Helmet/Crest/Body/Arms/Greaves/Boots, Nightborn Helmet/Body/Arms/Boots, Pitborn Body/Arms, Goblin Body/Arms, Dwarf Greaves — 39 draws
(was 15), `src/loot.ts` LOOT extended in the file's slot order (drop order = slot order; tests/loot-data.test.ts pins moved with it).
Body = the tunic and what hangs on it (baldric, belt, buckle, studs, collar); kilt/skirt/hose are leg cloth with no paperdoll slot and
stay the player's; wraps are the Arms item where an opponent wears nothing over them (Veteran, Executioner, Nightborn), the Pitborn's
plates and the Goblin's bracer stay the `over` Arms pieces; the Goblin's Body now carries his rag tunic kit AND the trophy necklace
(one id per opponent per slot). Not exported, on purpose: the Pitborn has no helm/greaves/boots (bare, barefoot), the Nightborn no
gloves/greaves, the Dwarf's helm/body/arms iron is texture speckle (loot v1 cut), no Gloves exist for anyone.
Materials: a tunic's material becomes `Gambeson_<opponent>` with HIS linen bake (colour + his small normal; ORM measured uniform on
every fighter — rough .88, metal 0 — and shipped as factors), since the runtime swaps only same-named materials for the player's and
the whole point of the Veteran's tunic is his linen. This also fixes loot v1's Nightborn Body, which rendered in the hero's undyed
linen. Texture diet for the 1.5 MB cap: Bronze takes the 46 KB base normal, the Dwarf's iron colour 768²/q82 (loot_dwarf.py
`--color-size`/`--jpeg-quality`; the cut geometry is the committed one, not re-cut). Result 1,446,168 B gzip packed (cap 1,500,000).
Render `artifacts/character/loot/v2/hero-wearing-full-sets.png`: the hero in each full set, runtime material rule emulated.
tests/loot-wear.test.ts's worn-set pin became id-based (a piece is every draw of its id — the Goblin already had two). Open: the
Weapons lane's weapon drops; Lead's choice UI and take rules.

## Hero hands v44 — rig knuckles fitted to the mesh (hero lane, 2026-09-22, owner: "solve it please, AAA grade visual for hands")
The off-hand still read as spider fingers after v43 because the rig's finger joints sat past the mesh's knuckles (index 3rd
knuckle at 93 %, bone tip 130 % of the finger). `parts.fit_finger_bones` re-places every digit's joints at 45/75/100 % of
the mesh finger along the bones' own directions and re-weights the skin; `build-warrior.mjs` adopts the body part's finger
joints (rest positions + inverse binds) for warrior.glb AND loot.glb. Face sha-identical to v43; face textures v43 bytes.
Evidence: `artifacts/character/humanoid-v44/` (before/after sheets, untracked), `tests/hero-hands.test.ts` hero row
`knuckles` (fails on v43's GLB: `index_l: third knuckle at 93 %`), quality:stop 427 tests / 425 pass / 0 fail / 2 skips.
Found + fixed on the way: worktrees that pull past f4ff30a lose `artifacts/source/{face,keentools/…}` and the sparse face
fit silently replaced the dense one (chin −5 mm) — now a loud SystemExit unless HEAD_DENSE=0; restore with
`git archive f4ff30a^ artifacts/source/face | tar -x`. Remaining: the other humanoids share the rig defect (their
body_* parts predate fit_finger_bones) — Scalable Chars' rebuild through the fixed parts.py picks it up for free.

## Spider-hand fix reaches the opponents — pitborn, goblin, nightborn rebuilt (Scalable Chars, 2026-09-22)
#255 (hero v43) fixed clean_finger_weights/straighten_fingers in parts.py's realistic_body(), but only warrior.glb was
rebuilt after; every opponent still shipped the pre-fix bind (Lead Dev's assignment, verified by Character Main and Auditer).
tests/hero-hands.test.ts generalised from warrior.glb alone to six bodies (BODIES table: file, mesh node, minVerts floor —
warrior/pitborn/goblin/nightborn are 'Skin' via parts.py's realistic_body path; veteran/executioner are 'CreatureBody' via
creatures.py's TRELLIS reconstruction, see below). Run against trunk before any rebuild: pitborn, goblin, nightborn, veteran
and executioner ALL failed (only warrior passed) — the fault reaches every opponent, not the three named in the assignment.

Rebuilt (`blender ... parts.py -- --body realistic --fighter <X>` then `WARRIOR_FIGHTER=<X> node scripts/build-warrior.mjs`):
pitborn, goblin, nightborn now pass. File size deltas are the geometry/bake noise expected from finger and AO changes, not a
regression: pitborn +2,992 B, goblin +3,524 B, nightborn +2,908 B against the committed files. `nightborn-estoc.glb` (the
weapon shelf twin, byte-identical to nightborn.glb by contract — tests/weapons.test.ts:459, and it HANGS ~280s on a mismatch
rather than failing fast, a real trap) rebuilt to match. check-budget PASS (worst pairing veteran 8.82 MB of 12; dist 23.84 MB
of 32 — unchanged category, no regression). `npm test`: 368/368 excluding the two known-out-of-scope failures below.

**Veteran and executioner still fail, and "rebuild through parts.py" does not fix them.** Their shipped GLBs are TRELLIS
reconstructions (`node scripts/build-creatures.mjs veteran|executioner`, mesh node `CreatureBody`) that never call parts.py's
realistic_body() — `creatures.py`'s `keep_fingers` (family in executioner/dwarf/veteran) copies the DONOR's already-baked
finger weights verbatim. Their donors are static backups — `src/assets/source/backups/veteran-v1.glb` (2026-09-20 19:59),
`executioner-v5.glb` (2026-09-20 14:11) — both older than the finger fix (23:04) and never regenerated since; both are also
referenced elsewhere (`skeleton`'s recipe uses veteran-v1 as its base too; `veteran-polish-check.mjs`/`veteran-neck-check.mjs`
check the donor file directly). Fixing them means regenerating those donor backups through a realistic-body parts.py run and
re-running the TRELLIS transfer — a bigger, shared-file-touching job than this one; left out on purpose, flagged to Lead Dev,
not silently skipped.

**Environment note, not code:** this worktree was missing ~485 MB of gitignored static source assets
(`artifacts/source/{face,human-base-meshes,hunyuan,keentools,lps,outfits}`) that `parts.py` needs to run at all, including
three fighter-specific KeenTools reconstructions (pitborn, goblin, hero id also used by executioner) that exist only in the
`frankendom-pitborn` worktree and the Nightborn's own TRELLIS head (`nightborn-trellis-01.glb`, gitignored, `frankendom-
nightborn` only). The first two rebuild attempts ran anyway — `os.path.exists(HEADMOD.KT_GLB)` fails silently to a generic
stand-in head instead of erroring — and had to be discarded once the size/log mismatch was caught before committing (a
stand-in head would have shipped as a visible face regression). Copied from the worktrees that hold them; not committed
(gitignored, unchanged from what's already shared across worktrees).

## Loot export v1 — Brief 5, Scalable Chars lane, 2026-09-21 (Strategy's assignment on the owner's "take the decision")
`WARRIOR_LOOT=1 node scripts/build-warrior.mjs` → `src/assets/loot.glb` (1.11 MB gzip packed; cap 1.5 MB in check-budget, its own
line, never a pairing). Eleven skinned draws `<opponent>.<slot>.<material>` bound to the hero rig (same bind as warrior.glb, no
BUILD.bones, no clips, no body): Veteran helm + crest + bronze greaves, Executioner mask + hood + greaves, Nightborn crown + closed
tunic/collar + boots, Pitborn bone plates (the script's own primitives, rigid to the hero's joints), Dwarf iron greaves. Manifest
`src/assets/source/loot/loot.json` names each piece's source (parts.py/items output, or `@build:` for primitives), slot, and `layer`:
`replace` (the runtime hides the player's draws in that slot — helm hides Hair, tunic hides Body, boots hide Boots) or `over` (worn on
top: greaves over bare shins, plates over wraps). Slots: Helmet, Crest, Body, Arms, Gloves, Greaves, Boots — Greaves, not Legs, because
the player's Legs draws are his kilt. Materials: the runtime takes a draw's material from the player by name when he has one (Steel,
Leather, Gambeson, Heraldry, Wrap → his own maps); loot.glb carries complete materials only for what he lacks: Bronze (hero-tone maps
from manifest_realistic.json), DwarfIron (baked), Ruby/BoneWorn (plain). `loot-preview.html?opponent=veteran|…|all&slot=…` shows the
player wearing a set with exactly that recipe (`mesh.bind(player.skeleton, player.bindMatrix)`).
The Dwarf has no authored kit (his iron is baked into the TRELLIS surface): `scripts/character/loot_dwarf.py` (Blender) samples the
baked metallic map per vertex on the position-merged graph (the surface is split along every UV seam), smooths it, takes the iron
patches ≥ 100 faces per slot by dominant bone (≥ 300 faces per slot), and writes them in his re-proportioned rest space with his
transferred weights + 1024/512 JPEG crops of his maps; the loot build's `unscale: "dwarf"` inverts BUILD.dwarf's per-bone field
through those weights (`proportionField()`, the same code the donor build uses) — the greaves land 0.8 cm median / 2.9 cm max from
the hero's skin (tests/loot.test.ts pins median < 1.5 cm, p90 < 2.5 cm, max < 5 cm, span on the shins; without the unscale the same
metric reads 2.6 / 5.8 / 7.3 cm on the Dwarf's shorter legs). Only the greaves survive as a piece, and as scattered iron scraps rather
than solid plates — the metallic mask is what it is; a v2 could shell the whole shin instead. Body/Helmet/Arms iron is speckle. They
follow the knee through Guard and Walk without cutting the kilt hem (renders in `artifacts/character/loot/v1/`).
Byte-neutral: with WARRIOR_LOOT unset the script's output is unchanged (cmp against the untouched trunk script: identical hero and
dwarf-donor builds). Goblin (second pass, same day): his trophies are the loot build's own primitives — the tooth-and-finger cord raycast over the
PLAYER's skin and level-1 kit (loaded for the rays only, never exported) as `goblin.Body` (over), the iron bracer with its brass bands as
`goblin.Arms` (over); 15 draws, 0.99 MB gzip. Open: the five parametric kits re-run on the hero body via a parts.py `--kit` (Character Main; today's pieces are the
opponents' own fits — the Executioner's mask/hood are shelled from HIS skull), runtime attach + slot swap + wearing state (Lead Dev),
paperdoll (Web design), helm-on-severed-head (Finishers).

## Dwarf v2 — owner-approved look, character lane (2026-09-20)
Owner reviewed v1 in the arena and asked for four fixes ("A grade"): support-hand grip, chrome shoulder plate, soft face, true dwarf
proportions. v2 (`char/dwarf-v2`):
- Proportions: a re-proportioned donor rig (`build-warrior.mjs` BUILD.dwarf — legs −28 %, torso/limbs +20–25 % girth, short thick neck,
  bigger head, root .95) stands 1.494 m (Veteran 1.804); built from the Veteran's parts via `WARRIOR_PARTS_VARIANT`, to
  `src/assets/source/creatures/dwarf-donor.glb`, rebuilt by `build-creatures.mjs dwarf` before the fit. New `dwarf` archetype in
  `moves.ts` (scale .78 = measured 1.361/1.745 in the shared Idle, 170 health, poise 12: a stab (11) never stops him, a cut (14) does; Veteran AI profiles),
  pinned by a standing-height test in `tests/characters.test.ts` (±0.03, < 0.9 of the hero). Reach stays the ordinary trident's
  (≈22 % shorter than the Veteran's by design: he has to get inside). The fitter scales its ~1.80 m z thresholds by height/1.80 for
  the dwarf family only; every other family keeps k = 1.
- Grip: the donor's 40 finger tracks now drive the reconstructed fingers (shared `keep_fingers` path with the Executioner, #206);
  `creature-check` requires the supporting hand on the shaft (< 0.08 m) like the Skeleton's. Hands are rounded before binding.
- Face: source regenerated at TRELLIS.2 resolution 1536 (same seed/faces/textures); the 45k budget is spent on the head and hands
  (torso/skirt/legs absorb the decimation), beard hairline holes filled, head relaxed volume-preservingly (beard full, brow/eyes/nose
  a third). Owner: "much better".
- Plate: `metallicFactor 0.35` on the Dwarf surface (creature_pack SURFACE_FACTORS); retained maps stay byte-identical. Up close the
  plate still shows TRELLIS's baked highlights; geometry ironing was tried and reverted (it faceted the arm).
- Generator hash moved (creatures.py), so every creature is rebuilt in this PR; the five others are checked accessor-equivalent to
  trunk's. Reproducible: the dwarf rebuild reproduces sha 85f5c387…. Ladder placement unchanged (sixth rung) pending the owner.

## Werewolf and Skeleton — integrated locally, publication pending (2026-09-19)
Both official TRELLIS.2 exports are fitted to the shared animation pipeline: Werewolf/Pitborn/cleaver and
Skeleton/Veteran/trident. References, prompts, source hashes and licences are retained. Skeleton receives bone
impact audio and no opponent blood; player blood/feedback remains. Local encounter migration passes PostgreSQL
checks but is not hosted yet. New creatures retain ordinary death, with paired finishers disabled.
Published maul/claw68ccdf2, cleanup0f50814, audio4408215, finisher3803433 and Veteran63c57e are integrated.
Skeleton was rebuilt against the polished Veteran donor: 38 original clips and 190 pose checks pass; idle/thrust/guard CPU renders reviewed.
Production packing preserves decoded accessor bytes, animation and materials. JPEG entropy recoding preserves pixels and colour/orientation metadata;
identical used textures are emitted once and shared by rigs. Source GLBs remain self-contained. Independent checks cover all ten rigs and 40,388 accessors;
corrupted geometry, materials, clips and missing/corrupted external textures are rejected. Actual final build: 30,077,291 bytes gzip total /32 MB,
conservative per-fight including every shared texture 9,806,495 /12 MB. No cap increase or texture resizing.
Narrow WASM CSP and hosted encounter migration are staged, not applied to VPS. Browser checks/publication remain pending in the reserved creature window.
Nine software-rendered impact assertions and Skeleton framing pass; corrected landscape previews reviewed. Portrait resize capture correction awaits final browser pass.
Previous full CPU regression:297/297; current compression regression3/3. Full inherited35-command suite must run on the frozen combined candidate.
No live/completion claim.
Evidence: artifacts/character/werewolf-skeleton/ and artifacts/character/compression/.

## Veteran neck and material finish — 2026-09-19 (PR #172)
Owner approved the matched before/after previews and authorized publication. The existing Veteran now has a continuous neck contour, shared collar skin weights and blended skin colour/normal/roughness maps. The trident shares restrained worn-bronze maps; armour, leather and linen receive the earlier material polish. Facial features, weapon geometry/reach, skeleton, clips, topology, UVs and unrelated surfaces remain preserved. The offline build is repeatable; alternate Veteran weapon builds also pass.

Integrated published trunk `3803433`. All 33 configured release commands passed on `74596c4`, including full quality, browser combat/recovery/account checks, all finisher and creature regressions, material-source parity and neck checks. The neck regression samples 191 poses with maximum separation 0.001011 mm. Default rebuild and repeated material bake are byte-identical. Accessor bounds match stored values. Asset SHA256: `6101410cd0d2ca4800ef86b8fb96fec49bb174aaff0d01e09f2a85519b01b3cb`. Download budgets pass: 9,914,620 bytes gzip per fight / 12 MB; 30,872,459 total / 32 MB. Evidence is in `artifacts/character/veteran-neck/`; matched WebGL comparisons are in `artifacts/character/veteran-polish/`.

This review-record update does not change validated code or assets. Publication uses `scripts/deploy.sh`; final public revision/asset parity and live browser receipts belong in `artifacts/character/veteran-neck/live/` and PR #172. GitHub hosted CI cannot start because of account billing/spending limits and is not reported green. Physical-handset appearance/performance remains the owner's live test. A future creature asset combination requires its own distribution-budget validation; no caps or other fighter assets were changed here.

## Wraith size feedback — 2026-09-19
Owner approves both creatures and requests Wraith +50% size. Scoped presentation change in spectral.ts scales the complete Wraith rig 1.5 about its floor, keeping weapon and wisps attached. Minotaur and all shared assets stay unchanged. Considered asset rebuild versus runtime uniform scaling; runtime scaling is the smallest reversible option and adds no geometry/download cost. Existing lifecycle test pins Wraith 1.5 and Minotaur 1.0. Simulation remains the Nightborn archetype: rendered weapon/body grow while collision dimensions and attack reach retain existing tuning; this is an explicit playtest limitation, not a combat rebalance. Camera/ground/grip and public-game checks recorded in artifacts/character/wraith-size/. Integrated Opened94d988a. Audit found root scaling raised light/thrust strikes above hero height; a Wraith-only upper-arm aim correction blends through wind-up/recovery and restores before each mixer update. Real-GLB regression pins torso-height contact, unchanged grip, zero-dt stability, exact1.5 rematch scale and guard reset. All configured gates and public parity are required.

## Reconstructed creature integration — 2026-09-19 (owner playtest)
Owner explicitly requests Minotaur and Wraith live in the game with actual pictures for playtesting.
Both approved reference images exported through signed-in official TRELLIS.2; raw GLBs and MIT software
licence retained in src/assets/source/creatures/. This supersedes the earlier no-export/art-only state below;
procedural and MPFB studies remain rejected. No paid job or new runtime dependency.

Added the two encounters after the five existing entries. Pitborn cleaver and Nightborn estoc simulation,
clips and exact weapon geometry are reused. Fitted intact A-pose surfaces have corrected inverse binds,
four normalized influences, 45k body triangles and original compressed textures. Including weapons:
Minotaur 45,611 triangles, Wraith 46,214. Wraith has graded transparency, moving wisps and 28 ash points.
Paired executions are disabled for these creatures; ordinary death/reset remains the fallback.

Audit caught and fixed A-pose binding mistakes, claw-to-thigh transfer and leg/shoulder seam stretching.
Visual review caught UV-island cracks missed by edge-only sampling: welding coincident vertices before decimation fixed them while preserving per-corner UVs. The Wraith donor arm angle/length/depth was fitted to its actual claw; grip proximity now passes all sampled armed/attack/guard poses. Isolated fur/cloth bend edges still flag 12–15cm stretch in the diagnostic; no runaway geometry is accepted, and final deformation polish remains an owner visual-review item. The formal
asset check validates base/source/generator hashes, exact animation channels and weapon geometry,
original map bytes, four-influence normalization, triangle ceiling and 125 finite poses per creature.
Integrated published weapon/auth/Quiet One/dust/audio trunk 5c46f46 while retaining every inherited completion gate.
Account encounter constraint migration adds the two IDs; local real-PostgreSQL saves and existing RLS checks pass.
Hosted migration applied with verified TLS; authenticated saves/revisions, invalid-opponent rejection, two-user isolation and anonymous denial pass. Test data rolled back. Exact receipt: lead checkout artifacts/account/live/hosted-creature-migration.md. First actual-game phone landscape/portrait tests passed both opponents: served rig hashes, attacks/damage, ordinary player death, rematch and zero browser/shader errors. Final welded/grip build visual pose review passed. All 20 configured commands pass on 819697e, including 277 tests, both real creature fights/rematches, existing finishers/weapons/audio, and account browser/database checks. Exact-head GitHub CI also passed. The final publish/live-model checks are recorded in artifacts/character/creatures/RECEIPT.md and PR #150; physical-phone and owner art feedback remain open.
Evidence: artifacts/character/creatures/. Physical-phone performance and owner art/playtest feedback remain open.

## Earlier character direction correction — 2026-09-19 (historical art review)
Owner rejected the procedural Wraith/Minotaur pilots as amateur. Installed and tested official MPFB 2.0.17
in Blender 5.2.1; editable macro/target sources, rig test and static GLB exports exist under
artifacts/character/mpfb-test/. MPFB test: Minotaur 29,436 triangles; Wraith 27,802 and BLEND transparency.
Both load in Three.js, but visual audit rejects them as final creature art. No Frankendom combat retarget claimed.
Owner approved newly generated seven-view reference sheets: integrated muscular bovine anatomy for Minotaur;
skeletal, crowned, wispy and semi-transparent Wraith. Prior solid-bodied Wraith direction is superseded.
Official free TRELLIS.2 generated a stronger Minotaur shape and 48 native preview frames. GLB extraction
failed on anonymous ZeroGPU quota; no exported TRELLIS mesh exists yet. Browser sign-in requested;
connected HF account does not automatically authenticate the local Gradio client or browser.
No Wraith reconstruction or production integration claimed. Recipes, source/licence hashes and current
gate distinctions: docs/character-pilots.md. All outputs remain local art-review material.
Revalidation: full quality (252 tests, lint/build/audit/budget/browser) and all six completion
commands passed; receipts in artifacts/character/mpfb-test/gates.json. These baseline checks
do not close the failed art acceptance or blocked GLB extraction. World release hold respected.

## Multi-character anatomy pilots — 2026-09-19 (character lane, NOT LIVE)
Owner authorized Wraith/Minotaur pilots, efficient shared production, an audit and previews for iteration.
Isolated `codex/01a0b8f7/main` from 15bea7e. Offline Blender maker and existing-viewer capture/judge create
editable component scenes and animated GLBs from committed Nightborn/Pitborn assets. No archive/API dependency.
No roster, combat, blade bake, live GLB, camera or finisher changes. All 24 original clips, inverse binds,
weapon nodes/meshes and original binary payload are preserved. Wraith retains the existing face UVs with a
bounded cheek sculpt; Minotaur has original head/neck/horn geometry. Full production art is not approved.
Audit caught initial 70k-triangle outputs; final Wraith 59,745 and Minotaur 57,207 stay below the existing
60k ceiling (including rigid weapons). Added draws: 2 and 5. The judge now enforces that ceiling and source/generator hashes.
Verification: full quality PASS (252 tests, lint/typecheck/build/audit/budget and browser), all existing completion
commands PASS; final pilot completion rerun after geometry fixes. Receipts: artifacts/character/pilots/.
Self-review covered payload/rig isolation then front/profile/rear, eight motion samples and phone framing.
Art verdict: useful first silhouette/fit studies, not A-grade final characters. Wraith still needs independent
face/cloth identity; Minotaur needs stronger anatomical planes, head/body material continuity and fitted kit.
Inherited human feet, no validated creature hit regions/finishers, unmeasured physical-phone performance.
Workflow and exact commands: docs/character-pilots.md. Owner reviews these before any roster integration/release.

## The Executioner — fifth opponent, v5 — 2026-09-18 (character lane, owner brief; NOT SHIPPED — branch `char/executioner-v1`, PR #111 owner-approved, merge pending)
The owner's brief (7 masked reference portraits, `artifacts/source/face/executioner/reference/`): a giant headsman — iron
half-mask riveted over nose/cheeks/mouth, ragged hood, buckle harness, ~20 % over the Pitborn. v5 (owner, 2026-09-18, on
approving the PR visuals): his skin is DARK CHOCOLATE, mid-African — "not full black" — where the v1–v4 stand-in shipped him
white/olive like the Veteran. `skin_mul (0.66, 0.55, 0.46)` paints the body and the new `photo_mul (0.66, 0.55, 0.46)`
tints the STAND-IN photograph (applied after delight, before the neck band, so the collar ring the body continues is the
tinted tone) — one factor both sides, so the hue stays matched; body bakes to median sRGB (94, 60, 40), the face tile to
(80, 51, 35). The mask/hood could not go to
the KeenTools scanner (it would bake iron and cloth into the skull), so a bare-head 7-angle portrait set was generated to the
handover spec (`artifacts/source/face/executioner/executioner-01..07.png`) and uploaded — then `/process` returned 402
Insufficient credits, same block as the Nightborn (owner declined the €11 top-up there). The head ships as the STAND-IN (the
hero's scan, nightborn precedent): `head.FIGHTERS.executioner` (chin off — the jaw lives behind iron; buzz 0.14) records the
one-command resume, avatar `01a0b094-dcd8-7792-835d-5bdb88f42cf6`, no re-upload needed. decimate 0.08, far below every other
fighter: his face is never seen (eyes/brow are separate meshes, skin normal baked from the full-res head) and the v3 head at
the Veteran's helmed 0.26 broke the 60k skinned-triangle ceiling (61,363; 0.20 still shipped 60,827) — v5 ships 53,839.
Registrations: `parts.KIT.executioner` (charcoal linen (0.16, 0.15, 0.17) — above the 12 % phone floor; grime 0.85;
build + brute; greaves, boots, helm slot), `build-warrior BUILD.executioner scale 1.36` (owner: "20 % larger than Pitborn",
no hunch — he stands straight; numerically verified against the pitborn GLB), runtime `OpponentId` + `OPPONENTS.executioner`
(longsword placeholder, health 160, poise 12, `PROFILES` — the combat lead owns his real profile; he fights the Veteran's
brain until then) + `OPPONENT_GLB`, and the LADDER: fifth rung after the Nightborn (owner, 2026-09-18 — src/ladder.ts;
characters/graphics/ladder tests enumerate him). Kit parts authored in `parts.py`:
`executioner_mask` (iron half-mask raycast-fitted to the face, Steel, ships via the Helmet slot) and `executioner_hood`
(ragged hood, Heraldry near-black, ships via the Crest slot so it survives the mask's Helmet replacement); pteruges dye
near-black; NO tusks (they are the Pitborn's). v3 on the owner's v2 review: the hood's throat bib is CUT (it read as a
floating black plate on the sternum — the throat is bare under the mask now) and the greaves are blackened iron, a dark
baseColor factor over the bronze map. v4 on the owner's v3 review: the mask and greaves read darker-and-shinier than the
hood ("fake") — `finishMaterials` now drops the ORM map for Steel/Bronze on HIS GLB only and lands scalar matte factors
(metalness 0.45, roughness 0.88), greaves baseColor `#4a4239`; every other fighter untouched. Also v4: the Jog flight bound
in tests/characters scales with the fighter's scale k (probe: man 0.285, pitborn 0.323 @1.13, goblin 0.193 @0.835,
executioner 0.379 @1.36 — the fixed 0.32 only survived on the Pitborn by 12-frame sampling luck). Evidence:
`artifacts/character/executioner-v1/` (baseline audit), `-v2/` (mask + hood + near-black kit), `-v3/` (no bib, black
greaves) and `-v4/` (matte iron), `-v5/` (dark-chocolate skin — the approved look; turntable, details, gameplay
portrait/attack, faces, sequence); executioner.glb 6.22 MB
raw, 21 clips, per-fight budget PASS. Gate: green at df0e4e3, after the 1afa0cb trunk merge, on v3 (9d26d9a), and v4/v5 node
tests 227/227 (characters triangle + scaled-flight assertions included). Not done: the real KeenTools head (one top-up +
one command), his real weapon (weapons lane — the sword on his back is theirs), his combat profile (combat lane), mask
rivets/perforations (texture-level).

## The Nightborn's face — the no-credits pass — 2026-09-17 (nightborn lane)
The owner spotted the Nightborn shipped with a borrowed face (the stand-in: the hero's KeenTools scan, credits exhausted at 402) and
declined the €11 top-up for now — "try the free version." The stand-in is RESTYLED to his owner-locked identity on its own texture,
no new assets, no scan: `head.FIGHTERS.nightborn` gains `skin_mul` (1.28, 1.35, 1.50), `pallor` and `dark_eyes`. The photographed head
is restyled in `keentools_head` on `filled` (position grids from normalised vertex-group bakes, the az_c/az_s pattern): skin paled
grey-white and cooled with the dark features keeping their ink, the buzz and the synthesised crown strands gone cold black, the
photographed stubble melted into the surrounding skin, the eye sockets sunk, a thin old scar across the throat 2.5 cm under the chin
tip; `eye_colour` takes the iris toward black and halves the sclera lift; `body_colour`'s own pallor block drains the body to match
(skin_mul alone brightened but stayed warm — tan shoulders beside a grey face). Pointed ears land as geometry: `parts.ear_points`
(`KIT 'ears': 'points'`), two 3 cm cones on the scan's own helix tops, rigid on `Head`, wearing the face's photo tile — the goblin's
`ears()` untouched. Not done, by design: the shoulder-length hair fall (REQUESTS #2 — a new part, and at the duel camera the black
buzz + pale face + black kit already carries him) and the unique KeenTools face (REQUESTS #1, ~€11, the flags restyle the real scan
the same way). Evidence: `artifacts/character/nightborn-face-v{1,2,3}/` (faces, details, gameplay stills, sequence.webm); v1 exposed
that the photographed face never took skin_mul, v2 the tan-body mismatch. Gate 224/224 + browser gate; blade paths byte-identical
(texture-and-ears only: no clip, timing, weapon or sim change); per-fight budget 8.36 / 9 MB.

## Character art pass — 2026-09-13
- Owner authorized the free Quaternius foundation with original armour after an iPhone 15 movement spot check at 59 fps / p95 18 ms. This does not pass the minimum-device/external-player gate. Paid sourcing is superseded; no purchase or outreach occurred.
- Implementation: one self-contained CC0-derived GLB, original fitted helmet/plate harness/scabbard/heraldry and baked surface textures. Free Standard base narrowed by 10%; four retargeted clips (idle/walk/jog/run). Provenance, source hashes and rebuild instructions: src/assets/README.md; generator: scripts/build-warrior.mjs. No additional runtime dependencies.
- Rendering only: cloned independent skeletons share geometry/textures. Gaits follow actual displacement, including collision stops. Locked camera still frames the opponent; the body turns with travel during locomotion to avoid forward clips sliding sideways. Directional combat locomotion remains a later requirement. Pure simulation, collision and guest state are unchanged.
- Rejected approaches: hand-keying all locomotion would discard the coherent foundation; a runtime modular armour system adds unnecessary code/draw calls. Bake original armour into four skinned material groups offline instead. Geometry welding and removal of unused face morphs reduced the asset to 2.28 MB raw.
- Review pass 1: 17 tests cover prior simulation/storage/camera behavior plus normalized gait blending, actual shipped animated mesh bounds/foot contact, finite poses and independent skeletons. ESLint, typecheck/build, dependency audit and payload budget pass. Static output approximately 3.03 MB raw / 1.00 MB gzip; actual HTTP compression must be checked after deployment.
- Review pass 2: production-CSP preview caught blocked embedded textures. Add blob sources for model image decoding and validate required textures so a partial load cannot silently pass. Portrait 390x844 and landscape 844x390 were inspected; joystick release resets, camera lock works, journal opens/closes, and Aldren survives reload. Successful preview has no new console errors. A separate deliberately missing-model preview shows the retry message and retains capsule movement. Failure QA used an empty build DSN to avoid sending expected test errors to production monitoring.
- Browser preview reports about 60 fps / p95 17–18 ms on the desktop host. Physical iPhone 15 with this new asset, minimum phones, multitouch interruptions and five-minute thermal performance remain unverified. Art is an early original pass, not final AAA production art or full combat coverage.
- Release procedure: CodeGraph synced; 17 tests and final checks passed. Scoped Nginx texture/compression policy applied with successful nginx -t and active service. The first asset transfer hit a transient public SSH refusal before release switch; saved public key retry succeeded, Tailscale timed out. Deploy now reuses one bounded SSH connection for mkdir/transfer/switch. Public checks passed: homepage, revision, JS, CSS and GLB all HTTP 200 and byte-identical to the local build; local/remote/deployed revision matched and the checkout was clean. Active Nginx config matched the repository. Model compressed transfer: 827,457 bytes. Live portrait rendering, textures, camera lock and touch release were checked; no live console errors or release-matching Sentry issues at verification time. Detailed HTTP receipts are in ignored artifacts/release-audit.json.

## Character pass v1 — 2026-09-14 (branch `char/hero-v1`, worktree, no runtime files changed)
Owner decision: one universal humanoid with collectable equipment slots; level-1 starting kit first. The tin-can knight is
replaced by the whole CC0 body (face, eyes, eyebrows, buzzed hair, own skin/normal/roughness maps at 1024/512 JPEG with an
original ash-and-grit pass) and a level-1 kit generated headlessly in Blender from the body surface (sleeveless linen tunic,
studded leather baldric and belt, forearm wraps, sandal-boots, dyed under-skirt and kilt strips on the Heraldry surface,
iron studs on the Steel surface). Longsword rebuilt with a diamond blade, bronze furniture and a real scabbard; the
SwordDrawn/SwordSheathed nodes and sampled tip are unchanged, so `src/blade-paths.ts` is byte-identical after re-bake.

Evidence (identical camera/lighting per view; harness in `character-preview.html` + `scripts/character-preview.mjs`):
`artifacts/character/baseline/*` (60e94b3) vs `artifacts/character/humanoid-v5/*` — turntable, 21-clip sheet, 12 close-ups,
lock-camera stills at 390×844 and 844×390 @1.5, 6 s combat sequence. Audit of the baseline: `artifacts/character/audit/DEFECTS.md`.

| resource (per fighter unless noted) | baseline 60e94b3 | character pass v1 |
|---|---|---|
| triangles | 35,330 | 25,208 |
| draw calls, two fighters incl. shadow pass | 36 | 56 (10 materials; Eyes/Eyebrows/Hair/Blade are candidates to merge) |
| GLB raw / gzip | 3.39 MB / 1.10 MB | 3.51 MB / 1.64 MB (JPEG maps do not gzip) |
| texture memory with mips | 1.4 MB (four 256² maps) | 15.4 MB (1024² skin colour+normal, 512² ORM, rest 256²) |
| dist gzip (check-budget) | 1.28 MB | 1.82 MB (limit 5 MB) |

GAMEPLAY CHANGE flags: none. Contract held: 21 clips in order and duration, `Steel` skinned mesh with maps, both sword
attachments under `hand_r`, `Heraldry` material recoloured by the runtime, blade paths unchanged, 71 tests, budget and browser
gate green on every commit.

Reproducible build: `blender -b -P scripts/character/parts.py` (writes `src/assets/source/parts/level1.glb` and the skin maps +
`manifest.json`; committed) → `npm run build:warrior` → `node scripts/bake-blades.mjs` → `npm run quality`.

Since then (same branch, through 735a1bf): equipment-slot draws (one skinned mesh per slot × material, `extras.slot`; hair is
its own slot); Guard replaced by the CC0 UAL2 `Sword_Block` raise-and-hold retimed to 1 s (Parry/BlockImpact derive from its
hold; blade paths unchanged); UAL2 attack candidates as an opt-in build (`WARRIOR_UAL2_ATTACKS=1`, fails 3/71 on contact
geometry → combat review, REQUESTS.md #6); equipment items as demo builds (`WARRIOR_ITEMS=ranger,helmet_bronze`): Ranger boots,
bracers and pauldron from the CC0 outfit pack with re-tinted maps, and an original bronze crested helm (first Helmet slot; hides
hair). Per-fighter triangle ceiling raised 40k→60k by the owner (REQUESTS.md #7). Evidence per label under
`artifacts/character/` (`humanoid-v6` = shipped default; `items-ranger`, `items-helmet` = demo builds). Remaining for the lead:
runtime slot show/hide/swap, the helmet-height test ceiling (REQUESTS.md #9), combat review of the attack candidates. Requests to the lead in
`artifacts/character/REQUESTS.md` (GAME_SPEC art-direction text, equipment-slot contract, N8AO, Guard clip duration).
Integration for the lead: merge branch → `node scripts/bake-blades.mjs` → `npm run quality` → deploy.

## Slice W — the Pitborn's body (Opponent 3, part 2) — 2026-09-16
- `src/assets/pitborn.glb` from the pipeline per fighter: `parts.py --fighter pitborn` (KIT `bare`/`brute`/no `helm`: rag sash instead of the tunic, crude iron belt, rag kilt, wraps, barefoot; `build_shape` shoulders and chest at 2× the Veteran's gain plus a thick neck; `tusks()` on the KeenTools head — seven owner portraits, scan `01a0ab5b…`, `skin_mul` (0.74, 0.80, 0.84) because the scan's neck band is lit paler and warmer than the grey-green cheeks) → `WARRIOR_FIGHTER=pitborn build-warrior.mjs` (`BUILD.pitborn`: root scale 1.13 = `OPPONENTS.pitborn.scale`, hunch spine_02/03 +7°, neck_01 −7°, Head −6° post-rotated into every clip's keys about each bone's bind-pose sideways axis; `Bone` material; three bone plates on the left shoulder, two on the sword forearm; blackened `Steel`, undyed `Heraldry`). No helm, so no items.
- Contract: 21 clips, same durations, every bone track byte-identical to the hero's except the four hunched bones; `hand_r`/`SwordDrawn`/`SwordSheathed` transforms identical; stands 1.957 m to the hero's 1.745 (×1.12 = scale less the hunch). 58.3k tris, 3.19 MB gzip. Harness `--enemy /src/assets/pitborn.glb` → `artifacts/character/pitborn-v3/`. Lock views at 390×844 and 844×390 frame him with headroom: no camera request.
- Open for a kit pass (owner's eye first): iron knee plates (the classic-body `knee()` primitive read as boxes and was dropped), rope-textured wraps, bone plates as authored parts instead of ellipsoids; the cleaver is the weapons lane's (BRIEF-pitborn.md § Weapon). Budget cap 12 → 16 MB gzip (owner: "expand as needed, not excessive").

## Slice X — the goblin (Opponent 4, character lane) — 2026-09-16
- `src/assets/goblin.glb` from the per-fighter pipeline: KeenTools scan of the owner's seven portraits (`artifacts/source/face/goblin/`, scan `01a0ab81…`), `head.FIGHTERS.goblin` (buzz stubble, scars, `skin_mul (0.80, 0.77, 0.78)`), `parts.KIT.goblin` (rag tunic, baldric scrap, thin belt, wraps, barefoot, no helm) + `parts.ears()` (flattened cones rooted by raycast at the scan's ears, on the photo tile at a cheek texel) → `WARRIOR_FIGHTER=goblin build-warrior.mjs`. Brief + decisions + evidence index: `artifacts/character/BRIEF-goblin.md`; requests to the other lanes: `artifacts/goblin/REQUESTS.md`.
- **The rig is re-proportioned in data, not shrunk** (`BUILD.goblin`, `reproportion` in build-warrior.mjs): per-bone scale about the joint in the rest frame through every part's skin weights, rest positions + inverse binds rebuilt — legs ×.84, arms ×1.16, neck ×.9/.86, head ×1.17, hunch 9/9/−8/−8°, pelvis dropped by the legs' loss (0.142 m, soles unchanged), walk bob ×.84, root .835; standing 1.357 m = ×0.778 → `OPPONENTS.goblin.scale .78` (the measured height ratio; the capsule follows it). Library clips bit-identical to the hero's except the hunch; IK-authored clips re-solve on his limbs with the hand goals lifted by the drop; the Roll gets a floor clamp on the arms (was −0.104 m, now +0.045). `stride .70` on the GLB root → `characters.ts` plays ArmedWalk/strafes faster by it (no clip change). Necklace cord fitted by raycast over everything worn; one iron bracer, left forearm. 55.9k tris, 3.26 MB gzip; dist 14.63 / 16 MB.
- Data: `OPPONENTS.goblin { knife (longsword placeholder, alias re-baked), .78, health 100, poise 0 }`, PROVISIONAL profile on today's knobs (parry 0, dodge .5, reaction 10); `?opponent=goblin`. The fight identity (feints, guard share 0, back-step after landing, circling, regen) needs AI knobs — REQUESTS #1–7; the fairness battery is not pinned for him. AI-vs-AI today: median 18.2 s. Tests 171/171; `npm run quality` green (gate incl. browser); real-app probe `artifacts/goblin/live-goblin.mjs` (GLB loads, HUD 100/100, fight starts, no errors, phone screens). Camera request: at close range on 393×852 he hides behind the hero's back (REQUESTS #8). Head pass: the portraits' grey backdrop smeared onto the crown is marked unseen (`backdrop_cool`, b ≥ .85 r above the hairline) and the fill tone follows the stubble (`hair_lum .42`); the scan's pinnae are flattened under the goblin ears. Open: the flattened pinna's pinker patch in profile, ear shape, bracer maps.

## Goblin polish — 2026-09-20 (character lane, char/goblin-polish)
Ears lofted with a lobe and a torn notch; body tone greyed to the face; the pink band behind each ear (the scan's ear photo projected onto the skull band the tile unwraps to its outer edges, past the crown fill's feather) painted out by forcing the fill on that measured UV band (`head.FIGHTERS.goblin.ear_fill`, `crown_fill(force=)`); the scan's real ear flaps flattened and re-mapped. Goblin-only flags; other fighters' builds untouched. 300/300 tests, quality:ci, browser gate and the dist probe green; goblin.glb 3.31 MB gzip (+48 KB); budget 30.84/32 MB. Evidence `artifacts/character/goblin-polish/`. Still open from the brief: the lock camera hides him behind the hero at close range on 393×852 (REQUESTS #8, camera lane).

## Pitborn texture diet + phantom rivets — 2026-09-20 (character lane, Pitborn only)
- His two 2048² maps (rag-sash colour, scan-head roughness) ship at 1024: GPU texture estimate 116 → 80 MB (image headers, RGBA8 + mips), gzip 2.94 → 2.90 MB, no visible change at the lock camera or the face harness zoom. Scoped by his rows only: `linen_maps(size=1024 if KIT['bare'])`, `FIGHTERS.pitborn.photo_orm_1k`; every other fighter's bake path is unchanged.
- The black specks on his back and chest were the kit's 22 baldric rivets, still placed along the baldric a bare fighter does not wear (not the scars pass): none for `KIT['bare']`. Belt rivets stay (his belt is iron).
- Evidence: 300/300, `npm run quality` green incl. the browser gate; before/after in `artifacts/character/pitborn-0920` vs `pitborn-diet2`. Measurement gap found on the way: `character-preview.html`'s texture table counts the hero only — the opponent has never been in the phone number (lead/QA to decide).

## Roster hold — 2026-09-20 (owner: Minotaur and Werewolf wait for after beta)
- The #179 Pitborn diet was reverted (63f4cd9) because the Minotaur and Werewolf are creature bakes on the Pitborn base and record its sha256 — the new `pitborn.glb` made them "stale" at `creature-check`. Owner's decision: don't rebuild, **hold** them until after beta (Season 2). #185 (the rebuild route) is closed; the diet is re-landed here on top of the hold with no creature rebuilds.
- `hold: true` on a ROSTER recipe: still built and a valid OpponentId (saves resolve; `opponentFor` falls back to the first rung), off the ladder (`LADDER`/`nextAfter` skip it; a held id has no next), listed disabled "(on hold)" in the journal picker, its GLB left out of the bundle by scene.ts's asset glob (a literal — `tests/ladder.test.ts` pins the exclusions to exactly the held bodies), and skipped by `creature-check`/`creature-browser-check` (still runnable on demand). `.quality-gate.json` untouched (the lead's gate split #187 owns the creature-only release checks).
- Held now: minotaur, wraith, werewolf, skeleton. The owner named Minotaur and Werewolf; Wraith and Skeleton are held on the lead's reading of the same beta freeze (the plan the owner forwarded puts them in Phase 2) — one flag each to reverse, and the owner was told so. The beta ladder is the five men. Per-fight worst opponent is now the Veteran; quality gate green incl. the browser gate.
- Rule that still holds mechanically: a change to a base rig makes any *live* creature baked on it stale — rebuild those, or hold them.

## Grade materials — 2026-09-22 (brief 14, the table only; nothing wired to data yet)
- `src/grades.ts` is the **ten**-tier ladder (owner via Strategy, 2026-09-22, superseding the eight I first shipped): the tiers ARE `career.ts`'s `TITLES`, so a tier and a rank are the same word and the journal can say "Praetorian iron" and mean one thing. `TIERS = TITLES` itself rather than a copy, so the two cannot drift; the test holds them identical (mutation-proved by reordering the table). Recruit rag & scrap, Legionary leather, Gladiator bone, Veteran copper, Champion bronze, Praetorian iron, Master steel, Primus blackened, Invictus emerald (Dom, 2026-09-22: black vanadium at 9 read flat against blackened at 8), Origin gold & ruby. A grade is a **material variant on the shared kit piece, never a different mesh** — the draw and its triangles are identical at leather and at ruby, so a grade cannot change what a piece covers. That is the same rule #434 bought from the Pitborn sash, arriving before the tiers rather than after.
- A grade repaints three classes — `metal`, `trim`, `leather` — and deliberately **not cloth**: a tunic's colour is the opponent's house dye (`OPPONENTS.grade.house`), so two opponents of one house wear the same linen over different metal.
- The Gladiator's bone is the one rung that steps **sideways** rather than up — almost no metalness, pale ivory. It reads as a different KIND of armour instead of a better metal, which is what stops the low ladder being three shades of brown; the test pins it as less lit than the copper above it.
- `CLASS_OF` maps every palette material loot.glb carries. Exemptions are decisions, not omissions: bone is bone at every grade, and the Nightborn's `Ruby` crown is authored artwork the owner approved (2026-09-18) — the tier `ruby` and the material `Ruby` are different things. `tests/grades.test.ts` reads the shipped GLB's draw names, so a new piece with an unclassified material fails rather than passing ungraded (mutation-proved: drop `Leather` from the table and the test fails).
- The record the lead will add to each `OPPONENTS` entry is declared here as `GradeRecord` (`level`, `tier`, `kit`, `epithet`, `house`). **Nothing in this lane reads `OPPONENTS.grade` until that field is on trunk** — the lead's instruction, 2026-09-22.

## Arena guard — what the world lane relies on (2026-09-22)
- `Pace` travels at **0.963 m/s at timeScale 1**, measured off the shipped `guard.glb`: 0.642 m of forward foot separation, two steps per the 1.333 s cycle. Any patrol speed other than that × the timeScale makes the feet skate. `guard-preview.html`'s old `PACE_SPEED = 0.9` was judged by eye and is corrected here. There is **no `stride` userData** on the guard and there should not be: `stride` is a re-proportioned rig's leg correction (goblin, dwarf), and the guard is the hero rig at the hero's fit, so the correction is 1.
- **The world lane does not play `Turn`** (their decision, 2026-09-22, PR #435): a guard watches whichever fighter is nearest, which is a continuous heading, and `Turn`'s in-GLB `root.quaternion` track would compose with their outer-root yaw and spin him 360°. So a rebuild that changes or drops that root track cannot break them — and nothing obliges us to keep authoring it. The other four clips are load-bearing: `Pace` loops, `Stand` is the hold, `Raise` (0.50 s) and `Lash` (0.60 s) are LoopOnce + clamp and their wind-up is played at clip/lead.
- Fingers and toes carry **no animation tracks at all** — stripped for the animation budget; they sit in the rest pose gripping the whip. If anything ever needs a finger to move, that is a rebuild, not a runtime fix.
- **Slots, and the long pole (same ruling):** Recruit wears 2 of 6; from Legionary on every opponent wears the full six — Helmet, Body, Arms, Gloves, Greaves, Boots — Goblin and Pitborn included. Crest is the helmet plume, appearing at Gladiator and growing with tier. The human Veteran archetype alone gets a **shield** from Legionary on (7/7, paperdoll off-hand, tier finish, takeable); whether it blocks in the sim is Combat's rule, queued behind the four player weapons. Live today: Pitborn 1 armour piece, Dwarf 1, Goblin 2 — so the kit library owes a full six across all three rig families, shared pieces fitted per family by raycast. The shield and the new slots land with their meshes, not before: `LOOT` is pinned against the file's draws (`tests/loot-data.test.ts`), so a slot with no mesh would fail rather than wait quietly.
