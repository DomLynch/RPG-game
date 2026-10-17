#!/usr/bin/env python3
"""Classify the hard-coded audit hits (hits.jsonl from rules.yml) into TUNABLE-GAMEPLAY / TUNABLE-PRESENTATION / CONTENT-BRANCH / CONTENT-LIST / LABEL
(all must move to rows under Dom's rule) and FORMAT / MATH / LANGUAGE / HARNESS / LOADER-KEY (allowed, each with its reason).
Usage: classify.py <repo> <hits.jsonl> <out.json>"""
import json, os, re, sys, glob, collections

repo, hits_path, out_path = sys.argv[1:4]
os.chdir(repo)

def list_from(test, const):
    src = open(test).read()
    m = re.search(rf"const {const} = \[(.*?)\];", src, re.S)
    return set(re.findall(r"'([^']+)'", m.group(1))) if m else set()
SIM = list_from('tests/record-version-guard.test.ts', 'SIM_FILES') | list_from('tests/world-sim-guard.test.ts', 'WORLD_SIM_FILES')

# every id a data row declares (src + origins json): a string literal equal to one of these, branched on in code, is content in code
IDS, ID_FILES = set(), collections.defaultdict(set)
def walk(o, f):
    if isinstance(o, dict):
        for k, v in o.items():
            if k in ('id', 'key', 'kind', 'body', 'zone', 'slot') and isinstance(v, str) and len(v) > 2: IDS.add(v); ID_FILES[v].add(f)
            walk(v, f)
    elif isinstance(o, list):
        for x in o: walk(x, f)
for f in glob.glob('src/**/*.json', recursive=True) + glob.glob('origins/**/*.json', recursive=True):
    if 'manifest' in f or 'baseline' in f: continue
    try: walk(json.load(open(f)), f)
    except Exception: pass
# ids whose behaviour IS code: the sim's move/action verbs and the fx/special template verbs (a branch on one dispatches behaviour, as the as-data allow-list's "verb" kind says)
VERB_FILE = re.compile(r'move|moves|action|stance|template|special-fx|fx-|verb|school|spell|cast|roll|gambit|tactic|phase')
# the sim's own closed vocabularies (duel.ts Phase/Action, world.ts Phase, match.ts Mode, moves.ts MoveId): engine verbs and states, not content rows
ENGINE = set()
for path, names in (('src/fight/duel.ts', ('Phase', 'Action')), ('src/fight/world.ts', ('Phase',)), ('src/fight/match.ts', ('Mode',)), ('src/fight/moves.ts', ('MoveId',))):
    src = open(path).read()
    for n in names:
        m = re.search(rf"export type {n} = ([^;]+);", src)
        if m: ENGINE |= set(re.findall(r"'([^']+)'", m.group(1)))
ENGINE |= {'block', 'pose', 'hit', 'light'}
def is_verb(s): return s in ENGINE or (bool(ID_FILES.get(s)) and all(VERB_FILE.search(x) for x in ID_FILES[s]))
GENERIC = {'ready', 'idle', 'attack', 'block', 'light', 'heavy', 'none', 'left', 'right', 'near', 'far', 'open', 'done', 'player', 'foe', 'day', 'night',
           'hero', 'guest', 'error', 'start', 'end', 'move', 'stand', 'walk', 'run', 'death', 'hit', 'miss', 'win', 'loss', 'draw', 'true', 'false', 'null'}

FORMAT_FILE = re.compile(r'(record|wire|frame|codec|pack|hash|detmath|digest|crc|base64|utf8|encode|decode|binary|bytes|ring|ticks?)\b[^/]*\.ts$|/net/')
HARNESS_FILE = re.compile(r'(fixtures|test-client|demo|probe|receipt|debug|dev-|harness|bench|stress|abprof|mock)')
VIEW_PATH = re.compile(r'^origins/preview/|^src/(ui|render|view|hud|audio|sound)|/(special-fx|signature|finisher-blood|blood|gore|camera|cam|crowd|sky|light|shadow|tint|rank-tint|look|fx|draw|paint|anim|pose|cloth|rig|mesh|material|texture|hud|label|tag|card|screen|menu|page|css|style|stills?|dressed?|dress|figure|view)[^/]*\.ts$|-view\.ts$|/fight/(characters|scene|arena|weapons?-look|dropped-weapon|opened|fatigue-read|boss-telegraph|spell-legends|witchfire|blood-style)')
MATH_VALUES = {'2', '0.5', '.5', '3', '4', '10', '1000', '1e3', '60', '3600', '24', '86400', '360', '180', '90', '100', '0.25', '.25', '255', '256', '65535', '65536', '1024',
               '8', '16', '32', '64', '128', '0.001', '1e-3', '1e-6', '1e-9', '1e-4', '1e-5', '1e-12', '43758.5453', '12.9898', '78.233', '127.1', '311.7', '269.5', '183.3'}
