# Donor study and port plan: World of Claudecraft physical VFX (MIT)

Lane: combat-sandbox. Design doc only; nothing here is built. Donor read in place at `/Users/domininclynch/Developer/donors/world-of-claudecraft` (not a git checkout on this Mac, so the commit cannot be read from it; our existing notice cites `f46f30f`, confirm that is still the tree we port from before the first PR). Line counts below are `wc -l` of that tree. Estimates are focused hours for one dev, including a sandbox preview clip at 375 wide, not counting review wait.

Dom's ask: real physical special-move visuals, no glow sprites: weapon trails, ground cracks and shock rings, dust and stone fragments, hit-stop, camera shake, spin, leap, shield bash, melee contact impacts with blood.

## 1. Verdict in five lines

1. WoC's "physical" layer is a thin choreography brain (about 600 lines of pure math and tables) sitting on a huge engine (about 20,000 lines of pools, shaders, flipbooks, audio and gating). The brain ports cleanly. The engine mostly does not and should not.
2. The one piece of the engine worth lifting nearly whole is `solid_impact_fragments.ts`: real lit 3D stone and metal chips on the GPU, no sprites.
3. Almost every other visible element in WoC is additive-blended and HDR-multiplied (ribbons, rings, flipbook flashes, burst sprites, dynamic lights). That is the glow look Dom rejected. We take the geometry and timing and re-skin with normal blending and our own painted strokes.
4. We already have hit-stop, camera kick, blood, sand dust, clash sparks and a weapon trail. We port WoC's grammar and a few missing mechanisms, not its systems.
5. Total for the ranked list below: about 70 to 85 hours across nine pieces. First visible result (Ground Slam with real fragments, a crack and a heavier trail) is reachable in about 25 hours.

## 2. What we already have (so we do not port it twice)

| Ours | Lines | State |
|---|---|---|
| `src/fight/hit-impact.ts` + `camera-kick.ts` + `hit-stop-rows.ts` | 68 + 17 + 18 | Hit-stop is a global presentation pause in `main.ts` (sim ticks still run, records unchanged), rows in `hit-stop-defs.json`, camera Shove (along/drop/side/hold/settle). Already data. |
| `src/fight/gore.ts` | 536 | Splat pool, blade blood, body wounds, deterministic LCG (no `Math.random`). Keep. Do not port WoC blood. |
| `src/fight/clash-sparks.ts` | 110 | Normal-blended thin silver streaks, bounce, no additive. The right style; the model for how our own fragments should look. |
| `src/fight/foot-dust.ts`, `special-fx-quake.ts` | 77 + 186 | Painted-stroke sand plume (dark core, pale rim, no glow), ring ripple. This is already the "ground stroke" look; we reuse its `paintSheet`, `surface`, `noise/fbm`. |
| `src/fight/characters.ts` ~L469 and ~L842 | n/a | A weapon trail exists: 7 samples of the blade's contact segment, `MeshBasicMaterial` opacity 0.12, hand-built triangle list. It is thin and faint; no taper, no ageing, not a pool. |
| `src/fight/impact-fx.ts` | 62 | Additive flash sprite and a thin ring, 6 slots each, from hit-stop rows. It is the opposite of Dom's ruling for specials (glow); leave for non-specials, never use for these moves. |
| `src/fight/fx-math.ts` | 11 | `hash`, `smooth`, `noise`. WoC's index-hash approach matches ours. |
| `src/fight/warm-gate.ts` + `scene.ts` `userData.warmHidden` + `warmOwn` | n/a | The existing way to compile a hidden effect's program before the fight. New shader pieces plug in here. |
| `src/fight/governor-budgets.json` | n/a | Phone budget 174 draws / 504k tris (p90 139, p99 161 draws). Headroom is about 13 draws at p99. |

## 3. File by file

Difficulty: **A** lift almost verbatim (pure math/data, or pure Three geometry). **B** port the algorithm, rewrite the glue. **C** rewrite from scratch using the file as reference. **X** do not port.

### 3.1 Pure choreography and data (the brain)

