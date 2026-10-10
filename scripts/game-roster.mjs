/* global URL, process */
// Writes public/game/legends/index.html: the site's full roster of fightable legends, grouped by the rank they stand at.
// Source of truth: docs/research/legends-600-ladder.csv (rows kept in the Pit and challengeable), one-liners from src/legends.ts (the hundred with backstories),
// docs/specs/origins/legends-500.csv (clan_theme, our own words) and docs/research/legends-lines-extra.json (the rest, written under .claude/skills/legends-rule).
// Run after changing any of them; tests/game-roster.test.ts fails while the page and the data differ.
import { readFileSync, writeFileSync } from 'node:fs';
import { LEGENDS, LEGEND_OPPONENTS } from '../src/legends.ts';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
// A small CSV reader: quoted fields, doubled quotes, newlines inside quotes.
export function parseCsv(text) {
  const rows = []; let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else quoted = false; } else cell += c; }
    else if (c === '"') quoted = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); cell = ''; if (row.length > 1 || row[0] !== '') rows.push(row); row = []; }
    else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  const [head, ...body] = rows;
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ''])));
}
export const RANKS = ['Recruit', 'Legionary', 'Gladiator', 'Veteran', 'Champion', 'Praetorian', 'Master', 'Primus', 'Invictus', 'Origin'];
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const label = (g) => g.replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase());

export function roster() {
  const ladder = parseCsv(read('docs/research/legends-600-ladder.csv')).filter((r) => r.pit_status === 'keep' && r.challengeable === 'yes');
  const origins = new Map(parseCsv(read('docs/specs/origins/legends-500.csv')).map((r) => [r.id, r]));
  const extra = JSON.parse(read('docs/research/legends-lines-extra.json'));
  const backstory = new Map(LEGEND_OPPONENTS.flatMap((o) => LEGENDS[o].map((l) => [l.name, l.backstory.replace(/\s*In Frankendom[^.]*\.\s*$/, '').trim()])));
  return ladder.map((r) => {
    const line = backstory.get(r.name) || origins.get(r.id)?.clan_theme || extra[r.id] || '';
    const sentence = (t) => (t ? t[0].toUpperCase() + t.slice(1) + (/[.!?]$/.test(t) ? '' : '.') : t);
    return { id: r.id, name: r.name, group: label(r.group), kind: r.kind, rank: Number(r.rank_1_10), line: sentence(line), source: origins.get(r.id)?.source ?? '' };
  });
}

export function render() {
  const list = roster();
  const index = readFileSync(new URL('../public/game/index.html', import.meta.url), 'utf8');
  const head = index.slice(0, index.indexOf('</style>') + 8)
    .replace(/<title>[^<]*<\/title>/, '<title>The roster: Frankendom Origins</title>')
    .replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${list.length} legends from myth, folklore, history and old books, each standing at one of ten ranks in the arena.">`)
    .replace('<link rel="canonical" href="https://frankendom.com/game/">', '<link rel="canonical" href="https://frankendom.com/game/legends/">')
    .replace(/<meta property="og:title" content="[^"]*">/, '<meta property="og:title" content="The roster: Frankendom Origins">')
    .replace(/<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="${list.length} legends, ten ranks.">`);
  const css = '\n<style>.roster{max-width:760px;margin:0 auto;padding:0 20px 80px}.roster h2{font-family:var(--caps);font-weight:500;letter-spacing:.18em;text-transform:uppercase;color:var(--gold2);font-size:1.05rem;margin:56px 0 6px}.roster h2 small{color:var(--fog);letter-spacing:.1em;font-size:.8rem;margin-left:10px}.roster ul{list-style:none;margin:0;padding:0}.roster li{padding:12px 0;border-bottom:1px solid var(--line);font-size:1.05rem;line-height:1.5}.roster li b{color:var(--ink);font-weight:600}.roster li span{display:block;color:var(--fog);font-weight:300}.roster li small{color:var(--dim);font-size:.8rem;letter-spacing:.06em}.roster-rank{padding:0}.roster .back{display:block;text-align:center;margin:40px 0 0}</style>\n';
  const sections = RANKS.map((title, i) => {
    const rows = list.filter((l) => l.rank === i + 1).sort((a, b) => a.name.localeCompare(b.name));
    return `<section class="roster-rank" id="rank-${i + 1}"><h2>${title}<small>${rows.length} legends</small></h2><ul>${rows.map((l) => `<li><b>${esc(l.name)}</b> <small>${esc(l.group)}${l.kind === 'patron' ? ' · patron' : ''}</small>${l.line ? `<span>${esc(l.line)}</span>` : ''}</li>`).join('')}</ul></section>`;
  }).join('\n');
  return `${head}${css}</head>
<body>
<header class="top">
  <a class="word" href="/game/">FRANKENDOM</a>
  <nav><a href="/game/#hundred">The Hundred</a><a href="/game/#ladder">The Ladder</a><a class="btn line" href="https://frankendom.com/">Play free</a></nav>
</header>
<main class="roster" style="padding-top:120px">
<div class="narrow head"><div class="caps">The roster</div><h1 style="font-weight:400">${list.length} legends</h1><p>Every name the arena remembers, from myth, folklore, history and books older than 1931. Each stands at one rank of the ladder.</p></div>
${sections}
<a class="back caps" href="/game/">← Back to Frankendom</a>
</main>
<footer>
  <span>© 2026 Frankendom</span><a href="https://frankendom.com/">Play</a><a href="/privacy.html">Privacy</a>
</footer>
</body>
</html>
`;
}

export const OUT = new URL('../public/game/legends/index.html', import.meta.url);
if (import.meta.url === `file://${process.argv[1]}`) { const { mkdirSync } = await import('node:fs'); mkdirSync(new URL('../public/game/legends/', import.meta.url), { recursive: true }); writeFileSync(OUT, render()); }
