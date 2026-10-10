# Donor library: Strategy verdict (2026-10-10, 16:1x)

For: the donor-library dev ("VPS server storage inventory"), Lead Dev, Dom.
Scope: read-only. Nothing here changes code or repos.

How this was built: I read the five one-pagers and the spawn draft myself. Two delegated passes did the breadth: (1) all 455 JSON sidecars across the 10 read topics, grouped by pattern tags and data fields, with 8 deep notes opened for the cited claims; (2) the four long brainstorms in full, for parity rows, assumptions and conflicts. Every connector below cites note paths under `wave2-notes/agents/batch3/`. Where a claim rests on a sidecar line only, it says so. Confidence is stated per item; "my inference" means no single note shows the join.

Frankendom facts the verdict is judged against (today's state, not the brainstorms' assumptions): the fight engine is complete and live since 14:30 (release AD), boundary count 0; Zone 2 runs from one data row; controls and the world follow camera are moving into `src/fight` this evening (World #2126, Web's controls PR); MAX_ATTACKERS = 3; kills are server-verified; one ledger for currency/loot/XP; the Pit camera is frozen; phone-first at 375 wide; player trade and markets are OFF; parties, guilds and chat do not exist yet.

---

## A. Validation of the six recommendations

| # | Recommendation | Verdict | Why, and what changes |
|---|---|---|---|
| 1 | Camera: 5 switchable presets, Pit byte-identical | **Accept, reorder** | Presets are the right look-test tool, but they sit ON the shared follow-camera module World is extracting today, as data fields in the zone row (connector W1). Build A (default) and B (fight frame) first; C, D, E are experiments and wait. Ask Dom the six camera questions AFTER he has played A and B on the phone, not before; he decides by feel. The Pit byte-identical test is the first parity row to add (D1). |
| 2 | Zones as data: presence gate, grace timer, respawn queue, streaming window, new parity rows | **Accept, reorder** | Row 23 is partly live already (Zone 2 population, the ruin camp). Order: (a) the coverage/frozen-flag amendment and "kills stay in the ledger on unload" rows first (cheap, guard real money); (b) presence gate + grace + respawn queue as one engine module with zone data; (c) streaming and visibility LAST. Phone-first with few players per zone means streaming buys little today; it is the costliest part of the doc and its numbers rest on unmeasured guesses (T = 100 ms, 200 tiles per view). |
| 3 | One ledger + conservation fuzz; every fee through one function; trade/market OFF | **Accept, strongest item** | `settle` as the only balance writer plus the conservation fuzz are the two highest-value tests in the whole library (D1, D2). Trade/market stay OFF: Dom's standing word. One ruling needed first, see "the ledger conflict" below. |
| 4 | Party/guild: server roster, permission bitmasks, per-recipient chat filter, rate limit | **Defer, keep three rows** | The game has no parties, guilds or chat yet, and the evidence is the thinnest of the four topics (matchmaking rests on one donor, colyseus, with a cut-off digest; party formation is thin by the dev's own note). Keep now: Pit isolation test, "party cap can never alias MAX_ATTACKERS", and server-side recipient routing (forged ids reach nobody). Recommend: no guilds at launch; parties sized to the fight (3) with no reserve bench until many-on-one has real players; no global lobby. Revisit after Proof 3. |
| 5 | Keep the idea, fix the donor defect | **Accept** | Dom's rule. The defect list (client-trusted prices, 32-bit fee overflow, double-applied ratios, unbalanced refunds, break-vs-continue loops) becomes test cases, not reasons to reject. |
| 6 | Licensing: copyleft/BSL/Valve/unclear = shape only; MIT/Apache/BSD adaptable; proprietary art = inspiration only | **Accept** | Two cautions: the camera doc names a donor its own header says must never be named in anything published; strip before any publish. And several camera donors carry licence "[?]"; nothing from them is adaptable until tagged. |

### The ledger conflict (ruling, so the three docs stop disagreeing)
The three brainstorms use "the one ledger" for three different things: economy = currency accounts with a closed reason enum; zones = zone snapshots, transit records and kill rows; parties = friends, ignores, mute and reports. **Ruling:** the ledger is the append-only book of value: currency, loot grants, XP, with a closed reason list and `settle` as its only door. Kill rows belong in it (they are value events). Zone snapshots, transit, social state and moderation records are separate stores with their own tests. This keeps the conservation fuzz meaningful.

### Two asymmetries that need a ruling, not more reading
- **Market:** one note rejects ("no slot"), five adapt. Ruling: OFF stays, per Dom; the five adapts are shelf designs. Path: `V005/out/economy-trade/swgemu-Core3.json` vs `ET018/.../rathena-rathena.json`, `ET019/.../smogon-pokemon-showdown.json`, `ET008/.../ax-grymyr-l2dn-server.json`, `ET017/.../otland-forgottenserver.json`, `V008/.../AAEmu-AAEmu.json`.
- **Hit model:** two combat-sim notes propose different hit rules (Daggerfall percent roll vs 2004Scape roll-vs-roll). The engine already has its hit rule; neither note changes it. Mark both "shape, no action". Paths: `Q064/out/combat-sim/evennia-evennia.json`, `Q063/out/combat-sim/2004Scape-Server.json`.

---

## B. Top 10 cross-topic wins, ranked by win per cost

Format: connector; topics joined; notes; player-visible win; cost; risk; first test. "Licence" says whether adaptable code exists or only shape.

**W1. The zone row carries its camera limits and hysteresis** (camera + zones + spawns)
- Notes: `QC023/out/camera/vE5li-korangar.json` (permissive: distance min/default/max, elevation as zone data), `QC015/out/camera/XProger-OpenLara.json` (permissive: follow vs combat offset), `QC022/out/camera/Sziadan-open-midgard.json` (copyleft: indoor/outdoor limits, locked yaw), `ZW005/out/zones-world/LostCityRS-Engine-TS.json` (MIT: reload-box hysteresis), `QC019/out/camera/ikemen-engine-Ikemen-GO.json` (MIT: dead zone; pit-scoped, usable for world framing only).
- Win: Dom's camera complaint gets fixed once in the shared module and tuned per zone type (open field, corridor, boss) from data, with a dead zone that stops jitter. This is also what makes presets A-E data instead of code.
- Cost: low. World is extracting the follow camera into `src/fight` tonight; adding a `camera` block to the zone row and a `{enter, leave}` pair is a day.
- Risk: low. The Pit snapshot test (D1) guards the frozen camera.
- First test: two zones with different camera rows render different distance and elevation in a headless still; the Pit still is byte-identical with every preset flag set.

**W2. One "engaged set" from the attacker slots drives AI, camera framing and later party sync** (ai-aggro + camera + parties)
- Notes: `Q018/out/ai-aggro/dkfans-keeperfx.json` (copyleft: melee slots, score favours free slots, extras queue), `QC006/out/camera/clockworklabs-SpacetimeDB.json` (permissive: mass-weighted group centre, widen per attacker; its acceptance already counts 1, 2, 3), `QC021/out/camera/runelite-runelite.json` (permissive: near-plane reject to fit targets), `V008/out/parties-guilds-chat/AAEmu-AAEmu.json` (copyleft: delta push per recipient).
- Win: the many-on-one fight (Proof 3) reads on a phone: the camera backs off and centres as attackers join, the 4th waits visibly, and "who is in the fight" has one definition shared by AI and camera.
- Cost: medium. The engine already holds MAX_ATTACKERS and the slot logic; exposing the engaged list to the camera is small; the framing is preset B.
- Risk: medium. Framing 3 attackers at 375 wide may fight the thumb zone; preset B must respect the HUD safe frame.
- First test: 4 wolves engage; camera width scales to 3 and never includes the 4th; the 4th never lands a hit (existing cap test).

**W3. One damage ledger decides hate, XP share, loot rights and party credit at the death event** (combat-sim + ai-aggro + progression + loot + parties)
- Notes: `Q070/out/combat-sim/scummvm-scummvm.json` (pending ledger decides the kill once), `V006/out/ai-aggro/AAEmu-AAEmu.json` and `Q017/out/ai-aggro/l1j-en-classic.json` (hate tables), `V002/out/progression/ACEmulator-ACE.json` and `D002/out/progression/OpenDAoC-OpenDAoC-Core.json` (XP per damage share), `V004/out/loot-drops/swgemu-Core3.json`, `Q054/out/loot-drops/ModernUO.json` (loot rights), `PG015/out/parties-guilds-chat/rathena-rathena.json` (party XP by damage fraction). All copyleft or restricted: shape only. Permissive partial: `Q061/out/loot-drops/ax-grymyr-l2dn-server.json` (recipientRange, hit-aggregation tag).
- Win: server-verified kills with three attackers credit XP and loot once, from one record, with no "who hit last" arguments and nothing for a client to spoof.
- Cost: medium. The server tick already records hits; this is making one table the source for four consumers.
- Risk: low on logic, medium on licence: build clean-room from shape.
- First test: three attackers deal 50/30/20; XP and loot eligibility sum to exactly 100% and the ledger has one kill row with three shares.

**W4. One ledger primitive with the conservation fuzz** (economy + progression + loot + zones)
- Notes: `ET018/out/economy-trade/pshenok-server-survival.json` (permissive: one booking function), `ET002/out/economy-trade/DCurrent-openbor.json` (BSD: a special paid from a pool by the same check that gates it), `Q056/out/loot-drops/keldaanCommunity-pokemonAutoChess.json` (copyleft: grant ledger written after draws), `ZW008/out/zones-world/alexbatalov-fallout1-ce.json` (restricted: once-per-character bitmask). Tests from economy-brainstorm-v2 §6 T12, T16 and §7 headline.
- Win: nothing in the game can mint or lose coin unnoticed; refunds, fees and loot all balance to genesis + minted − burned at every step.
- Cost: low to medium. `settle` plus a reason enum is small; the fuzz harness is the real work (a day).
- Risk: low. The risk is NOT doing it before shops exist.
- First test: grep lint "no balance write outside settle" passes with an empty exception list; the same request id twice has one effect.

**W5. One weighted-pick table for spawns, loot packs and shop stock** (loot + spawns + zones + economy)
- Notes: `Q055/out/loot-drops/daggerfall-unity.json` (permissive: category chance matrix, repeat halving), `Q014/out/ai-aggro/evennia-evennia.json` (permissive: weighted action table), `Q057/out/loot-drops/OpenDiablo2-OpenDiablo2.json` (copyleft: no-drop weight, nested tables), `ZW017/out/zones-world/keldaanCommunity-pokemonAutoChess.json` (copyleft: leftover mass = nothing spawns), `ET012/out/economy-trade/flareteam-flare-game.json` (copyleft: vendor stock bands). Sidecar evidence: `entry_weight` in loot, spawns and zones.
- Win: 700 generated zones author spawns, loot and shops with one schema; one seeded roll per event makes replays and the VPS receipts deterministic.
- Cost: low. The catalogue rows already carry weights; this is one table type and one roll function.
- Risk: low.
- First test: same seed, same zone row, same spawn set and loot pack twice; `none_weight` yields nothing at the stated rate.

**W6. One relevance tier with hysteresis gates spawns, AI think rate and later streaming** (zones + spawns + ai-aggro + server-tick)
- Notes: `ZW006/out/zones-world/OpenGothic.json` (MIT: near/mid/far by squared distance, no hysteresis), `ZW005/out/zones-world/LostCityRS-Engine-TS.json` (MIT: reload box + per-zone player flag), `Q027/out/ai-aggro/2004Scape-Server.json` (MIT: nobody-near pause), `V004/out/spawns-encounters/swgemu-Core3.json` (copyleft: spawn only with players present, despawn after grace), `Q040/out/server-tick-netcode/rathena-rathena.json` (copyleft: recently-near stays on the slow schedule). Tag `presence-gated` spans 8 topics, 71 notes.
- Win: the VPS serves 700 zones because empty ones cost nothing; no flicker at zone edges.
- Cost: medium. One function on the server tick; the spawn side is already row 23.
- Risk: medium. Thresholds differ per donor; measure on the 16-core VPS with bots before choosing.
- First test: no player within the far radius for `grace_s` → NPC think rate 0 and spawns paused; one player entering restores both inside one tick.

**W7. The deadline record: every timer is {start, stages} read lazily** (spawns + server-tick + economy + loot + parties)
- Notes: `Q013/out/spawns-encounters/evennia-evennia.json` (BSD: state computed on observation, missed cycles counted), `Q037/out/server-tick-netcode/evennia-evennia.json` (BSD), `ET008/out/economy-trade/ax-grymyr-l2dn-server.json` (MIT: listing stages on a sweep), `Q057/out/loot-drops/LostCityRS-Engine-TS.json` (MIT: lifecycle and reveal countdowns), `U007/out/zones-world/ClassicUO.json` (permissive: throttled sweep with grace and per-pass cap).
- Win: respawn, despawn grace, loot reveal and later invite expiry survive restarts and replay identically; no timer drift under load.
- Cost: low. Replace ad-hoc timers in the spawn module with one record type.
- Risk: low. Choose one style (lazy evaluation) and do not mix with sweeps.
- First test: a respawn due at T survives a writer restart and fires at T, not T plus restart time.

**W8. Per-viewer receiver predicate for loot ownership, then chat and presence** (loot + zones + parties)
- Notes, all MIT, one codebase: `Q057/out/loot-drops/LostCityRS-Engine-TS.json` (receiver + reveal countdown, then public), `ZW005/out/zones-world/LostCityRS-Engine-TS.json` (shared buffer + private events), `PG002/out/parties-guilds-chat/LostCityRS-Engine-TS.json`, `ZW001/out/zones-world/2004Scape-Server.json` (shared delta + per-viewer follows + resync on entry).
- Win: in a 3-on-1 fight the kill's loot is the earner's for a window, then free for all; the same predicate later routes chat and presence with no second code path.
- Cost: low. The most adaptable connector in the library: permissive and from one coherent codebase.
- Risk: low.
- First test: owner sees the pile at t; a second player sees nothing until t + window, then sees it.

**W9. One level-gap curve in zone data** (progression + loot + ai-aggro + spawns + parties)
- Notes: `PG006/out/parties-guilds-chat/ax-grymyr-l2dn-server.json` (MIT: gap percent), `Q061/out/loot-drops/ax-grymyr-l2dn-server.json` (MIT: levelGapMax, chanceMult), `Q027/out/ai-aggro/2004Scape-Server.json` (MIT: too-strong factor), `Q011/out/spawns-encounters/daggerfall-unity.json` (permissive: level band pick), `V007/out/progression/AAEmu-AAEmu.json` (copyleft: 0.1 per level, zero at 10).
- Win: no farming low zones with a high character, no boosting; one table Dom can tune.
- Cost: low.
- Risk: low.
- First test: gap 10 → 0 XP and no rare slot; gap 0 → full; over-strong foe excluded from the aggro scan.

**W10. One fixed-step accumulator shared by the server loop, the camera and AI cadence** (server-tick + camera + ai-aggro)
- Notes: `Q040/out/server-tick-netcode/colyseus-colyseus.json` (permissive, adopt: fixed steps, cap 5, backlog drop), `Q035/out/server-tick-netcode/TurningWheel-Barony.json` and `QC012/out/camera/TurningWheel-Barony.json` (permissive: same donor, server clock and camera accumulator), `Q031/out/server-tick-netcode/levy-street-world-of-claudecraft.json` (MIT: wall-time clamp with a meter), `QC023/out/camera/vE5li-korangar.json` (permissive: focus gap equal at 30 and 144 fps).
- Win: the camera feels the same on a weak phone and a fast one; smoothing is frame-rate independent.
- Cost: low. One helper.
- Risk: low, with one rule: the client camera never feeds the server sim (the Veloren asymmetry: `Q031/out/server-tick-netcode/veloren-veloren.json` rejects the clock nudge for the sim; the camera notes adopt it for display only).
- First test: camera state after 1 s at 30 Hz and 60 Hz within 5%.

Dropped from the top 10 and why: nearby-player count as a shared scaling input (pure synthesis, each donor uses its own count); item-binding resolver (needs trade, which is OFF); roll-once-store-on-instance and clamp-with-carry (thin evidence, generic idioms).

---

## C. Gaps

**Unread topics most likely to hold the next big wins, in order:**
1. **anticheat-validation** (2 notes). Phone clients and server-verified kills make this the biggest unread risk. Read next.
2. **inventory-bank-equipment** (2 notes). The gear screen and gear server moved into the engine today; the donor shapes for stack, bind and bag rules feed W4 and W8 directly.
3. **quests-dialogue** (6 notes). Zones as data need a quest hook per zone row or progression has no spine beyond kills.
4. **instancing-dungeons** (1 note). The "lazy dungeon" zone preset depends on it.
5. **hud-ui** (2 notes). Phone HUD at 375 wide is the player's whole view; running now.
6. animation-rigs, vfx-blood-finishers, rendering-performance, sound-music: visual; running now; value is in stills for Dom, not mechanisms.

**Evidence too thin to act on:**
- Party formation and matchmaking: one donor (colyseus) with a cut-off digest; the lone-team fix is the dev's own design. Defer the whole topic (A4).
- Inflation guard: the economy doc itself marks the row "INFERRED" with no digest support.
- Camera: only one donor (OpenMW) ships a working shoulder rig; every preset number is a guess. That is fine for a look test, not for a spec.
- Zones: every preset number derives from four unmeasured assumptions (T = 100 ms, 20 s fights, 20 s crossing, 200 tiles per view). Measure on the live Zone 2 before tuning.
- Field-name overlap across topics is thin (about 30 shared names, mostly synonyms); pattern tags are the real cross-topic signal, and that is what the wins above rest on.

---

## D. Parity rows for Lead, in order

1. **Pit isolation, one row for all three docs:** with every camera preset, every social module and every economy switch on and off, the Pit fight snapshot and the Pit camera still are byte-identical to the frozen snapshot. (camera §6 Phase 0, parties §7 E1, economy §6 row 22.) Cheap, guards the freeze.
2. **`settle` is the only balance writer** plus request-id idempotency (economy §6 T12, T16). A grep lint and a replay test.
3. **MAX_ATTACKERS = 3 never exceeded, and no other cap can alias it** (zones §7 E16, parties §3.1/§7 E12). Small; protects the central ruling.
4. **Kills stay in the ledger across zone unload; store is never a death** (zones §6 23h). Guards ghost payouts.
5. **World camera rows:** "no camera.position/lookAt in origins/" (World's #2126 adds it tonight) and "camera limits come only from the zone row" (W1).
6. **Price function property grid** (economy §6 T3): buy ≥ value, sell ≤ min(floor(0.8052 v), buy − 1), each ratio applied once. Only once shops exist.
7. **Row 23 text amendment:** `coverage` says what it covers; frozen zones (the Pit) excluded by an explicit flag, not by omission (zones §6).
8. **Conservation fuzz** (economy §7 headline): total = genesis + minted − burned at every step; every refusal leaves the state hash unchanged. Costlier; schedule with the first shop.
9. **Recipient routing from server membership** (parties §3.6): forged party id reaches nobody. Only when chat exists.
10. Loot credits coin through `settle` with reason `kill_loot`; expected coin per fight equals the wage (economy §6 row 18 extension). With the first shop.

---

## Open questions for Dom, trimmed to the ones that change what gets built now
- Camera: none until A and B are on your phone. The six camera questions are answered by playing, not by reading.
- Zones: (1) empty zone = despawn (proposed default) vs store; (2) killed creatures stay dead until the timer even if the zone empties (proposed yes). Everything else waits.
- Economy: (1) trade and market stay OFF (your word stands; confirm when shops arrive); (2) one currency, firm, including any future paid currency (recommend yes).
- Parties: nothing now. Defer the six questions until after Proof 3.

## What I did not do
- I did not open the receipts (private) or re-verify donor code. Donor claims are the readers' and checkers', as cited.
- I did not read the four brainstorms line by line myself; the delegated pass did, and I judged its extraction against the one-pagers and today's engine state.
- 22 sidecars in topics outside the 10 read ones were not loaded.
