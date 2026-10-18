# Combat sandbox promotion list (branch `sandbox/page`, lane combat-sandbox)

Branch state: `sandbox/page` @ the commit that carries this file; 248+ commits ahead and 1,513 behind trunk at the 2026-10-18 inventory, 25 files changed on both sides. It is **never merged wholesale** (same ruling as the Test Zone): features go in as slices, each by the owner, each under an RV bump where it touches the sim. The branch is archived only when every line below is PORTED or DROPPED-BY-DOM.

Kind: **row** = data, **code** = promoted by the owner as a trunk PR, **asset** = baked clip or model, **tool** = script or test. Status: DONE (Dom approved or battery-checked), v1 (live, untuned), WIP, **experiment, Dom decides** (older sandbox-mech, not re-verified by this lane).

Proofs held for the sim slices: melee strategy-battery digest `07b44daab172637c` identical at `1d09dd04f` and at the freeze commit with NO sandbox rows loaded (`scripts/melee-digest.mjs --seeds 8`); sandbox/cc/catalogue targeted tests 246/246; `tsc --noEmit` clean (HF CPU, 2026-10-18). NOT run: trunk's full suite, `RECORD_VERSION` guard (a porter runs both).

Slice letters (a to i) are the recommended port order, smallest safe first.

## Assets and pipeline (slices a, b)

| Slice | Path | Kind | Owner | Trunk already has |
|---|---|---|---|---|
| a | `scripts/character/mixamo_dump.py`, `scripts/build-special-clips.mjs` (modes `mixamo`, `ual2`, new `mixamo-seq`) | tool | Characters/Combat | no |
| a | `src/assets/special-clips.json` (clip rows: role, file, weapons, strike, source, twoHanded grips) | row | Combat | no |
| a | `src/assets/special-{skullcrack,whirlwind,groundslam,lunge}.json` (melee clips, 50-240 KB each, lazy) | asset | Combat | no |
| a | `src/assets/special-{bowquick,bowfan,bowpin,bowpower}.json` (Draw Arrow + Aim Recoil, 55-120 KB each) | asset | Combat | no |
| a | `src/assets/README.md` provenance rows (Adobe Mixamo terms: royalty-free in games, no raw redistribution, no ML training; Dom OK 2026-10-18) | doc | Characters | no |
| b | `src/fight/characters.ts`: `SPECIAL_ROLES` (8), `specialRoleOf`, `specialMove` prefetch, `holdHaft` two-hander grip | code (view) | Combat | no |

Mixamo FBX are NOT in git: `/srv/dev-jobs/mixamo-drop/mixamo` on the VPS (private); dumps in `/srv/dev-jobs/mixamo-drop/dump`. A porter who rebakes needs both folders; baked JSON is byte-identical on rebake (checked 2026-10-18 for the four melee clips).

## Rules readers and rows (slice c)

