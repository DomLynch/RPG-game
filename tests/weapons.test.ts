// The weapon slot: a fighter carries a weapon, and every move / path / reach lookup goes through it. No balance change: on trunk
// both fighters carry the longsword and the trident entry borrows its data until the weapons lane lands the real one.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { bladePaths } from '../src/blade-paths.ts';
import { createFighter, idleIntent, initialDuel, legal, movesOf, stepDuel, type Duel, type Intent } from '../src/duel.ts';
import { LONGSWORD, MOVES, PATHS, WEAPONS, weaponOf, type Weapon } from '../src/moves.ts';
import { TARGET } from '../src/sim.ts';

const idle = (): Intent => ({ ...idleIntent(), lock: false });
const act = (action: Intent['action']): Intent => ({ ...idle(), action });
const duel = (gap: number, weapon: 'longsword' | 'trident' = 'longsword'): Duel => ({ tick: 0, fighters: [createFighter({ x: 0, z: TARGET.z + gap, heading: Math.PI, distance: 0 }, 'ready', weapon), createFighter({ ...TARGET, heading: 0, distance: 0 }, 'ready')], finish: null, events: [] });
// Steps n ticks and returns the final duel with every tick's events gathered (stepDuel only carries the current tick's).
const run = (d: Duel, n: number, a = idle(), b = idle()) => { const events: Duel['events'] = []; for (let i = 0; i < n; i++) { d = stepDuel(d, [a, b]); events.push(...d.events); } return { ...d, events }; };

test('on trunk nothing changes: both fighters carry the longsword; the trident is its own table (weapons lane) that nothing uses until combat review flips the opponent', () => {
  const d = initialDuel();
  assert.deepEqual(d.fighters.map(f => f.weapon), ['longsword', 'longsword']);
  assert.equal(weaponOf('longsword').moves, MOVES); assert.equal(weaponOf('longsword').paths, PATHS); assert.equal(LONGSWORD.reach, MOVES.thrust.reach);
  assert.equal(WEAPONS.trident.placeholder, undefined, 'the trident is real data now'); assert.notEqual(WEAPONS.trident.moves, MOVES); assert.notEqual(WEAPONS.trident.paths, PATHS);
  assert.notDeepEqual(bladePaths.trident, bladePaths.longsword, 'baked from its own rig'); assert.ok(WEAPONS.trident.reach > LONGSWORD.reach, 'the trident out-reaches the sword');
  assert.deepEqual([WEAPONS.trident.guard, WEAPONS.trident.material], ['shaft', 'bronze']);
  assert.equal(movesOf(d.fighters[0]), MOVES);
  assert.deepEqual([LONGSWORD.guard, LONGSWORD.material], ['blade', 'iron']);
});

test('a second weapon with a longer reach resolves contact from its own table: the trident lands a thrust from where the longsword whiffs, costs its own stamina, and the AI-facing reach follows it', () => {
  // A synthetic trident for the test only: the longsword's moves and paths, with the thrust's reach and cost changed, and its blade paths
  // stretched 0.5 m forward along the thrust so the baked contact really is longer (the sim sweeps the table, not the number).
  const trident: Weapon = { id: 'trident', guard: 'shaft', material: 'bronze', reach: 2.5, moves: { ...MOVES, thrust: { ...MOVES.thrust, reach: 2.5, stamina: 30 } }, paths: PATHS };
  const stretched = Object.fromEntries(Object.entries(bladePaths.longsword).map(([k, frames]) => [k, k === 'thrust' ? frames.map(f => [f[0], f[1], f[2] + .5, f[3], f[4], f[5] + .5]) : frames]));
  const before = { weapon: WEAPONS.trident, paths: bladePaths.trident };
  WEAPONS.trident = trident; bladePaths.trident = stretched;
  try {
    const far = 2.35;   // beyond the longsword thrust's baked reach, inside the stretched trident's
    const sword = run(stepDuel(duel(far, 'longsword'), [act('thrust'), idle()]), MOVES.thrust.windup + MOVES.thrust.active);
    const tri = run(stepDuel(duel(far, 'trident'), [act('thrust'), idle()]), MOVES.thrust.windup + MOVES.thrust.active);
    assert.ok(!sword.events.some(e => e.type === 'Hit') && sword.events.some(e => e.type === 'AttackMissed'), 'the longsword whiffs from 2.35 m');
    const hit = tri.events.find(e => e.type === 'Hit');
    assert.ok(hit, 'the trident lands from 2.35 m'); assert.deepEqual([hit!.weapon, hit!.material], ['trident', 'bronze'], 'the hit is tagged with the weapon that dealt it');
    assert.equal(tri.fighters[0].stamina, 100 - 30, 'and the thrust cost the trident\'s price'); assert.equal(sword.fighters[0].stamina, 100 - MOVES.thrust.stamina);
    // Legality reads the fighter's own table: with 25 stamina the longsword can thrust, the trident cannot.
    const poor = (w: 'longsword' | 'trident') => { const d = duel(1.5, w); d.fighters[0] = { ...d.fighters[0], stamina: 25 }; return legal(d.fighters[0], 'thrust'); };
    assert.equal(poor('longsword'), true); assert.equal(poor('trident'), false);
    assert.equal(weaponOf('trident').reach, 2.5);
  } finally { WEAPONS.trident = before.weapon; bladePaths.trident = before.paths; }
});

