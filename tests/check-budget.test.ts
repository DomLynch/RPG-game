import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { gzipSync } from 'node:zlib';
import { glbImageUris, measure } from '../scripts/check-budget.mjs';

// A minimal GLB: a JSON chunk naming external images, no binary chunk. Only the image URIs matter to the budget.
function glb(uris: string[], padding = 0): Buffer {
  let json = Buffer.from(JSON.stringify({ asset: { version: '2.0' }, images: uris.map(uri => ({ uri })), extras: 'x'.repeat(padding) }));
  json = Buffer.concat([json, Buffer.alloc((4 - (json.length % 4)) % 4, 0x20)]);
  const header = Buffer.alloc(20);
  header.write('glTF', 0, 'latin1'); header.writeUInt32LE(2, 4); header.writeUInt32LE(20 + json.length, 8); header.writeUInt32LE(json.length, 12); header.write('JSON', 16, 'latin1');
  return Buffer.concat([header, json]);
}
const gz = (bytes: Buffer | string) => gzipSync(bytes).length;
// Distinct, incompressible-ish payloads so every file has its own gzip size.
const blob = (seed: number, size: number) => Buffer.from(Array.from({ length: size }, (_, i) => (i * 7919 + seed * 104729) % 251));

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'frankendom-budget-')), dist = join(root, 'dist'), src = join(root, 'src');
  for (const dir of ['assets/textures', 'game']) mkdirSync(join(dist, dir), { recursive: true });
  for (const dir of ['assets/arena/props']) mkdirSync(join(src, dir), { recursive: true });
  for (const name of ['warrior', 'goblin', 'veteran', 'loot']) writeFileSync(join(src, 'assets', `${name}.glb`), '');
  writeFileSync(join(src, 'assets/arena/props/shield.glb'), '');
  const files: Record<string, Buffer | string> = {
    'index.html': '<!doctype html><script type="module" src="/assets/index-AAAAAAAA.js"></script>',
    'privacy.html': 'privacy '.repeat(100),                 // in dist, never fetched for a fight
    'game/index.html': 'marketing '.repeat(100),            // the /game page: same
    'assets/index-AAAAAAAA.js': blob(1, 3000),
    'assets/index-BBBBBBBB.css': blob(2, 800),
    'assets/sprite-CCCCCCCC.ogg': blob(3, 1000),
    'assets/sprite-DDDDDDDD.m4a': blob(4, 1500),            // the larger format is what the budget assumes
    'assets/arena-EEEEEEEE.ogg': blob(5, 700),
    'assets/arena-FFFFFFFF.m4a': blob(6, 400),              // here Opus is the larger one
    'assets/textures/a.jpg': blob(7, 2000),
    'assets/textures/b.jpg': blob(8, 900),
    'assets/textures/c.jpg': blob(9, 5000),
    'assets/warrior-HHHHHHHH.glb': glb(['textures/a.jpg', 'textures/b.jpg']),
    'assets/goblin-GGGGGGGG.glb': glb(['textures/b.jpg', 'textures/c.jpg']),     // smaller GLB, but c.jpg makes it the worst pairing
    'assets/veteran-VVVVVVVV.glb': glb(['textures/a.jpg'], 400),                 // larger GLB, shares everything with the hero
    'assets/shield-SSSSSSSS.glb': glb([]),
    'assets/loot-LLLLLLLL.glb': glb(['textures/a.jpg', 'textures/c.jpg'], 300),     // Brief 5 loot: its own line, never a pairing
  };
  for (const [name, bytes] of Object.entries(files)) writeFileSync(join(dist, name), bytes);
  return { root, dist, src, files, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

test('glbImageUris reads the external image list from the JSON chunk and rejects non-GLBs', () => {
  assert.deepEqual(glbImageUris(glb(['textures/a.jpg', 'textures/b.jpg'])), ['textures/a.jpg', 'textures/b.jpg']);
  assert.deepEqual(glbImageUris(glb([])), []);
  assert.throws(() => glbImageUris(Buffer.from('not a glb at all, long enough')), /not a GLB/);
});

test('the per-fight figure is the shell, one audio format per sound, hero, every prop, the worst opponent and only the textures they reference', async () => {
  const f = fixture();
  try {
    const m = await measure(f.dist, f.src);
    const g = (name: string) => gz(f.files[name]);
    assert.equal(m.shell, g('index.html') + g('assets/index-AAAAAAAA.js') + g('assets/index-BBBBBBBB.css'), 'shell is index.html + its script + its stylesheet only');
    assert.equal(m.audio, g('assets/sprite-DDDDDDDD.m4a') + g('assets/arena-EEEEEEEE.ogg'), 'one format per sound, the larger of each pair');
    assert.equal(m.hero, g('assets/warrior-HHHHHHHH.glb'));
    assert.equal(m.props, g('assets/shield-SSSSSSSS.glb'), 'props are counted in full, never as opponent candidates');
    assert.equal(m.sharedTextures, g('assets/textures/a.jpg') + g('assets/textures/b.jpg'), 'hero + prop textures, each once');
    assert.equal(m.opponent, 'goblin-GGGGGGGG.glb', 'worst pairing is by GLB plus its own textures, not GLB size alone');
    assert.ok(!m.fights.some((x: { opponent: string }) => x.opponent === 'loot'), 'loot.glb is not a fight');
    assert.equal(m.loot, g('assets/loot-LLLLLLLL.glb') + g('assets/textures/c.jpg'), 'loot is its GLB plus the textures the base does not already fetch');
    assert.equal(m.opponentTextures, g('assets/textures/c.jpg'), 'only the textures the hero and props do not already fetch');
    assert.equal(m.fight, m.shell + m.audio + m.hero + m.props + m.sharedTextures + m.opponentGzip + m.opponentTextures);
    const veteran = m.fights.find((x: { opponent: string }) => x.opponent === 'veteran')!;
    assert.equal(veteran.gzip, m.shell + m.audio + m.hero + m.props + m.sharedTextures + g('assets/veteran-VVVVVVVV.glb'), 'a pairing that shares every texture adds only its GLB');
    assert.ok(m.total > m.fight, 'the whole of dist (privacy, /game, both formats, unused textures) is larger than any fight');
    assert.equal(m.total, Object.values(f.files).reduce((n, bytes) => n + gz(bytes), 0));
  } finally { f.cleanup(); }
});

test('a GLB that is neither a fighter nor a prop, or a texture a GLB references but dist lacks, fails the gate', async () => {
  const f = fixture();
  try {
    writeFileSync(join(f.dist, 'assets/mystery-MMMMMMMM.glb'), glb([]));
    await assert.rejects(measure(f.dist, f.src), /neither a fighter nor an arena prop.*mystery-MMMMMMMM\.glb/);
    rmSync(join(f.dist, 'assets/mystery-MMMMMMMM.glb'));
    rmSync(join(f.dist, 'assets/textures/c.jpg'));
    await assert.rejects(measure(f.dist, f.src), /goblin-GGGGGGGG\.glb references textures\/c\.jpg/);
  } finally { f.cleanup(); }
});
