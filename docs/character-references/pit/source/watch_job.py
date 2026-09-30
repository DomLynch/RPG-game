from huggingface_hub import HfApi
from pathlib import Path
import sys
job=sys.argv[1];api=HfApi();p=Path(__file__).resolve().parents[1]/'receipts'/('log-'+job+'.txt')
with p.open('w') as f:
 for entry in api.fetch_job_logs(job_id=job):
  line=entry if isinstance(entry,str) else getattr(entry,'message',str(entry));f.write(line+'\n');f.flush()
  if any(x in line for x in ['GPU ','MODEL_READY','START ','SHAPE ','SAVED','Traceback','Error','Exception','FAILED']):print(line[:700],flush=True)
print(api.inspect_job(job_id=job).status,flush=True)
