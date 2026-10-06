# Feuds: systemic grudges, succession and notoriety

- Status: **design spec, PROVISIONAL.** Every number below is data, and Dom has not ruled on any of them. Docs only: no `src/`, no
  code, no JSON.
- Replaces: the scripted Feud *The Stolen Name* (`region1-ash-frontier.md` §3, now superseded). Dom rejected it as "scripted space
  and time filling content". **Bounties are unchanged** (`region1-ash-frontier.md` §3, Bounties).
- Binding: Strategy's rulings (a) to (d) of 2026-10-07, quoted where they apply. The legends rule covers every named target.
- Built on: `origins/contracts` (`CharacterDefinition`, `ServiceDefinition`, `FactionStanding`, `EncounterDefinition`), and
  `origins/progression` (`TYPE_WEIGHTS`, `basePay`, the lazy refill pattern used for rested credit). Metals are in bronze
  (`trading.md` §3.2: 100 bronze = 1 silver, 100 silver = 1 gold, one bound balance). Collect-N stays banned. Twists stay as one way
  some fights play.

## 1. The loop in one paragraph

A service NPC holds a **grudge** against a rival in another town, for example a smith undercut by a rival smith. The NPC asks you
to kill the rival. You walk to the rival's town and duel him. If you win, he is dead **for everyone**:

- a worse **stand-in** runs his service;
- a short **succession event** opens that any player can join;
- a **successor** arrives 7–14 days later;
- the town hates you, and you are **wanted** there: guards duel you on sight and shops refuse you;
- the wanting fades with time, or you pay it off in metal.

No step is scripted, and the next grudge comes from the world's state, not from a chapter.

## 2. Guardrails (ruling a: a shared world)

| Rule | How it is enforced |
|---|---|
| Only grudge-marked rivals can be killed | The rival's `CharacterDefinition` carries `rival` data (§9). An `essential: true` figure can never be marked. Any figure without `rival` data cannot be attacked |
| Only a player holding the grudge may attack | The server refuses an engage unless the attacker holds the `grudge-state` for that rival and the rival's current `cycle`. Everyone else sees him as a normal NPC |
| One death per rival per successor cycle | `rival-state.status` must be `alive`. The first verified kill sets `dead` and closes every other holder's grudge on that cycle (`lapsed`, no penalty) |
| The town never fully loses the service | While the rival is dead, his `standIn` runs the service at worse terms (§5) |
| Successor in 7–14 days | `successorAt` is set at death (§5) and is never later than 14 days |
| The death opens a succession event | A public event, open to any player (§6) |

## 3. Grudges

**Where grudges come from:**

1. **The grudge generator (§3.1, binding, Dom).** This is the main source. Every rotation, a deterministic generator rolls the live
   grudges from data tables.
2. **Story entries.** Rare hand-authored grudges sit in the same table (§3.1) and are rolled by the same generator. They are never a
   separate path.
3. **Retaliation** (PROVISIONAL). If the giver is grudge-markable, the dead rival's town gains a mirror grudge against the giver for
   that cycle. It is offered by the town's own service NPC to players who are not wanted there. If the giver is `essential`, no
   retaliation exists. Orla, for example, is essential.

### 3.1 The grudge generator (Dom, 2026-10-07, PROVISIONAL numbers)

Grudges are **generated**: scalable, random, and shared. Every player in a rotation sees the same live grudges, and can talk to the
same givers about them. The next rotation rolls new pairs.

**Inputs are data tables.** Each is a content kind, loaded with the bundle:

```json
{ "kind": "npc-trade", "schemaVersion": 1, "id": "smith", "name": "smith", "network": true }
{ "kind": "grudge-motive", "schemaVersion": 1, "id": "undercutting", "trades": "same", "weight": 30, "rewardPermille": 1000,
  "line": "{rival} at {rivalTown} sells my own work for half my price. Put {rival.him} in the ground and I pay {reward}." }
{ "kind": "defence-kit", "schemaVersion": 1, "id": "ringed", "weight": 40, "minTownTier": 1,
  "townDefence": "rings-standard", "bouncer": false, "patronAllowed": true, "rivalKillNotoriety": 600 }
{ "kind": "grudge-twist", "schemaVersion": 1, "id": "flee-at", "weight": 30, "params": { "percent": 30 } }
{ "kind": "grudge-generator", "schemaVersion": 1, "region": "region:ash-frontier",
  "rotationSeconds": 604800, "livePerTownMax": 2, "livePerRegionMax": 6, "varietyWindow": 4,
  "rewardBronzePerLevel": 25, "storyWeight": 5 }
```

