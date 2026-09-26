# Brief: one signature effect per opponent (Dom, 2026-09-24 11:50)

Owner: Lead allocates lanes. Strategy judges receipts. Dom picks in game.

Dom's words: "do all 10, and the A's. If any A is really challenging to design or visualise, pick B or C, or refine B or C so the effect is noticeable." He rejected decoration (dust, sparks, smoke): each effect must be recognisable in a silent two-second clip, and he wants persistent fight damage to become part of the game's visual language (scratched armour, missing rivets, a hammer stamp, arena scars, a battered shield, by the end of a fight).

## Rules

1. **Cosmetic only, inside the sim freeze.** Every effect is renderer-side and keyed to an existing duel event (`Hit`, `Parried`, `Blocked`, `Dodged`, `Charging`, `Charged`, `AttackMissed`, `Staggered`, `PostureBroken`, `GuardBroken`, `Killed`). No new moves, no damage, no healing, no slow, no stagger the sim did not cause. A true ranged spell is a sim change and waits for the Monday window; it is not in this brief.
2. **The effect tells the truth.** A mark appears only where a real hit, block or parry happened; a floor scar only where a real swing ended low and missed. No fake strikes, no teleport, no larger-looking hit zone.
3. **One signature effect at a time.** It must not compete with hit feedback, blood or a finisher. When a finisher plays, the signature effect yields.
4. **Persistent marks are capped.** Decals per fighter and per floor have a hard count (Lead sets it, suggest 6 on a body, 4 on a shield, 8 on the floor); oldest fades first. Marks last the fight, never across fights.
5. **Phone first.** Each effect is judged at 375×812 at the fight camera distance. Frame receipt per effect on Dom's phone (`?perf=1`), no full-screen passes, no per-frame CPU particles beyond the existing weather budget.
6. **Preview selector, not thirty branches.** Add a "Signature" control beside the admin Arena select (Options tab, NEXT FIGHT block, admin-gated): Off / On for the next fight's opponent, plus A/B/C while alternatives exist. Dom compares on his phone and picks in game.
7. **Receipt per effect:** a two-second clip (or a three-frame strip) at phone width showing the event and the effect, plus the perf line. Strategy sends it to Dom; he says yes / no / again.

## The ten (A first; B/C only if A is impractical, and then refined until it is obvious)

| # | Opponent | A (build first) | Event hook | Fallback if A is impractical |
|---|---|---|---|---|
| 1 | Veteran | **Battle Scars.** A heavy that lands on HIM leaves a fresh gouge across his armour or guard: bright metal through the patina, stays the fight. | `Hit` on the Veteran, damage above the light-hit threshold | Blade Bite: on `Parried`, metal curls tear from the contact point with a scrape. |
| 2 | Pitborn | **Butcher's Wake.** His landed heavy drags a thick curved sheet of blood from the wound with the blade; it stretches, tears, and falls as heavy drops. Not a mist. | `Hit` by the Pitborn, heavy move | Black Veins: during `Charged`, dark veins and strain across the weapon arm and neck, no glow. |
| 3 | Goblin | **Hooked Wound.** His knife catches on the wound as it withdraws; a strand of blood stretches and snaps across his knuckles and blade. | `Hit` by the Goblin | Claw Scramble: on `Dodged`, the free hand rakes the floor and leaves crooked furrows (needs an animation variant). |
| 4 | Nightborn | **Blood Recall.** Droplets from a wound he opens hang for a beat, then reverse toward his blade and vanish into it. Feeding, visual only. | `Hit` by the Nightborn | The Other Shadow: on his heavy `Charging`, his ground shadow stretches taller and clawed, snaps back on release. |
| 5 | Executioner | **Reaping Scar.** When his heavy misses and the blade ends low, it carves a curved scrape through the sand exposing dark stone; fragments tumble; the scar stays. | `AttackMissed`, heavy, blade below knee height at the end of the arc | Red Curtain: a landed heavy throws one broad thin sheet of blood sideways that folds and drops. |
| 6 | Dwarf | **Hammer Stamp.** A clean heavy stamps the hammer's angular maker's mark into the struck armour or skin as a dark dent decal; the victim carries it for the fight. | `Hit` by the Dwarf, heavy move | Stonebreaker: a heavy that misses and strikes the floor leaves a crushed patch with short cracks and a few stone chips. |
| 7 | Knight | **Rivet Burst.** A substantial hit on HIM pops one or two cosmetic rivets; the plate shudders, fragments hit the ground, a dent stays. No stat change. | `Hit` on the Knight above the light-hit threshold | Tempered Scar: on `Blocked`, a bright scored line across the plate that cools to a black scratch. |
| 8 | Shieldmaiden | **Splintered Defiance.** A heavy she blocks chips splinters and trim from the shield rim, pale wood underneath; the shield looks more battered as the fight goes on. | `Blocked` by the Shieldmaiden, heavy | Frostbite Shield: a perfect block flashes branching frost across the shield that cracks away in chips. |
| 9 | Plague Doctor | **Rot Bloom.** A wound he opens grows a dark branching stain a hand's width around the impact and stops; corruption under the skin, no cloud, no damage over time. | `Hit` by the Plague Doctor | Black Ichor: his blade drags a viscous near-black thread from the wound that drops and leaves an oily floor stain. |
| 10 | Witch | **The Grasp, short range, no projectile.** During `Charged` her staff head crackles with real sparks (Dom: "sparks from the staff", the drone stays). When that charged blow LANDS, a dark clawed hand closes over the wound and crumbles to ash. Reads as a short-range spell; the hit is her real melee hit. | `Charged` (staff sparks) + `Hit` by the Witch while charged (the Grasp) | Witchfire Core on the same events: black shell, deep-red core, embers, shell breaks inward then bursts. |

Notes on 10: today's "spell" is the shared heavy-charge tell (orange→white glow + rising drone, every fighter). Dom keeps that tell for everyone (11:30). The Witch's signature sits on top of it, on her only. A projectile with real range is a new move and a sim change: post-freeze, Combat's lane, only if Dom asks for true range after seeing this.

## Order

Prototype the five that are least interchangeable first, one PR each, receipts to Strategy as they land: **Dwarf Hammer Stamp, Executioner Reaping Scar, Knight Rivet Burst, Witch Grasp, Nightborn Blood Recall.** Then Veteran, Pitborn, Goblin, Shieldmaiden, Plague Doctor. The preview selector ships with the first prototype.

## Not in scope

Reflection, healing, poison, slow, extra reach, any new move. Auras, outlines, clouds over the fight. Anything that needs a RECORD_VERSION bump before Monday.
