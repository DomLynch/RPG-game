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
import { BoxGeometry, Group, Mesh, Object3D, PerspectiveCamera, Texture } from 'three';
import { createFinisherBlood, finisherBloodSources } from '../src/fight/finisher-blood.ts';
import { createCameraRig, finisherSidePose } from '../src/fight/camera.ts';
import { anyOfTemplate, finisherBodyPose, isPlainDeath, isShelved, isTemplate, PICKER_OPTIONS, PLAIN_DEATH } from '../src/fight/finisher-look.ts';
import { hamstrungPick, poseOf as hamstrungPoseOf, resolveHamstrung } from '../src/fight/hamstrung.ts';
import { executionPick, poseOf as executionPoseOf, resolveExecution } from '../src/fight/execution.ts';
import { ROSTER, type OpponentId } from '../src/roster.ts';
import { ADDITIVE_ROLES, FINISHER_CLIPS } from '../src/fight/characters.ts';
import { cuesFor } from '../src/fight/sound/cues.ts';
import { MANIFEST } from '../src/audio/manifest.ts';
import { CUE_PROBES } from '../src/audio/exchange.ts';
import { bakeSafeFinisher } from '../src/fight/rank-look.ts';
import { canPlayFinisher } from '../src/fight/zone-finisher.ts';
import type { CombatEvent } from '../src/fight/combat.ts';
const ROLES = [...FINISHER_CLIPS, ...ADDITIVE_ROLES];
import { initialState } from '../src/fight/sim.ts';

const text = readFileSync(new URL('../src/fight/finisher-defs.json', import.meta.url), 'utf8');
const raw = JSON.parse(text) as { finishers: Record<string, unknown>[] };
const manifest = (JSON.parse(readFileSync(new URL('../src/fight/finisher-defs.manifest.json', import.meta.url), 'utf8')) as { tables: Manifest[] }).tables[0]!;
const sha = (s: string) => createHash('sha256').update(s).digest('hex');
const CAM = { dolly: { push: 0.38, slide: 0.95, turn: 0.6 } };   // the camera field every finisher row carries (camera.ts)
const BLD = { start: 0.01 };   // blood.start, which every finisher row carries (finisher-blood.ts)
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
  const row = { id: 'gutted', label: 'Test', template: 'bisect', rotation: false, pose: 'opened', seconds: 3.5, camera: CAM, blood: BLD, sound: SND };
  const t = loadFinisherDefs({ finishers: [...raw.finishers, row] }, manifest);
  assert.equal(t.rows.length, 9);
  assert.equal(t.byId.get('gutted')!.template, 'bisect');
  assert.deepEqual(t.rotation, [...ROTATION], 'a new row is not in the automatic pick until it says so');
  const borrowed = loadFinisherDefs({ finishers: [...raw.finishers, { id: 'gutted', label: 'Test', template: 'hamstring', rotation: true, pose: null, secondsFrom: 'opened', camera: CAM, blood: BLD }] }, manifest);
  assert.deepEqual(borrowed.rotation, [...ROTATION, 'gutted'], 'rotation: true joins the pool, in file order');
});

