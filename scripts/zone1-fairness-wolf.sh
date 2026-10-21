#!/usr/bin/env bash
# usage: zone1-fairness-wolf.sh <branch> [candidate ...] : the wolf table at <branch> on my er86 clone (one job): kite-farm stand for wolf L1/L2 and the masher gap sweep for wolf L1/L2, goblin L1, salamander L1, troll L3.
# A candidate is "hp:attack" (the wolf archetype's health and sheet.attack; attack 0 = none), patched in the throwaway checkout; no candidate = the branch's rows as they are.
set -uo pipefail
cd /opt/frankendom-shadow/work/combat-er86
git fetch -q origin "$1" && git checkout -q -f --detach FETCH_HEAD; shift
echo "head $(git log -1 --format='%h %s' | cut -c1-80)"
cp /srv/dev-jobs/er-timings/zone1-fairness-masher-sweep.ts scripts/   # not on the branch yet
run() {
  for pair in wolf:1 wolf:2 goblin:1; do echo "  stand $pair: $(KIND="${pair%%:*}" LEVEL="${pair##*:}" CASES=stand SEEDS=64 node scripts/kite-farm.ts 2>&1 | grep '^stand' | sed -E 's/hero died ([0-9]+)\/64, creature killed ([0-9]+).*mean time to kill ([0-9]+s).*/deaths \1 wins \2 ttk \3/' | cut -c1-110)"; done
  node scripts/zone1-fairness-masher-sweep.ts 2>&1 | sed 's/^/  /'
}
if [ "$#" -eq 0 ]; then echo "== branch rows"; run; fi
for cand in "$@"; do
  IFS=: read -r hp attack <<< "$cand"
  node -e '
    const fs = require("fs"), f = "src/fight/archetype-defs.json", d = JSON.parse(fs.readFileSync(f, "utf8")), [hp, atk] = process.argv.slice(1), a = d.archetypes.find((x) => x.id === "wolf");
    a.health = Number(hp); if (Number(atk) > 0) a.sheet = { attack: Number(atk) }; else delete a.sheet;
    fs.writeFileSync(f, JSON.stringify(d, null, 1));' "$hp" "$attack"
  echo "== wolf $cand"; run
  git checkout -q -f -- src/fight/archetype-defs.json
done
