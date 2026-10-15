// Zone 1's combat sound (K8 slice 2, Dom: the zone was near-silent in a fight): the engine's own feedback (src/fight/sound/feedback.ts, the Pit's cues) fed from Zone 1's combat events.
// Each world event carries the Pit CombatEvent it came from (`pit`), so a blow, block, parry or swing sounds exactly as in the Pit. Browsers play no audio before a gesture: the
// first one unlocks the feedback (its code is preloaded at idle, so that unlock is inside the gesture; a gesture that beats the preload loads it and unlocks on arrival); events before it are dropped, never queued, so no stale blow sounds late. `?sound=0` turns it off.
// No arena frame is passed, so no crowd, bell or breath: those are slices that follow.
import type { CombatEvent } from '../../src/fight/index.ts';

export type ZoneFeedback = { unlock(): void; update(events: CombatEvent[]): void; quiet(): void };
export const soundWanted = (search: string): boolean => new URLSearchParams(search).get('sound') !== '0';

export function createZoneSound(load: () => Promise<ZoneFeedback>, on = true) {
  let fb: ZoneFeedback | null = null, loading: Promise<void> | null = null, batch: CombatEvent[] = [], gesture = false;
  const start = (): void => { loading ??= load().then((f) => { fb = f; if (gesture) f.unlock(); }, () => { on = false; }); };   // a gesture that beat the load unlocks as soon as it lands
  return {
    /** Load the feedback chunk now (call at idle, no gesture needed) so the FIRST gesture's unlock() is synchronous: iOS Safari starts and resumes an AudioContext only inside the gesture. */
    preload(): void { if (on) start(); },
    /** Call from a user gesture (pointerdown, touchend, keydown): unlocks the feedback inside the gesture when it is loaded, else loads it and unlocks on arrival. */
    unlock(): void { if (!on) return; if (fb) fb.unlock(); else { gesture = true; start(); } },
    /** The world loop's event hook: keep the Pit event this one carries. */
    event(ev: { pit?: CombatEvent }): void { if (on && fb && ev.pit) batch.push(ev.pit); },
    /** Once per frame, after the loop stepped: play what the frame's steps produced. */
    flush(): void { if (!batch.length) return; const events = batch; batch = []; fb?.update(events); },
    /** Leaving the page's fight (a panel, the Pit): silence. */
    quiet(): void { batch = []; fb?.quiet(); },
  };
}
