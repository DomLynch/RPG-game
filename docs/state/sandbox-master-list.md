# Sandbox master list (Lead, 2026-10-18)

Strategy's ruling, from Dom's direct word: every line on both lists is ported. A line closes only as PORTED (merged and live) or SUPERSEDED (a named trunk PR delivers the same thing).
Sources: Test Zone `zone/goblin-field-dome` @5da7b0388, Combat sandbox `sandbox/page` @93b1138c7. Both branches are frozen; port by copy and adapt only.
Trunk live: 556a6bbf3 (JC). JD #3223 (#3213, #3202, #3204, #3214) PASSed and publishing.

**ARCHIVE EXCEPTION (Lead, 2026-10-19 ~14:00 +04):** "Z1b (Zone 1 goblin-fortress biome) is the one open master-list line at archive time. It is carried by open PR #3274 (head 0aebf4559) and the paced branch world/zone1-biome-paced @42b8de160, both outside sandbox/*, so the archive (annotated tags only, nothing deleted) loses none of it. Z1b closes as PORTED when #3274 or its successor is live." **Granted, Strategy 2026-10-19 14:0x.** **DONE:** JP #3291 live 979f4513f; archive run by Deploy, 26 of 26 annotated tags `sandbox-archive-2026-10-19/<branch>` on origin (Lead counted with ls-remote), nothing deleted (manifest: deploy/handoff-1018c docs/state/sandbox-archive-manifest.md). Every line except Z1b is closed.
(CS35 item 2, hit-stop in live zones, was briefly reopened at ~14:05 and closed again at ~14:15 as already true on trunk; see CS35.)

## Test Zone (TZ), 38 lines

