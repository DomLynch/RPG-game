import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Group, Object3D, Texture, Vector3 } from 'three';
import { FINISHER_POSE, ROTATION, selectFinisher, type FinisherId } from '../src/finishers.ts';
import { HAMSTRUNG_BEATS, HAMSTRUNG_VICTIMS, hamstrungPick, poseOf, resolveHamstrung } from '../src/hamstrung.ts';
import { createHamstrungAssets } from '../src/hamstrung-assets.ts';
import { readFileSync } from 'node:fs';
import { isHeld, resolveFinisher, ROSTER, type OpponentId } from '../src/roster.ts';
import { cuesFor, type DeathPresentation } from '../src/fight/sound/cues.ts';
import { createFinisherBlood, finisherBloodSources } from '../src/finisher-blood.ts';
import type { CombatEvent } from '../src/combat.ts';
import type { Finish } from '../src/duel.ts';

const finish: Finish = { victim: 1, location: 'legs', move: 'light_right', heading: 0, draw: false };
const swords = ['longsword', 'longsword'] as const;

test('Hamstrung is not in the rotation and the automatic pick never reaches it: selection is untouched', () => {
  assert.deepEqual([...ROTATION], ['splitCrown', 'decapitation', 'runThrough', 'plainDeath', 'opened']);
  for (let i = 0; i < 2000; i++) assert.notEqual(selectFinisher({ ...finish, heading: i / 7, location: i % 2 ? 'legs' : 'torso' }, swords), 'hamstrung');
  for (const id of Object.keys(FINISHER_POSE) as FinisherId[]) assert.equal(poseOf(id), id === 'hamstrung' ? 'hamstrung' : FINISHER_POSE[id]);
  assert.equal(FINISHER_POSE.hamstrung, null, 'the kill-link-guarded table is not edited');
});

test('the picker plays Hamstrung only on playable hero-rig bodies (never a held one), and never overrides kill eligibility', () => {
  for (const id of HAMSTRUNG_VICTIMS) assert.equal(isHeld(id), false, `${id} is held: it is out of the bundle and cannot play Hamstrung`);
  assert.deepEqual([...HAMSTRUNG_VICTIMS].sort(), (Object.keys(ROSTER) as OpponentId[]).filter(id => ROSTER[id].rig === 'hero' && !isHeld(id)).sort());
  for (const id of ['veteran', 'pitborn', 'executioner', 'dwarf'] as const) assert.ok(HAMSTRUNG_VICTIMS.includes(id), id);
  for (const id of ['goblin', 'nightborn', 'minotaur', 'wraith', 'werewolf', 'skeleton'] as const) assert.ok(!HAMSTRUNG_VICTIMS.includes(id), `${id} keeps a plain death`);
  for (const id of Object.keys(ROSTER) as OpponentId[]) {
    const weapons = ['longsword', ROSTER[id].weapon] as const, resolved = resolveFinisher(id, finish, weapons, 'hamstrung');
    const got = resolveHamstrung(id, finish, weapons, 'hamstrung', null, resolved);
    assert.equal(got, HAMSTRUNG_VICTIMS.includes(id) ? 'hamstrung' : null, `${id}: a body without the clip plays no ceremony for it`);
    for (const kill of [{ ...finish, draw: true }, { ...finish, victim: 0 as const }, { ...finish, move: 'kick' as const }]) assert.equal(resolveHamstrung(id, kill, weapons, 'hamstrung', null, resolveFinisher(id, kill, weapons, 'hamstrung')), null);
    // Any other pick, or Auto, is exactly what resolveFinisher said.
    for (const pick of [null, 'opened', 'splitCrown', 'plainDeath'] as const) assert.equal(resolveHamstrung(id, finish, weapons, pick, null, resolveFinisher(id, finish, weapons, pick)), resolveFinisher(id, finish, weapons, pick));
  }
});

const ev = (type: CombatEvent['type'], extra: Partial<CombatEvent> = {}): CombatEvent => ({ tick: 1, actor: 0, ...extra, type });
const presentation = (gore = true): DeathPresentation => ({ finish, weapons: swords, override: 'hamstrung', gore });
const events = [ev('Hit', { move: 'light_right', target: 1 }), ev('Killed', { move: 'light_right', target: 1 })];

test('Hamstrung times two blows with a roll between them, no killing-tick thump, the crowd after the second blow, inside the voice cap', () => {
  const cues = cuesFor(events, presentation()), at = (name: string) => cues.filter(c => c.name === name).map(c => c.delay!);
  const knee = HAMSTRUNG_BEATS.knee * HAMSTRUNG_BEATS.duration, back = HAMSTRUNG_BEATS.back * HAMSTRUNG_BEATS.duration + HAMSTRUNG_BEATS.hold;
  assert.ok(cues.length <= 8 && cues.every(c => (c.delay ?? 0) > .3), 'every cue is on the scene, none on the killing tick');
  assert.deepEqual(at('flesh_cut'), [knee]); assert.deepEqual(at('flesh_stab'), [back]);
  assert.ok(at('roll')[0] > knee && at('roll')[0] < back);
  assert.ok(at('crowd_cheer')[0] > back);
  assert.equal(cues.some(c => c.name.startsWith('hit_')), false);
  const off = cuesFor(events, presentation(false));
  assert.equal(off.some(c => c.name.startsWith('flesh_')), false); assert.equal(off.filter(c => c.name === 'hit_heavy').length, 2);
});

