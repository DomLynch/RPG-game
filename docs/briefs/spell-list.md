# Brief — the spell list (15 spells across the ten levels)

Owner: Combat. Written 2026-10-15 for Strategy/Lead's review. **Docs only**: no rows, no code, no RV or WSV change. A later PR turns the table into rows.

## Why
The cast is wired (spells-in-fights RV53; the open-world wire-up is #2778), but the player-facing list is the 700 boss spells, each a legend name pointing at one of nine roots. Nobody can see a *game's* worth of spells in that. This brief picks **15 curated spells**, one or two per level 1-10, that a new mage actually meets and chooses between. Every spell is a row in the existing catalogue (`spell-index.json`: id -> root, level 1-10), so the list adds **no new root, no new field, no new sim rule**.

## What a spell is (facts read from trunk, 2026-10-15)
- A cast is the special slot's special (`src/fight/spell-cast.ts`): **windup 120 ticks (2 s), cooldown 1200, recovery 45, reach 3** are `RULES.special`, shared by every spell. Timing is sacred, so **no spell gets its own windup**. The sheet below therefore differentiates by cost, school, landing share and the fx verb, not by timing.
- Cost = root cost + root costPerLevel x level (stamina, pool max **100**). Landing share = `RULES.special.damage` x magnitude x (1 + 0.1 x (level - 1)). Outcome (critfail/fail/partial/success/crit) comes from the caster's school skill against 2 x cost.
- Roots (nine): crack/earth 30+3L, baying/poison 25+3L, theRing/holy 35+4L, gale/wind 30+3L, longShadow/shadow 25+3L, ashfall/fire 30+3L, threeBlows/fire 45+5L, theWord/holy 40+4L, harvest/shadow 55+6L.
- The catalogue today (700 ids): L1-L3 is crowded with longShadow/crack/gale/baying; theRing is mostly L9-L10; threeBlows L5-L9; theWord L5-L9; harvest has only 3 spells (L6, L8 x2).

## The list
Costs are the row formula; "tier" is the caster's difficulty at a flat skill (cost 2x is what the outcome band compares against).

| # | Level | Spell (display name) | School | Root | Cost | Fx verb reused | New fx? |
|---|---|---|---|---|---|---|---|
| 1 | 1 | Ember Prick | fire | ashfall | 33 | witchfire gout, school colour orange | no |
| 2 | 1 | Hound's Bay | poison | baying | 28 | miasma mark (green icon + wash) | no |
| 3 | 2 | Long Shade | shadow | longShadow | 31 | miasma mark, shadow purple | no |
| 4 | 2 | Gale Cut | wind | gale | 36 | charge dust line, pale wind colour | no |
| 5 | 3 | Cracked Ground | earth | crack | 39 | charge dust line, earth brown | no |
| 6 | 4 | Rot Breath | poison | baying | 37 | miasma mark + scorch patch | no |
| 7 | 4 | Three Blows | fire | threeBlows | 65 | witchfire gout x3 along the 45-tick active window | no (reuses gout 3 times) |
| 8 | 5 | Warding Ring | holy | theRing | 55 | witchfire glow, gold, around the caster | no |
| 9 | 5 | Ashfall | fire | ashfall | 45 | witchfire embers falling on the target | no |
| 10 | 6 | Rolling Gale | wind | gale | 48 | charge line, longer, with a dust burst | no |
| 11 | 6 | The Word | holy | theWord | 64 | witchfire glow on the target's head | no |
| 12 | 7 | Quake | earth | crack | 51 | charge line + scorch patch (cracked ground) | no |
| 13 | 8 | Deep Shadow | shadow | longShadow | 49 | miasma wash, wider | no |
| 14 | 9 | Unbroken Ring | holy | theRing | 71 | witchfire glow, caster + target | no |
| 15 | 10 | Threefold Reckoning | fire | threeBlows | 95 | witchfire gout x3 + scorch | no |

Every level 1-10 has at least one spell. Spread: fire 4, poison 2, holy 3, shadow 2, wind 2, earth 2. Display names are working names; the rows keep the legend ids already in `spell-index.json` (a spell is bound to the boss whose kill takes it, programme 2b), so each line above must pick **one existing id at that root and level**. Picking the ids is the first step of the rows PR; where a (root, level) pair has several, take the one whose legend fits the name.

## What this deliberately leaves out
- **Frost (Lead's ruling, 2026-10-15).** There is no frost root brick. Frost ships as a **slow built from existing bricks**; a real frost root is a later brick PR, not part of this brief. Caveat found on trunk: `cc-defs.json` has only stun, knockdown and root (no slow kind), so "slow" cannot be a pure data row today. Until Lead says otherwise the list stays at six schools and frost is a follow-up row set: either a `slow` CC kind in `cc-defs.json` (a row, reviewed for RV) or the existing root family at a shorter step. Not in the 15.
- **Harvest cost (Lead's ruling: a bug).** No spell may cost more than the stamina bar. Harvest L8 is 103 against 100. The fix is a data row plus a check: a `spell-cost-cap` row (value = the stamina pool default, read from `pool-defs.json`, not typed) that `resolveSpell` clamps to, and a test that every `spell-index.json` id resolves at cost <= the bar. Clamping to the bar makes it a spell that empties the bar; retuning harvest's `cost`/`costPerLevel` in `brick-defs.json` is the alternative. Combat's pick: **clamp**, because it fixes every root at once and touches no brick. It changes the cast cost, so it is an RV bump (rows PR). Harvest is still not on the starter list.
- **Per-spell windup/cooldown.** Would be a new row field and an RV bump; see the open question below.
- **Projectiles and travel time.** Not needed by any spell here; all land at the special's reach, which is why none of the 15 asks for new fx.

## Balance flags (for the tuning pass, not for this brief to decide)
- L9-L10 cost 71-95 of a 100 stamina bar: one cast empties the bar. That may be right for a capstone; say so on purpose or lower the per-level step.
- A spell's strength is its landing share (+10% per level), while cost rises 3-6 per level, so a level-10 spell is ~1.9x a level-1 spell's damage for roughly 2-3x its stamina. The fizzle odds at low skill are the real price, and they are PROVISIONAL (Lead, 2026-10-13).
- Same cooldown and windup everywhere means the choice between spells is **cost versus damage versus school**; the list reads as a menu, not a rotation. That is the point of the two-slot system, but it is a design call whether 15 spells with identical timing feel different enough.

## Open questions
1. **Two-slot system (Lead's reading of Dom, to be corrected by Strategy if wrong).** Dom's two UNIVERSAL special slots: any spell can go in either slot, and the slots are not tied to a class or school. So the 15 are a pool for both slots, not a per-class list. Whether the second slot is a second simultaneous cooldown is not settled by this reading; today's sim has one special slot.
2. **Per-spell timing.** A quick/heavy split (e.g. a 60-tick low-cost spell) would give the list a real rotation. It needs a `windup` field on the brick row, one RV bump and the interrupt tests; Strategy to say if wanted.
3. **Who picks the 15 ids** from the 700: Combat proposes in the rows PR; Characters owns the legend names and backstories (legends rule).

## Verification when the rows land
- `spell-index.json` unchanged; a starter-list row (id, display name) validated by the loader: each id is in the index, each (root, level) matches this table, levels 1-10 all covered.
- A test that every starter spell's cost is at most the stamina max, and that costs equal the formula above.
- The as-data gate: names and the list live in a row, not a literal (`npm run check:as-data -- --gate`).

Donor: EQEmu (spell difficulty vs skill, `CheckFizzle`) and AzerothCore `spell_dbc` (cost and effect as rows); shape only, already taken by RV53. No new donor code.
