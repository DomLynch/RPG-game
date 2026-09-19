// The weapon slot: a fighter carries a weapon, and every move / path / reach lookup goes through it. No balance change: on trunk
// both fighters carry the longsword and the trident entry borrows its data until the weapons lane lands the real one.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { bladePaths } from '../src/blade-paths.ts';
import { createFighter, idleIntent, initialDuel, legal, movesOf, stepDuel, type Duel, type Intent } from '../src/duel.ts';
import { LONGSWORD, MOVES, PATHS, RULES, WEAPONS, weaponOf, type Weapon } from '../src/moves.ts';
import { TARGET } from '../src/sim.ts';

const idle = (): Intent => ({ ...idleIntent(), lock: false });
const act = (action: Intent['action']): Intent => ({ ...idle(), action });
const duel = (gap: number, weapon: Weapon['id'] = 'longsword'): Duel => ({ tick: 0, fighters: [createFighter({ x: 0, z: TARGET.z + gap, heading: Math.PI, distance: 0 }, 'ready', weapon), createFighter({ ...TARGET, heading: 0, distance: 0 }, 'ready')], finish: null, events: [] });
// Steps n ticks and returns the final duel with every tick's events gathered (stepDuel only carries the current tick's).
const run = (d: Duel, n: number, a = idle(), b = idle()) => { const events: Duel['events'] = []; for (let i = 0; i < n; i++) { d = stepDuel(d, [a, b]); events.push(...d.events); } return { ...d, events }; };

test('the live duel: the player carries the longsword and the Veteran the trident (slice V); the trident is its own table, guard and stance', () => {
  const d = initialDuel();
  assert.deepEqual(d.fighters.map(f => f.weapon), ['longsword', 'trident']);
  assert.equal(d.fighters[0].guardProfile, undefined, 'the sword guard is the RULES default'); assert.deepEqual(d.fighters[1].guardProfile, { costScale: 1.15, heavyBreaks: true }, 'the shaft guard comes from the weapon');
  assert.deepEqual([LONGSWORD.fight, WEAPONS.trident.fight], [{ thrustShare: .2, close: 1.15 }, { thrustShare: .6, close: 1.4 }]);
  assert.equal(WEAPONS.trident.moves.thrust.minReach, 1); assert.equal(MOVES.thrust.minReach, undefined, 'a sword stabs at any range');
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
import { TRIDENT, TRIDENT_PATHS, total } from '../src/moves.ts';

const TRIDENT_GLB = 'src/assets/veteran.glb';   // the shipped Veteran carries the trident (built with WARRIOR_WEAPON=trident, the veteran default)
async function readRig(file: string) { // the rig without its images (the bake reads it the same way)
  (globalThis as { ProgressEvent?: unknown }).ProgressEvent ??= class { constructor(_: string, fields: object) { Object.assign(this, fields); } };
  const bytes = readFileSync(new URL('../' + file, import.meta.url)), size = bytes.readUInt32LE(12), json = JSON.parse(bytes.subarray(20, 20 + size).toString());
  json.images = []; json.textures = []; json.materials = json.materials.map((m: { name: string }) => ({ name: m.name }));
  json.buffers[0].uri = 'data:application/octet-stream;base64,' + bytes.subarray(28 + size).toString('base64');
  return new GLTFLoader().parseAsync(JSON.stringify(json), '');
}
const TRIDENT_CLIPS: Record<string, number> = { Trident_Idle: 1.667, Trident_Walk: 1.333, Trident_StrafeLeft: .8, Trident_StrafeRight: .8, Trident_Thrust: 1, Trident_ThrustChain: 1, Trident_Sweep: 1, Trident_High: 1, Trident_Guard: 1, Trident_BlockImpact: 1, Trident_Deflected: 1, Trident_Hit: .333, Trident_Death: 2.4 };

test('polearm elbows bend outwards in the ready gaits and keep their anatomical hinge through every clip, including between keys', async () => {
  for (const file of [TRIDENT_GLB, 'src/assets/executioner.glb', 'src/assets/weapons/scythe/warrior-scythe.glb']) {
    const asset = await readRig(file), mixer = new AnimationMixer(asset.scene);
    const arms = ['l', 'r'].map(side => ({ side, upper: asset.scene.getObjectByName(`upperarm_${side}`)!, lower: asset.scene.getObjectByName(`lowerarm_${side}`)!, hand: asset.scene.getObjectByName(`hand_${side}`)! }));
    // Measure the bend plane in upper-arm coordinates: independent of root scale,
    // shoulder placement and camera angle. The original library stance supplies
    // the rig's anatomical hinge, not the weapon author's preferred bend pole.
    const hinge = ({ upper, lower, hand }: typeof arms[number]) => {
      const elbow = upper.worldToLocal(lower.getWorldPosition(new Vector3()));
      const wrist = upper.worldToLocal(hand.getWorldPosition(new Vector3()));
      return elbow.clone().cross(wrist.sub(elbow)).normalize();
    };
    mixer.clipAction(asset.animations.find(c => c.name === 'Armed')!).play(); mixer.setTime(0); asset.scene.updateMatrixWorld(true);
    const hinges = arms.map(hinge); mixer.stopAllAction();
    for (const clip of asset.animations.filter(c => /^(Trident|Scythe)_/.test(c.name))) {
      mixer.clipAction(clip).play();
      for (let t = 0; t < clip.duration; t += 1 / 120) {
        mixer.setTime(t); asset.scene.updateMatrixWorld(true);
        for (const [i, arm] of arms.entries()) {
          const label = `${file} ${clip.name}@${t.toFixed(3)} ${arm.side}`;
          assert.ok(hinge(arm).dot(hinges[i]) > .97, `${label}: elbow crease must follow the bend, never roll backwards`);
          if (/_(Idle|Walk|StrafeLeft|StrafeRight)$/.test(clip.name)) {
            const start = arm.upper.getWorldPosition(new Vector3()), direction = arm.hand.getWorldPosition(new Vector3()).sub(start).normalize();
            const offset = arm.lower.getWorldPosition(new Vector3()).sub(start); offset.addScaledVector(direction, -offset.dot(direction));
            assert.ok(offset.x * (arm.side === 'l' ? 1 : -1) > .001, `${label}: elbow must sit outside the shoulder–wrist line`);
          }
        }
      }
      mixer.stopAllAction();
    }
  }
});

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
  const bands: Record<string, [number, number, number]> = { slash_riposte: [1.1, .4, .75], thrust: [1.25, 1.0, 1.4], riposte: [1.25, 1.0, 1.4], light_right: [1.1, .4, .75], light_left: [1.1, .4, .75], light_right_chain: [1.1, .4, .75], light_left_chain: [1.1, .4, .75], heavy_overhead: [1.15, .6, 1.1], heavy_overhead_chain: [1.15, .6, 1.1], heavy_riposte: [1.15, .6, 1.1] };
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
  // Weak inside the point (slice V, MoveDef.minReach): inside 1 m (two bodies stand no closer than .85) the trident's thrust meets nothing and
  // stalls like any whiff; the sword's stab still lands there, and the trident's sweep has no such hole.
  assert.ok(landed(landsFrom('longsword', 'thrust', .9)), 'the sword stabs from .9 m');
  const inside = landsFrom('trident', 'thrust', .9);
  assert.ok(!landed(inside) && inside.some(e => e.type === 'AttackMissed' && e.move === 'thrust'), 'the trident thrust whiffs inside the point');
  assert.ok(landed(landsFrom('trident', 'thrust', 1.1)) && landed(landsFrom('trident', 'light_right', .9)), 'from 1.1 m it lands; the sweep lands at .9 m');
  assert.equal(weaponOf('trident'), TRIDENT); assert.equal(TRIDENT.reach, TRIDENT.moves.thrust.reach);
});

