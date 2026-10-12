// Finishers as data: the loaded table is byte-identical to the code tables it replaced, the pick is unchanged, a finisher is one row, and the
// loader refuses a broken table at load.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { FINISHER_POSE, FINISHERS, ROTATION, finisherSeconds, selectFinisher, type FinisherId } from '../src/fight/finishers.ts';
import { loadFinisherDefs } from '../src/fight/finisher-rows.ts';
import type { Manifest } from '../src/core/registry.ts';
import type { Finish } from '../src/fight/duel.ts';
import type { WeaponId } from '../src/fight/moves.ts';
import { duplicateKeys } from '../scripts/lib/json-dup-keys.mjs';
import { PerspectiveCamera } from 'three';
import { createCameraRig, finisherSidePose } from '../src/fight/camera.ts';
import { anyOfTemplate, finisherBodyPose, isPlainDeath, isShelved, isTemplate } from '../src/fight/finisher-look.ts';
import { ADDITIVE_ROLES, FINISHER_CLIPS } from '../src/fight/characters.ts';
import { cuesFor } from '../src/fight/sound/cues.ts';
import { MANIFEST } from '../src/audio/manifest.ts';
import type { CombatEvent } from '../src/fight/combat.ts';
const ROLES = [...FINISHER_CLIPS, ...ADDITIVE_ROLES];
import { initialState } from '../src/fight/sim.ts';

const text = readFileSync(new URL('../src/fight/finisher-defs.json', import.meta.url), 'utf8');
const raw = JSON.parse(text) as { finishers: Record<string, unknown>[] };
const manifest = (JSON.parse(readFileSync(new URL('../src/fight/finisher-defs.manifest.json', import.meta.url), 'utf8')) as { tables: Manifest[] }).tables[0]!;
const sha = (s: string) => createHash('sha256').update(s).digest('hex');
const CAM = { dolly: { push: 0.38, slide: 0.95, turn: 0.6 } };   // the camera field every finisher row carries (camera.ts)
const SND = { fall: { cue: 'kill', gain: 0.65, room: 0.25, at: 1.4 } };   // the sound every finisher row but a staged one carries (sound/cues.ts)

// Both computed on trunk 411fbdf31 BEFORE any of this moved: (a) the resolved table the code built (the rotation, and per finisher its pose
// and finisherSeconds), (b) every selectFinisher pick over a 16 128-kill sweep (victim, draw, 8 moves, 3 locations, 24 headings, 7 previous
// ceremonies, 2 weapon pairs).
const TABLE_BEFORE = 'efe9c96c065809facaffb2b58198844b72ccf4d20d391d6c031db2ac3e493645';
const PICKS_BEFORE = 'c5299a0851dd782dd831bfc1413dbc42c487634bc4cedb4b956d5d8313eda65e';
const resolved = () => JSON.stringify({ rotation: [...ROTATION], rows: Object.keys(FINISHER_POSE).map((id) => ({ id, pose: FINISHER_POSE[id], ...finisherSeconds(id) })) });
function sweep(pick: typeof selectFinisher, rotation: readonly FinisherId[]): string[] {
  const out: string[] = [];
  for (const victim of [0, 1]) for (const draw of [false, true]) for (const move of ['heavy_overhead', 'light_right', 'light_left', 'thrust', 'riposte', 'critical', 'kick', 'skill_pommel']) for (const location of ['head', 'torso', 'legs'])
    for (let h = 0; h < 24; h++) for (const prev of [null, ...rotation, 'quietOne'])
      out.push(String(pick({ victim, draw, move, location, heading: h / 7 } as unknown as Finish, ['longsword', h % 2 ? 'trident' : 'longsword'] as [WeaponId, WeaponId], prev)));
  return out;
}

test('the loaded finishers are byte-identical to the code tables they replaced, and every pick is unchanged', () => {
  assert.equal(sha(resolved()), TABLE_BEFORE);
  const picks = sweep(selectFinisher, ROTATION);
  assert.equal(picks.length, 16128);
  assert.equal(sha(picks.join(',')), PICKS_BEFORE);
});

test('the rows file has no duplicate key and every row names an engine template', () => {
  assert.deepEqual(duplicateKeys(text), [], 'JSON.parse keeps the last of two equal keys silently');
  assert.deepEqual(FINISHERS.rows.map((r) => [r.id, r.template]), [['splitCrown', 'cleave'], ['decapitation', 'sever'], ['runThrough', 'impale'], ['plainDeath', 'fall'], ['quietOne', 'fall'], ['opened', 'bisect'], ['hamstrung', 'hamstring'], ['execution', 'execute']]);
});

