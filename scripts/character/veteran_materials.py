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


def save(name, rgb):
    assert np.isfinite(rgb).all(), name
    if name.endswith('_orm'):
        rgb = rgb.reshape(512, 2, 512, 2, 3).mean(axis=(1, 3))
    h, w = rgb.shape[:2]
    image = bpy.data.images.new(name, width=w, height=h, alpha=False)
    image.colorspace_settings.name = 'Non-Color'
    image.pixels.foreach_set(np.concatenate([np.clip(rgb, 0, 1), np.ones((h, w, 1))], axis=2).astype(np.float32).ravel())
    image.file_format = 'JPEG'
    filename = f'{name}_polish_veteran.jpg'
    image.save(filepath=str(ROOT / filename), quality=88)
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
        if material['name'] not in ('Bronze', 'Leather', 'Gambeson'):
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
