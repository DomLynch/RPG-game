// The spell book (Web, programme 2b, "kill a boss, take their spell"): a dialog on a phone listing the account's taken spells, read-only (the server writes the book). Each entry: the legend's name, its family and
// spell, and the spell's bricks as chips. Empty book: "Beat a legend to take their spell". A guest or an unanswered writer says so and shows nothing else.
import { EMPTY, entriesOf, type Entry } from './grimoire-model.ts';
import type { Spell } from './grimoire-net.ts';
import { equipSpell, equippedSpell, equippedSpells, setOwnedSpells } from './spell-equip.ts';
import { SPELL_SLOTS } from '../fight/spell-slot-rows.ts';

type Load = () => Promise<Spell[] | null>;
export function mountGrimoire(dialog: HTMLDialogElement, load: Load) {
  const title = el('h3', '', 'Spell book'), count = el('p', 'grimoire-count', '', { role: 'status' });
  const head = el('div', 'grimoire-head'); head.append(title, count);
  const close = el('button', 'grimoire-close', '✕', { type: 'button', 'aria-label': 'Close' });
  const list = el('ul', 'grimoire-list');
  dialog.replaceChildren(close, head, list);
  dialog.classList.add('grimoire-dialog');
  close.addEventListener('click', () => dialog.close());
  const say = (text: string, cls = 'grimoire-empty') => { list.replaceChildren(el('li', cls, text)); };
  const marks: (() => void)[] = [];
  const draw = (entries: Entry[]) => {
    marks.length = 0;
    count.textContent = `${entries.length} ${entries.length === 1 ? 'spell' : 'spells'}`;
    if (!entries.length) { say(EMPTY); return; }
    list.replaceChildren(...entries.map((e) => {
      const li = el('li', 'grimoire-entry'), name = el('b', 'grimoire-name', e.name), sub = el('span', 'grimoire-sub', [e.family && `${e.family} family`, e.spell, e.school, e.level ? `level ${e.level}` : ''].filter(Boolean).join(' · '));
      if (e.color) li.style.setProperty('--school', e.color);   // the school's row colour (spell-catalogue.ts), never a literal here
      const chips = el('span', 'grimoire-bricks'); chips.append(...e.bricks.map((b) => el('i', 'grimoire-brick', b)));
      const picks = SPELL_SLOTS.map((slot, i) => {
        const pick = el('button', 'grimoire-equip', '', { type: 'button' }), label = slot.id.toUpperCase();
        const mark = () => { const on = equippedSpell(i) === e.legend; pick.textContent = on ? `In slot ${label}` : `Equip ${label}`; pick.setAttribute('aria-pressed', String(on)); pick.dataset.slot = slot.id; li.classList.toggle('equipped', equippedSpells().includes(e.legend)); };
        pick.addEventListener('click', () => { equipSpell(equippedSpell(i) === e.legend ? undefined : e.legend, i); for (const fn of marks) fn(); });
        marks.push(mark); mark(); return pick;
      });
      li.dataset.legend = e.legend; li.append(name, sub, chips, ...picks); return li;
    }));
  };
  return {
    /** Read the book and remember its ids for the fight's spell port, without opening the dialog (page load). */
    async refresh(): Promise<void> { setOwnedSpells((await load())?.map((x) => x.legend) ?? []); },
    async open(): Promise<void> {
      count.textContent = ''; say('Reading your spell book…', 'grimoire-empty');
      if (!dialog.open) dialog.showModal();
      const book = await load();
      setOwnedSpells(book?.map((x) => x.legend) ?? []);
      if (!book) { say('Sign in to see your spell book.'); return; }
      const { SPELL_INFO } = await import('../fight/spell-catalogue.ts');   // the 700-row catalogue loads only here
      draw(entriesOf(book, SPELL_INFO));
    },
  };
}
function el(tag: string, cls = '', text = '', attrs: Record<string, string> = {}): HTMLElement {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
}
