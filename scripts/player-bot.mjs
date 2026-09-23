// A local-only browser player: real keyboard input, seeded opponents, full-fight video and event receipts.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import { chromium } from 'playwright';
import { preview } from 'vite';
import { harnessClock } from './lib/harness-clock.mjs';
import { chooseGuardCounter } from './lib/player-bot-policy.mjs';

const option = (name, fallback) => process.argv.find(a => a.startsWith(`--${name}=`))?.split('=')[1] ?? fallback;
const seedArg = Number(option('seed', '731'));
assert.ok(Number.isSafeInteger(seedArg) && seedArg >= 0 && seedArg <= 0xffffffff, 'seed must be an unsigned 32-bit integer');
const first = seedArg >>> 0;
const count = Number(option('fights', process.argv.includes('--smoke') ? '1' : '3'));
const reactionMs = Number(option('reaction-ms', '180'));
assert.ok(Number.isInteger(count) && count > 0 && count <= 12);
assert.ok(Number.isFinite(reactionMs) && reactionMs >= 100 && reactionMs <= 700);
const nextSeed = seed => (Math.imul(seed, 1664525) + 1013904223) >>> 0;
const seeds = Array.from({ length: count }, (_, i) => { let seed = first; for (let n = 0; n < i; n++) seed = nextSeed(seed); return seed; });
const dir = option('out', 'artifacts/combat/player-bot');
await fs.mkdir(dir, { recursive: true });
const server = await preview({ preview: { host: '127.0.0.1', port: 0 } });
const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
const browser = await chromium.launch({ headless: true, executablePath: chromium.executablePath() });
const revision = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', timeout: 20_000 }).trim();
const dirty = execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8', timeout: 20_000 }).trim() !== '';
const receipt = { revision: `${revision}${dirty ? '-dirty' : ''}`, opponent: 'pitborn', difficulty: 'easy', strategy: 'guard-counter', reactionMs, observation: 'debug gap/stamina/phase and current combat events; no future state', fights: [] };
try {
  for (const seed of seeds) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1, recordVideo: { dir, size: { width: 390, height: 844 } } });
    const page = await context.newPage(), video = page.video(), held = new Set(), fight = { seed, inputs: [], events: [], samples: [], errors: [] };
    const release = async () => { for (const key of [...held]) { try { await page.keyboard.up(key); fight.inputs.push({ tick: fight.durationSeconds == null ? null : Math.round(fight.durationSeconds * 60), key, edge: 'up', reason: 'end/reset/error' }); } catch (error) { fight.errors.push(`release ${key}: ${error}`); } finally { held.delete(key); } } };
    const keys = async (wanted, tick) => {
      for (const key of [...held]) if (!wanted.includes(key)) { await page.keyboard.up(key); held.delete(key); fight.inputs.push({ tick, key, edge: 'up' }); }
      for (const key of wanted) if (!held.has(key)) { await page.keyboard.down(key); held.add(key); fight.inputs.push({ tick, key, edge: 'down' }); }
    };
    try {
      page.on('pageerror', e => fight.errors.push(String(e)));
      await page.route('**/*sentry.io/**', route => route.abort());
      await page.goto(`${origin}/?opponent=pitborn&debug=1&botSeed=${seed}`);
      await page.waitForFunction(() => document.querySelector('#attack-button')?.getAttribute('aria-disabled') === 'false', null, { timeout: 90000 });
      for (let n = 0; n < 3 && (await page.locator('#difficulty').textContent()) !== 'Difficulty: easy'; n++) await page.evaluate(() => document.querySelector('#difficulty').click());
      assert.equal(await page.locator('#difficulty').textContent(), 'Difficulty: easy');
      const { run, until } = await harnessClock(page);
      await page.getByRole('button', { name: 'Enter the arena' }).tap();
      await until(() => document.querySelector('#welcome').hidden && document.querySelector('#art-status').textContent === '', 20000);
      await page.evaluate(() => {
        window.__botEvents = [];
        window.addEventListener('frankendom:combat', e => window.__botEvents.push(...e.detail.events));
        const label = document.createElement('div'); label.id = 'bot-receipt';
        Object.assign(label.style, { position: 'fixed', top: '2px', left: '2px', zIndex: '9999', background: '#111d', color: 'white', font: '12px monospace', padding: '3px' });
        document.body.append(label);
      });
      fight.inputs.push({ tick: 0, key: 'KeyF', edge: 'press' });
      await page.keyboard.press('KeyF');
      await until(() => document.querySelector('#guard-button').getAttribute('aria-disabled') === 'false', 20000);
      let cursor = 0, memory = { tell: null, counterUntil: 0 };
      for (let steps = 0; steps < 3000; steps++) {
        const obs = await page.evaluate(cursor => {
          const text = document.querySelector('#debug').textContent, lines = text.split('\n'), enemy = lines.findIndex(l => l.startsWith('warden:'));
          const own = lines.findIndex(l => l.startsWith('you:'));
          return { tick: Number(document.querySelector('#debug').dataset.tick), gap: Number(text.match(/gap ([\d.]+)/)?.[1] ?? 99),
            hp: Number(document.querySelector('#player-health').value), enemyHp: Number(document.querySelector('#target-health').value),
            stamina: Number(text.match(/you: hp \d+ st (\d+)/)?.[1] ?? 0),
            phase: lines[own + 1]?.trim().split(/[ +]/)[0], enemyPhase: lines[enemy + 1]?.trim().split(/[ +]/)[0] === 'ready' ? 'ready' : lines[enemy + 1]?.includes('/') ? 'attack' : 'other',
            heavy: document.querySelector('#heavy-button').getAttribute('aria-disabled') === 'false',
            events: window.__botEvents.slice(cursor), count: window.__botEvents.length };
        }, cursor);
        cursor = obs.count;
        fight.events.push(...obs.events);
        if (!fight.samples.length || obs.tick - fight.samples.at(-1).tick >= 60) fight.samples.push({ tick: obs.tick, hp: obs.hp, enemyHp: obs.enemyHp, stamina: obs.stamina, gap: obs.gap });
        if (steps && steps % 600 === 0) console.log(JSON.stringify({ seed, tick: obs.tick, hp: obs.hp, enemyHp: obs.enemyHp, blocks: fight.events.filter(e => e.type === 'Blocked' && e.actor === 0).length }));
        if (!obs.hp || !obs.enemyHp || obs.tick >= 5400) break;
        const decision = chooseGuardCounter(obs, memory, Math.ceil(reactionMs / 1000 * 60));
        await keys(decision.keys, obs.tick);
        if (decision.press) { await page.keyboard.press(decision.press); fight.inputs.push({ tick: obs.tick, key: decision.press, edge: 'press' }); }
        await page.evaluate(({ tick, seed }) => { document.querySelector('#bot-receipt').textContent = `seed ${seed} · tick ${tick}`; }, { tick: obs.tick, seed });
        await run(32);
      }
      const end = await page.evaluate(() => ({ tick: Number(document.querySelector('#debug').dataset.tick), hp: Number(document.querySelector('#player-health').value), enemyHp: Number(document.querySelector('#target-health').value), events: window.__botEvents }));
      fight.events = end.events;
      fight.finalHealth = { player: end.hp, opponent: end.enemyHp };
      fight.outcome = end.enemyHp === 0 ? 'win' : end.hp === 0 ? 'loss' : 'timeout';
      fight.durationSeconds = +(end.tick / 60).toFixed(2);
      fight.damageDealt = fight.events.filter(e => e.type === 'Hit' && e.actor === 0).reduce((n, e) => n + (e.damage ?? 0), 0);
      fight.damageTaken = fight.events.filter(e => ((e.type === 'Hit' || e.type === 'GuardBroken') && e.actor === 1) || (e.type === 'Blocked' && e.actor === 0) || (e.type === 'Whipped' && e.target === 0)).reduce((n, e) => n + (e.damage ?? 0), 0);
      for (const [name, type, move] of [['blocks', 'Blocked'], ['parries', 'Parried'], ['counterStarts', 'AttackStarted', 'heavy_counter'], ['counterHits', 'Hit', 'heavy_counter'], ['exhaustions', 'StaminaExhausted']])
        fight[name] = fight.events.filter(e => e.type === type && e.actor === 0 && (!move || e.move === move)).length;
      await release();
      for (let second = 0; second < 5; second++) {
        await run(1000); // record the consequence and end screen after the decisive health event
        await page.evaluate(seed => { document.querySelector('#bot-receipt').textContent = `seed ${seed} · tick ${document.querySelector('#debug').dataset.tick}`; }, seed);
      }
      fight.events = await page.evaluate(() => window.__botEvents);
      fight.videoTailSeconds = 5;
      if (fight.outcome === 'loss') {
        await page.evaluate(() => document.querySelector('#reset-button').click());
        await run(50);
        fight.resetCheck = { inputsReleased: held.size === 0, health: await page.locator('#player-health').evaluate(bar => Number(bar.value)) };
        assert.ok(fight.resetCheck.inputsReleased && fight.resetCheck.health > 0, 'rematch starts without held inputs');
      }
      assert.deepEqual(fight.errors, []);
    } catch (error) { fight.error = String(error); }
    finally {
      await release();
      fight.inputsReleased = held.size === 0;
      await context.close();
      if (video) { fight.video = `${dir}/seed-${seed}.webm`; await fs.rename(await video.path(), fight.video); }
      await fs.writeFile(`${dir}/seed-${seed}.json`, JSON.stringify(fight, null, 2));
      const { inputs, events, samples, ...summary } = fight;
      receipt.fights.push({ ...summary, inputCount: inputs.length, eventCount: events.length, sampleCount: samples.length });
      console.log(JSON.stringify({ seed, outcome: fight.outcome, durationSeconds: fight.durationSeconds, blocks: fight.blocks, counterHits: fight.counterHits, error: fight.error }));
    }
  }
  receipt.passed = receipt.fights.some(f => f.outcome === 'win' && f.blocks > 0 && f.counterStarts > 0 && f.counterHits > 0) && receipt.fights.every(f => !f.error && !f.errors.length && f.inputsReleased);
  assert.ok(receipt.passed, 'at least one real Easy win with a held block and damaging heavy counter; no run errors');
} finally {
  await fs.writeFile(`${dir}/summary.json`, JSON.stringify(receipt, null, 2));
  await browser.close();
  await new Promise(resolve => server.httpServer.close(resolve));
}
