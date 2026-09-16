# Frankendom: Origins — Opponent 3: THE PITBORN (orc-blooded pit brute)

Owner's brief of 2026-09-16, with the decisions taken the same evening and the lane contracts as built. Part 1 (the opponent seam)
is PR #81; part 2 (the body) follows on the same branch. The ladder (`Next: the Pitborn` after a Veteran win) is the lead's.

## Identity (owner-locked)
Pit-bred brute with orc blood: 1.13× the human rig, broad shoulders, thick neck, forward-hunched spine, heavy jaw with lower tusks,
grey-green weathered skin with an old brand on the cheek, shaved scalp. Bone plates at shoulder and forearm, a crude blackened iron
belt, rag kilt and sash, rope wraps, bare feet. No helm, nothing polished, nothing glowing. Name stays **Pitborn** (GAME_SPEC roster:
"the Orc ships as the Pitborn"; the Origin of the same name is renamed when Origins are built).

## Decisions (owner, 2026-09-16)
- Budget: expand as needed, not excessive → `check-budget.mjs` cap 12 → 16 MB gzip (three fighters ship, two load per duel).
- Difficulty: the same easy/normal/hard toggle modulates him (`OPPONENTS.pitborn.profiles`).
- Head: KeenTools scan of 7 owner portraits (`artifacts/source/face/pitborn/`, scan `01a0ab5b-b143-7531-ad79-6de9bacbf0fa`), tusks as geometry.
- Weapon: the **weapons dev** builds the fat cleaver (below). The character build ships him with the longsword mesh until then.

## What exists on trunk after PR #81 (combat seam)
`Opponent`/`OPPONENTS`/`Level` in `moves.ts` — `{ id, weapon, scale, health, poise, profiles }`. `initialDuel(opponent)`,
`initialPractice(seed, opponent)`; `Fighter.scale/poise/maxHealth`; hit capsule + regions scale with the target (`blade.ts`); a plain
clean hit under `poise` damage wounds and builds posture but never staggers or moves him; HUD meters take ceilings from the fighters.
`WEAPONS.cleaver` is a longsword **placeholder**. `?opponent=pitborn` picks him at boot (harness/dev) until the ladder sets it.

## Weapon: crude iron cleaver — contract for the weapons dev
- `WeaponId 'cleaver'` already exists (placeholder = longsword data, `placeholder: true`). Replace with real data: own `moves` table on
  the SWORD move set (Attack/Return/Heavy/Riposte clips, no new move set), `guard: 'blade'`, its own `material` value (the longsword is
  already `'iron'`; give the cleaver its own, e.g. `'crude'`, so audio can cue it heavier — audio does not consume `material` yet), `reach`
  measured from the baked frontier at the Pitborn's scale.
- Mesh: one-handed, heavy-bladed, notched, rope-wrapped grip, ≤ 4k tris, one 1K material set; node `WeaponDrawn` under `hand_r` with
  `extras.contact {from,to}` on the blade — the `build-weapon.mjs` pattern from the trident (PR #80). Build hook:
  `WARRIOR_FIGHTER=pitborn WARRIOR_WEAPON=cleaver node scripts/build-warrior.mjs` (the trident hook, per fighter).
- Bake: add `{ weapon: 'cleaver', glb: 'src/assets/pitborn.glb', node: 'WeaponDrawn' }` to `scripts/blade-manifest.json`, `node scripts/bake-blades.mjs`.
- Numbers to carry (combat-owned, provisional): heavier stamina costs and a longer heavy recovery than the longsword — the whiff is his
  weakness (tests/opponents.test.ts pins the fairness battery, the guard-break window and the whiff punisher as the best honest answer).
  Re-run that suite after the swap; retune `OPPONENTS.pitborn` there, not in duel.ts.
- It must not delay the trident: merge #80 first; the cleaver branch builds on it.

## Character lane (part 2, this branch)
`parts.py --fighter pitborn` (KIT: bare torso + rag sash, iron belt, rag kilt, wraps, barefoot, no helm, `brute` frame, tusks on the
scan head) → `WARRIOR_FIGHTER=pitborn node scripts/build-warrior.mjs` (BUILD.pitborn: root scale 1.13, hunch spine_02/03 +7°, neck −7°,
Head −6° on every clip) → `src/assets/pitborn.glb`. `tests/characters.test.ts` checks the shipped height against `OPPONENTS.pitborn.scale`
and that every non-hunched bone track is byte-identical to the hero's (same 21 clips, sword in the same hand).

## Audio lane
Voice set (heavy breath, grunt on heavy, roar on guard break, pain, death), cleaver material cue, heavier footsteps. `Hit/Blocked/Parried`
events carry `weapon` + `material`; nothing procedural in `build-audio.mjs` makes a voice today — the fight may ship voice-less.

## Not now
Ogre/cyclops scale (> 1.2×), new move sets, a third weapon, drops/loot, cutscenes, an intro taunt system.
