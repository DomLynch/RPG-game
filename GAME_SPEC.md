# Frankendom: Origins

## The promise
My fighter, my build: I return between duels to develop a recognisable character, refine a chosen set of skills, and earn equipment that changes my tactics and appearance; the next fight tests the fighter I have shaped.

Browser-first, short competitive 1v1 encounters within a persistent Mythic Arena RPG. MMORPG-style character identity and progression do not imply an open world or MMO infrastructure in the prototype.

## Setting
A ruined arena at the edge of worlds, where champions and creatures from dead civilisations are pulled in to fight.

The arena is the entire framing device. It explains 1v1 duels, crowd and reputation, gear earned in blood, creatures in the pit, brutal deaths and a fighter's permanent record. There is no overworld. Different arenas are the same 18 m combat circle dressed differently (Greek marble, Roman sand, Norse timber, underground goblin pit, Gothic blood arena).

## Pitch
Mythic Arena RPG. Build a fighter across hundreds of battles. Collect weapons, armour, scars and trophies from warriors and creatures drawn from lost civilisations. Every fight changes your reputation; every opponent fights differently.

Comparable: For Honor proves the appetite for multi-culture melee duels; Shadow Fight 4 is the mobile incumbent. Frankendom's differentiation is a browser link into a duel in seconds, on a phone, with a persistent scarred fighter and visible history. The concept alone is not the differentiator; the access model and the fighter's history are.

## Simplicity rule
Built for a phone and for a player who reads nothing. Anyone must understand the whole game in 30 seconds:
- One fighter. One arena. One opponent at a time.
- Four principal controls: Light, Heavy, Guard, Dodge (tap Guard just before impact to parry). Depth comes from contextual rules — hold, timing, state — never from a fifth memorised button.
- Five stats. Three things to collect. No hidden systems.
- If a feature needs a tooltip to be understood, it is cut or moved to NOT NOW.

## Art direction
Tone: ancient, brutal, ceremonial, supernatural. Grounded human proportions. Exaggerate poses for readability on a 6-inch screen, never proportions.

Materials rule (coherence comes from what is absent): bronze, iron, bone, leather, stone, ash, blood. No polished fantasy plate, no saturated colours, no glow, no cartoon proportions, no oversized novelty weapons. Worn metal must still respond to light: "no polish" does not mean flat. Mixed civilisations stay one world because they share this palette.

Readable brutality over spectacle binds every visual: if an effect obscures either fighter's pose, timing, weapon or footwork, it is too large.

Visual references (inspiration only; no game assets copied): Ryse: Son of Rome for Roman arena and bronze/iron kit; 300 for Greek bronze and restrained colour; Gladiator for arena ceremony, crowd and sand; For Honor for multi-culture melee silhouettes. The earlier Elder Scrolls Online and Black Desert references are retired.

These define a direction, not a promise of native AAA fidelity on a mobile browser. Phase 0A used capsule proxies; the first character pass used a CC0 Quaternius humanoid with original plate armour; character pass v1 (2026-09-14, PROJECT_STATE) replaced that plate knight with the whole CC0 body and a level-1 gladiatorial kit on the same skeleton, holding the animation and blade-path contract. Capsules remain only as a loading/failure fallback. No art pass waives the hardware/usability gate.

## Product defaults
- One persistent fighter. Start as a neutral longsword wielder. No classes in the initial combat test.
- Earn specialisation and equipment sidegrades; equal starting combat power. Fixed skill budget and free early respecs. Ranked power cannot depend on grind or purchases. These are provisional defaults to validate after 0B.
- Long-term loop: duel, inspect what failed, change a skill/equipment trade-off, duel again. Appearance and reputation carry continuity.
- Phase 0A identity is device-local, with a saved guest ID and chosen name. Explicit warning if storage fails. No fabricated levels, currency, inventory, match history or D1 analytics.
- Before a real progression/retention test, server-owned character state with persistent guest credentials and optional account recovery. Clearing browser credentials or private browsing can lose guest access; local storage alone is not recovery.
- No artificial retention incentives in the first rematch test.

## Your fighter: Origins
Players are human fighters with an Origin. In v1 an Origin is a visual and equipment family on the shared skeleton, not a separate species: it sets starting silhouette, armour family, weapon family and idle/salute style. It changes how you look and what you start with, not how strong you are.

