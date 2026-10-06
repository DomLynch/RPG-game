# Spec: NPC daily routines, AI states, perception and the world clock (Gothic donor)

- Spec author: analyst-gothic (clean-room; implementers must not read donor source)
- Donor: OpenGothic @ `801f6ed5da1d29c316e1b2d18d3e001a84b9ebf1` (MIT, "Copyright (c) 2019 Try", `LICENSE`)
- Data-structure reference: ZenKit @ `ddf27decd5eeb48ec715e6e66e5f5072c51d88ee` (MIT, "Copyright 2021-2024 GothicKit Contributors", `license.md`)
- All paths below are relative to `OpenGothic/common/` unless prefixed `ZenKit/`.
- No donor code is reproduced here. Formulas and constants are restated in plain maths.

## 1. Purpose

Gothic NPCs live on a 24-hour schedule: each NPC owns a list of "routine entries" (start time, end time, AI state, waypoint). At any moment the engine picks the entry that covers the current time of day and runs its AI state (an init / loop / end triple of script functions). Script code inside the state walks the NPC to the waypoint and plays the activity. Perception callbacks interrupt states; after an interruption the script asks the engine to "continue routine", which re-selects the entry for the current time.

What the ENGINE does: clock, entry storage and selection, end-time computation, state lifecycle (init once, loop on a timer, end on exit), perception polling and dispatch, free-point (FP) locking, teleport-to-schedule on time skip.

