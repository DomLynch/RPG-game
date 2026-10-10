// createMeters (src/fight/hud.ts): the zone's meters draw through the same fillMeter / paintMeter the Pit's createHud uses, and the Pit's own numbers are unchanged by the extraction.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createMeters, fillMeter, paintMeter } from '../src/fight/hud.ts';

class El {
  children: El[] = []; hidden = false; className = ''; textContent = ''; dataset: Record<string, string> = {}; value = 0; max = 1; attrs: Record<string, string> = {}; props = new Map<string, string>();
  style = { setProperty: (k: string, v: string) => { this.props.set(k, v); } };
  constructor(public tag: string, public ownerDocument: { createElement(tag: string): El }) {}
  setAttribute(k: string, v: string) { this.attrs[k] = v; }
  append(...kids: El[]) { this.children.push(...kids); }
}
const doc = { createElement(tag: string) { return new El(tag, doc); } };
const mount = () => { const body = new El('body', doc); const m = createMeters(body as never); return { body, m, root: body.children[0]!, flash: body.children[1]! }; };
const bars = (root: El) => ({ name: root.children[0]!, foe: root.children[1]!, hp: root.children[2]!, st: root.children[3]! });

test('fillMeter and paintMeter write the --fill percentage the style sheets draw (max, value, fill)', () => {
  const m = new El('meter', doc) as never as HTMLMeterElement;
  paintMeter(m, 75, 150);
  assert.equal((m as never as El).max, 150); assert.equal((m as never as El).value, 75); assert.equal((m as never as El).props.get('--fill'), '50%');
  fillMeter(m, 25, 100); assert.equal((m as never as El).props.get('--fill'), '25%');
});

test('createMeters: hidden until shown, then health, stamina and the foe in reach are painted from plain numbers', () => {
  const { m, root } = mount(), { name, foe, hp, st } = bars(root);
  assert.equal(root.hidden, true);
  m.update({ hp: 60, maxHp: 120, stamina: 30, maxStamina: 120, foe: { name: 'Goblin', hp: 10, max: 40 } }, true);
  assert.equal(root.hidden, false); assert.equal(name.textContent, 'Goblin');
  assert.equal(hp.props.get('--fill'), '50%'); assert.equal(st.props.get('--fill'), '25%'); assert.equal(foe.props.get('--fill'), '25%');
  assert.equal(hp.value, 60); assert.equal(hp.max, 120);
  m.update({ hp: 60, maxHp: 120, stamina: 30, maxStamina: 120, foe: null }, true);
  assert.equal(name.textContent, ''); assert.equal(foe.props.get('--fill'), '0%');
  m.update({ hp: 120, maxHp: 120, stamina: 120, maxStamina: 120, foe: null }, false);
  assert.equal(root.hidden, true);
});

test('createMeters.flash: the hit vignette goes on, and off again after 120 ms', async () => {
  const { m, flash } = mount();
  m.flash(); assert.equal(flash.dataset.on, 'true');
  await new Promise((done) => setTimeout(done, 160));
  assert.equal(flash.dataset.on, 'false');
});
