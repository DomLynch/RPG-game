#!/usr/bin/env bash
# sweep 3 + the before column, strictly one after the other (one clone, one job)
cd /srv/dev-jobs/er-timings
echo "#### BEFORE (release-K6p2 rows, untouched)"
NOFILES=1 BASE=release-K6p2 bash zone1-fairness-tune.sh before:0:0
echo "#### AFTER candidates (on release-K6p2)"
BASE=release-K6p2 bash zone1-fairness-tune.sh wolf:0:0 troll:840:80 salamander:170:0 salamander:160:8 salamander:150:12 salamander:190:0
