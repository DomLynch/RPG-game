import './lib/era-off.ts';   // RV78: the legacy suite runs on trunk's rules; sandbox-era.ts is the one switch (tests/lib/era-off.ts)
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { Group } from 'three';
import { OPPONENTS, catalogueRow, fighterClips, worldBodyUrl } from '../src/fight/index.ts';
import type { WeaponId } from '../src/fight/index.ts';

// The CI half of "fail loud" (Lead, 2026-10-18): every body a zone draws, with every weapon a zone gives it (its roster weapon, or the `gear` a mob look names), carries
// each clip fighterClips asks for. Same function the zone view builds with, so the list cannot drift. A warhammer troll whose body lacks Warhammer_Idle fails here, not in a player's frame.
const ROOT = new URL('..', import.meta.url);

async function clipsOf(file: URL) {
  const bytes = readFileSync(file), size = bytes.readUInt32LE(12), json = JSON.parse(bytes.subarray(20, 20 + size).toString());
  json.images = []; json.textures = []; json.materials = (json.materials ?? []).map((m: { name: string }) => ({ name: m.name }));
  json.buffers[0].uri = 'data:application/octet-stream;base64,' + bytes.subarray(28 + size).toString('base64');
  globalThis.ProgressEvent ??= class { constructor(_type: string, fields: object) { Object.assign(this, fields); } } as unknown as typeof ProgressEvent;
  return (await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(JSON.stringify(json), '')).animations;
}

// The body file a zone fetches for a kind: the world body when the row has one (public/world), else the engine body.
function bodyFile(kind: string): URL | null {
  const world = worldBodyUrl(kind), row = catalogueRow(kind);
  const path = world ? `public${world}` : row?.engine.asset;
  return path && existsSync(new URL(path, ROOT)) ? new URL(path, ROOT) : null;
}

type Pairing = { kind: string; weapon: WeaponId; why: string };
function pairings(): Pairing[] {
  const out = new Map<string, Pairing>();
  const add = (kind: string, weapon: WeaponId | undefined, why: string) => { if (weapon) out.set(`${kind}/${weapon}`, { kind, weapon, why }); };
  for (const f of readdirSync(new URL('origins/zone-rows/', ROOT)).filter((n) => n.endsWith('.row.json'))) {
    const row = JSON.parse(readFileSync(new URL(`origins/zone-rows/${f}`, ROOT), 'utf8')) as { mobLooks?: { looks?: Record<string, { opponent: string; gear?: WeaponId }> } };
    for (const [id, look] of Object.entries(row.mobLooks?.looks ?? {})) {
      add(look.opponent, (OPPONENTS as Record<string, { weapon: WeaponId } | undefined>)[look.opponent]?.weapon, `${f} ${id}: the roster weapon`);
      add(look.opponent, look.gear, `${f} ${id}: gear`);
    }
  }
  return [...out.values()];
}

test('every zone creature body carries the clips for every weapon a zone gives it', async () => {
  const list = pairings();
  assert.ok(list.length > 0, 'the zone rows name no mob looks: the walk found nothing to check');
  const failures: string[] = [];
  for (const { kind, weapon, why } of list) {
    const file = bodyFile(kind);
    if (!file) continue;   // a kind with no body file in this checkout is not drawn by a zone
    try { fighterClips({ scene: new Group(), animations: await clipsOf(file) }, weapon, true); }
    catch (error) { failures.push(`${kind} cannot wield ${weapon} (${why}): ${(error as Error).message}`); }
  }
  assert.deepEqual(failures, []);
});
