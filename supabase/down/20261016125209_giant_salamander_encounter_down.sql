-- Down for 20261016130000_giant_salamander_encounter.sql: restore the allowlist of 20261016120000 (no 'giant-salamander'). Fails, by design, if a fighter_profiles row already names the salamander: clear or remap those rows first.
begin;
alter table public.fighter_profiles drop constraint fighter_profiles_encounter_check;
alter table public.fighter_profiles add constraint fighter_profiles_encounter_check
  check (encounter in ('veteran', 'pitborn', 'goblin', 'nightborn', 'executioner', 'minotaur', 'wraith', 'werewolf', 'skeleton', 'dwarf',
                       'plaguedoctor', 'shieldmaiden', 'knight', 'witch', 'wolf', 'boar', 'bear', 'cave-troll'));
commit;
