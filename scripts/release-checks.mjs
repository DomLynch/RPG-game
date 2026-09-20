import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(process.argv.slice(2).find(arg => !arg.startsWith('--')) || fileURLToPath(new URL('..', import.meta.url)));
// `--extended` runs extended_commands instead: the Season 2 creature gates (Minotaur, Wraith, Werewolf, Skeleton are on hold for the
// beta, owner 2026-09-20). They run on demand, not on deploy, and never write the release receipt.
const extended = process.argv.includes('--extended');
const gate = JSON.parse(readFileSync(join(root, '.quality-gate.json'), 'utf8'));
const commands = extended ? gate.extended_commands : gate.release_commands;
if (!Array.isArray(commands) || !commands.length || !commands.every(command =>
  Array.isArray(command) && command.length && command.every(arg => typeof arg === 'string' && arg))) {
  throw new Error(extended ? 'Invalid extended_commands' : 'Invalid release_commands');
}
const revision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const receipt = join(root, 'artifacts', 'release-checks.json');
rmSync(receipt, { force: true });
for (const [index, command] of commands.entries()) {
  console.log(`${extended ? 'Extended' : 'Release'} check ${index + 1}/${commands.length}`);
  const result = spawnSync(command[0], command.slice(1), { cwd: root, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
if (execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim() !== revision) {
  throw new Error('Revision changed during release checks');
}
if (extended) { console.log(`Extended checks passed for ${revision}`); process.exit(0); }
mkdirSync(dirname(receipt), { recursive: true });
writeFileSync(receipt, JSON.stringify({ revision, passed: true, checks: commands.length }) + '\n');
console.log(`Release checks passed for ${revision}`);