test('a ninth finisher is ONE row through the real loader, with no code edit', () => {
  const row = { id: 'gutted', template: 'bisect', rotation: false, pose: 'opened', seconds: 3.5, camera: CAM, sound: SND };
  const t = loadFinisherDefs({ finishers: [...raw.finishers, row] }, manifest);
  assert.equal(t.rows.length, 9);
  assert.equal(t.byId.get('gutted')!.template, 'bisect');
  assert.deepEqual(t.rotation, [...ROTATION], 'a new row is not in the automatic pick until it says so');
  const borrowed = loadFinisherDefs({ finishers: [...raw.finishers, { id: 'gutted', template: 'hamstring', rotation: true, pose: null, secondsFrom: 'opened', camera: CAM }] }, manifest);
  assert.deepEqual(borrowed.rotation, [...ROTATION, 'gutted'], 'rotation: true joins the pool, in file order');
});

test('the loader refuses a duplicate id, an unknown template, a bad pose or body, a missing field, a bad duration and a secondsFrom naming no measured row, at load', () => {
  const ok = raw.finishers, load = (rows: unknown[]) => loadFinisherDefs({ finishers: rows }, manifest);
  assert.doesNotThrow(() => load(ok));
  assert.throws(() => load([...ok, { ...ok[0] }]), /duplicate-id/);
  assert.throws(() => load([...ok, { id: 'a', template: 'juggle', rotation: false, pose: null, seconds: 2, camera: CAM, sound: SND }]), /template "juggle" is not an engine verb/);
  assert.throws(() => load([...ok, { id: 'a', template: 'fall', rotation: false, pose: 7, seconds: 2, camera: CAM, sound: SND }]), /pose must be a clip word or null/);
  assert.throws(() => load([...ok, { id: 'a', template: 'fall', rotation: false, pose: null, seconds: 2, camera: CAM, sound: SND, body: { victim: { pose: 'opened', role: 'Death_SplitCrown' } } }]), /body pose "opened" is used twice/);
  assert.throws(() => load([...ok, { id: 'a', template: 'fall', rotation: false, pose: null, seconds: 2, camera: CAM, sound: SND, body: { victim: { pose: 'x' } } }]), /body parts need a pose word and a clip role/);
  assert.throws(() => load([...ok, { id: 'a', rotation: false, pose: null, seconds: 2, camera: CAM, sound: SND }]), /missing-field: template is required/);
  assert.throws(() => load([...ok, { id: 'a', template: 'fall', rotation: 'yes', pose: null, seconds: 2, camera: CAM, sound: SND }]), /wrong-type: rotation must be boolean/);
  assert.throws(() => load([...ok, { id: 'a', template: 'fall', rotation: false, pose: null, camera: CAM, sound: SND }]), /exactly one of seconds and secondsFrom/);
  assert.throws(() => load([...ok, { id: 'a', template: 'fall', rotation: false, pose: null, seconds: 2, secondsFrom: 'plainDeath', camera: CAM, sound: SND }]), /exactly one of seconds and secondsFrom/);
  assert.throws(() => load([...ok, { id: 'a', template: 'fall', rotation: false, pose: null, seconds: -1, camera: CAM, sound: SND }]), /seconds must be a positive number/);
  assert.throws(() => load([...ok, { id: 'a', template: 'fall', rotation: false, pose: null, secondsFrom: 'nothing', camera: CAM, sound: SND }]), /unknown-ref: secondsFrom = "nothing" is not a finisher id/);
  assert.throws(() => load([...ok, { id: 'a', template: 'fall', rotation: false, pose: null, secondsFrom: 'hamstrung', camera: CAM, sound: SND }]), /must name a row with measured seconds/);
  assert.throws(() => finisherSeconds('nothing'), /unknown finisher "nothing"/);
});

