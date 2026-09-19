"""Offline anatomy pilots. blender -b -P scripts/character/pilots.py

Original geometry over committed Frankendom GLBs. Append geometry to their binary
payload: existing animation, inverse binds, images and weapons remain byte exact.
No roster entry. Editable .blend files and GLBs go to artifacts/character/pilots.
"""
import copy
import hashlib
import json
import math
from pathlib import Path
import struct

import bpy
from mathutils import Vector

OUT = Path('artifacts/character/pilots')
OUT.mkdir(parents=True, exist_ok=True)


def read_glb(path):
    raw = Path(path).read_bytes()
    size = struct.unpack_from('<I', raw, 12)[0]
    return json.loads(raw[20:20 + size]), raw[28 + size:]


def write_glb(path, doc, data):
    doc['buffers'] = [{'byteLength': len(data)}]
    header = json.dumps(doc, separators=(',', ':')).encode()
    header += b' ' * (-len(header) % 4)
    data += b'\0' * (-len(data) % 4)
    path.write_bytes(struct.pack('<III', 0x46546c67, 2, 28 + len(header) + len(data)) +
                     struct.pack('<II', len(header), 0x4e4f534a) + header +
                     struct.pack('<II', len(data), 0x004e4942) + data)


def xyz(p):
    """Author in game's X/right, Y/up, Z/front; Blender uses Z/up."""
    return Vector((p[0], -p[2], p[1]))


def material(name, color, rough=.8, metal=0):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*color, 1)
    bsdf.inputs['Roughness'].default_value = rough
    bsdf.inputs['Metallic'].default_value = metal
    m['roughness'], m['metallic'] = rough, metal
    return m


def finish(obj, name, mat):
    obj.name = name
    obj.data.materials.clear()
    obj.data.materials.append(mat)
    for poly in obj.data.polygons:
        poly.use_smooth = True
    return obj


def ellipsoid(name, pos, scale, mat, segments=24):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=12, location=xyz(pos))
    o = bpy.context.object
    o.scale = (scale[0], scale[2], scale[1])
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    return finish(o, name, mat)


def sweep(name, points, radii, mat, sides=18):
    vs, fs = [], []
    for i, p in enumerate(points):
        tangent = xyz(points[min(i + 1, len(points) - 1)]) - xyz(points[max(0, i - 1)])
        tangent.normalize()
        u = tangent.cross(Vector((0, 1, 0)))
        if u.length < .01:
            u = tangent.cross(Vector((1, 0, 0)))
        u.normalize()
        v = tangent.cross(u).normalized()
        for j in range(sides):
            a = j * math.tau / sides
            ridge = 1 + .025 * math.sin(i * 2.6)  # restrained growth ridges
            vs.append(xyz(p) + (u * math.cos(a) + v * math.sin(a)) * radii[i] * ridge)
    for i in range(len(points) - 1):
        for j in range(sides):
            a, b = i * sides + j, i * sides + (j + 1) % sides
            fs.append((a, b, b + sides, a + sides))
    fs += [tuple(reversed(range(sides))), tuple(range((len(points) - 1) * sides, len(points) * sides))]
    return mesh(name, vs, fs, mat)


def mesh(name, vs, fs, mat):
    data = bpy.data.meshes.new(name)
    data.from_pydata(vs, [], fs)
    data.update()
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    return finish(obj, name, mat)


def unify(parts, name, mat, voxel=.004):
    bpy.ops.object.select_all(action='DESELECT')
    for o in parts:
        o.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    o = bpy.context.object
    remesh = o.modifiers.new('Continuous sculpt', 'REMESH')
    remesh.mode, remesh.voxel_size = 'VOXEL', voxel
    bpy.ops.object.modifier_apply(modifier=remesh.name)
    smooth = o.modifiers.new('Sculpt blend', 'SMOOTH')
    smooth.factor, smooth.iterations = .8, 14
    bpy.ops.object.modifier_apply(modifier=smooth.name)
    dec = o.modifiers.new('Review mesh', 'DECIMATE')
    dec.ratio = .24
    bpy.ops.object.modifier_apply(modifier=dec.name)
    return finish(o, name, mat)


def interpolate(profiles, q):
    i = min(int(q), len(profiles) - 2)
    t = q - i
    a, b, c, d = [profiles[max(0, min(len(profiles) - 1, j))] for j in [i - 1, i, i + 1, i + 2]]
    return [.5 * (2 * b[k] + (-a[k] + c[k]) * t + (2*a[k] - 5*b[k] + 4*c[k] - d[k])*t*t + (-a[k] + 3*b[k] - 3*c[k] + d[k])*t*t*t) for k in range(len(b))]


