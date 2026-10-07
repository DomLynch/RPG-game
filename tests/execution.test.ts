import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Group, Object3D, Texture, Vector3 } from 'three';
import { readFileSync } from 'node:fs';
import { FINISHER_POSE, ROTATION, selectFinisher, type FinisherId } from '../src/finishers.ts';
import { EXECUTION_BEATS, EXECUTION_VICTIMS, executionAt, executionPick, poseOf, resolveExecution } from '../src/execution.ts';
import { HAMSTRUNG_VICTIMS, resolveHamstrung } from '../src/hamstrung.ts';
import { isHeld, resolveFinisher, ROSTER, type OpponentId } from '../src/roster.ts';
import { cuesFor, type DeathPresentation } from '../src/audio/cues.ts';
import { createFinisherBlood, finisherBloodSources } from '../src/finisher-blood.ts';
import type { CombatEvent } from '../src/combat.ts';
import type { Finish } from '../src/duel.ts';

const finish: Finish = { victim: 1, location: 'torso', move: 'critical', heading: 0, draw: false };
const swords = ['longsword', 'longsword'] as const;
const source = (file: string) => readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8');

test('Execution is not in the rotation and the automatic pick never reaches it: selection and the guarded tables are untouched', () => {
  assert.deepEqual([...ROTATION], ['splitCrown', 'decapitation', 'runThrough', 'plainDeath', 'opened']);
  for (let i = 0; i < 2000; i++) for (const move of ['critical', 'heavy_overhead', 'light_right'] as const) assert.notEqual(selectFinisher({ ...finish, move, heading: i / 7, location: i % 2 ? 'head' : 'torso' }, swords), 'execution');
  for (const id of Object.keys(FINISHER_POSE) as FinisherId[]) assert.equal(poseOf(id), id === 'execution' ? 'execution' : id === 'hamstrung' ? 'hamstrung' : FINISHER_POSE[id]);
  assert.equal(FINISHER_POSE.execution, null, 'the kill-link-guarded table is not edited');
});

test('the picker plays Execution only on playable hero-rig bodies (never a held one), and never overrides kill eligibility', () => {
  for (const id of EXECUTION_VICTIMS) assert.equal(isHeld(id), false, `${id} is held: it is out of the bundle and cannot play Execution`);
  assert.deepEqual([...EXECUTION_VICTIMS].sort(), (Object.keys(ROSTER) as OpponentId[]).filter(id => ROSTER[id].rig === 'hero' && !isHeld(id)).sort());
  assert.deepEqual([...EXECUTION_VICTIMS], [...HAMSTRUNG_VICTIMS], 'one victim rule for both paired scenes');
  for (const id of ['veteran', 'pitborn', 'executioner', 'dwarf'] as const) assert.ok(EXECUTION_VICTIMS.includes(id), id);
  for (const id of ['goblin', 'nightborn', 'minotaur', 'wraith', 'werewolf', 'skeleton'] as const) assert.ok(!EXECUTION_VICTIMS.includes(id), `${id} keeps a plain death`);
  for (const id of Object.keys(ROSTER) as OpponentId[]) {
    const weapons = ['longsword', ROSTER[id].weapon] as const, resolved = resolveFinisher(id, finish, weapons, null);
    assert.equal(resolveExecution(id, finish, weapons, 'execution', null, resolved), EXECUTION_VICTIMS.includes(id) ? 'execution' : null, `${id}: a body without the clip plays no ceremony for it`);
    for (const kill of [{ ...finish, draw: true }, { ...finish, victim: 0 as const }, { ...finish, move: 'kick' as const }]) assert.equal(resolveExecution(id, kill, weapons, 'execution', null, resolveFinisher(id, kill, weapons, null)), null);
    for (const pick of [null, 'opened', 'splitCrown', 'plainDeath', 'hamstrung'] as const) assert.equal(resolveExecution(id, finish, weapons, pick, null, resolveFinisher(id, finish, weapons, pick)), resolveFinisher(id, finish, weapons, pick));
    // The two paired picks never answer for each other.
    assert.notEqual(resolveHamstrung(id, finish, weapons, 'execution', null, resolved), 'hamstrung');
  }
});