// ---- camera.ts reads the rows' `camera` field (the finisher name-switches, consumer group 1). Both hashes were computed on trunk BEFORE the field
// existed: every finisherSidePose over a grid of positions, aspects, body scales and reaches, and the camera rig's position and orientation over 150
// frames of every finisher (and none) × victim × big × locked × severed head × reach.
const SIDE_BEFORE = '5ffdb12a51960298a733956e2e11e169486b3581c72cfb8b99d442d148216d2d', RIG_BEFORE = '40f9403edaf11252abaa6671d00e77dd2e2810117b9dc8ba9de4b4de0143241a';
const r9 = (n: number) => Math.round(n * 1e9) / 1e9;
test('the finisher camera driven by the rows is byte-identical to the name-switches it replaced (side views and the whole rig)', () => {
  const side = createHash('sha256');
  for (const f of ['runThrough', 'splitCrown', 'opened']) for (const [kx, kz, fx, fz] of [[0, 0, 0, 1.6], [3, 4, 1, 2], [8, 6, 9, 7.5], [-10, 2, -9, 1]] as const) for (const aspect of [393 / 852, 1.6]) for (const scale of [1, 1.5]) for (const reach of [0, 1.2, 3]) {
    const p = finisherSidePose({ x: kx, z: kz }, { x: fx, z: fz }, aspect, f, scale, reach); side.update(JSON.stringify([p.x, p.y, p.z, p.lookX, p.lookY, p.lookZ].map(r9)));
  }
  assert.equal(side.digest('hex'), SIDE_BEFORE);
  const rig = createHash('sha256');
  for (const finisher of [null, 'splitCrown', 'decapitation', 'runThrough', 'plainDeath', 'quietOne', 'opened', 'hamstrung', 'execution']) for (const victim of [0, 1]) for (const big of [false, true]) for (const locked of [true, false]) for (const head of [null, { x: 1.2, z: -0.4 }]) for (const reach of [0, 2]) {
    const camera = new PerspectiveCamera(51, 393 / 852, 0.1, 180), cr = createCameraRig(camera, false);
    const state = { ...initialState(), x: 3, z: 4, heading: 1 }, enemy = { x: 0, z: 0, heading: 0 };
    cr.update(1 / 60, state, enemy, locked, null); cr.recenter();
    for (let i = 0; i < 150; i++) {
      cr.update(1 / 60, state, enemy, locked, { finisher, posed: finisher !== null && finisher !== 'plainDeath', draw: false, victim, clock: i / 100, head, big, reach });
      rig.update(JSON.stringify([...camera.position.toArray(), ...camera.quaternion.toArray()].map(r9)));
    }
  }
  assert.equal(rig.digest('hex'), RIG_BEFORE);
});

test('a new finisher\'s camera is ONE row: its own dolly, a reveal onto its own side view, through the real loader', () => {
  const row = { id: 'gutted', template: 'bisect', rotation: false, pose: 'opened', seconds: 3.5, sound: SND,
    camera: { dolly: { push: 0.2, slide: 0.5, turn: 0.4 }, reveal: { from: 0.1, over: 0.3, side: 'gutted' }, side: { angle: 0.9, eyeY: 2.6, minBack: 4, beyond: 0.6 } } };
  const t = loadFinisherDefs({ finishers: [...raw.finishers, row] }, manifest);
  assert.deepEqual(t.byId.get('gutted')!.camera.side, row.camera.side);
  const ok = raw.finishers, load = (rows: unknown[]) => loadFinisherDefs({ finishers: rows }, manifest);
  assert.throws(() => load([...ok, { ...row, camera: { reveal: row.camera.reveal } }]), /missing-field: camera.dolly.push is required/);
  assert.throws(() => load([...ok, { ...row, camera: { ...row.camera, reveal: { from: 0, over: 0.3, side: 'nothing' } } }]), /unknown-ref: camera.reveal.side = "nothing" is not a finisher id/);
  assert.throws(() => load([...ok, { ...row, camera: { ...row.camera, reveal: { from: 0, over: 0.3, side: 'decapitation' } } }]), /must name a row with a camera.side view/);
  assert.throws(() => load([...ok, { ...row, camera: { ...row.camera, side: { angle: 0.9, eyeY: 2.6, minBack: 4 } } }]), /camera.side needs angle, eyeY, minBack and either beyond or beyondBody \+ reachPad/);
  assert.throws(() => finisherSidePose({ x: 0, z: 0 }, { x: 0, z: 1 }, 1, 'decapitation'), /has no camera.side view/);
});

