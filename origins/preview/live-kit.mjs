// The live fight kit for the Origins preview (origins/preview/vite.config.mjs runs liveKit over index.html; tests/origins-live-kit.test.ts pins it).
// The Pit duel's controls, HUD bars and ☰ menu are the live game's own markup (Strategy 2026-10-06: reuse, don't copy). The game's
// index.html is read at build (and dev) time and these pieces are cut out of it whole, by tag + id/class, then put where the preview's
// index.html says <!-- live:fight-kit -->. Nothing is pasted, so the preview follows the game when its markup changes; a piece the game
// renames or drops fails the preview build here, loudly, instead of shipping a duel without its buttons.
export const LIVE_KIT = [
  '<header>',                    // the ☰ (#journal-button) and the sound button
  '<footer>',                    // #actions: the round cluster (Slash, Stab, Heavy, Kick, Guard, Roll, Skill), Rematch, run, camera
  '<div id="joystick"',          // the movement stick
  '<section class="combat-hud"', // the HEALTH / STAMINA bars, the opponent's bar, the status line
  '<div id="dmg-pool"',          // floating damage numbers (src/hud.ts)
  '<div id="art-status"',        // the loading line
  '<pre id="debug"',             // src/hud.ts toggles it
  '<dialog id="journal"',        // the ☰ menu itself
];
// One piece: from its opening tag to the matching close of the same tag name (nesting counted), so a <section> inside a <section> is kept.
export function cutPiece(html, opening) {
  const start = html.indexOf(opening);
  if (start < 0 || html.indexOf(opening, start + 1) >= 0) throw new Error(`origins preview: the game's index.html has ${start < 0 ? 'no' : 'more than one'} ${opening}`);
  const tag = /^<([a-z]+)/.exec(opening)[1], walker = new RegExp(`<(/?)${tag}\\b[^>]*>`, 'g');
  walker.lastIndex = start;
  for (let depth = 0, m; (m = walker.exec(html));) {
    depth += m[1] ? -1 : 1;
    if (depth === 0) return html.slice(start, walker.lastIndex);
  }
  throw new Error(`origins preview: ${opening} is never closed in the game's index.html`);
}
export function liveKit(liveHtml, previewHtml, marker = '<!-- live:fight-kit -->') {
  if (!previewHtml.includes(marker)) throw new Error(`origins preview: index.html has no ${marker}`);
  const out = previewHtml.replace(marker, () => LIVE_KIT.map((opening) => cutPiece(liveHtml, opening)).join('\n'));
  const ids = [...out.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]), twice = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (twice.length) throw new Error(`origins preview: the game's kit and the walk share ids: ${[...new Set(twice)].join(', ')}`);
  return out;
}
