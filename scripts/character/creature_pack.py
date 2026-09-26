"""Append fitted surfaces while retaining shipped clips, inverse binds and weapon data."""

import copy
import json
import os
import struct
import sys
import hashlib
from pathlib import Path


def compact(d, b):
    d = copy.deepcopy(d)

    def retain(key, used):
        ids = sorted(set(used))
        mapping = {old: i for i, old in enumerate(ids)}
        d[key] = [d[key][i] for i in ids]
        return mapping

    meshes = retain("meshes", [n["mesh"] for n in d["nodes"] if "mesh" in n])
    for n in d["nodes"]:
        if "mesh" in n:
            n["mesh"] = meshes[n["mesh"]]
    primitives = [p for m in d["meshes"] for p in m["primitives"]]
    materials = retain(
        "materials", [p["material"] for p in primitives if "material" in p]
    )
    for p in primitives:
        if "material" in p:
            p["material"] = materials[p["material"]]
    infos = []

    def visit(v, key=""):
        if isinstance(v, dict):
            if key.endswith("Texture") and "index" in v:
                infos.append(v)
            for k, item in v.items():
                visit(item, k)
        elif isinstance(v, list):
            for item in v:
                visit(item)

    visit(d["materials"])
    textures = retain("textures", [i["index"] for i in infos])
    for i in infos:
        i["index"] = textures[i["index"]]
    sources = []
    for t in d["textures"]:
        if "source" in t:
            sources.append(t)
        sources.extend(v for v in t.get("extensions", {}).values() if "source" in v)
    images = retain("images", [v["source"] for v in sources])
    for v in sources:
        v["source"] = images[v["source"]]
    samplers = retain(
        "samplers", [t["sampler"] for t in d["textures"] if "sampler" in t]
    )
    for t in d["textures"]:
        if "sampler" in t:
            t["sampler"] = samplers[t["sampler"]]
    skins = retain("skins", [n["skin"] for n in d["nodes"] if "skin" in n])
    for n in d["nodes"]:
        if "skin" in n:
            n["skin"] = skins[n["skin"]]
    refs = []
    for p in primitives:
        refs.extend((p["attributes"], k) for k in p["attributes"])
        if "indices" in p:
            refs.append((p, "indices"))
    refs.extend(
        (s, "inverseBindMatrices") for s in d["skins"] if "inverseBindMatrices" in s
    )
    refs.extend(
        (s, k)
        for a in d.get("animations", [])
        for s in a["samplers"]
        for k in ["input", "output"]
    )
    accessors = retain("accessors", [o[k] for o, k in refs])
    for o, k in refs:
        o[k] = accessors[o[k]]
    refs = [(a, "bufferView") for a in d["accessors"] if "bufferView" in a] + [
        (i, "bufferView") for i in d["images"] if "bufferView" in i
    ]
    views = retain("bufferViews", [o[k] for o, k in refs])
    for o, k in refs:
        o[k] = views[o[k]]
    out = bytearray()
    for v in d["bufferViews"]:
        out += b"\0" * (-len(out) % 4)
        at = v.get("byteOffset", 0)
        chunk = b[at : at + v["byteLength"]]
        v["byteOffset"] = len(out)
        v["buffer"] = 0
        out += chunk
    return d, out


root = Path("artifacts/character/creatures")
family = sys.argv[1]
base = {"minotaur": "pitborn", "wraith": "nightborn", "werewolf": "pitborn", "skeleton": "source/backups/veteran-v1", "dwarf": "source/creatures/dwarf-donor", "executioner": "source/backups/executioner-v5", "veteran": "source/backups/veteran-v1", "plaguedoctor": "warrior", "knight": "source/creatures/knight-donor", "witch": "source/backups/veteran-v1", "legionary": "warrior", "hoplite": "warrior"}[family]
# Surface material factors per family: the retained maps stay byte-identical; a factor only scales them (glTF spec).
# The Dwarf's TRELLIS metallic map reads his dented iron as polished steel under the arena lighting; 0.6 keeps the plate iron, not chrome.
# The Knight's plate (metallicFactor 1, ~4.9k flipped normal corners) threw white glints mid-swing; the Dwarf's cap, a touch higher for plate.
SURFACE_FACTORS = {"dwarf": {"metallicFactor": 0.35}, "knight": {"metallicFactor": 0.4}}
# Surface material extensions per family, same rule (maps untouched). A reconstruction ships no normal map, so its smooth
# surface takes the full dielectric specular as a wet-plastic sheen on skin, cloth and leather alike; the Executioner uses
# the skin-strength specular the hand-built heads use (build-warrior.mjs: Face 0.5, Photo 0.35).
SURFACE_EXTENSIONS = {"executioner": {"KHR_materials_specular": {"specularFactor": 0.4}}}


