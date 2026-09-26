# Raw converter-output still, no Blender/browser (safe while deploy.sh holds the box): numpy point-splat of a textured GLB,
# front view, base colour x simple Lambert on face normals. A preview of what the converter produced, not an engine render.
import io, json, struct, sys
import numpy as np
from PIL import Image
path, out, title = sys.argv[1], sys.argv[2], sys.argv[3]
b = open(path, "rb").read(); n = struct.unpack_from("<I", b, 12)[0]; j = json.loads(b[20:20 + n]); binc = b[20 + n + 8:]
CT = {5126: np.float32, 5125: np.uint32, 5123: np.uint16, 5121: np.uint8}; NC = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}
def acc(i):
    a = j["accessors"][i]; v = j["bufferViews"][a["bufferView"]]; dt = CT[a["componentType"]]; c = NC[a["type"]]
    st = v.get("byteStride", 0); off = v.get("byteOffset", 0) + a.get("byteOffset", 0)
    if st and st != c * np.dtype(dt).itemsize:
        raw = np.frombuffer(binc, np.uint8, a["count"] * st, off).reshape(-1, st)[:, : c * np.dtype(dt).itemsize]
        return np.ascontiguousarray(raw).view(dt).reshape(-1, c)
    return np.frombuffer(binc, dt, a["count"] * c, off).reshape(-1, c)
def tex(m):
    t = j["textures"][m["pbrMetallicRoughness"]["baseColorTexture"]["index"]]; im = j["images"][t.get("source", t.get("extensions", {}).get("EXT_texture_webp", {}).get("source"))]
    if "uri" in im: import base64; raw = base64.b64decode(im["uri"].split(",", 1)[1])
    else: v = j["bufferViews"][im["bufferView"]]; raw = binc[v.get("byteOffset", 0): v.get("byteOffset", 0) + v["byteLength"]]
    return np.asarray(Image.open(io.BytesIO(raw)).convert("RGB"), np.float32) / 255
def world(ni, M=np.eye(4)):
    nd = j["nodes"][ni]; L = np.eye(4)
    if "matrix" in nd: L = np.array(nd["matrix"]).reshape(4, 4).T
    else:
        t = nd.get("translation", [0, 0, 0]); q = nd.get("rotation", [0, 0, 0, 1]); s = nd.get("scale", [1, 1, 1]); x, y, z, w = q
        R = np.array([[1-2*(y*y+z*z), 2*(x*y-z*w), 2*(x*z+y*w)], [2*(x*y+z*w), 1-2*(x*x+z*z), 2*(y*z-x*w)], [2*(x*z-y*w), 2*(y*z+x*w), 1-2*(x*x+y*y)]])
        L[:3, :3] = R * s; L[:3, 3] = t
    W = M @ L; yield ni, W
    for c in nd.get("children", []): yield from world(c, W)
P, C, tris = [], [], 0
FLIP = len(sys.argv) > 4 and sys.argv[4] == 'flip'   # the converter faced the other way: view from -z
TOTAL_AREA = 0.0
rng = np.random.default_rng(0)
for root in j['scenes'][j.get('scene', 0)]['nodes']:
    for ni, W in world(root):
        if 'mesh' not in j['nodes'][ni]: continue
        for p in j['meshes'][j['nodes'][ni]['mesh']]['primitives']:
            q = acc(p['attributes']['POSITION']).astype(np.float64) @ W[:3, :3].T; ix = acc(p['indices']).reshape(-1, 3)
            TOTAL_AREA += np.linalg.norm(np.cross(q[ix[:, 1]] - q[ix[:, 0]], q[ix[:, 2]] - q[ix[:, 0]]), axis=1).sum()
