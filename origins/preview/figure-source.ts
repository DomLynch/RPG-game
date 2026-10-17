// The merged remote figures (Strategy's steer 2026-10-17: the default figure for every remote player is ONE skinned body plus one weapon draw, baked from the hero rig: scripts/character/hero_far_lod.py, origins/preview/far-lod.json), as Web's
// remote-heroes.ts consumes them. `spawn(lod, kit)` hands back a figure with an `anchor` to add to a scene and an `update(speed, owed)` to pose it; `null` until `ready()`, for a kit this source does not hold yet, or when the files failed, and the
// caller then keeps its 14-part rig, so a remote is never missing. v1: the BASE hero at two levels (`kit` null). One shared vertex-colour material per level (the source's own, never per figure), so a player adds no render program.
// A LOD ships no clips: it is given the hero's own AnimationClips (the same 65 bones, bound by name) before buildWarriors. `loadWarriors` refuses an untextured body (MissingTextures), so a LOD is built from the parsed asset the way a remote is (secondActor).
import type { AnimationClip, Mesh, Object3D } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { buildWarriors } from '../../src/fight/index.ts';
import { loadRegistry, tableFromFile, type Manifest } from '../../src/core/index.ts';
import MANIFEST from './remote-figures.manifest.json' with { type: 'json' };
import ROWS from './remote-figures.json' with { type: 'json' };

export type Lod = 'near' | 'far';
export type FigureRow = { readonly asset: string; readonly castShadow: boolean };
export interface MergedFigure { readonly anchor: Object3D; update(speed: number, owed: number): void }
export interface FigureSource { ready(): boolean; spawn(lod: Lod, kit: string | null): MergedFigure | null; kits(): readonly string[] }
type FighterAsset = Parameters<typeof buildWarriors>[0];

/** The one loader: the registry's duplicate / missing / mistyped checks, then the row rules (a `hero:near` and a `hero:far` row, each a file name and a shadow flag). */
export function loadRemoteFigures(raw: unknown): ReadonlyMap<string, FigureRow> {
  const table = tableFromFile(MANIFEST.tables[0] as Manifest, raw, 'remote-figures.json');
  loadRegistry([table]);
  const out = new Map<string, FigureRow>();
  for (const { id, fields } of table.rows as unknown as { id: string; fields: Record<string, unknown> }[]) {
    if (typeof fields.asset !== 'string' || !fields.asset) throw new Error(`remote-figures "${id}": asset is the glb file name`);
    if (typeof fields.castShadow !== 'boolean') throw new Error(`remote-figures "${id}": castShadow is true or false`);
    out.set(id, { asset: fields.asset, castShadow: fields.castShadow });
  }
  for (const lod of ['near', 'far']) if (!out.has(`hero:${lod}`)) throw new Error(`remote-figures: no "hero:${lod}" row`);
  return out;
}
export const REMOTE_FIGURES = loadRemoteFigures(ROWS);

type Deps = {
  /** The hero's own AnimationClips (the page's parsed hero asset): shared by every figure. */
  clips: readonly AnimationClip[];
  /** Glb file name (a row's `asset`) -> its url, from the page's `import.meta.glob`. */
  urls: Readonly<Record<string, string>>;
  /** Parse a glb (a test hands in a disk reader). */
  load?: (url: string) => Promise<FighterAsset>;
  rows?: ReadonlyMap<string, FigureRow>;
};
export function createFigureSource(d: Deps): FigureSource & { start(): Promise<boolean>; failed(): boolean } {
  const rows = d.rows ?? REMOTE_FIGURES, load = d.load ?? ((url: string) => new GLTFLoader().loadAsync(url) as Promise<FighterAsset>);
  const assets = new Map<Lod, FighterAsset>();
  let starting: Promise<boolean> | undefined, broke = false;
  const start = () => starting ??= Promise.all((['near', 'far'] as const).map(async (lod) => {
    const row = rows.get(`hero:${lod}`)!, url = d.urls[row.asset];
    if (!url) throw new Error(`remote-figures: no url for ${row.asset}`);
    const asset = await load(url);
    asset.animations = [...d.clips];   // the hero's clips, bound by bone name
    assets.set(lod, asset);
  })).then(() => true, (error: unknown) => { broke = true; console.warn('remote figures did not load; remotes keep the 14-part rig', error); return false; });
  return {
    start, failed: () => broke,
    ready: () => assets.size === 2,
    kits: () => [],
    spawn(lod, kit) {
      const asset = assets.get(lod);
      if (!asset || kit !== null) return null;   // v1 holds the base hero only
      const actor = buildWarriors(asset, undefined, undefined, true).player, cast = rows.get(`hero:${lod}`)!.castShadow;
      actor.anchor.traverse((o) => { if ((o as Mesh).isMesh) o.castShadow = cast; });
      return { anchor: actor.anchor, update: (speed, owed) => { actor.update(speed, owed, 'ready', 0, 'light', 0.35, 0); } };
    },
  };
}
