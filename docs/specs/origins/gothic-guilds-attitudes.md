# Spec: Guilds, attitudes, crimes and witnesses (Gothic donor)

- Spec author: analyst-gothic (clean-room)
- Donor: OpenGothic @ `801f6ed5da1d29c316e1b2d18d3e001a84b9ebf1` (MIT, `LICENSE`, "Copyright (c) 2019 Try")
- Reference: ZenKit @ `ddf27decd5eeb48ec715e6e66e5f5072c51d88ee` (MIT, `license.md`, "Copyright 2021-2024 GothicKit Contributors")
- Paths relative to `OpenGothic/common/`. No donor code reproduced.

## 1. Purpose

Every NPC (and the hero) belongs to one guild id. A square guild-by-guild table gives the default attitude of one guild towards another. A per-NPC "permanent attitude towards the player" overrides the table for player interactions. The engine only stores and looks these up, and emits perception events when the player commits observable acts (hitting, killing, stealing, using furniture, entering rooms). All judgement - who counts as a witness, what is a crime, how much it costs to be forgiven, when a guild becomes friendly, joining a guild, guild-gated access - is Daedalus script.

ENGINE implements: guild id storage and clamping; "true guild" vs displayed guild; guild attitude table and its four externals; person attitude resolution; temp attitude STORAGE (unused in resolution, see 5.3); room (portal) ownership by guild; ownership tests for items and furniture; crime-adjacent perception emission; the unconscious-vs-dead rule that depends on attitude; friendly-fire rule.

SCRIPT owns: the attitude table contents (`GIL_ATTITUDES`), all crime bookkeeping, witness logic, absolution / paying fines, guild joining (script writes `guild` and calls `Npc_SetTrueGuild`), and earned access (doors, dialogue gates, teachers) - all via conditions in script.

## 2. Files and functions (path:line)

| Concern | Location |
|---|---|
| Guild enum (G2 ids, separators) | `game/constants.h:8-80` |
| Attitude enum | `game/constants.h:235-241` |
| Table sizing and load at script init | `game/gamescript.cpp:383-389` |
| Per-guild physical values (Gil_Values) | `game/gamescript.cpp:391-410` |
| Guild-to-guild lookup | `game/gamescript.cpp:1380-1385` (`guildAttitude`) |
| Person attitude | `game/gamescript.cpp:1387-1398` (`personAttitude`) |
| Friendly fire | `game/gamescript.cpp:1400-1409` |
| Externals: set/get/exchange guild attitude | `game/gamescript.cpp:1693-1712` |
| Externals: player/NPC portal guild, assign room | `game/gamescript.cpp:1679-1691`, `:1774-1776`, `:2554-2572` |
| Externals: true guild | `game/gamescript.cpp:2657-2668` |
| Externals: get/perm/set/temp attitude | `game/gamescript.cpp:2677-2710` |
| Ownership checks | `game/gamescript.cpp:2742-2792` |
| Room guild lookup | `world/world.cpp:1035-1075` |
| NPC guild accessors, human/monster split | `world/objects/npc.cpp:1284-1309` |
| Attitude setters | `world/objects/npc.cpp:1335-1347` |
| Unconscious vs dead decision | `world/objects/npc.cpp:569-593` |
| Knock-out / death state entry | `world/objects/npc.cpp:595-631` |
| Hostility = enemy | `world/objects/npc.cpp:4123-4125` |
| Perceptions emitted on hits/deaths | `world/objects/npc.cpp:2028`, `:2076`, `:2114-2122`, `:3839` |
| Theft perception (player picks up item) | `world/objects/npc.cpp:3429-3430` |
| Remove-weapon perception | `world/objects/npc.cpp:3671-3672` |
| Enter-room perception | `game/movealgo.cpp:160-169` |
| Use-furniture perception | `world/objects/interactive.cpp:385-408` |
| Footstep quiet-sound perception | `world/objects/npc.cpp:2326-2327` |
| NPC fields (`guild`, `aivar[100]`, `type`) | `ZenKit/include/zenkit/addon/daedalus.hh:178-219` |
| Guild values class | `ZenKit/include/zenkit/addon/daedalus.hh:22` |

## 3. Call graph

