import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import { GATE_RETRY_MS, createFeedback } from '../src/feedback.ts';
import { BELL_SECONDS, prepareBell } from '../src/audio/bell.ts';

// Minimal Web Audio stand-in: enough surface for unlock/quiet/play to run without a browser.
class FakeContext {
  static last: FakeContext | undefined; static made = 0;
  state = 'suspended'; resumed = 0; sampleRate = 48000; currentTime = 0; destination = {}; sources = 0; bells = 0;
  constructor() { FakeContext.made++; FakeContext.last = this; }
  node() { const param = () => ({ value: 0, setValueAtTime() {}, cancelScheduledValues() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} }); return { gain: param(), frequency: param(), Q: param(), playbackRate: param(), threshold: param(), knee: param(), ratio: param(), attack: param(), release: param(), type: '', curve: null, buffer: null, connect() { return this; }, disconnect() {}, start() {}, stop() {}, onended: null }; }
  createGain() { return this.node(); } createBiquadFilter() { return this.node(); } createOscillator() { return this.node(); } createWaveShaper() { return this.node(); } createDynamicsCompressor() { return this.node(); } createConvolver() { return this.node(); }
  createBuffer(_c: number, length: number) { return { duration: length / this.sampleRate, getChannelData: () => new Float32Array(length) }; }
  createBufferSource() { if (this.state !== 'running') throw new Error('play must not reach the graph while the context is not running'); this.sources++; const node = this.node(); node.start = () => { if ((node.buffer as { duration?: number } | null)?.duration === BELL_SECONDS) this.bells++; }; return node; }
  resume() { this.resumed++; this.state = 'running'; return Promise.resolve(); }
  suspend() { this.state = 'suspended'; return Promise.resolve(); }
}
function withFakeAudio(audioSession: { type: string } | undefined, run: () => void) {
  const g = globalThis as unknown as { AudioContext?: unknown; navigator?: unknown };
  const priorContext = g.AudioContext, priorNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  g.AudioContext = FakeContext; FakeContext.made = 0; FakeContext.last = undefined;
  Object.defineProperty(globalThis, 'navigator', { value: audioSession ? { audioSession } : {}, configurable: true });
  try { run(); } finally {
    g.AudioContext = priorContext;
    if (priorNavigator) Object.defineProperty(globalThis, 'navigator', priorNavigator); else delete g.navigator;
  }
}

test('unlock creates one context inside the gesture and opts into an iOS playback audio session', () => withFakeAudio({ type: 'auto' }, () => {
  const feedback = createFeedback();
  feedback.update([{ tick: 1, type: 'Hit', actor: 0 } as never]); // before any gesture: silent, and no context is created
  assert.equal(FakeContext.made, 0);
  feedback.unlock(); feedback.unlock();
  assert.equal(FakeContext.made, 1, 'one context for the page');
  assert.equal(FakeContext.last!.resumed, 1, 'a suspended context is resumed once');
  assert.equal((globalThis.navigator as unknown as { audioSession: { type: string } }).audioSession.type, 'playback');
}));

test('unlock resumes an interrupted context (iOS after a call or app switch), and leaves a running one alone', () => withFakeAudio(undefined, () => {
  const feedback = createFeedback(); feedback.unlock();
  const context = FakeContext.last!;
  assert.equal(context.state, 'running');
  feedback.unlock(); assert.equal(context.resumed, 1, 'running: not resumed again');
  context.state = 'interrupted';
  feedback.unlock(); assert.equal(context.resumed, 2, 'interrupted: resumed'); assert.equal(context.state, 'running');
  feedback.quiet(); assert.equal(context.state, 'suspended');
  feedback.unlock(); assert.equal(context.resumed, 3, 'suspended: resumed');
}));

test('quiet() silences the page: no cue reaches the graph until the next unlock, then cues play again', () => withFakeAudio(undefined, () => {
  const feedback = createFeedback(); feedback.unlock();
  const context = FakeContext.last!;
  feedback.update([{ tick: 1, type: 'Hit', actor: 0 } as never]);
  assert.ok(context.sources > 0, 'a running context plays the (fallback) hit');
  const before = context.sources; feedback.quiet();
  feedback.update([{ tick: 2, type: 'Parried', actor: 0 } as never]);
  assert.equal(context.sources, before, 'suspended: nothing scheduled, nothing thrown');
  feedback.unlock(); feedback.update([{ tick: 3, type: 'Blocked', actor: 0 } as never]);
  assert.ok(context.sources > before, 'resumed: cues play again');
}));

