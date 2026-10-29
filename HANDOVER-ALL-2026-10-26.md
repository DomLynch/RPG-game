# Handover, all projects, 2026-10-26 00:55 Dubai (Strategy, for any account or dev picking up tomorrow)

Dom ran out of tokens; every dev was told to stop, commit, write a handoff block and go idle. All confirmed. Read this, then the per-project pointers. Rules first.

## Standing rules (Dom's, do not relitigate)
- Dom is CEO. Strategy = decisions no lane can make, project-stopping blockers, one picture + one line. Devs own their work and talk to Dom directly; no status pings, no relaying, no per-item questions upward.
- Data layer first: no hard-coded values; rows and rules as data. Minimal lines, no bloat, no dependencies beyond three.js in V2.
- Mac for coding; VPS (ssh -i ~/.ssh/binance_futures_tool root@49.12.7.18) for heavy jobs; Hugging Face CPU ($0.03/h) for batches; GPU only on Dom's word. VPS load was 9 to 25 tonight.
- GitHub Actions is the only gate; merge on green; PR stills at 375 for anything the player sees; no stacking; no wording pins.
- Never touch anything armagedom on the VPS or storage box unless its owner says so. Never edit Dom's two sandboxes. Disk: Hooks Dev's standing rule (idle > 24 h, verified copy to the box, then remove; report once a day).
- No blocking questions: pick the default, say it in one line, continue.

## Frankendom V2 (the gladiator game, the main thing)
- Live: https://v2.frankendom.com (own nginx block, Let's Encrypt auto-renew, push-to-deploy on green main, code under /b/<sha>/ so nothing is stale). Repo DomLynch/Frankendom-v2. Session "Frankendom v2" (group Frankendom v2), last save cffe93b, handoff at top of docs/PLAN.md. A Haiku PM session manages it.
- What it is: clean rewrite (~2k lines), two fighters on the OpenTrident viewer stage, Frankendom V1's thumb controls and combat numbers as data (move-defs.json, RULES.md), one opponent from a behaviour row, local deterministic 60 Hz sim written as the shared module. Guest only: NO sign-in, NO Supabase for now.
- Bodies: ONLY the 106-joint rig (one-mold rule; CI and loader enforce it). Default = armoured MakeHuman pair. OpenTrident is adding a V2 tab with the Mixamo characters converted onto the 106 rig (knights first); they become the default when delivered. Original Mixamo tab untouched.
- Gate: Dom's feel verdict. He said "floaty, not comparable". Work in progress = the FEEL LAYER: frankendom-strategy/docs/FRANKENDOM-V2-FEEL-LAYER-2026-10-25.md (22 lines) + frankendom-lead-catalogue/docs/v2/feel-layer-for-v2.md (Lead's page: V1's weight is the contact stack, not hit-stop). Contact stack, camera, sounds, specials, kill cam, zoom guard are live; next: weapon model from the library, hit readability, V1 HUD labels, then weight items A1-A6.
- Later steps: step 3 = live shared zone (drop in/out, shared bosses, server-held per-part health, credit by damage ledger; copy Armagedom's stack and Frankendom's zone row and layers, build the headless server sim neither had), step 4 = finishers + ragdoll from the physics package.
- Docs: brief frankendom-strategy/docs/FRANKENDOM-V2-DEV-BRIEF-2026-10-25.md (wins over older messages); core reference frankendom-strategy/docs/COMBAT-101-TOP-25-2026-10-25.md (25 items, two addenda, every ruling: armour never blocks, full gore, winner takes copy / loser keeps, bleed-out one rule, finisher trigger, duel budget 4 active ragdolls, five reference games closed); controls page frankendom-lead-catalogue/docs/v2/controls-and-combat-for-v2.md; pit live-zone page frankendom-lead-catalogue/docs/v2/pit-live-zone-for-opentrident.md; Armagedom shared-zone page in side-session-notes/local_ade728d1-.../shared-zone-mmo-state-for-opentrident.md.

