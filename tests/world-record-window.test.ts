// P0-b (world kills paid unverified): every kill the live loop reports carries a record that replays to that kill. 16 scripted scenarios of a three-wolf pack with 0 to 2 passive wolves inside the join ring
// (hunting: false, they have not noticed the hero), half of them with the next wolf arriving the moment the last one falls (the hero is still recovering, so no window may be skipped for that). Bar: recorded
// and verified kills == kills, on every scenario. `node --import ... tests/world-record-window.test.ts` prints the table.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorldCombat, type FightMob } from '../src/fight/world-combat.ts';
import { replayWorldRecord, type WorldRecord } from '../src/fight/world-record.ts';
import { dropReason } from '../src/fight/record-drop-rows.ts';
import { readFileSync } from 'node:fs';

const mob = (id: string, level: number): FightMob => ({ id, body: 'wolf', level, name: id });
type Entry = { spec: FightMob; x: number; z: number; hunting: boolean; after: number };   // after: it is in the ring once this many kills have happened

function scenario(s: number): { kills: number; verified: number; notes: string[] } {
  const spacing = 2.0 + 0.4 * (s % 4), passives = s % 3, list: Entry[] = [];
  for (let k = 0; k < 3; k++) list.push({ spec: mob(`wolf-${k + 1}`, 1), x: (k - 1) * spacing, z: 1.2 + 0.3 * k, hunting: true, after: k });   // one hunter at a time (a level-1 hero dies to two): the next wolf is in the ring the moment the last falls, so it joins while he is still recovering
  for (let p = 0; p < passives; p++) list.push({ spec: mob(`wolf-p${p + 1}`, 1), x: 2 + p, z: 8, hunting: false, after: 0 });
  const fell: string[] = []; let kills = 0, verified = 0; const notes: string[] = [];
  const mobs = { within: (x: number, z: number, r: number) => list.filter((m) => !fell.includes(m.spec.id) && kills >= m.after && Math.hypot(m.x - x, m.z - z) <= r).map((m) => ({ spec: m.spec, x: m.x, z: m.z, dist: Math.hypot(m.x - x, m.z - z), hunting: m.hunting })), drive: () => {} };
  const wc = createWorldCombat({
    mobs: () => mobs as never,
    onKill: (sp) => {
      fell.push(sp.id); kills++;
      const rec: WorldRecord | null = wc.record();
      if (!rec) { notes.push(`${sp.id}: no record`); return; }
      const r = replayWorldRecord(rec);
      if (!r.ok) notes.push(`${sp.id}: ${r.reason}`); else if (!r.kills.includes(sp.id)) notes.push(`${sp.id}: replay did not kill it`); else verified++;
    },
    onHeroDied: () => {}, onHeroHit: () => {},
    hero: () => ({ level: 1, weapon: (process.env.W ?? 'trident') as never }),   // the trident wins the most pack fights at level 1, so the battery sees the most kills (W=<weapon> to try another)   // a legal body (the replay bounds his health): he dies in some pack fights, the battery counts the kills that happen
  });
  const total = list.filter((m) => m.hunting).length;
  for (let i = 0; i < 600 && kills < total && !wc.hero().dead; i++) {
    wc.press();
    for (let t = 0; t < 0.5; t += 1 / 30) { const w = wc.debug().filter((x) => x.id !== 'me' && x.phase !== 'dead').sort((a, b) => Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z))[0]; wc.update(1 / 30, { x: 0, z: 0, facing: w ? Math.atan2(w.x, w.z) : 0 }); }
  }
  return { kills, verified, notes };
}

test('P0-b: every kill in a pack carries a record that replays to that kill, with 0 to 2 passives in the ring and with wolves arriving after a kill', () => {
  let kills = 0, verified = 0; const table: string[] = [];
  for (let s = 0; s < 16; s++) { const r = scenario(s); kills += r.kills; verified += r.verified; table.push(`s${s}: ${r.verified}/${r.kills}${r.notes.length ? '  ' + r.notes.join('; ') : ''}`); }
  console.log(`# world-record-window: ${verified}/${kills} kills recorded and verified\n# ${table.join('\n# ')}`);
  assert.ok(kills >= 32, `the scenarios fought (${kills} kills)`);
  assert.equal(verified, kills, `recorded and verified ${verified} of ${kills} kills`);
});