Initial Origins: Hoplite (bronze, spear, shield, disciplined), Northman (fur, axe, aggression), Pitborn (bone, crude iron, dirty fighting), Nightborn (gothic, vampiric, elegant), Imperial (Roman, gladiatorial, sword and shield), Wildblood (wolf, totem, barbarian). All human, one skeleton. Playable monsters come later, if ever: different body shapes multiply animation, hitbox and balance work.

## Opponents: every species alters gameplay
An opponent that does not change how the fight is played is a reskin and is not added. Each is a distinct silhouette and fighting style that exercises an existing mechanic:
- Hoplite — shield and spear: get around the guard; teaches guard-break timing, angles and closing distance.
- Orc — never stops swinging: teaches stamina management and parry.
- Goblin — small, fast, feints, never guards: teaches reading the tell.
- Vampire — parries everything: teaches restraint and baiting.
- Berserker — big hits, shrugs off stagger: teaches dodge and punishing recovery.
- Werewolf — lunges, never guards: teaches pre-emptive strikes and spacing.
- Cyclops — huge and slow, one weak spot: teaches locational hits as the win condition.

Roster order: Human → Hoplite → Orc → Goblin on the shared humanoid skeleton with reproportioning. Cyclops, Werewolf and Minotaur are marquee content after the game works: a scaled human with one eye reads as cheap, and large opponents break the locked camera framing, hit capsules and tell readability that are tuned for equal-height fighters. Public-domain folklore and mythology only; no trademarked bestiaries.

## Collect
Collection loops: combat (weapons/builds), visual (armour/trophies/scars), achievement (titles/records). No power grind. Three layers only — no rarity, upgrade or gem multipliers.
- Weapons are the primary gameplay collectible: each is a distinct move set, reach, timing profile and guard type (longsword first; spear, sword and shield, axe, daggers, mace later). Armour and relics modify the weapon archetype; they do not create new combat systems.
- Trophies from defeated creatures are worn visibly (cyclops eye, wolf pelt, orc tusk, vampire fang) so opponents read a fighter's history before the fight. Locational wounds leave persistent scars. The fight record is public.
- The mythology expands the collection fantasy; it must not expand the underlying combat system uncontrollably.

## Stats
Stats: STR / DEX / VIG / END / POISE, 50 points, no stat touches timing.
- Strength: damage and guard pressure. Dexterity: stamina efficiency and weapon requirements. Vigor: health pool. Endurance: stamina pool and regeneration. Poise: stagger resistance.
- Everyone has 50 points, forever. More builds can be unlocked; more points cannot. Free early respecs. Provisional example builds: 15/8/10/10/7 and 6/16/8/13/7.
- Rule: no stat changes attack, parry, roll or wind-up timing. Timing constants are global per weapon so learned tells stay valid and online balance stays tractable. Stats become data with stable IDs when equipment gameplay is authorized, per the architecture rules below.

## Deaths
Where the blade lands decides the death: head, neck, waist. Lethal outcomes are locational and earned — the simulation's blade contact location, attack type and direction select the finish. Gore is presentation driven by simulation events and never affects the fight. A gore toggle and a dark/desaturated blood mode ship with it so clips remain shareable. Tone is grounded and brutal (real weapons, real wounds), not cartoon stylisation.

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
Full combat validation until gate 0A passes; multiple weapons/classes; full RPG progression until combat is worth repeating; open world; PvE campaign; guilds; chat; trading; crafting; auction house; matchmaking ladders; monetisation; leaderboards; speculative backend/frameworks; full rollback implementation; seasons and seasonal history (live-ops, backend and content velocity); species as player; non-humanoid rigs; additional combat systems beyond the current light/heavy/guard/parry/dodge/stamina/locational-contact set; a character creator.

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

## Owner-authorized combat core — 2026-09-14
Owner brief: a second developer owns core combat as a deterministic, data-driven, input-agnostic simulation that visuals consume and never decide; first target is the single-player 1v1 slice against AI, with no matchmaking, accounts, inventory, progression or networking. The visual developer plugs assets and animations into the same combat state and events later.

