# Reliability and launch acceptance — 2026-09-19

This audit distinguishes a historical report from a reproduced current defect.
No Sentry issue was closed merely because its release is old.

## Production reports inspected

| Issue | Latest inspected release | Evidence and disposition |
| --- | --- | --- |
| FRANKENDOM-5 | `714e969` | Texture validation; event `dd68c0e102c94908b91d4b795d37aa2b`. Current loader validates the humanoid and creature material contracts separately. Keep open until current-release asset/failure checks and production observation establish its disposition. |
| FRANKENDOM-A | `9587019` | Texture validation; event `9ba618fcf6c94b69817ecda0a34fe1d3`. Historical, not proved fixed. |
| FRANKENDOM-4 | `c3dd25d` | Texture validation; event `e55901f3b98941f4926c5b2cee088c46`. Historical, not proved fixed. |
| FRANKENDOM-6 | `f7a1e99` | Load failed; event `6def4fe3c23d45be94d4180cad2c189b`, no actionable stack. Do not infer a geometry or GPU defect from this alone. |
| FRANKENDOM-8 | `db3e0a9` | Fetch failure in Three.js loader; event `a40be902aa484f559344359a1e97735a`. Keep open; successful HTTP alone cannot prove interrupted loading recovers. |
| FRANKENDOM-7 | `db3e0a9` | Global script error without an actionable stack; event `113d893310454a56b754be012dd7bb8d`. Unclassified; no claim of a fix. |
| FRANKENDOM-9 | `1afa0cb` | Generic arena initialization error; event `0e790ed2f2f34882aa4be52a9405a684`. Reproduced diagnostic defect: startup replaced the original exception. Re-throw the original error while retaining the friendly fallback. |
| FRANKENDOM-2 | `42c4981` | Earlier generic courtyard initialization error; event `9f3d5a2339854475bbc027fa83e678a9`. Same loss of diagnostic detail; preserving the cause does not repair every underlying GPU failure. |

The startup regression injects a specific renderer exception and requires the
same error object to escape. It failed before the change and passes after it.
The browser gate disables WebGL and requires the fallback message, disabled
combat, a null context, and exactly the original Three.js error. Deliberate
failure tests block telemetry so they do not create production incidents.

## Acceptance still required

- Physical iPhone 12 and Pixel 6: five **active** minutes each, including movement,
  circling, drawing, attacks, guard, dodge, menu/resume and rematch. Record release,
  OS/browser, thermal/power state, median fps, p95 frame time, and errors. Targets:
  median at least 55 fps and p95 at most 25 ms. Desktop mobile emulation is not this test.
- Five to ten external players: at least four of five move, circle and lock within
  60 seconds without coaching. Record failures and observations; developer runs
  do not count as external players. Recruitment needs owner authorization.
- Career progression: use the existing Recruit-to-Origin ladder. Award policy
  for local practice wins is awaiting the owner's decision. Keep practice records
  separate from future verified competitive results; do not turn a client-editable
  save into a trusted rank ledger.

Future end-game mechanics remain documentation-only. No new backend framework,
equipment system or competitive rating is needed for this cleanup.

## Shared check-runner limitation

The installed shared hook caps the entire command list at 420 seconds, while
this candidate's 24 commands took 1,111 seconds and all passed when run directly.
GitHub's hosted quality job was also prevented from starting by account billing;
the clean Node 22 and disposable PostgreSQL equivalents passed locally. These are
recorded infrastructure limitations, not passing hosted/automatic runs. No shared
hook, billing setting, protection rule or test assertion was weakened for release.
