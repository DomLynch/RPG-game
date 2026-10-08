// The duel's way out of the ☰ menu: a "Leave the Pit" button first in the game's app nav (id nav-pit, as the game's own once was), which closes the menu and
// runs the page's leave. Pure, so leave-entry.test.ts can fire it; one entry only, however often the duel binds.
export function addLeaveEntry(nav: HTMLElement, closeMenu: () => void, leave: () => void): HTMLElement {
  const had = nav.querySelector?.('#nav-pit') as HTMLElement | null;
  if (had) return had;
  const button = nav.ownerDocument.createElement('button');
  button.type = 'button'; button.id = 'nav-pit'; button.textContent = 'Leave the Pit';
  button.addEventListener('click', () => { closeMenu(); leave(); });
  nav.prepend(button);
  return button;
}