test('Hamstrung bleeds at the knee first and the back second, each after its own blow', () => {
  const victim = new Group(), bones: Record<string, Vector3> = { neck_01: new Vector3(0, 1.5, 0), Head: new Vector3(0, 1.65, 0), spine_02: new Vector3(0, 1.3, 0), calf_r: new Vector3(.1, .5, 0) };
  for (const [name, p] of Object.entries(bones)) { const o = new Object3D(); o.name = name; o.position.copy(p); victim.add(o); }
  const sources = finisherBloodSources('hamstrung', victim, null);
  assert.deepEqual(sources.map(s => s.site), ['knee-cut', 'back-entry']);
  assert.ok(sources[0].delay! < sources[1].delay!);
  const blood = createFinisherBlood(new Texture());
  for (let i = 0; i < 40; i++) blood.update(1 / 60, 'hamstrung', .5, sources, 'red');
  assert.equal(blood.inspect().emitted, 0, 'nothing bleeds before the first blow');
  for (let i = 0; i < 120; i++) blood.update(1 / 60, 'hamstrung', .5, sources, 'red');
  assert.ok(blood.inspect().emitted > 20, 'the knee bleeds once it is cut');
  blood.dispose();
});

// Lazy load (Auditor on 4faa85d4): a normal fight's ready never waits on, or fetches, the Hamstrung assets.
test('the Hamstrung assets are fetched only on request, once, and a failure leaves the scene on the plain death', async () => {
  let fetches = 0, installs = 0; const errors: unknown[] = [], rigs = { a: {}, b: {} };
  const assets = createHamstrungAssets(async () => { fetches++; return 1; }, () => { installs++; }, (e) => errors.push(e));
  assert.equal(fetches, 0, 'building the scene fetches nothing'); assert.equal(assets.ready(rigs.a), false);
  await assets.request(rigs.a); await assets.request(rigs.a);
  assert.deepEqual([fetches, installs, assets.ready(rigs.a), assets.ready(rigs.b)], [1, 1, true, false]);
  await assets.request(rigs.b);   // a rebuilt pair of rigs reuses the fetched data
  assert.deepEqual([fetches, installs, assets.ready(rigs.b)], [1, 2, true]);
  const broken = createHamstrungAssets(async () => { throw new Error('offline'); }, () => { installs++; }, (e) => errors.push(e));
  await broken.request(rigs.a); await broken.request(rigs.a);
  assert.equal(broken.ready(rigs.a), false); assert.equal(errors.length, 1, 'reported once');
  const bad = createHamstrungAssets(async () => 1, () => { throw new Error('bake'); }, (e) => errors.push(e));
  await bad.request(rigs.a); assert.equal(bad.ready(rigs.a), false, 'a failed install is not ready');
});

test('an uninstalled Hamstrung pick is the plain death for the picture and the cues alike', () => {
  assert.equal(hamstrungPick('hamstrung', false), 'plainDeath');
  assert.equal(hamstrungPick('hamstrung', true), 'hamstrung');
  for (const pick of [null, 'opened', 'splitCrown', 'plainDeath'] as const) assert.equal(hamstrungPick(pick, false), pick);
  const weapons = ['longsword', ROSTER.veteran.weapon] as const, plain = hamstrungPick('hamstrung', false);
  assert.equal(resolveHamstrung('veteran', finish, weapons, plain, null, resolveFinisher('veteran', finish, weapons, plain)), 'plainDeath');
  // scene.ts and main.ts both take their pick from hamstrungPick, so the render and cues.ts see one id.
  const source = (file: string) => readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8');
  assert.match(source('scene.ts'), /hamstrungPick\(finisherOverride, hamstrungLatch === true\)/);
  assert.match(source('main.ts'), /hamstrungPick\([^\n]*view\.hamstrungInstalled\(\)\)/);
});

test('a normal fight\'s ready path never fetches or awaits the Hamstrung assets', () => {
  const scene = readFileSync(new URL('../src/scene.ts', import.meta.url), 'utf8');
  assert.equal([...scene.matchAll(/assets\/hamstrung-/g)].length, 2, 'both clips are imported in one place only');
  const load = scene.slice(scene.indexOf('function loadFighters'), scene.indexOf("assetStatus('', 'ready');"));
  assert.doesNotMatch(load, /import\('\.\/assets\/hamstrung|await[^\n]*hamstrung|prepareHamstrung/i, 'loadFighters neither imports nor awaits them');
  assert.doesNotMatch(load, /wantHamstrung|prefetchHamstrung/, 'ready neither asks for nor awaits the clips');
  assert.match(scene, /const wantHamstrung = \(prefetch = false\) => \{ if \(\(prefetch \|\| finisherOverride === 'hamstrung'\) && warriors && HAMSTRUNG_VICTIMS\.includes\(opponentId\)\) void hamstrungAssets\.request\(warriors\); \};/);
  assert.match(scene, /setFinisherOverride\(id: FinisherId \| null\) \{\n\s*finisherOverride = id;\n\s*wantHamstrung\(\);/, 'the picker choosing it starts the fetch');
});

test('the Hamstrung prefetch starts only after ready, unawaited, on idle, and its failure stays silent', () => {
  const scene = readFileSync(new URL('../src/scene.ts', import.meta.url), 'utf8');
  const ready = scene.indexOf("assetStatus('', 'ready');"), calls = [...scene.matchAll(/\bprefetchHamstrung\(\)/g)].map((m) => m.index!);
  assert.equal(calls.length, 1, 'one call site');
  assert.match(scene.slice(ready, ready + 400), /^assetStatus\('', 'ready'\);\n\s*prefetchHamstrung\(\);/, 'immediately after ready, not awaited');
  assert.match(scene, /const prefetchHamstrung = \(\) => \{[^\n]*requestIdleCallback\(start, \{ timeout: 4000 \}\)[^\n]*setTimeout\(start, 1500\)/, 'on idle with a timer fallback');
  assert.match(scene, /\(error\) => \{ captureException\(error\); \},\n\s*\);/, 'a failure is reported to Sentry only, never thrown');
});
