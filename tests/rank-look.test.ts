import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { Mesh, MeshStandardMaterial, SkinnedMesh, Texture } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { buildWarriors, readRankLook } from '../src/characters.ts';
import { resetPhoneTierForTests } from '../src/quality.ts';
import { openWaist } from '../src/opened.ts';
import { initialPractice, type Practice } from '../src/combat.ts';
import { LOADOUT_FROM, OPPONENTS } from '../src/moves.ts';
import { optimizeGlb } from '../scripts/optimize-glb.mjs';
import { bakeSafeFinisher, idleBeat, lookBakes, PHONE_LOOKS, rankLookFlag, rankLookFor, rankLookMoves, rankLookStream, runThroughForced, SHIPPING_LOOKS, lookMapCapMiB } from '../src/rank-look.ts';
import { existsSync } from 'node:fs';
import { TIERS, levelOf } from '../src/grades.ts';
import { supportsFinishers } from '../src/roster.ts';

// Parse a shipped GLB in Node (geometry, rig, material names; images dropped), as tests/loot-wear.test.ts does.
async function parse(file: string) {
  const bytes = readFileSync(new URL(`../src/assets/${file}`, import.meta.url)), size = bytes.readUInt32LE(12), json = JSON.parse(bytes.subarray(20, 20 + size).toString());
  json.images = []; json.textures = []; json.materials = json.materials.map((m: { name: string }) => ({ name: m.name }));
  json.buffers[0].uri = 'data:application/octet-stream;base64,' + bytes.subarray(28 + size).toString('base64');
  globalThis.ProgressEvent ??= class { constructor(_type: string, fields: object) { Object.assign(this, fields); } } as unknown as typeof ProgressEvent;
  return new GLTFLoader().parseAsync(JSON.stringify(json), '');
}
const skinned = (root: { traverse(cb: (o: unknown) => void): void }) => { const out: SkinnedMesh[] = []; root.traverse(o => { if (o instanceof SkinnedMesh) out.push(o); }); return out; };
// A practice at a given pair of phases (the rest of the fight state is today's opening).
const at = (phases: [string, string], extra: { finish?: boolean; parrying?: boolean; stun?: number; tick?: number } = {}): Practice => {
  const p = initialPractice(731, OPPONENTS.goblin);
  return { ...p, finish: extra.finish ? ({ victim: 1 } as Practice['finish']) : null, duel: { ...p.duel, tick: extra.tick ?? 1, fighters: p.duel.fighters.map((f, i) => ({ ...f, phase: phases[i], parrying: i === 1 && !!extra.parrying, stun: i === 1 ? extra.stun ?? 0 : 0 })) as Practice['duel']['fighters'] } };
};

test('rank look flag: a same-origin file directly under /looks/, nothing else, silently', () => {
  assert.equal(rankLookFlag('?ranklook=/looks/goblin@mid.glb'), '/looks/goblin@mid.glb');
  assert.equal(rankLookFlag('?opponent=goblin&ranklook=/looks/goblin-l3.glb'), '/looks/goblin-l3.glb');
  for (const search of ['', '?ranklook=', '?look=souls', '?ranklook=https://evil.example/looks/x.glb', '?ranklook=//evil.example/looks/x.glb', '?ranklook=/looks/../assets/x.glb',
    '?ranklook=/looks/sub/x.glb', '?ranklook=/herolook/x.glb', '?ranklook=/looks/x.gltf', '?ranklook=%2Flooks%2F..%2Fx.glb', '?ranklook=/looks/x.glb?y=1'])
    assert.equal(rankLookFlag(search), undefined, search);
});

test('idle beat: only when both fighters are quiet and no finish plays (never mid-exchange, never in a finisher or kill-cam)', () => {
  for (const pair of [['ready', 'ready'], ['sheathed', 'ready'], ['draw', 'sheathed'], ['guard', 'ready'], ['guard', 'guard']] as [string, string][]) assert.ok(idleBeat(at(pair)), pair.join('/'));
  for (const phase of ['attack', 'roll', 'backstep', 'hurt', 'dead']) {
    assert.ok(!idleBeat(at(['ready', phase])), `opponent ${phase}`);
    assert.ok(!idleBeat(at([phase, 'ready'])), `player ${phase}`);
  }
  assert.ok(!idleBeat(at(['ready', 'ready'], { finish: true })), 'a finish (and its kill-cam) is never a beat');
  assert.ok(!idleBeat(at(['ready', 'guard'], { parrying: true })), 'a guard with its parry window open is an exchange');
  assert.ok(idleBeat(at(['ready', 'ready'], { stun: 5 })), 'a stale stun count (left after a stagger) is not a stagger: the hurt phase is');
});

test('rank look stream: fetch waits for first playable, lands, waits for the idle beat, swaps once; a failed load stays base', async () => {
  let loads = 0; const applied: string[] = [];
  const stream = rankLookStream(async () => { loads++; return 'look'; }, (look) => applied.push(look));
  stream.tick(at(['ready', 'ready'], { tick: 0 }));
  assert.equal(stream.state(), 'waiting'); assert.equal(loads, 0, 'nothing is fetched before the fight clock moves (first playable)');
  stream.tick(at(['attack', 'ready']));
  assert.equal(stream.state(), 'loading'); assert.equal(loads, 1);
  await Promise.resolve(); await Promise.resolve();
  assert.equal(stream.state(), 'ready');
  stream.tick(at(['attack', 'guard'])); stream.tick(at(['ready', 'hurt'])); stream.tick(at(['ready', 'ready'], { finish: true }));
  assert.deepEqual(applied, [], 'a landed look waits through an exchange and a finish');
  stream.tick(at(['ready', 'ready']));
  assert.deepEqual(applied, ['look']); assert.equal(stream.state(), 'on');
  stream.tick(at(['ready', 'ready'])); assert.deepEqual(applied, ['look'], 'one swap per fight');
  assert.ok(stream.stamps().on >= stream.stamps().loaded);

  const errors: unknown[] = [];
  const broken = rankLookStream(async () => { throw new Error('offline'); }, () => assert.fail('never applied'), (e) => errors.push(e));
  broken.tick(at(['ready', 'ready'])); await Promise.resolve(); await Promise.resolve();
  broken.tick(at(['ready', 'ready']));
  assert.equal(broken.state(), 'failed'); assert.equal(errors.length, 1);
});

test('rank look prefetch (Strategy via Lead 2026-09-30, L1 = a new player\'s first fight): it starts before the fight clock, lands behind the menu, and swaps on the fight\'s first idle beat, never before', async () => {
  let loads = 0; const applied: string[] = [];
  const stream = rankLookStream(async () => { loads++; return 'look'; }, (look) => applied.push(look));
  stream.prefetch(); stream.prefetch();
  assert.equal(stream.state(), 'loading'); assert.equal(loads, 1, 'one fetch, however often the rung is set');
  await Promise.resolve(); await Promise.resolve();
  stream.tick(at(['ready', 'ready'], { tick: 0 }));
  assert.equal(stream.state(), 'ready'); assert.deepEqual(applied, [], 'landed behind the menu: no swap before the fight clock moves');
  assert.deepEqual(stream.stamps().waited, {}, 'menu frames are not counted as off-beat waits');
  stream.tick(at(['attack', 'ready'])); assert.deepEqual(applied, [], 'still never mid-exchange');
  stream.tick(at(['ready', 'ready']));
  assert.deepEqual(applied, ['look']); assert.equal(loads, 1, 'the first tick does not fetch again');
  const none = rankLookStream<string>(() => undefined, () => assert.fail('never applied'));
  none.prefetch(); assert.equal(none.state(), 'none');

  // Lead on #1154: prefetched at rung A, the rung moves to B before the fight (scene.ts setTier restarts it): A's look never goes on.
  let rung = 'A'; const worn: string[] = [];
  const moved = rankLookStream(async () => `look-${rung}`, (l) => worn.push(l));
  moved.prefetch(); await Promise.resolve(); await Promise.resolve();
  assert.equal(moved.state(), 'ready');
  rung = 'B'; moved.restart(); moved.prefetch();
  moved.tick(at(['ready', 'ready'])); await Promise.resolve(); await Promise.resolve(); moved.tick(at(['ready', 'ready']));
  assert.deepEqual(worn, ['look-B'], 'a landed look for the old rung is dropped');
  rung = 'A'; let late!: (l: string) => void; const pending: string[] = [];
  const racing = rankLookStream(() => (rung === 'A' ? new Promise<string>((done) => { late = done; }) : Promise.resolve(`look-${rung}`)), (l) => pending.push(l));
  racing.prefetch(); rung = 'C'; racing.restart(); racing.prefetch(); await Promise.resolve();
  late('look-A'); await Promise.resolve(); racing.tick(at(['ready', 'ready']));
  assert.deepEqual(pending, ['look-C'], 'an old rung\'s load that lands after the move is ignored');
});

