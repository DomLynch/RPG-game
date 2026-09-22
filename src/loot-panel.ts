// The kill screen's Take-one panel (Strategy brief, owner 2026-09-22: the drop prompt "appeared for about 2 seconds then disappeared...
// we need a better selector/visual menu for what gear we can take off fallen opponents"). DOM only: the caller (src/main.ts, the
// lead's loot rules) decides which pieces to offer and what a take or a decline does; this file draws the row of pieces in
// #loot-panel (tiles) and #loot-panel-actions (the Leave it button, which lives in the bottom thumb row, not the top band), takes
// the tap and calls back. Nothing here auto-dismisses: the panel goes only through hide() (take, decline, Rematch, Next).
// Thumbnails come from scripts/loot-layers.mjs (public/game/img/loot/<id>.thumb.webp); a piece without one (a weapon, until the
// equip files render) shows its name alone.
// A tap on a tile IS the take (Dom, 2026-09-22: "should be auto equipped/taken without the double confirmation"): the Take button
// is gone, the tile flashes, and the caller replaces the tiles with one line and Undo. TAP_GUARD_MS is the whole safety net
// against a fat finger that was already travelling when the panel appeared, so nothing may be taken in that window.
// createLootPanel takes main.ts's element lookup, document and clock rather than reaching for globals, so the entry point's test
// harness (tests/graphics.test.ts) can boot it with its own fake DOM like every other module main.ts requires.
export type LootPanelPiece = { id: string; name: string; owned: boolean; image?: string };
export type LootPanelHandlers = { onTake: (id: string) => void; onDecline: () => void };
type Doc = { createElement: (tag: string) => HTMLElement };

export const TAP_GUARD_MS = 300;

export function createLootPanel(element: (id: string) => HTMLElement, doc: Doc, now: () => number = () => Date.now()) {
  let handlers: LootPanelHandlers | null = null, undo: (() => void) | null = null, openedAt = 0;
  const make = <T extends HTMLElement>(tag: string) => doc.createElement(tag) as T;
  return {
    show(title: string, pieces: readonly LootPanelPiece[], on: LootPanelHandlers): void {
      const panel = element('loot-panel'), list = element('loot-panel-pieces');
      handlers = on; undo = null; openedAt = now();
      element('loot-panel-title').textContent = title;
      element('loot-panel-note-text').textContent = '';
      element('loot-panel-note').hidden = true; element('loot-undo').hidden = true;
      list.replaceChildren(...pieces.map((piece) => {
        const li = make('li'), button = make<HTMLButtonElement>('button'), name = make('span');
        li.setAttribute('data-loot', piece.id); li.setAttribute('data-owned', String(piece.owned));
        button.setAttribute('type', 'button'); button.disabled = piece.owned;
        button.title = piece.owned ? `${piece.name} (yours already)` : piece.name;
        if (piece.image) { const img = make<HTMLImageElement>('img'); img.src = piece.image; img.alt = ''; img.width = img.height = 48; img.decoding = 'async'; button.append(img); }
        name.textContent = piece.name.replace(/^the /, ''); button.append(name);
        if (piece.owned) { const tag = make('small'); tag.textContent = 'Yours'; button.append(tag); }
        // The tap is the take. The guard window is not a debounce: a touch already on its way down when the kill screen arrived
        // must not spend the one take of the fight (the lead's caution, 2026-09-22), and Undo is the only way back.
        button.addEventListener('click', () => {
          if (piece.owned || now() - openedAt < TAP_GUARD_MS) return;
          li.setAttribute('data-took', '1');   // the flash; the caller closes the tiles a moment later
          handlers?.onTake(piece.id);
        });
        li.append(button);
        return li;
      }));
      element('loot-decline').hidden = false; element('loot-panel-actions').hidden = false; list.hidden = false;
      panel.hidden = false;
      panel.setAttribute('data-on', '1');
    },
    // After a take: the tiles and Leave it go, and one line with Undo stays in their place until the caller's timer hides the
    // panel. `onUndo` puts the piece back — the caller restores the whole ledger, provenance included.
    confirm(text: string, onUndo?: () => void): void {
      element('loot-panel-pieces').hidden = true; element('loot-panel-actions').hidden = true; element('loot-decline').hidden = true;
      element('loot-panel-note-text').textContent = text;
      element('loot-panel-note').hidden = false;
      undo = onUndo ?? null;
      element('loot-undo').hidden = !onUndo;
    },
    hide(): void {
      const panel = element('loot-panel');
      panel.hidden = true; element('loot-panel-actions').hidden = true; element('loot-panel-note').hidden = true; element('loot-undo').hidden = true;
      panel.setAttribute('data-on', '0'); handlers = null; undo = null;   // '0', not removeAttribute: the CSS keys on data-on='1' and the entry point's harness element has no removeAttribute
    },
    wire(): void {
      element('loot-decline').addEventListener('click', () => { handlers?.onDecline(); });
      element('loot-undo').addEventListener('click', () => { const back = undo; undo = null; back?.(); });
    },
  };
}
