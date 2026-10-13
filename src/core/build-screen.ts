// "Place your point" (Web, programme 2a): one point a level on any dial or skill row, shown in a dialog on a phone. The player edits a DRAFT (+ / - on a row; the + stops when no point is left, the - only
// shows while taking back is allowed) and one Confirm sends it (build_set); Undo drops the draft. Drawn once and synced after each change, so a finger on a button is never torn out from under it.
// The rules are build-model.ts's, the server's copy is build-server.ts's; this file only draws them.
import { ROWS, canPlace, canTakeBack, needsPoint, place, placedOn, spent, takeBack, unspent, type Row } from './build-model.ts';
import type { BuildView } from './build-net.ts';
import type { SaveOutcome } from './build-server.ts';

type Server = { view: () => BuildView | null; refresh: () => Promise<BuildView | null>; save: (next: BuildView) => Promise<SaveOutcome> };
const SAID: Readonly<Record<Exclude<SaveOutcome, 'saved'>, string>> = { moved: 'Your build changed somewhere else. Here it is again.', spent: 'This rank\'s re-spread is spent. The next one comes at the next rank-up.', offline: 'Could not reach your character. Nothing was changed.' };

export function mountBuild(dialog: HTMLDialogElement, server: Server, onPending?: (open: number) => void) {
  let draft: BuildView | null = null, note = '', busy = false;
  const title = el('h3', '', 'Your build'), level = el('p', 'build-level'), left = el('p', 'build-left', '', { role: 'status' }), msg = el('p', 'build-note', '', { role: 'status' });
  const head = el('div', 'build-head'); head.append(title, level);
  const close = el('button', 'build-close', '✕', { type: 'button', 'aria-label': 'Close' });
  const list = el('div', 'build-rows');
  const rows = ROWS.map((r) => rowView(r));
  const undo = btn('build-undo', 'Undo'), confirm = btn('build-confirm', 'Confirm');
  const actions = el('div', 'build-actions'); actions.append(undo, confirm);
  let lastKind = '';
  for (const r of rows) { if (r.row.kind !== lastKind) { lastKind = r.row.kind; list.append(el('h4', 'build-group', r.row.kind === 'dial' ? 'Dials' : 'Skills')); } list.append(r.li); }
  dialog.replaceChildren(close, head, left, msg, list, actions);
  dialog.classList.add('build-dialog');

  const server0 = () => server.view();
  const dirty = () => !!draft && !!server0() && JSON.stringify(draft.placed) !== JSON.stringify(server0()!.placed);
  const sync = () => {
    const v = draft, base = server0();
    if (!v || !base) { left.textContent = 'Sign in to place points.'; return; }
    const open = unspent(v);
    level.textContent = `Level ${v.level}`;
    left.textContent = open > 0 ? `${open} ${open === 1 ? 'point' : 'points'} to place` : spent(v) > 0 ? 'Every point is placed' : 'No points yet';
    msg.textContent = note || (canTakeBack(v) ? (v.level <= 10 ? 'Changing your mind is free until level 10.' : 'You can take points back once this rank.') : '');
    for (const { row, li, bar, val, plus, minus } of rows) {
      const n = placedOn(v, row.id);
      val.textContent = n ? `+${n}` : '0'; bar.style.setProperty('--fill', `${Math.round((100 * n) / row.room)}%`);
      plus.disabled = busy || !canPlace(v, row.id); minus.disabled = busy || n === 0 || !canTakeBack(v);
      li.dataset.placed = String(n);
    }
    undo.disabled = busy || !dirty(); confirm.disabled = busy || !dirty();
    onPending?.(unspent(base));
  };
  const pull = async () => { const v = await server.refresh(); draft = v; sync(); return v; };
  for (const r of rows) {
    r.plus.addEventListener('click', () => { if (draft) { draft = place(draft, r.row.id); note = ''; sync(); } });
    r.minus.addEventListener('click', () => { if (draft) { draft = takeBack(draft, r.row.id); note = ''; sync(); } });
  }
  undo.addEventListener('click', () => { draft = server0(); note = ''; sync(); });
  confirm.addEventListener('click', async () => {
    if (!draft || busy) return; busy = true; sync();
    const out = await server.save(draft); busy = false;
    draft = server0(); note = out === 'saved' ? '' : SAID[out]; sync();
    if (out === 'saved' && !needsPoint(draft!)) dialog.close();
  });
  close.addEventListener('click', () => dialog.close());
  return {
    // Open the dialog on the server's latest build; a guest (nothing to read) gets nothing.
    async open(): Promise<boolean> { const v = await pull(); if (!v) return false; note = ''; sync(); if (!dialog.open) dialog.showModal(); return true; },
    // Read the build without opening (a level may have been gained): the page uses the count for its prompt.
    async poll(): Promise<number> { const v = await pull(); return v ? unspent(v) : 0; },
  };
}

function rowView(row: Row) {
  const li = el('div', `build-row kind-${row.kind}`), bar = el('i', 'build-bar'), val = el('b', 'build-val');
  const minus = btn('build-minus', '−', `Take a point off ${row.name}`), plus = btn('build-plus', '+', `Place a point on ${row.name}`);
  const mid = el('span', 'build-mid'); mid.append(bar, val);
  li.append(el('span', 'build-name', row.name), minus, mid, plus);
  return { row, li, bar, val, plus, minus };
}
function btn(cls: string, text: string, label?: string): HTMLButtonElement {
  const b = el('button', cls, text, { type: 'button', ...(label ? { 'aria-label': label } : {}) }) as HTMLButtonElement;
  return b;
}
function el(tag: string, cls = '', text = '', attrs: Record<string, string> = {}): HTMLElement {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
}
