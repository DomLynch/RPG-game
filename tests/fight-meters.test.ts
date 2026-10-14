// createZoneBars (src/fight/hud.ts): the zone page paints the PIT's own bars (#opponent-name, #target-health, #player-health, #stamina) through the same fillMeter / paintMeter the Pit's createHud uses, and the Pit's own numbers are unchanged by the extraction.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createZoneBars, fillMeter, paintMeter } from '../src/fight/hud.ts';

class El {
  children: El[] = []; hidden = false; className = ''; textContent = ''; dataset: Record<string, string> = {}; value = 0; max = 1; attrs: Record<string, string> = {}; props = new Map<string, string>(); classes = new Set<string>();
  style = { setProperty: (k: string, v: string) => { this.props.set(k, v); } };
  classList = { toggle: (c: string, on: boolean) => { if (on) this.classes.add(c); else this.classes.delete(c); } };
  tag: string; ownerDocument: { createElement(tag: string): El };
  constructor(tag: string, ownerDocument: { createElement(tag: string): El }) { this.tag = tag; this.ownerDocument = ownerDocument; }   // no parameter properties: node's strip-only TypeScript refuses them
  setAttribute(k: string, v: string) { this.attrs[k] = v; }
  append(...kids: El[]) { this.children.push(...kids); }
}
const doc = { createElement(tag: string) { return new El(tag, doc); } };
const IDS = ['opponent-name', 'target-health', 'player-health', 'stamina', 'health-value', 'player-health-value', 'stamina-value'];
const mount = () => {
  const body = new El('body', doc), pit = Object.fromEntries(IDS.map((id) => [id, new El(id.endsWith('value') || id === 'opponent-name' ? 'span' : 'meter', doc)]));
  const m = createZoneBars(((id: string) => pit[id]) as never, body as never);
  return { body, m, pit, flash: body.children[0]! };
};

test('fillMeter and paintMeter write the --fill percentage the style sheets draw (max, value, fill)', () => {
  const m = new El('meter', doc) as never as HTMLMeterElement;
  paintMeter(m, 75, 150);
  assert.equal((m as never as El).max, 150); assert.equal((m as never as El).value, 75); assert.equal((m as never as El).props.get('--fill'), '50%');
  fillMeter(m, 25, 100); assert.equal((m as never as El).props.get('--fill'), '25%');
  fillMeter(m, -2, 100); assert.equal((m as never as El).props.get('--fill'), '0%', 'a negative value never draws below an empty bar');
});

test('createZoneBars: hidden until shown (body.zone-bars), then the Pit\'s own bars are painted from plain numbers', () => {
  const { m, body, pit } = mount();
  assert.equal(body.classes.has('zone-bars'), false);
  m.update({ hp: 60, maxHp: 120, stamina: 30, maxStamina: 120, foe: { name: 'Goblin', hp: 10, max: 40 } }, true);
  assert.equal(body.classes.has('zone-bars'), true);
  assert.equal(pit['opponent-name']!.textContent, 'GOBLIN'); assert.equal(pit['opponent-name']!.dataset.mobile, 'Goblin', 'the phone draws data-mobile');
  assert.equal(pit['player-health']!.props.get('--fill'), '50%'); assert.equal(pit['stamina']!.props.get('--fill'), '25%'); assert.equal(pit['target-health']!.props.get('--fill'), '25%');
  assert.equal(pit['player-health']!.value, 60); assert.equal(pit['player-health']!.max, 120);
  assert.equal(pit['player-health-value']!.textContent, '60 / 120'); assert.equal(pit['stamina-value']!.textContent, '30 / 120'); assert.equal(pit['health-value']!.textContent, '10 / 40');
  m.update({ hp: 60, maxHp: 120, stamina: 30, maxStamina: 120, foe: null }, true);
  assert.equal(pit['opponent-name']!.textContent, ''); assert.equal(pit['target-health']!.props.get('--fill'), '0%'); assert.equal(pit['health-value']!.textContent, '');
  m.update({ hp: 120, maxHp: 120, stamina: 120, maxStamina: 120, foe: null }, false);
  assert.equal(body.classes.has('zone-bars'), false);
});

test('createZoneBars.feed: shown while the hero is hurt, a foe is in reach or a fight is on; hidden when whole and alone', () => {
  const { m, body } = mount(), hero = (health: number) => () => ({ health, max: 100, stamina: 100, maxStamina: 100 });
  m.feed({ hero: hero(100), target: () => null, inCombat: () => false }); assert.equal(body.classes.has('zone-bars'), false);
  m.feed({ hero: hero(60), target: () => null, inCombat: () => false }); assert.equal(body.classes.has('zone-bars'), true);
  m.feed({ hero: hero(100), target: () => ({ name: 'Wolf', health: 5, max: 10 }), inCombat: () => false }); assert.equal(body.classes.has('zone-bars'), true);
  m.feed({ hero: hero(100), target: () => null, inCombat: () => true }); assert.equal(body.classes.has('zone-bars'), true);
});

test('createZoneBars.flash: the hit vignette goes on, and off again after 120 ms', async () => {
  const { m, flash } = mount();
  m.flash(); assert.equal(flash.dataset.on, 'true');
  await new Promise((done) => setTimeout(done, 160));
  assert.equal(flash.dataset.on, 'false');
});