HTTP = {'200', '201', '204', '400', '401', '403', '404', '405', '409', '410', '413', '422', '429', '500', '502', '503'}
AMBIG = {'3', '4', '5', '6', '10', '100', '0.25', '.25', '0.75', '.75'}
PI_LIKE = re.compile(r'^(3\.14|6\.28|1\.57|0\.785|2\.718|57\.29|0\.0174)')
FMT_CALL = re.compile(r'\.(toFixed|padStart|padEnd|slice|substring|substr|toString|toPrecision|repeat|splice|at|charCodeAt|codePointAt|fromCharCode|getUint\w+|setUint\w+|getInt\w+|setInt\w+|getFloat\w+|setFloat\w+|subarray|fill)\(|parseInt\(|new (Uint|Int|Float)\w*Array\(|readUInt|writeUInt|readInt|writeInt|Buffer\.')
BITWISE = re.compile(r'<<|>>|>>>|[^&]&[^&]|[^|]\|[^|]|\^|0x[0-9a-fA-F]+')
TIMER = re.compile(r'set(Timeout|Interval)\(|AbortSignal\.timeout\(|requestIdleCallback')
LINES = {}
def line_of(f, n):
    if f not in LINES:
        try: LINES[f] = open(f, encoding='utf8').read().split('\n')
        except Exception: LINES[f] = []
    L = LINES[f]
    return L[n] if n < len(L) else ''

GAMEPLAY_PATH = re.compile(r'^origins/(server|presence|region1|zones|world|mobs|encounters|boss|feuds|pit|patrons|board|gear|shops|talk|npcs|crowd)/|^src/core/(?!.*(gear-room|gear-sheet|-view|hud|screen|page|ui))|^src/net/|^src/(roster|legends|career[^/]*)\.ts$')
UI_IN_GAMEPLAY = re.compile(r'(view|screen|page|card|hud|label|board-names|cloth|look|kit)\.ts$|/town-kit\.ts$|biomes-data\.ts$')
def file_role(f):
    if HARNESS_FILE.search(f): return 'harness'
    if FORMAT_FILE.search(f): return 'format'
    if f in SIM: return 'sim'
    if GAMEPLAY_PATH.search(f) and not UI_IN_GAMEPLAY.search(f): return 'gameplay'
    return 'view'

seen = {}
order = ['hc-num-const-lower', 'hc-num-const-body', 'hc-num-default', 'hc-num-compare', 'hc-num-pair', 'hc-num-array', 'hc-num-call-arg', 'hc-num-arith', 'hc-str-compare', 'hc-str-array']
for raw in open(hits_path):
    h = json.loads(raw)
    k = (h['file'], h['range']['start']['line'], h['range']['start']['column'])
    if k not in seen or order.index(h['ruleId']) < order.index(seen[k]['ruleId']): seen[k] = h