| File | Lines | What it does | WoC types it needs | Diff | Verdict |
|---|---|---|---|---|---|
| `melee_impact_core.ts` | 128 | Per-ability contact grammar: height on the victim (fraction of body), style (`edge split crush pierce cross reap serrated`), angle, span, width, force, number of contacts, bleeding flag. `meleeContactPoint` gives an open path on the contact plane per style (split = long jagged slit, crush = radial cracks, pierce = small starburst going in depth, serrated = saw line, reap = arc). `isBleedContinuation` stops DoT ticks replaying a weapon action. | None. Pure. | A | Port first. Convert the `MELEE_IMPACTS` literal to a data row file (our standing rule: no tuning numbers in code). Map WoC's names to ours (`skull_crack` = split, high; `ground_slam` = crush; `lunge` = pierce; `reaping_sweep` = reap). |
| `ability_vfx/physical_choreography_core.ts` | 171 | `PhysicalChoreography` row (shape, reach, width, lift, tilt, beats, weight, material, weapon hand). `physicalPathPoint` draws the open tapered 3D path for 21 shapes (`cut reap plunge thrust rise shield fault spin ...`). `physicalBeatTime` squeezes beats into the shortest GCD. `physicalContactSheet` maps shape to cut/crush/pierce contact. | None. Pure. | A | Port with 8 shapes only: `cut reap plunge thrust spin fault shield rise`. Drop `breath inward restore quiet claw jaw scatter venom dart retreat jab parry` (buff/beast shapes). The row list at the bottom of `warrior_vfx_specs.ts` (145 lines, 55 rows) is the template for our `special-fx-physical-rows.json`; we take the numbers for `slam`, `mortal_strike`, `execute`, `whirlwind`, `bladestorm`, `heroic_leap`, `faultline`, `shield_slam`, `red_harvest`, `breachmaker` as starting values and retune by eye. |
| `ability_vfx/steel_sweep.ts` | 28 | `steelSweepGain(u, age)`: brightness envelope with a fast leading edge and a trailing wake along a ribbon, so a trail reads as a moving blade, not a static smear. | None. | A | Port the idea as alpha (not brightness gain): leading edge opaque, wake fades. 1 hour inside the stroke pool. |
| `ability_vfx/warrior_fragment_shape.ts` | 20 | Four mineral families (flake, dense core, thin sliver, broken wedge): scale triples, tint, lift. | None. | A | Port verbatim as data. |
| `ability_vfx/warrior_impact_material.ts` | 29 | Metal ejecta families (torn flake, long swarf, small chip) plus a shear timing curve. | None. | A | Port verbatim (the ejecta function; skip `warriorShearPhase`, it drives a flipbook we skip). |
| `ability_vfx/warrior_gyre_shape.ts` | 64 | `warriorGyrePoint`: two opposed widening blade wakes (radius 1.6 to 8 yd, height rising), plus a 52-column sculpted two-sided blade-wake mesh builder. | Three geometry only. | A | Port `warriorGyrePoint` (the path) for Whirlwind. The mesh builder is for the crest shader; skip, use the stroke pool instead. |
| `ability_vfx/warrior_leap_shape.ts` | 109 | Procedural geometry: five unequal fault clusters, each four closed bevelled stone slabs (about 20 slabs, 3 rings each), UV.x carries a per-slab phase. No texture needed. | Three `BufferGeometry` only. | A | Port verbatim. This is the "ground cracks into raised slabs" look and it is solid rock, not a sprite. |
| `ability_vfx/warrior_shield_shape.ts` | 54 | Six bevelled steel plates framing a buckler-sized contact window. | Three geometry only. | A | Port as the shield-bash contact sculpture. Optional; second wave. |

### 3.2 Per-move draw logic (call a host interface; mostly translatable)

