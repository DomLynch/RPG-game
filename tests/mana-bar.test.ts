import test from 'node:test';
import assert from 'node:assert/strict';
import { mountManaBar } from '../src/fight/mana-bar.ts';

// A minimal document: just the nodes mountManaBar touches.
const node = (tag: string) => {
  const n: Record<string, unknown> = { tag, id: '', style: { setProperty: () => undefined }, attrs: {} as Record<string, string>, inserted: [] as unknown[] };
  n.setAttribute = (k: string, v: string) => { (n.attrs as Record<string, string>)[k] = v; };
  n.append = (...c: unknown[]) => { (n.inserted as unknown[]).push(...c); };
  n.insertAdjacentElement = (_where: string, el: unknown) => { (n.inserted as unknown[]).push(el); return el; };
  return n;
};
const fakeDoc = (hasStamina: boolean, hasMana = false) => {
  const byId: Record<string, unknown> = {};
  if (hasStamina) byId.stamina = node('meter');
  if (hasMana) byId.mana = node('meter');
  const head = node('head');
  const doc = { head, getElementById: (id: string) => byId[id] ?? null, createElement: (t: string) => node(t) };
  return { doc: doc as unknown as Document, head, stamina: byId.stamina as ReturnType<typeof node> | undefined };
};
(globalThis as { requestAnimationFrame?: unknown }).requestAnimationFrame ??= () => 0;

test('the mana bar mounts under stamina only while manaMax is on, once', () => {
  const on = fakeDoc(true), bar = mountManaBar(on.doc, 100) as unknown as ReturnType<typeof node>;
  assert.ok(bar, 'manaMax 100 mounts a bar'); assert.equal(bar.id, 'mana'); assert.equal(bar.max, 100); assert.equal(bar.value, 100);
  assert.equal(on.stamina!.inserted.length, 2, 'the label and the bar both go after the stamina bar'); assert.equal(on.head.inserted.length, 1, 'one style element');
  assert.equal(mountManaBar(fakeDoc(true).doc, 0), null, 'manaMax 0 (era off) mounts nothing');
  assert.equal(mountManaBar(fakeDoc(false).doc, 100), null, 'no stamina bar, nothing to anchor to');
  assert.equal(mountManaBar(fakeDoc(true, true).doc, 100), null, 'an existing #mana is left alone (the sandbox page adds its own)');
});
