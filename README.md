# Pit stone comparison: 375x812, gate + trophies (Web, 2026-09-30)

Head **29e0eba7** on `web/pit-stone-c59` (trunk c59d4a46 + Web's stone work; the branch is pushed, no PR). SwiftShader on the VPS capture queue, same seeded guest fighter for every shot.
Left to right in `sheet-gate-375.png` / `sheet-trophies-375.png`:
1. `?look=pit` before
2. `?look=pit-stone` GPT's set (default)
3. `?look=pit-stone-proc` Web's procedural stone + flagstone floor
4. `?look=pit-stone-sand` GPT walls over the plain sand floor
5. `?look=pit-stone-full` GPT + AO + wall-damp mask + torch-soot

Receipt (`receipt-375.json`, no page errors):
- GPT: 6 maps 512², 8.0 MiB GPU, landed 112 ms (unthrottled), 420 ms at 4× CPU throttle.
- proc: 4 maps, 5.3 MiB, worker 230 ms, landed 4.8 s (SwiftShader).
- sand: same 6 maps, 8.0 MiB. full: 11 maps, 12.7 MiB, landed 98 ms.
The -full variant was broken until 29e0eba7 (`pitLookFrom` missed the token, so the page stayed on the fight).
Not here yet: 1280x800 (queued on the VPS), and GPT's real gate + chests (World's PR #1173, added when it lands).