| File | Lines | What it does | Host calls it makes | Diff | Verdict |
|---|---|---|---|---|---|
| `physical_choreography.ts` | 497 | The orchestrator: release (weapon trail on hand 0/1), per-beat path ribbons in 3 strands (core + two flanks), contact, stone/metal fragments, dust, camera shake, ground forks for `fault`. `physicalTravel` follows a charge. | `anchorOf, groundYAt, pathRibbon, bakedAt, fragmentsAt, decalXZ, burstAt, flipbookAt, contact, glowPulse, pulseLight, shakeAt, weaponTrail, abilityAudio, presentationMoment, countPrimitive` (everything) | B | Do not port the file. Read it as the recipe; our version is about 150 lines of data-driven code in a new `src/fight/special-fx-physical.ts` that calls our own six host functions (section 5). Keep: three strands (bright core 3.4x width, two flank strands 0.65x), the recovery sweep that does not re-hit, the fault branch scatter (3 branches at 2.1 rad spacing, radius 0.45 + 0.7 per beat), plunge dust + 5 chips. |
| `ability_vfx/physical_contact.ts` | 84 | Contact nucleus: a flipbook flash plus 3 to 4 `pathRibbon` strands drawn by `meleeContactPoint`, plus a blood burst if `bleeding`. | `flipbookAt, pathRibbon, burstAt` | B | Port the strands loop. Replace the flipbook flash with nothing (or a 3-frame dark compression mark, see 3.4). Blood goes through our `gore.ts`, not WoC `burstAt('blood')`. |
| `ability_vfx/warrior_gyre.ts` | 66 | Whirlwind: two opposed blade-wake ribbons (0.22 wide, 0.08 s), a crest, two side dust clouds at 3.6 yd, 12 metal splinters per side. | `pathRibbon, crestAt, bakedAt, fragmentsAt` | B | Port the two ribbons + side dust + splinters. Skip `crestAt`. |
| `ability_vfx/warrior_leap.ts` | 127 | Launch: grit + 5 chips per foot. Landing: crack decal sized to the AoE, `leap_rupture` crest (the slabs), 8 jagged ground ribbons at 45 deg spacing (r 1.45 to 5.95 yd scaled by radius/6), 4 dust clouds + chips, a crush flash, shake 0.24 with `crunch`. | `decalXZ, crestAt, pathRibbon, bakedAt, fragmentsAt, flipbookAt, shakeAt` | B | Port the launch, the 8 jagged ground strokes and the chip placement. Slabs from `warriorLeapShape`. Crack decal as in 3.4. |
| `ability_vfx/warrior_ground_receiving_contact.ts` | 113 | Thunder Clap / Faultline contact on the victim: dust, crush flash, a 2-metre dark "compression" line with a buckled profile, 8 stone chips, `contact`. | `bakedAt, flipbookAt, pathRibbon, fragmentsAt, contact` | B | Port the buckled compression line (it is a good dark-on-body mark). |
| `ability_vfx/warrior_crush_contact.ts` | 85 | Crush on the receiving body: 3 creases x 2 layers (dark 0x334650 wide, light thin), each re-anchored to the victim every frame so the mark rides with the body, at heights -0.26 / 0 / +0.22. | `flipbookAt, pathRibbon, anchorOf, facingAt` | B | Port the crease geometry (it is the best "dent" read in the repo). In normal blending the dark layer is the visible one. |
| `ability_vfx/warrior_impact_fan.ts` | 49 | Two unequal material exit strips around the receiving body (not a ring). | `pathRibbon` | A/B | Port; 20 lines of path math. |
| `ability_vfx/warrior_shield.ts` | 205 | Shield Slam: samples the real buckler face (position + normal) from the equipped mesh, draws the 3-segment contact silhouette, a bowed transfer ribbon from shield to victim, crush contact, fan, 13 metal splinters split into shoulders, and a puff of dust at the caster's boots. | `weaponFace, crestAt, pathRibbon, bakedAt, fragmentsAt, burstAt, contact, shakeAt, pulseLight` | B | Port with the sampler (3.3). Depends on our shield mesh exposing a face. If it does not, use the near-body fallback WoC itself has. |
| `ability_vfx/warrior_widening_arc.ts` | 132 | Wide blade flourish arc (radius 3.6 to 4.5 yd, 3.7 rad sweep, two strips) and the echo contact for follow-on strikes. | `crestAt, pathRibbon, flipbookAt, bakedAt` | B | Port the arc only if a "primed follow-on" move appears; not in the first four specials. |
| `ability_vfx/warrior_hammer.ts` | 133 | Thrown hammer (Storm Bolt): trail, contact with a blue (0x8ed7ef) flash, 14 splinters, shake 0.32. Blue-ice colouring. | `ribbons.spawnTrailStyled, bakedAt, fragmentsAt, shakeAt, pulseLight` | X for now | Different move (a thrown projectile) and the colouring is spell-like. Revisit only for a throwing weapon. |
| `ability_vfx/warrior_hammer_painter.ts` | 164 | Canvas-draws a rotating hammer sprite atlas (8 cells). | Canvas 2D | X | It paints a sprite of a hammer, we have a real mesh. |

### 3.3 Engine pieces

