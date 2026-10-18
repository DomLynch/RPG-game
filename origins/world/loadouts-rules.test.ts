import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import DEFS from './loadouts.json' with { type: 'json' };
import { TIERS, droppedPiece, loadLoadouts, loadoutIds, loadoutRow, pickLoadout, pieceLabel } from './loadouts-rules.ts';
import { creatureHash, variantIndex } from './creature-hash.ts';
import { MOB_LOOKS, VARIANTS, mobVariant, variantLook } from '../preview/mob-looks.ts';
import { WEAPONS } from '../../src/fight/moves.ts';
import { loadZone } from '../zones/loader.ts';

const edit = (f: (d: { pieces: Record<string, unknown>[]; loadouts: Record<string, unknown>[] }) => void) => { const d = structuredClone(DEFS) as unknown as { pieces: Record<string, unknown>[]; loadouts: Record<string, unknown>[] }; f(d); return d; };

test('the rows are the Test Zone\'s: 18 armour pieces, 16 loadouts (4 goblin camp, 8 goblin rank t4-t7, 4 troll pitborn), every weapon a known weapon row, every piece a piece row', () => {
  assert.equal(DEFS.pieces.length, 18);
  assert.equal(loadoutIds().length, 16);
  for (const id of loadoutIds()) {
    const l = loadoutRow(id)!;
    assert.ok(WEAPONS[l.weapon], `${id}: weapon ${l.weapon} is not a weapon row`);
    assert.ok(TIERS.includes(l.tier), id);
    for (const p of l.pieces) assert.notEqual(pieceLabel(p), p, `${id}: piece ${p} has a label row`);
  }
  assert.equal(loadoutRow('nope'), undefined); assert.equal(loadoutRow(undefined), undefined);
});

test('goblin t4-t7 take their rung and their rank look; the troll rows are the pitborn kit (Dom 2026-10-18: the executioner hood hides the face)', () => {
  const rungOf: Record<string, string> = { t4: 'Veteran', t5: 'Champion', t6: 'Praetorian', t7: 'Master' };
  for (const id of loadoutIds().filter((i) => /^goblin\.t\d\./.test(i))) {
    const t = id.split('.')[1]!, l = loadoutRow(id)!;
    assert.equal(l.rung, rungOf[t], id);
    assert.equal(l.look, `/looks/goblin-L${t.slice(1)}.glb`, id);
  }
  const troll = loadoutIds().filter((i) => i.startsWith('troll.pit.'));
  assert.equal(troll.length, 4);
  for (const id of troll) for (const p of loadoutRow(id)!.pieces) assert.match(p, /^pitborn\./, id);
});   // the look files themselves are gitignored (every lane checkout has them): the names are pinned above

test('the loader refuses a typo row: a bad tier, an unknown piece, a repeated piece, no pieces, a bad rung, a bad look path, a missing weapon', () => {
  assert.doesNotThrow(() => loadLoadouts(edit(() => {})));
  assert.throws(() => loadLoadouts(edit((d) => { d.loadouts[0]!.tier = 'epic'; })), /tier/);
  assert.throws(() => loadLoadouts(edit((d) => { d.loadouts[0]!.pieces = ['goblin.Nope']; })), /not a loadout-piece/);
  assert.throws(() => loadLoadouts(edit((d) => { d.loadouts[0]!.pieces = ['goblin.Body', 'goblin.Body']; })), /each once/);
  assert.throws(() => loadLoadouts(edit((d) => { d.loadouts[0]!.pieces = []; })), /at least one piece/);
  assert.throws(() => loadLoadouts(edit((d) => { d.loadouts[0]!.rung = 'King'; })), /career-ladder title/);
  assert.throws(() => loadLoadouts(edit((d) => { d.loadouts[0]!.look = '../evil.glb'; })), /look is a/);
  assert.throws(() => loadLoadouts(edit((d) => { d.loadouts[0]!.weapon = ''; })), /weapon/);
  assert.throws(() => loadLoadouts(edit((d) => { d.loadouts.push(structuredClone(d.loadouts[0]!)); })), /./, 'a repeated loadout id');
});

// The reference the page used before the pick moved here: the FNV-1a loop mob-looks.ts held inline (the offset and prime in decimal). The refactor must not move a single creature.
const wasInline = (text: string): number => { let h = 2166136261; for (const c of text) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; } return h; };
const IDS = ['goblin-1', 'goblin-2', 'goblin-3', 'zone90:camp-a:7', 'zone1:rusty:0', 'character:cave-troll|x', 'ünïcode-☠-9', '', 'a', 'mob-0000', 'mob-0001', 'mob-9999'];

test('creatureHash is the FNV-1a the page held inline, to the bit (no creature changes its look or loadout)', () => {
  for (const id of IDS) assert.equal(creatureHash(id), wasInline(id), id);
  assert.equal(creatureHash(''), 2166136261);
  for (const id of IDS) assert.equal(variantIndex(id, 'goblin'), wasInline(`${id}|goblin`) % VARIANTS, id);
});

