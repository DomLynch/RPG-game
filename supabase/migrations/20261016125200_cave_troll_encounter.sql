-- Extend the encounter allowlist for the Cave Troll (Combat, 2026-10-16, Dom: the Zone 1 boss): a held roster row (off the ladder, reached by a world camp-boss row), so the
-- fighter_profiles encounter column must accept its id like every other roster key. Same list as 202610080008 plus 'cave-troll'; ownership, RLS and revision guards stay intact.
begin;
alter table public.fighter_profiles drop constraint fighter_profiles_encounter_check;
alter table public.fighter_profiles add constraint fighter_profiles_encounter_check
  check (encounter in ('veteran', 'pitborn', 'goblin', 'nightborn', 'executioner', 'minotaur', 'wraith', 'werewolf', 'skeleton', 'dwarf',
                       'plaguedoctor', 'shieldmaiden', 'knight', 'witch', 'wolf', 'boar', 'bear', 'cave-troll'));
commit;
