# Duel (real-player PvP) — project state

Lane opened 2026-09-29 18:4x +04 by Strategy on Dom's order (real player matching, "we did it with Pixel FPS"). Reports to Lead. Append new entries at the TOP with evidence and remaining validation (AGENTS.md).

## Now — the brief, as of 2026-09-29 19:0x +04 (restart brief; replace wholesale)

**Mission (Dom, 19:0x): build real-player PvP for PERMANENT, not a test.** "We will get this working, it's critical to the game's success; we are a Diablo / Path of Exile 2 killer." Live sword duels between real players, worldwide, on phones and desktop. Failure is not an outcome; the only question is how, and in what order.

**What we have.** The duel is a fixed-tick step (`stepDuel` in `src/duel.ts`); the AI (`src/ai.ts`) only emits ordinary Intents judged by the same rules as the player; sim math is deterministic across browser and Node since v20 (release row 48). A good foundation, not proof.

**What must be solved (each one proven with a test and a measured number, not assumed):**
1. Cross-device determinism in live play (iOS Safari vs Android Chrome vs desktop), not only recorded replays.
2. Latency: input delay and/or prediction + rollback (GGPO-style predict and replay), tuned so parries and counters still feel right.
3. Desync detection and recovery (state hash every N ticks; a defined outcome on mismatch).
4. Trusted results: a hosted transport moves packets; it does not validate wins or stop cheating. Decide the authority model (e.g. server-side replay of both input streams with the Node sim) before results touch marks or loot.
5. Matchmaking (rank-based queue), challenge links (from the Pit and from share links), disconnects, reconnect, rematch.
6. Regions: ANY city to any city. No player is restricted by where they live; route through the nearest relay/region and show the connection quality honestly.

**Rules.**
- Do NOT widen parry/counter windows as the first answer to latency. Measure first; feel is the judge.
- Own module (`src/net/` or similar); single-player fight feel and release rows unchanged. Nothing in the fight imports the net code except through one switch.
- Transport: start with what we run (Supabase) if it holds; if it can't, name the service and its monthly cost before adopting it.
- Ship in stages, each live and usable: (a) friend challenge by link, two real players, (b) rank matchmaking, (c) results count toward marks once the authority model is proven.

**First deliverables.**
1. A one-page architecture to Lead: transport and cost, authority model, net-code layout, the rollback/input-delay approach, how determinism is tested across devices.
2. The first live duel between two phones by challenge link, with measured round-trip time, input delay, rollbacks per minute and desyncs, near and far apart. Dom plays it and judges feel.
3. Then the staged build above.

**Box.** Mac time only through Lead's slot rule (one heavy lane at a time, load < 15). Phone tests need Dom plus a second phone/person; ask Lead to book them with Dom.

## Done
(nothing yet)

## Open
- A second phone and a second person for far-apart tests.

## Gotchas
- iCloud Desktop sync stays ON (Dom); check load before any browser run.