test('contact events name the weapon and its material for the audio lane: Hit, Blocked, Parried and GuardBroken', () => {
  const light = MOVES.light_right, heavy = MOVES.heavy_overhead;
  const hold = (): Intent => ({ ...idle(), guard: true });
  const hit = run(stepDuel(duel(1.2), [act('light'), idle()]), light.windup).events.find(e => e.type === 'Hit')!;
  const blocked = run(stepDuel(duel(1.2), [act('light'), hold()]), light.windup, idle(), hold()).events.find(e => e.type === 'Blocked')!;
  let p = run(stepDuel(duel(1.2), [act('light'), idle()]), light.windup - 9); p = run(stepDuel(p, [idle(), { ...act('parry'), guard: true }]), 8, idle(), hold());
  const parried = p.events.find(e => e.type === 'Parried')!;
  let g = run(stepDuel(duel(1.2), [idle(), hold()]), 5, idle(), hold()); g = { ...g, fighters: [g.fighters[0], { ...g.fighters[1], stamina: 5 }] } as Duel;
  const broken = run(stepDuel(g, [act('heavy'), hold()]), heavy.windup, idle(), hold()).events.find(e => e.type === 'GuardBroken')!;
  for (const [name, e] of [['Hit', hit], ['Blocked', blocked], ['Parried', parried], ['GuardBroken', broken]] as const) { assert.ok(e, `${name} happened`); assert.deepEqual([e.weapon, e.material], ['longsword', 'iron'], `${name} carries the attacker's weapon and material`); }
});

test('the bake manifest is sound: every entry names a known weapon, an existing rig and node, a rising contact segment; every non-placeholder weapon has a baked table with all of its paths', () => {
  const manifest = JSON.parse(readFileSync(new URL('../scripts/blade-manifest.json', import.meta.url), 'utf8')) as { weapons: { weapon: string; glb: string; node: string; contact: [number, number] }[] };
  assert.ok(manifest.weapons.length >= 1);
  for (const entry of manifest.weapons) {
    assert.ok(entry.weapon in WEAPONS, `${entry.weapon} is a weapon`);
    const bytes = readFileSync(new URL('../' + entry.glb, import.meta.url)); const size = bytes.readUInt32LE(12), json = JSON.parse(bytes.subarray(20, 20 + size).toString());
    assert.ok(json.nodes.some((n: { name: string }) => n.name === entry.node), `${entry.glb} has node ${entry.node}`);
    assert.ok(entry.contact[1] > entry.contact[0] && entry.contact[0] >= 0, 'a rising contact segment');
  }
  for (const [id, w] of Object.entries(WEAPONS)) { if (w.placeholder) continue; assert.ok(bladePaths[id], `${id} has a baked table`); for (const path of Object.keys(w.paths)) assert.ok(bladePaths[id][path]?.length, `${id}/${path} baked`); }
});

