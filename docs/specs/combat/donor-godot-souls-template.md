# Donor study: Cat's Godot 4 Modular Souls-like Template

**Licence: public domain (Unlicense, "free and unencumbered software", LICENSE file at repo root, (c) 2024 Cat Prisbrey). Code may be ported verbatim or rewritten; attribution is not required. README adds that the art is CC0.** Donor line for PR bodies: "Donor: catprisbrey Souls-like template, what we took".

Source: `/mnt/frankendom-donors/catprisbrey-Cats-Godot4-Modular-Souls-like-Template` on the VPS (read-only study, 2026-10-17). README says v2.0.0 and that a v3 rewrite is pending; we studied v2.

## 0. Read this first: what the template is and is not

It is a small, signal-driven template (about 2,150 lines of GDScript in 28 files). It is **animation-tree driven**: the AnimationTree, not code, decides combos, and clip length is the clock for every window. Honest gap list against Dom's wish list:

| Dom wants | In the template? |
| --- | --- |
| Weapon trails | YES, `utility scripts/mesh_streak.gd` (worth porting) |
| Hitbox timed to the swing | YES but crude: fractions of clip length |
| Lock-on | YES (three sensor boxes + line-of-sight ray) |
| Parry window, guard, roll | YES, crude (timer based) |
| Stamina | NO (grep for stamina finds nothing) |
| Poise / stagger meter | NO (stagger is just a hurt clip plus a 0.4 s lockout) |
| Input buffering / cancel windows | NO (inputs are dropped while `busy`) |
| Hit-stop | NO |
| Camera shake / hit kick | NO (only a guard zoom spring) |
| Special moves / weapon arts | NO (only `use_gadget`, an off-hand swing, and `SprintAttack` / `JumpAttack` clips picked by state) |
| Per-weapon damage / hitbox data | Only `power`, `weight`, `value` ints and `object_type` |
| Enemy attack choice | A dice roll (70% attack, 30% retreat) every 2 s |

So the value to us is mostly **(a) the trail ribbon, (b) the data shape that lets one state machine serve many weapon types, (c) lock-on target selection, (d) a handful of cheap feel tricks**. Everything the template lacks, we already have or must design ourselves; sections below say so.

## 1. Combat state machine and attack selection

Files: `player/player_charbody3D.gd` (flags and signals), `player/player_anim_tree.gd` (class `AnimationTreeSoulsBase`), `player/player_charbody3d.tscn` (the tree itself, about lines 480-730), `player/animation_libraries/MeleeLib.res` (2.2 MB, 110+ clips named `MeleeLib/root-Slash1` etc; the `root-` prefix means the clip carries root motion).

How it works:
- Two layers. `current_state` enum `{FREE, STATIC, CLIMB}` is coarse. Fine state is a set of bool sub-states: `busy`, `guarding`, `sprinting`, `dodging`, `slowed`, `strafing`.
- `_input()` maps `use_weapon_light` to `attack()` and `use_weapon_strong` to `attack_strong()`. Strong sets `secondary_action = true` for one frame so the tree sees it.
- `trigger_event(signal_name)` is the whole action pipeline: refuse if `busy or dodging`; set `busy = true`; emit the signal; `await animation_tree.animation_measured` (the tree reports the clip length when a clip starts); wait that long; clear `busy`. **The clip length is the lock.** There is no early-out, so there are no cancel windows and no buffering. A press during `busy` is simply lost.
- The tree (`player_anim_tree.gd::_on_attack_started`) fires the `Attack` one-shot. Inside it, a nested state machine per weapon type (`SLASH`, `HEAVY`) chains clips with `advance_expression` on a counter: `attack_count == 1` -> `Slash1`, `== 2` -> `Slash2`, `== 3` -> `Slash3`; HEAVY has `Heavy1`, `Heavy2`, `HeavyUppercut`. Transition crossfade (`xfade_time`) is 0.2 s between swings, 0.3 s on exit.
- Combo counter: `attack_count` increments per attack and wraps at `max_attack_count` (script default 2). A one-shot `attack_timer` set to `anim_length + 0.2` resets it to 1. So the **combo window is "press again after the swing ends, within 0.2 s"**; waiting longer restarts the chain.
- Context variants are plain expressions: `!player_node.is_on_floor()` -> `LightJumpAttack` / `HeavyJumpAttack`; `player_node.sprinting` -> `SprintAttack`; `player_node.secondary_action` inside the SLASH machine -> `HeavyUppercut`/strong branch.
- Per-weapon selection: weapon `object_type` ("SLASH", "HEAVY", "SHIELD", "OTHER") picks the movement/attack sub-tree by name. `_on_weapon_change_ended` checks `tree_root.get_node("MovementStates").has_node(type + "_tree")` and **falls back to the SLASH tree if that weapon has no tree**. That fallback is the useful idea: unknown weapon -> default move set.

