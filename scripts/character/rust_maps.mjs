// The goblin's bracer: rusted iron, 512 px (Lead 2026-09-25, option A: the loot budget stays 3.5 MB, so no 1K set).
// node scripts/character/rust_maps.mjs → src/assets/source/loot/rust_iron_color.jpg + rust_iron_orm.jpg
// Deterministic, no inputs. The files sit beside the baked families (Dwarf, Knight) so loot.glb picks them up as `RustIron`
// through the same path; manifest_goblin.json points his own fight build at the same two files.
// Tiles in u (the sleeve's circumference) and v. ORM is glTF's: R occlusion (unused, white), G roughness, B metalness.
import fs from 'node:fs/promises';
import jpeg from 'jpeg-js';

const SIZE = 512, out = 'src/assets/source/loot';
const hash = (x, y, seed) => ((Math.imul(x ^ seed, 374761393) ^ Math.imul(y + seed, 668265263)) >>> 0) % 1021 / 1021;
const smooth = t => t * t * (3 - 2 * t);
function noise(x, y, cells, seed) {   // periodic value noise: `cells` lattice cells across the tile, wraps at the edge
  const fx = x / SIZE * cells, fy = y / SIZE * cells, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = smooth(fx - x0), ty = smooth(fy - y0);
  const at = (i, j) => hash(((i % cells) + cells) % cells, ((j % cells) + cells) % cells, seed);
  const a = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * tx, b = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * tx;
  return a + (b - a) * ty;
}
const fbm = (x, y, seed) => noise(x, y, 4, seed) * .5 + noise(x, y, 8, seed + 1) * .25 + noise(x, y, 16, seed + 2) * .15 + noise(x, y, 64, seed + 3) * .1;
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

const IRON = [74, 70, 66], RUST = [118, 62, 30], SCALE = [70, 36, 20];   // bare dark iron, orange-brown rust, the dark flaking scale
const color = Buffer.alloc(SIZE * SIZE * 4), orm = Buffer.alloc(SIZE * SIZE * 4);
for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
  const r = Math.min(1, Math.max(0, (fbm(x, y, 11) - .3) / .18));   // rust coverage: most of the sleeve, bare iron worn through in patches
  const flake = Math.max(0, fbm(x, y, 29) - .5) / .35, grain = hash(x, y, 7) - .5;
  let c = mix(IRON, RUST, r); c = mix(c, SCALE, flake * r * .8);
  c = c.map(v => Math.round(Math.min(255, Math.max(0, v * (1 + grain * .18)))));
  const i = (y * SIZE + x) * 4;
  color.set([c[0], c[1], c[2], 255], i);
  orm.set([255, Math.round(255 * (.5 + r * .42 + grain * .04)), Math.round(255 * (.75 - r * .65)), 255], i);   // rust: rough .92, metal .1; bare iron: .5 / .75
}
await fs.writeFile(`${out}/rust_iron_color.jpg`, jpeg.encode({ data: color, width: SIZE, height: SIZE }, 82).data);
await fs.writeFile(`${out}/rust_iron_orm.jpg`, jpeg.encode({ data: orm, width: SIZE, height: SIZE }, 82).data);
console.log('rust maps →', out);
