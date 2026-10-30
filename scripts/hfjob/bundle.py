#!/usr/bin/env python3
"""hfjob --bundle helper: pack a private checkout, scan it, move it through a PRIVATE HF dataset repo, collect results.

  bundle.py pack  --root DIR --out TAR [--include P]... [--exclude G]... [--max-mb N]   (no network, no token; runs on the Mac and on the VPS)
  bundle.py scan  TAR [--max-mb N]                                                       (re-scan a tarball; the VPS does this to anything the Mac sends)
  bundle.py upload TAR --id UUID                                                         (token from HF_TOKEN; private repo only)
  bundle.py collect JOB_ID [--out DIR] [--wait SECS]                                     (token from HF_TOKEN; downloads results/<JOB_ID>.tar.gz, extracts, deletes it)
  bundle.py collect JOB_ID --stdout                                                      (VPS side of a Mac collect: stream the tarball, then delete it)
  bundle.py extract --out DIR                                                            (safe extract of a tarball on stdin; the Mac side of a collect)
  bundle.py batch FILE --script PATH                                                     (each non-comment line = one `PATH args...` call, run concurrently, printed in order)
  bundle.py collect-all SPEC --out DIR --script PATH [--wait SECS]                       (SPEC = file or comma list of job ids / `tier=hf-cpu job=<id>` lines; each lands in DIR/<id>)
  bundle.py drop UUID                                                                    (delete bundles/<UUID>.tar.gz; used when a submit fails)

Refusals exit 2 and say why. The token is read from the environment by huggingface_hub only; it is never printed, never in argv, never in the bundle.
"""
import argparse, fnmatch, io, json, os, re, subprocess, sys, tarfile, time

HERE = os.path.dirname(os.path.realpath(__file__))
DEFAULT_MAX_MB = 500
# names that never enter a bundle (matched on every path component and on the full path)
ALWAYS_EXCLUDE = [".git", "node_modules", ".env", ".env.*", "*.pem", "*.key", "*.p12", "*.pfx", "id_*", "credentials*", "secrets*", ".npmrc", ".netrc",
                  ".git-credentials", ".pypirc", ".aws", ".ssh", ".docker", "*.token", "token", "token.txt", "hf_token*", "*.keystore", "hfjob-out"]
# content that makes a file refuse the whole bundle
SECRET_PATTERNS = [
    (re.compile(rb"hf_[A-Za-z0-9]{30,}"), "Hugging Face token"),
    (re.compile(rb"gh[pousr]_[A-Za-z0-9]{30,}"), "GitHub token"),
    (re.compile(rb"github_pat_[A-Za-z0-9_]{40,}"), "GitHub fine-grained token"),
    (re.compile(rb"sk-[A-Za-z0-9_-]{32,}"), "API secret key (sk-...)"),
    (re.compile(rb"AKIA[0-9A-Z]{16}"), "AWS access key id"),
    (re.compile(rb"-----BEGIN (?:[A-Z]+ )*PRIVATE KEY-----"), "private key header"),
    (re.compile(rb"xox[abprs]-[A-Za-z0-9-]{20,}"), "Slack token"),
]
SCAN_MAX_FILE = 8 * 1024 * 1024   # content-scan the first 8 MB of every file; larger binaries are checked by name only beyond that
CRED_NAMES = [".env", ".env.*", "*.pem", "*.key", "*.p12", "*.pfx", "id_rsa*", "id_ed25519*", "id_ecdsa*", "id_dsa*", "credentials*", "secrets*", ".npmrc", ".netrc", ".git-credentials", "*.keystore"]


def die(msg, code=2):
    print(f"hfjob: {msg}", file=sys.stderr)
    sys.exit(code)


def name_hit(path, patterns):
    """True when the full path or any path component matches one of the glob patterns."""
    parts = path.split("/")
    for pat in patterns:
        pat = pat.rstrip("/")
        if "/" in pat:
            if fnmatch.fnmatch(path, pat) or path.startswith(pat + "/"):
                return True
        elif any(fnmatch.fnmatch(p, pat) for p in parts):
            return True
    return False


def git_manifest(root):
    try:
        out = subprocess.run(["git", "-C", root, "ls-files", "-co", "--exclude-standard", "-z"], check=True, capture_output=True).stdout
    except (subprocess.CalledProcessError, FileNotFoundError):
        die(f"{root} is not a git checkout (the bundle manifest is git ls-files -co --exclude-standard)")
    return [p for p in out.decode("utf-8", "surrogateescape").split("\0") if p]


def walk(root, rel):
    base = os.path.join(root, rel)
    if os.path.isfile(base) or os.path.islink(base):
        yield rel
        return
    for d, dirs, files in os.walk(base):
        dirs[:] = [x for x in dirs if x not in (".git", "node_modules")]
        for f in files:
            yield os.path.relpath(os.path.join(d, f), root)


