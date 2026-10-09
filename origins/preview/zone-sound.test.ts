import assert from 'node:assert/strict';
import test from 'node:test';
import type { CombatEvent } from '../../src/duel.ts';
import { createZoneSound, soundWanted, type ZoneFeedback } from './zone-sound.ts';

const hit = { tick: 1, type: 'Hit', actor: 0, target: 1 } as CombatEvent, swing = { tick: 2, type: 'AttackStarted', actor: 1 } as CombatEvent;
const fake = () => { const log: string[] = [], seen: CombatEvent[][] = []; const f: ZoneFeedback = { unlock: () => void log.push('unlock'), update: (e) => void seen.push(e), quiet: () => void log.push('quiet') }; return { f, log, seen }; };

test('?sound=0 is the only way off', () => { assert.equal(soundWanted(''), true); assert.equal(soundWanted('?sound=1'), true); assert.equal(soundWanted('?sound=0'), false); });
test('events before the first gesture are dropped, not queued; after it each frame is one update with the Pit events in order', async () => {
  const { f, log, seen } = fake(); const z = createZoneSound(async () => f);
  z.event({ pit: hit }); z.flush(); assert.deepEqual(seen, []);
  z.unlock(); await new Promise((r) => setTimeout(r, 0)); assert.deepEqual(log, ['unlock']);
  z.event({ pit: hit }); z.event({}); z.event({ pit: swing }); z.flush(); z.flush();
  assert.deepEqual(seen, [[hit, swing]]);   // an event with no Pit twin is skipped; an empty frame calls nothing
});
test('a second gesture only re-unlocks; quiet drops what is pending; a failed load turns sound off for good', async () => {
  const { f, log, seen } = fake(); const z = createZoneSound(async () => f); z.unlock(); await new Promise((r) => setTimeout(r, 0)); z.unlock();
  assert.deepEqual(log, ['unlock', 'unlock']); z.event({ pit: hit }); z.quiet(); z.flush(); assert.deepEqual(seen, []); assert.equal(log.at(-1), 'quiet');
  const bad = createZoneSound(() => Promise.reject(new Error('no audio'))); bad.unlock(); await new Promise((r) => setTimeout(r, 0)); bad.event({ pit: hit }); bad.flush();
  const off = createZoneSound(async () => f, false); off.unlock(); off.event({ pit: hit }); off.flush(); assert.deepEqual(seen, []);
});
