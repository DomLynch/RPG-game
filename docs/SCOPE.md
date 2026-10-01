# Frankendom — current scope (read this before any older scope line)

Owner decisions as of **2026-10-02 00:29 (+04, `date`)** (Dom), kept current by Strategy. When an older document, brief, state entry
or memory disagrees with this file, this file wins and the older line is stale. Dated decisions below name what they replaced.
*Rewrite 2026-10-02: the 09-25 stack-ranked list is replaced by the status table below; items Dom added since (duels, the Pit,
the 30 boss specials, class specials, menu, gear screen) are now in it.*

## Beta = the base game plus live duels (Dom 2026-09-25, duels added 2026-10-01)
Beta is the sword-duel game on the ten-title ladder, polished, on mid-range phones, shareable, with 1v1 duels between players.
Nothing that changes fight numbers through gear or parts ships before Origin.

**Beta status, 2026-10-02** (Lead runs the order; Strategy judges receipts; "done" = live or receipted in a lane state doc):

| # | Item | Status | Owner / next |
|---|---|---|---|
| 1 | Live blockers #722 (iPhone zoom) + #713 (taken weapon fights) | DONE | — |
| 2 | Five-person phone playtest (docs/playtest-1.md) | **OPEN** | Dom supplies the five; fix only what they hit |
| 3 | Mid-range Android: one real device run (frame rate, load, bundle) | **OPEN** | Dom (Samsung); fail = perf or bundle work before anything cosmetic |
| 4 | Ten opponents finished (gear, tier dressing, own attack style = its special) | DONE in code: #705 tier dressing, #709 carriers (Knight / Plague Doctor / Shieldmaiden), #716 Witch hood + robe silhouette, #717 Shieldmaiden lamellar, #706 her shield, #708 all MERGED (gh 10-02); the four newest' specials are in the live bundle (item 8) | Not re-checked on live by Strategy: taking each of the four newest's pieces at the kill screen |
| 5 | Share: replay link + vertical clip + duel challenge | IN PROGRESS | Web: share row DUEL / LINK / CLIP (#1277), text "1v1 me in Frankendom ⚔️" (Dom) |
| 6 | Five arenas on rotation | DONE: The Ash Pit, The Night Pit, The Rain Yard, Blood Sand, The Sunken Cistern in src/arena-themes.ts (trunk) and all five names in the live bundle at 8e812420 (curl 10-02 00:2x) | — |
| 7 | Combat feel: block feedback, heavy wind-up, kick punish | DONE by merged PRs: block feedback #756 + #939, charged-heavy lean B #679/#685/#687, kick punish #695 + #761 | Goblin kick-vs-perfect-guard trim PARKED until after Sat 10-03 |
| 8 | Special move = the second take; Pommel Strike day one; one skill slot | DONE: 11 skill moves in the live bundle at 8e812420 (curl 10-02 00:2x: skill_cleave, hewer, ironrush, jab, lunge, miasma, pommel, reaping, shove, stomp, witchfire) | — |
| 9 | Loot awards server-checked | DONE (awards_verified, loot_claims triggers, verifier role) | post-beta: bind a claim to a server-issued fight (#1230) |
| 10 | **Live duels** (Dom 2026-10-01: "duels in beta") | IN PROGRESS | Duel stack #1110 → #1116 → #1179 → #1226 → #1228 after the menu ships; migrations applied 10-01; gate 4 = Dom's two-device test Sat 10-03; minting stays admin-only until Dom turns it on (Strategy ruling 10-02 00:2x) |
| 11 | **The Pit** (hub between fights: gate, chests, props, blood edge, skull wall) | LIVE, polishing | Pit lane: skull wall #1160 |
| 12 | **Menu + gear screen** (Fitting rail live; top tabs, Gear + Your Record from GPT concepts 01/04) | IN PROGRESS | Web #1265 next run; the perf readout never shows to players |
| 13 | **Boss specials** ranks 8–10, 30 moves (rules FINAL 10-01: unblockable, not interruptible, 25 % ranks 8–10 / 20 % ranks 1–7, every 20 s, can kill) | 30 / 30 day PASS; night batch running | Strategy judges (Dom delegated); Combat wires one registry seam after Sat 10-03 |
| 14 | **Class specials** ranks 1–7 | PICKING | Each opponent's skill move covers ranks 1–3; one new move per opponent for ranks 4–7 (Dom's question 10-02 00:1x, Strategy recommends yes). Picked: Nightborn Seven Cuts; Witch / Plague Doctor / Knight (#1271). Six to pick. |

## Beta facts that stand (unchanged)

- **Skill moves** (from the 09-25/26 list): kill an opponent, the take offers their armour piece OR their special move; one move
  equipped, the 4th fight button (SKILL), 15 s cooldown, blockable and guardable, readable tell, attack timings untouched. Estoc Lunge
  and Iron Rush ship below heavy damage with stagger 0 and stamina damage 0; reach is their identity (Strategy, 2026-09-26).
- **Specials look bar** (Dom 2026-10-01): dark ink, darker than the floor, nothing pale or glowing over a fighter; hero and attacker
  readable; any change after a PASS needs a fresh film.
- **Rank armour = sets, not palettes (Dom 2026-09-26 18:2x)**: silhouette first, material second, colour third; sets read as factions (docs/briefs/armour-sets-direction.md). Colours ship now; the first three sets follow the Armour lane's audit order. Looks only in beta, stats at Origin season 1.
- **Ten opponents**: Centurion (ids stay `veteran`), Goblin, Pitborn, Nightborn, Executioner, Dwarf, Shieldmaiden, Knight,
  Plague Doctor, Witch. Ladder rungs 7–10 are the four newest.
- **Legends** (Dom 2026-09-27, via Strategy): every opponent carries a public-domain legend's name and a one-to-two-sentence original
  backstory at each of the ten rungs, read from the fight's level (dial-down shows that level's legend); text only, no fight-number change.
  No figures of living religions (Yama → Ereshkigal, Azrael → Arawn). Data `src/legends.ts` (Character Main); the table is in GAME_SPEC.md; the Web lane puts it on the site.
- **Finishers**: Plain + Split Crown + Decapitation + Run Through + Opened. No new finishers. Real dripping blood every fight.
- **Career** (Dom 2026-09-27 09:2x, via Strategy; *replaces the 3-then-5 marks rule and Origin at 205*): **one win = one sub-rank**.
  Level = 1 + wins, capped at 46: levels 1–5 Recruit I–V, 6–10 Legionary, 11–15 Gladiator, 16–20 Veteran, 21–25 Champion, 26–30 Praetorian,
  31–35 Master, 36–40 Primus, 41–45 Invictus, 46 Origin. Origin at 46 wins is the END of the beta ladder by design; the endgame (modes,
  features) starts there, and until it ships the ladder keeps running at level 46 with wins still counting. Losses never demote. Rank
  grants identity, not power. Coach mode counts fully: one ladder, no exhibition variant.
- **Difficulty = the level** (same ruling): every opponent fights at the player's level 1–46 regardless of who he is; level 1 is below
  today's Easy (a first-timer tapping attack wins fight 1), today's Hard at 45–46. Opponent character stays in the shape of his tables.
  The Options Difficulty picker no longer applies to the ladder (sparring and dev only). Calibration of levels 1–3 = Dom's friends, not the battery.
- **Opponent order** (same ruling): fight 1 is always the Centurion. Then a random pick from the opponents not yet beaten in the current
  pass; a loss is a rematch with the same one. All ten beaten = new pass, all ten back, Centurion not forced.
- **Loot v2**: every opponent's armour and weapon takeable at the kill screen (take one; tap is the take; Undo). Tier kit per Brief 14
  (rag & scrap → leather → bone → copper → bronze → iron → steel → blackened steel → emerald → gold & ruby); from Legionary every
  opponent wears the full six. Cosmetic only in beta.
  2026-09-27 (Dom, via Strategy): **the hero stays the current Recruit with his own face; no new hero body, no female hero.** Playable
  opponent bodies are an Origin endgame feature after beta ("all chars unlock at level origin"). The GPT Sand Legionary GLB becomes
  OPPONENT armour: the Centurion's BRONZE set (tier 5 = Champion, levels 21–25), same Centurion face, body and rig, only the six pieces
  and the weapon carry change. **All opponent tier kit**: generated on the /hero-set route (GPT-image + Kontext + TRELLIS at max) and
  fitted on each opponent's existing rig, no face or rig changes, helms cover from tier 2 up. Scope = "silhouette first, material
  second, colour third": THREE silhouettes per opponent (low / mid / high), materials and colours change between them — 30 sets,
  not 100. Sets lanes: Armour + Hero Look. Order: after the 46-level ladder is live; the Centurion bronze first as the proof (a
  cut-and-fit, no generation); the tier table for the other nine to Strategy before any generation spend. (Replaces: the legionary
  as a hero body, 2026-09-27 morning preview, now closed.)
  2026-09-26 (Dom picked take screen E2, via Strategy): (1) the take screen shows **no stats**: stat numbers are Origin season 1,
  after beta. (2) **The row is the pick**: one tile per Profile slot plus the fallen's special move last, tiles drawn large, one take
  per kill; a piece you own is a swap (never greyed) and still spends the take; Take takes the default offer drawn big on the card.
- **Player weapons**: longsword, warhammer, trident, scythe offered; knife, cleaver, estoc one by one as each clears the battery. No
  flip may un-offer a weapon Dom already uses. The taken weapon is the one the player fights with (#713).
- **Shield**: guard profile only (two sides, stops heavies, cheaper hold, posture drains faster); one-hand weapons; no flat damage
  reduction, no attack penalty. Centurion carries gladius + scutum from Legionary.
- **Fight opening** stays the plain versus still. **Fight text** states or reports, never instructs.
- **Words**: "warden" is out of every player-facing string.
- **Wall lash**: baked silhouettes + whip streak, no skinned meshes.

## Parked to after Origin (branches and docs kept, no lane time before launch)
- Grafting, creatures (Minotaur, Wraith, Werewolf, Skeleton), body parts as a take, anatomy slots, mutations, provenance, bestiary
  (docs/briefs/grafting-direction.md). *Was beta 2026-09-24 21:xx.*
- Gear stats (Brief 19 Attack + RES), damage and defence numbers on gear, the Origin character layer
  (docs/progression-direction.md). Skill decides, nothing tilts, until Origin.
- Arena Draw (the portrait strip; rejected on sight once already).
- Post-beta queue as before: victory headline; best-of-three promotion; Witch's cast reflected; trident hook-and-draw; PvP trophies +
  ghost PvP; one-life Pit run; mercy at the kill. (Challenge links moved to beta as live duels, 2026-10-01.)
- Ruled closed, do not reopen: wound attrition as handicap; thrust reach buff; rematch from the bad moment; opponent-reveal chrome
  over the arena (four rejections).

## Rules that do not move
Skill decides, gear tilts (a naked Recruit beats every rung under its cap). No stat changes timing. Sim stays pure and deterministic;
nothing reads inventory inside a tick. One deployer. Lanes report to Lead; Lead sends Strategy milestones; Strategy sets the bar and
briefs, never technique. Briefs name requirements and pass conditions on Dom's phone; coordinates only with a measurement behind them.
Visual PRs carry same-frame phone stills before merge; taste picks are Dom's on labelled options.
