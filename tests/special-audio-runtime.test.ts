import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { bossSpecialFor, bossSpecialId } from '../src/special-identity.ts';
import { SPECIAL_CUE_OF } from '../src/audio/special.ts';
import { createFeedback } from '../src/feedback.ts';

// Execute main's actual accepted-event loop and lifecycle reset, without duplicating its routing.
function routing() {
  const main = readFileSync('src/main.ts', 'utf8');
  const ast = ts.createSourceFile('main.ts', main, ts.ScriptTarget.Latest, true);
  const sync = ast.statements.find(s => ts.isFunctionDeclaration(s) && s.name?.text === 'syncSpecialAudio')!.getText(ast);
  const start = main.indexOf("      if (!specialTest && match.specials && match.mode !== 'pvp') for");
  assert.ok(start > 0);
  const loop = main.slice(start, main.indexOf('      feedback.update(', start));
  const played: unknown[] = [], cuts: unknown[] = [], wants: unknown[] = [];
  const match = { epoch: 1, specials: true, mode: 'career', opponent: { id: 'veteran' }, level: 46, clipLevel: null, practice: { duel: { tick: 100 } } };
  const context = { match, clip: null, specialTest: null, bossSpecialFor, bossSpecialId, SPECIAL_CUE_OF,
    feedback: { special: (...args: unknown[]) => played.push(args), cutSpecial: (actor?: number) => cuts.push(actor), want: (cue: string) => wants.push(cue) } };
  const code = `let specialAudioEpoch = -1, specialAudioTick = -1, specialAudioClipping = false; const specialAudioCasts = [-1,-1]; ${sync}
    globalThis.route = (events, quiet = false) => { const practice = {events}; ${loop} };
    globalThis.sync = syncSpecialAudio;`;
  runInNewContext(ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, context);
  return { ...context, played, cuts, wants, preview: () => { context.specialTest = 'tithe' as never; }, clipping: (on: boolean) => { context.clip = on ? { fresh: { duel: { tick: 99 } } } as never : null; }, ...(context as unknown as { route(events: unknown[], quiet?: boolean): void; sync(): void }) };
}
const start = (actor: 0 | 1, tick = 100, name = 'tithe') => ({ type: 'SpecialStarted', actor, tick, name });

test('actual main accepts each actor cast once, uses captured names and cuts only the fizzled actor', () => {
  const r = routing(); r.sync();
  assert.deepEqual(r.wants, ['tithe']);
  r.route([start(0), start(1, 100, 'wrath')]);
  for (let i = 0; i < 5; i++) r.route([start(0), start(1, 100, 'wrath')]);
  assert.deepEqual(r.played, [['tithe', 1, 0], ['wrath', 1, 1]]);
  r.route([{ type: 'SpecialFizzled', actor: 0, tick: 101 }]);
  assert.deepEqual(r.cuts, [0]);
  r.route([start(1, 240, 'nyxnightfall')]);
  assert.deepEqual(r.played.at(-1), ['nyx', 1, 1]);
  r.route([start(0, 250, 'unresolved')]);
  assert.equal(r.played.length, 3);
});

test('epoch/seek cuts both, quiet consumes starts, held/PVP/preview paths do not enter runtime audio', () => {
  const r = routing(); r.sync(); r.route([start(0)], true);
  r.route([start(0)]); assert.equal(r.played.length, 0, 'quiet cast cannot replay after resume');
  r.match.epoch++; r.sync(); r.route([start(0)]);
  assert.equal(r.played.length, 1, 'new epoch accepts same cast tick');
  r.match.practice.duel.tick = 99; r.sync(); r.route([start(1, 99)]);
  assert.equal(r.played.length, 2, 'seek starts a fresh generation');
  assert.deepEqual(r.cuts, [undefined, undefined, undefined]);
  r.match.specials = false; r.route([start(0, 300)]);
  r.match.specials = true; r.match.mode = 'pvp'; r.route([start(0, 301)]);
  r.match.mode = 'career'; r.preview(); r.route([start(0, 302)]);
  assert.equal(r.played.length, 2);
  r.clipping(true); r.sync(); r.clipping(false); r.sync();
  assert.equal(r.cuts.length, 5, 'clip enter/leave invalidates both voices');
});

function audioHost() {
  const param = () => ({ value: 0, setValueAtTime() {}, cancelScheduledValues() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {} });
  const starts: { stops: number[] }[] = [];
  const node = () => {
    const record = { stops: [] as number[] };
    return new Proxy({ connect() { return this; }, disconnect() {}, start() { starts.push(record); }, stop(t: number) { record.stops.push(t); }, onended: null }, { get: (o, k) => k in o ? (o as Record<string | symbol, unknown>)[k] : param() });
  };
  let resolve!: (buffer: AudioBuffer) => void;
  const decoded = new Promise<AudioBuffer>(r => { resolve = r; });
  const buffer = { duration: 3, length: 144000, numberOfChannels: 1, sampleRate: 48000, getChannelData: () => new Float32Array(1) } as unknown as AudioBuffer;
  const context = new Proxy({ state: 'running', currentTime: 5, sampleRate: 48000, destination: node(), decodeAudioData: () => decoded, createBuffer: (_c: number, length: number) => ({ duration: length / 48000, getChannelData: () => new Float32Array(length) }) }, { get: (o, k) => k in o ? (o as never)[k] : typeof k === 'string' && k.startsWith('create') ? node : undefined }) as unknown as BaseAudioContext;
  return { starts, resolve: () => resolve(buffer), feedback: createFeedback({ context, now: () => 5, sprite: null }) };
}

test('deferred decode cannot start stale casts; two actor handles preserve gain and independent cancellation', async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) })) as unknown as typeof fetch;
  try {
    const { feedback: f, starts, resolve } = audioHost();
    f.unlock(); f.want('tithe');
    assert.equal(f.special('tithe', 1, 0), null);
    f.cutSpecial(0); f.quiet(); f.toggle(); f.dispose();
    resolve(); await new Promise(r => setTimeout(r, 20));
    assert.equal(starts.length, 0, 'decode completion caches only, never starts an old cast');
    f.toggle(); f.unlock();
    f.special('tithe', 1, 0); f.special('tithe', 1, 1);
    assert.equal(starts.length, 2);
    const before = starts.map(s => s.stops.length);
    f.cutSpecial(0);
    assert.equal(starts[0].stops.length, before[0] + 1);
    assert.equal(starts[1].stops.length, before[1]);
    f.special('tithe', 1, 0);
    f.quiet(); assert.equal(starts[1].stops.length, before[1] + 1);
    assert.ok(starts[2].stops.length === 1);
    f.unlock(); f.special('tithe', 1, 0); f.special('tithe', 1, 1); f.toggle();
    assert.ok(starts.slice(-2).every(s => s.stops.length === 1), 'mute cuts both');
    f.toggle(); f.special('tithe', 1, 0); f.special('tithe', 1, 1); f.dispose();
    assert.ok(starts.slice(-2).every(s => s.stops.length === 1), 'dispose cuts both');
  } finally { globalThis.fetch = realFetch; }
});
