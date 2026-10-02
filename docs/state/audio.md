# Sounds & music — project state

Entries moved verbatim from the root PROJECT_STATE.md on 2026-09-21 (state split). Append new entries at the TOP. Keep evidence and remaining validation in every entry (AGENTS.md).

## 2026-10-02 (restart check) — status refresh. Read the 01:30 handoff below first; it is still current except for these deltas

**Now.** Still nothing for Audio until Lead says READY or a lane reports a defect. No code touched this session.

**Deltas since 01:30 (read from `gh pr view` this turn):**
- **#1288 (duel lobby cues) is MERGED to trunk**, as is #1228 (duel/peer-rig). The cues are still DORMANT until the Duel lane wires `feedback.duel('go')` on `start(driver)`; the wiring default and event hooks are in the 01:30 entry. Check with Duel (session `local_0a992bdf-4e25-4edb-b77c-8ba9305dd243`) whether the wiring PR exists before offering help.
- **#1232, #1279, #1287 still OPEN, all mergeStateStatus CLEAN**, bases unchanged (finishers/hades-shadow-claw-fx, audio/nightborn-cues, audio/boss-cues-18). Do not push to them. When one lands, retarget the next onto trunk and keep `SPECIAL_CUE_OF` + the `specialCue` lines in main.ts.
- No deploy lock at the time of writing (`~/.claude/state/deploy_in_flight.json` absent).

**Open:** Dom's ear verdict on the 39 unheard cues (m4a already sent). Retune from it.

## 2026-10-02 01:30 (+04) — HANDOFF before /clear (boss + class + duel cues). READ FIRST, then the 2026-10-01 16:50 handoff below, then memory `frankendom_boss_special_cues_2026-10-01.md`