## Physics (M1 to M6, the critical path after feel)
- M1 done (Jolt, MIT, WASM, beat Rapier). M2 ragdoll generator running (opentrident-steam/docs/parts-lab/physics/, OpenTrident HANDOFF). M3 = death ramp + stagger dip, proof clip at 375 with FIVE fighters under 3 ms on a real phone. M4 rule rows, M5 severed head + corpse cut (the loot mechanic), M6 schema. Shipped as a package V2 installs.
- DECISION FOR DOM IN THE MORNING: "switch" (OpenTrident dev takes it with agents) or "new session" (dedicated Physics Dev in the Frankendom v2 group; Strategy recommends this). Brief ready: frankendom-strategy/docs/PHYSICS-DEV-BRIEF-2026-10-26.md.

## OpenTrident (the library: bodies, clips, weapons, numbers)
- Session "OpenTrident - Dev" (local_a187c9cd), handoff at top of HANDOFF-latest.md; push sha not confirmed, check origin/main. opentrident.org now caches models for a day (Cache-Control fixed tonight).
- In flight: V2 tab with Mixamo characters on the 106 rig (knight conversion agent stopped BEFORE running; site/models/v2 does not exist yet); Gladio Mori + TABG follow-up (priority order in core doc addendum 2); five-game physics comparison is the single source of numbers (docs/parts-lab/combat-physics-comparison-five-games.md); game census (ArcheAge test) parked.
- Downloads: reference set CLOSED. Still to extract and shelve: Gorn 2 (Steam, Dom's library), Shadow Fight 3 (Android package, Dom downloads himself), Punishing Gray Raven only if a key turns up; Farlight 84 for Armagedom (Dom briefs that dev himself). Last Epoch parked post-alpha; Diablo, Black Desert, Where Winds Meet, Chivalry: no.

## Make Human / character factory
- Session "Make Human Dev" (local_80b5d70e), save fa38857, handoff at top of docs/parts-lab/makehuman/README.md. 89 bodies kept + round 2 (200 candidates on HF CPU) may have finished unattended: gate it, then WIDEN THE ROWS (thin cells of the 24-cell matrix, 2-3 new shape rows) instead of a round 3. Materials sheet and 24 size fits pushed. Licence closed: existing FLUX heads ship, new heads on schnell only; reusing an approved head file is not a new head. PM receipts: commit hash only.

## Armagedom (Dom's MMO, alpha soon)
- Lead local_b7f7196e, Backend local_ee42b696, Auditor, Deploy, Web, World, Chars, Combat sessions in the ARMAGEDOM group. Release 235 live. GitHub CI sharded, tier A/B audits, merge on PASS (memory: armagedom-release-latency-rules). Tutorials being built. Live world: database holds shared HP, phones run boss AI (no server sim; Lead honest about it). Physics port only after V2's M3. Farlight 84 is its touch-shooter donor (Dom's own brief). Contracts/bounty cut from alpha.

## Frankendom V1 (RPG-game repo, archived into V2)
- frankendom.com live at 82a994d15 (Exo hero), untouched. Lead session local_2fc38bda wrote the three V2 pages tonight and the iOS zoom fix. Known: shared health per phone (never fixed, by design), camp rotation fix in unmerged #3627. Carry over only data and specs, never code.

## Hooks Dev / ops
- Session local_c4e1e40f (pinned). Disk crisis handled: Mac 71 GB free, VPS root 90 GB, volume 35 GB (tightest), 5TB box 1.2 TB. Half Sword wine runs killed, hfruns moved. Approved: disk guard at 85% to Dom's daily note; next keyed-game runs write to the 5TB box (Dom's own session). Standing rule decides the rest; no per-folder asks.

## Strategy's own
- Memory under the Strategy scratch key: read ceo-consultant-not-weeds, frankendom-inventory-before-advising, combat-101-pivot, strategy-handoff-2026-10-23 (top block). Strategy repo DomLynch/RPG-game branch strategy/state-1007b holds every doc above, last commit e24659f8e (+ this file).
- Tomorrow in order: (1) physics owner decision; (2) V2 feel verdict loop; (3) knights onto 106 and the V2 tab; (4) Make Human round 2 gate and widened rows; (5) Armagedom alpha continues on its own leads.
