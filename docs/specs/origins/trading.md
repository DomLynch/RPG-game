# Origins trading spec: barter trade, trade-limited items, bound metals, anti-dupe, RMT limits (DESIGN ONLY)

Expansion lane, 2026-10-06, written against trunk `256114d9`. For Strategy, Lead and the Auditor. **Nothing here is built and no
migration exists for it.** Every claim about current code cites `file:line` at that sha. Numbers marked **PROPOSED** are starting values
for Strategy to move. Anything not known is marked **OPEN**. Clean room: written from our own code, the blueprint and the analyst specs
in this folder (`modernuo-secure-trade.md`, `modernuo-bank.md`), never from donor source.

**The recommended design in one paragraph.** Players trade by **barter only**: items for items, through the existing escrow and
double-accept flow. There is **no player-tradeable currency**. Only **trade-limited items** change hands: earned gear (rare and up, plus
Pit pieces) may change hands **at most 2 times**, then binds to its third owner. Materials, stackables and consumables are bound, so no
item can work as money. NPC services may later cost **metals** (bronze, silver, gold), an account-bound balance earned by play that can never be traded. Dom is
the only seller for real money: cosmetics and membership convenience, always bound, never random, never stats. Discovery after beta is a
**barter board** (want/offer listings, no prices), not a priced market. This is Dom's direction with Strategy's view (2026-10-06).

Standing rulings this spec follows (Dom/Strategy/Lead, 2026-10-05/06):

