# Hunyuan3D-2mv (multi-view, shape only): front + back design views of the bold-cuirass source -> GLB. Receipt beside the output.
import json, shutil, sys, time, hashlib
from pathlib import Path
from gradio_client import Client, handle_file
R = "docs/character-references/sand-legionary-source-d190926a"
out = Path("artifacts/source/hunyuan/legionary-d-2mv.glb")
t0 = time.time()
c = Client("tencent/Hunyuan3D-2mv", verbose=False)
res = c.predict(caption=None, image=None, mv_image_front=handle_file(R + ".png"), mv_image_back=handle_file(R + "-back.png"),
                mv_image_left=None, mv_image_right=None, steps=30, guidance_scale=5.0, seed=190926, octree_resolution=380,
                check_box_rembg=True, num_chunks=8000, randomize_seed=False, api_name="/shape_generation")
p = res[0]; p = p.get("value", p) if isinstance(p, dict) else p; p = p.get("path", p) if isinstance(p, dict) else p
out.parent.mkdir(parents=True, exist_ok=True); shutil.copy(p, out)
json.dump({"space": "tencent/Hunyuan3D-2mv", "views": ["front", "back"], "steps": 30, "octree": 380, "seed": 190926,
           "seconds": round(time.time() - t0, 1), "sha256": hashlib.sha256(out.read_bytes()).hexdigest(), "extra": str(res[1:])[:300]},
          open(str(out) + ".json", "w"), indent=1)
print("DONE", out, round(time.time() - t0, 1))