| File | Lines | What it does | WoC-specific dependencies | Diff | Verdict |
|---|---|---|---|---|---|
| `ability_vfx/solid_impact_fragments.ts` | 263 | **The keeper.** Three instanced batches (`ice_shard stone_chip metal_splinter`), 32 slots each, one draw each. Vertex shader does gravity (12 m/s^2), one damped bounce at a floor height, per-instance tumble, shrink-out; life and spawn in instanced attributes; `addUpdateRange` uploads only the slot written. Lit by the scene key light (fragment shader uses `uSun`). No texture. Spawn is deterministic (a serial counter and the golden-angle phase), no `Math.random`. Cap 14 per burst, speed clamp 0.3 to 1.6. | `CastVfxSpawnGate`, `tagCastVfxKit`, `GuardPrewarm` (a staged compile/touch/upload protocol), `sceneKeyLightUniform`, `fragmentGeometry()` loading `/models/vfx/production_fragments.glb` | B | Port the vertex shader, attribute layout and `burst()` almost verbatim (the shader lines were truncated in my read; take the file whole). Replace the glue: no spawn gate, no `GuardPrewarm`, no GLB. Build the three shard geometries procedurally (a squashed icosahedron for stone, a thin tetrahedron-wedge for metal, plus one for bone) so nothing is loaded. Compile at boot through the existing `warmHidden` path. Light it from our sun direction uniform. |
| `ability_vfx/ribbons.ts` | 1701 | One dynamic mesh for every strip: bolts, comet trails, styled slashes, generic `spawnPath`. `add()` (about 60 lines) builds a camera-facing tapered strip (cross of tangent with the view vector, `pinch = 4u(1-u) + (1-taper)`), per-vertex colour and UV. Slot pools: 20 arc slots x 12 pts, `spawnTrackedPath` follows a per-frame sampler (a weapon tip). | Additive `ShaderMaterial` with scrolling fBm flow and a "filament" highlight; cast-gate tags; steel-sweep gain; `Math.random` in bolt jitter and fork timers | C | Do **not** port the file. Port only `add()`'s strip maths, the slot-pool idea and the tracked-path sampler into a new `src/fight/stroke-pool.ts` (about 250 lines), with a **normal-blended** material (a painted sheet from `special-fx-quake.ts` `paintSheet`, dark core and pale rim, alpha only). Index-hash instead of `Math.random`. |
| `weapon_trail_anchor.ts` + `ability_vfx/weapon_face_sampler.ts` | 108 + 23 | Resolves the real worn weapon mesh once per cast, retains its local tip, and each frame transforms it by the animated hand matrix; `frame()` returns the weapon's face basis and centre (for a shield or flat blade). No allocation in the frame. | Looks for `userData.heldPropHolder`, `weaponMesh`, `meleeGestureBlade` set by their character loader | B | The idea is exactly what `characters.ts` already half does (`blade.localToWorld` over the contact segment). Extract our sampler into a retained `(out, normal) => boolean` closure; give it two points (base and tip) so a ribbon can be a swept quad, not a line. |
| `ability_vfx/decals.ts` | 320 | 12-slot pool of ground discs draped over terrain (own `aDrape` attribute), shared material, dissolve shader. Defaults to **additive** with a bright dissolve edge; the `leap_fracture` style uses a second material with **normal** blending and plain alpha. | Drape helpers (`drape_lod_core`, `draped_bounds_core`, `floor_vfx_layer`), the `crack` canvas texture | C | Rewrite as a small normal-blended decal pool on a flat sand floor (no drape needed in the pit; the zone floor is the one place to check). Use only the stone-material path. Port `crackTexture()` from `fx_textures.ts` (about 40 lines, procedural canvas, near-white so tint applies) but darken it: a dark crack with a pale lip, not a bright one. |
| `ability_vfx/rings.ts` | 273 | 16-slot draped expanding shockwave rings, additive, `shockwave` texture. | Drape, additive | X | Our `special-fx-quake.ts` ring ripple already does this in sand strokes. Do not port. |
| `ability_vfx/painter.ts` shake path + `fx.ts` `shakeAt` + `camera_impact_core.ts` | 2393 (shake about 20) + 20 + 120 | `shakeAt`: distance falloff (full inside 18 m, zero at 50 m), a **rolling budget** of 0.55 trauma that decays at 0.8 per second, so spam cannot stack. `CameraImpact`: two channels. Trauma (squared, two incommensurate sines at 43 and 57 rad/s, decays 1.8/s, cap 0.65) and a **crunch** (a 45 ms shove along the hit direction, then a damped negative echo over 125 ms, max 0.18 m). Camera pose is offset before the draw and removed after, so nothing persistent reads a shaken camera. | Renderer callback plumbing | B | Port the crunch curve (shove then echo) and the rolling budget as two extra fields on our `Shove` and a 15-line budget in `camera-kick.ts`; the draw-time offset-then-restore idiom is already ours in spirit. Cap shake at the existing "never constant" rule. The Pit camera is a follow rig, so apply the crunch along the blow vector in camera space, not the sine shake, for specials. |
| `characters/visual.ts` `holdFrame` and spin | 4175 total (hold about 15, spin about 20) | `holdFrame(scale, dur)`: slows ONE rig's animation clock (scale 0.18, up to 0.045 s per contact in `impact_contact.ts`; hard cap 0.16 s) with merge rules (longest dur, slowest scale) and a 0.25 s refractory so a flurry cannot chain into slow motion. Spin: `poseWrap.rotation.y` advanced at 18 rad/s for 0.55 s (`spinOnceTimer`). | WoC's mixer/pose wrapper | A (hold rules), C (spin) | Hit-stop: **do not port the mechanism** (ours pauses the picture globally, sim intact, and is better for replays). Port the two rules: merge-on-overlap (longest, slowest) and the 0.25 s refractory, into `hit-stop-rows.ts` for specials. Spin: **rewrite**. 18 rad/s x 0.55 s = 9.9 rad (1.58 turns), and the angle resets to 0 at the end, so WoC's whirlwind visibly snaps by about 3.6 rad. Ours must ease an exact 2 pi (or the sim facing) over the move and land on the facing, on a presentation-only wrapper group above the rig root. |

