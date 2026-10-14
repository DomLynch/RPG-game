// The daily board screen (top-30 #20, Web): a dialog on the zone page listing today's tasks and when the board resets. Read-only: progress and completion are the server's (Backend reads the same rows later).
// Every word on it is a row (board-text.json) or a name the injected namer gives; this file holds no task, creature or reward.
import { chromeText, timeUntil, type BoardView } from './board-view.ts';

const el = (tag: string, cls = '', text = '', attrs: Record<string, string> = {}): HTMLElement => {
  const e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text;
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); return e;
};
export function mountBoard(dialog: HTMLDialogElement, view: (nowMs: number) => BoardView | null, now: () => number = Date.now) {
  const close = el('button', 'board-close', '✕', { type: 'button', 'aria-label': chromeText('close') });
  const title = el('h3', '', chromeText('title')), status = el('p', 'board-status', '', { role: 'status' });
  const head = el('div', 'board-head'); head.append(title, status);
  const list = el('ul', 'board-list'), reset = el('p', 'board-reset');
  dialog.replaceChildren(close, head, list, reset); dialog.classList.add('board-dialog'); dialog.setAttribute('aria-label', chromeText('title'));
  let timer: ReturnType<typeof setInterval> | undefined;
  const draw = () => {
    const v = view(now());
    if (!v) { status.textContent = chromeText('empty'); list.replaceChildren(); reset.textContent = ''; return; }
    status.textContent = chromeText('slots', { n: v.slots });
    list.replaceChildren(...v.tasks.map((t) => {
      const li = el('li', 'board-task'), text = el('b', 'board-task-text', t.text), reward = el('span', 'board-task-reward', chromeText('reward', { reward: t.reward }));
      li.dataset.task = t.id; li.append(text, reward); return li;
    }));
    reset.textContent = chromeText('resets', { time: timeUntil(v.resetsInMs), hour: String(v.resetHourUtc).padStart(2, '0') });
  };
  const stop = () => { if (timer !== undefined) { clearInterval(timer); timer = undefined; } };
  close.addEventListener('click', () => dialog.close()); dialog.addEventListener('close', stop);
  return { open(): void { draw(); if (!dialog.open) dialog.showModal(); stop(); timer = setInterval(draw, 30_000); } };
}
