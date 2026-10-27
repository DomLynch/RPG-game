# Sourced by deploy.sh and pre-launch.sh (before their first `hf`). When scripts/lib/hf-submit.json says submit=vps, scripts/hf-vps/bin comes first on PATH,
# so every `hf` of the train, the pre-launch jobs and the cleanup is submitted from the VPS (the token never leaves the box). submit=mac (today's default) changes nothing.
_hf_submit_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
if [[ "$(node -e 'try{process.stdout.write(String(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).submit))}catch{}' "${HF_SUBMIT_JSON:-$_hf_submit_root/lib/hf-submit.json}")" == "vps" ]]; then
  export PATH="$_hf_submit_root/hf-vps/bin:$PATH"
  echo "hf-submit: jobs are submitted from the VPS (scripts/lib/hf-submit.json submit=vps)" >&2
fi
unset _hf_submit_root
