"""Cycles on the GPU, for scripts run under `node scripts/gpu-run.mjs <sha> --blender -- ...`.
   import sys; sys.path.insert(0, '/usr/local/share/gpu-run'); import cycles_gpu; cycles_gpu.enable(bpy.context.scene)
   Tries OPTIX, then CUDA; raises (so the job fails loudly) when no GPU device is usable instead of rendering on the CPU."""
import bpy


def enable(scene):
    prefs = bpy.context.preferences.addons['cycles'].preferences
    for backend in ('OPTIX', 'CUDA'):
        try:
            prefs.compute_device_type = backend
            prefs.refresh_devices() if hasattr(prefs, 'refresh_devices') else prefs.get_devices()
        except Exception as error:  # the backend is not in this build / driver
            print('CYCLES_GPU backend %s unavailable: %s' % (backend, error))
            continue
        gpus = [d for d in prefs.devices if d.type == backend]
        if not gpus:
            continue
        for d in prefs.devices:
            d.use = d.type == backend
        scene.render.engine = 'CYCLES'
        scene.cycles.device = 'GPU'
        print('CYCLES_GPU backend=%s devices=%s' % (backend, [d.name for d in gpus]))
        return backend
    raise RuntimeError('no GPU Cycles device (OPTIX/CUDA): refusing to render on the CPU')
