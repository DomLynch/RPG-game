# Frankendom — working title

## The promise
My fighter, my build: I return between duels to develop a recognisable character, refine a chosen set of skills, and earn equipment that changes my tactics and appearance; the next fight tests the fighter I have shaped.

Browser-first, short competitive 1v1 encounters within a persistent medieval fantasy RPG. MMORPG-style character identity and progression do not imply an open world or MMO infrastructure in the prototype.

## Art direction
Grounded proportions, practical armour, steel, worn leather, weathered stone, restrained heraldry and natural cinematic lighting. No punk, neon, cartoon proportions or oversized novelty weapons.

Visual references, researched 2026-09-13 (inspiration only; no game assets copied):
- Elder Scrolls Online, One Tamriel: grounded fantasy places and duel framing. https://www.elderscrollsonline.com/en-us/updates/update/onetamriel
- Black Desert, original Warrior: conventional longsword, believable metal armour and restrained character silhouette. Exclude its extreme awakening effects. https://blackdesert.pearlabyss.com/Console/en-us/Game/Classes?_classType=0

These define a direction, not a promise of native AAA fidelity on a mobile browser. The initial Phase 0A used capsule proxies and an original geometric environment. After owner movement feedback, the authorized character pass uses a CC0 Quaternius humanoid foundation with original armour and four coherent movement clips. Capsules remain only as a loading/failure fallback. This art pass does not waive the remaining hardware/usability gate.

## Product defaults
- One persistent fighter. Start as a neutral longsword wielder. No classes in the initial combat test.
- Earn specialisation and equipment sidegrades; equal starting combat power. Fixed skill budget and free early respecs. Ranked power cannot depend on grind or purchases. These are provisional defaults to validate after 0B.
- Long-term loop: duel, inspect what failed, change a skill/equipment trade-off, duel again. Appearance and reputation carry continuity.
- Phase 0A identity is device-local, with a saved guest ID and chosen name. Explicit warning if storage fails. No fabricated levels, currency, inventory, match history or D1 analytics.
- Before a real progression/retention test, server-owned character state with persistent guest credentials and optional account recovery. Clearing browser credentials or private browsing can lose guest access; local storage alone is not recovery.
- No artificial retention incentives in the first rematch test.

## Controls and camera
- Landscape is the preferred phone layout; portrait remains operable. Desktop keyboard/mouse supported.
- Movement: WASD/arrows or left thumb stick. Shift/hold Run to sprint in 0A. Drag world view to orbit. Camera button toggles follow/duel lock; R recentres.
- Follow: elevated third-person, camera-relative input, no head bob or shake.
- Duel lock: player, fixed opponent and camera form a triangle; camera sits behind player and frames both. Resolve near-zero separation without a camera flip. No manual camera requirement while locked.
- Phase 0B: four dedicated combat buttons: light, heavy, dodge, guard/parry. Guard touch-down opens parry window immediately, continued hold guards. No tap/hold attack disambiguation. Sprint mapping will be reconsidered before adding four combat buttons.
- Touch cancellation, focus loss and hidden tabs clear inputs and accumulated time. No background catch-up movement.

## Phase 0A — movement and camera gate (up to two weeks, not a waiting period)
One 18 m diameter flat circle. No collision obstacles, cover or vertical gameplay. Decorative architecture stays outside the play boundary. Arena size is a tuning hypothesis; it does not alone solve retreating.

Deliverable: publicly accessible movement trial, touch + keyboard controls, camera toggle, guest name persistence, renderer failure state, simple performance readout and concise controls. No attacks or simulated PvP.

Provisional minimum devices: iPhone 12 Safari and Pixel 6 Chrome, current stable browsers. iPhone 15 is an additional convenient test device, not proof of minimum support. WebGL2 required. Target 60 fps at adaptive/capped resolution. Gate: sustained median >=55 fps and p95 frame time <=25 ms over five active minutes on both minimum devices, plus no reproducible input/camera failure. Emulation cannot pass the hardware gate.

Usability gate: recruit 5–10 relevant players in week one; at least five external testers, including touch users. At least four of five can move, circle the target and toggle/recentre the camera within 60 seconds without coaching. No repeated loss of target, stuck movement or camera discomfort. Capture actual counts and device/browser details. Any recurring critical issue blocks 0B. One bounded revision/retest, then change approach or stop.

