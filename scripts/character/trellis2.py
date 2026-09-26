#!/usr/bin/env python3
"""Image -> GLB through the official microsoft/TRELLIS.2 Space API (same settings as the shipped creatures).

    ~/.venvs/face/bin/python scripts/character/trellis2.py --image docs/character-references/dwarf-source-v1.png \
        --name dwarf [--seed 190926] [--resolution 1024] [--faces 100000] [--texture 2048]

Runs start_session -> preprocess_image -> image_to_3d -> extract_glb in one session and writes
src/assets/source/creatures/<name>.glb plus <name>.trellis.json (parameters, timings, SHA-256).
Auth: HF_TOKEN env or the huggingface_hub stored login (`hf auth login`) supplies the ZeroGPU quota;
the token is never printed. Bounded retries on quota/sleeping-space errors; no purchases.
"""
import argparse, hashlib, json, os, re, shutil, sys, time
from pathlib import Path
from gradio_client import Client, handle_file

ap = argparse.ArgumentParser()
ap.add_argument("--image", required=True); ap.add_argument("--name", required=True)
ap.add_argument("--space", default="microsoft/TRELLIS.2"); ap.add_argument("--seed", type=int, default=190926)
ap.add_argument("--resolution", default="1024"); ap.add_argument("--faces", type=int, default=100000)
ap.add_argument("--texture", type=int, default=2048); ap.add_argument("--timeout-minutes", type=float, default=30)
ap.add_argument("--also-faces", type=int, nargs="*", default=[])   # extra extractions from the SAME latent (<name>-f<N>.glb): the fit input under a max generation
ap.add_argument("--steps", type=int, default=12)   # sampling steps for all three stages (the Space's default 12, max 50)
a = ap.parse_args()
try:
    from huggingface_hub import get_token
    token = os.environ.get("HF_TOKEN") or get_token()
except Exception:
    token = os.environ.get("HF_TOKEN")
log = lambda m: print(m, file=sys.stderr, flush=True)
log(f"auth: {'token present' if token else 'anonymous'}")
out = Path("src/assets/source/creatures"); out.mkdir(parents=True, exist_ok=True)
deadline = time.time() + a.timeout_minutes * 60
attempt, receipt = 0, {"space": a.space, "seed": a.seed, "resolution": a.resolution, "faces": a.faces, "texture": a.texture, "steps": a.steps, "image": a.image}
while True:
    attempt += 1; t0 = time.time()
    try:
        c = Client(a.space, token=token, verbose=False)
        c.predict(api_name="/start_session")
        pre = c.predict(input=handle_file(a.image), api_name="/preprocess_image"); receipt["preprocess_s"] = round(time.time() - t0, 1)
        t1 = time.time()
        c.predict(image=handle_file(pre["path"] if isinstance(pre, dict) else pre), seed=a.seed, resolution=a.resolution,
                  ss_sampling_steps=a.steps, shape_slat_sampling_steps=a.steps, tex_slat_sampling_steps=a.steps, api_name="/image_to_3d")
        receipt["image_to_3d_s"] = round(time.time() - t1, 1); t2 = time.time()
        glb = c.predict(decimation_target=a.faces, texture_size=a.texture, api_name="/extract_glb")
        receipt["extract_glb_s"] = round(time.time() - t2, 1)
        also = [(f, c.predict(decimation_target=f, texture_size=a.texture, api_name="/extract_glb")) for f in a.also_faces]
        break
    except Exception as exc:
        msg = str(exc); remaining = deadline - time.time()
        m = re.search(r"(\d+):(\d+):(\d+)", msg); wait = (int(m[1]) * 3600 + int(m[2]) * 60 + int(m[3])) if m else 60
        if remaining <= 0 or "exceeded" in msg and wait > remaining: log(f"FAILED after {attempt} attempts: {msg[:300]}"); sys.exit(1)
        log(f"attempt {attempt} failed: {msg[:200]} -> retry in {min(wait, remaining):.0f}s"); time.sleep(min(wait, remaining))
path = glb[1] if isinstance(glb, (list, tuple)) else glb
if isinstance(path, dict): path = path["path"]
dest = out / f"{a.name}.glb"; shutil.copy(path, dest)
receipt.update(glb=str(dest), bytes=dest.stat().st_size, sha256=hashlib.sha256(dest.read_bytes()).hexdigest(), attempts=attempt)
(out / f"{a.name}.trellis.json").write_text(json.dumps(receipt, indent=2) + "\n")
for f, g in also:
    q = g[1] if isinstance(g, (list, tuple)) else g; q = q["path"] if isinstance(q, dict) else q
    d = out / f"{a.name}-f{f // 1000}k.glb"; shutil.copy(q, d)
    receipt.setdefault("also", []).append({"faces": f, "glb": str(d), "bytes": d.stat().st_size, "sha256": hashlib.sha256(d.read_bytes()).hexdigest()})
(out / f"{a.name}.trellis.json").write_text(json.dumps(receipt, indent=2) + "\n")
print(json.dumps(receipt))
