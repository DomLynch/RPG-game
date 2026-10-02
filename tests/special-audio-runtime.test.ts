import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { bossSpecialFor, bossSpecialId } from '../src/special-identity.ts';
import { classSpecialFor } from '../src/class-special-identity.ts';
import { SPECIAL_CUE_OF } from '../src/audio/special.ts';
import { specialCueFor } from '../src/sparring-special-runtime.ts';
import type { OpponentId } from '../src/roster.ts';
import { specialOf } from '../src/moves.ts';
import { createFeedback } from '../src/feedback.ts';

// Execute main's actual accepted-event loop and lifecycle reset, without duplicating its routing.
function routing() {
  const main = readFileSync('src/main.ts', 'utf8');
  const ast = ts.createSourceFile('main.ts', main, ts.ScriptTarget.Latest, true);
  const sync = ast.statements.find(s => ts.isFunctionDeclaration(s) && s.name?.text === 'syncSpecialAudio')!.getText(ast);
  let accepted: ts.IfStatement | undefined;
  const visit = (node: ts.Node) => {
    if (ts.isIfStatement(node) && ts.isForOfStatement(node.thenStatement)
      && node.thenStatement.expression.getText(ast) === 'practice.events'
      && node.getText(ast).includes('specialAudioCasts[e.actor]')) accepted = node;
    ts.forEachChild(node, visit);
  };
  visit(ast);
  assert.ok(accepted, 'execute the actual guarded per-actor accepted-event loop');
  const start = accepted.getStart(ast);
  const loop = main.slice(start, main.indexOf('      feedback.update(', start));
  const played: unknown[] = [], cuts: unknown[] = [], wants: unknown[] = [];
  const match = { epoch: 1, specials: true, mode: 'career', opponent: { id: 'veteran' }, level: 46, specialIdentity: { opponent: 'veteran' as OpponentId, level: 46 }, clipLevel: null, replay: null as { record: { level: number } } | null, practice: { duel: { tick: 100 } } };
  const context = { match, clip: null, specialTest: null, bossSpecialFor, bossSpecialId, classSpecialFor, SPECIAL_CUE_OF, specialCueFor,
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

const unnamed = (actor: 0 | 1, tick = 100) => ({ type: 'SpecialStarted', actor, tick });
test('actual class audio follows approved opponent band boundaries and leaves unknown/player casts silent', () => {
  const rows = [
    ['witch', 'wake', 'stirring'], ['plaguedoctor', 'tempo', 'pulse'],
    ['knight', 'drag', 'swing'], ['nightborn', null, 'cuts'],
  ] as const;
  for (const [opponent, a, b] of rows) for (const level of [1, 15, 16, 35, 36]) {
    const r = routing(); r.match.opponent.id = opponent; r.match.level = level; r.match.specialIdentity = { opponent, level }; r.sync();
    r.route([unnamed(0), unnamed(1)]);
    for (let i = 0; i < 5; i++) r.route([unnamed(0), unnamed(1)]);
    const cue = level < 16 ? a : level < 36 ? b : null;
    assert.deepEqual(r.played, cue ? [[cue, 1, 1]] : [], `${opponent} L${level}`);
    if (cue) assert.deepEqual(r.wants, [cue], 'prefetch and accepted cast share identity');
    r.route([{ type: 'SpecialFizzled', actor: 1, tick: 101 }]);
    assert.deepEqual(r.cuts, [1]);
  }
  for (const opponent of ['veteran', 'goblin', 'pitborn', 'executioner', 'dwarf', 'shieldmaiden', 'unknown']) {
    const r = routing(); r.match.opponent.id = opponent; r.match.level = 16; r.match.specialIdentity = { opponent: opponent as OpponentId, level: 16 }; r.sync(); r.route([unnamed(1)]);
    assert.deepEqual(r.played, [], `${opponent} has no authored class cue`);
  }
});

test('class audio snapshots accepted identity across rematch and uses replay/clip level rather than the current dial', () => {
  const r = routing(); r.match.opponent.id = 'witch'; r.match.level = 15; r.match.specialIdentity = { opponent: 'witch', level: 15 }; r.sync(); r.route([unnamed(1)]);
  r.match.level = 16; r.route([unnamed(1)]);
  assert.deepEqual(r.played, [['wake', 1, 1]], 'an already consumed cast cannot turn into the new band');
  r.route([unnamed(1, 240)]);
  assert.deepEqual(r.played.at(-1), ['wake', 1, 1], 'the next accepted cast still uses captured fight metadata');
  r.match.epoch++; r.match.specialIdentity = { opponent: 'witch', level: 16 }; r.sync(); r.route([unnamed(1)]);
  assert.deepEqual(r.played.at(-1), ['stirring', 1, 1]);
  r.match.level = 46; r.match.replay = { record: { level: 15 } }; r.match.specialIdentity = { opponent: 'witch', level: 15 }; r.match.epoch++; r.sync(); r.route([unnamed(1)]);
  assert.deepEqual(r.played.at(-1), ['wake', 1, 1], 'record level survives a different current dial');
  assert.equal(r.wants.at(-1), 'wake', 'replay prefetch resolves the same cue');
  r.route([unnamed(1, 240)], true); r.route([unnamed(1, 240)]);
  assert.equal(r.played.length, 4, 'quiet decode/resume cannot revive the consumed class cast');
});

// Stand Fast and Rat Run are selected presentation IDs, but have no authored audio.
test('selected classes without a cue stay silent and never enqueue an undefined prefetch', () => {
  for (const opponent of ['veteran', 'goblin'] as const) for (const level of [1, 15, 16, 35, 36]) {
    const r = routing(); r.match.specialIdentity = { opponent, level }; r.sync();
    r.route([unnamed(1)]);
    assert.deepEqual(r.played, []);
    assert.ok(r.wants.every(cue => typeof cue === 'string'), `${opponent} L${level} never requests undefined`);
    if (level < 36) assert.deepEqual(r.wants, [], 'no substitute for the missing authored cue');
  }
});

test('all 30 existing boss identities still prefetch and play their authored cue', () => {
  const rows = [
    ['veteran', ['quake', 'charge', 'tithe']], ['nightborn', ['redwind', 'hades', 'nyx']],
    ['goblin', ['fistful', 'gone', 'liars']], ['pitborn', ['cracking', 'ashfall', 'windwall']],
    ['executioner', ['baying', 'longshadow', 'harvest']], ['dwarf', ['theword', 'threeblows', 'rimshake']],
    ['shieldmaiden', ['baredface', 'thering', 'aegis']], ['witch', ['avalon', 'foretold', 'theprice']],
    ['plaguedoctor', ['plagueflies', 'poisonstain', 'lastbreath']], ['knight', ['thesling', 'wrath', 'storm']],
  ] as const;
  for (const [opponent, cues] of rows) for (const [i, level] of [36, 41, 46].entries()) {
    const r = routing(); r.match.specialIdentity = { opponent, level }; r.sync();
    r.route([start(1, 100, specialOf(opponent, level)!)]);
    assert.deepEqual(r.wants, [cues[i]], `${opponent} L${level} prefetch`);
    assert.deepEqual(r.played, [[cues[i], 1, 1]], `${opponent} L${level} cast`);
  }
});