// ── The cleaver (weapons lane, 2026-09-16): the Pitborn's, on the longsword's clip family — ON THE SHELF. The weapons lane delivers
// the part, the rig, the data and the proof; the combat lane flips `WEAPONS.cleaver` to CLEAVER, adds the manifest entry, bakes and
// reviews the fight (artifacts/weapons/REQUESTS.md §5–6). Until then the Pitborn's slot borrows the longsword, exactly as before.
import { CLEAVER, CLEAVER_PATHS, OPPONENTS } from '../src/moves.ts';
const CLEAVER_GLB = 'src/assets/weapons/cleaver/veteran-cleaver.glb';

test('the cleaver is live (slice W): WEAPONS.cleaver is CLEAVER, the Pitborn carries it, and it is baked at a man\'s 1.0× from veteran-cleaver.glb (his sword\'s convention: the rendered blade runs past the simulated one, never the other way)', () => {
  assert.equal(WEAPONS.cleaver, CLEAVER); assert.equal(WEAPONS.cleaver.placeholder, undefined); assert.equal(OPPONENTS.pitborn.weapon, 'cleaver');
  assert.notEqual(CLEAVER.moves, MOVES); assert.notEqual(CLEAVER.paths, PATHS); assert.equal(CLEAVER.id, 'cleaver');
  assert.notDeepEqual(bladePaths.cleaver, bladePaths.longsword); assert.deepEqual(Object.keys(bladePaths.cleaver).sort(), Object.keys(CLEAVER.paths).sort(), 'every cleaver path baked');
  const manifest = JSON.parse(readFileSync(new URL('../scripts/blade-manifest.json', import.meta.url), 'utf8')) as { weapons: { weapon: string; glb: string; node: string; contact: [number, number] }[] };
  const entry = manifest.weapons.find(w => w.weapon === 'cleaver')!;
  assert.deepEqual(entry, { weapon: 'cleaver', glb: CLEAVER_GLB, node: 'WeaponDrawn', contact: [.14, .86] });
});

test('the cleaver rig carries WeaponDrawn with its edge as the contact segment, empty sword nodes for the loader, and exactly the sword\'s 21 clips in the sword\'s order — nothing for the renderer to learn; only Heavy is re-keyed', async () => {
  const asset = await readRig(CLEAVER_GLB), weapon = asset.scene.getObjectByName('WeaponDrawn')!;
  assert.ok(weapon, 'WeaponDrawn'); assert.equal(weapon.parent?.name, 'hand_r');
  const contact = weapon.userData.contact as { from: number; to: number };
  assert.ok(contact && Math.abs(contact.to - .86) < .001 && contact.from > .1 && contact.from < .2, `the edge, ferrule to tip, the sword's length: ${JSON.stringify(contact)}`);
  for (const name of ['SwordDrawn', 'SwordSheathed']) { const node = asset.scene.getObjectByName(name)!; assert.ok(node, name); assert.equal(node.children.length, 0, `${name} carries nothing`); }
  const sword = await readRig('src/assets/warrior.glb');
  assert.deepEqual(asset.animations.map(c => c.name), sword.animations.map(c => c.name), 'the same clip list as the sword, in the same order');
  for (const [path, spec] of Object.entries(CLEAVER_PATHS)) assert.ok(['Attack', 'Return', 'Heavy', 'Riposte'].includes(spec.clip), `${path} rides a sword clip`);
  for (const clip of sword.animations) { // every clip is the rig's own, track for track, except the Heavy (the diagonal hack)
    const twin = asset.animations.find(c => c.name === clip.name)!;
    const same = clip.tracks.every(t => { const o = twin.tracks.find(x => x.name === t.name)!; return o && o.times.length === t.times.length && Array.from(t.values).every((v, i) => Math.abs(v - o.values[i]) < 1e-6); });
    assert.equal(same, clip.name !== 'Heavy', `${clip.name} ${clip.name === 'Heavy' ? 'is the cleaver\'s own' : 'is the sword rig\'s'}`);
  }
});

test('the cleaver\'s edge leads: over each cut\'s active window the tip moves along the edge side (+x) for the chop and the hack, along the spine for the back-of-the-cleaver; the hack leads with the edge more cleanly than the sword\'s straight overhead', async () => {
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
  const cleaver = await lead(CLEAVER_GLB, 'WeaponDrawn'), sword = await lead('src/assets/warrior.glb', 'SwordDrawn');
  assert.ok(cleaver.light_right > .6, `the chop leads with the edge: ${cleaver.light_right.toFixed(2)}`);
  assert.ok(cleaver.light_left < -.6, `the back of the cleaver leads with the spine: ${cleaver.light_left.toFixed(2)}`);
  assert.ok(cleaver.heavy_overhead > .85 && cleaver.heavy_overhead > sword.heavy_overhead + .15, `the hack leads with the edge (${cleaver.heavy_overhead.toFixed(2)}) more than the sword's overhead (${sword.heavy_overhead.toFixed(2)})`);
  assert.ok(cleaver.heavy_riposte > .85, `the heavy riposte on the same clip: ${cleaver.heavy_riposte.toFixed(2)}`);
});

