#!/usr/bin/env python3
"""Call the Frankendom Blender Space once (Armour, 2026-09-27). NO retry loop: one call, one receipt, a failure is reported and stops.
Usage: render-remote.py --space <user>/frankendom-blender --glb <file> --label <name> [--views front,back] [--size 420x720] [--samples 24] [--yaw 20] [--pitch 12]
Writes artifacts/remote-blender/<label>/{front,back}.png + receipt.json (hardware, wall seconds, $ estimate at the tier's hourly rate)."""
import argparse, json, os, shutil, time
from gradio_client import Client, handle_file
from huggingface_hub import HfApi
RATE = {'cpu-basic': 0.0, 'cpu-upgrade': 0.03, 'cpu-xl': 0.10}   # $/h, HF Spaces price list (no GPU tiers on purpose)
ap = argparse.ArgumentParser(); ap.add_argument('--space', required=True); ap.add_argument('--glb', required=True); ap.add_argument('--label', required=True)
ap.add_argument('--views', default='front,back'); ap.add_argument('--size', default='420x720'); ap.add_argument('--samples', type=int, default=24); ap.add_argument('--yaw', type=float, default=20); ap.add_argument('--pitch', type=float, default=12); ap.add_argument('--fill', type=float, default=0.9)
A = ap.parse_args(); out = f'artifacts/remote-blender/{A.label}'; os.makedirs(out, exist_ok=True)
rt = HfApi().get_space_runtime(A.space); hw = rt.hardware or 'unknown'; stage = rt.stage
w, h = (int(x) for x in A.size.split('x')); t0 = time.time()
client = Client(A.space)   # gradio_client: no automatic retry of the predict call
try:
    pngs, receipt = client.predict(handle_file(A.glb), A.views, w, h, A.samples, A.yaw, A.pitch, A.fill, api_name='/predict'); ok = True; err = None
except Exception as e:   # reported, never retried
    pngs, receipt, ok, err = [], '{}', False, repr(e)
wall = round(time.time() - t0, 1)
for i, p in enumerate(pngs or []):
    src = p['image'] if isinstance(p, dict) else p; shutil.copy(src, os.path.join(out, f"{A.views.split(',')[i] if i < len(A.views.split(',')) else i}.png"))
rec = {'space': A.space, 'hardware': hw, 'stage_before': stage, 'glb': A.glb, 'bytes': os.path.getsize(A.glb), 'views': A.views, 'size': A.size, 'samples': A.samples, 'ok': ok, 'error': err,
       'client_wall_s': wall, 'space_receipt': json.loads(receipt) if receipt else None, 'usd_estimate': round(RATE.get(hw, 0) * wall / 3600, 4), 'rate_usd_per_h': RATE.get(hw), 'at': time.strftime('%Y-%m-%dT%H:%M:%S%z')}
json.dump(rec, open(os.path.join(out, 'receipt.json'), 'w'), indent=1); print(json.dumps({k: rec[k] for k in ('hardware', 'ok', 'error', 'client_wall_s', 'usd_estimate')}), out)
