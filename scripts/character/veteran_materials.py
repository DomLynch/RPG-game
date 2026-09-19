"""Veteran-only material bake. No reconstruction, geometry, rig or animation edits.

blender -b -P scripts/character/veteran_materials.py
The retained source tiles and original fold/hammer maps are the immutable inputs.
parts.py also calls bake() so a later full character build retains this finish.
"""
import copy
import json
import struct
from pathlib import Path

import bpy
import numpy as np

ROOT = Path('src/assets/source/materials')


def pixels(path, size=1024):
    image = bpy.data.images.load(str(path), check_existing=False)
    image.colorspace_settings.name = 'Non-Color'  # byte values, no display transform
    image.scale(size, size)
    data = np.empty(size * size * 4, np.float32)
    image.pixels.foreach_get(data)
    bpy.data.images.remove(image)
    return data.reshape(size, size, 4)[..., :3].copy()


def save(name, rgb, quality=82):
    assert np.isfinite(rgb).all(), name
    if name.endswith('_orm'):
        rgb = rgb.reshape(512, 2, 512, 2, 3).mean(axis=(1, 3))
    h, w = rgb.shape[:2]
    image = bpy.data.images.new(name, width=w, height=h, alpha=False)
    image.colorspace_settings.name = 'Non-Color'
    image.pixels.foreach_set(np.concatenate([np.clip(rgb, 0, 1), np.ones((h, w, 1))], axis=2).astype(np.float32).ravel())
    image.file_format = 'JPEG'
    filename = f'{name}_polish_veteran.jpg'
    image.save(filepath=str(ROOT / filename), quality=quality)
    bpy.data.images.remove(image)
    return filename


def periodic(rgb, border=32):
    # Soft edge welding: equal opposite boundary texels, no new UV seams.
    rgb = rgb.copy()
    for axis in (0, 1):
        v = np.swapaxes(rgb, 0, axis)
        for i in range(border):
            weight = .5 * (1 - i / border) ** 2
            a, b = v[i].copy(), v[-1-i].copy()
            v[i], v[-1-i] = a * (1-weight) + b * weight, b * (1-weight) + a * weight
    return rgb


def blur(x, passes=1):
    for _ in range(passes):
        for axis in (0, 1):
            x = sum(np.roll(x, i, axis) * w for i, w in [(-2, 1), (-1, 4), (0, 6), (1, 4), (2, 1)]) / 16
    return x


def surface_normal(height, original, strength, original_strength):
    n = original * 2 - 1
    x = n[..., 0] / np.maximum(.25, n[..., 2]) * original_strength
    y = n[..., 1] / np.maximum(.25, n[..., 2]) * original_strength
    x -= (np.roll(height, -1, 1) - np.roll(height, 1, 1)) * strength
    y += (np.roll(height, -1, 0) - np.roll(height, 1, 0)) * strength
    n = np.stack([x, y, np.ones_like(x)], axis=2)
    return n / np.linalg.norm(n, axis=2, keepdims=True) * .5 + .5