test('the cleaver\'s data keeps the Pitborn\'s whiff window: lunges equal the sword\'s (stepIn × wind-up), reach follows the sword\'s spacing convention, chops hit harder, the poke softer, the back of the cleaver is a hammer', () => {
  for (const move of ['thrust', 'light_right', 'heavy_overhead'] as const) {
    const sm = MOVES[move], cm = CLEAVER.moves[move];
    assert.ok(Math.abs(cm.stepIn * (cm.windup - RULES.stepInFrom) - sm.stepIn * (sm.windup - RULES.stepInFrom)) < .3, `${move}: the same lunge distance as the sword's — the 12-tick backstep must still escape it`);
    assert.equal(cm.reach, sm.reach, `${move}: the sword's spacing estimate, so the warden spaces the same`);
    assert.ok(cm.windup >= sm.windup && cm.recovery >= sm.recovery, `${move}: a brute's tell and recovery are no shorter than the sword's`);
  }
  assert.ok(CLEAVER.moves.light_right.damage > MOVES.light_right.damage && CLEAVER.moves.heavy_overhead.damage > MOVES.heavy_overhead.damage && CLEAVER.moves.thrust.damage < MOVES.thrust.damage, 'chops hit harder, the poke softer');
  assert.ok(CLEAVER.moves.light_left.damage < CLEAVER.moves.light_right.damage && CLEAVER.moves.light_left.posture > CLEAVER.moves.light_right.posture, 'the back of the cleaver: a hammer, not a cut');
  assert.deepEqual([CLEAVER.guard, CLEAVER.material, CLEAVER.fight.thrustShare < LONGSWORD.fight.thrustShare], ['blade', 'iron', true]);
});

// ── Slice V: the trident's fight — rules the data asked for, and the warden's stance with it ───────────────────────────────────────────
const events = (d: Duel, n: number, a: Intent, b: Intent) => run(d, n, a, b).events;
const guardIntent = (): Intent => ({ ...idle(), guard: true });

test('the shaft guard (slice V): blocks a cut and a thrust at 15 % more stamina than the blade guard, and a plain overhead heavy breaks it where the blade guard only takes chip', () => {
  // Side 0 attacks with the sword; side 1 (the target) holds its guard with the weapon under test. The guard is settled (age past the parry window) before the blow lands.
  const arena = (guardWeapon: 'longsword' | 'trident', gap: number): Duel => ({ tick: 0, fighters: [createFighter({ x: 0, z: TARGET.z + gap, heading: Math.PI, distance: 0 }, 'ready'), createFighter({ ...TARGET, heading: 0, distance: 0 }, 'ready', guardWeapon)], finish: null, events: [] });
  const settle = (d: Duel) => run(d, RULES.parry + 2, idle(), guardIntent());
  const blow = (guardWeapon: 'longsword' | 'trident', action: 'light' | 'thrust' | 'heavy') => { const m = action === 'heavy' ? MOVES.heavy_overhead : action === 'thrust' ? MOVES.thrust : MOVES.light_right; return events(settle(arena(guardWeapon, 1.2)), m.windup + m.active + 1, act(action), guardIntent()); };
  for (const [action, cost] of [['light', MOVES.light_right.staminaDamage], ['thrust', MOVES.thrust.staminaDamage]] as const) {
    const blade = blow('longsword', action).find(e => e.type === 'Blocked')!, shaft = blow('trident', action).find(e => e.type === 'Blocked')!;
    assert.ok(blade && shaft, `${action}: both guards block`); assert.equal(blade.stamina, cost); assert.equal(shaft.stamina, cost * 1.15, `${action}: the shaft pays 15 % more`);
  }
  const blade = blow('longsword', 'heavy'), shaft = blow('trident', 'heavy');
  assert.ok(blade.some(e => e.type === 'Blocked' && (e.damage ?? 0) > 0) && !blade.some(e => e.type === 'GuardBroken'), 'the blade guard takes a plain heavy for chip');
  assert.ok(shaft.some(e => e.type === 'GuardBroken') && !shaft.some(e => e.type === 'Blocked'), 'the shaft breaks under a plain heavy');
});

test('the sweep trips a roll (slice V): a low blade lands on a roller in the roll\'s first half, the same roll escapes it in the second half and escapes the kick as ever', () => {
  // Side 0 carries the trident and sweeps (or kicks) at tick 0; side 1 rolls into it (a roll away or aside simply outruns a blow started this close) `delay`
  // ticks later. At the blow's first active tick the roller's age is read off the state.
  const arena = (gap: number): Duel => ({ tick: 0, fighters: [createFighter({ x: 0, z: TARGET.z + gap, heading: Math.PI, distance: 0 }, 'ready', 'trident'), createFighter({ ...TARGET, heading: 0, distance: 0 }, 'ready')], finish: null, events: [] });
  const play = (delay: number, attack: 'light' | 'kick', gap = 1.0) => {
    let d = arena(gap), rollAge = -1; const ev: Duel['events'] = [];
    for (let t = 0; t < 60; t++) {
      const prev = d;
      d = stepDuel(d, [t === 0 ? act(attack) : idle(), { ...idle(), action: t === delay ? 'dodge' : null, move: { x: 0, z: 1, yaw: 0, run: false } }]); ev.push(...d.events);
      if (d.events.some(e => e.type === 'AttackActive' && e.actor === 0)) rollAge = prev.fighters[1].phase === 'roll' ? prev.fighters[1].age + 1 : -1;   // the roller's age as the blow lands (a tripped roller is already 'hurt' after the tick)
    }
    return { ev, rollAge, types: ev.filter(e => e.actor === 0 || e.type === 'Dodged').map(e => e.type).join(',') };
  };
  const half = RULES.roll / 2, sweep = WEAPONS.trident.moves.light_right;
  const early = play(sweep.windup - 10, 'light'), late = play(sweep.windup - (half + 1), 'light');
  assert.ok(early.rollAge >= RULES.safeStart && early.rollAge < half, `early roll: age ${early.rollAge} at contact is in the first half and inside the i-frames`);
  assert.ok(late.rollAge >= half && late.rollAge <= RULES.safeEnd, `late roll: age ${late.rollAge} at contact is in the second half and inside the i-frames`);
  assert.ok(early.ev.some(e => e.type === 'Hit' && e.trip && e.move === 'light_right' && e.actor === 0) && !early.ev.some(e => e.type === 'Dodged'), `first half of the roll: tripped (${early.types})`);
  assert.ok(late.ev.some(e => e.type === 'Dodged') && !late.ev.some(e => e.type === 'Hit'), `second half: rolled through (${late.types})`);
  const kick = WEAPONS.trident.moves.kick, kicked = play(kick.windup - 10, 'kick', .9);
  assert.ok(kicked.rollAge >= RULES.safeStart && kicked.rollAge < half, `kick: roll age ${kicked.rollAge} at contact`);
  assert.ok(kicked.ev.some(e => e.type === 'Dodged') && !kicked.ev.some(e => e.type === 'Hit'), `the kick has no blade: rolled as before (${kicked.types})`);
});

