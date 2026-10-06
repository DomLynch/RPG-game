# Origins O2: backpack + bank

A pure TypeScript module for a character's backpack and bank. It covers items 2 and 3 of "What we build first" in `docs/specs/origins/item-loot-storage-summary.md`. It builds on the O1 contracts (`origins/contracts/`) and reuses their `ItemInstance`, ids, `Result`/`Issue`, `moveItem`, `equipItem`, `checkCustody`, `checkOneOfEach` and `CONCORD_EXCHANGE`. It does not redefine them.

**Status:** prototype only. Nothing in `src/` imports this folder, and the live game is unchanged. There are no new dependencies.

## What it does

- **One authority.** An `Inventory` is a list of one character's instances. Each instance carries its own single `location` (`pack`, `bank` or `equipped`), and the grid is a view over those locations.
- **Backpack and bank use one slot-grid type.** The grids are fixed-size, and there is no weight. The sizes default to the contracts' one pair of constants, `PACK_SLOTS` (64) and `BANK_SLOTS` (1,000) in `items.ts`. A smaller grid can be opened.
- **Operations:**
  - `receive`, `remove`
  - `move`: to an empty slot, or a swap with the occupant
  - `deposit`, `withdraw`
  - `split`, `merge`
  - `canWear`, `equip`, `unequip`
  - `settle`: a trade between two inventories, through the contracts' `settleTrade`
  - `gridView`, `openInventory`, `checkInventory`, `checkConservation`

  Every operation is atomic: you get the new state, or a refusal with a reason and the input unchanged. Before returning, each operation runs the full invariant (`checkInventory`) on its result.
- **Stacking.** Armour, and any other stack-1 piece, never stacks. Stackables split, and merge back up to their definition's `stack`, all or nothing. A merge needs the same root mint key and otherwise equal provenance, history, binding, tier and upgrade level, so it can never launder one stack's origin into another's.
- **Conservation.** Across all rows of one mint, the units always add up to the minted quantity. `checkConservation(rows, minted)` checks it against the server's ledger. Every operation except `receive`, `remove` and `settle` (which only move units across the inventory's border) also checks it on its own result.
- **The bank opens only at the Concord Exchange.** That covers deposit, withdraw, any move, split, merge or removal that touches the bank, and looking into it.
- **One of each piece per player across pack, bank and worn.** A second copy is refused.
- **Provenance and history are kept.** Every move keeps the provenance (won by whom, from which legend, at which rank, on which date) and the history unchanged.
- **Wearing needs the rank.** The check uses a server-verified career level at or above the piece's effective tier. There is no combat here.
- **Hostile ids.** Ids are compared with `===` and kept in Maps, and a lookup result must carry the id that was asked for. `constructor`, `__proto__` and `toString` either name nothing or work as plain keys.

## Where the parts came from

- **World of ClaudeCraft** (MIT, Copyright (c) 2026 Levy Street, pinned at `f46f30f`). The adapted code is credited in the header of `inventory.ts`:
  - `src/sim/bank.ts` `moveBetweenContainers`: all-or-nothing moves, decided before anything is written. An item that carries provenance moves whole, and the provenance marker is part of the merge test. Also from this file: `nearBanker`, which puts one place gate at the single entry point.
  - `src/sim/bags.ts` `countFit`/`addStacked`: stack room is room in a compatible stack, up to the stack size.
  - `src/sim/vault_slot_ops.ts`: plan on a copy, then commit in one assignment.
  - `server/bank_vault_ledger_guard.ts`: read for its "reserve the worst case before mutating" rule. Its rate budget is a server session concern and is not carried here.
- **EverQuest rules, via `docs/specs/origins/eqemu-inventory.md`:** one of each piece (lore), stacking to a stack size, and the item definition kept separate from the item instance.
- **Ultima Online rules, via `docs/specs/origins/modernuo-bank.md`:**
  - the bank is reachable only at one place;
  - a deposit is all or nothing, with the capacity checked before anything changes;
  - the item-count limit is a fixed slot grid here.
- **No EQEmu, ModernUO, OpenMW or Gothic source was opened.**

## Contract gaps, resolved (Strategy ruling, 2026-10-06)

1. **Split stacks and mint keys.** The contracts model a unique mint key: `checkCustody` reads "one mint key = one instance", and the server's unique index enforces it. So a split half does not share its parent's key. It gets a derived child key: the parent's key + `::s` + the parent's version at the split, which never repeats because the parent's version bumps on every split. `mintRoot` strips the suffix back to the key the server minted, and merges and conservation group by that root. `checkInventory` now applies `checkCustody` with no exception. Tests:
   - the seeded property run checks `checkConservation` after every op, trades included;
   - a split followed by a second merge of the same half is refused with the state unchanged;
   - a replayed stale half is named by `checkConservation`;
   - a forged row sharing a child key is refused by custody.

   Selling is not covered, because neither this module nor the contracts have a sell yet. A sell must record its burn in the ledger.
2. **64 slots and trading.** `PACK_SLOTS` in `items.ts` is the one constant. The bag reads it, and so does `settleTrade`. `settleTrade` now takes `packSizeOf` and fills each receiver only up to its real pack size, from its actual holdings. `settle` passes each `Inventory`'s own `packSize`. Tests:
   - a trade into a nearly full pack is refused, with both states byte-identical;
   - a trade that exactly fits settles;
   - the contracts' own tests cover a 1-slot receiver and bad sizes.
3. **Who checks one of each.** This module checks one of each over this character's pack, bank and paperdoll. The account vault, the player's other characters and open trade escrows are outside an `Inventory`, so the server still runs `checkOneOfEach` over the whole account in the same transaction.

## Not done

- opening and changing trades (`settle` covers settlement only);
- selling;
- drop tables and loot rolls;
- server persistence: there is no table, receipt, version compare-and-swap across rows, or rate budget;
- the account vault, guild vault and bag sockets;
- currency;
- any UI.

## Checks

These run on the VPS, never on the shared Mac:

```sh
node --test tests/origins-inventory.test.ts
node --test tests/origins-contracts.test.ts
npx tsc -p <temp tsconfig extending ./tsconfig.json, types [vite/client, node], include origins/inventory, origins/contracts, src/vite-env.d.ts>
npx eslint origins/inventory origins/contracts
```
