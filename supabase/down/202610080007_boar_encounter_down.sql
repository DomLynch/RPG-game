-- Down for 202610080007_boar_encounter.sql: restore the allowlist of 202610080003 (no 'boar'). Fails, by design, if a fighter_profiles row already names the boar: clear or remap those rows first.
begin;
alter table public.fighter_profiles drop constraint fighter_profiles_encounter_check;
alter table public.fighter_profiles add constraint fighter_profiles_encounter_check
  check (encounter in ('veteran', 'pitborn', 'goblin', 'nightborn', 'executioner', 'minotaur', 'wraith', 'werewolf', 'skeleton', 'dwarf',
                       'plaguedoctor', 'shieldmaiden', 'knight', 'witch', 'wolf'));
commit;
