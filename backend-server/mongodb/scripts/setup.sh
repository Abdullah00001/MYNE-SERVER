#!/bin/bash

# ============================================================
# MongoDB Replica Set — One-Time Setup Script
# ============================================================
# Run ONCE before starting docker-compose for the first time.
# Generates the keyfile and starts the full stack.
#
# Usage:
#   Local:      bash mongodb/scripts/setup.sh local
#   Production: bash mongodb/scripts/setup.sh prod
# ============================================================

set -euo pipefail

CYAN='\033[0;36m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; BOLD='\033[1m'; NC='\033[0m'
log()  { echo -e "${CYAN}[SETUP] $1${NC}"; }
ok()   { echo -e "${GREEN}[SETUP] ✅ $1${NC}"; }
warn() { echo -e "${YELLOW}[SETUP] ⚠️  $1${NC}"; }
err()  { echo -e "${RED}[SETUP] ❌ $1${NC}"; exit 1; }

MODE="${1:-local}"
COMPOSE_FILE="docker-compose.local.yml"
[ "$MODE" = "prod" ] && COMPOSE_FILE="docker-compose.yml"

echo ""
echo -e "${BOLD}${CYAN}============================================${NC}"
echo -e "${BOLD}${CYAN}  MongoDB Replica Set Setup — ${MODE^^}${NC}"
echo -e "${BOLD}${CYAN}============================================${NC}"
echo ""

# ─── Pre-flight ───────────────────────────────────────────
log "Checking prerequisites..."
command -v docker  > /dev/null || err "Docker not installed"
command -v openssl > /dev/null || err "openssl not installed"
ok "Prerequisites OK"

# ─── Check .env ───────────────────────────────────────────
if [ ! -f ".env" ]; then
    warn ".env not found — copying .env.example..."
    cp .env.example .env
    echo ""
    echo -e "${YELLOW}  ⚠️  Please fill in these values in .env before continuing:${NC}"
    echo ""
    echo "    MONGO_ROOT_USER=admin"
    echo "    MONGO_ROOT_PASSWORD=<strong-password>"
    echo "    MONGO_APP_USER=appuser"
    echo "    MONGO_APP_PASSWORD=<strong-password>"
    echo "    MONGO_DB_NAME=sofiajamale"
    echo "    BACKUP_RETAIN_DAYS=7"
    echo "    DATABASE_URL=mongodb://appuser:<password>@mongo1:27017,..."
    echo "    REDIS_PASSWORD=<strong-password>"
    echo ""
    read -r -p "  Press ENTER after editing .env to continue (Ctrl+C to abort): "
fi

# Load and validate required vars
set -a; source .env; set +a

: "${MONGO_ROOT_USER:?MONGO_ROOT_USER is empty in .env}"
: "${MONGO_ROOT_PASSWORD:?MONGO_ROOT_PASSWORD is empty in .env}"
: "${MONGO_APP_USER:?MONGO_APP_USER is empty in .env}"
: "${MONGO_APP_PASSWORD:?MONGO_APP_PASSWORD is empty in .env}"
: "${MONGO_DB_NAME:?MONGO_DB_NAME is empty in .env}"
: "${REDIS_PASSWORD:?REDIS_PASSWORD is empty in .env}"
ok ".env validated"

# ─── Generate keyfile ─────────────────────────────────────
KEYFILE_DIR="./mongodb/keyfile"
KEYFILE="${KEYFILE_DIR}/mongo-keyfile"
mkdir -p "$KEYFILE_DIR"

if [ -f "$KEYFILE" ]; then
    warn "Keyfile already exists — skipping generation"
else
    log "Generating MongoDB keyfile..."
    openssl rand -base64 756 > "$KEYFILE"
    ok "Keyfile created: ${KEYFILE}"
fi

chmod 400 "$KEYFILE"
ok "Keyfile permissions set to 400"

# Linux: MongoDB container runs as uid 999
if [[ "$(uname)" == "Linux" ]]; then
    sudo chown 999:999 "$KEYFILE" 2>/dev/null \
        && ok "Keyfile ownership → 999:999 (mongodb)" \
        || warn "Could not chown. If Docker fails run: sudo chown 999:999 ${KEYFILE}"
fi

# ─── Pull images ──────────────────────────────────────────
log "Pulling images..."
docker compose -f "$COMPOSE_FILE" pull mongo1 redis 2>&1 | grep -E "(Pull|Pulled|up to date)" || true
ok "Images ready"

# ─── Start MongoDB nodes ──────────────────────────────────
log "Starting MongoDB nodes..."
docker compose -f "$COMPOSE_FILE" up -d mongo1 mongo2 mongo3

log "Waiting 15s for mongod to initialize..."
sleep 15

# ─── Initialize replica set ───────────────────────────────
log "Running replica set initialization..."
docker compose -f "$COMPOSE_FILE" run --rm mongo-init
ok "Replica set initialized"

# ─── Start all remaining services ─────────────────────────
log "Starting all services..."
docker compose -f "$COMPOSE_FILE" up -d

log "Waiting 10s for services to stabilize..."
sleep 10

# ─── Status ───────────────────────────────────────────────
echo ""
log "Service status:"
docker compose -f "$COMPOSE_FILE" ps
echo ""

# ─── Done ─────────────────────────────────────────────────
echo -e "${BOLD}${GREEN}============================================${NC}"
echo -e "${BOLD}${GREEN}  Setup Complete! 🎉${NC}"
echo -e "${BOLD}${GREEN}============================================${NC}"
echo ""
echo -e "${CYAN}  Replica Set:${NC}"
echo "    Primary:   mongo1:27017"
echo "    Secondary: mongo2:27017"
echo "    Secondary: mongo3:27017"
echo ""
echo -e "${CYAN}  DATABASE_URL (for your .env):${NC}"
echo "  mongodb://${MONGO_APP_USER}:${MONGO_APP_PASSWORD}@mongo1:27017,mongo2:27017,mongo3:27017/${MONGO_DB_NAME}?replicaSet=rs0&authSource=${MONGO_DB_NAME}&retryWrites=true&w=majority"
echo ""
if [ "$MODE" = "local" ]; then
    echo -e "${CYAN}  Local Web UIs:${NC}"
    echo "    App health:    http://localhost:5000/health"
    echo "    Mongo Express: http://localhost:8082  (user: ${MONGO_ROOT_USER})"
    echo "    Redis UI:      http://localhost:8081  (user: ${MONGO_ROOT_USER})"
    echo ""
fi
echo -e "${CYAN}  Next steps:${NC}"
echo "    Check RS health: bash mongodb/scripts/rs-status.sh ${MODE}"
echo "    Manual backup:   docker compose -f ${COMPOSE_FILE} exec mongo-backup bash /backup.sh backup"
echo "    View all logs:   docker compose -f ${COMPOSE_FILE} logs -f"
echo ""