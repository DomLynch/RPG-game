# PROPOSAL: blacksmith upgrade costs (for Strategy)

**Status: proposal only. Nothing here is decided.** The numbers are a starting curve for Strategy and Dom to move. The contract, `UpgradeCostTable` in `origins/contracts/economy.ts`, holds prices as data with a `revision`, so changing a number is a data change. The code does not change.

Author: impl-o1-contracts, 2026-10-06. Ruling: Dom, 2026-10-06 (NPC services instead of player crafting; the blacksmith upgrades gear the player owns).

## What a level buys (already fixed by the contract)

- **One rung per level.** Each upgrade level makes the piece count one rung higher on its own slot's existing score: `SLOT_WEIGHT[slot] × (effective tier − 1)` in `src/gear-stats.ts`.
- **Clamped at Origin.** The effective tier never passes Origin. An upgrade that would add nothing is refused and never charged. That covers a Crest or Shield (weight 0) and a piece already worth Origin.
- **Rank to wear.** A Gladiator-won helmet at +2 counts as a Champion helmet, and its wearer needs Champion rank (`equipItem`). The smith also refuses to sell a level whose rank the payer does not have.
- **No pay-to-win past the caps.** The most an upgraded piece can be worth is what the same piece would be worth if won at the payer's own rank, and never more than an Origin piece. A full kit therefore stays inside Attack 1.15 / RES 0.80. Coin buys keeping a favourite or traded piece current, never power the Pit does not already hand out at your rank.
- No timing changes, ever. Every number is a damage multiplier.

## Income assumption (needs a decision)

> TODO(Stats/Strategy): the coin-per-win figure below is a placeholder (Strategy, 2026-10-06). It is set from real beta data, not now.

There is **no currency in the shipping game yet**. This proposal assumes one Pit win pays

> **coin per win = 20 × tier level** (Recruit 20, Gladiator 60, Champion 100, Origin 200)

so income grows with the ladder and an Origin player farming the Pit is the main source. World bosses would pay a similar amount under ruling 7. Ordinary mobs pay much less.

## Proposed curve (common rarity)

Level L is priced at **(1 + L/2) wins** of income at the lowest rank that can wear it. The reference is a Recruit-won piece, the most expensive case, so its level-L wearer is at tier L + 1:

`cost(L) = 20 × (L + 1) × (1 + L/2)`

| Level | Coin (common) | Wearer tier at minimum | Income per win there | Wins of income | Materials (proposal) |
|---|---|---|---|---|---|
| 1 | 60 | Legionary (2) | 40 | 1.5 | none |
| 2 | 120 | Gladiator (3) | 60 | 2.0 | none |
| 3 | 200 | Veteran (4) | 80 | 2.5 | none |
| 4 | 300 | Champion (5) | 100 | 3.0 | 2 × grave iron |
| 5 | 420 | Praetorian (6) | 120 | 3.5 | 3 × grave iron |
| 6 | 560 | Master (7) | 140 | 4.0 | 4 × grave iron |
| 7 | 720 | Primus (8) | 160 | 4.5 | 4 × grave iron + 1 boss trophy |
| 8 | 900 | Invictus (9) | 180 | 5.0 | 5 × grave iron + 1 boss trophy |
| 9 | 1,100 | Origin (10) | 200 | 5.5 | 6 × grave iron + 2 boss trophies |
| **Total** | **4,380** | | | **31.5** | |

A piece won at a higher rank needs fewer levels: a Gladiator piece tops out at +7. Its player also already earns more per win, so the same price list costs them fewer wins.

**Whole kit:** six weighted armour pieces plus a weapon, taken from Recruit to Origin worth, is 7 × 4,380 = 30,660 coin, about 150 Origin-rank wins. That is a long sink by design, because almost nobody upgrades from Recruit: the normal path is to win pieces at your own rank, which is free.

## Rarity multipliers

Rarity is a label, never power (contract rule), so the multiplier is a **sink and a prestige price**, not a power price:

| Rarity | Multiplier | Level-1 / level-9 cost |
|---|---|---|
| common | × 1.0 | 60 / 1,100 |
| fine | × 1.25 | 80 / 1,380 |
| rare | × 1.5 | 90 / 1,650 |
| relic | × 2.0 | 120 / 2,200 |

Prices are rounded up to the nearest 10. Why rarer costs more: players keep and show off rare and relic pieces, so they pay more to keep them current. The extra coin leaves the economy, which is the sink. Strategy may prefer a flat price (× 1.0 for all) so that rarity carries no cost at all. Both fit the contract.

## Why these numbers

- **A currency sink, but one that is never required.** Winning gear at your rank is free. Upgrades are for attachment (a favourite or traded piece, a relic) and for players with excess coin. That matches blueprint §8 ("keep faucets and sinks measurable") and §7 ("no destructive gear treadmills").
- **Early levels are cheap and late levels steep.** A new Gladiator can afford a first level within a couple of wins and learns the service exists. Late levels cost several wins each, so the sink is real at the top, where the coin is.
- **Materials from level 4 tie the forge to the world.** Grave iron from regional mobs, and trophies from named bosses at the top end, give world play a reason without making materials mandatory early. The item ids are placeholders until O6 content exists.
- **The caps stay out of reach of money.** Whatever the prices, the contract's clamp and rank check hold. Prices only control how fast a player reaches a power level the Pit already allows at their rank.

## Open questions for Strategy

1. Coin per win: 20 × tier, or flat? This sets the whole scale.
2. Should coin ever be sold for real money? **Recommendation: no.** Membership (ruling 3) unlocks realms, not coin, so "no pay-to-win" holds outside the caps too.
3. Rarity multipliers, or flat?
4. Should the smith refuse levels above the payer's rank (as proposed and built), or allow them with the piece unwearable until the player ranks up?
5. Should a level ever be removable or refundable? Proposal: no refunds. Selling or trading an upgraded piece is the exit.

## As a cost table (revision 1, common and relic shown)

```json
{ "kind": "upgrade-cost-table", "schemaVersion": 1, "id": "costtable:exchange-forge", "revision": 1, "currency": "coin",
  "rows": [
    { "level": 1, "rarity": "common", "coin": 60, "materials": [] },
    { "level": 4, "rarity": "common", "coin": 300, "materials": [{ "item": "item:grave-iron", "quantity": 2 }] },
    { "level": 9, "rarity": "relic", "coin": 2200, "materials": [{ "item": "item:grave-iron", "quantity": 6 }, { "item": "item:boss-trophy", "quantity": 2 }] }
  ] }
```

(Abridged: a real table lists every level 1..9 for every rarity it prices, with no gaps. The validator refuses gaps.)