Architecture: `moves.ts` (data: MOVES, PATHS, RULES, AI PROFILES) → `duel.ts` (symmetric two-fighter engine: Intent → stepDuel → Duel with per-tick events) → `ai.ts` (utility controller emitting the same Intent) → `combat.ts` (Practice: the read-only renderer/HUD view over the duel, legacy constant views, hints, debug readout). Both fighters obey one rule set through one API; the warden pays the same stamina, blocks, parries and rolls by the same timings. Simulation modules are lint-guarded against randomness, clocks and browser state. Baked blade tables are generated per (clip, timing) from PATHS; the rig-agreement test is the tripwire when clips change.

Provisional rules (all tuning candidates): windup/active/recovery per move in ticks — right cut 14/5/21, left cut 14/5/21, chained cut 12/5/17, heavy overhead 32/5/31, riposte 12/5/19, kick 18/1/25. Damage 25/25/38/40/8; stamina 20/20/35/20/25. A single Light button alternates sides; swipes choose the side; the opposite cut inside an 18-tick window chains fast. Guard blocks a facing light for 25 stamina, breaks below it; heavy and riposte break a standing guard; kick opens a guard for 45 stamina and a 36-tick stagger. Fresh-press parry window 10 ticks, cooldown 30, attacker stunned 90 with one riposte allowed; parry exposure (`parryRecovery`) and directional guard exist as rules but are off. Roll 36 ticks, safe 4–20, cost 30. Stamina regenerates 0.4/tick after a 60-tick delay, never while guarding; reaching 0 is an exhausted state (no attack, guard or roll, walking speed ×0.7) until 20. Heavy carries poise from tick 24 through its active window: a light then trades damage but does not interrupt it. Clean hits stagger 24 (kick 18), shove the target and wound for 240 ticks. Head/torso/leg multipliers exist and are all 1.0.

Warden: easy/normal/hard profiles change only reaction delay, prediction accuracy, parry and roll rates, aggression, light pressure and stamina discipline — never move data. At easy and normal every non-punish attack is a readable heavy or kick; lights punish whiffs, staggers and exhaustion or chain. A less aggressive warden sometimes baits with a visible guard. It notices an attack only after its reaction delay, ignores swings that cannot reach, and reads committed state only.

Not claimed: validated feel, phone/hardware gates, online timing, or that these numbers are final. Symmetric damage makes the warden as lethal as the player (three heavies), a deliberate change from the 20-damage training warden that the owner should evaluate in play.

## Owner-authorized swordplay pass (player lane) — 2026-09-15
Owner reviewed the combat core and authorized P1–P5 for the player's swordplay; the warden is out of scope except where a shared rule applies to it automatically. Every number is data in `moves.ts`; every rule has a discriminating test and a mutation receipt.

P1 — guard that yields, feint, exposure. A guard yields to any action (light/heavy/kick/roll start the same tick from a held guard; a light pressed while holding guard from ready wins over the hold). A fresh guard press inside a swing's first `feintUntil` ticks (light 6, heavy 10, riposte 6, kick never) abandons the paid-for swing into a guard with a parry window, for `feintCost` 10 stamina; on parry cooldown it becomes a plain guard. `parryRecovery` is now 8: a fresh parry that meets nothing leaves the fighter unable to guard for 8 ticks (a connected parry, proven by its punish window, is never punished). `Fighter.guardProfile` (costScale, arc, window, stopsHeavy) is the seam for shields as a paid/level add-on later — resolved against RULES defaults at contact time; no shield content or UI yet.
P4 — buffer everywhere. One queued action is accepted in the last `bufferWindow` (now 10) ticks of every committed phase — swing, draw, roll and stagger — and fires on the first legal tick (TTL 11). Death has no tail. Cancellation semantics unchanged.
P2 — backstep. A new evade with no invulnerability: 12 ticks, 0.6 m straight back along the facing (heading unchanged), 10 stamina; its last 4 ticks cancel into a light or heavy; holding the dodge control grows it into a roll for the price difference (20). Controls: Dodge/`E` tap = backstep instantly on the press, hold ≥150 ms = the step becomes a roll; swipe-down still rolls directly. The roll therefore starts ~150 ms after the press when reached through the button — a deliberate trade of roll reactivity for positional evasion; swipe mode keeps the instant roll. The warden uses the same backstep when it can neither parry nor roll an unblockable swing.
P3 — chain grammar and finishers. A heavy started inside a light's chain window winds up in 22 ticks instead of 32 (same active/recovery, still parryable and guard-breaking; its own baked blade table). A light started from a backstep's tail or within 2 ticks after a roll or backstep ends uses its chained timing (12-tick wind-up) — the dodge-attack. During the punish window after a parry, light is the 40-damage thrust and heavy is a 48-damage heavy riposte (20/5/25, 35 stamina, breaks guard, parryable). All timings are data in `moves.ts`; the two new paths are baked from the Heavy clip.
P5 — perfect block. A block landing within the first `perfectBlock` (3) ticks of a *held* guard (never inside a parry window; a fresh press that outlives its window is exposed instead) costs `perfectBlockCost` (half) of the normal stamina. No damage or stagger change — that is what the parry is for. `Blocked` events carry `stamina` and `perfect`; the HUD reads "Perfect block · −13 stamina". The warden benefits from the same rule.

