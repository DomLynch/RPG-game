// The kill screen's Take-one panel (Strategy brief, owner 2026-09-22: the drop prompt "appeared for about 2 seconds then disappeared...
// we need a better selector/visual menu for what gear we can take off fallen opponents"). DOM only: the caller (src/main.ts, the
// lead's loot rules) decides which pieces to offer and what a take or a decline does; this file draws the row of pieces in
// #loot-panel (the card and the tiles) and #loot-panel-actions (Take and Leave, which live in the bottom thumb row, not the top band), takes
// the tap and calls back. Nothing here auto-dismisses: the panel goes only through hide() (take, decline, Rematch, Next).
// Thumbnails come from scripts/loot-layers.mjs (armour) and scripts/weapon-thumbs.mjs (weapons), both public/game/img/loot/<id>.thumb.webp;
// a piece given no image shows its name alone.
// A tap on a tile IS the take (Dom, 2026-09-22: "should be auto equipped/taken without the double confirmation"; kept by Strategy for E2,
// 2026-09-26): no highlight-then-confirm. Take takes the default offer drawn big on the card. The tile flashes, and the caller
// replaces the tiles with one line and Undo. TAP_GUARD_MS is the whole safety net against a fat finger that was already travelling when the panel appeared, so nothing may be taken in that window.
// createLootPanel takes main.ts's element lookup, document and clock rather than reaching for globals, so the entry point's test
// harness (tests/graphics.test.ts) can boot it with its own fake DOM like every other module main.ts requires.
// The take screen E2 (Dom's pick, 2026-09-26, via Strategy): a bone card with the default offer drawn big (`card`: the rung it was won at,
// its name, its render), and under it THE ROW IS THE PICK: every takeable piece and the fallen's move, one tile each, big enough to see.
// No stats (they are Origin season 1). A piece you own is a swap (it goes back on you) and is never greyed; either way it is the kill's one take.
// `gives`: what a take costs. One skill slot (Dom 2026-09-25): a foe's move offered to a player who holds another is a swap too, and the
// held move is named in the tile's title and label.
export type LootPanelPiece = { id: string; name: string; owned: boolean; image?: string; gives?: { name: string; image?: string } };
// `held`: what the offer would replace (the piece worn in the same slot): with it the card becomes NEW beside EQUIPPED (Dom's pickup-compare reference, 2026-10-11), same slot label on both, nothing else invented (stats are Origin season 1).
export type LootPanelCompare = { slot: string; held: { name: string; image?: string } };
export type LootPanelCard = { eyebrow: string; offer: string; name: string; image?: string; compare?: LootPanelCompare };
export type LootPanelHandlers = { onTake: (id: string) => void; onDecline: () => void };
type Doc = { createElement: (tag: string) => HTMLElement };

