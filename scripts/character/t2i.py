#!/usr/bin/env python3
"""Text -> image through the official black-forest-labs/FLUX.1-dev Space: a written set design (docs/briefs/armour-sets-direction.md:
references are guides, nothing traced) to the single full-body A-pose source that TRELLIS.2 needs, with the prompt, seed and hash
recorded beside the output (Hero Look pilot, docs/state/herolook.md).

    ~/.venvs/face/bin/python scripts/character/t2i.py --prompt-file docs/character-references/sand-legionary-t2i.txt \
        --out docs/character-references/sand-legionary-source-t1.png [--seed 190926] [--guidance 3.5] [--steps 28] [--size 1024x1024]

Auth: HF_TOKEN env, else the huggingface_hub stored login. Never printed.
"""
import argparse, hashlib, json, os, shutil, sys, time
from pathlib import Path
from gradio_client import Client

ap = argparse.ArgumentParser()
ap.add_argument("--prompt-file", required=True); ap.add_argument("--out", required=True)
ap.add_argument("--space", default="black-forest-labs/FLUX.1-dev"); ap.add_argument("--seed", type=int, default=190926)
ap.add_argument("--guidance", type=float, default=3.5); ap.add_argument("--steps", type=int, default=28); ap.add_argument("--size", default="1024x1024")
a = ap.parse_args()
try:
    from huggingface_hub import get_token
    token = os.environ.get("HF_TOKEN") or get_token()
except Exception:
    token = os.environ.get("HF_TOKEN")
log = lambda m: print(m, file=sys.stderr, flush=True)
prompt = Path(a.prompt_file).read_text().strip(); w, h = (int(x) for x in a.size.split("x"))
log(f"{a.space} as {'signed-in' if token else 'anonymous'}; seed {a.seed}, guidance {a.guidance}, {a.steps} steps, {w}x{h}")
t0 = time.time()
c = Client(a.space, token=token, verbose=False)
r = c.predict(prompt=prompt, seed=a.seed, randomize_seed=False, width=w, height=h, guidance_scale=a.guidance, num_inference_steps=a.steps, api_name="/infer")
path = r[0] if isinstance(r, (list, tuple)) else r
if isinstance(path, dict): path = path["path"]
out = Path(a.out); out.parent.mkdir(parents=True, exist_ok=True); shutil.copy(path, out)
receipt = {"space": a.space, "prompt": prompt, "seed": a.seed, "guidance": a.guidance, "steps": a.steps, "size": a.size,
           "seconds": round(time.time() - t0, 1), "sha256": hashlib.sha256(out.read_bytes()).hexdigest()}
out.with_suffix(".t2i.json").write_text(json.dumps(receipt, indent=2) + "\n")
log(f"DONE {out} in {receipt['seconds']}s")
