// The cost of a whole frame, for every lane that reads a phone receipt. three's renderer.info.render is reset at the start of every renderer.render() call, so after a composer frame (scene pass, then the post
// passes' full-screen quads) renderInfo() read the LAST pass: 1 triangle, 1 call, whatever the scene cost. This wraps renderer.render, turns the auto-reset off and takes each call's delta, so a frame's totals are
// the sum over its passes and the scene pass (the call that draws the game's scene: its shadow maps included) is told apart from the post passes. Pure: no three import (any renderer-shaped object works).
export type FrameCost = { readonly triangles: number; readonly calls: number; readonly passes: number; readonly scene: { readonly triangles: number; readonly calls: number } };
type Renderer = { info: { autoReset: boolean; render: { triangles: number; calls: number } }; render: (scene: unknown, camera: unknown) => void };

export function trackFrameCost(renderer: Renderer, scene: unknown): { begin(): void; end(): void; read(): FrameCost } {
  renderer.info.autoReset = false;   // a render() no longer zeroes the counters: they only grow, and each call's cost is the difference
  const render = renderer.render.bind(renderer);
  let open = false, cur = { triangles: 0, calls: 0, passes: 0, sTriangles: 0, sCalls: 0 }, last: FrameCost = { triangles: 0, calls: 0, passes: 0, scene: { triangles: 0, calls: 0 } };
  renderer.render = (s, c) => {
    const t0 = renderer.info.render.triangles, c0 = renderer.info.render.calls;
    render(s, c);
    if (!open) return;
    const t = renderer.info.render.triangles - t0, n = renderer.info.render.calls - c0;
    cur.triangles += t; cur.calls += n; cur.passes++;
    if (s === scene) { cur.sTriangles += t; cur.sCalls += n; }
  };
  return {
    begin() { open = true; cur = { triangles: 0, calls: 0, passes: 0, sTriangles: 0, sCalls: 0 }; },
    end() { open = false; last = { triangles: cur.triangles, calls: cur.calls, passes: cur.passes, scene: { triangles: cur.sTriangles, calls: cur.sCalls } }; },
    read: () => last,
  };
}