test('shipping looks (Lead, 2026-09-28): every opponent with a set at rank levels 2–10 streams <opponent>-L<n>, level 1 and every other opponent none; each file is in public/looks', async () => {
  assert.deepEqual(Object.keys(SHIPPING_LOOKS), ['goblin', 'plaguedoctor', 'knight', 'nightborn', 'dwarf', 'witch', 'pitborn', 'veteran', 'shieldmaiden', 'executioner'], 'only the Goblin, the Plague Doctor, the Knight, the Nightborn, the Dwarf, the Witch, the Pitborn, the Centurion, the Shieldmaiden and the Executioner ship looks');
  // The file-presence guard (Pitborn prep, 2026-09-29): each set lists exactly the ranks whose file is committed, and a PHONE_LOOKS set its
  // -phone file too. A file drop without the re-pin, or a re-pin without the files, fails here.
  const committed = (opponent: string, level: number, suffix = '') => existsSync(new URL(`../public/looks/${opponent}-L${level}${suffix}.glb`, import.meta.url));
  for (const [opponent, levels] of Object.entries(SHIPPING_LOOKS)) for (let level = 1; level <= 10; level++) {
    assert.equal(committed(opponent, level), levels.includes(level), `${opponent} L${level}: listed if and only if committed`);
    if (PHONE_LOOKS.has(opponent)) assert.equal(committed(opponent, level, '-phone'), levels.includes(level), `${opponent} L${level} phone: listed if and only if committed`);
  }
  assert.deepEqual(SHIPPING_LOOKS.pitborn, [2, 3, 4, 5, 6, 7, 8, 9, 10], 'the Pitborn: L2–L10, full + phone (Dom GO, 2026-09-29)');
  assert.equal(rankLookFor('pitborn', 1), undefined, 'Recruit: his base rig');
  assert.equal(rankLookFor('pitborn', 8, true), '/looks/pitborn-L8-phone.glb', 'the phone streams his -phone file');
  assert.deepEqual(SHIPPING_LOOKS.veteran, [2, 3, 4, 5, 7, 8, 9, 10], 'the Centurion: L2–L5 + L7–L10, full + phone');
  assert.equal(rankLookFor('veteran', 6), undefined, 'his L6 (a static model, no rig) keeps his base rig');
  assert.equal(rankLookFor('veteran', 7, true), '/looks/veteran-L7-phone.glb', 'the phone streams his -phone file');
  assert.deepEqual(SHIPPING_LOOKS.shieldmaiden.slice(1), [2, 3, 4, 5, 6, 7, 8, 9, 10], 'the Shieldmaiden: L2–L10, full + phone (Dom GO, 2026-09-29; her L1 below)');
  assert.equal(rankLookFor('shieldmaiden', 1), '/looks/shieldmaiden-L1.glb', 'Recruit: her L1 look (2026-09-30)');
  assert.equal(rankLookFor('shieldmaiden', 6, true), '/looks/shieldmaiden-L6-phone.glb', 'the phone streams her -phone file');
  assert.equal(rankLookFor('executioner', 9, true), '/looks/executioner-L9-phone.glb', 'the phone streams his -phone file');
  // The Plague Doctor's L1 "Recruit" (Dom 2026-09-30 via Lead): the one set that starts at rank 1; every other opponent meets rank 1 in his rig.
  assert.deepEqual(SHIPPING_LOOKS.plaguedoctor, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 'the Plague Doctor: L1–L10, full + phone');
  assert.equal(rankLookFor('plaguedoctor', levelOf('Recruit')), '/looks/plaguedoctor-L1.glb', 'his Recruit look');
  assert.deepEqual(SHIPPING_LOOKS.executioner, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 'the Executioner: L1–L10, full + phone (Strategy 2026-09-30)');
  assert.equal(rankLookFor('executioner', levelOf('Recruit'), true), '/looks/executioner-L1-phone.glb', 'his Recruit LOD on the phone');
  assert.deepEqual(SHIPPING_LOOKS.dwarf, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 'the Dwarf: L1–L10, full + phone (Dom 2026-09-30 via Lead)');
  assert.equal(rankLookFor('dwarf', levelOf('Recruit')), '/looks/dwarf-L1.glb', 'his Recruit look');
  assert.equal(rankLookFor('dwarf', levelOf('Recruit'), true), '/looks/dwarf-L1-phone.glb', 'his Recruit LOD on the phone');
  assert.deepEqual(SHIPPING_LOOKS.nightborn, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 'the Nightborn: L1–L10, full + phone (Strategy 2026-09-30)');
  assert.equal(rankLookFor('nightborn', levelOf('Recruit'), true), '/looks/nightborn-L1-phone.glb', 'his Recruit LOD on the phone');
  assert.deepEqual(SHIPPING_LOOKS.witch, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 'the Witch: L1–L10, full + phone (Lead 2026-09-30)');
  assert.equal(rankLookFor('witch', levelOf('Recruit')), '/looks/witch-L1.glb', 'her Recruit look');
  assert.equal(rankLookFor('witch', levelOf('Recruit'), true), '/looks/witch-L1-phone.glb', 'her Recruit LOD on the phone');
  assert.deepEqual(SHIPPING_LOOKS.shieldmaiden, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 'the Shieldmaiden: L1–L10, full + phone (Lead 2026-09-30)');
  assert.equal(rankLookFor('shieldmaiden', levelOf('Recruit')), '/looks/shieldmaiden-L1.glb', 'her Recruit look');
  assert.equal(rankLookFor('shieldmaiden', levelOf('Recruit'), true), '/looks/shieldmaiden-L1-phone.glb', 'her Recruit LOD on the phone');
  assert.deepEqual(Object.keys(SHIPPING_LOOKS).filter(o => SHIPPING_LOOKS[o]!.includes(1)), ['plaguedoctor', 'nightborn', 'dwarf', 'witch', 'shieldmaiden', 'executioner'], 'no other opponent has an L1 yet');
  for (const opponent of Object.keys(SHIPPING_LOOKS).filter(o => SHIPPING_LOOKS[o]!.length)) {
    assert.equal(rankLookFor(opponent, levelOf('Recruit')), SHIPPING_LOOKS[opponent]!.includes(1) ? `/looks/${opponent}-L1.glb` : undefined, `${opponent} rank 1: his L1, or his rig as shipped`);
    assert.equal(rankLookFor(opponent, levelOf('Legionary')), `/looks/${opponent}-L2.glb`);
    assert.equal(rankLookFor(opponent, levelOf('Origin')), SHIPPING_LOOKS[opponent]!.includes(10) ? `/looks/${opponent}-L10.glb` : undefined);
  }
  for (const tier of TIERS) {
    for (const opponent of Object.keys(SHIPPING_LOOKS)) {
      const url = rankLookFor(opponent, levelOf(tier));
      if (url) { assert.ok(rankLookFlag(`?ranklook=${url}`), `${tier}: a URL the flag would accept`); assert.ok(existsSync(new URL(`../public${url}`, import.meta.url)), `${tier}: ${url} is committed`); }
    }
  }
  // Each committed file in the shape Lead ruled (packed4): extras.keep, every draw skinned, none of the kept draws, and external images only
  // as the build's shared textures (their presence in dist is scripts/check-budget.mjs's job, after the build).
  for (const [opponent, levels] of Object.entries(SHIPPING_LOOKS)) for (const level of levels) {
    const bytes = readFileSync(new URL(`../public/looks/${opponent}-L${level}.glb`, import.meta.url)), json = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString());
    const keep: string[] | undefined = json.scenes[0].extras?.keep, drawn = json.nodes.filter((n: { mesh?: number }) => n.mesh !== undefined);
    // [] is a whole fitted figure: every draw of his goes off (a scanned rig's fused CreatureBody, the Plague Doctor).
    assert.ok(Array.isArray(keep), `${opponent} L${level}: extras.keep`);
    assert.ok(drawn.length && drawn.every((n: { skin?: number }) => n.skin !== undefined), `${opponent} L${level}: every draw skinned`);
    assert.ok(drawn.every((n: { name: string }) => !keep!.includes(n.name)), `${opponent} L${level}: carries none of the draws it keeps`);
    for (const image of json.images ?? []) if (image.uri) assert.match(image.uri, /^\.\.\/assets\/textures\/[0-9a-f]{64}\.(jpg|png|webp)$/, `${opponent} L${level}: ${image.uri}`);
  }
  // A rank-up at the rematch takes a fresh page only when his look file changes (Auditer + Strategy, #961).
  assert.ok(rankLookMoves('goblin', 1, 2), 'Recruit → Legionary: base rig → L2, a fresh page');
  assert.ok(rankLookMoves('goblin', 2, 3) && rankLookMoves('goblin', 9, 10), 'each rung up to Origin changes the file');
  assert.ok(!rankLookMoves('goblin', 5, 5), 'no rung change: no reload');
  assert.ok(rankLookMoves('plaguedoctor', 1, 2) && rankLookMoves('plaguedoctor', 9, 10), 'the Plague Doctor: each rung up changes the file');
  assert.ok(rankLookMoves('knight', 1, 2) && rankLookMoves('knight', 9, 10), 'the Knight: each rung up changes the file');
  assert.ok(!rankLookMoves('minotaur', 1, 2) && !rankLookMoves('minotaur', 4, 9), 'an opponent with no looks (a held creature) never reloads for one');
  // A fight with no look for his rank: nothing is fetched and nothing is reported (not 'failed').
  const errors: unknown[] = [];
  const none = rankLookStream<string>(() => undefined, () => assert.fail('never applied'), (e) => errors.push(e));
  none.tick(at(['ready', 'ready'])); await Promise.resolve(); none.tick(at(['ready', 'ready']));
  assert.equal(none.state(), 'none'); assert.deepEqual(errors, []);
});