test('the warden reasons with its own weapon\'s reach: carrying a longer weapon it throws the thrust from where the longsword would only walk in', async () => {
  const { decide, initialAi } = await import('../src/ai.ts'); const { PROFILES } = await import('../src/moves.ts');
  const before = WEAPONS.trident; WEAPONS.trident = { ...LONGSWORD, id: 'trident', reach: 2.6, moves: { ...MOVES, thrust: { ...MOVES.thrust, reach: 2.6 } } };
  try {
    const arena = (weapon: 'longsword' | 'trident'): Duel => ({ tick: 0, fighters: [createFighter({ x: 0, z: TARGET.z + 2.3, heading: Math.PI, distance: 0 }, 'ready'), createFighter({ ...TARGET, heading: 0, distance: 0 }, 'ready', weapon)], finish: null, events: [] });
    const state = { ...initialAi(3), mode: 'approach' as const, decision: 500, wait: 0, next: 'thrust' as const, habits: { ...initialAi().habits, attacks: 1 } };
    assert.equal(decide(arena('trident'), 1, state, PROFILES.normal).intent.action, 'thrust', 'in reach for the trident: thrown');
    assert.equal(decide(arena('longsword'), 1, state, PROFILES.normal).intent.action, null, 'out of reach for the longsword: not thrown');
  } finally { WEAPONS.trident = before; }
});

