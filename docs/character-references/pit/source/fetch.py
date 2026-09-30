from pathlib import Path
from huggingface_hub import HfApi,get_token,hf_hub_url
import urllib.request,sys,json
r=Path(__file__).resolve().parents[1];api=HfApi();repo='Domlynch/frankendom-pit-room-20260930';rev=api.repo_info(repo,repo_type='dataset').sha;prefix=sys.argv[1]
files=[p for p in api.list_repo_files(repo,repo_type='dataset',revision=rev) if p.startswith(prefix+'/')]
for name in files:
 p=r/name;p.parent.mkdir(parents=True,exist_ok=True);req=urllib.request.Request(hf_hub_url(repo,name,repo_type='dataset',revision=rev),headers={'Authorization':'Bearer '+get_token()})
 with urllib.request.urlopen(req,timeout=120) as f:p.write_bytes(f.read())
print(json.dumps({'revision':rev,'files':len(files),'prefix':prefix}))
