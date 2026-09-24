# Visuals & world — project state

Entries moved verbatim from the root PROJECT_STATE.md on 2026-09-21 (state split). Append new entries at the TOP. Keep evidence and remaining validation in every entry (AGENTS.md).

## Lane state — arenas 2/3, arena select, signature effects, 2026-09-24

### Now
- **Signature effects (Dom order via Lead, 2026-09-24).** The brief is `docs/briefs/signature-effects.md` on `origin/strategy/state-1235`
  (fcd29abe); read it from origin. This lane owns: (1) the FRAMEWORK PR: a cosmetic-only registry keyed to existing duel
  events (Hit / Parried / Blocked / Dodged / Charging / Charged / AttackMissed, …) per opponent id, with persistent marks capped
  (suggested 6 per body, 4 per shield, 8 on the floor; oldest fades first) and cleared at fight end. No sim change. It also adds an admin "Signature"
  select (Off / On, plus A/B/C while alternatives exist) in Options → Next fight beside the Arena select, with the same gate as #648's `#arena-row`.
  (2) **Dwarf Hammer Stamp** (a clean heavy stamps the maker's-mark dent decal on the struck body). (3) **Witch**: staff sparks
  during `Charged` (the drone stays), plus a short-range Grasp on her landed charged hit. No projectile. One PR per effect, each with a receipt: a 2 s
  clip or a 3-frame strip at 375x812, plus a perf line. Land the framework FIRST and send Lead its API shape (other lanes build on it).
  ETA given to Lead: framework ~11:00Z, Dwarf ~13:00Z.
- **#648 (Arena select), open at 82b988e4.** It sits on the Options tab beside Opponent. The row `#arena-row` ships hidden and is shown by
  account.ts `showTools` for the admins roster and by main.ts for `?debug`. The pick is stored in sessionStorage (`frankendom.arena-override`)
  and applied at the next load; `?arena=` still wins. Waiting on Lead/Deploy to merge.

### Done today
- **#624 merged (2a41ed4e):** Arenas 2 and 3 are four labelled options for Dom: A Night Pit (low flickering firelight, embers,
  clay), B Rain Yard (wet slate plus reflecting puddles, rain streaks), C Blood Sand (noon sun overhead, blood-stained pale sand, dust),
  D Sunken Cistern (vault, silt under water, light shafts, drips). ARENA_PICK is provisional: A → Arena 2, B → Arena 3. Dom: "put
  them live, I'll decide". Stills and per-option perf are in the #624 comments; evidence images are on `evidence/world-arenas-624`.
