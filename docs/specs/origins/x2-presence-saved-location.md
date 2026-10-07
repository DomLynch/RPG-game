# Origins — X2: presence starts a player where the server last saw them (plan)

Backend lane, 2026-10-07. **Status: plan, docs only, DRAFT; nothing built.** Gate X2 (Lead's ruling, owner Backend): *at join, presence starts the player at the server's saved location, never a client-reported first pose; a reconnect cannot pick a new spot. Test: reconnect with a forged pose lands at the saved spot.* X1 (Expansion: the writer derives a player's place from presence, PR #1571 is the read) and X2 must both close before trade or the smith opens to players. Each closes on its own PR.

## 1. The hole

`origins/presence/interest.ts` `World.join(account, now, friend?, at?)` takes the start position `at`, but the socket path in `server.ts` never passes one: the player is created at the zone centre with `placed = false`, and **the first pose the client sends places it** (`World.move`, the "known gap" comment). A client can therefore pick its spot on every connect. X1 reads that spot to decide "is this player at the Exchange"; until X2, the answer is whatever the client said first.

## 2. Principle

A position the server did not observe is never trusted. Presence's position for a player is either (a) a spawn the server chose, or (b) a position reached by moves that passed the speed clamp from a trusted start. The first client pose never places anyone.

## 3. Plan in two stages (each its own PR)

**Stage 1, presence only (Backend, no migration, no writer change).**
- A join without a known start is placed at the zone's **default spawn** (its entry gate; a constant per zone, never from the client) with `placed = true`, so every pose from the first one on goes through the speed clamp. The `placed = false` path is deleted.
- Presence remembers each account's last server-observed `{zone, x, z}` in memory for 10 minutes after the player leaves (an LRU of accounts, bounded). A reconnect inside that window starts there. Nothing in the memory comes from a client claim: it is the position the clamp had accepted.
- Test (the gate's): a player moves to A, disconnects, reconnects and sends a forged first pose at B (far, past the clamp): it is at A after the reconnect, and the forged pose is `snapped`/counted like any jump. Plus: a join with no memory starts at the default spawn whatever its first pose says; the memory expires; the memory is bounded.
- This closes the reconnect hole for the common case (a dropped connection) with no new moving part. It does not survive a presence restart or a long absence.

**Stage 2, persistence (split by owner).**
- *Writer side (Expansion proposed to own it; a class-1, origins-only column or table plus a writer op):* a saved location per character `{zone, x, z, updated_at}`. **It is written only from presence's observation**, never from a client body, or the hole moves one step back. When: presence reports on leave and on a 60 s checkpoint; the writer stores the latest.
- *Presence side (Backend):* on leave and every 60 s, `POST` the position to the writer's internal route (key and loopback, same pattern as `GET /internal/where` in #1571; fire-and-forget with a bounded queue, a failed post is retried once and then dropped: a stale save only costs the player a slightly old spot). At join with no in-memory position, presence **asks the writer** for the saved location (500 ms timeout, key + loopback); no answer, no row or any error: the default spawn. It never blocks a join on the writer and never falls back to a client pose.
- Tests: the Stage 1 test again after a simulated presence restart (memory cleared, saved location served by a fake writer); a down writer gives the default spawn; a forged pose never wins.

## 4. Open questions (need a ruling before Stage 2 is built)

1. **Presence has one zone; the world has several.** Presence models a single 300 m "town" square per layer. Concord's data has `pit-yard` (50 x 50 m) and `exchange` (40 x 50 m) as separate zones. "At the Exchange" is a zone (or a rectangle in a zone), not a point in the 300 m square, and `GET /internal/where` (#1571) returns no zone. X1 and X2 both need presence to know the zone a player is in. Who rules how zones map into presence (one presence world per zone, or a zone id on every player)?
2. **Account or character?** Presence identifies a player by account id only; a saved location belongs to a character, and an account can hold several. The join needs the character id from somewhere the client cannot forge (the writer validating the pair, or the writer pushing the active character to presence).
3. **Spawn constants.** The default spawn per zone (the Exchange's gate, the Pit's gate) is world content; Expansion/World should name it, and it must not be a spot inside the Exchange's trade area, or a fresh connect lands "at the Exchange".
4. **Window length.** 10 minutes of in-memory memory is Backend's guess. Longer means fewer saved-location reads; it does not change what is trusted.

## 5. What this does NOT solve

- A moving player can still walk anywhere the speed clamp allows (7 m/s x 1.5): presence trusts reported motion inside the clamp, the same cosmetic-layer trust as the rest of presence. X1/X2 only stop the client from *teleporting its starting point*. If a rule needs "was physically near X for N seconds", that is a further gate.
- Presence is still OFF behind its flag; none of this reaches players until it is switched on.

## 6. Order and ownership

X2 Stage 1 (Backend, one PR) can land any time after #1571; X2 Stage 2 needs the rulings in §4 and Expansion's writer half. Backend writes no migration for X2; if the saved location needs an ALTER of a live table it is class 2 and goes through the joint GO with Dom.
