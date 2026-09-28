import { readdir, readFile } from 'node:fs/promises';
import { basename, dirname, join, relative } from 'node:path';
import { gzipSync } from 'node:zlib';
import { LEVELS, OPPONENTS, opponentAt } from '../src/moves.ts';
import { ROSTER } from '../src/roster.ts';
import { LEGEND_OPPONENTS } from '../src/legends.ts';
// What a phone downloads for one duel: the shell (index.html + its script + its stylesheet), the opponent's versus still, ONE audio format per sound file
// (the browser picks Opus or AAC, never both), the hero, ONE opponent, every arena prop, and only the shared texture files those
// GLBs reference. That is what the per-fight budget gates, at the worst opponent. The whole of dist/ is the host's storage, not
// the player's wait, and gets a looser ceiling so the roster can grow without the gate being raised every fighter.
// GLBs are classified from the source tree, never by name pattern: src/assets/*.glb are fighters (warrior is the hero),
// src/assets/arena/props/*.glb are props, src/assets/weapons/player/*.glb are player-equipped weapons (loaded only when worn, so
// they count toward the whole-of-dist storage cap below but never the per-fight download, same as loot.glb). A dist GLB
// matching none of these fails the gate rather than being guessed at.
// Rank looks (Lead 2026-09-28, ruling b): each opponent's set has its own explicit storage line, and each file its own cap; they are out of
// TOTAL (which stays everything else) and out of the per-fight download (they stream after first playable, under the time gate).
// A look file for an opponent with no line here fails the gate. A set's phone-tier LODs (<opp>-L<n>-phone.glb, rank-look.ts PHONE_LOOKS)
// are their own set, <opp>-phone: a device fetches one tier's file, never both.
const LOOKS = { goblin: 22_000_000, plaguedoctor: 22_000_000, 'plaguedoctor-phone': 14_000_000, knight: 22_500_000, 'knight-phone': 15_500_000 }, LOOK_FILE = 2_600_000;
// Legend faces (versus card B4, Lead 2026-09-28): public/legends/<opponent>-<rung>.webp. A fight fetches ONE face (its rung's), so each
// fight counts its opponent's heaviest face; the set has its own storage line out of TOTAL (like LOOKS), and each face its own cap.
// PORTRAITS 4.0 → 4.8 MB (Lead 2026-09-28): GPT's 100 faces average ~47 KB gzip (4,693,984 B for the full set); faces are not re-encoded.
const PORTRAITS = 4_800_000, PORTRAIT_FILE = 48_000, PORTRAIT_NAME = new RegExp(`^(${LEGEND_OPPONENTS.join('|')})-(10|[1-9])\\.webp$`);
const PER_FIGHT = 12_000_000, TOTAL = 44_000_000, LOOT = 3_500_000, GUARD = 400_000;   // TOTAL 40 → 44 MB (Lead 2026-09-25, #705: ten carriers-* cuts +2.8 MB gzip; server storage, per-fight 12 MB unchanged)   // LOOT 2 → 3.5 MB (Phase R, Dom 2026-09-23): six-piece sets for all ten opponents; dist loot.glb 1,327,597 gzip for 27 pieces / 40 draws → ~49 KB a piece, +36 pieces ≈ 3.10 MB; loot.glb never counts toward PER_FIGHT   // LOOT 1.5 → 2 MB: four characters' Recruit-2 pieces on shared Steel, ~130 KB each (Strategy 2026-09-23)   // TOTAL 32 → 40 MB: four launch characters into beta (Dom 2026-09-23); total = server storage, per-fight unchanged   // guard.glb (Brief 13): the ring guards, in every fight's base, under 400 KB   // gzip bytes; owner approved up to 12 MB per fight on 2026-09-19; loot.glb (Brief 5) under 1.5 MB, fetched on its own once the rigs are in and the fighter owns something (never beside a fight's download, never part of a pairing).
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
// An opponent's rung-dependent kit (moves.ts opponentAt: the Centurion's gladius from Legionary) is a weapons/player equip file his page
// fetches with his rig whenever the fought weapon is not the one his body bakes (scene.ts `opponentEquip`), so it is part of his fight.
const foughtKit = (body) => new Set(Object.keys(ROSTER).filter((id) => ROSTER[id].body === body && OPPONENTS[id])
  .flatMap((id) => Array.from({ length: LEVELS }, (_, i) => opponentAt(OPPONENTS[id], i + 1).weapon).filter((w) => w !== ROSTER[id].weapon)));
