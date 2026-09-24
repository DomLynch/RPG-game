// The arena's heavy textures, generated off the main thread (audit 2026-09-20: 1.4 s of sand and stone generation was the startup stall).
// Same pure generators as tests/arena.test.ts measures; the arena swaps them in when they arrive. Message in: { phone }; out: the pixels.
import { floorOverlay, patchPixels, sandAlbedo, sandNormal, skyPixels, stoneAlbedo, stoneNormal, tinted, type Pixels } from './textures.ts';
import type { TextureLook } from '../../arena-themes.ts';

export type HeavyTextures = { sand: Pixels; sandNormal: Pixels; stone: Pixels; stoneNormal: Pixels; sky: Pixels; patch?: Pixels };
export function generateHeavyTextures(phone: boolean, skyU: number, look: TextureLook): HeavyTextures {
  const half = (size: number) => (phone ? size / 2 : size);
  const { floor, sandSeed } = look, flag = floor === 'flag';   // flags: the ashlar generator at the sand's texel budget (tile 3 m: courses ~0.6 m, laid slabs)
  const ground = flag ? stoneAlbedo(half(1024), sandSeed) : sandAlbedo(half(1024), sandSeed);
  const kind = look.patch ?? (floor !== 'sand' ? floor : undefined), patch = kind ? patchPixels(256, kind, sandSeed) : undefined;   // world-space patches and mottle, not in the tile
  return { ...(patch ? { patch } : {}), sand: tinted(floor === 'clay' ? floorOverlay(ground, floor, sandSeed) : ground, look.sand), sandNormal: flag ? stoneNormal(half(512), sandSeed) : sandNormal(half(512), sandSeed), stone: tinted(stoneAlbedo(half(512), look.stoneSeed, look.wall), look.stone), stoneNormal: stoneNormal(half(512), look.stoneSeed, look.wall), sky: skyPixels(half(512), half(256), skyU, 0.77, 19, look.sky) };
}
// Only inside a worker (no document): the same module is imported on the main thread and in Node for the synchronous fallback.
if (typeof self !== 'undefined' && typeof document === 'undefined') {
  self.onmessage = (event: MessageEvent<{ phone: boolean; skyU: number; look: TextureLook }>) => {
    const out = generateHeavyTextures(event.data.phone, event.data.skyU, event.data.look);
    (self as unknown as Worker).postMessage(out, Object.values(out).map((p) => p.data.buffer));
  };
}
