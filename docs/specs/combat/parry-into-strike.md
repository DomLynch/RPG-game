# Parry into strike (riposte): what exists, what is missing, what to build (#1507 item 6)

Status: spec, Combat, 2026-10-07. Own design, no donor code (Witcher 3 / Mount & Blade / Kingdom Come are design references only). Facts below were read from `src/duel.ts`, `src/moves.ts`, `src/combat.ts` on trunk plus Characters' #1502 (`openingOf`). Nothing here is built; the sim change waits for Dom's look-test (brief rule 3) and is built by a fresh implementer from this file (Strategy's ruling).

## 1. What the sim already does (verified, do not rebuild)

| Defence | What opens | Window | What the next press becomes | Cost / payoff today |
|---|---|---|---|---|
| **Parry** (tap Guard into a swing, `parry` action) | `punish` on the parrier, the foe staggered for `parryStun` | 90 ticks (the whole stagger) | light/slash -> `slash_riposte`, thrust -> `riposte`, heavy -> `heavy_riposte` (windup 12/12/20 vs 20 for a plain light; damage ~24 (riposte) / 30 (heavy riposte) vs light 11, per the moves.ts balance note) | Already a fast counter. The parry fills posture; the riposte is the damage payoff and carries `posture: 0` so two parries cannot kill |
| **Block** (held guard) | `counterWindow` on the blocker | `guardCounter` = 20 ticks | **heavy only** -> `heavy_counter` (fast, armoured vs lights). A light or thrust pressed in the window is an ordinary swing | Perfect block (guard raised in the first `perfectBlock` = 3 ticks) pays half stamina, takes no chip, deals `posture.perfect` = .5 of the posture, but opens the **same** 20-tick window as any block |
| **Posture break** | `punish` + `critical` for `posture.stun` | 90 ticks | heavy -> `critical`, light -> riposte | Already a punish |

`openingOf` (#1502) reports who is open and for how long (`left` of `of` ticks) for parry and posture opens. It is derived from sim state and never fed back, so it stays a render/audio/HUD signal.

So **a parry already becomes a riposte**. The brief's item 6 ("a perfect guard opens a short window where your next light becomes a fast counter-strike") is real only for the **perfect block**: today a perfect block rewards a heavy counter and nothing for a light, and it is indistinguishable in reward from a clumsy block.

## 2. The gap this item closes

A well-timed block (guard raised in the last 3 ticks before impact) is the skill act the game should pay, but it pays exactly what a sloppy block pays plus half stamina. The player who blocked perfectly has no fast light answer; lights are 20 ticks of windup into a foe that is already recovering from a blocked swing.

## 3. Proposal (the smallest change that closes it)

**A perfect block grants a short riposte window for the light/thrust press.**

1. On a block event with `perfect = true`, set a second counter on the blocker, `riposteWindow`, for `perfectRiposte` ticks (start: **14**, shorter than the 20-tick guard counter; to be swept).
2. While `riposteWindow > 0`, `chooseMove` maps light/thrust to a new fast move `perfect_riposte`: windup 12, active 5, recovery 19 (the `riposte` timing, reuse its baked path and clip), damage between a light and a riposte (start 16; swept), `posture: 0`, `breaksGuard: false`, `chip: 0`. Heavy keeps `heavy_counter`.
3. Any attack start clears it (the existing single door at the top of the attack start already resets transient windows; add the new field there).
4. An ordinary block still opens only the 20-tick heavy counter. A parry is untouched.

Why this shape: it adds exactly one field and one move, rides the existing "reset in one place" rule, leaves parry/posture/critical alone, and gives the perfect-block skill a distinct, visible payoff (a quick answer, not a bigger heavy).

## 4. What the player sees and hears (render/audio only, no sim)

- Perfect block already emits `Blocked {perfect: true}`. Derive `PerfectOpening {side, left, of}` in `combat.ts` next to `openingOf` (view-only) so Characters can pose the foe's recoil / the hero's ready stance and Audio can add a short high tick. Both are look-test items; none touches the digest.
- HUD: no new element; the existing glint (waits for Dom) can mark the window.

## 5. Risk and proof

- **Sim change:** one new fighter field, one new move, one new branch in `chooseMove`. This changes replays of any fight containing a perfect block followed by a light inside 14 ticks, so it needs a `RECORD_VERSION` bump and a re-pin of `SIM_DIGEST` / fingerprint (the #1402 fixture) with the reason stated. Per the lowest-version-writer pattern in `patron-perks-sim.md`, a record could stay at the old version when no perfect block occurs, but that is not cheap to prove for a sim rule (it needs the recorder to know the rule fired), so default to a plain bump.
- **Ladder/balance:** the bots block and perfect-block at set rates (`read`, `parry` knobs in `moves.ts`). Sweep `perfectRiposte` and the damage on the ladder battery (10 strategies x 10 rungs x 24 seeds): every anchor (Goblin median, `KNOWN_FLAT` bands) must stay in its band, and no rung may fall back to flat hard. Check the Armfeel and posture tests in `tests/` and `origins/` for pinned damage.
- **Numbers to sweep, not guess:** `perfectRiposte` 10-18 ticks, damage 14-20.
- **Never:** a counter that can chain into a kill from two perfect blocks (keep `posture: 0` and damage below `riposte`); a window longer than the guard counter; a rule that reads render state.

## 6. Order

1. Look-test first (brief rule 3): a `?flag` preview on `/preview/` with the derived `PerfectOpening` pose + sound only, no sim change, so Dom judges the readability of the moment.
2. After his yes: the sim PR by a fresh implementer from this file + `src/`, goldens, ladder sweep, `test:all` on the VPS.
3. Independent of #5 (combo rhythm); they touch different fields, but both bump `RECORD_VERSION`, so ship together if both are approved.
