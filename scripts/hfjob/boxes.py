#!/usr/bin/env python3
"""Standing HF CPU boxes behind `hfjob --box` (Dom 2026-10-27). One private Docker Space per lane, named <owner>/<prefix><box>.
Every name, flavor, sleep time and price comes from data/hf-boxes.json (HFBOX_DATA overrides the path); nothing about a lane or a flavor lives here.
  boxes.py up NAME [--update]                 create the Space if missing, unpause it, wait until the runner answers, print the sleep-time receipt
  boxes.py run NAME --repo R --sha S --argv-b64 B [--timeout SEC] [--depth N] [--wait]
  boxes.py logs NAME ID [--follow]            boxes.py watch NAME ID (keep-alive poll until the job ends)
  boxes.py list                               boxes.py pause NAME
The token is read here, from HF_TOKEN or /root/.hf/token, and is only ever sent to the Hub as a bearer header. It is never printed or put on a command line."""
import argparse, json, os, subprocess, sys, tempfile, time, urllib.error, urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
DATA = Path(os.environ.get('HFBOX_DATA') or HERE.parent.parent / 'data' / 'hf-boxes.json')
cfg = json.loads(DATA.read_text())


def die(msg, code=1):
    print(f'hfjob: {msg}', file=sys.stderr)
    sys.exit(code)


def token():
    t = os.environ.get('HF_TOKEN')
    if not t and os.access('/root/.hf/token', os.R_OK):
        t = Path('/root/.hf/token').read_text().strip()
    return t or die('no HF token (HF_TOKEN unset and /root/.hf/token unreadable)')


def space_id(name):
    if name not in cfg['boxes']:
        die(f"unknown box '{name}'; boxes in {DATA.name}: {', '.join(cfg['boxes'])} (add a key there to make a new one)", 2)
    return f"{cfg['owner']}/{cfg['prefix']}{name}"


def api():
    from huggingface_hub import HfApi
    return HfApi(token=token())


def base_url(sid):
    if os.environ.get('HFBOX_URL'):   # tests point this at a local runner
        return os.environ['HFBOX_URL'].rstrip('/')
    return f"https://{sid.replace('/', '-').replace('_', '-').lower()}.hf.space"


def http(sid, path, body=None, retries=1):
    req = urllib.request.Request(base_url(sid) + path, data=None if body is None else json.dumps(body).encode(), method='GET' if body is None else 'POST')
    req.add_header('Authorization', f'Bearer {token()}')
    if body is not None:
        req.add_header('content-type', 'application/json')
    for i in range(retries):
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                return r.status, dict(r.headers), r.read()
        except urllib.error.HTTPError as e:
            if e.code in (400, 404):
                return e.code, dict(e.headers), e.read()
            err = e
        except (urllib.error.URLError, TimeoutError, ConnectionError) as e:
            err = e
        time.sleep(min(10, 2 + i))
    die(f'box {sid} did not answer {path}: {err}')


def box_files(tmp):
    box = HERE / 'box'
    (tmp / 'Dockerfile').write_text((box / 'Dockerfile.tmpl').read_text().replace('__PORT__', str(cfg['port'])))
    (tmp / 'runner.mjs').write_text((box / 'runner.mjs').read_text())
    (tmp / 'inner.sh').write_text((HERE / 'inner.sh').read_text())
    (tmp / 'README.md').write_text(f"---\ntitle: {{BOX}}\nsdk: docker\napp_port: {cfg['port']}\npinned: false\n---\nStanding HF CPU box for `hfjob --box`. Private. Managed by scripts/hfjob/boxes.py.\n")


def receipt(a, sid):
    rt = a.get_space_runtime(sid)
    want = cfg['sleepMinutes'] * 60
    if getattr(rt, 'sleep_time', None) != want:
        a.set_space_sleep_time(sid, want)
        rt = a.get_space_runtime(sid)
    if getattr(rt, 'sleep_time', None) != want:
        die(f'{sid} sleep_time is {getattr(rt, "sleep_time", None)}, wanted {want}; the kill switch is NOT set')
    return rt


def up(name, update=False):
    sid, a = space_id(name), api()
    fresh = not a.repo_exists(sid, repo_type='space')
    if fresh:
        a.create_repo(sid, repo_type='space', space_sdk='docker', space_hardware=cfg['flavor'], space_sleep_time=cfg['sleepMinutes'] * 60, private=True)
    if fresh or update:
        with tempfile.TemporaryDirectory() as d:
            tmp = Path(d)
            box_files(tmp)
            (tmp / 'README.md').write_text((tmp / 'README.md').read_text().replace('{BOX}', f"{cfg['prefix']}{name}"))
            a.upload_folder(repo_id=sid, repo_type='space', folder_path=str(tmp), commit_message='box runner')
    rt = a.get_space_runtime(sid)
    if str(rt.stage) == 'PAUSED':
        a.restart_space(sid)
    deadline = time.time() + cfg['readyTimeoutSeconds']
    while True:
        stage = str(a.get_space_runtime(sid).stage)
        if stage.endswith('_ERROR'):
            die(f'{sid} is in {stage}; see https://huggingface.co/spaces/{sid}')
        try:
            req = urllib.request.Request(base_url(sid) + '/health', headers={'Authorization': f'Bearer {token()}'})
            with urllib.request.urlopen(req, timeout=30) as r:
                if r.status == 200:
                    break
        except (urllib.error.URLError, TimeoutError, ConnectionError):
            pass
        if time.time() > deadline:
            die(f'{sid} not ready after {cfg["readyTimeoutSeconds"]}s (stage {stage})')
        time.sleep(5)
    rt = receipt(a, sid)
    print(f'box={name} space={sid} stage={rt.stage} hardware={rt.hardware} sleep_time={rt.sleep_time}s created={"yes" if fresh else "no"}')
    return sid


