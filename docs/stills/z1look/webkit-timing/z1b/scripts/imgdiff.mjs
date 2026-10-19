// Mean absolute pixel difference between two same-size JPEGs, over the top 60% of the frame (the world; the HUD and hero are below).
// Usage: PW_ROOT=<repo with playwright> node imgdiff.mjs a.jpg b.jpg
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const require = createRequire((process.env.PW_ROOT ?? process.cwd()) + '/');
const { webkit } = require('playwright');
const [A, B] = process.argv.slice(2);
const data = (p) => 'data:image/jpeg;base64,' + readFileSync(p).toString('base64');
const browser = await webkit.launch(); const page = await browser.newPage();
const r = await page.evaluate(async ([a, b]) => {
  const load = (src) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.src = src; });
  const [ia, ib] = await Promise.all([load(a), load(b)]);
  const w = Math.min(ia.width, ib.width), h = Math.min(ia.height, ib.height), top = Math.round(h * 0.6);
  const px = (img) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.drawImage(img, 0, 0); return g.getImageData(0, 0, w, top).data; };
  const pa = px(ia), pb = px(ib); let sum = 0, over = 0; const n = w * top;
  for (let i = 0; i < pa.length; i += 4) { const d = (Math.abs(pa[i] - pb[i]) + Math.abs(pa[i + 1] - pb[i + 1]) + Math.abs(pa[i + 2] - pb[i + 2])) / 3; sum += d; if (d > 24) over++; }
  return { w, h, rows: top, meanAbsDiff: +(sum / n).toFixed(2), pctPixelsOver24: +(100 * over / n).toFixed(2) };
}, [data(A), data(B)]);
console.log(JSON.stringify(r)); await browser.close();
