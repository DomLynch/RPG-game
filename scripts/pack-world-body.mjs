// Pack a generated world body (public/world/<kind>.glb, scripts/character/world_body.py output) the way the build packs fighters: meshopt, int8 normals and
// uint8 skin weights; geometry, animation and the used texture pixels stay exact. The mob view's loader carries the meshopt decoder (origins/preview/mobs-view.ts),
// so the packed file loads unchanged. Zone 1's world bodies share a gzip budget (check-budget.mjs); the Cave Troll's 958 KB gzipped became 714 KB.
//   node scripts/pack-world-body.mjs <in.glb> [<out.glb>]   (default: pack in place)
import fs from 'node:fs';
import { gzipSync } from 'node:zlib';
import { optimizeGlb } from './optimize-glb.mjs';

const [input, output = input] = process.argv.slice(2);
if (!input) throw new Error('usage: node scripts/pack-world-body.mjs <in.glb> [<out.glb>]');
const raw = fs.readFileSync(input), packed = Buffer.from(await optimizeGlb(raw));
fs.writeFileSync(output, packed);
console.log(`${input}: ${raw.length} raw, ${gzipSync(raw).length} gzip -> ${output}: ${packed.length} raw, ${gzipSync(packed).length} gzip`);
