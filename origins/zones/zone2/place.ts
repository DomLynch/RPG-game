// Zone 2 (the Ash Reach) on the Region 1 map: one open zone off the east road, its entry gate and a cairn at the middle. Its creatures are spawns.ts; this is where it stands and how the road reaches it.
import type { Place } from '../place.ts';

const place: Place = {
  "zones": {
    "ash-reach": {"zoneSize":{"width":100,"depth":100},"layout":{"reach-gate":{"u":0,"v":0.5,"facing":90},"reach-cairn":{"u":0.4,"v":0.5,"facing":0},"reach-ruin":{"u":0.8,"v":0.75,"facing":0}},"connections":{"road":{"to":"east-road","kind":"road","here":"reach-gate","there":"reach-turn"}},"density":{"creatures":0.3},"ambience":{"preset":"frontier-haze"}}
  },
  "joins": [
    {"zone":"east-road","landmark":"reach-turn","at":{"u":1,"v":0.2,"facing":-90},"before":"crossroads","link":"reach","to":"ash-reach","here":"reach-turn","there":"reach-gate"}
  ],
  "waypoints": [
    "reach-turn",
    "reach-gate",
    "reach-cairn",
    "reach-ruin"
  ],
  "spawns": [
    {"id":"reach-wolves","at":"reach-cairn","characters":["character:ember-wolf"]},
    {"id":"reach-pack-a","at":"reach-ruin","characters":["character:ember-wolf"]},
    {"id":"reach-pack-b","at":"reach-ruin","characters":["character:ember-wolf"]},
    {"id":"reach-scavengers","at":"reach-ruin","characters":["character:cinder-scavenger"]}
  ]
};
export default place;
