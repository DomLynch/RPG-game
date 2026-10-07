# Brief: combat lessons from the legendary games (Dom, 2026-10-06 ~23:59)

Owner: Lead allocates; Combat & Specials leads, with Web (HUD), World/Audio (telegraph art and sound) and Characters (poses). Strategy judges receipts. Dom picks on his phone.

Dom's words: "get it done now to extract max learnings, there must be 5 things across the legendary 5 games we can borrow/steal/re-use/integrate with our combat."

Games: World of Warcraft, EverQuest, Ultima Online, Morrowind, Skyrim, plus Gothic 2 and The Witcher 3 (Dom named both as "nice combat").

## Rules

1. **Clean room (ruling 8).** We borrow ideas, never code or art. The open rebuilds (OpenMW, OpenGothic, ModernUO, EQEmu) are GPL: analysts read them and write behaviour specs into `docs/specs/combat/`, the same way `docs/specs/origins/` was built. Skyrim, The Witcher and WoW have no open code, so they count as design references only.
2. **Our spine stays.** Damage, weapon rules, gear scoring and the Attack/RES caps (1.15 / 0.80) are not replaced. Before Origin, nothing changes fight numbers through gear.
3. **Look-test first** (`look-test` skill). Each item ships first as a `?flag` preview on `/preview/` for Dom's phone, at 375 wide on the fight camera. Only after his yes does it become a real PR. Each PR needs stills (`visual-pr-stills`).
4. **Readable on one thumb.** No action bars, no global cooldown, no mana bar, no targeting. Everything below fits the existing inputs (light/heavy, guard, roll, kick, one skill slot).
5. **Heavy jobs run on the VPS** (`vps-heavy-jobs`).

## The seven borrowings (ranked)

| # | Borrow | From | What it becomes in Frankendom | Touches numbers? | Owner |
|---|---|---|---|---|---|
| 1 | **Cast bar you can interrupt** | WoW, EverQuest | Every special and class special (Witch, Plague Doctor, Knight) gets a short, visible wind-up. A hit inside that window interrupts it, using the existing interrupted cue from clarity item 1 (#1481). | Window timing only. Sim-side, so Combat proves it with replay goldens. | Combat + Web |
| 2 | **Ground warnings (telegraphs)** | WoW raids | The rank 8–10 boss specials mark the floor (a cone, ring or line) for a beat before they land, to teach rolling without text. Colour follows #4. | No (renderer only, keyed to the sim's own special wind-up ticks, the same source `specialStage` reads; `Charging` is the heavy-attack charge, not specials) | World + Combat |
| 3 | **Spoken power words** | Ultima Online ("In Vas Mani") | Casters mutter words of power during the wind-up from #1: the Witch before witchfire, the Plague Doctor before miasma. Words are original (no scripture), 2–3 syllables, one set per class. An audio telegraph and class identity. Ships muted until Dom picks the voices, like the other sounds. | No | Audio |
| 4 | **One colour per spell school** | WoW, EverQuest | Fire orange, shadow violet, poison green, holy gold, frost pale blue. Every special's trail, telegraph and status tint uses its school's colour, so a busy fight reads on a phone. One palette file and no new particles. | No | World + Web |
| 5 | **Combo rhythm** | Gothic 2 | A light chain continues only if the next press lands in the swing's rhythm window. Mashing ends the chain early. This rewards timing over spam. Analyst first: a clean-room read of OpenGothic's fight code for how the window is defined (spec → `docs/specs/combat/gothic-combo-window.md`). | Yes: the chain window. A sim change with goldens and a look-test. | Combat |
| 6 | **Parry into strike (riposte)** | Kingdom Come / Mount & Blade lineage, Witcher 3 counters | A perfect guard opens a short window where your next light becomes a fast counter-strike. It builds on the existing perfect guard and the `Practice.opening` field (#1494/#1502). | Yes: the counter window. Same proof as #5. | Combat + Characters |
| 7 | **Status marks over the head** | EverQuest, Morrowind (spell effects), WoW debuffs | Bleed, poison, sunder and slow show as one small icon plus a body tint, never numbers. Miasma uses it first. | No | Web |

Parked for after Origin: **weapon procs** (EverQuest), meaning a small chance for a weapon to flash and add an effect. They change fight numbers through gear, so they wait for Origin and stay inside the caps. **Boss phases** (WoW/EverQuest): at 50% health a rank 8–10 boss changes stance, with a visible tell (armour breaks, eyes light). Combat can spec it now and build it after the specials stack.

Rejected: tab-target, global cooldown, action bars, mana, Skyrim-style floaty hits with no stagger, and Morrowind dice-roll misses (a swing that visibly connects must never "miss").

## Order (Dom 2026-10-07 00:2x: "all great, get them in our game". All seven are approved to BUILD, not just look-test)

1. **Now, in parallel (renderer and HUD, no sim change):** #2 boss telegraph (World, `world/boss-telegraph`), #4 spell-school palette (Web/World), #7 status marks (Web), #3 power words (Audio: words written now, voices muted until Dom picks them). Each is a real PR behind a flag, with stills, then on by default once the Auditor passes it.
2. **Sim items, each with a fresh implementer (clean-room split, Strategy ruling 10-07):** #1 interruptible wind-ups, then #6 parry-into-strike (on `Practice.opening`), then #5 combo rhythm (window: end of active to 60% through recovery). Each needs replay goldens, a RECORD_VERSION bump + fingerprint re-pin, and test:all on the VPS. They ship one at a time so a tuning problem is easy to isolate. They queue behind the clarity stack (#1481–#1484, #1502) on the same files.
3. **Dom's phone check** happens on each preview before it is on by default. He can say "again" on tuning, not on whether the item exists.

## Receipts per item

A 2-second clip or 3-frame strip at 375 wide on the fight camera, the `?perf=1` line, and for #1, #5 and #6 the replay golden diff. Strategy sends it to Dom; he says yes, no or again.
