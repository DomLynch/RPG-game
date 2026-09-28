/* global window, document, IntersectionObserver */
// Progressive touches only: the page reads complete without this file, bar the legend lineage.
document.documentElement.dataset.js = '';
const dock = document.getElementById('dock'), hero = document.querySelector('.hero');
if (dock && hero) new IntersectionObserver(([e]) => dock.classList.toggle('show', !e.isIntersecting), { threshold: 0.05 }).observe(hero);

// The hundred: one opponent's ten legends down a gold line, one lit and read at a time. Data: /game/legends.js (src/legends.ts).
const FOES = [['veteran', 'Centurion'], ['pitborn', 'Pitborn'], ['goblin', 'Goblin'], ['nightborn', 'Nightborn'], ['executioner', 'Executioner'],
  ['dwarf', 'Dwarf'], ['shieldmaiden', 'Shieldmaiden'], ['plaguedoctor', 'Plague Doctor'], ['witch', 'Witch'], ['knight', 'Knight']];
const RANKS = ['Recruit', 'Legionary', 'Gladiator', 'Veteran', 'Champion', 'Praetorian', 'Master', 'Primus', 'Invictus', 'Origin'];
const legends = window.FD_LEGENDS, who = document.getElementById('who'), names = document.getElementById('names');
const fig = document.getElementById('fig'), tale = document.getElementById('tale');
let foe = 'pitborn', rung = 4, near = false;   // near: the Hundred is within 400 px of the screen (faces wait for it)

function el(tag, props, ...kids) { const n = Object.assign(document.createElement(tag), props); n.append(...kids); return n; }

function draw() {
  for (const b of who.children) b.setAttribute('aria-selected', String(b.dataset.id === foe));
  const [, label] = FOES.find(([id]) => id === foe);
  fig.src = `/game/img/${foe}.webp`; fig.alt = `The ${label}`;
  names.replaceChildren(...legends[foe].map((l, i) => {
    // The legend's medallion (the game's own face, public/legends/<opponent>-<rung>.webp, rung = i + 1): a missing file is no face.
    // Only once the Hundred is near: it sits ~1.3 screens down on a phone, inside Chrome's own loading=lazy distance, which fetched all ten.
    const face = near ? el('img', { className: 'face', src: `/legends/${foe}-${i + 1}.webp`, alt: '', width: 40, height: 40, decoding: 'async' }) : '';
    if (face) face.onerror = () => face.remove();
    const b = el('button', { type: 'button' }, el('span', { className: 'r', textContent: RANKS[i] }), face, l.name);
    b.dataset.i = String(i); b.setAttribute('aria-pressed', String(i === rung));
    return el('li', { className: i === rung ? 'on' : '' }, b);
  }));
  const l = legends[foe][rung];
  tale.replaceChildren(l.backstory, el('small', { className: 'caps', textContent: l.source === 'generic' ? 'The arena' : l.source }));
}

if (legends && who && names) {
  who.append(...FOES.map(([id, label]) => { const b = el('button', { type: 'button', textContent: label }); b.dataset.id = id; b.setAttribute('role', 'tab'); return b; }));
  who.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { foe = b.dataset.id; rung = 4; draw(); } });
  names.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { rung = Number(b.dataset.i); draw(); } });
  draw();
  new IntersectionObserver(([e], io) => { if (e.isIntersecting) { near = true; io.disconnect(); draw(); } }, { rootMargin: '400px 0px' }).observe(names);
}