| # | Ruling | Where it lands here |
|---|---|---|
| R1 | Pit pieces are tradeable. Provenance travels. One of each per account, enforced by the DB index. Trade only at the Exchange. Rank is needed to equip, not to own. | §2, §4 |
| R2 | Re-winnable once sold is a **PROPOSAL**, not a ruling. | §2.11, §7 |
| R3 | No same-device trade. Bot trade is a preview test harness only. | §2.8, §5 |
| R4 | Crafting is out. The smith upgrades with materials only for now; the coin cost stays as data set to 0 (#1461). | §3 |
| R5 | Income per Pit win is TODO(Stats/Strategy), placeholder 20 x tier. Under this design it pays bound metals, not coin. | §3.3 |
| R6 | The marketplace is after beta. Phase 1 is direct player-to-player trade. | §1 |
| R7 | Additive Origins-only migration = class 1 (Strategy+Lead GO, down-script, branch-DB test, Auditor probes). ALTER/DROP/backfill of a live table = class 2 (Dom's yes at the sha). | §6 |
| R8 | Server-authoritative: the client never names an account, an amount it is owed, or a reward. | §2.9 |
| R9 | Barter only, no tradeable currency; trade-limited items (2 hand changes, then bound); stackables bound; NPC costs in bound metals; cash sales bound, cosmetic or convenience, never random (Dom + Strategy, 2026-10-06). | whole doc |

---

## 1. Scope and phases

| Phase | When | What | Not in it |
|---|---|---|---|
| **1. Direct barter** | Beta, behind the Origins flag | Two players at the Concord Exchange: offer, change, double accept, settle or cancel. Items for items, one or more each side. Only trade-limited items (§2.10). | Currency of any kind, gifts (D4), listings, mail, NPC buy/sell, cross-region trade. |
| **2. Barter board** | After beta (R6) | Want/offer listings, item for item, **no prices**. Multi-item offers and "any of these" offers. Every match settles as a phase-1 trade. | Priced listings, auctions, buy orders. |

### 1.1 Phase 2 barter board (sketch, not for build)

- A listing names what the lister **offers** (one or more of their own trade-limited pieces) and what they **want**: a list of definitions,
  either **all of** (multi-item) or **any of these** (the first one a responder offers satisfies it).
- Listings hold no escrow. A response opens an ordinary phase-1 trade between the two players with the listed pieces pre-offered, so the
  double accept, escrow, trade limit and every §4 invariant apply unchanged. A listing can never settle by itself.
- A listing is withdrawn automatically when a listed piece leaves the lister, binds, or is offered elsewhere.
- New needs, all OPEN until phase 2 is scheduled: a listing table, browse/search reads, a cap on live listings per account (PROPOSED **10**),
  expiry (PROPOSED **7 days**), and whether a listing shows to players who cannot reach the Exchange.
- Why no prices: with no currency there is nothing to price in, and a priced board would invite an off-site currency to fill the gap.

---

## 2. Phase 1 trade flow

### 2.1 What exists today

| Piece | Where | What it does |
|---|---|---|
| `Trade` contract | `origins/contracts/economy.ts:36-46` | Escrow container id, region, `version`, two sides `{character, account, offered[], accepted}`. At most 16 pieces a side (`MAX_OFFER`, `:37`). No currency field. |
| `parseTrade` | `economy.ts:48-73` | Refuses two sides on one account (`:67`), both sides empty (`:68`), one piece offered twice (`:70`). Allows a gift (one empty side, `:68`). |
| `changeOffer` | `economy.ts:88-100` | Needs the current `version`; clears **both** accepts and bumps the version (`:98-99`). Refuses a repeat or a piece the other side already offers (`:93-97`). |
| `acceptTrade` | `economy.ts:103-109` | Accepts at a named version; a stale accept is refused (`:104`). Does not bump the version. |
| `settleTrade` | `economy.ts:116-170` | Exchange only (`:121`); both accepted and sides on the right accounts (`:122-125`); no stray item in the escrow (`:134-138`); each offered piece is in this escrow from that side (`:152`); bound or story-critical refused (`:155`); fills the receiver's **real** free pack slots via `packSizeOf` (`:143-159`); appends a `trade` history entry, provenance untouched (`:160`); re-checks one-of-each on the end state (`:166-168`). All or nothing. |
| Inventory wrapper | `origins/inventory/inventory.ts:439-447` | Calls `settleTrade` with each side's real `packSize` (`:441`). Tested: a nearly full pack refuses with both states unchanged (`inventory.test.ts:239-249`). |
| DB table | `202610060001_origins_save.sql:146-154` | `origins_trades (container pk, side_a, side_b, state open/settled/cancelled, created_at, settled_at)`. No version, accepts, expiry or region columns. |
| DB functions | `0001:484-510` | `origins_open_trade` (both accounts allowed, inserts the row), `origins_settle_trade` and `origins_cancel_trade` (lock the open row `for update`, run the writer's batch over both accounts through `origins_apply`, set the state). |
| Escrow placement | `0001:120`, `0001:231` | An escrowed row has `loc_container` + `loc_from`; its `holder_account` stays the offerer's, so one-of-each still counts it for the offerer. |

### 2.2 Finding: the receiver's free slots do NOT overflow back to the sender

The brief and `server-save-schema.md:76` say the overflow "goes back to the sender". **The code does not do that.** `settleTrade` refuses the
whole trade when the receiver's pack is full (`economy.ts:158`, comment `:114-115` "no partial trade, no spill onto the floor"), and tests
pin it (`economy.test.ts:113-116`, `inventory.test.ts:239-249`). This spec keeps the code's rule: **a trade that does not fit is refused
whole, both accepts are cleared, and the trade stays open** so the receiver can make room or cancel. A partial settle would break "an accept
means the offer on screen" (`economy.ts:87`). D2 asks Strategy to confirm and to correct `server-save-schema.md:76`.

### 2.3 States

```
                 open_trade                  change_offer (either side; clears BOTH accepts, version+1)
   [none] ─────────────────────▶ [open A✗ B✗ v] ◀─────────────────────────────────────────┐
                                     │ accept(v) by one side                                │
                                     ▼                                                      │
                               [open A✓ B✗ v] ──────────────────────────────────────────────┘
                                     │ accept(v) by the other side
                                     ▼
                       settle in the same request (§2.6)
                          ├─ refused (full pack, one-of-each, trade limit, stale item) → [open A✗ B✗ v+1], reason shown
                          └─ committed → [settled]
   cancel by either side / expiry / a side erased / heartbeat timeout → [cancelled], escrow returned
```

Terminal states are `settled` and `cancelled` (`0001:150`). A terminal trade never reopens: settle and cancel both select
`state = 'open' for update` and refuse otherwise (`0001:493-494`, `0001:504-505`).

### 2.4 Who may change what

| Action | Who | Rule |
|---|---|---|
| Open | Either player, at the Exchange | Two different accounts (`economy.ts:67`; **not** checked by `origins_open_trade` today, `0001:484-489`, so 0003 adds it). One open trade per character and per account (PROPOSED; UO refuses a second trade, `modernuo-secure-trade.md:155`). |
| Change offer | Only the side's own character, only its own pieces | `changeOffer` refuses a character not in the trade (`economy.ts:91`). Nobody can add to or remove from the other side's offer. Pieces enter escrow from the pack or (at the Exchange) the bank, never worn (`inventory.ts:255`). |
| Accept | Each side for itself, at the version it saw | `acceptTrade` (`economy.ts:103-109`). |
| Withdraw an accept | Each side for itself | Not in the contract today. PROPOSED: `accept` takes `accepted: boolean`, like UO's toggle (`modernuo-secure-trade.md:92`). No version bump. |
| Cancel | Either side, any time before settle | Escrow goes back to each offerer. |

**The double-accept rule.** Any offer change on either side clears both accepts and bumps `version` (`economy.ts:98-99`). An accept names
the version (`economy.ts:104`). A settle can only ever move the exact offer both players last saw.

### 2.5 Timeouts, expiry, cancel, disconnect

| Event | Rule (PROPOSED numbers) |
|---|---|
| Idle expiry | An open trade with no change or accept for **5 minutes** is cancelled. |
| Hard expiry | Any open trade older than **20 minutes** is cancelled. |
| How expiry runs | Lazily: every trade op first cancels an expired trade it touches. Plus a writer sweep every **60 s** (`origins_expire_trades`, §6). |
| Disconnect | The writer is a stateless HTTP service (`origins/server/server.ts:19-39`); it cannot see a socket drop. The trade screen calls `trade_status` every **10 s**; a side silent for **45 s** cancels the trade. Blueprint `:195`: a disconnect "either cancel[s] an uncommitted trade or return[s] the already-committed receipt". **OPEN:** once the Exchange runs on the shared-world server (blueprint `:136`, O3 `:270`), presence comes from that runtime instead. |
| Leaving the Exchange | Cancels (UO's equivalent is moving apart, `modernuo-secure-trade.md:110`). **OPEN:** needs the hub runtime to report region exits. |
| A side erased | Already handled: the side becomes null (`0001:148-149`), settle refuses (`0001:495`), cancel releases the survivor's escrow (`0001:501-510`); tested in `scripts/origins-database-check.mjs:262-275`. |
| Cancel return slot | Each piece goes to the offerer's first free pack slot, then the first free bank slot (the trade is at the Exchange, where the bank opens, `inventory.ts:43`). **OPEN:** if both are full. Recommendation: refuse an offer the offerer could not take back if the trade failed (UO's rule, `modernuo-secure-trade.md:76-77`), and re-check at cancel. |

A cancel or expiry writes **no** history entry, so it never counts toward the trade limit (§2.10).

### 2.6 Escrow and settle

1. **Offering a piece** moves its row into escrow: `put` with `loc = {kind: 'trade-escrow', container, from}` through `origins_commit` for
   the offerer's account (as `scripts/origins-database-check.mjs:263` does). Version compare-and-bump (`0001:398`); `holder_account` stays
   the offerer's (`0001:231`). Withdrawing a piece is the reverse `put`.
2. **Settle** runs when the second accept lands, in the same request. The writer reads both accounts' full holdings (`origins_open`,
   `0001:340`), runs `settleTrade` with `packSizeOf = origins_characters.pack_slots` (`0001:29`), and sends the moved instances as `put` ops
   (with `history_append` and, on a piece's second trade, `bound_to`, `0001:403`) plus one `trade` event per account to
   `origins_settle_trade` (`0001:490-500`). One transaction: any failure aborts all of it.
3. **Holdings must be account-wide.** `settleTrade` asks for "every instance either player holds" (`economy.ts:111-112`), but the inventory
   wrapper passes only the two characters' items (`inventory.ts:441`). The DB index catches what the pure check misses (`0001:132`), so this
   is safe, but the writer should pass the whole account so a refusal is a clear rule message, not a `23505`.

### 2.7 Finding: a same-definition swap is refused by the database

Swapping two copies of the same single-copy piece (a +0 helm for a +3 helm) is valid in the pure end state, which `settleTrade` checks
after all moves (`economy.ts:166-167`). In the database it fails: `origins_items_one_of_each` is a unique **index** (`0001:132`), which
Postgres checks per row, not at commit, so whichever helm moves first gives its receiver two for a moment and the batch aborts. There is no
neutral parking location (a live row must have a `loc_kind`, `0001:125`). Recommendation (D10): accept the refusal for phase 1 and pre-check
it at `change_offer` with a clear message. A deferrable form needs a unique constraint, which cannot be partial, so it is a redesign.
**Update (Backend, 2026-10-06):** 0003 replaces the index with a deferred check at commit (§6.3, M17), after which the swap settles; D10 is
then superseded (Strategy confirmed 2026-10-06; conditions in decision 10).

### 2.8 Exchange only, and no same-device trade

**Exchange only.** `settleTrade` refuses any region but `region:concord-exchange` (`economy.ts:31`, `:121`). The DB does not know the region
(`0001:146-154`). The writer must derive the region from the server's own record of where each character stands, never from the request.
**OPEN:** there is no server-side position record until the Exchange hub runs on the shared server, so the writer cannot yet verify "at the
Exchange" and player trade cannot open until it can (the preview may use a fixed region). The Exchange opens at Gladiator (blueprint `:8`),
so Exchange-only already implies Gladiator rank.

**No same-device trade (R3).** What the writer can see, and its limits:

| Signal | How the server gets it | Spoofable? | Use |
|---|---|---|---|
| Account | The token, verified by Supabase Auth (`origins/server/auth.ts:7-15`) | No | Two sides on one account: refused (`economy.ts:67`). |
| Auth session | Supabase access tokens carry a session id claim; the writer reads only the user id today (`auth.ts:12`). **OPEN:** confirm and read it. | No (server-issued) | Same session on both sides: refuse. |
| Device id | A random id the client keeps locally and sends with each trade op | Yes (clear storage, second browser) | Same device id on both sides: refuse. Starts the new-device cooldown (§5.4). |
| IP | nginx in front of the writer (`server.ts:2`) forwards the client address. **OPEN:** which header. | Partly (VPN, carrier NAT) | Same IP: **allow but flag**, count toward caps. Households and carrier NAT share IPs. |
| User agent family | Request header | Yes | Audit only. |

**Limits, said plainly:** one person with two accounts on two real devices on different networks passes every check. The device rule stops
casual self-trade, not a determined mule. The backstops are the trade limit, the caps, the flags and review (§5). Signals are stored hashed.

**Bot trade (R3).** A bot counterparty exists only in the preview build as a test harness (no such code exists yet). The writer refuses any
trade where either side is not an `origins_characters` row of an allowed account (`origins_open_trade` already checks both, `0001:486`).

### 2.9 Writer ops

The op registry is `origins/server/handlers.ts:41`. A handler gets the token's account and a JSON body, never an account from the body
(`handlers.ts:1-2`). Bodies are capped at 64 KB (`server.ts:8`). Every trade op carries an `op_id` (a client nonce matching
`MINT_KEY_PATTERN`, `origins/contracts/core.ts:266`, as `UpgradeRequest.idempotencyKey` does, `economy.ts:267`). The writer turns it into a
server-side event id `trade:<character>:<op_id>`, the pattern `202610060002_origins_spend.sql:5` uses for burns and upgrades.

| Op | Request (all the client sends) | What the server derives and checks |
|---|---|---|
| `open_trade` | `{op_id, character, with}`, `with` = the other character's public `pc:` id seen in the hub | Caller owns `character`; `with` exists and is allowed; different accounts; neither character nor account in another open trade; both at the Exchange; gates and caps (§5); device rule (§2.8). Derives the container id (`container:trade-<uuid>`), both accounts, `expires_at`. Calls `origins_open_trade`. Returns `{trade, version: 0}`. |
| `change_offer` | `{op_id, trade, character, offered: inst[], expected_version}` | Caller owns `character` and it is a side; version matches; each id is the caller's, **tradeable** (§2.10: trade-limited, under its limit, unbound, not stackable), not worn, not story-critical, at most 16 (`economy.ts:37`), not offered by the other side (`economy.ts:95-97`). Pre-checks the receiver's free slots and one-of-each (advisory; settle re-checks). Builds the escrow in/out `put`s. Version+1, both accepts cleared. |
| `accept` | `{op_id, trade, character, expected_version, accepted}` | Caller owns a side; version matches. If both now accepted: settle in this request (§2.6). Returns `{state, version}` or the settle receipt. |
| `cancel` | `{op_id, trade, character}` | Caller owns a side. Builds the return `put`s (§2.5). Calls `origins_cancel_trade`. |
| `trade_status` | `{trade, character}` (read) | Both offers as public item views (definition, tier, upgrade level, provenance, history, **hand changes left**), both accepts, version, expiry. The client cannot read the other side's escrow itself: item RLS shows only its own rows (`0001:297`) and `origins_trades` has no client policy (`0001:301`). Doubles as the heartbeat. |

The client never sends: an account, a region, a receiver slot, a binding, a history entry or a trade count.

### 2.10 What can be traded: trade-limited items

**Rule (R9, recommended).** A piece is tradeable only if all hold:

| Test | Source today |
|---|---|
| It is earned **gear** of rarity **rare or relic**, or a **Pit piece** (`arena-award` or `legacy-unlock` provenance), see D5 | `Category` (`items.ts:34`), `RARITIES` (`items.ts:37`), provenance kinds (`items.ts:142-148`) |
| It is single-copy (stack 1). Every stackable (ore, materials, consumables) is untradeable. | `stack` on the definition (`items.ts:101`) |
| It is unbound and not story-critical | `economy.ts:155`, `items.ts:102` |
| It has changed hands **fewer than 2 times** | Its `trade` history entries (`items.ts:153`) |
| It is not a cash-shop item or a creator-minted cosmetic | `creator-mint` is cosmetics only (`items.ts:412`); cash items are always bound (§5.8) |

**Why the Pit-piece clause.** The only Pit piece in the fixtures is rarity `common` (`origins/contracts/fixtures.ts:11`). A strict
"rare and up" rule would make every common Pit piece untradeable, which contradicts R1. **OPEN:** legacy loot rarities are not set in live
content yet. D5 asks Strategy which wins.

**Hand changes.** A settled trade moves a piece to a new owner and appends one `trade` entry (`economy.ts:160`). Count = the number of
`trade` entries in its history. Owner 1 earns it; trade 1 makes owner 2; trade 2 makes owner 3, and **that settle binds it to owner 3**
(`bound_to` set in the same `put`, `0001:403`). A bound piece is then refused by every trade path (`economy.ts:155`, `inventory.ts:260`). A
third trade is impossible.

**Where the count lives: options.**

| Option | How | For | Against |
|---|---|---|---|
| **A. Derive from history** | Count `trade` entries in `history`. History is append-only and checked by trigger (`0001:220-223`), so the count can never fall. | One source of truth; no new column; already survives split (the child copies `history`, `0001:418`) and escrow/cancel (no entry is written). | A reversal written as a `trade` entry would count; a JSON count in a trigger is a small cost per row (history max 1,000 entries, `items.ts:357`). |
| **B. Counter column** | `trade_count int` on `origins_items`, raised by trigger when a `trade` entry is appended. | Cheap to index and read. | A second record of the same fact that can drift from history; ALTER of an Origins table (§6 class note). |

**Recommendation: A**, enforced in the DB by the 0003 trigger (M9): on an update that appends a `trade` entry, count the entries; refuse if
the count would pass 2; require `bound_to` to name the new owner when it reaches 2. Reversals (§5.7) use a new history kind `reversal` (a
contract change to `HistoryEntry`, `items.ts:152-155`) so they never count. Binding is to the **character** (the existing `boundTo` field,
`items.ts:167`), which keeps it off the account vault (`items.ts:402-410`); binding to the account instead is D6.

Upgrades keep working on a bound piece (`performUpgrade` checks the owner, not the binding, `economy.ts:365`).

### 2.11 Pit pieces and re-winning (R1, R2)

- Pit pieces carry no binding at mint: a legacy loot definition must be `binding: 'none'` (`items.ts:107-110`). Arena-award provenance names
  the winner, legend, rank and claim (`items.ts:141-143`) and is fixed at mint (`0001:217-218`). History only grows (`0001:220-223`).
- Owning is not wearing: `equipItem` checks the wearer's verified rank against the piece's effective tier (`items.ts:459-471`). A trade
  never checks the receiver's rank.
- **PROPOSAL (R2), not a ruling: re-winnable once sold.** Facts that bound it: one-of-each only blocks holding two at once (`0001:132`); a
  `legacy-unlock` mint key is fixed per account and loot id (`items.ts:339`), so it can never be minted twice (`0001:104`); an `arena-award`
  is keyed by claim (`items.ts:143`), so a fresh win can mint a fresh copy. **OPEN:** whether the Pit would award a piece the player once
  owned depends on today's award logic (the `owned` collection set, `ids.ts:12`), a live system. Risk: win, trade, re-win is an unlimited
  supply of one legend's piece per account, the raw material of a gear-selling farm. The 2-hand limit bounds each copy, not the supply.

---

## 3. Currency: no tradeable coin; bound metals for NPC services

### 3.1 Considered and rejected: a player-tradeable coin

The first draft of this spec designed a tradeable coin. **Rejected** (Dom + Strategy, 2026-10-06), for these reasons:

1. **It is the RMT product.** A tradeable currency is what off-site gold sellers sell. Without one, they must sell items or accounts, both
   harder to farm, move and hide.
2. **It turns every item into a price.** With coin, every trade can be laundering (a cheap piece for a lot of coin). Barter without
   currency makes value transfer visible: what moved is in the item history.
3. **It needs a whole economy to balance.** Faucets, sinks, inflation control, fees and transfer caps, for a duel game whose product is the
   ladder.
4. **Option B (coin as an item stack) does not work as built anyway.** Stacks merge only within one mint family (`inventory.ts:376-378`),
   a stack is capped at 9,999 (`items.ts:49`, `0001:93`), and coin would fill pack slots.

What stays from that work: the contract already caps a balance (`MAX_COIN`, `economy.ts:210`) and the smith already takes and returns a
balance (`economy.ts:340`, `:381`, `:413`). Those hooks serve bound metals below.

### 3.2 Metals: the bound NPC currency (later)

**Strategy's view (2026-10-06), replacing the working name "tribute":** the bound NPC currency is **metals**, in three denominations:
**100 bronze = 1 silver, 100 silver = 1 gold.** The balance is one integer in **bronze** (the smallest unit); silver and gold are display
only, so there is no conversion step and no rounding. `MAX_COIN` (`economy.ts:210`, 1,000,000,000) caps it at 100,000 gold.

Metals are earned by play, spent at NPCs, and **can never be traded, gifted, listed or sold for cash.** No trade op takes them (§2.9) and the
trade contract has no currency field (`economy.ts:38`). They are not needed at beta: the smith stays materials-only (R4).

**Where it would live (option for 0003, not needed for phase 1):**

| Option | How | For | Against |
|---|---|---|---|
| **A. Column on `origins_career`** | `metal_bronze bigint` on the one-per-account row (`0001:52-62`), written by `career_set` | Smallest change. Per account like career, under its version lock (`0001:197`). | ALTER of an Origins table. `career_set` rewrites the whole row (`0001:443-444`), so every spend races every career change. No per-change record: earn and spend cannot be audited or reversed line by line. |
| **B. Balance table + append-only ledger** | `origins_metal (account pk, bronze, version)` + `origins_metal_ledger (account, delta_bronze, reason, event_id, at)`, a deferred trigger checking balance = sum of ledger (the item-ledger shape, `0001:136-144`, `:256-269`) | Every change has a reason and an event: faucets and sinks are one query (blueprint `:203`), reversal is auditable, conservation holds in the DB. Purely additive. | Two tables and one `origins_apply` op. |

**Recommendation: B**, when metals are built. No transfer reason exists in its ledger, so the DB itself cannot move metal between accounts.

### 3.3 Metal sources and sinks (when built)

Amounts in bronze.

| | Rule | Status |
|---|---|---|
| Pit win | **20 x tier level** bronze (Recruit 20 ... Origin 200; tier levels `src/grades.ts:18`, titles `src/career.ts:8`), paid in the same batch as the `pit:<claim>` event (`origins/server/career.ts:14-26`), so a replay pays nothing (`0001:435-438`). | Placeholder (R5, `blacksmith-costs-proposal.md:17`). **OPEN:** payer's tier or the legend's; whether a grey or already-beaten legend (cp 0, `career.ts:12-13`) pays. |
| Daily cap | At most **20** paid wins a day (PROPOSED; the "heavy" player, `progression-proposal.md:132`). Bound metal cannot be sold, so this is about pacing, not RMT. | PROPOSED |
| Quest stages | A metal line in a quest reward, paid once via the `quest-stage` event (`0001:64-65`); unpaid lines wait on `origins_unpaid` (`0002:17-26`). | Content decides |
| **Sink: smith** | The cost table's `coin` column (`economy.ts:211`) becomes the metal price. #1461 (open, not merged at `256114d9`) lets it be 0; today the parser demands `coin >= 1` (`economy.ts:227`) and so does the receipt (`:318`). **The switch:** ship 0 (materials only); turning it on is a new table `revision`, a data change. Renaming `currency: 'coin'` (`economy.ts:212`) to `'metal'` is a contract change (D8). | Off at beta (R4) |
| **Sink: repair** | No durability exists on `ItemInstance` (`items.ts:157-170`); it needs a durability field first. | Later |
| **Sink: travel** | Paid passage between regions. Needs the world's travel system. | Later |
| **Sink: housing** | Rent or upkeep. Not in the blueprint's first chapter. | Later |
| NPC shop | No shop service kind exists (`economy.ts:177`). | Not phase 1 |
| Selling items to NPCs | Would burn items for metal: a faucet, so only with measured sinks. | Not phase 1 |

A bound currency with no sinks only piles up. Metals ship with at least one live sink (the smith's metal price), and Stats watches the
faucet/sink totals from the ledger before more faucets are added.

### 3.4 Gems are not money

A stackable, tradeable gem is gold by another name. **Strategy's view:** gems are one of two things, never a currency:

| Kind | Rules |
|---|---|
| **Bound crafting material** | Stackable, bound, untradeable like every material (§2.10); spent at the smith or for socketing (when either exists). |
| **Unique named jewel** | Single-copy (stack 1), a trade-limited item under the 2-hand rule (§2.10), one of each per account. |

No gem definition may be both stackable and tradeable. The content check: `stack > 1` implies untradeable (§2.10 already says so).

### 3.5 Tradeable metal: no for beta (awaiting Dom)

**No tradeable metal at beta.** If Dom later wants it, Strategy's fallback is a **capped sweetener inside a barter**, never metal for
nothing: at most **1 gold** (10,000 bronze) per trade, at most **3** such trades per account per day, behind the same gates (§5.3), and only
in a trade where both sides also offer at least one item. It would need a transfer reason in the metal ledger, a per-side amount in the
`Trade` contract (`economy.ts:38`) and in the accepted set (§6.1), and the RMT case against coin (§3.1) applies in full. **Awaiting Dom.**

---

## 4. Anti-dupe invariants and test plan

### 4.1 Invariants

| # | Invariant | Held by today | Gap |
|---|---|---|---|
| I1 | **Conservation per mint root:** sum of live quantity = sum of ledger deltas. An escrowed row is live and counts. | Deferred trigger at commit (`0001:259-269`); ledger append-only (`0001:189`); pure `checkConservation` (`inventory.ts:137-144`). | None. A trade moves rows, never quantity. |
| I2 | **A mint key is unique forever**; a split child is `parent::s<version>` and shares the root. | `mint_key unique` (`0001:104`), `mint_root` (`0001:105`), split key (`0001:418`, `inventory.ts:348`). | None. |
| I3 | **One row per place** in pack, bank, worn, account vault and guild vault. | Partial unique indexes (`0001:126-130`); slot within the grid (`0001:234-239`). | Escrow has no place (`items.ts:501`), by design. |
| I4 | **One live location per row**, so a piece cannot be in two escrows. | Location columns are the only record (`0001:113-123`); every `put` compares and bumps `version` (`0001:398-401`). | An escrow row can name any container text (`0001:99`) or a `from` that is not a side. 0003 guard (M8). |
| I5 | **Single copy per account**, escrow counted for the offerer. | `origins_items_one_of_each` (`0001:132`), holder by trigger (`0001:226-233`); pure `checkOneOfEach` (`items.ts:507-525`). | Same-definition swaps refused (§2.7). |
| I6 | **Atomic settle:** every offered piece moves, or nothing. | One batch, one transaction (`0001:490-500`); rollback tested (`scripts/origins-database-check.mjs:156-157`). | The DB does not check both accepts or the version (`0001:490-500`). 0003 adds them. |
| I7 | **No escrow outlives its trade.** | Not checked: a cancel batch that forgets a piece strands it in a closed trade. | 0003: settle and cancel refuse if the container still holds a live row. |
| I8 | **A trade settles once.** | `state = 'open' for update` (`0001:493-494`, `:504-505`); tested (`scripts/origins-database-check.mjs:158`). | None. |
| I9 | **Idempotent op ids.** | Event pk aborts a replay with O0001 (`0001:66`, `:435-438`); stored payload read back (`0002:13-15`). | `trade` is not an event kind yet (`0002:9-10`). 0003 adds it. |
| I10 | **Provenance fixed, history append-only.** | Trigger (`0001:217-223`); `placeWithHistory` (`items.ts:457`). | None. |
| I11 | **Trade limit:** a piece has at most 2 `trade` history entries, and one with 2 is bound to its holder. Survives split (history copied, `0001:418`), escrow and cancel (no entry written). | Nothing yet. | 0003 trigger (M9); pure check in `settleTrade`. |
| I12 | **Only tradeable pieces enter escrow:** never a stackable (`single_copy = false`), never a bound row. | Pure: `economy.ts:155`. DB: nothing. | 0003 guard (M8) refuses `single_copy = false` or `bound_to is not null` into escrow. Rarity and provenance rules stay in the writer (the DB does not store rarity). |
| I13 | **Bound and story-critical never move between accounts.** | `economy.ts:155`, `inventory.ts:260`, `items.ts:402-410`; story-critical binds on acquire (`items.ts:102`). | Covered by I12 for the bound column. |
| I14 | **Metal is never transferred** (when built): its ledger has no transfer reason, balance = sum of ledger, 0..`MAX_COIN`. | Nothing yet. | Option B (§3.2). |

### 4.2 Pure property tests (new, in the style of `origins/inventory/property.test.ts:1-6`)

A pure trade state machine (open / change offer / accept / withdraw accept / cancel / expire / settle) over three accounts, **1,000 seeded
runs** of random op sequences with **interleaved actors** (any order, stale versions, replayed op ids, one piece offered into two trades,
packs filled mid-trade, pieces passed A → B → C → A). After every step:

| # | Property |
|---|---|
| P1 | I1 conservation for every root, escrow included. |
| P2 | I2 and I4: `checkCustody` is clean (`items.ts:476-493`). |
| P3 | I5 one-of-each per account. |
| P4 | A settle happens only when both sides accepted the **current** version; any change clears both accepts. |
| P5 | A refused op changes nothing (deep-equal before and after). |
| P6 | A replayed `op_id` returns the first result and changes nothing. |
| P7 | Settled and cancelled are terminal. |
| P8 | After settle or cancel the container's escrow is empty. |
| P9 | Every moved piece keeps its provenance and gains exactly one `trade` entry (`checkHistoryKept`, `items.ts:421`). |
| P10 | No piece lands past the receiver's real pack size. |
| P11 | **Trade limit:** no piece ever has more than 2 `trade` entries; every piece with 2 is bound to its holder; a third trade is refused. |
| P12 | **The count survives:** cancel, expiry, escrow in/out and withdrawn offers never change it; a reversal does not raise it. |
| P13 | No stackable and no bound piece is ever in escrow. |
| P14 | Two concurrent settles of one trade: exactly one wins (model the row lock as a mutex). |

### 4.3 DB writer-check cases (extend `scripts/origins-database-check.mjs`, real PostgreSQL, branch DB)

| # | Case | Expected |
|---|---|---|
| D1 | Settle the same trade twice | Second refused "is not open" (exists: `:158`). |
| D2 | Settle racing cancel (two sessions, both lock the row) | One commits, the other O0002; escrow all moved or all returned. |
| D3 | Settle racing a move of an escrowed piece by its owner's `origins_commit` | Settle's `put` stale (O0002), rolls back whole; with 0003's guard the move itself is refused. |
| D4 | Replayed `op_id` | O0001; stored payload returned by `origins_event`; nothing moved twice. |
| D5 | Two trades offering the same piece | Second escrow `put` stale (O0002); with 0003 also refused as already in an open trade. |
| D6 | Receiver full | Writer refuses first; a forced batch into a taken slot fails the place index (`0001:126`). Trade stays open. |
| D7 | Receiver already holds the piece | `origins_items_one_of_each` refuses, nothing moves (exists: `:156-157`). |
| D8 | Same-definition swap | Before 0003: refused (§2.7). After M17: a +0↔+3 helm swap settles; a trade that would leave any account holding two copies still fails at commit; both items' hand-change counts go up and the 2-hand-change limit applies to each (Strategy 2026-10-06). |
| D9 | Cancel batch that leaves a piece in escrow | Refused by 0003; trade stays open. |
| D10 | Settle without both accepts, or at a stale version | Refused by 0003 (today the DB allows it). |
| D11 | Two characters of one account | Refused by 0003. |
| D12 | A second open trade for a busy character or account | Refused by 0003. |
| D13 | Settle after `expires_at` | Refused; the sweep cancels and returns escrow. |
| D14 | A side erased mid-trade | Exists (`:262-275`). |
| D15 | Settle batch carrying `mint`, `burn`, `split` or `career_set` | Refused by 0003 (settle takes `put` and `event` only). Today `origins_apply` runs any op (`0001:382-475`). |
| D16 | **Third trade of a piece** (A → B → C, then C offers it) | C's escrow `put` refused (bound); a forced settle appending a third `trade` entry refused by the trigger. |
| D17 | **Second trade without binding** (a batch that appends the 2nd `trade` entry but leaves `bound_to` null) | Refused by the trigger. |
| D18 | **Count survives escrow and cancel:** a piece offered and cancelled 5 times, then traded twice | Binds on the 2nd settle, not before. |
| D19 | **Count survives split** (defence in depth: force a stackable row with 2 `trade` entries, split it) | The child carries both entries (`0001:418`) and is refused from escrow. |
| D20 | A stackable or a bound row put into escrow | Refused by 0003's guard. |
| D21 | Client token calling any trade function or reading `origins_trades` | Refused (reads exist: `:170`). |
| D22 | Flag OFF | Every trade function refuses (O0007). |

The blueprint's economy matrix (`origins-blueprint-2026-10-06.md:285`) and UO's T1-T12 (`modernuo-secure-trade.md:142-155`, minus the
currency cases T9-T10) are the acceptance bar (`item-loot-storage-summary.md:37`).

---

## 5. RMT, bots and abuse

### 5.1 An honest note first

Banning tradeable currency does not capture the real-money margin by itself. Off-site sellers will still sell rare gear and whole accounts.
What shrinks them is the sum of: **trade limits** (a piece can be resold at most twice), **gates**, **caps**, **provenance trails**, a
**ToS ban** with enforcement, and a **cash shop that sells what buyers actually want** (looks and convenience, §5.8), so the legitimate
route is easier than the grey one. None of these removes RMT; together they make it small, slow and visible.

### 5.2 What can be traded at all

Trade-limited unique pieces only (§2.10). No currency. Stackables bound. Cash items bound. A farmed piece can pass through at most two
buyers, and the second buyer cannot resell it.

### 5.3 Who may trade (PROPOSED)

| Gate | Value | Why |
|---|---|---|
| Rank | Gladiator (career level 11+) | Implied by the Exchange (blueprint `:8`); levels 11-15 are Gladiator (`origins/contracts/world.ts:41-42`, `src/career.ts:8`). |
| Verified contact | A verified **email** before trading unlocks. Phone verification is an **optional later gate**, not for beta: SMS costs money per message, so it is Dom's purchase call (Strategy, 2026-10-06). | Raises the cost of each mule or resale account. |
| Account age | **7 days** since the account was created | Throwaway accounts cost a week. |
| Origins age | **48 hours** since `origins_access.granted_at` (`0001:17`) | Stops instant farms on new allowlist rows. |

### 5.4 Cooldowns (PROPOSED)

- **New device:** for **72 hours** after a device id is first seen on an account, the account can receive but not give.
- **Password or email change:** **72 hours**, same rule. A bought account cannot be stripped quickly. **OPEN:** the writer needs this
  signal from Supabase Auth.

### 5.5 Caps per account, rolling 24 h (PROPOSED)

| Cap | Value |
|---|---|
| Open trades at once | **1** |
| Settled trades | **10** |
| Pieces given | **20** |
| Distinct counterparties | **5** |
| Origin-tier pieces given | **2** |
| Re-won pieces given (if R2 is adopted) | **1** per legend per 7 days |

Caps are config rows (`origins_config`, `0001:15-16`), so Strategy moves them without a migration.

### 5.6 Flags (logged and queued for review, never blocking)

- One-way flow: an account receives **6+** pieces from **3+** accounts in 24 h while giving back pieces of lower tier.
- Lopsided trades: one side gives **3+** pieces at Champion tier or above for **1** piece two or more tiers lower. **OPEN:** tier and rarity
  stand in for value; there are no prices by design.
- Same IP on both sides (§2.8).
- A farm chain: provenance shows one winner (`wonBy`, `items.ts:141`) whose pieces reach **5+** other accounts in 7 days.
- A new device or recently changed account giving anything at Champion tier or above (allowed only after the cooldown; flagged at first give).

### 5.7 Logging, audit and rollback

- Every settle writes one `trade` event per account (append-only, `0001:188`): container, counterparty account, each piece's id and mint key.
- Every piece's history gains a `trade` entry (`economy.ts:160`, `items.ts:153`): the chain of owners is on the item forever, which is what
  makes farm-and-resell visible.
- `origins_trade_audit` rows hold the device signals (session id, salted device and IP hashes, UA family) for **90 days**, then are deleted;
  `origins_purge_account` must delete them too (`0001:516-529`).

| Who | Can do |
|---|---|
| Writer | Refuse by rule; raise flags. Never reverses. |
| Reviewer (an `admins` row, `202609210001_admins.sql:4-7`; Dom names who) | Freeze an account's trading (a config row); read the audit trail. |
| Dom, or Strategy on Dom's say | Reverse a trade. |

**Reversal** is a writer-only function that moves each piece still held by its receiver back to its sender with a `reversal` history entry
(not counted toward the limit, §2.10) and a `trade-reversal` event naming who and why. Nothing is deleted or rewritten. **OPEN:** a piece
already passed on. Recommendation: reverse only what the receiver still holds and freeze the rest for review.

### 5.8 Real money: only Dom sells, and what he sells is always bound

| Rule | |
|---|---|
| Seller | Dom only. Players never sell to players for money through the game. |
| Catalogue | **Cosmetics** (including transmog: wearing the look of a piece you earned, never its stats) and **membership convenience**: bank slots (`bank_slots`, `0001:30`), character slots (cap 5 today, `0001:309`), pack slots (`pack_slots`, `0001:29`), region access (membership, blueprint `:9`). |
| Never | Stats, gear power, upgrade levels, materials, metals, gems used as currency, rank, or anything tradeable. |
| Always | **Account-bound and untradeable.** Never in a random box. |

Reasons:

1. **Pay-to-win.** In a PvP duel game the ladder's credibility is the product. Selling power, or anything that buys power, ends it.
2. **RMT secondary market.** A tradeable cash item becomes a currency the moment it can be resold, and the sellers move in.
3. **Gambling and consumer law.** Paid random boxes are treated as gambling in Belgium, have been challenged in the Netherlands, and are under
   review elsewhere. Diablo III's real-money auction house is the cautionary example of a game whose loot became a market. **OPEN:** a
   lawyer's view before any cash item ships.

### 5.9 Off-site account selling

Account selling is where gold sellers go when there is no gold. **It cannot be removed completely.** Mitigations, each **PROPOSED**:

- A **ToS ban** on selling, buying or sharing accounts, with the account frozen on proof.
- **Verified email** before trading unlocks (§5.3). A verified phone (an optional later gate, Dom's purchase call) would make resale more awkward still, because a sold account would carry the seller's phone.
- **Trade cooldown after a new device or a password/email change** (§5.4): a bought account cannot be stripped of its tradeable pieces for
  72 hours, long enough for a report or a flag.
- **Provenance trails** (§5.7): a farm that levels accounts and resells their pieces shows up as one winner's pieces spreading to many
  accounts, and as accounts whose device and contact details change just before their pieces move.
- Bound gear limits the prize: most of a strong account's kit is bound to it (cash items, materials, pieces on their third owner).

### 5.10 Bots

- Bot trade exists only as a preview test harness (R3).
- Pit and world rewards that feed tradeable pieces come only from verified records (`origins_pit_pending` reads verified claims,
  `0001:355-363`; world encounters need a token and replay, `0001:76-87`).
- The 20-a-day metal cap and the trade caps limit what a bot farm can move per account; the verified-contact gate limits accounts.
- ToS bans automation; the farm-chain flag (§5.6) is the detection.

### 5.11 Anti-bot (Strategy's view, 2026-10-06)

**Auto-hold (Dom's idea).** When an account's wealth or velocity is anomalous (pieces arriving or leaving far faster than its play could
explain, or a farm-chain pattern), the writer puts a **hold** on it:

- A hold freezes **trading only**: open, offer and accept refuse. It **never** stops play: fights, quests, the Pit and the bank keep working.
- A hold **expires after 72 hours** unless a reviewer confirms it.
- **Strategy or Lead** review holds against **stated, written rules**. **Dom** decides bans and trade reversals (§5.7).
- A hold is a config row with a reason, a start and an expiry, plus an event, so every hold is auditable. (M13's config rows; the event
  kind is `trade-hold`, added to M11.)

**Order of defences for beta:**

| # | Layer | Status |
|---|---|---|
| 1 | Server-authoritative rewards and custody | Have it (`0001:7-11`; verified Pit claims, `0001:355-363`) |
| 2 | Trade gates (§5.3) | 0003 + writer |
| 3 | Rate limits and caps (§5.5) | 0003 config + writer |
| 4 | **Cloudflare Turnstile** (free) at signup and at an account's first trade | Writer verifies the token server-side. **OPEN:** whether signup can carry it, since sign-in is Supabase/Google. |
| 5 | Wealth/velocity auto-holds | Writer, on the audit trail (§5.7) |

**After beta:** score input timing in fight replays (the Pit already re-simulates every record, so the data exists); mule detection over the
trade graph built from provenance and history (§5.7); honeypot items or listings only a bot would touch; and **delayed ban waves**, so a
farm cannot learn which action tripped it.

**Rules:**

- **Never publish thresholds.** The numbers in §5.5 and §5.6 are the starting config; the live values stay internal and move without notice.
- **Gmail and IP are signals, not gates.** Aged Gmail accounts and residential proxies are cheap to buy. They feed flags and holds; they
  never decide alone.

---

## 6. What 0003 needs (additive, Origins-only)

Nothing in 0003 touches a live non-Origins table. Every item creates or replaces something under `origins_*`, with a down-script that
restores exactly the 0001/0002 state, a branch-DB run of `scripts/origins-database-check.mjs` plus §4.3, and Auditor probes.

**BLOCKER before any trading op ships and before the flag GO (Strategy and Backend, 2026-10-06).** Three gaps in the applied 0001 come
first. Backend confirmed all three and fixes them in **one** 0003 (no 0002b; 0001 and 0002 are never edited), with tests (D8, D9, D10,
§4.3), before any trade path is wired. No trading flag turns on without them.

| Gap | In 0001 today | Fix in 0003 | Rows |
|---|---|---|---|
| 1. Settle does not check the accepts or the offer | `origins_settle_trade` checks only `state = 'open'` and both sides present, then runs any batch (`0001:490-500`) | The acceptance model, §6.1 | M1, M4, M5, M6, M8 |
| 2. Escrow can outlive its trade | Nothing checks the container after settle or cancel (`0001:490-510`) | §6.2 | M6, M7 |
| 3. Same-definition swap aborts | `origins_items_one_of_each` is a unique index, checked per row (`0001:132`) | §6.3 | M17 |

**Honest scope (Backend).** These checks guard against **writer bugs**, not a compromised writer. The writer role can already open trades
for any characters (`origins_open_trade` takes any two character ids, `0001:484-489`) and build any batch. So this is hardening of the one
trusted writer, not a new trust boundary.

### 6.1 Gap 1: the acceptance model

**Columns on `origins_trades` (M1):**

| Column | Type | Meaning |
|---|---|---|
| `offer_version` | `int not null default 0` | Bumps by 1 on every offer change on either side. Only `origins_change_offer` (M4) writes it, and the escrow guard (M8) makes M4 the only way into or out of escrow while a trade is open. |
| `accepted_version_a`, `accepted_version_b` | `int` (null = not accepted) | The `offer_version` that side accepted. |
| `accepted_at_a`, `accepted_at_b` | `timestamptz` | When. Audit only. |
| `accepted_set_a`, `accepted_set_b` | `jsonb` | What that side accepted: every live escrow row of the container, **both sides**, as `[{id, version, from}]` sorted by id. |

An offer change sets both `accepted_version_*` and `accepted_set_*` back to null in the same statement that bumps `offer_version` (the
double-accept rule, `economy.ts:98-99`).

**What a side accepts:** the offer version **and** the exact set of item ids and row versions on both sides at that version. The version alone
would miss a row whose version moved without an offer change (a bug path); the set alone would miss a removed-then-re-added piece at the
same version. Both together pin the offer on screen.

**Who writes it:** the writer only, through a new `origins_accept_trade(p_container text, p_character text, p_offer_version int, p_accepted
boolean)` (M5), executable by `frankendom_origins` only. It takes a **character**, not a side letter, and derives the side from
`side_a`/`side_b`, so a call can never accept for the other side. Under `for update` on the trade row it: refuses unless the trade is open,
not expired, `p_character` is a side and `p_offer_version = offer_version`; then **reads the set itself** from `origins_items` (live rows with
`loc_kind = 'trade-escrow'` and `loc_container = p_container`) and stores it. The writer never supplies the set. `p_accepted = false` clears
that side.

**Settle's checks (M6),** in order, under `for update` on the trade row, all before any op runs:

1. The trade is open, not expired, and both sides present (today's checks, `0001:493-495`).
2. `accepted_version_a = accepted_version_b = offer_version`: both sides accepted the **current** offer.
3. `accepted_set_a = accepted_set_b`, and both equal the escrow read now: every live escrow row of the container, by id and version, is
   exactly the accepted set. A row that moved, changed version, or appeared since the accept refuses the settle.
4. The batch holds only: one `put` per accepted row, with `expected_version` = its accepted version, moving it to a pack or bank slot of the
   **other** side's character; and `event` ops of kind `trade` for the two sides' accounts. Any other op (`mint`, `burn`, `split`, `merge`,
   `career_set`, a `put` of a row not in the set, a `put` back to its own offerer) refuses the whole settle.
5. Then gap 2's check (§6.2), then `state = 'settled'`.

### 6.2 Gap 2: no escrow outlives its trade

At the end of `origins_settle_trade` and `origins_cancel_trade` (M6, M7), after the batch has run and before the state changes: if any live
row still has `loc_kind = 'trade-escrow'` and `loc_container = p_container`, raise (O0002) and roll back. The trade stays open. A deferred
constraint trigger on `origins_trades` (checking at commit that a non-open trade's container is empty) would do the same; the in-function
check is recommended because it fails at the call with a clear message, and the escrow guard (M8) already stops rows entering a closed
trade's container.

### 6.3 Gap 3: one-of-each checked at commit

A unique index cannot be deferred, and a same-definition swap is circular (each move makes a duplicate for a moment), so no op order helps.
0003 **drops `origins_items_one_of_each`** and replaces it with a **deferred constraint trigger** (M17) on `origins_items` insert or update:
at commit, for each touched `(holder_account, item)` with `single_copy` and `retired_at is null`, count the live rows; more than one raises
(new code, or the existing 23505 class for continuity: Backend's call). Two cautions for Backend:

- **Concurrency.** The index stopped two concurrent transactions each adding one copy for the same account. A count at commit does not by
  itself: under READ COMMITTED each transaction can count 1. The trigger must take `pg_advisory_xact_lock` on a hash of
  `(holder_account, item)` before counting, so the second commit waits for the first and then counts with a fresh snapshot.
- **Erasure and guild vaults** keep today's behaviour: retired rows and rows with a null holder (guild vault) are not counted, as the index's
  `where` clause does now (`0001:132`).

It is Origins-only and class 1 (same class note as M1). The down-script restores the 0001 index.

**Class note.** 0002 replaced the `origins_events` kind check with ALTER (`0002:8-10`) and was handled as an additive Origins-only file. This
spec follows that: changing an **Origins** table that holds no player rows (the flag is OFF, `0001:16`) is class 1. If Strategy reads R7's
"live table" to include applied Origins tables, the items marked 1* become class 2 or move to companion tables (D12).

| # | Change | Kind | Class |
|---|---|---|---|
| M1 | **BLOCKER.** `origins_trades` add the acceptance columns of §6.1 (`offer_version`, `accepted_version_a/b`, `accepted_at_a/b`, `accepted_set_a/b`), plus `region text`, `expires_at`, `last_change_at` (timestamptz), `cancel_reason text` (check: cancelled, expired, timeout, side-erased, reversed) | ALTER ADD COLUMN, Origins table | 1* |
| M4 | **BLOCKER.** New `origins_change_offer(container, character, expected_version, batch)`: under the trade lock, check `offer_version`, apply that side's escrow in/out `put`s only, `offer_version`+1, clear both sides' `accepted_version_*` and `accepted_set_*` (§6.1) | function | 1 |
| M5 | **BLOCKER.** New `origins_accept_trade(p_container, p_character, p_offer_version, p_accepted)` (§6.1): derives the side, reads and stores the accepted set itself | function | 1 |
| M6 | **BLOCKER.** Replace `origins_settle_trade`: the five checks of §6.1 (current `offer_version` accepted by both, escrow equals the accepted set, only the two sides' escrow moves and `trade` events), then §6.2's empty-escrow check | function replace | 1 |
| M7 | **BLOCKER.** Replace `origins_cancel_trade`: §6.2's empty-escrow check; record `cancel_reason` | function replace | 1 |
| M8 | **BLOCKER.** Escrow guard trigger on `origins_items`: enter `trade-escrow` only for an open trade where `loc_from` is a side, only if `single_copy` and `bound_to is null`; leave escrow only inside M4, M6, M7 or M14 (a transaction-local setting, like `origins.purge`, `0001:519`) | trigger | 1 |
| M17 | **BLOCKER.** Drop `origins_items_one_of_each` (`0001:132`); add a deferred constraint trigger that counts live single-copy rows per `(holder_account, item)` at commit, under an advisory lock (§6.3). Down-script restores the index. | index drop + trigger | 1* |
| M2 | One open trade per character and per account: partial unique indexes on `side_a` / `side_b` where open, plus a cross-column check in `origins_open_trade`; index on `(state, expires_at)` where open | index | 1 |
| M3 | Replace `origins_open_trade`: two different accounts; neither already trading; set `region`, `expires_at` | function replace | 1 |
| M9 | Trade-limit trigger on `origins_items`: when an update appends a `trade` history entry, count them; refuse above **2**; at 2 require `bound_to` = the new holder | trigger | 1 |
| M10 | New `origins_expire_trades()` for the writer's sweep | function | 1 |
| M11 | `origins_events` kind check gains `trade`, `trade-cancel`, `trade-reversal`, `trade-hold` (same form as `0002:8-10`; `metal` too if M15 ships) | constraint replace | 1* |
| M12 | New `origins_trade_audit (container, account, character, session_id, device_hash, ip_hash, ua_family, at)`; replace `origins_purge_account` to delete its rows | table + function replace | 1 |
| M13 | `origins_config` rows for every §5 limit and gate | rows, Origins table | 1 |
| M14 | New `origins_reverse_trade(container, reviewer, reason, batch)` (writer-only) and `origins_trade_counts(account, since)` for the caps | functions | 1 |
| M15 | **Option, not needed for phase 1:** bound metals, as `origins_metal` + `origins_metal_ledger` + a deferred conservation trigger + a `metal` op in a replaced `origins_apply` (recommended, §3.2 B), or a `metal_bronze bigint` column on `origins_career` (§3.2 A, ALTER, 1*) | tables + trigger + function replace | 1 (B) / 1* (A) |
| M16 | RLS on every new table, `revoke all from public, anon, authenticated`; no client policy on trades, audit or ledgers; if M15 B ships, an account reads its own `origins_metal` row (`0001:295` pattern). Every new function granted to `frankendom_origins` only (`0001:531-538` pattern). | RLS / grants | 1 |

Not in 0003: any change to `loot_claims`, `awards`, `fighter_profiles` or another Pit table (re-winnable pieces, R2, would touch the live
award path and is class 2 if adopted); cash-shop tables; barter-board tables (phase 2).

Contract changes that go with it (code, not migration): a tradeable predicate (§2.10) used by `changeOffer`/`settleTrade`; the 2-trade bind
in `settleTrade`; a `reversal` `HistoryEntry` kind (`items.ts:152-155`); gifts off if D4 says so (`economy.ts:68`).

---

## 7. Decisions for Strategy

1. **Player currency:** none, barter only / tradeable coin. **Awaiting Dom. Recommend none; coin considered and rejected (§3.1).**
2. **Full receiver:** refuse the whole trade and keep it open (today's code) / move what fits, return the rest. **RULED (Strategy 2026-10-06): refuse whole; fix `server-save-schema.md:76`.**
3. **Trade limit:** 2 hand changes then bind to the third owner / 1 / unlimited. **Awaiting Dom. Recommend 2.**
4. **Gifts (one empty side):** off at beta / on. **RULED (Strategy 2026-10-06): off at beta (one or more items each side), the contract allows them today (`economy.ts:68`).**
5. **Tradeable set vs R1:** rare-and-up gear plus every Pit piece / rare-and-up only (common Pit pieces untradeable). **RULED (Strategy 2026-10-06): rare-and-up plus Pit pieces, so R1 holds.**
6. **Bind the third owner to:** the character (existing `boundTo`) / the account. **RULED (Strategy 2026-10-06): the character for beta; revisit account-bind after beta. No contract change.**
7. **Trade count lives in:** history, derived and enforced by trigger / a counter column. **RULED (Strategy 2026-10-06): history.**
8. **NPC costs:** bound metals (bronze/silver/gold, 100:1, stored in bronze), ledger tables / column on `origins_career`; smith stays materials-only for now. **RULED (Strategy 2026-10-06): bound metals in ledger tables when built (replaces "tribute"); materials-only at beta.**
9. **Metal per Pit win:** 20 x payer tier bronze, 20 paid wins a day / 20 x legend tier / flat. **RULED (Strategy 2026-10-06): 20 x payer tier as the placeholder; Stats sets the number.**
10. **Same-definition swap:** refuse with a clear message / redesign the one-of-each index. **RULED (Strategy 2026-10-06): refuse until 0003 lands; after that the swap settles through the deferred one-of-each trigger (M17).** Conditions: 0003 includes a test proving a +0↔+3 helm swap settles AND a test proving a trade that would leave anyone holding two copies still fails at commit; the 2-hand-change limit applies to both items.
11. **Same-IP trades:** allow and flag / refuse. **RULED (Strategy 2026-10-06): allow and flag; refuse same session or device.**
12. **0003 changes to existing Origins tables (M1, M11):** class 1 by the 0002 precedent / class 2 / companion tables. **RULED (Strategy 2026-10-06): class 1 while the flag is OFF and the tables are empty; same path, joint GO.**
13. **Trade gates:** Gladiator only / plus verified email, 7-day account, 48 h Origins age (phone dropped for beta). **CHANGED (Strategy 2026-10-06): Gladiator rank + verified email + 7-day-old account + 48 h in Origins. Phone verification is an optional later gate (SMS costs money per message; Dom's purchase call).**
14. **Cooldown after a new device or a password/email change:** 72 h / 24 h / none. **RULED (Strategy 2026-10-06): 72 h.**
15. **Cash shop:** Dom only; cosmetics, transmog and membership convenience; always bound, never random, never stats / anything wider. **Awaiting Dom. Recommend the narrow catalogue.**
16. **Phase 2 discovery:** barter board with multi-item and "any of these" offers, no prices / priced market. **RULED (Strategy 2026-10-06): the barter board.**
17. **Re-winnable once sold (R2):** adopt with a give cap / reject / defer. **RULED (Strategy 2026-10-06): defer until after beta (live award path).**
18. **Who may reverse a trade:** Dom / Dom or Strategy on Dom's say / any admin. **RULED (Strategy 2026-10-06): Dom or Strategy on Dom's say; admins freeze only.**
19. **Player trade before the hub runtime exists:** heartbeat only / wait for the hub to prove the Exchange position. **RULED (Strategy 2026-10-06): wait; heartbeat in the preview.**
20. **Tradeable metal:** none at beta / a capped sweetener inside a barter (at most 1 gold per trade, 3 such trades a day, same gates). **Awaiting Dom. Recommend none at beta; the sweetener only if Dom insists later.**
21. **Gems:** bound crafting materials or unique named jewels under the 2-hand rule / a stackable tradeable gem. **Strategy's view: never a stackable tradeable gem (it would be gold by another name).**
22. **Auto-holds:** wealth/velocity anomalies freeze trading only, expire after 72 h unless confirmed; Strategy/Lead review on written rules; Dom decides bans and reversals / no auto-holds. **Awaiting Dom (his idea). Recommend adopt, as the last beta layer after gates, rate limits and Turnstile.**

---

## 8. OPEN questions

1. Where the writer gets a character's position (the Exchange check) before the shared-world hub exists (§2.8).
2. Whether Supabase access tokens give the writer a session id claim, and which client-IP header nginx forwards (§2.8).
3. What the Pit does today when a player who once owned a piece beats its legend again (§2.11). Read the award path with its owner.
4. Where cancelled pieces go when both the offerer's pack and bank are full (§2.5).
5. The rarity of each legacy Pit piece in live content (§2.10, D5).
6. Which tier Pit metal uses, and whether grey or already-beaten legends pay it (§3.3).
7. A value measure for the lopsided-trade flag with no prices (§5.6).
8. How the writer learns of a password or email change (§5.4); and, if Dom buys SMS later, whether phone verification can be turned on in Supabase Auth (§5.3).
9. Whether a reversal follows a piece already passed on (§5.7).
10. Whether a pre-check that says "the other player cannot receive this piece" is an acceptable leak of their inventory (§2.9).
11. Whether 0001 is applied on the hosted project yet (decides M1/M11's class in practice).
12. A legal view on the cash-shop rules before any cash item ships (§5.8).
13. Phase 2 board details: listing cap, expiry, and who can see listings (§1.1).
