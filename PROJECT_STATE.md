# Project state

Objective: live Phase 0A on frankendom.com, with canonical RPG direction.
Success: functioning keyboard/touch movement, stable camera, saved guest identity, isolated HTTPS deployment; no claim of a passed player/hardware gate.
Scope: GAME_SPEC.md. New empty project, no existing code or CodeGraph index. Semble discovery and CodeGraph impact are not applicable to greenfield authoring; use direct review and executable behavior checks. No index created without user decision.
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
