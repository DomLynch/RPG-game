# Combat sandbox promotion list (branch `sandbox/page`, lane combat-sandbox)

Branch state: `sandbox/page`, code frozen at `678a31f0d` (2026-10-18), one rows-only publish after it (`0013e8230`); 248+ commits ahead and 1,513 behind trunk at the inventory, 25 files changed on both sides. It is **never merged wholesale** (same ruling as the Test Zone): features go in as slices, each by the owner, each under an RV bump where it touches the sim. The branch is archived only on Dom's word once every line below is PORTED or DROPPED-BY-DOM.

Kind: **row** = data, **code** = promoted by the owner as a trunk PR, **asset** = baked clip or model, **tool** = script or test. Feature state (column "State"): DONE (Dom approved or battery-checked), v1 (live, untuned), **experiment** (older sandbox-mech, not re-verified by this lane; Dom decides).

**Port status** vocabulary (Strategy 2026-10-18; the live table is THIS file on trunk, the sandbox branch is frozen at 93b1138c7): PORTED (merged and live) / MERGED / IN PR (#n) / NOT STARTED (owner) / SUPERSEDED (by a merged PR) / DROPPED-BY-DOM. Older cells below that say TODO mean NOT STARTED.

**Live status, 2026-10-18 evening** (Dom: every line is PORT, including the seven "Dom decides" lines; archive when NOT STARTED and IN PR are both zero):
- MERGED: melee-special row families + readers #3198 (slice c, empty defaults); melee-digest tool #3206.
- IN PR: slice a assets/pipeline #3220 (Combat); slice b melee clips #3222 (Combat); windup/react/REACH #3205 (Combat, RV77); special-shards #3229 and specialSound #3233 (combat-sandbox, auditor:ready); war band #3235 (inherited, stacked on #3216); this docs PR #3239.
- NOT STARTED, owner Combat: SPECIAL 1/2 slots, picker and flip + hit-impact `special` tier (RV78); missile model, missileAnswer, bow specials, staff bolts, cc `pin` kind (RV79).
- NOT STARTED, owner combat-sandbox: bow-v1.glb (needs Characters' OK); sandbox/ preview dir and its five tools (last: they drive the sandbox page); view/UI items (plainPosture, ready/hurt styles, one-button/touch layout A, impact sparks, crowd; Web reviews); sim experiments as rows-OFF readers in the RV chain: reach bands (RV80), mana (RV81), dodge counter/pushback/lockout/execution/enrage/wounds/many-on-one (RV82), bind/disarm + poison/flank/ward/bait/armour (RV83).
- DROPPED-BY-DOM: crossbow.

Proofs held for the sim slices: melee strategy-battery digest `07b44daab172637c` identical at `1d09dd04f` and at the freeze with NO sandbox rows loaded (`scripts/melee-digest.mjs --seeds 8`); sandbox/cc/catalogue targeted tests 246/246; `tsc --noEmit` clean (HF CPU). NOT run: trunk's full suite, `RECORD_VERSION` guard (a porter runs both).

Slice letters (a to i) are the recommended port order, smallest safe first.

## Assets and pipeline (slices a, b)

| Slice | Path | Kind | State | Owner | Trunk already has | Port status |
|---|---|---|---|---|---|---|
| a | `scripts/character/mixamo_dump.py`, `scripts/build-special-clips.mjs` (modes `mixamo`, `ual2`, new `mixamo-seq`) | tool | DONE | Characters/Combat | no | IN-PR #3220 |
| a | `src/assets/special-clips.json` (clip rows: role, file, weapons, strike, source, twoHanded grips) | row | DONE | Combat | no | IN-PR #3220 (and #3222 touches the same file) |
| a | `src/assets/special-{skullcrack,whirlwind,groundslam,lunge}.json` (melee clips, 50-240 KB each, lazy) | asset | DONE | Combat | no | IN-PR #3220 |
| a | `src/assets/special-{bowquick,bowfan,bowpin,bowpower}.json` (Draw Arrow + Aim Recoil, 55-120 KB each) | asset | v1 | Combat | no | IN-PR #3220 |
| a | `src/assets/README.md` provenance rows (Adobe Mixamo terms: royalty-free in games, no raw redistribution, no ML training; Dom OK 2026-10-18) | doc | DONE | Characters | no | IN-PR #3220 |
| b | `src/fight/characters.ts`: `SPECIAL_ROLES` (8), `specialRoleOf`, `specialMove` prefetch, `holdHaft` two-hander grip | code (view) | DONE | Combat | no | IN-PR #3222 |

Mixamo FBX are NOT in git: `/srv/dev-jobs/mixamo-drop/mixamo` on the VPS (private); dumps in `/srv/dev-jobs/mixamo-drop/dump`. A porter who rebakes needs both folders; baked JSON is byte-identical on rebake (checked 2026-10-18 for the four melee clips). Slice (a) waits on Dom's "yes Mixamo" in Combat's own chat.

## Rules readers and rows (slice c)

| Slice | Path | Kind | State | Owner | Trunk already has | Port status |
|---|---|---|---|---|---|---|
| c | `src/fight/sandbox-rules.ts` (rows reader: specials, missiles, bowSpecial, missileAnswer, bands, mana, heal) | code (sim read) | DONE | Combat | melee-special families only (#3198, merged, empty defaults; #3205 adds readers) | IN-PR #3198 (merged) + #3205; the missile / bow / mana / heal readers remain TODO |
| c | `src/fight/sandbox-rules-defs.json` (EVERY row family must be declared here; an undeclared family is silently ignored by the sandbox entry's patch) | row | DONE | Combat | melee-special families (#3198, merged; #3205) | IN-PR #3198 (merged) + #3205; later families (reach, bow, missile, mana) TODO |
| c | `sandbox/rows.json` rows: `specialPick`, `specialSound`, `specialReactFloor`, `bowSpecial`, `missileAnswer`, `missile`, `missileLanes` (FINAL bow values: missileAnswer 15 / 15 / run 0, see the message to Combat) | row | v1 | Combat | no; needs trunk manifests per the as-data rule | TODO |

## Melee specials and slots (slices d, e)

| Slice | Path | Kind | State | Owner | Trunk already has | Port status |
|---|---|---|---|---|---|---|
| d | MELEE SPECIAL REACH (Dom 2026-10-18, "short-mid, a tad more than a normal attack"), commit 3b118938e: rows `specialMeleeReach` 220 cm + `specialMeleeSlack` 40 (sandbox-rules-defs.json 0 = trunk); `sandbox-rules.ts` `meleeSpecialReach`; `duel.ts` press refused beyond reach with the `far` cue (nothing spent), release whiffs (`SpecialFizzled`) beyond reach + slack (before: no range check at release); `ai.ts` casts inside the same reach. Fixes a special landing from across the arena. 231 sandbox/special tests green on the VPS. | code (SIM: RV bump, WSV) + rows | DONE | Combat | no | TODO |
| d | `src/fight/duel.ts` `specialMeleeWindup`, `specialReact` (stagger/knock/posture rows), `specialReactFloor`; `src/fight/hit-impact.ts` `special` tier; `src/fight/sound/cues.ts` `specialSound` | code (SIM: RV bump, WSV, batteries) | DONE | Combat | no; trunk has `special-look.ts`, `special-modes.ts`, cc-defs | IN-PR #3205 (duel.ts windup / react, shipped off, RV77); `hit-impact.ts` `special` tier and `specialSound` cues TODO |
| d | Four specials Skull Crack / Whirlwind / Ground Slam / Lunge on every melee weapon | feature | DONE (Dom approved) | Combat | no | TODO |
| d | `src/fight/special-shards.ts` (MIT port of World of Claudecraft chips; rows empty by default), `specialTrail` rows | code (view) | DONE | Combat | no | TODO |
| e | SPECIAL 1 / SPECIAL 2 slots, picker labels + `unlockAfterBossKills` (DATA ONLY: nothing reads it; Combat wires the gate), Heal off (`healOff` row) | code (UI + sim) | DONE | Combat/Web | no | TODO |
| e | `sandbox/entry.ts` picker, `src/fight/hud.ts`, `match.ts`, `input.ts` (action `skill2` in the record codes) | code | DONE | Combat/Web | no | TODO |
| d | KNOWN BUG, NOT ON TRUNK: `duel.ts` ~line 360 on this branch, a trailing `//` comment swallows `delete next.castHurt; delete next.castPush; next.phase = 'ready'; ...` after `next.special = castWindup(...)`. Melee specials were approved with it in place: a porter restores the statements, then re-checks the look | code fix | open | Combat | n/a (trunk line has no comment) | TODO |

## Missiles and bow specials (slices f, g, h)

| Slice | Path | Kind | State | Owner | Trunk already has | Port status |
|---|---|---|---|---|---|---|
| f | `src/fight/cc-defs.json` kind `pin` (source `pinShot`, also in tier `unstoppable`), `src/fight/cc-ladder.ts` `CcSource`; `tests/cc-swarm-rows.test.ts` expectation | row + code (SIM) | v1 | Combat | no (trunk has the ladder; `pin` is new) | TODO |
| g | Missile model: `duel.ts` missile fire/arrival, lanes, quiver, bands, `src/fight/missile-fx.ts` (3-arrow fan view) | code (SIM + view) | v1 | Combat | no | TODO |
| g | `missileAnswer` (warden AI rolls / guards / answers an arrow): `src/fight/ai.ts` + row; guarded-arrow posture (`missileGuardPosture`, bowSpecial `posture`), bow `pierce` + `chipKills` | code (SIM) + rows | v1 | Combat | no | TODO |
| h | Four bow specials Power Shot / Fan Volley / Pinning Shot / Quick Shot: `bowSpecial` rows, `duel.ts` cast gate / release / arrival, `characters.ts` clip roles `Special_Bow*` | feature | v1 (LIVE on `/preview/sandbox/`, untuned) | Combat | no | TODO |
| g/h | Staff bolts (white fireball at range, melee up close): `missile` rows kind `staff` | feature | DONE (Dom: staff stays as is) | Combat | no | TODO |
| g | Crossbow (rows kind `crossbow`, `sandbox/painted/crossbow-v1.glb`): removed 2026-10-18 by Dom; inert row kept only for `tests/sandbox-quiver.test.ts` | rows + asset | removed | | n/a | DROPPED-BY-DOM |
| h | `sandbox/painted/bow-v1.glb` (Characters and Art's painted bow, hold row `[-1.9, 34.6, 114.3]`) | asset | DONE | Characters | no | TODO |

Open on h: multipliers untuned (Power 2.0 / Fan 0.6 each / Pin 1.0 / Quick 1.2 of the special's damage); the battery's archer is a scripted kiter (a kiter wins ~4 of 16 vs the level-12 warden at normal with missileAnswer 15 / 15 / run 0); victim reaction clip `Standing React Small From Front 02` dumped but unused; Quick Shot's first sheet frame can show the idle stance (14-tick windup fades the clip in; unconfirmed).

## Tools and tests (slice i)

| Slice | Path | Kind | State | Owner | Trunk already has | Port status |
|---|---|---|---|---|---|---|
| i | `scripts/special-weapon-sheet.mjs` (`--bow 1`, `--orbit`), `scripts/special-look-clip.mjs`, `sandbox/bow-sheet.sh`, `sandbox/vps-run.sh`, `sandbox/publish.sh` | tool | DONE | Combat | no | TODO |
| i | `scripts/melee-digest.mjs` (the batteries' before/after digest) | tool | DONE | Combat | PORTED #3206 | PORTED #3206 (merged) |
| i | `tests/sandbox-bow-special.test.ts` (7), `tests/sandbox-bow-battery.test.ts` ([slow], 16 seeds both ways, `BOW_TUNE` sweep), `tests/sandbox-special-weapons.test.ts` (36), `tests/sandbox-special-look.test.ts`, `tests/sandbox-special-sound.test.ts`, `tests/sandbox-quiver.test.ts`, `tests/cc-swarm-rows.test.ts` | tool | DONE | Combat | no | TODO |

## Older sandbox-mech (experiment, Dom decides; not re-verified by this lane)

| Feature | Paths | State | Owner | Port status |
|---|---|---|---|---|
| Mana (third bar, spells paid per cast) | `sandbox-rules.ts` readers, `rows.json` `manaMax`.. rows, `hud.ts` bar | experiment | Combat | TODO (Dom decides) |
| Reach bands (soft x0.6 off-band, edges 1.35 / 1.8 m, `?bands=0`) | `sandbox-rules.ts`, `duel.ts`, `ai.ts` | experiment | Combat | TODO (Dom decides) |
| Bind and disarm (trident / estoc); Plague Doctor poison clock; flank and shield wall; Witch ward; commit vs bait (maul / warhammer); armour vs blow type | `duel.ts` + rows | experiment | Combat | TODO (Dom decides) |
| Dodge counter, cast pushback / interrupt lockout, execution via posture break, boss-phase enrage (foe only), wounds at or under a health percent, many-on-one rows | `duel.ts`, `boss-phase-defs`, `swarm-defs` | experiment | Combat | TODO (Dom decides) |
| plainPosture, ready-stance styles `?ready=1|2|3`, hurt-reaction styles `?hurt=1|2|3`, one-button strike and touch layout A, impact sparks, crowd | `characters.ts`, `hud.ts`, `input.ts`, rows | experiment | Combat/Web | TODO (Dom decides) |

Nothing here is promoted unless Dom names it.

## DROP (dead, proposed; each becomes DROPPED-BY-DOM only on Dom's word)

| Path | Why | Port status |
|---|---|---|
| `artifacts/sandbox-special2/` (22 review stills), `docs/specs/combat/stills/` review images, `sandbox/mockups/` | review evidence, not product | TODO (Dom decides) |
| `spellsOff` / heal rows | beta hides spells | TODO (Dom decides) |
| old Cleave / Reaping Blow placeholder names | the picker labels are rows | SUPERSEDED (picker `label` rows) |
