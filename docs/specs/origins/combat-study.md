# Combat study: what the great RPGs can lend the duel (proposal)

- Author: Expansion lane analyst (clean-room spec author), 2026-10-07. For Dom, Strategy, Lead and the Combat lane.
- Status: **proposal**. Nothing here ships or changes `src/`. Every number is PROVISIONAL until Combat measures it on the battery.
- Trunk read at `0d2d9996`. Our side: `src/duel.ts`, `src/moves.ts` (`RULES`, `MOVES`, `OPPONENTS`), `src/ai.ts`, `src/record.ts`
  (`RECORD_VERSION` 27), `src/net/rollback.ts`, `src/net/verify-duel.ts`, `scripts/rng-fingerprint.mjs`, `src/hud.ts`,
  [feuds.md](feuds.md), [progression-proposal.md](progression-proposal.md), [frankendom-baseline.md](frankendom-baseline.md),
  [patron-perks-sim.md](patron-perks-sim.md).

## RULING 2026-10-07: combat luck (Dom-approved 2026-10-07; agreed by Strategy)

Dom picked two of the luck options. Strategy agreed with both, under the five conditions below. This ruling supersedes "no luck roll" in §5's recommendation. Every PvP and ladder hit keeps **no** per-hit dice. Luck changes odds and damage, never timing.

**1. The Gambit, everywhere including PvP.** This is a move the player chooses to make, with visible odds: about 1 in 3 lands a devastating blow, and otherwise the player staggers themself.
- (C1) **EV-neutral or slightly worse than a normal heavy.** On average, 1 in 3 × "devastating" must not beat a heavy. "Devastating" is capped: big damage plus posture, but never a kill from above about 40% health in one hit.
- (C2) **A real tell, with the same timing as a heavy.** The opponent can see it coming and punish or parry it. Nothing changes timing.
- (C3) **The PvP roll cannot be known when the player presses.** A plain seeded roll that both clients can compute ahead lets a modded client throw only the gambits that will land. The roll therefore comes from the seed plus something neither side knows at press time: the opponent's input on the resolve tick, or a server commit-reveal. Combat and Backend own this, and it is the main build risk.
- (C4) A future **Luck** stat that improves the odds stays inside the 25% "gear tilts" cap. It is **normalised** to a fixed value on the ladder and daily duel, like the fixed kit.

**2. ±10% damage rolls, shown on screen (scope narrowed by Dom below: Origins world mobs only, both directions).** The roll is a percentage, not a fixed ±5.
- (C5) Rolls come from the fight's seed, so the Pit's replay/hash re-sim still reproduces them exactly. The battery checks hits-to-kill breakpoints: ±10% must not turn a 3-hit kill into a 2-hit kill often enough to break the fight-length pins.
- **Scope order:** Origins world monsters first. The Pit legends get it only after a battery shows ladder win rates move by 3 points or less and the "beaten once" progression still feels earned. That step is its own record-version bump, after RV29–31.

**Build split.** Origins goes first behind a flag, then the arena. Combat builds both in `src/`: the Gambit move, the C3 roll with Backend, and the seeded damage roll plus its battery. Expansion wires the Origins side: monster fights read the flag, and the HUD shows the roll.

**Gambit input (Strategy, 2026-10-07).** A second heavy press during the wind-up turns that heavy into a Gambit, with the same tell as the heavy.
- The arm window opens only after the chamber, not in the first ~8 ticks, so an accidental double-tap on a phone doesn't arm it.
- Arming gives the player a private cue: a button flash and a small sound that the opponent's screen does not show.
- The EV counts the cost of being punished after a self-stagger.
- Odds are one constant: **about 1 in 2 for about 2×** (Dom-approved 2026-10-07). EV is slightly under a heavy once the self-stagger's cost is counted.

## RULING 2026-10-07: stances and opponent mood (Dom-approved 2026-10-07; aligned by Strategy with Lead; one system)

Dom wants the player to choose a temperament. The AI's opponent mood is the same system: the mood presets **are** these stances.

| Stance | Bonus | Cost | Beats |
|---|---|---|---|
| Balanced (id `neutral`) | none | none | nothing (the safe middle). Shown as "Balanced" (Dom 2026-10-07); the id `neutral` is unchanged in code and records |
| Aggressive | +5% damage, +10% posture damage dealt | blocks cost 10% more stamina | Trickster |
| Defensive | blocks cost 15% less stamina, faster posture recovery | −5% damage | Aggressive |
| Trickster | feints cost half, kicks deal more posture damage | −5% damage on heavies | Defensive |

