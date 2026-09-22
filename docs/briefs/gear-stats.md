# Brief 19 — Gear stats: Attack and RES (loot stops being cosmetic)

Owner: **Stats lane** — session "Frankendom - Stats, Damage, Defence", worktree `~/Developer/frankendom-stats`, state file `docs/state/stats.md`, reports to Lead. Written by Strategy 2026-09-22 on Dom's
word ("yes for stats", "if we're going to do it, let's do it properly"); revised 22:40 to sit under `docs/progression-direction.md`
(owner decision 2026-09-19: Season 1 skill-first; at Origin five character stats STR/DEX/VIG/END/POISE at baseline 100 with +50 points;
armour gives RES and heavier classes cost DEX/END). **This brief is the GEAR layer only: two stats, Attack and RES.** POISE, health,
stamina, the allocation and the light/medium/heavy armour classes are the Origin character layer and are not built here. Supersedes the Brief 5 line "visual cosmetics only, no stats"
(`src/loot.ts` header) once deliverable 5 lands; nothing before that changes a fight.

**Sequence.** Deliverables 1–4 start now and touch none of Combat's files. Deliverable 5 (the sim seam and the ladder retune) lands
**after** Combat's queue — knife approach fix, Executioner profile, Nightborn retune, shield rule — and after Weapons has taken the flips
and the battery (Dom's line in the Weapons session, pending). Stats never jump the four weapons.

## The bar
Gear tilts, skill decides. A naked Recruit can still beat every rung under its fairness cap; a full Origin set moves either stat by
**at most 20 %** against no gear. **No stat changes the timing of any attack, parry, roll or wind-up**: a longsword tell stays a
longsword tell at every tier (progression-direction rule). The daily duel stays a skill board: everyone fights it in the same fixed kit. Career fights use your own.

Pass condition for the whole brief, on Dom's phone: take a Praetorian helmet from a kill, see its numbers on the kill screen and the
paperdoll, feel the next fight differ, and lose it anyway to a cleaner fighter.

## The two stats
| stat | carried by | what it multiplies | range, naked → full Origin |
|---|---|---|---|
| Attack | weapon | damage dealt (`def.damage` at the hit) | 1.00 → 1.15 |
| RES | armour: the six wearing slots of the seven in `ARMOUR_SLOTS` (Helmet, Body, Arms, Gloves, Greaves, Boots; the Crest is the seventh and carries nothing) | damage taken, chip included | 1.00 → 0.80 |

Not on gear, by the owner's 2026-09-19 direction: **POISE** (posture resistance) is a character stat; **stamina** is END/DEX, and heavier
armour will COST stamina economy through the class penalties, never grant it; **health** is VIG. Those arrive with the Origin layer.

Values come from the Brief 14 tier ladder (Recruit rag → Legionary leather → Gladiator bone → Veteran copper → Champion bronze →
Praetorian iron → Master steel → Primus blackened steel → Invictus emerald → Origin gold & ruby): one number per tier per slot in a
data table, no hand values per piece. Attack gets the smaller range on purpose: kill timings, finisher windows and the fight-length
pins stay closest to what is measured today. The Crest carries nothing (it is a mark, not armour).

## Design rules (fixed)
- **One seam, pure sim.** A `Loadout` (the two multipliers, already resolved) is an input to `stepDuel`, applied where the hit resolves
  (`wound()` and chip on block) in `src/duel.ts`; posture (`shake`) is untouched. The sim reads nothing from the profile. Determinism and the arm64/x64 digest rule
  are untouched.
- **Opponents wear theirs.** Every opponent from Legionary up already wears its full six; it fights with that tier's stats. The ladder gets
  steeper by kit as well as by AI. Ladder retune per rung is part of deliverable 5, not a follow-up.
- **The record carries the loadout.** Both sides' multipliers go into `FightRecord`; `RECORD_VERSION` bumps; the replay verifier replays
  with them; daily and kill-link fixtures are re-recorded. A shared fight must replay with the numbers it was fought with.
- **Server-authoritative loot.** Owned pieces are awarded by the server from verified records; client-reported loot stops counting for
  anything a fight reads. Backend lane reviews the migration and RLS; Deploy applies it. Until this lands, the seam is not merged.
- **Daily duel in fixed kit.** Same kit for every player, chosen with the day's opponent; the board compares skill only.
- **Battery in brackets.** The fairness battery runs naked / mid (Champion) / full (Origin) kit, every player weapon × every live rung ×
  normal and hard × 24 seeds, as an exact snapshot like `tests/player-weapons.test.ts` today. The naked bracket is the guarantee.
- **Numbers shown.** Paperdoll shows Attack and RES and the tilt against no gear; the kill-screen take shows the signed delta of the
  piece on its own line (`+6 ATK` or `-4 RES`; a take moves one of the two, never both).
- **No new systems.** No durability, no repair, no upgrades, no sets, no crafting, no economy, no character stats. Two multipliers and
  a table, shaped so the Origin layer's `Loadout` (item ids + an approved allocation, resolved once) extends it rather than replaces it.

## Deliverables (one PR each, PR body is the report, receipt image where there is a screen)
1. **Tier stat table** — data + tests: every tier × slot resolves to the two multipliers; the full Origin set lands exactly on the caps
   above; a full Recruit set (rags) and the naked loadout are both the identity. No sim change.
2. **Loadout in the record** — `FightRecord` gains both loadouts, `RECORD_VERSION` bump, pack/unpack round-trip, verifier replays with
   it, fixtures re-recorded. Behind a flag so a naked loadout replays byte-identical to today's records.
3. **Server-authoritative awards** — migration + RLS: the award comes from a verified record's outcome, the client's `owned` is a cache.
   Backend reviews, Deploy applies at its deploy. Receipt: an award written by the server, none by the client.
4. **Bracketed battery + paperdoll numbers** — the battery script gains the three brackets and the snapshot test; Web design shows Attack
   and RES on the paperdoll and the kill-screen delta (Web owns the copy and skin, Stats supplies the numbers).
5. **The seam + the ladder** — multipliers at the hit in `src/duel.ts`, opponents wear their tier, daily duel fixed kit, ladder retune per
   rung until every bracket clears every cap, all fight-length pins green, honest before/after seed traces in the body. Lands after the
   shield. This is the PR that turns stats on.

## Cost, stated honestly
About two lane-weeks for Stats plus Backend's migration and Web's panel. The days are mostly re-measurement (deliverables 4 and 5),
not code: the seam itself is an afternoon.

## Owners
Stats builds 1, 2, 4 (script), 5. Backend reviews 3, Deploy applies it. Web builds the panel half of 4. Combat reviews 5's ladder
retune against its own profiles. Weapons re-runs the bracketed battery on every flip from then on. Lead sequences the merges; Strategy
reviews every PR body before merge.

## Addendum A (2026-09-22 23:10) — where the Origin character layer plugs in
Not built in this brief; recorded so the seam is shaped for it. Every stat in `docs/progression-direction.md` has a home in the sim
already (health, stamina, posture are the three resources every fight runs on):

| stat | touches in the sim | never |
|---|---|---|
| STR | damage dealt, posture damage dealt | timing |
| DEX | stamina cost per action, stamina regen | recovery speed |
| VIG | max health (100 = today's 150 HP) | |
| END | max stamina, share of regen | |
| POISE | posture damage taken (stagger / break resistance) | |

Armour beside them: RES cuts damage taken (this brief); medium and heavy classes subtract DEX and END (Origin layer). POISE is never
on armour. Defence is RES, not a character stat. The `Loadout` the sim takes must extend to these without a second seam.

## Addendum B (2026-09-22 23:10) — proposal owed by the Stats lane, due 2026-09-23 morning
A docs PR, no code, to Lead with Strategy copied. Dom decides on his phone; the decisions become Addendum C.

1. **Damage by weapon, by grip.** Read out of the live tables in `src/moves.ts` (per-weapon move defs: damage, windup / active /
   recovery ticks, reach, stamina, stagger, chip; grip per weapon, trident two-hand after #472). One page: weapon × grip ×
   light / heavy / thrust damage × speed (ticks and ms) × reach × stamina. State the pattern the numbers already follow (1h faster,
   lighter, cheaper; 2h slower, heavier, more posture) and where a weapon breaks it. Propose how the Attack tier multiplier sits on
   top: one cap for all, or a cap per grip, with the reason.
2. **Speed.** Fixed per weapon; no stat or tier changes any timing. A speed stat, if argued at all, is a separate proposal.
3. **Shield defence.** Two designs are on record: Dom's earlier "−20 % incoming while equipped, outgoing open" and the shield brief
   (GuardProfile: two sides covered, stops heavies, cheaper hold, posture drains faster while held, no flat attack penalty, one-hand
   weapons only, stowed on the back with a two-hander). Give three options, each costed against the battery, with a recommendation:
   (a) passive −20 % incoming RES while equipped, no outgoing penalty; (b) the guard profile only; (c) guard profile plus a smaller
   passive RES with an outgoing or stamina penalty. Say which keeps "skill decides" and which makes the shield a must-pick.

Format: tables, then one paragraph per decision with the number and the reason.

## Addendum C (2026-09-23 00:45) — Dom's decisions on the proposal (PR #491)
1. **One Attack multiplier for every weapon**, scaled by tier: nothing at Recruit, one step per tier, the cap at Origin. Dom's intent
   "better tiers give more, by Origin the most" is this ramp. Grip is not a balance axis (`src/moves.ts` declares the grip field data-only
   and the live tables do not sort by it). Displayed as whole points: an Origin weapon reads `+15 ATK`; a full Origin armour set reads
   `20 RES`, each piece its slot's share. Dom floated `+10 / +10`; Strategy keeps 15 / 20 (the brackets are built on them, and 10 is
   barely felt on a 150-health fight); changing either is two edits that must agree, `CAPS` and the matching integer coefficient in `multipliers()` (kept as literals so the
   multipliers never drift in floats), plus a snapshot re-pin; the tests fail loudly on a half-change. Minutes, not a redesign.
2. **Speed is fixed per weapon.** No speed stat, no tier touches any timing.
3. **Shield = option (b), guard profile only.** Two sides covered, stops heavies, cheaper hold, posture drains faster while held, no
   flat incoming reduction, no outgoing penalty. This is the shield brief as written (2026-09-22 18:40); Combat builds that and nothing
   else. Dom's earlier "−20 % incoming" is withdrawn: one item at Recruit would equal the whole Origin armour cap and stack to 36 %.

Settled findings from #491, no action: the cleaver's left light is the back of the blade (blunt, half damage) by design; RES multiplies
all damage taken including block chip, so armour is worth more against heavy hitters, which is armour doing its job.
