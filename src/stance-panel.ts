// Stance row, option A3 (Dom 2026-10-08, picker page): plain small-caps text under the HUD bars, no boxes; a pick fades the row over 3 s and leaves a thin tag by the rank line that brings it back.
// The stance preview (Strategy, 2026-10-07: "?stances=1, a look-test on the existing Pit page"): a small panel where the player picks one of the four stances and sees both stances at the fight start,
// theirs and the opponent's mood. Presentation only: the pick is Match.stancePref, the sim reads it through begin() -> initialPractice, and ?stances=off never builds this panel, so every
// fight is as it was. The panel sits top-right under the menu button, clear of the touch controls (the joystick and action cluster own the bottom corners: a bottom-left panel took the joystick's presses, scripts/sparring-browser-check.mjs caught it); nothing else appears over the arena (the ruling's tell is the versus-card reveal, which this reproduces for the preview).
import { PICKS, moodOf, type PickedStance } from './stance.ts';

// Stances are ON for everyone (Dom 2026-10-08: new features ship ON, a flag is only a kill switch): no flag, `?stances=1`, `?stances=on` and anything unrecognised pick Balanced (the id `neutral`);
// `?stances=<aggressive|defensive|trickster|neutral>` starts on that pick; `?stances=off` is the kill switch and undefines it (no stances anywhere, every fight as it was before RV34).
export const stanceFlag = (search: string): PickedStance | undefined => {
  const v = /[?&]stances=([a-z0-9]+)/.exec(search)?.[1];
  if (v === 'off') return undefined;
  return (PICKS as readonly string[]).includes(v ?? '') ? (v as PickedStance) : 'neutral';
};
export const stanceLabel = (p: PickedStance): string => (p === 'neutral' ? 'Balanced' : p[0].toUpperCase() + p.slice(1));   // Dom 2026-10-07: the fourth stance is SHOWN as Balanced; its id stays `neutral` (the record's 2-bit code, ?stances=neutral, every pin)
// The reveal line: both stances at once ("Aggressive vs Defensive"), the foe's mood being the seed's draw (src/stance.ts moodOf).
export const stanceReveal = (mine: PickedStance, seed: number, opponent: string): string => `You: ${stanceLabel(mine)} · ${opponent}: ${stanceLabel(moodOf(seed, opponent))}`;

export type StancePanel = { show(mine: PickedStance, seed: number, opponent: string): void; ready(sheathed: boolean): void };
export const FADE_MS = 3000;
export function mountStancePanel(host: HTMLElement, pick: (p: PickedStance) => void, doc: Document = document): StancePanel {   // `doc`: the caller's document (the graphics harness runs main.ts with its own)
  const box = doc.createElement('div');
  box.id = 'stance-panel'; box.setAttribute('role', 'group'); box.setAttribute('aria-label', 'Stance');
  const buttons = new Map<PickedStance, HTMLButtonElement>();
  PICKS.forEach((p, i) => {
    if (i) { const dot = doc.createElement('i'); dot.textContent = '·'; dot.setAttribute('aria-hidden', 'true'); box.append(dot); }
    const b = doc.createElement('button'); b.type = 'button'; b.textContent = stanceLabel(p); b.dataset.stance = p;
    b.addEventListener('click', () => { picked = true; pick(p); }); buttons.set(p, b); box.append(b);
  });
  const tag = doc.createElement('button'); tag.id = 'stance-tag'; tag.type = 'button'; tag.hidden = true;
  host.append(box, tag);
  let picked = false, tagOn = false, timer: ReturnType<typeof setTimeout> | undefined, sheathed = true, open = true;
  // The row sits below the hint line, the tag after the rank name: read from the page, so a two-line hint or a rotated phone moves them.
  const place = () => {
    const hint = doc.getElementById('combat-status')?.getBoundingClientRect(), rank = doc.getElementById('rank')?.getBoundingClientRect();
    if (hint && hint.height) box.style.setProperty('--stance-top', `${Math.round(hint.bottom + 2)}px`);
    if (rank && rank.height) { tag.style.setProperty('--tag-left', `${Math.round(rank.right + 10)}px`); tag.style.setProperty('--tag-top', `${Math.round(rank.top - 3)}px`); }
  };
  const paint = () => { box.hidden = !sheathed || !open; };
  // Back at full strength at once (the 3 s transition is only for the fade out).
  const reopen = () => { clearTimeout(timer); box.style.transition = 'none'; box.dataset.fade = '0'; void box.offsetWidth; box.style.transition = ''; open = true; paint(); place(); };
  tag.addEventListener('click', reopen);
  if (typeof ResizeObserver !== 'undefined' && doc.defaultView) new ResizeObserver(place).observe(doc.body);
  doc.defaultView?.addEventListener('resize', place);
  return {
    show(mine, seed, opponent) {
      for (const [p, b] of buttons) b.setAttribute('aria-pressed', String(p === mine));
      tagOn ||= picked || mine !== 'neutral';
      tag.hidden = !tagOn; tag.textContent = stanceLabel(mine); tag.title = tag.ariaLabel = `Change stance. ${stanceReveal(mine, seed, opponent)}`;
      reopen();
      if (picked) {   // the pick starts the next fight on it: the row fades over 3 s and the tag stays
        picked = false;
        requestAnimationFrame(() => { box.dataset.fade = '1'; });
        timer = setTimeout(() => { open = false; paint(); }, FADE_MS + 100);
      }
    },
    ready(now) { if (now !== sheathed) { sheathed = now; paint(); } },   // the first strike takes the row away for the fight
  };
}
