// Special Moves prototype numbers (Lead's brief, 2026-09-29): the strategy battery (tests/strategies.ts STRATEGIES + the tap-attacking
// first-timer) against every ladder opponent at six ladder levels, each fight run with the prototype special OFF and ON over the same
// seeds (tests/special-proto.ts). CI only (.github/workflows/special-battery.yml): one shard per opponent writes JSON, then --merge renders
// the markdown for the job summary and the PR body.
//   node scripts/special-battery.mjs --opponents goblin,dwarf [--levels 1,6,12,18,30,46] [--seeds 24] --json out.json
//   node scripts/special-battery.mjs --merge <dir of shard JSON>
/* global process, console */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { LADDER } from '../src/ladder.ts';
import { OPPONENTS } from '../src/moves.ts';
import { PLAYER_DODGE, SPECIAL, cell } from '../tests/special-proto.ts';
import { STRATEGIES, TAP_ATTACK } from '../tests/strategies.ts';

const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : fallback; };
const FLAG = 3;   // win-rate move, in points, that the brief asks about ("more than a few points")

if (arg('merge')) {
  const dir = arg('merge'), cells = readdirSync(dir).filter(f => f.endsWith('.json')).flatMap(f => JSON.parse(readFileSync(`${dir}/${f}`, 'utf8')).cells);
  const meta = JSON.parse(readFileSync(`${dir}/${readdirSync(dir).find(f => f.endsWith('.json'))}`, 'utf8'));
  const pct = (a, b) => (b ? (100 * a / b).toFixed(1) : '–'), sec = (t, n) => (n ? (t / n / 60).toFixed(1) : '–');
  const sum = list => list.reduce((s, c) => {
    for (const k of ['fights', 'winsOff', 'winsOn', 'ticksOff', 'ticksOn', 'finishedOff', 'finishedOn', 'flipped', 'specialKills']) s[k] = (s[k] ?? 0) + c[k];
    for (const who of ['player', 'ai']) { s[who] ??= {}; for (const [k, v] of Object.entries(c[who])) s[who][k] = (s[who][k] ?? 0) + v; }
    return s;
  }, {});
  const evaded = t => t.dodged + t.outranged, resolved = t => t.landed + t.dodged + t.outranged;
  const levels = [...new Set(cells.map(c => c.level))].sort((a, b) => a - b), opponents = [...new Set(cells.map(c => c.opponent))];
  const out = [];
  out.push(`### Special Moves prototype — strategy battery, special OFF vs ON (paired seeds)`, '',
    `Rule: windup ${meta.rule.windup} ticks (${(meta.rule.windup / 60).toFixed(2)} s), cooldown ${meta.rule.cooldown / 60} s, first at ${meta.rule.first / 60} s, reach ${meta.rule.reach} m, damage ${meta.rule.damage * 100} % of max health, unblockable; dodged by a roll's i-frames or by being out of reach at contact. ` +
    `Both sides cast whenever it is ready and in reach (upper bound). Scripted player's dodge (assumption): reaction ${meta.player.reaction} ticks, lapse ${meta.player.lapse}, accuracy ${meta.player.accuracy}; the AI answers with its own profile's reaction, lapse and accuracy. ` +
    `${meta.seeds} seeds × ${meta.strategies} strategies per cell (player carries the day-one Pommel, longsword).`, '');
  out.push('**By ladder level (all opponents)**', '', '| Level | Player win OFF → ON | Δ pts | Fight length OFF → ON (s) | Outcome flipped | Ended by a special | AI dodges player special | Player dodges AI special | Specials cancelled |', '|---|---|---|---|---|---|---|---|---|');
  for (const l of levels) {
    const s = sum(cells.filter(c => c.level === l));
    out.push(`| ${l} | ${pct(s.winsOff, s.fights)} % → ${pct(s.winsOn, s.fights)} % | ${(100 * (s.winsOn - s.winsOff) / s.fights).toFixed(1)} | ${sec(s.ticksOff, s.finishedOff)} → ${sec(s.ticksOn, s.finishedOn)} | ${pct(s.flipped, s.fights)} % | ${pct(s.specialKills, s.fights)} % | ${pct(evaded(s.player), resolved(s.player))} % of ${resolved(s.player)} | ${pct(evaded(s.ai), resolved(s.ai))} % of ${resolved(s.ai)} | ${pct(s.player.cancelled + s.ai.cancelled, s.player.cast + s.ai.cast)} % |`);
  }
  const t = sum(cells);
  out.push(`| **all** | ${pct(t.winsOff, t.fights)} % → ${pct(t.winsOn, t.fights)} % | ${(100 * (t.winsOn - t.winsOff) / t.fights).toFixed(1)} | ${sec(t.ticksOff, t.finishedOff)} → ${sec(t.ticksOn, t.finishedOn)} | ${pct(t.flipped, t.fights)} % | ${pct(t.specialKills, t.fights)} % | ${pct(evaded(t.player), resolved(t.player))} % | ${pct(evaded(t.ai), resolved(t.ai))} % | ${pct(t.player.cancelled + t.ai.cancelled, t.player.cast + t.ai.cast)} % |`, '');
  out.push(`**Player win-rate move by opponent and level (pts, ON − OFF; ⚠ = more than ${FLAG})**`, '', `| Opponent | ${levels.map(l => `L${l}`).join(' | ')} |`, `|---|${levels.map(() => '---').join('|')}|`);
  const flagged = [];
  for (const o of opponents) out.push(`| ${o} | ${levels.map(l => {
    const c = cells.find(x => x.opponent === o && x.level === l), d = 100 * (c.winsOn - c.winsOff) / c.fights;
    if (Math.abs(d) > FLAG) flagged.push(`${o} L${l} ${d > 0 ? '+' : ''}${d.toFixed(1)} (${pct(c.winsOff, c.fights)} → ${pct(c.winsOn, c.fights)} %)`);
    return `${d > 0 ? '+' : ''}${d.toFixed(1)}${Math.abs(d) > FLAG ? ' ⚠' : ''}`;
  }).join(' | ')} |`);
  out.push('', flagged.length ? `**${flagged.length} cell(s) move more than ${FLAG} pts:** ${flagged.join('; ')}` : `No opponent/level cell moves more than ${FLAG} pts.`, '');
  const md = out.join('\n');
  console.log(md);
  if (process.env.GITHUB_STEP_SUMMARY) writeFileSync(process.env.GITHUB_STEP_SUMMARY, md + '\n', { flag: 'a' });
  if (arg('out')) writeFileSync(arg('out'), md + '\n');
} else {
  const opponents = arg('opponents', LADDER.map(o => o.id).join(',')).split(','), levels = arg('levels', '1,6,12,18,30,46').split(',').map(Number), seeds = Number(arg('seeds', 24));
  const strategies = { ...STRATEGIES, ...TAP_ATTACK }, cells = [];
  for (const id of opponents) for (const level of levels) {
    const started = Date.now(), c = cell(level, seeds, OPPONENTS[id], strategies);
    cells.push({ opponent: id, level, ...c });
    console.log(`${id.padEnd(12)} L${String(level).padEnd(3)} win ${c.winsOff} → ${c.winsOn}/${c.fights} flipped ${c.flipped} special kills ${c.specialKills} player ${JSON.stringify(c.player)} ai ${JSON.stringify(c.ai)} (${((Date.now() - started) / 1000).toFixed(1)} s)`);
  }
  const json = { rule: SPECIAL, player: PLAYER_DODGE, seeds, strategies: Object.keys(strategies).length, cells };
  if (arg('json')) writeFileSync(arg('json'), JSON.stringify(json));
}
