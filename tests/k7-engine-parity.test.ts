// K7 EXIT TEST (Strategy 2026-10-09, written by World): a zone reaches the fight engine ONLY through src/fight/index.ts, for every row of the 22-row parity checklist that is a code path
// (rows 1-16 and 20; 17 and 22 are by design, 18 and 19 are server tick, post K). It FAILS on any non-test file under origins/ that imports a combat-owned src/ module directly, and on a
// zone-own copy of engine code. What fails today is pinned below, each entry with the slice that removes it; the lists only shrink (a new violation fails, and a listed one that is gone
// fails until you delete the line). Zone 2 (and any zone N >= 2) must be data: no src/ import, only `import type`, under 300 lines. Classified by module NAME, so moving a module (src/audio/creature.ts
// -> src/fight/sound/creature.ts) does not change its row. An import of a src/ module that is neither a row nor ALLOWED fails: classify it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

type Own = 'K2' | 'P1/P2' | 'K11' | 'K12' | 'server';   // K2: rows 1-7 land with Release K; P1/P2: Combat's fx extraction + Zone 1 per-pair fx; K11: creature dressing; K12: catalogue as runtime source; server: node-run server code that cannot take the renderer-bearing index (Duels & Backend)
// module name -> [parity row, owner of the slice that moves the zone's use behind src/fight/index.ts]
export const ROWS: Record<string, readonly [number, Own]> = {
  duel: [1, 'K2'], detmath: [1, 'K2'], sim: [1, 'K2'], record: [1, 'K2'], replay: [1, 'K2'], 'play-radius': [1, 'K2'], 'stab-rule': [1, 'K2'], combat: [1, 'K2'],
  ai: [2, 'K2'],
  moves: [3, 'K2'], 'gear-stats': [3, 'K2'], gambit: [3, 'K2'], stance: [3, 'K2'], twist: [3, 'K2'],
  speeds: [4, 'K2'],
  input: [5, 'K2'],
  characters: [6, 'K2'],
  mobkit: [7, 'K11'], 'beast-scale': [7, 'K11'],
  gore: [8, 'P1/P2'], 'blood-style': [8, 'P1/P2'], 'blood-edge': [8, 'P1/P2'], 'finisher-blood': [8, 'P1/P2'],
  finishers: [9, 'P1/P2'], execution: [9, 'P1/P2'], hamstrung: [9, 'P1/P2'], 'severed-head': [9, 'P1/P2'], 'dropped-weapon': [9, 'P1/P2'],
  'hit-impact': [10, 'P1/P2'], armfeel: [10, 'P1/P2'], 'armfeel-fx': [10, 'P1/P2'], 'clash-sparks': [10, 'P1/P2'], 'foot-dust': [10, 'P1/P2'], scene: [10, 'P1/P2'],
  'camera-kick': [11, 'P1/P2'], camera: [11, 'P1/P2'],
  feedback: [12, 'P1/P2'], cues: [12, 'P1/P2'], creature: [12, 'P1/P2'], breath: [12, 'P1/P2'], special: [12, 'P1/P2'], 'power-word': [12, 'P1/P2'], 'armfeel-sound': [12, 'P1/P2'],
  signature: [13, 'P1/P2'], 'skill-impact': [13, 'P1/P2'],
  hud: [14, 'P1/P2'], 'stance-panel': [14, 'P1/P2'], fatigue: [14, 'P1/P2'],
  'rank-look': [15, 'K11'],
  quality: [16, 'P1/P2'], 'colour-grade': [16, 'P1/P2'], 'warm-gate': [16, 'P1/P2'],
  roster: [20, 'K12'], legends: [20, 'K12'],
  warrior: [6, 'K2'], goblin: [7, 'K11'], knight: [7, 'K11'], pitborn: [7, 'K11'], witch: [7, 'K11'],   // body files (src/assets/*.glb) imported by name: the actor loads them, the zone must not
};
// ACCOUNT / ITEM-LEDGER UI (not combat), by EXACT path (Lead 2026-10-09, #2016 HOLD): the gear screen and the writer call talk to the account and the item ledger, not to the fight. Each line is one file -> one module,
// never a folder or a module wildcard; the post-K7 ledger unification revisits them. Combat stays strict: nothing from a combat module outside src/fight.
const LEDGER_UI: readonly string[] = [];   // EMPTY since CORE 1a (the account/ledger modules live in src/core, behind src/core/index.ts and server.ts; tests/core-boundary.test.ts pins them): nothing may be added back
// Not engine rows: the Pit's FLOW (pinned by origins-flow-boundary.test.ts), identity/economy data, and page chrome.
const ALLOWED = new Set(['arena', 'arena-themes', 'match', 'scorecard', 'trial', 'career', 'backoff', 'zoom-guard', 'style', 'roll', 'index']);
// Server-run code (node, no three.js): it verifies and rewards fights from the same sim, so it cannot take the renderer-bearing index. Its door is src/fight/server.ts (re-exports only, no renderer).
const SERVER_DIRS = ['origins/server/', 'origins/contracts/', 'origins/luck/', 'origins/encounters/', 'origins/inventory/', 'origins/progression/', 'origins/feuds/', 'origins/world/', 'origins/region1/', 'origins/mobs/', 'origins/shared/', 'origins/zones/loader.ts', 'origins/preview/mobs.ts'];   // mobs.ts is page data the writer also loads (world-spawns.ts)

