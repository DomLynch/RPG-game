// The Pit's one bottom sheet (#pit-ui, style.css): what the zone he stands in offers. Low and short (Web, 2026-09-29: Dom has twice
// rejected panels over the arena, #670). Built once per page with the room; shown only while the Pit shows.
import type { GameStage } from './stage.ts';
import type { Loot } from '../loot.ts';
import type { Zone } from './mover.ts';
import { trophyIds } from './room.ts';

export type Sheet = { show(zone: Zone | null): void; hide(): void; dispose(): void };

export function createSheet(game: GameStage, loot: () => Loot, worn: () => void): Sheet {
  const root = document.createElement('section'), title = document.createElement('h2'), body = document.createElement('div');
  root.id = 'pit-ui'; root.hidden = true; root.setAttribute('aria-live', 'polite');
  root.append(title, body);
  document.body.append(root);
  let zone: Zone | null | undefined;
  const render = () => {
    const nodes: HTMLElement[] = [];
    if (zone === 'rack') {
      title.textContent = 'The rack';
      const list = document.createElement('ul');
      list.className = 'pit-rack';
      list.append(...game.rackRows());
      nodes.push(list);
      if (!list.childElementCount) nodes.push(line('Nothing taken yet. Win, and take a piece off the fallen.'));
    } else if (zone === 'trophies') {
      title.textContent = 'Trophies';
      const ids = trophyIds(loot());
      nodes.push(...(ids.length ? ids.map((id) => line(game.trophyLine(id))) : [line('Your best-taken pieces stand here.')]));
    } else if (zone === 'gate') {
      const gate = game.gate(), button = document.createElement('button');
      title.textContent = 'The gate';
      button.type = 'button'; button.className = 'pit-go'; button.textContent = gate.label;
      button.addEventListener('click', () => gate.go());
      nodes.push(button);
    } else {
      title.textContent = 'The Pit';
      nodes.push(line('The rack is to your left, your trophies to your right. The gate ahead leads back to the arena.'));
    }
    body.replaceChildren(...nodes);
  };
  // A Wear/Worn tap runs the journal's own handler first (the button's listener), then bubbles here: redraw the rows and the rack.
  root.addEventListener('click', (event) => {
    if (zone === 'rack' && (event.target as HTMLElement).closest('[data-wear]')) { render(); worn(); }
  });
  return {
    show(next) { root.hidden = false; if (next !== zone) { zone = next; render(); } },
    hide() { root.hidden = true; zone = undefined; },
    dispose() { root.remove(); },
  };
}

function line(text: string): HTMLElement {
  const p = document.createElement('p');
  p.textContent = text;
  return p;
}
