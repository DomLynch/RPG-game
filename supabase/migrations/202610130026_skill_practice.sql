begin;
-- ROLLBACK: supabase/down/202610130026_skill_practice_down.sql (drops exactly what this file creates; the 5-arg origins_encounter_settle is untouched and stays the inner call).
-- CLASS 1, ADDITIVE and Origins-only: the skills-by-use pool (programme row 11: "points raise the ceiling, practice fills it"). origins_skill_xp holds the practice a character has banked per
-- skill (xp, capped by the writer at the ceiling its placed points set) and the focus flag (practice doubles on a focused skill). origins_skill_practice is the idempotency ledger: one row per
-- key `practice:<event_id>:<skill>`, so a retried settle pays once.
-- The ONLY writer is origins_encounter_settle (below), from a fight the writer VERIFIED as a win. origins_spawn_kill allows only the batch ops event/mint/metal/career_set, so kill_report cannot reach this pool.
-- RLS on, no policy, no client grant.
create table public.origins_skill_xp (
  character text not null references public.origins_characters (id) on delete cascade,
  skill text not null check (skill ~ '^[a-z][a-z0-9_]{0,31}$'),
  xp int not null default 0 check (xp >= 0),
  focus boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (character, skill)
);
create table public.origins_skill_practice (
  key text primary key check (key ~ '^practice:'),
  character text not null references public.origins_characters (id) on delete cascade,
  skill text not null,
  amount int not null check (amount >= 0),
  paid int not null check (paid >= 0),
  created_at timestamptz not null default now()
);
alter table public.origins_skill_xp enable row level security;
alter table public.origins_skill_practice enable row level security;
revoke all on public.origins_skill_xp, public.origins_skill_practice from public, anon, authenticated;
grant select on public.origins_skill_xp, public.origins_skill_practice to frankendom_origins, frankendom_verifier;

-- The settle, now with the fight's practice lines. p_practice is [{skill, amount, capXp, key}] for the run's own character; the writer computes them from the verified record only on a win
-- (grey targets pay 0; capXp is the ceiling the placed points set). Each line pays at most min(amount x (2 if the skill is focused), capXp - banked), once per key. The same transaction as the token, the run and the batch.
create function public.origins_encounter_settle(p_account uuid, p_token text, p_result text, p_ticks int, p_batch jsonb, p_practice jsonb) returns jsonb language plpgsql security definer set search_path = '' as $$
declare out jsonb; ch text; line jsonb; got int; have int; foc boolean; pay int;
begin
  if jsonb_typeof(p_practice) <> 'array' then raise exception 'practice must be an array' using errcode = 'O0002'; end if;
  if jsonb_array_length(p_practice) > 0 and p_result <> 'won' then raise exception 'practice is paid only on a win' using errcode = 'O0002'; end if;
  select e.character into ch from public.origins_encounters e where e.token = p_token and e.account = p_account;
  out := public.origins_encounter_settle(p_account, p_token, p_result, p_ticks, p_batch);
  for line in select * from jsonb_array_elements(p_practice) loop
    if ch is null or jsonb_typeof(line) <> 'object' or (line->>'key') is null or (line->>'key') <> 'practice:enc:' || p_token || ':' || (line->>'skill')
       or (line->>'amount') !~ '^[0-9]{1,6}$' or (line->>'capXp') !~ '^[0-9]{1,6}$' then
      raise exception 'bad practice line' using errcode = 'O0002';
    end if;
    insert into public.origins_skill_practice (key, character, skill, amount, paid) values (line->>'key', ch, line->>'skill', (line->>'amount')::int, 0) on conflict (key) do nothing;
    get diagnostics got = row_count;
    if got = 1 then
      -- Lock the character's xp row (created empty if new) BEFORE reading the banked amount: two fights settling at once queue here, so the second reads the first's xp and the ceiling holds.
      insert into public.origins_skill_xp (character, skill, xp) values (ch, line->>'skill', 0) on conflict (character, skill) do nothing;
      select xp, focus into have, foc from public.origins_skill_xp where character = ch and skill = line->>'skill' for update;
      pay := greatest(least((line->>'amount')::int * case when foc then 2 else 1 end, (line->>'capXp')::int - have), 0);
      update public.origins_skill_xp set xp = xp + pay, updated_at = now() where character = ch and skill = line->>'skill';
      update public.origins_skill_practice set paid = pay where key = line->>'key';
    end if;
  end loop;
  return out;
end $$;
revoke all on function public.origins_encounter_settle(uuid, text, text, int, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.origins_encounter_settle(uuid, text, text, int, jsonb, jsonb) to frankendom_origins, frankendom_verifier;
commit;
