# Spell effects: what the donor games do (study, 2026-10-17)

Donor: World of Claudecraft (MIT), Open Duelyst (CC0 per its README), Veloren (GPL, shape only), roBrowserLegacy / ModernUO / EQEmu / AzerothCore (GPL, feel only). Rule (Strategy): code from MIT, Apache, BSD or CC0 only; GPL and the emulators are described in our own words and rewritten. Read-only survey by an agent on the donor library (`/mnt/frankendom-donors`), 2026-10-17; the agent read plists and source, never looked at a sprite; OpenGothic, openmw, runelite, OpenDiablo2, shattered-pixel-dungeon and flare-game were not read.

## Heal: three builds, and what we took
| Build | Donor (licence) | Shape |
|---|---|---|
| A. Rising green dots + ring sheet | Open Duelyst `app/data/fx.js` `UnitHealedFX`, `app/resources/particles/dotsquaregreen.plist` (CC0) | three layers on the healed unit: 20 green square dots, 2 s life, size 40, gravity up (y 50), colour about #00FF13 fading out, additive; a 15-frame ring sheet at 0.08 s a frame; a ground smoke sprite |
| B. Pillar + ring + ember burst | World of Claudecraft `src/render/ability_vfx/sequencer.ts` `case 'heal'`, rows in `ability_vfx_specs.ts` (MIT) | `pillarAt(radius, height 4-7, colour, 0.5-0.9 s)` then a 16-particle burst; a heal is one row: colour `#ffd970` (holy light) or `#f2f6ff` (heal), 'holy' palette, power, linger |
| C. Spiral motes round the body | Veloren `assets/voxygen/shaders/particle-vert.glsl` ENERGY_HEALING (GPL) | motes orbit on a helix and climb, radius random and weighted to the centre, size shrinks as they rise, green-cyan, 1 s life cap |
| (others) | UO Greater Heal `FixedParticles(0x376A, 9, 32, 5030, Waist)`; Ragnarok item heal = a tall translucent cylinder on the entity | (sprite, frames, duration, layer); a cylinder |

**Built (sandbox, `src/fight/missile-fx.ts`):** our own code, tick-driven, taking B's shape (a pillar and a ring) plus A's and C's rising motes: on the healed fighter a ground ring that swells and fades, a pale pillar that rises and thins, and 16 motes spiralling up and fading, muted greens, normal blending on ring and pillar so it reads on sand. All numbers are in the file's constants for now (presentation only; not a sim value).

## One donor per spell kind (to imitate later; nothing built yet)
- Fire / ash: Claudecraft `smoke` + `embers` particle kinds (`painter.ts` about lines 460-480, MIT); Duelyst `ash.plist` for a floating layer (30 particles, 8 s, tan). Duelyst's are additive: switch to normal blending to stay gritty.
- Wind / tornado: Duelyst `fx_tornadoswirl` (35 frames at 150x110, 0.08 s) and Claudecraft Hurricane `c:'#b6c0a8'` (desaturated grey-green, 6 s linger): the desaturated colour is what keeps it gritty.
- Shadow / dark: Claudecraft smoke + wisp trail, `shadow_word_pain` `#8a6ab8`; Duelyst shadow nova (22 frames) as the opening ring, minus its magenta point light.
- Earth / ground cracks: Claudecraft `earthquake` (`rg:2` ring, `db:1` debris, 6 s linger); no donor has a true crack decal (Duelyst has a `Decal` layer type).
- Lightning / storm: Claudecraft `lightning_bolt` (jagged coiling ribbon, speed 30, 1.7 s windup, 3.2 s linger).

## Data shapes worth copying (rows)
1. Claudecraft one-line rows (colour, palette, power, sparks, ring, debris, smoke, light, linger, windup, archetype; archetypes bolt, burst, strike, nova, beam, dot, heal, buff, shout, summon, cc, dash). Closest to our data-layer rule.
2. Duelyst event key -> ordered layer list `{sprite | particles | light | decal, offset, colour, rotation, duration}`.
3. 2004Scape spotanim: `_casting`, `_travel`, `_impact` rows per spell (three phases; shape only).

## Art and licence cautions
Duelyst FX sheets (`app/resources/fx/`, 423 files, about 211 sheets) are CC0 per the repo, but individual files were not verified and several are authored for additive glow. Claudecraft's code is MIT but its media is not covered. Warcraft-Arena-Unity art is Blizzard's. Ragnarok effect textures are unlicensed. Do not ship any donor art without checking the file's own origin.