test('the loader refuses a duplicate id, an unknown template, a bad pose or body, a missing field, a bad duration and a secondsFrom naming no measured row, at load', () => {
  const ok = raw.finishers, load = (rows: unknown[]) => loadFinisherDefs({ finishers: rows }, manifest);
  assert.doesNotThrow(() => load(ok));
  assert.throws(() => load([...ok, { ...ok[0] }]), /duplicate-id/);
  assert.throws(() => load([...ok, { id: 'a', label: 'Test', template: 'juggle', rotation: false, pose: null, seconds: 2, camera: CAM, blood: BLD, sound: SND }]), /template "juggle" is not an engine verb/);
  assert.throws(() => load([...ok, { id: 'a', label: 'Test', template: 'fall', rotation: false, pose: 7, seconds: 2, camera: CAM, blood: BLD, sound: SND }]), /pose must be a clip word or null/);
  assert.throws(() => load([...ok, { id: 'a', label: 'Test', template: 'fall', rotation: false, pose: null, seconds: 2, camera: CAM, blood: BLD, sound: SND, body: { victim: { pose: 'opened', role: 'Death_SplitCrown' } } }]), /body pose "opened" is used twice/);
  assert.throws(() => load([...ok, { id: 'a', label: 'Test', template: 'fall', rotation: false, pose: null, seconds: 2, camera: CAM, blood: BLD, sound: SND, body: { victim: { pose: 'x' } } }]), /body parts need a pose word and a clip role/);
  assert.throws(() => load([...ok, { id: 'a', label: 'Test', rotation: false, pose: null, seconds: 2, camera: CAM, blood: BLD, sound: SND }]), /missing-field: template is required/);
  assert.throws(() => load([...ok, { id: 'a', label: 'Test', template: 'fall', rotation: 'yes', pose: null, seconds: 2, camera: CAM, blood: BLD, sound: SND }]), /wrong-type: rotation must be boolean/);
  assert.throws(() => load([...ok, { id: 'a', label: 'Test', template: 'fall', rotation: false, pose: null, camera: CAM, blood: BLD, sound: SND }]), /exactly one of seconds and secondsFrom/);
  assert.throws(() => load([...ok, { id: 'a', label: 'Test', template: 'fall', rotation: false, pose: null, seconds: 2, secondsFrom: 'plainDeath', camera: CAM, blood: BLD, sound: SND }]), /exactly one of seconds and secondsFrom/);
  assert.throws(() => load([...ok, { id: 'a', label: 'Test', template: 'fall', rotation: false, pose: null, seconds: -1, camera: CAM, blood: BLD, sound: SND }]), /seconds must be a positive number/);
  assert.throws(() => load([...ok, { id: 'a', label: 'Test', template: 'fall', rotation: false, pose: null, secondsFrom: 'nothing', camera: CAM, blood: BLD, sound: SND }]), /unknown-ref: secondsFrom = "nothing" is not a finisher id/);
  assert.throws(() => load([...ok, { id: 'a', label: 'Test', template: 'fall', rotation: false, pose: null, secondsFrom: 'hamstrung', camera: CAM, blood: BLD, sound: SND }]), /must name a row with measured seconds/);
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
  const row = { id: 'gutted', label: 'Test', template: 'bisect', rotation: false, pose: 'opened', seconds: 3.5, sound: SND, blood: BLD,
    camera: { dolly: { push: 0.2, slide: 0.5, turn: 0.4 }, reveal: { from: 0.1, over: 0.3, side: 'gutted' }, side: { angle: 0.9, eyeY: 2.6, minBack: 4, beyond: 0.6 } } };
  const t = loadFinisherDefs({ finishers: [...raw.finishers, row] }, manifest);
  assert.deepEqual(t.byId.get('gutted')!.camera.side, row.camera.side);
  const ok = raw.finishers, load = (rows: unknown[]) => loadFinisherDefs({ finishers: rows }, manifest);
  assert.throws(() => load([...ok, { ...row, camera: { reveal: row.camera.reveal } }]), /missing-field: camera.dolly.push is required/);
  assert.throws(() => load([...ok, { ...row, blood: {} }]), /missing-field: blood.start is required/);
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
  const row = { id: 'gutted', label: 'Test', template: 'bisect', rotation: false, pose: 'opened', seconds: 3.5, camera: CAM, blood: BLD, sound: { fall: { cue: 'kill', gain: 0.5, room: 0.2, at: 1.8 }, wound: [{ cue: 'flesh_tear', gain: 0.4, room: 0.1, atDeath: 0.1 }] } };
  assert.deepEqual(loadFinisherDefs({ finishers: [...raw.finishers, row] }, manifest).byId.get('gutted')!.sound, row.sound);
  const load = (r: unknown) => loadFinisherDefs({ finishers: [...raw.finishers, r] }, manifest);
  assert.throws(() => load({ ...row, sound: undefined }), /a bisect row needs sound.fall/);
  assert.throws(() => load({ ...row, template: 'hamstring' }), /sounds on its template's own beats and carries none/);
  assert.throws(() => load({ ...row, sound: { fall: { cue: 'kill', gain: 0.5, room: 0.2, at: 1, atDeath: 0.1 } } }), /needs sound.fall/);
  assert.throws(() => load({ ...row, sound: { ...row.sound, wound: [{ cue: 'flesh_tear', gain: 0.4, room: 0.1 }] } }), /exactly one of at and atDeath/);
});

// ---- finisher-blood.ts reads the rows (consumer group 5): its wound sites are its template's (bisect, hamstring, execute, sever, cleave, impale; a fall
// bleeds where the blade went in) and when the wound opens is the row's blood.start. Both hashes were computed on trunk BEFORE the field existed, on a
// synthetic rig (the five bones it reads, the Opened halves and their WaistCut, a severed head): every finisher × location × opened shown/hidden ×
// head/none, and the bleed itself (droplets, landings, pools) over 8 s of every finisher (and none) in each blood mode.
const BLOOD_BEFORE = { sources: 'e6ab6a62ef0415d0a14d8bdda5af36a67f329c110d96eb4e75e0eff328db1ed9', update: '2745f2b5c6483be3a72310c8e1db833fe6aa4e690ea2aa4d8d2af759a1a8112a' };
test('the finisher blood driven by the rows is byte-identical to the name-switches it replaced; finisher-blood.ts names no finisher', () => {
  const rig = (opened: boolean) => {
    const v = new Group(); v.position.set(0.4, 0, -0.3); v.rotation.y = 0.7;
    for (const [n, y, z] of [['neck_01', 1.45, 0.02], ['Head', 1.53, 0.03], ['spine_02', 1.2, 0], ['calf_r', 0.35, 0.05], ['thigh_r', 0.75, 0.04]] as const) { const b = new Object3D(); b.name = n; b.position.set(0.05, y, z); v.add(b); }
    const o = new Group(); o.name = 'Opened'; o.visible = opened; v.add(o);
    for (const [n, y] of [['OpenedLegs', 0.9], ['OpenedTorso', 1.0]] as const) { const h = new Group(); h.name = n; h.position.y = y; const c = new Mesh(new BoxGeometry(0.3, 0.02, 0.2)); c.name = 'WaistCut'; c.position.set(0.02, 0.01, 0.03); h.add(c); o.add(h); }
    return v;
  };
  const head = new Group(); head.position.set(1, 0.2, 0.5); const cut = new Object3D(); cut.name = 'BloodHeadCut'; cut.position.set(0, -0.05, 0); head.add(cut);
  const kinds = Object.keys(FINISHER_POSE), hs = createHash('sha256'), hu = createHash('sha256');
  for (const k of kinds) for (const loc of ['head', 'torso', 'legs']) for (const opened of [true, false]) for (const h of [head, null]) {
    const src = finisherBloodSources(k, rig(opened), h, loc);
    hs.update(JSON.stringify(src.map((x) => [x.site, ...x.position.toArray(), ...x.direction.toArray(), x.strength, x.delay ?? null, x.seed ?? null].map((v) => (typeof v === 'number' ? r9(v) : v)))));
  }
  for (const k of [...kinds, null]) for (const mode of ['red', 'dark', 'off'] as const) {
    const blood = createFinisherBlood(new Texture()), src = finisherBloodSources(k ?? 'runThrough', rig(true), head, 'torso');
    for (let i = 0; i < 480; i++) {
      blood.update(1 / 60, k, i / 300, src, mode);
      if (i % 20 === 0) { const st = blood.inspect(); hu.update(JSON.stringify([st.kind, r9(st.elapsed), st.emitted, st.landed, st.airborne, st.visible, st.pools.map((q) => [...q.position.map(r9), r9(q.radius), q.site])])); }
    }
  }
  assert.deepEqual({ sources: hs.digest('hex'), update: hu.digest('hex') }, BLOOD_BEFORE);
  const src = readFileSync(new URL('../src/fight/finisher-blood.ts', import.meta.url), 'utf8');
  assert.deepEqual(src.match(new RegExp(`'(${kinds.join('|')})'`, 'g')) ?? [], [], 'finisher-blood.ts names no finisher');
});

// ---- hamstrung.ts and execution.ts read the rows (consumer group 6): each is its template's own code (the beats, the victims), and asks the row
// whether a pick is its template, which pose word its victim plays (body.victim.pose) and which row is the plain death to fall back to. The hash
// covers both poseOf, both picks (installed or not) and both resolvers over every roster body × victim × move × heading × override × resolved,
// computed on trunk BEFORE the change.
const STAGED_BEFORE = '0f55d572cf3753a31e64fc268c400d4ba7516741ac9500db5803468c9949ea18';
test('the staged templates driven by the rows are byte-identical to the name-switches they replaced; hamstrung.ts and execution.ts name no finisher', () => {
  const ids = [null, ...Object.keys(FINISHER_POSE)], h = createHash('sha256');
  for (const id of ids) { if (id) h.update(JSON.stringify([hamstrungPoseOf(id), executionPoseOf(id)])); for (const inst of [true, false]) h.update(JSON.stringify([hamstrungPick(id, inst), executionPick(id, inst)])); }
  for (const opp of Object.keys(ROSTER) as OpponentId[]) for (const victim of [0, 1]) for (const move of ['heavy_overhead', 'kick', 'thrust']) for (let hd = 0; hd < 5; hd++) for (const override of ids) for (const resolved of ids) {
    const f = { victim, draw: false, move, location: 'torso', heading: hd / 4 } as unknown as Finish;
    h.update(JSON.stringify([resolveHamstrung(opp, f, ['longsword', 'longsword'], override, null, resolved), resolveExecution(opp, f, ['longsword', 'longsword'], override, 'splitCrown', resolved)]));
  }
  assert.equal(h.digest('hex'), STAGED_BEFORE);
  assert.equal(PLAIN_DEATH, 'plainDeath', 'the plain death is the fall row with no clip');
  for (const file of ['hamstrung', 'execution']) {
    const src = readFileSync(new URL(`../src/fight/${file}.ts`, import.meta.url), 'utf8');
    assert.deepEqual(src.match(new RegExp(`'(${Object.keys(FINISHER_POSE).join('|')})'`, 'g')) ?? [], [], `${file}.ts names no finisher`);
  }
});

// ---- audio/exchange.ts (consumer group 7): its finisher probes are every rotation row, the plain death first; the whole probe list hashes as on trunk.
test('the audio probes over the finishers come from the rows, in the same order as the list they replaced', () => {
  assert.equal(createHash('sha256').update(JSON.stringify(CUE_PROBES)).digest('hex'), 'a2344ce050fb54852a669f96fc7e3e7f26ccdfdee9719e9a4c975bd496ab5cfe');
  const src = readFileSync(new URL('../src/audio/exchange.ts', import.meta.url), 'utf8');
  assert.deepEqual(src.match(new RegExp(`'(${Object.keys(FINISHER_POSE).join('|')})'`, 'g')) ?? [], [], 'exchange.ts names no finisher');
});

// ---- rank-look.ts:130 bakeSafeFinisher (Characters' file, one line, with Characters' OK 2026-10-12): a bisect finisher whose bake is pending plays its
// row's bakeFallback where the body allows it, else the plain death. Every finisher (and none) × victim × pending × five allow-lists, as on trunk.
test('bakeSafeFinisher driven by the rows picks exactly what the name compare picked', () => {
  const ids = [null, ...Object.keys(FINISHER_POSE)], sets = [[], ['runThrough'], ['plainDeath'], ['opened', 'runThrough'], Object.keys(FINISHER_POSE)], out: (string | null)[] = [];
  for (const f of ids) for (const v of [0, 1]) for (const p of [true, false]) for (const a of sets) out.push(bakeSafeFinisher(f, v, p, (x) => a.includes(x)));
  assert.equal(out.length, 180);
  assert.equal(createHash('sha256').update(JSON.stringify(out)).digest('hex'), '66c2baac37e52c0f24da6061aac9fc4ff6e9fda214d5dbd5cb0b440140625df4');
  assert.throws(() => loadFinisherDefs({ finishers: raw.finishers.map((r) => (r.id === 'opened' ? { ...r, bakeFallback: 'nothing' } : r)) }, manifest), /unknown-ref: bakeFallback = "nothing" is not a finisher id/);
});

// ---- zone-finisher.ts and fx.ts:221 (Lead's ruling: finisher logic, these lines only): the zone shows the rows flagged `zone`, takes a head only on a
// severing finisher, and the Opened sparks sit at the waist on a bisect finisher. Each answer is the old compare's for every finisher, none and an unknown id.
test('zone-finisher and the fx waist sparks ask the row exactly what the name compares asked', () => {
  for (const f of [...Object.keys(FINISHER_POSE), 'nothing']) assert.equal(canPlayFinisher(f), f === 'plainDeath' || f === 'decapitation', `${f}: playable on a zone creature`);
  for (const f of [undefined, ...Object.keys(FINISHER_POSE), 'nothing']) assert.equal(isTemplate(f ?? null, 'sever'), f === 'decapitation', `${f}: the zone takes the head`);
  for (const f of [null, ...Object.keys(FINISHER_POSE)]) assert.equal(isTemplate(f, 'bisect'), f === 'opened', `${f}: the waist sparks`);
  for (const file of ['zone-finisher']) {
    const src = readFileSync(new URL(`../src/fight/${file}.ts`, import.meta.url), 'utf8');
    assert.deepEqual(src.match(new RegExp(`'(${Object.keys(FINISHER_POSE).join('|')})'`, 'g')) ?? [], [], `${file}.ts names no finisher`);
  }
  assert.doesNotMatch(readFileSync(new URL('../src/fight/fx.ts', import.meta.url), 'utf8'), /finisher === '/, 'fx.ts compares no finisher name');
});

// ---- main.ts FINISHER_OPTIONS (Web's file; Lead's ruling 2026-10-12): the dev picker is the rows with a `picker` place, in that order, under their `label`.
// The list is exactly the one main.ts hard-coded on trunk.
test('the dev picker built from the rows is byte-identical to the hard-coded list it replaced; main.ts names no finisher', () => {
  assert.deepEqual(PICKER_OPTIONS.map(([id, label]) => [id, label]), [['splitCrown', 'Split Crown'], ['decapitation', 'Decapitation'], ['runThrough', 'Run Through'], ['opened', 'Opened'], ['hamstrung', 'Hamstrung'], ['execution', 'Execution'], ['plainDeath', 'Plain death']]);
  const src = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
  assert.deepEqual(src.match(new RegExp(`'(${Object.keys(FINISHER_POSE).join('|')})'`, 'g')) ?? [], [], 'main.ts names no finisher');
  assert.throws(() => loadFinisherDefs({ finishers: raw.finishers.map((r) => (r.id === 'opened' ? { ...r, picker: 1 } : r)) }, manifest), /picker places must be distinct integers/);
  assert.throws(() => loadFinisherDefs({ finishers: raw.finishers.map((r) => (r.id === 'opened' ? { ...r, label: undefined } : r)) }, manifest), /missing-field: label is required/);
});
