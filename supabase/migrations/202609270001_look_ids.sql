begin;
-- Look ids (docs/briefs/tier-kits.md B4; Lead's go to Backend, 2026-09-27): MID and HIGH pieces sit beside today's LOW ids as
-- `<opponent>.<slot>@<look>` (`veteran.Greaves@mid`, `witch.Body@primus`), each look a distinct collectable. 0001 constrained both piece
-- columns to the LOW shape, so every look id was refused at insert. This widens both to an optional `@<look>`; every LOW id still matches,
-- so no existing row is touched (hosted 2026-09-27: 1 claim, 1 award, both LOW). The look token stays generic here: the server names the
-- look it awards (src/awards.ts), never the client, so the DB only guards the shape.
-- Constraint names are Postgres's defaults for 0001's inline checks, verified on hosted (pg_constraint, 2026-09-27).
alter table public.loot_claims drop constraint loot_claims_piece_check;
alter table public.loot_claims add constraint loot_claims_piece_check check (piece ~ '^[a-z]{1,32}\.[A-Za-z]{1,32}(@[a-z]{1,16})?$');
alter table public.awards drop constraint awards_piece_check;
alter table public.awards add constraint awards_piece_check check (piece ~ '^[a-z]{1,32}\.[A-Za-z]{1,32}(@[a-z]{1,16})?$');
commit;