rows = []
for (f, ln, col), h in seen.items():
    text, rule, line = h['text'].strip(), h['ruleId'], line_of(f, ln)
    code = line.split('//')[0]
    role = file_role(f)
    if rule.startswith('hc-str'):
        s = text.strip('\'"`')
        if re.search(r"typeof\b", code) and s in ('number', 'string', 'object', 'function', 'undefined', 'boolean', 'bigint', 'symbol'): cls, why = 'LANGUAGE', 'typeof check'
        elif role == 'harness': cls, why = 'HARNESS', 'test/dev harness file'
        elif rule == 'hc-str-compare' and re.match(r'^[A-Z][a-z]+[A-Z]', s): cls, why = 'STATE', 'a sim event/type name (PascalCase)'
        elif rule == 'hc-str-compare' and re.search(r'\.(phase|type|stage|status|mode|state|scope|side|location|direction|binding|kind)\s*[!=]==?\s*$', code.split(text)[0]) : cls, why = 'STATE', 'a phase/type/state field compare'
        elif rule == 'hc-str-compare' and re.search(r"\.id\s*===\s*$", code.split(text)[0]): cls, why = 'ROW-READ', 'reads a row by its id (allowed)'
        elif rule == 'hc-str-compare' and s in IDS and s not in GENERIC and is_verb(s): cls, why = 'VERB', f'dispatches the engine verb "{s}" (behaviour is code)'
        elif rule == 'hc-str-compare' and s in IDS and s not in GENERIC: cls, why = 'CONTENT-BRANCH', f'branches on the data id "{s}" ({", ".join(sorted(ID_FILES[s]))[:90]})'
        elif rule == 'hc-str-array' and s in IDS and s not in GENERIC: cls, why = 'CONTENT-LIST', f'lists the data id "{s}" in code'
        elif rule == 'hc-str-array' and (' ' in s and re.search(r'[A-Za-z]{3}', s)): cls, why = 'LABEL', 'player-facing text in a code list'
        elif rule == 'hc-str-array': cls, why = 'LOADER-KEY', 'a key/field/state name list (not content)'
        else: cls, why = 'STATE', 'a state/protocol/enum literal, not a data id'
    else:
        v = text.lstrip('-').strip()
        if role == 'harness': cls, why = 'HARNESS', 'test/dev harness file'
        elif role == 'format': cls, why = 'FORMAT', 'record/wire/hash/byte layout file'
        elif FMT_CALL.search(code) and rule == 'hc-num-call-arg': cls, why = 'FORMAT', 'string/byte formatting argument'
        elif v in HTTP and re.search(r'reply\(|writeHead\(|refuse\(|send\(|status|Refused|\[\s*' + v, code): cls, why = 'PROTOCOL', f'HTTP status {v}'
        elif re.search(r'close\(\s*' + re.escape(v), code) or (v.isdigit() and 1000 <= int(v) <= 4999 and 'close(' in code): cls, why = 'PROTOCOL', f'WebSocket close code {v}'
        elif re.search(r'\.length\s*[<>]=?\s*' + re.escape(v) + r'\b|\b(max|min):\s*' + re.escape(v) + r'\b', code) and re.search(r'read(Text|String|Array|Id)|BadRequest|issues\.|\.length', code): cls, why = 'PROTOCOL', 'request/row shape bound (input validation)'
        elif BITWISE.search(code) and not TIMER.search(code): cls, why = 'FORMAT', 'bit/byte arithmetic'
        elif v in AMBIG and role in ('sim', 'gameplay') and not TIMER.search(code): cls, why = 'AMBIGUOUS', f'small integer {v} in game logic (a count/unit OR a tuning; needs a human look)'
        elif PI_LIKE.match(v) or v in MATH_VALUES and not TIMER.search(code): cls, why = 'MATH', f'unit/identity/math constant {v}'
        elif re.match(r'^0x[0-9a-fA-F]{6}$', v): cls, why = ('TUNABLE-PRESENTATION', 'a colour') if role != 'sim' else ('TUNABLE-GAMEPLAY', 'a colour in sim code')
        elif role in ('sim', 'gameplay'): cls, why = 'TUNABLE-GAMEPLAY', ('a timer delay' if TIMER.search(code) else 'a number in game logic')
        else: cls, why = 'TUNABLE-PRESENTATION', ('a timer delay' if TIMER.search(code) else 'a look/feel number in view code')
    rows.append({'file': f, 'line': ln + 1, 'rule': rule, 'text': text, 'class': cls, 'why': why, 'role': role, 'code': line.strip()[:200]})

json.dump(rows, open(out_path, 'w'))
by = collections.Counter(r['class'] for r in rows)
print('sites', len(rows), dict(by.most_common()))
print('by role', dict(collections.Counter(r['role'] for r in rows).most_common()))
print('sim files listed', len(SIM), 'data ids', len(IDS))