def read(p):
    r = Path(p).read_bytes()
    n = struct.unpack_from("<I", r, 12)[0]
    return json.loads(r[20 : 20 + n]), bytearray(r[28 + n :])


def write(p, d, b):
    d["buffers"] = [{"byteLength": len(b)}]
    j = json.dumps(d, separators=(",", ":")).encode()
    j += b" " * (-len(j) % 4)
    b += b"\0" * (-len(b) % 4)
    p.write_bytes(
        struct.pack("<III", 0x46546C67, 2, 28 + len(j) + len(b))
        + struct.pack("<II", len(j), 0x4E4F534A)
        + j
        + struct.pack("<II", len(b), 0x004E4942)
        + b
    )


d, b = read(f"src/assets/{base}.glb")
# The Quiet One corpse is authored per body against its own skin envelope (build-quiet-one.mjs grounds it), so the
# donor's is not inherited; build-creatures.mjs appends a fresh one on the packed surface.
d["animations"] = [a for a in d.get("animations", []) if a["name"] != "Death_QuietOne"]
new, nb = read(root / f"{family}-surface.glb")
frozen = copy.deepcopy(d)
original = bytes(b)
# UVs are preserved by the fitter; retain the original WebP maps byte-for-byte, except a base colour map the fitter
# colour-matched to the donor's skin (creatures.py match_skin writes it beside the surface).
source, sb = read(Path(f"src/assets/source/creatures/{family}.glb"))
new["images"] = copy.deepcopy(source.get("images", []))
def image_of(texture_ref):
    tex = source["textures"][texture_ref["index"]]
    return next(v["source"] for v in [tex, *tex.get("extensions", {}).values()] if "source" in v)


pbr = source["materials"][0]["pbrMetallicRoughness"]
matched = {  # image index -> the fitter's colour-matched map beside the surface, when it wrote one
    image_of(pbr[key]): root / f"{family}-{name}.webp"
    for key, name in [("baseColorTexture", "basecolor"), ("metallicRoughnessTexture", "metalrough")]
    if key in pbr and (root / f"{family}-{name}.webp").exists()
}
for i, img in enumerate(new["images"]):
    view = source["bufferViews"][img["bufferView"]]
    at = view.get("byteOffset", 0)
    data = matched[i].read_bytes() if i in matched else sb[at : at + view["byteLength"]]
    nb += b"\0" * (-len(nb) % 4)
    img["bufferView"] = len(new["bufferViews"])
    new["bufferViews"].append({"buffer": 0, "byteOffset": len(nb), "byteLength": len(data)})
    nb += data
for key in ["textures", "samplers", "materials"]:
    new[key] = copy.deepcopy(source.get(key, []))
for key in ["extensionsUsed", "extensionsRequired"]:
    new[key] = list(dict.fromkeys(new.get(key, []) + source.get(key, [])))

skin = next(n["skin"] for n in d["nodes"] if n.get("name") == "Skin")
joints = {d["nodes"][n]["name"]: i for i, n in enumerate(d["skins"][skin]["joints"])}
newskin = new["skins"][0]
remap = {i: joints[new["nodes"][n]["name"]] for i, n in enumerate(newskin["joints"])}


# Inverse binds must address the same rest-space coordinates as the preserved skeleton.
def accessor(doc, data, i):
    a = doc["accessors"][i]
    v = doc["bufferViews"][a["bufferView"]]
    fmt = {5121: "B", 5123: "H", 5125: "I", 5126: "f"}[a["componentType"]]
    k = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4, "MAT4": 16}[a["type"]]
    size = struct.calcsize(fmt) * k
    off = v.get("byteOffset", 0) + a.get("byteOffset", 0)
    return [
        struct.unpack_from("<" + fmt * k, data, off + i * v.get("byteStride", size))
        for i in range(a["count"])
    ]


