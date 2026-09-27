#!/usr/bin/env python3
"""Create or update the PRIVATE Frankendom Blender Space (Armour, 2026-09-27). Needs the HF login (`hf auth login`); prints no token.
Guards (Dom via Lead 22:4x): hardware cpu-upgrade at most (never GPU), sleep-on-idle 15 min set BEFORE the first render, private repo.
Usage: space-up.py --space <user>/frankendom-blender [--hardware cpu-basic|cpu-upgrade]"""
import argparse, os
from huggingface_hub import HfApi
ap = argparse.ArgumentParser(); ap.add_argument('--space', required=True); ap.add_argument('--hardware', default='cpu-upgrade', choices=['cpu-basic', 'cpu-upgrade']); A = ap.parse_args()
api = HfApi(); here = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'space')
api.create_repo(A.space, repo_type='space', space_sdk='docker', private=True, exist_ok=True)
api.upload_folder(repo_id=A.space, repo_type='space', folder_path=here, commit_message='remote blender endpoint')
api.set_space_sleep_time(A.space, sleep_time=900)          # 15 min idle → sleeping, before any render
api.request_space_hardware(A.space, A.hardware)
rt = api.get_space_runtime(A.space); print('space', A.space, 'stage', rt.stage, 'hardware', rt.hardware, 'requested', A.hardware, 'sleep 900 s, private')
