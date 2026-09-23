"""The Dwarf's iron as loot (Brief 5, 2026-09-21). His kit is not authored parts: the TRELLIS.2 surface is one skinned mesh with one baked
material, so his pieces are cut OUT of it — the metallic channel of his baked map, sampled per vertex and smoothed over the mesh, marks the
iron; the vertex's dominant bone puts each patch in a player slot; connected patches big enough to be a piece are kept. Everything stays in
the dwarf's re-proportioned rest space with his transferred weights: build-warrior.mjs (WARRIOR_LOOT=1, loot.json "unscale") inverts the
per-bone field there, the one place that math lives. Output: src/assets/source/loot/dwarf.glb (parts contract: extras.material/slot,
skin weights) and the two maps the loot build embeds for the DwarfIron material.

  blender -b --python-exit-code 1 -P scripts/character/loot_dwarf.py -- [--family knight] [--metal 0.35] [--min-faces 120]

The Knight (Brief 17) is cut the same way from his own TRELLIS.2 surface (--family knight → knight.glb, KnightIron). His BUILD is a
uniform 1.18 root scale with no per-bone table, so his rest space is already a man's and his loot.json entries carry no `unscale`.
"""
import os
import sys
from collections import defaultdict, deque

import bmesh
import bpy
import numpy as np

args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
METAL = float(args[args.index('--metal') + 1]) if '--metal' in args else 0.35   # smoothed metallic above this is iron
MIN_FACES = int(args[args.index('--min-faces') + 1]) if '--min-faces' in args else 100   # smaller patches are texture noise, not a piece
SMOOTH = int(args[args.index('--smooth') + 1]) if '--smooth' in args else 4   # neighbour-average passes over the metallic samples
CLOSE = int(args[args.index('--close') + 1]) if '--close' in args else 0   # face rings to dilate then erode: bridges the speckle inside a plate
COLOR_SIZE = int(args[args.index('--color-size') + 1]) if '--color-size' in args else 768   # the iron's colour map edge; loot.glb's 1.5 MB cap sets it
JPEG_QUALITY = int(args[args.index('--jpeg-quality') + 1]) if '--jpeg-quality' in args else 82
RATIO = float(args[args.index('--ratio') + 1]) if '--ratio' in args else 1.0   # decimate each piece to this share of its faces (loot.glb's 1.5 MB cap)
FAMILY = args[args.index('--family') + 1] if '--family' in args else 'dwarf'   # whose TRELLIS surface to cut
# --material Steel: the piece wears loot.glb's shared untextured Steel instead of its own baked maps (the Knight: 80 KB of loot headroom)
MATERIAL = args[args.index('--material') + 1] if '--material' in args else f'{FAMILY.capitalize()}Iron'
# --all: every face is a candidate, not only the metallic ones — the Plague Doctor's carriers are leather and a waxed coat, not iron.
# --slots Helmet,Body: keep only these player slots (Recruit-2 for a masked archetype is Helmet + Body; Strategy, 2026-09-23).
ALL = '--all' in args
REMESH = float(args[args.index('--remesh-body') + 1]) if '--remesh-body' in args else 0
BODY_RATIO = float(args[args.index('--body-ratio') + 1]) if '--body-ratio' in args else 0.3
WELD = float(args[args.index('--weld') + 1]) if '--weld' in args else 1e-5   # the seam-split tolerance before decimating
SLOTS = set(args[args.index('--slots') + 1].split(',')) if '--slots' in args else None
SOURCE = os.path.abspath(f'src/assets/{FAMILY}.glb')
OUT = 'src/assets/source/loot'
# Player slot per bone: a vertex belongs to the slot of the bone that owns most of it.
# Greaves, not Legs/Boots: the player's Legs draws are his kilt and his Boots his soles — iron shins and ankle plates go OVER bare
# shins, one piece from knee to instep, like the Veteran's greaves (parts.py slot 'Greaves').
SLOT_OF = [('Head', 'Helmet'), ('neck', 'Helmet'), ('spine', 'Body'), ('pelvis', 'Body'), ('clavicle', 'Body'),
           ('upperarm', 'Arms'), ('lowerarm', 'Arms'), ('hand', 'Gloves'), ('thumb', 'Gloves'), ('index', 'Gloves'), ('middle', 'Gloves'),
           ('ring', 'Gloves'), ('pinky', 'Gloves'), ('thigh', 'Greaves'), ('calf', 'Greaves'), ('foot', 'Greaves'), ('ball', 'Greaves')]
