// The core modules live in src/fight (C1: duel, ai, sim, moves, combat, play-radius; C2: record, replay, gear-stats, gambit, stance, twist). The old flat paths stay gone: no src/<name>.ts, and no source, test, script or origins file names one as a module specifier.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const CORE = ['duel', 'ai', 'sim', 'moves', 'combat', 'play-radius', 'record', 'replay', 'gear-stats', 'gambit', 'stance', 'twist',
  'armfeel', 'armfeel-fx', 'camera-kick', 'clash-sparks', 'hit-impact', 'foot-dust', 'defence-grade', 'kick-close', 'dropped-weapon', 'execution', 'fatigue', 'fatigue-layer', 'fatigue-preview', 'fatigue-read', 'fatigue-tune', 'hamstrung', 'hamstrung-assets', 'opened', 'opening-pose', 'spectral', 'stance-pose', 'rank-tint', 'skull', 'fx-math',
  'detmath', 'roll', 'stab-rule', 'blade', 'beast-scale',
  'class-special-identity', 'signature-dwarf', 'signature-executioner', 'signature-goblin', 'signature-knight', 'signature-nightborn', 'signature-pitborn', 'signature-plaguedoctor', 'signature-shieldmaiden', 'signature-veteran', 'signature-witch', 'signature', 'special-boss-timing', 'special-class-timing', 'special-fx-boss', 'special-fx-class', 'special-fx-dwarf-shield', 'special-fx-executioner', 'special-fx-goblin', 'special-fx-legion', 'special-fx-nightborn', 'special-fx-pitborn', 'special-fx-quake', 'special-fx-wind', 'special-fx', 'special-gust', 'special-identity', 'special-lighting', 'special-look', 'special-modes', 'special-presentation', 'special-timing', 'special-tithe',
  'loot', 'loot-claims', 'gear-server', 'gear-ledger', 'gear-net', 'weapon-shapes', 'blade-paths', 'shields', 'rank-look', 'night-armour',
  'charge-fx', 'charge-timing', 'nightfall-fx', 'nightfall-timing', 'boss-telegraph', 'miasma-mark', 'witchfire', 'spell-school', 'power-words', 'sparring-special-runtime', 'sparring-specials', 'scorch', 'skill-impact', 'mobkit', 'pack', 'match'];
const ROOTS = ['src', 'tests', 'scripts', 'origins'];
const SKIP = new Set(['node_modules', 'dist', 'artifacts', 'assets', 'public']);

function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out); else if (/\.(ts|tsx|mjs|js)$/.test(e.name)) out.push(p);
  }
  return out;
}

/** Module specifiers in a file's text that resolve to src/<name>.ts (a relative path whose last segment is <name>.ts and whose directory is src). */
export function flatCoreSpecifiers(file: string, text: string, root = process.cwd()): string[] {
  const hits: string[] = [];
  for (const m of text.matchAll(/['"](\.{1,2}\/[^'"\n]*?([\w-]+)\.(?:ts|js))['"]/g)) {
    if (!CORE.includes(m[2]!)) continue;
    const target = path.resolve(path.dirname(file), m[1]!);
    if (path.relative(path.join(root, 'src'), target) === `${m[2]}${path.extname(target)}`) hits.push(m[1]!);
  }
  return hits;
}

test('the old flat core paths are gone: no src/<name>.ts file', () => {
  for (const n of CORE) assert.equal(fs.existsSync(path.join('src', `${n}.ts`)), false, `src/${n}.ts must not exist (it lives at src/fight/${n}.ts)`);
});

test('nothing imports a flat core path', () => {
  const found: string[] = [];
  for (const f of ROOTS.flatMap((r) => (fs.existsSync(r) ? walk(r) : []))) {
    if (f === path.join('tests', 'fight-core-paths.test.ts')) continue;
    for (const s of flatCoreSpecifiers(path.resolve(f), fs.readFileSync(f, 'utf8'))) found.push(`${f} -> ${s}`);
  }
  assert.deepEqual(found, []);
});

test('the scan sees a flat import and ignores the engine one (mutation case)', () => {
  const at = path.resolve('src/main.ts');
  assert.deepEqual(flatCoreSpecifiers(at, "import { a } from './duel.ts'; import { b } from './fight/sim.ts';"), ['./duel.ts']);
  assert.deepEqual(flatCoreSpecifiers(path.resolve('tests/x.test.ts'), "import '../src/combat.ts'; import '../src/fight/combat.ts';"), ['../src/combat.ts']);
});
