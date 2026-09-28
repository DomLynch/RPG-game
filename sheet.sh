#!/bin/bash
# $1 = look (L8...). 4 rows (finisher) x 4 frames (03,06,10,13), crop to the fighters' band, 1125x1200 -> 375x400
D=/Users/domininclynch/Desktop/Business/frankendom/.claude/worktrees/lucid-ellis-9746bf/artifacts/herolook/fin-goblin-$1-5a26a50e
O=$(dirname "$0")/sheets; mkdir -p $O
for f in decapitation splitCrown opened runThrough; do
  ffmpeg -loglevel error -y -i $D/$f-on/03.png -i $D/$f-on/06.png -i $D/$f-on/10.png -i $D/$f-on/13.png -filter_complex "[0]crop=1125:1200:0:800,scale=375:400[a];[1]crop=1125:1200:0:800,scale=375:400[b];[2]crop=1125:1200:0:800,scale=375:400[c];[3]crop=1125:1200:0:800,scale=375:400[d];[a][b][c][d]hstack=4" $O/$1-$f-row.png
done
ffmpeg -loglevel error -y -i $O/$1-decapitation-row.png -i $O/$1-splitCrown-row.png -i $O/$1-opened-row.png -i $O/$1-runThrough-row.png -filter_complex "vstack=4" $O/$1-grid.png && echo $O/$1-grid.png