### 3.4 Everything that should not come across

| File | Lines | Why not |
|---|---|---|
| `ability_vfx/fx.ts` | 3113 | The WoC host: owns every pool, audio queues, gate, prewarm, screen distortion. Specific to their renderer. We write a ~150-line host of our own (section 5). |
| `ability_vfx/painter.ts` | 2393 | Event claiming by ability id, spam budget, 117-file spec registry. Our events are `CombatEvent` and our rows are JSON. |
| `ability_vfx/sequencer.ts` | 2288 | Slot sequencer for the whole spell archetype system, defines `SequencerHost`. Keep only the interface as our checklist of what the host must offer. |
| `signature_crests.ts` + `signature_shapes.ts` + `crest_prewarm.ts` + `warrior_ground_material.ts` | 585 + 67 + 146 + 26 | One giant shader keyed by an integer `uKind` (0 to 23) with tint+accent highlights (`colour += uAccent*fresh*pressure*.35`). Coupled to the gate and prewarm machinery. We take only the raw geometry (leap slabs, shield plates, gyre wake) and draw it with a `MeshStandardMaterial`. For the leap slabs' staggered rise (UV.x phase) use a tiny `onBeforeCompile` patch on that one material (about 12 lines of GLSL: `p.y -= (1 - rise) * 1.8` where `rise = smoothstep(0, .105, uAge - uv.x*.18)`). Compile at boot. |
| `ability_vfx/flipbooks.ts`, `contact_assets.ts`, `baked_impact_layers.ts`, `fx_textures.ts` (flipbook parts), `production_assets.ts` | 355 + 50 + 363 + 745 + 140 | Sprite-sheet systems (contact cut/crush/pierce flashes, smoke and shout-dust volumes, shockwave). They are the glow and flash layer (section 4). Large KTX2/WebP assets. Skip. |
| `vfx.ts` | 2822 | The pooled particle cloud. `burst()` uses `Math.random`, picks star/sparkle/flame sprites and multiplies colour by an HDR gain. Wrong style and non-deterministic. |
| `blood_film_material.ts`, `bloodletting_*.ts`, `warrior_blades.ts`, `harvest_*`, `fury_*` | 30 + 145 + 53 + 245 + others | Blood is a shader film inside the crest/harvest system. Our `gore.ts` already does splat, blade blood and wound sites with a deterministic LCG. Take the contact height and bleeding flag only. |
| `warrior_mobility.ts`, `physical_choreography.ts` `physicalTravel` | 181 | Charge/rush wake. Different move class (we have `charge-fx.ts`, 119 lines). |
| `*_prewarm.ts`, `cast_vfx_family.ts`, `cast_admission_core.ts`, spectacle, audio | many | WoC's compile/admission machinery and sound routing. Our `warm-gate.ts`, `warmHidden` and sound lane already do this. |

## 4. Honest list: what in WoC is glow or sprite and must NOT be copied

