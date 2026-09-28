# Frankendom — current scope (read this before any older scope line)

Owner decisions as of **2026-09-25 08:00** (Dom, "back to basics for beta"), kept current by Strategy. When an older document,
brief, state entry or memory disagrees with this file, this file wins and the older line is stale. Dated decisions below name what
they replaced.

## Beta = the base game (Dom 2026-09-25 morning)
Beta is the sword-duel game on the ten-title ladder, polished, on mid-range phones, shareable. Nothing that changes fight numbers
through gear or parts ships before Origin. *Replaces "GRAFTING IS BETA" (2026-09-24 21:xx) and everything that hung off it.*

**Beta work, stack-ranked (Lead runs the order; Strategy judges receipts):**
1. **Two live blockers today**: iPhone page zoom mid-fight (#722, merged 99fac109, deploy jammed since 23:33) and the taken weapon
   not fighting (#713). Live, curled, before anything else.
2. **Five-person phone playtest** (docs/playtest-1.md; Dom supplies the five). Fix only what they hit.
3. **Mid-range Android**: one real device run (frame rate, load time, bundle). Dist is 38.6 of 40 MB; nothing is verified off Dom's
   iPhone. Fail = perf or bundle work before anything cosmetic.
4. **Ten opponents finished**: merge the approved gear + tier dressing chain (#705 tier dressing, #709 carriers, #717 Shieldmaiden
   lamellar, #716 Witch rebuilt, #706 shield, #708); the four newest (Shieldmaiden, Knight, Plague Doctor, Witch) get their armour
   carriers back with the seams fixed so their gear is takeable like the six; the Witch reads as a Witch at 375 (hood + robe
   silhouette, not texture); each of the four gets its own attack style, not a reskin of the six.
   2026-09-26 (Strategy, Dom can veto): for beta, each of the four newest opponents' special move (Witch-fire, Shield-Hewer,
   Miasma, Iron Rush) IS its attack style; a distinct base-attack AI per opponent is post-Origin.
5. **Share**: "Share fight" = playable replay link; "Export clip" = real vertical video, 10–15 s ending on the kill, combat audio,
   phone share sheet; Open Graph tags on the replay page. Not started.
6. **Five arenas** on rotation: MET on 3f8e5e1c (Ash Pit, Night Pit, Rain Yard, Blood Sand, Sunken Cistern in src/arena-themes.ts,
   f42e64fe live 09-24). World owes one 375 phone-still sheet of the five for Dom; no new arena is built unless Dom asks for more
   after seeing it (World has a costed +2 at zero dist bytes).
7. **Combat feel**: block feedback you can see and hear (success and failure), a heavy wind-up that looks dangerous (charge pose B),
   kick punish (spam has a comeback; sim change on its own digest). Polish, not new systems.
8. **Special move = the second take** (Dom 2026-09-25): kill an opponent, the kill screen offers their armour piece OR their special
   move, one or the other, same panel as the armour take. One move equipped per duel, the 4th fight button (SKILL, placement A, Web's
   built button on web/skill-button), 15 s cooldown, ≥ heavy damage, blockable and guardable, readable tell, existing attack timings
   untouched. Ten opponents = ten moves; each is a sim change plus a fairness run; ship one opponent at a time, Witch first
   (docs/briefs/skill-witch-arm.md, numbers prop until Combat's battery), behind items 1–7. After Origin the take becomes one of
   three with the body part. Dom accepts the launch date moving for this.
   **Day-one move (Dom 2026-09-25 22:1x):** Hero starts with Pommel Strike; one skill slot; a take swaps it.
   2026-09-26: Estoc Lunge and Iron Rush ship below heavy damage with stagger 0 and stamina damage 0; reach is their identity (Strategy ruling on Combat's 480-seed table).
9. **Loot awards server-authoritative** (Backend): the server checks a claimed take against the fight record before it writes the
   row; the phone stops being believed. In beta because cheats are cheap and the fix is small.

## Beta facts that stand (unchanged)

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
  ghost PvP; one-life Pit run; mercy at the kill; challenge links.
- Ruled closed, do not reopen: wound attrition as handicap; thrust reach buff; rematch from the bad moment; opponent-reveal chrome
  over the arena (four rejections).

## Rules that do not move
Skill decides, gear tilts (a naked Recruit beats every rung under its cap). No stat changes timing. Sim stays pure and deterministic;
nothing reads inventory inside a tick. One deployer. Lanes report to Lead; Lead sends Strategy milestones; Strategy sets the bar and
briefs, never technique. Briefs name requirements and pass conditions on Dom's phone; coordinates only with a measurement behind them.
Visual PRs carry same-frame phone stills before merge; taste picks are Dom's on labelled options.
