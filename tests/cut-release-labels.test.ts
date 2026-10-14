// Labelling is idempotent: a label the PR already has is never POSTed again (FM #2732 and FN #2733 each got ci:release-checks + auditor:ready twice, 1 s apart, which cancelled the first CI run).
import assert from 'node:assert/strict';
import test from 'node:test';

const { LABELS, ensureLabels, openPrViaRest } = await import('../scripts/cut-release.mjs');

// A GitHub that remembers: the labels on PR 42 persist between calls, and every request is recorded.
function github(initial: string[], { readStatus = 200 }: { readStatus?: number } = {}) {
  const have = new Set(initial), calls: string[] = [];
  const fetchImpl = (async (url: string, init: { method?: string; body?: string } = {}) => {
    const path = url.replace('https://api.github.com/repos/o/r', ''), method = init.method || 'GET';
    calls.push(`${method} ${path}`);
    if (path.startsWith('/pulls?')) return { ok: true, status: 200, json: async () => [{ number: 42 }] };
    if (path === '/issues/42/labels?per_page=100') return { ok: readStatus === 200, status: readStatus, json: async () => (readStatus === 200 ? [...have].map(name => ({ name })) : { message: 'boom' }) };
    if (path === '/issues/42/labels' && method === 'POST') { for (const l of JSON.parse(init.body!).labels) have.add(l); return { ok: true, status: 200, json: async () => [...have].map(name => ({ name })) }; }
    throw new Error(`unexpected ${method} ${path}`);
  }) as unknown as typeof fetch;
  return { fetchImpl, calls, have };
}
const args = { repo: 'o/r', token: 't', number: 42, labels: LABELS };
const posts = (calls: string[]) => calls.filter(c => c.startsWith('POST'));

test('both labels already there (gh --label did it): the check reads them and POSTs nothing', async () => {
  const g = github([...LABELS]), lines: string[] = [];
  assert.deepEqual(await ensureLabels({ ...args, fetchImpl: g.fetchImpl, log: l => lines.push(l) }), { added: [] });
  assert.deepEqual(g.calls, ['GET /issues/42/labels?per_page=100']);
  assert.equal(lines.length, 1); assert.match(lines[0], /^\[\d{4}-\d\d-\d\dT[\d:.]+Z\] cut-release: #42 already has ci:release-checks, auditor:ready; no label POST$/);
});

test('only the missing label is POSTed, and the line says what was found and what was sent', async () => {
  const g = github(['auditor:ready']), lines: string[] = [];
  assert.deepEqual(await ensureLabels({ ...args, fetchImpl: g.fetchImpl, log: l => lines.push(l) }), { added: ['ci:release-checks'] });
  assert.deepEqual(posts(g.calls), ['POST /issues/42/labels']);
  assert.ok([...g.have].sort().join() === [...LABELS].sort().join());
  assert.ok(lines.some(l => /has \[auditor:ready\]; POSTing ci:release-checks/.test(l)) && lines.some(l => /label POST on #42 \(ci:release-checks\) -> HTTP 200/.test(l)));
  assert.ok(lines.every(l => /^\[\d{4}-\d\d-\d\dT/.test(l)), 'every line is timestamped');
});

test('the REST fallback run twice (gh made the PR and hung, then a retry) POSTs the labels once: the second run POSTs nothing', async () => {
  const g = github([]), lines: string[] = [], run = () => openPrViaRest({ repo: 'o/r', token: 't', head: 'release-ZZ', base: 'trunk', title: 'x', body: 'y', labels: LABELS, fetchImpl: g.fetchImpl, log: l => lines.push(l) });
  assert.equal(await run(), 42); assert.equal(posts(g.calls).length, 1);
  assert.equal(await run(), 42); assert.equal(posts(g.calls).length, 1, 'still one POST in total');
  assert.ok(lines.some(l => /REST fallback reusing open PR #42 for release-ZZ/.test(l)), 'the fallback announces itself with a timestamp');
});

test('if the label read fails the labels are still POSTed (a missing ci:release-checks costs the cut) and the line says the read failed', async () => {
  const g = github([], { readStatus: 502 }), lines: string[] = [];
  assert.deepEqual((await ensureLabels({ ...args, fetchImpl: g.fetchImpl, log: l => lines.push(l) })).added, [...LABELS]);
  assert.equal(posts(g.calls).length, 1);
  assert.ok(lines.some(l => /reading the labels of #42 failed \(HTTP 502\); POSTing all of/.test(l)));
});