test('an uninstalled Execution pick is the plain death for the picture and the cues alike (one id)', () => {
  assert.equal(executionPick('execution', false), 'plainDeath');
  assert.equal(executionPick('execution', true), 'execution');
  for (const pick of [null, 'opened', 'splitCrown', 'plainDeath', 'hamstrung'] as const) assert.equal(executionPick(pick, false), pick);
  const weapons = ['longsword', ROSTER.veteran.weapon] as const, plain = executionPick('execution', false);
  assert.equal(resolveExecution('veteran', finish, weapons, plain, null, resolveFinisher('veteran', finish, weapons, plain)), 'plainDeath');
  assert.match(source('scene.ts'), /executionPick\(hamstrungPick\(finisherOverride, hamstrungLatch === true\), executionLatch === true\)/);
  assert.match(source('main.ts'), /executionPick\(hamstrungPick\([^\n]*view\.hamstrungInstalled\(\)\), view\.executionInstalled\(\)\)/);
  assert.match(source('main.ts'), /\['execution', 'Execution'\]/, 'the dev picker lists it');
});

test('the held beat is half a second on the screen\'s own clock and the scene paces Execution at the spec\'s 0.75x with no frame-loop hit-stop', () => {
  assert.equal(EXECUTION_BEATS.hold, .5);
  assert.ok(Math.abs(executionAt(EXECUTION_BEATS.release) - executionAt(EXECUTION_BEATS.raise) - .5) < 1e-9);
  assert.equal(EXECUTION_BEATS.speed, .75);
  const total = executionAt(1);
  assert.ok(total > 3.2 && total < 3.7, `on-screen length ${total}`);
  const scene = source('scene.ts');
  assert.match(scene, /executionFinish \? \(dt \* EXECUTION_BEATS\.speed\) \/ EXECUTION_BEATS\.duration/, 'the clock runs the clip at the spec\'s speed');
  const clock = scene.slice(scene.indexOf('if (!practice.finish) { finishClock = -1;'), scene.indexOf('const victimProgress'));
  assert.doesNotMatch(clock, /finishHold = EXECUTION|executionFinish && finishHold/, 'the held half-second is in the clips, never a hit-stop');
  for (const file of ['scene.ts', 'main.ts']) assert.doesNotMatch(source(file), /finishHold\s*=\s*EXECUTION/);
});

const ev = (type: CombatEvent['type'], extra: Partial<CombatEvent> = {}): CombatEvent => ({ tick: 1, actor: 0, ...extra, type });
const presentation = (gore = true): DeathPresentation => ({ finish, weapons: swords, override: 'execution', gore });
const events = [ev('Hit', { move: 'critical', target: 1 }), ev('Killed', { move: 'critical', target: 1 })];

test('Execution\'s cues: the raise whooshes before the hold, one flesh cut on the nape, his voice, the body, the crowd; none on the killing tick, inside the voice cap', () => {
  const cues = cuesFor(events, presentation()), at = (name: string) => cues.filter(c => c.name === name).map(c => c.delay!);
  const raise = executionAt(EXECUTION_BEATS.raise), cut = executionAt(EXECUTION_BEATS.strike);
  assert.ok(cues.length <= 8 && cues.every(c => (c.delay ?? 0) > .3), 'every cue is on the scene, none on the killing tick');
  assert.ok(at('whoosh_heavy')[0] < raise, 'the windup is heard before the blade is up');
  assert.deepEqual(at('flesh_cut'), [cut]); assert.ok(at('death_voice')[0] > cut);
  assert.ok(at('kill')[0] > cut, 'the body falls after the cut');
  assert.ok(at('crowd_cheer')[0] > cut);
  assert.equal(cues.some(c => c.name.startsWith('hit_')), false);
  const off = cuesFor(events, presentation(false));
  assert.equal(off.some(c => c.name.startsWith('flesh_')), false); assert.equal(off.filter(c => c.name === 'hit_heavy').length, 1);
});

function victimRig() {
  const victim = new Group(), bones: Record<string, Vector3> = { neck_01: new Vector3(0, 1.0, 0), Head: new Vector3(0, 1.075, 0), spine_02: new Vector3(0, .8, 0), calf_r: new Vector3(.1, .3, 0) };
  for (const [name, p] of Object.entries(bones)) { const o = new Object3D(); o.name = name; o.position.copy(p); victim.add(o); }
  victim.updateMatrixWorld(true);
  return victim;
}