test('zone-instance ids are ASCII (the hash keeps one UTF-16 unit per code point, so a non-BMP id would differ from a per-unit FNV): pinned for the ids the zone rows build', () => {
  for (const id of IDS.filter((i) => /^[\x20-\x7e]*$/.test(i))) assert.equal(creatureHash(id), wasInline(id), id);
  assert.ok(IDS.filter((i) => /^[\x20-\x7e]*$/.test(i)).length >= 10, 'the ASCII ids are most of the pinned set');
});

test('pickLoadout: no spread list means the look\'s own loadout; variant 0 is the base; variant v takes [base, ...spread][v % length]; deterministic', () => {
  assert.equal(pickLoadout('g1', 'goblin', 'goblin.scrapper', undefined), 'goblin.scrapper');
  assert.equal(pickLoadout('g1', 'goblin', 'goblin.scrapper', []), 'goblin.scrapper');
  assert.equal(pickLoadout('g1', 'goblin', undefined, undefined), undefined);
  const spread = ['goblin.cutter', 'goblin.guard', 'goblin.captain'], seen = new Set<string | undefined>();
  for (let n = 0; n < 200; n++) {
    const id = `camp:${n}`, got = pickLoadout(id, 'goblin', 'goblin.scrapper', spread), list = ['goblin.scrapper', ...spread];
    assert.equal(got, list[variantIndex(id, 'goblin') % list.length], id);
    assert.equal(got, pickLoadout(id, 'goblin', 'goblin.scrapper', spread), 'the same creature, the same loadout');
    if (variantIndex(id, 'goblin') === 0) assert.equal(got, 'goblin.scrapper', 'variant 0 is the look\'s own loadout');
    seen.add(got);
  }
  assert.equal(seen.size, 4, 'across a camp every row in [base, ...spread] is worn by someone');
  assert.ok([undefined, 'goblin.cutter'].includes(pickLoadout('camp:1', 'goblin', undefined, ['goblin.cutter'])), 'an absent base is a body as it is');
});

test('page/server parity: the page\'s look pick (mobVariant) and the loadout pick start from the one variantIndex, so a creature is the same look and the same loadout on both sides', () => {
  const zone = loadZone(), kinds = [...Object.keys(zone.mobLooks?.looks ?? {}), ...Object.keys(MOB_LOOKS)];   // the central table is empty on trunk: the looks live in the zone row
  assert.ok(kinds.length > 0, 'the zone has mob looks to compare');
  for (const kind of kinds) for (const id of IDS) assert.equal(mobVariant(kind, id, zone), variantLook(kind, variantIndex(kind, id), zone), `${kind} ${id}`);
  // and the spread pick the page makes (the sandbox's variantLook formula, [base, ...spread][v % (n + 1)] with v already reduced mod VARIANTS) is exactly pickLoadout
  const spread = ['goblin.cutter', 'goblin.guard'];
  for (const id of IDS) { const v = variantIndex(id, 'goblin'); assert.equal(pickLoadout(id, 'goblin', 'goblin.scrapper', spread), ['goblin.scrapper', ...spread][v % (spread.length + 1)], id); }
});

test('the shared pick is server-safe: neither file, nor anything they import, reaches three, the DOM or the fight engine', () => {
  const seen = new Set<string>(), bad: string[] = [];
  const walk = (file: URL): void => {
    if (seen.has(file.href)) return; seen.add(file.href);
    const src = readFileSync(file, 'utf8');
    for (const m of src.matchAll(/(?:from|import)\s+'([^']+)'/g)) {
      const spec = m[1]!;
      if (/^three($|\/)/.test(spec) || /src\/fight\/index/.test(spec) || /fight\/characters/.test(spec)) bad.push(`${file.pathname} -> ${spec}`);
      else if (spec.startsWith('.') && spec.endsWith('.ts')) walk(new URL(spec, file));
    }
  };
  walk(new URL('./loadouts-rules.ts', import.meta.url));
  for (const own of ['./loadouts-rules.ts', './creature-hash.ts']) if (/\b(document|window|navigator|localStorage|Date\.now|Math\.random)\b/.test(readFileSync(new URL(own, import.meta.url), 'utf8').replace(/\/\/.*$/gm, ''))) bad.push(`${own} touches the DOM, the clock or a random`);
  assert.deepEqual(bad, []);
  assert.ok(seen.size >= 3, 'the walk reached the shared files');
});

test('droppedPiece: one worn piece per kill, the same creature drops the same piece, undefined when nothing is worn', () => {
  const l = loadoutRow('goblin.t7.estoc')!;
  for (const id of IDS) { const p = droppedPiece(l, id); assert.ok(p && l.pieces.includes(p), id); assert.equal(p, droppedPiece(l, id)); assert.equal(p, l.pieces[wasInline(id) % l.pieces.length]); }
  assert.equal(droppedPiece(undefined, 'x'), undefined);
});