oldib = accessor(d, b, d["skins"][skin]["inverseBindMatrices"])
newib = accessor(new, nb, newskin["inverseBindMatrices"])
err = max(
    abs(a - bb) for i, row in enumerate(newib) for a, bb in zip(row, oldib[remap[i]])
)
assert err < 1e-4, ("inverse-bind mismatch", err)
for mesh in new["meshes"]:
    for prim in mesh["primitives"]:
        # Retain float accessors but discard sub-0.04mm positional noise before gzip.
        # UV error stays below 0.016 texel at 2K; source images and skin weights stay exact.
        for name, grid in [
            ("POSITION", 16384),
            ("NORMAL", 16384),
            ("TEXCOORD_0", 65536),
        ]:
            ac = new["accessors"][prim["attributes"][name]]
            vw = new["bufferViews"][ac["bufferView"]]
            width = {"VEC2": 2, "VEC3": 3}[ac["type"]]
            assert ac["componentType"] == 5126
            off = vw.get("byteOffset", 0) + ac.get("byteOffset", 0)
            low, high = [float("inf")] * width, [float("-inf")] * width
            for j in range(ac["count"]):
                at = off + j * vw.get("byteStride", width * 4)
                row = struct.unpack_from("<" + "f" * width, nb, at)
                rounded = [round(x * grid) / grid for x in row]
                struct.pack_into("<" + "f" * width, nb, at, *rounded)
                low = [min(a, b) for a, b in zip(low, rounded)]
                high = [max(a, b) for a, b in zip(high, rounded)]
            if "min" in ac:
                ac["min"] = low
            if "max" in ac:
                ac["max"] = high
        a = new["accessors"][prim["attributes"]["JOINTS_0"]]
        v = new["bufferViews"][a["bufferView"]]
        fmt = {5121: "B", 5123: "H"}[a["componentType"]]
        size = struct.calcsize(fmt) * 4
        off = v.get("byteOffset", 0) + a.get("byteOffset", 0)
        for i in range(a["count"]):
            at = off + i * v.get("byteStride", size)
            values = struct.unpack_from("<" + fmt * 4, nb, at)
            struct.pack_into("<" + fmt * 4, nb, at, *[remap[j] for j in values])
# Hide inherited body art, retain every rigid weapon attachment and all bones/clips.
# Fitted items that stay with the fighter across the rebuild (a rigid slot draw, its skin weights all on one bone).
# The Veteran also keeps his v1 KeenTools head and neck (creatures.py cuts the reconstruction at the jaw line).
# The Dwarf keeps the iron helm his donor wears (build-warrior.mjs builds it on his skull, the Phase R ringHull recipe), rigid on his Head.
KEEP_SLOTS = {"veteran": {"Helmet", "Face", "Eyes"}, "dwarf": {"Helmet"}, "legionary": {"Face", "Eyes"}, "hoplite": {"Face", "Eyes"}}   # legionary: the hero's own head under the generated helm
weaponroots = [
    i
    for i, n in enumerate(d["nodes"])
    if n.get("name") in ["WeaponDrawn", "SwordDrawn", "SwordSheathed"]
    or (n.get("extras", {}).get("slot") in KEEP_SLOTS.get(family, set()))
]
keep = set()


def visit(i):
    keep.add(i)
    for c in d["nodes"][i].get("children", []):
        visit(c)


for i in weaponroots:
    visit(i)
for i, n in enumerate(d["nodes"]):
    if "mesh" in n and i not in keep:
        n.pop("mesh")
        n.pop("skin", None)
b += b"\0" * (-len(b) % 4)
bo = len(b)
b += nb
counts = {
    k: len(d.get(k, []))
    for k in [
        "bufferViews",
        "accessors",
        "images",
        "samplers",
        "textures",
        "materials",
        "meshes",
    ]
}
for v in new["bufferViews"]:
    v["byteOffset"] = v.get("byteOffset", 0) + bo
for a in new["accessors"]:
    if "bufferView" in a:
        a["bufferView"] += counts["bufferViews"]
for img in new.get("images", []):
    if "bufferView" in img:
        img["bufferView"] += counts["bufferViews"]
for tex in new.get("textures", []):
    if "source" in tex:
        tex["source"] += counts["images"]
    if "sampler" in tex:
        tex["sampler"] += counts["samplers"]
    for e in tex.get("extensions", {}).values():
        if "source" in e:
            e["source"] += counts["images"]