// ── The trident (weapons lane, 2026-09-16): its rig, clips, contact segment and the fight it gives.
import { AnimationMixer, Quaternion, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { swingProgress } from '../src/blade.ts';
import { RULES, TRIDENT, TRIDENT_PATHS, total } from '../src/moves.ts';

const TRIDENT_GLB = 'src/assets/weapons/trident/veteran-trident.glb';
async function readRig(file: string) { // the rig without its images (the bake reads it the same way)
  (globalThis as { ProgressEvent?: unknown }).ProgressEvent ??= class { constructor(_: string, fields: object) { Object.assign(this, fields); } };
  const bytes = readFileSync(new URL('../' + file, import.meta.url)), size = bytes.readUInt32LE(12), json = JSON.parse(bytes.subarray(20, 20 + size).toString());
  json.images = []; json.textures = []; json.materials = json.materials.map((m: { name: string }) => ({ name: m.name }));
  json.buffers[0].uri = 'data:application/octet-stream;base64,' + bytes.subarray(28 + size).toString('base64');
  return new GLTFLoader().parseAsync(JSON.stringify(json), '');
}
const TRIDENT_CLIPS: Record<string, number> = { Trident_Idle: 1.667, Trident_Walk: 1.333, Trident_StrafeLeft: .8, Trident_StrafeRight: .8, Trident_Thrust: 1, Trident_ThrustChain: 1, Trident_Sweep: 1, Trident_High: 1, Trident_Guard: 1, Trident_BlockImpact: 1, Trident_Deflected: 1, Trident_Hit: .333, Trident_Death: 2.4 };

test('the trident rig carries WeaponDrawn with a contact segment on the tines (the manifest agrees), empty sword nodes for the loader, and the full clip set at the contract durations', async () => {
  const asset = await readRig(TRIDENT_GLB), weapon = asset.scene.getObjectByName('WeaponDrawn')!;
  assert.ok(weapon, 'WeaponDrawn'); assert.equal(weapon.parent?.name, 'hand_r');
  const contact = weapon.userData.contact as { from: number; to: number };
  assert.ok(contact && contact.to > contact.from && contact.to - contact.from < .6 && contact.from > .5, `extras.contact = the tines (a head, not the shaft): ${JSON.stringify(contact)}`);
  const manifest = JSON.parse(readFileSync(new URL('../scripts/blade-manifest.json', import.meta.url), 'utf8')) as { weapons: { weapon: string; glb: string; node: string; contact: [number, number] }[] };
  const entry = manifest.weapons.find(w => w.weapon === 'trident')!;
  assert.deepEqual([entry.glb, entry.node], [TRIDENT_GLB, 'WeaponDrawn']);
  assert.ok(Math.abs(entry.contact[0] - contact.from) < .001 && Math.abs(entry.contact[1] - contact.to) < .001, 'manifest and rig name the same segment');
  for (const name of ['SwordDrawn', 'SwordSheathed']) { const node = asset.scene.getObjectByName(name)!; assert.ok(node, name); assert.equal(node.children.length, 0, `${name} carries nothing`); }
  for (const [name, duration] of Object.entries(TRIDENT_CLIPS)) {
    const clip = asset.animations.find(c => c.name === name)!;
    assert.ok(clip, name); assert.ok(Math.abs(clip.duration - duration) < .002, `${name} ${clip.duration}s`);
    assert.ok(clip.tracks.every(t => t.values.every(Number.isFinite)));
    if (['Trident_Idle', 'Trident_Walk', 'Trident_StrafeLeft', 'Trident_StrafeRight'].includes(name)) for (const track of clip.tracks) { const n = track.getValueSize(); assert.ok([...track.values.slice(0, n)].every((v, i) => Math.abs(v - track.values[track.values.length - n + i]) < 1e-5), `${name} loops seamlessly`); }
  }
  for (const [path, spec] of Object.entries(TRIDENT_PATHS)) assert.ok(asset.animations.some(c => c.name === spec.clip), `${path} → ${spec.clip} exists`);
});

test('the trident\'s authored clips agree with the data\'s contact ticks: at each path\'s contact key the tines are out in front, at the height the move means (chest for thrusts, knee for the sweep, torso for the pin)', async () => {
  const asset = await readRig(TRIDENT_GLB), mixer = new AnimationMixer(asset.scene), weapon = asset.scene.getObjectByName('WeaponDrawn')!, contact = weapon.userData.contact as { from: number; to: number };
  // [min tip z, min tip y, max tip y]: the sword's own contact tips are 1.10–1.14 out (bake), so the trident's must be at least the sword's.
  const bands: Record<string, [number, number, number]> = { thrust: [1.25, 1.0, 1.4], riposte: [1.25, 1.0, 1.4], light_right: [1.1, .4, .75], light_left: [1.1, .4, .75], light_right_chain: [1.1, .4, .75], light_left_chain: [1.1, .4, .75], heavy_overhead: [1.15, .6, 1.1], heavy_overhead_chain: [1.15, .6, 1.1], heavy_riposte: [1.15, .6, 1.1] };
  for (const [path, spec] of Object.entries(TRIDENT_PATHS)) {
    const clip = asset.animations.find(c => c.name === spec.clip)!, action = mixer.clipAction(clip).play(), n = total(spec);
    mixer.setTime(clip.duration * swingProgress(spec.windup / n, spec.windup / n, spec.source)); asset.scene.updateMatrixWorld(true);
    const tip = weapon.localToWorld(new Vector3(0, contact.to, 0)), root = weapon.localToWorld(new Vector3(0, contact.from, 0)), [minZ, minY, maxY] = bands[path];
    assert.ok(tip.z > minZ && tip.y > minY && tip.y < maxY && Math.abs(tip.x) < .6, `${path} (${spec.clip} @${spec.source}) tip ${tip.toArray().map(v => v.toFixed(2))}`);
    assert.ok(root.z > .5, `${path} the tines' root is in front of the body: ${root.z.toFixed(2)}`);
    action.stop(); mixer.uncacheClip(clip);
  }
});

test('the fight the trident gives (real tables): its thrust lands from 2.1 m where the longsword\'s whiffs (a short pole, driven to full arm extension), and the AI-facing reach of every move sits within 0.1 m of where it really lands', () => {
  const landsFrom = (weapon: 'longsword' | 'trident', move: 'thrust' | 'light_right' | 'heavy_overhead', gap: number) => {
    const m = WEAPONS[weapon].moves[move], action = move === 'thrust' ? 'thrust' : move === 'heavy_overhead' ? 'heavy' : 'light';
    return run(stepDuel(duel(gap, weapon), [act(action), idle()]), m.windup + m.active + 1).events;
  };
  const landed = (events: Duel['events']) => events.some(e => e.type === 'Hit');
  assert.ok(!landed(landsFrom('longsword', 'thrust', 2.1)) && landsFrom('longsword', 'thrust', 2.1).some(e => e.type === 'AttackMissed'), 'the longsword whiffs from 2.1 m');
  const hit = landsFrom('trident', 'thrust', 2.1).find(e => e.type === 'Hit');
  assert.ok(hit, 'the trident lands from 2.1 m'); assert.deepEqual([hit!.weapon, hit!.material], ['trident', 'bronze']);
  // Every `reach` is the measured landing frontier (±0.1 m) against a standing target, not a wish: the warden spaces by it.
  for (const move of ['thrust', 'light_right', 'heavy_overhead'] as const) {
    const reach = TRIDENT.moves[move].reach;
    assert.ok(landed(landsFrom('trident', move, reach - .1)), `${move} lands from reach−0.1 (${(reach - .1).toFixed(2)} m)`);
    assert.ok(!landed(landsFrom('trident', move, reach + .1)), `${move} does not land from reach+0.1 (${(reach + .1).toFixed(2)} m)`);
  }
  // Not in the data (a rule, requested of the combat lane): a thrust whiffing inside the point. The sim sweeps the tines from the
  // wind-up pose, so today the trident's thrust lands from 0.4 m exactly like the sword's.
  assert.ok(landed(landsFrom('trident', 'thrust', .8)) === landed(landsFrom('longsword', 'thrust', .8)), 'inside the point both weapons behave alike until a rule says otherwise');
  assert.equal(weaponOf('trident'), TRIDENT); assert.equal(TRIDENT.reach, TRIDENT.moves.thrust.reach);
});

// ── The cleaver (weapons lane, 2026-09-16): the Pitborn's, on the longsword's clip family.
import { CLEAVER, CLEAVER_PATHS } from '../src/moves.ts';
const CLEAVER_GLB = 'src/assets/weapons/cleaver/veteran-cleaver.glb';

test('the cleaver rig carries WeaponDrawn with its edge as the contact segment (the manifest agrees), empty sword nodes for the loader, and exactly the sword\'s 21 clips — nothing for the renderer to learn', async () => {
  const asset = await readRig(CLEAVER_GLB), weapon = asset.scene.getObjectByName('WeaponDrawn')!;
  assert.ok(weapon, 'WeaponDrawn'); assert.equal(weapon.parent?.name, 'hand_r');
  const contact = weapon.userData.contact as { from: number; to: number };
  assert.ok(contact && Math.abs(contact.to - .86) < .001 && contact.from > .1 && contact.from < .2, `the edge, ferrule to tip, the sword's length: ${JSON.stringify(contact)}`);
  const manifest = JSON.parse(readFileSync(new URL('../scripts/blade-manifest.json', import.meta.url), 'utf8')) as { weapons: { weapon: string; glb: string; node: string; contact: [number, number] }[] };
  const entry = manifest.weapons.find(w => w.weapon === 'cleaver')!;
  assert.deepEqual([entry.glb, entry.node], [CLEAVER_GLB, 'WeaponDrawn']); assert.ok(Math.abs(entry.contact[0] - contact.from) < .001 && Math.abs(entry.contact[1] - contact.to) < .001);
  for (const name of ['SwordDrawn', 'SwordSheathed']) { const node = asset.scene.getObjectByName(name)!; assert.ok(node, name); assert.equal(node.children.length, 0, `${name} carries nothing`); }
  const sword = await readRig('src/assets/veteran.glb');
  assert.deepEqual(asset.animations.map(c => c.name), sword.animations.map(c => c.name), 'the same clip list as the sword Veteran, in the same order (the renderer plays by position)');
  for (const [path, spec] of Object.entries(CLEAVER_PATHS)) assert.ok(['Attack', 'Return', 'Heavy', 'Riposte'].includes(spec.clip), `${path} rides a sword clip`);
  // Only the Heavy is re-keyed (the diagonal hack); every other clip is the Veteran's, track for track.
  for (const clip of sword.animations) { const twin = asset.animations.find(c => c.name === clip.name)!; const same = clip.tracks.every(t => { const o = twin.tracks.find(x => x.name === t.name)!; return o && o.times.length === t.times.length && Array.from(t.values).every((v, i) => Math.abs(v - o.values[i]) < 1e-6); }); assert.equal(same, clip.name !== 'Heavy', `${clip.name} ${clip.name === 'Heavy' ? 'is the cleaver\'s own' : 'is the sword Veteran\'s'}`); }
});

test('the cleaver\'s edge leads: over each cut\'s active window the tip moves along the edge side (+x) for the chop and the hack, and along the spine for the back-of-the-cleaver; the hack leads with the edge more cleanly than the sword\'s straight overhead', async () => {
  const lead = async (file: string, node: string) => {
    const asset = await readRig(file), mixer = new AnimationMixer(asset.scene), blade = asset.scene.getObjectByName(node)!, out: Record<string, number> = {};
    for (const [kind, spec] of Object.entries(CLEAVER_PATHS)) {
      if (kind.endsWith('_chain') || kind === 'thrust' || kind === 'riposte') continue;   // a thrust's tip barely moves in its active window: the point leads, not a side
      const n = total(spec), clip = asset.animations.find(c => c.name === spec.clip)!, action = mixer.clipAction(clip).play();
      const at = (age: number) => { mixer.setTime(Math.min(.999999, swingProgress(age / n, spec.windup / n, spec.source)) * clip.duration); asset.scene.updateMatrixWorld(true); return { tip: blade.localToWorld(new Vector3(0, .86, 0)), q: blade.getWorldQuaternion(new Quaternion()) }; };
      const a = at(spec.windup), b = at(spec.windup + spec.active), v = b.tip.clone().sub(a.tip).normalize(), edge = new Vector3(1, 0, 0).applyQuaternion(at(spec.windup + Math.floor(spec.active / 2)).q);
      out[kind] = edge.dot(v); action.stop(); mixer.uncacheClip(clip);
    }
    return out;
  };
  const cleaver = await lead(CLEAVER_GLB, 'WeaponDrawn'), sword = await lead('src/assets/veteran.glb', 'SwordDrawn');
  assert.ok(cleaver.light_right > .6, `the chop leads with the edge: ${cleaver.light_right.toFixed(2)}`);
  assert.ok(cleaver.light_left < -.6, `the back of the cleaver leads with the spine: ${cleaver.light_left.toFixed(2)}`);
  assert.ok(cleaver.heavy_overhead > .85 && cleaver.heavy_overhead > sword.heavy_overhead + .15, `the hack leads with the edge (${cleaver.heavy_overhead.toFixed(2)}) more than the sword's overhead (${sword.heavy_overhead.toFixed(2)})`);
  assert.ok(cleaver.heavy_riposte > .85, `the heavy riposte on the same clip: ${cleaver.heavy_riposte.toFixed(2)}`);
});

test('the fight the cleaver gives (real tables): the same length as the sword — its chop, hack and poke land from where the sword\'s cut, heavy and stab do (±0.05 m) — with the sword\'s lunges, so the Pitborn\'s whiff window survives (tests/opponents.test.ts is the gate)', () => {
  const frontier = (weapon: 'longsword' | 'cleaver', move: 'thrust' | 'light_right' | 'heavy_overhead') => {
    const m = WEAPONS[weapon].moves[move], action = move === 'thrust' ? 'thrust' : move === 'heavy_overhead' ? 'heavy' : 'light'; let last = 0;
    for (let g = .4; g <= 2.8; g += .05) if (run(stepDuel(duel(+g.toFixed(2), weapon), [act(action), idle()]), m.windup + m.active + 1).events.some(e => e.type === 'Hit')) last = +g.toFixed(2);
    return last;
  };
  for (const move of ['thrust', 'light_right', 'heavy_overhead'] as const) {
    const s = frontier('longsword', move), c = frontier('cleaver', move);
    assert.ok(Math.abs(c - s) <= .051, `${move}: cleaver lands to ${c} m, sword to ${s} m`);
    const sm = MOVES[move], cm = CLEAVER.moves[move];
    assert.ok(Math.abs(cm.stepIn * (cm.windup - RULES.stepInFrom) - sm.stepIn * (sm.windup - RULES.stepInFrom)) < .3, `${move}: the same lunge distance as the sword's (stepIn × wind-up ticks)`);
    assert.equal(cm.reach, sm.reach, `${move}: the sword's spacing estimate, so the warden spaces the same`);
  }
  assert.ok(CLEAVER.moves.light_right.damage > MOVES.light_right.damage && CLEAVER.moves.heavy_overhead.damage > MOVES.heavy_overhead.damage && CLEAVER.moves.thrust.damage < MOVES.thrust.damage, 'chops hit harder, the poke softer');
  assert.ok(CLEAVER.moves.light_left.damage < CLEAVER.moves.light_right.damage && CLEAVER.moves.light_left.posture > CLEAVER.moves.light_right.posture, 'the back of the cleaver: a hammer, not a cut');
  assert.deepEqual([CLEAVER.guard, CLEAVER.material, weaponOf('cleaver')], ['blade', 'iron', CLEAVER]);
});
