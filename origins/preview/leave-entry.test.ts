import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { addArenaEntry, addLeaveEntry } from './leave-entry.ts';
import { loadZone, zoneIds } from '../zones/loader.ts';

// The Pit room was removed from the game (2026-10-08) and took the game's #nav-pit with it; the Origins duel reuses the game's ☰ menu, so it adds its own
// exit. A duel with no way out is a trapped player (Lead's ruling on PR #1835).
const fakeNav = () => {
  const made: { id: string; textContent: string; type: string; title: string; attrs: Record<string, string>; setAttribute(k: string, v: string): void; listeners: Record<string, () => void>; addEventListener(t: string, f: () => void): void }[] = [], children: unknown[] = [];
  const doc = { createElement: () => { const b = { id: '', textContent: '', type: '', title: '', attrs: {} as Record<string, string>, setAttribute(k: string, v: string) { this.attrs[k] = v; }, listeners: {} as Record<string, () => void>, addEventListener(t: string, f: () => void) { this.listeners[t] = f; } }; made.push(b); return b; } };
  const nav = { ownerDocument: doc, querySelector: (sel: string) => children.find((c) => sel === `#${(c as { id: string }).id}`) ?? null, prepend: (c: unknown) => { children.unshift(c); } };
  return { nav: nav as unknown as HTMLElement, made, children };
};

test('the Origins duel menu has a Leave the Pit entry that closes the menu and leaves, once however often it is bound', () => {
  const { nav, made, children } = fakeNav(), calls: string[] = [];
  const button = addLeaveEntry(nav, () => calls.push('close'), () => calls.push('leave')) as unknown as (typeof made)[number];
  assert.equal(button.id, 'nav-pit'); assert.equal(button.textContent, 'Leave the Pit'); assert.equal(children[0], button, 'first in the nav');
  button.listeners.click!();
  assert.deepEqual(calls, ['close', 'leave'], 'the exit fires: menu closes, then the page leaves');
  addLeaveEntry(nav, () => {}, () => {});
  assert.equal(made.length, 1, 'bound again: no second entry');
});

test('bind() uses it, and the preview page keeps the game\'s nav visible in the duel', () => {
  const src = readFileSync(new URL('./pit-duel.ts', import.meta.url), 'utf8'), html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
  assert.match(src, /addLeaveEntry\(element\('app-nav'\), \(\) => journal!\.close\(\), leave, hostBack\)/);
  assert.doesNotMatch(html, /#duel #app-nav[^{]*\{[^}]*display: none/, 'the nav that carries the exit is not hidden');
  assert.match(html, /#duel\.world #journal[^{]*\{[^}]*pointer-events: auto/, 'the world layer is pointer-events none: the menu inside it must take taps, or the exit cannot be pressed (browser run, PR #1835)');
});

test('the menu\'s first entry is "Arena / Pit", which goes to /arena/ once however often it is bound, ahead of Leave the Pit', () => {
  const { nav, made, children } = fakeNav(), calls: string[] = [];
  addLeaveEntry(nav, () => {}, () => {});
  const arena = addArenaEntry(nav, () => calls.push('go')) as unknown as (typeof made)[number];
  assert.equal(arena.id, 'nav-arena-page'); assert.equal(arena.textContent, 'Arena / Pit'); assert.equal(children[0], arena, 'first in the nav, before Leave the Pit');
  arena.listeners.click!(); assert.deepEqual(calls, ['go']);
  addArenaEntry(nav, () => {}); assert.equal(made.length, 2, 'bound again: no third entry');
  const src = readFileSync(new URL('./pit-duel.ts', import.meta.url), 'utf8');
  assert.match(src, /addArenaEntry\(element\('app-nav'\), \(\) => location\.assign\('\/arena\/'\)\)/, 'bind() sends it to /arena/');
});

// Lead 2026-10-09 (Dom: "Pit" appears only in the Pit client): a zone hosts the engine's gear sheet in its own words. The labels come from the host, never hard-coded in the sheet.
test('a zone-hosted gear sheet says Gear and Back to <zone>, and shows no Pit or Arena text', () => {
  const { nav, made } = fakeNav();
  const exit = addLeaveEntry(nav, () => {}, () => {}, 'Back to Zone 1') as unknown as (typeof made)[number];
  assert.equal(exit.textContent, 'Back to Zone 1'); assert.equal(exit.id, 'nav-pit', 'same entry, the zone\'s words');
  const read = (f: string) => readFileSync(new URL(f, import.meta.url), 'utf8'), duel = read('./pit-duel.ts'), main = read('./main.ts'), mount = read('./gear-mount.ts'), html = read('./index.html');
  assert.match(duel, /element\('nav-gear'\)\.textContent = 'Gear'/, 'the tab reads Gear in a zone');
  assert.match(main, /m\.enterWorld\(leaveFight, \{ back: zoneExit\(\) \}\)/); assert.match(main, /duel\.enterWorld\(leaveFight, \{ back: zoneExit\(\) \}\)/);
  assert.match(main, /`Back to \$\{z\.name\}`/, 'the zone package\'s own name field');
  const emptyPack = /emptyPack: '([^']*)'/.exec(mount)?.[1] ?? 'Win gear in the arena.';
  assert.doesNotMatch(emptyPack, /pit|arena/i, 'the zone\'s empty rack line');
  assert.match(html, /#duel\.gearing #nav-arena, #duel\.gearing #nav-arena-page \{ display: none !important; \}/, 'the Arena entries stay out of the sheet while it is up');
});

// Any zone name must fit (700+ zones are coming; Lead 2026-10-09): the exit label ellipsizes inside its column, so it never reaches the tabs or the cog, and the FULL name stays in the
// accessible name. A node test cannot measure layout; scripts/gear-exit-label-check.mjs does, at 375, with these same two names.
test('a long zone name: the exit keeps the full name for assistive tech, and the nav columns can shrink and ellipsize', () => {
  const registry = zoneIds().map((id) => { const z = loadZone(id); return `Back to ${z.name}`; }).sort((a, b) => b.length - a.length)[0]!, fixture = `Back to ${'The Very Long Ash Reaches Of Nowhere '.slice(0, 40).trim()}`;
  for (const label of [registry, fixture]) {
    const { nav, made } = fakeNav(), button = addLeaveEntry(nav, () => {}, () => {}, label) as unknown as (typeof made)[number];
    assert.equal(button.textContent, label); assert.equal(button.attrs['aria-label'], label, 'the accessible name is the whole label'); assert.equal(button.title, label, 'and the tooltip');
  }
  assert.ok(fixture.length - 'Back to '.length >= 38, 'the fixture is a ~40-character zone name');
  const css = readFileSync(new URL('../../src/style.css', import.meta.url), 'utf8');
  assert.equal((css.match(/#journal \.app-nav \{[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/g) ?? []).length, 2, 'both nav rules let a column shrink (plain 1fr widens it and pushes Gear under the cog)');
  assert.match(css, /#journal \.app-nav button \{[^}]*white-space: nowrap; overflow: hidden; text-overflow: ellipsis/, 'the nav buttons ellipsize');
});
