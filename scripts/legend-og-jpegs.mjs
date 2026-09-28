/* global URL, process */
// Writes public/og/<opponent>-<rung>.jpg from public/legends/<opponent>-<rung>.webp (Lead 2026-09-28, the kill-link preview's option (a)
// fallback): the same faces as 384-px JPEGs at quality 50, for link-preview crawlers that refuse WebP (the check is Dom's WhatsApp and
// iMessage previews of a /s/…?l= link). Only crawlers fetch these (deploy/frankendom.com.conf og maps); no page does, so they sit outside
// check-budget's TOTAL in their own OG_FACES line. macOS only (sips). Run it after any face changes; tests/legend-og.test.ts fails on a
// missing file.
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { PORTRAIT_KEYS } from '../src/legends.ts';

const src = (key) => new URL(`../public/legends/${key}.webp`, import.meta.url).pathname;
const out = (key) => new URL(`../public/og/${key}.jpg`, import.meta.url).pathname;

if (import.meta.url === `file://${process.argv[1]}`) {
  mkdirSync(new URL('../public/og/', import.meta.url), { recursive: true });
  for (const key of PORTRAIT_KEYS) execFileSync('sips', ['-Z', '384', '-s', 'format', 'jpeg', '-s', 'formatOptions', '50', src(key), '--out', out(key)], { stdio: 'ignore', timeout: 30_000 });
  console.log(`wrote ${PORTRAIT_KEYS.length} faces to public/og/`);
}
