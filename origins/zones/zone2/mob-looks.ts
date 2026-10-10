// Zone 2's creature looks, as data: the Ember Wolf, the wolf body (public/world/wolf.glb, already in Zone 1's download: no new mesh) dressed ember red-brown instead of ash grey.
// scale = WOLF_RENDER_SCALE (2) x 1.1, a pack leader; a literal because zone data files hold one literal and `import type` only (the rule is src/beast-scale.ts WOLF_RENDER_SCALE).
import type { Zone } from '../loader.ts';

const mobLooks: NonNullable<Zone['mobLooks']> = {
  "looks": {
    "character:ember-wolf": {"opponent":"wolf","tint":9062962,"scale":2.2,"dressing":{"soot":0.15,"burnt":0.6}}
  },
  "spread": {
    "character:ember-wolf": {"tints":[8011824,10115642,7293498],"scale":0.08,"soot":0.1,"burnt":0.15}
  }
};
export default mobLooks;