test('the shell unlocks audio on the events WebKit treats as user activation, not only pointerdown', () => {
  const source = fs.readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
  const parsed = ts.createSourceFile('main.ts', source, ts.ScriptTarget.Latest, true);
  const loop = parsed.statements.find(node => ts.isForOfStatement(node)
    && node.statement.getText(parsed).includes('feedback.unlock()')
    && node.statement.getText(parsed).includes('addEventListener'));
  assert.ok(loop, 'unlock listener registration exists');
  const listeners = new Map<string, () => void>();
  let unlocked = 0;
  const js = ts.transpileModule(loop.getText(parsed), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('window', 'feedback', js)(
    { addEventListener: (type: string, listener: () => void) => listeners.set(type, listener) },
    { unlock: () => { unlocked++; } },
  );
  for (const type of ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown']) {
    assert.ok(listeners.has(type), `unlock is bound to ${type}`);
    const before = unlocked; listeners.get(type)!();
    assert.equal(unlocked, before + 1, `${type} invokes unlock`);
  }
});

test('quiet blocks cues immediately while browser suspension is still pending', () => withFakeAudio(undefined, () => {
  const feedback = createFeedback(); feedback.unlock();
  const context = FakeContext.last!;
  context.suspend = () => Promise.resolve(); // Web Audio changes state asynchronously.
  feedback.quiet();
  feedback.update([{ tick: 1, type: 'Hit', actor: 0 } as never]);
  assert.equal(context.sources, 0);
  feedback.unlock(); feedback.update([{ tick: 2, type: 'Hit', actor: 0 } as never]);
  assert.ok(context.sources > 0);
}));

// suspend() changes state asynchronously; Enter/close may unlock before that transition lands.
test('an immediate unlock queues resume behind a pending suspension', () => withFakeAudio(undefined, () => {
  const feedback = createFeedback(); feedback.unlock();
  const context = FakeContext.last!; let finish!: () => void;
  context.suspend = () => new Promise<void>(resolve => { finish = resolve; });
  feedback.quiet(); assert.equal(context.state, 'running');
  feedback.unlock(); assert.equal(context.resumed, 2, 'resume is requested inside the new gesture even before suspend completes');
  finish();
}));

// WebKit may resume only on touchend, after the simulation has already consumed pointerdown's Draw.
for (const interruption of ['none', 'quiet', 'mute', 'phaseEnd', 'death', 'newMatch'] as const) {
 test(`draw bell survives delayed resume only while current draw remains valid: ${interruption}`, async () => { await prepareBell(); withFakeAudio(undefined, () => {   // the idle-built bell is ready, as it is by the time a player reaches Draw
  const feedback = createFeedback(); feedback.unlock(); const context = FakeContext.last!;
  context.state = 'suspended';
  const frame = { match: 1, ended: false, tick: 600, drawing: true };
  feedback.update([{ tick: 600, type: 'ActionStarted', action: 'draw', actor: 0 }], undefined, frame);
  assert.equal(context.bells, 0, 'no scheduling while suspended');
  if (interruption === 'quiet') { feedback.quiet(); feedback.unlock(); }
  if (interruption === 'mute') { feedback.toggle(); feedback.toggle(); }
  context.state = 'running';
  feedback.update([], undefined, { ...frame, drawing: interruption !== 'phaseEnd', ended: interruption === 'death', match: interruption === 'newMatch' ? 2 : 1 });
  assert.equal(context.bells, interruption === 'none' ? 1 : 0, 'only a still-valid draw may ring after resume');
  feedback.update([], undefined, frame); assert.equal(context.bells, interruption === 'none' ? 1 : 0, 'no replay on later tick');
 }); });
}

test('the Pit gate\'s winch: silent until its file is decoded, then one source per tap; muted or quiet is silent; stop is idempotent', async () => {
  const g = globalThis as unknown as { fetch: unknown }, priorFetch = g.fetch;
  g.fetch = async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) });
  (FakeContext.prototype as unknown as { decodeAudioData: () => Promise<unknown> }).decodeAudioData = async () => ({ duration: 5 });
  try {
    const feedback = createFeedback();
    assert.equal(feedback.gate(), undefined, 'before any gesture there is no context: silent');
    await new Promise<void>((done, fail) => withFakeAudio(undefined, () => {
      void (async () => {
        feedback.unlock();
        assert.equal(feedback.gate(), undefined, 'the file is not fetched yet');
        feedback.warmGate(); feedback.warmGate();
        await new Promise((r) => setTimeout(r, 10));
        const before = FakeContext.last!.sources, winch = feedback.gate();
        assert.ok(winch, 'decoded: the tap starts the winch');
        assert.equal(FakeContext.last!.sources, before + 1);
        winch.stop(); winch.stop();
        feedback.toggle();
        assert.equal(feedback.gate(), undefined, 'muted: silent');
        feedback.toggle(); feedback.quiet();
        assert.equal(feedback.gate(), undefined, 'a quiet page: silent');
      })().then(done, fail);
    }));
  } finally { g.fetch = priorFetch; delete (FakeContext.prototype as unknown as { decodeAudioData?: unknown }).decodeAudioData; }
});

test('the Pit gate\'s winch: a failed fetch is tried once more and gives the page its sound; a decoded winch is not fetched again', async () => {
  const g = globalThis as unknown as { fetch: unknown }, priorFetch = g.fetch;
  let calls = 0, failing = 2;   // the first load tries both codecs: both fail
  const winch = (url: unknown) => String(url).includes('gate');   // the sprite's own load (unlock) shares the stub and must not use up the failures
  g.fetch = async (url: unknown) => { if (winch(url)) calls++; return winch(url) && failing-- > 0 ? { ok: false } : { ok: true, arrayBuffer: async () => new ArrayBuffer(8) }; };
  (FakeContext.prototype as unknown as { decodeAudioData: () => Promise<unknown> }).decodeAudioData = async () => ({ duration: 5 });
  try {
    const feedback = createFeedback();
    await new Promise<void>((done, fail) => withFakeAudio(undefined, () => {
      void (async () => {
        feedback.unlock();
        feedback.warmGate();
        await new Promise((r) => setTimeout(r, 20));
        assert.equal(feedback.gate(), undefined, 'the first fetch failed: silent for now');
        await new Promise((r) => setTimeout(r, GATE_RETRY_MS + 100));
        assert.ok(feedback.gate(), 'the retry decoded it');
        const seen = calls;
        feedback.warmGate();
        await new Promise((r) => setTimeout(r, 20));
        assert.equal(calls, seen, 'a decoded winch is not fetched again');
      })().then(done, fail);
    }));
  } finally { g.fetch = priorFetch; delete (FakeContext.prototype as unknown as { decodeAudioData?: unknown }).decodeAudioData; }
});
