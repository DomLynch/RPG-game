# Executioner — lane state

The sixth opponent: the giant in the iron half-mask, scythe, hero rig at scale 1.36.
Append new entries at the TOP. Keep evidence and remaining validation in every entry (AGENTS.md).

## Now — 2026-09-25: #728 (Splintered Defiance on her shield) replaces #666; with Lead for Strategy

**Now (next session):** nothing to build. #728 `char/splintered-defiance` @ 0b5c4060 (draft, base world/tier-dressing) is #705 @ 3cf1018b
+ #706 @ 46b28f2f merged + #666's two commits cherry-picked. Lead: #728 REPLACES #666 and merges after #705 and #706 in the post-playtest
chain; Lead takes the sheet to Strategy with the chain. When #705 lands, retarget #728 to trunk (it is draft on a non-trunk base, so CI
skipped) and let CI run. Push only if CI goes red or Strategy says NOT YET.

**Done**
- #728: scene.ts signature imports as a union; `node scripts/split-loot.mjs` regenerated the carriers from #706's loot.glb (deterministic:
  #705 alone reproduces byte-identical); carriers-shieldmaiden.glb 2,487,524 -> 2,588,112 B, every other carrier +~10.4 KB. The #666 test
  frame gained `bloodMode` (SignatureFrame requires it now). Checks: tsc, typecheck:tests, signature tests 39/39, npm test 612 pass / 0 fail,
  check-budget PASS (dist 38,606,035 of 40,000,000 gz).
- Receipt: labelled 375x812 sheet, seed 11, her Blocked heavy_overhead, probe `fired 1, shield 1`: she carries the board shield,
  splinters leave the rim, tumble past both sides of the player, land. Sent to Lead (and Dom). Not checked on an iPhone.
- #666: comment points to #728; left open for Pitborn to close (Pitborn told).

**Open** Strategy's verdict on the sheet (via Lead). CI on #728 once it targets trunk.

**Gotchas**
- A player heavy she blocks arrives as `Blocked` with actor = OPPONENT_SIDE (the blocker), not the attacker. Harness: untracked
  `scripts/zz-sig-strip.mjs --opponent shieldmaiden --want blocked --at -60,0,6,14,40` (seed 11 matches at frame 380).
- `view.setSignature(search, selected, toolsOpen)` now: pass `'?signature=on', null, true` or the probe says mode `ship`, effect null.
- No PIL / ImageMagick on this Mac: compose sheets with Playwright (import node_modules/playwright/index.mjs by absolute path from scratch).

## Now — 2026-09-24 late: #666 UNBLOCKED; build it on #705 (world/tier-dressing @ 3cf1018b)

