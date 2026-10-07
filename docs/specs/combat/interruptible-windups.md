# Interruptible special wind-ups (#1507 item 1)

Status: spec, Combat, 2026-10-07. Design reference only: the "cast bar you can interrupt" of WoW / EverQuest. No donor code exists or was read for this item; everything below is read from our own `src/duel.ts`, `src/moves.ts`, `src/combat.ts` on trunk. Build by a fresh implementer from this file plus `src/`; Combat reviews the PR against it.

## 1. What exists today (verified on trunk)

- **The special's cast** (the SKILL slot of a fighter that carries `specialShare`, `duel.ts` ~line 179): pressing it commits the fighter: `special = RULES.special.windup` (120 ticks, 2 s), `SpecialStarted` fires, cooldown is spent at commitment (`cooldown` 1200 ticks, counted from the release). At 0 the strike lands unblockable and undodgeable for `damage` of the target's max health (.2; `bossDamage` .25 from level 36). `moves.ts` states the rule outright: "no guard, roll or parry, blows land normally, **nothing interrupts it**".
- **The only way a cast stops** is the caster dying: the countdown loop turns `special` to 0 and emits `SpecialFizzled`.
- A hit on a casting fighter lands as ordinary damage; he may stagger (`hurt`) but `special` keeps counting down, so the strike still lands from the floor.
- **The class "skills"** (`skill_witchfire`, `skill_pommel`) are ordinary attack moves with a 20-22 tick windup and `poise: 0`, so a hit already cuts them and the derived `AttackInterrupted` clarity cue (#1481, `clarityOf`) already fires for them. They need no change. Class specials from `weapons/class-specials` (Witch, Plague Doctor, Knight) are not on trunk at the time of writing: if they land as cast-style commitments (a counting-down field like `special`), they take this rule through the same field; if they land as attack moves, they are already interruptible.

So the gap is exactly one thing: **the long cast cannot be cut.** That is also why a rank 8-10 boss special is a pure damage check with no counterplay.

## 2. The rule

A cast is **interrupted** when the caster takes enough damage while it counts down.

1. New fighter field `castHurt` (integer damage taken since `SpecialStarted`), reset to 0 when a cast starts, ends (lands / fizzles / is interrupted) or the fighter dies.
2. Every tick, damage dealt to a fighter whose `special > 0` (any source: light, heavy, riposte, counter, stop-hit, posture break; not chip through a block, which cannot happen to a caster because he cannot guard) is added to `castHurt`.
3. When `castHurt >= interruptAt * maxHealth` the cast is **interrupted on that tick**: `special = 0`; emit `SpecialInterrupted {actor, damage}` (new sim event; `SpecialFizzled` stays for death only); `castHurt = 0`.
4. The caster's own staggers from the hits are unchanged (this rule adds nothing to stagger).
5. **Cooldown.** An interrupted cast pays a **partial** cooldown, not the full 1200: set `skillCooldown = interruptCooldown` (start **480** ticks, 8 s) so the special comes back, and a boss that has been cut does not simply wait 20 s. `specialRecover` is not applied (he never released).
6. A cast that is not cut lands exactly as today (`SpecialLanded`, full cooldown, `specialRecover`). A cast whose caster dies is `SpecialFizzled` as today.

Numbers to sweep, not guess (`RULES.special`): `interruptAt` **.10** of the caster's max health (range .06-.16; roughly "a heavy and a light inside the 2 s"); `interruptCooldown` **480** (range 300-720). Add both to the one RULES row so a ruling is a one-line change.

Per-special opt-out: a boolean `interruptible` on the special's data row (default true) so a single boss can be exempted if the ladder sweep says it must be; no other special-case code.

## 3. What the player sees and hears (derived, no sim)

- `combat.ts` `clarityOf` already derives `AttackInterrupted` from `Hit` events on a fighter in wind-up. Extend it to derive the same clarity event from `SpecialInterrupted` (actor = the caster), so the existing interrupted cue (a low whiff-class thud, muted voice stays muted via `EFFORT_VOICE`) plays and Characters' existing "cut off" pose path applies. No new sound is added by this item.
- HUD / world: a cast already has a presentation (`special-look.ts`, the 120-tick wind-up with `SpecialStarted`/`Landed`/`Fizzled`). The presentation layers treat `SpecialInterrupted` like `SpecialFizzled` (drop the charge FX, no payoff). World owns the visible "bar"/ring fill that shows how close the cast is to landing and how much it can take; that is a separate look-test (brief rule 3) and not part of the sim PR.

## 4. Risk and proof

- **Sim change:** one new fighter field, one new event, one new branch in the countdown loop, two RULES numbers. It changes any fight in which a casting fighter is hit hard enough, so `RECORD_VERSION` must be bumped and `SIM_DIGEST` / fingerprint re-pinned deliberately with the reason stated; older links are then refused at decode (`record-version-guard`'s contract), no per-version gating code. `hashDuel` (PvP rollback) must include `castHurt`.
- **Ordering with patron perks:** both need a bump; whichever reaches the Auditor first takes RV28 and the other rebases (Lead's rule 2026-10-07).
- **Ladder/balance (the real risk):** boss specials were tuned as uncounterable (`docs/briefs/specials/boss-special-balance-2026-10-01.md`). Interruptible casts will lower boss win rates unless the bots handle it. Sweep on the ladder battery (10 strategies x 10 rungs x 24 seeds): every anchor (Goblin median, `KNOWN_FLAT` bands) stays in band, no rung falls back to flat hard, and the boss-special rows in `tests/` and `origins/` that pin `damage` / cast timing still pass. If bosses get too easy, raise `interruptAt` first (not the damage).
- **Bots:** an AI that casts must not suicide into a hit it could avoid; check the bot's special use (`ai`/`moves.ts` profile knobs) and add nothing unless the sweep shows a hole. A bot that never tries to interrupt is acceptable (the human is the one with counterplay).
- **Never:** an interrupt that can fire after the strike landed, double-fire in one tick, or leave `castHurt` non-zero after the cast ends; a rule that reads render state; stagger changes.

## 5. Tests the implementer must add (node:test, `tests/`)

1. A cast of 120 ticks with no damage lands exactly as on trunk (same events, same tick, same `hashDuel` stream): the no-hit golden.
2. A cast hit below `interruptAt` lands; a hit at or above it interrupts on that tick, emits `SpecialInterrupted`, zeroes `special` and `castHurt`, sets `skillCooldown = interruptCooldown`, no `SpecialLanded`.
3. Two small hits whose sum reaches the threshold interrupt on the second.
4. Caster death still emits `SpecialFizzled`, never `SpecialInterrupted`.
5. `interruptible: false` rows never interrupt.
6. `clarityOf` derives `AttackInterrupted` from `SpecialInterrupted`.
7. Record round-trip and the record-version-guard re-pin with the reason in the commit; fingerprint re-pin lists the cells that changed (only fights with a cast hit past the threshold may move; any other moved cell is a finding).

## 6. Order

1. Sim PR by a fresh implementer (spec + `src/` only), `test:all` on the VPS, Auditor.
2. World/Web look-test of the visible cast bar after the sim lands (separate, `?flag`).
3. #6 and #5 wait until this is merged (Lead, 2026-10-07).
