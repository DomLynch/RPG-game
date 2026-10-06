# ModernUO behaviour spec: bank box, gold, checks and account gold

- Donor: ModernUO (GPLv3), commit `261ea01ab4b7c49a043dfabc7f44703b648883f8`, read-only at `/opt/frankendom-shadow/work/expansion-donors/ModernUO` on the VPS. Paths are relative to `Projects/`.
- Spec author: analyst-modernuo. Clean-room: behaviour, formulas and constants only. Implementers must not open the donor tree.
- Destination: **economy**.

## 1. Purpose

Each character has a private, unlimited-weight but item-count-limited storage container (the bank box) reachable only through a banker NPC. Money exists as physical gold piles (max 60,000 per pile) and bank checks (5,000 .. 1,000,000 each). Bankers convert between them and answer balance queries. In the TOL-era option "account gold", money is instead a per-account integer ledger (gold plus platinum) and physical gold/checks dropped into the bank are converted into the ledger.

## 2. Files, functions, call graph

| Path:line | Function | Role |
|---|---|---|
| Server/Items/Containers.cs:7-114 | BankBox | owner, opened flag, access rules, max weight 0 (= unlimited), hold-check bypass for gold under account gold |
| Server/Items/Container.cs:87-100, 141-179 | MaxItems / MaxWeight / GlobalMaxItems / GlobalMaxWeight | item-count limit default 125, weight limit default 400 (bank overrides weight to 0) |
| Server/Items/Container.cs:230-281 | Container.CheckHold | the capacity rule |
| Server/Items/Item.cs:490, 551 | TotalItems, PileWeight | counting rules |
| UOContent/Mobiles/Townfolk/Banker.cs:31-110 | GetBalance (2 overloads) | sum of ledger + gold piles + checks, clamped to int max |
| UOContent/Mobiles/Townfolk/Banker.cs:112-156 | HasRequiredBalance | early-exit scan: gold first, then checks |
| UOContent/Mobiles/Townfolk/Banker.cs:158-207 | Withdraw(from, amount) | take money out of the bank (ledger first) |
| UOContent/Mobiles/Townfolk/Banker.cs:209-314 | Deposit(from, amount, useChecks) | all-or-nothing deposit with capacity pre-check |
| UOContent/Mobiles/Townfolk/Banker.cs:316-422 | DepositUpTo(from, amount, useChecks, reserveSlots) | partial deposit, returns amount stored |
| UOContent/Mobiles/Townfolk/Banker.cs:424-448 | Deposit(container, amount) | dump money into any container (no capacity check) |
| UOContent/Mobiles/Townfolk/Banker.cs:450-615 | OnSpeech | spoken commands: withdraw N, balance, bank, check N |
| UOContent/Items/Misc/Gold.cs:16-23, 41-103 | Gold | stackable; weight per coin; conversion to ledger on entering bank/trade |
| UOContent/Items/Misc/BankCheck.cs:29, 48-107, 127-180 | BankCheck | weight 1; conversion; double-click cash-in |
| Server/IAccount.cs:5-37 | AccountGold config | enabled default = TOL era; threshold 1,000,000,000; convert-on-bank true; convert-on-trade false |
| UOContent/Accounting/Account.cs:523-604 | DepositGold / DepositPlat / WithdrawGold / WithdrawPlat / GetTotalGold | ledger arithmetic |
| Server/Mobiles/Mobile.cs:7360-7375 | location change | moving closes an open bank box |

Call graph (speech path, no account gold):

```
player says "withdraw 500" near banker (≤12 tiles)
  └─ Banker.OnSpeech → criminal? → per-transaction limit → backpack has room? → Withdraw()
        └─ HasRequiredBalance → consume gold piles then checks → drop new Gold(500) in backpack
player says "check 20000" → new BankCheck(20000) → TryDropItem into bank (capacity) → consume 20000 gold from bank (piles only)
player says "bank" → BankBox.Open()   (closes again when the player moves)
code deposits (quest/vendor) → Banker.Deposit / DepositUpTo
player double-clicks a check in the bank → DepositUpTo(worth, no checks, reserve 1) → cash it out as piles
```

## 3. Data structures

| Entity | Fields | Notes |
|---|---|---|
| BankBox | owner, opened (bool), items | maxWeight 0 = unlimited; maxItems = 125 (global default) |
| Gold | amount (1..60,000 per pile by convention) | stackable; weight per coin = 0.02/3 (ML+) or 0.02 |
| BankCheck | worth (int) | weight 1.0 stone; not stackable |
| Account ledger | totalGold (int), totalPlat (int) | used only when account gold is enabled |

Counting rules (Container.CheckHold; Item.cs): an item counts as 1 item plus all items inside it (`TotalItems`), regardless of stack amount. Weight of a stack is `ceil(weightPerUnit × amount)`.

## 4. Formulas and constants

