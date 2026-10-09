// Zone 2's looks (slice 1): the same preset names the page asks for, with the Ash Reach's colder, duskier haze (Zone 1's values with the fog, sky and ground cooled). Read through loadZone only.
import type { Look } from '../../preview/look.ts';

const looks: Record<string, Look> = {
  "zone1": { "fog": "#5d5a60", "fogDensity": 0.012, "hemiSky": "#9fb2d4", "hemiGround": "#4a3426", "hemiIntensity": 1.25, "sunColor": "#ffb46a", "sunIntensity": 5.9799999999999995, "sunPos": [-16, 15, 20], "exposure": 1.3, "ground": [0.5, 0.47, 0.45], "stone": [1.35, 1.2, 1] },
  "frontier-haze": { "fog": "#b9aea4", "fogDensity": 0.012, "hemiSky": "#a3b3cc", "hemiGround": "#574a40", "hemiIntensity": 1.35, "sunColor": "#e8cfb4", "sunIntensity": 5.6, "sunPos": [-24, 12, -15], "exposure": 1.35, "ground": [1.05, 0.98, 0.88] },
  "cinder-haze": { "fog": "#b9aea4", "fogDensity": 0.0095, "hemiSky": "#a3b3cc", "hemiGround": "#443a33", "hemiIntensity": 1.35, "sunColor": "#e8cfb4", "sunIntensity": 5.6, "sunPos": [-24, 12, -15], "exposure": 1.35, "ground": [1.05, 0.98, 0.88] },
  "frontier-duel": { "fog": "#b9aea4", "fogDensity": 0.0095, "hemiSky": "#a3b3cc", "hemiGround": "#574a40", "hemiIntensity": 1.35, "sunColor": "#e8cfb4", "sunIntensity": 5.04, "sunPos": [-24, 12, -15], "exposure": 1.35, "ground": [1.2075, 1.127, 1.012] },
  "frontier-night": { "fog": "#141a2a", "fogDensity": 0.02, "hemiSky": "#2a3558", "hemiGround": "#14100e", "hemiIntensity": 0.45, "sunColor": "#6a7ab0", "sunIntensity": 0.6, "sunPos": [-24, 12, -15], "exposure": 1.1, "ground": [0.8, 0.8, 0.9] },
};
export default looks;
