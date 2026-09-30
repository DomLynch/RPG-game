from pathlib import Path
import json,math
from huggingface_hub import HfApi
R=Path(__file__).resolve().parents[1];p=R/'receipts/compute-ledger.json';ids={j['id'] for j in json.loads(p.read_text())['jobs']}
for f in (R/'receipts').glob('job*.json'):
 d=json.loads(f.read_text())
 if d.get('id'):ids.add(d['id'])
api=HfApi();rows=[]
for i in sorted(ids):
 j=api.inspect_job(job_id=i);seconds=(j.finished_at-j.created_at).total_seconds() if j.finished_at else None;rate=2.75 if i=='6abcef50031314b69634485f' else .03
 rows.append({'id':i,'status':j.status.stage,'created':str(j.created_at),'started':str(j.started_at),'finished':str(j.finished_at),'elapsed_ceiling_seconds':seconds,'hourly_usd':rate,'estimated_upper_compute_usd':math.ceil(seconds/60)*rate/60 if seconds is not None else None})
p.write_text(json.dumps({'basis':'Ceiling estimate includes queue time, rounded up per minute. Not an invoice. Space calls and subscriptions excluded.','jobs':rows},indent=2));print({'jobs':len(rows),'active':[r['id'] for r in rows if r['status'] not in ['COMPLETED','ERROR','CANCELED','CANCELLED','DELETED']],'estimated_upper_compute_usd':sum(r['estimated_upper_compute_usd'] or 0 for r in rows)})
