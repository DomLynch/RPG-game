// A raw duplicate-key scan for JSON text. JSON.parse keeps the LAST of two equal keys without a word, so a pasted row that repeats an id passes every check that reads the parsed value (Auditor HOLD on #2275).
// This walks the text itself and returns one entry per repeated key: { path, key, line } where `path` is where the object holding it sits (`mobLooks.looks`, `towns[0].services`; "" for the root), `key` the repeated
// key and `line` the 1-based line of the SECOND (shadowing) occurrence. Pure: no imports, no I/O. One implementation: the data-only gate (scripts/data-only-check.mjs) runs it over every .json file on the data
// path, zoneProblems over a zone row's text, tests/json-dup-keys.test.ts over every committed one, and Backend's registry loader imports it as is.
export function duplicateKeys(text) {
  let i = 0, line = 1, lineAt = 0; const found = [];   // lineAt: the offset up to which newlines are already counted
  const lineOf = (at) => { for (; lineAt < at; lineAt++) if (text[lineAt] === '\n') line++; return line; };
  const fail = (why) => { throw new Error(`not JSON at line ${lineOf(Math.min(i, text.length))}: ${why}`); };
  const ws = () => { while (i < text.length && ' \t\n\r'.includes(text[i])) i++; };
  const str = () => {   // a string token, returned decoded (so "ab" and "ab" are the same key)
    if (text[i] !== '"') fail('expected a string'); const start = i++;
    while (i < text.length && text[i] !== '"') i += text[i] === '\\' ? 2 : 1;
    if (i >= text.length) fail('unterminated string'); i++; return JSON.parse(text.slice(start, i));
  };
  const step = (path, key) => (/^[A-Za-z_$][\w$]*$/.test(key) ? `${path}${path ? '.' : ''}${key}` : `${path}[${JSON.stringify(key)}]`);
  const value = (path) => {
    ws(); const c = text[i];
    if (c === '{') {
      i++; const seen = new Set(); ws();
      if (text[i] === '}') { i++; return; }
      for (;;) {
        ws(); const at = i, key = str(); if (seen.has(key)) found.push({ path, key, line: lineOf(at) }); seen.add(key);
        ws(); if (text[i] !== ':') fail('expected a colon'); i++; value(step(path, key));
        ws(); if (text[i] === ',') { i++; continue; } if (text[i] === '}') { i++; return; } fail('expected , or }');
      }
    } else if (c === '[') {
      i++; ws(); if (text[i] === ']') { i++; return; }
      for (let n = 0; ; n++) { value(`${path}[${n}]`); ws(); if (text[i] === ',') { i++; continue; } if (text[i] === ']') { i++; return; } fail('expected , or ]'); }
    } else if (c === '"') str();
    else { const m = /^(?:-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null)/.exec(text.slice(i, i + 40)); if (!m) fail('expected a value'); i += m[0].length; }
  };
  value(''); ws(); if (i < text.length) fail('trailing text');
  return found;
}
/** One readable line per finding, for a gate message. */
export const describeDuplicates = (file, dups) => dups.map((d) => `${file}:${d.line}: duplicate key ${JSON.stringify(d.key)}${d.path ? ` in ${d.path}` : ''} (JSON.parse would silently keep the last)`);
