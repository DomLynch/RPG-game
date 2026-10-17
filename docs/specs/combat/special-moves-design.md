# Special moves (beta): design, donors, build plan

Dom, 2026-10-17: the specials looked "like spell flashes on old swings". No spell effects. Proper weapon moves, compatible with different weapons (a side head-smash or overhead skull-crack works with a maul, trident or scythe; a whirlwind), borrowed from the best games. Start with 2, one more per boss kill, 4 for now, maybe 6 in the end. Sandbox-only until Strategy and Combat agree; anything that reaches the game goes through Combat with an RV bump.

## The four (and two later)

| # | Move | Unlocks | Motion (clip we already have) | Impact and look | Reuses from our code | Donor / reference |
|---|---|---|---|---|---|---|
| 1 | **Skull Crack** (overhead) | start | the weapon's own Heavy clip (every weapon family has one) | contact at head height, hit-stop 8-10 frames, camera nudges down, sand dust at the feet, bone-crack sound, blood on the contact | Split Crown finisher: `bone_crack` sound, blood start, camera dolly; `hit-stop-defs` `special` row (today 0 frames: the missing weight); `finisher-blood.ts` | WoC `execute`/`mortal_strike` shape `plunge` (contact height 0.7); Veloren `heavy_guillotine` (extra damage vs poised); Sekiro Ichimonji, Elden Ring Lion's Claw |
| 2 | **Whirlwind** (spin) | start | the weapon's Attack (slash) clip with the body turned a full 360 over ~0.55 s (WoC turns the rig, no new clip) | thick tapered blade ribbon trail around the body, hit everyone in reach once at the end, short hit-stop on the last hit only, dust ring at the feet | `bladeTip` probe + weapon base/tip offsets for the trail; `special-fx-executioner` painted sand strokes | WoC `whirlwind` (`weapon_attack_style_core.ts` spin, `warrior_gyre.ts` ribbons, MIT); Elden Ring Spinning Weapon (first hit frame 23, hit every 7, end frame 70); ModernUO WhirlwindAttack |
| 3 | **Ground Slam** | boss 1 | the Heavy clip, longer windup, hit late | crack + stone fragments + shock ring in the sand, camera drops on landing, victim staggered (posture break) | the Dwarf's quake `special-fx-quake.ts` (Anvil Stomp ring, "no glow", painted sand) made available to the player; `hit-stop` `postureBreak` row | WoC `thunder_clap` / `faultline` shape `fault`; Veloren `earthshaker`, `pile_driver` (hit_timing 0.9); Elden Ring Storm Stomp |
| 4 | **Lunge / Impale** (thrust) | boss 2 | the weapon's Thrust clip with a step in | thin straight trail, target pushed back, pierce contact (short blood), 70 ms freeze | finisher "Run Through" contact and sound; `skill_lunge` move row (reach 2.4, stepIn 1) | Veloren `spear/dash`, WoC `breachmaker` shape `thrust`; Sekiro Ashina Cross |
| 5 (later) | Side Head-Smash | boss 3 | the weapon's Attack clip, hit at head height from the side | high stagger, low damage, side-flank bonus | `hit-stop` `guardBreak` row | Veloren `axe/skull_bash` (poise 60, angle 45); OpenDAoC positional opener |
| 6 (later) | Reaping Sweep | boss 4 | wide slash for scythe / reaper / polearm | wide arc ribbon, ground cleave mark | `special-fx-executioner` reaping arc | WoC `red_harvest` shape `reap`; Veloren `charged_melee` cleave |

Which boss gives which move is Strategy's call; the pairing above follows the look each move borrows (Dwarf quake, Nightborn estoc).

## Weapon compatibility

A special is a row: `{ id, shape, clipRole, requires: [weapon classes], contactHeight, hitStopFrames, shake, trail, ground }`, not code. The weapon only supplies its own clip (Heavy / Attack / Thrust, from `WEAPON_CLIPS`) and its trail base and tip offsets. So the same Skull Crack plays as a sword chop, a maul smash, a scythe overhead or a trident stab-down with no new animation. ModernUO's table (two specials per weapon class) is the model for the gate. The spin is the rig turning (WoC `spinAngle`), also no new clip.

## What makes it look good (the common stack, all presentation, all rows)

1. Hit-stop scaled by weight (Guilty Gear Xrd 7 frames light, ~10 heavy; WoC `holdFrame` 0.11 s at scale 0.07, 0.25 s refractory). Ours is 0 for specials today.
2. Camera: a nudge along the swing at the peak, then a decaying shake (WoC cap 0.26, budgeted so chains stay calm; Sakurai: more damage, longer freeze).
3. Blade trail: a thick tapered ribbon from stored base and tip positions with a fade (WoC `pathRibbon`, `weapon_face_sampler.ts`).
4. Ground: painted strokes of the arena's own sand and dust (our Dwarf and Executioner looks), never a glow.
5. Contact: a height on the victim (skull vs leg) and a style (crush, edge, pierce), with blood and sound from the finisher system.
6. Sound: whoosh + impact + body, no delay.
Avoid: glow sprites where a weapon should be, constant shake, a freeze on every hit of a flurry, slow-mo on ordinary moves.

## Sim side (Combat, RV bump)

Strategy's ruling (2026-10-17): before promotion the special cast reads its move-defs row (reach, windup, stagger, knockback, stamina damage, posture) instead of the flat special share, data only, with 16-seed receipts that the specials differ. Starts and unlocks need a record field for "specials owned".

## Honest limits of this research

I cannot watch videos. Fighting-game numbers come from text and frame-data pages (Guilty Gear paper, Elden Ring wiki, Game Developer, Sakurai); Dark Souls, Sekiro, Mortal Kombat and Mordhau had no frame data I could read. WoC is MIT and can be ported with credit; Veloren, ModernUO, OpenDAoC, openmw are GPL, so design and numbers only.

## Build order (sandbox, one clip per step at 375 wide)

1. Hit-stop and camera jolt on specials (rows only).
2. Skull Crack on the existing Heavy clip: contact height, blood, sound, dust, trail.
3. Whirlwind: spin the rig, ribbon trail, reach hit.
4. Show both clips to Dom; then 3 and 4 only on his word.
