# Strategy handover, 2026-10-27 17:50 Dubai (for the next account / session)

Read with memory `strategy-handoff-2026-10-27` (morning) and the READ FIRST memory lines dated 10-27. Strategy = CEO / MBB
altitude (Dom, three times today): rulings only, one message each, diagnose and hand the fix over, never implement,
reply only to escalations and Dom's queries. Dom's standing rules of today: all rules bend to circumstance and common
sense; V3 is ONE endless MMO world, no bounded area/circle/instance ever; Hugging Face CPU for every lane via `hfjob`.

## Live right now (receipts 13:46Z)
- **V3 (the game)** https://v3.frankendom.com build `aac879c`. 75 PRs merged today. Live: open world (no pit, free
  walk, endless ground, skyline B, three bosses spread, opener, leash to camp), difficulty 1-10 (default row 5),
  physics finishers + real cut meshes + cuttable corpses + head split/belly open, M7 fight feel (hitreact, clash, kick
  as interrupt, limbs), light-hit-fall fix (#149), presence client (server redeploy in progress), camera +10%.
  Default rules = v1 (hotfix) until #158 flips M4 back on the zero-falls proof. Open: #158, #157 hero reactions
  (off by default), #155 far-boss fade (ship as half opacity), #152 nits, #122 zone design doc.
- **Physics** `DomLynch/physics` main, 12 PRs today; M1-M9 done, M10 is V3's server work. Next: strength-rung fix
  (a light glance must never read `kill` on an undamaged body), perf budget rows (#138 merged), m4b A/B row live.
  65-rig bodies parked for good (V3 = 106 only).
- **Armagedom** release 281 LIVE (eab4865f, rollback 280, floor 279), 18 PRs today. Wound down 13:55Z; finishing
  only: #368 golden (cut 282), #373 airdrop (QC then Auditor, 283), #366 population (+ writer redeploy pre-staged,
  284). State note: side-session-notes local_61f070fb/lead-status.md "WIND-DOWN 27 Oct". Alpha gate = Dom's phone.
- **V1** frankendom.com `2beaa116`, archived reference, Deploy on standby, touch nothing.
- **Infra**: `hfjob` + four standing HF boxes (v3, physics, armagedom, v1) on the Playwright image, 15-min auto-sleep,
  cron job record, runbook `docs/HF-BOXES.md` (RPG-game). Waterfall = Mac (stills, WebKit) -> VPS (lanejob, load < 12)
  -> HF box/job spill. HF Jobs cap ~2 concurrent on the account (undocumented); boxes are the workaround; Dom may ask
  HF support to raise it. VPS root 85% after the sweep (ue-keys 23 GB, /var/www 19 GB are Dom's calls). Orphaned WWM
  loop killed 15:25. Agent clones now go under /srv/dev-jobs/<lane>/ and are deleted on merge.

## Open decisions (Dom only)
1. HF token on the Mac: Dom said "change the rule"; Hooks Dev wants his own one-word yes. Boxes make it optional.
2. Opponent two: Dom names it (V3 scope).
3. VPS under 75%: needs a ruling on ue-keys / var-www / live shadow scratch.
4. Armagedom alpha gate verdict (phone).

## Rulings of the afternoon (do not re-litigate)
Knockdown is rare: heavy, guard-break/riposte on a staggered foe, stamina out, cumulative damage, death; light =
flinch; kick = interrupt, never a fall by itself, spammable with cooldown/stamina rows; min gap between falls ~6 s;
leg falls only via part-HP over repeated hits; sim tracks its own counts, never Jolt values. Weight target 5.5 MB for
alpha, no brotli. Camera: portrait as approved, landscape same hero height (V1 `min(aspect,1)`). Presence shards of
20 invisible; Postgres on the VPS; local kill stands, server records credit after. One merger per repo (V3 Dev for
V3). One review round per PR; a second fail comes to Strategy. OpenTrident repo stays private (no box).

## Wind-down receipts (17:55 Dubai)
- Armagedom Lead: wound down, see above.
- Hooks Dev: wound down, no jobs running; note memory `handoff-disk-sweep-2026-10-27`; for Dom: ue-keys 23 GB,
  /var/www 19 GB, ARMAGEDOM ports 8811/8812/8891-8896 live, winedevice 3577501; HF-token hook change NOT done (wants
  Dom's own word in chat); hooks PRs #178/#165 held for the Auditor read.
- Physics Dev: wound down. #158 (8c32621) waits on stills + 20-light/heavy traces + one reviewer, then V3 Dev merges;
  #157 and #152 have reviewer PASS-with-nits, V3 Dev merges. Strength-rung fix parked, not started (first item in
  its note). Note: memory `physics-dev-state` + top of physics `docs/BRIEF.md` (edit UNCOMMITTED on main, commit it
  first thing). A worktree with b22f333 (text-only perf.json edit) may not be on main. The #158 agent runs until done.
- V3 Dev: wound down, FINAL. Live build 721fbdc (main CI green): #158 merged, M4 is the default rules again (20 lights
  = 0 falls proven); #157 hero reactions merged; presence server REDEPLOYED (release 370ab65, two wss clients verified).
  Open: #155 half-opacity boss fade (head 65d071f, CI green, needs one independent reviewer PASS naming 65d071f, then
  merge); #122 zone design doc (D3a writer-service decision undecided). Next account's first V3 items: a clean heavy on
  a torso under 60% only staggers (one data/feel-sim.json row, re-prove, Dom's phone); remove the stale "default is
  v1" comment in data/rules.json; post-merge PASS on #152 (b297b549). State note: memory `v3-state-2026-10-27-wind-down`.

## Save-your-work roll call (18:30 Dubai, verified on disk)
Fresh memory note today: Armagedom Lead, Auditor, Backend, Combat, Deploy, Web, World, Characters & Art
(`armagedom-art-lane-state`); V3 Dev (`v3-state-2026-10-27-wind-down`); Physics (`physics-dev-state`); OpenTrident
(11:00 handoff); Hooks (`handoff-disk-sweep-2026-10-27`); Make Human (`project_makehuman_lane-state_2026-10-27`);
Frankendom Deploy (`project_deploy_handoff_2026-10-27_v1_standby`, V1 K6q36 on standby); Micro-Manager
(`project-pm-state-20261027-consolidated`, saved ONLY in its own memory folder, which is an expiring scratch workspace
(deleted after a week idle); it will copy into the shared frankendom-main memory on Dom's yes; better: re-home that
session to a real folder); Strategy (this doc + memory).
V1 lanes (Lead, Combat, Web, World, Characters, Backend): standby since 10-25, notes from then, nothing changed today.

## Sessions
Frankendom v3 Dev local_1ca78c9a (merger of V3), Physics Dev local_e7ad7655, ARMAGEDOM Lead local_5e22da4d, Hooks
Dev local_ae8459e7 (sweeps, hooks), Frankendom Deploy local_1bfdae3e (V1 standby, hfjob owner), z- Agent
Micro-Manager local_c3772e5c (PM; its revert asks are ignored, its findings are useful), HF boxes session archived.