// Today's failures, "row | owner | file -> module". Remove a line when its import goes.
const KNOWN: readonly string[] = [
];
const KNOWN_COPIES: readonly string[] = [
];

// Row 7: a zone draws a creature from the engine's pose (actorPose of the duel, `fall` progress); it must not keep its own windup / hit-pulse / fall timers (src/fight/world-combat.ts owns hurtT, fallT, windupT, swingT).
const ownCreatureTiming = (text: string): boolean => /\b\w*(lunge|pulse|hurt|fall|windup|swing|death|dying)\w*(T|Ms|_S|_MS|Timer|Time)\b/i.test(text);

const IMPORT = /(?:^\s*(?:import|export)\b[^'"]*?\bfrom\s+|^\s*import\s+|\bimport\()\s*['"]([^'"]+)['"]/gm;
const files = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? files(join(dir, e.name)) : /\.(ts|mjs)$/.test(e.name) && !/\.test\.(ts|mjs)$/.test(e.name) ? [join(dir, e.name)] : []);
const moduleOf = (spec: string): string | null => /(^|\/)src\//.test(spec) && !/(^|\/)src\/core\//.test(spec) ? spec.replace(/\?.*$/, '').replace(/\.[a-z]+$/, '').split('/').pop()! : null;
const SERVER_DOOR = /(^|\/)src\/fight\/server\.ts$/;   // the node-safe door: server-run code only (renderer-free re-exports)
const fromFightIndex = (spec: string, file = ''): boolean => /(^|\/)src\/fight\/index\.ts$/.test(spec) || (SERVER_DOOR.test(spec) && SERVER_DIRS.some((d) => file.startsWith(d)));

export function violations(read: (f: string) => string = (f) => readFileSync(f, 'utf8'), list: readonly string[] = files('origins')): { bad: string[]; unclassified: string[] } {
  const bad: string[] = [], unclassified: string[] = [];
  for (const file of list) for (const spec of new Set([...read(file).matchAll(IMPORT)].map((m) => m[1]!))) {
    const mod = moduleOf(spec); if (!mod || fromFightIndex(spec, file) || /\.(png|webp|ogg|css)(\?.*)?$/.test(spec) || /(^|\/)assets\/loot\.glb(\?.*)?$/.test(spec)) continue;   // loot.glb: an asset URL, not the core's loot.ts
    const row = ROWS[mod]; if (row) bad.push(`${row[0]} | ${SERVER_DIRS.some((d) => file.startsWith(d)) ? 'server' : row[1]} | ${file} -> ${mod}`);
    else if (!ALLOWED.has(mod) && !LEDGER_UI.includes(`${file} -> ${mod}`)) unclassified.push(`${file} -> ${mod}`);
  }
  return { bad: bad.sort((a, b) => a.localeCompare(b, 'en', { numeric: true })), unclassified: unclassified.sort() };
}