## Phase 0B — combat gate (up to four further weeks)
One sword, one rig, one coherent animation source, one arena. Clip checklist: idle, walk, run, light 1, light 2, heavy, dodge, guard, guard impact, parry, riposte, hit front, hit alternate, death (14 clips). Verify export/retargeting, rig, in-place locomotion, timing coverage, mobile weight and commercial web-distribution licence before purchase. Identify pack during 0A; purchase requires owner authorization and does not block capsule work.

Real online 1v1 is required before the gate decision. Authoritative server owns combat. Test at 40/80/120 ms RTT and jitter/loss; exact acceptable latency and combat timings remain experimental. Local feel alone cannot validate network parrying.

Primary signal: voluntary rematch after a loss, denominator = eligible completed losses where both players can rematch, with distinct-player counts and repeat losses reported separately. Do not count prompted, rewarded, disconnected or unavailable-opponent cases as comparable observations. Supporting signals: perceived fairness, input frustration, and voluntary return. Five to ten people diagnose issues; they do not establish population retention.

Provisional progression gate: >=6 of 10 distinct losing testers independently opt for another match, no recurring severe fairness/input issue at target network conditions, and at least five return voluntarily during a later scheduled opportunity. Report opportunity constraints and raw counts. These are decision rules, not statistical proof. Recruit beyond only Souls enthusiasts to include old-school RPG/PvP players.

## Architecture and budgets
- Three.js renders; pure TypeScript owns simulation. Three.js is a rendering library rather than a complete game engine: https://threejs.org/manual/en/game.html
- Considered Babylon.js (broader built-ins), Three.js (small explicit surface), and native-engine web export (larger platform/toolchain commitment). Choose Three.js for bounded 0A; reassess only if a measured limitation warrants it.
- Fixed 60 Hz timestep; movement/collision as plain math; reproducible input replay tests. Render interpolates previous/current state. Animation never drives gameplay. No engine physics, renderer imports, browser storage or clocks in simulation.
- Rollback-ready boundaries, not implemented rollback. Do not spend prototype time proving cross-runtime floating-point determinism.
- Item definitions become data with stable IDs and explicit modifiers when needed. No per-weapon code forks or unbounded generic systems.
- Compressed shell <5 MB; fight-critical content 10–20 MB maximum, loaded before the first duel; stream optional content after. Measure shell and fight-ready separately under cold-cache mobile conditions. 0A does not need to consume those budgets.
- Pin dependencies and use local build assets; no runtime third-party CDN dependency.
- Deploy static 0A via isolated Nginx virtual host, HTTPS, atomic release symlink, source revision receipt, rollback to previous release. No new daemon required.

## NOT NOW — known and deliberately deferred
Full combat validation until gate 0A passes; multiple weapons/classes; full RPG progression until combat is worth repeating; open world; PvE campaign; guilds; chat; trading; crafting; auction house; matchmaking ladders; monetisation; leaderboards; speculative backend/frameworks; full rollback implementation.

Blood Duels: undefined, deferred, and no economy/stakes implementation authorized. No real-money wagering.

Cheating: authoritative damage validation does not stop input automation. Reaction-time distribution analysis is only one possible signal; anticipation, network timing and adaptive bots confound it. Defer detection implementation, document server telemetry requirements before economy work, and never auto-ban from one timing heuristic.

## Scope and next decision
First answer: is moving this fighter around another fighter comfortable on a phone? Second: is a fair loss followed by another wanted fight? Third: does shaping the fighter make people return? Do not treat one answer as evidence for all three.

## Owner-authorized first-hit slice — 2026-09-13
Proceed with local longsword draw/attack, range/facing validation, hit reaction, health, defeat and reset after the baseline sync and code audit. This authorizes development ahead of the outstanding hardware/usability gate, not a passed gate. The opponent is a stationary training warden. Heavy/dodge/guard/stamina, opponent AI, online duels and builds follow separately. Animation observes pure fixed-tick combat state. No retained rewards, fake match history or rematch analytics from this training target.

## Owner-authorized defensive practice — 2026-09-13
Owner confirmed the mobile zoom fix and authorized defensive combat. Add directional dodge/roll, held sword guard, timed parry, stamina, player damage/defeat and instant rematch. The local warden holds its position and counterattacks with a visible wind-up and committed aim. This is a defensive practice opponent, not an online duel or a completed combat gate. Light attack remains the existing attack; heavy, kicks, advanced enemy AI, progression and networking remain deferred. Reuse the licensed Roll clip and author Guard on the same rig. No new dependencies or purchases.

