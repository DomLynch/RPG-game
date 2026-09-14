# Requests to the lead (runtime/spec changes this lane will not make)

1. **GAME_SPEC.md art direction is stale vs the Origins brief.** The repo text still says "grounded medieval fantasy… ESO /
   Black Desert Warrior references". The character brief (owner-locked) says ruined arena at the edge of worlds, bronze / iron /
   bone / leather / stone / ash / blood, Ryse / 300 / Gladiator / For Honor references. Please replace the section so the two
   cannot drift. Logged 2026-09-14.

2. **Presentation lane, later**: evaluate N8AO (screen-space AO) on/off at the lock camera once the fighter is final. Needs the
   `postprocessing` peer dependency and a phone frame-time check; its licence metadata (CC0 root vs ISC package) must be
   resolved before adoption. Character lane will not add runtime dependencies.
3. **Combat lane**: UAL2 (CC0) sword strikes are candidates for Attack/Return/Heavy/Riposte. They move the blade during
   contact, so each is a GAMEPLAY CHANGE with a re-bake; the character lane will prepare side-by-side captures and leave
   the decision to combat review.

4. **Owner downloads (CC0, free, from the creator's own pages — the character lane cannot fetch itch.io):**
   - `Universal Animation Library 2 [Standard].zip` (17 MB) → `artifacts/source/animations2.zip`
   - `Modular Character Outfits – Fantasy [Standard].zip` → `artifacts/source/outfits.zip`
   The lane records SHA-256s in src/assets/README.md and keeps archives untracked, as with UAL1/UBC.
5. **Runtime (lead): equipment slots.** The GLB now carries one skinned draw per (slot, material) with `extras.slot` ∈
   Helmet/Body/Arms/Gloves/Legs/Boots/Shield ('' = built-in). Showing/hiding a slot is `object.visible` by `userData.slot`;
   swapping a slot is loading another part GLB and binding it to the same skeleton. No runtime change made by this lane.
