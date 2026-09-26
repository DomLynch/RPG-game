# SCOPE 8: the nine opponent moves (Combat's rows, Strategy's ruling 2026-09-26)

SCOPE item 8: a kill offers the opponent's armour piece OR his move. One move is equipped per duel (the SKILL button), with a
15 s cooldown (`RULES.skillCooldown`), at least a heavy's damage, blockable and guardable, and a readable tell. Existing attack timings
stay untouched. Dom ruled all nine in ONE batch with ONE record-version bump (13 → 14). Opponents never cast in V1 (`skill: null`):
these are the hero's takes. This file is the spec the rows PR is reviewed against. `tests/skill-caps.test.ts` pins every cap below.

## Template (the Pommel's row)

path null (a cone of `reach` × `RULES.kickArc`), chainPath/chained/chain null, vsGuard null, feintUntil 0, chamber null,
charges false, parryable true, stamina 40, breaksGuard false, chip .4 unless the row says otherwise. There is one shared MoveDef per
skill on every weapon (`OPPONENT_SKILLS` in src/moves.ts), the way the kick and the Witch-fire are shared.

## The caps, as duel.ts applies them (accepted by Strategy as THE caps)

- **Timing:** windup/active/recovery copy an existing row unchanged: light 20/8/22, chained light 16/8/18, heavy 32/5/31,
  thrust 16/5/21, or kick 18/1/25.
- **Damage ≥ 18.** That is at least the heavy's damage, and it clears every opponent's poise (max 16: Pitborn and Shieldmaiden). At
  16 or less, duel.ts lets a poised foe shrug the hit: no stagger and **no knockback**, which would kill the Shove.
- **No guaranteed follow-up (only the Pommel owns that).** The worst stun, a counter-hit plus a rear hit
  (`Math.round(stagger × 1.5 × 1.25)`), must be ≤ (active − 1) + recovery + 20 (a light's wind-up).
- **Punishable on a block.** (active − 1) + recovery − 16 (the hero's thrust wind-up) must be ≥ 9.
- The thrust's stop-hit ×1.5 is keyed to `move === 'thrust'`, so the Lunge and the Iron Rush never inherit it.

## The rows

| id | offered by | name | timing | dmg | stagger | chip | stamDmg | posture | knockback | stepIn | reach | dir | other | worst stun / line |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| skill_shove | veteran | Scutum Shove | kick | 18 | 22 | .4 | 30 | 24 | 14 | 1 | 1.3 | thrust | | 41 / 45 |
| skill_cleave | pitborn | Butcher's Cleave | heavy | 22 | 28 | .4 | **60** | 32 | 4 | .55 | 1.6 | overhead | **no breaksGuard** | 53 / 55 |
| skill_jab | goblin | Dirty Jab | **chained light** | 18 | 20 | .4 | 20 | 16 | 2 | .4 | 1.3 | thrust | stamina 30 | 38 / 45 |
| skill_lunge | nightborn | Estoc Lunge | thrust | 20 | 22 | .4 | 30 | 20 | 3 | 1 | 2.4 | thrust | | 41 / 45 |
| skill_reaping | executioner | Reaping Blow | heavy | 28 | 28 | .6 | 40 | 32 | 6 | .55 | 2.0 | right | poise 24 from 24 | 53 / 55 |
| skill_stomp | dwarf | Anvil Stomp | heavy | 18 | 24 | .4 | 30 | 50 | 4 | 0 | 1.4 | low | | 45 / 55 |
| skill_miasma | plaguedoctor | Miasma | heavy | 18 | 20 | .4 | **50** | 24 | 0 | 0 | 1.2 | thrust | **one-tick cone** | 38 / 55 |
| skill_ironrush | knight | Iron Rush | thrust | 20 | 22 | .4 | 30 | 20 | 3 | 1 | 2.0 | thrust | **poise 24 from 8** | 41 / 45 |
| skill_hewer | shieldmaiden | Shield-Hewer | light | 18 | 24 | 1.0 | 20 | 20 | 4 | .4 | 1.4 | overhead | | 45 / 49 |

## The four flags Strategy ruled (2026-09-26)

1. **Cleave: no breaksGuard.** breaksGuard would break SCOPE's "blockable and guardable" rule. Instead staminaDamage 60
   (= `RULES.breakCost`): a guard with less than 60 stamina cannot pay for the block and breaks (duel.ts's existing fall-through).
   It "breaks a tired guard".
2. **Jab: the chained light row (16/8/18).** The plain light's 20-tick wind-up is slower than the thrust's 16 and the kick's 18, so
   "fastest" needs the chained row. It is still an existing light timing.
3. **Iron Rush: poise 24 from tick 8, labelled "armoured against every plain blow".** Armour compares against the incoming
   move's BASE stagger, and a light's 24 equals a plain heavy's and a riposte's, so "lights only" would need a new mechanic. The guard
   counter (30), the critical (40) and the skills get through. The precedent is heavy_counter's poise 24 from tick 4.
4. **Miasma: a one-tick cone like the Witch-fire, staminaDamage 50.** A path-null move drains staminaDamage on a clean hit too
   (duel.ts), so it takes half the 100 bar either way. A lingering cloud or damage over time would be a new mechanic and is not in V1.

## Per-row notes

- **Shove:** 14 knockback ticks at walking pace is about 0.7 m, 2.3× the kick's. A shove into the ring wall adds the wall's +12
  stagger and +15 posture. A block takes no knockback.
- **Lunge:** reach 2.4 beats the estoc thrust's 2.3. stepIn stays at the thrust's 1: faster, and it would out-run a backstep (the
  Goblin trap #761 fixed).
- **Reaping:** the top damage of the nine, above the Witch-fire's 26 and under the heavy riposte's 30. A counter plus a rear hit does
  40, equal to the critical. It chips 17 through an ordinary block.
- **Stomp:** posture 50 is the top. A block takes all of it. Two cannot stack: the cooldown is 900 ticks and posture drains in ~300.
- **Hewer:** chip 1.0 puts all 18 through an ordinary block. A perfect block, a parry or an evade stops it.

## Outside the rows (other lanes)

Each move plays its timing row's clip until its own lands (combat.ts `clipOf`: the heavy-timed four play the heavy, the Lunge, Iron
Rush and Shove the thrust, the Jab and Hewer the light). The take tiles need Web's thumbs at `/game/img/loot/<id>.thumb.svg`.

## Verification

`tests/skill-caps.test.ts` (the caps, the four flags, one shared row per weapon, a clean hit and a block per skill, the Cleave's break
at 59 stamina); `node scripts/skill-battery.mjs --skill <id>` for each of the nine, which exits 1 on any row over a cap; the AI-vs-AI
ceilings; the SIM_DIGEST re-pin at v14; the replay references, plus `veteran-hewer` for the widest skill code.
