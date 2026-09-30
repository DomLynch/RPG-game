from huggingface_hub import HfApi,get_token
from pathlib import Path
import json,hashlib,sys
r=Path(__file__).resolve().parents[1]; script=sys.argv[1]; code=(r/'source'/script).read_text();
if len(sys.argv)>2:code=code.replace("NAME=os.environ.get('PIT_PROP','bull-skull')",'NAME='+repr(sys.argv[2]))
compile(code,script,'exec')
command="apt-get update -qq && apt-get install -y -qq libgl1 libxrender1 libxi6 libxkbcommon0 libsm6 libgomp1 >/dev/null && pip install -q bpy==4.5.3 huggingface_hub==1.8.0 scipy pillow && python - <<'PYJOB'\n"+code+"\nPYJOB"
j=HfApi().run_job(image='python:3.11-bookworm',command=['bash','-lc',command],flavor='cpu-upgrade',timeout='15m',secrets={'HF_TOKEN':get_token()},env={'HF_HUB_DISABLE_XET':'1','HF_HUB_DISABLE_PROGRESS_BARS':'1'})
d={'id':j.id,'url':j.url,'script':script,'script_sha256':hashlib.sha256(code.encode()).hexdigest(),'hardware':'cpu-upgrade','timeout_seconds':900,'fallback':'SDK token: connector OAuth lacks destination write scope'}
(r/'receipts'/('job-'+j.id+'.json')).write_text(json.dumps(d,indent=2));(r/'receipts'/('submitted-'+j.id+'.py')).write_text(code);print(json.dumps(d))
