export type DuplicateKey = { path: string; key: string; line: number };
export function duplicateKeys(text: string): DuplicateKey[];
export function describeDuplicates(file: string, dups: DuplicateKey[]): string[];
