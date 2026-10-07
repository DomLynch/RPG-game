#!/bin/bash
cd /opt/frankendom-shadow/work/char-exec && git rev-parse HEAD && node scripts/finisher-preview.mjs --label exec-dwarf --opponent dwarf --only execution --viewport 375 --no-video 2>&1 | tail -40