test('the Veteran\'s stance (slice V): the trident warden opens with the thrust most of the time, closes to sweep range rather than the sword\'s, never thrusts inside the point — there it kicks, and steps back out when it cannot', async () => {
  const { decide, initialAi } = await import('../src/ai.ts'); const { PROFILES } = await import('../src/moves.ts');
  const arena = (gap: number, weapon: 'longsword' | 'trident', player: Partial<ReturnType<typeof createFighter>> = {}): Duel => ({ tick: 0, fighters: [{ ...createFighter({ x: 0, z: TARGET.z + gap, heading: Math.PI, distance: 0 }, 'ready'), ...player }, createFighter({ ...TARGET, heading: 0, distance: 0 }, 'ready', weapon)], finish: null, events: [] });
  // Openers: with the cadence due and the first heavy shown, count what each weapon decides to close in for over many seeds.
  const openers = (weapon: 'longsword' | 'trident') => { const n = { light: 0, heavy: 0, thrust: 0 }; for (let s = 1; s <= 300; s++) { const state = { ...initialAi(s * 7919), mode: 'approach' as const, decision: 500, wait: 0, next: null, habits: { ...initialAi().habits, attacks: 1 } }; const out = decide(arena(3, weapon), 1, state, PROFILES.normal).ai.next!; n[out]++; } return n; };
  const sword = openers('longsword'), pole = openers('trident');
  const nonLight = (n: typeof sword) => n.thrust / (n.thrust + n.heavy);
  assert.ok(nonLight(sword) > .1 && nonLight(sword) < .3, `the sword thrusts on a fifth of its non-cut openers: ${JSON.stringify(sword)}`);
  assert.ok(nonLight(pole) > .5 && nonLight(pole) < .7, `the trident thrusts on three fifths: ${JSON.stringify(pole)}`);
  // Closing distance for a cut: the sword walks in to 1.15 m, the trident stops at 1.4 (its sweep lands to 1.75, and inside .8 its point is useless).
  const closing = (weapon: 'longsword' | 'trident', gap: number) => decide(arena(gap, weapon), 1, { ...initialAi(5), mode: 'approach', decision: 500, wait: 500, next: null, habits: { ...initialAi().habits, attacks: 1 } }, PROFILES.normal).intent.move.z;   // no opener due: pure footwork
  assert.ok(closing('longsword', 1.3) > 0 && closing('trident', 1.3) === 0, 'at 1.3 m the sword still closes, the trident has arrived');
  assert.ok(closing('trident', 1.5) > 0, 'at 1.5 m the trident still closes');
  // Inside the point: a due thrust is not thrown; the kick is; with no kick to give the warden backsteps out.
  const state = { ...initialAi(11), mode: 'approach' as const, decision: 500, wait: 0, next: 'thrust' as const, habits: { ...initialAi().habits, attacks: 1 } };
  assert.equal(decide(arena(.6, 'trident'), 1, state, PROFILES.normal).intent.action, 'kick', 'inside .8 m: the kick, not the thrust');
  assert.equal(decide(arena(.6, 'longsword'), 1, state, PROFILES.normal).intent.action, 'thrust', 'the sword stabs from there');
  const spent = arena(.6, 'trident'); spent.fighters[1] = { ...spent.fighters[1], stamina: 24 };   // no kick (25) — a backstep is cheaper
  assert.equal(decide(spent, 1, state, PROFILES.normal).intent.action, 'backstep', 'no kick to give: step back out');
  assert.equal(decide(arena(1.6, 'trident'), 1, state, PROFILES.normal).intent.action, 'thrust', 'from 1.6 m the thrust is thrown');
  // Inside the window a landed blow earned the player (no kick yet), a due thrust is still not thrown from inside the point: the warden steps out.
  assert.equal(decide(arena(.6, 'trident'), 1, { ...state, retreatUntil: 1000 }, PROFILES.normal).intent.action, 'backstep', 'freshly hit and inside: out, never the thrust');
  assert.equal(decide(arena(.6, 'longsword'), 1, { ...state, retreatUntil: 1000 }, PROFILES.normal).intent.action, 'thrust', 'the sword has no point to be inside of');
  // The shaft guard is never raised to a plain heavy: seen coming, the answer is a roll (or a parry / a step out), as for a charged heavy.
  const heavy = arena(1.5, 'trident', { phase: 'attack', move: 'heavy_overhead', age: PROFILES.normal.reaction, lastMove: 'heavy_overhead', attackFrom: { x: 0, z: TARGET.z + 1.5, gap: 1.5 } });
  let blocks = 0; for (let s = 1; s <= 60; s++) { const plan = decide(heavy, 1, { ...initialAi(s * 104729), mode: 'approach', decision: 500, wait: 500, next: null }, PROFILES.normal).ai.plan; if (plan === 'block') blocks++; }
  assert.equal(blocks, 0, 'a plain heavy is never met with the shaft guard');
  const heavySword = { ...heavy, fighters: [heavy.fighters[0], createFighter({ ...TARGET, heading: 0, distance: 0 }, 'ready')] as Duel['fighters'] };
  let bladeBlocks = 0; for (let s = 1; s <= 60; s++) { const plan = decide(heavySword, 1, { ...initialAi(s * 104729), mode: 'approach', decision: 500, wait: 500, next: null }, PROFILES.normal).ai.plan; if (plan === 'block') bladeBlocks++; }
  assert.ok(bladeBlocks > 0, 'the blade guard still blocks a plain heavy sometimes');
});

