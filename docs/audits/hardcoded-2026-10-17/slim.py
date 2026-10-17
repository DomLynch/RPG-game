#!/usr/bin/env python3
"""Reads ast-grep --json=stream on stdin and prints one compact JSON line per match (file, start, text, rule): drops the echoed source lines."""
import json, sys
for raw in sys.stdin:
    h = json.loads(raw)
    print(json.dumps({'file': h['file'], 'range': {'start': h['range']['start']}, 'text': h['text'][:80], 'ruleId': h['ruleId']}))
