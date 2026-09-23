-- Extend the existing encounter allowlist for the four launch characters moved to beta (owner 2026-09-23, via Lead): the Plague
-- Doctor, the Shieldmaiden, the Knight and the Witch. One file so Deploy applies ONE migration at the roster-v0 publish. Ids are
-- lowercase with no separator, matching loot_claims.opponent ^[a-z]{1,32}$. Ownership, RLS and revision guards stay intact.
begin;
alter table public.fighter_profiles drop constraint fighter_profiles_encounter_check;
alter table public.fighter_profiles add constraint fighter_profiles_encounter_check
  check (encounter in ('veteran', 'pitborn', 'goblin', 'nightborn', 'executioner', 'minotaur', 'wraith', 'werewolf', 'skeleton', 'dwarf',
                       'plaguedoctor', 'shieldmaiden', 'knight', 'witch'));
commit;
