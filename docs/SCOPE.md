# Frankendom — current scope (read this before any older scope line)

Owner decisions as of **2026-09-23 01:15**, kept current by Strategy. When an older document, brief, state entry or memory
disagrees with this file, this file wins and the older line is stale. Dated decisions below name what they replaced.

## Beta (the freeze)
- **Six opponents**, the live archetypes: the Centurion (was "the Veteran"; ids and assets stay `veteran`), Goblin, Pitborn,
  Nightborn, Executioner, Dwarf. *Replaces "beta = five opponents" (2026-09-20).* Creatures (Minotaur, Wraith, Werewolf, Skeleton)
  stay on hold, assets kept in the repo.
- **Finishers**: Plain + Split Crown + Decapitation + Run Through + Opened. No new finishers for beta. Real dripping blood ordered
  (Gore lane) for every fight.
- **Career**: the ten-title ladder in `src/career.ts` (Recruit → Origin, I–V sub-ranks, Origin singular at 205 wins). Rank grants
  identity, not power. Rank "Veteran" keeps its name.
- **Loot v2**: every opponent's armour and weapon is takeable at the kill screen (take one; tap is the take; Undo). Tier kit per
  Brief 14: Recruit rag & scrap → Legionary leather → Gladiator bone → Veteran copper → Champion bronze → Praetorian iron →
  Master steel → Primus blackened steel → Invictus emerald → Origin gold & ruby; from Legionary every opponent wears the full six.
  Beta = the mechanism on the six live archetypes.
- **Gear stats, the GEAR layer only** (Brief 19, decided 2026-09-22/23): Attack on the weapon (cap +15 at Origin), RES on armour
  (cap 20 at Origin, damage taken incl. chip), ramped one step per tier from Legionary, nothing at Recruit. Same Attack bonus for
  every weapon. No stat changes any timing. Loot awards become server-authoritative before stats touch a fight. Daily duel is fought
  in a fixed kit. *Replaces "loot is cosmetic only, no stats" (Brief 5) and "stats after Origin / season 2".*
- **Player weapons**: longsword, warhammer, trident, scythe offered now; knife, cleaver, estoc ship one by one as each clears the
  fairness battery (Combat fixes the rule, Weapons flips + runs the battery). No flip may un-offer a weapon Dom already uses.
- **Shield**: a guard profile (two sides covered, stops heavies, cheaper hold, posture drains faster while held), one-hand weapons
  only, stowed on the back with a two-hander; **no flat damage reduction, no attack penalty** (*replaces "−20 % incoming"*). The
  Centurion carries a gladius + scutum from Legionary (*replaces "the Veteran keeps the trident with a shield"*; the trident is
  two-hand). Behind knife → cleaver → estoc in Combat's queue.
- **Wall lash**: guards removed (perf); replacement is baked silhouettes + a whip streak, no skinned meshes.
- **Words**: "warden" is out of every player-facing string ("Opponent", the opponent's name, "Daily duel").

## Launch (after beta)
- **Ten archetypes**: the six above + Shieldmaiden (Brief 15, Pitborn lane; *replaces "the Nord"*), Witch (Brief 16, Multi Chars;
  witch-fire cast on the trident polearm family), Knight (Brief 17, Executioner lane; maul), Plague Doctor (Brief 18, Nightborn
  lane; longsword). All four are launch scope, not beta; bodies land one at a time in that cost order; masked characters wait on an
  owner-approved reference sheet before their silhouette test.
- **Ten weapons, 5 one-hand + 5 two-hand**: knife, cleaver, estoc, gladius, bearded axe | longsword (hero), warhammer, trident,
  scythe, maul; the Witch's bladed staff rides the trident family. Opponent grips 5/5.
- **Kit 10 × 10**: ten archetypes × ten tiers, six slots each from Legionary.
- **Every launch character wears six takeable pieces of its own plus its weapon** (owner, 2026-09-22 23:12): the reference maps
  onto the six slots as that character's pieces in the shared library, each a loot draw with tier materials. The Witch's robe and
  hood ARE loot (Helmet = hood, Body = robe + cloak); nothing on a launch body is rig dressing. A brief names all six before it
  merges. *Narrows the Pitborn-chest-is-not-loot precedent (#434) to the beta six.*
- **Origin character layer** (`docs/progression-direction.md`): five stats STR / DEX / VIG / END / POISE at baseline 100 with +50
  points at Origin; armour classes light / medium / heavy give RES and cost DEX / END; POISE is a character stat, never on armour.
  Not built before launch.

## Rules that do not move
Skill decides, gear tilts (a naked Recruit beats every rung under its cap). No stat changes timing. Sim stays pure and deterministic;
nothing reads inventory inside a tick. One deployer. Lanes report to Lead; Lead sends Strategy milestones; Strategy sets the bar and
briefs, never technique. Briefs name requirements and pass conditions on Dom's phone; coordinates only with a measurement behind them.