// ── The knife (weapons lane, 2026-09-17): the goblin's sica. LIVE since slice X (combat lane): `WEAPONS.knife` is KNIFE, baked from the
// goblin's own rig (src/assets/goblin.glb carries it: WARRIOR_FIGHTER=goblin defaults to the knife), his stance and knobs set.
import { KNIFE, KNIFE_PATHS, OPPONENTS as OPP, type MoveId, type PathId } from '../src/moves.ts';
const KNIFE_GLB = 'src/assets/goblin.glb';

test('the knife is live (slice X): WEAPONS.knife is KNIFE, the goblin carries it, and it is baked from his own rig with the blade as the contact segment', () => {
  assert.equal(WEAPONS.knife, KNIFE); assert.equal(WEAPONS.knife.placeholder, undefined); assert.equal(OPP.goblin.weapon, 'knife');
  assert.notEqual(KNIFE.moves, MOVES); assert.notEqual(KNIFE.paths, PATHS); assert.equal(KNIFE.id, 'knife');
  assert.notDeepEqual(bladePaths.knife, bladePaths.longsword); assert.deepEqual(Object.keys(bladePaths.knife).sort(), Object.keys(KNIFE.paths).sort(), 'every knife path baked');
  const manifest = JSON.parse(readFileSync(new URL('../scripts/blade-manifest.json', import.meta.url), 'utf8')) as { weapons: { weapon: string; glb: string; node: string; contact: [number, number] }[] };
  assert.deepEqual(manifest.weapons.find(w => w.weapon === 'knife'), { weapon: 'knife', glb: KNIFE_GLB, node: 'WeaponDrawn', contact: [.12, .52] });
});

test('the goblin\'s rig carries the knife: WeaponDrawn under hand_r with a short blade as the contact segment and a forward grip, empty sword nodes, the sword\'s clip list in the sword\'s order, every knife path on a sword clip', async () => {
  const asset = await readRig(KNIFE_GLB), hero = await readRig('src/assets/warrior.glb'), weapon = asset.scene.getObjectByName('WeaponDrawn')!;
  assert.ok(weapon, 'WeaponDrawn'); assert.equal(weapon.parent?.name, 'hand_r');
  const contact = weapon.userData.contact as { from: number; to: number };
  assert.ok(contact && contact.to < .6 && contact.to > .45 && contact.from > .08 && contact.from < .2, `a short blade: ${JSON.stringify(contact)}`);
  assert.equal(weapon.userData.grip, 'forward', 'forward grip: the reverse grip never lands on the sword\'s clips');
  for (const name of ['SwordDrawn', 'SwordSheathed']) { const node = asset.scene.getObjectByName(name)!; assert.ok(node, name); assert.equal(node.children.length, 0, `${name} carries nothing`); }
  assert.deepEqual(asset.animations.map(c => c.name), [...['Idle', 'Walk', 'Jog', 'Run'], ...['Armed', 'Attack', 'Hit', 'Death', 'Draw', 'Roll', 'Guard', 'Return', 'Heavy', 'Riposte', 'ArmedWalk', 'StrafeLeft', 'StrafeRight', 'Kick', 'BlockImpact', 'Parry', 'Deflected'], ...['Death_SplitCrown', 'Death_RunThrough', 'Fin_RunThrough']], 'the sword\'s clip list, in order (the finishers are additive, 2026-09-17/18)');
  assert.ok(Math.abs(asset.scene.children[0].scale.x / hero.scene.children[0].scale.x - .835) < 1e-3, `his root scale: .835 × the hero's (${asset.scene.children[0].scale.x} / ${hero.scene.children[0].scale.x})`);
  for (const [path, spec] of Object.entries(KNIFE_PATHS)) assert.ok(['Attack', 'Return', 'Heavy', 'Riposte'].includes(spec.clip), `${path} rides a sword clip`);
});

test('the knife\'s edge leads on the goblin\'s rig: the slash and the hack move along the edge side; the backhand runs along the hook\'s sharpened back', async () => {
  const asset = await readRig(KNIFE_GLB), mixer = new AnimationMixer(asset.scene), blade = asset.scene.getObjectByName('WeaponDrawn')!, tip = (blade.userData.contact as { to: number }).to, out: Record<string, number> = {};
  for (const [kind, spec] of Object.entries(KNIFE_PATHS)) {
    if (kind.endsWith('_chain') || kind === 'thrust' || kind === 'riposte') continue;
    const n = total(spec), clip = asset.animations.find(c => c.name === spec.clip)!, action = mixer.clipAction(clip).play();
    const at = (age: number) => { mixer.setTime(Math.min(.999999, swingProgress(age / n, spec.windup / n, spec.source)) * clip.duration); asset.scene.updateMatrixWorld(true); return { tip: blade.localToWorld(new Vector3(0, tip, 0)), q: blade.getWorldQuaternion(new Quaternion()) }; };
    const a = at(spec.windup), b = at(spec.windup + spec.active), v = b.tip.clone().sub(a.tip).normalize(), edge = new Vector3(1, 0, 0).applyQuaternion(at(spec.windup + Math.floor(spec.active / 2)).q);
    out[kind] = edge.dot(v); action.stop(); mixer.uncacheClip(clip);
  }
  assert.ok(out.light_right > .6, `the slash leads with the edge: ${out.light_right.toFixed(2)}`);
  assert.ok(out.light_left < -.6, `the backhand leads with the hook's back (sharpened): ${out.light_left.toFixed(2)}`);
  assert.ok(out.heavy_overhead > .85 && out.heavy_riposte > .85, `the hack leads with the edge: ${out.heavy_overhead.toFixed(2)} / ${out.heavy_riposte.toFixed(2)}`);
});

