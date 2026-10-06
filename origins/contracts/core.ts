// Origins O1 shared contracts: the parsing core every schema module uses.
//
// Every contract is parsed from `unknown` (JSON off the wire, a content file, a database row) by a hand-written reader that returns a
// typed Result. Nothing throws and nothing is coerced: a wrong type, an unknown field, an unknown id or an unknown schema version is an
// explicit issue with a path, never a silent default. Readers collect every issue they can find rather than stopping at the first, so a
// content author sees the whole list in one pass.
//
// Zero dependencies by design (no zod, no ajv): the shapes are small, the rules are ours, and the server and the browser can both run
// this file unchanged.

export type IssueCode =
  | 'not-object'
  | 'missing-field'
  | 'unknown-field'
  | 'wrong-type'
  | 'out-of-range'
  | 'bad-id'
  | 'wrong-namespace'
  | 'unknown-id'
  | 'duplicate-id'
  | 'missing-version'
  | 'unsupported-version'
  | 'unknown-kind'
  | 'legacy-unknown'
  | 'rule-violation'
  | 'content-rule'
  | 'version-conflict'
  | 'story-version-mismatch'
  | 'no-migration';

export type Issue = { code: IssueCode; path: string; message: string };
export type Result<T> = { ok: true; value: T } | { ok: false; issues: Issue[] };

export const ok = <T>(value: T): Result<T> => ({ ok: true, value });
export const fail = <T = never>(code: IssueCode, path: string, message: string): Result<T> => ({ ok: false, issues: [{ code, path, message }] });

// A collector: readers push issues into it and return a best-effort value; `finish` turns it into a Result. The value is only handed
// out when no issue was recorded, so a partially read object can never escape as if it were valid.
export class Issues {
  readonly list: Issue[] = [];
  add(code: IssueCode, path: string, message: string): void {
    this.list.push({ code, path, message });
  }
  absorb<T>(result: Result<T>): T | undefined {
    if (result.ok) return result.value;
    this.list.push(...result.issues);
    return undefined;
  }
  get empty(): boolean {
    return this.list.length === 0;
  }
  finish<T>(value: T): Result<T> {
    return this.empty ? ok(value) : { ok: false, issues: [...this.list] };
  }
}

export const join = (path: string, key: string | number): string => (typeof key === 'number' ? `${path}[${key}]` : path ? `${path}.${key}` : key);

export type Obj = Record<string, unknown>;
export const isPlainObject = (value: unknown): value is Obj =>
  typeof value === 'object' && value !== null && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;

// An object with exactly these keys allowed. Unknown keys are an issue, not ignored: a field this build does not know is either a typo or
// data from a newer schema, and both must be loud. Returns undefined (with an issue) when the value is not a plain object.
export function readObject(issues: Issues, value: unknown, path: string, allowed: readonly string[]): Obj | undefined {
  if (!isPlainObject(value)) {
    issues.add('not-object', path || '(root)', 'expected a plain object');
    return undefined;
  }
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) issues.add('unknown-field', join(path, key), `field "${key}" is not part of this contract`);
  }
  return value;
}

const missing = (issues: Issues, obj: Obj, key: string, path: string): boolean => {
  if (!Object.hasOwn(obj, key) || obj[key] === undefined) {
    issues.add('missing-field', join(path, key), `required field "${key}" is missing`);
    return true;
  }
  return false;
};

export function readString(issues: Issues, obj: Obj, key: string, path: string, opts: { min?: number; max?: number; pattern?: RegExp } = {}): string | undefined {
  if (missing(issues, obj, key, path)) return undefined;
  return checkString(issues, obj[key], join(path, key), opts);
}

