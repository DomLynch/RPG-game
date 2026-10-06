// The gate's light across a reload (src/gate-light.ts, docs/pit-design.md §9). After a win the Pit's gate leads to the next fighter on a
// fresh page; the page before set a sessionStorage flag and faded to the gate's light, and this script, the first thing the new document
// runs, puts the same light up before anything paints (style.css :root.gate-light), so no black frame shows between the two. main.ts
// fades it out on the arena's first frame. Without the flag (a first visit, a kill link, a plain reload) nothing here does anything. A
// classic file, not inline: the site's CSP allows no inline script.
/* global document, location, sessionStorage, setTimeout */
(function () {
  // `?look=loot2` (style.css, Lead 2026-10-06): the Take-one screen's restack, a look test. Same head script, so it needs no build wiring.
  if (/[?&]look=(?:[^&]*,)?loot2(?:,|&|$)/.test(location.search)) document.documentElement.classList.add('look-loot2');
  var KEY = 'frankendom.gate-light', MAX_MS = 8000, OUT_MS = 1200, root = document.documentElement, lit;
  try {
    lit = sessionStorage.getItem(KEY) === '1';
    if (lit) sessionStorage.removeItem(KEY);   // one reload only
  } catch { lit = false; }   // storage refused: the page boots as it always has
  if (!lit) return;
  root.classList.toggle('gate-light', true);
  // The light never outlives a failed boot: gone after MAX_MS whether or not the game ever draws.
  setTimeout(function () {
    if (!root.classList.contains('gate-light')) return;
    root.classList.toggle('gate-light', false); root.classList.toggle('gate-light-out', true);
    // main.ts's clearGateLight returns early once the light is gone, so nothing else would end the fade: it would stay on #pit-fade and
    // every later gate-fade would turn gold instead of black (Auditer, #1184). The fade is 1 s (style.css); this is gate-light.ts's OUT_MS.
    setTimeout(function () { root.classList.toggle('gate-light-out', false); }, OUT_MS);
  }, MAX_MS);
})();
