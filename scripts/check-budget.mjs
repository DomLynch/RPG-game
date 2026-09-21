import { readdir, readFile } from 'node:fs/promises';
import { basename, dirname, join, relative } from 'node:path';
import { gzipSync } from 'node:zlib';
// What a phone downloads for one duel: the shell (index.html + its script + its stylesheet), ONE audio format per sound file
// (the browser picks Opus or AAC, never both), the hero, ONE opponent, every arena prop, and only the shared texture files those
// GLBs reference. That is what the per-fight budget gates, at the worst opponent. The whole of dist/ is the host's storage, not
// the player's wait, and gets a looser ceiling so the roster can grow without the gate being raised every fighter.
// GLBs are classified from the source tree, never by name pattern: src/assets/*.glb are fighters (warrior is the hero),
// src/assets/arena/props/*.glb are props, src/assets/weapons/player/*.glb are player-equipped weapons (loaded only when worn, so
// they count toward the whole-of-dist storage cap below but never the per-fight download, same as loot.glb). A dist GLB
// matching none of these fails the gate rather than being guessed at.
const PER_FIGHT = 12_000_000, TOTAL = 32_000_000, LOOT = 1_500_000;   // gzip bytes; owner approved up to 12 MB per fight on 2026-09-19; loot.glb (Brief 5) under 1.5 MB, fetched after the first fight, never part of one.
// Headroom for useful content, not a target; the separate total-distribution cap is unchanged.
const dist = process.argv[2] || 'dist', src = process.argv[3] || 'src';

async function files(path) {
  const out = [];
  for (const entry of await readdir(path, { withFileTypes: true })) {
    const full = join(path, entry.name);
    if (entry.isDirectory()) out.push(...await files(full));
    else { const bytes = await readFile(full); out.push({ path: full, name: entry.name, bytes, raw: bytes.length, gzip: gzipSync(bytes).length }); }
  }
  return out;
}
const names = async (dir) => new Set((await readdir(dir).catch(() => [])).filter(n => n.endsWith('.glb')).map(n => n.slice(0, -4)));
// Vite emits `name-<hash>.ext`; the hash is 8 base64url characters. The stem is the source file's name.
const stem = (name) => name.replace(/-[A-Za-z0-9_-]{8}\.[a-z0-9]+$/, '');
// External images a GLB references (the shared textures the build externalised), resolved against the GLB's own directory.
export function glbImageUris(bytes) {
  if (bytes.length < 20 || bytes.toString('latin1', 0, 4) !== 'glTF' || bytes.toString('latin1', 16, 20) !== 'JSON') throw new Error('not a GLB');
  const json = JSON.parse(bytes.toString('utf8', 20, 20 + bytes.readUInt32LE(12)));
  return (json.images ?? []).map(i => i.uri).filter(Boolean);
}

export async function measure(distDir = dist, srcDir = src) {
  const all = await files(distDir), sum = (list, k) => list.reduce((n, f) => n + f[k], 0), byPath = new Map(all.map(f => [f.path, f]));
  const fighterNames = await names(srcDir + '/assets'), propNames = await names(srcDir + '/assets/arena/props'), equipNames = await names(srcDir + '/assets/weapons/player');
  const glbs = all.filter(f => f.name.endsWith('.glb'));
  const hero = glbs.filter(f => stem(f.name) === 'warrior'), props = glbs.filter(f => propNames.has(stem(f.name)));
  const loot = glbs.filter(f => stem(f.name) === 'loot'), opponents = glbs.filter(f => !['warrior', 'loot'].includes(stem(f.name)) && fighterNames.has(stem(f.name)));
  const equip = glbs.filter(f => equipNames.has(stem(f.name)));
  const unknown = glbs.filter(f => !hero.includes(f) && !props.includes(f) && !opponents.includes(f) && !loot.includes(f) && !equip.includes(f));
  if (unknown.length) throw new Error(`dist GLBs that are neither a fighter nor an arena prop in ${srcDir}: ${unknown.map(f => f.name).join(', ')}`);
  if (hero.length !== 1 || !opponents.length) throw new Error(`dist needs exactly one hero and at least one opponent GLB (${glbs.map(f => f.name).join(', ') || 'none'})`);
  const textures = (list) => {
    const seen = new Map();
    for (const glb of list) for (const uri of glbImageUris(glb.bytes)) {
      const file = byPath.get(join(dirname(glb.path), uri));
      if (!file) throw new Error(`${glb.name} references ${uri}, which is not in ${distDir}`);
      seen.set(file.path, file);
    }
    return [...seen.values()];
  };
  const shell = all.filter(f => relative(distDir, f.path) === 'index.html' || (dirname(relative(distDir, f.path)) === 'assets' && /\.(js|css)$/.test(f.name)));
  // One format per sound: the larger of the pair is what the budget assumes the phone fetches.
  const audioBy = new Map();
  for (const f of all.filter(f => /\.(ogg|m4a)$/.test(f.name))) { const key = stem(f.name); if ((audioBy.get(key)?.gzip ?? -1) < f.gzip) audioBy.set(key, f); }
  const audio = [...audioBy.values()];
  const base = [hero[0], ...props], baseTextures = textures(base), fixed = sum(shell, 'gzip') + sum(audio, 'gzip') + sum(base, 'gzip') + sum(baseTextures, 'gzip');
  const fights = opponents.map(opponent => {
    const own = textures([opponent]).filter(t => !baseTextures.includes(t));
    return { opponent, textures: own, gzip: fixed + opponent.gzip + sum(own, 'gzip') };
  });
  const worst = fights.reduce((a, b) => (b.gzip > a.gzip ? b : a));
  return {
    shell: sum(shell, 'gzip'), audio: sum(audio, 'gzip'), hero: hero[0].gzip, props: sum(props, 'gzip'), sharedTextures: sum(baseTextures, 'gzip'),
    opponent: worst.opponent.name, opponentGzip: worst.opponent.gzip, opponentTextures: sum(worst.textures, 'gzip'),
    fight: worst.gzip, fights: fights.map(f => ({ opponent: stem(f.opponent.name), gzip: f.gzip })), loot: sum(loot, 'gzip') + sum(textures(loot).filter(t => !baseTextures.includes(t)), 'gzip'), totalRaw: sum(all, 'raw'), total: sum(all, 'gzip'),
  };
}

if (process.argv[1] && basename(process.argv[1]) === 'check-budget.mjs') {
  const m = await measure();
  const breakdown = `shell ${m.shell} + audio ${m.audio} + hero ${m.hero} + props ${m.props} + shared textures ${m.sharedTextures} + worst opponent ${m.opponent} ${m.opponentGzip} (+ its textures ${m.opponentTextures})`;
  if (m.fight >= PER_FIGHT) throw new Error(`A duel exceeds ${PER_FIGHT / 1e6} MB gzip: ${breakdown} = ${m.fight}`);
  if (m.total >= TOTAL) throw new Error(`dist exceeds ${TOTAL / 1e6} MB gzip: ${m.total}`);
  if (m.loot >= LOOT) throw new Error(`loot.glb exceeds ${LOOT / 1e6} MB gzip: ${m.loot}`);
  console.log(`Per fight (${breakdown}): ${m.fight} bytes gzip of ${PER_FIGHT}; every pairing: ${m.fights.map(f => `${f.opponent} ${f.gzip}`).join(', ')}; loot ${m.loot} of ${LOOT}; all of dist: ${m.totalRaw} raw, ${m.total} gzip of ${TOTAL}. Budget PASS.`);
}