Read from the code, not from screenshots (I cannot run the donor's renderer here).

1. **Every ribbon is additive.** `ribbons.ts` material: `blending: THREE.AdditiveBlending`, colour multiplied by a scrolling noise "flow" and, in the warrior branch, a `pow(1 - crossSection, 10)` filament highlight, with the core lerped 28 to 50 % toward white. This is an energy-beam shader. The "physical" slashes use the same pool. The path maths is good; the material is the glow.
2. **Contact flashes are HDR sprite sheets.** `physical_contact.ts`, `warrior_crush_contact.ts`, `warrior_ground_receiving_contact.ts` all call `flipbookAt(... 'warrior_crush_flash' | 'contact_cut' | ..., hdr 1.35 to 6.2)`. HDR gain 4.5 to 6.2 is bloom food. `FlipbookStyle` sheets use `CustomBlending`.
3. **Shock rings and most decals are additive** (`rings.ts`; `decals.ts` default material; the `ember rime rune char` styles).
4. **`pulseLight` and `worldLightAt` add dynamic point lights**, and `glowPulse` pulses a body-glow envelope on the struck character. In three.js a new light changes the light count and recompiles every lit material mid-fight. This violates our "no light, no recompile" rule and Dom's no-flash ruling.
5. **`vfx.ts` burst** chooses `star / sparkle / sparkBurst / flame / firePuff` sprites with `hdr(1.6)` colour; `'blood'` is the generic `debris` sprite, additive, and every spawn uses `Math.random`.
6. **`screenFxAt`** (distortion ripple plus screen flash) is a post-pass.
7. **Crest shader highlights** (`uAccent * pressure * .35`) and the Storm Bolt hammer's blue `0x8ed7ef` palette read as spell effects.
8. **The big baked sheets** (`warrior_power`, `warrior_fervor`, `harvest_impact`, `warrior_bite`, `warrior_shear`, `shockwave`) are painted energy sprites. `smoke` and `shout_dust` are volumes that could be dust but are 160 KB webp sheets keyed to their pipeline; our `foot-dust` plus the quake plume already do dust without them.

What is genuinely physical in WoC, and is what we take: the shard instancing (`solid_impact_fragments`), the leap slab geometry, the dark crush creases and buckled compression line (visible only if you do not blend additively), the contact-plane grammar (`melee_impact_core`), the three-strand tapered trail geometry, the shake budget, the crunch-and-echo, the hold-frame merge/refractory rules, the spawn determinism.

## 5. The adapter we write (our host interface)

New file `src/fight/special-fx-host.ts`, about 150 lines, presentation only, reads `CombatEvent`s and rig anchors, never the sim, never `Math.random`. It replaces WoC's 40-method `SequencerHost` with the eight things the ported pieces actually call:

```ts
// Types only; bodies are the work.
export interface SpecialFxHost {
  anchor(side: 0 | 1, height01: number, out: V3): V3 | null;      // body point: feet, torso, head by fraction of height
  facing(side: 0 | 1): number;                                     // yaw in radians, from the sim body heading
  groundY(x: number, z: number): number;                           // the pit floor; flat 0 in the sandbox
  weapon(side: 0 | 1): { tip(out: V3): boolean; base(out: V3): boolean; face(out: V3, n: V3): boolean } | null;  // retained per move
  stroke(spec: StrokeSpec, fill: (pts: V3[]) => number): boolean;  // stroke-pool.ts: normal blended, tapered, aging
  fragments(kind: 'stone' | 'metal' | 'bone', at: V3, tint: number, count: number, power: number, dir: V2, life?: number): void;
  crack(x: number, z: number, radius: number, tint: number, life: number): void;   // dark normal-blended decal
  shake(at: V3, amount: number, crunch?: boolean): void;           // camera-kick.ts budget
  contact(target: 0 | 1, material: 'steel' | 'stone' | 'flesh', weight: number): void;   // calls gore.ts, foot-dust.ts, hit-stop row
}
```

The remaining calls in WoC (`flipbookAt`, `bakedAt`, `ringAt`, `pulseLight`, `glowPulse`, `crestAt`, `burstAt`, `abilityAudio`, `presentationMoment`, `countPrimitive`) map to: nothing (flash, glow, light, crest), `foot-dust.ts` (dust), `special-fx-quake.ts` strokes (ring), our sound lane (audio), nothing (counters). Rows live in `special-fx-physical-rows.json` with a manifest (`reach, width, lift, tilt, weight, beats, material, weapon hand, contact height, contact style, shake, hold frames`), validated like our other defs; `npm run check:as-data -- --gate` is the gate.

## 6. Ranked port list with order and effort

Order is by "what makes Ground Slam and Skull Crack look right soonest" while keeping each step shippable as a preview clip. Hours include the preview clip and tests, with fail-first tests for the pure parts.

| # | Piece | From | To | Rewrite vs copy | Hours | Depends on |
|---|---|---|---|---|---|---|
| 1 | Contact grammar + choreography maths | `melee_impact_core.ts`, `physical_choreography_core.ts`, `warrior_vfx_specs.ts` numbers, `steel_sweep.ts` idea | `special-fx-physical.ts` + rows JSON | Copy maths, new rows (data) | 8 | none |
| 2 | Solid shards (stone, metal, bone) | `solid_impact_fragments.ts`, `warrior_fragment_shape.ts`, `warrior_impact_material.ts` | `special-fx-shards.ts` | Copy shader and attributes, rewrite glue, procedural geometry (no GLB) | 12 | #1 for calls; boot compile via `warmHidden` |
| 3 | Camera crunch and shake budget | `camera_impact_core.ts` crunch, `fx.ts` `shakeAt` budget | `camera-kick.ts` (+ rows) | Port curve and budget, keep our Shove | 4 | none (parallel) |
| 4 | Hit-stop merge and refractory rules for specials | `visual.ts` `holdFrame`, `impact_contact.ts` | `hit-stop-rows.ts` / `main.ts` presentation pause | Port two rules only | 2 | none (parallel) |
| 5 | Stroke pool (trail and contact strokes) + weapon sampler | `ribbons.ts` `add()`, `spawnTrackedPath`; `weapon_trail_anchor.ts` | `stroke-pool.ts` + a retained sampler in `characters.ts` | Port strip maths; new normal-blended painted material; index hash | 16 | #1 |
| 6 | Ground crack + slabs (Ground Slam, Leap) | `warrior_leap_shape.ts`, `warrior_leap.ts` landing, `crackTexture()`, `decals.ts` stone path | `special-fx-ground.ts` | Copy geometry, rewrite material and decal pool | 12 | #2 (chips), #5 (ground strokes) |
| 7 | Body contact marks (crush creases, buckled line, fan) | `warrior_crush_contact.ts`, `warrior_ground_receiving_contact.ts`, `warrior_impact_fan.ts`, `physical_contact.ts` strands | `special-fx-contact.ts` | Port the path maths; blood via `gore.ts` | 8 | #5 |
| 8 | Whirlwind (spin rewrite + wake) | `warrior_gyre_shape.ts` path, `warrior_gyre.ts`, `visual.ts` spin idea | `special-fx-whirl.ts` + presentation wrapper group | Port wake path; rewrite spin as an exact eased 2 pi | 10 | #5, #2 |
| 9 | Shield Slam contact sculpture | `warrior_shield_shape.ts`, `warrior_shield.ts` | `special-fx-shield.ts` | Port with the face sampler; optional | 8 | #5, #7 |

Total about 80 hours; #1 to #3 plus the first third of #5 is the Ground Slam preview (about 25 to 30 hours). The build order in `special-moves-design.md` (hit-stop and camera first, then Skull Crack, then Whirlwind) fits: #3 and #4 are step 1, #1, #5 (trail only), #7 are Skull Crack, #8 is Whirlwind, #2 and #6 are the Ground Slam that comes after Dom's word.

## 7. Assets

Everything ships procedural. Nothing is loaded, nothing is copied.

| WoC asset | Size | Do we take it | Instead |
|---|---|---|---|
| `models/vfx/production_fragments.glb` (3 shards) | 15 KB | No | Three procedural shard geometries in code (about 25 lines): squashed icosphere, thin wedge, tetra-chip. |
| `textures/vfx/production/*.webp` (smoke, shout_dust, power, fervor, harvest, bite, shear, shockwave, blood_blade, forged_steel, pressure) | about 3.1 MB total | No | Not needed. |
| `textures/vfx/production/warrior_crush.ktx2` | 448 KB | No | Not needed. |
| `textures/vfx/contact/{cut,crush,pierce}.ktx2` | 940 KB | No | Not needed. |
| `textures/terrain/Rock051_Color.jpg` | 1.5 MB | No | Slabs use our sand/clay tint (`quakeLook`) on a lit material. |
| Canvas-painted textures in `fx_textures.ts` (ribbon, noise, crack) | generated at runtime | Crack only | `crackTexture()` ported, 128 px, procedural. Stroke sheet from our own `paintSheet`. |

This also keeps our existing notice true: "No art, sound, name or other asset is taken from that project."

## 8. Phone performance budget

Context: phone tier budget 174 draws / 504k triangles, with real phone fights at p90 139 and p99 161 draws, so special effects get about 13 draws of headroom at p99 and must exist only for the ~0.5 to 1.0 s of a special.

| Item | Draws | Triangles | Live cap (phone / desktop) | Per-frame cost |
|---|---|---|---|---|
| Shards (stone, metal, bone) | 3 (only the kinds in use are visible) | 32 instances x ~12 to 20 tris x 3 kinds, about 2k | 8 per burst, 24 live / 14 per burst, 32 per kind | CPU: a few attribute writes at spawn only (`addUpdateRange`); GPU does all motion |
| Stroke pool (trail and contact strokes) | 1 | 12 slots x 12 pts x 2 = 288 verts, about 500 tris | 8 / 12 live strokes | CPU: re-fill only strokes that follow a body (trail, contact crease); uploads the written prefix |
| Slab mesh (Ground Slam, Leap) | 1 | about 20 slabs x ~40 = ~800 | 1 live | One matrix; the rise is a uniform |
| Crack decals | 1 shared material, up to 3 quads | about 6 | 2 / 3 live | Spawn-time only |
| Ring and dust | 0 new | 0 new | reuse `special-fx-quake.ts` and `foot-dust.ts` | none new |
| Weapon trail | 0 new (it is the stroke pool) | included | 2 hands max | one sampler call per frame |
| **Total new** | **6 draws, about 3.5k tris** | | | zero per-frame allocation |

Rules carried over from WoC and ours: no per-frame allocation (scratch vectors, retained closures, preallocated slots); new `ShaderMaterial`s are built at module init and compiled through the `warmHidden` path (`warmOwn` in `scene.ts`), never on the first special; no new lights; no `Math.random` (index hash like `fx-math.ts`); reduced-motion zeroes shake and shard motion (WoC passes `uMotion = 0` to its shader; take that), but hit-stop and the camera kick stay on per the owner's "always on" ruling; if the governor pulls a lever, the specials drop shards to 4 per burst and strands to 1 (WoC's `tier > 0` path: 1 strand, no splinter garnish, half particles).

