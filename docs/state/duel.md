# Duel (real-player PvP experiment) — project state

Lane opened 2026-09-29 18:4x +04 by Strategy on Dom's order (real player matching, "we did it with Pixel FPS"). Reports to Lead. Append new entries at the TOP with evidence and remaining validation (AGENTS.md).

## Now — the brief, as of 2026-09-29 18:4x +04 (restart brief; replace wholesale)

**The question you exist to answer.** Can two real players sword-duel live on phones and have it feel right? This is a TIME-BOXED EXPERIMENT (target one week of lane time), not a feature build. The Pit does not depend on it.

**What we have.** The duel is a fixed-tick step (`stepDuel` in `src/duel.ts`); the AI (`src/ai.ts`) only emits ordinary Intents judged by the same rules as the player; sim math is deterministic across browser and Node since v20 (release row 48). That is a good foundation, not proof.

**What is NOT solved by swapping AI intents for network intents (prove each one):**
1. Cross-device determinism in live play (iOS Safari vs Android Chrome), not just recorded replays.
2. Latency: input delay and/or prediction + rollback (GGPO-style predict and replay).
3. Desync detection and recovery (state hash per N ticks, what happens on mismatch).
4. Trusted results: a hosted transport (Supabase Realtime or a game relay) moves packets; it does not validate wins or stop cheating. Decide who is authoritative.
5. Disconnects and rematch.

**Rules.**
- Do NOT widen parry/counter windows as the first answer to latency. Measure first; feel is the judge.
- Own branch, own module (`src/net/` or similar); zero change to single-player fight feel or release rows. Nothing in the fight imports the net code except through one switch.
- Default transport: what we already run (Supabase) unless measurement shows it can't hold; name any new service and its cost before using it.
- Estimates (Strategy's rough 2,000–2,500 lines for full PvP) are prototype guesses, not commitments.

**Deliverable.** Two phones, one challenge link, a real duel. A short report with measured numbers: round-trip time (same city, Dubai↔SEA), input delay used, rollbacks per minute, desyncs, and Dom's own verdict on feel after playing it. Then a go/no-go recommendation and a real estimate for the full build.

**Box.** Use the Mac only through Lead's slot rule (one heavy lane at a time, load < 15). Phone tests need Dom plus a second phone; ask Lead to book the time with Dom.

## Done
(nothing yet)

## Open
- Needs a second phone and a second person for the far-apart test.

## Gotchas
- iCloud Desktop sync stays ON (Dom); check load before any browser run.
