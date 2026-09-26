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
// E2's card: the default offer drawn big (Dom's pick, 2026-09-26). Take takes it.
const CARD = { eyebrow: 'Won at Recruit I', offer: 'nightborn.Helmet', name: "the Nightborn's helmet", image: '/game/img/loot/nightborn.Helmet.thumb.webp' };

test('loot panel: a tap on a tile is the take, and nothing can be taken inside the guard window', () => {
  const h = harness();
  const taken: string[] = [];
  h.panel.show(CARD, PIECES, { onTake: (id) => taken.push(id), onDecline: () => taken.push('declined') });
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

test('loot panel: an owned tile is a swap, never greyed; Leave still declines; a fresh show clears the guard and the flash', () => {
  const h = harness();
  const events: string[] = [];
  h.panel.show(CARD, PIECES, { onTake: (id) => events.push(id), onDecline: () => events.push('declined') });
  h.tick(TAP_GUARD_MS + 1);
  const owned = tiles(h)[1]!;
  assert.equal(owned.children[0]!.disabled, false, 'a piece already yours is not greyed (E2: owned = swap)');
  assert.equal(owned.getAttribute('data-swap'), '1', 'it carries the swap mark');
  assert.equal(tiles(h)[0]!.getAttribute('data-swap'), '0', 'a piece you do not own is a plain take');
  assert.ok(!owned.children[0]!.children.some((c) => c.id === 'small'), 'no "Yours" tag');
  owned.children[0]!.click();
  assert.deepEqual(events, ['nightborn.Body'], 'its tap is the take: it goes back on you, and it is the kill\'s one take (main.ts)');
  events.length = 0;
  h.element('loot-decline').click();
  assert.deepEqual(events, ['declined']);
  // Reopened (an Undo, or the next kill): the window starts again, so the tap that undid cannot fall through into a fresh take.
  h.panel.show(CARD, PIECES, { onTake: (id) => events.push(id), onDecline: () => events.push('declined') });
  tiles(h)[0]!.children[0]!.click();
  assert.deepEqual(events, ['declined'], 'the guard window is measured from the new show');
  assert.equal(tiles(h)[0]!.getAttribute('data-took'), null, 'the new tiles carry no flash');
});

test('loot panel: the take line replaces the tiles and carries Undo; hide clears it', () => {
  const h = harness();
  let undone = 0;
  h.panel.show(CARD, PIECES, { onTake: () => {}, onDecline: () => {} });
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

test('loot panel: a full pack asks before a take replaces a worn piece; the tiles and Leave it stay as the "no", Replace is the "yes"', () => {
  const h = harness();
  let replaced = 0;
  h.panel.show(CARD, PIECES, { onTake: () => {}, onDecline: () => {} });
  h.panel.ask("Your pack is full: the Centurion's helmet would be lost from your Profile.", 'Replace', () => { replaced++; });
  assert.equal(h.element('loot-panel-note').hidden, false);
  assert.equal(h.element('loot-panel-note-text').textContent, "Your pack is full: the Centurion's helmet would be lost from your Profile.");
  assert.equal(h.element('loot-undo').textContent, 'Replace'); assert.equal(h.element('loot-undo').hidden, false);
  assert.equal(h.element('loot-panel-pieces').hidden, false, 'the tiles stay: another pick is a "no"');
  assert.equal(h.element('loot-panel-actions').hidden, false, 'Leave it stays');
  h.element('loot-undo').click();
  assert.equal(replaced, 1, 'Replace goes through only on the tap');
  h.panel.confirm("The Nightborn's helmet is on you.", () => {});
  assert.equal(h.element('loot-undo').textContent, 'Undo', 'the take line relabels the pill back to Undo');
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

test('while the take-one offer is up the fight controls and the pad are hidden outright, and they return with it', async () => {
  // Lead 2026-09-25 (#753 375 stills): the sleeping Step and Guard read through Leave it at the cluster's half-fade and the pad
  // stayed up. The rule keys on #loot-panel-actions, which the panel unhides on show/Undo and hides on Take/Leave it/close.
  const { readFileSync } = await import('node:fs');
  const css = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const rule = css.match(/((?::root:has\(#loot-panel-actions:not\(\[hidden\]\)\) [^,{]+,?\s*)+)\{([^}]*)\}/);
  assert.ok(rule, 'a rule keyed on the open offer');
  assert.match(rule![2]!, /visibility:\s*hidden/);
  const selectors = rule![1]!.split(',').map((s) => s.replace(':root:has(#loot-panel-actions:not([hidden]))', '').trim());
  assert.deepEqual(selectors, ['#actions button[data-mobile]', '#run-button', '#joystick']);
  // Every fight control carries data-mobile, and nothing the offer needs does (Leave it, Next/Rematch, Share).
  const actions = html.slice(html.indexOf('id="actions"'), html.indexOf('</footer>'));
  const mobile = [...actions.matchAll(/<button id="([^"]+)"[^>]*data-mobile=/g)].map((m) => m[1]);
  for (const id of ['attack-button', 'kick-button', 'heavy-button', 'thrust-button', 'dodge-button', 'guard-button']) assert.ok(mobile.includes(id), id);
  for (const id of ['loot-take', 'loot-decline', 'reset-button', 'share-button']) assert.ok(!mobile.includes(id), id);
  assert.match(html, /<button id="run-button"/);
  assert.match(html, /<div id="joystick"/);
});

test('the offer row (the CSS hook that hides the fight controls) is open exactly while an offer is pending', () => {
  // show opens it; ask keeps it (the offer still stands); a take (confirm) and close (hide) shut it. Undo is main.ts calling
  // offerLoot -> show again, so the row, and with it the hidden controls, comes back with the offer.
  const { element, panel } = harness();
  const row = () => element('loot-panel-actions').hidden;
  panel.show(CARD, PIECES, { onTake() {}, onDecline() {} });
  assert.equal(row(), false, 'open on show');
  panel.ask('Your pack is full', 'Replace', () => {});
  assert.equal(row(), false, 'still open while asking');
  panel.confirm('The helmet is on you.', () => {});
  assert.equal(row(), true, 'shut on take');
  panel.show(CARD, PIECES, { onTake() {}, onDecline() {} });
  assert.equal(row(), false, 'open again on Undo (show)');
  panel.hide();
  assert.equal(row(), true, 'shut on close');
});

// One skill slot (Dom 2026-09-25): a foe's move offered to a player who already holds one is a swap. E2 (2026-09-26) names the held
// move in the tile's title and label and marks the tile ⇄, instead of drawing the held move beside it; the foe's tile is still the take.
test('loot panel: a move that replaces yours is a swap tile naming what it gives up, and the take is the foe\'s move', () => {
  const h = harness(), taken: string[] = [];
  const gives = { name: 'Pommel Strike', image: '/game/img/loot/pommel.thumb.svg' };
  h.panel.show({ ...CARD, offer: 'witchfire', name: 'Witch-fire' }, [PIECES[0]!, { id: 'witchfire', name: 'Witch-fire', owned: false, image: '/game/img/loot/witchfire.thumb.svg', gives }],
    { onTake: (id) => taken.push(id), onDecline: () => taken.push('declined') });
  const [plain, swap] = tiles(h);
  assert.equal(swap!.getAttribute('data-swap'), '1'); assert.equal(plain!.getAttribute('data-swap'), '0', 'an armour piece you lack gives nothing up');
  assert.equal(swap!.children.length, 1, 'one tile: the held move is named, not drawn');
  assert.equal(swap!.children[0]!.title, 'Witch-fire (replaces Pommel Strike)', 'the held move is read from the caller (SKILLS), never hardcoded');
  h.tick(TAP_GUARD_MS + 1); swap!.children[0]!.click();
  assert.deepEqual(taken, ['witchfire'], 'the foe\'s tile is the swap');
  h.panel.show(CARD, [{ id: 'witchfire', name: 'Witch-fire', owned: true }], { onTake: () => {}, onDecline: () => {} });
  assert.equal(tiles(h)[0]!.children[0]!.title, 'Witch-fire (yours: wear it)', 'already yours: a plain re-take, no replace line');
});

test('loot panel E2: the card shows the default offer; Take takes exactly it, behind the same guard; a take line hides the card', () => {
  const h = harness(), taken: string[] = [];
  h.panel.show(CARD, PIECES, { onTake: (id) => taken.push(id), onDecline: () => taken.push('declined') });
  assert.equal(h.element('loot-panel-title').textContent, 'Won at Recruit I');
  assert.equal(h.element('loot-panel-name').textContent, "the Nightborn's helmet");
  assert.equal((h.element('loot-panel-hero') as unknown as { src: string }).src, CARD.image);
  assert.equal(h.element('loot-panel-hero').hidden, false); assert.equal(h.element('loot-panel-head').hidden, false);
  assert.equal(h.element('loot-take').hidden, false, 'Take shows with an offer');
  assert.equal(tiles(h)[0]!.getAttribute('data-offer'), '1', 'the offer\'s tile is marked'); assert.equal(tiles(h)[2]!.getAttribute('data-offer'), null);
  h.element('loot-take').click();
  assert.equal(taken.length, 0, `Take waits out the same ${TAP_GUARD_MS} ms guard`);
  h.tick(TAP_GUARD_MS + 1); h.element('loot-take').click();
  assert.deepEqual(taken, ['nightborn.Helmet'], 'Take is the card\'s piece');
  h.panel.confirm("The Nightborn's helmet is on you.", () => {});
  assert.equal(h.element('loot-panel-head').hidden, true, 'the take line replaces the card with the tiles');
  h.panel.show({ ...CARD, offer: '', image: undefined }, PIECES, { onTake: () => {}, onDecline: () => {} });
  assert.equal(h.element('loot-take').hidden, true, 'no offer, no Take'); assert.equal(h.element('loot-panel-hero').hidden, true, 'no render, no image');
});
