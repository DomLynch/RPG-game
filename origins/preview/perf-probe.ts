// ?perf (Origins preview, World lane): a frame-gap and long-task recorder so Dom's iPhone reports the REAL worst gap around an engage in one tap (Strategy 2026-10-08: the Mac WebKit does not reproduce his freeze).
// Inert without the flag: perfMark() is a no-op and nothing is installed. With it: every animation frame's gap is recorded, the page marks its own steps (tap, attach, ready, detach), Chromium's
// long tasks are added where the browser has them (Safari does not: the line says so), and a small overlay shows one copyable line (tap it to copy). The recorder is pure so it is testable without a browser.
export type Mark = { name: string; t: number };
export type Summary = { frames: number; worstGapMs: number; worstAtMs: number | null; gapsOver100: number[]; marks: { name: string; atMs: number }[]; longTasks: { atMs: number; ms: number }[] };

export class Recorder {
  private last: number | null = null; private tap: number | null = null;
  readonly gaps: { t: number; gap: number }[] = []; readonly marks: Mark[] = []; readonly longTasks: { t: number; ms: number }[] = [];
  readonly windowMs: number;
  constructor(windowMs = 5000) { this.windowMs = windowMs; }
  frame(t: number) { if (this.last !== null) this.gaps.push({ t, gap: t - this.last }); this.last = t; }
  mark(name: string, t: number) { this.marks.push({ name, t }); if (name === 'tap') this.tap = t; }
  longTask(t: number, ms: number) { this.longTasks.push({ t, ms }); }
  // The window opens at the last tap (or the start of the record when none): the worst gap, when it ended (ms after the tap), every gap over 100 ms, the marks and the long tasks inside it.
  summary(): Summary {
    const from = this.tap ?? this.gaps[0]?.t ?? 0, to = from + this.windowMs, inWin = this.gaps.filter((g) => g.t >= from && g.t <= to);
    const worst = inWin.reduce<{ t: number; gap: number } | null>((w, g) => (!w || g.gap > w.gap ? g : w), null);
    return {
      frames: inWin.length, worstGapMs: Math.round(worst?.gap ?? 0), worstAtMs: worst ? Math.round(worst.t - from) : null, gapsOver100: inWin.filter((g) => g.gap > 100).map((g) => Math.round(g.gap)),
      marks: this.marks.filter((m) => m.t >= from && m.t <= to).map((m) => ({ name: m.name, atMs: Math.round(m.t - from) })),
      longTasks: this.longTasks.filter((l) => l.t >= from && l.t <= to).map((l) => ({ atMs: Math.round(l.t - from), ms: Math.round(l.ms) })),
    };
  }
}

// One line to paste back: worst gap and when it landed, every gap over 100 ms, the marks, the long tasks ('n/a' when the browser has none).
export function summaryLine(s: Summary, longTasksSupported: boolean): string {
  const marks = s.marks.map((m) => `${m.name}@${m.atMs}`).join(' ') || 'no marks (tap a creature)';
  const lt = longTasksSupported ? (s.longTasks.map((l) => `${l.ms}ms@${l.atMs}`).join(' ') || 'none') : 'n/a (this browser has no longtask)';
  return `perf worst ${s.worstGapMs}ms @${s.worstAtMs ?? '-'} | >100: [${s.gapsOver100.join(',')}] | frames ${s.frames} | marks ${marks} | longtasks ${lt}`;
}

let recorder: Recorder | null = null;
export const perfMark = (name: string) => { recorder?.mark(name, performance.now()); };   // no-op without ?perf

export function installPerf(search: string, ready: () => boolean): void {
  if (!/[?&]perf\b/.test(search) || recorder) return;
  const rec = (recorder = new Recorder()); let supported = false, wasReady = false;
  try { if (!PerformanceObserver.supportedEntryTypes?.includes('longtask')) throw new Error('no longtask'); new PerformanceObserver((list) => { for (const e of list.getEntries()) rec.longTask(e.startTime, e.duration); }).observe({ entryTypes: ['longtask'] }); supported = true; } catch { /* Safari: no longtask */ }
  const box = document.createElement('div');
  box.style.cssText = 'position:fixed;left:4px;right:4px;bottom:4px;z-index:99999;font:11px/1.3 ui-monospace,monospace;color:#9f9;background:rgba(0,0,0,.72);padding:4px 6px;border-radius:4px;word-break:break-all;pointer-events:auto';
  box.title = 'tap to copy'; document.body.appendChild(box);
  box.addEventListener('click', () => { try { void navigator.clipboard.writeText(box.textContent ?? ''); box.style.color = '#fff'; } catch { /* the line is selectable anyway */ } });
  let shown = 0;
  const tick = (t: number) => {
    rec.frame(t);
    const r = ready(); if (r && !wasReady) rec.mark('ready', t); wasReady = r;
    if (t - shown > 250) { shown = t; box.textContent = summaryLine(rec.summary(), supported); }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