if '--boots' in args:
    SLOT_OF = [(b, 'Boots' if b in ('foot', 'ball') else sl) for b, sl in SLOT_OF]
MIN_SLOT = int(args[args.index('--min-slot') + 1]) if '--min-slot' in args else 300   # a slot with fewer iron faces than this is speckle, not a piece


def slot_for(bone):
    for prefix, slot in SLOT_OF:
        if bone.lower().startswith(prefix.lower()):
            return slot
    raise SystemExit(f'no player slot for bone {bone}')


bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SOURCE)
body = bpy.data.objects['CreatureBody']
armature = body.find_armature()
mesh = body.data
material = mesh.materials[0]
nodes = material.node_tree.nodes
# The material's two maps: the one wired straight into Base Color is the colour; the other is the packed metallic/roughness
# (the importer routes it through a Separate Color node; metallic is its blue channel).
textures = [n for n in nodes if n.type == 'TEX_IMAGE']
albedo = next(link.from_node.image for link in nodes['Principled BSDF'].inputs['Base Color'].links if link.from_node.type == 'TEX_IMAGE')
mr = next(n.image for n in textures if n.image is not albedo)


def pixels(image):
    w, h = image.size
    a = np.empty(w * h * image.channels, dtype=np.float32)
    image.pixels.foreach_get(a)
    return a.reshape(h, w, image.channels)


M = pixels(mr)
V = len(mesh.vertices)
# The surface is split along every UV chart seam (59,770 vertices for 44,955 triangles): adjacency by index stops at the seams,
# so every vertex maps to a representative by position and the smoothing and patches run on that graph.
P = np.empty(V * 3, dtype=np.float32)
mesh.vertices.foreach_get('co', P)
_, rep = np.unique(np.round(P.reshape(V, 3), 5), axis=0, return_inverse=True)
rep = rep.ravel()
R = int(rep.max()) + 1
uv = mesh.uv_layers.active.data
metal = np.zeros(R)
count = np.zeros(R)
for loop in mesh.loops:   # per-vertex metallic: every loop's texel, averaged
    u, v = uv[loop.index].uv
    x = min(max(int(u * M.shape[1]), 0), M.shape[1] - 1)
    y = min(max(int(v * M.shape[0]), 0), M.shape[0] - 1)
    metal[rep[loop.vertex_index]] += M[y, x, 2]
    count[rep[loop.vertex_index]] += 1
metal /= np.maximum(count, 1)
# Smooth over the mesh: the TRELLIS map is speckled; neighbour averages make patches out of it.
edges = np.unique(np.sort(rep[np.array([[e.vertices[0], e.vertices[1]] for e in mesh.edges])], axis=1), axis=0)
edges = edges[edges[:, 0] != edges[:, 1]]
for _ in range(SMOOTH):
    s = metal.copy()
    n = np.ones(R)
    np.add.at(s, edges[:, 0], metal[edges[:, 1]])
    np.add.at(s, edges[:, 1], metal[edges[:, 0]])
    np.add.at(n, edges[:, 0], 1)
    np.add.at(n, edges[:, 1], 1)
    metal = s / n
iron = (np.ones_like(metal, dtype=bool) if ALL else metal > METAL)[rep]   # back to the split vertices
metal = metal[rep]
# Dominant bone per vertex from the transferred weights.
groups = {g.index: g.name for g in body.vertex_groups}
dominant = np.empty(V, dtype=object)
for v in mesh.vertices:
    best = max(v.groups, key=lambda g: g.weight, default=None)
    dominant[v.index] = groups[best.group] if best else 'pelvis'
slot = np.array([slot_for(b) for b in dominant])
# --leg-radius R (the Witch): a floor-length robe and cloak are skinned to the thigh/calf bones, so the dominant bone files them as
# Greaves/Boots. A leg piece hugs its bone: a leg-weighted vertex farther than R from every leg bone segment is robe, so it is Body.
LEG_R = float(args[args.index('--leg-radius') + 1]) if '--leg-radius' in args else None
if LEG_R is not None:
    from mathutils.geometry import intersect_point_line
    segs = [(armature.matrix_world @ b.head_local, armature.matrix_world @ b.tail_local) for b in armature.data.bones
            if b.name.split('_')[0] in ('thigh', 'calf', 'foot', 'ball')]
    def leg_dist(co):
        best = 9.0
        for a, b in segs:
            q, t = intersect_point_line(co, a, b)
            q = a if t < 0 else b if t > 1 else q
            best = min(best, (co - q).length)
        return best
    BOOT_TOP = float(args[args.index('--boot-top') + 1]) if '--boot-top' in args else 0.42
    moved = 0
    for v in mesh.vertices:
        if slot[v.index] in ('Greaves', 'Boots'):
            co = body.matrix_world @ v.co
            if leg_dist(co) > LEG_R:
                slot[v.index] = 'Body'; moved += 1
            else:   # her laced boots climb the calf, which owns them: the boot is everything on the leg below BOOT_TOP
                slot[v.index] = 'Boots' if co.z < BOOT_TOP else 'Greaves'
    print(f'LOOT leg-radius {LEG_R}: {moved} leg-weighted vertices are robe, moved to Body')
