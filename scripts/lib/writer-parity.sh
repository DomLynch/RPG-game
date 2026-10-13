# The Origins writer must run the sim the site is about to ship (2026-10-13 DN: the site and verifier moved to 2c5ccfe3a while the writer stayed on DM for 4 minutes,
# replaying DN records on DM's sim). writer_parity_gaps <installed root> reads `<sha256 first 16> <path>` lines (scripts/writer-closure-list.mjs) on stdin and prints every
# path that is missing or differs under the root; no output = the installed writer is byte-identical to the closure at this revision. deploy.sh runs it on the box
# over ssh (declare -f) before the publish lock and refuses to publish on any output.
writer_parity_gaps() {
  local root="$1" h p got
  cd "$root" 2>/dev/null || { echo "(no writer installed at $root)"; return 0; }
  while read -r h p; do
    got=$({ sha256sum "$p" 2>/dev/null || shasum -a 256 "$p" 2>/dev/null; } | cut -c1-16)
    [ "$got" = "$h" ] || echo "$p"
  done
}
