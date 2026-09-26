# Width profile of a reconstruction vs the hero rig's bones, to set a hero-set family's height and arm angle (hero-set skill, step 5).
# blender -b -P scripts/character/herolook_probe.py -- src/assets/source/creatures/<set>.glb
import bpy, sys, numpy as np
from pathlib import Path
argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
SRC = argv[0] if argv else "src/assets/source/creatures/legionary.glb"
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(Path(SRC).resolve()))
m=[o for o in bpy.data.objects if o.type=="MESH"][0]
n=len(m.data.vertices); co=np.empty(n*3); m.data.vertices.foreach_get("co",co); co=co.reshape(n,3)
M=np.array(m.matrix_world); P=co@M[:3,:3].T+M[:3,3]
lo,hi=P[:,2].min(),P[:,2].max(); H=hi-lo
print("recon z", round(lo,3), round(hi,3), "x", round(P[:,0].min(),3), round(P[:,0].max(),3), "y", round(P[:,1].min(),3), round(P[:,1].max(),3))
for f in np.arange(1.0,0.74,-0.01):
    band=P[(P[:,2]>lo+H*(f-0.01))&(P[:,2]<=lo+H*f)]
    if len(band): print(f"{f:.2f} width {band[:,0].max()-band[:,0].min():.3f} n {len(band)}")
arms=P[P[:,2]<lo+H*0.62]
for side,sel in (("L",arms[:,0].argmax()),("R",arms[:,0].argmin())): print("hand",side, np.round((arms[sel]-[0,0,lo])/H,3))
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(Path("src/assets/warrior.glb").resolve()))
rig=next(o for o in bpy.data.objects if o.type=="ARMATURE"); rig.animation_data_clear()
for p in rig.pose.bones: p.matrix_basis.identity()
bpy.context.view_layer.update()
for b in ("head","hand_l","hand_r","upperarm_l","neck_01","foot_l"):
    pb=rig.pose.bones.get(b)
    if pb: print("bone", b, np.round(np.array(rig.matrix_world @ pb.head),3), np.round(np.array(rig.matrix_world @ pb.tail),3))
