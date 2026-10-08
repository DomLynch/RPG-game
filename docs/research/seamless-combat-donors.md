# Seamless combat entry: what the donor games do

Combat lane, 2026-10-09. Asked by Lead (Dom: "see how they do seamless mmo realtime combat, then we take the best code, learnings and write that in"). Read on the VPS at `/mnt/frankendom-donors`; every `file:line` below was read there (a sample of six was re-checked by hand after the readers finished, and all six matched). Lines marked INFERRED were reasoned from the code around them, not read. The client side of every donor but Veloren and Ryzom is closed or not in the repo, so "the camera does not change" is INFERRED from the server never sending a mode change.

Donors read: Veloren, ModernUO, EQEmu, AzerothCore, 2004Scape-Server (LostCityRS-Engine-TS shares its layout, combat scripts not diffed), OpenDAoC + Dawn-of-Light, rathena, Ryzom Core, forgottenserver (the Tibia server; `opentibiabr-otclient` is the client, read only for the attack call). Paths are relative to each repo.

## Verdict on the hypothesis

> Combat is a FLAG on an entity that is already simulated, plus a swing timer; nothing is built at engage.

**Confirmed for the server side in all nine.** Engage sets a target pointer or a state and arms (or just reads) a per-entity next-swing time. No donor builds a fight world, loads a scene, or switches the camera on the server's word. Qualifications, so nobody over-reads it:

- Small allocations do exist at engage: a threat or hate entry (EQEmu, AzerothCore), two timer registrations (ModernUO), a timer node (rathena), a per-swing action object (Ryzom `new CCombatPhrase` per attack, OpenDAoC `WeaponAction`), a script state (2004Scape). None is a scene, a rig or an arena.
- Dawn-of-Light (the older DOL, not OpenDAoC) allocates an `AttackAction` timer at engage; OpenDAoC fixed that by building the attack component with the entity.
- The camera and scene claim is the one part we cannot verify from donor code.

## Per donor

### Veloren (`veloren-veloren`)
- **Enter:** no "in combat" flag. The agent gets a target (`server/agent/src/action_nodes.rs:1190-1198`) and the creature's `CharacterState` enum (`common/src/comp/character_state.rs:105`) moves from Wielding/Idle to an attack variant in `handle_ability` (`common/src/states/utils.rs:1453`, assigned at `:1516`). The hitbox `Melee` component is inserted only on the swing's hit frame (`common/src/states/basic_melee.rs` ~84-105). Nothing else is built.
- **Tick:** per-tick state machine (`character_state.rs:755`, run by `common/systems/src/character_behavior.rs:88`); Buildup / Action / Recover phases from `basic_melee.rs:61-140`; server `TPS = 30` (`server-cli/src/main.rs:49`). The same systems run on client and server (`common/systems/src/lib.rs:24`, `client/src/lib.rs:74`).
- **Aggro to first hit:** `choose_target` (`action_nodes.rs:1034`) -> `agent.target` (`:1190`) -> behavior tree `attack` (`behavior_tree/mod.rs:986`) -> `handle_simple_melee` (`server/agent/src/attack.rs:54`, pushes `InputKind::Primary` at `:63`) -> `handle_ability` (`utils.rs:1453`) -> `basic_melee::behavior` hit frame inserts `Melee` -> `melee::Sys::run` range/angle check and damage (`common/systems/src/melee.rs:88`, `:191-196`, `:230-278`).
- **First-draw / GPU:** the figure model cache key is `FigureKey{body, item_key, extra}` and `extra` only varies with character state in first person (`voxygen/src/scene/figure/cache.rs` ~222, ~245), so entering combat on a third-person entity changes no key and builds no mesh. Meshes are built on a background pool when the entity is first seen (`get_or_create_model`, `cache.rs:408`); until ready the entity is simply not drawn. Pipelines are created up front (`render/renderer/pipeline_creation.rs:22`, figure pipeline `:563`). Particle buffers are shared and built at scene creation (`scene/particle.rs:54-62`). No explicit pre-warm step; the design is "everything is created on first sight, asynchronously".
- **Take:** state-machine phases with one timer (windup / hit frame / recover), a separate hit-resolution step that consumes a transient hit event on the hit frame, and the AI only pushing inputs.

