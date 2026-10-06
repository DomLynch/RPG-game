# EQEmu behaviour spec: faction

- Donor: EQEmu (GPLv3), commit `4aceae18b94ffaafc08e2b17bc41cd72c77f795d`, read-only at `/opt/frankendom-shadow/work/expansion-donors/EQEmu` on the VPS.
- Spec author: analyst-eqemu. Clean-room: behaviour, formulas and constants only. No donor source. Implementers must not open the donor tree.
- Destination: story (reputation with groups) and world (who attacks whom).

## 1. Purpose

Each player has a personal standing with every faction (e.g. a city guard, an orc clan). Killing an NPC adjusts the killer's standing with a list of factions (some up, some down). Standing plus fixed race/class/deity modifiers gives a nine-step attitude ("con") that decides whether NPCs attack, trade or talk.

## 2. Files, functions, call graph

| Path:line | Function | Role |
|---|---|---|
| common/faction.h:26-36 | attitude enum | 1 Ally … 9 Scowls |
| common/faction.cpp:57-89 | CalculateFaction(mods, personal) | total → attitude |
| common/features.h:204, 207-208 | MAX_NPC_FACTIONS 20, personal range ±2000 | constants |
| common/features.h:201 | THREATENINGLY_AGGRO_CHANCE 32 | aggro roll |
| zone/zonedb.cpp:3482-3594 | ZoneDatabase::LoadFactionData | load base, min/max, modifiers |
| zone/zonedb.cpp:3362-3417 | ZoneDatabase::GetFactionData | pick class/race/deity modifier |
| zone/zonedb.cpp:3456-3480 | SetCharacterFactionLevel | persist (temp code mapping) |
| zone/zonedb.cpp:3225-3231 | RemoveTempFactions | delete temp rows; called on zone entry (client_packet.cpp:1300) |
| zone/zone_npc_factions.cpp:25-175 | LoadNPCFactions / GetNPCFactionEntries | per-NPC hit lists (deduplicated per faction id) |
| zone/attack.cpp:2656-2660, 2686-2777 | NPC::Death | when hits are applied |
| zone/hate_list.cpp:288-311 | HateList::DoFactionHits | hits to every player on the hate list |
| zone/client.cpp:8243-8326 | Client::SetFactionLevel | apply an NPC's hit list |
| zone/client.cpp:8328-8378 | Client::SetFactionLevel2 | apply one faction hit |
| zone/client.cpp:9107-9193 | Client::RewardFaction | direct hit + associated factions |
| zone/client.cpp:8397-8447 | Client::UpdatePersonalFaction | clamp, HeroicCHA, change/repair |
| zone/client.cpp:8539-8583 | Client::SendFactionMessage | which message to show |
| zone/client.cpp:8187-8240 | Client::GetFactionLevel | attitude of an NPC towards a player |
| zone/client.cpp:8157-8171 | Client::GetReverseFactionCon | entry point used by NPC AI |
| zone/npc.cpp:3076-3131 | NPC::GetReverseFactionCon, CheckNPCFactionAlly | NPC vs NPC |
| zone/mob.cpp:7284-7445 | faction bonuses, GetSpecialFactionCon | spell/item bonuses, negative "special" factions |
| zone/aggro.cpp:370-575 | Mob::CheckWillAggro | attitude → proximity aggro |
| common/faction.cpp:91-165 | IsOfEqualRace / IsOfIndiffRace | race helpers (not on the main path) |

Call graph (kill):

```
NPC::Death
  if NPC not charmed and XP recipient is a player and Merit-based faction OFF:
      HateList.DoFactionHits(npc_faction_id, npc.primary_faction, npc.faction_amount)
          for each PLAYER on the NPC's hate list:
              if primary_faction ≠ 0 and faction_amount ≠ 0 → RewardFaction(primary_faction, faction_amount)
              else → SetFactionLevel(npc_faction_id)  (apply list)
  if Merit-based faction ON: SetFactionLevel(npc_faction_id) for each raid member / group member (players) / solo player
SetFactionLevel → per entry → UpdatePersonalFaction → persist → SendFactionMessage
```

Call graph (attitude): NPC AI CheckWillAggro → player.GetReverseFactionCon(npc) → GetFactionLevel → GetFactionData + personal + bonuses → CalculateFaction → overrides.

## 3. Data (DB tables)

