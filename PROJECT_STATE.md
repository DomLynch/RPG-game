# Project state

Current beta/launch scope: `docs/SCOPE.md` (dated, wins over older lines in any state file).

One file per lane under `docs/state/`. Each lane appends its own entries at the top of its own file, with evidence and the remaining validation (AGENTS.md); nothing goes in this index but the table below. GAME_SPEC.md stays the canonical design. The pre-lane history (2026-09-13) lives in the archive file.

| Lane | File | Entries | Latest entry |
|---|---|---|---|
| Strategy | [docs/state/strategy.md](docs/state/strategy.md) | 1 | 2026-09-22 — restart from memory, Brief 13/14 status, loot v2 wielding, tier table, shield brief |
| Lead | [docs/state/lead.md](docs/state/lead.md) | 20 | 2026-09-21 — Release check 9 (polearm-browser-check) became checks 9–12; everything after ren |
| Combat | [docs/state/combat.md](docs/state/combat.md) | 47 | 2026-09-26 — Cleave lever closed (no change), Sparring dummy e7d97ac0, Jab closed |
| Weapons | [docs/state/weapons.md](docs/state/weapons.md) | 27 | 2026-09-28 — #992 estoc + cleaver Pommel live (correction); weapon shapes intake: fit check + rank-band slots (maul first) |
| Character | [docs/state/character.md](docs/state/character.md) | 17 | 2026-09-21 — Loot export v1 — Brief 5, Scalable Chars lane, 2026-09-21 (Strategy's assignment on the owner's "take t |
| Finishers & gore | [docs/state/finishers.md](docs/state/finishers.md) | 24 | 2026-09-27 — frozen at 26082c3c: #868 E2 tour look 1.3 m portrait + #871 waist-cut shadow live; Dwarf gap open |
| Visuals & world | [docs/state/world.md](docs/state/world.md) | 11 | 2026-09-20 — Arena props, startup worker, crowd cull, sky environment, sparks v2 — presentati |
| Sounds & music | [docs/state/audio.md](docs/state/audio.md) | 7 | 2026-09-20 — Combat audio — consolidated lane state — 2026-09-20 (reconciliation after five p |
| Stats, damage & defence | [docs/state/stats.md](docs/state/stats.md) | 1 | 2026-09-22 — Brief 19 deliverable 1: tier stat table, Attack + RES, caps exact, naked and Recruit both identity |
| Code quality | [docs/state/code-quality.md](docs/state/code-quality.md) | 7 | 2026-09-29 — row 49 WebKit replay built (#1083), battery + row run owed in Lead slot; A/B/C LIVE bfe1633a |
| Web design | [docs/state/web.md](docs/state/web.md) | 26 | 2026-09-28 — HANDOFF: /game Golden Order + spar banner LIVE (aaef2c62); #972 ladder fix + #912 load gate READY |
| Career | [docs/state/career.md](docs/state/career.md) | 2 | 2026-09-20 — AFK fights run on — career lane, 2026-09-20 (owner: "nothing more, nothing less, |
| The Pit | [docs/state/pit.md](docs/state/pit.md) | 1 | 2026-09-29 — lane opened: post-fight room (gate walk-in, gear rack, trophies, next-fight gate), sealed src/pit/ module |
| Duel | [docs/state/duel.md](docs/state/duel.md) | 1 | 2026-09-29 — lane opened: permanent real-player PvP (challenge links, matchmaking, rollback), any region |
| Armour | [docs/state/armour.md](docs/state/armour.md) | 1 | 2026-09-26 — lane opened by Strategy on Dom's order: crest, rank-tint retune, PD hat, Dwarf greaves, audit pass |
| Archive (pre-lane history) | [docs/state/archive-2026-09-21.md](docs/state/archive-2026-09-21.md) | 8 | 2026-09-13 — First-hit slice — implemented 2026-09-13 |

Split on 2026-09-21 from a single 1,351-line file (129 entries, 66 edits in the preceding 48 h): every entry moved once, verbatim, into the file of the lane named in its heading (one byte-identical duplicate entry, "Slice V — the opponent seam", dropped); entries without a lane went to Lead, and the pre-lane slices to the archive. Lanes correct their own file when a heading was read wrong.
