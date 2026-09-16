# Frankendom: Origins — Opponent 5: THE NIGHTBORN (vampire duelist)

Ladder: Veteran (trident — reach) → Pitborn (cleaver — pressure) → Goblin (knife — speed) → **Nightborn (estoc — restraint)**.
GAME_SPEC: "Vampire — parries everything: teaches restraint and baiting." He is the last lesson of the core set, and the
reference build for the **Nightborn** player Origin ("gothic, vampiric, elegant") — the kit is reused, so build it as a family.

Same rig, root scale **1.0** (height from re-proportioning, not the root — see Character lane), the sword clip family, a thin
estoc, a new AI profile. No new move set; no new clip except one re-key allowed (Parry, see Readability).

Facts below are read from trunk `b5f2114` (2026-09-16, after #81 Pitborn, #83 trident-live, #84 plates). Where the draft brief
and the code disagreed, the code wins and the correction is marked **(corrected)**.

## Sequencing — read before branching
Three character builds (Pitborn shipped, Goblin in a worktree, this one) and four weapons (trident, cleaver, knife, estoc) move
through the same pipeline files. Order of merges is fixed by the lead: **Goblin → (budget decision, § Lead) → Nightborn.**
Weapons: trident (#80 merged) → cleaver (#82 open) → knife → estoc.

- Branch `char/nightborn-v1` in your own worktree (`git worktree add ~/Developer/frankendom-nightborn -b char/nightborn-v1
  origin/codex/01a09a76/task-1`). Trunk is `codex/01a09a76/task-1`, NOT `main`. Never deploy from your worktree.
- Symlink all six `artifacts/source/{base,animations,animations2,human-base-meshes,hunyuan,lps,outfits}` from the char worktree
  (the Pitborn build failed without them). `.env.keentools.local` (git-ignored) holds the KeenTools key; source it before
  `create-head.mjs`. `.env.production.local` is not needed (you do not deploy).
- Rebase on trunk daily. The combat lane lands PRs fast; merge trunk into your branch and re-gate (`npm run quality`) before
  asking for merge. Lesson from the Veteran: a green branch that is a day behind trunk is not green.
- **Conflict map** — the Goblin PR edits the same hunks you must edit. Append your entry at the END of each table/union with a
  trailing comma and a `// nightborn` marker; on rebase take both, never drop his:
  - `src/moves.ts`: `WeaponId` union (+`'estoc'`), `WEAPONS` (+placeholder), `OpponentId` union (+`'nightborn'`), `OPPONENTS` (+entry)
  - `src/scene.ts`: `OPPONENT_GLB` (+`nightborn: …/nightborn.glb`)
  - `src/characters.ts`: `WEAPON_CLIPS` (+`estoc: { Thrust: 'Riposte' }`, the cleaver's line)
  - `scripts/build-warrior.mjs`: `BUILD` table (+`nightborn`), the per-fighter `steel`/`heraldry` ternaries (see § Lead: ask for a
    lookup table before you add a fourth arm to those chains)
  - `scripts/character/head.py` `FIGHTERS`, `scripts/character/parts.py` `KIT`/`FIGHTERS`
  - `tests/characters.test.ts` `FIGHTERS` list + `SCALE` map
  - `scripts/blade-manifest.json` (+ your GLB); `src/blade-paths.ts` is GENERATED — never hand-merge it, re-run
    `node scripts/bake-blades.mjs` after every rebase and commit the result.
- No camera, combat-rule, weapon-code or audio edits. Requests → `artifacts/nightborn/REQUESTS.md` (probe scripts, logs and
  stills also live under `artifacts/nightborn/`, like `artifacts/pitborn/`).
- Dependencies: **(a)** the Goblin merged (his `reproportion` in build-warrior.mjs is what you build on); **(b)** the lead's
  budget decision (§ Lead — as the gate stands your PR cannot merge); **(c)** the three combat knobs (§ Combat lane) — without
  them he is a reskin and GAME_SPEC says a reskin is not added. Hit-region height: `blade.ts` already scales the capsule and
  regions by the target's `scale` (#81); at ~1.03× you sit inside the Pitborn's proven range, so no new height work is on your path.
  Keep root scale 1.0 so the scale-bake caveat (weapons REQUESTS § 6) never applies to him.

## Identity (owner-locked)
Tall, upright, still. Narrow shoulders, long limbs, a very straight spine, chin up. Pale grey-white skin, dark hollow eyes, black
hair tied back, a thin old scar across the throat. Kit from the materials rule: black-dyed wool and worn leather, a high collar,
dull iron fittings. No cloak (cloth sim is NOT NOW). No glow, no red eyes, no fog. Supernatural comes from stillness and posture,
not effects.

- **Fangs (corrected):** `build-warrior.mjs` strips every morph target (line 53) and no fighter has a facial rig — his mouth never
  opens, in idle, hit or death. v1 = a closed mouth and no fangs. "Fangs when he opens his mouth" is a facial-rig request, not a
  kit item; log it in REQUESTS as NOT NOW.
- **Silhouette test (corrected):** the tallest UPRIGHT man in the roster — the Pitborn stands 1.957 m but is a hunched slab; the
  Nightborn is ~1.80 m and a vertical line. At 3 m on 393×852 the read is: one straight pale line, one blade. If the Veteran and
  the Nightborn are told apart only by colour at that size, the build is wrong, not the texture.
- **Hair:** black, tied back. Dark hair is the pipeline's easy case (`hair_lum` 0.16 = the hero's rule; the Veteran's pink scalp
  came from blond). Paint the scalp slicked back; a queue/ponytail, if the silhouette wants one, is an authored part riding rigid on
  the Head bone — the tusk/crest pattern — not hair sim.
- **Throat scar:** the scan is cut under the jaw, so the throat is body mesh → `head.py body_scars` with a single thin mask at the
  neck. Not a head feature.
- **Skin:** `keentools_skin_tone` derives the body tone from the face hue, so the PORTRAITS must be grey-white from the start
  (see `artifacts/source/face/GPT-BRIEF-jaw-shots.md` for the portrait set the scan needs). Expect a `skin_mul` pass like the
  Pitborn's (his neck band lit warmer than his cheeks). Keep pale skin MATTE — the owner rejected every hot spot on the bronze;
  on white skin a hot spot reads as wax, and wax is the effect we are not doing.
- **Eyes:** hollow = shadow, not geometry: deepen `face_ao` at the sockets, a darker iris in `eye_color`, and a low-sheen
  `eye_orm`. No emissive, no red.

## Fight identity — "don't spam; bait him"
- Parries everything obvious: highest parry rate in the roster, fast reaction, ripostes hard.
- Elegant pressure: thrusts and short chains; steps in and out on a straight line rather than circling.
- Weaknesses, all through ONE mechanism — **he commits to the parry early**:
  1. **Feints.** He raises the blade inside your feint window; cancel the cut and his parry meets nothing → he is `exposed`
     (the whiffed-parry state that already exists in duel.ts) long enough for a free light.
  2. **The charged heavy (corrected).** A charged heavy is NOT unparryable — the HUD says "roll or parry the release". He beats
     the honest heavy; what beats him is holding the charge until his early parry has come and gone, then releasing into the
     standing guard his parry decays into. "Read his rhythm" means exactly that.
  3. **The kick (corrected).** A parried player is stunned 90 ticks (`parryStun`) and cannot kick out of the riposte. The kick's
     job is to open his standing guard (unparryable; his dodge share is low, so he mostly takes it). Not a riposte interrupt.
- Medium health, normal stamina; he does not exhaust easily — you win by outthinking, not outlasting. **Poise:** the draft said
  "medium"; recommend 0. Poise above a light's damage (14) would stop the feint→punish light from staggering him and blunt the
  lesson he exists to teach (the Pitborn's 16 is a brute rule, not a duelist's). Combat lane decides.
- Teaches: patience, feint→punish, choosing the charged heavy at the right moment.
- Combat lane owns all numbers.

## Readability rule
His parry must be visible and EARLY: the blade comes up in the first half of your cut's wind-up (tick ≤ 8 of 20) so the player
sees "he is going to parry this" and can feint out of it. This is the same rule as his weakness — one knob serves both.
- The riposte tell is already honest: `riposte` wind-up 12 ticks, `heavy_riposte` 20. Do not shorten either for him.
- **Parry pose:** one clip re-key is allowed, on the cleaver precedent (its Heavy was re-keyed to a diagonal hack): `Parry`, higher
  and wider, so a raised estoc reads at phone size. Every other clip byte-identical to the hero's (the parity test).
- A player who cannot see the parry coming at phone size has been given a bad clip or a late press, not a hard opponent.

## Weapon: estoc — contract for the weapons dev (after trident, cleaver, knife)
Long, thin, thrust-first blade, black iron guard, wire grip. **Sword clip family** — the thrust is the `Riposte` clip, the cuts are
the sword's; so like the cleaver it needs NO renderer work beyond `WEAPON_CLIPS.estoc = { Thrust: 'Riposte' }` (characters.ts).
- `WeaponId 'estoc'` lands first as `{ ...LONGSWORD, id: 'estoc', placeholder: true }` (the character lane adds it so the Nightborn
  can be built and tested with the longsword's data). The weapons lane replaces it with real data.
- Mesh: ≤ 2k tris (the trident is 652; a thin blade needs less), one 1K material set, node `WeaponDrawn` under `hand_r`,
  `extras.contact {from,to}` on the last 40 cm — the `build-weapon.mjs` pattern. Hook: `WARRIOR_FIGHTER=nightborn
  WARRIOR_WEAPON=estoc node scripts/build-warrior.mjs`. Bake: add the GLB to `scripts/blade-manifest.json`, `node scripts/bake-blades.mjs`.
- **Material (corrected):** the longsword is already `'iron'`; an estoc marked `'iron'` sounds like the longsword. Add `'steel'` to
  `Material` (moves.ts, one word in the union) so audio can cue it thin and bright — the cleaver brief did the same with `'crude'`.
- **Reach — the cleaver lesson:** measure the frontier from the baked paths at his rig, then write per-move `reach` in the sword's
  CONSERVATIVE spacing convention (longsword 1.65 / 1.9 / 2.0), not the measured frontier, or the AI hangs out of range. The draft's
  "~1.8 m" is a single number; the table wants three. Lunges (`stepIn`) must EQUAL the sword's, scaled by wind-up, or the
  backstep stops escaping (the cleaver stalled on this).
- `fight: { thrustShare, close }` is per-weapon data (#83): the estoc's `thrustShare` high (the trident is .6, the sword .2) and
  `close` at the sword's 1.15 — this is where "thrust-first" lives; it is not an AI-profile field.
- Cuts with a thrust-first blade: lower `damage`/`chip` on lights than the sword, a little more on the thrust — weapons lane
  proposes, combat lane keeps the fairness battery green (`tests/opponents.test.ts` is the gate; the cleaver passes it ON the floor
  at 4/24 normal — do not land below).
- Until it ships, build and test him with the longsword (the placeholder does exactly that).

## Character lane (this branch)
Fifth GLB via the per-fighter pipeline. Commands (the Pitborn's, with the fighter swapped):
```
HEAD_KT=1 blender -b -P scripts/character/parts.py -- --body realistic --fighter nightborn    # ~4 min
WARRIOR_FIGHTER=nightborn node scripts/build-warrior.mjs
node scripts/character-preview.mjs --label nightborn-v1 --enemy /src/assets/nightborn.glb
```
- **Build = the Goblin's `reproportion`, not a root scale.** `BUILD.nightborn` in build-warrior.mjs: root `scale: 1`, per-bone
  scales about their own joints with rest positions and inverse binds rebuilt (the Goblin's mechanism — legs ×.84, arms ×1.16 for
  him). For the Nightborn, starting values: legs ×1.04, arms ×1.06, clavicles ×.92 (narrow shoulders), neck ×1.05. Measure the
  standing height; write the measured ratio (~1.03) to `OPPONENTS.nightborn.scale` — the hit capsule follows the man's height,
  and `tests/characters.test.ts` pins the ratio (`SCALE` map). Write `stride` like the Goblin so his walk keeps his own pace.
- **Posture = post-rotations about bind-pose sideways axes, the Pitborn's `hunch` list with the opposite sign:** e.g.
  `[['spine_02', -3], ['spine_03', -3], ['neck_01', 2], ['Head', 5]]` — straight back, chin up. **NEVER `skeleton.pose()`** (it
  rewrites exported rest transforms and breaks the hand_r parity test). Never the classic-body `knee()` (black boxes on the realistic body).
- **Idle stillness (corrected):** not amplitude edits to the Idle tracks (the parity test wants every non-posture track byte-identical).
  Do it the Goblin's `stride` way: write an `idleScale` datum into the GLB (≈ .6) and have the runtime play `Idle`/`Armed` at that
  `timeScale` — slower breathing reads as stillness with no clip change. The one-line read in characters.ts is a request to the
  lead (visual dev owns the file; the datum is yours).
- **KIT (`parts.py`):** `helm: false`, `greaves: false`, a lean `build_shape` (the Veteran's B2 is broad; add a thin variant), the
  wool tunic through `gambeson_color` dyed near-black — **not pure black**: below ~12 % value the normal map and AO have nothing to
  shade and he becomes a hole at phone size; leather via the per-fighter `leather_orm/normal`; a **high collar** as a new authored
  part on `neck_01`/`spine_03` (the Goblin's cord/teeth are the precedent for parts that rest on the man) — check it does not clip
  the chin-up Head in `Hit`/`Death`; throat scar via `body_scars`; boots not bare feet.
- **Materials (starting values, art-owned):** the per-fighter `steel` in build-warrior.mjs → dull iron: a dark desaturated grey,
  metalness ~.7, roughness ~.7 (the approved bronze is rough .63/metal .80 — stay rougher than it; the owner rejected every
  hot spot). `heraldry` → the black dye. Do not re-litigate the bronze; you are not using it.
- **Head:** GPT portrait set (pale, gaunt, black hair back, ~30s, no beard) → KeenTools scan (billed) → `head.FIGHTERS.nightborn`
  `{scan, cams, chin: True, hair_lum: .16, hair mode}`. Chin is NOT a landmark on the scan (cut under the jaw); the Pitborn's
  `mouth_z` rule applies if you place anything on the face.
- **Contract held:** 21 clips (+ the one Parry re-key), `hand_r` attachment, sword paths untouched, `tests/characters.test.ts`
  green with the Nightborn added to `FIGHTERS`/`SCALE` and every non-posture track byte-identical to the hero's.
- **Budget (corrected — the cap is 16 MB, not 5):** `check-budget.mjs` throws at 16 MB gzip over `dist/`. Fighters today: hero
  3.35, Veteran 3.71, Pitborn 3.04, Goblin 3.11 (worktree) MB gzip, shell ≈1.3 → ≈14.5 with the Goblin; your ~3.3 puts dist at
  ≈17.8 → **the gate throws on your PR**. Target ≤ 60k tris (Veteran 59.4k, Pitborn 58.3k; a thin build does not need more) and
  ≤ 3.3 MB gzip, and do not lower quality to fit: the fix is the lead's (§ Lead), decided before you open the PR.
- **Evidence in the PR:** turntable, clip sheet, lock stills (harness `faces()`, `details(list,'opponent')`), a 6 s exchange vs
  the Veteran baseline, the silhouette test at 3 m/393×852 with all four opponents in one frame, size/tris deltas. The Pitborn took
  three render rounds with the owner; plan for that, post the first still early.

## Combat lane (data first, then the battery)
`OPPONENTS.nightborn` in moves.ts — as data, provisional, the Goblin's easy/normal/hard shape:
```
nightborn: { id: 'nightborn', weapon: 'estoc', scale: 1.03 /* measured */, health: 150, poise: 0, profiles: {
  easy:   { reaction: 14, accuracy: .70, parry: .45, dodge: .10, aggression: .45, pressure: .50, discipline: 55, lapse: .30 },
  normal: { reaction:  8, accuracy: .85, parry: .70, dodge: .10, aggression: .55, pressure: .60, discipline: 45, lapse: .15 },
  hard:   { reaction:  6, accuracy: .95, parry: .80, dodge: .15, aggression: .70, pressure: .60, discipline: 40, lapse: .05 },
} }
```
For scale: Veteran normal is reaction 14 / parry .3; hard 10 / .6. The spammer read already boosts parry ×2 to the `READ.parryCap`
of .85 and anticipates cuts at 8 ticks, so "punishes spam" is mostly there; `parry` is also capped at `1 − dodge`.

**Why the profile alone is a reskin.** Today the AI plans at `reaction` and PRESSES the parry only when `estimate <= RULES.parry − 2`,
i.e. 8 ticks before contact — tick 12 of a 20-tick cut. The player's feint window closes at tick 10 (`feintUntil`), and a cancelled
swing drops the plan (`if (!threat) next.plan = null`). So no profile value makes him feintable: a feint costs the player 10
stamina and draws nothing. Three per-opponent knobs, all data, no new move:
1. **Parry window per opponent** (`RULES.parry` 10 → his ≈14). The slot exists: `guardOf()` spreads `f.guardProfile` (duel.ts:57), whose `window` is fed only from the weapon today (the trident sets `costScale`/`heavyBreaks` there); let `Opponent` set it too. No new field on `Fighter`, just a second source for an
   existing one. A longer window is both his strength (more honest swings parried) and his weakness (see 2).
2. **Press at `contact − window + 2`** instead of `contact − 8` (the same line in ai.ts, generalised). With window 14: cut pressed
   at tick 8 (< feintUntil 10 → feintable), thrust at tick 8 (< 9 → feintable, just), heavy at tick 22 (> 11 → not feintable, but
   CHARGEABLE: hold past his window and the release meets a standing guard). That is the whole design in one number.
3. **Whiffed-parry exposure per opponent** (`RULES.parryRecovery` 8 → his ≈16): feint at tick 9, his window closes at ~22,
   exposed to ~38; the player's light started at ~11 lands at ~31 — inside. At 8 it lands on the edge and the lesson is a coin flip.
   Do not touch the Veteran's 8.
- **Riposte preference:** the AI's punish is `light_right` at score 1.5 (ai.ts:127), which the punish window turns into `riposte`
  (duel.ts:78); the heavy riposte is not chosen by profile today. If a `heavyRiposte` share is wanted, it is a fourth knob; not needed
  for v1.
- **Straight-line footwork:** `circle` is an `AiMode` chosen by fixed shares (ai.ts:96). A circle share per profile is a v1.1 knob;
  ship v1 with the shared footwork and log the request.
- **Tests (extend `tests/opponents.test.ts`, the battery is the gate):** AI-vs-AI 25–45 s at normal, 24 seeds, no stalls; a
  cut-only player is parried repeatedly (rate ≥ Veteran hard's); a feint→light strategy lands free hits (≥ 12/24 exchanges
  produce an `exposed` hit); a charge-held-past-the-window heavy breaks his guard (≥ 12/24); the Veteran brain does NOT beat him
  by outlasting (`StaminaExhausted` never the deciding event). Probe scripts under `artifacts/nightborn/`, as the Pitborn's.

## Audio lane
Voice: near-silent breath, one sharp exhale on the riposte, no grunts, a quiet hiss on hit, a dry death rattle; light precise
footsteps. Estoc material `'steel'` → the thinnest, brightest blade cue; **his parry gets the brightest clang in the game** so the
player hears the lesson. `Hit/Blocked/Parried` events carry `weapon` + `material`; nothing in `build-audio.mjs` makes a voice
today, so he may ship voice-less like the Pitborn.

## Lead
- **Budget decision, before the Nightborn PR (blocking):** the gate measures total `dist/` (all GLBs), but a phone downloads the
  shell + hero + ONE opponent (`loadWarriors(url, opponentUrl)`). Recommended: re-scope the gate to the per-fight payload
  (worst pair today: 1.3 + 3.35 + 3.71 = 8.4 MB → cap 9 MB) plus a separate host ceiling for total dist. Alternative: a fourth
  raise (5 → 12 → 16 → 20), which is the pattern that means the gate measures nothing. Texture sharing across fighters is the
  third option — measure what is actually shareable (bronze/leather/wrap ORM+normal; faces and skin are per-fighter by design)
  before promising a number.
- **CI (corrected):** it exists — `.github/workflows/quality.yml` runs `quality:ci` (lint, unit tests incl. both batteries, build,
  audit, budget) on every PR; the browser gate is local only. What does NOT exist is enforcement: private repo on the free plan →
  branch protection is unavailable (API 403). "Nothing merges until CI is green" is therefore the lead's hand rule until the repo
  goes public or Pro. Say so in every PR.
- Refactor request before the fourth fighter: the per-fighter `steel`/`heraldry` ternary chains in build-warrior.mjs → one lookup
  table keyed by fighter (a Goblin-sized PR, no output change; verify by `cmp` on all existing GLBs).
- `idleScale` read in characters.ts (one line), `'steel'` in `Material`, the three combat knobs (or their refusal), the ladder entry
  after the Goblin (`?opponent=nightborn` at boot until `profile.ladder`), and the Nightborn kit registered as the player Origin's
  art family.

## Not now
Bites, drain, regeneration, transformation, mist, bats, a cloak, night lighting, fangs (no facial rig), red eyes, a circle-share
knob, a heavy-riposte knob — none of it. A vampire in this game is a duelist who doesn't bleed much.

## Decisions needed from the owner
1. Poise 0 (recommended) or a small value — see Fight identity.
2. Budget: per-fight gate (recommended) vs another raise vs texture sharing.
3. Hair: painted slicked-back scalp (v1) vs an authored queue on the Head bone.
4. The three combat knobs as per-opponent data (recommended) — or the Nightborn waits.
