// The shop screen (top-30 item 4, Web): a dialog on the zone page listing the shop's rows as the WRITER reports them (shop_stock: the next unit's price with the zone tax, the account's stock, when the next unit returns), and a Buy
// button that goes through shop_buy. Buy only: there is no sell route. Every word is a row (shop-text.json) or a name the injected namer gives. Nothing here prices, stocks or gates anything: a guest or an unreachable writer sees
// no rows rather than a guessed price, and the writer re-checks every buy.
import { chromeText, restockText, shopView, type ShopView, type Stock } from '../shops/shop-view.ts';
import { refusalKey, type Bought } from './shop-net.ts';
import type { Offline } from '../../src/core/index.ts';
import type { ShopList } from '../shops/shop.ts';

const el = (tag: string, cls = '', text = '', attrs: Record<string, string> = {}): HTMLElement => {
  const e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text;
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); return e;
};
export type ShopDeps = { list: () => ShopList | undefined; read: () => Promise<Stock | Offline>; buy: (item: string, revision: number) => Promise<Bought | Offline>; nameOf: (item: string) => string; now?: () => number };
export function mountShop(dialog: HTMLDialogElement, d: ShopDeps) {
  const now = d.now ?? Date.now;
  const close = el('button', 'shop-close', '✕', { type: 'button', 'aria-label': chromeText('close') });
  const title = el('h3', '', chromeText('title')), status = el('p', 'shop-status', '', { role: 'status' }), list = el('ul', 'shop-list');
  dialog.replaceChildren(close, title, status, list); dialog.classList.add('shop-dialog'); dialog.setAttribute('aria-label', chromeText('title'));
  let busy = false, fetchedAt = 0, view: ShopView | null = null, timer: ReturnType<typeof setInterval> | undefined;
  const stop = () => { if (timer !== undefined) { clearInterval(timer); timer = undefined; } };
  const timers = () => list.querySelectorAll<HTMLElement>('.shop-restock');
  const tick = () => {   // the restock times count down on the writer's clock offset; at zero the shelf is read again
    const gone = now() - fetchedAt;
    timers().forEach((t) => { const left = Number(t.dataset.ms) - gone; t.textContent = restockText(Math.max(0, left)); });
    if (view?.lines.some((l) => l.restockInMs !== null && l.restockInMs - gone <= 0)) { stop(); void refresh(); }
  };
  const draw = (v: ShopView) => {
    view = v; fetchedAt = now();
    list.replaceChildren(...v.lines.map((l) => {
      const li = el('li', 'shop-row'), name = el('b', 'shop-name', l.name), price = el('span', 'shop-price', l.priceText);
      const note = el('span', 'shop-note', [l.stockText, l.levelText].filter(Boolean).join(' · ')), restock = el('span', 'shop-restock', restockText(l.restockInMs));
      const go = el('button', 'shop-buy', chromeText('buy'), { type: 'button' }) as HTMLButtonElement;
      li.dataset.item = l.item; restock.dataset.ms = String(l.restockInMs ?? 0); go.disabled = l.soldOut;
      go.addEventListener('click', async () => {
        if (busy) return; busy = true; go.disabled = true;
        const r = await d.buy(l.item, v.revision);
        status.textContent = 'offline' in r ? chromeText(refusalKey(r.offline)) : chromeText('bought', { item: d.nameOf(r.item), cost: r.cost });
        busy = false; await refresh(true);   // the shelf and the next price have moved either way
      });
      li.append(name, price, note, restock, go); return li;
    }));
    stop(); timer = setInterval(tick, 1000);
  };
  async function refresh(keepStatus = false): Promise<void> {
    const r = await d.read();
    if ('offline' in r) { stop(); list.replaceChildren(); status.textContent = chromeText(refusalKey(r.offline) === 'offline' ? 'offlineView' : 'unreadable'); return; }
    const v = shopView(d.list(), r, d.nameOf);
    if (!v) { stop(); list.replaceChildren(); status.textContent = chromeText('empty'); return; }
    if (!keepStatus) status.textContent = '';
    draw(v);
  }
  close.addEventListener('click', () => dialog.close()); dialog.addEventListener('close', stop);
  return { async open(): Promise<void> { status.textContent = chromeText('loading'); list.replaceChildren(); if (!dialog.open) dialog.showModal(); await refresh(); } };
}