- **faction_list**: `id`, `name`, `base` (starting standing for everyone).
- **faction_base_data**: `client_faction_id`, `min`, `max` — bounds on the **personal** (earned) value; if missing, min −2000, max +2000.
- **faction_list_mod**: `faction_id`, `mod`, `mod_name` — key strings `c<classId>`, `r<raceId>`, `d<deityId>`; one value each per character for class, race, deity (0 if no row).
- **npc_faction**: `id`, `name`, `primaryfaction` (the faction the NPC "is"; negative values are special, 5.7), `ignore_primary_assist`.
- **npc_faction_entries**: `npc_faction_id`, `faction_id`, `value` (hit applied to the killer; negative = standing drops), `npc_value` (how this NPC regards members of that faction: >0 ally, <0 hostile, 0 neutral), `temp` (0 permanent, 1 temporary, 2 permanent silent, 3 temporary silent). Up to 20 per NPC. Duplicate faction ids are ignored after the first.
- **faction_association**: `id` (= a faction) and up to ten (`id_k`, `mod_k`) pairs — factions that also move when that faction is hit directly.
- **faction_values** (per character): `char_id`, `faction_id`, `current_value` (personal, int16), `temp` (0/1).
- **npc_types** fields: `npc_faction_id`, `faction_amount` (direct hit size used with primary faction).
- Runtime per player: one active "alliance" spell bonus (faction id + amount, last cast wins) and a map of item bonuses per faction (keep the largest magnitude per sign).

## 4. Constants and rule defaults

| Item | Value | Where |
|---|---|---|
| Ally | total ≥ 1100 | ruletypes.h:1065 |
| Warmly | ≥ 750 | 1066 |
| Kindly | ≥ 500 | 1067 |
| Amiably | ≥ 100 | 1068 |
| Indifferently | ≥ 0 | 1069 |
| Apprehensively | ≥ −100 | 1070 |
| Dubiously | ≥ −500 | 1071 |
| Threateningly | ≥ −750 | 1072 |
| Scowls | < −750 | faction.cpp:88 |
| Personal min / max default | −2000 / +2000 | features.h:207-208 |
| Max NPC faction entries | 20 | features.h:204 |
| Threatening aggro chance | 32 % (Int(0..99) < 32 − ⌊HeroicCHA/25⌋; the donor comment says 25 %, the code gives 32 %) | features.h:201, aggro.cpp:493-525 |
| NPC:EnableMeritBasedFaction | false | ruletypes.h:690 |
| Client:UseLiveFactionMessage | false | ruletypes.h:1056 |
| Aggro:UseLevelAggro | true | ruletypes.h:724 |
| Aggro:MinAggroLevel | 18 | ruletypes.h:723 |
| Aggro:IntAggroThreshold | 75 (used only when UseLevelAggro is false) | ruletypes.h:721 |
| Aggro:UndeadAlwaysAggro | true | ruletypes.h:730 |

## 5. Formulas and behaviour

### 5.1 Total standing and attitude (GetFactionLevel + CalculateFaction)

total = personal + base + class_mod + race_mod + deity_mod + alliance_bonus(f) + item_bonus(f)

attitude = first of: total ≥ 1100 Ally; ≥ 750 Warmly; ≥ 500 Kindly; ≥ 100 Amiably; ≥ 0 Indifferently; ≥ −100 Apprehensively; ≥ −500 Dubiously; ≥ −750 Threateningly; else Scowls.