test('Execution bleeds from the nape only, after the cut: a readable jet leaning toward the killer, then a pool; the head stays whole; red, dark and off; cleared by the next fight', () => {
  const sources = finisherBloodSources('execution', victimRig(), null);
  assert.deepEqual(sources.map(s => s.site), ['nape-cut']);
  const [nape] = sources;
  assert.equal(nape.delay, executionAt(EXECUTION_BEATS.strike));
  assert.equal(nape.seed, 8);
  assert.ok(nape.strength >= 1.1 && nape.strength <= 1.4, `strength ${nape.strength} is in the readable range`);
  assert.ok(nape.direction.y > .5, 'the jet rises, so it shows against the armour');
  assert.ok(nape.strength * 78 < 160, 'one burst never outruns the 160-drop pool');
  assert.ok(!sources.some(s => /head|skull|neck-stump/.test(s.site)), 'Decapitation owns head removal');
  for (const mode of ['red', 'dark', 'off'] as const) {
    const blood = createFinisherBlood(new Texture());
    for (let i = 0; i < 100; i++) blood.update(1 / 60, 'execution', .5, sources, mode);
    assert.equal(blood.inspect().emitted, 0, `${mode}: nothing bleeds before the cut`);
    for (let i = 0; i < 90; i++) blood.update(1 / 60, 'execution', .5, sources, mode);
    const state = blood.inspect();
    if (mode === 'off') { assert.equal(state.visible, false); assert.equal(state.airborne, 0); }
    else { assert.ok(state.emitted > 20, `${mode}: the nape jets once it is cut`); assert.equal(state.visible, true); assert.equal(state.color, mode === 'dark' ? '2b2226' : '68121a'); }
    blood.update(1 / 60, null, 0, [], mode);   // the next fight
    assert.deepEqual([blood.inspect().emitted, blood.inspect().pools.length, blood.inspect().kind], [0, 0, null], `${mode}: cleared on rematch`);
    blood.dispose();
  }
});

// Lazy load, as Hamstrung's (tests/hamstrung.test.ts): a normal fight's ready never waits on, or fetches, the Execution assets.
test('a normal fight\'s ready path never fetches or awaits the Execution assets; the prefetch is after ready, on idle', () => {
  const scene = source('scene.ts');
  assert.equal([...scene.matchAll(/assets\/execution-/g)].length, 2, 'both clips are imported in one place only');
  const load = scene.slice(scene.indexOf('function loadFighters'), scene.indexOf("assetStatus('', 'ready');"));
  assert.doesNotMatch(load, /import\('\.\/assets\/execution|await[^\n]*execution|prepareExecution|wantExecution|executionAssets/i, 'loadFighters neither imports, awaits nor asks for them');
  assert.match(scene, /const wantExecution = \(prefetch = false\) => \{ if \(\(prefetch \|\| finisherOverride === 'execution'\) && warriors && EXECUTION_VICTIMS\.includes\(opponentId\)\) void executionAssets\.request\(warriors\); \};/);
  assert.match(scene, /setFinisherOverride\(id: FinisherId \| null\) \{\n\s*finisherOverride = id;\n\s*wantHamstrung\(\);\n\s*wantExecution\(\);/, 'the picker choosing it starts the fetch');
  const ready = scene.indexOf("assetStatus('', 'ready');");
  assert.match(scene.slice(ready, ready + 400), /^assetStatus\('', 'ready'\);\n\s*prefetchHamstrung\(\);/, 'the one idle prefetch (Hamstrung\'s only; Execution loads on the picker\'s choice) follows ready, unawaited');
  assert.match(scene, /const prefetchHamstrung = \(\) => \{ const start = \(\) => \{ wantHamstrung\(true\); \};[^\n]*requestIdleCallback\(start, \{ timeout: 4000 \}\)[^\n]*setTimeout\(start, 1500\)/);
  assert.doesNotMatch(scene, /wantExecution\(true\)/, 'picker-only Execution is never prefetched (Lead\'s ruling on the Auditor MEDIUM)');
  assert.match(scene, /executionAssets = createHamstrungAssets\([\s\S]*?\(error\) => \{ captureException\(error\); \},\n\s*\);/, 'a failure is reported to Sentry only, never thrown');
});
