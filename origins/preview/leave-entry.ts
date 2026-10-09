// The duel's way out of the ☰ menu: a "Leave the Pit" button first in the game's app nav (id nav-pit, as the game's own once was), which closes the menu and
// runs the page's leave. Pure, so leave-entry.test.ts can fire it; one entry only, however often the duel binds.
export function addLeaveEntry(nav: HTMLElement, closeMenu: () => void, leave: () => void, label = 'Leave the Pit', text = label): HTMLElement {
  const had = nav.querySelector?.('#nav-pit') as HTMLElement | null;
  if (had) return had;
  const button = nav.ownerDocument.createElement('button');
  button.type = 'button'; button.id = 'nav-pit'; button.textContent = text; button.setAttribute('aria-label', label); button.title = label;   // the CSS ellipsizes a long label; the full name stays in the accessible name and the tooltip   // the Pit's words by default; a zone passes its own ("Back to <zone name>")
  button.addEventListener('click', () => { closeMenu(); leave(); });
  nav.prepend(button);
  return button;
}

// What a zone's exit says: "‹ Cinder Fields" on the button (the display name without its leading "The"), "Back to The Cinder Fields" for assistive tech and the tooltip. Pure, so the test reads it.
export const exitFace = (zoneName: string): { back: string; text: string } => ({ back: `Back to ${zoneName}`, text: `\u2039 ${zoneName.replace(/^the\s+/i, '')}` });

// "Arena / Pit" first in the same nav (Dom 2026-10-08: the world is the game, the Pit is a building in town): the stable /arena/ page (deploy/frankendom.com.conf), the 50-level ladder.
// `go` is injected so the test can fire it; one entry only.
export function addArenaEntry(nav: HTMLElement, go: () => void): HTMLElement {
  const had = nav.querySelector?.('#nav-arena-page') as HTMLElement | null;
  if (had) return had;
  const button = nav.ownerDocument.createElement('button');
  button.type = 'button'; button.id = 'nav-arena-page'; button.textContent = 'Arena / Pit';
  button.addEventListener('click', go);
  nav.prepend(button);
  return button;
}
