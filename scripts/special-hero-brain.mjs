// Specials ON vs OFF with the hero brain (Strategy 2026-10-02: measure, don't tune). The hero side runs the ladder's own brain (ai.ts decide at
// PROFILES.normal, the brain tests/opponents.test.ts calls "the hero brain") in the longsword body against every ladder opponent at the
// opponent's own level profile; both sides cast whenever ready and in reach (the AI's rule). Same seeds OFF and ON. Win = the hero's side
// survives (a double kill is a loss, as in the battery).   node scripts/special-hero-brain.mjs --opponents goblin --levels 1,6,... --seeds 24 --json out.json
//   node scripts/special-hero-brain.mjs --merge <dir> [--out report.md]
/* global process, console */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { decide, initialAi } from '../src/ai.ts';
import { stepDuel, withSpecials } from '../src/duel.ts';
import { LADDER } from '../src/ladder.ts';
import { OPPONENTS, PROFILES, opponentAt, profileAt, RULES } from '../src/moves.ts';
import { skillOf } from '../src/loot.ts';
import { arena } from '../tests/strategies.ts';

const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : fallback; };
const BANDS = [['ranks 1-3', 1, 15], ['ranks 4-7', 16, 35], ['ranks 8-10', 36, 50]];

function fight(level, seed, opponent, specials) {
  const profile = profileAt(opponent, level), base = arena(opponentAt(opponent, level), 'longsword', 'pommel');
  let d = specials ? withSpecials(base, level, skillOf(opponent.id)) : base;
  let hero = initialAi(((seed * 2654435761) >>> 0) ^ 0x9e3779b9), foe = initialAi((seed * 2654435761) >>> 0);
  const r = { landedHero: 0, landedFoe: 0, killShot: false, killHero: false, killFoe: false };
  for (let i = 0; i < 7200 && !d.finish; i++) {
    const a = decide(d, 0, hero, PROFILES.normal), b = decide(d, 1, foe, profile); hero = a.ai; foe = b.ai;
    d = stepDuel(d, [a.intent, b.intent]);
    for (const e of d.events) if (e.type === 'SpecialLanded') { if (e.actor === 0) r.landedHero++; else r.landedFoe++; if (!d.fighters[e.target].health) { r.killShot = true; if (e.actor === 0) r.killHero = true; else r.killFoe = true; } }
  }
  return { ...r, win: !!d.finish && !d.finish.draw && d.finish.victim === 1, finished: !!d.finish, ticks: d.tick };
}

if (arg('merge')) {
  const dir = arg('merge'), rows = readdirSync(dir).filter(f => f.endsWith('.json')).flatMap(f => JSON.parse(readFileSync(`${dir}/${f}`, 'utf8')).cells);
  const seeds = JSON.parse(readFileSync(`${dir}/${readdirSync(dir).find(f => f.endsWith('.json'))}`, 'utf8')).seeds;
  const sum = (list, k, m) => list.reduce((s, c) => s + (c.modes[m][k] ?? 0), 0);
  const out = ['### Specials ON vs OFF, hero brain (ai.ts decide, PROFILES.normal, longsword + Pommel) vs every ladder opponent', '',
    `${seeds} paired seeds per cell, levels 1 6 12 | 18 30 | 36 41 46 = ranks 1-3 | 4-7 | 8-10. Win % is the hero brain's. "Lands/fight" = specials landed per fight (both sides, ON). "Kill shot" = % of ON fights ended by a special's killing blow. FLAG = |ON - OFF| > 10 points.`, '',
    '| Opponent | Band | Hero win OFF | Hero win ON | Swing, pts | Lands / fight (hero + foe) | Kill shot, % of fights (hero's special / opponent's special) | Flag |', '|---|---|---|---|---|---|---|---|'];
  const flagged = [];
  for (const o of [...new Set(rows.map(c => c.opponent))]) for (const [name, lo, hi] of [...BANDS, ['all', 1, 50]]) {
    const g = rows.filter(c => c.opponent === o && c.level >= lo && c.level <= hi); if (!g.length) continue;
    const n = sum(g, 'fights', 'on'), wOff = 100 * sum(g, 'wins', 'off') / n, wOn = 100 * sum(g, 'wins', 'on') / n, d = wOn - wOff;
    const flag = Math.abs(d) > 10 && name !== 'all' ? 'FLAG' : ''; if (flag) flagged.push(`${o} ${name} ${d > 0 ? '+' : ''}${d.toFixed(1)}`);
    out.push(`| ${o} | ${name} | ${wOff.toFixed(0)} % | ${wOn.toFixed(0)} % | ${d > 0 ? '+' : ''}${d.toFixed(1)} | ${(sum(g, 'landedHero', 'on') / n).toFixed(2)} + ${(sum(g, 'landedFoe', 'on') / n).toFixed(2)} | ${(100 * sum(g, 'killShots', 'on') / n).toFixed(0)} (${(100 * sum(g, 'killHero', 'on') / n).toFixed(0)} / ${(100 * sum(g, 'killFoe', 'on') / n).toFixed(0)}) | ${flag} |`);
  }
  out.push('', flagged.length ? `**Flagged (more than 10 pts): ${flagged.join('; ')}**` : '**No opponent/band moves the hero brain by more than 10 points.**');
  const md = out.join('\n'); console.log(md); if (arg('out')) writeFileSync(arg('out'), md + '\n');
} else {
  const opponents = arg('opponents', LADDER.map(o => o.id).join(',')).split(','), levels = arg('levels', '1,6,12,18,30,36,41,46').split(',').map(Number), seeds = Number(arg('seeds', 24));
  const cells = [];
  for (const id of opponents) for (const level of levels) {
    const mode = () => ({ wins: 0, fights: 0, landedHero: 0, landedFoe: 0, killShots: 0, killHero: 0, killFoe: 0, unfinished: 0 }), m = { off: mode(), on: mode() };
    for (let s = 1; s <= seeds; s++) for (const k of ['off', 'on']) {
      const r = fight(level, s, OPPONENTS[id], k === 'on'), t = m[k];
      t.fights++; t.wins += +r.win; t.landedHero += r.landedHero; t.landedFoe += r.landedFoe; t.killShots += +(r.finished && r.killShot); t.killHero += +(r.finished && r.killHero); t.killFoe += +(r.finished && r.killFoe); t.unfinished += +!r.finished;
    }
    cells.push({ opponent: id, level, modes: m }); console.log(id, level, JSON.stringify(m));
  }
  if (arg('json')) writeFileSync(arg('json'), JSON.stringify({ rule: RULES.special, seeds, cells }));
}
