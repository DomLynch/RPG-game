# Sourced by deploy.sh. DEPLOY_TRUST_ROWS="47" DEPLOY_TRUST_REASON="..." trusts named release rows for ONE run, on a written
# Lead/Strategy ruling only (first use 2026-09-27, row 47 clip-send-tour). Pass both inline on the deploy.sh command, never export them.
# Unset DEPLOY_TRUST_ROWS leaves the CI-only list and source untouched.

# Fails fast (before the build) when rows are named without a reason.
deploy_trust_check() {
  [[ -z "${DEPLOY_TRUST_ROWS:-}" || -n "${DEPLOY_TRUST_REASON:-}" ]] || { echo 'DEPLOY_TRUST_ROWS needs DEPLOY_TRUST_REASON'; exit 1; }
}

# Appends the ruled rows to trusted_checks and names the ruling in trust_source.
deploy_trust_apply() {
  deploy_trust_check
  [[ -n "${DEPLOY_TRUST_ROWS:-}" ]] || return 0
  echo "Rows $DEPLOY_TRUST_ROWS trusted by ruling for this run only: $DEPLOY_TRUST_REASON"
  trusted_checks="${trusted_checks:+$trusted_checks,}$DEPLOY_TRUST_ROWS"
  trust_source="$trust_source + ruling (rows $DEPLOY_TRUST_ROWS)"
}