def build_manifest(root, includes, excludes):
    files = []
    seen = set()
    names = git_manifest(root)
    for inc in includes:
        if os.path.isabs(inc):
            die(f"--include {inc!r}: give a path inside the checkout (relative), absolute paths are refused")
        norm = os.path.normpath(inc)
        if norm.startswith(".."):
            die(f"--include {inc!r} points outside the checkout")
        if not os.path.exists(os.path.join(root, norm)):
            die(f"--include {inc!r} does not exist under {root}")
        names.extend(walk(root, norm))
    skipped_links = []
    for rel in names:
        if rel in seen:
            continue
        seen.add(rel)
        if name_hit(rel, ALWAYS_EXCLUDE) or any(fnmatch.fnmatch(rel, g) or name_hit(rel, [g]) for g in excludes):
            continue
        full = os.path.join(root, rel)
        if os.path.islink(full):
            tgt = os.path.realpath(full)
            if not (tgt == os.path.realpath(root) or tgt.startswith(os.path.realpath(root) + os.sep)):
                skipped_links.append(rel)   # a link out of the checkout would pull other files in: dropped, reported
                continue
        elif not os.path.isfile(full):
            continue
        files.append(rel)
    return sorted(files), skipped_links


def scan_bytes(rel, data):
    for rx, what in SECRET_PATTERNS:
        if rx.search(data):
            return what
    return None


def human(n):
    return f"{n / 1048576:.1f} MB"


def cmd_pack(a):
    root = os.path.realpath(a.root)
    cap = int(a.max_mb) * 1048576
    files, links = build_manifest(root, a.include, a.exclude)
    if not files:
        die("the bundle manifest is empty")
    # 1) names: anything credential-shaped that survived (only possible via --include of an odd name) refuses
    for rel in files:
        if name_hit(rel, CRED_NAMES):
            die(f"refused: credential-looking name in the manifest: {rel}")
    # 2) size cap, with the largest entries listed
    sizes = [(os.path.getsize(os.path.join(root, r)) if not os.path.islink(os.path.join(root, r)) else 0, r) for r in files]
    total = sum(s for s, _ in sizes)
    if total > cap:
        big = sorted(sizes, reverse=True)[:10]
        lines = "\n".join(f"  {human(s):>10}  {r}" for s, r in big)
        die(f"refused: bundle is {human(total)} > --max-mb {a.max_mb}. Largest entries:\n{lines}\nUse --exclude GLOB, or raise --max-mb.")
    # 3) content: secret patterns in every file
    for rel in files:
        full = os.path.join(root, rel)
        if os.path.islink(full):
            continue
        with open(full, "rb") as fh:
            data = fh.read(SCAN_MAX_FILE)
        hit = scan_bytes(rel, data)
        if hit:
            die(f"refused: {rel} contains a {hit}. Remove it or --exclude it; nothing was packed.")
    os.makedirs(os.path.dirname(os.path.abspath(a.out)) or ".", exist_ok=True)
    with tarfile.open(a.out, "w:gz", compresslevel=6) as tf:
        for rel in files:
            ti = tf.gettarinfo(os.path.join(root, rel), arcname=rel)
            ti.uid = ti.gid = 0
            ti.uname = ti.gname = ""
            if ti.isreg():
                with open(os.path.join(root, rel), "rb") as fh:
                    tf.addfile(ti, fh)
            else:
                tf.addfile(ti)
    summary = {"files": len(files), "bytes": total, "tar_bytes": os.path.getsize(a.out), "skipped_links": links}
    print(json.dumps(summary))


def safe_members(tf):
    for m in tf.getmembers():
        n = os.path.normpath(m.name)
        if n.startswith("/") or n.startswith("..") or "/../" in n or m.isdev() or m.isfifo():
            die(f"refused: unsafe path in archive: {m.name}")
        if m.issym() or m.islnk():
            tgt = os.path.normpath(os.path.join(os.path.dirname(n), m.linkname)) if m.issym() else os.path.normpath(m.linkname)
            if tgt.startswith("/") or tgt.startswith(".."):
                die(f"refused: link {m.name} escapes the archive")
        yield m


def cmd_scan(a):
    cap = int(a.max_mb) * 1048576
    total = 0
    with tarfile.open(a.tar, "r:gz") as tf:
        for m in safe_members(tf):
            if not m.isfile():
                continue
            total += m.size
            if name_hit(m.name, ALWAYS_EXCLUDE) or name_hit(m.name, CRED_NAMES):
                die(f"refused: credential-looking name in the tarball: {m.name}")
            if total > cap:
                die(f"refused: tarball expands beyond --max-mb {a.max_mb}")
            hit = scan_bytes(m.name, tf.extractfile(m).read(SCAN_MAX_FILE))
            if hit:
                die(f"refused: {m.name} contains a {hit}")
    print(json.dumps({"bytes": total}))


