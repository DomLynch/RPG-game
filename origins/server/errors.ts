// A refusal of the client's request (400): the writer's own rule, not the database's. Its own module so op files and the registry share it
// without importing each other.
export class BadRequest extends Error {}

// A refusal that is the server's, not the request's: 503 when the writer started without the content an op runs on, 501 when the op would
// have to pay something the schema has no write for yet. The client may retry the first later; the second waits for a server change.
export class Refused extends Error {
  status: 501 | 503;
  constructor(status: 501 | 503, message: string) { super(message); this.status = status; }
}

// The same op id already stands for a different request (Strategy, 2026-10-06): never applied, answered 409.
export class Conflict extends Error {}