def minotaur():
    hide = material('Bull hide', (.027, .019, .012), .94)
    muzzle = material('Muzzle', (.008, .006, .005), .6)
    horn = material('Worn horn', (.17, .135, .079), .8)
    dark = material('Crease', (.002, .0015, .001), .92)
    eye = material('Amber eye', (.043, .022, .007), .38)
    # Continuous anatomical cross sections: broad poll, tapered bridge, squared muzzle.
    profiles = [(-.14, 1.775, .018, .048), (-.10, 1.77, .12, .139),
                (-.025, 1.77, .158, .168), (.07, 1.75, .146, .163),
                (.15, 1.741, .124, .10), (.215, 1.715, .118, .071),
                (.264, 1.705, .135, .062), (.295, 1.701, .124, .053),
                (.311, 1.701, .006, .008)]
    vs, fs = [], []
    rows, cols = 80, 64
    for i in range(rows + 1):
        z, cy, rx, ry = interpolate(profiles, i / rows * (len(profiles) - 1))
        for j in range(cols):
            a = j * math.tau / cols
            # Broad frontal planes instead of a spherical forehead and cheeks.
            c, s = math.cos(a), math.sin(a)
            x = rx * math.copysign(abs(c) ** .83, c)
            y = cy + ry * math.copysign(abs(s) ** .88, s)
            brow = .016 * math.exp(-((z - .072)/.054)**2 - ((abs(x) - .115)/.04)**2 - ((y - 1.80)/.06)**2)
            vs.append(xyz((x, y + brow, z)))
    for i in range(rows):
        for j in range(cols):
            a, b = i * cols + j, i * cols + (j + 1) % cols
            fs.append((a, b, b + cols, a + cols))
    fs.extend([tuple(reversed(range(cols))), tuple(range(rows * cols, (rows + 1) * cols))])
    skull = mesh('Bovine skull', vs, fs, hide)
    neck = ellipsoid('Neck', (0, 1.565, -.033), (.148, .205, .118), hide)
    sculpt = unify([skull, neck], 'Bull head and neck', hide)
    for side in [-1, 1]:
        cutter = ellipsoid('Socket cutter', (side * .14, 1.795, .094), (.031, .022, .035), dark)
        bpy.context.view_layer.objects.active = sculpt
        mod = sculpt.modifiers.new('Recessed orbit', 'BOOLEAN')
        mod.operation, mod.object = 'DIFFERENCE', cutter
        bpy.ops.object.modifier_apply(modifier=mod.name)
        bpy.data.objects.remove(cutter, do_unlink=True)
    nose = ellipsoid('Nasal leather', (0, 1.696, .294), (.125, .052, .049), muzzle)
    for v in nose.data.vertices:
        # Flatten the nasal plane and preserve broad upper corners.
        p = v.co
        if -p.y > .324:
            p.y = -.324 - (-p.y - .324) * .3
    sweep('Mouth seam', [(-.105, 1.658, .275), (-.06, 1.648, .308), (0, 1.646, .321), (.06, 1.648, .308), (.105, 1.658, .275)], [.0025] * 5, dark, 8)
    for side in [-1, 1]:
        ellipsoid('Nostril', (side * .079, 1.713, .329), (.026, .013, .004), dark)
        ellipsoid('Eye socket', (side * .135, 1.795, .09), (.022, .013, .024), dark)
        ellipsoid('Eye', (side * .145, 1.793, .101), (.014, .010, .013), eye)
        sweep('Upper lid', [(side * .123, 1.804, .12), (side * .144, 1.809, .104), (side * .158, 1.797, .077)], [.01, .01, .008], hide, 12)
        # Horizontal ears with a cupped, tapered leaf profile.
        vs, fs = [], []
        for i in range(17):
            t = i / 16
            for j in range(13):
                a = math.tau * j / 12
                width = .045 * math.sin(math.pi * t) ** .7
                vs.append(xyz((side * (.125 + .20 * t), 1.795 - .022 * t + width * math.cos(a), -.008 + .022 * t + width * .42 * math.sin(a))))
        for i in range(16):
            for j in range(12):
                a = i * 13 + j
                fs.append((a, a + 1, a + 14, a + 13))
        mesh('Ear', vs, fs, hide)
        points, radii = [], []
        for i in range(41):
            t = i / 40
            points.append((side * (.122 + .22 * math.sin(t * 1.85)), 1.873 - .015 * t + .22 * t * t, -.035 - .12 * math.sin(t * math.pi) + .07 * t))
            radii.append(max(.001, .046 * (1 - t) ** .78))
        sweep('Horn', points, radii, horn, 16)
    # Short coarse crest: layered tapered locks, with a clear poll and jaw outline.
    for i in range(23):
        x = (i % 7 - 3) * .026
        y = 1.89 - (i // 7) * .035
        z = .014 - (i // 7) * .021
        sweep('Poll lock', [(x, y, z), (x * .95, y - .035, z + .04), (x * .85, y - .077, z + .05)], [.015, .012, .001], hide, 9)


def wraith():
    linen = material('Burial linen', (.015, .019, .017), .98)
    seam = material('Frayed hem', (.03, .033, .025), 1)
    # Open front cowl: top is rounded, the opening widens toward the shoulder mantle.
    vs, fs = [], []
    rows, cols = 36, 64
    profiles = [(1.27, .27, .172, .12), (1.45, .245, .17, .37),
                (1.63, .157, .186, .76), (1.77, .147, .187, .65),
                (1.86, .10, .135, .4), (1.892, .008, .014, .05)]
    for row in range(rows + 1):
        q = row / rows * (len(profiles) - 1)
        h, rx, rz, gap = interpolate(profiles, q)
        for col in range(cols + 1):
            angle = gap + (math.tau - 2 * gap) * col / cols
            fold = .005 * math.sin(angle * 13 + row * .07) + .002 * math.sin(angle * 23 - row * .21)
            rag = (.012 * math.sin(angle * 9) + .007 * math.cos(angle * 17)) * max(0, 1 - row / 5)
            vs.append(xyz(((rx + fold) * math.sin(angle), h + rag, (rz + fold) * math.cos(angle) + .018)))
    for row in range(rows):
        for col in range(cols):
            a = row * (cols + 1) + col
            fs.append((a, a + 1, a + cols + 2, a + cols + 1))
    obj = mesh('Open burial cowl', vs, fs, linen)
    bpy.context.view_layer.objects.active = obj
    mod = obj.modifiers.new('Turned cloth edge', 'SOLIDIFY')
    mod.thickness = .003
    bpy.ops.object.modifier_apply(modifier=mod.name)
    # Explicit hems around the face; no texture trick concealing the silhouette.
    for side in [0, cols]:
        pts = [vs[r * (cols + 1) + side] for r in range(rows + 1)]
        sweep('Cowl hem', [(p.x, p.z, -p.y) for p in pts], [.003] * len(pts), seam, 8)


def append_geometry(doc, payload, obj, material_index, skin, bones):
    """Append a mesh in unscaled rest space, weighted to the original rig."""
    obj.data.calc_loop_triangles()
    positions, normals, joints, weights, indices = [], [], [], [], []
    for v in obj.data.vertices:
        p = obj.matrix_world @ v.co
        positions.extend((p.x, p.z, -p.y))
        n = obj.matrix_world.to_3x3() @ v.normal
        normals.extend((n.x, n.z, -n.y))
        height = p.z
        # Smooth neck transition; cowl mantle follows the chest, crown follows Head.
        head = max(0, min(1, (height - 1.55) / .11))
        chest = max(0, min(1, (1.55 - height) / .13))
        joints.extend((bones['Head'], bones['neck_01'], bones['spine_03'], 0))
        weights.extend((head, 1 - head - chest, chest, 0))
    for t in obj.data.loop_triangles:
        indices.extend(t.vertices)

    def accessor(values, typ, fmt, component, count, bounds=False):
        payload.extend(b'\0' * (-len(payload) % 4))
        raw = struct.pack('<' + fmt * len(values), *values)
        view = len(doc['bufferViews'])
        doc['bufferViews'].append({'buffer': 0, 'byteOffset': len(payload), 'byteLength': len(raw)})
        payload.extend(raw)
        desc = {'bufferView': view, 'componentType': component, 'count': count, 'type': typ}
        if bounds:
            desc.update(min=[min(values[i::3]) for i in range(3)], max=[max(values[i::3]) for i in range(3)])
        idx = len(doc['accessors'])
        doc['accessors'].append(desc)
        return idx

    count = len(positions) // 3
    attrs = {'POSITION': accessor(positions, 'VEC3', 'f', 5126, count, True),
             'NORMAL': accessor(normals, 'VEC3', 'f', 5126, count),
             'JOINTS_0': accessor(joints, 'VEC4', 'H', 5123, count),
             'WEIGHTS_0': accessor(weights, 'VEC4', 'f', 5126, count)}
    idx = accessor(indices, 'SCALAR', 'I', 5125, len(indices))
    m = len(doc['meshes'])
    doc['meshes'].append({'name': obj.name, 'primitives': [{'attributes': attrs, 'indices': idx, 'material': material_index}]})
    n = len(doc['nodes'])
    doc['nodes'].append({'name': obj.name, 'mesh': m, 'skin': skin, 'extras': {'pilot': True}})
    # Same parent as the base skinned meshes, preserving its root scale.
    parent = next(node for node in doc['nodes'] if any('skin' in doc['nodes'][c] for c in node.get('children', [])))
    parent['children'].append(n)
    return len(indices) // 3


def build(name, base):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    globals()[name]()
    # One added draw per material, not one draw per horn/eye/fur lock.
    for mat in list(bpy.data.materials):
        pieces = [o for o in bpy.data.objects if o.type == 'MESH' and o.data.materials[0] == mat]
        if not pieces:
            continue
        bpy.ops.object.select_all(action='DESELECT')
        for obj in pieces:
            obj.select_set(True)
        bpy.context.view_layer.objects.active = pieces[0]
        bpy.ops.object.join()
        pieces[0].name = f'{name}_{mat.name}'
    source_path = Path(f'src/assets/{base}.glb')
    doc, original = read_glb(source_path)
    frozen = copy.deepcopy(doc)
    data = bytearray(original)
    removed = {'Ruby'} if name == 'wraith' else {'Face', 'Photo', 'PhotoEyes', 'PhotoTeeth', 'Bone', 'BoneWorn'}
    for node in doc['nodes']:
        if node.get('name') in removed and 'mesh' in node:
            del node['mesh']
            node.pop('skin', None)
    tint = {'Skin': (.62, .64, .62, 1), 'Photo': (.65, .68, .66, 1), 'Face': (.65, .68, .66, 1),
            'Heraldry': (.065, .061, .052, 1), 'Gambeson': (.13, .125, .11, 1)} if name == 'wraith' else {
                'Skin': (.39, .255, .15, 1), 'Heraldry': (.16, .12, .075, 1)}
    for m in doc['materials']:
        if m.get('name') in tint:
            m.setdefault('pbrMetallicRoughness', {})['baseColorFactor'] = tint[m['name']]
    materials = {}
    triangles = 0
    skin = next(n['skin'] for n in doc['nodes'] if n.get('name') == 'Skin')
    bones = {doc['nodes'][node]['name']: i for i, node in enumerate(doc['skins'][skin]['joints'])}
    for obj in list(bpy.data.objects):
        if obj.type != 'MESH':
            continue
        mat = obj.data.materials[0]
        if mat.name not in materials:
            materials[mat.name] = len(doc['materials'])
            doc['materials'].append({'name': mat.name, 'doubleSided': name == 'wraith',
                                    'pbrMetallicRoughness': {'baseColorFactor': list(mat.diffuse_color),
                                    'roughnessFactor': mat['roughness'], 'metallicFactor': mat['metallic']}})
        triangles += append_geometry(doc, data, obj, materials[mat.name], skin, bones)
    doc.setdefault('extras', {})['characterPilot'] = {'family': name, 'base': base, 'stage': 'anatomy-review',
                                                    'sourceSha256': hashlib.sha256(source_path.read_bytes()).hexdigest()}
    # Strong preservation checks: no original accessor, skin or animation is rewritten.
    for field in ['animations', 'skins', 'images', 'textures', 'samplers']:
        assert doc.get(field) == frozen.get(field), field
    assert doc['accessors'][:len(frozen['accessors'])] == frozen['accessors']
    assert data[:len(original)] == original
    write_glb(OUT / f'{name}.glb', doc, bytes(data))
    bpy.ops.wm.save_as_mainfile(filepath=str((OUT / f'{name}-authored.blend').resolve()))
    print(f'PILOT {name}: {triangles} added triangles; original motion, bind matrices, weapon and textures preserved')


build('wraith', 'nightborn')
build('minotaur', 'pitborn')
