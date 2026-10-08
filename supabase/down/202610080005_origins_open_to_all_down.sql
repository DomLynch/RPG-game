begin;
-- Undoes 202610080005_origins_open_to_all.sql: origins_allowed gets 202610060001's body back (flag AND allowlist), and the open-to-all key goes.
-- Run the data rollback first if Origins was opened (origins_enabled = false), so nobody is mid-session on a gate that changes under them.
create or replace function public.origins_allowed(p_account uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select value = 'true'::jsonb from public.origins_config where key = 'origins_enabled'), false)
     and exists (select 1 from public.origins_access where account = p_account)
$$;
delete from public.origins_config where key = 'origins_open_to_all';
commit;
