#!/usr/bin/env bash
# ============================================================
# backup.sh - ClickHouse NAT logs backup script
# Supports daily (keep 7) and weekly (keep 4) rotation.
# Usage: ./backup.sh [daily|weekly] [clickhouse_host]
# ============================================================

set -euo pipefail

BACKUP_TYPE="${1:-daily}"
CLICKHOUSE_HOST="${2:-localhost}"
CLICKHOUSE_PORT="8123"

BACKUP_BASE_DIR="/opt/log-platform/backups"
DAILY_DIR="${BACKUP_BASE_DIR}/daily"
WEEKLY_DIR="${BACKUP_BASE_DIR}/weekly"
DATE_STAMP=$(date '+%Y-%m-%d_%H%M%S')
DAY_OF_WEEK=$(date '+%u')

DAILY_KEEP=7
WEEKLY_KEEP=4

# -----------------------------------------------------------
# Setup
# -----------------------------------------------------------
mkdir -p "${DAILY_DIR}" "${WEEKLY_DIR}"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"
}

# -----------------------------------------------------------
# Backup function
# -----------------------------------------------------------
do_backup() {
    local dest_dir="$1"
    local label="$2"
    local backup_file="${dest_dir}/nat_logs_${label}_${DATE_STAMP}.tsv.gz"

    log "Starting ${label} backup to ${backup_file}..."

    # Export nat_logs table as TSVWithNames, pipe through gzip
    clickhouse-client \
        --host "${CLICKHOUSE_HOST}" \
        --port 9000 \
        --query "SELECT * FROM nat_logs FORMAT TSVWithNames" \
        | gzip -6 > "${backup_file}"

    local size
    size=$(du -sh "${backup_file}" | cut -f1)
    log "Backup complete: ${backup_file} (${size})"

    echo "${backup_file}"
}

# -----------------------------------------------------------
# Rotation: remove old backups beyond retention limit
# -----------------------------------------------------------
rotate_backups() {
    local dir="$1"
    local keep="$2"
    local label="$3"

    local count
    count=$(find "${dir}" -name "nat_logs_${label}_*.tsv.gz" -type f 2>/dev/null | wc -l | tr -d ' ')

    if (( count > keep )); then
        local to_remove=$(( count - keep ))
        log "Rotating ${label} backups: removing ${to_remove} old file(s) (keeping ${keep})..."
        find "${dir}" -name "nat_logs_${label}_*.tsv.gz" -type f -print0 \
            | sort -z \
            | head -z -n "${to_remove}" \
            | xargs -0 rm -f
    else
        log "No rotation needed for ${label} (${count}/${keep} files)."
    fi
}

# -----------------------------------------------------------
# Main
# -----------------------------------------------------------
case "${BACKUP_TYPE}" in
    daily)
        do_backup "${DAILY_DIR}" "daily"
        rotate_backups "${DAILY_DIR}" "${DAILY_KEEP}" "daily"

        # If it's Sunday (7), also do a weekly backup
        if [[ "${DAY_OF_WEEK}" == "7" ]]; then
            log "Sunday detected, also running weekly backup..."
            do_backup "${WEEKLY_DIR}" "weekly"
            rotate_backups "${WEEKLY_DIR}" "${WEEKLY_KEEP}" "weekly"
        fi
        ;;
    weekly)
        do_backup "${WEEKLY_DIR}" "weekly"
        rotate_backups "${WEEKLY_DIR}" "${WEEKLY_KEEP}" "weekly"
        ;;
    *)
        echo "Usage: $0 [daily|weekly] [clickhouse_host]"
        echo "  daily  - Daily backup with 7-day retention (auto-weekly on Sundays)"
        echo "  weekly - Weekly backup with 4-week retention"
        exit 1
        ;;
esac

log "Backup process finished."
