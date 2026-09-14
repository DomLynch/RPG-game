#!/usr/bin/env python3
"""Hunyuan3D multi-view reconstruction through a Hugging Face Space API (A/B track vs KeenTools).

Sends up to four orthogonal views (or one image) to a Tencent Hunyuan3D Space, waits for the
job with a bounded retry loop (ZeroGPU quota / sleeping space), and saves the results under
artifacts/source/hunyuan/<name>.glb (textured, textures embedded), <name>.shape.glb (untextured),
<name>.json (params, seed, server mesh stats, local triangle/texture/bounds stats).
Reusable for head, body and weapons: only the input images and --name change.

    ~/.venvs/face/bin/python scripts/character/hunyuan.py \
        --front artifacts/source/face/gpt_front.png \
        --left  artifacts/source/face/gpt/raw2.png \
        --right artifacts/source/face/gpt/raw1.png \
        --name head-mv-v1 --offset-y floor

VIEW CONVENTION (verified against the Space's own assets/example_mv_images): Hunyuan's slots are named
by CAMERA position, not by the subject's side. "left" = camera orbited to the viewer's left, so the
subject's nose points to the image-LEFT and the subject's RIGHT cheek/ear is visible. Hence for a
portrait set: gpt_front -> --front, raw2 (nose left, +90 deg) -> --left, raw1 (nose right, -90 deg) -> --right.
Missing slots are simply omitted (the model hallucinates them); 3/4 views are NOT valid slot inputs.

Options: --space (default tencent/Hunyuan3D-2mv), --endpoint /generation_all (shape + texture) or
/shape_generation (shape only), --steps 30 (Turbo 5 / Fast 10 / Standard 30 in the UI), --guidance 5.0,
--seed 1234 (fixed; --randomize-seed to let the server pick), --octree 256 (Low 196 / High 384),
--num-chunks 8000, --no-rembg (inputs already have alpha), --timeout-minutes 20 (total wait budget),
--offset-y floor|<metres> (also write <name>.offset.glb with a root node lifted so the mesh sits on the
studio floor, for scripts/character-preview.mjs --src), --image PATH (single-image spaces, e.g.
tencent/Hunyuan3D-2 / -2.1, whose endpoint takes `image` instead of mv_* slots).

Auth: HF_TOKEN env or the huggingface_hub stored login is used for ZeroGPU quota when present; the
token is never printed. Anonymous calls work with a smaller quota. No purchases, no sign-ups.
"""
import argparse
import io
import json
import os
import re
import shutil
import struct
import sys
import time
from pathlib import Path

GLB_MAGIC, CHUNK_JSON, CHUNK_BIN = 0x46546C67, 0x4E4F534A, 0x004E4942
REDACT = re.compile(r"hf_[A-Za-z0-9]{10,}")


def log(msg):
    print(REDACT.sub("hf_***", str(msg)), flush=True)


def parse_args():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    for slot in ("front", "back", "left", "right"):
        p.add_argument(f"--{slot}", help=f"{slot} view (Hunyuan camera convention, see module doc)")
    p.add_argument("--image", help="single reference image (non-mv spaces)")
    p.add_argument("--name", required=True, help="output stem under --out-dir")
    p.add_argument("--out-dir", default="artifacts/source/hunyuan")
    p.add_argument("--space", default="tencent/Hunyuan3D-2mv")
    p.add_argument("--endpoint", default="/generation_all", help="/generation_all or /shape_generation")
    p.add_argument("--steps", type=int, default=30)
    p.add_argument("--guidance", type=float, default=5.0)
    p.add_argument("--seed", type=int, default=1234)
    p.add_argument("--randomize-seed", action="store_true")
    p.add_argument("--octree", type=int, default=256)
    p.add_argument("--num-chunks", type=int, default=8000)
    p.add_argument("--no-rembg", action="store_true")
    p.add_argument("--timeout-minutes", type=float, default=20.0)
    p.add_argument("--offset-y", help="'floor' or a float in metres; writes <name>.offset.glb")
    return p.parse_args()


def resolve_token():
    token = os.environ.get("HF_TOKEN")
    if not token:
        try:
            from huggingface_hub import get_token
            token = get_token()
        except Exception:
            token = None
    return token or None


