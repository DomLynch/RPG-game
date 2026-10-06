// The live duel's drawn hit-stop (Dom via Strategy, always on): the SIM never pauses (every tick still steps and the net cadence is untouched);
// only the picture held on screen is delayed. Ticks that arrive during a hold queue as snapshots and play out CATCHUP a frame. Presentation only:
// nothing here is read by the sim, the driver or a record. Pure, so tests/pvp-hold.test.ts can drive it frame by frame.
export const CATCHUP = 3;
export type Hold<S> = { shown: S | null; holdMs: number; cut: number; queue: S[] };   // shown: the snapshot on screen while behind the sim; cut: events of the contact frame to deliver
export const newHold = <S>(): Hold<S> => ({ shown: null, holdMs: 0, cut: -1, queue: [] });
export function clearHold<S>(h: Hold<S>): void { h.shown = null; h.holdMs = 0; h.cut = -1; h.queue.length = 0; }
// After each sim tick: `stopMs` is that tick's stop (0 = no contact), `frameEvents` how many of this frame's events exist up to and including the tick.
export function onTick<S>(h: Hold<S>, snap: S, stopMs: number, frameEvents: number): void {
  if (h.shown) h.queue.push(snap);
  else if (stopMs) { h.shown = snap; h.holdMs = stopMs; h.cut = frameEvents; }
}
// Once per drawn frame, before it renders: what to draw (null = the live tick), the events to hand the renderer, and whether the frame is a hold.
// `stale`: a queued snapshot a rollback has since overtaken (its predicted pose may never have happened). Those are never drawn: their confirmed events are still
// handed over, and the picture goes live once the hold ends, from the corrected state.
export function onFrame<S, E>(h: Hold<S>, elapsedMs: number, frameEvents: E[], stopOf: (s: S) => number, eventsOf: (s: S) => E[], stale: (s: S) => boolean = () => false): { shown: S | null; events: E[]; held: boolean } {
  if (!h.shown) return { shown: null, events: frameEvents, held: false };
  const dropped = h.queue.some(stale) ? h.queue.splice(0).flatMap(eventsOf) : [];
  const contact = h.cut >= 0;   // the first drawn frame of a hold: delivers what happened up to the contact tick, once, and spends none of the hold
  let events: E[] = (contact ? frameEvents.slice(0, h.cut) : []).concat(dropped);
  h.cut = -1;
  if (h.holdMs > 0 && !contact) h.holdMs = Math.max(0, h.holdMs - elapsedMs);
  let held = h.holdMs > 0 || contact;
  if (!held) {
    for (let k = 0; k < CATCHUP && h.queue.length; k++) {
      h.shown = h.queue.shift()!;
      events = events.concat(eventsOf(h.shown));
      const ms = stopOf(h.shown);
      if (ms) { h.holdMs = ms; held = true; break; }   // another contact while catching up holds again
    }
  }
  const shown = h.shown;
  if (!held && !h.queue.length) h.shown = null;   // the tick just drawn was the live one: the next frame is live
  return { shown, events, held };
}
