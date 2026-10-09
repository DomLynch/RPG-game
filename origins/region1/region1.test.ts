// Region 1 content: the shipped data loads clean, and each validation refuses the break it exists for.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { WEAPON_SLOTS } from '../../src/loot.ts';
import type { Issue } from '../contracts/core.ts';
import { CONCORD } from '../world/concord.ts';
import { resolveRegion, type WorldData } from '../world/resolve.ts';
import { BOSS_LOOT, BOUNTIES, BUNDLE, ENCOUNTER_FLAGS, KILL_ROWS, LOCAL, RIFTS, TOWNS } from './content.ts';
import { BOUNTY_DAILY_CAP, BOUNTY_METAL, TWISTS, loadRegion1, type Local } from './load.ts';
import { EXCHANGE_REGION, FRONTIER_REGION, REGION1_WORLD } from './world.ts';

const clone = <T>(v: T): T => structuredClone(v);
const issuesOf = (r: ReturnType<typeof loadRegion1>): Issue[] => (r.ok ? [] : r.issues);
const refused = (r: ReturnType<typeof loadRegion1>, code: string, pathPart: string) => {
  const list = issuesOf(r);
  assert.ok(list.some((i) => i.code === code && i.path.includes(pathPart)), `expected ${code} at …${pathPart}…, got ${JSON.stringify(list, null, 1)}`);
};
const withLocal = (edit: (l: Local) => void) => { const l = clone(LOCAL) as Local; edit(l); return loadRegion1(REGION1_WORLD, BUNDLE, l); };
const withBundle = (edit: (b: Record<string, unknown>[]) => void) => { const b = clone(BUNDLE); edit(b); return loadRegion1(REGION1_WORLD, b, LOCAL); };
const rec = (b: Record<string, unknown>[], id: string) => b.find((r) => r.id === id)! as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

test('Region 1 loads clean: both regions resolve, the bundle resolves, every local record checks out', () => {
  const r = loadRegion1();
  assert.ok(r.ok, JSON.stringify(issuesOf(r), null, 1));
  const v = r.value;
  assert.deepEqual([...v.zones.get(FRONTIER_REGION as never)!.keys()].sort(), ['ash-reach', 'black-mere', 'blood-ruin', 'cinder-fields', 'cinder-hold', 'east-road', 'ferry-landing', 'mere-end']);
  assert.deepEqual([...v.zones.get(EXCHANGE_REGION as never)!.keys()].sort(), ['exchange', 'exchange-quarter', 'pit-yard']);
  assert.deepEqual(v.towns.map((t) => t.name), ['The Exchange Quarter', 'Cinder Hold', 'Mere End']);
  assert.equal(v.bounties.length, 3);
  assert.equal(v.rifts.sites.length, 5);
});

test('region ids: the Exchange is region:concord-exchange everywhere (contracts, Trade and world data agree)', () => {
  assert.equal(EXCHANGE_REGION, 'region:concord-exchange');
  assert.ok(Object.hasOwn(CONCORD.regions, 'region:concord-exchange'));
  assert.ok(resolveRegion(CONCORD, EXCHANGE_REGION).ok);
  assert.ok(!Object.hasOwn(REGION1_WORLD.regions, 'region:concord'));
});

test('the Exchange amendment adds landmarks and moves none of the greybox-pinned ones', () => {
  const before = CONCORD.regions[EXCHANGE_REGION]!.zones.exchange!.layout!, after = REGION1_WORLD.regions[EXCHANGE_REGION]!.zones.exchange!.layout!;
  for (const [k, l] of Object.entries(before)) assert.deepEqual(after[k], l, k);
  assert.ok(after['west-gate'] && after['square-arch']);
  const square = loadRegion1();
  assert.ok(square.ok);
  assert.equal(square.value.zones.get(EXCHANGE_REGION as never)!.get('exchange')!.rules.safe, true, 'the square stays safe');
  assert.equal(square.value.zones.get(EXCHANGE_REGION as never)!.get('exchange-quarter')!.rules.safe, false, 'the quarter is a town');
});

test('every id is unique across Region 1, contracts and local kinds together', () => {
  refused(withBundle((b) => b.push(clone(rec(b, 'item:grave-iron')))), 'duplicate-id', '].id');
  refused(withLocal((l) => { (l.bounties[0] as Record<string, unknown>).id = 'bounty:toll'; }), 'duplicate-id', 'bounties[1].id');
  refused(withLocal((l) => { (l.towns[1] as Record<string, unknown>).id = 'town:exchange-quarter'; }), 'duplicate-id', 'towns[1].id');
});

