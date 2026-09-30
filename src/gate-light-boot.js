// The gate's light across a reload (src/gate-light.ts, docs/pit-design.md §9). After a win the Pit's gate leads to the next fighter on a
// fresh page; the page before set a sessionStorage flag and faded to the gate's light, and this script, the first thing the new document
// runs, puts the same light up before anything paints (style.css :root.gate-light), so no black frame shows between the two. main.ts
// fades it out on the arena's first frame. Without the flag (a first visit, a kill link, a plain reload) nothing here does anything. A
// classic file, not inline: the site's CSP allows no inline script.
/* global document, sessionStorage, setTimeout */
(function () {
  var KEY = 'frankendom.gate-light', MAX_MS = 8000, root = document.documentElement, lit;
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
  }, MAX_MS);
})();
