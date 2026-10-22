export type GlbStats = { bytes: number; tris: number; images: number; jointNames: Set<string>; joints: number; clips: string[] };
export function trianglesOf(json: { meshes?: { primitives: { indices?: number; attributes: { POSITION: number }; mode?: number }[] }[]; accessors: { count: number }[] }): number;
export function glbJson(path: string): any;
export function glbStats(path: string): GlbStats;