def neck_maps(manifest):
    """Bake a shared skin transition in the existing UVs; never repaint facial features.

    Geometry comes from the retained, unmodified source parts. Ring colours are
    sampled from the body's own texture below the join. No generated face or new UVs.
    """
    raw = Path('src/assets/source/parts/body_veteran.glb').read_bytes()
    length = struct.unpack_from('<I', raw, 12)[0]
    doc, binary = json.loads(raw[20:20+length]), raw[28+length:]

    def values(index):
        a = doc['accessors'][index]
        v = doc['bufferViews'][a['bufferView']]
        dtype = {5126: '<f4', 5123: '<u2', 5125: '<u4'}[a['componentType']]
        width = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}[a['type']]
        step = np.dtype(dtype).itemsize
        return np.ndarray((a['count'], width), dtype=dtype, buffer=binary,
                          offset=v.get('byteOffset', 0)+a.get('byteOffset', 0),
                          strides=(v.get('byteStride', step*width), step))

    meshes = {}
    for node in doc['nodes']:
        name = node.get('extras', {}).get('material')
        if name in ('Photo', 'Face'):
            p = doc['meshes'][node['mesh']]['primitives'][0]
            meshes[name] = (values(p['attributes']['POSITION']), values(p['attributes']['TEXCOORD_0']), values(p['indices']).reshape(-1, 3))
    cut = meshes['Face'][0][:, 1].max()-.0015
    top = meshes['Face'][0][meshes['Face'][0][:, 1] > cut+.0014]
    axis = (top[:, [0, 2]].min(axis=0)+top[:, [0, 2]].max(axis=0))/2

    def raster(name):
        pos, uv, triangles = meshes[name]
        tex = uv*np.array([1024, -1024])+np.array([0, 1024])
        grid = np.zeros((1024, 1024, 3), np.float32)
        mask = np.zeros((1024, 1024), bool)
        for ids in triangles:
            xyz = pos[ids]
            if xyz[:, 1].max() < cut-.035 or xyz[:, 1].min() > cut+.03:
                continue
            a, b, c = tex[ids]
            lo = np.maximum(0, np.floor(tex[ids].min(axis=0)).astype(int))
            hi = np.minimum(1024, np.ceil(tex[ids].max(axis=0)).astype(int))
            if (hi <= lo).any():
                continue
            y, x = np.mgrid[lo[1]:hi[1], lo[0]:hi[0]]
            x, y = x+.5, y+.5
            den = (b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1])
            if abs(den) < 1e-8:
                continue
            u = ((b[1]-c[1])*(x-c[0])+(c[0]-b[0])*(y-c[1]))/den
            v = ((c[1]-a[1])*(x-c[0])+(a[0]-c[0])*(y-c[1]))/den
            w = 1-u-v
            inside = (u >= 0) & (v >= 0) & (w >= 0)
            block = grid[lo[1]:hi[1], lo[0]:hi[0]]
            block[inside] = (u[..., None]*xyz[0]+v[..., None]*xyz[1]+w[..., None]*xyz[2])[inside]
            mask[lo[1]:hi[1], lo[0]:hi[0]] |= inside
        return grid, mask

    grids = {name: raster(name) for name in meshes}
    body_colour = pixels(ROOT/'face_color_veteran.jpg')
    body_orm = pixels(ROOT/'face_orm_veteran.jpg')
    pos, valid = grids['Face']
    angles = np.arctan2(pos[..., 2]-axis[1], pos[..., 0]-axis[0])
    sample = valid & (pos[..., 1] > cut-.014) & (pos[..., 1] < cut-.004)
    assert sample.sum() > 100, 'Neck UV sampling region missing'

    def profile(image):
        rows = []
        for angle in np.linspace(-np.pi, np.pi, 24, endpoint=False):
            distance = np.abs(np.angle(np.exp(1j*(angles-angle))))
            near = sample & (distance < np.pi/8)
            assert near.sum() > 2, 'Uncovered neck colour sector'
            rows.append(np.median(image[near], axis=0))
        return np.array(rows)

    tones, rough = profile(body_colour), profile(body_orm)
    for name, stem in [('Photo', 'kt_face'), ('Face', 'face')]:
        pos, valid = grids[name]
        angle = (np.arctan2(pos[..., 2]-axis[1], pos[..., 0]-axis[0])+np.pi)/(2*np.pi)*24
        index = np.floor(angle).astype(int)
        fraction = (angle-index)[..., None]
        def lookup(rows, index=index, fraction=fraction):
            return rows[index % 24]*(1-fraction)+rows[(index+1) % 24]*fraction
        depth = pos[..., 1]-cut if name == 'Photo' else cut-pos[..., 1]
        t = np.clip(depth/.024, 0, 1)
        weight = (1-t*t*(3-2*t))*valid
        if name == 'Photo':
            chin = np.clip((pos[..., 2]-axis[1]-.07)/.03, 0, 1)
            weight *= 1-chin*chin*(3-2*chin)
        for channel in ('color', 'normal', 'orm'):
            original = pixels(ROOT/f'{stem}_{channel}_veteran.jpg')
            target = lookup(tones if channel == 'color' else rough) if channel != 'normal' else np.broadcast_to([.5, .5, 1.0], original.shape)
            corrected = original*(1-weight[..., None])+target*weight[..., None]
            # Spill only the baked correction into gutters, leaving facial texels intact.
            delta, coverage = corrected-original, valid.copy()
            for _ in range(6):
                acc, count = np.zeros_like(delta), np.zeros_like(weight)
                for shift, dim in [(1, 0), (-1, 0), (1, 1), (-1, 1)]:
                    seen = np.roll(coverage, shift, dim)
                    acc += np.roll(delta, shift, dim)*seen[..., None]
                    count += seen
                grow = ~coverage & (count > 0)
                delta[grow] = acc[grow]/count[grow, None]
                coverage |= grow
            slot = {'color': 'baseColor', 'normal': 'normal', 'orm': 'metallicRoughness'}[channel]
            manifest[name][slot] = save(f'{stem}_{channel}', original+delta, quality=95)
        print(f'Veteran {name} neck: {int((weight > .01).sum())} UV texels blended')


