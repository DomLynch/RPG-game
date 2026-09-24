// The Arena Draw (Dom 2026-09-24; Strategy picked direction A of #642): an iron roster board on two chains, behind bars. The ladder has
// ALREADY picked the opponent (profile.encounter, ladder.ts): the board only runs its strip of roster silhouettes down to that pick,
// slams to a stop, lights the portrait and drops the name plate. Never a reroll, never a near-miss — the strip is built to end on the
// pick. At most 1.5 s (DRAW_RUN_MS + DRAW_HOLD_MS); a tap anywhere on it skips to the end state and ends it at once. Portrait
// thumbnails only (public/game/img/draw/<id>.webp, scripts/draw-thumbs.mjs), no models; the fight then opens on the versus still.
// The only motion is one transform on the strip and the plate, so the phone's compositor carries it (main.ts owns the timing seam).
// No module-level `document`: main.ts's VM harness imports this file, so the element and document come in as arguments.
export const DRAW_RUN_MS = 1100, DRAW_HOLD_MS = 400, DRAW_LAPS = 2;

// The strip, top to bottom: DRAW_LAPS whole laps of the rungs, then the rungs up to and including the pick, then one more so the slot
// under the stop is never empty. Returns the ids and the index the board stops on. Pure, so the test pins "always lands on the pick".
export function drawStrip(ids: readonly string[], target: string, laps = DRAW_LAPS): { strip: string[]; stop: number } {
  const at = ids.indexOf(target);
  if (at < 0) return { strip: [target], stop: 0 };
  const strip = [...Array.from({ length: laps }, () => ids).flat(), ...ids.slice(0, at + 1)];
  return { strip: [...strip, ids[(at + 1) % ids.length]!], stop: strip.length - 1 };
}

type Wait = (ms: number) => Promise<void>;
export function createArenaDraw(host: HTMLElement, doc: Document) {
  let skip: (() => void) | null = null;
  host.addEventListener('pointerdown', () => skip?.());
  const make = (tag: string, className: string, text = '') => { const node = doc.createElement(tag); node.className = className; node.textContent = text; return node; };
  // `reduced`: prefers-reduced-motion — the board shows its end state for the hold, no run.
  async function play(ids: readonly string[], target: string, plate: { name: string; weapon: string }, wait: Wait, reduced = false): Promise<void> {
    const { strip, stop } = drawStrip(ids, target);
    const track = make('div', 'draw-strip');
    track.replaceChildren(...strip.map((id, i) => {
      const slot = make('div', 'draw-slot'), img = doc.createElement('img') as HTMLImageElement;
      img.alt = ''; img.decoding = 'async'; img.src = `/game/img/draw/${id}.webp`;
      if (i === stop) slot.dataset.hit = '1';
      slot.append(img);
      return slot;
    }));
    const board = make('div', 'draw-board'), view = make('div', 'draw-window'), sign = make('div', 'draw-plate');
    view.append(track, make('div', 'draw-bars'));
    board.append(view, make('div', 'draw-stop'));
    sign.append(make('b', 'draw-name', plate.name), make('span', 'draw-weapon', plate.weapon));
    host.replaceChildren(make('i', 'draw-chain'), make('i', 'draw-chain draw-chain-r'), board, sign);
    host.dataset.slam = ''; host.hidden = false;
    let done = false;
    const slam = () => { if (done) return; host.dataset.run = ''; track.style.setProperty('--draw-to', String(stop)); host.dataset.slam = '1'; };
    const skipped = new Promise<void>((resolve) => { skip = () => { slam(); done = true; resolve(); }; });
    if (!reduced) {
      void host.offsetHeight;   // commit the strip at the top before the run starts, or the transition has no "from"
      host.dataset.run = '1'; track.style.setProperty('--draw-to', String(stop));
      await Promise.race([wait(DRAW_RUN_MS), skipped]);
    }
    slam();
    await Promise.race([wait(DRAW_HOLD_MS), skipped]);
    done = true; skip = null; host.hidden = true;
  }
  return { play, skip: () => skip?.() };   // skip: a tap, or main.ts when the rigs fail and the retry notice must be read
}
