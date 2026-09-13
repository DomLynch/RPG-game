# Project state

Objective: live Phase 0A on frankendom.com, with canonical RPG direction.
Success: functioning keyboard/touch movement, stable camera, saved guest identity, isolated HTTPS deployment; no claim of a passed player/hardware gate.
Scope: GAME_SPEC.md. Semble discovery is working; CodeGraph was initialized with owner authorization on 2026-09-13. Use both for code work, and run `codegraph sync` after edits.
Files: src/{main,scene,sim,profile}.ts, src/style.css; tests; scripts/deploy.sh; deployment vhost.
Do not inspect/change other business products or existing VPS services.
Selected approach: Vite + TypeScript + Three.js static build, no framework/backend. Babylon and native web exports rejected for additional surface in this bounded gate.
Known risks: no physical minimum-phone tests or external player feedback yet; capsule art is provisional; server storage and actual PvP belong to 0B. VPS had ~1.3 GB free at discovery; deploy only a small static build and do not clean unrelated data.
Next validation: pure simulation invariants, storage failure/reload, touch cancellation, camera edge positions, rendered desktop/mobile layout, public HTTPS and source parity.

## First release audit — 2026-09-13
- Runtime: Node 25.8.1 for local tooling; pinned Three.js 0.186.0, Vite 8.3.0, TypeScript. One production dependency. Browser needs WebGL2.
- Pass 1 (code/state): pure movement and bounded collision, normalized diagonals, input clearing on blur/visibility/cancel, textContent for guest names, storage failure handling, separated rendering. No secrets, engine physics, backend or unrequested combat.
- Pass 2 (behavior): guest name survived browser reload; rendered 390x844 and 844x390 controls fit without horizontal overflow; pointer-pad circling and release, camera toggle, journal and live renderer reviewed. Desktop rendering approximately 60 fps / p95 17–18 ms during these checks, not a five-minute phone benchmark.
- Regression found: clamping camera inside colonnade initially cropped the player at maximum separation. Raised locked-camera framing with distance. Projection tests now exercise near contact and all boundary angles across portrait/landscape; both capsule endpoints stay within the frame. Transient camera motion still requires human comfort testing.
- Automated: 11 tests, including 20,000 seeded movement inputs replayed twice, typecheck, ESLint, production build, full dependency audit (zero known vulnerabilities), shell syntax and payload budget. Three isolated mutations (diagonal speed, boundary clamp, guest write) were all caught by tests.
- Build payload approximately 140 KB gzip / 557 KB raw. Vite warns about a >500 KB raw JS chunk; intentional single fight-ready bundle avoids an unnecessary split. Measured total compressed payload is far below 5 MB.
- Live regression: the initial Nginx try_files accepted explicit files but returned 404 for /. Browser and HTTP checks caught it. Added directory/index resolution; deploy now compares both the public homepage and revision response byte-for-byte with the local build.
- Release fallback: macOS rsync rejected numeric chmod syntax on the first transfer; switched to portable symbolic modes. The failed attempt did not switch the live symlink. GitHub CLI account display was stale; verified the actual authenticated owner through the API before creating the private repository.
- Tooling: greenfield first write had no search corpus. Three Semble searches ran once code existed (movement, persistence, input/camera). No .codegraph exists; not indexed without owner decision. Early automatic hook dependency discovery failed before repository initialization; project-local tsc/ESLint are installed and actual checks now pass.
- Browser QA used CUA in-app browser. Viewport tests are not touch hardware tests. Real multitouch simultaneous run/move, OS interruptions, GPU context loss and unsupported-GPU entry are code-reviewed but not fully exercised on devices. Guest corrupted/blocked storage is covered by unit tests.
- HTTPS provisioned for apex and www using existing VPS ACME account and renewal timer. Isolated Nginx virtual host only; existing unrelated Nginx warning existed before this work. No Sentry project is configured for this new prototype.

## Run / release
- Local: npm ci; npm run dev. Verify: npm run quality.
- Initial hosting: bash scripts/provision.sh (frankendom.com only).
- Release from a clean committed checkout: bash scripts/deploy.sh. It validates, transfers only built assets, and atomically switches the site symlink. Public /release.json records the exact source revision.
- Rollback: on VPS, cd /var/www/frankendom; ln -sfn "$(readlink previous)" next; mv -Tf next current. Verify public /release.json after switching. Each source revision retains its own static release directory.
- Remote source: private DomLynch/frankendom repository; verify local/remote HEAD and /release.json on every close-out.
- No recurring background agent or automatic development task is installed. The static site remains available between sessions.

