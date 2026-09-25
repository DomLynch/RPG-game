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
5. **Share**: "Share fight" = playable replay link; "Export clip" = real vertical video, 10–15 s ending on the kill, combat audio,
   phone share sheet; Open Graph tags on the replay page. Not started.
6. **Five arenas** on rotation: the three live plus two more, same runtime-texture recipe, mobile-light, each one visibly its own
   place. World lane; phone stills to Dom before merge.
7. **Combat feel**: block feedback you can see and hear (success and failure), a heavy wind-up that looks dangerous (charge pose B),
   kick punish (spam has a comeback; sim change on its own digest). Polish, not new systems.
8. **Special move = the second take** (Dom 2026-09-25): kill an opponent, the kill screen offers their armour piece OR their special
   move, one or the other, same panel as the armour take. One move equipped per duel, the 4th fight button (SKILL, placement A, Web's
   built button on web/skill-button), 15 s cooldown, ≥ heavy damage, blockable and guardable, readable tell, existing attack timings
   untouched. Ten opponents = ten moves; each is a sim change plus a fairness run; ship one opponent at a time, Witch first
   (docs/briefs/skill-witch-arm.md, numbers prop until Combat's battery), behind items 1–7. After Origin the take becomes one of
   three with the body part. Dom accepts the launch date moving for this.
9. **Loot awards server-authoritative** (Backend): the server checks a claimed take against the fight record before it writes the
   row; the phone stops being believed. In beta because cheats are cheap and the fix is small.

## Beta facts that stand (unchanged)
- **Ten opponents**: Centurion (ids stay `veteran`), Goblin, Pitborn, Nightborn, Executioner, Dwarf, Shieldmaiden, Knight,
  Plague Doctor, Witch. Ladder rungs 7–10 are the four newest.
- **Finishers**: Plain + Split Crown + Decapitation + Run Through + Opened. No new finishers. Real dripping blood every fight.
- **Career**: the ten-title ladder in `src/career.ts` (Recruit → Origin, I–V, Origin singular at 205 wins). Rank grants identity, not
  power. Coach mode counts fully: one ladder, no exhibition variant.
- **Loot v2**: every opponent's armour and weapon takeable at the kill screen (take one; tap is the take; Undo). Tier kit per Brief 14
  (rag & scrap → leather → bone → copper → bronze → iron → steel → blackened steel → emerald → gold & ruby); from Legionary every
  opponent wears the full six. Cosmetic only in beta.
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