# ---- network side -------------------------------------------------------------------------------------------------------------

def repo_id():
    data = os.environ.get("HFBOX_DATA") or os.path.join(HERE, "..", "..", "data", "hf-boxes.json")
    owner = json.load(open(data))["owner"]
    return os.environ.get("HFJOB_BUNDLE_REPO") or f"{owner}/hfjob-bundles"


def api():
    try:
        from huggingface_hub import HfApi
    except ImportError:
        die("huggingface_hub is not installed here", 1)
    if not os.environ.get("HF_TOKEN"):
        die("no HF token available to this process (it is read by hfjob.sh on the VPS)", 1)
    return HfApi()   # picks HF_TOKEN from the environment; never passed as an argument


def ensure_private(h):
    rid = repo_id()
    try:
        info = h.repo_info(rid, repo_type="dataset")
        if not info.private:
            die(f"refused: dataset {rid} is PUBLIC. Make it private (or set HFJOB_BUNDLE_REPO) before bundling.")
    except Exception as e:   # noqa: BLE001 - only "not found" creates the repo
        if e.__class__.__name__ != "RepositoryNotFoundError" and "404" not in str(e):
            raise
        h.create_repo(rid, repo_type="dataset", private=True, exist_ok=True)
        if not h.repo_info(rid, repo_type="dataset").private:
            die(f"refused: created {rid} but it is not private")
    return rid


def cmd_upload(a):
    h = api()
    rid = ensure_private(h)
    h.upload_file(path_or_fileobj=a.tar, path_in_repo=f"bundles/{a.id}.tar.gz", repo_id=rid, repo_type="dataset", commit_message=f"bundle {a.id}")
    print(rid)


def cmd_drop(a):
    h = api()
    try:
        h.delete_file(f"bundles/{a.id}.tar.gz", repo_id=repo_id(), repo_type="dataset", commit_message=f"drop {a.id}")
    except Exception as e:   # noqa: BLE001
        print(f"hfjob: bundle {a.id} was already gone ({e.__class__.__name__})", file=sys.stderr)


def job_finished(h, job):
    try:
        st = str(h.inspect_job(job_id=job).status.stage).upper()
    except Exception:   # noqa: BLE001
        return False
    return any(x in st for x in ("COMPLETED", "ERROR", "CANCEL", "DELETED", "TIMEOUT"))


def fetch_result(h, rid, job, wait):
    from huggingface_hub import hf_hub_download
    path = f"results/{job}.tar.gz"
    deadline = time.time() + int(wait or 0)
    while True:
        try:
            return path, hf_hub_download(rid, path, repo_type="dataset", token=os.environ["HF_TOKEN"], force_download=True)
        except Exception as e:   # noqa: BLE001
            missing = "404" in str(e) or e.__class__.__name__ in ("EntryNotFoundError", "RemoteEntryNotFoundError", "RepositoryNotFoundError")
            if not missing:
                raise
            if time.time() < deadline and not job_finished(h, job):
                time.sleep(10)
                continue
            print(f"hfjob: no result for job {job} yet (not finished, or it produced none): hfjob inspect {job}", file=sys.stderr)
            sys.exit(3)


def cmd_collect(a):
    h = api()
    rid = repo_id()
    path, local = fetch_result(h, rid, a.job, a.wait)
    out = None
    if a.stdout:
        with open(local, "rb") as fh:
            while True:
                chunk = fh.read(1 << 20)
                if not chunk:
                    break
                sys.stdout.buffer.write(chunk)
        sys.stdout.buffer.flush()
    else:
        out = os.path.abspath(a.out or f"hfjob-result-{a.job}")
        os.makedirs(out, exist_ok=True)
        with tarfile.open(local, "r:gz") as tf:
            members = list(safe_members(tf))
            if sys.version_info >= (3, 12):
                tf.extractall(out, members=members, filter="data")
            else:
                tf.extractall(out, members=members)
    h.delete_file(path, repo_id=rid, repo_type="dataset", commit_message=f"collected {a.job}")   # only after the data is safely out
    try:
        os.remove(local)
    except OSError:
        pass
    print(f"collected job={a.job} remote result deleted" + (f" -> {out}" if out else ""), file=sys.stderr if a.stdout else sys.stdout)


def cmd_extract(a):
    os.makedirs(a.out, exist_ok=True)
    with tarfile.open(fileobj=sys.stdin.buffer, mode="r|gz") as tf:   # streamed: each member is checked as it arrives
        for m in tf:
            n = os.path.normpath(m.name)
            if n.startswith("/") or n.startswith("..") or m.isdev() or m.isfifo() or m.issym() or m.islnk():
                die(f"refused: unsafe member in result: {m.name}")
            if sys.version_info >= (3, 12):
                tf.extract(m, a.out, filter="data")
            else:
                tf.extract(m, a.out)
    print(f"extracted -> {a.out}")


