# ModernUO behaviour spec: virtues (independent reputation tracks)

- Donor: ModernUO (GPLv3), commit `261ea01ab4b7c49a043dfabc7f44703b648883f8`, read-only at `/opt/frankendom-shadow/work/expansion-donors/ModernUO` on the VPS. Paths are relative to `Projects/`.
- Spec author: analyst-modernuo. Clean-room: behaviour, formulas and constants only. Implementers must not open the donor tree.
- Destination: **story** (reputation tracks and titles) with hooks into **progression** and **combat** (each virtue unlocks a small active power).
- Content caution: the eight virtue names are Ultima's own setting vocabulary. Frankendom should rename the tracks (legends-rule applies); only the mechanics are taken.

## 1. Purpose

Each player has eight independent integer tracks (0 .. max). Specific deeds raise one track by a fixed or computed amount; most tracks also decay on a weekly timer. A track's value maps to a tier: none / Seeker / Follower / Knight. Tiers gate an active ability tied to that track (e.g. self-resurrection, damage bonus, summoning a boss early). Some abilities *spend* track points.

## 2. Files, functions, call graph

| Path:line | Function | Role |
|---|---|---|
| UOContent/Engines/Virtues/VirtueSystem.cs:10-29 | VirtueLevel, VirtueName | tiers 0..3; tracks 0..7 (index order Humility, Sacrifice, Compassion, Spirituality, Valor, Honor, Justice, Honesty) |
| VirtueSystem.cs:111-128 | GetVirtues / GetOrCreateVirtues | per-player context (created lazily) |
| VirtueSystem.cs:130-152 | IsHighestPath / GetLevel | tier function |
| VirtueSystem.cs:182-188 | GetMaxAmount | caps |
| VirtueSystem.cs:228-253 | Award | capped add, reports whether the tier changed |
| VirtueSystem.cs:255-275 | Atrophy | floor-at-0 subtract, reports whether it was > 0 before |
| VirtueSystem.cs:283-346 | AwardVirtue | wrapper with the compassion daily limit and messages |
| VirtueSystem.cs:348-354, 356-390 | CheckAtrophies / VirtueTimer | every 5 minutes run each track's decay check; drop unused contexts |
| UOContent/Engines/Virtues/VirtueContext.cs:37-221 | VirtueContext | values array + per-track timestamps and counters; "is used" test |
| Compassion.cs:9-37 | decay 500 / 7 days |
| Valor.cs:11-43 | decay 250 / 7 days |
| Valor.cs:45-122 | Valor ability | spend points to advance/start a champion spawn |
| Sacrifice.cs:11-13, 36-51, 53-84, 86-173 | decay 500 / 7 days; resurrect charges; gain by freeing a monster (1-day cooldown) |
| Justice.cs:21-22, 255-268 | decay 950 / 7 days |
| Justice.cs:24-253 | protector link (gates bonus scroll copies in champion rewards) |
| Honor.cs:12-102 | embrace honor: spend points for a timed buff; 5-minute cooldown after it ends |
| Honor.cs:104-158 | honor an opponent → HonorContext |
| HonorContext.cs:17-261 | honorable-combat tracking, perfection bonus, gain on kill |
| UOContent/Mobiles/PlayerMobile.cs:2511-2545 | Justice gain for killing a murderer |
| UOContent/Mobiles/Special/BaseChampion.cs:95-121 | Valor +800 for champion looters |
| UOContent/Engines/CannedEvil/ChampionSpawn.cs:588-611 | Valor per spawn kill |
| UOContent/Mobiles/Townfolk/BaseEscortable.cs:640-686; UOContent/Engines/ML Quests/Objectives/EscortObjective.cs:150-155 | Compassion for escorts |
| UOContent/Engines/Quests/Witch Apprentice/Mobiles/Grizelda.cs:188 | Sacrifice +250 quest reward |

Call graph:

