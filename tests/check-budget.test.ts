import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { gzipSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
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
  for (const dir of ['assets/textures', 'game', 'versus']) mkdirSync(join(dist, dir), { recursive: true });
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
    'versus/goblin.webp': blob(10, 600),                    // the versus card main.ts shows while the Goblin's rig downloads: part of that fight
    'versus/veteran.webp': blob(11, 500),
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
    assert.equal(m.opponentStill, g('versus/goblin.webp'), 'the worst pairing fetches its own versus still');
    assert.equal(m.fight, m.shell + m.audio + m.hero + m.props + m.sharedTextures + m.opponentGzip + m.opponentTextures + m.opponentStill);
    const veteran = m.fights.find((x: { opponent: string }) => x.opponent === 'veteran')!;
    assert.equal(veteran.gzip, m.shell + m.audio + m.hero + m.props + m.sharedTextures + g('assets/veteran-VVVVVVVV.glb') + g('versus/veteran.webp'), 'a pairing that shares every texture adds only its GLB and its still');
    assert.ok(m.total > m.fight, 'the whole of dist (privacy, /game, both formats, unused textures) is larger than any fight');
    assert.equal(m.total, Object.values(f.files).reduce((n, bytes) => n + gz(bytes), 0));
  } finally { f.cleanup(); }
});

test('the Pit chunk is its own line: out of the per-fight shell, inside the whole of dist', async () => {
  const f = fixture();
  try {
    const before = await measure(f.dist, f.src);
    assert.equal(before.pit, 0, 'no Pit chunk, no Pit bytes');
    const chunk = blob(12, 900);
    writeFileSync(join(f.dist, 'assets/pit-PPPPPPPP.js'), chunk);
    const m = await measure(f.dist, f.src);
    assert.equal(m.pit, gz(chunk));
    assert.equal(m.shell, before.shell, 'the Pit loads after a kill, never with a fight');
    assert.equal(m.fight, before.fight);
    assert.equal(m.total, before.total + gz(chunk));
  } finally { f.cleanup(); }
});

test('a GLB that is none of fighter, arena prop, loot or player-equip weapon, or a texture a GLB references but dist lacks, fails the gate', async () => {
  const f = fixture();
  try {
    writeFileSync(join(f.dist, 'assets/mystery-MMMMMMMM.glb'), glb([]));
    await assert.rejects(measure(f.dist, f.src), /none of fighter, arena prop, loot or player-equipped weapon.*mystery-MMMMMMMM\.glb/);
    rmSync(join(f.dist, 'assets/mystery-MMMMMMMM.glb'));
    rmSync(join(f.dist, 'assets/textures/c.jpg'));
    await assert.rejects(measure(f.dist, f.src), /goblin-GGGGGGGG\.glb references textures\/c\.jpg/);
  } finally { f.cleanup(); }
});

// A player-equip GLB (weapons lane, 2026-09-21): once Combat's import lands, its built stem must be recognised, not thrown as
// unknown — it is worn only when equipped, so it counts toward the whole-of-dist cap but never the mandatory per-fight download.
test('a player-equip GLB (src/assets/weapons/player) is recognised, not thrown as unknown, and excluded from the per-fight sum', async () => {
  const f = fixture();
  try {
    const before = await measure(f.dist, f.src);
    mkdirSync(join(f.src, 'assets/weapons/player'), { recursive: true });
    writeFileSync(join(f.src, 'assets/weapons/player/cleaver.glb'), '');
    const equip = glb([]);
    writeFileSync(join(f.dist, 'assets/cleaver-EQUIPPPP.glb'), equip);
    const after = await measure(f.dist, f.src);
    assert.deepEqual(after.fights, before.fights, 'no fighter/opponent pairing changed');
    assert.equal(after.fight, before.fight, 'the equip GLB never rides the mandatory per-fight download');
    assert.equal(after.total, before.total + gz(equip), 'it still counts toward the whole-of-dist storage cap');
  } finally { f.cleanup(); }
});

