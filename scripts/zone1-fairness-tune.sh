#!/usr/bin/env bash
# usage: zone1-fairness-tune.sh "<health> <attack>" ... : the troll/salamander row tuning loop on my own trunk clone (one job). Copies this branch's archetype-defs.json + catalogue-data.ts over the clone's,
# then for each "<kind>:<health>:<attack>" candidate patches that archetype's health and sheet.attack and runs scripts/kite-farm.ts `stand` (64 seeds) at the kind's level(s). Restores the clone at the end.
#   zone1-fairness-tune.sh troll:680:45 troll:760:70 salamander:90:0 salamander:130:20 ...
set -uo pipefail
cd /opt/frankendom-shadow/work/combat-er86-trunk
git fetch -q origin codex/01a09a76/task-1 2>&1 | tail -1
git fetch -q origin "${BASE:-codex/01a09a76/task-1}" 2>&1 | tail -1; git checkout -q --detach FETCH_HEAD   # BASE=release-K6p2: RV87 rides after it
if [ -z "${NOFILES:-}" ]; then   # NOFILES=1: the clone's own trunk rows, untouched (the "before" column)
  cp /srv/dev-jobs/er-timings/tune/archetype-defs.json src/fight/archetype-defs.json
  cp /srv/dev-jobs/er-timings/tune/catalogue-data.ts src/fight/catalogue-data.ts
fi
echo "base $(git log -1 --format='%h %s' | cut -c1-70)"
for cand in "$@"; do
  IFS=: read -r kind health attack <<< "$cand"
  [ "$kind" = wolf ] || [ "$kind" = before ] || node -e '
    const fs = require("fs"), f = "src/fight/archetype-defs.json", d = JSON.parse(fs.readFileSync(f, "utf8")), [kind, health, attack] = process.argv.slice(1);
    const a = d.archetypes.find((x) => x.id === kind); a.health = Number(health);
    if (Number(attack) > 0) a.sheet = { attack: Number(attack) }; else delete a.sheet;
    fs.writeFileSync(f, JSON.stringify(d, null, 1));' "$kind" "$health" "$attack"
  case "$kind" in troll) pairs="cave-troll:3";; salamander) pairs="giant-salamander:1 giant-salamander:2";; wolf) pairs="wolf:1 wolf:2";; before) pairs="wolf:1 wolf:2 giant-salamander:1 giant-salamander:2 cave-troll:3";; esac   # before = no patch: the rows as the base has them
  for pair in $pairs; do
    echo "== $cand -> ${pair}: $(KIND="${pair%%:*}" LEVEL="${pair##*:}" CASES=stand SEEDS=64 node scripts/kite-farm.ts 2>&1 | grep '^stand' | sed -E 's/, killed while.*mean time to kill/ ... ttk/' | cut -c1-140)"
  done
done
git checkout -q -- src/fight/archetype-defs.json src/fight/catalogue-data.ts
