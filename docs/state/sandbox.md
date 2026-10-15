# Combat Sandbox lane: handoff (2026-10-15)

READ FIRST. Longer history and the receipts live in `docs/state/combat-sandbox.md` (top entries are the newest). This file is the short restart card. The lane never merges to trunk: sandbox/page is a preview-only branch, Combat promotes what Dom likes (so this file is on sandbox/page, not on trunk, by design).

## Now
- Branch `sandbox/page` (worktree `~/Developer/frankendom-sandbox`), merged with trunk 70b707aac (a merge, not a rebase; backups `sandbox/page-pre-EQ`, `sandbox/page-pre-EP`). Preview https://frankendom.com/preview/sandbox/ is published at the last "docs/sandbox-mech" commit before slot 2; SLOT 2 IS COMMITTED AND TESTED BUT NOT YET PUBLISHED (run `sandbox/publish.sh`, then check the served bundle for `skill2` and that the page loads with `?spell2=<id>`).
- Dom tests on his phone and answers in chat. His standing rules: no markers or on-screen labels, no posture effects, every number a data row, match approved pictures, plain concise English, build the whole table then let him test.

## Done (the table, all rows in `src/fight/sandbox-rules-defs.json` + `sandbox/rows.json`, tests `tests/sandbox-*.test.ts`)
Reach bands (+AI holds band, glance feel and sound), armour vs blow type, commit vs bait, clock fighter (poison), ward, bind and disarm, flank + shield wall, stance picker hidden, arm wound removed, loadout menu (opponent weapon, both armour classes, your spell + cast skill, staff/bow/crossbow stand-ins), admin Sparring tab on, combat-debug overlay off, mana bar (spells paid in mana), missile model (staff / bow / crossbow: lanes, travel time, outer band only, quiver, bolt FX), spell slot 2 (SPELL 2, own cooldown and cost, `?spell2=&cast2=`).

## Open
1. Publish slot 2 and have Dom try it; opponent casting catalogue spells (only class specials today); a spell-2 for the foe.
2. Nothing here has been fought in a live match by Claude: stepped-duel tests only. Unverified on screen: bolt in flight, quiver counter, glance sound, spells casting, slot 2.
3. Real staff / bow / crossbow weapons: new weapon ids trip 11 weapon-lane pins (bake manifest, equip glb, flip fairness, loader sha, real reach...), so they stay stand-ins (`?staff= ?bow= ?crossbow=`) until the Weapons lane bakes them. Bow visuals: Combat's origin/combat/bows-sandbox mesh was NOT reused (Dom disliked it); the bolt is a tinted orb.
4. Win-rate gate (AI-vs-AI batch, bands must not re-rank weapon classes) is owed to Strategy before any promotion. Held by Dom: initiative (3), beasts (10). No: rampage (7).
5. Promotion later (Combat): RECORD_VERSION bump; Fighter fields mana/missile/ammo/poison/bound/ward/spell2 are sandbox-only; record code `skill2` appended; spell2 is not in a record, so a slot-2 fight does not replay.

## Gotchas
- Run tests only on the VPS: `sandbox/vps-run.sh true` (rsync) then `ssh ... 'cd /root/frankendom-worktrees/sandbox && nice node --test <files>'`; the capture queue jams. Never `sh -c` wrappers (hook blocks them).
- `record-version-guard` "a sim change without a RECORD_VERSION bump" is red by Strategy's ruling; everything else must be green.
- After merging trunk, grep for conflict markers and run graphics.test.ts: sandbox rows can miss trunk's new required columns (weightClass crashed the page once), trunk moved hit-stop pauses to `src/hit-stop-rules.json` (the sandbox zeroes them via the `hit-stop-rules` family), and `hit-stop-rows.test` pins the IMPACT table (no new keys).
- A new import in `src/main.ts` must be registered in `tests/graphics.test.ts`' module map.
- sandbox-rules.ts is in the sim file lists: do not import loot/legends chains into it (read JSON rows directly).
- The browser pane often does not run the game loop: verify DOM, console and served-bundle strings, not a fight.
- Strategy session "Project Strategy - Fable 5.1" answers design questions in one message; the Auditor and Lead route lane triage; the Characters owner is "Frankendom - Characters & Art".

## Ranged donor notes (2026-10-15, Dom: "take best practice")
Sources: bows spec (combat/bows-spec, file:line), and DomLynch/Games-Analysis deep notes (combat-sim/openmw, rathena, OpenRA). Rule across donors: the HIT is decided when the shot is fired (AzerothCore `SpellHitResult` Spell.cpp:2463, 2004Scape pvp_ranged.rs2:50-58, UO `CheckHit`, OpenMW `projectileHit` combat.cpp:224-314 calls the same `getHitChance` as melee); the flying projectile is travel time and show. Lock-on, no free aim. Ammo per shot; mana for spells; crossbow slower/heavier than bow (UO ranges 10 vs 8). OpenRA: min range + reload delay on the weapon. Not yet built: auto-aim homing + optional hit-chance roll (Dom to pick always-hit vs roll).

## Ranged weapons state (2026-10-15 late)
LIVE in the preview (sandbox/page 757e63cdb): staff (art dev's procedural model, held out like the trident; white-orb bolt, mana only), painted bow (hand_l) and painted crossbow (hand_r) from Dom's picks bow-concept-s71 / crossbow-concept-top-s71 (Characters & Art 3febe084b, files in sandbox/painted/), auto-aim shots (row missileHoming; a roll or guard still answers), quiver off (bow/crossbow cost stamina like melee), arrows and bolts plain wood and iron (no glow), mana bar on the phone HUD as option B, spell picks persist across links. One-tap links: ?me=staff|bow|crossbow. Dom confirmed the models show ("works now").
Traps found: (1) a hook-blocked command never runs its python edit, so check the file after; (2) characters.ts `reshape` hides a weapon's own meshes and parents the rank's painted shape under the node, which hid single-mesh models: sandbox nodes set userData.sandboxRanged and reshape skips them; (3) TRELLIS GLBs ship metalness 1 (black with no env map): matte them; (4) the stand-in weapon's own clip family must be kept (part.animations) or the rig throws "missing Trident_Idle" and falls back to the longsword; (5) Browser pane here often can't draw: render with Playwright on the VPS (/root/shots/shot.mjs).
Open: SPELL buttons dim state; bow looks pale/thin from behind; no one has fought with the shots yet (arrow/bolt flight unseen); win-rate gate owed to Strategy; opponent spells; promotion needs real weapon ids and the 11 weapon-lane pins.
