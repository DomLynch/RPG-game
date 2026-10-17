// The biome presets as pure literal data (one typed const, nothing that runs), so a biome edit ships as a data-only PR. The meaning of a row, and the DEFAULT_BIOME, are in biomes.ts.
import type { Spec } from './biomes.ts';

const biomes: Record<string, Spec> = {
  'ash-wastes': { look: { weather: { preset: 'dust' }, ground: { material: 'ash' } }, sound: { ambience: 'wind', footsteps: 'ash' } },
  // Zone 4 (donor, mood only: OpenMW's Bitter Coast region, a green-grey swamp under low light; no values taken): a cold green fog close in, a low pale sun, dim sky and damp dark ground, the ground tinted green.
  'drowned-marsh': { look: { fog: { colour: '#3f5a4c', density: 0.03 }, sun: { colour: '#b9d6c4', intensity: 3.4, pos: [-18, 8, -20] }, ambient: { sky: '#7f9c94', ground: '#27382e', intensity: 1.05 }, exposure: 1.15, ground: { tint: [0.55, 0.64, 0.5] }, weather: { preset: 'dust' } }, sound: { ambience: 'wind', footsteps: 'dirt' } },
  // The goblin fortress (zone sandbox, Dom 2026-10-15): the whole mood in one row. look.sky names a dome palette (goblin-field-defs.json, which also names the fog and light look), look.props.kit a kit (props-defs.json),
  // look.dress how much of the base clutter stays, look.props.density how much of the game's rock/scrub kit stays, look.ground.material a ground recipe, sound.ambience an ambience row, and the creatures show no "!" or name tag. A zone says `biome: "goblin-fortress"` and nothing else.
  'goblin-fortress': { look: { sky: 'fortress', props: { kit: 'goblin-camp', density: 0.25, rim: true }, buildings: 'goblin', dress: 'fortress', ground: { material: 'fortress-ground' }, creatures: { alert: false, name: false, card: 'target', growl: true, ring: false, lock: 'soft' } }, camera: { landscapeZoom: 1.3, fightBack: 1.2, fightBackPortrait: 1.1, combat: {
    '1': { label: 'Combat stance (OpenMW): centred, a step back, gaze toward the foe', portrait: { back: 6.2, up: 3.3, side: 0, ahead: 3, lookY: 1.0, mid: 0.3, shiftY: 0.08 }, landscape: { back: 5.4, up: 2.9, side: 0, ahead: 3, lookY: 1.2, mid: 0.3, zoom: 0.85 } },
    '2': { label: 'Auto-fit (Z-target / fighting game): both fighters framed, picture lifted off the thumbs', portrait: { back: 4.6, up: 2.8, side: 0, ahead: 2, lookY: 1.1, mid: 0.5, perSep: 0.35, perSize: 0.45, sizeFrom: 1.8, shiftY: 0.14 }, landscape: { back: 3.8, up: 2.3, side: 0, ahead: 2, lookY: 1.1, mid: 0.5, perSep: 0.3, perSize: 0.4, sizeFrom: 1.8, zoom: 0.9 } },
    '3': { label: 'Player zoom (WoW / RuneScape / Claudecraft): action shoulder, pick Near to Wide in the menu', portrait: { back: 5.4, up: 3, side: 0.9, ahead: 3, lookY: 1.3, mid: 0.2, shiftY: 0.1, fov: 4 }, landscape: { back: 4.6, up: 2.6, side: 0.9, ahead: 3, lookY: 1.3, mid: 0.2, fov: 4, zoom: 0.9 }, zoom: { steps: [0.8, 1, 1.3, 1.6], labels: ['Near', 'Mid', 'Far', 'Wide'], start: 2 } },
  } }, boundary: { margin: 8, slow: 0.3, line: 'The mist is too thick to go further.' }, sound: { ambience: 'fortress-wind', footsteps: 'dirt' } },
};
export default biomes;
