#!/bin/bash
cd /opt/frankendom-shadow/work/world-z2fix
git -c safe.directory='*' checkout -q -f --detach FETCH_HEAD; git log --oneline -1 | cut -c1-70
true
cp zone1-joined-still.mjs scripts/zone1-joined-still.mjs
OUT=/opt/frankendom-shadow/work/z1join-out; rm -rf $OUT; mkdir -p $OUT
for e in webkit; do ENGINE=$e timeout 600 node scripts/zone1-joined-still.mjs /tmp/z1dist-join $OUT/$e 2>&1 | tail -6; done
rm scripts/zone1-joined-still.mjs; echo DONE > $OUT/DONE
