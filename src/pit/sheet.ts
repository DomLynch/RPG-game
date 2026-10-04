// The Pit's one bottom sheet (#pit-ui, style.css): what the zone he stands in offers. Low and short (Web, 2026-09-29: Dom has twice
// rejected panels over the arena, #670). Built once per page with the room; shown only while the Pit shows.
import type { GameStage } from './stage.ts';
import type { Loot } from '../loot.ts';
import type { AiSkull } from './skulls.ts';
import { trophyIds, type Pick } from './room.ts';

const DUEL_HINT = 'Beat a real player in a duel to hang their skull here.';
// "ranks 1, 3, 7 · W 8 · L 2"; a win with no recorded rank (an old one) is "ranks unknown"; an unbeaten opponent has no record to show.
export const opponentLine = (a: AiSkull): string => (!a.beaten ? 'Not beaten yet' : `${a.ranks.length ? `ranks ${a.ranks.join(', ')}` : 'ranks unknown'} · W ${a.wins} · L ${a.losses}`);
export type Sheet = { show(zone: Pick | null): void; hide(): void; dispose(): void };

// `quiet` (pit-glow, Dom 10-04: "remove this black helper thing"): no sheet in open floor, only at the rack, the trophies and the gate.
export function createSheet(game: GameStage, loot: () => Loot, worn: () => void, quiet = false): Sheet {
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
    } else if (zone?.startsWith('skull:ai:')) {   // a niche of the left panel: every computer opponent, with the ranks beaten and the record
      title.textContent = 'The skull wall · opponents';
      const list = document.createElement('ul');
      list.className = 'pit-opponents';
      for (const a of game.skullsNow?.()?.ai ?? []) {
        const top = a.ranks.length ? Math.max(...a.ranks) : 1, card = game.legend?.(`${a.opponent}-${top}`) ?? game.legend?.(`${a.opponent}-1`) ?? null;
        const row = document.createElement('li'), name = document.createElement('strong');
        row.className = 'pit-opponent'; name.textContent = card?.opponent ?? a.opponent;
        if (card) { const face = document.createElement('img'); face.src = card.portrait; face.alt = card.name; face.width = 40; face.height = 40; face.loading = 'lazy'; row.append(face); }
        row.append(name, line(opponentLine(a)));
        list.append(row);
      }
      nodes.push(list);
    } else if (zone?.startsWith('skull:duel:')) {   // a niche of the right panel: a real player beaten in a duel, or the hint for an empty one
      const d = game.skullsNow?.()?.duels[Number(zone.slice(11))];
      if (!d) { title.textContent = 'The skull wall · players'; nodes.push(line(DUEL_HINT)); }
      else {
        title.textContent = d.name;
        const gear = Object.values(d.gear).slice(0, 6).map((id) => game.pieceName?.(id) ?? id);
        nodes.push(line(`Level ${d.level}`), ...(gear.length ? [line(gear.join(', '))] : []), line(`Last beaten ${d.lastWinAt ? d.lastWinAt.slice(0, 10) : 'long ago'}`), line(`Your record against them: W ${d.wins} · L ${d.losses}`));
      }
    } else if (zone?.startsWith('skull:')) {
      title.textContent = 'The skull wall'; nodes.push(line(DUEL_HINT));
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
    show(next) { root.hidden = quiet && !next; if (root.hidden) { zone = next; return; } if (next !== zone) { zone = next; render(); } },
    hide() { root.hidden = true; zone = undefined; },
    dispose() { root.remove(); },
  };
}

function line(text: string): HTMLElement {
  const p = document.createElement('p');
  p.textContent = text;
  return p;
}