## Owner-authorized Souls slice — 2026-09-15
Owner direction: Souls-length duels (8–15 meaningful hits, at least 20–30 s), decisions over animations, no knockdown, weapon families only once the longsword loop is excellent. Backstab is *not* a ×2 rear-arc rule (latency/facing cheese online); rear hits get a modest bonus now and an earned critical later.

Slice I — duel length. Damage retuned by measurement (AI vs AI, 24 seeds per level): light 25→11, heavy 38→18, riposte 40→24, heavy riposte 48→30, kick 8→4. Result at normal: median 35 s and 9 clean hits (5–12); hard 20 s; easy 37 s. Health stays 100. The browser gate's pinned numbers moved with the data (riposte → 76, kick → 72) and are documented as such.

Design principles adopted with the slice (owner + external review, 2026-09-15):
- Frankendom is the hybrid: **skill wins mismatches; builds win margins** (~60 % execution, ~20 % build/stats, ~20 % weapon/gear; three layers only — no rarity/upgrade/gem multipliers). Progression unlocks possibilities; it never grows the total power budget.
- **Readable commitment combat**: four principal controls (Light, Heavy, Guard, Dodge); depth comes from contextual rules (hold, timing, state), never from more buttons or memorised sequences. Every new mechanic must create a decision, not an animation.
- Combat DNA: Souls/Sekiro decisions with mobile-forgiving timing; For Honor reads/feints/spacing without three-way manual guard; Mortal Kombat impact only in feel (hit-stop, recoil, sound, criticals); Assassin's Creed only for executions and transitions.
- **Readable brutality over spectacle** (binds the visual lane): if an effect obscures either fighter's pose, timing, weapon or footwork it is too large; 80 % animation/contact, 15 % subtle feedback, 5 % cinematic reserved for criticals and executions. No trails, splashes, glow spam or shake on ordinary contact.
- Future signature candidate, not yet designed: momentum/dominance built by perfect blocks, counter-hits, feint punishes and guard breaks, reset by being punished — feeding crowd, criticals and reputation without a new control.

