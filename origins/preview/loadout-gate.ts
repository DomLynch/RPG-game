// The Zone 1 loadout gate (sheet-in-world, #2900): no creature joins until a signed-in character's build (build_get) and worn-gear view have answered, so a fight never starts on the bare body because the sheet was late.
// A guest has no server view to wait for. An unanswered writer is waited on for `wait` ms only (no build_get still in flight), then the gate latches open and he fights bare; rebody() gives the build at the next clean
// window open. The worn-gear view is asked at load and re-asked every `retry` ms UNTIL IT ANSWERS, latch or no latch: a short writer blip must not leave a latched player ungeared for the session. Pure: the page hands in
// the clock and the four questions. The wait and the retry are preview-rules rows (loadoutWait, gearRetry).
export type LoadoutDeps = {
  now(): number;
  signedIn(): boolean;       // a stored session token (reads storage: the gate asks it once per `retry` ms, and once a frame until it latches)
  buildHeld(): boolean;      // build_get has answered
  buildInflight(): boolean;  // a build_get is on its way (each call times out on its own, so this ends)
  gearReady(): boolean;      // the server's worn-gear view has answered
  askGear(): boolean;        // read the server's worn-gear view now; false = it could not be asked yet (the gear screen is not mounted), so it is asked again at the next look, not after `retry`
  wait: number; retry: number;
};
export function createLoadoutGate(d: LoadoutDeps): () => boolean {
  const since = d.now();
  let latched = false, gearDone = false, asked = -Infinity;
  return () => {
    const t = d.now();
    if (!gearDone && t - asked > d.retry) {
      if (!d.signedIn() || d.gearReady()) gearDone = true;
      else if (d.askGear()) asked = t;   // gearDone is only ever set by an answer (or a guest): a gear view that cannot be asked yet is not an answer
    }
    if (latched) return true;
    if (!d.signedIn()) return (latched = true);
    return (latched = (d.buildHeld() && d.gearReady()) || (!d.buildInflight() && t - since > d.wait));
  };
}