Key numbers: lock = clip length minus 0.05 s; combo reset = clip + 0.2 s; xfade 0.2 s; combo length 2 (script) with three slash clips authored; hurt random of 2 clips; guard blend lerp 0.2 per frame.

Data row version (ours: weapon art set keyed by weapon family, with fallback):
```json
{ "id": "combo.slash", "family": "slash", "fallback": null,
  "chain": [ {"clip":"slash1","next_window":[0.55,0.95]}, {"clip":"slash2","next_window":[0.55,0.95]}, {"clip":"slash3","next_window":null} ],
  "reset_after_s": 0.2,
  "variants": { "airborne":"jump_attack_light", "sprinting":"sprint_attack", "strong":"uppercut" } }
```
We already have per-weapon clips, a combo window (`gothic-combo-window.md`) and buffering of some form; the new bit is the `variants` map (context -> clip) and `fallback` family. Do not copy the "press is lost while busy" behaviour.

## 2. Hit detection, damage, stagger

Files: `player/equipment_system/equipment_system.gd` (class `EquipmentSystem`), `equipment/equipment_object.gd` (an `Area3D`), `equipment/equipment_resource.gd`, `enemy/health_system.gd`, `enemy/enemy_base_root_motion.gd::hit`, `player_charbody3D.gd::hit`.

- The weapon is an `Area3D` (sword hitbox `BoxShape3D` 0.4 x 0.75 x 0.4 m). It has `monitoring = false` by default.
- `EquipmentSystem._on_activated()` runs on the player's `attack_started` signal: wait `anim_length * 0.3` (windup), set `monitoring = true`, wait `anim_length * 0.5` (active), set `monitoring = false`. So **active window = 30% to 80% of the clip**, for every weapon, hard-coded. `deactivate_signal` (`hurt_started`) force-clears monitoring (that is the interrupt-cancels-hit rule).
- `_on_body_entered`: if the body is in group `targets` and has `hit()`, emit `hit_target` (drives SFX) and call `body.hit(player_node, equipment_info)`; otherwise emit `hit_world` (clang SFX). Note: no per-swing "already hit" set. One swing can hit the same body repeatedly on re-entry, the target's own lockout hides it.
- Damage: `HealthSystem._on_damage_signal` subtracts `_by_what.power` (int). Sword power 1, Hammer ("Ax.tscn", type HEAVY) power 2, enemies 5 hp default. Death when hp <= 0 emits `died`.
- Target side: `enemy.hit()` sets `target = attacker` (aggro on hit), and if `hurt_cool_down` (0.4 s) is stopped, starts it, emits `hurt_started` (random Hurt1/Hurt2 clip, aborts its current one-shot) and `damage_taken`. **Stagger = interrupt the current action clip + 0.4 s no-retrigger.** No poise, no stagger threshold, no knockback vector (any push comes from root motion in the hurt clip).
- Player side `hit()`: ignore if `hurt_cool_down` running; if `parry_active` -> parry and call `attacker.parried()`; elif `guarding` -> `block()` (no damage, no stamina cost); else emit `damage_taken`, `hurt()`.

Data row version: the useful change is moving the hard-coded fractions into the weapon row:
```json
{ "id": "art.slash1", "active_frames":[18,48], "hitbox":{"shape":"capsule","len":0.9,"radius":0.12},
  "power": 1, "poise_damage": 20, "once_per_swing": true, "interrupt_on":["hurt","parried"] }
```
We already have blade paths, hit-stop rows and posture, so we only need to check our active window is per-clip data (it is a row in our style) and that `once_per_swing` exists. The `interrupt_on` list is a clean way to express "getting hit cancels the active window".

## 3. Stamina, lock-on, dodge and i-frames

