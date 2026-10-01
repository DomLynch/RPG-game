// `?look=pit-stone`: the Pit's stone maps off the main thread (stone.ts). Message in: nothing; out: the wall's and the floor's bytes.
import { FLOOR, WALL, stoneBytes } from './stone-maps.ts';

self.onmessage = () => {
  const t0 = performance.now(), wall = stoneBytes(WALL), floor = stoneBytes(FLOOR), ms = performance.now() - t0;
  (self as unknown as Worker).postMessage({ wall, floor, ms }, [wall.albedo.buffer, wall.normal.buffer, floor.albedo.buffer, floor.normal.buffer]);
};