| Constant | Value | Where |
|---|---|---|
| Gold pile cap used by deposits | 60,000 | Banker.cs:234, 278-281, 297 |
| Smallest check | 5,000 (deposits below this are made as gold piles) | Banker.cs:249, 295, 430, 572 |
| Largest check | 1,000,000 | Banker.cs:238, 253, 301, 435, 576 |
| Withdraw per transaction | 5,000 pre-ML; 60,000 ML+ | Banker.cs:483 |
| Banker hearing range | 12 tiles | Banker.cs:450-454 |
| Bank item limit | 125 (Container.GlobalMaxItems) | Container.cs:177 |
| Bank weight limit | none (0) | Containers.cs:23 |
| Platinum threshold | 1,000,000,000 gold = 1 plat | IAccount.cs:17 |
| Gold weight | 0.02/3 per coin (ML+), 0.02 per coin (pre-ML) | Gold.cs:22 |

### 4.1 Capacity rule (Container.cs:230-281)

For non-staff, adding item X (with optional extra counts p_items, p_weight) to a container is allowed iff:
- container is not decorative,
- if item checking is on and maxItems ≠ 0: `totalItems + p_items + X.totalItems + (X is virtual ? 0 : 1) ≤ maxItems`,
- if maxWeight ≠ 0: `totalWeight + p_weight + X.totalWeight + X.pileWeight ≤ maxWeight`,
- and recursively the same rule holds for the parent container, if any.

Under account gold with convert-on-bank on, the bank accepts gold and checks without any capacity check (they will be converted and deleted immediately).

### 4.2 Balance (Banker.cs:31-65)

`balance = (ledger gold + ledger plat × 1e9, if enabled) + Σ gold pile amounts + Σ check worths`, computed in 64-bit and clamped to [0, 2,147,483,647]; early return at int max after the ledger step and after the gold-pile step.

### 4.3 Withdraw(amount) (Banker.cs:112-207)

1. If account gold is on and the ledger's **gold part** (not platinum) ≥ amount → subtract, done. (Ledger withdraw ignores platinum; amount ≤ 0 counts as success.)
2. Else scan the bank: add gold piles in bank order, stop as soon as the running sum ≥ amount; if not reached, continue adding checks in bank order, stop when reached. If never reached → fail (nothing changes).
3. Consume the collected **gold piles first, in order**: delete a pile whose amount ≤ remaining, otherwise shrink it. Then checks in order: delete if worth ≤ remaining, else reduce worth.

The caller (speech) then drops a single new gold pile of `amount` into the backpack. Bank checks are never broken into change in the backpack; a check is just reduced in place.

### 4.4 Deposit(amount, useChecks = true) — all or nothing (Banker.cs:209-314)

1. `amount ≤ 0` → success, nothing happens. Account gold on → ledger deposit (plat = amount div 1e9, gold = amount mod 1e9, added separately with **no carry**), success.
2. No bank → fail.
3. Pre-compute: walk existing top-level gold piles and checks in bank order; each pile can absorb `60,000 − amount`, each check (if useChecks) `1,000,000 − worth`; subtract from remaining.
4. Count new slots for what is left: loop: if `!useChecks or r < 5,000` → a pile of `min(r, 60,000)`; else if `r ≤ 1,000,000` → one check of r (done); else a check of 1,000,000.
5. If `maxItems ≠ 0` and `slotsNeeded > maxItems − totalItems` → **fail, nothing changed**.
6. Execute the same top-ups, then create the new piles/checks by the same rule.

### 4.5 DepositUpTo(amount, useChecks, reserveSlots) (Banker.cs:316-422)

Same top-up step (performed immediately), then creates new piles/checks while slots remain; returns how much was stored. Staff and unlimited banks have unlimited slots. `reserveSlots`: if the remainder would **not** fully fit, keep that many slots free (used so a partly cashed check can be put back). Returns `amount − remaining`.

### 4.6 Speech commands (Banker.cs:452-615)

