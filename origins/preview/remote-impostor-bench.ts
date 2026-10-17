// ?impostors=N: Zone 1 with N impostor figures (remote-impostor.ts) in a cone ahead of the hero and the frame time on screen, to measure the far tier on its own against the full figures
// (?crowd=N). Dev tooling, no gameplay, no server: after [zone ready] it bakes the atlas from a clone of the hero's rig, then moves N billboards about a ring each frame (so the per-frame update
// cost is in the number, as for walking figures) and shows the mean frame ms and p95 of the latest few seconds; window.__impostorBench carries the same for the browser harness. Loaded only
// when `impostors` is in the URL.
import * as THREE from 'three';
import { createImpostors, bakeAtlas } from './remote-impostor.ts';
import { impostorRule } from './remote-impostor-rules.ts';

type Deps = { scene: THREE.Object3D; renderer: THREE.WebGLRenderer; makeFigure: () => THREE.Object3D | null; hero: () => { x: number; z: number; heading: number }; groundAt: (x: number, z: number) => number; canStand: (x: number, z: number) => boolean };
const WALK_SPEED = impostorRule('benchWalkSpeed'), RING_MIN = impostorRule('benchRingMin'), NEAR_M = impostorRule('benchNear'), SPREAD_M = impostorRule('benchSpread'), WINDOW_MS = impostorRule('benchWindow'), MAX = impostorRule('benchMax');

export function startImpostorBench(d: Deps, n: number): void {
  const count = Math.max(0, Math.min(MAX, Math.floor(n))), hud = document.createElement('div');
  hud.style.cssText = 'position:fixed;left:6px;bottom:6px;z-index:99999;padding:4px 7px;border-radius:6px;background:#000c;color:#9f9;font:12px/1.3 ui-monospace,monospace;pointer-events:none;white-space:pre';
  document.body.appendChild(hud);
  const fig = d.makeFigure(); if (!fig) { hud.textContent = 'impostors: no hero rig yet'; return; }
  const { texture } = bakeAtlas(d.renderer, fig), imp = createImpostors({ scene: d.scene, atlas: texture, capacity: MAX }), h = d.hero(), fx = Math.sin(h.heading), fz = Math.cos(h.heading);
  const slots: { cx: number; cz: number; r: number; ph: number }[] = [];
  for (let i = 0, tries = 0; slots.length < count && tries < count * 40; tries++) {
    const dist = NEAR_M + ((i * 7 + tries * 3) % Math.round(SPREAD_M)), side = (((i * 5 + tries) % 9) - 4) * (0.5 + dist * 0.12), cx = h.x + fx * dist - fz * side, cz = h.z + fz * dist + fx * side;
    if (d.canStand(cx, cz)) { slots.push({ cx, cz, r: RING_MIN + (i % 3), ph: (i * 0.7) % 6.28 }); i++; }
  }
  const t0 = performance.now(), gaps: [number, number][] = [], bench = { n: slots.length, meanMs: 0, p95Ms: 0, drawn: 0 };
  (window as unknown as { __impostorBench: typeof bench }).__impostorBench = bench;
  let last = performance.now(), shownAt = 0;
  const frame = (t: number): void => {
    const s = (t - t0) / 1000, list = slots.map((q) => { const a = q.ph + (s * WALK_SPEED) / q.r, x = q.cx + Math.cos(a) * q.r, z = q.cz + Math.sin(a) * q.r; return { x, y: d.groundAt(x, z), z, heading: -a }; });
    imp.update(list); bench.drawn = imp.drawn();
    gaps.push([t, t - last]); last = t; while (gaps.length && gaps[0]![0] < t - WINDOW_MS) gaps.shift();
    if (t - shownAt > 500 && gaps.length > 4) {
      shownAt = t; const g = gaps.map((e) => e[1]).sort((a, b) => a - b);
      bench.meanMs = +(g.reduce((a, b) => a + b, 0) / g.length).toFixed(2); bench.p95Ms = +g[Math.min(g.length - 1, Math.floor(g.length * 0.95))]!.toFixed(1);
      hud.textContent = `impostors ${bench.n} drawn ${bench.drawn}\nmean ${bench.meanMs} ms  p95 ${bench.p95Ms} ms`;
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

/** Starts when the zone is ready (the gate the harness waits on). */
export function impostorsFromUrl(d: Deps): void {
  const n = Number(new URLSearchParams(location.search).get('impostors'));
  if (!Number.isFinite(n) || n < 0) return;
  const go = (): void => { if ((window as unknown as { __zoneReady?: unknown }).__zoneReady) startImpostorBench(d, n); else setTimeout(go, 500); };
  go();
}