export function checkString(issues: Issues, value: unknown, path: string, opts: { min?: number; max?: number; pattern?: RegExp } = {}): string | undefined {
  if (typeof value !== 'string') {
    issues.add('wrong-type', path, 'expected a string');
    return undefined;
  }
  const min = opts.min ?? 0, max = opts.max ?? 2000;
  if (value.length < min || value.length > max) {
    issues.add('out-of-range', path, `string length ${value.length} is outside ${min}..${max}`);
    return undefined;
  }
  if (opts.pattern && !opts.pattern.test(value)) {
    issues.add('wrong-type', path, `"${value}" does not match ${opts.pattern}`);
    return undefined;
  }
  return value;
}

export function readOptionalString(issues: Issues, obj: Obj, key: string, path: string, opts: { min?: number; max?: number; pattern?: RegExp } = {}): string | undefined {
  if (!Object.hasOwn(obj, key) || obj[key] === undefined) return undefined;
  return checkString(issues, obj[key], join(path, key), opts);
}

// Integers only. Every number in these contracts is a count, an index, a percentage or a version, and a float in any of those is a bug
// upstream (the gear multipliers are derived by src/gear-stats.ts, never stored here).
export function readInt(issues: Issues, obj: Obj, key: string, path: string, min: number, max: number): number | undefined {
  if (missing(issues, obj, key, path)) return undefined;
  return checkInt(issues, obj[key], join(path, key), min, max);
}

export function checkInt(issues: Issues, value: unknown, path: string, min: number, max: number): number | undefined {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    issues.add('wrong-type', path, 'expected an integer');
    return undefined;
  }
  if (value < min || value > max) {
    issues.add('out-of-range', path, `${value} is outside ${min}..${max}`);
    return undefined;
  }
  return value;
}

export function readOptionalInt(issues: Issues, obj: Obj, key: string, path: string, min: number, max: number): number | undefined {
  if (!Object.hasOwn(obj, key) || obj[key] === undefined) return undefined;
  return checkInt(issues, obj[key], join(path, key), min, max);
}

export function readBoolean(issues: Issues, obj: Obj, key: string, path: string): boolean | undefined {
  if (missing(issues, obj, key, path)) return undefined;
  const value = obj[key];
  if (typeof value !== 'boolean') {
    issues.add('wrong-type', join(path, key), 'expected a boolean');
    return undefined;
  }
  return value;
}

export function readEnum<T extends string>(issues: Issues, obj: Obj, key: string, path: string, values: readonly T[]): T | undefined {
  if (missing(issues, obj, key, path)) return undefined;
  return checkEnum(issues, obj[key], join(path, key), values);
}

export function checkEnum<T extends string>(issues: Issues, value: unknown, path: string, values: readonly T[]): T | undefined {
  if (typeof value !== 'string' || !(values as readonly string[]).includes(value)) {
    issues.add('wrong-type', path, `expected one of ${values.join(', ')}`);
    return undefined;
  }
  return value as T;
}

// An array whose every element is read by `each`. The array itself is returned only when every element read cleanly.
export function readArray<T>(issues: Issues, obj: Obj, key: string, path: string, each: (value: unknown, path: string) => T | undefined, opts: { min?: number; max?: number } = {}): T[] | undefined {
  if (missing(issues, obj, key, path)) return undefined;
  return checkArray(issues, obj[key], join(path, key), each, opts);
}

export function checkArray<T>(issues: Issues, value: unknown, path: string, each: (value: unknown, path: string) => T | undefined, opts: { min?: number; max?: number } = {}): T[] | undefined {
  if (!Array.isArray(value)) {
    issues.add('wrong-type', path, 'expected an array');
    return undefined;
  }
  const min = opts.min ?? 0, max = opts.max ?? 10_000;
  if (value.length < min || value.length > max) {
    issues.add('out-of-range', path, `array length ${value.length} is outside ${min}..${max}`);
    return undefined;
  }
  const out: T[] = [];
  let clean = true;
  value.forEach((item, index) => {
    const read = each(item, join(path, index));
    if (read === undefined) clean = false;
    else out.push(read);
  });
  return clean ? out : undefined;
}

