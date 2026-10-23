// Set boolean flags in a GLB's scene `extras` (three's GLTFLoader puts them on the loaded scene's userData), leaving every other byte as it is.
//   node scripts/character/glb-scene-extras.mjs <in.glb> <out.glb> noLoot=true [flag=true ...]
import fs from 'node:fs';

const [input, output, ...pairs] = process.argv.slice(2);
if (!input || !output || !pairs.length) throw new Error('usage: glb-scene-extras.mjs <in.glb> <out.glb> flag=true ...');
const raw = fs.readFileSync(input), n = raw.readUInt32LE(12), j = JSON.parse(raw.subarray(20, 20 + n)), rest = raw.subarray(20 + n);
j.scenes[0].extras = { ...(j.scenes[0].extras ?? {}), ...Object.fromEntries(pairs.map((p) => { const [k, v] = p.split('='); return [k, v === 'true' ? true : v === 'false' ? false : v]; })) };
const js = Buffer.from(JSON.stringify(j)), jp = Buffer.concat([js, Buffer.alloc((4 - (js.length % 4)) % 4, 0x20)]);
const head = Buffer.from(raw.subarray(0, 12)); head.writeUInt32LE(12 + 8 + jp.length + rest.length, 8);
const jh = Buffer.alloc(8); jh.writeUInt32LE(jp.length, 0); jh.write('JSON', 4);
fs.writeFileSync(output, Buffer.concat([head, jh, jp, rest]));
console.log(output, fs.statSync(output).size, 'bytes, scene extras', JSON.stringify(j.scenes[0].extras));
