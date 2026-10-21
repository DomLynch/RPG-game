// node --import ./seamless-phone-preload.mjs scripts/origins-seamless-check.mjs : the seamless gates under the PHONE tier. The row opens its context with isMobile + hasTouch (a coarse pointer) but no mobile UA, which the page reads as desktop (src/fight/quality.ts phoneTier needs both); this adds the iPhone UA to every context the row opens, and prints the tier the page computed.
import { chromium } from 'playwright';

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const launch = chromium.launch.bind(chromium);
chromium.launch = async (options) => {
  const browser = await launch(options), newContext = browser.newContext.bind(browser);
  browser.newContext = async (opts = {}) => {
    const ctx = await newContext({ ...opts, userAgent: opts.userAgent ?? IPHONE }), newPage = ctx.newPage.bind(ctx);
    ctx.newPage = async () => { const page = await newPage(); page.on('load', () => { void page.evaluate(() => ({ coarse: matchMedia('(pointer: coarse)').matches, ua: navigator.userAgent.slice(0, 24) })).then((t) => console.log('PHONE-TIER-CHECK', JSON.stringify(t))).catch(() => {}); }); return page; };
    return ctx;
  };
  return browser;
};