### ModernUO (`ModernUO`)
- **Enter:** one setter does it all. `Mobile.Combatant` (`Projects/Server/Mobiles/Mobile.cs:720-775`): assigns the target, runs the region veto, sends the change-combatant packet (`:757`), starts an expire timer and a 10 ms combat timer (`:762-766`), then `DoHarmful` (`:770`). `BaseCreature.OnCombatantChange` just sets `Warmode` (`UOContent/Mobiles/BaseCreature.cs:3035-3039`).
- **Tick:** `CheckCombatTime` (`Mobile.cs:777-810`) gates on `Core.TickCount - NextCombatTime < 0` (`:779`); in range and in line of sight it calls the weapon's `OnSwing` (`:803-806`), which returns the next delay (`UOContent/Items/Weapons/BaseWeapon.cs:834`, `GetDelay` `:1356`). The AI thinks on its own timer (`AI/BaseAI/AITimer.cs:25-35`), decoupled from the swing.
- **Aggro to first hit (Berserk AI):** `AcquireFocusMob` (`BaseAI.cs:853`) -> `Combatant = FocusMob` (`AI/BerserkAI.cs:17-18`) -> setter starts `CheckCombatTime` -> `OnSwing` (`BaseWeapon.cs:834`) -> `SendSwing` (`:860`) -> `CheckHit` (`:1208`) -> `OnHit` (`:1732`).
- **Take:** a single `Combatant` setter that validates, notifies and starts the swing loop; a `NextCombatTime` gate where the swing returns the next delay; AI and swing on separate clocks.

### EQEmu (`EQEmu/zone`)
- **Enter:** engaged is derived, not stored: `IsEngaged() { return !hate_list.IsHateListEmpty(); }` (`mob.h:783`). `Mob::AddToHateList` (`attack.cpp:3054`) adds the entry (`:3182`); on the first entry (`!was_engaged`, `:3293`) it fires `EVENT_AGGRO` and `AI_Event_Engaged` (`mob_ai.cpp:1747`), which only sets a standing appearance and starts the autocast timer (`:1753`). The attack timer is set up at AI start (`mob_ai.cpp:477`, `npc.cpp:542`), not at engage.
- **Tick:** zone loop 32 ms (`zone/main.cpp:636`, ~31 Hz) calling `MobProcess` (`:604`); `AI_Process` (`mob_ai.cpp:965`) runs when the 50 ms think timer or the attack timer fires (`:969`, `common/features.h:147`); swing gate `if (attack_timer.Check())` (`mob_ai.cpp:1164`), timer set from `attack_delay / haste` (`attack.cpp:6727`).
- **Aggro to first hit:** reverse aggro scan (`client.cpp:12879-12925`, NPC to NPC `npc.cpp:4133`) -> `CheckWillAggro` (`aggro.cpp:370`) -> `AddToHateList` -> `AI_Process` picks the target (`mob_ai.cpp:1063-1082`) -> in range: stop, face (`:1149-1155`) -> `attack_timer.Check()` -> `DoMainHandAttackRounds` (`attack.cpp:6881`) -> `Attack` (`:1564`) -> `DoAttack` (`:1474`) -> `Damage` (`:1755`).
- **Take:** one threat list as the single source of "engaged", an AI target pick, and a separate attack timer; the first-engage hook (`was_engaged`).

### AzerothCore (`azerothcore-azerothcore-wotlk/src/server/game`)
- **Enter:** `CreatureAI::MoveInLineOfSight` (`AI/CreatureAI.cpp:180`) -> `UnitAI::AttackStart` (`AI/CoreAI/UnitAI.cpp:29`) -> `Unit::Attack` (`Entities/Unit/Unit.cpp:7074`): sets the target pointer and the `UNIT_STATE_MELEE_ATTACKING` state (~7160-7165) -> `EngageWithTarget` (`Unit.cpp:7306`), which adds a threat or combat reference (`Combat/CombatManager.cpp:214`) -> `Creature::AtEngage` (`Entities/Creature/Creature.cpp:2893`, `JustEngagedWith` at `:2937`).
- **Tick:** `Creature::Update` runs `UpdateAI(diff)` (`Creature.cpp:901`); `DoMeleeAttackIfReady` (`AI/CoreAI/UnitAI.cpp:41`); the swing timer is `m_attackTimer[type]` (`Unit.h:2153`), decremented in `Unit::Update` (`Unit.cpp:614-625`), read by `isAttackReady` (`Unit.h:891`), reset by `resetAttackTimer` (`Unit.cpp:769`). Map update interval 10 ms (`worldserver.conf.dist:1325`). The player swing and the creature swing share `Attack()`; out of range, the player timer is retried every 100 ms (`Entities/Player/PlayerUpdates.cpp:175`).
- **Take:** target pointer plus ready-timer, one `Attack()` entry for players and creatures, a 100 ms retry while out of range.