test('a hero preview rig under dist/herolook/ is in no fight, has its own storage line out of TOTAL, and the cap fails the gate', async () => {
  const f = fixture();
  try {
    const before = await measure(f.dist, f.src);
    const rig = glb([], 5000);
    mkdirSync(join(f.dist, 'herolook')); writeFileSync(join(f.dist, 'herolook/legionary.glb'), rig);
    const after = await measure(f.dist, f.src);
    assert.equal(after.fight, before.fight);
    assert.deepEqual(after.fights, before.fights);
    assert.equal(after.hero, before.hero);
    assert.equal(after.preview, gz(rig));
    assert.equal(after.total, before.total, 'TOTAL bounds what fights download; the ?hero= preview is its own line');
    assert.equal(after.totalRaw, before.totalRaw);
    const gate = () => { try { execFileSync(process.execPath, ['scripts/check-budget.mjs', f.dist, f.src], { stdio: 'pipe', timeout: 30_000 }); return 'PASS'; } catch (e) { return String((e as { stderr?: Buffer }).stderr); } };
    assert.equal(gate(), 'PASS');
    writeFileSync(join(f.dist, 'herolook/heavy.glb'), randomBytes(4_700_000));   // incompressible, so over the line's cap gzipped too
    assert.match(gate(), /the hero preview rigs \(herolook\/\) exceed 4\.65 MB gzip/, 'the preview line has a cap');
  } finally { f.cleanup(); }
});

// Look tiers (Strategy 2026-09-30 10:1x, Dom's AAA-quality ask): a full-tier file of a set with phone LODs never reaches a phone, so it has
// the 3.2 MB desktop cap; its -phone file, and the one file of a set without LODs (the Goblin's), keep the 2.6 MB LOOK_FILE.
test('rank look caps by tier: a full-tier file of a PHONE_LOOKS set passes at 2.8 MB gzip, a -phone file or a no-LOD set\'s file there fails', () => {
  const f = fixture();
  try {
    const gate = () => { try { execFileSync(process.execPath, ['scripts/check-budget.mjs', f.dist, f.src], { stdio: 'pipe', timeout: 30_000 }); return 'PASS'; } catch (e) { return String((e as { stderr?: Buffer }).stderr); } };
    mkdirSync(join(f.dist, 'looks'));
    const look = (n: number) => Buffer.concat([glb([]), randomBytes(n)]);   // a GLB header + an incompressible body: ~n bytes gzip
    const heavy = look(2_800_000);   // 2.8 MB gzip, between the two caps
    writeFileSync(join(f.dist, 'looks/plaguedoctor-L1.glb'), heavy);
    assert.equal(gate(), 'PASS', 'the desktop file of a set with phone LODs: under 3.2 MB');
    writeFileSync(join(f.dist, 'looks/plaguedoctor-L1-phone.glb'), heavy);
    assert.match(gate(), /rank look plaguedoctor-L1-phone\.glb exceeds 2\.6 MB gzip/, 'its phone file keeps the 2.6 MB cap');
    rmSync(join(f.dist, 'looks/plaguedoctor-L1-phone.glb'));
    writeFileSync(join(f.dist, 'looks/goblin-L2.glb'), heavy);
    assert.match(gate(), /rank look goblin-L2\.glb exceeds 2\.6 MB gzip/, 'a set without phone LODs: the phone fetches its file, so 2.6 MB');
    rmSync(join(f.dist, 'looks/goblin-L2.glb'));
    writeFileSync(join(f.dist, 'looks/plaguedoctor-L1.glb'), look(3_300_000));
    assert.match(gate(), /rank look plaguedoctor-L1\.glb exceeds 3\.2 MB gzip/, 'the desktop cap binds too');
    rmSync(join(f.dist, 'looks/plaguedoctor-L1.glb'));
    // The Dwarf's per-set desktop cap (DESKTOP_LOOK_SET, his L1 as delivered): 3.3 MB passes, over 5.2 MB fails; his phone file keeps 2.6 MB.
    writeFileSync(join(f.dist, 'looks/dwarf-L1.glb'), look(3_300_000));
    assert.equal(gate(), 'PASS', 'the Dwarf full file: his own 5.2 MB desktop cap');
    writeFileSync(join(f.dist, 'looks/dwarf-L1.glb'), look(5_300_000));
    assert.match(gate(), /rank look dwarf-L1\.glb exceeds 5\.2 MB gzip/, 'his desktop cap binds');
    rmSync(join(f.dist, 'looks/dwarf-L1.glb'));
    writeFileSync(join(f.dist, 'looks/dwarf-L1-phone.glb'), look(2_800_000));
    assert.match(gate(), /rank look dwarf-L1-phone\.glb exceeds 2\.6 MB gzip/, 'his phone file keeps LOOK_FILE');
  } finally { f.cleanup(); }
});