# Faces: iron where two of three corners are; patches by connectivity within one slot; the biggest patches are the pieces.
faces = [(p.index, [int(rep[v]) for v in p.vertices]) for p in mesh.polygons]   # corners by representative: seams do not split a patch
iron_rep = np.zeros(R, dtype=bool)
iron_rep[rep] = iron
slot_rep = np.empty(R, dtype=object)
slot_rep[rep] = slot
face_iron = {i: sum(iron_rep[v] for v in vs) >= 2 for i, vs in faces}
face_slot = {i: max(set(slot_rep[vs]), key=lambda s: list(slot_rep[vs]).count(s)) for i, vs in faces}
by_edge = defaultdict(list)
for i, vs in faces:
    for k in range(3):
        by_edge[tuple(sorted((vs[k], vs[(k + 1) % 3])))].append(i)
def neighbours(f):
    vs = faces[f][1]
    return [g for k in range(3) for g in by_edge[tuple(sorted((vs[k], vs[(k + 1) % 3])))] if g != f]


# Morphological closing over face adjacency: grow the iron by CLOSE rings, then shrink it back — pinholes and speckle inside a
# plate fill in, the outline returns to where it was.
for _ in range(CLOSE):
    face_iron = {i: face_iron[i] or any(face_iron[g] for g in neighbours(i)) for i, _ in faces}
for _ in range(CLOSE):
    face_iron = {i: face_iron[i] and all(face_iron[g] for g in neighbours(i)) for i, _ in faces}
seen = set()
patches = []
sizes = []
for i, _ in faces:
    if i in seen or not face_iron[i]:
        continue
    patch, queue = [], deque([i])
    seen.add(i)
    while queue:
        f = queue.popleft()
        patch.append(f)
        vs = faces[f][1]
        for k in range(3):
            for g in by_edge[tuple(sorted((vs[k], vs[(k + 1) % 3])))]:
                if g not in seen and face_iron[g] and face_slot[g] == face_slot[f]:
                    seen.add(g)
                    queue.append(g)
    if len(patch) >= MIN_FACES:
        patches.append((face_slot[i], patch))
    sizes.append((len(patch), face_slot[i]))
pieces = defaultdict(list)
for s, patch in patches:
    pieces[s] += patch
pieces = {s: f for s, f in pieces.items() if len(f) >= MIN_SLOT and (SLOTS is None or s in SLOTS)}
print('LOOT patches (faces, slot), largest first:', sorted(sizes, reverse=True)[:12])
print(f'LOOT {FAMILY}: {int(iron.sum())}/{V} iron vertices; patches kept {len(patches)} → slots ' +
      ', '.join(f'{s}:{len(f)} faces' for s, f in sorted(pieces.items())))
if not pieces:
    raise SystemExit('no iron patch big enough')