test('every reference resolves: bosses, loot tables, characters, encounters, landmarks, waypoints', () => {
  refused(withBundle((b) => { rec(b, 'encounter:mere-mother').boss.loot = 'loottable:nope'; }), 'unknown-id', 'encounter:mere-mother.boss.loot');
  refused(withBundle((b) => { rec(b, 'encounter:bounty-toll').boss.character = 'character:nobody'; }), 'unknown-id', 'boss.character');
  refused(withBundle((b) => { rec(b, 'loottable:court-thrall').rolls[0].entries[0].item = 'item:frontier.missing'; }), 'unknown-id', 'loottable:court-thrall');
  refused(withBundle((b) => { rec(b, 'region:ash-frontier').waypoints.pop(); }), 'missing-field', 'region:ash-frontier.waypoints');
  refused(withLocal((l) => { (l.towns[2] as Record<string, unknown>).jail = 'nowhere'; }), 'unknown-id', 'town:mere-end.jail');
  refused(withLocal((l) => { l.towns[1]!.ruler.standIn = 'character:nobody'; }), 'unknown-id', 'town:cinder-hold');
  refused(withLocal((l) => { l.bossLoot.pop(); }), 'missing-field', 'encounter:bounty-peg-powler');
  refused(withLocal((l) => { (l.rifts[0] as Record<string, unknown>).at = 'no-landmark'; }), 'unknown-id', 'rifts[0].at');
  refused(withLocal((l) => { (l.rifts[5] as Record<string, unknown>).encounter = 'encounter:nope'; }), 'unknown-id', 'rifts[5].encounter');
  refused(withLocal((l) => { l.creatureLoot['character:ruin-ghoul'] = 'loottable:gone'; }), 'unknown-id', 'creatureLoot');
});

test('bosses: the world boss runs on origins/boss, its table rolls on the first win only; the rift boss fights at band top + 2', () => {
  assert.equal(KILL_ROWS['character:mere-mother'], 'world-boss');
  assert.deepEqual(BOSS_LOOT.find((b) => b.encounter === 'encounter:mere-mother'), { encounter: 'encounter:mere-mother', rule: 'first-win' });
  refused(withLocal((l) => { l.bossLoot[0]!.rule = 'weekly-cap'; l.bossLoot[0]!.perWeek = 5; }), 'rule-violation', 'encounter:mere-mother');
  refused(withBundle((b) => { delete rec(b, 'encounter:mere-mother').boss.health; }), 'missing-field', 'boss.health');
  refused(withBundle((b) => { rec(b, 'encounter:rift-worm').boss.level = 16; }), 'rule-violation', 'levelOver');
  refused(withLocal((l) => { l.bossLoot[1]!.perWeek = undefined; }), 'rule-violation', 'perWeek');
});

test('Bounties: metal and daily caps sit inside the spec, and match region1 §3 exactly', () => {
  const spec = { 'bounty:hrungnir': [40, 3], 'bounty:toll': [30, 3], 'bounty:peg-powler': [50, 2] } as Record<string, [number, number]>;
  for (const b of BOUNTIES) {
    assert.deepEqual([b.metal, b.dailyCap], spec[b.id], b.id);
    assert.ok(b.metal >= BOUNTY_METAL.min && b.metal <= BOUNTY_METAL.max && b.dailyCap >= BOUNTY_DAILY_CAP.min && b.dailyCap <= BOUNTY_DAILY_CAP.max);
  }
  refused(withLocal((l) => { l.bounties[0]!.metal = 500; }), 'out-of-range', 'bounties[0].metal');
  refused(withLocal((l) => { l.bounties[2]!.dailyCap = 10; }), 'out-of-range', 'bounties[2].dailyCap');
  refused(withLocal((l) => { l.bounties[1]!.dailyCap = 0; }), 'out-of-range', 'bounties[1].dailyCap');
  refused(withLocal((l) => { (l.bounties[0] as Record<string, unknown>).tribute = 5; }), 'unknown-field', 'bounties[0].tribute');
  // a Bounty pays metal only: its encounter's table is never rolled
  refused(withLocal((l) => { l.bossLoot[2]!.rule = 'first-win'; }), 'rule-violation', 'encounter:bounty-hrungnir');
});