def bake():
    manifest_path = ROOT / 'manifest_veteran.json'
    manifest = json.loads(manifest_path.read_text())
    for material, kind in [('Bronze', 'bronze'), ('Leather', 'leather')]:
        colour = periodic(pixels(ROOT / 'veteran-polish' / f'{kind}-source.png'))
        lum = colour @ np.array([.30, .59, .11])
        fine = lum - blur(lum, 3)
        if kind == 'bronze':
            oxide = np.clip((.43 - blur(lum, 4)) * 4, 0, 1)
            rough = np.clip(.51 + oxide * .23 - fine * .4, .46, .82)
            metal = np.clip(.94 - oxide * .34, .55, .96)
            original = pixels(ROOT / 'bronze_normal_veteran.jpg')
            normal = surface_normal(fine, original, 1.0, .38)
        else:
            v = np.arange(1024)[:, None] / 1023
            edge = np.clip((.055 - np.minimum(v, 1-v)) / .055, 0, 1)
            colour = colour * (1-edge[..., None]*.25) + np.array([.40, .29, .19]) * edge[..., None]*.25
            rough = np.clip(.73 - fine*.7 - edge*.10, .53, .87)
            metal = np.zeros_like(lum)
            original = pixels(ROOT / 'leather_normal_veteran.jpg')
            normal = surface_normal(fine, original, 1.8, .35)
        manifest[material].update({
            'baseColor': save(f'{kind}_color', colour),
            'normal': save(f'{kind}_normal', normal),
            'metallicRoughness': save(f'{kind}_orm', np.stack([np.ones_like(lum), rough, metal], axis=2)),
            'normalScale': 1.0,
        })
    # Keep the fitted folds; add a low-amplitude thread relief instead of more triangles.
    y, x = np.mgrid[:1024, :1024]
    weave = (np.sin(x*np.pi/2) + np.sin(y*np.pi/2)) * .014
    normal = surface_normal(weave, pixels(ROOT / 'gambeson_normal_veteran.jpg'), 1.0, 1.0)
    manifest['Gambeson']['normal'] = save('gambeson_normal', normal)
    neck_maps(manifest)
    manifest_path.write_text(json.dumps(manifest, indent=1) + '\n')
    return manifest


def refresh(glb, manifest):
    """Repack only named material image views. All geometry/animation bytes stay exact."""
    raw = glb.read_bytes()
    size = struct.unpack_from('<I', raw, 12)[0]
    doc = json.loads(raw[20:20+size])
    frozen = copy.deepcopy(doc)
    binary = raw[28+size:]
    replacement = {}
    for material in doc['materials']:
        if material['name'] not in ('Bronze', 'Leather', 'Gambeson', 'Photo', 'Face'):
            continue
        maps = manifest[material['name']]
        pbr = material['pbrMetallicRoughness']
        for key, info in [('baseColor', pbr['baseColorTexture']), ('normal', material['normalTexture']), ('metallicRoughness', pbr['metallicRoughnessTexture'])]:
            image = doc['images'][doc['textures'][info['index']]['source']]
            replacement[image['bufferView']] = (ROOT / maps[key]).read_bytes()
            assert image['mimeType'] == 'image/jpeg'
        material['normalTexture']['scale'] = maps['normalScale']
    chunks = bytearray()
    for index, view in enumerate(doc['bufferViews']):
        start = view.get('byteOffset', 0)
        payload = replacement.get(index, binary[start:start+view['byteLength']])
        chunks += b'\0' * (-len(chunks) % 4)
        view['byteOffset'], view['byteLength'] = len(chunks), len(payload)
        chunks += payload
    for key in ['nodes', 'skins', 'meshes', 'accessors', 'animations']:
        assert doc[key] == frozen[key], key
    for accessor in doc['accessors']:
        index = accessor['bufferView']
        assert index not in replacement, 'image view overlaps rig/geometry'
        old, new = frozen['bufferViews'][index], doc['bufferViews'][index]
        assert binary[old.get('byteOffset', 0):old.get('byteOffset', 0)+old['byteLength']] == chunks[new['byteOffset']:new['byteOffset']+new['byteLength']]
    doc['buffers'][0]['byteLength'] = len(chunks)
    chunks += b'\0' * (-len(chunks) % 4)
    data = json.dumps(doc, separators=(',', ':')).encode()
    data += b' ' * (-len(data) % 4)
    result = struct.pack('<5I', 0x46546C67, 2, 28+len(data)+len(chunks), len(data), 0x4E4F534A) + data + struct.pack('<2I', len(chunks), 0x004E4942) + chunks
    glb.write_bytes(result)
    print(f'Veteran materials: {len(raw)} -> {len(result)} bytes; all mesh/rig/animation accessors exact')


if __name__ == '__main__':
    refresh(Path('src/assets/veteran.glb'), bake())