// ---- schema versions -----------------------------------------------------------------------------------------------------------
// Every top-level contract carries `schemaVersion`. A reader knows exactly the versions it can read (today: only its current one). A
// missing version and any other number are both explicit failures: an older build must never half-read a newer record and write it
// back without the fields it did not understand (the src/loot.ts cleanLoot hazard the O0 baseline names, §5 collision 3).
export function readSchemaVersion(issues: Issues, obj: Obj, path: string, supported: readonly number[]): number | undefined {
  if (!Object.hasOwn(obj, 'schemaVersion')) {
    issues.add('missing-version', join(path, 'schemaVersion'), 'schemaVersion is required on every contract');
    return undefined;
  }
  const value = obj.schemaVersion;
  if (typeof value !== 'number' || !Number.isInteger(value) || !supported.includes(value)) {
    issues.add('unsupported-version', join(path, 'schemaVersion'), `schemaVersion ${JSON.stringify(value)} is not one this build reads (supported: ${supported.join(', ')})`);
    return undefined;
  }
  return value;
}

// Contract kinds. Every top-level record names its kind so a mixed content bundle can be dispatched without guessing from shape.
export const KINDS = [
  'item-definition',
  'item-instance',
  'loot-table',
  'character-definition',
  'character-instance',
  'faction-definition',
  'faction-standing',
  'region-definition',
  'encounter-definition',
  'quest-definition',
  'quest-state',
  'trade',
  'service-definition',
  'upgrade-cost-table',
  'upgrade-request',
  'upgrade-receipt',
] as const;
export type Kind = (typeof KINDS)[number];

export function readKind(issues: Issues, obj: Obj, path: string, expected: Kind): Kind | undefined {
  if (!Object.hasOwn(obj, 'kind')) {
    issues.add('missing-field', join(path, 'kind'), `kind is required (expected "${expected}")`);
    return undefined;
  }
  if (obj.kind !== expected) {
    issues.add('unknown-kind', join(path, 'kind'), `expected kind "${expected}", got ${JSON.stringify(obj.kind)}`);
    return undefined;
  }
  return expected;
}

// ISO-8601 UTC timestamps, second precision or finer, always with Z. Stored as text so a record round-trips byte-identical.
export const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?Z$/;
export function readTimestamp(issues: Issues, obj: Obj, key: string, path: string): string | undefined {
  const value = readString(issues, obj, key, path, { min: 1, max: 40, pattern: ISO_UTC });
  if (value !== undefined && Number.isNaN(Date.parse(value))) {
    issues.add('wrong-type', join(path, key), `"${value}" is not a real date`);
    return undefined;
  }
  return value;
}

// Plain display text (names, journal lines): non-empty unless allowed, bounded, no control characters.
// Tab, newline and carriage return are allowed; every other C0 control and DEL is not. A char-code scan rather than a regex range, so
// the rule is readable and lint-clean.
const hasControl = (text: string): boolean => {
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if ((code < 32 && code !== 9 && code !== 10 && code !== 13) || code === 127) return true;
  }
  return false;
};
export function readText(issues: Issues, obj: Obj, key: string, path: string, opts: { min?: number; max?: number } = {}): string | undefined {
  const value = readString(issues, obj, key, path, { min: opts.min ?? 1, max: opts.max ?? 2000 });
  if (value !== undefined && hasControl(value)) {
    issues.add('wrong-type', join(path, key), 'text contains control characters');
    return undefined;
  }
  return value;
}

// An idempotency or mint key: a transaction's own name, unique per effect (a claim, a reward, an upgrade request).
export const MINT_KEY_PATTERN = /^[a-z0-9][a-z0-9:._-]{7,127}$/;

// A local key inside one record (a stage id inside a quest, a portal id inside a region): lowercase, short, no namespace.
export const LOCAL_KEY = /^[a-z][a-z0-9-]{0,47}$/;
