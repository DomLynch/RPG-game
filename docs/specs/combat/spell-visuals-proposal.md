# Spell visuals: from 2005 to 2026 (proposal, 2026-10-17, awaiting Strategy)

Dom (2026-10-17): the four spells and the heal work, but they look low-res, cheap and tacky; the target is 2026 quality in our gritty style, with EverQuest / RuneScape / WoW as the feel, not the technology.

## Why it looks cheap now (seen in real-browser captures)
- Particles are soft 64 px gradient blobs, flat translucent rings and tubes: no texture detail, no smoke or fire structure.
- Nothing in the world reacts: no light on the sand or the fighters, nothing left on the ground, no camera push on the hit.
- The cast has no build-up: the 2 s windup shows nothing until the landing.

## Proposal, cheapest first (each step is its own preview; Dom judges on his phone)
1. **Real particle textures.** Author our own flipbook sheets (smoke, dust, embers, sparks, wisps; 8x8 frames, 2048 px) in Blender on the VPS CPU queue; draw them as instanced soft billboards (one draw call per effect), normal blending for body, additive only for the hot core, graded to the gritty palette. Our own art: no licence question.
2. **Shader materials.** Noise-driven dissolve and erosion for smoke, fire and the heal pillar; scrolling noise for the wind columns; fresnel edges; ribbon trails for motion. Procedural, tiny cost.
3. **The world answers.** A short coloured point light over the cast (sand and fighters lit by the spell), ground decals that stay until the fight ends (scorch, cracks, a wet ring), a camera push or shake and a short hit-stop on the landing, heat distortion on fire.
4. **Anticipation and sound.** A glow that gathers at the caster during the windup, a clear release beat, one sound per spell (cast, charge, release).

## Order and budget
Heal and Ash Fall first (clearest before / after), then Wind Wall, then Nyx Nightfall. Phone budget: no more than one extra draw call per effect, a particle cap per effect, and the effect thins itself when frame time drifts; checked on a real phone and WebKit before it counts as done. Donor shapes: docs/specs/combat/spell-effects-donors.md (Claudecraft MIT, Duelyst CC0 values only; Veloren GPL shape only).

## Questions for Strategy (defaults in brackets)
1. Author flipbooks in Blender on the VPS CPU queue? [yes]
2. Frame budget on phones? [no more than 1.5 ms added at the cast peak on the test phone]
3. Sandbox-only first, or also touch the shared designed effects in `special-fx-*` that trunk uses? [sandbox copies only; Combat promotes]
4. Before / after stills in every preview note? [yes, as visual-pr-stills]