**Stamina: none.** (No file mentions it.) Nothing to port; our stamina is already ahead.

**Dodge / sprint** (`player_charbody3D.gd`): one button, tap vs hold. On press, `dodge_or_sprint()` starts `sprint_timer` 0.3 s; if the button is still held at 0.3 s and there is move input, `sprinting = true`. If released while the timer is still running, `dodge()` fires. This is the Dark Souls "tap = roll, hold = run" scheme. `dodge()`: clears strafe, `dodging = true`, requests the `Dodge` one-shot (clip `root-Roll`, root-motion driven, so roll distance comes from the animation), and **starts `hurt_cool_down` for `anim_length * 0.7`** — that is the i-frame window: the first 70% of the roll, from frame 0. Strafe restores after `anim_length`. Also `JumpBack` exists as a clip in the dodge state machine (back-step when not moving, by tree expressions `!player_node.input_dir`).

**Lock-on** (`player_targeting_system/player_targeting_system.gd`, `cameras/follow_cam/follow_cam_3d.gd`, `player_anim_tree.gd::set_strafe`):
- Three `Area3D` sensor boxes parented to the player: centre 2 x 10 x 14, left and right 8 x 10 x 14 (m). They keep `target_list`s of bodies in group `targets`.
- Toggle (`strafe_target` action) -> `strafe_toggled` -> targeting on -> `get_target()`: iterate centre list first, then right, then left (camera is over the right shoulder); a target is accepted only if `eyeline_check` — a ray from the player to `target + Vector3.UP` — hits that target first (no locking through walls).
- Retarget: mouse relative x > `mouse_retarget_sensitivity * 100` (default 3) or joystick axis 2 > `0.1 * sens` selects from left/right list; 0.5-0.6 s debounce (note: the `await` there does not actually gate anything, it is a latent bug).
- While locked, `FollowCam._lookat_target()` does `look_at(target + (0,1,0))` each physics frame, and the player body is slerped (rate 0.4) to face the camera yaw; movement blends a 2D strafe blend space from `strafe_cross_product` (sideways) and `move_dot_product` (forward). Target dropped when it leaves group `targets` (dies) -> `target_cleared` -> strafing off.
- Guard camera: `spring_length` lerps (0.1/frame) from default to `aim_spring_length = 0.7` while `guarding`. Cheap, nice "tighten when blocking" feel.
- Camera follow: position lerp 0.07/frame toward target + vertical offset (a soft-follow).

Data row version:
```json
{ "id": "lockon.default", "boxes":[{"name":"centre","w":2,"h":10,"d":14,"prio":0},{"name":"right","w":8,"h":10,"d":14,"prio":1},{"name":"left","w":8,"h":10,"d":14,"prio":2}],
  "los_aim_height": 1.0, "retarget_debounce_s": 0.5, "face_rate": 0.4, "follow_lerp": 0.07, "guard_zoom": {"spring_len":0.7,"rate":0.1} }
{ "id": "roll.default", "tap_hold_threshold_s": 0.3, "iframe_frac": [0.0, 0.7], "root_motion": true }
```
We already have roll and presumably an i-frame window; the new things are: tap/hold threshold on one button (roll vs sprint), the guard zoom, and sensor-box priority + LOS-checked lock-on (check ours does LOS).

## 4. Equipment system and the weapon trail

Equipment (`player/equipment_system/equipment_system.gd`):
- Two mount points: `held_mount_point` (right-hand `BoneAttachment3D` -> `HandPivot` `Marker3D`) and `stored_mount_point` (back bone). Child 0 of each is the item. `_on_equipment_changed()` waits `anim_length * 0.5` into the swap clip, then **reparents** held <-> stored, flips `equipped`, rewires the `body_entered` signal and emits `equipment_changed(new)`. The player listens and updates `weapon_type`, which then selects the animation sub-tree (section 1).
- Same class is reused for the off-hand (`GadgetSystem`: shield/torch). A scene is a weapon: mesh, `Area3D` hitbox, `EquipmentResource`, optional particles. Adding a weapon = drop a scene on the back bone.
- Swing SFX is a `SoundFXTrigger` on `attack_started` with `play_delay = 0.4`; hit SFX on `hit_target` / `hit_world`.

