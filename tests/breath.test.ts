import { test } from 'node:test';
import assert from 'node:assert/strict';
import { breathLook, breathPlan, bodyOf, createBreath } from '../src/audio/breath.ts';
import { FRESH, type Fatigue } from '../src/fatigue.ts';

const at = (level: number, band: Fatigue['band'], extra: Partial<Fatigue> = {}): Fatigue => ({ level, band, gassed: band === 3 ? 1 : 0, second: 0, ...extra });

test('each band has its own breath: faint and slow, then fast and bright, then short ragged gasps; fresh is silent', () => {
  assert.equal(breathPlan(FRESH), null);
  const winded = breathPlan(at(.5, 1))!, tired = breathPlan(at(.8, 2))!, gassed = breathPlan(at(1, 3))!;
  assert.ok(winded.period > tired.period && tired.period > gassed.period, 'the pace quickens');
  assert.ok(winded.peak < tired.peak && tired.peak < gassed.peak, 'the breath deepens');
  assert.ok(winded.centre < tired.centre && tired.centre < gassed.centre, 'nose-soft to mouth-bright');
  assert.deepEqual([winded.ragged, tired.ragged, gassed.ragged], [false, false, true]);
  assert.ok(winded.peak <= .04, 'winded is faint, under the mix');
});

test('the pace and depth are continuous in level, so the next breath never jumps a band', () => {
  const a = breathPlan(at(.74, 1))!, b = breathPlan(at(.76, 2))!;
  assert.ok(Math.abs(a.period - b.period) < .1 && Math.abs(a.peak - b.peak) < .005);
});

test('bodies pace themselves: the Goblin quick and shallow, big bodies slow and deep, the undead do not breathe', () => {
  const f = at(.9, 2), man = breathPlan(f, bodyOf(undefined)!)!, goblin = breathPlan(f, bodyOf('goblin')!)!, minotaur = breathPlan(f, bodyOf('minotaur')!)!;
  assert.ok(goblin.period < man.period && man.period < minotaur.period, 'pace');
  assert.ok(goblin.peak < man.peak && man.peak < minotaur.peak, 'depth');
  assert.equal(bodyOf('skeleton'), null); assert.equal(bodyOf('wraith'), null);
});

// A recording context: every AudioParam logs its scheduled events so the envelope can be inspected.
const recorder = () => {
  const gains: { events: [string, number, number][] }[] = [], nodes: unknown[] = [];
  const param = (log?: { events: [string, number, number][] }) => ({ value: 0, setValueAtTime(v: number, t: number) { log?.events.push(['set', v, t]); }, linearRampToValueAtTime(v: number, t: number) { log?.events.push(['ramp', v, t]); }, cancelScheduledValues(t: number) { log?.events.push(['cancel', 0, t]); } });
  const node = (log?: { events: [string, number, number][] }) => { const n = { buffer: null, loop: false, type: '', Q: param(), frequency: param(), gain: param(log), connect: (x: unknown) => x, disconnect() {}, start() {}, stop() {}, onended: null as unknown }; nodes.push(n); return n; };
  const context = { createGain: () => { const log = { events: [] }; gains.push(log); return node(log); }, createBufferSource: () => node(), createBiquadFilter: () => node() } as unknown as BaseAudioContext;
  return { context, gains };
};

test('breaths are scheduled whole: every inhale swell returns to zero, and a rest only changes the next breath', () => {
  const { context, gains } = recorder(), breath = createBreath(context, {} as AudioNode, {} as AudioBuffer, () => .5);
  breath.update(0, [at(.7, 1), FRESH], 'goblin');
  breath.update(.2, [at(.7, 1), FRESH], 'goblin');
  const hero = gains[1].events.filter(e => e[0] !== 'cancel');   // gains[0] is the master; the hero's is the first side opened
  assert.ok(hero.length >= 3, 'a breath is scheduled ahead');
  assert.equal(hero[0][1], 0, 'it starts from silence'); assert.ok(hero.some(e => e[0] === 'ramp' && e[1] > 0), 'it swells');
  assert.equal(hero.filter(e => e[0] === 'ramp').at(-1)![1], 0, 'and ends at zero, never mid-swell');
  assert.equal(gains.length, 2, 'the fresh foe opens no voice');
});

test('a hit ducks the breath and brings it back; the end of the duel fades it out', () => {
  const { context, gains } = recorder(), breath = createBreath(context, {} as AudioNode, {} as AudioBuffer, () => .5);
  breath.duck(1);
  const master = gains[0].events; assert.deepEqual(master.map(e => e[0]), ['cancel', 'set', 'ramp', 'ramp']);
  assert.ok(master[2][1] < .5 && master[3][1] === 1 && master[3][2] > master[2][2], 'down quickly, back to full');
  breath.update(2, [at(.9, 2), FRESH], undefined); breath.cut(3);
  const side = gains[1].events; assert.equal(side.at(-1)![0], 'ramp'); assert.equal(side.at(-1)![1], 0);
});

test('leaving exhaustion triggers one long release exhale, once', () => {
  const { context, gains } = recorder(), breath = createBreath(context, {} as AudioNode, {} as AudioBuffer, () => .5);
  const second = at(.6, 1, { second: 1 });
  breath.update(0, [second, FRESH], undefined); breath.update(.1, [{ ...second, second: .99 }, FRESH], undefined);
  const ramps = gains[1].events.filter(e => e[0] === 'ramp');
  assert.ok(ramps.some(e => e[2] - 0 >= 1.3), 'a long exhale'); assert.equal(ramps.at(-1)![1] > -1, true);
});

test('?look=fatigue-preview is the breath\'s only switch: absent = silent, listed among other looks = on', () => {
  assert.equal(breathLook(''), false);
  assert.equal(breathLook('?look=defence'), false);
  assert.equal(breathLook('?look=fatigue-preview'), true);
  assert.equal(breathLook('?x=1&look=defence,fatigue-preview&stamina=8'), true);
});