// The phone file's art against the desktop file's (the phone-tier LOD contract, the test below): a plain derivative keeps every material and
// image byte; a draw in extras.rebaked moves onto the file's ONE new atlas; a draw in extras.resized keeps its mesh, material and slots with
// each map downsized; every other draw keeps the desktop material and image bytes exactly. Mutation-checked by the test after it.
type Glb = { json: any; bin: Buffer };
const lookGlb = (name: string): Glb => { const b = readFileSync(new URL(`../public/looks/${name}`, import.meta.url)), n = b.readUInt32LE(12); return { json: JSON.parse(b.subarray(20, 20 + n).toString()), bin: b.subarray(28 + n) }; };
// An image is its embedded bytes, or (a build-shared texture, ../assets/textures/<sha256>) its URI, whose bytes the sha names.
const image = (f: Glb, i: { bufferView?: number; uri?: string }) => { if (i.uri) return Buffer.from(i.uri); const v = f.json.bufferViews[i.bufferView!]; return f.bin.subarray(v.byteOffset ?? 0, (v.byteOffset ?? 0) + v.byteLength); };
const drawn = (f: Glb) => f.json.nodes.filter((n: { mesh?: number }) => n.mesh !== undefined);
function lodArt(full: Glb, phone: Glb, at: string, shared: Map<string, Buffer>) {
  const rebaked: string[] = phone.json.scenes[0].extras?.rebaked ?? [], resized: string[] = phone.json.scenes[0].extras?.resized ?? [];
  if (!rebaked.length && !resized.length) {
    assert.deepEqual(phone.json.materials, full.json.materials, `${at}: materials`);
    assert.deepEqual(phone.json.images.map((i: { bufferView: number }) => image(phone, i)), full.json.images.map((i: { bufferView: number }) => image(full, i)), `${at}: the same image bytes`);
  } else {
    const byName = (f: Glb, name: string) => f.json.nodes.find((n: { name: string; mesh?: number }) => n.name === name && n.mesh !== undefined);
    const art = (f: Glb, name: string) => f.json.meshes[byName(f, name).mesh].primitives.map((pr: { material: number }) => {
      const material = f.json.materials[pr.material], maps: string[] = [];
      JSON.stringify(material, (key, value) => { if (key.endsWith('Texture') && value?.index !== undefined) { const t = f.json.textures[value.index]; maps.push(image(f, f.json.images[t.extensions?.EXT_texture_webp?.source ?? t.source]).toString('base64')); } return value; });
      return { material, maps };
    });
    // A rebaked draw adds ONE new material (its atlas, shared by every rebaked draw of the file); any other primitive of it keeps a
    // material and maps of the desktop draw exactly (the Nightborn's L8–L10 armour: a small plate piece stays on the original metal).
    const fresh = new Set<string>();
    for (const name of rebaked) {
      assert.ok(byName(full, name), `${at}: rebaked ${name} is one of his draws`);
      const desktop = art(full, name).map((a: unknown) => JSON.stringify(a)), own = art(phone, name).map((a: unknown) => JSON.stringify(a)).filter((a: string) => !desktop.includes(a));
      assert.ok(new Set(own).size <= 1, `${at}: rebaked ${name} adds one new material, its atlas`);
      for (const a of own) fresh.add(a);
    }
    assert.ok(fresh.size <= 1, `${at}: the rebaked draws share one atlas`);
    for (const name of resized) assertResized(full, phone, name, at, rebaked, shared);
    for (const { name } of drawn(full).filter((n: { name: string }) => !rebaked.includes(n.name) && !resized.includes(n.name))) assert.deepEqual(art(phone, name), art(full, name), `${at}: ${name} keeps the desktop material and image bytes`);
  }
}

// A resized draw (extras.resized): the desktop draw's mesh (same primitives, attributes, counts and bounds), the desktop material with only its
// texture indices free (same parameters, same texture slots and texCoords), and each map the desktop map at the same or fewer pixels, never 0.
// Build-shared maps (../assets/textures/<sha256>): vite.config.mjs emits them from the base rigs, so read them from the rigs the way the build does.
let sharedMaps: Promise<Map<string, Buffer>> | undefined;
const buildShared = () => sharedMaps ??= (async () => { const shared = new Map<string, Buffer>(); for (const opponent of Object.keys(SHIPPING_LOOKS)) await optimizeGlb(readFileSync(new URL(`../src/assets/${opponent}.glb`, import.meta.url)), (b: Uint8Array) => { shared.set(createHash('sha256').update(b).digest('hex'), Buffer.from(b)); return undefined; }); return shared; })();
function assertResized(full: Glb, phone: Glb, name: string, at: string, rebaked: string[], shared: Map<string, Buffer>) {
  assert.ok(!rebaked.includes(name), `${at}: resized ${name} is not also rebaked`);
  const node = (f: Glb) => f.json.nodes.find((n: { name: string; mesh?: number }) => n.name === name && n.mesh !== undefined);
  assert.ok(node(full) && node(phone), `${at}: resized ${name} is one of his draws in both files`);
  const prims = (f: Glb) => f.json.meshes[node(f).mesh].primitives as { attributes: Record<string, number>; indices?: number; material: number }[];
  const [d, p] = [prims(full), prims(phone)];
  assert.equal(p.length, d.length, `${at}: resized ${name} keeps its primitives`);
  const shape = (f: Glb, a: number) => { const { count, componentType, type, min, max } = f.json.accessors[a]; return { count, componentType, type, min, max }; };
  const maps = (f: Glb, material: object) => { const out: [number, number][] = []; JSON.stringify(material, (key, value) => { if (key.endsWith('Texture') && value?.index !== undefined) { const t = f.json.textures[value.index]; const i = f.json.images[t.extensions?.EXT_texture_webp?.source ?? t.source], key = i.uri?.match(/[0-9a-f]{64}/)?.[0]; out.push(imageSize(key ? shared.get(key) ?? assert.fail(`${at}: ${i.uri} is not a map of a base rig`) : image(f, i))); } return value; }); return out; };
  const params = (material: object) => JSON.stringify(material, (key, value) => key === 'index' ? undefined : value);
  d.forEach((dp, k) => {
    const pp = p[k]!;
    assert.deepEqual(Object.keys(pp.attributes).sort(), Object.keys(dp.attributes).sort(), `${at}: resized ${name} keeps its attributes`);
    for (const a of Object.keys(dp.attributes)) assert.deepEqual(shape(phone, pp.attributes[a]!), shape(full, dp.attributes[a]!), `${at}: resized ${name} keeps its ${a}`);
    if (dp.indices !== undefined) assert.equal(phone.json.accessors[pp.indices!].count, full.json.accessors[dp.indices].count, `${at}: resized ${name} keeps its triangles`);
    const [dm, pm] = [full.json.materials[dp.material], phone.json.materials[pp.material]];
    assert.equal(params(pm), params(dm), `${at}: resized ${name} keeps the desktop material and its texture slots`);
    const [ds, ps] = [maps(full, dm), maps(phone, pm)];
    ps.forEach(([w, h], m) => assert.ok(w > 0 && h > 0 && w <= ds[m]![0] && h <= ds[m]![1], `${at}: resized ${name} map ${m} is ${w}×${h}, at most the desktop ${ds[m]!.join('×')}`));
  });
}

test('phone-tier LODs (Lead, 2026-09-28: iPhone jitter at the Plague Doctor L8–L10): the phone streams <opponent>-L<n>-phone.glb, the same look with fewer vertices', async () => {
  const shared = await buildShared();
  assert.equal(rankLookFor('plaguedoctor', 8, true), '/looks/plaguedoctor-L8-phone.glb', 'phone + a set with phone files: the LOD');
  assert.equal(rankLookFor('plaguedoctor', 8, false), '/looks/plaguedoctor-L8.glb', 'desktop keeps the full file');
  assert.equal(rankLookFor('plaguedoctor', 8), '/looks/plaguedoctor-L8.glb', 'desktop is the default');
  assert.equal(rankLookFor('goblin', 8, true), '/looks/goblin-L8.glb', 'a set without phone files falls back to its full file on the phone');
  assert.equal(rankLookFor('plaguedoctor', 1, true), '/looks/plaguedoctor-L1-phone.glb', 'rank 1 on the phone: his L1 LOD');
  assert.equal(rankLookFor('knight', 1, true), undefined, 'rank 1 with no L1: his rig as shipped');
  assert.equal(rankLookFor('knight', 5, true), '/looks/knight-L5-phone.glb', 'the Knight on the phone: his LOD (rebaked armour on L2–L6/L9/L10)');
  assert.ok(rankLookFlag('?ranklook=/looks/plaguedoctor-L8-phone.glb'), 'the dev flag accepts a phone file');
  const glb = lookGlb;
  for (const opponent of PHONE_LOOKS) for (const level of SHIPPING_LOOKS[opponent]!) {
    const full = glb(`${opponent}-L${level}.glb`), phone = glb(`${opponent}-L${level}-phone.glb`), at = `${opponent} L${level}`;
    // A mechanical derivative: only the armour mesh is simplified; the art (maps, materials), the skin and the look's shape stay the desktop file's.
    // A draw too seam-dense to simplify in place (the Knight's L2–L6/L9/L10 armour, Strategy 18:5x) is rebaked: welded, decimated, one new
    // atlas with its maps re-baked from the desktop art. The file names those draws in extras.rebaked; each is one material. A draw in
    // extras.resized (Lead + Strategy 2026-09-30, the Nightborn L1 head: its desktop maps alone are ~49 MiB of a 22 MiB phone 5b) keeps the
    // desktop mesh, material and texture slots and carries each desktop map downsized (≤ its pixels, never upscaled). Every other draw keeps
    // the desktop file's material and image bytes exactly.
    lodArt(full, phone, at, shared);
    const joints = (f: ReturnType<typeof glb>) => f.json.skins.map((k: { joints: number[] }) => k.joints.map((j) => f.json.nodes[j].name));
    assert.deepEqual(joints(phone), joints(full), `${at}: the same skin joints`);
    assert.deepEqual(drawn(phone).map((n: { name: string }) => n.name), drawn(full).map((n: { name: string }) => n.name), `${at}: the same draws`);
    assert.deepEqual(phone.json.scenes[0].extras?.keep, full.json.scenes[0].extras?.keep, `${at}: the same keep list`);
    // Row 5c's bar (Auditer, #1015): a body-replacing look on the phone tier is ≤ 60k skinned vertices whole.
    const vertices = (f: ReturnType<typeof glb>) => drawn(f).filter((n: { skin?: number }) => n.skin !== undefined).reduce((sum: number, n: { mesh: number }) => sum + f.json.meshes[n.mesh].primitives.reduce((q: number, pr: { attributes: { POSITION: number } }) => q + f.json.accessors[pr.attributes.POSITION].count, 0), 0);
    assert.ok(vertices(phone) <= 60_000, `${at}: ${vertices(phone)} skinned vertices on the phone`);
    assert.ok(vertices(phone) < vertices(full), `${at}: fewer vertices than the desktop file`);
  }
});

