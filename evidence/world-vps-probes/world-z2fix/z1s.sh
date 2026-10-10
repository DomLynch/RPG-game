#!/bin/bash
cd /opt/frankendom-shadow/work/world-z2fix
git -c safe.directory='*' fetch -q origin code-quality/seamless-engage-wait && git -c safe.directory='*' checkout -q -f --detach FETCH_HEAD; git log --oneline -1 | cut -c1-60
rm -rf /tmp/z1dist-seam; npx vite build --config origins/preview/vite.config.mjs --outDir /tmp/z1dist-seam 2>&1 | tail -1
head -20 scripts/origins-seamless-check.mjs | grep -n "Usage\|argv" | head -3
for i in 1 2; do timeout 600 node scripts/origins-seamless-check.mjs /tmp/z1dist-seam 2>&1 | tail -12 | cut -c1-400; echo "exit $?"; done
