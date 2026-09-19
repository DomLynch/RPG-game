// Emitted-byte provenance plus actual Chromium/WebKit decoding under the deployment CSP.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { preview } from 'vite';
import { chromium, webkit } from 'playwright';
import { assertGlbEquivalent, builtRig, sha256 } from './glb-equivalence.mjs';

function checkCsp(value) {
  const directive = value?.split(';').map(s => s.trim()).find(s => s.startsWith('script-src '));
  assert.deepEqual(directive?.split(/\s+/).slice(1).sort(), ["'self'", "'wasm-unsafe-eval'"].sort(), 'Frankendom must allow its WASM decoder while keeping ordinary eval and external scripts blocked');
}
if (process.argv.includes('--hosted-csp')) {
  const response = await fetch('https://frankendom.com/', { signal: AbortSignal.timeout(15000) });
  assert.equal(response.status, 200); checkCsp(response.headers.get('content-security-policy'));
  console.log('Hosted decoder CSP PASS');
} else {
  const dir = 'artifacts/character/compression'; await fs.mkdir(dir, { recursive: true });
  const receipt = { rigs: [], browsers: [], errors: [] };
  for (const name of (await fs.readdir('src/assets')).filter(f => f.endsWith('.glb'))) {
    const id = name.slice(0, -4), file = await builtRig(id);
    receipt.rigs.push({ id, file, ...await assertGlbEquivalent(await fs.readFile(`src/assets/${name}`), await fs.readFile(file)) });
  }
  console.log(`Compressed build equivalence PASS: ${receipt.rigs.length} rigs, ${receipt.rigs.reduce((n, r) => n + r.accessors, 0)} accessors; clips, materials and used image bytes unchanged`);
  if (process.argv.includes('--browser')) {
    const server = process.env.QA_URL ? null : await preview({ preview: { host: '127.0.0.1', port: 0 } });
    const origin = process.env.QA_URL || `http://127.0.0.1:${server.httpServer.address().port}`;
    try {
      for (const engine of [chromium, webkit]) {
        const browser = await engine.launch({ headless: true, ...(engine === chromium ? { executablePath: chromium.executablePath() } : {}) });
        try {
          const page = await browser.newPage({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true });
          page.on('pageerror', e => receipt.errors.push(String(e)));
          await page.route('**/*sentry.io/**', route => route.abort());
          await page.route(`${origin}/decoder-csp-probe.js`, route => route.fulfill({ contentType: 'text/javascript', body: `try { window.evalAllowed = new Function('return true')(); } catch { window.evalAllowed = false; } window.evalChecked = true;` }));
          for (const id of ['werewolf', 'skeleton']) {
            const responses = [];
            const collect = response => { if (/\.glb(?:\?|$)/.test(response.url())) responses.push(response); };
            page.on('response', collect);
            const navigation = await page.goto(`${origin}/?opponent=${id}`);
            checkCsp(await navigation.headerValue('content-security-policy'));
            await page.waitForFunction(() => document.querySelector('#art-status')?.textContent === '' && document.querySelector('#attack-button')?.getAttribute('aria-disabled') === 'false', null, { timeout: 90000 });
            assert.equal(responses.length, 2, 'URL catalogue must fetch only the hero and selected opponent');
            for (const name of ['warrior', id]) {
              const expected = receipt.rigs.find(r => r.id === name), response = responses.find(r => new URL(r.url()).pathname.endsWith(expected.file.slice(5)));
              assert.ok(response, `Missing ${name}`); assert.equal(response.status(), 200);
              assert.equal(sha256(await response.body()), expected.emittedSha256, 'Served bytes must equal the independently verified compressed build');
            }
            if (await page.getByRole('button', { name: 'Enter the arena' }).isVisible()) await page.getByRole('button', { name: 'Enter the arena' }).click();
            await page.addScriptTag({ url: `${origin}/decoder-csp-probe.js` });
            await page.waitForFunction(() => window.evalChecked);
            assert.equal(await page.evaluate(() => window.evalAllowed), false, 'WASM allowance must not enable JavaScript eval');
            await page.screenshot({ path: `${dir}/${engine.name()}-${id}.png` });
            receipt.browsers.push({ engine: engine.name(), opponent: id, onlyTwoRigs: true, decoded: true, evalBlocked: true });
            page.off('response', collect);
          }
        } finally { await browser.close(); }
      }
      assert.deepEqual(receipt.errors, []);
    } finally {
      if (server) await new Promise(resolve => server.httpServer.close(resolve));
      await fs.writeFile(`${dir}/receipt.json`, JSON.stringify(receipt, null, 2));
    }
  }
  receipt.passed = true;
  await fs.writeFile(`${dir}/receipt.json`, JSON.stringify(receipt, null, 2));
}