test('phone LOD contract, extras.resized (Lead + Strategy 2026-09-30): mutations of the Nightborn L1 head fail', async () => {
  const shared = await buildShared(), copy = (f: Glb): Glb => ({ json: structuredClone(f.json), bin: f.bin });
  const full = lookGlb('nightborn-L1.glb'), phone = lookGlb('nightborn-L1-phone.glb'), at = 'nightborn L1';
  assert.deepEqual(phone.json.scenes[0].extras.resized, ['Face', 'Photo', 'PhotoEyes', 'PhotoTeeth'], 'the head draws are resized');
  lodArt(full, phone, at, shared);
  const faceMaterial = (f: Glb) => f.json.materials[f.json.meshes[f.json.nodes.find((n: { name: string }) => n.name === 'Face').mesh].primitives[0].material];
  // (a) a resized draw whose material parameters change
  const a = copy(phone); faceMaterial(a).roughnessFactor = (faceMaterial(a).roughnessFactor ?? 1) / 2;
  assert.throws(() => lodArt(full, a, at, shared), /Face keeps the desktop material/);
  // (b) an upscaled map: the phone Face base samples a 1024 map while the desktop Face base samples a 512 one
  const width = (f: Glb, k: number) => { const t = f.json.textures[k], i = f.json.images[t.extensions?.EXT_texture_webp?.source ?? t.source]; return i.uri ? 0 : imageSize(image(f, i))[0]; };
  const [bFull, bPhone] = [copy(full), copy(phone)], pick = (f: Glb, w: number) => f.json.textures.findIndex((_: unknown, k: number) => width(f, k) === w);
  faceMaterial(bFull).pbrMetallicRoughness.baseColorTexture.index = pick(bFull, 512); faceMaterial(bPhone).pbrMetallicRoughness.baseColorTexture.index = pick(bPhone, 1024);
  assert.throws(() => lodArt(bFull, bPhone, at, shared), /Face map \d+ is 1024×\d+, at most the desktop 512×/);
  // (c) the old contract holds: a downsized draw that is not listed in extras.resized
  const c = copy(phone); c.json.scenes[0].extras.resized = ['Photo', 'PhotoEyes', 'PhotoTeeth'];
  assert.throws(() => lodArt(full, c, at, shared), /Face keeps the desktop material and image bytes/);
});