test('the knife\'s data keeps the goblin\'s brief: every wind-up ≥ 12 ticks (readability), feints inside the first ~40 % of the wind-up, damage and cost below the sword\'s, reach below the sword\'s and rising from slash to stab to hack', () => {
  for (const [id, m] of Object.entries(KNIFE.moves)) {
    if (id === 'kick') continue;
    assert.ok(m.windup >= 12, `${id} wind-up ${m.windup} ≥ 12`);
    if (m.feintUntil) assert.ok(m.feintUntil <= Math.ceil(m.windup * .45) && m.feintUntil >= Math.floor(m.windup * .3), `${id} feintUntil ${m.feintUntil} of ${m.windup}`);
    assert.ok(m.damage <= MOVES[id as MoveId].damage && m.stamina <= MOVES[id as MoveId].stamina, `${id}: no more than a sword's damage and cost`);
    assert.ok(m.reach < MOVES[id as MoveId].reach, `${id}: shorter than a sword`);
  }
  for (const [path, spec] of Object.entries(KNIFE_PATHS)) assert.ok(spec.windup >= 12 && spec.windup <= PATHS[path as PathId].windup && total(spec) < total(PATHS[path as PathId]), `${path}: quicker than the sword, never under 12`);
  assert.ok(KNIFE.moves.light_right.reach < KNIFE.moves.thrust.reach && KNIFE.moves.thrust.reach < KNIFE.moves.heavy_overhead.reach);
  assert.deepEqual([KNIFE.guard, KNIFE.material, KNIFE.fight.thrustShare > LONGSWORD.fight.thrustShare, KNIFE.fight.close < LONGSWORD.fight.close], ['blade', 'iron', true, true]);
});

// The estoc is live: variant A on the shipped Nightborn and the same rig in the blade bake.
import { ESTOC, ESTOC_PATHS } from '../src/moves.ts';
const ESTOC_GLB = 'src/assets/weapons/estoc/nightborn-estoc.glb';

test('the live estoc uses its own moves, baked point, and the exact shipped Nightborn rig', () => {
  assert.equal(WEAPONS.estoc, ESTOC); assert.equal(WEAPONS.estoc.placeholder, undefined);
  assert.notEqual(ESTOC.moves, MOVES); assert.equal(ESTOC.paths, PATHS);
  assert.notDeepEqual(bladePaths.estoc, bladePaths.longsword);
  const manifest = JSON.parse(readFileSync(new URL('../scripts/blade-manifest.json', import.meta.url), 'utf8')) as { weapons: { weapon: string; glb: string; node: string; contact: number[] }[] };
  assert.deepEqual(manifest.weapons.filter(w => w.weapon === 'estoc'), [{ weapon: 'estoc', glb: ESTOC_GLB, node: 'WeaponDrawn', contact: [.75, 1.15] }]);
  assert.deepEqual(readFileSync(new URL('../' + ESTOC_GLB, import.meta.url)), readFileSync(new URL('../src/assets/nightborn.glb', import.meta.url)), 'bake and rendered rig must match');
});

