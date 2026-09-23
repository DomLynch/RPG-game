import test from 'node:test';
import assert from 'node:assert/strict';
import { TAP_GUARD_MS, createLootPanel, tileLabel } from '../src/loot-panel.ts';
import { LOOT, lootName } from '../src/loot.ts';
import { ROSTER, type OpponentId } from '../src/roster.ts';

// The kill screen's panel is DOM-only (main.ts owns the loot rules), so it is tested against a fake element lookup exactly as the
// entry point's harness boots it: a tap on a tile IS the take now, and the guard window is the only thing between a fat finger
// already travelling when the kill screen arrived and the one take of the fight (Dom + the lead, 2026-09-22).
type Fake = {
  id: string; hidden: boolean; disabled: boolean; title: string; textContent: string; children: Fake[];
  attributes: Map<string, string>; listeners: Map<string, (() => void)[]>;
  setAttribute(name: string, value: string): void; getAttribute(name: string): string | null;
  append(...kids: Fake[]): void; replaceChildren(...kids: Fake[]): void;
  addEventListener(type: string, fn: () => void): void; click(): void;
};
function fake(id = ''): Fake {
  return {
    id, hidden: false, disabled: false, title: '', textContent: '', children: [],
    attributes: new Map(), listeners: new Map(),
    setAttribute(name, value) { this.attributes.set(name, value); },
    getAttribute(name) { return this.attributes.get(name) ?? null; },
    append(...kids) { this.children.push(...kids); },
    replaceChildren(...kids) { this.children = [...kids]; },
    addEventListener(type, fn) { this.listeners.set(type, [...(this.listeners.get(type) ?? []), fn]); },
    click() { for (const fn of this.listeners.get('click') ?? []) fn(); },
  };
}
function harness() {
  const nodes = new Map<string, Fake>();
  const element = (id: string) => { if (!nodes.has(id)) nodes.set(id, fake(id)); return nodes.get(id) as unknown as HTMLElement; };
  const doc = { createElement: (tag: string) => fake(tag) as unknown as HTMLElement };
  let clock = 1000;
  const panel = createLootPanel(element, doc, () => clock);
  panel.wire();
  return { element: (id: string) => element(id) as unknown as Fake, panel, tick: (ms: number) => { clock += ms; } };
}
const PIECES = [
  { id: 'nightborn.Helmet', name: "the Nightborn's helmet", owned: false, image: '/game/img/loot/nightborn.Helmet.thumb.webp' },
  { id: 'nightborn.Body', name: "the Nightborn's body", owned: true },
  { id: 'nightborn.Estoc', name: "the Nightborn's estoc", owned: false },
];
const tiles = (h: ReturnType<typeof harness>) => h.element('loot-panel-pieces').children;

test('loot panel: a tap on a tile is the take, and nothing can be taken inside the guard window', () => {
  const h = harness();
  const taken: string[] = [];
  h.panel.show('Take one from the Nightborn', PIECES, { onTake: (id) => taken.push(id), onDecline: () => taken.push('declined') });
  assert.equal(tiles(h).length, 3);
  // The finger that was already on its way down when the panel appeared.
  tiles(h)[0]!.children[0]!.click();
  assert.equal(taken.length, 0, `nothing is taken inside ${TAP_GUARD_MS} ms`);
  assert.equal(tiles(h)[0]!.getAttribute('data-took'), null, 'and the tile does not flash');
  h.tick(TAP_GUARD_MS - 1);
  tiles(h)[0]!.children[0]!.click();
  assert.equal(taken.length, 0, 'still inside the window');
  h.tick(2);
  tiles(h)[0]!.children[0]!.click();
  assert.deepEqual(taken, ['nightborn.Helmet'], 'past the window a single tap takes the piece — no Take button to press');
  assert.equal(tiles(h)[0]!.getAttribute('data-took'), '1', 'the tile flashes as the panel closes');
});

