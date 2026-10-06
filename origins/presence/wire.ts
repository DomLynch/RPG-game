// The presence wire format (docs/specs/origins/one-shard.md §2). Binary, little cost: one packet per client per tick, 11 bytes an entity.
// Positions are centimetres inside the zone (u16, so a zone is at most 655 m), heading a byte (0..255 round the compass), `anim` and `flags` a byte each.
export const UP = 2;       // client -> server: [type u8, x u16, z u16, heading u8, anim u8, flags u8] = 8 bytes
export const DOWN = 1;     // server -> client: [type u8, tick u16, count u8] then `count` entities
export const UP_BYTES = 8;
export const ENTITY_BYTES = 11;   // id u16, x u16, z u16, heading u8, anim u8, flags u8, entity tick u16
export const HEAD_BYTES = 4;

export type Pose = { x: number; z: number; heading: number; anim: number; flags: number };
export type Entity = Pose & { id: number; tick: number };

export function encodeUp(p: Pose): Uint8Array {
  const b = new Uint8Array(UP_BYTES), v = new DataView(b.buffer);
  b[0] = UP; v.setUint16(1, p.x, true); v.setUint16(3, p.z, true); b[5] = p.heading; b[6] = p.anim; b[7] = p.flags;
  return b;
}
export function decodeUp(b: Uint8Array): Pose | null {
  if (b.length !== UP_BYTES || b[0] !== UP) return null;
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  return { x: v.getUint16(1, true), z: v.getUint16(3, true), heading: b[5], anim: b[6], flags: b[7] };
}

export function encodeDown(tick: number, entities: readonly Entity[]): Uint8Array {
  const n = Math.min(entities.length, 255), b = new Uint8Array(HEAD_BYTES + n * ENTITY_BYTES), v = new DataView(b.buffer);
  b[0] = DOWN; v.setUint16(1, tick & 0xffff, true); b[3] = n;
  for (let i = 0; i < n; i++) {
    const e = entities[i], at = HEAD_BYTES + i * ENTITY_BYTES;
    v.setUint16(at, e.id, true); v.setUint16(at + 2, e.x, true); v.setUint16(at + 4, e.z, true);
    b[at + 6] = e.heading; b[at + 7] = e.anim; b[at + 8] = e.flags; v.setUint16(at + 9, e.tick & 0xffff, true);
  }
  return b;
}
export function decodeDown(b: Uint8Array): { tick: number; entities: Entity[] } | null {
  if (b.length < HEAD_BYTES || b[0] !== DOWN) return null;
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength), n = b[3];
  if (b.length !== HEAD_BYTES + n * ENTITY_BYTES) return null;
  const entities: Entity[] = [];
  for (let i = 0; i < n; i++) {
    const at = HEAD_BYTES + i * ENTITY_BYTES;
    entities.push({ id: v.getUint16(at, true), x: v.getUint16(at + 2, true), z: v.getUint16(at + 4, true), heading: b[at + 6], anim: b[at + 7], flags: b[at + 8], tick: v.getUint16(at + 9, true) });
  }
  return { tick: v.getUint16(1, true), entities };
}
