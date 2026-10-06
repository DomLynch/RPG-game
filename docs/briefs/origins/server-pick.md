# Shared-world server pick (ruling 6) — Lead Dev (Expansion), 2026-10-06

**Recommendation: a lean Node server of our own (`ws` plus a small room layer we write), built on World of ClaudeCraft's hardening patterns, not Colyseus.** Keep it in the RPG-game repo for now, deployed as its own service.

## The choice

| | Lean Node on ClaudeCraft's patterns | Colyseus 0.18 (MIT) |
|---|---|---|
| Sim authority | We step our own pure TypeScript sim at our own rate. The duel already runs a deterministic 60 Hz step that lives in the browser and can run unchanged on the server ("one sim, several hosts", which is ClaudeCraft's own model). | Rooms run a simulation interval we set, but state goes out through Colyseus' schema classes, a second state model beside our sim state that must be kept in step. |
| State sync | Per-client snapshots scoped by interest radius, as ClaudeCraft does (JSON at 20 Hz with wire caches). Binary or delta encoding can come later if O5 measurements need it. | Binary delta patches out of the box. This is its strongest point, and a real saving if bandwidth turns out to bind. |
| Rooms, matchmaking, reconnect | We write them: hub, region, instance and event rooms with a single-use handoff and an ownership epoch (blueprint §4). Estimate 1–2k lines. Pure join planning and link-dead grace come from ClaudeCraft (`linkdead`, 84 lines). | Built in: room lifecycle, matchmaker, `allowReconnection`. Saves the 1–2k lines. |
| Security edge | ClaudeCraft's MIT one-file units, adopted with notices: frame/byte gate before `JSON.parse`, per-class message lanes, 16 KiB max payload, outbound backpressure kill, stall-aware keepalive, admission cap with an in-flight counter, character lease with nonce fencing, serial-writer FIFO, compensate-only-on-proven-rollback. | Some of these exist, others we would add as middleware anyway. |
| Auth | Supabase JWT verified in the first frame within a deadline (JWKS, issuer, audience, expiry), with the lease taken before join. ClaudeCraft stores bearer tokens in plaintext; we don't (Supabase issues our tokens). | `onAuth` hook; same Supabase verification code either way. |
| Dependencies | `ws` plus `pg`/Supabase client. AGENTS.md allows no new runtime dependency without a demonstrated need. | Core plus its driver, presence and transport packages. Still 0.x: minor versions have broken APIs before, so every upgrade is our migration. |
| Scale-out | One process per realm/shard first; zone handoff later through the epoch handoff we already need for anti-dupe. | Redis presence/driver for multi-process rooms, available but not needed at beta scale. |

**Why lean wins for Frankendom.** Our hard requirements are deterministic combat parity with the browser, server-verified economy and progression, and no duplicate authorities (blueprint §4, §8; ruling 7). All three sit in our own sim and transaction code, not in the transport. Colyseus mostly buys matchmaking and delta sync. The first is small at our scale, and the second we can add later behind one interface. Its schema layer would be a second state model to keep in step with the sim, which is exactly the "duplicate authority" risk the blueprint warns against. ClaudeCraft gives us the parts that are hard to get right (abuse gates, leases, ordered saves, proven-rollback compensation) as small MIT files with tests, and it has run them in production.

**What would change my mind.** If the O5 four-player test shows bandwidth or room-lifecycle code is the bottleneck, adopt `@colyseus/schema` alone for encoding, or move rooms onto Colyseus. The room interface is kept narrow so either swap is contained.

## Does the shared-world server deserve its own repo?

**Not yet: same repo, separate service.** The server imports the same pure modules the browser runs: the duel sim, combat rules, content schemas and the O1 contracts. In one repo, one commit changes both sides and the existing determinism and replay gates cover the server too. Split repos would need a published shared package, and browser/server sim version skew becomes a new class of desync bug.

Keep the separation that matters:
- its own folder (`server/`) with its own build and entry point;
- its own deploy (a systemd service, never inside `/var/www/frankendom`);
- the main game build never imports server code (a lint boundary like the sim's).

**Split when:** the server needs a different release cadence or owner, CI time for one side starts blocking the other, or licence isolation is needed. Clean-room implementer code is ours, so licence does not force a split today.

## Next
O1 contracts (Character, Faction, Quest, Region, Encounter, ItemDefinition/Instance, LootTable, and the one-progression proposal) come before any server code. The server skeleton (auth handshake, lease, hub room, gates) starts with O3, after the beta.
