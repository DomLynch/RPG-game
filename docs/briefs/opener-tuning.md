# Opener tuning: how often foes swing now (one page for Dom)

**The short version.** With the sandbox timers on (specials from level 1, first special 2 s in, one every 6 s), foes swing about **30% less often** than before, and their first swing comes 2 to 5 s later. Nobody ever waits more than about 13 s for a first swing in the runs below. This is the sandbox feel you approved, not a bug. The only question is whether you want it softer.

**How it was measured.** The real fight engine, no browser: the veteran warden at foe levels 1 to 10, the player draws and then stands still, 60 s cap, three seeds (731, 9, 12345). Re-run it with `node scripts/sim-table.ts`.

## First foe swing (seconds after the fight starts; seeds 731 / 9 / 12345)

| Foe level | Before RV80 (no specials below level 16) | RV80, no opener row | RV80 + level-1 opener row (10 s) |
|---|---|---|---|
| 1 | 3.2 / 4.5 / 3.2 | 5.4 / 7.5 / 13.4 | 3.2 / 4.5 / 3.2 |
| 2 | 3.2 / 8.4 / 3.2 | 5.4 / 8.8 / 7.1 | same as no opener |
| 3 | 3.2 / 4.4 / 3.2 | 5.4 / 7.3 / 10.7 | same |
| 4 | 3.2 / 4.3 / 3.2 | 5.4 / 7.2 / 5.4 | same |
| 5 | 3.2 / 4.3 / 3.2 | 5.4 / 5.4 / 5.4 | same |
| 6 to 10 | 3.5 / 5.2 to 5.3 / 3.5 | 5.5 / 6.4 to 8.2 / 5.5 | same |

## Swings per minute (average of the three seeds)

| Foe level | Before RV80 | RV80, no opener row | RV80 + opener row |
|---|---|---|---|
| 1 | about 23 | about 13 | about 15 |
| 2 to 10 | about 29 | about 18 | about 18 (the opener row only covers level 1) |

Foes also cast a special 5 to 9 times a minute now (none before), and the first one lands 2.7 s in. That is what pushes the first swing out and thins the swings.

## What the opener row does

`foeOpeners` in `src/fight/rows80-defs.json`: the level-1 warden's first special is ready at 10 s instead of 2 s, so its first move is a telegraphed swing, not a shove. It exists so the first fight shows the player a blow to parry. It is data: change `ticks` (600 = 10 s) or `maxLevel` (1) and nothing else.

## Your options

1. **Leave it.** The sandbox feel, as shipped. First fights open with a shove at 2.7 s and the first swing lands at about 5 s.
2. **Widen the opener** (`maxLevel` up to 10): every foe's first special waits 10 s, so first swings should come back to about 3 to 5 s (measured only for level 1 above; the other levels would need a re-run).
3. **Soften the timers** (`first` 120 and `cooldown` 360 ticks in the same file): fewer specials per minute, so more swings. Plain numbers, easy to try, not measured yet.

Caveat: an idle player, one warden, three seeds, 60 s, so fights end early when the player dies. It shows the direction and size of the change, not a balance verdict.

---

# Which creature fights in which mood (a second decision for Dom)

**Today.** Every creature picks a stance mood at the start of a fight: half the time its **home** stance, the other half spread evenly over the other three (Balanced, Aggressive, Defensive, Trickster). Each creature already has a `home` row in the catalogue (`src/fight/catalogue-data.ts`). Only three differ from Balanced: the goblin (Trickster), the executioner (Aggressive), the shieldmaiden (Defensive). Everything else (wolf, boar, bear, salamander, cave troll, minotaur, wraith, werewolf, skeleton, the rest of the Pit) is Balanced, so a troll is a coin flip.

**The mechanism (built, on hold).** One new number per creature, `homeShare` (0 to 1): the share of its fights it opens in its home stance. Absent = 0.5, exactly today's split, so nothing changes until a row sets it. Branch `combat/creature-stance-bias`. It moves the record version, so it ships in one bump together with the rows you pick (RV83 after Characters' bow and staff RV82); Lead decided not to spend a version on the mechanism alone.

**Proposed table (my starting suggestion; the identities are guesses from each creature's role, you decide).** Stances: Aggressive hits harder and wears the foe's posture down but blocks worse; Defensive hits softer but takes less and recovers faster; Trickster nudges feints and kicks.

| Creature | home | homeShare | One line why |
|---|---|---|---|
| Cave troll | Aggressive | 0.85 | The heavy bruiser: it should almost always come at you (your own example: "a troll is always Aggressive"). |
| Boar | Aggressive | 0.90 | A charger; one note, almost never changes its mind. |
| Wolf / Ember wolf | Aggressive | 0.70 | Presses the attack, with enough variety that two wolves do not look the same. |
| Bear | Defensive | 0.60 | Bulk: it waits out your swing and answers. Not fully reliable. |
| Giant salamander | Defensive | 0.70 | Armoured and slow; it makes you come to it. |
| Goblin | Trickster | 0.65 | Already Trickster; a skirmisher that feints a lot, still varied. |
| Werewolf | Aggressive | 0.75 | A frenzied pack hunter like the wolf, a step more reliable. |
| Minotaur / Wraith / Skeleton | Balanced | 0.50 | No identity proposed: left as today. |
| Pit wardens (veteran to shieldmaiden) | unchanged | 0.50 | The ladder keeps its variety, and old Pit records stay verifiable; only the executioner (Aggressive), shieldmaiden (Defensive) and goblin (Trickster) keep their existing home. |

Not measured: how these moods change a fight. If you want numbers, the sim table tool can be pointed at a stance before we pick.

**Where the idea comes from (reuse-first).** I found, but did not study in depth, three donors that put a per-creature chance on a creature's behaviour as a plain data field: AzerothCore's `smart_scripts` table (an `event_chance` column on each creature script row), EQEmu's per-NPC `special_abilities` field, and 2004Scape's per-NPC `.npc` configs (`attackrate` and similar params). The common pattern is the one we use: the creature's row says how often, the engine only reads it. None of them has a "stance mood", so the table above is ours.
