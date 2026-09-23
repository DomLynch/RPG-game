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
import json
import os
import sys
from collections import defaultdict, deque

import bmesh
import bpy
from mathutils import Vector
import numpy as np

args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
METAL = float(args[args.index('--metal') + 1]) if '--metal' in args else 0.35   # smoothed metallic above this is iron
MIN_FACES = int(args[args.index('--min-faces') + 1]) if '--min-faces' in args else 100   # smaller patches are texture noise, not a piece
SMOOTH = int(args[args.index('--smooth') + 1]) if '--smooth' in args else 4   # neighbour-average passes over the metallic samples
CLOSE = int(args[args.index('--close') + 1]) if '--close' in args else 0   # face rings to dilate then erode: bridges the speckle inside a plate
COLOR_SIZE = int(args[args.index('--color-size') + 1]) if '--color-size' in args else 768   # the iron's colour map edge; loot.glb's 1.5 MB cap sets it
JPEG_QUALITY = int(args[args.index('--jpeg-quality') + 1]) if '--jpeg-quality' in args else 82
RATIO = float(args[args.index('--ratio') + 1]) if '--ratio' in args else 1.0   # decimate each piece to this share of its faces (loot.glb's 1.5 MB cap)
# Measured 2026-09-23 on the Plague Doctor's Helmet and Body (docs/character-references/loot-weld/): .12 and .3 collapse a TRELLIS piece into
# star fans and spikes, welded or not; .5 keeps the beak, hood, lapels and belts. Use .5 or higher for a carrier the player wears.
FAMILY = args[args.index('--family') + 1] if '--family' in args else 'dwarf'   # whose TRELLIS surface to cut
# --material Steel: the piece wears loot.glb's shared untextured Steel instead of its own baked maps (the Knight: 80 KB of loot headroom)
MATERIAL = args[args.index('--material') + 1] if '--material' in args else f'{FAMILY.capitalize()}Iron'
# --all: every face is a candidate, not only the metallic ones — the Plague Doctor's carriers are leather and a waxed coat, not iron.
# --slots Helmet,Body: keep only these player slots (Recruit-2 for a masked archetype is Helmet + Body; Strategy, 2026-09-23).
ALL = '--all' in args
# --all --dark .3: of those, only faces whose smoothed albedo luminance is under this — the Dwarf's leather girdle is dark, the belly
# skin around it is not, and neither is metallic, so the metal mask cannot tell them apart.
DARK = float(args[args.index('--dark') + 1]) if '--dark' in args else None
SLOTS = set(args[args.index('--slots') + 1].split(',')) if '--slots' in args else None
# --out dwarf_upper: write the pieces to <name>.glb and leave <family>.glb and the family's maps untouched (the maps are the family's,
# baked from the same surface, so a second cut shares them: the Dwarf's Helmet/Body/Arms re-cut beside his shipped Greaves/Boots).
OUT_NAME = args[args.index('--out') + 1] if '--out' in args else FAMILY
# --band Helmet:1.2:9 (repeatable): keep a slot's faces only where the face centre's rest-space height (Blender Z, metres) is in [lo, hi];
# bone-slotting alone can hand a slot the wrong region (a "Helmet" that is the face and beard, a Body that eats the arms).
BANDS = {b.split(':')[0]: tuple(map(float, b.split(':')[1:3])) for i, b in enumerate(args) if i and args[i - 1] == '--band'}
# --shift Boots:0:0:-0.05 (repeatable): move a slot's piece in his rest space (Blender X/Y/Z, metres) before export. The dwarf's per-bone
# unscale lands his boots 5.5 cm above the player's sole (measured against warrior.glb's foot-weighted skin, 2026-09-23); this is that fit.
SHIFTS = {b.split(':')[0]: tuple(map(float, b.split(':')[1:4])) for i, b in enumerate(args) if i and args[i - 1] == '--shift'}
SOURCE = os.path.abspath(f'src/assets/{FAMILY}.glb')
OUT = 'src/assets/source/loot'
# Player slot per bone: a vertex belongs to the slot of the bone that owns most of it.
# Greaves, not Legs/Boots: the player's Legs draws are his kilt and his Boots his soles — iron shins and ankle plates go OVER bare
# shins, one piece from knee to instep, like the Veteran's greaves (parts.py slot 'Greaves').
SLOT_OF = [('Head', 'Helmet'), ('neck', 'Helmet'), ('spine', 'Body'), ('pelvis', 'Body'), ('clavicle', 'Body'),
           ('upperarm', 'Arms'), ('lowerarm', 'Arms'), ('hand', 'Gloves'), ('thumb', 'Gloves'), ('index', 'Gloves'), ('middle', 'Gloves'),
           ('ring', 'Gloves'), ('pinky', 'Gloves'), ('thigh', 'Greaves'), ('calf', 'Greaves'), ('foot', 'Boots'), ('ball', 'Boots')]