**Now (next session):** #666 (Shieldmaiden signature A, Splintered Defiance; pitborn/sig-splintered-defiance @ 61d65db2). Lead: the
opponent loot carriers ride INSIDE #705 (World's tier dressing, Strategy PASSED @ 3cf1018b); there is no separate carriers PR.
Stack #666 on `world/tier-dressing` (base it there, or rebase once #705 lands after the playtest), merged with #706 (her shield,
char/shieldmaiden-shield @ 46b28f2f) so she actually carries a Shield-slot mesh. Resolve the scene.ts signature import block as a
union (as #682 did). Receipt: a labelled 375 still of HER wearing the shield (plus the splinter strip on a blocked heavy) to LEAD first,
then Strategy. Tests: tsc, typecheck:tests, npm test, `node --test tests/signature*.test.ts`, and check-budget output (dist is at
38.58 of 40 MB gz). No deploy. No loot.glb builds or browser while the deploy lock is held.
**#706:** READY sent to Deploy on Lead's order, to merge AFTER the playtest (not with Weapons' 10:00 WEAPON-TAKE run). Lead ran
loot.test.ts on 46b28f2f in a clean worktree: 4/4 pass. The paperdoll #slot-undefined fix went to Web.

## Now — 2026-09-24 ~19:xx UTC: #706 shieldmaiden.Shield with Lead for READY; #666 blocked on World's carriers

**Now (next session):**
1. **#706** `char/shieldmaiden-shield` @ 46b28f2f: her own Norse board shield. Strategy PASSED the player-worn still; Lead does READY
   (and Deploy merges, no deploy). Push only if CI goes red. At handoff CI was 2 success / 1 skipped / 38 pending / 0 fail.
2. **#666** (Shieldmaiden signature A, Splintered Defiance, pitborn/sig-splintered-defiance @ 61d65db2, base world/signature-dwarf-stamp):
   BLOCKED until World's opponent-loot-carriers PR exists (World takes #589/#606 onto trunk). Then merge-tree #666 on trunk + #706 +
   carriers, resolve the scene.ts signature import block as a union (as #682 did), render a labelled 375 still of HER wearing the shield
   (the carriers PR's view), and send it to Strategy before merge; tests: tsc, typecheck:tests, npm test, `node --test tests/signature*.test.ts`.
Routing: Lead (CEO, Dom's full authority) and Strategy take questions, never Dom. Only Lead messages Strategy for READY; send READY
material to Lead. Lead's session restarts often: re-run ListAgents for the current name/ref before sending.

**Done**
- #689 (8dc71b61, docs only): this file onto trunk (#469 had already merged, so its later commits could never land).
- #706 built: `@build:shieldmaiden-shield` in build-warrior.mjs (7 Wood boards r .36, Steel rim/boss/flange, rigid hand_l, kit stow data);
  loot.json entry; LOOT.shieldmaiden += shieldmaiden.Shield; grades.ts `Wood: null`; loot-layers regenerated (2 webps + 1 css line).
  loot.glb 9,403,584 -> 9,504,172 B (+2 draws). Checks: npm test 599/599, gate 540/540, loot 43/43, tsc clean, budget PASS
  (loot 2,548,116 gz of 3.5M). Evidence: evidence/shieldmaiden-shield @ eef6303a.

**Open** Paperdoll CSS maps every Shield layer (veteran.Shield included, already on trunk) to `#slot-undefined`: loot-layers.mjs does not
map Shield to `off`. Web design's fix, logged by Strategy for Lead.

**Gotchas**
- `WARRIOR_LOOT=1 node scripts/build-warrior.mjs` rebuilds loot.glb deterministically (trunk rebuilt byte-identical). Then
  `node scripts/loot-layers.mjs` (paperdoll webps + style.css) and `npm run build` BEFORE `node scripts/check-budget.mjs`, which reads dist/.
- Every new loot material needs a row in src/grades.ts CLASS_OF (tests/grades.test.ts fails otherwise).
- A new material in build-warrior.mjs must be registered: `parts.set(material, [])` (add() does parts.get(material).push).
- view.wear(ids) is async (loot.glb loads on first wear): wait for `view.wornDraws().worn.length` before rendering. The untracked harness
  scripts/zz-charge-roster.mjs has `--wear ids` doing that. The runtime ignores the shield's stow data; it always rides hand_l.
- The deploy-lock hook blocks a WHOLE compound command, including any edits in it: re-apply them after the lock clears.

## Now — 2026-09-24 evening: done; next from Lead

**Now (next session):** nothing open. Stand by for Lead (Frankendom - Lead Developer). Lead is CEO with Dom's full authority:
send questions to Lead, never to Dom. Playtest sha e37a74c7 is FROZEN until the playtest, so push nothing that would ride it.
The Dwarf's charge passes as marginal (Strategy); revisit only if the playtest names it as unseen.

**Done today (LIVE in e37a74c7; frankendom.com release.json checked)**
- #682 effects batch (Butcher's Wake + Reaping Scar + Blade Bite) @ 7b06a113.
- #685 charged-heavy lean for the whole active roster @ 6531f2bc: `LEAN_OUT` (the Witch's values) on the 8 tall rigs, dwarf `LEAN_LOW`
  {yaw -.5, side .9, chest .35, arm .3}. Every active weapon's heavy_overhead charges (chamber 7-12); tests/charge-lean.test.ts pins
  one lean per non-held roster entry plus the charge.
- #687 goblin follow-up @ d0fb1135: `LEAN_LOW` hid his knife behind the player's left shoulder (Strategy). Now `LEAN_HIGH`
  {yaw .4, side -.7, chest -.3, arm 1, lift -1.6}. The new optional `ChargeLean.lift` = upperarm_r pitch, negative raises. He leans to
  screen right, with the hook above the player's right shoulder. Release head step 12.8 vs 12.6 px without the lean; render median 1.7 vs 1.3 ms.
- Evidence: evidence/charge-roster @ a07249bc (10-opponent sheet + goblin before/after).

**Open** None. Not checked on an iPhone.

**Gotchas**
- Untracked `scripts/zz-charge-roster.mjs`: one still per opponent plus a sheet. Use `--ids a,b@variant --table f.json` to override
  CHARGE_LEAN in the page (value 0 = no lean) and `--crop x,y,w,h`. The sheet framing was `40,15,295,560`, which the Executioner's scythe needs.
- Short rigs: a sideways lean alone lays the weapon flat. Negative yaw brings the dwarf's hammer head up; the goblin needs `lift`.
- Evidence branches only ever ADD. Build the evidence tree from the previous evidence tip, never from the code commit (0a8abcd1
  dropped the roster sheet; a07249bc restored it).

## Now — 2026-09-24 ~14:20 UTC: effects batch #682 in CI; next = CHARGE_LEAN across the roster

**Now (next session):**
1. **#682 "Effects batch: Butcher's Wake + Reaping Scar + Blade Bite"** (`effects/batch-0924` @ `7b06a113`, off trunk 5655ac94, merges
   #661 @ 690c74a8, #657 @ 1a52f684, #665 @ 3db14dad as normal commits; the scene.ts import block keeps all six lines). CI was 5 pass / 35
   pending at handoff. When green, send Lead the head and the green CI (Lead: Frankendom - Lead Developer). Pitborn was told the batch owns #661's head.
2. **Charged-heavy lean, roster-wide** (Strategy picked B "Lean-out"; #679 Witch-only is YES and READY with Deploy). Fit `CHARGE_LEAN` in
   src/characters.ts per opponent/weapon for the 10 active opponents: veteran trident, pitborn cleaver, goblin knife (goblin rig),
   nightborn estoc (nightborn rig), executioner scythe, dwarf warhammer, plaguedoctor longsword, knight maul, witch trident (done),
   shieldmaiden gladius. Short weapons carry it with the lean. Only moves with `charges: true` park (sword-family heavy_overhead
   spread + scythe line 399); check each weapon's heavy really charges before fitting. Receipt = ONE sheet, one held-charge still per
   opponent at 375 over the shoulder with the player guarding, NO strips; then ONE PR (branch off #679's char/charge-lean or trunk once #679 lands).

**Done today (this session)**
- #659 Knight Rivet B only (C reverted), retargeted to trunk, trunk merged in (resolveSignature). Went out via Deploy.
- #657 / #665 retargeted to trunk + trunk merged in (green), then folded into #682.
- #679 `char/charge-lean` @ 142b25fe: `CHARGE_LEAN` + `holdingCharge()` + a lean layer on the guard-tilt bones, eased by two cascaded
  eases (follow rate 18). 41 CI pass. Evidence: evidence/charge-pose-witch @ d0a40098 (mockups A/B/C + lean strip).
  Release-window head step 4.4 px vs 1.0 without (a single-stage ease gave 7.5 px), render median 3.6 vs 3.4 ms.

**Open** Dom/Strategy's word on the roster sheet. Nothing is mid-edit; the working tree is clean apart from untracked scratch.

**Gotchas**
- Untracked harnesses: `scripts/zz-charge-pose.mjs` (bone-offset mockups, table `scripts/zz-charge-poses.json`, `--pose base,A,B,C
  --labels "a|b|c"`, writes sheet.png) and `scripts/zz-charge-strip.mjs` (charge start/mid-hold/release strip + head-step pop metric +
  perf; `--nolean` for the baseline). Both render the real createScene with the player guarding. Bone axes on the hero rig:
  spine_01 x = bow forward, y = twist (weapon swings to screen right), z = side lean (screen left); upperarm_r x = drop weapon low right,
  y = raise weapon up/right. Other rigs (goblin, nightborn) need their own probe.
- No magick/PIL on this Mac: compose sheets in a Playwright page (the harnesses do).
- trunk has `SHIPPED` in signature.ts (ship mode): executioner A, knight B, veteran C, pitborn A. Don't add On-resolution hacks.
- Every effect PR's import lands in the same scene.ts block: batch them, and resolve as a union of lines.
- `npm run typecheck:tests` catches test-frame type drift that tsc -p . misses (bloodMode after #677).
- zsh globs `.x[0:8]` in unquoted jq and has no `grep -P`: quote jq filters, use awk.

## Now — 2026-09-24 11:3x UTC: signature effects + Knight rebuild handed to Lead; all wait on Dom's yes/no/again

**Strategy ruled 15:40 local:** #665 C (shavings @ 48d9e350) SHIPS as the Veteran's signature via World's SHIPPED map (veteran -> C);
HOLD #665 at that head and REBASE it onto trunk once World's framework PR (#655) merges. Rivet B ships. Rivet C redone as a pale
bare-metal ring round a dark hole (<=1.5x the rivet) @ dffcee02, strip sent to Lead for Strategy (reads, but foreshortened to an oval).
**Now (next session):** rebase #665 when #655 merges; act on Strategy's word on Rivet C v2. Nothing is mid-build.
- #657 Reaping Scar (Executioner A) @ 677009e6 — Lead: reads well.
- #659 Rivet Burst (Knight) @ f0ca52e4 — A lit crescent dent (Lead: "reads as a glyph"; leave unless Dom says again),
  B dark dent (rivets solved, dent invisible), C socket (rivets read, SOCKET DOES NOT READ at rivet-footprint size;
  lever = ~2x size or lighter surround, Strategy's call). Last strip was on #672's knight.glb.
- #665 Veteran @ 48d9e350 — A Battle Scars kept UNREGISTERED (no torso armour, truth rule); B Blade Bite (ring curls) = On;
  C = twisted shavings (was rings, superseded 09:5xZ), 2 stay caught in the tines; scrape streak now rides the shaft.
- #672 Knight rebuilt on #651 maul head @ bf9bbb14 — READY with Deploy; before/after stills show nothing wrong.
- All four signature PRs are stacked on World's framework #655 (world/signature-effects @ 367e4dd3).

**Done today** PRs #657 #659 #665 (signature effects, each its own file + one import line in scene.ts + a trigger test),
#672 (knight.glb 6,679,956 -> 6,967,096 B, byte-exact with Weapons' build; budget PASS, knight pairing 8,068,178 gz).
Evidence: branch evidence/signature-executioner @ 3b9c1e0a (all strips, zooms, Knight before/after).

**Open** Dom's yes/no/again on every variant. None iPhone-checked. Scrape SOUND is the audio lane's.

**Gotchas**
- The framework's letters stop at C (signature.ts SIGNATURE_MODES, World's file). A 4th look means replacing a letter.
- `pickSignature('on')` = A first: to make On resolve to B, leave A unregistered (export it; test pins it).
- Body marks at the default chase camera: anything under ~0.4 m on dark plate is invisible at 375 px. Moving things read.
- Contact points on the Veteran sit behind the player's body; measure on the tines for anything that must be seen.
- Receipts: untracked `scripts/zz-sig-strip.mjs` drives the real createScene + stepPractice (`--want miss|hit|parried`,
  `--signature A|B|C|off`, `--at` tick offsets, prints mark screen positions). For a model before/after, swap the glb
  in from `git show <ref>:src/assets/<x>.glb`, render, then `git checkout HEAD -- src/assets/<x>.glb`.
- zsh eats `$c:refs/...` as a modifier: write `${c}:refs/heads/...` when pushing a commit-tree sha.
- Deploys ran back to back all day; the hook blocks tsc and even single-file tests while one is in flight.

## Now — 2026-09-24 05:0x UTC: #643 waits on DOM's yes (steel shells vs his dark iron); #603 is superseded

**Now (next session):** #643 (`knight/body-cover` @ `0726db15`, MERGEABLE) passed Lead on Body/Arms/Greaves; the helm is fixed
(`loot.json` `scale` [1,1,.72] about Head: visor 0.8 cm, back 2.3 cm). It is NOT READY until Dom says yes to the comparison
(https://github.com/DomLynch/RPG-game/pull/643#issuecomment-5807801460, images on evidence/knight-643 @ 17e14d00). If Dom asks
for dark iron, give the three shells a KnightIron-coloured untextured material; the ringHull shells carry no UVs.

**Also queued (Lead, 2026-09-24 ~05:30): the live 'grey rectangle' Dom saw on the Knight is his MAUL HEAD** — an untextured
WeatheredStone cube (#6e6a63, scripts/build-weapon.mjs:712), reading near-white at chest height. Not #643: trunk's knight.glb is
byte-identical to #643's. WEAPONS fixes the head (material + bevel) in build-weapon.mjs and hands over the rebuilt donor; THIS LANE then
rebuilds knight.glb (`node scripts/build-creatures.mjs knight`, not creature_pack.py alone: a pack-only rerun gives 5.27 MB vs the
shipped 6.68 MB) and posts idle + mid-swing before/after stills at 375x812 for Dom before READY. Before still: artifacts/character/knight-live-idle/sheet.png.
Weapons' head fix is PR #651 (weapons/maul-head-material @ 1100bb35: darker WeatheredStone #4a4640, RoundedBox bevel, mottled
colour + pitted normal maps by name in build-warrior finishMaterials). Rebuild once it's on trunk; Weapons' local build gave
knight.glb 6,967,096 B (+287 KB), 8 images, 36 clips, bind error 2.3e-6.

**Next assignment (Dom order via Lead, 2026-09-24): SIGNATURE EFFECTS**, brief docs/briefs/signature-effects.md on
origin/strategy/state-1235 (rows 5 and 7). (1) EXECUTIONER Reaping Scar: his heavy MISSES low (`AttackMissed`) and carves a curved
scrape into the sand showing dark stone; fragments tumble; the scar stays. (2) KNIGHT Rivet Burst: a substantial `Hit` on him pops 1-2
cosmetic rivets, the plate shudders, a dent stays. Start once WORLD's effects framework API is known (it lands first); the Rivet Burst comes
after the maul-head rebuild. Rules: cosmetic only, keyed to existing duel events, NO sim change, the effect must tell the truth,
marks capped and fight-only, phone-first. Receipt per effect: a 2 s clip or 3-frame strip at 375x812 + a perf line; one PR each; Dom
says yes/no/again. If an A is impractical, take the brief's B/C and refine it.
Answer Lead/Veteran/Combat questions. If Lead or Dom wants the great helm smaller, that's the next change (see Open).
Do not push to #603 (`knight/six-r` @ `1db7afd5`): it's in #643's history and was held out of Run 4.

**Done today**
- `9a182321` → `1db7afd5` (#603): the Knight's rebuild plus phase-r de650b76 merged in. loot_dwarf.py: phase-r's island drop and
  outward winding run for every family; the Knight's Gloves/Boots own-slot re-pose skinning is kept ahead of the winding.
- **#643** `ea512119`, `440ddc92`: worn by the player, the Knight's Body `replace` left him bare-chested (the plate's front sat
  inside the player's chest, the sides hung behind like wings); Arms/Greaves read as shards (Lead, 07:20 on run4-knight-front.png).
  Now `@build:knight-chest/-arms/-greaves` in build-warrior.mjs: ringHull shells over `triGrid(await playerWorn())`, all `over`.
  Breastplate spine_01→spine_03 at stations 0–1.46 with `pick:'outer'`, skinBySpine (lifted out of the Witch block); rerebraces,
  vambraces, closed greaves; no cuisses. loot.json gains a per-entry `bone` (knight.Helmet → Head).
- Receipts: suites 108/108; loot-layers exit 0; check-budget PASS (loot 2,537,949 / 3.5M); version guard 4/4;
  ladder/roster/loot-data/graphics 66/66; tsc clean.
- SIM_DIGEST re-pinned at 9 WITHOUT a bump (8c13363f…): trunk's v9 pin was taken with the Knight held, and `hold` isn't read by
  any sim file; `record-replay-check --strict` passes on the merged tree.

**Open**
- The top and back of the player's scalp show above the helm crown (the great helm cut is open at the back; same on #603).
- The steel shells read lighter and bluer than the Knight's own dark iron (named in the PR for Dom).

**Gotchas**
- **A bad render from your own harness is evidence, not an artifact.** My scratch paperdoll showed the bare chest at 01:0x and I
  put it down to the harness; Lead's frame proved it real. Only a fight-rig still disagreeing with it *and* a view that can show
  the defect clears it. worn-loot-check's arena still was too small to show a bare chest.
- `loot-layers` renders front-on and orthographic: it can't see a depth error (the helm) or a plate buried under the tunic.
  Use Veteran's `wearAll` render page (orbit plus ArmedWalk; copied to the worktree root, deleted after).
- spine_01→spine_03 is a SHORT axis: stations .2–1.12 fit a rib band. A breastplate needs about 0–1.46.
- `timeout` doesn't exist on macOS (exit 127). The Stop gate times out at 420 s under load 80+; a manual run took 356 s.
- Deploys ran back to back overnight; wait on `~/.claude/state/deploy_in_flight.json` with an until-loop, never assume FREE.

## Now — 2026-09-23 18:45: the Knight is HELD (#594); next is the depth-aware ARM RE-WEIGHT (target 23:00 Phase L)

**Progress 18:5x — `knight/six` @ 6451d4b7 (pushed; not a PR):** the arm split is DONE and works. For the Knight, `arm_mix` compares
a vertex's distance to the posed arm segments with its distance to the trunk/leg segments (`body_segments`, `segment_distance`),
biased 2 cm to the trunk over a 6 cm band. spine_02 is gone from the arms (was 8,482). On the attack sheet
(`artifacts/character/knight-seg2/sheet.png`) the hands stay on the haft through Maul_Heavy/Slash and the skirt stays still.
**Next: pale patches at the hip/underarm mid-swing.** They are NOT texture (only 0.35 % of the 2048 map has lum > .5; the plate median
is .25/.22/.20). So it's geometry: back faces or tearing where the fused arm and torso surfaces separate. Check whether the material is
single-sided and where the stretched faces are, then the six pieces (recipe below), the un-hold, and the mid-swing still in ONE PR.
Merge origin/phase-r in before the next Stop once #593 (the targeted Stop gate) lands (Strategy).

**Now (next session):** re-weight the Knight's arms in `scripts/character/creatures.py`, then land in ONE PR: the un-hold +
the new `knight.glb` + his six loot pieces + a MID-SWING still. Dom accepted the four new characters on live 7b277fd; "add the
weapons" = the Knight back with a SWINGING maul.
- **The defect:** `src/assets/knight.glb` (since 322bb1d) weighted his arms to `spine_02`: 8,482 of the vertices past |x| .25,
  and ~220 on the arm bones. His gauntlets hang at his hips while the maul swings. Cause: my `edge = 0.185*1.18 + max(0, 1.4*1.18 - z)*.26`
  line put the arm cut-off outside his tight arms. Diagnose with `scratchpad bones.py`-style dominant-bone histograms.
- **Tried (branch `knight/six`, WIP 1 commit):** the default edge .27/.055 moves the arms but smears the chest like a cape;
  edge .225/ramp .03 moves the arms but drags the skirt/belt, because his fists hang beside the skirt at the same x/z. **The fix
  needs depth (y), or a nearest-bone-segment transfer restricted by region**, not an |x| edge. Render the check with
  `node scripts/character-preview.mjs --src /src/assets/knight.glb --sheet 'Maul_Heavy:0,.35,.6;Maul_Slash:.4' --azimuth 60`.
- **Loot recipe (Lead, via Nightborn):** Nightborn's weld on every path (`char/loot-weld-textures` @ 37e44a2) + his own maps
  (no --material Steel) + decimate ratio **.5** (.12 and .3 shred) + one 512 atlas per opponent. Use `--boots` (knight/six adds it:
  foot/ball → Boots). His pieces currently render TOO HIGH/cropped in the paperdoll: his 1.18 root is not unscaled, so fix that too.
  No Arms/Gloves patches can exist until the arms are weighted to arm bones. LOOT cap is 3.5 MB (#585).
- **#594 (hold)** is open against phase-r @ 01ff59e5: hold: true, scene.ts glob, ladder/graphics tests, SIM_DIGEST re-pinned
  WITHOUT a bump (#439 rule; replay check cmp-identical). The un-hold reverts the hold and the glob line and restores the ladder tests.

## Now — 2026-09-24 (assigned by Lead, 2026-09-23 evening): the Knight to SIX takeable armour pieces, LIVE target 14:00

Dom's priority 1 (via Strategy): every opponent wears and offers six takeable armour pieces plus its weapon, Recruit rag and
scrap first. **This lane owns the Knight:** Helmet, Body, Arms, Gloves, Greaves, Boots (he keeps `knight.Maul`). The
Executioner's own set is already six.
- **Build on Nightborn's WELDED pipeline once it lands (~09:00)**: the seam weld is on `char/plague-doctor-loot` @ `817828e`,
  plus textures. **No quick cuts**: the unwelded `loot_dwarf.py --family knight --ratio .12 --material Steel` cut renders as
  shards (see the 17:0x correction below).
- **One PR.** Its body lists the six pieces, triangle counts, loot.glb size (check-budget, cap 2.0 MB gzip), and a
  same-frame phone still of the Knight WEARING them. `node scripts/loot-layers.mjs` must be green, and look at its renders
  before pushing.
- Open at handoff: `record-version-guard` is red on roster-v0 (RECORD_VERSION 7, sim digest moved). Combat's bump; not this lane's.

## Now — 2026-09-23 16:40: the KNIGHT is on roster-v0 (beta), complete

**Correction 17:0x — roster-v0 @ c725dce: knight.Helmet + knight.Body are PULLED (Lead).** loot-layers.test was red on
knight.Helmet, and the layer render showed the .12 Steel cut as shards (the TRELLIS mesh is split at every UV seam) with an
empty Helmet layer. loot.glb is back byte-identical to 636ce4d; `knight.Maul` stays. The carriers return post-beta on
Nightborn's seam weld (char/plague-doctor-loot @ 817828e) + textures. **Never ship a loot cut without running
`node scripts/loot-layers.mjs` and looking at the render.** Checks: 74/74 (incl. loot-layers); tsc clean.

**Now (next session):** nothing open on the Knight in this lane. Watch Combat's 21:15 re-pin (ARCHETYPES.knight) and the
21:20 roster publish; answer questions. Post-beta: textured own-plate loot, finisher validation, the Recruit-2 extras.

**Done today** (all merged into `roster-v0` by fast-forward merges, never force):
- `322bb1d`: his own body. `src/assets/knight.glb` = TRELLIS.2 on a hero-rig donor at `BUILD.knight` 1.18; ROSTER.knight is the
  LAST rung (after the Plague Doctor) so no career shifts; `ARCHETYPES.knight` = verbatim Executioner copy at scale 1.18
  (placeholder for Combat); finishers `['plainDeath']`; versus still `public/versus/knight.webp`.
- Arm solved to **84 / 1.10**: the posed WeaponDrawn origin is 0.2 mm off his right palm, which the reference puts at ~(-0.30, 0.82).
  The 79 / 1.0 seed sat 13.6 mm off. Solver: sweep angle x stretch, then gap to surface AND nearness to the reference palm.
- **TRELLIS fused the reference's grounded maul into the body**; `creatures.py` now cuts the head (a box in front of the
  boots) and the haft (a tube under the left fist), located on ortho front/side renders.
- `c07400d`: loot. `knight.Helmet` + `knight.Body` cut from his plate by `loot_dwarf.py --family knight --ratio 0.12
  --material Steel` (Body 2,863 / Helmet 429 tris). check-budget loot 1,535,953 of 2,000,000 (Auditer raised the cap, 636ce4d).
- `78657a9`: the MAUL. Donor rebuilt with WARRIOR_WEAPON=maul (#572's Maul_* family), so drawn = sim; `knight.Maul` is takeable.
- Targeted `node --test` (loot, loot-data, ladder, roster, graphics, characters, player-weapons, weapons, gear-stats): 146/146; tsc clean.

**Open:**
- `record-version-guard` was already failing on roster-v0 before these pushes (the sim digest moved); RECORD_VERSION is Combat's.
- `char/knight-body` and `knight/body-v0` are superseded by roster-v0; leave them, never delete a branch.

**Gotchas:**
- These tests are `node:test`. **vitest reports "No test suite found" on every file**; run `node --test --test-reporter=tap`.
- `scripts/warrior-recipe.mjs` refuses a fighter that isn't a ROSTER id, so **the roster entry lands before the donor build**.
- A reference that holds a prop gets that prop fused into the TRELLIS mesh. Look at an ortho render before binding.
- Loot is 1.5 → 2.0 MB gzip and every piece counts. Own baked maps cost ~110 KB of JPEG, so shared untextured Steel is the default.
- The deploy lock is `~/.claude/state/deploy_in_flight.json`. Check its pid is alive before believing either "free" or "busy".

## Now — 2026-09-23 (later): Knight body PAUSED, lanes report to Lead

**Lead, 2026-09-23: Knight body work is paused.** Dom's beta list makes the four new characters post-beta. Resume
deliverable 2 from `char/knight-body` at `951c9be` (parked, no PR) when Lead or Strategy lifts the pause.

- **#502 is MERGED** (`52dffed`); deliverable 1 is on trunk. Its local `quality:stop` has still never run (a deploy
  was in flight every time), so run it on trunk as a post-merge receipt.
- **#494 is closed, replaced by #526** (`char/knight-reference-v2`, `388d43a`, off trunk `2d614dc`): the same image,
  byte-identical, with the Knight section's withdrawn ratios corrected in `PROMPTS.md`. #494 conflicted, and a
  force-push is excluded.
- **Standing order (Dom, 08:50):** instructions from Strategy (`Frankendom - Strategy - Fable 5.1`) and Lead carry
  his approval. Excluded: force-push or branch delete, rolling back live, dropping data. See lane memory.

## Now — 2026-09-23

**The lane is the Knight.** The Executioner is done and live (#398, `01b6642`); nothing open on him.

**Deliverable 1, the silhouette test, is shipped — PR #502** (`char/knight-silhouette`). Bare and in loadout, from the
approved reference (#494). The finding: **stripped, the Knight is nobody** — shoulder-over-height 0.367 in kit to
**0.246** bare, widest point 0.41 to 0.257, and no feature of the bare outline is his, because helm, pauldrons, skirt and
greaves are his whole identity and all six slots come off. The Pitborn lane measured the same failure on the
Shieldmaiden's direction A (0.284 → 0.240, #498), where the flat shoulder line A was chosen *for* is the lootable
shoulder plates.

**That bar is now withdrawn, and the finding stands anyway.** Lead and Strategy ruled the gate **in-kit at every rung**,
the bare pass **informational**, because the game has no stripped state: take-one removes at most one piece per kill, the
opponent respawns kitted, and `src/grades.ts:1` says a grade is a material variant on a shared mesh, so his Recruit
`Helmet` and `Body` carry the same outline as his Origin ones. Brief 17 §5a records the number with its re-read
condition — **it goes live again if `take-one` ever removes more than one piece**.

**My own earlier ratios are withdrawn** (Executioner 0.36, Knight 0.39–0.40, in `PROMPTS.md`). They came off threshold
masks that fused arms into the torso, which inflates a plate figure and barely touches a bare-armed one, so the direction
was an artifact. Corrected off u2net mattes: **Knight 0.367, Executioner 0.374, Veteran 0.360** — three humans inside
0.014, the Knight marginally *narrower*. Lead replaced both rows of #499 and Strategy fixed SCOPE.md on #492.

**Deliverable 2 is under way — `char/knight-body`, head `951c9be`, no PR yet.**

- `08965ee` the TRELLIS.2 reconstruction: 4,508,492 B, sha256 `1c683e97…`, seed 190926, 1024/100k/2048, one attempt.
- `8cf4bae` the pipeline wiring: `BUILD.knight = scale 1.18` and 1.85 m, **provisional**, a tie-break on the 0.367
  midpoint judged by Dom on the versus still (Strategy, 2026-09-23); a change is one number in each file.
- `951c9be` bounds the donor step at 30 min — the quality gate caught it as a third unbounded `spawnSync` against a
  ratchet allowing two.

## Open

- **The maul: #509 IS merged (`3ff9097`) but it is a RECIPE, not a mesh.** Its content commit `4f55780` adds 41 lines to
  `scripts/build-weapon.mjs` and nothing else — `git ls-tree` on trunk finds no maul file at all, so the part must be
  produced before anything can reference it. (The sha reported to this lane, `4e34fa3`, is
  `Revert "Merge pull request #488 from DomLynch/stats/lane"`, not the maul.)
- **The hero rig has no `Maul_*` clips.** `src/moves.ts:406` still reads `paths: creaturePaths(CLEAVER_PATHS, 'Maul')` —
  the Minotaur's creature clips. Weapons is authoring the `Maul_*` family on the hero skeleton (their `Warhammer_*`
  precedent). Until that lands, **the donor step and the fit proceed on the warhammer stand-in as wired**; only the arm
  re-solve and the versus still wait.
- **The arm solve is blocked on the maul reaching trunk.** `creatures.py`'s `arm_angle` is seeded at **79** and is a
  *starting point*, not a measurement. Strategy's ship gate: the body PR carries the **solved** value against the **real**
  maul part (`weapons/maul-part`, `4f55780`), never the warhammer stand-in or the seed. The donor step itself is not
  blocked — identical `WEAPONS` reaches and the maul crowns at .76 like the warhammer's.
- **Remaining, in order:** donor step, Blender fit, pack, arm re-solve, versus still, then the generator-hash rebuild of
  `dwarf`, `executioner` and `veteran` **in the same PR**, each accessor-equivalent to trunk (§5, Dwarf v2 precedent).
- **`npm run quality:stop` on #502 has never run** — a deploy was in flight every time. Ruff clean, no release rows.
  Ask Deploy for the window.
- **Calibration owed to Strategy:** matte vs plate on the seven figures that have both a rig and a reference PNG, once
  #500 is on trunk. Small delta → #502 stands with the delta as its stated uncertainty and mattes are the instrument for
  reference-only characters; large delta → no cross-instrument comparison at all, which would hit the Shieldmaiden and
  the Witch too.
- **#469, this file's own PR, is still unmerged**, while four lanes are told to copy it as their worked example.

## Gotchas

- **Silhouettes need a subject matte, not a threshold.** Three threshold attempts failed: the backdrop is a *radial*
  vignette so a per-row left/right estimate sags mid-image; a closing wide enough to erase the figure over-reaches across
  that gradient; and **polished plate mirrors the backdrop** at its own luminance (163–171 against a 162–166 grey) — the
  same failure Pitborn hit on the shield face. The harness is `scripts/character/silhouette.py` (#502).
- **A border flood-fill is right for a hollow figure and wrong for plate.** An arm/hip gap is an *enclosed* hole, so the
  flood closes exactly the articulated outline the test exists to judge.
- **Do not re-run the outer-arm-edge fit as a measurement of `arm_angle`.** It reads **68.9° for both** the Veteran
  (solved 62) and the Executioner (solved 64). A method that cannot separate two known values cannot fix an unknown one.
  Only the *gap* survives: the Knight reads 84.7°, ~16° closer to vertical than either.
- **Never upscale a short mask to the comparison height** (#499) — it invents edge detail on one side of the pair only.
  My own sheet did it before `84195a4`.
- **Stance before breadth** (Pitborn's rule, #499): a comparison is only valid between figures in the same stance, and no
  measurement code can detect it — the shoulder-line finder is blind to what the arms are doing.
- **The 80 % coverage floor is not a silhouette measure.** `tests/loot.test.ts:95` compares **mesh surface area in m²**
  against the *player's* own draws in that slot. It cannot be taken from a reference or a mask; it runs the first time
  the draw exists.
- **After fast-forwarding onto trunk `fe0d8e0`, run `npm ci` before the gate.** A worktree whose `node_modules` is the
  old 2026-09-17 install fails `npm run quality:stop` on a missing `@types/node`; that is a stale install, not a
  breakage (World, relayed by Strategy 2026-09-23 — their gate went green immediately after). This lane's own gate ran
  green on its current install, so it bites on the next fast-forward, not today.
- **The one-deployer hook scans the whole command string** — a heredoc containing "build" or "deploy" trips it even for a
  plain `git commit`. Write the message to a file and `git commit -F`.

## Now — 2026-09-22

Nothing building and nothing open from this lane. **#398 merged (`01b6642`) and is live** — verified on the served file,
not on the merge: `assets/executioner-9s1ZxRnx.glb`, HTTP 200, 4,414,104 B, carrying
`KHR_materials_specular { specularFactor: 0.4 }`, 38 clips, generator `54999ae9`.

**The owner widened this lane on 2026-09-22:** *"Your scope now includes the Knight (Brief 17): a masked heavy opponent
wielding the maul, two-hand … The Executioner stays yours."* Terms: brief first, **silhouette test at the fighter's camera
passes before any model work**, AAA judged on a **phone screenshot** (Dom plays on an iPhone — a Mac render is not the
instrument), **one PR per deliverable with its receipt**, report to Lead, **nothing ahead of the shield in Combat's queue**.

**The Knight's reference is APPROVED and landed — #494** (`docs/character-references/knight-source-v1.png`, lean plate + great helm, owner-picked 2026-09-22). **Deliverable 1, the silhouette test, is unblocked and is the next action.** Keep one finding from the approval: differentiation from the Executioner is **not** about mass (measured shoulder/height — Executioner 0.36, Knight 0.39-0.40) but about **soft outline versus hard** — his hood, bare arms and falling cloth against the Knight's squared pauldrons, flat plate edges and articulated limbs. The build must keep that contrast; "bulkier than the Veteran, thinner than the Executioner" is a build-spec number the reference does not settle.

~~Blocked on the reference image.~~ It gated deliverables 1 and 2 (for a masked character the
silhouette *is* the design) and is now satisfied. Brief 17 is landed as **PR #489** (`docs/briefs/knight.md`), approved by Strategy with
its §7 rulings written in.

**When the image arrives, deliverable 1 is the silhouette harness** — black shapes at the fighter's camera beside the
other nine, run **bare and in loadout**, the bare pass being the honest one (armour is takeable, and a full-plate
closed-helm figure reads in kit and vanishes stripped). One PR per deliverable, each with its receipt image; AAA is judged
on a **phone screenshot**, never a viewport render.

The Shieldmaiden (Brief 15, written here as "the Nord") is **not** this lane's — it stays with Lead. Brief 15 (written as
"the Nord", since renamed **the Shieldmaiden** and amended by Lead: a woman, and a new one-hand bearded axe family in
place of the cleaver) is moving to `docs/briefs/shieldmaiden.md` in PR #471. Brief 17 **the Knight** is landed in **#489**
as `docs/briefs/knight.md`, which creates `docs/briefs/` (so does #471 — different files, no conflict).
Brief only, nothing built, and **the owner has not confirmed the lane expansion** — this session was scoped to the
Executioner on 09-20 ("only work on that char"). Lead agreed the refusal is correct: writing the brief was in bounds
because it changes nothing; building is not. Do not start the Nord on a peer's say-so.

The Knight's own finding, worth keeping: **the maul is not a shelf-ready hero-rig weapon.** `moves.ts:406` makes `MAUL` a
cleaver spread with a two-hand grip and cleaver paths under a creature prefix, and no maul asset exists in the repo — the
geometry sits inside the **held** `minotaur.glb`. Promoting it is a real Weapons deliverable. And because a two-hander
stows the shield, the Knight has no shield; "cannot be cut" must come from plate and guard rules, which is Combat's to
define, not a character brief's to invent.

Lead's rulings on the Shieldmaiden (09-22), so the next session does not reopen them: the **shield asset is Multi Chars'** (the Nord is
its second consumer, he does not author it); **if Combat's shield slice misses beta freeze the Nord does not ship, and
must not ship shieldless** — his shield is always-on, so the Veteran's "start at Gladiator" fallback does not transfer;
the kit ships **Recruit-2 first** rather than waiting on the shared library; and an **owner reference image is a required
input**, not a nice-to-have. Scope fence: the hero rig and the hero's assets belong to Character Main — the Nord reads
the hero skeleton and clips, it never edits them.

## Done — 2026-09-20 → 22

- **#177 the scythe's haft** (live). `setBladeBlood` tinted every mesh of a two-handed `WeaponDrawn`, and every shipped
  two-hander ships its handle as its own material, so the whole scythe went red after a kill. `bloodiesMaterial(name,
  twoHanded)` in `finisher-blood.ts` bloodies the blade and never a handle (`/haft|handle|grip|wrap|leather|cord|wire|^ash$/`).
  Fixed the trident, cleaver, knife, estoc and maul hafts at the same time.
- **#206 the TRELLIS rebuild** (live `fefb8fe`, merge `60fccd4`). The procedural v5 body replaced by a fitted TRELLIS.2
  reconstruction; **v5 kept byte-for-byte at `src/assets/source/backups/executioner-v5.glb`** and used as his own donor, so
  the 1.32× root, the scythe `WeaponDrawn` and all 38 clips are inherited. 45,471 tris, 3.16 MB gzip (v5 3.69).
- **#293 the scythe's blade** (live `5debe58`). Owner, 09-21: "still turns red". The haft was fixed; the crescent was not —
  a broad metallic blade took the 55 % lerp toward `#7a1410` as a *red mirror*. Two-handed weapons now take the dark tone
  `#2a1516` with `metalness ≤ .3 / roughness ≥ .7` (a wet dark film); the sword path is unchanged. In `src/gore.ts`.
- **#398 surface specular + donor hold keys** (live, merge `01b6642`, release `607126a`). Skin-strength specular on the
  Executioner surface kills the wet-plastic sheen a normal-map-less reconstruction takes; `sync-hold-keys.mjs` puts
  `cb1ee6a`'s Run Through hold channels into the `executioner-v5` and `veteran-v1` donors, so a creature rebuild stops
  silently regressing the raised-palm hold. Dwarf and Veteran rebuilt in the same PR for the generator hash.

## Open

- **The Nord** — blocked on the owner confirming the lane expansion, then on an owner-approved reference image, Multi
  Chars' kit schema, and Combat's shield slice. All four are in the brief.
- **The mask reads dark under the hood in game.** A relit source was tried and **rejected**: the mask is recessed, so
  TRELLIS bakes it dark whatever the source lighting, and that bake shifted his skin red. It reads acceptably at gameplay
  distance; if it is ever revisited, the lever is geometry or a material, not the source image.
- **FLUX.1 [dev] is a non-commercial licence** (`src/assets/README.md`) — the owner confirms its terms on output use
  before commercial launch. TRELLIS.2 itself is MIT.

## Gotchas — the expensive ones

- **Any edit to `creatures.py` or `creature_pack.py` moves the generator hash**, and `creature-check` then reads every
  live creature as stale. Rebuild all of them in the same PR (today: dwarf, executioner, veteran) and show each
  accessor-equivalent to trunk. Measured on trunk `beb3120`: baseline passes `dwarf, executioner, veteran`; adding one
  family entry to `creature_pack.py`'s `base` map and re-running gives `Stale creature: rebuild with build-creatures.mjs`
  (`creature-check.mjs:11` digests both scripts into the pinned `generator` hash). **Adding a new character through the
  creature pipeline therefore costs a rebuild of every live creature** — plan it into the PR, it is not a defect.
- **`cb1ee6a` patched the Run Through hold keys into the shipped rigs but not into the creature donors**, so any creature
  rebuild silently regressed the raised-palm hold — `tests/characters.test.ts` catches it on the Veteran only.
  `scripts/character/sync-hold-keys.mjs <donor> <shipped>` syncs the 17 left-arm `Fin_RunThrough` channels. Applied to
  `executioner-v5` and `veteran-v1`; the dwarf donor already matched.
- **The `build-warrior` donor step is not byte-reproducible across machines.** Restore a donor from trunk and re-run
  fit/pack/Quiet-One instead of regenerating it, or the diff is noise you will chase.
- **`Death_QuietOne` is authored per body** on its own skin envelope, so it is the one clip a creature does not inherit
  verbatim; the donor's corpse sank the new body 0.21 m. `creature-check` excludes it from the inherited-clip comparison.
- **Solve a fitted arm against the reconstruction's PALM, not its hand centroid.** Palm-solving took the scythe grip gap
  from 0.04–0.08 m to 0.019 m. `keep_fingers` keeps the donor's finger weights so the clips curl his fingers on the haft.
- **A reconstruction ships no normal map**, so its smooth surface takes the full dielectric specular as a wet-plastic
  sheen. `SURFACE_EXTENSIONS` in `creature_pack.py` stamps skin-strength specular (the hand-built heads use 0.5 / 0.35).
- **The TRELLIS route is `gradio_client` + the local HF token** (`~/.cache/huggingface/token`, PRO). The HF MCP has
  `gradio=none` so `invoke` is disabled; the hf.co Space iframe is invisible to the Chrome extension; the direct
  `*.hf.space` URL freezes the tab. ~90 s per reconstruction at seed 190926 / 1024 / 100k faces / 2048 textures.
- **Playwright's default `waitForFunction` polling never fires on the game page** — pass `polling: 250`, or a passing run
  looks exactly like a frozen game (cost 40 minutes). `page.goto` needs `waitUntil: 'commit'`; headless GL is ~0.25 s a
  frame, so render only the frames that carry a blow.
- **Gate every browser run on `pgrep -f "bash scripts/deploy.sh"`.** One capture went out during a deploy on 09-22
  because the check and the run were chained in one command instead of the run being conditional on the check.
