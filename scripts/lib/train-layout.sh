# The release train's checkouts under launchd (Lead 2026-10-12: the first launchd tick failed with "fatal: not a git repository:
# …/Desktop/…/.git/worktrees/frankendom-train"). macOS TCC keeps a launchd job out of ~/Desktop, ~/Documents and ~/Downloads, and a worktree's
# objects live in its main repo's .git. Ruling: no Full Disk Access; everything the job touches is a standalone clone outside those folders
# (scripts/release-train-setup.sh makes it) or a worktree of that clone. Sourced by scripts/release-train-publish.sh and the setup.
# Reads the .git file directly, never runs git: under launchd git itself is what fails.
train_protected() {   # $1 = absolute path: under a folder TCC keeps launchd out of
  local d
  for d in Desktop Documents Downloads; do case "$1/" in "$HOME/$d/"*) echo "$d"; return 0 ;; esac; done
  return 1
}
train_checkout_ok() {   # $1 = checkout dir; prints why and returns 1 when a launchd job could not use it. An absent dir is fine (created later).
  local dir="$1" gitdir prot
  [ -e "$dir" ] || return 0
  if prot=$(train_protected "$dir"); then echo "$dir: under ~/$prot, which launchd cannot read (macOS TCC); run scripts/release-train-setup.sh"; return 1; fi
  [ -f "$dir/.git" ] || return 0   # a standalone clone: .git is a directory beside it
  gitdir=$(sed -n 's/^gitdir: //p' "$dir/.git" | head -n 1)
  case "$gitdir" in /*) ;; *) gitdir="$dir/$gitdir" ;; esac
  if prot=$(train_protected "$gitdir"); then
    echo "$dir: a worktree of a repo under ~/$prot ($gitdir), which launchd cannot read (macOS TCC); make it a standalone clone: scripts/release-train-setup.sh"
    return 1
  fi
  return 0
}