GetFactionLevel(player, npc) order of overrides:
1. NPC primary faction < 0 → special con (5.7).
2. Player feigning death → Indifferently. Zone with combat disabled → Indifferently. Player invisible to the NPC (incl. invisible-vs-undead the NPC cannot see) → Indifferently.
3. NPC is someone's pet → Amiably to its owner, Indifferently to others.
4. Primary faction 0 or unknown faction id → Indifferently.
5. Compute attitude as above (race used is the player's "faction race", class and deity).
6. Merchant NPC: Threateningly or Scowls is raised to Dubiously.
7. If the NPC already has this player on its hate list and the attitude is not Scowls → Threateningly.

### 5.2 Personal bounds (SetFactionLevel / SetFactionLevel2)

For faction f with base b and data bounds [mn, mx]:
pmin = min(0, mn − b), pmax = max(0, mx − b). The personal value is kept in [pmin, pmax]; therefore base + personal stays inside [mn, mx] unless the base already lies outside it, in which case no earning in that direction is allowed (bound pinned to 0).

### 5.3 Applying one hit (UpdatePersonalFaction)

Inputs: current personal cur, hit v, bounds pmin, pmax.
1. HeroicCHA (item stat) H > 0: k = ⌊H/5⌋. If trunc(v·k/100) ≠ 0 → v ← v + trunc(v·k/100). Else draw Int(0,100) (inclusive, 101 outcomes); if < k → v ← 2v.
2. If cur > pmax → cur = pmax, repair. Else if cur < pmin → cur = pmin, repair.
   Else change if the player is not a GM, v ≠ 0, and (v > 0 and cur ≠ pmax, or v < 0 and cur ≠ pmin).
3. If change or repair: cur ← clamp(cur + v, pmin, pmax) and persist. (Repair also applies the hit, even for a GM.)
Truncation is toward zero (C integer division), e.g. trunc(−5·10/100) = 0.

### 5.4 Kill hits: list mode (SetFactionLevel)

For each entry of the NPC's faction list (first occurrence per faction id): skip if faction id ≤ 0 or value = 0. If called as a quest hit with the "invert" flag, the sign of value is flipped. Compute bounds (5.2) with the player's class/race/deity, apply 5.3 with the entry's temp code, then message (5.6).

### 5.5 Kill hits: direct mode with associations (RewardFaction)

Used instead of list mode when the dead NPC has both a primary faction and a non-zero `faction_amount` a.
1. Apply a to the primary faction (5.3, permanent).
2. If the primary faction has an association row: for each of the ten slots with id_k > 0: t = mod_k · a (float); sign s = −1 if t < 0 else +1; hit = s · max(1, trunc(|t|)); apply to id_k.
   Consequences: every associated faction moves by at least 1; a slot with mod 0 gives **+1** (sign of zero is positive).

### 5.6 Who receives hits

- Default (merit off): every **player** on the dead NPC's hate list, regardless of group or damage done — but only if the XP recipient (5 of the experience spec) is a player and the NPC was not charmed. Pets on the hate list do not receive hits.
- Merit on: same people who would get XP shares: raid members, group members, or the solo player (list mode only, no association path).
- Hits happen even when the dead NPC is a merchant.

### 5.6a Messages (SendFactionMessage)

Silent if v = 0 or temp code is 1 or 2. Reference value = value before the hit, unless it was outside the bounds (then the new value). If reference ≥ pmax → "could not possibly get any better"; ≤ pmin → "could not possibly get any worse"; else "got better"/"got worse" by sign (or a live-style "adjusted by N" when Client:UseLiveFactionMessage).

### 5.6b Temporary factions

Stored temp codes: 2 → 0, 3 → 1. All temp = 1 rows for the character are deleted when the character enters a zone. Codes 1 and 2 suppress the message.

### 5.7 Special (negative) primary factions (GetSpecialFactionCon)

Applies when the target's primary faction is negative. If the asking mob is AI-controlled with a non-negative primary faction, or the target's faction is non-negative → Indifferently. Otherwise, with "both AI" meaning both sides are AI-controlled:

| Value | To players | AI vs AI |
|---|---|---|
| −2 | Indifferently | Ally |
| −3 | Dubiously | Ally |
| −4 | Scowls | Ally |
| −5 | Indifferently | Indifferently |
| −6 | Dubiously | Indifferently |
| −7 | Scowls | Indifferently |
| −8 | Indifferently | Ally if same value else Indifferently |
| −9 | Dubiously | same rule as −8 |
| −10 | Scowls | same rule as −8 |
| −11 | Indifferently | Ally if same value else Scowls |
| −12 | Dubiously | same rule as −11 |
| −13 | Scowls | same rule as −11 |
| other | Indifferently | Indifferently |

### 5.8 NPC vs NPC (NPC::GetReverseFactionCon, CheckNPCFactionAlly)

Other mob resolved to its owner. Other's primary < 0 → special table; = 0 → Indifferently; if I am a pet → my owner decides; if other is not an NPC or my primary is 0 → Indifferently. Otherwise look up my primary faction in the other NPC's faction list: npc_value > 0 Ally, < 0 Scowls, = 0 Indifferently; if absent: same primary faction → Ally, else Indifferently.

### 5.9 Attitude → aggression (CheckWillAggro, aggro.cpp:370-575)

Proximity aggro requires the target within aggro range and line of sight, and, with UseLevelAggro on (default):
- level gate: NPC level ≥ 18, or NPC is undead, or NPC flagged always-aggro, or the player is sitting, or the NPC does **not** con Gray to the player; and
- attitude gate: Scowls, or (the player's primary faction is −4 and differs from the NPC's and the NPC has no owner), or Threateningly with a passed roll Int(0,99) < 32 − min(⌊HeroicCHA/25⌋, 32).
With UseLevelAggro off, the level gate is replaced by: undead (if UndeadAlwaysAggro), or NPC INT ≤ 75, or always-aggro, or sitting, or not Gray.
Dubiously and better never trigger proximity aggro. The 32 % roll is redone every time the AI checks, so a threatening NPC eventually attacks a player who lingers.

## 6. RNG use

- HeroicCHA doubling: Int(0,100) inclusive (101 outcomes) per hit when the bonus would truncate to 0.
- Threatening aggro: Int(0,99) per aggro check.
- Nothing else; hits are otherwise deterministic.

## 7. Edge cases

- Personal stored as int16 in the DB; clamp keeps it within ±2000 by default, so overflow cannot occur.
- A base outside [mn, mx] pins one bound to 0: e.g. base −3000, mn −2000 → pmin = min(0, 1000) = 0, so standing can only go up.
- Repair applies on a hit, not on login; values outside bounds persist until the next hit.
- GM players are only changed via repair.
- Hits to a player who was on the hate list but did no damage still apply (default).
- If the XP recipient is not a player (an NPC killed it), no player gets hits even if players were on the hate list.
- The alliance spell bonus applies to one faction at a time; item bonuses keep only the strongest of each sign per faction (a new weaker bonus is ignored).
- IsOfEqualRace / IsOfIndiffRace exist but are not used by the core attitude path; reference only.

## 8. Plumbing to strip

DB loading and persistence, the zone-level caches, message string ids and packets, Lua `UpdatePersonalFaction` override hook, merchant reject messages, #faction GM commands, debug "describe aggro" text, line-of-sight and aggro-range geometry (Frankendom has its own), bots/mercs.

## 9. Golden cases (hand-derived; no HeroicCHA unless stated)

G-F1 Thresholds: total 1100 → Ally; 1099 → Warmly; 0 → Indifferently; −1 → Apprehensively; −100 → Apprehensively; −101 → Dubiously; −750 → Threateningly; −751 → Scowls.

G-F2 Total: base 0, personal 50, race_mod −100, class_mod 25, deity 0 → −25 → Apprehensively.

G-F3 Bounds: base −500, mn −2000, mx 2000 → pmin −1500, pmax 2500. Base 0 with no base_data row → pmin −2000, pmax 2000.

G-F4 Kill list {f1: −5, f2: +2}, personal 0 → f1 −5, f2 +2. Repeat 400 kills → f1 −2000 (clamped), f2 +800.

G-F5 At bound: personal −2000, hit −5 → no change, message "could not possibly get any worse". Hit +2 → −1998.

G-F6 Repair: data changed so pmax = 1000 while personal = 1200; hit +5 → cur clamped to 1000, then +5 → 1005 → clamped 1000; persisted.

G-F7 HeroicCHA 50 (k = 10): hit −20 → trunc(−200/100) = −2 → −22. Hit −5 → trunc(−50/100) = 0 → draw Int(0,100): 7 → −10; 55 → −5.

G-F8 Direct mode: primary 100, faction_amount −10, association {200: 0.5, 300: 0.05, 400: 0.0, 500: −1.0}: f100 −10; f200 −5; f300 −0.5 → max(1,0)=1 × (−1) = −1; f400 → +1; f500 → +10.

G-F9 Hate-list recipients: players P1 (killer, top damage), P2 (healer on hate list, no damage), P3 (in group, never on hate list): default → P1 and P2 get hits, P3 none. Merit on, all three grouped → all three.

G-F10 Merchant: total −900 (Scowls) → shown as Dubiously.

G-F11 Already engaged: NPC has the player on its hate list, total +600 (Kindly) → Threateningly.

G-F12 Aggro: NPC level 10 (not undead), player level 30 who sees NPC as Gray, attitude Scowls, standing → no proximity aggro (level gate fails). Same NPC at level 18 → aggro. Threateningly + roll 31 → aggro; roll 32 → no.

G-F13 NPC vs NPC: orc A primary 5; guard B list has faction 5 with npc_value −1 → B regards A as Scowls. If B's list lacks 5 and B's primary is 5 → Ally.

G-F14 Temp: hit with temp 1 → stored temp 1, no message; after zoning, the row is deleted → personal back to 0 (base only).

### Capturing real goldens on the VPS later (do not build now)

- Needs the built `zone` + `world` + `shared_memory` from the pinned commit and a PEQ database with fixture rows in faction_list, faction_base_data, faction_list_mod, npc_faction, npc_faction_entries, faction_association, npc_types.
- Drive with a Lua quest on a fixture NPC: `e.other:GetCharacterFactionLevel(id)`, `e.other:SetFactionLevel2(...)`, `e.other:RewardFaction(id, amt)`, `e.other:GetFactionLevel(...)` and print to a log; a headless client or the sidecar test CLI (`zone/zone_cli.cpp`) can invoke these without the game client. Set HeroicCHA to 0 for deterministic runs; seed the RNG in a throwaway patch for G-F7.
