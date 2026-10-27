# Standing HF CPU boxes (`hfjob --box`)

Dom, 2026-10-27: "max it out". HF Jobs only start about 2 at once on our account; the rest sit in SCHEDULING. A **box** is a private Docker Space on `cpu-upgrade` (8 vCPU, 32 GB, $0.03/h) per heavy lane, with its own quota. The Hub puts it to sleep after 15 idle minutes, so it costs nothing while nobody uses it.

## Use it

```bash
hfjob --box v3 -- npm test                 # fire and forget: prints tier=hf-box ..., the cron poller records its end
hfjob --box physics --wait -- npm run build  # stream the log, exit code follows the job
hfjob box-logs v3 <job-id> [--follow]
hfjob boxes                                # stage, sleep time and $/day for every box
hfjob box-pause v3                         # pause now (the kill switch by hand)
```

**Front door stays `lanejob`** (Mac → VPS slot while load1 < the gate → Hugging Face only as the spill). The spill is `hfjob --spill`: if the repo has a box (`repos` in the data row) and `jobsConcurrent` (2) HF Jobs are already active, so a Job would queue, it runs on the box; otherwise it submits a Job. Both print `tier=...` (`hf-box` or `hf-cpu`), so the log says which ran. `hfjob --box` direct use is for a lane that knows it wants the box.

Run it from a checkout of the repo whose code you want to run; HEAD must be pushed (the box clones origin at that sha, public repos only, `npm ci` when there is a lockfile). Boxes: `v3`, `physics`, `armagedom`, `opentrident`, `v1`. Plain `hfjob -- <cmd>` (a Job) still exists for fire-and-forget with no box. Pass the command unquoted after `--`: `-- "node --test a b"` is run as one filename and exits 127 (ARMAGEDOM, 2026-10-27).

## Add a box for a new lane (one line)

Add `"<name>": { "lane": "<who>" }` under `boxes` in `data/hf-boxes.json`, merge, then `hfjob box-up <name>` (creates `Domlynch/box-<name>`, uploads the runner, sets the sleep time, prints the receipt).

## Kill switch and cost

- Every Space is created with `sleep_time = sleepMinutes * 60` (row `sleepMinutes`, 15) and `box-up` re-reads the runtime from the Hub and fails loudly if it is not set.
- A box is billed only while awake: $0.72/day each if it never slept, $3.60/day for all five. `hfjob boxes` shows what is awake now.
- **Job record:** a fire-and-forget `hfjob --box` appends the job to `/var/lib/hfjob/open-jobs.jsonl` (row `openJobsFile`). A root cron entry (`/etc/cron.d/hfjob-box-tick`, written by `install-vps.sh`) runs `hfjob box-tick` every minute: it polls each recorded job (those requests also keep the box awake past the 15 min idle timer), and when a job ends writes `tier=hf-box box= job= ended=done|failed|timeout|unknown reason=...` to `/var/log/hfjob.log` and drops it from the record. unknown = the box lost the job (404), stopped answering (`watchMaxMisses`), or timeout + `watchMarginSeconds` passed. The box runs the command to completion by itself; the poller only reads, so a closed terminal or a reboot loses nothing. The cron file is owned and rewritten only by `install-vps.sh`; to remove it: `rm /etc/cron.d/hfjob-box-tick` (as root; the next install brings it back, so drop the `cronFile` row to stop that). Jobs started on a machine without that cron (a Mac) are not recorded: use `--wait` there.
- The Space filesystem is wiped on sleep: nothing on a box is durable. Logs live in the runner for the life of the awake box.

## How it works

`scripts/hfjob/boxes.py` talks to the Hub (`huggingface_hub`) and to the runner (`scripts/hfjob/box/runner.mjs`, baked into the Space with `inner.sh`, the same clone + `npm ci` + exec body Jobs use). The private Space is reachable only with the owner's token as a bearer header; the runner has no auth of its own and never sees a token. It accepts only `https://github.com/<owner>/<name>.git` repos and 40-hex shas. The token is read inside the script from `/root/.hf/token` (or `HF_TOKEN`), never printed, never on a command line. All names, flavor, sleep time and prices are in `data/hf-boxes.json`; `tests/hf-boxes.test.ts` fails if code names a repo or a flavor.

**Boxes bake in the runner and `inner.sh` (the clone step) when they are built, so `install-vps.sh` does NOT update them: after any install that changes `scripts/hfjob/box/*` or `scripts/hfjob/inner.sh`, rebuild every box with `for b in v3 physics armagedom v1; do hfjob box-up $b --update; done` (check `/var/lib/hfjob/open-jobs.jsonl` is empty first).** `hfjob box-up <name> --update` re-uploads them (the Space rebuilds and drops running jobs). Last rebuilt for the tags fix: 2026-10-27. Never touch `Domlynch/char-tool-stage` (the Blender dataset).

## Clone depth

The sha is fetched at `HFJOB_DEPTH` (default 1) and the repo's tags are fetched too (shallow), so tests that read `git show <tag>:file` work (V3's Gate 0 seed tag). Jobs and boxes share `inner.sh`, so both get it. History other than the sha and the tagged commits is not there: set `HFJOB_DEPTH=0` for full history.

## Limits

Public GitHub repos only: the box clones without a credential. `DomLynch/opentrident-steam` is private, so `box-opentrident` has no `repos` (the spill never routes there) and stays paused: Strategy ruled 2026-10-27 the repo stays private (third-party assets) and boxes get no GitHub token. OpenTrident's heavy work goes through the `Domlynch/char-tool-stage` Space with files pushed in.

The box runs as an unprivileged user (no `apt`, no Playwright browsers). Browser rows go to CI or the VPS. Concurrent jobs on one box share its 8 vCPUs.
