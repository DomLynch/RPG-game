# OpenMW melee weapon timing: behaviour spec

Status: Clean-room read, 2026-10-07, Combat analyst.
Scope: behaviour only. Anything not read directly is marked INFERRED. Game-data constants (the tunables below) live in the content files, not the engine; the names are visible in the engine but the default values were NOT read, so every default quoted is INFERRED from general knowledge of the original game and must not be treated as verified.

## 1. Charge and attack strength

- Attack strength is a number from 0 to 1. For a melee weapon with a charge animation it is the fraction of the way the animation has travelled between two authored marks: "min attack" (0) and "max attack" (1). Formula: (current animation time minus min mark) divided by (max mark minus min mark), clamped to [0,1].
- The player holds attack: the swing animation plays from its start mark to the max mark and then holds there. Releasing the button sets the state to release. Strength is sampled at the moment of release, not at the damage frame.
- Releasing before the min mark gives strength 0 (weakest swing). The release animation does not begin until the wind-up has reached at least the min mark, so a very early tap still finishes a normal-looking swing at minimum power.
- Charge time is the animation length between the marks divided by weapon speed (speed is the animation playback multiplier, 1.0 neutral). A faster weapon charges and swings proportionally faster; there is no separate stamina-based speed penalty.
- Release animation: playback resumes from the max mark and runs to the hit mark, but the start is skipped forward by (1 minus strength) of that segment (additionally scaled down if the hit mark sits late). A weak swing therefore lands sooner; a full charge plays the whole segment. So power costs time on both ends.
- After the hit, a follow-through animation plays, variant chosen by strength: below 0.33 small, below 0.66 medium, otherwise large. This is animation only.
- Weapons with no charge marks (many creature attacks) never charge: strength is a random value uniform in [0.1, 1.0], and the weapon plays through in one piece.
- Ranged and thrown weapons use the same strength. Bow damage uses the same low-to-high interpolation.

## 2. Damage

- Each weapon has three attack types (chop, slash, thrust), each with a min and max damage. Swing damage = min + (max minus min) times strength.
- Then multiplied by: weapon condition fraction (current over maximum, so worn weapons hit softer), and (base + attacker Strength times mult times 0.1), where base and mult are tunables (INFERRED defaults about 0.5 and 0.1, giving 1.0x at Strength 50).
- Victim already knocked down, or (player only) victim unaware of the attacker and not in combat: damage multiplied by a tunable (unaware gets a larger "critical" multiplier, INFERRED about 4x; knocked-down gets a smaller one, INFERRED about 1.5x). Armour reduction and difficulty scaling then apply (armour is a separate subsystem, not covered).
- Unarmed: skill times (min mult + (max mult minus min mult) times strength), optionally times Strength over 40; mostly drains stamina rather than health unless the victim is paralysed or knocked down.
- Each hit wears the weapon by at least 1 plus a tunable fraction of damage dealt.

## 3. Attack type choice (player)

Chosen at the start of the swing from movement input at that instant: if forward/back input exceeds sideways input by more than 0.2 (on a unit scale) it is a thrust; if sideways exceeds forward/back by more than 0.2 it is a slash; otherwise (standing still, or diagonal within 0.2) it is a chop. An optional setting instead picks the type with the highest min+max damage sum (ties: all equal gives slash; thrust beats chop and slash on ties; slash beats chop on ties). Unarmed "best" is random: one third each. The type is locked for the swing. AI picks its own type, or random thirds.

## 4. Hit chance (the dice roll)

- Roll a number 0 to 99; the swing connects only if the roll is below the hit chance. Chance = attacker term minus defender term, rounded.
- Attacker term = (weapon skill + Agility/5 + Luck/10), times the attacker's fatigue factor, plus Fortify Attack points minus Blind points.
- Defender term = (Agility/5 + Luck/10) times the defender fatigue factor, plus Sanctuary points (capped 100), plus Chameleon and Invisibility contributions (each capped 100). The agility/luck part is zero if the defender is knocked down, paralysed, or (player attacking) unaware and not in combat. If the defender's stamina is below zero the whole defender term is zero.
- Fatigue factor = base minus mult times (1 minus current/max stamina), with current/max floored at 0 (INFERRED defaults 1.25 and 0.5: 1.25 at full, 0.75 at empty). Stamina therefore moves both sides' hit chance by up to 40 percent relative.
- The roll is decided at release time, before the animation reaches the hit frame. A miss forces strength to 0 and deals no damage. If nothing is in reach when the hit frame arrives, that is not a "miss": it is just a whiff.
- Shield block is a second roll on a landed hit; see 7.

## 5. Reach and targeting

- Reach = a world-distance tunable (INFERRED 128 units) times the weapon's reach rating. Unarmed uses its own reach tunable for people, the plain tunable for creatures.
- The target must be within reach by bounding-box distance (not centre), with vertical difference under reach as well.
- Facing cone: target must be in front (not behind), within a horizontal tolerance of about 42 degrees either side of facing; vertically the body (feet to head) must be reachable within a similar tolerance. The nearest valid target is struck; only one target per swing.

## 6. Stamina cost

