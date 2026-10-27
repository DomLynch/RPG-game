#!/bin/sh
# Refuses to go on when any .env* file in the given directory (vite's envDir, default .) SETS VITE_UNLISTED_ZONES. The live Origins bundle is built from this checkout; vite's loadEnv reads
# .env, .env.local, .env.production and .env.production.local, so `env -u` on the build line cannot clear a value written in a file. Comments are fine; any assignment or export is not.
dir="${1:-.}"
for f in "$dir"/.env*; do
  [ -f "$f" ] || continue
  if grep -Eq '^[[:space:]]*(export[[:space:]]+)?VITE_UNLISTED_ZONES[[:space:]]*=' "$f"; then
    echo "refusing to build the live Origins bundle: $f sets VITE_UNLISTED_ZONES. That flag opens unlisted (sandbox) zones, and this bundle is the live game (also served at /zone1/). Remove the line; sandbox previews pass the flag on their own build command." >&2
    exit 1
  fi
done
