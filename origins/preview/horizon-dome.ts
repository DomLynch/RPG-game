// The painted horizon dome (?look=goblin, World lane): the Pit's 2D-sky trick for a zone: one canvas painting (a gradient sky, a glow on the horizon, two ridge silhouettes and a few far smoke columns)
// on the inside of a big dome that follows the camera, drawn first with no depth, so the ground's fog meets the painting's horizon colour without a line. Every colour and number is a row
// (origins/world/goblin-field-defs.json); the colours are one palette row (fortress: ?goblin=<id>). `ridgeProfile` and `smokeColumns` are pure and tested; the painting and the mesh are browser-only (stills check them).
import * as THREE from 'three';
import { goblinBackdrop, goblinHarmonics, goblinRule as R, type GoblinBackdrop, type GoblinPalette } from '../world/goblin-field-rules.ts';

const mulberry = (seed: number) => { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
/** A closed (wraps at the seam) ridge line, n samples in 0..1: the harmonic rows (whole periods per turn, so the ends meet) with seeded phases. Pure. */
export function ridgeProfile(seed: number, n: number): number[] {
  const rnd = mulberry(seed), harm = goblinHarmonics().map(({ k, a }) => ({ k, a, ph: rnd() * Math.PI * 2 }));
  const raw = Array.from({ length: n }, (_, i) => harm.reduce((s, h) => s + h.a * Math.sin((i / n) * Math.PI * 2 * h.k + h.ph), 0));
  const lo = Math.min(...raw), hi = Math.max(...raw);
  return raw.map((v) => (v - lo) / (hi - lo || 1));
}
/** Where the far smoke columns stand across the painting, as fractions of its width. Pure. */
export const smokeColumns = (seed: number, count: number): number[] => { const rnd = mulberry(seed ^ 0x9e3779b9); return Array.from({ length: count }, () => rnd()); };

const clear = (hex: string) => `rgba(${parseInt(hex.slice(1, 3), 16)},${parseInt(hex.slice(3, 5), 16)},${parseInt(hex.slice(5, 7), 16)},0)`;   // the palette colour at alpha 0: a gradient fades to its own hue, not to grey

function paint(w: number, h: number, S: GoblinPalette, art: { img: HTMLImageElement; b: GoblinBackdrop } | null = null): HTMLCanvasElement {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d')!;
  const yh = (0.5 / R('domeHalf')) * h, sky = g.createLinearGradient(0, 0, 0, yh);   // the cap's top is the zenith, the horizon row is where the polar angle is 90 degrees
  sky.addColorStop(0, S.zenith); sky.addColorStop(0.55, S.mid); sky.addColorStop(1, S.horizon); g.fillStyle = sky; g.fillRect(0, 0, w, yh);
  g.fillStyle = S.horizon; g.fillRect(0, yh, w, h - yh);
  const gx = w * R('glowX'), glow = g.createRadialGradient(gx, yh, 0, gx, yh, w * R('glowR')); glow.addColorStop(0, S.glow); glow.addColorStop(1, clear(S.glow)); g.fillStyle = glow; g.fillRect(0, 0, w, h);
  const seed = R('ridgeSeed'), amp = R('ridgeAmp') * h, n = 256;
  const ridge = (prof: number[], colour: string, lift: number) => { g.fillStyle = colour; g.beginPath(); g.moveTo(0, yh + 2); for (let i = 0; i <= n; i++) g.lineTo((i / n) * w, yh - lift - prof[i % n]! * amp); g.lineTo(w, yh + 2); g.closePath(); g.fill(); };
  ridge(ridgeProfile(seed + 1, n), S.ridgeFar, amp * R('ridgeFarShift')); ridge(ridgeProfile(seed, n), S.ridge, 0);
  for (const fx of smokeColumns(seed, R('smokeColumns'))) {   // far smoke: a soft column rising from the ridge, fading with height
    const x = fx * w, cw = w * R('columnW'), col = g.createLinearGradient(0, yh - amp * 3, 0, yh - amp * 0.4); col.addColorStop(0, clear(S.smoke)); col.addColorStop(1, S.smoke); g.globalAlpha = R('columnAlpha'); g.fillStyle = col; g.fillRect(x - cw / 2, yh - amp * 3, cw, amp * 2.6); g.globalAlpha = 1;
  }
  if (art) paintBackdrop(g, w, yh, S, art.img, art.b);
  return c;
}

/** Dom's picture round the horizon, as the Pit's backdrop ring does it: `repeat` mirrored copies of the crop, its foot (y1, the picture's horizon line) on the dome's horizon row; the head fades
 *  into the painted sky under it, the foot into the palette's horizon (= the haze row's fog), so neither the sky nor the ground meets the picture with a line. A crop taller than the sky is cut at the top. */
function paintBackdrop(g: CanvasRenderingContext2D, w: number, yh: number, S: GoblinPalette, img: HTMLImageElement, b: GoblinBackdrop) {
  const sx = b.x0 * img.naturalWidth, sw = (b.x1 - b.x0) * img.naturalWidth, sy1 = b.y1 * img.naturalHeight, cw = Math.ceil(w / b.repeat!);
  const scale = cw / sw, ch = Math.min(yh, (sy1 - b.y0 * img.naturalHeight) * scale), sh = ch / scale;   // drawn height; the source rows it covers end at the horizon line
  const one = document.createElement('canvas'); one.width = cw; one.height = Math.ceil(ch); const o = one.getContext('2d')!;
  o.drawImage(img, sx, sy1 - sh, sw, sh, 0, 0, cw, ch);
  o.globalCompositeOperation = 'destination-in'; const head = o.createLinearGradient(0, 0, 0, ch); head.addColorStop(0, 'rgba(0,0,0,0)'); head.addColorStop(b.fadeTop, 'rgba(0,0,0,1)'); head.addColorStop(1, 'rgba(0,0,0,1)'); o.fillStyle = head; o.fillRect(0, 0, cw, ch);   // over the WHOLE crop: destination-in clears whatever the fill does not cover
  o.globalCompositeOperation = 'source-over'; const foot = o.createLinearGradient(0, ch * (1 - b.fadeFoot), 0, ch); foot.addColorStop(0, clear(S.horizon)); foot.addColorStop(1, S.horizon); o.fillStyle = foot; o.fillRect(0, ch * (1 - b.fadeFoot), cw, ch * b.fadeFoot);
  for (let i = 0; i < b.repeat!; i++) { g.save(); if (i % 2) { g.translate((i + 1) * cw, 0); g.scale(-1, 1); } else g.translate(i * cw, 0); g.drawImage(one, 0, yh - ch + ch * b.drop); g.restore(); }   // odd copies mirrored: every seam meets its own edge
}

/** A SECTOR backdrop (an `arc` row): the picture at its own native resolution, once, over `arc` degrees of sky facing `azimuth`: not wrapped round the whole dome, which a phone's texture limit would stretch about five times.
 *  The crop's foot fades into the palette's horizon colour, its head and both sides into transparent (the painted sky shows through). Returns the canvas and the band's angular height in degrees (arc x height / width). */
function sectorCanvas(S: GoblinPalette, img: HTMLImageElement, b: GoblinBackdrop): { canvas: HTMLCanvasElement; heightDeg: number } {
  const sx = b.x0 * img.naturalWidth, sy0 = b.y0 * img.naturalHeight, sw = (b.x1 - b.x0) * img.naturalWidth, sh = (b.y1 - b.y0) * img.naturalHeight;
  const c = document.createElement('canvas'); c.width = Math.round(sw); c.height = Math.round(sh); const o = c.getContext('2d')!, w = c.width, h = c.height;
  o.drawImage(img, sx, sy0, sw, sh, 0, 0, w, h);
  o.globalCompositeOperation = 'destination-in';
  const head = o.createLinearGradient(0, 0, 0, h); head.addColorStop(0, 'rgba(0,0,0,0)'); head.addColorStop(b.fadeTop, 'rgba(0,0,0,1)'); head.addColorStop(1, 'rgba(0,0,0,1)'); o.fillStyle = head; o.fillRect(0, 0, w, h);
  const side = o.createLinearGradient(0, 0, w, 0), e = b.fadeSide ?? 0; side.addColorStop(0, 'rgba(0,0,0,0)'); side.addColorStop(e, 'rgba(0,0,0,1)'); side.addColorStop(1 - e, 'rgba(0,0,0,1)'); side.addColorStop(1, 'rgba(0,0,0,0)'); o.fillStyle = side; o.fillRect(0, 0, w, h);
  o.globalCompositeOperation = 'source-over'; const yh = h * (1 - b.drop), f0 = yh - h * b.fadeFoot;   // the horizon row sits `drop` of the height above the picture's foot: the fade ends AT it, in the haze colour the far ground is fogged to, and the rows below it (behind the ground) are solid haze
  const foot = o.createLinearGradient(0, f0, 0, yh); foot.addColorStop(0, clear(S.horizon)); foot.addColorStop(1, S.horizon); o.fillStyle = foot; o.fillRect(0, f0, w, yh - f0); o.fillStyle = S.horizon; o.fillRect(0, yh, w, h - yh);
  return { canvas: c, heightDeg: (b.arc! * h) / w };
}

/** The dome in one palette: add it to the scene once; call follow(camera) each frame. dispose() frees the texture. When the palette names backdrops, the painted sky shows at once and the
 *  picture for the screen's shape (portrait or landscape row) replaces it when its file has loaded; turning the phone repaints with the other row. `base` is the page's base path (the picture's file is under it). */
export function createHorizonDome(scene: THREE.Scene, palette: GoblinPalette, base = '/') {
  const texOf = (c: HTMLCanvasElement, art = false) => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; if (art) { t.generateMipmaps = false; t.minFilter = THREE.LinearFilter; } return t; };   // a picture skips mips (the big texture's memory), as the Pit's backdrop does
  let tex = texOf(paint(R('texW'), R('texH'), palette)), alive = true;
  const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false, depthTest: false, depthWrite: false }), geo = new THREE.SphereGeometry(R('domeRadius'), 64, 32, 0, Math.PI * 2, 0, Math.PI * R('domeHalf'));
  const mesh = new THREE.Mesh(geo, mat); mesh.name = 'horizon-dome'; mesh.renderOrder = -1000; mesh.frustumCulled = false; scene.add(mesh);
  const shape = typeof matchMedia === 'function' ? matchMedia('(orientation: portrait)') : null, images = new Map<string, Promise<HTMLImageElement>>();
  const load = (file: string) => { let p = images.get(file); if (!p) { p = new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = `${base}${file}`; }); images.set(file, p); } return p; };
  let sector: THREE.Mesh | null = null, sectorOf: GoblinBackdrop | null = null;
  const dropSector = () => { if (!sector) return; scene.remove(sector); sector.geometry.dispose(); const m = sector.material as THREE.MeshBasicMaterial; m.map?.dispose(); m.dispose(); sector = null; sectorOf = null; };
  const showSector = (img: HTMLImageElement, b: GoblinBackdrop) => {   // (depthTest ON: a see-through layer is drawn after every opaque one, so with the test off it painted over the ground and the props)  one non-repeating arc at the picture's own resolution, facing b.azimuth; the dome's painted sky shows round it
    if (sectorOf === b) return; dropSector();
    const { canvas, heightDeg } = sectorCanvas(palette, img, b), t = new THREE.CanvasTexture(canvas); t.colorSpace = THREE.SRGBColorSpace; t.generateMipmaps = false; t.minFilter = THREE.LinearFilter; t.wrapS = THREE.RepeatWrapping; t.repeat.x = -1; t.offset.x = 1;   // seen from inside the sphere u runs leftwards: flipped so the picture reads the right way round
    const arc = (b.arc! * Math.PI) / 180, hRad = (heightDeg * Math.PI) / 180, az = (b.azimuth! * Math.PI) / 180, phiMid = Math.atan2(Math.cos(az), -Math.sin(az)), bottom = Math.PI / 2 + hRad * b.drop;   // three's sphere: x = -r cos(phi) sin(theta), z = r sin(phi) sin(theta)
    const g = new THREE.SphereGeometry(R('domeRadius') * R('sectorInset'), 48, 16, phiMid - arc / 2, arc, bottom - hRad, hRad);
    sector = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: t, side: THREE.BackSide, transparent: true, fog: false, depthTest: true, depthWrite: false })); sector.name = 'horizon-sector'; sector.renderOrder = mesh.renderOrder + 1; sector.frustumCulled = false; sector.position.copy(mesh.position); scene.add(sector); sectorOf = b;
  };
  const show = () => { const b = goblinBackdrop(palette, shape?.matches ?? true); if (!b) return; void load(b.file).then((img) => { if (!alive || goblinBackdrop(palette, shape?.matches ?? true) !== b) return; if (b.arc !== undefined) { showSector(img, b); return; } dropSector(); const old = tex; tex = texOf(paint(b.texW, b.texH, palette, { img, b }), true); mat.map = tex; mat.needsUpdate = true; old.dispose(); }).catch((e: unknown) => console.warn('zone dome: the backdrop did not paint; the painted sky stays', b.file, e)); };   // a missing picture leaves the painted sky
  show(); shape?.addEventListener('change', show);
  return { mesh, covers: 'sky' /* the Pit's sky mesh name (src/arena.ts): the zone dome replaces it */, follow(camera: THREE.Camera) { mesh.position.set(camera.position.x, 0, camera.position.z); sector?.position.copy(mesh.position); }, dispose() { alive = false; shape?.removeEventListener('change', show); dropSector(); scene.remove(mesh); geo.dispose(); mat.dispose(); tex.dispose(); } };
}
