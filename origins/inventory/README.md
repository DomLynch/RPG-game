# Origins O2: backpack + bank

A pure TypeScript module for a character's backpack and bank. It covers items 2 and 3 of "What we build first" in `docs/specs/origins/item-loot-storage-summary.md`. It builds on the O1 contracts (`origins/contracts/`) and reuses their `ItemInstance`, ids, `Result`/`Issue`, `moveItem`, `equipItem`, `checkCustody`, `checkOneOfEach` and `CONCORD_EXCHANGE`. It does not redefine them.

**Status:** prototype only. Nothing in `src/` imports this folder, and the live game is unchanged. There are no new dependencies.

## What it does

- **One authority.** An `Inventory` is a list of one character's instances. Each instance carries its own single `location` (`pack`, `bank` or `equipped`), and the grid is a view over those locations.
- **Backpack and bank use one slot-grid type.** The grids are fixed-size, and there is no weight. The default sizes are the contracts' caps (pack 64, bank 1,000), because `settleTrade` fills a pack up to 64. A smaller grid can be opened.
- **Operations:**
  - `receive`, `remove`
  - `move`: to an empty slot, or a swap with the occupant
  - `deposit`, `withdraw`
  - `split`, `merge`
  - `canWear`, `equip`, `unequip`
  - `gridView`, `openInventory`, `checkInventory`

  Every operation is atomic: you get the new state, or a refusal with a reason and the input unchanged. Before returning, each operation runs the full invariant (`checkInventory`) on its result.
- **Stacking.** Armour, and any other stack-1 piece, never stacks. Stackables split, and merge back up to their definition's `stack`, all or nothing. A merge needs equal provenance, history, binding, tier and upgrade level, so it can never launder one stack's origin into another's.
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

## Contract gaps

1. **Split stacks and mint keys.** `checkCustody` reads "one mint key = one instance". A split half must keep its parent's provenance unchanged, and that includes its mint key, so the halves share it. `checkInventory` accepts a shared mint key only for a split family: the same stackable item with byte-equal provenance. Every other `checkCustody` rule applies unchanged. The contracts need a v2 rule for this, either "mint key unique per single-copy item" or a `split` history entry.
2. **`settleTrade` pack size.** `settleTrade` places received pieces up to `PACK_SLOTS` (64) and does not know a smaller grid. Until trading reads the grid size, keep `packSize` at 64.
3. **Who checks one of each.** This module checks one of each over this character's pack, bank and paperdoll. The account vault, the player's other characters and open trade escrows are outside an `Inventory`, so the server still runs `checkOneOfEach` over the whole account in the same transaction.

## Not done

- trading and gifting;
- drop tables and loot rolls;
- server persistence: there is no table, receipt, version compare-and-swap across rows, or rate budget;
- the account vault, guild vault and bag sockets;
- currency;
- any UI.

## Checks

These run on the VPS, never on the shared Mac:

```sh
node --test tests/origins-inventory.test.ts
npx tsc -p <temp tsconfig extending ./tsconfig.json, types [vite/client, node], include origins/inventory, origins/contracts, src/vite-env.d.ts>
npx eslint origins/inventory
```
