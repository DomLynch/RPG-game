import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DbError, type Db } from './db.ts';
import { qaOf } from './qa-account.ts';

const ACCOUNT = '11111111-1111-4111-8111-111111111111';
const dbOf = (run: () => Promise<string>): Db => ({ run }) as unknown as Db;

test('qaOf: the mark answers yes / no; a missing migration or a failed lookup is "?" and never throws', async () => {
  assert.equal(await qaOf(dbOf(async () => 'true'), ACCOUNT), 'yes');
  assert.equal(await qaOf(dbOf(async () => 'false'), ACCOUNT), 'no');
  assert.equal(await qaOf(dbOf(async () => 'absent'), ACCOUNT), '?', 'the migration is not applied');
  assert.equal(await qaOf(dbOf(async () => { throw new DbError('XX000', 'db down'); }), ACCOUNT), '?', 'the database errors');
  assert.equal(await qaOf(dbOf(async () => { throw new Error('socket closed'); }), ACCOUNT), '?', 'any other error too');
});