test('twists are Origins encounter flags only, and a Bounty shows exactly its encounter flag', () => {
  for (const b of BOUNTIES) assert.deepEqual(b.twist, ENCOUNTER_FLAGS[b.encounter]![0]);
  for (const list of Object.values(ENCOUNTER_FLAGS)) for (const t of list) assert.ok(Object.hasOwn(TWISTS, t.kind as string));
  refused(withLocal((l) => { l.flags['encounter:bounty-toll'] = [{ kind: 'rng-seed', value: 7 }]; }), 'content-rule', 'flags.encounter:bounty-toll[0].kind');
  refused(withLocal((l) => { l.flags['encounter:bounty-toll'] = [{ kind: 'one-health-bar', ladder: true }]; }), 'unknown-field', 'ladder');
  refused(withLocal((l) => { l.bounties[2]!.twist = { kind: 'flee-at', percent: 20, catchSeconds: 15 }; }), 'rule-violation', 'bounty:peg-powler.twist');
  refused(withLocal((l) => { l.flags['encounter:not-here'] = [{ kind: 'no-block' }]; }), 'unknown-id', 'flags.encounter:not-here');
  // the live game never sees them: nothing under src/ imports origins/
  const src = fileURLToPath(new URL('../../src/', import.meta.url));
  const walk = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? walk(join(dir, d.name)) : /\.(ts|js|mjs)$/.test(d.name) ? [join(dir, d.name)] : []));
  for (const f of walk(src)) assert.ok(!/from\s+['"][^'"]*origins\//.test(readFileSync(f, 'utf8')), `${f} imports origins/`);
});

test('no weapon drops in Region 1', () => {
  for (const r of BUNDLE) if (r.kind === 'item-definition' && !String(r.id).startsWith('item:loot.')) assert.ok(!(WEAPON_SLOTS as readonly string[]).includes(r.slot as string), String(r.id));   // the legacy loot catalogue holds the engine's weapon pieces; no table awards one (below)
  refused(withBundle((b) => { rec(b, 'item:frontier.ash-helm').slot = 'Gladius'; }), 'content-rule', 'item:frontier.ash-helm.slot');
});

test('towns: three, never safe, ruler title and services from the tier, rulers never rivals, clear of the square', () => {
  assert.deepEqual(TOWNS.map((t) => [t.startProsperity, t.ruler.title, t.services.length]), [[500, 'mayor', 3], [260, 'reeve', 2], [180, 'reeve', 1]]);
  refused(withLocal((l) => { l.towns.pop(); }), 'rule-violation', 'towns');
  refused(withLocal((l) => { l.towns[2]!.startProsperity = 500; }), 'rule-violation', 'town:mere-end.ruler.title');
  refused(withLocal((l) => { l.towns[2]!.services.push({ trade: 'smith', npc: 'character:smith-cinder', at: 'end-healer' }); }), 'rule-violation', 'town:mere-end.services');
  refused(withLocal((l) => { (l.towns[0] as Record<string, unknown>).zone = 'exchange'; }), 'rule-violation', 'town:exchange-quarter.zone');
  refused(withBundle((b) => { rec(b, 'character:reeve-osk').encounterForms = [{ id: 'duel', opponent: 'witch', level: 13, encounter: null }]; }), 'rule-violation', 'town:mere-end');
  const w = clone(REGION1_WORLD) as WorldData;
  (w.regions[EXCHANGE_REGION]!.zones['exchange-quarter']!.layout as Record<string, { v: number }>)['quarter-centre']!.v = 0.3;
  refused(loadRegion1(w, BUNDLE, LOCAL), 'rule-violation', 'town:exchange-quarter.centre');
});

test('every spawn of a foe stands outside the towns, and every town figure stands in its town', () => {
  refused(withBundle((b) => { rec(b, 'region:ash-frontier').spawns.push({ id: 'raid', at: 'hold-centre', encounter: null, characters: ['character:ruin-ghoul'] }); }), 'rule-violation', 'spawns.raid');
  refused(withBundle((b) => { rec(b, 'region:ash-frontier').spawns = rec(b, 'region:ash-frontier').spawns.filter((s: { id: string }) => s.id !== 'end-healer'); }), 'missing-field', 'town:mere-end');
});

test('rifts: five sites, none in a town or safe zone', () => {
  assert.equal(RIFTS.filter((r) => r.kind === 'rift-site').length, 5);
  refused(withLocal((l) => { Object.assign(l.rifts[0]!, { zone: 'cinder-hold', at: 'hold-centre' }); }), 'rule-violation', 'rifts[0].zone');
  // one rift boss and one scheduler: a second under a new id is refused, not a silent overwrite of the first
  for (const kind of ['rift-boss', 'rift-scheduler']) {
    refused(withLocal((l) => { const r = l.rifts.find((x) => x.kind === kind)!; l.rifts.push({ ...r, id: `${String(r.id)}-two` }); }), 'duplicate-id', `rifts[${RIFTS.length}]`);
  }
});