test('a zone reaches the engine only through src/fight/index.ts; today\'s failures are pinned and only shrink', () => {
  const { bad, unclassified } = violations();
  assert.deepEqual(unclassified, [], 'a src/ module that is neither a parity row (ROWS) nor ALLOWED: classify it');
  assert.deepEqual(bad.filter((v) => !KNOWN.includes(v)), [], 'a new direct import of an engine module from origins/: go through src/fight/index.ts');
  assert.deepEqual(KNOWN.filter((v) => !bad.includes(v)), [], 'a listed import is gone: delete its line so it cannot come back');
});

test('no zone-own copy of engine code exists (the lists only shrink)', () => {
  const GONE = ['origins/preview/world-combat.ts', 'origins/preview/mob-clips.ts', 'origins/preview/speeds.ts', 'origins/combat/zone1.ts', 'origins/combat/open-fight.ts'];   // moved into src/fight (K2d, K3)
  assert.deepEqual(GONE.filter((f) => existsSync(f)), [], 'an engine file came back under origins/');
  const main = readFileSync('origins/preview/main.ts', 'utf8');
  const copies = [
    ...['wcBars', 'updateBars', 'wcFlash'].filter((id) => new RegExp(`\\b${id}\\b`).test(main)).map((id) => `14 | P1/P2 | origins/preview/main.ts defines ${id}`),
    ...files('origins').filter((f) => ownCreatureTiming(readFileSync(f, 'utf8'))).map((f) => `7 | P1/P2 | ${f} defines its own creature lunge / hit pulse / fall timing`),
  ].sort();
  assert.deepEqual(copies.filter((c) => !KNOWN_COPIES.includes(c)), [], 'a new zone-own copy of engine behaviour');
  assert.deepEqual(KNOWN_COPIES.filter((c) => !copies.includes(c)), [], 'a listed copy is gone: delete its line');
});

