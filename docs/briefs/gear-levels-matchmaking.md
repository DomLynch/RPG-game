# Brief: gear stats by level, Origin I–V, PvP level bands (Dom, 2026-09-29)

From Dom (owner) via Strategy. **Post-beta** unless Dom says otherwise: the Pit, Duel and Hades ship first. Duel records the Loadout from day one (Lead's slot in the record format).

## 1. Stats = 100 + level

- Every fighter (player and opponent) has **Attack** and **Defence**. Base 100, +1 per level. Origin V (level 50) = 150.
- **Damage = base hit × attacker Attack ÷ defender Defence.** One formula, nothing else.
- Equal levels cancel exactly (130 ÷ 130 = 1), so every current balance pin (fight length, kill times, finisher windows) must replay unchanged at equal level. That test is the proof nothing broke.
- The player's **weapon level sets Attack**, the **armour level sets Defence**. No allocated points, no STR/DEX (Dom: gear is the build). Opponents use 100 + their fight level.
- **No stat changes timing:** swing speed, wind-ups, parries, rolls and reach stay per weapon/armour TYPE, never per level.
- Replaces `src/gear-stats.ts`'s caps (+15 % / ×0.80). Re-pin on purpose (fix-forward), never by loosening a test.

## 1b. Armour slots, shield and crest

Defence = 100 + Σ(piece level × slot share). Shares already in `src/gear-stats.ts` SLOT_WEIGHT, summing to 100 %, so a full level-50 set is exactly +50:

| Slot | Share |
|---|---|
| Body | 30 % |
| Helmet | 20 % |
| Greaves | 18 % |
| Arms | 12 % |
| Boots | 12 % |
| Gloves | 8 % |
| Crest | 0 %: a rank badge; its card says "Rank badge", no number |
| Shield | 0 % of Defence (Dom 23 Sep: no flat damage cut, it would pay twice) |

**Shield = its own stat, Block = 100 + shield level** (Dom 2026-09-29). It applies ONLY to hits taken while blocking: a better shield lets less of a blocked hit through and costs less stamina/posture to hold. Nothing on unblocked hits, so there's no double-count with Defence. The card reads "Block 140 (+12)", never "Defence 0". The shield keeps its guard profile (two sides, stops heavies).

## 2. Origin I–V: max level 46 → 50

- Levels 46–50 = Origin I, II, III, IV, V (every rank now has 5 levels). `MAX_LEVEL` 46 → 50.
- A saved player at 46 becomes Origin I; nobody loses progress.
- The Origin legend stays the same across I–V. Labels, Sparring picker and ladder UI follow.

## 3. Duel: gear counts, level bands

- Gear power counts in every Duel (Dom: "gear-based duels, that's what makes it competitive"). The Loadout is in the verified match record, never client-trusted.
- Allowed level gap:

| Player level | Can fight |
|---|---|
| 1–20 | ±5 |
| 21–35 | ±7 |
| 36–50 | ±10 |

- A match needs the gap inside **both** players' bands (the lower player's band protects them).
- The queue tries the closest level first and widens over time: about a third of the band at once, two thirds after ~10 s, the full band after ~20 s. Friend challenge links: any gap, opponent's gear shown first.

## 4. Pit item cards

Show Attack or Defence and the change against what's worn ("Attack 140, +12").

## Order

1. Stats lane: 100 + level table, re-pins.
2. Combat: wire the formula into the sim behind a flag; equal-level replay test; bot battery at ±5/±7/±10 gaps.
3. Web/Career: Origin I–V, MAX_LEVEL 50, save migration.
4. Duel: bands + widening queue when matchmaking lands.
5. Pit: cards.

All numbers (bands, widening times, +1 per level) are Dom's starting values; tune after real play.
