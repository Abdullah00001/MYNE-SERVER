#!/bin/bash

# ============================================================
# MongoDB Replica Set — Status & Health Check Script
# ============================================================
# Usage:
#   bash mongodb/scripts/rs-status.sh [local|prod]
# ============================================================

set -euo pipefail

MODE="${1:-local}"
COMPOSE_FILE="docker-compose.${MODE}.yml"
[ "$MODE" = "prod" ] && COMPOSE_FILE="docker-compose.yml"

source .env 2>/dev/null || true
ROOT_USER="${MONGO_ROOT_USER:-admin}"
ROOT_PASS="${MONGO_ROOT_PASSWORD:-adminpassword}"
DB_NAME="${MONGO_DB_NAME:-sofiajamale}"

CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m'

echo ""
echo -e "${BOLD}${CYAN}============================================${NC}"
echo -e "${BOLD}${CYAN}  MongoDB Replica Set Status${NC}"
echo -e "${BOLD}${CYAN}============================================${NC}"
echo ""

# ─── Replica set overview ─────────────────────────────────
echo -e "${CYAN}▶ Replica Set Members:${NC}"
docker compose -f "$COMPOSE_FILE" exec -T mongo1 \
    mongosh --quiet \
    --username "$ROOT_USER" --password "$ROOT_PASS" \
    --authenticationDatabase admin \
    --eval "
const s = rs.status()
print('  Replica Set: ' + s.set)
print('  Date:        ' + s.date)
print('')
s.members.forEach(m => {
  const lag = m.optimeDate ? Math.round((new Date() - m.optimeDate)/1000) + 's' : 'N/A'
  const icon = m.stateStr === 'PRIMARY' ? '👑' : m.stateStr === 'SECONDARY' ? '🔄' : '❓'
  print('  ' + icon + '  ' + m.name.padEnd(22) + m.stateStr.padEnd(12) + 'health:' + m.health + '  repl-lag:' + lag)
})
" 2>/dev/null

echo ""
echo -e "${CYAN}▶ Oplog Window:${NC}"
docker compose -f "$COMPOSE_FILE" exec -T mongo1 \
    mongosh --quiet \
    --username "$ROOT_USER" --password "$ROOT_PASS" \
    --authenticationDatabase admin \
    --eval "
use local
const stats = db.oplog.rs.stats()
const firstTs = db.oplog.rs.find().sort({'\$natural': 1}).limit(1).next().ts.toNumber()
const lastTs  = db.oplog.rs.find().sort({'\$natural':-1}).limit(1).next().ts.toNumber()
const windowHours = Math.round((lastTs - firstTs) / 3600)
print('  Oplog size:   ' + Math.round(stats.maxSize/1024/1024) + ' MB')
print('  Window:       ~' + windowHours + ' hours')
" 2>/dev/null

echo ""
echo -e "${CYAN}▶ Current PRIMARY:${NC}"
docker compose -f "$COMPOSE_FILE" exec -T mongo1 \
    mongosh --quiet \
    --username "$ROOT_USER" --password "$ROOT_PASS" \
    --authenticationDatabase admin \
    --eval "print('  ' + rs.status().members.find(m=>m.stateStr==='PRIMARY').name)" 2>/dev/null

echo ""
echo -e "${CYAN}▶ Database Stats ('${DB_NAME}'):${NC}"
docker compose -f "$COMPOSE_FILE" exec -T mongo1 \
    mongosh --quiet \
    --username "$ROOT_USER" --password "$ROOT_PASS" \
    --authenticationDatabase admin \
    --eval "
use $DB_NAME
const s = db.stats()
print('  Collections:  ' + s.collections)
print('  Documents:    ' + s.objects)
print('  Data size:    ' + Math.round(s.dataSize/1024/1024) + ' MB')
print('  Storage size: ' + Math.round(s.storageSize/1024/1024) + ' MB')
print('  Indexes:      ' + s.indexes)
" 2>/dev/null

echo ""
echo -e "${CYAN}▶ Container Resource Usage:${NC}"
docker stats --no-stream --format "  {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}" \
    sofiajamale_mongo1 sofiajamale_mongo2 sofiajamale_mongo3 2>/dev/null \
    || docker stats --no-stream --format "  {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}" \
    mongo1 mongo2 mongo3 2>/dev/null || true

echo ""
echo -e "${CYAN}▶ Available Backups:${NC}"
docker compose -f "$COMPOSE_FILE" exec -T mongo-backup \
    bash /backup.sh list 2>/dev/null || echo "  (backup container not running)"

echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}  Health check complete${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""