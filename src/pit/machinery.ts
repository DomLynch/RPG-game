// The gate's machinery (GPT's gate-machinery.glb, World's intake #3): a drum that winds the chains as the bars rise and a counterweight that
// falls to the floor by the time the bars seat (the knock at gate.ts GATE_SEAT_S). Presentation only: pure numbers in, node poses out; room.ts
// applies them to the nodes by name. The numbers are the file's own rest poses (gate-base coordinates, metres): the drum's axle at y 2.89 and
// radius 0.276, the two side chains hanging from it at x ±0.68 (0.743 long, their foot at 2.014 where they meet the bars), the counterweight
// at y 1.78 (0.58 tall) with its chain above it.
import { GATE_RISE } from './gate.ts';

const DRUM_R = 0.276, CHAIN = 0.7428;
const SIDE_TOP = 2.385 + CHAIN / 2, SIDE_FOOT = 2.385 - CHAIN / 2;   // the side chains' fixed top (at the drum) and rest foot (at the bars)
const WEIGHT_TOP = 2.425 + CHAIN / 2;   // the counterweight's chain: top fixed at the drum
const WEIGHT_Y = 1.78, WEIGHT_HALF = 0.29, FALL = WEIGHT_Y - WEIGHT_HALF;   // it lands on the floor (y 0): the centre drops from 1.78 to 0.29

export type MachineryPose = {
  drum: number;   // rotation about X, radians: the front of the drum climbs with the bars
  side: { y: number; scaleY: number; visible: boolean };   // ChainLeft and ChainRight: shortened as the bars wind them up, gone once wound
  weight: number;   // Counterweight y
  weightChain: { y: number; scaleY: number };   // ChainWeight: stretched to keep the counterweight hanging from the drum
};

// `progress`: gate.ts gateLift, 0 at rest to 1 seated.
export function machineryPose(progress: number): MachineryPose {
  const p = Math.min(1, Math.max(0, progress)), rise = GATE_RISE * p;
  const sideLength = Math.max(0, SIDE_TOP - (SIDE_FOOT + rise));
  const foot = WEIGHT_TOP - CHAIN + (WEIGHT_HALF * 2 - (WEIGHT_TOP - CHAIN)) * p, weightLength = WEIGHT_TOP - foot;   // the chain's foot goes from its rest to the counterweight's top when it lands
  return {
    drum: rise ? -rise / DRUM_R : 0,
    side: { y: SIDE_TOP - sideLength / 2, scaleY: Math.max(sideLength, 1e-3) / CHAIN, visible: sideLength > 0.01 },
    weight: WEIGHT_Y - FALL * p,
    weightChain: { y: WEIGHT_TOP - weightLength / 2, scaleY: weightLength / CHAIN },
  };
}

// Where the two floor pieces stand, from the room's half-width and half-depth (the room is 10 x 7.5 and the placements follow its walls):
// the whetstone wheel in the corner by the rack's far end under the first sconce, the water bucket on the floor at the foot of the gate wall,
// left of the arch. [x, z, rotation.y]; floor-centred origins.
export const extraSpots = (hw: number, hd: number): Record<'whetstone-wheel' | 'water-bucket', [number, number, number]> => ({
  'whetstone-wheel': [-hw + 0.55, -hd + 0.75, Math.PI / 2],
  'water-bucket': [-1.9, -hd + 0.5, 0.4],
});