## Still gated
- Physical iPhone 12 / Pixel 6 performance, five-minute sessions and independent player usability must pass before combat.
- Final humanoid rig, licensed animation pack, online combat, recoverable identity and RPG progression are not implemented or validated.

## Character art pass — 2026-09-13
- Owner reports comfortable movement on iPhone 15 and supplied a 59 fps / p95 18 ms screenshot after disabling Low Power Mode. This is a useful spot check, not the minimum-device or external-player gate.
- Authorized next milestone: replace both capsule proxies with grounded medieval humanoids, coherent idle/walk/run and distinct appearances. Preserve simulation, controls and arena; combat remains deferred.
- Preferred candidate after visual review: Creaturepub Medieval Knight, https://creaturepub.gumroad.com/l/medieval-knight ($5 listed). One humanoid rig, sword, three PBR texture variants and 12 advertised clips including idle/walk/run; FBX/Blend supplied. Purchased files and animation quality are not yet verified.
- Same creator/model at https://www.cgtrader.com/3d-models/character/fantasy-character/medieval-knight-47a30543-e0f0-46fb-b869-ea5494f7dc78 ($10 listed) has explicit royalty-free terms. However, https://www.cgtrader.com/pages/terms-and-conditions sections 21A.2–3 require incorporated/protected distribution; a public standalone GLB is not automatically cleared. Obtain the creator's written commercial browser-game permission before purchasing for this static delivery approach. Gumroad's public listing supplies no explicit licence.
- Alternatives rejected: Quaternius knight misses the grounded visual brief; OpenGameArt Animated Knight lacks a run clip; the other CGTrader free knight advertises animation problems; the reviewed Fab knight is Unreal-only and advertises 110,301 triangles. Avoid asset retargeting/toolchain work before acquiring a suitable coherent source.
- Import contract: one optimized local GLB, approximately 1.8 m standing height with feet at y=0 and forward +Z; in-place idle/walk/run clips from the same rig; start with 1K textures. Clone the skinned skeleton per fighter while sharing geometry/textures, use independent animation mixers, and blend from actual displacement so collision and released input cannot leave a walking character. No animation-root displacement may reach simulation. Check lock-mode sideways/backward motion explicitly; forward-only clips may require additional locomotion coverage.
- Acceptance: inspect original rig/clip coverage and deformation first; then check both characters, ground contact, movement transitions, camera-edge framing, pause/input cancellation, guest persistence and load failure in portrait/landscape. Measure final payload and phone frame times again before claiming performance. Existing Three.js loader/mixer utilities need no extra runtime dependency.
- Current blocker: purchase and seller-contact authorization. No asset purchased, downloaded into the project or integrated; live capsules remain in place. No speculative loader code added before inspecting the real asset.
- Prepared seller message (not sent): "I am considering your Medieval Knight for Frankendom, a commercial browser game. May we convert and optimize the model/animations into a GLB fetched by our Three.js game, with no asset-download feature or standalone resale? Browser network inspection can recover client assets. Please confirm this delivery is permitted under the purchased licence, and that the supplied rig includes working in-place idle, walk and run animations."

## Monitoring and code discovery - 2026-09-13
- Authorized addition: pinned @sentry/browser 10.74.0, the second runtime dependency, for production error reporting. No gameplay changes, tracing, session replay or session tracking; request, user, extra and breadcrumb fields are removed before sending.
- Sentry project: na-wnr/frankendom. Build connection setting is in ignored .env.production.local (mode 600); .env.example documents setup. This is a public browser ingest key, never a management credential. Release script refuses an absent/non-HTTPS DSN and stamps errors with the committed SHA.
- Two new regression tests cover disabled configuration, selected integrations and real SDK event serialization/privacy. Browser auto-capture and live ingestion must be checked on release; unit tests alone do not prove ingestion.
- CodeGraph index is local/ignored, not a runtime dependency. Semble and CodeGraph are complementary discovery/structure tools; Sentry supplies runtime error evidence. Do not equate telemetry ingestion with validated gameplay.
- Release validation caught CSP blocking Sentry: the site now allows only its explicit HTTPS ingest origin, with a regression assertion and deployment configuration check. Browser auto-capture reached HTTP 200 after the fix; remote event lookup is a separate required verification. Total quality suite: 14 passing tests, typecheck/lint/build/audit/budget pass. Desktop/mobile renders were checked with blocked telemetry; software-rendered browser timing is not a phone-performance benchmark.
