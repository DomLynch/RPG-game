begin;
-- Undo 202610070002_duel_record.sql: the stored records are unverified wall data, so dropping loses no award, rank or loot.
drop function if exists public.report_duel_record(text, integer, jsonb);
drop table if exists public.duel_records;
commit;
