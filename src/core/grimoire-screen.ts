// The spell book (Web, programme 2b, "kill a boss, take their spell"): a dialog on a phone listing the account's taken spells, read-only (the server writes the book). Each entry: the legend's name, its family and
// spell, and the spell's bricks as chips. Empty book: "Beat a legend to take their spell". A guest or an unanswered writer says so and shows nothing else.
import { EMPTY, entriesOf, type Entry } from './grimoire-model.ts';
import type { Spell } from './grimoire-net.ts';

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
  const draw = (entries: Entry[]) => {
    count.textContent = `${entries.length} ${entries.length === 1 ? 'spell' : 'spells'}`;
    if (!entries.length) { say(EMPTY); return; }
    list.replaceChildren(...entries.map((e) => {
      const li = el('li', 'grimoire-entry'), name = el('b', 'grimoire-name', e.name), sub = el('span', 'grimoire-sub', [e.family && `${e.family} family`, e.spell].filter(Boolean).join(' · '));
      const chips = el('span', 'grimoire-bricks'); chips.append(...e.bricks.map((b) => el('i', 'grimoire-brick', b)));
      li.dataset.legend = e.legend; li.append(name, sub, chips); return li;
    }));
  };
  return {
    async open(): Promise<void> {
      count.textContent = ''; say('Reading your spell book…', 'grimoire-empty');
      if (!dialog.open) dialog.showModal();
      const book = await load();
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
