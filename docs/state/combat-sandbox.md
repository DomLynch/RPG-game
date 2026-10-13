# Combat Sandbox (Dom's lane) — state

READ FIRST: brief = Strategy's "Frankendom lane: Combat Sandbox" paste (2026-10-13). Questions go to Project Strategy, not Dom.

## HANDOFF (2026-10-13, end of session; read this first)
**Now:** branch sandbox/page on trunk 4891c6c38 (release EB) plus later work, preview https://frankendom.com/preview/sandbox/. Publish with `sandbox/publish.sh`; run tests on the VPS with `sandbox/vps-run.sh` then `capture --prio 3 sandbox node --test <files>` (never on the Mac). Dom's word beats the process rules; guardrails: only sandbox/page and /preview/sandbox/, nothing to trunk or live, Combat promotes.
**Done today (all tests pass on the VPS):** stances 2x; flash off / ring row (off) / clash sparks on guard break; crowd roars; arm wound with on-screen notice and a stamina-ceiling cost; dodge counter (sandbox-rules-defs.json dodgeCounter 20); many-on-one rows 1.0/0.5/0.3/0.3 plus engine hook (duel.roll.attacker); interrupt lockout (interruptEarly 1000); armour classes as rows (leathers/mail/plate with a stamina cost, one blended value, no hit locations); boss phase rows (boss-phase-defs.json: enrage at 50%, share x1.5, cooldown 30%, message); donor research summary in docs/state/combat-research-2026-10-13.md.
**Open (FIRST on restart, Dom asked 2026-10-13):** the stance picker redesign was only MOCKED (sandbox/mockups/hud-stance.png: four icons, Neutral first, top placements B1 under the banner / B2 right edge / B3 left edge; Dom liked it, I recommended B2) and is NOT built; the live page still shows the old Balanced / Aggressive / Defensive / Trickster text box. Build it as a sandbox overlay or via the Web & UI lane, muted gritty look, not over the left thumb pad.
**Open:** (1) last commit batch (boss phases, sim list entries in eslint.config.js SIM_DATA, tests/detmath, tests/record-version-guard SIM_FILES) must be pushed and republished; the full unit-ci was red only on sim-boundary lists (fixed) and record-version-guard. (2) record-version-guard stays red by Strategy's ruling; Combat bumps at promotion. (3) Not built: battle-fatigue meter, hit pushback on casts, breath cone, rampage, boss phase colour (Dom: no colour changes), hit locations (Dom: no). (4) Characters lane owns the Headsman idle stoop. (5) Dom still to rule: ring on/off (currently off).
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
