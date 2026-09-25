// The frozen creature donor (src/assets/source/backups/veteran-v1.glb: the Veteran's and Witch's clip/weight donor, and the Skeleton's) is
// appended to, never rewritten. scripts/character/append-donor-clips.mjs added Trident_Carry + Trident_Draw for Pole Draw B (#783); every
// clip the donor already carried must stay byte-identical, since creature_pack.py ships the donor's clips unchanged into every rebuild.
// The digest covers each pre-existing clip's name, channel targets (by node name) and key bytes, pinned from trunk's donor before the append.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const APPENDED = new Set(['Trident_Carry', 'Trident_Draw']);
const PRE_EXISTING = '3fec2b7818a70b07d7f0ebd4d1a6a817e0e1acc26d6e5b288fcc3f7a32264bf2'; // trunk's donor before the append (last changed in 39afe9e9)

function clipDigest(file: string): { digest: string; names: string[] } {
  const b = readFileSync(file), n = b.readUInt32LE(12), j = JSON.parse(b.subarray(20, 20 + n).toString()), bin = 28 + n;
  const size: Record<string, number> = { SCALAR: 4, VEC3: 12, VEC4: 16 };
  const bytes = (i: number) => { const a = j.accessors[i], v = j.bufferViews[a.bufferView], s = bin + (v.byteOffset || 0) + (a.byteOffset || 0); return b.subarray(s, s + a.count * size[a.type]!); };
  const hash = createHash('sha256'), names: string[] = [];
  for (const clip of j.animations) {
    if (APPENDED.has(clip.name)) continue;
    names.push(clip.name); hash.update(clip.name);
    for (const c of clip.channels) { const s = clip.samplers[c.sampler]; hash.update(`${j.nodes[c.target.node].name}.${c.target.path}.${s.interpolation || 'LINEAR'}`); hash.update(bytes(s.input)); hash.update(bytes(s.output)); }
  }
  return { digest: hash.digest('hex'), names };
}

test('the frozen Veteran donor keeps every pre-existing clip byte-identical; only Trident_Carry/Trident_Draw were appended', () => {
  const { digest, names } = clipDigest('src/assets/source/backups/veteran-v1.glb');
  assert.equal(names.length, 38);
  assert.equal(digest, PRE_EXISTING);
});