Two checks before sign-off: render a 375-wide clip and read `renderer.info.render.calls` at the peak frame of each special; and confirm the shard shader's per-fragment cost on the phone ladder (it is lit, so it needs one directional term only).

## 9. Licence and credit (exact text)

WoC is MIT, Copyright (c) 2026 Levy Street. The condition is that "the above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software." Two obligations:

1. **Keep the full MIT text shipped.** We already ship it at `public/licenses/world-of-claudecraft.txt`, linked from the credits page and asserted by `tests/credits.test.ts`. The first port PR must add the new file rows to that notice's list (it names the files adapted) and keep the licence text byte-identical:

```
  src/fight/special-fx-shards.ts      adapted from src/render/ability_vfx/solid_impact_fragments.ts
  src/fight/special-fx-physical.ts    adapted from src/render/melee_impact_core.ts, src/render/ability_vfx/physical_choreography_core.ts
  src/fight/stroke-pool.ts            strip geometry adapted from src/render/ability_vfx/ribbons.ts
  src/fight/special-fx-ground.ts      geometry adapted from src/render/ability_vfx/warrior_leap_shape.ts
  src/fight/camera-kick.ts            crunch curve and shake budget adapted from src/render/camera_impact_core.ts, src/render/ability_vfx/fx.ts
```
   (and keep its preamble: "No art, sound, name or other asset is taken from that project." True under the plan above.)

