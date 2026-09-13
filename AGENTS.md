# Frankendom

Read GAME_SPEC.md and PROJECT_STATE.md before work. GAME_SPEC.md is canonical design.

- Grounded medieval fantasy RPG. Persistent fighter identity and meaningful builds lead design.
- Current scope: owner-authorized local swordplay and moving-opponent practice slice after the Phase 0A foundation. Broader hardware/usability gate remains unpassed; no claim of validated combat or online PvP.
- Minimal TypeScript + Three.js + Vite; no UI framework, physics engine, ECS or backend in 0A.
- Simulation is pure, fixed at 60 Hz, independent of rendering, animation, wall clock and browser APIs.
- Never claim greybox art is final art, local storage is recoverable identity, or a prototype is validated gameplay.
- Items become data when equipment gameplay is authorized. No speculative item framework now.
- Check the NOT-NOW list before adding features. Do not implement deferred scope autonomously.
- Run every command in .quality-gate.json; audit changes for state, input cancellation, mobile layout and deployed behavior.
- Runtime dependencies: Three.js and the authorized Sentry browser SDK; no more without a demonstrated requirement.
- Use Semble for discovery and the local CodeGraph index for structural context. Run `codegraph sync` after code changes; indexes stay untracked. Sentry project: `na-wnr/frankendom`; inspect actual events for production errors, not just SDK presence.
- Deployment: scripts/deploy.sh to frankendom.com only. Atomic static releases; no changes to other VPS sites.
- No purchases or player outreach without explicit authorization. Record licensing before adding third-party assets.
- Review in two passes: simulation/input correctness, then actual browser/render/persistence behavior.
- Keep PROJECT_STATE.md current with evidence and remaining validation. Do not write user memories.
