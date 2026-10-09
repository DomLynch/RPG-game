// Zone 1's combat sound (K8 slice 2, Dom: the zone was near-silent in a fight): the engine's own feedback (src/fight/sound/feedback.ts, the Pit's cues) fed from Zone 1's combat events.
// Each world event carries the Pit CombatEvent it came from (`pit`), so a blow, block, parry or swing sounds exactly as in the Pit. Browsers play no audio before a gesture: the
// first one builds the feedback (its code loads then, not with the page); events before it are dropped, never queued, so no stale blow sounds late. `?sound=0` turns it off.
// No arena frame is passed, so no crowd, bell or breath: those are slices that follow.
import type { CombatEvent } from '../../src/duel.ts';

export type ZoneFeedback = { unlock(): void; update(events: CombatEvent[]): void; quiet(): void };
export const soundWanted = (search: string): boolean => new URLSearchParams(search).get('sound') !== '0';

export function createZoneSound(load: () => Promise<ZoneFeedback>, on = true) {
  let fb: ZoneFeedback | null = null, loading: Promise<void> | null = null, batch: CombatEvent[] = [];
  return {
    /** Call from a user gesture (pointerdown, touchend, keydown): builds the feedback once and resumes the audio context. */
    unlock(): void { if (!on) return; if (fb) fb.unlock(); else loading ??= load().then((f) => { fb = f; f.unlock(); }, () => { on = false; }); },
    /** The world loop's event hook: keep the Pit event this one carries. */
    event(ev: { pit?: CombatEvent }): void { if (on && fb && ev.pit) batch.push(ev.pit); },
    /** Once per frame, after the loop stepped: play what the frame's steps produced. */
    flush(): void { if (!batch.length) return; const events = batch; batch = []; fb?.update(events); },
    /** Leaving the page's fight (a panel, the Pit): silence. */
    quiet(): void { batch = []; fb?.quiet(); },
  };
}
