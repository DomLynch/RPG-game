// The SPECIAL picker (Web, Dom 2026-10-17: the beta's two fight slots are SPECIAL 1 / SPECIAL 2, picked from the class skills the cut signs off): a dialog on a phone, the grimoire's frame, a plain list of the picks with
// their role lines. Every id, its order and its role line are the betaCut rows (special-equip.ts specialChoices); a skill's display name is the host's `nameOf` (the skill-defs.json rows, which the core may not import).
// Each entry has one button per slot; a pick MOVES a skill out of the other slot (special-equip.ts), and pressing the lit slot again clears it. Nothing here names a skill, a slot or a role.
import { SPECIAL_SLOT_COUNT, equipSpecial, equippedSpecial, onSpecialsChanged, specialChoices } from './special-equip.ts';

export function mountSpecials(dialog: HTMLDialogElement, nameOf: (id: string) => string) {
  const title = el('h3', '', 'Specials'), summary = el('p', 'grimoire-count', '', { role: 'status' });
  const head = el('div', 'grimoire-head'); head.append(title, summary);
  const close = el('button', 'grimoire-close', '✕', { type: 'button', 'aria-label': 'Close' });
  const list = el('ul', 'grimoire-list');
  dialog.replaceChildren(close, head, list);
  dialog.classList.add('grimoire-dialog', 'special-dialog');   // the spell book's frame and rows: one look for both pickers
  close.addEventListener('click', () => dialog.close());
  const slots = Array.from({ length: SPECIAL_SLOT_COUNT }, (_, i) => i);
  const label = (slot: number) => `SPECIAL ${slot + 1}`;
  const marks: (() => void)[] = [];
  const sync = () => {
    summary.textContent = slots.map((slot) => `${label(slot)}: ${equippedSpecial(slot) ? nameOf(equippedSpecial(slot)!) : 'empty'}`).join(' · ');
    for (const fn of marks) fn();
  };
  const draw = () => {
    marks.length = 0;
    const choices = specialChoices();
    if (!choices.length) { list.replaceChildren(el('li', 'grimoire-empty', 'No specials are on offer yet.')); sync(); return; }
    list.replaceChildren(...choices.map((c) => {
      const li = el('li', 'grimoire-entry'), name = el('b', 'grimoire-name', nameOf(c.id)), role = el('span', 'grimoire-sub', c.role);
      const picks = slots.map((slot) => {
        const pick = el('button', 'grimoire-equip', '', { type: 'button' });
        const mark = () => { const on = equippedSpecial(slot) === c.id; pick.textContent = on ? `In ${label(slot)}` : `Equip ${label(slot)}`; pick.setAttribute('aria-pressed', String(on)); pick.dataset.slot = String(slot + 1); li.classList.toggle('equipped', slots.some((s) => equippedSpecial(s) === c.id)); };
        pick.addEventListener('click', () => equipSpecial(equippedSpecial(slot) === c.id ? undefined : c.id, slot));
        marks.push(mark); return pick;
      });
      li.dataset.skill = c.id; li.append(name, role, ...picks); return li;
    }));
    sync();
  };
  onSpecialsChanged(sync);   // a pick made anywhere (this list, a HUD) re-marks the buttons and the summary
  return { open(): void { draw(); if (!dialog.open) dialog.showModal(); } };
}
function el(tag: string, cls = '', text = '', attrs: Record<string, string> = {}): HTMLElement {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
}
