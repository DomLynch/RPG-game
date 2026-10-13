// The engage token is asked for inside the aggro radius, within the open budget; a full budget means band-off (nothing asked), and a creature the hero walked away from is handed back.
import assert from 'node:assert/strict';
import test from 'node:test';
import { ASK_BUDGET, createEngageAhead, type AheadNet } from './engage-ahead.ts';

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
  a.frame([near('w1', 3), near('w2', 3)], () => false);
  a.frame([near('w1', 20), near('w2', 20)], (id) => id === 'w2');
  assert.deepEqual(n.log, ['engage w1', 'engage w2', 'evade w1']);
});
