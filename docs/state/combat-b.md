# Combat B: state at handover (2026-10-13)

Dom's ruling (07:0x Dubai): one Combat lane from today. Combat B closes; **Combat A ("Frankendom - Combat & Specials") owns everything below.** Lane archived after this doc.

## Open PRs (all auditor:ready at handover)
| PR | Head | Base | What | Next |
|---|---|---|---|---|
| #2444 | aa4dfe0d4 | combat/damage-kind (#2442) | Wave A1 steps 6+7, RV50 provisional: CC timing (windowFrom, post-CC immunity), immuneTier + partial resist (catalogue fields -> Fighter.ccGuard), swarm band rows (roll.ts SWARM_ROWS, Duel.roll.swarm/rank). All opt-in, fingerprint identical, REACH[50]=[], 2246/0. | Lead kept RV50. If #2442 moves: MERGE its head, take its record.ts/guard, re-add the RV50 line, re-pin SIM_DIGEST. |
| #2427 | dbed0aa81 | combat/gear-loadout (#2416) | Guard: only src/main.ts may pass `sheet: 'trust'` to verifyRecord. | Rebase on #2416's newest head if it moves. Retarget to trunk when #2416 merges. |
| #2436 | 27f2a3b4c | trunk | Determinism: Surtr's flake hash + drift on detmath.sin (Mac failed special-defs at tick 148, flake 35 on a 1e-6 edge). Auditor PASS @27f2a3b4c. | Mac run still owed: next Mac-fallback suite, or a Mac lane in a quiet window (Lead: no MAC_HEAVY_OK). |
| #2440 | d8be7a10d | #2436's branch | Rest of the Pitborn render path on detmath; pins unchanged (0 lines move); closes a latent Typhon edge (sand 80, tick 94). | When #2436 merges: retarget to trunk, unit-ci receipt, auditor:ready. |

## Owed work, not started
1. **Rows PR on #2444 (Lead accepted these as shipping defaults; Lead reviews, "Lead: PASS")**: windowFrom `'end'`; post-CC immunity stun 120 ticks / knockdown 180 / root 0; immuneTier `unstoppable` (all families) for rank-10 bosses, `steadfast` (knockdown) for ranks 8-9; resist `iron` 50 % bosses, `stubborn` 75 % elites; swarm perFoe 3, cap 6 (ranks 1-5) / 9 (ranks 6-10). This moves world fights on purpose (not Pit records).
2. **Strategy's rule (Dom 07:0x): CC ladder and immunity as REGISTRY rows; a new CC kind is one row.** #2444 has them as a TS const (`CC_LADDER`) with the closed `CcFamily` union. Do it like damage-kinds.ts: a `cc-defs.json` + manifest via `src/core/registry.ts` (tables: families {id, sources[], steps[], window, windowFrom, immunity}; tiers and resists with rank bands, since Lead's numbers are per rank and a catalogue row is a kind; `creature()` knows the level, rank = ceil(level/5)). Swarm rows likewise. Add the JSONs to eslint SIM_DATA and the guard's LOADER_ONLY; tests using CC_LADDER: cc-ladder.test, cc-ladder-engine.test, cc-ladder-world.test, cc-swarm-rows.test, catalogue.test (refs ccTiers/ccResists).
3. The world loop sets no `Duel.roll` today, so the swarm band reaches players only when the world turns its +/-10 % roll on (Lead: a separate visible change, not today).

## Gotchas
- k7-engine-parity forbids any field/default named `*attackers*` / `*tokens*` outside attackers.ts: hence `swarm` / `perFoe`.
- After any push to a PR under review: re-add `auditor:ready`, drop a stale `release:go`. Retargeting does not start unit-ci (`gh workflow run unit-ci.yml --ref <branch>`).
- Run tests/graphics.test.ts whenever main.ts imports change. Run fingerprint proofs under the pinned node (v22.23.x).
- `combat-b/det-probe` (c392cc767, NOT for merge): trunk 4337cfe9b + probe/pitborn-diverge.mjs + a Linux reference; delete it after the Mac confirms #2436.
- Merged and done: finisher stack #2377-#2384, finisher compares 3 -> 0 (#2403), boss-slice reviews #2385/#2387/#2410/#2412. Finisher name compares on trunk: 0.
