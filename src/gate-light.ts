// The gate's light (docs/pit-design.md §9; Dom's phone test 2026-09-30: "about 2 s of full black" leaving the Pit). After a win the gate's
// Next loads the next fighter on a fresh page (main.ts reset → location.reload), and a fresh page is black until its script boots. So the
// page he leaves fades to the gate's light and leaves a flag; public/gate-light.js puts the same light up in the new document before its
// first paint; the arena's first frame fades it out. `:root.gate-light` is the light up, `:root.gate-light-out` its fade (style.css).
export const GATE_LIGHT_KEY = 'frankendom.gate-light';
export const GATE_LIGHT_IN_MS = 350;   // the fade to the light before the reload
export const GATE_LIGHT_MAX_MS = 8000;   // a light still up after this is taken down (a reload that never came, a boot that failed)
const OUT_MS = 1200;   // style.css: #pit-fade fades over 1 s

type Root = { classList: { toggle(name: string, on: boolean): unknown; contains(name: string): boolean } };

// Light up and leave the flag for the next document. False when storage refuses (private mode, a blocked store): no light, and the
// caller goes on as it always has, because a light the next document cannot know about would end in its black all the same.
export function armGateLight(root: Root, storage: () => Pick<Storage, 'setItem'>): boolean {
  try { storage().setItem(GATE_LIGHT_KEY, '1'); } catch { return false; }
  root.classList.toggle('gate-light-out', false);
  root.classList.toggle('gate-light', true);
  return true;
}
// Take the light down with its fade, and drop a flag no reload consumed. Safe to call at any time, lit or not.
export function clearGateLight(root: Root, storage: () => Pick<Storage, 'removeItem'>, later: (run: () => void, ms: number) => unknown = setTimeout): void {
  try { storage().removeItem(GATE_LIGHT_KEY); } catch { /* nothing was stored */ }
  if (!root.classList.contains('gate-light')) return;
  root.classList.toggle('gate-light', false);
  root.classList.toggle('gate-light-out', true);
  later(() => root.classList.toggle('gate-light-out', false), OUT_MS);
}
// What the next rung's page will fetch first: his rig, and his rank look where one ships. The phone tier takes the rig alone: its look
// streams after first playable as it always does, and is not pulled early onto a metered connection.
export function nextRungFiles(rig: string | undefined, look: string | undefined, phone: boolean): string[] {
  return [rig, phone ? undefined : look].filter((url): url is string => !!url);
}
// Warm the HTTP cache with those files at low priority (Safari has no <link rel=prefetch>). Bytes only: nothing is parsed, decoded or sent
// to the GPU here. A failure is nothing: the next page fetches the file itself.
export function prefetchFiles(urls: readonly string[], get: (url: string, init: RequestInit) => Promise<{ arrayBuffer(): Promise<unknown> }> = fetch): Promise<void> {
  return Promise.all(urls.map((url) => get(url, { priority: 'low' } as RequestInit).then((r) => r.arrayBuffer()).catch(() => undefined))).then(() => undefined);
}
