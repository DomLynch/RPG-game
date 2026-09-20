"""Image → 3D through the official Microsoft TRELLIS.2 Space (Gradio), the way the creature reconstructions were made by
hand on 2026-09-19 (seed 190926, resolution 1024, decimation 100000, texture 2048).

    python scripts/character/trellis.py <image.png> <out.glb> [--seed N] [--resolution 512|1024|1536]
                                          [--faces 100000] [--texture 2048] [--space microsoft/TRELLIS.2]

Auth: HF_TOKEN in the environment, else `.env.hf.local` (git-ignored, `HF_TOKEN=…`) in the repo root, else anonymous.
A signed-in PRO account gets the larger ZeroGPU quota; anonymous calls may be refused once the daily quota is spent.
The image should be a single subject on a plain background (the Space removes the background itself) — an A-pose front
view for a body, a portrait for a head. Nothing is written until the GLB has been downloaded. Licence: TRELLIS.2 (see
src/assets/source/creatures/TRELLIS-LICENSE.txt); record every source image and seed beside the output.
"""

import argparse
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
    return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("image")
    ap.add_argument("out")
    ap.add_argument("--seed", type=int, default=190926)
    ap.add_argument("--resolution", default="1024", choices=["512", "1024", "1536"])
    ap.add_argument("--faces", type=int, default=100000)
    ap.add_argument("--texture", type=int, default=2048)
    ap.add_argument("--space", default="microsoft/TRELLIS.2")
    a = ap.parse_args()
    from gradio_client import Client, handle_file

    tok = token()
    print(f"TRELLIS.2 {a.space} as {'signed-in' if tok else 'anonymous'}; seed {a.seed}, {a.resolution}, {a.faces} faces, {a.texture}² texture", flush=True)
    import inspect
    kw = {"verbose": False}
    if tok:  # gradio_client renamed hf_token → token in 1.x
        kw["token" if "token" in inspect.signature(Client.__init__).parameters else "hf_token"] = tok
    client = Client(a.space, **kw)
    t0 = time.time()
    prepped = client.predict(input=handle_file(a.image), api_name="/preprocess_image")  # background removed, cropped, squared
    print(f"preprocessed in {time.time() - t0:.0f}s", flush=True)
    t1 = time.time()
    client.predict(  # the Space's defaults for every advanced setting
        image=handle_file(prepped["path"] if isinstance(prepped, dict) else prepped), seed=a.seed, resolution=a.resolution,
        ss_guidance_strength=7.5, ss_guidance_rescale=0.7, ss_sampling_steps=12, ss_rescale_t=5.0,
        shape_slat_guidance_strength=7.5, shape_slat_guidance_rescale=0.5, shape_slat_sampling_steps=12, shape_slat_rescale_t=3.0,
        tex_slat_guidance_strength=1.0, tex_slat_guidance_rescale=0.0, tex_slat_sampling_steps=12, tex_slat_rescale_t=3.0,
        api_name="/image_to_3d")
    print(f"image → 3D in {time.time() - t1:.0f}s", flush=True)
    t2 = time.time()
    glb, _ = client.predict(decimation_target=a.faces, texture_size=a.texture, api_name="/extract_glb")  # the session keeps the latents
    print(f"GLB extracted in {time.time() - t2:.0f}s", flush=True)
    out = Path(a.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(glb, out)
    print(f"DONE {out} {out.stat().st_size} bytes", flush=True)


if __name__ == "__main__":
    sys.exit(main())