```
Script init -> read GIL_MAX, TAB_ANZAHL -> allocate table (all HOSTILE) -> copy GIL_ATTITUDES
Hit / kill / pickup / mob use / room change -> queue passive perception -> (next tick) nearby NPCs' script handlers
Script handler -> Npc_GetAttitude / Wld_GetGuildAttitude / Npc_GetTrueGuild ... -> decide -> Npc_SetAttitude / Wld_SetGuildAttitude / AI_StartState(ZS_Attack...)
Enemy search (routines spec 6.7) -> isEnemy = personAttitude == HOSTILE
HP reaches threshold -> checkHealth -> personAttitude decides unconscious vs dead
```

## 4. Data structures

- `guildCount = GIL_MAX` read from script (G2 value 66; enum at `constants.h:79`). Absent -> 0.
- `tableSide = sqrt(TAB_ANZAHL)` from script (integer sqrt). The script table may be SMALLER than guildCount (G2 scripts provide a table for human + monster guild blocks; whatever is not covered stays HOSTILE).
- `attitudes[guildCount * guildCount]`, row = source guild, column = target guild; initialised to HOSTILE (0) everywhere, then the top-left `tableSide x tableSide` block is filled from script array `GIL_ATTITUDES` read row-major with stride `tableSide`.
- Attitude values: HOSTILE 0, ANGRY 1, NEUTRAL 2, FRIENDLY 3, NULL -1 ("not set").
- Per NPC: `guild` (script field, read clamped to [0, GIL_MAX-1]); `trueGuild` (engine, initial = NONE meaning "use guild"); `permAttitude` (towards player, init NULL); `tmpAttitude` (init NULL).
- Guild classes (G2): human if guild < 16 (`GIL_SEPERATOR_HUM`); monster if 16 < guild < 58 (`GIL_SEPERATOR_ORC`); orc-class if > 58. G2 human guilds: 0 none, 1 PAL, 2 MIL, 3 VLK (citizen), 4 KDF, 5 NOV, 6 DJG, 7 SLD, 8 BAU (farmer), 9 BDT, 10 STRF, 11 DMT, 12 OUT, 13 PIR, 14 KDW, 15 PUBLIC (room marker only).
- Rooms: each BSP sector has a guild owner (default NONE); script assigns by name.

## 5. Formulas and rules

### 5.1 Guild attitude (`gamescript.cpp:1380-1385`)
`guildAtt(a, b) = attitudes[min(guildCount-1, a.guild) * guildCount + min(guildCount-1, b.guild)]`. Not symmetric unless the table is.

### 5.2 Person attitude (`gamescript.cpp:1387-1398`)
- Neither is the player -> guildAtt(a, b).
- One is the player: let N be the non-player. If N.permAttitude != NULL -> it; else guildAtt(a, b) in the ORIGINAL argument order.
- Direction matters only through the table; the per-NPC override is the same both ways.

### 5.3 Temporary attitude
Stored by `Npc_SetTempAttitude` (`npc.cpp:1345-1347`) but NOT read by person attitude (donor marks it TODO at `gamescript.cpp:2683`). `Npc_GetAttitude` and `Npc_GetPermAttitude` both return 5.2. For Frankendom: if we want temp attitude, define it as "if tmp != NULL use tmp, else perm, else guild" and document it as our extension, not donor behaviour.

