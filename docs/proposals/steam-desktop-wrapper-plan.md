# Steam desktop wrapper: plan (Windows Playtest first)

Backend lane, 2026-10-21 night, for review before 12:00 on 10-22. **Docs only: no code, no installs, no accounts.** Ruling (Lead 10-21): Windows first, Mac after the Playtest is up; plan as if there is no Steamworks account or app id yet.

## Recommendation (one line)
**Electron + steamworks.js, Steam channel stamped at build time, copied (MIT, with attribution) from the donor `levy-street-world-of-claudecraft`, which already ships exactly this shape.** Steam delivers the updates (SteamPipe); no in-app updater. Playtest build within two weeks is realistic because the donor gives us the packaging, the channel stamp, the Steam facade and the tests.

## 1. Reuse-first findings
| Source | What it is | Use |
|---|---|---|
| `/mnt/frankendom-donors/levy-street-world-of-claudecraft` (MIT, Levy Street 2026) | A browser MMO with an Electron shell and three channels: website, **steam**, epic. `electron/steam.cjs` (lazy `require('steamworks.js')` only on the Steam channel, app id passed to `init()` so no `steam_appid.txt` ships), `electron/steam_overlay_guard.cjs`, `scripts/electron-builder-config.mjs` (steam: `publish: null`, targets `dir`, so SteamPipe uploads the loose `win-unpacked` layout), `docs/desktop-release.md`, `docs/desktop-ship-notes.md`, `tests/electron_steam.test.ts`, `tests/electron_builder_config.test.ts`. Uses `steamworks.js ^0.4.0`, `electron ^43.5`, `electron-builder ^26`. | **Take the structure and the Steam facade; write our own main/preload.** Copy-with-attribution is allowed by the MIT licence; `public/licenses/world-of-claudecraft.txt` already carries its notice (an earlier lane took from this donor), so no new licence file is needed; the `reuse-first` skill's copy-vs-clean-room rule applies. We do not take its game code, its Discord/Epic/wallet parts or its GPU-preference code. |
| `docs/briefs/origins/origins-blueprint-2026-10-06.md` §11 (ours) | Already rules: Electron is a wrapper around the same production web build, sandboxed renderer, Node integration off, constrained IPC, signed builds, **OAuth in the system browser with a short-lived handoff, never an embedded login webview**, Steam identity linking optional and must not create a second inventory authority. | The plan below follows it as written. |
| `opentrident-steam` (OpenTrident lane) | A private asset-extraction sandbox that uses `steamcmd` to fetch games. No Steamworks SDK or wrapper work, and its README says never copy it into this repo. | Nothing to reuse. |
| Prior PRs / branches in RPG-game | A search of trunk's docs, scripts and package.json and of PR titles/bodies found only #3556 (SCOPE: "Steam track from 10-22") and the blueprint mentioning Steam. No wrapper code exists. | Greenfield here. |

## 2. Wrapper comparison
| | Electron + steamworks.js | Tauri + Rust binding (`steamworks-rs`) | Electron + greenworks |
|---|---|---|---|
| Maintenance | steamworks.js MIT; latest npm **0.4.0, 2024-08-06** (14 months old; 52 open issues, 14 open PRs on GitHub), but the donor ships it on Electron 43 in 2026. Risk: slow upstream; mitigation: pin it, we can fork (MIT, Rust napi). | I did not check `steamworks-rs`'s state; the shell is the blocker, not the binding (below). | **npm latest 0.1.0 from 2016**; repo "best effort, active development is not a priority"; bundles Steamworks SDK 1.62 (old). **Reject.** |
| Steam overlay | Works in Electron with a known recipe: it needs the GPU work in the main process (`--in-process-gpu`; reported also needing `--disable-direct-composition` or the overlay renders white) or the targeted `--disable-gpu-sandbox` the donor measured on Steam Deck. `steamworks.js` provides `electronEnableSteamOverlay()`. **To be proven on a Windows box with a real appid in the spike.** | **Does not work**: WebView2 renders in a separate process/child window that Steam's overlay cannot hook (WebView2Feedback #4019; no fix found, no Tauri-specific workaround). | Same Electron flag recipe; no recent evidence. |
| Auth tickets / achievements / cloud / Steam Input / rich presence | `auth.getSessionTicketWithSteamId`, `getAuthTicketForWebApi(identity)`, `achievement`, `cloud`, `input`, `localplayer.setRichPresence`, `overlay.*`, `callback` (from its `client.d.ts`). | Full SDK via Rust. | Partial, older. |
| Same web build / WebGL | Chromium: identical to our dev browsers; one WebGL path. | System WebView2 (Edge Chromium) on Windows; versions vary with the OS; we cannot pin it. | As Electron. |
| Size | Electron adds roughly 250-300 MB unpacked on Windows (general figure, **confirm in the spike**). Our game: **674 MB** of release files excluding `preview/` (looks 460 M, assets 136 M, weapons 32 M, world 22 M; the live tree is 3.5 GB mostly `preview/`, never shipped). Steam delta-patches depots, so updates are small. | Smaller shell (~10 MB) but the overlay blocker is decisive. | As Electron. |
**Decision: Electron + steamworks.js.** Tauri loses on the overlay (a Steam player expects Shift+Tab, friends and invites) and on WebView2 version drift; greenworks is abandoned.

