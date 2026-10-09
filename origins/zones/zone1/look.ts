// Zone 1's looks, as data (zone-runtime step 1): the presets the Frontier and the Zone 1 page use, as literals (derived rows spelled out: cinder-haze = frontier-haze with a thinner haze and darker bounce,
// frontier-duel = cinder-haze with the ground lifted 15 % and the key 10 % softer, zone1 = the Pit's sky and exposure with a darker haze and the key from behind the walker). Read through loadZone only.
import type { Look } from '../../preview/look.ts';

const looks: Record<string, Look> = {
  "zone1": { "fog": "#6e5f52", "fogDensity": 0.012, "hemiSky": "#9fb2d4", "hemiGround": "#4a3426", "hemiIntensity": 1.25, "sunColor": "#ffb46a", "sunIntensity": 5.9799999999999995, "sunPos": [-16, 15, 20], "exposure": 1.3, "ground": [0.5, 0.47, 0.45], "stone": [1.35, 1.2, 1] },
  "frontier-haze": { "fog": "#d6bf9a", "fogDensity": 0.012, "hemiSky": "#b4c4da", "hemiGround": "#6a5238", "hemiIntensity": 1.35, "sunColor": "#ffd6a0", "sunIntensity": 5.6, "sunPos": [-24, 12, -15], "exposure": 1.35, "ground": [1.05, 0.98, 0.88] },
  "cinder-haze": { "fog": "#d6bf9a", "fogDensity": 0.0095, "hemiSky": "#b4c4da", "hemiGround": "#52402c", "hemiIntensity": 1.35, "sunColor": "#ffd6a0", "sunIntensity": 5.6, "sunPos": [-24, 12, -15], "exposure": 1.35, "ground": [1.05, 0.98, 0.88] },
  "frontier-duel": { "fog": "#d6bf9a", "fogDensity": 0.0095, "hemiSky": "#b4c4da", "hemiGround": "#6a5238", "hemiIntensity": 1.35, "sunColor": "#ffd6a0", "sunIntensity": 5.04, "sunPos": [-24, 12, -15], "exposure": 1.35, "ground": [1.2075, 1.127, 1.012] },
  "frontier-night": { "fog": "#141a2a", "fogDensity": 0.02, "hemiSky": "#2a3558", "hemiGround": "#14100e", "hemiIntensity": 0.45, "sunColor": "#6a7ab0", "sunIntensity": 0.6, "sunPos": [-24, 12, -15], "exposure": 1.1, "ground": [0.8, 0.8, 0.9] },
};
export default looks;