test('P0-b: the kill report carries the drop reason when there is no record, and never alongside one; the worn-gear path tells the loop', async () => {
  const bodies: Array<Record<string, unknown>> = [];
  const fetchStub = (async (url: string, init: { body?: string }) => {
    if (String(url).endsWith('/engage')) return new Response(JSON.stringify({ ok: true, result: { token: 't1', instance: 'wolf-1', generation: 0, kind: 'wolf', level: 1, hp: 10, expiresAt: 'x' } }));
    bodies.push(JSON.parse(init.body ?? '{}'));
    return new Response(JSON.stringify({ ok: true, result: { result: 'killed', instance: 'wolf-1', respawnAt: null, loot: [], cp: 0, bronze: 0 } }));
  }) as unknown as typeof fetch;
  const { spawnTracker } = await import('../origins/preview/spawn-net.ts');
  const tracker = () => spawnTracker({ token: () => 'tok', character: () => 'c', now: () => 0, base: 'http://x', fetch: fetchStub });
  const a = tracker(); await a.engaged('wolf-1'); await a.killed('wolf-1', null, dropReason('gearChange'));
  assert.deepEqual(bodies[0], { token: 't1', hits: 0, drop: 'gear-change' }, 'no record: the reason rides the kill report');
  const b = tracker(); await b.engaged('wolf-1'); await b.killed('wolf-1', null, null);
  assert.deepEqual(bodies[1], { token: 't1', hits: 0 }, 'no record and no reason: a plain missing record, as before');
  // the worn-gear path (gear-mount onWorn) must tell the loop, or a mid-window equip leaves a window on a stale sheet
  const main = readFileSync(new URL('../origins/preview/main.ts', import.meta.url), 'utf8');
  assert.match(main, /onWorn: \(ids, tiers\) => \{[\s\S]{0,120}wc\.heroChanged\(\)/, 'onWorn calls wc.heroChanged()');
  assert.match(main, /spawnNet\.killed\(spec\.id, wc\.record\(\), wc\.recordDrop\(\)\)/, 'the kill passes the drop reason beside the record');
});

test('P0-b (Auditor): hero() moving mid-window drops the record even when nobody calls heroChanged(): a weapon swap, a worn-gear sheet landing, a sheet arriving after the loadout gate timed out', () => {
  for (const change of ['weapon', 'sheet'] as const) {
    const state: { weapon: string; sheet?: unknown } = { weapon: 'trident' }; let t = 0, kills = 0, rec: WorldRecord | null = null as WorldRecord | null, drop: string | null = 'unset'; const fell: string[] = [];
    const wolf = { spec: mob('wolf-1', 1), x: 0, z: 1.2 };
    const mobs = { within: (x: number, z: number, r: number) => (fell.length || Math.hypot(wolf.x - x, wolf.z - z) > r ? [] : [{ spec: wolf.spec, x: wolf.x, z: wolf.z, dist: Math.hypot(wolf.x - x, wolf.z - z), hunting: true }]), drive: () => {} };
    const wc = createWorldCombat({ mobs: () => mobs as never, loadoutReady: () => true, onKill: (sp) => { fell.push(sp.id); kills++; rec = wc.record(); drop = wc.recordDrop(); }, onHeroDied: () => {}, onHeroHit: () => {}, hero: () => ({ level: 1, weapon: state.weapon as never, ...(state.sheet ? { sheet: state.sheet as never } : {}) }) });
    let changed = false;
    for (let i = 0; i < 600 && kills === 0 && !wc.hero().dead; i++) {
      wc.press();
      for (let s = 0; s < 0.5; s += 1 / 30) {
        t += 1 / 30; const w = wc.debug().find((x) => x.id === 'wolf-1' && x.phase !== 'dead');
        wc.update(1 / 30, { x: 0, z: 0, facing: w ? Math.atan2(w.x, w.z) : 0 });
        if (!changed && w) { changed = true; if (change === 'weapon') state.weapon = 'longsword'; else state.sheet = { armour: 30 }; }   // NO heroChanged() call: the worn-gear path and the late gear view do not make one
      }
    }
    assert.equal(kills, 1, change);
    assert.equal(rec, null, `${change}: a window opened on the old hero() has no record`);
    assert.equal(drop, 'gear-change', `${change}: and says why`);
  }
});

test('P0-b (Lead): a gear change inside an open window drops that window\'s record; the next window opens on the new gear and verifies', () => {
  let weapon = 'trident', t = 0, killedAt = -1; const fell: string[] = [], got: Array<{ id: string; rec: WorldRecord | null; drop: string | null }> = [];
  const wolves = [{ spec: mob('wolf-1', 1), x: -2, z: 1.2, from: 0 }, { spec: mob('wolf-2', 1), x: 2, z: 1.2, from: 1e9 }];
  const mobs = { within: (x: number, z: number, r: number) => wolves.filter((m) => !fell.includes(m.spec.id) && t >= m.from && Math.hypot(m.x - x, m.z - z) <= r).map((m) => ({ spec: m.spec, x: m.x, z: m.z, dist: Math.hypot(m.x - x, m.z - z), hunting: true })), drive: () => {} };
  const wc = createWorldCombat({ mobs: () => mobs as never, onKill: (sp) => { fell.push(sp.id); got.push({ id: sp.id, rec: wc.record(), drop: wc.recordDrop() }); if (killedAt < 0) { killedAt = t; wolves[1]!.from = t + 4; } }, onHeroDied: () => {}, onHeroHit: () => {}, hero: () => ({ level: 1, weapon: weapon as never }) });
  let changed = false;
  for (let i = 0; i < 600 && got.length < 2 && !wc.hero().dead; i++) {
    wc.press();
    for (let s = 0; s < 0.5; s += 1 / 30) {
      t += 1 / 30; const w = wc.debug().filter((x) => x.id !== 'me' && x.phase !== 'dead').sort((a, b) => Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z))[0];
      wc.update(1 / 30, { x: 0, z: 0, facing: w ? Math.atan2(w.x, w.z) : 0 });
      if (!changed && wc.debug().some((x) => x.id === 'wolf-1')) { changed = true; weapon = 'longsword'; wc.heroChanged(); }   // the worn gear changes while wolf-1 is in the loop
    }
  }
  assert.equal(got.length, 2, 'both wolves fell');
  assert.equal(got[0]!.rec, null, 'the window the gear changed in has no record: nothing is paid on a stale sheet');
  assert.equal(got[0]!.drop, dropReason('gearChange'), 'and the kill says why: the gear-change reason from the record-drop row, not a plain "no record"');
  assert.equal(got[0]!.drop, 'gear-change');
  assert.equal(got[1]!.drop, null, 'a kill that has a record carries no drop reason');
  const r = got[1]!.rec; assert.ok(r, 'the next window opened');
  assert.equal(r!.hero.weapon, 'longsword', 'on the new gear');
  const rep = replayWorldRecord(r!); assert.ok(rep.ok && rep.kills.includes('wolf-2'), JSON.stringify(rep));
});
