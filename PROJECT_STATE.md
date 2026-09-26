# Project state

Current beta/launch scope: `docs/SCOPE.md` (dated, wins over older lines in any state file).

One file per lane under `docs/state/`. Each lane appends its own entries at the top of its own file, with evidence and the remaining validation (AGENTS.md); nothing goes in this index but the table below. GAME_SPEC.md stays the canonical design. The pre-lane history (2026-09-13) lives in the archive file.

| Lane | File | Entries | Latest entry |
|---|---|---|---|
| Strategy | [docs/state/strategy.md](docs/state/strategy.md) | 1 | 2026-09-22 — restart from memory, Brief 13/14 status, loot v2 wielding, tier table, shield brief |
| Lead | [docs/state/lead.md](docs/state/lead.md) | 20 | 2026-09-21 — Release check 9 (polearm-browser-check) became checks 9–12; everything after ren |
| Combat | [docs/state/combat.md](docs/state/combat.md) | 47 | 2026-09-26 — Cleave lever closed (no change), Sparring dummy e7d97ac0, Jab closed |
| Weapons | [docs/state/weapons.md](docs/state/weapons.md) | 25 | 2026-09-23 — Now: gladius first (Lead #517), #419 recreated off trunk, Maul_* at post-beta pace; lane lessons carried from #473 |
| Character | [docs/state/character.md](docs/state/character.md) | 17 | 2026-09-21 — Loot export v1 — Brief 5, Scalable Chars lane, 2026-09-21 (Strategy's assignment on the owner's "take t |
| Finishers & gore | [docs/state/finishers.md](docs/state/finishers.md) | 14 | 2026-09-21 — Finisher side view: measured reach for Quiet One too, foreshortened fit, rate-li |
| Visuals & world | [docs/state/world.md](docs/state/world.md) | 11 | 2026-09-20 — Arena props, startup worker, crowd cull, sky environment, sparks v2 — presentati |
| Sounds & music | [docs/state/audio.md](docs/state/audio.md) | 7 | 2026-09-20 — Combat audio — consolidated lane state — 2026-09-20 (reconciliation after five p |
| Stats, damage & defence | [docs/state/stats.md](docs/state/stats.md) | 1 | 2026-09-22 — Brief 19 deliverable 1: tier stat table, Attack + RES, caps exact, naked and Recruit both identity |
| Code quality | [docs/state/code-quality.md](docs/state/code-quality.md) | 6 | 2026-09-24 — #707 gear seam (brief 19 d5, v11, version window), #708 audit C+D, GPT audit routed |
| Web design | [docs/state/web.md](docs/state/web.md) | 14 | 2026-09-22 — Loot panel: a tap is the take, Undo, and the gold skin — item 10 (Dom, with a ph |
| Career | [docs/state/career.md](docs/state/career.md) | 2 | 2026-09-20 — AFK fights run on — career lane, 2026-09-20 (owner: "nothing more, nothing less, |
| Armour | [docs/state/armour.md](docs/state/armour.md) | 1 | 2026-09-26 — lane opened by Strategy on Dom's order: crest, rank-tint retune, PD hat, Dwarf greaves, audit pass |
| Archive (pre-lane history) | [docs/state/archive-2026-09-21.md](docs/state/archive-2026-09-21.md) | 8 | 2026-09-13 — First-hit slice — implemented 2026-09-13 |

Split on 2026-09-21 from a single 1,351-line file (129 entries, 66 edits in the preceding 48 h): every entry moved once, verbatim, into the file of the lane named in its heading (one byte-identical duplicate entry, "Slice V — the opponent seam", dropped); entries without a lane went to Lead, and the pre-lane slices to the archive. Lanes correct their own file when a heading was read wrong.
