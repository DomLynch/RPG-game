import assert from 'node:assert/strict';
import test from 'node:test';
import type { CombatEvent } from '../../src/fight/index.ts';
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

// iOS Safari only starts (or resumes) an AudioContext inside the user gesture. The feedback module is a lazy chunk, so unless it is already loaded the first gesture's unlock() runs after
// the gesture ended and the context stays suspended until a LATER tap ("sound comes on mid way", Dom 2026-10-14). preload() loads the chunk at idle so the first gesture unlocks synchronously.
test('after preload() the first gesture unlocks the feedback INSIDE the gesture, not after it', async () => {
  let inGesture = false; const at: boolean[] = [];
  const f: ZoneFeedback = { unlock: () => void at.push(inGesture), update: () => {}, quiet: () => {} };
  const z = createZoneSound(async () => f); z.preload(); await new Promise((r) => setTimeout(r, 0));
  inGesture = true; z.unlock(); inGesture = false;
  assert.deepEqual(at, [true], 'the audio context is built and resumed while the gesture is still on');
});
test('a gesture that lands before the preload finished still unlocks once, as soon as the chunk is there', async () => {
  const { f, log } = fake(); let release!: () => void; const gate = new Promise<void>((r) => { release = r; });
  const z = createZoneSound(async () => { await gate; return f; }); z.preload(); z.unlock(); assert.deepEqual(log, []);
  release(); await new Promise((r) => setTimeout(r, 0)); assert.deepEqual(log, ['unlock']);
  z.preload(); z.unlock(); assert.deepEqual(log, ['unlock', 'unlock'], 'preload twice loads once; the next gesture is synchronous');
});
test('preload() does not unlock by itself and a failed or disabled load stays silent', async () => {
  const { f, log } = fake(); const z = createZoneSound(async () => f); z.preload(); await new Promise((r) => setTimeout(r, 0)); assert.deepEqual(log, []);
  const bad = createZoneSound(() => Promise.reject(new Error('no audio'))); bad.preload(); await new Promise((r) => setTimeout(r, 0)); bad.unlock(); bad.event({ pit: hit }); bad.flush();
  const off = createZoneSound(async () => f, false); off.preload(); off.unlock(); assert.deepEqual(log, []);
});
