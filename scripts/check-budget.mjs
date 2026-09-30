import { readdir, readFile } from 'node:fs/promises';
import { basename, dirname, join, relative } from 'node:path';
import { gzipSync } from 'node:zlib';
import { LEVELS, OPPONENTS, opponentAt } from '../src/moves.ts';
import { ROSTER } from '../src/roster.ts';
import { LEGEND_OPPONENTS } from '../src/legends.ts';
import { PHONE_LOOKS } from '../src/rank-look.ts';
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
// knight 22.5 MB (set 22,124,123 B) and knight-phone 15.5 MB (set 15,126,810 B: the rebaked files carry their own armour atlas) — Lead 19:4x,
// storage-only, per-file cap binds (a device fetches one tier and one rank at a time; LOOK_FILE and rows 5a/5c are the phone's bounds;
// a full-tier file of a set with phone LODs has DESKTOP_LOOK_FILE, Strategy 2026-09-30 10:1x).
// nightborn 21 MB (set 20,357,334 B) and nightborn-phone 16 MB (set ~15.56 MB) — Lead 20:3x, storage-only, per-file cap binds.
// nightborn 21 → 22.8 MB (Strategy 2026-09-30, Dom's AAA-quality ask; lossless re-encode only): the L1 Recruit full as delivered (nightborn-L1.glb
// 5,531,339 B, DESKTOP_LOOK_SET 5.6 MB); set measured 22,729,937 B. nightborn-phone unchanged (set 13,941,974 B with the L1 phone 1,580,398: head draws in extras.resized, Lead FIX).
// dwarf 17 MB (set 16,460,773 B) and dwarf-phone 14.5 MB (set 14,102,573 B) — Lead 21:1x, storage-only, per-file cap binds.
// dwarf 17 → 22 MB and dwarf-phone 14.5 → 15.5 MB (Armour 2026-09-30, the L1 Recruit): sets measured 21,585,548 B (dwarf-L1.glb 5,124,775 as
// delivered, see DESKTOP_LOOK_SET) and 15,029,155 B (dwarf-L1-phone.glb 926,582).
// witch 22 MB (set 19,436,244 B) and witch-phone 14 MB (set 12,469,597 B) — Lead 2026-09-29 08:5x (measured + ≤ 15 %), storage-only, per-file cap binds.
// pitborn 23.9 MB (set 20,868,057 B) and pitborn-phone 16 MB (set 13,962,796 B) — Armour's measure, Lead 2026-09-29 (measured + ≤ 15 %), storage-only, per-file cap binds.
// veteran 15.4 MB (set 13,464,211 B) and veteran-phone 15.1 MB (set 13,221,748 B) — Armour's measure, Lead 2026-09-29 (measured + ≤ 15 %), storage-only, per-file cap binds; L6 not in the set.
// shieldmaiden 24 MB (set 20,901,931 B, ×1.148) and shieldmaiden-phone 16.65 MB (set 14,495,425 B, ×1.149) — Armour's gz gate lines, Lead 2026-09-29
// (measured + ≤ 15 %; Armour's 16.7 MB phone was ×1.152), storage-only, per-file cap binds.
// plaguedoctor 22.0 → 22.5 MB (Strategy 2026-09-30, Lead away): L1 Recruit added to a 10-look set; measured 22,092,609 B (+0.4 %); phone set
// 13.09 of 14 MB unchanged; Dom's graphics-over-perf rule (2026-09-29) beats cutting q88 or coarsening the mesh. Each opponent's L1 checks its own line the same way.
// plaguedoctor 22.5 → 22.6 MB (Lead 2026-09-30, Strategy's standing "as delivered" rule): the L1 full carries GPT's 2048² garment map as delivered
// (was 1024² q88); set 22,536,650 B. The phone keeps its 1024 map (L1_Armour + L1_FittedGloves in extras.rebaked: a 2048² map is ~21.3 MiB of the 22 MiB phone 5b).
// executioner 22.3 MB (set 19,426,880 B) and executioner-phone 14 MB (set 12,183,621 B) — Armour's measure ×1.15 down, Lead 2026-09-29,
// storage-only; the 2.6 MB LOOK_FILE cap binds each full file (largest L10 2,353,605 B).
// Per-set desktop caps (full tier only; the -phone file keeps LOOK_FILE): the Dwarf L1 Recruit ships GPT's maps and mesh as delivered
// (Strategy/Lead 2026-09-30 10:3x, Dom's AAA ask: the one-atlas rebake measured a visible weave/skin drop at close-up), 5,124,775 B gzip.
const DESKTOP_LOOK_SET = { dwarf: 5_200_000, nightborn: 5_600_000 };
const LOOKS = { goblin: 22_000_000, plaguedoctor: 22_600_000, 'plaguedoctor-phone': 14_000_000, knight: 22_500_000, 'knight-phone': 15_500_000, nightborn: 22_800_000, 'nightborn-phone': 16_000_000, dwarf: 22_000_000, 'dwarf-phone': 15_500_000, witch: 22_000_000, 'witch-phone': 14_000_000, pitborn: 23_900_000, 'pitborn-phone': 16_000_000, veteran: 15_400_000, 'veteran-phone': 15_100_000, shieldmaiden: 24_000_000, 'shieldmaiden-phone': 16_650_000, executioner: 22_300_000, 'executioner-phone': 14_000_000 }, LOOK_FILE = 2_600_000, DESKTOP_LOOK_FILE = 3_200_000;
// Legend faces (versus card B4, Lead 2026-09-28): public/legends/<opponent>-<rung>.webp. A fight fetches ONE face (its rung's), so each
// fight counts its opponent's heaviest face; the set has its own storage line out of TOTAL (like LOOKS), and each face its own cap.
// PORTRAITS 4.0 → 4.8 MB (Lead 2026-09-28): GPT's 100 faces average ~47 KB gzip (4,693,984 B for the full set); faces are not re-encoded.
const PORTRAITS = 4_800_000, PORTRAIT_FILE = 48_000, PORTRAIT_NAME = new RegExp(`^(${LEGEND_OPPONENTS.join('|')})-(10|[1-9])\\.webp$`);
// Weapon shapes per rank (src/weapon-shapes.ts, public/weapons/shapes/<shape>-<band>.glb, Dom 2026-09-28 "implement the maul"): fetched
// after the rigs load, never gating first playable; a fight fetches at most two (the player's file and his). Each weapon's set has its own
// storage line out of TOTAL (like LOOKS) and each file its own cap. maul 3.3 MB (GPT v2 trio: 809,837 + 995,045 + 1,235,724 B gzip);
// The per-file cap is 1.45 MB (Lead 2026-09-28, #1040: GPT longsword-ornate 1,424,289 B gzip, sha-pinned, a repack would break the sha). Shapes
// sit outside TOTAL and the per-fight figure; one fight's worst case is two ornate files, longsword + maul = 2,660,013 B on top of PER_FIGHT.
// longsword 3.7 MB (Strategy 22:3x, GPT trio: 1,028,636 + 1,216,573 + 1,424,289 B gzip).
// gladius 3.4 MB (Lead 2026-09-28 23:1x, GPT trio: 962,963 + 1,087,970 + 1,277,666 B gzip).
// knife 3.6 MB (Lead 2026-09-28 23:1x, GPT trio: 1,037,517 + 1,187,592 + 1,316,616 B gzip).
// estoc 3.2 MB (Lead 2026-09-28 23:3x, GPT trio: 861,143 + 1,031,141 + 1,273,772 B gzip); generic (player + Nightborn), not the PD cane.
// cleaver 3.4 MB (Lead 2026-09-28 23:3x, GPT trio: 987,853 + 1,035,909 + 1,340,247 B gzip); carriers Pitborn, Werewolf, the player.
// scythe 2.9 MB (Strategy 2026-09-29, GPT trio: 772,534 + 971,523 + 1,112,176 B gzip); carriers the Executioner, the player.
// trident 2.6 MB (Strategy 2026-09-29, GPT trio: 780,219 + 762,939 + 958,596 B gzip); carriers the Centurion below LEVEL_ANCHORS.easy, the player. The Witch keeps her stock trident (SHAPE_OVERRIDES).
// warhammer 2.6 MB (Strategy/Dom 2026-09-29, GPT trio Soldier / Forgemaster / Drake King: 701,325 + 835,561 + 1,037,399 B gzip); carriers the Dwarf, the player.
// reaper 2.1 MB (Strategy/Dom 2026-09-29, GPT trio Harvester / Raven Edge / Soul Crown: 673,249 + 653,337 + 765,852 B gzip); carrier the Wraith (held for beta), wired so it is ready.
// estoc-cane 2.3 MB (Dom GO 2026-09-29, GPT v2 trio Field Doctor / Physician / Raven Relic: 711,281 + 684,812 + 798,554 B gzip); carrier the Plague Doctor only (SHAPE_OVERRIDES).
// witch-staff 2.6 MB (Dom GO 2026-09-29 11:2x, GPT trio Hedge Witch / Coven / Crone Queen: 809,052 + 631,194 + 1,010,973 B gzip); carrier the Witch only (SHAPE_OVERRIDES).
const SHAPES = { maul: 3_300_000, longsword: 3_700_000, gladius: 3_400_000, knife: 3_600_000, estoc: 3_200_000, cleaver: 3_400_000, scythe: 2_900_000, trident: 2_600_000, warhammer: 2_600_000, reaper: 2_100_000, 'estoc-cane': 2_300_000, 'witch-staff': 2_600_000 }, SHAPE_FILE = 1_450_000;
// A file's set is the longest SHAPES key it starts with (`maul-plain.glb`, a later per-rank `maul-9.glb`: maul).
const shapeSet = (name) => Object.keys(SHAPES).filter(set => name.startsWith(`${set}-`)).sort((a, b) => b.length - a.length)[0];
// Hero preview rigs (public/herolook/, Strategy via Lead 2026-09-29): their own storage line out of TOTAL, which bounds what a player's fights
// download; only Dom's `?hero=` link fetches them. 4.65 MB = measured 4,053,116 B gzip (legionary.glb, dist 48788d3c) + ≤ 15 %.
const PREVIEW = 4_650_000;
// The Pit (docs/pit-design.md §6, Lead 2026-09-29): src/pit/pit.ts's lazy chunk, assets/pit-<hash>.js. It is fetched after a kill and never
// during a fight's download, so it stays out of the per-fight shell but inside TOTAL. 40 KB gzip is the design budget (~1,000 lines at the
// souls-look chunk's measured ~32 B gzip a line: 6,597 B for 209 lines, live 303af39e); the first room PR states the measured figure.
const PIT = 40_000, PIT_CHUNK = /^pit-[A-Za-z0-9_-]+\.js$/;
// Pit assets (Lead 2026-09-30, caps on World's measurement): the GPT props and stone maps the Pit fetches after a fight, never a fight's
// own download. Ship copies land under public/pit/ -> dist/pit/ (props/*.glb, stone/<maps>; the path is this gate's, agreed with World as the
// intake owner). Their own storage line out of TOTAL, like LOOKS. gzip bytes, as every line here: each GLB under pit/ < 300 KB, the prop pack
// (every GLB under pit/) < 1.2 MB, each stone map (an image under pit/) < 150 KB and the set < 1.2 MB, everything under pit/ < 2.5 MB on
// the phone path. A full-tier-only 1024 stone set, if it ever ships, lives under pit/desktop/ and counts against its own desktop line
// (the tier-split pattern, as <opp>-phone looks): maps only there, per map < 600 KB and the set < 4.8 MB (Lead's ruling 2026-09-30: the full
// tier only, never on the phone path, graphics-first, and it ships only if 512 reads soft on desktop). With no files the row passes at 0 B.
const PIT_ASSETS = { glb: 300_000, pack: 1_200_000, map: 150_000, maps: 1_200_000, total: 2_500_000 }, PIT_ASSETS_DESKTOP = { map: 600_000, maps: 4_800_000 };
const PIT_IMAGE = /\.(jpe?g|png|webp|ktx2|basis)$/i;
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
  // prop or loot and stay out of every per-fight sum and out of TOTAL; their own storage line is PREVIEW, and no GLB a fight fetches may
  // reference an image under herolook/ (textures() below).
  const preview = all.filter(f => relative(distDir, f.path).split(/[\\/]/)[0] === 'herolook');
  // Rank looks (src/rank-look.ts, public/looks/<opponent>-L<n>.glb): streamed only after first playable and gated by time
  // (scripts/rank-look-check.mjs), so out of the per-fight download and the total; capped per set and per file below, and every image
  // one references must be in dist.
  const looks = all.filter(f => relative(distDir, f.path).split(/[\\/]/)[0] === 'looks' && f.name.endsWith('.glb'));
  const portraits = all.filter(f => relative(distDir, f.path).split(/[\\/]/)[0] === 'legends');
  const shapes = all.filter(f => relative(distDir, f.path).split(/[\\/]/).slice(0, 2).join('/') === 'weapons/shapes' && f.name.endsWith('.glb'));
  const pitAssets = all.filter(f => relative(distDir, f.path).split(/[\\/]/)[0] === 'pit');   // the Pit's props and maps (PIT): their own line, no fight's
  const glbs = all.filter(f => f.name.endsWith('.glb') && !preview.includes(f) && !looks.includes(f) && !shapes.includes(f) && !pitAssets.includes(f));
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
      if (preview.includes(file)) throw new Error(`${glb.name} references ${uri}, under herolook/, which only the ?hero= preview may fetch`);
      seen.set(file.path, file);
    }
    return [...seen.values()];
  };
  const pit = all.filter(f => dirname(relative(distDir, f.path)) === 'assets' && PIT_CHUNK.test(f.name));
  const shell = all.filter(f => !pit.includes(f) && (relative(distDir, f.path) === 'index.html' || (dirname(relative(distDir, f.path)) === 'assets' && /\.(js|css)$/.test(f.name))));
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
  textures(pitAssets.filter(f => f.name.endsWith('.glb')));   // throws on a Pit GLB whose image is not in dist (a map it names counts under pit/ already)
  return {
    shell: sum(shell, 'gzip'), audio: sum(audio, 'gzip'), hero: hero[0].gzip, props: sum(props, 'gzip'), sharedTextures: sum(baseTextures, 'gzip'),
    opponent: worst.opponent.name, opponentGzip: worst.opponent.gzip, opponentCarriers: worst.carrier, opponentKit: worst.kit, opponentTextures: sum(worst.textures, 'gzip'), opponentStill: worst.still?.gzip ?? 0, opponentFace: worst.face,
    pit: sum(pit, 'gzip'), portraits: sum(portraits, 'gzip'), portraitFiles: portraits.map(f => ({ name: f.name, gzip: f.gzip })),
    preview: sum(preview, 'gzip'), looks: sum(looks, 'gzip') + sum(lookTextures, 'gzip'), lookFiles: looks.map(f => ({ name: f.name, set: f.name.replace(/-L\d+(-phone)?\.glb$/, '$1'), gzip: f.gzip })), fight: worst.gzip, fights: fights.map(f => ({ opponent: stem(f.opponent.name), gzip: f.gzip })), loot: sum(loot, 'gzip') + sum(textures(loot).filter(t => !baseTextures.includes(t)), 'gzip'), guard: sum(guard, 'gzip') + sum(textures(guard).filter(t => !textures([hero[0], ...props]).includes(t)), 'gzip'), totalRaw: sum(all.filter(f => !looks.includes(f) && !portraits.includes(f) && !shapes.includes(f) && !preview.includes(f) && !pitAssets.includes(f)), 'raw'), total: sum(all.filter(f => !looks.includes(f) && !portraits.includes(f) && !shapes.includes(f) && !preview.includes(f) && !pitAssets.includes(f)), 'gzip'), shapeFiles: shapes.map(f => ({ name: f.name, set: shapeSet(f.name), gzip: f.gzip })),
    pitFiles: pitAssets.map(f => { const rel = relative(distDir, f.path).split(/[\\/]/).join('/'); return { name: rel, glb: f.name.endsWith('.glb'), map: PIT_IMAGE.test(f.name), desktop: rel.split('/')[1] === 'desktop', gzip: f.gzip }; }),
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
  if (m.preview >= PREVIEW) throw new Error(`the hero preview rigs (herolook/) exceed ${PREVIEW / 1e6} MB gzip: ${m.preview}`);
  if (m.loot >= LOOT) throw new Error(`loot.glb exceeds ${LOOT / 1e6} MB gzip: ${m.loot}`);
  for (const f of m.lookFiles) {
    if (!(f.set in LOOKS)) throw new Error(`rank look ${f.name} has no storage line in check-budget LOOKS (one per opponent set)`);
    // Tiers (Strategy 2026-09-30 10:1x, Dom's AAA-quality ask): a full-tier file of a set with phone LODs (PHONE_LOOKS) never reaches a phone,
    // which streams its -phone file, so the desktop cap binds it. A -phone file, and the one file of a set without LODs, keep LOOK_FILE.
    const cap = PHONE_LOOKS.has(f.set) ? (DESKTOP_LOOK_SET[f.set] ?? DESKTOP_LOOK_FILE) : LOOK_FILE;
    if (f.gzip >= cap) throw new Error(`rank look ${f.name} exceeds ${cap / 1e6} MB gzip: ${f.gzip}`);
  }
  for (const f of m.shapeFiles) {
    if (!f.set || !(f.set in SHAPES)) throw new Error(`weapon shape ${f.name} has no storage line in check-budget SHAPES (one per weapon set)`);
    if (f.gzip >= SHAPE_FILE) throw new Error(`weapon shape ${f.name} exceeds ${SHAPE_FILE / 1e6} MB gzip: ${f.gzip}`);
  }
  const shapeSets = Object.keys(SHAPES).map(set => ({ set, gzip: m.shapeFiles.filter(f => f.set === set).reduce((n, f) => n + f.gzip, 0) }));
  for (const { set, gzip } of shapeSets) if (gzip >= SHAPES[set]) throw new Error(`the ${set} weapon shapes exceed ${SHAPES[set] / 1e6} MB gzip: ${gzip}`);
  const lookSets = Object.keys(LOOKS).map(set => ({ set, gzip: m.lookFiles.filter(f => f.set === set).reduce((n, f) => n + f.gzip, 0), files: m.lookFiles.filter(f => f.set === set).length }));
  for (const { set, gzip } of lookSets) if (gzip >= LOOKS[set]) throw new Error(`the ${set} rank looks exceed ${LOOKS[set] / 1e6} MB gzip: ${gzip}`);
  if (m.pit >= PIT) throw new Error(`the Pit chunk (assets/pit-*.js) exceeds ${PIT / 1e3} KB gzip: ${m.pit}`);
  if (m.guard >= GUARD) throw new Error(`guard.glb exceeds ${GUARD / 1e3} KB gzip: ${m.guard}`);
  const pitPhone = m.pitFiles.filter(f => !f.desktop), pitDesktop = m.pitFiles.filter(f => f.desktop), pitSum = (list) => list.reduce((n, f) => n + f.gzip, 0);
  for (const f of pitPhone) {
    if (f.glb && f.gzip >= PIT_ASSETS.glb) throw new Error(`Pit GLB ${f.name} exceeds ${PIT_ASSETS.glb / 1e3} KB gzip: ${f.gzip}`);
    if (f.map && f.gzip >= PIT_ASSETS.map) throw new Error(`Pit stone map ${f.name} exceeds ${PIT_ASSETS.map / 1e3} KB gzip: ${f.gzip}`);
  }
  const pitPack = pitSum(pitPhone.filter(f => f.glb)), pitMaps = pitSum(pitPhone.filter(f => f.map)), pitTotal = pitSum(pitPhone), pitDesktopMaps = pitSum(pitDesktop);
  if (pitPack >= PIT_ASSETS.pack) throw new Error(`the Pit prop pack (pit/**/*.glb) exceeds ${PIT_ASSETS.pack / 1e6} MB gzip: ${pitPack}`);
  if (pitMaps >= PIT_ASSETS.maps) throw new Error(`the Pit stone maps (pit/ images) exceed ${PIT_ASSETS.maps / 1e6} MB gzip: ${pitMaps}`);
  if (pitTotal >= PIT_ASSETS.total) throw new Error(`the Pit assets (pit/) exceed ${PIT_ASSETS.total / 1e6} MB gzip on the phone path: ${pitTotal}`);
  for (const f of pitDesktop) {
    if (!f.map) throw new Error(`pit/desktop/ carries the full-tier stone maps only; ${f.name} is not an image`);
    if (f.gzip >= PIT_ASSETS_DESKTOP.map) throw new Error(`Pit desktop stone map ${f.name} exceeds ${PIT_ASSETS_DESKTOP.map / 1e3} KB gzip: ${f.gzip}`);
  }
  if (pitDesktopMaps >= PIT_ASSETS_DESKTOP.maps) throw new Error(`the Pit desktop stone set (pit/desktop/) exceeds ${PIT_ASSETS_DESKTOP.maps / 1e6} MB gzip: ${pitDesktopMaps}`);
  console.log(`Pit assets (pit/, phone path): ${pitTotal} of ${PIT_ASSETS.total} gzip (prop pack ${pitPack} of ${PIT_ASSETS.pack}, stone maps ${pitMaps} of ${PIT_ASSETS.maps}; per GLB ${PIT_ASSETS.glb}, per map ${PIT_ASSETS.map}); desktop stone set ${pitDesktopMaps} of ${PIT_ASSETS_DESKTOP.maps}`);
  console.log(`Per fight (${breakdown}): ${m.fight} bytes gzip of ${PER_FIGHT}; every pairing: ${m.fights.map(f => `${f.opponent} ${f.gzip}`).join(', ')}; loot ${m.loot} of ${LOOT}; rank looks ${lookSets.map(l => `${l.set} ${l.gzip} of ${LOOKS[l.set]} (${l.files} files, each < ${LOOK_FILE})`).join(', ')}; legend faces ${m.portraits} of ${PORTRAITS} (${m.portraitFiles.length} files, each < ${PORTRAIT_FILE}); guard ${m.guard} of ${GUARD}; the Pit ${m.pit} of ${PIT}; hero previews ${m.preview} of ${PREVIEW}; all of dist: ${m.totalRaw} raw, ${m.total} gzip of ${TOTAL}. Budget PASS.`);
  console.log(`Weapon shapes: ${shapeSets.map(l => `${l.set} ${l.gzip} of ${SHAPES[l.set]}`).join(', ') || 'none'} (per file cap ${SHAPE_FILE})`);
}