- The theme seam in `src/arena-themes.ts` has optional fields: `light` (key-light position; `flicker` sways it, applied in scene.ts), `weather`
  (drives the one Points cloud: ash/embers/rain/dust/drips), `wet` (floor roughness), `shafts` (additive light shafts plus pools), and
  `textures.patch` (`puddle`, which drops roughness by the mask's alpha, or `blood`).

### Open
- Dom's pick of two of A–D for ARENA_PICK is a one-line change. The phone `?perf=1` reading per arena is still owed after he plays them.
- C's heat haze was not built (it needs a full-screen pass, which costs every phone on every frame).

### Gotchas
- **Floor luminance is measured in LINEAR space** (arena-themes.test.ts, 15 % band around Arena 1's 0.087). An sRGB tint of ×1.33
  moved it ×~1.9. Tune the tints by roughly the 2.2th root of the ratio you need.
- **Test harnesses stub main.ts's imports module by module** (tests/graphics.test.ts and 8 others). A new import in main.ts resolves
  to `{}` there and failed 51 tests. Put static data in index.html, or add the module to every harness map.
- **The deploy guard blocks the WHOLE Bash command** when any part of it looks heavy (a test run, a build), including the edits in the same call.
  Make file edits with the Edit tool, or in a separate call, while a deploy holds the lock. Check `~/.claude/state/deploy_in_flight.json`
  immediately before any render: a scratch `node` script is NOT blocked by the guard, and I ran one render during a deploy.
- zsh: `$C:refs/...` in a push refspec parses as a `:r` modifier. Write `"${C}:refs/heads/..."`.

## Lane state — presentation / world, 2026-09-22 (trunk cb4e0ef)

### Now (2026-09-22, end of session)
Four PRs open, all mine, none merged at the time of writing:
- **#485 fix trunk** — URGENT, ahead of everything: trunk becec83 fails `tsc` (TS2304, arena.guards still read the removed
  lorarii), which blocks every lane's build and quality:stop and stops Deploy publishing #467.
- **#467 the guards come off the wall** — the owner's fix for tonight; sim untouched.
- **#466 `?perf=1` overlay** — the instrument of record for the phone.
- **#463 gotchas** — the four instrument rules below.

Next work, on a fresh session: the REPLACEMENT presentation for the wall guards — six silhouettes baked into the wall
texture at the sixths, a one-draw ribbon streak for the lash, a shadow sweep on the sand for the raise (scaled by the
event's `lead` ticks). **No skinned meshes, no per-frame animation.** Bar: p95 under 16.7 ms on the owner's phone read
through `?perf=1`, with the tell still readable from the fighting camera before the lash. `lorariusAngle(i, tick)` still
gives the six sixths; `guard.glb` stays in the repo as the hero-rig reference.
Also still open, non-urgent: measure the guards (or their replacement) while the camera is actually ON the walkway — take
it from a finisher tour capture, where the camera frames the wall naturally.

### Done today
- **Brief 13 — six lorarii on the walkway** (PRs #430 capsules, #435 model → reverted #442, #450 re-land). `src/lorarii.ts`:
  six guards on the ring wall at r 12.1, y = `LAYOUT.wall.top` 2.6, outside `CAMERA_CLAMP` 11.5, so never on the sand and never
  in the fight camera's clear zone. Posts at each sixth's centre offset half a sixth (none on the gate axis); each paces
  ±16° of his post and turns to watch the nearest fighter. `lorariusAngle(i, tick)` is pure in the SIM TICK so Combat can
  source the whip's shove direction from the same guard and a replay places him identically. Bodies are Multi Chars'
  `src/assets/guard.glb` (#428): SKINNED, so six `SkeletonUtils` clones with a mixer each, never one `InstancedMesh`; built one
  per frame. Capsules remain the fallback; `?guards=<n>` caps the count. Whip timing comes from the event — the lead between
  `WhipRaised` and `Whipped` is 60 ticks before the first lash and 30 before repeats (`RULES.wall.loiter`), so the hold is
  `lead − raise` and Raise plays at `clip/lead` (clamp 0.4–2.5). The jeer reads `duel.fighters[i].loiter > 0` — no new event,
  and Audio reads the same field. Seam: `arena.update`'s optional `SimView` ({ tick, fighters }), one line in `scene.ts:614`.
- Versus card: loading line matched to the caption (15px Arial, 3px tracking, #e9ddc5, full opacity) with three dots pulsing in
  turn (1.6 s, 25 → 100 → 25 %, stilled under prefers-reduced-motion); stills re-rendered 30 % wider (`--zoom` on
  `scripts/versus-cards.mjs`, fov ×1.3). PRs #400, #408.
- Death screen: Share is a 44 px link-styled button above Next, right-aligned with it; the status takes the link's place for
  2 s and only for NAMED confirmations — an error must persist, and "Couldn't make a link, try again." is exactly 32
  characters, so a length rule would have cleared it. PR #411.
- End-of-fight camera: a touch anywhere during the arena-cam tour hands the camera back, gated on the tour actually running.
  PR #394.
- Thumb cluster look (owner's "D3"): grey glass fill `#a39f9722`, hairline `#c9c4b8a6`, no inset ring, ticks .55, centre ring 0
  at rest but still lit to .95 for Stab held / straight Guard; stick ring and knob softened. PR #420.
- Release row 33 (`endgame-hud-check`) made deterministic: it sampled during the 250 ms fade and skipped anything at opacity 0,
  so it had been passing by accident. It now waits for the fade, then asserts the TOP BAND never covers the body and the
  cluster buttons stay inside `#actions`. PR #424.

### Open
- Combat's `WhipRaised` is on trunk (#441) but this lane has not seen a real raise-then-lash in a live fight: the raise path is
  exercised by `tests/lorarii.test.ts`, not by the sim. First thing to watch on the next fight capture.
- The owner's bar for the guards is unverified by eye: six on the wall from the fighter's camera on an iPhone, raise visible
  before the lash. The numbers pass; nobody has looked at it on the phone yet.
- `Turn` is authored but never played (see Gotchas); if a patrol reversal ever wants it, the yaw-lerp has to go first.

### Gotchas (2026-09-22 — each one cost real time)
- **Green on its own base is not green on trunk.** Two PRs whose diffs never touch the same LINES can merge cleanly into
  code neither branch contained, and no per-branch CI ever runs the combination. Mine: #466 (the ?perf=1 overlay) ADDED
  `get guards() { return lorarii.standing; }` to arena.ts while #467 (removing the guards) DELETED the lorarii it reads.
  Both green on their own bases; trunk becec83 then failed `tsc --noEmit` with TS2304 and blocked every lane's build and
  quality:stop until #485. The shape to watch is one PR adding a REFERENCE near another removing its REFERENT — renames,
  deletions of shared symbols, cleanup PRs. If a gate fails in a file your branch does not touch, check trunk first
  (`git show <trunk>:<file>`, tsc on a clean trunk checkout), tell the owning lane, and do not patch someone else's file —
  that is exactly what the Pitborn lane did here and it saved the time.
- **When you A/B a cost, make sure one arm actually has NONE of it.** I compared six guards against ONE guard, saw the same
  loading hitches, and told the lane "not the guards". Wrong: one guard already pays the first-pose price, so neither arm
  was a control. Against a genuine ZERO-guard build the worst frame from document start drops 974 -> 655 ms and frames over
  25 ms go 13 -> 11. Both things were true at once — six skinned clones are nearly free in steady state (68.0 draws/frame
  whether six, one or shadowless, because they are culled from the fighting camera) AND about a third of the load spike.
  The owner overruled our numbers from his phone ("definitely slower now because the guards") and he was right; the guards
  came off the wall the same night (#467), with RULES.wall.loiter and the whip audio untouched. **When the person playing
  the game disagrees with a lane's measurement, suspect the measurement.**
- **A check that runs on the Mac measures the Mac.** `guard-browser-check.mjs`'s "phone tier" is Playwright on this Mac at
  852x393 DPR 2 with `isMobile` and NO CPU or GPU throttling, so every phone-tier frame time quoted on 2026-09-22 — mine
  included — described this laptop's vsync, not an iPhone's GPU. Worse, rAF deltas cannot measure frame COST at 60 Hz at
  all: p50 sits at ~16.7 ms for an empty page, so a 16.7 ms ceiling fails everything and a 18 ms one passes anything.
  Multi Chars proved it from the other side (#462): six guards vs one gave IDENTICAL rAF (p50 16.7 / p95 18.5) while CPU
  frame cost under x4 throttling moved 2.5x. Their row now asserts CPU frame cost instead. **The instrument of record for
  the phone is `?perf=1` on the device** (main.ts, style.css `.perf`): p50 / p95 / max, dropped frames over 16.7 ms
  COUNTED, worst frame since load, guards standing/asked-for, draws, triangles. Read the DROPPED COUNT, not the p95 — on a
  vsync-capped device the p95 sits near 16.7 whatever happens and the dropped count is what moves.
- **The first pose of a skinned model is expensive.** "Worst since load" on the phone viewport: 817 ms with six guards;
  Multi Chars' harness 1,037 ms at six against 187 ms at one — shader compile or first-pose work, and it scales with guard
  count where the steady state does not. It is a first-frame cost, not steady stutter; if a jank report is "at the start of
  a fight" rather than throughout, this is the shape to chase.
- **Assume nothing about the environment `main.ts` boots in.** `tests/graphics.test.ts` runs it in a node VM with no
  `URLSearchParams` (49 tests failed on mine), and the same VM has bitten other lanes over import-time `document` and
  `removeAttribute`. Read flags with a regex over `typeof location === 'undefined' ? '' : location.search`.
- **A check that loads a preview page measures the preview page.** `scripts/guard-browser-check.mjs` boots
  `guard-preview.html`, Multi Chars' standalone review page — NOT the game. Its "6 guards, 148,404 tris, 86 draws,
  p95 17.6 ms" was quoted (by me, then by Lead) as the phone-tier cost of the guards IN GAME, and a budget row was set
  from it. It never described the game at all. **Whenever you quote a number, say which page produced it.** The in-game
  figures, counted by wrapping `drawElements`/`drawArrays` on the real canvas at 390x844 dsf 3: **68.0 draws/frame**, the
  same with guard shadows on, with them off, and with `?guards=1` instead of six — because from the fighter's camera the
  walkway is out of frame and all six are culled (and their mixers skipped). The lorarii cost ~0 while you fight; they
  render only when the camera looks at the wall.
- **`castShadow` on the lorarii was already a no-op**: `arena.ts` fits the sun's shadow camera to the pit floor and the
  wall's foot, not the walkway, so the guards were never in the shadow pass. Turning it off changed 68.0 → 68.0.
- **The loading-phase hitches are not the guards.** Frame-gap trace from document start (not an average — an average hides
  this shape): worst frames 974 / 577 / 486 / 313 ms with six guards, and 956 / 603 / 410 / 272 ms with `?guards=1`. The
  same hitches, slightly worse with ONE guard, so they belong to the other assets, not to guard.glb (504 KB, lands at
  ~1.0 s, during loading and before the player can act).
- **The boot fetch budget is a product rule, not a harness quirk.** Anything fetched before first paint costs EVERY cold load,
  phones included. `guard.glb` on the boot path took down deploy #105 (DEPLOY_EXIT=1, nine rows, no flakes). Load after first
  paint — and not inside a fight either: deferring it there stalled the main thread mid-exchange and
  `quiet-one-browser-check` timed out waiting for the canvas to go stable. A hitch a harness can see is a hitch a player feels.
- **A frame-time that never fetched the asset measured the capsules.** My first two phone runs looked fine and meant nothing:
  `guard.glb` was never requested. Check `performance.getEntriesByType('resource')` for the asset in the SAME run before
  trusting any perf number.
- **`scripts/finisher-preview.mjs` counts an actor as "a top-level scene child with a pelvis bone".** The lorarii are built on
  the hero skeleton and live in the arena group, so THE ARENA GROUP became a third actor, `framing` came back undefined, and
  eight rows failed reading `.side` off undefined — for a reason with nothing to do with fetching. The arena group is now
  excluded by name, and a genuine third FIGHTER still fails. Nobody would have guessed this from the symptom.
- **Rebase before concluding a fix didn't work.** Two re-land attempts "failed" the blood gate on a stale base; the same code
  passed on trunk c7d942a.
- **`Turn` is a 180° about-face with a `root.quaternion` track INSIDE guard.glb**, one level under the node this lane
  positions — playing it composes with the outer yaw and spins the guard 360°. The world lane never plays it
  (`docs/state/character.md`, #438, records this).
- **Keep `src/lorarii.ts` free of Vite-only syntax.** `?url` imports and `import.meta.glob` are not resolvable under node, and a
  glob in `arena.ts` broke `tests/arena.test.ts`. The URL is handed in instead.
- **`scripts/roster-browser-check.mjs` means fighter rigs.** Arena GLBs were always excluded (props); `guard.glb` is now named
  in its `ARENA_GLB` list. Size is governed by check-budget's own `guard` row: 231,620 B packed gzip (504 KB is the unpacked
  file — the number that got quoted wrongly during the incident).
- Measured off guard.glb and not to be re-derived: Pace **0.963 m/s at timeScale 1** (walk them slower and the feet skate),
  Raise 0.50 s, Lash 0.60 s, no `stride` userData, no finger or toe tracks.

## Wound-site mark removed — presentation lane, 2026-09-21 (PR #305, merge d379696)
Owner, from a phone screenshot of the Goblin: the flesh-hit wound mark (a dark mark with three drips for the sim's four-second
wound window) floated in the air behind him. Root cause: the mark was drawn at a fixed human torso height (1.15 m) while the
Goblin's own chest bone sits at 0.74 m; on full-height rigs the same fixed height buried it inside the mesh, so nobody noticed
it there either. First fix pinned the mark to the rig's own site bone (PR #304, superseded); owner then asked for outright
removal instead ("lets remove the wound mark, no need"). `gore.ts`'s `arm`/`hide` API and the standing-mark positioning are
gone; the pooled decal itself survives only because The Quiet One's throat-cut finisher still draws it at the animated neck
(`tests/gore.test.ts` pins both: no standing-mark API, throat cut still fades/hides/clears). Receipt: a landed heavy on the
Goblin, side view — floating mark vs nothing, `artifacts/presentation/wound-mark-removed/goblin-before-after.png`.
Remaining: `GAME_SPEC.md`'s gore-upgrades paragraph still described the mark as shipped until this same pass (audit finding,
2026-09-22) — corrected there too.

## Versus card — presentation lane, 2026-09-21 (PR #254, merge 0cd0ac2)
Owner, from the loading screen: "can we have a static actual player image that matches the fight about to happen … rather
than these weird pillar things?" (the capsule stand-ins while the rigs download). A full-bleed `#versus` card now covers the
arena from page load with a still of the real upcoming fight — the hero and the actual opponent, armed, rendered from the
game's own models and arena via `scripts/versus-cards.mjs` (one WebP per live ladder rung, 40–43 KB each, 256 KB total) — and
a "You vs `<Name>`" caption; it fades out (0.45 s) the instant `createScene` reports the rigs are in. Six stills committed:
Veteran, Pitborn, Goblin, Nightborn, Executioner, Dwarf. `tests/graphics.test.ts:497` pins the lifecycle.
Audit finding (2026-09-22, corrected same pass): the hide condition was keyed on the literal display string
`status !== 'Loading warriors…'`, which happened to work only because scene.ts emits exactly three status strings today; any
future in-progress status line would have lifted the card early. `scene.ts`'s `assetStatus` callback now carries an explicit
`kind: 'loading' | 'ready' | 'failed'` alongside the display text, and main.ts keys off `kind` only — two new regression tests
cover a re-worded in-progress status (must not lift) and a load failure (must lift, so the retry notice stays readable).

## Mobile stamina bar fix — presentation lane, 2026-09-20 (PR #248, merge f9a6d1c)
Owner, from an iPhone screenshot: the player's stamina bar showed only a dark-red stub at its right end, never the fill. Cause:
on phones every meter draws as a CSS gradient on the element, but the desktop `#stamina` rule (the lost-ceiling attrition
shading) has id specificity and silently replaced the phone gradient — health has no such rule, which is why it alone drew
correctly. Fix layers both gradients (shading over fill) in the phone `#stamina` rule — 3 lines. Receipt: Playwright at
393×852 with `--fill: 55%; --max: 80%` forced on the meter, before/after, `artifacts/presentation/hud-stamina/before-after.png`.

## Sparks: silver, fanned, glinting, then a visibility step-up — presentation lane, 2026-09-20/21 (PRs #219, #227, #242, merges 5e08ce9 / e07aa0f / 3ea6ceb)
Four owner passes on the clash-sparks effect (`clash-sparks.ts`), each with before/after impact-preview strips:
1. **#219** — grey, thinner, uneven, 70% opaque (from bright uniform orange dots); damage numbers made an optional journal
   setting, default off (`main.ts`, `frankendom.damage-numbers.v1`).
2. **#227** — "maybe a silver reflection then, rather than just grey": cool silver-white cooling to dull silver, no yellow, no
   additive glow; sparks re-aimed to fan sideways/upward across the blades instead of a jet straight away from the defender
   (the strips showed the old jet flew behind his own head and shoulders at the over-the-shoulder camera — the only sparks the
   owner ever saw were the few that cleared his arm); one 3-frame silver glint at the contact point.
3. **#242** — "i cant see the sparks now… a bit more visible": size 0.075 → 0.1, white on strike, glint 3 → 5 frames, one more
   spark per clash (4–8, was 3–7), streaks 3–8 points.
Live sparks today are still these dot-based ones (`PointsMaterial`); a from-scratch streak renderer (thin motion-blurred
lines, per the owner's reference photos — a round sprite reads as a circle) was rewritten in `clash-sparks.ts` after the
owner flagged the dots looked fake, but is uncommitted pending capture and a laptop-free window — not reflected here yet.


## Arena props, startup worker, crowd cull, sky environment, sparks v2 — presentation lane, 2026-09-20 (branch presentation/arena-props)
Five authored props generated on the owner's Hugging Face Pro account (TRELLIS.2 from prompted reference images) and dieted in Blender
(3–5k tris, 512–768² WebP, metallic-roughness → factors): a portcullis that replaces the procedural gate bars once loaded, a weapon rack
on the walkway, a fallen shield, a column drum and a bone pile in the sand band — 672 KB gzip after build packing, +7 MB GPU desktop /
+1.75 MB phone (maps capped 512²/256²), placement held to the exclusion volume by `tests/arena-props.test.ts` from a size table.
Startup: the arena's heavy maps generate in a Web Worker behind flat stand-ins (`buildArena` on the main thread 1,067 → 204 ms) and
`scene.ts` `ready` waits for `arena.ready` so uploads land in the loading screen (p95 18–19 ms in every window; load at trunk parity).
Crowd: spectators outside the camera frustum collapse per frame (~33 of 291 stand at the portrait lock). Sun shadow frustum ±12 m.
The environment map is the arena's own sky once it has landed (warm sand below the horizon), intensity 1.0. Banners stop casting shadows
(the slab on the fighting sand); the gate light is a wider, fainter patch. Sparks v2 on the owner's live feedback: struck off the visible
blade, 3–7, staggered, thin, pale straw → ember, tone-mapped. Evidence `artifacts/presentation/{REPORT-arena-props.md,props-v1,sparks-v2}`,
`artifacts/world/{base,props}-{full,phone}`. Not done: baked AO (needs an unwrapped lightmap pipeline), KTX2 textures (needs the
basis_universal encoder — owner's OK), the phone AA decision and one-pass post (after KTX2). check-budget counts prop GLBs as opponent
candidates: true per-fight ≈ 10.4 of 12 MB.

## Contact grit — presentation lane, 2026-09-20 (branch presentation/impact-grit)
Owner-directed small realistic contact feedback, four steps behind the existing event stream, no sim change: (1) metal sparks
(`src/clash-sparks.ts`) off the defender's guard on a blade-to-blade block or parry — steel on steel only (a shaft, wood, a kick, a landed
blow: none), 4–8 hot streaks under gravity, one bounce off the sand, out ≤ 0.45 s; (2) guard shudder (`src/camera-kick.ts`): the trunk
camera kick was applied before `lookAt` and along the view axis, so it measured 0 px; it is now a world offset applied after the look-at
for the draw only — a heavy drops the camera 6 cm and holds two frames (11 px at phone framing), a heavy block 2.8 cm (6 px), a parry
flicks 2 cm sideways (4 px), all settled within 13 frames; a heavy caught on the guard deepens the body recoil ×1.5; (3) sand puff off
the defender's rear foot on a heavy that lands or is caught (`foot-dust.ts` `puff`); (4) kill dip: exposure −6 % for two frames, eased
back over two, kill only (−2.4 % crop brightness). Harness `scripts/impact-preview.mjs` (scripted block/parry/heavy/kill through the real
`createScene`, hit-stop reproduced) with before/after strips and camera traces in `artifacts/presentation/`; 4 new test files (7 tests).
Gate 314/314 + browser gate on cbec4cd. Phone amplitudes unverified on device; the shove table is one place to halve.

## Mixed, populated crowd and stronger foot sand — world, 2026-09-19
Colour follow-up: owner approved dust size, motion and one-second life but found it grey against the sand. Live phone step capture confirmed the mismatch; a muted golden-tan tint (`#b99a68`, previously `#c9b493`) now sits closer to the lit ground. Only the particle material colour changes. Close/portrait render review and existing lifecycle test pass; release receipts: artifacts/world/warm-dust-notes.

Owner accepted the softened colours and mixed crowd, then requested busy seating around all 360 degrees including the gate, and more visible one-second foot sand. Six subdued garment dyes (dusty maroon/charcoal navy/earth tones) and five body families are assigned independently using nearby-seat diversity before GPU batching. On 291 occupied seats, only 27/844 nearby pairs repeat a body and 10/844 repeat a dye. Every 30-degree sector has at least 24 spectators and 8 on the lower two tiers; rubble, arch lip and flames retain clearance. Tread height follows tessellated stone; actual support raycasts and full-vertex play/camera clearance checks pass. Arena 114,440 triangles / 120k, unchanged meshes and 11.01 MB textures. Physical phone timing remains unmeasured.

Foot sand uses a 48-point pool, five larger denser particles per plant, low lateral curls with drag and a 1-second fade. Idle, combat-pose suppression, teleport rejection, hit-stop and disposal remain intact. Lifecycle check verifies the longer tail and lower-leg height. Existing world preview now captures 12 sectors plus normal portrait dust on/off. Focused arena/dust 11/11, lint and typecheck pass; all 12 sector renders and stronger dust at portrait combat distance reviewed. Full contract, CI and live receipts are tracked under PR #156 and artifacts/world/mixed-crowd-notes. Integrated weapons f7a1e99 and its polearm browser gate; no fighter, combat, audio, camera or lighting edits from world.

## Crowd variety and foot sand — world, 2026-09-19
Owner requested subdued ruby/navy/brown/grey and other muted clothing, stronger sizes, lower-tier audience and restrained grounded foot sand. Six garment-only dyes preserve skin; separate trousers, two stances per five roster families, independent height/build variation. 219 spectators redistribute across five tiers with gate/flame/collapse clearance. Initial render rejected bright clothes and matching trousers; refined captures in artifacts/world/crowd-dust-final. Arena 9/9 and dust lifecycle check pass; full contract receipts in artifacts/world/crowd-variety-notes. Arena 26 measured draws,92,126 triangles,11.01MB textures; physical phone p95 remains owner-only/unmeasured.

Presentation seam coordinated with lead: cached animated feet feed a 24-point pool, one transient draw, 0.55s fade, no idle or combat-pose emission. Real walking-clip preview verifies emission and expiry; hit-stop, teleport and disposal verified separately. No audio/combat/fighter asset/global light edits. All eight local contract commands passed, including npm run quality (260/260 tests), both finishers, roster, audio, estoc, counter and world render checks. Delivery tracked in PR #151; exact merge/deployment and live receipts are kept in artifacts/world/crowd-variety-notes.

## World polish — 2026-09-19 (world/crowd-grounding-light; local, not yet shipped)
Owner approved four sequential passes: roster spectators, settled debris, softer gate light, selective masonry staining.
Step 1: replace the narrow crossed cards with five opaque instanced body silhouettes: human, goblin, Pitborn, executioner, Nightborn. No fighter assets, animation clips or gameplay changed. Irregular gaps and slight depth/yaw variation; existing bounded crowd reactions retained. First judge rejected boxy torsos; refined rounded bodies, darker clothes, hair and robe silhouettes. Arena tests 8/8; first full quality 246/246 + browser gate passed; refined geometry typechecks and arena tests pass. Fixed-camera captures: artifacts/world/polish-1-crowd-refined. Cost: 88,798 triangles / 120k, 21 measured arena draws (+1), 11.01 MB textures (-0.35 MB), floor luminance 0.105 unchanged. Physical phone performance remains unmeasured.

Step 2: settle curved shields, helmet and snapped shaft into the sand; small rubble and pottery gather around three existing column drums. Preserve all five separated in-ring gear sites. Dust uses existing iron vertex colours only, no wear decals. Arena 8/8, lint/typecheck and fixed-camera debris + duel review pass; play/clamp bounds hold. Captures: artifacts/world/polish-2-debris.

Step 3: soften the existing gate shaft through a broader feathered falloff, low-contrast bar interruption and lower peak; warm ground pool and geometry unchanged. Arena 8/8, fixed gate/duel captures reviewed (artifacts/world/polish-3-gate); zero texture/draw/triangle growth.

Step 4: localized dirt at the wall foot and tapering soot above the braziers, baked into existing vertex colours; 552 extra wall triangles keep stains near the ground. Stone albedo/normal pixels unchanged. Arena 8/8 and fixed-camera review pass (artifacts/world/polish-4-masonry). Final local npm run quality: 246/246 + real browser + dependency audit + budget PASS. World preview now runs as a completion command: node scripts/arena-preview.mjs --label quality-world (passed). Final arena: 89,482 triangles, 21 measured draws, 11.01 MB textures, floor luminance 0.105. Two-pass self-review checked clearance/reaction/disposal and fixed-camera materials/readability; no audio, combat, fighter assets, global lighting or camera edits. Integrated trunk 32f783e (roster and Split Crown) preserving both completion commands. Integrated npm run quality: 250/250 plus real browser, audit and budget PASS; all three completion commands (roster routes/migration, Split Crown modes/rematch, world captures) PASS. CodeGraph refreshed in the isolated worktree. PR #145 initial CI passed; integrated newly merged estoc d3114a9 and preserved its completion gate. Revalidation/release receipts pending in artifacts/world/polish-notes.
The subsequent estoc integration passed full quality and all four completion commands. Integrated counter release 3bfb0eb, preserving its browser gate; counter release verified by its lane and window released. Integrated lead 0c7b03f, preserving its Season 1 state. World owns the next release window; final combined gates/live receipts are recorded in artifacts/world/polish-notes.

## Arena life — 2026-09-18 (world lane, owner's picks #1–#5)
Owner: "anything else we can add to make the environment more engaging?" — approved five, built in order, each audited
(tests + captures) before the next. Sound left to the audio lane. **Ash motes**: 220-Point cloud, per-pixel sprite, slow
two-frequency drift + a gust on landed blows (`motes` — Points, not Mesh: the solid-geometry rules are about camera
collision); first pass was invisible at 5 cm/35 % — the brick's luminance noise floor — so 0.14 m, light-toned, reads as
dust. **Firelight**: `fireGlow` warm vertex tint on wall+tier bands above each brazier (angular proximity × height
window; static — the coals' emissive flicker carries motion). ~~**Battle-worn sand**~~ — owner rejected the decals on
review ("3 i dont like"), dropped pre-merge; the `sandWearAtlas` lessons (decal albedo must land below sunlit sand,
≈0.8×) are recorded here in case the idea returns. **Fallen gear**: dented
helmet, snapped spear, broken blade in the iron merge (zero draw calls), yaw-only + low (camera-clamp rule). **Gate
light**: the low sun spills through the arch — beam rides the real sun direction but lives inside the passage (r ≥ 11.7;
the contract caught the first cut at 11.35 m) fading to the floor, plus an additive warm pool where it lands (y < 0.5 is
exempt). Cost: 21/40 draw calls, 21.2k tris, 11.71/12 MB textures. Captures: `artifacts/world/arena-life-*/`.

## Flames frayed — 2026-09-18 (world lane, owner's art direction)
Owner, from the phone, after flames-fatter (PR #106): flames are ~50% of the pot, too pointy, too clean — "more like 70-80% of
the pot size… less pointy at top… more frayed/jaggy, separated a bit… gritty and realistic, not fake cartoony". `flamePixels`
(textures.ts) reworks the silhouette only (quad, anchors, palette and wave motion untouched): body width 0.65 → 0.88 with a
blunter profile (pow 0.5 → 0.42), two noise slots that drift apart with height split the upper flame into separate tongues,
high-frequency fray bites the silhouette harder toward the tip, the tip dies in a ragged noise line instead of a point, and a
per-pixel grain keeps the colour gritty. Measured on the brazier close-up: 145 px vs the 200 px pot rim (72%, was 55%).
Contract 226/226, zero draw-call/triangle/texture delta (+509 B source). Captures: `artifacts/world/flames-frayed/`; brazier
close-ups (new `scripts/arena-closeup.mjs` harness — the wide/lock views render flames at ~15 px, too small to art-direct):
`artifacts/world/flames-2-closeup/`, `flames-fatter-closeup/`, `flames-frayed/brazier.png`.

Objective: live responsive longsword practice on frankendom.com, with canonical persistent-fighter RPG direction.
Success: draw/strike, light chain/heavy/riposte, dodge/roll, directional block/timed parry, stamina, moving/guarding warden, player defeat/rematch; functioning movement/camera and saved guest identity; isolated verified HTTPS deployment. No claim of a passed player/hardware or online-combat gate.
Scope: GAME_SPEC.md. Semble discovery is working; CodeGraph was initialized with owner authorization on 2026-09-13. Use both for code work, and run `codegraph sync` after edits.
Files: src/{main,scene,sim,profile}.ts, src/style.css; tests; scripts/deploy.sh; deployment vhost.
Do not inspect/change other business products or existing VPS services.
Selected approach: Vite + TypeScript + Three.js static build, no framework/backend. Babylon and native web exports rejected for additional surface in this bounded gate.
Known risks: no physical minimum-phone tests or external player feedback yet; character art is an early original pass; server storage and actual PvP belong to 0B. VPS had ~1.3 GB free at discovery; deploy only a small static build and do not clean unrelated data.
Next validation: pure simulation invariants, storage failure/reload, touch cancellation, camera edge positions, rendered desktop/mobile layout, public HTTPS and source parity.

## Flames fatter still — 2026-09-18 (world lane, owner's art direction)
Owner, from the phone, after flames v2 (PR #104): "fire fatter still, still only 50% of pot size". The flame quads widen
0.95 → 1.3 m (`arena.ts`) and the texture body 0.5 → 0.65 (`flamePixels`), keeping the ragged tongue and wave motion. The wider
quad's vertices (with the lick scale) reached 11.49 m — inside the 11.5 m camera clamp — so the flame anchors move
`wall.inner + 0.42 → +0.55`; the 13 cm offset from the coal pans is invisible. Contract 7/7, zero cost delta. Captures:
`artifacts/world/flames-fatter/` vs `flames-2/`.

## Stone relief: the wall gets its surface — 2026-09-18 (world lane, owner's art direction)
The owner, from the phone: the masonry colour is right but the wall reads flat and machine-smooth — "add some dents, or bits, or
other surface imperfections randomly". The diagnosis: the wall had albedo only, no light response; the sand reads real because it
has a normal map. `stoneNormal` (textures.ts) carves the relief the albedo prints: the ashlar layout is extracted into `ashlar()`
and shared (the albedo is proven pixel-identical by checksum — the owner-approved colour is untouched), so mortar grooves,
proud/recessed blocks, chamfers and the albedo's own cracks land exactly on their printed lines, plus erosion undulation, surface
tooth, two layers of pitted dents and knocked corners. The stone material gains the normal map at scale 1.1. Cost: +1 texture,
11.0 / 12 MB texture memory, +0.8 KB source gzip, zero draw-call or triangle growth. Contract 7/7, full gate + real-browser gate
green. Captures: `artifacts/world/stone-relief/` vs `polish-4/`.

## Arena v1 — The Ashpit — 2026-09-17 (world lane)
The courtyard is replaced behind the lead's seam (`src/arena.ts`, `scene.ts` untouched): a sand-and-gravel pit (owner's call: a
traditional coliseum floor, no tiles) to a podium wall whose inner face stands outside the camera clamp, a portcullis gate on the far
side with a dark passage, chains, six braziers with flickering emissive coals (no lights), eight torn instanced banners, five broken
tiers with fallen blocks, a ruined colonnade and parapet, 235 crowd silhouettes on the upper tiers that bob on a blow, lean in on a parry
and recoil on a kill (≤ 0.1 m / 8°, still in a hit-stop), an ash sky dome with one break of light and fogged mesas. Every texture is
generated at load from seeded noise (`src/assets/arena/textures.ts`; +9.8 KB gzip on the shell, 9.6 MB of texture memory, no
downloads, no licences). The seam gains `floor` (the sand mesh, planar UVs `x / 3, z / 3`) as the decal slot. Measured with the new
harness `scripts/arena-preview.mjs` (game renderer/lights/fog/lock camera, rigs at the start, settled camera; before/after in
`artifacts/world/{baseline,arena-v1}`): 263 → 12 meshes, 330 → 15 arena draw calls in the portrait lock, 4.4k → 19.4k triangles,
floor albedo ≈ 0.24 → 0.088 against the hero's skin sample 0.166 (fighters are now the brightest thing on screen). Contract
(`tests/arena.test.ts`, 7 tests, instances walked): exclusion volume, boundary ring, floor darker than skin with decal UVs, crowd
placement and reaction caps, ≤ 40 meshes / 120k tris / 12 MB textures; 5 mutations caught. Gate 223/223 + browser gate on the new
arena. Not done: phone frame-time and startup measurement (no route from the lane), lighting values (proposal), the rename — three names
proposed (The Ashpit · Worldsedge · The Bonehollow) in `artifacts/world/REQUESTS.md`; report in `artifacts/world/REPORT.md`.

## Arena life 2 — 2026-09-18 (owner's phone pass)
On the live build the owner approved firelight + gate light, rejected nothing new, and asked for two fixes. **Motes were
invisible in gameplay** — the phone camera looks down at busy, dark-speckled sand where a mid-grey speck has no contrast
and the drift was too slow to catch the eye: now 260 (62 % inside r 7.2), 0.2 m, 0.62 opacity, ~1.8× drift speed; owner: "too large, floating grey circles" → half size (0.1 m), kept the contrast + drift.
**Gear wanted inside the ring**: five more pieces (sunk shield, blade fragment, trodden helmet, snapped shaft) scattered
r 2.8–7.6, ≥ ~1 rad apart. The play-circle rule (nothing solid above 6 cm inside r 8.55) means everything lies flat or
squashed into the sand — the contract caught the shield boss at 7 cm. Captures: `artifacts/world/arena-life-2-tuning/`.