// ---- scene.ts reads the rows (the finisher name-switches, consumer group 2). Every compare it made on a name is now a question about the row (finisher-look.ts):
// for every finisher (and none), each new answer is the old compare's answer, so the scene takes the same branch on every frame.
test('scene.ts\'s questions about a finisher, answered from its row, match the name compares they replaced for every finisher and none', () => {
  const ids: (string | null)[] = [null, ...Object.keys(FINISHER_POSE)];
  const supportsOnly = (allowed: readonly string[]) => (f: string) => allowed.includes(f);
  for (const f of ids) {
    assert.equal(isTemplate(f, 'bisect'), f === 'opened', `${f}: the waist-cut bake (openWaist, the measured reach, the rank-look drain)`);
    assert.equal(isTemplate(f, 'cleave'), f === 'splitCrown', `${f}: splitCrown`);
    assert.equal(isTemplate(f, 'sever'), f === 'decapitation', `${f}: the severed head`);
    assert.equal(isTemplate(f, 'impale'), f === 'runThrough', `${f}: the run-through hold`);
    assert.equal(isTemplate(f, 'hamstring'), f === 'hamstrung', `${f}: Hamstrung's clock and fetch`);
    assert.equal(isTemplate(f, 'execute'), f === 'execution', `${f}: Execution's clock, fetch and reach`);
    assert.equal(isTemplate(f, 'hamstring', 'execute'), f === 'hamstrung' || f === 'execution', `${f}: a picker-only pick`);
    assert.equal(f !== null && !isPlainDeath(f), f !== null && f !== 'plainDeath', `${f}: a ceremony's body takes over (flinch, marks)`);
    assert.equal(!isPlainDeath(f), f !== 'plainDeath', `${f}: detailed blood`);
    assert.equal(isShelved(f), f === 'quietOne', `${f}: the shelved clip plays the plain fall`);
  }
  for (const allowed of [[], ['opened'], ['plainDeath', 'decapitation'], Object.keys(FINISHER_POSE)])
    assert.equal(anyOfTemplate('bisect', supportsOnly(allowed)), supportsOnly(allowed)('opened'), `the bake is prepared for ${JSON.stringify(allowed)}`);
  const scene = readFileSync(new URL('../src/fight/scene.ts', import.meta.url), 'utf8');
  assert.deepEqual(scene.match(new RegExp(`'(${Object.keys(FINISHER_POSE).join('|')})'`, 'g')) ?? [], [], 'scene.ts names no finisher');
});

// ---- characters.ts reads the rows (consumer group 3). What a rig plays for a finisher pose word is its row's `body` (the clip role, victim or killer)
// and its template's own code path; the old word compares are pinned here for every word the rigs were ever handed, combat poses included.
test('characters.ts: every pose word maps to the clip role, side and template the old compares gave it; characters.ts names no finisher pose word', () => {
  const OLD_ROLE: Record<string, string> = { splitCrown: 'Death_SplitCrown', decapitation: 'Death_SplitCrown', opened: 'Death_SplitCrown', runThrough: 'Death_RunThrough', runThroughHold: 'Fin_RunThrough',
    hamstrung: 'Death_Hamstrung', hamstrungStrike: 'Fin_Hamstrung', execution: 'Death_Execution', executionStrike: 'Fin_Execution' };
  const OLD_DEAD = ['splitCrown', 'decapitation', 'runThrough', 'opened', 'hamstrung', 'execution'], OLD_HELD = ['runThroughHold', 'hamstrungStrike', 'executionStrike'];
  const words = [...Object.keys(OLD_ROLE), 'sheathed', 'draw', 'ready', 'attack', 'hit', 'death', 'roll', 'guard', 'kick', 'block', 'parry', 'deflected', 'quietOne'];
  for (const w of words) {
    const fin = finisherBodyPose(w), t = fin?.row.template;
    assert.equal(fin?.role, OLD_ROLE[w], `${w}: the clip role`);
    assert.equal(fin?.side === 'victim', OLD_DEAD.includes(w), `${w}: a dead pose`);
    assert.equal(fin?.side === 'killer', OLD_HELD.includes(w), `${w}: held at full weight`);
    assert.equal(t === 'bisect', w === 'opened', `${w}: the waist-cut group, its own fade and snap`);
    assert.equal(t === 'hamstring' || t === 'execute', ['hamstrung', 'hamstrungStrike', 'execution', 'executionStrike'].includes(w), `${w}: clips adopted on demand, weights snap from 0.05`);
    assert.equal(fin?.side === 'victim' && (t === 'bisect' || t === 'hamstring' || t === 'execute'), ['opened', 'hamstrung', 'execution'].includes(w), `${w}: the ghost outlasts the scene`);
    assert.equal(fin?.side === 'victim' && t === 'hamstring', w === 'hamstrung', `${w}: Hamstrung's beats`);
    assert.equal(fin?.side === 'victim' && t === 'execute', w === 'execution', `${w}: Execution's beats`);
  }
  for (const row of FINISHERS.rows) for (const part of row.body ? [row.body.victim, row.body.killer] : []) if (part) assert.ok((ROLES as readonly string[]).includes(part.role), `${row.id}: ${part.role} is a rig clip role`);
  const characters = readFileSync(new URL('../src/fight/characters.ts', import.meta.url), 'utf8');
  assert.deepEqual(characters.match(new RegExp(`'(${Object.keys(OLD_ROLE).join('|')})'`, 'g')) ?? [], [], 'characters.ts names no finisher pose word');
  const scene = readFileSync(new URL('../src/fight/scene.ts', import.meta.url), 'utf8');
  assert.deepEqual(scene.match(/'(runThroughHold|hamstrungStrike|executionStrike)'/g) ?? [], [], 'nor does scene.ts name a killer pose');
});

