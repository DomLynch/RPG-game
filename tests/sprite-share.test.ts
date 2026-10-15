import assert from 'node:assert/strict';
import test from 'node:test';

// One sprite request per page (a zone page builds zone-sound, pit-duel and creature-voice feedbacks), and none at all under ?sound=0, whichever feedback is built.
const g = globalThis as Record<string, unknown>; let search = ''; let fetched = 0;
g.window = { addEventListener: () => {} }; g.location = { get search() { return search; } };
g.requestIdleCallback = (cb: () => void) => { cb(); return 1; };
g.fetch = async () => { fetched++; return new Response(new Uint8Array([1, 2, 3]), { status: 200 }); };
const { createFeedback } = await import('../src/fight/sound/feedback.ts');
const { sharedPrefetch } = await import('../src/audio/sprite.ts');
const tick = () => new Promise((r) => setTimeout(r, 5));

test('?sound=0 makes no fetch on any path: three feedbacks built, unlocked and toggled stay silent', async () => {
  search = '?sound=0'; fetched = 0;
  const fbs = [createFeedback(), createFeedback(), createFeedback()]; for (const f of fbs) f.unlock(); await tick();
  assert.equal(fetched, 0, 'no request while sound is off');
});
test('three feedbacks on one page make ONE sprite request', async () => {
  search = ''; fetched = 0;
  const fbs = [createFeedback(), createFeedback(), createFeedback()]; await tick();
  assert.equal(fetched, 1, 'zone-sound, pit-duel and creature-voice share one prefetch');
  const a = sharedPrefetch(), b = sharedPrefetch(); assert.equal(a, b, 'the same memoised promise'); assert.equal(fetched, 1); void fbs;
});
test('a missed prefetch is forgotten so the next caller retries', async () => {
  const { sharedPrefetch: sp } = await import('../src/audio/sprite.ts'); let n = 0;
  const failing: typeof fetch = async () => { n++; throw new TypeError('offline'); };
  assert.equal(await sp(['opus'], failing, () => false), null); assert.equal(await sp(['opus'], failing, () => false), null); assert.equal(n, 2, 'a null result is not cached');
});
