# ModernUO behaviour spec: secure trade (two-party item/currency exchange)

- Donor: ModernUO (GPLv3), commit `261ea01ab4b7c49a043dfabc7f44703b648883f8`, read-only at `/opt/frankendom-shadow/work/expansion-donors/ModernUO` on the VPS. Paths are relative to `Projects/`.
- Spec author: analyst-modernuo. Clean-room: behaviour, formulas and constants only. Implementers must not open the donor tree.
- Destination: **economy** (player-to-player exchange; Frankendom would run this server-side only).

## 1. Purpose

Two players open a trade window. Each side has an offer container (and, with account gold, a currency offer). Each side ticks "accept". Any change to either offer clears **both** ticks. When both are ticked and every offered item permits the trade (and both can afford their currency offer), the items swap simultaneously and the window closes. Cancel, death, disconnect, separation beyond 2 tiles or changing map returns every item to its owner.

## 2. Files, functions, call graph

| Path:line | Function | Role |
|---|---|---|
| Server/Mobiles/Mobile.cs:7617-7619 | CheckTrade (base) | default allow |
| Server/Mobiles/Mobile.cs:7621-7657 | OpenTrade(from, offer) | feature flag, both players alive and online; capacity check; create or reuse trade; drop the offer |
| Server/Mobiles/Mobile.cs:7666-7675 | OnDragDrop | dropping an item on another player within 2 tiles opens/extends a trade |
| UOContent/Mobiles/PlayerMobile.cs:2131-2198 | PlayerMobile.CheckTrade | refusal reasons and capacity checks |
| UOContent/Mobiles/PlayerMobile.cs:2200-2225 | CheckContentForTrade | trapped containers and recently stolen items refused (recursive) |
| Server/Network/NetState/NetState.cs:310-339 | ValidateAllTrades | cancel if either deleted, dead, > 2 tiles apart, or different map |
| Server/Network/NetState/NetState.cs:341-433 | CancelAllTrades / RemoveTrade / FindTrade / FindTradeContainer / AddTrade | per-connection trade list |
| Server/SecureTrade.cs:25-74 | SecureTrade ctor | creates both sides and both offer containers (and currency offers) |
| Server/SecureTrade.cs:82-134 | Cancel | return items to owners, close |
| Server/SecureTrade.cs:136-158 | Close | mark invalid, detach, dispose both sides next tick |
| Server/SecureTrade.cs:160-184 | UpdateCurrency | ledger/offer display updates |
| Server/SecureTrade.cs:186-331 | Update | the accept/complete state machine |
| Server/SecureTrade.cs:333-426 | HandleAccountGoldTrade | currency transfer and messages |
| Server/SecureTrade.cs:429-477 | SecureTradeInfo | per-side state: mobile, container, currency offer, accepted, disposed |
| Server/Items/SecureTradeContainer.cs:15-96 | SecureTradeContainer | hold check delegates to CheckTrade; no lifting; any add/remove (incl. nested) clears both accepts |
| Server/Items/VirtualCheck.cs:60-80 | VirtualCheck.Gold / Plat | currency offer values (no validation) |
| UOContent/Network/Packets/IncomingMobilePackets.cs:93-167 | SecureTrade packet | client actions: 1 cancel, 2 set accept, 3 set currency offer |
| Server/Mobiles/Mobile.cs:7587-7606 | AddToBackpack | place in backpack, else drop at feet |
| Server/Items/Item.cs:1884-1889 | AllowSecureTrade / OnSecureTrade | per-item veto and notification hooks |
| Cancel triggers | Mobile.cs:1292 (connection lost), 2476 (deleted), 4749 (killed), PlayerMobile.cs:2407 (before death); validation triggers Mobile.cs:2532 (map change), 7379 (any move) |

State machine:

```
          drop item on player (≤2 tiles)            any offer change (add/remove item, nested too, currency change)
 [none] ───────────────────────────────▶ [open: A=✗ B=✗] ◀──────────────────────────────────────────┐
                                             │  A ticks / B ticks (each sends "set accept true/false")  │
                                             ▼                                                          │
                                     [A=✓ B=✗] or [A=✗ B=✓] ─────────────────────────────────────────────┘
                                             │ second tick
                                             ▼
                                     [both ✓] → Update(): veto/afford checks
                                         ├─ any veto / can't afford → both ✗ (stay open)
                                         └─ ok → transfer currency → move A's items to B, B's to A → Close
 cancel packet / death / disconnect / delete / >2 tiles / map change → Cancel(): items back to owners → Close
```