On each swing (hit or miss, taken at the hit frame): loss = base + normalised encumbrance (0 to 1) times mult, plus weapon weight times strength times a weapon mult. So heavier weapons and fuller charges cost more. Stamina below zero (or maximum zero) forces the character into a knock-out state. Stamina has no direct effect on damage, only on hit chance (4) and block (7).

## 7. Block, stagger, knockdown

- Block needs a shield, a ready (not in hit recovery, knocked down, or paralysed) defender, and the attacker inside a facing arc set by two angle tunables. Block chance (percent, clamped between a min and max tunable) = defender term minus attacker term. Defender term = (Block skill + Agility*0.2 + Luck*0.1) times (strength*swingMult + swingBase) times a bonus if the defender is not moving forward, times defender fatigue factor. Attacker term = (weapon skill + Agility*0.2 + Luck*0.1) times attacker fatigue factor. A stronger swing is easier to block (opposite of intuition). A block zeroes damage, costs the blocker stamina (base plus encumbrance plus attacker's weapon weight times strength) and wears the shield by the incoming damage.
- Any hit that deals damage and has an attacker applies stagger. Knockdown happens only if both: raw health damage (before armour) is at least Agility times a tunable (INFERRED 0.5), and a 0 to 99 roll is at least Agility times an odds tunable times 0.01 plus an odds base. Otherwise the target gets hit recovery (a short flinch). A script may opt a hit out of stagger.
- Knockdown stops all movement (speed 0) until its animation ends; hit recovery interrupts the target except that non-humanoid creatures mid-swing ignore it. Stagger is cancelled when the victim finishes an attack. A knocked-down target takes the bonus damage in 2 and has no evasion.
- Falling also knocks down if fall damage exceeds Acrobatics times fatigue factor.

## What NOT to copy for Frankendom

- The hit roll (section 4): a visible connection that turns into a miss is exactly what Frankendom rejects. Reach plus cone plus the swing's active frames decide a hit, and nothing else. Evasion-by-stats and invisibility/Sanctuary shaving hit chance conflict directly. Use dodge, parry and range as the only defences.
- Block roll (section 7): same objection. Block must be deterministic by timing and facing.
- Random knockdown roll: stagger must be a rule, not a dice throw (below).
- Random strength 0.1 to 1.0 for non-charge attackers: no random damage.
- Strength sampled at release with the miss check made before the hit frame: a target who moves during the swing still gets hit or missed on stale information. Frankendom decides at the active frames.
- Stamina collapse knock-out at zero, and stamina scaling hit chance: Frankendom keeps its spine; stamina must not modify accuracy or damage (Attack/RES caps 1.15/0.80 untouched).
- Global cooldowns: OpenMW has none for melee, so nothing to avoid here, but the "button up equals instant restart" feel is the model to keep.
- Floaty hits: OpenMW's flinch is only an animation, and the attacker's follow-through is free; a flinch does not stop a victim already mid-swing, which makes trades feel weightless. Frankendom wants hit stop and stagger on every connect.

## Worth knowing (fits light / heavy / charged-heavy)

- Two authored marks (min, max) with a continuous 0 to 1 strength is the cleanest charged-heavy model. Suggested fixed-tick mapping at 60 Hz: charge starts after a 6-tick (0.1 s) light-attack startup; strength starts at 0 and rises linearly over 30 ticks (0.5 s) to 1.0; holding beyond that holds at 1.0 with a visible "full" cue. Strength must only scale the charged-heavy's spine damage inside its existing bounds, not raise caps.
- The release-skips-wind-up trick: a half-charged release starts the strike partway in. Concrete: release start offset = (1 minus strength) times a 12-tick strike segment. A full charge is a 12-tick strike (200 ms); a quarter charge is a 3-tick strike. Light attacks (tap) are then just the strength-0 end: fast, weak. This keeps one animation set for light, heavy and charged-heavy; the sell is that partial charge is faster-landing, never both slower and weaker.
- Follow-through split by strength (below 0.33 / 0.66 / above): short, medium, long recovery. Suggested: 8 / 12 / 16 ticks, so cheap taps recover quickest and a fully charged swing is punishable on whiff.
- Weapon speed as a pure playback multiplier on wind-up and strike (not recovery) gives weapon feel without touching damage: dagger 1.2x, sword 1.0x, greatsword 0.8x (INFERRED values, tune in playtest).
- Movement-chosen attack type (thrust forward/back, slash sideways, chop still, 0.2 dead zone) gives players a free attack-direction vocabulary with no extra buttons; the dead zone and lock-at-start rules apply.
- Reach as a weapon multiplier on one base distance, with bounding-box (not centre) distance and a roughly 42 degree front cone, one target per swing, nearest wins.
- Stamina cost scales with weapon weight times strength: a clean way to make charged swings costly without changing damage.

## Read

- apps/openmw/mwmechanics/combat.cpp
- apps/openmw/mwmechanics/character.cpp
- apps/openmw/mwmechanics/creaturestats.cpp
- apps/openmw/mwclass/npc.cpp
- files/data-mw/scripts/omw/combat/local.lua
- files/data/scripts/omw/combat/interface_local.lua
- apps/opencs/model/world/defaultgmsts.cpp (tunable names only; defaults not present)

weaponanimation.cpp was not found at that path (404) and was not read; projectile release is handled in the files above.