**Rules**
- **Damage starts at ±5%** (Lead). Dom's ±10% is the ceiling. The battery may raise it only if the counters don't bite too hard and the hits-to-kill breakpoints hold. The posture and stamina modifiers are as in Dom's table.
- **Never touches timing:** no change to swing speed, parry window, i-frames, reach or input.
- Stances count inside the 25% "gear tilts" budget, together with gear.
- **Patron rule:** stances are EXEMPT from "arena perks are no-damage sidegrades". A stance is a symmetric trade-off that every player picks freely, not an earned perk (Strategy).
- **Balance:** every stance pair wins 40–60% in the battery and the bot reruns, and no stance is dominant against the field.
- **Tell:** weapon-hold poses (three guard poses from Characters, budgeted) plus a reveal on the versus card at fight start. Nothing appears over the arena. v1 may ship on the versus-card reveal while the poses are made.
- **PvP:** both players commit a hidden pick at the same time, and the versus card reveals both.
- **AI = opponent mood:** the AI draws its stance from the fight seed with a home-stance bias: 50% its home stance, 50% one of the others. Home stances: Executioner Aggressive, Shieldmaiden Defensive, Goblin Trickster, Centurion Balanced (id `neutral`). The seed draw keeps re-sim exact.
- **Mood never touches difficulty:** reaction time, the read/habit knobs and the RV31 spam gate are excluded. The battery runs per stance per opponent: within ±5 points of base on the honest bots, and the ladder overall within ±3.
- AI opponents only get moods. A player's stance is always the player's own pick.
- **Dropped:** "+10% from behind" and the two-finger swipe.

**Rollout**
- v1: a pick before the fight, on the Pit / fight-start screen, with no new button.
- v2: one switch, after a posture break, only after v1's data.

**Damage rolls: RULED by Dom (his own words, 07:5x, relayed by Strategy).**
- **DROPPED** in the Pit (legends and arena AI), PvP and the ladder.
- **KEPT** for Origins world mobs outside the Pit, in **both directions** (player → mob and mob → player). Fixed damage reads as boring: "you are hit for 23, 23, 23".
- Conditions stand: the roll comes from the fight seed (re-sim exact), the number is shown on screen, the battery runs a hits-to-kill breakpoint check on common mobs, and luck never changes timing.
- #1607 scopes the roll to Origins world encounters, and a test gates it off the Pit and PvP paths.

**Later (approved direction, not yet scoped):**
- One mid-fight stance switch, after a posture break.
- A Luck stat inside the 25% gear budget, normalised on the ladder and daily duel.
- Coach mode reuses the four stance names.

**Owners:** Combat builds the sim side in the order RV31 → RV30 → Gambit → stances, each with its own record-version bump. Characters provides the three guard poses. Expansion wires the Origins/HUD side.

## Page one, for Dom

> **Superseded on luck:** the dice lines on this page are replaced by the two RULINGS above (luck; stances and mood). The Gambit is a chosen roll everywhere, PvP included. ±10% shown damage rolls apply only to Origins world mobs outside the Pit, both directions. The Pit, PvP and the ladder have no per-hit dice.

**What is worth borrowing**

1. **Take turns in a crowd.** When several enemies attack you in the open world, only one fights you at a time and the rest circle,
   watching, ready to step in. Action RPGs have done this for 20 years because a real gang-up is unwinnable and unreadable. We can
   build it without touching the duel at all: each exchange is still the 1v1 fight you love, the gang just queues for its turn.
2. **Big telegraphed attacks for giants and bosses.** A long, loud wind-up, a mark on the ground, and one clear answer (roll
   through it, step out of it, or hit him first). Feuds already promises this for guards and Zeus; this gives it one rulebook.
3. **Damage that varies because of how you hit, not dice.** A cut to the head lands harder than a cut to the shins; a clean
   mid-swing hit beats a glancing one at the very end of the swing. Numbers move (12, 14, 16, 17) but you earned each one. Our game
   already does this for counters, rear hits, stop-thrusts and charged heavies; this extends it to every hit.

**What is not worth borrowing**