### 2004Scape / LostCityRS (`2004Scape-Server`)
- **Enter:** combat is an NPC mode plus a target: `npc_setmode(opplayer2)` in `[proc,npc_default_retaliate]` (`data/src/scripts/skill_combat/scripts/npc/npc_combat.rs2:7-18`); hunt aggro sets the interaction (`src/engine/entity/Npc.ts` ~897). A player attack is `[opnpc2,_] @player_combat_start` (`.../player/player_combat.rs2:1,12`).
- **Tick:** `World.cycle` (`src/engine/World.ts:369`), `TICKRATE = 600` ms (`:120`): NPCs then players. `Npc.turn()` runs hunt, timers, queue, then `aiMode` (`Npc.ts` ~560-593, `aiMode` `:824`). Swing gate is a tick compare, `%npc_action_delay > map_clock` (`npc_combat.rs2` ~38; player `player_melee.rs2:7`), set to `map_clock + attackrate`.
- **Aggro to first hit:** `huntAll` (`Npc.ts:247`) -> `consumeHuntTarget` (`:876`) -> `aiMode` -> `tryInteract` (`:856`) -> `npc_default_attack` (`npc_combat.rs2:35`) -> `~npc_meleeattack` -> `~playerhit_n_melee` (`npc_combat_melee.rs2:23,36`). Player hits queue the damage for the NPC's next turn (`player_melee.rs2:56`).
- **Take:** `action_delay = clock + rate` gate; damage landing on the next tick through a queued event.

### OpenDAoC + Dawn-of-Light (`OpenDAoC-OpenDAoC-Core`, `Dawn-of-Light-DOLSharp`)
- **Enter (OpenDAoC):** brain `AttackMostWanted` sets `TargetObject` and calls `StartAttack` (`ai/brain/StandardMob/StandardMobBrain.cs:420-445`) -> `GameNPC.StartAttack` (`gameobjects/GameNPC.cs:2640`) -> `AttackComponent.RequestStartAttack` (`ECS-Components/AttackComponent.cs:468`): sets a request flag and registers in the tick list. Next tick `NpcStartAttack` turns and follows; `AttackState = true` (`:710`). The `AttackComponent` and `AttackAction` are built in the entity constructor (`:33-37`), not at engage. Only a `WeaponAction` is allocated per swing (`Actions/AttackAction.cs` ~380).
- **Enter (DOL):** `GameLiving.StartAttack` (`gameobjects/GameLiving.cs:3094`) sets `AttackState` and creates an `AttackAction` timer (`:3110`, min 500 ms `:3128`).
- **Tick:** OpenDAoC game loop 30 Hz (`serverproperty/ServerProperties.cs:274`, `Managers/GameLoop/GameLoop.cs:33`); `AttackComponent.Tick` (`:41`) -> `AttackAction.Tick` (`Actions/AttackAction.cs:50`); `_nextMeleeTick += _interval` (`:93`, added to the previous time, not "now", to avoid drift); idle re-poll 100 ms (`:11`).
- **Aggro to first hit:** `Think` (`StandardMobBrain.cs:68`) -> `CheckProximityAggro` (`:73`) -> `CheckPlayerAggro` (`:92`) -> `AddToAggroList` (`:303`) -> `AttackMostWanted` (`:420`) -> `StartAttack` -> next tick `AttackComponent.Tick` -> `TickMeleeAttack` (`AttackAction.cs:82`) -> `PerformMeleeAttack` (`:361`) -> `WeaponAction.Execute` (`:71`) -> `MakeAttack` (`AttackComponent.cs:787`) -> `DealDamage`.
- **Take:** build the attack component with the entity; engage flips `AttackState`; first swing on the next tick; advance the swing time by interval, not from now.

