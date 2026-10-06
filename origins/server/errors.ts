// A refusal of the client's request (400): the writer's own rule, not the database's. Its own module so op files and the registry share it
// without importing each other.
export class BadRequest extends Error {}