- **Dice on whether you hit at all** (Morrowind's famous "my sword passed through him" miss roll). Never.
- **Weapon skill that raises damage the more you swing** (Gothic's talent, Morrowind's use-gain). It turns skill into grind and
  breaks fair PvP. Keep "skill decides, gear tilts". Mastery should unlock *looks and new moves*, not bigger numbers.
- **Random damage in PvP and the ranked Pit.** ±5 on a 24 is ±21%: in a close fight luck, not you, lands the last blow.

**Recommendation:** build the turn-taking crowd and the giant tells in the Origins preview first (no arena change). Then let the
Combat lane add skill-based hit quality, Origins first behind a flag and then the Pit with one record-version bump. If after that
the world still feels too even, add a small luck roll **only against world monsters**, never in PvP or the Pit.

---

## 0. What we already have (so we do not rebuild it)

The duel already carries most of the "great RPG" toolkit. Any proposal below extends these and never adds a parallel system.

| Idea from other games | Already in Frankendom | Where |
|---|---|---|
| Stagger / poise (Souls, Gothic's uninterruptable trolls) | `Fighter.poise`: a plain hit dealing less than it never staggers; hyper-armour from a move's `poiseFrom` tick and on a chambered/charged heavy | `duel.ts` hit resolution, `OPPONENTS.*.poise` (Dwarf 12, Pitborn 16, Executioner 12, Knight 12) |
| Posture break (Sekiro) | posture 0–100, break = 90-tick stun + critical window (critical = 40 damage) | `RULES.posture`, `MOVES.critical` |
| Skill-based damage multipliers | counter ×1.25, rear ×1.15, stop-thrust ×1.5, charged heavy ×1.5, location table head/torso/legs (all ×1 today) | `RULES.counter/rear/stopHit/charge/location` |
| Combo windows (Gothic) | chain window 18 ticks after recovery, chained timings, input buffer 10/11 ticks | `MoveDef.chain`, `RULES.bufferWindow` |
| Telegraphed unblockable (bosses) | the Special: 120-tick committed wind-up, cast inside 3 m, beaten by leaving reach or hitting the caster | `RULES.special` |
| Roll i-frames | roll 36 ticks, invulnerable ticks 4–20; backstep has none | `RULES.roll/safeStart/safeEnd` |
| Damage numbers on screen | white dealt, red taken, gold and bigger for heavy-class hits | `src/hud.ts` |

Determinism facts every option below must respect (from the baseline and the code):

- **The duel has no randomness.** The only random stream is the warden's LCG in `AiState` (`ai.ts`), advanced only by `roll()`.
  The RNG fingerprint (`scripts/rng-fingerprint.mjs`, `tests/fixtures/rng-fingerprint.json`) pins its draw count, a hash of its
  values and the end state for every opponent × level {1, 6, 11, 12, 18, 30, 46} × 3 seeds × 2 scripted players.
- **PvP has no seed at all** (`net/pvp.ts` header writes `seed: 0`); both peers step `stepDuel` with both intents. `verifyDuel`
  re-derives a room from both pages' records. Anything random in PvP needs a new, agreed room seed.
- **Any edit to a sim file** fails `tests/record-version-guard.test.ts` without a `RECORD_VERSION` bump, even behind an off flag.
  So "flag off" still means the Combat lane, a bump and a digest re-pin. The patron-perks spec set the pattern we reuse: the
  writer stamps the **lowest version that can express the fight**, so a fight that uses no new rule stays byte-identical.
- **Any new field on `Fighter` or `Duel` changes every `hashDuel`** (rollback, verifier, fingerprint end-state).
- Patron perks plan RV 28. Everything here says "**next free RV**" (28 or 29 depending on what lands first).

---

## 1. What the donors do (rules in our words)

### 1.1 Morrowind (OpenMW, source read)

- **To-hit roll.** A melee swing first rolls 0–99 against the attacker's weapon skill plus a fifth of agility and a tenth of luck,
  scaled by current fatigue, minus the victim's evasion. Fail = a full swing that does nothing. This is the mechanic players
  remember worst. **Reject.**
- **Damage from wind-up.** Each weapon has a min and max damage per attack type (slash, chop, thrust). Damage is interpolated
  between them by *attack strength*: how far through the wind-up the player held before releasing (0 to 1). For NPCs (who do not
  hold) the strength is a random roll. Then scaled by strength attribute and by weapon condition. **Lesson:** the player's
  variance there is *earned by timing*, the NPC's is dice. Our charged heavy is the earned half already.
- **Knocked-down or unaware victims** take a damage multiplier (sneak and knockdown punish). Our critical and rear hit cover this.
- **Block is a percentage roll** from block skill vs attacker skill and swing strength, clamped between a floor and a ceiling,
  with a bonus for standing still and only inside a frontal arc. **Reject the roll**; our block is a timed, directional action.
- **Knockdown chance** compares the hit's damage with the victim's agility, with a random roll. Our poise threshold is the
  deterministic version of the same idea.
- **Group AI.** Every hostile actor runs its own combat package: it attacks whenever its own cooldown expires (a base delay plus
  up to about a second of random jitter), strafes left or right at random between attacks, and picks slash/chop/thrust weighted
  by which does the most damage. **There is no turn-taking**: three guards swing together, which is why Morrowind crowds feel like
  a blender. **Lesson for us: we need the token we propose in §2.**
- **Skill by use.** Each successful hit or block adds a fixed per-skill amount toward that skill's next point; the requirement
  grows with the skill's level and is cheaper for class skills. Full rules are in [openmw-levelling-skills.md](openmw-levelling-skills.md).

### 1.2 Gothic I/II (OpenGothic, source read)

- **Melee damage** = strength + weapon damage − the victim's protection for that damage type, floored at 0, with a minimum
  damage of 5 on a hit in Gothic II.
- **Weapon talent is a dice roll on every hit.** Gothic II: roll 0–99; if the roll is at or above the attacker's talent percent
  for that weapon class, the hit does about **a tenth** of its damage. Monsters without a weapon always do full damage. Gothic I:
  the talent percent is the chance of a *critical* that multiplies weapon damage. So an untrained fighter's sword mostly tickles.
  **Reject** (power from grind, binary variance far beyond anything Dom asked for).
- **Talent tiers change the animation set.** Each one- or two-handed tier (untrained, fighter, master) swaps a whole overlay of
  attack animations: longer combos, smoother chains. **Borrow the shape** (§4 option 2): mastery unlocks *moves*, not numbers.
- **Combo windows.** Each attack animation has authored windows per combo step: a press inside the window chains the next swing;
  with no press, the attack ends at that step's authored hit-end. We have the same thing (chain window + buffer); nothing to add.
- **Stagger.** Any landed hit interrupts an interruptible body state with a front or back stumble chosen by the side struck; big
  monsters carry an "uninterruptable" override (our poise). A "fly" damage type (trolls, giants' clubs) throws the victim back.
  **Borrow:** a giant's sweep that knocks the player back (§3) is Gothic's fly damage made telegraphed.
- **Fight AI** is a table per fight tactic: the situation (enemy winding up in range and facing me; I am in weapon range and
  facing, running or not; in the wider ring; far away) picks a random entry from a list of moves: single attack, side pair,
  triple combo, whirl (four), master combo (six), parry, strafe, jump back, wait, wait longer. After being hit the NPC prefers a
  strafe. **No group coordination** either; Gothic packs (wolves, guards) are famous for being lethal for the same reason.
- **Melee on humans knocks out instead of killing**; the winner may finish or rob. Our finishers already own this beat.

### 1.3 Skyrim and The Witcher 3 (closed source: published design knowledge only)

- **Skyrim:** melee damage is fixed per weapon and perk (no damage roll on ordinary hits); power attacks cost stamina and can
  stagger; skills rise by use (one-handed rises by landing one-handed hits) and perks are the real power. Large enemies
  (giants, dragons) use long, readable wind-ups and a knock-back sweep. Public criticism: use-based levelling is grindable
  (players famously trained skills by repetition), and crowds have no turn-taking.
- **The Witcher 3:** weapons show a **damage range** and each hit rolls inside it, plus a critical chance and critical bonus from
  gear and skills. Many monsters announce heavy attacks with a long tell; Geralt answers with a dodge or roll, not a block. Its
  damage range is PvE-only design; the game has no competitive PvP.
- **The turn-taking pattern** ("circle of death", "kung-fu circle"): widely documented in action-game design talks (Batman Arkham,
  Assassin's Creed, the 2016 Doom's attack tokens): enemies hold a small number of attack permissions; the rest circle and
  posture. We cite only the pattern, not any implementation.

---

## 2. Fighting several enemies (Origins open world only; the Pit stays 1v1)

Today every Origins encounter resolves as one 1v1 duel through `encounterForms`. A pack (two cinder scavengers, a guard pair, the
brood at the matriarch) is the new case.

### Option 2A. Tag-team tokens (one attacker at a time). **Recommended first.**

- **How it plays.** The pack surrounds you. One enemy holds the **token** and duels you with the full live sim. The others circle
  at 4–6 m, facing you, visibly waiting ("next" marker under the one who will step in). The token passes:
  - when the holder dies (the next one steps in after a 45-tick breath, so you can turn);
  - when the holder has made **3 attack starts** or **6 s** (360 ticks) have passed since he took it, whichever is first, but
    **only at a quiet moment**: neither fighter in `attack`, `hurt`, `roll` or a Special wind-up, and you not inside your own
    chain window; the holder then backs off to the ring and the next takes over;
  - never more than once every 120 ticks.
  - Your health, stamina, posture and wounds carry over; each enemy keeps his own.
- **Build.** Pure Origins code in `origins/`: an *encounter director* holding N `opponentFighter` states and N `AiState`s. The duel
  in play is always the two-fighter `Duel`; on a hand-over the director builds the next `Duel` from the player's live `Fighter` and
  the incoming enemy's saved `Fighter`. `stepDuel` is pure and returns new objects, so **no `src/` file changes**, no RV, no
  fingerprint move. Waiting enemies are presentation (a circling puppet driven by the director, not by the sim). Cost: about
  300–450 LOC plus tests, Expansion lane, about 2–3 days.
- **Determinism.** The director's choices read only the duel state and its own seeded LCG (a separate stream from every warden's).
  An encounter record is `{ encounter id, director seed, per-enemy seeds, player intents }`; it is not a ladder `FightRecord` and
  never carries the arena RV. World kills are server-verified by replaying this record (O-series verifier, later).
- **Risk to feel.** Lowest of all options: every exchange is the duel Dom loves. Risk: the waiting ring can feel staged. Mitigate
  with roles (2E) and a short "taunt" bark when the token passes.
- **Limits.** No one can hit you from behind; a sweep can only touch the token holder. That is the price of zero sim change.

### Option 2B. True multi-fighter duel with N tokens (N = 2)

- **How it plays.** Two enemies may be in their attack at once; others wait. Flanks become real; the camera must frame two foes.
- **Build.** Generalise `Duel.fighters` from a pair to a list, pairwise hit resolution, a lock-on target switch, AI that knows
  about allies, a camera that frames several, and a new hash shape. Combat lane, about 2–3 weeks, plus Web/camera. Touches
  every sim gate (digest, fingerprint, rollback, verifier). PvP and the Pit would run the N = 2 code path with N fixed at 2 fighters,
  so they must stay byte-identical through the refactor (a high bar).
- **Risk.** High: the duel's readability rests on one opponent in front of you. Two simultaneous swings defeat directional guard
  and parry timing. **Not now.** Reconsider only if 2A playtests as "too staged".

### Option 2C. Stagger and poise in a crowd

- Already exists for 1v1. In 2A the holder is the only one who can hit you, so stun-lock from several foes cannot happen.
- If 2B is ever built: after any landed hit on the player, other enemies' blows cannot *stagger* him for 30 ticks (they still
  damage). Gothic and Morrowind have no such rule and both stun-lock. **Recommendation:** nothing to build for 2A; mandatory for 2B.

### Option 2D. Flanking bonus

- The player already gets the rear-arc bonus (×1.15) in every duel. Enemies flanking the player would only matter in 2B.
- **Recommendation:** no enemy flanking bonus ever (an attack from behind is untelegraphed by definition, which feuds forbids). In
  2A, a waiting enemy behind you is shown on the edge-of-screen marker and sound only.

### Option 2E. Enemy roles (with 2A)

| Role | What it does while waiting | Token rule | Cost |
|---|---|---|---|
| Duellist (default) | circles at 4–6 m | normal | none |
| Brute | circles slower; when he takes the token he opens with a charged heavy (existing move) | takes the token only after a Duellist has had it | data |
| Skirmisher | circles fast, closest; takes the token sooner (2 attack starts or 4 s for the holder before him) | normal | data |
| Pack leader | stays back; while he lives the others hand over faster (every 4 s); kill him and they fight one each to the end | last to take the token | data + one director rule |

Ranged roles (archer, thrower) are **out** for now: feuds pauses world strikes during a duel, and a projectile during the duel is
an untelegraphed-from-the-side hit unless it carries the patron strike's 72-tick marker. Revisit with the Combat lane.

### Option 2F. Sweep and crowd knock-back (player side)

- In 2A, a player sweep (an existing wide move, or a future technique, §4) that lands on the holder also pushes every waiting
  enemy within 2.5 m back to the ring and delays their next token by 60 ticks. Director-only rule, no sim change. Cheap and fun.
- In 2B, a true multi-target sweep is a sim change (Combat lane).

**Section 2 recommendation:** 2A with 2E roles and the 2F director push, in the Origins preview. 2C/2D: nothing to build. 2B: no.

---

## 3. Telegraphed big attacks (bosses, giants, Ascapart)

One rulebook for every boss and giant, consistent with feuds §7.1 (the hard rule: every attack telegraphed and dodgeable, nothing
one-shots a player who reacts correctly).

**The rule set (PROVISIONAL numbers, 60 Hz ticks):**

1. **Tell length.** A big attack winds up for **at least 36 ticks** (0.6 s, longer than our heavy's 32) and **at most 120** (the
   Special's 2 s). Giants (scale ≥ 1.3) use 40–60.
2. **One answer per attack, shown by its tell.** Each big attack belongs to exactly one class, and the class has its own look and
   sound so a player learns it once:

   | Class | Tell | Answer | Fails |
   |---|---|---|---|
   | **Sweep** (wide arc, ground level) | low wind-up, blade drags back | roll through it (active window ≤ 12 ticks, so a roll's 16 invulnerable ticks clear it) or back out of reach | a block is broken (breaksGuard) |
   | **Slam** (overhead, area) | 2 m ground marker under the target from the first tell tick (the patron strike's look) | step or roll out of the marker | block and parry do nothing |
   | **Grab / pin** | arm reaches, a distinct rising sound | roll sideways or hit him in the wind-up (interrupts unless he has poise against it) | block |
   | **Parryable heavy** | the normal heavy look, a bright flash at the last 10 ticks | parry (the reward: the existing posture fill), or block for chip | — |

3. **Delays.** A boss may hold a wind-up (the "delayed swing") only in its chamber pose, at most 30 extra ticks, and only once per
   attack. Never a delay without a visible held pose.
4. **Damage ceiling.** A landed big attack takes at most **35% of the player's max health** (feuds' inner-ring ×4 applies to guards,
   not to bosses, as feuds already says for Ascapart). Two in a row cannot kill from full.
5. **Knock-back (Gothic's fly damage, telegraphed).** Sweep and Slam push the player 1.5–2.5 m and stagger for the move's stagger;
   at the ring wall the existing wall rule adds posture.
6. **Weak spot.** A giant may name one hit location (head for the Cyclops, GAME_SPEC's "one weak spot") that takes ×1.25 and fills
   posture double. This uses the location table of §5C, so it lands with that work.
7. **Cadence.** At most one big attack per 240 ticks (4 s); between them the boss fights with his normal moves.
8. **Phases.** Feuds' `one-health-bar` twist: phase 2 at 50% health adds one big attack class, never shortens a tell.

**Build.** Each big attack is a new `MoveDef` row (timing, damage, stagger, knockback, `breaksGuard`, `parryable`) plus one new
event for the marker (`BigAttackTell` with class, centre, radius) so World and audio draw it, plus AI knobs for when to use it. That
is a sim table change: **Combat lane, next free RV**, fingerprint fixture gains the new opponent's cells. In the preview, before
any sim change, the director (§2A) can fake Slam with the existing patron-strike marker between duels, and Sweep with the
existing charged heavy (which already breaks a guard). Ascapart's first build should be the existing knight body at large scale
with the Special and the charged heavy: both already telegraphed.

---

## 4. Weapon skill with use

Context: the progression proposal (decision 9) already says **"no skill or stat gain by use"**, and gear stats promise "no stat
changes the timing of any attack". This section respects both.

| Option | What it is | Fair in PvP | Cost | Verdict |
|---|---|---|---|---|
| **0. No** | Rank (career level) and gear stay the only progression | yes | none | the safe default |
| **1. Mastery marks (cosmetic)** | Per weapon, count landed hits and kills (Morrowind's use events, but they buy *nothing* in power). Thresholds unlock a title ("Spear-hand"), a blade trail, a finisher variant, a stance idle | yes | small: a counter in the Origins save, server-checked from verified fights | **Recommended now** |
| **2. Trainer techniques (Gothic's tiers, as moves)** | A trainer in town teaches a *new move* for a weapon once you have N mastery marks and a rank: e.g. a third chained cut, a sweep, a feint-into-thrust. A new move is a sidegrade with its own full tell; nothing gets faster or harder-hitting | yes, if both fighters see each other's techniques before PvP (the patron rule) | each technique is a `MoveDef` + bake + AI answer: Combat lane, RV bump per batch | **Later**, Origins first; Pit only after Combat rules |
| **3. Numeric skill (Morrowind / Gothic talent)** | Use raises damage or hit chance | no: grind beats skill | medium | **Reject**: contradicts the fixed spine (Attack/RES caps resolved before the fight) and decision 9 |

---

## 5. Damage variance ("dice")

Dom's question: would ±5 randomness add suspense and grit instead of 24, 24, 24?

Reference numbers today: health 150 for a man; light cut 14, thrust 11 (14 counter, 17 stop-hit), heavy 18 (27 charged), riposte 24,
heavy riposte 30, critical 40. A duel is 8–15 blows. Damage is computed as `Math.round` over float multipliers in `duel.ts`.

Scale check: ±5 on 24 is ±21%. On a light cut ±5% is 13–15, i.e. only ±1 on screen; ±10% is 13–15 too. Rolls only *show* on
the big hits. Over a fight of about 11 light-equivalent blows, a uniform ±20% roll on every hit moves the total by about 5 HP
(one standard deviation), a third of a cut: it rarely changes how many hits a kill takes, but it **does decide which blow is the
last one** in a fight that was already within one hit. That is exactly the fight where PvP fairness matters most.

### (a) None (today)

- **Arena 1v1:** perfectly fair and readable; numbers already vary through counter/rear/stop/charge (24, 14, 17, 30 …). Nothing to do.
- **Origins world:** same. Dom's complaint stands where most hits are plain cuts.
- **RV / fingerprint / verifier / Combat:** no change.

### (b) Seeded luck roll (±5–10%)

- **Rule.** On each landed `Hit`, `dealt = round(dealt × (1000 + r) / 1000)` with `r` a seeded integer in [−50, +50] (±5%) or
  [−100, +100] (±10%). Exactly **one draw per landed hit**, from a **new luck stream** on `Duel` (never the warden's stream, or
  every AI decision after the first hit shifts and every fingerprint cell moves).
- **Arena 1v1:** unfair at the margin as shown above; feels "random" to good players; a lost close fight blamed on dice.
- **PvP:** needs a room seed agreed at the handshake and written to the record (today `seed: 0`). The seed must come from the
  server lobby, not a peer (a peer could pick favourable seeds). `hashDuel` covers the stream state; rollback re-steps it
  identically; `verifyDuel` stays deterministic given the seed.
- **Origins world:** acceptable against monsters (PvE, no rival human); adds texture.
- **Readability:** the number on screen no longer tells you what you did right.
- **RV:** next free RV; writer stamps the old version when the flag is off (zero draws, byte-identical).
- **Fingerprint:** unchanged with the flag off; a new fixture set pins flag-on cells (draw count = hits landed).
- **Combat lane** owns the stream, the draw site and the gates; Backend owns the room seed.

### (c) Skill-based hit quality (earned variance)

- **Rule.** Every landed clean hit gets a **quality factor** in integer per-mille, the product of three terms, clamped to
  **[800, 1200]**, applied before the existing counter/rear/stop/charge multipliers:

  | Term | Values (PROVISIONAL) | Read from | Sim change |
  |---|---|---|---|
  | **Location** | head 1150, torso 1000, legs 900 | `bladeImpact` already returns it; `RULES.location` exists (all 1 today) | values only |
  | **Timing in the swing** | contact on a middle active tick 1000; on the first or last active tick 900 ("glancing") | `age` vs the move's active window | one comparison |
  | **Blade sweet spot** | outer 40% of the blade 1000, middle 920, near the hilt 850; a thrust that lands from under 60% of its reach (jammed) 850 | `bladeImpact` must also return where on the blade contact happened (bake change) | Phase 3 |

  Edge vs flat is **not modelled** (the blade has no roll axis in the baked paths); "glancing" stands in for it.
- **Calibration.** Choose the values so that the battery's **mean** quality is 1000 (so fight lengths, the ladder anchors and the
  `KNOWN_FLAT` bands do not drift); if the mean lands below, raise the location values together.
- **Poise interaction (decide explicitly).** Today a hit staggers when `dealt ≥ poise`. With quality, a hilt cut on a Dwarf
  (14 × 0.85 = 12) still staggers, but 14 × 0.80 = 11 does not. Recommended: **the stagger test reads the pre-quality damage**, so
  quality changes numbers, never whether a hit staggers. Posture fill likewise stays pre-quality.
- **Arena 1v1 / PvP:** fully fair (symmetric, no dice, visible cause). No room seed needed; `verifyDuel` unchanged in kind.
- **Origins world:** the same rule; giants' weak spots (§3.6) use the location term.
- **Readability:** the HUD adds a one-word tag on the floating number: **Head**, **Glancing**, **Clean** (only when not torso-mid).
  Presentation-only, Web lane.
- **RV:** next free RV. Location and timing change every ladder fight, so a ladder-wide turn-on is a real fight change: REACH lists
  every opponent at every level, the fingerprint is re-pinned with the reason, the battery reruns, `fight-records.json` regenerated.
  A per-fight flag (like the specials flag) lets Origins use it first with the Pit stamping the old version.
- **Fingerprint:** draw counts unchanged (no new randomness); end states move only in flag-on fights.
- **Combat lane** owns all of it; the bake change (sweet spot) also touches `scripts/bake-blades.mjs` (Combat).

### (d) Hybrid

- (c) everywhere, plus (b) at **±5% only in Origins PvE** (world monsters and bosses), never in PvP, the Pit, guards or the
  bouncer duel (a human-authored stake). Adds a little grit against creatures without touching fairness where it counts.
- Cost: both gates (the luck stream and the hit-quality terms). Only worth it if (c) alone still reads "too even" in playtest.

### Recommendation

**(c) skill-based hit quality, in both the arena and the world, Origins first behind a flag.** No luck roll in PvP or the Pit, ever.
Hold (d)'s PvE-only ±5% in reserve for after a playtest of (c).

---

## 6. Phased build plan

| Phase | What | Where | Lane | RV / gates |
|---|---|---|---|---|
| **0 (this PR)** | This spec | docs | Expansion | none |
| **1 (preview, flags off in the live game)** | Encounter director: tag-team tokens (2A), roles (2E), sweep push (2F); mastery marks counter (4.1) in the Origins save; Ascapart prototype on existing moves (Special + charged heavy); the patron-strike marker reused as a between-duel Slam | `origins/` only, read-only reuse of `src/` (`stepDuel`, `opponentFighter`, `decide`) | Expansion | none: no `src/` file touched, fingerprint and digest unchanged; director has its own seeded stream and its own tests |
| **2 (Combat, one bump)** | Hit quality (5c) location + timing terms as integer per-mille, behind a per-fight flag in the record header; the HUD tag; stagger reads pre-quality damage | `src/duel.ts`, `src/moves.ts`, `src/record.ts`, `src/hud.ts` | Combat (+ Web for the tag) | next free RV; writer stamps the old version with the flag off (patron-perks pattern); `REACH[new] = []`; flag-off byte-identical proofs (fingerprint 0 changed cells, `hashDuel` over the replay corpus); new fixture for flag-on cells; release order: verifier host first, then clients |
| **3 (Combat)** | Big-attack move class (§3): new `MoveDef` rows, `BigAttackTell` event, AI knobs; the blade sweet-spot term (bake change) | `src/moves.ts`, `src/duel.ts`, `src/ai.ts`, `scripts/bake-blades.mjs` | Combat; World and audio draw the marker | RV bump; fingerprint fixture gains new opponents' cells |
| **4 (arena, Dom's GO)** | Turn hit quality on in the Pit and PvP | `src/match.ts`, `src/net/rollback.ts` kit | Combat, Lead GO | RV bump with REACH = every opponent at every level; battery rerun and anchors held; `fight-records.json` regenerated with the reason; fix-forward re-pins named in the PR |
| **Later / maybe** | Trainer techniques (4.2); PvE-only luck (5d); true multi-fighter sim (2B) | | Combat | each its own bump |

The Pit stays 1v1 in every phase.

---

## 7. Donor manifest (clean room, ruling 8)

- **Spec author:** the Expansion lane analyst named above, 2026-10-07.
- **Sources seen:** **yes** for OpenGothic (MIT; `common/game/damagecalculator.cpp`, `common/game/fightalgo.cpp`,
  `common/world/objects/npc.cpp`, `common/graphics/mesh/animation.cpp`, `pose.cpp`) and OpenMW (GPL; `apps/openmw/mwmechanics/
  combat.cpp`, `character.cpp`, `aicombat.cpp`, `npcstats.cpp`, `apps/openmw/mwclass/npc.cpp`), read-only on the VPS at
  `/opt/frankendom-shadow/work/expansion-donors/`. ZenKit not needed for this study. Skyrim and The Witcher 3: closed source,
  public design knowledge only.
- **Nothing copied.** This file holds rules and numbers restated in our own words; no donor code, identifiers beyond file names, or
  long passages. Morrowind game-setting values were not quoted (they are data-defined and the source does not carry them reliably).
- **Implementers work from this spec only** and from Frankendom's own code. Do not open the donor sources; list every deliberate
  divergence beside the code.
