
test('open and the pending Pit claims are one statement: one round trip, two answers on two lines', async () => {
  const { openWithPending } = await import('../origins/server/store.ts');
  const calls: string[] = [];
  const db: Db = { async run(sql) { calls.push(sql); return `${JSON.stringify({ marks: 4, career: null, characters: [], items: [], quests: [], journal: [], talk: [] })}\n[]`; } };
  const got = await openWithPending(db, A, 50);
  assert.deepEqual([calls.length, got.snap.marks, got.pending], [1, 4, []]);
  assert.equal(calls[0]!.split(';').filter((s) => s.trim()).length, 1, 'a single statement');
});