What the engine DELEGATES to Daedalus scripts: which entries exist (the NPC's `daily_routine` function calls the `TA_Min` external once per entry), what each state does (walk to `self.wp`, sit, smith, sleep), which perceptions an NPC listens to and what each perception handler does, and when to call "continue routine". The `TA_<Activity>(self, h1, h2, wp)` helpers are script wrappers around `TA_Min`; only `TA_Min` is an engine external.

## 2. Files and functions (path:line)

| Concern | Location |
|---|---|
| Game clock tick, rate 14.5:1 | `game/gamesession.cpp:21-22` (constants), `:306-318` (`GameSession::tick`) |
| New game starts at 08:00 | `game/gamesession.cpp:74` |
| Time-multiplier knob | `game/gamesession.cpp:357` |
| `gtime` value type (ms since day 0) | `game/gametime.h:7-35` |
| Set time of day + teleport everyone | `world/world.cpp:390-402` (`World::setDayTime`) |
| Reset all NPCs and mobs to schedule | `world/worldobjects.cpp:974-1015` |
| Per-NPC reset to routine point | `world/objects/npc.cpp:478-520` (`Npc::resetPositionToTA`) |
| Routine entry struct | `world/objects/npc.h:423-431` |
| AI state struct | `world/objects/npc.h:439-448` |
| Add entry (sorted by start) | `world/objects/npc.cpp:4340-4355` (`addRoutine`) |
| Replace whole schedule | `world/objects/npc.cpp:4357-4361` (`excRoutine`) |
| Select entry for now | `world/objects/npc.cpp:3240-3273` (`currentRoutine`) |
| Routine waypoint for teleport | `world/objects/npc.cpp:3275-3279` (`currentTaPoint`) |
| Absolute end time of an entry | `world/objects/npc.cpp:3281-3302` (`endTime`) |
| Start / clear state | `world/objects/npc.cpp:2906-2971` |
| Player-allowed states whitelist | `world/objects/npc.cpp:2973-2999` |
| Per-frame routine/state driver | `world/objects/npc.cpp:3001-3062` (`tickRoutine`) |
| AI queue has priority over routine | `world/objects/npc.cpp:1879-1888` (`implAiTick`) |
| NPC frame order | `world/objects/npc.cpp:2334-2400` (`Npc::tick`) |
| Continue routine action | `world/objects/npc.cpp:2803-2805`, `:3381-3388` (`resumeAiRoutine`) |
| Start-state action keeps end time | `world/objects/npc.cpp:2528-2534` |
| Perception timer | `world/objects/npc.cpp:202` (default 5000 ms), `:4163-4180` |
| Active perception poll | `world/objects/npc.cpp:4188-4231` |
| Perception dispatch + range check | `world/objects/npc.cpp:4233-4256` |
| Sensing (see/smell/hear) | `world/objects/npc.cpp:4646-4705` |
| Near/far LOD + perception scheduling | `world/worldobjects.cpp:221-264` |
| Passive (broadcast) perceptions | `world/worldobjects.cpp:913-972` |
| Perception range table | `game/gamescript.cpp:75-87`, `:3316-3320` |
| Mob (furniture) routines | `world/worldobjects.cpp:25-36`, `:180-189` |
| Free-point search and lock | `world/world.cpp:907-947`, `world/waymatrix.cpp:245-294`, `world/waymatrix.h:52`, `world/fplock.cpp` |
| Script externals binding table | `game/gamescript.cpp:110-330` |
| NPC init calls `daily_routine` | `game/gamescript.cpp:505-522` |
| Script-side NPC fields | `ZenKit/include/zenkit/addon/daedalus.hh:178-219` (`INpc`: `daily_routine`, `start_aistate`, `senses`, `senses_range`, `wp`) |

## 3. Call graph

```
GameSession.tick(dt)
  -> clock advance (section 5.1)
  -> World.tick -> WorldObjects.tick
       -> classify each NPC by distance to player: Normal / Far / Far2
       -> for each near NPC: Npc.tick(dt)
            -> overlay AI queue, regen, waits
            -> movement (go-to), attack
            -> implAiTick: if AI queue empty -> tickRoutine, else run next queued action
       -> for each near, living, non-player NPC:
            if now >= percNextTime -> active perception poll
            if Normal policy -> deliver every queued passive perception
Script (inside a state or perception handler)
  -> TA_Min / Npc_ExchangeRoutine / AI_ContinueRoutine / AI_StartState / Npc_PercEnable ...
```

## 4. Data structures

RoutineEntry
- `start`: time-of-day (ms in [0, 86 400 000))
- `end`: time-of-day
- `state`: reference to an AI state (by its init-function id)
- `point`: resolved waypoint, or null; when null keep `fallbackName` (the raw string) so the state can still be started with that name.

The list is kept stably sorted by `start` ascending (ties keep insertion order).

AiState (the running state)
- `init`, `loop`, `end` function refs (looked up from the state's base name: X, X_Loop, X_End)
- `startTick` (real ms tick when started), `endTime` (absolute game time; default "end of time" = max int64)
- `started` flag (init already invoked), `loopNextTime` (real ms tick), `hint` (name, debug only)

Also per NPC: `prevState` (init-function id of the last state that actually ran), `perceptionTime` (ms, default 5000), `perceptionNextTime`, a table of perception handlers indexed by perception type (0 = none, valid 1..32), `nearestEnemy` cache.

Time value (`gtime`): signed 64-bit milliseconds since day 0 00:00.
- `day = t div 86 400 000`; `hour = (t div 3 600 000) mod 24`; `minute = (t div 60 000) mod 60`; `timeInDay = t mod 86 400 000`.
- Build from (day, h, m) = day*86 400 000 + h*3 600 000 + m*60 000.

Perception types (numeric ids, `game/constants.h:397-433`): 1 AssessPlayer, 2 AssessEnemy, 3 AssessFighter, 4 AssessBody, 5 AssessItem (active, i.e. polled); 6 AssessMurder, 7 AssessDefeat, 8 AssessDamage, 9 AssessOthersDamage, 10 AssessThreat, 11 AssessRemoveWeapon, 12 ObserveIntruder, 13 AssessFightSound, 14 AssessQuietSound, 15 AssessWarn, 16 CatchThief, 17 AssessTheft, 18 AssessCall, 19 AssessTalk, 20 AssessGivenItem, 21 AssessFakeGuild, 22 MoveMob, 23 MoveNpc, 24 DrawWeapon, 25 ObserveSuspect, 26 NpcCommand, 27 AssessMagic, 28 AssessStopMagic, 29 AssessCaster, 30 AssessSurprise, 31 AssessEnterRoom, 32 AssessUseMob (passive, i.e. event-driven). Count = 33.

State loop return values: 0 = continue, 1 = end (`game/constants.h:515-516`).

## 5. Formulas and constants

### 5.1 Clock (`game/gamesession.cpp:21-22, 306-318, 357`)
- `multTime = 14500`, `divTime = 1000`: 1 real ms advances game time by 14.5 game ms (rate 14.5:1). A full game day = 86 400 / 14.5 = 5958.6 real seconds (about 99.3 real minutes).
- Optional speed knob `timeMul` (default 1000 = x1.0): `scaled = dt*timeMul + carry1; carry1 = scaled mod 1000; dt' = scaled div 1000`.
- Then `add = dt'*14500 + carry2; carry2 = add mod 1000; gameTime += add div 1000`. Carries make the clock exact over time with integer maths.
- New game: game time = day 0, 08:00 (`:74`).

### 5.2 Choosing the current entry (`npc.cpp:3240-3273`)
Let `now = timeInDay(gameTime)`. Scan entries in sorted order; return the FIRST that matches:
- wrapping entry (`end < start`): matches if `now < end` or `start <= now`;
- normal entry: matches if `start <= now < end`.
- (An entry with `start == end` never matches in this pass.)

If none matches (gap in the schedule), fall back to the entry whose end was most recently passed: for each entry `d = now - end`, if `d < 0` add one day; pick minimal `d`; on ties pick the LAST one in list order (comparison is `<=`).
If the list is empty return an empty entry (no state).
Variant `assertWp`: same algorithm but skip entries whose waypoint did not resolve (used for teleporting).

### 5.3 Absolute end time of the chosen entry (`npc.cpp:3281-3302`)
Let `D = day(gameTime)`, `now = timeInDay(gameTime)`.
1. Wrapping (`end < start`): if `now < end` -> (D, end) else -> (D+1, end).
2. Normal (`start < end`): if `end.hour == 0` or `end < now` -> (D+1, end) else -> (D, end).
3. `start == end == 00:00` (scripts that zero-fill): -> (D+1, 00:00).
4. Otherwise (entry not active now): return the current game time (state ends immediately).

### 5.4 Perception
- Per-NPC perception period `perceptionTime` default 5000 ms (`npc.cpp:202`); script `Npc_SetPercTime(sec)` sets `sec*1000` ms (`gamescript.cpp:2239-2243`). Effective period = max(perceptionTime, 1).
- The same period is the state LOOP period: after each loop call, `loopNextTime = now + max(perceptionTime,1)` (`npc.cpp:3029-3030`).
- Range for perception p: `rangeTable[p]` if > 0 else the NPC's `senses_range` (`gamescript.cpp:80-87`). Table defaults to -1 for every type; script `Perc_SetRange(p, dist)` fills it (`:3316-3320`, ignores p outside 0..32). All comparisons use squared distance.
- Distance LOD (`worldobjects.cpp:221-239`): NPC within 3000 units of the player = Normal; within 6000 = Far; else Far2. Only Normal NPCs receive perceptions; Far/Far2 still run routines (Far2 NPCs with an EMPTY schedule skip the loop call when within 300 units of their current FP, `npc.cpp:3028-3040`).
- Sensing (`npc.cpp:4682-4705`): if squared distance > senses_range^2 -> nothing. Otherwise SMELL is always reported, HEAR only for "noisy" events (never set for the routine poll), SEE if the NPC has the see bit and a ray from its head to the target is unobstructed and the target is inside the view cone; the result is masked with the NPC's `senses` bit field (see = 1, hear = 2, smell = 4 per the Gothic convention; engine uses the same bitmask).
- View cone constant: cos(100 deg) (`npc.cpp:4664`). Donor comment says "plus/minus 100 deg". OPEN QUESTION: the literal arithmetic compares the facing angle against the direction from target back to the viewer and accepts when cos(delta) <= cos(100 deg); whether that yields +-100 deg or +-80 deg depends on the skeleton's forward axis. Implement +-100 deg about facing and capture a golden case before tuning.
- "Free LOS" checks (used for enemy/body search) skip the cone and only test the ray.

### 5.5 Free points (FP)
- Search radius `distanceThreshold = 800` units (`waymatrix.h:52`).
- Name match: exact, or substring (FP "BENCH_02" matches request "BENCH") (`waypoint.cpp:42-50`).
- Candidate filter: not locked (use-count 0), ray to a point 10 units above the FP is clear; nearest wins. If the NPC is already standing on a matching FP it is returned first (`world.cpp:907-922`). "Next FP" excludes the current one (`:932-947`).
- Lock = reference count incremented while an NPC is attached to the point and decremented on detach.

### 5.6 Mob (furniture) routines (`worldobjects.cpp:25-36, 180-189`)
Each scheme (e.g. a bench type) owns a list of (time, state) pairs. State for time t = the last pair with `time <= timeInDay(t)`, scanning from the end; if none, the LAST pair's state (wraps from previous day); empty -> 0. Applied each world tick when it changes, and on every time skip.

## 6. Order of operations

### 6.1 NPC creation (`gamescript.cpp:505-522`)
1. Instantiate NPC from script; 2. if `daily_routine` is set, call it with `self` = NPC. Each `TA_Min(self, h1,m1, h2,m2, state, wp)` call appends an entry (5.2 sorting). 3. Perception time set to 5000 ms; true guild initialised (see guild spec).

### 6.2 Per frame, per NPC (`npc.cpp:2334-2400`, `:1879-1888`)
1. Overlay queue, spell cast, HP/mana regen.
2. If waiting (AI wait / animation wait / speech output): only turn to target; stop.
3. Look-at, attack, go-to movement; if moving, stop (flee also ticks AI).
4. `implAiTick`: if the AI action queue is non-empty, run the next queued action and DO NOT touch the routine. Only when the queue is empty does `tickRoutine` run. (Donor test case: a priest praying at night via queued actions must not be overridden.)

### 6.3 `tickRoutine` (`npc.cpp:3001-3062`)
1. If no state is running and NPC is not the player: pick entry (5.2). If it has a state: start it with end time from 5.3 and `wp` = entry waypoint name. Else if the NPC has a `start_aistate`: start that with end time = now + 4 game hours.
2. If still no state: return.
3. If state not yet started: mark started, set `loopNextTime = now`, reset the perception timer to now (so perceptions fire immediately), call INIT, return (loop runs from next frame).
4. If `now >= loopNextTime`: schedule next loop (5.4), call LOOP (or treat as "continue" for G2 patch >= 5 when no loop fn exists; "end" for older versions).
5. If the state's absolute end time has passed AND the NPC has no combat target AND its speech output is finished: force END. (Prevents cutting off talk or attack.)
6. If loop result is END: run END function, remember it as previous state, clear other/victim. Next frame step 1 picks the new entry.

### 6.4 Start state (`npc.cpp:2910-2960`)
1. Invalid state -> fail.
2. Same state already running: if this is a normal (finalising) start, mark it "not started" so INIT re-runs (avoids soft-locks); update `wp`; done.
3. Otherwise: clear AI queue; clear current state (runs END unless "no finalise"); set `wp`; DISABLE ALL perceptions (the new state's INIT must re-enable what it wants).
4. Special waypoint "TOT" for non-near NPCs: teleport to the world's dead-point (script removal idiom).
5. If target is the player and the state is not in the whitelist (G2: ZS_DEAD, ZS_UNCONSCIOUS, ZS_MAGICFREEZE, ZS_PYRO, ZS_ASSESSMAGIC, ZS_ASSESSSTOPMAGIC, ZS_ZAPPED, ZS_SHORTZAPPED, ZS_MAGICSLEEP, ZS_WHIRLWIND) -> push "stand up" and fail.
6. Install state with `startTick = now`, `endTime` as given, `loopNextTime = now`.
- Script `AI_StartState` queues this action and PRESERVES the current state's end time (so ZS_GotoBed -> ZS_Sleep inside a TA_Sleep window still ends at the window end) (`npc.cpp:2528-2534`).

### 6.5 Interruption and return to routine
- A perception handler or script queues actions or starts another state (e.g. talk, flee, attack). The routine is not consulted while the queue is non-empty or a state runs.
- Script calls `AI_ContinueRoutine` -> queued; when executed: clear state (with END), pick entry for NOW, start it with fresh end time (`npc.cpp:3381-3388`). This is the return-to-routine mechanism; there is no automatic resume other than a state ending (6.3 step 6).
- `Npc_ExchangeRoutine(npc, "NAME")` builds the symbol `Rtn_NAME_<npc id>`, and if it exists: clears ALL entries and calls it (it re-adds entries via TA_Min). The running state is NOT ended; the new schedule takes effect when the current state ends or on continue-routine (`gamescript.cpp:2059-2069`, `npc.cpp:4357-4361`).

### 6.6 Time skip / sleep (`world.cpp:390-402`, `worldobjects.cpp:974-1015`, `npc.cpp:478-520`)
1. Target (h,m): if target >= current time-of-day, same day; else next day.
2. Reset mob routine states; for every NPC: detach from FP; then per NPC: dead NPCs without mission items are removed (dead dragons kept in G2); clear AI queue; stop anim and clear state WITHOUT end callback; take routine waypoint (5.2 with assertWp; NPCs without schedule use their `wp` field); if that point is locked by someone else use the nearest unlocked waypoint within 800; teleport, face the waypoint direction, snap to ground; attach to the point; re-equip weapons. NPCs with no resolvable point are moved to the dead-point holding list.

### 6.7 Active perception poll (`npc.cpp:4188-4231`)
Only for Normal-policy, non-player NPCs whose timer expired:
1. AssessPlayer: if handler enabled and the player is sensed (cone applies) -> dispatch.
2. AssessEnemy: if enabled, find nearest sensed hostile, non-down NPC (cached enemy reused if still sensed) -> dispatch; if dispatch fails clear cache.
3. AssessBody: if enabled, nearest sensed dead NPC -> dispatch.
4. Reset timer = now + period.
Dispatch (`:4233-4256`): refused while a state is installed but its INIT has not run; refused if distance^2 > range^2 (5.4); else call handler with `other` = sensed NPC, `victim` = optional.

### 6.8 Passive perceptions (`worldobjects.cpp:913-972`)
Engine events queue a message (type, position of sender, sender, other, victim, item). Next world tick, each Normal, living, non-player NPC except the sender receives it if within range of the SENDER's position; delivery ignores senses (vanilla behaviour). "Immediate" variant delivers in the same frame (used for enter-room and quiet-sound footsteps).

## 7. Edge cases
- Overlapping entries: first by start time wins (5.2).
- Schedule gaps: fall back to the most recently ended entry (5.2) - the NPC keeps doing its last activity.
- Entry `start == end != 0`: never matched in pass 1; can still win the fallback.
- End hour 00 for normal entries always ends next day.
- Player cannot be put into routine states; only the whitelist.
- An expired state is not ended while the NPC has a target or is mid-sentence.
- Starting a state disables every perception; a state INIT that forgets to re-enable leaves the NPC deaf and blind.
- Npc_ExchangeRoutine silently does nothing if the `Rtn_<name>_<id>` function is missing.
- `Npc_PerceiveAll` is a no-op (`gamescript.cpp:2647-2649`).
- Engine never emits DrawWeapon (24); scripts must detect threats another way (see guild spec 6.3).

## 8. Script externals involved (engine side implemented)
`TA_Min`, `Npc_ExchangeRoutine`, `AI_ContinueRoutine`, `AI_StartState`, `Npc_IsInState`, `Npc_IsInRoutine` (true only when the running state equals the current entry's state), `Npc_WasInState`, `Npc_GetStateTime` / `Npc_SetStateTime` (seconds), `Wld_SetTime`, `Wld_GetDay`, `Wld_IsTime(h0,m0,h1,m1)` (same wrap rule as 5.2), `Wld_SetMobRoutine`, `Wld_IsFPAvailable`, `Wld_IsNextFPAvailable`, `AI_GotoWP`, `AI_GotoFP`, `AI_GotoNextFP`, `AI_AlignToWP`, `AI_AlignToFP`, `Npc_IsOnFP`, `Npc_GetNearestWP`, `Npc_GetNextWP`, `Npc_SetPercTime`, `Npc_PercEnable`, `Npc_PercDisable`, `Perc_SetRange`, `Npc_SendPassivePerc`, `Npc_SendSinglePerc`, `Npc_CanSeeNpc`, `Npc_CanSeeNpcFreeLOS`.
Script-only (not in engine): every `TA_*` helper, every `ZS_*` state body, `B_*` perception handlers, `Rtn_*` schedule functions.

## 9. Plumbing to strip
Daedalus VM and symbol lookup (replace with TS function refs / enums), savegame serialisation, animation-system calls inside state start/stop, Far/Far2 LOD heuristics (keep only if our worlds are large), the "TOT" dead-point hack, the dialog-output pipe (replace with "is NPC speaking" flag), G1/G2 version switches, debug statics, physics ray (replace with our raycast), cutscene checks.

## 10. Golden cases (hand-derived)

Clock
1. Real dt = 1000 ms, multiplier x1, carries 0 -> game time +14 500 ms, carry 0.
2. Real dt = 1 ms, carry 0 -> +14 ms, carry 500; next 1 ms -> +15 ms, carry 0.
3. 24 game hours = 5 958 621 real ms (rounded).

Entry selection (schedule: A = 08:00-20:00 Smith @ "SMITH"; B = 20:00-08:00 Sleep @ "BED")
4. now 10:00 -> A. 5. now 20:00 -> B. 6. now 07:59 -> B. 7. now 08:00 -> A.

Gap fallback (schedule: A = 08:00-12:00, B = 14:00-20:00)
8. now 13:00 -> A (d_A = 1 h, d_B = 17 h). 9. now 21:00 -> B (d_B = 1 h, d_A = 9 h).
10. Two entries both ending 12:00, now 13:00 -> the later one in sorted order.

End time (day D)
11. A at D 10:00 -> (D, 20:00). 12. B at D 23:00 -> (D+1, 08:00). 13. B at D 07:00 -> (D, 08:00).
14. Entry 18:00-00:00 is a wrap (00:00 < 18:00): at D 19:00 -> (D+1, 00:00).

Time skip
15. Current D 22:00, `Wld_SetTime(8,0)` -> (D+1, 08:00), every NPC teleported to its entry point for 08:00.
16. Current D 06:00, `Wld_SetTime(8,0)` -> (D, 08:00).

Perception
17. senses_range 1500, Perc_SetRange(AssessTalk, 400), player at 500 -> talk perception refused; at 399 -> dispatched.
18. Range table entry 0 or -1 -> senses_range used.
19. State just started (INIT not yet run) -> any perception dispatch returns false.

Interrupt and resume
20. NPC in A (Smith) at 19:50 is attacked; combat state runs until 20:10, then script calls AI_ContinueRoutine -> picks B (Sleep) with end (D+1, 08:00), NOT A.
21. State A expired at 20:00 while NPC is speaking -> stays in A until speech ends, then ENDs and B starts.

Capture later: a headless OpenGothic run is not possible without game data. Capture these via our own TS implementation against a fixture schedule (pure functions: clock step, entry pick, end time, Wld_IsTime), and for cases 20-21 a scripted NPC fixture in a unit test with a fake clock. If Gothic II data ever becomes legally available to Dom, log `currentRoutine` and `endTime` per NPC on a time skip.
