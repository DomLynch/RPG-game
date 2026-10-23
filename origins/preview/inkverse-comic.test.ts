// inkverse-comic.json: the row loads through the registry, the loader refuses a bad row, the ink is seeded (same row, same picture), the vignette's blots stay in the edge band, the border is a closed loop inside the screen, and the whole layer is behind the flag.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ROWS from './inkverse-comic.json' with { type: 'json' };
import { inkComic, loadInkComics, mountComic, panelInner, stream, vignetteBlobs } from './inkverse-comic.ts';

const W = 300, H = 650;
const row = () => inkComic('light')!;

test('the shipped row loads', () => {
  const r = row();
  assert.ok(r.vignette.on && r.halftone.on && r.panel.on, 'the three layers are on');
  assert.equal(r.hitSplash.on, 0, 'the hit flash is wired and not drawn');
  assert.ok(r.layerZ < 1, 'the layer sits under the HUD (z-index 1)');
});

test('an unknown or absent id is no layer, and mounting it does nothing', () => {
  assert.equal(inkComic(null), null);
  assert.equal(inkComic('no-such-look'), null);
  assert.equal(mountComic(null), null);
  assert.equal(mountComic('no-such-look'), null);
});

test('the loader refuses a row with a missing number, a short colour, no blend or an inverted blot range', () => {
  const make = (patch: (f: Record<string, Record<string, unknown>>) => void) => { const f = structuredClone(ROWS.inkComics[0]!.fields) as unknown as Record<string, Record<string, unknown>>; patch(f); return { inkComics: [{ id: 'x', fields: f }] }; };
  assert.throws(() => loadInkComics(make((f) => { delete f.vignette!.blobs; })), /vignette\.blobs/);
  assert.throws(() => loadInkComics(make((f) => { f.panel!.ink = [1, 1]; })), /panel\.ink/);
  assert.throws(() => loadInkComics(make((f) => { f.halftone!.blend = ''; })), /halftone\.blend/);
  assert.throws(() => loadInkComics(make((f) => { f.vignette!.blobMinPct = 99; })), /blobMinPct/);
});

test('the same seed draws the same ink, another seed another', () => {
  const a = stream(7), b = stream(7), c = stream(8);
  assert.deepEqual([a(), a(), a()], [b(), b(), b()]);
  assert.notDeepEqual([stream(7)(), stream(7)()], [c(), c()]);
  assert.deepEqual(vignetteBlobs(row().vignette, W, H), vignetteBlobs(row().vignette, W, H));
});

test('every blot is centred inside the edge band, and there are as many as the row says', () => {
  const v = row().vignette, band = (v.bandPct / 100) * Math.min(W, H) + 0.001, blobs = vignetteBlobs(v, W, H);
  assert.equal(blobs.length, v.blobs);
  for (const b of blobs) {
    const edgeDist = Math.min(b.cx, W - b.cx, b.cy, H - b.cy);
    assert.ok(edgeDist <= band, `blot at ${b.cx.toFixed(0)},${b.cy.toFixed(0)} is ${edgeDist.toFixed(0)}px from an edge, band ${band.toFixed(0)}`);
    assert.equal(b.pts.length, v.spikes);
  }
});

test('the panel border is a closed ragged loop inside the screen, at least its thickness in', () => {
  const p = row().panel, pts = panelInner(p, W, H);
  assert.equal(pts.length, p.steps);
  for (const [x, y] of pts) {
    assert.ok(x >= 0 && x <= W && y >= 0 && y <= H, 'inside the screen');
    assert.ok(Math.min(x, W - x, y, H - y) >= p.thicknessPx - 0.001, 'at least the thickness in');
    assert.ok(Math.min(x, W - x, y, H - y) <= p.thicknessPx + p.raggedPx + 0.001, 'no deeper than thickness + ragged');
  }
});

test('flag off = nothing: the layer is only imported behind ?ink, it is never in the base graph', () => {
  const main = fs.readFileSync(new URL('./main.ts', import.meta.url), 'utf8');
  assert.match(main, /if \(inkId\) void import\('\.\/inkverse-comic\.ts'\)/, 'a dynamic import behind the flag');
  assert.ok(!/^import .*inkverse-comic/m.test(main), 'never a static import');
});
