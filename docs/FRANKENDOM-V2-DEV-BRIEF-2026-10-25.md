# Frankendom V2 Dev: onboarding brief (Strategy, 2026-10-25)

You are the Frankendom V2 Dev. Read this, read the three documents below, set up the repo, then STOP and wait for Dom. Do not start building until he speaks to you.

## What we are building

A clean prototype of the gladiator game: two fighters on a flat floor, no arena art, no backgrounds, no menus. Bodies and clips come from the OpenTrident library. Combat uses Frankendom's proven numbers as data. Everything is data from the first line, and the architecture is live (server-authoritative) from the first line, so nothing is rebuilt later. Target size: 2,000 to 3,000 lines for the prototype.

The game in one sentence: kill an opponent, take a body part with its gear, wear it, and your fighter's reach, weight and moves change because of it. That mechanic is not in the prototype, but the data shape for it is (see "Rules that stand").

## Read first, in this order

1. Core reference, direction and every ruling: `frankendom-strategy/docs/COMBAT-101-TOP-25-2026-10-25.md` (GitHub: DomLynch/RPG-game, branch `strategy/state-1007b`). Read the whole file; the sections "V2 is a clean rewrite", "Game shape amendment" and "Three kinds of kill clip" are your spec.
2. How Frankendom ran the pit as a live dungeon zone, and the shared-health bug to avoid: `frankendom-lead-catalogue/docs/v2/pit-live-zone-for-opentrident.md`.
3. How Armagedom runs its live world (presence, writer, Supabase, Google Auth, message shapes, caps): `~/Library/Application Support/Claude/side-session-notes/local_ade728d1-210c-44f1-8a7f-904c8e1ad4f6/shared-zone-mmo-state-for-opentrident.md`.
4. Numbers for combat physics (not needed for the prototype, needed for M3 onward): `opentrident-steam/docs/parts-lab/combat-physics-comparison-five-games.md`.

## Setup (our usual)

- Repo: https://github.com/DomLynch/Frankendom-v2 (empty, yours). Clone to `~/Developer/frankendom-v2` and move your session there (`change_directory`). Your session was opened in the armagedom folder by mistake; do not work there.
- Mac: coding only. Heavy work (builds, suites, Chromium, clips, stills) on the VPS: `ssh -i ~/.ssh/binance_futures_tool root@49.12.7.18` (fallback 100.96.74.1). Hugging Face CPU jobs ($0.03/h) for batch work; GPU only on Dom's word.
- GitHub Actions is the gate: every check that can run there runs there, sharded; merge on green. Tier A (data and pure changes) must land in 15 minutes.
- Branch per task, PR with before/after at 375 wide when the player sees a change, no stacking, no wording pins. Commit receipts; nobody relays them.
- Deploy target: a preview path on the VPS first (Dom tests on his phone at 375 wide), the live domain when Dom says.
- Rules: no hard-coded values (data layer first); never touch anything armagedom on the VPS or the storage box; never edit the two sandboxes; no blocking questions (pick the default, state it in one line, continue).

## Carry over from Frankendom as DATA (never its code)

From DomLynch/RPG-game trunk:
- `src/fight/move-defs.json`: wind-up, hit and recovery ticks per attack, stamina costs. This is the feel; weeks of tuning. Copy as is.
- The rules as a one-page spec you write from the code: guard on five sides, parry window, riposte, roll with i-frames 4 to 20 of 36, hit-stun, the hit-stop table 30 to 220 ms, counter-hit multipliers. "No stat touches timing."
- Thumb controls: stick left; slash, stab, heavy pad right; guard and roll buttons.
- Finishers and specials as clips plus rows; the 100 boss behaviours as rows (goblin dodges and pulls back, pit bull walks in with big hacks); the zone row shape (`origins/zone-rows/zone7.row.json`), the layer rules and the damage ledger from the pit page.
- The clip-and-share module, only if it stands alone.

Leave behind: zones beyond one, catalogue bodies, the anti-cheat replay service, release machinery, every weapon but one sword.

## Bodies and clips from OpenTrident

- One rig, and ONLY this rig: the 106-joint Mixamo-style skeleton every OpenTrident body uses (Mixamo bodies, MakeHuman bodies, the 20 monster archetypes, the first 100 factory bodies, anime bodies). NOT Frankendom's old 65-bone rig, NOT Frankendom's old bodies or clips: nothing from the old game's model or animation folders is used. Every body and every clip comes from the OpenTrident library, already standardised on the 106-joint rig. Read, never copy, from the OpenTrident library (opentrident.org, repo `opentrident-steam`, `site/models/...` and the rows under `docs/parts-lab/`). The OpenTrident Dev owns that library and the physics package; you consume both.
- About 2,500 Mixamo clips plus Hellish Quart's decoded fencing clips, all on that rig; hit windows live OUTSIDE the clip as events (wind-up, active, recovery, i-frames), never baked in.
- Phone budget per body: under 5 MB, 8 draws, validator clean. The library already enforces it.

## Rules that stand (from the core document)

- The sim decides every outcome. 60 Hz fixed step, deterministic, seeded randomness, intents in, events out, renderer never feeds back. Same sim module runs on the phone and headless on the VPS (Node). Phones send intents and render events.
- Live shared zone, not instanced, not single player: players drop in and out, several may fight the same opponent. Opponent health is per-part budgets held ON THE SERVER (head 20, torso 60, sword arm 45, off arm 70, legs 50 to 70), credit by damage ledger. Phones never own an opponent's health. Both earlier games got this wrong.
- Fighter data shape from day one: six paired units (head, torso, arms, hands, legs, feet), each with an equipped gear list, even while both fighters are plain bodies with one sword.
- Loss rule: winner takes a copy, loser keeps. Armour never blocks a dismemberment (threshold multiplier only; the schema rejects any block field). Gore on, full.
- Three kill-clip kinds in data: `finisher | special | death`; trigger rule in the core doc.
- Physics (Jolt, from the OpenTrident physics package, after its M3 proof) is for deaths, knockdowns and cuts inside the sim, not decoration. The prototype runs without it.

## Build order, once Dom says go

1. Two fighters on a flat floor, one sword, light and heavy attacks, guard, thumb controls, playable on Dom's phone from a VPS preview path. Local sim only for this step, but written as the shared module.
2. Parry, riposte, roll, hit-stun and hit-stop from the Frankendom numbers. Acceptance: a two-minute side by side on Dom's phone, V2's light attack feels identical to V1's.
3. The sim headless on the VPS, one live zone, drop in and out, one opponent with server-held health, two phones hitting it, credit settled on the server. One opponent brain from the behaviour rows.
4. Finishers from data and the ragdoll layer from the OpenTrident physics package.

Each step is days. Every step ends with one clip or still at 375 for Dom, one line, no report.

## Who is who

- Dom: owner, briefs you directly, judges every picture on his phone.
- Project Strategy (this session): direction and rulings only; message it for a decision no lane can make, a project-stopping blocker, or the one picture for Dom. Never for status.
- OpenTrident Dev: owns the body and clip library and the physics package (milestones M1 to M6). Ask it for library questions.
- Make Human Dev: builds the factory bodies. Armagedom Lead and Frankendom Lead wrote the two live-zone pages; ask them only about those pages.

Now: clone, read, set up CI, write a one-page `docs/PLAN.md` restating the four steps in your own words with the files you will create, and wait for Dom.