def follow(sid, jid, live):
    off = 0
    while True:
        _, h, body = http(sid, f'/logs/{jid}?from={off}', retries=5)
        sys.stdout.write(body.decode('utf8', 'replace')); sys.stdout.flush()
        off = int(h.get('x-next-offset', off))
        state = h.get('x-job-state', '')
        if state != 'running' and not body:
            return state, h.get('x-job-exit', '')
        if not live and not body:
            return state, ''
        time.sleep(2 if live else 0)


def run(name, repo, sha, argv_b64, timeout, depth, wait):
    sid = space_id(name)
    payload = {'repo': repo, 'sha': sha, 'depth': depth, 'argv_b64': argv_b64, 'timeout': timeout}
    if os.environ.get('HFJOB_DRY') == '1':
        print(f'box run {sid}: {json.dumps(payload)}')
        return
    up(name)
    code, _, body = http(sid, '/run', payload, retries=5)
    res = json.loads(body)
    if code != 200:
        die(f"box refused the run: {res.get('error')}")
    jid = res['id']
    print(f"tier=hf-box box={name} repo={repo.split('github.com/')[-1].removesuffix('.git')} sha={sha[:12]} job={jid}")
    print(f'space: https://huggingface.co/spaces/{sid}   follow: hfjob box-logs {name} {jid}')
    if wait:
        state, code = follow(sid, jid, True)
        print(f'job {jid} {state} exit={code}')
        sys.exit(0 if state == 'done' else 1)
    # fire and forget: a detached watcher keeps traffic flowing so the Hub's idle timer does not sleep the box mid-run (the token goes in the env, not argv)
    subprocess.Popen([sys.executable, str(Path(__file__).resolve()), 'watch', name, jid], env=dict(os.environ, HF_TOKEN=token()), stdin=subprocess.DEVNULL,
                     stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True)


def watch(name, jid):
    sid = space_id(name)
    while True:
        _, _, body = http(sid, f'/status/{jid}', retries=5)
        if json.loads(body).get('state') != 'running':
            return
        time.sleep(cfg['pollSeconds'])


def listing():
    a = api()
    total = 0.0
    print(f"{'box':<12}{'space':<28}{'stage':<18}{'sleep':<8}{'$/day now':<10}lane")
    for name, row in cfg['boxes'].items():
        sid = space_id(name)
        try:
            rt = a.get_space_runtime(sid)
            stage, sleep = str(rt.stage), f'{(rt.sleep_time or 0) // 60}m'
        except Exception as e:  # noqa: BLE001 - a missing Space is a normal row
            stage, sleep = ('ABSENT' if '404' in str(e) else 'ERROR'), '-'
        cost = cfg['pricePerHour'] * 24 if stage in cfg['awakeStages'] else 0.0
        total += cost
        print(f"{name:<12}{sid:<28}{stage:<18}{sleep:<8}{cost:<10.2f}{row['lane']}")
    print(f"awake cost if left running 24h: ${total:.2f}/day (sleeping or paused boxes cost $0)")


def pause(name):
    sid = space_id(name)
    api().pause_space(sid)
    print(f'box={name} space={sid} paused')


def main():
    p = argparse.ArgumentParser()
    s = p.add_subparsers(dest='op', required=True)
    u = s.add_parser('up'); u.add_argument('name'); u.add_argument('--update', action='store_true')
    r = s.add_parser('run'); r.add_argument('name')
    for k in ('--repo', '--sha', '--argv-b64'):
        r.add_argument(k, required=True)
    r.add_argument('--timeout', type=int, default=cfg['defaultTimeoutSeconds']); r.add_argument('--depth', type=int, default=1); r.add_argument('--wait', action='store_true')
    l = s.add_parser('logs'); l.add_argument('name'); l.add_argument('id'); l.add_argument('--follow', action='store_true')
    w = s.add_parser('watch'); w.add_argument('name'); w.add_argument('id')
    s.add_parser('list')
    z = s.add_parser('pause'); z.add_argument('name')
    a = p.parse_args()
    if a.op == 'up': up(a.name, a.update)
    elif a.op == 'run': run(a.name, a.repo, a.sha, a.argv_b64, a.timeout, a.depth, a.wait)
    elif a.op == 'logs': follow(space_id(a.name), a.id, a.follow)
    elif a.op == 'watch': watch(a.name, a.id)
    elif a.op == 'list': listing()
    elif a.op == 'pause': pause(a.name)


if __name__ == '__main__':
    main()
