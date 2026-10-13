// The smith screen (wear & repair part 2, Web): a dialog on the zone page listing the worn pieces the writer reports (gear_wear) with their durability and the writer's quote, and a Repair button that goes through
// gear_repair (one piece per click, a fresh op id). Every word is a row (repair-text.json) or a name the injected namer gives. Nothing here prices, wears or gates anything: a guest or an unreachable writer sees no
// lines rather than a guess, the quote is the writer's, and the writer re-checks every repair (counter distance, bronze, grave iron).
import { chromeText, repairLines, type RepairLine } from './repair-view.ts';
import { repairKey, type Repaired, type WearLine } from './repair-net.ts';
import type { Offline } from '../../src/core/index.ts';

const el = (tag: string, cls = '', text = '', attrs: Record<string, string> = {}): HTMLElement => {
  const e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text;
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); return e;
};
export type RepairDeps = { read: () => Promise<{ pieces: WearLine[] } | Offline>; repair: (instance: string) => Promise<Repaired | Offline>; nameOf: (item: string) => string };
export function mountRepair(dialog: HTMLDialogElement, d: RepairDeps) {
  const close = el('button', 'repair-close', '✕', { type: 'button', 'aria-label': chromeText('close') });
  const title = el('h3', '', chromeText('title')), status = el('p', 'repair-status', '', { role: 'status' }), list = el('ul', 'repair-list');
  dialog.replaceChildren(close, title, status, list); dialog.classList.add('repair-dialog'); dialog.setAttribute('aria-label', chromeText('title'));
  let busy = false;
  const row = (l: RepairLine): HTMLElement => {
    const li = el('li', 'repair-row'), slot = el('b', 'repair-slot', l.slot), dur = el('span', 'repair-durability', l.durabilityText), bar = el('i', 'repair-bar');
    const note = el('span', 'repair-note', [l.shrunkText, l.quoteText].filter(Boolean).join(' · ')), go = el('button', 'repair-go', chromeText('repair'), { type: 'button' }) as HTMLButtonElement;
    li.dataset.instance = l.instance; bar.style.setProperty('--fill', `${Math.round(l.fraction * 100)}%`);
    go.addEventListener('click', async () => {
      if (busy) return; busy = true; go.disabled = true;
      const r = await d.repair(l.instance);
      status.textContent = 'offline' in r ? chromeText(repairKey(r.offline) === 'offline' ? 'offline' : repairKey(r.offline), { item: d.nameOf(l.metalItem) }) : chromeText('repaired', { slot: l.slot, bronze: r.cost.bronze, qty: r.cost.metal.qty, item: d.nameOf(r.cost.metal.item) });
      busy = false; await refresh(true);   // the piece's wear and the next quote have moved either way
    });
    li.append(slot, dur, bar, note, go); return li;
  };
  async function refresh(keepStatus = false): Promise<void> {
    const r = await d.read();
    if ('offline' in r) { list.replaceChildren(); status.textContent = chromeText(repairKey(r.offline) === 'offline' ? 'offline' : 'unreadable'); return; }
    if (!keepStatus) status.textContent = r.pieces.length ? '' : chromeText('nothing');
    else if (!r.pieces.length) status.textContent = `${status.textContent} ${chromeText('nothing')}`.trim();
    list.replaceChildren(...repairLines(r.pieces, d.nameOf).map(row));
  }
  close.addEventListener('click', () => dialog.close());
  return { async open(): Promise<void> { status.textContent = chromeText('loading'); list.replaceChildren(); if (!dialog.open) dialog.showModal(); await refresh(); } };
}
