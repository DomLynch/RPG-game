# Items, loot and storage: which game to borrow from, per layer

One page for Dom. The full scorecard, with scores and the evidence from each game's code, is in the research repo at `scorecard/item-loot-storage.md`.

The three games we compared:
- **World of ClaudeCraft**: open licence, so we may reuse its code.
- **EverQuest** and **Ultima Online**: we may only copy their rules, written up as a description, never their code.

None of them changes how fights work or what gear is worth. That is still Attack and RES only, capped at +15% and −20%, and settled before the fight starts.

| Layer | Pick | Why, in one line |
|---|---|---|
| What an item *is* | Ultima Online's shape, EverQuest's rule | Every copy gets its own number and lives in exactly one place, so it can't be in two pockets at once. "You can only own one of each piece" is the rule EverQuest already enforces. |
| Loot and drops | EverQuest's rules, run on ClaudeCraft's dice | EverQuest has the fullest drop rules: how many items can drop, named rare drops, and less loot for beating someone far below you. ClaudeCraft's dice roll the same way every time when re-checked, so our server can re-check them. |
| Backpack | ClaudeCraft | Fixed slots, not weight; armour never stacks; tap-to-act menus already built for phones; free to reuse. |
| Bank | ClaudeCraft's shape, Ultima Online's rules | The bank is the same slot grid as the backpack, opened at a place in town (the Concord Exchange). A deposit goes through whole or not at all, never half. ClaudeCraft's bank is the one that has been hardened against real duplication bugs. |
| Trading and gifts | ClaudeCraft's shape, EverQuest's rule | Both players must tick again after any change. The server checks there is room before the swap, so nothing gets lost on the floor. A trade is refused if it would give someone a second copy of a piece. |
| Crafting | Out for now (Dom, 2026-10-06) | Nothing is designed or built. The item records leave room for an upgrade level later without moving anyone's items. |

## The hybrid in short

Ultima Online gives us the way items are held: one number per copy and one owner at a time. EverQuest gives us the rules: one of each piece per player, and the drop tables. ClaudeCraft gives us the parts the player touches: backpack, bank and trade screens. It also gives us the safety measures it built after real duplication bugs, which is code we are allowed to reuse directly.

## What we build first

1. **Give every piece its own number and a single owner on the server.** A piece you won also records its rank (Recruit … Origin), and that rank is what finally lets gear carry its stats. Old app versions must be taught to leave these new numbers alone before the server starts handing them out, or an old phone could wipe them.
2. **The backpack**: a slot grid using ClaudeCraft's move logic, so moving a piece either fully happens or doesn't happen at all.
3. **The bank at the Concord Exchange**, using the same grid and the same move.
4. **Drop tables on the server**, only when the world needs drops beyond "take one piece from the man you beat". The server rolls them after it has checked the fight, never the phone.
5. **Trading and gifting after that.** Crafting is out for now.

## Dom's decisions (2026-10-06)

1. **Pit-won pieces can be traded.** You win one piece per kill (beat Thor, take the helmet), and later you can trade Hades' legs for Thor's arms. The guardrails keep the win meaningful:
   - every piece permanently carries where it came from (won by whom, from which legend, at which rank, on which date), shown when you inspect it and kept through every trade;
   - one of each piece per player still holds, bank included;
   - trades happen only at the Concord Exchange, and Ultima Online's 12 trade tests are the pass/fail bar;
   - wearing a piece still needs its rank.
2. **Crafting is out for now.** Nothing is designed or built for it, and chapter one needs no world materials. The item records leave room for an upgrade level to be added later without moving anyone's items.

Moving today's items to this model touches live claims, so it stays a proposal until the arena Lead and Backend sign off, and nothing changes before the beta.