```
deed (kill, escort, free monster, honorable kill) ──▶ Award(track, amount) ──▶ tier change? message
every 5 min ──▶ for each context: Sacrifice/Justice/Compassion/Valor decay checks ──▶ drop empty contexts
ability use (virtue menu) ──▶ tier gate ──▶ maybe Atrophy(track, cost) ──▶ effect
```

## 3. Data structures

**VirtueContext** (per player, created on first award or ability use):

| Field | Type | Meaning |
|---|---|---|
| values | int[8] or null | track values (null = all zero) |
| lastSacrificeGain | time | sacrifice gain cooldown anchor |
| lastSacrificeLoss, lastJusticeLoss, lastCompassionLoss, lastValorLoss | time | decay anchors |
| availableResurrects | int | sacrifice resurrection charges |
| nextCompassionDay | time | end of compassion daily window |
| compassionGains | int | gains in the current window |
| lastHonorUse | time | embrace cooldown anchor |
| honorActive | bool | embrace buff running |
| justiceProtection, justiceStatus | player ref, enum | protector link |

A context is "used" (kept) if any value > 0 or any timer/counter is still meaningful (cooldowns not yet elapsed, resurrect charges > 0, active link, etc.).

## 4. Formulas and constants

### 4.1 Caps and tiers (VirtueSystem.cs:133-152, 182-188)

`max(track) = 20,000` for Honor, `22,000` for Sacrifice, `21,000` for every other track.

`tier(v)`:
- `v < 4,000` → 0 (none)
- `v ≥ max` → 3 (Knight)
- else `floor((v + 9,999) / 10,000)`, i.e. 4,000..10,000 → 1 (Seeker), 10,001..20,000 → 2 (Follower), 20,001..max−1 → 3 (Knight).

So Knight is reached at 20,001 for 21k/22k tracks, before the cap; for Honor (cap 20,000) Knight is exactly the cap.

### 4.2 Award(track, amount) (VirtueSystem.cs:228-253)

1. `cur = value`; if `cur ≥ max` → return false ("highest path" message by caller).
2. If `cur + amount ≥ max` → `amount = max − cur`.
3. Record old tier; `value = cur + amount`; `gainedPath = (tier now ≠ old tier)`; return true.

Negative amounts are not guarded (would lower the value). AwardVirtue (283-346) adds: for Compassion, if `compassionGains > 0` and `now > nextCompassionDay` → reset window (gains 0); if `gains ≥ 5` → refuse ("wait about a day"); on success set `nextCompassionDay = now + 1 day` (**the window is pushed forward on every gain**, so it is "24 h since the last gain", not a calendar day) and `gains += 1`.

### 4.3 Atrophy(track, amount) (VirtueSystem.cs:255-275)

No context → false. `value = max(0, value − amount)`. Returns `value_before > 0`.

### 4.4 Decay (every 5 minutes; VirtueSystem.cs:348-390)

Per track, if `value > 0` and `lastLoss + 7 days < now`: atrophy by the loss amount, message if it was > 0, set `lastLoss = now`.

| Track | Loss per week | Extra |
|---|---|---|
| Sacrifice | 500 | after decay, `availableResurrects = tier` (resets charges to the tier number) |
| Justice | 950 | |
| Compassion | 500 | |
| Valor | 250 | |
| Honor, Humility, Spirituality, Honesty | no decay here | Honor is spent by its ability |

`lastLoss` defaults to the epoch, so the **first** decay happens at the first 5-minute check after the value becomes > 0, then weekly. (Surprise: a brand-new gain decays almost immediately, within ≤ 5 minutes.)

### 4.5 Gain sources

