import test from 'node:test';
import assert from 'node:assert/strict';
import { GEAR_STATS, compareRows, renderCompare, statRows, type GearStat } from '../src/core/gear-strip.ts';
import { gearNumbers } from '../src/fight/gear-numbers.ts';
import { RULES } from '../src/fight/moves.ts';
import type { Loot } from '../src/core/loot.ts';

// The Gear tab's strip is rows, not markup: a row with a value is drawn, a row without one is not, and a new attribute is one more row (the follow-up feeds the rows from Combat's attribute table).
test('statRows draws the rows that have a value, in registry order, and skips the rest', () => {
  assert.deepEqual(statRows({ base: { health: 150, stamina: 100 }, worn: [] }).map((r) => `${r.label} ${r.value}`), ['Health 150', 'Stamina 100']);
  assert.deepEqual(statRows({ base: { health: 150 }, worn: [] }).map((r) => r.id), ['health'], 'a stat the host does not know is not invented');
  assert.deepEqual(statRows({ base: {}, worn: [] }), [], 'no numbers, no strip');
});
test('a new attribute is a row: no panel code names it', () => {
  const mana: GearStat = { id: 'mana', label: 'Mana', read: (c) => c.base.mana ?? null };
  assert.deepEqual(statRows({ base: { health: 150, mana: 162.4 }, worn: [] }, [...GEAR_STATS, mana]).map((r) => `${r.label} ${r.value}`), ['Health 150', 'Mana 162']);
  assert.deepEqual(statRows({ base: { x: NaN }, worn: [] }, [{ id: 'x', label: 'X', read: (c) => c.base.x ?? null }]), [], 'a non-finite value is skipped');
});
test('gearNumbers: the combat constants, and gear tilt in whole points from the Attack/RES table (no gear, or pieces with no rung, is 0 and 0)', () => {
  const naked = gearNumbers(undefined);
  assert.deepEqual(naked, { health: RULES.health, stamina: 100, attack: 0, res: 0 });
  const noRung: Loot = { owned: ['veteran.Helmet'], equipped: { head: 'veteran.Helmet' } };
  assert.deepEqual(gearNumbers(noRung), naked, 'a piece with no recorded rung is the identity, never a guess');
  const worn: Loot = { owned: ['veteran.Helmet', 'veteran.Body'], equipped: { head: 'veteran.Helmet', chest: 'veteran.Body' }, taken: { 'veteran.Helmet': { opponent: 'veteran', attempt: 1, healthLeft: 50, recordId: null, day: '2026-10-12', tier: 10 }, 'veteran.Body': { opponent: 'veteran', attempt: 1, healthLeft: 50, recordId: null, day: '2026-10-12', tier: 10 } } };
  const n = gearNumbers(worn);
  assert.ok(n.res > 0 && n.res <= 20, `two top-rung armour pieces tilt RES a little, never past the 20 cap: ${n.res}`); assert.equal(n.attack, 0, 'armour carries no Attack');
  assert.deepEqual(statRows({ base: n, worn: [] }).map((r) => r.id), ['health', 'stamina', 'attack', 'res']);
});

// The try-on compare: the same registry rows, the NEW card's number is the total after the swap with its change, nothing a side lacks is shown.
test('compareRows: the rows both ledgers have, with the change; a stat only one side knows is skipped', () => {
  const ctx = (base: Record<string, number>) => ({ base, worn: [] });
  assert.deepEqual(compareRows(ctx({ health: 150, attack: 0, res: 4 }), ctx({ health: 150, attack: 3, res: 2 })).map((r) => `${r.id} ${r.now}>${r.next} ${r.delta}`), ['health 150>150 0', 'attack 0>3 3', 'res 4>2 -2']);
  assert.deepEqual(compareRows(ctx({ health: 150 }), ctx({ health: 150, mana: 9 }), [...GEAR_STATS, { id: 'mana', label: 'Mana', read: (c) => c.base.mana ?? null }]).map((r) => r.id), ['health']);
});
test('renderCompare draws NEW and EQUIPPED with the rows, the change only on NEW, and an empty slot as Empty', () => {
  type N = { tag: string; text: string; cls: string; kids: N[]; attrs: Record<string, string> };
  const mk = (tag: string): N & { textContent: string; append(...k: N[]): void; replaceChildren(...k: N[]): void; setAttribute(k: string, v: string): void; hidden: boolean } => {
    const n = { tag, text: '', cls: '', kids: [] as N[], attrs: {} as Record<string, string>, hidden: true, set textContent(v: string) { n.text = v; }, get textContent() { return n.text; }, append(...k: N[]) { n.kids.push(...k); }, replaceChildren(...k: N[]) { n.kids = [...k]; }, setAttribute(k: string, v: string) { n.attrs[k] = v; if (k === 'class') n.cls = v; } };
    return n as never;
  };
  const host = mk('div') as unknown as HTMLElement & N;
  renderCompare(host, { now: null, next: { name: "Knight's helm", sub: 'Legionary' }, rows: [{ id: 'res', label: 'Resistance', now: '4', next: '9', delta: 5 }, { id: 'health', label: 'Health', now: '150', next: '150', delta: 0 }] }, { createElement: (t: string) => mk(t) as never });
  const [fresh, held] = host.kids;
  assert.deepEqual([fresh!.attrs['data-side'], held!.attrs['data-side']], ['new', 'held']); assert.equal(host.hidden, false);
  const text = (n: N): string[] => [n.text, ...n.kids.flatMap(text)].filter(Boolean);
  assert.deepEqual(text(fresh!), ['New', "Knight's helm", 'Legionary', 'Resistance', '9', '+5', 'Health', '150'], 'NEW: totals after the swap, the change beside the one that moved');
  assert.deepEqual(text(held!), ['Equipped', 'Empty', 'Resistance', '4', 'Health', '150'], 'EQUIPPED: totals now, no change marks, an empty slot says Empty');
});
