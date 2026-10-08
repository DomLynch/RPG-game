// A refusal of the client's request (400): the writer's own rule, not the database's. Its own module so op files and the registry share it
// without importing each other.
export class BadRequest extends Error {}

// A refusal that is the server's, not the request's: 503 when the writer started without the content an op runs on, 501 when the op would
// have to pay something the schema has no write for yet. The client may retry the first later; the second waits for a server change. `code`
// rides in the body when set (422 'kit-mismatch': a world-fight record played on another mob kit than the writer's, origins/mobs/kit-version.ts): the smith's coin cost (no metals ledger) is a 501 with code 'not-implemented'; the story ops' refusals carry none.
export class Refused extends Error {
  status: 422 | 501 | 503;
  code?: string;
  constructor(status: 422 | 501 | 503, message: string, code?: string) { super(message); this.status = status; if (code !== undefined) this.code = code; }
}

// The same op id already stands for a different request (Strategy, 2026-10-06): never applied, answered 409.
export class Conflict extends Error {}