**Flipped 2026-10-19 morning by the TZ Sandbox lane against JH2 = trunk 3b8ae64ed (BULK-TZ #3258 merged 03:47Z, release.json = 3b8ae64ed, Auditor verified 03:54Z).** PORTED #3258 = the sandbox file is in that merge (127 of 133 sandbox files; the other 6 are ruled on the #3258 thread as superseded by #3056/#3196/#3213 or dropped). PR states read with `gh pr view` at 08:1x +04: every per-line PR below is MERGED unless marked open/draft/closed. Zone 90 is still `unlisted` on trunk: the live bundle (`/zone1/`) cannot open it, so the Test Zone look (troll 1.52, goblins 1.25, salamander 6, goblin huts) is live in the code but not in a player's Zone 1; Dom's "Zone 1 = the Test Zone" ruling is a World follow-up (`world/zone1-testzone-look` exists as a worktree), not a line here.

| Line | What | Owner | PR / state |
|---|---|---|---|
| R01 | zone 90 row | World | PORTED #3213 + #3258 (#3231 one-handed trim closed, superseded by the bulk row) |
| R02 | loadouts.json | Characters | PORTED #3216 (live since JE) |
| R03 | executioner rows | — | DROPPED-BY-DOM (confirmed by Strategy 2026-10-19) |
| R04 | ground-looks loot rows (own table drop-looks.json) | TZ Sandbox (Characters reviews) | PORTED #3258 (drop-looks.json + dropLook view; loot pickup proven in the 10-18 headless run on the thread) |
| R05 | sandbox-lines kill line | Backend | PORTED #3204 |
| R06 | regen.* / zoneloot.*, start.clear-m, drop.reach, wear-max-scale / fit.* | Combat / TZ Sandbox / Characters | PORTED #3210 + #3226 + #3196; grip.claw-fraction SUPERSEDED #3224 (merged) |
| R07 | fp.* rows | Web | PORTED #3225 |
| R08 | warband.* rows | TZ Sandbox | PORTED JG #3253 + #3258 (#3235 closed, superseded by the bulk; war band proven in the 10-18 headless run) |
| R09 | gfx.* rows | Web | PORTED #3240 |
| R10 | reach.* stand-back | Combat / World | PORTED #3266 (live JL 4eb8d8016: troll 1.52 + goblins 1.25) + #3221 height ladder, PORTED (live JP 979f4513f, 10-19); the stand-back view itself is on trunk (mobs-view.ts reach.* rows) |
| R11 | breath.* rows | TZ Sandbox | PORTED #3232 (merged 10-18 13:54Z) |
| R12 | building-skins / props / goblin-field defs | World | PORTED #3234 + #3258 |
| R13 | preview-rules lock rules | Web | PORTED #3225 |
| R14 | creature-motion-defs | — | SUPERSEDED #3056 (merged) |
| R15 | camera-rules combat camera | — | SUPERSEDED trunk 16b851ef2; pitch-with-foe-size variant + fightBack reader PORTED #3243 |
| C01 | hero-regen.ts | Combat | PORTED #3210 |
| C02 | creature-motion-rows | — | SUPERSEDED #3056 |
| C03 | mob-calm | — | SUPERSEDED #3056 |
| C04 | stand-back view | Combat | PORTED #3266 (live JL 4eb8d8016) |
| C05 | missing-clip fallback / clip packs | Characters | PORTED #3247 (live JL 4eb8d8016); the sandbox's silent fallback is deliberately NOT ported (MissingClip stays loud, #3258 thread) |
| C06 | claw tracking | — | SUPERSEDED #3224 (merged) |
| C07 | dressing code | Characters | PORTED #3216 + #3228 + #3258 (creature-view dressing); #3242 closes as SUPERSEDED by #3258 (Lead 2026-10-19); residual (kind@body key, fit errors once per body key, debug().fit) = PORTED #3268 (live JP 979f4513f) |
| C08 | loadouts-rules pickLoadout | Characters | PORTED #3216 |
| C09 | piece-fit / unweightedBones | — | PORTED #3196; remap SUPERSEDED #3224 |
| C10 | take-everything loot, outfit, drops (page half) | TZ Sandbox, Characters reviews (+Backend server half) | PORTED #3258 (outfit.ts, kill-drop.ts, page memory only; server half Backend #3259 pending in the small train) |
| C11 | kill-apply toast | Backend | PORTED #3204 |
| C12 | first-person arm + camera | TZ Sandbox | PORTED #3230 (merged 04:38Z, live in JI 20a3d87fd and every release since) |
| C13 | combat camera framing | — | SUPERSEDED trunk 16b851ef2 |
| C14 | war band | TZ Sandbox (Combat reviews) | PORTED JG #3253 + #3258 (#3235 closed) |
| C15 | breath + zone-fx | Web (Combat reviews) | PORTED #3232 (breath rows) + #3258 (zone-fx as trunk's) |
| C16 | gfx lift `?gfx=1` | Web | PORTED #3240 |
| C17 | frontier seam | Web | PORTED #3212 |
| C18 | dome / prop-kit, ambience, ground, smoke, campfire | World | PORTED #3202 + #3212 + #3258 (prop-kit, campfire, ground/smoke/ambience wiring; #3237/#3244/#3249 closed, superseded by the bulk) |
| C19 | zone schema/loader | — | SUPERSEDED #3176 + #3199 |
| C20 | spawn start-clear + mob looks | World | PORTED #3226 (start.clear-m) + #3258 (zone 90 mobLooks); Zone 1 mob looks = the World follow-up above |
| C21 | sandbox vite/zone-look tooling | — | DROPPED-BY-DOM (confirmed by Strategy 2026-10-19) |
| A01 | kit GLBs | Characters / World | PORTED: goblin-bare #3227; the ten goblin_*.glb per-building files and dungeon-kit.glb are on trunk at 3b8ae64ed (`public/world/kit/`); the single goblin-fort-kit.glb dropped on purpose (over the 1.3 MB cap, #3258 thread) |
| A02 | painted dome images | World | PORTED #3213 |
| Z1 | Zone 1 look = zone 90 rows (zone1.row.json takes biome, look.buildings, mobLooks: troll 1.52, goblins 1.25, salamander 6, Mixamo clips; rows only; Strategy ruling 2026-10-19 from Dom's handover) | World | PORTED #3266 @0470fa7d4 (live JL 4eb8d8016: scales, loadouts, goblin bodies, camera b, haze; the biome split out to Z1b) |
| Z1b | Zone 1 goblin-fortress biome (dome, camp kit, ground, building skin), split out of #3266 on 2026-10-19 because it cost +11-13 s first-playable on software GL; lands with a deferred load, target first-playable within +1 s (Lead ruling) | World | PORTED #3274 @d236cbf5d (live JR 9a49a3731, 2026-10-19 ~11:25Z: paced deferred load + the 900 s row-57 ceiling; row 57 green on the candidate). Earlier history: PARKED to 2026-10-20, IN PR #3274 @0aebf4559 (+ paced branch world/zone1-biome-paced @42b8de160). JO #3288 closed: row 57 ground-prompt-check red twice on CI (contention). Ruling: pacing + the 900 s row back only if paced shows 0 step misses under contention (worst run ≤ 750 s). ARCHIVE EXCEPTION (Lead, 10-19 ~14:00 +04): the one open line at archive time; all of its code lives outside sandbox/*, so the tags-only archive loses none of it |
| Z2 | boar 2.7 / wolf 2.8 catalogue scale (global through catalogue render.scale; duel-equals-world-size pin stays; Strategy + Lead ruling 2026-10-19) | World (Combat FYI, its file) | PORTED #3280 (live JP 979f4513f; Ember Wolf follows the wolf to 2.8, Lead ruling) |

## Combat sandbox (CS), 34 lines

| Line | What | Owner | PR / state |
|---|---|---|---|
State flipped 2026-10-19 ~11:40 +04 when BULK-CS went LIVE (JK3 #3275 fc162013d = #3257 + #3273), from Characters' line-by-line table vs #3257 @9611442f6 (static diff/grep; the CS gates were run by Combat/Auditor).

| Line | What | Owner | PR / state |
|---|---|---|---|
| CS01-05 | slice a: Mixamo tools, special-clips.json, melee + bow clip assets, provenance README | Combat | PORTED #3220 (merged, JE) |
| CS06 | slice b: SPECIAL_ROLES, holdHaft | Combat | PORTED #3257 (live JK3); #3222 closes SUPERSEDED |
| CS07 | sandbox-rules.ts readers | Combat | PORTED #3198 + #3205 + #3257 |
| CS08 | sandbox-rules-defs.json | Combat | PORTED #3257 (27 tables, byte-equal to sandbox/rows.json) |
| CS09 | rows.json values | per slice | PORTED #3257, except the carry gap = CS35/CS36a |
| CS10 | melee special reach | Combat | PORTED #3205 |
| CS11 | windup, react, floor / hit-impact special tier, specialSound | Combat | PORTED #3205 + #3233 + #3257 (special tier); 7 single specialSound rows SUPERSEDED by trunk's per-skill rows |
| CS12 | four melee specials on every melee weapon (the flip) | Combat | PORTED #3257 (RV78 era switch) |
| CS13 | special-shards + specialTrail | Combat | PORTED #3229 + #3257 |
| CS14 | SPECIAL 1/2 slots, picker labels, unlockAfterBossKills, healOff | Combat | PORTED #3257 |
| CS15 | entry picker, hud, match, input skill2 | Combat | PORTED #3257 (game code; the entry picker is sandbox harness only) |
| CS16 | swallowed-line bug | Combat | PORTED #3205 |
| CS17 | cc pin | Combat | PORTED #3257 (cc-defs + pinShot) |
| CS18 | missile model | Combat | PORTED #3257 |
| CS19 | missileAnswer | Combat | PORTED #3257 |
| CS20 | four bow specials | Combat | PORTED #3257 |
| CS21 | staff bolts | Combat | PORTED #3257 |
| CS22 | crossbow | — | DROPPED-BY-DOM; leftovers removed in RV79 (CS37) |
| CS23 | bow-v1.glb | Characters | PORTED #3281 with CS38 (live JP 979f4513f) |
| CS24 | tools (sheets, clip, bow-sheet, vps-run, publish) | Combat | PORTED #3257 |
| CS25 | melee-digest.mjs | — | PORTED #3206 (live JC) |
| CS26 | sandbox tests | Combat | PORTED #3257 (era-off/era-on suites + era fixtures) |
| CS27 | mana third bar | Combat | PORTED #3257 |
| CS28 | reach bands | Combat | PORTED #3279 (live JM e2c75382d, Auditor verified 10-19 ~08:20Z) |
| CS29 | bind/disarm, poison clock, flank/shield wall, ward, commit vs bait, armour vs blow | Combat | PORTED #3257 (armourVs now meets trunk gear owners: plate 60/90, robes 130; kept, Lead+Strategy under Dom's delegation) |
| CS30 | dodge counter, pushback/interrupt, execution, enrage, wounds, many-on-one | Combat | PORTED #3257 (stance wounds + boss phases ship empty, as the sandbox's live rows) |
| CS31 | plainPosture, ready/hurt styles, one-button, touch layout A, sparks, crowd | Combat | PORTED #3257 (layout A, styles, sparks, crowd); oneButton/plainPosture/heavyHold/stab* = CS36a |
| CS32 | special2 stills, review images, mockups | — | PORTED #3239 |
| CS33 | spellsOff / heal rows | Combat | PORTED #3257 |
| CS34 | old Cleave / Reaping Blow names | — | SUPERSEDED by the #3257 picker label rows |
| CS35 | sandbox rows that BULK-CS #3257 does not carry (Auditor finding 2026-10-19, full list on #3257): stances 2x, hit-stop frames in live zones, ARENA_ONE_SCALE 0.468, gear plate shape + light/medium presets (sim rows outside the era switch: need their own RV) | Combat | PORTED #3279 (stances 2x, ARENA_ONE_SCALE 0.468, gear plate; live JM e2c75382d). Hit-stop 0 in live zones: SUPERSEDED, already true on trunk. Hit-stop is a wall-clock presentation hold drawn only by the Pit page (src/hit-stop.ts, "the sim never reads this"), and no origins/ file imports it (Lead grep 10-19). Scope ruling: open world only, Pit/PvP keep today's frames. Pinned by tests/hit-stop-world.test.ts in #3292. Removing it from the Pit too would need Dom's word |
| CS36a | view rows BULK-CS does not carry: oneButton (ships 0, layout A behind ?onebutton=1), plainPosture 1, heavyHold 220, stabHalfAngle 50, stabSlide 18; specialSound / spellCue far / readyStyles + hurtStyles SUPERSEDED by trunk rows | Combat | 4 of 5 rows already on trunk (input-rows.json: one-button 0, heavy-hold-ms 220, stab-slide-px 18, stab-half-angle 50; pairing check 10-19 ~12:00). plainPosture 1 = `posture[0].plain` in src/fight/character-style-defs.json (read as PLAIN_POSTURE), flipped false→true in #3279 (diff checked by Lead @a23669845). PORTED: live JM e2c75382d |
| CS36b | layout A fixes before the oneButton flip: (1) heavy riposte reachable under layout A (measured: hold starts ~45 ticks, counter window 20); (2) kick button to the 44 px minimum. Flip = one row, Dom's call after playing ?onebutton=1 (Strategy ruling 2026-10-19) | Combat | PORTED #3283 (live JP 979f4513f; heavy-hold-window-ms 80 inside a counter window, kick 44 px, oneButton stays 0). Lead ruling 10-19: PASS on the in-sim layout-A test; the ?onebutton=1 browser counter receipt is owed before the flip, not the cut |
| CS37 | reach bands live (CS28 carried dormant by BULK-CS; the sandbox applied bandPerMille to damage + knockback always) + crossbow leftovers removed | Combat | PORTED #3279 (live JM e2c75382d; JL→JM diff removes 14 crossbow lines, only missile-row comments remain) |
| CS38 | bow model bow-v1.glb: loader + rows ported dormant (the sandbox bound it only via ?bow=); binding a game weapon = a new design item for Dom, not a port gap | Characters | PORTED #3281 (live JP 979f4513f; dormant loader + rows, no weapon bound; binding a weapon is a new design item for Dom) |
| CS39 | sandbox SPAWN_FLOOR + overlay gaps (Lead ask, 2026-10-19) | Combat sandbox pairing | PORTED #3284 (live JN 2b89c3f0e, Deploy Published 10-19; pairing lane's post-live sandbox boot check to follow on #3284) |

## Counts (PORTED-or-SUPERSEDED-merged / IN PR / NOT STARTED)

- TZ (2026-10-19 ~09:30 +04, 40 lines with Z1 + Z2): 31 / 6 / 1 (Z2, after BULK-CS). IN PR: R10 + C04 + Z1 (#3266; R10 also #3221), C05 (#3247), C07 (#3242), C12 (#3230 in JI #3265).
- TZ (2026-10-19 ~12:10 +04, Lead: 41 lines with Z1, Z1b, Z2): 35 done + 2 DROPPED-BY-DOM; open 4, all IN PR: R10 (#3221 height ladder), C07 (#3268 residual; #3242 closed), Z1b (#3274 biome), Z2 (#3280 boar/wolf). C12 is PORTED (#3230 live since JI).
- TZ (2026-10-19 ~12:05 +04, after JL 4eb8d8016; 39 lines with Z1): 34 / 3 / 0, plus 2 DROPPED-BY-DOM (R03, C21). Flipped at JL: Z1 and C04 (#3266 187b22ce4), C05 (#3247 4eb8d8016), R10's #3266 half. Still open (IN PR): R10 (#3221 height ladder), C07 (#3242 draft), C12 (#3230; listed as in JI #3265 above, Lead to confirm whether it is already live and flips to PORTED). Z1b (#3274, the biome) is its own line, not in these counts.
- TZ (2026-10-19, after JH2; 39 lines with Z1): 31 / 6 / 0, plus 2 DROPPED-BY-DOM (R03, C21, confirmed by Strategy 2026-10-19). Still open (IN PR): R10 and C04 (#3185, #3215, #3221 open), C05 (#3247 draft), C07 (#3242 draft), C12 (#3230 open), Z1 (World, world/zone1-testzone-look). Everything else is PORTED or SUPERSEDED behind a merged PR. SUPERSEDED counts only behind a MERGED PR; lines split across a merged and an open PR count as IN PR.
- TZ (2026-10-18, before JH2, kept for the record): 6 / 20 / 10, plus 2 DROPPED-BY-DOM (R03, C21).
- CS (2026-10-19 ~11:40, BULK-CS live, 39 lines CS01-38 with CS01-05 as one): done 31 (PORTED/SUPERSEDED) + 1 DROPPED-BY-DOM (CS22). Open 6: CS28 (dormant until RV79), CS35 + CS36a + CS37 (RV79, branch combat/rv79-sandbox-rows), CS36b (layout A fixes after RV79), CS38 + CS23 (bow model, Characters).
- CS (2026-10-18, kept for the record): 1 / 11 / 21, plus 1 DROPPED-BY-DOM (CS22).
- DROPPED-BY-DOM closes (Strategy ruling): Dom removed these from the sandbox himself before the blanket approval. R03: Dom chose pitborn over the executioner. C21: sandbox-only tooling. CS22: crossbow removed by Dom on 2026-10-18. Any of them reopens as NOT STARTED if Dom says port.
- Archive gate: NOT STARTED = 0 and IN PR = 0.