| Table | Starting rows (PROVISIONAL) |
|---|---|
| Trades | `smith`, `armourer`, `ferryman`, `healer`, `fence`, `merchant` |
| Motives (trades, weight, reward ×) | undercutting (same, 30, ×1.0) · stolen apprentice (same, 20, ×1.1) · old debt (any, 20, ×1.0) · family insult (any, 15, ×1.2) · rigged duel (any, 15, ×1.3) |
| Defence kits (weight, rival-kill notoriety) | `light`: outer ring only (30, 500) · `ringed`: three rings (40, 600) · `ringed-patron`: rings and the town's patron strikes (20, 650) · `bouncer`: rings and a bouncer at once (10, 750; town tier ≥ 3) |
| Twists | Strategy's cheap-first set: `flee-at`, `one-health-bar`, `no-block`, `damage-only-on-parry`, `heal-on-hit`; `hazard` and `candlelight` once render work lands |

**Which NPCs can be picked:**

- **Rival:** any NPC with a `trade` and `rival` data (§11), **not essential**, `alive`, and in a town that is not `safe`.
- **Giver:** any service NPC with a `trade`. Essential NPCs may be givers, Orla for example. A giver is never in the rival's town.
- **Motive and trade:** a `trades: same` motive needs the giver and the rival to share a trade, and `any` does not. The rival's
  trade decides the shun network (§5.1) and the alert network (§7.1).

**The generator: `rollGrudges(seed, tables, worldState, history) → grudge-roll`.** It is a pure function: no clock, no
`Math.random`, integers only.

1. **Seed.** `seed = hash32(serverSeed, region, rotationIndex)`, where `rotationIndex = floor(serverTime / rotationSeconds)`. The
   PRNG is one fixed integer generator named in the contracts (for example mulberry32), so every engine rolls the same values.
2. **Candidates.** Build every (giver, rival, motive) triple that passes the rules above. Drop rivals that are `dead`. Drop any triple
   used in the last `varietyWindow` rotations (**no repeat of the same giver, rival and motive within 4 rotations**). Drop rivals
   already rolled in this rotation.
3. **Pick.** Draw by weight, up to `livePerRegionMax` (**6**), with at most `livePerTownMax` (**2**) rivals per town. Story entries
   join the same draw at `storyWeight` (**5**, against the summed motive weights), and keep their own fixed fields.
4. **Dress.** For each pick, draw a defence kit (filtered by town tier and patron), then a twist.
5. **Price.** The reward is `rewardBronzePerLevel × rival level × motive.rewardPermille / 1000` bronze, floored. The notoriety cost
   is the kit's `rivalKillNotoriety`. The CP is the rival's own row (`named`).
6. **Emit.** Write one `grudge-roll` for the rotation. The writer runs this **once, at rotation start**, and persists the result, so
   a death later in the rotation never changes the live list. History is the stored rolls themselves.

```json
{ "kind": "grudge-roll", "schemaVersion": 1, "region": "region:ash-frontier", "rotation": 2931, "seed": 2864451027,
  "grudges": [
    { "id": "grudge:ash-frontier-r2931-1", "giver": "character:smith-orla", "rival": "character:rival-mimir",
      "motive": "undercutting", "kit": "ringed-patron", "twist": "flee-at", "rewardBronze": 325, "rivalKillNotoriety": 650,
      "story": false } ] }
```

**Guardrails, unchanged.** Only an NPC named as a rival in a live roll is grudge-marked for that rotation, and only its holder may
attack it (§2). A grudge held when the rotation ends stays held until its own expiry (`GRUDGE_EXPIRY_S`), and the next roll
skips that rival while it is held.

**Testability.** These are properties for the contracts PR:

- the same seed and inputs give a byte-identical roll;
- no roll breaks the per-town cap, the per-region cap or the variety window;
- giver and rival towns always differ;
- no essential or dead rival is ever picked;
- `same`-trade motives only pair matching trades;
- story entries obey every cap.

Fixed seed-to-roll vectors pin the generator, as the progression model pins its numbers.

