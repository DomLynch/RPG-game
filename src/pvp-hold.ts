// The live duel's drawn hit-stop (Dom via Strategy, always on): the SIM never pauses (every tick still steps and the net cadence is untouched);
// only the picture held on screen is delayed. Ticks that arrive during a hold queue as snapshots and play out CATCHUP a frame. Presentation only:
// nothing here is read by the sim, the driver or a record. Pure, so tests/pvp-hold.test.ts can drive it frame by frame.
export const CATCHUP = 3;
export const MAX_LAG_TICKS = 6;   // the picture is never more than 6 ticks (100 ms) behind the sim: in a duel the picture is the player's input information (Lead, Backend's CI row saw 15)
const TICK_MS = 1000 / 60;
export type Hold<S> = { shown: S | null; holdMs: number; cut: number; queue: S[] };   // shown: the snapshot on screen while behind the sim; cut: events of the contact frame to deliver
export const newHold = <S>(): Hold<S> => ({ shown: null, holdMs: 0, cut: -1, queue: [] });
// A hold of `ms`, shortened so the queue it builds stays within MAX_LAG_TICKS beside what is already queued; under half a tick of room means no hold at all.
const holdFor = <S,>(h: Hold<S>, ms: number): number => { const room = (MAX_LAG_TICKS - h.queue.length) * TICK_MS; return room < TICK_MS / 2 ? 0 : Math.min(ms, room); };
// What the HUD and the end banner read: the snapshot on screen while behind the sim, else the live one, so a finish is announced when its last blow is DRAWN.
export const visible = <S,>(h: Hold<S>, live: S): S => h.shown ?? live;
export function clearHold<S>(h: Hold<S>): void { h.shown = null; h.holdMs = 0; h.cut = -1; h.queue.length = 0; }
// After each sim tick: `stopMs` is that tick's stop (0 = no contact), `frameEvents` how many of this frame's events exist up to and including the tick.
export function onTick<S>(h: Hold<S>, snap: S, stopMs: number, frameEvents: number): void {
  if (h.shown) h.queue.push(snap);
  else if (stopMs) { h.shown = snap; h.holdMs = holdFor(h, stopMs) || stopMs; h.cut = frameEvents; }   // the first contact: the queue is empty, so the cap shortens a long hold only
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
      const hold = ms ? holdFor(h, ms) : 0;
      if (hold) { h.holdMs = hold; held = true; break; }   // another contact while catching up holds again, as far as the lag cap allows
    }
  }
  const shown = h.shown;
  if (!held && !h.queue.length) h.shown = null;   // the tick just drawn was the live one: the next frame is live
  return { shown, events, held };
}
