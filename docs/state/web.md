## Now — web lane, 2026-09-23 ~11:10Z (session close after #540/#552/#556; read this first)

**PRIORITY 1 (Dom via Strategy → Lead, 2026-09-23 evening): Phase R paperdoll re-render, done ONCE.** Phase R (LIVE 2026-09-24
14:00) gives all ten opponents six takeable armour pieces + a weapon, about 40 new loot layers. My part: BEFORE the first Phase R PR
merges, widen the loot-layers frame to fit the widest new piece and re-render ALL current layers in ONE PR against trunk, so each
Phase R PR only adds its own layers. **Owed to Lead by 09:00 2026-09-24:** (a) the frame size picked, (b) render time per layer,
(c) the PR ETA. Relayed premise, NOT yet verified: "the knight.Helmet attempt needed 316→352". `git grep -w 316` over trunk's
scripts/src/tests found nothing, so the frame constant and the render script have to be FOUND first. Start with the loot-layers
render pipeline (Brief 5 export; memory `frankendom_loot_export_brief5.md`, `frankendom_loot_loader_2026-09-21.md`) and
tests/loot-layers.test.ts. Measure the widest piece across the new layers before picking the size; don't just take 352.

**ALSO ON THE LIST (Lead, 13:2xZ): opponent cards + copy as a PR against TRUNK, once roster-v0 has merged there.** roster-v0 is FROZEN at
c2a5c73 and publishing: do NOT push to it. At 13:21Z roster-v0 was not yet on trunk; check with
`git merge-base --is-ancestor origin/roster-v0 origin/codex/01a09a76/task-1`. The change is `public/game/index.html`, the landing page
(`#ladder` "Meet the ladder" `article.foe` cards, the "Five opponents" faces strip ~line 133, the ranks table ~line 159). Add the
Dwarf, Plague Doctor `plaguedoctor`, Shieldmaiden `shieldmaiden`, Knight `knight` and Witch `witch`: names only, with versus stills
(`/game/img/<id>.webp`) where the lanes ship them. Fix the "Five opponents" copy in both places. It's non-sim, so it rides the batch after
#566/#567/#571. Send Lead the PR number plus a 375×812 still. Report to Lead only.

**Then.** Resume Lead's task 2 from #517: the **phone readability and controls pass** on live (`441eb38` at 11:0xZ; check
`https://frankendom.com/release.json` first). One PR for what is the web lane's; route the rest. Measured so far, start screen
only, 375×812, from computed styles (labels are `::after` content; the button text itself is font-size 0):
- `#combat-status` ("Draw your sword. The Nightborn will counterattack.") is **10px**, the smallest text on screen and the one a
  new player needs. Candidate fix: 12px, then re-run `endgame-hud-check` because the top band's geometry moves.
- `#opponent-name` / `YOUR HEALTH` / `#stamina-label` `::after` are 10px.
- Action labels (Draw/Heavy/Step/Guard `::after`) are 11px/600 at opacity 0.9. Heavy/Step/Guard buttons sit at opacity 0.5 until
  the draw, so cream-on-sand reads ~0.45: a taste question for Dom (same family as STEP/GUARD showing through Leave it), not a defect.
Still to do: a real fight, the kill screen and the journal at 375×812.

**Done today (this session).**
- **#540** MERGED (95b954d), live in 441eb38: a retired kill-link version shows the welcome page — "RECORDED UNDER AN OLDER
  VERSION", "The Nightborn fell to a knife." / "…won, against a knife." / "Nobody fell.", fight button. No date, by Lead's ruling:
  the header has none and `created_at` stays server-only (migration 202609220006). Unknown opponent/weapon in a crafted header →
  trunk's one-line "Recorded on an older build".
- **#552** MERGED (0b179b3), live: guest half of #535. `src/profile.ts` `loadProfile` kept loot only when `owned` was non-empty,
  so a guest who had only declined lost the ledger on every load. Now `owned.length || declined?.length`; tests/profile.test.ts pins it.
- **#556** MERGED (a007712), live, release row 34: `scripts/loot-smoke-check.mjs` — guest, 390×844 phone, goblin, QA_URL or vite
  preview; (1) goblin.Knife tile offered, (2) tap takes + Undo restores the ledger deepEqual, (3) a decline survives reload. It
  found #552's defect on live dd1d968/b7bc78d; all three PASS on live 441eb38. Auditer added the row, triggers and a welcome-tap wait.
- #521 (tap-to-take, Undo, gold skin) merged earlier and is live.

**Open.**
- Deliverable 4 (paperdoll ATK/RES) — see the Open list below; check whether `src/gear-stats.ts` and tiered LootIds are on trunk now.
- Hold between `complete` and the loot panel: none until Dom names a value (one predicate must gate both the hush and the offer).
- Auditer's grade-C journal fixes: still behind the phone pass.

**Gotchas (new today).**
- (j) `src/record.ts` is in `tests/record-version-guard.test.ts` SIM_FILES: ANY edit there reads as a sim change. Display helpers
  over the record go in their own module (`src/record-header.ts`). Never bump RECORD_VERSION or re-pin the digest for a non-sim edit.
- (k) `tests/graphics.test.ts` boots main.ts with `runInNewContext` and a hand-written `modules` map: a NEW module main.ts imports
  must be added there, or the page gets `{}` and fails silently (console output from the page is not visible either).
- (l) `tests/child-process-ratchet`: any `execFileSync` in scripts/ needs `timeout:`.
- (m) A local vite preview serves the SPA shell at `/release.json` (200, HTML): parse with a catch.
- (n) The deploy lock blocks `node --test`, `tsc` and eslint too, sometimes even single-file tests. Commit locally and wait.
- (o) There is NO weapon picker on trunk; "offered" means a loot tile gated by `PLAYER_WEAPONS_OFFERED`.

