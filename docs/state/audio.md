# Sounds & music — project state

Entries moved verbatim from the root PROJECT_STATE.md on 2026-09-21 (state split). Append new entries at the TOP. Keep evidence and remaining validation in every entry (AGENTS.md).

## Heavy landings on the rotation + loudness match — 2026-09-23 evening (Lead's brief, on the owner's "hits still sound the same")

### Now
PR #626 (branch `audio/heavy-rotation-r`, rebased on trunk `e455d850`; the older `audio/heavy-rotation` holds the pre-rebase commits
and is not the PR). Its first CI run was red: `tests/audio.test.ts` budget assert, 1,025,213 B gzip against the 1.0 MB cap. Fixed by
re-encoding Opus 80k → 72k (below). Still owed when the deploy lock is free: `npm run quality:stop` (capture EXIT=, no tail),
`node scripts/check-budget.mjs`, and `node scripts/audio-preview.mjs --label heavy-rot` against a trunk run for the hit-light /
hit-heavy / hit-riposte / blocked rows. The owner has the clip (`scratchpad/clip/hits-before-after.m4a` of session 268fc3d6) and
hears it before merge (Strategy).

### What changed
- Why the owner heard no change after #579: only light hits play `hit_flesh`. Heavy, charged, riposte (`HEAVY` in `src/audio/cues.ts`)
  played `hit_heavy` = one sword recording at two pitches. Now `hit_heavy` is the same six landings, heavy voicing: the four CC0 takes
  at rate .88 with `heft(75 Hz)` at .4 (take normalised first, so the heft is relative), the sword hit and synth stab via their own
  `heavy` branch. 2 → 6 variants.
- Loudness match in `build-audio.mjs`: phone-band (> 300 Hz) K-weighted momentary max per variant; lights to −19, heavies −17
  (`HEAVY_LU` 2). Louder ones trimmed; quieter ones driven into tanh by the least drive that reaches target (cap ×12), re-peaked −4 dBFS.
  Before, lights spread −14.4 … −28.3. H ("messy stabber") needs ×4.7 light / ×9.7 heavy — audibly grittier; flagged to the owner.
- Sprite: m4a 515,515 → 557,375 B, ogg 470,488 → 505,535 B at 80k: 1,025,213 B gzip, over the 1.0 MB cap. Opus is now 72k
  (`build-audio.mjs`): ogg 455,879 B, total 977,703 B gzip. The m4a (Safari) and the manifest are byte-identical; only the Opus
  stream (Chrome/Android) lost bitrate. Owner-picked takes kept whole: trimming the heavy stretch would have saved only ~8 kB.
- `tests/audio.test.ts` pins both rotations: `hit_flesh` and `hit_heavy` each have six variants, and 40 hosted landings reach all
  six with no take twice running.

### Gotchas
- Pure attenuation to the quietest variant is useless: it left every hit ~18–22 dB down. Lift quiet ones, trim loud ones.
- The deploy lock comes back within minutes between rolling runs; a `quality:stop` started in the gap got caught under Run 3a's lock
  and had to be killed. Check the lock right before each heavy command.

## Flesh landings: six different sounds on rotation — 2026-09-23 (owner, by ear)