test('Zone 2 and later zones are data: no src/ import, only `import type`, under 300 lines', () => {
  const zones = readdirSync('origins/zones', { withFileTypes: true }).filter((e) => e.isDirectory() && /^zone(\d+)$/.test(e.name) && Number(e.name.slice(4)) >= 2).map((e) => join('origins/zones', e.name));
  assert.ok(zones.length >= 1, 'zone2 exists');
  for (const dir of zones) {
    const fs = files(dir), text = fs.map((f) => readFileSync(f, 'utf8'));
    assert.deepEqual(fs.filter((_, i) => [...text[i]!.matchAll(IMPORT)].some((m) => /(^|\/)src\//.test(m[1]!))), [], `${dir}: a zone imports nothing from src/`);
    assert.deepEqual(fs.filter((_, i) => /^\s*import\s+(?!type\b)[^'"]*from\s/m.test(text[i]!) && !/^\s*import\s+(?!type\b)[^'"]*from\s+'\.\.\/\.\.\/(mobs|preview)\/[a-z-]+\.ts'/m.test(text[i]!)), [], `${dir}: a zone's runtime imports are data helpers only`);
    assert.ok(text.join('\n').split('\n').length < 300, `${dir}: under 300 lines`);
  }
});

test('the row 7 detector flags a zone-own creature timer and passes the engine-driven view (mutation)', () => {
  const real = readFileSync('origins/preview/mobs-view.ts', 'utf8');
  assert.equal(ownCreatureTiming(real), false, 'mobs-view.ts takes its pose from the engine');
  assert.equal(ownCreatureTiming(real + '\nlet fallT = 0; fallT += dt;'), true, 'a pasted fall timer is flagged');
  assert.equal(ownCreatureTiming(real + '\nconst windupMs = 400;'), true, 'a pasted windup timer is flagged');
  assert.equal(ownCreatureTiming(real + '\nlet lungeT = 0;'), true, 'a renamed lunge timer is flagged');
  assert.equal(ownCreatureTiming(real + '\nlet deathTimer = 0;'), true, 'a renamed death timer is flagged');
});

test('the checker sees static, re-export and dynamic imports, and passes the door', () => {
  const src: Record<string, string> = { 'origins/a.ts': "import { x } from '../src/fight/duel.ts';\nexport { y } from '../src/fight/index.ts';\nconst z = await import('../src/audio/creature.ts');\nimport '../src/mystery.ts';\n" };
  const v = violations((f) => src[f]!, ['origins/a.ts']);
  assert.deepEqual(v.bad, ['1 | K2 | origins/a.ts -> duel', '12 | P1/P2 | origins/a.ts -> creature']);
  assert.deepEqual(v.unclassified, ['origins/a.ts -> mystery']);
});

// Row 5 (controls), the page side: the controls live in src/fight/input.ts (Strategy 2026-10-10: "controls move into the engine"), so no page module outside src/fight takes it directly: it goes through the door (the zones are already held by ROWS above).
const importsInputDirectly = (text: string): boolean => [...text.matchAll(IMPORT)].some((m) => /(^|\/)input(\.ts)?$/.test(m[1]!));
test('row 5: nothing outside src/fight imports the input module except through src/fight/index.ts (mutation)', () => {
  const pages = files('src').filter((f) => !f.startsWith(join('src', 'fight') + '/'));
  assert.deepEqual(pages.filter((f) => importsInputDirectly(readFileSync(f, 'utf8'))), [], 'a page module imports input directly: go through src/fight/index.ts');
  assert.ok(existsSync('src/fight/input.ts') && !existsSync('src/input.ts'), 'the controls live in src/fight/input.ts');
  const main = readFileSync('src/main.ts', 'utf8');
  assert.equal(importsInputDirectly(main), false);
  assert.equal(importsInputDirectly(main + "\nimport { createInput } from './input.ts';"), true, 'a direct ./input.ts import is flagged');
  assert.equal(importsInputDirectly(main + "\nimport { createInput } from './fight/input.ts';"), true, 'a direct ./fight/input.ts import is flagged');
});

// The goal itself: every parity row reaches the engine through src/fight only. KNOWN and KNOWN_COPIES are empty; it can never fail unseen.
test('K7 EXIT: nothing is pinned, every parity row reaches the engine through src/fight only', () => {
  assert.deepEqual(KNOWN, [], `${KNOWN.length} direct engine imports left`);
  assert.deepEqual(KNOWN_COPIES, [], `${KNOWN_COPIES.length} zone-own copies left`);
});

test('the node-safe door src/fight/server.ts is for server-run code only, and its whole closure is renderer-free', () => {
  const door = (f: string) => violations((p) => (p === f ? "import { x } from '../../src/fight/server.ts';\n" : ''), [f]);
  assert.deepEqual(door('origins/server/a.ts').bad, [], 'server code may take the node door');
  assert.deepEqual(door('origins/preview/a.ts').unclassified, ['origins/preview/a.ts -> server'], 'a page may not');
  const closure = (start: string, read: (f: string) => string): { files: string[]; bare: string[] } => {
    const seen = new Set<string>(), bare = new Set<string>();
    const walk = (f: string): void => {
      if (seen.has(f)) return; seen.add(f);
      for (const m of read(f).matchAll(IMPORT)) { const spec = m[1]!; if (!spec.startsWith('.')) { bare.add(spec); continue; } walk(join(f, '..', spec)); }
    };
    walk(start); return { files: [...seen], bare: [...bare] };
  };
  const RENDERER = /\/(hud|world-combat|world|open|scene|quality|audio|sound)[/.]/;
  const bad = (c: { files: string[]; bare: string[] }) => [...c.bare.filter((s) => !s.startsWith('node:')), ...c.files.filter((f) => RENDERER.test(f))];
  assert.deepEqual(bad(closure('src/fight/server.ts', (f) => readFileSync(f, 'utf8'))), [], 'the node door pulls no package (three.js), HUD, world loop or audio');
  const mutant = (add: string) => bad(closure('src/fight/server.ts', (f) => readFileSync(f, 'utf8') + (f === 'src/fight/server.ts' ? `\n${add}\n` : '')));
  assert.notDeepEqual(mutant("export * from './hud.ts';"), [], 'the check fails when the door re-exports the HUD');
  assert.notDeepEqual(mutant("export * from './world.ts';"), [], 'the check fails when the door re-exports the world loop');
  assert.notDeepEqual(mutant("import * as T from 'three';"), [], 'the check fails when the door pulls three');
});

// The camera row (Strategy 2026-10-10): a page under origins/ never places the camera; the engine's follow camera (src/fight/follow-camera.ts) and duel rig (src/fight/camera.ts) do.
const CAMERA_PLACED = /\bcamera\.(position\.(set|copy|lerp|add\w*|sub\w*)|lookAt)\s*\(/;
const sources = (d: string): string[] => readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? sources(join(d, e.name)) : /\.(ts|mjs)$/.test(e.name) && !/\.test\./.test(e.name) ? [join(d, e.name)] : []);
test('K7 camera row: nothing under origins/ places the camera (camera.position / lookAt); it goes through src/fight', () => {
  assert.deepEqual(sources('origins').filter((f) => CAMERA_PLACED.test(readFileSync(f, 'utf8'))), [], 'a zone page that moves the camera itself is a zone-own copy of engine code');
  assert.ok(CAMERA_PLACED.test('camera.position.copy(camAt); camera.lookAt(look);'), 'the detector sees a placed camera (mutation)');
  assert.ok(CAMERA_PLACED.test('camera.position.set(0, 2, 5)'), 'and a set');
  assert.ok(!CAMERA_PLACED.test('followCam.update(dt, state)'), 'and passes the engine call');
});

// Camera limits come only from the zone row: the page passes `loadZone().fields['camera.passage']` and holds no camera number itself (Zone 2 sets none).
test('K7 camera limits row: createFollowCamera in origins/preview/main.ts is called with zone data, not literals', () => {
  const call = (src: string) => /createFollowCamera\(camera,\s*\{[^;]*\}\)/.exec(src)?.[0] ?? '';
  const main = readFileSync('origins/preview/main.ts', 'utf8');
  assert.ok(call(main), 'the page builds the follow camera');
  // Strip index accesses (`x[1]`, `?.[1]`: a [digit] right after a name, `)`, `]` or `.`) first; then ANY number left is a camera limit, `.5` and a lone `[5]` array literal included.
  const literal = (src: string) => /(?<![\w$])\.?\d/.test(src.replace(/(?<=[\w)\].])\[\d+\]/g, ''));
  assert.ok(!literal(call(main)), `no number in the call: ${call(main)}`);
  for (const bad of ['{ open: { back: 3.4 } }', '{ open: { back: .5 } }', '{ open: [5] }', '{ open: x + [5] }']) assert.ok(literal(call(`createFollowCamera(camera, ${bad});`)), `a literal is seen (mutation): ${bad}`);
  assert.ok(!literal(call('createFollowCamera(camera, { open: pick(/[?&]camera=([a-z])\\b/.exec(location.search)?.[1], zone[2]) });')), 'an index is not a number literal');
});

// Strategy's donor verdict (2026-10-10): MAX_ATTACKERS is never exceeded, and no other cap can alias it. The cap lives in src/fight/attackers.ts (a leaf, so the node-safe door's closure does not pull the world loop).
test('MAX_ATTACKERS is never exceeded: N creatures on one hero put at most MAX_ATTACKERS duels on him at any tick', async () => {
  const { MAX_ATTACKERS } = await import('../src/fight/attackers.ts');
  const W = await import('../src/fight/world.ts');
  assert.equal(W.MAX_ATTACKERS, MAX_ATTACKERS, 'world.ts re-exports the one cap');
  for (const n of [4, 5, 7]) {
    const foes = Array.from({ length: n }, (_, i) => { const a = (i / n) * Math.PI * 2, r = 5 + (i % 2); return W.creature(`c${i}`, 'wolf', Math.sin(a) * r, Math.cos(a) * r, a + Math.PI, 3); });
    const hero = W.player('hero', 0, 0, 0); hero.health = hero.maxHealth = 1e6;
    let w = W.newWorld([hero, ...foes]), peak = 0;
    for (let k = 0; k < 60 * 30; k++) {
      w = W.stepCombat(w, { hero: { x: 0, z: 0, attack: k % 25 === 0 ? 'light' : null } }, 1 / 60).world;
      peak = Math.max(peak, W.pairs(w).filter((p) => p.player === 'hero').length);
      assert.ok(peak <= MAX_ATTACKERS, `${n} creatures: ${peak} duels on one hero at tick ${k}`);
    }
    assert.equal(peak, MAX_ATTACKERS, `${n} creatures do reach the cap (the test is not vacuous)`);
  }
});

test('no second attacker cap exists outside src/fight/attackers.ts: no numeric constant, parameter default or field named *attackers* / *tokens* / *ATTACKER* / *TOKEN*', () => {
  const CAPS = [
    /\b(?:const|let|var)\s+([A-Za-z_]*(?:ATTACKER|TOKEN)S?[A-Za-z0-9_]*)\s*(?::[^=\n]+)?=\s*-?\d/g,   // a constant, typed or renamed
    /\b(\w*(?:attackers|tokens)\w*)\s*(?::\s*number\s*)?=\s*-?\d/gi,   // a parameter default (startStreams(duels, tokens = 4))
    /\b((?:max)?(?:attackers|tokens))\s*:\s*-?\d/gi,   // an object field ({ tokens: 4 })
  ];
  const walk = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? (e.name === 'node_modules' ? [] : walk(join(dir, e.name))) : /\.(ts|mjs)$/.test(e.name) && !/\.test\.ts$/.test(e.name) ? [join(dir, e.name)] : []);
  const hits = (read: (f: string) => string) => ['src', 'origins'].flatMap(walk).flatMap((f) => CAPS.flatMap((re) => [...read(f).matchAll(re)].map((m) => `${f}: ${m[1]}`))).filter((h) => !h.startsWith('src/fight/attackers.ts'));
  const real = (f: string) => readFileSync(f, 'utf8');
  assert.deepEqual(hits(real), [], 'one attacker cap: src/fight/attackers.ts MAX_ATTACKERS');
  const mutate = (file: string, add: string) => hits((f) => real(f) + (f === file ? `\n${add}\n` : ''));
  assert.notDeepEqual(mutate('src/fight/pack.ts', 'export const TOKENS = 3;'), [], 'the check fails when pack.ts declares its own TOKENS');
  assert.notDeepEqual(mutate('src/fight/ai.ts', 'const MAX_ATTACKERS_2: number = 4;'), [], 'the check fails on a typed, renamed cap');
  assert.notDeepEqual(mutate('src/fight/pack.ts', 'export const again = (duels: number[], tokens = 4) => duels;'), [], 'the check fails on a literal parameter default (the Auditor\'s LOW on #2129)');
  assert.notDeepEqual(mutate('src/fight/pack.ts', 'export const row = { tokens: 4 };'), [], 'the check fails on an object field');
  assert.deepEqual(mutate('src/fight/pack.ts', 'let fightToken = 0;'), [], 'a singular counter (fightToken) is not a cap');
});
