#!/bin/bash

# ============================================================
# MongoDB Replica Set Initialization
# Reads all config from environment variables (.env via docker-compose)
# ============================================================
# Required env vars (all sourced from .env):
#   MONGO_ROOT_USER, MONGO_ROOT_PASSWORD
#   MONGO_APP_USER,  MONGO_APP_PASSWORD
#   MONGO_DB_NAME
# ============================================================

set -e

CYAN='\033[0;36m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
log()  { echo -e "${CYAN}[$(date '+%H:%M:%S')] $1${NC}"; }
ok()   { echo -e "${GREEN}[$(date '+%H:%M:%S')] ✅ $1${NC}"; }
warn() { echo -e "${YELLOW}[$(date '+%H:%M:%S')] ⚠️  $1${NC}"; }
err()  { echo -e "${RED}[$(date '+%H:%M:%S')] ❌ $1${NC}"; exit 1; }

# Validate required vars
: "${MONGO_ROOT_USER:?MONGO_ROOT_USER is not set in .env}"
: "${MONGO_ROOT_PASSWORD:?MONGO_ROOT_PASSWORD is not set in .env}"
: "${MONGO_APP_USER:?MONGO_APP_USER is not set in .env}"
: "${MONGO_APP_PASSWORD:?MONGO_APP_PASSWORD is not set in .env}"
: "${MONGO_DB_NAME:?MONGO_DB_NAME is not set in .env}"

MAX_WAIT=120

# ─── Wait for a node ──────────────────────────────────────
wait_for_node() {
    local host=$1
    local waited=0
    log "Waiting for $host..."
    until mongosh --host "$host" --quiet \
        --username "$MONGO_ROOT_USER" \
        --password "$MONGO_ROOT_PASSWORD" \
        --authenticationDatabase admin \
        --eval "db.adminCommand('ping')" > /dev/null 2>&1; do
        sleep 2; waited=$((waited+2))
        [ $waited -ge $MAX_WAIT ] && err "Timeout waiting for $host"
    done
    ok "$host is reachable"
}

# ─── Initial grace period ─────────────────────────────────
log "Waiting 10s for mongod processes to start..."
sleep 10

wait_for_node "mongo1:27017"
wait_for_node "mongo2:27017"
wait_for_node "mongo3:27017"

# ─── Check if already initialized ────────────────────────
ALREADY=$(mongosh --host "mongo1:27017" --quiet \
    --username "$MONGO_ROOT_USER" --password "$MONGO_ROOT_PASSWORD" \
    --authenticationDatabase admin \
    --eval "try { rs.status().ok } catch(e) { 0 }" 2>/dev/null || echo "0")

if [ "$ALREADY" = "1" ]; then
    warn "Replica set already initialized — skipping."
    exit 0
fi

# ─── Initiate replica set ─────────────────────────────────
log "Initiating replica set 'rs0'..."
mongosh --host "mongo1:27017" \
    --username "$MONGO_ROOT_USER" --password "$MONGO_ROOT_PASSWORD" \
    --authenticationDatabase admin --quiet --eval "
rs.initiate({
  _id: 'rs0',
  members: [
    { _id: 0, host: 'mongo1:27017', priority: 2 },
    { _id: 1, host: 'mongo2:27017', priority: 1 },
    { _id: 2, host: 'mongo3:27017', priority: 1 }
  ]
})"
ok "Replica set initiated"

# ─── Wait for PRIMARY election ────────────────────────────
log "Waiting for PRIMARY election..."
waited=0
until mongosh --host "mongo1:27017" --quiet \
    --username "$MONGO_ROOT_USER" --password "$MONGO_ROOT_PASSWORD" \
    --authenticationDatabase admin \
    --eval "db.isMaster().ismaster" 2>/dev/null | grep -q "true"; do
    sleep 3; waited=$((waited+3)); echo -n "."
    [ $waited -ge $MAX_WAIT ] && err "Timeout: no PRIMARY elected"
done
echo ""
ok "PRIMARY elected"

# ─── Create application user ──────────────────────────────
log "Creating app user '${MONGO_APP_USER}' on db '${MONGO_DB_NAME}'..."
mongosh --host "mongo1:27017" \
    --username "$MONGO_ROOT_USER" --password "$MONGO_ROOT_PASSWORD" \
    --authenticationDatabase admin --quiet --eval "
use ${MONGO_DB_NAME}
db.createUser({
  user: '${MONGO_APP_USER}',
  pwd:  '${MONGO_APP_PASSWORD}',
  roles: [
    { role: 'readWrite', db: '${MONGO_DB_NAME}' },
    { role: 'dbAdmin',   db: '${MONGO_DB_NAME}' }
  ]
})"
ok "App user '${MONGO_APP_USER}' created"

# ─── Print status ─────────────────────────────────────────
echo ""
log "Replica set members:"
mongosh --host "mongo1:27017" \
    --username "$MONGO_ROOT_USER" --password "$MONGO_ROOT_PASSWORD" \
    --authenticationDatabase admin --quiet --eval "
rs.status().members.forEach(m =>
  print('  ' + m.name + '  =>  ' + m.stateStr)
)"

echo ""
ok "============================================"
ok "  Replica set rs0 is READY"
ok "============================================"
echo ""
echo "  DATABASE_URL (set this in your .env):"
echo "  mongodb://${MONGO_APP_USER}:${MONGO_APP_PASSWORD}@mongo1:27017,mongo2:27017,mongo3:27017/${MONGO_DB_NAME}?replicaSet=rs0&authSource=${MONGO_DB_NAME}&retryWrites=true&w=majority"
echo ""