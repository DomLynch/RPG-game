// Shared by scripts/vps-shadow/rows-json.mjs (the VPS writes rows.json) and scripts/vps-shadow-diff.mjs (the Mac compares). Pure functions
// over text: the release-checks.mjs log format, the row set, and the "pin" values a row's own log prints.
// Row 49 runs Linux WebKit; the Mac runs Safari's WebKit. Same engine family, different build: its verdict is flagged, never read as Safari's.
export const WEBKIT_NOTE = 'Linux WebKit ≠ Mac Safari';
export const isWebKitRow = command => /--engine\s+webkit\b/.test(command);

// One line per attempt in a release-checks.mjs log (scripts/release-checks.mjs:54,61,71,108):
//   Release check 7/49 passed in 41s, ended 12:01:03 — node scripts/counter-browser-check.mjs
//   Release check 7/49 FAILED (exit 1) in 60s, ended … — node …      Release check 7/49 CEILING 600s — killing … — node …
//   Release check 7/49 trusted from CI release-checks for <sha> — node …
// The LAST line for a row is its result (a failed row is retried once alone and its retry line comes later); attempts are counted.
const LINE = /^(?:Release|Extended) check (\d+)\/(\d+) (passed|FAILED \(exit (\d+)\)|CEILING (\d+)s|trusted from (.+?))(?: in (\d+)s)?.*? — (.+)$/;
export function parseRowsLog(text) {
  const rows = new Map();
  let total = 0;
  for (const raw of text.split('\n')) {
    const line = raw.replace(/\r$/, '');
    const m = LINE.exec(line);
    if (!m) continue;
    const [, index, count, verdict, exit, ceiling, trustedFrom, seconds, command] = m;
    total = Number(count);
    const prior = rows.get(Number(index));
    const status = verdict === 'passed' ? 'pass' : verdict.startsWith('FAILED') ? 'fail' : verdict.startsWith('CEILING') ? 'ceiling' : 'trusted';
    rows.set(Number(index), {
      index: Number(index), command: command.trim(), status,
      seconds: seconds === undefined ? (status === 'ceiling' ? Number(ceiling) : 0) : Number(seconds),
      attempts: (prior?.attempts ?? 0) + 1,
      ...(exit !== undefined ? { exit: Number(exit) } : {}),
      ...(trustedFrom !== undefined ? { trusted: trustedFrom } : {}),
    });
  }
  return { total, rows: [...rows.values()].sort((a, b) => a.index - b.index) };
}

// A row set from .quality-gate.json's release_commands: index (1-based), name (the script file) and the argv joined as the log prints it.
export const rowSet = commands => commands.map((argv, i) => ({
  index: i + 1, command: argv.join(' '),
  name: (argv.find(arg => arg.endsWith('.mjs') || arg.endsWith('.js') || arg.endsWith('.sh')) || argv[0]).replace(/^scripts\//, ''),
  ...(isWebKitRow(argv.join(' ')) ? { note: WEBKIT_NOTE } : {}),
}));

// What a row "pinned": a hash, digest, state hash, snapshot or pin value its own log prints (hex, 8+ chars, or a `sha256:`/`=` value).
// Compared verbatim between the two boxes; a row that prints none compares on pass/fail alone. Ordered, de-duplicated, capped.
const PIN = /\b(?:state[- _]?hash|digest|snapshot|pin(?:ned)?|checksum|sha(?:256|1)?|hash)\b[^\n0-9a-f]{0,40}([0-9a-f]{8,64})\b/gi;
export function extractPins(logText, cap = 6) {
  const pins = [];
  for (const m of logText.matchAll(PIN)) if (!pins.includes(m[1])) pins.push(m[1]);
  return pins.slice(0, cap);
}

// The Mac's deploy log carries the same lines (deploy.sh runs release-checks.mjs); a Mac release-checks.json receipt (written only when
// every row passed) is the other accepted shape.
export function macRows(text) {
  if (text.trimStart().startsWith('{')) {
    const receipt = JSON.parse(text);
    return {
      total: receipt.checks, revision: receipt.revision,
      rows: (receipt.checks_detail || []).map(r => ({
        index: r.index, command: r.command, seconds: r.seconds, attempts: r.retried ? 2 : 1,
        status: r.trusted ? 'trusted' : 'pass', ...(r.trusted ? { trusted: r.trusted } : {}),
      })),
    };
  }
  const parsed = parseRowsLog(text);
  const revision = /Release checks passed for ([0-9a-f]{40})|"revision":"([0-9a-f]{40})"/.exec(text);
  return { ...parsed, revision: revision?.[1] || revision?.[2] };
}

const cell = row => row ? `${row.status}${row.trusted ? '' : ` ${row.seconds}s`}${row.attempts > 1 ? ' (retry)' : ''}` : 'missing';
// The per-row table Lead asked for (not a summary): row, Mac result, VPS result, pin values where the row has one, same/differs.
export function diffTable(mac, vps, pins = { mac: new Map(), vps: new Map() }) {
  const indices = new Set([...mac.rows.map(r => r.index), ...vps.rows.map(r => r.index)]);
  const byIndex = list => new Map(list.map(r => [r.index, r]));
  const m = byIndex(mac.rows), v = byIndex(vps.rows);
  const lines = ['| # | row | Mac | VPS | pin Mac | pin VPS | verdict |', '|---|---|---|---|---|---|---|'];
  const tally = { same: 0, differs: 0, missing: 0, flagged: 0 };
  for (const index of [...indices].sort((a, b) => a - b)) {
    const a = m.get(index), b = v.get(index), name = (b?.name || a?.command || b?.command || '').replace(/^node scripts\//, '');
    const pa = pins.mac.get(index) || [], pb = pins.vps.get(index) || [];
    let verdict;
    if (!a || !b) { verdict = 'missing'; tally.missing++; }
    else if (a.status === 'trusted' || b.status === 'trusted') { verdict = 'trusted on one side'; tally.missing++; }
    else if (a.status !== b.status) { verdict = 'DIFFERS (result)'; tally.differs++; }
    else if (pa.length && pb.length && (pa.length !== pb.length || pa.some((p, i) => p !== pb[i]))) { verdict = 'DIFFERS (pin)'; tally.differs++; }
    else { verdict = 'same'; tally.same++; }
    if (b?.note || (a && isWebKitRow(a.command))) { verdict += ` · ${WEBKIT_NOTE}`; tally.flagged++; }
    lines.push(`| ${index} | ${name} | ${cell(a)} | ${cell(b)} | ${pa.join('<br>') || ''} | ${pb.join('<br>') || ''} | ${verdict} |`);
  }
  return { lines, tally };
}
