import assert from 'node:assert/strict';
import test from 'node:test';
import { mountCareer } from '../src/core/career-screen.ts';

// A DOM stub just big enough for mountCareer's render (no jsdom in the repo): elements keep their class, text and children; `find` walks them.
class El {
  className = ''; textContent = ''; type = ''; hidden = false; value = ''; maxLength = 0; children: El[] = []; attrs: Record<string, string> = {}; title = ''; parent: El | null = null;
  constructor(public tag: string, public ownerDocument: { createElement(tag: string): El }) {}
  append(...kids: El[]) { for (const k of kids) { k.parent = this; this.children.push(k); } }
  replaceChildren(...kids: El[]) { this.children = []; this.append(...kids); }
  replaceWith(other: El) { const p = this.parent; if (p) { p.children[p.children.indexOf(this)] = other; other.parent = p; } }
  setAttribute(k: string, v: string) { this.attrs[k] = v; }
  addEventListener() {}
  focus() {} select() {}
  find(cls: string): El[] { return [...(this.className.split(' ').includes(cls) ? [this] : []), ...this.children.flatMap((c) => c.find(cls))]; }
}
const doc = { createElement: (tag: string) => new El(tag, doc) };
const mount = (o: { signedIn: boolean; rename?: () => void }) => {
  const root = new El('div', doc);
  const db = o.signedIn ? ({ rpc: async () => ({ data: null, error: { message: 'x' } }), auth: { getUser: async () => ({ data: { user: null } }) }, from: () => { throw new Error('no table'); } }) as never : null;
  const career = mountCareer(root as never, { db: () => db, marks: () => 7, ...(o.rename ? { rename: o.rename } : {}) });
  return { root, render: () => career.render() };
};
const storage = new Map<string, string>();
Object.assign(globalThis, { localStorage: { getItem: (k: string) => storage.get(k) ?? null, setItem: (k: string, v: string) => void storage.set(k, v) } });

test('rendered with an account (db set) and no rename, the card has no name pencil: the zone gives a signed-in player none', async () => {
  const m = mount({ signedIn: true }); await m.render();
  assert.equal(m.root.find('career-pencil').length, 0);
});
test('rendered as a guest with no rename, the card has exactly one name pencil (the device edit)', async () => {
  const m = mount({ signedIn: false }); await m.render();
  assert.equal(m.root.find('career-pencil').length, 1);
});
test('rendered with the host\'s own rename, the pencil is there for a guest and for an account', async () => {
  for (const signedIn of [false, true]) { const m = mount({ signedIn, rename: () => {} }); await m.render(); assert.equal(m.root.find('career-pencil').length, 1, `signedIn=${signedIn}`); }
});
