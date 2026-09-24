# Frankendom — current scope (read this before any older scope line)

Owner decisions as of **2026-09-24 09:00**, kept current by Strategy. When an older document, brief, state entry or memory
disagrees with this file, this file wins and the older line is stale. Dated decisions below name what they replaced.

## Beta (the freeze)
- **GRAFTING IS BETA (Dom 2026-09-24 21:xx: "not season 1, beta, all of these except the ones we agreed not to implement").**
  Creatures come OFF hold. Full direction and build order in docs/briefs/grafting-direction.md: anatomy slots replace the six
  armour slots for grafted players, anatomy capacity + incompatibility, inherited monster moves with a small active set,
  mutated creatures; then provenance, bestiary, evolution as an identity layer, bosses steal you, rolled properties; then
  runtime creature assembly and player-created monsters. A PURE human path progresses on the existing kit + gear layer at
  parity. NOT in scope (aligned): graft loss in PvP + single-copy artifacts, evolution replacing the ladder, the world
  ecosystem. *Replaces "Creatures on hold" and "Frankenstein body parts from kills: parked, no date".*
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
  lane; longsword). **2026-09-23 16:0x, Dom: all four move into BETA** ("put them live now"): fastest playable path first (an OPPONENTS
  entry on the closest rig, the reference look, Helmet + Body carriers), one PR and one publish per character, order Shieldmaiden, Knight,
  Plague Doctor, Witch; the line below is superseded for these four. **As shipped (LIVE `5c0a32c`, 2026-09-23 17:32):** all four real
  bodies in ONE publish (roster-v0, bump 8), ladder rungs 7–10 (Plague Doctor, Knight, Witch, Shieldmaiden); the Helmet + Body carriers
  were PULLED for all four until post-beta (UV-seam splits on untextured Steel; basis Nightborn's weld on char/plague-doctor-loot),
  so each takeable piece is its WEAPON only; shieldmaiden.Gladius and plaguedoctor.Longsword join loot.glb next (Strategy 17:3x). Previously: all four were launch scope, not beta; bodies land one at a time in that cost order; masked characters wait on an
  owner-approved reference sheet before their silhouette test.
- **Ten weapons, 5 one-hand + 5 two-hand**: knife, cleaver, estoc, gladius, bearded axe | longsword (hero), warhammer, trident,
  scythe, maul; the Witch's bladed staff rides the trident family. Opponent grips 5/5.
- **Kit 10 × 10**: ten archetypes × ten tiers, six slots each from Legionary.
- **Every launch character wears six takeable pieces of its own plus its weapon** (owner, 2026-09-22 23:12): the reference maps
  onto the six slots as that character's pieces in the shared library, each a loot draw with tier materials. The Witch's robe and
  hood ARE loot (Helmet = hood, Body = robe + cloak); nothing on a launch body is rig dressing. A brief names all six before it
  merges. *Narrows the Pitborn-chest-is-not-loot precedent (#434) to the beta six.*
- **Character briefs specify outline, not build** (Lead, 2026-09-22, AGENTS.md via #499): a new archetype's reference and
  silhouette work is specified by the character of its outline (hard armoured edges, broken fur, falling cloth, a one-heavy-side
  asymmetry), never by how big the figure is. Measured twice on 2026-09-22 (off mattes, arms at the sides): the Shieldmaiden's three
  candidates sat 0.043 apart on shoulder-width over height, and the Knight's approved reference scores 0.367 against the Executioner's
  0.374 and the Veteran's 0.360, three human fighters inside 0.014; the owner picked on outline both times. Stance before breadth: a
  comparison is only valid between figures in the same stance. An approved reference is a direction, not a render.
- **Origin character layer** (`docs/progression-direction.md`): five stats STR / DEX / VIG / END / POISE at baseline 100 with +50
  points at Origin; armour classes light / medium / heavy give RES and cost DEX / END; POISE is a character stat, never on armour.
  Not built before launch.

## Added 2026-09-24 (Dom, morning, after the Codex/GPT/Kimi reviews) — in the game, after each lane's current beta item
- **Arena Draw** (Web): before the fight a vertical strip of opponent portraits drops on a chain behind an iron frame, slows and
  slams on the ladder's opponent, revealing name + weapon; silhouettes while it runs; ≤1.5 s, tap to skip; portrait thumbnails only;
  no reroll, no near-miss, no rival weighting. The fight opening stays the plain still (no 3D intro, 2026-09-2x stands). Two labelled
  stills to Dom first.
- **Two share buttons** (Web): "Share fight" = the playable replay link; "Export clip" = a real vertical video from the replay,
  10–15 s ending on the kill, combat audio, no touch controls, small Frankendom mark, phone share sheet with save-to-phone fallback,
  a reduced-gore toggle. The replay page carries Open Graph tags so a WhatsApp paste shows the kill frame + title inline.
- **Coach mode** (Combat policies + Web tactics board): pick a playstyle before the fight (aggressive / defensive / agile /
  trickster) plus at most one extra instruction, then watch; the fighter is driven through the same input path as a human, tactics
  change preferences only, no perfect reactions. **A coached fight is a full fight: rank and loot progress exactly as a played one;
  one ladder, no exhibition variant** (Dom 08:5x, "keep the game simple", overriding Strategy's loot-only line).
- **Skipped**: rematch from the bad moment (fights are short). **Ruled closed the same morning**: wound attrition is not the
  handicap (first-under-25 % HP wins 10–14 % under current and two gentler rules), no retune; the thrust is not a broken tool
  (75–85 % vs the four non-pressers, ~0 vs the four pressers who close inside its range), no reach buff.
- **Arenas 2 and 3** (World, #624): 3B Sun Court rejected; 2A Ember Pit held (floor + tint is not enough); four labelled options
  (Night Pit, Rain Yard, High Noon Blood Sand, Sunken Cistern) as phone stills + perf line, Dom picks.
- **Post-beta queue, in order** (Strategy 2026-09-24 00:05, unchanged): one earned victory headline on the kill screen; best-of-three
  on one promotion fight; Witch's cast turned back on her (one cast, one reflection); one signature technique on one weapon (trident
  hook-and-draw); PvP victory trophies + live disarm behind ghost PvP. Later ideas parked with no date: Frankenstein body parts from
  kills, one-life Pit run with a memorial wall, mercy at the kill (spare → rival or recruit), challenge links vs a friend's ghost.

## Rules that do not move
Skill decides, gear tilts (a naked Recruit beats every rung under its cap). No stat changes timing. Sim stays pure and deterministic;
nothing reads inventory inside a tick. One deployer. Lanes report to Lead; Lead sends Strategy milestones; Strategy sets the bar and
briefs, never technique. Briefs name requirements and pass conditions on Dom's phone; coordinates only with a measurement behind them.