**Trail** (`utility scripts/mesh_streak.gd`, class `MeshStreak`; `equipment/weapon_streak.gd` is a 4-line subclass whose only function is never connected, so the live script on the node is `mesh_streak.gd` directly; see `player_charbody3d.tscn` lines 1850-1856 `WeaponStreak`, and `GadgetStreak` at 1902):
- A `MeshInstance3D` with `top_level = true` and identity transform so it lives in world space and never follows the parent. It is given an `origin_node` (the hand pivot) and two local offsets `streak_bottom` and `streak_top`.
- Every second `_process` frame while `emitting` (a `counter` toggles 0/1, so about 30 edges/s at 60 fps): `create_edge()` converts both offsets to world space (`origin_node.to_global`) and appends an `edge{top_p, bottom_p}` to `mesh_array`.
- When not emitting, each frame `remove_edge()` pops the oldest edge (`pop_front`) — so the **tail retracts at 60 edges/s while the head stops**, which is the fade-out in length. There is no max-length cap; length = how long the hitbox stayed on. (Because edges are added every second frame but removed every frame, the tail catches up twice as fast as it grew.)
- `mesh_update()` rebuilds the whole mesh every frame with `SurfaceTool` as a `PRIMITIVE_TRIANGLE_STRIP`, vertices ordered top, bottom, top, bottom...; needs more than 2 edges else mesh = null. UVs are `(0,0)` for top and `(1,0)` for bottom.
- Default material: unshaded, alpha, no culling, albedo is a 1D gradient texture: white alpha 0.3 from u = 0 to 0.6, then fading to alpha 0 at u = 1. Because u runs top to bottom of the ribbon, **the fade is across the ribbon width, not along its length**: the blade-edge side is brightest, the inner side transparent. Length fade comes only from the retract above.
- Parameters in scenes: `lifetime = 0.0` on the weapon (0 = no auto-off); `streak_bottom = (0, -0.2, 0)`, `streak_top = (0, 0.5, 0)` on the gadget (so a 0.7 m wide ribbon); weapon uses script defaults `bottom = (0,0,0)`, `top = (0,1,0)` (1 m).
- Gating: `sync_property()` copies `weapon_system.current_equipment.monitoring` into `emitting` every frame, so **trail on == hit window on**. Gadget trail uses a `SignalSwitch` (`utility scripts/signal_switch.gd`) that flips `emitting` on `gadget_started` for a `lifetime`.
- Weaknesses to fix when porting: linear segments only (angular, "faceted" on fast arcs; no Catmull-Rom subdivision), unbounded array, rebuilds the mesh each frame (allocate-heavy), single gradient across the width, no per-weapon colour or glow, trail is tied to hit window (so a windup swish or a follow-through never shows), uses `to_global` each edge (fine). Time-based fade (not frame-count) is better for a 60 Hz sim with variable render.

Data row version:
```json
{ "id": "trail.slash.steel", "weapon_family": "slash", "base_local": [0,0.15,0], "tip_local": [0,1.05,0],
  "sample_every_ticks": 1, "max_samples": 18, "life_ticks": 14, "retract_per_tick": 2,
  "gate": "active_window", "gate_pad_ticks": [-3, 6], "subdivide": 2,
  "width_fade": [[0,0.55],[0.6,0.3],[1,0]], "length_fade": "linear", "color": "#dfe9ff", "blend": "additive" }
```
We have "blade paths"; if those already give us a per-tick tip/base sample, the trail is only the ribbon builder + this row.

## 5. Special / weapon-art, hit-stop, camera, VFX, sound

