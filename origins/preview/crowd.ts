// ?chars=N: the phone crowd test (Lead 2026-10-09, Dom). N player-characters on the hero rig walk loops around the walker in Zone 1 while a readout counts the
// frame gaps, so Dom's iPhone gives the receipt: average fps and worst frame gap at N, and the cap that sets. Off unless the flag is present; no network, no
// presence. Pure parts (flag, paths, frame stats) are node-tested; the rig clones are main.ts's.
export const CROWD_MAX = 100;
/** `?chars=40` -> 40; absent, zero, junk -> 0 (off); clamped to CROWD_MAX. */
export function crowdWanted(search: string): number {
  const v = new URLSearchParams(search).get('chars'); if (v === null) return 0;
  const n = Math.floor(Number(v)); return Number.isFinite(n) && n > 0 ? Math.min(n, CROWD_MAX) : 0;
}
export type Walker = { cx: number; cz: number; r: number; w: number; phase: number };
/** Walkers on loops of 3..9 m round points scattered 6..22 m from the centre; both turn ways, speeds 0.8..2.4 m/s (Walk to Jog on the rig). Deterministic. */
export function walkers(n: number, seed = 40): Walker[] {
  let s = seed >>> 0 || 1; const rnd = () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296;
  return Array.from({ length: n }, () => {
    const a = rnd() * Math.PI * 2, d = 6 + rnd() * 16, r = 3 + rnd() * 6, speed = 0.8 + rnd() * 1.6;
    return { cx: Math.cos(a) * d, cz: Math.sin(a) * d, r, w: (rnd() < 0.5 ? -1 : 1) * speed / r, phase: rnd() * Math.PI * 2 };
  });
}
export const walkerAt = (w: Walker, t: number, c: { x: number; z: number }) => {
  const a = w.phase + w.w * t;
  return { x: c.x + w.cx + Math.cos(a) * w.r, z: c.z + w.cz + Math.sin(a) * w.r, heading: Math.atan2(-Math.sin(a) * w.w, Math.cos(a) * w.w), speed: Math.abs(w.w) * w.r };
};
/** Frame gaps in ms. `warm` first frames are skipped (shader compile, texture upload); gaps over 1 s are a backgrounded tab, not a frame. */
export class FrameStats {
  private gaps: number[] = []; private skipped = 0; worst = 0;
  constructor(private warm = 60) {}
  add(ms: number) { if (this.skipped < this.warm) { this.skipped++; return; } if (!(ms > 0) || ms > 1000) return; this.gaps.push(ms); if (ms > this.worst) this.worst = ms; }
  get frames() { return this.gaps.length; }
  get fps() { const t = this.gaps.reduce((a, b) => a + b, 0); return t ? (this.gaps.length * 1000) / t : 0; }
  p95() { if (!this.gaps.length) return 0; const s = [...this.gaps].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(s.length * 0.95))]; }
}
export const readout = (n: number, st: FrameStats) => st.frames ? `${n} chars · ${st.fps.toFixed(1)} fps avg · worst gap ${st.worst.toFixed(0)} ms · p95 ${st.p95().toFixed(0)} ms · ${st.frames} frames` : `${n} chars · warming up`;