test('the estoc rig is the Nightborn\'s own with WeaponDrawn (a long thin blade, the last 40 cm as the contact segment, ≤ 2k triangles), empty sword nodes, and EVERY clip byte-identical to nightborn.glb — no re-key at all', async () => {
  const asset = await readRig(ESTOC_GLB), own = await readRig('src/assets/nightborn.glb'), weapon = asset.scene.getObjectByName('WeaponDrawn')!;
  assert.ok(weapon, 'WeaponDrawn'); assert.equal(weapon.parent?.name, 'hand_r');
  const contact = weapon.userData.contact as { from: number; to: number };
  assert.ok(contact && Math.abs(contact.to - 1.15) < .001 && Math.abs(contact.from - .75) < .001, `the last 40 cm of a long blade: ${JSON.stringify(contact)}`);
  let triangles = 0; weapon.traverse(o => { const m = o as { isMesh?: boolean; geometry?: { index: { count: number } | null; attributes: { position: { count: number } } } }; if (m.isMesh && m.geometry) triangles += (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3; });
  assert.ok(triangles > 0 && triangles <= 2000, `≤ 2k triangles (the brief): ${triangles}`);
  for (const name of ['SwordDrawn', 'SwordSheathed']) { const node = asset.scene.getObjectByName(name)!; assert.ok(node, name); assert.equal(node.children.length, 0, `${name} carries nothing`); }
  assert.deepEqual(asset.animations.map(c => c.name), own.animations.map(c => c.name), 'his clip list, in order');
  for (const clip of own.animations) {
    const twin = asset.animations.find(c => c.name === clip.name)!;
    for (const t of clip.tracks) { const o = twin.tracks.find(x => x.name === t.name)!; assert.ok(o && o.times.length === t.times.length && Array.from(t.values).every((v, i) => Math.abs(v - o.values[i]) < 1e-6), `${clip.name} ${t.name} is the Nightborn's own`); }
  }
  assert.ok(Object.values(ESTOC_PATHS).every(spec => ['Attack', 'Return', 'Heavy', 'Riposte'].includes(spec.clip)));
});

test('the live estoc keeps torso aim through its actual reach: cuts to 2.0 m, heavy to 2.5 m, thrust to 2.3 m', () => {
  for (const [move, action, frontier] of [['light_right', 'light', 2], ['heavy_overhead', 'heavy', 2.5], ['thrust', 'thrust', 2.3]] as const) {
    const m = ESTOC.moves[move];
    let last = 0;
    for (let cm = 85; cm <= 270; cm += 5) {
      const events = run(stepDuel(duel(cm / 100, 'estoc'), [act(action), idle()]), m.windup + m.active + 1).events;
      for (const e of events.filter(e => e.type === 'Hit' && e.actor === 0)) {
        assert.notEqual(e.location, 'head', `${move} at ${cm / 100} m`);
        if (move === 'thrust') assert.equal(e.location, 'torso', 'a thrust earns the torso finisher');
        last = cm / 100;
      }
    }
    assert.equal(last, frontier, `${move}: keep the measured reach, not a head-free miss`);
  }
});

test('the estoc\'s data is the brief\'s: the sword\'s timings and lunges exactly, reach in the sword\'s conservative convention, cuts weaker than the sword\'s with no chip, the thrust a little stronger and chaining, a high thrust share, steel', () => {
  for (const id of ['light_right', 'light_left', 'heavy_overhead', 'thrust', 'riposte', 'heavy_riposte', 'heavy_counter', 'critical'] as const) {
    const s = MOVES[id], e = ESTOC.moves[id];
    assert.deepEqual([e.windup, e.active, e.recovery, e.stepIn, e.feintUntil, e.chamber], [s.windup, s.active, s.recovery, s.stepIn, s.feintUntil, s.chamber], `${id}: the sword's timing, lunge, feint window and chamber`);
    assert.equal(e.reach, s.reach, `${id}: the sword's spacing estimate (measured frontier is 0.3 m longer — REPORT.md)`);
  }
  assert.ok(ESTOC.moves.light_right.damage < MOVES.light_right.damage && ESTOC.moves.light_right.chip === 0 && ESTOC.moves.heavy_overhead.damage < MOVES.heavy_overhead.damage, 'cuts with a rod');
  assert.ok(ESTOC.moves.thrust.damage > MOVES.thrust.damage && ESTOC.moves.thrust.chain?.follow.includes('thrust') && ESTOC.moves.riposte.damage > MOVES.riposte.damage, 'the thrust is the weapon; the riposte his payoff');
  assert.deepEqual([ESTOC.guard, ESTOC.material, ESTOC.fight.thrustShare > .5, ESTOC.fight.close], ['blade', 'steel', true, LONGSWORD.fight.close]);
});

// ── The scythe (weapons lane → combat lane, 2026-09-18): the Executioner's — LIVE. Mesh (variant B), 13-clip family on his rig, SCYTHE
// data and the man-scale bake; the flip (WEAPONS.scythe = SCYTHE, the manifest entry, his rebuilt body, the WEAPON_CLIPS map) is the
// GAMEPLAY CHANGE REQUESTS §15 flagged: new timings, a shaft guard profile, a chip profile and a dead band inside the arc.
import { SCYTHE, SCYTHE_MOVES, SCYTHE_PATHS } from '../src/moves.ts';
const SCYTHE_GLB = 'src/assets/weapons/scythe/executioner-scythe.glb', SCYTHE_BAKE_GLB = 'src/assets/weapons/scythe/warrior-scythe.glb';
const SCYTHE_CLIPS: Record<string, number> = { Scythe_Idle: 1.667, Scythe_Walk: 1.333, Scythe_StrafeLeft: .8, Scythe_StrafeRight: .8, Scythe_Reap: 1, Scythe_High: 1, Scythe_Thrust: 1, Scythe_Chain: 1, Scythe_Guard: 1, Scythe_BlockImpact: 1, Scythe_Deflected: 1, Scythe_Hit: .333, Scythe_Death: 2.4 };

test('the scythe is live (2026-09-18): WEAPONS.scythe is SCYTHE, the Executioner carries it, and it is baked at a man\'s 1.0× from warrior-scythe.glb (the cleaver convention: his rendered 1.36× blade runs past the simulated one, never short)', () => {
  assert.equal(WEAPONS.scythe, SCYTHE); assert.equal(WEAPONS.scythe.placeholder, undefined); assert.equal(OPP.executioner.weapon, 'scythe');
  assert.notEqual(SCYTHE.moves, MOVES); assert.notEqual(SCYTHE.paths, PATHS); assert.equal(SCYTHE.id, 'scythe');
  assert.notDeepEqual(bladePaths.scythe, bladePaths.longsword); assert.deepEqual(Object.keys(bladePaths.scythe).sort(), Object.keys(SCYTHE.paths).sort(), 'every scythe path baked');
  const manifest = JSON.parse(readFileSync(new URL('../scripts/blade-manifest.json', import.meta.url), 'utf8')) as { weapons: { weapon: string; glb: string; node: string; contact: [number, number] }[] };
  assert.deepEqual(manifest.weapons.find(w => w.weapon === 'scythe'), { weapon: 'scythe', glb: SCYTHE_BAKE_GLB, node: 'WeaponDrawn', contact: [1.22, 1.32] });
});

test('the fight the scythe gives (real tables): the reap lands 1.40–2.10 m and meets nothing inside 1.40 (the arc\'s dead band, minReach), the headsman\'s high lands to 2.30 and the heel-jab to 2.10 — the measured frontiers, not the spacing estimates', () => {
  const landsFrom = (move: 'light_right' | 'heavy_overhead' | 'thrust', gap: number) => {
    const m = WEAPONS.scythe.moves[move], action = move === 'thrust' ? 'thrust' : move === 'heavy_overhead' ? 'heavy' : 'light';
    return run(stepDuel(duel(gap, 'scythe'), [act(action), idle()]), m.windup + m.active + 1).events;
  };
  const landed = (events: Duel['events']) => events.some(e => e.type === 'Hit');
  // Measured on the man-scale bake (REQUESTS §16), pinned here so the flip can never silently shorten him: the far frontier.
  assert.ok(landed(landsFrom('light_right', 2.10)) && !landed(landsFrom('light_right', 2.15)), 'the reap lands to 2.10, whiffs past it');
  assert.ok(landed(landsFrom('heavy_overhead', 2.30)) && !landed(landsFrom('heavy_overhead', 2.35)), 'the high lands to 2.30, whiffs past it');
  assert.ok(landed(landsFrom('thrust', 2.10)) && !landed(landsFrom('thrust', 2.15)), 'the jab lands to 2.10, whiffs past it');
  // The dead band: inside 1.40 m the arc meets nothing (minReach), where the sword's cut still lands.
  const swordInside = run(stepDuel(duel(1.3), [act('light'), idle()]), MOVES.light_right.windup + MOVES.light_right.active + 1).events;
  assert.ok(landed(swordInside), 'the sword cuts from 1.3 m');
  const inside = landsFrom('light_right', 1.35);
  assert.ok(!landed(inside) && inside.some(e => e.type === 'AttackMissed'), 'the reap whiffs inside the dead band');
  assert.ok(landed(landsFrom('light_right', 1.45)), 'from 1.45 m the arc develops and lands');
});

test('the scythe rig is the Executioner\'s own: WeaponDrawn (the head as the contact segment) under hand_r, empty sword nodes, and the full 13-clip family at the contract durations', async () => {
  const asset = await readRig(SCYTHE_GLB), weapon = asset.scene.getObjectByName('WeaponDrawn')!;
  assert.ok(weapon, 'WeaponDrawn'); assert.equal(weapon.parent?.name, 'hand_r');
  const contact = weapon.userData.contact as { from: number; to: number };
  assert.ok(contact && Math.abs(contact.from - 1.22) < .001 && Math.abs(contact.to - 1.32) < .001, `the head, not the haft: ${JSON.stringify(contact)}`);
  for (const name of ['SwordDrawn', 'SwordSheathed']) { const node = asset.scene.getObjectByName(name)!; assert.ok(node, name); assert.equal(node.children.length, 0, `${name} carries nothing`); }
  for (const [name, duration] of Object.entries(SCYTHE_CLIPS)) {
    const clip = asset.animations.find(c => c.name === name)!;
    assert.ok(clip, name); assert.ok(Math.abs(clip.duration - duration) < .002, `${name} ${clip.duration}s`);
    assert.ok(clip.tracks.every(t => t.values.every(Number.isFinite)));
    if (['Scythe_Idle', 'Scythe_Walk', 'Scythe_StrafeLeft', 'Scythe_StrafeRight'].includes(name)) for (const track of clip.tracks) { const n = track.getValueSize(); assert.ok([...track.values.slice(0, n)].every((v, i) => Math.abs(v - track.values[track.values.length - n + i]) < 1e-5), `${name} loops seamlessly`); }
  }
  for (const [path, spec] of Object.entries(SCYTHE_PATHS)) assert.ok(asset.animations.some(c => c.name === spec.clip), `${path} → ${spec.clip} exists`);
});

test('the scythe\'s authored contact poses meet the target line: at each path\'s contact key the head is out in front at the move\'s height — the reap crosses the centre line, it does not start 0.7 m past it (the task-4 retime)', async () => {
  const asset = await readRig(SCYTHE_BAKE_GLB), mixer = new AnimationMixer(asset.scene), weapon = asset.scene.getObjectByName('WeaponDrawn')!, contact = weapon.userData.contact as { from: number; to: number };
  assert.equal(weapon.parent?.name, 'hand_r', 'the man-scale bake rig carries the same part');
  // [min tip z, min tip y, max tip y, max |tip x|]: chest height for the reap and the jab, the headsman's low diagonal for the high.
  const bands: Record<string, [number, number, number, number]> = {
    light_right: [1.3, .9, 1.5, .45], light_left: [1.3, .9, 1.5, .45], light_right_chain: [1.3, .9, 1.5, .45], light_left_chain: [1.3, .9, 1.5, .45],
    heavy_overhead: [1.1, .4, 1.0, .6], heavy_overhead_chain: [1.1, .4, 1.0, .6], heavy_riposte: [1.1, .4, 1.0, .6],
    slash_riposte: [1.3, .9, 1.5, .45], thrust: [1.3, .9, 1.4, .4], riposte: [1.25, .9, 1.5, .45],
  };
  for (const [path, spec] of Object.entries(SCYTHE_PATHS)) {
    const clip = asset.animations.find(c => c.name === spec.clip)!, action = mixer.clipAction(clip).play(), n = total(spec);
    mixer.setTime(Math.min(.999999, swingProgress(spec.windup / n, spec.windup / n, spec.source)) * clip.duration); asset.scene.updateMatrix(true);
    asset.scene.updateMatrixWorld(true);
    const tip = weapon.localToWorld(new Vector3(0, contact.to, 0)), [minZ, minY, maxY, maxX] = bands[path];
    assert.ok(tip.z > minZ && tip.y > minY && tip.y < maxY && Math.abs(tip.x) < maxX, `${path} (${spec.clip} @${spec.source}) tip ${tip.toArray().map(v => v.toFixed(2))}`);
    action.stop(); mixer.uncacheClip(clip);
  }
});

test('the scythe\'s data is the brief\'s: slower tells than the sword\'s, the jab quick with no chip, the shaft guard profile, a low thrust share and a dead band inside the arc', () => {
  assert.ok(SCYTHE_MOVES.light_right.windup > MOVES.light_right.windup && SCYTHE_MOVES.light_right.windup + SCYTHE_MOVES.light_right.active > MOVES.light_right.windup + MOVES.light_right.active, 'the reap\'s tell is longer than the cut\'s (24/8 vs 20/8)');
  assert.ok(SCYTHE_MOVES.heavy_overhead.windup > MOVES.heavy_overhead.windup, 'the headsman\'s diagonal winds up longer than the sword\'s heavy (36 vs 32)');
  assert.ok(SCYTHE_MOVES.thrust.windup < MOVES.thrust.windup && SCYTHE_MOVES.thrust.active <= 4 && SCYTHE_MOVES.thrust.chip === 0 && SCYTHE_MOVES.thrust.damage < MOVES.thrust.damage, 'the heel-jab: quicker than a stab, no chip, half a cut\'s damage');
  assert.deepEqual([SCYTHE.guard, SCYTHE.material], ['shaft', 'iron']);
  assert.deepEqual(SCYTHE.guardProfile, { costScale: 1.15, heavyBreaks: true }, 'the haft guard: like the trident\'s, a plain heavy breaks it');
  assert.deepEqual(SCYTHE.fight, { thrustShare: .1, close: 2.0 }, 'the jab is a rare opener; he HOLDS the arc\'s edge at 2.0 m — the approach must be timed through the tell (owner 2026-09-18)');
  assert.equal(SCYTHE_MOVES.light_right.minReach, 1.4); assert.equal(SCYTHE_MOVES.light_left.minReach, 1.4);
  // Reach = the measured bake frontier (the trident convention — the owner's read on first play: "this weapon should hit you from
  // far away"); the sim test above pins the frontiers. The dead band inside 1.40 m is real (minReach).
  assert.deepEqual([SCYTHE_MOVES.light_right.reach, SCYTHE_MOVES.heavy_overhead.reach, SCYTHE_MOVES.thrust.reach], [2.1, 2.3, 2.1]);
  assert.equal(SCYTHE.reach, SCYTHE_MOVES.thrust.reach);
});
