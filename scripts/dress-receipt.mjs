// The Frontier's dressing receipt: every prop the plan, the dressing, the kit and the cinder layer place, as one JSON line per prop, so two checkouts diff with `diff` (prop count, moved, added, dropped).
// Usage: node scripts/dress-receipt.mjs > out.txt   (run it on trunk and on the head, then `diff trunk.txt head.txt`)
/* global console */
import { frontierBuild, frontierPlan } from '../origins/preview/frontier-plan.ts';
import { frontierDress } from '../origins/preview/frontier-dress.ts';

const F = frontierPlan(), B = frontierBuild(F), D = frontierDress(F, B);
const out = [];
for (const [layer, list] of [['build.pieces', B.pieces], ['build.solids', B.solids], ['dress.ground', D.ground], ['dress.pieces', D.pieces], ['dress.solids', D.solids]]) for (const [i, p] of list.entries()) out.push(`${layer}\t${i}\t${JSON.stringify(p)}`);
console.log(out.join('\n'));
console.error(JSON.stringify({ build: [B.pieces.length, B.solids.length], dress: [D.ground.length, D.pieces.length, D.solids.length] }));
