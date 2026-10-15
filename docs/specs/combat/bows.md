# Bows: the outer-band weapon (spec, sandbox only)

Status: **spec, Combat, 2026-10-15. Design only, no code, no row.** Sandbox until Dom picks it: projectiles with travel time are a sim-visible rule, so shipping one is an RV bump (and a WSV bump for the open world) and goes through the Auditor and Lead like any other. Donor facts below are from memory of the games unless marked "read"; the donor repos live on the VPS (`/mnt/frankendom-donors`) and were not opened for this note. Verify against them before any row is written (`reuse-first`).

## What the game has today (read on trunk, 2026-10-15)
- Every fight is a **two-fighter duel**. In the world a player and a creature fight on the Pit's duel once the nearest foe is inside `engage` **4 m** (they stay engaged out to `engageOut` **6 m**). Creatures notice at **9 m** and keep sight to **14 m** (`world-rules-defs.json`, `threat-defs.json`).
- Weapons are rows (`longsword, trident, cleaver, estoc, knife, gladius, scythe, maul, reaper, warhammer`; `bite` is natural). Every weapon is melee: a move has reach, windup, active, recovery. There is **no projectile and no ammunition** anywhere in the engine or the item contract.
- So the band between 4 m and 14 m is dead space: a creature walks it, the player cannot touch it. That band is the bow's.

## The idea in one paragraph
A bow is a **committed, lock-on, outer-band** weapon. You cannot aim freely; you lock the foe the game already picks (the nearest, as the threat list does) and **draw**. The draw is a windup you can see and cannot cancel for free. The shot **flies for a visible time**, so a roll or a step beside it can dodge it. It hits for a share of health like a heavy blow, then you are back in the duel the moment the foe closes to 4 m. It is a way to start a fight, not to win one at range: the foe is a melee creature that closes 9 m in a few seconds, so you get one or two shots, not a kite.

## Donor games first
- **Gothic** (read as a player's rule, not code): lock-on target, draw time as a held press, a clear commit; the bow is weak in melee. Taken: lock-on with no free aim; draw as the commitment.
- **OpenMW / Morrowind** (read: `docs/specs/combat/openmw-weapon-timing.md` says ranged damage uses the same charge strength as melee, interpolated low to high): damage scales with how long the draw is held, sampled on release. Taken: a **charge fraction** that scales the shot, with a floor so a tap still fires.
- **RuneScape 2004Scape** (from memory): ranged weapons are a style with ammunition, a range in tiles and an attack speed; arrows are consumed and sometimes recoverable. Taken: **arrows as ammo loot**, a range band, a per-weapon speed.
- **Ultima Online / ModernUO** (from memory): archery has a minimum range and a delay between shots; move-and-shoot is punished by a short recovery. Taken: a **minimum range** (below it the bow is useless) and a recovery after the shot.
- **EQEmu / AzerothCore** (from memory): ranged hit uses the same hit/miss roll with a range check. Taken: nothing new; the duel's hit resolution is reused.

## Design (all numbers are future rows; none exist yet)
1. **Band.** Min range `engage` (4 m, reuse the world rule, do not type a second number), max range a new row (working: 12 m, inside `sight` 14 m so a creature the player can shoot has already seen him). Outside the band the bow cannot be drawn.
2. **Lock-on, no free aim.** The target is the nearest foe in the band and in the heading cone, chosen by the same rule that picks a melee foe (`world.ts`). No cursor, no stick aim: phones have none. If no foe is in the band the draw does not start.
3. **Draw (windup).** A held press. Working: 36 ticks to full draw, 18 to a minimum draw. Releasing before the minimum cancels with a stamina price; releasing between minimum and full fires a weaker shot (`charge` fraction, same idea as `RULES.charge`). A hit on the archer during the draw **interrupts** it (interruptible-windups spec).
4. **Shot.** A projectile with **travel time**: ticks = distance / arrow speed (working 14 m/s, a row). It lands only if the target is still inside the hit cone/width when it arrives; a roll or sidestep dodges it, a guard blocks it as a normal blow (chip through a block). One projectile in flight per archer.
5. **Damage.** A heavy-blow share of max health scaled by draw fraction (working 0.7x to 1.2x a heavy), no extra posture damage. **Crossbow variant:** heavier commit (draw 72 ticks, no partial draw, a fixed 1.4x) and a long recovery; it exists to give the family a second identity (slow and certain) the bow does not have.
6. **Ammunition.** Arrows are an **item stack consumed one per shot**. No arrows, no draw. Arrows are loot (drop from creatures, buyable, craftable later) and a quality tier changes damage by a row multiplier; a missed arrow is lost in v1 (recovery is a later row).
7. **Recovery.** After release, a recovery longer than a light melee swing so shoot-and-roll is not free. In the open world the archer who is engaged in melee uses the melee kit; the bow is not a melee weapon (switching is a weapon swap, one press).
8. **Creature archers** are not in v1.

## What it touches (why it is not free)
- **Sim:** a projectile is new state in the duel/world (position, owner, target, arrival tick). It must be integer/IEEE-basic-maths and deterministic like the rest of the sim, and the replay must reproduce it: **an RV bump** (`duel.ts` snapshot, `record.ts` pin) and **a WSV bump** for the world loop and its digest.
- **World:** the engage rule is pair-based; a shot at 10 m has no duel yet. v1 option A: the shot resolves in the world layer as a single hit event on arrival against a creature not yet engaged, then the normal engage rule takes over. Option B: engage at max bow range. A is smaller and keeps the pair model; pick it unless the Auditor says otherwise.
- **Data layer (Dom, 2026-10-13):** every number above is a row (`bow-rules.json` + manifest), none a literal in code; the as-data gate must pass (`node scripts/as-data/check.ts --gate`).
- **Items:** arrows and the bow need item kinds in `src/core/contracts/items.ts` (Characters/Backend), loot tables, and the build's slot rules. Not Combat's alone.
- **Presentation:** a draw pose and a release clip for a bow family (Weapons/Characters lane: the 19-clip family cost applies, `docs/briefs/witch.md` has the measurement), an arrow mesh and trail (World), a sound (Audio). Combat's part is the rules and the ranged hit event.

## Sandbox plan (spec first, nothing ships)
1. This note, reviewed by Lead/Strategy. No code until Dom picks the weapon.
2. If picked: a sandbox harness (not wired into the live record) that steps a player and one melee creature through the band with a projectile, to answer: how many shots does the archer get at 9 m, 12 m, 14 m against each creature's speed (`SPEEDS`), and does shoot-and-roll beat melee? Target: 1-2 shots before engage, never a free kill.
3. Then the rows PR (RV + WSV), Auditor, release.

## Open questions
1. **Free kill risk.** If a creature walks slower than the arrow's reload, the bow kites it. Mitigation is the min range plus recovery plus creature speed; the sandbox measures it. Does Dom want a kite-able bow at all?
2. **PvP.** Does a shot hit a player in the open world, with the existing attackable-flag rules? Default: yes, same rules as a melee hit, no new flag.
3. **One lock or many.** v1 is one projectile at the locked foe; volley/multi-shot is a skill row later.
4. **Mobile controls.** Draw as a held press on the attack button with a release; the two-special-slot controls must not collide. Web & UI to confirm.
5. **Where ammo lives** (a bag stack versus a quiver slot) is Characters/Backend's call.