test('loot panel: an owned tile is inert, Leave it still declines, and a fresh show clears the guard and the flash', () => {
  const h = harness();
  const events: string[] = [];
  h.panel.show('Take one from the Nightborn', PIECES, { onTake: (id) => events.push(id), onDecline: () => events.push('declined') });
  h.tick(TAP_GUARD_MS + 1);
  assert.equal(tiles(h)[1]!.children[0]!.disabled, true, 'a piece already yours is not takeable');
  tiles(h)[1]!.children[0]!.click();
  assert.equal(events.length, 0, 'and its tap does nothing');
  h.element('loot-decline').click();
  assert.deepEqual(events, ['declined']);
  // Reopened (an Undo, or the next kill): the window starts again, so the tap that undid cannot fall through into a fresh take.
  h.panel.show('Take one from the Nightborn', PIECES, { onTake: (id) => events.push(id), onDecline: () => events.push('declined') });
  tiles(h)[0]!.children[0]!.click();
  assert.deepEqual(events, ['declined'], 'the guard window is measured from the new show');
  assert.equal(tiles(h)[0]!.getAttribute('data-took'), null, 'the new tiles carry no flash');
});

test('loot panel: the take line replaces the tiles and carries Undo; hide clears it', () => {
  const h = harness();
  let undone = 0;
  h.panel.show('Take one from the Nightborn', PIECES, { onTake: () => {}, onDecline: () => {} });
  assert.equal(h.element('loot-panel-note').hidden, true, 'no line while the tiles are up');
  h.panel.confirm("The Nightborn's helmet is on you.", () => { undone++; });
  assert.equal(h.element('loot-panel-pieces').hidden, true);
  assert.equal(h.element('loot-panel-actions').hidden, true, 'Leave it goes with the tiles');
  assert.equal(h.element('loot-panel-note').hidden, false);
  assert.equal(h.element('loot-panel-note-text').textContent, "The Nightborn's helmet is on you.");
  assert.equal(h.element('loot-undo').hidden, false, 'Undo is the only way back from a mis-tap: it is never hidden while the line shows');
  h.element('loot-undo').click();
  assert.equal(undone, 1);
  h.element('loot-undo').click();
  assert.equal(undone, 1, 'one undo per take');
  h.panel.confirm('on you.');
  assert.equal(h.element('loot-undo').hidden, true, 'a line with no undo shows no button');
  h.panel.hide();
  assert.equal(h.element('loot-panel').hidden, true);
  assert.equal(h.element('loot-panel').getAttribute('data-on'), '0');
  assert.equal(h.element('loot-panel-note').hidden, true);
  assert.equal(h.element('loot-undo').hidden, true);
});

test('a tile names the piece, never its owner: every piece in the game reads as one capitalised noun phrase, no possessive', () => {
  // At 56 px "Centurion's helmet" broke mid-word at the apostrophe on a 375 px phone, nine tiles in a row, under a title
  // that already names the Centurion. Checked over every real loot name, so a new opponent or a renamed rung cannot bring it back.
  const names = (Object.entries(LOOT) as [OpponentId, readonly string[]][]).flatMap(([opponent, ids]) => ids.map((id) => lootName(id as never, ROSTER[opponent].name)));
  assert.ok(names.length > 20, `every opponent's pieces are covered (${names.length})`);
  for (const name of names) {
    const label = tileLabel(name);
    assert.ok(!/'s\b/.test(label) && !/^the /i.test(label), `${name} → ${label}: no owner on the tile`);
    assert.equal(label[0], label[0]!.toUpperCase(), `${name} → ${label}: capitalised`);
    assert.ok(label.length > 0 && name.toLowerCase().endsWith(label.toLowerCase()), `${name} → ${label}: the piece, taken from the name`);
  }
  assert.equal(tileLabel("the Centurion's helmet"), 'Helmet');
  assert.equal(tileLabel("the Centurion's trident"), 'Trident');
});

test('while the arena-cam tour rolls, the tiles and Undo are inert: the first touch stops the tour and never takes a piece', async () => {
  // The panel stays visible through the tour, and its tiles sit where the first post-kill touch lands. A tile tap is the take, so
  // without this rule the touch that hands the camera back took the piece under it (measured on #521: the Centurion's shield at
  // 190,300). Rematch and Share already go inert under :root.endgame-fade for the same reason; the tiles and Undo join them.
  const { readFileSync } = await import('node:fs');
  const css = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');
  const rule = css.match(/:root\.endgame-fade \.loot-pieces button,\s*:root\.endgame-fade #loot-undo\s*\{([^}]*)\}/);
  assert.ok(rule, 'the fade rule names the tiles and Undo');
  assert.match(rule![1]!, /pointer-events:\s*none/);
});