// External images a GLB references (the shared textures the build externalised), resolved against the GLB's own directory.
export function glbImageUris(bytes) {
  if (bytes.length < 20 || bytes.toString('latin1', 0, 4) !== 'glTF' || bytes.toString('latin1', 16, 20) !== 'JSON') throw new Error('not a GLB');
  const json = JSON.parse(bytes.toString('utf8', 20, 20 + bytes.readUInt32LE(12)));
  return (json.images ?? []).map(i => i.uri).filter(Boolean);
}

export async function measure(distDir = dist, srcDir = src) {
  const all = await files(distDir), sum = (list, k) => list.reduce((n, f) => n + f[k], 0), byPath = new Map(all.map(f => [f.path, f]));
  const fighterNames = await names(srcDir + '/assets'), carrierNames = await names(srcDir + '/assets/loot'), propNames = await names(srcDir + '/assets/arena/props'), equipNames = await names(srcDir + '/assets/weapons/player');
  // Hero preview rigs (src/hero-preview.ts, public/herolook/): fetched only on a `?hero=` link, never by a fight, so they are no fighter,
  // prop or loot and stay out of every per-fight sum; they still count toward the total (server storage) and are reported on their own.
  const preview = all.filter(f => relative(distDir, f.path).split(/[\\/]/)[0] === 'herolook');
  // Rank looks (src/rank-look.ts, public/looks/<opponent>-L<n>.glb): streamed only after first playable and gated by time
  // (scripts/rank-look-check.mjs), so out of the per-fight download and the total; capped per set and per file below, and every image
  // one references must be in dist.
  const looks = all.filter(f => relative(distDir, f.path).split(/[\\/]/)[0] === 'looks' && f.name.endsWith('.glb'));
  const portraits = all.filter(f => relative(distDir, f.path).split(/[\\/]/)[0] === 'legends');
  const glbs = all.filter(f => f.name.endsWith('.glb') && !preview.includes(f) && !looks.includes(f));
  const hero = glbs.filter(f => stem(f.name) === 'warrior'), props = glbs.filter(f => propNames.has(stem(f.name)));
  const loot = glbs.filter(f => stem(f.name) === 'loot'), guard = glbs.filter(f => stem(f.name) === 'guard'), opponents = glbs.filter(f => !['warrior', 'loot', 'guard'].includes(stem(f.name)) && fighterNames.has(stem(f.name)));
  const equip = glbs.filter(f => equipNames.has(stem(f.name))), carriers = glbs.filter(f => carrierNames.has(stem(f.name)));
  const unknown = glbs.filter(f => !hero.includes(f) && !props.includes(f) && !opponents.includes(f) && !loot.includes(f) && !equip.includes(f) && !guard.includes(f) && !carriers.includes(f));
  if (unknown.length) throw new Error(`dist GLBs that are none of fighter, arena prop, loot or player-equipped weapon in ${srcDir}: ${unknown.map(f => f.name).join(', ')}`);
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
  const base = [hero[0], ...props, ...guard], baseTextures = textures(base), fixed = sum(shell, 'gzip') + sum(audio, 'gzip') + sum(base, 'gzip') + sum(baseTextures, 'gzip');
  // The versus card: main.ts shows public/versus/<opponent>.webp while the rigs download, so one still is part of every fight's fetch.
  const stills = new Map(all.filter(f => relative(distDir, f.path) === join('versus', f.name) && f.name.endsWith('.webp')).map(f => [f.name.slice(0, -5), f]));
  const fights = opponents.map(opponent => {
    // Phase L: an opponent with loot.glb carriers downloads his own cut (src/assets/loot/carriers-<opponent>.glb) with every fight.
    const carrier = carriers.filter(f => stem(f.name) === `carriers-${stem(opponent.name)}`);
    const kitNames = foughtKit(stem(opponent.name)), kit = equip.filter(f => kitNames.has(stem(f.name)));   // at his worst rung: every kit he can fight with
    const own = textures([opponent, ...carrier, ...kit]).filter(t => !baseTextures.includes(t)), still = stills.get(stem(opponent.name));
    const face = Math.max(0, ...portraits.filter(f => f.name.startsWith(`${stem(opponent.name)}-`)).map(f => f.gzip));   // his heaviest rung's face
    return { opponent, carrier: sum(carrier, 'gzip'), kit: sum(kit, 'gzip'), textures: own, still, face, gzip: fixed + opponent.gzip + sum(carrier, 'gzip') + sum(kit, 'gzip') + sum(own, 'gzip') + (still?.gzip ?? 0) + face };
  });
  const worst = fights.reduce((a, b) => (b.gzip > a.gzip ? b : a));
  const lookTextures = textures(looks).filter(t => !baseTextures.includes(t));   // throws on a look image that is not in dist
  return {
    shell: sum(shell, 'gzip'), audio: sum(audio, 'gzip'), hero: hero[0].gzip, props: sum(props, 'gzip'), sharedTextures: sum(baseTextures, 'gzip'),
    opponent: worst.opponent.name, opponentGzip: worst.opponent.gzip, opponentCarriers: worst.carrier, opponentKit: worst.kit, opponentTextures: sum(worst.textures, 'gzip'), opponentStill: worst.still?.gzip ?? 0, opponentFace: worst.face,
    portraits: sum(portraits, 'gzip'), portraitFiles: portraits.map(f => ({ name: f.name, gzip: f.gzip })),
    preview: sum(preview, 'gzip'), looks: sum(looks, 'gzip') + sum(lookTextures, 'gzip'), lookFiles: looks.map(f => ({ name: f.name, set: f.name.replace(/-L\d+(-phone)?\.glb$/, '$1'), gzip: f.gzip })), fight: worst.gzip, fights: fights.map(f => ({ opponent: stem(f.opponent.name), gzip: f.gzip })), loot: sum(loot, 'gzip') + sum(textures(loot).filter(t => !baseTextures.includes(t)), 'gzip'), guard: sum(guard, 'gzip') + sum(textures(guard).filter(t => !textures([hero[0], ...props]).includes(t)), 'gzip'), totalRaw: sum(all.filter(f => !looks.includes(f) && !portraits.includes(f)), 'raw'), total: sum(all.filter(f => !looks.includes(f) && !portraits.includes(f)), 'gzip'),
  };
}