## 3. Data structures

**Trade**: `from` side, `to` side, `valid` (bool; false after close).

**Side** (SecureTradeInfo): `mobile`, `container` (offer container, equipped invisibly on the mobile), `currencyOffer {gold:int, plat:int}`, `accepted` (bool), `disposed` (bool).

**Per player**: list of active trades on the connection (a player can only start one via PlayerMobile rules, but the structure is a list).

## 4. Rules and constants

| Constant | Value | Where |
|---|---|---|
| Max distance to open by drop | 2 tiles | Mobile.cs:7674 |
| Max distance during trade | 2 tiles (same map) | NetState.cs:332-334 |
| Who can trade | players only, both alive, both online, global trading flag on | Mobile.cs:7623-7640 |

### 4.1 Opening / adding an item (Mobile.cs:7621-7657; PlayerMobile.cs:2131-2225)

Offerer O drops item X onto recipient R (or into the existing offer container):
1. Trading disabled → message, refuse.
2. Either is not a player, or dead → refuse silently. Either offline → refuse.
3. Find an existing trade container of O's with R.
4. Refusal checks only when **no trade exists yet**: R is holding something on the cursor; O already trading; R already trading; R has "refuse all trades" on.
5. If X given: capacity, with `plusItems = current offer container's totalItems`, `plusWeight = its totalWeight` (if a trade exists):
   - O's backpack must be able to hold X plus O's current offer ("you would not be able to hold this if the trade failed");
   - R's backpack must be able to hold X plus O's current offer ("the recipient would not be able to carry this");
   - then content rule: X (or anything inside it) is a trapped container → refuse; X or anything inside it was recently stolen → refuse.
   Capacity uses the standard container rule (see modernuo-bank.md 4.1): item count and weight with nested contents.
