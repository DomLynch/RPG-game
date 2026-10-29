---
name: strategy-handoff-2026-10-27
description: "READ FIRST after the 10-27 09:05 Dubai clear (after ceo-consultant-not-weeds): V3 is the main game (V1 archived, V2 retired), physics package live in V3 (M3/M5 done, M4 opt-in), Armagedom at release 265 alpha gate on Dom's phone, session names/ids, every ruling of 10-26, order of play for 10-27"
metadata:
  node_type: memory
  type: project
  originSessionId: 7cdf8410-d949-4077-ad6d-9e685146a4c5
  modified: 2026-10-27T05:04:27.069Z
---

# State at the 2026-10-27 09:05 Dubai clear (Dom: "save your work, I will /clear you")

Strategy's own folder is now `~/Developer/frankendom-strategy` (branch `strategy/state-1007b`, pushed). Docs written 10-26: `docs/FRANKENDOM-V3-PLAN-2026-10-26.md` (the V3 plan + sense-check), `docs/ARMAGEDOM-ALPHA-AUDIT-2026-10-26.md`, `docs/PHYSICS-DEV-BRIEF-2026-10-26.md` (updated evening block wins). Times to Dom in Dubai (+4), see [[dubai-time]].

## The big decision of 10-26 (Dom's, with Strategy's analysis and a second dev's sense-check)
**Frankendom V3 = V1's fight core lifted whole (fight logic + feel layer, 4.6k + 3.8k lines, no three.js in the sim) into V2's shell**, repo `DomLynch/Frankendom-v3`, Mac `~/Developer/frankendom-v3`, live https://v3.frankendom.com (nginx `/srv/frankendom-v3/live`, push-to-deploy on green). Seeded by git filter-repo from V1 trunk 82a994d15, tag `v1-seed-82a994d15`; V1 code enters only by cherry-pick. **V1 (frankendom.com, now 2beaa116 after K6q36) is archived and untouched as the reference; V2 is retired** (its rows re-added as data). Gate 0 = headless replay diff V1 vs V3 in CI (green, 42 rows). Gate 1 PASSED on Dom's phone 10-26 14:00 ("I really like it"). Dom: "V3 IS the main game"; frankendom.com points at V3 when Dom says it has passed; no port of anything to V1.