# One object per slot: the faces copied with their UVs and weights, skinned to the same armature.
kit = []
for s, face_ids in sorted(pieces.items()):
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bm.faces.ensure_lookup_table()
    keep = set(face_ids)
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.index not in keep], context='FACES')
    if True:   # weld the UV-seam splits first on every path (UVs are per-loop, so they survive), or decimating tears the piece into shards
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=WELD); bmesh.ops.dissolve_degenerate(bm, dist=WELD, edges=bm.edges[:]); bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
    me = bpy.data.meshes.new(f'{FAMILY}_{s.lower()}')
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(f'{FAMILY}_{s.lower()}', me)
    bpy.context.scene.collection.objects.link(obj)
    for g in body.vertex_groups:
        obj.vertex_groups.new(name=g.name)
    # bmesh kept the deform layer, so the vertex groups came across by index; the armature skins them.
    if s == 'Body' and REMESH:   # --remesh-body V (the Witch's ragged robe stalls collapse at 0.91): voxel shell, then collapse, then the
        src = obj.copy(); src.data = obj.data.copy(); bpy.context.scene.collection.objects.link(src)   # skin weights come back from here
        obj.modifiers.new('Shell', 'REMESH').voxel_size = REMESH
        obj.modifiers.new('Shell budget', 'DECIMATE').ratio = BODY_RATIO
        dg = bpy.context.evaluated_depsgraph_get()
        shell = bpy.data.meshes.new_from_object(obj.evaluated_get(dg), depsgraph=dg)
        for m in list(obj.modifiers): obj.modifiers.remove(m)
        obj.data = shell
        tr = obj.modifiers.new('Weights', 'DATA_TRANSFER'); tr.object = src; tr.use_vert_data = True
        tr.data_types_verts = {'VGROUP_WEIGHTS'}; tr.use_loop_data = True; tr.data_types_loops = {'UV'}; tr.loop_mapping = 'POLYINTERP_NEAREST'; tr.vert_mapping = 'POLYINTERP_NEAREST'; tr.layers_vgroup_select_src = 'ALL'; tr.layers_vgroup_select_dst = 'NAME'
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.modifier_apply(modifier='Weights')
        bpy.data.objects.remove(src, do_unlink=True)
    elif RATIO < 1:   # applied here, on the rest shape: the glTF exporter does not reliably apply a modifier stacked under a skin
        obj.modifiers.new('Loot budget', 'DECIMATE').ratio = RATIO
        bpy.context.view_layer.update()
        dec = bpy.data.meshes.new_from_object(obj.evaluated_get(bpy.context.evaluated_depsgraph_get()), preserve_all_data_layers=True, depsgraph=bpy.context.evaluated_depsgraph_get())
        obj.modifiers.remove(obj.modifiers['Loot budget']); obj.data = dec
    obj.parent = armature
    obj.modifiers.new('Armature', 'ARMATURE').object = armature
    obj['material'], obj['slot'] = MATERIAL, s
    obj.data.name = obj.name   # the exporter names meshes after their data: no .001 suffixes from the shell copy
    kit.append(obj)
# --repose DONOR (the Witch): creatures.py binds a reconstruction in its OWN A-pose (arms solved down to the scan's hands), but loot binds
# to the player's T rest. Pose her armature onto the donor's rest, bake that into every piece, and make it the rest before export.
REPOSE = args[args.index('--repose') + 1] if '--repose' in args else None
if REPOSE:
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.abspath(f'src/assets/{REPOSE}.glb'))
    donor = next(o for o in set(bpy.data.objects) - before if o.type == 'ARMATURE')
    for pb in armature.pose.bones:
        pb.matrix_basis.identity()
    for bone in armature.data.bones:   # parents first: .bones is ordered root-down
        if bone.name in donor.data.bones:
            armature.pose.bones[bone.name].matrix = armature.matrix_world.inverted() @ donor.matrix_world @ donor.data.bones[bone.name].matrix_local
            bpy.context.view_layer.update()
    for obj in kit:
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.modifier_apply(modifier='Armature')
        obj.modifiers.new('Armature', 'ARMATURE').object = armature
    bpy.context.view_layer.objects.active = armature
    bpy.ops.object.mode_set(mode='POSE')
    bpy.ops.pose.armature_apply(selected=False)
    bpy.ops.object.mode_set(mode='OBJECT')
    for o in set(bpy.data.objects) - before:
        bpy.data.objects.remove(o, do_unlink=True)
os.makedirs(OUT, exist_ok=True)
for o in bpy.context.selected_objects:
    o.select_set(False)
for o in kit + [armature]:
    o.select_set(True)
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, f'{FAMILY}.glb'), export_format='GLB', use_selection=True, export_extras=True,
                          export_apply=True, export_yup=True, export_materials='NONE', export_skins=True, export_animations=False,
                          export_normals=True, export_texcoords=True)
# The iron's own look: the baked colour (COLOR_SIZE) and the packed metallic/roughness at half that, JPEG — a fraction of the 2K WebPs the body ships.
for image, size, name in (() if MATERIAL == 'Steel' else ((albedo, COLOR_SIZE, f'{FAMILY}_iron_color.jpg'), (mr, COLOR_SIZE // 2, f'{FAMILY}_iron_orm.jpg'))):
    image.scale(size, size)
    image.filepath_raw = os.path.abspath(os.path.join(OUT, name))
    image.file_format = 'JPEG'
    bpy.context.scene.render.image_settings.quality = JPEG_QUALITY
    image.save()
for o in kit:
    print(f'PART {o.name} slot={o["slot"]} faces={len(o.data.polygons)}')
print(f'PARTS {len(kit)} → {OUT}/{FAMILY}.glb')
