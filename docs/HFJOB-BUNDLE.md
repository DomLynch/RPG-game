# hfjob --bundle: private checkouts on Hugging Face CPU

```
hfjob --bundle [--include PATH]... [--exclude GLOB]... [--max-mb N] [--out DIR]... [--timeout 30m] [--flavor cpu-upgrade] -- CMD...
hfjob --batch FILE
hfjob collect JOB_ID [--out DIR] [--wait SECS]
hfjob collect --all-from FILE_OR_IDS [--out DIR] [--wait SECS]
```

- Bundle = `git ls-files -co --exclude-standard` of the current checkout plus each `--include` path (relative, inside the checkout). No git remote or pushed HEAD needed.
- Always excluded: `.git`, `node_modules`, `.env*`, `*.pem`, `*.key`, `id_*`, `credentials*`, `secrets*`, `.npmrc`, `.netrc`, token files, `hfjob-out`. Symlinks leaving the checkout are dropped.
- Refused (exit 2, nothing leaves the machine): content matching HF/GitHub/`sk-`/AWS/Slack tokens or a private-key header; over `--max-mb` (default 500; the 10 largest entries are listed).
- Transport: the tarball goes (Mac: over ssh; VPS: direct) to the PRIVATE dataset `<owner>/hfjob-bundles` (owner from `data/hf-boxes.json`; created private if missing; refused if public) as `bundles/<uuid>.tar.gz`. The VPS re-scans anything the Mac sends.
- The job gets the HF token as a job secret (`--secrets HF_TOKEN`, by name; never argv, never `-e`, never logged). It downloads and DELETES the bundle, extracts to `/w`, runs `npm ci` when there is a lockfile, installs `blender` (apt, 4.0.x) when CMD mentions it, runs CMD, then uploads `results/<JOB_ID>.tar.gz` holding `hfjob-out/` (incl. `.exit`) and each `--out` dir.
- `collect` downloads, extracts safely (no links, devices or `..`), then deletes the remote result. `--wait` polls until the job ends.
- `--batch`: one `hfjob` argument list per non-comment line, run concurrently (HFJOB_BATCH_JOBS, default 8), one `tier=hf-cpu job=<id> ...` line each, in order. Exit 1 if any line failed.
- Ledger line gains ` bundle=<uuid> files=N mb=X`. Env: HFJOB_DRY=1 packs, scans and prints the hf command, uploads nothing; HFJOB_BUNDLE_REPO overrides the dataset.
- Mac: install `scripts/hfjob/hfjob-mac.sh` as `~/.local/bin/hfjob` and `bundle.py` as `~/.local/bin/hfjob-bundle.py`.
