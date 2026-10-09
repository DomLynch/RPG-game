-- Rollback of 202610080015_origins_beta_wipe.sql: drops exactly the function (a wipe already run is not undone; its read-back is the launch checklist's record).
begin;
drop function public.origins_beta_wipe();
commit;
