#!/usr/bin/env python3
"""Emit the audit's markdown tables (by area, by file) and the sites CSV from classified.json. Usage: tables.py <classified.json> <md-out> <csv-out>"""
import json, sys, collections, csv
R = json.load(open(sys.argv[1]))
MOVE = ['TUNABLE-GAMEPLAY', 'CONTENT-BRANCH', 'CONTENT-LIST', 'LABEL', 'AMBIGUOUS', 'TUNABLE-PRESENTATION']
KEEP = ['MATH', 'FORMAT', 'PROTOCOL', 'STATE', 'VERB', 'LANGUAGE', 'LOADER-KEY', 'ROW-READ', 'HARNESS']
SHORT = {'TUNABLE-GAMEPLAY': 'Game', 'CONTENT-BRANCH': 'Branch', 'CONTENT-LIST': 'List', 'LABEL': 'Label', 'AMBIGUOUS': 'Ambig', 'TUNABLE-PRESENTATION': 'Look',
         'MATH': 'Math', 'FORMAT': 'Fmt', 'PROTOCOL': 'Proto', 'STATE': 'State', 'VERB': 'Verb', 'LANGUAGE': 'Lang', 'LOADER-KEY': 'Key', 'ROW-READ': 'RowRd', 'HARNESS': 'Harn'}
cols = MOVE + KEEP
def area(f):
    p = f.split('/')
    return '/'.join(p[:2]) + '/' if len(p) > 2 else f
out = []
def table(keyf, title, rows_filter=None, limit=None, sortkey=None):
    c = collections.defaultdict(collections.Counter)
    for r in R: c[keyf(r)][r['class']] += 1
    keys = [k for k in c if rows_filter is None or rows_filter(c[k])]
    keys.sort(key=sortkey or (lambda k: (-(c[k]['TUNABLE-GAMEPLAY'] * 4 + (c[k]['CONTENT-BRANCH'] + c[k]['CONTENT-LIST'] + c[k]['LABEL']) * 3 + c[k]['AMBIGUOUS'] * 2 + c[k]['TUNABLE-PRESENTATION']), k)))
    if limit: keys = keys[:limit]
    out.append(f'\n#### {title}\n')
    out.append('| ' + ' | '.join(['Where'] + [SHORT[x] for x in cols]) + ' |')
    out.append('|' + '---|' * (len(cols) + 1))
    tot = collections.Counter()
    for k in keys:
        tot.update(c[k])
        out.append(f'| `{k}` | ' + ' | '.join(str(c[k][x] or '') for x in cols) + ' |')
    if not limit: out.append('| **total** | ' + ' | '.join(f'**{tot[x]}**' for x in cols) + ' |')
table(lambda r: area(r['file']), 'By area (every site)')
table(lambda r: r['file'], 'By file: every file with at least one site to move (Game, Branch, List, Label, Ambig or Look)', rows_filter=lambda cc: any(cc[x] for x in MOVE))
open(sys.argv[2], 'w').write('\n'.join(out) + '\n')
w = csv.writer(open(sys.argv[3], 'w', newline=''))
w.writerow(['class', 'file', 'line', 'literal', 'shape', 'why', 'code'])
for r in sorted(R, key=lambda r: (MOVE.index(r['class']) if r['class'] in MOVE else 99, r['file'], r['line'])):
    if r['class'] in MOVE[:5]: w.writerow([r['class'], r['file'], r['line'], r['text'], r['rule'].replace('hc-', ''), r['why'], r['code'][:160]])
print('md lines', len(out))