def parse_lines(path):
    import shlex
    out = []
    for n, raw in enumerate(open(path), 1):
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        try:
            out.append((n, shlex.split(line)))
        except ValueError as e:
            die(f"{path}:{n}: {e}")
    return out


def run_many(script, jobs):
    """jobs: [(label, argv)] run concurrently through `bash script`; results print in input order. Returns how many failed."""
    from concurrent.futures import ThreadPoolExecutor
    width = int(os.environ.get("HFJOB_BATCH_JOBS", "8"))

    def one(item):
        label, argv = item
        return label, subprocess.run(["bash", script] + argv, capture_output=True, text=True)

    bad = 0
    with ThreadPoolExecutor(max_workers=max(1, width)) as ex:
        for label, r in ex.map(one, jobs):
            for ln in r.stdout.splitlines():
                if ln.startswith("tier=") or ln.startswith("collected "):
                    print(ln, flush=True)
            if r.returncode != 0:
                bad += 1
                tail = [x for x in r.stderr.splitlines() if x.strip()][-1:] or ["failed"]
                print(f"hfjob: {label} failed (rc={r.returncode}): {tail[0]}", file=sys.stderr)
    return bad


def cmd_batch(a):
    jobs = parse_lines(a.file)
    if not jobs:
        die(f"{a.file} has no jobs")
    for n, argv in jobs:
        if argv[:1] in (["--batch"], ["collect"]):
            die(f"{a.file}:{n}: a batch line is one submit; no nested --batch or collect")
    sys.exit(1 if run_many(a.script, [(f"line {n}", argv) for n, argv in jobs]) else 0)


def job_ids(spec):
    text = open(spec).read() if os.path.isfile(spec) else spec.replace(",", "\n")
    ids = []
    for ln in text.splitlines():
        m = re.search(r"job=([0-9a-f]{24})", ln) or re.fullmatch(r"\s*([0-9a-f]{24})\s*", ln)
        if m and m.group(1) not in ids:
            ids.append(m.group(1))
    return ids


def cmd_collect_all(a):
    ids = job_ids(a.spec)
    if not ids:
        die(f"no job ids in {a.spec}")
    base = os.path.abspath(a.out or "hfjob-results")
    jobs = [(f"collect {i}", ["collect", i, "--out", os.path.join(base, i)] + (["--wait", str(a.wait)] if a.wait else [])) for i in ids]
    sys.exit(1 if run_many(a.script, jobs) else 0)


def main():
    p = argparse.ArgumentParser(prog="bundle.py")
    sp = p.add_subparsers(dest="cmd", required=True)
    s = sp.add_parser("pack"); s.add_argument("--root", required=True); s.add_argument("--out", required=True)
    s.add_argument("--include", action="append", default=[]); s.add_argument("--exclude", action="append", default=[]); s.add_argument("--max-mb", default=DEFAULT_MAX_MB)
    s = sp.add_parser("scan"); s.add_argument("tar"); s.add_argument("--max-mb", default=DEFAULT_MAX_MB)
    s = sp.add_parser("upload"); s.add_argument("tar"); s.add_argument("--id", required=True)
    s = sp.add_parser("drop"); s.add_argument("id")
    s = sp.add_parser("collect"); s.add_argument("job"); s.add_argument("--out"); s.add_argument("--stdout", action="store_true"); s.add_argument("--wait", default=0)
    s = sp.add_parser("extract"); s.add_argument("--out", required=True)
    s = sp.add_parser("batch"); s.add_argument("file"); s.add_argument("--script", required=True)
    s = sp.add_parser("collect-all"); s.add_argument("spec"); s.add_argument("--out"); s.add_argument("--script", required=True); s.add_argument("--wait", default=0)
    a = p.parse_args()
    if getattr(a, "max_mb", None) is not None and not re.fullmatch(r"[0-9]+", str(a.max_mb)):
        die("--max-mb must be a whole number")
    if a.cmd in ("upload", "collect", "drop"):
        if not re.fullmatch(r"[0-9a-f]{24}|[0-9a-f-]{36}", getattr(a, "id", None) or getattr(a, "job", None) or ""):
            die("id must be a job id (24 hex) or a bundle uuid")
    {"pack": cmd_pack, "scan": cmd_scan, "upload": cmd_upload, "drop": cmd_drop, "collect": cmd_collect, "extract": cmd_extract,
     "batch": cmd_batch, "collect-all": cmd_collect_all}[a.cmd](a)


if __name__ == "__main__":
    main()
