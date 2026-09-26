#!/bin/bash
S=$(dirname "$0"); for c in "$@"; do n=$(wc -l < $S/out); echo "$c" >> $S/cmd; for i in $(seq 1 300); do [ $(wc -l < $S/out) -gt $n ] && break; sleep 0.2; done; tail -1 $S/out | sed -E 's/\| +/|/g' | cut -c1-330; done
