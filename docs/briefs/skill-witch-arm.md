# SKILL 1 — the Witch's arm: Witch-fire (spec, doc only)

Weapons lane, 2026-09-24, for Lead → Strategy. **Proposal: no sim code and no clip bake in this PR.** It rides the next RECORD_VERSION window
(bump 11, with #707). Scope source: `docs/SCOPE.md` on #715, the **SKILL** bullet and the **two separate rules** (impossible combos vs.
secret synergies).

**What a skill is (Dom's ruling).** The player takes a body part, grafts it, and gains that part's skill. One skill is equipped per duel,
and it fires from the fourth button, labelled **SKILL**. The part supplies the move and the weapon modifies it. V1 is part × weapon, and
every difference between weapons is discrete and visible. The fight text names the skill when it lands, is blocked or is parried
("Witch-fire blocked", "Witch-fire parried"), in the one-rule text style. In the data model the field is `skill`, and the weapon modifier
is part of it.

Every number below is either **measured on trunk 2731de59** (marked *trunk*) or **proposed** (marked *prop*). The proposed numbers are
starting values for Combat's battery; none of them has been run yet.

## (a) The move — `skill_witchfire` as a MoveDef

The reference is the longsword `heavy_overhead` (*trunk*): 32/5/31 ticks, damage 18, stamina 35, stagger 24, poise 24 from tick 24,
chip .4, posture 32, staminaDamage 30, reach 1.9, parryable, charges. The heaviest heavies on the shelf are the cleaver and the maul
(36/6/36, damage 26), and the warhammer has the largest stagger (32).

| field | value | why |
|---|---|---|
| windup / active / recovery | **40 / 6 / 40** *prop* | The windup is longer than any heavy on the shelf (36): the most readable tell a player can throw, as the witch brief asks of the cast. The recovery is longer than any heavy's (36), so a whiffed cast is the punish window. |
| damage | **26** *prop* | ≥ every heavy on the shelf, the cleaver and maul's 26 included, so the rule "damage ≥ a heavy" holds whatever weapon is in hand. |
| stamina | **40** *prop* | Above the longsword heavy's 35. `legal()` refuses the cast below 40 stamina, as it refuses any move the player cannot pay for. |
| staminaDamage / posture | 30 / **40** *prop* | Heavy-class guard drain; posture 40 against the heavy's 32 is the skill's edge on a block. |
| stagger / knockback | 30 / 8 *prop* | Stagger sits between the heavy (24) and the warhammer's 32; knockback 8 is the visible shove of the gout. |
| poise / poiseFrom | 24 / 30 *prop* | Heavy-class armour, but only for the last 10 windup ticks. A light started early still stuffs it: its windup is 20 *trunk*, inside a 40-tick tell. |
| chip | .4 *prop* | As a heavy: an ordinary block lets 10 of the 26 through. |
| parryable / breaksGuard | **true / false** | The skill rule says blockable, guardable and parryable like a heavy. This **overrides `docs/briefs/witch.md`'s cast**, where a held guard did not stop it. The player's skill is not her kick-class cast. |
| chamber / charges / feintUntil | null / false / **0** | A committed move. A press always goes through: no hold, no charge, no feint-cancel. |
| stepIn | **0** | She stands and casts, the opposite of the heavy's .55 lunge. The planted feet are part of the tell. |
| direction | `thrust` (palm), or per weapon, see (c) | A straight gout from the chest reads as a centre line, the same guard side as a stab. |
| reach / path | 1.2 m cone, `path: null` (palm) | The kick's cone *trunk*: point blank, as the witch brief sets it. With no blade table, the palm cast needs no bake. |
| chain | null | No follow-up at baseline. Weapon rows in (c) add one. |

**The cooldown: 900 ticks (15 s at 60 Hz), a new per-fighter counter.** It is spent at **commitment** (the tick the stamina is paid), so
a whiff, a block, a parry and a stuffed windup all spend it. It decrements in the same per-tick map as `parryCooldown` (`duel.ts:128`),
and it is fight state, not a timer outside the tick. While it cools, **SKILL alone is dimmed**: no ring, no countdown, and
it cannot be pressed until it lights again (Lead, 2026-09-24).

**How each defence resolves**, using the rules already on trunk and nothing new:
- **Ordinary block** (a guard on the right side). Chip .4 → 10 damage; blocker stamina `blockCost` 25 + 30; posture 40. The caster is
  still in the 40-tick recovery. Text: "Witch-fire blocked".
- **Perfect block** (`perfectBlock` 3 ticks *trunk*). No damage; posture × `posture.perfect` .5 = 20.
- **Held guard on the wrong side** (the directional guard, five sides). A clean hit, as with any move guarded on the wrong side.
- **Parry** (`parry` window 10 ticks *trunk*). The caster takes `parryStun` 90: the biggest punish in the game, and it lands on the
  player who threw the biggest tell. Text: "Witch-fire parried".
- **Roll or backstep.** A clean evade: a 1.2 m cone is easy to leave. The whiff costs the full 40 recovery and the cooldown.

**The punish window.** On a whiff, the fastest stab (longsword thrust windup 16 *trunk*) lands with 40 − 16 = 24 ticks of slack. A heavy
leaves 31 − 16 = 15. On a block, the window is the caster's 40 recovery minus the blocker's block reaction. **Measure it** with the kick
punish harness (`tests/duel.test.ts`, "the kick that opens a guard is punishable…"), covering every opponent × all 9 weapons, **before**
tuning a number.

**What never changes:** slash, stab, heavy and kick timings. The skill is one new MoveDef and one new action; no existing MoveDef field
moves.

## (b) The tell, on the player's rig

**What the player's rig does in the windup (40 ticks).** The grafted left arm drops off the weapon and turns palm up at the hip. Green
kindles in the palm (an emissive on the graft's forearm material) and grows over the windup. Weight goes back onto the rear foot with no
step-in, and the weapon hand holds its guard. On the active tick the palm drives forward, and a point-blank gout of green flame fires
from it. Embers fall from the palm through the recovery.

**What the opponent sees.** The only green on the player's side, growing for 40 ticks (667 ms), on a fighter who has stopped moving
forward. Green, never orange (the witch brief's spec value): it must never read as the arena brazier. The same colour is the warden
AI's cue (see (d), `ai.ts`).

**The clip must be authored on the PLAYER rig** (`warrior.glb`), not only on hers. `WEAPON_CLIPS` resolves a role per GLB, and the hero
has no cast. Her rig can keep her own cast for her (`docs/briefs/witch.md`); the player's skill is a separate clip.

**Which existing clip it starts from.** No clip on `warrior.glb` moves the left arm forward open-palmed (its clips *trunk*: Idle … Heavy
Riposte Kick BlockImpact Parry Deflected, plus the finisher deaths), so the arm is authored new. The body starts from existing clips:
- **Sword family** (longsword, cleaver, knife, estoc, gladius play `warrior.glb`'s clips). The body is **`Heavy`'s first 10 frames**, the
  chamber pose, weapon cocked back. That pose is already the rig's "big thing coming" read. The weight shift onto the rear foot is taken
  from **`Kick`'s** plant. The left arm is new keys on `upperarm_l / lowerarm_l / hand_l`, with the palm-up cup and then the drive.
  **One new clip: `Skill_WitchArm`.**
- **Pole family** (trident, scythe, warhammer, maul: two-hand grips with their own families in their equip files). The left hand is on
  the haft and cannot open without dropping the weapon, so the cast runs **down the haft**: the grafted hand grips, the green climbs the
  shaft to the head, and the head fires. Each starts from its family's **`<Family>_Thrust`**, with the windup re-timed to 40 and the
  arm keys unchanged. **Four new clips: `Trident_Skill`, `Scythe_Skill`, `Warhammer_Skill`, `Maul_Skill`**, one in each equip file
  (the #713 loader already lays a family's clips over the rig's).

So the cost is 5 clips, 1 new role (`Skill`) in `WEAPON_CLIPS` for all 9 weapons, and 4 blade tables for the pole casts (hero rig × 4
weapons). The palm cast is a cone and needs no table.

## (c) The modifier table — witch arm × each weapon on the shelf

The shelf is `PLAYER_WEAPONS` *trunk*. Each row names one discrete, visible difference from the reference (the longsword palm cast). No
row changes a number the player cannot see.

| weapon | family | where the fire comes from | the discrete, visible difference |
|---|---|---|---|
| longsword | sword | the left palm; the off hand comes off the hilt | **Reference.** A 1.2 m cone, straight (`thrust`) guard side. |
| gladius | sword | the left palm | **A follow-up:** the stab chains off the cast (`chain: {window: 12, follow: ['thrust']}`), at the stab's own timing. It reads as a burn and then the short point. |
| knife | sword | the left palm, held low | **Reach and tell:** a **0.9 m** cone from a crouched, low palm. The knife fighter's cast is the closest on the shelf, and it is thrown from the `low` side, so the guard that stops it is **low**. |
| cleaver | sword | the left palm, cleaver raised overhead | **Effect:** knockback **14** against the reference's 8. The target is visibly thrown back a step, and the cleaver chamber above the head is an extra silhouette in the tell. |
| estoc | sword | the left palm, arm fully extended | **Reach and shape:** a **narrow jet** to **1.6 m** (half the reference's cone arc) instead of the point-blank cone. The duelist's cast reaches further and is easier to sidestep. It is data on the palm cone (a skill `arc` field): same clip, no blade table. |
| trident | pole | the tines | **Effect:** **three** gouts, one per tine, in a 2.15 m line (the trident heavy's reach *trunk*). |
| scythe | pole | along the blade's arc | **Guard side:** the cast is a **sweeping sheet**, `direction: 'right'`, to 2.3 m. It is the only witch-arm cast guarded on the side and not the centre. |
| warhammer | pole | the head, driven into the ground | **Effect and reach:** a **stamp**. Fire bursts from the ground in a 1.6 m front arc; the head strikes the ground on the active tick. |
| maul | pole | the head, overhead | **Guard side:** an **overhead** burning blow to 1.9 m (the maul heavy's reach *trunk*), guarded high where the reference is guarded centre. |

**Impossible combos (hard, and shown on the loot panel before the graft; nothing is hidden).** The grafted left arm has **one hand's
capacity**. With a **Shield** in the off-hand slot, the palm cannot open. **Ruled (Strategy):** the loot panel refuses the graft while a Shield is
worn, reading "The Witch's arm needs its hand free: take off the shield", and it refuses to wear a Shield while the arm is grafted. The
pole family grips with that hand, and the cast is authored to run through the haft, so it is **not** an impossible combo.

**Secret synergies.** Permitted pairs that hide a bonus are never documented, so **none is written here or anywhere in the repo**. If Strategy picks
one for the witch arm, it lives outside the spec and is left for players to find.

## (d) The SIM_FILES it touches (bump 11, with #707)

SIM_FILES *trunk* (`tests/record-version-guard.test.ts:19`): duel, moves, ai, sim, record, blade, blade-paths, roster, finishers.

| file | change |
|---|---|
| `src/moves.ts` | `skill_witchfire` MoveDef, the per-weapon `skill` modifier rows from (c) (reach, arc, direction, knockback, chain), and the `Skill` role in the move/role maps. |
| `src/duel.ts` | `Action` gains `'skill'`; `Fighter` gains `skill` (the equipped skill id or null) and `skillCooldown`; `legal()` checks that a skill is equipped, the cooldown is 0 and stamina is ≥ 40; the cooldown is spent at commitment and decrements in the per-tick map. |
| `src/record.ts` | The intent encoding carries the new action; the record header carries the equipped `skill`, as it carries `weapon`. **RECORD_VERSION 10 → 11.** |
| `src/blade-paths.ts` | 4 new tables: trident, scythe, warhammer, maul (hero rig). The palm casts, the estoc's jet included, need none. |
| `src/ai.ts` | The warden reads the green windup as a heavy-class tell: guard or parry decisions only. **No warden casts in V1.** |
| `src/sim.ts`, `blade.ts`, `roster.ts`, `finishers.ts` | No change expected. The skill may land the kill, but only as a **plain death** (ruling 3), so `finishers.ts` does not change. |

Outside SIM_FILES: `characters.ts` (the `Skill` role in `WEAPON_CLIPS`); `loot.ts` (a body-part slot for the arm, the graft, and the
Shield rule); `input.ts` and `hud.ts` (the fourth button, SKILL, dimmed while it cools); `main.ts` and `match.ts` (the equipped skill
into the Match, the same way #713 wires the weapon); the fight-text lines. The **green glow, the gout flipbook and the embers belong to
Visuals & World**; the cast and burn cues belong to **Audio**, whose sprite has 816 B of gzip headroom *trunk*, so room must be made
first.

## Build order (from SCOPE)

The one-creature Witch slice runs end to end before anything else in grafting: kill → take the arm → graft → equip Witch-fire → fight
with SKILL → replay. **The slice starts with the longsword palm cast alone**, the reference row, with the other eight rows behind it, so
the first playable skill needs one clip, one MoveDef and no blade table.

## Strategy's rulings (2026-09-24, via Lead): #720 is the slice's working spec

The *prop* numbers stay proposals until Combat's battery runs them.
1. **The guardable override is accepted.** The player's skill follows the SKILL rule (blockable, guardable, parryable). The Witch's own
   cast keeps `docs/briefs/witch.md`'s rule.
2. **Damage is 26, FLAT.** It is never scaled by the weapon in hand. The weapon changes only what is seen: reach, shape, side, chain and
   knockback. If parity fails, the lever is the cooldown or the tell, never the weapon table.
3. **A killing blow is allowed, as a plain death.** V1 has no finisher on the skill, and the kill line reads "Witch-fire".
4. **The Shield rule is accepted as the first impossible combo.** The loot panel shows it before the graft and refuses a Shield while the
   arm is grafted. Pole grips are not impossible.

The slice starts with the longsword palm cast alone.
