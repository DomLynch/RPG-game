# EQEmu behaviour spec: inventory and item instances (reference only)

- Donor: EQEmu (GPLv3), commit `4aceae18b94ffaafc08e2b17bc41cd72c77f795d`, read-only at `/opt/frankendom-shadow/work/expansion-donors/EQEmu` on the VPS.
- Spec author: analyst-eqemu. Clean-room: behaviour only. No donor source. Decision: **reference**. Frankendom should not copy this slot scheme; it is tied to the EverQuest client's numbering. Use it as a checklist of the concepts an item system needs.

## 1. Purpose

Separate the static item definition ("ItemData", one row per item id) from item instances (a specific copy a player owns, with charges, augments and attunement) and place instances in numbered slots: worn, general, bags, cursor, bank.

## 2. Files

| Path:line | What |
|---|---|
| common/item_data.h:337-492 | static fields: NoRent 366, NoDrop 367, LoreGroup 372, LoreFlag 373, FVNoDrop 377, BagSlots 388, BagSize 389, MaxCharges 434, Attuneable 486, Stackable 489, StackSize 492 |
| common/item_instance.h:336-370 | instance fields |
| common/item_instance.cpp:207-222, 900-930 | IsStackable, IsCharged, IsDroppable |
| common/inventory_profile.h:123-232 | PutItem, PushCursor, SwapItem, DeleteItem, CheckNoDrop, HasItem, HasItemByLoreGroup, FindFreeSlot, CalcSlotId, CalcBagIdx |
| common/inventory_profile.cpp:250-470, 759-900, 1061-1200 | implementations |
| common/patches/rof2_limits.h:77-205, 219-250 | slot numbering and sizes |
| zone/inventory.cpp:171-182 | Client::CheckLoreConflict |
| zone/inventory.cpp:1150-1300, 2030-2040 | stack merging on loot and on moves |

## 3. Model

**ItemData (static)**: id, type, slot bitmask (which worn slots it fits), AC, HP, damage, Size (0 tiny … 4 giant), container fields (BagSlots: number of slots, BagSize: largest item size it accepts, BagType incl. quiver/bandolier), NoDrop (0 = no-drop), NoRent (0 = vanishes on logout), Lore (LoreFlag; LoreGroup −1 = unique by item id, >0 = unique per group, 0 = not lore), Stackable + StackSize, MaxCharges (−1 or 0 = not charged; >1 = charged), Attuneable, NoPet.

**ItemInstance**: pointer to ItemData; charges (int16; for stackables this is the stack count); attuned flag; serial number (int32 unique id per instance, used for trading/bazaar identity); contents map index → child instance (bag contents, or augment sockets 0-5); custom data string map; evolving-item XP/level; ornamentation ids; recast timestamp; price/merchant fields.

**Slots** (server numbering = RoF2 client): worn 0-22 (charm, ear1, head, face, ear2, neck, shoulders, arms, back, wrist1, wrist2, range, hands, primary, secondary, finger1, finger2, chest, legs, feet, waist, power source, ammo); general 23-32 (ten pack slots); cursor 33 (a queue — unlimited depth); bank 2000-2023 (24); shared bank 2500-2501; trade 3000-3007; tribute 400-404. World container 4000-4009. Bag contents get computed ids in consecutive server ranges (common/emu_constants.h:219-247), each parent reserving 200 sub-slots: general bags start right after the world range at 4010 (sub-slot id = 4010 + (parent − 23)·200 + index, so 4010-6009), then the cursor bag (200), then bank bags (24·200), shared-bank bags (2·200), trade bags (8·200). The RoF2 limits header separately lists 251 / 351 / 2031 / 2531 / 3031 as bag bases; the server ranges above are the ones the inventory code uses. Only `BagSlots` (2-10 in data) of the 200 reserved are usable. Augment sockets: 6 per item.

## 4. Rules (behaviour)

- **Stacking**: an instance stacks if its ItemData is stackable. Merging into an existing stack of the same item id fills up to StackSize; remainder stays in the source or goes to the next stack. Charges field doubles as count.
- **Charges**: items with MaxCharges > 1 are "charged". Deleting a quantity subtracts charges; at ≤ 0 the instance is destroyed only if stackable, or MaxCharges = 0, or expendable; otherwise the empty charged item is kept.
- **No-drop**: an instance is droppable/tradable only if not attuned and NoDrop ≠ 0, and (recursively) all its contents are droppable. Server rule World:FVNoDropFlag can lift it. Character:MinStatusForNoDropExemptions (80) lets GMs trade no-drop.
- **Attunement**: an attuned instance is treated as no-drop.
- **Lore**: a player may not receive a lore item if they already hold (anywhere except the shared bank) the same item id (LoreGroup −1) or any item of the same lore group (>0). Checked when summoning, looting, buying, trading.
- **Free slot search** (FindFreeSlot): first empty general slot (slots 9-10 only if the expansion setting includes them); otherwise (unless placing a bag) first free sub-slot in a general bag whose BagSize ≥ the item's size (quivers only take arrows); otherwise the cursor if allowed; else none.
- **Container fit**: item Size ≤ container BagSize; quiver accepts only arrows; bandolier has its own type restriction.
- **NPC loot**: dropped items become instances with charges = the loot entry's `item_charges` (see eqemu-loot.md).

## 5. Plumbing to strip

Everything: client slot numbering, packets, DB persistence, bazaar, trader, tribute, shared bank, evolving items, ornamentation, bandolier, item recast timers.

## 6. Golden cases (concept level)

- G-I1 Stack: holding 15/20 arrows, loot 10 → stack 20/20 + new stack 5.
- G-I2 Lore: holding lore item 1001 (group −1) → second 1001 refused; holding any item of lore group 77 → another group-77 item refused.
- G-I3 No-drop inside a bag: bag droppable, contains a no-drop item → bag not tradable.
- G-I4 Charged: wand MaxCharges 5, charges 1, use 1 → charges 0, wand kept (not stackable, not expendable).
- G-I5 Fit: Large item (size 3) into a bag with BagSize 2 → refused.

Real-server goldens are not planned for this system (reference only).
