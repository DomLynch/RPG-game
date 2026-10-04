#!/usr/bin/env python3
"""Legend portraits: one FLUX.1 [dev] text-to-image per legend, on the remote Hugging Face Space (nothing heavy on the Mac), from the
prompt file beside the art direction (docs/character-references/legend-portraits/<opponent>.json: `style` + each legend's `subject`,
drawn from src/legends.ts's public-domain source, never a film or comic). Writes <out>/<opponent>-<tier>.png at the Space's size and a
512x512 WebP beside it, plus <opponent>.run.json with seed, prompt and hashes.

    uv run --with pillow --with gradio_client scripts/character/legend_portraits.py --opponent goblin \
        --out artifacts/character/legends [--tiers 1,2] [--size 768] [--local madroid/flux.1-dev-mflux-4bit]

Auth: HF_TOKEN env (kontext.py's rule). Never printed.
"""
import argparse, hashlib, json, os, shutil, subprocess, sys, time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--opponent", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--tiers", default="")
    ap.add_argument("--size", type=int, default=768)
    ap.add_argument("--space", default="black-forest-labs/FLUX.1-dev")
    ap.add_argument("--local", default="", help="mflux weights repo (e.g. madroid/flux.1-dev-mflux-4bit): generate on this Mac, no Space")
    a = ap.parse_args()
    from PIL import Image

    spec = json.loads((ROOT / "docs/character-references/legend-portraits" / f"{a.opponent}.json").read_text())
    tiers = {int(t) for t in a.tiers.split(",") if t}
    out = Path(a.out); out.mkdir(parents=True, exist_ok=True)
    log_path = out / f"{a.opponent}.run.json"
    log = json.loads(log_path.read_text()) if log_path.exists() else {}
    if not a.local:
        from gradio_client import Client
        client = Client(a.space, token=os.environ.get("HF_TOKEN"), verbose=False)
    for legend in spec["legends"]:
        if tiers and legend["tier"] not in tiers:
            continue
        prompt = f"{spec.get('framing', '')} {legend['subject']} {spec['style']}".strip()
        t0 = time.time()
        # ONE call per legend, no retry: a failed or timed-out call raises and ends the run (Strategy, 2026-09-27).
        if a.local:  # mflux on Apple silicon; a non-zero exit raises and ends the run
            path, seed = out / f"{a.opponent}-{legend['tier']}.raw.png", legend["seed"]
            subprocess.run(["nice", "-n", "19", "uvx", "--from", "mflux==0.20.0", "mflux-generate", "--model", a.local, "--base-model", "dev",
                            "--prompt", prompt, "--seed", str(seed), "--steps", "28", "--guidance", "3.5", "--width", str(a.size),
                            "--height", str(a.size), "--output", str(path)], check=True)
        else:
            extra = {} if "schnell" in a.space else {"guidance_scale": 3.5}
            result, seed = client.predict(prompt=prompt, seed=legend["seed"], randomize_seed=False, width=a.size, height=a.size,
                                          num_inference_steps=4 if "schnell" in a.space else 28, api_name="/infer", **extra)
            path = result.get("path") if isinstance(result, dict) else result
        png = out / f"{a.opponent}-{legend['tier']}.png"
        Image.open(path).convert("RGB").save(png)
        web = out / f"{a.opponent}-{legend['tier']}.webp"
        Image.open(png).resize((512, 512), Image.LANCZOS).save(web, quality=86, method=6)
        log[str(legend["tier"])] = {"name": legend["name"], "seed": int(seed), "size": a.size, "space": a.local or a.space, "prompt": prompt,
                                    "sha256": hashlib.sha256(web.read_bytes()).hexdigest(), "seconds": round(time.time() - t0, 1)}
        log_path.write_text(json.dumps(log, indent=2) + "\n")
        print(f"{legend['tier']:>2} {legend['name']}: {time.time() - t0:.0f}s", flush=True)


if __name__ == "__main__":
    sys.exit(main())