// Moving herolook/ out of TOTAL is honest only while no fight can fetch it: no GLB a fight loads may point into it, and the only runtime
// path to it is hero-preview.ts, which scene.ts calls with the page's own query (nothing without `?hero=`, tests/hero-preview.test.ts).
test('nothing a fight fetches references herolook/: a fighter GLB pointing into it fails the gate', async () => {
  const f = fixture();
  try {
    mkdirSync(join(f.dist, 'herolook')); writeFileSync(join(f.dist, 'herolook/skin.jpg'), blob(12, 400));
    writeFileSync(join(f.dist, 'assets/goblin-GGGGGGGG.glb'), glb(['textures/b.jpg', '../herolook/skin.jpg']));
    await assert.rejects(measure(f.dist, f.src), /goblin-GGGGGGGG\.glb references \.\.\/herolook\/skin\.jpg, under herolook\//);
  } finally { f.cleanup(); }
});

test('the only source that names the herolook/ path is hero-preview.ts', () => {
  const files = (readdirSync('src', { recursive: true }) as string[]).filter((p) => /\.(ts|js|mjs|json|html|css)$/.test(p));
  const naming = files.filter((p) => readFileSync(join('src', p), 'utf8').split('\n').some((line) => !line.trim().startsWith('//') && line.includes('herolook')));
  assert.deepEqual(naming, ['hero-preview.ts']);
});

test('legend faces (versus card B4): each fight counts its opponent\'s heaviest face, the set is out of the total, and the caps fail the gate', async () => {
  const f = fixture();
  try {
    const before = await measure(f.dist, f.src);
    const small = randomBytes(300), heavy = randomBytes(900), other = randomBytes(500);   // incompressible: blob() repeats every 251 bytes
    mkdirSync(join(f.dist, 'legends'));
    writeFileSync(join(f.dist, 'legends/goblin-3.webp'), small); writeFileSync(join(f.dist, 'legends/goblin-7.webp'), heavy); writeFileSync(join(f.dist, 'legends/veteran-1.webp'), other);
    const after = await measure(f.dist, f.src), fight = (m: typeof after, id: string) => m.fights.find((x: { opponent: string }) => x.opponent === id)!.gzip;
    assert.equal(fight(after, 'goblin'), fight(before, 'goblin') + gz(heavy), 'one face per fight, at the worst rung');
    assert.equal(fight(after, 'veteran'), fight(before, 'veteran') + gz(other));
    assert.equal(after.opponentFace, gz(heavy), 'the worst pairing reports its face');
    assert.equal(after.portraits, gz(small) + gz(heavy) + gz(other));
    assert.equal(after.total, before.total, 'faces have their own storage line, out of TOTAL');
    const gate = () => { try { execFileSync(process.execPath, ['scripts/check-budget.mjs', f.dist, f.src], { stdio: 'pipe', timeout: 30_000 }); return 'PASS'; } catch (e) { return String((e as { stderr?: Buffer }).stderr); } };
    assert.equal(gate(), 'PASS');
    writeFileSync(join(f.dist, 'legends/goblin-11.webp'), small);
    assert.match(gate(), /goblin-11\.webp is not legends\/<legend opponent>-<rung 1\.\.10>\.webp/, 'a face off the ten rungs fails');
    rmSync(join(f.dist, 'legends/goblin-11.webp'));
    writeFileSync(join(f.dist, 'legends/goblin-2.webp'), randomBytes(60_000));
    assert.match(gate(), /goblin-2\.webp is \d+ bytes gzip, over the 48000 per-face cap/, 'a face at 48 KB gzip or more fails');
  } finally { f.cleanup(); }
});

// A valid GLB carrying `size` incompressible bytes in its BIN chunk (the budget measures gzip; the JSON chunk names no images).
function heavyGlb(size: number): Buffer {
  let json = Buffer.from(JSON.stringify({ asset: { version: '2.0' } }));
  json = Buffer.concat([json, Buffer.alloc((4 - (json.length % 4)) % 4, 0x20)]);
  const bin = randomBytes(size + ((4 - (size % 4)) % 4));
  const header = Buffer.alloc(12), jsonHead = Buffer.alloc(8), binHead = Buffer.alloc(8);
  header.write('glTF', 0, 'latin1'); header.writeUInt32LE(2, 4); header.writeUInt32LE(12 + 8 + json.length + 8 + bin.length, 8);
  jsonHead.writeUInt32LE(json.length, 0); jsonHead.write('JSON', 4, 'latin1'); binHead.writeUInt32LE(bin.length, 0); binHead.write('BIN\0', 4, 'latin1');
  return Buffer.concat([header, jsonHead, json, binHead, bin]);
}

test('Pit assets (Lead 2026-09-30): dist/pit/ is its own line out of TOTAL, passes at 0 B, and every cap fails the gate; pit/desktop/ is the tier-split line', async () => {
  const f = fixture();
  try {
    const gate = () => { try { execFileSync(process.execPath, ['scripts/check-budget.mjs', f.dist, f.src], { stdio: 'pipe', timeout: 30_000 }); return 'PASS'; } catch (e) { return String((e as { stderr?: Buffer }).stderr); } };
    assert.equal(gate(), 'PASS'); assert.deepEqual((await measure(f.dist, f.src)).pitFiles, [], 'no Pit files today: the row passes at 0 B');
    for (const dir of ['pit/props', 'pit/stone', 'pit/desktop']) mkdirSync(join(f.dist, dir), { recursive: true });
    const put = (name: string, bytes: Buffer) => writeFileSync(join(f.dist, name), bytes), drop = (name: string) => rmSync(join(f.dist, name));
    const before = (await measure(f.dist, f.src)).total;
    put('pit/props/rack.glb', heavyGlb(100_000)); put('pit/stone/ashlar.jpg', randomBytes(100_000));
    const m = await measure(f.dist, f.src);
    assert.equal(gate(), 'PASS', 'under every cap');
    assert.equal(m.total, before, 'Pit files are out of TOTAL (their own line, like the rank looks)');
    assert.deepEqual(m.pitFiles.map(p => [p.name, p.glb, p.map, p.desktop]), [['pit/props/rack.glb', true, false, false], ['pit/stone/ashlar.jpg', false, true, false]]);
    put('pit/props/heavy.glb', heavyGlb(320_000)); assert.match(gate(), /Pit GLB pit\/props\/heavy\.glb exceeds 300 KB gzip/); drop('pit/props/heavy.glb');
    put('pit/stone/big.jpg', randomBytes(160_000)); assert.match(gate(), /Pit stone map pit\/stone\/big\.jpg exceeds 150 KB gzip/); drop('pit/stone/big.jpg');
    for (let i = 0; i < 5; i++) put(`pit/props/p${i}.glb`, heavyGlb(250_000));   // 5 x 250 KB + rack: the pack over 1.2 MB, every file under 300 KB
    assert.match(gate(), /the Pit prop pack \(pit\/\*\*\/\*\.glb\) exceeds 1\.2 MB gzip/);
    for (let i = 0; i < 5; i++) drop(`pit/props/p${i}.glb`);
    for (let i = 0; i < 9; i++) put(`pit/stone/m${i}.webp`, randomBytes(140_000));   // 9 x 140 KB + ashlar: the set over 1.2 MB, every map under 150 KB
    assert.match(gate(), /the Pit stone maps \(pit\/ images\) exceed 1\.2 MB gzip/);
    for (let i = 0; i < 9; i++) drop(`pit/stone/m${i}.webp`);
    for (let i = 0; i < 4; i++) put(`pit/props/q${i}.glb`, heavyGlb(250_000)); for (let i = 0; i < 7; i++) put(`pit/stone/n${i}.webp`, randomBytes(140_000));
    put('pit/notes.bin', randomBytes(500_000));   // pack 1.1 MB + maps 1.08 MB + 0.5 MB of something else: the phone path over 2.5 MB with both sets under their caps
    assert.match(gate(), /the Pit assets \(pit\/\) exceed 2\.5 MB gzip on the phone path/);
    drop('pit/notes.bin'); for (let i = 0; i < 4; i++) drop(`pit/props/q${i}.glb`); for (let i = 0; i < 7; i++) drop(`pit/stone/n${i}.webp`);
    put('pit/desktop/ashlar-1024.jpg', randomBytes(400_000)); assert.equal(gate(), 'PASS', 'a 400 KB map on the desktop line is over the phone map cap and fine there');
    put('pit/desktop/wall-1024.jpg', randomBytes(700_000)); assert.match(gate(), /Pit desktop stone map pit\/desktop\/wall-1024\.jpg exceeds 600 KB gzip/); drop('pit/desktop/wall-1024.jpg');
    put('pit/desktop/rack.glb', heavyGlb(1000)); assert.match(gate(), /pit\/desktop\/ carries the full-tier stone maps only/); drop('pit/desktop/rack.glb');
    put('pit/props/bad.glb', glb(['missing.jpg'])); assert.match(gate(), /bad\.glb references missing\.jpg, which is not in/); drop('pit/props/bad.glb');
    assert.equal(gate(), 'PASS');
  } finally { f.cleanup(); }
});