MIN_SLOT = int(args[args.index('--min-slot') + 1]) if '--min-slot' in args else 300   # a slot with fewer iron faces than this is speckle, not a piece


# --slot-ratio Greaves=.2,Body=.4: a per-slot --ratio. What shreds a piece is too few faces left, so a big piece (a coat skirt) can go lower.
SLOT_RATIO = {k: float(v) for k, v in (p.split('=') for p in args[args.index('--slot-ratio') + 1].split(','))} if '--slot-ratio' in args else {}
BOOTS = '--boots' in args   # opt-in: foot/ball bones fill Boots instead of Greaves (a character with boots of his own)
# --repose warrior: his rig rests in an A-pose (the Plague Doctor: hand_l at y .99) where the player's rests in a T (1.46); loot binds to
# the player's rest, so an A-pose sleeve lands across the chest. Re-skin his surface onto src/assets/<name>.glb's rest joints first.
REPOSE = args[args.index('--repose') + 1] if '--repose' in args else None


def slot_for(bone):
    if BOOTS and bone.lower().startswith(('foot', 'ball')):
        return 'Boots'
    for prefix, slot in SLOT_OF:
        if bone.lower().startswith(prefix.lower()):
            return slot
    raise SystemExit(f'no player slot for bone {bone}')


bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SOURCE)
body = bpy.data.objects['CreatureBody']
armature = body.find_armature()
def binds(path):
    """Each joint's world bind matrix (glTF mesh space, from the skin's inverse bind matrices). Not Blender's bone
    matrices: the importer guesses their orientation from child positions, so two rigs with the same joints disagree."""
    raw = open(path, 'rb').read()
    n = int.from_bytes(raw[12:16], 'little')
    gl = json.loads(raw[20:20 + n])
    skin = gl['skins'][0]
    acc = gl['accessors'][skin['inverseBindMatrices']]
    view = gl['bufferViews'][acc['bufferView']]
    ibm = np.frombuffer(raw, dtype='<f4', count=16 * acc['count'],
                        offset=20 + n + 8 + view.get('byteOffset', 0) + acc.get('byteOffset', 0)).reshape(-1, 4, 4)
    names = {j: gl['nodes'][j]['name'] for j in skin['joints']}
    return {names[j]: np.linalg.inv(ibm[k].T) for k, j in enumerate(skin['joints'])}


if REPOSE:   # re-skin his surface onto the player's rest joints: his A-pose arms turn 62° and every piece lands on the player's frame
    his, player = binds(SOURCE), binds(os.path.abspath(f'src/assets/{REPOSE}.glb'))
    skin = {name: player[name] @ np.linalg.inv(rest) for name, rest in his.items() if name in player}
    to_z = np.array([[1, 0, 0], [0, 0, -1], [0, 1, 0]])   # glTF Y-up → Blender Z-up
    V0 = len(body.data.vertices)
    co = np.empty(V0 * 3)
    body.data.vertices.foreach_get('co', co)
    gl_co = np.c_[co.reshape(V0, 3) @ to_z, np.ones(V0)]
    out = np.zeros((V0, 3))
    total = np.zeros(V0)
    names = {g.index: g.name for g in body.vertex_groups}
    for v in body.data.vertices:
        for g in v.groups:
            if names[g.group] in skin:
                out[v.index] += g.weight * (skin[names[g.group]] @ gl_co[v.index])[:3]
                total[v.index] += g.weight
    moved = total > 0
    out[moved] /= total[moved, None]
    out[~moved] = gl_co[~moved, :3]
    body.data.vertices.foreach_set('co', (out @ to_z.T).ravel())
    body.data.update()
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
A = pixels(albedo)
V = len(mesh.vertices)
# The surface is split along every UV chart seam (59,770 vertices for 44,955 triangles): adjacency by index stops at the seams,
# so every vertex maps to a representative by position and the smoothing and patches run on that graph.
P = np.empty(V * 3, dtype=np.float32)
mesh.vertices.foreach_get('co', P)
_, rep = np.unique(np.round(P.reshape(V, 3), 5), axis=0, return_inverse=True)
rep = rep.ravel()
R = int(rep.max()) + 1
uv = mesh.uv_layers.active.data
metal = np.zeros((R, 2))   # per representative: metallic, albedo luminance
count = np.zeros(R)
for loop in mesh.loops:   # per-vertex metallic: every loop's texel, averaged
    u, v = uv[loop.index].uv
    x = min(max(int(u * M.shape[1]), 0), M.shape[1] - 1)
    y = min(max(int(v * M.shape[0]), 0), M.shape[0] - 1)
    ya, xa = min(int(v * A.shape[0]), A.shape[0] - 1), min(int(u * A.shape[1]), A.shape[1] - 1)
    metal[rep[loop.vertex_index]] += M[y, x, 2], A[max(ya, 0), max(xa, 0), :3] @ (0.2126, 0.7152, 0.0722)
    count[rep[loop.vertex_index]] += 1