- **Special / weapon art system: none.** The closest things: `use_gadget` (off-hand swing, own streak), context attacks (`SprintAttack`, jump attacks), `ShieldBash` / `SlashL1` clips, and `HeavyUppercut` on a strong press. All are just alternative clips selected by tree expressions. We keep our own design (`special-moves-design.md`); the only take is **"context -> clip" variants on the weapon row** and the **"signal switch" idea: a timed property flip** (`SignalSwitch`: flip a property on `start_signal`, restore after `lifetime`), which is how the template does temporary conditions (trail on, flame on).
- **Hit-stop: none.** Our hit-stop rows are ahead. (The nearest mechanism is `hurt_cool_down`, a no-hit timer, which is different.)
- **Camera shake: none.** Only the guard zoom and soft follow (section 3).
- **VFX hooks:** Godot signals (`hit_target`, `hit_world`, `attack_started`, `parry_started`, `block_started`, `hurt_started`, `dodge_started`...) are the whole event bus. Particles (`GPUParticles3D` torch flame) toggled by `equipped_changed`. Nothing else.
- **Sound hooks** (`audio/SoundFXSystem.gd`, class `SoundFXTrigger`): an `AudioStreamPlayer3D` bound to (node, signal name, optional `play_delay`); fires only if not already playing; the random-pitch line is commented out. Swing SFX uses `play_delay = 0.4` so the whoosh lands mid-swing. That is a **sound row = {event, clip, delay}**, which we should check against our audio rows (a per-event delay in ticks aligned to the active window start is the new bit).

## 6. Enemy AI

Files: `enemy/enemy_base_root_motion.gd`, `enemy_root_anim_tree.gd`, `enemy_area_target_sensor.gd`, `.tscn` timers.

- States `{FREE, CHASE, COMBAT, ATTACK, DEAD}` (ATTACK is declared but never entered). `evaluate_state()` each frame: if the target is the default patrol target -> FREE; else distance > `combat_range` (2 m) -> CHASE, else COMBAT.
- Perception: `AreaEnemyTargetSensor` (`Area3D`) detects bodies in group "player"; on enter it ray-casts an eyeline to the body; if the first hit is the player, emits `target_spotted`. Re-checks on `CheckInterval` timer. On `target_lost` a 3 s `ChaseTimer` runs; its timeout calls `give_up()` (wait 2 s, return to `default_target`/patrol).
- Attack choice: `CombatTimer` (2 s, autostart). On timeout, if COMBAT: `randi_range(1,10)`; `<= 3` -> `retreat()` (back away one-shot) else `attack()`. In the anim tree, `attack_count = randi_range(1, max_attack_count)` picks which of two attack clips. That is the entire decision layer: **70/30 weighted random every 2 s, no memory, no range bands, no tells, no counters**.
- Reactions: `hit()` sets target to the attacker (damage gives aggro); `parried()` aborts the current one-shot and plays a "parried" clip (the "stunned by parry" state); death -> ragdoll for 3 s then freeze pose, free after 4 s.
- Enemies use the same `EquipmentSystem` and hitbox timing as the player, so the 30%-80% active window applies to them too.

Data row version (ours should already be richer; the only borrowed idea is the weighted table with cooldown):
```json
{ "id": "ai.grunt", "think_every_s": 2.0, "combat_range": 2.0, "give_up_s": 3.0,
  "picks": [ {"act":"attack","weight":7,"clips":["slash1","slash2"],"min_range":0,"max_range":2.0}, {"act":"retreat","weight":3} ],
  "on_parried":"stun_clip", "on_hit":"aggro_attacker" }
```
Our `caster-tells-flee.md` and `threat-list.md` already cover more than this donor; take nothing structural beyond `on_parried` -> abort + stun clip if we lack it.

## What we already have vs what is new (summary)

Already have (do not port): stamina, posture, parry, guard, roll, kick, blade paths, hit-stop rows, camera kick, per-weapon clips (sword, maul, scythe, trident, warhammer), combo window.
New or worth checking: ribbon trail builder, context -> clip variants + family fallback, tap/hold single-button roll vs sprint, i-frame as a lockout timer, guard-zoom camera, three-box lock-on with LOS and left/right retarget, per-event sound delay, per-swing "already hit" set, `interrupt_on` list for active windows, `on_parried` stun, timed property switches.

## Ranked: 8 most valuable things to port

