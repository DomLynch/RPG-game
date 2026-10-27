# Spell effects: how modern games build them, and our recipe (study, 2026-10-17)

Dom's brief: the first donor study (spell-effects-donors.md) covered 15-20 year old and indie games. This one asks how recent AAA and mobile games make effects look expensive, and how to get that in three.js. Three.js is not the limit (WebGL2 does everything below); the limit is what we author and how we time it. Old iOS games (Infinity Blade, 2010) looked near-console because the art and the timing carried the look, not the hardware.

## Sources and honesty
- Web search found little game-specific detail for Diablo 4, Genshin, Hades or Elden Ring (no public breakdowns of their shaders). What follows is the standard industry recipe from VFX artists' write-ups (realtimevfx.com mobile thread, 80.lv "VFX Staples", GDC "Art Directing VFX for Stylized Games" 2017, GDC Vault "Shader Sauce") plus general real-time VFX practice. Nothing here is verified against a frame capture of a specific game. If we want that, capture with RenderDoc on our own device and study the passes; rewrite, never import their assets or shader code.
- Rule kept: techniques and timing are free to learn and rewrite; textures, meshes and shader source of closed games are not copied. Our flipbooks and ramps are authored by us (Blender on the VPS, $0).

## What makes an effect read as AAA (the recipe)
1. **Layers, not one object.** Every cast is 5-8 stacked layers with different lifetimes: anticipation (windup glow and ground sign), core (the hero shape), secondary (smoke, shards, sparks), accent (glints, flash), environment (light wash on the ground and fighters, dust kicked up), residue (fading scorch, ember trails). Our five looks have core + smoke + glint + one light; they lack anticipation, residue and environment response.
2. **Timing is the polish.** Fast attack (1-3 frames to the flash), a held peak, a long eased tail. Impact frame: one frame of white-hot overbright. Anticipation 0.3-1.0 s before release (our windup is 2 s: free time for a build-up). Camera shake and a 2-4 frame hit-stop on landing sell weight more than any texture.
3. **Colour in ramps, not flat tints.** Sample a 1D gradient texture by age or by noise value: white-hot core to saturated mid to dark desaturated edge. Overbright (>1.0 HDR) core that blooms. This alone separates "2005 additive blob" from "2026".
4. **Erosion with an edge.** Dissolve by a noise threshold that rises with age, with a bright emissive rim where value is near the threshold (the heal's rim-lit column does this). Add a second, scrolling noise for flow.
5. **Distortion and heat.** Screen-space refraction (offset the scene by a scrolling normal/noise inside the effect's mask) for shock waves, heat shimmer over fire, space bending for Nyx. One cheap full-screen pass reused by all spells.
6. **Soft edges.** Soft particles (fade near geometry by depth) and view-facing flipbook smoke with frame blending (a 16-frame sheet blended looks like 36). Without soft particles quads show hard lines where they cut the floor.
7. **Bloom plus tone mapping.** The glow around bright cores is mostly a bloom pass on HDR values; a filmic tone map keeps overbright from clipping to flat white.
8. **Meshes as VFX.** Cheap authored shells (cone, ring, spiral, ribbon) with scrolling noise, additive or alpha-test, give shapes particles cannot; mobile artists lean on these.
9. **Light and shadow cues.** A short coloured point light that washes ground and fighters, plus a ground decal (scorch, frost ring, cracks) that outlasts the effect. Players read power from the lit environment.
10. **Sound and sync.** A per-spell sound with a low thud on impact; the flash lands on the sound's first transient.

## Mobile-specific rules (from artists' write-ups, to design to, not to refuse the look)
- Overdraw is the real cost: many large transparent quads. Prefer fewer, smaller, well-masked layers; shrink quads to their visible bounds.
- Reuse textures heavily (one atlas for noise, ramps, glints, smoke); memory is the usual mobile limit.
- Flipbooks sparingly, for the hero smoke; panning textures plus distortion carry most motion.
- Avoid expensive per-pixel refraction on many layers; do ONE distortion pass for the whole scene when any spell is active.
- Build big first, profile, then cut where the cost shows (matches Strategy's gates: <= 1.5 ms at the peak, 0 new shader programs after the zone is ready).

## Gap list against spell-vfx.ts (137 lines: 128 px procedural noise, one light, smoke puffs, glints)
- NOT built: anticipation glow during the 2 s windup; colour ramps (flat tint per effect); HDR bloom and filmic tone map; screen distortion; soft particles; ground decal residue; flipbook smoke; hit flash frame; camera shake and per-spell sound tie-in; scrolling second noise.
- Procedural 128 px noise is the visible "low-res" cause on a phone: noise should be authored at 256-512, tileable, packed into one RGBA atlas (R noise, G swirl, B voronoi, A radial mask).

## Recommended look per spell (pass 2)
| Spell | Core | Anticipation | Impact | Residue |
|---|---|---|---|---|
| ugallu dust shock | expanding ring shock wave mesh with distortion, dust column of flipbook smoke | ground dust gathers inward at the caster | white flash frame, ring leaves the foe, short camera shake | cracked-ground decal, settling dust |
| brokkr Ash Fall | rising ember field (instanced, HDR orange to dark ramp) under a dark eroding plume | heat shimmer over the caster's hands | orange flash + ember burst | scorch decal and embers that linger 2 s |
| kamaitachi Wind Wall | two or three scrolling-noise spiral meshes (additive, pale cyan ramp) with streaks | leaves and dust swirl toward the caster | blade-line flash across the foe | trailing leaves/dust |
| banshee Nyx Nightfall | vignette darkening + purple curtain with distortion (space bending) | colour grade drains toward violet | brief inverted/overbright pulse | dark motes drifting up |
| gula heal | rim-lit light column (done) + upgraded sparkle ramp, soft ring | soft golden glow gathers at the chest | gentle bloom swell, no flash | warm light fades slowly |

## Build order (smallest first; each is a row-flagged change, tick-driven, presentation only)
1. Shared pieces once: HDR bloom + filmic tone map for the arena (check what the game's renderer already does before adding a pass), authored 256-512 noise/ramp atlas, one scene distortion pass.
2. Anticipation layer per spell using the 2 s windup (cheapest big visible win).
3. Colour ramps replace flat tints (a 1D ramp row per spell: data, not code).
4. Soft particles and a ground decal residue.
5. Flipbook smoke authored in Blender for the hero puff only.
6. Hit flash frame + camera shake (rows; Combat owns hit-stop feel).

## Gates (unchanged, Strategy)
Before/after stills and a 2 s clip per spell, <= 1.5 ms at the cast peak on Dom's phone, 0 new shader programs after the zone is ready (warm() compiles at scene creation). Not yet measured on a phone.

## Open
- A frame-capture study of one reference game (RenderDoc on our own device or a published capture) would replace "standard recipe" with evidence; costs time, no money.
- Dom's call: which spell to rebuild first as the showpiece (suggest Nyx or Ash Fall).
