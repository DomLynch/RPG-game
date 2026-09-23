// Worn loot on the fight rig (Lead, 2026-09-23): a worn piece must DRAW on the player in a fight, for both loot layers: 'over' (worn on
// top of the player's own draws: dwarf.Greaves) and 'replace' (hides the player's draws in its slot: goblin.Body). The paperdoll can be
// right while the rig is wrong, so this reads the arena, not the journal. A guest ledger is seeded straight into localStorage (no fight
// for a piece, so it is fast and the same every run), the page reloaded with ?debug=1, and the rig's own list of worn draws read from
// #debug's data-worn (scene.ts wornDraws: `name|slot|layer`, ' (hidden)' if detached or invisible) in three states:
// none → legs=dwarf.Greaves → + chest=goblin.Body → a full set. Stills of the figure are kept as the receipt a person looks at. (A pixel diff was
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
const FULL = { head: 'goblin.Helmet', chest: 'goblin.Body', arms: 'goblin.Arms', hands: 'goblin.Gloves', legs: 'dwarf.Greaves', feet: 'goblin.Boots' };
const STATES = [['none', {}], ['over', { legs: 'dwarf.Greaves' }], ['over+replace', { legs: 'dwarf.Greaves', chest: 'goblin.Body' }], ['full', FULL]];
const SLOT_OF = { head: ['Helmet', 'Crest'], chest: ['Body'], arms: ['Arms'], hands: ['Gloves'], legs: ['Greaves'], feet: ['Boots'] };
const browser = await chromium.launch({ headless: true, executablePath: chromium.executablePath() });
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 })).newPage();
page.setDefaultTimeout(90000);
const errors = [], lootFetches = []; page.on('pageerror', e => errors.push(String(e)));
page.on('response', r => { if (/\/loot[^/]*\.glb$/.test(new URL(r.url()).pathname)) lootFetches.push(r.status()); });
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
  for (const [key, id] of Object.entries(FULL)) assert.ok(receipt.states.full.draws.some((d) => SLOT_OF[key].includes(d.split('|')[1])), `full set: ${id} (${key}) draws on the rig: ${JSON.stringify(receipt.states.full.draws)}`);
  assert.deepEqual(errors, []);
  receipt.passed = true;
} finally {
  await fs.writeFile(`${dir}/receipt.json`, JSON.stringify(receipt, null, 2));
  await browser.close(); await server?.close();
}
console.log(JSON.stringify({ passed: receipt.passed, revision: receipt.revision?.revision ?? null, states: receipt.states, errors }));
