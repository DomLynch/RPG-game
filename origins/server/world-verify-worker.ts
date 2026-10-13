// The replay runs here, off the writer's request thread (world-verify-pool.ts). One job at a time; verifyWorldRecord never throws.
import { parentPort } from 'node:worker_threads';
import { verifyWorldRecord, type VerifyJob } from './world-verify.ts';

parentPort!.on('message', (m: VerifyJob & { id: number }) => {
  void verifyWorldRecord(m.text, m.spawn, m.kind, m.limit, m.maxTicks).then((v) => parentPort!.postMessage({ id: m.id, v }));
});
