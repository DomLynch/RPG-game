begin;
-- Down for 202610080011_duel_season_archive.sql: drops exactly what it created. Refuses while the archive holds any season (archived ratings are never
-- dropped by a rollback; that needs Dom's own words). The live ladder is not touched.
do $$ begin
  if exists (select 1 from public.duel_season_ratings) then raise exception 'duel_season_ratings holds an archived season: not dropped' using errcode = 'P0001'; end if;
end $$;
drop function public.duel_season_close(text);
drop table public.duel_season_ratings;
commit;
