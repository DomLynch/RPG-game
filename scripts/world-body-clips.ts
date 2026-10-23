// The clips a world body must keep: every clip fighterClips asks for, for every weapon a zone gives that kind (its roster weapon, a mob look's `gear`, a
// loadout's weapon: the same walk tests/creature-clips.test.ts does), plus the two a standing person or a plain walk can name (Idle, Walk).
// Anything else in the file is dead weight on a phone: scripts/reduce-anim-keys.mjs --keep=<this list> drops it.
//   node scripts/world-body-clips.ts <kind>...     (prints {"<kind>": ["Clip", ...]}; reads the clips each public/world/<kind>.glb has today)
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { OPPONENTS, catalogueRow, ADDITIVE_ROLES, ROLES, PLAYER_CLIPS, clipFor } from '../src/fight/index.ts';
import type { WeaponId } from '../src/fight/index.ts';
import { loadoutRow } from '../origins/world/loadouts-rules.ts';

const ROOT = new URL('..', import.meta.url);
const clipNames = (file: string): string[] => { const b = readFileSync(file), j = JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString()); return (j.animations ?? []).map((a: { name: string }) => a.name); };

function weaponsOf(kind: string): Set<WeaponId> {
  const out = new Set<WeaponId>();
  const own = (OPPONENTS as Record<string, { weapon: WeaponId } | undefined>)[kind]?.weapon;
  if (own) out.add(own);
  type Row = { mobLooks?: { looks?: Record<string, { opponent: string; gear?: WeaponId; loadout?: string }>; spread?: Record<string, { loadouts?: string[] }> } };
  for (const f of readdirSync(new URL('origins/zone-rows/', ROOT)).filter((n) => n.endsWith('.row.json'))) {
    const row = JSON.parse(readFileSync(new URL(`origins/zone-rows/${f}`, ROOT), 'utf8')) as Row;
    for (const [id, look] of Object.entries(row.mobLooks?.looks ?? {})) {
      if (look.opponent !== kind) continue;
      if (look.gear) out.add(look.gear);
      const w = loadoutRow(look.loadout)?.weapon; if (w) out.add(w);
      for (const l of row.mobLooks?.spread?.[id]?.loadouts ?? []) { const lw = loadoutRow(l)?.weapon; if (lw) out.add(lw); }
    }
  }
  return out;
}

const result: Record<string, string[]> = {};
for (const kind of process.argv.slice(2)) {
  const row = catalogueRow(kind), file = row?.world?.asset;
  if (!row || !file || !existsSync(new URL(file, ROOT))) throw new Error(`${kind}: no world body in this checkout`);
  const have = new Set(clipNames(new URL(file, ROOT).pathname)), keep = new Set<string>(['Idle', 'Walk']);
  for (const weapon of weaponsOf(kind)) for (const role of [...ROLES, ...ADDITIVE_ROLES]) {
    const player = PLAYER_CLIPS[weapon]?.[role as never];
    if (player) keep.add(player);
    keep.add(clipFor(weapon, role as never, false));
    if (role === 'ArmedRun') keep.add('ArmedWalk');
  }
  result[kind] = [...keep].filter((n) => have.has(n)).sort();
}
console.log(JSON.stringify(result));
