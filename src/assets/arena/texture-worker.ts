// The arena's heavy textures, generated off the main thread (audit 2026-09-20: 1.4 s of sand and stone generation was the startup stall).
// Same pure generators as tests/arena.test.ts measures; the arena swaps them in when they arrive. Message in: { phone }; out: the pixels.
import { sandAlbedo, sandNormal, skyPixels, stoneAlbedo, stoneNormal, type Pixels } from './textures.ts';

export type HeavyTextures = { sand: Pixels; sandNormal: Pixels; stone: Pixels; stoneNormal: Pixels; sky: Pixels };
export function generateHeavyTextures(phone: boolean, skyU: number): HeavyTextures {
  const half = (size: number) => (phone ? size / 2 : size);
  return { sand: sandAlbedo(half(1024)), sandNormal: sandNormal(half(512)), stone: stoneAlbedo(half(512)), stoneNormal: stoneNormal(half(512)), sky: skyPixels(half(512), half(256), skyU) };
}
// Only inside a worker (no document): the same module is imported on the main thread and in Node for the synchronous fallback.
if (typeof self !== 'undefined' && typeof document === 'undefined') {
  self.onmessage = (event: MessageEvent<{ phone: boolean; skyU: number }>) => {
    const out = generateHeavyTextures(event.data.phone, event.data.skyU);
    (self as unknown as Worker).postMessage(out, Object.values(out).map((p) => p.data.buffer));
  };
}
