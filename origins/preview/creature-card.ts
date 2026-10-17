// The creature info card's view: a small glass card in the HUD's flow (no pause, no modal: nothing pauses in the open world) for the nearest
// creature that has noticed the hero. Reads the data in src/core/world/info.ts; draws nothing of its own invention.
import { BANDS, creatureInfo, type CreatureInfo } from '../../src/core/index.ts';
import type { MobRow } from '../../src/core/index.ts';
import type { MobSpec } from './mobs.ts';

type Seen = { id: string; x: number; z: number; mode: string };
// Pure pick: the creature the hero is fighting now (`engaged`, the world fight's target: a nearer creature that has only noticed him must not take the card
// mid-bout), else `focus` (a tapped legend, which stands still and never notices), each while it is in the list, else the nearest creature in `aggro` mode, or null.
// `seen` is what mobs-view.debug() reports.
export function nearestNoticing(seen: readonly Seen[], hero: { x: number; z: number }, focus?: string | null, engaged?: string | null): Seen | null {
  const e = engaged ? seen.find((m) => m.id === engaged) : undefined; if (e) return e;
  const f = focus ? seen.find((m) => m.id === focus) : undefined; if (f) return f;
  let best: Seen | null = null, bd = Infinity;
  for (const m of seen) if (m.mode === 'aggro') { const d = Math.hypot(m.x - hero.x, m.z - hero.z); if (d < bd) { bd = d; best = m; } }
  return best;
}
// The card's lines: name and level; the con marks (dash count = band index, so colour is never the only cue) with the danger word; commonness and group.
export const cardLines = (i: CreatureInfo): [string, string, string] => [`${i.name} · Lv ${i.level}`, `${'▰'.repeat(i.band)}${'▱'.repeat(BANDS.length - 1 - i.band)} ${i.danger}`, `${i.common} · ${i.group}`];

export function createCreatureCard(el: HTMLElement, specs: readonly MobSpec[], rows: readonly MobRow[], heroLevel: () => number) {
  const byId = new Map(specs.map((s) => [s.id, s])), l1 = document.createElement('b'), l2 = document.createElement('span'), l3 = document.createElement('small');
  el.replaceChildren(l1, l2, l3); for (const n of [l1, l2, l3]) n.style.display = 'block';
  let shown = '';
  return {
    // Called a few times a second, not every frame (debug() builds a list).
    update(seen: readonly Seen[], hero: { x: number; z: number }, focus?: string | null, engaged?: string | null): string | null {
      const m = nearestNoticing(seen, hero, focus, engaged), spec = m && byId.get(m.id);
      if (!spec) { if (shown) { el.hidden = true; shown = ''; } return null; }
      if (shown !== spec.id) {
        const info = creatureInfo(spec, rows.find((r) => r.id === spec.character), heroLevel(), rows), [a, b, c] = cardLines(info);
        l1.textContent = a; l2.textContent = b; l2.style.color = info.color; l3.textContent = c; el.hidden = false; shown = spec.id;
      }
      return spec.id;   // main.ts hides this creature's own name label while the card is up
    },
  };
}
