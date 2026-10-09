# gpu-run's half of the job (scripts/lib/gpu-run.mjs jobScript appends this to scripts/hf-wall-rows/job.sh up to its ROWS section, so the image, clone, npm ci,
# GPU-flag wrappers, the guard (exit 11 unless BOTH Chromium binaries render on NVIDIA) and the build are the wall rows' own). env: SHA, CMD_B64, BLENDER (0/1), CYCLES_B64.
# The caller's own args win over the wrapper's flags, and several scripts pass --use-angle=swiftshader: strip every software-GL arg, then probe again WITH them, so a
# command can never fall back to software unseen.
for bin in "$PLAYWRIGHT_BROWSERS_PATH"/chromium-*/chrome-linux*/chrome "$PLAYWRIGHT_BROWSERS_PATH"/chromium_headless_shell-*/chrome-*/headless_shell "$PLAYWRIGHT_BROWSERS_PATH"/chromium_headless_shell-*/chrome-*/chrome-headless-shell; do
  [[ -e "$bin.real" ]] || continue
  printf '#!/bin/sh\nn=$#\nwhile [ "$n" -gt 0 ]; do a="$1"; shift; case "$a" in --use-angle=*|--use-gl=*|--enable-unsafe-swiftshader|--disable-gpu|--disable-gpu-compositing|--disable-gpu-rasterization|--disable-vulkan-surface) ;; --use-gl|--use-angle) if [ "$n" -gt 1 ]; then shift; n=$((n-1)); fi;; *) set -- "$@" "$a";; esac; n=$((n-1)); done\nexec "%s.real" %s "$@"\n' "$bin" "$chosen" > "$bin"; chmod 755 "$bin"
done
cat > .gl-probe2.mjs <<'PROBE'
import { chromium } from 'playwright';
const sw = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
const renderer = async (options) => { const b = await chromium.launch({ headless: true, args: sw, ...options }), p = await b.newPage();
  try { return await p.evaluate(() => { const c = document.createElement('canvas'), g = c.getContext('webgl2') || c.getContext('webgl'); if (!g) return 'NO WEBGL CONTEXT'; const e = g.getExtension('WEBGL_debug_renderer_info'); return e ? g.getParameter(e.UNMASKED_RENDERER_WEBGL) : g.getParameter(g.RENDERER); }); } finally { await b.close(); } };
console.log(`shell=${await renderer({})} | chrome=${await renderer({ executablePath: chromium.executablePath() })}`);
PROBE
chown pwuser .gl-probe2.mjs
line=$(su pwuser -c "cd $work/repo && PLAYWRIGHT_BROWSERS_PATH=$PLAYWRIGHT_BROWSERS_PATH timeout 90 node .gl-probe2.mjs" 2>&1 | head -1); rm -f .gl-probe2.mjs
say "RENDERER $line"
hw() { echo "$1" | grep -qiE 'nvidia|tesla|geforce|rtx| t4|l4|a10' && ! echo "$1" | grep -qiE 'swiftshader|llvmpipe|software|no webgl'; }
if ! { hw "${line%% | chrome=*}" && hw "${line##* | }"; }; then say "BLOCKER software GL still reachable with swiftshader args (renderer: $line)"; say "COST seconds=$(( $(date +%s) - t0 ))"; exit 11; fi

if [[ "${BLENDER:-0}" == "1" ]]; then
  # Official 5.2.2 (what Characters use), Cycles on the T4: OptiX when the driver exposes it, else CUDA. The helper aborts if no GPU device is usable.
  apt-get install -y -qq xz-utils libxi6 libxkbcommon0 libsm6 libxfixes3 libxrender1 libgl1 libxxf86vm1 libxext6 >/dev/null 2>&1
  # download.blender.org answered 403 to the HF job once (rate limit): try the mirrors, and pin the tarball's sha256 (from download.blender.org/release/Blender5.2/blender-5.2.2.sha256).
  want=84098912789dc450e95697c4184fb8a90acbe5111c2ba4aede3fecb57806a168
  for url in https://download.blender.org/release/Blender5.2 https://mirror.clarkson.edu/blender/release/Blender5.2 https://ftp.nluug.nl/pub/graphics/blender/release/Blender5.2 https://mirrors.dotsrc.org/blender/blender-release/Blender5.2; do
    curl -fsSL -m 600 -o /tmp/dcc.tar.xz "$url/blender-5.2.2-linux-x64.tar.xz" || { echo "download from $url failed"; continue; }
    [[ "$(sha256sum /tmp/dcc.tar.xz | cut -d' ' -f1)" == "$want" ]] && { tar -xf /tmp/dcc.tar.xz -C /opt && ln -sf /opt/blender-5.2.2-linux-x64/blender /usr/local/bin/blender; break; }
    echo "sha256 mismatch from $url"
  done
  mkdir -p /usr/local/share/gpu-run && echo "$CYCLES_B64" | base64 -d > /usr/local/share/gpu-run/cycles_gpu.py
  command -v blender >/dev/null || { say "BLOCKER blender did not install"; say "COST seconds=$(( $(date +%s) - t0 ))"; exit 12; }
  say "BLENDER $(blender --version 2>&1 | head -1)"
fi

say "RUN"
echo "$CMD_B64" | base64 -d > /tmp/cmd.sh; chmod 644 /tmp/cmd.sh
touch /tmp/run.start; sleep 1
c0=$(date +%s)
su pwuser -c "cd $work/repo && PLAYWRIGHT_BROWSERS_PATH=$PLAYWRIGHT_BROWSERS_PATH PATH=$PATH bash /tmp/cmd.sh" 2>&1 | tail -n 4000
rc=${PIPESTATUS[0]}
say "EXIT $rc"
echo "command wall $(( $(date +%s) - c0 ))s"

# Back to the caller: every file under artifacts/ the command wrote (except the built origins-preview site the zone scripts build there), as one gzip tar in the log (base64, capped).
if [[ -d artifacts ]]; then
  find artifacts -type f -newer /tmp/run.start -not -path 'artifacts/origins-preview/*' -print0 | tar czf /tmp/artifacts.tgz --null -T - 2>/dev/null
  bytes=$(stat -c %s /tmp/artifacts.tgz 2>/dev/null || echo 0)
  if [[ "$bytes" -gt 0 && "$bytes" -le $(( ${ARTIFACT_MAX_MB:-24} * 1048576 )) ]]; then say "ARTIFACTS BEGIN bytes=$bytes"; base64 -w 76 /tmp/artifacts.tgz; say "ARTIFACTS END"
  elif [[ "$bytes" -gt 0 ]]; then say "ARTIFACTS TOO_LARGE bytes=$bytes"; fi
fi
say "COST seconds=$(( $(date +%s) - t0 ))"
exit 0
