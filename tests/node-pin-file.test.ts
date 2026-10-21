// One Node pin (Dom's repo audit 2026-10-21: it was `22` in 17 workflow steps, `22.23.3` in 2 and a NODE_PIN lookup in one). The version the
// VPS receipts run on is NODE_PIN (scripts/lib/vps-unit.mjs: record/replay fingerprints depend on its float behaviour); .nvmrc holds the same
// version, and every setup-node step reads .nvmrc, so CI and the VPS run one node.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { NODE_PIN } from '../scripts/lib/vps-unit.mjs';

test('.nvmrc is NODE_PIN, and no workflow names a node version of its own', () => {
  assert.equal(readFileSync('.nvmrc', 'utf8').trim(), NODE_PIN.version.replace(/^v/, ''));
  for (const f of readdirSync('.github/workflows').filter((n) => n.endsWith('.yml'))) {
    const text = readFileSync(`.github/workflows/${f}`, 'utf8');
    assert.doesNotMatch(text, /\bnode-version:/, `${f} pins node itself; use node-version-file: .nvmrc`);
    const setups = text.match(/uses: actions\/setup-node@/g)?.length ?? 0, files = text.match(/node-version-file: \.nvmrc/g)?.length ?? 0;
    assert.equal(files, setups, `${f}: every setup-node step reads .nvmrc`);
  }
});
