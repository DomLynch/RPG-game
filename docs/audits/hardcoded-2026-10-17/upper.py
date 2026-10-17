#!/usr/bin/env python3
"""List every UPPER_SNAKE const whose value is a plain number or a numeric expression (src + origins, no tests), with its allow-list entry if any.
Usage: upper.py <repo> <out.json>"""
import json, os, re, sys, glob, subprocess
repo, out = sys.argv[1:3]
os.chdir(repo)
allow = {}
for f in glob.glob('scripts/as-data/allow/*.json'):
    d = json.load(open(f))
    for k, v in d.items():
        if isinstance(v, list):
            for r in v:
                if isinstance(r, dict) and 'file' in r and 'name' in r: allow[(r['file'], r['name'])] = (r.get('kind', ''), r.get('reason', ''), k)
files = [f for f in subprocess.run(['git', 'ls-files', 'src', 'origins'], capture_output=True, text=True).stdout.split() if f.endswith('.ts') and not f.endswith('.test.ts') and not f.endswith('.d.ts')]
pat = re.compile(r'^(?:export )?const ([A-Z][A-Z0-9_]+)\s*(?::[^=]+)?=\s*(-?[0-9][0-9_.e+-]*(?:\s*[*/+-]\s*[0-9A-Z_.]+)*)\s*[;,]?\s*(//.*)?$')
rows = []
for f in files:
    for i, line in enumerate(open(f, encoding='utf8').read().split('\n')):
        m = pat.match(line)
        if m:
            a = allow.get((f, m.group(1)))
            rows.append({'file': f, 'line': i + 1, 'name': m.group(1), 'value': m.group(2).strip(), 'comment': (m.group(3) or '')[2:].strip()[:140],
                         'allow': a[0] if a else None, 'reason': a[1][:140] if a else None, 'list': a[2] if a else None})
json.dump(rows, open(out, 'w'), indent=0)
print('upper numeric consts', len(rows), 'allow-listed', sum(1 for r in rows if r['allow']))
