# Shared by the LOD bakes (hero_far_lod.py, loot_far_lod.py): sample a material's base colour into a vertex-colour layer, drop a part's armature modifier, take a part down to a triangle budget. Run inside Blender.
import bpy
import numpy as np


def tris_of(o):
    return sum(len(p.vertices) - 2 for p in o.data.polygons)


def base_colour_image(mat):
    """The sRGB image feeding the material's Base Color (followed through any mix), and the colour factor when there is none."""
    if not mat or not mat.use_nodes:
        return None, (0.8, 0.8, 0.8, 1.0)
    bsdf = next((n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED"), None)
    if bsdf is None:
        return None, (0.8, 0.8, 0.8, 1.0)
    sock = bsdf.inputs["Base Color"]
    seen = set()
    factor = [1.0, 1.0, 1.0, 1.0]   # glTF's baseColorFactor arrives as a constant colour input of a mix node on the way to the image: multiply every such constant in

    def up(s):
        for link in s.links:
            n = link.from_node
            if n in seen:
                continue
            seen.add(n)
            if n.type == "TEX_IMAGE" and n.image:
                return n.image
            found = None
            for i in n.inputs:
                if not i.is_linked and i.type == "RGBA" and n.type in ("MIX", "MIX_RGB"):
                    for k in range(4):
                        factor[k] *= i.default_value[k]
                elif i.is_linked and found is None:
                    found = up(i)
            if found:
                return found
        return None
    img = up(sock)
    if img is None:
        return None, tuple(sock.default_value)
    return img, tuple(factor)


def bake_colour(o):
    """Corner colours: the base-colour image sampled at each loop's UV (nearest, wrapped), times the colour factor; written linear into the 'Col' layer."""
    me = o.data
    img, factor = base_colour_image(me.materials[0] if me.materials else None)
    n = len(me.loops)
    if "Col" in me.color_attributes:
        me.color_attributes.remove(me.color_attributes["Col"])
    attr = me.color_attributes.new("Col", "FLOAT_COLOR", "CORNER")
    if img is None or not me.uv_layers:
        out = np.tile(np.array(factor, dtype=np.float32), (n, 1))
    else:
        w, h = img.size
        px = np.array(img.pixels[:], dtype=np.float32).reshape(h, w, 4)
        uv = np.empty(n * 2, dtype=np.float32)
        me.uv_layers[0].data.foreach_get("uv", uv)
        uv = uv.reshape(n, 2)
        ix = np.clip(((uv[:, 0] % 1.0) * w).astype(int), 0, w - 1)
        iy = np.clip(((uv[:, 1] % 1.0) * h).astype(int), 0, h - 1)
        out = px[iy, ix]
        if img.colorspace_settings.name == "sRGB":   # Image.pixels is the stored (sRGB-encoded) value: the layer is linear, like every glTF vertex colour
            rgb = out[:, :3]
            out[:, :3] = np.where(rgb <= 0.04045, rgb / 12.92, ((rgb + 0.055) / 1.055) ** 2.4)
        out = out * np.array(factor, dtype=np.float32)
        print(f"PROBE colour {o.name} image {img.name} cs {img.colorspace_settings.name} factor {[round(f, 2) for f in factor]} mean {out[:, :3].mean():.3f}")
    out[:, 3] = 1.0
    attr.data.foreach_set("color", out.astype(np.float32).ravel())


def drop_armature_modifier(o):
    for m in list(o.modifiers):
        if m.type == "ARMATURE":
            o.modifiers.remove(m)


def reduce_to(o, tris):
    cur = tris_of(o)
    if tris >= cur:
        return cur
    if o.data.users > 1:   # the drawn and sheathed weapon copies share one mesh: a modifier cannot be applied to shared data
        o.data = o.data.copy()
    bpy.ops.object.select_all(action="DESELECT")
    bpy.context.view_layer.objects.active = o
    o.select_set(True)
    mod = o.modifiers.new("dec", "DECIMATE")
    mod.ratio = tris / cur
    mod.use_collapse_triangulate = True
    bpy.ops.object.modifier_apply(modifier="dec")
    return tris_of(o)
