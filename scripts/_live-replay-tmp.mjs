import { harnessClock, skipDraws } from './lib/harness-clock.mjs';
import { chromium } from 'playwright';
import { initialPractice, stepPractice, PROFILES } from '../src/combat.ts';
import { createRecorder, decodeRecord, encodeRecord, packRecord, toBase64Url } from '../src/record.ts';
import { underPlayScale } from '../src/play-radius.ts';
import { setStab } from '../src/stab-rule.ts';
import { LEVEL_ANCHORS, OPPONENTS, opponentAt, profileAt } from '../src/moves.ts';
import { decide, initialAi } from '../src/ai.ts';
import { roundPose } from '../src/duel.ts';
import { RECORD_VERSION } from '../src/record.ts';
const ORIGIN = process.argv[2] || 'https://frankendom.com';
async function fight(opponent, seed, pose, forceV) {
  setStab(true); const level = LEVEL_ANCHORS.normal;
  const { p, recorder } = underPlayScale(opponent, RECORD_VERSION, () => {
    const recorder = createRecorder({ build: 'replay-row', opponent, weapon: 'longsword', level, seed, ...(pose ? { pose } : {}) });
    let p = initialPractice(seed, opponentAt(OPPONENTS[opponent], level), undefined, undefined, undefined, undefined, undefined, pose), hero = initialAi(seed ^ 0x5bd1e995);
    while (!p.finish && p.duel.tick < 6000) { const w = decide(p.duel, 0, hero, PROFILES.normal); hero = w.ai;
      p = stepPractice(p, recorder.push(p.duel.tick === 0 ? { ...w.intent, action: 'light' } : w.intent), profileAt(OPPONENTS[opponent], level)); }
    return { p, recorder };
  });
  const rec = recorder.finish(!p.finish.draw && p.finish.victim === 1 ? 'killed' : 'died');
  let encoded = await encodeRecord(rec);
  if (forceV) { const raw = packRecord(rec); let o = 3; for (let i = 0; i < 3; i++) o += 1 + raw[o]; o += 3;   // skill, flags, arena: v32+ adds the patron byte (0 = none) here
    const b = new Uint8Array(raw.length + 1); b.set(raw.subarray(0, o)); b[o] = 0; b.set(raw.subarray(o), o + 1); b[2] = forceV; const z = new Response(new Blob([b]).stream().pipeThrough(new CompressionStream('gzip'))); encoded = toBase64Url(new Uint8Array(await z.arrayBuffer())); }
  const back = await decodeRecord(encoded);
  return { opponent, seed, encoded, v: back.v, pose: !!back.pose, expect: `${p.duel.tick}/${p.finish.victim ?? ''}/${p.finish.draw ? 1 : 0}` };
}
const cases = [await fight('goblin', 731, null), await fight('goblin', 731, null, 37), await fight('veteran', 97731, roundPose({ hero: { x: -2.3, z: 1.1 }, foe: { x: 1.7, z: -0.9 }, heroFacing: 0.6 }))];
const browser = await chromium.launch(); const out = [];
for (const c of cases) {
  const page = await (await browser.newContext({ viewport: { width: 1024, height: 768 } })).newPage(); const errs = [];
  page.setDefaultTimeout(120000); page.on('pageerror', (e) => errs.push(String(e))); await page.route('**/*sentry.io/**', (r) => r.abort());
  let end = null, banner = null;
  try {
    await page.goto(`${ORIGIN}/?opponent=${c.opponent}&replay=${c.encoded}`, { waitUntil: 'commit' });
    await page.waitForFunction(() => document.getElementById('replay-banner')?.textContent?.startsWith('Replay'), null, { polling: 100, timeout: 180000 });
    await skipDraws(page, true);
    await page.waitForFunction(() => document.getElementById('debug')?.dataset.replay, null, { polling: 500, timeout: 420000 });
    end = await page.evaluate(() => document.getElementById('debug').dataset.replay); banner = await page.locator('#replay-banner').textContent();
  } catch (e) { errs.push(e.message.split('\n')[0]); errs.push(JSON.stringify(await page.evaluate(() => ({ b: document.getElementById('replay-banner')?.textContent, a: document.getElementById('art-status')?.textContent, t: document.getElementById('debug')?.dataset.tick, body: document.body.innerText.slice(0, 300) })).catch((x) => String(x)))); }
  out.push({ opponent: c.opponent, seed: c.seed, recordVersion: c.v, posed: c.pose, expected: c.expect, live: end, banner, ok: end === c.expect && !errs.length, errs });
}
await browser.close(); console.log(JSON.stringify({ origin: ORIGIN, out }, null, 1));