**Example rolls** (illustrative only: the real values come from the generator's pinned test vectors once it exists). Region 1 has a
small pool: Orla (smith, the Exchange), Mimir (smith, Grey Ferry), Ebba (smith stand-in), and two PROPOSED NPCs, a fence at the
Cinder shrine and a healer at the Grey Ferry.

| Rotation | Giver → rival | Motive | Kit | Twist | Reward | Notoriety |
|---|---|---|---|---|---|---|
| r2931 | Orla → Mimir (L13) | undercutting | ringed + Zeus | flee-at 30% | 325 bronze | 650 |
| r2931 | the fence → the healer (L12) | old debt | light | no-block | 300 | 500 |
| r2932 | the healer → the fence (L12) | family insult | ringed | one-health-bar | 360 | 600 |
| r2933 | Orla → Mimir (L13) | stolen apprentice (a new motive, so not a repeat triple) | bouncer | damage-only-on-parry | 357 | 750 |

**Story entries.** `grudge-definition` (§10) gains `story: true` and a `weight`. It is a fixed pair, motive and line, drawn
rarely in the same roll. *Orla against Mimir, over the stolen pattern* is the region's first story entry.

**How many at once:**

| | Value | Data key |
|---|---|---|
| Grudges a player may hold | **1** | `GRUDGE_HELD_MAX` |
| Open offers per giver | 1 per `grudge-definition` whose rival is `alive` | — |
| Holders per rival per cycle | unlimited; the first kill settles it | — |
| A held grudge expires after | **72 h** (`259200` s), with no penalty | `GRUDGE_EXPIRY_S` |
| The giver re-offers to the same player after expiry or decline | **24 h** (`86400` s) | `GRUDGE_REOFFER_S` |

**Who can hold one** (every condition must hold at the offer):

- the player has passed the outer gate (Gladiator, server-verified career level);
- the player's notoriety **in the giver's town** is below `SUSPECT` (100);
- the player's standing with the giver's faction is at least `neutral` (`attitudeFor` > −100);
- the player holds no other grudge;
- the rival is `alive` on this cycle.

**The offer, as talk.** It is the `npc-talk` v1 shape plus two contract additions, listed in §11:

```json
{ "id": "grudge-mimir", "priority": 10, "once": false,
  "text": "You look like trouble.",
  "reply": "Then make it his. Mimir at the Grey Ferry sells my own pattern for half my price. Put him in the ground and the forge pays you.",
  "when": [{ "kind": "tier-at-least", "tier": "Gladiator" }, { "kind": "grudge-open", "grudge": "grudge:orla-mimir" }],
  "effects": [{ "kind": "grudge", "grudge": "grudge:orla-mimir" }] }
```

- `grudge-open` is a new **condition**. It holds when every eligibility rule above holds.
- `grudge` is a new **effect**. The server writes `grudge-state` (`held`) on it.
- A decline is just a farewell line. The giver can be asked again after `GRUDGE_REOFFER_S`.
- There is no walk back. The reward is paid **on the verified kill** wherever it happens: **300 bronze** (`GRUDGE_REWARD_BRONZE`,
  per definition), plus standing **+50** with the giver's faction and **−100** with the rival's town faction.

**The kill.** The rival fights as a duel at his `encounterForms` level, in his own town, and may carry a twist (an encounter flag,
for example a forge-floor hazard). A loss costs nothing: the grudge stays held until it expires, and the player may retry. The kill
pays the rival's CP row, `named` (weight 200), like any named figure. No new row is needed.

## 4. Notoriety (ruling b)

Notoriety is **per killer, per town**, an integer from `0` to `NOTORIETY_MAX` (**1000**). Ruling (b) said other towns are unaffected, but Dom's alert rule (§7.1)
now spreads part of a grudge kill to the same trade's network towns. That conflict is flagged in §13. Notoriety is stored
with its last update time and decays lazily, the same refill pattern as rested credit, so no clock job is needed.

| Act (in town T) | Change in T |
|---|---|
| Kill T's grudge rival | **+600** (`NOTORIETY_RIVAL_KILL`) |
| Beat a T guard in a challenge | **+50** (`NOTORIETY_GUARD_BEATEN`) |
| Fight on the *settle* side of T's succession event | **+100** (`NOTORIETY_SETTLE_SIDE`) |
| Fight on the *back* side of T's succession event (not the killer) | **−100** (`NOTORIETY_BACK_SIDE`) |
| Serve a jail sentence in T | **−200** on release (`NOTORIETY_JAIL_SERVED`) |
| Time | **−100 per day** (`NOTORIETY_DECAY_PER_DAY`), continuous, rounded down when read |
| Pay off | **3 bronze per point** (`NOTORIETY_PAYOFF_BRONZE`), any amount, paid at the Exchange magistrate, who is neutral ground |

**Thresholds in T:**

| Band | From | Effect in T |
|---|---|---|
| Clean | 0 | — |
| Suspect | **100** (`SUSPECT`) | shops charge **×1.25** (`SUSPECT_PRICE_PERMILLE` 1250); grudge offers in T are withheld |
| Wanted | **300** (`WANTED`) | **shops refuse**; guards challenge on sight (§7); outer and middle rings and divine strikes are active (§7.1) |
| Hunted | **600** (`HUNTED`) | as Wanted, plus the inner ring and the bouncer (§7.1), NPC hunters (§8) and, once PvP exists, a player bounty (§9) |

Worked example: a rival kill takes a player to 600, Hunted. Decay brings them below Wanted in 3 days and to 0 in 6 days. Paying it
all off costs 1,800 bronze, about 30 Gladiator Pit wins at the placeholder 60 bronze a win. The player is clean before the
successor arrives, which is by design.

## 5. Stand-in and successor

| | Value | Data key |
|---|---|---|
| Successor arrives after death | **7–14 days**; the exact day is set by the succession event (§6) | `SUCCESSOR_MIN_S` 604800, `SUCCESSOR_MAX_S` 1209600 |
| Stand-in buy price | **×1.5** of the normal price | `STANDIN_BUY_PERMILLE` 1500 |
| Stand-in sell price (what the player gets) | **×0.67** of normal | `STANDIN_SELL_PERMILLE` 667 |
| Services dropped | **`upgrade`** (the smith's upgrades) and any stock above `vendorTier − 1` | `STANDIN_DROPS: ['upgrade']` |
| Vendor stock tier | `economy.vendorTier − 1`, minimum 1 | — |
| The town's attitude to the killer | faction standing −100 (§3), on top of notoriety | — |

**The successor.** By default it is the same legend returning ("the Fracture throws him back"), as a new `cycle` of the same
character id. A `successors` list in the rival data can name a different heir instead (§9). Either way, when the successor arrives
the grudge reopens and the stand-in steps down.

### 5.1 Trade shunning (Dom, 2026-10-07): the mild early stage

Dom's town-defence rules (§7.1) **replace** shunning as the main response. Shunning stays as the mild first stage: what a
network town does while the killer is only **Suspect** there, before its guards act.

After a grudge kill, the dead rival's **trade** shuns the killer in every **other** town. If you kill a smith, every other smith
keeps you out.

**Who is affected.** Only the killer, and only NPCs with the same `trade` key (§11). The giver of that grudge is exempt, since she
commissioned it. Other players see and use those NPCs exactly as normal.

**Not invisible.** The NPC stays where everyone sees it, so two players standing side by side always see the same people and the
same stall. Only three things change, and only for the killer:

- the NPC's stance becomes **turned away**: arms folded, back to the counter;
- the interact prompt reads **"Closed to you"** instead of the service;
- talking to the NPC gives one refusal bark, for example "I don't serve your kind. Ask Mimir. Oh, you can't."

The stall's shared geometry (shutters, goods, lights) never changes per viewer. A per-viewer shutter would make two players see
different worlds.

**How long it lasts.** It is tied to notoriety in the rival's town. A shun lasts while the killer is **Suspect or worse**
(≥ `SUSPECT`, 100) in that town, so decay and pay-off both end it.

- `until` is written at the kill as `at + ceil((points − (SUSPECT − 1)) / NOTORIETY_DECAY_PER_DAY)` days.
- Every notoriety change in that town rewrites `until`: a pay-off, a jail release, a guard win or an event.
- A rival kill at 600 shuns for **6 days**, unless the killer pays off sooner.

**Per trade, not per guild.** The key is the NPC's `trade` (`smith`, `ferrymaster`, `merchant`, …). Guilds do not exist in the
contracts yet, and a per-guild shun could be added later as a second key.

**Data:**

```json
{ "kind": "trade-shun", "schemaVersion": 1, "character": "pc:…", "trade": "smith",
  "fromTown": "town:grey-ferry", "until": "ISO", "version": 2 }
```

- The shape is per killer, per trade, with one expiry. A second kill in the same trade keeps the later `until`.
- The server answers a service request from the killer with `refused: 'shunned'`.
- The view model carries a per-viewer `stance: 'turned-away'` and the `"Closed to you"` prompt for that NPC.

## 6. The succession event

The rival's death opens a **public** `EncounterDefinition` (`scope: public`) in the rival's town for **30 minutes**
(`SUCCESSION_EVENT_S` 1800). Any player may join, on one of two sides:

- **Back the stand-in:** duel the giver's hired blades, who come to wreck the shop. The killer cannot take this side.
- **Settle the grudge:** duel the town's watchmen, who hold the shop for the stand-in. Doing so raises your notoriety (§4).

Each side's score is the sum of its members' verified fight contributions. Ties and empty events count as `unresolved`.

| Outcome | Successor arrives | Effect for the cycle |
|---|---|---|
| `backed` | `died + 7 days` | stand-in buy price eased to **×1.25** |
| `settled` | `died + 14 days` | the giver's own service gives **10% off** (`GIVER_DISCOUNT_PERMILLE` 900) until the successor arrives |
| `unresolved` | a day from `died + 7` to `died + 14`, seeded from `(rival, cycle)` | — |

Every contributor who passes the contribution threshold earns **100 bronze** (`SUCCESSION_REWARD_BRONZE`). Event kills pay their own
CP rows: hired blades and watchmen are `elite`. Nothing is collected or counted. Each side is a run of duels with an end.

## 7. Guards (a duel game, so an arrest is a duel)

- **Challenge.** A guard challenges a Wanted or Hunted player who is in the town's zone, on sight. The player cannot slip past.
  The challenge is an NPC duel at level **max(25, your level + 5)**, capped at the ladder top (`GUARD_LEVEL_FLOOR` 25,
  `GUARD_LEVEL_OVER` 5), so it is far above low levels.
- **Win.** You walk on, +50 notoriety. Another guard challenges after **120 s** (`GUARD_RECHALLENGE_S`) if you stay in the zone.
  Guards pay **no CP**, through a new `guard` row with weight 0 (§11), so guards cannot be farmed.
- **Loss = arrest.** **Never gear loss, never item loss.** Inventory, equipment and the bank are untouched. You get:
  - **Fine:** 2 bronze per notoriety point, minimum 100 (`FINE_BRONZE_PER_POINT`, `FINE_MIN_BRONZE`). It is taken from the metal
    balance, down to 0. An unpaid remainder becomes extra jail at 1 s per bronze.
  - **Jail:** **600 s** (`JAIL_S`), plus that remainder, capped at **1800 s** (`JAIL_MAX_S`).

**What jail is.** Your world character is placed in the town's guardhouse cell, at the town's `jail` landmark (§9). It cannot move
or fight in the world until released. Real time counts, including while you are logged out.

- **The Pit stays open.** A jailed player can still fight in the arena. Jail blocks the world, never the game.
- **Bail:** 1 bronze per remaining second (`BAIL_BRONZE_PER_S`), at any time.
- **Release:** you go to the town's gate with notoriety −200. A release never re-triggers a challenge for 120 s.

### 7.1 How towns defend after a grudge kill (Dom, 2026-10-07, PROVISIONAL)

This is the main response to a killer. Every value here is data on a `town-defence` record (§11). Every stage steps down **at once**
when the killer's notoriety in that town falls below its band, whether by decay, pay-off or a jail release.

**Shapes of the four rules:**

```json
{ "kind": "town-defence", "schemaVersion": 1, "town": "town:grey-ferry", "network": "smith",
  "protects": "character:rival-mimir", "centre": "forge-yard", "patron": "zeus",
  "rings": [
    { "id": "outer",  "fromMetres": 30, "band": "wanted", "guardLevelFloor": 25, "guardLevelOver": 5,  "damagePermille": 1000 },
    { "id": "middle", "fromMetres": 15, "band": "wanted", "guardLevelFloor": 30, "guardLevelOver": 10, "damagePermille": 1500 },
    { "id": "inner",  "fromMetres": 0,  "band": "hunted", "guardLevelFloor": 40, "guardLevelOver": 20, "damagePermille": 4000 } ],
  "bouncer": { "character": "character:bouncer-ascapart", "level": "cap", "hiredAt": "hunted" },
  "strike": { "windupTicks": 72, "radiusMetres": 2, "woundPermille": 350, "everySeconds": { "outer": 20, "middle": 10, "inner": 5 }, "arrestAfter": 3 } }
```

**1. The alert spreads.** A grudge kill in town T adds notoriety in T (+600, §4). It also adds **50%** of that
(`ALERT_SPREAD_PERMILLE` 500, so **+300**) in every **other town of the same region** that has an NPC of the dead rival's trade: the
trade's guild network. +300 is exactly `WANTED`, so the network's guards attack on sight from the first kill.

- Towns outside the region get nothing (`ALERT_SPREAD_CROSS_REGION_PERMILLE` 0), until region 2 sets its own.
- Spread notoriety decays and is paid off per town, like any notoriety. The magistrate also offers **"pay all"**: the sum across
  towns at 3 bronze a point.
- **Shunning (§5.1)** covers the gap: a network town where the killer is only Suspect shutters for them, and nothing worse happens.

**2. Defence in rings.** Each defended town has a `centre` landmark, the protected service NPC's yard. Each ring has a lower
distance bound from the centre. A Wanted player is challenged by that ring's guard as they cross into it.

| Ring | From the centre | Active at | Guard level | Guard damage to a wanted player |
|---|---|---|---|---|
| outer | ≥ 30 m | Wanted | max(25, you + 5) | ×1.0 |
| middle | 15–30 m | Wanted | max(30, you + 10) | ×1.5 |
| inner | < 15 m | **Hunted** | max(40, you + 20), capped at the top | **×4.0**: one or two heavies end the duel |

- `damagePermille` is an **Origins encounter flag** on the guard's fight, like the twists (Strategy ruling 10, region 1 §7). It must
  not move the live ladder: the RNG fingerprint and RV stay unchanged.
- A guard loss is an arrest (§7): a fine and jail, **never gear loss**.

**3. The bouncer.** When a player becomes **Hunted** in a town of the network, that town hires a champion. He stands at the protected
NPC's door until no player is Hunted in the network.

| | Value |
|---|---|
| Who | **Ascapart**, the giant of *Bevis of Hampton* (legend, §12), on the `knight` body at a large scale |
| Level | **the ladder top** (`MAX_LEVEL`: 46 today, 50 after the cap ruling). Only a capped player meets him at even level; anyone lower fights uphill and the falloff caps the CP |
| Fight | one duel; twist `one-health-bar` (his two phases share one bar); inner-ring guard damage does **not** apply to him |
| Reward (first win only) | CP: the `world-boss` row, once per player (`world-boss:character:bouncer-ascapart`). Loot: a unique piece, *Ascapart's collar* (Crest cosmetic, relic, `quest-reward`-style provenance via the boss table, first win only). Metal: **1,000 bronze** (`BOUNCER_PURSE_BRONZE`) |
| Notoriety cost | **+400 in every network town** (`NOTORIETY_BOUNCER_BEATEN`, spread at 100%) |
| After a win | he leaves for the rest of the alert, and is hired again at the next Hunted alert. The inner ring stays |
| On a loss | an arrest, with the §7 fine and jail |

**4. Patron gods.** A town may name a `patron`. A **Wanted** player in a patron town is struck by the god, telegraphed, so it is a
test of skill, never an unavoidable instant death.

- **Telegraph:** a 2 m marker and a rising sound appear under the player, with a **1.2 s** wind-up (`windupTicks` 72 at 60 Hz).
  Stepping or rolling out of the marker in time means no hit. Running speed (4.6 m/s) clears it in about 0.45 s.
- **Effect of a hit:** no instant death and no gear loss. The player is **wounded**, starting their next duel at −35% health
  (`woundPermille` 350, stacking). **3 hits** (`arrestAfter`) leave the player dazed, and the guards arrest them with no duel
  (§7: fine and jail).
- **Cadence** rises toward the shrine and the smith: every 20 s in the outer ring, 10 s in the middle ring, 5 s in the inner ring.
- **Pauses** during any duel and while jailed. Wounds clear on release from jail, or after 10 minutes out of the town.
- **Patrons for region 1** (PROPOSED): the Grey Ferry under **Zeus** (bolt).
- **Flagged for Strategy:** whether Greek gods as **unseen patrons who strike**, never fought or beaten, pass the legends rule.
  Ruling 4 names Hades as allowed. Zeus, Apollo and Hades come from a dead pantheon, but a small living Hellenic polytheist revival
  exists. Apollo, Hades, Hermes, Athena and Hephaestus are already Pit legends.

**Escalation by band, per town:**

| Killer's band in T | T does |
|---|---|
| Clean (< 100) | nothing |
| Suspect (100–299) | shuns: same-trade stalls are "Closed to you" (§5.1); shops charge ×1.25 |
| Wanted (300–599) | shops refuse; outer and middle rings challenge; patron strikes |
| Hunted (≥ 600) | adds the inner ring (×4) and the bouncer; NPC hunters roam outside towns (§8) |

## 8. NPC hunters

While you are **Hunted** in any town T, T sends hunters after you **outside towns** only: open, non-safe frontier zones.

- **No hunters** in a town zone, in a safe zone (the Exchange), during a Pit fight, or while you are jailed.
- **Interval:** at most one hunter every **30 minutes** (`HUNTER_INTERVAL_S` 1800).
- **Level:** your level + 2. Hunters are `elite`, and their CP draws on the rested allowance like any creature.
- **Win:** the hunter's purse, **50 bronze** (`HUNTER_PURSE_BRONZE`). Notoriety is unchanged.
- **Loss:** an arrest in town T (the §7 fine and jail), and you are moved to T's cell.
- **Named hunter.** At notoriety **≥ 900** (`NAMED_HUNTER_FROM`), the hunter is **Herne the Hunter** (legend), at your level + 5,
  with the `no-block` twist. Herne is a `named` row, not once-only: he comes again on the next interval while you stay at 900 or
  more.

## 9. The PvP bounty (ruling c: in the design, NOT in the current beta)

Until server-authoritative PvP exists, **only NPC hunters (§8) hunt wanted players.** The player bounty below is specified now and
switched on later. It needs:

- the duel verifier chain: #1392 (anti-farm storage and verifier counting), #1485 (`duel_records` and `report_duel_record`), #1487
  (record upload), all open;
- open-world PvP.

| Rule | Value |
|---|---|
| Posted when | the target reaches **Hunted** (600) in town T |
| Amount | **1 bronze per notoriety point** at posting (`PVP_BOUNTY_BRONZE_PER_POINT`). The town funds it as minted metal, never another player's metal, so it cannot be used to pass value between friends |
| Who may claim | any player who is **not Suspect or worse in T**, within `partyEligible` of the target's level, not the same account, and not a trade counterparty of the target in the last 7 days |
| How | a verified duel won against the target, recorded through the verifier chain. A claim carries the duel record id, and the server rejects a claim without one |
| Limits | one claim per posting. The same hunter–target pair may claim once per **7 days** (`PVP_PAIR_COOLDOWN_S`). The posting expires when the target drops below Wanted |
| Target's loss | an arrest in T (the §7 fine and jail). **Never gear loss** |

## 10. Region 1 example

| Role | Who | Town (zone) | Source |
|---|---|---|---|
| Giver | Orla the Smith (`character:smith-orla`, essential) | the Concord Exchange (safe; no retaliation against her) | original, existing |
| Rival | **Mimir the Smith** (`character:rival-mimir`, `named`, L13, `dwarf` body) | the Grey Ferry (`ferry-landing`, which becomes a town) | legend, §12 |
| Stand-in | Ebba, Mimir's apprentice (`character:standin-ebba`) | the Grey Ferry | original |
| Succession: hired blades / watchmen | court thralls / Ferry watch (`elite`) | the Grey Ferry | original |

`grudge-definition` (new content kind):

```json
{ "kind": "grudge-definition", "schemaVersion": 1, "id": "grudge:orla-mimir", "story": true, "weight": 5, "motive": "undercutting",
  "giver": "character:smith-orla", "giverTown": "town:concord-exchange",
  "rival": "character:rival-mimir", "rivalTown": "town:grey-ferry",
  "reward": { "metalBronze": 300, "standing": [{ "faction": "faction:concord", "delta": 50 }, { "faction": "faction:ferry-court", "delta": -100 }] },
  "gate": "outer" }
```

The Grey Ferry needs guards and a cell, so `ferry-landing` gains a `town` group (§11): `{ "id": "grey-ferry", "jail":
"ferry-house", "guards": true }`.

## 11. Server state and content shapes (for the contracts and the writer)

**Content (bundle):**

- `grudge-definition` v1, as in §10 (story entries).
- Generator tables: `npc-trade`, `grudge-motive`, `defence-kit`, `grudge-twist`, `grudge-generator` (§3.1).
- Shared, written once per rotation: `grudge-roll` (§3.1).
- On `CharacterDefinition`, a new optional field `trade` (a key such as `smith`) for every service NPC, used by shunning (§5.1).
- On `CharacterDefinition`, a new optional field
  `rival: { town, standIn: CharacterId, successors: CharacterId[] (empty = the same character returns) }`. It is refused on an
  `essential: true` figure.
- On `ServiceDefinition`, a new optional field `standIn: { npc, buyPermille, sellPermille, drops: ServiceKind[] }`.
- `town-defence` v1 (§7.1): rings, bouncer, patron and strike, all as data.
- World schema group #16, `town`: `{ id: key, jail: ref, guards: bool }`, with defaults none, none and false. A zone with no
  `town` group has no guards and no notoriety.

**Shared world state (one row per rival):**

```json
{ "kind": "rival-state", "schemaVersion": 1, "rival": "character:rival-mimir", "town": "town:grey-ferry",
  "cycle": 3, "status": "alive | dead", "diedAt": "ISO | null", "killedBy": "pc:… | null",
  "successorAt": "ISO | null", "event": "event:… | null", "version": 12 }
```

**Per player:**

```json
{ "kind": "grudge-state", "schemaVersion": 1, "character": "pc:…", "grudge": "grudge:orla-mimir", "cycle": 3,
  "status": "held | settled | lapsed | expired", "takenAt": "ISO", "expiresAt": "ISO", "settledAt": "ISO | null" }
{ "kind": "notoriety", "schemaVersion": 1, "character": "pc:…", "town": "town:grey-ferry", "points": 600, "at": "ISO", "version": 4 }
{ "kind": "jail-state", "schemaVersion": 1, "character": "pc:…", "town": "town:grey-ferry", "until": "ISO", "fineBronze": 1200, "event": "…" }
{ "kind": "trade-shun", "schemaVersion": 1, "character": "pc:…", "trade": "smith", "fromTown": "town:grey-ferry", "until": "ISO", "version": 2 }
{ "kind": "hunt-state", "schemaVersion": 1, "character": "pc:…", "nextHunterAt": "ISO" }
```

**Events** (shared, one per death):

```json
{ "kind": "succession-event", "schemaVersion": 1, "id": "event:grey-ferry-3", "rival": "character:rival-mimir", "cycle": 3,
  "encounter": "encounter:succession-grey-ferry", "opensAt": "ISO", "closesAt": "ISO",
  "contributions": [{ "character": "pc:…", "side": "back | settle", "permille": 240 }],
  "outcome": "backed | settled | unresolved | null" }
```

The deferred PvP bounty adds `bounty-posting { target, town, amountBronze, postedAt, expiresAt, claimedBy, duelRecord }`.

**Writer ops.** Each op runs in one transaction with an idempotency key, the server time, and an append-only event:

- `grudge_take`
- `rival_kill`: verifies the holder and the cycle, sets `dead`, settles the holder, lapses the others, and pays the reward, the CP
  and the notoriety in one write;
- `succession_join`
- `succession_close`
- `successor_arrive`: lazy, run when first read after `successorAt`;
- `notoriety_payoff`
- `arrest`: fine, jail and the notoriety change;
- `bail`
- `release`
- `hunter_due`

No op moves an item, and every metal line is in the metal ledger (`trading.md` §3.2 option B).

## 12. Names (legends rule)

| Name | Source | Allowed because | Pronoun |
|---|---|---|---|
| Mimir the Smith | *Þiðreks saga af Bern* (Old Norse, 13th century): the smith who fostered and taught the young Sigurd and Velent | medieval literature, author long dead; not scripture; no living people's folk hero. Distinct from the Pit's smith legends (Regin, Wayland and others) | he |
| Ascapart | *Sir Bevis of Hampton*, Middle English verse romance (c. 1300), and the Anglo-Norman *Boeve de Haumtone*: the giant who serves Bevis as a squire and fights beside him | medieval romance, author long dead; not scripture; not a living people's folk hero. A hired giant, true to the source | he |
| Herne the Hunter | Windsor Forest folklore, first in print in Shakespeare's *The Merry Wives of Windsor* (1602) | English folklore and pre-1929 literature | he |
| Orla, Ebba, hired blades, the Ferry watch, guards, generic hunters | original (`lore.source: "original"`) | side NPCs and mooks | Orla she, Ebba she |

The Exchange magistrate who takes notoriety pay-offs is Marrow the Recorder (original, `region1-ash-frontier.md` §2).

## 13. Open questions

1. **All numbers above** are PROVISIONAL until Dom rules: rival kill 600, decay 100 a day, pay-off 3 bronze a point, thresholds
   100/300/600, guard level max(25, you + 5), fine 2 bronze a point, jail 600–1800 s, stand-in ×1.5/×0.67, successor 7–14 days,
   event 30 minutes, reward 300 bronze.
2. **A stand-in for a smith.** Today the smith's only `SERVICE_KINDS` entry is `upgrade`, and the stand-in drops it, so Ebba runs
   nothing until a shop or repair kind exists. The alternative is that a stand-in offers upgrades capped at +1 at ×1.5 until then.
3. **The successor**: the same legend returning (the default), or a named heir from `successors`? An heir who is a grudge target
   must also pass the legends rule.
4. **Retaliation grudges** (§3 source 3): in or out?
5. **The guard row.** Weight 0 means a new `TYPE_WEIGHTS` row (`guard`). Is one row allowed for this, or should guards use `elite`
   and accept that they can be farmed?
6. **Jail and the Pit.** Can a jailed player still fight in the Pit? The spec says yes, so the game is never blocked.
7. **Contract additions:**
   - the `grudge-definition` kind and the `grudge`, `town` and `event` id namespaces;
   - `rival` on `CharacterDefinition` and `standIn` on `ServiceDefinition`;
   - world group #16, `town`;
   - the `grudge-open` condition and the `grudge` talk effect;
   - the player-state rows and writer ops in §11.

   For Backend and the coordinator.
8. **Town ids** (`town:`) vs zone ids. Is a town always exactly one zone?
9. **Notoriety and faction standing** both move on a kill. Keep both (notoriety is per town and decays; standing is per faction and
   permanent), or fold one into the other?
10. **Alert spread vs ruling (b).** Ruling (b) said other towns are unaffected; Dom's alert rule spreads 50% to same-trade towns in
    the region. Strategy, please confirm that Dom's rule supersedes (b) for network towns.
11. **Patron gods.** Do Zeus, Apollo and Hades as unseen striking patrons pass the legends rule (§7.1)? Also, a world-movement
    "roll" does not exist yet (the walker has walk and run), so is stepping out enough?
12. **Inner-ring damage ×4** and the **bouncer at the ladder top**: confirm, plus his notoriety cost of +400 network-wide.
13. **Generator tables.** Confirm the starting trades, motives, kits and weights, the 7-day rotation, the caps of 2 per town and 6
    per region, the 4-rotation variety window and 25 bronze per rival level.
14. **Shun scope.** Per trade (as specified), or also per guild once guilds exist? Should a shunned killer also be refused by the
    giver's own trade outside the giver?
15. **The PvP bounty** stays parked until #1392/#1485/#1487 and open-world PvP land. Confirm the anti-collusion rules in §9.
