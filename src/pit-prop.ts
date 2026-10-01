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

// The gate (public/pit/props/gate.glb): unlike a prop it keeps TWO nodes by design, the arch static and the bars one movable node. Each comes back
// as a plain mesh over the file's own geometry and (one, shared) material, the bars carrying their rest position in gate space. Retried and
// reported like a prop; a missing node, or a map the decode dropped, is null and the room leaves the gate bare (a way out with no bars).
export function loadPitGate(url: string, load: () => Promise<{ scene: Object3D }>, report: (error: unknown) => void, sleep?: (ms: number) => Promise<void>): Promise<{ arch: Mesh; bars: Mesh } | null> {
  return retryTransient(async (i) => {
    const { scene } = await load();
    const named = (name: string) => { let found: Mesh | null = null; scene.traverse((o) => { if (!found && o instanceof Mesh && o.name === name) found = o; }); return found as Mesh | null; };
    const arch = named('gate-arch'), bars = named('gate-bars');
    if (!arch || !bars) throw new Error(`${url}: the gate's two nodes are not there (gate-arch, gate-bars)`);
    const material = arch.material;
    const missing = material instanceof MeshStandardMaterial ? MAPS.find((m) => !material[m]) : 'material';
    if (missing) throw new MissingTextures(url, missing, i);
    const still = (mesh: Mesh) => { const copy = new Mesh(mesh.geometry, mesh.material); copy.name = mesh.name; copy.position.copy(mesh.position); copy.quaternion.copy(mesh.quaternion); copy.scale.copy(mesh.scale); return copy; };   // the node's whole rest pose, so a re-export with a rotated or scaled node keeps it (check-budget exempts the gate from the no-TRS rule)
    return { arch: still(arch), bars: still(bars) };
  }, 3, 800, sleep).catch((error: unknown) => { report(error); return null; });
}
