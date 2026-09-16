// Live receipt: in a real browser against the public site, the page's own sprite URL decodes and its manifest duration matches the deployed build.
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true, executablePath: chromium.executablePath() });
const page = await browser.newPage({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true });
await page.route('**/*sentry.io/**', r => r.abort());
await page.goto('https://frankendom.com/');
await page.waitForFunction(() => document.querySelector('#attack-button')?.getAttribute('aria-disabled') === 'false');
await page.getByRole('button', { name: 'Enter the courtyard' }).tap();   // the activation gesture the game unlocks audio on
const receipt = await page.evaluate(async () => {
  const js = [...document.scripts].map(s => s.src).find(s => s.includes('/assets/index-'));
  const source = await (await fetch(js)).text();
  const sprites = [...new Set(source.match(/\/assets\/sprite-[\w-]+\.(?:m4a|ogg)/g))], seconds = Number((source.match(/SPRITE_SECONDS=([\d.]+)/) || [])[1]);
  const context = new AudioContext(); const out = { bundle: js.split('/').pop(), sprites, manifestSeconds: seconds, contextState: context.state, sampleRate: context.sampleRate, decoded: {} };
  for (const url of sprites) { const buffer = await context.decodeAudioData(await (await fetch(url)).arrayBuffer()); out.decoded[url.split('/').pop()] = { seconds: Math.round(buffer.duration * 100) / 100, channels: buffer.numberOfChannels, peak: (() => { let p = 0; for (const v of buffer.getChannelData(0)) p = Math.max(p, Math.abs(v)); return Math.round(p * 1000) / 1000; })() }; }
  return out;
});
console.log(JSON.stringify(receipt, null, 1)); await browser.close();
