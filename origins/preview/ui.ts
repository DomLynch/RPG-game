// The greybox UI kit: every panel is built from these few pieces, so a look pass restyles the classes in index.html (which read only the
// :root theme tokens) and never touches a panel. Markup only; no colours, fonts or sizes here.
const esc = (s: string | number) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const data = (d: Record<string, string>) => Object.entries(d).map(([k, v]) => ` data-${k}="${esc(v)}"`).join('');

export type Cell = { id: string; label: string; on?: boolean } | null;
export const ui = {
  panel: (title: string, ...body: string[]) => `<h2>${esc(title)}</h2>${body.join('')}`,
  heading: (text: string) => `<h3>${esc(text)}</h3>`,
  text: (text: string, muted = false) => (text ? `<p class="${muted ? 'muted' : 'say'}">${esc(text)}</p>` : ''),
  button: (label: string, d: Record<string, string>, disabled = false, primary = false) => `<button class="act${primary ? ' primary' : ''}"${data(d)}${disabled ? ' disabled' : ''}>${esc(label)}</button>`,
  row: (left: string, right: string, d: Record<string, string>, on = false) => `<button class="piece${on ? ' on' : ''}"${data(d)}><span>${esc(left)}</span><span>${esc(right)}</span></button>`,
  choices: (lines: { id: string; text: string }[]) => lines.map((l) => ui.button(l.text, { say: l.id })).join(''),
  dock: (left: string, right: string) => `<div class="dock"><div>${left}</div><div>${right}</div></div>`,   // 50/50 on a phone: worn + vault left, backpack right (docs/DESIGN.md rule 9)
  grid: (cells: Cell[]) => `<div class="grid">${cells.map((c) => (c ? `<button class="slot${c.on ? ' on' : ''}" data-item="${esc(c.id)}">${esc(c.label)}</button>` : '<i class="slot"></i>')).join('')}</div>`,
};
