# Combat Sandbox (Dom's lane) — state

READ FIRST: brief = Strategy's "Frankendom lane: Combat Sandbox" paste (2026-10-13). Questions go to Project Strategy, not Dom.

## 2026-10-13 evening (after Dom's account switch): rebased on EF, republished
- sandbox/page is rebased onto release EF b416d5c6d (backup branch sandbox/page-pre-EF, local only). Conflicts resolved: tests/graphics.test.ts module map (+hit-stop-rows), duel.ts (trunk's v55 breath-cone pulse loop kept, then the boss-phase loop), and the sandbox files prepended to trunk's new cone lists in eslint.config.js, detmath and record-version-guard.
- VPS: tsc clean; 148/149 targeted tests pass, the only red is the expected record-version-guard. Pushed 8bff819f7; preview republished and serving "trunk b416d5c6d".
- Rows status: swarm is done. CC fade and damage kinds are trunk rows already (cc-defs, damage-kind-defs).
- Armour (Lead correction, 2026-10-13): the casting penalty column already exists in #2577 (346756ba1, Lead PASS, heading into EH): src/fight/armour-weights.json (castPenalty heavy 20 / medium 10 / light 0) plus a weightClass column on gear-defs. Reuse it; add no column of our own. The sandbox presets now match it: heavy = plate, medium = leathers, light = robes, no mail set. The cast hook (the castPenalty lookup) is Combat's to build on top of #2577; ask Combat for the hook, not for a column. Pick up armour-weights.json at the rebase after EH.
- Mech count: 10 sandbox-mech commits against Strategy's max of 5. Lead (2026-10-13) confirms this is fine under Dom's direct "forget the rules" for the sandbox.
- Breath cones are now on trunk (v55), so drop them from "not built".

## 2026-10-13 night: Dom's scope word (direct, beats the relayed plans)
Dom: the Sandbox is where he customises and iterates new combat techniques with freedom from the main game; what he likes gets rolled into the main game later under the data layer. The armour casting penalty and the rest can move independently from the main game (build it here, do not wait for #2577/EH or Combat). PicoClaw is Dom's personal chief of staff; its relay is not this lane's job.
- sandbox-mech castPushback (Dom: YES to spell interrupt rules): a hit that does not cut a cast delays its release 30 ticks (0.5 s), twice a cast (WoW). Rows castPushback / castPushbackMax in sandbox-rules-defs.json; tests/sandbox-cast-pushback.test.ts green on the VPS.
- sandbox-mech castPenalty (Dom: armour weight slows casting; numbers as #2577): +20% windup in plate, +10% leathers, 0 robes. The sim only sees gear as sheet dials, so castPenalty rows in sandbox-rules-defs.json read the weight class off them (armour dial >= 20 = heavy, stamina dial >= 20 = medium). Promotion swaps in #2577's weightClass lookup, same percentages. Cast progress bars are clamped at 0 since a pushed/penalised cast can run longer than the base windup. Unit-tested (castWindup); not yet driven through a full duel with a worn set.
- Combat's #2608 (63b65b9ec, stacked on #2577) applies the armour casting penalty in gearDeltas as a spellPower cut (heavy -20, medium -10, light 0, `dial` column in armour-weights.json), no sim change. The sandbox's own castPenalty adds windup time instead (+20/+10/0 %). When both are on trunk, rebase and pick one (or run both and let Dom compare); the percentages are the same rows' numbers.
- Also built since: execution via posture break (executeMult / executeBelow rows), health-gated arm wound (below column), boss phases only enrage the foe. Not built: battle fatigue, positioning gates, rampage, school lockout; one-button touch layouts proposed to Dom (8 mockups in chat), awaiting his pick.

## HANDOFF (2026-10-13, end of session; read this first)
**Now:** branch sandbox/page on trunk 4891c6c38 (release EB) plus later work, preview https://frankendom.com/preview/sandbox/. Publish with `sandbox/publish.sh`; run tests on the VPS with `sandbox/vps-run.sh` then `capture --prio 3 sandbox node --test <files>` (never on the Mac). Dom's word beats the process rules; guardrails: only sandbox/page and /preview/sandbox/, nothing to trunk or live, Combat promotes.
**Done today (all tests pass on the VPS):** stances 2x; flash off / ring row (off) / clash sparks on guard break; crowd roars; arm wound with on-screen notice and a stamina-ceiling cost; dodge counter (sandbox-rules-defs.json dodgeCounter 20); many-on-one rows 1.0/0.5/0.3/0.3 plus engine hook (duel.roll.attacker); interrupt lockout (interruptEarly 1000); armour classes as rows (leathers/mail/plate with a stamina cost, one blended value, no hit locations); boss phase rows (boss-phase-defs.json: enrage at 50%, share x1.5, cooldown 30%, message); donor research summary in docs/state/combat-research-2026-10-13.md.
**Done (2026-10-13, verified live at 3a0b076c1):** the stance picker is now the icon stack Dom chose (B2): Neutral first, right edge, muted, the game's own #stance-panel buttons restyled in sandbox/entry.ts (restyleStances). Still to do there: show Neutral as pressed by default, and move it into the real game via the Web & UI lane if Dom wants it outside the sandbox.
**Open:** (1) Published: the boss phases and sim-list entries went live at 06a99f29b (verified on the live preview: the panel shows the phases and attackers families); later commits are doc-only. (2) record-version-guard stays red by Strategy's ruling; Combat bumps at promotion. (3) Not built: battle-fatigue meter, hit pushback on casts, breath cone, rampage, boss phase colour (Dom: no colour changes), hit locations (Dom: no). (4) Characters lane owns the Headsman idle stoop. (5) Dom still to rule: ring on/off (currently off).
**Gotchas:** Fight button sometimes does not register in the pane (use find + click ref). Strategy sessions: Project Strategy - Fable 5.1; Lead Dev [dc5642]. New sim files must be added to eslint.config.js SIM / SIM_DATA, tests/detmath.test.ts and tests/record-version-guard.test.ts SIM_FILES. Pane screenshots, not canvas grabs, show the live view.

## WORKING MODE (Dom, 2026-10-13): "forget the rules, this is a sandbox, I want to innovate and iterate." Dom's word beats the process rules below (template-plus-rows, max 5 mechs, reuse-first gates). Still true: everything stays on sandbox/page and the /preview/sandbox/ page; nothing goes to trunk or the live game.

## RULING (Strategy 2026-10-13, replaces brief rule 1)
- The sandbox MAY edit src/fight on sandbox/* branches (same files, no copy).
- A mechanic = one new template in src/fight + rows in sandbox/rows.json; rows absent = inert. No sandbox-only flags/build switches.
- One commit per mechanic, "sandbox-mech: <name>", with its own red-to-green test. Rows off = fingerprint identical to trunk.
- Rebase after every release. Max 5 mech commits; a mech 2 releases old without Dom's verdict is dropped or promoted.
- REUSE FIRST: hit stop rows (#2515), poise/flinch ladder (#2525), hit-impact.ts, stagger rows. Ask Combat what exists before each mech.
- Page footer (panel bottom) shows trunk base, engine fingerprint, active mechs. One line to Lead per preview publish.

## REUSE-FIRST RECEIPTS (Combat & Specials, cross-session reply 2026-10-13, read on trunk 411671c23)
- wounds: trunk's src/fight/wounds.ts (tests/wounds.test.ts) is creature BLOOD from the catalogue, presentation only, never read by the sim; hamstrung.ts is a finisher pose. The sim's attrition wound is duel.ts `wound` (legWound, RULES.attrition). Combat: "an arm wound that lowers guard/block: NOT THERE ... the extension point is the same hit site (duel.ts:476-479)". sandbox-mech wounds extends exactly that site and the stance quantities (stanced), not wounds.ts.
- impact: trunk's hit-impact.ts tiers (tests/hit-impact.test.ts) are the hit-stop frames + camera knock; Combat: "MISSING: a screen flash, a ground shockwave ring ... add the flash/ring/clang as columns of hit-stop-defs.json after #2515, do not fork a second tier table". sandbox-mech impact reads hit-impact.ts impactTier and adds optional columns to #2515's hit-stop-defs.json rows (cherry-picked under it).
- crowd: Combat: "No roar-on-big-hit or on-kill trigger found"; sandbox-mech crowd extends src/audio/arena.ts's own play() and cues.

## KNOWN RED (expected on this branch, not a defect)
- tests/record-version-guard.test.ts "a sim change without a RECORD_VERSION bump": the wounds mech edits src/fight/duel.ts and stance.ts (sim files), so the source digest moves while RECORD_VERSION stays 54. Strategy's ruling: the sandbox fingerprint may differ from trunk; Combat bumps RECORD_VERSION at promotion and re-pins (digest on 2026-10-13 at 8e884ba95: c3e54daa45d4b35f297a9c2b2d284635730e2e1ed36ea8ef7b93bf0d32a82133, PINNED_FOR_VERSION 55).
- Evidence the behaviour is unchanged with rows off: tests/rng-fingerprint.test.ts passed on the VPS with the wounds code in place (5/5 with the crowd test, 2026-10-13); the other 285 of 286 targeted tests pass.
- Do NOT bump RECORD_VERSION on sandbox/page: it would force a fingerprint-fixture regeneration here and conflict with Combat's promotion PR.

## LIVE
- https://frankendom.com/preview/sandbox/ — published 2026-10-13 from branch `sandbox/page` on trunk 501f5f0c3 (release-DU).
- Worktree: ~/Developer/frankendom-sandbox (node_modules is a symlink to the Desktop checkout's; never commit it).

## How it works
- `sandbox/entry.ts` patches the row JSON objects in memory, then imports `src/main.ts`. src/fight is never edited.
- Override layers: committed `sandbox/rows.json`, then the browser's unsaved edits (localStorage `frankendom.sandbox.rows`).
- Panel: opponent picker (`?opponent=`, the 17 roster ids), one textarea per row family, one row per line. Apply = reload; Reset to live; Save = downloads rows.json (Dom sends it, the lane commits it).
- Families in the panel today: sheet-defs, stance-defs (+wounds), hit-stop-defs (contacts, keyed), crowd-defs, gear-defs, damage-kind-defs, cc-defs, swarm-defs, bosses.
- Mechs on the branch: wounds, impact, crowd (on #2515 cherry-picked). Unit tests 22/22 green on VPS 2026-10-13.
- Publish: `sandbox/publish.sh` (rsync to VPS /root/frankendom-worktrees/sandbox, build there, copy into current/preview/sandbox). A release swaps `current`, so republish after each release.

## Next
- Hero build editor (level + points on the ten dials) — the sheet panel edits the dial ROWS, not Dom's hero's placed points yet.
- Immunity tiers and level curve rows: locate their files.
- Rebase onto trunk after each release, then republish.
