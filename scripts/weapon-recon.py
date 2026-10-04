#!/usr/bin/env python3
"""Weapon reconstruction through Hugging Face Spaces (weapons lane, 2026-09-20).

Two stages, both through the Space APIs the creature pipeline used by hand:
  1. concept image  — FLUX (black-forest-labs/FLUX.1-dev, fallback -schnell): a single isolated weapon on a plain background,
                      in the game's materials rule; or --image PATH to skip generation and use an owner-approved picture.
  2. image → 3D     — microsoft/TRELLIS.2 (official Space): /start_session → /preprocess_image → /image_to_3d → /extract_glb.
Outputs under artifacts/source/weapons/<name>/: concept.png, raw.glb, provenance.json (prompts, seeds, params, SHA-256 of every
file, Space ids, timings). The raw GLB is the immutable source; scripts/weapon-fit.py (Blender) turns it into a game part.

    ~/.venvs/face/bin/python scripts/weapon-recon.py --name trident --prompt "..." [--seed 190926] [--resolution 1024]
        [--decimation 100000] [--texture 1024] [--image PATH] [--timeout-minutes 25]

Auth: HF_TOKEN env or the huggingface_hub stored login (hf auth login) is used for ZeroGPU quota when present; the token is never
printed. Anonymous calls work with a small quota — the creature records say extraction fails anonymously. No purchases, no sign-ups.
"""
import argparse
import hashlib
import json
import os
import re
import shutil
import sys
import time
from pathlib import Path

OUT = Path("artifacts/source/weapons")


def log(msg):
    print(f"[weapon-recon] {msg}", flush=True)


def token():
    t = os.environ.get("HF_TOKEN")
    if t:
        return t
    try:
        from huggingface_hub import get_token
        return get_token() or None
    except Exception:
        return None


def client(space, tok):
    from gradio_client import Client
    import inspect
    kw = {"verbose": False}
    if tok:
        params = inspect.signature(Client.__init__).parameters
        kw["token" if "token" in params else "hf_token"] = tok
    return Client(space, **kw)


def retry_delay(message):
    m = re.search(r"(\d+):(\d\d):(\d\d)", message)
    if m:
        h, mi, s = map(int, m.groups())
        return h * 3600 + mi * 60 + s
    m = re.search(r"(\d+)\s*(?:seconds|s\b)", message)
    return int(m.group(1)) if m else None


def with_retries(fn, deadline, what):
    attempt = 0
    while True:
        attempt += 1
        try:
            return fn()
        except Exception as ex:  # ZeroGPU quota / sleeping space: bounded wait, never silent
            msg = str(ex)
            delay = retry_delay(msg)
            if delay is None or time.time() + delay > deadline:
                sys.exit(f"{what} failed (attempt {attempt}): {msg[:400]}")
            log(f"{what}: quota/sleep — retrying in {delay}s (attempt {attempt})")
            time.sleep(min(delay + 2, max(1, deadline - time.time())))


