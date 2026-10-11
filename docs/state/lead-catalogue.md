# Lead (lead-catalogue lane) — handoff 2026-10-10 20:10 +04 (`date`)


## 2026-10-11 11:15 — handoff before /clear: LIVE BC f822c41aa; today's FINISH LINE items 2–3 in flight
**READ FIRST.** The 11:08 entry below is the full day. Restart memory: project_handoff_2026-10-11_1115.md.
**Finish line (Dom via Strategy 11:0x), in order:** (1) BC live ✅ 11:06. (2) Deploy's rows PR (receipt kind vps-rows-live, the Auditor's design ruling given) + release-owns-the-VPS (branch deploy/release-owns-vps @2eb2a1049; lane jobs → HF while a release run dir exists; stale-lock cap) + the missing-local-sha → HF spill fix → Auditor → live; then ONE quiet-box re-measure of a release unit run (target < HF ~8 min). (3) The notes-only unit-skip PR (docs/** only; a mixed change never skips; tested) → Auditor → live. After (3): NO new PRs; Deploy + Auditor write state entries and park; Lead sends Strategy the close line (lane list, branch heads, live sha, what rolls to Monday).
**Monitoring:** the COO micromanages the finish line; it reports to Lead only on a miss + the final "all parked". Strategy wants only the close line + misses.
**Lanes:** Backend PARKED (state PR #2182 @1c654782b, docs only, can ride the notes-only release). Deploy + Auditor working. The others parked until Monday.
**Quota:** weekly 88% at 10:57; stop rule 93% = park as draft, stop.
**Monday:** deploy-b + signed VPS attestation + KNOWN conversions (Deploy); career screens + landscape Pit/menus + #2115 (Web); camera B #2154 after Dom's phone verdict; #2161 CC ladder RV41 → Proof 3 Wed (Combat); slice 3 world move after Proof 3.

## 2026-10-11 11:08 — LIVE BC f822c41aa; Core 1b + 2 live; VPS-first unit runs live (first VPS-gated release)
**Now.** LIVE = BC f822c41aa (my curl 11:07): #2179 encounter-online deleted + C7. Weekly quota 88% at 10:57 (stop rule 93%, reset Mon 00:00). Working lanes: Lead, Deploy, Auditor, Backend (done for today), COO watching; the others parked until Monday.
**Done today (live, my curl):** AW c5be47666 08:36 (#1984 gear_import + mig 202610100018, #2162, #2114, #2160, #2164) · AX e85f1683f 08:50 (Core 1b: #2163 kill path, #2165 bank_move, #2166 bank client, C5) · AY2 494e2775f 10:02 (#2169 router PR 1 + #2175 character-preview camera import fix + html-imports guard; AY 433f48a9a failed rows 18/29 on the stale /src/camera.ts from #2126) · BA2 43a9d43c1 ~10:10 (Core 2 server: #2171 career service + #2172 career rows, mig 202610110019, Auditor POST PASS) · BB c7cc3e3fa 10:53 (#2177 VPS-trusted unit runs) · BC f822c41aa 11:06 (#2179; FIRST release gated on a VPS unit receipt: 535 s, 3421/0, zero HF unit minutes).
**Rulings today.** Rule A: cut the candidate when its PRs are READY, start unit at once, the Auditor reuses that receipt (hash match; head change = re-cut). VPS trust v1 (Auditor): pinned official node tarball, nonce + rc gate on the last RECEIPT line, run dir /root/deploy-runs/<sha>-<nonce>. A release owns the VPS (lane jobs → HF while a release run dir exists; stale cap). Slice 3 folder move WAITS for Proof 3 (Dom 10-10; Strategy's pull-forward withdrawn).
**Next (today):** Deploy rows PR (vps-rows-live receipt, same guards, per-run Chromium + sha, vpsSafeRow at trust time) + release-owns-vps (@2eb2a1049) → Auditor → live; docs-only unit skip PR. **Monday:** career screens + camera B (Dom's phone verdict) + landscape part B + #2115 (Web); deploy-b worktree + signed VPS attestation; KNOWN conversions; #2161 CC ladder RV41 → Proof 3 Wed; slice 3 move after.
**Gotchas.** HF CPU contention when several unit jobs run at once. git archive (1.1 GB) lacks .git → 7 env test failures; use clone --shared. VPS_HOST must carry root@. Partial-scope releases never ran rows 18/29, so a full-matrix release exposed a day-old break.


## 2026-10-10 20:40 — PAUSE until Sunday morning (Dom): LIVE AV 99e3f10bc, all lanes saving
**Dom's order (in chat + via Strategy 20:3x):** all lanes paused until Sunday morning, because the weekly quota is at 83% (reset Mon 00:00). No launches, PRs or new work. Lead relayed it to Deploy, Auditor, World, Web, Combat, Backend (VPS), Characters (VPS), COO and Hooks Dev; each lane replies with its branch head + state-doc commit; Lead sends Strategy ONE summary.
- **LIVE = AV 99e3f10bc** (#2157 rows child timeout 540→600) = trunk (my curl + `git rev-parse` 20:18). Deploy: published 20:17, no hold, clean.
- **In flight (all frozen):** #2154 camera B (World, draft 802472603) · #2159 landscape zone page (Web, draft e9cf45b92) · #1984 Core 1b gear_import (Backend, ready 9e85a2325, CI was running, Auditor PASS conditional on the Postgres writer check) · #2161 CC ladder (Combat, draft 8fd7293fd, **RV41 ruled to it**, trunk RV=40; #1840 is CLOSED and takes the next free number if reopened) · #2162 prelaunched_cpu shape check (Deploy, ded3e62bd) · #2160 deploy state doc.
- **Resume order Sunday (when Dom says):** (1) ledger 1b: #1984 → one kill path → one bank → boundary C5; (2) camera B #2154 alone; (3) landscape #2159 alone; (4) CC ladder #2161 alone (writer reinstall); (5) #2162. Slice 2 career moves to **Monday** after the quota reset. Hooks #124/#125 install Sunday after the first release.
- Batch rule stands: an Auditor PASS on the current head + green required CI rides the next 30-minute batch, no per-PR GO.

Untracked restart handoff. Canonical Lead state = top entry of `docs/state/lead.md` on `origin/lead-catalogue/state-1008`. Memory (same key): `project_handoff_2026-10-10_2010.md`, `project_core_shape_2026-10-10.md`, `feedback_seamless_waiver_2026-10-10.md`.

## Now
- **LIVE = AU a2125a8fd** (Core slice 1a, #2152; my curl 20:05). Writer on a2125a8f, NRestarts 0 (my ssh). Core boundary + K7 = 20/0 on the live sha (my VPS run). Strategy has the count.
- **Dom's priority #1 = CORE** (Engine / Core / Modes; plan accepted by Strategy). Next: slice 1b one ledger (Backend server + Web screens, Sun 10-11; REUSE Backend's #1984 gear_import stack, #1980 merged, #1982 closed; rebase onto src/core first), slice 2 one career + leaderboards (Mon 10-12), slice 3 world sim (World, Thu 10-15, after Proof 3; dormant encounter-online path DELETED per Strategy).
- **Camera B = Dom's pick** ("for now; refine after the 120-games audit"). World #2154 @802472603 draft, data-only (zone1/zone.ts, zone2/zone.ts, zone2.row.json); stills running → READY → Auditor → AW, alone.
- **Landscape (Web)**: #2159 @649ae2e6c draft = zone page; told to add the creature-card state + notch insets, then READY and ship alone. Second PR = Pit + ☰ screens + loot/kill, READY ~23:00, then the Mac WebKit row.
- **Landscape fully responsive** (Dom's screenshot: menu over SKILL, creature card across the screen, joystick over the bars, oversized status text). Web owns it, ahead of the Zone 2 look. Proof = portrait/landscape/iPad stills with menus open + a no-overlap test + a Safari check.
- AV = #2157 (rows child timeout 540→600) has GO (Auditor PASS @d6f4606f1, CI 8/0, my check 20:1x); confirm it live. Deploy owed next: owed .cpu validation, capture-mac→launch.mjs, sharding.
- Core 1b plan SENT to Backend 20:1x (start tonight): (1) #1984 gear_import rebased onto src/core, draft tonight, READY Sun 12:00; (2) one kill path (retire hunt.ts page-memory loot, zone main ~L563–568); (3) one bank/currency (play.ts → server inventory/upgrade/shop ops); (4) boundary row C5. Drafts Sun 13:00, READY 17:00, live Sun ~20:00. Backend: (1) #1984 rebased @9e85a2325 at 20:50 (client half in src/core), Auditor queued, PASS conditional on the real-Postgres writer check (Backend running it). Then (2) one kill path.
- Combat back on the Proof 3 shared crowd-control DR ladder (combat/cc-ladder @7f72446cb).

## Done today (live, my curl)
AI 67a8e429f 17:04 · AJ 71de8b5ea (#2129 cap) 17:23 · AK 4a178b0aa (#2135 controls into engine, Dom's #1) 17:37 · AL 9f0cd9116 (#2134+#2130) 17:50 · AM 007df1489 (#2138) 18:03 · AN e07699d33 (#2133) 18:16 · AO 855646c5a (#2140 camera presets) 18:28 · AQ 7f1e89ba4 (#2123 wolf warm) 18:54 · AR c7463389e (#2146 /tmp sweep) 19:20 · AS f7858e1f5 (#2148 carrying #2136) 19:32 · AT 63cfe5bba (#2151 writer-closure fix) 19:44 · AU a2125a8fd (#2152 Core 1a) 20:04.
VPS disk 31G → 69G free; daily sweep timer installed (next 04:31). Camera look-test preview at /preview/camera/ kept alive by a watcher (/opt/frankendom-shadow/work/keep-camera-preview.sh, stops by itself ~00:05 10-11).

## Open
- Web: #74 knight warm program (SwiftShader only) parked on web/warm-points; 200 ms frame-gap bar (separate item); Zone 2 look proposal after landscape.
- /root/work-backend stays (git dir for work-k7 and work-proof3).
- Auditor LOW for later core slices: a new page entry must be added to C1's PAGE list.

## Gotchas
- zsh: write "${REV}:path"; `$VAR:path` is a modifier.
- `gh pr view --json files` caps at 100 files; use `git diff --name-status trunk...head` for big PRs.
- A required check can come back CANCELLED (not failed) after a draft→ready flip; re-run it (`gh run rerun <id>`) and make the PASS conditional on it.
- Writer reinstall rule: any candidate touching origins/, src/fight/ or src/core/ = writer change (Backend reinstalls + boot check). The closure walker is fixed now (#2151, 136 files) but keep the rule.
- Box-side "writer closure" (Backend's /root/backend-tools) counts type imports too, so it's a superset; the repo walker is the runtime set.
- Lanes restart often: re-send assignments to the NEW session ref (ListAgents) after any clear.
