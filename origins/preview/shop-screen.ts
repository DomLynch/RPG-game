// The shop screen (top-30 item 4, Web): a dialog on the zone page listing the shop's stock rows with the price the writer charges, and a Buy button that goes through shop_buy. Buy only: shop_buy is the only shop route.
// Every word is a row (shop-text.json) or a name the injected namer gives. Nothing here prices, stocks or gates anything: the writer re-checks all of it, and the screen shows what it answers.
import { chromeText, type ShopView } from '../shops/shop-view.ts';
import { refusalKey, type Bought } from './shop-net.ts';
import type { Offline } from '../../src/core/index.ts';

const el = (tag: string, cls = '', text = '', attrs: Record<string, string> = {}): HTMLElement => {
  const e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text;
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); return e;
};
export type BuyFn = (item: string, revision: number) => Promise<Bought | Offline>;
export function mountShop(dialog: HTMLDialogElement, view: () => ShopView | null, buy: BuyFn, nameOf: (item: string) => string) {
  const close = el('button', 'shop-close', '✕', { type: 'button', 'aria-label': chromeText('close') });
  const title = el('h3', '', chromeText('title')), status = el('p', 'shop-status', '', { role: 'status' }), list = el('ul', 'shop-list');
  dialog.replaceChildren(close, title, status, list); dialog.classList.add('shop-dialog'); dialog.setAttribute('aria-label', chromeText('title'));
  let busy = false;
  const draw = () => {
    const v = view();
    if (!v) { status.textContent = chromeText('empty'); list.replaceChildren(); return; }
    list.replaceChildren(...v.lines.map((l) => {
      const li = el('li', 'shop-row'), name = el('b', 'shop-name', l.name), price = el('span', 'shop-price', l.priceText);
      const note = el('span', 'shop-note', [l.shelfText, l.levelText].filter(Boolean).join(' · ')), go = el('button', 'shop-buy', chromeText('buy'), { type: 'button' }) as HTMLButtonElement;
      li.dataset.item = l.item;
      go.addEventListener('click', async () => {
        if (busy) return; busy = true; go.disabled = true;
        const r = await buy(l.item, v.revision);
        status.textContent = 'offline' in r ? chromeText(refusalKey(r.offline)) : chromeText('bought', { item: nameOf(r.item), cost: r.cost });
        if ('offline' in r && refusalKey(r.offline) === 'stale') draw();
        busy = false; go.disabled = false;
      });
      li.append(name, price, note, go); return li;
    }));
  };
  close.addEventListener('click', () => dialog.close());
  return { open(): void { status.textContent = ''; draw(); if (!dialog.open) dialog.showModal(); } };
}