Provisional defence: roll 600 ms with invulnerability at ticks 4–20, costs 30 stamina; parry window 10 ticks on a fresh guard press, 30-tick cooldown; held guard blocks frontal hits for 25 stamina, breaks below that cost. Light attacks cost 20. Stamina regenerates while ready after a one-second spending delay; guarding prevents regeneration. Running drains stamina. Warden damage 20; contact 600 ms after wind-up, recovery until tick 100, 90 ready ticks before another attack. A parry staggers the warden for 90 ticks. All values are tuning candidates, not validated network timings.

## Owner-authorized combat feel upgrade — 2026-09-13
Implement in order: (1) weight/responsiveness, eased transitions, short input buffering, original sound and restrained impact effects; (2) two-hit light chain, heavy attack, step-in movement, directional dodge and parry counter; (3) approaching/circling/retreating warden with readable defence and varied deterministic decisions. These supersede the stationary-warden/heavy deferrals above for local practice. No kicks, network or progression in this pass. Keep camera steady. Prefer visible state-based defence to hidden random damage cancellation. Audit each pass before moving on; phone/browser performance gates remain unpassed.

## Owner-authorized polished exchange and Claude review integration — 2026-09-13
Target one convincing exchange: approach, strike, block, parry, counter. Refine existing character motion and contact before adding systems. Bake the rig's blade trajectories offline into immutable simulation data; test the swept blade against an upright body capsule within a short active window, resolving each swing once. Renderer bones never own hits. This is bounded swept contact, not physical blade binds, locational wounds or cross-runtime determinism.

Buttons stay the baseline. An optional, session-local mobile swipe trial maps horizontal strokes to the existing light chain, up to heavy, down to dodge. Guard/parry stays a dedicated immediate control to avoid tap/hold/swipe ambiguity. This is a hybrid control experiment, not four directional stances or a passed usability test. Menu permits switching back without restarting; interruptions clear gesture state.

The current CC0 source lacks strafe/block-impact clips. Original authored lateral footwork, armed walking, hip/spine anticipation and recoil can improve the prototype without purchases; do not label them motion capture. A coherent licensed motion set remains a candidate for the next quality step, subject to rig, clip and web-distribution review and purchase authorization. The earlier generic retargeting code does not establish Mixamo compatibility.

Keep challenge links and optional shareable replays in the product roadmap after local feel and early authoritative online timing tests. Defer continuous recording, cinematic slow motion, finishers, wounds, ragdolls, cloth, post-processing and renderer migration until each earns its device budget. No virality, 3-second loading, 120Hz, iPhone 12 performance or rollback claims without direct evidence.

## Owner-authorized kicks, wounds and blood — 2026-09-13
Owner explicitly expanded the current combat pass to kicks, wounds and blood/effects, superseding those earlier deferrals. Free CC0 or original work only; no purchases. One immediate compact Kick button (C on desktop) joins the four core actions; no tap/hold delay. Close-range kick costs 25 stamina, contacts at tick 18, recovers at 44, deals 8 damage and opens a guarded opponent more strongly than an unguarded one. No kick wounds or blood.

Unguarded sword contact wounds either fighter for four seconds, reducing stamina regeneration 20%, refreshing without stacking. No permanent saved penalties; rematch resets. Coarse head/torso/leg regions along the upright collision capsule supply wound/kill presentation data, not per-limb anatomy or independently aimed headshots. Deterministic lethal events retain victim, region, attack and heading.

First effects layer: reuse 12 spray particles; pool 12 floor splashes fading over 20 seconds, cleared on rematch. Original alpha sprites; blood red/dark/off in the shared menu. Blocks/parries produce steel sparks, kicks blunt dust, cuts blood. Presentation-only impact pause stays brief; no simulation slow motion, camera cuts, FOV punches or lens overlays. Split geometry, detachable heads/limbs, torso cuts and paired fatalities remain the next separately reviewed animation milestone. Do not claim this layer implements dismemberment or full per-limb wounds.

Defensive presentation refinement: confirmed block/parry results select original BlockImpact/Parry/Deflected clips. Their short visual reactions never delay a newly accepted counter or alter simulation timing. A real-browser workflow is part of the required quality/release gate, including exact heavy-swipe cost and graphics restoration.
