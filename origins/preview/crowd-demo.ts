// ?crowd=N[&mode=idle]: Zone 1 with N fake remote heroes (N walkers, or standing with mode=idle) and the frame rate on screen, for a real phone (launch gate S2: 40 animated, geared characters hold 30 fps).
// Dev tooling, no gameplay and no server: after [zone ready] it feeds window.originsPreview.setOthers a packet per tick (the way presence does, ids kept alive) in a cone ahead of the hero, and shows
// the median fps, p95 frame time and drawn count of the latest few seconds. Same driver idea as scripts/origins-crowd-fps.mjs (the T4/throttle harness). Loaded only when `crowd` is in the URL.
import DEFS from './crowd-demo-defs.json' with { type: 'json' };

type Op = { pos: { x: number; z: number }; canStand: (x: number, z: number) => boolean; place: (x: number, z: number, h: number) => void; setOthers: (l: unknown[]) => void; remote: () => { shown: unknown[] } | null };
const rule = (id: string): number => DEFS.rules.find((r) => r.id === id)!.value;

export function startCrowdDemo(op: Op, n: number, walk: boolean): void {
  const count = Math.max(0, Math.min(rule('maxCount'), Math.floor(n)));
  const hud = document.createElement('div');
  hud.style.cssText = 'position:fixed;left:6px;bottom:6px;z-index:99999;padding:4px 7px;border-radius:6px;background:#000c;color:#9f9;font:12px/1.3 ui-monospace,monospace;pointer-events:none;white-space:pre';
  document.body.appendChild(hud);
  const { x, z } = op.pos;   // face +z (heading 0: forward is (sin h, cos h)); the cone lies ahead of him
  op.place(x, z, 0);
  const slots: { id: number; cx: number; cz: number; r: number; ph: number }[] = [];
  for (let i = 0, tries = 0; slots.length < count && tries < count * 40; tries++) {
    const d = rule('nearM') + ((i * 7 + tries * 3) % Math.round(rule('spreadM'))), side = (((i * 5 + tries) % 9) - 4) * (0.5 + d * 0.12), cx = x - side, cz = z + d;
    if (op.canStand(cx, cz)) { slots.push({ id: 1000 + slots.length, cx, cz, r: rule('ringMin') + (i % 3), ph: (i * 0.7) % 6.28 }); i++; }
  }
  const t0 = performance.now();
  const send = (): void => op.setOthers(slots.map((s) => {
    if (!walk) return { id: s.id, x: s.cx, z: s.cz, heading: 0, anim: 0, flags: 0 };
    const a = s.ph + (((performance.now() - t0) / 1000) * rule('walkSpeed')) / s.r;
    return { id: s.id, x: s.cx + Math.cos(a) * s.r, z: s.cz + Math.sin(a) * s.r, heading: -a, anim: 1, flags: 0 };
  }));
  setInterval(send, rule('tick')); send();
  const gaps: [number, number][] = [];
  let last = performance.now(), shownAt = 0;
  const frame = (t: number): void => {
    gaps.push([t, t - last]); last = t;
    while (gaps.length && gaps[0]![0] < t - rule('windowMs')) gaps.shift();
    if (t - shownAt > 500 && gaps.length > 4) {
      shownAt = t;
      const g = gaps.map((e) => e[1]).sort((a, b) => a - b), med = g[Math.floor(g.length / 2)]!, p95 = g[Math.min(g.length - 1, Math.floor(g.length * 0.95))]!;
      hud.textContent = `crowd ${slots.length}${walk ? ' walking' : ' idle'}  drawn ${op.remote()?.shown.length ?? 0}\nmedian ${(1000 / med).toFixed(1)} fps (${med.toFixed(1)} ms)  p95 ${p95.toFixed(1)} ms`;
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

/** Starts when the zone is ready (the same gate the harness waits on). */
export function crowdFromUrl(op: Op): void {
  const q = new URLSearchParams(location.search), n = Number(q.get('crowd'));
  if (!Number.isFinite(n) || n < 0) return;
  const go = (): void => { if ((window as unknown as { __zoneReady?: unknown }).__zoneReady) startCrowdDemo(op, n, q.get('mode') !== 'idle'); else setTimeout(go, 500); };
  go();
}
