# Project state

Objective: live Phase 0A on frankendom.com, with canonical RPG direction.
Success: functioning keyboard/touch movement, stable camera, saved guest identity, isolated HTTPS deployment; no claim of a passed player/hardware gate.
Scope: GAME_SPEC.md. Semble discovery is working; CodeGraph was initialized with owner authorization on 2026-09-13. Use both for code work, and run `codegraph sync` after edits.
Files: src/{main,scene,sim,profile}.ts, src/style.css; tests; scripts/deploy.sh; deployment vhost.
Do not inspect/change other business products or existing VPS services.
Selected approach: Vite + TypeScript + Three.js static build, no framework/backend. Babylon and native web exports rejected for additional surface in this bounded gate.
Known risks: no physical minimum-phone tests or external player feedback yet; character art is an early original pass; server storage and actual PvP belong to 0B. VPS had ~1.3 GB free at discovery; deploy only a small static build and do not clean unrelated data.
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
- A humanoid rig and four movement clips are implemented in the character pass below. Full combat animation coverage, online combat, recoverable identity and RPG progression remain deferred.

## Character art pass — 2026-09-13
- Owner authorized the free Quaternius foundation with original armour after an iPhone 15 movement spot check at 59 fps / p95 18 ms. This does not pass the minimum-device/external-player gate. Paid sourcing is superseded; no purchase or outreach occurred.
- Implementation: one self-contained CC0-derived GLB, original fitted helmet/plate harness/scabbard/heraldry and baked surface textures. Free Standard base narrowed by 10%; four retargeted clips (idle/walk/jog/run). Provenance, source hashes and rebuild instructions: src/assets/README.md; generator: scripts/build-warrior.mjs. No additional runtime dependencies.
- Rendering only: cloned independent skeletons share geometry/textures. Gaits follow actual displacement, including collision stops. Locked camera still frames the opponent; the body turns with travel during locomotion to avoid forward clips sliding sideways. Directional combat locomotion remains a later requirement. Pure simulation, collision and guest state are unchanged.
- Rejected approaches: hand-keying all locomotion would discard the coherent foundation; a runtime modular armour system adds unnecessary code/draw calls. Bake original armour into four skinned material groups offline instead. Geometry welding and removal of unused face morphs reduced the asset to 2.28 MB raw.
- Review pass 1: 17 tests cover prior simulation/storage/camera behavior plus normalized gait blending, actual shipped animated mesh bounds/foot contact, finite poses and independent skeletons. ESLint, typecheck/build, dependency audit and payload budget pass. Static output approximately 3.03 MB raw / 1.00 MB gzip; actual HTTP compression must be checked after deployment.
- Review pass 2: production-CSP preview caught blocked embedded textures. Add blob sources for model image decoding and validate required textures so a partial load cannot silently pass. Portrait 390x844 and landscape 844x390 were inspected; joystick release resets, camera lock works, journal opens/closes, and Aldren survives reload. Successful preview has no new console errors. A separate deliberately missing-model preview shows the retry message and retains capsule movement. Failure QA used an empty build DSN to avoid sending expected test errors to production monitoring.
- Browser preview reports about 60 fps / p95 17–18 ms on the desktop host. Physical iPhone 15 with this new asset, minimum phones, multitouch interruptions and five-minute thermal performance remain unverified. Art is an early original pass, not final AAA production art or full combat coverage.
- Release procedure: CodeGraph synced; 17 tests and final checks passed. Scoped Nginx texture/compression policy applied with successful nginx -t and active service. The first asset transfer hit a transient public SSH refusal before release switch; saved public key retry succeeded, Tailscale timed out. Deploy now reuses one bounded SSH connection for mkdir/transfer/switch. Complete public model, revision, compression, active-config and browser checks after the atomic release.

## Monitoring and code discovery - 2026-09-13
- Authorized addition: pinned @sentry/browser 10.74.0, the second runtime dependency, for production error reporting. No gameplay changes, tracing, session replay or session tracking; request, user, extra and breadcrumb fields are removed before sending.
- Sentry project: na-wnr/frankendom. Build connection setting is in ignored .env.production.local (mode 600); .env.example documents setup. This is a public browser ingest key, never a management credential. Release script refuses an absent/non-HTTPS DSN and stamps errors with the committed SHA.
- Two new regression tests cover disabled configuration, selected integrations and real SDK event serialization/privacy. Browser auto-capture and live ingestion must be checked on release; unit tests alone do not prove ingestion.
- CodeGraph index is local/ignored, not a runtime dependency. Semble and CodeGraph are complementary discovery/structure tools; Sentry supplies runtime error evidence. Do not equate telemetry ingestion with validated gameplay.
- Release validation caught CSP blocking Sentry: the site now allows only its explicit HTTPS ingest origin, with a regression assertion and deployment configuration check. Browser auto-capture reached HTTP 200 after the fix; remote event lookup is a separate required verification. Total quality suite: 14 passing tests, typecheck/lint/build/audit/budget pass. Desktop/mobile renders were checked with blocked telemetry; software-rendered browser timing is not a phone-performance benchmark.
