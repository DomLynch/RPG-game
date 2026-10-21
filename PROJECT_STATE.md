# Project state

Current beta/launch scope: `docs/SCOPE.md` (dated, wins over older lines in any state file).

One file per lane under `docs/state/`. Each lane appends its own entries at the top of its own file, with evidence and the remaining validation (AGENTS.md). A lane's newest entry often lives on its own state branch and in its memory before it reaches trunk, so read the lane's file (and branch) rather than trusting a date here. GAME_SPEC.md stays the canonical design. The pre-lane history (2026-09-13) lives in the archive file.

This index is generated: `node scripts/state-index.mjs` after adding or renaming a file in `docs/state/` (tests/state-index.test.ts checks it).

## Lanes

| Lane | File |
|---|---|
| Armour | [docs/state/armour.md](docs/state/armour.md) |
| Sounds & music | [docs/state/audio.md](docs/state/audio.md) |
| Backend & Accounts | [docs/state/backend.md](docs/state/backend.md) |
| Career | [docs/state/career.md](docs/state/career.md) |
| Character | [docs/state/character.md](docs/state/character.md) |
| Code quality lane (Auditor) | [docs/state/code-quality.md](docs/state/code-quality.md) |
| Combat Sandbox (Dom's lane) | [docs/state/combat-sandbox.md](docs/state/combat-sandbox.md) |
| Combat | [docs/state/combat.md](docs/state/combat.md) |
| Deploy lane | [docs/state/deploy.md](docs/state/deploy.md) |
| Duel (real-player PvP) | [docs/state/duel.md](docs/state/duel.md) |
| Executioner | [docs/state/executioner.md](docs/state/executioner.md) |
| Expansion lane (Frankendom: Origins) | [docs/state/expansion.md](docs/state/expansion.md) |
| Finishers & gore | [docs/state/finishers.md](docs/state/finishers.md) |
| Goblin | [docs/state/goblin.md](docs/state/goblin.md) |
| Hero Look — project state (AAA-look pilot) | [docs/state/herolook.md](docs/state/herolook.md) |
| Lead | [docs/state/lead.md](docs/state/lead.md) |
| Multi-chars (scalable characters) | [docs/state/multichar.md](docs/state/multichar.md) |
| Nightborn | [docs/state/nightborn.md](docs/state/nightborn.md) |
| The Pit | [docs/state/pit.md](docs/state/pit.md) |
| Pitborn | [docs/state/pitborn.md](docs/state/pitborn.md) |
| Sandbox v2 (foe folder): state, 2026-10-17 (read first; detail in docs/state/combat-sandbox.md) | [docs/state/sandbox-foe.md](docs/state/sandbox-foe.md) |
| Combat Sandbox lane: handoff (2026-10-15) | [docs/state/sandbox.md](docs/state/sandbox.md) |
| Stats, damage and defence | [docs/state/stats.md](docs/state/stats.md) |
| Strategy | [docs/state/strategy.md](docs/state/strategy.md) |
| Veteran | [docs/state/veteran-polish.md](docs/state/veteran-polish.md) |
| Weapons | [docs/state/weapons.md](docs/state/weapons.md) |
| Web design | [docs/state/web.md](docs/state/web.md) |
| Visuals & world | [docs/state/world.md](docs/state/world.md) |
| Zone sandbox (Dom-driven design sandbox for Zone 1's look, then zones as rows) | [docs/state/zone-sandbox.md](docs/state/zone-sandbox.md) |

## Dated reports and handovers

| Report | File |
|---|---|
| Archive — pre-lane history (2026-09-13) | [docs/state/archive-2026-09-21.md](docs/state/archive-2026-09-21.md) |
| Beta launch-gate audit, 2026-10-17 (Backend, read-only) | [docs/state/beta-gates-2026-10-17.md](docs/state/beta-gates-2026-10-17.md) |
| New combat-feel ideas (Combat Sandbox, 2026-10-13) | [docs/state/combat-new-ideas-2026-10-13.md](docs/state/combat-new-ideas-2026-10-13.md) |
| Combat donor research (Combat Sandbox lane, 2026-10-13) | [docs/state/combat-research-2026-10-13.md](docs/state/combat-research-2026-10-13.md) |
| Live phone rank sweep — 2026-09-30 / 10-01 | [docs/state/herolook-sweep-2026-10-01.md](docs/state/herolook-sweep-2026-10-01.md) |
| Nightborn lane: full handover, 2026-10-02 (night) | [docs/state/nightborn-handover-2026-10-02.md](docs/state/nightborn-handover-2026-10-02.md) |
| strategy-ledger-2026-10-08 | [docs/state/strategy-ledger-2026-10-08.md](docs/state/strategy-ledger-2026-10-08.md) |
