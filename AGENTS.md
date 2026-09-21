# Frankendom

Read GAME_SPEC.md and PROJECT_STATE.md before work. GAME_SPEC.md is canonical design.

- **Trunk discipline — owner-enforced 2026-09-19.** The live trunk `codex/01a09a76/task-1` lives in the lead checkout (`~/Desktop/Business/frankendom`) ONLY, and the lead checkout holds trunk permanently. Lane worktrees (`~/Developer/frankendom-*`): NEVER check out trunk — branch off freshly fetched trunk and stay on your lane branch (`git worktree add <path> -b <lane>/<thing> origin/codex/01a09a76/task-1`). Git itself refuses a branch checked out in another worktree, so this holds as long as the lead checkout stays on trunk. Lead work that needs a branch happens in a temp worktree — never by parking the main checkout elsewhere. The post-checkout hook reverts a lane worktree that switches onto trunk (where `core.hooksPath` is set).
- Grounded medieval fantasy RPG. Persistent fighter identity and meaningful builds lead design.
- Current scope: owner-authorized local swordplay and moving-opponent practice slice after the Phase 0A foundation. Broader hardware/usability gate remains unpassed; no claim of validated combat or online PvP.
- Minimal TypeScript + Three.js + Vite; no UI framework, physics engine, ECS or backend in 0A.
- Simulation is pure, fixed at 60 Hz, independent of rendering, animation, wall clock and browser APIs.
- Never claim greybox art is final art, local storage is recoverable identity, or a prototype is validated gameplay.
- Items become data when equipment gameplay is authorized. No speculative item framework now.
- Check the NOT-NOW list before adding features. Do not implement deferred scope autonomously.
- Run every command in .quality-gate.json; audit changes for state, input cancellation, mobile layout and deployed behavior.
- Runtime dependencies: Three.js, Sentry browser SDK and the lazy-loaded Supabase SDK (owner-authorized Google login/account saves); no more without a demonstrated requirement.
- Code discovery workflow: start every 'where is X / how does Y work' question with Semble `search` (then `find_related` to expand from a hit); use `codegraph_explore` for structural questions — callers/callees, blast radius before editing a symbol, execution traces. Reach for Grep/Read only when both return nothing (unindexed repo). Hooks keep `.codegraph/` fresh automatically on checkout/merge — no manual `codegraph sync` needed; indexes stay untracked. Sentry project: `na-wnr/frankendom`; inspect actual events for production errors, not just SDK presence.
- Deployment: scripts/deploy.sh to frankendom.com only. Atomic static releases; no changes to other VPS sites.
- Shared GPU and release window: coordinate with the lead before browser release checks, trunk merges or deployment. The lead must include every active lane when reserving the window; another lane's FREE is not permission to publish independently. Isolated CPU work may continue. Fetch trunk again immediately before merging; integrate intervening changes and revalidate before publication. Report FREE only after owned browser/deploy processes have closed.
- No purchases or player outreach without explicit authorization. Record licensing before adding third-party assets.
- Review in two passes: simulation/input correctness, then actual browser/render/persistence behavior.
- Keep PROJECT_STATE.md current with evidence and remaining validation. Do not write user memories.
- `artifacts/` is untracked output (receipts, renders, probes, browser-check frames): scripts write there, no gate or script reads a committed file from it, and `.gitignore` keeps it out of commits. Anything a gate must read lives under `scripts/` or `src/assets/`.
- World & Environment lane owns `src/arena.ts` (`buildArena(scene) → { group, floor, update(dt, events), dispose() }` — `floor` is the sand mesh, the gore lane's decal target), `src/assets/arena/**`, `scripts/arena-preview.mjs`, `scripts/build-arena.mjs`, `tests/arena.test.ts`. Contract in arena.ts and its test: nothing solid inside the play circle, nothing inside the camera clamp at fighter height, a boundary ring at the play radius. Lights, fog, tone mapping, camera, post-processing and effects stay in `scene.ts` (lead/presentation).

## Setup (once per clone)

Run `git config core.hooksPath .githooks` — the hooks in `.githooks/` keep `.codegraph/` fresh automatically on checkout/merge/rewrite.
