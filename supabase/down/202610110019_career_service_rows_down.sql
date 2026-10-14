begin;
-- Undoes 202610110019_career_service_rows.sql. Nothing depends on these objects; the rows are cosmetic (scorecard notes, trial tallies) or constants (the ladder).
drop function if exists public.leaderboards(integer);
drop function if exists public.scorecard_rows();
drop table if exists public.control_trials;
drop table if exists public.scorecard_notes;
drop table if exists public.pit_ladder;
commit;
