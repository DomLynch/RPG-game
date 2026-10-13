// The engage token is asked for inside the aggro radius, within the open budget; a full budget means band-off (nothing asked), and a creature the hero walked away from is handed back.
import assert from 'node:assert/strict';
import test from 'node:test';
import { ASK_BUDGET, BYSTANDER_BUDGET, createEngageAhead, type AheadNet } from './engage-ahead.ts';

function net(open: string[] = []): AheadNet & { log: string[]; tokens: Map<string, string> } {
  const log: string[] = [], tokens = new Map<string, string>();
  return { log, tokens, engaged: (i) => { log.push(`engage ${i}`); open.push(i); tokens.set(i, `tok-${i}`); return Promise.resolve({}); }, evaded: (i) => { log.push(`evade ${i}`); open.splice(open.indexOf(i), 1); tokens.delete(i); }, open: () => open, tokenOf: (i) => tokens.get(i) ?? null };
}
let t = 0; const clock = () => t;
const near = (id: string, dist: number, aggro = 7) => ({ id, dist, aggro });

test('inside the aggro radius the token is asked once; outside it is not; a token in hand is not asked again', () => {
  const n = net(), a = createEngageAhead(n, clock);
  a.frame([near('w1', 9), near('w2', 5)], () => false);
  assert.deepEqual(n.log, ['engage w2']);
  a.frame([near('w1', 9), near('w2', 5)], () => false); a.frame([near('w2', 4)], () => false);
  assert.deepEqual(n.log, ['engage w2'], 'asked once');
});

test('a full budget asks nothing (that bout plays band-off); a refused ask is retried only after the delay', () => {
  const full = net(['a', 'b', 'c', 'd']), a = createEngageAhead(full, clock);
  assert.equal(ASK_BUDGET, 4);
  a.frame([near('w1', 3)], () => false); assert.deepEqual(full.log, [], 'budget full: nothing asked');
  const refused = net(); refused.engaged = (i) => { refused.log.push(`engage ${i}`); return Promise.resolve({ offline: 'refused' }); };
  const b = createEngageAhead(refused, clock); t = 0;
  b.frame([near('w1', 3)], () => false); t = 1000; b.frame([near('w1', 3)], () => false); assert.equal(refused.log.length, 1, 'no hammering');
  t = 6000; b.frame([near('w1', 3)], () => false); assert.equal(refused.log.length, 2, 'asked again after the delay');
});

test('a creature the hero walked away from is handed back, unless it is already fighting him', () => {
  const n = net(), a = createEngageAhead(n, clock); t = 0;
  a.frame([near('w1', 3), near('w2', 3)], (id) => id === 'w2');
  a.frame([near('w1', 20), near('w2', 20)], (id) => id === 'w2');
  assert.deepEqual(n.log, ['engage w2', 'engage w1', 'evade w1']);
});

test('a fighting creature is never starved by bystanders: 5 in aggro, only 2 bystander asks are made, the 5th is fought and holds a token', () => {
  const n = net(), a = createEngageAhead(n, clock); t = 0;
  const five = [near('w1', 2), near('w2', 3), near('w3', 4), near('w4', 6), near('w5', 5)];
  a.frame(five, () => false);
  assert.equal(n.open().length, BYSTANDER_BUDGET, 'bystanders stop at their cap');
  a.frame(five, (id) => id === 'w5');
  assert.notEqual(n.tokenOf('w5'), null, 'the fought creature holds a token (its kill is paid)');
  assert.ok(n.open().length <= ASK_BUDGET);
});

test('against the writer\'s real budget (4 open for 120 s, handing back does not free a slot) the fought creature always gets one, even after the hero walked past many', () => {
  const server = new Set<string>(); let refused = 0;
  const w: AheadNet = { engaged: (i) => { if (server.size >= ASK_BUDGET) { refused++; return Promise.resolve({ offline: 'refused' }); } server.add(i); return Promise.resolve({}); }, evaded: () => {}, open: () => [...server], tokenOf: (i) => (server.has(i) ? `tok-${i}` : null) };
  const a = createEngageAhead(w, clock); t = 0;
  for (let k = 1; k <= 6; k++) { t += 5000; a.frame([near(`m${k}`, 3)], () => false); a.frame([near(`m${k}`, 30)], () => false); }
  assert.equal(server.size, BYSTANDER_BUDGET, 'six passers-by cost the server the bystander cap');
  t += 5000; a.frame([near('boss', 3)], (id) => id === 'boss');
  assert.ok(server.has('boss')); assert.equal(refused, 0);
});

test('after bystanders were handed back, three creatures fighting at once (MAX_ATTACKERS) all get a token against the real budget', () => {
  const server = new Set<string>(); let refused = 0;
  const w: AheadNet = { engaged: (i) => { if (server.size >= ASK_BUDGET) { refused++; return Promise.resolve({ offline: 'refused' }); } server.add(i); return Promise.resolve({}); }, evaded: () => {}, open: () => [...server], tokenOf: (i) => (server.has(i) ? `tok-${i}` : null) };
  const a = createEngageAhead(w, clock); t = 0;
  for (let k = 1; k <= 4; k++) { t += 5000; a.frame([near(`m${k}`, 3)], () => false); a.frame([near(`m${k}`, 30)], () => false); }
  assert.equal(server.size, BYSTANDER_BUDGET);
  const trio = [near('f1', 3), near('f2', 3), near('f3', 3)];
  t += 5000; a.frame(trio, () => true);
  assert.ok(['f1', 'f2', 'f3'].every((id) => server.has(id))); assert.equal(refused, 0);
});