// ---- sound/cues.ts reads the rows (consumer group 4). The fall, the gore cues, the stab rule and the wound cues are each row's `sound`; Hamstrung's
// and Execution's sequences stay their templates' own beats. The hash covers 138 240 cue lists computed on trunk BEFORE the field existed: every
// kill (victim, draw, 6 moves, 3 locations, 6 headings) × 2 weapon pairs × every override (and none) × gore on/off × 4 opponents (bloodless included)
// × one or two deaths.
const CUES_BEFORE = 'fae1722f951e1944607b48d28c50de3b0ce50bd04ce7e231a891e606c58a7ff6';
test('the kill sounds driven by the rows are byte-identical to the name-switches they replaced; every row cue is a real cue; cues.ts names no finisher', () => {
  const h = createHash('sha256'); let n = 0;
  for (const victim of [0, 1]) for (const draw of [false, true]) for (const move of ['heavy_overhead', 'light_right', 'thrust', 'riposte', 'kick', 'skill_pommel']) for (const location of ['head', 'torso', 'legs']) for (let hd = 0; hd < 6; hd++) {
    const f = { victim, draw, move, location, heading: hd / 3 } as unknown as Finish;
    for (const weapons of [['longsword', 'longsword'], ['estoc', 'trident']] as [WeaponId, WeaponId][]) for (const override of [undefined, null, ...Object.keys(FINISHER_POSE)]) for (const gore of [undefined, false]) for (const opponent of [undefined, 'veteran', 'skeleton', 'wolf'] as const) for (const twoDeaths of [false, true]) {
      const killed = { tick: 100, type: 'Killed', actor: 1 - victim, target: victim, move, weapon: weapons[1 - victim] };
      const events = [{ tick: 99, type: 'Hit', actor: 1 - victim, target: victim, move, damage: 20 }, killed, ...(twoDeaths ? [{ ...killed, actor: victim, target: 1 - victim }] : [])] as unknown as CombatEvent[];
      h.update(JSON.stringify(cuesFor(events, { finish: f, weapons, override, gore }, opponent))); n++;
    }
  }
  assert.equal(n, 138240);
  assert.equal(h.digest('hex'), CUES_BEFORE);
  for (const row of FINISHERS.rows) for (const c of row.sound ? [row.sound.fall, row.sound.goreFall, ...(row.sound.goreAfter ?? []), ...(row.sound.wound ?? [])] : []) if (c) assert.ok(Object.hasOwn(MANIFEST, c.cue), `${row.id}: ${c.cue} is a cue in the audio manifest`);
  const src = readFileSync(new URL('../src/fight/sound/cues.ts', import.meta.url), 'utf8');
  assert.deepEqual(src.match(new RegExp(`'(${Object.keys(FINISHER_POSE).join('|')})'`, 'g')) ?? [], [], 'cues.ts names no finisher');
});
test('a new finisher\'s sound is ONE row through the real loader; a staged template carries none, every other needs a fall', () => {
  const row = { id: 'gutted', template: 'bisect', rotation: false, pose: 'opened', seconds: 3.5, camera: CAM, sound: { fall: { cue: 'kill', gain: 0.5, room: 0.2, at: 1.8 }, wound: [{ cue: 'flesh_tear', gain: 0.4, room: 0.1, atDeath: 0.1 }] } };
  assert.deepEqual(loadFinisherDefs({ finishers: [...raw.finishers, row] }, manifest).byId.get('gutted')!.sound, row.sound);
  const load = (r: unknown) => loadFinisherDefs({ finishers: [...raw.finishers, r] }, manifest);
  assert.throws(() => load({ ...row, sound: undefined }), /a bisect row needs sound.fall/);
  assert.throws(() => load({ ...row, template: 'hamstring' }), /sounds on its template's own beats and carries none/);
  assert.throws(() => load({ ...row, sound: { fall: { cue: 'kill', gain: 0.5, room: 0.2, at: 1, atDeath: 0.1 } } }), /needs sound.fall/);
  assert.throws(() => load({ ...row, sound: { ...row.sound, wound: [{ cue: 'flesh_tear', gain: 0.4, room: 0.1 }] } }), /exactly one of at and atDeath/);
});
