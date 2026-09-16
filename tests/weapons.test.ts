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
const duel = (gap: number, weapon: 'longsword' | 'trident' = 'longsword'): Duel => ({ tick: 0, fighters: [createFighter({ x: 0, z: TARGET.z + gap, heading: Math.PI, distance: 0 }, 'ready', weapon), createFighter({ ...TARGET, heading: 0, distance: 0 }, 'ready')], finish: null, events: [] });
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
import { AnimationMixer, Vector3 } from 'three';
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
  // Weak inside the point (slice V, MoveDef.minReach): inside 1 m (two bodies stand no closer than .85) the trident's thrust meets nothing and
  // stalls like any whiff; the sword's stab still lands there, and the trident's sweep has no such hole.
  assert.ok(landed(landsFrom('longsword', 'thrust', .9)), 'the sword stabs from .9 m');
  const inside = landsFrom('trident', 'thrust', .9);
  assert.ok(!landed(inside) && inside.some(e => e.type === 'AttackMissed' && e.move === 'thrust'), 'the trident thrust whiffs inside the point');
  assert.ok(landed(landsFrom('trident', 'thrust', 1.1)) && landed(landsFrom('trident', 'light_right', .9)), 'from 1.1 m it lands; the sweep lands at .9 m');
  assert.equal(weaponOf('trident'), TRIDENT); assert.equal(TRIDENT.reach, TRIDENT.moves.thrust.reach);
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
