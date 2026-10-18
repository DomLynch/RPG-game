// P0-b (world kills paid unverified): every kill the live loop reports carries a record that replays to that kill. 16 scripted scenarios of a three-wolf pack with 0 to 2 passive wolves inside the join ring
// (hunting: false, they have not noticed the hero), half of them with the next wolf arriving the moment the last one falls (the hero is still recovering, so no window may be skipped for that). Bar: recorded
// and verified kills == kills, on every scenario. `node --import ... tests/world-record-window.test.ts` prints the table.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorldCombat, type FightMob } from '../src/fight/world-combat.ts';
import { replayWorldRecord, type WorldRecord } from '../src/fight/world-record.ts';

const mob = (id: string, level: number): FightMob => ({ id, body: 'wolf', level, name: id });
type Entry = { spec: FightMob; x: number; z: number; hunting: boolean; after: number };   // after: it is in the ring once this many kills have happened

function scenario(s: number): { kills: number; verified: number; notes: string[] } {
  const spacing = 1.2 + 0.4 * (s % 4), passives = s % 3, sequential = s >= 8, list: Entry[] = [];
  for (let k = 0; k < 3; k++) list.push({ spec: mob(`wolf-${k + 1}`, 1), x: (k - 1) * spacing, z: 1.2 + 0.3 * k, hunting: true, after: sequential ? k : 0 });
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
    hero: () => ({ level: 1, health: 4000 }),   // he outlasts the pack: the battery measures records, not the fight's odds
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
  assert.ok(kills >= 40, `the scenarios fought (${kills} kills of 48)`);
  assert.equal(verified, kills, `recorded and verified ${verified} of ${kills} kills`);
});
