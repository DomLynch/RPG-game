#!/usr/bin/env bash
# Installs the daily DB backup: copies ops/db-backup.sh to /usr/local/sbin and writes /etc/cron.d/frankendom-db-backup (03:17 server time, root). Run as root from a repo checkout; refuses to install until /etc/frankendom/backup.env exists.
#   sudo bash ops/install-db-backup.sh           undo: sudo rm /etc/cron.d/frankendom-db-backup /usr/local/sbin/frankendom-db-backup.sh
# DUMP_IMAGE is pinned by digest (postgres 17.6, the Supabase server version); change it only with the server's major version.
set -euo pipefail
[[ $EUID -eq 0 ]] || { echo "install-db-backup: run as root"; exit 2; }
[[ -r /etc/frankendom/backup.env ]] || { echo "install-db-backup: /etc/frankendom/backup.env is missing (Dom writes it after he sets the frankendom_backup password)"; exit 3; }
image=${DUMP_IMAGE:-postgres@sha256:00bc86618629af00d2937fdc5a5d63db3ff8450acf52f0636ec813c7f4902929}
cd "$(dirname "$0")"
install -m 755 db-backup.sh /usr/local/sbin/frankendom-db-backup.sh
printf '# Frankendom daily database backup (ops/install-db-backup.sh)\n17 3 * * * root DB_SCHEMAS="public auth" DUMP_IMAGE=%s /usr/local/sbin/frankendom-db-backup.sh >/dev/null 2>&1\n' "$image" >/etc/cron.d/frankendom-db-backup
chmod 644 /etc/cron.d/frankendom-db-backup
echo "install-db-backup: installed; log /var/log/frankendom-db-backup.log"