## V3 state at the clear (live 8540783 = main)
- Everything on the **106-joint Mixamo rig, 106 only, no 65 fallback in production** (#57, #62; Dom 10-26 ~22:00: "everything on V3 needs to be the 106"). Hero = Psyche (Mixamo), opponent = Minotaur fighting as V1's Pitborn (cleaver, no shield), both 106. Scope: only the characters V3 uses; Dom names the second opponent himself.
- V2 items re-added as data rows, each with a `?…=v1` toggle: camera like V2, novice brain default, sound at load, guard-walk legs, directional heavies (#10), Dom's clip picks (stab, cuts, heavy, guard), softer trails, special-fx reduction (hit-stop kept at 6 by Strategy), auto-start, Skull Crack x0.75, foe special obeys player reach (#65, a V1 bug), cleaver hits where drawn (#51).
- **Physics in the game:** ragdoll on every Minotaur death by default (#61), spine stagger (#56), M5 cuts (#66: head-zone kill takes the head with gear), finishers with a physics body opt-in `?ragdoll=finishers` (#70), **M4 rules evaluator on the Minotaur behind `?rules=v1`** (#72, merged 00:19). #71 cut follow-up open (failed one review, being fixed).
- Load fix live: 402 modules -> 13, throttled 4G 34 s -> 10 s; Cache-Control on GLBs; first visit ~12 MB bodies.
- Rulings: V1 reach stays under new clips (long reach behind `?reach=clip`); look-vs-score gap fixed by contact-offset row; no armour on V3 until after alpha/beta (Dom); stage untouched (Dom: "combat first").
- Session: "Frankendom v3 Dev" local_1ca78c9a-e2d7-44eb-9f38-9e34854acdad, Opus 5.5 medium, in the main checkout. Fast: ~16 PRs per 2 h on parallel agent worktrees. Standing steers given: no /clear mid-task (two clears cost an hour on 10-26), Dom-visible first, refactors/docs-only PRs last, close stale #54, a ready PR never waits for an unready one. PM "z- Agent Micro-Manager" keeps asking to revert defaults to V1: ignored by ruling.

## Physics (its own neutral session and repo, Dom's choice 10-26 ~20:00)
- Session "Physics Dev" local_e7ad7655-3c0d-4d70-9082-299bcb0b641e, Opus 5.5, repo `DomLynch/physics`, Mac `~/Developer/physics`, package `@frankendom/physics` (Jolt 1.1.1 WASM, deterministic 60 Hz, ragdoll from measure rows never bone names, serves 65 and 106 and Armagedom later). Brief `docs/BRIEF.md` with HANDOFF at top.
- Done: M1/M2 lifted, M3 (death ramp, stagger dip; real iPhone five fighters + cut 0.40 ms), M4 rule rows + evaluator calibrated per Strategy ruling (a) (tip speed, baseline sharpness 1, donor numbers as ratios; light sticks, heavy cuts mail, heavy + counter-hit cuts plate; 12-swing sample, widen when 106 clips land), M5 (cut carries gear, helmet prop, corpse cut, swept edge), M6 schema + lint, three-rig helper, cut-units tool (seven pieces + twelve caps, #29) and validator. Open: #32 cut-units hair handling.
- Approved 10-27 ~00:xx: proper cut-piece pipeline (seven regions, caps hidden until cut, triangles split at the plane, gear follows bone); V3's finishers become physics cuts with V1's camera/blood/sound timing as rows; cut GLBs + manifest stored beside each body in OpenTrident's library (OpenTrident publishes). Gate: Dom's phone, Minotaur head + one limb.
- Every cut emits a sim event (unit, gear ids) for the future take-one loot screen.

## Armagedom
- Data migration DONE 10-26 16:35 Dubai (numbers 3064 -> 0, strict gate, keep-in-code.json approved by Strategy on #246; tuning-ok ratchet #318). Lead then self-started a text-to-data gate (408 strings -> 0, 17:20-19:06): useful later, wrong order; ruled: no new gates until Dom passes alpha.
- **Release 265 is the alpha build; alpha gate is Dom's phone** (Lead sent the line with three things to try). Strategy audit (docs/ARMAGEDOM-ALPHA-AUDIT-2026-10-26.md): blocker found and FIXED on hosted (`enforce_cash=false`; the server clamped every player's money to 0 because the client never calls the kill-settle path); trust model = phones decide everything, fine for a friends alpha, say so; no DB backup recorded (Backend writing it up); boot-time error beacon being added; no analytics at all. Steam: no for now (no desktop shell/Steamworks, phone art, licence gaps: donor receipts "not fully traced", Flare CC-BY-SA question, TRELLIS outputs need the AI disclosure); Steam requires a warranty not receipts; ~3-5 weeks after alpha if wanted.
- Sessions: Lead local_5e22da4d (is the Lead; the setup session that started it is archived), Backend local_fa645d57, Auditor local_01a5c550, Deploy local_447b9cb4, Web local_2a7b3bb2, World local_9a5b8a0d, Chars local_15dde343, Combat local_c752fd79. No PRs since 20:00 10-26 (holding for Dom's alpha answer, as ruled).

## OpenTrident / Make Human
- OpenTrident Dev local_2e4f1d8e: hard rule in repo "all bodies on the 106 rig, the 65 rig never comes back" (ed657690); alpha push merged (shield/bow/gear pickers, six-slot gear data); retargeting Psyche's clips and the 8 baked special/finisher JSON clips to 106 for V3; handed M1/M2 to Physics Dev; WWM characters pending (two agents on the outfit-vpath mapping; fan out on VPS/HF CPU once solved). Handoff committed 10-27 09:02 before its own clear.
- Make Human Dev local_ba96e0b2: V1 armour as skinned conforming layers; rulings: per-body layers for the 14-15 standard bodies per race (buckets share settings only), Centurion first then knight then executioner, ship knight v2 now and Centurion at 6 (plateau: painted-in skin; Dom's call: accept or regenerate on GPU), fix defect classes once in the shared pipeline then batch races. BUT Dom 10-26 18:30: **no armour on any V3 character until after alpha/beta; Make Human told to stand down for V3**; library work continues at low priority.

## Hooks Dev / disk (local_ae8459e7)
- Guard ruling B merged (#180): tracked unmodified scripts judged on literal paths. Disk guard daily 08:15 (#179). Mac 39 GB free at 23:xx; Armagedom evidence folders copying to the box on Dom's yes; `.scratch-shadow` stays on the Mac (private security/handover files); live lanes' scratchpads untouched until idle; ue-keys work-* and Elden Ring folders are Dom's own, leave.

## V1 close-out
- Lead local_a2fcf448 closed V1 10-26: K6q36 live (2beaa116, kill-credit split), 0 open PRs (parked ones closed with a comment), private files moved to `.scratch-shadow`.

## Order of play 10-27 (Strategy's)
1. Dom's phone: V3 at 8540783 (`?rules=v1` A/B for M4, `?ragdoll=finishers`, M5 head cut); Armagedom 265 alpha gate (three things to try, money survives a save).
2. V3: #71 cut fix, M4 default on Dom's word, cut-piece pipeline bodies (Psyche, Minotaur) from Physics #29/#32 via OpenTrident, specials ready-ring, Dom names opponent two.
3. Physics: cut pipeline agents A/B/C, widen the M4 sample on the 106 clips, Armagedom port only after Dom passes V3 cuts.
4. Armagedom: nothing ships until Dom answers the alpha gate; then analytics + boot beacon + backup note.
5. Strategy: escalations and pictures only; verify by reading repos, never ask lanes "where are we".