if (process.argv[1] && basename(process.argv[1]) === 'check-budget.mjs') {
  const m = await measure();
  const breakdown = `shell ${m.shell} + audio ${m.audio} + hero ${m.hero} + props ${m.props} + shared textures ${m.sharedTextures} + worst opponent ${m.opponent} ${m.opponentGzip} (+ its carriers ${m.opponentCarriers} + its rung kit ${m.opponentKit} + its textures ${m.opponentTextures} + its versus still ${m.opponentStill} + its heaviest legend face ${m.opponentFace})`;
  if (m.fight >= PER_FIGHT) throw new Error(`A duel exceeds ${PER_FIGHT / 1e6} MB gzip: ${breakdown} = ${m.fight}`);
  if (m.total >= TOTAL) throw new Error(`dist exceeds ${TOTAL / 1e6} MB gzip: ${m.total}`);
  for (const f of m.portraitFiles) {
    if (!PORTRAIT_NAME.test(f.name)) throw new Error(`legend face ${f.name} is not legends/<legend opponent>-<rung 1..10>.webp`);
    if (f.gzip >= PORTRAIT_FILE) throw new Error(`legend face ${f.name} is ${f.gzip} bytes gzip, over the ${PORTRAIT_FILE} per-face cap`);
  }
  if (m.portraits >= PORTRAITS) throw new Error(`the legend faces exceed ${PORTRAITS / 1e6} MB gzip: ${m.portraits}`);
  if (m.loot >= LOOT) throw new Error(`loot.glb exceeds ${LOOT / 1e6} MB gzip: ${m.loot}`);
  for (const f of m.lookFiles) {
    if (!(f.set in LOOKS)) throw new Error(`rank look ${f.name} has no storage line in check-budget LOOKS (one per opponent set)`);
    if (f.gzip >= LOOK_FILE) throw new Error(`rank look ${f.name} exceeds ${LOOK_FILE / 1e6} MB gzip: ${f.gzip}`);
  }
  const lookSets = Object.keys(LOOKS).map(set => ({ set, gzip: m.lookFiles.filter(f => f.set === set).reduce((n, f) => n + f.gzip, 0), files: m.lookFiles.filter(f => f.set === set).length }));
  for (const { set, gzip } of lookSets) if (gzip >= LOOKS[set]) throw new Error(`the ${set} rank looks exceed ${LOOKS[set] / 1e6} MB gzip: ${gzip}`);
  if (m.guard >= GUARD) throw new Error(`guard.glb exceeds ${GUARD / 1e3} KB gzip: ${m.guard}`);
  console.log(`Per fight (${breakdown}): ${m.fight} bytes gzip of ${PER_FIGHT}; every pairing: ${m.fights.map(f => `${f.opponent} ${f.gzip}`).join(', ')}; loot ${m.loot} of ${LOOT}; rank looks ${lookSets.map(l => `${l.set} ${l.gzip} of ${LOOKS[l.set]} (${l.files} files, each < ${LOOK_FILE})`).join(', ')}; legend faces ${m.portraits} of ${PORTRAITS} (${m.portraitFiles.length} files, each < ${PORTRAIT_FILE}); guard ${m.guard} of ${GUARD}; all of dist: ${m.totalRaw} raw, ${m.total} gzip of ${TOTAL}. Budget PASS.`);
}