## 3. Design (Windows Playtest)
- **What ships:** the exact production web build of a release sha (`dist`, no `preview/`), loaded by the Electron main process from the packaged app (not a remote page), with the baked API origin. Renderer: `contextIsolation: true`, `nodeIntegration: false`, sandboxed; a narrow preload bridge (`steam.available`, `steam.getLinkTicket`, later `steam.unlockAchievement`). steamworks.js lives in the **main** process only (the donor README's `nodeIntegration: true` route is rejected).
- **Version pinning (open decision for Lead):** the server refuses a stale client by rules/sim version, so a bundled build goes stale at the next RV bump and needs a new Steam build. Proposed: the shell shows "update available via Steam" when the live `release.json` rules version differs, and CI cuts a Steam build per RV-bump release (not per release). Alternative (not recommended): load `https://frankendom.com/game` remotely, which puts remote content next to the Steam bridge.
- **Login:** Playtest ships with the **existing Google sign-in opened in the system browser**, handing a short-lived code back over a `frankendom://` deep link (donor pattern; blueprint rule). **No Steam login in the Playtest.** Phase 2 (after the Playtest): link a Steam identity optionally: the shell mints `getAuthTicketForWebApi('frankendom-link')`, our backend verifies it with Steam's `ISteamUserAuth/AuthenticateUserTicket` using a publisher Web API key (a server secret that only Dom can create; never in the repo), and writes a `steam_id <-> account` link row. Linked identity never owns inventory; the account does. A migration for that table is mine (apply-ready, applied only at a release); no account work is needed for the Playtest.
- **Save path:** the game is server-authoritative; the client keeps only a cache and settings in the Chromium profile at `%APPDATA%\Frankendom\` (Electron `userData`). **No Steam Cloud for the Playtest** (nothing there to roam). Revisit with achievements/cloud only if the cache grows to matter.
- **Updates:** **Steam only.** The in-app updater is off in the Steam channel (donor pattern: `publish: null`, no updater module loaded). A new build is a new SteamPipe upload to the playtest branch; the Steam client delta-patches. No auto-update code to write.
- **Signing:** the donor signs Windows builds through Azure Trusted Signing or a Key Vault certificate (credentials only from the build env). Whether the Playtest needs a signed `.exe` is to be confirmed with Steam's build review; no certificate is bought until then (a spend, so Dom's call).

## 4. What a Playtest needs (items marked **DOM** are Dom's own acts; I never create or sign in to accounts)
1. **DOM:** Steamworks partner account + the **$100 Steam Direct app fee**, identity/tax/bank forms. (Account-free work I can do now is listed in §5.)
2. **DOM:** create the app (gives the App ID), then create the **Playtest** from the app's "Associated Packages & DLC" page: it gets its **own child App ID**, no separate fee, signups on the base game's store page, library capsule + community assets required, simplified store-page review + a build review before it goes out. Access is granted in batches or via keys; no charging for access; not confidential.
3. **Deploy lane (after the app id exists):** SteamPipe: depot + app build VDF scripts, `steamcmd +run_app_build` with a **dedicated build account** whose login stays out of the repo and logs; set the build live on the playtest branch.
4. **Web lane:** store assets (capsules, screenshots, short description).
5. **Me:** the Electron shell, channel stamp (`steam` + app id fed by a build env, `steam_appid.txt` not shipped), Steam facade with `init(appId)` failing soft when Steam isn't running, a Windows `--dir` build, and a written overlay result.

## 5. Plan and sizes (best estimates, no code yet)
| Step | Output | Size |
|---|---|---|
| Spike (day 1-2, no account) | Electron shell loads the current release build on Windows; Spacewar (app id 480) for the Steam init; overlay recipe tried on a real Windows box; measured installed size and first-run | 1-2 days |
| Shell + channel stamp + system-browser login handoff | PR: `desktop/` (main, preload, builder config), unit tests with injected fakes (donor style) | 3-4 days |
| CI row (below) + `win-unpacked` artifact | PR: workflow (separate PR, no workflow file in feature PRs) | 1 day |
| SteamPipe scripts + first upload | needs the app id from Dom; Deploy runs it | 1-2 days after the id |
Target: a Playtest build uploaded within two weeks of the id existing; everything except the upload is account-free.

## 6. CI row (names the release it unblocks)
**`steam-win-build`** on `windows-latest`: `npm ci`, build the web bundle at the release sha, `electron-builder --dir --win` with `WOC_DISTRIBUTION=steam`-style stamp (our own name), assert the stamp, assert `steam_appid.txt` is absent, assert no `preview/` in the package, run the shell's unit tests, launch the unpacked app with `--smoke` (Steam not running: must reach the game window and log "steam: unavailable", exit 0), upload `win-unpacked` as an artifact, report the size. Unblocks: **"Steam Playtest build 1"**. The workflow ships in its own PR.

## 7. Risks and open decisions
1. Overlay with Electron must be proven on Windows with a real appid (Spacewar shows it in the spike); fallback is the donor's measured `--disable-gpu-sandbox`/`--in-process-gpu` choices.
2. steamworks.js is a slow-moving upstream (last npm 2024-08): pin; fork is the fallback.
3. Bundled vs remote content and version-gating (§3): Lead's call.
4. Package size ~1 GB installed (674 MB game + Electron): fine for Steam, but the ground-truth number comes from the spike. Option to trim `looks/` variants is a Web/Characters question, not a wrapper one.
5. Sign-in on Steam Deck/Linux and Mac: out of scope until after the Playtest.
6. Steam's own rules (store page, build review) can reject or delay; plan one resubmission.

## Sources (read 2026-10-21)
Donor repo files above; `github.com/ceifa/steamworks.js` and its `client.d.ts`; `registry.npmjs.org/steamworks.js` (0.4.0, 2024-08-06) and `/greenworks` (0.1.0, 2016); `github.com/greenheartgames/greenworks`; `partner.steamgames.com/doc/features/playtest`; WebView2Feedback discussion 4019 and Construct's "Trying to show the Steam Overlay over WebView2"; `github.com/JamesMoulang/electron-steam-notes` (overlay flags).