## 2026-09-23 morning — session close after #521


**Now.** Start Lead's task 2 from #517: a **phone readability and controls pass on today's publish** (375×812; live was `52dffed`
at 07:0x, check `https://frankendom.com/release.json` first). Fix what is the web lane's in one PR; route the rest. One known item
to open with: on the kill screen the sleeping STEP and GUARD labels show faintly through Leave it's dark glass. Taps are safe
(hit-tested), so it's a readability question for Dom, not a defect. Nothing of this lane's is half-built.

**Done today.**
- **#521 is #475 re-opened** off trunk `2d614dc` (tap-to-take + Undo + gold skin), head `80710b6`, READY, handed to Lead, full
  release matrix running. It opens on #506's `finisher-complete` latch; no hold constant (Strategy: a beat is Dom's value to name).
  Action row in `#actions`. The four main.ts conflicts were one shape: keep both `hideLoot()` and `pendingLoot = null`.
  #475 carries a pointer comment; closing it is Lead's.
- **Two defects the re-measure found, fixed in #521:** (1) tiles broke mid-word at the apostrophe ("Centurion' / s helmet") at
  56 px. `tileLabel` in src/loot-panel.ts shows the piece only, and the test covers every loot name. (2) The touch that stops the tour
  took a piece: with 9 Centurion pieces (#478) the second tile row covers (190, 300), where the first arena touch lands. Fixed
  by the rule Rematch already follows: tiles and Undo are inert under `:root.endgame-fade`. Receipts on 80710b6: quality:ci 520/518/0/2
  Budget PASS; endgame-hud-check passed:true; quiet-one-browser-check quietOne EXIT 0 on a real win (panel closed 0.03 s after
  the kill, open at complete 3.22 s); preview 375×812 / 1280×800: panel 343×204 / 360×204, 9 tiles 56×74, 2 rows, `scrollWidth` exact.
- **#506's harness fix** (`finishPhase` fake with `complete`/`completeAt`, and "a death never waits on the latch") was found
  here and landed by Finishers in #506 (01ffb0a). My `web/loot-hold` branch was deleted as superseded.
- **Brief 19 deliverable 4 copy is settled** (paperdoll): totals UNSIGNED (`ATK 15 · RES 20`), kill-screen delta SIGNED
  (`+6 ATK`), caption GENERATED from the same two numbers, bare fighter shows `ATK 0 RES 0`. Addendum C (brief lines 115–117):
  "whole points" is the unit rule, not a sign rule.

**Open.**
- Deliverable 4 PR: blocked until #488 (`src/gear-stats.ts`) merges AND a LootId carries a tier. Today every kit resolves naked.
  The preview recipe is in memory. PNGs go in that PR's body.
- Hold between `complete` and the panel: none, until Dom names a value. If one lands, ONE predicate must gate both the hush and
  the offer. A hush that lifts at `complete` while the panel waits frees an inert Rematch that throws the offer away.
- Not ours, reported to Lead: `scripts/quiet-one-browser-check.mjs` line 109 deadlocks when duel 1 doesn't kill. It taps
  Rematch under the fade without line 183's arena-tap-first. Trunk fails the same way. The duel's kill is non-deterministic on
  a local Mac, so this row can go red on any tree when duel 1 misses.
- Auditer's grade-C journal fixes (tab semantics, focus style, dead `dialog{}` block at style.css ~306, backfill entries):
  still open, behind the phone pass.

**Gotchas.**
- (f) A preview that re-implements the shipped function proves nothing. The first #521 re-shoot built tile labels with its own
  copy and still showed the broken text. Import the real function (node strips TS types: `await import('./src/x.ts')`).
- (g) The panel's tiles are in the arena's touch path, and a tile tap is the take. Anything that makes a tile tappable while
  the tour rolls brings back the accidental take. Growing an opponent's piece count moves tiles into new ground: re-hit-test (190, 300).
- (h) Check a relayed rule against the brief's own lines before building. The sign rule was relayed wrong once, and my preview
  and a teammate's approval both inherited it.
- (i) Verify "blocks publish" against what is actually live before saying it. A local red row looked like the reason
  `2d614dc` didn't ship; `52dffed` then shipped through the same row unchanged.
- The one-deployer guard refuses `node --test` and builds while any deploy is in flight. Wait on the lock's pid
  (`~/.claude/state/deploy_in_flight.json`) in a background loop rather than retrying blind.

## 2026-09-22 — Loot panel: a tap is the take, Undo, and the gold skin — item 10 (Dom, with a phone still; lead's decisions)

Dom: "should be auto equipped/taken without the double confirmation... or make it more intuitive... plus the black background should
be the gold button colour, same, and semi transparent." Built on top of the names copy (PR #475, stacked on #464 — index.html keeps
the meters AND #loot-panel on one physical line, so two branches cut from trunk would have conflicted there). The Take button is
gone: a tap on a tile takes the piece, the tile flashes (`li[data-took]`), the tiles and Leave it go, and one line stays in their
place — "The Nightborn's helmet is on you." with Undo beside it — for 4 s, main.ts owning the timer and every reset path clearing it
through `hideLoot()`. Undo restores the ledger the take FOUND rather than a computed inverse: `store` writes provenance into `taken`
and `wear` moves a paperdoll slot, so main.ts keeps the object and puts it back, and the panel reopens with nothing taken. Skin:
`.loot-panel` is the fight cluster's sand at 55 % (`#b7a2768c`) with its blur kept, ink `#1b1916` type, tiles pale glass on gold.
**Two findings the brief did not have.** (1) There was NO 300 ms tap guard to "keep" — nothing in loot-panel.ts, main.ts or the CSS
(the shipped `.loot-panel{pointer-events:none}` is #102's pointer-transparency fix, not a time guard); with one tap now spending the
fight's one take it is half the safety net, so it was built: `TAP_GUARD_MS = 300` on an injected clock. (2) Five tiles really did
wrap to TWO rows at 375 on the shipped build (the estoc alone on the second): the phone HUD column is 270 px and 5 × 56 + gaps does
not fit inside it, so the card breaks out of that column to 343 px rather than shrinking the 56 px targets; seven-piece opponents
still wrap 5 + 2 instead of scrolling out of sight. Also not asked for and flagged: with Take gone, Leave it's full-transparent
ghost let the sleeping Step and Guard read through its label, so it takes the cluster's dark glass. Receipts on a real Nightborn kill
at 375×812 (the duel scripted from quiet-one-browser-check): card `rgba(183,162,118,0.55)` + `blur(6px)`, ink `rgb(27,25,22)`, card
16,183 343×130, 5 tiles ONE row at x 25/85/145/205/265 y 225 all inside the card, Undo 285,226 65×34, panel gone after the line's
4 s, `scrollWidth` 375, no page errors; the ledger measured before (`owned:[goblin.Arms]` + its provenance + a declined record),
after the tap (plus nightborn.Helmet in owned/equipped/taken) and after Undo (byte-identical to before); a tap fired the instant the
panel appeared left the ledger untouched. `npm run quality:ci` EXIT=0 — 509 tests, 507 pass, 0 fail, 2 skipped, Budget PASS;
`endgame-hud-check` passed:true overlaps [] (card ends y 313, fallenRect y 464); `quiet-one-browser-check --opponent goblin`
passed:true. New `tests/loot-panel.test.ts` (3 tests) covers the guard, the tap-take, the inert owned tile, decline, the line +
Undo and hide; `tests/loot-layers.test.ts` pins that `#loot-take` is gone; `scripts/endgame-hud-check.mjs` drops it from its
cluster list. Remaining validation: the lead's merge gate on #475, and #464 must merge first (it has: 16:40:59Z).

**Also next, and MEASURED before building (order via the lead, 2026-09-22 evening; Dom's phone still of live 607126a): "the loot
pickup covers the effect of the finishers".** His screenshot predates #464 and #475, so the first job was to check this lane's own
build rather than the published one. Probe on the #475 tree at 375×812, a real Nightborn kill, sampling every 100 ms of page time
from the kill (artifacts/loot-timing.mjs, the loot receipt's duel plus #debug's `finishPhase` / `fallenRect`):
- **The timing half is real on this build too.** The panel is visible at t = 0 — the Killed event — and `finishPhase().settled`
  does not go true until **t = 4100 ms**. It is up for the WHOLE finisher, 4.1 s of it. Cause is mine: #427 deliberately put
  `#loot-panel` OUTSIDE the `:root.endgame-fade` group so the arena-cam tour could not fade it, and that same exemption is why it
  does not wait for the finisher either. main.ts calls `offerLoot()` straight off the Killed event (~line 845).
- **The geometry half does not describe this build.** At settle the panel measured x 16 y 183 343×130 — the TOP band, bottom edge
  at 39 % of 812 — and the body's rect was x −14 y 353 213×208. They do not intersect (`panelOverlapsBodyAtSettle: false`), which
  is also what `scripts/endgame-hud-check.mjs` asserts and why it passes. So "pops over the middle" is the old panel, not this one.
- **The briefed fix contradicts two things, so it needs the lead before it is built.** (1) "Bottom sheet, at most the bottom 40 %"
  puts the card at y 487–812, which OVERLAPS the measured body rect (y 353–561) by ~74 px — the opposite of the brief's own bar
  that the panel never overlaps the body's framing. (2) The thumb zone is where the first post-kill touch lands, which is gotcha
  (a) and the defect that aborted deploy #102. Moving the tiles there re-creates it unless the panel keeps its
  pointer-transparency and the tour-stop touch is re-thought.
- Cheapest fix consistent with both: keep the card where it is and make it WAIT — show it on the finisher-complete moment plus the
  hold, which is the timing change Dom actually reported. Finishers & Gore are exposing that event; until it lands, their measured
  durations, not a timer of mine (the lead's instruction).
**Ruling (lead, 2026-09-22 evening): build the WAIT, the bottom sheet is withdrawn** — the geometry half of the brief went back to
Strategy with these numbers so it cannot return as an order. The work, when it is unblocked: move the `offerLoot()` call site off
the Killed event and onto finisher-complete plus the hold. Nothing else moves — not the card, the tiles, the guard or Undo — and
`endgame-hud-check` keeps passing because the geometry is untouched, which is itself the evidence that this is the timing fix and
not a redesign wearing one. **Order of operations, and do NOT route it through the lead:** (1) wait for #475 to merge — no third
stacked branch on these files; (2) take the measured per-finisher durations DIRECTLY from Finishers & Gore (Split Crown,
Decapitation, Run Through, Opened, Quiet One, plain — measured in their preview harness from the frame the camera settles and the
body stops), with their real finisher-complete event swapped in afterwards; (3) one PR, receipt = a phone screenshot with the body
and the panel visible together. Do NOT hard-code the 4100 ms measured above: it is one Nightborn kill with whatever finisher that
seed picked, not a table, and a timer of our own is the thing the lead ruled out.

**Next for this lane (routed 2026-09-22 evening by Strategy, NOT started — the lead releases it only after #475 and #464).** Brief 19,
gear stats (Dom approved; PR #486, a new Stats lane). Web owns the PANEL half of its deliverable 4: the paperdoll shows the totals
and the kill-screen take shows the delta of the piece being picked up. **Format settled later the same evening by Dom (Brief 19
Addendum C, via Strategy) and it SUPERSEDES the first routing: TWO stats only, ATK and RES, whole points.** Paperdoll shows totals
UNSIGNED — `ATK 15 · RES 20` at full Origin, `ATK 0 · RES 0` naked. The kill-screen take shows the piece's delta SIGNED, one token,
on its own line — `+6 ATK` for a weapon, `+4 RES` for an armour piece; a take never moves both. The four-stat shape first routed
here (Attack, Defence, Poise, Stamina) and any `+3 DEF +2 POI` form are VOID: no Defence, no Poise, no Stamina on gear. The Stats lane supplies the numbers; this lane owns copy and skin, in the same gold-glass language as the tap-to-take panel
(#475). Nothing to do until the lead routes it. Relayed by a peer session, so confirm the brief with the lead before building —
gotchas (g) and (h).

## 2026-09-22 — The Veteran becomes the Centurion, and "warden" leaves every player-facing string (Dom via Strategy; PR #464, merged 16:40:59Z)

Copy only. `src/roster.ts` `name` field alone — the id `veteran`, the body, rig, archetype, asset filenames and every LootId
(`veteran.helmet`, `veteran.Trident`) untouched, so provenance, loot.glb and the kill-link fixtures do not move; the career RANK
"Veteran" stays, deliberately. "Warden" leaves the player-facing strings and keeps the identifiers: `practiceHint(s, foe =
'Opponent')` fed from a new `bareName()` in roster.ts, so nine coaching lines name whoever is in the arena ("Centurion defeated.
Ready for a rematch?", "Parried! The Goblin is open.", "The Centurion rolled clear."); the HUD bars carry the name for EVERY rung
now — main.ts had `if (opponent.id !== 'veteran')`, which is why the first rung still read "ARENA WARDEN" — with the meters'
aria-labels following ("Centurion health" / "Centurion posture") and "OPPONENT" as the no-opponent fallback; the chip is
"Difficulty: …"; the daily is a duel everywhere including the share title "Frankendom: the daily duel"; the replay banner names the
fallen ("Replay over · the Goblin fell"). GAME_SPEC's design use, code comments, test names and the debug readout's `warden:` (which
quiet-one-browser-check parses) are untouched. **The brief's "regenerate his versus card" was wrong and was NOT done**: the caption
is DOM (`#versus-foe`, set at runtime from the roster), `scripts/versus-cards.mjs` renders only the two fighters and has no
`fillText`, no name and no roster import, so re-rendering would produce a byte-different picture of the same fighters and spend
budget for nothing; measured, `#versus-foe` reads "Centurion". Lead accepted the correction and routed it back to Strategy.
Receipts: phone screenshots of the HUD and the daily card at 390×844, and in the same live DOM "THE CENTURION" / data-mobile
"Centurion" / "Centurion health" / "Centurion posture" / "Daily duel" / "Today's duel" / "Difficulty: normal", with a sweep of every
text node and every aria-label/title/placeholder/data-mobile for /warden/i returning `[]`. quality:ci EXIT=0 — 506 tests, 504 pass,
0 fail, Budget PASS. **`scripts/quiet-one-browser-check.mjs` pinned the chip text `'Warden: easy'` and had to move with the copy**;
re-pinned and re-run (`passed:true`, debug readout showing `ai easy`). See gotcha (f).

## 2026-09-22 — Viewer page: PLAY NOW as a proper primary, the stale-link line out of the header band (lead's brief, the #426/#427 follow-up)

The follow-up owed once #426 was live. Two findings from a static preview of the viewer state (index.html + src/style.css, no sim)
at 390×844 and 1280×800, both evidence rather than taste. (1) PLAY NOW wore the same dark glass as Rematch, so on a page where
every combat control is asleep the only live button read as the deadest one on the screen — at 1280×800 it sat between "Camera
locked" and "Hold to run" in the same fill. `src/hud.ts` now sets `data-play` ('1' while `view.replay || view.stalled`, '0'
otherwise — a VALUE toggle, not `removeAttribute`, which the VM harness's fake element does not have; gotcha (c) below), and
`#reset-button[data-play='1']` takes the kill screen's primary: the Take button's sand `#b7a276`, `#e9d9b3` rim,
`inset 0 0 0 3px #f0e3c93d` ring, ink `#1b1916`, 700/15px tracked. In the thumb cluster it takes the cluster's full 184 px and a
64 px box at top 64 — bottom edge 128, still clear of the Take / Leave it row at top 137. Rematch and "Next: …" are untouched.
(2) The stale-link lines ("This fight cannot be played here", "Recorded on an older build") are the page's own message, not a
status about a fight that is playing, and the replay banner's header slot ran them straight THROUGH the centred Sound on button
at 1280×800 and through the warden's meters at 390×844 — a collision, not a preference. `banner(text, true)` marks the two
stalled sites (src/main.ts, the decode catch and the ran-out-of-record break); `.replay-banner[data-stale='1']` drops to the slot
just above PLAY NOW ("one small line, PLAY NOW under it") in the autopsy's serif instead of the banner's 3 px tracked caps.
"Loading the fight…", "Replay", "Replay over · …" and the daily lines keep the header band exactly as they were. Evidence on the
head: phone PLAY NOW 190,670 184×64 sand `rgb(183,162,118)` on ink `rgb(27,25,22)`, the line 16,626 358×20 Georgia 15px, 24 px
above the button; desktop PLAY NOW 990,613 144×52 in the same sand, the line 460,606 360×20, clear of the header and of the
instructions footer; `scrollWidth` 390 / 1280; with the flags off both measure as before (reset 190,681 176×56 dark glass,
banner y 56 uppercase 3 px tracked). `npm run quality:ci` EXIT=0 — 506 tests, 504 pass, 0 fail, 2 skipped, 0 vulnerabilities,
Budget PASS (dist gz 24,678,687 of 32,000,000); `node scripts/endgame-hud-check.mjs` passed:true, overlaps [], floating []
(the kill screen is unchanged — `data-play` is '0' there). New assertions live inside the existing kill-link tests in
tests/graphics.test.ts: `data-play` '1' on a finished replay and on a refused link, '0' on a plain Rematch; `data-stale` '1' on
both stalled lines, '0' for "Replay over · …" and once PLAY NOW clears the line. Remaining validation: the lead's merge gate
(quality + base + both browser jobs green on the head); no live browser check from this lane. PR #458, which also carries the
handover entry below — #444 was cut before #446's `scripts/release-rows-for.mjs` and was red on the plan job for that alone, so
its entry was folded in here and #444 closed rather than rebased separately (lead's call, 2026-09-22).

## 2026-09-22 — Web lane handover (session close; live a2a901b)

**Now.** Nothing in flight. All web-lane work of 2026-09-22 is merged and live; the branches web/sand-buttons, web/doll-layers, web/loot-panel and web/loot-panel-actions are spent.

**Done today.** #412 site buttons wear the fight cluster's sand (red text untouched) — live 4068c50. #386/#395 Profile trim + account status line — live 0ebf409. #415 paperdoll wears equipped gear, layers generated by `scripts/loot-layers.mjs` — live 9c72c1e. #427 kill-screen Take-one panel replacing the drop line, with the decline record — merged 9f77fe4. #432 Take/Leave it moved to the thumb row after deploy #102 aborted — live a2a901b. Verified on the served page: `#loot-panel` after `#autopsy` in the top band, `#loot-take`/`#loot-decline` inside `#actions`, no `loot-drop`/`loot-choice`, `.loot-panel{pointer-events:none}` in the shipped CSS.

**Open.** (0) Veteran shield, kill-screen line (lead 18:45, Dom GO 18:40) — when a taken shield cannot be used yet, the panel says exactly "stowed until you fight one-handed."; shown while the shield is owned and a two-hander is in hand, gone the moment a one-hand weapon is equipped. Take-one stays strict: the shield is its own item, never bundled with a weapon. BLOCKED until Multi Chars' asset + back stow and Weapons' `grip` field exist; it is last in the order, after (1). (1) Viewer-page polish on the shared-fight screen — PLAY NOW's weight and placement as a proper primary, the stale-link line's style; the lead owns #426 itself, the seam is on trunk; this is the next task. (2) Auditer's grade-C journal fixes: real tab semantics (role=tab/tabpanel, aria-selected, aria-controls) + a visible focus style, one node test parsing index.html for the journal ids, delete the dead `dialog{}` block (~style.css 306-338), backfill entries for #241/#247/#279. (3) Strategy briefs 6 and 10, after beta. (4) Not mine: the loot budget line sits at 1,446,058 of 1,500,000 (#418's weapon draws) — the lead is taking the cap question separately.

**Gotchas, all paid for with a deploy.** (a) A decision button must never sit where the first post-kill touch lands: that touch stops the arena-cam tour, so a button there declines the player's loot by accident — this is why Take/Leave it live in the thumb row and `.loot-panel` is pointer-transparent with `auto` only on its tiles. (b) Anything added to the endgame cluster must also be added to `scripts/endgame-hud-check.mjs`'s cluster list, or #424's gate does not hold it inside `#actions`. (c) A DOM module that touches `document` at import time breaks main.ts's VM harness (tests/graphics.test.ts) — export a factory taking the injected element lookup and register the module in the harness map; the fake element has no `removeAttribute`, so toggle a data value. (d) Rerun `node scripts/loot-layers.mjs` after any loot.glb change or `tests/loot-layers.test.ts` fails; weapon ids are excluded by design. (e) The lead's merge gate is quality + base + both browser jobs green on the PR head — local receipts are evidence, not the gate, and any push (docs included) restarts CI.

Added after the fact, 2026-09-22 evening (they belong with the list above):
(f) A PIN WHOSE MISS IS SILENT IS NOT A PIN (lead, 2026-09-22): `scripts/quiet-one-browser-check.mjs` matched the difficulty chip's
text in a bounded loop — `for (let i = 0; i < 3 && (await ...textContent()) !== 'Warden: easy'; i++)` — so when the copy changed the
loop simply gave up and the gate fought on at `normal`, still reporting passed:true. It turns a gate into a passenger. When copy a
gate matches on changes, re-pin AND re-run it; when writing one, make the miss fail. Audit after it (2026-09-22): of the 33 release
rows / 20 distinct scripts, that was the only retries-then-continues in a gate. Two near-misses that are NOT gates —
`scripts/impact-preview.mjs`'s bounded sim loops (`i < 900 && !s.events.some(...)`) are preview generation and are not in
release_commands; `scripts/audio-preview.mjs`'s `baseline ... .catch(() => null)` only drops the delta COLUMNS from its report, while
its `--check` assertions are real `assert.ok` throws.
(g) A CAUTION THAT NAMES A MECHANISM IS A CLAIM; CHECK IT BEFORE YOU BUILD AROUND IT (lead, 2026-09-22, after item 10). The brief
said "keep the existing guard that ignores taps in the first ~300 ms"; there was no such guard — `.loot-panel{pointer-events:none}`
is deploy #102's pointer-transparency fix, not a time guard. The same night, "regenerate his versus card" named a caption that is
DOM, not pixels, and "five tiles must fit one row at 375" named a constraint that the shipped build was already breaking. Each was
one cheap command away: grep the generator, grep for the guard, measure the live DOM. Run that command before writing code, then
put the correction in the PR body AND the reply — building to a wrong premise spends a deploy-gated cycle, and quietly dropping
part of a brief reads as scope-cutting.
(h) A MERGED BASE DOES NOT SELF-HEAL (lead, 2026-09-22, after #475). A PR stacked on another branch keeps pointing at that branch
after it merges: `gh pr view <n> --json baseRefName` still read `copy/centurion-and-duel` long after it landed at 16:40:59Z, while
`mergeable` read MERGEABLE the whole time — `mergeable` says nothing about WHERE the merge lands, and this is the shape that put
#358 into a lead branch instead of trunk and cost #371 to re-land. Retarget with `gh pr edit <n> --base codex/01a09a76/task-1`,
then prove no rebase is owed: the old base's head must be an ancestor of trunk (`git branch -r --contains <sha>`) and the three-dot
diff against trunk must show only your own files. Better still: do not stack twice — #475 was stacked only because index.html keeps
the meters and #loot-panel on ONE physical line.
(i) AN EXEMPTION GRANTED FOR ONE REASON SILENTLY BUYS A SECOND BEHAVIOUR NOBODY CHOSE (lead, 2026-09-22, after the finisher-cover
order). #427 put `#loot-panel` OUTSIDE the `:root.endgame-fade` group for one stated reason — so the arena-cam tour could not fade
it away mid-decision. The group is also what holds the endgame text back until `finishPhase().settled`, so the same exemption
bought "does not wait for the finisher" for free, and `main.ts` calling `offerLoot()` straight off the Killed event made it
visible at t = 0. Measured on the #475 tree: the panel is up for the WHOLE 4.1 s of the finisher (settled at t = 4100 ms). Nobody
chose that; it came in the back of a choice about fading. The sharper statement (lead's, after reading the detail back): AN EXEMPTION REMOVES EVERYTHING THAT
MECHANISM WAS DOING, NOT ONLY THE THING YOU MEANT TO EXEMPT. It did not merely fail to consider timing; it removed a timing
behaviour that was riding on the same mechanism. So when exempting an element from a group, write down every behaviour the group
was carrying for it, not just the one being escaped — and re-derive the others deliberately.
(a, amended) Take is gone since item 10 — a tap on a tile is the take — so the thumb row holds Leave it alone. The rule
that produced it is unchanged and still load-bearing: no decision button where the first post-kill touch lands, and
`.loot-panel` stays pointer-transparent with `auto` only on its tiles and its Undo pill.

## 2026-09-22 — Take / Leave it move to the thumb row (deploy #102 abort; my defect)

Deploy #102 of 9f77fe4 aborted: quality-gate rows 16/21/26 (quiet one) failed deterministically with `locator('canvas').tap({x:190,y:300})` → TimeoutError, "`<button id="loot-decline">Leave it</button>` from `<section class="combat-hud">` subtree intercepts pointer events". Root cause is mine, not the check's: I put the panel's action row in the TOP band, which breaks Strategy's #380 layout rule (text up top, buttons in the bottom row) — and since #387 the first touch after a kill is how a player stops the arena-cam tour, so a decision button under that thumb declines the loot by accident. Fix (web/loot-panel-actions): `#loot-panel-actions` moves into `#actions` beside Rematch (cluster rule `left:0; top:137px; width:176px`, where the old Wear/Store row sat); `.loot-panel` card gets `pointer-events: none` with `auto` only on its tiles, so an arena touch anywhere on the card passes to the canvas; loot-panel.ts shows/hides the row with the panel. Evidence: `elementFromPoint` at 190,300 / 195,200 / 100,420 → `scene` (the canvas), 190,640 → `actions`; `canvas.tap({190,300})` succeeds; take still writes "The Veteran's greaves is on you."; the row measures 190,753 176×40, inside the #actions box. endgame-hud-check now picks loot-take/loot-decline into its cluster list: passed:true, overlaps [], floating []. quality:ci 494 tests / 492 pass / 0 fail, Budget PASS. Lesson: a top-band element that takes pointers sits in the arena's touch path — the layout rule is load-bearing, not cosmetic.

## 2026-09-22 — Kill screen: a Take-one panel replaces the drop line (Strategy brief; lead's rules)

Owner 14:05 via Strategy, on a Nightborn kill: the loot prompt "appeared for about 2 seconds then disappeared... we need a better selector/visual menu for what gear we can take off fallen opponents." Root cause: `#loot-drop` and `#loot-choice` were in the `:root.endgame-fade` group, so the arena-cam tour (from ~5 s after settle) faded them, and every reset path cleared them. `src/loot-panel.ts`: `createLootPanel(element, document)` → show / confirm / hide / wire, built by main.ts with its own element lookup (bare module-level `document` broke tests/graphics.test.ts's VM boot — the lead's standing lesson; the harness registers `'./loot-panel.ts'` in its module map, and the fake element has no `removeAttribute`, so hide sets `data-on='0'`). `#loot-panel` sits in `.combat-hud` under `#autopsy` (grid-row 10 on phone), never over the fallen body (#380), outside the fade group: it goes only on take, decline, Rematch or Next. Rules in main.ts per the lead: offered = `LOOT[opponent]` minus owned (weapons included), one take per win (`lastDrop` guards), take = `store` with provenance + `wear` through the existing path, decline = `decline()` + persist + hide. Decline shape (lead-approved): `Loot.declined?: Provenance[]`, `DECLINED_KEPT = 50`, validated by `cleanProvenance`, key dropped when empty. Thumbnails: `scripts/loot-layers.mjs` also writes `<id>.thumb.webp` per armour piece (21 files, 84 KB); a weapon tile is its name until its equip file renders. Old drop line, Wear/Store row and their CSS removed (one loot UI); `scripts/endgame-hud-check.mjs` keeps #424's deterministic gate and measures `loot-panel` in the top band, cluster = reset + share. Tests: `tests/loot-layers.test.ts` pins the panel ids and order, the absence of the old ids, a thumbnail per armour id, and the decline record. PR #427, rebased twice (#424's gate file, then #426's index.html). Receipts on 35a79c4: endgame-hud-check passed:true overlaps [] floating []; quality:ci 493 tests / 491 pass / 0 fail, Budget PASS. Follow-up owed once #426 is live: viewer-page polish (PLAY NOW's weight and placement, the stale-link line's style) — the lead owns #426 itself.

## 2026-09-22 — Paperdoll shows the worn gear (owner 12:4x; lead: route A, per-piece layers)

Owner: "the player image should dynamically update with the gear... the helmet, it should show it wearing it? also the arms?" Lead (12:44): pre-rendered overlay layers, CSS-toggled, built by a script over the loot file, not hand-made; Strategy prefers a live rig render (route B) for loot v2 and accepts this as the per-piece interim. `scripts/loot-layers.mjs`: renders the player rig (warrior.glb, Idle, front) once bare and once per loot id in loot.glb with the body as a depth-only occluder, worn the way characters.ts wears it (replace hides the slot + Hair, palette materials swapped by name), crops all to one union frame (272×720), writes `public/game/img/fighter.webp` + `public/game/img/loot/<id>.webp` (13 layers, 1.2–7.4 KB each, 51 KB total), sets the img's width/height and rewrites the `loot-layers` block in style.css (one `.doll:has(#slot-<key>[data-loot='<id>']) .doll-layer[data-layer=<key>]` rule per id). Markup: `.doll-figure` is now a wrapper (img + six `i.doll-layer`, body→legs→feet→arms→hands→head); a live render replaces that element when route B lands. One loader line (main.ts renderLoot): `#slot-<key>` gets `data-loot=<id>` (the CSS needs the id, not just `.on`). Test `tests/loot-layers.test.ts`: every LOOT id has a layer file + rule; the figure carries one layer per wearable key. Receipts: quality:ci 482 tests / 480 pass / 0 fail, Budget PASS (dist gz 24,018,815 of 32,000,000); previews `scratchpad/previews/out/doll-{bare,helmet-arms,nightborn,goblin}.html`. Rerun the script after every loot.glb change (Multi Chars' armour draws, Weapons' trident — weapons need a Main/Off-hand layer key, not in PAPERDOLL yet).

## 2026-09-22 — Site buttons wear the game's sand (owner, phone screenshots 12:32)

Owner: "keep the golden colour as game buttons... elevated while classic gladiator; the text where it is red can stay for now." Every red-FILLED control on the site now wears the fight cluster's sand: journal tokens `--js #b7a276` / `--jsh #d9c69a` pressed / `--jse #e9d9b3` rim; `dialog .daily-go` (Today's warden), `.rack li[data-worn] button` (Worn), `.rack li small a:hover` (Watch), and the /game page's `.pill.red` (Play now ×3, ink text, rim + inset ring like the cluster). Red text (rank, worn-piece border, Watch outline, eyebrows on /game) untouched. Receipts: quality:ci 478 tests / 476 pass / 0 fail, budget PASS; previews `scratchpad/previews/out/sand-options.html`, `sand-game.html`, `loot-journal.html`. Open (owner 12:4x, routed to lead + Strategy): the Profile figure should show equipped pieces (helmet, arms) — owner of the rendered figure/loot attach is to be confirmed.

# Web design — project state

Entries moved verbatim from the root PROJECT_STATE.md on 2026-09-21 (state split). Append new entries at the TOP. Keep evidence and remaining validation in every entry (AGENTS.md).

## Brief 9 — provenance under the inventory — web/design lane, 2026-09-21 (CSS only, on top of #335)
Data lands with #330 (`profile.loot.taken[id] = { opponent, attempt, healthLeft, recordId|null, day }`). The line is far too
long for a 63 px inventory tile, so it reads beneath the grid, one caption at a time: the first worn piece's by default (a second worn caption stays hidden), any tile's
while it is hovered or focused (a tap focuses it: the li carries `tabindex="0"`; `:has()` hides the worn one meanwhile). Row
shape for the builder: `<li data-loot data-worn tabindex="0"><span>name</span><small data-taken><b>Name</b> · your 5th
attempt, 12 health left <a data-watch href="/?r=…">Watch</a></small><button data-wear>…</button></li>`, the link only when
`recordId` is set (guest wins have none). The tile's number moves into flow (was absolute) so the caption can anchor to the
grid; the grid reserves 44 px beneath for two caption lines. Evidence: static preview at 375×812 — caption 339×36 under the
grid, Watch pill 51×20, focusing tile 2 swaps the caption (worn → none, focused → block), `scrollWidth` 375. Remaining: the
lead builds the rows; ordinal wording ("5th") is the lead's helper.

## Brief 5 — silhouette paperdoll, 1–5 inventory, and the Wear / Store choice — web/design lane, 2026-09-21 (markup + CSS only)
On the lead's `lead/loot-data` (#330). Owner direction (screenshots of Ultima/EverQuest-style sheets): a player-figure silhouette
with the slots around it, minimal and gritty, fewer slots, a 1–5 inventory. Profile tab: `.doll` is a three-column grid — the
figure (`public/game/img/doll.webp`, 3 KB flat silhouette of the player model rendered front-on from the portrait rig, Idle clip)
in the middle column spanning four rows; Head / Chest / Arms / Main hand down the left, Hands / Legs / Feet / Off hand down the
right. Each `.slot[data-slot]` has an `<i>` for the piece and a hidden `.slot-off[data-unwear]` Store button; `.on` marks a worn
slot. Under it `#loot-rack` is a five-tile numbered inventory grid (`li[data-loot][data-worn]` with `<span>name</span><button
data-wear>`; the builder pads to five with `li.rack-empty`). The six-locker row is gone. Win screen: `#loot-drop` loses the
`autopsy` class (fixed above the autopsy in the house bold sans) and gains a sibling `#loot-choice` row, Wear + Store (Store
pressed, already done — nothing is lost); Leave dropped as a third verb that does what Store does. The row follows
`#loot-drop[hidden]` in CSS, so `showLootDrop()` needs no change. Buttons inside `#actions` need the id selector plus !important
padding/min-height to escape the thumb-cluster pads. Evidence: static previews at 375×812 — doll 339×272, figure 94×250, side
slots 112 wide, inventory tiles 63×92, `scrollWidth` 375; choice row 148×40 at y 432 above the drop (y 480) and the autopsy
(y 514, with #328's CSS). Remaining: the lead wires `wearLoot`/`unwearLoot` and pads the inventory to five; the share/versus card
view of the doll is brief 3's renderer, not in this PR.

## Profile tab trim — owner direction from phone screenshots, 2026-09-22 (markup + CSS + one image)
Dom: "remove stats for now", "remove the inventory line for now also, as we will change the game features a bit, so you can
replace 1 item at a time only", "the black silhouette — put our real character there". Done: the Stats grid, its note and
its CSS are gone; the Inventory heading and note are gone and `#loot-rack` stays in the DOM with `hidden` (the loader still
writes its rows — src/main.ts — and tests/graphics.test.ts reads them), so the provenance captions inside it are hidden
with it; the figure is now a lit front-on render of the player model (`public/game/img/fighter.webp`, 271×720, 21 KB, from
the design scratchpad's portrait rig, Idle clip, az 0) at full opacity, max-height 320. Evidence: static preview at 390×844
— figure 120×320, doll 354×390, the whole tab fits one screen, `scrollWidth` 390. Routed to the lead, not done here: the
signed-in status line "Saved to your account as <name>." (src/account.ts:36/74) — Dom wants it gone as repetitive, but
scripts/account-browser-check.mjs waits on that exact text four times, so copy and gate move together; and the one-piece-
at-a-time loot rule that makes the hidden rack redundant.

## Brief 8 — three first-fight cues — web/design lane, 2026-09-21 (markup + CSS; the lead wires the triggers)
Copy approved by the lead: "Block it." (the warden's first telegraphed cut, before contact), "Other side." (the first block on
the wrong side that lets a hit land), "Now." (the first time the warden is open after a parry or a whiffed heavy). Each once,
on a new fighter's first fight only, never two at once, no tooltip. Element `<p id="cue" class="cue" role="status" hidden>`
in the footer actions; the lead sets textContent, hidden and data-on="1" (the fade needs the attribute: [hidden] is display:none !important) and keeps the seen list in localStorage `frankendom.cues` (comma
list of block,side,now). Placement: the drop line's slot above the thumb cluster, 22 px bold sans (20 px on phones) in cream
with the text shadow; fade in 120 ms / hold 1.4 s (lead's timer) / fade out 300 ms, keyed on data-on; reduced motion drops
the fades. Evidence: static preview at 375×812 with the cue shown. Remaining: the lead's three triggers from the fight log
after the loader lands.

## Field Journal tabs — web/design lane draft, 2026-09-20 (owner direction; markup + CSS only)
Owner's read of the live journal: still messy. New layout (approved from a clickable mock): the fighter card and the sign-in
prompt stay pinned; under them a browser-style strip with three tabs — Fighter (record table), Arena (opponent, warden,
hit-stop, blood until the lead removes it) and Settings (controls chips, "How to fight", then the quiet Test tools). The
duplicate cloud-save sentence under the Google button is gone. Tabs are CSS radio inputs: every bound id is unchanged and
unique, no `main.ts` change. The journal opens on Fighter, so a browser check that reaches `#opponent-select`,
`#finisher-select` (or `#controls-mode`, retired 2026-09-20) must click that tab's label first — the lead wires that into the gate scripts with
the queued blood/hit-stop changes. The record table is restyled in the light journal's ink (its first rules were for the dark
sheet). Gate: node tests 333/333, build, audit, budget PASS. Not pushed until the lead calls the window (#218 ahead in the queue).

## /game marketing page + Field Journal redesign — web/design lane, 2026-09-20 (owner picked direction E of nine)
`public/game/` is a static, one-page mobile-first site at frankendom.com/game (Vite copies `public/` verbatim; nginx `try_files $uri/`
serves the folder index). Direction "Pocket Arena": light ground, the live game inside a phone frame, bento tiles, Bricolage Grotesque +
Instrument Sans (SIL OFL, `public/game/fonts/LICENSES.txt`). Images are the shipped GLBs rendered offline (transparent WebP portraits)
plus two HUD-less captures of the live arena; total folder 644 KB, no inline script (site CSP is `script-src 'self'`; `game.js` is the
only script). frankendom.com itself is untouched: the game still loads on `/`.
The Field Journal (`<dialog id="journal">`) is restyled in the same brand as a light bottom sheet: fighter card (name · rank pips · save
state, mirrored from `persist()` into `#journal-name/-sigil/-rank/-save`), account, Controls chips + "How to fight" folded, record ledger,
Arena (opponent, warden, blood), Test tools (finisher, hit-stop, tempo, debug). Every bound element id, aria label and button text is
unchanged, and everything the browser gates tap stays visible when the journal opens; the milestones copy and the retired ESO/Black Desert
reference links are gone (`/game/` is linked instead). Evidence and remaining validation: see the PR.
