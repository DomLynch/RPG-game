// Worn loot on the fight rig (Lead, 2026-09-23): a worn piece must DRAW on the player in a fight, for both loot layers: 'over' (worn on
// top of the player's own draws: dwarf.Greaves) and 'replace' (hides the player's draws in its slot: goblin.Body). The paperdoll can be
// right while the rig is wrong, so this reads the arena, not the journal. A guest ledger is seeded straight into localStorage (no fight
// for a piece, so it is fast and the same every run), the page reloaded with ?debug=1, and the rig's own list of worn draws read from
// #debug's data-worn (scene.ts wornDraws: `name|slot|layer`, ' (hidden)' if detached or invisible) in three states:
// none → legs=dwarf.Greaves → + chest=goblin.Body → a full set (draw counts per slot read from loot.glb, and the player's own draws hidden in every replaced slot). Stills of the figure are kept as the receipt a person looks at. (A pixel diff was
// tried first and is too weak: the greaves are a thin dark band at the fight camera and the idle breath moves more pixels.)
// TRAP (it hid the answer once): `equipped` is keyed by PAPERDOLL key (legs, chest), not slot name (Greaves, Body); cleanLoot silently
// drops a slot-named key and then NOTHING draws — so the seeded ledger is read back and asserted.
// Guest only, nothing sent anywhere. QA_URL points it at a deployed site; unset, it serves this tree's build (run `npm run build` first).
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { preview } from 'vite';

