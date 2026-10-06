# The living world: towns, rulers, war goals, rifts and the history book

- Status: **design spec, PROVISIONAL.** Every number is data, and Dom has not ruled on any of them. Docs only: no `src/`, no code,
  no JSON files.
- Binding: Dom's direction of 2026-10-06 (one shard, NPC-driven war goals, NPCs remember, permanent fixtures, the town history book,
  world rifts, a living economy, light seasons, player rulers who defend while offline, no AI chat NPCs). Strategy's rulings of
  2026-10-06 are quoted in §2 and win over anything else here.
- Built on: `feuds.md` (grudges, notoriety, town defence, succession, guards, NPC hunters, the deferred PvP bounty: read it first),
  `region1-ash-frontier.md` (zones, Bounties, bosses, loot), `trading.md` §3 (metals: one bound balance in bronze, never
  tradeable), `origins/world` (zones as data; world group #16 `town` comes from `feuds.md` §11), `origins/progression`
  (`TYPE_WEIGHTS`, first-win-only bosses, `MIN_CONTRIBUTION_PERMILLE`) and `origins/boss` (the world boss state machine, #1448).
- Standing rules, unchanged: **never gear loss**; every NPC strike is telegraphed and dodgeable; collect-N stays banned; travel stays
  short; twists are Origins encounter flags that never move the live ladder. **One deliberate exception:** clan perk templates
  apply in the Pit too (Dom's override, §10), with a `RECORD_VERSION` bump and a re-pinned RNG fingerprint.

## 1. The loop

The world is one shard. Every town is a data record with a ruler, a treasury and a prosperity score. Rulers are NPCs by default.
Every week a seeded **war-goal generator** reads the world's state: grievances between towns, their patrons, their wealth, the
deeds in their history books. It declares a few goals, for example "the Reeve of the Grey Ferry calls a raid on Cinder Hold over
the burned granary". Goals are announced a day ahead with their stakes shown. Players enlist on a side and fight duels: gate
captains, wall sergeants, granary watch. Every verified win pushes the shared score. When the goal closes, the outcome moves
treasuries and prosperity, can depose a ruler, and is written into both towns' history books for good.

Between wars, **rifts** tear open at random places and times, and anyone can race there to fight the boss for a personal loot roll.
Towns grow when players use and fund them, shrink when they are neglected or beaten, and can die. Deeds stay: a murder, a defence,
a statue, a pardon. Later, once the PvP verifier exists, players can be elected rulers and set their town's defenders, which raiders
fight as duels while the ruler is offline.

## 2. Rulings and hard lines

### Ruled (Strategy, 2026-10-06)

1. **History book and bans.** The history book is permanent and public. A **shop ban** in a town never decays, but a **new ruler**
   (NPC or player) may pardon it, and the pardon is written into the book. Notoriety (guards hunting) still decays as in
   `feuds.md` §4. This resolves Dom's "banned forever" example against the decaying-notoriety rule: the record is forever, the ban
   lasts until a pardon, and the hunting fades.
2. **One shard** is the design rule: one logical world, spatial interest management (you see and hear only nearby players), each
   duel its own server-authoritative instance, a town capacity, and an overflow-layer fallback that shares world state, history
   books and the economy. Backend writes the architecture note; this spec only lists questions (§13).
3. **Player lords:** designed now, built after the PvP verifier. Offline defence means raiders duel the lord's configured defenders.
   Clash-style guardrails: a raid shield after each raid, set raid windows, land never lost in one raid (it falls in stages), and
   nobody ever loses gear.
4. **Phasing** after Region 1, cheapest first: (a) rifts, reusing the world boss event #1448; (b) the history book (server log and
   town page); (c) NPCs remember; (d) NPC war goals with player recruitment; (e) player mayors and lords last. The beta is still the
   duel game.
5. **Hard lines:** no AI chat NPCs, ever; no trust-matchmaking; no become-the-boss.

### Ruled (Strategy, 2026-10-06, on the open list)

6. **Region 1 gets three towns:** the Exchange town, Cinder Hold and Mere End. War goals and the same-trade alert spread both need
   them (§12).
7. **Rulers are never grudge targets.** An ordinary grudge never targets a mayor or lord (a griefing guard). A ruler dies only at
   the climax of a **war goal or an avenge goal**, behind the town's strongest defence (rings, bouncer and patron strike). The death
   goes in the history book, with the succession rules (§4.8).
8. **The Lambton Worm** (Surtees, 1820) is approved as a rift boss (§8, §16).
9. **Pit legend and patron overlap is approved:** "the Pit fights the legend; a clan serves the patron" (§10.1).
10. **Phasing 0 to e** (§15) matches Strategy's re-sequencing. It waits on Lead confirming the order.

### Design lines this spec adds

- **No Nemesis-style NPCs.** The WB Nemesis patent runs to 2036. No NPC ranks up, gains power, gets new abilities or changes its
  behaviour because of personal encounters with a player, and no NPC sits in a hierarchy that reshuffles from such encounters. NPC
  memory is **town-level records only**: the history book, notoriety, faction standing and shop bans (§5). An NPC reads these
  records and picks a templated bark; it never becomes a different fighter because of them.
- **No free text anywhere a player can write into the world.** Plaques, statues, book entries, petitions and war cries are
  templates filled with ids. This is the anti-spam and moderation rule for every fixture.
- **No player ever moves metal to another player** through a town, a war, a donation or an office. Treasuries are town counters;
  donations are sinks; payouts are minted by fixed rules (§9). This keeps `trading.md` §3.1's anti-RMT case intact.

## 3. Towns as data

A **town** is a zone with a `town` group (`feuds.md` §11, world group #16), plus a content record that sets its starting values and a
shared state row that changes. The Concord Exchange is `safe`: fixed tier, never at war, never ruined, never ruled by a player. It is
the neutral ground for pay-offs, trading and allegiance.

### 3.1 Content: `town-definition`

```json
{ "kind": "town-definition", "schemaVersion": 1, "id": "town:grey-ferry", "zone": "ferry-landing",
  "region": "region:ash-frontier", "safe": false, "startProsperity": 420, "patron": "patron:zeus",
  "ruler": { "title": "reeve", "character": "character:reeve-tamsin", "temperament": "mercantile",
             "standIn": "character:steward-ferry", "successors": [] },
  "resources": ["ferry-toll", "eels"], "plots": "plots:grey-ferry", "statueSlots": "statues:grey-ferry",
  "riverside": true }
```

### 3.2 Shared state: `town-state`

| Field | Meaning |
|---|---|
| `prosperity` | 0–1000. The one number that drives tier, population, stock and prices |
| `tier` | `ruin`, `hamlet`, `village`, `town`, `city` (from prosperity, with hysteresis) |
| `population` | display only: how many NPCs stand in the zone, from the tier table |
| `services` | which service NPCs are open (smith, healer, fence, …); a dead one runs on its stand-in (`feuds.md` §5) |
| `defences` | the `town-defence` record (`feuds.md` §7.1) plus a `garrison` value (0–1000) that sets the NPC side's baseline in a war |
| `ruler` | `{ kind: npc \| player, character, since, termEndsAt, temperament }` |
| `treasury` | town metal in bronze. A counter, not a player balance |
| `hold` | 0–3 hold points (player lords only, §11.5) |
| `shieldUntil` | raid shield expiry (player lords only) |

### 3.3 Tiers (PROVISIONAL)

| Tier | Prosperity | NPCs | Services open | `vendorTier` | Plots | Statue slots |
|---|---|---|---|---|---|---|
| ruin | < 50 | 0 | none (a camp fire, the book, the statues) | — | 0 | kept, weathered |
| hamlet | 50–199 | 4 | 1 | 1 | 4 | 1 |
| village | 200–449 | 8 | 2 | 2 | 8 | 2 |
| town | 450–749 | 14 | 3 | 3 | 16 | 4 |
| city | ≥ 750 | 22 | 4 | 4 | 24 | 6 |

Hysteresis: a tier changes only when prosperity has been **25 points** past the boundary for a full day, and **at most once per
7 days** (`TIER_CHANGE_MIN_S` 604800). Prices follow the zone's `economy.buyMultiplier`: ×1.10 at hamlet, ×1.00 at village and
town, ×0.95 at city.

### 3.4 How towns grow and shrink

Prosperity updates **lazily** on read, one step per elapsed server day, like rested credit. No clock job.

| Input (per town, per day) | Change | Cap per day |
|---|---|---|
| Distinct players who used a service here | +1 each | +40 |
| Metal donated (§7.2) | +1 per 100 bronze | +30 |
| Housing occupied (§7.1) | +1 per occupied plot | +24 |
| Rift closed within the town's region (§8) | +10 to the nearest town | — |
| Rift left open (broke) | −30 to the nearest town | — |
| War outcome (§4.6) | as the outcome table | — |
| Ruler murdered (§4.8) | −40 once | — |
| Neglect | −12 | always applied |

A town nobody visits loses 12 a day, so a village at 300 falls to hamlet in about 9 days and to ruin in about 21 more.

### 3.5 How towns die and come back

- **Death.** A town below 50 for **14 consecutive days** becomes a **ruin**. Its services close, its NPCs leave, its houses close
  and their contents go to their owners' banks (never lost), and its book gains the closing line. Statues and plaques stay,
  weathered. Its live grudges and war goals lapse with no penalty.
- **War cannot kill a town.** A war outcome never takes prosperity below **120** (`WAR_PROSPERITY_FLOOR`). Only neglect kills.
- **Region floor.** A region keeps at least **2** living non-safe towns (`REGION_TOWN_FLOOR`). Neglect stops at 50 for the last two.
- **Resettlement.** A ruin reopens as a hamlet at 100 when donations to it reach **20,000 bronze** in total
  (`RESETTLE_BRONZE`, pooled from any number of players, a pure sink), or when the generator rolls a `resettle` goal for a
  neighbouring city (§4.3). The new ruler is an NPC. The book records the resettlement and the top donors (§6).

## 4. NPC rulers and the war-goal generator

### 4.1 Rulers

Every non-safe town has a ruler: a **reeve** (hamlet, village), a **mayor** (town) or a **lord** (city). A ruler is a
`CharacterDefinition` with a `ruler` block, a stand-in steward and a temperament. Rulers are original NPCs unless a later content
PR names a legend (legends rule). A ruler is never `essential`, so it can die (§4.8), but it is **never a grudge rival** (ruled).

**Temperament** is fixed data, chosen at content time or seeded at succession. It only weights which goal kinds a ruler declares.
It **never changes** because of what a player did: this is the Nemesis line.

| Temperament | Raid | Defend | Avenge | Tribute | Relief | Resettle |
|---|---|---|---|---|---|---|
| ambitious | 40 | 10 | 20 | 20 | 5 | 5 |
| vengeful | 25 | 10 | 45 | 10 | 5 | 5 |
| mercantile | 10 | 15 | 10 | 45 | 10 | 10 |
| cautious | 5 | 45 | 10 | 10 | 20 | 10 |

### 4.2 Goal kinds

| Kind | Declared by A against B | Players do | A wins → | B wins → |
|---|---|---|---|---|
| **raid** | grievance and a resource B holds | raiders duel B's gate captain, wall sergeant and granary watch; defenders duel A's raiding party at B's walls | A takes 10% of B's treasury (cap 3,000 bronze); B −60 prosperity; one of B's services runs on its stand-in for 3 days (ransacked) | A −30 prosperity; B +20 |
| **defend-the-walls** | the mirror of any raid on A; also rolled alone after a rift breaks near A | as raid, from the other side | — | — |
| **avenge** | B's citizen murdered A's ruler or rival (history book) | as raid; the last stage is B's champion | as raid, and B's ruler pays A a 2-week tribute | grievance halves |
| **tribute** | A is richer and B is near (or B lost a recent war) | B's side duels A's envoy guard to refuse | B pays A 5% of treasury weekly for 2 weeks | A −20 prosperity; grievance flips toward B |
| **relief** | a rift broke near B, or B is under 200 | duels against the rift's leftovers near B (no enemy town) | B +60 prosperity; A +20 | — (relief cannot be lost; an empty run just ends) |
| **resettle** | A is a city with a ruin neighbour | duels to clear the ruin's squatters | the ruin reopens as a hamlet | — |

Raid stages are **duels with an end**, never a kill count. A raid site has three fixed duel posts; a side's score is its verified
wins at those posts, weighted by post (gate 1, wall 2, granary or keep 3).

### 4.3 Inputs are data tables

```json
{ "kind": "goal-kind", "schemaVersion": 1, "id": "raid", "needsEnemy": true, "posts": ["gate", "wall", "granary"],
  "line": "{ruler} of {town} calls a raid on {enemy} over {grievance}. Blades wanted at the war table." }
{ "kind": "grievance-source", "schemaVersion": 1, "id": "rival-killed", "event": "rival-kill", "points": 300, "decayPerDay": 10 }
{ "kind": "town-relation", "schemaVersion": 1, "a": "town:grey-ferry", "b": "town:cinder-hold",
  "grievance": 340, "at": "ISO", "lastWarAt": "ISO | null", "version": 7 }
{ "kind": "war-generator", "schemaVersion": 1, "region": "region:ash-frontier", "rotationSeconds": 604800,
  "liveGoalsPerRegionMax": 2, "liveGoalsPerTownMax": 1, "targetCooldownSeconds": 1814400, "varietyWindow": 3,
  "declareAheadSeconds": 86400, "durationSeconds": 259200, "minTownsForWar": 3, "grievanceMin": 150 }
```

| Table | Starting rows (PROVISIONAL) |
|---|---|
| Grievance sources (points, decay a day) | rival killed in our town by a citizen of theirs (300, 10) · raid lost to them (250, 8) · tribute paid to them (150, 5) · same trade competing (40 a week, 5) · contested resource (60 a week, 5) · patrons are foes (§10, ×1.5 on all) · patrons are friends (×0, never war) |
| Resources | `ferry-toll`, `eels`, `grave-iron`, `ash-salt`, `shrine-offerings` |
| Grievance names | "the burned granary", "the stolen toll", "the drowned envoy", "the broken oath", "the poisoned well" (picked by seed; flavour only) |

Grievance is per **town pair**, stored with its last update and decayed lazily. It is fed only by recorded events (§6), never by
a player's personal history with a ruler.

### 4.4 The generator: `rollWarGoals(seed, tables, worldState, history) → war-roll`

A pure function, the same discipline as `feuds.md` §3.1: no clock, no `Math.random`, integers only, the contracts' named PRNG.

1. **Seed.** `seed = hash32(serverSeed, region, "war", rotationIndex)`.
2. **Eligible pairs.** Every ordered (A, B) of living non-safe towns in the region with grievance ≥ `grievanceMin` (150), patrons
   not friends, A and B not in a live goal, B not targeted in the last `targetCooldownSeconds` (**21 days**). Skip the whole
   region if it has fewer than `minTownsForWar` (**3**) living non-safe towns.
3. **No punching down.** A may target B only if `tier(B) ≥ tier(A) − 1`. A hamlet is never a raid, avenge or tribute target; it
   can only receive relief. A town in its first 7 days after resettlement is never a target.
4. **Kind.** Weight each eligible kind by A's temperament row (§4.1) times its trigger (avenge needs a recorded murder; relief needs
   a broken rift or B < 200; resettle needs a ruin neighbour). Drop any (A, B, kind) used in the last `varietyWindow` (**3**)
   rotations.
5. **Pick.** Draw by weight up to `liveGoalsPerRegionMax` (**2**), at most `liveGoalsPerTownMax` (**1**) per town on either side.
6. **Price and stakes.** Fill the outcome table (§4.2) with the current treasuries, so the stakes are fixed at declaration.
7. **Emit** one `war-roll` per rotation, written once at rotation start and persisted. Later deaths or deeds never change a live
   roll.

Properties for the contracts PR: same seed and inputs give a byte-identical roll; no cap, cooldown or variety rule is ever broken;
no friend-patron pair; no target below `tier(A) − 1`; no hamlet as a hostile target; outcomes never take prosperity below the floor.

### 4.5 Recruitment and the fight

- **Announcement.** A goal is declared `declareAheadSeconds` (**24 h**) before it opens: a line in both towns' books, a town crier
  bark, a banner at the Exchange's war board, a map marker, and the **stakes** (what each outcome changes, in numbers). It runs for
  `durationSeconds` (**72 h**).
- **Enlisting.** At either town's war table (an NPC, templated talk). A player may enlist if they have passed the outer gate
  (Gladiator), are below `SUSPECT` in the town whose side they join, have standing ≥ neutral with it, and the other town's patron does
  not head their own clan (§10.8). One side per goal per player; no switching; at most **one live enlistment** at a time.
- **Fighting.** Each post is an NPC duel at the post's level (the town's band top + post weight). A loss costs nothing and can be
  retried after 60 s. Enlisted raiders are not challenged by the defending town's guard rings **at the war's posts** while the goal
  is live; anywhere else in the town the normal `feuds.md` rules apply.
- **Score.** A side's score is the sum of its members' post-weighted wins, with each player's contribution capped at **12 points
  a day** (`WAR_DAILY_CAP`), so a crowd beats one tireless player. Each side also has an NPC **garrison baseline**:
  `garrison × 30 / 1000` points (a defended city does not fall to two raiders). Higher score wins; within 5% is a draw, and a draw
  changes nothing but the book.
- **Rewards.** Every enlisted player with at least **3** points earns metal from the winning or losing town's war chest, minted by
  rule, not taken from any player: **8 bronze a point** on the winning side, **4** on the losing side, capped at 200 bronze a goal.
  Post duels pay their own CP rows (`elite`). Top three contributors on each side are named in the book.
- **Consequence.** Raid-side players gain **+100 notoriety** in the target town when the goal closes (Suspect, never Wanted), so a
  raid has a cost there that decays as normal.

### 4.6 What winning and losing change

The outcome table in §4.2, applied once at close in one writer op. Grievance between the pair is then set to 0 for the winner and
raised by the loss source for the loser. Treasury moves are town-to-town counter moves, never a player's balance.

### 4.7 No griefing small towns

- the tier rule in §4.4 (no punching down; hamlets are relief-only);
- the 21-day target cooldown and the one-goal-per-town cap;
- the prosperity floor of 120 for any war outcome;
- treasury loss capped at 10% (raid) or 5% a week for 2 weeks (tribute);
- the garrison baseline, so an unpopular town is not stripped by a handful of players;
- every goal declared 24 h ahead with its stakes.

### 4.8 Killing a ruler, and succession (ruled, Strategy, 2026-10-06)

Ordinary grudges never target a ruler: the grudge generator (`feuds.md` §3.1) refuses any `CharacterDefinition` with a `ruler`
block. A ruler dies only at the **climax** of a war goal (raid or avenge) against its town:

- **Unlock.** The attacking side must win the goal. Its top contributor (or, if they decline within 1 h, the next) may then
  challenge the ruler within **2 h**.
- **The strongest defence.** The ruler fights at the keep, behind every layer at once: all three guard rings active for the
  challenger, the town's **bouncer** at the keep door (beaten first, one duel), and the **patron strike** at its inner-ring cadence.
  Every attack and strike stays telegraphed and dodgeable (`feuds.md` §7.1, hard rule). A loss is an arrest, never gear loss.
- **On the kill:** `feuds.md` applies. The ruler is dead for everyone, notoriety **+700** in the town (`NOTORIETY_RULER_KILL`),
  the alert spreads to towns with the same patron, the succession event opens, and the steward stands in. The killer gains a **shop
  ban** in that town (§6.3) and the death is written in the book.
- **Succession.** The successor arrives 7–14 days later. If player lords are live and the town is village tier or above, the vacancy
  opens an **election** (§11.1) instead; the steward rules until it closes. Every new ruler, NPC or player, may **pardon** (§6.3).
- **A defended war, not a lucky duel:** if the goal is lost or drawn, no one may challenge the ruler.

## 5. NPCs remember (records, not personalities)

What an NPC "remembers" is what the town has recorded. Four records, all per town:

| Record | Lives in | Decays | Read by |
|---|---|---|---|
| History book entries | `town-book` (§6) | never | barks, the war generator's grievance, rulers' pardons |
| Notoriety | `feuds.md` §4 | yes, 100 a day; pay-off | guards, shops, hunters |
| Faction standing | contracts `FactionStanding` | no | talk conditions, enlisting |
| Shop ban | `town-ban` (§6.3) | never; pardon only | every shop and service in the town |

**Barks** are templated talk entries (`npc-talk`) with a new condition, `book-has`, that matches an entry kind about the viewer in
this town, for example: "You're the one who sank the Hold's granary. We remember." Every NPC in the town reads the same records, so
two players never see one NPC hold a private grudge. No NPC gains levels, gear, abilities, titles or a rank from meeting a player.
An NPC who beats a player does not grow; an NPC who loses is not promoted or demoted. **No AI chat:** every line is authored or a
template filled with ids.

## 6. The town history book

Every town keeps one **public, append-only, permanent** book. Anyone can read any town's book: at the town's lectern, and on a
read-only web page per town (later, with the site lane).

### 6.1 What is recorded

Only deeds the server verified. Routine wins are not recorded; the book is for notable deeds.

| Event | Template (PROVISIONAL) |
|---|---|
| Rival kill (grudge) | "{player} killed {npc}, the {trade} of {town}, on {date}. Banned from this town's shops." |
| Ruler murder | "{player} murdered {ruler}, {title} of {town}, on {date}. Banned from this town's shops." |
| Pardon | "{ruler} pardoned {player} on {date}." |
| Bouncer beaten | "{player} beat {bouncer} at the door of {npc} on {date}." |
| Succession event closed | "The stand-in was {backed \| the grudge was settled} on {date}. Foremost: {p1}, {p2}, {p3}." |
| War declared / closed | "{ruler} of {town} called a {kind} on {enemy} over {grievance}, {date}." / "{town} {won \| lost \| held} against {enemy}, {date}. Foremost: {p1}, {p2}, {p3}." |
| Rift closed / broke | "A rift opened at {site} on {date}. {boss} fell to {count} fighters; first among them {p1}." / "… and no one closed it." |
| Ruler takes office | "{name} became {title} of {town} on {date}, {by election \| by succession}." |
| Tier change | "{town} grew to a {tier} on {date}." / "{town} fell to a {tier} on {date}." |
| Ruin / resettlement | "{town} was abandoned on {date}." / "{town} was resettled on {date}. Its founders: {p1}, {p2}, {p3}." |
| Fixture raised | "{player} raised a statue for {deed} on {date}." (plaques are not separate entries; they sit on the fixture) |
| Allegiance switch | "{player} forsook {old} for {new} on {date}." (in the Exchange's book, §10.6) |
| Offline raid (player lords) | "{player} broke {stage} of {town}'s defences on {date}." / "{lord}'s defenders held against {player}." |

### 6.2 Permanence, privacy and moderation

- **Permanent.** Entries are never edited or deleted by any ruler, player or op. A correction is a new entry. The only removals are
  legal ones (below).
- **Names only.** An entry stores the **character id**, never an email, a Google name, an account id or anything outside the game.
  The page renders the character's current **display name**.
- **Moderation.** If moderation renames an offensive character name, every entry shows the **moderated name**, because the entry
  stores the id and the name is resolved at render. A player's own rename shows the new name with "once {old}" only if the old name
  passed moderation.
- **Deleted accounts.** A deleted character renders as "a forgotten fighter". The deed stays; the person does not.
- **No free text.** Every entry is a template plus ids, so the book cannot carry a slur, a link or an advert.
- **Rate limits.** At most **3** entries per player per town per day; further deeds of the same kind that day fold into "and {n}
  more" on the last entry. A war or rift names at most 3 players.
- **Size.** Books paginate by season (§9). Old seasons are archived read-only, never trimmed.

### 6.3 Shop bans (ruled)

A rival kill or a ruler murder writes a `town-ban`: every shop and service NPC in that town refuses the player, with a "Closed to
you" prompt (the same view rule as `feuds.md` §5.1: nothing changes for anyone else). The ban **never decays**. It ends only when a
**new ruler pardons** it:

- **NPC ruler:** on taking office, a `merciful` pardon pass frees every ban whose holder is now **Clean** in the town (notoriety
  < 100). After that, a banned player may **petition** at the town hall for **500 bronze** (a sink), once per 14 days; the NPC ruler
  grants it by a seeded roll at **50%** (temperament `cautious` 30%, `mercantile` 70%). A refused petition keeps the metal.
- **Player ruler:** may pardon up to **5** bans a week, one by one; every pardon is written in the book with the ruler's name.
- The Concord Exchange never bans, so no player is ever cut off from every service.

## 7. Permanent fixtures

### 7.1 Housing

| Rule | Value (PROVISIONAL) |
|---|---|
| Plots | per town tier (§3.3), as data (`plots:<town>` lists landmarks) |
| Houses per account | **1** |
| Price | rent, **300 bronze a week** at a village, ×0.8 hamlet, ×1.5 town, ×2 city; paid ahead up to 8 weeks |
| Upkeep lapse | 14 days' grace, then the house closes: contents go to the bank (never lost), the plot frees |
| Town shrinks below the plot count | the newest houses close first, with 14 days' notice and the same bank rule |
| What a house is | a door, a fixed interior preset (three choices), a storage chest that is part of the bank, a crest over the door |
| Not | a crafting bench, a vendor, or anything that moves items to another player |

Occupied houses add prosperity (§3.4), so living in a town keeps it alive.

### 7.2 Donations

Any player may donate metal to a town's treasury at its town hall: a **pure sink** for the player, never refundable, and never
withdrawable by anyone. Minimum 100 bronze. Thresholds earn fixtures: **5,000** lifetime to a town earns a donor plaque (§7.4);
the top three donors of each season are named on the town hall's season board. Donations raise prosperity (§3.4) and fund the
treasury that wars and repairs draw on.

### 7.3 Statues

A statue is **earned, then paid for**. The deed opens the right; metal raises it.

| Deed that opens a statue | Cost |
|---|---|
| Foremost in a won war goal for this town | 3,000 bronze |
| Closed 10 rifts in this town's region (first among fighters each time) | 3,000 bronze |
| Served a full term as this town's ruler (player lords) | 2,000 bronze |
| Resettled this town (top founder) | 2,000 bronze |
| Beat the bouncer while this town's ally | 3,000 bronze |

- Slots by tier (§3.3). A statue stands at least **90 days**. After that, if every slot is full, a new commission displaces the
  oldest unprotected statue, which moves to the town's **hall of statues** page for good. A statue raised for a ruler's full term is
  protected for the ruler's lifetime as a character.
- One standing statue per account per town; three per account across the world.
- The statue uses the player's character at the moment of commission (body, kit and crest), posed from a fixed list. No sculpted
  likeness and no free text.

### 7.4 Plaques

Small, cheap and templated: **500 bronze**, gated by a book entry about the player in that town (any deed above), one per account
per town, text from the entry's own template. A plaque is fixed to a wall landmark and never moves. When a town falls to ruin its
plaques and statues stay, weathered.

## 8. World rifts

Rifts are the #1448 world boss machine (`origins/boss`: dormant → gathering → boss → defeated) placed by a seeded scheduler.

### 8.1 Spawn rules

```json
{ "kind": "rift-site", "schemaVersion": 1, "id": "rift:cinder-ash-pits", "region": "region:ash-frontier",
  "zone": "cinder-fields", "at": "ash-pits", "weight": 30 }
{ "kind": "rift-boss", "schemaVersion": 1, "id": "riftboss:lambton-worm", "character": "character:lambton-worm",
  "levelOver": 2, "guardian": "character:rift-spawn", "lootTable": "loottable:rift-worm", "weight": 20 }
{ "kind": "rift-scheduler", "schemaVersion": 1, "region": "region:ash-frontier", "perDayMin": 2, "perDayMax": 4,
  "minGapSeconds": 10800, "warnSeconds": 600, "openSeconds": 1800, "siteCooldownSeconds": 172800,
  "townClearanceMetres": 60 }
```

- **Schedule.** `rollRifts(seed, tables, day)` with `seed = hash32(serverSeed, region, "rift", dayIndex)` gives **2–4** rifts a
  region a day, at least **3 h** apart, at times spread across the day so every time zone gets some. At most one live rift a
  region.
- **Where.** A `rift-site` in a non-safe, non-town zone, at least **60 m** from any town centre, not used in the last **48 h**.
- **Level.** The region's band top + `levelOver`.

### 8.2 Announcement

At **T − 10 min** (`warnSeconds`): a world banner ("The sky splits over the Cinder Fields"), a map marker, and a visible light
column on the site that every player in the region can see. Travel is short, so 10 minutes is enough to arrive from anywhere in
the region. The book records the opening.

### 8.3 The fight

- **Gathering**: one or two guardian duels per player (never a kill count); a guardian win lets that player duel the boss.
- **Boss**: each player fights the boss in their own duel instance; the boss's health is **shared**, and each instance's damage
  comes off the one bar, clipped so shares never pass 100% (the #1448 rule). Late arrivals may join until the bar is under 25%.
- **Contribution.** A player's share is their damage over the boss's health. Eligibility for reward is
  `share ≥ min(MIN_CONTRIBUTION_PERMILLE, floor(500 / participants))` permille, so a crowd of 50 needs 1%, not 10%.
  Open question for Backend and Stats (§15).
- **Closing.** Defeated: closed. At `openSeconds` (**30 min**) with the boss alive: the rift **breaks**, the boss vanishes, the
  nearest town loses 30 prosperity, and the generator may roll a relief goal there.

### 8.4 Loot and anti-camping

- **Personal loot.** Every eligible player rolls the rift's `loot-table` (`distribution: personal`, `take-one`) once. Nobody can
  take another player's drop. No tagging, no kill-steal.
- **CP.** A new progression row, `rift-boss` (PROPOSED: weight 150, `once: false`, `rested: true`, `party: 'each'`), so rifts repay
  every time but draw on rested credit and repeat heat like any repeatable named kill. `world-boss` stays first-win-only.
- **Weekly cap.** At most **5** rift loot rolls per account per week (`RIFT_LOOT_PER_WEEK`). Past the cap, the kill pays CP only.
- **No camping.** Random site and time, the 48 h site cooldown, no warning before the 10 minutes, and rewards that need verified
  duel damage, not presence. A player who sits at a site gains nothing. One loot roll per rift per account.
- **Region 1 sites** (data): `ash-pits`, `causeway-end`, `milestone`, `reed-bank` (outside the Bounty's own fights), `ruin-gate`.

## 9. Economy hooks and seasons

All amounts in bronze; one bound balance (`trading.md` §3.2). Treasuries are town counters on the metal ledger with their own
reasons, never a player's balance.

| Flow | Direction | Rule |
|---|---|---|
| War chest payout | faucet (minted) | 8 / 4 bronze a point, cap 200 a goal (§4.5) |
| Rift kill | faucet (loot table currency) | the table's currency range, inside the weekly cap |
| Donation | sink | min 100, to a treasury (§7.2) |
| Rent | sink | §7.1 |
| Statue, plaque | sink | §7.3, §7.4 |
| Pardon petition | sink | 500 (§6.3) |
| Allegiance switch | sink | §10.6 |
| Resettlement pledge | sink | pooled 20,000 (§3.5) |
| Raid, tribute | treasury to treasury | never to a player |
| Treasury spend | town only | garrison repairs (+garrison), public works (§11.2) |
| Prices | data | tier multiplier (§3.3), a stand-in's ×1.5 (`feuds.md` §5), a lord's tax band (§11.2) |

Stats watches faucet and sink totals from the ledger before any number here goes live.

**Seasons (light touch).** A season is **13 weeks**. It changes no power and resets nothing: towns, books, statues and bans carry
over. A season brings a new page in every book ("Season 3 begins"), the donors' and defenders' season boards, an ambience preset
(winter fog, summer ash), and one festival week where rifts run at the top of their range. A season name is data.

## 10. Allegiance: patrons and clans

### Ruled (Strategy, 2026-10-06)

> **Any lore, but living faiths' gods and holy figures aren't for players to worship or fight.**

1. **Clan perks are sidegrades** (a gain plus a matching weakness). Strategy ruled them Origins-only; **superseded by Dom's override
   below** on where they apply. The sidegrade rule stands.
2. **Worshipped patrons** come only from dead pantheons and literature: Greek and Roman, Norse, Egyptian, Mesopotamian, Celtic,
   Arthurian (King Arthur), Gothic novels (Dracula, Frankenstein) and werewolf folklore.
3. **Asia and Latin America** come in through folklore and literature (Sun Wukong of *Journey to the West*, jiangshi, oni, yokai,
   ronin, La Llorona, the Chupacabra) as **monsters or clans, never as gods**.
4. **Excluded:** Hindu gods, Satan worship, the archangel Gabriel, **any Abrahamic figure as a patron** (the 1 Enoch Watchers are
   the one exception, as legend, below), and
   **Aztec and Maya gods** as patrons, with their monsters also out for now.
5. **The literary dark side**, allowed as inspiration with **original names**: a **Fallen** clan of rebel angels in Milton's spirit
   (never named Satan or Lucifer, never presented as worship of a real faith's devil); a Faustian **Pact** clan (the Faust legend,
   Marlowe and Goethe; Mephistopheles is fine as a literary character); **Dante's circles as a place**, never a patron.
6. **No angel-based "holy" clan.** The light side is the Arthurian knights and the Grail.
7. **Owner override (Dom, 2026-10-06; Strategy accepted):** the named **Watchers of 1 Enoch** (Shemihaza, Armaros, Baraqel,
   Kokabiel, Penemue and others) are **allowed** as the Fallen clan's figures, as legend, not worship. Cite 1 Enoch in R. H.
   Charles's translation, 1917. **Azazel stays out** (Leviticus) unless Dom names him. The Fallen clan uses these names instead of
   original ones; the Pact clan keeps original names. This overrides ruling 5's "original names" for the Fallen only.

### Dom's overrides (Dom, 2026-10-06; supersede Strategy's ruling 1 and the earlier phasing; Strategy re-sequencing pending)

1. **Perks apply everywhere**, including the Pit, the arena and duels. They stay **small**: matched sidegrades inside a **±3%**
   budget, mostly cosmetic, built only from a fixed set of **perk templates** (§10.2), so every patron is equal power by
   construction.
2. **The clan and patron choice ships at graduation**: on reaching Gladiator and leaving the Pit into the bank town (the Concord
   Exchange). It is part of the first Origins step, not after Region 1. Minion defenders still ship with player lords.

**The cost of override 1, stated plainly:** a duel-sim hook owned by Combat; a `RECORD_VERSION` bump; replays carry the patron or
clan id; the RNG fingerprint re-pinned deliberately (the #1402 test updated on purpose, by the fix-forward rule, not reverted); and a
**win-rate-by-patron** balance check by Stats before and after release.

**Data source.** The full patron and legend candidate list with its perk templates is built in a separate PR,
`expansion/legends-500` (about 500 entries). The tables below are a **sample** to show the shape; the patron table is that PR's
data, not a copy here.

On passing the outer gate (Gladiator) and entering the Concord Exchange for the first time, a player chooses **Independent** or a
**clan**. A clan is an order with a head figure: a **patron** (a god or a dark lord) or a **legend** (a band from literature or
folklore). Clans earn **prestige**. Player-made groups are a separate later spec; this spec calls them **companies** so the two are
not confused.

### 10.1 Patrons (Strategy, 2026-10-06, PROVISIONAL list)

A patron gives four things and **no raw stat power**:

1. a **defender roster** a player lord can station (§11.4); ships with player lords;
2. the **strike type** in a town whose patron it is (`feuds.md` §7.1): always a 2 m marker, a 1.2 s wind-up, dodged by stepping out,
   never during a duel, never an instant death;
3. **friend and foe** relations that feed the war generator (§4.3): friends never go to war, foes ×1.5 grievance;
4. **cosmetic marks**: crest, banner, cloak trim.

| Patron | Pantheon / source | Strike | Friends / foes (PROVISIONAL) |
|---|---|---|---|
| Zeus | Greek; Hesiod, *Theogony* | bolt | Poseidon / Hades, Tiamat |
| Poseidon | Greek; Homer, *Odyssey* | breaking wave | Zeus / Set |
| Hades | Greek; Hesiod, *Theogony* | grasping shades | Hel, Ereshkigal / Zeus |
| Thor | Norse; Snorri, *Prose Edda* | hammer-fall | — / Tiamat, Hel |
| Hel | Norse; Snorri, *Prose Edda* | grave frost | Hades / Thor |
| Set | Egyptian; Plutarch, *On Isis and Osiris* | red sandstorm | Count Dracula / Poseidon, Sekhmet |
| Sekhmet | Egyptian; the *Book of the Heavenly Cow* (New Kingdom tomb texts) | sun-flare | — / Set |
| Tiamat | Mesopotamian; *Enûma Eliš* | brine surge | — / Zeus, Thor |
| Ereshkigal | Mesopotamian; *Inanna's Descent* | the seventh gate (a closing ring) | Hades / — |
| The Morrígan | Irish; *Táin Bó Cúailnge*, *Cath Maige Tuired* | crow-dive | — / Count Dracula |
| Count Dracula | Bram Stoker, *Dracula*, 1897 (Stoker died 1912) | bat swarm | Set / the Morrígan, Zeus |

- **Count Dracula is Stoker's character, never Vlad III** (a real person, already the ladder's `Vlad`, sourced to Chalkokondyles).
  "The Impaler" is never used as a name or an epithet. Art briefs cite the novel, never a film.
- **Out (legends rule: living religion):** Hindu deities, any Abrahamic figure, Aztec and Maya gods. Allowed equivalents are the list above.
- **Ladder overlap (ruled, Strategy, 2026-10-06):** Set, Hades, Hel, Ereshkigal, the Morrígan, Sekhmet and Thor are also beatable
  Pit legends. **The Pit fights the legend; a clan serves the patron.** Zeus and Poseidon stay never-beatable
  (`feuds.md` §12).
- Switching costs metal and is written in the history book (§10.6).

### 10.2 Clans, perks and weaknesses (Dom's override; values PROVISIONAL)

Every clan has one **perk template**: a small gain paired with a matching cost.

- **Everywhere** (Dom's override): the Pit, duels, Origins fights. Resolved before the fight from the clan, the world clock at engage
  (§10.3) and the fight's own state, then clamped inside the fixed spine (Attack ≤ 1.15, RES ≤ 0.80). Timing is never touched.
- **Equal by construction.** A template pairs **+3%** and **−3%** (or +3% and +3% on opposite stats) over **complementary conditions
  of equal measure** that exist in every fight, Pit included: the halves of the clock, the halves of the moon, the two halves of a
  fight, the two halves of a health bar, higher versus lower level. Zone, weather and material conditions are **flavour only**
  (barks, marks, effects), because the Pit has none of them and a perk that only works outside it would not be equal.
- **Checked.** Stats runs the win-rate-by-patron check in the progression scenarios and on live records; a template whose win rate
  drifts beyond ±1 percentage point is retuned as data.
- **Shown.** The pre-fight card shows both fighters' clans and active templates. Nothing is hidden.

| Template | Gain | Matching cost |
|---|---|---|
| `day-half` | +3% damage in the day half of the clock | −3% damage in the night half |
| `night-half` | +3% damage in the night half | −3% in the day half |
| `waxing` | +3% damage while the moon waxes (phases 0–3) | −3% while it wanes (4–7) |
| `opener` | +3% damage in a fight's first 20 s | −3% after |
| `closer` | +3% damage after 20 s | −3% before |
| `underdog` | +3% damage against a higher-level foe | −3% against a lower-level foe |
| `finisher` | +3% damage against a foe under half health | −3% against a foe above half |
| `last-stand` | +3% damage while you are under half health | −3% while above half |
| `iron-hide` | −3% damage taken | −3% damage dealt |
| `glass` | +3% damage dealt | +3% damage taken |
| `tireless` | −3% stamina cost | −3% damage dealt |

Sample clans (the canonical list is `expansion/legends-500`):

| Clan | Head (source) | Template | Flavour only |
|---|---|---|---|
| Sworn of Zeus | Zeus (Hesiod, *Theogony*) | `opener` | storm barks |
| Tide-sworn | Poseidon (Homer, *Odyssey*) | `closer` | water-side marks |
| Hades' Host | Hades (Hesiod) | `iron-hide` | shades |
| Thunder-kin | Thor (Snorri, *Prose Edda*) | `glass` | giant-slayer barks |
| Hel's Thralls | Hel (Snorri) | `tireless` | grave frost |
| Red Sand | Set (Plutarch, *On Isis and Osiris*) | `underdog` | sandstorm |
| Lion's Eye | Sekhmet (the *Book of the Heavenly Cow*) | `day-half` | sun-flare |
| Brood of Tiamat | Tiamat (*Enûma Eliš*) | `closer` | brine |
| The Seven Gates | Ereshkigal (*Inanna's Descent*) | `iron-hide` | the closing gate |
| Crows of the Ford | the Morrígan (*Táin Bó Cúailnge*) | `finisher` | crows |
| House of Dracula (vampire) | Count Dracula (Stoker, 1897) | `night-half` | bats; "silver" barks |
| The Wolf-kin (werewolf) | werewolf folklore (Marie de France, *Bisclavret*, 12th c.; Gervase of Tilbury, *Otia Imperialia*, c. 1211) | `waxing` | the full moon |
| The Stitched (undead) | Mary Shelley, *Frankenstein*, 1818 | `tireless` | fear of fire |
| Knights of the Grail (the light side) | King Arthur; Malory, *Le Morte d'Arthur*, 1485 | `day-half` (Gawain's strength to noon) | the Grail |
| Legion of Mars | Mars (Roman myth) | `iron-hide` | shield-wall |
| Monkey King's Band | Sun Wukong, *Journey to the West*, 1592 (a clan head, never a god) | `opener` | the headband |
| Jiangshi | Qing folklore; Yuan Mei, *Zi Bu Yu*, 1788 | `night-half` | the hopping dead |
| Oni-kin | Japanese folklore; Toriyama Sekien, *Gazu Hyakki Yagyō*, 1776 | `glass` | iron clubs |
| Ronin | Japanese history (a class, no named person) | `opener` | the lone road |
| The Weeping | La Llorona, Mexican folklore (a clan, never a god) | `night-half` | the river |
| Goat-sucker Pack | the Chupacabra, Latin American folklore, 1995 on (a clan, never a god) | `finisher` | — |
| The Fallen | the Watchers of 1 Enoch (R. H. Charles translation, 1917): Shemihaza, Armaros, Baraqel, Kokabiel, Penemue; in Milton's spirit (*Paradise Lost*, 1667). Legend, not worship; never Satan, Lucifer or Azazel | `underdog` | broken wings |
| The Pact (original name) | the Faust legend: Marlowe, *Doctor Faustus*, c. 1592; Goethe, *Faust*; Mephistopheles as a literary character | `glass` | the signed page |

Clan heads that are not patrons (legends and folklore) are **not worshipped**: they give no town strike and no defender roster of
their own (a lord in such a clan uses the garrison roster). **Dante's circles** (*Inferno*, c. 1314) are reserved as a later region
or rift theme, never a clan head.

Remaining flags: the **Chupacabra** has no pre-1929 source (ruled in; its art brief must not draw on film or TV); werewolf **silver
and wolfsbane** are 20th-century film motifs, so they stay out of the flavour unless a pre-1929 source is found; jiangshi
**peach-wood** and oni **beans and holly** are living rites, so they are not used even as flavour.

### 10.3 The world clock: day, night and moon

The clock is one pure function of server time and the shared seed, as `one-shard.md` §1 requires. Every client and server layer
computes the same value, so nobody stores it.

```json
{ "kind": "world-clock", "schemaVersion": 1, "dayLengthSeconds": 14400, "nightFraction": 333,
  "dawnFraction": 0, "noonFraction": 250, "moonCycleDays": 8, "fullMoonDays": 1, "epochOffsetSeconds": 0 }
```

- An Origins day is **4 h** of real time, so every time zone sees every phase daily. Night is the last third (about 80 minutes).
- The moon cycle is **8** Origins days (32 h); one night in eight is the full moon.
- `worldTimeAt(serverMs) → { day, phase: dawn | day | dusk | night, moon: 0..7, fullMoon }`. A perk reads it at engage, and it holds
  for the whole fight.
- The zone's `ambience.dayNightSpeed` presets follow it; ambience never sets rules.

### 10.4 Joining: a feat of arms

Joining is **one duel with a twist** against the clan's trial champion at the Exchange's trial ground. It is never an errand chain.

| Rule | Value |
|---|---|
| Gate | Gladiator (outer gate) |
| Trial | one duel at your level + 2, with the clan's twist (Dracula's house: `heal-on-hit`, at night only; the Wolf-kin: `flee-at` 30%, at full moon only; the Stitched: `one-health-bar`) |
| Loss | nothing; retry after 10 minutes |
| Win | membership, the marks, and a book entry |

A clan's trial champion is an original character in the clan's look, never the patron or legend itself (no beatable Zeus, no
become-the-boss).

### 10.5 Prestige

A clan's **prestige** is the seasonal sum of its members' war points, rifts closed and raids held. It sets the clan's place on the
Exchange's clan board and unlocks cosmetic tiers of its marks. It never gives power. It resets each season (§9); the season's
winner is written in the Exchange's book.

### 10.6 Leaving and switching

| Action | Cost | Cooldown | Book |
|---|---|---|---|
| First choice | free | — | "{player} passed the trial of {clan} on {date}." |
| Leave to Independent | free | 7 days before joining another | "{player} left {clan} on {date}." |
| Switch clan | **2,000 bronze** (a sink) and the new clan's trial | **28 days** | "{player} forsook {old} for {new} on {date}." |

Entries go in the Exchange's book, and also in the home town's book if the player is its ruler. A live war enlistment must close
first. A lord's town patron changes only at their next term.

### 10.7 Data

```json
{ "kind": "clan", "schemaVersion": 1, "id": "clan:house-dracula", "name": "House of Dracula",
  "head": { "kind": "patron", "id": "patron:dracula" }, "lore": { "source": "Bram Stoker, Dracula, 1897" },
  "template": "night-half",
  "trial": { "encounter": "encounter:trial-house-dracula", "twist": "heal-on-hit", "only": "night" },
  "marks": ["crest:dracula", "banner:dracula", "trim:dracula"] }
{ "kind": "patron", "schemaVersion": 1, "id": "patron:zeus", "name": "Zeus", "pronoun": "he",
  "lore": { "source": "Greek myth", "citation": "Hesiod, Theogony" },
  "strike": { "kind": "bolt", "windupTicks": 72, "radiusMetres": 2, "woundPermille": 350 }, "roster": "roster:zeus" }
{ "kind": "defender-roster", "schemaVersion": 1, "id": "roster:zeus",
  "defenders": [ { "id": "storm-hoplite", "body": "knight", "role": "gate", "twists": ["no-block"] },
                 { "id": "bolt-priest", "body": "veteran", "role": "wall", "twists": ["heal-on-hit"] } ] }
{ "kind": "patron-relation", "schemaVersion": 1, "a": "patron:zeus", "b": "patron:hades", "relation": "foe" }
{ "kind": "allegiance-rules", "schemaVersion": 1, "gate": "outer", "switchBronze": 2000, "switchCooldownSeconds": 2419200,
  "leaveCooldownSeconds": 604800, "trialRetrySeconds": 600 }
```

- A clan names one `perk-template` by id. Templates are their own content kind, and a clan cannot carry raw modifiers:

```json
{ "kind": "perk-template", "schemaVersion": 1, "id": "night-half",
  "gain": { "when": "clock-half:night", "stat": "damageDealtPermille", "value": 30 },
  "cost": { "when": "clock-half:day", "stat": "damageDealtPermille", "value": -30 } }
```

- `when` is one of `clock-half:day|night`, `moon:waxing|waning`, `fight-time:before-20s|after-20s`, `foe-level:higher|lower`,
  `foe-health:below-half|above-half`, `self-health:below-half|above-half`, `always`. Each gain and cost pair must use complementary
  conditions, or `always` on both. The parser refuses anything else.
- `stat` is one of `damageDealtPermille`, `damageTakenPermille`, `staminaCostPermille`, and `|value| ≤ 30`.
- The fight record carries the clan id and the template id, so a replay recomputes the same modifiers.

Per player: `{ "kind": "allegiance", "character": "pc:…", "clan": "clan:… | null", "since": "ISO", "nextJoinAt": "ISO",
"nextSwitchAt": "ISO", "version": 3 }`. Per clan per season: `{ "kind": "clan-prestige", "clan": "clan:…", "season": 3,
"points": 18240 }`.

### 10.8 How allegiance feeds the world, and phasing

- **Towns** have a patron (content). Friend and foe relations between town patrons weight the war generator (§4.3).
- **Players** may not enlist against a town whose patron heads their own clan (§4.5). Independents may enlist anywhere.
- **Player lords** may set their town's patron to their own clan's patron once per term (§11.2), if the clan has one. The strike
  changes with it, and the book records it. A legend-headed clan with no strike leaves the town's strike off.
- **Phasing (Dom's override):** the **choice**, trials and marks ship **at graduation**, as part of the first Origins step.
  **Perk templates** ship when Combat's duel-sim hook, the `RECORD_VERSION` bump and Stats' win-rate check are ready; until then a
  clan is identity only. **War-goal sides** and prestige ship with the war goals (phase d). **Patron defenders** ship with player
  lords after the PvP verifier (phase e). Strategy is re-sequencing.

## 11. The player rule (phase e: built after the PvP verifier)

### 11.1 Nomination and election

| Rule | Value (PROVISIONAL) |
|---|---|
| Towns that can elect | village tier or above; never the Exchange |
| Vacancy | ruler murdered; a player ruler's term ends, abdicates, or is inactive 14 days; a town's hold falls to 0 (§11.5); or a standing NPC ruler's term ends (every 8 weeks, a seeded 50% chance the NPC stands down) |
| Nomination | 72 h. A candidate must have passed the outer gate, have an account at least 30 days old, be Clean here, have no ban here, and hold at least 20 war points, a house, or 5,000 bronze of donations in this town in the last 28 days |
| Nominated by | the steward reads the candidates and names the **top 3** by that town record. No self-pitch text |
| Vote | 72 h. One vote per account. Voters: Gladiator, account at least 30 days old, any house holder in the town or anyone with a war point or donation here in the last 28 days |
| Win | most votes; a tie or no votes keeps the NPC steward and reopens in 28 days |
| Term | 28 days; at most two terms in a row, then one term out |
| Offices per account | 1 |

### 11.2 Powers (all inside data bands)

- Pick **one of three** war goals the generator offers the town each rotation, or decline all. A lord never declares freely.
- Set the shop tax: prices ×0.90 to ×1.20; it raises or lowers prosperity from service use.
- Spend the treasury on **public works** from a fixed list: walls (+garrison), market (+prosperity a day), lectern lights, plot
  upkeep relief. Every spend is a book entry.
- Pardon up to 5 bans a week (§6.3).
- Configure defenders and set raid windows (§11.4).
- Set the town's patron to their clan's patron once per term (§10.8).
- A ruler's stipend: **minted** by rule, 2 bronze per prosperity point per term, never drawn from the treasury.

### 11.3 What a lord can never do

- withdraw treasury metal to any player, including themselves;
- ban a player, refuse a named player service, or price differently for one player (only deeds ban, §6.3);
- edit, hide or delete a book entry;
- write free text anywhere;
- set guards on a player who is not Wanted under `feuds.md`;
- jail, fine or move another player;
- close the town's gates or its services to everyone;
- target a town more than one tier below their own, or a hamlet;
- take, lock or damage any item. **Nobody ever loses gear.**

### 11.4 Offline defence (Clash-style)

The lord configures a **defence plan**: three stages, each a duel post with an NPC defender.

| Stage | Post | Defender drawn from | Level |
|---|---|---|---|
| 1 | gate | the lord's patron roster (§10.7) or the garrison | band top + 1 |
| 2 | wall | as above | band top + 2 |
| 3 | keep | the town's bouncer or the patron's champion | band top + 4 |

The lord chooses which defender holds each post and one twist per post from a whitelist (`flee-at`, `one-health-bar`, `no-block`,
`damage-only-on-parry`, `heal-on-hit`). Defenders are NPCs: their level comes from the town's band and stage, **never** from the
lord's own level or gear, and they keep every telegraph. The lord's own character never fights as an AI copy (no become-the-boss).

### 11.5 Raid rules

- **Who.** A raid on a player lord's town happens only through a live war goal against that town. Raiders enlist as in §4.5.
- **Windows.** The lord sets two **2 h raid windows** a day (`RAID_WINDOWS` 2 × 7200 s), at least 8 h apart. Outside them the town
  cannot be raided. A town with no windows set gets the region default.
- **A raid** is one player's run of the three stages, in order. Each won stage is a **star**. A raid that wins all three
  **breaks a hold point**.
- **Land falls in stages.** A town has **3 hold points**. Hold regenerates 1 point per 3 days with no broken raid. At 0 the lord is
  deposed, an election opens (§11.1), and the attacking town takes the raid outcome. Land is never lost in one raid.
- **Shields.** After any raid on the town (win or loss): **4 h**. After a hold point breaks: **48 h**. A new lord: **72 h**.
- **Limits.** Each raider gets **3 raids per town per day**. A loss costs nothing but the attempt. Raiders gain war points by
  stars.
- **Defence pays.** Each held raid adds 1 war point to the lord's side and 5 prosperity to the town.
- **Lord-vs-player duels** (the lord fighting raiders live) need the PvP verifier (#1392, #1485, #1487) and open-world PvP. Until
  then everything above is PvE against configured NPCs; Strategy still parks the whole phase until the verifier exists.

## 12. Region 1 (ruled, Strategy, 2026-10-06: three towns)

Region 1 gets **three towns**: the Exchange town, Cinder Hold and Mere End. War goals (`minTownsForWar` 3) and the same-trade alert
spread (`feuds.md` §7.1) both need them.

| Town | Zone | Tier at start | Ruler | Temperament | Patron |
|---|---|---|---|---|---|
| the Exchange town | the town around the Concord Exchange | town (500) | Mayor (original, PROPOSED) | mercantile | Zeus |
| Cinder Hold | a new zone beside `cinder-fields` | village (260) | Warden Brannoc (original, he) | ambitious | Hel |
| Mere End | a new zone at the `black-mere` causeway | hamlet (180) | Reeve Osk (original, she) | cautious | Poseidon |

**To confirm (Lead/Strategy):** §3 keeps the Concord Exchange itself **safe** (never at war, never ruined, the neutral ground for
pay-offs and trades). Two readings fit the ruling: (a) the Exchange town is a non-safe town quarter outside the safe Exchange
square, which can go to war while the square stays neutral; or (b) "the Exchange town" means the **Grey Ferry** (`ferry-landing`,
Reeve Tamsin, Zeus, as in `feuds.md`). This spec assumes (a) and keeps the Grey Ferry as the grudge town of `feuds.md`.

Rifts need no towns and can ship first, with the five sites in §8.4.

## 13. One shard: alignment with `one-shard.md` (#1490) and questions for Backend

Backend's note assumes (a) NPC routines and the world clock are deterministic and shared, and (b) world events and the history book
are global, written once, not per layer. **This spec agrees with both.** Town state, war goals, rifts, books, bans, fixtures,
elections and the world clock (§10.3) are single global rows or pure functions of server time and the shared seed. Nothing in this
spec is stored per layer. Two notes:

- `one-shard.md` §1 lists "an NPC's mood" as an event. In this spec no NPC has a personal mood about a player (the Nemesis line,
  §2); what travels is town-level state (a ruler's death, a stand-in, a ban, a book entry).
- Every fight in this spec is a duel against an NPC, settled by the writer. Only §11's live lord-vs-raider duels and `feuds.md` §9
  need the PvP verifier; those need both fighters in one layer, as `one-shard.md` §3 says.

Questions for Backend:

1. **War posts and rift bars across layers.** One global score and one shared health bar, written by many concurrent duel
   settlements. How are writes ordered and clipped (the #1448 per-participant clip) without double-counting?
2. **Rift announcements.** The banner and the light column must reach every player in the region, beyond the 40 m interest radius.
   Is that a low-rate Realtime push (`one-shard.md` §6), sent once per rift?
3. **Post queues.** At 80 players a layer, how are a war post's or a rift's duel slots queued when hundreds enlist?
4. **Lazy state.** Prosperity, grievance, notoriety and hold decay lazily on read. Is read-time mutation fine under the writer's
   version locks, or does one daily writer op tick them?
5. **Rotation writes.** War rolls, grudge rolls and rift schedules are written once at rotation start. Who runs that write, and what
   stops two servers racing?
6. **Book volume.** Expected entries a day at 10,000 players, the per-town page query, and the season archive.
7. **Moderated names at render.** One lookup per entry, or a denormalised name with a rewrite on moderation?
8. **Clan tags** in presence: `one-shard.md` §2 already syncs a guild tag; does it carry the clan mark too?

## 14. Server state and content shapes (for the contracts and the writer)

**Content (bundle):** `town-definition`; `goal-kind`, `grievance-source`, `war-generator`; `rift-site`, `rift-boss`,
`rift-scheduler`; `patron`, `clan`, `perk-template`, `defender-roster`, `patron-relation`, `allegiance-rules`, `world-clock`; `plots:<town>` and `statues:<town>` landmark
lists on the world's `town` group; `fixture-template` (statue poses, plaque and book templates). On `CharacterDefinition`, an
optional `ruler: { town, title, temperament, standIn }` (refused on `essential: true`). New talk condition `book-has`. Fight records gain the clan and perk-template ids (§10.7). New
progression row `rift-boss` (§8.4). New id namespaces: `town`, `patron`, `roster`, `rift`, `riftboss`, `war`, `fixture`, `clan`.

**Shared world state:**

```json
{ "kind": "town-state", "schemaVersion": 1, "town": "town:grey-ferry", "prosperity": 420, "tier": "village", "at": "ISO",
  "ruler": { "kind": "npc", "character": "character:reeve-tamsin", "since": "ISO", "termEndsAt": "ISO | null" },
  "treasuryBronze": 8400, "garrison": 500, "patron": "patron:zeus", "hold": null, "shieldUntil": null,
  "belowRuinSince": null, "version": 31 }
{ "kind": "town-relation", "a": "town:grey-ferry", "b": "town:cinder-hold", "grievance": 340, "at": "ISO", "version": 7 }
{ "kind": "war-roll", "schemaVersion": 1, "region": "region:ash-frontier", "rotation": 2931, "seed": 1180023377,
  "goals": [ { "id": "war:ash-frontier-r2931-1", "kind": "raid", "a": "town:cinder-hold", "b": "town:grey-ferry",
               "grievance": "the stolen toll", "declaredAt": "ISO", "opensAt": "ISO", "closesAt": "ISO",
               "stakes": { "treasuryPermille": 100, "treasuryCapBronze": 3000, "prosperityB": -60, "prosperityA": -30 } } ] }
{ "kind": "war-goal-state", "goal": "war:…", "scoreA": 0, "scoreB": 0, "garrisonA": 15, "garrisonB": 15,
  "outcome": "a | b | draw | null", "version": 1 }
{ "kind": "rift-state", "id": "rift:…", "site": "rift:cinder-ash-pits", "boss": "riftboss:lambton-worm", "warnAt": "ISO",
  "opensAt": "ISO", "closesAt": "ISO", "health": 120000, "status": "warned | open | defeated | broken", "version": 9 }
{ "kind": "town-book-entry", "town": "town:grey-ferry", "seq": 1042, "at": "ISO", "template": "rival-kill",
  "refs": { "player": "pc:…", "npc": "character:rival-mimir" }, "season": 3 }
{ "kind": "fixture", "id": "fixture:…", "town": "town:grey-ferry", "type": "statue | plaque | house",
  "owner": "pc:…", "slot": "statue-2", "deed": "book:grey-ferry:1042", "since": "ISO", "until": "ISO | null" }
{ "kind": "election", "town": "town:grey-ferry", "opensAt": "ISO", "votingAt": "ISO", "closesAt": "ISO",
  "candidates": ["pc:…"], "tally": { "pc:…": 41 }, "winner": "pc:… | null" }
{ "kind": "defence-plan", "town": "town:grey-ferry", "lord": "pc:…",
  "posts": [ { "stage": 1, "defender": "storm-hoplite", "twist": "no-block" } ], "windows": ["18:00", "06:00"], "version": 2 }
```

**Per player:** `town-ban { character, town, since, cause: book ref, pardonedBy, pardonedAt }`; `enlistment { character, goal,
side, points, pointsToday, day }`; `rift-claim { character, rift, sharePermille, rolled }`; `rift-week { character, week, rolls }`;
`allegiance` and `clan-prestige` (§10.7); `vote { account, election }`; `raid-attempt { character, town, day, count, stars }`.

**Writer ops** (one transaction each, idempotency key, server time, append-only event; no op moves an item; every metal line is on
the metal ledger with a reason): `war_roll_write`, `enlist`, `war_post_win`, `war_close`; `rift_schedule_write`, `rift_hit`,
`rift_close`, `rift_loot`; `book_append` (called inside every deed op, never alone); `ban_write`, `pardon`, `petition`;
`donate`, `rent_pay`, `house_close`, `fixture_commission`; `prosperity_tick` (lazy); `ruler_succeed`; `clan_trial_win`, `clan_leave`, `clan_switch`;
`nominate`, `vote`, `election_close`; `defence_set`, `raid_stage_win`, `raid_close`, `shield_set`.

## 15. Phasing

Strategy's order (§2.4), re-sequenced by Strategy on 2026-10-06 to match the table below (Lead to confirm). The beta is the duel game; none of this is in it.

| Phase | Ships | Needs | Pre-verifier? |
|---|---|---|---|
| (0) Graduation (Dom) | clan and patron choice at Gladiator, entry trials, marks, the Exchange's book line; perk templates when Combat's hook lands | the trial encounter, the `clan` kind, a `RECORD_VERSION` bump for perks | yes |
| (a) Rifts | scheduler, sites, warning, shared bar, personal loot, the `rift-boss` row, weekly cap | #1448 (merged, pure), the server's loot roll, a contracts row | yes |
| (b) History book | server log, templates, the town lectern and web page, moderated names; plaques and donations | the deed ops of `feuds.md` (rival kill, bouncer, succession) | yes |
| (c) NPCs remember | `book-has` barks, shop bans and pardons by NPC rulers and petition | (b) | yes |
| (d) NPC war goals | towns as data, prosperity, tiers, death and resettlement, rulers, the war generator, enlisting, statues; clan **prestige and war sides** | (b), (c), two more Region 1 towns | yes |
| (d+) Housing | plots, rent, the house door and chest | (d), plot art | yes |
| (e) Player rule | elections, powers, defence plans, raid windows, shields, hold, **patron defender rosters** | the PvP verifier #1392 / #1485 / #1487 and open-world PvP (Strategy) | **no** |
| (e+) PvP bounty | `feuds.md` §9 | as (e) | **no** |

## 16. Names (legends rule)

| Name | Source | Allowed because | Pronoun |
|---|---|---|---|
| The Lambton Worm (rift boss, approved by Strategy, 2026-10-06) | County Durham folklore; recorded in Robert Surtees, *The History and Antiquities of the County Palatine of Durham*, vol. 2, 1820 | English folklore, PD source, no living-religion scripture, not a living people's folk hero; not on the ladder. Text is original prose | it |
| Patrons and clan heads | as cited in §10.1 and §10.2 | Strategy's rulings (2026-10-06): dead pantheons and literature as patrons; Asian and Latin American folklore as clans or monsters, never gods | Zeus, Poseidon, Hades, Thor, Set, Mars, Sun Wukong, Dracula, Arthur he; Hel, Sekhmet, Tiamat, Ereshkigal, the Morrígan, La Llorona she |
| Shemihaza, Armaros, Baraqel, Kokabiel, Penemue (the Fallen) | 1 Enoch (the Book of the Watchers), R. H. Charles translation, 1917 | owner override (Dom, 2026-10-06; Strategy accepted): legend, not worship; Azazel excluded (Leviticus) | he |
| Mephistopheles (literary, the Pact) | Marlowe, *Doctor Faustus*, c. 1592; Goethe, *Faust* | literature by authors dead 70+ years; a character, not a faith's devil (Strategy) | he |
| Count Dracula | Bram Stoker, *Dracula*, 1897; Stoker died 1912 | pre-1929 literature. Stoker's character only, never Vlad III and never "the Impaler"; never a film depiction | he |
| The Stitched | Mary Shelley, *Frankenstein*, 1818 | pre-1929 literature. The clan is named for the creature's kind, not for Victor; no film depiction (no bolts, no flat head) | — |
| Reeve Tamsin, Warden Brannoc, Reeve Osk, the stewards, minions, post guards, trial champions | original (`lore.source: "original"`) | side NPCs and mooks | Tamsin she, Brannoc he, Osk she |

## 17. Rulings needed and open questions

1. **All numbers** are PROVISIONAL: prosperity inputs and the −12 neglect, tier thresholds, the 14-day death clock, the 20,000
   resettlement, war caps (2 a region, 1 a town), the 21-day target cooldown, 24 h warning and 72 h run, war pay 8/4 bronze a point,
   +100 raid notoriety, ruler kill +700, rift 2–4 a day and 30 minutes, 5 rift rolls a week, rent, statue and plaque costs, the
   2,000 switch, terms of 28 days, 3 hold points and the shields.
2. **Clan perks** (§10.2): Strategy to re-sequence after Dom's override; Combat to own the duel-sim hook; confirm the ±3% templates,
   the ±1 point win-rate drift rule, and the `RECORD_VERSION` bump. The original names for the Pact clan.
3. **The Exchange town** (§12): a non-safe quarter outside the safe Exchange square, or the Grey Ferry?
4. **Rift contribution threshold**: the crowd-scaled `min(100, 500 / participants)` permille, or a fixed 10%? It interacts with
   `region1-ash-frontier.md` open question 7 (two contribution measures).
5. **The `rift-boss` progression row** (weight 150, repeatable, rested): a contracts change. Confirm.
6. **Ruler climax** (§4.8): the 2 h challenge window and the top-contributor rule.
7. **Alert spread for a ruler murder**: same-patron towns (proposed) or same-trade as `feuds.md` §7.1?
8. **NPC pardon by petition**: a seeded 50% roll, or a fixed waiting period? A roll is fairer to read but feels like a lottery.
9. **Region 1 zones**: the World lane adds the Cinder Hold and Mere End zones (ruled three towns; zone layout open).
10. **Statue displacement** after 90 days, or strictly permanent slots with a waiting list?
11. **Elections and alts**: account age 30 days, Gladiator and a town record per voter. Enough? (No trust-matchmaking is used or
    proposed.)
12. **Book page on the website**: a public per-town page needs the site lane and a moderation hook. In phase (b) or later?
13. **Contract additions** for Backend and the coordinator: the content kinds, state rows, id namespaces and writer ops in §14.
