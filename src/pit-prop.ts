// The Pit's prop loader (scene.ts pitStage().prop): one prop's first mesh from public/pit/props/<name>.glb, or null. Outside src/pit/ (the
// sealed chunk never loads files itself, tests/pit-boundary.test.ts); the file load is handed in, so tests need no browser.
import { Mesh, type Object3D } from 'three';
import { retryTransient } from './retry.ts';

export function loadPitProp(url: string, load: () => Promise<{ scene: Object3D }>, sleep?: (ms: number) => Promise<void>): Promise<Mesh | null> {
  return retryTransient(async () => {
    const { scene } = await load();
    let mesh: Mesh | null = null;
    scene.traverse((o) => { if (!mesh && o instanceof Mesh) mesh = o; });
    return mesh as Mesh | null;
  }, 3, 800, sleep).catch(() => null);
}