const server = process.env.QA_URL ? null : await preview({ preview: { host: '127.0.0.1', port: 0 } });
const origin = process.env.QA_URL || `http://127.0.0.1:${server.httpServer.address().port}`;
const dir = process.env.WORN_RECEIPT_DIR || 'artifacts/worn-loot'; await fs.mkdir(dir, { recursive: true });
// The player's figure at the fight's opening camera, 390×844 CSS px (measured on live 545ac8ec): the still a person looks at.
const FIGURE = { x: 140, y: 510, width: 110, height: 170 };
// The fourth state is a full set, one piece in every paperdoll body slot: a throw on one piece inside wear() aborts the rest, so a
// single bad piece shows up here as slots with nothing drawn (Goblin's review of #617).
// The crest has its own key since 2026-09-26 (Armour): the full set wears the Centurion's helmet AND crest, both must draw.
const FULL = { head: 'veteran.Helmet', crest: 'veteran.Crest', chest: 'goblin.Body', arms: 'goblin.Arms', hands: 'goblin.Gloves', legs: 'dwarf.Greaves', feet: 'goblin.Boots' };
const STATES = [['none', {}], ['over', { legs: 'dwarf.Greaves' }], ['over+replace', { legs: 'dwarf.Greaves', chest: 'goblin.Body' }], ['full', FULL]];
const SLOT_OF = { head: ['Helmet'], crest: ['Crest'], chest: ['Body'], arms: ['Arms'], hands: ['Gloves'], legs: ['Greaves'], feet: ['Boots'] };
const browser = await chromium.launch({ headless: true, executablePath: chromium.executablePath() });
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 })).newPage();
page.setDefaultTimeout(90000);
const errors = [], lootFetches = []; page.on('pageerror', e => errors.push(String(e)));
let lootGlb = null;   // the loot.glb the page fetched: the full set's expected draw counts are read from THIS file, so a rebuilt file keeps them right
page.on('response', async r => { if (!/\/loot[^/]*\.glb$/.test(new URL(r.url()).pathname)) return; lootFetches.push(r.status()); if (r.ok()) lootGlb = await r.body().catch(() => lootGlb); });
// How many draws each loot id puts on the rig: every mesh node whose ids (its own `<opponent>.<slot>`, or the file's shared-draw map
// pointing at its `~<id>` name) include it. Mirrors lootPiecesOf in src/characters.ts.
const drawsPerId = (glb) => {
  const json = JSON.parse(glb.subarray(20, 20 + glb.readUInt32LE(12)).toString());
  const map = Object.assign({}, ...json.nodes.map((n) => n.extras?.pieces ?? {}));
  const count = {};
  for (const n of json.nodes) if (n.mesh !== undefined && typeof n.extras?.slot === 'string') {
    const own = `${n.extras.opponent}.${n.extras.slot}`, shared = Object.keys(map).filter((id) => map[id] === own);
    for (const id of shared.length ? shared : [own]) count[id] = (count[id] ?? 0) + 1;
  }
  return count;
};
await page.route('**/*sentry.io/**', route => route.abort());
const receipt = { origin, revision: null, states: {}, errors, passed: false };
const ready = async () => {
  await page.waitForFunction(() => document.querySelector('#art-status')?.textContent === '' && document.querySelector('#attack-button')?.getAttribute('aria-disabled') === 'false');
  await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
};
try {
  receipt.revision = await page.request.get(new URL('/release.json', origin).href).then(r => r.json()).catch(() => null);
  await page.goto(new URL('/?opponent=goblin&debug=1', origin).href); await ready();
  for (const [name, equipped] of STATES) {
    await page.evaluate((equipped) => { const key = 'frankendom.fighter.v1'; const p = JSON.parse(localStorage.getItem(key)); p.loot = { owned: Object.values(equipped), equipped }; localStorage.setItem(key, JSON.stringify(p)); }, equipped);
    const fetchesBefore = lootFetches.length;
    await page.reload(); await ready();
    const enter = page.getByRole('button', { name: 'Enter the arena' }); if (await enter.isVisible().catch(() => false)) await enter.tap();
    const kept = await page.evaluate(() => JSON.parse(localStorage.getItem('frankendom.fighter.v1')).loot?.equipped ?? {});
    assert.deepEqual(kept, equipped, `${name}: the page kept the seeded equip (a slot-named key would be dropped here)`);
    // The pieces go on when loot.glb lands, after the rigs (the fight never waits for them): wait for the probe to list them.
    const want = Object.keys(equipped).length;
    await page.waitForFunction((want) => (JSON.parse(document.querySelector('#debug').dataset.worn || '{}').worn ?? []).length >= want, want, { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(300);
    const { worn: draws = [], covered = [] } = await page.evaluate(() => JSON.parse(document.querySelector('#debug').dataset.worn || '{}'));
    await page.screenshot({ path: `${dir}/${name}.png` }); await page.screenshot({ path: `${dir}/${name}-figure.png`, clip: FIGURE });
    receipt.states[name] = { equipped: kept, draws, covered, lootFetched: lootFetches.slice(fetchesBefore) };
  }
  const drawn = (name, slot, layer) => receipt.states[name].draws.some((d) => d.split('|')[1] === slot && d.split('|')[2] === layer && !d.endsWith('(hidden)'));
  assert.deepEqual(receipt.states.none.draws, [], 'nothing worn, nothing drawn');
  assert.ok(drawn('over', 'Greaves', 'over'), `the 'over' greaves draw on the rig: ${JSON.stringify(receipt.states.over.draws)}`);
  assert.ok(drawn('over+replace', 'Body', 'replace'), `the 'replace' body draws on the rig: ${JSON.stringify(receipt.states['over+replace'].draws)}`);
  assert.ok(drawn('over+replace', 'Greaves', 'over'), 'with the body on too, the greaves still draw');
  for (const name of ['over', 'over+replace', 'full']) assert.ok(receipt.states[name].draws.every((d) => !d.endsWith('(hidden)')), `${name}: every worn copy (all meshes of a piece) is attached and visible: ${JSON.stringify(receipt.states[name].draws)}`);
  // A replace piece hides the player's own draws in its slot, and they stay hidden.
  assert.ok(receipt.states['over+replace'].covered.some((c) => c.split('|')[1]?.startsWith('Body')), `the replace body covers the player's own Body draws: ${JSON.stringify(receipt.states['over+replace'].covered)}`);
  for (const name of ['over+replace', 'full']) assert.ok(receipt.states[name].covered.every((c) => !c.endsWith('(shown)')), `${name}: no covered player draw still shows`);
  // The full set: every equipped paperdoll slot has at least one drawn piece (a throw mid-wear() would leave the later ones empty).
  // The full set, by COUNT: every equipped paperdoll slot draws exactly as many meshes as loot.glb carries for its piece, and nothing else
  // draws (a throw mid-wear() leaves later slots short; `.some` would pass on one mesh of a multi-mesh body).
  assert.ok(lootGlb, 'loot.glb was fetched and read');
  const perId = drawsPerId(lootGlb), full = receipt.states.full;
  full.expected = Object.fromEntries(Object.entries(FULL).map(([key, id]) => [key, perId[id] ?? 0]));
  full.counted = Object.fromEntries(Object.keys(FULL).map((key) => [key, full.draws.filter((d) => SLOT_OF[key].includes(d.split('|')[1])).length]));
  for (const [key, id] of Object.entries(FULL)) assert.ok(full.expected[key] > 0, `full set: loot.glb carries ${id} (${key})`);
  assert.deepEqual(full.counted, full.expected, `full set: draws per slot match loot.glb: ${JSON.stringify(full.draws)}`);
  assert.equal(full.draws.length, Object.values(full.expected).reduce((a, b) => a + b, 0), 'full set: no draw beyond the equipped pieces');
  // The replaced slots: the player's own draws are hidden in every slot a `replace` piece fills (a helmet takes the hair too), and only there.
  const replaced = new Set(full.draws.filter((d) => d.split('|')[2] === 'replace').map((d) => d.split('|')[1]));
  if (replaced.has('Helmet')) replaced.add('Hair');
  assert.ok(drawn('full', 'Helmet', full.draws.find((d) => d.split('|')[1] === 'Helmet')?.split('|')[2]) && drawn('full', 'Crest', full.draws.find((d) => d.split('|')[1] === 'Crest')?.split('|')[2]), `full set: helmet AND crest draw together (the crest's own key): ${JSON.stringify(full.draws)}`);
  full.replaced = [...replaced];
  assert.ok(full.covered.length > 0 && full.covered.every((c) => replaced.has(c.split('|')[1].replace(/ \(shown\)$/, ''))), `full set: only replaced slots are covered: ${JSON.stringify({ replaced: full.replaced, covered: full.covered })}`);
  assert.ok(full.covered.some((c) => c.split('|')[1].startsWith('Body')), `full set: the player's own Body is hidden under goblin.Body: ${JSON.stringify(full.covered)}`);
  assert.deepEqual(errors, []);
  receipt.passed = true;
} finally {
  await fs.writeFile(`${dir}/receipt.json`, JSON.stringify(receipt, null, 2));
  await browser.close(); await server?.close();
}
console.log(JSON.stringify({ passed: receipt.passed, revision: receipt.revision?.revision ?? null, states: receipt.states, errors }));
