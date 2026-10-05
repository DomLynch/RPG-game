// The Pit's one bottom sheet (#pit-ui, style.css): what the zone he stands in offers. Low and short (Web, 2026-09-29: Dom has twice
// rejected panels over the arena, #670). Built once per page with the room; shown only while the Pit shows.
import type { GameStage } from './stage.ts';
import type { Loot } from '../loot.ts';
import { recordLines } from './board.ts';
import { NO_CHAMPIONS, championLine } from './skulls.ts';
import type { Kill } from './skulls.ts';
import { RACK_SLOTS, rackIds, trophyIds, type Pick } from './room.ts';

const EMPTY_HINT = 'Kills hang here, newest first. Beat an opponent to hang the first skull.';
export const dateLine = (at: string | null): string => (at ? at.slice(0, 10) : 'long ago');
// One kill's card, as lines: a computer legend (its portrait is added by the sheet) with its rank, or a player with level, gear and the date.
export function killLines(k: Kill, pieceName?: (id: string) => string): string[] {
  if (k.kind === 'ai') return [k.rank ? `Rank ${k.rank}` : 'Rank unknown', dateLine(k.at)];
  const gear = Object.values(k.gear).slice(0, 6).map((id) => pieceName?.(id) ?? id);
  return [`Level ${k.level}`, ...(gear.length ? [gear.join(', ')] : []), `Beaten ${dateLine(k.at)}`];
}
export type Sheet = { show(zone: Pick | null): void; hide(): void; dispose(): void };

// `quiet` (pit-glow, Dom 10-04: "remove this black helper thing"): no sheet in open floor, only at the rack, the trophies and the gate.
export function createSheet(game: GameStage, loot: () => Loot, worn: () => void, quiet = false, order: readonly string[] = []): Sheet {
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
      const l = loot();
      list.append(...game.rackRows(rackIds(l, trophyIds(l), RACK_SLOTS, order)));
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
    } else if (zone === 'board') {   // the carved record: the same numbers as lines, and the split of the latest 30 kills
      title.textContent = 'The record';
      const r = game.recordNow?.();
      nodes.push(...(r ? recordLines(r).map(line) : [line('Your record is carved here.')]));
      if (r) nodes.push(line(`Computer kills (latest 30): ${r.computerKills ?? '\u2014'} · Duel kills (latest 30): ${r.duelKills ?? '\u2014'}`));
    } else if (zone === 'champions') {   // the board's five lines in full: feat, name, value
      title.textContent = "Today's champions";
      const list = game.championsNow?.() ?? [];
      nodes.push(...(list.length ? list.map((c) => line(championLine(c))) : [line(NO_CHAMPIONS)]));
    } else if (zone?.startsWith('skull:')) {   // a niche of the wall: that kill's card, or the hint for an empty one
      const k = game.skullsNow?.()?.[Number(zone.slice(6))];
      if (!k) { title.textContent = 'The skull wall'; nodes.push(line(EMPTY_HINT)); }
      else {
        title.textContent = k.name;
        if (k.kind === 'ai') {   // the legend's portrait: its rank when known, else rank 1's
          const card = game.legend?.(k.opponent ? `${k.opponent}-${k.rank ?? 1}` : k.key) ?? null;
          if (card) { const face = document.createElement('img'); face.src = card.portrait; face.alt = card.name; face.width = 96; face.height = 96; face.loading = 'lazy'; nodes.push(face); }
        }
        nodes.push(...killLines(k, game.pieceName).map(line));
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