### 5.4 Externals
- `Wld_SetGuildAttitude(g1, att, g2)`: bounds-check both in [0, guildCount); write row g1 col g2. Out of range ignored.
- `Wld_GetGuildAttitude(g1, g2)`: out of range -> HOSTILE.
- `Wld_ExchangeGuildAttitudes(name)`: reload the top-left block from a named script array (whole-table swap, e.g. for a chapter change). Missing array ignored.
- `Npc_SetAttitude(npc, att)`: set permanent attitude to player. `Npc_SetTempAttitude`: see 5.3.
- `Npc_SetTrueGuild(npc, g)` / `Npc_GetTrueGuild`: true guild returns script `guild` while the engine field is NONE. Engine sets true guild = guild at NPC creation (`npc.cpp:201`). Used by scripts to tell a disguised hero (wearing another guild's armour changes `guild`) from his real membership.
- `Npc_GetPortalGuild(npc)`, `Wld_GetPlayerPortalGuild()`, `Wld_GetFormerPlayerPortalGuild()`: guild owning the room the NPC/player is in (or was in before the last room change); NONE outside owned rooms. Room name is parsed from the portal name between ':' and '_' (`world.cpp:1057-1075`).
- `Wld_AssignRoomToGuild(name, g)`: name upper-cased, owner set.
- `Npc_IsInPlayersRoom(npc)`: same portal name as the player.
- `Npc_OwnedByNpc(item, npc)`: item's owner field names that NPC instance.
- `Npc_IsDetectedMobOwnedByNpc(user, owner)`: furniture the user is attached to has owner name == owner instance name.
- `Npc_IsDetectedMobOwnedByGuild`: NOT IMPLEMENTED in donor (always false, logs once).

### 5.5 Unconscious vs dead (`npc.cpp:569-593`) - key for Frankendom duels
When HP changes: threshold `minHp = 0` for monsters, `1` for others. If HP <= minHp:
- If there is no attacker, OR knock-out not allowed for this hit, OR the victim is not human, OR personAttitude(victim, attacker) == HOSTILE -> if HP <= 0 die; otherwise nothing.
- Else (human, attacker not hostile, knock-out allowed) -> knocked out: HP set to 1, enter ZS_Unconscious.
Knock-out is allowed when the hit is melee (no projectile and no spell) or the projectile carries the "don't kill" collision flag, AND the victim is not swimming; otherwise the hit is lethal (`npc.cpp:2062`).

### 5.6 Enemy and friendly fire
- isEnemy(a,b) = personAttitude(a,b) == HOSTILE (`npc.cpp:4123-4125`). Only hostile counts for nearest-enemy search; ANGRY does not.
- Friendly fire (`gamescript.cpp:1400-1409`): never for player as source; true if source and target are FRIENDLY; true if the source is a party member (`aivar[15]` in G2, `aivar[36]` in G1) and target is the player.

## 6. Order of operations

### 6.1 Load
1. Read GIL_MAX, TAB_ANZAHL. 2. Allocate, fill HOSTILE. 3. Copy GIL_ATTITUDES block. 4. Load guild physical values (`Gil_Values`) and copy the human column to all human guilds for movement constants (not attitude-related).

### 6.2 Crime pipeline (engine part only)
| Player act | Perception emitted | Sender / other / victim | Delivery |
|---|---|---|---|
| Any melee hit landing (before block check) | AssessFightSound 13 | victim / attacker / victim | queued |
| NPC takes non-spell or harmful-spell damage | AssessDamage 8 | direct to victim only | immediate |
| Damage applied | AssessOthersDamage 9 | victim / attacker / victim | queued |
| Victim knocked out | AssessDefeat 7 | same | queued |
| Victim killed | AssessMurder 6 | same | queued |
| Finishing move | AssessMurder 6 | attacker / attacker / victim | queued |
| Player picks up a world item | AssessTheft 17 (item attached) | player / player / item | queued |
| Player sheathes weapon | AssessRemoveWeapon 11 | player | queued |
| Player enters another room, not sneaking | AssessEnterRoom 31 | player | immediate |
| Player footstep, not sneaking | AssessQuietSound 14 | player | immediate |
| Player starts using furniture / reaches state 0 / reverses from top / tries a locked chest | AssessUseMob 32 | player | queued |
Delivery rules: routines spec 6.8 (range from sender, Normal-policy NPCs only, senses ignored, sender excluded). Whether a receiver "saw" anything is then up to the script handler (it may call `Npc_CanSeeNpc`).
Not emitted by the engine: DrawWeapon 24, AssessThreat 10, CatchThief 16, ObserveIntruder 12, AssessWarn 15, AssessCall 18 - scripts send these via `Npc_SendPassivePerc` / `Npc_SendSinglePerc`.

### 6.3 Typical script response (delegated, for orientation only)
Handler receives other (offender) and victim; checks guild attitude, room owner, witness line-of-sight; records a crime in script variables and/or `Npc_SetAttitude(..., ANGRY/HOSTILE)` or `Wld_SetGuildAttitude`; starts ZS_Attack or a talk state. Fines, absolution and guild-wide memory are entirely script data; we have no scripts and must design our own.

## 7. Edge cases
- Guild id >= GIL_MAX is clamped to the last guild for lookups.
- Table smaller than guildCount: uncovered pairs are HOSTILE by construction.
- Player attitude override is one-directional data but used for both directions.
- ANGRY is not "enemy" for engine purposes; scripts treat it as "will fight if provoked".
- Monsters can never be knocked out (always die at 0); humans attacked by a hostile die at 0 instead of falling unconscious.
- Temp attitude is inert in donor.
- Room guild by position returns PUBLIC or NONE only (marked FIXME in donor, `world.cpp:1048-1055`); the by-portal-name path is the real one.

## 8. Script externals involved
`Wld_SetGuildAttitude`, `Wld_GetGuildAttitude`, `Wld_ExchangeGuildAttitudes`, `Npc_GetAttitude`, `Npc_GetPermAttitude`, `Npc_SetAttitude`, `Npc_SetTempAttitude`, `Npc_SetTrueGuild`, `Npc_GetTrueGuild`, `Npc_GetPortalGuild`, `Wld_GetPlayerPortalGuild`, `Wld_GetFormerPlayerPortalGuild`, `Wld_AssignRoomToGuild`, `Npc_IsInPlayersRoom`, `Npc_OwnedByNpc`, `Npc_IsDetectedMobOwnedByNpc`, `Npc_IsDetectedMobOwnedByGuild` (stub), `Npc_GetDetectedMob`, `Npc_SendPassivePerc`, `Npc_SendSinglePerc`, `Npc_CanSeeNpc`, `Npc_CanSeeNpcFreeLOS`.
Script-only: `GIL_ATTITUDES` contents, `B_SetAttitude`-style helpers, crime memory, absolution, guild joining, guild armour as disguise, access gating.

## 9. Plumbing to strip
Daedalus symbol lookups (`GIL_MAX`, `TAB_ANZAHL`, `GIL_ATTITUDES` become a TS constant table), BSP sector/portal naming (replace with our zone ids), `Gil_Values` movement constants, G1 guild ids and G1 aivar index, savegame code, SVM sound calls in death handling, animation calls.

## 10. Golden cases

Table: guildCount 4, table side 4, values row-major:
```
        g0  g1  g2  g3
g0       2   2   2   2
g1       2   3   1   0
g2       2   1   3   0
g3       0   0   0   3
```
1. guildAtt(g1 -> g2) = 1 (ANGRY); guildAtt(g2 -> g1) = 1.
2. guildAtt(g1 -> g3) = 0 -> isEnemy true; guildAtt(g1 -> g2) = 1 -> isEnemy false.
3. Wld_GetGuildAttitude(1, 9) with guildCount 4 -> 0 (HOSTILE, out of range).
4. NPC of guild 9 with guildCount 4 -> treated as guild 3.
5. Table side 2 inside guildCount 4: pair (g0, g3) -> HOSTILE (uncovered).

Person attitude (player in g2, NPC X in g1)
6. X.perm = NULL -> guildAtt(X g1 -> player g2) = 1.
7. Npc_SetAttitude(X, FRIENDLY) -> 3 in both directions, table unchanged.
8. Npc_SetTempAttitude(X, HOSTILE) after case 7 -> still 3 (donor ignores temp).

Knock-out (human victim V, attacker A, melee)
9. V.hp 10, hit 15, attitude(V,A) NEUTRAL -> V HP 1, unconscious.
10. Same with attitude HOSTILE -> HP 0, dead.
11. Monster victim, any attitude -> HP 0 -> dead.
12. Human V, HP drops to exactly 1 from a NEUTRAL attacker -> unconscious (threshold <= 1).

Perception emission
13. Player kills NPC Y; 4 living Normal-policy NPCs are within AssessMurder range of Y's position, 1 is outside. Sender is Y (excluded). Result: the 4 receive AssessMurder with other = player, victim = Y; the fifth receives nothing.
14. Player picks up an item while sneaking: AssessTheft still emitted (sneak only suppresses room and footstep perceptions).

Capture later: pure-function tests over a fixture table (cases 1-8); combat unit tests with a fake attacker (9-12); a perception bus test (13-14). No Gothic data needed.
