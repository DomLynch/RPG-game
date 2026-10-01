// The Pit's one bottom sheet (#pit-ui, style.css): what the zone he stands in offers. Low and short (Web, 2026-09-29: Dom has twice
// rejected panels over the arena, #670). Built once per page with the room; shown only while the Pit shows.
import type { GameStage } from './stage.ts';
import type { Loot } from '../loot.ts';
import { trophyIds, type Pick } from './room.ts';

export type Sheet = { show(zone: Pick | null): void; hide(): void; dispose(): void };

export function createSheet(game: GameStage, loot: () => Loot, worn: () => void): Sheet {
  const root = document.createElement('section'), title = document.createElement('h2'), body = document.createElement('div');
  root.id = 'pit-ui'; root.hidden = true; root.setAttribute('aria-live', 'polite');
  root.append(title, body);
  document.body.append(root);
  let zone: Pick | null | undefined;
  const render = () => {
    const nodes: HTMLElement[] = [];
    if (zone === 'rack') {
      title.textContent = 'The rack';
      const list = document.createElement('ul');
      list.className = 'pit-rack';
      list.append(...game.rackRows());
      nodes.push(list);
      if (!list.childElementCount) nodes.push(line('Nothing taken yet. Win, and take a piece off the fallen.'));
      if (game.openJournal) {   // the full loadout sheet: worn, stored, weapons and armour on and off (Dom 2026-10-01)
        const open = document.createElement('button');
        open.type = 'button'; open.className = 'pit-go'; open.textContent = 'Open loadout';
        open.addEventListener('click', () => game.openJournal?.());
        nodes.push(open);
      }
    } else if (zone === 'trophies') {
      title.textContent = 'Trophies';
      const ids = trophyIds(loot());
      nodes.push(...(ids.length ? ids.map((id) => line(game.trophyLine(id))) : [line('Your best-taken pieces stand here.')]));
    } else if (zone?.startsWith('skull:')) {   // a slot of the skull wall: the legend's card, or the unbeaten slot's name and rank
      const card = game.legend?.(zone.slice(6)) ?? null;
      if (!card) { title.textContent = 'The skull wall'; nodes.push(line('One skull for every legend you beat.')); }
      else if (!card.beaten) { title.textContent = `${card.opponent} · rank ${card.rank}`; nodes.push(line(`Unbeaten. ${card.name} waits at rank ${card.rank}.`)); }
      else {
        title.textContent = `${card.name} · rank ${card.rank}`;
        const figure = document.createElement('div'), face = document.createElement('img');
        figure.className = 'pit-skull'; face.src = card.portrait; face.alt = card.name; face.width = 64; face.height = 64; face.loading = 'lazy';
        figure.append(face, line(card.backstory), Object.assign(line(card.source), { className: 'pit-source' }));
        nodes.push(figure);
      }
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
