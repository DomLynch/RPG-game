// The stance preview (Strategy, 2026-10-07: "?stances=1, a look-test on the existing Pit page"): a small panel where the player picks one of the four stances and sees both stances at the fight start,
// theirs and the opponent's mood. Presentation only: the pick is Match.stancePref, the sim reads it through begin() -> initialPractice, and a page without ?stances=... never builds this panel, so every
// live fight is as it was. Nothing appears over the arena; the panel sits in a corner (the ruling's tell is the versus-card reveal, which this reproduces for the preview).
import { PICKS, moodOf, type PickedStance } from './stance.ts';

// ?stances=1 (or =on) turns the preview on with Neutral picked; ?stances=<aggressive|defensive|trickster|neutral> turns it on with that pick. Anything else is off.
export const stanceFlag = (search: string): PickedStance | undefined => {
  const v = /[?&]stances=([a-z0-9]+)/.exec(search)?.[1];
  if (v === '1' || v === 'on') return 'neutral';
  return (PICKS as readonly string[]).includes(v ?? '') ? (v as PickedStance) : undefined;
};
export const stanceLabel = (p: PickedStance): string => p[0].toUpperCase() + p.slice(1);
// The reveal line: both stances at once ("Aggressive vs Defensive"), the foe's mood being the seed's draw (src/stance.ts moodOf).
export const stanceReveal = (mine: PickedStance, seed: number, opponent: string): string => `You: ${stanceLabel(mine)} · ${opponent}: ${stanceLabel(moodOf(seed, opponent))}`;

export type StancePanel = { show(mine: PickedStance, seed: number, opponent: string): void };
export function mountStancePanel(host: HTMLElement, pick: (p: PickedStance) => void): StancePanel {
  const box = document.createElement('div');
  box.id = 'stance-panel'; box.setAttribute('role', 'group'); box.setAttribute('aria-label', 'Stance preview');
  box.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:20;display:flex;flex-direction:column;gap:4px;padding:6px 8px;background:rgba(15,12,10,.82);color:#e8dcc4;font:12px/1.3 system-ui,sans-serif;border:1px solid rgba(232,220,196,.25);border-radius:6px;max-width:220px';
  const line = document.createElement('div'); line.id = 'stance-reveal'; line.style.opacity = '.85';
  const row = document.createElement('div'); row.style.cssText = 'display:flex;gap:4px;flex-wrap:wrap';
  const buttons = new Map<PickedStance, HTMLButtonElement>();
  for (const p of PICKS) {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = stanceLabel(p); b.dataset.stance = p;
    b.style.cssText = 'flex:1;min-width:64px;padding:4px 6px;font:inherit;color:inherit;background:rgba(232,220,196,.08);border:1px solid rgba(232,220,196,.3);border-radius:4px;cursor:pointer';
    b.addEventListener('click', () => pick(p)); buttons.set(p, b); row.append(b);
  }
  box.append(line, row); host.append(box);
  return {
    show(mine, seed, opponent) {
      line.textContent = stanceReveal(mine, seed, opponent);
      for (const [p, b] of buttons) { b.setAttribute('aria-pressed', String(p === mine)); b.style.background = p === mine ? 'rgba(232,220,196,.28)' : 'rgba(232,220,196,.08)'; }
    },
  };
}