test('rank look stream: the sim is untouched (tick reads a frozen practice and never writes it)', async () => {
  const freeze = <T>(o: T): T => { if (o && typeof o === 'object' && !Object.isFrozen(o)) { Object.freeze(o); for (const v of Object.values(o)) freeze(v); } return o; };
  const stream = rankLookStream(async () => 1, () => {});
  const p = freeze(at(['ready', 'ready'])), before = JSON.stringify(p);
  stream.tick(p); await Promise.resolve(); await Promise.resolve(); stream.tick(p);
  assert.equal(stream.state(), 'on'); assert.equal(JSON.stringify(p), before);
  for (const file of ['combat.ts', 'duel.ts', 'sim.ts', 'match.ts', 'ai.ts']) assert.ok(!readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8').includes('rank-look'), `${file} never reads the look`);
});

test('rank look on the Goblin: his own look goes off as a set (carriers too), the look goes on his bones, the kept draws and the knife stay, and the head bake takes only what he shows', async () => {
  const [hero, goblin, lookFile, carriers] = await Promise.all([parse('warrior.glb'), parse('goblin.glb'), parse('goblin.glb'), parse('loot/carriers-goblin.glb')]);
  const { opponent } = buildWarriors(hero, goblin, ['longsword', OPPONENTS.goblin.weapon]);
  const pieces = skinned(carriers.scene).filter(p => p.userData.opponent === 'goblin');
  pieces[0]!.userData = { ...pieces[0]!.userData, slot: 'Shield' };   // stands in for a worn shield (the Veteran's scutum): no look carries one
  opponent.wear(pieces);
  assert.ok(opponent.worn().length > 1, 'he fights in his carriers first (the base look)');
  // A pieces-only look: one new draw (his helmet's geometry under a new name and material) and the names of his draws it keeps.
  const helm = skinned(lookFile.scene).find(d => d.name.replace(/[^A-Za-z]/g, '') === 'SteelHelmet')!;
  helm.name = 'Mid-tier helmet'; helm.material = new MeshStandardMaterial({ name: 'Look' });
  const keep = ['Skin', 'Face', 'Photo', 'PhotoEyes', 'PhotoTeeth'];
  // Every map on his own draws, watched: a map goes when no draw still shown uses it (the phone never holds both looks' maps).
  const mapsOf = (d: Mesh) => (Array.isArray(d.material) ? d.material : [d.material]).flatMap(m => Object.values(m).filter((v): v is Texture => !!v && (v as Texture).isTexture));
  const disposed = new Set<Texture>(), before = skinned(opponent.anchor).filter(d => !opponent.worn().includes(d));
  // The test loader decodes no images, so each draw gets a map of its own, and one hidden draw shares the kept Skin's map.
  const skin = before.find(d => d.name === 'Skin')!, other = before.find(d => !keep.includes(d.name))!;
  for (const d of before) { d.material = (d.material as MeshStandardMaterial).clone(); (d.material as MeshStandardMaterial).map = new Texture(); }
  (other.material as MeshStandardMaterial).map = (skin.material as MeshStandardMaterial).map;
  for (const t of new Set(before.flatMap(mapsOf))) t.addEventListener('dispose', () => disposed.add(t));
  const swapped = opponent.wearLook({ draws: [helm], keep });
  const keptMaps = new Set(before.filter(d => keep.includes(d.name)).flatMap(mapsOf)), goneMaps = new Set(before.filter(d => !keep.includes(d.name)).flatMap(mapsOf).filter(t => !keptMaps.has(t)));
  assert.ok(goneMaps.size, 'his hidden draws have maps of their own');
  for (const t of goneMaps) assert.ok(disposed.has(t), `a map only his hidden draws used is freed (${t.name || t.uuid})`);
  for (const t of keptMaps) assert.ok(!disposed.has(t), `a map a kept draw still uses stays (${t.name || t.uuid})`);
  assert.deepEqual(swapped.added, ['Mid-tier helmet']);
  assert.equal(swapped.bodyFreed, 0, 'a pieces-only look frees no CreatureBody: row 5a counts its added tris whole');
  assert.ok(swapped.vertices > 0 && swapped.vertices < 60000, `a pieces-only look reports its vertices (${swapped.vertices}) and row 5c does not bind it`);
  const own = skinned(opponent.anchor).filter(d => !d.userData.rankLook && !opponent.worn().includes(d));
  for (const draw of own) assert.equal(draw.visible, keep.includes(draw.name), `${draw.name} ${keep.includes(draw.name) ? 'stays' : 'goes off'}`);
  assert.ok(opponent.worn().every(p => p.visible === (p.userData.slot === 'Shield')), 'his carriers go off with his look; a worn shield stays');
  const added = skinned(opponent.anchor).find(d => d.userData.rankLook)!, body = own.find(d => d.name === 'Skin')!;
  assert.ok(added.visible && added.parent === body.parent);
  assert.ok(added.skeleton.bones.every(b => body.skeleton.bones.includes(b)), 'the look follows his own bones');
  let knife = false; opponent.anchor.traverse(o => { if (o instanceof Mesh && !(o instanceof SkinnedMesh) && o.name.startsWith('WeaponDrawn') && o.visible) knife = true; });
  assert.ok(knife, 'his weapon is never touched');
  // A file without extras.keep is refused (Lead, #918): the stream stays on his base look, never a guessed hide set.
  assert.throws(() => readRankLook(lookFile.scene), /extras\.keep/);
  opponent.wear(pieces);
  assert.ok(opponent.worn().every(p => p.visible === (p.userData.slot === 'Shield')) && own.filter(d => !keep.includes(d.name)).every(d => !d.visible), 'a re-dress (rematch) never brings the base look back, and keeps the shield on');
  assert.ok(skinned(opponent.anchor).filter(d => d.userData.rankLook).every(d => d.visible), 'and never hides the look (its helm shares the carriers\' replace slot)');
  // An explicit keep list read from the file's extras: every draw of his not in it goes off, the untagged ones too (the Goblin's bracer
  // trio), and a look draw named like one that goes off is worn in its place, not lost with it.
  const [fresh, lookScene] = await Promise.all([parse('goblin.glb'), parse('goblin.glb')]);
  const listed = buildWarriors(hero, fresh, ['longsword', OPPONENTS.goblin.weapon]).opponent;
  const mine = skinned(listed.anchor), untagged = mine.filter(d => !d.userData.slot && !keep.includes(d.name));
  assert.ok(untagged.length, 'the Goblin has untagged draws of his own (his base bracer)');
  const same = skinned(lookScene.scene).find(d => d.name === untagged[0]!.name)!;
  lookScene.scene.userData.keep = keep;
  const read = readRankLook(lookScene.scene);
  assert.deepEqual(read.keep, keep, 'extras.keep is read from the file');
  const result = listed.wearLook({ draws: [same], keep: read.keep });
  assert.deepEqual(result.added, [same.name], 'a look draw named like one that goes off replaces it');
  for (const d of mine) assert.equal(d.visible, keep.includes(d.name), `keep list: ${d.name}`);
  // The waist-cut rebake after the swap: pending, taken one step a frame, and cut to the same pieces as the whole bake a kill would force.
  const whole = buildWarriors(hero, goblin, ['longsword', OPPONENTS.goblin.weapon]).opponent, stepped = buildWarriors(hero, goblin, ['longsword', OPPONENTS.goblin.weapon]).opponent;
  for (const rig of [whole, stepped]) { rig.prepareOpened(); rig.wearLook({ draws: [helm], keep }); assert.ok(rig.bakePending(), 'the swap leaves the bake pending, not taken on its frame'); }
  whole.prepareOpened();
  let steps = 0; while (stepped.stepOpened() !== null) steps++;
  assert.ok(!stepped.bakePending() && steps > 3 && steps < 400, `stepped over ${steps} frames`);   // bounded work per step, so more steps (a kill that comes first finishes it)
  const cut = (rig: typeof whole) => { rig.openWaist(.5, 'red'); const pieces: string[] = []; rig.anchor.getObjectByName('Opened')!.traverse(o => { if (o instanceof Mesh) pieces.push(`${o.name}:${o.geometry.getAttribute('position').count}`); }); return pieces.sort(); };
  assert.deepEqual(cut(stepped), cut(whole), 'the stepped bake cuts the same pieces as the whole one');
  // Baked before the swap (Lead's ruling on #1025 row C): the look's draws hang hidden while it steps, and the swap leaves nothing pending.
  const early = buildWarriors(hero, goblin, ['longsword', OPPONENTS.goblin.weapon]).opponent, earlyLook = { draws: [helm], keep };
  early.prepareOpened(); early.prepareLook(earlyLook);
  assert.ok(skinned(early.anchor).filter(d => d.userData.rankLook).every(d => !d.visible), 'the look hangs hidden while it bakes');
  let pre = 0; for (let s = early.stepLook(); s && !s.done; s = early.stepLook()) pre++;
  assert.ok(pre > 3 && early.stepLook() === null, `baked over ${pre} steps before the swap`);
  early.wearLook(earlyLook);
  assert.ok(!early.bakePending(), 'the swap wears the finished bake');
  assert.deepEqual(cut(early), cut(whole), 'and it cuts the same pieces as the bake taken after the swap');
  const head = opponent.sever()!;
  const materials = head.group.children.map(c => ((c as Mesh).material as MeshStandardMaterial).name);
  assert.ok(materials.includes('Look'), 'the look\'s helm leaves with the head');
  assert.ok(!materials.includes('Steel'), 'his hidden helmet does not');
});

test('rank look on the Plague Doctor: a shipped file with extras.keep = [] replaces his fused CreatureBody whole; the look follows his bones and his weapon stays', async () => {
  // His shipped file as the game loads it (meshopt, images dropped as parse() does).
  const bytes = readFileSync(new URL('../public/looks/plaguedoctor-L2.glb', import.meta.url)), size = bytes.readUInt32LE(12), json = JSON.parse(bytes.subarray(20, 20 + size).toString());
  json.images = []; json.textures = []; json.materials = json.materials.map((m: { name: string }) => ({ name: m.name }));
  json.buffers[0].uri = 'data:application/octet-stream;base64,' + bytes.subarray(28 + size).toString('base64');
  const [hero, doctor, lookFile] = await Promise.all([parse('warrior.glb'), parse('plaguedoctor.glb'), new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(JSON.stringify(json), '')]);
  const { opponent } = buildWarriors(hero, doctor, ['longsword', OPPONENTS.plaguedoctor.weapon]);
  const look = readRankLook(lookFile.scene);
  assert.deepEqual(look.keep, [], 'his files keep nothing of his');
  const swapped = opponent.wearLook(look);
  assert.deepEqual(swapped.added.sort(), ['L2_Armour', 'L2_FittedGloves']);
  // Row 5a's rule for a body-replacing look (Lead, #1001): the 45k added-tris bar is read net of the CreatureBody it frees.
  assert.equal(swapped.bodyFreed, 44988, 'his whole CreatureBody is freed, and reported for the net count');
  assert.ok(swapped.tris > swapped.bodyFreed, 'the gate reads tris - bodyFreed');
  // Row 5c (Dom 2026-09-28): the phone pays skinned vertices whole; his live look is 2.3× the body it frees and fails the 60k phone bar.
  assert.equal(swapped.vertices, 99571, 'every skinned vertex of his L2 look, as the phone skins it each pass (L10: 121,511)');
  assert.ok(swapped.vertices > 60000 && swapped.bodyFreed > 0, 'a body-replacing look over 60k vertices: row 5c FAILS it on the phone tier');
  const own = skinned(opponent.anchor).filter(d => !d.userData.rankLook), body = own.find(d => d.name === 'CreatureBody')!;
  assert.ok(body && own.every(d => !d.visible), 'CreatureBody (his fused costume and head) goes off');
  for (const d of skinned(opponent.anchor).filter(d => d.userData.rankLook)) {
    assert.ok(d.visible && d.parent === body.parent, `${d.name} is on`);
    assert.ok(d.skeleton.bones.every(b => body.skeleton.bones.includes(b)), `${d.name} follows his own bones`);
  }
  let weapon = false; opponent.anchor.traverse(o => { if (o instanceof Mesh && !(o instanceof SkinnedMesh) && o.name.startsWith('WeaponDrawn') && o.visible) weapon = true; });
  assert.ok(weapon, 'his weapon is never touched');
});

test('rank look on the Knight: a shipped file with extras.keep = [] (armour + gauntlets) replaces his CreatureBody whole; the look follows his bones and his maul stays', async () => {
  const bytes = readFileSync(new URL('../public/looks/knight-L8.glb', import.meta.url)), size = bytes.readUInt32LE(12), json = JSON.parse(bytes.subarray(20, 20 + size).toString());
  json.images = []; json.textures = []; json.materials = json.materials.map((m: { name: string }) => ({ name: m.name }));
  json.buffers[0].uri = 'data:application/octet-stream;base64,' + bytes.subarray(28 + size).toString('base64');
  const [hero, knight, lookFile] = await Promise.all([parse('warrior.glb'), parse('knight.glb'), new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(JSON.stringify(json), '')]);
  const { opponent } = buildWarriors(hero, knight, ['longsword', OPPONENTS.knight.weapon]);
  const look = readRankLook(lookFile.scene);
  assert.deepEqual(look.keep, [], 'his files keep nothing of his');
  const swapped = opponent.wearLook(look);
  // Helm split (Armour 2026-09-29, Finishers' retro gate 1: the closed helm is its own draw, 100 % Head, so a sever moves it whole).
  assert.deepEqual(swapped.added.sort(), ['Knight_L8_Armour', 'Knight_L8_Armour_Helm', 'Knight_L8_Gloves']);
  // Row 5a net (Lead, #1001): 72,252 tris less his freed 44,997-tri CreatureBody = 27,255 added, under the 45k bar.
  assert.equal(swapped.bodyFreed, 44997, 'his whole CreatureBody is freed, and reported for the net count');
  assert.equal(swapped.tris - swapped.bodyFreed, 27255, 'row 5a: tris net of the body it frees');
  // Row 5c: 76,997 skinned vertices, over the phone's 60k; the phone tier waits on his -phone files (Strategy 18:4x: 44k cut per rank).
  assert.equal(swapped.vertices, 77327, 'every skinned vertex of his L8 look, as the phone skins it each pass (76,997 + 330 on the helm split\'s seam ring; tris unchanged)');
  const own = skinned(opponent.anchor).filter(d => !d.userData.rankLook), body = own.find(d => d.name === 'CreatureBody')!;
  assert.ok(body && own.every(d => !d.visible), 'CreatureBody (his fused costume and head) goes off');
  for (const d of skinned(opponent.anchor).filter(d => d.userData.rankLook)) {
    assert.ok(d.visible && d.parent === body.parent, `${d.name} is on`);
    assert.ok(d.skeleton.bones.every(b => body.skeleton.bones.includes(b)), `${d.name} follows his own bones`);
  }
  // His maul: unnamed unskinned meshes under WeaponDrawn, which wearLook never touches.
  let maul = 0; opponent.anchor.traverse(o => { if (o.name.startsWith('WeaponDrawn')) o.traverse(m => { if (m instanceof Mesh && !(m instanceof SkinnedMesh) && m.visible) maul++; }); });
  assert.ok(maul > 0, 'his maul is never touched');
});

test('rank look draws cast no shadow on the phone tier (Auditer, 2026-09-28: the Plague Doctor look is 121k skinned vertices, skinned twice a frame with castShadow); the full tier keeps it', async () => {
  const bytes = readFileSync(new URL('../public/looks/plaguedoctor-L10.glb', import.meta.url)), size = bytes.readUInt32LE(12), json = JSON.parse(bytes.subarray(20, 20 + size).toString());
  json.images = []; json.textures = []; json.materials = json.materials.map((m: { name: string }) => ({ name: m.name }));
  json.buffers[0].uri = 'data:application/octet-stream;base64,' + bytes.subarray(28 + size).toString('base64');
  const g = globalThis as { location?: { search: string } };
  const wear = async (search: string) => {
    g.location = { search }; resetPhoneTierForTests();
    const [hero, doctor, lookFile] = await Promise.all([parse('warrior.glb'), parse('plaguedoctor.glb'), new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(JSON.stringify(json), '')]);
    const { opponent } = buildWarriors(hero, doctor, ['longsword', OPPONENTS.plaguedoctor.weapon]);
    opponent.wearLook(readRankLook(lookFile.scene));
    const added = skinned(opponent.anchor).filter(d => d.userData.rankLook);
    assert.equal(added.length, 2, 'L10 = two look draws');
    // Swap frame (Hero Look sampler, 2026-09-29): a look draw arrives with its bind-pose sphere, so three's first render never skins every
    // vertex on the CPU to make one; its own copy, so nothing moves the file's.
    for (const d of added) {
      assert.ok(d.boundingSphere && d.boundingSphere.radius > 0, `${d.name}: a bounding sphere before its first render`);
      assert.ok(d.boundingSphere !== d.geometry.boundingSphere && d.boundingSphere.equals(d.geometry.boundingSphere!), `${d.name}: the file's sphere, copied`);
    }
    return added;
  };
  try {
    const phone = await wear('?gfx=phone');
    assert.ok(phone.every(d => !d.castShadow && d.receiveShadow), 'phone tier: the look draws cast no shadow, still receive one');
    const full = await wear('?gfx=full');
    assert.ok(full.every(d => d.castShadow && d.receiveShadow), 'full tier: unchanged, the look casts');
  } finally { delete g.location; resetPhoneTierForTests(); }
});

test('whole-figure look on a built rig (Nightborn, Lead 19:1x): extras.keep = [] turns off every one of his skinned draws, the gate nets all of them, his estoc stays', async () => {
  // His shipped L8 file: the closed helm is the head; every draw of his own goes off.
  const bytes = readFileSync(new URL('../public/looks/nightborn-L8.glb', import.meta.url)), size = bytes.readUInt32LE(12), json = JSON.parse(bytes.subarray(20, 20 + size).toString());
  json.images = []; json.textures = []; json.materials = json.materials.map((m: { name: string }) => ({ name: m.name }));
  json.buffers[0].uri = 'data:application/octet-stream;base64,' + bytes.subarray(28 + size).toString('base64');
  const [hero, nightborn, lookFile] = await Promise.all([parse('warrior.glb'), parse('nightborn.glb'), new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(JSON.stringify(json), '')]);
  const { opponent } = buildWarriors(hero, nightborn, ['longsword', OPPONENTS.nightborn.weapon]);
  const own = skinned(opponent.anchor).filter(d => !d.userData.rankLook && d.visible);
  const tris = (d: SkinnedMesh) => (d.geometry.index ? d.geometry.index.count : d.geometry.getAttribute('position').count) / 3;
  const his = own.reduce((n, d) => n + tris(d), 0);
  assert.ok(own.length >= 10 && !own.some(d => d.name === 'CreatureBody'), 'a built rig: many draws, no fused CreatureBody');
  const swapped = opponent.wearLook(readRankLook(lookFile.scene));
  assert.ok(own.every(d => !d.visible), 'every draw of his goes off (his head too: the look carries its own)');
  assert.equal(swapped.bodyFreed, his, 'row 5a nets every draw he loses, not only a CreatureBody');
  // L8: 94,405 tris less his 14 draws' 58,792 = 35,613 added, under the 45k bar; 88,486 skinned vertices, so the phone streams his -phone file.
  assert.deepEqual([swapped.bodyFreed, swapped.tris - swapped.bodyFreed, swapped.vertices], [58792, 35613, 88486]);
  let estoc = false; opponent.anchor.traverse(o => { if (o instanceof Mesh && !(o instanceof SkinnedMesh) && o.name.startsWith('WeaponDrawn') && o.visible) estoc = true; });
  assert.ok(estoc, 'his estoc is never touched');
});

test('rank look on the Dwarf: keep = [] turns off his CreatureBody and both helmet draws, the gate nets all three, his warhammer stays', async () => {
  const bytes = readFileSync(new URL('../public/looks/dwarf-L8.glb', import.meta.url)), size = bytes.readUInt32LE(12), json = JSON.parse(bytes.subarray(20, 20 + size).toString());
  json.images = []; json.textures = []; json.materials = json.materials.map((m: { name: string }) => ({ name: m.name }));
  json.buffers[0].uri = 'data:application/octet-stream;base64,' + bytes.subarray(28 + size).toString('base64');
  const [hero, dwarf, lookFile] = await Promise.all([parse('warrior.glb'), parse('dwarf.glb'), new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(JSON.stringify(json), '')]);
  const { opponent } = buildWarriors(hero, dwarf, ['longsword', OPPONENTS.dwarf.weapon]);
  const own = skinned(opponent.anchor).filter(d => !d.userData.rankLook && d.visible);
  const tris = (d: SkinnedMesh) => (d.geometry.index ? d.geometry.index.count : d.geometry.getAttribute('position').count) / 3;
  const his = own.reduce((n, d) => n + tris(d), 0);
  assert.deepEqual(own.map(d => d.name).sort(), ['Antique_brassHelmet', 'CreatureBody', 'SteelHelmet'], 'his three skinned draws');
  const swapped = opponent.wearLook(readRankLook(lookFile.scene));
  assert.ok(own.every(d => !d.visible), 'all three go off (the helm too: L8 carries its own closed helm)');
  assert.equal(swapped.bodyFreed, his, 'row 5a nets the helmet draws with his body');
  // L8: 53,720 tris less his 45,327 (body + helmets) = 8,393 added; 70,629 skinned vertices, so the phone streams his -phone file.
  assert.deepEqual([swapped.bodyFreed, swapped.tris - swapped.bodyFreed, swapped.vertices], [45327, 8393, 70629]);
  let hammer = 0; opponent.anchor.traverse(o => { if (o.name.startsWith('WeaponDrawn')) o.traverse(m => { if (m instanceof Mesh && !(m instanceof SkinnedMesh) && m.visible) hammer++; }); });
  assert.ok(hammer > 0, 'his warhammer is never touched');
});

test('rank look on the Witch: keep = [] turns off every draw of hers, the gate nets them all, no waist-cut bake (no finishers), her trident stays', async () => {
  const bytes = readFileSync(new URL('../public/looks/witch-L8.glb', import.meta.url)), size = bytes.readUInt32LE(12), json = JSON.parse(bytes.subarray(20, 20 + size).toString());
  json.images = []; json.textures = []; json.materials = json.materials.map((m: { name: string }) => ({ name: m.name }));
  json.buffers[0].uri = 'data:application/octet-stream;base64,' + bytes.subarray(28 + size).toString('base64');
  const [hero, witch, lookFile] = await Promise.all([parse('warrior.glb'), parse('witch.glb'), new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(JSON.stringify(json), '')]);
  const { opponent } = buildWarriors(hero, witch, ['longsword', OPPONENTS.witch.weapon]);
  const own = skinned(opponent.anchor).filter(d => !d.userData.rankLook && d.visible);
  const tris = (d: SkinnedMesh) => (d.geometry.index ? d.geometry.index.count : d.geometry.getAttribute('position').count) / 3;
  const her = own.reduce((n, d) => n + tris(d), 0);
  assert.deepEqual(own.map(d => d.name), ['CreatureBody'], 'her one skinned draw');
  const swapped = opponent.wearLook(readRankLook(lookFile.scene));
  assert.ok(own.every(d => !d.visible), 'every draw of hers goes off (her head too: L8 carries its own closed helm)');
  assert.equal(swapped.bodyFreed, her, 'row 5a nets every draw she loses');
  // L8: 88,000 tris less her body's 44,976 = 43,024 added, under the 45k bar; 78,880 skinned vertices, so the phone streams her -phone file.
  assert.deepEqual([swapped.bodyFreed, swapped.tris - swapped.bodyFreed, swapped.vertices], [44976, 43024, 78880]);
  let trident = 0; opponent.anchor.traverse(o => { if (o.name.startsWith('WeaponDrawn')) o.traverse(m => { if (m instanceof Mesh && !(m instanceof SkinnedMesh) && m.visible) trident++; }); });
  assert.ok(trident > 0, 'her trident is never touched');
  for (const level of SHIPPING_LOOKS.witch!) for (const phone of [false, true]) assert.equal(lookBakes(supportsFinishers('witch', 'opened'), rankLookFor('witch', level, phone)), false, `L${level}${phone ? ' phone' : ''}: no bake`);
});

test('rank look on the Pitborn: a keep = [] look turns off all 16 draws of his built rig and his carriers, the gate nets them all, his cleaver stays; opened is his, so the pre-swap bake applies', async () => {
  const [hero, pitborn, carriers] = await Promise.all([parse('warrior.glb'), parse('pitborn.glb'), parse('loot/carriers-pitborn.glb')]);
  const { opponent } = buildWarriors(hero, pitborn, ['longsword', OPPONENTS.pitborn.weapon]);
  opponent.wear(skinned(carriers.scene).filter(p => p.userData.opponent === 'pitborn'));
  assert.ok(opponent.worn().length > 0, 'he fights in his carriers first (the level-1 kit)');
  const own = skinned(opponent.anchor).filter(d => !opponent.worn().includes(d) && d.visible);
  assert.deepEqual(own.map(d => d.name).sort(), ['Antique_brass', 'Antique_brassBody', 'Bone', 'BoneWorn', 'Face', 'Gambeson', 'Heraldry', 'Leather', 'Photo', 'PhotoEyes', 'PhotoTeeth', 'Skin', 'Steel', 'SteelBody', 'Wrap', 'WrapArms'], 'his 16 skinned draws');
  const tris = (d: SkinnedMesh) => (d.geometry.index ? d.geometry.index.count : d.geometry.getAttribute('position').count) / 3;
  const his = own.reduce((n, d) => n + tris(d), 0);
  // A stand-in whole-figure draw (his Skin's geometry under a new name): GPT's packs so far all ship keep = [].
  const figure = own.find(d => d.name === 'Skin')!.clone(); figure.name = 'Pitborn_Look'; figure.material = new MeshStandardMaterial({ name: 'Look' });
  const swapped = opponent.wearLook({ draws: [figure], keep: [] });
  assert.ok(own.every(d => !d.visible), 'every draw of his goes off (his head too: the look carries its own)');
  assert.ok(opponent.worn().every(p => !p.visible), 'his carriers go off with his look');
  assert.equal(swapped.bodyFreed, his, 'row 5a nets all 16 of his draws');
  let cleaver = 0; opponent.anchor.traverse(o => { if (o.name.startsWith('WeaponDrawn')) o.traverse(m => { if (m instanceof Mesh && !(m instanceof SkinnedMesh) && m.visible) cleaver++; }); });
  assert.ok(cleaver > 0, 'his cleaver is never touched');
  assert.ok(supportsFinishers('pitborn', 'opened') && lookBakes(true, '/looks/pitborn-L5.glb'), 'he can play opened: his looks take the pre-swap bake (none forced to runThrough yet)');
});

test('rank look on the Shieldmaiden (Lead 2026-09-29): a keep = [] look turns off every draw of hers and her carriers but her shield, the gate nets what was shown, her gladius stays', async () => {
  const [hero, maiden, carriers] = await Promise.all([parse('warrior.glb'), parse('shieldmaiden.glb'), parse('loot/carriers-shieldmaiden.glb')]);
  const { opponent } = buildWarriors(hero, maiden, ['longsword', OPPONENTS.shieldmaiden.weapon]);
  opponent.wear(skinned(carriers.scene).filter(p => p.userData.opponent === 'shieldmaiden'));
  assert.ok(opponent.worn().length > 0, 'she fights in her carriers first (the level-1 kit)');
  const own = skinned(opponent.anchor).filter(d => !opponent.worn().includes(d) && !d.userData.rankLook && d.visible);
  assert.ok(own.length > 0, 'her own skinned draws');
  const tris = (d: SkinnedMesh) => (d.geometry.index ? d.geometry.index.count : d.geometry.getAttribute('position').count) / 3;
  const hers = own.reduce((n, d) => n + tris(d), 0);
  const figure = own[0]!.clone(); figure.name = 'Shieldmaiden_Look'; figure.material = new MeshStandardMaterial({ name: 'Look' });
  const swapped = opponent.wearLook({ draws: [figure], keep: [] });
  assert.ok(own.every(d => !d.visible), 'every draw of hers goes off (her head too: the look carries its own)');
  const [shield, rest] = [opponent.worn().filter(p => p.userData.slot === 'Shield'), opponent.worn().filter(p => p.userData.slot !== 'Shield')];
  assert.ok(rest.every(p => !p.visible), 'her carriers go off with her look');
  assert.ok(shield.every(p => p.visible), 'a worn shield stays (no look file carries one)');
  assert.equal(swapped.bodyFreed, hers, 'row 5a nets every draw she loses');
  let blade = 0; opponent.anchor.traverse(o => { if (o.name.startsWith('WeaponDrawn')) o.traverse(m => { if (m instanceof Mesh && !(m instanceof SkinnedMesh) && m.visible) blade++; }); });
  assert.ok(blade > 0, 'her gladius is never touched');
});

test('rank look on the Pitborn, his shipped L8 file: every draw of his and his carriers go off, row 5a nets them, his cleaver stays; the look brings its split closed helm', async () => {
  const bytes = readFileSync(new URL('../public/looks/pitborn-L8.glb', import.meta.url)), size = bytes.readUInt32LE(12), json = JSON.parse(bytes.subarray(20, 20 + size).toString());
  json.images = []; json.textures = []; json.materials = json.materials.map((m: { name: string }) => ({ name: m.name }));
  json.buffers[0].uri = 'data:application/octet-stream;base64,' + bytes.subarray(28 + size).toString('base64');
  const [hero, pitborn, carriers, lookFile] = await Promise.all([parse('warrior.glb'), parse('pitborn.glb'), parse('loot/carriers-pitborn.glb'), new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(JSON.stringify(json), '')]);
  const { opponent } = buildWarriors(hero, pitborn, ['longsword', OPPONENTS.pitborn.weapon]);
  opponent.wear(skinned(carriers.scene).filter(p => p.userData.opponent === 'pitborn'));
  const own = skinned(opponent.anchor).filter(d => !opponent.worn().includes(d) && !d.userData.rankLook && d.visible);
  const tris = (d: SkinnedMesh) => (d.geometry.index ? d.geometry.index.count : d.geometry.getAttribute('position').count) / 3;
  const his = own.reduce((n, d) => n + tris(d), 0);
  const swapped = opponent.wearLook(readRankLook(lookFile.scene));
  assert.ok(own.every(d => !d.visible) && opponent.worn().every(p => !p.visible), 'every draw of his and his carriers go off');
  assert.equal(swapped.bodyFreed, his, 'row 5a nets every draw he loses');
  assert.deepEqual(swapped.added.slice().sort(), ['Fitted_joint_sleeves', 'Pitborn_L8_Armour', 'Pitborn_L8_Armour_Helm'], 'the armour, its fitted joint sleeves and its split closed helm (Armour handover-l2l10)');
  let cleaver = 0; opponent.anchor.traverse(o => { if (o.name.startsWith('WeaponDrawn')) o.traverse(m => { if (m instanceof Mesh && !(m instanceof SkinnedMesh) && m.visible) cleaver++; }); });
  assert.ok(cleaver > 0, 'his cleaver is never touched');
});

test('rank look on the Centurion: a keep = [] look turns off his CreatureBody, helmet and face draws and his carriers, the gate nets them all, his weapon stays; opened is his, so the pre-swap bake applies', async () => {
  const [hero, veteran, carriers] = await Promise.all([parse('warrior.glb'), parse('veteran.glb'), parse('loot/carriers-veteran.glb')]);
  // From LEVEL_ANCHORS.easy he fights with the gladius (LOADOUT_FROM), the rank where his looks start.
  const { opponent } = buildWarriors(hero, veteran, ['longsword', LOADOUT_FROM.veteran!.weapon]);
  opponent.wear(skinned(carriers.scene).filter(p => p.userData.opponent === 'veteran'));
  const own = skinned(opponent.anchor).filter(d => !opponent.worn().includes(d) && !d.userData.rankLook && d.visible);
  assert.ok(own.some(d => d.name === 'CreatureBody'), 'his fused CreatureBody is among his skinned draws');
  const tris = (d: SkinnedMesh) => (d.geometry.index ? d.geometry.index.count : d.geometry.getAttribute('position').count) / 3;
  const his = own.reduce((n, d) => n + tris(d), 0);
  const figure = own.find(d => d.name === 'CreatureBody')!.clone(); figure.name = 'Centurion_Look'; figure.material = new MeshStandardMaterial({ name: 'Look' });
  const swapped = opponent.wearLook({ draws: [figure], keep: [] });
  assert.ok(own.every(d => !d.visible), 'every draw of his goes off (his head too: the look carries its own)');
  assert.ok(opponent.worn().filter(p => p.userData.slot !== 'Shield').every(p => !p.visible), 'his carriers go off with his look, a shield excepted');
  assert.equal(swapped.bodyFreed, his, 'row 5a nets every draw he loses');
  let weapon = 0; opponent.anchor.traverse(o => { if (o.name.startsWith('WeaponDrawn')) o.traverse(m => { if (m instanceof Mesh && !(m instanceof SkinnedMesh) && m.visible) weapon++; }); });
  assert.ok(weapon > 0, 'his weapon is never touched');
  assert.ok(supportsFinishers('veteran', 'opened') && lookBakes(true, '/looks/veteran-L5.glb'), 'he can play opened: his looks take the pre-swap bake');
});

test('rank look on the Executioner (Lead 2026-09-29): a keep = [] look turns off every draw of his and his carriers, the gate nets them all, his scythe stays; opened is his, so the pre-swap bake applies', async () => {
  const [hero, executioner, carriers] = await Promise.all([parse('warrior.glb'), parse('executioner.glb'), parse('loot/carriers-executioner.glb')]);
  const { opponent } = buildWarriors(hero, executioner, ['longsword', OPPONENTS.executioner.weapon]);
  opponent.wear(skinned(carriers.scene).filter(p => p.userData.opponent === 'executioner'));
  assert.ok(opponent.worn().length > 0, 'he fights in his carriers first (the level-1 kit)');
  const own = skinned(opponent.anchor).filter(d => !opponent.worn().includes(d) && !d.userData.rankLook && d.visible);
  assert.ok(own.length > 0, 'his own skinned draws');
  const tris = (d: SkinnedMesh) => (d.geometry.index ? d.geometry.index.count : d.geometry.getAttribute('position').count) / 3;
  const his = own.reduce((n, d) => n + tris(d), 0);
  const figure = own[0]!.clone(); figure.name = 'Executioner_Look'; figure.material = new MeshStandardMaterial({ name: 'Look' });
  const swapped = opponent.wearLook({ draws: [figure], keep: [] });
  assert.ok(own.every(d => !d.visible), 'every draw of his goes off (his head too: the look carries its own)');
  assert.ok(opponent.worn().filter(p => p.userData.slot !== 'Shield').every(p => !p.visible), 'his carriers go off with his look');
  assert.equal(swapped.bodyFreed, his, 'row 5a nets every draw he loses');
  let blade = 0; opponent.anchor.traverse(o => { if (o.name.startsWith('WeaponDrawn')) o.traverse(m => { if (m instanceof Mesh && !(m instanceof SkinnedMesh) && m.visible) blade++; }); });
  assert.ok(blade > 0, 'his scythe is never touched');
  assert.ok(supportsFinishers('executioner', 'opened') && lookBakes(true, '/looks/executioner-L5.glb'), 'he can play opened: his looks take the pre-swap bake');
});

test('rank look file contract (Lead, #918): the look carries none of the draws it keeps; the base rig\'s own keep draws stay shown, and a file without extras.keep is still refused', async () => {
  const [hero, goblin, lookFile] = await Promise.all([parse('warrior.glb'), parse('goblin.glb'), parse('goblin.glb')]);
  const keep = ['Face', 'Photo', 'PhotoEyes', 'PhotoTeeth', 'Skin', 'Wrap.Boots'];
  // A lean look file: his draws minus every keep-named one (Armour drops them; the base rig already has them), read as the game reads it.
  const loaded = keep.map(k => k.replace('.', ''));   // the loader drops '.' from node names
  for (const d of skinned(lookFile.scene).filter(d => loaded.includes(d.name))) d.removeFromParent();
  assert.throws(() => readRankLook(lookFile.scene), /extras\.keep/, 'no keep list: refused (L1)');
  lookFile.scene.userData.keep = keep;
  const look = readRankLook(lookFile.scene), kept = look.keep;
  assert.ok(kept.includes('WrapBoots'), 'keep names are read as the loader names his draws (Wrap.Boots loads as WrapBoots)');
  assert.ok(look.draws.length && look.draws.every(d => !kept.includes(d.name)), 'the file carries none of the kept draws');
  const { opponent } = buildWarriors(hero, goblin, ['longsword', OPPONENTS.goblin.weapon]);
  const own = skinned(opponent.anchor).filter(d => !opponent.worn().includes(d));
  assert.ok(kept.every(k => own.some(d => d.name === k)), 'the base Goblin has every keep draw');
  opponent.wearLook(look);
  for (const d of own) assert.equal(d.visible, kept.includes(d.name), `${d.name}: ${kept.includes(d.name) ? 'his own stays shown' : 'goes off'}`);
  const worn = skinned(opponent.anchor).filter(d => d.userData.rankLook);
  assert.equal(worn.length, look.draws.length, 'every look draw is worn');
  assert.ok(worn.every(d => d.visible && !kept.includes(d.name)), 'and none of them stands in for a kept draw');
});

test('waist-cut supports (Lead, #918): one support per vertex, not per triangle corner, gives bit-identical rests and floor table', async () => {
  const [hero, goblin, lookFile] = await Promise.all([parse('warrior.glb'), parse('goblin.glb'), parse('goblin.glb')]);
  const keep = ['Face', 'Photo', 'PhotoEyes', 'PhotoTeeth', 'Skin', 'Wrap.Boots'];
  for (const d of skinned(lookFile.scene).filter(d => keep.map(k => k.replace('.', '')).includes(d.name))) d.removeFromParent();
  lookFile.scene.userData.keep = keep;
  const { opponent } = buildWarriors(hero, goblin, ['longsword', OPPONENTS.goblin.weapon]);
  opponent.wearLook(readRankLook(lookFile.scene));
  const root = opponent.anchor.children[0]!, once = openWaist(root, opponent.anchor), corners = openWaist(root, opponent.anchor, true);
  const halves = (o: ReturnType<typeof openWaist>) => o.group.children.map(h => [h.name, h.position.toArray(), h.quaternion.toArray()]);
  // Every placement is the rests (upper, legs, weapon) slerped in and lifted to the floor table: equal at every progress means all of them are.
  for (let i = 0; i <= 240; i++) { once.update(i / 240, false); corners.update(i / 240, false); assert.deepStrictEqual(halves(once), halves(corners), `progress ${i / 240}`); }
  once.dispose(); corners.dispose();
});

test('bake fallback (Strategy/Lead on #1025 row C, condition 3; Finishers\' pick): an opened kill on him with the bake pending plays runThrough, plainDeath where he does not allow it; nothing else changes', () => {
  assert.equal(bakeSafeFinisher('opened', 1, true), 'runThrough');
  assert.equal(bakeSafeFinisher('opened', 1, true, (f) => f !== 'runThrough'), 'plainDeath');
  assert.equal(bakeSafeFinisher('opened', 1, false), 'opened', 'no bake pending: the pick stands');
  assert.equal(bakeSafeFinisher('opened', 0, true), 'opened', 'the hero\'s own death is never his bake');
  for (const f of ['splitCrown', 'decapitation', 'runThrough', 'plainDeath', null] as const) assert.equal(bakeSafeFinisher(f, 1, true), f);
});

test('runThrough forced (Strategy 22:27 via Lead): the Nightborn and the Dwarf closed helms at L8–L10, full and phone, take no bake and play runThrough; every other look is untouched', () => {
  for (const opp of ['nightborn', 'dwarf']) for (const level of [8, 9, 10]) for (const phone of [false, true])
    assert.ok(runThroughForced(`/looks/${opp}-L${level}${phone ? '-phone' : ''}.glb`), `${opp} L${level}${phone ? ' phone' : ''}`);
  for (const url of ['/looks/nightborn-L2.glb', '/looks/nightborn-L7-phone.glb', '/looks/goblin-L10.glb', '/looks/knight-L9.glb', '/looks/plaguedoctor-L8-phone.glb', undefined])
    assert.ok(!runThroughForced(url), String(url));
  assert.equal(rankLookFor('nightborn', 10, true), '/looks/nightborn-L10-phone.glb', 'the forced list reads the same URLs the stream fetches');
});

test('pre-swap bake scope (Lead on 151e50e8): the Knight and the Plague Doctor (plainDeath only) schedule no bake, their swap unchanged; the Goblin and Nightborn L2–L7 do; forced ranks and ?lookbake=off never', () => {
  for (const opp of ['knight', 'plaguedoctor'] as const) for (const level of [2, 8, 10]) for (const phone of [false, true])
    assert.equal(lookBakes(supportsFinishers(opp, 'opened'), rankLookFor(opp, level, phone)), false, `${opp} L${level}${phone ? ' phone' : ''}`);
  for (const [opp, level] of [['goblin', 8], ['goblin', 2], ['nightborn', 5], ['nightborn', 7]] as const)
    assert.equal(lookBakes(supportsFinishers(opp, 'opened'), rankLookFor(opp, level)), true, `${opp} L${level}`);
  assert.equal(lookBakes(supportsFinishers('nightborn', 'opened'), rankLookFor('nightborn', 10)), false, 'forced rank: no bake');
  assert.equal(lookBakes(supportsFinishers('goblin', 'opened'), rankLookFor('goblin', 8), true), false, '?lookbake=off: no bake');
});

// An image's pixel size from its header (PNG, JPEG, WebP): the gate's row 5b counts each look map as uploaded, RGBA with mips (characters.ts).
function imageSize(b: Buffer): [number, number] {
  if (b.readUInt32BE(0) === 0x89504e47) return [b.readUInt32BE(16), b.readUInt32BE(20)];
  if (b.toString('ascii', 0, 4) === 'RIFF') {
    const kind = b.toString('ascii', 12, 16);
    if (kind === 'VP8X') return [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)];
    if (kind === 'VP8L') { const v = b.readUInt32LE(21); return [1 + (v & 0x3fff), 1 + ((v >> 14) & 0x3fff)]; }
    return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff];   // VP8
  }
  for (let i = 2; i < b.length;) {   // JPEG: walk the segments to the frame header
    const marker = b[i + 1]!, length = b.readUInt16BE(i + 2);
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)];
    i += 2 + length;
  }
  throw new Error('unknown image');
}
test('row 5b static (Lead 23:5x, after Armour\'s sweep found Nightborn L3–L7 at 45.3 MiB that a gate sampling L2/L8/L10 missed): every shipped look file, every rank, full and phone, uploads ≤ 22 MiB of maps (a full-tier file of a PHONE_LOOKS set: 96 MiB, Strategy 2026-09-30)', async () => {
  // The tier split, pinned (a mutation that lets a phone file or a no-LOD set's file take the desktop cap fails here, not only on a heavy file).
  assert.equal(lookMapCapMiB('dwarf', true), 22, 'a -phone file keeps the phone VRAM cap');
  assert.equal(lookMapCapMiB('dwarf', false), 96, 'a full-tier file of a set with phone LODs: desktop cap');
  assert.equal(lookMapCapMiB('goblin', false), 22, 'a set without LODs: the phone fetches this file, so 22');
  assert.equal(lookMapCapMiB('goblin', true), 22);
  // A build-shared map (../assets/textures/<sha256>) is emitted by vite.config.mjs from the base rigs; the look still uploads it, so read it from his own base rig the way the build does.
  const shared = await buildShared();
  for (const [opponent, levels] of Object.entries(SHIPPING_LOOKS)) for (const level of levels) for (const phone of PHONE_LOOKS.has(opponent) ? [false, true] : [false]) {
    const url = rankLookFor(opponent, level, phone)!, glb = readFileSync(new URL(`../public${url}`, import.meta.url));
    const jsonLength = glb.readUInt32LE(12), json = JSON.parse(glb.toString('utf8', 20, 20 + jsonLength)), bin = 20 + jsonLength + 8;
    const sources = new Set<number>((json.textures ?? []).map((t: { source?: number; extensions?: Record<string, { source: number }> }) => t.extensions?.EXT_texture_webp?.source ?? t.source));
    let bytes = 0;
    for (const s of sources) {
      const image = json.images[s], view = json.bufferViews[image.bufferView], key = image.uri?.match(/[0-9a-f]{64}/)?.[0];
      const data = key ? shared.get(key) : glb.subarray(bin + (view.byteOffset ?? 0), bin + (view.byteOffset ?? 0) + view.byteLength);
      assert.ok(data, `${url}: ${image.uri} is not a map of his base rig`);
      const [w, h] = imageSize(data); bytes += w * h * 4 * 4 / 3;
    }
    const cap = lookMapCapMiB(opponent, phone);
    assert.ok(bytes / 2 ** 20 <= cap, `${url}: ${(bytes / 2 ** 20).toFixed(1)} MiB of maps (cap ${cap})`);
  }
});