for root in j["scenes"][j.get("scene", 0)]["nodes"]:
    for ni, W in world(root):
        if "mesh" not in j["nodes"][ni]: continue
        for p in j["meshes"][j["nodes"][ni]["mesh"]]["primitives"]:
            pos = acc(p["attributes"]["POSITION"]).astype(np.float64); pos = pos @ W[:3, :3].T + W[:3, 3]
            idx = acc(p["indices"]).reshape(-1, 3) if "indices" in p else np.arange(len(pos)).reshape(-1, 3); tris += len(idx)
            m = j["materials"][p["material"]] if "material" in p else {}
            T = tex(m) if "baseColorTexture" in m.get("pbrMetallicRoughness", {}) else None
            uv = acc(p["attributes"]["TEXCOORD_0"]) if "TEXCOORD_0" in p["attributes"] else None
            v0, v1, v2 = pos[idx[:, 0]], pos[idx[:, 1]], pos[idx[:, 2]]; nrm = np.cross(v1 - v0, v2 - v0)
            area = np.linalg.norm(nrm, axis=1); nrm /= area[:, None] + 1e-12
            k = np.clip(np.ceil(area / TOTAL_AREA * 4e6).astype(int), 1, 400); rep = np.repeat(np.arange(len(idx)), k)   # ~4M samples over the whole surface, whatever the tri count
            r1, r2 = rng.random(len(rep)), rng.random(len(rep)); s = np.sqrt(r1); a0, a1, a2 = 1 - s, s * (1 - r2), s * r2
            P.append(a0[:, None] * v0[rep] + a1[:, None] * v1[rep] + a2[:, None] * v2[rep])
            if T is not None and uv is not None:
                u = a0[:, None] * uv[idx[rep, 0]] + a1[:, None] * uv[idx[rep, 1]] + a2[:, None] * uv[idx[rep, 2]]
                col = T[(np.clip(u[:, 1] % 1, 0, 1) * (T.shape[0] - 1)).astype(int), (np.clip(u[:, 0] % 1, 0, 1) * (T.shape[1] - 1)).astype(int)]
            else: col = np.full((len(rep), 3), 0.75)
            light = np.array([0.35, 0.5, 0.8]); light /= np.linalg.norm(light)
            C.append(col * (0.35 + 0.75 * np.abs(nrm[rep] @ light))[:, None])
P = np.concatenate(P); C = np.concatenate(C)
if FLIP: P[:, 0] *= -1; P[:, 2] *= -1
H, Wd = 1200, 700; lo, hi = np.percentile(P, 0.2, 0), np.percentile(P, 99.8, 0)
up = P[P[:, 1] > lo[1] + 0.4 * (hi[1] - lo[1])]; lo[0], hi[0] = np.percentile(up[:, 0], 0.2) - 0.1 * (hi[1] - lo[1]), np.percentile(up[:, 0], 99.8) + 0.1 * (hi[1] - lo[1])   # width from the upper body: a stray floor sliver (Hunyuan) must not shrink the figure
sc = 0.92 * min(H / (hi[1] - lo[1]), Wd / (hi[0] - lo[0]))
x = ((P[:, 0] - (lo[0] + hi[0]) / 2) * sc + Wd / 2).astype(int); y = (H / 2 - (P[:, 1] - (lo[1] + hi[1]) / 2) * sc).astype(int)
ok = (x >= 0) & (x < Wd) & (y >= 0) & (y < H); x, y, z, C = x[ok], y[ok], P[ok, 2], C[ok]
o = np.argsort(z); img = np.full((H, Wd, 3), 0.86)
for dx, dy in ((0, 0), (1, 0), (0, 1), (1, 1)): img[np.minimum(y[o] + dy, H - 1), np.minimum(x[o] + dx, Wd - 1)] = C[o]   # 2x2 splat fills the gaps   # nearest (+z, toward the viewer) written last
im = Image.fromarray((np.clip(img, 0, 1) * 255).astype(np.uint8))
from PIL import ImageDraw; ImageDraw.Draw(im).text((10, 10), f"{title}\n{tris:,} tris, {len(b)/1e6:.1f} MB raw", fill=(0, 0, 0))
im.save(out); print(out, tris)
