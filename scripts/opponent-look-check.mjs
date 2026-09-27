// Opponent look check (docs/briefs/tier-looks-runtime.md, the set rule): dress an opponent with his carriers through the game's own path
// (characters.ts buildWarriors → opponent.wear(carried ∩ kitWorn), exactly as scene.ts dress() does) and print every draw of his left
// visible and every draw the dressing hid, with triangle counts, then hold the result against the rule's OFF / STAYS table. No browser,
// no build: Node parses the GLBs as the tests do (geometry, rig, material names; images dropped).
//   node scripts/opponent-look-check.mjs [--opponent veteran] [--tier Champion] [--carriers src/assets/loot/carriers-veteran.glb] [--strict]
// --strict exits 1 when a draw the rule turns OFF is still visible, or a draw it keeps is hidden.
import { readFileSync } from 'node:fs';
import { Mesh } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { buildWarriors, lootIds, lootPiecesOf, lootWorn } from '../src/characters.ts';
import { kitWorn } from '../src/loot.ts';
import { OPPONENTS, weaponOf } from '../src/moves.ts';

// The set rule's table for the rigs whose look is one fused CreatureBody (tier-looks-runtime.md). OFF must be hidden under a tier look,
// STAYS must stay visible; the weapon draws stay too. Built rigs hide by a material list and are added here as their first look lands.
const RULE = {
  veteran: { off: ['CreatureBody', 'Bronze.Helmet'], stays: ['Face', 'Photo', 'PhotoEyes', 'PhotoTeeth'] },
};

const arg = (name, fallback) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : fallback; };
const opponent = arg('--opponent', 'veteran'), tier = arg('--tier', 'Champion'), strict = process.argv.includes('--strict');
const carriersPath = arg('--carriers', `src/assets/loot/carriers-${opponent}.glb`);

async function parse(path) {
  const bytes = readFileSync(path), size = bytes.readUInt32LE(12), json = JSON.parse(bytes.subarray(20, 20 + size).toString());
  json.images = []; json.textures = []; json.materials = (json.materials ?? []).map((m) => ({ name: m.name }));
  json.buffers[0].uri = 'data:application/octet-stream;base64,' + bytes.subarray(28 + size).toString('base64');
  globalThis.ProgressEvent ??= class { constructor(_type, fields) { Object.assign(this, fields); } };
  return new GLTFLoader().parseAsync(JSON.stringify(json), '');
}
const tris = (mesh) => (mesh.geometry.index ? mesh.geometry.index.count : mesh.geometry.attributes.position.count) / 3;
const isWeapon = (mesh) => /^Weapon/.test(mesh.material?.name ?? '') || /^WeaponDrawn/.test(mesh.name);

const weapon = OPPONENTS[opponent].weapon, twoHanded = weaponOf(weapon).grip === 'two-hand';
const { opponent: rig } = buildWarriors(await parse('src/assets/warrior.glb'), await parse(`src/assets/${opponent}.glb`), ['longsword', weapon]);
const own = []; rig.anchor.traverse((o) => { if (o instanceof Mesh) own.push(o); });
const kit = kitWorn(opponent, twoHanded, tier), carried = lootPiecesOf((await parse(carriersPath)).scene).filter((p) => lootWorn(p, kit));
rig.wear(carried, (id, error) => console.error(`FAILED to wear ${id}: ${error?.message ?? error}`), () => tier);

const row = (m) => ({ name: m.name || '(unnamed)', slot: m.userData.slot ?? '', material: m.material?.name ?? '', tris: tris(m) });
const visibleOwn = own.filter((m) => m.visible).map(row), hiddenOwn = own.filter((m) => !m.visible).map(row);
const worn = []; rig.anchor.traverse((o) => { if (o instanceof Mesh && !own.includes(o)) worn.push({ ...row(o), ids: lootIds(o).join(',') }); });
console.log(`${opponent} at ${tier} (${twoHanded ? 'two' : 'one'}-handed ${weapon}), carriers ${carriersPath}: kit ${kit.join(', ')}`);
console.log(`\nOWN draws still VISIBLE (${visibleOwn.length}):`); console.table(visibleOwn);
console.log(`OWN draws HIDDEN by the dressing (${hiddenOwn.length}):`); console.table(hiddenOwn);
console.log(`WORN look draws (${worn.length}, ${worn.reduce((n, w) => n + w.tris, 0)} tris):`); console.table(worn);

const rule = RULE[opponent], same = (a, b) => a.replace(/[^A-Za-z0-9]/g, '') === b.replace(/[^A-Za-z0-9]/g, '');   // three's loader strips the dots from node names (Bronze.Helmet → BronzeHelmet)
if (!rule) { console.log(`\nNo set-rule table for ${opponent} yet: report only.`); process.exit(0); }
const problems = [
  ...rule.off.filter((n) => visibleOwn.some((d) => same(d.name, n))).map((n) => `OFF but visible: ${n}`),
  ...rule.stays.filter((n) => hiddenOwn.some((d) => same(d.name, n))).map((n) => `STAYS but hidden: ${n}`),
  ...own.filter((m) => isWeapon(m) && !m.visible).map((m) => `weapon hidden: ${m.name}`),
  ...(worn.length ? [] : ['no look draw was worn (check --carriers and the kit ids)']),
];
console.log(problems.length ? `\nSET RULE: FAIL\n  ${problems.join('\n  ')}` : '\nSET RULE: PASS (OFF hidden, STAYS and weapon visible, look worn)');
if (strict && problems.length) process.exit(1);
