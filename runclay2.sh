#!/bin/bash
cd /opt/frankendom-shadow/work/world-extra
rm -rf artifacts/presentation/clay-after2
node scripts/impact-preview.mjs --label clay-after2 --opponent nightborn --moments heavy --viewport 375x812 --full --frames 6,12,20 > clay-after2.log 2>&1
echo DONE > clay2.log
