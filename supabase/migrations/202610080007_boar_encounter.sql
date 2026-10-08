-- Extend the encounter allowlist for the Tusked Boar (Combat, 2026-10-08, Dom: a boar in Zone 1): a held roster row (off the ladder, reached by a world mob row), so the
-- fighter_profiles encounter column must accept its id like every other roster key. Same list as 202610080003 plus 'boar'; ownership, RLS and revision guards stay intact.
begin;
alter table public.fighter_profiles drop constraint fighter_profiles_encounter_check;
alter table public.fighter_profiles add constraint fighter_profiles_encounter_check
  check (encounter in ('veteran', 'pitborn', 'goblin', 'nightborn', 'executioner', 'minotaur', 'wraith', 'werewolf', 'skeleton', 'dwarf',
                       'plaguedoctor', 'shieldmaiden', 'knight', 'witch', 'wolf', 'boar'));
commit;