def make_client(space, token):
    from gradio_client import Client
    import inspect
    params = inspect.signature(Client.__init__).parameters
    kw = {"verbose": False}
    if token:
        kw["token" if "token" in params else "hf_token"] = token
    return Client(space, **kw)


def retry_delay(message):
    """Seconds suggested by a ZeroGPU quota message ('retry in 1:23:45' / '... in 90 seconds'), else None."""
    m = re.search(r"(\d+):(\d\d):(\d\d)", message)
    if m:
        h, mi, s = map(int, m.groups())
        return h * 3600 + mi * 60 + s
    m = re.search(r"(\d+)\s*(?:seconds|s\b)", message)
    return int(m.group(1)) if m else None


def as_path(value):
    if isinstance(value, dict):
        return value.get("path") or value.get("value")
    return value


def run_job(args, token, inputs):
    from gradio_client import handle_file
    files = {k: (handle_file(v) if v else None) for k, v in inputs.items()}
    common = [args.steps, args.guidance, args.seed, args.octree, not args.no_rembg, args.num_chunks, args.randomize_seed]
    if args.image:
        call = [None, files["image"], None, None, None, None, *common]
    else:
        call = [None, None, files["front"], files["back"], files["left"], files["right"], *common]
    deadline = time.time() + args.timeout_minutes * 60
    attempt = 0
    while True:
        attempt += 1
        started = time.time()
        try:
            client = make_client(args.space, token)
            job = client.submit(*call, api_name=args.endpoint)
            log(f"attempt {attempt}: submitted to {args.space}{args.endpoint}, waiting up to {int(deadline - time.time())}s")
            result = job.result(timeout=max(30.0, deadline - time.time()))
            return result, time.time() - started
        except TimeoutError:
            sys.exit(f"gave up: no result within --timeout-minutes {args.timeout_minutes}")
        except Exception as exc:  # quota, sleeping space, transient HTTP
            message = str(exc)
            remaining = deadline - time.time()
            if remaining <= 0:
                sys.exit(f"gave up after {args.timeout_minutes} min: {REDACT.sub('hf_***', message[:400])}")
            wait = min(retry_delay(message) or 60, remaining)
            log(f"attempt {attempt} failed: {message[:300]}\n  -> retrying in {int(wait)}s ({int(remaining)}s budget left)")
            time.sleep(wait)


# ---- GLB helpers (pure Python; no gltf libraries in the venv) --------------------------------------
def read_glb(path):
    data = Path(path).read_bytes()
    magic, _, length = struct.unpack("<III", data[:12])
    if magic != GLB_MAGIC:
        raise ValueError(f"{path} is not a GLB")
    off, chunks = 12, {}
    while off < length:
        clen, ctype = struct.unpack("<II", data[off:off + 8])
        chunks[ctype] = data[off + 8:off + 8 + clen]
        off += 8 + clen
    return json.loads(chunks[CHUNK_JSON]), chunks.get(CHUNK_BIN, b"")


def write_glb(path, gltf, binary):
    js = json.dumps(gltf, separators=(",", ":")).encode()
    js += b" " * ((4 - len(js) % 4) % 4)
    binary += b"\0" * ((4 - len(binary) % 4) % 4)
    total = 12 + 8 + len(js) + (8 + len(binary) if binary else 0)
    out = struct.pack("<III", GLB_MAGIC, 2, total) + struct.pack("<II", len(js), CHUNK_JSON) + js
    if binary:
        out += struct.pack("<II", len(binary), CHUNK_BIN) + binary
    Path(path).write_bytes(out)


