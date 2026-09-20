# Asset loader teardown fix — 2026-09-20 (release check 34/34, WebKit)

**Failure (lead's brief).** `node scripts/check-glb-compression.mjs --browser`, WebKit only, ~1 run in 3 on trunk 63f4cd9:
`receipt.errors = ["Fetch API cannot load …/assets/arena-<hash>.m4a due to access control checks."]`.

**Mechanism (reproduced deterministically, WebKit 2336).** Navigating away 0–30 ms after "Enter the arena" cancels the pending
`.ogg` fetch/decode; that rejection is still caught (the realm is alive), so the loader's loop starts the `.m4a` fallback —
*during unload*. WebKit refuses a load from an unloading document ("access control checks"; the request never reaches the
network log) and delivers the rejection after the document is detached, so no `catch` can see it: an unhandled `pageerror`.
Both banks are affected (run 7 of the reproducer reported `sprite-*.m4a` and `arena-*.m4a`); the lead saw the arena file
because of timing. This WebKit picks Opus first (`canPlayType` "probably"; real Safari says ""), so the fallback only ever
runs on this cancellation path.

**Fix (`src/audio/sprite.ts`, `src/audio/arena.ts`).** Asset fetches die with the page: a module flag rises on `beforeunload`
and `pagehide` (the cancel can precede `pagehide`), in-flight fetches are aborted on `pagehide`, a retry first yields a
macrotask (timers are dropped with the document, microtasks are not) and then checks the flag; `pageshow` resets it for
back/forward-cache restores. No change to what plays, when, or how loud; no gate change; no `main.ts` change.

**Receipts.**
| check | before | after |
|---|---|---|
| reproducer: navigate 0–400 ms after Enter (10 runs) | 3/10 fail (0 ms, 0 ms, 30 ms) | 0/10 |
| reproducer: navigate 0–10 ms after Enter (20 runs) | — | 0/20 |
| `check-glb-compression.mjs --browser` ×5 (Chromium + WebKit, werewolf + skeleton) | 3/3 pass here, ~1/3 fail for the lead | 5/5 pass (143/177/145/86/96 s) |
| `arena-audio-check.mjs` | pass | pass (58 s) |
| unit: loaders never start the fallback while unloading, still do on a live page | new | pass |
| `quality:ci` + `test:browser` (Stop gate) | — | pass |

Reproducer (scratch, not committed): WebKit page → `?opponent=werewolf` → wait ready → click Enter → `goto ?opponent=skeleton`
after N ms → collect `pageerror`. Logs: /tmp/glb-fix-{1..5}.log, /tmp/arena-fix.log on the audio machine.
