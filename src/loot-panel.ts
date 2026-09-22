// The kill screen's Take-one panel (Strategy brief, owner 2026-09-22: the drop prompt "appeared for about 2 seconds then disappeared...
// we need a better selector/visual menu for what gear we can take off fallen opponents"). DOM only: the caller (src/main.ts, the
// lead's loot rules) decides which pieces to offer and what a take or a decline does; this file draws the row of pieces in
// #loot-panel (tiles) and #loot-panel-actions (the Take / Leave it row, which lives in the bottom thumb row, not the top band), keeps the
// tap selection, and calls back. Nothing here auto-dismisses: the panel goes only through hide()
// (take, decline, Rematch, Next). Thumbnails come from scripts/loot-layers.mjs (public/game/img/loot/<id>.thumb.webp); a piece
// without one (a weapon, until the equip files render) shows its name alone.
// createLootPanel takes main.ts's element lookup and document rather than reaching for globals, so the entry point's test harness
// (tests/graphics.test.ts) can boot it with its own fake DOM like every other module main.ts requires.
export type LootPanelPiece = { id: string; name: string; owned: boolean; image?: string };
export type LootPanelHandlers = { onTake: (id: string) => void; onDecline: () => void };
type Doc = { createElement: (tag: string) => HTMLElement };

export function createLootPanel(element: (id: string) => HTMLElement, doc: Doc) {
  let selected: string | null = null, handlers: LootPanelHandlers | null = null;
  const make = <T extends HTMLElement>(tag: string) => doc.createElement(tag) as T;
  function select(id: string): void {
    selected = id;
    for (const li of Array.from(element('loot-panel-pieces').children)) for (const button of Array.from(li.children)) button.setAttribute('aria-pressed', String(li.getAttribute('data-loot') === id));
    (element('loot-take') as HTMLButtonElement).disabled = false;
  }
  return {
    show(title: string, pieces: readonly LootPanelPiece[], on: LootPanelHandlers): void {
      const panel = element('loot-panel'), list = element('loot-panel-pieces'), take = element('loot-take') as HTMLButtonElement;
      handlers = on; selected = null;
      element('loot-panel-title').textContent = title;
      element('loot-panel-note').textContent = '';
      list.replaceChildren(...pieces.map((piece) => {
        const li = make('li'), button = make<HTMLButtonElement>('button'), name = make('span');
        li.setAttribute('data-loot', piece.id); li.setAttribute('data-owned', String(piece.owned));
        button.setAttribute('type', 'button'); button.setAttribute('aria-pressed', 'false'); button.disabled = piece.owned;
        button.title = piece.owned ? `${piece.name} (yours already)` : piece.name;
        if (piece.image) { const img = make<HTMLImageElement>('img'); img.src = piece.image; img.alt = ''; img.width = img.height = 48; img.decoding = 'async'; button.append(img); }
        name.textContent = piece.name.replace(/^the /, ''); button.append(name);
        if (piece.owned) { const tag = make('small'); tag.textContent = 'Yours'; button.append(tag); }
        button.addEventListener('click', () => select(piece.id));
        li.append(button);
        return li;
      }));
      take.disabled = true; take.hidden = false; element('loot-decline').hidden = false; element('loot-panel-actions').hidden = false; list.hidden = false;
      panel.hidden = false;
      panel.setAttribute('data-on', '1');
    },
    // After a take: the row goes, one line stays ("the Veteran's helmet is on you") until the next fight clears the panel.
    confirm(text: string): void {
      element('loot-panel-pieces').hidden = true; element('loot-panel-actions').hidden = true; element('loot-take').hidden = true; element('loot-decline').hidden = true;
      element('loot-panel-note').textContent = text;
    },
    hide(): void {
      const panel = element('loot-panel');
      panel.hidden = true; element('loot-panel-actions').hidden = true; panel.setAttribute('data-on', '0'); selected = null; handlers = null;   // '0', not removeAttribute: the CSS keys on data-on='1' and the entry point's harness element has no removeAttribute
    },
    wire(): void {
      element('loot-take').addEventListener('click', () => { if (selected && handlers) handlers.onTake(selected); });
      element('loot-decline').addEventListener('click', () => { handlers?.onDecline(); });
    },
  };
}
