#!/usr/bin/env python3
"""Image edit through the official black-forest-labs/FLUX.1-Kontext-Dev Space: a fighter's approved portrait → the single
full-body A-pose reconstruction source that TRELLIS.2 needs (the Executioner's source was made this way by hand on
2026-09-20; this is that step as one command, with the prompt, seed and hash recorded beside the output).

    ~/.venvs/face/bin/python scripts/character/kontext.py --image artifacts/source/face/veteran/front.png \
        --prompt-file docs/character-references/veteran-kontext.txt --out docs/character-references/veteran-source-v1.png \
        [--seed 190926] [--guidance 2.5] [--steps 28]

Auth: HF_TOKEN env, else .env.hf.local in the repo root, else the huggingface_hub stored login. Never printed.
"""
import argparse
import hashlib
import json
import os
import shutil
import sys
import time
from pathlib import Path


def token():
    if os.environ.get("HF_TOKEN"):
        return os.environ["HF_TOKEN"]
    env = Path(__file__).resolve().parents[2] / ".env.hf.local"
    if env.exists():
        for line in env.read_text().splitlines():
            line = line.strip().removeprefix("export ").strip()
            if line.startswith("HF_TOKEN="):
                return line.split("=", 1)[1].strip().strip('"').strip("'")
    try:
        from huggingface_hub import get_token
        return get_token()
    except Exception:
        return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--image", required=True)
    ap.add_argument("--prompt-file", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--seed", type=int, default=190926)
    ap.add_argument("--guidance", type=float, default=2.5)
    ap.add_argument("--steps", type=int, default=28)
    ap.add_argument("--space", default="black-forest-labs/FLUX.1-Kontext-Dev")
    a = ap.parse_args()
    from gradio_client import Client, handle_file

    prompt = Path(a.prompt_file).read_text().strip()
    tok = token()
    print(f"{a.space} as {'signed-in' if tok else 'anonymous'}; seed {a.seed}, guidance {a.guidance}, {a.steps} steps", file=sys.stderr, flush=True)
    client = Client(a.space, token=tok, verbose=False)
    t0 = time.time()
    result = client.predict(input_image=handle_file(a.image), prompt=prompt, seed=a.seed, randomize_seed=False,
                            guidance_scale=a.guidance, steps=a.steps, api_name="/infer")
    path = result[0] if isinstance(result, (list, tuple)) else result
    path = path.get("path") if isinstance(path, dict) else path
    out = Path(a.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(path, out)
    record = {"space": a.space, "source_image": a.image, "source_sha256": hashlib.sha256(Path(a.image).read_bytes()).hexdigest(),
              "prompt": prompt, "seed": a.seed, "guidance": a.guidance, "steps": a.steps,
              "seconds": round(time.time() - t0, 1), "sha256": hashlib.sha256(out.read_bytes()).hexdigest()}
    out.with_suffix(".kontext.json").write_text(json.dumps(record, indent=1) + "\n")
    print(f"DONE {out} in {record['seconds']}s", file=sys.stderr, flush=True)


if __name__ == "__main__":
    sys.exit(main())
