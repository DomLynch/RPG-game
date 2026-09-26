# Hunyuan3D-2.1 on the HF Space (shape + PBR texture stage, /generation_all). Usage: hy21.py <image> <name> [steps] [octree]
import hashlib, json, shutil, sys, time
from gradio_client import Client, handle_file
from huggingface_hub import get_token
img, name = sys.argv[1], sys.argv[2]
steps, octree = int(sys.argv[3]) if len(sys.argv) > 3 else 30, int(sys.argv[4]) if len(sys.argv) > 4 else 256
c = Client("tencent/Hunyuan3D-2.1", token=get_token(), verbose=False)
t0 = time.time()
r = c.predict(image=handle_file(img), mv_image_front=None, mv_image_back=None, mv_image_left=None, mv_image_right=None, steps=steps, guidance_scale=5.0, seed=1234, octree_resolution=octree, check_box_rembg=True, num_chunks=8000, randomize_seed=False, api_name="/generation_all")
receipt = {"space": "tencent/Hunyuan3D-2.1", "image": img, "image_sha256": hashlib.sha256(open(img, "rb").read()).hexdigest(), "steps": steps, "octree": octree, "seed": 1234, "seconds": round(time.time() - t0, 1), "outputs": []}
for i, x in enumerate(r if isinstance(r, (list, tuple)) else [r]):
    p = x.get("value", x) if isinstance(x, dict) else x
    if isinstance(p, dict): p = p.get("path")
    if isinstance(p, str) and p.endswith((".glb", ".obj")):
        dest = f"artifacts/source/hunyuan/{name}-{i}{p[-4:]}"; shutil.copy(p, dest); receipt["outputs"].append(dest)
json.dump(receipt, open(f"artifacts/source/hunyuan/{name}.json", "w"), indent=1)
print("DONE", json.dumps(receipt))
