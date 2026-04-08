#!/usr/bin/env bash
# ============================================================
# restore.sh - Restore ClickHouse NAT logs from backup
# Usage: ./restore.sh <backup_file> [clickhouse_host] [--truncate]
# ============================================================

set -euo pipefail

BACKUP_FILE="${1:-}"
CLICKHOUSE_HOST="${2:-localhost}"
TRUNCATE_FIRST="no"

# Parse flags
for arg in "$@"; do
    case "$arg" in
        --truncate) TRUNCATE_FIRST="yes" ;;
    esac
done

if [[ -z "${BACKUP_FILE}" ]]; then
    echo "Usage: $0 <backup_file.tsv.gz> [clickhouse_host] [--truncate]"
    echo ""
    echo "Options:"
    echo "  backup_file    Path to a .tsv.gz backup file"
    echo "  clickhouse_host  ClickHouse server hostname (default: localhost)"
    echo "  --truncate     Truncate the nat_logs table before restoring"
    echo ""
    echo "Available backups:"
    BACKUP_BASE_DIR="/opt/log-platform/backups"
    if [[ -d "${BACKUP_BASE_DIR}" ]]; then
        find "${BACKUP_BASE_DIR}" -name "*.tsv.gz" -type f | sort
    else
        echo "  (no backup directory found at ${BACKUP_BASE_DIR})"
    fi
    exit 1
fi

if [[ ! -f "${BACKUP_FILE}" ]]; then
    echo "ERROR: Backup file not found: ${BACKUP_FILE}"
    exit 1
fi

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"
}

# -----------------------------------------------------------
# Pre-restore checks
# -----------------------------------------------------------
log "Verifying ClickHouse connectivity..."
if ! clickhouse-client --host "${CLICKHOUSE_HOST}" --port 9000 --query "SELECT 1" &>/dev/null; then
    echo "ERROR: Cannot connect to ClickHouse at ${CLICKHOUSE_HOST}:9000"
    exit 1
fi

log "Backup file: ${BACKUP_FILE}"
log "File size: $(du -sh "${BACKUP_FILE}" | cut -f1)"

# -----------------------------------------------------------
# Verify backup integrity (test decompression)
# -----------------------------------------------------------
log "Verifying backup file integrity..."
if ! gzip -t "${BACKUP_FILE}" 2>/dev/null; then
    echo "ERROR: Backup file is corrupted or not a valid gzip file."
    exit 1
fi
log "Integrity check passed."

# -----------------------------------------------------------
# Count rows in backup (header line excluded)
# -----------------------------------------------------------
ROW_COUNT=$(zcat "${BACKUP_FILE}" | tail -n +2 | wc -l | tr -d ' ')
log "Backup contains ${ROW_COUNT} rows."

if [[ "${ROW_COUNT}" -eq 0 ]]; then
    log "WARNING: Backup file contains no data rows. Nothing to restore."
    exit 0
fi

# -----------------------------------------------------------
# Optional truncate
# -----------------------------------------------------------
if [[ "${TRUNCATE_FIRST}" == "yes" ]]; then
    log "Truncating nat_logs table..."
    clickhouse-client --host "${CLICKHOUSE_HOST}" --port 9000 --query "TRUNCATE TABLE IF EXISTS nat_logs"
    log "Table truncated."
fi

# -----------------------------------------------------------
# Get row count before restore
# -----------------------------------------------------------
BEFORE_COUNT=$(clickhouse-client --host "${CLICKHOUSE_HOST}" --port 9000 --query "SELECT count() FROM nat_logs" 2>/dev/null || echo "0")
log "Rows in nat_logs before restore: ${BEFORE_COUNT}"

# -----------------------------------------------------------
# Restore data
# -----------------------------------------------------------
log "Restoring data from backup..."

zcat "${BACKUP_FILE}" \
    | clickhouse-client \
        --host "${CLICKHOUSE_HOST}" \
        --port 9000 \
        --query "INSERT INTO nat_logs FORMAT TSVWithNames"

# -----------------------------------------------------------
# Post-restore verification
# -----------------------------------------------------------
AFTER_COUNT=$(clickhouse-client --host "${CLICKHOUSE_HOST}" --port 9000 --query "SELECT count() FROM nat_logs" 2>/dev/null || echo "0")
INSERTED=$(( AFTER_COUNT - BEFORE_COUNT ))

log "Rows in nat_logs after restore: ${AFTER_COUNT}"
log "Rows inserted: ${INSERTED}"

if [[ "${INSERTED}" -eq "${ROW_COUNT}" ]]; then
    log "Restore completed successfully. All ${ROW_COUNT} rows restored."
elif [[ "${INSERTED}" -gt 0 ]]; then
    log "WARNING: Expected ${ROW_COUNT} rows but inserted ${INSERTED}. Some rows may have been deduplicated or rejected."
else
    log "ERROR: No rows were inserted. Check ClickHouse logs for errors."
    exit 1
fi