6. Create the trade if new (both sides' containers + currency offers); drop X into O's container. The drop counts as an offer change (clears both accepts and calls Update).

Note: step 5 does **not** subtract what the other side is offering, and does not account for R's own outgoing offer freeing space.

### 4.2 Offer change (SecureTradeContainer.cs:40-90; IncomingMobilePackets.cs:136-165)

Adding or removing any item in either offer container, including inside a nested bag, and any currency-offer change: if a side is not disposed, set its accepted = false (both sides), then run Update (which, with both false, only refreshes both clients' tick display).

Items in an offer container cannot be lifted back out by the player directly (lift refused); taking things back means cancelling.

### 4.3 Accept toggle (IncomingMobilePackets.cs:109-135)

The client sends "accept = true/false" for the container. The matching side's accepted is set to the sent value, then Update.

### 4.4 Update / completion (SecureTrade.cs:186-331)

If the trade is invalid → nothing. If both sides are not disposed and both accepted:
1. Veto pass: for each item in A's container (**iterating from the last added to the first**), skipping the currency token: ask the item whether it allows trading from A to B; same for B's container. Stop at the first veto.
2. Currency affordability (account gold only): each side's ledger plat must be ≥ its plat offer and ledger gold ≥ its gold offer (compared separately; no conversion between them). Failing side gets "you do not have enough currency".
3. If anything failed: set both accepted = false, refresh both displays, **stay open**.
4. Else, if account gold is on and both have accounts: transfer currency in this exact order: A's plat → B, A's gold → B, B's plat → A, B's gold → A. Each transfer only happens if the offer is > 0 and the withdraw succeeds; the deposit is then attempted. Then each side gets a summary message.
5. Move items: A's items (last to first) are notified then placed in B's backpack; then B's items (last to first) into A's backpack. Placement uses "backpack, or at the recipient's feet if it does not fit" — **no capacity check at completion**.
6. Close.

If not both accepted: refresh both clients' tick displays.

### 4.5 Cancel and close (SecureTrade.cs:82-158; NetState.cs:310-361)

Cancel: if invalid → nothing. Return A's items (last to first) to A's backpack (or feet), then B's to B. Then Close: send close to both, valid = false, remove the trade from both connections, dispose both sides on the next timer tick (delete containers and currency tokens).

Cancel triggers: explicit cancel packet from either participant; ValidateAllTrades (run on every location change and map change of either player) finds either deleted, dead, more than 2 tiles apart, or on different maps; either player's connection is dropped; either player is deleted; either player dies (before-death hook).

## 5. Order of operations (full happy path)

1. A drops sword on B (≤2 tiles) → 4.1 → trade created, sword in A's offer → both ✗.
2. B drops 100 gold on A → 4.1 (B's capacity against B's own current offer) → gold in B's offer → both ✗.
3. A ticks → A ✓, B ✗ → displays refreshed.
4. B ticks → both ✓ → veto pass → (currency) → A's items → B, B's items → A → close.

## 6. Edge cases and error paths

- Currency offer values are not validated at entry (negative values are stored); at completion negative offers fail the `> 0` test and are skipped, and the affordability test passes trivially. Frankendom: reject negatives at input.
- A veto or failed affordability does not close the trade; it only clears both ticks.
- Completion can drop items on the ground when a backpack is full (capacity was only checked against the offer at insert time, and the other party's incoming items can push it over).
- Toggling accept off sends an Update that just refreshes; accepting the same value twice is harmless.
- Items deleted by their own trade hook are skipped (not placed).
- Old-client vs new-client currency UI differences are display only.

## 7. Randomness

None.

## 8. Timing

Synchronous; only disposal is deferred to the next timer tick. Distance/map validation is event-driven (on movement), not polled.

## 9. Engine plumbing to strip

All trade packets (open, equip, status, ledger, close), container serials and client-visible virtual containers, NetState trade lists (replace with a server-side `trades` map keyed by player), gump for the currency token, feature flag, messages. For Frankendom this becomes a server-authoritative state machine; the browser only displays it.

## 10. Golden cases (hand-derived)

| # | Scenario | Expected |
|---|---|---|
| T1 | A offers sword; A ✓; B ✓ | sword in B's pack; trade closed |
| T2 | A ✓, B ✓ not yet; B adds a dagger | A ✗ B ✗; trade open |
| T3 | A ✓, B ✓ (both), but sword vetoes (e.g. blessed/quest item hook) | A ✗ B ✗; trade open; no items moved |
| T4 | A offers sword then shield (shield added last); complete | B receives shield first, then sword (order matters only for placement positions and full-pack spill) |
| T5 | B's pack is at 125/125 items; A drops a sword on B | refused: "the recipient would not be able to carry this"; no trade created |
| T6 | A's pack at 124/125; A's offer already has 1 item; A adds a 2nd | O-side check: 124 + 1 (offer) + 0 + 1 = 126 > 125 → refused "you would not be able to hold this if the trade failed" |
| T7 | A moves 3 tiles away | cancel: items back to owners |
| T8 | A dies mid-trade | cancel before death processing; items back to A's pack (then normal death handling) |
| T9 | account gold: A offers 500 gold with ledger gold 400 (plat 5); both ✓ | A: "not enough currency"; both ✗; nothing moves |
| T10 | account gold: A offers 1 plat + 500 gold, B offers sword; both ✓; ledgers A 2/1000, B 0/0 | A ledger 1/500, B ledger 1/500, sword to A |
| T11 | A ✓ then A sends ✗ | A ✗; display refresh only |
| T12 | A opens trade with B while B trades with C | refused: "that person is already involved in a trade" |

### How to capture goldens on the VPS later (do not build now)

- Entry points: `Mobile.OpenTrade(from, offer)`, `SecureTrade.Update()`, `SecureTrade.Cancel()`, `SecureTradeContainer.ClearChecks()`, `PlayerMobile.CheckTrade(...)`.
- Harness: trades require a NetState on both players (`Mobile.OpenTrade` returns false without one). `Projects/Server.Tests` already has trade packet tests and `NetStateDisconnectTests.cs` creates trades with test NetStates; reuse that pattern (it calls `CancelAllTrades`). Build a test that creates two `PlayerMobile`s with backpacks and test NetStates, calls `OpenTrade`, toggles `From.Accepted`/`To.Accepted` and `Update()`, then dumps item locations. Account-gold cases need `AccountGold` enabled and accounts attached.
- No RNG. Build: .NET SDK 10.0.201; VPS only.