| Track | Deed | Amount | Gate |
|---|---|---|---|
| Valor | kill a champion-spawn minion (killer or its master must be a player) | `40 × (stageIndex + 1)` → 40/80/120/160 by the minion's stage | none ("no delay") |
| Valor | be among looting-rights holders when a champion dies (Felucca map only) | 800 | none |
| Compassion | escort an NPC to its destination | 200, or 400 for a rescued prisoner | max 5 gains per rolling 24 h (4.2); ML quest escorts skip it for "young" players / Haven |
| Sacrifice | free a specific evil creature type at ≥ 90% health, player fame ≥ 2,500, not at max | fame < 5,000 → 500; < 10,000 → 1,000; else 2,000. **Fame is set to 0.** Creature deleted 1 s later | once per 1 day (`now ≥ lastGain + 1 day`); tier-up grants +1 resurrect charge (max 3) |
| Sacrifice | specific quest reward | 250 | |
| Justice | kill a murderer (the most recent damager, or its master, must be a player other than the victim) | `p = floor(sqrt(victimGameTimeSeconds × 4)) × 5 + floor((victimSkillTotalTenths / 250)²)` | per-**victim** cooldown: next award from that victim only after `now + p/3 minutes` |
| Honor | kill a target you were honoring | see 4.6 | only if your honor ≤ target fame; not at max |

### 4.6 Honor gain (HonorContext.cs:17-227)

Honoring starts a context on (source, target): target must be at full health, not already honored by someone else in range, not a player (ML+), and passes a guarded-region rule. The context is cancelled if the two are more than 18 tiles apart (checked every 1 s), or 40 minutes after start.

Tracking:
- `firstHit`: NotDelivered → Delivered when the target takes damage first; → Granted if the source takes damage from the target first.
- On target damaged by `x`: if the hit was a poison tick → `honorDamage += 0.8x` (and not added to total). Else `totalDamage += x`; if dealt by the source: `honorDamage += x` if the target can see the source, has line of sight, and (source within 1 tile, or source still standing exactly on its start tile on the same map); otherwise `+0.8x`. Pet of the source: `+0.8x`. Others: total only.
- Perfection (Bushido ≥ 50): each source hit `+= floor(bushido / 10)` (cap 100); each miss `−25` (floor 0); any beneficial act on the target resets to 0.

On target killed: cancel; if perfection > 0 restore `min(perfection × (fame + 5,000) / 25,000, 10)` (integer) hits, stamina and mana. If source's honor > target fame → no gain. Else `g = fame / 100 × honorDamage / totalDamage`; if `|honorDamage − totalDamage| < 0.01` and firstHit == Granted → `g × 1.5`, else `g × 0.9`; `gain = clamp(floor(g), 1, 200)`; then Award (unless at max).

### 4.7 Abilities that read or spend tracks

| Ability | Gate | Cost / effect |
|---|---|---|
| Embrace Honor (Honor.cs:28-102) | not already active; tier ≥ Seeker; `now − lastHonorUse ≥ 5 min` | cost by current honor: `< 4,399` → 400; `< 10,599` → 600; else 1,000 (Atrophy). Duration by tier: Seeker 30 s, Follower 90 s, Knight 300 s. At end: inactive, `lastHonorUse = now` |
| Valor challenge on an active spawn (Valor.cs:59-106) | spawn not already advanced this run | by spawn sub-stage 0/1/2/3: need 2,500 / 5,000 / 10,000 / 20,000, spend 2,500 / 5,000 / 7,500 / 10,000 → spawn advances one level |
| Valor start an inactive spawn (Valor.cs:107-116) | tier Knight | spend 11,000; spawn starts |
| Sacrifice self-resurrect (Sacrifice.cs:53-84) | dead, not criminal, tier ≥ Seeker, charges > 0 | offers resurrection |
| Justice protector (Justice.cs) | tier ≥ Seeker, Felucca | links protector to protectee; protector gets a copy of champion scrolls with 60/80/100% by tier (see champion spec) |

## 5. Order of operations

Award: (compassion window) → cap check → clamp → tier before → set → tier after → message (path vs plain) → (compassion counters).
Decay tick: Sacrifice, Justice, Compassion, Valor, in that order, per player; then remove unused contexts.

## 6. Edge cases

