// Pitborn determinism probe (Combat B). Run from a trunk checkout with node --experimental-strip-types not needed (node 22.6+ strips .ts imports):
//   node pitborn-diverge.mjs <repo root> [ref.json]   no ref: writes the reference JSON to stdout. With ref: prints the first divergence.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
const root = process.argv[2], ref = process.argv[3] ? JSON.parse(readFileSync(process.argv[3], 'utf8')) : null;
const THREE = await import(`${root}/node_modules/three/build/three.module.js`);
const { PITBORN_KINDS, createPitbornSpecial } = await import(`${root}/src/fight/special-fx-pitborn.ts`);
const { LAND_AT } = await import(`${root}/src/fight/special-timing.ts`);
const { ARENA_THEMES } = await import(`${root}/src/arena-themes.ts`);
const fighters = [{ special: 0 }, { special: 0, skill: 'cleave' }];
const started = { tick: 1, type: 'SpecialStarted', actor: 1, move: 'skill_cleave' };
const landed = (tick) => ({ tick, type: 'SpecialLanded', actor: 1, target: 0, move: 'skill_cleave', damage: 30 });
const feet = [new THREE.Vector3(0, 0, 1.4), new THREE.Vector3(0, 0, -0.6)];
const r6 = (n) => Math.round(n * 1e6) / 1e6, sha = (s) => createHash('sha256').update(s).digest('hex').slice(0, 10);
const out = { env: `${process.version} ${process.arch} ${process.platform}`, runs: {} };
for (const kind of PITBORN_KINDS) for (const [ex, exposure] of [['day', ARENA_THEMES['1'].exposure], ['pit', 1.85]]) {
  const key = `${kind}:${ex}`, scene = new THREE.Scene(), fx = createPitbornSpecial(scene, 'pitborn', kind, exposure), tex = new Set(), ticks = [];
  let firstLines = null;
  for (let t = 0; t <= LAND_AT + 240; t++) {
    fx.render(1 / 60, t === 1 ? [started] : t === LAND_AT ? [landed(t)] : [], fighters, t, feet, false);
    const lines = [];
    scene.traverse((o) => { const m = o.material; if (m?.map) tex.add(m.map);
      lines.push(`${o.name}|${o.visible}|${o.position.toArray().map(r6)}|${o.quaternion.toArray().map(r6)}|${o.scale.toArray().map(r6)}|${m ? `${r6(m.opacity)}|${m.color?.getHexString()}|${m.depthTest}|${o.renderOrder}` : ''}`); });
    const d = sha(lines.join(';')); ticks.push(d);
    if (ref && !firstLines && ref.runs[key].ticks[t] !== d) firstLines = { tick: t, lines };
  }
  const texs = [...tex].map((t) => { const d = t.image?.data; return d ? sha(Buffer.from(d.buffer)) : '-'; });
  out.runs[key] = { tex: texs, ticks };
  if (ref) {
    const r = ref.runs[key], texDiff = texs.map((h, i) => (h === r.tex[i] ? null : i)).filter((i) => i !== null);
    console.log(`${key}: textures ${texDiff.length ? `DIFFER at ${texDiff.join(',')} of ${texs.length}` : 'same'}; ticks ${firstLines ? `first DIFF at tick ${firstLines.tick}` : 'same'}`);
    if (firstLines) for (const l of firstLines.lines) console.log(`  ${l}`);
  }
}
if (ref) console.log(`env here: ${out.env}; ref: ${ref.env}`); else console.log(JSON.stringify(out));
