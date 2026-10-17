// The merged remote figures (Strategy's steer 2026-10-17: the default figure for every remote player is ONE skinned body plus one weapon draw, baked from the hero rig: scripts/character/hero_far_lod.py, origins/preview/far-lod.json), as Web's
// remote-heroes.ts consumes them. `spawn(lod, kit)` hands back a figure with an `anchor` to add to a scene and an `update(speed, owed)` to pose it; `null` until `ready()`, for a kit this source does not hold yet, or when the files failed, and the
// caller then keeps its 14-part rig, so a remote is never missing. v1: the BASE hero at two levels (`kit` null). One shared vertex-colour material per level (the source's own, never per figure), so a player adds no render program.
// A LOD ships no clips: it is given the hero's own AnimationClips (the same 65 bones, bound by name) before buildWarriors. `loadWarriors` refuses an untextured body (MissingTextures), so a LOD is built from the parsed asset the way a remote is (secondActor).
import type { AnimationClip, BufferGeometry, Mesh, Object3D, SkinnedMesh } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { buildWarriors } from '../../src/fight/index.ts';
import { loadRegistry, tableFromFile, type Manifest } from '../../src/core/index.ts';
import MANIFEST from './remote-figures.manifest.json' with { type: 'json' };
import ROWS from './remote-figures.json' with { type: 'json' };
import DRESS_MANIFEST from './remote-dress.manifest.json' with { type: 'json' };
import DRESS_ROWS from './remote-dress.json' with { type: 'json' };
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const BODY = 'CreatureBody';   // the merged body mesh's name in hero-near / hero-far (scripts/character/hero_far_lod.py `body`)
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

export type DressRow = { readonly asset: string; readonly cacheMax: number; readonly dressFar: boolean };
/** The dress row (remote-dress.json `pieces`): the baked pieces file (scripts/character/loot_far_lod.py), how many merged sets stay cached, and whether far figures are dressed. */
export function loadRemoteDress(raw: unknown): DressRow {
  const table = tableFromFile(DRESS_MANIFEST.tables[0] as Manifest, raw, 'remote-dress.json');
  loadRegistry([table]);
  const f = (table.rows as unknown as { id: string; fields: Record<string, unknown> }[]).find((r) => r.id === 'pieces')?.fields;
  if (!f) throw new Error('remote-dress: no "pieces" row');
  if (typeof f.asset !== 'string' || !f.asset) throw new Error('remote-dress "pieces": asset is the glb file name');
  if (!Number.isInteger(f.cacheMax) || (f.cacheMax as number) < 1) throw new Error('remote-dress "pieces": cacheMax is a whole number, 1 or more');
  if (typeof f.dressFar !== 'boolean') throw new Error('remote-dress "pieces": dressFar is true or false');
  return { asset: f.asset, cacheMax: f.cacheMax as number, dressFar: f.dressFar };
}
export const REMOTE_DRESS = loadRemoteDress(DRESS_ROWS);

/** A worn set's key: its LootIds sorted and comma-joined (empty = nothing worn). The caller and the cache agree on it, so the same set is one merge. */
export const wornKey = (ids: readonly string[]): string => [...new Set(ids.filter((id) => id.length > 0))].sort().join(',');

type Deps = {
  /** The hero's own AnimationClips (the page's parsed hero asset): shared by every figure. */
  clips: readonly AnimationClip[];
  /** Glb file name (a row's `asset`) -> its url, from the page's `import.meta.glob`. */
  urls: Readonly<Record<string, string>>;
  /** Parse a glb (a test hands in a disk reader). */
  load?: (url: string) => Promise<FighterAsset>;
  rows?: ReadonlyMap<string, FigureRow>;
  /** The dress row and the url of its pieces file (omit `pieceUrl` and every figure is the base hero). */
  dress?: DressRow;
  pieceUrl?: string;
};
export function createFigureSource(d: Deps): FigureSource & { start(): Promise<boolean>; failed(): boolean } {
  const rows = d.rows ?? REMOTE_FIGURES, load = d.load ?? ((url: string) => new GLTFLoader().loadAsync(url) as Promise<FighterAsset>);
  const dress = d.dress ?? REMOTE_DRESS;
  const assets = new Map<Lod, FighterAsset>(), pieces = new Map<string, BufferGeometry>();   // LootId -> its baked piece (same 65 bones, same vertex layout as the body)
  const merged = new Map<string, BufferGeometry>();   // `lod|worn key` -> body + pieces; insertion order is the LRU order
  let starting: Promise<boolean> | undefined, broke = false;
  const start = () => starting ??= Promise.all((['near', 'far'] as const).map(async (lod) => {
    const row = rows.get(`hero:${lod}`)!, url = d.urls[row.asset];
    if (!url) throw new Error(`remote-figures: no url for ${row.asset}`);
    const asset = await load(url);
    asset.animations = [...d.clips];   // the hero's clips, bound by bone name
    assets.set(lod, asset);
  })).then(() => true, (error: unknown) => { broke = true; console.warn('remote figures did not load; remotes keep the 14-part rig', error); return false; });
  // The pieces load on their own: a failure leaves every dressed remote on the base figure, never the rig and never missing.
  const startPieces = async () => {
    if (!d.pieceUrl) return;
    try {
      const asset = await load(d.pieceUrl);
      asset.scene.traverse((o) => { if ((o as SkinnedMesh).isSkinnedMesh) pieces.set(`${o.userData.opponent}.${o.userData.slot}`, (o as SkinnedMesh).geometry); });   // a loot id, as src/core/loot.ts has it (the loader strips the dots from node names)
    } catch (error) { console.warn('remote dress pieces did not load; dressed remotes show the base figure', error); }
  };
  /** The body's geometry joined with the worn pieces' (one draw, one skeleton, the shared material). Cached per level and worn set; the oldest set past `cacheMax` is disposed. */
  const geometryFor = (lod: Lod, body: BufferGeometry, ids: readonly string[]): BufferGeometry => {
    const key = `${lod}|${wornKey(ids)}`, hit = merged.get(key);
    if (hit) { merged.delete(key); merged.set(key, hit); return hit; }
    const made = mergeGeometries([body, ...ids.map((id) => pieces.get(id)!)], false);
    merged.set(key, made);
    while (merged.size > dress.cacheMax) { const oldest = merged.keys().next().value!; merged.get(oldest)!.dispose(); merged.delete(oldest); }
    return made;
  };
  const source = {
    start: async () => { const ok = await start(); await startPieces(); return ok; }, failed: () => broke,
    ready: () => assets.size === 2,
    kits: () => [...pieces.keys()],
    spawn(lod: Lod, kit: string | null): MergedFigure | null {
      const asset = assets.get(lod);
      if (!asset) return null;
      const actor = buildWarriors(asset, undefined, undefined, true).player, cast = rows.get(`hero:${lod}`)!.castShadow;
      actor.anchor.traverse((o) => { if ((o as Mesh).isMesh) o.castShadow = cast; });
      const ids = kit === null || (lod === 'far' && !dress.dressFar) ? [] : kit.split(',').filter((id) => pieces.has(id));   // an id this file does not hold is left off; none known = the base figure
      if (ids.length > 0) {
        const body = actor.anchor.getObjectByName(BODY) as SkinnedMesh | undefined;
        if (body) body.geometry = geometryFor(lod, body.geometry, ids);
      }
      return { anchor: actor.anchor, update: (speed, owed) => { actor.update(speed, owed, 'ready', 0, 'light', 0.35, 0); } };
    },
  };
  return source;
}
