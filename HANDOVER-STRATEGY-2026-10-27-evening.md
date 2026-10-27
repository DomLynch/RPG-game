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
- **Armagedom** 18 PRs today, Dom's phone fixes shipping as small releases; alpha gate still Dom's phone.
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

## Sessions
Frankendom v3 Dev local_1ca78c9a (merger of V3), Physics Dev local_e7ad7655, ARMAGEDOM Lead local_5e22da4d, Hooks
Dev local_ae8459e7 (sweeps, hooks), Frankendom Deploy local_1bfdae3e (V1 standby, hfjob owner), z- Agent
Micro-Manager local_c3772e5c (PM; its revert asks are ignored, its findings are useful), HF boxes session archived.
