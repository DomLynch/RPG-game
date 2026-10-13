# The Origins writer must run the sim the site is about to ship (2026-10-13 DN: the site and verifier moved to 2c5ccfe3a while the writer stayed on DM for 4 minutes,
# replaying DN records on DM's sim). writer_parity_gaps <installed root> reads `<sha256 first 16> <path>` lines (scripts/writer-closure-list.mjs) on stdin and prints every
# path that is missing or differs under the root; no output = the installed writer is byte-identical to the closure at this revision. deploy.sh runs it on the box
# over ssh (declare -f) after the site switch and before the Published line, and refuses to print Published on any output.
writer_parity_gaps() {
  local root="$1" h p got
  cd "$root" 2>/dev/null || { echo "(no writer installed at $root)"; return 0; }
  while read -r h p; do
    got=$({ sha256sum "$p" 2>/dev/null || shasum -a 256 "$p" 2>/dev/null; } | cut -c1-16)
    [ "$got" = "$h" ] || echo "$p"
  done
}

# The box-side command writer_back (deploy.sh) runs when the site switch failed after the writer install: point the writer back at the outgoing install and restart it, but only
# while the site has NOT moved to the new release. An ssh drop after the switch ran leaves the site on $2; rolling the writer back then would put it behind the site.
# writer_back_cmd <outgoing install> <new release dir> [opt root] [site root] [systemd unit] [label]: the writer by default; the presence service passes its own root, unit and label
writer_back_cmd() {
  local prev="$1" rel="$2" opt="${3:-/opt/frankendom-origins}" site="${4:-/var/www/frankendom}" svc="${5:-frankendom-origins-writer}" what="${6:-writer}"
  printf '%s' "if [ \"\$(readlink -f '$site/current')\" = \"\$(readlink -f '$rel')\" ]; then echo '$what NOT rolled back: the site already moved to $rel'; exit 0; fi; [ \"\$(readlink '$opt/current')\" = '$prev' ] || { ln -sfn '$prev' '$opt/current' && systemctl restart $svc && echo '$what put back on $prev'; }"
}
