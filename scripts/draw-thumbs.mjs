// Arena Draw thumbnails (Web design, 2026-09-24): the board's slot crop of each live rung's roster portrait (public/game/img/<id>.webp,
// scripts/opponent-portraits.mjs), so the draw fetches ~10 small files, not ten 900×1200 cutouts, while the rigs download. The crop is
// the #642 A mockup's framing: the portrait's middle two-thirds, head to waist, at the slot's 196:236 aspect, 1.5× for a phone.
// Rerun after any portrait changes: `node scripts/draw-thumbs.mjs`. tests/arena-draw.test.ts checks one exists per live rung.
import { chromium } from 'playwright';
import { readFile, writeFile } from 'node:fs/promises';
import { LADDER } from '../src/ladder.ts';

const W = 294, H = 354, CROP = { x: 149, y: 0, w: 603, h: 726 }, QUALITY = 0.82;
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  for (const { id } of LADDER) {
    const src = `data:image/webp;base64,${(await readFile(`public/game/img/${id}.webp`)).toString('base64')}`;
    const url = await page.evaluate(async ({ src, W, H, CROP, QUALITY }) => {
      const img = new Image(); img.src = src; await img.decode();
      const canvas = Object.assign(document.createElement('canvas'), { width: W, height: H });
      canvas.getContext('2d').drawImage(img, CROP.x, CROP.y, CROP.w, CROP.h, 0, 0, W, H);
      return canvas.toDataURL('image/webp', QUALITY);
    }, { src, W, H, CROP, QUALITY });
    const bytes = Buffer.from(url.split(',')[1], 'base64');
    await writeFile(`public/game/img/draw/${id}.webp`, bytes);
    console.log(`draw/${id}.webp ${W}x${H} ${Math.round(bytes.length / 1024)} KB`);
  }
} finally { await browser.close(); }