| Slice | Path | Kind | Owner | Trunk already has |
|---|---|---|---|---|
| c | `src/fight/sandbox-rules.ts` (rows reader: specials, missiles, bowSpecial, missileAnswer, bands, mana, heal) | code (sim read) | Combat | no |
| c | `src/fight/sandbox-rules-defs.json` (EVERY row family must be declared here; an undeclared family is silently ignored by the sandbox entry's patch) | row | Combat | no |
| c | `sandbox/rows.json` rows: `specialPick`, `specialSound`, `specialReactFloor`, `bowSpecial`, `missileAnswer`, `missile`, `missileLanes` | row | Combat | no; needs trunk manifests per the as-data rule |

## Melee specials and slots (slices d, e)

| Slice | Path | Kind | Owner | Trunk already has |
|---|---|---|---|---|
| d | `src/fight/duel.ts` `specialMeleeWindup`, `specialReact` (stagger/knock/posture rows), `specialReactFloor`; `src/fight/hit-impact.ts` `special` tier; `src/fight/sound/cues.ts` `specialSound` | code (SIM: RV bump, WSV, batteries) | Combat | no; trunk has `special-look.ts`, `special-modes.ts`, cc-defs |
| d | Four specials Skull Crack / Whirlwind / Ground Slam / Lunge on every melee weapon | feature, DONE (Dom approved) | Combat | no |
| d | `src/fight/special-shards.ts` (MIT port of World of Claudecraft chips; rows empty by default), `specialTrail` rows | code (view) | Combat | no |
| e | SPECIAL 1 / SPECIAL 2 slots, picker labels + `unlockAfterBossKills` (DATA ONLY: nothing reads it; Combat wires the gate), Heal off (`healOff` row) | code (UI + sim) | Combat/Web | no |
| e | `sandbox/entry.ts` picker, `src/fight/hud.ts`, `match.ts`, `input.ts` (action `skill2` in the record codes) | code | Combat/Web | no |
| d | KNOWN BUG, NOT ON TRUNK: `duel.ts` ~line 360 on this branch, a trailing `//` comment swallows `delete next.castHurt; delete next.castPush; next.phase = 'ready'; ...` after `next.special = castWindup(...)`. Melee specials were approved with it in place: a porter restores the statements, then re-checks the look | code fix | Combat | n/a (trunk line has no comment) |

## Missiles and bow specials (slices f, g, h)

| Slice | Path | Kind | Owner | Trunk already has |
|---|---|---|---|---|
| f | `src/fight/cc-defs.json` kind `pin` (source `pinShot`, also in tier `unstoppable`), `src/fight/cc-ladder.ts` `CcSource` | row + code (SIM) | Combat | no (trunk has the ladder; `pin` is new) |
| g | Missile model: `duel.ts` missile fire/arrival, lanes, quiver, bands, `src/fight/missile-fx.ts` (3-arrow fan view) | code (SIM + view) | Combat | no |
| g | `missileAnswer` (warden AI rolls / guards / runs down an arrow): `src/fight/ai.ts` + row; guarded-arrow posture (`missileGuardPosture`, bowSpecial `posture`), bow `pierce` + `chipKills` | code (SIM) + rows | Combat | no |
| h | Four bow specials Power Shot / Fan Volley / Pinning Shot / Quick Shot: `bowSpecial` rows, `duel.ts` cast gate / release / arrival, `characters.ts` clip roles `Special_Bow*` | feature, v1 LIVE on `/preview/sandbox/` (untuned) | Combat | no |
| g/h | Staff bolts (white fireball at range, melee up close): `missile` rows kind `staff` | feature, DONE (Dom: staff stays as is) | Combat | no |
| g | Crossbow (rows kind `crossbow`, `sandbox/painted/crossbow-v1.glb`) | REMOVED 2026-10-18 (Dom); inert row kept only for `tests/sandbox-quiver.test.ts` | | DROP |
| h | `sandbox/painted/bow-v1.glb` (Characters and Art's painted bow, hold row `[-1.9, 34.6, 114.3]`) | asset | Characters | no |

Open on h (from the frames and batteries): multipliers untuned (Power 2.0 / Fan 0.6 each / Pin 1.0 / Quick 1.2 of the special's damage); archer-vs-warden is 0/16 for a NAIVE archer bot (needs a real archer script before tuning); victim reaction clip `Standing React Small From Front 02` dumped but unused; Quick Shot's first sheet frame caught the idle stance (capture timing, unconfirmed).

## Tools and tests (slice i)

| Slice | Path | Kind | Owner | Trunk already has |
|---|---|---|---|---|
| i | `scripts/special-weapon-sheet.mjs` (`--bow 1`, `--orbit`), `scripts/special-look-clip.mjs`, `sandbox/bow-sheet.sh`, `sandbox/vps-run.sh`, `sandbox/publish.sh` | tool | Combat | no |
| i | `scripts/melee-digest.mjs` (the batteries' before/after digest) | tool | Combat | no |
| i | `tests/sandbox-bow-special.test.ts` (7), `tests/sandbox-bow-battery.test.ts` ([slow], 16 seeds both ways), `tests/sandbox-special-weapons.test.ts` (36), `tests/sandbox-special-look.test.ts`, `tests/sandbox-special-sound.test.ts`, `tests/sandbox-quiver.test.ts`, `tests/cc-swarm-rows.test.ts` (pin: 120 expectation) | tool | Combat | no |

## Older sandbox-mech (experiment, Dom decides; not re-verified by this lane)

Mana (third bar, spells paid per cast), reach bands (soft x0.6 off-band, edges 1.35 / 1.8 m, `?bands=0`), bind and disarm (trident / estoc), Plague Doctor poison clock, flank and shield wall, Witch ward, commit vs bait (maul / warhammer), armour vs blow type, dodge counter, cast pushback / interrupt lockout, execution via posture break, boss-phase enrage (foe only), wounds at or under a health percent, plainPosture, ready-stance styles `?ready=1|2|3`, hurt-reaction styles `?hurt=1|2|3`, one-button strike and touch layout A, many-on-one rows, impact sparks, crowd. Paths: `src/fight/sandbox-rules.ts` readers, `sandbox/rows.json` rows, `duel.ts` / `scene.ts` / `hud.ts` hooks. Nothing here is promoted unless Dom names it.

## DROP (dead, proposed)

`artifacts/sandbox-special2/` (22 review stills), `sandbox/mockups/`, crossbow rows and GLB, `spellsOff` / heal rows (beta hides spells), the old Cleave / Reaping Blow placeholder names (the picker labels are rows), `docs/specs/combat/stills/` review images. DROPPED-BY-DOM only when Dom says so.