def sha256(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def as_path(value):
    if isinstance(value, dict):
        return value.get("path") or value.get("value")
    if isinstance(value, (list, tuple)):
        return as_path(value[0])
    return value


def concept(args, tok, deadline, prov):
    """A clean product shot the reconstruction can read: one object, plain background, three-quarter view."""
    for space in [args.image_space, "black-forest-labs/FLUX.1-schnell"]:
        try:
            c = client(space, tok)
        except Exception as ex:
            log(f"{space}: {str(ex)[:120]}")
            continue
        dev = "dev" in space

        def run():
            call = [args.prompt, args.seed, False, args.width, args.height]
            call += [args.guidance, args.image_steps] if dev else [max(4, min(args.image_steps, 8))]
            return c.predict(*call, api_name="/infer")
        started = time.time()
        result = with_retries(run, deadline, f"{space}/infer")
        path = as_path(result)
        dest = args.dir / "concept.png"
        shutil.copy(path, dest)
        prov["concept"] = {"space": space, "prompt": args.prompt, "seed": args.seed, "size": [args.width, args.height],
                           "steps": args.image_steps if dev else max(4, min(args.image_steps, 8)), "guidance": args.guidance if dev else None,
                           "seconds": round(time.time() - started, 1), "sha256": sha256(dest)}
        log(f"concept image from {space} in {prov['concept']['seconds']}s → {dest}")
        return dest
    sys.exit("no image-generation Space reachable")


def reconstruct(args, image, tok, deadline, prov):
    from gradio_client import handle_file
    c = client(args.space, tok)
    started = time.time()
    with_retries(lambda: c.predict(api_name="/start_session"), deadline, "start_session")
    pre = with_retries(lambda: c.predict(handle_file(str(image)), api_name="/preprocess_image"), deadline, "preprocess_image")
    pre_path = as_path(pre)
    shutil.copy(pre_path, args.dir / "preprocessed.png")
    log("preprocessed (background removed)")
    with_retries(lambda: c.predict(  # the Space's image_to_3d takes the PREPROCESSED cut-out (its image component's value), not the photo:
        handle_file(str(pre_path)), args.seed, str(args.resolution),  # fed the photo, a studio backdrop reconstructs as a box (the knife, 2026-09-20)
        args.ss_guidance, args.ss_rescale, args.ss_steps, args.ss_rescale_t,
        args.shape_guidance, args.shape_rescale, args.shape_steps, args.shape_rescale_t,
        args.tex_guidance, args.tex_rescale, args.tex_steps, args.tex_rescale_t,
        api_name="/image_to_3d"), deadline, "image_to_3d")
    log(f"image_to_3d done ({round(time.time() - started)}s) — extracting GLB (decimation {args.decimation}, texture {args.texture})")
    glb = with_retries(lambda: c.predict(args.decimation, args.texture, api_name="/extract_glb"), deadline, "extract_glb")
    src = as_path(glb[1] if isinstance(glb, (list, tuple)) and len(glb) > 1 else glb)
    dest = args.dir / "raw.glb"
    shutil.copy(src, dest)
    prov["reconstruction"] = {"space": args.space, "seed": args.seed, "resolution": args.resolution, "decimation_target": args.decimation,
                              "texture_size": args.texture, "sampling": {k: getattr(args, k) for k in ["ss_guidance", "ss_rescale", "ss_steps", "ss_rescale_t",
                              "shape_guidance", "shape_rescale", "shape_steps", "shape_rescale_t", "tex_guidance", "tex_rescale", "tex_steps", "tex_rescale_t"]},
                              "seconds": round(time.time() - started, 1), "input_sha256": sha256(image), "raw_sha256": sha256(dest), "raw_bytes": dest.stat().st_size}
    log(f"raw GLB {dest.stat().st_size} bytes → {dest}")
    return dest


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--name", required=True)
    ap.add_argument("--prompt")
    ap.add_argument("--image", help="skip generation: use this picture")
    ap.add_argument("--seed", type=int, default=190926)
    ap.add_argument("--resolution", type=int, default=1024, choices=[512, 1024, 1536])
    ap.add_argument("--decimation", type=int, default=100000, help="Space minimum 100000; the game-grade decimation happens in weapon-fit.py")
    ap.add_argument("--texture", type=int, default=1024)
    ap.add_argument("--space", default="microsoft/TRELLIS.2")
    ap.add_argument("--image-space", default="black-forest-labs/FLUX.1-dev")
    ap.add_argument("--width", type=int, default=1024)
    ap.add_argument("--height", type=int, default=1024)
    ap.add_argument("--image-steps", type=int, default=28)
    ap.add_argument("--guidance", type=float, default=3.5)
    # TRELLIS.2 sampler defaults, read from the Space's own API (view_api, 2026-09-20)
    for flag, kind, default in [("ss-guidance", float, 7.5), ("ss-rescale", float, 0.7), ("ss-steps", int, 12), ("ss-rescale-t", float, 5.0),
                                ("shape-guidance", float, 7.5), ("shape-rescale", float, 0.5), ("shape-steps", int, 12), ("shape-rescale-t", float, 3.0),
                                ("tex-guidance", float, 1.0), ("tex-rescale", float, 0.0), ("tex-steps", int, 12), ("tex-rescale-t", float, 3.0)]:
        ap.add_argument(f"--{flag}", type=kind, default=default)
    ap.add_argument("--timeout-minutes", type=int, default=25)
    ap.add_argument("--concept-only", action="store_true")
    args = ap.parse_args()
    if not args.prompt and not args.image:
        sys.exit("--prompt or --image is required")
    args.dir = OUT / args.name
    args.dir.mkdir(parents=True, exist_ok=True)
    tok = token()
    log(f"auth: {'token' if tok else 'anonymous'}")
    deadline = time.time() + args.timeout_minutes * 60
    prov = {"name": args.name, "started": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "auth": "token" if tok else "anonymous"}
    image = Path(args.image) if args.image else concept(args, tok, deadline, prov)
    if args.image:
        prov["concept"] = {"supplied": str(image), "sha256": sha256(image)}
    (args.dir / "provenance.json").write_text(json.dumps(prov, indent=1))
    if args.concept_only:
        log("concept only; stopping before reconstruction")
        return
    reconstruct(args, image, tok, deadline, prov)
    prov["finished"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    (args.dir / "provenance.json").write_text(json.dumps(prov, indent=1))
    log("done")


if __name__ == "__main__":
    main()
