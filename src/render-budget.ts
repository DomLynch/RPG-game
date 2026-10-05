// Render budget: hold the frame time by trading canvas resolution, stepping down when the frames run long and back up only after a stable stretch.
// The resolution rung alone, ported in shape from levy-street/world-of-claudecraft @f46f30f (src/render/render_budget.ts, the frame-time EMA with
// degrade / recover cooldowns, and the low-tier numbers of GfxRuntimeBudget in src/render/gfx.ts). Not ported: its grass, foliage, vfx, lighting,
// terrain and post rungs, the submit-stall and external-frame-cap probes. Changed: a degrade needs the EMA over the drop line (a lone long frame
// never steps down), and a startup grace ignores the shader-compile frames. It never touches the simulation: a wind-up keeps every tick it has.
//
// MIT License. Copyright (c) 2026 Levy Street.
// Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"),
// to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense,
// and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions: The above
// copyright notice and this permission notice shall be included in all copies or substantial portions of the Software. THE SOFTWARE IS PROVIDED "AS
// IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR
// PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN
// AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

export type BudgetConfig = {
  minScale: number; maxScale: number;
  dropMs: number; urgentMs: number; recoverMs: number;   // EMA at/over dropMs steps down; one frame at/over urgentMs (with the EMA over dropMs) steps down further; EMA at/under recoverMs counts as stable
  dropStep: number; urgentStep: number; recoverStep: number;
  stableS: number; cooldownS: number; graceS: number;
};
// The source's low-tier budget (min scale 0.55 mobile) with this game's floor a touch higher: the fight is read at 375 wide, and below 0.6 the blade edge crawls.
export const BUDGET: BudgetConfig = { minScale: 0.6, maxScale: 1, dropMs: 22, urgentMs: 34, recoverMs: 17.5, dropStep: 0.08, urgentStep: 0.12, recoverStep: 0.06, stableS: 6, cooldownS: 1.1, graceS: 3 };
const EMA = 0.08, SLOW_RUN = 3;   // a degrade needs this many long frames in a row as well as the EMA: one stalled frame (a GC, a tab switch) moves the EMA a long way alone

export type RenderBudget = {
  /** One drawn frame: seconds since the last, the frame's cost in ms. Returns the new resolution scale when it moved, else undefined. */
  update(dtS: number, frameMs: number): number | undefined;
  readonly scale: number;
  readonly ema: number;
};

export function createRenderBudget(cfg: BudgetConfig = BUDGET): RenderBudget {
  let scale = cfg.maxScale, ema = 16.7, cooldown = 0, stable = 0, age = 0, slow = 0;
  const round = (v: number) => Math.round(v * 100) / 100;
  return {
    get scale() { return scale; },
    get ema() { return ema; },
    update(dtS, frameMs) {
      if (!(dtS > 0) || !Number.isFinite(frameMs)) return undefined;
      age += dtS;
      if (age < cfg.graceS) return undefined;   // startup: shader compiles and uploads are not the frame cost
      ema += (Math.min(250, Math.max(0, frameMs)) - ema) * EMA;
      cooldown = Math.max(0, cooldown - dtS);
      slow = frameMs >= cfg.dropMs ? slow + 1 : 0;
      if (ema >= cfg.dropMs && slow >= SLOW_RUN) {
        stable = 0;
        if (cooldown > 0 || scale <= cfg.minScale) return undefined;
        const step = frameMs >= cfg.urgentMs ? cfg.urgentStep : cfg.dropStep;
        scale = round(Math.max(cfg.minScale, scale - step)); cooldown = cfg.cooldownS;
        return scale;
      }
      if (ema <= cfg.recoverMs && scale < cfg.maxScale) {
        stable += dtS;
        if (stable >= cfg.stableS && cooldown <= 0) {
          scale = round(Math.min(cfg.maxScale, scale + cfg.recoverStep)); cooldown = cfg.cooldownS * 1.5; stable = 0;
          return scale;
        }
      } else if (ema > cfg.recoverMs) stable = 0;
      return undefined;
    },
  };
}

// `?budget=on|off` forces it; unset, it runs on the phone tier only and never under an explicit ?dpr= (that load is an A/B instrument).
export function budgetOn(search: string, phone: boolean, dprOverride: number | undefined): boolean {
  const v = new URLSearchParams(search).get('budget');
  return v === 'on' ? true : v === 'off' ? false : phone && dprOverride === undefined;
}
