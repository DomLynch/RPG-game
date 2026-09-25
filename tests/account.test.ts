import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as profile from '../src/profile.ts';
import * as cloudProfile from '../src/cloud-profile.ts';
import * as career from '../src/career.ts';
import * as loot from '../src/loot.ts';
import { session } from '../src/session.ts';

// Execute the real account module against a fake Supabase client whose reads answer at once and whose writes answer when the test
// says so, so the order of responses is the test's to choose.
const code = ts.transpileModule(readFileSync(new URL('../src/account.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
class Element extends EventTarget { hidden = false; disabled = false; textContent = ''; dataset: Record<string, string> = {}; }

function mount(users: Record<string, cloudProfile.CloudProfile | null>) {
  const elements = new Map<string, Element>(), get = (id: string) => { if (!elements.has(id)) elements.set(id, new Element()); return elements.get(id)!; };
  const stored = new Map<string, string>([['frankendom.fighter.v1', JSON.stringify({ version: 1, id: 'harness-fighter', name: 'Tester' })]]);
  const localStorage = { getItem: (k: string) => stored.get(k) ?? null, setItem: (k: string, v: string) => { stored.set(k, v); } };
  let userId = 'user-a', onAuth: (event: string) => void = () => {};
  const writes: { userId: string; revision: number | null; answer: (saved: cloudProfile.CloudProfile) => void }[] = [];
  const db = { auth: { getSession: async () => ({ data: { session: { user: { id: userId, email: `${userId}@x` } } }, error: null }), onAuthStateChange: (cb: (event: string) => void) => { onAuth = cb; } } };
  const cloud = { ...cloudProfile,
    readFighter: async (_db: unknown, id: string) => users[id] ?? null, readAdmin: async () => false,
    writeFighter: (_db: unknown, id: string, _profile: profile.Profile, revision: number | null) => new Promise<cloudProfile.CloudProfile>(answer => { writes.push({ userId: id, revision, answer }); }),
  };
  const modules: Record<string, unknown> = { '@supabase/supabase-js': { createClient: () => db }, './profile.ts': profile, './cloud-profile.ts': cloud, './career.ts': career, './loot.ts': loot, './session.ts': { session } };
  const win = new EventTarget(), exports: { mountAccount?: (url: string, key: string) => Promise<void> } = {};
  runInNewContext(code, { require: (id: string) => modules[id] || {}, exports, window: win, Event, URL, localStorage, crypto: { randomUUID: () => 'test' },
    document: { getElementById: get }, location: { href: 'https://frankendom.com/', origin: 'https://frankendom.com' }, history: { replaceState() {} },
    setTimeout: (cb: () => void) => { cb(); return 0; }, AbortSignal, fetch: () => Promise.reject(Error('no network')) });
  const settle = () => new Promise(r => setImmediate(r));
  return { mounted: exports.mountAccount!('https://db', 'key'), writes, settle, element: get, signIn(id: string) { userId = id; onAuth('SIGNED_IN'); }, window: win,
    rename(name: string) { stored.set('frankendom.fighter.v1', JSON.stringify({ ...JSON.parse(stored.get('frankendom.fighter.v1')!), name })); win.dispatchEvent(new Event('frankendom:profile')); } };
}

const cloudOf = (name: string, revision: number): cloudProfile.CloudProfile => ({ display_name: name, encounter: null, victory_marks: 0, loot: { owned: [], equipped: {} }, revision } as unknown as cloudProfile.CloudProfile);

test('account: a save answered after the account changed is not the new account\'s cached save — the next write goes up on the new account\'s revision (audit 2026-09-25, C)', async () => {
  const app = mount({ 'user-a': null, 'user-b': cloudOf('Bea', 5) });
  await app.settle();
  assert.equal(app.writes.length, 1); assert.equal(app.writes[0]!.userId, 'user-a'); assert.equal(app.writes[0]!.revision, null, 'A\'s first save: this device\'s fighter, no revision yet');
  app.writes[0]!.answer(cloudOf('Al', 1)); await app.settle(); await app.settle();   // the first refresh completes: the auth listener is live from here, as in the page
  assert.equal(app.element('account-status').dataset.saved, 'Al');
  app.rename('Tester the Second');                       // a change on the device: A's second save goes up and stays in the air
  await app.settle();
  assert.equal(app.writes.length, 2); assert.equal(app.writes[1]!.userId, 'user-a'); assert.equal(app.writes[1]!.revision, 1);
  app.signIn('user-b');                                   // B signs in while A's write is in the air; refresh reads B's save (revision 5)
  await app.settle(); await app.settle();
  assert.equal(app.element('account-identity').textContent, 'user-b@x');
  assert.equal(app.writes.length, 2, 'B\'s pending change waits behind the write in flight');
  app.writes[1]!.answer(cloudOf('Al', 2));                // A's late answer lands now
  await app.settle(); await app.settle();
  assert.equal(app.writes.length, 3, 'the queue writes B\'s device profile next');
  assert.equal(app.writes[2]!.userId, 'user-b');
  assert.equal(app.writes[2]!.revision, 5, 'on B\'s own revision: A\'s answer never became the cached save');
  app.writes[2]!.answer(cloudOf('Bea', 6));
  await app.settle(); await app.settle();
  assert.equal(app.element('account-status').dataset.saved, 'Bea', 'the save line settles on B');
  await app.mounted;
});
