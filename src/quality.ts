// Phone-tier graphics budget — the owner's live defect, 2026-09-18: on real iPhones, fighters render as
// black mannequins with metallic heads under GPU memory pressure (the arena's code-generated textures
// survive; force-refresh recovers). Emulated WebKit does not reproduce it. The inventory behind the fix:
// a duel's fighter skins cost ~110 MB of GPU memory (every GLB embeds a 2048² Gambeson atlas — 21 MB
// with mips — and ~6 used 1024² maps per fighter), the arena ~11 MB, the 1024² shadow map 4 MB, and the
// MSAA framebuffer at dpr 1.5 on a ~1170×2532-class phone another ~200 MB. The tier caps fighter
// textures at 1K (the 2K atlas never reaches a phone GPU), halves the big procedural arena maps, drops
// the shadow map to 512 and the pixel-ratio ceiling to 1.25. Desktop is untouched (detection needs a
// mobile UA AND a coarse pointer, so touchscreen laptops and the desktop-UA browser gate keep full tier).
// Testing overrides: ?gfx=phone forces the tier on, ?gfx=full forces it off.
import { MeshStandardMaterial, type Mesh, type Object3D, type Texture } from 'three';

export type TierEnv = { userAgent?: string; maxTouchPoints?: number; locationSearch?: string; coarse?: boolean };

function readEnv(): TierEnv {
  const g = globalThis as { navigator?: { userAgent?: string; maxTouchPoints?: number }; location?: { search?: string }; matchMedia?: (q: string) => { matches: boolean } };
  return {
    userAgent: g.navigator?.userAgent, maxTouchPoints: g.navigator?.maxTouchPoints,
    locationSearch: g.location?.search,
    coarse: typeof g.matchMedia === 'function' ? g.matchMedia('(pointer: coarse)').matches : undefined,
  };
}

// Pure tier detection — tests drive this directly; phoneTier() below memoizes it for the app.
export function detectPhoneTier(env: TierEnv = readEnv()): boolean {
  const search = env.locationSearch ?? '';
  if (/[?&]gfx=phone\b/.test(search)) return true;   // overrides win, both directions — the QA path for the tier
  if (/[?&]gfx=full\b/.test(search)) return false;
  if (env.coarse !== true) return false;   // a fine pointer means desktop-class hardware, whatever the UA claims
  const ua = env.userAgent ?? '';
  // iPadOS 13+ reports a Macintosh UA; the touch points betray it.
  return /iPhone|iPad|iPod|Android|\bMobile\b/i.test(ua) || (/Macintosh/.test(ua) && (env.maxTouchPoints ?? 0) > 1);
}

let memo: boolean | undefined;
export function phoneTier(): boolean {
  if (memo === undefined) memo = detectPhoneTier();
  return memo;
}
// Test hook: the memo is module-global state, and a test that stubs globals mid-run needs it reset.
export function resetPhoneTierForTests(): void { memo = undefined; }

export const FIGHTER_TEXTURE_CAP = 1024;   // the Gambeson atlas is the only 2K runtime map — face and skin already ship 1K

const SLOTS = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap', 'alphaMap'] as const;

// Walk a loaded fighter and resize every texture over maxSize before the first render — three.js uploads
// lazily, so the oversized original never occupies GPU memory. Textures shared by several materials are
// resized once. `resize` is injectable so node tests can observe the policy without a canvas.
export function budgetTextures(root: Object3D, maxSize: number, resize: (t: Texture, max: number) => boolean = canvasResize): { textures: number; resized: number } {
  const seen = new Set<Texture>();
  let textures = 0, resized = 0;
  root.traverse(o => {
    const mesh = o as Mesh;
    if (!mesh.isMesh) return;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of materials) {
      if (!(material instanceof MeshStandardMaterial)) continue;   // fighter GLBs are all standard-material
      for (const slot of SLOTS) {
        const texture = material[slot];
        if (!texture || seen.has(texture)) continue;
        seen.add(texture); textures++;
        if (resize(texture, maxSize)) resized++;
      }
    }
  });
  return { textures, resized };
}

// The browser resize: redraw the decoded image onto a maxSize canvas and hand it to the texture. drawImage
// copies raw pixel values (no colorspace round-trip), so the texture's sRGB/normal interpretation is kept.
export function canvasResize(texture: Texture, maxSize: number): boolean {
  const img = texture.image as { width: number; height: number; close?: () => void } | undefined;
  if (!img?.width || typeof document === 'undefined' || Math.max(img.width, img.height) <= maxSize) return false;
  const k = maxSize / Math.max(img.width, img.height);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(img.width * k));
  canvas.height = Math.max(1, Math.round(img.height * k));
  canvas.getContext('2d')!.drawImage(img as unknown as CanvasImageSource, 0, 0, canvas.width, canvas.height);
  texture.image = canvas;
  texture.needsUpdate = true;
  img.close?.();   // ImageBitmaps hold their decoded pixels until closed; GC alone waits on finalization
  return true;
}
