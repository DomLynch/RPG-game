# Gothic 2 light-attack chain rhythm window (behaviour spec)

Status: Clean-room read, 2026-10-07, Combat analyst.
Source: OpenGothic (a re-implementation of the Gothic engine, read-only via the GitHub API). This is behaviour only; no code, names or comments are carried over. Anything not read is marked INFERRED.

## 1. What the window is

A melee chain is not a series of separate swing animations. Each attack (forward, left, right) is ONE long animation clip that contains several swings back to back. The animation data carries two kinds of time markers, authored in animation frames and converted to milliseconds by the clip's frame rate:

- A "hit end" marker per swing: the moment that swing is over.
- A "combo window" marker pair per swing: an opening time and a closing time. The pair for swing N lies inside swing N, late in it, before its hit end.

The character keeps a per-fighter chain counter (swings already chained, starting at 0) and a chain-broken flag. The counter picks which marker pair and which hit end are currently live.

## 2. State machine in prose

The press is evaluated at the instant the attack key arrives, against the time elapsed since the current clip started.

1. **No swing in progress.** The press starts the clip from its beginning. Counter resets to 0, broken flag cleared.
2. **Swing in progress, press INSIDE the live window** (strictly after the opening time, up to and including the closing time):
   - Same attack clip: the chain continues. The clip clock is fast-forwarded to the current swing's hit-end time, so the animation snaps to the start of the next swing at once. The counter goes up by 1. The next press is then judged against the next marker pair.
   - A different attack clip (e.g. forward then left): the new clip starts from its beginning with Force priority, and the counter resets to 0. So switching direction inside a window is always allowed, and starts a fresh chain.
   - If the chain-broken flag is set, the press is rejected even inside the window.
3. **Press TOO EARLY** (at or before the opening time) or **TOO LATE** (after the closing time):
   - If it is the same clip, the chain-broken flag is set: no later press in this chain can continue it. The press itself does nothing; the swing in progress plays on unchanged (the engine re-requests the same clip, finds it still running, and ignores it).
   - If it is a different clip, nothing is flagged; the request falls through to the normal "start an animation" path.
4. **Chain exhausted:** when the counter has run past the last marker pair, the chain is broken, press ignored.
5. **Swing ends.** Once elapsed time passes the current swing's hit end, the attack counts as finished and the fighter can act again. A new press then starts the clip from the beginning as a fresh attack.
6. **While inside the window**, other animations cannot interrupt the swing; outside the window they can (so a parry or block press outside the window interrupts the swing; inside it, it does not). Blocking/parry and finishing moves use clips with no hit-end data, so they bypass the chain logic and start immediately, resetting the chain.
7. **Clips without markers** (fist/simple attacks lacking window data) skip the rhythm entirely: any press starts or restarts the clip and resets the chain.

## 3. Player-visible effect

- Press in the late part of a swing, and the next swing flows with no pause: the blade never returns to ready. Press outside it and nothing happens; the swing finishes, then the character is idle and ready for a fresh first swing.
- Mashing does not speed the chain up. Early mashing hits the "too early" rule on the first press, which both ignores it and kills the chain, so the fighter plays one swing and stops, then restarts at swing 1 on the next press after the swing ends.
- Rhythm is rewarded by animation speed: a continued press jumps the clip forward, so skipping the tail of the previous swing is the pay-off.
- The AI uses the same entry point, so NPC chains obey the same window; their next decision is scheduled for the swing's hit-end plus one millisecond (read).

## 4. Numbers

The source holds no frame numbers; they live in the game's animation scripts, which I did not have. What is read:
- Time = frame x 1000 / frame rate, truncated to whole milliseconds.
- Window comparisons: open is exclusive, close is inclusive.
- Window pairs and hit ends are indexed per swing; the window sits wholly before its swing's hit end.
- INFERRED from play knowledge of the original game: three to four swings per clip, window roughly the last 25 to 40 percent of each swing. Treat as design starting point, not fact.

## 5. Quirk worth knowing

The broken flag and counter are only reset when a different clip or a marker-less clip is started through the chain path, NOT when a fresh swing restarts after the previous one finished. A broken chain may therefore stay broken into the next attack until some other attack resets it (read; possibly a bug rather than design). Do not copy this.

## What this means for Frankendom

Our sim is fixed-tick; the light swing has startup, active and recovery; a chain is pressing light again.

**Proposed rhythm-window definition** (fractions of the swing, so it survives retuning):
- Window opens when the active phase ends and closes at 60 percent through recovery (all tunable fractions). (Gothic's window is the late part of the swing, ending before the hit end; our equivalent is the tail of active plus first part of recovery.)
- Press inside: chain continues, next swing begins immediately and the remaining recovery is skipped (the fast-forward feel).
- Press before the window (during startup or active): ignored, and sets "chain broken" for this chain (Gothic-faithful penalty). Softer option to playtest: ignore without breaking, with a buffer of about 3 ticks so slightly early presses do not punish.
- Press after the window closes but before recovery ends: ignored, chain broken.
- Press after recovery ends: a fresh first swing.
- Changing attack type in window starts a fresh chain; defensive actions follow existing interrupt rules but cannot cut a swing inside the window (decide).
- Reset the broken flag whenever any fresh swing starts (fix the quirk above).

**Mashing:** gives one swing per full cycle plus the penalty of a broken chain; no faster than one clean swing, no stamina benefit. Rhythm players get the skip.

**Risks:**
- Any change to which presses are accepted alters sim outputs for recorded inputs: replay incompatibility, so RECORD_VERSION must be bumped and old records either replayed under the old rules or retired.
- The fingerprint/determinism rows will change (new chain state in the fighter state, new flag); pin the new values with a reason.
- Window edges are tick-exact; boundary inclusive/exclusive choice must be fixed in the spec before coding.
- Needs two new fields of fighter state (chain counter, broken flag) in snapshots.
- Feel risk: the broken-on-early rule punishes mobile players with input latency; keep the buffer option ready.

## Read list

- common/world/objects/npc.cpp
- common/graphics/mdlvisual.cpp
- common/graphics/mesh/pose.cpp
- common/graphics/mesh/pose.h
- common/graphics/mesh/animation.cpp
- common/graphics/mesh/animation.h
- common/game/playercontrol.cpp