1. **Weapon trail ribbon with gating and retract** (this is what Dom named; ours should be better than the donor: capped samples, Catmull-Rom subdivision, time-based fade, gate on active window plus padding, per-weapon row).
```ts
interface TrailRow { id:string; baseLocal:V3; tipLocal:V3; maxSamples:number; lifeTicks:number;
  gatePad:[number,number]; subdivide:number; widthFade:[number,number][]; color:string; blend:'alpha'|'add' }
class Trail { pts: {b:V3;t:V3;age:number}[] = [];
  tick(row:TrailRow, emit:boolean, w:Mat4){ if(emit) this.pts.push({b:xf(w,row.baseLocal),t:xf(w,row.tipLocal),age:0});
    this.pts.forEach(p=>p.age++); while(this.pts.length>row.maxSamples||(this.pts[0]?.age>row.lifeTicks)) this.pts.shift(); }
  mesh(row:TrailRow){ const s=catmull(this.pts,row.subdivide); /* strip: t0,b0,t1,b1..; alpha=1-age/life; u across width */ } }
```
2. **Trail gated by the hit window, with pad (sample from the windup tail through the follow-through)**; donor ties emit to `monitoring`, we add `gatePad` so the swish shows before and after the live frames.
```ts
const emit = frame >= art.active[0] + row.gatePad[0] && frame <= art.active[1] + row.gatePad[1];
```
3. **Context -> clip variants with family fallback** (donor's `SprintAttack`, `JumpAttack`, strong -> uppercut, unknown weapon -> SLASH tree). Gives every weapon "weapon-compatible" specials without authoring them all.
```ts
interface ArtSet { id:string; fallback?:string; chain:Art[]; variants:Partial<Record<'air'|'sprint'|'strong'|'backstep',string>> }
const pick=(w:Weapon,ctx:Ctx)=>{ let s=sets[w.family]??sets[sets.default.fallback]; return s.variants[ctx.kind]??s.chain[ctx.n%s.chain.length].clip; }
```
4. **Roll as an i-frame lockout with tap/hold button split** (tap < 0.3 s = roll, hold = sprint; i-frames = first 70% of the roll clip, from frame 0). Check ours matches the 0.7 fraction; make it a row.
```ts
interface RollRow { tapHoldTicks:number; iframeFrac:[number,number]; rootMotion:boolean }
onRelease(){ if(held < row.tapHoldTicks) startRoll(); }  onHold(){ if(held===row.tapHoldTicks && moving) sprint=true; }
const invuln = (t:number)=> t >= row.iframeFrac[0]*dur && t <= row.iframeFrac[1]*dur;
```
5. **Per-swing hit set + `interrupt_on` for the active window** (fixes the donor's repeat-hit hole and cleanly says "being hit cancels my hitbox").
```ts
interface Swing { id:number; hit:Set<EntityId>; art:ArtRow }
function onOverlap(s:Swing,e:Entity){ if(s.art.onceInSwing && s.hit.has(e.id)) return; s.hit.add(e.id); resolve(s.art,e); }
function onEvent(s:Swing,ev:'hurt'|'parried'){ if(s.art.interruptOn.includes(ev)) s.active=false; }
```
6. **Three-box lock-on with LOS and side retarget** (centre prio, then right, then left; ray to chest height; drop when target dies).
```ts
interface LockRow { boxes:{name:string;w:number;h:number;d:number;prio:number}[]; aimHeight:number; retargetDebounceTicks:number }
function pickTarget(p:Entity,row:LockRow,side?:-1|1){ for(const b of byPrio(row,side)) for(const e of inBox(p,b)) if(los(p,e,row.aimHeight)) return e; }
```
7. **Guard zoom and soft-follow camera constants as a camera row** (spring length lerps to a tight value while guarding, 0.1/tick; follow lerp 0.07). Small, cheap, big feel; we already have camera kick so this is an extra layer.
```ts
interface CamRow { follow:number; guard:{len:number;rate:number}; lockFaceRate:number }
cam.len += ((state.guarding ? row.guard.len : row.defaultLen) - cam.len) * row.guard.rate;
```
8. **Sound rows with a per-event delay aligned to the active window** (swing whoosh at 0.4 s into the clip; hit and clang split by what was struck). Ours likely has events; add `delayTicks` and `onWorld` vs `onTarget` variants.
```ts
interface SfxRow { event:'swing'|'hitTarget'|'hitWorld'|'parry'|'block'; clip:string; delayTicks:number; pitchJitter:[number,number] }
bus.on(row.event, ()=> schedule(sim.tick + row.delayTicks, ()=> audio.play(row.clip, jitter(row.pitchJitter))));
```

Not worth porting: the AnimationTree `advance_expression` machinery (we have our own clip system), tick-less `await`/Timer pacing (non-deterministic, would break our 60 Hz sim; always convert every timer above to ticks), 70/30 dice AI, `busy`-drops-input.
