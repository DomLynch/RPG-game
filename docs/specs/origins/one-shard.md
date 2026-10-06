# Origins — one shard (architecture note)

Backend lane, 2026-10-07, for Lead/Strategy (Dom's rule: **Origins is ONE SHARD, everyone in the same world**). Status: **design, nothing built, docs only**. Numbers marked *est.* are planning figures to be replaced by measured ones; vendor limits and prices were read from the vendor's public pages on 2026-10-07 and must be re-checked before Dom spends anything. Related: [duel-architecture.md](../../duel-architecture.md) (duels), [server-save-schema.md](server-save-schema.md) (persistent state), [trading.md](trading.md) (economy).

**Alignment caveat.** Expansion's Living World spec (`expansion/living-world`) was not on the remote when this was written, and the repo has no town-history-book spec yet. This note therefore *assumes*: (a) NPC routines and the world clock are deterministic and shared ([gothic-routines.md](gothic-routines.md)), (b) world events and the history book are global, written once, not per layer. If the Living World spec says otherwise, it wins and §5 changes.

## 1. One logical world

"One shard" means **one world id, one economy, one history, one set of accounts**. It does not mean one process.

- **Persistent state lives in one place:** Supabase Postgres, reached only through the writer (`origins/server`, class-1 migrations). Characters, items, the Exchange, standing, quest state and the history book are rows. Nothing in the world is stored per layer.
- **Ephemeral presence lives in memory on a new small service on our VPS** (the "presence service": who is where, facing which way, doing what). It is rebuilt from nothing after a restart: a page reconnects and re-announces itself. It writes no rows while players walk around.
- **The world clock is one wall-clock-derived value** (plus the shared seed), so every client and every layer places the same NPC at the same spot without being told. Only *changes* (a quest stage, an NPC's mood, a boss event) travel as events from the database.

## 2. Spatial interest management: you see and hear only nearby players

The presence service keeps a uniform grid over each zone (**16 m cells**, *est.*) and sends each client only the entities in the cells its radius touches.

| Thing | Rule (*est.*) |
|---|---|
| Visual radius | **40 m**. Beyond it a player does not exist for you. |
| Nearest-first cap | **40 other characters** drawn at once (client cost, see §4). The rest are culled; a crowd past the cap can show as ambient silhouettes, never as full characters. |
| Speech | **say** 20 m; **shout** 40 m with a cooldown. Nothing is heard from outside its radius. |
| Own position upload | **10 Hz**, quantised, only while moving or turning (idle = a 1 Hz heartbeat). |
| Position updates received | **10 Hz** under 12 m, **5 Hz** 12–25 m, **2 Hz** 25–40 m. The client interpolates (about 120 ms of delay hides it). |
| One entity update | about **12 bytes**: id (2), x, z (2 each, cm-grid inside the zone), heading (1), animation state (1), flags (1), tick (2), plus per-packet framing. |
| Packaging | one packet per client per 100 ms tick, not one message per entity. |

**What syncs:** position, heading, animation state, equipment appearance (a short hash; the client fetches the look once and caches it), name tag and guild tag, emotes, speech, "in a duel" / "trading" markers. **What does not:** combat (§3), inventory, stats and standing (read from the database on inspect, never pushed), NPCs (deterministic from the clock, §1), and anything outside your radius.

**Worst-case bandwidth at the §4 cap (*est.*):** 20 entities at 10 Hz and 20 at 5 Hz is about 20 × 12 × 10 + 20 × 12 × 5 = 3.6 KB/s, roughly **30 kbit/s down per client**, far under a mobile budget. Upload is under 1 KB/s.

**The server clamps what the client claims.** Position is client-reported (same trust model as the rest of the game's cosmetic layer), so the service clamps speed (at most about 7 m/s, *est.*, set from the sprint speed) and keeps positions inside the walkable zone. A client that teleports is snapped back and, repeated, dropped. Presence never decides anything that pays: gold, items, marks and rank come from the writer and the verifier, not from where a player stood.

## 3. Duels stay their own server-authoritative instances, as today

Nothing about duels changes ([duel-architecture.md](../../duel-architecture.md)). A challenge from town hands both players a room token; the duel is the existing rollback duel over WebRTC (VPS relay as the fallback), and **a result counts only after the verifier replays both records** (`scripts/verify-duels.mjs`, the `duel_records` path in progress). Interest management adds exactly three things at the edges:

- Both fighters leave interest management for the duration: their presence marker becomes "in a duel" at their last spot, they stop sending or receiving movement, and they return to the same spot when it ends.
- A duel needs both fighters in the **same layer** (§5), because a challenge is made in sight of the other player.
- A duel never loads the presence service: its traffic is peer to peer (or the relay), not the town's.

## 4. Town capacity: **100 players per town layer, soft limit 80**

The number comes from three budgets, each *est.* until measured; the tightest one sets it.

1. **Client render cost (the tightest).** A mid phone has to draw the town and up to 40 other animated, geared characters at a steady frame rate. That is the reason for the 40-entity cap, and 100 players in one 40 m radius is possible (a market square) while only the nearest 40 are drawn. Measure: 40 animated characters at 30 fps on the slowest test phone, before the cap is fixed.
2. **Server CPU and bandwidth.** 100 players at the §2 rates is about 1,000 packets/s and at worst about **3 Mbit/s out** per layer (100 clients × about 3.6 KB/s ≈ 360 KB/s ≈ 2.9 Mbit/s; typical is far lower because few players share one radius). One Node process should handle that well under one core (*est.*; measure with a synthetic load of 100 bots before trusting it). At that worst case a layer that is full around the clock moves about 930 GB a month (0.36 MB/s × 2.6 million s); check the VPS plan's included traffic.
3. **Social legibility.** Past about 100 in one town (*est.*) the square stops being readable and chat stops being useful whatever the technology does.

So: a layer accepts joins until **80** (soft), then new arrivals go to another layer; **100** is the hard stop for the rare friend-join. **Beta target: 3 layers, about 300 concurrent**, on the one VPS beside the writer, verifier and relay. The box has no spare capacity measured yet: the synthetic load test is part of the first build task, and the number above is replaced by what it shows.

## 5. Crowding fallback: overflow layers that still share the world

A **layer** is another presence instance of the same zone, in the same world. It shares everything that matters and separates only who you can see and hear.

| Shared by all layers (one copy, in the database) | Separate per layer (memory only) |
|---|---|
| Accounts, characters, inventories, standing | Who is standing where |
| **The economy:** the Exchange, shops, bank, trades | Chat, emotes, shouts |
| **The town history book** (written by events, shown identically in every layer) | The nearby-player list |
| NPC state, quest state, world and boss events (one global event state; the clock drives NPCs) | Duel challenges (same layer only) |

**Assignment on join:** the layer of your party leader or guild-mate who is online (so friends are never split by a crowd), otherwise **the fullest layer still under the soft limit** (fill first, so the town feels alive rather than ten empty copies), otherwise a **new layer**. A layer with no players for a few minutes is closed.

**Moving:** a "join friend" action moves you to a named player's layer (cooldown about 30 s, *est.*, so layer-hopping cannot be used to scout or dodge). Trades and duels need the same layer; the join action is how you get there.

**When every layer is at its hard stop** (past the box's budget): a queue with a visible position rather than a degraded town. That is a decision for Dom (see §7), not something to hide.

## 6. Cost and risk (where Supabase and realtime limits matter)

**Supabase Realtime is the wrong tool for presence, and this design does not use it for movement.** Plan limits read on 2026-10-07 (re-check): Free 200 concurrent connections and 100 messages/s; Pro 500 connections and 500 messages/s; Team 10,000 connections and 2,500 messages/s (Pro with the spend cap off gets the Team limits); presence messages 20 / 50 / 1,000 per second; monthly messages included 2 M (Free) and 5 M (Pro and Team); overage about $2.50 per million messages and $10 per thousand extra peak connections. One layer at the §2 rates is about 1,000 inbound messages/s *before* any fan-out, which already exceeds Pro's cap and, at 1,000 messages/s, burns Pro's 5 M monthly quota in about 1.4 hours; the vendor counts a broadcast as one sent message plus one per subscribed client that receives it (one broadcast to 4 clients = 5 messages), so a delivered-message count would be tens of thousands per second, or hundreds of dollars an hour. The duel note reached the same verdict for duel packets ([duel-architecture.md](../../duel-architecture.md) §4). Realtime stays available for **low-rate** pushes only (a new history-book entry, an Exchange sale), at well under one message a second per client.

| Risk | Note |
|---|---|
| **Database load** | Presence writes nothing. The database sees a character load at join, a save at leave and every real action (the writer's batches). The writer already has caps per account; the presence service adds none to the database on its own. |
| **Single point of failure** | One VPS in Germany runs presence, the writer, the verifier and the relay. A restart empties every layer (players reconnect on their own, nothing is lost: state is in the database), but the box's load must be watched (heavy jobs already run there). Splitting presence off to its own small host is the first scaling step, not a redesign. |
| **Latency** | A player in Dubai or South-East Asia is about 150–200 ms from Germany (*est.*, from the duel note's far-test plan). That is fine for 10 Hz presence with interpolation, and does not touch duels (peer to peer). |
| **Griefing in crowds** | Mute and block lists, a report button, rate limits on shout. Open-text chat within 20 m is a moderation load: a decision for Dom whether v1 has free text or only emotes and presets. |
| **Interest bugs** | The worst failure is an invisible or ghost player. A test in the first build drives bots across cell borders and checks that each pair that should see each other does, in both directions. |
| **Cheating** | Position and emotes are cosmetic and clamped (§2); anything of value is decided by the writer or the verifier, so a forged position gains nothing. |
| **Cost** | The VPS is already paid for. Added cost is CPU and traffic on it, plus the cost of a second host if the load test says the box cannot hold three layers. No vendor message pricing applies to movement. |

## 7. Decisions needed and the first build step

- **Dom/Strategy:** (1) free text chat or presets and emotes only in v1; (2) a queue or a hard "world full" message when every layer is full; (3) whether a layer may be chosen by the player or only by the join rules above.
- **Expansion/Lead:** confirm the Living World spec keeps the history book, world events and NPC state global (§1, §5).
- **First build (small, measure-first, no player-facing change):** a presence service skeleton behind a flag that is off, a 100-bot synthetic load test on the VPS reporting CPU, packets/s and bytes/s per layer, and the 40-character render test on the slowest phone. Those two measurements replace every *est.* in §4.