metal /= np.maximum(count, 1)[:, None]
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
    metal = s / n[:, None]
metal, lum = metal[:, 0], metal[:, 1]
print(f'LOOT luminance percentiles 10/50/90: {np.percentile(lum, [10, 50, 90]).round(3)}')
iron = ((lum < DARK if DARK is not None else np.ones_like(metal, dtype=bool)) if ALL else metal > METAL)[rep]   # back to the split vertices
metal = metal[rep]
# Dominant bone per vertex from the transferred weights.
groups = {g.index: g.name for g in body.vertex_groups}
dominant = np.empty(V, dtype=object)
for v in mesh.vertices:
    best = max(v.groups, key=lambda g: g.weight, default=None)
    dominant[v.index] = groups[best.group] if best else 'pelvis'
slot = np.array([slot_for(b) for b in dominant])
# Faces: iron where two of three corners are; patches by connectivity within one slot; the biggest patches are the pieces.
faces = [(p.index, [int(rep[v]) for v in p.vertices]) for p in mesh.polygons]   # corners by representative: seams do not split a patch
iron_rep = np.zeros(R, dtype=bool)
iron_rep[rep] = iron
slot_rep = np.empty(R, dtype=object)
slot_rep[rep] = slot
face_iron = {i: sum(iron_rep[v] for v in vs) >= 2 for i, vs in faces}
face_slot = {i: max(set(slot_rep[vs]), key=lambda s: list(slot_rep[vs]).count(s)) for i, vs in faces}
for p in mesh.polygons if BANDS else ():
    band = BANDS.get(face_slot[p.index])
    if band and not band[0] <= p.center.z <= band[1]:
        face_iron[p.index] = False
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
    # Weld the UV-seam splits first, or decimating to --ratio tears the piece into shards along them. The baked maps survive:
    # bmesh keeps UVs per loop, so each corner keeps its own texel after its vertex is merged.
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    # A --band edge slices through patches the slot kept whole, leaving slivers loose beside the piece (the Dwarf's girdle: 2,639 faces
    # plus islands of 208/108/64/20/1). Once welded, an island under MIN_FACES is one of those, not a plate: drop it.
    bm.faces.ensure_lookup_table()
    seen, loose = set(), []
    for f in bm.faces:
        if f in seen:
            continue
        island, queue = [], [f]
        seen.add(f)
        while queue:
            g = queue.pop()
            island.append(g)
            for e in g.edges:
                for h in e.link_faces:
                    if h not in seen:
                        seen.add(h)
                        queue.append(h)
        if len(island) < MIN_FACES:
            loose += island
    bmesh.ops.delete(bm, geom=loose, context='FACES')
    for v in bm.verts if s in SHIFTS else ():
        v.co += Vector(SHIFTS[s])
    me = bpy.data.meshes.new(f'{FAMILY}_{s.lower()}')
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(f'{FAMILY}_{s.lower()}', me)
    bpy.context.scene.collection.objects.link(obj)
    for g in body.vertex_groups:
        obj.vertex_groups.new(name=g.name)
    # bmesh kept the deform layer, so the vertex groups came across by index; the armature skins them.
    obj.parent = armature
    obj.modifiers.new('Armature', 'ARMATURE').object = armature
    obj['material'], obj['slot'] = MATERIAL, s
    ratio = SLOT_RATIO.get(s, RATIO)
    if ratio < 1:
        obj.modifiers.new('Loot budget', 'DECIMATE').ratio = ratio
        obj.modifiers.move(len(obj.modifiers) - 1, 0)   # simplify the rest shape, then skin it
    kit.append(obj)
os.makedirs(OUT, exist_ok=True)
for o in bpy.context.selected_objects:
    o.select_set(False)
for o in kit + [armature]:
    o.select_set(True)
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, f'{OUT_NAME}.glb'), export_format='GLB', use_selection=True, export_extras=True,
                          export_apply=True, export_yup=True, export_materials='NONE', export_skins=True, export_animations=False,
                          export_normals=True, export_texcoords=True)
# The iron's own look: the baked colour (COLOR_SIZE) and the packed metallic/roughness at half that, JPEG — a fraction of the 2K WebPs the body ships.
for image, size, name in (() if MATERIAL == 'Steel' or OUT_NAME != FAMILY else ((albedo, COLOR_SIZE, f'{FAMILY}_iron_color.jpg'), (mr, COLOR_SIZE // 2, f'{FAMILY}_iron_orm.jpg'))):
    image.scale(size, size)
    image.filepath_raw = os.path.abspath(os.path.join(OUT, name))
    image.file_format = 'JPEG'
    bpy.context.scene.render.image_settings.quality = JPEG_QUALITY
    image.save()
for o in kit:
    print(f'PART {o.name} slot={o["slot"]} faces={len(o.data.polygons)}')
print(f'PARTS {len(kit)} → {OUT}/{OUT_NAME}.glb')
