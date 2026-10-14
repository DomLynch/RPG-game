begin;
-- ROLLBACK: supabase/down/202610130027_grimoire_core_down.sql (drops exactly what this file creates).
-- CLASS 1, ADDITIVE and Origins-only (top-30 programme 2b, "kill a boss, take their spell"). origins_grimoire is the account's grimoire AND its ledger: one row per (account, LEGEND), written once,
-- reason `spell-taken`, carrying the legend id (the spell row's id without `spell:`, src/fight/spells-*.json, so two legends of one family at the same rank each hold their own spell, and the same
-- legend twice is one row). `bricks` is that spell row's bricks {root, modifiers, suffix} at the time it was taken; bricks are account-level, so every character of the account shares them. source_event is the encounter event that paid it.
-- It does NOT touch origins_events (its kind constraint is a live-table ALTER, class 2). RLS on, no policy, no client grant: only the definer functions below write it.
create table public.origins_grimoire (
  account uuid not null references auth.users (id) on delete cascade,
  legend text not null check (legend ~ '^[a-z][a-z0-9_.:-]{0,63}$'),
  reason text not null default 'spell-taken' check (reason = 'spell-taken'),
  bricks jsonb not null check (jsonb_typeof(bricks) = 'object' and jsonb_typeof(bricks->'root') = 'string' and jsonb_typeof(bricks->'modifiers') = 'array' and jsonb_typeof(bricks->'suffix') in ('string', 'null')),
  source_event text not null,
  taken_at timestamptz not null default now(),
  primary key (account, legend)
);
alter table public.origins_grimoire enable row level security;
revoke all on public.origins_grimoire from public, anon, authenticated;
grant select on public.origins_grimoire to frankendom_origins, frankendom_verifier;

-- The settle with the fight's practice lines (0026) AND its spell lines: [{legend, bricks:{root, modifiers:[text], suffix}, key:"spell:<legend>"}]. Taken only on a win, only for the run's own account, once per legend
-- (on conflict do nothing): a retried settle, a second win against the same legend or the same legend through another character takes nothing more. All in the one settle transaction.
create function public.origins_encounter_settle(p_account uuid, p_token text, p_result text, p_ticks int, p_batch jsonb, p_practice jsonb, p_spells jsonb) returns jsonb language plpgsql security definer set search_path = '' as $$
declare out jsonb; line jsonb;
begin
  if jsonb_typeof(p_spells) <> 'array' then raise exception 'spells must be an array' using errcode = 'O0002'; end if;
  if jsonb_array_length(p_spells) > 4 then raise exception 'too many spell lines' using errcode = 'O0002'; end if;
  if jsonb_array_length(p_spells) > 0 and p_result <> 'won' then raise exception 'a spell is taken only on a win' using errcode = 'O0002'; end if;
  out := public.origins_encounter_settle(p_account, p_token, p_result, p_ticks, p_batch, p_practice);
  for line in select * from jsonb_array_elements(p_spells) loop
    if jsonb_typeof(line) <> 'object' or (line->>'legend') is null or (line->>'key') is distinct from 'spell:' || (line->>'legend')
       or jsonb_typeof(line->'bricks') <> 'object' or jsonb_typeof(line->'bricks'->'root') is distinct from 'string' or jsonb_typeof(line->'bricks'->'modifiers') is distinct from 'array'
       or jsonb_typeof(line->'bricks'->'suffix') not in ('string', 'null') or (line->>'legend') !~ '^[a-z][a-z0-9_.:-]{0,63}$'
       or exists (select 1 from jsonb_array_elements(line->'bricks'->'modifiers') b where jsonb_typeof(b) <> 'string') then
      raise exception 'bad spell line' using errcode = 'O0002';
    end if;
    insert into public.origins_grimoire (account, legend, bricks, source_event) values (p_account, line->>'legend', line->'bricks', 'enc:' || p_token) on conflict (account, legend) do nothing;
  end loop;
  return out;
end $$;

-- The account's grimoire: { "<legend>": {bricks} }.
create function public.origins_grimoire_get(p_account uuid) returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.origins_allowed(p_account) then return null; end if;
  return coalesce((select jsonb_object_agg(legend, bricks) from public.origins_grimoire where account = p_account), '{}'::jsonb);
end $$;
revoke all on function public.origins_encounter_settle(uuid, text, text, int, jsonb, jsonb, jsonb), public.origins_grimoire_get(uuid) from public, anon, authenticated;
grant execute on function public.origins_encounter_settle(uuid, text, text, int, jsonb, jsonb, jsonb), public.origins_grimoire_get(uuid) to frankendom_origins, frankendom_verifier;
commit;