- Valor ability when the champion has already spawned: the code sends "you may not" but **does not return**, so it proceeds to spend points and advance (donor bug; do not reproduce).
- Award creates a context (via the player's lazy property); Atrophy does not.
- Justice cooldown is stored on the murderer, not the killer.
- Sacrifice zeroes fame even though gain is capped.
- Honor kill with the player's honor above the target's fame returns silently (no message); at max it sends "cannot gain more".
- Perfection restore applies even when no honor is gained.

## 7. Randomness

None in the virtue core. (Honor and Valor are fed by combat outcomes that have their own RNG.)

## 8. Timing

- System timer: every 5 minutes (first after 5 minutes).
- Decay period: 7 days per track.
- Sacrifice gain cooldown: 1 day. Compassion window: rolling 24 h, 5 gains.
- Honor: target link timer 1 s; link lifetime 40 min; embrace cooldown 5 min after the buff ends.
- Justice per-victim cooldown: p/3 minutes.

## 9. Engine plumbing to strip

Virtue gump and info gumps, client virtue-button ids, targeting cursors, effects/sounds, persistence (GenericPersistence "Virtues"), legacy migration, region/guard checks (replace with Frankendom arena rules), Felucca-only conditions.

## 10. Golden cases (hand-derived)

| # | Input | Expected |
|---|---|---|
| V1 | tier(3,999) / tier(4,000) / tier(10,000) / tier(10,001) | 0 / 1 / 1 / 2 |
| V2 | Valor tier(20,000) / tier(20,001) / tier(21,000) | 2 / 3 / 3 |
| V3 | Honor tier(20,000) | 3 (= cap) |
| V4 | Valor 19,900 + 800 | 20,700; gainedPath **true** (2 → 3) |
| V5 | Valor 20,900 + 800 | clamped to 21,000; gainedPath false (already 3) |
| V6 | Valor 21,000 + 40 | Award false ("highest path") |
| V7 | Compassion 300, weekly decay | 0; returns true; message sent |
| V8 | Justice gain: victim game time 3,600 s, skill total 5,000 tenths | floor(sqrt(14,400)) = 120 → 600; (5,000/250)² = 400 → **1,000**; victim cooldown 333.33 min |
| V9 | Honor: fame 10,000, all damage honorable, target struck first (Granted) | 100 × 1 × 1.5 = **150** |
| V10 | Honor: fame 10,000, honorDamage 800 of 1,000, Delivered | 100 × 0.8 × 0.9 = 72 → **72** |
| V11 | Honor: fame 24,000, perfect | 240 × 1.5 = 360 → **200** (cap) |
| V12 | Honor: fame 50, any | 0.5 × … → floor < 1 → **1** (minimum) |
| V13 | Embrace honor with honor 4,398 / 4,399 / 10,599 | cost 400 / 600 / 1,000 |
| V14 | Sacrifice fame 7,000 | +1,000, fame → 0, next gain ≥ 24 h later |
| V15 | Valor challenge on spawn at level 9 (sub-stage 2) with valor 9,999 | refused (needs 10,000); with 10,000 → spend 7,500 → 2,500 left, spawn level 10 |
| V16 | Compassion: 5th escort at t; 6th at t + 23 h | 6th refused; at t + 24 h + ε after the 5th gain, window resets |
| V17 | Perfection restore: perfection 30, fame 20,000 | 30 × 25,000 / 25,000 = 30 → min(30, 10) = **10** |

### How to capture goldens on the VPS later (do not build now)

- Pure functions: `VirtueSystem.GetLevel`, `VirtueSystem.Award`, `VirtueSystem.Atrophy`, `VirtueSystem.AwardVirtue`, the four `*Virtue.CheckAtrophy`, `HonorContext.OnTargetDamaged/OnTargetKilled`.
- Harness: xUnit in `Projects/UOContent.Tests` (sequential fixture), `new PlayerMobile()`, set values via `VirtueSystem.GetOrCreateVirtues(pm).SetValue(i, v)`, set `Core._now` to drive decay and cooldowns (internals visible). For Justice/Honor kill paths, build a target `BaseCreature` with Fame and call the context methods directly rather than real combat.
- No RNG. Build: .NET SDK 10.0.201; VPS only.
