begin;
-- Security advisor (issue #397, lint 0028/0029): public.rls_auto_enable() is Supabase's own platform helper — the event trigger
-- `ensure_rls` calls it as its owner after every CREATE TABLE to switch RLS on — but it was created SECURITY DEFINER with EXECUTE
-- granted to PUBLIC, so PostgREST also exposed it as POST /rest/v1/rpc/rls_auto_enable to anon and authenticated. Outside an event
-- trigger it can only error (pg_event_trigger_ddl_commands() has no context), so revoking client execute changes nothing that works
-- and removes a definer function from the public RPC surface. The event trigger keeps running: triggers call the function as its
-- owner, not through a grant. Guarded so the migration is a no-op wherever the platform function does not exist (the local RLS check
-- cluster, a fresh project) and idempotent if the platform recreates the function on an upgrade (re-run it then).
do $$ begin
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'rls_auto_enable') then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end $$;
commit;
