// Start-up flag rules for the per-layer spawn features, one pure function so the writer script and a test read the same rule.
// ORIGINS_SPAWN_LAYERS needs the presence key (without it no layer is known and every account reads layer 1). ORIGINS_DYNAMIC_RESPAWN needs the layers flag, the key AND ORIGINS_DAMAGE_SHARE: the dynamic respawn_s
// is the same p_respawn_s the SQL kill functions use for the cross-layer hop window, so a shortened respawn would shorten that window too; with damage share on, the pre-check (spawnCheck with the ROW's respawnS,
// origins_spawn_check_layer) holds the row window before the kill, and without it nothing does (Auditor NOT YET @506b606dc, #3328).
export function spawnFlagError(env: Record<string, string | undefined>, presenceKey: string | undefined): string | null {
  const layers = env.ORIGINS_SPAWN_LAYERS === '1', dynamic = env.ORIGINS_DYNAMIC_RESPAWN === '1', share = env.ORIGINS_DAMAGE_SHARE === '1';
  if (layers && !presenceKey) return 'ORIGINS_SPAWN_LAYERS=1 needs PRESENCE_INTERNAL_KEY';
  if (dynamic && !(layers && presenceKey)) return 'ORIGINS_DYNAMIC_RESPAWN=1 needs ORIGINS_SPAWN_LAYERS=1 and PRESENCE_INTERNAL_KEY';
  if (dynamic && !share) return 'ORIGINS_DYNAMIC_RESPAWN=1 needs ORIGINS_DAMAGE_SHARE=1 (its pre-check holds the cross-layer hop window at the row respawn)';
  return null;
}
