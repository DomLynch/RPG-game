// A point `ahead` metres along a facing and `right` metres across it (right of a walker looking along it). The one geometry helper the Frontier plan (collision positions) and the greybox (drawing) share;
// no number of its own. Pure.
export const off = (a: { x: number; z: number }, facing: number, ahead: number, right = 0): { x: number; z: number } => ({ x: a.x + Math.sin(facing) * ahead - Math.cos(facing) * right, z: a.z + Math.cos(facing) * ahead + Math.sin(facing) * right });