def material(v, key=""):
    if isinstance(v, dict):
        if key.endswith("Texture") and "index" in v:
            v["index"] += counts["textures"]
        for k, item in v.items():
            material(item, k)
    elif isinstance(v, list):
        for item in v:
            material(item)


for m in new.get("materials", []):
    m["name"] = family.title() + "Surface"
    material(m)
    m.setdefault("pbrMetallicRoughness", {}).update(SURFACE_FACTORS.get(family, {}))
    if family in SURFACE_EXTENSIONS:
        m.setdefault("extensions", {}).update(copy.deepcopy(SURFACE_EXTENSIONS[family]))
        new["extensionsUsed"] = list(dict.fromkeys(new.get("extensionsUsed", []) + list(SURFACE_EXTENSIONS[family])))
for mesh in new["meshes"]:
    for p in mesh["primitives"]:
        p["attributes"] = {
            k: v + counts["accessors"] for k, v in p["attributes"].items()
        }
        if "indices" in p:
            p["indices"] += counts["accessors"]
        if "material" in p:
            p["material"] += counts["materials"]
for key in counts:
    d.setdefault(key, []).extend(new.get(key, []))
# Creature surfaces bind from their intact reconstructed A-pose; weapons retain their original skin.
bindings = json.loads((root / f"{family}-binds.json").read_text())
b += b"\0" * (-len(b) % 4)
at = len(b)


def mm(a, b):
    return [
        sum(a[k * 4 + r] * b[c * 4 + k] for k in range(4))
        for c in range(4)
        for r in range(4)
    ]


vals = [
    v
    for i, n in enumerate(d["skins"][skin]["joints"])
    for v in mm(oldib[i], bindings[d["nodes"][n]["name"]])
]
raw = struct.pack("<" + "f" * len(vals), *vals)
b += raw
view = len(d["bufferViews"])
d["bufferViews"].append({"buffer": 0, "byteOffset": at, "byteLength": len(raw)})
ac = len(d["accessors"])
d["accessors"].append(
    {
        "bufferView": view,
        "componentType": 5126,
        "count": len(vals) // 16,
        "type": "MAT4",
    }
)
new_bind_skin = copy.deepcopy(d["skins"][skin])
new_bind_skin["inverseBindMatrices"] = ac
skin = len(d["skins"])
d["skins"].append(new_bind_skin)
parent = next(
    i
    for i, n in enumerate(frozen["nodes"])
    if any("skin" in frozen["nodes"][c] for c in n.get("children", []))
)
for n in new["nodes"]:
    if "mesh" not in n:
        continue
    node = {
        "name": "CreatureBody",
        "mesh": n["mesh"] + counts["meshes"],
        "skin": skin,
        "extras": {"creature": family},
    }
    i = len(d["nodes"])
    d["nodes"].append(node)
    d["nodes"][parent]["children"].append(i)
for key in ["extensionsUsed", "extensionsRequired"]:
    if key in new:
        d[key] = list(dict.fromkeys(d.get(key, []) + new[key]))
d.setdefault("extras", {})["creatureSource"] = {
    "family": family,
    "stage": "in-game-playtest",
    "baseSha256": hashlib.sha256(
        Path(f"src/assets/{base}.glb").read_bytes()
    ).hexdigest(),
    "generatorSha256": hashlib.sha256(
        Path("scripts/character/creatures.py").read_bytes()
        + Path(__file__).read_bytes()
    ).hexdigest(),
    "sourceSha256": hashlib.sha256(
        (Path(f"src/assets/source/creatures/{family}.glb")).read_bytes()
    ).hexdigest(),
    # The maps the fitter may replace, by source image index (creature-check.mjs verifies exactly these swaps).
    **({"skinMatched": {str(i): hashlib.sha256(f.read_bytes()).hexdigest() for i, f in sorted(matched.items())}} if matched else {}),
}
assert b[: len(original)] == original
assert d["animations"] == frozen["animations"]
assert d["skins"][: len(frozen["skins"])] == frozen["skins"]
d, b = compact(d, b)
write(Path(os.environ.get("CREATURE_OUT") or f"src/assets/{family}.glb"), d, b)   # CREATURE_OUT: the Hero Look pilot builds outside src/assets (the bundle globs it)
print(
    "ASSEMBLED",
    family,
    "bind error",
    err,
    "bytes",
    len(b),
    "clips",
    len(d["animations"]),
)
