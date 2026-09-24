# Pitborn — lane state

The third opponent and the first creature: an orc-blooded pit brute on the hero rig at scale 1.13, hunched, tusked,
bare-chested, fighting with the cleaver. Rung 2 of the beta ladder. **This lane also owns the Shieldmaiden**
from 2026-09-22 (Dom's own line; Lead allocated, Strategy confirmed).
Append new entries at the TOP. Keep evidence and remaining validation in every entry (AGENTS.md).

## Now — 2026-09-24 ~15:30 (handover before /clear)

**Pick up: #680 bot report (Lead's assignment, Strategy pre-approved). Blood-flag PRs are done.**
- **#680** `pitborn/bot-limited-obs`, head `a962f66b`, base `codex/01a0ceea/task-3` (#668). Worktree = this checkout's main
  dir (`~/Developer/frankendom-pitborn`, branch pitborn/bot-limited-obs). Lead approved the fix: no `data-threat`
  (enemy "attack" = seen swing start → seen end), charge only from actorless `ChargeCue` (ignored on own hold) or hold time
  (heavy past windup+8). Report: per opponent W/L, chargedHeavies correct/guardedInto/other + cue named, defence table.
- **Batch in flight** (background, lock-aware, aborts+retries an opponent if a deploy starts):
  `$SP/batch.sh $SP` with `SP=/private/tmp/claude-501/-Users-domininclynch-Developer-frankendom-pitborn/a5938653-bdfb-4ddb-9c0c-a30aabaf0c92/scratchpad`.
  Progress `$SP/batch-progress.log`; fights `$SP/bot-limited-final/*.json`, `$SP/bot-debug-final/*.json` (summary.json is per
  opponent run, so aggregate from the per-fight JSONs). Scratch dies with the session: if it's gone, rerun
  `node scripts/player-bot.mjs --opponents=all --fights=3 --no-video` (limited) and `--observation=debug`, only when the lock is FREE.
  DO NOT edit files in the main worktree while it runs (each opponent is a fresh node process).
- **Then, still owed on #680 (all in the same report):**
  1. Merge #668's head `9483f894` into #680 as a normal commit. Conflicts in player-bot-review.mjs, player-bot.mjs,
     tests/player-bot-review.test.mjs are additive: keep their `defenceExchanges` AND my defenceEarned/summarizeDefences/
     chargedAnswers; my perception filter wins where they differ.
  2. Headless scenario script (Lead approved): node, real sim, no sim change — `initialPractice(seed, OPPONENTS[id])` +
     `stepPractice(p, intent, OPPONENTS[id].profiles.easy)`, or `stepDuel` with scripted opponent intents; `legal(f, action)`;
     actions `light|heavy|thrust|kick|dodge|backstep|parry`; a dodge with no move rolls AWAY from the foe. Delay = 11 ticks.
     KICK: close range, opponent holding guard → kick (vsGuard stagger 36) → (i) earliest legal quick attack (landed?) and
     (ii) reposition; report stagger ticks, whether `Staggered` is perceived (tick+11) inside the window. ROLL: back vs angled
     roll vs the same heavy (plain + charged), damage avoided, ticks to first useful hit, distance to wall (RADIUS 8.55), centre
     and near-wall starts. Cross-check kicks vs ~/Developer/frankendom-player-bot/artifacts/combat/kick-candidate-2 and
     kick-candidate-all-3 (READ ONLY, Codex worktree).
  3. GOBLIN: the loss is Codex's `~/Developer/frankendom-player-bot/artifacts/combat/limited-all-easy-3/goblin-2504048581.json`
     (read only). Replay seed 2504048581 in the browser under MY filter with a per-tick trace (legal = controls' aria-disabled /
     accepts(); requested = bot keys/press; accepted = player start events). Verdict: missed chance / unclear recovery feedback /
     rejected inputs / no escape; say whether the loss reproduces.
  4. Fact: the tactical bot never kicks (no KeyC in policy); opponents kicked it 35× in 18 interim fights.
- Send Lead (`Frankendom - Lead Developer`) the head + both batch results + the above. Post the report on #680.

**Blood flags — done, handed over.**
- #667 Dwarf Hammer Wound C: head `e052c1e1`, base trunk, CI green, Lead: "verified and READY to Deploy". SHIPPED
  `dwarf: { variant: 'C', name: 'Hammer Wound' }`, `blood: true` on C only. Evidence strip: branch `evidence/dwarf-wound`.
- #661 Butcher's Wake: head `690c74a8` (bloodMode added to the test frame after CI went red), CI green; taken by Executioner
  into #682 `effects/batch-0924`. Push NOTHING more to `pitborn/sig-butchers-wake` without telling Executioner/Lead.
- #666 Shieldmaiden Splintered Defiance: still waits for her shield.

**Gotchas:** `tsc -p .` does not type-check tests — CI runs `npm run typecheck:tests` (tsconfig.tests.json). Deploys start
often; the PreToolUse hook blocks tests/builds during one (even `node --test` on one file in a loop). Never pkill by name: another
lane's player-bot (artifacts/combat, step 64) runs on this Mac. zsh `$C:r…` is a filename modifier — brace variables before `:`.

## Then — 2026-09-24 ~13:00 (signature effects, Lead's assignment for Dom's 13:05 deadline)

**Three PRs open, all waiting on Dom via Strategy. Nothing to build until one comes back.** HOLD browser renders until Lead says
World's Witch strip has landed (Mac at load 50–100).
- **#661 Pitborn Butcher's Wake (A)**, head `e1169159`, base `world/signature-dwarf-stamp` @ `ef7e9f86`. `src/signature-pitborn.ts`
  + tests + one import line in `scene.ts`. His heavy tears a curved blood sheet off the cleaver → drops → 2 floor spots. Lead: reads;
  sent to Strategy.
- **#666 Shieldmaiden Splintered Defiance (A)**, head `61d65db2`, titled "waits for her shield (#606)". She has NO shield in game.
  Lead ruled **no fallback**: with no `userData.slot === 'Shield'` mesh the effect does nothing; with one, rim chips via
  `marks.shield` (cap 4) + splinters from the rim. Node-tested on a mock shield only, never rendered.
- **#667 Dwarf Hammer Stamp B + C** (prep, not ruled), head `402d5cb8`, into `world/signature-dwarf-stamp` (off `dc2d6368`).
  B = 2× dark bruise square (Strategy: "a smudge", frame 1 "a censor block"). C = chamfered-octagon hammer face, 0.25 s fade-in
  (Lead + me: still a flat black octagon, a hole/sticker not a bruise). A untouched. Next pass if asked: lighter mid-tones, a
  visible rim, less opaque core.
- **Veteran Battle Scars**: reassigned to Executioner. Not ours.
- **Open gap (World's, not ours):** no signature honours blood-off; `SignatureFrame` has no `bloodMode`.
- #661 and #666 each add an adjacent import line to `scene.ts`, so merging both gives a trivial conflict. All three need retargeting
  once #655 and the Dwarf branch land.

## Then — 2026-09-24 morning

**Nothing open in this lane.** Everything below the 09-23 handover has shipped; live `c0400c1f` contains all of it
(`git merge-base --is-ancestor`, checked against frankendom.com/release.json).
- **Shieldmaiden six (#595)** merged 09-23, live.
- **Her jaw band (#608, `dcb47253`)**: the dark chin read as a beard; fixed and carried to trunk by Run 3 (#616/#619).
  The "Open tonight" item below is closed.
- **Her kilt strips (#646, `07ad5c8`, merged 09-24 05:28Z)**: the hero's 11 kilt strips hung below her closed tunic
  and cut the mail into a jagged hem. `parts.py` KIT `'kilt': False`, her row only; every other fighter still gets 11.
  `level1_shieldmaiden.glb` 841,372 → 751,340 B, `shieldmaiden.glb` 6,370,680 → 6,290,728 B; her face/skin
  textures and `body_shieldmaiden.glb` re-baked byte-identical to trunk.
- **Next:** whatever Phase L (#589/#606, the Stats lane's) asks of the Pitborn and Shieldmaiden sets (materials). Not
  yet asked. The #595 known list stands as unassigned polish: her cap reads as a band at fight distance, her
  boots are mid-calf where the reference is low, and the Pitborn's shin plates sit slightly outboard.

## Then — 2026-09-23 night (handover)

**Phase R (six takeable armour pieces + weapon per opponent) was pulled forward to TONIGHT and is done for this lane.**
- **The Pitborn, #591**: MERGED into `phase-r` (run 1). Helmet (iron skullcap, replace), Body (rag sash + belt as `over`: it
  covers 26 % of the player's tunic, so it never undresses him; #434's floor applies to `replace` only), Arms (bone
  plates), Gloves (`~kit`), Greaves (shin wraps + scrap plate), Boots (foot wraps), cleaver. loot.glb +84.5 KB gzip.
- **The Shieldmaiden, #595**: OPEN, head `4b5a8a80`, for the next back-to-back run. Helmet (open banded cap behind the
  braids), Body (her tunic kit + mail skirt to mid-thigh, skirt filed under Body), Arms (shoulder plates), Gloves,
  Greaves (leg wraps), Boots; gladius from Weapons' #586. Toe fix done (boot tip extended up to 9.6 cm for the player's
  toes; the toe shape now shows in the leather). loot.glb +264.6 KB gzip. Loot tests 25/25 + tsc at `03029113`; the last
  merge (#598, two CSS lines) has no re-run because a deploy lock blocked it.
- Both are parts-pipeline fighters: Nightborn's TRELLIS weld does not apply; pieces are ray-fitted by the new
  `scripts/loot-fit.mjs`. Both `pitborn.glb` and `shieldmaiden.glb` were rebuilt so the opponents WEAR their six (the
  held Minotaur/Werewolf bakes on the Pitborn base go stale). Material is the base palette: **material at Phase L**.
- Known, listed in #595: her cap reads as a band at fight distance; her boots are mid-calf, not the reference's low
  pair; the Pitborn's shin plates sit slightly outboard. Stills (untracked): `artifacts/phase-r/*-wearing.png`.
- **Next for this lane, in order:** whatever Phase L asks of these two sets (materials); then the jaw band below.

**Open tonight, not pushed: the Shieldmaiden's dark chin/jaw band.** Visible at close range, reads as a beard. The fix
goes as a PR against trunk (a visual glb change, no sim files) with a same-frame before/after still for Lead. The work is
on LOCAL branch `pitborn/shieldmaiden-body` @ `74de033` (a WIP commit, deliberately not pushed). Next step: one
instrumented run that prints the chin texels' brightness at each stage of `head.py`'s scan-texture pass (after the
`jaw_skin` repaint, before and after `fill_margin`) to find which stage restores them. Measured so far:
- NOT the teeth (tinted pure red, the patch stayed black); NOT culling (a double-sided Photo changed nothing); NOT
  the normal map (sampled flat under the chin); NOT a second UV layer (the adapter head has one).
- REAL and fixed in the WIP: the female sculpt keeps parts of its head on BODY tiles, so the Face-tile cut left Skin
  standing inside the scanned head up to z 1.662 (now cut at the neck, z 1.566: `parts.py`, female only); and the neck
  stub took its tone from a ring of jaw shadow + nape hair (now her skin: `jaw_skin` pins `RING_TONE`).
- The shipped `kt_face_color` still carries dark texels at the chin's UVs (p10 luminance 0.118 in the lowest 15 % of
  the head) although the repaint logs ~56k texels changed, so a later stage overwrites them. Suspect `fill_margin`
  treating chin texels as gutter (`core` from `bake_attribute`); not proven.
- Drop the WIP's `teeth_scale: 0.6` before the PR: it changed nothing.

## Done — 2026-09-23

- **The Shieldmaiden into beta** (Dom, "put them live now"; Brief 15, reference A #498). Pushed into `roster-v0` at
  `80e991a`; roster-v0 is on trunk (`7b277fd`), and Combat's bump 8 (`RECORD_VERSION` 8) covers her row. What landed:
  - `parts.py` KIT `body: 'female'`: the realistic female body as a per-fighter switch (the Witch reuses it); the
    female sculpt's multires capped at 2 levels.
  - `head.split_tiles` packs any number of UDIM tiles (`atlas_cells`; the male's three keep their shipped quadrants).
  - Her own head: FLUX.1-dev portrait of reference A (`artifacts/source/face/shieldmaiden/shieldmaiden-01.png`, prompt
    beside it) → TRELLIS.2 → `trellis_head.py`; braid crown as mesh; `scale_by_eyes` (sized by height, the raised
    braids shrank her face to 0.79× and put the neck cut on her chin).
  - `trellis_head.py` BGR fix: the texture was read BGR against an RGB portrait (blue skin; the Nightborn's near-grey
    sample hid it).
  - Squared layered iron shoulder plates (Arms) in `build-warrior.mjs`, double-walled; gladius in hand;
    `shieldmaiden.glb` 3.47 MB gzip; last rung after the Witch.
  - `ARCHETYPES.shieldmaiden` = the Pitborn's profile verbatim at scale 1, a PLACEHOLDER for Combat's retune.
  - Gladius grip material `GladiusBone` → `GladiusBoneGrip` (finisher blood never paints the grip); player
    `gladius.glb` rebuilt from the same source.
- Phase-0 tint stand-in: written, then cancelled by Lead/Strategy before any push; nothing of it shipped.

## Open

- The jaw band (above): this lane, PR to trunk.
- Her loot pieces: tomorrow's assignment (above).
- Her shield-carry pose (#547 closed; not wired for an opponent): unowned, raise with Lead after the loot work.
- The roster-v0 weapon-flip snapshot had two NEW over-cap rows against the Plague Doctor (trident, scythe: `charged
  heavy only untouched 3/24`): Combat's battery, not this lane's.

## Gotchas (cost time today)

- **The deploy lock blocks `node --test` and Blender**, even single files, and deploys run back to back (5c0a32c then
  7b277fd). Queue work behind a watcher on `~/.claude/hooks/deploy_guard.py` `active_lock()`; never retry in a loop.
- **The deploy hook matches words in a whole command**, heredoc text included: a doc edit that mentions a bake is
  refused. Edit files with the Edit tool and keep builds in their own command.
- **Four lanes appending to the same pinned lists** (ROSTER, ladder, picker, loot-data, roster count, BUILD) conflict on
  every merge: keep both sides and re-sequence the rung assertions. `roster-v0` moved between fetch and push twice:
  always `merge-base --is-ancestor` before pushing.
- **The female body is not the male's topology**: 9 UDIM tiles (not 4), and head surfaces on body tiles. Anything
  keyed on "tile 0 = head" is wrong for her.
- **FLUX prompt trap (new):** "two braids"/"plaits" hang the braids past the shoulders every seed; "milkmaid crown
  braid … like a halo" keeps them on top.
- `character-preview.mjs` weapon stats list the HERO's longsword materials; read the opponent's `sword` panel.

## Earlier — 2026-09-22 (superseded by the entry above)

**BLOCKED ON #478 — the Shieldmaiden.** Her design direction is picked and her body is deliberately not
started. Strategy's ruling: silhouette stage only, nothing wearable before the shield asset lands, because a
half-built character across a dependency is worse than a parked one. Her shield is **a material variant and a
size of Multi Chars' single shield asset (#478), not a second mesh**; if her round shape ever needs a
structurally different mesh that is raised with Multi Chars before authoring, never absorbed here.

- **Picked: A, the hard outline** — Dom, 2026-09-22: "i think A", then column A's own panels pasted back with
  "this one", so the pick is anchored to the images and not just the letter. Mail hauberk to mid-thigh over a
  padded wool gambeson, squared layered iron shoulder plates giving a flat hard shoulder line, broad studded
  belt, plain iron vambraces, dark trousers with straight leg wraps, hard low boots, two tight crown braids.
  Approved as a **direction, not a render**: A's panels carry generator artifacts (half-open palms in the bare
  panel) that are not part of what was picked. Sheet, prompts and method in **#498**; B and C stay in the
  sheet as the record of what A beat.
- **She was chosen on outline, not mass** — but the numbers I first published for that are **withdrawn**
  (#498, `fde8d47`), and the claim "the Veteran sits inside the candidates' spread" was **false**. Two faults:
  my threshold mask cannot see polished plate or a painted shield face (they mirror the backdrop at its own
  luminance) and my flood-fill fuses arms into the torso where a hand rests on a thigh; and my bare panels
  held her arms out, so I was measuring **arm span** against references whose arms hang at their sides.
  Re-rendered bare with the arms pinned (same design, same seed) and re-measured off **u2net mattes** with
  the Executioner lane's harness (`scripts/character/silhouette.py`, #502). Corrected, bare: **A 0.284,
  B 0.319, C 0.276** against **Veteran 0.360, Executioner 0.374, Knight 0.367**. What holds is *their*
  finding, not mine — the three men cluster inside 0.014; her three spread 0.043 and the widest is widest by
  fur, not frame. Choose on outline, not build: the conclusion stands, the first evidence for it did not.
- **Her six takeable pieces are named and accepted** (Strategy, 2026-09-23; posted on #471). Helmet (an open
  iron-banded cap worn *behind* the crown braids, not a closed helm), Body (mail hauberk over its gambeson,
  carrying the studded belt), Arms (the squared layered iron shoulder plates), Gloves (iron vambraces on the
  shared `~kit.Gloves` mesh), Greaves (leather leg wraps), Boots. **No Crest** — that is the Centurion's
  ornament and reference A has nothing on the crown. **Recruit-2 = Arms + Body**, ruled in this lane's favour
  against Lead's handoff (which said Body + Helmet): the rule is "the two identity-carrying slots", Helmet +
  Body was the masked pair's instance and not a constant, and `src/loot.ts:44` puts shoulder plates in Arms
  (`pitborn.Arms` = his bone plates). Naming is not authoring; build order stays Recruit-2 first.
- **Her weapon has no loot slot yet.** `WEAPON_SLOTS` (`src/loot.ts:15`) is Trident, Cleaver, Knife, Estoc,
  Scythe, Warhammer — no bearded axe, gladius or maul. SCOPE.md's ten-weapon launch list needs it extended
  before her axe is takeable. Weapons' and Scalable Chars', flagged on #471 so it is not found at a kill screen.
- **The stripped question is CLOSED — do not re-escalate it.** Strategy dissolved it rather than deciding it:
  **there is no stripped state in the game.** Take-one removes at most one piece, the opponent respawns
  kitted, and a grade is a material variant on a shared mesh (`src/grades.ts`), so her Recruit scrap Arms has
  the same hard shoulder line as her iron one. **The silhouette gate is in-kit at every rung; the bare pass is
  informational, never a bar.** The measurement below stands; the bar inferred from it never existed.
- **The measurement that raised it (kept as evidence, not as a bar).** Loot v2
  makes gear takeable, so the real question is not "did the bare panel come back bare" but "does she read as
  *herself* with every removable slot off". With mail, shoulder plates, belt, vambraces and boots gone she
  goes **0.284 → 0.240 and reads as a generic thin woman**; the flat hard shoulder line A was chosen *for* is
  the shoulder plates. Evidence `shieldmaiden-stripped-v2.png`. Raised with Lead, deliberately not solved
  Evidence `shieldmaiden-stripped-v2.png`. Two outcomes came out of raising it: SCOPE.md's withdrawn figure
  was replaced (#492, `70d210a`) and this lane's rule **"stance before breadth"** went into AGENTS.md under
  its own name (#499, `ec60165`) — a silhouette comparison is only valid between figures in the same stance,
  and no measurement code can tell you when it is not.
- **Her brief no longer understates her cost.** #471 said *cleaver* in three places and rested a "zero new
  animation authoring" saving on the Pitborn's `Cleaver_*` set; the bearded-axe amendment removes that saving.
  Fixed by Lead at `f6af593` — verified on `origin/lead/brief-shieldmaiden`: §1 now states the axe is a NEW
  one-hand family, §2 states the cost plainly (~13 clips on Weapons and the animation pipeline, not Combat),
  §4 records ONE-HAND as the one cleaver property the axe preserves so shield and axe need no stow case.
  Combat's queue (knife → cleaver → estoc → shield) was deliberately left alone — that cleaver is their flip.
- **Next, when #478 is on trunk:** her body to direction A, one PR per deliverable, silhouette tested at the
  fighter's camera bare **and** in loadout. Bare is the real test: the shield is lootable, so an outline that
  only reads with the shield up fails the moment a player takes it.

**The Pitborn himself: nothing building and nothing open.** Every Pitborn PR is merged and live; the worktree
`~/Developer/frankendom-pitborn` is clean and detached at trunk.

**Live carries this lane's work** — verified on the served file, not on the merge. Live `05622cf` serves
`assets/pitborn-6VGMI4zq.glb`, HTTP 200, 3,473,712 B. Its bytes are **not** the source bytes: deploy meshopt-packs assets,
so compare sources, not downloads — `src/assets/pitborn.glb` is sha256 `4817820151…` at both live `05622cf` and trunk
`dcb9d61`, i.e. live is serving the current body. The 2026-09-20 roster hold is in live too (`c2f7b28` is an ancestor):
`minotaur wraith werewolf skeleton` all carry `hold: true` on trunk, so the beta ladder is the five men.

**What he is on trunk.** Recipe `pitborn: { name: 'the Pitborn', body: 'pitborn', rig: 'hero', archetype: 'pitborn',
weapon: 'cleaver' }`. Simulation `OPPONENTS.pitborn` is **combat-owned, not this lane's**: scale 1.13, health 190, poise 16;
normal `{reaction 14, accuracy .85, parry .15, dodge .1, aggression .8, pressure .7, discipline 25, lapse .1, read .6}`.
The reaction/lapse retune (18 → 14, .3 → .1) is the Combat lane's 09-20 entry — see `docs/state/combat.md` "Combat: Pitborn
tune"; tune there, not here, and re-run `tests/opponents.test.ts`.

**Another lane last rebuilt his body.** The spider-hand fix (`docs/state/character.md`, "Spider-hand fix reaches the
opponents", 2026-09-22) rebuilt pitborn/goblin/nightborn through `parts.py`. Checked after it: the texture diet survived
the rebuild — `photo_orm_1k` is still in `head.py` (3 refs) and both bare-kit guards are still in `parts.py`, and the
trunk file measures **84 MB GPU texture estimate / 3.09 MB gzip, 31 images** (was 116 MB before the diet; the ~4 MB over
the diet's 80 is that lane's finger/AO maps, not a regression).

**Open, nothing started:**
- A read-only look at the live journal picker (four greyed "(on hold)", five live) was never taken — held back under the
  ONE-DEPLOYER no-local-browser-runs rule and no FREE signal since. One headless page load when the deploy session is idle.
- Kit pass, parked after the owner's "char is good" on 09-16: iron knee plates and bone plates as **authored parts**
  rather than `build-warrior.mjs` ellipsoids, rope-textured wraps, tusk polish. The classic-body `knee()` primitive is not
  an option — it renders as black boxes on the realistic body.
- Measurement gap raised and not owned by anyone: `character-preview.html`'s texture table counts the **hero's** textures
  only, so no phone-memory number has ever included the opponent.
- His cleaver is Weapons' (`docs/state/weapons.md`, cleaver v1) and the flip was Combat's (`docs/state/combat.md`,
  "Slice W — the Pitborn fights with the cleaver"). This lane does not touch either.

## Done — 2026-09-16 → 20

- **#81 the opponent seam + his body** (merged `89c91fe`). `Opponent`/`OPPONENTS`/`Level` in moves.ts — weapon, body
  `scale`, `health`, `poise`, a profile per level, so a new opponent is a record and not an AI branch; `Fighter.scale/poise/
  maxHealth`; the blade sweep's capsule and head/torso/legs regions scale with the target; **passive poise** — a plain clean
  hit under the threshold wounds and builds posture but never staggers or knocks back (heavies, counter/stop/rear and
  charged always do). `initialDuel()` stayed byte-identical to the Veteran (deep-equal test). Body from `parts.py --fighter
  pitborn` + `BUILD.pitborn` (scale 1.13, hunch +7/+7/−7/−6 on spine_02/03, neck_01, Head) — KeenTools head from seven owner
  portraits, tusks cut on the scan, rag sash, crude iron belt, rag kilt, wraps, barefoot, no helm. Stands 1.957 m to the
  hero's 1.745. `tests/opponents.test.ts` (fairness battery at normal and hard, held guard broken in every fight, the
  off-line whiff punisher as the best honest script) and the Pitborn parity test in `tests/characters.test.ts`.
- **#84 the bone plates go dark** (merged). Owner's first look: "char is good, just make the white bone a bit darker, or
  same as the brown leather colour". Plates got their own `BoneWorn` material (`#6e5d45`, roughness .72); the tusks kept the
  ivory `Bone` so the face still reads.
- **#179 texture diet + phantom rivets → reverted → re-landed in #194.** His two 2048² maps (the rag sash's colour, the scan
  head's roughness) carried nothing a phone resolves at 3 m and ship at 1024: **116 → 80 MB GPU texture estimate**, gzip 2.94
  → 2.90 MB. Scoped to his own rows (`linen_maps(size=1024 if KIT['bare'])`, `FIGHTERS.pitborn.photo_orm_1k`) so no other
  fighter's bake path changed. The black specks on his back and chest were **not** the scars pass — they were the kit's 22
  baldric rivets, still placed along a baldric a bare fighter never wears; none for `KIT['bare']`, belt rivets kept.
  **Why it was reverted (`63f4cd9`):** the Minotaur and Werewolf are creature bakes on the Pitborn base and record its
  sha256, so a new `pitborn.glb` made them stale at release check 20. The rebuild route (#185) was closed in favour of the
  owner's call to hold them.
- **#194 the roster hold** (merged `a20a785`, live). Owner, 09-20: Minotaur, Wraith, Werewolf and Skeleton are Season 2,
  "keep them, don't delete or lose". `hold: true` on a recipe keeps it built and a valid `OpponentId` — saved encounters
  still resolve, `opponentFor` falls back to the first rung — but takes it off the ladder (`LADDER`/`nextAfter` skip it; a
  held id has **no next**, an index-0 wrap the test caught), lists it disabled "(on hold)" in the journal picker, leaves its
  GLB out of the bundle via `scene.ts`'s asset glob, and makes `creature-check`/`creature-browser-check` skip held families
  (still runnable on demand). `tests/ladder.test.ts` pins the five-man ladder, the fallback, and that the glob exclusions
  match exactly the held bodies. Dist **29.9 → 17.9 MB** gzip; no creature GLB in `dist/assets`; picker probe showed four
  disabled, five live. `.quality-gate.json` deliberately untouched (Lead's gate split #187 owns the creature-only checks).
- **#196 the release check learns the hold** (merged). Deploy #6 failed at check 2/25 — `roster-browser-check.mjs` looped
  every `ENCOUNTERS` id and asserted the opponent's health, but a held `?opponent=` renders the first rung by design
  (`actual 150, expected 190`). This lane's miss: the gate is release-only, not in `npm run quality`. The live rungs are now
  checked as fights and each held id as a **fallback** — Veteran's health, exactly two rigs fetched, and no creature GLB
  requested. Reproduced on trunk first (exit 1 at minotaur), then `"passed": true`; `npm test` 323/323.

## Pipeline — how to rebuild him (do not re-derive)

`HEAD_KT=1 blender -b -P scripts/character/parts.py -- --body realistic --fighter pitborn` (~4 min) →
`WARRIOR_FIGHTER=pitborn node scripts/build-warrior.mjs` → `node scripts/character-preview.mjs --label <x> --enemy
/src/assets/pitborn.glb`. The worktree needs all six `artifacts/source/{base,animations,animations2,human-base-meshes,
hunyuan,lps,outfits}` symlinked from the char worktree.

Traps, each paid for once:
- **Never `skeleton.pose()`** in `build-warrior.mjs` — it changes the exported rest transforms and breaks the `hand_r`
  parity test. The hunch is post-rotations about bind-pose sideways axes.
- **`tusks()`** roots at `mouth_z − 0.020`, where `mouth_z = eyes.z − 1.1 × eye spacing`: the scan is cut under the jaw, so
  the chin is not a landmark.
- **`FIGHTERS.pitborn.skin_mul (0.74, 0.80, 0.84)`** exists because the scan's neck band is lit paler and warmer than his
  grey-green cheeks; without it the body came out tan beside the head.
- **Any change to `pitborn.glb` makes creature bakes on his base stale** (`creature-check` hashes it). While the Minotaur
  and Werewolf are held this costs nothing; if either is unheld, a Pitborn body change ships with their rebuild.
