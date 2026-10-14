// The stats screen (Dom's critical four, item 3, Web): a dialog on the zone page showing the player's level, points placed and each dial and skill row (stats-view.ts). Read only: placing points is the Pit's "Place your point"
// screen and the writer's. Every word is a row (stats-text.json); the numbers come from what the injected `read` gives (the stored build, and the writer's sheet when it supplies one). A guest or an unreachable writer sees no
// numbers rather than a guess.
import { chromeText, statsView, type StatLine, type StatsSource } from './stats-view.ts';

const el = (tag: string, cls = '', text = '', attrs: Record<string, string> = {}): HTMLElement => {
  const e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text;
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); return e;
};
export type StatsRead = () => Promise<StatsSource | { offline: string }>;
export function mountStats(dialog: HTMLDialogElement, read: StatsRead) {
  const close = el('button', 'stats-close', '✕', { type: 'button', 'aria-label': chromeText('close') });
  const title = el('h3', '', chromeText('title')), level = el('p', 'stats-level'), points = el('p', 'stats-points'), status = el('p', 'stats-status', '', { role: 'status' }), body = el('div', 'stats-body');
  dialog.replaceChildren(close, title, level, points, status, body); dialog.classList.add('stats-dialog'); dialog.setAttribute('aria-label', chromeText('title'));
  const row = (l: StatLine): HTMLElement => {
    const li = el('li', 'stats-row'), name = el('b', 'stats-name', l.name), value = el('span', 'stats-value', l.value), note = el('span', 'stats-note', l.placedText);
    li.dataset.stat = l.id; li.append(name, value, note);
    if (l.fraction !== null) { const bar = el('i', 'stats-bar'); bar.style.setProperty('--fill', `${Math.round(l.fraction * 100)}%`); li.append(bar); }
    return li;
  };
  const group = (key: 'dials' | 'skills', lines: StatLine[]): HTMLElement[] => lines.length ? [el('h4', 'stats-group', chromeText(key)), el('ul', 'stats-list')].map((e, i) => { if (i === 1) e.append(...lines.map(row)); return e; }) : [];
  async function draw(): Promise<void> {
    level.textContent = points.textContent = ''; body.replaceChildren(); status.textContent = chromeText('loading');
    const r = await read();
    if ('offline' in r) { status.textContent = chromeText(r.offline === 'no-session' || r.offline === 'http-401' ? 'offline' : 'unreadable'); return; }
    const v = statsView(r);
    status.textContent = v.hasSheet ? '' : chromeText('noSheet'); level.textContent = v.levelText; points.textContent = v.pointsText;
    body.replaceChildren(...group('dials', v.dials), ...group('skills', v.skills));
  }
  close.addEventListener('click', () => dialog.close());
  return { open(): Promise<void> { if (!dialog.open) dialog.showModal(); return draw(); } };
}