export const TAP_GUARD_MS = 300;
// A tile names the piece, not its owner: the title above already says whose it is ("Take one from the Centurion"), and at a
// 56 px tile "Centurion's helmet" broke mid-word at the apostrophe on a phone, nine times over. "the Centurion's helmet" →
// "Helmet"; a name with no possessive just loses its article. The full name stays in the button's title.
export const tileLabel = (name: string) => { const piece = name.replace(/^.*'s /, '').replace(/^the /, ''); return piece[0]!.toUpperCase() + piece.slice(1); };

export function createLootPanel(element: (id: string) => HTMLElement, doc: Doc, now: () => number = () => Date.now()) {
  let handlers: LootPanelHandlers | null = null, undo: (() => void) | null = null, openedAt = 0, offer = '';
  const make = <T extends HTMLElement>(tag: string) => doc.createElement(tag) as T;
  const take = (li: HTMLElement | null, id: string) => {
    if (!handlers || now() - openedAt < TAP_GUARD_MS) return;
    li?.setAttribute('data-took', '1');   // the flash; the caller closes the tiles a moment later
    handlers.onTake(id);
  };
  return {
    show(card: LootPanelCard, pieces: readonly LootPanelPiece[], on: LootPanelHandlers): void {
      const panel = element('loot-panel'), list = element('loot-panel-pieces'), hero = element('loot-panel-hero') as HTMLImageElement;
      handlers = on; undo = null; openedAt = now(); offer = card.offer;
      element('loot-panel-title').textContent = card.eyebrow;
      element('loot-panel-name').textContent = card.name;
      hero.hidden = !card.image || !!card.compare; if (card.image) hero.src = card.image;
      element('loot-panel-head').hidden = false; element('loot-panel-name').hidden = !!card.compare;   // compare: the cards carry the names; the "Won at ..." line and the pick hint stay
      const compare = element('loot-panel-compare');
      compare.hidden = !card.compare;
      compare.replaceChildren(...(card.compare ? [['new', 'New', card.name, card.image], ['held', 'Equipped', card.compare.held.name, card.compare.held.image]] as const : []).map(([side, tag, name, image]) => {
        const box = make('div'), head = make('p'), img = make<HTMLImageElement>('img'), slot = make('p'), title = make('p');
        box.setAttribute('data-side', side); head.textContent = tag; head.setAttribute('class', 'loot-card-tag');
        if (image) { img.src = image; img.alt = ''; img.width = img.height = 64; img.decoding = 'async'; box.append(head, img); } else box.append(head);
        title.textContent = name[0]!.toUpperCase() + name.slice(1);   // both cards in one form: "Kobold's helmet" beside "the Pitborn's helmet" read as two styles title.setAttribute('class', 'loot-card-name'); slot.textContent = card.compare!.slot; slot.setAttribute('class', 'loot-card-slot');
        box.append(title, slot);
        return box;
      }));
      element('loot-panel-note-text').textContent = '';
      element('loot-panel-note').hidden = true; element('loot-undo').hidden = true;
      list.replaceChildren(...pieces.map((piece) => {
        const li = make('li'), button = make<HTMLButtonElement>('button'), name = make('span');
        const swap = piece.owned || !!piece.gives;   // owned: it goes back on you; a move: it replaces the one you hold
        li.setAttribute('data-loot', piece.id); li.setAttribute('data-owned', String(piece.owned)); li.setAttribute('data-swap', swap ? '1' : '0');
        if (piece.id === card.offer) li.setAttribute('data-offer', '1');
        button.setAttribute('type', 'button');
        button.title = piece.owned ? `${piece.name} (yours: wear it)` : piece.gives ? `${piece.name} (replaces ${piece.gives.name})` : piece.name;
        button.setAttribute('aria-label', button.title);
        if (piece.image) { const img = make<HTMLImageElement>('img'); img.src = piece.image; img.alt = ''; img.width = img.height = 54; img.decoding = 'async'; button.append(img); }
        name.textContent = tileLabel(piece.name); button.append(name);
        // The tap is the take. The guard window is not a debounce: a touch already on its way down when the kill screen arrived
        // must not spend the one take of the fight (the lead's caution, 2026-09-22), and Undo is the only way back.
        button.addEventListener('click', () => { take(li, piece.id); });
        li.append(button);
        return li;
      }));
      element('loot-take').hidden = !card.offer; element('loot-decline').hidden = false; element('loot-panel-actions').hidden = false; list.hidden = false;
      panel.hidden = false;
      panel.setAttribute('data-on', '1');
    },
    // After a take: the tiles and Leave it go, and one line with Undo stays in their place until the caller's timer hides the
    // panel. `onUndo` puts the piece back — the caller restores the whole ledger, provenance included.
    confirm(text: string, onUndo?: () => void): void {
      element('loot-panel-pieces').hidden = true; element('loot-panel-head').hidden = true; element('loot-panel-compare').hidden = true; element('loot-panel-actions').hidden = true; element('loot-decline').hidden = true;
      element('loot-panel-note-text').textContent = text;
      element('loot-panel-note').hidden = false;
      undo = onUndo ?? null;
      element('loot-undo').textContent = 'Undo'; element('loot-undo').hidden = !onUndo;
    },
    // A question before a take (the pack is full, so the piece it would replace has nowhere to go): the tiles and Leave it stay, so
    // another tile or Leave it is the answer "no"; the line's pill, relabelled, is the "yes".
    ask(text: string, label: string, onYes: () => void): void {
      element('loot-panel-note-text').textContent = text;
      element('loot-panel-note').hidden = false;
      undo = onYes;
      element('loot-undo').textContent = label; element('loot-undo').hidden = false;
    },
    hide(): void {
      const panel = element('loot-panel');
      panel.hidden = true; element('loot-panel-compare').hidden = true; element('loot-panel-actions').hidden = true; element('loot-panel-note').hidden = true; element('loot-undo').hidden = true;
      panel.setAttribute('data-on', '0'); handlers = null; undo = null;   // '0', not removeAttribute: the CSS keys on data-on='1' and the entry point's harness element has no removeAttribute
    },
    wire(): void {
      element('loot-decline').addEventListener('click', () => { handlers?.onDecline(); });
      // Take = the default offer, the piece drawn big on the card (Strategy's ruling 2026-09-26): the same take as its tile, guard included.
      element('loot-take').addEventListener('click', () => { const li = element('loot-panel-pieces').querySelector?.(`li[data-offer='1']`) as HTMLElement | null; if (offer) take(li, offer); });
      element('loot-undo').addEventListener('click', () => { const back = undo; undo = null; back?.(); });
    },
  };
}
