// World's Pit intake (Lead 2026-09-30): GPT's source sets in docs/character-references/pit/ → the ship copies the Pit and Web load from
// public/pit/ (measured by scripts/check-budget.mjs PIT_ASSETS, #1159). Props: no quantisation here (it moves scale onto the node, which
// prop() ignores); scripts/pit-meshopt-filter.mjs compresses them next. Maps to 512² WebP (768 for the gate), one mesh
// kept (the gate is split into arch + bars nodes first: scripts/pit-gate-split.mjs), file named after its triangle cap (bull-skull, rack, table, sconce, gate, chest-a/-b). Stone: each 1024 PNG to a 512² WebP
// (the phone path; a 1024 desktop set only on the carve-out). Needs @gltf-transform/cli and sharp, which are not repo dependencies:
//   npm i --no-save @gltf-transform/cli@4 sharp && node scripts/pit-ship.mjs && node scripts/pit-meshopt-filter.mjs public/pit/props/*.glb
//   (run on the VPS; heavy for the shared Mac)
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { splitGate } from './pit-gate-split.mjs';
import sharp from 'sharp';

const SRC = 'docs/character-references/pit', PROPS = 'public/pit/props', STONE = 'public/pit/stone';
// Source folder → ship name (the ship name is the triangle-cap key in check-budget.mjs).
const PROP_NAMES = { 'bull-skull': 'bull-skull', 'weapon-rack': 'rack', table: 'table', 'torch-sconce': 'sconce', gate: 'gate', 'chest-banded': 'chest-a', 'chest-plain': 'chest-b' };
// Stone maps: [source, ship name, size, quality]. Colour maps lossy; the normal map near-lossless so the slopes keep their direction.
const STONE_MAPS = ['wall', 'vault', 'floor'].flatMap((s) => [[`${s}-albedo`, 512, 82], [`${s}-normal`, 512, 92], [`${s}-roughness`, 512, 80], [`${s}-ao`, 512, 80]])
  .concat([['wall-damp-mask', 256, 80], ['floor-path-mask', 256, 80], ['torch-soot', 256, 85]]);

// The lazy extra/ pack (Lead's ruling 2026-09-30): GPT's dressing and gate machinery, fetched after the Pit's ready and OFF the eager sums
// (check-budget PIT_EXTRA). Source docs/character-references/pit/extra/<name>/<name>.glb -> public/pit/extra/<name>.glb, every map 512 WebP.
// Node names are kept (the Pit animates gate-machinery's Drum, Counterweight and chains by name), so the same optimize flags as the props.
const EXTRA = 'public/pit/extra', EXTRA_NAMES = ['coal-brazier', 'chained-manacles', 'whetstone-wheel', 'broken-weapons', 'straw-bedding', 'water-bucket', 'gate-machinery'];

mkdirSync(PROPS, { recursive: true }); mkdirSync(STONE, { recursive: true }); mkdirSync(EXTRA, { recursive: true });
const tool = (...args) => execFileSync('npx', ['--no-install', 'gltf-transform', ...args], { stdio: ['ignore', 'ignore', 'inherit'], timeout: 300_000 });
for (const [source, ship] of Object.entries(PROP_NAMES)) {
  let input = `${SRC}/props/${source}/${source}.glb`;
  const out = `${PROPS}/${ship}.glb`;
  try { statSync(input); } catch { console.log(`${ship}: no source (${input}), skipped`); continue; }
  if (ship === 'gate') {   // the live gate opens on foot: the bars leave the arch as a node of their own (scripts/pit-gate-split.mjs)
    const split = join(mkdtempSync(join(tmpdir(), 'pit-gate-')), 'gate-split.glb');
    console.log('gate split:', JSON.stringify(await splitGate(input, split)));
    input = split;
  }
  const size = ship === 'gate' ? 768 : 512;
  tool('optimize', input, out, '--compress', 'false', '--texture-compress', 'webp', '--texture-size', String(size),
    '--simplify', 'false', '--join', 'false', '--flatten', 'false', '--instance', 'false', '--weld', 'false');
  console.log(`${ship}: ${statSync(out).size} B`);
}
for (const name of EXTRA_NAMES) {
  const input = `${SRC}/extra/${name}/${name}.glb`, out = `${EXTRA}/${name}.glb`;
  try { statSync(input); } catch { console.log(`${name}: no source (${input}), skipped`); continue; }
  tool('optimize', input, out, '--compress', 'false', '--texture-compress', 'webp', '--texture-size', '512',
    '--simplify', 'false', '--join', 'false', '--flatten', 'false', '--instance', 'false', '--weld', 'false');
  console.log(`extra/${name}: ${statSync(out).size} B`);
}
for (const [name, size, quality] of STONE_MAPS) {
  const input = `${SRC}/materials/${name}.png`, out = `${STONE}/${name}.webp`;
  try { statSync(input); } catch { console.log(`${name}: no source, skipped`); continue; }
  await sharp(input).resize(size, size, { kernel: 'lanczos3' }).webp({ quality, effort: 6, alphaQuality: 90 }).toFile(out);
  console.log(`${name}: ${statSync(out).size} B`);
}
