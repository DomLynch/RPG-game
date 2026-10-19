#!/bin/bash
# Probe (scratch): browser-check.mjs up to the Fight tap, then log the foe's behaviour for 25 s of page time. Prints PROBE lines.
set -u
head -38 scripts/browser-check.mjs > scripts/probe-tell.mjs
cat >> scripts/probe-tell.mjs <<'EOF'
 await page.evaluate(()=>{window.__seen=0;});
 for(let i=0;i<25;i++){
  await run(1000);
  const s=await page.evaluate(()=>{const st=document.querySelector('#combat-status');const ev=(window.__combat||[]).flatMap(x=>x.events||[]);const fresh=ev.slice(window.__seen);window.__seen=ev.length;return{t:Math.round(performance.now()),threat:st.dataset.threat,move:st.dataset.move,text:st.textContent.slice(0,60),guardDis:document.querySelector('#guard-button').getAttribute('aria-disabled'),atkDis:document.querySelector('#attack-button').getAttribute('aria-disabled'),events:fresh.slice(0,8).map(e=>e.type+(e.actor!==undefined?':'+e.actor:'')+(e.move?':'+e.move:'')),tellAt:window.__tellAt};});
  console.log('PROBE',i,JSON.stringify(s));
 }
} catch(e){console.log('PROBE error',String(e).slice(0,300));} finally {await browser.close();process.exit(0);}
EOF
npx vite build > /tmp/vite-build.log 2>&1 || { tail -20 /tmp/vite-build.log; exit 3; }
echo "PROBE build ok"
npx playwright install --with-deps chromium > /tmp/pw-install.log 2>&1 || tail -5 /tmp/pw-install.log
node scripts/probe-tell.mjs