- Criminals are refused for every command.
- **withdraw N**: needs an integer second word; N above the per-transaction limit → refused; backpack missing, or `pack.totalWeight ≥ pack.maxWeight`, or `pack.totalItems ≥ pack.maxItems` → "backpack can't hold anything else" (note: only checks the pack is not already full; the new gold's own weight is not checked and the pile is force-dropped); N ≤ 0 → silently nothing; Withdraw fails → "thou hast not so much gold"; else drop Gold(N) in pack.
- **balance**: ledger text (plat, gold) if account gold on, else GetBalance.
- **bank**: open the box (criminals refused). Opening requires the bank-access feature flag (staff override).
- **check N** (disabled under account gold): N < 5,000 → too small; N > 1,000,000 → too big; else create the check, try to put it in the bank with capacity rules (fail → "not enough room"), then consume N gold **from gold piles only** (fail → "not so much gold", check deleted). Note the order: capacity first, then funds.

### 4.7 Cashing a check (BankCheck.cs:127-180)

Without account gold: the check must be inside the owner's bank. It is taken out (freeing its slot), then `DepositUpTo(worth, useChecks = false, reserveSlots = 1)`; if all deposited → check deleted; if partly → check worth reduced by the deposited amount and returned to the bank; if nothing → returned with "bank box is full". With account gold: check must be in the backpack; its worth goes to the ledger and the check is deleted.

### 4.8 Gold/check auto-conversion (Gold.cs:41-103; BankCheck.cs:48-107)

Only under account gold. When gold or a check lands anywhere inside a bank box (convert-on-bank, default on) or a trade window (convert-on-trade, default off), its value is deposited to the owner's ledger, the item is deleted and the container totals refreshed. In a trade window, the trader's offer (virtual check) is increased by the converted amount for old clients.

## 5. Order of operations

See 4.3–4.6; the critical ordering facts: withdraw consumes **piles before checks**, in bank order; deposit **tops up before creating**; the all-or-nothing deposit **checks capacity before changing anything**; "check N" **places the check before taking the gold**.

## 6. Edge cases and error paths

- Ledger has no carry: depositing 600,000,000 twice gives totalGold 1,200,000,000 (above the 1e9 threshold), and a third would overflow a 32-bit int. Frankendom: carry gold into plat, or use one 64-bit integer.
- Ledger withdraw only looks at the gold part; with 0 gold and 5 plat, a withdraw of 100 falls through to the physical bank.
- Balance is clamped to int max; a bank holding more than that reports 2,147,483,647.
- Moving even one tile closes the bank box; a ghost/criminal cannot open it.
- Items inside sub-containers count against the bank's 125 (bag of 50 items = 51).
- Withdrawing into a backpack at 399/400 stones succeeds and overloads it.

## 7. Randomness

None in the bank paths. (Gold(min, max) constructors used by loot use RandomMinMax but are not bank logic.)

## 8. Timing

None, except the bank closing on any movement.

## 9. Engine plumbing to strip

Speech keyword parsing, NPC vendor base class, context menu, gump/packet sends, overhead "Bank container has N items, W stones" message, equip-update packets, serialization, feature flags, delete-on-close packet option.

## 10. Golden cases (hand-derived; account gold OFF unless stated; bank initially empty; maxItems 125)

| # | Operation | Expected bank afterwards / result |
|---|---|---|
| B1 | Deposit(3,000) | one Gold 3,000; true |
| B2 | Deposit(70,000) | one Check 70,000; true |
| B3 | Deposit(2,500,000) | Check 1,000,000; Check 1,000,000; Check 500,000; true |
| B4 | Deposit(130,000, useChecks=false) | Gold 60,000; Gold 60,000; Gold 10,000 |
| B5 | bank has Gold 59,000; Deposit(4,000) | pile → 60,000; new Gold 3,000 |
| B6 | bank has Check 990,000; Deposit(20,000) | check → 1,000,000; remaining 10,000 → new Check 10,000 |
| B7 | bank holds 124 items; Deposit(130,000, false) | needs 3 slots, 1 free → **false, nothing changed** |
| B8 | same as B7 but DepositUpTo(130,000, false) | one pile of 60,000 created; returns **60,000** |
| B9 | bank: Gold 500, Gold 2,000, Check 10,000; Withdraw(3,000) | both piles deleted, check worth **9,500**; true |
| B10 | bank: Gold 500; Withdraw(600) | false; nothing changed |
| B11 | "withdraw 60001" in ML era | refused (limit 60,000) |
| B12 | "check 4999" / "check 1000001" | too small / too big, nothing changes |
| B13 | bank: Gold 30,000; "check 20000" | Check 20,000 added, gold pile → 10,000 |
| B14 | bank: Check 50,000 only; "check 20000" | Check placed, then ConsumeTotal(gold) fails → "not so much gold", new check deleted; bank unchanged |
| B15 | GetBalance with Gold 60,000 + Check 1,000,000 | 1,060,000 |
| B16 | account gold ON; ledger 0/0; DepositGold(1,500,000,000) | plat 1, gold 500,000,000; then DepositGold(600,000,000) → gold 1,100,000,000 (no carry into plat) |
| B17 | cash a 200,000 check, bank has 124 items incl. the check | check removed (123 items, 2 free); DepositUpTo(200,000, no checks, reserve 1): needs 4 piles, doesn't fit → slotsToFill 2 − 1 = 1 → one pile of 60,000; check worth → 140,000, check returned to bank |
| B18 | Container capacity: bank with 125 items; drop a bag holding 3 items | 125 + 3 + 1 > 125 → refused |

### How to capture goldens on the VPS later (do not build now)

- Pure-ish functions: `Banker.Deposit(Mobile, int, bool)`, `Banker.DepositUpTo(...)`, `Banker.Withdraw(Mobile, int)`, `Banker.GetBalance(Mobile)`, `Container.CheckHold(...)`, `Account.DepositGold/WithdrawGold`.
- Harness: xUnit in `Projects/UOContent.Tests` (sequential fixture). Create a `PlayerMobile`, access `BankBox` (created on demand), add `Gold`/`BankCheck` items via `DropItem`, run the operation, dump the bank's item list (type, amount/worth) in order. For account-gold cases, the fixture's `Accounts.Configure()` plus an `Account` instance; toggle `AccountGold.Enabled` (private setter; set via the `accountGold.enable` server setting before `AccountGold.Configure()`).
- No randomness needed. Build: .NET SDK 10.0.201; VPS only.