def glb_stats(path):
    gltf, binary = read_glb(path)
    acc = gltf.get("accessors", [])
    tris, verts, lo, hi = 0, 0, [float("inf")] * 3, [float("-inf")] * 3
    for mesh in gltf.get("meshes", []):
        for prim in mesh.get("primitives", []):
            pos = acc[prim["attributes"]["POSITION"]]
            verts += pos["count"]
            count = acc[prim["indices"]]["count"] if "indices" in prim else pos["count"]
            if prim.get("mode", 4) == 4:
                tris += count // 3
            lo = [min(a, b) for a, b in zip(lo, pos.get("min", lo))]
            hi = [max(a, b) for a, b in zip(hi, pos.get("max", hi))]
    textures = []
    for img in gltf.get("images", []):
        size = None
        if "bufferView" in img:
            bv = gltf["bufferViews"][img["bufferView"]]
            blob = binary[bv.get("byteOffset", 0):bv.get("byteOffset", 0) + bv["byteLength"]]
            try:
                from PIL import Image
                size = Image.open(io.BytesIO(blob)).size
            except Exception:
                size = None
        textures.append({"mimeType": img.get("mimeType"), "size": size, "name": img.get("name")})
    return {"bytes": os.path.getsize(path), "triangles": tris, "vertices": verts, "bounds_min": lo, "bounds_max": hi,
            "materials": len(gltf.get("materials", [])), "textures": textures}


def write_offset(src, dst, offset_y):
    gltf, binary = read_glb(src)
    scene = gltf["scenes"][gltf.get("scene", 0)]
    roots = scene["nodes"]
    gltf.setdefault("nodes", []).append({"name": "HarnessOffset", "translation": [0.0, float(offset_y), 0.0], "children": roots})
    scene["nodes"] = [len(gltf["nodes"]) - 1]
    write_glb(dst, gltf, binary)


def main():
    args = parse_args()
    inputs = {k: getattr(args, k) for k in ("front", "back", "left", "right", "image")}
    given = {k: v for k, v in inputs.items() if v}
    if not given or (args.image and any(inputs[k] for k in ("front", "back", "left", "right"))):
        sys.exit("give either --image or any of --front/--back/--left/--right")
    for k, v in given.items():
        if not Path(v).is_file():
            sys.exit(f"missing input {k}: {v}")
    missing = [k for k in ("front", "back", "left", "right") if not inputs[k]] if not args.image else []
    log(f"views: {', '.join(f'{k}={v}' for k, v in given.items())}" + (f"  (missing: {', '.join(missing)})" if missing else ""))
    token = resolve_token()
    log(f"auth: {'HF token found (not shown)' if token else 'anonymous (no HF token; smaller ZeroGPU quota)'}")

    result, elapsed = run_job(args, token, inputs)
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    if args.endpoint.rstrip("/").endswith("generation_all"):
        shape_path, textured_path, _html, stats, seed = result
    else:
        shape_path, _html, stats, seed = result
        textured_path = None
    saved = {}
    if textured_path and as_path(textured_path):
        saved["textured"] = str(out_dir / f"{args.name}.glb")
        shutil.copyfile(as_path(textured_path), saved["textured"])
    if shape_path and as_path(shape_path):
        saved["shape"] = str(out_dir / (f"{args.name}.shape.glb" if "textured" in saved else f"{args.name}.glb"))
        shutil.copyfile(as_path(shape_path), saved["shape"])
    primary = saved.get("textured") or saved["shape"]
    local = {k: glb_stats(v) for k, v in saved.items()}
    if args.offset_y:
        dy = -local["textured" if "textured" in saved else "shape"]["bounds_min"][1] if args.offset_y == "floor" else float(args.offset_y)
        saved["offset"] = str(out_dir / f"{args.name}.offset.glb")
        write_offset(primary, saved["offset"], dy)
        local["offset_y"] = dy
    record = {"space": args.space, "endpoint": args.endpoint, "inputs": {k: str(Path(v).resolve()) for k, v in given.items()},
              "missing_views": missing, "params": {"steps": args.steps, "guidance": args.guidance, "seed_requested": args.seed,
              "randomize_seed": args.randomize_seed, "octree": args.octree, "num_chunks": args.num_chunks, "rembg": not args.no_rembg},
              "seed_used": seed, "server_stats": stats, "elapsed_s": round(elapsed, 1), "files": saved, "local_stats": local,
              "date": time.strftime("%Y-%m-%d %H:%M:%S")}
    (out_dir / f"{args.name}.json").write_text(json.dumps(record, indent=1))
    log(json.dumps({k: v for k, v in record.items() if k != "inputs"}, indent=1))
    log(f"saved: {', '.join(saved.values())}")


if __name__ == "__main__":
    main()