Slice A — counter-hit and rear hit. A clean hit on a fighter committed to a swing (any phase of it) or in the vulnerable tail of a roll deals ×1.25 and staggers ×1.5; a clean hit inside the target's rear 90° arc deals ×1.15 and staggers ×1.25; the two multiply. Neither applies through a guard, a parry or a perfect block. The ×2 rear-arc backstab was rejected as latency/facing cheese; an earned critical (staggered/broken/exhausted target + behind + suitable attack) is deferred.
Slice D — guard counter. A block (perfect or not) opens a 20-tick window in which Heavy becomes `heavy_counter`: 20/5/25 on the heavy riposte's baked path, 20 damage, 30 stamina, 30 stagger, breaks guard, poise from tick 4 so a light cannot interrupt it. Any attack consumes the window; a stagger closes it; a parry's punish window outranks it. Blocking is now a decision: spend the opening or reset.
Slice C — thrust and the weapon-disc control trial (owner + external review, 2026-09-15). **Thrust** (`thrust`, T on a keyboard, ↑ on the disc): the Riposte clip's path at 16/5/21, damage 14, 25 stamina, a walking-pace lunge (stepIn 1) so it lands from 2.0 m where a cut needs 1.75 m and a heavy needs 32 ticks; fully blockable (chip 0, 25 stamina), parryable, a riposte inside the punish window; the spacing and counter-hit tool, never the guard opener. **Chamber**: every plain cut, thrust and heavy has a `chamber` tick (6 / 8 / 10) at which a *held* swing pauses for up to RULES.charge.max ticks — the load is the tell — and from which it can still be feinted; only a move that `charges` (the heavy) gains hyper-armour there and becomes the charged swing after RULES.charge.min held ticks. A chambered light is a bait, not a guard breaker: the warden blocks it and keeps a planned block. **Control trial** (menu → Controls, persisted per device): *buttons* (v0, today's Light/Heavy/Step/Guard/Kick); *disc · flick (v1)* — a stroke on the weapon disc is the strike (← → cuts, ↑ thrust, ↓ heavy; diagonals resolve to the nearest axis), never chambers; *disc · drag & release (v2)* — the stroke loads the swing at its chamber, release strikes, returning to the centre feints, a long hold releases itself before any charge; *disc · drag & release · hold to charge (v3)* — v2 plus the heavy's charge. *invisible field (v4)* — no disc: the right half of the arena is the attack surface (the left half still orbits the camera); a faint ring appears only under the thumb; v3's grammar (flick direction, hold to load/charge, back toward the origin to feint). Commitment in every grammar is *duration* (how long the thumb stays down), not stroke length: the engine has no horizontal heavy, so "long flick = committed slash" would need new moves — a later slice if v4 wins. Guard, Step and Kick stay buttons in every disc scheme. The owner prefers v1 so far (2026-09-15). The journal shows a per-scheme scorecard (fights, wins, rematches, average duel length, damage dealt/taken) — the owner's "would I duel again after ten fights" number. Direction chooses the attack; stroke length and time choose commitment. Diagonal cuts, an uppercut (needs a rig clip), hammer/spear/axe disc grammars and a contextual kick are later.

Slice F — guard vs heavy (owner playtest 2026-09-15: "I hold guard and still take the same damage"; "hold heavy is the same as click heavy"). A standing guard now takes a plain heavy for **chip** (40 % = 7) and 40 stamina with no stagger and opens the guard counter; a perfect block stops the chip. A guard *breaks* (full damage, −60 stamina via RULES.breakCost — one roll is left from a full bar — and stagger) only to a **charged heavy**, a riposte-family swing, a kick, or when the defender cannot pay the block. The charge press is now deliberate: a press under 0.17 s never holds, ≥ 0.67 s charges, and the hold releases itself at ~1.07 s (RULES.charge {at 10, min 30, max 54}); a `Charged` event fires once, the HUD says "Charging… / Charged · breaks a guard", a warm point light on the charging fighter turns white when charged (placeholder for the visual lane's VFX), and a low tone marks the charge. The warden throws a *held* heavy at a settled guard 20/40/60 % of the time by level (`aggression − .25`), releasing the moment it is charged (readable: the release timing is fixed); its other heavies at a guard are plain and get blocked for chip; it blocks plain heavies it can afford, and drops a planned block the tick it sees the swing charging.

Slice E — charged heavy. Holding Heavy pauses a plain heavy's wind-up at tick 10 (the blade stays raised; the same clip pose holds, so no new animation) with hyper-armour: lights land as counter-hits but do not interrupt. Releasing after ≥12 held ticks — or automatically at 40 — swings for ×1.5 damage and ×1.5 stagger (guard breaks included). Early release is an ordinary heavy. A feint is still possible from the charge (`feintUntil` 11), so a charge can bait a guard. Chained, riposte and guard-counter heavies never charge.

## Owner decisions — Origins direction (2026-09-13/14, recorded 2026-09-15)
Title: Frankendom: Origins. Setting line, pitch, simplicity rule, art direction with the materials rule, Origins list, roster order, collection loops and the five-stat model adopted as written above. Art direction changed while cheap; the retired ESO/Black Desert references and "medieval plate" language no longer bind any lane. The character lane's request #1 (stale art-direction text) is closed by this section. The next engineering deliverable remains one polished exchange — approach, strike, block, parry, counter — ahead of any roster or weapon expansion.
