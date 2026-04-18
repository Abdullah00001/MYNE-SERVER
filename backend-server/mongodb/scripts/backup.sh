#!/bin/bash

# ============================================================
# MongoDB Backup Script
# Reads all config from environment variables (.env via docker-compose)
# ============================================================
# Required env vars:
#   MONGO_ROOT_USER, MONGO_ROOT_PASSWORD
#   MONGO_DB_NAME, BACKUP_RETAIN_DAYS
# ============================================================
# Usage:
#   Cron (daily 02:00): bash backup.sh cron
#   Manual backup:      bash backup.sh backup
#   List backups:       bash backup.sh list
#   Restore:            bash backup.sh restore <filename.gz>
# ============================================================

set -euo pipefail

CYAN='\033[0;36m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
log()  { echo -e "${CYAN}[$(date '+%Y-%m-%d %H:%M:%S')] $1${NC}"; }
ok()   { echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')] ✅ $1${NC}"; }
warn() { echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] ⚠️  $1${NC}"; }
err()  { echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] ❌ $1${NC}"; }

# Validate required vars
: "${MONGO_ROOT_USER:?MONGO_ROOT_USER not set}"
: "${MONGO_ROOT_PASSWORD:?MONGO_ROOT_PASSWORD not set}"
: "${MONGO_DB_NAME:?MONGO_DB_NAME not set}"

BACKUP_DIR="/backups"
RETAIN_DAYS="${BACKUP_RETAIN_DAYS:-7}"
mkdir -p "$BACKUP_DIR"

# ─── Find a secondary to read from (avoids load on primary) ──
get_read_host() {
    mongosh --host "mongo1:27017" --quiet \
        --username "$MONGO_ROOT_USER" \
        --password "$MONGO_ROOT_PASSWORD" \
        --authenticationDatabase admin \
        --eval "
const s = rs.status().members.find(m => m.stateStr === 'SECONDARY')
print(s ? s.name : 'mongo1:27017')
" 2>/dev/null || echo "mongo1:27017"
}

# ─── Run backup ───────────────────────────────────────────
run_backup() {
    local ts; ts=$(date '+%Y%m%d_%H%M%S')
    local archive="${BACKUP_DIR}/${MONGO_DB_NAME}_${ts}.gz"
    local meta="${BACKUP_DIR}/${MONGO_DB_NAME}_${ts}.meta"
    local host; host=$(get_read_host)

    log "Starting backup of '${MONGO_DB_NAME}' from ${host}..."

    if mongodump \
        --host "$host" \
        --username "$MONGO_ROOT_USER" \
        --password "$MONGO_ROOT_PASSWORD" \
        --authenticationDatabase admin \
        --db "$MONGO_DB_NAME" \
        --readPreference secondaryPreferred \
        --gzip \
        --archive="$archive" 2>&1 | tail -3; then

        local size; size=$(du -sh "$archive" | cut -f1)
        cat > "$meta" <<EOF
timestamp=${ts}
database=${MONGO_DB_NAME}
host=${host}
size=${size}
retain_days=${RETAIN_DAYS}
EOF
        ok "Backup complete: $(basename "$archive") (${size})"
    else
        err "Backup FAILED"
        rm -f "$archive" "$meta"
        return 1
    fi

    # Prune old backups
    log "Pruning backups older than ${RETAIN_DAYS} days..."
    local pruned=0
    while IFS= read -r f; do
        rm -f "$f" "${f%.gz}.meta"
        warn "Deleted: $(basename "$f")"
        pruned=$((pruned+1))
    done < <(find "$BACKUP_DIR" -name "*.gz" -mtime "+${RETAIN_DAYS}" -type f 2>/dev/null || true)
    [ $pruned -eq 0 ] && log "Nothing to prune" || ok "Pruned ${pruned} old backup(s)"

    local total; total=$(find "$BACKUP_DIR" -name "*.gz" -type f 2>/dev/null | wc -l)
    local used;  used=$(du -sh "$BACKUP_DIR" 2>/dev/null | cut -f1)
    log "Storage: ${total} backup(s) — ${used} total"
}

# ─── List backups ─────────────────────────────────────────
list_backups() {
    echo ""
    log "Available backups in ${BACKUP_DIR}:"
    echo ""
    if ls "${BACKUP_DIR}"/*.gz 1>/dev/null 2>&1; then
        printf "  %-50s  %8s  %20s\n" "FILENAME" "SIZE" "CREATED"
        printf "  %-50s  %8s  %20s\n" "--------" "----" "-------"
        while IFS= read -r f; do
            printf "  %-50s  %8s  %20s\n" \
                "$(basename "$f")" \
                "$(du -sh "$f" | cut -f1)" \
                "$(date -r "$f" '+%Y-%m-%d %H:%M:%S' 2>/dev/null || stat -c '%y' "$f" | cut -d. -f1)"
        done < <(find "$BACKUP_DIR" -name "*.gz" | sort)
    else
        warn "No backups found in ${BACKUP_DIR}"
    fi
    echo ""
}

# ─── Restore ──────────────────────────────────────────────
run_restore() {
    local file="${1:-}"
    [ -z "$file" ] && { err "Usage: bash backup.sh restore <filename.gz>"; list_backups; exit 1; }

    local path="${BACKUP_DIR}/${file}"
    [ ! -f "$path" ] && { err "Not found: ${path}"; exit 1; }

    echo ""
    warn "════════════════════════════════════════════"
    warn "  RESTORE will OVERWRITE '${MONGO_DB_NAME}'"
    warn "  Archive: ${file}"
    warn "════════════════════════════════════════════"
    echo ""
    read -r -p "  Type 'yes' to confirm: " confirm
    [ "$confirm" != "yes" ] && { log "Cancelled."; exit 0; }

    log "Restoring '${MONGO_DB_NAME}' from ${file}..."
    mongorestore \
        --host "mongo1:27017" \
        --username "$MONGO_ROOT_USER" \
        --password "$MONGO_ROOT_PASSWORD" \
        --authenticationDatabase admin \
        --db "$MONGO_DB_NAME" \
        --drop \
        --gzip \
        --archive="$path" 2>&1 | tail -10

    ok "Restore complete!"
}

# ─── Cron mode ────────────────────────────────────────────
run_cron() {
    log "Backup service started (cron mode)"
    log "Schedule: daily 02:00 UTC | Retain: ${RETAIN_DAYS} days | DB: ${MONGO_DB_NAME}"

    # Install cron
    apk add --no-cache dcron > /dev/null 2>&1 || true

    cat > /etc/crontabs/root << EOF
# Daily MongoDB backup at 02:00 UTC
0 2 * * * bash /backup.sh backup >> ${BACKUP_DIR}/backup.log 2>&1
EOF

    log "Running initial backup on startup..."
    run_backup

    ok "Cron daemon starting — next scheduled backup at 02:00 UTC"
    crond -f -l 2
}

# ─── Entrypoint ───────────────────────────────────────────
case "${1:-backup}" in
    cron)    run_cron ;;
    backup)  run_backup ;;
    restore) run_restore "${2:-}" ;;
    list)    list_backups ;;
    *) echo "Usage: bash backup.sh [cron|backup|restore <file>|list]"; exit 1 ;;
esac