The owner could not hear a flesh sound in play: of the five landings, four were the one CC0 sword-hit recording at different
pitches. He auditioned twelve CC0 Freesound flesh takes (A–L) and picked four: B "Slicing through flesh" (504615), C "Bloody
Blade" (323525), H "messy stabber 1" (811118), J "Meaty Splosh" (528834). `hit_flesh` is now six variants — sword hit, synth stab,
B, C, H, J — each a different recording, and `nextVariant` never plays the same one twice running (owner: "on rotation, and same
sound not twice"). The sword hit's lower take left the light rotation because it was the same recording; `hit_heavy` is unchanged.
Evidence: sprite rebuilt (m4a 485,875 → 515,515 B, ogg 442,108 → 470,488 B); `npm run quality:stop` EXIT=0; `check-budget` PASS
(audio 738,447 B gzip per fight). Measured per variant as shipped, full / phone band LUFS: sword −20.8/−21.3, stab −14.3/−16.3,
B −19.7/−19.8, C −17.1/−16.3, H −23.9/−30.9, J −25.4/−25.7. H is mostly bass, so it is the quiet one on a phone speaker; every cue
is peak-normalised, which is also how the owner auditioned them. Loudness-matching the six is an owner call, not done.
Gotcha: `build-audio.mjs` fetches each source with a 30 s timeout; the H preview is 3.7 MB and timed out here. The hash-pinned file
was put in `artifacts/audio/source-cache/` by hand; a clean rebuild on a slow link may need the same.

## Phone audio pass on live 52dffed — 2026-09-23 (Lead's brief)

Measured the publish that is live (`52dffed`, contains #511; served `sprite.ogg`/`.m4a` sha256 match git byte for byte) with
`scripts/audio-preview.mjs`'s phone band (> 300 Hz high-pass), which had **no probe for either whip cue** — added `whipped` and
`whip-raised`, coverage pin 17 → 19 ordinary. Findings, phone LUFS: **the whip tell was as loud as the lash** (whip-raised
−29.2, whipped −29.1, blocked −30.4): gain .3 on a dense swell equals .85 on a sparse crack once every cue is normalised to
−4 dBFS. Fixed to gain .1 → −37.6, 8.4 dB under the lash. Reported, not changed (owner mix calls): the kick lands at −41.4
phone against a light hit's −34.7, and a guard break loses 6.8 dB between full band and phone band (−29.6 → −36.4), because
both are mostly under 300 Hz. Hits sit 4.3 dB under blocks on the phone band, as the owner set in #433.
Gotcha: **there is no `npm run lint`** — `npm run --silent lint | tail` exits 0 on the missing script. The lint is `eslint src`
inside `npm run quality:stop`; run that. My #511 "lint clean" was that hollow receipt; `eslint src` passes on the tree that
contains it.

## Lane state — 2026-09-23 (the whip split wired; the two non-CC0 clips re-sourced)

### Now
Both of tonight's items are in PR #511. **Correction to my own first read of `docs/SCOPE.md`:** its "wall lash: guards removed"
line is about the skinned meshes, not the mechanic — `WhipRaised` and `Whipped` are both on trunk `fe0d8e0` (`src/duel.ts:262`
and `:266`, carrying `lead` and `guard`), and World's `world/wall-silhouettes` is presentation only. A scope line that removes an
asset does not remove the sim events that asset used to illustrate: check `git grep` on current trunk before calling a cue closed.
Brief 13's whip split is therefore **done**, not closed.

### Done today
- The licensing row is settled by Strategy's ruling (2026-09-23): "credit and accept" is not an option when the licence forbids
  redistribution — **re-source**. Neither non-CC0 clip is in the build any more, and the sprite now rebuilds from public CC0 URLs
  alone (both cache files were moved out of the tree before the rebuild, which then succeeded — that is the receipt).
  - Parry (was the Jochi SFX "Shield Block" recording, variants 0-2): now `RECIPES.parry_shield`, the same original voicing
    `block_shield` already shipped, held to .72 s and centred on the measured ring of the clip it replaces.
  - The first of the five weapon-landing voicings (was the SoundFX "Sword Slash & Beheading"): now the CC0 "Hit Impact Sword 3"
    (freesound 547042, the owner's own 2026-09-22 pick) at rate .86 — a sixth below the fifth voicing, which plays it at rate 1.
  - `shield` and `slashkill` are deleted from `src/assets/audio/SOURCES.json`; `src/assets/README.md` records what went and why.
- The whip split (Brief 13): a new `whip_raise` cue — leather dragging up through air, .4 s, no transient and no metal, so the
  tell can never be mistaken for the crack. `WhipRaised` delays it by `lead / 60 - .4` s so its end lands on the lash tick (.6 s
  of delay before a first lash, .1 s before a 30-tick repeat, 0 when the lead is shorter than the cue). It is air, not an impact:
  gain .3, room .5, because the man holding it is at the wall. `Whipped` keeps `#361`'s crack.
- Each of the wall's six lorarii keeps one whip voice on both events — `Cue.rate` (new, optional) is .94 + guard × .024, so
  guard 0 is the deepest and guard 5 the thinnest, and the ±5 % random spread now multiplies that instead of replacing it.
  An event with no `guard` plays at rate 1, so a replay written before the tell still sounds right.

### Open
- The owner has not heard either replacement. He picked both departing clips by ear, so the voicings are auditionable, not final:
  a different CC0 pick is a one-line change and the measured candidate table is in the PR.
- `#341` (fatal-crowd check on the harness clock) and Auditer's grade-C findings #4-#8 stay parked, per Strategy.

### Gotchas
- **Only two cue slots ever used those clips**, not the six cues the older note implies: `parry` variants 0-2 and `HITS[0]`.
  `block` / `block_perfect` are `block_shield`, an *original* voicing measured from the Jochi clip — measurements are not the
  recording, so the guards never carried the risk. Check what a slot actually plays before sizing a licensing swap.
- **No CC0 shield clang measured anywhere near the one being replaced.** Nine CC0 candidates auditioned: every one sat at a
  4.0-6.9 kHz centroid with ~100 % of its energy above 300 Hz, against the incumbent's 882-1116 Hz and 31-43 %. The thin, bright
  clangs on Freesound are not the same object as a struck shield with a body. That is why the parry went to the existing voicing
  rather than to a new recording.

## Lane state — 2026-09-22 (live a2a901b and after; owner's mix pass, jeer beds, Brief 13)

### Now
Nothing of the lane's own is open in CI. Next piece of work is Brief 13's remaining half: the whip split — a crack on Combat's
`WhipRaised` (60 ticks before the first lash, 30 before repeats) and a lash on the existing `Whipped`, guard index 0–5 on both.
Those events are not on trunk yet (`grep WhipRaised src/duel.ts` is empty); write against the names when Combat's PR lands.
`#361`'s single crack is what ships until then. The wall-hugger jeer bed is already wired and live (below), so the whip split is
the only Brief 13 audio item left.

### Done today
- `#377` armour-synth branch removed from `block()`/`block_perfect()` (owner: "the first 3 guard/block metal sounds, remove them
  from the game"); each cue is now 4 variants, steel ring + shield clang.
- `#383` CC0 "Hit Impact Sword 3" (freesound 547042, CogFireStudios) added to the `hit_flesh` rotation — 3 variants, the owner's
  pick from three CC0 candidates.
- `#417` then `#433` the weapon-landing gains: 1 → .75 → **.3** for `hit_flesh` / `hit_heavy` / `hit_kick`.
- `#422` `COMBAT_LEVEL` .5·MIX → **.375·MIX** (owner: "reduce all combat noise by 25 %, keep the crowd, opening bell and death all
  same"). `FINISH_LEVEL`, `ARENA_LEVEL` and the bell are untouched.
- `#423` the crowd turns on a wall-hugger: `jeer_wall` ×3 in the arena bank (A low grumble → boos, B small-mob boos + wolf-whistles,
  C procedural stamp-and-chant → boos; the owner picked all three "on rotation"), driven by `ArenaFrame.loiter` (0..1) with
  `nextVariant` no-repeat and a .15 s release on 0. New CC0 pins: HowardV 264378, IAmAndyGoddard 393528. The murmur bed went 8 s →
  6 s to keep the bank under its 450 KB gzip cap (427,161 B).

### Open
- Brief 13 whip split, blocked on Combat's `WhipRaised` / `Whipped` events (above).
- `#341` (fatal-crowd check on the harness clock) is open and low priority by the owner's call ("ignore check 5, minor, polish
  later"); check 5's "menu stops the live crowd source" is a known load-dependent flake, not a regression from that diff.
- Auditer's grade-C findings #4–#8 (mix-pin drift test, stale comments/literals, SNR assertion, PR-description accuracy,
  `bone_crack` aliasing a cut voicing) are backlog, unstarted.
- The licensing row is closed for the sprite's two non-CC0 clips only in the sense that they are credited in `src/assets/README.md`;
  the owner has not chosen credit-and-accept vs re-source. Jochi "shield" forbids redistribution outright — treat as live risk.

### Gotchas
- **A cue gain is not output dB.** The voice gains feed the bus compressor (`threshold -20`, `ratio 5`, `knee 10`) and then a ×2.1
  makeup into the soft ceiling, and only *after* that does `COMBAT_LEVEL` scale the mix. The ceiling hands most of a pre-compressor
  cut straight back: in the `#417` pass a nominal −2.5 dB on the hit cues landed as about **−1 dB** at the output, and every cue
  rendered at the same peak. Measure with `node scripts/audio-preview.mjs --label <name>` (it renders the real graph offline and
  prints LUFS-I / phone LUFS / peak per cue) before promising the owner a number. `COMBAT_LEVEL` is post-ceiling, so it *does* map
  roughly linearly — it is the lever when the whole mix must move.
- Measured hit-light vs blocked, LUFS-I, same probes: **−27.6 / −26.6** (this morning) → **−30.1 / −29.1** (`#422` live) →
  **−34.2 / −29.1** (`#433`). Hits end ~5 dB under the guards instead of 1 dB over. −2.5 dB is inaudible on a handset; the older
  note in this file ("go −8 dB or don't bother") held again.
- Post-merge GitHub rows lie. Jobs that start after a PR merges fail at `actions/checkout` with `couldn't find remote ref
  refs/pull/NNN/merge` — 13–14 red rows on `#377`/`#383`/`#422`/`#423` were all this, nothing ran. The deploy's own local pool
  (33 checks over `.quality-gate.json` `release_commands`, `scripts/deploy.sh`) is the receipt that counts; the release-checks
  workflow header says outright it "gates nothing".
- `release-checks` skips on a plain push (the matrix is `workflow_dispatch` / labelled `pull_request`), so a "skipped" row is not
  a pass. Lead gates on the labelled `pull_request` run.
- Freesound downloads need no account: scrape the `hq` preview from the sound page
  (`https://cdn.freesound.org/previews/<3-digit>/<id>_<user>-hq.mp3`); the `/download/` endpoint returns HTML. Read the licence on
  the page itself before shipping and pin `sha256` in `src/assets/audio/SOURCES.json` (combat) or `arena-life.SOURCES.json` (bank).
- The one-deployer hook blocks test suites, builds and browser checks while any `deploy.sh` runs; `git`, `gh` and single-file
  tests stay allowed. `ps aux | grep deploy.sh` also matches other sessions' shell wrappers — check for a real `bash
  scripts/deploy.sh` child, and its `CODEX_COMPANION_SESSION_ID`, before claiming a deploy is or isn't running.


## Combat audio takeover — 2026-09-19 (audio/reliable-playback, integration pending)
Distinct original cloth/sand roll and backstep cues consume existing ActionStarted events. Existing impact recipes and four-call shell contract stay unchanged. Quiet/mute stop active sample and fallback sources; quiet blocks scheduling synchronously until unlock. First-variant selection includes region zero; room send no longer squares the cue gain.
Evidence: artifacts/audio/takeover-{before,after}/REPORT.md and WAVs; artifacts/audio/takeover/NOTES.md and quality.log. Added optional --check to the real offline browser harness and registered it as a completion gate. AAC/Opus all 54 regions decode; forced first-format failure recovers; three exchange renders differ by at most one PCM rounding unit; eight stacked cues peak at -2.85 dBFS. Audio assets 605,004 B gzip, +60,706 B, within the 1 MB lane budget. Source/processing recorded in src/assets/README.md. Physical iPhone silent-switch checks, recorded Foley, continuous footsteps, ambience and music remain unverified/unimplemented. Required quality passed: 254/254 tests, lint/build/audit/budget and game browser; roster, Split Crown, estoc, counter-button and audio completion commands all passed. Branch prepared for PR; not deployed.

## Fatal contact, death and crowd audio — 2026-09-19
Owner-authorized next audio pass: recorded human death grunts, organic fatal cuts/punctures, finisher-only tear/crack and three
2.5 s arena crowd reactions. The crowd celebrates either winner; simultaneous deaths get one gasp. Fatal impact stays on the
contact tick, voice follows at 30 ms and crowd at 350 ms. Plain falls and kneeling Run Through have different body cues.
Audio reads the same finish/weapon pair/visual override as the scene through one presentation-only main.ts call-site addition.
Blood-off suppresses the added wet layers; no simulation, damage, timing, controls, rigs or renderer changes.
Evidence: `artifacts/audio/fatal-before/` and `fatal-crowd/`; reproducible source hashes and CC0 licences in
`artifacts/audio/SOURCES.json` and `src/assets/README.md`. Audio is 996,816 B gzip (+391,812 vs movement pass), under the unchanged
1 MB limit. 73 AAC and Opus regions decode; format fallback passes; three deterministic exchange renders differ by <=1 PCM unit;
fatal stack peaks -2.85 dBFS; quiet/mute cancel future crowd/collapse sources. Lane quality: 261/261 tests, lint/build/audit/budget/game browser and all seven completion commands passed. Final publication is identified by the served release.json.
Physical phone/silent-switch listening remains unverified. Timing follows current authored presentation durations; no claim of
frame-perfect body contact on every rig. Music, sustained ambience and gait/breath events remain outside this pass.

## Phone audio balance — 2026-09-19 (release authorized)
Owner requested ordinary effects x0.5 and death/kill/crowd x1.5. Post-compressor gain preserves these ratios; an oversampled
output guard limits boosted transient peaks. Existing cue assets, tone recipes, timing and simulation are unchanged.
Measured ordinary loudness -5.9 to -6.0 LUFS; crowd tails +3.52 dB; complete fatal mixes +2.8 to +3.3 LUFS after limiting.
True-peak review caught +2.2 dBTP overshoots missed by sample peaks in the first candidate; corrected version reports at most
-1.0 dBTP with FFmpeg and -1.54 dBFS in browser 4x reconstruction. Five-band spectral energy changes at most 1.67 percentage
points. No additional EQ change justified; this is measurement, not a physical-phone listening claim.
Existing audio completion gate now checks the frozen pre-change mix, empty death ticks, rematch after quiet/mute and
reconstructed peaks. AAC/Opus/fallback, 17 ordinary probes, 12 fatal probes and eight crowd-tail checks pass.
Evidence: artifacts/audio/phone-mix/REVIEW.md, reference.json, frequency.json and gates.json. Full quality passed 264/264 tests,
lint/build/audit/budget/game browser; all eight configured completion commands passed, including native fatal playback/pause.
Release hold acknowledged: no audio trunk merge or deploy until world closeout and lead confirmation. Handset audition remains.
Integration: weapons trunk f7a1e99 merged cleanly; preserved its polearm gate. Integrated quality passed 265/265 tests and all
nine completion commands; GitHub CI passed on 827fe33. Receipt: artifacts/audio/phone-mix/integrated-gates.json. PR #158 held.

Audio release window granted by lead after world 8fcf58e. Current world trunk integrated without runtime conflicts; preserve
all configured gates. Final deployment/public parity and affected audio browser receipts go in artifacts/audio/phone-release/.
The physical phone audition remains unverified; use served release.json as the deployment authority.

## Arena life audio — 2026-09-19 (lane, not yet released)
Owner approved a quiet audience bed, short reactive cheers/gasps, sparse jeers and wordless chants, close hit grunts and an
opening low bell. Separate optional AAC/Opus bank uses pinned CC0 recordings; 15 regions,40.09s,388785B combined gzip under
its450KB cap. Existing combat sprites/cue rotation and half-effects/+50%-fatal mix are unchanged. No music in this pass.
Audio reads match identity and finish state; crowd voices cannot steal combat voices. Pause/mute stop all arena voices,
rematch rings once, no late decode starts playback, and fatal contact clears ambience for the established winning roar.
A pending-suspend/Enter race found during state audit now queues resume within the activating gesture; regression covered.
Rendered browser QC: crowd bed -38.58dBFS RMS, active fight -24.61dBFS; peak at most-1.0dBTP across AAC/Opus idle/fight/fatal/stress.
Both codecs/format fallback, overlap, variation, cooldowns,6-voice cap, quiet/mute/rematch and missing-bank continuity pass.
Evidence/provenance: artifacts/audio/arena-life/ and scripts/arena-audio-check.mjs. New completion gate preserves all inherited
commands. Native mobile-viewport welcome/menu/resume/actual defeat/rematch checks pass. All17 integrated release commands are
recorded in artifacts/audio/arena-release/gates.json; publication requires their success and exact-head CI.
Physical handset audition is still unverified.

## Opening bell repair — 2026-09-19 (Draw-only candidate)
Owner clarified the bell must fire on Draw Sword, not Enter or the rematch button. Returning profiles skip welcome, so the
old tick<120 window expired before their first Draw; waiting for the optional crowd bank also lost the cue on slow downloads.
The player's ActionStarted(draw) now triggers the unchanged original bell, with a local fallback if the bank is unavailable.
A pending draw survives asynchronous Safari unlock only while that same match remains in draw phase; quiet/mute, death,
phase end and match replacement cancel it. Enter, sheathed waiting, opponent draw and later unmute never arm a bell.
No combat/crowd/fatal gains or simulation changes. Rebuilt AAC/Opus assets remain byte-identical.
Offline regression covers fresh/returning Draw, pre-draw pause/mute, interruption, late unmute, opponent draw and rematch.
Six delayed-resume regressions fail before/pass after. Actual saved-profile and fresh/rematch browser checks are in the
existing arena gate; all24 inherited gates plus startup regression are retained. Evidence: artifacts/audio/bell-draw/.
61ed0cc deployment stopped during prepublication checks after owner clarification; it was never served (live remained74df626).
Physical handset listening remains unverified. Publication requires full gates and public verification; GitHub Actions is
billing-blocked, so the lead-approved exception requires fresh clean Node22/macOS reproduction of all CI commands.

## Bell weight — 2026-09-19 (candidate)
Owner confirms Draw bell is audible and requests2xlevel/+50%ring. Bell gain .22→.44 (+6.02dB), duration2.6→3.9s,
modal decay/release1.5x with original frequencies and attack. Shared generated fallback and rebuilt AAC/Opus bank agree.
No trigger, combat/crowd gain or simulation changes. Existing cancellation/startup/native gates use authored bell duration;
rematch silence is measured after the full ring. Focused units/typecheck and ten offline lifecycle cases pass.
Full offline mix across AAC/Opus/fallback passes truepeak<=-1dBTP; bell-only truepeak-13.3dBTP;401719B gzip under450KB.
Source/state audit completed. Evidence: artifacts/audio/bell-weight/. Game-browser/release work waits for lead window;
latest npm audit returned503maintenance, not bypassed. Full inherited gates and public verification required before done.

## Combat audio — consolidated lane state — 2026-09-20 (reconciliation after five passes; beta freeze)
Docs-and-hygiene pass only: no sound, gain, timing or simulation change (rebuilt sprite byte-identical: m4a 88c3e2b1…, ogg d3358aef…).
Read this section first; the dated audio entries above (2026-09-15 … 2026-09-19) are its history.

**Three subsystems, one contract.** `main.ts` calls `feedback.unlock/quiet/toggle/update(events, deathAudio?, frame?)` and nothing else.
1. Combat Foley — `src/feedback.ts` + `src/audio/{cues,sprite,manifest}.ts`, sprite `src/assets/audio/sprite.{m4a,ogg}` built by
   `scripts/build-audio.mjs`: 21 cues / 73 regions / 36.65 s; original procedural impacts, air, roll, backstep + five CC0 recordings for
   the fatal pass (`artifacts/audio/SOURCES.json`, credited in `src/assets/README.md`). Event→cue map is pure data in `cues.ts`
   (impacts before air, ≤ 4 cues per ordinary tick, ≤ 8 on a death tick, seeded variant rotation reseeded per duel, ±5 % pitch).
2. Arena life — `src/audio/arena.ts` + `arena-manifest.ts`, bank `src/assets/arena-audio/arena.{m4a,ogg}` built by
   `scripts/build-arena-audio.mjs`: 6 cues / 15 regions (bed, reaction, jeer, chant, grunt, bell); own 6-voice pool and RNG, cannot
   steal combat voices; stops on death, quiet, mute and match change.
3. Opening bell — `src/audio/bell.ts`, generated once per context (3.9 s, gain .44), fired only by the player's `ActionStarted(draw)`;
   the same samples ship inside the arena bank so the bank and the network-independent fallback agree.

**Signal chain (feedback.ts, numbers as shipped).** voice gain → compressor (−20 dB, knee 10, 5:1, 2 ms / 150 ms) → makeup ×2.1
(restores the sprite's −4 dBFS codec headroom) → soft ceiling (tanh, −1 dBFS) → balance ×0.5 ordinary / ×1.5 from the death tick
(owner's phone mix, 2026-09-19) → output guard (4× oversampled, linear to 0.55, −3 dBFS knee) → master (1 / 0 on mute) → out.
Per-voice sends → convolution room (0.8 s seeded stone decay) → compressor. Arena voices join at the output guard, bypassing the
combat compressor and balance. Fallback synth (pre-sprite) plays into the compressor until the sprite decodes.

**Budgets (measured 2026-09-20).** Combat sprite 996,816 B gzip of the 1,000,000 B lane limit enforced in `tests/audio.test.ts`
(99.7 % — any beta audio change must be a swap, not an addition, or the lead raises the limit); arena bank 401,719 B of 450,000 B
(`build-arena-audio.mjs`); audio total 1,398,535 B gzip, inside every fight's 12 MB (per fight 9,857,608 B; all of dist 30,815,447 B
of 32 MB). Audio is loaded per fight regardless of opponent.

**Ruler.** `node scripts/audio-preview.mjs --label <x> --against trunk-63c57e2` renders the fixed exchange (`src/audio/exchange.ts`,
now 829 ticks after the combat lane's chamber/thrust changes; the 12 beats are unchanged and pinned by `tests/audio.test.ts`) plus
every cue probe through the real `createFeedback` in Chromium's OfflineAudioContext. `artifacts/audio/trunk-63c57e2/REPORT.md` is
the baseline for any beta polish: ordinary hits −23.7 … −20.3 LUFS-I (peak −8.8 dBFS), swings 5 LU under them, deaths −11 LUFS-I
(peak −2.1 dBFS), exchange −14 LUFS-I. Columns: LUFS-I, phone-band LUFS (300 Hz high-pass), momentary max, peak, onset, length,
Δ against the reference. WAVs are regenerated, not committed (owner rule); reports and tables are.

**Gates (measured in a fresh worktree on 63c57e2).** `audio-preview --check` 68 s, `artifacts/audio/fatal-crowd/browser.mjs` 37 s,
`bell-start-check.mjs` 7 s — all pass. Both browser gates need a current `dist/` (`npm run build`); against a stale build the fatal
gate fails with a Playwright timeout, which is the build, not the audio. `arena-audio-check.mjs` (≈ 5 min) failed 4/4 in this
worktree at the "Enter the arena" tap (locator resolved, never actionable; `--ui-only` fails the same way) and the cause is the
launch, not the audio: it was the only audio gate calling `launch({ headless: true })`, which on Playwright 1.62 runs the separate
headless-shell binary; the same tap succeeds in ~2 s under the full Chrome for Testing binary that the other 14 gates select with
`executablePath`. Fixed here by launching like the others; the gate then passes load → enter → menu → resume → rematch. Three
non-audio scripts still launch the headless shell (`polearm-pose-check`, `creature-weapon-pose-check`, `veteran-polish-check`) —
noted for their lanes, untouched. Since #175 (trunk f2944f9) Stop runs `npm run quality:ci` + `npm run test:browser` and all
four audio gates sit in the 32 `release_commands` that `scripts/release-checks.mjs` executes inside `deploy.sh` before the live
switch — the right place for them; `arena-audio-check` also takes `--offline` / `--ui-only` if the lead ever wants the fast
offline half back on Stop.

**Beta freeze (owner + lead, 2026-09-20).** Ships: current impacts, fatal sounds, crowd ambience, bell. Parked as Phase 2, in this
order when reopened: (a) material-aware impacts for the grown roster (bronze/iron/bone/wood; needs the struck material, the weapon
is already in `Hit.weapon`); (b) footsteps by gait/surface (blocked on the `Step` event, REQUESTS.md #1), breath by stamina,
exertion grunts on heavy; (c) `PostureBroken` cue; (d) music. No new music lane.

**Still open.** Physical handset audition of the live mix (silent switch both ways) remains unverified in every audio entry —
the owner's ear pass on 63c57e2 is the next audio action and needs no code. Hygiene applied here: dead helpers removed from
`build-audio.mjs` (`gain`, `sub`, `modal`), README audio paragraph reconciled with the recordings, REQUESTS.md statuses set.
