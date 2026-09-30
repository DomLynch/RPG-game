// The Pit's prop loader (scene.ts pitStage().prop): one prop's first mesh from public/pit/props/<name>.glb, or null. Outside src/pit/ (the
// sealed chunk never loads files itself, tests/pit-boundary.test.ts); the file load is handed in, so tests need no browser.
import { Mesh, MeshStandardMaterial, type Object3D } from 'three';
import { MissingTextures, retryTransient } from './retry.ts';

const MAPS = ['map', 'normalMap', 'roughnessMap'] as const;   // what every Pit prop embeds (GPT's pack: albedo, normal, metal-roughness WebP)

// A dropped connection is retried, and so is a prop that parsed with a map missing: GLTFLoader turns a failed embedded image decode into a
// null map instead of rejecting (retry.ts, FRANKENDOM-5), and a bare grey prop would otherwise stay cached for the page. A 404, a bad file,
// no mesh, or maps still missing after the retries: null, and `report` hears why (the room leaves the spot bare).
export function loadPitProp(url: string, load: () => Promise<{ scene: Object3D }>, report: (error: unknown) => void, sleep?: (ms: number) => Promise<void>): Promise<Mesh | null> {
  return retryTransient(async (i) => {
    const { scene } = await load();
    let mesh: Mesh | null = null;
    scene.traverse((o) => { if (!mesh && o instanceof Mesh) mesh = o; });
    const found = mesh as Mesh | null, material = found?.material;
    if (!found) throw new Error(`${url}: no mesh`);
    const missing = material instanceof MeshStandardMaterial ? MAPS.find((m) => !material[m]) : 'material';
    if (missing) throw new MissingTextures(url, missing, i);
    return found;
  }, 3, 800, sleep).catch((error: unknown) => { report(error); return null; });
}