### rathena (`rathena-rathena/src/map`)
- **Enter:** `unit_attack` (`unit.cpp` ~2925-2985): checks `unit_can_attack` / `battle_check_target`, `unit_set_target`, sets `attack_continue`; then either arms `add_timer(ud->attackabletime, unit_attack_timer, ...)` (`:2972`) or calls the timer handler at once if the cooldown is ready (`:2976`). Mob state is an enum, `mob_setstate(MSS_BERSERK)` (`mob.hpp:93`). The only allocation is the timer node.
- **Tick:** mob AI polled every 100 ms (`mob_ai_hard` `mob.cpp:2468`, `MIN_MOBTHINKTIME` `mob.hpp:35`), per-mob `next_thinktime` (`mob.cpp:2403`), only near players. The swing is a one-shot timer chain: `unit_attack_timer_sub` (`unit.cpp:3187`) swings when `attackabletime` has passed (~3290); `unit_set_attackdelay` (`:1869`) sets the next time from ASPD; re-armed at `:3337`. Damage lands after the attack motion (`battle_delay_damage`, `battle.cpp:7437`).
- **Aggro to first hit:** `mob_ai_sub_hard_activesearch` (`mob.cpp:1314`, called `:2027`) -> `mob_target` (`:1290`) -> `mob_setstate(MSS_RUSH)` (`:2032`) -> `unit_attack` (`mob.cpp:2155`) -> `unit_attack_timer` (`unit.cpp:3354`) -> `battle_weapon_attack` (`battle.cpp:7133`) -> `battle_calc_attack` (`:7340`).
- **Take:** aggro only sets the target id; the swing is a separate `attackabletime` gate; the first hit fires at once when the cooldown is already ready.

### Ryzom Core (`ryzom-ryzomcore/ryzom`)
- **Enter:** the AI service sets an `Attacks` action flag (`server/src/ai_service/ai_generic_fight_helpers.cpp:195`, `isHitting()` `ai_bot.h:112`); the game service engages melee in `CPhraseManager::engageMelee` (`entities_game_service/phrase_manager/phrase_manager.cpp:1608-1645`): two map inserts, `setMode(MBEHAV::COMBAT)` for a player (`:1636`), engage messages (`:1643`). **Allocation:** one `new CCombatPhrase` per attack (`phrase_manager.cpp:1085-1100`, `combat_phrase.cpp:214`), so "nothing allocated" is false per swing here. The client handles `MBEHAV::COMBAT` by changing the collision mask and swapping the animation set (`client/src/character_cl.cpp:2334`, `computeAnimSet` `:1113`); no skeleton, shape or camera change.
- **Tick:** `updatePhrases()` from the game-service tick (`entities_game_service.cpp:741`) -> `updateEntityCurrentAction` (`phrase_manager.cpp:482`); phrase lifecycle validate (`combat_phrase.cpp:908`), update (`:1351`), execute (`:1650`), launch (`:1704`), apply (`:2813`); swing latency in game ticks from the weapon (`:~2160-2170`). Tick length not read (100 ms is INFERRED).
- **Aggro to first hit (creature):** AI fight update (`ai_generic_fight_helpers.cpp` ~170-200) -> `s_attack` (`:27`, message `:88`) -> `executeAiAction` (`phrase_manager.cpp:1065`) -> `initPhraseFromAiAction` (`combat_phrase.cpp:214`) -> queued, `updatePhrases` -> `launchAttackOnTarget` (`:2431`) -> `applyAttack` (`:2859`).
- **First-draw / GPU:** the client preloads shapes and skeletons at startup behind the loading bar (`client/src/init_main_loop.cpp:1041-1075`, `PreCacheShapes` default true, `client_cfg.cpp:685`) with a never-evicted cache, and streams entities by distance (`streamable_entity.cpp` ~66-75, `loadAsync` inside `_LoadRadius`), so an entity is loaded before it can be attacked. Skeleton and body instances are created at entity build time (`entity_cl.cpp:1107`, `character_cl.cpp:795`). Impact particle systems are created on first hit with no pre-warm (`character_cl.cpp:5080-5082`); a first-impact hitch is INFERRED there.
- **Take:** the cheap "is mid-swing" action flag; AI decides, the authority resolves. **Not:** a heap object per swing, the two-service hop.

