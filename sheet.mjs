import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const [dir, out] = process.argv.slice(2);
const A = ['1','a','b','c','d'], N = {1:'Ash Pit',a:'Night Pit',b:'Rain Yard',c:'Blood Sand',d:'Sunken Cistern'};
const img = (p) => `data:image/png;base64,${readFileSync(p).toString('base64')}`;
const cell = (k, a) => `<figure><img src="${img(`${dir}/${k}-${a}/start.png`)}"><figcaption>${k} · ${N[a]}</figcaption></figure>`;
const html = `<body style="margin:0;background:#111;color:#eee;font:14px sans-serif;display:grid;grid-template-columns:repeat(5,300px);gap:6px">
${A.map(a => cell('before', a)).join('')}${A.map(a => cell('after', a)).join('')}</body>
<style>figure{margin:0}img{width:300px;display:block}figcaption{padding:2px 4px}</style>`;
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1524, height: 1400 } });
await p.setContent(html); await p.screenshot({ path: out, fullPage: true }); await b.close();
