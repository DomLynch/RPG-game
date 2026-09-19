import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(process.argv[2] || fileURLToPath(new URL('..', import.meta.url)));
const commands = JSON.parse(readFileSync(join(root, '.quality-gate.json'), 'utf8')).release_commands;
if (!Array.isArray(commands) || !commands.length || !commands.every(command =>
  Array.isArray(command) && command.length && command.every(arg => typeof arg === 'string' && arg))) {
  throw new Error('Invalid release_commands');
}
const revision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const receipt = join(root, 'artifacts', 'release-checks.json');
rmSync(receipt, { force: true });
for (const [index, command] of commands.entries()) {
  console.log(`Release check ${index + 1}/${commands.length}`);
  const result = spawnSync(command[0], command.slice(1), { cwd: root, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
if (execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim() !== revision) {
  throw new Error('Revision changed during release checks');
}
mkdirSync(dirname(receipt), { recursive: true });
writeFileSync(receipt, JSON.stringify({ revision, passed: true, checks: commands.length }) + '\n');
console.log(`Release checks passed for ${revision}`);
