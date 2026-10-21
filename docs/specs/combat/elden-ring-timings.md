# Elden Ring attack timings, measured (numbers only)

Combat lane, 2026-10-21. Lead's ask (Dom's study list, item 1): wind-up, hit frame and recovery per weapon class (light, heavy, thrust), measured from the Elden Ring reference clips, next to our current rows, with proposed row values. **Numbers only: no clip, no asset, no game text is copied into the repo.** Poise, stagger and guard windows are out of scope (after beta). Companion study: `donor-elden-ring-unity.md` (a Unity clone's data shapes; its own clip timings there are a hobby project's, these are the real game's).

## 1. What was measured, and a correction

- **The viewer's `atk1-4`, `heavy`, `dash_atk` clips (ids 2202115 to 2202140) are NOT sword swings.** They sit in the `a02` group, whose events are footsteps and decals (event 792 FootSfx, 139 Decal), the right hand never moves faster than ~2 m/s (a real swing peaks at 14 to 30 m/s) and they carry no AttackBehavior (event 1). They are movement clips. Any "attack timing" read from them is wrong; the gap page should not use them.
- **Real attacks live in the weapon-category groups `a20` to `a62`** (one TimeAct group per `EquipParamWeapon.AttackAnimationCategory`; categories read from the local regulation: 20 dagger, 21 reaper, 23 straight sword, 27 thrusting sword, 30 hammer, 33 axe, 36 great hammer). Ids inside a group: `030000, 030010, 030020, 030030` = R1 chain 1 to 4; `030500` = R2 (uncharged full swing); `030505` = R2 alt with the short wind-up (read as the charge-released swing); `030510 / 030515` = the second R2. This id reading is inferred from timings and structure, not from the behaviour graph (which we cannot parse).
- **Hit frame** = start of the `AttackBehavior` event (event 1, the damage window) in the animation's TimeAct events; **hit window** = its length. **To attack-cancel** = `ChrActionFlag` type 4 ("Cancel - RH Attack": the next light can interrupt) minus the hit-window end. **To move-cancel** = flag type 11 ("Cancel - LS Movement": the player can walk away) minus the hit-window end; this is the closest thing to our `recovery` (ready to act).
- **Independent check:** for every clip the right-hand bone speed (from the clip's own skeleton, armature space) peaks within 2 frames of the hit window. 41 of 49 clips pass; the 8 that fail (straight sword R1 #2, thrusting sword R1 #1 and #3, great hammer R1 #1 to #4 and R2) have long lead-ins or two-part motions and are excluded below. Clips are 30 fps; ticks are x2 (our sim is 60 Hz).
- One weapon class per ER category is a stand-in for our weapon: knife = dagger, longsword and gladius = straight sword, cleaver = axe, warhammer and maul = hammer, scythe = reaper, estoc and its thrust = thrusting sword. Our bow, staff, trident and bite rows have no ER analogue here and are untouched.

## 2. ER measured (validated clips only)

| Class | Move (clips) | wind-up | hit window | to attack-cancel | to move-cancel |
|---|---|---|---|---|---|
| Dagger | R1 light (4) | 8.8f / 292 ms | 2f / 67 ms | 4.3f / 142 ms | 12.3f / 408 ms |
| Dagger | R2 (1) / R2 alt (1) | 27f / 900 ms; 9f / 300 ms | 4f / 133 ms; 3f / 100 ms | 7f; 5f | 19f / 633 ms; 15f / 500 ms |
| Straight sword | R1 light (3) | 12.3f / 411 ms | 3f / 100 ms | 6f / 200 ms | 15f / 500 ms |
| Straight sword | R2 (1) / R2 alt (1) | 35f / 1167 ms; 10f / 333 ms | 3f / 100 ms | 12f (alt) | 25f / 833 ms; 21f / 700 ms |
| Thrusting sword | R1 thrust (2) | 11.5f / 383 ms | 3.5f / 117 ms | 4f / 133 ms | 9.5f / 317 ms |
| Thrusting sword | R2 (1) / R2 alt (1) | 30f / 1000 ms; 10f / 333 ms | 4f / 133 ms | 7f (alt) | 18f / 600 ms; 13f / 433 ms |
| Axe | R1 light (4) | 14.8f / 492 ms | 3f / 100 ms | 6.3f / 208 ms | 19.5f / 650 ms |
| Axe | R2 (1) / R2 alt (1) | 35f / 1167 ms; 12f / 400 ms | 3f; 2f | 17f | 27f / 900 ms |
| Hammer | R1 light (4) | 15.3f / 508 ms | 3f / 100 ms | none (no chain cancel) | 18.5f / 617 ms |
| Hammer | R2 (1) / R2 alt (1) | 42f / 1400 ms; 13f / 433 ms | 3f / 100 ms | none | 28f / 933 ms; 26f / 867 ms |
| Reaper | R1 light (4) | 13.5f / 450 ms | 3.5f / 117 ms | 4.7f / 156 ms | 16.8f / 558 ms |
| Reaper | R2 (1) / R2 alt (1) | 31f / 1033 ms; 10f / 333 ms | 3f / 100 ms | none | 22f / 733 ms; 21f / 700 ms |

Great hammer only has validated R2 alt (13f / 433 ms, window 3f, move-cancel 19f). Read across: every class has a 2 to 4 frame hit window (67 to 133 ms), a wind-up of 9 to 15 frames on lights (0.29 to 0.51 s) and 27 to 42 frames on a full R2, and a move-cancel 0.3 to 0.65 s after the hit. Thrusts have the shortest recovery of the sword classes (9.5f) and the longest wind-up-to-recovery ratio.

## 3. Side by side with our current rows (ticks at 60 Hz: wind-up / active / recovery)

| Our weapon (ER stand-in) | Move | Ours now | ER measured in ticks (wind-up / hit / to move-cancel) | Ratio wind-up, recovery (ER / ours) |
|---|---|---|---|---|
| knife (dagger) | light | 14 / 6 / 16 | 17.5 / 4 / 24.5 | 1.25, 1.5 |
| knife (dagger) | heavy | 22 / 5 / 26 | 54 / 8 / 38 (alt 18 / 6 / 30) | 2.5, 1.5 |
| longsword, gladius (straight sword) | light | 20 / 8 / 22 | 24.7 / 6 / 30 | 1.2, 1.4 |
| longsword, gladius | heavy | 32 / 5 / 31 | 70 / 6 / 50 (alt 20 / 6 / 42) | 2.2, 1.6 |
| longsword, estoc (thrusting sword) | thrust | 16 / 5 / 21 (chained 12 / 5 / 19) | 23 / 7 / 19 | 1.4, 0.9 |
| cleaver (axe) | light | 22 / 8 / 26 | 29.5 / 6 / 39 | 1.3, 1.5 |
| cleaver (axe) | heavy | 36 / 6 / 36 | 70 / 6 / 54 (alt 24 / 4 / 54) | 1.9, 1.5 |
| warhammer, maul (hammer; both extend cleaver) | light | 22 / 8 / 26 | 30.5 / 6 / 37 | 1.4, 1.4 |
| warhammer, maul (hammer) | heavy | 36 / 6 / 36 | 84 / 6 / 56 (alt 26 / 6 / 52) | 2.3, 1.6 |
| scythe (reaper) | light | 24 / 8 / 26 | 27 / 7 / 33.5 | 1.1, 1.3 |
| scythe (reaper) | heavy | 36 / 5 / 33 | 62 / 6 / 44 (alt 20 / 6 / 42) | 1.7, 1.3 |

Reading: our lights are 10 to 40% quicker than ER in wind-up and 30 to 50% quicker in recovery; our light hit windows (6 to 8 ticks) are 15 to 50% longer than ER's (4 to 7) while our thrust window (5) is shorter than ER's (7). Our heavy tap sits between ER's uncharged R2 (twice our wind-up) and ER's quick alt swing (shorter); our hold-to-charge (RV85) is the analogue of ER's R2 alt. Our thrust has a longer recovery and a shorter wind-up than ER's thrust. Source rows: `src/fight/move-defs.json` (base) and `src/fight/weapon-defs.json` (per-weapon overrides).

## 4. Proposed row values

Two readings. **A, ER absolute:** copy the "ER measured in ticks" column. It slows every fight (lights about 1.2x in wind-up and 1.4x in recovery, heavy taps about 2x), so every AI dial, the stamina economy and the beta's feel move; it needs a full fairness batch and Dom's say. **B, ER shape at our tempo (recommended first PR):** scale ER by 0.82 (our longsword light is 50 ticks, ER's straight sword light is 60.7), so class-to-class ratios and the short-hit / longer-recovery shape come from ER while the overall pace stays ours.

| Our weapon | Move | Now | Proposal B (wind-up / active / recovery) |
|---|---|---|---|
| knife | light | 14 / 6 / 16 | 14 / 3 / 20 |
| longsword, gladius | light | 20 / 8 / 22 | 20 / 5 / 25 |
| cleaver | light | 22 / 8 / 26 | 24 / 5 / 32 |
| warhammer, maul | light | 22 / 8 / 26 | 25 / 5 / 30 |
| scythe | light | 24 / 8 / 26 | 22 / 6 / 28 |
| longsword, gladius, estoc | thrust | 16 / 5 / 21 | 19 / 6 / 16 |

Heavy taps (knife 44 / 7 / 31, longsword 58 / 5 / 41, cleaver 58 / 5 / 44, scythe 51 / 5 / 36 under B) are listed for completeness but **recommend holding them**: our tap heavy plus the RV85 hold is a deliberate two-speed design that ER's two swings (R2 and R2 alt) do not map onto one-to-one, and the change is the largest in the table. Values go into the existing rows only (`move-defs.json`, `weapon-defs.json`); `check:as-data` stays clean. These rows are sim fields, so a PR moves the sim digest and needs an RV (RV86 on today's counter), era-keyed so records below it replay as before. Poise, stagger, guard and chain windows are untouched.

## 5. Not done yet / caveats

- The id reading (which clip is R1, R2, R2 alt) is inferred; 8 of 49 clips fail the hand-speed check and are excluded; only 1 clip stands behind each R2 figure and 2 behind the thrust.
- ER's one-handed and two-handed grips, running and rolling attacks and weapon arts are not measured.
- Provenance: derived from the local Steam install's animation events and skeleton on the private reference host; nothing from it is committed or deployed.

## 6. What shipped (RV86 / WSV65) and why only the longsword

Lead ruled Proposal B on lights and thrusts, heavy taps held (2026-10-21). The first build applied B to eight weapon rows (knife, longsword, gladius, cleaver, maul, warhammer, scythe, estoc). The fairness A/B (same tree, same seeds, only the era flipped: `scripts/er86-ab.mjs`, 24 seeds, every ladder rung at normal and hard, the battery's strategies) showed that this is not safe: **the wardens fight with those same weapon rows** (goblin knife, pitborn / cave troll / werewolf cleaver, executioner scythe, minotaur / knight maul, dwarf warhammer, nightborn / plague doctor estoc, shieldmaiden gladius), so retiming a row retimes the warden too. About 70 pairings moved by more than 0.06 and several crossed the caps (knife vs pitborn thrust-from-range 0 to 16 and 18 of 24; maul and warhammer vs dwarf kick-only 0 to 15 of 24). Wardens would need their own tuning, which is not this PR's job.

**So the PR retimes only the longsword**, the default weapon, which no warden carries. Maul was in the table above (hammer class) and stays out for the same reason (the minotaur and the knight fight with it). The overlay (`weapon-defs.json`, longsword row, key `rv86`, era-keyed so a record below 86 replays the old numbers):

| Move | Now | RV86 |
|---|---|---|
| light (right and left) | 20 / 8 / 22, chained 16 / 8 / 18 | 20 / 5 / 25, chained 16 / 5 / 20 |
| thrust | 16 / 5 / 21 | 19 / 6 / 16 |

Fairness, longsword-only build (24 seeds, 9 weapons x every ladder rung x normal and hard): mean player win share 0.013 to 0.013, rank 7 to 7, one pairing over the 0.06 tolerance (witch normal, thrust-from-range 6 to 4 of 24: the thrust got slightly worse, not better); every other weapon's share is identical (+0.000), so no warden moved. Whiff rate (light and thrust swings that found nothing): player 44.9% to 38.4%, warden 0.3% to 0.4%. The thrust recovery stays at 16 (the 19 to 21 fallback is not needed: no thrust-heavy pairing jumped).

The other weapon classes wait for a per-side timing mechanism (a warden-only row set or a warden retune); their values stay in section 4.

## 7. Gap page

The reference viewer's gap page and fight mode use the `a02` movement clips as "attacks" (section 1). That viewer lives off-repo on the private reference host (a temporary hobby page): nothing in the game or the repo uses those ids. It is filed for Strategy and the sandbox owner, not changed here.
