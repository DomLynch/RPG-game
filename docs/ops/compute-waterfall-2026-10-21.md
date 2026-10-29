# Compute and storage waterfall (Dom, 2026-10-21)

Dom's rulings on 2026-10-21 (10:5x to 11:5x, via Strategy). Every lane reads this before starting a heavy job or deciding where data lives. It refines the 2026-10-17 GPU waterfall and the 2026-10-04 VPS rule; it does not replace them.

## Where compute runs

1. **Mac (M5, real GPU) first** for real-GPU work: WebGL rows, stills, clips, crowd A/Bs, frame traces. One heavy job at a time; check the load first; **nothing heavy while a publish is in flight** (`~/.claude/state/deploy_hold` present).
2. **VPS (49.12.7.18)** for CPU work: suites, builds, headless rows, the verifier, Backend jobs. One clone per job; job scratch on the 200 GB volume `/mnt/HC_Volume_107195252`.
3. **Hugging Face Jobs, submitted FROM THE VPS** (token at `/root/.hf/token`, read only inside the job script; the Mac is never a transfer relay):
   - **CPU upgrade, $0.03/h (8 vCPU, 32 GB, 50 GB disk): the default spill** whenever the VPS is over load 12 or queued (never wait more than 5 minutes). **Run several in parallel**: this is the "second VPS", role-split for free. Dom skipped buying a second box on 2026-10-21.
   - **T4 small, $0.40/h (16 GB GPU, 15 GB RAM, 50 GB disk) is the GPU default** (Dom, 2026-10-21 ~12:00: "let's use the 40 cents GPU, we don't need the 60 cents"; "T4 small, we should use wherever possible"): one final GPU proof per PR, or when the Mac genuinely cannot (stutter or load, figure in the receipt). **T4 medium, $0.60/h (30 GB RAM, 100 GB disk) only when T4 small does not work or is at capacity** (Dom, 12:2x: "only when the T4 small doesn't work or it's at capacity, then you can move to the T4 medium; that saves us 20-30%"): the receipt states which it was: a measured failure on small (RAM above 15 GB, disk above 50 GB, out-of-memory), or a small job that would not start within 10 minutes. The Auditor checks the flavor and the reason in receipts.
   - **L4, $0.80/h (24 GB GPU, 400 GB disk)**: only when a job needs more than 50 GB of scratch (a whole game install at once) or more than 16 GB of GPU memory (FLUX / TRELLIS fit better here than on a T4).
   - **A10G, L40S, A100 and above: only on Dom's word, per job.**
   - **GPU spend stop: $15 per day across all GPU tiers** (the old $15 T4 stop, widened). CPU-upgrade jobs are not capped but every job carries its id and cost line in the receipt.

| Tier | CPU / RAM | GPU | Disk | $/h |
|---|---|---|---|---|
| CPU upgrade | 8 vCPU / 32 GB | none | 50 GB | 0.03 |
| T4 small (GPU default) | 4 / 15 GB | 16 GB | 50 GB | 0.40 |
| T4 medium (stated reason only) | 8 / 30 GB | 16 GB | 100 GB | 0.60 |
| L4 | 8 / 30 GB | 24 GB | 400 GB | 0.80 |
| A10G small | 4 / 15 GB | 24 GB | 110 GB | 1.00 |
| L40S | 8 / 62 GB | 48 GB | 380 GB | 1.80 |
| A100 | 12 / 142 GB | 80 GB | 1 TB | 2.50 |

(Hugging Face price table as read on 2026-10-21; re-check before quoting.)

## Where data lives

- **Hugging Face private repos are the first archive tier for extracted reference data.** The Pro plan includes 1 TB of private storage (pay-as-you-go $18/TB/month above). The Steam dev uploads every extract there; that is its home. Extracted assets are reference only: never in a game repo, build or site (the opentrident viewer models Dom approved are the one exception).
- **The VPS keeps only what a running job reads.** Job outputs are removed by their owner with `vps-scratch-sweep --path=<exact> --apply` once uploaded or once the PR carries the receipt; never by hand, never by age. Volume alarm at 80%, cut refused at 90%.
- **The 5 TB storage box (sshfs, `/mnt/frankendom-donors`, `/mnt/armagedom-backups`) is for the game's own job outputs, archives and backups**, and the sweep's archive-first destination.
- **Job disk is a separate limit from repo storage.** The 50 GB on the CPU-upgrade tier is the job's scratch; a job pulls what it needs from the repo and pushes results back.
- **The Mac data volume**: lane worktrees only (one side worktree per lane, removed with its PR); `~/Developer/.ms-playwright` and `~/Library/Caches/ms-playwright` are never-touch; the cut refuses under 20 GiB free.

## Transfers

Box to Hugging Face, box to storage box, Hugging Face to box: **direct, never via the Mac** (parallel transfers through the Mac broke its sshd on 2026-10-21 and capped uploads at 13 MB/s; direct uploads run 75-120 MB/s). The Mac receives a file only when a Mac-only row (WebKit, real iPhone) needs it.

## Exceptions on record

- The release train's T4 wall rows (5, 7, 16, 21, 28, 34, 36) still launch from the Mac at candidate open until Deploy's PR moves submit and receipt read to the VPS.

Owner of this note: Strategy. Changes come as a PR with "Dom:" and the date in the line.