### forgottenserver (`otland-forgottenserver/src`)
- **Enter:** `Creature::setAttackedCreature` (`creature.cpp:719-738`) sets the pointer, adds a follower and forces a path update. Players: `Game::playerSetAttackedCreature` (`game.cpp:3232-3260`). Monsters: `selectTarget` (`monster.cpp:669-695`). "In a fight" is a condition, not an object. The client's `Game::attack` (`opentibiabr-otclient/src/client/game.cpp:977-998`) only sends the target id.
- **Tick:** `checkCreatures` (`game.cpp:3863-3878`) buckets 100 ms, each creature thought once a second (`creature.h:57-58`); `onAttacking` (`creature.cpp:155-166`); players swing when `OTSYS_TIME() - lastAttack >= getAttackSpeed()` (`player.cpp:3400-3445`) and reschedule themselves; monsters `attackTicks += interval` and per-spell cooldowns (`monster.cpp:823-870`, `:891`).
- **Aggro to first hit (monster):** `onCreatureEnter` (`monster.cpp:416`) -> `onCreatureFound` (`:395`) -> `onThink` (`:743`) -> `searchTarget` (`:498`) -> `selectTarget` -> `setAttackedCreature` -> `checkCreatureAttack` (`game.cpp:3834`) -> `onAttacking` -> `Monster::doAttacking` -> cast.
- **Take:** target pointer plus a per-entity next-swing time that reschedules itself. **Not:** the 1 s think and 100 ms bucket round-robin (too coarse for 30 Hz).

## Where we are (trunk 27086155d)

- Zone 1's merged mount already behaves like the donors at the logic level. `engage()` is a call to `wc.press()` (`origins/preview/main.ts:528-537`); the world step finds the nearest creature in the engage ring and, when the engaged foe changes, `openBout` (`origins/combat/open-fight.ts:24`) builds two Pit fighter records plus AI state (`zone1.ts:131`). That is a small data allocation, no scene, rig or arena. The old `startMobFight` / arena path only runs with `?combat=pit`.
- World's engage trace (VPS software GL) shows no JS task over 50 ms and frame gaps of 450 to 1117 ms with the main thread idle, which points at render / GPU work, not at logic. That is exactly the cost the donors avoid by loading and uploading assets while the entity is merely in view.

## Pattern to adopt for Zone 1

1. **Engage is a state flip on entities that are already in the world.** Hero and creature stay world fighters; engagement sets `foe` and arms the swing. Nothing at engage creates a scene object, material, light or camera. (Every donor.)
2. **Swing = per-fighter next-swing tick, advanced by interval, not from now** (OpenDAoC `_nextMeleeTick += _interval`; rathena `attackabletime`; 2004Scape `clock + rate`). If the cooldown is already ready, the first swing fires on the next tick (rathena `unit.cpp:2976`).
3. **Aggro and swing are separate clocks.** The AI picks a target at its own rate; the swing gate runs every tick (ModernUO, EQEmu, rathena). Out of range, re-poll cheaply rather than start a swing (AzerothCore 100 ms).
4. **One entry point for "I am now attacking X"** that validates, sets the target and notifies (ModernUO `Combatant` setter, AzerothCore `Unit::Attack`), shared by players and creatures.
5. **Pre-load and pre-upload before the creature can be attacked** (Veloren builds the model on a background pool when first seen and skips drawing until ready; Ryzom preloads shapes and streams by radius). For us: load the creature mesh, skeleton, animations and every material and shader variant combat can touch when it enters the streaming radius (well outside aggro), and draw one throwaway frame of each hit / impact effect at load. The measured 450 ms to 1.1 s gaps are the first draw of something not yet uploaded; this is the fix shape, to be confirmed by the Metal trace.
6. **Do not copy:** a heap object per swing (Ryzom, OpenDAoC `WeaponAction`; pool or reuse if it ever shows up in a profile), millisecond-delta timers (we are 30 Hz tick counts), coarse think intervals (forgottenserver), and the aura / threat / leash machinery.

The Pit duel engine stays as it is: the open-fight adapter already runs it without a ring, and the spike (Lead's decision 6) tests whether the Pit scene can be entered without the start and finish pieces.

## Not verified

- Camera and scene behaviour for ModernUO, EQEmu, AzerothCore, 2004Scape, OpenDAoC / DOL, rathena and forgottenserver is INFERRED from the server never sending a mode change; their clients are not in the repos.
- LostCityRS-Engine-TS: layout and tick rate confirmed, combat scripts not diffed against 2004Scape.
- Veloren's creature animation selection on combat start and its combat-specific particle model loading were not traced.
- Ryzom's tick length and the AI aggro acquisition (`ai_aggro.cpp`) were not read.
