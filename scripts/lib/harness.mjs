// The shared boot and teardown for the Playwright gates and previews (audit 2026-09-21: 21 scripts each re-wrote the same
// server start, browser launch, phone page, readiness wait and receipt write, so every flake class got fixed one file at a
// time). Behaviour here is exactly what browser-check.mjs and roster-browser-check.mjs did inline; a script that needs
// something else passes it in rather than forking the boot. Dev-server previews (vite createServer) join when the first
// one migrates; nothing speculative lives here.
import { chromium } from 'playwright';
import { preview } from 'vite';
import fs from 'node:fs/promises';
import { dirname } from 'node:path';

export const PHONE = { width: 393, height: 852 };   // the gates' phone: an iPhone 15 portrait viewport

// The built site (dist/) on a loopback port, or QA_URL when the gate is pointed at a deployed site. `close` is safe either way.
export async function serveDist(env = process.env) {
  if (env.QA_URL) return { url: env.QA_URL, close: async () => {} };
  const server = await preview({ preview: { host: '127.0.0.1', port: 0, strictPort: true } });
  return { url: `http://127.0.0.1:${server.httpServer.address().port}`, close: () => new Promise((resolve) => server.httpServer.close(resolve)) };
}

// Headless Chromium from Playwright's own download (the runner has no system Chrome). Extra launch options pass through.
export const launch = (options = {}) => chromium.launch({ headless: true, executablePath: chromium.executablePath(), ...options });

// A phone-shaped page with the gates' standard wiring: page errors collected into `errors` (the caller's array when given,
// so a receipt can own it), Sentry blocked so a deliberate failure never files a production incident, one default timeout.
export async function phonePage(browser, { viewport = PHONE, deviceScaleFactor, timeout = 12000, errors = [] } = {}) {
  const page = await browser.newPage({ viewport, isMobile: true, hasTouch: true, ...(deviceScaleFactor ? { deviceScaleFactor } : {}) });
  page.setDefaultTimeout(timeout);
  await page.route('**/*sentry.io/**', (route) => route.abort());
  page.on('pageerror', (e) => errors.push(String(e)));
  return { page, errors };
}

// The game is playable: the attack control is enabled and, with `art`, the art status line is empty (both rigs loaded).
// A load wait (the rigs are ~13 MB; a slow link is not a behaviour failure), hence the long default.
export const waitForGame = (page, { timeout = 90000, art = false } = {}) =>
  page.waitForFunction(
    (art) => document.querySelector('#attack-button').getAttribute('aria-disabled') === 'false' && (!art || document.querySelector('#art-status').textContent === ''),
    art,
    { timeout },
  );

// The receipt every gate leaves behind, pretty-printed, directory created on demand.
export async function writeReceipt(path, receipt) {
  await fs.mkdir(dirname(path), { recursive: true });
  await fs.writeFile(path, JSON.stringify(receipt, null, 2));
}