**Now.** Nothing for Audio to do until Lead says READY or a lane reports a defect. Dom has not heard ANY of the new cues (he was asleep): the m4a were sent to him via SendUserFile (nine in #1232 earlier, 18 in #1279, 7 in #1287, 5 in #1288); Strategy puts the ear check in the morning brief. Retune from his verdict.

**Open PRs (all Auditer PASS or queued; held until the night batch ends, Lead merges):**
1. **Chain #1232 -> #1279 -> #1287**, each based on the previous branch (`audio/nightborn-cues` @ecd0eca9 on base `finishers/hades-shadow-claw-fx`; `audio/boss-cues-18` @d01d7df4; `audio/class-cues` @78a8df60). Retarget each as the one below lands. #1232 was retargeted off trunk because the special sim lives only on the finishers specials base until the #1120 trunk merge. Do not push to #1232 unless the Auditer asks.
   - #1232: nine cues (redwind hades nyx fistful gone liars cracking ashfall windwall). #1279: 18 cues (baying longshadow harvest theword threeblows rimshake baredface thering aegis avalon foretold theprice plagueflies poisonstain lastbreath thesling wrath storm) + a total-size pin test. #1287: 7 class cues (cuts wake stirring tempo pulse drag swing) + `SPECIAL_CUE_OF` and the `specialCue` lines in `src/main.ts` (two tithe-only lines became a table lookup, preview only), pin raised to 1.1 MB (1,070,384 B at 37 cues).
   - **When the chain merges into trunk, the `specialCue` lines in main.ts and the `SPECIAL_CUE_OF` table must survive the merge** (Lead's note). The ids cuts/wake/stirring/tempo/pulse/drag/swing live on `nightborn/class-specials` and `weapons/class-specials`, not on the stack; `SPECIAL_CUE_OF` is strings only so it works when they land. The 27 boss cues are still not in `SPECIAL_CUE_OF` (only tithe + the 7 class ids): a one-line add per id once the owners' registry ids are on trunk (arawn->baying, thanatos->longshadow, reaper->harvest, dwarf8/9/10, shield8/9/10, mist->avalon, echo->foretold, price->theprice, flies/stain/breath, set->redwind, hades, shield->quake, centurion->charge).
   - Evidence: rebuild byte-identical (60/60 then 74/74 sha256); repo gate `quality-stop-targeted` 1216/1216 on ec878954; targeted audio tests + typecheck:tests + eslint clean on each head. -25 LUFS-M phone for specials.
2. **#1288** (base TRUNK, head 58b25dda, `audio/duel-cues`): five duel lobby cues (joined tick go win loss), 10 files 70.6 kB raw, `src/audio/duel.ts`, `feedback.wantDuel/duel`. DORMANT: nothing calls it. The Duel lane owns the wiring after #1228 (duel/peer-rig @5eda5815) is on trunk. Default per Lead: `feedback.duel('go')` alone on `start(driver)`; joined = `peerKit(kit)` non-null; win/loss from `driver.result` ('finished' by match.ended.won, forfeit-win win, forfeit-loss loss, no-contest silent). A 3-2-1 needs a lead-in Duel does not have (go starts both pages at tick 0 after `delay` idle ticks); Lead asked Duel. Duel session `local_0a992bdf-4e25-4edb-b77c-8ba9305dd243`.

**Done today:** #1216 Centurion cues + seam on trunk (earlier); the 18 + 7 + 5 cues above; Lead's size-pin and rebuild-sha asks (PR comment on #1279).

**Gotchas that cost time:**
- zsh: `$B:path` is a history modifier ("bad substitution"): write `"${B}:path"`. BSD sed `-i` needs `''` and chokes on `/`: use python.
- The one-deployer hook blocks the WHOLE bash command (builds, tests, even `node --test`) while `~/.claude/state/deploy_in_flight.json` exists; wait with a Monitor until-loop on the file, never a sleep. The lock came back twice within minutes of clearing: check it right before a build, and split light commands (git, gh, python edits) into their own call.
- GitHub kept `mergeable=CONFLICTING` after retargeting #1232 although the base was an ancestor; an empty commit push recomputed it (only before the Auditer was involved).
- Never push to #1232/#1279 branches while Lead holds them; new work goes on a new branch stacked on the head.
- `special.ts` collisions: when a base already has `want/special/cutSpecial` or SPECIAL_CUES, resolve by keeping the later seam (live()/arenaOutput), then re-run typecheck: auto-merge left a duplicate import once.
- Cue timing facts: every special shares one clock, cast at SpecialStarted, strike on 1.983 s (LAND_AT = windup - 1 = 119 ticks); Seven Cuts strokes at LAND_AT-(6-i)*4 ticks. Long-tail cues need the per-cue `fade: .25`.
- Quality gate (`node scripts/quality-stop-targeted.mjs`, ~5 min with the whole suite) runs in the background; the Stop reviewer demands it as soon as the lock is free.

## 2026-10-01 16:50 (+04) — HANDOFF before /clear (boss special cues). READ FIRST, then the 10:40 handoff below, then memory `frankendom_boss_special_cues_2026-10-01.md`

1. LIVE: **#1216 is MERGED and on trunk** (3323b953 is an ancestor of origin trunk 1e1985b0): the three Centurion cues `charge` `quake` `tithe`
   (Dom: "These are fine") + the `feedback.want / special(cue, gain) / cutSpecial` seam (Finishers' design, plays into `arenaOutput`, needs
   live()). Release.json at my curl showed 4da6b84f; I did not verify #1216 is in the deployed build, only on trunk. Dormant until the move
   lanes wire it: Finishers wired tithe on #1217 (`?special=tithe`), Veteran has quake, World has charge.
2. IN FLIGHT: **#1232** `audio/nightborn-cues` @6c011f41, base retargeted to trunk, mergeStateStatus CLEAN, CI 2 success + 2 skipped when I
   looked (more still running). Nine cues, one per move, cast-start aligned, payoff on the strike 1.983 s: Nightborn `redwind` `hades` `nyx`,
   Goblin `fistful` `gone` `liars`, Pitborn `cracking` `ashfall` `windwall`. 2.4-3.3 s, 4.5-20.3 kB gzip, -25 LUFS-M phone, rebuild
   byte-identical, Centurion files unchanged. Local: audio + special-audio + gate tests 28 pass, typecheck:tests clean, repo gate
   (`node scripts/quality-stop-targeted.mjs`, ~95 s, run it in the background) 1109/1109 pass on 6c011f41. NOT HEARD BY EAR: I sent Dom the 9 m4a;
   no verdict yet. Needs Auditer + Deploy merge; nothing to do until Lead says READY or a lane reports a defect.
3. DONE with picture: `artifacts/audio/special/with-picture/hades-v4-{light,nightpit}-with-sound.mp4` (untracked, sent to Dom). Hades v4 clips
   have SpecialStarted at 2.00 s (Finishers: the capture ring puts wind-up on frame 60), so `hades.m4a` is muxed with adelay 2000; the strike
   is ~3.98 s and my cue's energy peaks 3.75-4.0 s.
4. NEXT (Strategy's order, 16:2x): the **other 18 cues**, same script `scripts/build-special-audio.mjs`, same caps, as one more PR off trunk
   (not stacked now that #1216 is in): Executioner (Baying Circle, Long Shadow, Harvest Sweep), Dwarf (The Word, Three Blows, Rim Shake),
   Shieldmaiden (Bared Face, The Ring, Aegis Sweep), Witch (Avalon Mist, Foretold Step, The Price), Plague Doctor (Plague Flies, Poison Stain,
   Last Breath), Knight (The Sling, Wrath, Storm Follows Him). Brief: `docs/briefs/specials/boss-specials-proposals-2026-10-01.md` on
   `origin/strategy/state-0929-1135` (the starred picks). One cue per move; Strategy confirmed no split wind-up/release files. Not started.
5. Muxing the rest: Strategy wants each cue as mp4 next to its clip. Clips not rendered yet. Ask the owners for path + cast offset, cc
   Strategy: Goblin [37409d], Pitborn [c290d5], Nightborn/Red Wind [b0b88a], World/Nyx [c81a4a]. Finishers' rule for their clips: wind-up
   at frame 60 = 2.0 s, strike ~3.98 s (Blood Tithe too). Command: `ffmpeg -i clip.mp4 -i cue.m4a -filter_complex "[1:a]adelay=2000|2000,apad[a]"
   -map 0:v -map "[a]" -c:v copy -c:a aac -b:a 128k -shortest out.mp4`. Send with SendUserFile.
6. Still open from before: Dom's ear on the gate winch (#1176); retune the winch to the Pit's tick table if they send one.
7. Sessions: Strategy `local_50f50a99-9831-4024-9533-13d91a1220f3`, Lead `local_1bcdcf54-b8b3-4ee1-9597-f3c06d9e74d9`, Finishers
   `local_95c6cbc7-463b-484d-9b3c-430ae1dbeab6`, Veteran `local_e360b41f-203f-43f3-bc1b-e9c75ae11da9`; send by session_id, not title.
8. Gotchas that cost time today:
   - The one-deployer hook (`~/.claude/hooks/deploy_guard.py`) blocks builds, ffmpeg, test suites and even single-file tests while
     `~/.claude/state/deploy_in_flight.json` exists; it blocks the WHOLE bash command, so keep light commands (git, gh) in their own call.
     Wait with a Monitor until-loop on that file, never a sleep.
   - Never call `decay()` (or any envelope builder) inside a `.map` per sample: it is quadratic. Build it once.
   - New long-tail cues fail the "ends on silence" check; the per-cue `fade` option (.25 for the new nine, .04 default) fixes it without
     touching the approved Centurion bytes. Check `git status` shows no changed .m4a/.ogg for the old cues after a rebuild.
   - BSD sed on macOS chokes on `/` in patterns: use python for edits.
   - A stop-hook reviewer fired twice demanding the quality gate while Deploy was "holding"; it was right once the lock cleared. Run the
     gate as soon as the lock is free.
   - Seam collision: Finishers had already written their own `want/special/cutSpecial`. Ask the lane what exists before adding an API.
9. Memory files written 10-01: frankendom_gate_winch_2026-10-01.md (earlier), frankendom_boss_special_cues_2026-10-01.md.

## 2026-10-01 10:40 (+04) — HANDOFF before /clear. READ FIRST, then the 2026-09-30 16:18 handoff below, then memory

1. LIVE 0895d84c (release.json, my curl 10:37). No deploy lock. Audio has nothing running and nothing in flight. Worktree clean on
   `audio/state-1001` (this entry); the old `audio/gate-winch` is merged.
2. Live today: **#1176**, the arena-gate winch, merged 09:24 (+04) as e7ae243b and an ancestor of the live revision. It is
   dormant: only `src/audio/gate.ts` and the README mention `playGate`; nothing imports it yet.
   - A synthesised ~5 s chain and drawbridge lift, original work (no licence, no recording), built by `scripts/build-gate-audio.mjs`;
     rebuild is byte-identical. Files `src/assets/gate-audio/gate.m4a` 32,119 B and `gate.ogg` 36,872 B (own file: the sprite and
     the arena bank are full). Phone-band −19 LUFS-M, peak −5.2 dBFS. 5.00 s, starts at 44 ms, ends on silence.
   - Landmarks the Pit animates to: ratchet from 0.05 s, quickening to 1.1 s, steady 1.4–3.6 s, easing from 3.6 s, **seat knock
     at 4.34 s**, clatter settled by 4.9 s.
   - `src/audio/gate.ts`: `loadGate(context)` (Opus/AAC fallback, null when it can't or the page is leaving) and
     `playGate(context, buffer, destination, gain = 1, delay = 0)` → `{ duration, stop() }`. `stop()` is idempotent; before a
     delayed start it is silent (Auditer's P2), after the start it fades over 60 ms (`GATE_CUT`).
3. NOT LIVE: nothing from Audio. No open Audio PRs.
4. Sessions down: none known.
5. Rulings / agreements (memory `frankendom_gate_winch_2026-10-01.md`):
   - One gate-open sound, not two. Lead gave me a "Pit gate machinery" job on top of #1176; the Pit lane agreed to **replace, not
     stack** and to fit its animation to #1176 (`GATE_OPEN_MS` 5000, seat at 4.34 s). I retune only to their real tick table.
   - The Pit's seam is `GameStage.gateSound?(): { stop(): void } | void` in `src/pit/stage.ts` on #1197 (pit/gate-lift). The
     wiring line in `main.ts` is the Pit's: `gateSound: () => gateBuffer ? playGate(context, gateBuffer, destination) : undefined`,
     after prefetching `loadGate` with the pit chunk. A null buffer opens the gate silent, never blocks.
   - charge_foe .12 → .07 (#956) is live; nothing owed there.
6. QUEUE: empty. Open, in order:
   a. **Dom's ear on the winch.** I sent him `gate.m4a` on 10-01 and nobody has heard it. It is synthesised and the groan is the part
      most likely to sound electronic. If he dislikes it: source a CC0 recording (hash-pinned in a SOURCES file, licence noted),
      keep the file names, loader and player.
   b. Retune to the Pit's tick table when they send it (the sound follows their animation).
   c. Anything Lead or Strategy assigns next.
7. No crons or watches armed. Worktree …/frankendom-audio on `audio/state-1001`; this entry's PR is the one named in my last message.
   Gotchas that cost time today:
   - A stale `node_modules` fails the Stop gate: `@types/three` was 0.183.1 against package.json's ^0.186, so `typecheck:tests`
     errored in `src/gore.ts` and `tests/gore.test.ts` on a diff that touched neither. Fix locally with
     `npm install --no-save @types/three@0.186.0`; CI installs fresh. Check the version before blaming the PR.
   - An interrupted command can leave a trial edit in the tree (`cues.ts` .07 stayed after a rejected render and rode onto the next
     branch). Run `git status --porcelain` before every branch switch and commit.
   - The Stop-hook reviewer can be down for the account's weekly limit (resets Oct 5 11pm Dubai) or an expired OAuth session; that
     is not a defect in the work. The audio-preview coverage pin is now 21 ordinary probes after #939; `charge-foe` is one of them.
   - Lead's rules still stand: only "box FREE" opens the Mac; no push during a CI hold.
   Memory files written 10-01: frankendom_gate_winch_2026-10-01.md.

## 2026-09-30 16:18 (+04) — HANDOFF before /clear. READ FIRST, then the 2026-09-27 22:47 handoff below, then memory

1. LIVE 3fab84c4 (release.json, my curl 16:18). Deploy lock PRESENT: Deploy's run BC (gate+merge+deploy, started 16:16:28, pid 11054).
   Audio has nothing in it and nothing running. Worktree clean.
2. Live since the last handoff (all confirmed ancestors of the live revision):
   - **#864** change B: the perfect block is brighter (phone −32.5 → −30.1 LUFS; parry stays loudest). Live in e9de068d.
   - **#939** change C: a hit through the wrong-side guard adds a quiet glancing scrape (hit-guarded −35.2 phone, between
     an open hit −38.1 and a block −30.5). **#956** charge_foe: the foe's charge climb is quieter (.12 → .07, −36.7 → −41.3
     phone, target hit-heavy −3). **#938** unit tests for the export-clip seam. All three live in 046f915f.
   - **#1094** Draw-tap bell hitch (Strategy ruling 09-29): the fallback opening bell is built once per page in an idle
     callback (bell.ts prepareBell/preparedBell), never on the Draw tap; if a tap beats it the bell is skipped for that match.
     Merged c118a368 on 09-29 17:04Z, live in 3fab84c4. ×4 CPU trace (Hero Look's stall.mjs --profile): before = bell synth on
     the tap frame 4/4 runs (99–131 ms @tap+1..10); after = 0/4 with the bank blocked, 0/9 bank-allowed early taps. Option B
     (worker) not needed. Release rows arena-audio-check (re-pinned to prepare the bell like the game) and bell-start-check green.
3. NOT LIVE: nothing from Audio. No open Audio PRs.
4. Sessions down: none known.
5. Rulings (memory files):
   - Only Lead's "box FREE" opens the Mac; a cleared deploy lock does NOT (Lead + Strategy standing rule, 09-29).
     No local tests, typecheck, quality:stop, builds or browsers without it; CI covers commits. I broke it once on 09-29
     (quality:stop inside Run AK's gate) — feedback_box_free_not_deploy_lock.md.
   - Draw-tap bell: Option A (idle prepare, skip once, synth fallback kept); release checks must exercise the game's prepared
     path, not a host-only sync path (Lead) — frankendom_draw_bell_hitch_2026-09-29.md.
   - Deadlines NOW or ASAP only (09-27) — feedback_now_or_asap_deadlines.md.
6. QUEUE: empty. Nothing assigned by Lead after #1094. Next work comes from Lead/Strategy; otherwise nothing is owed.
7. No crons or watches armed. Worktree: …/.claude/worktrees/elated-chebyshev-75c299, on branch audio/state-0930 (this entry).
   Scratch: scratchpad/herolook/ holds my copy of Hero Look's harness (stall.mjs with `--no-arena`, which must block
   /\/(arena-audio\/|assets\/arena-)/ — the built bank is /assets/arena-<hash>.ogg; prof-buckets regex set to the minified
   bellSamples, `ix` in the 09-29 bundles — find it per build with `function X(e){let t=new Float32Array(Math.round(`).
   Gotchas: `git merge` in this worktree needs `--no-autostash` ("stash failed"); tests are `node --test`, not vitest.
   Memory files written 09-28–09-29: frankendom_draw_bell_hitch_2026-09-29.md, feedback_box_free_not_deploy_lock.md;
   frankendom_audio_queue_2026-09-27.md updated with the Run 2 shas.

## 2026-09-27 22:47 (+04) — HANDOFF before /clear. READ FIRST, then "Standing rule + change B — 2026-09-27", then memory

1. LIVE 054603e0 (release.json, my curl 22:47). No deploy lock. Lead's QUIET WINDOW (Hero Look's #918 timing) was announced; it
   holds until Lead posts "QUIET WINDOW END". No audio-preview renders, builds, test:all or browser runs before that.
2. Live today from Audio: #814 (fizz fix) and #817 (guard-break change A) confirmed live. Lead's #924 (fatal-probe pin
   16 → 14 after Quiet One's removal) is live in 054603e0. My duplicate #925 was closed.
3. NOT LIVE:
   - **#864** change B (perfect block −32.5 → −30.1 phone), head d7e4a085, READY, CI 16 pass / 1 skip. Rides the #918 release
     (Strategy accepted). Re-merge trunk only if that run's trunk moves.
   - **#938** DRAFT, audio/mix-stream @ bc29d348: unit test for the live export-clip seam `feedback.stream()`/`untap()` (SCOPE 5
     audio half, assigned to Audio). 2/2, eslint 0. OWED: a clean `npm run typecheck:tests` (the first run was invalidated by a
     branch switch), then undraft and send Web + Lead the API line.
   - **#939** DRAFT, audio/guarded-scrape @ a8e4e95b: change C. A guarded Hit adds `cue('block', .3, .2, undefined, .8)`;
     hit-guarded probe; ordinary pin 20 → 21; audio.test 21/21. Combat's `guarded` flag has been live since #750. OWED:
     `audio-preview --label guarded-c --check` (read the hit-guarded row against hit-light/blocked, tune the gain), then undraft.
   - **charge_foe**, audio/charge-foe-level @ dbd04a14 (WIP commit, no PR): gain .12 → .07, unmeasured. Lead's GO: aim for
     ≈ hit-heavy − 3 dB phone (hit-heavy −38.1). OWED: render, tune, PR with before/after LUFS.
4. Sessions down: none known.
5. Rulings today: NOW or ASAP deadlines only (memory feedback_now_or_asap_deadlines.md). Lead accepted +0.4 dB over a block
   with parry loudest (#864). The HF sound pilot was dropped by Dom (see below; 0 calls completed, $0).
6. QUEUE after the window ends, in order: #938 typecheck → #939 render → charge_foe render + PR. Each code branch also needs
   the quality gate on its own head. The Stop-hook gate times out at load 50+, so park the checkout on this docs branch while waiting.
7. No crons or watches armed. Worktree: …/.claude/worktrees/elated-chebyshev-75c299, parked on audio/state-0926 (this doc,
   PR #859). Scratch probe: scratchpad/variants.mjs (per-variant phone LUFS from artifacts/audio/sprite.wav). A baseline build of
   trunk runs from `git show origin/…:scripts/build-audio.mjs > scripts/.x.mjs`.
   Memory files written today: frankendom_block_perfect_b_2026-09-26.md, frankendom_audio_queue_2026-09-27.md,
   feedback_now_or_asap_deadlines.md.

## Standing rule + change B — 2026-09-27

### Standing rule (Dom, 2026-09-27, via Strategy to every lane)
- "dont set fake extended deadlines or times, everything is NOW or ASAP." The only deadline given to Dom, Lead or Strategy is
  NOW or ASAP. If it can't happen now, name the physical blocker (the box busy / load N, a red gate, a render still running,
  an HF quota), never a day or a clock time.

### Now
- SCOPE 7 change B = DRAFT PR #864 (`audio/block-perfect-b`, head 3f77dbc7). Phone LUFS: blocked-perfect −32.5 → −30.1
  (blocked −30.5, parried −29.7 unchanged; Lead accepted +0.4 over a block with parry loudest). `audio-preview --check` EXIT=0.
  Owed ASAP, blocked on the box (Lead's load hold): `tests/audio.test.ts`, `npm run quality:stop`, `npm run build` +
  `check-budget`; then undraft and send Lead a clip. Sprite gzip 986,435 of 1,000,000 B: about 13.5 KB headroom left.
- #814 and #817 confirmed LIVE (ancestors of release a981f7a5).

### HF sound-model pilot — DROPPED by Dom 2026-09-27 (HF balance $9, needed by GPT)
- Lead asked for 10 each of impact / grunt / crowd bark from an open model on HF; Dom dropped it minutes later. Record of every call:
  1 `view_api` schema read (no GPU); 1 `predict` (impact #0, 1 s, 100 steps) on Space `artificialguybr/Stable-Audio-Open-Zero`
  (stabilityai/stable-audio-open-1.0, ZeroGPU A10G), sent 22:24:36 and killed in flight after under a minute: 0 completed, $0, quota
  at most one partial generation. No outputs.
- For a re-open: Stable Audio Open 1.0 is the model (Stability AI Community License: commercial use free under $1M/yr, outputs ours).
  AudioLDM2, Tango and similar are non-commercial and must never ship. Prompts and runner:
  `~/.claude/projects/-Users-domininclynch-Developer-frankendom-audio/hf_sound_pilot_gen.py` (`~/.venvs/face` has gradio_client).

## Lane state — 2026-09-26 (handoff: fizz fixed, guard break in the phone band, both awaiting live)

### Now
- Confirm #814 and #817 are LIVE: `release.json` revision must have eff633d6 (#814) and #817's merge as ancestors
  (`git merge-base --is-ancestor`). Neither was confirmed live at handoff (site served acdbe355 at last check). Lead sends
  the live sha. #817 is second in Deploy's next run, after the dummy-opponent PR.
- Then SCOPE 7 change B: a perfect block reads 2 dB UNDER a plain block on the phone (−32.5 vs −30.5). It needs a brighter,
  longer ring: target ≥ blocked + 1 (≈ −29.5), with parry still the loudest (−29.7). Recipes: `block_perfect_steel` and the
  `block_shield(r, true)` branch in `scripts/build-audio.mjs`. Lead approved A and B together (2026-09-25).
- Change C (wrong-side guarded hit: a glancing scrape) waits for Combat's `guarded: true` field on trunk.

### Done today
- **#814** (merged as eff633d6): Dom's "fizzing/electrical" hit. Take H ("messy stabber", `messystab`) was driven into tanh
  ×4.7 light / ×9.7 heavy by the #626 loudness match, which flattened it into ~.7 s of full-band noise on ~1 hit in 6. Lead ruled
  FIX 1: H dropped, hit_flesh and hit_heavy 6 → 5 takes, test pinned to five. Fizz metric (noise-flat 4–14 kHz within 30 dB
  of peak): H 0.77 s heavy / 0.69 s light → removed; the longest remaining hit is 0.30 s. Sprite gzip 999,206 → 967,498 B.
- **#817** (head b7795bc8, READY, all 15 checks done: 14 success + 1 skipped): SCOPE 7 change A. `guard_break` in absolute
  Hz, the 70 Hz thump dropped, weight lighter, more mid rattle. Phone LUFS −38.2 → −32.6 (block −30.5, parry −29.7, both
  unchanged); ≥ 300 Hz share 3 % → 59 %; fizz ≤ 0.02 s; check-budget PASS (audio 769,729 B per fight). Before/after clip went
  to Dom. Strategy cleared it without waiting for his listen: a one-line revert if it sounds wrong.

### Open
- Dom hasn't confirmed by ear that the fizz is gone, or heard the guard-break clip.

### Gotchas
- A session launched in an app worktree (`…/.claude/worktrees/…`) can't edit `~/Developer/frankendom-audio`: the app refuses,
  and `change_directory` / ExitWorktree don't help. Dom OKed working from the app worktree (via Strategy, 2026-09-26). That
  worktree needed `artifacts/audio/source-cache` copied over (the recording download times out) and `npm ci` (a stale
  `@types/three` gave unrelated `gore.ts` type errors). `npx tsx --test` hangs; use `node --test`.
- quality.yml runs only for PRs based on trunk. Force-pushing a stacked PR, then retargeting it, fires NO quality run; close
  and reopen the PR to trigger one. A trunk merge also starts release-checks: watch ALL checks (`gh pr checks`), not just
  quality, before calling a PR green.
- The fizz probe script lives outside the repo at `~/.claude/projects/-Users-domininclynch-Developer-frankendom-audio/fizz_probe.py`.

## The opponent's charge on the phone measure — 2026-09-25

### Now
Nothing to build. #725 (head `cbe11604`, Lead READY) rides the deploy after #722, with #713. After it lands, confirm it on trunk
with `git merge-base --is-ancestor cbe11604 origin/codex/01a09a76/task-1` and in `release.json`.

### Done
- #725 adds a `charge-foe` probe to `CUE_PROBES` (`src/audio/exchange.ts`) and moves the ordinary coverage pin in
  `scripts/audio-preview.mjs` from 19 to 20. `charge_foe` (Weapons #678, live) plays only on an actor-1 `Charging`. The old
  `charging` probe is actor 0 and silent, so the cue had never reached the phone table or the `COMBAT_LEVEL` check. Receipts on
  `cbe11604`: `audio-preview --label charge-foe --check` EXIT=0; eslint, `tsc --noEmit` and `typecheck:tests` all 0;
  `tests/audio.test.ts` 22/22. Full `quality:stop` not run (load 147); CI ran it.

### Open — post-playtest, Lead rules after Fri
- **charge_foe is louder than the hit it warns of.** Phone LUFS on trunk: charge-foe −36.7 (1.1 s), your own `charged` −36.5,
  whip tell −37.6, hit-light −38.1, hit-heavy −38.3, blocked −30.5. The whip tell sits 8 dB under its lash (#511).
  **Proposed number: `cue('charge_foe', .07, .5)` in `src/audio/cues.ts` (now .12).** That is −4.7 dB nominal, aimed at about
  −41 phone, 3 dB under hit-heavy. **Not measured yet.** The cut sits before the bus compressor, and the audio-mix memory
  says a pre-compressor cut partly comes back (#417: −2.5 dB nominal gave about −1 dB). So the real drop will probably be
  smaller than 4.7 dB. Before merging any change, render it with `audio-preview --label` and read the charge-foe row; don't
  quote the nominal figure.

### Gotchas
- A trial gain edit made for a render has to be reverted before you switch branches. An interrupted command left `.07` in
  `cues.ts`, and `git checkout -b` carried it onto the next branch. Check `git status --porcelain` before every commit.

## Lane state — 2026-09-24 (handoff: #626 live, lane idle)

### Now
Nothing open in the audio lane. Pick up whatever Lead or Strategy briefs next; the owner's ear on the rotation is the only
pending input.

### Done
- #626 (heavy landings rotate the six flesh takes, twelve variants loudness-matched on the phone band, Opus 72k) merged
  2026-09-24 03:23Z as `c92e56df`; live in `33b0bf57` (`release.json`, `git merge-base --is-ancestor` confirmed).
- The checks the entry below lists as owed all ran on head `19c91573`: `npm run quality:stop` EXIT=0 (528 pass, 0 fail,
  2 skipped of 530); `quality-stop-targeted` EXIT=0 (97/97); `check-budget` PASS on a rebuilt dist, audio 778,572 B gzip per
  fight; `src/assets/audio` 979,744 B gzip against the 1.0 MB cap. audio-preview, trunk `e455d85` → `heavy-rot`, LUFS-I / phone:
  hit-light −38.2/−38.6 → −37.6/−38.1, hit-heavy/riposte −35.6/−37.4 → −34.6/−38.3, blocked unchanged −29.1/−30.5.
  The probe renders one variant per cue, so it cannot show the six-way match; `tests/audio.test.ts` pins the rotation.

### Open
- Unknown whether the owner heard the before/after clip before the merge. H ("messy stabber") is driven hardest (×4.7 light,
  ×9.7 heavy) and is the take to listen for if one sounds gritty in play.

### Gotchas
- `check-budget` reads `dist/`, not `src/`: without `npm run build` first it reports the last build's audio (it printed the
  pre-#626 738,447 B). Rebuild before quoting its number.
- At load 80–137 `quality:stop` overruns the Stop hook's 420 s and `tests/release-checks.test.ts:73` (process-group kill)
  fails with ENOENT on `wedge.pid`; the same file passes 7/7 alone and the full run passes at load ~30. Load, not the diff.
- The deploy lock can appear between two checks minutes apart: read `~/.claude/state/deploy_in_flight.json` right before each
  heavy command, and `ps -p <pid>` to confirm it is a live `deploy.sh`.

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
