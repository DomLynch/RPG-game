# Frankendom — the top 10 (Dom, 2026-10-08 07:0x)

One list, ranked. One owner per item. Lanes work ONLY on their item. No other work starts until Dom approves this table.
Each owner fills in their row: **done** (with a receipt: PR, sha, command or link), **left** (steps), **finish** (a date). Lead posts it to Strategy by 09:00.

| # | Item | Owner | Done (receipt) | Left | Finish |
|---|---|---|---|---|---|
| 1 | Always-on shared world, run on the server (plan: #1758) | Backend (lead), Expansion, Combat | Plan merged on #1758 (comment 6045671672); Dom rulings 2026-10-08 (coarse sim far from players ~1 Hz, shard by zone ~200). Preview stopgap: the world keeps moving during a fight, live on /preview/origins/ (bundle xeCpdZ2f, Lead's browser check) | | |
| 2 | Hostile creatures done properly: hostile flag, up to 7 attackers, 3-4 active | Combat (sim), Expansion (world) | 2x wolf walking = fighting (1.24-1.29 m), live on the preview (xeCpdZ2f) | | |
| 3 | Zone 1 progress saved (character, loot, gold) | Backend | Writer active on the VPS, route answers (401 unsigned); ORIGINS_ENCOUNTERS + ORIGINS_CONTENT unset (Lead's ssh, 2026-10-08) | #1734 → writer reinstall → flags on (joint GO) → preview saves by default for signed-in + #1754 → live check | |
| 4 | Phones run well: iPhone black screen, load size, frame rate | Web (lead), Characters (asset weight) | #1751 Frontier shadow trim −20.5 % tris (Auditor PASS); duel-cost textures #1736/#1743-5/#1747 (~23 MB each, stills PASS) | | |
| 5 | Live duels finished end to end on two phones | Backend | | | |
| 6 | Zone 1 economy safe: Exchange/bank/smith launch gates + S1 load test | Backend, Expansion | launch-gates.md G/W/X/F/S rows | | |
| 7 | Stances live for all, incl. Balanced | Combat | #1740 (panel mounts at load + Balanced; Auditor PASS, CI) | ship #1740 | |
| 8 | Coach mode | Combat | #1746 draft; coach battery L6: neutral 88 / aggressive 92 / defensive 99 / trickster 84 % | balance ruling (defensive near-unbeatable) | |
| 9 | Network fight feel at 150-200 ms on a real phone | Combat, Web | | | |
| 10 | Reliable release line: builds on the VPS, FAILED posted at once, no Mac overload | Deploy (lead), Auditor; hooks lane for CodeGraph | Fold6 9f752b1a failed (jpegtran ETIMEDOUT under Mac load) and sat ~4 h unreported; standing rules sent (VPS builds, post FAILED) | fold6 re-run on the VPS | |

Items not on this list wait.