2. **A header on every ported file** (the "substantial portions" are the ported files themselves, so each carries the notice):

```ts
// Portions adapted from levy-street/world-of-claudecraft (f46f30f), src/render/ability_vfx/solid_impact_fragments.ts,
// Copyright (c) 2026 Levy Street, used under the MIT licence (full text: public/licenses/world-of-claudecraft.txt).
// Changed: <one line: e.g. procedural shard geometry, no spawn gate, scene sun light, rows from special-fx-physical-rows.json>.
```

PR body line (our rule): `Donor: World of Claudecraft (MIT), took: <piece>; rewrote: <piece>; skipped: sprites/additive/glow.` A ported file that is rewritten so far that no donor expression remains drops the header and is credited as "idea ported from" in the notice list instead (the form already used for `first-loss.ts`).

## 10. Risks and decisions for Lead

1. **Determinism.** WoC `ribbons.ts` and `vfx.ts` use `Math.random`; `solid_impact_fragments.ts` does not. Our rule is the index hash. Every ported call site gets the hash, and a test replays a recorded fight and asserts the identical shard buffer.
2. **Normal blending on a dark pit.** WoC's colours (0x334650 creases, 0x8e8271 stone, 0xe3edf2 edges) were chosen for additive over a lit world. In our Night Pit the quake already needed a "darker than the shadowed clay" fix (see `quakeLook`). Expect one retune pass per look; keep colours as rows.
3. **Weapon-face sampling** needs our shield and weapon meshes to expose a face and a long axis. The contact segments in `characters.ts` already carry the long axis for weapons; shields may need a node name. Check before committing to #9.
4. **Whirlwind spin** is presentation only; it must not rotate the sim body or change hit geometry. A wrapper group above the rig root, restored to sim facing on the last frame.
5. **What I did not verify:** I did not run WoC's renderer, so the "looks like glow" calls above come from the blend modes, HDR gains and shaders in the source, not from watching it. I did not read the truncated tail of the `solid_impact_fragments.ts` fragment shader line (the lighting term); read it whole before porting. Effort numbers are my estimates and exclude Dom's tuning rounds.
