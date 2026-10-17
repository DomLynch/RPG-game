// Receipt for the six SPECIAL 2 picks (the specials PR, RV75): hero presses skill2 once at the veteran, 16 roll seeds each; prints the outcome per pick as a markdown table.
//   node scripts/specials-receipt.ts            (headless; the Pit duel, stepDuel; no GPU)
import { stepDuel, withRoll, withSkill2, type Duel } from '../src/fight/duel.ts';
import { OPPONENTS, SKILL_MOVE, weaponOf, DEFAULT_WEAPON, type SkillId } from '../src/fight/moves.ts';
import { act, arena, idle } from '../tests/strategies.ts';

const PICKS = ['lunge', 'ironrush', 'pommel', 'shove', 'cleave', 'stomp'] as SkillId[], SEEDS = 16;
const mean = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / (xs.length || 1);
console.log('| pick | move | windup | stamina | hit tick | damage (mean / min-max over 16 seeds) | foe posture | foe pushed to (m) | hits landed |');
console.log('|---|---|---|---|---|---|---|---|---|');
for (const p of PICKS) {
  const row = weaponOf(DEFAULT_WEAPON).moves[SKILL_MOVE[p]!];
  const dmg: number[] = [], posture: number[] = [], gap: number[] = [], tick: number[] = []; let landed = 0;
  for (let seed = 1; seed <= SEEDS; seed++) {
    let d: Duel = withRoll(withSkill2(arena(OPPONENTS.veteran), 0, p), seed * 7919); d.fighters[0].skillCooldown = 0;
    let hit: { damage: number; tick: number } | null = null;
    for (let t = 0; t < 160; t++) { d = stepDuel(d, [t === 0 ? act('skill2') : idle(), idle()]); for (const e of d.events) if (e.type === 'Hit' && e.actor === 0 && !hit) hit = { damage: e.damage, tick: e.tick }; }
    if (hit) { landed++; dmg.push(hit.damage); tick.push(hit.tick); }
    posture.push(d.fighters[1].posture); gap.push(Math.hypot(d.fighters[0].body.x - d.fighters[1].body.x, d.fighters[0].body.z - d.fighters[1].body.z));
  }
  console.log(`| ${p} | ${SKILL_MOVE[p]} | ${row.windup} | ${row.stamina} | ${mean(tick).toFixed(0)} | ${mean(dmg).toFixed(1)} / ${Math.min(...dmg)}-${Math.max(...dmg)} | ${mean(posture).toFixed(1)} | ${mean(gap).toFixed(2)} | ${landed}/${SEEDS} |`);
}
