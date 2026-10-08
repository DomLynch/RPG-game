# Legacy-link inventory (Auditor, 2026-10-08, trunk 5949e880 live)

Lead's row, from Strategy. The rule: feature-on flags go (on by default now), kill switches stay and are renamed `?off=<feature>`, preview paths are internal test builds only (never linked or sent to Dom), and dead entry pages redirect to the main game. Removals are World/Web small PRs with tests and redirects, in folds after Zone 1 is the main path. **Nothing has been deleted.** The VPS listing was read-only (ssh `ls`/`find`/`du`, curl status codes).

"Needed" is my reading of the code against the rule; "Strategy" means a product call (turn the feature ON or delete the flag together with its code). Flag read sites are on trunk `origin/codex/01a09a76/task-1`.

## 1. Paths served on the VPS (`/var/www/frankendom/current` → releases/5949e880)

| Path | What it is | Live | Needed | Owner | Action |
|---|---|---|---|---|---|
| `/` | The game (`index.html`); `?duel` rewrites og:title | 200 | yes | Web | keep |
| `/s/<id>` | Short kill link → `index.html`, og image from `?l` | — | yes | Backend | keep |
| `/game/` | Static "Frankendom: Origins" page (`public/game/index.html`, legends.js/game.js) | 200 | **Strategy** (is it the landing page or old?) | Web | keep, or redirect to `/` |
| `/privacy.html` | Privacy page | 200 | yes | Web | keep |
| `/preview/origins/` | Zone 1 preview build (188 files, 68 MB, 10-08) | 200 | yes, until Zone 1 has its real path (#1862/#1861) | World | internal only; then move |
| `/preview/seamless/` | Seamless-fight preview build (187 files, 70 MB, 10-08) | 200 | no, once #1857/#1858 are live | World | delete after the fold |
| `/preview/fatigue/` | Full game copy for `?look=fatigue-preview` (836 files, **576 MB**, 10-07) | 200 | no, once #1617's decision lands | Web | delete |
| `/preview/tutorial/` | Full game copy for the tutorial preview (841 files, **576 MB**, 10-06) | 200 | Strategy (is `?tutorial=1` approved?) | Web | delete, or keep internal |
| `/arena/ /beasts/ /gear-ui/ /herolook/ /legends/ /licenses/ /looks/ /pit/ /shields/ /versus/ /weapons/ /world/` | Asset folders (no index; 403 on the folder) | 403 | yes (assets) | — | keep; `/arena/` gains an index with #1861 |
| `character-preview.html family-turntable.html guard-preview.html loot-preview.html mob-lineup.html` | Dev-only vite pages in the repo root | 404 live | dev only | Characters / World | no action (never deployed) |

The `/preview/*` folders sit **inside each release directory** (current → releases/<sha>/preview). `scripts/deploy.sh:132` `carry_previews` hard-links them forward (`cp -al current/preview`), so the 1.3 GB of fatigue + tutorial is stored once on disk, not once per release. A delete is `rm` of the folder in `current/preview`; the next release then stops carrying it. That is Deploy's command, with Lead's GO.

## 2. Query flags: feature-on (the rule says these go; Strategy picks ON or delete)

| Flag | Read at | What it does | Owner |
|---|---|---|---|
| `?tutorial=1` | src/main.ts:1286 | Tutorial start scene "until Dom approves" | Web |
| `?telegraph` | src/boss-telegraph.ts:7 | Ground ring under a rank 8–10 boss's windup | Combat |
| `?shields=on` | src/shields.ts:10 | Redundant: every shield already ships (SHIPPING_SHIELDS = all) | Characters (**delete**) |
| `?look=souls` / `shade` (+ `?bloom`) | src/look-flag.ts:4,7 | Souls-style post / shade look | World |
| `?look=kick52` | src/main.ts:77 | 52 px KICK button | Web |
| `?look=kickclose` | src/kick-close.ts:5 | KICK light off while the foe opens the gap | Combat |
| `?look=marks` | src/miasma-mark.ts:8 | Poison mark from miasma | Combat |
| `?look=headline` | src/victory-headline.ts:7 | One earned headline on a win | Web |
| `?look=defence` | src/defence-grade.ts:15 | Four defence results read differently | Combat |
| `?look=fatigue-preview` (+ `?stamina`) | src/fatigue-preview.ts:10 | Red stamina pulse + breathing | Web |
| `?look=fatigue-read` | src/fatigue-read.ts:10 | Tired pose readable from behind | Characters |
| `?look=stances` (+ `?stance`) | src/stance-pose.ts:9–10 | Stance body poses | Combat |
| `?look=powerwords` | src/power-words.ts:17 | Whispered chant sound | Combat |
| `?look=creatures` | src/audio/creature.ts:17; origins/preview/main.ts:452 | Creature growls | World |
| `?region=1` | origins/preview/main.ts:70 | Builds the Ash Frontier | World (**#1862 turns it on by default**; `?region=0` becomes the kill switch) |
| `?online=1` | origins/preview/encounter-online.ts:10 | Creature fights on the server seed (paid) | Backend (needs its own default-on change + Auditor PRE before Zone 1 is the default) |
| `?wolf` | origins/preview/mobs.ts:62 | Adds the Ash Wolf | World (**#1859 makes it a no-op**; then delete) |
| `?camps` | origins/preview/main.ts:79 | Demo camps on the Frontier | World |
| `?look=cinder` / `duel` / `zones` / `zone1` / `night` | origins/preview/main.ts:75,76,219–221 | Frontier look tests | World |

## 3. Query flags: kill switches (stay; rename to `?off=<feature>`)

| Flag today | Read at | Turns off | Proposed | Owner |
|---|---|---|---|---|
| `?stances=off` | src/stance-panel.ts:9 | Stances | `?off=stances` | Combat |
| `?coach=off` | src/coach-ui.ts:9 | Coach | `?off=coach` | Web |
| `?standoff=0/off` | src/standoff.ts:10 | Opening standoff | `?off=standoff` | Combat |
| `?feel=off` (also high/low) | src/armfeel.ts:14 | Hit feel | `?off=feel` (high/low are tuning: Strategy) | Combat |
| `?look=schools-off` | src/spell-school.ts:18 | Spell-school colours | `?off=schools` | Combat |
| `?look=pit-cell` / `pit-old` | src/look-flag.ts:33–35 | Open cage → old Pit looks | delete once #1835 removes the Pit room | World |
| `?guards=N` | src/lorarii.ts:113 | Caps arena guards (slow phones) | `?off=guards`, or keep as a cap | World |
| `?worldfight=0/off` | origins/preview/main.ts:499 | World fights → Pit fight | `?off=worldfight` | World |
| `?presence=0` | origins/preview/presence-client.ts:13 | Seeing other players | `?off=presence` | Backend |
| `?lookbake=off` | src/scene.ts:325 | Waist-cut bake (fallback test) | `?off=lookbake` | Characters |
| `?look=armfeel` | src/armfeel.ts:11 | Legacy alias; does nothing now | delete | Combat |

## 4. Query flags: stay as they are (links players use, or the sign-in flow)

`?duel` (src/main.ts:1299 + nginx), `?opponent` (main.ts:438), `?replay` (src/replay.ts:55), `?r=<id>` (src/share-store.ts:18; **kept until 2026-10-22, then delete**: Backend), `?l` (nginx og image), `?fight=1` (written by main.ts and never read: it only keeps the first loss from repeating), `?account`, `?code`, `?sb_flow_id`, `?error` (sign-in return, src/account.ts:144–147). Server-side API params (`ticks`, `token`, `friend`, `account` in origins/presence/server.ts and origins/server/location.ts) are not page flags.

## 5. Query flags: debug/dev (internal tools; stay, never linked)

`?spar` `?weapon` `?difficulty` `?skill` (src/sparring.ts:29–30, admin sparring), `?special` `?yourSpecial` `?finisher` (specials and sparring), `?arena`, `?lesson=1`, `?tier`, `?dpr`, `?gfx`, `?debug`, `?botSeed` (localhost + debug), `?perf`, `?pacestill`, `?ranklook`, `?hero`, `?shapes`, `?signature`, `?pose` `?skulls` `?lift` `?look=pit*` `?look=pit-glow` `?look=foe` (Pit/camera stills; the Pit ones go with #1835), `?look=schools`/`schools3` (comparison), `?writer` `?foebar` (localhost only).

## Not checked
- The full text of `index.html` and `public/game/game.js` (grep only).
- Whether any external page (social posts, Dom's messages) still links a `/preview/` path.
