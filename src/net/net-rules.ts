// The duel netcode's numbers (rollback, handshake, silence, reconnect, message caps, the anti-farm placeholders) are rows in net-rules.json; this reads them by table.
// Each export keeps the exact shape the code had: the row's id and note are the row's, not the number set's.
import RULES from './net-rules.json' with { type: 'json' };

const bare = <T extends { id: string; note: string }>(row: T): Omit<T, 'id' | 'note'> => { const { id: _id, note: _note, ...numbers } = row; return numbers; };

export const NET_ROW = bare(RULES.net[0]!);
export const PLAYABLE_ROW = bare(RULES.playable[0]!);
export const PING_ROW = bare(RULES.ping[0]!);
export const SILENCE_ROW = bare(RULES.silence[0]!);
export const RECONNECT_ROW = bare(RULES.reconnect[0]!);
export const CAPS_ROW = bare(RULES.messageCaps[0]!);
export const ANTIFARM_ROW = bare(RULES.duelAntifarm[0]!);
